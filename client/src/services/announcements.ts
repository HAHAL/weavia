import { apiConfig, apiRequest } from './api';

export type Announcement = {
  id: string;
  title: string;
  body: string;
  level: 'info' | 'warning' | 'important';
  pinned: boolean;
  createdAt: string;
};

const READ_KEY = 'weavia.announcements.read';

export async function loadAnnouncements(): Promise<Announcement[]> {
  if (apiConfig.mode !== 'live') return [];
  const data = await apiRequest<{ items: Announcement[] }>('/api/announcements', {}, { auth: false, timeoutMs: 8000 });
  return data.items || [];
}

export function readAnnouncementIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    return new Set(raw ? JSON.parse(raw) as string[] : []);
  } catch {
    return new Set();
  }
}

export function markAnnouncementsRead(ids: string[]) {
  const next = readAnnouncementIds();
  ids.forEach(id => next.add(id));
  try { localStorage.setItem(READ_KEY, JSON.stringify([...next].slice(-200))); } catch { /* per-device convenience only */ }
}
