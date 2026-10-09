import { describe, expect, it, vi } from 'vitest';
import {
  AntDigitalProvider,
  DashScopeImageEditProvider,
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
      mode: 'text_to_image' as const,
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
    mode: 'text_to_image' as const,
    modelId: 'qwen-image-max',
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
      model: 'qwen-image-max',
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

  it('rejects reference images before making an unverified provider request', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const provider = createProvider(fetcher);
    await expect(
      provider.generateImage({
        ...input,
        mode: 'image_edit',
        capability: 'image_to_image',
        referenceImages: [
          { type: 'url', value: 'https://storage.example/reference.png', mimeType: 'image/png' },
        ],
      }),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_CAPABILITY', retryable: false });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('maps a qwen-image-2.0 reference image request', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ url: 'https://results.example/reference.png' }] }), {
        status: 200,
      }),
    );
    const provider = createProvider(fetcher);
    await provider.generateImage({
      ...input,
      modelId: 'qwen-image-2.0',
      mode: 'image_to_image',
      capability: 'image_to_image',
      referenceImages: [
        { type: 'base64', value: 'data:image/png;base64,AQID', mimeType: 'image/png' },
      ],
    });
    expect(JSON.parse(String(fetcher.mock.calls[0]![1]?.body))).toMatchObject({
      model: 'qwen-image-2.0',
      image: 'data:image/png;base64,AQID',
      n: 1,
    });
  });
});

describe('DashScopeImageEditProvider', () => {
  const input = {
    capability: 'image_edit' as const,
    mode: 'image_edit' as const,
    modelId: 'qwen-image-edit-plus',
    prompt: 'Place the product in a premium studio scene',
    referenceImages: [
      { type: 'base64' as const, value: 'data:image/png;base64,AQID', mimeType: 'image/png' },
    ],
    size: '1024x1024',
    quality: 'standard' as const,
    aspectRatio: '1:1' as const,
    outputCount: 1,
    idempotencyKey: 'edit-1',
  };

  it('maps the official multimodal image edit request and response', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          output: {
            choices: [
              { message: { content: [{ image: 'https://results.example/edited.png' }] } },
            ],
          },
          usage: { image_count: 1, width: 1024, height: 1024 },
          request_id: 'dashscope-request-1',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const provider = createDashScopeProvider(fetcher);
    const result = await provider.generateImage(input);
    const [url, request] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe(
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
    );
    expect(JSON.parse(String(request?.body))).toEqual({
      model: 'qwen-image-edit-plus',
      input: {
        messages: [
          {
            role: 'user',
            content: [
              { image: 'data:image/png;base64,AQID' },
              { text: 'Place the product in a premium studio scene' },
            ],
          },
        ],
      },
      parameters: { n: 1, prompt_extend: true, watermark: false, size: '1024*1024' },
    });
    expect(result).toMatchObject({
      providerTaskId: 'dashscope-request-1',
      status: 'succeeded',
      outputs: [{ uri: 'https://results.example/edited.png', mediaType: 'image/png' }],
    });
  });

  it('rejects requests without a reference before network access', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const provider = createDashScopeProvider(fetcher);
    await expect(
      provider.generateImage({ ...input, referenceImages: [] }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST', retryable: false });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('normalizes authentication errors without exposing credentials', async () => {
    const provider = createDashScopeProvider(
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ code: 'InvalidApiKey', message: 'Invalid API-key' }), {
          status: 401,
        }),
      ),
    );
    const error = await provider.generateImage(input).catch((value: unknown) => value);
    expect(error).toMatchObject({ code: 'AUTH_FAILED', retryable: false });
    expect(String(error)).not.toContain('dashscope-test-key');
  });
});

function createProvider(fetcher: typeof fetch) {
  return new AntDigitalProvider({
    providerId: 'antdigital',
    baseUrl: 'https://maas-api.antdigital.com/v1',
    apiKey: 'test-key',
    model: 'qwen-image-max',
    timeoutMs: 1000,
    fetch: fetcher,
  });
}

function createDashScopeProvider(fetcher: typeof fetch) {
  return new DashScopeImageEditProvider({
    baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
    apiKey: 'dashscope-test-key',
    model: 'qwen-image-edit-plus',
    timeoutMs: 1000,
    fetch: fetcher,
  });
}
