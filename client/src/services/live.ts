import { apiRequest } from './api';
import { importAsset } from './assets';
import { uploadReferenceAsset } from './serverAssets';
import { useApp } from '../stores/app';
import type { Task, TaskStatus, Work } from '../types';

export type ServerTask = {
  id: string;
  status: string;
  outputs?: { base64Data?: string; objectKey?: string; mimeType?: string }[];
  error?: { code?: string; message?: string };
  model?: string;
  mode?: string;
  provider?: string;
  providerTaskId?: string;
  cost?: number;
  createdAt?: string;
};

const timers = new Map<string, number>();
const parentWorks = new Map<string, string>();
const attempts = new Map<string, number>();
const LIVE_MODELS: Record<string, string> = { 'image-balanced': 'qwen-image-2.0', 'image-detail': 'qwen-image-2.0', 'image-max': 'qwen-image-max' };

function mapStatus(status: string): TaskStatus {
  switch (status) {
    case 'success': return 'Succeeded';
    case 'failed': return 'Failed';
    case 'cancelled': return 'Cancelled';
    case 'running':
    case 'downloading':
    case 'reconciling': return 'Running';
    default: return 'Queued';
  }
}

export function toTask(server: ServerTask, prompt: string): Task {
  return {
    id: server.id,
    title: prompt.slice(0, 28),
    prompt,
    mode: server.mode?.includes('video') ? 'video' : 'image',
    status: mapStatus(server.status),
    progress: server.status === 'success' ? 100 : mapStatus(server.status) === 'Running' ? 60 : 20,
    createdAt: server.createdAt || new Date().toISOString(),
    source: 'live',
    error: server.error?.message,
    errorCode: server.error?.code,
    providerTaskId: server.providerTaskId,
    provider: server.provider,
    model: server.model,
  };
}

async function complete(id: string, server: ServerTask) {
  const state = useApp.getState();
  const task = state.tasks.find(item => item.id === id);
  const output = server.outputs?.[0];
  if (!task || !output?.base64Data) {
    state.updateTask(id, { status: 'Failed', error: '任务成功但没有可读取的图片' });
    return;
  }
  try {
    if ((output.mimeType || '').startsWith('video/')) {
      const workId = crypto.randomUUID();
      const work: Work = { id: workId, title: task.title, mode: 'video', taskId: id, source: 'live', versions: [{ id: crypto.randomUUID(), createdAt: new Date().toISOString(), prompt: task.prompt, dataUrl: output.base64Data, mimeType: output.mimeType }] };
      state.addWork(work);
      state.updateTask(id, { status: 'Succeeded', progress: 100, workId, outputDataUrl: output.base64Data, outputMimeType: output.mimeType });
      state.notify('视频生成完成，作品已保存');
      window.dispatchEvent(new Event('weavia:credits'));
      return;
    }
    const blob = await (await fetch(output.base64Data)).blob();
    const file = new File([blob], `${id}.png`, { type: output.mimeType || blob.type || 'image/png' });
    const asset = await importAsset(file);
    state.addAsset({ ...asset, category: '作品' });
    const parentId = parentWorks.get(id);
    const parent = parentId ? state.works.find(item => item.id === parentId) : undefined;
    if (parent) {
      const version = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), prompt: task.prompt, assetId: asset.id };
      state.updateWork({ ...parent, versions: [...parent.versions, version] });
      state.updateTask(id, { status: 'Succeeded', progress: 100, workId: parent.id });
      state.notify('AI 编辑已保存为原作品的新版本');
      window.dispatchEvent(new Event('weavia:credits'));
      return;
    }
    const workId = crypto.randomUUID();
    const work: Work = {
      id: workId,
      title: task.title,
      mode: 'image',
      taskId: id,
      source: 'live',
      versions: [{ id: crypto.randomUUID(), createdAt: new Date().toISOString(), prompt: task.prompt, assetId: asset.id }],
    };
    state.addWork(work);
    state.updateTask(id, { status: 'Succeeded', progress: 100, workId });
    state.notify('云端任务已完成，作品已保存');
    window.dispatchEvent(new Event('weavia:credits'));
  } catch (error) {
    state.updateTask(id, { status: 'Failed', error: error instanceof Error ? error.message : '结果保存失败' });
  } finally {
    timers.delete(id);
    attempts.delete(id);
    parentWorks.delete(id);
  }
}

export function trackLiveTask(server: ServerTask, prompt: string, parentWorkId?: string) {
  if (parentWorkId) parentWorks.set(server.id, parentWorkId);
  useApp.getState().submitTask(toTask(server, prompt));
  poll(server.id);
}

