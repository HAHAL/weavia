import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Home, Package, Images, GalleryHorizontal, ListTodo, WandSparkles, Clapperboard, Workflow, Boxes, LayoutGrid, PanelLeftClose, PanelLeftOpen, Search, ChevronDown, FileArchive } from 'lucide-react';
import { useApp } from '../../stores/app';
import { Avatar } from '../Avatar';
import { apiConfig, apiRequest } from '../../services/api';
import { useAuth } from '../../stores/auth';
import { log } from '../../lib/logger';
import { startupSync } from '../../services/sync';
import { APP_VERSION } from '../../services/clientConfig';
import { Dialog } from '../ui';
import { AnnouncementCenter } from '../Announcements';

const primaryNav = [
  { to: '/', label: '首页', icon: Home },
  { to: '/products', label: '商品', icon: Package },
  { to: '/delivery', label: '交付', icon: FileArchive },
  { to: '/works', label: '作品', icon: GalleryHorizontal },
  { to: '/tasks', label: '任务', icon: ListTodo },
];
const secondaryNav = [{ to: '/assets', label: '素材中心', icon: Images }];
const capabilityNav = [{ to: '/skills', label: 'Skill 模板', icon: Boxes }, { to: '/applications', label: 'AI 应用', icon: LayoutGrid }];
// Video and the DAG workflow stay out of the menu until they pass acceptance;
// their routes still exist for internal testing.
const videoEnabled = import.meta.env.VITE_ENABLE_VIDEO === 'true';
const toolNav = [
  { to: '/image-editing', label: '图片编辑', icon: WandSparkles },
  ...(videoEnabled ? [{ to: '/video-studio', label: '视频工作台', icon: Clapperboard }, { to: '/workflow', label: '工作流', icon: Workflow }] : []),
];

