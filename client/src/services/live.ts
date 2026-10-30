import { ApiError, apiBlob, apiRequest } from './api';
import { withNewVersion } from '../lib/review';
import { importAsset } from './assets';
import { uploadReferenceAsset } from './serverAssets';
import { useApp } from '../stores/app';
import { isResultSaveFailure, missingIndexes, savedIndexes } from '../lib/outputs';
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
  const task = useApp.getState().tasks.find(item => item.id === id);
  const outputs = (server.outputs || []).map((item, index) => ({ ...item, index })).filter(item => item.base64Data || item.objectKey);
  if (!task || !outputs.length) {
    useApp.getState().updateTask(id, { status: 'Failed', errorCode: 'RESULT_SAVE_FAILED', error: '任务成功但没有可读取的结果' });
    timers.delete(id); attempts.delete(id); parentWorks.delete(id);
    return;
  }
  const total = outputs.length;
  const saved = new Set(savedIndexes(task, useApp.getState().works));
  const parentId = parentWorks.get(id);
  const parent = parentId ? useApp.getState().works.find(item => item.id === parentId) : undefined;
  let firstWorkId = task.workId || parent?.id || '';
  for (const index of missingIndexes([...saved], total)) {
    const output = outputs.find(item => item.index === index);
    if (!output) continue;
    try {
      const mime = output.mimeType || (task.mode === 'video' ? 'video/mp4' : 'image/png');
      const blob = output.base64Data ? await (await fetch(output.base64Data)).blob() : await apiBlob(`/api/ai/tasks/${id}/outputs/${output.index}`);
      const extension = mime === 'video/mp4' ? 'mp4' : mime === 'video/webm' ? 'webm' : mime === 'image/jpeg' ? 'jpg' : 'png';
      const asset = await importAsset(new File([blob], `${id}-${index + 1}.${extension}`, { type: mime }));
      useApp.getState().addAsset({ ...asset, category: '作品' });
      const version = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), prompt: task.prompt, assetId: asset.id, mimeType: mime, taskId: id, outputIndex: index };
      if (parent && index === 0) {
        useApp.getState().updateWork(withNewVersion(parent, version));
      } else if (!useApp.getState().works.some(work => work.taskId === id && work.outputIndex === index)) {
        const workId = crypto.randomUUID();
        const work: Work = { id: workId, title: total > 1 ? `${task.title} · ${index + 1}` : task.title, mode: task.mode, taskId: id, source: 'live', product: task.product, reviewStatus: 'pending', versions: [version], outputIndex: index };
        useApp.getState().addWork(work);
        if (!firstWorkId) firstWorkId = workId;
      }
      // 每存成功一张立刻记账，崩溃或断网后只补缺失的序号。
      saved.add(index);
      useApp.getState().updateTask(id, { savedOutputs: [...saved].sort((a, b) => a - b), expectedOutputs: total });
      window.dispatchEvent(new Event('weavia:credits'));
    } catch { /* 单张失败不阻断其余输出，最终按缺失集合提示重试 */ }
  }
  const savedList = [...saved].sort((a, b) => a - b);
  if (savedList.length >= total) {
    useApp.getState().updateTask(id, { status: 'Succeeded', progress: 100, workId: firstWorkId, expectedOutputs: total, savedOutputs: savedList, error: undefined, errorCode: undefined });
    useApp.getState().notify(parent ? 'AI 编辑已保存为新版本' : `${task.mode === 'video' ? '视频' : '图片'}生成完成，已保存 ${savedList.length} 件作品`);
  } else {
    useApp.getState().updateTask(id, { status: 'Failed', progress: 100, errorCode: 'RESULT_SAVE_INCOMPLETE', error: `已保存 ${savedList.length}/${total}，可重新获取缺失结果`, expectedOutputs: total, savedOutputs: savedList });
  }
  timers.delete(id);
  attempts.delete(id);
  parentWorks.delete(id);
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
        const current = useApp.getState().tasks.find(item => item.id === id);
        const total = (server.outputs || []).filter(item => item.base64Data || item.objectKey).length;
        const saved = current ? savedIndexes(current, useApp.getState().works) : [];
        if (current && total > 0 && missingIndexes(saved, total).length === 0) {
          useApp.getState().updateTask(id, { status: 'Succeeded', progress: 100, expectedOutputs: total });
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

// One submission keeps one idempotency key across network retries, so a
// response lost in transit can be re-sent without creating (and charging) a
// second task: the server returns the task it already created for that key.
async function submitTask(body: Record<string, unknown>): Promise<ServerTask> {
  const idempotencyKey = crypto.randomUUID();
  const payload = JSON.stringify({ ...body, idempotencyKey });
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await apiRequest<ServerTask>('/api/ai/tasks', { method: 'POST', body: payload, headers: { 'Idempotency-Key': idempotencyKey } }, { timeoutMs: 30000 });
    } catch (error) {
      lastError = error;
      const transient = error instanceof ApiError && (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT');
      if (!transient) throw error;
      await new Promise(resolve => window.setTimeout(resolve, 1200 * (attempt + 1)));
    }
  }
  throw lastError;
}

