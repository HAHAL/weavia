import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowUp, ImagePlus, Settings2, Sparkles, X, ChevronDown, Search, Package, Video, Image as ImageIcon } from 'lucide-react';
import { Badge, Button, Card, Dialog, Field, StatePanel } from '../components/ui';
import { MODELS, SKILLS, type Mode } from '../types';
import { useApp } from '../stores/app';
import { createTask } from '../services/tasks';
import { apiConfig } from '../services/api';
import { estimateDemoCredits } from '../lib/credits';
import { useAssetPreview } from '../hooks/useAssetPreview';
import { importAsset } from '../services/assets';
const quick = [ ['商品主图','白底、场景与渠道规格','为我的商品生成干净的电商主图'], ['场景营销图','让商品进入真实使用场景','把商品放进自然光的真实生活场景'], ['活动营销套图','一套创意适配多个渠道','生成一套活动营销图片'], ['商品短视频','由商品图生成短片与封面','把商品制作成短视频'] ];
export function Dashboard() {
  const navigate=useNavigate(); const route=useLocation(); const initial=(route.state as {prompt?:string;mode?:Mode;productId?:string}|null); const {products,assets,works,addAsset,notify}=useApp(); const fileRef=useRef<HTMLInputElement>(null); const composerRef=useRef<HTMLTextAreaElement>(null);
  const [prompt,setPrompt]=useState(initial?.prompt||''); const [mode,setMode]=useState<Mode>(initial?.mode||'image'); const [productId,setProductId]=useState(initial?.productId||''); const [agent,setAgent]=useState('智能创作'); const [persona,setPersona]=useState('品牌助手'); const [skill,setSkill]=useState(''); const [skillSearch,setSkillSearch]=useState(''); const [modelId,setModelId]=useState(initial?.mode==='video'?'video-motion':'image-balanced'); const [ratio,setRatio]=useState(initial?.mode==='video'?'16:9':'1:1'); const [resolution,setResolution]=useState(initial?.mode==='video'?'720':'1024'); const [count,setCount]=useState(1); const [duration,setDuration]=useState(5); const [attachments,setAttachments]=useState<{assetId:string;name:string;url:string}[]>([]); const [panel,setPanel]=useState<'settings'|'skills'|null>(null); const [error,setError]=useState(''); const [submitting,setSubmitting]=useState(false);
  const selectedProduct=products.find(item=>item.id===productId);
  const productImage=useAssetPreview(selectedProduct?.sourceAssetId);
  const model=MODELS.find(m=>m.id===modelId)!; const estimate=estimateDemoCredits(model,mode,resolution,count,duration);
  function changeMode(next:Mode){setMode(next);const m=MODELS.find(x=>x.modes.includes(next))!;setModelId(m.id);setRatio(m.ratios[0]);setResolution(m.resolutions[0]);setCount(1);setError('');}
  function changeModel(id:string){const m=MODELS.find(x=>x.id===id)!;setModelId(id);setRatio(m.ratios[0]);setResolution(m.resolutions[0]);setCount(1);setDuration(m.durations?.[0]??5);}
  async function addFiles(files:FileList|null){
    if(!files)return;
    const picked=Array.from(files).slice(0,Math.max(0,4-attachments.length));
    for(const file of picked){
      try{
        const url=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('图片预览失败'));reader.readAsDataURL(file);});
        const asset=await importAsset(file);
        addAsset({...asset,category:'参考图'});
        setAttachments(current=>[...current,{assetId:asset.id,name:file.name,url}].slice(0,4));
      }catch(cause){notify(cause instanceof Error?cause.message:'参考图导入失败');}
    }
  }
  async function submit(){
    if(!prompt.trim()){setError('请输入创作描述');return;}
    if(productId&&!selectedProduct){setError('所选商品已不存在，请重新选择');return;}
    if(selectedProduct&&(!selectedProduct.sourceAssetId||!assets.some(asset=>asset.id===selectedProduct.sourceAssetId)||!productImage.url)){setError('请先在商品库为该商品添加可读取的依据图');return;}
    setSubmitting(true);setError('');
    try{
      await createTask({
        prompt:prompt.trim(),mode,modelId,
        product:selectedProduct?{id:selectedProduct.id,name:selectedProduct.name,sku:selectedProduct.sku,description:selectedProduct.description,verifiedFacts:selectedProduct.verifiedFacts||'',forbiddenClaims:selectedProduct.forbiddenClaims||'',sourceAssetId:selectedProduct.sourceAssetId!}:undefined,
        referenceAssetIds:attachments.map(item=>item.assetId),
      });
      notify('任务已创建，可在任务中心核对商品与素材输入');
      navigate('/tasks');
    }catch(cause){setError(cause instanceof Error?cause.message:'任务创建失败');}
    finally{setSubmitting(false);}
  }
  return <div className="page dashboard"><div className="dashboard-intro"><h1>今天，想为商品创造什么？</h1><p>从商品开始，快速生成符合品牌风格的图片与视频。</p></div>
    <Card className="composer">
      <div className="creation-product"><div className="creation-product-heading"><strong>商品依据</strong><span>商品原图与已核实信息会随本次任务保存</span></div>
        <select aria-label="选择创作商品" value={productId} onChange={event=>{setProductId(event.target.value);setError('');}}><option value="">自由创作 · 不指定商品</option>{products.map(item=><option key={item.id} value={item.id}>{item.name} · {item.sku}</option>)}</select>
        {selectedProduct&&<div className="creation-product-summary">
          <div className="creation-product-image">{productImage.url?<img src={productImage.url} alt={`${selectedProduct.name} 商品依据图`}/>:<Package size={22} aria-hidden="true"/>}</div>
          <div><strong>{selectedProduct.name}</strong><small>SKU {selectedProduct.sku}</small><p>{selectedProduct.verifiedFacts||selectedProduct.description||'尚未填写已核实的商品事实'}</p>{selectedProduct.forbiddenClaims&&<p>不可添加：{selectedProduct.forbiddenClaims}</p>}{!selectedProduct.sourceAssetId&&<p className="form-error">请先在商品库添加依据图。</p>}</div>
          <button className="text-link" type="button" onClick={()=>navigate('/products')}>编辑商品</button>
        </div>}
      </div>
      <textarea ref={composerRef} aria-label="创作描述" placeholder="描述这次要为商品创作的内容…" value={prompt} onChange={e=>{setPrompt(e.target.value);if(error)setError('');}} onKeyDown={e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();submit();}}}/>
      {attachments.length>0&&<div className="attachments">{attachments.map(a=><div className="attachment" key={a.assetId}><img src={a.url} alt={a.name}/><button aria-label={`移除 ${a.name}`} onClick={()=>setAttachments(v=>v.filter(item=>item.assetId!==a.assetId))}><X size={14}/></button></div>)}</div>}
      {error&&<p className="form-error" role="alert">{error}</p>}
      <div className="composer-toolbar"><div className="tool-row"><button className="tool-button" onClick={()=>fileRef.current?.click()}><ImagePlus size={16}/> 添加参考图</button><input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden onChange={e=>{void addFiles(e.target.files);e.target.value='';}}/>
        <select aria-label="Agent 模式" value={agent} onChange={e=>setAgent(e.target.value)}><option>智能创作</option><option>按步骤创作</option><option>直接生成</option></select>
        <select aria-label="AI 分身" value={persona} onChange={e=>setPersona(e.target.value)}><option>品牌助手</option><option>电商摄影师</option><option>短视频导演</option></select>
        <button className="tool-button" onClick={()=>setPanel('skills')}>Skill {skill?`· ${SKILLS.find(s=>s.id===skill)?.name}`:''}<ChevronDown size={14}/></button>
        <select aria-label="选择模型" value={modelId} onChange={e=>changeModel(e.target.value)}>{MODELS.filter(m=>m.modes.includes(mode)).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select>
        <button className="tool-button" onClick={()=>setPanel('settings')}><Settings2 size={16}/> 参数</button></div>
        <div className="submit-row"><div className="segmented" aria-label="创作类型"><button className={mode==='image'?'selected':''} onClick={()=>changeMode('image')}><ImageIcon size={15}/> 图片</button><button className={mode==='video'?'selected':''} onClick={()=>changeMode('video')}><Video size={15}/> 视频</button></div><span className="estimate">{apiConfig.mode === 'live' ? 'Credits 以服务端结算为准' : <>预估 {estimate} Credits <Badge>演示</Badge></>}</span><Button aria-label="开始创作" disabled={submitting} onClick={submit}>{submitting?'创建中…':<><ArrowUp size={18}/> 开始创作</>}</Button></div></div>
    </Card>
    <div className="model-note"><Sparkles size={15}/>{model.description} {apiConfig.mode === 'live' ? '实际扣费以服务端账本为准。' : '费用仅供界面演示，实际账本以服务端为准。'}</div>
    <section className="dashboard-section"><div className="section-heading"><h2>常用电商任务</h2><button className="text-link" onClick={()=>navigate('/applications')}>查看全部应用 →</button></div><div className="quick-grid">{quick.map(([title,desc,text],i)=><button className="quick-card" key={title} onClick={()=>{setPrompt(text);changeMode(i===3?'video':'image');composerRef.current?.focus();}}><span className="quick-icon">{i===3?<Video size={20}/>:<Sparkles size={20}/>}</span><strong>{title}</strong><small>{desc}</small></button>)}</div></section>
    <section className="dashboard-section"><div className="section-heading"><h2>推荐 Skill</h2><button className="text-link" onClick={()=>navigate('/skills')}>Skill Center →</button></div><div className="chip-row">{SKILLS.slice(0,4).map(s=><button className="skill-chip" key={s.id} onClick={()=>{setSkill(s.id);setPrompt(s.description);composerRef.current?.focus();}}>{s.name}</button>)}</div></section>
    <div className="dashboard-bottom"><section><div className="section-heading"><h2>最近商品</h2><button className="text-link" onClick={()=>navigate('/products')}>全部商品 →</button></div>{products.length?<div className="mini-list">{products.slice(0,3).map(p=><button key={p.id} onClick={()=>{setPrompt(`为 ${p.name} 生成商品主图`);composerRef.current?.focus();}}><Package size={18}/><span>{p.name}<small>{p.category} · {p.sku}</small></span></button>)}</div>:<StatePanel type="empty" title="还没有商品" detail="创建商品后可从首页快速发起创作。" action={<Button variant="secondary" onClick={()=>navigate('/products')}>添加商品</Button>}/>}</section><section><div className="section-heading"><h2>最近作品</h2><button className="text-link" onClick={()=>navigate('/works')}>全部作品 →</button></div>{works.length?<div className="mini-list">{works.slice(0,3).map(w=><button key={w.id} onClick={()=>navigate('/works')}><Sparkles size={18}/><span>{w.title}<small>演示作品 · {w.versions.length} 个版本</small></span></button>)}</div>:<StatePanel type="empty" title="还没有作品" detail="完成演示任务后，作品会显示在这里。"/>}</section></div>
    {panel==='skills'&&<Dialog title="选择 Skill" onClose={()=>setPanel(null)}><div className="dialog-content"><div className="search-box"><Search size={16}/><input aria-label="搜索 Skill" placeholder="搜索 Skill" value={skillSearch} onChange={e=>setSkillSearch(e.target.value)}/></div><div className="select-list">{SKILLS.filter(s=>s.name.includes(skillSearch)||s.description.includes(skillSearch)).map(s=><button key={s.id} className={skill===s.id?'chosen':''} onClick={()=>{setSkill(s.id);setPanel(null);notify(`已选择 ${s.name}`);}}><strong>{s.name}</strong><span>{s.description}</span><Badge>{s.kind==='template'?'提示词模板':s.kind==='controlled'?'受控流程':'需外部能力'}</Badge></button>)}</div></div></Dialog>}
    {panel==='settings'&&<Dialog title={`${mode==='image'?'图片':'视频'}参数`} onClose={()=>setPanel(null)}><div className="dialog-content form-stack"><Field label="比例"><select value={ratio} onChange={e=>setRatio(e.target.value)}>{model.ratios.map(x=><option key={x}>{x}</option>)}</select></Field><Field label="分辨率"><select value={resolution} onChange={e=>setResolution(e.target.value)}>{model.resolutions.map(x=><option key={x} value={x}>{x}px</option>)}</select></Field>{mode==='image'?<Field label="生成数量"><select value={count} onChange={e=>setCount(Number(e.target.value))}>{Array.from({length:model.maxCount},(_,i)=>i+1).map(x=><option key={x}>{x}</option>)}</select></Field>:<Field label="时长"><select value={duration} onChange={e=>setDuration(Number(e.target.value))}>{model.durations?.map(x=><option key={x} value={x}>{x} 秒</option>)}</select></Field>}<p className="muted">模型能力与 Credits 预估为演示数据。</p><Button onClick={()=>setPanel(null)}>完成</Button></div></Dialog>}
  </div>;
}
