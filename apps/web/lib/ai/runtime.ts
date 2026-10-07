import { AntDigitalProvider, DashScopeImageEditProvider } from '@weavia/ai-core';
import { AIGateway, InMemoryAIRepository, type AICatalog } from './gateway';
import { objectStorage } from '../storage/runtime';

const providerId = '00000000-0000-4000-8000-000000000101';
const providerModelId = '00000000-0000-4000-8000-000000000102';
const logicalModelId = '00000000-0000-4000-8000-000000000103';
const dashScopeProviderId = '00000000-0000-4000-8000-000000000105';
const dashScopeModelId = '00000000-0000-4000-8000-000000000106';
const antDigitalConfigured = Boolean(process.env.ANTDIGITAL_API_KEY);
const dashScopeConfigured = Boolean(process.env.DASHSCOPE_API_KEY);
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
      configured: antDigitalConfigured,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: dashScopeProviderId,
      code: 'dashscope',
      name: 'Alibaba Cloud Model Studio',
      type: 'dashscope-multimodal',
      baseUrl: process.env.DASHSCOPE_BASE_URL ?? 'https://dashscope.aliyuncs.com/api/v1',
      enabled: realAIEnabled,
      configured: dashScopeConfigured,
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
    {
      id: dashScopeModelId,
      providerId: dashScopeProviderId,
      modelId: process.env.DASHSCOPE_IMAGE_EDIT_MODEL ?? 'qwen-image-edit-plus',
      displayName: 'Qwen Image Edit Plus',
      modality: 'image',
      capabilities: ['image_to_image', 'image_edit'],
      enabled: true,
      currency: 'CNY',
      pricingUnit: 'image',
      metadata: {
        contract: 'dashscope-multimodal',
        referenceTransport: ['url', 'base64'],
        maxReferenceImages: 3,
      },
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
    {
      id: '00000000-0000-4000-8000-000000000107',
      logicalModelId,
      providerModelId: dashScopeModelId,
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
if (antDigitalConfigured) {
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
if (dashScopeConfigured) {
  const dashScopeProvider = defaultCatalog.providers.find(
    (provider) => provider.id === dashScopeProviderId,
  )!;
  const dashScopeModel = defaultCatalog.providerModels.find(
    (model) => model.id === dashScopeModelId,
  )!;
  providers.set(
    'dashscope',
    new DashScopeImageEditProvider({
      providerId: 'dashscope',
      baseUrl: dashScopeProvider.baseUrl,
      apiKey: process.env.DASHSCOPE_API_KEY!,
      model: dashScopeModel.modelId,
      timeoutMs: Number(process.env.AI_PROVIDER_TIMEOUT_MS ?? 120_000),
    }),
  );
}

export const aiGateway = (globalAI.__weaviaAIGateway ??= new AIGateway(
  aiRepository,
  providers,
  {
    maxConcurrentTasksPerUser: Number(process.env.AI_MAX_CONCURRENT_TASKS_PER_USER ?? 1),
    maxProviderAttempts: Number(process.env.AI_MAX_PROVIDER_ATTEMPTS ?? 2),
    realAIEnabled,
  },
  undefined,
  objectStorage,
));

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
