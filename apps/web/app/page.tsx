import { ArrowDown, ArrowRight, Download, MoveUpRight } from 'lucide-react';
import { Badge, Card } from '@weavia/ui';
import Link from 'next/link';
import { capabilities, steps } from './marketing-content';
import { MarketingImage } from './marketing-image';

export default function HomePage() {
  return <main className="marketing-page">
    <section className="marketing-hero shell" aria-labelledby="home-title">
      <div className="marketing-hero__copy">
        <p className="eyebrow"><span className="eyebrow-line" /> WEAVIA · AI COMMERCE STUDIO</p>
        <h1 id="home-title">让商品视觉，<br /><em>拥有更多可能。</em></h1>
        <p className="marketing-lead">WEAVIA 是 AI 商品视觉生产平台。从一张商品图出发，创作 AI 模特图与商业场景图，并探索未来的视频内容。</p>
        <div className="marketing-actions"><Link href="/login" className="wv-button wv-button--primary">开始体验 <ArrowRight size={16} /></Link><Link href="#cases" className="text-link">查看案例 <MoveUpRight size={15} /></Link></div>
        <div className="marketing-hero__foot"><span>一张商品图</span><ArrowRight size={14} /><span>模特 / 商拍 / 视频方向</span></div>
      </div>
      <div className="marketing-hero__visual"><MarketingImage image="coat-model" alt="商品风衣与 AI 模特视觉概念示例" ratio="hero" /><span className="visual-index">01 / 03</span><div className="visual-caption"><span>WEAVIA VISUAL STUDY</span><strong>商品，是故事的起点。</strong></div></div>
      <a href="#capabilities" className="scroll-cue">向下探索 <ArrowDown size={14} /></a>
    </section>

    <section id="capabilities" className="marketing-section shell" aria-labelledby="capabilities-title">
      <div className="section-heading"><div><p className="eyebrow">CREATIVE POSSIBILITIES</p><h2 id="capabilities-title">一套工作流，<br />打开更多创作方向。</h2></div><p>从商品本身出发，面向不同的内容场景。当前核心流程聚焦 AI 模特与 AI 商拍，更多能力正在规划中。</p></div>
      <div className="capability-grid">{capabilities.map((item) => <Card key={item.number} className="capability-card"><MarketingImage image={item.image} alt={`${item.title}概念视觉`} ratio="product" /><div className="capability-card__copy"><div><span className="micro-label">{item.number} / {item.english}</span><Badge tone={item.status === '核心能力' ? 'accent' : 'neutral'}>{item.status}</Badge></div><h3>{item.title}</h3><p>{item.description}</p></div></Card>)}</div>
      <Link href="/product" className="text-link section-link">了解产品能力 <ArrowRight size={16} /></Link>
    </section>

    <section id="cases" className="case-section" aria-labelledby="case-title"><div className="shell">
      <div className="section-heading"><div><p className="eyebrow">FROM PRODUCT TO PERSPECTIVE</p><h2 id="case-title">同一件商品，<br />呈现不同的可能。</h2></div><p>以下为设计阶段的概念视觉示例，用于展示商品图与场景图的关系；实际生成效果以产品输出为准。</p></div>
      <div className="comparison-grid"><Card className="comparison-card"><MarketingImage image="coat-product" alt="原始风衣商品图" ratio="gallery" /><div><span>BEFORE / 原始商品图</span><strong>保留商品细节</strong></div></Card><Card className="comparison-card"><MarketingImage image="coat-outdoor" alt="风衣模特场景概念图" ratio="gallery" /><div><span>AFTER / AI 效果示意</span><strong>进入真实感场景</strong></div></Card></div>
    </div></section>

    <section className="marketing-section shell" aria-labelledby="workflow-title"><div className="section-heading"><div><p className="eyebrow">HOW IT WORKS</p><h2 id="workflow-title">从素材到作品，<br />始终清晰可控。</h2></div><p>本地项目管理与云端生成流程各司其职，作品从你的商品出发。</p></div><div className="steps-grid">{steps.map((step) => <div className="step" key={step.number}><span className="step__number">{step.number}</span><h3>{step.title}</h3><p>{step.description}</p></div>)}</div></section>

    <section className="home-pricing shell"><div><p className="eyebrow">SIMPLE BY DESIGN</p><h2>为不同创作节奏，<br />找到合适的起点。</h2><p>了解 Free、Pro 与 Studio 的产品方向。正式价格与权益以发布时公布的信息为准。</p><Link href="/pricing" className="wv-button wv-button--secondary">查看定价方案 <ArrowRight size={16} /></Link></div><span aria-hidden="true">W</span></section>
    <section className="download-banner shell"><div><p className="eyebrow">DESKTOP FIRST</p><h2>把创作，带回工作桌面。</h2><p>为 Mac 与 Windows 设计的本地优先创作体验。</p></div><Link href="/download" className="wv-button wv-button--primary">查看客户端下载 <Download size={16} /></Link></section>
  </main>;
}
