import type { Mode, Model } from '../types';
/** UI-only estimate. The server ledger is authoritative. */
export function estimateDemoCredits(model: Model, mode: Mode, resolution: string, count: number, duration: number) {
  const sizeFactor = resolution === '2048' || resolution === '1080' ? 2 : 1;
  const durationFactor = mode === 'video' && duration === 10 ? 2 : 1;
  return model.creditBase * count * sizeFactor * durationFactor;
}
