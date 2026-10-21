import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Trash2, Search, ShieldCheck, Coins, Crown, Receipt, UserRound, Settings, ScrollText, HardDrive, Cloud } from 'lucide-react';
import { Badge, Button, Card, Dialog, StatePanel } from '../components/ui';
import { useApp } from '../stores/app';
import { useAuth } from '../stores/auth';
import { clearLogs, exportLogs, readLogs, type LogEntry } from '../lib/logger';
import { apiConfig, apiRequest } from '../services/api';
import { AvatarPicker } from '../components/AvatarPicker';

const accountSections = [
  { id: 'overview', label: '账户概览', icon: UserRound, group: 'account' },
  { id: 'subscription', label: '会员套餐', icon: Crown, group: 'account' },
  { id: 'credits', label: 'Credits 明细', icon: Coins, group: 'account' },
  { id: 'orders', label: '订单记录', icon: Receipt, group: 'account' },
  { id: 'security', label: '登录与安全', icon: ShieldCheck, group: 'account' },
  { id: 'storage', label: '存储与备份', icon: HardDrive, group: 'account' },
  { id: 'settings', label: '偏好设置', icon: Settings, group: 'app' },
  { id: 'diagnostics', label: '日志与诊断', icon: ScrollText, group: 'app' },
] as const;
type AccountSection = typeof accountSections[number]['id'];

function useSection<T extends string>(valid: readonly T[], fallback: T) {
  const [params, setParams] = useSearchParams();
  const requested = params.get('section') as T;
  const section = valid.includes(requested) ? requested : fallback;
  const select = (next: T) => setParams(next === fallback ? {} : { section: next });
  return [section, select] as const;
}

function EmptyService({ title, detail }: { title: string; detail: string }) {
  return <Card className="service-state"><Badge>待接入服务端</Badge><StatePanel type="empty" title={title} detail={detail} /></Card>;
}

export function AccountPage() {
  const [section, select] = useSection<AccountSection>(accountSections.map(item => item.id), 'overview');
  const active = accountSections.find(item => item.id === section)!;
  const navigate = useNavigate();
  const auth = useAuth();
  const [accountState, setAccountState] = useState<{ userId: string; available: number; reserved: number } | null>(null);
  useEffect(() => { const user = auth.user; if (!user) return; let active = true; apiRequest<{ available: number; reserved: number }>('/api/credits').then(data => { if (active) setAccountState({ userId: user.id, ...data }); }).catch(() => { /* keep the last known balance */ }); return () => { active = false; }; }, [auth.user]);
  const account = auth.user && accountState?.userId === auth.user.id ? accountState : null;
  return <div className="page account-page">
    <div className="page-header"><div><h1>账户与设置</h1><p>管理账户信息和客户端偏好。</p></div><Badge>{auth.user ? '已连接云端' : '演示模式 · 未登录'}</Badge></div>
    <div className="account-layout"><nav className="account-section-nav" aria-label="账户与设置分区">{(['account', 'app'] as const).map(group => <div className="account-nav-group" key={group}><h2>{group === 'account' ? '账户' : '应用设置'}</h2>{accountSections.filter(item => item.group === group).map(item => <button type="button" key={item.id} className={section === item.id ? 'selected' : ''} aria-current={section === item.id ? 'page' : undefined} onClick={() => select(item.id)}><item.icon size={17} aria-hidden="true" />{item.label}</button>)}</div>)}</nav>
    <section className="section-content" aria-label={active.label}>
      {section === 'overview' && (auth.user ? <><AvatarPicker /><Card className="settings-card"><h2>已连接云端</h2><p>{auth.user.email}</p><p className="muted">Credits 余额：{account ? account.available : '读取中…'}{account ? ` · 冻结 ${account.reserved}` : ''}</p><div className="header-actions"><Button onClick={() => select('credits')}>查看明细</Button><Button variant="secondary" onClick={() => void auth.logout()}>退出登录</Button></div></Card><Card className="settings-card"><h2>账户 ID</h2><p className="muted">{auth.user.id}</p></Card></> : <><Card className="settings-card"><h2>访客工作区</h2><p>当前为演示模式，尚未连接真实账户。登录后可读取真实余额和任务。</p><div className="header-actions"><Button onClick={() => navigate('/login')}>登录</Button></div></Card><EmptyService title="尚无真实账户数据" detail="登录后这里会显示真实余额、任务和订单。" /></>)}
      {section === 'subscription' && <><h2>会员套餐</h2><EmptyService title="会员信息待接入" detail="订阅状态、套餐权益和续费信息需要从服务端读取。" /></>}
      {section === 'credits' && <><h2>Credits 明细</h2>{auth.user ? <Card className="settings-card"><h2>当前余额</h2><p><b>{account ? account.available : '读取中…'}</b> Credits · 冻结 {account?.reserved ?? 0}</p><p className="muted">每次生成先预占，成功后确认扣费，失败自动释放。</p></Card> : <Card className="settings-card"><h2>登录后查看</h2><p>真实余额与流水以服务端账本为准。</p><Button onClick={() => navigate('/login')}>登录</Button></Card>}</>}
      {section === 'orders' && <><h2>订单记录</h2><EmptyService title="暂无真实订单" detail="支付尚未接入，演示模式不会生成真实订单。" /></>}
      {section === 'security' && <><h2>登录与安全</h2><Card className="settings-card"><h2>认证与设备</h2><p>登录、设备管理和安全设置需要服务端支持。</p></Card><Card className="settings-card"><h2>注销申请</h2><p>身份验证和注销申请接口接入后可在这里提交申请。</p><Button disabled>申请注销 · 待接入</Button></Card></>}
      {section === 'storage' && <StorageSettings />}
      {section === 'settings' && <GeneralSettings />}
      {section === 'diagnostics' && <DiagnosticsSection />}
    </section></div>
  </div>;
}

