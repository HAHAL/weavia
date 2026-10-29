import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Boxes, Check, ChevronDown, Crown, Image as ImageIcon, SlidersHorizontal, Sparkles, Video, WandSparkles } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Card, Dialog, Field } from '../components/ui';
import { AssetPicker } from '../components/AssetPicker';
import { useApp } from '../stores/app';
import { useAuth } from '../stores/auth';
import { apiConfig } from '../services/api';
import { createTask } from '../services/tasks';
import { MODELS, type CreativeBrief, type Mode, type Model, type ProductBrief } from '../types';
import { FALLBACK_SHOWCASE } from '../data/showcase';
import { loadShowcase } from '../services/showcase';
import { loadPlatformModels } from '../services/models';
import { loadSkills, runSkill, type Skill } from '../services/recipes';
import { trackLiveTask } from '../services/live';
import { createQuote, quoteExpiryLabel, quoteValid, type Quote } from '../services/quote';

const scenes = [
  { title: '商品主图', detail: '突出商品外观，适合上架展示', prompt: '为这件商品制作清晰、准确的电商主图，保持商品外观和文字真实。', mode: 'image' as const, icon: ImageIcon },
  { title: '场景营销图', detail: '把商品放进真实使用场景', prompt: '为这件商品制作真实自然的使用场景图，保持商品外观和文字真实。', mode: 'image' as const, icon: Sparkles },
  { title: '商品短视频', detail: '从商品信息构思短视频', prompt: '围绕这件商品制作简洁的商品短视频，展示外观和使用情境。', mode: 'video' as const, icon: Video },
];

const RATIOS = ['1:1', '4:5', '3:4', '16:9', '9:16'];
const RESOLUTIONS = ['1K', '2K', '4K'];
const GLYPH_COLORS = ['#B08968', '#7F5539', '#9C6644', '#6B705C', '#8D6E63', '#5E548E'];
function glyphColor(name?: string) {
  let hash = 0;
  for (const char of name || '') hash = (hash * 31 + char.codePointAt(0)!) % 997;
  return GLYPH_COLORS[hash % GLYPH_COLORS.length];
}
function ModelGlyph({ icon, name, size = 18 }: { icon?: string; name?: string; size?: number }) {
  if (icon === 'crown') return <Crown size={size} aria-hidden="true" />;
  if (icon === 'wand') return <WandSparkles size={size} aria-hidden="true" />;
  if (icon === 'video') return <Video size={size} aria-hidden="true" />;
  if (name) {
    return <span className="model-glyph" style={{ width: size, height: size, background: glyphColor(name), fontSize: Math.round(size * 0.52) }} aria-hidden="true">{(name.trim()[0] || 'M').toUpperCase()}</span>;
  }
  return <Sparkles size={size} aria-hidden="true" />;
}

function ModelLogo({ model, size = 22 }: { model?: Model; size?: number }) {
  if (model?.logo) return <img className="model-logo" src={model.logo} alt={`${model.name} logo`} width={size} height={size} />;
  return <ModelGlyph icon={model?.icon} name={model?.name} size={size} />;
}

function sizeFor(ratio: string, resolution: string) {
  const long = resolution === '4K' ? 4096 : resolution === '2K' ? 2048 : 1024;
  const short = resolution === '4K' ? 2304 : resolution === '2K' ? 1152 : 576;
  const map: Record<string, string> = {
    '1:1': `${long}x${long}`,
    '4:5': `${Math.round(long * 0.8)}x${long}`,
    '3:4': `${Math.round(long * 0.75)}x${long}`,
    '16:9': `${long}x${short}`,
    '9:16': `${short}x${long}`,
  };
  return map[ratio] || '1024x1024';
}


