import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Boxes, Plus, Upload } from 'lucide-react';
import { Badge, Button, Card, Dialog, Field, StatePanel } from '../components/ui';
import { useAuth } from '../stores/auth';
import { loadSkills, uploadSkill, type Skill } from '../services/recipes';
import { AssetPicker } from '../components/AssetPicker';

const sampleManifest = `{
  "runtime": "prompt",
  "promptTemplate": "为以下商品制作高级商业主图：{{product}}。奶油色背景，柔和自然光，真实摄影。",
  "inputs": [{ "key": "product", "label": "商品描述", "type": "text", "required": true }],
  "defaultModel": "qwen-image-2.0",
  "capabilities": ["text_to_image"]
}`;

export function Skills() {
  const navigate = useNavigate();
  const user = useAuth(state => state.user);
  const [items, setItems] = useState<Skill[]>([]);
  const [mine, setMine] = useState(false);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('全部');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Skill | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [skillCategory, setSkillCategory] = useState('商品');
  const [description, setDescription] = useState('');
  const [manifest, setManifest] = useState(sampleManifest);
  const [sourceUrl, setSourceUrl] = useState('');
  const [license, setLicense] = useState('');
  const categories = ['全部', ...new Set(items.map(item => item.category))];
  const visible = items.filter(item => (category === '全部' || item.category === category) && `${item.name} ${item.description}`.toLowerCase().includes(query.toLowerCase()));

  const refresh=useCallback(async (nextMine = false) => {
    setLoading(true);
    try { setItems(await loadSkills(nextMine)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Skill 加载失败'); }
    finally { setLoading(false); }
  },[]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (mine && !user) { navigate('/login'); return; } if (user || !mine) void refresh(mine); }, [mine, user, navigate, refresh]);

  async function submitUpload() {
    setBusy(true); setError('');
    try {
      const parsed = JSON.parse(manifest);
      await uploadSkill({ name, category: skillCategory, description, manifest: parsed, sourceUrl, license });
      setUploadOpen(false); setMine(true); setName(''); setDescription(''); setSourceUrl(''); setLicense('');
      await refresh(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '上传失败'); }
    finally { setBusy(false); }
  }

  return <div className="page">
    <div className="page-header"><div><h1>自定义模板</h1><p>选择模板后进入统一创作台，确认商品依据与费用。</p></div><div className="header-actions"><Button variant="secondary" onClick={() => setMine(value => !value)}>{mine ? '查看公开 Skill' : '我的 Skill'}</Button><Button onClick={() => setUploadOpen(true)}><Upload size={16} /> 上传 Skill</Button></div></div>
    <div className="filter-bar"><div className="search-box"><Boxes size={16} /><input aria-label="搜索 Skill" placeholder="搜索 Skill" value={query} onChange={event => setQuery(event.target.value)} /></div><select aria-label="Skill 分类" value={category} onChange={event => setCategory(event.target.value)}>{categories.map(value => <option key={value}>{value}</option>)}</select><Badge>{mine ? '私有 / 待审核' : '公开 Skill'}</Badge></div>
    {loading ? <StatePanel type="loading" title="正在加载 Skill" /> : visible.length ? <div className="skill-grid">{visible.map(item => <Card key={item.id} className="skill-card"><div className="skill-symbol"><Boxes size={22} /></div><div><Badge>{item.category}</Badge>{item.status !== 'published' && <Badge tone="warning">{item.status === 'pending' ? '待审核' : item.status}</Badge>}<h2>{item.name}</h2><p>{item.description}</p><small>{item.manifest?.runtime === 'code' ? '代码 Skill' : '提示词 Skill'} · v{item.version}{item.author ? ` · ${item.author}` : ''}</small></div><div className="card-actions"><Button variant="secondary" onClick={() => setSelected(item)}>查看详情</Button><Button onClick={() => setSelected(item)}><ArrowUpRight size={15} /> 使用</Button></div></Card>)}</div> : <StatePanel type="empty" title={mine ? '还没有自己的 Skill' : '没有匹配的 Skill'} detail={mine ? '上传一个提示词 Skill，审核通过后可公开。' : '换个关键词或分类。'} action={mine ? <Button onClick={() => setUploadOpen(true)}><Plus size={16} /> 上传 Skill</Button> : undefined} />}
    {error && <p className="form-error" role="alert">{error}</p>}
    {selected && <SkillRun skill={selected} onClose={() => setSelected(null)} />}
    {uploadOpen && <Dialog title="上传 Skill" onClose={() => setUploadOpen(false)} wide><div className="dialog-content form-stack"><Field label="名称"><input value={name} onChange={event => setName(event.target.value)} placeholder="例如：香水主图" /></Field><Field label="分类"><select value={skillCategory} onChange={event => setSkillCategory(event.target.value)}>{['商品','美妆','食品','服饰','3C','家居','珠宝','营销','电商','视频'].map(value => <option key={value}>{value}</option>)}</select></Field><Field label="描述"><textarea value={description} onChange={event => setDescription(event.target.value)} rows={2} placeholder="这个 Skill 做什么" /></Field><Field label="Manifest JSON"><textarea value={manifest} onChange={event => setManifest(event.target.value)} rows={10} spellCheck={false} /></Field><div className="form-row"><Field label="来源 URL"><input value={sourceUrl} onChange={event => setSourceUrl(event.target.value)} placeholder="GitHub / 来源" /></Field><Field label="许可证"><input value={license} onChange={event => setLicense(event.target.value)} placeholder="MIT / CC0 / 自有" /></Field></div><p className="footnote">阶段 1 只支持提示词 Skill，不支持执行代码。上传后默认私有，公开需要管理员审核。</p>{error && <p className="form-error">{error}</p>}<div className="dialog-actions"><Button variant="secondary" onClick={() => setUploadOpen(false)}>取消</Button><Button disabled={busy || !name.trim()} onClick={() => void submitUpload()}>{busy ? '提交中…' : '提交审核'}</Button></div></div></Dialog>}
  </div>;
}

function SkillRun({ skill, onClose }: { skill: Skill; onClose: () => void }) {
  const navigate = useNavigate();
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [model, setModel] = useState(skill.manifest?.defaultModel || 'qwen-image-2.0');
  const [assetIds, setAssetIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run() {
    setBusy(true); setError('');
    try { for(const field of skill.manifest?.inputs||[]){if(field.required&&!inputs[field.key]?.trim())throw new Error(`请填写${field.label}`);}const prompt=(skill.manifest?.promptTemplate||skill.description).replace(/\{\{\s*(\w+)\s*\}\}/g,(_,key)=>inputs[key]||'');onClose();navigate('/',{state:{prompt,referenceAssetIds:assetIds,modelId:model}}); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '执行失败'); }
    finally { setBusy(false); }
  }
  return <Dialog title={skill.name} onClose={onClose}><div className="dialog-content form-stack"><p>{skill.description}</p>{(skill.manifest?.inputs || []).map(input => <Field key={input.key} label={`${input.label}${input.required ? ' *' : ''}`}><input value={inputs[input.key] || ''} onChange={event => setInputs(current => ({ ...current, [input.key]: event.target.value }))} placeholder={input.label} /></Field>)}<Field label="附加素材（可选）"><AssetPicker selected={assetIds} onChange={setAssetIds} /></Field>
        <Field label="模型"><select value={model} onChange={event => setModel(event.target.value)}><option value="qwen-image-2.0">Qwen Image 2.0</option><option value="qwen-image-max">Qwen Image Max</option></select></Field>{error && <p className="form-error">{error}</p>}<div className="dialog-actions"><Button variant="secondary" onClick={onClose}>取消</Button><Button disabled={busy} onClick={() => void run()}>{busy ? '准备中…' : '带入创作台'}</Button></div></div></Dialog>;
}
