import { hexToOklch, mix, oklchToHex, ramp } from '../color.ts';
import type { Motion } from '../motion.ts';
import { capHeight, fitSize, text, wrap, xHeight } from '../text.ts';
import { blink, DRAW, mark, plate, r, textPath, type RenderCtx, type TemplateDef } from './kit.ts';

interface Box { x: number; y: number; w: number; h: number }

/** Tonal: steps start at uneven lightness and settle into an even ramp. */
function illRamp(ctx: RenderCtx, m: Motion, b: Box): string {
  const n = 6;
  const even = ramp(ctx.c.accent, n);
  const jitter = [0.09, -0.07, 0.11, -0.1, 0.06, -0.05];
  const [, C, H] = hexToOklch(ctx.c.accent);
  const settle = m.track({ id: 'settle', label: 'Steps settle', start: 0.1, dur: 0.3, frames: [{ at: 0, css: '' }, { at: 1, css: '' }] });
  const { start, dur } = m.resolved('settle');
  const bh = (b.h - 24) / n;
  let out = '';
  even.forEach((col, i) => {
    const L = 0.96 - (i / (n - 1)) * 0.68 + jitter[i]!;
    const off = oklchToHex(Math.min(0.98, Math.max(0.1, L)), C * 0.8, H);
    const t = m.track({
      id: `settle-${i}`, label: '', hidden: true, start: start + i * 0.02, dur,
      frames: [{ at: 0, css: `fill:${off};transform:translateX(${r(jitter[i]! * 120)}px)` }, { at: 1, css: `fill:${col};transform:none` }],
    });
    out += `<rect${t.attr()} x="${r(b.x + 8)}" y="${r(b.y + 12 + i * bh)}" width="${r(b.w - 16)}" height="${r(bh + 0.5)}" fill="${col}"/>`;
  });
  out += `<g${settle.attr()} fill="none" stroke="${ctx.c.rule}"><rect x="${r(b.x + 8)}" y="${r(b.y + 12)}" width="${r(b.w - 16)}" height="${r(b.h - 24)}"/></g>`;
  return out;
}

/** Sheet: a card springs up to a detent inside a phone outline. */
function illSheet(ctx: RenderCtx, m: Motion, b: Box): string {
  const { c } = ctx;
  const pw = Math.min(b.w * 0.72, 96), ph = b.h - 8;
  const px = b.x + (b.w - pw) / 2, py = b.y + 4;
  const paper = ctx.variant === 'light' ? mix(c.bg, '#FFFFFF', 0.75) : mix(c.bg, '#FFFFFF', 0.08);
  const detent = py + ph * 0.42;
  const sh = py + ph - detent;
  const spring = m.track({
    id: 'spring', label: 'Sheet springs up', start: 0.12, dur: 0.24,
    frames: [
      { at: 0, css: `transform:translateY(${r(sh + 4)}px)` },
      { at: 0.55, css: 'transform:translateY(-9px)' },
      { at: 0.8, css: 'transform:translateY(3px)' },
      { at: 1, css: 'transform:none' },
    ],
  });
  let out = `<defs><clipPath id="m-phone"><rect x="${r(px)}" y="${r(py)}" width="${r(pw)}" height="${r(ph)}" rx="14"/></clipPath></defs>`;
  out += `<g clip-path="url(#m-phone)"><rect x="${r(px)}" y="${r(py)}" width="${r(pw)}" height="${r(ph)}" fill="${mix(c.bg, c.ink, 0.04)}"/>`;
  for (let i = 0; i < 3; i++) out += `<rect x="${r(px + 12)}" y="${r(py + 18 + i * 12)}" width="${r((pw - 24) * (i === 1 ? 0.6 : 0.85))}" height="5" rx="2.5" fill="${c.rule}"/>`;
  out += `<g${spring.attr()}><rect x="${r(px)}" y="${r(detent)}" width="${r(pw)}" height="${r(sh + 20)}" rx="12" fill="${paper}" stroke="${c.rule}"/>`;
  out += `<rect x="${r(px + pw / 2 - 12)}" y="${r(detent + 7)}" width="24" height="4" rx="2" fill="${c.muted}"/>`;
  out += mark(ctx, px + 12, detent + 22, 9);
  out += `<rect x="${r(px + 27)}" y="${r(detent + 24)}" width="${r(pw - 40)}" height="5" rx="2.5" fill="${c.ink}"/>`;
  out += `<rect x="${r(px + 12)}" y="${r(detent + 40)}" width="${r(pw - 24)}" height="18" rx="9" fill="${c.accent}"/></g></g>`;
  out += `<rect x="${r(px)}" y="${r(py)}" width="${r(pw)}" height="${r(ph)}" rx="14" fill="none" stroke="${c.ink}" stroke-width="1.5"/>`;
  return out;
}

