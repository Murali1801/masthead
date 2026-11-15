import { capHeight, fitSize, text } from '../text.ts';
import { glyphs, list, mark, plate, r, textPath, type TemplateDef } from './kit.ts';

/** A title over a mono marquee of your projects. */
export const ticker: TemplateDef = {
  id: 'ticker',
  name: 'Ticker',
  blurb: 'Title over a mono marquee',
  width: 840,
  height: 220,
  heightRange: [180, 300],
  roles: ['display', 'mono'],
  fields: [
    { key: 'title', label: 'Title', kind: 'text', max: 40 },
    { key: 'items', label: 'Marquee items', kind: 'textarea', rows: 3, max: 240, hint: 'One per line, or separated by commas' },
    { key: 'subtitle', label: 'Caption', kind: 'text', max: 60 },
    { key: 'label', label: 'Right label', kind: 'text', max: 30 },
  ],
  defaults: {
    name: 'ticker',
    alt: 'Now shipping: Tonal, Sheet, Tab and Masthead',
    duration: 8,
    mode: 'loop',
    fields: {
      title: 'Now shipping',
      items: 'Tonal\nSheet\nTab\nMasthead',
      subtitle: 'small tools, made in the open',
      label: 'github.com/Murali1801',
    },
    fonts: { display: 'bricolage-grotesque-700' },
  },
  render(ctx) {
    const { w, h, c, fonts, m, cfg } = ctx;
    const pad = 40;
    const mono = cfg.fonts.mono;
    let out = plate(ctx);

    const title = ctx.s('title');
    const size = fitSize(fonts, cfg.fonts.display, title, w - 2 * pad, Math.min(64, h * 0.3), 20);
    const cap = capHeight(fonts, cfg.fonts.display, size);
    const ty = 34 + cap;
    const run = text(fonts, cfg.fonts.display, title, pad - size * 0.03, ty, size);
    const tt = m.track({
      id: 'title', label: 'Title slides in', start: 0, dur: 0.1, stagger: 0.03,
      frames: [{ at: 0, css: `opacity:0;transform:translateX(${r(-size * 0.2)}px)` }, { at: 1, css: 'opacity:1;transform:none' }],
    });
    out += `<g fill="${c.ink}">${glyphs(run, tt)}</g>`;

    const bandY = ty + Math.max(18, (h - ty - 100) / 2 + 16);
    const bandH = 46;
    const rules = m.track({
      id: 'band', label: 'Band rules draw', start: 0.06, dur: 0.14, origin: 'left',
      frames: [{ at: 0, css: 'transform:scaleX(0)' }, { at: 1, css: 'transform:none' }],
    });
    out += `<g${rules.attr()} stroke="${c.ink}"><path d="M0 ${r(bandY)}H${w}M0 ${r(bandY + bandH)}H${w}"/></g>`;

    // One strip of items, repeated with <use> so the loop is seamless.
    const items = list(ctx.s('items'), 12);
    const isz = 18;
    const icap = capHeight(fonts, mono, isz);
    const iy = bandY + bandH / 2 + icap / 2;
    const gap = 22;
    const ms = Math.round(icap * 0.75);
    let strip = '';
    let marks = '';
    let x = 0;
    for (const it of items.length ? items : ['Masthead']) {
      const t = text(fonts, mono, it, x, iy, isz);
      strip += t.d;
      x += t.width + gap;
      marks += mark(ctx, x, iy - icap / 2 - ms / 2, ms);
      x += ms + gap;
    }
    const W = Math.max(x, 1);
    const copies = Math.ceil(w / W) + 1;
    const scroll = m.track({
      id: 'marquee', label: 'Marquee scrolls', start: 0, dur: 1,
      frames: [{ at: 0, css: 'transform:none' }, { at: 1, css: `transform:translateX(${r(-W)}px)` }],
      ambient: { period: cfg.timing.duration },
    });
    out += `<defs><clipPath id="m-band"><rect y="${r(bandY + 1)}" width="${w}" height="${bandH - 2}"/></clipPath><g id="m-strip"><path fill="${c.ink}" d="${strip}"/>${marks}</g></defs>`;
    out += `<g clip-path="url(#m-band)"><g${scroll.attr()}>`;
    for (let i = 0; i < copies; i++) out += `<use href="#m-strip" x="${r(i * W + pad)}"/>`;
    out += `</g></g>`;

    const by = h - 26;
    const sub = ctx.s('subtitle');
    const label = ctx.s('label');
    const fade = m.track({ id: 'caption', label: 'Caption fades', start: 0.16, dur: 0.1, frames: [{ at: 0, css: 'opacity:0' }, { at: 1, css: 'opacity:1' }] });
    out += `<g${fade.attr()} fill="${c.muted}">`;
    if (sub) out += textPath(text(fonts, mono, sub, pad, by, 13));
    if (label) out += textPath(text(fonts, mono, label, w - pad, by, 13, { anchor: 'end' }));
    out += `</g>`;
    return out;
  },
};
