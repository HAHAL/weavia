import { describe, expect, it } from 'vitest';
import { fillTemplate, hasPlaceholders } from '../src/services/templates';

describe('template variables', () => {
  const product = { name: '琥珀香水', sku: 'P-001', description: '50ml 玻璃瓶', verifiedFacts: '琥珀色玻璃\n金色瓶盖\n容量 50ml\n法国调香' };

  it('replaces product placeholders', () => {
    const out = fillTemplate('把{商品名}放在台面上，突出{卖点}，SKU {SKU}', product);
    expect(out).toBe('把琥珀香水放在台面上，突出琥珀色玻璃、金色瓶盖、容量 50ml，SKU P-001');
    expect(hasPlaceholders(out)).toBe(false);
  });

  it('keeps placeholders when no product is selected', () => {
    expect(fillTemplate('{商品名} 主图')).toBe('{商品名} 主图');
    expect(hasPlaceholders('{商品名} 主图')).toBe(true);
  });
});
