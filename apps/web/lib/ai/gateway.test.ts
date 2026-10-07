import { describe, expect, it, vi } from 'vitest';
import type {
  AIProvider,
  GenerationInput,
  ProviderTaskResult,
  ProviderTaskSnapshot,
} from '@weavia/ai-core';
import { NormalizedProviderError } from '@weavia/ai-core';
import type { ImageGenerationRequest, User } from '@weavia/shared';
import {
  AIGateway,
  GatewayError,
  InMemoryAIRepository,
  NoopBillingHook,
  ProviderRouter,
  type AICatalog,
  type BillingHook,
} from './gateway';

const user: User = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'demo@weavia.local',
  name: 'WEAVIA Demo',
  status: 'active',
};
const request: ImageGenerationRequest = {
  idempotencyKey: 'idem-1',
  projectId: 'project-1',
  inputAssetId: 'asset-1',
  workflow: 'ai_commercial',
  logicalModel: 'weavia-image-pro',
  prompt: 'Studio product photo',
  size: '1024x1024',
  quality: 'standard',
  numberOfImages: 1,
  outputFormat: 'png',
};

describe('AI Gateway', () => {
  it('routes a logical model without accepting a client provider choice', () => {
    const route = new ProviderRouter(catalog()).route('weavia-image-pro');
    expect(route.provider.code).toBe('antdigital');
    expect(route.model.modelId).toBe('qwen-image-max');
  });

  it.each(['provider', 'model', 'binding'] as const)(
    'does not route when %s is disabled',
    (target) => {
      const value = catalog();
      if (target === 'provider') value.providers[0]!.enabled = false;
      if (target === 'model') value.providerModels[0]!.enabled = false;
      if (target === 'binding') value.bindings[0]!.enabled = false;
      expect(() => new ProviderRouter(value).route('weavia-image-pro')).toThrowError(GatewayError);
    },
  );

  it('rejects unknown logical models', async () => {
    const gateway = createGateway(new SuccessfulProvider()).gateway;
    await expect(
      gateway.generateImage(user, { ...request, logicalModel: 'arbitrary-expensive-model' }),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_MODEL' });
  });

  it('returns the same task for an idempotent retry and calls provider once', async () => {
    const provider = new SuccessfulProvider();
    const { gateway } = createGateway(provider);
    const first = await gateway.generateImage(user, request);
    const second = await gateway.generateImage(user, request);
    expect(second.id).toBe(first.id);
    expect(provider.calls).toBe(1);
  });

  it('enforces one active task per user', async () => {
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => (release = resolve));
    const provider = new SuccessfulProvider(waiting);
    const { gateway } = createGateway(provider);
    const first = gateway.generateImage(user, request);
    await vi.waitFor(() => expect(provider.calls).toBe(1));
    await expect(
      gateway.generateImage(user, { ...request, idempotencyKey: 'idem-2' }),
    ).rejects.toMatchObject({ code: 'CONCURRENCY_LIMIT' });
    release();
    await first;
  });

  it('retries retryable 5xx only up to the configured limit', async () => {
    const provider = new FailingProvider(
      new NormalizedProviderError('PROVIDER_UNAVAILABLE', 'offline', true, 503),
    );
    const { gateway, repository } = createGateway(provider);
    await expect(gateway.generateImage(user, request)).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
    });
    expect(provider.calls).toBe(2);
    expect(repository.listUsage()).toHaveLength(2);
  });

  it('does not retry invalid requests', async () => {
    const provider = new FailingProvider(
      new NormalizedProviderError('INVALID_REQUEST', 'bad input', false, 400),
    );
    const { gateway } = createGateway(provider);
    await expect(gateway.generateImage(user, request)).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
    });
    expect(provider.calls).toBe(1);
  });

  it('records success usage and configured estimated cost without actual cost', async () => {
    const { gateway, repository } = createGateway(new SuccessfulProvider());
    await gateway.generateImage(user, request);
    expect(repository.listUsage()[0]).toMatchObject({ status: 'success', estimatedCost: 0.25 });
    expect(repository.listUsage()[0]).not.toHaveProperty('actualCost');
  });

  it('executes the billing hook lifecycle without charging credits', async () => {
    const billing: BillingHook = {
      beforeTask: vi.fn(),
      onProviderAccepted: vi.fn(),
      onSuccess: vi.fn(),
      onFailure: vi.fn(),
    };
    const { gateway } = createGateway(new SuccessfulProvider(), billing);
    await gateway.generateImage(user, request);
    expect(billing.beforeTask).toHaveBeenCalledOnce();
    expect(billing.onProviderAccepted).toHaveBeenCalledOnce();
    expect(billing.onSuccess).toHaveBeenCalledOnce();
    expect(billing.onFailure).not.toHaveBeenCalled();
    expect(new NoopBillingHook()).toBeInstanceOf(NoopBillingHook);
  });

  it('never runs a provider while the real-AI switch is disabled', async () => {
    const provider = new SuccessfulProvider();
    const repository = new InMemoryAIRepository(catalog());
    const gateway = new AIGateway(repository, new Map([['antdigital', provider]]), {
      maxConcurrentTasksPerUser: 1,
      maxProviderAttempts: 2,
      realAIEnabled: false,
    });
    await expect(gateway.generateImage(user, request)).rejects.toMatchObject({
      code: 'REAL_AI_DISABLED',
    });
    expect(provider.calls).toBe(0);
  });
});

