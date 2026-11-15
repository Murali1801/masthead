import { mix } from '../color.ts';
import { capHeight, fitSize, measure, text } from '../text.ts';
import { FADE, glyphs, list, mark, plate, r, rise, textPath, type TemplateDef } from './kit.ts';

function splitLine(s: string): [string, string] {
  const i = s.indexOf('|');
  return i < 0 ? [s.trim(), ''] : [s.slice(0, i).trim(), s.slice(i + 1).trim()];
}

/** A title beside a receipt that feeds out of a slot. */
export const receipt: TemplateDef = {
  id: 'receipt',
  name: 'Receipt',
  blurb: 'A slip prints your list',
  width: 840,
  height: 220,
  heightRange: [200, 320],
  roles: ['display', 'mono'],
  fields: [
    { key: 'title', label: 'Title', kind: 'text', max: 28 },
    { key: 'subtitle', label: 'Subtitle', kind: 'text', max: 48 },
    { key: 'header', label: 'Receipt header', kind: 'text', max: 24 },
    { key: 'items', label: 'Lines', kind: 'textarea', rows: 4, max: 200, hint: 'One per line: label | value' },
    { key: 'total', label: 'Total line', kind: 'text', max: 32, hint: 'label | value' },
  ],
  defaults: {
    name: 'receipt',
    alt: 'A receipt listing four tools: Tonal, Sheet, Tab and Masthead',
    duration: 6,
    mode: 'once',
    fields: {
      title: 'Open tools',
      subtitle: 'four small things, all MIT',
      header: 'MURALI1801',
      items: 'Tonal | colour\nSheet | UI\nTab | money\nMasthead | README',
      total: 'Total | 4 repos',
    },
    fonts: { display: 'fraunces-600' },
  },
  render(ctx) {
    const { w, h, c, fonts, m, cfg } = ctx;
    const pad = 40;
    const mono = cfg.fonts.mono;
    let out = plate(ctx);

    const slipW = 280;
    const slotX = w - pad - slipW - 40;
    const leftW = slotX - pad - 32;

    const title = ctx.s('title');
    const size = fitSize(fonts, cfg.fonts.display, title, leftW, Math.min(64, h * 0.3), 18);
    const cap = capHeight(fonts, cfg.fonts.display, size);
    const ty = h / 2 + cap / 2 - 8;
    const run = text(fonts, cfg.fonts.display, title, pad, ty, size);
    const tt = m.track({ id: 'title', label: 'Title rises', start: 0, dur: 0.12, stagger: 0.03, frames: rise(size * 0.25) });
    out += `<g fill="${c.ink}">${glyphs(run, tt)}</g>`;
    const sub = ctx.s('subtitle');
    if (sub) {
      const st = m.track({ id: 'subtitle', label: 'Subtitle fades', start: 0.1, dur: 0.1, frames: FADE });
      const ssz = fitSize(fonts, mono, sub, leftW, 14, 9);
      out += textPath(text(fonts, mono, sub, pad, ty + 30, ssz), `${st.attr()} fill="${c.muted}"`);
    }

    // Slot and slip.
    const slotY = 24;
    const sx = slotX + 20;
    const slipH = h - slotY - 14;
    const paper = ctx.variant === 'light' ? mix(c.bg, '#FFFFFF', 0.7) : mix(c.bg, '#FFFFFF', 0.06);
    const teeth = 10;
    let edge = `M${sx} ${slotY}H${sx + slipW}V${slotY + slipH - 6}`;
    for (let x = sx + slipW; x > sx; x -= teeth) edge += `L${r(x - teeth / 2)} ${slotY + slipH}L${r(x - teeth)} ${slotY + slipH - 6}`;
    edge += 'Z';

    const feed = m.track({
      id: 'feed', label: 'Slip feeds out', start: 0.12, dur: 0.36, ease: 'steps(9,end)',
      frames: [{ at: 0, css: `transform:translateY(${-slipH}px)` }, { at: 1, css: 'transform:none' }],
    });
    out += `<defs><clipPath id="m-slot"><rect x="${sx - 10}" y="${slotY}" width="${slipW + 20}" height="${h}"/></clipPath></defs>`;
    out += `<g clip-path="url(#m-slot)"><g${feed.attr()}>`;
    out += `<path d="${edge}" fill="${paper}" stroke="${c.rule}"/>`;

    const isz = 13;
    const icap = capHeight(fonts, mono, isz);
    const innerX = sx + 18, innerW = slipW - 36;
    const header = ctx.s('header');
    let y = slotY + 26;
    out += textPath(text(fonts, mono, header, sx + slipW / 2, y, isz, { anchor: 'middle', tracking: 0.08 }), ` fill="${c.ink}"`);
    y += 12;
    out += `<path d="M${innerX} ${y}h${innerW}" stroke="${c.muted}" stroke-dasharray="3 3"/>`;

    const lines = list(ctx.s('items'), 6);
    const totalTxt = ctx.s('total');
    const room = slotY + slipH - 22 - y - (totalTxt ? 30 : 0);
    const lh = Math.min(20, room / Math.max(1, lines.length));
    const lineTrack = m.track({
      id: 'lines', label: 'Lines print', start: 0.5, dur: 0.02, stagger: 0.22, ease: 'steps(1,end)',
      frames: [{ at: 0, css: 'opacity:0' }, { at: 1, css: 'opacity:1' }],
    });
    const dotW = measure(fonts, mono, '.', isz) || isz * 0.6;
    const row = (label: string, value: string, yy: number) => {
      const lw = measure(fonts, mono, label, isz);
      const vw = measure(fonts, mono, value, isz);
      const dots = Math.max(0, Math.floor((innerW - lw - vw - 12) / dotW));
      return text(fonts, mono, `${label} ${'.'.repeat(dots)}`, innerX, yy, isz).d + text(fonts, mono, value, innerX + innerW, yy, isz, { anchor: 'end' }).d;
    };
    lines.forEach((ln, i) => {
      y += lh;
      const [a, b] = splitLine(ln);
      out += `<path${lineTrack.attr(i)} fill="${c.ink}" d="${row(a, b, y)}"/>`;
    });
    if (totalTxt) {
      y += 12;
      const tot = m.track({ id: 'total', label: 'Total prints', start: 0.78, dur: 0.02, ease: 'steps(1,end)', frames: [{ at: 0, css: 'opacity:0' }, { at: 1, css: 'opacity:1' }] });
      const [a, b] = splitLine(totalTxt);
      out += `<g${tot.attr()}><path d="M${innerX} ${y}h${innerW}" stroke="${c.muted}" stroke-dasharray="3 3"/>`;
      out += mark(ctx, innerX, y + 18 - icap, icap);
      out += `<path fill="${c.ink}" d="${text(fonts, mono, a, innerX + icap + 8, y + 18, isz).d}${text(fonts, mono, b, innerX + innerW, y + 18, isz, { anchor: 'end' }).d}"/></g>`;
    }
    out += `</g></g>`;
    out += `<path d="M${slotX} ${slotY}h${slipW + 40}" stroke="${c.ink}" stroke-width="3" stroke-linecap="round"/>`;
    return out;
  },
};
