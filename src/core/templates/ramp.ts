import { isHex, onColor, ramp as makeRamp } from '../color.ts';
import { capHeight, fitSize, text } from '../text.ts';
import { FADE, glyphs, plate, r, rise, textPath, type TemplateDef } from './kit.ts';

function stepName(i: number, n: number): string {
  if (n === 11) return String([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950][i]);
  return String(Math.round((100 + (i * 800) / (n - 1)) / 50) * 50);
}

/** Colour steps grow in under a title: an even-lightness OKLCH ramp of one hue. */
export const rampTpl: TemplateDef = {
  id: 'ramp',
  name: 'Ramp',
  blurb: 'Colour steps of one hue',
  width: 840,
  height: 220,
  heightRange: [200, 320],
  roles: ['display', 'mono'],
  fields: [
    { key: 'title', label: 'Title', kind: 'text', max: 36 },
    { key: 'subtitle', label: 'Subtitle', kind: 'text', max: 60 },
    { key: 'base', label: 'Ramp base colour', kind: 'color' },
    {
      key: 'steps', label: 'Steps', kind: 'select',
      options: ['5', '7', '9', '11'].map((v) => ({ value: v, label: `${v} steps` })),
    },
    { key: 'hex', label: 'Show hex values', kind: 'toggle' },
  ],
  defaults: {
    name: 'ramp',
    alt: 'A nine-step cobalt colour ramp under the title Cobalt',
    duration: 5,
    mode: 'once',
    fields: { title: 'Cobalt', subtitle: 'nine steps, even OKLCH lightness', base: '#2747D9', steps: '9', hex: true },
    fonts: { display: 'instrument-sans-600' },
  },
  render(ctx) {
    const { w, h, c, fonts, m, cfg } = ctx;
    const pad = 40;
    const mono = cfg.fonts.mono;
    let out = plate(ctx);

    const title = ctx.s('title');
    const size = fitSize(fonts, cfg.fonts.display, title, w - 2 * pad, Math.min(52, h * 0.24), 18);
    const cap = capHeight(fonts, cfg.fonts.display, size);
    const ty = 34 + cap;
    const tt = m.track({ id: 'title', label: 'Title rises', start: 0, dur: 0.12, stagger: 0.03, frames: rise(size * 0.25) });
    out += `<g fill="${c.ink}">${glyphs(text(fonts, cfg.fonts.display, title, pad - size * 0.03, ty, size), tt)}</g>`;
    const sub = ctx.s('subtitle');
    const sy = ty + 26;
    if (sub) {
      const st = m.track({ id: 'subtitle', label: 'Subtitle fades', start: 0.08, dur: 0.1, frames: FADE });
      out += textPath(text(fonts, mono, sub, pad, sy, 13), `${st.attr()} fill="${c.muted}"`);
    }

    const n = Math.min(11, Math.max(3, parseInt(ctx.s('steps'), 10) || 9));
    const base = isHex(ctx.s('base')) ? ctx.s('base') : c.accent;
    const colors = makeRamp(base, n);
    const top = sy + 20, bottom = h - 34;
    const sw = (w - 2 * pad) / n;
    const grow = m.track({
      id: 'steps', label: 'Steps grow', start: 0.14, dur: 0.14, stagger: 0.07, origin: '50% 100%',
      frames: [{ at: 0, css: 'transform:scaleY(0)' }, { at: 1, css: 'transform:none' }],
    });
    const lbl = m.track({ id: 'labels', label: 'Labels fade', start: 0.3, dur: 0.06, stagger: 0.07, frames: FADE });
    colors.forEach((col, i) => {
      const x = pad + i * sw;
      out += `<rect${grow.attr(i)} x="${r(x)}" y="${r(top)}" width="${r(sw + 0.5)}" height="${r(bottom - top)}" fill="${col}"/>`;
      let l = textPath(text(fonts, mono, stepName(i, n), x, h - 16, 11), ` fill="${c.muted}"`);
      if (ctx.on('hex') && sw >= 60) l += textPath(text(fonts, mono, col.toLowerCase(), x + 8, bottom - 9, 10), ` fill="${onColor(col)}"`);
      out += `<g${lbl.attr(i)}>${l}</g>`;
    });
    return out;
  },
};
