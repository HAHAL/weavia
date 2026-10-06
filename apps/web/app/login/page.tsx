import { Suspense } from 'react';
import { DesktopLogin } from './desktop-login';

export default function LoginPage() {
  return (
    <main className="content-page">
      <Suspense
        fallback={
          <section className="auth-card">
            <p>正在准备登录…</p>
          </section>
        }
      >
        <DesktopLogin />
      </Suspense>
    </main>
  );
}
