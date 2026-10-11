'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button, Card, Input } from '@weavia/ui';

type Mode = 'login' | 'register';
type ViewState = 'ready' | 'authorizing' | 'success' | 'error';

export function DesktopLogin({ mode }: { mode: Mode }) {
  const loginSessionId = useSearchParams().get('session');
  const [view, setView] = useState<ViewState>('ready');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setView('authorizing');
    setMessage('');
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, name, deviceInfo: { deviceName: 'WEAVIA Web', platform: 'web' } }),
      });
      const body = (await response.json()) as { data?: { accessToken: string; refreshToken: string }; message?: string };
      if (!response.ok || !body.data) throw new Error(body.message ?? '登录失败');
      localStorage.setItem('weavia.accessToken', body.data.accessToken);
      localStorage.setItem('weavia.refreshToken', body.data.refreshToken);
      if (loginSessionId) {
        const authorized = await fetch('/api/auth/desktop/authorize', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${body.data.accessToken}` },
          body: JSON.stringify({ loginSessionId }),
        });
        const result = (await authorized.json()) as { data?: { callbackUrl: string }; message?: string };
        if (!authorized.ok || !result.data) throw new Error(result.message ?? '桌面授权失败');
        setView('success');
        window.location.assign(result.data.callbackUrl);
        return;
      }
      setView('success');
      window.location.assign('/account');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '登录失败');
      setView('error');
    }
  }

  return (
    <Card className="auth-card desktop-auth-card">
      <p className="kicker">{loginSessionId ? 'DESKTOP AUTHORIZATION' : 'WEAVIA ACCOUNT'}</p>
      <h1>{view === 'success' ? '登录成功' : mode === 'login' ? '登录 WEAVIA' : '创建 WEAVIA 账户'}</h1>
      {view !== 'success' && (
        <form onSubmit={submit}>
          {mode === 'register' && <label>姓名<Input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required /></label>}
          <label>邮箱<Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label>密码<Input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
          {message && <p className="auth-error" role="alert">{message}</p>}
          <div className="auth-actions"><Button type="submit" loading={view === 'authorizing'}>{view === 'authorizing' ? '处理中…' : mode === 'login' ? '登录' : '创建账户'}</Button>
          <Link className="wv-button wv-button--secondary auth-secondary" href={`${mode === 'login' ? '/signup' : '/login'}${loginSessionId ? `?session=${encodeURIComponent(loginSessionId)}` : ''}`}>
            {mode === 'login' ? '没有账户？立即注册' : '已有账户？返回登录'}
          </Link></div>
        </form>
      )}
      {view === 'success' && <p>{loginSessionId ? '正在返回 WEAVIA Desktop…' : '正在进入账户中心…'}</p>}
    </Card>
  );
}
