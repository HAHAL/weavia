import { useState } from 'react';
import { Shuffle } from 'lucide-react';
import { Button, Dialog } from './ui';
import { useApp } from '../stores/app';
import { useAuth } from '../stores/auth';
import { apiRequest, isLiveMode } from '../services/api';
import { avatarIdForUser, avatarPresets, normalizeAvatarId } from '../data/avatarPresets';

export function AvatarPicker() {
  const { user } = useAuth();
  const setUser = useAuth.setState;
  const { avatars, setAvatar, notify } = useApp();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  const localChoice = avatars[user.id];
  const selectedId = normalizeAvatarId(user.avatarUrl)
    || normalizeAvatarId(localChoice?.type === 'system' ? localChoice.value : undefined)
    || avatarIdForUser();
  const current = avatarPresets.find(preset => preset.id === selectedId) || avatarPresets[0];

  async function chooseAvatar(avatarId: string) {
    if (!user || busy) return;
    setBusy(true);
    try {
      if (isLiveMode()) {
        await apiRequest<{ avatarUrl: string }>('/api/me/avatar', {
          method: 'PUT',
          body: JSON.stringify({ avatarId }),
        });
      }
      setUser(state => state.user?.id === user.id
        ? { user: { ...state.user, avatarUrl: avatarId } }
        : {});
      setAvatar(user.id, { type: 'system', value: avatarId });
      notify('头像已更新，并同步到你的账户');
      setOpen(false);
    } catch (error) {
      notify(error instanceof Error ? error.message : '头像保存失败，请重试');
    } finally {
      setBusy(false);
    }
  }

  return <>
    <div className="avatar-picker-card">
      <div className="avatar-current">
        <span className="user-avatar avatar-large"><img src={current.src} alt="" /></span>
        <div><h2>账户头像</h2><p className="muted">选择后会同步到后台账户资料。</p></div>
      </div>
      <div className="header-actions">
        <Button variant="secondary" disabled={busy} onClick={() => setOpen(true)}>选择吉祥物</Button>
        <Button variant="ghost" disabled={busy || selectedId === avatarIdForUser()} onClick={() => void chooseAvatar(avatarIdForUser())}><Shuffle size={14} /> 恢复默认</Button>
      </div>
    </div>
    {open && <Dialog title="选择账户头像" onClose={() => !busy && setOpen(false)} wide>
      <div className="dialog-content">
        <p className="muted">头像会保存到账户；后台用户中心也会显示相同形象。</p>
        <div className="avatar-preset-grid">
          {avatarPresets.map(preset => <button type="button" key={preset.id}
            className={`avatar-preset ${selectedId === preset.id ? 'selected' : ''}`}
            aria-pressed={selectedId === preset.id}
            disabled={busy}
            onClick={() => void chooseAvatar(preset.id)}>
            <img src={preset.src} alt="" /><span>{preset.name}</span>
          </button>)}
        </div>
        {busy && <p className="muted" role="status">正在保存账户头像…</p>}
        <div className="dialog-actions"><Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>取消</Button></div>
      </div>
    </Dialog>}
  </>;
}
