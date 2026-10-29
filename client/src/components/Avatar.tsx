import { useApp } from '../stores/app';
import { useAuth } from '../stores/auth';
import { avatarIdForUser, avatarPresets, normalizeAvatarId } from '../data/avatarPresets';

export function Avatar({ size = 32, className = '' }: { size?: number; className?: string }) {
  const user = useAuth(state => state.user);
  const saved = useApp(state => user ? state.avatars[user.id] : undefined);
  const avatarId = normalizeAvatarId(user?.avatarUrl) || normalizeAvatarId(saved?.type === 'system' ? saved.value : undefined) || avatarIdForUser(user?.id || 'weavia');
  const preset = avatarPresets.find(item => item.id === avatarId) || avatarPresets[0];
  const src = preset.src;
  return <span className={`user-avatar ${className}`} style={{ width: size, height: size }} aria-hidden="true">
    {src ? <img src={src} alt="" /> : <span>{user?.email.slice(0, 1).toUpperCase() || 'W'}</span>}
  </span>;
}
