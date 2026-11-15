import { describe, expect, it } from 'vitest';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { join } from 'node:path';
import { TEMPLATES, defaultConfig, render, checkSvgs, normalize, encodeHash, decodeHash, bytes, SIZE_BUDGET, pictureSnippet } from '../src/core/index.ts';
import type { Config, Variant } from '../src/core/index.ts';
import { loadFonts } from '../src/node/fonts.ts';
import { pathData } from '../src/core/path.ts';
import { contrast, ramp } from '../src/core/color.ts';

const fonts = loadFonts(join(__dirname, '..', 'public', 'fonts'));
const variants: Variant[] = ['light', 'dark'];
const modes: Array<Config['timing']['mode']> = ['once', 'loop'];

function cases(): Array<[string, Config, Variant]> {
  const out: Array<[string, Config, Variant]> = [];
  for (const t of TEMPLATES) {
    for (const mode of modes) {
      const cfg = defaultConfig(t.id);
      cfg.timing.mode = mode;
      for (const v of variants) out.push([`${t.id} ${mode} ${v}`, cfg, v]);
    }
  }
  return out;
}

describe('renderer output', () => {
  it.each(cases())('%s is valid, self-contained SVG', (_name, cfg, variant) => {
    const { svg } = render(cfg, fonts, { variant });
    expect(XMLValidator.validate(svg)).toBe(true);
    const doc = new XMLParser({ ignoreAttributes: false }).parse(svg);
    expect(doc.svg['@_xmlns']).toBe('http://www.w3.org/2000/svg');
    expect(doc.svg['@_viewBox']).toMatch(/^0 0 \d+ \d+$/);
    expect(svg).not.toMatch(/<script/i);
    expect(svg).not.toMatch(/\son[a-z]+=/i);
    expect(svg).not.toMatch(/<foreignObject|<image|<text[\s>]|@font-face|@import/i);
    // Only same-file references (#id) are allowed.
    for (const m of svg.matchAll(/(?:href|src)="([^"]*)"/g)) expect(m[1]).toMatch(/^#/);
    for (const m of svg.matchAll(/url\(([^)]*)\)/g)) expect(m[1]).toMatch(/^#/);
    expect(bytes(svg)).toBeLessThanOrEqual(SIZE_BUDGET);
    expect(svg).toContain('@media (prefers-reduced-motion:reduce)');
    expect(svg).toContain('@keyframes');
  });

  it('is deterministic: same config, same bytes', () => {
    for (const t of TEMPLATES) {
      const a = render(defaultConfig(t.id), fonts, { variant: 'dark' }).svg;
      const b = render(normalize(JSON.parse(JSON.stringify(defaultConfig(t.id)))), loadFonts(join(__dirname, '..', 'public', 'fonts')), { variant: 'dark' }).svg;
      expect(b).toBe(a);
    }
  });

  it('light and dark differ only in colour', () => {
    const cfg = defaultConfig('specimen');
    const strip = (s: string) => s.replace(/#[0-9A-Fa-f]{6}/g, '#').replace(/ stroke="#"/g, '');
    const l = render(cfg, fonts, { variant: 'light' }).svg;
    const d = render(cfg, fonts, { variant: 'dark' }).svg;
    expect(l).not.toBe(d);
    expect(l).toContain(cfg.colors.bg.light);
    expect(d).toContain(cfg.colors.bg.dark);
    expect(strip(l).length).toBeGreaterThan(strip(d).length - 50);
  });

  it('play-once runs a single iteration, loop runs forever', () => {
    const cfg = defaultConfig('blueprint');
    cfg.timing.mode = 'once';
    const once = render(cfg, fonts, { variant: 'light' }).svg;
    expect(once).toMatch(/linear 1 both/);
    cfg.timing.mode = 'loop';
    const loop = render(cfg, fonts, { variant: 'light' }).svg;
    expect(loop).toMatch(/linear infinite both/);
  });

  it('editor mode pauses every animation and offsets it by --t', () => {
    const { svg, tracks } = render(defaultConfig('specimen'), fonts, { variant: 'light', editor: true });
    expect(svg).toContain('animation-play-state:paused');
    expect(svg).toContain('var(--t,0s)');
    expect(svg).not.toContain('prefers-reduced-motion');
    expect(tracks.map((t) => t.id)).toEqual(['grid', 'title', 'type', 'blink']);
  });

  it('track overrides move keyframes', () => {
    const cfg = defaultConfig('specimen');
    const before = render(cfg, fonts, { variant: 'light' }).svg;
    cfg.timing.tracks.title = { start: 0.5, dur: 0.2 };
    const res = render(cfg, fonts, { variant: 'light' });
    expect(res.svg).not.toBe(before);
    expect(res.tracks.find((t) => t.id === 'title')).toMatchObject({ start: 0.5, dur: 0.2 });
  });

  it('cycles stay within 8 seconds', () => {
    const cfg = normalize({ template: 'ticker', timing: { duration: 30 } });
    expect(cfg.timing.duration).toBe(8);
  });

  it('a long title is fitted, not cropped, and stays under budget', () => {
    const cfg = normalize({ template: 'specimen', fields: { title: 'A rather long name for a banner here' } });
    const { svg } = render(cfg, fonts, { variant: 'light' });
    expect(bytes(svg)).toBeLessThanOrEqual(SIZE_BUDGET);
    const xs = [...svg.matchAll(/d="M(-?[\d.]+)/g)].map((m) => Number(m[1]));
    expect(Math.max(...xs)).toBeLessThan(840);
  });

  it('missing glyphs fall back instead of rendering empty boxes', () => {
    const cfg = normalize({ template: 'specimen', fields: { title: 'Ünbounded → ✓' }, fonts: { display: 'archivo-black-400' } });
    expect(() => render(cfg, fonts, { variant: 'light' })).not.toThrow();
  });
});

describe('GitHub check', () => {
  it('passes for every template default', () => {
    for (const t of TEMPLATES) {
      const cfg = defaultConfig(t.id);
      const checks = checkSvgs(render(cfg, fonts, { variant: 'light' }).svg, render(cfg, fonts, { variant: 'dark' }).svg, cfg);
      expect(checks.filter((c) => !c.ok)).toEqual([]);
    }
  });

  it('flags scripts, external refs, live text, missing alt and missing reduced motion', () => {
    const cfg = defaultConfig('specimen');
    cfg.alt = '';
    const bad = '<svg xmlns="http://www.w3.org/2000/svg"><script>x()</script><image href="https://x.test/a.png"/><text>Hi</text></svg>';
    const failed = checkSvgs(bad, bad + ' ', cfg).filter((c) => !c.ok).map((c) => c.id);
    expect(failed).toEqual(expect.arrayContaining(['js', 'external', 'fonts', 'alt', 'motion']));
  });
});

describe('config', () => {
  it('round-trips through the URL hash', () => {
    const cfg = defaultConfig('card');
    cfg.fields.title = 'Tab · ₹ split';
    expect(decodeHash('#c=' + encodeHash(cfg))).toEqual(cfg);
  });

  it('rejects junk and keeps defaults', () => {
    const cfg = normalize({ template: 'nope', colors: { bg: { light: 'red' } }, fonts: { display: 'comic-sans' }, height: 9999 });
    expect(cfg.template).toBe('specimen');
    expect(cfg.colors.bg.light).toBe('#F3F0E8');
    expect(cfg.fonts.display).toBe('schibsted-grotesk-700');
    expect(cfg.height).toBe(320);
    expect(decodeHash('#c=%%%')).toBeNull();
  });

  it('builds the picture snippet with escaped alt text', () => {
    const s = pictureSnippet('banner', 'Fish & "chips"', 840);
    expect(s).toContain('srcset="./banner-dark.svg"');
    expect(s).toContain('alt="Fish &amp; &quot;chips&quot;"');
  });
});

describe('helpers', () => {
  it('pathData stays compact and starts absolute', () => {
    const d = pathData([
      { type: 'M', x: 10, y: 10 },
      { type: 'L', x: 20, y: 10 },
      { type: 'L', x: 20, y: 25.04 },
      { type: 'Z' },
      { type: 'M', x: 30, y: 10 },
    ]);
    expect(d).toBe('M10 10h10v15zm20 0');
  });

  it('ramp runs light to dark with readable ends', () => {
    const r = ramp('#2747D9', 9);
    expect(r).toHaveLength(9);
    expect(contrast(r[0]!, r[8]!)).toBeGreaterThan(10);
  });
});
