import { h, nextId } from './util.ts';

export interface Option {
  value: string;
  label: string;
  /** Inline style for the option label (font previews). */
  style?: string;
}

export interface Listbox {
  el: HTMLElement;
  set(value: string): void;
}

/**
 * A select drawn in the editor's own language: a button plus a listbox popup.
 * Keyboard: Enter/Space/Down opens, arrows move, Enter picks, Escape closes, letters jump.
 */
export function listbox(label: string, options: Option[], value: string, onChange: (v: string) => void): Listbox {
  const id = nextId('lb');
  const lab = h('span', { class: 'field-label', id: `${id}-l`, text: label });
  const btn = h('button', {
    type: 'button',
    class: 'lb-btn',
    id: `${id}-b`,
    'aria-haspopup': 'listbox',
    'aria-expanded': 'false',
    'aria-labelledby': `${id}-l ${id}-b`,
  });
  const list = h('ul', { class: 'lb-list', role: 'listbox', id: `${id}-list`, tabindex: '-1', 'aria-labelledby': `${id}-l`, hidden: true });
  const wrap = h('div', { class: 'field lb' }, lab, btn, list);
  let current = value;
  let active = 0;

  const items = options.map((o, i) => {
    const li = h('li', { role: 'option', id: `${id}-o${i}`, 'aria-selected': 'false' });
    const span = h('span', { text: o.label });
    if (o.style) span.setAttribute('style', o.style);
    li.append(span);
    li.addEventListener('click', () => pick(i));
    li.addEventListener('pointermove', () => highlight(i));
    list.append(li);
    return li;
  });

  function paint(): void {
    const i = Math.max(0, options.findIndex((o) => o.value === current));
    const o = options[i]!;
    btn.textContent = '';
    const s = h('span', { text: o.label });
    if (o.style) s.setAttribute('style', o.style);
    btn.append(s);
    items.forEach((li, j) => li.setAttribute('aria-selected', String(j === i)));
  }

  function highlight(i: number): void {
    active = Math.max(0, Math.min(options.length - 1, i));
    items.forEach((li, j) => li.classList.toggle('active', j === active));
    list.setAttribute('aria-activedescendant', `${id}-o${active}`);
    items[active]?.scrollIntoView({ block: 'nearest' });
  }

  function open(): void {
    list.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    highlight(Math.max(0, options.findIndex((o) => o.value === current)));
    list.focus();
    document.addEventListener('pointerdown', outside, true);
  }

  function close(focus = true): void {
    list.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', outside, true);
    if (focus) btn.focus();
  }

  function outside(e: Event): void {
    if (!wrap.contains(e.target as Node)) close(false);
  }

  function pick(i: number): void {
    const o = options[i];
    if (!o) return;
    current = o.value;
    paint();
    close();
    onChange(o.value);
  }

  btn.addEventListener('click', () => (list.hidden ? open() : close()));
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      open();
    }
  });
  list.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') highlight(active + 1);
    else if (e.key === 'ArrowUp') highlight(active - 1);
    else if (e.key === 'Home') highlight(0);
    else if (e.key === 'End') highlight(options.length - 1);
    else if (e.key === 'Enter' || e.key === ' ') pick(active);
    else if (e.key === 'Escape') close();
    else if (e.key === 'Tab') close(false);
    else if (e.key.length === 1) {
      const k = e.key.toLowerCase();
      const j = options.findIndex((o, n) => n > active && o.label.toLowerCase().startsWith(k));
      const any = j >= 0 ? j : options.findIndex((o) => o.label.toLowerCase().startsWith(k));
      if (any >= 0) highlight(any);
      return;
    } else return;
    e.preventDefault();
  });

  paint();
  return {
    el: wrap,
    set(v: string) {
      current = v;
      paint();
    },
  };
}
