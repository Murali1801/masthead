import { LOOP_EXIT } from '../motion.ts';
import { capHeight, text } from '../text.ts';
import { blink, mark, plate, r, SECS, textPath, type TemplateDef } from './kit.ts';

/** A shell session that types itself out, line by line. */
export const terminal: TemplateDef = {
  id: 'terminal',
  name: 'Terminal',
  blurb: 'Log lines type out',
  width: 840,
  height: 220,
  heightRange: [160, 320],
  roles: ['mono'],
  fields: [
    { key: 'label', label: 'Window label', kind: 'text', max: 40 },
    { key: 'lines', label: 'Lines', kind: 'textarea', rows: 6, max: 420, hint: 'Lines starting with $ are typed as commands' },
    { key: 'cursor', label: 'Block cursor', kind: 'toggle' },
  ],
  defaults: {
    name: 'terminal',
    alt: 'A terminal rendering light and dark banners with the Masthead CLI',
    duration: 7,
    mode: 'once',
    fields: {
      label: '~/profile · bash',
      lines: '$ node bin/masthead.mjs banner.json --out assets/\nwrote assets/banner-light.svg\nwrote assets/banner-dark.svg\n$ git commit -am "New banner"',
      cursor: true,
    },
  },
  render(ctx) {
    const { w, h, c, fonts, m, cfg } = ctx;
    const pad = 32;
    const mono = cfg.fonts.mono;
    const D = cfg.timing.duration;
    let out = plate(ctx);

    const barH = 36;
    out += `<path d="M0 ${barH}H${w}" stroke="${c.rule}"/>`;
    out += mark(ctx, pad, barH / 2 - 5, 10);
    out += textPath(text(fonts, mono, ctx.s('label'), pad + 20, barH / 2 + 4, 12), ` fill="${c.muted}"`);

    const size = 15;
    const lh = 24;
    const cap = capHeight(fonts, mono, size);
    const maxLines = Math.max(1, Math.floor((h - barH - 22) / lh));
    const lines = ctx.s('lines').split('\n').map((l) => l.replace(/\s+$/, '')).filter((l) => l.length).slice(0, maxLines);

    // Plan: commands type at 40 ms a char after a 300 ms pause; output lands after 150 ms.
    const plan: Array<{ start: number; dur: number; steps: number }> = [];
    let t = 0.3;
    for (const l of lines) {
      const cmd = l.startsWith('$');
      const pause = cmd ? 0.3 : 0.15;
      const dur = cmd ? Math.max(1, l.length) * 0.04 : 0.02;
      plan.push({ start: t + pause, dur, steps: cmd ? Math.max(1, l.length) : 1 });
      t += pause + dur;
    }
    const end = (cfg.timing.mode === 'loop' ? LOOP_EXIT : 1) * D - 0.4;
    const k = t > end ? end / t : 1;

    let y = barH + 14;
    lines.forEach((l, i) => {
      y += lh;
      const cmd = l.startsWith('$');
      let body = '';
      const x0 = pad;
      let width = 0;
      if (cmd) {
        const p = text(fonts, mono, '$', pad, y, size);
        body += textPath(p, ` fill="${c.accent}"`);
        const rest = l.replace(/^\$\s?/, '');
        const run = text(fonts, mono, rest, pad + size * 1.2, y, size);
        width = size * 1.2 + run.width;
        body += textPath(run, ` fill="${c.ink}"`);
      } else {
        const run = text(fonts, mono, l, pad, y, size);
        width = run.width;
        body += textPath(run, ` fill="${c.muted}"`);
      }
      const pl = plan[i]!;
      const tr = m.track({
        id: `line-${i}`, label: `Line ${i + 1} ${cmd ? 'types' : 'prints'}`,
        start: SECS(ctx, pl.start * k), dur: SECS(ctx, pl.dur * k), origin: 'right',
        ease: `steps(${pl.steps},end)`, rest: 'transform:scaleX(0)',
        frames: [{ at: 0, css: 'transform:none' }, { at: 1, css: 'transform:scaleX(0)' }],
      });
      // A cover in the background colour shrinks to reveal the line.
      out += body + `<rect${tr.attr()} x="${r(x0 - 1)}" y="${r(y - cap - 5)}" width="${r(width + 3)}" height="${r(cap + 10)}" fill="${c.bg}"/>`;
    });

    if (ctx.on('cursor')) {
      const last = lines.length ? plan[lines.length - 1]! : { start: 0, dur: 0 };
      const ny = lines.length < maxLines ? y + lh : y;
      const x = lines.length < maxLines ? pad : pad + 8 + text(fonts, mono, lines[lines.length - 1] ?? '', pad, y, size).width;
      if (lines.length < maxLines) out += textPath(text(fonts, mono, '$', pad, ny, size), ` fill="${c.accent}"`);
      const show = m.track({
        id: 'cursor', label: 'Cursor appears', start: SECS(ctx, (last.start + last.dur) * k + 0.1), dur: 0.01, ease: 'steps(1,end)',
        frames: [{ at: 0, css: 'opacity:0' }, { at: 1, css: 'opacity:1' }],
      });
      const b = blink(m);
      const cx = lines.length < maxLines ? pad + size * 1.2 : x;
      out += `<g${show.attr()}>${mark(ctx, cx, ny - cap, cap, b.attr())}</g>`;
    }
    return out;
  },
};
