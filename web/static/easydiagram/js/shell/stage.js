// The stage: the engine's canvas plus the shell overlays drawn over it:
// floating context bar, empty-page state, tool pill, status readout,
// zoom controls and the toast host.
import { h, icon, setPressed, MOD } from './dom.js';
import { I, TOOLS, COLORS, KIND_NAMES } from './defs.js';

export function buildStage(ctx) {
  const { engine, store, actions, canvas } = ctx;
  const cells = () => (typeof engine.cells === 'function' ? engine.cells() : null);

  // ---- floating context bar (needs engine.getScreenBounds)
  const ctxSw = ['blue', 'green', 'violet', 'pink', 'slate'].map((c) => {
    const name = COLORS.find((x) => x[0] === c)[1];
    return h('button.swatch', { 'aria-label': `Fill ${name}`, 'aria-pressed': 'false', 'data-color': c, vars: { '--sw': `var(--c-${c})` }, onclick: () => {
      const sel = engine.getSelection();
      if (sel.type === 'shape') engine.update(sel.ids[0], { color: c });
    } });
  });
  const ctxSep = h('span.vsep', { 'aria-hidden': 'true' });
  const ctxBar = h('div.ed-ctx', { role: 'toolbar', 'aria-label': 'Selection', hidden: true },
    ctxSw, ctxSep,
    h('button.ibtn', { 'aria-label': 'Duplicate', title: `Duplicate (${MOD}D)`, onclick: () => actions.duplicate() }, icon(I.dup)),
    h('button.ibtn', { 'aria-label': 'Delete', title: 'Delete', onclick: () => actions.remove() }, icon(I.trash)));
  let ctxFor = null;

  function placeCtx() {
    const sel = engine.getSelection();
    const id = sel.type === 'shape' ? sel.ids[0] : null;
    const b = id && typeof engine.getScreenBounds === 'function' ? engine.getScreenBounds(id) : null;
    if (!b) { ctxBar.hidden = true; ctxFor = null; return; }
    const c = engine.getCell(id);
    ctxSw.forEach((el) => setPressed(el, c && c.color === el.dataset.color));
    // AWS icons keep their category colour, so they get no fill swatches.
    const noFill = !!(c && c.kind === 'aws');
    ctxSw.forEach((el) => { el.hidden = noFill; });
    ctxSep.hidden = noFill;
    if (ctxFor !== id) { ctxBar.hidden = true; void ctxBar.offsetWidth; } // restart the intro animation
    ctxFor = id;
    ctxBar.hidden = false;
    // Sit below the shape when there's no room above, or when a connector
    // comes in from above (the bar would hide its arrowhead), unless one
    // also leaves from below.
    const near = (side) => engine.cells().some((e) => {
      if (e.type !== 'edge' || (e.source !== id && e.target !== id)) return false;
      const o = engine.getScreenBounds(e.source === id ? e.target : e.source);
      return o && (side === 'top' ? o.y + o.h <= b.y : o.y >= b.y + b.h);
    });
    const below = b.y < 96 || (near('top') && !near('bottom'));
    const W = stage.clientWidth;
    const bw = ctxBar.offsetWidth || 220;
    const cx = Math.max(bw / 2 + 8, Math.min(W - bw / 2 - 8, b.x + b.w / 2));
    ctxBar.style.left = cx + 'px';
    ctxBar.style.top = (below ? b.y + b.h + 46 : b.y - 46) + 'px';
    ctxBar.style.transform = `translate(-50%, ${below ? '0' : '-100%'})`;
  }

  // ---- empty state
  const empty = h('div.ed-empty', { hidden: true, 'data-testid': 'empty-state' },
    h('div.ed-empty-art', { 'aria-hidden': 'true' }, h('span.a'), h('span.b'), h('span.c'), h('span.d')),
    h('div.ed-empty-title', { role: 'heading', 'aria-level': '2', text: 'This page is empty' }),
    h('div.ed-empty-text', null,
      h('span.only-wide', { text: 'Click a shape on the left, drop a .ed or .drawio file here, or press ' }),
      h('span.only-phone', { text: 'Open the Shapes panel (top left) to add a shape, or press ' }), h('span.kbd', { text: MOD + 'K' }), ' to run any command.'),
    h('div.ed-empty-actions', null,
      h('button.accentbtn', { text: 'Add a shape', onclick: () => actions.addShape('round') }),
      h('button.ghostbtn', { text: 'Open a file', onclick: () => actions.open() })));

  // ---- tool pill
  const indicator = h('span.ed-indicator', { 'aria-hidden': 'true' });
  const toolBtns = TOOLS.map(([id, name, key, d]) => h('button.ed-tool', {
    'aria-pressed': 'false', 'aria-label': name, 'aria-keyshortcuts': key, 'data-tool': id, onclick: () => actions.pickTool(id),
  }, icon(d, { size: 18, sw: 1.6 }), h('span.ed-tip', { 'aria-hidden': 'true' }, name, ' ', h('span.key', { text: key }))));
  const tools = h('div.ed-tools', { role: 'toolbar', 'aria-label': 'Tools' }, indicator, toolBtns);
  let currentTool = 'select';
  function renderTool(tool) {
    if (tool) currentTool = tool;
    const idx = Math.max(0, TOOLS.findIndex((t) => t[0] === currentTool));
    toolBtns.forEach((b, i) => setPressed(b, i === idx));
    indicator.style.left = (4 + idx * 38) + 'px';
  }

  // ---- status readout + zoom
  const readout = h('div.ed-readout', { 'aria-live': 'polite', 'data-testid': 'readout' });
  const pct = h('button.ed-zoom-pct.rowbtn', { 'aria-label': 'Reset zoom to 100%', title: 'Reset zoom', onclick: () => actions.zoomReset() });
  const zoom = h('div.ed-zoom', { role: 'group', 'aria-label': 'Zoom' },
    h('button.ibtn', { 'aria-label': 'Zoom out', title: 'Zoom out', onclick: () => actions.zoomOut() }, icon(I.minus, { sw: 2 })),
    pct,
    h('button.ibtn', { 'aria-label': 'Zoom in', title: 'Zoom in', onclick: () => actions.zoomIn() }, icon(I.plus, { sw: 2 })));
  function renderZoom() { pct.textContent = Math.round(engine.getZoom() * 100) + '%'; }

  function renderReadout() {
    const sel = engine.getSelection();
    const c = sel.ids.length === 1 ? engine.getCell(sel.ids[0]) : null;
    let text;
    if (c && c.type === 'shape') {
      text = `${c.label || KIND_NAMES[c.kind] || 'Shape'}  ·  X ${Math.round(c.x)}  Y ${Math.round(c.y)}  ·  ${Math.round(c.w)}×${Math.round(c.h)}`;
    } else if (c && c.type === 'edge') {
      const a = engine.getCell(c.source), b = engine.getCell(c.target);
      text = `Connector  ·  ${(a && a.label) || '?'} → ${(b && b.label) || '?'}`;
    } else if (sel.type === 'multi') {
      text = `${sel.ids.length} selected`;
    } else {
      const all = cells();
      const snap = store.get().snap ? 'snap' : 'free';
      if (all) {
        const n = all.filter((x) => x.type === 'shape').length;
        const m = all.length - n;
        text = `${n} shape${n === 1 ? '' : 's'}  ·  ${m} connector${m === 1 ? '' : 's'}  ·  ${snap}`;
      } else text = snap;
    }
    readout.textContent = text;
  }

  function renderEmpty() { empty.hidden = !engine.isEmpty(); }

  const stage = h('main.ed-stage', { 'aria-label': 'Diagram canvas' },
    canvas, ctxBar, empty, tools, readout, zoom, ctx.toast.host);

  const refresh = () => { renderReadout(); renderEmpty(); placeCtx(); };
  engine.on('change', refresh);
  engine.on('selection', () => { renderReadout(); placeCtx(); });
  engine.on('page', refresh);
  engine.on('zoom', () => { renderZoom(); placeCtx(); });
  engine.on('view', placeCtx);
  engine.on('tool', (t) => renderTool(typeof t === 'string' ? t : t && t.tool));
  store.subscribe((st, prev) => { if (st.snap !== prev.snap) renderReadout(); });
  window.addEventListener('resize', placeCtx);

  renderTool('select');
  renderZoom();
  requestAnimationFrame(refresh);
  ctx.stageEl = stage;
  return stage;
}
