import { apiConfig, apiRequest, ApiError, getApiSession } from './api';
import type { ServerTask } from './taskState';
import type { Model } from '../types';
import type { Skill, App } from './recipes';
import type { ShowcaseItem } from '../data/showcase';
import { resumeLiveTasks, applyServerTask } from './live';
import { currentScope } from '../stores/scope';

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
const CACHE_KEY = 'weavia.sync.v3';
let snapshot: SyncSnapshot | null = null;
let epoch=0;
window.addEventListener('weavia:scope',()=>{epoch++;snapshot=null;inflight=null;emit('idle');});
let inflight: Promise<SyncSnapshot | null> | null = null;
let state: SyncState = 'idle';
const listeners = new Set<(value: SyncState) => void>();

function emit(next: SyncState) { state = next; listeners.forEach(fn => fn(next)); }
export function getSyncState() { return state; }
export function subscribeSync(fn: (value: SyncState) => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }

function readCache(): SyncSnapshot | null {
  if (snapshot?.userId===currentScope()) return snapshot;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const saved=JSON.parse(raw) as SyncSnapshot;
    snapshot=saved.userId===currentScope()?saved:null;
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

function hydrate(value: SyncSnapshot) {
 if(currentScope()!==value.userId)return;
 for(const task of value.tasks)applyServerTask(task);
 resumeLiveTasks();window.dispatchEvent(new Event('weavia:credits'));
}

async function rawManifest(etag?: string, userId?:string) {
  const url = new URL('/api/sync/manifest', apiConfig.baseUrl + '/');
  const headers = new Headers({ Accept: 'application/json' });
  const token = getApiSession();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (etag) headers.set('If-None-Match', `"${etag}"`);
  const response = await fetch(url, { headers, signal:AbortSignal.timeout(10000) });
  if (response.status === 304) return { notModified: true as const, etag };
  if (response.status === 401) { if(currentScope()===userId)window.dispatchEvent(new Event('weavia:unauthorized')); throw new ApiError('AUTH_REQUIRED', '登录已过期', 401); }
  if (!response.ok) throw new ApiError(`HTTP_${response.status}`, `同步检查失败 (${response.status})`, response.status);
  const body = await response.json() as { data?: { version?: string } };
  return { notModified: false as const, etag: body.data?.version || '' };
}

export async function startupSync(userId: string): Promise<SyncSnapshot | null> {
  if(apiConfig.mode!=='live'||currentScope()!==userId)return null;
  if (inflight) return inflight;
  const runEpoch=epoch;
  const valid=()=>runEpoch===epoch&&currentScope()===userId;
  inflight = (async () => {
    const cacheForUser=readCache();
    emit('syncing');
    try {
      // Task recovery must not depend on the template/gallery service or its ETag.
      const taskRequest=apiRequest<ServerTask[]>('/api/ai/tasks').then(tasks=>{
        if(valid())hydrate({userId,tasks} as SyncSnapshot);
        return tasks;
      });
      const catalogRequest=(async()=>{
        const manifest=await rawManifest(cacheForUser?.etag,userId);
        if(manifest.notModified&&cacheForUser)return cacheForUser;
        const [models,skills,apps,showcase]=await Promise.all([
          apiRequest<{items:Model[]}>('/api/ai/models',{}, {auth:false}),
          apiRequest<{items:Skill[]}>('/api/skills',{}, {auth:false}),
          apiRequest<{items:App[]}>('/api/apps',{}, {auth:false}),
          apiRequest<{items:ShowcaseItem[]}>('/api/showcase',{}, {auth:false}),
        ]);
        return {etag:manifest.etag||'',models:models.items||[],skills:skills.items||[],apps:apps.items||[],
          showcase:(showcase.items||[]).map(item=>({...item,imageUrl:item.imageUrl?new URL(item.imageUrl,apiConfig.baseUrl+'/').href:''}))};
      })();
      const [taskResult,catalogResult]=await Promise.allSettled([taskRequest,catalogRequest]);
      if(!valid())return null;
      const catalog=catalogResult.status==='fulfilled'?catalogResult.value:cacheForUser;
      if(!catalog){emit('error');return null;}
      const next:SyncSnapshot={...catalog,userId,tasks:taskResult.status==='fulfilled'?taskResult.value:cacheForUser?.tasks||[],syncedAt:new Date().toISOString()};
      writeCache(next);
      // Never overwrite fresher polling data with a cached task list on failure.
      resumeLiveTasks();
      emit(taskResult.status==='fulfilled'&&catalogResult.status==='fulfilled'?'synced':'offline');
      return next;
    } finally { if(valid())inflight=null; }
  })();
  return inflight;
}
