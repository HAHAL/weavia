import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Field } from '../components/ui';
import { AuthShell } from '../components/AuthShell';
import { useAuth } from '../stores/auth';
import { apiConfig } from '../services/api';

export function RegisterPage() {
  const navigate = useNavigate();
  const { user, status, register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const busy = status === 'loading';

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || password.length < 8) { setError('请输入邮箱，密码至少 8 位'); return; }
    if (password !== confirm) { setError('两次输入的密码不一致'); return; }
    setError('');
    try { await register(email.trim(), password, name.trim()); navigate('/'); }
    catch (err) { setError(err instanceof Error ? err.message : '注册失败'); }
  }

  if (user) {
    return <AuthShell title="账户已创建" subtitle={user.email} eyebrow="WEAVIA ACCOUNT" footer={<Link to="/">开始创作</Link>}><div className="auth-signed"><p>账户已连接云端，赠送的 Credits 已到账。</p><Button onClick={() => navigate('/')}>开始创作</Button></div></AuthShell>;
  }

  return <AuthShell title="创建账户" subtitle="注册后赠送 50 Credits，直接体验真实生成。" eyebrow="JOIN WEAVIA" footer={<span>已有账户？ <Link to="/login">返回登录</Link></span>}>
    <form className="auth-form" onSubmit={submit}>
      <Field label="称呼（可选）"><input value={name} onChange={event => setName(event.target.value)} placeholder="例如：小林" autoComplete="name" /></Field>
      <Field label="邮箱"><input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></Field>
      <Field label="密码"><input type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="至少 8 位" /></Field>
      <Field label="确认密码"><input type="password" autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} placeholder="再次输入密码" /></Field>
      {error && <p className="form-error auth-error" role="alert">{error}</p>}
      <Button className="auth-submit" type="submit" disabled={busy}>{busy ? '注册中…' : '创建账户'}</Button>
    </form>
    <div className="auth-meta"><span className={`auth-mode ${apiConfig.mode === 'live' ? 'live' : ''}`}>{apiConfig.mode === 'live' ? 'Live 测试环境' : '演示模式'}</span></div>
  </AuthShell>;
}
