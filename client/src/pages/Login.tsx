import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Field } from '../components/ui';
import { AuthShell } from '../components/AuthShell';
import { useAuth } from '../stores/auth';
import { apiConfig } from '../services/api';

export function LoginPage() {
  const navigate = useNavigate();
  const { user, status, login } = useAuth();
  const [email, setEmail] = useState(import.meta.env.DEV ? 'dev@weavia.local' : '');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const busy = status === 'loading';

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) { setError('请输入邮箱和密码'); return; }
    setError('');
    try { await login(email.trim(), password, remember); navigate('/'); }
    catch (err) { setError(err instanceof Error ? err.message : '登录失败'); }
  }

  if (user) {
    return <AuthShell title="已经登录" subtitle={user.email} eyebrow="WEAVIA SESSION" footer={<Link to="/">进入工作台</Link>}><div className="auth-signed"><p>当前账户已连接云端，可以继续创作。</p><Button onClick={() => navigate('/')}>进入工作台</Button><Button variant="secondary" onClick={() => void useAuth.getState().logout()}>退出登录</Button></div></AuthShell>;
  }

  return <AuthShell title="欢迎回来" subtitle="登录后继续你的商品视觉创作。" footer={<span>还没有账户？ <Link to="/register">注册 WEAVIA</Link></span>}>
    <form className="auth-form" onSubmit={submit}>
      <Field label="邮箱"><input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></Field>
      <Field label="密码"><input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="输入密码" /></Field>
      <label className="auth-remember"><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} /><span>10 天内自动登录</span><small>仅保存登录会话，不保存密码</small></label>
      {error && <p className="form-error auth-error" role="alert">{error}</p>}
      <details className="auth-forgot"><summary>忘记密码？</summary><p>请联系客服或你的商务对接人，核实账户后会为你重置临时密码。登录后可在「账户 → 登录与安全」查看设备与会话。</p></details>
      <Button className="auth-submit" type="submit" disabled={busy}>{busy ? '登录中…' : '登录'}</Button>
    </form>
    <div className="auth-meta"><span className={`auth-mode ${apiConfig.mode === 'live' ? 'live' : ''}`}>{apiConfig.mode === 'live' ? '已连接云端' : '演示模式'}</span>{import.meta.env.DEV && <span>开发账号：dev@weavia.local</span>}</div>
  </AuthShell>;
}
