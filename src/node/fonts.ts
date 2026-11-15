import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import opentype from 'opentype.js';
import { FONTS } from '../core/fonts.ts';
import type { FontLike } from '../core/types.ts';

/** Load every curated font from public/fonts (CLI and tests). */
export function loadFonts(dir: string): Map<string, FontLike> {
  const map = new Map<string, FontLike>();
  for (const f of FONTS) {
    const buf = readFileSync(join(dir, f.file));
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    map.set(f.id, opentype.parse(ab) as unknown as FontLike);
  }
  return map;
}
