import { log } from '../lib/logger';

export class ApiError extends Error {
  code: string;
  status?: number;
  retryable?: boolean;
  constructor(code: string, message: string, status?: number, retryable?: boolean) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

export const apiConfig = {
  mode: import.meta.env.VITE_API_MODE === 'live' ? ('live' as const) : ('mock' as const),
  baseUrl: (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080').replace(/\/$/, ''),
};

let sessionToken: string | null = null;
export function setApiSession(token: string | null) { sessionToken = token; }
export function getApiSession() { return sessionToken; }
function activeToken() {
  if (sessionToken) return sessionToken;
  try {
    const raw = sessionStorage.getItem('weavia.session');
    const saved = raw ? JSON.parse(raw) as { token?: string } : null;
    if (saved?.token) sessionToken = saved.token;
  } catch { /* ignore malformed session */ }
  return sessionToken;
}
export function isLiveMode() { return apiConfig.mode === 'live'; }

export async function apiBlob(path: string, timeoutMs = 180000): Promise<Blob> {
  if (!isLiveMode()) throw new ApiError('API_NOT_CONFIGURED', '当前为演示模式');
  const token = activeToken();
  if (!token) throw new ApiError('AUTH_REQUIRED', '请先登录');
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(new URL(path, apiConfig.baseUrl + '/'), { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
    if (!response.ok) throw new ApiError(`HTTP_${response.status}`, `结果下载失败 (${response.status})`, response.status);
    return response.blob();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') throw new ApiError('TIMEOUT', '结果下载超时，请稍后在任务中重试');
    throw new ApiError('NETWORK_ERROR', '结果下载失败，请检查网络');
  } finally {
    clearTimeout(timeout);
  }
}

type RequestOptions = { auth?: boolean; timeoutMs?: number };

export async function apiRequest<T>(path: string, init: RequestInit = {}, options: RequestOptions = {}): Promise<T> {
  if (!isLiveMode()) throw new ApiError('API_NOT_CONFIGURED', '当前为演示模式，未连接真实服务');
  if (!apiConfig.baseUrl) throw new ApiError('API_NOT_CONFIGURED', '未配置 VITE_API_BASE_URL');
  const authRequired = options.auth !== false;
  const token = authRequired ? activeToken() : null;
  if (authRequired && !token) throw new ApiError('AUTH_REQUIRED', '请先登录');

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs ?? 20000);
  const url = new URL(path, apiConfig.baseUrl + '/');
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (authRequired && token) headers.set('Authorization', `Bearer ${token}`);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal, headers });
    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try { payload = JSON.parse(text); } catch { payload = text; }
    }
    log(response.ok ? 'info' : 'error', 'api.response', `${url.pathname} ${response.status}`);
    if (!response.ok) {
      const body = (payload && typeof payload === 'object' ? payload : {}) as { code?: string; message?: string; retryable?: boolean };
      if (response.status === 401) window.dispatchEvent(new Event('weavia:unauthorized'));
      throw new ApiError(body.code || `HTTP_${response.status}`, body.message || `服务请求失败 (${response.status})`, response.status, body.retryable);
    }
    // The Go API wraps successful responses as { "data": ... }.
    const body = payload && typeof payload === 'object' && 'data' in payload
      ? (payload as { data: unknown }).data
      : payload;
    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') throw new ApiError('TIMEOUT', '请求超时，请重试');
    log('error', 'api.failure', `${url.pathname} ${error instanceof Error ? error.name : 'request-error'}`);
    throw new ApiError('NETWORK_ERROR', '无法连接服务，请检查网络或服务地址');
  } finally {
    clearTimeout(timeout);
  }
}
