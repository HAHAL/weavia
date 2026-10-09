import { invoke, isTauri } from '@tauri-apps/api/core';
import { AIApiClient, ApiClient } from '@weavia/api-client';
import type {
  AIEstimateResult,
  AIModelCatalogResult,
  CloudAITaskResult,
  GeneratedResult,
  ImageGenerationRequest,
  LocalAsset,
  LocalTaskRecord,
  PromptTemplate,
  Quality,
} from '@weavia/shared';
import { secureTokenStore } from './auth-platform';
import { ReferenceAssetTransport } from './asset-transport';
import { localData } from './local-data';

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/';
const aiApi = new AIApiClient(
  new ApiClient(baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`, () =>
    secureTokenStore.getAccessToken(),
  ),
);
const referenceAssetTransport = new ReferenceAssetTransport({
  readDataUrl: (assetId) => localData.assetDataUrl(assetId),
  presign: (input) => aiApi.presignAsset(input),
  upload: async (uploadUrl, body, contentType) => {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': contentType },
      body,
    });
    if (!response.ok) throw new Error(`参考图上传失败 (${response.status})`);
  },
  markUpload: (assetId, status, remoteReferenceId, expiresAt) =>
    localData.updateAssetUpload(assetId, status, remoteReferenceId, expiresAt),
});

export type CloudGenerationStage =
  'preparing' | 'submitting' | 'generating' | 'downloading' | 'saving' | 'complete';

export interface CloudGenerationOptions {
  model: string;
  prompt: string;
  quality: Quality;
  credits: number;
  advancedModelSelection: boolean;
}

export async function loadCloudGenerationOptions(): Promise<{
  catalog: AIModelCatalogResult;
  templates: PromptTemplate[];
}> {
  const [catalog, templates] = await Promise.all([
    aiApi.getModelCatalog(),
    aiApi.getPromptTemplates(),
  ]);
  return { catalog, templates };
}

export function estimateCloudGeneration(
  workflow: 'ai_model' | 'ai_commercial',
  model: string,
  advancedSelection: boolean,
): Promise<AIEstimateResult> {
  return aiApi.estimate({
    workflow: workflow === 'ai_commercial' ? 'product_image_generation' : workflow,
    model,
    imageCount: 1,
    advancedSelection,
  });
}

export async function runCloudImageWorkflow(
  projectId: string,
  asset: LocalAsset,
  workflow: 'ai_model' | 'ai_commercial',
  onStage: (stage: CloudGenerationStage) => void,
  options: CloudGenerationOptions,
) {
  if (!isTauri()) throw new Error('专业生成仅支持 WEAVIA Desktop');
  onStage('preparing');
  const preparedInput = await referenceAssetTransport.prepareInput(asset);
  const referenceAsset = await referenceAssetTransport.resolveProviderInput(preparedInput);
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const task: LocalTaskRecord = {
    id,
    projectId,
    workflow,
    status: 'queued',
    input: {
      assetId: asset.id,
      workflow: 'product_image_generation',
      referenceAssets: [asset.id],
      logicalModel: 'weavia-image-pro',
      model: options.model,
      credits: options.credits,
      idempotencyKey: id,
      deliveryStatus: 'submitting',
    },
    progress: 5,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await invoke('create_local_task', { task });
  onStage('submitting');
  const request: ImageGenerationRequest = {
    idempotencyKey: id,
    projectId,
    inputAssetId: asset.id,
    workflow: workflow === 'ai_commercial' ? 'product_image_generation' : workflow,
    logicalModel: 'weavia-image-pro',
    model: options.model,
    prompt: options.prompt,
    mode: 'image_to_image',
    referenceAssets: [referenceAsset],
    size: '1024x1024',
    quality: options.quality,
    numberOfImages: 1,
    outputFormat: 'png',
    metadata: {
      desktopTaskId: id,
      credits: options.credits,
      advancedModelSelection: options.advancedModelSelection,
    },
  };
  onStage('generating');
  let cloudTask: CloudAITaskResult;
  try {
    cloudTask = await aiApi.generateImage(request);
    cloudTask = await waitForCloudTask(cloudTask);
  } catch (error) {
    await failLocalTask(task, error);
    throw error;
  }
  const output = cloudTask.outputs[0];
  if (!output) {
    const error = new Error('AI 服务未返回生成结果');
    await failLocalTask(task, error);
    throw error;
  }
  const source = await referenceAssetTransport.resolveResult(output);
  onStage('downloading');
  task.status = 'downloading';
  task.progress = 80;
  task.output = {
    cloudTaskId: cloudTask.id,
    remoteSource: source,
    mimeType: output.mimeType,
    deliveryStatus: 'download_pending',
  };
  task.updatedAt = new Date().toISOString();
  await invoke('update_local_task', { task });
  onStage('saving');
  try {
    const result = await invoke<GeneratedResult>('save_remote_generated_result', {
      taskId: task.id,
      remoteSource: source,
      expectedMimeType: output.mimeType,
    });
    onStage('complete');
    return result;
  } finally {
    await referenceAssetTransport.cleanup(preparedInput);
  }
}

async function waitForCloudTask(initial: CloudAITaskResult) {
  let task = initial;
  const deadline = Date.now() + 3 * 60 * 1000;
  while (task.status === 'queued' || task.status === 'running') {
    if (Date.now() >= deadline) throw new Error('AI 任务等待超时，可在任务中心继续查看');
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    task = await aiApi.getTask(task.id);
  }
  if (task.status === 'failed') {
    const error = new Error(task.error?.message ?? '专业生成失败') as Error & { code?: string };
    error.code = task.error?.code ?? 'GENERATION_FAILED';
    throw error;
  }
  return task;
}

export async function resumePendingDeliveries(projectId: string) {
  const tasks = await localData.listTasks(projectId);
  const pending = tasks.filter(
    (task) => task.status === 'reconciling' && typeof task.output?.remoteSource === 'string',
  );
  return Promise.allSettled(
    pending.map((task) =>
      invoke<GeneratedResult>('save_remote_generated_result', {
        taskId: task.id,
        remoteSource: task.output!.remoteSource,
        expectedMimeType: task.output!.mimeType ?? 'image/png',
      }),
    ),
  );
}

async function failLocalTask(task: LocalTaskRecord, error: unknown) {
  task.status = 'failed';
  task.error = {
    code: errorCode(error),
    message: error instanceof Error ? error.message : '专业生成失败',
  };
  task.updatedAt = new Date().toISOString();
  task.completedAt = task.updatedAt;
  await invoke('update_local_task', { task });
}

function errorCode(error: unknown) {
  return typeof error === 'object' && error && 'code' in error
    ? String(error.code)
    : 'GENERATION_FAILED';
}
