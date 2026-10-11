import { Suspense } from 'react';
import { DesktopLogin } from './desktop-login';
import { AuthShell } from './auth-shell';

export default function LoginPage() {
  return (
    <AuthShell>
      <Suspense
        fallback={
          <section className="auth-card">
            <p>正在准备登录…</p>
          </section>
        }
      >
        <DesktopLogin mode="login" />
      </Suspense>
    </AuthShell>
  );
}
