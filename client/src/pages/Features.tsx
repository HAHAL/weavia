import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowUpRight, Shirt, Image as ImageIcon, Video, FileImage, Layers3 } from 'lucide-react';
import { Badge, Button, Card } from '../components/ui';
import type { Mode } from '../types';
const apps:{title:string;description:string;prompt:string;mode:Mode;icon:typeof Sparkles}[]=[
  {title:'商品主图生成',description:'生成符合渠道规范的展示图。',prompt:'为商品制作干净的电商主图，突出材质和轮廓。',mode:'image',icon:ImageIcon},
  {title:'AI 模特',description:'用模特场景展示服饰商品。',prompt:'让模特自然展示服装，保持商品细节准确。',mode:'image',icon:Shirt},
  {title:'AI 换衣',description:'组合模特图与服装参考。',prompt:'将参考服装穿在模特身上，保留面部与姿态。',mode:'image',icon:Shirt},
  {title:'爆款复刻',description:'参考热门构图重新创作。',prompt:'参考上传图片的构图，为我的商品创建原创营销图。',mode:'image',icon:Sparkles},
  {title:'详情页生成',description:'组织产品卖点与展示图。',prompt:'围绕商品卖点生成详情页视觉内容。',mode:'image',icon:FileImage},
  {title:'SKU 变体',description:'为不同规格制作统一视觉。',prompt:'为每个 SKU 变体生成一致的商品图片。',mode:'image',icon:Layers3},
  {title:'商品短视频',description:'构思商品视频镜头。',prompt:'制作展示商品细节和使用场景的短视频。',mode:'video',icon:Video}
];
export function FeaturePage(){const navigate=useNavigate();return <div className="page"><div className="page-header"><div><h1>AI 应用</h1><p>选择电商创作场景，快速进入创作工作台。</p></div><Badge>模型能力演示</Badge></div><div className="quick-grid">{apps.map(app=><Card key={app.title} className="feature-card"><app.icon size={23}/><h2>{app.title}</h2><p>{app.description}</p><Button variant="secondary" onClick={()=>navigate('/create',{state:{prompt:app.prompt,mode:app.mode}})}>填写创作需求 <ArrowUpRight size={15}/></Button></Card>)}</div><p className="footnote">应用提供提示词起点；真实模型服务及各应用的专属处理能力尚未接入。</p></div>}
