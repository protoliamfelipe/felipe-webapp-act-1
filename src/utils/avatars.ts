function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export interface PresetAvatar {
  id: string;
  label: string;
  url: string;
}

export const PRESET_AVATARS: PresetAvatar[] = [
  {
    id: 'visor_emblem',
    label: 'Visor Emblem',
    url: svgToDataUri(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#09090b"/><path d="M24 96c0-20 16-32 36-32s36 12 36 32" fill="#f4f4f5"/><circle cx="60" cy="44" r="21" fill="#ffffff"/><path d="M40 42h40v8H40z" fill="#18181b"/><path d="M44 45h12v2H44zm20 0h12v2H64z" fill="#e4e4e7"/></svg>`
    ),
  },
  {
    id: 'geometric_crest',
    label: 'Geometric Crest',
    url: svgToDataUri(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#18181b"/><path d="M60 18L94 38L80 90L60 104L40 90L26 38Z" fill="none" stroke="#ffffff" stroke-width="4"/><path d="M38 45L60 32L82 45L60 80Z" fill="#e4e4e7"/></svg>`
    ),
  },
  {
    id: 'diagonal_mark',
    label: 'Diagonal Mark',
    url: svgToDataUri(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#f4f4f5"/><circle cx="60" cy="60" r="42" fill="#09090b"/><path d="M34 86L86 34M42 34h44v44" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    ),
  },
  {
    id: 'halo_ring',
    label: 'Halo Ring',
    url: svgToDataUri(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#27272a"/><ellipse cx="60" cy="34" rx="26" ry="7" fill="none" stroke="#ffffff" stroke-width="4"/><circle cx="60" cy="64" r="18" fill="#ffffff"/><path d="M30 104c4-15 16-24 30-24s26 9 30 24" fill="#d4d4d8"/></svg>`
    ),
  },
  {
    id: 'hex_emblem',
    label: 'Hex Emblem',
    url: svgToDataUri(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#09090b"/><polygon points="60,20 96,42 96,78 60,100 24,78 24,42" fill="none" stroke="#a1a1aa" stroke-width="3"/><circle cx="60" cy="52" r="15" fill="#ffffff"/><path d="M36 86c5-11 14-16 24-16s19 5 24 16" fill="#d4d4d8"/></svg>`
    ),
  },
];

export function makeInitialsAvatar(name: string): string {
  const initials = (name || 'P')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('') || 'P';

  return svgToDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#18181b"/><text x="60" y="70" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="42" fill="#ffffff">${initials}</text></svg>`
  );
}

export function getServerMonogram(name: string): string {
  const words = (name || 'S').trim().split(/\s+/);
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
