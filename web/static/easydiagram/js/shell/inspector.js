// Right-hand inspector. Three panels (shape, connector, nothing selected),
// each built once per selection and then patched in place on every engine
// 'change', so focus and caret position survive edits.
import { h, s, icon, setPressed, srOnly, segmented, toggleRow, MOD } from './dom.js';
import {
  I, COLORS, EDGE_COLORS, KIND_NAMES, NODE_ANIMS, EDGE_ANIMS, TRIGGERS, SPEEDS,
  NODE_DUR, EDGE_DUR, SPEED_MULT, animName,
} from './defs.js';

const label = (text, wide) => h('span.mono-label' + (wide ? '.wide' : ''), { text });
const sparkTitle = () => h('span.ed-card-title', null,
  s('svg', { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'var(--accent)', 'aria-hidden': 'true' }, s('path', { d: I.spark })),
  ' Animation');

// Commit a text input on Enter or blur, revert on Esc.
function textInput(attrs, onCommit) {
  const input = h('input', { type: 'text', autocomplete: 'off', spellcheck: 'false', ...attrs });
  input.addEventListener('change', () => onCommit(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { e.stopPropagation(); input.value = input.dataset.orig || ''; input.blur(); }
  });
  input.addEventListener('focus', () => { input.dataset.orig = input.value; });
  return input;
}
function setValue(input, v) {
  if (document.activeElement !== input) input.value = v;
}

function nodeAnimVars(id, speed, trigger) {
  const dur = (NODE_DUR[id] || 1) * (SPEED_MULT[speed] || 1);
  return { '--dur': dur.toFixed(2) + 's', '--iter': trigger === 'once' ? '1' : 'infinite' };
}

