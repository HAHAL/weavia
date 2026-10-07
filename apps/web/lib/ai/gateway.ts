import type { AIProvider, GenerationInput } from '@weavia/ai-core';
import { NormalizedProviderError } from '@weavia/ai-core';
import type {
  AIGatewayErrorCode,
  CloudAITaskResult,
  ImageGenerationRequest,
  User,
} from '@weavia/shared';

export interface ProviderConfigRecord {
  id: string;
  code: string;
  name: string;
  type: 'openai-compatible';
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
  route(logicalKey: string) {
    const logical = this.catalog.logicalModels.find(
      (item) => item.key === logicalKey && item.enabled,
    );
    if (!logical) throw new GatewayError('UNSUPPORTED_MODEL', '不支持该生成档位', 400);
    const candidates = this.catalog.bindings
      .filter((binding) => binding.logicalModelId === logical.id && binding.enabled)
      .sort((left, right) => left.priority - right.priority);
    for (const binding of candidates) {
      const model = this.catalog.providerModels.find(
        (item) => item.id === binding.providerModelId && item.enabled,
      );
      const provider = model
        ? this.catalog.providers.find(
            (item) => item.id === model.providerId && item.enabled && item.configured,
          )
        : undefined;
      if (provider && model) return { logical, provider, model, binding };
    }
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

export class AIGateway {
  private readonly router: ProviderRouter;
  constructor(
    private readonly repository: InMemoryAIRepository,
    private readonly providers: Map<string, AIProvider>,
    private readonly options: GatewayOptions,
    private readonly billing: BillingHook = new NoopBillingHook(),
  ) {
    this.router = new ProviderRouter(repository.catalog);
  }

  async generateImage(user: User, request: ImageGenerationRequest) {
    validateRequest(request);
    const existing = this.repository.findIdempotent(user.id, request.idempotencyKey);
    if (existing) return existing;
    if (!this.options.realAIEnabled)
      throw new GatewayError('REAL_AI_DISABLED', '真实 AI 当前未启用', 503);
    if (this.repository.countActive(user.id) >= this.options.maxConcurrentTasksPerUser)
      throw new GatewayError('CONCURRENCY_LIMIT', '当前已有生成任务，请稍后再试', 409);

    const route = this.router.route(request.logicalModel);
    const provider = this.providers.get(route.provider.code);
    if (!provider) throw new GatewayError('PROVIDER_UNAVAILABLE', 'Provider 未配置', 503);
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
      capability: 'image_generation',
      modelId: route.model.modelId,
      prompt: request.prompt,
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
}

function validateRequest(request: ImageGenerationRequest) {
  if (!request.idempotencyKey || request.idempotencyKey.length > 128)
    throw new GatewayError('INVALID_REQUEST', '幂等键无效', 400);
  if (!request.projectId || !request.inputAssetId || !request.prompt.trim())
    throw new GatewayError('INVALID_REQUEST', '项目、素材和提示词不能为空', 400);
  if (request.numberOfImages !== 1 || request.size !== '1024x1024')
    throw new GatewayError('INVALID_REQUEST', '当前仅允许生成一张 1024x1024 图片', 400);
  if (request.inputAssets?.some((asset) => encodedBytes(asset.dataUrl) > 5 * 1024 * 1024))
    throw new GatewayError('INVALID_REQUEST', '开发模式参考图不能超过 5 MB', 400);
}

function encodedBytes(dataUrl: string) {
  const payload = dataUrl.split(',', 2)[1] ?? '';
  return Math.floor((payload.length * 3) / 4);
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
