import type { AIProvider, GenerationInput } from '@weavia/ai-core';
import { NormalizedProviderError } from '@weavia/ai-core';
import type { ObjectStorage } from '@weavia/storage-core';
import type {
  AIGatewayErrorCode,
  CloudAITaskResult,
  ImageGenerationRequest,
  ReferenceAssetInput,
  GenerationQualityLevel,
  User,
} from '@weavia/shared';

export interface ProviderConfigRecord {
  id: string;
  code: string;
  name: string;
  type: 'openai-compatible' | 'dashscope-multimodal';
  baseUrl: string;
  enabled: boolean;
  configured: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface ProviderModelRecord {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string;
  modality: 'image';
  capabilities: Array<'text_to_image' | 'image_to_image' | 'image_edit'>;
  enabled: boolean;
  inputCost?: number;
  outputCost?: number;
  currency?: string;
  pricingUnit?: string;
  metadata: Record<string, unknown>;
  creditsCost: number;
  qualityLevel: GenerationQualityLevel;
  advanced: boolean;
}
export interface LogicalModelRecord {
  id: string;
  key: string;
  displayName: string;
  type: 'image';
  enabled: boolean;
}
export interface ModelBindingRecord {
  id: string;
  logicalModelId: string;
  providerModelId: string;
  priority: number;
  enabled: boolean;
}
export interface ProviderUsageRecord {
  id: string;
  userId: string;
  taskId: string;
  providerId: string;
  providerModelId: string;
  logicalModel: string;
  workflow: string;
  status: 'success' | 'failed';
  attempt: number;
  latencyMs: number;
  providerRequestId?: string;
  estimatedCost?: number;
  actualCost?: number;
  createdAt: string;
  completedAt: string;
}

export interface AICatalog {
  providers: ProviderConfigRecord[];
  providerModels: ProviderModelRecord[];
  logicalModels: LogicalModelRecord[];
  bindings: ModelBindingRecord[];
}

export class InMemoryAIRepository {
  private readonly tasks = new Map<string, CloudAITaskResult>();
  private readonly idempotency = new Map<string, string>();
  private readonly usage: ProviderUsageRecord[] = [];
  constructor(public readonly catalog: AICatalog) {}

