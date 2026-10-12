'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Blocks, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin-session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { message?: string };
        throw new Error(body.message ?? '登录失败，请重试');
      }
      router.replace('/');
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '登录失败，请重试');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <div className="login-brand">
        <span className="login-brand-mark">
          <Blocks size={22} strokeWidth={2.2} />
        </span>
        <span>
          WEAVIA<span className="brand-dot">.</span>
          <small>ADMIN CONSOLE</small>
        </span>
      </div>
      <section className="login-card">
        <div className="login-card-icon">
          <LockKeyhole size={22} />
        </div>
        <h1>欢迎回来</h1>
        <p className="login-intro">登录 WEAVIA 管理后台，继续管理您的业务。</p>
        <form onSubmit={submit}>
          <label htmlFor="admin-email">工作邮箱</label>
          <Input
            id="admin-email"
            autoComplete="username"
            type="email"
            required
            placeholder="name@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <label htmlFor="admin-password">密码</label>
          <div className="password-field">
            <Input
              id="admin-password"
              autoComplete="current-password"
              type={showPassword ? 'text' : 'password'}
              required
              placeholder="请输入密码"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? '隐藏密码' : '显示密码'}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}
          <Button className="login-submit" type="submit" disabled={busy}>
            {busy ? '登录中...' : '登录管理后台'}
            <ArrowRight size={17} />
          </Button>
        </form>
        <div className="login-card-footer">
          <ShieldCheck size={15} /> 仅限授权管理员访问
        </div>
      </section>
      <div className="login-footer">© {new Date().getFullYear()} WEAVIA · 安全运营平台</div>
    </main>
  );
}
