// Left dock: search, category chips, 3-column shape tiles (click to add,
// drag onto the canvas to drop at a point) and a disabled "Libraries" row.
import { h, s, icon, setPressed, srOnly } from './dom.js';
import { I, KINDS, CATS, shapePath } from './defs.js';

function tileSvg(kind) {
  return s('svg', { width: 44, height: 30, viewBox: '0 0 44 30', 'aria-hidden': 'true', focusable: 'false' },
    s('path', { class: 'tp', d: shapePath(kind, 44, kind === 'diamond' ? 30 : 28), 'stroke-linejoin': 'round' }));
}

export function buildDock(ctx) {
  const { engine, actions } = ctx;
  let cat = 'all';
  let query = '';

  const input = h('input', { type: 'search', placeholder: 'Search shapes', autocomplete: 'off', spellcheck: 'false' });
  input.addEventListener('input', () => { query = input.value; renderTiles(); });
  const search = h('label.field', null, icon(I.search), srOnly('Search shapes'), input);

  const chips = CATS.map(([id, label]) => h('button.chip', { 'aria-pressed': 'false', text: label, onclick: () => { cat = id; renderTiles(); } }));
  const chipRow = h('div.ed-cats', { role: 'group', 'aria-label': 'Shape category' }, chips);

  const tiles = Object.keys(KINDS).map((kind) => {
    const k = KINDS[kind];
    const el = h('button.ed-tile', { 'aria-label': `Add ${k.name}`, 'data-kind': kind, title: `${k.name} (click, or drag onto the canvas)` },
      tileSvg(kind), h('span.ed-tile-name', { text: k.name }));
    wireDrag(el, kind);
    return el;
  });
  const grid = h('div.ed-tiles', null, tiles);
  const empty = h('div.ed-tiles-empty', { hidden: true, role: 'status' });

  const libs = h('div', null,
    h('div.mono-label.ed-libs-title', { text: 'Libraries' }),
    h('button.ed-lib', { disabled: true, 'aria-disabled': 'true', title: 'Shape libraries are coming soon' },
      h('span.dots', { 'aria-hidden': 'true' },
        ['#2F6FEB', '#1F9D55', '#7C4DFF', '#D97706'].map((c) => { const d = h('span'); d.style.background = c; return d; })),
      h('span', { text: 'UML, BPMN, cloud & more' }),
      h('span.badge', { text: 'Coming soon' })));

  function renderTiles() {
    CATS.forEach(([id], i) => setPressed(chips[i], cat === id));
    const q = query.trim().toLowerCase();
    let shown = 0;
    Object.keys(KINDS).forEach((kind, i) => {
      const k = KINDS[kind];
      const ok = (cat === 'all' || k.cats.includes(cat)) && (!q || k.name.toLowerCase().includes(q) || k.label.toLowerCase().includes(q));
      tiles[i].hidden = !ok;
      if (ok) shown++;
    });
    empty.hidden = shown > 0;
    empty.textContent = shown ? '' : `No shapes match “${query.trim()}”.`;
  }

  // Pointer-driven drag so it works with mouse, pen and touch alike.
  function wireDrag(tile, kind) {
    let start = null, ghost = null, suppressClick = false;
    tile.addEventListener('click', () => {
      if (suppressClick) { suppressClick = false; return; }
      actions.addShape(kind);
    });
    tile.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      start = { x: e.clientX, y: e.clientY, id: e.pointerId };
      // Capture now: a fast drag can leave the tile before the first move.
      try { tile.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    });
    tile.addEventListener('pointermove', (e) => {
      if (!start || e.pointerId !== start.id) return;
      if (!ghost) {
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < 6) return;
        ghost = h('div.ed-drag-ghost', { 'aria-hidden': 'true' }, tileSvg(kind), h('span.ed-tile-name', { text: KINDS[kind].name }));
        ctx.root.append(ghost);
      }
      ghost.style.transform = `translate(${e.clientX - 36}px, ${e.clientY - 30}px)`;
      const stage = ctx.root.querySelector('.ed-stage');
      stage.classList.toggle('is-shape-over', overStage(e));
    });
    const end = (e) => {
      if (!start || e.pointerId !== start.id) return;
      const wasDrag = !!ghost;
      if (ghost) { ghost.remove(); ghost = null; }
      ctx.root.querySelector('.ed-stage').classList.remove('is-shape-over');
      start = null;
      if (!wasDrag) return;
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 0);
      if (e.type === 'pointerup' && overStage(e)) dropAt(kind, e.clientX, e.clientY);
    };
    tile.addEventListener('pointerup', end);
    tile.addEventListener('pointercancel', end);
  }

  function overStage(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    return !!(el && el.closest('.ed-stage') && !el.closest('.ed-tools, .ed-zoom, .ed-readout'));
  }

  function dropAt(kind, cx, cy) {
    const k = KINDS[kind];
    if (typeof engine.clientToModel === 'function') {
      const p = engine.clientToModel(cx, cy);
      actions.addShape(kind, { x: Math.round(p.x - k.w / 2), y: Math.round(p.y - k.h / 2) });
    } else {
      actions.addShape(kind);
    }
  }

  renderTiles();
  return h('aside.ed-dock', { id: 'ed-dock', 'aria-label': 'Shapes' }, search, chipRow, grid, empty, libs);
}
