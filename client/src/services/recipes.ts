import { apiRequest } from './api';
import type { ServerTask } from './live';
import { getCachedApps, getCachedSkills } from './sync';

export type SkillInput = { key: string; label: string; type: string; required: boolean };
export type Skill = {
  id: string; name: string; slug: string; category: string; description: string; cover: string;
  manifest: { runtime?: string; promptTemplate?: string; inputs?: SkillInput[]; defaultModel?: string };
  version: number; visibility: string; status: string; sourceUrl: string; license: string; author: string; featured: boolean;
};
export type App = {
  id: string; name: string; slug: string; category: string; description: string; cover: string;
  mediaType: 'image' | 'video'; manifest: { promptTemplate?: string; inputs?: SkillInput[]; model?: string };
  inputSchema: SkillInput[]; examples: string[]; modelHint: string; credits: number; status: string; featured: boolean; sortOrder: number;
};

export async function loadSkills(mine = false) {
  if (!mine) { const cached = getCachedSkills(); if (cached?.length) return cached; }
  const data = await apiRequest<{ items: Skill[] }>(mine ? '/api/my/skills' : '/api/skills', {}, { auth: mine });
  return data.items || [];
}
export async function loadApps() {
  const cached = getCachedApps(); if (cached?.length) return cached;
  const data = await apiRequest<{ items: App[] }>('/api/apps', {}, { auth: false });
  return data.items || [];
}
export async function uploadSkill(body: { name: string; category: string; description: string; manifest: unknown; sourceUrl?: string; license?: string }) {
  return apiRequest<Skill>('/api/skills', { method: 'POST', body: JSON.stringify(body) });
}
export async function runSkill(id: string, inputs: Record<string, string>, modelKey: string, references: unknown[] = [], idempotencyKey = crypto.randomUUID()) {
  return apiRequest<ServerTask>(`/api/skills/${id}/runs`, { method: 'POST', body: JSON.stringify({ inputs, modelKey, referenceAssets: references, idempotencyKey }) });
}
export async function runApp(id: string, inputs: Record<string, string>, references: unknown[] = [], idempotencyKey = crypto.randomUUID()) {
  return apiRequest<ServerTask>(`/api/apps/${id}/runs`, { method: 'POST', body: JSON.stringify({ inputs, referenceAssets: references, idempotencyKey }) });
}
