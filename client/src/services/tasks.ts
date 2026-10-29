import { useApp } from '../stores/app';
import { apiConfig } from './api';
import { cancelLiveTask, createLiveTask } from './live';
import type { CreativeBrief, Mode, ProductBrief, Task, Work } from '../types';

export type ImageParams = { ratio: string; resolution: string; count: number; promptExtend: boolean; duration?: number; size?: string; negativePrompt?: string; seed?: string; outputFormat?: string; watermark?: boolean; referenceStrength?: number };
export type CreationInput = { prompt: string; mode: Mode; modelId: string; product?: ProductBrief; creative?: CreativeBrief; referenceAssetIds?: string[]; params?: ImageParams; quoteId?: string };

type Run = { runId: string; timers: number[] };
const runs = new Map<string, Run>();
const ACTIVE_STATUSES: Task['status'][] = ['Queued', 'Running'];

function currentTask(id: string) {
  return useApp.getState().tasks.find(t => t.id === id);
}

function isCurrent(id: string, runId: string) {
  return runs.get(id)?.runId === runId;
}

export function createMockTask(prompt: string, mode: Mode, context: Pick<CreationInput, 'product' | 'creative' | 'referenceAssetIds'> = {}) {
  const id = crypto.randomUUID();
  const task: Task = { id, title: prompt.slice(0, 28), prompt, mode, status: 'Queued', progress: 0, createdAt: new Date().toISOString(), source: 'mock', ...context };
  useApp.getState().submitTask(task);
  runMockTask(id);
  return id;
}

export function runMockTask(id: string) {
  // A retry must invalidate the previous run, otherwise old timers can
  // resurrect a cancelled task or overwrite a newer run's progress.
  const previous = runs.get(id);
  previous?.timers.forEach(clearTimeout);

  const runId = crypto.randomUUID();
  const timers: number[] = [];
  const schedule = (delay: number, fn: () => void) => {
    const timer = window.setTimeout(() => {
      if (!isCurrent(id, runId)) return;
      fn();
    }, delay);
    timers.push(timer);
  };

  schedule(700, () => {
    const task = currentTask(id);
    if (!task || task.status !== 'Queued') return;
    useApp.getState().updateTask(id, { status: 'Running', progress: 35 });
  });

  schedule(1700, () => {
    const task = currentTask(id);
    if (!task || task.status !== 'Running') return;
    useApp.getState().updateTask(id, { progress: 75 });
  });

  schedule(2900, () => {
    const task = currentTask(id);
    if (!task || task.status !== 'Running') return;
    const state = useApp.getState();
    const workId = crypto.randomUUID();
    const work: Work = { id: workId, title: task.title, mode: task.mode, taskId: id, source: 'mock', product: task.product, versions: [{ id: crypto.randomUUID(), createdAt: new Date().toISOString(), prompt: task.prompt }] };
    state.addWork(work);
    state.updateTask(id, { status: 'Succeeded', progress: 100, workId });
    state.notify('演示任务已完成，作品已加入作品中心');
    runs.delete(id);
  });

  runs.set(id, { runId, timers });
}

export function cancelMockTask(id: string) {
  const run = runs.get(id);
  run?.timers.forEach(clearTimeout);
  runs.delete(id);
  const task = currentTask(id);
  if (task && ACTIVE_STATUSES.includes(task.status)) {
    useApp.getState().updateTask(id, { status: 'Cancelled', progress: 0 });
  }
}

export function disposeMockTasks() {
  for (const run of runs.values()) run.timers.forEach(clearTimeout);
  runs.clear();
}


export async function createTask({ prompt, mode, modelId, product, creative, referenceAssetIds = [], params, quoteId }: CreationInput): Promise<string> {
  if (apiConfig.mode === 'live') {
    return createLiveTask(prompt, modelId, params, referenceAssetIds, mode, creative, product, quoteId);
  }
  return createMockTask(prompt, mode, { product, creative, referenceAssetIds });
}

export function cancelTask(id: string) {
  const task = useApp.getState().tasks.find(item => item.id === id);
  if (task?.source === 'live') cancelLiveTask(id);
  else cancelMockTask(id);
}
