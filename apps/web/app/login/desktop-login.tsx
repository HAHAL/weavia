'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@weavia/ui';

type ViewState = 'ready' | 'authorizing' | 'success' | 'error';

export function DesktopLogin() {
  const params = useSearchParams();
  const loginSessionId = params.get('session');
  const [view, setView] = useState<ViewState>(loginSessionId ? 'ready' : 'error');
  const [callbackUrl, setCallbackUrl] = useState<string>();
  const [message, setMessage] = useState(
    loginSessionId ? '' : '缺少 Desktop 登录请求，请从 WEAVIA Desktop 重新发起。',
  );

  async function authorize() {
    if (!loginSessionId) return;
    setView('authorizing');
    try {
      const response = await fetch('/api/auth/desktop/authorize', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ loginSessionId }),
      });
      const body = (await response.json()) as { data?: { callbackUrl: string }; message?: string };
      if (!response.ok || !body.data) throw new Error(body.message ?? '登录失败');
      setCallbackUrl(body.data.callbackUrl);
      setView('success');
      window.location.assign(body.data.callbackUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '登录失败');
      setView('error');
    }
  }

  return (
    <section className="auth-card desktop-auth-card">
      <p className="kicker">DESKTOP AUTHORIZATION</p>
      <h1>{view === 'success' ? '登录成功' : '登录 WEAVIA Desktop'}</h1>
      {view === 'ready' && (
        <>
          <p>使用开发账户完成安全授权，授权完成后将自动返回桌面客户端。</p>
          <div className="demo-user">
            <span>Demo 账户</span>
            <strong>WEAVIA Demo</strong>
            <small>demo@weavia.local</small>
          </div>
          <Button onClick={authorize}>使用 Demo 账户登录</Button>
        </>
      )}
      {view === 'authorizing' && <p>正在生成一次性授权码…</p>}
      {view === 'success' && (
        <>
          <p>正在返回 WEAVIA Desktop…</p>
          {callbackUrl && (
            <a className="primary-link" href={callbackUrl}>
              重新打开 WEAVIA
            </a>
          )}
          <small className="close-hint">你可以关闭此页面。</small>
        </>
      )}
      {view === 'error' && (
        <>
          <p className="auth-error">{message}</p>
          <p>请关闭此页面并从桌面客户端重新登录。</p>
        </>
      )}
    </section>
  );
}
