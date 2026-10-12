import type { AuthErrorShape, AuthSessionResult, AuthStatus, Device, User } from '@weavia/shared';
import { ApiClient, AuthApiClient, asAuthError, type AuthApi } from '@weavia/api-client';
import type { DesktopPlatform, SecureTokenStore } from './auth-platform';

export interface AuthSnapshot {
  status: AuthStatus;
  loginUrl?: string | undefined;
  user?: User | undefined;
  device?: Device | undefined;
  error?: AuthErrorShape | undefined;
}
export interface AuthDependencies {
  api: AuthApi;
  tokens: SecureTokenStore;
  platform: DesktopPlatform;
}
export interface ParsedCallback {
  code: string;
  state: string;
}

const pendingLoginKey = 'weavia.desktop.pendingLogin';

function savePendingLogin(state: string, expiresAt: string) {
  if (typeof localStorage !== 'undefined')
    localStorage.setItem(pendingLoginKey, JSON.stringify({ state, expiresAt }));
}

function readPendingLogin(): { state: string; expiresAt: string } | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  try {
    const value = localStorage.getItem(pendingLoginKey);
    return value ? JSON.parse(value) as { state: string; expiresAt: string } : undefined;
  } catch {
    return undefined;
  }
}

function clearPendingLoginStorage() {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(pendingLoginKey);
}

export function parseAuthCallback(value: string): ParsedCallback {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw { code: 'INVALID_CALLBACK', message: '登录回调地址格式无效' } satisfies AuthErrorShape;
  }
  if (url.protocol !== 'weavia:' || url.hostname !== 'auth' || url.pathname !== '/callback')
    throw { code: 'INVALID_CALLBACK', message: '登录回调地址无效' } satisfies AuthErrorShape;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state)
    throw { code: 'INVALID_CALLBACK', message: '登录回调缺少必要参数' } satisfies AuthErrorShape;
  return { code, state };
}

export class DesktopAuthController {
  private snapshot: AuthSnapshot = { status: 'unauthenticated' };
  private expectedState: string | undefined;
  private loginTimeout: ReturnType<typeof setTimeout> | undefined;
  private handledCallbacks = new Set<string>();
  private refreshPromise: Promise<void> | undefined;
  private listeners = new Set<(value: AuthSnapshot) => void>();
  constructor(private readonly dependencies: AuthDependencies) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: (value: AuthSnapshot) => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async login() {
    this.update({ status: 'starting', user: undefined, device: undefined, loginUrl: undefined, error: undefined });
    try {
      const session = await this.dependencies.api.createDesktopSession('weavia://auth/callback');
      this.expectedState = session.state;
      savePendingLogin(session.state, session.expiresAt);
      this.update({ status: 'waiting_browser', loginUrl: session.loginUrl });
      this.loginTimeout = setTimeout(
        () => {
          this.clearPendingLogin();
          this.update({
            status: 'error',
            loginUrl: undefined,
            error: { code: 'SESSION_EXPIRED', message: '登录请求已超时，请重新登录' },
          });
        },
        Math.max(0, new Date(session.expiresAt).getTime() - Date.now()),
      );
      await this.dependencies.platform.openExternal(session.loginUrl);
    } catch (error) {
      this.fail(error);
    }
  }

  async reopenBrowser() {
    if (this.snapshot.loginUrl && this.expectedState)
      await this.dependencies.platform.openExternal(this.snapshot.loginUrl);
    else await this.login();
  }

