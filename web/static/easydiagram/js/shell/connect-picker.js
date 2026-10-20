// "Connect from …" popover, opened by clicking a shape's connection point
// (or dropping a connector drag on empty canvas, or a dock connector on a
// shape). Its tabs offer the dock's shapes by category, to add one on that
// side already connected, or the page's other shapes to connect to. The
// footer switches the connector preset.
import { h, setPressed } from './dom.js';
import { CONNECTORS, KIND_NAMES } from './defs.js';
import { shapeEntries, connectorArt } from './dock.js';

const TABS = [['basic', 'Basic'], ['flow', 'Flowchart'], ['aws', 'AWS'], ['page', 'On this page']];
const WHERE = { r: 'to the right', l: 'to the left', t: 'above', b: 'below' };
const COLS = 4;

export function buildConnectPicker(ctx) {
  const { engine, store, actions } = ctx;
  const entries = shapeEntries();
  let tab = 'flow'; // the last tab used, for the rest of the session

  const title = h('div.ed-cp-title');
  const sub = h('div.ed-cp-sub');
  const tabBtns = TABS.map(([id, label]) => h('button.ed-cp-tab', {
    role: 'tab', 'aria-selected': 'false', 'data-tab': id, text: label,
    onclick: () => { tab = id; renderBody(); focusFirst(); },
  }));
  const body = h('div.ed-cp-body', { role: 'tabpanel' });
  const conns = CONNECTORS.map((c) => h('button', {
    'aria-pressed': 'false', 'aria-label': `Use ${c.name} connector`, title: c.desc, 'data-connector': c.id,
    onclick: () => actions.setConnector(c.id),
  }, connectorArt(c, 26, 14)));
  const el = h('div.ed-cp', { role: 'dialog', 'aria-label': 'Connect to a shape', hidden: true, 'data-testid': 'connect-picker' },
    h('div.ed-cp-head', null, title, sub),
    h('div.ed-cp-tabs', { role: 'tablist' }, tabBtns),
    body,
    h('div.ed-cp-foot', null, h('span', { text: 'Connector' }), h('div.ed-cp-conns', { role: 'group', 'aria-label': 'Connector style' }, conns)));

  const req = () => store.get().picker;

  function renderBody() {
    const p = req();
    if (!p) return;
    tabBtns.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    body.textContent = '';
    if (tab === 'page') {
      const others = engine.cells().filter((c) => c.type === 'shape' && c.id !== p.sourceId);
      if (!others.length) { body.append(h('p.ed-cp-empty', { text: 'No other shapes on this page yet.' })); return; }
      body.append(h('div.ed-cp-list', null, others.map((c) => h('button.ed-cp-row', {
        'aria-label': `Connect to ${c.label || KIND_NAMES[c.kind]}`, onclick: () => pickExisting(c.id),
      }, h('span', { text: c.label || KIND_NAMES[c.kind] }), h('span.ed-cp-kind', { text: KIND_NAMES[c.kind] || 'Shape' })))));
      return;
    }
    body.append(h('div.ed-cp-grid', null, entries.filter((e) => e.cats.includes(tab)).map((e) => h('button.ed-tile.ed-cp-tile', {
      'aria-label': `Add ${e.full} ${WHERE[p.side]}`, 'data-kind': e.kind, 'data-service': e.props ? e.props.service : null,
      onclick: () => pick(e),
    }, e.art(), h('span.ed-tile-name', { text: e.name })))));
  }

  function pick(e) {
    const p = req();
    if (!p) return;
    actions.closeConnectPicker();
    engine.addConnected(p.sourceId, p.side, {
      kind: e.kind, props: e.props ? Object.assign({}, e.props) : undefined, preset: store.get().connector, at: p.at,
    });
  }

  function pickExisting(id) {
    const p = req();
    if (!p) return;
    actions.closeConnectPicker();
    engine.select([engine.connect(p.sourceId, id, { preset: store.get().connector, sourceSide: p.side })]);
  }

  // preventScroll: focusing mid-animation must not scroll the stage, whose
  // overflow is hidden (it would shift the whole editor sideways on a phone).
  function focusFirst() {
    const b = body.querySelector('button');
    if (b) b.focus({ preventScroll: true });
  }

  // Next to the point it was opened from, on the side the connector leaves
  // by, kept inside the stage.
  function place(p) {
    const stage = el.parentElement;
    if (!stage) return;
    const r = stage.getBoundingClientRect();
    const x = p.client.x - r.left;
    const y = p.client.y - r.top;
    const w = el.offsetWidth;
    const ht = el.offsetHeight;
    let left = p.side === 'l' ? x - w - 16 : x + 16;
    let top = p.side === 't' ? y - ht - 16 : y - 36;
    if (p.side === 'b') { left = x - w / 2; top = y + 16; }
    left = Math.max(8, Math.min(r.width - w - 8, left));
    top = Math.max(8, Math.min(r.height - ht - 8, top));
    el.style.left = left + 'px';
    el.style.top = top + 'px';
  }

  function render(open) {
    const p = req();
    el.hidden = !p;
    if (!p) return;
    const src = engine.getCell(p.sourceId);
    title.textContent = `Connect from “${(src && (src.label || KIND_NAMES[src.kind])) || 'shape'}”`;
    sub.textContent = p.at ? 'Adds the shape where you let go, already connected' : `Adds the shape ${WHERE[p.side]}, already connected`;
    renderBody();
    conns.forEach((b) => setPressed(b, b.dataset.connector === store.get().connector));
    if (open) { place(p); focusFirst(); }
  }

  // Arrow keys move between the choices; Esc closes (and stays here, so it
  // doesn't also clear the selection).
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); actions.closeConnectPicker(); return; }
    const items = Array.from(body.querySelectorAll('button'));
    const i = items.indexOf(document.activeElement);
    if (i < 0) return;
    const grid = !!body.querySelector('.ed-cp-grid');
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: grid ? COLS : 1, ArrowUp: grid ? -COLS : -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = items[Math.max(0, Math.min(items.length - 1, i + step))];
    if (next) next.focus({ preventScroll: true });
  });

  // A press outside closes it (a connection point's own click reopens it).
  document.addEventListener('pointerdown', (e) => {
    if (req() && !el.contains(e.target)) actions.closeConnectPicker();
  }, true);

  engine.on('connect-request', (r) => actions.openConnectPicker(r));
  engine.on('page', () => actions.closeConnectPicker());
  engine.on('change', () => {
    const p = req();
    if (p && !engine.getCell(p.sourceId)) actions.closeConnectPicker();
    else if (p && tab === 'page') renderBody();
  });
  store.subscribe((st, prev) => {
    if (st.picker !== prev.picker) render(!!st.picker);
    else if (st.connector !== prev.connector) conns.forEach((b) => setPressed(b, b.dataset.connector === st.connector));
  });

  return el;
}
