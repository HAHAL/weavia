import Link from 'next/link';
import type { ReactNode } from 'react';
import { LockKeyhole } from 'lucide-react';

export function AuthShell({ children }: { children: ReactNode }) {
  return <main className="auth-shell">
    <Link className="auth-shell__logo wordmark" href="/" aria-label="WEAVIA 首页">WEAVIA <span>织维</span></Link>
    {children}
    <p className="auth-shell__security"><LockKeyhole size={14} aria-hidden="true" />安全连接 · 账户凭证仅用于 WEAVIA 登录与桌面授权</p>
  </main>;
}
