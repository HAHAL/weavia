import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, LayoutGrid } from 'lucide-react';
import { Badge, Button, Card, Dialog, Field, StatePanel } from '../components/ui';
import { loadApps, runApp, type App } from '../services/recipes';
import { AssetPicker } from '../components/AssetPicker';
import { uploadReferenceAsset } from '../services/serverAssets';
import { useApp } from '../stores/app';
import { trackLiveTask } from '../services/live';

export function Applications() {
  const navigate = useNavigate();
  const [items, setItems] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<App | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { loadApps().then(setItems).catch(cause => setError(cause instanceof Error ? cause.message : '应用加载失败')).finally(() => setLoading(false)); }, []);
  return <div className="page"><div className="page-header"><div><h1>AI 应用</h1><p>成熟场景，填少量输入就能生成。</p></div><Badge>图片应用开放中</Badge></div>{error && <p className="form-error">{error}</p>}{loading ? <StatePanel type="loading" title="正在加载应用" /> : items.length ? <div className="quick-grid">{items.map(app => <Card key={app.id} className="feature-card"><div className="quick-icon"><LayoutGrid size={23} /></div><Badge>{app.category}</Badge><h2>{app.name}</h2><p>{app.description}</p><div className="card-actions"><span className="badge">{app.credits} Credits</span><Button onClick={() => setSelected(app)}>使用 <ArrowUpRight size={15} /></Button></div></Card>)}</div> : <StatePanel type="empty" title="还没有开放的应用" detail="管理员发布后会出现在这里。" />}{selected && <AppRun app={selected} onClose={() => setSelected(null)} onDone={id => { setSelected(null); navigate('/create', { state: { taskId: id } }); }} />}</div>;
}

function AppRun({ app, onClose, onDone }: { app: App; onClose: () => void; onDone: (id: string) => void }) {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [assetIds, setAssetIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run() {
    setBusy(true); setError('');
    try { const { assets } = useApp.getState(); const refs = await Promise.all(assetIds.map(id => assets.find(item => item.id === id)).filter(Boolean).map(asset => uploadReferenceAsset(asset!))); const task = await runApp(app.id, inputs, refs); trackLiveTask(task, app.name); onDone(task.id); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '生成失败'); }
    finally { setBusy(false); }
  }
  return <Dialog title={app.name} onClose={onClose} wide><div className="dialog-content form-stack"><p>{app.description}</p>{app.mediaType === 'video' && <p className="form-error">视频应用将在阶段 3 开放。</p>}{(app.inputSchema || []).map(input => <Field key={input.key} label={`${input.label}${input.required ? ' *' : ''}`}><input value={inputs[input.key] || ''} onChange={event => setInputs(current => ({ ...current, [input.key]: event.target.value }))} placeholder={input.label} /></Field>)}<Field label="附加素材（可选）"><AssetPicker selected={assetIds} onChange={setAssetIds} /></Field>
        <p className="footnote">预计 {app.credits} Credits · 模型 {app.modelHint || 'Qwen Image 2.0'}</p>{error && <p className="form-error">{error}</p>}<div className="dialog-actions"><Button variant="secondary" onClick={onClose}>取消</Button><Button disabled={busy || app.mediaType === 'video'} onClick={() => void run()}>{busy ? '生成中…' : '生成'}</Button></div></div></Dialog>;
}
