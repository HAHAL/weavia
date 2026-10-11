export const capabilities = [
  { number: '01', title: 'AI 模特', english: 'MODEL', description: '以商品为中心，探索模特、姿势与场景组合。', image: 'coat-model', status: '核心能力' },
  { number: '02', title: 'AI 商拍', english: 'CAMPAIGN', description: '让商品进入适合品牌表达的商业场景。', image: 'perfume-scene', status: '核心能力' },
  { number: '03', title: 'AI 换衣', english: 'TRY-ON', description: '探索服饰在不同人物与搭配中的视觉呈现。', image: 'coat-detail', status: '规划中' },
  { number: '04', title: 'AI 详情页', english: 'DETAIL', description: '把商品视觉组织成更完整的页面叙事。', image: 'perfume-detail', status: '规划中' },
  { number: '05', title: 'AI 视频', english: 'MOTION', description: '从静态商品视觉延伸到动态内容表达。', image: 'coat-outdoor', status: '规划中' },
] as const;

export const steps = [
  { number: '01', title: '上传商品', description: '从一张清晰的商品图片开始。' },
  { number: '02', title: '选择创作模式', description: '根据目标选择模特或商拍方向。' },
  { number: '03', title: 'AI 生成', description: '确认参数与预计消耗后提交任务。' },
  { number: '04', title: '下载使用', description: '查看结果，挑选适合的视觉作品。' },
] as const;
