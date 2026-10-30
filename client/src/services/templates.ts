import type { ShowcaseItem } from '../data/showcase';
import type { Product, Task, Work } from '../types';
import { currentScope, partitionKey } from '../stores/scope';

// A personal template lives on this device under the signed-in account. The
// cover points at the work's asset so no image bytes are duplicated.
export type MyTemplate = ShowcaseItem & { source: 'mine'; assetId?: string; dataUrl?: string; createdAt: string };

const NAME = 'weavia.templates';

export function loadMyTemplates(): MyTemplate[] {
  try {
    const raw = localStorage.getItem(partitionKey(currentScope(), NAME));
    return raw ? JSON.parse(raw) as MyTemplate[] : [];
  } catch {
    return [];
  }
}

function save(items: MyTemplate[]) {
  try { localStorage.setItem(partitionKey(currentScope(), NAME), JSON.stringify(items.slice(0, 200))); } catch { /* storage full or blocked */ }
}

export function saveWorkAsTemplate(work: Work, task: Task | undefined, title: string): MyTemplate {
  const version = work.versions[work.versions.length - 1];
  const item: MyTemplate = {
    id: `mine-${crypto.randomUUID()}`,
    source: 'mine',
    kind: 'work',
    title: title.trim() || work.title,
    tag: work.product?.name ? `我的 · ${work.product.name}` : '我的模板',
    prompt: version?.prompt || task?.prompt || '',
    imageUrl: '',
    assetId: version?.assetId,
    dataUrl: version?.dataUrl,
    media: work.mode === 'video' ? 'video' : 'image',
    model: task?.retry?.modelId,
    ratio: task?.retry?.ratio,
    resolution: task?.retry?.resolution,
    count: task?.retry?.count,
    createdAt: new Date().toISOString(),
  };
  save([item, ...loadMyTemplates()]);
  return item;
}

export function deleteMyTemplate(id: string) {
  save(loadMyTemplates().filter(item => item.id !== id));
}

const PLACEHOLDER = /\{(商品名|商品|SKU|卖点|商品描述)\}/g;

export function hasPlaceholders(prompt: string) {
  return /\{(商品名|商品|SKU|卖点|商品描述)\}/.test(prompt);
}

// Fills {商品名} {SKU} {卖点} {商品描述} from the chosen product; placeholders
// stay visible when no product is selected so the user knows what to pick.
export function fillTemplate(prompt: string, product?: Pick<Product, 'name' | 'sku' | 'description' | 'verifiedFacts'>): string {
  if (!product) return prompt;
  return prompt.replace(PLACEHOLDER, (_, key: string) => {
    if (key === '商品名' || key === '商品') return product.name;
    if (key === 'SKU') return product.sku;
    if (key === '卖点') return (product.verifiedFacts || '').split(/[\n；;]/).map(item => item.trim()).filter(Boolean).slice(0, 3).join('、') || product.description;
    return product.description;
  });
}
