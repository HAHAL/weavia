import type { Task, TaskStatus, Work, Asset } from '../types';
export type ServerTask = {
 id:string; status:string; clientBatchId?:string;clientTitle?:string;parentWorkId?:string; prompt?:string; mode?:string; model?:string; provider?:string; providerTaskId?:string;
 createdAt?:string; updatedAt?:string; ratio?:string; resolution?:string; count?:number; cost?:number;
 outputs?:{base64Data?:string;objectKey?:string;mimeType?:string;size?:number}[];
 error?:{code?:string;message?:string}; creative?:Task['creative']; billing?:Task['billing'];
};
export function mapStatus(status:string):TaskStatus {
 if(status==='success')return 'Succeeded'; if(status==='failed')return 'Failed'; if(status==='cancelled')return 'Cancelled';
 return ['running','downloading','reconciling'].includes(status)?'Running':'Queued';
}
export function toTask(server:ServerTask,prompt=server.prompt||'历史创作',previous?:Task):Task {
 const product=server.creative?.product;
 return {...previous,id:server.id,title:server.clientTitle||previous?.title||prompt.slice(0,40),batchId:server.clientBatchId||previous?.batchId,parentWorkId:server.parentWorkId||previous?.parentWorkId,prompt,mode:server.mode?.includes('video')?'video':'image',status:mapStatus(server.status),
 progress:server.status==='success'?100:0,remoteStatus:server.status,checkedAt:new Date().toISOString(),syncError:undefined,
 createdAt:server.createdAt||previous?.createdAt||new Date().toISOString(),source:'live',error:server.error?.message,errorCode:server.error?.code,
 provider:server.provider,providerTaskId:server.providerTaskId,model:server.model,creative:server.creative,billing:server.billing,
 expectedOutputs:server.outputs?.length||previous?.expectedOutputs,params:{...previous?.params,ratio:server.ratio,resolution:server.resolution,count:server.count},
 product:previous?.product||(product?{id:product.localId||'',name:product.name,sku:product.sku||'',description:product.description||'',verifiedFacts:product.verifiedFacts||'',forbiddenClaims:product.forbiddenClaims||'',sourceAssetId:''}:undefined)};
}
// Restore output identities immediately; files are fetched on demand, not all at launch.
export function restoreOutputs(task:Task,server:ServerTask,works:Work[],assets:Asset[]) {
 const nextWorks=works.map(w=>({...w,versions:[...w.versions]})), nextAssets=[...assets];
 if(server.status!=='success')return {works:nextWorks,assets:nextAssets};
 (server.outputs||[]).forEach((output,index)=>{
  if(!output.objectKey&&!output.base64Data)return;
  const assetId=`cloud-${task.id}-${index}`;
  if(!nextAssets.some(a=>a.id===assetId))nextAssets.push({id:assetId,name:`${task.title}-${index+1}`,category:'作品',mime:output.mimeType||(task.mode==='video'?'video/mp4':'image/png'),createdAt:task.createdAt,remoteTaskId:task.id,outputIndex:index,...(output.base64Data?{dataUrl:output.base64Data}:{})});
  const parent=task.parentWorkId?nextWorks.find(w=>w.id===task.parentWorkId):undefined;
  if(parent&&index===0){if(!parent.versions.some(v=>v.assetId===assetId))parent.versions.push({id:`${task.id}-${index}`,createdAt:task.createdAt,prompt:task.prompt,assetId,mimeType:output.mimeType});parent.reviewStatus='pending';return;}
  const old=nextWorks.find(w=>w.taskId===task.id&&(w.outputIndex??0)===index);
  if(old){
   old.referenceAssetId ||= task.referenceAssetIds?.[0];
   const v=old.versions.at(-1);
   const existing=nextAssets.find(a=>a.id===v?.assetId);
   if(existing&&!existing.remoteTaskId){const pos=nextAssets.indexOf(existing);nextAssets[pos]={...existing,remoteTaskId:task.id,outputIndex:index};}
   if(v&&!v.dataUrl&&!nextAssets.some(a=>a.id===v.assetId))old.versions=old.versions.map(x=>x===v?{...x,assetId}:x);
  }else nextWorks.push({id:`work-${task.id}-${index}`,title:`${task.title}${(server.outputs?.length||0)>1?' · '+(index+1):''}`,mode:task.mode,taskId:task.id,source:'live',product:task.product,referenceAssetId:task.referenceAssetIds?.[0],reviewStatus:'pending',outputIndex:index,batchId:task.batchId,versions:[{id:`${task.id}-${index}`,createdAt:task.createdAt,prompt:task.prompt,assetId,mimeType:output.mimeType}]});
 });
 return {works:nextWorks,assets:nextAssets};
}
export function taskLabel(t:Task) {
 if(t.syncError)return '等待连接';
 if(t.status==='Succeeded')return t.expectedOutputs?'可查看结果':'等待结果同步';
 if(t.status==='Failed')return '未完成'; if(t.status==='Cancelled')return '已取消';
 return ({downloading:'保存结果中',reconciling:'核对上游状态',running:'生成中',reserved:'排队中'} as Record<string,string>)[t.remoteStatus||'']||(t.status==='Queued'?'排队中':'生成中');
}
