// Downloads the curated Google Fonts as static TTF files into public/fonts/
// and writes public/fonts/LICENSES.md from each family's OFL.txt.
// Run once: `npm run fonts`. The files are committed, so the app never hotlinks.
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'fonts');

/** family, google/fonts directory, weights ("400" or "400i" for italic) */
const FAMILIES = [
  ['Schibsted Grotesk', 'schibstedgrotesk', ['400', '700']],
  ['Instrument Sans', 'instrumentsans', ['400', '600']],
  ['Bricolage Grotesque', 'bricolagegrotesque', ['700']],
  ['Syne', 'syne', ['700']],
  ['Unbounded', 'unbounded', ['600']],
  ['Archivo Black', 'archivoblack', ['400']],
  ['Instrument Serif', 'instrumentserif', ['400', '400i']],
  ['Fraunces', 'fraunces', ['600']],
  ['DM Serif Display', 'dmserifdisplay', ['400']],
  ['Young Serif', 'youngserif', ['400']],
  ['JetBrains Mono', 'jetbrainsmono', ['400', '700']],
  ['IBM Plex Mono', 'ibmplexmono', ['500']],
];

const slug = (s) => s.toLowerCase().replace(/\s+/g, '-');

await mkdir(root, { recursive: true });
let licences = '# Font licences\n\nEvery font in this folder is a static instance downloaded from Google Fonts and is licensed under the SIL Open Font License 1.1. The copyright line and full licence text for each family follow.\n\n';

for (const [family, dir, weights] of FAMILIES) {
  for (const w of weights) {
    const italic = w.endsWith('i');
    const weight = w.replace('i', '');
    const axis = italic ? `ital,wght@1,${weight}` : `wght@${weight}`;
    const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:${axis}`;
    const css = await (await fetch(url)).text();
    const src = css.match(/url\((https:[^)]+\.ttf)\)/)?.[1];
    if (!src) throw new Error(`No TTF for ${family} ${w}:\n${css}`);
    const buf = Buffer.from(await (await fetch(src)).arrayBuffer());
    const file = `${slug(family)}-${weight}${italic ? '-italic' : ''}.ttf`;
    await writeFile(join(root, file), buf);
    console.log(file, (buf.length / 1024).toFixed(0), 'kB');
  }
  const ofl = await (await fetch(`https://raw.githubusercontent.com/google/fonts/main/ofl/${dir}/OFL.txt`)).text();
  licences += `## ${family}\n\nSource: https://fonts.google.com/specimen/${family.replace(/ /g, '+')}\n\n\`\`\`text\n${ofl.trim()}\n\`\`\`\n\n`;
}

await writeFile(join(root, 'LICENSES.md'), licences);
console.log('wrote LICENSES.md');
