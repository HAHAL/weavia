import type { AICapability, AspectRatio, CostEstimate, Quality } from '@weavia/shared';

export type ProviderId = 'mock' | 'alibaba' | 'volcengine' | 'tencent' | 'azure' | 'aws' | 'openai' | (string & {});
export type ProviderTaskStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface ProviderConfig { id: ProviderId; enabled: boolean; region?: string; endpoint?: string; timeoutMs: number; }
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
  imageUris?: string[];
  quality: Quality;
  aspectRatio: AspectRatio;
  outputCount: number;
  idempotencyKey: string;
}
export interface ProviderTaskResult { taskId: string; providerTaskId: string; status: ProviderTaskStatus; outputs: Array<{ uri: string; mediaType: string }>; }
export interface ProviderTaskSnapshot extends ProviderTaskResult { progress?: number; error?: AIProviderError; }

export type AIProviderErrorCode = 'authentication' | 'rate_limited' | 'invalid_input' | 'content_rejected' | 'timeout' | 'unavailable' | 'unknown';
export class AIProviderError extends Error {
  constructor(public readonly code: AIProviderErrorCode, message: string, public readonly retryable: boolean, public readonly providerId?: ProviderId) {
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
    if (this.providers.has(provider.id)) throw new Error(`Provider already registered: ${provider.id}`);
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
  readonly capabilities = new Set<AICapability>(['image_generation', 'image_edit', 'image_to_video']);
  private readonly tasks = new Map<string, ProviderTaskSnapshot>();
  async getModels(): Promise<ModelDefinition[]> {
    return [{ id: 'mock-image-v1', providerId: this.id, displayName: 'WEAVIA Mock Image', capabilities: ['image_generation', 'image_edit'], supportedQualities: ['fast', 'standard', 'high'], supportedAspectRatios: ['1:1', '3:4', '4:3', '9:16', '16:9'], enabled: true }];
  }
  async generateImage(input: GenerationInput): Promise<ProviderTaskResult> { return this.createCompletedTask(input, 'image/png'); }
  async generateVideo(input: GenerationInput): Promise<ProviderTaskResult> { return this.createCompletedTask(input, 'video/mp4'); }
  async getTaskStatus(providerTaskId: string): Promise<ProviderTaskSnapshot> {
    const task = this.tasks.get(providerTaskId);
    if (!task) throw new AIProviderError('invalid_input', 'Mock task not found', false, this.id);
    return task;
  }
  async cancelTask(providerTaskId: string): Promise<void> {
    const task = await this.getTaskStatus(providerTaskId);
    this.tasks.set(providerTaskId, { ...task, status: 'cancelled', ...(task.status === 'succeeded' ? { progress: 100 } : {}) });
  }
  async estimateCost(input: GenerationInput): Promise<CostEstimate> {
    const multiplier = input.quality === 'high' ? 2 : input.quality === 'fast' ? 0.5 : 1;
    return { credits: Math.ceil(20 * input.outputCount * multiplier), pricingVersion: 'mock-v1' };
  }
  private async createCompletedTask(input: GenerationInput, mediaType: string): Promise<ProviderTaskResult> {
    const providerTaskId = `mock-${input.idempotencyKey}`;
    const result: ProviderTaskSnapshot = { taskId: input.idempotencyKey, providerTaskId, status: 'succeeded', progress: 100, outputs: Array.from({ length: input.outputCount }, (_, index) => ({ uri: `mock://output/${providerTaskId}/${index + 1}`, mediaType })) };
    this.tasks.set(providerTaskId, result);
    return result;
  }
}
