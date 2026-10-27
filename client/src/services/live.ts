import { apiRequest } from './api';
import { uploadReferenceAsset } from './serverAssets';
import { useApp } from '../stores/app';
import { currentScope } from '../stores/scope';
import { toTask,restoreOutputs,type ServerTask } from './taskState';
import { loadPlatformModels } from './models';
import { quoteAndSubmit } from './submission';
import type { CreativeBrief,ProductBrief,Task } from '../types';
export type { ServerTask } from './taskState';
export { toTask } from './taskState';
const timers=new Map<string,ReturnType<typeof setTimeout>>();
const active=new Set<string>();
let epoch=0;
window.addEventListener('weavia:scope',()=>{epoch++;for(const timer of timers.values())clearTimeout(timer);timers.clear();active.clear();});
export function applyServerTask(server:ServerTask,previous?:Task){
 const state=useApp.getState();const task=toTask(server,server.prompt||previous?.prompt,previous||state.tasks.find(t=>t.id===server.id));
 const restored=restoreOutputs(task,server,state.works,state.assets);
 const work=restored.works.find(w=>w.id===task.parentWorkId||w.taskId===task.id);if(work)task.workId=work.id;
 useApp.setState({...restored,tasks:[task,...state.tasks.filter(t=>t.id!==task.id)]});
}
export function trackLiveTask(server:ServerTask,prompt:string,_parentWorkId?:string,product?:ProductBrief){
 const task=toTask(server,prompt);if(product)task.product=product;
 applyServerTask({...server,prompt},task); if(!['success','failed','cancelled'].includes(server.status))poll(server.id);
 window.dispatchEvent(new Event('weavia:credits'));
}
export function poll(id:string){
 if(active.has(id)||timers.has(id))return;
 const runEpoch=epoch,scope=currentScope();
 const tick=async()=>{
  timers.delete(id);if(epoch!==runEpoch||currentScope()!==scope)return;
  if(active.size>=3){timers.set(id,setTimeout(()=>void tick(),1000));return;}
  active.add(id);
  let again=true;
  try{
   const server=await apiRequest<ServerTask>(`/api/ai/tasks/${id}`,{},{timeoutMs:15000});
   if(epoch!==runEpoch||currentScope()!==scope)return;
   applyServerTask(server);again=!['success','failed','cancelled'].includes(server.status);
   if(!again)window.dispatchEvent(new Event('weavia:credits'));
  }catch(cause){if(epoch===runEpoch)useApp.getState().updateTask(id,{syncError:cause instanceof Error?cause.message:'暂时无法查询，请检查连接'});}
  finally{if(epoch===runEpoch){active.delete(id);if(again)timers.set(id,setTimeout(()=>void tick(),10000));}}
 };void tick();
}
export function resumeLiveTasks(){for(const t of useApp.getState().tasks)if(t.source==='live'&&(['Queued','Running'].includes(t.status)||(t.status==='Succeeded'&&!useApp.getState().works.some(w=>w.taskId===t.id||w.id===t.workId))))poll(t.id);}
export function retryLiveResult(id:string){const timer=timers.get(id);if(timer)clearTimeout(timer);timers.delete(id);poll(id);}
export async function makeRequest(prompt:string,modelId:string,params?:{ratio:string;resolution:string;count:number;promptExtend:boolean;duration?:number;size?:string;negativePrompt?:string;seed?:string;outputFormat?:string;watermark?:boolean;referenceStrength?:number},referenceAssetIds:string[]=[],mode:'image'|'video'='image',creative?:CreativeBrief){
 const scope=currentScope();
 if(referenceAssetIds.length>1)throw new Error('当前生成通道使用一张商品依据图，请选择最能代表商品的一张。');
 const refs=[];
 for(const id of referenceAssetIds){const asset=useApp.getState().assets.find(a=>a.id===id);if(!asset)throw new Error('参考素材不可读取，请重新选择');refs.push(await uploadReferenceAsset(asset));}
 if(currentScope()!==scope)throw new Error('账户已切换，请重新开始');
 return {idempotencyKey:crypto.randomUUID(),modelKey:modelId,model:modelId,mode:mode==='video'?(refs.length?'image_to_video':'text_to_video'):refs.length?'image_to_image':'text_to_image',projectId:refs.length?'local-assets':'',prompt,referenceAssets:refs,inputAssetId:refs[0]?.assetId||'',size:params?.size||'1024x1024',numberOfImages:mode==='video'?1:params?.count||1,duration:mode==='video'?params?.duration||5:undefined,ratio:params?.ratio||'1:1',resolution:params?.resolution||'1K',promptExtend:params?.promptExtend??true,negativePrompt:params?.negativePrompt||'',seed:params?.seed||'',outputFormat:params?.outputFormat||(mode==='video'?'mp4':'png'),watermark:params?.watermark??false,workflow:'image_generation',creative};
}
export async function createLiveTask(prompt:string,modelId:string,params?:Parameters<typeof makeRequest>[2],referenceAssetIds:string[]=[],mode:'image'|'video'='image',creative?:CreativeBrief,product?:ProductBrief){
 const body=await makeRequest(prompt,modelId,params,referenceAssetIds,mode,creative);
 const tasks=await quoteAndSubmit([{body,title:prompt.slice(0,40),product,referenceAssetIds}]);return tasks[0];
}
export async function createLiveEditTask(prompt:string,modelId:string,asset:import('../types').Asset,parentWorkId?:string){
 const body=await makeRequest(prompt,modelId,{ratio:'1:1',resolution:'1K',count:1,promptExtend:true},[asset.id]);
 const models=await loadPlatformModels('image');
 const selected=models.find(m=>m.id===modelId);
 if(selected?.capabilities?.includes('image_edit'))body.mode='image_edit';
 const tasks=await quoteAndSubmit([{body,title:prompt.slice(0,40),parentWorkId}]);return tasks[0];
}
export function cancelLiveTask(id:string){const timer=timers.get(id);if(timer)clearTimeout(timer);timers.delete(id);useApp.getState().updateTask(id,{syncError:'本机已暂停查询，服务端仍可能继续执行'});}