function createGateway(provider: AIProvider, billing: BillingHook = new NoopBillingHook()) {
  const repository = new InMemoryAIRepository(catalog());
  const gateway = new AIGateway(
    repository,
    new Map([['antdigital', provider]]),
    { maxConcurrentTasksPerUser: 1, maxProviderAttempts: 2, realAIEnabled: true },
    billing,
  );
  return { repository, gateway };
}

function catalog(): AICatalog {
  return {
    providers: [
      {
        id: 'provider-1',
        code: 'antdigital',
        name: 'Ant Digital MaaS',
        type: 'openai-compatible',
        baseUrl: 'https://maas-api.antdigital.com/v1',
        enabled: true,
        configured: true,
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      },
    ],
    providerModels: [
      {
        id: 'model-1',
        providerId: 'provider-1',
        modelId: 'qwen-image-max',
        displayName: 'Qwen Image Max',
        modality: 'image',
        capabilities: ['text_to_image'],
        enabled: true,
        outputCost: 0.25,
        currency: 'CNY',
        pricingUnit: 'image',
        metadata: {},
      },
    ],
    logicalModels: [
      {
        id: 'logical-1',
        key: 'weavia-image-pro',
        displayName: 'WEAVIA 专业',
        type: 'image',
        enabled: true,
      },
    ],
    bindings: [
      {
        id: 'binding-1',
        logicalModelId: 'logical-1',
        providerModelId: 'model-1',
        priority: 1,
        enabled: true,
      },
    ],
  };
}

class SuccessfulProvider implements AIProvider {
  readonly id = 'antdigital';
  readonly capabilities = new Set(['image_generation'] as const);
  calls = 0;
  constructor(private readonly waiting?: Promise<void>) {}
  async generateImage(input: GenerationInput): Promise<ProviderTaskResult> {
    this.calls += 1;
    await this.waiting;
    return {
      taskId: input.idempotencyKey,
      providerTaskId: 'provider-request-1',
      status: 'succeeded',
      outputs: [{ uri: 'https://results.example/image.png', mediaType: 'image/png' }],
    };
  }
  async generateVideo(): Promise<ProviderTaskResult> {
    throw new Error('not implemented');
  }
  async getTaskStatus(): Promise<ProviderTaskSnapshot> {
    throw new Error('not implemented');
  }
  async cancelTask() {}
  async estimateCost() {
    return { credits: 1, pricingVersion: 'test' };
  }
  async getModels() {
    return [];
  }
}

class FailingProvider extends SuccessfulProvider {
  constructor(private readonly failure: Error) {
    super();
  }
  override async generateImage(): Promise<ProviderTaskResult> {
    this.calls += 1;
    throw this.failure;
  }
}