/** Tab: a receipt prints three lines and a total. */
function illReceipt(ctx: RenderCtx, m: Motion, b: Box): string {
  const { c } = ctx;
  const sw = b.w * 0.7, sx = b.x + (b.w - sw) / 2, sy = b.y + 14;
  const sh = b.h - 26;
  const paper = ctx.variant === 'light' ? mix(c.bg, '#FFFFFF', 0.75) : mix(c.bg, '#FFFFFF', 0.08);
  let edge = `M${r(sx)} ${r(sy)}H${r(sx + sw)}V${r(sy + sh - 5)}`;
  const teeth = sw / 8;
  for (let i = 8; i > 0; i--) edge += `L${r(sx + (i - 0.5) * teeth)} ${r(sy + sh)}L${r(sx + (i - 1) * teeth)} ${r(sy + sh - 5)}`;
  const feed = m.track({
    id: 'feed', label: 'Receipt feeds', start: 0.08, dur: 0.36, ease: 'steps(4,end)',
    frames: [{ at: 0, css: `transform:translateY(${r(-sh)}px)` }, { at: 1, css: 'transform:none' }],
  });
  const line = m.track({
    id: 'lines', label: 'Lines print', start: 0.16, dur: 0.01, stagger: ctx.cfg.timing.duration * 0.09, ease: 'steps(1,end)',
    frames: [{ at: 0, css: 'opacity:0' }, { at: 1, css: 'opacity:1' }],
  });
  let out = `<defs><clipPath id="m-slot"><rect x="${r(b.x)}" y="${r(sy)}" width="${r(b.w)}" height="${r(b.h)}"/></clipPath></defs>`;
  out += `<g clip-path="url(#m-slot)"><g${feed.attr()}><path d="${edge}Z" fill="${paper}" stroke="${c.rule}"/>`;
  const iw = sw - 24;
  [0.7, 0.5, 0.62].forEach((f, i) => {
    const y = sy + 22 + i * 18;
    out += `<g${line.attr(i)}><rect x="${r(sx + 12)}" y="${r(y)}" width="${r(iw * f * 0.6)}" height="5" rx="2.5" fill="${c.muted}"/><rect x="${r(sx + 12 + iw - 22)}" y="${r(y)}" width="22" height="5" rx="2.5" fill="${c.ink}"/></g>`;
  });
  const ty = sy + 22 + 3 * 18 + 4;
  out += `<g${line.attr(3)}><path d="M${r(sx + 12)} ${r(ty)}h${r(iw)}" stroke="${c.muted}" stroke-dasharray="3 3"/>`;
  out += mark(ctx, sx + 12, ty + 9, 9);
  out += `<rect x="${r(sx + 12 + iw - 30)}" y="${r(ty + 11)}" width="30" height="6" rx="3" fill="${c.accent}"/></g></g></g>`;
  out += `<path d="M${r(b.x + 4)} ${r(sy)}h${r(b.w - 8)}" stroke="${c.ink}" stroke-width="3" stroke-linecap="round"/>`;
  return out;
}

/** Masthead: a pen plots the letter M on a dot grid. */
function illPlotter(ctx: RenderCtx, m: Motion, b: Box): string {
  const { c } = ctx;
  let dots = '';
  for (let x = b.x + 12; x <= b.x + b.w - 8; x += 12) for (let y = b.y + 12; y <= b.y + b.h - 8; y += 12) dots += `M${r(x)} ${r(y)}h.01`;
  let out = `<path d="${dots}" stroke="${c.rule}" stroke-width="2" stroke-linecap="round"/>`;
  const l = b.x + 22, rr = b.x + b.w - 22, t = b.y + 30, bt = b.y + b.h - 30;
  const pts: Array<[number, number]> = [[l, bt], [l, t], [(l + rr) / 2, b.y + b.h * 0.58], [rr, t], [rr, bt]];
  const d = 'M' + pts.map(([x, y]) => `${r(x)} ${r(y)}`).join('L');
  const plot = m.track({ id: 'plot', label: 'Pen plots M', start: 0.08, dur: 0.42, ease: 'linear', frames: DRAW });
  out += `<path${plot.attr()} pathLength="1" stroke-dasharray="1" d="${d}" fill="none" stroke="${c.ink}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`;
  // Pen follows the vertices at the same linear pace.
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i]![0], p[1] - pts[i]![1]));
  const total = seg.reduce((a, s) => a + s, 0);
  const end = pts[pts.length - 1]!;
  let acc = 0;
  const frames = pts.map((p, i) => {
    if (i > 0) acc += seg[i - 1]!;
    return { at: acc / total, css: `transform:translate(${r(p[0] - end[0])}px,${r(p[1] - end[1])}px)` };
  });
  frames[frames.length - 1] = { at: 1, css: 'transform:none' };
  const { start, dur } = m.resolved('plot');
  const pen = m.track({ id: 'pen', label: '', hidden: true, start, dur, ease: 'linear', frames });
  out += `<g${pen.attr()}>${mark(ctx, end[0] - 6, end[1] - 6, 12)}</g>`;
  return out;
}

