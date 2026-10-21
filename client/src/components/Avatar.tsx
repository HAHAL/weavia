import { useApp } from '../stores/app';
import { useAuth } from '../stores/auth';
import { avatarPresets, defaultAvatarIndex } from '../data/avatarPresets';

export function Avatar({ size = 32, className = '' }: { size?: number; className?: string }) {
  const user = useAuth(state => state.user);
  const saved = useApp(state => user ? state.avatars[user.id] : undefined);
  const preset = avatarPresets[saved?.type === 'system' ? Number(saved.value) : defaultAvatarIndex(user?.id || 'weavia')] || avatarPresets[0];
  const src = saved?.type === 'custom' ? saved.value : preset.src;
  return <span className={`user-avatar ${className}`} style={{ width: size, height: size }} aria-hidden="true">
    {src ? <img src={src} alt="" /> : <span>{user?.email.slice(0, 1).toUpperCase() || 'W'}</span>}
  </span>;
}
