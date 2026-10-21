import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ImagePlus, RotateCw, Save, Download, SlidersHorizontal } from 'lucide-react';
import { Badge, Button, Card, Field, StatePanel } from '../components/ui';
import { useApp } from '../stores/app';
import { importAsset, loadAssetPreview } from '../services/assets';
import { createLiveEditTask } from '../services/live';
import type { Work } from '../types';

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('导出图片失败'))), type, quality);
  });
}

export function ImageEditingPage() {
  const navigate = useNavigate();
  const route = useLocation();
  const { works, assets, addAsset, addWork, updateWork, notify } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const objectUrlRef = useRef<string | undefined>(undefined);

  const originalWorkId = (route.state as { workId?: string } | null)?.workId;
  const originalWork = works.find(work => work.id === originalWorkId);
  const originalVersion = originalWork?.versions.at(-1);

  const [source, setSource] = useState(originalVersion?.dataUrl || '');
  const [name, setName] = useState(originalWork?.title || '未命名图片');
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assetId, setAssetId] = useState(originalVersion?.assetId || '');
  const [editPrompt, setEditPrompt] = useState('');
  const [editModel, setEditModel] = useState('wanx2.1-imageedit');
  const [aiBusy, setAiBusy] = useState(false);

  useEffect(() => () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); }, []);

  useEffect(() => {
    if (source || !originalVersion?.assetId) return;
    const asset = assets.find(item => item.id === originalVersion.assetId);
    if (!asset) return;
    let active = true;
    loadAssetPreview(asset)
      .then(url => {
        if (!active) { if (url.startsWith('blob:')) URL.revokeObjectURL(url); return; }
        if (url.startsWith('blob:')) objectUrlRef.current = url;
        setSource(url);
        setAssetId(asset.id);
      })
      .catch(() => notify('原图不可读取，请重新导入'));
    return () => { active = false; };
  }, [source, originalVersion?.assetId, assets, notify]);

  useEffect(() => {
    if (!source) return;
    const image = new Image();
    image.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const swap = rotation % 180 !== 0;
      canvas.width = swap ? image.height : image.width;
      canvas.height = swap ? image.width : image.height;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.save();
      context.translate(canvas.width / 2, canvas.height / 2);
      context.rotate(rotation * Math.PI / 180);
      context.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
      context.drawImage(image, -image.width / 2, -image.height / 2);
      context.restore();
    };
    image.src = source;
  }, [source, brightness, contrast, rotation]);

  async function upload(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { notify('请选择图片文件'); return; }
    if (file.size > 15 * 1024 * 1024) { notify('图片不能超过 15 MB'); return; }
    setBusy(true);
    try {
      const asset = await importAsset(file);
      addAsset({ ...asset, category: '参考图' });
      setAssetId(asset.id);
      setSource(await loadAssetPreview(asset));
      setName(file.name.replace(/\.[^.]+$/, ''));
      setBrightness(100); setContrast(100); setRotation(0);
    } catch (error) { notify(error instanceof Error ? error.message : '图片读取失败'); }
    finally { setBusy(false); }
  }

  function getOutput() {
    return canvasRef.current?.toDataURL('image/png') || '';
  }

  function download() {
    const dataUrl = getOutput();
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${name || 'weavia-image'}.png`;
    link.click();
  }

  async function save() {
    const canvas = canvasRef.current;
    if (!canvas) { notify('请先导入图片'); return; }
    setSaving(true);
    try {
      let blob = await canvasToBlob(canvas, 'image/png');
      // Product images can be large; keep the asset under the importer limit.
      if (blob.size > 9 * 1024 * 1024) blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
      const extension = blob.type === 'image/jpeg' ? 'jpg' : 'png';
      const file = new File([blob], `${(name.trim() || 'weavia-image')}.${extension}`, { type: blob.type });
      const asset = await importAsset(file);
      addAsset({ ...asset, category: '作品' });

      const version = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), prompt: `本地编辑 · 亮度 ${brightness}% · 对比度 ${contrast}% · 旋转 ${rotation}°`, assetId: asset.id };
      if (originalWork) {
        updateWork({ ...originalWork, versions: [...originalWork.versions, version] });
      } else {
        const work: Work = { id: crypto.randomUUID(), title: name.trim() || '本地图片', mode: 'image', taskId: 'local-edit', versions: [version], source: 'mock' };
        addWork(work);
      }
      notify('本地编辑版本已保存到作品中心');
      navigate('/works');
    } catch (error) {
      notify(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function aiEdit() {
    const asset = assets.find(item => item.id === assetId);
    if (!asset) { notify('请先从素材中心选择或上传图片'); return; }
    if (!editPrompt.trim()) { notify('请输入编辑要求'); return; }
    setAiBusy(true);
    try {
      const taskId = await createLiveEditTask(editPrompt.trim(), editModel, asset, originalWork?.id);
      navigate('/create', { state: { taskId } });
    } catch (error) { notify(error instanceof Error ? error.message : 'AI 编辑失败'); }
    finally { setAiBusy(false); }
  }

  return (
    <div className="page editor-page">
      <div className="page-header">
        <div><h1>Image Editing</h1><p>用图片模型进行 AI 编辑，同时保留本地亮度/对比度调整。</p></div>
        <div className="header-actions">
          <Button variant="secondary" disabled={!source} onClick={download}><Download size={15} /> 导出 PNG</Button>
          <Button disabled={!source || saving} onClick={() => void save()}><Save size={15} /> {saving ? '保存中…' : '保存作品版本'}</Button>
        </div>
      </div>
      <div className="editor-layout">
        <Card className="editor-stage">
          {source ? <canvas ref={canvasRef} aria-label="图片编辑预览" /> : busy ? <StatePanel type="loading" title="正在读取图片…" /> : <StatePanel type="empty" title="导入图片开始编辑" detail="支持本地 PNG、JPEG、WebP 等图片，最大 15 MB。" action={<Button onClick={() => fileRef.current?.click()}><ImagePlus size={15} /> 导入图片</Button>} />}
        </Card>
        <Card className="editor-controls">
          <h2><SlidersHorizontal size={17} /> 调整</h2>
          <Field label="作品名称"><input value={name} onChange={event => setName(event.target.value)} /></Field>
          <div className="slider-field"><label htmlFor="brightness">亮度 <b>{brightness}%</b></label><input id="brightness" type="range" min="20" max="180" value={brightness} onChange={event => setBrightness(Number(event.target.value))} disabled={!source} /></div>
          <div className="slider-field"><label htmlFor="contrast">对比度 <b>{contrast}%</b></label><input id="contrast" type="range" min="20" max="180" value={contrast} onChange={event => setContrast(Number(event.target.value))} disabled={!source} /></div>
          <Button variant="secondary" disabled={!source} onClick={() => setRotation(value => (value + 90) % 360)}><RotateCw size={15} /> 顺时针旋转 90°</Button>
          <Button variant="ghost" disabled={!source} onClick={() => { setBrightness(100); setContrast(100); setRotation(0); }}>重置调整</Button>
          <hr />
          <Badge>AI 编辑</Badge>
          <Field label="从素材中心选择"><select value={assetId} onChange={async event => { const id = event.target.value; setAssetId(id); const asset = assets.find(item => item.id === id); if (asset) setSource(await loadAssetPreview(asset)); }}><option value="">选择已有素材</option>{assets.map(asset => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></Field>
          <Field label="编辑要求"><textarea value={editPrompt} onChange={event => setEditPrompt(event.target.value)} placeholder="例如：换成暖光咖啡店场景，保留商品外观和文字" rows={3} /></Field>
          <Field label="图片编辑模型"><select value={editModel} onChange={event => setEditModel(event.target.value)}><option value="wanx2.1-imageedit">Wan2.1 Image Edit</option><option value="qwen-image-2.0">Qwen Image 2.0 参考图</option></select></Field>
          <Button disabled={aiBusy || !source || !editPrompt.trim()} onClick={() => void aiEdit()}>{aiBusy ? '提交中…' : 'AI 编辑并生成新版本'}</Button>
          <hr />
          <Badge>本地处理</Badge>
          <p>编辑在本机 Canvas 中完成。保存时写入本地素材库，作品只保留素材引用。</p>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}><ImagePlus size={15} /> {source ? '替换图片' : '导入图片'}</Button>
          <input ref={fileRef} hidden type="file" accept="image/*" onChange={event => { upload(event.target.files?.[0]); event.target.value = ''; }} />
        </Card>
      </div>
    </div>
  );
}
