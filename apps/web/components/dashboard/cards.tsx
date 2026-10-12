import Link from 'next/link';
import { ArrowUpRight, Image as ImageIcon, Video, type LucideIcon } from 'lucide-react';
import { formatDate, type Asset, type Project } from '../../lib/workbench';

export function SectionHeader({ eyebrow, title, href, linkLabel }: { eyebrow?: string; title: string; href?: string; linkLabel?: string }) {
  return <div className="wb-section-head"><div>{eyebrow && <p className="wb-eyebrow">{eyebrow}</p>}<h2>{title}</h2></div>{href && <Link href={href} className="wb-section-link">{linkLabel ?? '查看全部'} <ArrowUpRight size={16} /></Link>}</div>;
}
export function QuickCreateCard({ title, description, href, icon: Icon, tone }: { title: string; description: string; href: string; icon: LucideIcon; tone: string }) {
  return <article className={`wb-tool-card wb-tool-card--${tone}`}><div className="wb-tool-icon"><Icon size={23} strokeWidth={1.5} /></div><div><h3>{title}</h3><p>{description}</p></div><Link href={href} className="wb-tool-link">开始创作 <ArrowUpRight size={16} /></Link></article>;
}
export function ProjectCard({ project }: { project: Project }) {
  return <Link href={`/projects/${project.id}`} className="wb-project-card"><div className="wb-project-art"><span>WEAVIA / PROJECT</span><strong>{project.name.slice(0, 2)}</strong><ArrowUpRight size={20} /></div><div className="wb-project-copy"><div><h3>{project.name}</h3><span>{formatDate(project.updatedAt)} 更新</span></div><p>{project.productCount} 个商品 <span>·</span> {project.imageCount} 张 AI 图片 <span>·</span> {project.videoCount} 条 AI 视频</p></div></Link>;
}
export function AssetCard({ asset, preview }: { asset: Asset; preview?: string | undefined }) {
  const isVideo = asset.mimeType.startsWith('video/');
  return <article className="wb-asset-card"><div className="wb-asset-art">{preview && !isVideo ? <img src={preview} alt="" /> : isVideo ? <Video size={34} strokeWidth={1.3} /> : <ImageIcon size={34} strokeWidth={1.3} />}<span>{isVideo ? 'VIDEO' : 'IMAGE'}</span></div><div className="wb-asset-copy"><div><h3>{isVideo ? 'AI 视频' : asset.kind === 'generated' ? 'AI 创作图片' : '商品素材'}</h3><small>{formatDate(asset.createdAt)}</small></div><Link href={`/assets/${asset.id}`} aria-label="查看素材">查看 <ArrowUpRight size={14} /></Link></div></article>;
}
