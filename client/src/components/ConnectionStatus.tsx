import {useEffect,useState} from 'react';
import {apiConfig} from '../services/api';
export const BUILD_TAG=import.meta.env.VITE_BUILD_TAG||'2026-10-27-client';
export function ConnectionStatus(){
 const [state,setState]=useState('正在检查服务');
 useEffect(()=>{if(apiConfig.mode!=='live')return;
 let active=true;
 const check=async()=>{try{const r=await fetch(apiConfig.baseUrl+'/api/readiness',{signal:AbortSignal.timeout(5000)});if(active)setState(r.ok?'服务可用':'服务暂不可用');}catch{if(active)setState('无法连接服务');}};
 void check();const timer=setInterval(()=>void check(),60000);return()=>{active=false;clearInterval(timer);};},[]);
 return <span role="status">{apiConfig.mode==='mock'?'演示工作区 · 不调用模型':state}</span>;
}
