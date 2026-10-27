import { useRef, useState } from 'react';
import { ImagePlus, Library, Trash2 } from 'lucide-react';
import { Button, Dialog } from './ui';
import { useApp } from '../stores/app';
import { useAssetPreview } from '../hooks/useAssetPreview';
import { importAsset } from '../services/assets';
import type { Asset } from '../types';

function Thumb({ asset, onRemove }: { asset: Asset; onRemove?: () => void }) {
  const {url}=useAssetPreview(asset.id);
  return <span className="asset-pick-thumb">{url ? <img src={url} alt={asset.name} /> : <span>{asset.name.slice(0, 2)}</span>}{onRemove && <button type="button" aria-label={`移除 ${asset.name}`} onClick={onRemove}><Trash2 size={12} /></button>}</span>;
}

export function AssetPicker({ selected, onChange, max=1 }: { selected: string[]; onChange: (ids: string[]) => void; max?:number }) {
  const { assets, addAsset, notify } = useApp();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const chosen = assets.filter(asset => selected.includes(asset.id));

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    if(selected.length>=max){notify(`当前支持 ${max} 张商品依据图，请先移除后替换。`);return;}
    setBusy(true);
    const added: string[] = [];
    for (const file of Array.from(files).slice(0,max-selected.length)) {
      try { const asset = await importAsset(file); addAsset({ ...asset, category: '参考图' }); added.push(asset.id); }
      catch (error) { notify(error instanceof Error ? error.message : '素材上传失败'); }
    }
    if (added.length) onChange([...new Set([...selected, ...added])]);
    setBusy(false); if (fileRef.current) fileRef.current.value = '';
  }

  function toggle(id: string) {
    if(!selected.includes(id)&&selected.length>=max){notify(`当前支持 ${max} 张商品依据图，请先移除后替换。`);return;}
    onChange(selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id]);
  }

  return <div className="asset-picker">
    <div className="asset-picker-row">
      {chosen.map(asset => <Thumb key={asset.id} asset={asset} onRemove={() => toggle(asset.id)} />)}
      <button type="button" className="asset-pick-add" disabled={busy} onClick={() => fileRef.current?.click()}><ImagePlus size={15} />{busy ? '上传中…' : '上传素材'}</button>
      <button type="button" className="asset-pick-add" onClick={() => setOpen(true)}><Library size={15} />从素材中心选择</button>
      <input ref={fileRef} hidden type="file" accept="image/png,image/jpeg,image/webp" multiple={max>1} onChange={event => void upload(event.target.files)} />
    </div>
    {open && <Dialog title="从素材中心选择" onClose={() => setOpen(false)} wide><div className="dialog-content"><div className="asset-pick-grid">{assets.length ? assets.filter(asset=>asset.mime.startsWith('image/')).map(asset => <button type="button" key={asset.id} className={`asset-pick-card ${selected.includes(asset.id) ? 'selected' : ''}`} onClick={() => toggle(asset.id)}><Thumb asset={asset} /><span>{asset.name}</span></button>) : <p className="muted">素材中心还没有素材，先上传一张。</p>}</div><div className="dialog-actions"><Button variant="secondary" onClick={() => setOpen(false)}>完成</Button></div></div></Dialog>}
  </div>;
}