export function AppLayout() {
  const { collapsed, setCollapsed, theme, toast, notify, products, works } = useApp();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(() => toolNav.some(item => window.location.pathname === item.to));
  const user = useAuth(state => state.user);
  const [creditState, setCreditState] = useState<{ userId: string; available: number } | null>(null);
  const [creditsVersion, setCreditsVersion] = useState(0);
  const [query, setQuery] = useState('');
  const searchTerm = query.trim().toLocaleLowerCase();
  const searchResults = searchTerm ? [
    ...products.filter(item => `${item.name} ${item.sku} ${item.description}`.toLocaleLowerCase().includes(searchTerm)).map(item => ({ id: `product-${item.id}`, type: '商品', label: item.name, detail: item.sku, to: '/products' })),
    ...works.filter(item => item.title.toLocaleLowerCase().includes(searchTerm)).map(item => ({ id: `work-${item.id}`, type: '作品', label: item.title, detail: '本地作品', to: '/works' })),
  ] : [];
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { if (!user?.id) return; void startupSync(user.id).catch(() => { /* cached data remains available */ }); }, [user?.id]);
  useEffect(() => { const current = user; if (!current) return; let active = true; apiRequest<{ available: number }>('/api/credits').then(data => { if (active) setCreditState({ userId: current.id, available: data.available }); }).catch(() => { /* keep the last known balance */ }); return () => { active = false; }; }, [user, creditsVersion]);
  useEffect(() => { const refresh = () => setCreditsVersion(value => value + 1); window.addEventListener('weavia:credits', refresh); return () => window.removeEventListener('weavia:credits', refresh); }, []);
  const credits = user && creditState?.userId === user.id ? creditState.available : null;
  useEffect(() => { log('info', 'client.started', `v${APP_VERSION} ${apiConfig.mode}`); const onError = () => log('error', 'frontend.exception'); window.addEventListener('error', onError); return () => { window.removeEventListener('error', onError); log('info', 'client.exit'); }; }, []);
  useEffect(() => { if (!toast) return; const id = window.setTimeout(() => notify(''), 3500); return () => clearTimeout(id); }, [toast, notify]);
  function openSearch() { setQuery(''); setSearchOpen(true); }
  function selectResult(to: string) { setSearchOpen(false); navigate(to); }
  return <div className={`app-shell ${collapsed ? 'is-collapsed' : ''}`}>
    <a className="skip-link" href="#main">跳转到内容</a>
    <aside className="sidebar" aria-label="主导航">
      <div className="brand"><img className="brand-mark" src="/brand/weavia-icon.png" alt="WEAVIA" />{!collapsed && <span className="brand-label"><img className="brand-wordmark" src="/brand/weavia-wordmark.png" alt="" /><small>AI Commerce Studio</small></span>}<button className="icon-btn sidebar-toggle" title={collapsed ? '展开侧栏' : '收起侧栏'} aria-label={collapsed ? '展开侧栏' : '收起侧栏'} onClick={() => setCollapsed(!collapsed)}>{collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button></div>
      <nav className="nav-list" aria-label="工作区">
        <button type="button" className="nav-item nav-search" onClick={openSearch} aria-label="搜索商品或作品" title={collapsed ? '搜索' : undefined}><Search size={18} aria-hidden="true" />{!collapsed && <span>搜索</span>}</button>
        <AnnouncementCenter collapsed={collapsed} />
        {!collapsed && <div className="nav-section-label">工作区</div>}
        {primaryNav.map(item => <NavLink key={item.to} to={item.to} end={item.to === '/'} title={collapsed ? item.label : undefined} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><item.icon size={18} aria-hidden="true" />{!collapsed && <span>{item.label}</span>}</NavLink>)}
        {secondaryNav.map(item => <NavLink key={item.to} to={item.to} title={collapsed ? item.label : undefined} className={({ isActive }) => `nav-item nav-group-start ${isActive ? 'active' : ''}`}><item.icon size={18} aria-hidden="true" />{!collapsed && <span>{item.label}</span>}</NavLink>)}
        {!collapsed && <div className="nav-section-label nav-section-label-spaced">模板</div>}
        {capabilityNav.map(item => <NavLink key={item.to} to={item.to} title={collapsed ? item.label : undefined} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><item.icon size={18} aria-hidden="true" />{!collapsed && <span>{item.label}</span>}</NavLink>)}
        <button type="button" className={`nav-item nav-group-start tool-toggle ${toolsOpen && !collapsed ? 'expanded' : ''}`} aria-expanded={toolsOpen && !collapsed} aria-controls="creative-tools" aria-label="创作工具" title={collapsed ? '创作工具' : undefined} onClick={() => { if (collapsed) { setCollapsed(false); setToolsOpen(true); } else setToolsOpen(!toolsOpen); }}><WandSparkles size={18} aria-hidden="true" />{!collapsed && <><span>创作工具</span><ChevronDown size={15} className="tool-chevron" aria-hidden="true" /></>}</button>
        {toolsOpen && !collapsed && <div id="creative-tools" className="tool-links">{toolNav.map(item => <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><item.icon size={17} aria-hidden="true" /><span>{item.label}</span></NavLink>)}</div>}
      </nav>
      <div className="sidebar-footer"><NavLink to={user ? '/account' : '/login'} className={({ isActive }) => `account-mini ${isActive ? 'active' : ''}`} title={collapsed ? '账户与设置' : undefined} aria-label="账户与设置"><Avatar size={30} />{!collapsed && <span><b>{user ? user.email : '登录'}</b><small>{user ? `已连接 · ${credits ?? '…'} Credits` : apiConfig.mode === 'live' ? '未登录 · 请登录' : '访客 · 演示模式'}</small></span>}</NavLink>{user && !collapsed && <button className="text-link" type="button" onClick={() => void useAuth.getState().logout()}>退出登录</button>}</div>
    </aside>
    <div className="app-body"><main id="main"><Outlet /></main></div>
    {searchOpen && <Dialog title="搜索工作区" onClose={() => setSearchOpen(false)} wide><div className="dialog-content"><label className="search-box global-search"><Search size={18} aria-hidden="true" /><input autoFocus aria-label="搜索商品或作品" placeholder="输入商品名称、SKU 或作品" value={query} onChange={event => setQuery(event.target.value)} /></label><div className="global-results" aria-live="polite">{!searchTerm ? <p className="search-hint">搜索本地商品和作品。</p> : searchResults.length ? searchResults.map(result => <button type="button" key={result.id} className="global-result" onClick={() => selectResult(result.to)}><span className="result-type">{result.type}</span><strong>{result.label}</strong><small>{result.detail}</small></button>) : <p className="search-hint">没有匹配结果，试试其他关键词。</p>}</div></div></Dialog>}
    {toast && <div role="status" className="toast">{toast}</div>}
  </div>;
}
