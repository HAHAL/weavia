import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Ban, RotateCcw } from 'lucide-react';
import { Badge, Button, Card, Dialog, StatePanel } from '../components/ui';
import { useAssetPreview } from '../hooks/useAssetPreview';
import { cancelTask, runMockTask } from '../services/tasks';
import { useApp } from '../stores/app';
import type { Task } from '../types';

const tone = (status: Task['status']) => status === 'Succeeded' ? 'success' : status === 'Failed' ? 'danger' : status === 'Running' ? 'info' : status === 'Cancelled' ? 'warning' : 'neutral';

function TaskAsset({ id, label }: { id: string; label: string }) {
  const asset = useApp(state => state.assets.find(item => item.id === id));
  const { url } = useAssetPreview(id);
  return <div className="task-input-asset">
    {url ? <img src={url} alt={label} /> : <span>图片不可读取</span>}
    <small>{label}{asset ? ` · ${asset.name}` : ' · 素材已删除'}</small>
  </div>;
}

export function Tasks() {
  const { tasks, updateTask, notify } = useApp();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Task | null>(null);
  const [filter, setFilter] = useState('全部');
  const visible = tasks.filter(task => filter === '全部' || task.status === filter);
  const current = selected ? tasks.find(task => task.id === selected.id) : undefined;

  return <div className="page">
    <div className="page-header"><div><h1>任务中心</h1><p>查看任务的排队、执行和完成状态。</p></div><Button onClick={() => navigate('/create')}>创建任务</Button></div>
    <div className="filter-bar"><select aria-label="任务状态筛选" value={filter} onChange={event => setFilter(event.target.value)}>{['全部', 'Queued', 'Running', 'Succeeded', 'Failed', 'Cancelled'].map(value => <option key={value}>{value}</option>)}</select><Badge>{tasks.some(task => task.source === 'live') ? '云端执行' : 'Mock 执行'}</Badge></div>
    {visible.length ? <div className="list-stack">{visible.map(task => <Card key={task.id} className="task-row">
      <div className="task-main"><div><Badge tone={tone(task.status)}>{task.status}</Badge><h2>{task.title}</h2><p>{task.mode === 'image' ? '图片' : '视频'}创作 · {task.product ? `${task.product.name} / ${task.product.sku} · ` : ''}{task.source === 'live' ? '云端执行' : '演示执行'} · {new Date(task.createdAt).toLocaleString('zh-CN')}</p></div>
        <div className="task-actions"><Button variant="secondary" onClick={() => setSelected(task)}>详情</Button>{task.status === 'Succeeded' && <Button onClick={() => navigate('/works')}>查看作品</Button>}{['Queued', 'Running'].includes(task.status) && task.source !== 'live' && <Button variant="ghost" onClick={() => { cancelTask(task.id); notify('任务已取消'); }}><Ban size={14} /> 取消</Button>}{['Failed', 'Cancelled'].includes(task.status) && task.source !== 'live' && <Button variant="secondary" onClick={() => { updateTask(task.id, { status: 'Queued', progress: 0, error: undefined }); runMockTask(task.id); }}><RotateCcw size={14} /> 重试</Button>}</div>
      </div>
      <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={task.progress} aria-label={`进度 ${task.progress}%`}><span style={{ width: `${task.progress}%` }} /></div><small>进度 {task.progress}%</small>
    </Card>)}</div> : <StatePanel type="empty" title={tasks.length ? '没有匹配状态的任务' : '还没有任务'} detail="从首页填写创作描述后可启动任务。" action={<Button onClick={() => navigate('/create')}>前往创作</Button>} />}
    {selected && <Dialog title="任务详情" onClose={() => setSelected(null)} wide><div className="dialog-content form-stack">
      <p><b>创作描述：</b>{selected.prompt}</p>
      {selected.product && <div className="task-product-brief"><h3>商品依据</h3><p><b>{selected.product.name}</b> · SKU {selected.product.sku}</p>{selected.product.description && <p>商品描述：{selected.product.description}</p>}{selected.product.verifiedFacts && <p>已核实事实：{selected.product.verifiedFacts}</p>}{selected.product.forbiddenClaims && <p>不可添加：{selected.product.forbiddenClaims}</p>}<TaskAsset id={selected.product.sourceAssetId} label="商品依据图" /></div>}
      {Boolean(selected.referenceAssetIds?.length) && <div className="task-product-brief"><h3>参考图</h3><div className="task-reference-list">{selected.referenceAssetIds?.map(id => <TaskAsset key={id} id={id} label="创作参考图" />)}</div></div>}
      <p><b>状态：</b>{current?.status}</p><p><b>进度：</b>{current?.progress}%</p>{current?.error && <p role="alert">失败原因：{current.error}</p>}
      <p className="muted">任务 ID：{selected.id} · {selected.source === 'live' ? '云端执行' : '演示执行'}</p>
      {current?.workId && <Button onClick={() => { setSelected(null); navigate('/works'); }}><ArrowUpRight size={16} /> 查看作品</Button>}
    </div></Dialog>}
  </div>;
}
