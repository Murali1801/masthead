import opentype from 'opentype.js';
import { FONTS, FONT_BY_ID, FALLBACK_FONTS } from '../core/fonts.ts';
import type { FontLike } from '../core/types.ts';

const loaded = new Map<string, FontLike>();
const pending = new Map<string, Promise<FontLike>>();

const base = `${import.meta.env.BASE_URL}fonts/`;

/** Fetch and parse one font from public/fonts (served with the app, never hotlinked). */
export function loadFont(id: string): Promise<FontLike> {
  const hit = loaded.get(id);
  if (hit) return Promise.resolve(hit);
  const wait = pending.get(id);
  if (wait) return wait;
  const meta = FONT_BY_ID.get(id);
  if (!meta) return Promise.reject(new Error(`Unknown font ${id}`));
  const p = fetch(base + meta.file)
    .then((r) => {
      if (!r.ok) throw new Error(`${meta.file}: ${r.status}`);
      return r.arrayBuffer();
    })
    .then((buf) => {
      const f = opentype.parse(buf) as unknown as FontLike;
      loaded.set(id, f);
      pending.delete(id);
      return f;
    });
  pending.set(id, p);
  return p;
}

export async function ensureFonts(ids: string[]): Promise<ReadonlyMap<string, FontLike>> {
  await Promise.all([...new Set([...ids, ...FALLBACK_FONTS])].map(loadFont));
  return loaded;
}

export const fontSet = (): ReadonlyMap<string, FontLike> => loaded;

/** CSS family name for showing a font in the UI (font picker options). */
export const cssFamily = (id: string) => `mh-${id}`;

/** @font-face rules for every curated font. Browsers fetch a face only when it is used. */
export function injectFontFaces(): void {
  const css = FONTS.map(
    (f) => `@font-face{font-family:"${cssFamily(f.id)}";src:url("${base}${f.file}") format("truetype");font-display:swap}`,
  ).join('');
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
}
