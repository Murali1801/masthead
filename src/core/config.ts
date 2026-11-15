import type { ColorRole, Config, FontRole, Pair, TemplateId } from './types.ts';
import { FONT_BY_ID } from './fonts.ts';
import { isHex } from './color.ts';
import { getTemplate, TEMPLATE_BY_ID } from './templates/index.ts';

/** Brand palette: Paper / Night, ink, stone, rule, cobalt, signal yellow. */
export const BRAND: Record<ColorRole, Pair> = {
  bg: { light: '#F3F0E8', dark: '#121210' },
  ink: { light: '#16150F', dark: '#ECEAE4' },
  muted: { light: '#6E6A62', dark: '#A19C92' },
  rule: { light: '#D9D4C8', dark: '#2A2925' },
  accent: { light: '#2747D9', dark: '#7B93FF' },
  mark: { light: '#F6D21F', dark: '#F6D21F' },
};

export const COLOR_ROLES: readonly ColorRole[] = ['bg', 'ink', 'muted', 'rule', 'accent', 'mark'];
export const COLOR_LABELS: Record<ColorRole, string> = {
  bg: 'Background',
  ink: 'Ink',
  muted: 'Secondary',
  rule: 'Hairlines',
  accent: 'Accent',
  mark: 'Mark',
};

const DEFAULT_FONTS: Record<FontRole, string> = {
  display: 'schibsted-grotesk-700',
  text: 'schibsted-grotesk-400',
  mono: 'jetbrains-mono-400',
};

export const MAX_DURATION = 8;
export const MIN_DURATION = 1;

export function defaultConfig(id: TemplateId = 'specimen'): Config {
  const t = getTemplate(id);
  return {
    version: 1,
    name: t.defaults.name,
    template: t.id,
    height: t.height,
    radius: t.id === 'card' ? 12 : 10,
    alt: t.defaults.alt,
    fields: { ...t.defaults.fields },
    fonts: { ...DEFAULT_FONTS, ...t.defaults.fonts },
    colors: structuredClone(BRAND),
    timing: { duration: t.defaults.duration, mode: t.defaults.mode, tracks: {} },
  };
}

const clamp = (v: unknown, lo: number, hi: number, d: number) => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : d;
  return Math.min(hi, Math.max(lo, n));
};
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** Validate anything (imported JSON, URL hash, CLI file) into a complete Config. */
export function normalize(input: unknown): Config {
  const i = obj(input);
  const id = (typeof i.template === 'string' && TEMPLATE_BY_ID.has(i.template as TemplateId) ? i.template : 'specimen') as TemplateId;
  const t = getTemplate(id);
  const base = defaultConfig(id);

  const fields: Config['fields'] = { ...base.fields };
  const fi = obj(i.fields);
  for (const spec of t.fields) {
    const v = fi[spec.key];
    if (spec.kind === 'toggle') {
      if (typeof v === 'boolean') fields[spec.key] = v;
      continue;
    }
    if (typeof v !== 'string') continue;
    if (spec.kind === 'color') {
      if (isHex(v)) fields[spec.key] = v.toUpperCase();
      continue;
    }
    if (spec.kind === 'select') {
      if (spec.options?.some((o) => o.value === v)) fields[spec.key] = v;
      continue;
    }
    fields[spec.key] = v.slice(0, spec.max ?? 200);
  }

  const fonts = { ...base.fonts };
  const fo = obj(i.fonts);
  for (const role of Object.keys(fonts) as FontRole[]) {
    const v = fo[role];
    if (typeof v === 'string' && FONT_BY_ID.has(v)) fonts[role] = v;
  }

  const colors = structuredClone(base.colors);
  const co = obj(i.colors);
  for (const role of COLOR_ROLES) {
    const p = obj(co[role]);
    if (isHex(p.light)) colors[role].light = p.light.toUpperCase();
    if (isHex(p.dark)) colors[role].dark = p.dark.toUpperCase();
  }

  const ti = obj(i.timing);
  const tracks: Config['timing']['tracks'] = {};
  for (const [k, v] of Object.entries(obj(ti.tracks))) {
    const o = obj(v);
    if (typeof o.start === 'number' && typeof o.dur === 'number' && /^[\w-]{1,32}$/.test(k)) {
      tracks[k] = { start: clamp(o.start, 0, 1, 0), dur: clamp(o.dur, 0.005, 1, 0.1) };
    }
  }

  const [hmin, hmax] = t.heightRange ?? [t.height, t.height];
  const name =
    typeof i.name === 'string'
      ? i.name.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
      : '';
  return {
    version: 1,
    name: name || base.name,
    template: id,
    height: Math.round(clamp(i.height, hmin, hmax, t.height)),
    radius: Math.round(clamp(i.radius, 0, 32, base.radius)),
    alt: typeof i.alt === 'string' ? i.alt.slice(0, 200) : base.alt,
    fields,
    fonts,
    colors,
    timing: {
      duration: Math.round(clamp(ti.duration, MIN_DURATION, MAX_DURATION, base.timing.duration) * 10) / 10,
      mode: ti.mode === 'loop' || ti.mode === 'once' ? ti.mode : base.timing.mode,
      tracks,
    },
  };
}

/** Switch template with its own content and type, keeping the colours. */
export function switchTemplate(cfg: Config, id: TemplateId): Config {
  const next = defaultConfig(id);
  next.colors = structuredClone(cfg.colors);
  return next;
}

function b64urlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): string {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
}

export function encodeHash(cfg: Config): string {
  return b64urlEncode(JSON.stringify(cfg));
}

export function decodeHash(hash: string): Config | null {
  const s = hash.replace(/^#/, '').replace(/^c=/, '');
  if (!s) return null;
  try {
    return normalize(JSON.parse(b64urlDecode(s)));
  } catch {
    return null;
  }
}

/** Font ids a config needs loaded. */
export function fontsNeeded(cfg: Config): string[] {
  const t = getTemplate(cfg.template);
  return [...new Set(t.roles.map((r) => cfg.fonts[r]))];
}
