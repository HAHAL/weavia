import { describe, expect, it } from 'vitest';
import { defaultCatalog, sanitizedAdminSnapshot } from './runtime';
import { GET as health } from '../../app/api/health/route';

describe('AI admin configuration', () => {
  it('exposes provider, model and routing data without secret material', () => {
    const snapshot = sanitizedAdminSnapshot();
    expect(snapshot.providers[0]).toMatchObject({ code: 'antdigital' });
    expect(snapshot.models[0]).toMatchObject({ modelId: 'qwen-image-3.0-pro' });
    expect(snapshot.logicalModels[0]).toMatchObject({ key: 'weavia-image-pro' });
    expect(JSON.stringify(snapshot)).not.toContain('ANTDIGITAL_API_KEY');
    expect(snapshot.providers[0]).not.toHaveProperty('apiKey');
  });

  it('marks missing server secret as not configured', () => {
    expect(defaultCatalog.providers[0]?.configured).toBe(false);
  });

  it('returns readiness without exposing server secrets', async () => {
    const body = await health().json();
    expect(body).toMatchObject({ service: 'weavia-cloud-api', status: 'ok' });
    expect(JSON.stringify(body)).not.toContain('apiKey');
    expect(JSON.stringify(body)).not.toContain('Bearer');
  });
});
