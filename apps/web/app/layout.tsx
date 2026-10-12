import '@weavia/ui/styles.css';
import './web.css';
import './marketing.css';
import './auth.css';
import './workbench.css';
import type { Metadata } from 'next';
import { SiteChrome } from './site-chrome';

// Next.js consumes this route-level export; it is intentionally colocated with the layout.
// eslint-disable-next-line react-refresh/only-export-components
export const metadata: Metadata = { title: 'WEAVIA 织维｜AI 商品视觉生产平台', description: '从一张商品图出发，创作 AI 模特图与商业场景图。' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body><SiteChrome>{children}</SiteChrome></body></html>;
}
