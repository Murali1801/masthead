export type Variant = 'light' | 'dark';
export type TemplateId =
  | 'specimen' | 'ticker' | 'blueprint' | 'receipt' | 'ramp' | 'terminal' | 'plotter' | 'card';

/** A light/dark colour pair. Hex `#rrggbb`. */
export interface Pair { light: string; dark: string }

export type ColorRole = 'bg' | 'ink' | 'muted' | 'rule' | 'accent' | 'mark';
export type FontRole = 'display' | 'text' | 'mono';

export interface TrackOverride { start: number; dur: number }

export interface Config {
  version: 1;
  /** Used for file names: `<name>-light.svg`. */
  name: string;
  template: TemplateId;
  height: number;
  radius: number;
  alt: string;
  fields: Record<string, string | boolean>;
  fonts: Record<FontRole, string>;
  colors: Record<ColorRole, Pair>;
  timing: {
    /** Cycle length in seconds (1 to 8). */
    duration: number;
    mode: 'loop' | 'once';
    /** Per-track start/duration as fractions of the cycle. */
    tracks: Record<string, TrackOverride>;
  };
}

/** The subset of an opentype.js Font that the renderer needs. */
export interface PathCommand {
  type: 'M' | 'L' | 'C' | 'Q' | 'Z';
  x?: number; y?: number; x1?: number; y1?: number; x2?: number; y2?: number;
}
export interface GlyphLike {
  index: number;
  advanceWidth?: number;
  getPath(x: number, y: number, fontSize: number): { commands: PathCommand[] };
}
export interface FontLike {
  unitsPerEm: number;
  ascender: number;
  descender: number;
  tables: { os2?: { sCapHeight?: number; sxHeight?: number } };
  charToGlyph(c: string): GlyphLike;
  getKerningValue(left: GlyphLike, right: GlyphLike): number;
}

/** Loaded fonts keyed by font id (see fonts.ts). */
export type FontSet = ReadonlyMap<string, FontLike>;
