'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, FolderOpen } from 'lucide-react';
import { AssetCard } from '../../../components/dashboard/cards';
import { useAssetPreviews } from '../../../components/dashboard/use-asset-previews';
import { apiGet, formatDate, type Asset, type Project } from '../../../lib/workbench';

export default function ProjectDetailPage() {
  const id = useParams<{ id: string }>().id;
  const [project, setProject] = useState<Project>();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [error, setError] = useState('');
  const previews = useAssetPreviews(assets);
  useEffect(() => { void Promise.all([apiGet<Project[]>('/projects'), apiGet<Asset[]>('/assets')]).then(([projects, allAssets]) => { const found = projects.find((item) => item.id === id); if (!found) throw new Error('找不到这个项目'); setProject(found); setAssets(allAssets.filter((item) => item.projectId === id)); }).catch((e: Error) => setError(e.message)); }, [id]);
  return <main className="wb-page"><Link className="wb-back" href="/projects"><ArrowLeft size={16} /> 返回我的项目</Link>{error && <p className="wb-error" role="alert">{error}</p>}{project && <><header className="wb-page-head"><div><p className="wb-eyebrow">PROJECT OVERVIEW</p><h1>{project.name}<span className="wb-gold">.</span></h1><p>最近更新于 {formatDate(project.updatedAt)}</p></div><Link href="/create" className="wb-button wb-button-dark">继续创作 <ArrowUpRight size={16} /></Link></header><div className="wb-project-stats"><div><span>商品</span><strong>{project.productCount}</strong></div><div><span>AI 图片</span><strong>{project.imageCount}</strong></div><div><span>AI 视频</span><strong>{project.videoCount}</strong></div></div><section className="wb-section"><div className="wb-section-head"><div><p className="wb-eyebrow">PROJECT LIBRARY</p><h2>项目素材</h2></div></div>{assets.length ? <div className="wb-assets-grid">{assets.map((item) => <AssetCard key={item.id} asset={item} preview={previews[item.id]} />)}</div> : <div className="wb-empty wb-empty--compact"><FolderOpen size={26} /><div><h3>还没有项目素材</h3><p>开始创作后，相关素材会出现在这里。</p></div></div>}</section></>}</main>;
}
