import { ArrowRight, CircleCheck, Laptop, Layers3, LockKeyhole } from 'lucide-react';
import { Badge, Card } from '@weavia/ui';
import Link from 'next/link';
import { capabilities, steps } from '../marketing-content';
import { MarketingImage } from '../marketing-image';

export default function ProductPage() {
  return <main className="marketing-page">
    <header className="interior-hero shell"><p className="eyebrow">THE WEAVIA PLATFORM</p><h1>以商品为原点，<br /><em>构建每一种视觉表达。</em></h1><p>WEAVIA 将商品素材、创作任务与结果收拢到清晰的工作流，让电商视觉生产更专注。</p><Link href="/login" className="wv-button wv-button--primary">开始体验 <ArrowRight size={16} /></Link></header>
    <section className="product-feature shell"><MarketingImage image="coat-model" alt="风衣模特视觉概念示例" ratio="product" className="product-feature__visual" /><div><p className="eyebrow">01 / AI MODEL</p><h2>让商品，遇见适合它的模特。</h2><p>选择商品、模特、姿势和背景，在同一工作区查看任务与结果。创作过程围绕商品展开，而不是复杂的技术参数。</p><Badge tone="accent">当前核心能力</Badge></div></section>
    <section className="product-feature product-feature--reverse shell"><MarketingImage image="perfume-scene" alt="香水商业场景概念示例" ratio="product" className="product-feature__visual" /><div><p className="eyebrow">02 / AI CAMPAIGN</p><h2>为商品创造有氛围的商业场景。</h2><p>在场景、风格与构图之间探索，让单张商品图延伸出适合不同渠道的视觉方向。</p><Badge tone="accent">当前核心能力</Badge></div></section>
    <section className="marketing-section shell"><div className="section-heading"><div><p className="eyebrow">NEXT CHAPTERS</p><h2>更多内容形式，<br />沿着同一条创作链路。</h2></div><p>以下方向正在规划中，暂不代表现有产品已提供这些功能。</p></div><div className="future-grid">{capabilities.slice(2).map((item) => <Card key={item.number} className="future-card"><span className="micro-label">{item.number} / {item.english}</span><MarketingImage image={item.image} alt={`${item.title}方向概念图`} ratio="product" /><h3>{item.title}</h3><p>{item.description}</p><Badge>{item.status}</Badge></Card>)}</div></section>
    <section className="product-principles shell"><Card><Laptop size={22} /><h3>Desktop First</h3><p>为高频创作保留宽阔画布与稳定工作区。</p></Card><Card><LockKeyhole size={22} /><h3>Local First</h3><p>本地项目、素材和结果由桌面客户端管理。</p></Card><Card><Layers3 size={22} /><h3>清晰的任务流程</h3><p>从提交到结果，状态与 Credits 消耗应可追踪。</p></Card></section>
    <section className="marketing-section shell"><div className="section-heading"><div><p className="eyebrow">A CLEAR WORKFLOW</p><h2>四步，完成一次创作。</h2></div></div><div className="steps-grid">{steps.map((step) => <div className="step" key={step.number}><CircleCheck size={18} /><span className="step__number">{step.number}</span><h3>{step.title}</h3><p>{step.description}</p></div>)}</div></section>
    <section className="download-banner shell"><div><p className="eyebrow">READY TO EXPLORE?</p><h2>从你的下一件商品开始。</h2><p>先了解客户端与当前发布状态。</p></div><Link href="/download" className="wv-button wv-button--primary">查看客户端 <ArrowRight size={16} /></Link></section>
  </main>;
}
