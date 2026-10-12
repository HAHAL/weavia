'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Image as ImageIcon, Video, Wallet } from 'lucide-react';
import { apiGet, formatDate, formatNumber, generationCost, planName, transactionName, type Catalog, type Credits, type Membership, type Transaction } from '../../lib/workbench';

export default function CreditsPage() {
  const [credits, setCredits] = useState<Credits>();
  const [membership, setMembership] = useState<Membership>();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [catalog, setCatalog] = useState<Catalog>();
  const [error, setError] = useState('');
  useEffect(() => { void Promise.allSettled([apiGet<Credits>('/credits'), apiGet<Membership>('/membership'), apiGet<Transaction[]>('/credits/transactions'), apiGet<Catalog>('/ai/catalog')]).then(([c, m, t, cat]) => { if (c.status === 'fulfilled') setCredits(c.value); else setError(c.reason instanceof Error ? c.reason.message : '额度加载失败'); if (m.status === 'fulfilled') setMembership(m.value); if (t.status === 'fulfilled') setTransactions(t.value); if (cat.status === 'fulfilled') setCatalog(cat.value); }); }, []);
  const visible = transactions.filter((item) => item.availableDelta !== 0);
  const imageCost = generationCost(catalog, 'image_generation');
  const videoCost = generationCost(catalog, 'video_generation');
  return <main className="wb-page"><header className="wb-page-head"><div><p className="wb-eyebrow">CREATIVE CAPACITY</p><h1>AI 创作额度<span className="wb-gold">.</span></h1><p>清楚掌握额度，让灵感持续发生。</p></div><Link href="/membership" className="wb-button wb-button-dark">升级套餐 <ArrowUpRight size={16} /></Link></header>{error && <p className="wb-error" role="alert">{error}</p>}
    <section className="wb-credits-hero"><div><span>当前套餐 · {planName(membership).toUpperCase()}</span><h2>{credits ? formatNumber(credits.available) : '—'} <small>Credits</small></h2><p>当前可用额度</p><div className="wb-credit-actions"><Link className="wb-button wb-button-light" href="/membership">购买额度 <ArrowUpRight size={15} /></Link><Link className="wb-text-link" href="/membership">查看会员方案</Link></div></div><div className="wb-credits-estimates"><div><ImageIcon size={22} /><span>预计图片生成</span><strong>{credits && imageCost ? formatNumber(Math.floor(credits.available / imageCost)) : '—'} 次</strong><small>{imageCost ? `按每次 ${imageCost} Credits 估算` : '图片费率加载中'}</small></div><div><Video size={22} /><span>预计视频生成</span><strong>{credits && videoCost ? formatNumber(Math.floor(credits.available / videoCost)) : '—'} 次</strong><small>{videoCost ? `按每次 ${videoCost} Credits 估算` : '视频能力即将开放'}</small></div></div></section>
    <section className="wb-section"><div className="wb-section-head"><div><p className="wb-eyebrow">ACTIVITY</p><h2>使用记录</h2></div></div>{visible.length ? <div className="wb-history"><div className="wb-history-head"><span>日期</span><span>功能</span><span>额度变化</span></div>{visible.map((item) => <div className="wb-history-row" key={item.id}><span>{formatDate(item.createdAt)}</span><strong>{transactionName(item)}</strong><span className={item.availableDelta > 0 ? 'is-positive' : ''}>{item.availableDelta > 0 ? '+' : ''}{formatNumber(item.availableDelta)} Credits</span></div>)}</div> : <div className="wb-empty wb-empty--compact"><Wallet size={28} /><div><h3>暂无使用记录</h3><p>开始创作后，额度变化会显示在这里。</p></div></div>}</section>
  </main>;
}
