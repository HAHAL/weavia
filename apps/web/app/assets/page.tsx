'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Images } from 'lucide-react';
import { AssetCard } from '../../components/dashboard/cards';
import { useAssetPreviews } from '../../components/dashboard/use-asset-previews';
import { apiGet, type Asset } from '../../lib/workbench';

type Filter = '全部' | '图片' | '视频' | '模板';
export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [filter, setFilter] = useState<Filter>('全部');
  const [error, setError] = useState('');
  useEffect(() => { void apiGet<Asset[]>('/assets').then(setAssets).catch((e: Error) => setError(e.message)); }, []);
  const filtered = assets.filter((asset) => filter === '全部' || (filter === '图片' && asset.mimeType.startsWith('image/')) || (filter === '视频' && asset.mimeType.startsWith('video/')) || (filter === '模板' && asset.kind === 'template'));
  const previews = useAssetPreviews(assets);
  return <main className="wb-page"><header className="wb-page-head"><div><p className="wb-eyebrow">YOUR CREATIVE LIBRARY</p><h1>素材库<span className="wb-gold">.</span></h1><p>所有创作成果，尽在一处。</p></div><span className="wb-count">{assets.length} 件素材</span></header><div className="wb-tabs" role="tablist" aria-label="素材分类">{(['全部', '图片', '视频', '模板'] as Filter[]).map((item) => <button key={item} role="tab" aria-selected={filter === item} onClick={() => setFilter(item)}>{item}</button>)}</div>{error && <p className="wb-error" role="alert">{error}</p>}{filtered.length ? <div className="wb-assets-grid wb-assets-grid--page">{filtered.map((asset) => <AssetCard key={asset.id} asset={asset} preview={previews[asset.id]} />)}</div> : <div className="wb-empty wb-empty--large"><div className="wb-empty-icon"><Images size={28} /></div><h2>{filter === '全部' ? '素材库还没有内容' : `暂无${filter}素材`}</h2><p>完成 AI 创作后，作品会集中保存在这里。</p><Link className="wb-button wb-button-dark" href="/create">开始创作</Link></div>}</main>;
}