export function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state as { retryPrompt?: string; prompt?: string; productId?: string; mode?: Mode; channel?: string; market?: string; language?: string; audience?: string; videoRatio?: string; videoDuration?: number } | null;
  const { tasks, works, products, assets } = useApp();
  const user = useAuth(state => state.user);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const modelRef = useRef<HTMLDetailsElement>(null);
  const paramWrapRef = useRef<HTMLDivElement>(null);
  const paramButtonRef = useRef<HTMLButtonElement>(null);
  const [prompt, setPrompt] = useState(routeState?.retryPrompt || routeState?.prompt || '');
  const [mode, setMode] = useState<Mode>(routeState?.mode === 'video' ? 'video' : 'image');
  const [modelId, setModelId] = useState(apiConfig.mode === 'live' ? 'qwen-image-2.0' : 'image-balanced');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showcase, setShowcase] = useState(FALLBACK_SHOWCASE);
  const [modelOptions, setModelOptions] = useState<Model[]>(apiConfig.mode === 'live' ? [] : MODELS);
  const [ratio, setRatio] = useState('1:1');
  const [resolution, setResolution] = useState('1K');
  const [count, setCount] = useState(1);
  const [videoRatio, setVideoRatio] = useState(routeState?.videoRatio || '16:9');
  const [videoResolution, setVideoResolution] = useState('720P');
  const [duration, setDuration] = useState(routeState?.videoDuration || 5);
  const [promptExtend, setPromptExtend] = useState(true);
  const [negativePrompt, setNegativePrompt] = useState('');
  const [seed, setSeed] = useState('');
  const [outputFormat, setOutputFormat] = useState('png');
  const [watermark, setWatermark] = useState(false);
  const [referenceStrength, setReferenceStrength] = useState(0.65);
  const [paramsOpen, setParamsOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const [productId, setProductId] = useState(routeState?.productId || '');
  const [purpose, setPurpose] = useState<CreativeBrief['purpose']>(routeState?.mode === 'video' ? 'video' : 'hero');
  const [channel, setChannel] = useState(routeState?.channel || '通用电商');
  const [market, setMarket] = useState(routeState?.market || '中国大陆');
  const [language, setLanguage] = useState(routeState?.language || '简体中文');
  const [audience, setAudience] = useState(routeState?.audience || '');
  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [paramPlacement, setParamPlacement] = useState<'down' | 'up'>('down');
  const [paramMaxHeight, setParamMaxHeight] = useState(520);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const selectedProduct = products.find(item => item.id === productId);
  const selectedReferences = selectedProduct?.sourceAssetId ? [selectedProduct.sourceAssetId, ...attachmentIds.filter(id => id !== selectedProduct.sourceAssetId)] : attachmentIds;
  const models = modelOptions.filter(item => item.modes.includes(mode) && (mode === 'video' ? item.capabilities?.includes('text_to_video') : !item.capabilities || item.capabilities.includes(selectedReferences.length ? 'image_to_image' : 'text_to_image')));
  // Video stays off until a real video task has succeeded end to end; the
  // server may advertise seedance models long before that is verified.
  const videoEnabled = import.meta.env.VITE_ENABLE_VIDEO === 'true';
  const videoAvailable = videoEnabled && modelOptions.some(item => item.modes.includes('video') && item.capabilities?.includes('text_to_video') && item.available === true && (item.channels || 0) > 0);
  const latestTask = [...tasks].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const showcaseImages = showcase.filter(item => item.kind === 'image');
  const showcaseWorks = showcase.filter(item => item.kind === 'work');
  const selectedModel = models.find(item => item.id === modelId) || models.find(item => item.available !== false) || models[0];
  const resolutionMultiplier = resolution === '4K' ? 4 : resolution === '2K' ? 2 : 1;
  const estimatedCredits = mode === 'video'
    ? (selectedModel?.creditBase || 8)
    : (selectedModel?.creditBase || 8) * count * resolutionMultiplier;
  const [serverQuote, setServerQuote] = useState<Quote | null>(null);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const quoteMode: 'text_to_image' | 'image_to_image' | 'text_to_video' = mode === 'video' ? 'text_to_video' : selectedReferences.length ? 'image_to_image' : 'text_to_image';
  const quoteSize = mode === 'video'
    ? (videoResolution === '1080P' ? (videoRatio === '9:16' ? '1080*1920' : '1920*1080') : (videoRatio === '9:16' ? '720*1280' : '1280*720'))
    : sizeFor(ratio, resolution);
  const quoteCount = mode === 'video' ? 1 : count;
  const quoteModelId = selectedModel?.id || '';
  const credits = serverQuote?.totalCredits ?? estimatedCredits;
  const paramSummary = mode === 'video' ? `${videoRatio} · ${videoResolution} · ${duration}s` : `${ratio} · ${resolution} · ${count} 张`;
  const recommendedModels = models.filter(item => item.available !== false);
  const otherModels = models.filter(item => item.available === false);

  useEffect(() => {
    if (apiConfig.mode !== 'live' || !quoteModelId || !prompt.trim()) {
      const clear = window.setTimeout(() => { setServerQuote(null); setQuoteBusy(false); }, 0);
      return () => window.clearTimeout(clear);
    }
    let active = true;
    const timer = window.setTimeout(() => {
      if (!active) return;
      setQuoteBusy(true);
      createQuote({ model: quoteModelId, mode: quoteMode, prompt: prompt.trim(), size: quoteSize, numberOfImages: quoteCount })
        .then(next => { if (active) setServerQuote(next); })
        .catch(() => { if (active) setServerQuote(null); })
        .finally(() => { if (active) setQuoteBusy(false); });
    }, 500);
    return () => { active = false; window.clearTimeout(timer); };
  }, [quoteModelId, quoteMode, quoteSize, quoteCount, prompt]);

  function chooseProduct(id: string) {
    const previousSource = products.find(item => item.id === productId)?.sourceAssetId;
    setProductId(id);
    setAttachmentIds(current => {
      return current.filter(item => item !== previousSource);
    });
    setError('');
  }

  function modelOption(item: Model) {
    return <button type="button" key={item.id} className={`model-option ${item.id === modelId ? 'selected' : ''}`} disabled={item.available === false} onClick={() => { setModelId(item.id); modelRef.current?.removeAttribute('open'); }}><span className="model-option-icon"><ModelLogo model={item} size={24} /></span><span className="model-option-copy"><strong>{item.name}</strong><small>{item.description || (item.modes.includes('video') ? '视频生成' : '图片生成')}</small></span><span className="model-option-meta">{item.available === false ? <em>维护中</em> : <>{item.creditBase} Credits</>}{item.id === modelId && <Check size={15} aria-hidden="true" />}</span></button>;
  }


  useEffect(() => {
    let active = true;
    loadShowcase().then(items => { if (active) setShowcase(items); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!paramsOpen) return;
    function close(event: MouseEvent) {
      if (!paramWrapRef.current?.contains(event.target as Node)) setParamsOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [paramsOpen]);

  useEffect(() => {
    function closeModel(event: MouseEvent) {
      const picker = modelRef.current;
      if (picker && !picker.contains(event.target as Node)) picker.removeAttribute('open');
    }
    document.addEventListener('mousedown', closeModel);
    return () => document.removeEventListener('mousedown', closeModel);
  }, []);

  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSkillsLoading(true);
    loadSkills().then(items => setSkills(items.filter(item => item.status === 'published'))).catch(() => {}).finally(() => setSkillsLoading(false));
  }, [user]);

  useEffect(() => {
    let active = true;
    loadPlatformModels().then(items => {
      if (!active || !items.length) return;
      setModelOptions(items);
      setModelId(current => items.some(item => item.id === current) ? current : (items.find(item => item.id === 'qwen-image-2.0' && item.available !== false) || items.find(item => item.modes.includes('image') && item.available !== false) || items[0]).id);
    });
    return () => { active = false; };
  }, []);

  function selectMode(nextMode: Mode) {
    if (nextMode === 'video' && !videoAvailable) { setError('视频生成暂未开放，目前可以使用图片创作。'); return; }
    setMode(nextMode);
    setPurpose(nextMode === 'video' ? 'video' : 'hero');
    setError('');
    const candidate = modelOptions.find(item => item.modes.includes(nextMode) && (nextMode !== 'video' || item.capabilities?.includes('text_to_video')) && item.available !== false) || modelOptions.find(item => item.modes.includes(nextMode) && (nextMode !== 'video' || item.capabilities?.includes('text_to_video')));
    if (candidate) setModelId(candidate.id);
    if (nextMode === 'video') { setVideoRatio('16:9'); setVideoResolution('720P'); setDuration(5); setCount(1); }
    else { setRatio('1:1'); setResolution('1K'); setCount(1); }
  }

  function applyShowcase(item: (typeof FALLBACK_SHOWCASE)[number]) {
    setPrompt(item.prompt);
    selectMode('image');
    setError('');
    promptRef.current?.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openParams() {
    const rect = paramButtonRef.current?.getBoundingClientRect();
    if (!rect) { setParamsOpen(true); return; }
    const below = window.innerHeight - rect.bottom - 16;
    const above = rect.top - 16;
    const placement: 'down' | 'up' = below >= 360 || below >= above ? 'down' : 'up';
    setParamPlacement(placement);
    setParamMaxHeight(Math.min(600, Math.max(280, placement === 'down' ? below : above)));
    setParamsOpen(true);
  }

  async function generate(nextPrompt = prompt, nextMode = mode) {
    if (!nextPrompt.trim()) { setError('先描述你想制作的内容，或选择下方场景。'); promptRef.current?.focus(); return; }
    if (selectedProduct && nextMode === 'image' && (!selectedProduct.sourceAssetId || !assets.some(item => item.id === selectedProduct.sourceAssetId))) { setError('商品图片创作需要依据图，请先到商品库补充。'); return; }
    if (nextMode === 'video' && !videoAvailable) { setError('视频服务尚未配置，暂不能提交渲染任务。'); return; }
    setBusy(true);
    setError('');
    try {
      const selectedModel = models.find(item => item.id === modelId) || models.find(item => item.available !== false) || models[0];
      if (!selectedModel || selectedModel.available === false) throw new Error('当前没有可用模型，请先在服务端配置。');
      const product: ProductBrief | undefined = selectedProduct ? { id: selectedProduct.id, name: selectedProduct.name, sku: selectedProduct.sku, description: selectedProduct.description, verifiedFacts: selectedProduct.verifiedFacts || '', forbiddenClaims: selectedProduct.forbiddenClaims || '', sourceAssetId: selectedProduct.sourceAssetId || '' } : undefined;
      const creative: CreativeBrief = { purpose: nextMode === 'video' ? 'video' : purpose === 'video' ? 'hero' : purpose, channel: channel.trim(), market: market.trim(), language: language.trim(), audience: audience.trim(), product: product ? { localId: product.id, name: product.name, sku: product.sku, description: product.description, verifiedFacts: product.verifiedFacts, forbiddenClaims: product.forbiddenClaims } : undefined };
      if (!creative.channel || !creative.market || !creative.language) throw new Error('请填写渠道、市场和输出语言。');
      // Price must come from the server; the local formula is only a hint.
      let quoteId = quoteValid(serverQuote) ? serverQuote.id : '';
      if (apiConfig.mode === 'live' && !quoteId) {
        try {
          const fresh = await createQuote({
            model: selectedModel.id,
            mode: nextMode === 'video' ? 'text_to_video' : selectedReferences.length ? 'image_to_image' : 'text_to_image',
            prompt: nextPrompt.trim(),
            size: nextMode === 'video'
              ? (videoResolution === '1080P' ? (videoRatio === '9:16' ? '1080*1920' : '1920*1080') : (videoRatio === '9:16' ? '720*1280' : '1280*720'))
              : sizeFor(ratio, resolution),
            numberOfImages: nextMode === 'video' ? 1 : count,
          });
          quoteId = fresh.id;
          setServerQuote(fresh);
        } catch {
          quoteId = '';
        }
      }
      const taskId = await createTask({
        prompt: nextPrompt.trim(),
        mode: nextMode,
        modelId: selectedModel.id,
        quoteId,
        params: nextMode === 'video' ? { ratio: videoRatio, resolution: videoResolution, duration, count: 1, promptExtend, size: videoRatio === '9:16' ? (videoResolution === '1080P' ? '1080*1920' : '720*1280') : (videoResolution === '1080P' ? '1920*1080' : '1280*720'), negativePrompt, seed, outputFormat: 'mp4', watermark, referenceStrength } : { ratio, resolution, count, promptExtend, size: sizeFor(ratio, resolution), negativePrompt, seed, outputFormat, watermark, referenceStrength },
        referenceAssetIds: nextMode === 'video' ? [] : selectedReferences,
        product,
        creative,

      });
      navigate('/create', { state: { taskId } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '任务创建失败');
    } finally {
      setBusy(false);
    }
  }

  return <div className="page home-page">
    <section className="home-hero">
      <div className="home-hero-heading"><span className="home-eyebrow">WEAVIA AI Commerce Studio</span><h1>今天，为商品创作什么？</h1><p>描述你的想法，直接生成。结果会留在这次创作会话里。</p></div>
      <div className="creative-brief"><div className="creative-brief-title"><strong>创作资料</strong><span>先确定商品和投放场景，再生成素材</span></div><div className="creative-brief-grid"><label>商品<select value={productId} onChange={event => chooseProduct(event.target.value)}><option value="">自由创作</option>{products.map(item => <option key={item.id} value={item.id}>{item.name} · {item.sku}</option>)}</select></label><label>投放渠道<input list="creative-channels" value={channel} onChange={event => setChannel(event.target.value)} maxLength={80} /><datalist id="creative-channels"><option value="通用电商" /><option value="抖音电商" /><option value="淘宝 / 天猫" /><option value="京东" /><option value="拼多多" /><option value="TikTok Shop" /><option value="Amazon" /><option value="Shopee" /><option value="Lazada" /><option value="独立站" /></datalist></label><label>目标市场<input list="creative-markets" value={market} onChange={event => setMarket(event.target.value)} maxLength={80} /><datalist id="creative-markets"><option value="中国大陆" /><option value="美国" /><option value="东南亚" /><option value="欧洲" /><option value="全球" /></datalist></label><label>输出语言<input list="creative-languages" value={language} onChange={event => setLanguage(event.target.value)} maxLength={32} /><datalist id="creative-languages"><option value="简体中文" /><option value="English" /><option value="Español" /><option value="日本語" /><option value="Bahasa Indonesia" /></datalist></label></div><div className="creative-purpose" role="group" aria-label="创作目标">{(mode === 'video' ? [{ id: 'video', label: '宣传视频' }] : [{ id: 'hero', label: '商品主图' }, { id: 'scene', label: '场景图' }, { id: 'ad', label: '宣传图' }]).map(item => <button type="button" key={item.id} className={purpose === item.id ? 'selected' : ''} onClick={() => setPurpose(item.id as CreativeBrief['purpose'])}>{item.label}</button>)}</div><label className="creative-audience">目标人群（选填）<input value={audience} onChange={event => setAudience(event.target.value)} maxLength={300} placeholder="例如：通勤女性、北美户外爱好者" /></label>{selectedProduct && <p className="creative-product-note">已核实事实：{selectedProduct.verifiedFacts || '尚未填写'} · 依据图：{selectedProduct.sourceAssetId ? '已关联' : '未关联'}</p>}</div>
      <div className="home-composer"><label className="sr-only" htmlFor="home-prompt">创作描述</label><textarea ref={promptRef} id="home-prompt" value={prompt} onChange={event => { setPrompt(event.target.value); setError(''); }} onKeyDown={event => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); void generate(); } }} placeholder="例如：为这款商品制作一张自然光场景图，突出包装和材质…" />
        {mode === 'image' && <AssetPicker selected={selectedReferences} onChange={setAttachmentIds} />}
        <div className="home-composer-footer"><div className="home-composer-controls"><div className="home-mode" role="group" aria-label="创作类型"><button type="button" className={mode === 'image' ? 'selected' : ''} aria-pressed={mode === 'image'} onClick={() => selectMode('image')}><ImageIcon size={16} />图片</button><button type="button" className={mode === 'video' ? 'selected' : ''} aria-pressed={mode === 'video'} disabled={!videoAvailable} aria-describedby={!videoAvailable ? 'video-mode-note' : undefined} onClick={() => selectMode('video')}><Video size={16} />视频</button></div>{!videoAvailable && <span id="video-mode-note" className="home-mode-note">视频生成暂未开放</span>}<button type="button" className="home-agent-trigger" onClick={() => { if (!user) { navigate('/login'); return; } setAgentOpen(true); }}><Boxes size={16} />Agent</button><details className="model-picker" ref={modelRef} onToggle={event => { if (event.currentTarget.open) setParamsOpen(false); }}><summary className="model-trigger"><span className="model-trigger-icon"><ModelLogo model={selectedModel} /></span><span>{selectedModel?.name || '选择模型'}</span><ChevronDown size={14} aria-hidden="true" /></summary><div className="model-popover"><div className="model-popover-head"><span>{mode === 'image' ? '选择图片模型' : '选择视频模型'}</span><small>{models.length} 个</small></div><div className="model-popover-body">{recommendedModels.length > 0 && <div className="model-group"><div className="model-group-label">推荐</div>{recommendedModels.map(modelOption)}</div>}{otherModels.length > 0 && <div className="model-group"><div className="model-group-label">更多模型</div>{otherModels.map(modelOption)}</div>}</div><div className="model-popover-foot">{models.length} 个模型 · 自动选择可用渠道</div></div></details><div className="param-picker-wrap" ref={paramWrapRef}><button type="button" ref={paramButtonRef} className="param-trigger" onClick={() => { if (paramsOpen) { setParamsOpen(false); return; } modelRef.current?.removeAttribute('open'); openParams(); }}><SlidersHorizontal size={15} aria-hidden="true" /><span>参数</span><small>{paramSummary}</small></button>{paramsOpen && mode === 'video' && <VideoParams ratio={videoRatio} resolution={videoResolution} duration={duration} promptExtend={promptExtend} negativePrompt={negativePrompt} seed={seed} watermark={watermark} credits={credits} maxHeight={paramMaxHeight} placement={paramPlacement} onRatio={setVideoRatio} onResolution={setVideoResolution} onDuration={setDuration} onPromptExtend={setPromptExtend} onNegative={setNegativePrompt} onSeed={setSeed} onWatermark={setWatermark} onClose={() => setParamsOpen(false)} />}{paramsOpen && mode !== 'video' && <div className={`param-popover-detail ${paramPlacement === 'up' ? 'above' : ''}`} style={{ maxHeight: paramMaxHeight }} role="dialog" aria-label="图片参数"><header className="param-drawer-head"><div><h2>图片参数</h2><p>参数会随任务一起提交</p></div><button type="button" className="param-close" aria-label="关闭参数" onClick={() => setParamsOpen(false)}>×</button></header><div className="param-drawer-body"><section className="param-section"><h3>基础</h3><div className="param-group"><label>比例</label><div className="param-options">{RATIOS.map(value => <button type="button" key={value} className={ratio === value ? 'selected' : ''} onClick={() => setRatio(value)}>{value}</button>)}</div></div><div className="param-group"><label>清晰度</label><div className="param-options">{RESOLUTIONS.map(value => <button type="button" key={value} className={resolution === value ? 'selected' : ''} onClick={() => setResolution(value)}>{value}</button>)}</div></div><div className="param-group"><label>数量</label><div className="param-options">{[1, 2, 4].map(value => <button type="button" key={value} className={count === value ? 'selected' : ''} onClick={() => setCount(value)}>{value} 张</button>)}</div></div><label className="param-toggle"><span>提示词增强</span><input type="checkbox" checked={promptExtend} onChange={event => setPromptExtend(event.target.checked)} /></label></section><button type="button" className={`param-advanced-toggle ${advancedOpen ? 'open' : ''}`} onClick={() => setAdvancedOpen(value => !value)}>高级设置<ChevronDown size={15} aria-hidden="true" /></button>{advancedOpen && <section className="param-section param-advanced"><label className="param-field">负向提示词<textarea value={negativePrompt} onChange={event => setNegativePrompt(event.target.value)} placeholder="不想出现的内容，例如：文字、水印、变形" rows={3} /></label><label className="param-field">随机种子<input value={seed} onChange={event => setSeed(event.target.value)} placeholder="留空为随机" inputMode="numeric" /></label><div className="param-group"><label>输出格式</label><div className="param-options">{['png', 'jpg'].map(value => <button type="button" key={value} className={outputFormat === value ? 'selected' : ''} onClick={() => setOutputFormat(value)}>{value.toUpperCase()}</button>)}</div></div><label className="param-toggle"><span>水印</span><input type="checkbox" checked={watermark} onChange={event => setWatermark(event.target.checked)} /></label><label className="param-field">参考图强度<span className="param-range"><input type="range" min="0" max="1" step="0.05" value={referenceStrength} disabled onChange={event => setReferenceStrength(Number(event.target.value))} /><b>{referenceStrength.toFixed(2)}</b></span><small>参考图输入将在阶段 2 开放</small></label></section>}</div><footer className="param-drawer-foot"><div className="param-cost"><small>{serverQuote ? '报价' : quoteBusy ? '询价中' : '预估'}</small><strong>{credits} Credits</strong><span>{serverQuote ? `服务端报价 · ${quoteExpiryLabel(serverQuote)} 前有效` : quoteBusy ? '正在获取服务端报价…' : `${selectedModel?.creditBase || 8} × ${count} 张`}</span></div><div className="param-actions"><button type="button" className="param-reset" onClick={() => { setRatio('1:1'); setResolution('1K'); setCount(1); setPromptExtend(true); setNegativePrompt(''); setSeed(''); setOutputFormat('png'); setWatermark(false); setReferenceStrength(0.65); }}>重置</button><button type="button" className="param-apply" onClick={() => setParamsOpen(false)}>应用参数</button></div></footer></div>}</div></div><Button className="home-composer-submit" disabled={busy || (mode === 'video' && !videoAvailable)} onClick={() => void generate()}>{busy ? '创建中…' : <>{mode === 'image' ? '生成图片' : '生成视频'} <ArrowUp size={17} /></>}</Button></div>
      </div>
      {mode === 'video' && <p className="creative-video-note">当前视频生成按文字脚本提交；商品依据图不会送入视频模型。请在作品中心核对外观与文案后再发布。</p>}
      {error && <p className="home-composer-error" role="alert">{error}</p>}
      <div className="home-prompt-chips" aria-label="常用创作场景">{scenes.map(scene => <button type="button" key={scene.title} disabled={scene.mode === 'video' && !videoAvailable} title={scene.mode === 'video' && !videoAvailable ? '视频生成暂未开放' : undefined} onClick={() => { setPrompt(scene.prompt); selectMode(scene.mode); setError(''); }}><scene.icon size={16} aria-hidden="true" />{scene.title}{scene.mode === 'video' && !videoAvailable && <small>暂未开放</small>}</button>)}</div>
    </section>
    <section className="home-section"><div className="section-heading"><div><h2>灵感示例</h2><p>点击任意一张，把提示词带入上方创作框</p></div><span className="badge">示例</span></div><div className="showcase-grid">{showcaseImages.map(item => <button type="button" key={item.id} className="showcase-card" aria-label={`使用示例：${item.title}`} onClick={() => applyShowcase(item)}><img src={item.imageUrl} alt={item.title} loading="lazy" /><span className="showcase-overlay"><strong>{item.title}</strong><small>{item.tag}</small></span></button>)}</div></section>
    {showcaseWorks.length > 0 && <section className="home-section"><div className="section-heading"><div><h2>示例作品</h2><p>后台发布的完整案例，点击查看提示词</p></div><span className="badge">示例</span></div><div className="showcase-grid">{showcaseWorks.map(item => <button type="button" key={item.id} className="showcase-card" aria-label={`使用示例：${item.title}`} onClick={() => applyShowcase(item)}><img src={item.imageUrl} alt={item.title} loading="lazy" /><span className="showcase-overlay"><strong>{item.title}</strong><small>{item.tag}</small></span></button>)}</div></section>}
    <section className="home-section"><div className="section-heading"><div><h2>继续你的工作</h2><p>查看最近的任务与作品</p></div></div><div className="home-recent-grid"><Card className="home-recent"><strong>最近任务</strong>{latestTask ? <><p>{latestTask.title}</p><small>{latestTask.status === 'Succeeded' ? '已完成' : latestTask.status === 'Running' ? '进行中' : latestTask.status === 'Queued' ? '排队中' : latestTask.status === 'Failed' ? '失败' : '已取消'} · {latestTask.source === 'mock' ? '演示任务' : '云端任务'}</small></> : <p>还没有任务</p>}<Button variant="secondary" onClick={() => navigate('/tasks')}>查看任务</Button></Card><Card className="home-recent"><strong>作品中心</strong><p>{works.length ? `已有 ${works.length} 件作品` : '还没有作品'}</p><small>查看版本与继续编辑</small><Button variant="secondary" onClick={() => navigate('/works')}>查看作品</Button></Card></div></section>

    {agentOpen && <AgentDialog skills={skills} loading={skillsLoading} onClose={() => setAgentOpen(false)} onDone={taskId => { setAgentOpen(false); navigate('/create', { state: { taskId } }); }} />}
  </div>;
}


