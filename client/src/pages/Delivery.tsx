import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, FileArchive, GalleryHorizontal, ListTodo, Package } from 'lucide-react';
import { Badge, Button, Card, Dialog, StatePanel } from '../components/ui';
import { useApp } from '../stores/app';
import { useAssetPreview } from '../hooks/useAssetPreview';
import { exportSet } from '../services/export';
import type { Work } from '../types';

type Tab = 'review' | 'approved' | 'changes' | 'running' | 'failed';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'review', label: '待核对' },
  { id: 'approved', label: '已通过' },
  { id: 'changes', label: '需修改' },
  { id: 'running', label: '生成中' },
  { id: 'failed', label: '失败' },
];

function statusOf(work: Work): Tab {
  if (work.reviewStatus === 'approved') return 'approved';
  if (work.reviewStatus === 'changes_needed') return 'changes';
  return 'review';
}

function WorkThumb({ work }: { work: Work }) {
  const version = work.versions.at(-1);
  const { url } = useAssetPreview(version?.assetId, version?.dataUrl);
  return (
    <div className="delivery-thumb">
      {url ? (work.mode === 'video'
        ? <video src={url} muted preload="metadata" aria-label={work.title} />
        : <img src={url} alt={work.title} loading="lazy" />)
        : <><GalleryHorizontal size={34} /><span>暂无预览</span></>}
    </div>
  );
}

