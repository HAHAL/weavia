import { apiConfig, apiRequest, ApiError, getApiSession } from './api';
import { useApp } from '../stores/app';
import type { Task, TaskStatus } from '../types';
import type { Model } from '../types';
import type { Skill, App } from './recipes';
import type { ShowcaseItem } from '../data/showcase';
import { resumeLiveTasks } from './live';

export type SyncState = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';
export type SyncSnapshot = {
  userId: string;
  etag: string;
  models: Model[];
  skills: Skill[];
  apps: App[];
  showcase: ShowcaseItem[];
  tasks: ServerTask[];
  syncedAt: string;
};
type ServerTask = {
  id: string; status: string; prompt?: string; mode?: string; model?: string; provider?: string; providerTaskId?: string; cost?: number; creative?: Task['creative'];
  createdAt?: string; outputs?: { objectKey?: string; mimeType?: string }[]; error?: { code?: string; message?: string };
};
const CACHE_KEY = 'weavia.sync.v3';
let snapshot: SyncSnapshot | null = null;
let inflight: Promise<SyncSnapshot | null> | null = null;
let state: SyncState = 'idle';
const listeners = new Set<(value: SyncState) => void>();

function emit(next: SyncState) { state = next; listeners.forEach(fn => fn(next)); }
export function getSyncState() { return state; }
export function subscribeSync(fn: (value: SyncState) => void) { listeners.add(fn); return () => listeners.delete(fn); }

function readCache(): SyncSnapshot | null {
  if (snapshot) return snapshot;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    snapshot = JSON.parse(raw) as SyncSnapshot;
    return snapshot;
  } catch { return null; }
}
function writeCache(next: SyncSnapshot) {
  snapshot = next;
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch { /* cache may be full */ }
}
export function clearSyncCache() { snapshot = null; try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ } }
export function getCachedModels(): Model[] | null { return readCache()?.models || null; }
export function getCachedSkills(): Skill[] | null { return readCache()?.skills || null; }
export function getCachedApps(): App[] | null { return readCache()?.apps || null; }
export function getCachedShowcase(): ShowcaseItem[] | null { return readCache()?.showcase || null; }
export function getCachedSync(): SyncSnapshot | null { return readCache(); }

function mapStatus(status: string): TaskStatus {
  if (status === 'success') return 'Succeeded';
  if (status === 'failed') return 'Failed';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'running' || status === 'downloading' || status === 'reconciling') return 'Running';
  return 'Queued';
}
function toTask(server: ServerTask): Task {
  const prompt = server.prompt || '历史生成任务';
  const product = server.creative?.product;
  return {
    id: server.id, title: prompt.slice(0, 28), prompt, mode: server.mode?.includes('video') ? 'video' : 'image',
    status: mapStatus(server.status), progress: server.status === 'success' ? 100 : mapStatus(server.status) === 'Running' ? 60 : 20,
    createdAt: server.createdAt || new Date().toISOString(), source: 'live', error: server.error?.message, errorCode: server.error?.code,
    provider: server.provider, providerTaskId: server.providerTaskId, model: server.model,
    creative: server.creative,
    product: product ? { id: product.localId || '', name: product.name, sku: product.sku || '', description: product.description || '', verifiedFacts: product.verifiedFacts || '', forbiddenClaims: product.forbiddenClaims || '', sourceAssetId: '' } : undefined,
  };
}

function hydrate(snapshotValue: SyncSnapshot) {
  // Server tasks are the authoritative task history; keep local-only tasks
  // that were created before the sync cache existed.
  const local = useApp.getState().tasks;
  const localById = new Map(local.map(task => [task.id, task]));
  const serverTasks = snapshotValue.tasks.map(server => {
    const task = toTask(server);
    const previous = localById.get(task.id);
    return previous ? { ...task, product: previous.product || task.product, referenceAssetIds: previous.referenceAssetIds, workId: previous.workId } : task;
  });
  const serverIds = new Set(serverTasks.map(task => task.id));
  useApp.setState({ tasks: [...serverTasks, ...local.filter(task => !serverIds.has(task.id) && task.source !== 'live')] });
  resumeLiveTasks();
  window.dispatchEvent(new Event('weavia:credits'));
}

async function rawManifest(etag?: string) {
  const url = new URL('/api/sync/manifest', apiConfig.baseUrl + '/');
  const headers = new Headers({ Accept: 'application/json' });
  const token = getApiSession();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (etag) headers.set('If-None-Match', `"${etag}"`);
  const response = await fetch(url, { headers });
  if (response.status === 304) return { notModified: true as const, etag };
  if (response.status === 401) { window.dispatchEvent(new Event('weavia:unauthorized')); throw new ApiError('AUTH_REQUIRED', '登录已过期', 401); }
  if (!response.ok) throw new ApiError(`HTTP_${response.status}`, `同步检查失败 (${response.status})`, response.status);
  const body = await response.json() as { data?: { version?: string } };
  return { notModified: false as const, etag: body.data?.version || '' };
}

export async function startupSync(userId: string): Promise<SyncSnapshot | null> {
  if (inflight) return inflight;
  inflight = (async () => {
    const cached = readCache();
    const cacheForUser = cached?.userId === userId ? cached : null;
    emit('syncing');
    try {
      const manifest = await rawManifest(cacheForUser?.etag);
      if (manifest.notModified && cacheForUser) {
        hydrate(cacheForUser);
        emit('synced');
        return cacheForUser;
      }
      const [models, skills, apps, showcase, tasks] = await Promise.all([
        apiRequest<{ items: Model[] }>('/api/ai/models', {}, { auth: false }),
        apiRequest<{ items: Skill[] }>('/api/skills', {}, { auth: false }),
        apiRequest<{ items: App[] }>('/api/apps', {}, { auth: false }),
        apiRequest<{ items: ShowcaseItem[] }>('/api/showcase', {}, { auth: false }),
        apiRequest<ServerTask[]>('/api/ai/tasks'),
      ]);
      const next: SyncSnapshot = {
        userId, etag: manifest.etag || cacheForUser?.etag || '', models: models.items || [], skills: skills.items || [], apps: apps.items || [],
        showcase: (showcase.items || []).map(item => ({ ...item, imageUrl: item.imageUrl ? (item.imageUrl.startsWith('http') ? item.imageUrl : apiConfig.baseUrl + (item.imageUrl.startsWith('/') ? item.imageUrl : '/' + item.imageUrl)) : '' })), tasks: tasks || [], syncedAt: new Date().toISOString(),
      };
      writeCache(next);
      hydrate(next);
      emit('synced');
      return next;
    } catch (error) {
      if (cacheForUser) { hydrate(cacheForUser); emit('offline'); return cacheForUser; }
      emit('error');
      throw error;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
