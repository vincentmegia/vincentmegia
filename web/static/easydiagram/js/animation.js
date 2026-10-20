// Easy Diagram animation layer (WP2).
//
// Renders the edAnim* style keys onto the live mxGraph SVG:
// - Shapes: CSS classes (`ed-na ed-na-<name>`, plus `ed-hov` for the hover
//   trigger) and custom properties on the cell's shape group and its label
//   group, so the outline and the label move together. The keyframes live in
//   /static/easydiagram/css/engine.css and match the Precision prototype.
// - Connectors: overlay <path>s appended to the edge's group that copy the
//   rendered line's `d`. Flow and pulse use a plain overlay. Comet and draw use
//   `pathLength="100"` so the dash pattern is relative to the path length.
//   March (`dash`) animates the line itself.
//
// Global pause is a class on the engine container (`ed-paused`).
// `prefers-reduced-motion: reduce` is handled in engine.css, which turns off
// every animation and hides the overlays.
//
// Nothing here touches the model. The file format only carries the style keys.
//
// animateExportSvg writes the same classes and overlays into an exported SVG
// for the animated HTML export (io.js).

const SVG_NS = 'http://www.w3.org/2000/svg';

export const SHAPE_ANIMS = ['none', 'pulse', 'bounce', 'float', 'wiggle', 'glow', 'blink', 'pop'];
export const EDGE_ANIMS = ['none', 'flow', 'dash', 'comet', 'pulse', 'draw'];
export const TRIGGERS = ['loop', 'hover', 'once'];
export const SPEEDS = ['slow', 'normal', 'fast'];

const SHAPE_DUR = { pulse: 1.4, bounce: 1.2, float: 3, wiggle: 1, glow: 1.8, blink: 1.4, pop: 0.7 };
const EDGE_DUR = { flow: 0.8, dash: 0.9, comet: 1.8, pulse: 1.6, draw: 2.4 };
const SPEED_MULT = { slow: 1.8, normal: 1, fast: 0.55 };
const SHAPE_CLASSES = ['ed-na', 'ed-hov', 'ed-hovering'].concat(SHAPE_ANIMS.map((a) => 'ed-na-' + a));

function pick(value, allowed, fallback) {
  return allowed.indexOf(value) >= 0 ? value : fallback;
}

/** Reads the shape animation from a resolved or raw style map. */
export function shapeAnimOf(style) {
  return {
    name: pick(style && style.edAnim, SHAPE_ANIMS, 'none'),
    trigger: pick(style && style.edAnimTrigger, TRIGGERS, 'loop'),
    speed: pick(style && style.edAnimSpeed, SPEEDS, 'normal'),
  };
}

/** Reads the connector animation from a resolved or raw style map. */
export function edgeAnimOf(style) {
  return {
    name: pick(style && style.edAnim, EDGE_ANIMS, 'none'),
    speed: pick(style && style.edAnimSpeed, SPEEDS, 'normal'),
    direction: style && style.edAnimDir === 'reverse' ? 'reverse' : 'normal',
  };
}

/** The shape animation's resolved CSS values, or null for none. */
function shapeAnimSpec(style, accent) {
  const anim = shapeAnimOf(style);
  if (anim.name === 'none') return null;
  return {
    name: anim.name,
    trigger: anim.trigger,
    dur: (SHAPE_DUR[anim.name] * SPEED_MULT[anim.speed]).toFixed(2) + 's',
    iter: anim.trigger === 'once' ? '1' : 'infinite',
    glow: style.strokeColor && style.strokeColor !== 'none' ? style.strokeColor : accent,
  };
}

function addShapeAnim(node, spec) {
  node.classList.add('ed-na', 'ed-na-' + spec.name);
  if (spec.trigger === 'hover') node.classList.add('ed-hov');
  node.style.setProperty('--ed-dur', spec.dur);
  node.style.setProperty('--ed-iter', spec.iter);
  node.style.setProperty('--ed-glow', spec.glow);
}

/** The connector's line: the first visible unfilled path that isn't an overlay. */
function findLinePath(group) {
  const paths = group.querySelectorAll('path');
  for (let i = 0; i < paths.length; i++) {
    const p = paths[i];
    if (p.classList.contains('ed-ea-overlay')) continue;
    if (p.getAttribute('visibility') === 'hidden') continue;
    if (p.getAttribute('fill') !== 'none') continue;
    return p;
  }
  return null;
}

/**
 * Adds the connector animation's classes and overlay paths to an edge group.
 * Overlays go at the group's end, or right after the line with `afterLine`.
 */
