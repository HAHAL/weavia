import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GalleryHorizontal, Pencil } from 'lucide-react';
import { Badge, Button, Card, Dialog, StatePanel } from '../components/ui';
import { useApp } from '../stores/app';
import { useAssetPreview } from '../hooks/useAssetPreview';
import type { Work } from '../types';

function WorkThumb({ work }: { work: Work }) {
  const version = work.versions.at(-1);
  const { url } = useAssetPreview(version?.assetId, version?.dataUrl);
  return (
    <div className="work-placeholder">
      {url ? <img src={url} alt={work.title} /> : <><GalleryHorizontal size={38} /><span>演示结果占位</span></>}
    </div>
  );
}

export function Works() {
  const { works, tasks, updateWork, notify } = useApp();
  const [tab, setTab] = useState<'works' | 'tasks'>('works');
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Work | null>(null);
  const [version, setVersion] = useState(0);
  const [prompt, setPrompt] = useState('');
  const selectedVersion = selected?.versions[version];
  const { url: selectedUrl } = useAssetPreview(selectedVersion?.assetId, selectedVersion?.dataUrl);

  function open(work: Work) {
    setSelected(work);
    setVersion(work.versions.length - 1);
    setPrompt(work.versions.at(-1)?.prompt || '');
  }

  function save() {
    if (!selected || !prompt.trim()) return;
    const base = selected.versions[version];
    const next: Work = {
      ...selected,
      versions: [...selected.versions, { id: crypto.randomUUID(), createdAt: new Date().toISOString(), prompt: prompt.trim(), assetId: base?.assetId, dataUrl: base?.dataUrl }],
    };
    updateWork(next);
    setSelected(next);
    setVersion(next.versions.length - 1);
    notify('作品新版本已保存');
  }

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>作品中心</h1><p>预览生成结果，查看生成记录。</p></div><div className="works-tabs"><button type="button" className={tab === 'works' ? 'selected' : ''} onClick={() => setTab('works')}>作品</button><button type="button" className={tab === 'tasks' ? 'selected' : ''} onClick={() => setTab('tasks')}>生成记录</button></div>
      </div>
      {tab === 'tasks' ? <div className="list-stack">{tasks.length ? tasks.map(task => <Card key={task.id} className="task-row"><div className="task-main"><div><Badge>{task.source === 'live' ? '云端' : '演示'}</Badge><h2>{task.title}</h2><p>{task.prompt}</p></div><span className={`badge ${task.status === 'Succeeded' ? 'badge-success' : task.status === 'Failed' ? 'badge-danger' : ''}`}>{task.status === 'Succeeded' ? '已完成' : task.status === 'Running' ? '生成中' : task.status === 'Queued' ? '排队中' : task.status === 'Failed' ? '失败' : '已取消'}</span></div><small>{new Date(task.createdAt).toLocaleString('zh-CN')}{task.error ? ` · ${task.error}` : ''}</small></Card>) : <StatePanel type="empty" title="还没有生成记录" detail="完成一次生成后会出现在这里。" />}</div> : works.length ? (
        <div className="work-grid">
          {works.map(work => (
            <Card key={work.id} className="work-card">
              <WorkThumb work={work} />
              <div className="work-info">
                <Badge>{work.mode === 'image' ? '图片' : '视频'}</Badge>
                <h2>{work.title}</h2>
                <p>{work.product ? `${work.product.name} · ` : ''}{work.versions.length} 个版本 · {work.taskId === 'local-edit' ? '本地编辑' : work.source === 'live' ? '云端作品' : '演示作品'}</p>
                <Button variant="secondary" onClick={() => open(work)}>查看作品</Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <StatePanel type="empty" title="还没有作品" detail="完成演示任务后，这里会出现作品记录。当前不会生成真实图片或视频。" action={<Button onClick={() => navigate('/')}>开始创作</Button>} />
      )}
      {selected && (
        <Dialog title={selected.title} onClose={() => setSelected(null)} wide>
          <div className="dialog-content">
            <div className="work-preview">
              {selectedUrl ? <img src={selectedUrl} alt={`${selected.title} 版本 ${version + 1}`} /> : <><GalleryHorizontal size={50} /><strong>演示结果占位</strong><span>尚未连接真实 AI 生成服务</span></>}
            </div>
            <div className="version-row">
              <strong>版本</strong>
              {selected.versions.map((item, index) => (
                <button key={item.id} className={version === index ? 'selected' : ''} onClick={() => { setVersion(index); setPrompt(item.prompt); }}>v{index + 1}</button>
              ))}
            </div>
            <p className="muted">创建于 {new Date(selectedVersion?.createdAt || selected.versions[0].createdAt).toLocaleString('zh-CN')}</p>
            {selected.product && <p className="muted">关联商品：{selected.product.name} · SKU {selected.product.sku}</p>}
            <label className="field"><span>继续编辑提示词</span><textarea value={prompt} onChange={event => setPrompt(event.target.value)} /></label>
            <div className="dialog-actions">
              <Button variant="secondary" onClick={() => { setSelected(null); navigate('/image-editing', { state: { workId: selected.id } }); }}><Pencil size={15} /> 打开编辑台</Button>
              <Button disabled={!prompt.trim()} onClick={save}>保存新版本</Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
