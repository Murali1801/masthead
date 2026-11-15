import { capHeight, fitSize, text } from '../text.ts';
import { DRAW, FADE, glyphs, mark, plate, r, textPath, type TemplateDef } from './kit.ts';

function curve(kind: string, x0: number, x1: number, y: number, amp: number): { d: string; end: [number, number] } {
  const pts: Array<[number, number]> = [];
  if (kind === 'orbit') {
    const cx = (x0 + x1) / 2, rx = (x1 - x0) / 2;
    for (let i = 0; i <= 160; i++) {
      const t = (i / 160) * Math.PI * 2;
      pts.push([cx + rx * Math.sin(3 * t), y + amp * Math.sin(2 * t + Math.PI / 4)]);
    }
  } else {
    const n = 120;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pts.push([x0 + t * (x1 - x0), y + amp * Math.sin(t * Math.PI * 5) * (0.35 + 0.65 * t)]);
    }
  }
  const d = 'M' + pts.map(([x, yy]) => `${r(x)} ${r(yy)}`).join('L');
  return { d, end: pts[pts.length - 1]! };
}

/** Pen-plotter look: outlines draw in a single stroke, then a hatch fill, then a plotted curve. */
export const plotter: TemplateDef = {
  id: 'plotter',
  name: 'Plotter',
  blurb: 'Single-stroke draw and hatch',
  width: 840,
  height: 220,
  heightRange: [180, 320],
  roles: ['display', 'mono'],
  fields: [
    { key: 'title', label: 'Title', kind: 'text', max: 32 },
    { key: 'subtitle', label: 'Mono line', kind: 'text', max: 60 },
    {
      key: 'fill', label: 'Fill', kind: 'select',
      options: [{ value: 'hatch', label: 'Hatch' }, { value: 'solid', label: 'Solid' }, { value: 'none', label: 'Outline only' }],
    },
    {
      key: 'curve', label: 'Plotted curve', kind: 'select',
      options: [{ value: 'wave', label: 'Wave' }, { value: 'orbit', label: 'Orbit' }, { value: 'none', label: 'None' }],
    },
  ],
  defaults: {
    name: 'plotter',
    alt: 'The word Masthead drawn by a pen plotter',
    duration: 7,
    mode: 'once',
    fields: { title: 'Masthead', subtitle: 'plotted in one stroke, then hatched', fill: 'hatch', curve: 'wave' },
    fonts: { display: 'instrument-serif-400-italic' },
  },
  render(ctx) {
    const { w, h, c, fonts, m, cfg } = ctx;
    const pad = 40;
    const mono = cfg.fonts.mono;
    let out = plate(ctx);
    const kind = ctx.s('curve');
    const textW = kind === 'orbit' ? w * 0.62 : w - 2 * pad;

    const title = ctx.s('title');
    const size = fitSize(fonts, cfg.fonts.display, title, textW - pad, Math.min(120, h * 0.55), 20);
    const cap = capHeight(fonts, cfg.fonts.display, size);
    const by = h * 0.5 + cap / 2 - 4;
    const run = text(fonts, cfg.fonts.display, title, pad, by, size);
    const draw = m.track({ id: 'outline', label: 'Pen draws outline', start: 0.04, dur: 0.3, stagger: 0.08, ease: 'linear', frames: DRAW });
    out += `<g fill="none" stroke="${c.ink}" stroke-width="1.2" stroke-linejoin="round" stroke-dasharray="1">${glyphs(run, draw, ' pathLength="1"')}</g>`;

    const fillKind = ctx.s('fill');
    if (fillKind !== 'none') {
      const ft = m.track({ id: 'fill', label: fillKind === 'hatch' ? 'Hatch fills' : 'Fill lands', start: 0.5, dur: 0.16, frames: FADE });
      if (fillKind === 'hatch') {
        out += `<defs><pattern id="m-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V5" stroke="${c.ink}" stroke-width="1.4"/></pattern></defs>`;
        out += textPath(run, `${ft.attr()} fill="url(#m-hatch)"`);
      } else {
        out += textPath(run, `${ft.attr()} fill="${c.ink}"`);
      }
    }

    if (kind !== 'none') {
      const cv = kind === 'orbit' ? curve('orbit', w * 0.66, w - pad, h / 2, h * 0.3) : curve('wave', pad, w - pad, h - 36, 9);
      const ct = m.track({ id: 'curve', label: 'Curve plots', start: 0.3, dur: 0.34, ease: 'linear', frames: DRAW });
      out += `<path${ct.attr()} pathLength="1" stroke-dasharray="1" fill="none" stroke="${c.accent}" stroke-width="1.5" d="${cv.d}"/>`;
      const mt = m.track({ id: 'pen', label: 'Pen lifts', start: 0.64, dur: 0.04, frames: FADE });
      out += mark(ctx, cv.end[0] - 5, cv.end[1] - 5, 10, mt.attr());
    }

    const sub = ctx.s('subtitle');
    if (sub) {
      const st = m.track({ id: 'subtitle', label: 'Mono line fades', start: 0.6, dur: 0.1, frames: FADE });
      out += textPath(text(fonts, mono, sub, pad, kind === 'wave' ? 30 : h - 24, 12), `${st.attr()} fill="${c.muted}"`);
    }
    return out;
  },
};
