import { useCallback, useEffect, useState } from 'react';
import { apiConfig } from '../services/api';

export type ServiceHealth = 'checking' | 'ok' | 'down';

// One source of truth for "is the API reachable". Screens used to hardcode
// "connected", which kept claiming success while the service was down.
export function useServiceHealth(pollMs = 30_000) {
  const [health, setHealth] = useState<ServiceHealth>('checking');

  const check = useCallback(async () => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 3_000);
    try {
      const response = await fetch(new URL('/api/readiness', apiConfig.baseUrl + '/'), { signal: controller.signal });
      if (!response.ok) { setHealth('down'); return; }
      const body = await response.json() as { status?: string };
      setHealth(body.status === 'ready' ? 'ok' : 'down');
    } catch {
      setHealth('down');
    } finally {
      window.clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    // Defer the first probe so the effect body does not set state synchronously.
    const kick = window.setTimeout(() => { void check(); }, 0);
    if (!pollMs) return () => window.clearTimeout(kick);
    const id = window.setInterval(() => { void check(); }, pollMs);
    return () => { window.clearTimeout(kick); window.clearInterval(id); };
  }, [check, pollMs]);

  return { health, check };
}
