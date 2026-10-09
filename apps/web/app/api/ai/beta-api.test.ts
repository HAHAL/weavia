import { beforeEach, describe, expect, it } from 'vitest';
import { authService } from '../auth/_service';
import { GET as catalog } from './catalog/route';
import { POST as estimate } from './estimate/route';
import { GET as templates } from './templates/route';

let token = '';
beforeEach(async () => {
  const session = authService.createDesktopSession();
  const { callbackUrl } = await authService.authorizeDemo(session.loginSessionId);
  const callback = new URL(callbackUrl);
  token = (
    await authService.exchange(callback.searchParams.get('code')!, callback.searchParams.get('state')!, {
      deviceId: crypto.randomUUID(),
      deviceName: 'Test',
      platform: 'test',
      osVersion: '1',
      appVersion: '1',
    })
  ).accessToken;
});

function request(path: string, init?: RequestInit) {
  return new Request(`http://localhost/api/ai/${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  });
}

describe('Beta AI product APIs', () => {
  it('returns the safe model catalog without provider identity', async () => {
    const body = await catalog(request('catalog')).then((response) => response.json());
    expect(body.data.models).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'qwen-image-2.0', creditsCost: 10 })]),
    );
    expect(JSON.stringify(body.data)).not.toContain('apiKey');
    expect(JSON.stringify(body.data)).not.toContain('baseUrl');
  });

  it('estimates credits and time for one image', async () => {
    const response = await estimate(
      request('estimate', {
        method: 'POST',
        body: JSON.stringify({
          workflow: 'product_image_generation',
          model: 'qwen-image-2.0',
          imageCount: 1,
          advancedSelection: false,
        }),
      }),
    );
    await expect(response.json()).resolves.toMatchObject({
      data: { credits: 10, estimatedTime: 30, model: 'qwen-image-2.0' },
    });
  });

  it('loads commerce prompt templates', async () => {
    const body = await templates(request('templates')).then((response) => response.json());
    expect(body.data).toHaveLength(3);
    expect(body.data[0]).toMatchObject({ category: '女装', scene: '高级品牌广告' });
  });
});
