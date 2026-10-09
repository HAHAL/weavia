import type {
  AICapability,
  AspectRatio,
  CostEstimate,
  ImageGenerationMode,
  Quality,
} from '@weavia/shared';

export type ProviderId =
  | 'mock'
  | 'dashscope'
  | 'alibaba'
  | 'volcengine'
  | 'tencent'
  | 'azure'
  | 'aws'
  | 'openai'
  | (string & {});
export type ProviderTaskStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface ProviderConfig {
  id: ProviderId;
  enabled: boolean;
  region?: string;
  endpoint?: string;
  timeoutMs: number;
}
export interface ModelDefinition {
  id: string;
  providerId: ProviderId;
  displayName: string;
  capabilities: AICapability[];
  supportedQualities: Quality[];
  supportedAspectRatios: AspectRatio[];
  enabled: boolean;
}
export interface GenerationInput {
  capability: AICapability;
  modelId: string;
  prompt?: string;
  mode: ImageGenerationMode;
  referenceImages?: ReferenceImageInput[];
  size?: string;
  quality: Quality;
  aspectRatio: AspectRatio;
  outputCount: number;
  idempotencyKey: string;
}

export interface ReferenceImageInput {
  type: 'url' | 'base64';
  value: string;
  mimeType?: string;
}
export interface ProviderTaskResult {
  taskId: string;
  providerTaskId: string;
  status: ProviderTaskStatus;
  outputs: Array<{ uri: string; mediaType: string }>;
}
export interface ProviderTaskSnapshot extends ProviderTaskResult {
  progress?: number;
  error?: AIProviderError;
}

export type AIProviderErrorCode =
  | 'authentication'
  | 'rate_limited'
  | 'invalid_input'
  | 'content_rejected'
  | 'timeout'
  | 'unavailable'
  | 'unknown';
