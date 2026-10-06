import { ArrowRight, Laptop, Layers3, LockKeyhole } from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  return <main><section className="hero"><p className="kicker">AI COMMERCE CREATIVE STUDIO</p><h1>让每一件商品，<br/>拥有专业级视觉表达。</h1><p className="lead">从一张商品图出发，快速创作 AI 模特图与商业场景图。项目与素材优先保存在你的电脑。</p><div className="hero-actions"><Link className="primary-link" href="/download">下载客户端 <ArrowRight size={16}/></Link><Link href="/product">了解产品</Link></div></section><section className="photo-stage" aria-label="产品视觉示意"><div className="stage-copy"><span>PRODUCT 01</span><strong>一张商品图，<br/>开启完整创作。</strong></div></section><section className="principles"><article><Laptop/><h2>Desktop First</h2><p>为高频专业创作设计的桌面工作区。</p></article><article><LockKeyhole/><h2>Local First</h2><p>素材、项目与结果优先留在本地。</p></article><article><Layers3/><h2>Provider Agnostic</h2><p>统一能力层连接未来的多家 AI 服务。</p></article></section></main>;
}
