import { describe, expect, it } from 'vitest';
import { compareVersions, upgradeRequired } from '../src/services/clientConfig';

describe('client upgrade gate', () => {
  it('compares versions numerically', () => {
    expect(compareVersions('0.2.0', '0.10.0')).toBe(-1);
    expect(compareVersions('1.0.0', '1.0')).toBe(0);
    expect(compareVersions('2.0.1', '2.0.0')).toBe(1);
  });

  it('blocks only when below the published minimum', () => {
    expect(upgradeRequired({ minVersion: '0.2.0' }, '0.1.9')).toBe(true);
    expect(upgradeRequired({ minVersion: '0.2.0' }, '0.2.0')).toBe(false);
    expect(upgradeRequired({ minVersion: '' }, '0.0.1')).toBe(false);
    expect(upgradeRequired(null, '0.0.1')).toBe(false);
  });
});
