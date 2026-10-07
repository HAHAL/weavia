import { invoke, isTauri } from '@tauri-apps/api/core';
import { AIApiClient, ApiClient } from '@weavia/api-client';
import type {
  CloudAITaskResult,
  GeneratedResult,
  ImageGenerationRequest,
  LocalAsset,
  LocalTaskRecord,
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

export async function runCloudImageWorkflow(
  projectId: string,
  asset: LocalAsset,
  workflow: 'ai_model' | 'ai_commercial',
  onStage: (stage: CloudGenerationStage) => void,
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
    prompt:
      workflow === 'ai_model'
        ? '专业电商模特摄影，简洁高级的摄影棚灯光与自然姿态，画面突出商品，真实质感。'
        : '高端电商商品摄影，现代极简场景，专业布光，真实材质，适合品牌广告。',
    mode: 'image_to_image',
    referenceAssets: [referenceAsset],
    size: '1024x1024',
    quality: 'standard',
    numberOfImages: 1,
    outputFormat: 'png',
    metadata: { desktopTaskId: id },
  };
  onStage('generating');
  let cloudTask: CloudAITaskResult;
  try {
    cloudTask = await aiApi.generateImage(request);
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
