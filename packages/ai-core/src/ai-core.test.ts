import { describe, expect, it } from 'vitest';
import { MockProvider, ProviderRegistry } from './index';

describe('MockProvider', () => {
  it('runs an image generation contract without network access', async () => {
    const registry = new ProviderRegistry();
    registry.register(new MockProvider());
    const provider = registry.get('mock');
    const input = { capability: 'image_generation' as const, modelId: 'mock-image-v1', quality: 'standard' as const, aspectRatio: '3:4' as const, outputCount: 4, idempotencyKey: 'test-task' };
    expect((await provider.estimateCost(input)).credits).toBe(80);
    const result = await provider.generateImage(input);
    expect(result.status).toBe('succeeded');
    expect(result.outputs).toHaveLength(4);
  });
});
