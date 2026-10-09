import { describe, expect, it } from 'vitest';
import { MockProvider } from './index';

describe('desktop offline MockProvider', () => {
  it('never performs a network request', async () => {
    const provider = new MockProvider();
    const result = await provider.generateImage({
      capability: 'image_edit',
      modelId: 'mock-image-v1',
      mode: 'image_edit',
      quality: 'standard',
      aspectRatio: '3:4',
      outputCount: 1,
      idempotencyKey: 'local-task',
    });
    expect(result.outputs[0]?.uri).toBe('mock://output/mock-local-task/1');
  });
});
