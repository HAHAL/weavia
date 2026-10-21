export type ShowcaseKind = 'image' | 'work';

export type ShowcaseItem = {
  id: string;
  kind: ShowcaseKind;
  title: string;
  tag: string;
  prompt: string;
  imageUrl: string;
};

// Bundled offline fallback. The published library comes from /api/showcase.
export const FALLBACK_SHOWCASE: ShowcaseItem[] = [
  {
    id: 'perfume',
    kind: 'image',
    title: '香水 · 琥珀光',
    tag: '美妆 / 暖调',
    prompt: '将无品牌琥珀色香水瓶置于奶油色洞石台面上，左上方暖色方向光，柔和长阴影，米白无缝背景，高级商业静物摄影，突出玻璃折射与金色瓶盖，留白构图。',
    imageUrl: '/showcase/perfume.jpg',
  },
  {
    id: 'skincare',
    kind: 'image',
    title: '护肤 · 亚麻晨光',
    tag: '护肤 / 自然光',
    prompt: '将无品牌磨砂护肤霜罐放在象牙白亚麻布上，旁边一片尤加利叶，清晨柔和窗光，奶油色背景，高级护肤品牌静物摄影，大面积留白。',
    imageUrl: '/showcase/skincare.jpg',
  },
  {
    id: 'coffee',
    kind: 'image',
    title: '咖啡 · 金带包装',
    tag: '食品 / 暖调',
    prompt: '无品牌哑光黑色咖啡包装袋，宽金色横带，放在浅色橡木架上，暖色咖啡店侧光，浅景深，奶油色背景，高级包装摄影。',
    imageUrl: '/showcase/coffee.jpg',
  },
  {
    id: 'candle',
    kind: 'image',
    title: '香氛 · 烛光',
    tag: '家居 / 暖光',
    prompt: '将无品牌琥珀色玻璃香氛蜡烛放在奶油色大理石上，烛火点燃，柔和暖光，极简米色背景，高级家居香氛产品摄影，真实蜡质纹理。',
    imageUrl: '/showcase/candle.jpg',
  },
  {
    id: 'foundation',
    kind: 'image',
    title: '底妆 · 纸感',
    tag: '美妆 / 极简',
    prompt: '无品牌磨砂米色粉底液瓶，黑色漆面瓶盖与细金环，放在撕开的牛皮纸上，干净顶光，柔和阴影，高级美妆静物摄影。',
    imageUrl: '/showcase/foundation.jpg',
  },
  {
    id: 'serum',
    kind: 'image',
    title: '精华 · 水光',
    tag: '护肤 / 冷调',
    prompt: '透明玻璃精华滴管瓶置于湿润玻璃面上，金色滴管盖，冷调蓝白背景，细微水波与反光，无品牌标签，高级护肤编辑摄影。',
    imageUrl: '/showcase/serum.jpg',
  },
];
