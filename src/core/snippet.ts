import { esc } from './templates/kit.ts';

/** The `<picture>` element that follows GitHub's light/dark theme. */
export function pictureSnippet(base: string, alt: string, width: number, dir = './'): string {
  const a = esc(alt.trim());
  return [
    '<picture>',
    `  <source media="(prefers-color-scheme: dark)" srcset="${dir}${base}-dark.svg">`,
    `  <img src="${dir}${base}-light.svg" alt="${a}" width="${width}">`,
    '</picture>',
  ].join('\n');
}
