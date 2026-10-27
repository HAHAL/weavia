export type AvatarPreset = { id: string; name: string; src: string };

export const avatarPresets: AvatarPreset[] = [
  { id: 'mascot-fox', name: '小狐狸', src: '/avatars/mascot-fox.png' },
  { id: 'mascot-bear', name: '小熊', src: '/avatars/mascot-bear.png' },
  { id: 'mascot-rabbit', name: '小兔', src: '/avatars/mascot-rabbit.png' },
  { id: 'mascot-cat', name: '小猫', src: '/avatars/mascot-cat.png' },
  { id: 'mascot-owl', name: '猫头鹰', src: '/avatars/mascot-owl.png' },
  { id: 'mascot-bird', name: '小鸟', src: '/avatars/mascot-bird.png' },
];

export function avatarIdForUser(userId: string): string {
  let hash = 0;
  for (const char of userId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return avatarPresets[hash % avatarPresets.length].id;
}

export function normalizeAvatarId(value?: string): string | undefined {
  return avatarPresets.some(preset => preset.id === value) ? value : undefined;
}
