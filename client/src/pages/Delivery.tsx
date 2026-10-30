import { useEffect, useState } from 'react';
import { reviewOf, withReview } from '../lib/review';
import { useNavigate } from 'react-router-dom';
import { Copy, Download, FileArchive, GalleryHorizontal, Link2, ListTodo, Package } from 'lucide-react';
import { Badge, Button, Card, Dialog, StatePanel } from '../components/ui';
import { useApp } from '../stores/app';
import { useAssetPreview } from '../hooks/useAssetPreview';
import { exportSet } from '../services/export';
import { applyCustomerDecisions, createReviewLink, listReviewLinks, reviewLinkUrl, revokeReviewLink, type ReviewLink } from '../services/reviewLinks';
import { isLiveMode } from '../services/api';
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
  if (reviewOf(work) === 'approved') return 'approved';
  if (reviewOf(work) === 'changes_needed') return 'changes';
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

  const [batchId, setBatchId] = useState('all');
  const [links, setLinks] = useState<ReviewLink[]>([]);
  const [linkBusy, setLinkBusy] = useState(false);
  const [checkedAt, setCheckedAt] = useState(() => Date.now());
  const batchOf = (work: Work) => tasks.find(task => task.id === work.taskId)?.batch;
  const batches = Array.from(new Map(works.map(work => batchOf(work)).filter((batch): batch is NonNullable<typeof batch> => Boolean(batch)).map(batch => [batch.id, batch])).values());
  const inBatch = (work: Work) => batchId === 'all' || batchOf(work)?.id === batchId;
  const visibleWorks = works.filter(work => statusOf(work) === tab && inBatch(work));

  useEffect(() => {
    if (!isLiveMode()) return;
    let active = true;
    const refresh = () => { void listReviewLinks().then(next => { if (!active) return; setLinks(next); setCheckedAt(Date.now()); const changed = applyCustomerDecisions(next); if (changed) notify(`客户更新了 ${changed} 个审阅结果`); }).catch(() => { /* offline: keep last list */ }); };
    refresh();
    const timer = window.setInterval(refresh, 60000);
    return () => { active = false; window.clearInterval(timer); };
  }, [notify]);

  async function shareForReview() {
    const scope = works.filter(work => inBatch(work) && statusOf(work) !== 'changes');
    if (!scope.length) { notify('当前批次没有可发给客户的作品'); return; }
    const batch = batches.find(item => item.id === batchId);
    const title = window.prompt('审阅标题（客户可见）', batch?.title || `作品审阅 · ${new Date().toLocaleDateString('zh-CN')}`);
    if (title === null) return;
    setLinkBusy(true);
    try {
      const result = await createReviewLink(title, scope);
      await navigator.clipboard?.writeText(result.url).catch(() => undefined);
      notify(`审阅链接已复制，7 天内有效${result.skipped ? `；${result.skipped} 个本机作品没有云端结果，未包含` : ''}`);
      setLinks(await listReviewLinks());
    } catch (error) {
      notify(error instanceof Error ? error.message : '生成审阅链接失败');
    } finally {
      setLinkBusy(false);
    }
  }

  async function copyLink(id: string) {
    const url = reviewLinkUrl(id);
    if (!url) { notify('这条链接是在其他设备生成的，请在那台设备复制或重新生成'); return; }
    await navigator.clipboard?.writeText(url).catch(() => undefined);
    notify('链接已复制');
  }

  async function revoke(id: string) {
    if (!window.confirm('撤销后客户将无法再打开这个链接，确定？')) return;
    await revokeReviewLink(id).catch(() => undefined);
    setLinks(await listReviewLinks().catch(() => links));
  }
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
    updateWork(withReview(selected, status));
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
        {isLiveMode() && <Button variant="secondary" disabled={linkBusy} onClick={() => void shareForReview()}><Link2 size={15} /> {linkBusy ? '生成中…' : '发给客户审阅'}</Button>}
        <Button disabled={busy || !exportable.length} onClick={() => void exportCurrent()}><FileArchive size={15} /> {busy ? '导出中…' : `导出整套${exportable.length ? ` (${exportable.length})` : ''}`}</Button>
      </div>
    </div>

    {batches.length > 0 && <div className="delivery-batches" role="group" aria-label="按批次查看">
      <button type="button" className={batchId === 'all' ? 'selected' : ''} onClick={() => setBatchId('all')}><strong>全部作品</strong><small>{works.length} 件</small></button>
      {batches.map(batch => {
        const members = works.filter(work => batchOf(work)?.id === batch.id);
        const approved = members.filter(work => statusOf(work) === 'approved').length;
        const changes = members.filter(work => statusOf(work) === 'changes').length;
        const label = members.length < batch.total ? '生成中' : changes ? '返修中' : approved === members.length ? '可交付' : '待核对';
        return <button type="button" key={batch.id} className={batchId === batch.id ? 'selected' : ''} onClick={() => setBatchId(batch.id)}><strong>{batch.title}</strong><small>{label} · 通过 {approved}/{batch.total}{changes ? ` · 需修改 ${changes}` : ''}</small></button>;
      })}
    </div>}

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
              <Badge tone={reviewOf(work) === 'approved' ? 'success' : reviewOf(work) === 'changes_needed' ? 'danger' : 'warning'}>
                {reviewOf(work) === 'approved' ? '已通过' : reviewOf(work) === 'changes_needed' ? '需修改' : '待核对'}
              </Badge>
              <Badge>{work.mode === 'image' ? '图片' : '视频'}</Badge>
              {work.versions.at(-1)?.customer && <Badge tone={work.versions.at(-1)?.customer?.decision === 'approved' ? 'success' : 'danger'}>客户{work.versions.at(-1)?.customer?.decision === 'approved' ? '已通过' : '要修改'}</Badge>}
            </div>
            <h2>{work.title}</h2>
            <p>{work.product ? `${work.product.name} · ${work.product.sku}` : '未关联商品'} · v{work.versions.length}</p>
            {work.versions.at(-1)?.customer?.note && <p className="delivery-customer-note">客户意见：{work.versions.at(-1)?.customer?.note}</p>}
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

    {links.length > 0 && <section className="delivery-links"><h2>客户审阅链接</h2>{links.slice(0, 8).map(link => {
      const approved = link.decisions.filter(item => item.decision === 'approved').length;
      const changes = link.decisions.filter(item => item.decision === 'changes').length;
      const expired = new Date(link.expiresAt).getTime() < checkedAt;
      return <Card key={link.id} className="delivery-link"><div><strong>{link.title}</strong><small>{link.items.length} 个结果 · 客户通过 {approved} · 要修改 {changes} · {link.status === 'revoked' ? '已撤销' : expired ? '已过期' : `有效至 ${new Date(link.expiresAt).toLocaleDateString('zh-CN')}`}</small></div>{link.status === 'active' && !expired && <div className="header-actions"><Button variant="secondary" onClick={() => void copyLink(link.id)}><Copy size={14} /> 复制链接</Button><Button variant="ghost" onClick={() => void revoke(link.id)}>撤销</Button></div>}</Card>;
    })}</section>}

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
