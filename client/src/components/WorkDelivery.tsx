import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {Button,Card,Dialog,Field} from './ui';
import {useAssetPreview} from '../hooks/useAssetPreview';
import {useApp} from '../stores/app';
import {exportWorks} from '../services/export';
import type {Work} from '../types';
export function WorkDelivery({work}:{work:Work}){
 const navigate=useNavigate(),notify=useApp(s=>s.notify),update=useApp(s=>s.updateWork);
 const [open,setOpen]=useState(false),[chosenVersion,setVersion]=useState<number|null>(null),[busy,setBusy]=useState(false);
 const version=chosenVersion??work.versions.length-1;
 const current=work.versions[version]||work.versions.at(-1);
 const {url}=useAssetPreview(current?.assetId,current?.dataUrl);
 const {url:original}=useAssetPreview(work.product?.sourceAssetId||work.referenceAssetId);
 async function download(){setBusy(true);try{if(await exportWorks([{...work,versions:[current]}]))notify('导出完成');}catch(e){notify(e instanceof Error?e.message:'导出失败，请重试');}finally{setBusy(false);}}
 const preview=url?(work.mode==='video'?<video src={url} controls preload="metadata"/>:<img src={url} alt={work.title}/>):<p role="status">结果暂不可预览，可尝试重新下载或刷新任务。</p>;
 return <><Card className="delivery-card"><button className="delivery-preview" type="button" aria-label={`核对 ${work.title}`} onClick={()=>setOpen(true)}>{work.mode==='video'?<span>视频结果 · 点击播放</span>:preview}</button><div className="delivery-info"><span className={`review-label ${work.reviewStatus||'pending'}`}>{work.reviewStatus==='approved'?'已核对':work.reviewStatus==='changes_needed'?'需修改':'待核对'}</span><h3>{work.title}</h3><div className="card-actions"><Button variant="secondary" onClick={()=>setOpen(true)}>查看与核对</Button><Button disabled={busy||!url} onClick={()=>void download()}>{busy?'导出中…':'下载'}</Button></div></div></Card>
 {open&&<Dialog wide title="核对并交付" onClose={()=>setOpen(false)}><div className="dialog-content"><div className="review-comparison">{original&&<figure><figcaption>商品依据图</figcaption><img src={original} alt="商品依据图"/></figure>}<figure><figcaption>生成结果 · v{version+1}</figcaption>{preview}</figure></div><p>请核对商品外观、包装、画面文字和卖点。系统不会自动证明内容准确。</p>{work.versions.length>1&&<Field label="版本"><select value={version} onChange={e=>setVersion(Number(e.target.value))}>{work.versions.map((v,i)=><option key={v.id} value={i}>v{i+1} · {new Date(v.createdAt).toLocaleString('zh-CN')}</option>)}</select></Field>}<Field label="修改备注（自动保存在本机）"><textarea value={work.reviewNote||''} onChange={e=>update({...work,reviewNote:e.target.value})}/></Field><div className="dialog-actions"><Button variant="secondary" onClick={()=>{update({...work,reviewStatus:'changes_needed'});notify('已标记需要修改');}}>需要修改</Button><Button onClick={()=>{update({...work,reviewStatus:'approved'});notify('已标记核对通过');}}>核对通过</Button><Button variant="secondary" disabled={busy||!url} onClick={()=>void download()}>下载此版本</Button>{work.mode==='image'&&<Button variant="ghost" onClick={()=>navigate('/image-editing',{state:{workId:work.id}})}>继续编辑</Button>}</div></div></Dialog>}</>;
}
