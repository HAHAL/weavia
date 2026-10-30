import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clapperboard, Plus, Trash2, Play, Sparkles } from 'lucide-react';
import { Badge, Button, Card, Field, StatePanel } from '../components/ui';
import { getCodexStatus, planVideoWithCodex, type CodexStatus } from '../services/codex';
import { useApp } from '../stores/app';

type Shot = { id: string; title: string; prompt: string; duration: number };
const firstShot = (): Shot => ({ id: crypto.randomUUID(), title: '开场镜头', prompt: '', duration: 5 });

function parseShots(raw: string): Shot[] {
  const text = raw.trim().replace(/^\x60{3}(?:json)?\s*/i, '').replace(/\s*\x60{3}$/, '');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('AI 未返回可识别的分镜，请调整需求后重试');
  }
  if (!parsed || typeof parsed !== 'object' || !('shots' in parsed) || !Array.isArray(parsed.shots)) {
    throw new Error('AI 返回的分镜格式不完整，请调整需求后重试');
  }
  const shots = parsed.shots;
  if (shots.length < 1 || shots.length > 8 || shots.some(shot => !shot || typeof shot.title !== 'string' || !shot.title.trim() || typeof shot.prompt !== 'string' || !shot.prompt.trim() || ![3, 5, 10].includes(shot.duration))) {
    throw new Error('AI 返回的镜头内容无效，请调整需求后重试');
  }
  return shots.map(shot => ({ id: crypto.randomUUID(), title: shot.title.trim(), prompt: shot.prompt.trim(), duration: shot.duration }));
}

