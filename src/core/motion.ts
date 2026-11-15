import type { TrackOverride } from './types.ts';
import { num } from './path.ts';

/** House easing for draws and entrances. */
export const EASE = 'cubic-bezier(.2,.7,.2,1)';
/** In loop mode every cycle track rests until this point, then returns to its first frame. */
export const LOOP_EXIT = 0.92;

export interface Frame {
  /** Progress inside the track, 0 to 1. */
  at: number;
  css: string;
}

export interface TrackSpec {
  id: string;
  label: string;
  /** Default start and duration as fractions of the cycle. */
  start: number;
  dur: number;
  frames: Frame[];
  ease?: string;
  /** Base CSS for the resting state when it differs from the element's natural state. */
  rest?: string;
  /** transform-origin (adds transform-box: fill-box). */
  origin?: string;
  /** Seconds between consecutive elements that share the track. */
  stagger?: number;
  /** An independent loop (cursor blink, marquee) that ignores the cycle. */
  ambient?: { period: number; ease?: string };
  /** Kept off the timeline (a follower of another track). */
  hidden?: boolean;
}

export interface TrackInfo {
  id: string;
  label: string;
  start: number;
  dur: number;
  /** Fraction of the cycle covered by the stagger tail. */
  tail: number;
  ambient: boolean;
  count: number;
}

export interface MotionOptions {
  duration: number;
  mode: 'loop' | 'once';
  /** Editor mode: every animation is paused and offset by `var(--t)` so a playhead can scrub it. */
  editor: boolean;
  overrides: Record<string, TrackOverride>;
}

const pct = (p: number) => num(Math.round(p * 10000) / 100) + '%';
const sec = (s: number) => num(Math.round(s * 1000) / 1000) + 's';

export class Track {
  count = 0;
  readonly cls: string;
  private delayFor: (i: number) => string | null;
  constructor(cls: string, delayFor: (i: number) => string | null) {
    this.cls = cls;
    this.delayFor = delayFor;
  }
  /** Attributes for the i-th element on this track. */
  attr(i = this.count): string {
    this.count = Math.max(this.count, i + 1);
    const d = this.delayFor(i);
    return ` class="${this.cls}"` + (d ? ` style="animation-delay:${d}"` : '');
  }
}

export class Motion {
  private rules: string[] = [];
  private keyframes: string[] = [];
  private tracks: Array<{ info: TrackInfo; track: Track; stagger: number; hidden: boolean }> = [];

  readonly o: MotionOptions;
  constructor(o: MotionOptions) {
    this.o = o;
  }

  private delay(seconds: number): string {
    return this.o.editor ? `calc(${sec(seconds)} - var(--t,0s))` : sec(seconds);
  }

  track(spec: TrackSpec): Track {
    const n = this.tracks.length;
    const cls = `m-a${n}`;
    const name = `m-k${n}`;
    const D = this.o.duration;
    const stagger = spec.stagger ?? 0;
    const delayFor = (i: number) => (i > 0 && stagger > 0 ? this.delay(i * stagger) : null);
    const track = new Track(cls, delayFor);
    const ease = spec.ease ?? EASE;
    const frames = [...spec.frames].sort((a, b) => a.at - b.at);
    const first = frames[0]!.css;
    const last = frames[frames.length - 1]!.css;

    let anim: string;
    let start = spec.start, dur = spec.dur;
    if (spec.ambient) {
      const pts = frames.map((f) => ({ p: f.at, css: f.css, t: '' }));
      this.keyframes.push(block(name, pts));
      anim = `${name} ${sec(spec.ambient.period)} ${spec.ambient.ease ?? 'linear'} infinite`;
      start = 0; dur = 1;
    } else {
      const ov = this.o.overrides[spec.id];
      const end = this.o.mode === 'loop' ? LOOP_EXIT : 1;
      if (ov) { start = ov.start; dur = ov.dur; }
      dur = Math.min(Math.max(dur, 0.01), end);
      start = Math.min(Math.max(start, 0), end - dur);
      const pts: Array<{ p: number; css: string; t: string }> = [];
      const add = (p: number, css: string, t: string) => {
        const prev = pts[pts.length - 1];
        if (prev && Math.abs(prev.p - p) < 1e-6) { prev.css = css; prev.t = t; return; }
        pts.push({ p, css, t });
      };
      if (start > 0) add(0, first, '');
      frames.forEach((f, i) => add(start + f.at * dur, f.css, i < frames.length - 1 ? ease : ''));
      if (this.o.mode === 'loop') {
        add(LOOP_EXIT, last, EASE);
        add(1, first, '');
      } else if (start + dur < 1) {
        add(1, last, '');
      }
      this.keyframes.push(block(name, pts));
      anim = `${name} ${sec(D)} linear ${this.o.mode === 'loop' ? 'infinite' : '1'} both`;
    }

    let rule = `.${cls}{animation:${anim};`;
    if (this.o.editor) rule += `animation-delay:${this.delay(0)};`;
    if (spec.origin) rule += `transform-box:fill-box;transform-origin:${spec.origin};`;
    if (spec.rest) rule += spec.rest.endsWith(';') ? spec.rest : spec.rest + ';';
    rule = rule.replace(/;$/, '') + '}';
    this.rules.push(rule);

    this.tracks.push({
      info: { id: spec.id, label: spec.label, start, dur, tail: 0, ambient: !!spec.ambient, count: 0 },
      track,
      stagger,
      hidden: !!spec.hidden,
    });
    return track;
  }

  /** Effective start/dur of an earlier track, after overrides and clamping. */
  resolved(id: string): { start: number; dur: number } {
    const t = this.tracks.find((x) => x.info.id === id);
    return t ? { start: t.info.start, dur: t.info.dur } : { start: 0, dur: 0.1 };
  }

  /** Track metadata for the timeline (call after the template has rendered). */
  info(): TrackInfo[] {
    const D = this.o.duration;
    return this.tracks.filter((t) => !t.hidden).map(({ info, track, stagger }) => ({
      ...info,
      count: track.count,
      tail: info.ambient ? 0 : Math.min(1, (stagger * Math.max(0, track.count - 1)) / D),
    }));
  }

  css(): string {
    let css = this.keyframes.join('') + this.rules.join('');
    if (this.o.editor) css += '.mh *{animation-play-state:paused!important}';
    else css += '@media (prefers-reduced-motion:reduce){.mh *{animation:none!important}}';
    return css;
  }
}

function block(name: string, pts: Array<{ p: number; css: string; t: string }>): string {
  // Group identical keyframes into one selector list to save bytes.
  const groups = new Map<string, string[]>();
  for (const pt of pts) {
    const body = pt.css + (pt.t ? `;animation-timing-function:${pt.t}` : '');
    const list = groups.get(body) ?? [];
    list.push(pct(pt.p));
    groups.set(body, list);
  }
  let out = `@keyframes ${name}{`;
  for (const [body, sel] of groups) out += `${sel.join(',')}{${body}}`;
  return out + '}';
}
