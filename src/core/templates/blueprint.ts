import { capHeight, fitSize, text } from '../text.ts';
import { DRAW, FADE, glyphs, plate, r, textPath, type TemplateDef } from './kit.ts';

/** Drafting grid draws in, the name is outlined, then filled; a title block in the corner. */
export const blueprint: TemplateDef = {
  id: 'blueprint',
  name: 'Blueprint',
  blurb: 'Grid draws, outline, then fill',
  width: 840,
  height: 220,
  heightRange: [180, 320],
  roles: ['display', 'mono'],
  fields: [
    { key: 'title', label: 'Title', kind: 'text', max: 32 },
    { key: 'subtitle', label: 'Title block, line 1', kind: 'text', max: 28 },
    { key: 'label', label: 'Title block, line 2', kind: 'text', max: 28 },
    { key: 'dims', label: 'Dimension line', kind: 'toggle' },
  ],
  defaults: {
    name: 'blueprint',
    alt: 'Masthead drawn as a blueprint',
    duration: 6,
    mode: 'once',
    fields: { title: 'Masthead', subtitle: 'SVG banner editor', label: 'Murali1801 · sheet 01', dims: true },
    fonts: { display: 'unbounded-600' },
  },
  render(ctx) {
    const { w, h, c, fonts, m, cfg } = ctx;
    const pad = 40;
    const mono = cfg.fonts.mono;
    let out = plate(ctx);

    // Minor grid as one path, faded in. Major lines drawn.
    let minor = '';
    for (let x = 20; x < w; x += 20) if (x % 100) minor += `M${x} 0V${h}`;
    for (let y = 20; y < h; y += 20) if (y % 100) minor += `M0 ${y}H${w}`;
    const fg = m.track({ id: 'grid', label: 'Grid fades in', start: 0, dur: 0.12, frames: FADE });
    out += `<path${fg.attr()} stroke="${c.accent}" stroke-opacity=".12" d="${minor}"/>`;
    const major = m.track({ id: 'major', label: 'Major lines draw', start: 0.04, dur: 0.16, stagger: 0.05, frames: DRAW });
    out += `<g stroke="${c.accent}" stroke-opacity=".35" stroke-dasharray="1" fill="none">`;
    for (let x = 100; x < w; x += 100) out += `<path${major.attr()} pathLength="1" d="M${x} 0V${h}"/>`;
    for (let y = 100; y < h; y += 100) out += `<path${major.attr()} pathLength="1" d="M0 ${y}H${w}"/>`;
    out += `</g>`;

    const title = ctx.s('title');
    const size = fitSize(fonts, cfg.fonts.display, title, w - 2 * pad - 20, Math.min(92, h * 0.42), 20);
    const cap = capHeight(fonts, cfg.fonts.display, size);
    const by = h * 0.5 + cap / 2 - 6;
    const run = text(fonts, cfg.fonts.display, title, pad, by, size);
    const outline = m.track({ id: 'outline', label: 'Outline draws', start: 0.14, dur: 0.26, stagger: 0.06, frames: DRAW });
    out += `<g fill="none" stroke="${c.accent}" stroke-width="1.25" stroke-dasharray="1">${glyphs(run, outline, ' pathLength="1"')}</g>`;
    const fill = m.track({ id: 'fill', label: 'Fill lands', start: 0.55, dur: 0.14, frames: FADE });
    out += textPath(run, `${fill.attr()} fill="${c.ink}"`);

    if (ctx.on('dims')) {
      const y = by - cap - 18;
      const x1 = run.x, x2 = run.x + run.width;
      const dl = m.track({ id: 'dims', label: 'Dimension draws', start: 0.42, dur: 0.14, frames: DRAW });
      out += `<path${dl.attr()} pathLength="1" stroke-dasharray="1" stroke="${c.accent}" fill="none" d="M${r(x1)} ${r(y - 5)}v10M${r(x1)} ${r(y)}H${r(x2)}M${r(x2)} ${r(y - 5)}v10"/>`;
      const lbl = text(fonts, mono, `${Math.round(run.width)} px`, (x1 + x2) / 2, y - 7, 11, { anchor: 'middle' });
      const lt = m.track({ id: 'dims-label', label: 'Dimension label', start: 0.52, dur: 0.06, frames: FADE });
      out += `<g${lt.attr()}><rect x="${r(lbl.x - 6)}" y="${r(y - 20)}" width="${r(lbl.width + 12)}" height="16" fill="${c.bg}"/>${textPath(lbl, ` fill="${c.accent}"`)}</g>`;
    }

    // Title block, bottom right.
    const bw = 232, bh = 46;
    const bx = w - pad - bw + 20, byy = h - bh - 16;
    const blk = m.track({ id: 'block', label: 'Title block', start: 0.62, dur: 0.12, frames: FADE });
    out += `<g${blk.attr()}><rect x="${bx}" y="${byy}" width="${bw}" height="${bh}" fill="${c.bg}" stroke="${c.accent}"/><path stroke="${c.accent}" d="M${bx} ${byy + bh / 2}h${bw}"/>`;
    out += textPath(text(fonts, mono, ctx.s('subtitle').toUpperCase(), bx + 10, byy + 16, 11, { tracking: 0.04 }), ` fill="${c.ink}"`);
    out += textPath(text(fonts, mono, ctx.s('label'), bx + 10, byy + bh / 2 + 16, 11), ` fill="${c.muted}"`);
    out += `</g>`;
    return out;
  },
};
