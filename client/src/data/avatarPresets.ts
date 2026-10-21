export type AvatarPreset = { id: string; name: string; src: string };

type Palette = { bg: string; hair: string; hair2: string; skin: string; shirt: string; eye: string; style: number };
const palettes: Palette[] = [
  { bg: '#f5dfbe', hair: '#3b2a24', hair2: '#6b4435', skin: '#f7d7bd', shirt: '#c9974e', eye: '#5b3b2e', style: 0 },
  { bg: '#eadcf2', hair: '#2f2a45', hair2: '#5b4b78', skin: '#f6d2b8', shirt: '#8f7bb5', eye: '#40345c', style: 1 },
  { bg: '#dce9e2', hair: '#5b3a2e', hair2: '#9a6748', skin: '#f2c9a9', shirt: '#6b9b83', eye: '#4c5b46', style: 2 },
  { bg: '#f6e0df', hair: '#6b3b46', hair2: '#a45b68', skin: '#f8d6c1', shirt: '#c87982', eye: '#663b45', style: 3 },
  { bg: '#e2e7f4', hair: '#33384f', hair2: '#5b648a', skin: '#eec6a8', shirt: '#6e82b5', eye: '#303b58', style: 4 },
  { bg: '#f1e8d2', hair: '#7b5a2e', hair2: '#b48a4e', skin: '#f3cdb0', shirt: '#a78a56', eye: '#5b482c', style: 5 },
];

function hairPath(style: number): string {
  switch (style) {
    case 0: return 'M30 52c0-25 14-38 34-38s34 13 34 38c-8-8-16-12-26-15-9 6-19 9-31 9-4 1-8 3-11 6Z';
    case 1: return 'M27 55c-2-27 15-42 38-42 24 0 39 15 37 42-5-10-10-16-16-21-8 7-21 10-34 10-8 0-16 3-25 11Z';
    case 2: return 'M28 53c0-24 16-39 36-39 21 0 36 15 36 39-7-6-12-10-18-12-4 4-11 7-20 8-8 1-15 0-22-2-5 1-8 3-12 6Z';
    case 3: return 'M29 56c-4-27 12-43 35-43 25 0 40 17 35 43-5-12-9-18-15-22-6 6-16 9-28 9-8 0-16 3-27 13Z';
    case 4: return 'M26 54c-1-27 16-41 38-41 23 0 39 14 38 41-7-9-11-14-17-18-7 6-18 9-29 9-8 0-16 3-30 9Z';
    default: return 'M28 55c-2-26 14-41 36-41 24 0 38 16 36 41-6-8-11-13-17-17-7 6-17 9-28 9-9 0-17 3-27 8Z';
  }
}

function createSvg(palette: Palette): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs><radialGradient id="bg" cx="50%" cy="35%" r="80%"><stop offset="0" stop-color="${palette.bg}"/><stop offset="1" stop-color="${palette.bg}" stop-opacity=".55"/></radialGradient></defs>
  <circle cx="64" cy="64" r="64" fill="url(#bg)"/>
  <path d="M22 128c3-24 19-38 42-38s39 14 42 38Z" fill="${palette.shirt}"/>
  <path d="M55 86h18v15c0 6-18 6-18 0Z" fill="${palette.skin}"/>
  <ellipse cx="64" cy="59" rx="29" ry="31" fill="${palette.skin}"/>
  <path d="${hairPath(palette.style)}" fill="${palette.hair}"/>
  <path d="M40 72c5 15 14 22 24 22 11 0 20-7 25-22-7 5-15 7-25 7-9 0-17-2-24-7Z" fill="${palette.hair2}" opacity=".16"/>
  <ellipse cx="51" cy="62" rx="5" ry="6" fill="${palette.eye}"/><ellipse cx="77" cy="62" rx="5" ry="6" fill="${palette.eye}"/>
  <circle cx="52.5" cy="60" r="1.6" fill="#fff"/><circle cx="78.5" cy="60" r="1.6" fill="#fff"/>
  <path d="M46 53c3-2 7-2 10 0M72 53c3-2 7-2 10 0" stroke="${palette.hair}" stroke-width="2" stroke-linecap="round" fill="none"/>
  <ellipse cx="42" cy="72" rx="6" ry="3" fill="#e69b91" opacity=".45"/><ellipse cx="86" cy="72" rx="6" ry="3" fill="#e69b91" opacity=".45"/>
  <path d="M59 75c3 3 7 3 10 0" stroke="#a45b53" stroke-width="2" stroke-linecap="round" fill="none"/>
  <path d="M35 34c12-14 47-16 58 1" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".22" fill="none"/>
</svg>`;
}

export const avatarPresets: AvatarPreset[] = palettes.map((palette, index) => ({
  id: `manga-${index + 1}`,
  name: ['暖金','紫夜','森绿','莓红','海盐','琥珀'][index],
  src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(createSvg(palette))}`,
}));

export function defaultAvatarIndex(userId: string): number {
  let hash = 0;
  for (const char of userId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % avatarPresets.length;
}
