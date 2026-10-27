import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Ban, Copy, Image as ImageIcon, RotateCcw, Search, Video, XCircle } from 'lucide-react';
import { Badge, Button, Card, Dialog, StatePanel } from '../components/ui';
import { useAssetPreview } from '../hooks/useAssetPreview';
import { cancelTask, runMockTask } from '../services/tasks';
import { retryLiveResult } from '../services/live';
import { isResultSaveFailure } from '../lib/outputs';
import { useApp } from '../stores/app';
import {taskLabel} from '../services/taskState';
import {pendingSubmissions,resumeSubmissions} from '../services/submission';
import type { Task } from '../types';

const statusMeta: Record<Task['status'], { label: string; tone: 'success' | 'danger' | 'warning' | 'neutral' | 'info' }> = {
  Succeeded: { label: '已完成', tone: 'success' },
  Failed: { label: '失败', tone: 'danger' },
  Running: { label: '生成中', tone: 'info' },
  Queued: { label: '排队中', tone: 'neutral' },
  Cancelled: { label: '已取消', tone: 'warning' },
};

function TaskAsset({ id, label }: { id: string; label: string }) {
  const asset = useApp(state => state.assets.find(item => item.id === id));
  const { url } = useAssetPreview(id);
  return <div className="task-input-asset">
    {url ? <img src={url} alt={label} /> : <span>图片不可读取</span>}
    <small>{label}{asset ? ` · ${asset.name}` : ' · 素材已删除'}</small>
  </div>;
}

function CopyId({ value, label }: { value: string; label: string }) {
  const notify = useApp(state => state.notify);
  async function copy() {
    try { await navigator.clipboard.writeText(value); notify(`${label}已复制`); }
    catch { notify('复制失败，请手动选择'); }
  }
  return <button type="button" className="task-id-copy" onClick={() => void copy()} title={`复制${label}`}>
    <code>{value}</code><Copy size={13} aria-hidden="true" />
  </button>;
}

