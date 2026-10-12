'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Download, Image as ImageIcon } from 'lucide-react';
import { apiGet, formatDate, type Asset } from '../../../lib/workbench';

export default function AssetDetailPage() {
  const id = useParams<{ id: string }>().id;
  const [asset, setAsset] = useState<Asset>();
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { void apiGet<Asset[]>('/assets').then((items) => { const found = items.find((item) => item.id === id); if (!found) throw new Error('找不到这件素材'); setAsset(found); return found.mimeType.startsWith('image/') ? apiGet<{ dataUrl: string }>(`/assets/${id}/preview`).then((item) => setPreview(item.dataUrl)) : undefined; }).catch((e: Error) => setError(e.message)); }, [id]);
  return <main className="wb-page"><Link className="wb-back" href="/assets"><ArrowLeft size={16} /> 返回素材库</Link>{error && <p className="wb-error" role="alert">{error}</p>}{asset && <><header className="wb-page-head"><div><p className="wb-eyebrow">CREATIVE ASSET</p><h1>{asset.mimeType.startsWith('video/') ? 'AI 视频' : asset.kind === 'generated' ? 'AI 创作图片' : '商品素材'}</h1><p>创建于 {formatDate(asset.createdAt)}</p></div>{preview && <a className="wb-button wb-button-dark" href={preview} download={`weavia-${asset.id}`}><Download size={16} /> 下载素材</a>}</header><div className="wb-asset-detail-preview">{preview ? asset.mimeType.startsWith('video/') ? <video controls src={preview} /> : <img src={preview} alt="创作素材预览" /> : <div><ImageIcon size={38} /><p>预览暂不可用</p></div>}</div></>}</main>;
}
