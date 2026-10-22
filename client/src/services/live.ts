import { apiBlob, apiRequest } from './api';
import { importAsset } from './assets';
import { uploadReferenceAsset } from './serverAssets';
import { useApp } from '../stores/app';
import type { CreativeBrief, ProductBrief, Task, TaskStatus, Work } from '../types';

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
  prompt?: string;
  creative?: CreativeBrief;
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

export function toTask(server: ServerTask, prompt: string, product?: ProductBrief): Task {
  const snapshot = server.creative?.product;
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
    creative: server.creative,
    product: product || (snapshot ? { id: snapshot.localId || '', name: snapshot.name, sku: snapshot.sku || '', description: snapshot.description || '', verifiedFacts: snapshot.verifiedFacts || '', forbiddenClaims: snapshot.forbiddenClaims || '', sourceAssetId: '' } : undefined),
  };
}

async function complete(id: string, server: ServerTask) {
  const state = useApp.getState();
  const task = state.tasks.find(item => item.id === id);
  const outputs = (server.outputs || []).map((item, index) => ({ ...item, index })).filter(item => item.base64Data || item.objectKey);
  if (!task || !outputs.length) {
    state.updateTask(id, { status: 'Failed', error: '任务成功但没有可读取的结果' });
    timers.delete(id);
    attempts.delete(id);
    return;
  }
  try {
    const parentId = parentWorks.get(id);
    const parent = parentId ? state.works.find(item => item.id === parentId) : undefined;
    let firstWorkId = parent?.id || '';
    for (const [sequence, output] of outputs.entries()) {
      const mime = output.mimeType || (task.mode === 'video' ? 'video/mp4' : 'image/png');
      const blob = output.base64Data ? await (await fetch(output.base64Data)).blob() : await apiBlob(`/api/ai/tasks/${id}/outputs/${output.index}`);
      const extension = mime === 'video/mp4' ? 'mp4' : mime === 'video/webm' ? 'webm' : mime === 'image/jpeg' ? 'jpg' : 'png';
      const asset = await importAsset(new File([blob], `${id}-${sequence + 1}.${extension}`, { type: mime }));
      useApp.getState().addAsset({ ...asset, category: '作品' });
      const version = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), prompt: task.prompt, assetId: asset.id, mimeType: mime };
      if (parent && sequence === 0) {
        useApp.getState().updateWork({ ...parent, versions: [...parent.versions, version] });
        continue;
      }
      const workId = crypto.randomUUID();
      const work: Work = { id: workId, title: outputs.length > 1 ? `${task.title} · ${sequence + 1}` : task.title, mode: task.mode, taskId: id, source: 'live', product: task.product, reviewStatus: 'pending', versions: [version] };
      useApp.getState().addWork(work);
      if (!firstWorkId) firstWorkId = workId;
    }
    useApp.getState().updateTask(id, { status: 'Succeeded', progress: 100, workId: firstWorkId, error: undefined });
    useApp.getState().notify(parent ? 'AI 编辑已保存为新版本' : `${task.mode === 'video' ? '视频' : '图片'}生成完成，已保存 ${outputs.length} 件作品`);
    window.dispatchEvent(new Event('weavia:credits'));
  } catch (error) {
    state.updateTask(id, { status: 'Failed', errorCode: 'RESULT_SAVE_FAILED', error: error instanceof Error ? error.message : '结果保存失败' });
  } finally {
    timers.delete(id);
    attempts.delete(id);
    parentWorks.delete(id);
  }
}

export function trackLiveTask(server: ServerTask, prompt: string, parentWorkId?: string, product?: ProductBrief) {
  if (parentWorkId) parentWorks.set(server.id, parentWorkId);
  useApp.getState().submitTask(toTask(server, prompt, product));
  poll(server.id);
}

function poll(id: string) {
  if (timers.has(id)) return;
  timers.set(id, 0);
  const tick = async () => {
    try {
      const server = await apiRequest<ServerTask>(`/api/ai/tasks/${id}`, {}, { timeoutMs: 15000 });
      const count = (attempts.get(id) || 0) + 1;
      attempts.set(id, count);
      const status = mapStatus(server.status);
      if (status === 'Succeeded') {
        if (useApp.getState().works.some(work => work.taskId === id)) {
          useApp.getState().updateTask(id, { status: 'Succeeded', progress: 100 });
          timers.delete(id); attempts.delete(id); return;
        }
        await complete(id, server); return;
      }
      if (status === 'Failed' || status === 'Cancelled') {
        useApp.getState().updateTask(id, { status, error: server.error?.message || '任务未完成' });
        timers.delete(id);
        attempts.delete(id);
        return;
      }
      useApp.getState().updateTask(id, { status, progress: status === 'Running' ? 60 : 20, providerTaskId: server.providerTaskId, provider: server.provider, model: server.model });
      timers.set(id, window.setTimeout(() => { void tick(); }, Math.min(15000, 1500 + count * 250)));
    } catch {
      const count = (attempts.get(id) || 0) + 1;
      attempts.set(id, count);
      useApp.getState().updateTask(id, { error: '暂时无法查询服务端状态，正在重试' });
      timers.set(id, window.setTimeout(() => { void tick(); }, Math.min(30000, 3000 + count * 1000)));
    }
  };
  void tick();
}

export async function createLiveTask(prompt: string, modelId: string, params?: { ratio: string; resolution: string; count: number; promptExtend: boolean; duration?: number; size?: string; negativePrompt?: string; seed?: string; outputFormat?: string; watermark?: boolean; referenceStrength?: number }, referenceAssetIds: string[] = [], mode: 'image' | 'video' = 'image', creative?: CreativeBrief, product?: ProductBrief): Promise<string> {
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
      numberOfImages: mode === 'video' ? 1 : Math.max(1, Math.min(4, params?.count || 1)),
      duration: mode === 'video' ? params?.duration || 5 : undefined,
      ratio: params?.ratio || '1:1',
      resolution: params?.resolution || '1K',
      promptExtend: params?.promptExtend ?? true,
      negativePrompt: params?.negativePrompt || '',
      seed: params?.seed || '',
      outputFormat: params?.outputFormat || 'png',
      watermark: params?.watermark ?? false,
      referenceStrength: params?.referenceStrength ?? 0.65,
      workflow: 'image_generation',
      creative,
    }),
  });
  trackLiveTask(server, prompt, undefined, product);
  return server.id;
}

export function resumeLiveTasks() {
  for (const task of useApp.getState().tasks) {
    if (task.source === 'live' && (task.status === 'Queued' || task.status === 'Running' || (task.status === 'Succeeded' && !useApp.getState().works.some(work => work.taskId === task.id)))) poll(task.id);
  }
}

export function retryLiveResult(id: string) {
  useApp.getState().updateTask(id, { status: 'Running', error: undefined, errorCode: undefined });
  poll(id);
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
  // This only stops local tracking. The server has no cancellation endpoint.
  useApp.getState().updateTask(id, { error: '已暂停本机状态查询；服务端任务仍可能继续执行' });
}
