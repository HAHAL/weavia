import { describe, expect, it } from 'vitest';
import { DevAuthService } from '@weavia/auth-core';
import { authenticatedUser } from './_auth';
import { authService } from '../auth/_service';

describe('Cloud AI auth middleware', () => {
  it('rejects an unauthenticated task request', () => {
    expect(() => authenticatedUser(new Request('http://localhost/api/ai/tasks'))).toThrowError();
  });

  it('accepts an existing WEAVIA access token', async () => {
    const session = authService.createDesktopSession();
    const authorization = await authService.authorizeDemo(session.loginSessionId);
    const callback = new URL(authorization.callbackUrl);
    const issued = await authService.exchange(
      callback.searchParams.get('code')!,
      callback.searchParams.get('state')!,
      {
        deviceId: 'ai-test-device',
        deviceName: 'AI Test',
        platform: 'test',
        osVersion: 'test',
        appVersion: '0.1.0',
      },
    );
    const request = new Request('http://localhost/api/ai/tasks', {
      headers: { authorization: `Bearer ${issued.accessToken}` },
    });
    expect(authenticatedUser(request).id).toBe(issued.user.id);
  });

  it('does not accept a token from another auth repository', async () => {
    const isolated = new DevAuthService();
    const session = isolated.createDesktopSession();
    const authorization = await isolated.authorizeDemo(session.loginSessionId);
    const callback = new URL(authorization.callbackUrl);
    const issued = await isolated.exchange(
      callback.searchParams.get('code')!,
      callback.searchParams.get('state')!,
      {
        deviceId: 'isolated',
        deviceName: 'Isolated',
        platform: 'test',
        osVersion: 'test',
        appVersion: '0.1.0',
      },
    );
    expect(() =>
      authenticatedUser(
        new Request('http://localhost/api/ai/tasks', {
          headers: { authorization: `Bearer ${issued.accessToken}` },
        }),
      ),
    ).toThrowError();
  });
});
