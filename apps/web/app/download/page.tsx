import { ArrowRight, Apple, MonitorDown, ShieldCheck } from 'lucide-react';
import { Badge, Card } from '@weavia/ui';
import Link from 'next/link';
import { MarketingImage } from '../marketing-image';

export default function DownloadPage() {
  return <main className="marketing-page"><header className="interior-hero shell download-hero"><p className="eyebrow">WEAVIA FOR DESKTOP</p><h1>更专注的创作，<br /><em>从你的桌面开始。</em></h1><p>WEAVIA Desktop 将本地项目、素材、任务与作品集中在一个工作区。云端 AI 生成能力通过账户授权使用。</p><MarketingImage image="perfume-detail" alt="WEAVIA 商品商业视觉概念示例" ratio="hero" className="download-hero__visual" /></header>
    <section className="marketing-section shell"><div className="section-heading"><div><p className="eyebrow">CHOOSE YOUR PLATFORM</p><h2>为你的工作设备准备。</h2></div><p>正式安装包尚未发布；下载入口会在版本和系统要求确认后开放。</p></div><div className="download-grid"><Card className="download-card"><Apple size={28} strokeWidth={1.5} /><Badge>即将开放</Badge><h3>macOS</h3><p>面向 Mac 的本地优先创作客户端。Apple Silicon 与 Intel 的支持范围待发布确认。</p><span className="download-card__disabled" aria-disabled="true">安装包暂未开放</span></Card><Card className="download-card"><MonitorDown size={28} strokeWidth={1.5} /><Badge>即将开放</Badge><h3>Windows</h3><p>面向 Windows 的桌面创作工作区。支持的系统版本与安装包信息待发布确认。</p><span className="download-card__disabled" aria-disabled="true">安装包暂未开放</span></Card></div></section>
    <section className="product-principles shell"><Card><ShieldCheck size={22} /><h3>项目留在本地</h3><p>本地项目、素材与结果由客户端管理。</p></Card><Card><MonitorDown size={22} /><h3>宽阔创作空间</h3><p>为商品图、参数与生成结果保留清晰的工作区。</p></Card><Card><ArrowRight size={22} /><h3>浏览器安全授权</h3><p>账户登录在浏览器完成，再返回桌面客户端。</p></Card></section>
    <section className="download-banner shell"><div><p className="eyebrow">WHILE YOU WAIT</p><h2>先看看 WEAVIA 能创作什么。</h2><p>了解当前核心能力与未来的产品方向。</p></div><Link href="/product" className="wv-button wv-button--primary">探索产品能力 <ArrowRight size={16} /></Link></section>
  </main>;
}
