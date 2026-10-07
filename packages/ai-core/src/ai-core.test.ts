import { describe, expect, it, vi } from 'vitest';
import {
  AntDigitalProvider,
  MockProvider,
  NormalizedProviderError,
  ProviderRegistry,
} from './index';

describe('MockProvider', () => {
  it('runs an image generation contract without network access', async () => {
    const registry = new ProviderRegistry();
    registry.register(new MockProvider());
    const provider = registry.get('mock');
    const input = {
      capability: 'image_generation' as const,
      modelId: 'mock-image-v1',
      quality: 'standard' as const,
      aspectRatio: '3:4' as const,
      outputCount: 4,
      idempotencyKey: 'test-task',
    };
    expect((await provider.estimateCost(input)).credits).toBe(80);
    const result = await provider.generateImage(input);
    expect(result.status).toBe('succeeded');
    expect(result.outputs).toHaveLength(4);
  });
});

describe('AntDigitalProvider', () => {
  const input = {
    capability: 'image_generation' as const,
    modelId: 'qwen-image-3.0-pro',
    prompt: 'A studio product photograph',
    quality: 'standard' as const,
    aspectRatio: '1:1' as const,
    outputCount: 1,
    idempotencyKey: 'idem-1',
  };

  it('maps the OpenAI-compatible request and URL response', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ url: 'https://results.example/image.png' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json', 'x-request-id': 'provider-1' },
      }),
    );
    const provider = createProvider(fetcher);
    const result = await provider.generateImage(input);
    const [, request] = fetcher.mock.calls[0]!;
    expect(JSON.parse(String(request?.body))).toEqual({
      model: 'qwen-image-3.0-pro',
      prompt: input.prompt,
      size: '1024x1024',
      n: 1,
      prompt_extend: true,
    });
    expect(request?.headers).toMatchObject({ authorization: 'Bearer test-key' });
    expect(result).toMatchObject({
      providerTaskId: 'provider-1',
      status: 'succeeded',
      outputs: [{ uri: 'https://results.example/image.png', mediaType: 'image/png' }],
    });
  });

  it.each([
    [401, 'AUTH_FAILED', false],
    [429, 'PROVIDER_RATE_LIMITED', true],
    [500, 'PROVIDER_UNAVAILABLE', true],
    [400, 'INVALID_REQUEST', false],
  ])('normalizes status %i', async (status, code, retryable) => {
    const provider = createProvider(
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: { message: 'provider detail' } }), { status }),
        ),
    );
    await expect(provider.generateImage(input)).rejects.toMatchObject({ code, retryable });
  });

  it('does not expose the provider key in normalized errors', async () => {
    const provider = createProvider(vi.fn<typeof fetch>().mockRejectedValue(new Error('offline')));
    const error = await provider.generateImage(input).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(NormalizedProviderError);
    expect(String(error)).not.toContain('test-key');
  });
});

function createProvider(fetcher: typeof fetch) {
  return new AntDigitalProvider({
    providerId: 'antdigital',
    baseUrl: 'https://maas-api.antdigital.com/v1',
    apiKey: 'test-key',
    model: 'qwen-image-3.0-pro',
    timeoutMs: 1000,
    fetch: fetcher,
  });
}
