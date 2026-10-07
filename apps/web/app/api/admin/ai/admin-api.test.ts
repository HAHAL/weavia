import { describe, expect, it } from 'vitest';
import { GET as providers } from './providers/route';
import { GET as routing } from './routing/route';

describe('AI admin APIs', () => {
  it('returns sanitized providers', async () => {
    const response = await providers();
    const body = (await response.json()) as { data: Array<Record<string, unknown>> };
    expect(body.data[0]).toMatchObject({ code: 'antdigital' });
    expect(body.data[0]).not.toHaveProperty('apiKey');
  });

  it('returns logical model bindings', async () => {
    const response = await routing();
    const body = (await response.json()) as {
      data: { logicalModels: unknown[]; bindings: unknown[] };
    };
    expect(body.data.logicalModels).toHaveLength(1);
    expect(body.data.bindings).toHaveLength(2);
  });
});