export class AIProviderError extends Error {
  constructor(
    public readonly code: AIProviderErrorCode,
    message: string,
    public readonly retryable: boolean,
    public readonly providerId?: ProviderId,
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}

export interface AIProvider {
  readonly id: ProviderId;
  readonly capabilities: ReadonlySet<AICapability>;
  getModels(): Promise<ModelDefinition[]>;
  generateImage(input: GenerationInput): Promise<ProviderTaskResult>;
  generateVideo(input: GenerationInput): Promise<ProviderTaskResult>;
  getTaskStatus(providerTaskId: string): Promise<ProviderTaskSnapshot>;
  cancelTask(providerTaskId: string): Promise<void>;
  estimateCost(input: GenerationInput): Promise<CostEstimate>;
}

export class ProviderRegistry {
  private readonly providers = new Map<ProviderId, AIProvider>();
  register(provider: AIProvider): void {
    if (this.providers.has(provider.id))
      throw new Error(`Provider already registered: ${provider.id}`);
    this.providers.set(provider.id, provider);
  }
  get(id: ProviderId): AIProvider {
    const provider = this.providers.get(id);
    if (!provider) throw new Error(`Unknown provider: ${id}`);
    return provider;
  }
  findByCapability(capability: AICapability): AIProvider[] {
    return [...this.providers.values()].filter((provider) => provider.capabilities.has(capability));
  }
}

export class MockProvider implements AIProvider {
  readonly id = 'mock';
  readonly capabilities = new Set<AICapability>([
    'image_generation',
    'image_to_image',
    'image_edit',
    'image_to_video',
  ]);
  private readonly tasks = new Map<string, ProviderTaskSnapshot>();
  async getModels(): Promise<ModelDefinition[]> {
    return [
      {
        id: 'mock-image-v1',
        providerId: this.id,
        displayName: 'WEAVIA Mock Image',
        capabilities: ['image_generation', 'image_edit'],
        supportedQualities: ['fast', 'standard', 'high'],
        supportedAspectRatios: ['1:1', '3:4', '4:3', '9:16', '16:9'],
        enabled: true,
      },
    ];
  }
  async generateImage(input: GenerationInput): Promise<ProviderTaskResult> {
    return this.createCompletedTask(input, 'image/png');
  }
  async generateVideo(input: GenerationInput): Promise<ProviderTaskResult> {
    return this.createCompletedTask(input, 'video/mp4');
  }
  async getTaskStatus(providerTaskId: string): Promise<ProviderTaskSnapshot> {
    const task = this.tasks.get(providerTaskId);
    if (!task) throw new AIProviderError('invalid_input', 'Mock task not found', false, this.id);
    return task;
  }
  async cancelTask(providerTaskId: string): Promise<void> {
    const task = await this.getTaskStatus(providerTaskId);
    this.tasks.set(providerTaskId, {
      ...task,
      status: 'cancelled',
      ...(task.status === 'succeeded' ? { progress: 100 } : {}),
    });
  }
  async estimateCost(input: GenerationInput): Promise<CostEstimate> {
    const multiplier = input.quality === 'high' ? 2 : input.quality === 'fast' ? 0.5 : 1;
    return { credits: Math.ceil(20 * input.outputCount * multiplier), pricingVersion: 'mock-v1' };
  }
  private async createCompletedTask(
    input: GenerationInput,
    mediaType: string,
  ): Promise<ProviderTaskResult> {
    const providerTaskId = `mock-${input.idempotencyKey}`;
    const result: ProviderTaskSnapshot = {
      taskId: input.idempotencyKey,
      providerTaskId,
      status: 'succeeded',
      progress: 100,
      outputs: Array.from({ length: input.outputCount }, (_, index) => ({
        uri: `mock://output/${providerTaskId}/${index + 1}`,
        mediaType,
      })),
    };
    this.tasks.set(providerTaskId, result);
    return result;
  }
}

export type NormalizedProviderErrorCode =
  | 'AUTH_FAILED'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_RATE_LIMITED'
  | 'INVALID_REQUEST'
  | 'UNSUPPORTED_MODEL'
  | 'UNSUPPORTED_CAPABILITY'
  | 'CONTENT_REJECTED'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'GENERATION_FAILED'
  | 'UNKNOWN';

export class NormalizedProviderError extends Error {
  constructor(
    public readonly code: NormalizedProviderErrorCode,
    message: string,
    public readonly retryable: boolean,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'NormalizedProviderError';
  }
}

export interface OpenAICompatibleImageConfig {
  providerId: ProviderId;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  fetch?: typeof fetch;
}

interface OpenAIImageResponse {
  id?: string;
  request_id?: string;
  created?: number;
  data?: Array<{ url?: string; b64_json?: string; revised_prompt?: string }>;
  usage?: Record<string, number>;
  error?: { code?: string; message?: string; type?: string } | string;
}

export interface CompatibleImageResult {
  provider: ProviderId;
  model: string;
  providerRequestId?: string;
  status: 'succeeded';
  outputs: Array<{ uri: string; mediaType: string }>;
  usage?: Record<string, number>;
  latencyMs: number;
}

export class OpenAICompatibleImageProvider {
  private readonly fetcher: typeof fetch;
  constructor(protected readonly config: OpenAICompatibleImageConfig) {
    this.fetcher = config.fetch ?? fetch;
  }

