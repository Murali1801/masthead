import './styles.css';
import type { ColorRole, Config, FontRole, TemplateId, Variant } from '../core/types.ts';
import type { TrackInfo } from '../core/motion.ts';
import {
  BRAND, COLOR_LABELS, COLOR_ROLES, decodeHash, defaultConfig, encodeHash, fontsNeeded, MAX_DURATION, MIN_DURATION,
  normalize, switchTemplate,
} from '../core/config.ts';
import { render } from '../core/render.ts';
import { checkSvgs } from '../core/check.ts';
import { pictureSnippet } from '../core/snippet.ts';
import { FONTS, fontLabel, fontsForRole } from '../core/fonts.ts';
import { getTemplate, TEMPLATES, type FieldSpec } from '../core/templates/index.ts';
import { contrast, isHex } from '../core/color.ts';
import { cssFamily, ensureFonts, fontSet, injectFontFaces } from './fonts.ts';
import { listbox } from './listbox.ts';
import { Timeline } from './timeline.ts';
import { $, copy, debounce, download, h, nextId, reducedMotion, store, toast } from './util.ts';


let cfg: Config = decodeHash(location.hash) ?? defaultConfig('specimen');
let preview: Variant = 'light';
let t = 0;
let playing = false;
let lastFrame = 0;
let tracks: TrackInfo[] = [];
let exports = { light: '', dark: '' };
let seq = 0;

const art = $('#art');
const gh = $('#gh');
const timeline = new Timeline({
  scrub(nt) {
    pause();
    setT(nt);
  },
  retime(id, start, dur) {
    cfg.timing.tracks[id] = { start, dur };
    refresh();
  },
  reset(id) {
    if (id) delete cfg.timing.tracks[id];
    else cfg.timing.tracks = {};
    refresh();
    toast(id ? 'Track timing reset' : 'All track timing reset');
  },
  togglePlay() {
    if (playing) pause();
    else play();
  },
});
$('#timeline').replaceWith(timeline.el);

/* ---------- rendering ---------- */

function svgEl(): SVGSVGElement | null {
  return art.querySelector('svg');
}

function setT(nt: number): void {
  t = nt;
  svgEl()?.style.setProperty('--t', `${t.toFixed(3)}s`);
  timeline.setTime(t);
}

const pushHash = debounce(() => {
  history.replaceState(null, '', `#c=${encodeHash(cfg)}`);
}, 300);

const updateExports = debounce(() => {
  const fonts = fontSet();
  exports = {
    light: render(cfg, fonts, { variant: 'light' }).svg,
    dark: render(cfg, fonts, { variant: 'dark' }).svg,
  };
  paintChecks();
  $('#snippet').textContent = pictureSnippet(cfg.name, cfg.alt, getTemplate(cfg.template).width);
}, 120);

async function refresh(): Promise<void> {
  const my = ++seq;
  const fonts = await ensureFonts(fontsNeeded(cfg));
  if (my !== seq) return;
  const res = render(cfg, fonts, { variant: preview, editor: true });
  art.innerHTML = res.svg;
  art.style.setProperty('--ar', `${res.width} / ${res.height}`);
  art.classList.toggle('narrow', res.width < 600);
  $('#dims').textContent = `${res.width} × ${res.height}`;
  tracks = res.tracks;
  timeline.update(tracks, cfg.timing.duration, cfg.timing.mode);
  setT(t);
  pushHash();
  updateExports();
}

function paintChecks(): void {
  const list = $('#checks');
  list.textContent = '';
  for (const c of checkSvgs(exports.light, exports.dark, cfg)) {
    list.append(
      h('li', { class: c.ok ? 'ok' : 'bad' },
        h('span', { class: 'check-icon', 'aria-hidden': 'true', text: c.ok ? '✓' : '!' }),
        h('span', { class: 'check-label', text: c.label }),
        h('span', { class: 'check-detail mono', text: c.detail }),
        h('span', { class: 'sr-only', text: c.ok ? 'passes' : 'needs attention' }),
      ),
    );
  }
}

/* ---------- playback ---------- */

function frame(now: number): void {
  if (!playing) return;
  const dt = (now - lastFrame) / 1000;
  lastFrame = now;
  let nt = t + dt;
  const D = cfg.timing.duration;
  if (cfg.timing.mode === 'loop') nt %= D;
  // Play-once keeps the clock running past the end so ambient loops (cursor blink) continue.
  t = nt;
  svgEl()?.style.setProperty('--t', `${t.toFixed(3)}s`);
  timeline.setTime(Math.min(t, D));
  requestAnimationFrame(frame);
}

function play(): void {
  if (playing) return;
  if (cfg.timing.mode === 'once' && t >= cfg.timing.duration) t = 0;
  playing = true;
  lastFrame = performance.now();
  timeline.setPlaying(true);
  requestAnimationFrame(frame);
}

