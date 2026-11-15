import { capHeight, fitSize, text } from '../text.ts';
import { fontLabel } from '../fonts.ts';
import { DRAW, blink, glyphs, mark, plate, r, rise, SECS, textPath, type TemplateDef } from './kit.ts';

/** Big name set like a type specimen, a mono line that types out, a hairline grid. */
export const specimen: TemplateDef = {
  id: 'specimen',
  name: 'Specimen',
  blurb: 'Big name, mono line, 12-column grid',
  width: 840,
  height: 220,
  heightRange: [180, 320],
  roles: ['display', 'mono'],
  fields: [
    { key: 'title', label: 'Title', kind: 'text', max: 40 },
    { key: 'subtitle', label: 'Mono line', kind: 'text', max: 64 },
    { key: 'label', label: 'Corner label', kind: 'text', max: 40 },
    { key: 'credit', label: 'Show font name', kind: 'toggle' },
    { key: 'grid', label: 'Hairline grid', kind: 'toggle' },
    { key: 'cursor', label: 'Block cursor', kind: 'toggle' },
  ],
  defaults: {
    name: 'masthead',
    alt: 'Masthead: animated SVG banners for your README',
    duration: 6,
    mode: 'once',
    fields: {
      title: 'Masthead',
      subtitle: 'animated SVG banners for your README',
      label: 'github.com/Murali1801/masthead',
      credit: true,
      grid: true,
      cursor: true,
    },
  },
  render(ctx) {
    const { w, h, c, fonts, m, cfg } = ctx;
    const pad = 40;
    const top = 56, bottom = h - 64;
    let out = plate(ctx);

    if (ctx.on('grid')) {
      const g = m.track({ id: 'grid', label: 'Grid draws', start: 0, dur: 0.18, stagger: 0.035, frames: DRAW });
      out += `<g stroke="${c.rule}" fill="none" stroke-dasharray="1">`;
      for (let i = 0; i <= 12; i++) {
        const x = pad + (i * (w - 2 * pad)) / 12;
        out += `<path${g.attr()} pathLength="1" d="M${r(x)} 20V${h - 20}"/>`;
      }
      out += `<path${g.attr()} pathLength="1" d="M20 ${top}H${w - 20}"/><path${g.attr()} pathLength="1" d="M20 ${bottom}H${w - 20}"/></g>`;
    }

    const mono = cfg.fonts.mono;
    const label = ctx.s('label');
    if (label) out += textPath(text(fonts, mono, label, pad, 40, 12), ` fill="${c.muted}"`);
    if (ctx.on('credit')) out += textPath(text(fonts, mono, fontLabel(cfg.fonts.display), w - pad, 40, 12, { anchor: 'end' }), ` fill="${c.muted}"`);

    const title = ctx.s('title');
    const size = fitSize(fonts, cfg.fonts.display, title, w - 2 * pad, Math.min(104, (bottom - top) * 0.95), 24, -0.01);
    const cap = capHeight(fonts, cfg.fonts.display, size);
    const run = text(fonts, cfg.fonts.display, title, pad - size * 0.04, (top + bottom) / 2 + cap / 2, size, { tracking: -0.01 });
    const t = m.track({ id: 'title', label: 'Title rises', start: 0.1, dur: 0.14, stagger: 0.035, frames: rise(size * 0.3) });
    out += `<g fill="${c.ink}">${glyphs(run, t)}</g>`;

    const sub = ctx.s('subtitle');
    const subSize = 18;
    const subY = h - 30;
    const subRun = text(fonts, mono, sub, pad, subY, subSize);
    const step = 0.045;
    const typed = m.track({
      id: 'type', label: 'Mono line types', start: 0.4, dur: SECS(ctx, 0.01), stagger: step,
      frames: [{ at: 0, css: 'opacity:0' }, { at: 1, css: 'opacity:1' }], ease: 'steps(1,end)',
    });
    out += `<g fill="${c.ink}">${glyphs(subRun, typed, '', true)}</g>`;

    if (ctx.on('cursor')) {
      const ch = capHeight(fonts, mono, subSize);
      const visible = subRun.glyphs.length;
      const startAt = m.resolved('type').start;
      const move = m.track({
        id: 'caret', label: 'Caret', hidden: true, start: startAt, dur: Math.max(0.01, SECS(ctx, visible * step)),
        frames: [{ at: 0, css: `transform:translateX(${r(-subRun.width - 6)}px)` }, { at: 1, css: 'transform:none' }],
        ease: `steps(${Math.max(1, visible)},end)`,
      });
      const b = blink(m);
      out += `<g${move.attr(0)}>${mark(ctx, subRun.x + subRun.width + 6, subY - ch, ch, b.attr(0))}</g>`;
    }
    return out;
  },
};
