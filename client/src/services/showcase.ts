import { apiConfig, apiRequest } from './api';
import { getCachedShowcase } from './sync';
import { FALLBACK_SHOWCASE, type ShowcaseItem, type ShowcaseKind } from '../data/showcase';

type ServerShowcaseItem = Omit<ShowcaseItem, 'kind'> & { kind: ShowcaseKind };

function absoluteImageUrl(value: string) {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return apiConfig.baseUrl + (value.startsWith('/') ? value : '/' + value);
}

export async function loadShowcase(): Promise<ShowcaseItem[]> {
  if (apiConfig.mode !== 'live') return FALLBACK_SHOWCASE;
  const cached = getCachedShowcase();
  if (cached?.length) return cached;
  try {
    const data = await apiRequest<{ items: ServerShowcaseItem[] }>('/api/showcase', {}, { auth: false });
    const items = data.items || [];
    if (!items.length) return FALLBACK_SHOWCASE;
    return items.map((item) => ({
      ...item,
      kind: item.kind === 'work' ? 'work' : 'image',
      imageUrl: absoluteImageUrl(item.imageUrl),
    }));
  } catch {
    return FALLBACK_SHOWCASE;
  }
}

// Counts one 一键同款 so operators can rank presets; failures never block the user.
export function recordShowcaseUse(id: string) {
  if (apiConfig.mode !== 'live' || !/^[0-9a-f-]{36}$/i.test(id)) return;
  void apiRequest(`/api/showcase/${id}/use`, { method: 'POST' }).catch(() => { /* best effort */ });
}
