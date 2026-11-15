import type { FontRole } from './types.ts';

export interface FontMeta {
  id: string;
  family: string;
  weight: number;
  italic: boolean;
  file: string;
  kind: 'sans' | 'serif' | 'mono';
}

const f = (family: string, weight: number, kind: FontMeta['kind'], italic = false): FontMeta => {
  const slug = family.toLowerCase().replace(/\s+/g, '-');
  const id = `${slug}-${weight}${italic ? '-italic' : ''}`;
  return { id, family, weight, italic, file: `${id}.ttf`, kind };
};

/** The curated set. Static TTFs live in public/fonts (OFL, see LICENSES.md). */
export const FONTS: readonly FontMeta[] = [
  f('Schibsted Grotesk', 700, 'sans'),
  f('Schibsted Grotesk', 400, 'sans'),
  f('Instrument Sans', 600, 'sans'),
  f('Instrument Sans', 400, 'sans'),
  f('Bricolage Grotesque', 700, 'sans'),
  f('Syne', 700, 'sans'),
  f('Unbounded', 600, 'sans'),
  f('Archivo Black', 400, 'sans'),
  f('Instrument Serif', 400, 'serif'),
  f('Instrument Serif', 400, 'serif', true),
  f('Fraunces', 600, 'serif'),
  f('DM Serif Display', 400, 'serif'),
  f('Young Serif', 400, 'serif'),
  f('JetBrains Mono', 400, 'mono'),
  f('JetBrains Mono', 700, 'mono'),
  f('IBM Plex Mono', 500, 'mono'),
];

export const FONT_BY_ID: ReadonlyMap<string, FontMeta> = new Map(FONTS.map((m) => [m.id, m]));

/** Glyphs missing from a face fall back to these, in order. */
export const FALLBACK_FONTS = ['jetbrains-mono-400', 'schibsted-grotesk-400'] as const;

export function fontLabel(id: string): string {
  const m = FONT_BY_ID.get(id);
  if (!m) return id;
  return `${m.family} ${m.weight}${m.italic ? ' Italic' : ''}`;
}

/** Fonts offered for a role: mono role gets mono faces only. */
export function fontsForRole(role: FontRole): FontMeta[] {
  return FONTS.filter((m) => (role === 'mono' ? m.kind === 'mono' : true));
}