export async function createLiveTask(prompt: string, modelId: string, params?: { ratio: string; resolution: string; count: number; promptExtend: boolean; duration?: number; size?: string; negativePrompt?: string; seed?: string; outputFormat?: string; watermark?: boolean; referenceStrength?: number }, referenceAssetIds: string[] = [], mode: 'image' | 'video' = 'image', creative?: CreativeBrief, product?: ProductBrief, quoteId?: string): Promise<string> {
  const model = LIVE_MODELS[modelId] || modelId;
  if (!model) throw new Error('当前模型尚未接入云端生成');
  const references = await Promise.all(referenceAssetIds.map(async id => {
    const asset = useApp.getState().assets.find(item => item.id === id);
    return asset ? uploadReferenceAsset(asset) : null;
  }));
  const referenceAssets = references.filter(Boolean).map(item => ({ assetId: item!.assetId, objectKey: item!.objectKey, mimeType: item!.mimeType }));
  const server = await submitTask({
      quoteId: quoteId || '',
      modelKey: modelId,
      model,
      mode: mode === 'video' ? (referenceAssets.length ? 'image_to_video' : 'text_to_video') : referenceAssets.length ? 'image_to_image' : 'text_to_image',
      projectId: referenceAssets.length ? 'local-assets' : '',
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
  });
  trackLiveTask(server, prompt, undefined, product);
  useApp.getState().updateTask(server.id, { creative, referenceAssetIds, retry: { modelId, ratio: params?.ratio, resolution: params?.resolution, count: params?.count, duration: params?.duration } });
  return server.id;
}

export function resumeLiveTasks() {
  const state = useApp.getState();
  const pending: string[] = [];
  for (const task of state.tasks) {
    if (task.source !== 'live') continue;
    if (task.status === 'Queued' || task.status === 'Running') { poll(task.id); continue; }
    const saved = savedIndexes(task, state.works).length;
    const expected = task.expectedOutputs ?? 0;
    if (expected > saved && (task.status === 'Succeeded' || isResultSaveFailure(task.errorCode))) { pending.push(task.id); continue; }
    if (task.status === 'Succeeded' && saved === 0) pending.push(task.id);
  }
  // Recovering a device from scratch must not fire one download per historical
  // task: the browser allows six connections per host, so a burst starves every
  // other request (quotes, polling) until they time out.
  pending
    .sort((a, b) => {
      const left = state.tasks.find(task => task.id === a)?.createdAt || '';
      const right = state.tasks.find(task => task.id === b)?.createdAt || '';
      return right.localeCompare(left);
    })
    .slice(0, 3)
    .forEach((id, index) => { window.setTimeout(() => poll(id), index * 600); });
}

export function retryLiveResult(id: string) {
  useApp.getState().updateTask(id, { status: 'Running', error: undefined, errorCode: undefined });
  poll(id);
}

export async function createLiveEditTask(prompt: string, modelId: string, asset: import('../types').Asset, parentWorkId?: string): Promise<string> {
  const model = modelId || 'qwen-image-edit-plus';
  const reference = await uploadReferenceAsset(asset);
  const server = await submitTask({
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
  });
  trackLiveTask(server, prompt.slice(0, 28), parentWorkId);
  return server.id;
}

// Cancels a cloud task that is still queued; the server returns its credits.
export async function cancelLiveTask(id: string) {
  await apiRequest(`/api/ai/tasks/${id}/cancel`, { method: 'POST' });
  const timer = timers.get(id);
  if (timer) window.clearTimeout(timer);
  timers.delete(id);
  attempts.delete(id);
  useApp.getState().updateTask(id, { status: 'Cancelled', error: '已取消，预扣的 Credits 已退回' });
  window.dispatchEvent(new Event('weavia:credits'));
}
