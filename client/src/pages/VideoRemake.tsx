import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clapperboard, Download, Film, Play, Upload, WandSparkles } from 'lucide-react';
import { Badge, Button, Card, StatePanel } from '../components/ui';
import { useApp } from '../stores/app';
import { apiRequest } from '../services/api';
import { createTask } from '../services/tasks';
import { loadPlatformModels } from '../services/models';
import { importAsset, loadAssetPreview } from '../services/assets';
import { composeClips } from '../services/videoCompose';
import type { Model, Product, ProductBrief } from '../types';

type Shot = { start: number; duration: number; framing: string; camera: string; visual: string; caption: string; voice: string };
type Structure = { hook: string; rhythm: string; music: string; shots: Shot[] };
type ShotState = { status: 'idle' | 'frame' | 'video' | 'done' | 'failed'; error?: string; frameTask?: string; videoTask?: string; videoAssetId?: string };

const FRAME_WIDTH = 640;

// Samples evenly spaced key frames from a local video as small JPEG data URLs.
async function sampleFrames(file: File, count: number): Promise<{ frames: string[]; times: number[]; duration: number }> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement('video');
    video.src = url;
    video.muted = true;
    video.preload = 'auto';
    await new Promise<void>((resolve, reject) => { video.onloadedmetadata = () => resolve(); video.onerror = () => reject(new Error('视频无法读取，请换 MP4 文件')); });
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('无法识别视频时长');
    if (duration > 180) throw new Error('参考视频不能超过 3 分钟');
    const canvas = document.createElement('canvas');
    canvas.width = FRAME_WIDTH;
    canvas.height = Math.round(FRAME_WIDTH * (video.videoHeight / video.videoWidth || 16 / 9));
    const ctx = canvas.getContext('2d')!;
    const frames: string[] = [];
    const times: number[] = [];
    for (let i = 0; i < count; i += 1) {
      const at = Math.min(duration - 0.05, (duration * (i + 0.5)) / count);
      video.currentTime = at;
      await new Promise<void>(resolve => { video.onseeked = () => resolve(); });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL('image/jpeg', 0.72));
      times.push(Number(at.toFixed(1)));
    }
    return { frames, times, duration };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Resolves when the task has produced a saved work, or rejects if it failed.
function waitForWork(taskId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const check = () => {
      const state = useApp.getState();
      const task = state.tasks.find(item => item.id === taskId);
      const work = state.works.find(item => item.taskId === taskId);
      const assetId = work?.versions.at(-1)?.assetId;
      if (assetId) { stop(); resolve(assetId); return; }
      if (task && (task.status === 'Failed' || task.status === 'Cancelled')) { stop(); reject(new Error(task.error || '生成失败')); }
    };
    const stop = useApp.subscribe(check);
    check();
  });
}

function seedanceDuration(seconds: number) {
  return seconds > 7 ? 10 : 5;
}

function productBrief(product: Product): ProductBrief {
  return { id: product.id, name: product.name, sku: product.sku, description: product.description, verifiedFacts: product.verifiedFacts || '', forbiddenClaims: product.forbiddenClaims || '', sourceAssetId: product.sourceAssetId || '' };
}

