// Left dock: search, category chips, 3-column shape tiles (click to add,
// drag onto the canvas to drop at a point) and a disabled "Libraries" row.
import { h, s, icon, setPressed, srOnly } from './dom.js';
import { I, KINDS, CATS, shapePath } from './defs.js';
import { AWS_SERVICES, AWS_CATEGORIES, awsIconDataUri } from '../aws-icons.js';

const AWS_SIZE = 64;

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

  // Every dock entry: the outline shapes, then one tile per AWS service.
  const entries = Object.keys(KINDS).map((kind) => ({
    kind, props: null, name: KINDS[kind].name, cats: KINDS[kind].cats, words: [KINDS[kind].label],
    w: KINDS[kind].w, h: KINDS[kind].h, art: () => tileSvg(kind),
  })).concat(AWS_SERVICES.map((svc) => ({
    kind: 'aws', props: { service: svc.id }, name: svc.label, cats: ['aws'],
    words: [svc.name, AWS_CATEGORIES[svc.category].name, 'aws'], w: AWS_SIZE, h: AWS_SIZE,
    art: () => h('img.ed-tile-aws', { src: awsIconDataUri(svc.id), alt: '', width: 30, height: 30, draggable: 'false' }),
  })));

  const tiles = entries.map((e) => {
    const full = e.kind === 'aws' ? `${e.words[0]}` : e.name;
    const el = h('button.ed-tile', { 'aria-label': `Add ${full}`, 'data-kind': e.kind, 'data-service': e.props ? e.props.service : null,
      title: `${full} (click, or drag onto the canvas)` },
      e.art(), h('span.ed-tile-name', { text: e.name }));
    wireDrag(el, e);
    return el;
  });
  const grid = h('div.ed-tiles', null, tiles);
  const empty = h('div.ed-tiles-empty', { hidden: true, role: 'status' });

  const libs = h('div', null,
    h('div.mono-label.ed-libs-title', { text: 'Libraries' }),
    h('button.ed-lib', { disabled: true, 'aria-disabled': 'true', title: 'Shape libraries are coming soon' },
      h('span.dots', { 'aria-hidden': 'true' },
        ['#2F6FEB', '#1F9D55', '#7C4DFF', '#D97706'].map((c) => { const d = h('span'); d.style.background = c; return d; })),
      h('span', { text: 'UML, BPMN, Azure & more' }),
      h('span.badge', { text: 'Coming soon' })));

  function renderTiles() {
    CATS.forEach(([id], i) => setPressed(chips[i], cat === id));
    const q = query.trim().toLowerCase();
    let shown = 0;
    entries.forEach((e, i) => {
      const ok = (cat === 'all' || e.cats.includes(cat))
        && (!q || e.name.toLowerCase().includes(q) || e.words.some((w) => w.toLowerCase().includes(q)));
      tiles[i].hidden = !ok;
      if (ok) shown++;
    });
    empty.hidden = shown > 0;
    empty.textContent = shown ? '' : `No shapes match “${query.trim()}”.`;
  }

  // Pointer-driven drag so it works with mouse, pen and touch alike.
  function wireDrag(tile, entry) {
    let start = null, ghost = null, suppressClick = false;
    tile.addEventListener('click', () => {
      if (suppressClick) { suppressClick = false; return; }
      actions.addShape(entry.kind, entry.props ? Object.assign({}, entry.props) : undefined);
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
        ghost = h('div.ed-drag-ghost', { 'aria-hidden': 'true' }, entry.art(), h('span.ed-tile-name', { text: entry.name }));
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
      if (e.type === 'pointerup' && overStage(e)) dropAt(entry, e.clientX, e.clientY);
    };
    tile.addEventListener('pointerup', end);
    tile.addEventListener('pointercancel', end);
  }

  function overStage(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    return !!(el && el.closest('.ed-stage') && !el.closest('.ed-tools, .ed-zoom, .ed-readout'));
  }

  function dropAt(entry, cx, cy) {
    const base = entry.props ? Object.assign({}, entry.props) : {};
    if (typeof engine.clientToModel === 'function') {
      const p = engine.clientToModel(cx, cy);
      actions.addShape(entry.kind, Object.assign(base, { x: Math.round(p.x - entry.w / 2), y: Math.round(p.y - entry.h / 2) }));
    } else {
      actions.addShape(entry.kind, entry.props ? base : undefined);
    }
  }

  renderTiles();
  return h('aside.ed-dock', { id: 'ed-dock', 'aria-label': 'Shapes' }, search, chipRow, grid, empty, libs);
}