function poll(id: string) {
  const tick = async () => {
    try {
      const server = await apiRequest<ServerTask>(`/api/ai/tasks/${id}`, {}, { timeoutMs: 15000 });
      const count = (attempts.get(id) || 0) + 1;
      attempts.set(id, count);
      const status = mapStatus(server.status);
      if (status === 'Succeeded') { await complete(id, server); return; }
      if (status === 'Failed' || status === 'Cancelled') {
        useApp.getState().updateTask(id, { status, error: server.error?.message || '任务未完成' });
        timers.delete(id);
        attempts.delete(id);
        return;
      }
      useApp.getState().updateTask(id, { status, progress: status === 'Running' ? 60 : 20, providerTaskId: server.providerTaskId, provider: server.provider, model: server.model });
      if (count > 120) {
        useApp.getState().updateTask(id, { status: 'Failed', error: '任务超时，请稍后重试' });
        timers.delete(id);
        attempts.delete(id);
        return;
      }
      timers.set(id, window.setTimeout(() => { void tick(); }, 1500));
    } catch (error) {
      useApp.getState().updateTask(id, { status: 'Failed', error: error instanceof Error ? error.message : '任务轮询失败' });
      timers.delete(id);
      attempts.delete(id);
    }
  };
  void tick();
}

export async function createLiveTask(prompt: string, modelId: string, params?: { ratio: string; resolution: string; count: number; promptExtend: boolean; size?: string; negativePrompt?: string; seed?: string; outputFormat?: string; watermark?: boolean; referenceStrength?: number }, referenceAssetIds: string[] = [], mode: 'image' | 'video' = 'image'): Promise<string> {
  const model = LIVE_MODELS[modelId] || modelId;
  if (!model) throw new Error('当前模型尚未接入云端生成');
  const references = await Promise.all(referenceAssetIds.map(async id => {
    const asset = useApp.getState().assets.find(item => item.id === id);
    return asset ? uploadReferenceAsset(asset) : null;
  }));
  const referenceAssets = references.filter(Boolean).map(item => ({ assetId: item!.assetId, objectKey: item!.objectKey, mimeType: item!.mimeType }));
  const server = await apiRequest<ServerTask>('/api/ai/tasks', {
    method: 'POST',
    body: JSON.stringify({
      idempotencyKey: crypto.randomUUID(),
      modelKey: modelId,
      model,
      mode: mode === 'video' ? 'text_to_video' : referenceAssets.length ? 'image_to_image' : 'text_to_image',
      projectId: referenceAssets.length && mode === 'image' ? 'local-assets' : '',
      prompt,
      referenceAssets,
      inputAssetId: referenceAssets[0]?.assetId || '',
      size: mode === 'video' ? (params?.resolution === '1080P' ? '1920*1080' : '1280*720') : params?.size || '1024x1024',
      numberOfImages: 1,
      duration: mode === 'video' ? 5 : undefined,
      ratio: params?.ratio || '1:1',
      resolution: params?.resolution || '1K',
      promptExtend: params?.promptExtend ?? true,
      negativePrompt: params?.negativePrompt || '',
      seed: params?.seed || '',
      outputFormat: params?.outputFormat || 'png',
      watermark: params?.watermark ?? false,
      referenceStrength: params?.referenceStrength ?? 0.65,
      workflow: 'image_generation',
    }),
  });
  useApp.getState().submitTask(toTask(server, prompt));
  poll(server.id);
  return server.id;
}

export async function createLiveEditTask(prompt: string, modelId: string, asset: import('../types').Asset, parentWorkId?: string): Promise<string> {
  const model = modelId || 'qwen-image-edit-plus';
  const reference = await uploadReferenceAsset(asset);
  const server = await apiRequest<ServerTask>('/api/ai/tasks', {
    method: 'POST',
    body: JSON.stringify({
      idempotencyKey: crypto.randomUUID(),
      modelKey: model,
      model,
      mode: model === 'qwen-image-2.0' ? 'image_to_image' : 'image_edit',
      editMode: 'whole',
      projectId: 'local-assets',
      inputAssetId: reference.assetId,
      referenceAssets: [{ assetId: reference.assetId, objectKey: reference.objectKey, mimeType: reference.mimeType }],
      prompt,
      size: '1024x1024',
      numberOfImages: 1,
      workflow: 'image_generation',
    }),
  });
  trackLiveTask(server, prompt.slice(0, 28), parentWorkId);
  return server.id;
}

export function cancelLiveTask(id: string) {
  const timer = timers.get(id);
  if (timer) window.clearTimeout(timer);
  timers.delete(id);
  attempts.delete(id);
  // The API has no cancel endpoint yet; stop polling and mark the local task.
  useApp.getState().updateTask(id, { status: 'Cancelled', progress: 0 });
}