function illMark(ctx: RenderCtx, m: Motion, b: Box): string {
  const s = 36;
  const b1 = blink(m);
  return `<path d="M${r(b.x + 8)} ${r(b.y + b.h / 2 + s / 2 + 8)}h${r(b.w - 16)}" stroke="${ctx.c.rule}"/>` + mark(ctx, b.x + (b.w - s) / 2, b.y + (b.h - s) / 2, s, b1.attr());
}

const ILLUSTRATIONS: Record<string, (ctx: RenderCtx, m: Motion, b: Box) => string> = {
  ramp: illRamp,
  sheet: illSheet,
  receipt: illReceipt,
  plotter: illPlotter,
  mark: illMark,
};

/** A 410 by 200 project card: name, one line, stack, small looping illustration. */
export const card: TemplateDef = {
  id: 'card',
  name: 'Project card',
  blurb: 'Name, one line, stack, loop',
  width: 410,
  height: 200,
  roles: ['display', 'text', 'mono'],
  fields: [
    { key: 'title', label: 'Project name', kind: 'text', max: 22 },
    { key: 'line', label: 'One line', kind: 'textarea', rows: 2, max: 90 },
    { key: 'stack', label: 'Stack', kind: 'text', max: 48 },
    {
      key: 'illustration', label: 'Illustration', kind: 'select',
      options: [
        { value: 'ramp', label: 'Ramp settles' },
        { value: 'sheet', label: 'Sheet springs' },
        { value: 'receipt', label: 'Receipt prints' },
        { value: 'plotter', label: 'Pen plots' },
        { value: 'mark', label: 'Blinking mark' },
        { value: 'none', label: 'None' },
      ],
    },
  ],
  defaults: {
    name: 'card',
    alt: 'Masthead: animated SVG banners for your README. No server.',
    duration: 6,
    mode: 'loop',
    fields: {
      title: 'Masthead',
      line: 'Animated SVG banners for your README. No server.',
      stack: 'TypeScript · opentype.js · SVG',
      illustration: 'plotter',
    },
  },
  render(ctx) {
    const { w, h, c, fonts, m, cfg } = ctx;
    const pad = 24;
    const colW = 222;
    let out = plate(ctx, true);

    const title = ctx.s('title');
    const size = fitSize(fonts, cfg.fonts.display, title, colW - 22, 30, 16);
    const cap = capHeight(fonts, cfg.fonts.display, size);
    const ty = 28 + cap;
    const ms = Math.round(xHeight(fonts, cfg.fonts.display, size));
    out += mark(ctx, pad, ty - ms, ms);
    out += textPath(text(fonts, cfg.fonts.display, title, pad + ms + 8, ty, size), ` fill="${c.ink}"`);

    const lines = wrap(fonts, cfg.fonts.text, ctx.s('line'), 15, colW, 3);
    lines.forEach((ln, i) => {
      out += textPath(text(fonts, cfg.fonts.text, ln, pad, ty + 32 + i * 21, 15), ` fill="${c.ink}"`);
    });

    const stack = ctx.s('stack');
    if (stack) {
      const ss = fitSize(fonts, cfg.fonts.mono, stack, colW, 11, 8);
      out += textPath(text(fonts, cfg.fonts.mono, stack, pad, h - 24, ss), ` fill="${c.muted}"`);
    }

    const ill = ILLUSTRATIONS[ctx.s('illustration')];
    if (ill) {
      const box: Box = { x: pad + colW + 16, y: 16, w: w - (pad + colW + 16) - 16, h: h - 32 };
      out += ill(ctx, m, box);
    }
    return out;
  },
};
