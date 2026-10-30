import { ArrowLeft, ArrowUpRight, GalleryHorizontal, WandSparkles } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Badge, Button, Card, StatePanel } from '../components/ui';
import { useAssetPreview } from '../hooks/useAssetPreview';
import { reviewOf, withReview } from '../lib/review';
import type { Task, Work } from '../types';
import { useApp } from '../stores/app';

const statusLabel: Record<string, string> = {
  Queued: '排队中',
  Running: '生成中',
  Succeeded: '已完成',
  Failed: '失败',
  Cancelled: '已取消',
};
const statusTone: Record<string, 'neutral' | 'warning' | 'success' | 'danger'> = {
  Queued: 'neutral',
  Running: 'warning',
  Succeeded: 'success',
  Failed: 'danger',
  Cancelled: 'neutral',
};

function BatchItem({ task, work, active, onOpen }: { task: Task; work?: Work; active: boolean; onOpen: () => void }) {
  const version = work?.versions.at(-1);
  const { url } = useAssetPreview(version?.assetId, version?.dataUrl);
  const review = work ? reviewOf(work) : undefined;
  const label = !work ? statusLabel[task.status] || task.status : review === 'approved' ? '已通过' : review === 'changes_needed' ? '需修改' : '待核对';
  return <button type="button" className={`batch-item ${active ? 'active' : ''}`} onClick={onOpen} aria-label={`${task.title}：${label}`}>
    <span className="batch-thumb">{url ? <img src={url} alt="" /> : <GalleryHorizontal size={20} aria-hidden="true" />}</span>
    <small>{(task.batch?.index ?? 0) + 1}. {label}</small>
  </button>;
}

// One product's whole set on one screen: pick any output, review it, download
// it, or open the editor, without going through the task list.
function BatchStrip({ task }: { task: Task }) {
  const navigate = useNavigate();
  const { tasks, works, updateWork, notify } = useApp();
  if (!task.batch) return null;
  const siblings = tasks.filter(item => item.batch?.id === task.batch!.id).sort((a, b) => (a.batch?.index ?? 0) - (b.batch?.index ?? 0));
  const workOf = (item: Task) => works.find(work => work.taskId === item.id);
  const current = workOf(task);
  const done = siblings.filter(item => workOf(item)).length;
  return <Card className="batch-strip">
    <div className="batch-head"><div><span className="home-eyebrow">本套 · {task.batch.title}</span><strong>已出 {done}/{task.batch.total} 张</strong></div><Button variant="secondary" onClick={() => navigate('/delivery')}>去交付台</Button></div>
    <div className="batch-items">{siblings.map(item => <BatchItem key={item.id} task={item} work={workOf(item)} active={item.id === task.id} onOpen={() => navigate(`/create?task=${item.id}`)} />)}</div>
    {current && <div className="batch-review"><span>这一张：</span><Button variant="secondary" onClick={() => { updateWork(withReview(current, 'changes_needed')); notify('已标记需修改'); }}>需修改</Button><Button onClick={() => { updateWork(withReview(current, 'approved')); notify('已标记通过'); }}>核对通过</Button></div>}
  </Card>;
}

export function CreatePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { tasks, works } = useApp();
  const taskId = (location.state as { taskId?: string } | null)?.taskId || new URLSearchParams(location.search).get('task') || '';
  const task = tasks.find(item => item.id === taskId);
  const work = task ? works.find(item => item.id === task.workId || item.taskId === task.id) : undefined;
  const version = work?.versions.at(-1);
  const { url } = useAssetPreview(version?.assetId, version?.dataUrl);

  if (!task) {
    return <div className="page session-page">
      <StatePanel type="empty" title="还没有创作会话" detail="从首页描述想法并直接生成，结果会出现在这里。" action={<Button onClick={() => navigate('/')}>开始创作</Button>} />
    </div>;
  }

  const running = task.status === 'Queued' || task.status === 'Running';
  return <div className="page session-page">
    <button className="create-back" type="button" onClick={() => navigate('/')}><ArrowLeft size={16} /> 返回首页</button>
    <div className="page-header"><div><span className="home-eyebrow">创作会话</span><h1>{task.title || '本次创作'}</h1><p>结果会保留在本次会话，可继续编辑或导出。</p></div><Badge tone={statusTone[task.status]}>{statusLabel[task.status] || task.status}</Badge></div>
    <BatchStrip task={task} />
    <div className="session-layout">
      <div className="session-main">
        <Card className="session-stage">
          {url ? task.mode === 'video' ? <video controls src={url} aria-label={task.title || '生成视频'} /> : <img src={url} alt={task.title || '生成结果'} /> : running ? <div className="session-loading" role="status"><span className="session-spinner" aria-hidden="true" /><strong>正在生成</strong><p>结果会自动出现在这里，无需跳转。</p><div className="session-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={task.progress}><span style={{ width: `${task.progress}%` }} /></div></div> : task.status === 'Succeeded' ? <StatePanel type="empty" title="结果正在保存" detail="稍后可在作品中心查看这一版结果。" action={<Button onClick={() => navigate('/works')}>打开作品中心</Button>} /> : <StatePanel type={task.status === 'Failed' ? 'error' : 'empty'} title={task.status === 'Failed' ? '这次生成没有完成' : '任务已取消'} detail={task.error || '可以回到首页调整描述后重新生成。'} action={<Button onClick={() => navigate('/', { state: { retryPrompt: task.prompt } })}>重新提交</Button>} />}
        </Card>
        <Card className="session-prompt"><span className="home-eyebrow">你的输入</span><p>{task.prompt}</p><div className="session-prompt-meta"><span>{task.mode === 'image' ? '图片' : '视频'}</span><span>{task.source === 'live' ? '云端任务' : '演示任务'}</span><span>{new Date(task.createdAt).toLocaleString('zh-CN')}</span></div></Card>
      </div>
      <aside className="session-side">
        <Card className="session-summary"><span className="home-eyebrow">本次创作</span><h2>{task.status === 'Succeeded' ? '结果已就绪' : running ? '正在处理' : '任务结束'}</h2><dl><div><dt>类型</dt><dd>{task.mode === 'image' ? '图片' : '视频'}</dd></div><div><dt>商品</dt><dd>{task.product?.name || '自由创作'}</dd></div><div><dt>来源</dt><dd>{task.source === 'live' ? '云端' : '演示'}</dd></div></dl>
          {running && <div className="session-progress is-indeterminate" role="progressbar" aria-label={task.status === 'Queued' ? '排队中' : '生成中'}><span /></div>}
          {task.error && <p className="form-error" role="alert">{task.error}</p>}
          <div className="session-actions">
            {work && <Button onClick={() => navigate('/works')}><GalleryHorizontal size={16} /> 查看作品</Button>}
            {work && task.mode === 'image' && <Button variant="secondary" onClick={() => navigate('/image-editing', { state: { workId: work.id } })}><WandSparkles size={16} /> 继续编辑</Button>}
            <Button variant="ghost" onClick={() => navigate('/works')}>作品中心 <ArrowUpRight size={15} /></Button>
          </div>
        </Card>
        <Card className="session-tip"><strong>小提示</strong><p>结果会先保存在本机，作品中心可管理版本；云存与导出会在后续版本接入。</p></Card>
      </aside>
    </div>
  </div>;
}
