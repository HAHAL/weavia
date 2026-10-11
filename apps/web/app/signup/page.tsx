import { Suspense } from 'react';
import { AuthShell } from '../login/auth-shell';
import { DesktopLogin } from '../login/desktop-login';

export default function SignupPage() {
  return <AuthShell><Suspense fallback={<section className="auth-card">正在准备注册…</section>}><DesktopLogin mode="register" /></Suspense></AuthShell>;
}