  findIdempotent(userId: string, key: string) {
    const taskId = this.idempotency.get(`${userId}:${key}`);
    return taskId ? this.tasks.get(taskId) : undefined;
  }
  saveTask(task: CloudAITaskResult) {
    this.tasks.set(task.id, task);
    this.idempotency.set(`${task.userId}:${task.idempotencyKey}`, task.id);
  }
  getTask(id: string) {
    return this.tasks.get(id);
  }
  listTasks() {
    return [...this.tasks.values()];
  }
  addUsage(record: ProviderUsageRecord) {
    this.usage.push(record);
  }
  listUsage() {
    return [...this.usage];
  }
  countActive(userId: string) {
    return [...this.tasks.values()].filter(
      (task) => task.userId === userId && ['queued', 'running'].includes(task.status),
    ).length;
  }
}

export class GatewayError extends Error {
  constructor(
    public readonly code: AIGatewayErrorCode,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

export class ProviderRouter {
  constructor(private readonly catalog: AICatalog) {}
  route(
    logicalKey: string,
    mode: ImageGenerationRequest['mode'] = 'text_to_image',
    requestedModel?: string,
  ) {
    const logical = this.catalog.logicalModels.find(
      (item) => item.key === logicalKey && item.enabled,
    );
    if (!logical) throw new GatewayError('UNSUPPORTED_MODEL', '不支持该生成档位', 400);
    const candidates = this.catalog.bindings
      .filter((binding) => binding.logicalModelId === logical.id && binding.enabled)
      .sort((left, right) => left.priority - right.priority);
    let hasCapableModel = false;
    for (const binding of candidates) {
      const model = this.catalog.providerModels.find(
        (item) => item.id === binding.providerModelId && item.enabled,
      );
      if (requestedModel && model?.modelId !== requestedModel) continue;
      if (!model?.capabilities.includes(mode)) continue;
      hasCapableModel = true;
      const provider = model
        ? this.catalog.providers.find(
            (item) => item.id === model.providerId && item.enabled && item.configured,
          )
        : undefined;
      if (provider && model) return { logical, provider, model, binding };
    }
    if (!hasCapableModel)
      throw new GatewayError('UNSUPPORTED_CAPABILITY', '当前模型不支持所选生成方式', 400);
    throw new GatewayError('PROVIDER_UNAVAILABLE', '专业生成服务尚未就绪', 503);
  }
}

export interface BillingHook {
  beforeTask(task: CloudAITaskResult): Promise<void>;
  onProviderAccepted(task: CloudAITaskResult): Promise<void>;
  onSuccess(task: CloudAITaskResult): Promise<void>;
  onFailure(task: CloudAITaskResult): Promise<void>;
}
export class NoopBillingHook implements BillingHook {
  async beforeTask() {}
  async onProviderAccepted() {}
  async onSuccess() {}
  async onFailure() {}
}

export interface GatewayOptions {
  maxConcurrentTasksPerUser: number;
  maxProviderAttempts: number;
  realAIEnabled: boolean;
}

export interface ReferenceImageTransport {
  resolve(
    userId: string,
    asset: ReferenceAssetInput,
  ): Promise<NonNullable<GenerationInput['referenceImages']>[number]>;
}

export class ObjectStorageReferenceImageTransport implements ReferenceImageTransport {
  constructor(private readonly storage: ObjectStorage) {}

  async resolve(userId: string, asset: ReferenceAssetInput) {
    if (!asset.objectKey.startsWith(`references/${userId}/`))
      throw new GatewayError('INVALID_REQUEST', '参考图不属于当前用户', 403);
    const downloadUrl = await this.storage.createDownloadUrl(asset.objectKey, 600);
    if (downloadUrl.startsWith('https://') || downloadUrl.startsWith('http://'))
      return { type: 'url' as const, value: downloadUrl, mimeType: asset.mimeType };

    const object = await this.storage.read(asset.objectKey);
    if (object.contentType !== asset.mimeType)
      throw new GatewayError('INVALID_REQUEST', '参考图 MIME 类型不一致', 400);
    return {
      type: 'base64' as const,
      value: `data:${object.contentType};base64,${Buffer.from(object.body).toString('base64')}`,
      mimeType: object.contentType,
    };
  }
}

export class AIGateway {
  private readonly router: ProviderRouter;
  private readonly referenceTransport: ReferenceImageTransport | undefined;
  constructor(
    private readonly repository: InMemoryAIRepository,
    private readonly providers: Map<string, AIProvider>,
    private readonly options: GatewayOptions,
    private readonly billing: BillingHook = new NoopBillingHook(),
    storage?: ObjectStorage,
  ) {
    this.router = new ProviderRouter(repository.catalog);
    this.referenceTransport = storage
      ? new ObjectStorageReferenceImageTransport(storage)
      : undefined;
  }

  async generateImage(user: User, request: ImageGenerationRequest) {
    validateRequest(request);
    const existing = this.repository.findIdempotent(user.id, request.idempotencyKey);
    if (existing) return existing;
    if (!this.options.realAIEnabled)
      throw new GatewayError('REAL_AI_DISABLED', '真实 AI 当前未启用', 503);
    if (this.repository.countActive(user.id) >= this.options.maxConcurrentTasksPerUser)
      throw new GatewayError('CONCURRENCY_LIMIT', '当前已有生成任务，请稍后再试', 409);

    const mode = request.mode ?? 'text_to_image';
    const route = this.router.route(request.logicalModel, mode, request.model);
    if (
      request.metadata?.advancedModelSelection === true &&
      route.model.advanced &&
      !isProfessionalUser(user)
    )
      throw new GatewayError('UNSUPPORTED_MODEL', '当前账户未开放高级模型选择', 403);
    const provider = this.providers.get(route.provider.code);
    if (!provider) throw new GatewayError('PROVIDER_UNAVAILABLE', 'Provider 未配置', 503);
    const capability = mode === 'text_to_image' ? 'image_generation' : mode;
    if (!route.model.capabilities.includes(mode) || !provider.capabilities.has(capability))
      throw new GatewayError('UNSUPPORTED_CAPABILITY', '当前模型不支持参考图生成', 400);
    const referenceImages = await this.resolveReferences(user.id, request);
    const timestamp = new Date().toISOString();
    const task: CloudAITaskResult = {
      id: crypto.randomUUID(),
      userId: user.id,
      idempotencyKey: request.idempotencyKey,
      workflow: request.workflow,
      logicalModel: request.logicalModel,
      status: 'queued',
      outputs: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.repository.saveTask(task);
    await this.billing.beforeTask(task);
    task.status = 'running';
    task.updatedAt = new Date().toISOString();
    this.repository.saveTask(task);

    const providerInput: GenerationInput = {
      capability,
      modelId: route.model.modelId,
      prompt: request.prompt,
      mode,
      ...(referenceImages.length ? { referenceImages } : {}),
      quality: request.quality,
      aspectRatio: '1:1',
      outputCount: 1,
      idempotencyKey: request.idempotencyKey,
    };
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.options.maxProviderAttempts; attempt += 1) {
      const startedAt = Date.now();
      try {
        const result = await provider.generateImage(providerInput);
        await this.billing.onProviderAccepted(task);
        task.status = 'generated';
        task.providerRequestId = result.providerTaskId;
        task.outputs = result.outputs.map((output) =>
          output.uri.startsWith('data:')
            ? { base64Data: output.uri, mimeType: output.mediaType }
            : { temporaryUrl: output.uri, mimeType: output.mediaType },
        );
        task.updatedAt = new Date().toISOString();
        this.repository.saveTask(task);
        this.repository.addUsage({
          id: crypto.randomUUID(),
          userId: user.id,
          taskId: task.id,
          providerId: route.provider.id,
          providerModelId: route.model.id,
          logicalModel: request.logicalModel,
          workflow: request.workflow,
          status: 'success',
          attempt,
          latencyMs: Date.now() - startedAt,
          providerRequestId: result.providerTaskId,
          ...(route.model.outputCost !== undefined
            ? { estimatedCost: route.model.outputCost }
            : {}),
          createdAt: task.createdAt,
          completedAt: task.updatedAt,
        });
        await this.billing.onSuccess(task);
        return task;
      } catch (error) {
        lastError = error;
        const normalized = normalizeGatewayError(error);
        this.repository.addUsage({
          id: crypto.randomUUID(),
          userId: user.id,
          taskId: task.id,
          providerId: route.provider.id,
          providerModelId: route.model.id,
          logicalModel: request.logicalModel,
          workflow: request.workflow,
          status: 'failed',
          attempt,
          latencyMs: Date.now() - startedAt,
          ...(route.model.outputCost !== undefined
            ? { estimatedCost: route.model.outputCost }
            : {}),
          createdAt: task.createdAt,
          completedAt: new Date().toISOString(),
        });
        if (!normalized.retryable || attempt >= this.options.maxProviderAttempts) break;
      }
    }
    const normalized = normalizeGatewayError(lastError);
    task.status = 'failed';
    task.error = { code: normalized.code, message: normalized.message };
    task.updatedAt = new Date().toISOString();
    this.repository.saveTask(task);
    await this.billing.onFailure(task);
    throw new GatewayError(normalized.code, normalized.message, normalized.status);
  }

  private async resolveReferences(userId: string, request: ImageGenerationRequest) {
    if (!request.referenceAssets?.length) return [];
    if (!this.referenceTransport)
      throw new GatewayError('INVALID_REQUEST', '参考图存储尚未配置', 503);
    const references: GenerationInput['referenceImages'] = [];
    for (const asset of request.referenceAssets) {
      references.push(await this.referenceTransport.resolve(userId, asset));
    }
    return references;
  }
}

function isProfessionalUser(user: User) {
  return user.email === 'demo@weavia.local';
}

function validateRequest(request: ImageGenerationRequest) {
  if (!request.idempotencyKey || request.idempotencyKey.length > 128)
    throw new GatewayError('INVALID_REQUEST', '幂等键无效', 400);
  if (!request.projectId || !request.inputAssetId || !request.prompt.trim())
    throw new GatewayError('INVALID_REQUEST', '项目、素材和提示词不能为空', 400);
  if (request.numberOfImages !== 1 || request.size !== '1024x1024')
    throw new GatewayError('INVALID_REQUEST', '当前仅允许生成一张 1024x1024 图片', 400);
  const mode = request.mode ?? 'text_to_image';
  if (mode !== 'text_to_image' && !request.referenceAssets?.length)
    throw new GatewayError('INVALID_REQUEST', '参考图生成必须选择参考素材', 400);
  if ((request.referenceAssets?.length ?? 0) > 3)
    throw new GatewayError('INVALID_REQUEST', '最多支持 3 张参考图', 400);
}

function normalizeGatewayError(error: unknown): {
  code: AIGatewayErrorCode;
  message: string;
  retryable: boolean;
  status: number;
} {
  if (error instanceof NormalizedProviderError)
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      status: error.status ?? 502,
    };
  return {
    code: 'UNKNOWN',
    message: error instanceof Error ? error.message : '未知生成错误',
    retryable: false,
    status: 500,
  };
}
