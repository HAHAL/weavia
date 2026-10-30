import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GalleryHorizontal, Pencil } from 'lucide-react';
import { Badge, Button, Card, Dialog, StatePanel } from '../components/ui';
import { useApp } from '../stores/app';
import { useAssetPreview } from '../hooks/useAssetPreview';
import { apiConfig } from '../services/api';
import { createLiveEditTask } from '../services/live';
import type { Work } from '../types';
import { reviewOf, withNewVersion, withReview } from '../lib/review';
import { saveWorkAsTemplate } from '../services/templates';

function WorkThumb({ work }: { work: Work }) {
  const version = work.versions.at(-1);
  const { url } = useAssetPreview(version?.assetId, version?.dataUrl);
  return (
    <div className="work-placeholder">
      {url ? work.mode === 'video' ? <video src={url} muted preload="metadata" aria-label={work.title} /> : <img src={url} alt={work.title} /> : <><GalleryHorizontal size={38} /><span>演示结果占位</span></>}
    </div>
  );
}

export function Works() {
  const { works, tasks, assets, updateWork, notify } = useApp();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Work | null>(null);
  const [version, setVersion] = useState(0);
  const [prompt, setPrompt] = useState('');
  const [saving, setSaving] = useState(false);
  const selectedVersion = selected?.versions[version];
  const sourceAsset = selectedVersion?.assetId ? assets.find(item => item.id === selectedVersion.assetId) : undefined;
  const canRegenerate = apiConfig.mode === 'live' && selected?.mode === 'image' && sourceAsset?.mime.startsWith('image/');
  const { url: selectedUrl } = useAssetPreview(selectedVersion?.assetId, selectedVersion?.dataUrl);

  function open(work: Work) {
    setSelected(work);
    setVersion(work.versions.length - 1);
    setPrompt(work.versions.at(-1)?.prompt || '');
  }

  async function save() {
    if (!selected || !prompt.trim()) return;
    if (canRegenerate && sourceAsset) {
      setSaving(true);
      try {
        const taskId = await createLiveEditTask(prompt.trim(), 'wanx2.1-imageedit', sourceAsset, selected.id);
        setSelected(null);
        navigate('/create', { state: { taskId } });
      } catch (cause) { notify(cause instanceof Error ? cause.message : '重新生成失败'); }
      finally { setSaving(false); }
      return;
    }
    const base = selected.versions[version];
    const next = withNewVersion(selected, { id: crypto.randomUUID(), createdAt: new Date().toISOString(), prompt: prompt.trim(), assetId: base?.assetId, dataUrl: base?.dataUrl, mimeType: base?.mimeType });
    updateWork(next);
    setSelected(next);
    setVersion(next.versions.length - 1);
    notify('仅保存提示词：没有可用的上一版图片，未触发重新生成');
  }

  function review(status: 'approved' | 'changes_needed') {
    if (!selected) return;
    const next = withReview(selected, status);
    updateWork(next);
    setSelected(next);
    notify(status === 'approved' ? '已标记为核对通过' : '已标记为需要修改');
  }

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>作品中心</h1><p>预览生成结果、管理版本。生成过程和失败任务在任务中心查看。</p></div><Button variant="secondary" onClick={() => navigate('/tasks')}>任务中心</Button>
      </div>
      {works.length ? (
        <div className="work-grid">
          {works.map(work => (
            <Card key={work.id} className="work-card">
              <WorkThumb work={work} />
              <div className="work-info">
                <Badge>{work.mode === 'image' ? '图片' : '视频'}</Badge> <Badge tone={reviewOf(work) === 'approved' ? 'success' : reviewOf(work) === 'changes_needed' ? 'danger' : 'warning'}>{reviewOf(work) === 'approved' ? '已核对' : reviewOf(work) === 'changes_needed' ? '需修改' : '待核对'}</Badge>
                <h2>{work.title}</h2>
                <p>{work.product ? `${work.product.name} · ` : ''}{work.versions.length} 个版本 · {work.taskId === 'local-edit' ? '本地编辑' : work.source === 'live' ? '云端作品' : '演示作品'}</p>
                <Button variant="secondary" onClick={() => open(work)}>查看作品</Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <StatePanel type="empty" title="还没有作品" detail="生成结果会保存在这里，可按版本核对与下载。" action={<Button onClick={() => navigate('/')}>开始创作</Button>} />
      )}
      {selected && (
        <Dialog title={selected.title} onClose={() => setSelected(null)} wide>
          <div className="dialog-content">
            <div className="work-preview">
              {selectedUrl ? selected.mode === 'video' ? <video src={selectedUrl} controls aria-label={`${selected.title} 版本 ${version + 1}`} /> : <img src={selectedUrl} alt={`${selected.title} 版本 ${version + 1}`} /> : <><GalleryHorizontal size={50} /><strong>演示结果占位</strong><span>尚未连接真实 AI 生成服务</span></>}
            </div>
            <div className="version-row">
              <strong>版本</strong>
              {selected.versions.map((item, index) => (
                <button key={item.id} className={version === index ? 'selected' : ''} onClick={() => { setVersion(index); setPrompt(item.prompt); }}>v{index + 1}</button>
              ))}
            </div>
            <p className="muted">创建于 {new Date(selectedVersion?.createdAt || selected.versions[0].createdAt).toLocaleString('zh-CN')}</p>
            {selected.product && <p className="muted">关联商品：{selected.product.name} · SKU {selected.product.sku}</p>}
            <div className="work-review"><strong>运营核对</strong><p>发布前检查商品外观、文字、已核实事实、禁用声明和目标市场要求。</p><div className="dialog-actions"><Button variant="secondary" onClick={() => review('changes_needed')}>需要修改</Button><Button onClick={() => review('approved')}>核对通过</Button>{selectedUrl && <Button asChild variant="secondary"><a href={selectedUrl} download={`${selected.title}-${version + 1}.${selected.mode === 'video' ? 'mp4' : 'png'}`}>下载当前版本</a></Button>}</div></div>
            <label className="field"><span>继续编辑提示词</span><textarea value={prompt} onChange={event => setPrompt(event.target.value)} /></label>
            <div className="dialog-actions">
              <Button variant="secondary" onClick={() => { setSelected(null); navigate('/image-editing', { state: { workId: selected.id } }); }}><Pencil size={15} /> 打开编辑台</Button>
              <Button variant="secondary" onClick={() => { const title = window.prompt('模板名称', selected.title); if (title === null) return; saveWorkAsTemplate(selected, tasks.find(task => task.id === selected.taskId), title); notify('已存为我的模板，可在「模板库 → 我的模板」一键复用'); }}>存为我的模板</Button>
              <Button disabled={!prompt.trim() || saving} onClick={() => void save()}>{saving ? '提交中…' : canRegenerate ? '重新生成新版本' : '仅保存提示词'}</Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
