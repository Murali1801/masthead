#!/usr/bin/env node
// Masthead CLI: render configs to light/dark SVGs with the same renderer as the editor.
// Usage: node bin/masthead.mjs <config.json | folder>... --out <dir>
// Needs Node 22.18+ (runs the TypeScript core directly via type stripping).
import { readFileSync, writeFileSync, mkdirSync, statSync, readdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalize, render, checkSvgs, pictureSnippet, bytes, kb } from '../src/core/index.ts';
import { loadFonts } from '../src/node/fonts.ts';

const HELP = `masthead: render animated SVG banners for your README

Usage
  node bin/masthead.mjs <config.json | folder>... --out <dir>

Options
  --out, -o   Output folder (default: current folder)
  --quiet     Only print errors
  --help      Show this help

Each config writes <name>-light.svg and <name>-dark.svg, where <name> is the
config's "name" field or the file name. Export a config from the editor with
"Export JSON". Exits 1 if any GitHub check fails.`;

const args = process.argv.slice(2);
if (!args.length || args.includes('--help') || args.includes('-h')) {
  console.log(HELP);
  process.exit(args.length ? 0 : 1);
}

let out = '.';
let quiet = false;
const inputs = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--out' || a === '-o') out = args[++i] ?? '.';
  else if (a.startsWith('--out=')) out = a.slice(6);
  else if (a === '--quiet') quiet = true;
  else inputs.push(a);
}

const files = inputs.flatMap((p) => {
  const st = statSync(p);
  if (!st.isDirectory()) return [p];
  return readdirSync(p).filter((f) => f.endsWith('.json')).sort().map((f) => join(p, f));
});
if (!files.length) {
  console.error('No config files found.');
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fonts = loadFonts(join(root, 'public', 'fonts'));
mkdirSync(out, { recursive: true });

let failed = false;
for (const file of files) {
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  const cfg = normalize({ name: basename(file, '.json'), ...raw });
  const light = render(cfg, fonts, { variant: 'light' });
  const dark = render(cfg, fonts, { variant: 'dark' });
  writeFileSync(join(out, `${cfg.name}-light.svg`), light.svg);
  writeFileSync(join(out, `${cfg.name}-dark.svg`), dark.svg);
  const checks = checkSvgs(light.svg, dark.svg, cfg);
  const bad = checks.filter((c) => !c.ok);
  if (bad.length) failed = true;
  if (!quiet || bad.length) {
    console.log(`${cfg.name}  ${cfg.template}  ${kb(bytes(light.svg))} light, ${kb(bytes(dark.svg))} dark`);
    for (const c of bad) console.log(`  x ${c.label}: ${c.detail}`);
  }
  if (!quiet) console.log(pictureSnippet(cfg.name, cfg.alt, light.width) + '\n');
}
process.exit(failed ? 1 : 0);
