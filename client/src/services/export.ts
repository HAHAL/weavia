import {isTauri} from '@tauri-apps/api/core';
import {save} from '@tauri-apps/plugin-dialog';
import {writeFile} from '@tauri-apps/plugin-fs';
import {loadAssetPreview} from './assets';
import {useApp} from '../stores/app';
import {makeZip} from '../lib/zip';
import type {Work} from '../types';
export async function saveBlob(blob:Blob,name:string){
 if(isTauri()){const path=await save({defaultPath:name});if(!path)return false;await writeFile(path,new Uint8Array(await blob.arrayBuffer()));return true;}
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);return true;
}
export async function exportWorks(works:Work[]){
 if(!works.length)throw new Error('请先选择作品');
 let bytes=0;const files:{name:string;data:Uint8Array}[]=[];
 for(const [index,work] of works.entries()){
  const version=work.versions.at(-1),asset=useApp.getState().assets.find(a=>a.id===version?.assetId);
  const url=version?.dataUrl||(asset?await loadAssetPreview(asset):'');if(!url)throw new Error(`${work.title} 暂不可读取，请刷新结果`);
  try{const blob=await(await fetch(url)).blob();bytes+=blob.size;if(bytes>256*1024*1024)throw new Error('本批素材超过 256 MB，请分批导出');const ext=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/svg+xml':'svg','video/mp4':'mp4','video/webm':'webm'} as Record<string,string>)[blob.type.split(';')[0].trim().toLowerCase()]||'bin';
   files.push({name:`${String(index+1).padStart(2,'0')}-${work.title.replace(/[\\/:*?"<>|]/g,'-').slice(0,60)}.${ext}`,data:new Uint8Array(await blob.arrayBuffer())});
  }finally{if(url.startsWith('blob:'))URL.revokeObjectURL(url);}
 }
 if(files.length===1)return saveBlob(new Blob([files[0].data as BlobPart]),files[0].name);
 files.push({name:'作品清单.json',data:new TextEncoder().encode(JSON.stringify(works.map(w=>({title:w.title,taskId:w.taskId,reviewStatus:w.reviewStatus,versions:w.versions.length})),null,2))});
 return saveBlob(new Blob([makeZip(files) as BlobPart],{type:'application/zip'}),'WEAVIA-商品素材.zip');
}