function StorageSettings() {
  const { assets, notify } = useApp();
  const [mode, setMode] = useState(() => localStorage.getItem('weavia.storage.mode') || 'local');
  const bytes = assets.reduce((sum, asset) => sum + (asset.size || 0), 0);
  const size = bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(0, Math.ceil(bytes / 1024))} KB`;
  function choose(next: string) {
    if (next === 'cloud') { notify('云端 OSS 存储为专业版功能，开通后启用'); return; }
    localStorage.setItem('weavia.storage.mode', next); setMode(next); notify('已切换到本地存储');
  }
  return <><h2>存储与备份</h2><Card className="settings-card"><div className="storage-heading"><div><h2>素材存储</h2><p className="muted">默认保存在本机，只有开通 OSS 后才会跨设备同步。</p></div><Badge>{mode === 'cloud' ? 'OSS 专业版' : '本地存储'}</Badge></div><div className="storage-stats"><div><small>素材数量</small><strong>{assets.length}</strong></div><div><small>占用空间</small><strong>{size}</strong></div><div><small>同步范围</small><strong>{mode === 'cloud' ? '云端' : '仅本机'}</strong></div></div><div className="storage-options"><button type="button" className={`storage-option ${mode === 'local' ? 'selected' : ''}`} onClick={() => choose('local')}><HardDrive size={20} /><span><strong>本地存储</strong><small>免费 · 素材只在本机可见</small></span>{mode === 'local' && <Badge>当前</Badge>}</button><button type="button" className={`storage-option ${mode === 'cloud' ? 'selected' : ''}`} onClick={() => choose('cloud')}><Cloud size={20} /><span><strong>云端 OSS</strong><small>专业版 · 跨设备同步、云端备份</small></span><Badge>付费</Badge></button></div></Card><Card className="settings-card"><h2>OSS 开通</h2><p>云端存储按套餐提供，开通后新上传素材自动写入 OSS，历史素材可迁移。</p><div className="header-actions"><Button disabled>升级专业版 · 支付接入中</Button></div><p className="footnote">当前不会上传素材到云端；生成任务所需的临时参考图仍会按任务安全上传并在完成后释放。</p></Card></>;
}

function GeneralSettings() {
  const { theme, setTheme, collapsed, setCollapsed, notify } = useApp();
  return <><h2>偏好设置</h2><Card className="settings-card"><h2>外观</h2><p>颜色来自 WEAVIA Design System 的 Figma 变量。</p><div className="theme-options">{(['light', 'cream', 'dark'] as const).map(value => <button type="button" key={value} className={theme === value ? 'selected' : ''} onClick={() => { setTheme(value); notify(`已切换到 ${value} 主题`); }}>{value === 'light' ? 'Light' : value === 'cream' ? 'Cream' : 'Dark'}</button>)}</div></Card><Card className="settings-card"><h2>导航</h2><label className="switch-row">默认收起 Sidebar <input type="checkbox" checked={collapsed} onChange={event => setCollapsed(event.target.checked)} /></label></Card><Card className="settings-card"><h2>服务连接</h2><p>当前模式：<Badge>{apiConfig.mode === 'mock' ? 'Mock' : 'Live'}</Badge></p><p>真实服务仅在明确设置 VITE_API_MODE=live 和 VITE_API_BASE_URL 后调用。登录与认证尚未接入。</p></Card></>;
}

function DiagnosticsSection() {
  const [items, setItems] = useState<LogEntry[]>(readLogs);
  const [level, setLevel] = useState('全部');
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { const update = () => setItems(readLogs()); window.addEventListener('weavia:logs', update); return () => window.removeEventListener('weavia:logs', update); }, []);
  const visible = items.filter(item => (level === '全部' || item.level === level) && `${item.event} ${item.detail || ''}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="diagnostics-section" aria-label="日志与诊断"><div className="section-heading"><div><h2>日志与诊断</h2><p>本机诊断记录，最多保留 500 条。导出前请检查内容。</p></div><div className="header-actions"><Button variant="secondary" onClick={exportLogs}><Download size={15} /> 导出</Button><Button variant="danger" onClick={() => setConfirm(true)}><Trash2 size={15} /> 清理</Button></div></div><div className="filter-bar"><div className="search-box"><Search size={16} /><input aria-label="搜索日志" placeholder="搜索事件" value={search} onChange={event => setSearch(event.target.value)} /></div><select aria-label="日志级别" value={level} onChange={event => setLevel(event.target.value)}>{['全部', 'info', 'warn', 'error'].map(value => <option key={value}>{value}</option>)}</select><Badge>本地</Badge></div>{visible.length ? <div className="log-list">{visible.map(item => <div className="log-row" key={item.id}><time>{new Date(item.at).toLocaleString('zh-CN')}</time><Badge tone={item.level === 'error' ? 'danger' : item.level === 'warn' ? 'warning' : 'neutral'}>{item.level}</Badge><strong>{item.event}</strong><span>{item.detail}</span></div>)}</div> : <StatePanel type="empty" title="没有匹配的日志" detail="调整级别或搜索词。" />}<p className="footnote">当前诊断页显示本地存储中的记录。Tauri 原生日志单独轮转，暂未在这里读取或清理。</p>{confirm && <Dialog title="清理日志" onClose={() => setConfirm(false)}><div className="dialog-content"><p>确定清除本机诊断记录吗？</p><div className="dialog-actions"><Button variant="secondary" onClick={() => setConfirm(false)}>取消</Button><Button variant="danger" onClick={() => { clearLogs(); setConfirm(false); }}>清理日志</Button></div></div></Dialog>}</section>;
}
