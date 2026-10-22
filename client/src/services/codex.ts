import { invoke, isTauri } from '@tauri-apps/api/core';

export type CodexStatus = {
  baseUrl: string;
  model: string;
  keyConfigured: boolean;
  engineAvailable: boolean;
};

function desktopOnly() {
  if (!isTauri()) throw new Error('AI 助手仅在 WEAVIA 桌面客户端可用');
}

export async function getCodexStatus(): Promise<CodexStatus> {
  desktopOnly();
  return invoke<CodexStatus>('codex_status');
}

export async function saveCodexSettings(baseUrl: string, model: string, key: string): Promise<CodexStatus> {
  desktopOnly();
  return invoke<CodexStatus>('codex_save_settings', { baseUrl, model, key: key || null });
}

export async function clearCodexKey(): Promise<CodexStatus> {
  desktopOnly();
  return invoke<CodexStatus>('codex_clear_key');
}

export async function importCodexEngine(source: string): Promise<CodexStatus> {
  desktopOnly();
  return invoke<CodexStatus>('codex_import_engine', { source });
}

export async function testCodexConnection(): Promise<string> {
  desktopOnly();
  return invoke<string>('codex_test_connection');
}

export async function planVideoWithCodex(brief: string): Promise<string> {
  desktopOnly();
  return invoke<string>('codex_plan_video', { brief });
}
