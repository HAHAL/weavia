import { describe, expect, it } from 'vitest';
import { mockWallet } from './index';

describe('credits wallet fixture', () => {
  it('never exposes a negative balance', () => {
    expect(mockWallet.available).toBeGreaterThanOrEqual(0);
    expect(mockWallet.frozen).toBeGreaterThanOrEqual(0);
  });
});