function addEdgeAnim(group, line, style, scale, accent, afterLine) {
  const anim = edgeAnimOf(style);
  if (anim.name === 'none') return;

  const ew = (parseFloat(style.strokeWidth) || 1) * scale;
  const custom = style.edColor && style.edColor !== 'default';
  const fx = custom && style.strokeColor ? style.strokeColor : accent;
  const dur = ((EDGE_DUR[anim.name] || 1) * SPEED_MULT[anim.speed]).toFixed(2) + 's';
  const d = line.getAttribute('d');
  const doc = group.ownerDocument;

  const overlay = (cls, width, pathLength) => {
    const p = doc.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('fill', 'none');
    if (pathLength) p.setAttribute('pathLength', '100');
    p.setAttribute('class', 'ed-ea ed-ea-overlay ' + cls);
    p.style.stroke = fx;
    p.style.strokeWidth = width + 'px';
    p.style.setProperty('--ed-dur', dur);
    p.style.setProperty('--ed-dir', anim.direction);
    if (afterLine) line.parentNode.insertBefore(p, line.nextSibling);
    else group.appendChild(p);
    return p;
  };

  if (anim.name === 'dash') {
    line.classList.add('ed-ea', 'ed-e-dash');
    line.style.setProperty('--ed-dur', dur);
    line.style.setProperty('--ed-dir', anim.direction);
  } else if (anim.name === 'flow') {
    overlay('ed-e-flow', ew + 1.8 * scale, false);
  } else if (anim.name === 'pulse') {
    overlay('ed-e-pulse', ew + 7 * scale, false);
  } else if (anim.name === 'comet') {
    overlay('ed-e-comet', ew + 2.2 * scale, true);
  } else if (anim.name === 'draw') {
    line.classList.add('ed-draw-base');
    overlay('ed-e-draw', ew, true);
  }
}

const DRAWN = 'rect, path, ellipse, circle, line, polyline, polygon, image, use';

/**
 * Each wrapped shape's centre in the export's own units: the centre of what
 * the shape draws, leaving out its label (a label's foreignObject spans the
 * whole SVG). Measured on an offscreen copy, since the export isn't in the page.
 */
function measureCentres(root, wraps) {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none;';
  const svg = document.importNode(root, true);
  host.appendChild(svg);
  document.body.appendChild(host);
  try {
    const box = svg.getBoundingClientRect();
    const sx = box.width / (parseFloat(root.getAttribute('width')) || box.width || 1);
    const sy = box.height / (parseFloat(root.getAttribute('height')) || box.height || 1);
    return wraps.map(([id]) => {
      const group = svg.querySelector(`g[data-cell-id="${CSS.escape(id)}"] > .ed-na`);
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      (group ? group.querySelectorAll(DRAWN) : []).forEach((n) => {
        if (n.closest('switch, foreignObject')) return;
        const r = n.getBoundingClientRect();
        if (!r.width && !r.height) return;
        x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top);
        x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
      });
      if (x0 === Infinity) return null;
      return [((x0 + x1) / 2 - box.left) / sx, ((y0 + y1) / 2 - box.top) / sy];
    });
  } finally {
    host.remove();
  }
}

/**
 * Writes the animations into an SVG exported by Graph.getSvg, whose cell
 * groups carry `data-cell-id`. `states` are the mxCellStates drawn into it
 * (their styles are the export's display styles); `scale` is the export
 * scale. A shape's own drawing and label move together inside a new group
 * (child cells stay outside it, as in the editor) around the shape's centre.
 * Returns the number of animated cells.
 */
export function animateExportSvg(root, states, opts) {
  const accent = (opts && opts.accent) || '#4C8DFF';
  const scale = (opts && opts.scale) || 1;
  const groups = {};
  root.querySelectorAll('g[data-cell-id]').forEach((g) => { groups[g.getAttribute('data-cell-id')] = g; });
  const wraps = [];
  let count = 0;
  states.forEach((state) => {
    const group = groups[state.cell.id];
    if (!group) return;
    const style = state.style || {};
    if (state.cell.isEdge()) {
      const line = findLinePath(group);
      if (!line || edgeAnimOf(style).name === 'none') return;
      // Right after the line, so the overlay stays under the arrowheads and label.
      addEdgeAnim(group, line, style, scale, accent, true);
      count++;
      return;
    }
    const spec = shapeAnimSpec(style, accent);
    if (!spec) return;
    const wrap = root.ownerDocument.createElementNS(SVG_NS, 'g');
    Array.from(group.childNodes).forEach((n) => {
      if (!(n.nodeType === 1 && n.hasAttribute('data-cell-id'))) wrap.appendChild(n);
    });
    group.insertBefore(wrap, group.firstChild);
    addShapeAnim(wrap, spec);
    wraps.push([state.cell.id, wrap]);
    count++;
  });
  if (wraps.length) {
    measureCentres(root, wraps).forEach((c, i) => {
      if (c) wraps[i][1].style.transformOrigin = c[0].toFixed(1) + 'px ' + c[1].toFixed(1) + 'px';
    });
  }
  return count;
}

