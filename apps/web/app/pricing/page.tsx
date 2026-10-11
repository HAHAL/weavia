import { ArrowRight, Check } from 'lucide-react';
import { Badge, Card } from '@weavia/ui';
import Link from 'next/link';

const plans = [
  { name: 'Free', number: '01', intro: '从第一件商品开始探索。', audience: '适合初次体验的个人创作者', features: ['体验基础创作流程', '管理本地项目与素材', '查看任务与作品'], featured: false },
  { name: 'Pro', number: '02', intro: '让视觉生产成为日常。', audience: '适合高频创作的商家与设计师', features: ['面向持续创作的使用方案', '更完整的商业视觉工作流', '透明的 Credits 使用记录'], featured: true },
  { name: 'Studio', number: '03', intro: '为协作与规模化预留空间。', audience: '适合品牌团队与创意工作室', features: ['面向团队的产品方向', '协作与管理能力规划', '适配更高频的内容生产'], featured: false },
] as const;

export default function PricingPage() {
  return <main className="marketing-page"><header className="interior-hero shell pricing-hero"><p className="eyebrow">MEMBERSHIP & CREDITS</p><h1>适合你的节奏，<br /><em>也适合下一步成长。</em></h1><p>从个人探索到团队创作，选择合适的产品方向。正式售价、周期额度与权益仍待发布确认。</p></header>
    <section className="pricing-grid shell" aria-label="套餐方向">{plans.map((plan) => <Card key={plan.name} className={`plan-card-public${plan.featured ? ' plan-card-public--featured' : ''}`}><div className="plan-card-public__top"><span className="micro-label">PLAN {plan.number}</span>{plan.featured && <Badge tone="accent">推荐方向</Badge>}</div><h2>{plan.name}</h2><p className="plan-card-public__intro">{plan.intro}</p><p className="plan-card-public__audience">{plan.audience}</p><div className="plan-card-public__availability">价格与具体权益待公布</div><ul>{plan.features.map((feature) => <li key={feature}><Check size={16} />{feature}</li>)}</ul><Link href="/login" className={`wv-button wv-button--${plan.featured ? 'primary' : 'secondary'}`}>了解体验入口 <ArrowRight size={15} /></Link></Card>)}</section>
    <section className="pricing-explainer shell"><div><p className="eyebrow">HOW CREDITS WORK</p><h2>每一次生成，<br />都有清楚的消耗记录。</h2></div><div><p>开始生成前展示预计 Credits；提交任务后区分预占与实际消耗。若任务失败或部分完成，最终结算应以服务端确认结果为准。</p><p>正式费率、套餐额度与支付方式将在商业规则确认后发布。</p></div></section>
    <section className="download-banner shell"><div><p className="eyebrow">EXPLORE WEAVIA</p><h2>先认识产品，再选择方案。</h2><p>看看商品视觉创作如何融入你的工作流。</p></div><Link href="/product" className="wv-button wv-button--primary">了解产品能力 <ArrowRight size={16} /></Link></section>
  </main>;
}
