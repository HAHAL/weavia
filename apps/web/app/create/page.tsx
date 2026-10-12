'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowUpRight, Package, UserRound, Shirt, Video, WandSparkles } from 'lucide-react';

const tools = [
  { id: 'product', title: 'AI 商品图', description: '从商品原图出发，探索更适合电商的商业视觉。', icon: Package },
  { id: 'model', title: 'AI 模特', description: '将服饰自然呈现在不同模特与场景中。', icon: UserRound },
  { id: 'tryon', title: 'AI 换衣', description: '快速尝试不同服装搭配与穿着效果。', icon: Shirt },
  { id: 'video', title: 'AI 视频', description: '让商品内容从静态延伸到动态表达。', icon: Video },
  { id: 'variations', title: 'AI 款式裂变', description: '延展款式方向，发现新的商品创意。', icon: WandSparkles },
];
function CreateContent() {
  const selected = useSearchParams().get('tool');
  const active = tools.find((tool) => tool.id === selected);
  return <main className="wb-page"><header className="wb-page-head"><div><p className="wb-eyebrow">WEAVIA CREATIVE STUDIO</p><h1>{active ? active.title : '创作中心'}<span className="wb-gold">.</span></h1><p>{active?.description ?? '选择一项 AI 能力，开启你的下一次创作。'}</p></div></header><div className="wb-create-page-grid">{tools.map(({ id, title, description, icon: Icon }) => <Link key={id} href={`/create?tool=${id}`} className={`wb-create-option ${selected === id ? 'is-selected' : ''}`}><Icon size={25} strokeWidth={1.5} /><h2>{title}</h2><p>{description}</p><span>了解能力 <ArrowUpRight size={16} /></span></Link>)}</div>{active && <div className="wb-launch-panel"><div><p className="wb-eyebrow">{active.id === 'product' ? 'START CREATING' : 'COMING SOON'}</p><h2>{active.id === 'product' ? '在 WEAVIA Desktop 中继续' : '创作能力即将开放'}</h2><p>{active.id === 'product' ? '当前 AI 商品图创作引擎连接桌面客户端。下载并登录同一账户，即可继续创作。' : `${active.title} 正在完善中。你可以先使用 AI 商品图，开启商品视觉创作。`}</p></div><Link href={active.id === 'product' ? '/download' : '/create?tool=product'} className="wb-button wb-button-dark">{active.id === 'product' ? '获取客户端' : '尝试 AI 商品图'} <ArrowUpRight size={16} /></Link></div>}</main>;
}
export default function CreatePage() { return <Suspense fallback={<main className="wb-page">正在准备创作中心…</main>}><CreateContent /></Suspense>; }
