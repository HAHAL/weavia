import { create } from 'zustand';
import { apiRequest,ApiError } from './api';
import { currentScope } from '../stores/scope';
import { useApp } from '../stores/app';
import { trackLiveTask } from './live';
import type { ServerTask } from './taskState';
import type { ProductBrief } from '../types';
export type Submission = {body:Record<string,unknown>;title:string;product?:ProductBrief;referenceAssetIds?:string[];parentWorkId?:string};
type Quote={id:string;totalCredits:number;expiresAt:string};
export type Approved = Submission & {quote:Quote;batchId:string};
type Confirmation={items:Approved[];available:number;resolve:(accepted:boolean)=>void};
export const useQuoteConfirmation=create<{pending:Confirmation|null}>(()=>({pending:null}));
const key=()=>`weavia.pending.${currentScope()}`;
export function pendingSubmissions():Approved[]{try{return JSON.parse(localStorage.getItem(key())||'[]');}catch{return [];}}
function save(items:Approved[]){localStorage.setItem(key(),JSON.stringify(items));window.dispatchEvent(new Event('weavia:pending'));}
window.addEventListener('weavia:scope',()=>{const p=useQuoteConfirmation.getState().pending;p?.resolve(false);useQuoteConfirmation.setState({pending:null});});
let quoting=false;
export async function quoteAndSubmit(items:Submission[]):Promise<string[]>{
 if(quoting||useQuoteConfirmation.getState().pending)throw new Error('请先处理当前报价');
 quoting=true;
 try{
 const scope=currentScope(),batchId=crypto.randomUUID();
 const approved:Approved[]=[];
 for(const item of items){item.body={...item.body,clientBatchId:batchId,clientTitle:item.title,parentWorkId:item.parentWorkId};const quote=await apiRequest<Quote>('/api/ai/quotes',{method:'POST',body:JSON.stringify(item.body)});approved.push({...item,quote,batchId});}
 const account=await apiRequest<{available:number}>('/api/credits');
 if(scope!==currentScope())throw new Error('账户已切换');
 const accepted=await new Promise<boolean>(resolve=>useQuoteConfirmation.setState({pending:{items:approved,available:account.available,resolve}}));
 useQuoteConfirmation.setState({pending:null});
 if(!accepted)throw new Error('已取消提交，草稿已保留');
 if(scope!==currentScope())throw new Error('账户已切换');
 save([...pendingSubmissions(),...approved]);
 return await resumeSubmissions(batchId);
 }finally{quoting=false;}
}
let submitting=false;
export async function resumeSubmissions(batchId?:string):Promise<string[]>{
 if(submitting)throw new Error('正在核对已确认的提交，请稍候');
 submitting=true;const scope=currentScope();const ids:string[]=[];
 try{
  for(const item of pendingSubmissions().filter(i=>!batchId||i.batchId===batchId)){
   if(scope!==currentScope())throw new Error('账户已切换');
   let server:ServerTask;
   try{server=await apiRequest<ServerTask>('/api/ai/tasks',{method:'POST',body:JSON.stringify({...item.body,quoteId:item.quote.id,idempotencyKey:`quote-${item.quote.id}`})});}
   catch(error){
     if(scope===currentScope()&&error instanceof ApiError&&['QUOTE_EXPIRED','QUOTE_CHANGED','QUOTE_MISMATCH'].includes(error.code)){
       // Definitive rejection: preserve a retryable draft, not an ambiguous submission.
       useApp.getState().submitTask({id:`unsubmitted-${item.quote.id}`,title:item.title,prompt:String(item.body.prompt||''),mode:String(item.body.mode).includes('video')?'video':'image',source:'live',status:'Failed',progress:0,createdAt:new Date().toISOString(),error:'报价已失效，本项未创建生成任务。可调整后重新报价。',errorCode:error.code,product:item.product,referenceAssetIds:item.referenceAssetIds,batchId:item.batchId,params:item.body});
       save(pendingSubmissions().filter(x=>x.quote.id!==item.quote.id));
     }
     throw error;
   }
   if(scope!==currentScope())throw new Error('账户已切换');
   trackLiveTask(server,String(item.body.prompt||item.title),item.parentWorkId,item.product);
   useApp.getState().updateTask(server.id,{title:item.title,batchId:item.batchId,referenceAssetIds:item.referenceAssetIds,params:item.body});
   ids.push(server.id);save(pendingSubmissions().filter(x=>x.quote.id!==item.quote.id));
  }
  return ids;
 }finally{submitting=false;}
}
export function removeUnsubmitted(quoteId:string){save(pendingSubmissions().filter(x=>x.quote.id!==quoteId));}
