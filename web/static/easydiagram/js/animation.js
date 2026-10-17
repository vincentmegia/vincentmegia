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
    const anim = shapeAnimOf(style);
    const nodes = shapeNodes(state);
    // Precision drop shadow: engine.js sets edShadow in the display style.
    if (state.shape && state.shape.node) {
      state.shape.node.classList.toggle('ed-shadow', style.edShadow === '1' || style.edShadow === 1 || style.edShadow === true);
    }
    if (anim.name === 'none') {
      nodes.forEach(clearShape);
      return;
    }
    const cx = state.getCenterX();
    const cy = state.getCenterY();
    const dur = (SHAPE_DUR[anim.name] * SPEED_MULT[anim.speed]).toFixed(2) + 's';
    const iter = anim.trigger === 'once' ? '1' : 'infinite';
    const glow = style.strokeColor && style.strokeColor !== 'none' ? style.strokeColor : accentOf();
    const key = [anim.name, anim.trigger, dur, glow].join('|');
    const isHovered = hovered != null && hovered.cell === state.cell;
    nodes.forEach((node) => {
      // Re-adding the same classes would not restart the animation, but
      // changing the name/trigger/speed must, so it starts from a clean slate.
      if (force || node._edAnimKey !== key) {
        clearShape(node);
        if (force) void node.getBoundingClientRect();
        node.classList.add('ed-na', 'ed-na-' + anim.name);
        if (anim.trigger === 'hover') node.classList.add('ed-hov');
        node.style.setProperty('--ed-dur', dur);
        node.style.setProperty('--ed-iter', iter);
        node.style.setProperty('--ed-glow', glow);
        node._edAnimKey = key;
      }
      node.style.transformOrigin = cx.toFixed(1) + 'px ' + cy.toFixed(1) + 'px';
      node.classList.toggle('ed-hovering', isHovered);
    });
  }

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

  function applyEdge(state) {
    const group = state.shape && state.shape.node;
    if (!group) return;
    group.querySelectorAll('.ed-ea-overlay').forEach((n) => n.remove());
    const line = findLinePath(group);
    if (!line) return;
    line.classList.remove('ed-ea', 'ed-e-dash', 'ed-draw-base');
    line.style.removeProperty('--ed-dur');
    line.style.removeProperty('--ed-dir');
    const style = state.style || {};
    const anim = edgeAnimOf(style);
    if (anim.name === 'none') return;

    const scale = state.view.scale;
    const ew = (parseFloat(style.strokeWidth) || 1) * scale;
    const custom = style.edColor && style.edColor !== 'default';
    const fx = custom && style.strokeColor ? style.strokeColor : accentOf();
    const dur = ((EDGE_DUR[anim.name] || 1) * SPEED_MULT[anim.speed]).toFixed(2) + 's';
    const d = line.getAttribute('d');

    const overlay = (cls, width, pathLength) => {
      const p = document.createElementNS(SVG_NS, 'path');
      p.setAttribute('d', d);
      p.setAttribute('fill', 'none');
      if (pathLength) p.setAttribute('pathLength', '100');
      p.setAttribute('class', 'ed-ea ed-ea-overlay ' + cls);
      p.style.stroke = fx;
      p.style.strokeWidth = width + 'px';
      p.style.setProperty('--ed-dur', dur);
      p.style.setProperty('--ed-dir', anim.direction);
      group.appendChild(p);
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
