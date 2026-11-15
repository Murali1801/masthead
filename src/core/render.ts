import type { Config, FontSet, Variant } from './types.ts';
import { Motion, type TrackInfo } from './motion.ts';
import { getTemplate } from './templates/index.ts';
import { esc, type RenderCtx } from './templates/kit.ts';
import { COLOR_ROLES } from './config.ts';

export interface RenderOptions {
  variant: Variant;
  /** Editor mode: paused animations driven by `--t` for the timeline. */
  editor?: boolean;
}

export interface RenderResult {
  svg: string;
  width: number;
  height: number;
  tracks: TrackInfo[];
}

export function size(cfg: Config): { width: number; height: number } {
  const t = getTemplate(cfg.template);
  return { width: t.width, height: t.heightRange ? cfg.height : t.height };
}

/** Render a config to a standalone SVG string. Pure: same input, same bytes. */
export function render(cfg: Config, fonts: FontSet, opts: RenderOptions): RenderResult {
  const t = getTemplate(cfg.template);
  const { width: w, height: h } = size(cfg);
  const m = new Motion({
    duration: cfg.timing.duration,
    mode: cfg.timing.mode,
    editor: !!opts.editor,
    overrides: cfg.timing.tracks,
  });
  const c = Object.fromEntries(COLOR_ROLES.map((role) => [role, cfg.colors[role][opts.variant]])) as RenderCtx['c'];
  const ctx: RenderCtx = {
    cfg,
    variant: opts.variant,
    w,
    h,
    c,
    fonts,
    m,
    s: (k) => {
      const v = cfg.fields[k];
      return typeof v === 'string' ? v : '';
    },
    on: (k) => cfg.fields[k] === true,
  };
  const body = t.render(ctx);
  const alt = esc(cfg.alt.trim());
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" class="mh" role="img" aria-label="${alt}">` +
    `<title>${alt}</title><style>${m.css()}</style>${body}</svg>`;
  return { svg, width: w, height: h, tracks: m.info() };
}
