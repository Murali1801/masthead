import type { Config } from './types.ts';
import { contrast, luminance } from './color.ts';
import { MAX_DURATION } from './config.ts';

export const SIZE_BUDGET = 50 * 1024;

export interface Check {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

export const bytes = (s: string) => new TextEncoder().encode(s).length;
export const kb = (n: number) => `${(n / 1024).toFixed(1)} kB`;

const JS = /<script|\son[a-z]+\s*=|javascript:/i;
// Any href/src/url() that is not a same-file fragment (#id) counts as external.
const EXTERNAL = /<foreignObject|<image|@import|(?:href|src)\s*=\s*["'](?!#)|url\(\s*["']?(?!#)/i;
const LIVE_TEXT = /<text[\s>]|@font-face/i;

/** What GitHub's image proxy will and won't render, checked on the exported files. */
export function checkSvgs(light: string, dark: string, cfg: Config): Check[] {
  const both = light + dark;
  const js = JS.test(both);
  const external = EXTERNAL.test(both);
  const textEls = LIVE_TEXT.test(both);
  const size = Math.max(bytes(light), bytes(dark));
  const c = cfg.colors;
  const darkOk = light !== dark && luminance(c.bg.dark) < luminance(c.bg.light);
  const inkL = contrast(c.ink.light, c.bg.light);
  const inkD = contrast(c.ink.dark, c.bg.dark);
  const alt = cfg.alt.trim();
  const rm = /prefers-reduced-motion/.test(light) && /prefers-reduced-motion/.test(dark);
  return [
    { id: 'js', label: 'No JavaScript', ok: !js, detail: js ? 'Script or event handler found' : 'CSS keyframes only' },
    { id: 'external', label: 'No external files', ok: !external, detail: external ? 'External reference found' : 'Self-contained' },
    { id: 'fonts', label: 'Fonts outlined', ok: !textEls, detail: textEls ? 'Live text found' : 'Text is paths' },
    { id: 'size', label: 'File size', ok: size <= SIZE_BUDGET, detail: `${kb(size)} / 50 kB` },
    { id: 'dark', label: 'Dark variant', ok: darkOk, detail: darkOk ? 'light.svg + dark.svg' : 'Make the dark background darker' },
    { id: 'alt', label: 'Alt text', ok: alt.length >= 4, detail: alt.length >= 4 ? `${alt.length} characters` : 'Describe the image' },
    { id: 'motion', label: 'Reduced motion', ok: rm, detail: rm ? 'Rests when motion is off' : 'Rule missing' },
    {
      id: 'loop',
      label: 'Cycle 8 s or less',
      ok: cfg.timing.duration <= MAX_DURATION,
      detail: `${cfg.timing.duration} s, ${cfg.timing.mode === 'loop' ? 'loops' : 'plays once'}`,
    },
    { id: 'contrast', label: 'Text contrast AA', ok: inkL >= 4.5 && inkD >= 4.5, detail: `${inkL.toFixed(1)} and ${inkD.toFixed(1)} to 1` },
  ];
}
