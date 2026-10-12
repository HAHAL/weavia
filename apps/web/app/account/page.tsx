'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Image as ImageIcon, Package, Shirt, UserRound, Video, Sparkles } from 'lucide-react';
import { AssetCard, ProjectCard, QuickCreateCard, SectionHeader } from '../../components/dashboard/cards';
import { useAssetPreviews } from '../../components/dashboard/use-asset-previews';
import { apiGet, formatDate, formatNumber, generationCost, planName, type Asset, type Catalog, type Credits, type Membership, type Project, type Task, type User } from '../../lib/workbench';

export default function AccountPage() {
  const [user, setUser] = useState<User>();
  const [membership, setMembership] = useState<Membership>();
  const [credits, setCredits] = useState<Credits>();
  const [projects, setProjects] = useState<Project[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [tasks, setTasks] = useState<Task[]>();
  const [catalog, setCatalog] = useState<Catalog>();
  const [error, setError] = useState('');
  useEffect(() => {
    async function load() {
      const results = await Promise.allSettled([
        apiGet<User>('/auth/me'), apiGet<Membership>('/membership'), apiGet<Credits>('/credits'),
        apiGet<Project[]>('/projects'), apiGet<Asset[]>('/assets'), apiGet<Task[]>('/ai/tasks'), apiGet<Catalog>('/ai/catalog'),
      ]);
      const [u, m, c, p, a, t, cat] = results;
      if (u.status === 'fulfilled') setUser(u.value);
      if (m.status === 'fulfilled') setMembership(m.value);
      if (c.status === 'fulfilled') setCredits(c.value);
      if (p.status === 'fulfilled') setProjects(p.value);
      if (a.status === 'fulfilled') setAssets(a.value);
      if (t.status === 'fulfilled') setTasks(t.value);
      if (cat.status === 'fulfilled') setCatalog(cat.value);
      if (results.every((item) => item.status === 'rejected')) setError('工作台暂时无法加载。请确认已登录并稍后重试。');
    }
    void load();
  }, []);
  const recentGenerated = useMemo(() => assets.filter((asset) => asset.kind === 'generated'), [assets]);
  const previews = useAssetPreviews(recentGenerated, 4);
  const imageCost = generationCost(catalog, 'image_generation');
  const videoCost = generationCost(catalog, 'video_generation');
  const todayTasks = tasks?.filter((task) => formatDate(task.createdAt) === formatDate(new Date().toISOString())).length;
  return <main className="wb-page wb-dashboard">
    <div className="wb-topline"><span>WEAVIA DASHBOARD · 创作工作台</span><Link href="/settings">账户设置 <ArrowUpRight size={14} /></Link></div>
    <header className="wb-welcome"><div><p className="wb-eyebrow">YOUR CREATIVE SPACE</p><h1>欢迎回来，{user?.name?.split(' ')[0] || '创作者'}<span className="wb-gold">.</span></h1><p>从灵感到上架，让每一次创作都更进一步。</p></div><div className="wb-profile"><div className="wb-avatar" aria-hidden="true">{user?.name?.slice(0, 1) || 'W'}</div><div><strong>{user?.name || user?.email || 'WEAVIA 用户'}</strong><small><span className="wb-plan-dot" />{membership ? `${planName(membership)} 会员` : '会员信息待加载'}{membership?.currentPeriodEnd ? ` · 有效期至 ${formatDate(membership.currentPeriodEnd)}` : ''}</small></div></div></header>
    {error && <div className="wb-error" role="alert">{error} <Link href="/login">前往登录</Link></div>}
    <section className="wb-overview" aria-label="创作能力概览"><div className="wb-credit-panel"><div className="wb-credit-top"><span>可用创作额度</span><Sparkles size={20} /></div><div className="wb-credit-number">{credits ? formatNumber(credits.available) : '—'}<small> Credits</small></div><p>把每一个想法，变成更有价值的商品内容。</p><div className="wb-credit-actions"><Link href="/credits" className="wb-button wb-button-light">购买 Credits <ArrowUpRight size={15} /></Link><Link href="/membership" className="wb-text-link">升级会员 <ArrowRight size={15} /></Link></div></div><div className="wb-stat-panel"><span className="wb-stat-icon"><ImageIcon size={21} /></span><p>预计可生成图片</p><strong>{credits && imageCost ? formatNumber(Math.floor(credits.available / imageCost)) : '—'} <small>张</small></strong><span>{imageCost ? `按每张 ${imageCost} Credits 估算` : '图片费率加载中'}</span></div><div className="wb-stat-panel"><span className="wb-stat-icon"><Video size={21} /></span><p>预计可生成视频</p><strong>{credits && videoCost ? formatNumber(Math.floor(credits.available / videoCost)) : '—'} <small>条</small></strong><span>{videoCost ? `按每条 ${videoCost} Credits 估算` : '视频能力即将开放'}</span></div><div className="wb-stat-panel"><span className="wb-stat-icon"><Sparkles size={21} /></span><p>今日任务</p><strong>{todayTasks ?? '—'} <small>个</small></strong><span>今天发起的创作任务</span></div></section>
    <section className="wb-section"><SectionHeader eyebrow="CREATE SOMETHING NEW" title="快速开始" href="/create" linkLabel="探索全部工具" /><div className="wb-create-grid"><Link href="/create" className="wb-create-feature"><div className="wb-create-feature__copy"><span>THE CREATIVE STUDIO</span><h3>从一个想法开始，<br />创造更多可能。</h3><p>面向电商视觉的 AI 创作空间。</p><span className="wb-create-round"><ArrowUpRight size={22} /></span></div><div className="wb-create-feature__image" /></Link><QuickCreateCard title="AI 商品图" description="一张原图，生成多种商业场景。" href="/create?tool=product" icon={Package} tone="sand" /><QuickCreateCard title="AI 模特" description="让服装与真实穿搭自然融合。" href="/create?tool=model" icon={UserRound} tone="rose" /><QuickCreateCard title="AI 换衣" description="快速预览不同风格与款式。" href="/create?tool=tryon" icon={Shirt} tone="sage" /><QuickCreateCard title="AI 视频" description="让静态商品拥有动态表达。" href="/create?tool=video" icon={Video} tone="blue" /></div></section>
    <section className="wb-section"><SectionHeader eyebrow="YOUR WORK" title="最近项目" href="/projects" />{projects.length ? <div className="wb-project-grid">{projects.slice(0, 3).map((project) => <ProjectCard key={project.id} project={project} />)}</div> : <div className="wb-empty"><div className="wb-empty-icon"><Package size={25} /></div><div><h3>还没有项目</h3><p>创建一个项目，把商品与生成内容整理在一起。</p></div><Link href="/projects" className="wb-button wb-button-dark">新建项目 <ArrowUpRight size={15} /></Link></div>}</section>
    <section className="wb-section"><SectionHeader eyebrow="RECENT CREATIONS" title="最近生成内容" href="/assets" />{recentGenerated.length ? <div className="wb-assets-grid">{recentGenerated.slice(0, 4).map((asset) => <AssetCard key={asset.id} asset={asset} preview={previews[asset.id]} />)}</div> : <div className="wb-empty wb-empty--compact"><ImageIcon size={26} /><div><h3>作品即将出现在这里</h3><p>完成第一次创作后，即可集中查看素材。</p></div><Link href="/create">开始创作 <ArrowUpRight size={15} /></Link></div>}</section>
  </main>;
}
