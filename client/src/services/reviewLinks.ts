import { apiRequest } from './api';
import { useApp } from '../stores/app';
import { latestVersion, withReview } from '../lib/review';
import type { Work } from '../types';

export type ReviewDecision = { itemKey: string; decision: 'approved' | 'changes'; note: string; reviewer: string; updatedAt: string };
export type ReviewLink = { id: string; title: string; status: 'active' | 'revoked'; expiresAt: string; createdAt: string; items: Array<{ key: string; title: string }>; decisions: ReviewDecision[] };

const URL_KEY = 'weavia.reviewLinkUrls';

function savedUrls(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(URL_KEY) || '{}') as Record<string, string>; } catch { return {}; }
}

export function reviewLinkUrl(id: string): string | undefined {
  return savedUrls()[id];
}

// The customer sees the version that is current now; its source task output
// identifies it on the server. Local-only edits have no cloud copy to share.
export function reviewItemOf(work: Work) {
  const version = latestVersion(work);
  const taskId = version?.taskId || work.taskId;
  const outputIndex = version?.taskId ? version.outputIndex ?? 0 : work.outputIndex ?? 0;
  if (work.source !== 'live' || !taskId || taskId === 'local-edit') return null;
  return { taskId, outputIndex, title: work.title };
}

export async function createReviewLink(title: string, works: Work[], days = 7) {
  const items = works.map(reviewItemOf).filter((item): item is NonNullable<ReturnType<typeof reviewItemOf>> => Boolean(item));
  if (!items.length) throw new Error('这些作品没有云端结果，无法生成审阅链接');
  const data = await apiRequest<{ link: ReviewLink; url: string }>('/api/review-links', { method: 'POST', body: JSON.stringify({ title, items, days }) });
  try { localStorage.setItem(URL_KEY, JSON.stringify({ ...savedUrls(), [data.link.id]: data.url })); } catch { /* the link still works; only re-copying needs it */ }
  return { ...data, skipped: works.length - items.length };
}

export async function listReviewLinks() {
  const data = await apiRequest<{ items: ReviewLink[] }>('/api/review-links');
  return data.items || [];
}

export async function revokeReviewLink(id: string) {
  await apiRequest(`/api/review-links/${id}`, { method: 'DELETE' });
}

// Applies the customer's newest decisions to the matching work versions. A
// later internal review wins over an older customer decision.
export function applyCustomerDecisions(links: ReviewLink[]): number {
  const decisions = new Map<string, ReviewDecision>();
  for (const link of links) for (const decision of link.decisions) {
    const current = decisions.get(decision.itemKey);
    if (!current || current.updatedAt < decision.updatedAt) decisions.set(decision.itemKey, decision);
  }
  let changed = 0;
  for (const work of useApp.getState().works) {
    const item = reviewItemOf(work);
    if (!item) continue;
    const decision = decisions.get(`${item.taskId}:${item.outputIndex}`);
    const version = latestVersion(work);
    if (!decision || !version || version.customer?.at === decision.updatedAt) continue;
    if (version.reviewedAt && version.reviewedAt > decision.updatedAt) continue;
    const reviewed = withReview(work, decision.decision === 'approved' ? 'approved' : 'changes_needed', decision.note ? `客户：${decision.note}` : undefined);
    const versions = reviewed.versions.map((entry, index) => index === reviewed.versions.length - 1 ? { ...entry, reviewedAt: decision.updatedAt, customer: { decision: decision.decision, note: decision.note, reviewer: decision.reviewer, at: decision.updatedAt } } : entry);
    useApp.getState().updateWork({ ...reviewed, versions });
    changed += 1;
  }
  return changed;
}
