import { AntDigitalProvider, DashScopeImageEditProvider } from '@weavia/ai-core';
import { AIGateway, GatewayError, InMemoryAIRepository, type AICatalog } from './gateway';
import { objectStorage } from '../storage/runtime';
import type {
  AIEstimateRequest,
  AIEstimateResult,
  AIModelCatalogResult,
  PromptTemplate,
  User,
} from '@weavia/shared';

const providerId = '00000000-0000-4000-8000-000000000101';
const providerModelId = '00000000-0000-4000-8000-000000000102';
const logicalModelId = '00000000-0000-4000-8000-000000000103';
const dashScopeProviderId = '00000000-0000-4000-8000-000000000105';
const dashScopeModelId = '00000000-0000-4000-8000-000000000106';
const antDigitalReferenceModelId = '00000000-0000-4000-8000-000000000108';
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
      modelId: 'qwen-image-max',
      displayName: 'Qwen Image Max',
      modality: 'image',
      capabilities: ['text_to_image'],
      enabled: true,
      currency: 'CNY',
      pricingUnit: 'image',
      metadata: { contract: 'openai-compatible', promptExtend: true },
      creditsCost: 30,
      qualityLevel: 'professional',
      advanced: true,
    },
    {
      id: antDigitalReferenceModelId,
      providerId,
      modelId: 'qwen-image-2.0',
      displayName: 'Qwen Image 2.0',
      modality: 'image',
      capabilities: ['text_to_image', 'image_to_image'],
      enabled: true,
      currency: 'CNY',
      pricingUnit: 'image',
      metadata: { contract: 'openai-compatible', referenceField: 'image', maxReferences: 1 },
      creditsCost: 10,
      qualityLevel: 'standard',
      advanced: true,
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
      creditsCost: 50,
      qualityLevel: 'flagship',
      advanced: true,
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
      id: '00000000-0000-4000-8000-000000000109',
      logicalModelId,
      providerModelId: antDigitalReferenceModelId,
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

export const promptTemplates: PromptTemplate[] = [
  {
    id: 'fashion-brand-ad',
    category: '女装',
    scene: '高级品牌广告',
    style: '自然光品牌大片',
    prompt: '保持商品设计、颜色与材质一致，生成高级商业摄影，自然光，品牌广告风格。',
    negativePrompt: '商品变形，错误文字，低清晰度，过度磨皮',
    supportedModels: ['qwen-image-2.0', 'qwen-image-max', 'qwen-image-edit-plus'],
  },
  {
    id: 'shoe-sports-ad',
    category: '鞋',
    scene: '运动广告',
    style: '动感棚拍',
    prompt: '保持鞋款结构和标识一致，生成动感运动广告，专业棚拍光线，清晰材质细节。',
    negativePrompt: '鞋型变形，多余鞋带，模糊，错误标识',
    supportedModels: ['qwen-image-2.0', 'qwen-image-edit-plus'],
  },
  {
    id: 'bag-luxury-ad',
    category: '包',
    scene: '奢侈品广告',
    style: '极简高级',
    prompt: '保持包款设计和五金细节一致，生成奢侈品商业广告，极简场景，精致专业布光。',
    negativePrompt: '包型变形，五金错误，廉价质感，杂乱背景',
    supportedModels: ['qwen-image-2.0', 'qwen-image-max', 'qwen-image-edit-plus'],
  },
];

export function modelCatalogFor(user: User): AIModelCatalogResult {
  const professionalAccess = user.email === 'demo@weavia.local';
  return {
    professionalAccess,
    models: defaultCatalog.providerModels.map((model) => ({
      id: model.modelId,
      name: model.displayName,
      capabilities: model.capabilities.map((capability) =>
        capability === 'text_to_image'
          ? 'image_generation'
          : capability === 'image_to_image'
            ? 'reference_image'
            : capability,
      ) as AIModelCatalogResult['models'][number]['capabilities'],
      creditsCost: model.creditsCost,
      enabled: model.enabled,
      qualityLevel: model.qualityLevel,
      advanced: model.advanced,
    })),
  };
}

export function estimateGeneration(user: User, input: AIEstimateRequest): AIEstimateResult {
  if (input.imageCount !== 1)
    throw new GatewayError('INVALID_REQUEST', 'Beta 当前仅支持单张生成', 400);
  const catalog = modelCatalogFor(user);
  const model = catalog.models.find((item) => item.id === input.model && item.enabled);
  if (!model) throw new GatewayError('UNSUPPORTED_MODEL', '模型不可用', 400);
  if (input.advancedSelection && model.advanced && !catalog.professionalAccess)
    throw new GatewayError('UNSUPPORTED_MODEL', '当前账户未开放高级模型', 403);
  return {
    credits: model.creditsCost * input.imageCount,
    estimatedTime: model.id === 'qwen-image-2.0' ? 30 : model.id === 'qwen-image-max' ? 45 : 60,
    model: model.id,
  };
}

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