  async requestImage(input: {
    model: string;
    prompt: string;
    size: string;
    n: 1;
    promptExtend: boolean;
    referenceImage?: ReferenceImageInput;
  }): Promise<CompatibleImageResult> {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.fetcher(
        new URL('images/generations', ensureTrailingSlash(this.config.baseUrl)),
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${this.config.apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: input.model,
            prompt: input.prompt,
            size: input.size,
            n: input.n,
            prompt_extend: input.promptExtend,
            ...(input.referenceImage ? { image: input.referenceImage.value } : {}),
          }),
          signal: controller.signal,
        },
      );
      const body = (await readJson(response)) as OpenAIImageResponse;
      if (!response.ok) throw mapHttpError(response.status, body);
      const outputs = (body.data ?? []).flatMap((item) => {
        if (item.url) return [{ uri: item.url, mediaType: 'image/png' }];
        if (item.b64_json)
          return [{ uri: `data:image/png;base64,${item.b64_json}`, mediaType: 'image/png' }];
        return [];
      });
      if (outputs.length === 0)
        throw new NormalizedProviderError(
          'GENERATION_FAILED',
          'Provider response did not contain an image',
          false,
        );
      const providerRequestId =
        response.headers.get('x-request-id') ?? body.request_id ?? body.id ?? undefined;
      return {
        provider: this.config.providerId,
        model: input.model,
        ...(providerRequestId ? { providerRequestId } : {}),
        status: 'succeeded',
        outputs,
        ...(body.usage ? { usage: body.usage } : {}),
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      if (error instanceof NormalizedProviderError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError')
        throw new NormalizedProviderError('TIMEOUT', 'Provider request timed out', true);
      throw new NormalizedProviderError('NETWORK_ERROR', 'Unable to reach image provider', true);
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class AntDigitalProvider extends OpenAICompatibleImageProvider implements AIProvider {
  readonly id = 'antdigital';
  readonly capabilities = new Set<AICapability>(['image_generation', 'image_to_image']);

  async getModels(): Promise<ModelDefinition[]> {
    return [
      {
        id: this.config.model,
        providerId: this.id,
        displayName: 'Qwen Image Max',
        capabilities: ['image_generation'],
        supportedQualities: ['standard'],
        supportedAspectRatios: ['1:1'],
        enabled: true,
      },
    ];
  }

  async generateImage(input: GenerationInput): Promise<ProviderTaskResult> {
    const hasReference = (input.referenceImages?.length ?? 0) > 0;
    if (input.mode === 'image_edit' || (input.mode === 'image_to_image' && !hasReference))
      throw new NormalizedProviderError(
        'UNSUPPORTED_CAPABILITY',
        '当前 Ant Digital 模型不支持所选参考图能力',
        false,
        400,
      );
    if (hasReference && input.modelId !== 'qwen-image-2.0')
      throw new NormalizedProviderError(
        'UNSUPPORTED_CAPABILITY',
        '当前仅 qwen-image-2.0 开放参考图生成',
        false,
        400,
      );
    if ((input.referenceImages?.length ?? 0) > 1)
      throw new NormalizedProviderError(
        'INVALID_REQUEST',
        'qwen-image-2.0 当前仅支持单张商品参考图',
        false,
        400,
      );
    if (!input.prompt?.trim())
      throw new NormalizedProviderError('INVALID_REQUEST', 'Prompt is required', false, 400);
    const result = await this.requestImage({
      model: input.modelId,
      prompt: input.prompt,
      size: sizeForAspectRatio(input.aspectRatio),
      n: 1,
      promptExtend: true,
      ...(input.referenceImages?.[0] ? { referenceImage: input.referenceImages[0] } : {}),
    });
    const providerTaskId = result.providerRequestId ?? `antdigital-${input.idempotencyKey}`;
    return {
      taskId: input.idempotencyKey,
      providerTaskId,
      status: 'succeeded',
      outputs: result.outputs,
    };
  }

  async generateVideo(): Promise<ProviderTaskResult> {
    throw new NormalizedProviderError('UNSUPPORTED_MODEL', 'Video is not supported', false, 400);
  }

  async getTaskStatus(): Promise<ProviderTaskSnapshot> {
    throw new NormalizedProviderError(
      'INVALID_REQUEST',
      'Ant Digital image generation is synchronous',
      false,
      400,
    );
  }

  async cancelTask(): Promise<void> {
    throw new NormalizedProviderError(
      'INVALID_REQUEST',
      'Completed synchronous generations cannot be cancelled',
      false,
      400,
    );
  }

  async estimateCost(input: GenerationInput): Promise<CostEstimate> {
    return { credits: input.outputCount, pricingVersion: 'antdigital-configured-v1' };
  }
}

export interface DashScopeImageEditConfig {
  providerId?: ProviderId;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  fetch?: typeof fetch;
}

interface DashScopeImageEditResponse {
  output?: {
    choices?: Array<{
      message?: { content?: Array<{ image?: string }> };
    }>;
  };
  usage?: { image_count?: number; width?: number; height?: number };
  request_id?: string;
  code?: string;
  message?: string;
}

/** Alibaba Cloud Model Studio Qwen Image Edit HTTP adapter. */
export class DashScopeImageEditProvider implements AIProvider {
  readonly id: ProviderId;
  readonly capabilities = new Set<AICapability>(['image_to_image', 'image_edit']);
  private readonly fetcher: typeof fetch;

  constructor(private readonly config: DashScopeImageEditConfig) {
    this.id = config.providerId ?? 'dashscope';
    this.fetcher = config.fetch ?? fetch;
  }

  async getModels(): Promise<ModelDefinition[]> {
    return [
      {
        id: this.config.model,
        providerId: this.id,
        displayName: 'Qwen Image Edit',
        capabilities: ['image_to_image', 'image_edit'],
        supportedQualities: ['standard', 'high'],
        supportedAspectRatios: ['1:1', '3:4', '4:3', '9:16', '16:9'],
        enabled: true,
      },
    ];
  }

  async generateImage(input: GenerationInput): Promise<ProviderTaskResult> {
    if (input.mode !== 'image_edit' && input.mode !== 'image_to_image')
      throw new NormalizedProviderError(
        'UNSUPPORTED_CAPABILITY',
        'DashScope image edit requires a reference image mode',
        false,
        400,
      );
    if (!input.prompt?.trim())
      throw new NormalizedProviderError('INVALID_REQUEST', 'Prompt is required', false, 400);
    if (!input.referenceImages?.length)
      throw new NormalizedProviderError(
        'INVALID_REQUEST',
        'At least one reference image is required',
        false,
        400,
      );
    if (input.referenceImages.length > 3)
      throw new NormalizedProviderError(
        'INVALID_REQUEST',
        'DashScope supports at most three reference images',
        false,
        400,
      );

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.fetcher(
        new URL(
          'services/aigc/multimodal-generation/generation',
          ensureTrailingSlash(this.config.baseUrl),
        ),
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${this.config.apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: this.config.model,
            input: {
              messages: [
                {
                  role: 'user',
                  content: [
                    ...input.referenceImages.map((image) => ({
                      image:
                        image.type === 'base64' && !image.value.startsWith('data:')
                          ? `data:${image.mimeType ?? 'image/png'};base64,${image.value}`
                          : image.value,
                    })),
                    { text: input.prompt },
                  ],
                },
              ],
            },
            parameters: {
              n: 1,
              prompt_extend: true,
              watermark: false,
              size: normalizeDashScopeSize(input.size ?? sizeForAspectRatio(input.aspectRatio)),
            },
          }),
          signal: controller.signal,
        },
      );
      const body = (await readJson(response)) as DashScopeImageEditResponse;
      if (!response.ok || body.code) throw mapDashScopeError(response.status, body);
      const outputs = (body.output?.choices ?? []).flatMap((choice) =>
        (choice.message?.content ?? []).flatMap((content) =>
          content.image ? [{ uri: content.image, mediaType: 'image/png' }] : [],
        ),
      );
      if (!outputs.length)
        throw new NormalizedProviderError(
          'GENERATION_FAILED',
          'Provider response did not contain an image',
          false,
        );
      const providerTaskId =
        response.headers.get('x-request-id') ??
        body.request_id ??
        `dashscope-${input.idempotencyKey}`;
      return {
        taskId: input.idempotencyKey,
        providerTaskId,
        status: 'succeeded',
        outputs,
      };
    } catch (error) {
      if (error instanceof NormalizedProviderError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError')
        throw new NormalizedProviderError('TIMEOUT', 'Provider request timed out', true);
      throw new NormalizedProviderError('NETWORK_ERROR', 'Unable to reach image provider', true);
    } finally {
      clearTimeout(timeout);
    }
  }

  async generateVideo(): Promise<ProviderTaskResult> {
    throw new NormalizedProviderError('UNSUPPORTED_MODEL', 'Video is not supported', false, 400);
  }
  async getTaskStatus(): Promise<ProviderTaskSnapshot> {
    throw new NormalizedProviderError(
      'INVALID_REQUEST',
      'DashScope Qwen Image Edit is synchronous',
      false,
      400,
    );
  }
  async cancelTask(): Promise<void> {
    throw new NormalizedProviderError(
      'INVALID_REQUEST',
      'Completed synchronous generations cannot be cancelled',
      false,
      400,
    );
  }
  async estimateCost(input: GenerationInput): Promise<CostEstimate> {
    return { credits: input.outputCount, pricingVersion: 'dashscope-configured-v1' };
  }
}

function ensureTrailingSlash(value: string) {
  return value.endsWith('/') ? value : `${value}/`;
}

function sizeForAspectRatio(aspectRatio: AspectRatio) {
  return aspectRatio === '1:1' ? '1024x1024' : '1024x1024';
}

function normalizeDashScopeSize(size: string) {
  return size.replace('x', '*');
}

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function mapHttpError(status: number, body: OpenAIImageResponse) {
  const providerMessage =
    typeof body.error === 'string'
      ? body.error
      : (body.error?.message ?? `Provider error ${status}`);
  const providerCode = typeof body.error === 'object' ? (body.error?.code ?? body.error?.type) : '';
  if (status === 401 || status === 403)
    return new NormalizedProviderError(
      'AUTH_FAILED',
      'Provider authentication failed',
      false,
      status,
    );
  if (status === 429)
    return new NormalizedProviderError(
      'PROVIDER_RATE_LIMITED',
      'Provider rate limit reached',
      true,
      status,
    );
  if (status === 400 || status === 422) {
    const code = providerCode?.toLowerCase().includes('model')
      ? 'UNSUPPORTED_MODEL'
      : providerCode?.toLowerCase().includes('content')
        ? 'CONTENT_REJECTED'
        : 'INVALID_REQUEST';
    return new NormalizedProviderError(code, providerMessage, false, status);
  }
  if (status >= 500)
    return new NormalizedProviderError(
      'PROVIDER_UNAVAILABLE',
      'Image provider is temporarily unavailable',
      true,
      status,
    );
  return new NormalizedProviderError('UNKNOWN', providerMessage, false, status);
}

function mapDashScopeError(status: number, body: DashScopeImageEditResponse) {
  const errorStatus = status >= 400 ? status : 400;
  const code = body.code?.toLowerCase() ?? '';
  if (status === 401 || status === 403 || code.includes('apikey'))
    return new NormalizedProviderError(
      'AUTH_FAILED',
      'Provider authentication failed',
      false,
      status === 401 || status === 403 ? status : 401,
    );
  if (status === 429 || code.includes('throttl') || code.includes('ratelimit'))
    return new NormalizedProviderError(
      'PROVIDER_RATE_LIMITED',
      'Provider rate limit reached',
      true,
      status === 429 ? status : 429,
    );
  if (status >= 500)
    return new NormalizedProviderError(
      'PROVIDER_UNAVAILABLE',
      'Image provider is temporarily unavailable',
      true,
      status,
    );
  const mappedCode = code.includes('model')
    ? 'UNSUPPORTED_MODEL'
    : code.includes('content') || code.includes('datainspection')
      ? 'CONTENT_REJECTED'
      : 'INVALID_REQUEST';
  return new NormalizedProviderError(
    mappedCode,
    body.message ?? `Provider error ${status}`,
    false,
    errorStatus,
  );
}