function VideoParams({ ratio, resolution, duration, promptExtend, negativePrompt, seed, watermark, credits, maxHeight, placement, onRatio, onResolution, onDuration, onPromptExtend, onNegative, onSeed, onWatermark, onClose }: { ratio: string; resolution: string; duration: number; promptExtend: boolean; negativePrompt: string; seed: string; watermark: boolean; credits: number; maxHeight: number; placement: 'down' | 'up'; onRatio: (v: string) => void; onResolution: (v: string) => void; onDuration: (v: number) => void; onPromptExtend: (v: boolean) => void; onNegative: (v: string) => void; onSeed: (v: string) => void; onWatermark: (v: boolean) => void; onClose: () => void }) {
  return <div className={`param-popover-detail ${placement === 'up' ? 'above' : ''}`} style={{ maxHeight }} role="dialog" aria-label="视频参数"><header className="param-drawer-head"><div><h2>视频参数</h2><p>视频模型专用参数</p></div><button type="button" className="param-close" aria-label="关闭参数" onClick={onClose}>×</button></header><div className="param-drawer-body"><section className="param-section"><h3>基础</h3><div className="param-group"><label>画面比例</label><div className="param-options">{['16:9', '9:16'].map(value => <button type="button" key={value} className={ratio === value ? 'selected' : ''} onClick={() => onRatio(value)}>{value}</button>)}</div></div><div className="param-group"><label>视频清晰度</label><div className="param-options">{['720P', '1080P'].map(value => <button type="button" key={value} className={resolution === value ? 'selected' : ''} onClick={() => onResolution(value)}>{value}</button>)}</div></div><div className="param-group"><label>时长</label><div className="param-options">{[5, 10].map(value => <button type="button" key={value} className={duration === value ? 'selected' : ''} onClick={() => onDuration(value)}>{value} 秒</button>)}</div></div><label className="param-toggle"><span>提示词增强</span><input type="checkbox" checked={promptExtend} onChange={event => onPromptExtend(event.target.checked)} /></label></section><button type="button" className="param-advanced-toggle" onClick={event => { const panel = event.currentTarget.nextElementSibling as HTMLElement | null; if (panel) panel.hidden = !panel.hidden; }}>高级设置<ChevronDown size={15} aria-hidden="true" /></button><section className="param-section param-advanced" hidden><label className="param-field">负向提示词<textarea value={negativePrompt} onChange={event => onNegative(event.target.value)} placeholder="不想出现的画面" rows={3} /></label><label className="param-field">随机种子<input value={seed} onChange={event => onSeed(event.target.value)} placeholder="留空为随机" inputMode="numeric" /></label><label className="param-toggle"><span>水印</span><input type="checkbox" checked={watermark} onChange={event => onWatermark(event.target.checked)} /></label></section></div><footer className="param-drawer-foot"><div className="param-cost"><small>预计</small><strong>{credits} Credits</strong><span>{duration} 秒 · {resolution}</span></div><div className="param-actions"><button type="button" className="param-reset" onClick={() => { onRatio('16:9'); onResolution('720P'); onDuration(5); onPromptExtend(true); onNegative(''); onSeed(''); onWatermark(false); }}>重置</button><button type="button" className="param-apply" onClick={onClose}>应用参数</button></div></footer></div>;
}

