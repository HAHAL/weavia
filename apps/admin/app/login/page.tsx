'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin-session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
      if (!response.ok) { const body = await response.json() as { message?: string }; throw new Error(body.message ?? '登录失败'); }
      router.replace('/'); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : '登录失败'); }
    finally { setBusy(false); }
  }
  return <main className="admin-content"><h1>管理台登录</h1><form className="auth-card" onSubmit={submit}><label>邮箱<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>密码<input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <p role="alert">{error}</p>}<button disabled={busy}>{busy ? '登录中…' : '登录'}</button></form></main>;
}
