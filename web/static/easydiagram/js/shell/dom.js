// Tiny DOM helpers for the shell. Everything is built with the DOM API
// (no markup strings), so text is never parsed as HTML.

const SVG_NS = 'http://www.w3.org/2000/svg';

// h('button.ibtn', {type: 'button', 'aria-label': 'Undo', onclick}, child...)
export function h(sel, attrs, ...children) {
  const [tag, ...classes] = sel.split('.');
  const el = document.createElement(tag || 'div');
  if (classes.length) el.className = classes.join(' ');
  applyAttrs(el, attrs);
  append(el, children);
  if (el.tagName === 'BUTTON' && !el.hasAttribute('type')) el.type = 'button';
  return el;
}

export function s(tag, attrs, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  applyAttrs(el, attrs);
  append(el, children);
  return el;
}

function applyAttrs(el, attrs) {
  if (!attrs) return;
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.setAttribute('class', v);
    else if (k === 'text') el.textContent = v;
    else if (k === 'vars') for (const [n, val] of Object.entries(v)) el.style.setProperty(n, val);
    else if (k === 'props') Object.assign(el, v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

// Stroked 24x24 icon, as used across the prototype.
export function icon(d, { size = 16, sw = 1.8, fill = 'none' } = {}) {
  return s('svg', {
    width: size, height: size, viewBox: '0 0 24 24', fill, stroke: fill === 'none' ? 'currentColor' : 'none',
    'stroke-width': sw, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false',
  }, s('path', { d }));
}

export function setPressed(el, on) {
  el.setAttribute('aria-pressed', on ? 'true' : 'false');
}

// A visually hidden label inside a <label class="field">.
export function srOnly(text) {
  return h('span.sr-only', { text });
}

// Segmented control. items: [[value, label, extraChild?]]; returns {el, set(value)}.
export function segmented(items, onPick, { cls = 'seg', ariaLabel, labelFor } = {}) {
  const btns = items.map(([value, label, aria, child]) =>
    h('button', { 'aria-pressed': 'false', 'aria-label': aria || null, 'data-value': String(value), onclick: () => onPick(value) },
      child || label));
  const el = h('div.' + cls.split(' ').join('.'), { role: 'group', 'aria-label': ariaLabel || null }, btns);
  return {
    el,
    set(value) { btns.forEach((b, i) => setPressed(b, items[i][0] === value)); },
  };
}

// Toggle switch row: button[aria-pressed] with a label and a track/knob.
export function toggleRow(label, onToggle, { light = false } = {}) {
  const el = h('button.toggle-row' + (light ? '.light' : ''), { 'aria-pressed': 'false', onclick: () => onToggle() },
    h('span', { text: label }), h('span.track', { 'aria-hidden': 'true' }, h('span.knob')));
  return { el, set(on) { setPressed(el, on); } };
}

export function isTyping(target) {
  const el = target instanceof Element ? target : null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const t = (el.getAttribute('type') || 'text').toLowerCase();
    return !['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'color', 'file'].includes(t);
  }
  return false;
}

export const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || '');
export const MOD = isMac ? '⌘' : 'Ctrl+';
export const SHIFT = isMac ? '⇧' : 'Shift+';
export const ALT = isMac ? '⌥' : 'Alt+';