export function VideoStudioPage() {
  const navigate = useNavigate();
  const notify = useApp(state => state.notify);
  const products = useApp(state => state.products);
  const [shots, setShots] = useState<Shot[]>([firstShot()]);
  const [ratio, setRatio] = useState('16:9');
  const [brief, setBrief] = useState('');
  const [productId, setProductId] = useState('');
  const [channel, setChannel] = useState('通用电商');
  const [market, setMarket] = useState('中国大陆');
  const [language, setLanguage] = useState('简体中文');
  const [codex, setCodex] = useState<CodexStatus | null>(null);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState('');
  const total = shots.reduce((sum, shot) => sum + shot.duration, 0);

  useEffect(() => { void getCodexStatus().then(setCodex).catch(() => setCodex(null)); }, []);

  function update(id: string, patch: Partial<Shot>) {
    setShots(current => current.map(shot => shot.id === id ? { ...shot, ...patch } : shot));
  }

  async function plan() {
    setPlanning(true); setError('');
    try {
      const product = products.find(item => item.id === productId);
      const facts = product ? `\n商品：${product.name}\n已核实事实：${product.verifiedFacts || '未填写'}\n禁止声明：${product.forbiddenClaims || '未填写'}\n请严格保持商品外观和已核实事实。` : '';
      const response = await planVideoWithCodex(brief.trim() + `\n画幅比例：${ratio}\n投放渠道：${channel}\n目标市场：${market}\n输出语言：${language}` + facts);
      setShots(parseShots(response));
      notify('分镜草案已生成，请检查商品事实和文案');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setPlanning(false);
    }
  }

  function submit() {
    if (!shots.length || shots.some(shot => !shot.prompt.trim())) {
      setError('请为每个镜头填写描述');
      return;
    }
    if (total > 10) {
      setError('当前单次视频任务最多按 10 秒提交，请缩短分镜或分段制作。');
      return;
    }
    const prompt = `${brief.trim() ? brief.trim() + '。' : ''}${shots.map((shot, index) => '镜头 ' + (index + 1) + '（' + shot.duration + ' 秒）：' + shot.prompt.trim()).join('；')}。画幅 ${ratio}。请保持商品外观与包装一致。`;
    notify('分镜已带入创作台，请确认模型参数后生成');
    navigate('/', { state: { prompt, mode: 'video', productId, channel, market, language, videoRatio: ratio, videoDuration: total <= 5 ? 5 : 10 } });
  }

  const assistantReady = Boolean(codex?.keyConfigured && codex.engineAvailable && codex.baseUrl && codex.model);
  return <div className="page">
    <div className="page-header"><div><h1>视频工作台</h1><p>编排商品短视频分镜，检查脚本后到创作台选择已配置的视频模型。</p></div><Badge>分镜策划</Badge></div>
    <div className="video-summary"><Card><Clapperboard size={22} /><strong>{shots.length} 个镜头</strong><span>脚本总时长 {total} 秒</span></Card><Card><strong>画幅比例</strong><select aria-label="视频画幅" value={ratio} onChange={event => setRatio(event.target.value)}><option>16:9</option><option>9:16</option></select></Card><Card><strong>生成方式</strong><span>创作台选择可用模型后提交</span></Card></div>

    <Card className="video-assistant"><div className="section-heading"><div><h2>投放资料</h2><p>分镜策划与后续生成会使用同一份商品和市场信息。</p></div></div><div className="creative-brief-grid"><Field label="商品"><select value={productId} onChange={event => setProductId(event.target.value)}><option value="">自由创作</option>{products.map(item => <option key={item.id} value={item.id}>{item.name} · {item.sku}</option>)}</select></Field><Field label="渠道"><input value={channel} onChange={event => setChannel(event.target.value)} /></Field><Field label="目标市场"><input value={market} onChange={event => setMarket(event.target.value)} /></Field><Field label="输出语言"><input value={language} onChange={event => setLanguage(event.target.value)} /></Field></div></Card>

    <Card className="video-assistant"><div className="section-heading"><div><h2><Sparkles size={18} /> AI 分镜策划</h2><p>用一句话说清商品、卖点和目标人群，先生成可修改的分镜草案。</p></div><Badge tone={assistantReady ? 'success' : 'neutral'}>{assistantReady ? '已连接' : '待配置'}</Badge></div><Field label="视频需求"><textarea value={brief} onChange={event => setBrief(event.target.value)} maxLength={4000} placeholder="例如：为这款保温杯做一条面向通勤人群的 15 秒短视频，突出轻便和易清洗。" /></Field><div className="header-actions"><Button disabled={!assistantReady || !brief.trim() || planning} onClick={() => void plan()}><Sparkles size={15} />{planning ? '正在策划…' : '生成分镜草案'}</Button>{!assistantReady && <Button variant="secondary" onClick={() => navigate('/account?section=ai')}>配置 AI 助手</Button>}</div><p className="footnote">生成草案会调用已配置的模型服务，可能产生费用；不会提交视频渲染任务。</p></Card>

    <div className="section-heading"><h2>分镜脚本</h2><Button variant="secondary" onClick={() => setShots(current => [...current, { id: crypto.randomUUID(), title: '镜头 ' + (current.length + 1), prompt: '', duration: 5 }])}><Plus size={15} /> 添加镜头</Button></div>
    {shots.length ? <div className="shot-list">{shots.map((shot, index) => <Card key={shot.id} className="shot-card"><div className="shot-number">{String(index + 1).padStart(2, '0')}</div><div className="shot-fields"><Field label="镜头名称"><input value={shot.title} onChange={event => update(shot.id, { title: event.target.value })} /></Field><Field label="画面描述"><textarea value={shot.prompt} onChange={event => { update(shot.id, { prompt: event.target.value }); setError(''); }} placeholder="例如商品在柔和自然光下缓慢旋转…" /></Field></div><div className="shot-side"><Field label="时长"><select value={shot.duration} onChange={event => update(shot.id, { duration: Number(event.target.value) })}><option value={3}>3 秒</option><option value={5}>5 秒</option><option value={10}>10 秒</option></select></Field><button className="icon-btn" aria-label={'删除镜头 ' + (index + 1)} onClick={() => setShots(current => current.filter(item => item.id !== shot.id))}><Trash2 size={16} /></button></div></Card>)}</div> : <StatePanel type="empty" title="还没有镜头" detail="添加一个镜头开始编排。" action={<Button onClick={() => setShots([firstShot()])}>添加镜头</Button>} />}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="video-footer"><p>分镜是脚本；实际可生成的时长和费用以创作台的视频模型为准。发布前请核对商品事实与文案。</p><Button onClick={submit}><Play size={15} /> 带入视频创作台</Button></div>
  </div>;
}
