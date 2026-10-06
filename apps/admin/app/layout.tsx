import '@weavia/ui/styles.css';
import './admin.css';
import Link from 'next/link';
const items = [['/','概览'],['/users','用户管理'],['/memberships','会员管理'],['/credits','Credits 管理'],['/devices','设备管理'],['/providers','Provider 配置'],['/tasks','任务记录'],['/settings','系统配置']] as const;
export default function AdminLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="zh-CN"><body><div className="admin-shell"><aside><Link className="admin-logo" href="/">WEAVIA <span>ADMIN</span></Link><nav>{items.map(([href,label])=><Link key={href} href={href}>{label}</Link>)}</nav><div className="operator"><span>Phase 0</span><small>只读基础界面</small></div></aside><main><header className="admin-top"><span>运营管理台</span><span>Development</span></header><div className="admin-content">{children}</div></main></div></body></html>}
