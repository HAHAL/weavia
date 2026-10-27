import {useEffect,useState} from 'react';
import {useLocation,useNavigate} from 'react-router-dom';
import {Image,Layers,Film,Sparkles,ArrowRight} from 'lucide-react';
import {Button,Card,Field} from '../components/ui';
import {AssetPicker} from '../components/AssetPicker';
import {useApp} from '../stores/app';
import {currentScope} from '../stores/scope';
import {apiConfig} from '../services/api';
import {loadPlatformModels} from '../services/models';
import {makeRequest} from '../services/live';
import {quoteAndSubmit} from '../services/submission';
import {createMockTask} from '../services/tasks';
import type {CreativeBrief,Model} from '../types';

type Goal='hero'|'scene'|'ad'|'set'|'video';
const goals=[{id:'hero',name:'商品主图',detail:'清晰展示商品外观',icon:Image},{id:'scene',name:'场景宣传图',detail:'让商品进入使用场景',icon:Sparkles},{id:'set',name:'商品套图',detail:'按用途制作 3 / 5 / 7 张',icon:Layers},{id:'video',name:'商品短视频',detail:'从商品图开始制作',icon:Film}] as const;
const plans=[['主图','干净背景，完整清晰展示商品外观'],['场景图','展示商品的真实使用环境'],['卖点图','用视觉突出已确认的商品卖点，不编造文字'],['细节图','近景展示材质与结构细节'],['使用图','展示自然使用情境'],['包装图','展示商品包装和组合关系'],['收尾图','统一风格的品牌宣传构图']];
type Draft={goal:Goal;prompt:string;productId:string;references:string[];channel:string;market:string;language:string;ratio:string;resolution:string;count:number;modelId:string;duration:number;free:boolean;planNotes:string[]};
function initial(state:Record<string,unknown>|null):Draft{
 let saved:Partial<Draft>={};try{saved=JSON.parse(localStorage.getItem(`weavia.draft.${currentScope()}`)||'{}');}catch{/* no draft */}
 return {goal:'hero',prompt:'',productId:'',references:[],channel:'通用电商',market:'中国大陆',language:'简体中文',ratio:'1:1',resolution:'1K',count:3,modelId:'',duration:5,free:false,planNotes:plans.map(p=>p[1]),...saved,...(state?{prompt:String(state.prompt||state.retryPrompt||saved.prompt||''),productId:String(state.productId||''),references:(state.referenceAssetIds as string[])||[],goal:state.mode==='video'?'video':(state.goal as Goal)||'hero',modelId:String(state.modelId||''),channel:String(state.channel||saved.channel||'通用电商'),market:String(state.market||saved.market||'中国大陆'),language:String(state.language||saved.language||'简体中文')}:{} )};
}
function imageSize(ratio:string,resolution:string){const n=resolution==='2K'?2048:1024;const [a,b]=ratio.split(':').map(Number);return a>=b?`${n}x${Math.round(n*b/a)}`:`${Math.round(n*a/b)}x${n}`;}
export function HomePage(){
 const navigate=useNavigate(),location=useLocation();
 const {products,assets,tasks}=useApp();
 const [draft,setDraft]=useState(()=>initial(location.state));
 const [models,setModels]=useState<Model[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const patch=(next:Partial<Draft>)=>{setDraft(v=>({...v,...next}));setError('');};
 useEffect(()=>{let live=true;loadPlatformModels().then(v=>{if(live)setModels(v);}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[]);
 useEffect(()=>{localStorage.setItem(`weavia.draft.${currentScope()}`,JSON.stringify(draft));},[draft]);
 const product=products.find(p=>p.id===draft.productId);
 const refs=[...new Set([...(product?.sourceAssetId?[product.sourceAssetId]:[]),...draft.references])].filter(id=>assets.some(a=>a.id===id));
 const video=draft.goal==='video';
 const capability=video?(refs.length?'image_to_video':'text_to_video'):(refs.length?'image_to_image':'text_to_image');
 const usable=models.filter(m=>m.available!==false&&m.modes.includes(video?'video':'image')&&(!m.capabilities||m.capabilities.includes(capability)));
 const model=usable.find(m=>m.id===draft.modelId)||usable[0];
 const outputs=draft.goal==='set'?plans.slice(0,draft.count):[[goals.find(g=>g.id===draft.goal)?.name||'宣传图',draft.prompt||'保持商品外观与已核实事实']];
 const recent=[...tasks].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,3);
 async function generate(){
  if(!refs.length&&!draft.free){setError('先上传一张商品图，或在更多设置中选择自由创作。');return;}
  if(!model){setError('当前创作方式暂无可用模型，请稍后重试或联系运营。');return;}
  const base=draft.prompt.trim()||`为商品制作${goals.find(g=>g.id===draft.goal)?.name||'宣传图'}，保持商品外观、包装和标识一致。`;
  const brief:CreativeBrief={purpose:video?'video':draft.goal==='set'?'hero':draft.goal,channel:draft.channel.trim(),market:draft.market.trim(),language:draft.language.trim(),product:product?{localId:product.id,name:product.name,sku:product.sku,description:product.description,verifiedFacts:product.verifiedFacts,forbiddenClaims:product.forbiddenClaims}:undefined};
  if(!brief.channel||!brief.market||!brief.language){setError('请补全渠道、市场和输出语言');return;}
  setBusy(true);setError('');
  try{
   const batchId=crypto.randomUUID();
   const requests=outputs.map((item,i)=>({title:(product?.name?product.name+' · ':'')+item[0],prompt:draft.goal==='set'?`${base}。本张用途：${item[0]}。${draft.planNotes[i]}。整套风格一致，准确保留商品外观。`:base}));
   let ids:string[];
   if(apiConfig.mode==='mock'){
    ids=requests.map(item=>{const id=createMockTask(item.prompt,video?'video':'image',{creative:brief,referenceAssetIds:refs});useApp.getState().updateTask(id,{title:item.title,batchId});return id;});
   }else{
    const prepared=[];
    for(const item of requests){const params={ratio:draft.ratio,resolution:video?'720P':draft.resolution,count:1,promptExtend:true,duration:draft.duration,size:video?(draft.ratio==='9:16'?'720*1280':'1280*720'):imageSize(draft.ratio,draft.resolution)};
     prepared.push({body:await makeRequest(item.prompt,model.id,params,refs,video?'video':'image',brief),title:item.title,referenceAssetIds:refs,product:product?{...product,verifiedFacts:product.verifiedFacts||'',forbiddenClaims:product.forbiddenClaims||'',sourceAssetId:product.sourceAssetId||''}:undefined});}
    ids=await quoteAndSubmit(prepared);
   }
   navigate(`/create?task=${ids[0]}`);
  }catch(e){setError(e instanceof Error?e.message:'提交未完成，请到任务中心核对');}finally{setBusy(false);}
 }
 return <div className="page studio-home"><div className="page-header"><div><h1>开始一次商品创作</h1><p>选好用途，上传商品图，把结果带回你的店铺。</p></div><span className="draft-note">草稿自动保存在本机</span></div>
 <div className="goal-picker" role="group" aria-label="创作目标">{goals.map(g=><button key={g.id} type="button" aria-pressed={draft.goal===g.id} className={draft.goal===g.id?'selected':''} onClick={()=>patch({goal:g.id,ratio:g.id==='video'?'9:16':'1:1'})}><g.icon size={22}/><strong>{g.name}</strong><small>{g.detail}</small></button>)}</div>
 <div className="studio-layout"><div className="studio-inputs"><Card className="studio-section"><h2>商品与依据图</h2><p>原图用于保留商品外观、包装和标识。</p>{products.length>0&&<Field label="选择已有商品（选填）"><select value={draft.productId} onChange={e=>patch({productId:e.target.value})}><option value="">这次直接上传</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>}<AssetPicker selected={refs} onChange={references=>patch({references,productId:product?.sourceAssetId&&!references.includes(product.sourceAssetId)?'':draft.productId})}/>{refs.length>0&&<p className="field-hint">已选择 {refs.length} 张依据图。生成后请对照原图核对商品。</p>}<Field label="你希望怎样展示商品？（选填）"><textarea rows={3} value={draft.prompt} onChange={e=>patch({prompt:e.target.value})} placeholder="例如：自然光下的浴室场景，突出瓶身材质，保持包装文字不变。"/></Field></Card>
 <Card className="studio-section"><h2>投放与规格</h2><div className="studio-fields"><Field label="投放渠道"><select value={draft.channel} onChange={e=>patch({channel:e.target.value})}>{['通用电商','淘宝 / 天猫','京东','拼多多','抖音电商','TikTok Shop','Amazon','Shopee','Lazada','独立站'].map(v=><option key={v}>{v}</option>)}</select></Field><Field label="目标市场"><input value={draft.market} onChange={e=>patch({market:e.target.value})}/></Field><Field label="输出语言"><select value={draft.language} onChange={e=>patch({language:e.target.value})}>{['简体中文','English','Español','日本語','Bahasa Indonesia'].map(v=><option key={v}>{v}</option>)}</select></Field><Field label="画面比例"><select value={draft.ratio} onChange={e=>patch({ratio:e.target.value})}>{(video?['9:16','16:9']:['1:1','4:5','3:4','16:9','9:16']).map(v=><option key={v}>{v}</option>)}</select></Field></div><p className="field-hint">渠道用于创作参考，发布前请核对平台当前的素材要求。</p>
 <details className="advanced-settings"><summary>更多设置</summary><div className="studio-fields"><Field label="模型"><select value={model?.id||''} onChange={e=>patch({modelId:e.target.value})}>{usable.length?usable.map(m=><option key={m.id} value={m.id}>{m.name}</option>):<option value="">暂无可用模型</option>}</select></Field>{video?<Field label="时长"><select value={draft.duration} onChange={e=>patch({duration:Number(e.target.value)})}><option value={5}>5 秒</option><option value={10}>10 秒</option></select></Field>:<Field label="清晰度"><select value={draft.resolution} onChange={e=>patch({resolution:e.target.value})}><option>1K</option><option>2K</option></select></Field>}</div><label className="switch-row">自由创作（允许不使用商品图）<input type="checkbox" checked={draft.free} onChange={e=>patch({free:e.target.checked})}/></label></details></Card></div>
 <aside className="output-plan"><Card className="studio-section"><h2>本次将得到</h2>{draft.goal==='set'&&<div className="segmented" role="group" aria-label="套图数量">{[3,5,7].map(n=><button type="button" key={n} aria-pressed={draft.count===n} className={draft.count===n?'selected':''} onClick={()=>patch({count:n})}>{n} 张</button>)}</div>}<ol className="plan-list">{outputs.map((item,i)=><li key={item[0]}><strong>{item[0]}</strong>{draft.goal==='set'?<textarea aria-label={`${item[0]}要求`} value={draft.planNotes[i]} onChange={e=>patch({planNotes:draft.planNotes.map((n,j)=>j===i?e.target.value:n)})}/>:<p>{video?'可播放的视频；商品图模式仅在已核实模型开放后可用。':'生成后可对照原图、修改和下载。'}</p>}</li>)}</ol><div className="creation-commit"><p>{loading?'正在读取可用模型':model?`推荐：${model.name}`:video?'视频能力或价格尚未核实，暂未开放':'当前没有匹配的可用模型'}</p><small>{apiConfig.mode==='mock'?'演示模式不调用模型、不扣费':'下一步显示服务端总报价，确认后才提交'}</small><Button disabled={busy||loading||!model} onClick={()=>void generate()}>{busy?'正在准备…':apiConfig.mode==='mock'?'体验生成流程':'查看报价并生成'}<ArrowRight size={16}/></Button>{error&&<p className="form-error" role="alert">{error}</p>}</div></Card></aside></div>
 {recent.length>0&&<section className="studio-recent"><h2>继续上次的工作</h2><div>{recent.map(t=><button key={t.id} onClick={()=>navigate(`/create?task=${t.id}`)}><strong>{t.title}</strong><small>{new Date(t.createdAt).toLocaleDateString('zh-CN')} · {t.status==='Succeeded'?'查看结果':t.status==='Failed'?'查看未完成原因':'查看进度'}</small><ArrowRight size={16}/></button>)}</div></section>}
 </div>;
}
