import type { FontLike, FontSet, GlyphLike, PathCommand } from './types.ts';
import { FALLBACK_FONTS } from './fonts.ts';
import { pathData } from './path.ts';

export interface PlacedGlyph {
  char: string;
  /** Pen x of the glyph origin. */
  x: number;
  /** Advance in px, including tracking. */
  advance: number;
  /** Path data, empty for spaces. */
  d: string;
}

export interface TextRun {
  glyphs: PlacedGlyph[];
  width: number;
  /** All glyph outlines in one path. */
  d: string;
  x: number;
  y: number;
  size: number;
}

export interface TextOpts {
  /** Extra space between letters in em. */
  tracking?: number;
  anchor?: 'start' | 'middle' | 'end';
  /** Decimal places for coordinates. */
  dp?: number;
}

function resolve(fonts: FontSet, id: string): { primary: FontLike; chain: FontLike[] } {
  const primary = fonts.get(id) ?? fonts.get(FALLBACK_FONTS[0]) ?? fonts.values().next().value;
  if (!primary) throw new Error(`Font not loaded: ${id}`);
  const chain = [primary, ...FALLBACK_FONTS.map((f) => fonts.get(f)).filter((f): f is FontLike => !!f && f !== primary)];
  return { primary, chain };
}

interface Picked { font: FontLike; glyph: GlyphLike; char: string }

function pick(chain: FontLike[], ch: string): Picked {
  for (const font of chain) {
    const glyph = font.charToGlyph(ch);
    if (glyph.index !== 0 || ch === ' ') return { font, glyph, char: ch };
  }
  const font = chain[0]!;
  return { font, glyph: font.charToGlyph(ch), char: ch };
}

/** Advance widths for a string, without building outlines. */
function advances(chain: FontLike[], text: string, size: number, tracking: number): { picked: Picked[]; adv: number[]; width: number } {
  const picked = Array.from(text).map((ch) => pick(chain, ch));
  const adv: number[] = [];
  let width = 0;
  picked.forEach((p, i) => {
    const scale = size / p.font.unitsPerEm;
    let a = (p.glyph.advanceWidth ?? p.font.unitsPerEm * 0.5) * scale;
    const next = picked[i + 1];
    if (next && next.font === p.font) a += p.font.getKerningValue(p.glyph, next.glyph) * scale;
    if (i < picked.length - 1) a += tracking * size;
    adv.push(a);
    width += a;
  });
  return { picked, adv, width };
}

export function measure(fonts: FontSet, fontId: string, text: string, size: number, tracking = 0): number {
  return advances(resolve(fonts, fontId).chain, text, size, tracking).width;
}

/** Largest size (stepping down by 1px) at which `text` fits `maxWidth`. */
export function fitSize(fonts: FontSet, fontId: string, text: string, maxWidth: number, size: number, min = 10, tracking = 0): number {
  let s = size;
  while (s > min && measure(fonts, fontId, text, s, tracking) > maxWidth) s -= 1;
  return s;
}

/** Greedy word wrap to `maxWidth`, at most `maxLines` (the last line is ellipsised). */
export function wrap(fonts: FontSet, fontId: string, text: string, size: number, maxWidth: number, maxLines = 3): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (!line || measure(fonts, fontId, test, size) <= maxWidth) line = test;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1]!;
    while (last.length > 1 && measure(fonts, fontId, last + '…', size) > maxWidth) last = last.slice(0, -1).trimEnd();
    kept[maxLines - 1] = last + '…';
    return kept;
  }
  return lines;
}

export function capHeight(fonts: FontSet, fontId: string, size: number): number {
  const { primary } = resolve(fonts, fontId);
  const ch = primary.tables.os2?.sCapHeight || primary.ascender * 0.7;
  return (ch / primary.unitsPerEm) * size;
}

export function xHeight(fonts: FontSet, fontId: string, size: number): number {
  const { primary } = resolve(fonts, fontId);
  const xh = primary.tables.os2?.sxHeight || primary.ascender * 0.5;
  return (xh / primary.unitsPerEm) * size;
}

/** Lay out one line of text as outlines. (x, y) is the baseline anchor. */
export function text(fonts: FontSet, fontId: string, str: string, x: number, y: number, size: number, opts: TextOpts = {}): TextRun {
  const { chain } = resolve(fonts, fontId);
  const tracking = opts.tracking ?? 0;
  const dp = opts.dp ?? 1;
  const { picked, adv, width } = advances(chain, str, size, tracking);
  let pen = x;
  if (opts.anchor === 'middle') pen = x - width / 2;
  else if (opts.anchor === 'end') pen = x - width;
  const start = pen;
  const glyphs: PlacedGlyph[] = [];
  const all: PathCommand[] = [];
  picked.forEach((p, i) => {
    const cmds = p.char === ' ' ? [] : p.glyph.getPath(pen, y, size).commands;
    all.push(...cmds);
    glyphs.push({ char: p.char, x: pen, advance: adv[i]!, d: pathData(cmds, dp) });
    pen += adv[i]!;
  });
  return { glyphs, width, d: pathData(all, dp), x: start, y, size };
}
