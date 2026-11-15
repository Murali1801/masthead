import type { PathCommand } from './types.ts';

/** Shortest decimal form: 0.5 -> ".5", -0.5 -> "-.5". */
export function num(n: number): string {
  const s = String(n === 0 ? 0 : n);
  if (s.startsWith('0.')) return s.slice(1);
  if (s.startsWith('-0.')) return '-' + s.slice(2);
  return s;
}

/** Round to `dp` decimals and print compactly. */
export function r(n: number, dp = 1): string {
  const f = 10 ** dp;
  return num(Math.round(n * f) / f);
}

/** Join numbers, skipping the separator before a minus sign. */
function join(parts: string[]): string {
  let out = '';
  for (const p of parts) {
    if (out === '' || p.startsWith('-')) out += p;
    else out += ' ' + p;
  }
  return out;
}

/**
 * Serialise absolute glyph commands to compact relative path data.
 * Coordinates are rounded once in absolute space and then differenced as
 * integers, so rounding never drifts across a long outline.
 */
export function pathData(cmds: readonly PathCommand[], dp = 1): string {
  const f = 10 ** dp;
  const q = (v: number | undefined) => Math.round((v ?? 0) * f);
  const out = (n: number) => num(n / f);
  let cx = 0, cy = 0, sx = 0, sy = 0;
  let d = '';
  for (const c of cmds) {
    switch (c.type) {
      case 'M': {
        const x = q(c.x), y = q(c.y);
        // The first move is absolute so separate runs can be concatenated safely.
        d += d === '' ? 'M' + join([out(x), out(y)]) : 'm' + join([out(x - cx), out(y - cy)]);
        cx = sx = x; cy = sy = y;
        break;
      }
      case 'L': {
        const x = q(c.x), y = q(c.y);
        if (x === cx && y === cy) break;
        if (y === cy) d += 'h' + out(x - cx);
        else if (x === cx) d += 'v' + out(y - cy);
        else d += 'l' + join([out(x - cx), out(y - cy)]);
        cx = x; cy = y;
        break;
      }
      case 'Q': {
        const x1 = q(c.x1), y1 = q(c.y1), x = q(c.x), y = q(c.y);
        d += 'q' + join([out(x1 - cx), out(y1 - cy), out(x - cx), out(y - cy)]);
        cx = x; cy = y;
        break;
      }
      case 'C': {
        const x1 = q(c.x1), y1 = q(c.y1), x2 = q(c.x2), y2 = q(c.y2), x = q(c.x), y = q(c.y);
        d += 'c' + join([out(x1 - cx), out(y1 - cy), out(x2 - cx), out(y2 - cy), out(x - cx), out(y - cy)]);
        cx = x; cy = y;
        break;
      }
      case 'Z':
        d += 'z';
        cx = sx; cy = sy;
        break;
    }
  }
  return d;
}
