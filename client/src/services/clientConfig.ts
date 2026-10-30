import { apiConfig } from './api';
import { log } from '../lib/logger';

// What operators publish from the admin console 客户端发布 page.
export type ClientConfig = {
  apiBaseUrl: string;
  minVersion: string;
  latestVersion: string;
  downloadMac: string;
  downloadWindows: string;
  releaseNotes: string;
};

export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';
const BUILT_IN_BASE = apiConfig.baseUrl;
const OVERRIDE_KEY = 'weavia.apiBase';

export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(part => Number.parseInt(part, 10) || 0);
  const pb = b.split('.').map(part => Number.parseInt(part, 10) || 0);
  for (let i = 0; i < 3; i += 1) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff) return diff < 0 ? -1 : 1;
  }
  return 0;
}

export function upgradeRequired(config: Pick<ClientConfig, 'minVersion'> | null, current = APP_VERSION): boolean {
  return Boolean(config?.minVersion) && compareVersions(current, config!.minVersion) < 0;
}

function normalizeBase(value: string) {
  return value.trim().replace(/\/+$/, '');
}

// Called once before the app renders so every request uses the address the
// admin console last published, not only the one baked into the build.
export function applyStoredApiBase() {
  try {
    const saved = localStorage.getItem(OVERRIDE_KEY);
    if (saved && /^https?:\/\//.test(saved)) apiConfig.baseUrl = normalizeBase(saved);
  } catch { /* storage unavailable: keep the built-in address */ }
}

async function fetchJSON<T>(base: string, path: string, timeoutMs = 6000): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(new URL(path, base + '/'), { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json() as { data?: T } | T;
    return (body && typeof body === 'object' && 'data' in body ? (body as { data: T }).data : body) as T;
  } finally {
    window.clearTimeout(timer);
  }
}

async function reachable(base: string) {
  try { await fetchJSON(base, '/api/health', 5000); return true; } catch { return false; }
}

// Reads the published config from the current address (falling back to the
// built-in one) and switches to a new API address only after it answers, so a
// mistyped domain in the admin console can never cut clients off.
export async function refreshClientConfig(): Promise<ClientConfig | null> {
  if (apiConfig.mode !== 'live') return null;
  const candidates = Array.from(new Set([apiConfig.baseUrl, BUILT_IN_BASE]));
  let config: ClientConfig | null = null;
  for (const base of candidates) {
    try { config = await fetchJSON<ClientConfig>(base, '/api/client/config'); break; } catch { /* try the next address */ }
  }
  if (!config) return null;
  const next = normalizeBase(config.apiBaseUrl || '');
  if (next && next !== apiConfig.baseUrl && /^https?:\/\//.test(next) && await reachable(next)) {
    log('info', 'client.api_base_changed', `${apiConfig.baseUrl} -> ${next}`);
    apiConfig.baseUrl = next;
    try { localStorage.setItem(OVERRIDE_KEY, next); } catch { /* keep in memory only */ }
  }
  return config;
}

export function downloadUrlFor(config: ClientConfig): string {
  const windows = typeof navigator !== 'undefined' && /windows/i.test(navigator.userAgent);
  return (windows ? config.downloadWindows : config.downloadMac) || config.downloadMac || config.downloadWindows || '';
}

export async function openExternal(url: string) {
  try {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
  } catch {
    window.open(url, '_blank', 'noopener');
  }
}