function AgentDialog({ skills, loading, onClose, onDone }: { skills: Skill[]; loading: boolean; onClose: () => void; onDone: (taskId: string) => void }) {
  const [skillId, setSkillId] = useState(skills[0]?.id || '');
  const skill = skills.find(item => item.id === skillId);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [model, setModel] = useState('qwen-image-2.0');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run() {
    if (!skill) { setError('请选择 Skill'); return; }
    setBusy(true); setError('');
    try { const task = await runSkill(skill.id, inputs, model); trackLiveTask(task, skill.name); onDone(task.id); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '执行失败'); }
    finally { setBusy(false); }
  }
  return <Dialog title="Agent 模式" onClose={onClose} wide><div className="dialog-content form-stack"><p>选择一个 Skill，填写输入，系统会按 Skill 模板生成。</p><Field label="Skill"><select value={skillId} onChange={event => { setSkillId(event.target.value); setInputs({}); }}><option value="">{loading ? '加载中…' : skills.length ? '选择 Skill' : '暂无 Skill'}</option>{skills.map(item => <option key={item.id} value={item.id}>{item.name} · {item.category}</option>)}</select></Field>{skill?.manifest?.inputs?.map(input => <Field key={input.key} label={`${input.label}${input.required ? ' *' : ''}`}><input value={inputs[input.key] || ''} onChange={event => setInputs(current => ({ ...current, [input.key]: event.target.value }))} placeholder={input.label} /></Field>)}<Field label="模型"><select value={model} onChange={event => setModel(event.target.value)}><option value="qwen-image-2.0">Qwen Image 2.0</option><option value="qwen-image-max">Qwen Image Max</option></select></Field>{error && <p className="form-error">{error}</p>}<div className="dialog-actions"><Button variant="secondary" onClick={onClose}>取消</Button><Button disabled={busy || !skill} onClick={() => void run()}>{busy ? '执行中…' : '执行 Agent'}</Button></div></div></Dialog>;
}