  async handleCallback(value: string) {
    try {
      if (this.handledCallbacks.has(value))
        throw { code: 'INVALID_CALLBACK', message: '该登录回调已处理' } satisfies AuthErrorShape;
      const callback = parseAuthCallback(value);
      const pending = readPendingLogin();
      const expectedState = this.expectedState ?? pending?.state;
      if (pending && Date.parse(pending.expiresAt) <= Date.now())
        throw { code: 'SESSION_EXPIRED', message: '登录请求已超时，请重新登录' } satisfies AuthErrorShape;
      if (!expectedState || callback.state !== expectedState)
        throw {
          code: 'INVALID_STATE',
          message: '登录状态校验失败，请重新登录',
        } satisfies AuthErrorShape;
      this.handledCallbacks.add(value);
      this.update({ status: 'exchanging', error: undefined });
      const deviceInfo = await this.dependencies.platform.getDeviceInfo();
      const session = await this.dependencies.api.exchange(
        callback.code,
        callback.state,
        deviceInfo,
      );
      await this.persist(session);
      this.clearPendingLogin();
      this.update({
        status: 'authenticated',
        loginUrl: undefined,
        user: session.user,
        device: session.device,
        error: undefined,
      });
    } catch (error) {
      this.fail(error);
    }
  }

  async restoreSession() {
    const refreshToken = await this.dependencies.tokens.getRefreshToken();
    if (!refreshToken) {
      this.update({ status: 'unauthenticated' });
      return;
    }
    await this.refreshSession();
  }

  async refreshSession() {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.performRefresh().finally(() => {
      this.refreshPromise = undefined;
    });
    return this.refreshPromise;
  }

  async logout() {
    const refreshToken = await this.dependencies.tokens.getRefreshToken();
    try {
      await this.dependencies.api.logout(refreshToken);
    } catch {
      /* Local logout must always succeed. */
    }
    await this.dependencies.tokens.clearTokens();
    this.clearPendingLogin();
    this.handledCallbacks.clear();
    this.update({
      status: 'unauthenticated',
      loginUrl: undefined,
      user: undefined,
      device: undefined,
      error: undefined,
    });
  }

  cancelLogin() {
    this.clearPendingLogin();
    this.update({ status: 'unauthenticated', loginUrl: undefined, error: undefined });
  }

  private async performRefresh() {
    this.update({ status: 'refreshing', error: undefined });
    try {
      const refreshToken = await this.dependencies.tokens.getRefreshToken();
      if (!refreshToken)
        throw { code: 'REFRESH_FAILED', message: '没有可恢复的登录信息' } satisfies AuthErrorShape;
      const session = await this.dependencies.api.refresh(refreshToken);
      await this.persist(session);
      this.update({
        status: 'authenticated',
        user: session.user,
        device: session.device,
        error: undefined,
      });
    } catch (error) {
      await this.dependencies.tokens.clearTokens();
      this.update({
        status: 'unauthenticated',
        user: undefined,
        device: undefined,
        error: asError(error, 'REFRESH_FAILED'),
      });
    }
  }

  private async persist(session: AuthSessionResult) {
    await this.dependencies.tokens.setAccessToken(session.accessToken);
    await this.dependencies.tokens.setRefreshToken(session.refreshToken);
  }
  private fail(error: unknown) {
    this.clearPendingLogin();
    this.update({ status: 'error', user: undefined, device: undefined, loginUrl: undefined, error: asError(error) });
  }
  private update(next: Partial<AuthSnapshot>) {
    this.snapshot = { ...this.snapshot, ...next };
    for (const listener of this.listeners) listener(this.snapshot);
  }
  private clearPendingLogin() {
    this.expectedState = undefined;
    clearPendingLoginStorage();
    if (this.loginTimeout) clearTimeout(this.loginTimeout);
    this.loginTimeout = undefined;
  }
}

function asError(error: unknown, fallback?: AuthErrorShape['code']): AuthErrorShape {
  if (typeof error === 'object' && error && 'code' in error && 'message' in error)
    return error as AuthErrorShape;
  const mapped = asAuthError(error);
  return fallback && mapped.code === 'UNKNOWN' ? { ...mapped, code: fallback } : mapped;
}

export function createAuthApi(getAccessToken: () => Promise<string | undefined>) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/';
  return new AuthApiClient(
    new ApiClient(baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`, getAccessToken),
  );
}
