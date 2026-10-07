import { AntDigitalProvider } from '@weavia/ai-core';
import { AIGateway, InMemoryAIRepository, type AICatalog } from './gateway';

const providerId = '00000000-0000-4000-8000-000000000101';
const providerModelId = '00000000-0000-4000-8000-000000000102';
const logicalModelId = '00000000-0000-4000-8000-000000000103';
const configured = Boolean(process.env.ANTDIGITAL_API_KEY);
const realAIEnabled = process.env.ENABLE_REAL_AI === 'true';
const timestamp = new Date(0).toISOString();

export const defaultCatalog: AICatalog = {
  providers: [
    {
      id: providerId,
      code: 'antdigital',
      name: 'Ant Digital MaaS',
      type: 'openai-compatible',
      baseUrl: process.env.ANTDIGITAL_BASE_URL ?? 'https://maas-api.antdigital.com/v1',
      enabled: realAIEnabled,
      configured,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ],
  providerModels: [
    {
      id: providerModelId,
      providerId,
      modelId: process.env.ANTDIGITAL_IMAGE_MODEL ?? 'qwen-image-max',
      displayName: 'Qwen Image Max',
      modality: 'image',
      capabilities: ['text_to_image'],
      enabled: true,
      currency: 'CNY',
      pricingUnit: 'image',
      metadata: { contract: 'openai-compatible', promptExtend: true },
    },
  ],
  logicalModels: [
    {
      id: logicalModelId,
      key: 'weavia-image-pro',
      displayName: 'WEAVIA 专业',
      type: 'image',
      enabled: true,
    },
  ],
  bindings: [
    {
      id: '00000000-0000-4000-8000-000000000104',
      logicalModelId,
      providerModelId,
      priority: 1,
      enabled: true,
    },
  ],
};

const globalAI = globalThis as typeof globalThis & {
  __weaviaAIRepository?: InMemoryAIRepository;
  __weaviaAIGateway?: AIGateway;
};

export const aiRepository = (globalAI.__weaviaAIRepository ??= new InMemoryAIRepository(
  defaultCatalog,
));

const providers = new Map();
if (configured) {
  providers.set(
    'antdigital',
    new AntDigitalProvider({
      providerId: 'antdigital',
      baseUrl: defaultCatalog.providers[0]!.baseUrl,
      apiKey: process.env.ANTDIGITAL_API_KEY!,
      model: defaultCatalog.providerModels[0]!.modelId,
      timeoutMs: Number(process.env.AI_PROVIDER_TIMEOUT_MS ?? 120_000),
    }),
  );
}

export const aiGateway = (globalAI.__weaviaAIGateway ??= new AIGateway(aiRepository, providers, {
  maxConcurrentTasksPerUser: Number(process.env.AI_MAX_CONCURRENT_TASKS_PER_USER ?? 1),
  maxProviderAttempts: Number(process.env.AI_MAX_PROVIDER_ATTEMPTS ?? 2),
  realAIEnabled,
}));

export function sanitizedAdminSnapshot() {
  const usage = aiRepository.listUsage();
  return {
    providers: aiRepository.catalog.providers.map((provider) => {
      const providerUsage = usage.filter((item) => item.providerId === provider.id);
      const successes = providerUsage.filter((item) => item.status === 'success').length;
      const failures = providerUsage.length - successes;
      return {
        ...provider,
        modelCount: aiRepository.catalog.providerModels.filter(
          (model) => model.providerId === provider.id,
        ).length,
        calls: providerUsage.length,
        successes,
        failures,
        successRate: providerUsage.length ? successes / providerUsage.length : 0,
        failureRate: providerUsage.length ? failures / providerUsage.length : 0,
        averageLatencyMs: providerUsage.length
          ? Math.round(
              providerUsage.reduce((total, item) => total + item.latencyMs, 0) /
                providerUsage.length,
            )
          : 0,
      };
    }),
    models: aiRepository.catalog.providerModels,
    logicalModels: aiRepository.catalog.logicalModels,
    bindings: aiRepository.catalog.bindings,
    usage,
    estimatedCost: usage.reduce((total, item) => total + (item.estimatedCost ?? 0), 0),
  };
}
