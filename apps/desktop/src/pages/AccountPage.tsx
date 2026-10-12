import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  LoaderCircle,
  LogOut,
  Monitor,
  RotateCcw,
  ShieldCheck,
  UserRound,
  Wallet,
  Crown,
} from 'lucide-react';
import { Button } from '@weavia/ui';
import { authController, useAuthStore } from '../stores/auth';
import { useAccountSummary } from '../services/account-summary';

const statusCopy = {
  starting: ['正在启动登录', '正在创建安全登录请求…'],
  waiting_browser: ['等待浏览器授权', '请在系统浏览器中使用 Demo 账户完成登录。'],
  exchanging: ['正在完成授权', '正在校验回调并注册当前设备…'],
  refreshing: ['正在恢复登录', '正在安全刷新你的会话…'],
} as const;

export function AccountPage() {
  const auth = useAuthStore();
  const { summary, error: summaryError } = useAccountSummary();
  if (auth.status === 'authenticated' && auth.user && auth.device)
    return (
      <div className="auth-page">
        <section className="auth-hero authenticated">
          <CheckCircle2 />
          <div>
            <span>ACCOUNT CONNECTED</span>
            <h1>已登录</h1>
            <p>你的身份与当前设备已通过 WEAVIA 安全会话连接。</p>
          </div>
        </section>
        <div className="account-grid">
          <article>
            <UserRound />
            <small>当前用户</small>
            <strong>{auth.user.name || auth.user.email}</strong>
            <p>{auth.user.email}</p>
          </article>
          <article>
            <Monitor />
            <small>当前设备</small>
            <strong>{auth.device.deviceName}</strong>
            <p>
              {auth.device.platform} · WEAVIA {auth.device.appVersion}
            </p>
          </article>
          <article>
            <Crown />
            <small>会员等级</small>
            <strong>{summary?.planName ?? '—'}</strong>
            <p>{summaryError ?? '与 Web 用户中心保持同步'}</p>
          </article>
          <article>
            <Wallet />
            <small>Credits 余额</small>
            <strong>{summary ? summary.credits.toLocaleString('zh-CN') : '—'}</strong>
            <p>可用 Credits</p>
          </article>
        </div>
        <Button variant="secondary" onClick={() => void authController.logout()}>
          <LogOut size={15} />
          退出登录
        </Button>
      </div>
    );
  if (auth.status in statusCopy) {
    const [title, copy] = statusCopy[auth.status as keyof typeof statusCopy];
    return (
      <div className="auth-page">
        <section className="auth-hero">
          <LoaderCircle className="spin" />
          <div>
            <span>SECURE SIGN IN</span>
            <h1>{title}</h1>
            <p>{copy}</p>
          </div>
        </section>
        {auth.status === 'waiting_browser' && (
          <div className="auth-actions">
            <Button onClick={() => void authController.reopenBrowser()}>
              <ExternalLink size={15} />
              重新打开浏览器
            </Button>
            {auth.loginUrl && <Button variant="secondary" onClick={() => void navigator.clipboard.writeText(auth.loginUrl!)}>复制登录链接</Button>}
            <Button variant="secondary" onClick={() => authController.cancelLogin()}>
              取消
            </Button>
          </div>
        )}
      </div>
    );
  }
  if (auth.status === 'error')
    return (
      <div className="auth-page">
        <section className="auth-hero error">
          <AlertCircle />
          <div>
            <span>AUTHENTICATION ERROR</span>
            <h1>登录未完成</h1>
            <p>{auth.error?.message ?? '发生未知认证错误'}</p>
          </div>
        </section>
        <Button onClick={() => void authController.login()}>
          <RotateCcw size={15} />
          重新登录
        </Button>
      </div>
    );
  return (
    <div className="auth-page">
      <section className="auth-hero">
        <ShieldCheck />
        <div>
          <span>WEAVIA ACCOUNT</span>
          <h1>登录你的织维账户</h1>
          <p>登录将在系统浏览器中完成。桌面端只接收短期一次性授权码，不会在链接中传递访问令牌。</p>
        </div>
      </section>
      <Button onClick={() => void authController.login()}>
        <ExternalLink size={15} />
        使用浏览器登录
      </Button>
    </div>
  );
}