function pause(): void {
  playing = false;
  if (cfg.timing.mode === 'once') t = Math.min(t, cfg.timing.duration);
  timeline.setPlaying(false);
}

function restart(): void {
  t = 0;
  setT(0);
  if (!reducedMotion()) play();
  else setT(cfg.timing.duration);
}

/* ---------- template rail ---------- */

const thumbCache = new Map<string, string>();

async function paintRail(): Promise<void> {
  const rail = $('#rail');
  if (!rail.childElementCount) {
    for (const tpl of TEMPLATES) {
      const btn = h('button', { type: 'button', class: 'thumb', 'data-id': tpl.id, 'aria-pressed': 'false', role: 'listitem' },
        h('span', { class: 'thumb-art', 'aria-hidden': 'true' }),
        h('span', { class: 'thumb-name', text: tpl.name }),
        h('span', { class: 'thumb-blurb', text: tpl.blurb }),
      );
      btn.addEventListener('click', () => pickTemplate(tpl.id));
      rail.append(btn);
    }
  }
  rail.querySelectorAll<HTMLElement>('.thumb').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === cfg.template)));
  const needed = TEMPLATES.flatMap((tpl) => fontsNeeded(defaultConfig(tpl.id)));
  const fonts = await ensureFonts(needed);
  for (const tpl of TEMPLATES) {
    const key = `${tpl.id}-${preview}`;
    let src = thumbCache.get(key);
    if (!src) {
      const c = defaultConfig(tpl.id);
      src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(render(c, fonts, { variant: preview }).svg)}`;
      thumbCache.set(key, src);
    }
    const slot = rail.querySelector<HTMLElement>(`.thumb[data-id="${tpl.id}"] .thumb-art`)!;
    slot.textContent = '';
    slot.append(h('img', { src, alt: '', width: tpl.width, height: tpl.height, decoding: 'async' }));
    slot.classList.toggle('card', tpl.width < 600);
  }
}

function pickTemplate(id: TemplateId): void {
  if (id === cfg.template) return;
  cfg = switchTemplate(cfg, id);
  buildInspector();
  paintRail();
  refresh().then(restart);
}

/* ---------- inspector ---------- */

function section(title: string, ...kids: Node[]): HTMLElement {
  const id = nextId('sec');
  return h('section', { class: 'insp-sec', 'aria-labelledby': id }, h('h2', { class: 'eyebrow', id, text: title }), ...kids);
}

function textField(spec: FieldSpec, value: string, onInput: (v: string) => void): HTMLElement {
  const id = nextId('f');
  const input =
    spec.kind === 'textarea'
      ? h('textarea', { id, rows: spec.rows ?? 3, maxlength: spec.max ?? 200, spellcheck: 'false' })
      : h('input', { id, type: 'text', maxlength: spec.max ?? 200, spellcheck: 'false', autocomplete: 'off' });
  input.value = value;
  input.addEventListener('input', () => onInput(input.value));
  const wrap = h('div', { class: 'field' }, h('label', { class: 'field-label', for: id, text: spec.label }), input);
  if (spec.hint) {
    const hid = `${id}-h`;
    input.setAttribute('aria-describedby', hid);
    wrap.append(h('span', { class: 'hint', id: hid, text: spec.hint }));
  }
  return wrap;
}

function toggleField(label: string, value: boolean, onChange: (v: boolean) => void): HTMLElement {
  const id = nextId('t');
  const input = h('input', { id, type: 'checkbox', class: 'switch' });
  input.checked = value;
  input.addEventListener('change', () => onChange(input.checked));
  return h('div', { class: 'field row' }, input, h('label', { for: id, text: label }));
}

function colorInput(label: string, value: string, onChange: (v: string) => void): HTMLElement {
  const id = nextId('c');
  const swatch = h('input', { type: 'color', class: 'swatch-input', 'aria-label': `${label} picker` });
  swatch.value = value.toLowerCase();
  const hex = h('input', { id, type: 'text', class: 'hex mono', maxlength: 7, spellcheck: 'false', autocomplete: 'off', 'aria-label': label });
  hex.value = value.toUpperCase();
  const box = h('span', { class: 'swatch', style: `--c:${value}` }, swatch);
  swatch.addEventListener('input', () => {
    const v = swatch.value.toUpperCase();
    hex.value = v;
    box.style.setProperty('--c', v);
    onChange(v);
  });
  hex.addEventListener('input', () => {
    let v = hex.value.trim();
    if (!v.startsWith('#')) v = '#' + v;
    const ok = isHex(v);
    hex.setAttribute('aria-invalid', String(!ok));
    if (ok) {
      swatch.value = v.toLowerCase();
      box.style.setProperty('--c', v);
      onChange(v.toUpperCase());
    }
  });
  return h('span', { class: 'color-in' }, box, hex);
}

function slider(label: string, value: number, min: number, max: number, step: number, unit: string, onInput: (v: number) => void): HTMLElement {
  const id = nextId('r');
  const out = h('output', { class: 'mono', for: id, text: `${value}${unit}` });
  const input = h('input', { id, type: 'range', min, max, step });
  input.value = String(value);
  input.addEventListener('input', () => {
    const v = Number(input.value);
    out.textContent = `${v}${unit}`;
    onInput(v);
  });
  return h('div', { class: 'field' }, h('div', { class: 'field-top' }, h('label', { class: 'field-label', for: id, text: label }), out), input);
}

function segmented(label: string, opts: Array<{ value: string; label: string }>, value: string, onChange: (v: string) => void): HTMLElement {
  const group = h('div', { class: 'seg', role: 'group', 'aria-label': label });
  for (const o of opts) {
    const b = h('button', { type: 'button', class: 'seg-btn', 'aria-pressed': String(o.value === value), text: o.label });
    b.addEventListener('click', () => {
      group.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      onChange(o.value);
    });
    group.append(b);
  }
  return h('div', { class: 'field' }, h('span', { class: 'field-label', text: label }), group);
}

const ROLE_LABEL: Record<FontRole, string> = { display: 'Display face', text: 'Text face', mono: 'Mono face' };

function buildInspector(): void {
  const root = $('#inspector');
  root.textContent = '';
  const tpl = getTemplate(cfg.template);

  // Content
  const content: Node[] = [];
  for (const spec of tpl.fields) {
    const v = cfg.fields[spec.key];
    if (spec.kind === 'toggle') {
      content.push(toggleField(spec.label, v === true, (nv) => { cfg.fields[spec.key] = nv; refresh(); }));
    } else if (spec.kind === 'select') {
      content.push(listbox(spec.label, spec.options ?? [], String(v), (nv) => { cfg.fields[spec.key] = nv; refresh(); }).el);
    } else if (spec.kind === 'color') {
      content.push(h('div', { class: 'field' }, h('span', { class: 'field-label', text: spec.label }),
        colorInput(spec.label, String(v), (nv) => { cfg.fields[spec.key] = nv; refresh(); })));
    } else {
      content.push(textField(spec, String(v ?? ''), (nv) => { cfg.fields[spec.key] = nv; refresh(); }));
    }
  }
  content.push(textField({ key: 'alt', label: 'Alt text', kind: 'textarea', rows: 2, max: 200, hint: 'Read by screen readers and shown if the image fails.' }, cfg.alt, (nv) => { cfg.alt = nv; refresh(); }));
  content.push(textField({ key: 'name', label: 'File name', kind: 'text', max: 40, hint: 'Saves as name-light.svg and name-dark.svg' }, cfg.name, (nv) => {
    cfg.name = nv.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'masthead';
    updateExports();
    pushHash();
  }));
  root.append(section('Content', ...content));

  // Type
  const type: Node[] = [];
  for (const role of tpl.roles) {
    const opts = fontsForRole(role).map((f) => ({ value: f.id, label: fontLabel(f.id), style: `font-family:"${cssFamily(f.id)}",system-ui` }));
    type.push(listbox(ROLE_LABEL[role], opts, cfg.fonts[role], (nv) => { cfg.fonts[role] = nv; refresh(); }).el);
  }
  type.push(h('p', { class: 'note', text: `${FONTS.length} static Google Fonts faces ship with the app. Text is converted to outlines, so readers never download a font.` }));
  root.append(section('Type', ...type));

  // Colour
  const rows: Node[] = [h('div', { class: 'color-head', 'aria-hidden': 'true' }, h('span'), h('span', { text: 'Light' }), h('span', { text: 'Dark' }))];
  for (const role of COLOR_ROLES) {
    rows.push(h('div', { class: 'color-row', role: 'group', 'aria-label': COLOR_LABELS[role] },
      h('span', { class: 'field-label', text: COLOR_LABELS[role] }),
      colorInput(`${COLOR_LABELS[role]}, light`, cfg.colors[role].light, (nv) => { cfg.colors[role].light = nv; onColor(role); }),
      colorInput(`${COLOR_LABELS[role]}, dark`, cfg.colors[role].dark, (nv) => { cfg.colors[role].dark = nv; onColor(role); }),
    ));
  }
  const contrastNote = h('p', { class: 'note', id: 'contrast-note' });
  const resetColors = h('button', { type: 'button', class: 'btn small', text: 'Reset to brand colours' });
  resetColors.addEventListener('click', () => {
    cfg.colors = structuredClone(BRAND);
    buildInspector();
    refresh();
  });
  root.append(section('Colour', ...rows, contrastNote, resetColors));
  paintContrast();

  // Timing
  const timing: Node[] = [
    slider('Cycle length', cfg.timing.duration, MIN_DURATION, MAX_DURATION, 0.5, ' s', (v) => { cfg.timing.duration = v; refresh(); }),
    segmented('Playback', [{ value: 'once', label: 'Play once' }, { value: 'loop', label: 'Loop' }], cfg.timing.mode, (v) => {
      cfg.timing.mode = v as Config['timing']['mode'];
      refresh().then(restart);
    }),
    h('p', { class: 'note', text: 'Play once builds in and rests. Loop rests, then returns to the start. Cursors keep blinking either way.' }),
  ];
  root.append(section('Timing', ...timing));

  // Canvas
  const canvas: Node[] = [];
  if (tpl.heightRange) {
    canvas.push(slider('Height', cfg.height, tpl.heightRange[0], tpl.heightRange[1], 10, ' px', (v) => { cfg.height = v; refresh(); }));
  }
  canvas.push(slider('Corner radius', cfg.radius, 0, 24, 1, ' px', (v) => { cfg.radius = v; refresh(); }));
  root.append(section('Canvas', ...canvas));
}

function onColor(_role: ColorRole): void {
  paintContrast();
  refresh();
}

function paintContrast(): void {
  const el = document.getElementById('contrast-note');
  if (!el) return;
  const l = contrast(cfg.colors.ink.light, cfg.colors.bg.light);
  const d = contrast(cfg.colors.ink.dark, cfg.colors.bg.dark);
  el.textContent = `Ink on background: ${l.toFixed(1)} to 1 light, ${d.toFixed(1)} to 1 dark. AA needs 4.5.`;
}

/* ---------- chrome ---------- */

function setPreviewButtons(v: Variant): void {
  preview = v;
  gh.dataset.theme = v;
  document.querySelectorAll<HTMLElement>('[data-preview]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preview === v)));
}

function setPreview(v: Variant): void {
  setPreviewButtons(v);
  paintRail();
  refresh();
}

document.querySelectorAll<HTMLElement>('[data-preview]').forEach((b) =>
  b.addEventListener('click', () => setPreview(b.dataset.preview as Variant)),
);

$('#rm-sim').addEventListener('change', (e) => {
  gh.classList.toggle('rm', (e.target as HTMLInputElement).checked);
});

function base(): string {
  return cfg.name || 'masthead';
}

$('#dl-light').addEventListener('click', () => download(`${base()}-light.svg`, exports.light, 'image/svg+xml'));
$('#dl-dark').addEventListener('click', () => download(`${base()}-dark.svg`, exports.dark, 'image/svg+xml'));
$('#dl-both').addEventListener('click', () => {
  download(`${base()}-light.svg`, exports.light, 'image/svg+xml');
  setTimeout(() => download(`${base()}-dark.svg`, exports.dark, 'image/svg+xml'), 250);
  toast('Saved light and dark SVGs');
});
$('#copy-snippet').addEventListener('click', async () => {
  toast((await copy($('#snippet').textContent ?? '')) ? 'Snippet copied' : 'Copy failed: select the snippet and copy it');
});
$('#json-out').addEventListener('click', () => download(`${base()}.json`, JSON.stringify(cfg, null, 2) + '\n', 'application/json'));
$('#json-in').addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    cfg = normalize(JSON.parse(await file.text()));
    buildInspector();
    paintRail();
    await refresh();
    restart();
    toast(`Loaded ${file.name}`);
  } catch {
    toast('That file is not a Masthead config');
  }
});
$('#copy-link').addEventListener('click', async () => {
  history.replaceState(null, '', `#c=${encodeHash(cfg)}`);
  toast((await copy(location.href)) ? 'Link copied. It holds the whole design.' : 'Copy failed');
});

const themeBtn = $('#theme');
function currentTheme(): 'light' | 'dark' {
  const set = document.documentElement.dataset.theme;
  if (set === 'light' || set === 'dark') return set;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function paintTheme(): void {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  themeBtn.setAttribute('aria-label', `Switch editor to ${next} theme`);
  themeBtn.dataset.mode = currentTheme();
}
themeBtn.addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  store.set('mh-theme', next);
  paintTheme();
});
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', paintTheme);

window.addEventListener('hashchange', () => {
  const next = decodeHash(location.hash);
  if (next && JSON.stringify(next) !== JSON.stringify(cfg)) {
    cfg = next;
    buildInspector();
    paintRail();
    refresh().then(restart);
  }
});

/* ---------- boot ---------- */

injectFontFaces();
paintTheme();
setPreviewButtons(currentTheme());
buildInspector();
paintRail();
refresh().then(restart);
