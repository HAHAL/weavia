import { describe, expect, it } from 'vitest';
import {
  AuthError,
  AuthorizationCodeService,
  DevAuthService,
  MemoryAuthorizationCodeStore,
  isAllowedRedirect,
} from './index';

const device = {
  deviceId: 'stable-device',
  deviceName: 'Test Mac',
  platform: 'macos',
  osVersion: '15',
  appVersion: '0.1.0',
};

describe('authorization codes', () => {
  it('consumes a matching code exactly once', async () => {
    const service = new AuthorizationCodeService(new MemoryAuthorizationCodeStore());
    const { code } = await service.createAuthorizationCode('state', 'user');
    await expect(service.consumeAuthorizationCode(code, 'state')).resolves.toMatchObject({
      userId: 'user',
    });
    await expect(service.consumeAuthorizationCode(code, 'state')).rejects.toMatchObject({
      code: 'AUTH_CODE_USED',
    });
  });
  it('rejects mismatched state', async () => {
    const service = new AuthorizationCodeService(new MemoryAuthorizationCodeStore());
    const { code } = await service.createAuthorizationCode('expected', 'user');
    await expect(service.consumeAuthorizationCode(code, 'wrong')).rejects.toMatchObject({
      code: 'INVALID_STATE',
    });
  });
  it('rejects expired codes', async () => {
    let now = 100;
    const service = new AuthorizationCodeService(new MemoryAuthorizationCodeStore(), () => now, 5);
    const { code } = await service.createAuthorizationCode('state', 'user');
    now = 106;
    await expect(service.consumeAuthorizationCode(code, 'state')).rejects.toMatchObject({
      code: 'AUTH_CODE_EXPIRED',
    });
  });
});

describe('development auth service', () => {
  it('exchanges, registers a stable device, refreshes, and revokes', async () => {
    const service = new DevAuthService();
    const session = service.createDesktopSession();
    const { callbackUrl } = await service.authorizeDemo(session.loginSessionId);
    const callback = new URL(callbackUrl);
    const result = await service.exchange(
      callback.searchParams.get('code')!,
      callback.searchParams.get('state')!,
      device,
    );
    expect(result.user.email).toBe('demo@weavia.local');
    expect(result.device.deviceId).toBe('stable-device');
    const refreshed = service.refresh(result.refreshToken);
    expect(refreshed.accessToken).not.toBe(result.accessToken);
    expect(refreshed.device.deviceId).toBe('stable-device');
    service.logout(refreshed.refreshToken);
    expect(() => service.refresh(refreshed.refreshToken)).toThrowError(AuthError);
  });
  it('rejects malformed redirect URIs', () => {
    expect(isAllowedRedirect('weavia://auth/callback')).toBe(true);
    expect(isAllowedRedirect('https://evil.invalid/callback')).toBe(false);
    expect(() => new DevAuthService().createDesktopSession('not a url')).toThrowError(AuthError);
  });
});
