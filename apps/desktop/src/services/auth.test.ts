import { describe, expect, it, vi } from 'vitest';
import type { AuthSessionResult, DeviceInfo } from '@weavia/shared';
import type { AuthApi } from '@weavia/api-client';
import { DesktopAuthController, parseAuthCallback } from './auth';
import { MemorySecureTokenStore, type DesktopPlatform } from './auth-platform';

const info: DeviceInfo = {
  deviceId: 'device-1',
  deviceName: 'Mac',
  platform: 'macos',
  osVersion: '15',
  appVersion: '0.1.0',
};
const session: AuthSessionResult = {
  accessToken: 'access',
  refreshToken: 'refresh',
  expiresAt: '2030-01-01T00:00:00.000Z',
  tokenType: 'Bearer',
  user: { id: 'user-1', name: 'WEAVIA Demo', email: 'demo@weavia.local', status: 'active' },
  device: {
    ...info,
    userId: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    lastSeenAt: '2026-01-01T00:00:00.000Z',
  },
};

function setup(overrides: Partial<AuthApi> = {}) {
  const tokens = new MemorySecureTokenStore();
  const api: AuthApi = {
    createDesktopSession: vi.fn().mockResolvedValue({
      loginSessionId: 'login',
      state: 'expected',
      loginUrl: 'http://localhost:3000/login?session=login',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    }),
    exchange: vi.fn().mockResolvedValue(session),
    refresh: vi
      .fn()
      .mockResolvedValue({ ...session, accessToken: 'new-access', refreshToken: 'new-refresh' }),
    logout: vi.fn().mockResolvedValue(undefined),
    me: vi.fn().mockResolvedValue(session.user),
    ...overrides,
  };
  const platform: DesktopPlatform = {
    openExternal: vi.fn().mockResolvedValue(undefined),
    getDeviceInfo: vi.fn().mockResolvedValue(info),
    onDeepLink: vi.fn().mockResolvedValue(() => undefined),
  };
  return {
    controller: new DesktopAuthController({ api, tokens, platform }),
    api,
    tokens,
    platform,
  };
}

describe('desktop auth controller', () => {
  it('completes the correct-state login flow and registers device', async () => {
    const { controller, api, platform, tokens } = setup();
    await controller.login();
    expect(controller.getSnapshot().status).toBe('waiting_browser');
    await controller.handleCallback('weavia://auth/callback?code=one-time&state=expected');
    expect(controller.getSnapshot()).toMatchObject({
      status: 'authenticated',
      user: { email: 'demo@weavia.local' },
      device: { deviceId: 'device-1' },
    });
    expect(api.exchange).toHaveBeenCalledWith('one-time', 'expected', info);
    expect(platform.getDeviceInfo).toHaveBeenCalledOnce();
    expect(await tokens.getRefreshToken()).toBe('refresh');
  });
  it('rejects state mismatch and duplicate callbacks', async () => {
    const { controller } = setup();
    await controller.login();
    await controller.handleCallback('weavia://auth/callback?code=code&state=wrong');
    expect(controller.getSnapshot().error?.code).toBe('INVALID_STATE');
    await controller.login();
    const callback = 'weavia://auth/callback?code=code&state=expected';
    await controller.handleCallback(callback);
    await controller.handleCallback(callback);
    expect(controller.getSnapshot().error?.code).toBe('INVALID_CALLBACK');
  });
  it('single-flights refresh and clears a failed session', async () => {
    let rejectRefresh: (reason: Error) => void = () => undefined;
    const refresh = vi.fn(
      () =>
        new Promise<AuthSessionResult>((_, reject) => {
          rejectRefresh = reject;
        }),
    );
    const { controller, tokens } = setup({ refresh });
    await tokens.setRefreshToken('refresh');
    const first = controller.refreshSession();
    const second = controller.refreshSession();
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledOnce();
    rejectRefresh(new Error('offline'));
    await Promise.all([first, second]);
    expect(await tokens.getRefreshToken()).toBeUndefined();
    expect(controller.getSnapshot().status).toBe('unauthenticated');
  });
  it('restores by rotating tokens and always logs out locally', async () => {
    const { controller, tokens } = setup({
      logout: vi.fn().mockRejectedValue(new Error('offline')),
    });
    await tokens.setRefreshToken('refresh');
    await controller.restoreSession();
    expect(controller.getSnapshot().status).toBe('authenticated');
    expect(await tokens.getRefreshToken()).toBe('new-refresh');
    await controller.logout();
    expect(controller.getSnapshot().status).toBe('unauthenticated');
    expect(await tokens.getRefreshToken()).toBeUndefined();
  });
  it('keeps device identity stable across platform reads', async () => {
    const { platform } = setup();
    expect(await platform.getDeviceInfo()).toEqual(await platform.getDeviceInfo());
  });
  it('accepts a callback after the desktop webview restarts', async () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    });
    try {
      const { controller, api, tokens, platform } = setup();
      await controller.login();
      const restarted = new DesktopAuthController({ api, tokens, platform });
      await restarted.handleCallback('weavia://auth/callback?code=one-time&state=expected');
      expect(restarted.getSnapshot().status).toBe('authenticated');
      expect(values.size).toBe(0);
      controller.cancelLogin();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('clears pending state when the browser login expires', async () => {
    vi.useFakeTimers();
    const { controller } = setup({
      createDesktopSession: vi.fn().mockResolvedValue({
        loginSessionId: 'login',
        state: 'expected',
        loginUrl: 'http://localhost:3000/login?session=login',
        expiresAt: new Date(Date.now() + 10).toISOString(),
      }),
    });
    await controller.login();
    await vi.advanceTimersByTimeAsync(11);
    expect(controller.getSnapshot()).toMatchObject({
      status: 'error',
      error: { code: 'SESSION_EXPIRED' },
    });
    vi.useRealTimers();
  });
});

describe('deep link parser', () => {
  it('parses a valid callback', () =>
    expect(parseAuthCallback('weavia://auth/callback?code=c&state=s')).toEqual({
      code: 'c',
      state: 's',
    }));
  it.each([
    'malformed',
    'https://auth/callback?code=c&state=s',
    'weavia://wrong/callback?code=c&state=s',
    'weavia://auth/callback?state=s',
  ])('rejects invalid callback %s', (value) => expect(() => parseAuthCallback(value)).toThrow());
});
