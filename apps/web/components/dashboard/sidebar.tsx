'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Sparkles, FolderOpen, Images, Shirt, UserRound, Video, WandSparkles, CreditCard, ReceiptText, Settings2, Crown, Package } from 'lucide-react';

const primary = [
  { href: '/account', label: '首页', icon: Home },
  { href: '/create', label: '创作中心', icon: Sparkles },
  { href: '/projects', label: '我的项目', icon: FolderOpen },
  { href: '/assets', label: '素材库', icon: Images },
];
const tools = [
  { href: '/create?tool=product', label: 'AI 商品图', icon: Package },
  { href: '/create?tool=model', label: 'AI 模特', icon: UserRound },
  { href: '/create?tool=tryon', label: 'AI 换衣', icon: Shirt },
  { href: '/create?tool=video', label: 'AI 视频', icon: Video },
  { href: '/create?tool=variations', label: 'AI 款式裂变', icon: WandSparkles },
];
const account = [
  { href: '/membership', label: '会员中心', icon: Crown },
  { href: '/credits', label: 'Credits', icon: CreditCard },
  { href: '/orders', label: '订单', icon: ReceiptText },
  { href: '/settings', label: '设置', icon: Settings2 },
];

export function Sidebar() {
  const pathname = usePathname();
  const nav = (items: typeof primary) => items.map(({ href, label, icon: Icon }) => (
    <Link key={href} href={href} className={`wb-nav-link ${pathname === href ? 'is-active' : ''}`} aria-current={pathname === href ? 'page' : undefined}>
      <Icon size={18} strokeWidth={1.7} aria-hidden="true" /><span>{label}</span>
    </Link>
  ));
  return <aside className="wb-sidebar">
    <Link href="/account" className="wb-brand" aria-label="WEAVIA 创作工作台">WEAVIA <span>织维</span></Link>
    <div className="wb-brand-caption">创作工作台 <span>STUDIO</span></div>
    <nav aria-label="工作台导航"><div className="wb-nav-group">{nav(primary)}</div><p className="wb-nav-heading">AI 工具</p><div className="wb-nav-group">{nav(tools)}</div><p className="wb-nav-heading">账户</p><div className="wb-nav-group">{nav(account)}</div></nav>
    <div className="wb-sidebar-footer"><span className="wb-sidebar-star">✦</span><p>让每一件商品<br />拥有更好的表达。</p><small>WEAVIA · AI CREATIVE STUDIO</small></div>
  </aside>;
}