export function buildInspector(ctx) {
  const { engine, store, actions } = ctx;
  const aside = h('aside.ed-insp', { id: 'ed-insp', 'aria-label': 'Format' });
  let current = null; // {key, update(), el}

  // ================= SHAPE =================
  function shapePanel(id) {
    const get = () => engine.getCell(id);
    const upd = (patch) => engine.update(id, patch);
    const anim = () => Object.assign({ name: 'none', trigger: 'loop', speed: 'normal' }, (get() || {}).anim);
    const setAnim = (p) => upd({ anim: Object.assign(anim(), p) });

    const kindName = label('', true);
    const labelIn = textInput({ 'aria-label': 'Label' }, (v) => upd({ label: v }));
    const head = h('div.ed-group.tight', null, kindName, h('label.field.title', null, srOnly('Label'), labelIn));

    const sw = COLORS.map(([c, name]) => h('button.swatch', { 'aria-label': `Fill ${name}`, 'aria-pressed': 'false', vars: { '--sw': `var(--c-${c})` }, onclick: () => upd({ color: c }) }));
    const fill = h('div.ed-group', null, label('Fill'), h('div.swatches', { role: 'group', 'aria-label': 'Fill' }, sw));

    // animation card
    const replay = h('button.ed-replay.rowbtn', { onclick: () => engine.replay(id) },
      s('svg', { width: 11, height: 11, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': 'true' }, s('path', { d: I.play })), 'Replay');
    const boxes = [];
    const atiles = NODE_ANIMS.map(([aid, alabel]) => {
      const box = h('span.pv-box' + (aid === 'none' ? '' : `.na.na-${aid}`), { vars: aid === 'none' ? null : nodeAnimVars(aid, 'normal', 'loop') });
      boxes.push(box);
      return h('button.ed-atile', { 'aria-pressed': 'false', 'aria-label': `Animation: ${alabel}`, 'data-anim': aid, onclick: () => setAnim({ name: aid }) },
        h('span.pv-wrap', { 'aria-hidden': 'true' }, box), h('span', { text: alabel, 'aria-hidden': 'true' }));
    });
    const trig = segmented(TRIGGERS, (v) => setAnim({ trigger: v }), { cls: 'seg inline', ariaLabel: 'Play' });
    const speed = segmented(SPEEDS, (v) => setAnim({ speed: v }), { cls: 'seg inline', ariaLabel: 'Speed' });
    const animOpts = h('div.ed-group', { hidden: true },
      h('div.ed-opt-row', null, label('Play'), trig.el),
      h('div.ed-opt-row', null, label('Speed'), speed.el));
    const animCard = h('div.ed-card', null,
      h('div.ed-card-head', null, sparkTitle(), replay),
      h('div.ed-atiles', { role: 'group', 'aria-label': 'Animation' }, atiles),
      animOpts);

    const stroke = segmented([1, 1.5, 3].map((v, j) => {
      const line = h('span.stroke-line'); line.style.height = (v * 1.3) + 'px';
      return [v, '', ['Thin', 'Regular', 'Bold'][j] + ' stroke', line];
    }), (v) => upd({ strokeWidth: v }), { ariaLabel: 'Stroke' });
    const strokeG = h('div.ed-group', null, label('Stroke'), stroke.el);

    const opVal = h('span.val');
    const opId = 'ed-op-' + Math.random().toString(36).slice(2, 7);
    const op = h('input', { id: opId, type: 'range', min: '20', max: '100', step: '5' });
    op.addEventListener('input', () => { opVal.textContent = op.value + '%'; });
    op.addEventListener('change', () => upd({ opacity: parseInt(op.value, 10) }));
    const opG = h('div.ed-group.g8', null,
      h('div.ed-opacity-head.mono-label', null, h('label', { for: opId, text: 'Opacity' }), opVal), op);

    const shadow = toggleRow('Soft shadow', () => upd({ shadow: !get().shadow }));

    const connList = h('div.ed-group.g6', { hidden: true });

    const geo = [['X', 'x', -1e9], ['Y', 'y', -1e9], ['W', 'w', 20], ['H', 'h', 20]].map(([k, key, min]) => {
      const input = h('input', { type: 'number', step: '10', 'aria-label': { X: 'X position', Y: 'Y position', W: 'Width', H: 'Height' }[k] });
      input.addEventListener('change', () => {
        const v = parseInt(input.value, 10);
        if (!isNaN(v)) upd({ [key]: Math.max(min, v) });
      });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
      return { key, input, el: h('label.field.geo', null, h('span.k', { text: k, 'aria-hidden': 'true' }), input) };
    });
    const geoG = h('div.ed-group', null, label('Position & size'), h('div.ed-geo', null, geo.map((g) => g.el)));

    const acts = h('div.ed-actions', null,
      h('button.rowbtn', { text: 'Duplicate', title: `Duplicate (${MOD}D)`, onclick: () => actions.duplicate() }),
      h('button.rowbtn.danger', { text: 'Delete', onclick: () => actions.remove() }));

    const el = h('div.ed-panel', { 'data-panel': 'shape' }, head, fill, animCard, strokeG, opG, shadow.el, connList, geoG, acts);

    function update() {
      const c = get();
      if (!c) return;
      const a = anim();
      kindName.textContent = KIND_NAMES[c.kind] || 'Shape';
      setValue(labelIn, c.label || '');
      COLORS.forEach(([col], i) => setPressed(sw[i], c.color === col));
      el.style.setProperty('--pv-stroke', `var(--c-${c.color || 'blue'})`);
      el.style.setProperty('--pv-fill', `var(--f-${c.color || 'blue'})`);
      NODE_ANIMS.forEach(([aid], i) => setPressed(atiles[i], a.name === aid));
      const animated = a.name !== 'none';
      animOpts.hidden = !animated;
      replay.disabled = !animated;
      trig.set(a.trigger);
      speed.set(a.speed);
      stroke.set(c.strokeWidth);
      if (document.activeElement !== op) op.value = String(c.opacity == null ? 100 : c.opacity);
      opVal.textContent = op.value + '%';
      shadow.set(!!c.shadow);
      geo.forEach((g) => setValue(g.input, String(Math.round(c[g.key]))));

      // Connections
      const all = typeof engine.cells === 'function' ? engine.cells() : [];
      const conns = all.filter((e) => e.type === 'edge' && (e.source === id || e.target === id));
      connList.hidden = !conns.length;
      connList.replaceChildren(label('Connections'), ...conns.map((e) => {
        const out = e.source === id;
        const other = engine.getCell(out ? e.target : e.source);
        const name = (other && (other.label || KIND_NAMES[other.kind])) || '?';
        return h('button.ed-conn.rowbtn', { 'data-edge-id': e.id, onclick: () => engine.select([e.id]) },
          icon(out ? I.arrowR : I.arrowL, { size: 15, sw: 2 }),
          h('span.lbl', { text: `${out ? 'To' : 'From'} ${name}` }),
          h('span.pill', { text: animName(EDGE_ANIMS, e.anim && e.anim.name) }));
      }));
    }
    return { el, update };
  }

  // ================= CONNECTOR =================
  function edgePanel(id) {
    const get = () => engine.getCell(id);
    const upd = (patch) => engine.update(id, patch);
    const anim = () => Object.assign({ name: 'none', speed: 'normal', direction: 'normal' }, (get() || {}).anim);
    const setAnim = (p) => upd({ anim: Object.assign(anim(), p) });

    const from = h('span'), to = h('span');
    const labelIn = textInput({ 'aria-label': 'Connector label', placeholder: 'Add a label' }, (v) => upd({ label: v }));
    const head = h('div.ed-group.g6', null,
      label('Connector', true),
      h('div.ed-fromto', null, from, s('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, s('path', { d: I.arrowR })), to),
      h('label.field.title.big', null, srOnly('Connector label'), labelIn));

    const atiles = EDGE_ANIMS.map(([aid, alabel]) => h('button.ed-atile', {
      'aria-pressed': 'false', 'aria-label': `Animation: ${alabel}`, 'data-anim': aid, onclick: () => setAnim({ name: aid }),
    }, edgePreview(aid), h('span', { text: alabel, 'aria-hidden': 'true' })));
    const speed = segmented(SPEEDS, (v) => setAnim({ speed: v }), { cls: 'seg inline', ariaLabel: 'Speed' });
    const dir = segmented([['normal', 'Forward'], ['reverse', 'Reverse']], (v) => setAnim({ direction: v }), { cls: 'seg inline', ariaLabel: 'Direction' });
    const animOpts = h('div.ed-group', { hidden: true },
      h('div.ed-opt-row', null, label('Speed'), speed.el),
      h('div.ed-opt-row', null, label('Direction'), dir.el));
    const animCard = h('div.ed-card', null, sparkTitle(),
      h('div.ed-atiles.edge', { role: 'group', 'aria-label': 'Animation' }, atiles), animOpts);

    const line = segmented([['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted']], (v) => upd({ lineStyle: v }), { ariaLabel: 'Line' });
    const colors = EDGE_COLORS.map(([c, name, css]) => h('button.swatch', { 'aria-label': `${name} connector`, 'aria-pressed': 'false', vars: { '--sw': css }, onclick: () => upd({ color: c }) }));
    const width = segmented([[1.2, 'Thin'], [1.8, 'Regular'], [3, 'Bold']], (v) => upd({ width: v }), { ariaLabel: 'Width' });

    const el = h('div.ed-panel', { 'data-panel': 'edge' }, head, animCard,
      h('div.ed-group', null, label('Line'), line.el),
      h('div.ed-group', null, label('Color'), h('div.swatches', { role: 'group', 'aria-label': 'Connector color' }, colors)),
      h('div.ed-group', null, label('Width'), width.el),
      h('button.ed-del-wide.rowbtn.danger', { text: 'Delete connector', onclick: () => actions.remove() }));

    function update() {
      const e = get();
      if (!e) return;
      const a = anim();
      const sa = engine.getCell(e.source), ta = engine.getCell(e.target);
      from.textContent = (sa && (sa.label || KIND_NAMES[sa.kind])) || '?';
      to.textContent = (ta && (ta.label || KIND_NAMES[ta.kind])) || '?';
      setValue(labelIn, e.label || '');
      EDGE_ANIMS.forEach(([aid], i) => setPressed(atiles[i], a.name === aid));
      animOpts.hidden = a.name === 'none';
      speed.set(a.speed);
      dir.set(a.direction);
      line.set(e.lineStyle || 'solid');
      EDGE_COLORS.forEach(([c], i) => setPressed(colors[i], (e.color || 'default') === c));
      width.set(e.width == null ? 1.8 : e.width);
      // Previews follow the connector's colour, like the prototype.
      const col = (EDGE_COLORS.find((x) => x[0] === e.color) || [0, 0, 'var(--accent)'])[2];
      el.style.setProperty('--pv-edge', e.color && e.color !== 'default' ? col : 'var(--accent)');
    }
    return { el, update };
  }

  // Preview SVG for an edge animation tile (prototype edgeVisual, at Regular width).
  function edgePreview(aid) {
    const ew = 1.8;
    const vars = { '--dur': ((EDGE_DUR[aid] || 1)).toFixed(2) + 's', '--dir': 'normal' };
    const p = (cls, styles, extra) => {
      const el = s('path', Object.assign({ d: 'M6 12 H50', fill: 'none', 'stroke-linecap': 'round', class: cls || null }, extra || {}));
      Object.entries(Object.assign({}, styles, vars)).forEach(([k, v]) => el.style.setProperty(k, v));
      return el;
    };
    const base = p(aid === 'dash' ? 'ea e-dash' : '', { stroke: 'var(--pv-edge, var(--accent))', 'stroke-width': ew + 'px', opacity: aid === 'draw' ? '0.3' : '1' });
    const o1cls = aid === 'flow' ? 'ea e-flow' : aid === 'pulse' ? 'ea e-pulse' : '';
    const o2cls = aid === 'comet' ? 'ea e-comet' : aid === 'draw' ? 'ea e-draw' : '';
    const o1 = p(o1cls, { stroke: 'var(--pv-edge, var(--accent))', 'stroke-width': (aid === 'pulse' ? ew + 7 : ew + 1.8) + 'px', opacity: o1cls ? '1' : '0' });
    const o2 = p(o2cls, { stroke: 'var(--pv-edge, var(--accent))', 'stroke-width': (aid === 'comet' ? ew + 2.2 : ew) + 'px', opacity: o2cls ? '1' : '0' }, { pathLength: '100' });
    const head = s('polygon', { points: '58,12 50,7.5 50,16.5' });
    head.style.fill = 'var(--pv-edge, var(--accent))';
    return s('svg', { width: 64, height: 24, viewBox: '0 0 64 24', 'aria-hidden': 'true' }, base, o1, o2, head);
  }

  // ================= NOTHING SELECTED =================
  function nonePanel() {
    const pageIn = textInput({ 'aria-label': 'Page name' }, (v) => actions.renamePage(v));
    const grid = segmented([['dots', 'Dots'], ['lines', 'Lines'], ['none', 'None']], (v) => actions.setGrid(v), { ariaLabel: 'Canvas grid' });
    const snap = toggleRow('Snap to grid', () => actions.toggleSnap());
    const shortcuts = [['Command palette', MOD + 'K'], ['Select', 'V'], ['Rectangle', 'R'], ['Connector', 'A'], ['Duplicate', MOD + 'D'], ['Undo', MOD + 'Z']];
    const el = h('div.ed-panel', { 'data-panel': 'none' },
      h('div.ed-group.tight', null, label('Page', true), h('label.field.title', null, srOnly('Page name'), pageIn)),
      h('div.ed-group', null, label('Canvas grid'), grid.el),
      snap.el,
      h('div.ed-card.g10', null, label('Shortcuts'),
        shortcuts.map(([l, k]) => h('div.ed-shortcut', null, h('span', { text: l }), h('span.kbd', { text: k })))),
      h('div.ed-hint', null, 'Select a shape or an arrow to style and animate it, or use the ', h('b', { text: '+' }), ' handles on a selected shape to grow the flow.'));
    function update() {
      setValue(pageIn, actions.currentPageName());
      grid.set(store.get().grid);
      snap.set(store.get().snap);
    }
    return { el, update };
  }

  function multiPanel(ids) {
    const count = h('div.ed-multi');
    const el = h('div.ed-panel', { 'data-panel': 'multi' },
      h('div.ed-group.tight', null, label('Selection', true), count),
      h('div.ed-actions', null,
        h('button.rowbtn', { text: 'Duplicate', onclick: () => actions.duplicate() }),
        h('button.rowbtn.danger', { text: 'Delete', onclick: () => actions.remove() })));
    return { el, update() { count.textContent = `${ids.length} items selected`; } };
  }

  function render() {
    const sel = engine.getSelection();
    let key;
    if (sel.type === 'shape' || sel.type === 'edge') key = sel.type + ':' + sel.ids[0];
    else if (sel.type === 'multi') key = 'multi:' + sel.ids.join(',');
    else key = 'none:' + engine.currentPage();
    if (sel.type !== 'none' && sel.ids.length === 1 && !engine.getCell(sel.ids[0])) key = 'none:' + engine.currentPage();
    if (!current || current.key !== key) {
      const [type] = key.split(':');
      const p = type === 'shape' ? shapePanel(sel.ids[0]) : type === 'edge' ? edgePanel(sel.ids[0]) : type === 'multi' ? multiPanel(sel.ids) : nonePanel();
      current = { key, ...p };
      aside.replaceChildren(p.el);
    }
    current.update();
  }

  engine.on('selection', render);
  engine.on('change', render);
  engine.on('page', render);
  store.subscribe((st, prev) => { if (st.grid !== prev.grid || st.snap !== prev.snap) render(); });
  render();
  return aside;
}
