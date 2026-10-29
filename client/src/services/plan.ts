export type PlanPurpose = 'hero' | 'scene' | 'selling_point' | 'detail' | 'usage';

export type PlanItem = {
  id: string;
  purpose: PlanPurpose;
  title: string;
  prompt: string;
  ratio: string;
  size: string;
  credits: number;
};

export const PLAN_PURPOSE_LABELS: Record<PlanPurpose, string> = {
  hero: '主图',
  scene: '场景图',
  selling_point: '卖点图',
  detail: '细节图',
  usage: '使用图',
};

export function planSizeFor(ratio: string): string {
  const sizes: Record<string, string> = {
    '1:1': '1024x1024',
    '4:5': '819x1024',
    '3:4': '768x1024',
    '16:9': '1024x576',
    '9:16': '576x1024',
  };
  return sizes[ratio] || sizes['1:1'];
}

export function defaultPlan(kind: 'set3' | 'set5' | 'set7'): PlanItem[] {
  const entries: Array<Pick<PlanItem, 'id' | 'purpose' | 'title' | 'prompt'>> = [
    { id: 'hero', purpose: 'hero', title: '主图', prompt: '白底正面，突出包装与材质，保持商品外观真实' },
    { id: 'scene', purpose: 'scene', title: '场景图', prompt: '自然光生活场景，突出使用情境' },
    { id: 'selling-point', purpose: 'selling_point', title: '卖点图', prompt: '主视觉 + 3 条卖点排版，文字需可核对' },
    { id: 'detail', purpose: 'detail', title: '细节图', prompt: '材质微距特写' },
    { id: 'usage', purpose: 'usage', title: '使用图', prompt: '手持使用，生活感' },
    { id: 'scene-b', purpose: 'scene', title: '场景图 B', prompt: '自然光生活场景，从另一角度突出使用情境' },
    { id: 'detail-b', purpose: 'detail', title: '细节图 B', prompt: '材质微距特写，展示另一处商品细节' },
  ];
  const count = kind === 'set3' ? 3 : kind === 'set5' ? 5 : 7;
  return entries.slice(0, count).map(item => ({ ...item, ratio: '1:1', size: planSizeFor('1:1'), credits: 0 }));
}