function TaskDetail({ task, onClose }: { task: Task; onClose: () => void }) {
  const navigate = useNavigate();
  const { notify } = useApp();
  const meta = statusMeta[task.status];
  const running = task.status === 'Running' || task.status === 'Queued';
  function retry() {
    onClose();
    navigate('/', { state: { retryPrompt: task.prompt,mode:task.mode,productId:task.product?.id,referenceAssetIds:task.referenceAssetIds,modelId:task.model,channel:task.creative?.channel,market:task.creative?.market,language:task.creative?.language } });
  }
  return <Dialog title="任务详情" onClose={onClose} wide><div className="dialog-content task-detail">
    <div className="task-detail-head"><div><Badge tone={meta.tone}>{taskLabel(task)}</Badge><h2>{task.title}</h2><p>{task.mode === 'image' ? '图片创作' : '视频创作'} · {new Date(task.createdAt).toLocaleString('zh-CN')}</p></div><div className="task-detail-result">{task.outputDataUrl && task.mode === 'video' ? <video controls src={task.outputDataUrl} /> : task.mode === 'video' ? <div className="task-result-placeholder"><Video size={22} /><span>{running ? '视频生成中' : '暂无视频结果'}</span></div> : <div className="task-result-placeholder"><ImageIcon size={22} /><span>{running ? '图片生成中' : '结果在作品中心'}</span></div>}</div></div>
    <div className="task-facts"><div><small>执行来源</small><strong>{task.source === 'live' ? '云端' : '演示'}</strong></div><div><small>当前阶段</small><strong>{taskLabel(task)}</strong></div><div><small>类型</small><strong>{task.mode === 'image' ? '图片' : '视频'}</strong></div><div><small>创建时间</small><strong>{new Date(task.createdAt).toLocaleDateString('zh-CN')}</strong></div></div>
    {task.billing?<section className="task-detail-section"><h3>本次费用</h3><p>预占 {task.billing.reserved} · 实扣 {task.billing.consumed} · 已返还 {task.billing.released} Credits</p><small>结算依据：{task.billing.basis==='submitted'?'按提交结算':task.billing.basis==='delivered'?'按交付结算':'以服务端账本为准'}。重新获取已有文件不扣费，重新生成需确认新报价。</small></section>:<p className="field-hint">暂未读取费用明细，请刷新状态后查看；不根据任务失败推断退款。</p>}{task.syncError&&<p role="status">{task.syncError}</p>}<section className="task-detail-section"><h3>任务标识</h3><div className="task-id-grid"><div><span>平台任务 ID</span><CopyId value={task.id} label="平台任务 ID" /></div></div></section>
    <section className="task-detail-section"><h3>创作描述</h3><p className="task-prompt-full">{task.prompt}</p></section>
    {task.creative && <section className="task-detail-section"><h3>投放资料</h3><p>{task.creative.purpose === 'video' ? '宣传视频' : task.creative.purpose === 'hero' ? '商品主图' : task.creative.purpose === 'scene' ? '场景图' : '宣传图'} · {task.creative.channel} · {task.creative.market} · {task.creative.language}{task.creative.audience ? ` · ${task.creative.audience}` : ''}</p></section>}
    {task.error && <section className="task-detail-section task-error-block"><h3><XCircle size={15} /> 失败原因</h3><p>{task.error}</p><details><summary>技术详情（联系支持时提供）</summary><code>{task.errorCode || 'ERROR'}</code></details></section>}
    {Boolean(task.referenceAssetIds?.length) && <section className="task-detail-section"><h3>参考素材</h3><div className="task-reference-list">{task.referenceAssetIds?.map(id => <TaskAsset key={id} id={id} label="创作参考图" />)}</div></section>}
    {task.product && <section className="task-detail-section"><h3>商品依据</h3><p><b>{task.product.name}</b> · SKU {task.product.sku}</p>{task.product.description && <p>{task.product.description}</p>}</section>}
    <div className="dialog-actions task-detail-actions">
      {task.status === 'Succeeded' && <Button onClick={() => { onClose(); navigate(`/create?task=${task.id}`); }}><ArrowUpRight size={16} /> 查看作品</Button>}
      {(task.status === 'Failed' || task.status === 'Cancelled') && !isResultSaveFailure(task.errorCode) && <Button onClick={retry}><RotateCcw size={16} /> 调整后重新报价</Button>}
      {task.source === 'live' && isResultSaveFailure(task.errorCode) && <Button variant="secondary" onClick={() => { retryLiveResult(task.id); onClose(); }}><RotateCcw size={16} /> 重新获取缺失结果{task.expectedOutputs ? `（${task.savedOutputs?.length ?? 0}/${task.expectedOutputs}）` : ''}</Button>}
      {running && task.source !== 'live' && <Button variant="secondary" onClick={() => { cancelTask(task.id); notify('任务已取消'); onClose(); }}><Ban size={16} /> 取消任务</Button>}
      <Button variant="ghost" onClick={onClose}>关闭</Button>
    </div>
  </div></Dialog>;
}

