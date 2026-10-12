'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  Bell,
  Blocks,
  ChevronDown,
  CircleHelp,
  Command,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings2,
  Sparkles,
  Users,
  WandSparkles,
  X,
} from 'lucide-react';
import { useState } from 'react';

const navigation = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/users', label: '用户中心', icon: Users },
  { href: '/business', label: '商业中心', icon: CreditCard },
  { href: '/ai-studio', label: 'AI Studio', icon: Sparkles },
  { href: '/tasks', label: '创作任务', icon: WandSparkles },
  { href: '/analytics', label: '数据分析', icon: Activity },
  { href: '/settings', label: '系统设置', icon: Settings2 },
] as const;

const legacySections: Record<string, string> = {
  '/memberships': '/users',
  '/credits': '/users',
  '/devices': '/users',
  '/providers': '/ai-studio',
  '/models': '/ai-studio',
  '/routing': '/ai-studio',
  '/usage': '/analytics',
};

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  if (pathname === '/login') return <>{children}</>;
  const current =
    navigation.find(
      (item) =>
        pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`)),
    ) ??
    navigation.find((item) => item.href === legacySections[pathname]) ??
    navigation[0];
  async function signOut() {
    await fetch('/api/admin-session', { method: 'DELETE' });
    router.replace('/login');
    router.refresh();
  }
  return (
    <div className="admin-app">
      <aside className={`admin-sidebar ${mobileOpen ? 'is-open' : ''}`}>
        <div className="sidebar-brand">
          <Link href="/" onClick={() => setMobileOpen(false)} aria-label="WEAVIA Admin 首页">
            <span className="brand-mark">
              <Blocks size={18} strokeWidth={2.3} />
            </span>
            <span className="brand-word">
              WEAVIA<span className="brand-dot">.</span>
              <small>ADMIN CONSOLE</small>
            </span>
          </Link>
          <button
            className="mobile-close icon-button"
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="关闭菜单"
          >
            <X size={18} />
          </button>
        </div>
        <div className="workspace-switch">
          <span className="workspace-avatar">W</span>
          <span>
            <strong>WEAVIA Workspace</strong>
            <small>运营工作区</small>
          </span>
          <ChevronDown size={14} />
        </div>
        <div className="nav-label">工作台</div>
        <nav aria-label="主导航" className="sidebar-nav">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={current.href === item.href ? 'active' : ''}
              >
                <Icon size={18} strokeWidth={1.9} />
                <span>{item.label}</span>
                {current.href === item.href && <span className="nav-current" />}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-divider" />
          <a href="mailto:support@weavia.ai" className="sidebar-help">
            <CircleHelp size={17} /> 帮助与支持
          </a>
          <button type="button" className="sidebar-account" onClick={signOut} title="退出登录">
            <span className="account-avatar">A</span>
            <span>
              <strong>管理员</strong>
              <small>管理账户</small>
            </span>
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      {mobileOpen && (
        <button
          className="mobile-scrim"
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="关闭菜单"
        />
      )}
      <div className="admin-main">
        <header className="admin-topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu icon-button"
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="打开菜单"
            >
              <Menu size={20} />
            </button>
            <span className="topbar-breadcrumb">WEAVIA</span>
            <span className="breadcrumb-separator">/</span>
            <strong>{current.label}</strong>
          </div>
          <div className="topbar-actions">
            <button type="button" className="topbar-search" onClick={() => setSearchOpen(true)}>
              <Search size={16} />
              <span>搜索页面</span>
              <kbd>⌘ K</kbd>
            </button>
            <button
              type="button"
              className="icon-button topbar-notification"
              aria-label="通知"
              title="暂无通知"
            >
              <Bell size={18} />
            </button>
            <span className="topbar-avatar">A</span>
          </div>
        </header>
        <main className="admin-content">{children}</main>
      </div>
      {searchOpen && (
        <div
          className="command-overlay"
          role="presentation"
          onMouseDown={() => setSearchOpen(false)}
        >
          <div
            className="command-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="搜索页面"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="command-search">
              <Search size={19} />
              <input
                autoFocus
                placeholder="搜索页面..."
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setSearchOpen(false);
                }}
              />
              <button
                className="icon-button"
                type="button"
                onClick={() => setSearchOpen(false)}
                aria-label="关闭搜索"
              >
                <X size={18} />
              </button>
            </div>
            <div className="command-label">快速前往</div>
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  href={item.href}
                  key={item.href}
                  onClick={() => setSearchOpen(false)}
                  className="command-link"
                >
                  <Icon size={17} />
                  {item.label}
                  <Command size={13} />
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
