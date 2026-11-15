import type { TrackInfo } from '../core/motion.ts';
import { LOOP_EXIT } from '../core/motion.ts';
import { h } from './util.ts';

export interface TimelineHandlers {
  scrub(t: number): void;
  retime(id: string, start: number, dur: number): void;
  reset(id?: string): void;
  togglePlay(): void;
}

const fmt = (s: number) => s.toFixed(2);
const SNAP = 0.05;

/**
 * The timeline: a playhead that scrubs the paused CSS animation (via --t, which feeds a
 * negative animation-delay), one row per track with draggable bars and keyframe markers.
 */
export class Timeline {
  readonly el: HTMLElement;
  private h: TimelineHandlers;
  private lanes: HTMLElement;
  private labels: HTMLElement;
  private ruler: HTMLElement;
  private head: HTMLElement;
  private time: HTMLElement;
  private play: HTMLButtonElement;
  private zone: HTMLElement;
  private D = 6;
  private mode: 'loop' | 'once' = 'once';
  private t = 0;
  private tracks: TrackInfo[] = [];
  private dragging = false;

  constructor(handlers: TimelineHandlers) {
    this.h = handlers;
    this.play = h('button', { type: 'button', class: 'btn icon play', 'aria-label': 'Play' });
    this.play.addEventListener('click', () => this.h.togglePlay());
    this.time = h('span', { class: 'tl-time mono', 'aria-hidden': 'true' });
    const reset = h('button', { type: 'button', class: 'btn ghost small', text: 'Reset timing' });
    reset.addEventListener('click', () => this.h.reset());
    const hint = h('span', { class: 'tl-hint', text: 'Drag the playhead to scrub. Drag a bar to move it, its edge to stretch it.' });
    const bar = h('div', { class: 'tl-head' }, this.play, this.time, hint, reset);

    this.ruler = h('div', {
      class: 'tl-ruler',
      role: 'slider',
      tabindex: '0',
      'aria-label': 'Playhead',
      'aria-valuemin': '0',
    });
    this.head = h('div', { class: 'tl-playhead', 'aria-hidden': 'true' }, h('div', { class: 'tl-line' }, h('span', { class: 'tl-knob' })));
    this.zone = h('div', { class: 'tl-zone', 'aria-hidden': 'true' }, h('span', { text: 'return' }));
    this.lanes = h('div', { class: 'tl-lanes' }, this.ruler);
    this.labels = h('div', { class: 'tl-labels' }, h('span', { class: 'tl-label ruler-label mono', text: 's' }));
    const grid = h('div', { class: 'tl-grid' }, this.labels, this.lanes);
    this.el = h('section', { class: 'timeline panel', 'aria-label': 'Timeline' }, bar, grid);

    this.bindScrub();
    this.ruler.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 0.5 : 0.1;
      let t = this.t;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') t += step;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') t -= step;
      else if (e.key === 'Home') t = 0;
      else if (e.key === 'End') t = this.D;
      else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        this.h.togglePlay();
        return;
      } else return;
      e.preventDefault();
      this.h.scrub(Math.max(0, Math.min(this.D, t)));
    });
  }

  private x2t(clientX: number): number {
    const r = this.ruler.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * this.D;
  }

  private bindScrub(): void {
    const start = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('.tl-bar')) return;
      e.preventDefault();
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);
      this.ruler.focus({ preventScroll: true });
      this.h.scrub(this.x2t(e.clientX));
      const move = (ev: PointerEvent) => this.h.scrub(this.x2t(ev.clientX));
      const up = () => {
        target.removeEventListener('pointermove', move);
        target.removeEventListener('pointerup', up);
        target.removeEventListener('pointercancel', up);
      };
      target.addEventListener('pointermove', move);
      target.addEventListener('pointerup', up);
      target.addEventListener('pointercancel', up);
    };
    this.lanes.addEventListener('pointerdown', start);
  }

  setPlaying(on: boolean): void {
    this.play.setAttribute('aria-label', on ? 'Pause' : 'Play');
    this.play.classList.toggle('on', on);
  }

  setTime(t: number): void {
    this.t = Math.min(t, this.D);
    const p = this.D ? this.t / this.D : 0;
    this.head.style.setProperty('--x', `${(p * 100).toFixed(3)}%`);
    this.time.textContent = `${fmt(this.t)} / ${this.D.toFixed(1)} s`;
    this.ruler.setAttribute('aria-valuenow', this.t.toFixed(2));
    this.ruler.setAttribute('aria-valuetext', `${this.t.toFixed(2)} seconds`);
  }

  update(tracks: TrackInfo[], D: number, mode: 'loop' | 'once'): void {
    if (this.dragging) {
      // Keep bar elements alive during a drag; only reposition them.
      this.tracks = tracks;
      this.D = D;
      this.layoutBars();
      return;
    }
    this.tracks = tracks;
    this.D = D;
    this.mode = mode;
    this.ruler.setAttribute('aria-valuemax', String(D));

    // Ruler ticks and keyframe markers.
    this.ruler.textContent = '';
    for (let s = 0; s <= D + 1e-6; s += 0.5) {
      const whole = Math.abs(s - Math.round(s)) < 1e-6;
      const tick = h('span', { class: `tl-tick${whole ? ' major' : ''}`, style: `left:${(s / D) * 100}%` });
      if (whole) tick.append(h('em', { class: 'mono', text: String(Math.round(s)) }));
      this.ruler.append(tick);
    }
    const marks = new Set<string>();
    for (const t of tracks) {
      if (t.ambient) continue;
      marks.add(t.start.toFixed(4));
      marks.add((t.start + t.dur + t.tail).toFixed(4));
    }
    for (const m of marks) this.ruler.append(h('span', { class: 'tl-key', style: `left:${Number(m) * 100}%`, 'aria-hidden': 'true' }));
    this.zone.hidden = mode !== 'loop';
    this.zone.style.left = `${LOOP_EXIT * 100}%`;
    this.ruler.append(this.zone);

    // Rows.
    this.labels.querySelectorAll('.tl-label:not(.ruler-label)').forEach((n) => n.remove());
    this.lanes.querySelectorAll('.tl-lane').forEach((n) => n.remove());
    for (const t of tracks) {
      this.labels.append(h('span', { class: 'tl-label', text: t.label, title: t.label }));
      const lane = h('div', { class: 'tl-lane' });
      if (t.ambient) {
        lane.append(h('div', { class: 'tl-ambient', title: 'Loops on its own clock' }, h('span', { class: 'mono', text: 'loops' })));
      } else {
        lane.append(this.bar(t));
      }
      this.lanes.append(lane);
    }
    this.lanes.append(this.head);
    this.setTime(this.t);
  }

  private layoutBars(): void {
    this.lanes.querySelectorAll<HTMLElement>('.tl-bar').forEach((b) => {
      const t = this.tracks.find((x) => x.id === b.dataset.id);
      if (t) this.place(b, t);
    });
  }

  private place(b: HTMLElement, t: TrackInfo): void {
    const total = Math.min(1 - t.start, t.dur + t.tail);
    b.style.left = `${t.start * 100}%`;
    b.style.width = `${Math.max(total, 0.006) * 100}%`;
    b.style.setProperty('--core', `${total > 0 ? Math.min(100, (t.dur / total) * 100) : 100}%`);
    const s = t.start * this.D, e = (t.start + t.dur) * this.D;
    b.setAttribute('aria-label', `${t.label}: ${s.toFixed(2)} to ${e.toFixed(2)} seconds. Arrows move, Shift and arrows stretch, Delete resets.`);
  }

  private bar(t: TrackInfo): HTMLElement {
    const b = h('button', { type: 'button', class: 'tl-bar', 'data-id': t.id }, h('span', { class: 'tl-grip', 'aria-hidden': 'true' }));
    this.place(b, t);
    const end = () => (this.mode === 'loop' ? LOOP_EXIT : 1);
    const snap = (f: number) => (Math.round((f * this.D) / SNAP) * SNAP) / this.D;

    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      b.setPointerCapture(e.pointerId);
      b.focus({ preventScroll: true });
      const cur = this.tracks.find((x) => x.id === t.id) ?? t;
      const resize = (e.target as HTMLElement).classList.contains('tl-grip');
      const x0 = e.clientX;
      const w = this.ruler.getBoundingClientRect().width;
      const s0 = cur.start, d0 = cur.dur;
      this.dragging = true;
      b.classList.add('drag');
      const move = (ev: PointerEvent) => {
        const df = (ev.clientX - x0) / w;
        if (resize) {
          const dur = Math.max(0.01, Math.min(end() - s0, snap(d0 + df)));
          this.h.retime(t.id, s0, dur);
        } else {
          const start = Math.max(0, Math.min(end() - d0, snap(s0 + df)));
          this.h.retime(t.id, start, d0);
        }
      };
      const up = () => {
        this.dragging = false;
        b.classList.remove('drag');
        b.removeEventListener('pointermove', move);
        b.removeEventListener('pointerup', up);
        b.removeEventListener('pointercancel', up);
        this.update(this.tracks, this.D, this.mode);
        (this.lanes.querySelector(`.tl-bar[data-id="${t.id}"]`) as HTMLElement | null)?.focus({ preventScroll: true });
      };
      b.addEventListener('pointermove', move);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
    });
    b.addEventListener('dblclick', () => this.h.reset(t.id));
    b.addEventListener('keydown', (e) => {
      const cur = this.tracks.find((x) => x.id === t.id) ?? t;
      const step = 0.1 / this.D;
      let { start, dur } = cur;
      if (e.key === 'ArrowRight') e.shiftKey ? (dur += step) : (start += step);
      else if (e.key === 'ArrowLeft') e.shiftKey ? (dur -= step) : (start -= step);
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        this.h.reset(t.id);
        return;
      } else return;
      e.preventDefault();
      dur = Math.max(0.01, Math.min(end(), dur));
      start = Math.max(0, Math.min(end() - dur, start));
      this.h.retime(t.id, start, dur);
      this.update(this.tracks, this.D, this.mode);
      (this.lanes.querySelector(`.tl-bar[data-id="${t.id}"]`) as HTMLElement | null)?.focus({ preventScroll: true });
    });
    return b;
  }
}
