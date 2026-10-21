export type Mode = 'image' | 'video';
export type TaskStatus = 'Queued' | 'Running' | 'Succeeded' | 'Failed' | 'Cancelled';
export type Product = { id: string; name: string; category: string; sku: string; description: string; verifiedFacts?: string; forbiddenClaims?: string; sourceAssetId?: string; image?: string; createdAt: string };
export type Asset = { id: string; name: string; category: string; mime: string; dataUrl?: string; localPath?: string; size?: number; sha256?: string; createdAt: string };
export type TaskSource = 'mock' | 'live';
export type ProductBrief = { id: string; name: string; sku: string; description: string; verifiedFacts: string; forbiddenClaims: string; sourceAssetId: string };
export type Task = { id: string; title: string; prompt: string; mode: Mode; status: TaskStatus; progress: number; createdAt: string; error?: string; workId?: string; source: TaskSource; product?: ProductBrief; referenceAssetIds?: string[]; outputDataUrl?: string; outputMimeType?: string };
export type WorkVersion = { id: string; createdAt: string; prompt: string; assetId?: string; dataUrl?: string; mimeType?: string };
export type Work = { id: string; title: string; mode: Mode; taskId: string; versions: WorkVersion[]; source: TaskSource; product?: ProductBrief };
export type Skill = { id: string; name: string; category: string; kind: 'template' | 'controlled' | 'external'; description: string; input: string; requirement: string };
export type Model = { id: string; name: string; modes: Mode[]; ratios: string[]; resolutions: string[]; maxCount: number; durations?: number[]; creditBase: number; description: string; available?: boolean; provider?: string; icon?: string; logo?: string; channels?: number };
export const SKILLS: Skill[] = [
  { id: 'hero', name: '商品主图', category: '商品展示', kind: 'template', description: '将商品置于干净的电商主图构图。', input: '商品图、提示词', requirement: '图片生成模型' },
  { id: 'scene', name: '场景营销图', category: '营销', kind: 'template', description: '围绕商品生成真实使用场景。', input: '商品图、场景描述', requirement: '图片生成模型' },
  { id: 'outfit', name: 'AI 换衣', category: '服饰', kind: 'external', description: '模特与服装参考图组合。', input: '模特图、服装图', requirement: '图像编辑服务；当前未接入' },
  { id: 'variant', name: 'SKU 变体', category: '商品展示', kind: 'controlled', description: '根据 SKU 文案组织创作参数。', input: '商品、SKU', requirement: '图片生成模型' },
  { id: 'video', name: '商品短视频', category: '视频', kind: 'external', description: '从商品图组织短视频镜头。', input: '商品图、镜头描述', requirement: '视频生成服务；当前未接入' }
];
export const MODELS: Model[] = [
  { id: 'image-balanced', name: 'WEAVIA Pro · Balanced', modes: ['image'], ratios: ['1:1','4:5','16:9'], resolutions: ['1024','2048'], maxCount: 4, creditBase: 8, description: '演示能力：适合商品主图与场景图；尚未连接真实模型目录。' },
  { id: 'image-detail', name: 'WEAVIA Detail', modes: ['image'], ratios: ['1:1','3:4'], resolutions: ['2048'], maxCount: 2, creditBase: 14, description: '演示能力：偏向细节；尚未连接真实模型目录。' },
  { id: 'video-motion', name: 'WEAVIA Motion', modes: ['video'], ratios: ['16:9','9:16'], resolutions: ['720','1080'], maxCount: 1, durations: [5,10], creditBase: 36, description: '演示能力：商品短视频；尚未连接真实模型目录。' }
];
