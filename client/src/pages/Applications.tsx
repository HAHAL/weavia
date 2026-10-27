import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, LayoutGrid } from 'lucide-react';
import { Badge, Button, Card, Dialog, Field, StatePanel } from '../components/ui';
import { loadApps, type App } from '../services/recipes';
import { AssetPicker } from '../components/AssetPicker';

export function Applications() {
  const navigate = useNavigate();
  const [items, setItems] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<App | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { loadApps().then(setItems).catch(cause => setError(cause instanceof Error ? cause.message : '应用加载失败')).finally(() => setLoading(false)); }, []);
  return <div className="page"><div className="page-header"><div><h1>创作方案</h1><p>按业务用途选择方案，带入创作台后确认素材、规格和费用。</p></div><Badge>图片应用开放中</Badge></div>{error && <p className="form-error">{error}</p>}{loading ? <StatePanel type="loading" title="正在加载应用" /> : items.length ? <div className="quick-grid">{items.map(app => <Card key={app.id} className="feature-card"><div className="quick-icon"><LayoutGrid size={23} /></div><Badge>{app.category}</Badge><h2>{app.name}</h2><p>{app.description}</p><div className="card-actions"><span className="badge">{app.credits} Credits</span><Button onClick={() => setSelected(app)}>使用 <ArrowUpRight size={15} /></Button></div></Card>)}</div> : <StatePanel type="empty" title="还没有开放的应用" detail="管理员发布后会出现在这里。" />}{selected && <AppRun app={selected} onClose={() => setSelected(null)} onDone={state => { setSelected(null); navigate('/', { state }); }} />}</div>;
}

function AppRun({ app, onClose, onDone }: { app: App; onClose: () => void; onDone: (state: {prompt:string;referenceAssetIds:string[];modelId:string}) => void }) {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [assetIds, setAssetIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run() {
    setBusy(true); setError('');
    try { for(const field of app.inputSchema||[]){if(field.required&&!inputs[field.key]?.trim())throw new Error(`请填写${field.label}`);}const prompt=(app.manifest?.promptTemplate||app.description).replace(/\{\{\s*(\w+)\s*\}\}/g,(_,key)=>inputs[key]||'');onDone({prompt,referenceAssetIds:assetIds,modelId:app.modelHint||''}); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '生成失败'); }
    finally { setBusy(false); }
  }
  return <Dialog title={app.name} onClose={onClose} wide><div className="dialog-content form-stack"><p>{app.description}</p>{app.mediaType === 'video' && <p className="form-error">视频应用将在阶段 3 开放。</p>}{(app.inputSchema || []).map(input => <Field key={input.key} label={`${input.label}${input.required ? ' *' : ''}`}><input value={inputs[input.key] || ''} onChange={event => setInputs(current => ({ ...current, [input.key]: event.target.value }))} placeholder={input.label} /></Field>)}<Field label="附加素材（可选）"><AssetPicker selected={assetIds} onChange={setAssetIds} /></Field>
        <p className="footnote">下一步选择可用模型并获取正式报价</p>{error && <p className="form-error">{error}</p>}<div className="dialog-actions"><Button variant="secondary" onClick={onClose}>取消</Button><Button disabled={busy || app.mediaType === 'video'} onClick={() => void run()}>{busy ? '准备中…' : '带入创作台'}</Button></div></div></Dialog>;
}
