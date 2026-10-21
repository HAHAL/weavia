import type { ReactNode } from 'react';
import { Sparkles, ShieldCheck, WandSparkles } from 'lucide-react';
import { apiConfig } from '../services/api';

export function AuthShell({ title, subtitle, eyebrow = 'WEAVIA ACCOUNT', children, footer }: { title: string; subtitle: string; eyebrow?: string; children: ReactNode; footer?: ReactNode }) {
  return <div className="auth-page">
    <section className="auth-visual" aria-label="WEAVIA 产品介绍">
      <div className="auth-brand"><span className="brand-mark">W</span><span>WEAVIA<small>AI Commerce Studio</small></span></div>
      <div className="auth-visual-copy">
        <span className="auth-eyebrow">AI COMMERCE STUDIO</span>
        <h1>把商品，<br />变成会说话的视觉。</h1>
        <p>从商品描述到商业级图像。模型、Skill 与 AI 应用，都在一个工作台里。</p>
        <div className="auth-features">
          <div><Sparkles size={17} /><span><b>真实模型</b><small>Qwen / Wan 多模型自动路由</small></span></div>
          <div><WandSparkles size={17} /><span><b>Skill 与 AI 应用</b><small>选能力，填素材，直接生成</small></span></div>
          <div><ShieldCheck size={17} /><span><b>Credits 透明</b><small>每次生成前明确费用</small></span></div>
        </div>
      </div>
      <div className="auth-visual-foot"><span className="auth-status-dot" />服务已连接 · {apiConfig.baseUrl.replace(/^https?:\/\//, '')}</div>
    </section>
    <section className="auth-panel">
      <div className="auth-card">
        <div className="auth-card-head"><span className="auth-eyebrow">{eyebrow}</span><h2>{title}</h2><p>{subtitle}</p></div>
        {children}
        {footer && <div className="auth-footer">{footer}</div>}
      </div>
    </section>
  </div>;
}
