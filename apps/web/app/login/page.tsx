import { Button, Input } from '@weavia/ui';
export default function LoginPage(){return <main className="content-page"><section className="auth-card"><p className="kicker">ACCOUNT</p><h1>登录织维</h1><p>完成浏览器授权后，将安全返回桌面客户端。</p><label>邮箱<Input type="email" placeholder="name@company.com" /></label><Button disabled>继续（Phase 1 接入）</Button></section></main>}