export function Tasks() {
  const { tasks, updateTask, notify } = useApp();
  const navigate = useNavigate();
  const [pending,setPending]=useState(pendingSubmissions);
  const [recovering,setRecovering]=useState(false);
  useEffect(()=>{const update=()=>setPending(pendingSubmissions());window.addEventListener('weavia:pending',update);return()=>window.removeEventListener('weavia:pending',update);},[]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState('全部');
  const [kind, setKind] = useState('全部');
  const [query, setQuery] = useState('');
  const selected = selectedId ? tasks.find(task => task.id === selectedId) : undefined;
  const counts = { all: tasks.length, running: tasks.filter(item => item.status === 'Running' || item.status === 'Queued').length, success: tasks.filter(item => item.status === 'Succeeded').length, failed: tasks.filter(item => item.status === 'Failed').length };
  const visible = useMemo(() => tasks.filter(task => {
    if(status==='processing'&&!['Running','Queued'].includes(task.status))return false;
    if (status !== '全部' && status!=='processing' && task.status !== status) return false;
    if (kind !== '全部' && task.mode !== kind) return false;
    const needle = query.trim().toLowerCase();
    return !needle || [task.title, task.prompt, task.id, task.error || ''].some(value => value.toLowerCase().includes(needle));
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [tasks, status, kind, query]);
  return <div className="page tasks-page">
    <div className="page-header"><div><h1>任务中心</h1><p>按状态定位任务，查看平台任务编号、失败原因和结果。</p></div><Button onClick={() => navigate('/')}>创建任务</Button></div>
    {pending.length>0&&<section className="pending-submissions"><strong>{pending.length} 项已确认的提交需要核对</strong><p>可能因断网尚未收到受理结果。使用原报价编号核对，不会重复创建同一任务。</p><Button disabled={recovering} onClick={()=>{setRecovering(true);void resumeSubmissions().catch(e=>notify(e.message)).finally(()=>setRecovering(false));}}>{recovering?'正在核对…':'核对并继续'}</Button></section>}<div className="task-stats">
      <button type="button" onClick={() => setStatus('全部')} className={status === '全部' ? 'selected' : ''}><span>全部任务</span><strong>{counts.all}</strong></button>
      <button type="button" onClick={() => setStatus('processing')} className={status === 'processing' ? 'selected' : ''}><span>处理中</span><strong>{counts.running}</strong></button>
      <button type="button" onClick={() => setStatus('Succeeded')} className={status === 'Succeeded' ? 'selected' : ''}><span>已完成</span><strong>{counts.success}</strong></button>
      <button type="button" onClick={() => setStatus('Failed')} className={status === 'Failed' ? 'selected' : ''}><span>失败</span><strong>{counts.failed}</strong></button>
    </div>
    <div className="task-toolbar">
      <div className="search-box"><Search size={16} /><input aria-label="搜索任务" placeholder="搜索描述或平台任务 ID" value={query} onChange={event => setQuery(event.target.value)} /></div>
      <div className="task-filter-pills" role="group" aria-label="任务类型">{[['全部', '全部'], ['image', '图片'], ['video', '视频']].map(([value, label]) => <button type="button" key={value} className={kind === value ? 'selected' : ''} onClick={() => setKind(value)}>{label}</button>)}</div>
      <select aria-label="任务状态筛选" value={status} onChange={event => setStatus(event.target.value)}><option value="全部">全部状态</option><option value="processing">处理中（含排队）</option>{Object.entries(statusMeta).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}</select>
    </div>
    {visible.length ? <div className="task-list">{visible.map(task => {
      const meta = statusMeta[task.status]; const running = task.status === 'Running' || task.status === 'Queued';
      return <Card key={task.id} className={`task-card task-${task.status.toLowerCase()}`}>
        <div className="task-card-status"><Badge tone={meta.tone}>{taskLabel(task)}</Badge><small>{task.mode === 'image' ? '图片' : '视频'}</small></div>
        <div className="task-card-main"><div className="task-card-title"><h2>{task.title}</h2><span>{new Date(task.createdAt).toLocaleString('zh-CN')}</span></div><p>{task.prompt}</p><div className="task-card-ids"><span>平台 <code>{task.id.slice(0, 8)}</code></span></div>{task.error && <p className="task-card-error">{task.error}</p>}{running && <div className="task-card-progress" role="status"><small>{taskLabel(task)} · {task.checkedAt?'最近查询 '+new Date(task.checkedAt).toLocaleTimeString('zh-CN'):'等待查询'}{Date.parse(task.checkedAt||task.createdAt)-Date.parse(task.createdAt)>20*60*1000?' · 用时较长，可刷新状态或联系支持':''}</small><Button variant="ghost" onClick={()=>retryLiveResult(task.id)}>刷新</Button></div>}</div>
        <div className="task-card-actions"><Button variant="secondary" onClick={() => setSelectedId(task.id)}>详情</Button>{task.status === 'Succeeded' && <Button onClick={() => navigate(`/create?task=${task.id}`)}>作品 <ArrowUpRight size={14} /></Button>}{running && task.source !== 'live' && <Button variant="ghost" aria-label="取消任务" onClick={() => { cancelTask(task.id); notify('任务已取消'); }}><Ban size={14} /></Button>}{['Failed', 'Cancelled'].includes(task.status) && task.source !== 'live' && <Button variant="ghost" aria-label="重试任务" onClick={() => { updateTask(task.id, { status: 'Queued', progress: 0, error: undefined }); runMockTask(task.id); }}><RotateCcw size={14} /></Button>}</div>
      </Card>;
    })}</div> : <StatePanel type="empty" title={tasks.length ? '没有匹配的任务' : '还没有任务'} detail={tasks.length ? '换个状态、类型或搜索词试试。' : '从首页填写创作描述后可启动任务。'} action={!tasks.length ? <Button onClick={() => navigate('/')}>前往创作</Button> : <Button variant="secondary" onClick={() => { setStatus('全部'); setKind('全部'); setQuery(''); }}>清除筛选</Button>} />}
    {selected && <TaskDetail task={selected} onClose={() => setSelectedId(null)} />}
  </div>;
}