export function DeliveryPage() {
  const { works, tasks, updateWork, notify } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('review');
  const [selected, setSelected] = useState<Work | null>(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);

  const visibleWorks = works.filter(work => statusOf(work) === tab);
  const runningTasks = tasks.filter(task => task.status === 'Queued' || task.status === 'Running');
  const failedTasks = tasks.filter(task => task.status === 'Failed');
  const counts: Record<Tab, number> = {
    review: works.filter(work => statusOf(work) === 'review').length,
    approved: works.filter(work => statusOf(work) === 'approved').length,
    changes: works.filter(work => statusOf(work) === 'changes').length,
    running: runningTasks.length,
    failed: failedTasks.length,
  };
  const selectedVersion = selected?.versions[version];
  const { url: selectedUrl } = useAssetPreview(selectedVersion?.assetId, selectedVersion?.dataUrl);
  const exportable = visibleWorks.filter(work => work.versions.at(-1)?.dataUrl || work.versions.at(-1)?.assetId);

  function open(work: Work) {
    setSelected(work);
    setVersion(work.versions.length - 1);
  }

  function review(status: 'approved' | 'changes_needed') {
    if (!selected) return;
    updateWork({ ...selected, reviewStatus: status } as Work);
    setSelected(null);
    notify(status === 'approved' ? '已标记为核对通过' : '已标记为需要修改');
  }

  async function exportCurrent() {
    if (!exportable.length) { notify('当前分类没有可导出的作品'); return; }
    setBusy(true);
    try {
      const result = await exportSet(exportable);
      if (!result.count) { notify('这些作品还没有可用的图片数据'); return; }
      if (!result.saved) { notify('已取消导出'); return; }
      notify(`已导出 ${result.count} 个文件${result.skipped.length ? `，${result.skipped.length} 个缺少图片被跳过` : ''}`);
    } catch (error) {
      notify(error instanceof Error ? error.message : '导出失败');
    } finally {
      setBusy(false);
    }
  }

  return <div className="page delivery-page">
    <div className="page-header">
      <div><h1>交付台</h1><p>一套图从生成到核对到导出，都在这里收口。</p></div>
      <div className="header-actions">
        <Button variant="secondary" onClick={() => navigate('/tasks')}><ListTodo size={15} /> 任务中心</Button>
        <Button disabled={busy || !exportable.length} onClick={() => void exportCurrent()}><FileArchive size={15} /> {busy ? '导出中…' : `导出整套${exportable.length ? ` (${exportable.length})` : ''}`}</Button>
      </div>
    </div>

    <div className="delivery-tabs" role="tablist" aria-label="交付状态">
      {TABS.map(item => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'selected' : ''} onClick={() => setTab(item.id)}>
        {item.label}<span className="delivery-count">{counts[item.id]}</span>
      </button>)}
    </div>

    {(tab === 'running' || tab === 'failed') ? (
      <div className="delivery-list">
        {(tab === 'running' ? runningTasks : failedTasks).length ? (tab === 'running' ? runningTasks : failedTasks).map(task => (
          <Card key={task.id} className="delivery-task">
            <div><Badge tone={tab === 'failed' ? 'danger' : 'warning'}>{tab === 'failed' ? '失败' : '生成中'}</Badge><strong>{task.title}</strong><p>{task.prompt}</p></div>
            <div className="delivery-task-meta"><span>{new Date(task.createdAt).toLocaleString('zh-CN')}</span>{task.error && <span className="delivery-task-error">{task.error}</span>}</div>
          </Card>
        )) : <StatePanel type="empty" title={tab === 'running' ? '没有正在生成的图' : '没有失败的任务'} detail={tab === 'running' ? '提交后会出现在这里。' : '失败的任务可以在任务中心查看原因。'} action={<Button variant="secondary" onClick={() => navigate('/tasks')}>去任务中心</Button>} />}
      </div>
    ) : visibleWorks.length ? (
      <div className="delivery-grid">
        {visibleWorks.map(work => <Card key={work.id} className="delivery-card">
          <WorkThumb work={work} />
          <div className="delivery-card-body">
            <div className="delivery-card-badges">
              <Badge tone={work.reviewStatus === 'approved' ? 'success' : work.reviewStatus === 'changes_needed' ? 'danger' : 'warning'}>
                {work.reviewStatus === 'approved' ? '已通过' : work.reviewStatus === 'changes_needed' ? '需修改' : '待核对'}
              </Badge>
              <Badge>{work.mode === 'image' ? '图片' : '视频'}</Badge>
            </div>
            <h2>{work.title}</h2>
            <p>{work.product ? `${work.product.name} · ${work.product.sku}` : '未关联商品'} · v{work.versions.length}</p>
            <div className="delivery-card-actions">
              <Button variant="secondary" onClick={() => open(work)}><Package size={14} /> 查看</Button>
            </div>
          </div>
        </Card>)}
      </div>
    ) : (
      <StatePanel
        type="empty"
        title={tab === 'review' ? '没有待核对的作品' : tab === 'approved' ? '还没有通过的图' : '没有需要修改的图'}
        detail={tab === 'review' ? '生成完成后会进入待核对。' : '在待核对里标记后会归到这里。'}
        action={tab === 'review' ? <Button onClick={() => navigate('/')}>开始创作</Button> : undefined}
      />
    )}

    {selected && <Dialog title={selected.title} onClose={() => setSelected(null)} wide>
      <div className="dialog-content">
        <div className="work-preview">
          {selectedUrl ? (selected.mode === 'video'
            ? <video src={selectedUrl} controls aria-label={selected.title} />
            : <img src={selectedUrl} alt={selected.title} />)
            : <><GalleryHorizontal size={44} /><strong>暂无预览</strong></>}
        </div>
        <div className="version-row">
          <strong>版本</strong>
          {selected.versions.map((item, index) => <button key={item.id} className={version === index ? 'selected' : ''} onClick={() => setVersion(index)}>v{index + 1}</button>)}
        </div>
        <p className="muted">{selected.product ? `${selected.product.name} · SKU ${selected.product.sku} · ` : ''}{new Date(selectedVersion?.createdAt || selected.versions[0].createdAt).toLocaleString('zh-CN')}</p>
        {selectedVersion?.prompt && <p className="muted">{selectedVersion.prompt}</p>}
        <div className="work-review">
          <strong>运营核对</strong>
          <p>检查商品外观、文字、已核实事实与目标市场要求，通过后再进入导出。</p>
          <div className="dialog-actions">
            <Button variant="secondary" onClick={() => review('changes_needed')}>需要修改</Button>
            <Button onClick={() => review('approved')}>核对通过</Button>
            {selectedUrl && <Button asChild variant="secondary"><a href={selectedUrl} download={`${selected.title}-v${version + 1}.${selected.mode === 'video' ? 'mp4' : 'png'}`}><Download size={14} /> 下载本张</a></Button>}
          </div>
        </div>
      </div>
    </Dialog>}
  </div>;
}
