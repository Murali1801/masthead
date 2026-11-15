/** Small colour helpers: hex parsing, WCAG contrast and an OKLCH ramp. */

export function isHex(s: unknown): s is string {
  return typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s);
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

const toLinear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (v: number) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(toLinear) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function hexToOklch(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map(toLinear) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.hypot(A, B);
  const H = ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  return [L, C, H];
}

function oklchToLinear(L: number, C: number, H: number): [number, number, number] {
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** OKLCH to sRGB hex, reducing chroma until the colour is in gamut. */
export function oklchToHex(L: number, C: number, H: number): string {
  let c = C;
  for (let i = 0; i < 40; i++) {
    const rgb = oklchToLinear(L, c, H);
    if (rgb.every((v) => v >= -0.0005 && v <= 1.0005)) {
      return rgbToHex(...(rgb.map((v) => fromLinear(Math.min(1, Math.max(0, v)))) as [number, number, number]));
    }
    c *= 0.9;
  }
  const rgb = oklchToLinear(L, 0, H);
  return rgbToHex(...(rgb.map((v) => fromLinear(Math.min(1, Math.max(0, v)))) as [number, number, number]));
}

/** `n` steps of the base colour's hue, light to dark, with even OKLCH lightness. */
export function ramp(base: string, n: number): string[] {
  const [, C, H] = hexToOklch(base);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const L = 0.96 - t * 0.68;
    const c = C * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, t * 1.15)));
    out.push(oklchToHex(L, c, H));
  }
  return out;
}

/** Ink or paper text, whichever reads better on `bg`. */
export function onColor(bg: string, ink = '#16150F', paper = '#F3F0E8'): string {
  return contrast(bg, ink) >= contrast(bg, paper) ? ink : paper;
}

/** Linear sRGB-space mix of two hex colours, t = 0 gives a. */
export function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
