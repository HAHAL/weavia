import { describe, expect, it } from 'vitest';
import { estimateDemoCredits } from '../src/lib/credits';
import { MODELS } from '../src/types';
describe('demo credit estimate', () => {
  it('scales image cost by output count and high resolution', () => {
    expect(estimateDemoCredits(MODELS[0],'image','1024',1,5)).toBe(8);
    expect(estimateDemoCredits(MODELS[0],'image','2048',2,5)).toBe(32);
  });
  it('scales video cost by duration and resolution', () => {
    expect(estimateDemoCredits(MODELS[2],'video','720',1,5)).toBe(36);
    expect(estimateDemoCredits(MODELS[2],'video','1080',1,10)).toBe(144);
  });
});
