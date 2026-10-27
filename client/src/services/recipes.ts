import { apiConfig, apiRequest } from './api';
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
 if(apiConfig.mode==='mock')return mine?[]:[{id:'demo-skill',name:'简洁商品主图',slug:'demo-hero',category:'商品',description:'以商品依据图为基础，建立清晰、简洁的商业主图。演示模板不调用 AI。',cover:'',manifest:{runtime:'prompt',promptTemplate:'为 {{product}} 制作简洁商业主图，保留商品外形、包装和标识。',inputs:[{key:'product',label:'商品描述',type:'text',required:true}]},version:1,visibility:'public',status:'published',sourceUrl:'',license:'',author:'WEAVIA',featured:true}];
  if (!mine) { const cached = getCachedSkills(); if (cached?.length) return cached; }
  const data = await apiRequest<{ items: Skill[] }>(mine ? '/api/my/skills' : '/api/skills', {}, { auth: mine });
  return data.items || [];
}
export async function loadApps() {
 if(apiConfig.mode==='mock')return ['商品主图','场景营销','活动宣传'].map((name,i)=>({id:'demo-'+i,name,slug:'demo-'+i,category:'商品',description:'使用商品依据图制作'+name,cover:'',mediaType:'image' as const,manifest:{promptTemplate:'为 {{product}} 制作'+name+'，保持商品外观准确。'},inputSchema:[{key:'product',label:'商品描述',type:'text',required:true}],examples:[],modelHint:'',credits:0,status:'published',featured:true,sortOrder:i}));
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
