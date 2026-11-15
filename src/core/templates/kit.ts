import type { ColorRole, Config, FontRole, FontSet, TemplateId, Variant } from '../types.ts';
import type { Motion, Track } from '../motion.ts';
import type { TextRun } from '../text.ts';
import { r } from '../path.ts';

export interface FieldSpec {
  key: string;
  label: string;
  kind: 'text' | 'textarea' | 'select' | 'toggle' | 'color';
  options?: Array<{ value: string; label: string }>;
  max?: number;
  rows?: number;
  hint?: string;
}

export interface RenderCtx {
  cfg: Config;
  variant: Variant;
  w: number;
  h: number;
  c: Record<ColorRole, string>;
  fonts: FontSet;
  m: Motion;
  /** Field as string. */
  s(key: string): string;
  /** Field as boolean. */
  on(key: string): boolean;
}

export interface TemplateDef {
  id: TemplateId;
  name: string;
  blurb: string;
  width: number;
  height: number;
  heightRange?: [number, number];
  roles: FontRole[];
  fields: FieldSpec[];
  defaults: {
    name: string;
    alt: string;
    duration: number;
    mode: 'loop' | 'once';
    fields: Record<string, string | boolean>;
    fonts?: Partial<Record<FontRole, string>>;
  };
  render(ctx: RenderCtx): string;
}

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export { r };

/** Background plate. */
export function plate(ctx: RenderCtx, border = false): string {
  const rx = ctx.cfg.radius > 0 ? ` rx="${r(ctx.cfg.radius)}"` : '';
  if (!border) return `<rect width="${ctx.w}" height="${ctx.h}"${rx} fill="${ctx.c.bg}"/>`;
  return `<rect x=".5" y=".5" width="${ctx.w - 1}" height="${ctx.h - 1}"${rx} fill="${ctx.c.bg}" stroke="${ctx.c.rule}"/>`;
}

/** The brand mark: a yellow square, 1px ink outline on light, none on dark. */
export function mark(ctx: RenderCtx, x: number, y: number, size: number, attr = ''): string {
  const stroke = ctx.variant === 'light' ? ` stroke="${ctx.c.ink}"` : '';
  const i = ctx.variant === 'light' ? 0.5 : 0;
  return `<rect${attr} x="${r(x + i)}" y="${r(y + i)}" width="${r(size - 2 * i)}" height="${r(size - 2 * i)}" fill="${ctx.c.mark}"${stroke}/>`;
}

/** One path per glyph, each on `track` with its own stagger index. */
export function glyphs(run: TextRun, track: Track | null, extra = '', countSpaces = false): string {
  let i = 0;
  let out = '';
  for (const g of run.glyphs) {
    if (!g.d) {
      if (countSpaces) i++;
      continue;
    }
    out += `<path${track ? track.attr(i++) : ''}${extra} d="${g.d}"/>`;
  }
  return out;
}

/** The whole run as one path. */
export function textPath(run: TextRun, attr = ''): string {
  return run.d ? `<path${attr} d="${run.d}"/>` : '';
}

export const DRAW = [
  { at: 0, css: 'stroke-dashoffset:1' },
  { at: 1, css: 'stroke-dashoffset:0' },
];

export const FADE = [
  { at: 0, css: 'opacity:0' },
  { at: 1, css: 'opacity:1' },
];

export function rise(px: number) {
  return [
    { at: 0, css: `opacity:0;transform:translateY(${r(px)}px)` },
    { at: 1, css: 'opacity:1;transform:none' },
  ];
}

/** Blinking block cursor, 1 s, steps(1): no easing, under 3 flashes a second. */
export function blink(m: Motion): Track {
  return m.track({
    id: 'blink',
    label: 'Cursor blinks',
    start: 0,
    dur: 1,
    frames: [
      { at: 0, css: 'opacity:1' },
      { at: 0.5, css: 'opacity:0' },
      { at: 1, css: 'opacity:0' },
    ],
    ambient: { period: 1, ease: 'steps(1,end)' },
  });
}

/** Split a list field on newlines, commas or middle dots. */
export function list(s: string, max: number): string[] {
  return s
    .split(/\n|,|·/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, max);
}

export const SECS = (ctx: RenderCtx, seconds: number) => seconds / ctx.cfg.timing.duration;
