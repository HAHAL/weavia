import { isTauri } from '@tauri-apps/api/core';
import { BaseDirectory } from '@tauri-apps/api/path';
import { mkdir, readFile, remove, writeFile } from '@tauri-apps/plugin-fs';
import type { Asset } from '../types';
import { log } from '../lib/logger';
const DIR='assets';
async function sha256(bytes:Uint8Array){const digest=await crypto.subtle.digest('SHA-256',bytes as BufferSource);return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');}
function extension(mime:string){return ({'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'} as Record<string,string>)[mime]||'bin';}
export async function importAsset(file:File):Promise<Asset>{
  if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type))throw new Error('仅支持 PNG、JPEG、WebP、GIF 图片');
  const maxMb=isTauri()?10:2;
  if(file.size>maxMb*1024*1024)throw new Error(`单个图片不能超过 ${maxMb} MB`);
  const id=crypto.randomUUID();const bytes=new Uint8Array(await file.arrayBuffer());const common={id,name:file.name,category:'商品图',mime:file.type,size:file.size,sha256:await sha256(bytes),createdAt:new Date().toISOString()};
  if(isTauri()) {const localPath=`${DIR}/${id}.${extension(file.type)}`;try{await mkdir(DIR,{baseDir:BaseDirectory.AppLocalData,recursive:true});await writeFile(localPath,bytes,{baseDir:BaseDirectory.AppLocalData});return {...common,localPath};}catch{log('error','asset.write');throw new Error('本地文件写入失败');}}
  return {...common,dataUrl:await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('图片读取失败'));reader.readAsDataURL(file);})};
}
export async function loadAssetPreview(asset:Asset):Promise<string>{
  if(asset.dataUrl)return asset.dataUrl;
  if(!asset.localPath||!isTauri())throw new Error('素材文件路径不可用');
  try{const bytes=await readFile(asset.localPath,{baseDir:BaseDirectory.AppLocalData});if(asset.sha256&&await sha256(bytes)!==asset.sha256)throw new Error('素材校验失败');return URL.createObjectURL(new Blob([bytes as BlobPart],{type:asset.mime}));}catch{log('error','asset.read',asset.id);throw new Error('素材文件丢失或校验失败');}
}
export async function removeAssetFile(asset:Asset){if(!asset.localPath||!isTauri())return;try{await remove(asset.localPath,{baseDir:BaseDirectory.AppLocalData});}catch{log('error','asset.delete',asset.id);throw new Error('关联文件删除失败，素材记录仍保留');}}
