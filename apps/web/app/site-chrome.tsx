'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const links = [['/product', '产品能力'], ['/pricing', '定价'], ['/download', '下载客户端']] as const;

export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/login' || pathname === '/signup') return <>{children}</>;

  return <>
    <header className="site-nav"><Link className="wordmark" href="/" aria-label="WEAVIA 首页">WEAVIA <span>织维</span></Link><nav aria-label="主导航">{links.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}</nav><Link className="login-link" href="/login">登录 / 注册</Link></header>
    {children}
    <footer className="site-footer" aria-label="网站页脚">
      <div className="site-footer__brand"><Link className="wordmark" href="/">WEAVIA <span>织维</span></Link><p>让每一件商品，拥有专业级视觉表达。</p></div>
      <div className="site-footer__links">
        <div><h2>产品</h2><Link href="/product">产品能力</Link><Link href="/pricing">定价方案</Link></div>
        <div><h2>资源</h2><Link href="/#cases">视觉案例</Link><Link href="/#workflow-title">工作流程</Link></div>
        <div><h2>下载</h2><Link href="/download">Mac 客户端</Link><Link href="/download">Windows 客户端</Link></div>
        <div><h2>法律</h2><span>隐私政策 · 待公布</span><span>服务条款 · 待公布</span></div>
      </div>
      <small className="site-footer__bottom">© 2026 WEAVIA 织维。保留所有权利。</small>
    </footer>
  </>;
}
