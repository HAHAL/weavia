import { useEffect, useState } from 'react';
import { Bell, Megaphone, X } from 'lucide-react';
import { Dialog } from './ui';
import { loadAnnouncements, markAnnouncementsRead, readAnnouncementIds, type Announcement } from '../services/announcements';

const REFRESH_MS = 5 * 60 * 1000;
const levelLabel: Record<Announcement['level'], string> = { info: '公告', warning: '提醒', important: '重要' };

function useAnnouncements() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [read, setRead] = useState<Set<string>>(() => readAnnouncementIds());
  useEffect(() => {
    let active = true;
    const load = () => { void loadAnnouncements().then(next => { if (active) setItems(next); }).catch(() => { /* keep last list */ }); };
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  function markRead(ids: string[]) {
    markAnnouncementsRead(ids);
    setRead(readAnnouncementIds());
  }
  return { items, read, markRead };
}

// Sidebar bell plus a banner for the newest unread important/pinned notice.
export function AnnouncementCenter({ collapsed }: { collapsed: boolean }) {
  const { items, read, markRead } = useAnnouncements();
  const [open, setOpen] = useState(false);
  const unread = items.filter(item => !read.has(item.id));
  const banner = unread.find(item => item.pinned || item.level === 'important');
  function openList() {
    setOpen(true);
    markRead(items.map(item => item.id));
  }
  return <>
    <button type="button" className="nav-item announcement-trigger" onClick={openList} aria-label={`公告${unread.length ? `，${unread.length} 条未读` : ''}`} title={collapsed ? '公告' : undefined}>
      <Bell size={18} aria-hidden="true" />{!collapsed && <span>公告</span>}{unread.length > 0 && <b className="announcement-count">{unread.length}</b>}
    </button>
    {banner && !open && <div className={`announcement-banner level-${banner.level}`} role="status">
      <Megaphone size={16} aria-hidden="true" />
      <button type="button" className="announcement-banner-text" onClick={openList}><strong>{banner.title}</strong>{banner.body && <span>{banner.body}</span>}</button>
      <button type="button" className="icon-btn" aria-label="关闭公告" onClick={() => markRead([banner.id])}><X size={16} /></button>
    </div>}
    {open && <Dialog title="公告" onClose={() => setOpen(false)} wide>
      <div className="dialog-content announcement-list">
        {items.length ? items.map(item => <article key={item.id} className={`announcement-item level-${item.level}`}>
          <header><span className="badge">{item.pinned ? '置顶 · ' : ''}{levelLabel[item.level] || '公告'}</span><time>{new Date(item.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</time></header>
          <h3>{item.title}</h3>
          {item.body && <p>{item.body}</p>}
        </article>) : <p className="muted">暂时没有公告。</p>}
      </div>
    </Dialog>}
  </>;
}
