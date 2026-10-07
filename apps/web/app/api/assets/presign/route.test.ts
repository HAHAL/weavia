import { describe, expect, it } from 'vitest';
import { POST } from './route';
import { PUT } from '../upload/[token]/route';
import { authService } from '../../auth/_service';

describe('POST /api/assets/presign', () => {
  it('requires authentication', async () => {
    const response = await POST(
      new Request('http://localhost/api/assets/presign', {
        method: 'POST',
        body: JSON.stringify({
          assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          contentType: 'image/png',
          size: 3,
        }),
      }),
    );
    expect(response.status).toBe(401);
  });

  it('rejects unsupported MIME before creating an upload URL', async () => {
    const accessToken = await issueAccessToken();
    const response = await POST(
      new Request('http://localhost/api/assets/presign', {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          contentType: 'text/plain',
          size: 3,
        }),
      }),
    );
    expect(response.status).toBe(415);
  });

  it('creates a temporary upload URL and accepts the exact image payload', async () => {
    const accessToken = await issueAccessToken();
    const response = await POST(
      new Request('http://localhost/api/assets/presign', {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          contentType: 'image/png',
          size: 3,
        }),
      }),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data: { uploadUrl: string; objectKey: string } };
    const token = new URL(payload.data.uploadUrl).pathname.split('/').pop()!;
    const upload = await PUT(
      new Request(payload.data.uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': 'image/png' },
        body: new Uint8Array([1, 2, 3]),
      }),
      { params: Promise.resolve({ token }) },
    );
    expect(upload.status).toBe(204);
    expect(payload.data.objectKey).toContain('references/');
  });
});

async function issueAccessToken() {
  const session = authService.createDesktopSession();
  const authorization = await authService.authorizeDemo(session.loginSessionId);
  const callback = new URL(authorization.callbackUrl);
  const issued = await authService.exchange(
    callback.searchParams.get('code')!,
    callback.searchParams.get('state')!,
    {
      deviceId: crypto.randomUUID(),
      deviceName: 'Presign Test',
      platform: 'test',
      osVersion: 'test',
      appVersion: '0.1.0',
    },
  );
  return issued.accessToken;
}
