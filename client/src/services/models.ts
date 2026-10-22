import { apiConfig, apiRequest } from './api';
import { MODELS, type Mode, type Model } from '../types';
import { getCachedModels } from './sync';

type ServerModel = {
  id: string;
  displayName: string;
  provider: string;
  modality: string;
  capabilities: string[];
  available: boolean;
  creditsCost?: number;
  channels?: number;
  icon?: string;
};

function logoFor(item: ServerModel) {
  const id = item.id.toLowerCase();
  if (id.includes('happyhorse')) return '/models/happyhorse.svg';
  if (id.includes('qwen')) return '/models/qwen.svg';
  if (id.includes('wan') || id.includes('wanx')) return '/models/bailian.svg';
  if (id.includes('agentar')) return '/models/alibabacloud.svg';
  return '';
}

function iconFor(item: ServerModel) {
  const id = item.id.toLowerCase();
  if (id.includes('video') || id.includes('t2v') || id.includes('i2v') || id.includes('r2v')) return 'video';
  if (id.includes('edit') || id.includes('imageedit')) return 'wand';
  if (id.includes('max') || id.includes('pro')) return 'crown';
  return 'sparkles';
}

function toModel(item: ServerModel): Model {
  return {
    id: item.id,
    name: item.displayName || item.id,
    modes: [item.modality === 'video' ? 'video' : 'image'],
    capabilities: item.capabilities,
    ratios: item.modality === 'video' ? ['16:9', '9:16'] : ['1:1', '4:5', '3:4', '16:9', '9:16'],
    resolutions: ['1K', '2K'],
    maxCount: 4,
    creditBase: item.creditsCost || 8,
    description: (item.capabilities || []).map(capabilityLabel).join(' · '),
    available: item.available,
    provider: item.provider,
    icon: item.icon || iconFor(item),
    logo: logoFor(item),
    channels: item.channels,
  };
}

function capabilityLabel(value: string) {
  const labels: Record<string, string> = { text_to_image: '文生图', image_to_image: '参考图', image_edit: '图像编辑', text_to_video: '文生视频', image_to_video: '图生视频' };
  return labels[value] || value;
}

function dedupe(items: Model[]) {
  const map = new Map<string, Model>();
  for (const item of items) {
    const key = `${item.modes.join(',')}:${item.name.toLowerCase()}`;
    const current = map.get(key);
    if (!current || (item.available && !current.available)) map.set(key, item);
  }
  return [...map.values()];
}

export async function loadPlatformModels(mode?: Mode): Promise<Model[]> {
  if (apiConfig.mode !== 'live') return MODELS;
  const cached = getCachedModels();
  if (cached?.length) {
    const normalized = dedupe(cached.map(item => {
      if (Array.isArray((item as Model).modes)) return item as Model;
      return toModel(item as unknown as ServerModel);
    }));
    return mode ? normalized.filter(item => item.modes.includes(mode)) : normalized;
  }
  try {
    const suffix = mode ? `?modality=${mode}` : '';
    const data = await apiRequest<{ items: ServerModel[] }>(`/api/ai/models${suffix}`, {}, { auth: false });
    const items = dedupe((data.items || []).map(toModel));
    return items;
  } catch {
    return [];
  }
}
