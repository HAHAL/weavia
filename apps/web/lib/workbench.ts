export type User = { id: string; name?: string; email: string };
export type Membership = { status: string; currentPeriodEnd?: string; plan: { name: string; code: string } };
export type Credits = { available: number; currency: string };
export type Workspace = { id: string; name: string; createdAt: string };
export type Project = { id: string; workspaceId: string; name: string; description?: string; createdAt: string; updatedAt: string; productCount: number; imageCount: number; videoCount: number };
export type Asset = { id: string; projectId: string; taskId?: string; kind: string; mimeType: string; createdAt: string; objectKey?: string };
export type Transaction = { id: string; type: string; availableDelta: number; createdAt: string; metadata?: Record<string, unknown> };
export type Task = { id: string; workflow: string; status: string; createdAt: string; outputs: { base64Data?: string; temporaryUrl?: string; mimeType: string }[] };
export type Catalog = { models: { id: string; creditsCost: number; enabled: boolean; capabilities: string[] }[] };
export function generationCost(catalog: Catalog | undefined, capability: string) {
  const costs = catalog?.models.filter((model) => model.enabled && model.capabilities.includes(capability) && model.creditsCost > 0).map((model) => model.creditsCost) ?? [];
  return costs.length ? Math.min(...costs) : undefined;
}

export async function apiGet<T>(path: string): Promise<T> {
  const token = localStorage.getItem('weavia.accessToken');
  if (!token) throw new Error('请先登录，以查看你的创作工作台。');
  const response = await fetch(`/api${path}`, { headers: { authorization: `Bearer ${token}` } });
  const body = await response.json() as { data?: T; message?: string };
  if (!response.ok || body.data === undefined) throw new Error(body.message ?? '加载失败，请稍后重试。');
  return body.data;
}

export async function apiPost<T>(path: string, data: unknown): Promise<T> {
  const token = localStorage.getItem('weavia.accessToken');
  if (!token) throw new Error('请先登录。');
  const response = await fetch(`/api${path}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(data) });
  const body = await response.json() as { data?: T; message?: string };
  if (!response.ok || body.data === undefined) throw new Error(body.message ?? '操作失败，请稍后重试。');
  return body.data;
}

export const formatNumber = (value: number) => new Intl.NumberFormat('zh-CN').format(value);
export const formatDate = (value: string) => new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
export function planName(membership?: Membership) {
  if (!membership) return '—';
  const code = membership?.plan.code?.toLowerCase();
  return code === 'studio' ? 'Studio' : code === 'pro' ? 'Pro' : 'Free';
}
export function transactionName(item: Transaction) {
  const type = item.type.toLowerCase();
  if (type.includes('topup') || type.includes('grant') || type.includes('adjust')) return '额度到账';
  if (type.includes('refund') || type.includes('release')) return '额度返还';
  const workflow = String(item.metadata?.workflow ?? '').toLowerCase();
  if (workflow.includes('video')) return 'AI 视频生成';
  if (workflow.includes('model')) return 'AI 模特生成';
  if (workflow.includes('tryon') || workflow.includes('try_on')) return 'AI 换衣生成';
  return 'AI 图片生成';
}
