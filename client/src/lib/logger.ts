import { isTauri } from '@tauri-apps/api/core';
import { info as nativeInfo, warn as nativeWarn, error as nativeError } from '@tauri-apps/plugin-log';
export type LogLevel = 'info' | 'warn' | 'error';
export type LogEntry = { id: string; at: string; level: LogLevel; event: string; detail?: string };
const KEY = 'weavia.logs.v1';
const MAX = 500;
const redact = (value: string) => value.replace(/(Bearer\s+)[^\s]+/gi, '$1[REDACTED]').replace(/(access_token|refresh_token|api_key|password)(["'=:\s]+)[^\s,}]+/gi, '$1$2[REDACTED]');
export function readLogs(): LogEntry[] { try { return JSON.parse(localStorage.getItem(KEY) || '[]') as LogEntry[]; } catch { return []; } }
export function log(level: LogLevel, event: string, detail?: string) {
  const entry: LogEntry = { id: crypto.randomUUID(), at: new Date().toISOString(), level, event, detail: detail ? redact(detail).slice(0, 500) : undefined };
  const next = [entry, ...readLogs()].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(next));
  if (isTauri()) { const payload=JSON.stringify(entry); const write=level==='error'?nativeError:level==='warn'?nativeWarn:nativeInfo; void write(payload).catch(()=>{}); }
  window.dispatchEvent(new Event('weavia:logs'));
}
export function clearLogs() { localStorage.removeItem(KEY); window.dispatchEvent(new Event('weavia:logs')); }
export function exportLogs() { const blob = new Blob([JSON.stringify(readLogs(), null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'weavia-diagnostics.json'; link.click(); URL.revokeObjectURL(url); }