export function VideoRemakePage() {
  const navigate = useNavigate();
  const { products, assets, notify, addAsset } = useApp();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState('');
  const [structure, setStructure] = useState<Structure | null>(null);
  const [productId, setProductId] = useState('');
  const [imageModels, setImageModels] = useState<Model[]>([]);
  const [videoModels, setVideoModels] = useState<Model[]>([]);
  const [imageModel, setImageModel] = useState('');
  const [videoModel, setVideoModel] = useState('');
  const [shots, setShots] = useState<ShotState[]>([]);
  const [music, setMusic] = useState<File | null>(null);
  const [output, setOutput] = useState('');
  const running = useRef(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    void loadPlatformModels().then(models => {
      const image = models.filter(item => item.modes.includes('image') && item.capabilities?.includes('image_to_image') && item.available !== false);
      const video = models.filter(item => item.modes.includes('video') && item.capabilities?.includes('image_to_video') && item.available !== false);
      setImageModels(image); setVideoModels(video);
      setImageModel(current => current || image[0]?.id || '');
      setVideoModel(current => current || video[0]?.id || '');
    }).catch(() => notify('模型列表读取失败'));
  }, [notify]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const product = products.find(item => item.id === productId);
  const productReady = Boolean(product?.sourceAssetId && assets.some(item => item.id === product.sourceAssetId));

  function choose(next: File | undefined) {
    if (!next) return;
    if (!['video/mp4', 'video/quicktime', 'video/webm'].includes(next.type)) { notify('请选择 MP4 / MOV / WebM 视频'); return; }
    setFile(next); setStructure(null); setShots([]); setOutput('');
    setPreview(URL.createObjectURL(next));
  }

  async function analyze() {
    if (!file || !rights) return;
    setBusy('正在抽取关键帧…');
    try {
      const { frames, times, duration } = await sampleFrames(file, 8);
      setBusy('正在拆解分镜…');
      const result = await apiRequest<Structure>('/api/video-remakes/analyze', { method: 'POST', body: JSON.stringify({ frames, times, duration }) }, { timeoutMs: 150000 });
      setStructure(result);
      setShots(result.shots.map(() => ({ status: 'idle' })));
    } catch (error) {
      notify(error instanceof Error ? error.message : '拆解失败');
    } finally {
      setBusy('');
    }
  }

  function editShot(index: number, patch: Partial<Shot>) {
    setStructure(current => current ? { ...current, shots: current.shots.map((shot, i) => i === index ? { ...shot, ...patch } : shot) } : current);
  }
  function setShot(index: number, patch: Partial<ShotState>) {
    setShots(current => current.map((item, i) => i === index ? { ...item, ...patch } : item));
  }

  async function generateShot(index: number) {
    if (!structure || !product || !imageModel || !videoModel) return;
    const shot = structure.shots[index];
    const brief = productBrief(product);
    try {
      setShot(index, { status: 'frame', error: undefined });
      const framePrompt = `${shot.visual}。画面主体是商品「${product.name}」，严格保持商品外观、颜色、包装文字与参考图一致，竖版 9:16 构图，${shot.framing || ''}`.slice(0, 1800);
      const frameTask = await createTask({ prompt: framePrompt, mode: 'image', modelId: imageModel, product: brief, referenceAssetIds: [product.sourceAssetId!], params: { ratio: '9:16', resolution: '1K', count: 1, size: '576x1024', promptExtend: true } });
      setShot(index, { frameTask });
      const frameAsset = await waitForWork(frameTask);
      setShot(index, { status: 'video' });
      const motion = `${shot.camera || '轻微推镜'}，${shot.visual}，商品外观保持不变`.slice(0, 1800);
      const videoTask = await createTask({ prompt: motion, mode: 'video', modelId: videoModel, product: brief, referenceAssetIds: [frameAsset], params: { ratio: '9:16', resolution: '720P', count: 1, duration: seedanceDuration(shot.duration), size: '720*1280', promptExtend: true } });
      setShot(index, { videoTask });
      const videoAsset = await waitForWork(videoTask);
      setShot(index, { status: 'done', videoAssetId: videoAsset });
    } catch (error) {
      setShot(index, { status: 'failed', error: error instanceof Error ? error.message : '生成失败' });
    }
  }

  async function generateAll() {
    if (!structure || running.current) return;
    const pending = structure.shots.map((_, i) => i).filter(i => shots[i]?.status !== 'done');
    if (!window.confirm(`将为 ${pending.length} 个镜头各提交 1 次首帧图 + 1 次视频生成，按各模型价格扣 Credits。继续？`)) return;
    running.current = true;
    setGenerating(true);
    for (const index of pending) await generateShot(index);
    running.current = false;
    setGenerating(false);
  }

  async function compose() {
    if (!structure) return;
    const ready = structure.shots.map((shot, i) => ({ shot, assetId: shots[i]?.videoAssetId })).filter(item => item.assetId);
    if (ready.length !== structure.shots.length) { notify('还有镜头没有生成完成'); return; }
    setBusy('正在本机合成成片（按实际时长实时录制）…');
    try {
      const clips = await Promise.all(ready.map(async ({ shot, assetId }) => {
        const asset = useApp.getState().assets.find(item => item.id === assetId);
        if (!asset) throw new Error('镜头视频文件丢失');
        return { url: await loadAssetPreview(asset), caption: shot.caption, seconds: shot.duration };
      }));
      const blob = await composeClips(clips, { music: music || undefined, onProgress: (done, total) => setBusy(`正在本机合成成片… ${done}/${total}`) });
      const extension = blob.type.includes('mp4') ? 'mp4' : 'webm';
      const fileName = `${product?.name || '复刻'}-成片.${extension}`;
      const asset = await importAsset(new File([blob], fileName, { type: blob.type }));
      addAsset({ ...asset, category: '作品' });
      setOutput(URL.createObjectURL(blob));
      notify('成片已合成并保存到素材中心');
    } catch (error) {
      notify(error instanceof Error ? error.message : '合成失败');
    } finally {
      setBusy('');
    }
  }

  const allDone = Boolean(structure && shots.length && shots.every(item => item.status === 'done'));
  const shotLabel: Record<ShotState['status'], string> = { idle: '待生成', frame: '生成首帧中', video: '生成视频中', done: '已完成', failed: '失败' };

  return <div className="page remake-page">
    <div className="page-header"><div><span className="home-eyebrow">测试版</span><h1>爆款视频复刻</h1><p>上传一条参考视频，拆出镜头结构，换成你的商品逐镜重拍，再在本机合成竖版成片。只复刻结构和节奏，不复用原视频的画面、音乐和人物。</p></div></div>

    <Card className="remake-step">
      <h2><Upload size={18} /> 1. 上传参考视频</h2>
      <div className="remake-upload">
        {preview ? <video src={preview} controls className="remake-preview" /> : <label className="remake-drop"><Film size={28} /><span>选择 MP4 / MOV（3 分钟以内）</span><input type="file" accept="video/mp4,video/quicktime,video/webm" hidden onChange={event => choose(event.target.files?.[0])} /></label>}
        <div className="remake-upload-side">
          {preview && <label className="btn btn-secondary">重新选择<input type="file" accept="video/mp4,video/quicktime,video/webm" hidden onChange={event => choose(event.target.files?.[0])} /></label>}
          <label className="remake-rights"><input type="checkbox" checked={rights} onChange={event => setRights(event.target.checked)} /> 我有权使用该视频作为结构参考，生成内容不会复用其画面、音乐与人物</label>
          <Button disabled={!file || !rights || Boolean(busy)} onClick={() => void analyze()}><WandSparkles size={16} /> 拆解分镜</Button>
          <small className="muted">只上传 8 张缩略关键帧用于分析，原视频不离开本机。</small>
        </div>
      </div>
    </Card>

    {busy && <p className="remake-busy" role="status">{busy}</p>}

    {structure && <Card className="remake-step">
      <h2><Clapperboard size={18} /> 2. 确认分镜</h2>
      <p className="muted">开头钩子：{structure.hook || '—'} · 节奏：{structure.rhythm || '—'} · 配乐：{structure.music || '—'}</p>
      <div className="remake-shots">{structure.shots.map((shot, index) => <div key={index} className="remake-shot">
        <div className="remake-shot-head"><strong>镜头 {index + 1}</strong><input type="number" min={1} max={10} step={0.5} value={shot.duration} onChange={event => editShot(index, { duration: Number(event.target.value) || 1 })} aria-label={`镜头 ${index + 1} 时长`} /><span>秒</span><Badge tone={shots[index]?.status === 'done' ? 'success' : shots[index]?.status === 'failed' ? 'danger' : 'neutral'}>{shotLabel[shots[index]?.status || 'idle']}</Badge></div>
        <label className="field"><span>画面（{shot.framing || '景别未知'} · {shot.camera || '运镜未知'}）</span><textarea value={shot.visual} onChange={event => editShot(index, { visual: event.target.value })} /></label>
        <label className="field"><span>字幕</span><input value={shot.caption} onChange={event => editShot(index, { caption: event.target.value })} /></label>
        {shots[index]?.error && <p className="form-error">{shots[index].error}</p>}
        {shots[index]?.status === 'failed' && <Button variant="secondary" onClick={() => void generateShot(index)}>重做这个镜头</Button>}
      </div>)}</div>
    </Card>}

    {structure && <Card className="remake-step">
      <h2><Play size={18} /> 3. 换成你的商品并生成</h2>
      {products.length ? <div className="remake-form">
        <label className="field"><span>商品（需要有依据图）</span><select value={productId} onChange={event => setProductId(event.target.value)}><option value="">选择商品</option>{products.map(item => <option key={item.id} value={item.id}>{item.name} · {item.sku}</option>)}</select></label>
        <label className="field"><span>首帧图片模型</span><select value={imageModel} onChange={event => setImageModel(event.target.value)}>{imageModels.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="field"><span>图生视频模型</span><select value={videoModel} onChange={event => setVideoModel(event.target.value)}>{videoModels.length ? videoModels.map(item => <option key={item.id} value={item.id}>{item.name}</option>) : <option value="">暂无可用图生视频模型</option>}</select></label>
      </div> : <StatePanel type="empty" title="还没有商品" detail="先在商品库添加商品和依据图。" action={<Button onClick={() => navigate('/products')}>去商品库</Button>} />}
      {product && !productReady && <p className="form-error">这个商品在本机没有依据图，请先到商品库补充。</p>}
      <Button disabled={!productReady || !imageModel || !videoModel || generating} onClick={() => void generateAll()}>生成全部镜头</Button>
    </Card>}

    {structure && <Card className="remake-step">
      <h2><Film size={18} /> 4. 本机合成成片</h2>
      <label className="field"><span>背景音乐（可选，请使用可商用音乐）</span><input type="file" accept="audio/*" onChange={event => setMusic(event.target.files?.[0] || null)} /></label>
      <Button disabled={!allDone || Boolean(busy)} onClick={() => void compose()}>合成 9:16 成片</Button>
      {output && <div className="remake-output"><video src={output} controls /><Button asChild variant="secondary"><a href={output} download={`${product?.name || '复刻'}-成片`}><Download size={15} /> 下载成片</a></Button><p className="muted">成片含 AI 生成内容，发布到平台时请按平台要求标注。</p></div>}
    </Card>}
  </div>;
}
