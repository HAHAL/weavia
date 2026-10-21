import type {
  AICapability,
  AspectRatio,
  CostEstimate,
  ImageGenerationMode,
  Quality,
} from '@weavia/shared';

/** Desktop-only offline mock. Cloud providers live exclusively in services/backend. */
export interface GenerationInput {
  capability: AICapability;
  modelId: string;
  prompt?: string;
  mode: ImageGenerationMode;
  referenceImages?: Array<{ type: 'url' | 'base64'; value: string; mimeType?: string }>;
  size?: string;
  quality: Quality;
  aspectRatio: AspectRatio;
  outputCount: number;
  idempotencyKey: string;
}

export interface ProviderTaskResult {
  taskId: string;
  providerTaskId: string;
  status: 'succeeded' | 'cancelled';
  outputs: Array<{ uri: string; mediaType: string }>;
}

export class MockProvider {
  async generateImage(input: GenerationInput): Promise<ProviderTaskResult> {
    const providerTaskId = `mock-${input.idempotencyKey}`;
    return {
      taskId: input.idempotencyKey,
      providerTaskId,
      status: 'succeeded',
      outputs: Array.from({ length: input.outputCount }, (_, index) => ({
        uri: `mock://output/${providerTaskId}/${index + 1}`,
        mediaType: 'image/png',
      })),
    };
  }

  async estimateCost(input: GenerationInput): Promise<CostEstimate> {
    const multiplier = input.quality === 'high' ? 2 : input.quality === 'fast' ? 0.5 : 1;
    return { credits: Math.ceil(20 * input.outputCount * multiplier), pricingVersion: 'mock-v1' };
  }
}