/**
 * createAnimator(graph, {container, accent: () => '#hex'}) returns
 * { apply(state), setMotion(bool), isMotion(), replay(cellId), setHover(state|null), destroy() }.
 */
export function createAnimator(graph, opts) {
  const container = opts.container;
  const accentOf = opts.accent || (() => '#4C8DFF');
  let motion = true;
  let hovered = null; // mxCellState

  function shapeNodes(state) {
    const out = [];
    if (state.shape && state.shape.node) out.push(state.shape.node);
    if (state.text && state.text.node) out.push(state.text.node);
    return out;
  }

  function clearShape(node) {
    SHAPE_CLASSES.forEach((c) => node.classList.remove(c));
    node.style.removeProperty('--ed-dur');
    node.style.removeProperty('--ed-iter');
    node.style.removeProperty('--ed-glow');
    node.style.removeProperty('transform-origin');
    delete node._edAnimKey;
  }

  function applyShape(state, force) {
    const style = state.style || {};
    const nodes = shapeNodes(state);
    // Precision drop shadow: engine.js sets edShadow in the display style.
    if (state.shape && state.shape.node) {
      state.shape.node.classList.toggle('ed-shadow', style.edShadow === '1' || style.edShadow === 1 || style.edShadow === true);
    }
    const spec = shapeAnimSpec(style, accentOf());
    if (!spec) {
      nodes.forEach(clearShape);
      return;
    }
    const cx = state.getCenterX();
    const cy = state.getCenterY();
    const key = [spec.name, spec.trigger, spec.dur, spec.glow].join('|');
    const isHovered = hovered != null && hovered.cell === state.cell;
    nodes.forEach((node) => {
      // Re-adding the same classes would not restart the animation, but
      // changing the name/trigger/speed must, so it starts from a clean slate.
      if (force || node._edAnimKey !== key) {
        clearShape(node);
        if (force) void node.getBoundingClientRect();
        addShapeAnim(node, spec);
        node._edAnimKey = key;
      }
      node.style.transformOrigin = cx.toFixed(1) + 'px ' + cy.toFixed(1) + 'px';
      node.classList.toggle('ed-hovering', isHovered);
    });
  }

  function applyEdge(state) {
    const group = state.shape && state.shape.node;
    if (!group) return;
    group.querySelectorAll('.ed-ea-overlay').forEach((n) => n.remove());
    const line = findLinePath(group);
    if (!line) return;
    line.classList.remove('ed-ea', 'ed-e-dash', 'ed-draw-base');
    line.style.removeProperty('--ed-dur');
    line.style.removeProperty('--ed-dir');
    addEdgeAnim(group, line, state.style || {}, state.view.scale, accentOf());
  }

  function apply(state, force) {
    if (!state || !state.cell) return;
    const model = graph.getModel();
    if (model.isVertex(state.cell)) applyShape(state, force);
    else if (model.isEdge(state.cell)) applyEdge(state);
  }

  function setMotion(on) {
    motion = !!on;
    container.classList.toggle('ed-paused', !motion);
  }

  function replay(cellId) {
    const cell = graph.getModel().getCell(cellId);
    const state = cell ? graph.view.getState(cell) : null;
    if (!state) return false;
    if (graph.getModel().isEdge(cell)) {
      applyEdge(state); // new overlay elements restart from 0
    } else {
      applyShape(state, true);
    }
    return true;
  }

  function setHover(state) {
    if (hovered === state) return;
    const prev = hovered;
    hovered = state;
    if (prev) shapeNodes(prev).forEach((n) => n.classList.remove('ed-hovering'));
    if (state) shapeNodes(state).forEach((n) => { if (n.classList.contains('ed-hov')) n.classList.add('ed-hovering'); });
  }

  return {
    apply,
    setMotion,
    isMotion: () => motion,
    replay,
    setHover,
    destroy() { hovered = null; },
  };
}
