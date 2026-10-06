import '@weavia/ui/styles.css';
import './web.css';
import Link from 'next/link';
import type { Metadata } from 'next';

// Next.js consumes this route-level export; it is intentionally colocated with the layout.
// eslint-disable-next-line react-refresh/only-export-components
export const metadata: Metadata = { title: 'WEAVIA 织维', description: '面向电商的 AI 商品视觉生产工具' };
const links = [['/product', '产品'], ['/pricing', '会员'], ['/credits', 'Credits'], ['/download', '下载']] as const;
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body><header className="site-nav"><Link className="wordmark" href="/">WEAVIA <span>织维</span></Link><nav>{links.map(([href,label]) => <Link key={href} href={href}>{label}</Link>)}</nav><Link className="login-link" href="/login">登录</Link></header>{children}<footer className="site-footer"><span>WEAVIA · Local First AI Commerce Studio</span><span>© 2026 织维</span></footer></body></html>;
}
