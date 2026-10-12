import {
  Archive,
  FolderKanban,
  History,
  Home,
  Image,
  Settings,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Badge } from '@weavia/ui';
import { useAuthStore } from '../stores/auth';
import { useAccountSummary } from '../services/account-summary';
const primary = [
  [Home, '首页', '/'],
  [FolderKanban, '项目', '/projects'],
  [Sparkles, '创建任务', '/create'],
  [Archive, '任务中心', '/tasks'],
  [Image, '素材库', '/assets'],
  [History, '作品中心', '/results'],
] as const;
export function AppShell() {
  const location = useLocation();
  const auth = useAuthStore();
  const { summary } = useAccountSummary();
  const title =
    primary.find(([, , href]) => href === location.pathname)?.[1] ??
    (location.pathname === '/settings'
      ? '设置'
      : location.pathname === '/account'
        ? '账户'
        : '织维');
  const initials =
    auth.user?.name
      ?.split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2) ?? 'W';
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink to="/" className="brand">
          <span className="brand-symbol">W</span>
          <span>
            <strong>WEAVIA</strong>
            <small>织维</small>
          </span>
        </NavLink>
        <nav>
          {primary.map(([Icon, label, href]) => (
            <NavLink key={href} to={href} end={href === '/'}>
              <Icon size={17} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <NavLink to="/account">
            <UserRound size={17} />
            <span>{auth.status === 'authenticated' ? '我的账户' : '登录账户'}</span>
          </NavLink>
          <NavLink to="/settings">
            <Settings size={17} />
            <span>设置</span>
          </NavLink>
          <div className="plan-card">
            <div>
              <Badge tone="accent">{summary?.planCode?.toUpperCase() ?? 'WEAVIA'}</Badge>
              <span>{summary ? `${summary.credits.toLocaleString('zh-CN')} Credits` : '— Credits'}</span>
            </div>
            <small>
              {auth.status === 'authenticated' ? auth.user?.email : '登录后同步会员状态'}
            </small>
          </div>
        </div>
      </aside>
      <main className="app-main">
        <header className="topbar">
          <div>
            <small>2026 秋季女装</small>
            <strong>{title}</strong>
          </div>
          <div className="top-actions">
            <span className="sync-dot" />
            本地工作区 <Badge tone="accent">{summary ? summary.planName : 'WEAVIA'}</Badge>
            <NavLink to="/account" className="avatar">
              {initials}
            </NavLink>
          </div>
        </header>
        <section className="page">
          <Outlet />
        </section>
      </main>
    </div>
  );
}
