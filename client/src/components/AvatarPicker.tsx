import { useRef, useState } from 'react';
import { ImagePlus, Shuffle } from 'lucide-react';
import { Button, Dialog } from './ui';
import { useApp } from '../stores/app';
import { useAuth } from '../stores/auth';
import { avatarPresets, defaultAvatarIndex } from '../data/avatarPresets';

export function AvatarPicker() {
  const { user } = useAuth();
  const { avatars, setAvatar, notify } = useApp();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  if (!user) return null;
  const saved = avatars[user!.id];
  const current = saved?.type === 'custom' ? null : avatarPresets[saved ? Number(saved.value) : defaultAvatarIndex(user!.id)];
  async function upload(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { notify('请选择图片文件'); return; }
    if (file.size > 10 * 1024 * 1024) { notify('头像不能超过 10 MB'); return; }
    setBusy(true);
    try {
      const image = await createImageBitmap(file);
      const size = Math.min(image.width, image.height);
      const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('无法处理图片');
      context.drawImage(image, (image.width - size) / 2, (image.height - size) / 2, size, size, 0, 0, 256, 256);
      setAvatar(user!.id, { type: 'custom', value: canvas.toDataURL('image/webp', 0.86) });
      notify('头像已更新'); setOpen(false);
    } catch (error) { notify(error instanceof Error ? error.message : '头像处理失败'); }
    finally { setBusy(false); }
  }
  return <>
    <div className="avatar-picker-card">
      <div className="avatar-current"><span className="user-avatar avatar-large">{current ? <img src={current.src} alt="" /> : saved ? <img src={saved.value} alt="" /> : null}</span><div><h2>头像</h2><p className="muted">系统默认使用卡通动漫头像，也可以上传自己的图片。</p></div></div>
      <div className="header-actions"><Button variant="secondary" onClick={() => setOpen(true)}>更换头像</Button><Button variant="ghost" onClick={() => { setAvatar(user!.id, { type: 'system', value: String(defaultAvatarIndex(user!.id)) }); notify('已恢复系统默认头像'); }}><Shuffle size={14} /> 默认头像</Button></div>
    </div>
    {open && <Dialog title="选择头像" onClose={() => setOpen(false)} wide><div className="dialog-content"><p className="muted">选择系统卡通动漫头像，或上传自己的图片。</p><div className="avatar-preset-grid">{avatarPresets.map((preset, index) => <button type="button" key={preset.id} className={`avatar-preset ${saved?.type === 'system' && Number(saved.value) === index ? 'selected' : ''}`} onClick={() => { setAvatar(user!.id, { type: 'system', value: String(index) }); notify('头像已更新'); setOpen(false); }}><img src={preset.src} alt={preset.name} /><span>{preset.name}</span></button>)}</div><div className="dialog-actions"><input ref={fileRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={event => void upload(event.target.files?.[0])} /><Button variant="secondary" disabled={busy} onClick={() => fileRef.current?.click()}><ImagePlus size={15} /> {busy ? '处理中…' : '上传图片'}</Button><Button variant="ghost" onClick={() => setOpen(false)}>取消</Button></div></div></Dialog>}
  </>;
}
