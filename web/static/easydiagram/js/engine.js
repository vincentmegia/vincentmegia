// Easy Diagram engine (WP2): the contract in docs/features/easy-diagram/BUILD.md.
//
// A thin, opinionated wrapper around draw.io's grapheditor `Graph` (mxGraph),
// vendored under /static/easydiagram/vendor (Apache-2.0, see vendor/NOTICE).
// It does not use draw.io's EditorUi/App.
//
// ---------------------------------------------------------------------------
// Classic script load order (easy-diagram.html must load these, in this
// order, as plain <script> tags before the app.js module):
//
//   1. /static/easydiagram/vendor/config.js            globals: nothing is fetched, no resources/stylesheets
//   2. /static/easydiagram/vendor/deflate/base64.js
//   3. /static/easydiagram/vendor/grapheditor/Init.js   DOMPurify config + path globals
//   4. /static/easydiagram/vendor/sanitizer/purify.min.js
//   5. /static/easydiagram/vendor/deflate/pako.min.js   Graph.compress/decompress
//   6. /static/easydiagram/vendor/mxgraph/mxClient.js
//   7. /static/easydiagram/vendor/grapheditor/Editor.js
//   8. /static/easydiagram/vendor/grapheditor/Graph.js
//   9. /static/easydiagram/vendor/grapheditor/Shapes.js
//  10. /static/easydiagram/vendor/grapheditor/stylesheet.js  draw.io's default.xml stylesheet, inlined
//
// and the stylesheet /static/easydiagram/css/engine.css (keyframes, overlays).
//
// CSP: this needs NO 'unsafe-eval'. mxClient's eval sites (mxUtils.eval via
// mxStencil, mxGraphView.getEdgeStyle/getPerimeterFunction, mxObjectCodec,
// mxStylesheetCodec) are all gated by allowEval flags that default to false.
// The only flag defaulting to true, mxStencilRegistry.allowEval (Graph.js,
// dynamic stencil .js packages), is switched off below together with
// mxStencilRegistry.dynamicLoading, so unknown `shape=mxgraph.*` names in an
// opened file never trigger a fetch or an eval. There is no `new Function` or
// string setTimeout in the vendored files.
// ---------------------------------------------------------------------------

import { createAnimator, animateExportSvg, shapeAnimOf, edgeAnimOf, SHAPE_ANIMS, EDGE_ANIMS, TRIGGERS, SPEEDS } from './animation.js';
import { awsService, awsIconDataUri, DEFAULT_AWS_SERVICE } from './aws-icons.js';

/* global Graph, mxGraph, mxGraphModel, mxCodec, mxUtils, mxEvent, mxConstants, mxUndoManager,
   mxRubberband, mxRectangle, mxPoint, mxGeometry, mxCell, mxStencilRegistry, mxVertexHandler,
   mxEdgeHandler, mxClient, mxConnectionConstraint, mxGraphView, Editor, DOMPurify */

// ---------------------------------------------------------------- constants

const COLORS = {
  blue: '#4C8DFF',
  green: '#2BB6A3',
  violet: '#9B87F5',
  pink: '#F0607A',
  amber: '#E5A93B',
  slate: '#8B93A7',
};
const EDGE_COLORS = { blue: '#4C8DFF', green: '#2BB6A3', pink: '#F0607A', amber: '#E5A93B' };
const ACCENT = '#4C8DFF';

const THEMES = {
  dark: { bg: '#0A0B0D', surface: '#111215', surface2: '#1A1C20', ink: '#E6E7EA', ink2: '#8D919B', line: '#23252B', edge: '#8A8F9B', dot: '#2A2D34', major: '#16181C', stage: '#0D0E11', shadow: 'rgba(0,0,0,.5)' },
  light: { bg: '#F4F4F2', surface: '#FFFFFF', surface2: '#F0F0EE', ink: '#141518', ink2: '#5D616B', line: '#E2E2DF', edge: '#6E737E', dot: '#CFD0CC', major: '#ECECE9', stage: '#FAFAF9', shadow: 'rgba(20,21,24,.08)' },
};

const KINDS = {
  rect: { label: 'Process', color: 'blue', w: 150, h: 64 },
  round: { label: 'Step', color: 'blue', w: 150, h: 64 },
  pill: { label: 'Start / End', color: 'slate', w: 150, h: 60 },
  ellipse: { label: 'Event', color: 'green', w: 130, h: 72 },
  diamond: { label: 'Decision', color: 'violet', w: 130, h: 100 },
  para: { label: 'Input', color: 'slate', w: 150, h: 64 },
  hex: { label: 'Prepare', color: 'green', w: 150, h: 64 },
  cyl: { label: 'Database', color: 'slate', w: 110, h: 86 },
  doc: { label: 'Report', color: 'pink', w: 140, h: 80 },
  note: { label: 'New note', color: 'amber', w: 170, h: 100 },
  text: { label: 'Text', color: 'slate', w: 120, h: 40 },
  // An AWS service icon (aws-icons.js); the service is the `service` prop.
  aws: { label: 'Lambda', color: 'slate', w: 64, h: 64 },
};

// Standard draw.io style fragments per kind, so files open in upstream draw.io.
const KIND_STYLE = {
  rect: { rounded: '1', absoluteArcSize: '1', arcSize: '8' },
  round: { rounded: '1', absoluteArcSize: '1', arcSize: '24' },
  pill: { rounded: '1', arcSize: '50' },
  ellipse: { shape: 'ellipse', perimeter: 'ellipsePerimeter' },
  diamond: { shape: 'rhombus', perimeter: 'rhombusPerimeter' },
  para: { shape: 'parallelogram', perimeter: 'parallelogramPerimeter', fixedSize: '1', size: '18' },
  hex: { shape: 'hexagon', perimeter: 'hexagonPerimeter2', fixedSize: '1', size: '16' },
  cyl: { shape: 'cylinder3', boundedLbl: '1', backgroundOutline: '1', size: '10' },
  doc: { shape: 'document', boundedLbl: '1', size: '0.15' },
  note: { shape: 'note', size: '18', flipV: '1', dashed: '1', dashPattern: '4 4', align: 'left', verticalAlign: 'top',
    spacingLeft: '14', spacingTop: '12', spacingRight: '16', fontFamily: 'IBM Plex Mono', fontSize: '12' },
  text: { text: true, strokeColor: 'none', fillColor: 'none' },
  // An image shape with its label underneath, like draw.io's AWS icons.
  aws: { shape: 'image', verticalLabelPosition: 'bottom', labelPosition: 'center', verticalAlign: 'top', align: 'center',
    imageAspect: '0', aspect: 'fixed', fontSize: '12' },
};
// Every key any kind sets, so switching kinds removes the old ones.
const KIND_KEYS = ['rounded', 'absoluteArcSize', 'arcSize', 'shape', 'perimeter', 'fixedSize', 'size', 'boundedLbl',
  'backgroundOutline', 'flipV', 'dashed', 'dashPattern', 'align', 'verticalAlign', 'spacingLeft', 'spacingTop',
  'spacingRight', 'fontFamily', 'fontSize', 'verticalLabelPosition', 'labelPosition', 'imageAspect', 'aspect',
  'image', 'edAws'];

const STROKE_WIDTHS = [1, 1.5, 3];
const EDGE_WIDTHS = [1.2, 1.8, 3];
const LINE_STYLES = ['solid', 'dashed', 'dotted'];
// Which ends of a connector get an arrowhead, and its shape (draw.io marker names).
const ARROW_ENDS = ['end', 'both', 'start', 'none'];
const ARROW_HEADS = { block: { arrow: 'block', fill: '1' }, open: { arrow: 'open', fill: '0' }, oval: { arrow: 'oval', fill: '1' }, diamond: { arrow: 'diamond', fill: '1' } };
const ROUTES = ['elbow', 'straight', 'curved'];
// The dock's connector presets (docs/features/easy-diagram.md, "Connectors").
// Each maps onto keys we already write, so files stay plain draw.io XML.
export const CONNECTOR_PRESETS = {
  arrow: { route: 'elbow', arrows: 'end', lineStyle: 'solid' },
  straight: { route: 'straight', arrows: 'end', lineStyle: 'solid' },
  curved: { route: 'curved', arrows: 'end', lineStyle: 'solid' },
  dashed: { route: 'elbow', arrows: 'end', lineStyle: 'dashed' },
  both: { route: 'elbow', arrows: 'both', lineStyle: 'solid' },
  line: { route: 'elbow', arrows: 'none', lineStyle: 'solid' },
};
const PORT_MODES = ['hover', 'always', 'off'];
// A shape's four connection points, as draw.io exit/entry fractions.
const SIDES = { r: [1, 0.5], l: [0, 0.5], t: [0.5, 0], b: [0.5, 1] };
const OPPOSITE = { r: 'l', l: 'r', t: 'b', b: 't' };
const SIDE_WORD = { r: 'right side', l: 'left side', t: 'top', b: 'bottom' };
// A drop this close (CSS px) to a connection point snaps to that point;
// anywhere else on the shape uses the side facing the source.
const PORT_SNAP = 28;
// Arrowhead size grows with the line so a bold connector doesn't get a pin-head.
function arrowSize(width) { return String(Math.round(7 + (Number(width) || 1.8) * 1.7)); }
const TOOLS = ['select', 'hand', 'connector', 'text', 'rect', 'ellipse', 'diamond', 'note'];
const PLACE_TOOLS = { text: 'text', rect: 'rect', ellipse: 'ellipse', diamond: 'diamond', note: 'note' };
const EVENTS = ['change', 'selection', 'zoom', 'page', 'tool', 'view', 'connect-request'];
const FONT_SANS = "IBM Plex Sans, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const FONT_MONO = "IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const GRID = 10;

// ---------------------------------------------------------------- helpers

function mix(a, b, t) {
  const p = (h) => [1, 3, 5].map((j) => parseInt(h.slice(j, j + 2), 16));
  const x = p(a);
  const y = p(b);
  return '#' + x.map((v, j) => Math.round(v * (1 - t) + y[j] * t).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function tint(stroke, theme) {
  return mix(stroke, THEMES[theme].stage, theme === 'dark' ? 0.86 : 0.91);
}

function accentTokens(theme) {
  const t = THEMES[theme];
  return {
    accent: ACCENT,
    accentText: theme === 'dark' ? mix(ACCENT, '#FFFFFF', 0.25) : mix(ACCENT, '#000000', 0.3),
    accentSoft: mix(ACCENT, t.surface, theme === 'dark' ? 0.84 : 0.9),
  };
}

/** Parses a draw.io style string into [{k, v}] keeping order. Bare tokens get v = null. */
function parseStyle(str) {
  const out = [];
  (str || '').split(';').forEach((part) => {
    if (!part) return;
    const i = part.indexOf('=');
    if (i < 0) out.push({ k: part, v: null });
    else out.push({ k: part.slice(0, i), v: part.slice(i + 1) });
  });
  return out;
}

function styleMap(str) {
  const m = {};
  parseStyle(str).forEach((e) => { m[e.k] = e.v == null ? true : e.v; });
  return m;
}

function serializeStyle(list) {
  return list.map((e) => (e.v == null ? e.k : e.k + '=' + e.v)).join(';') + (list.length ? ';' : '');
}

/** Returns style string with keys set (value null/undefined removes, value true makes a bare token). */
function setStyleKeys(str, patch) {
  const list = parseStyle(str);
  Object.keys(patch).forEach((k) => {
    const v = patch[k];
    const idx = list.findIndex((e) => e.k === k);
    if (v == null || v === false) {
      if (idx >= 0) list.splice(idx, 1);
    } else if (v === true) {
      if (idx < 0) list.unshift({ k, v: null });
    } else if (idx >= 0) {
      list[idx].v = String(v);
    } else {
      list.push({ k, v: String(v) });
    }
  });
  return serializeStyle(list);
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Plain text of an HTML label. DOMParser documents are inert (no scripts, no loads). */
function htmlToText(html) {
  if (html == null) return '';
  const s = String(html);
  if (s.indexOf('<') < 0 && s.indexOf('&') < 0) return s;
  const prepared = s.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(div|p|li)>/gi, '\n');
  const doc = new DOMParser().parseFromString('<!doctype html><body>' + prepared, 'text/html');
  return (doc.body.textContent || '').replace(/\n+$/, '');
}

function textToHtml(text) {
  return escapeHtml(text).replace(/\r?\n/g, '<br>');
}

function round1(v) {
  return Math.round(v * 10) / 10;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function colorNameFromHex(hex, table) {
  if (!hex || typeof hex !== 'string') return null;
  const h = hex.toUpperCase();
  return Object.keys(table).find((k) => table[k].toUpperCase() === h) || null;
}

function guid() {
  if (typeof Editor !== 'undefined' && Editor.guid) return Editor.guid();
  return Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);
}

// -- PNG helpers (own implementation of the PNG chunk format, RFC 2083) --

let crcTable = null;
function crc32(bytes) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/** Inserts a tEXt chunk (keyword, Latin-1 text) before the first IDAT chunk. */
function insertPngText(pngBytes, keyword, text) {
  const enc = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xFF);
  const data = new Uint8Array(keyword.length + 1 + text.length);
  data.set(enc(keyword), 0);
  data[keyword.length] = 0;
  data.set(enc(text), keyword.length + 1);
  const type = enc('tEXt');
  const chunk = new Uint8Array(12 + data.length);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, data.length);
  chunk.set(type, 4);
  chunk.set(data, 8);
  const crcInput = new Uint8Array(4 + data.length);
  crcInput.set(type, 0);
  crcInput.set(data, 4);
  dv.setUint32(8 + data.length, crc32(crcInput));

  // Walk chunks from after the 8-byte signature.
  const src = new DataView(pngBytes.buffer, pngBytes.byteOffset, pngBytes.byteLength);
  let pos = 8;
  while (pos + 8 <= pngBytes.length) {
    const len = src.getUint32(pos);
    const t = String.fromCharCode(pngBytes[pos + 4], pngBytes[pos + 5], pngBytes[pos + 6], pngBytes[pos + 7]);
    if (t === 'IDAT') break;
    pos += 12 + len;
  }
  const out = new Uint8Array(pngBytes.length + chunk.length);
  out.set(pngBytes.subarray(0, pos), 0);
  out.set(chunk, pos);
  out.set(pngBytes.subarray(pos), pos + chunk.length);
  return out;
}

// ---------------------------------------------------------------- engine

let globalsPatched = false;
function patchGlobals() {
  if (globalsPatched) return;
  globalsPatched = true;
  if (typeof Graph === 'undefined' || typeof mxGraph === 'undefined') {
    throw new Error('Easy Diagram engine: vendored scripts are not loaded (see engine.js header for the order).');
  }
  // Never fetch or eval stencil packages named by an opened file.
  mxStencilRegistry.dynamicLoading = false;
  mxStencilRegistry.allowEval = false;
  // No rotation handle and no draw.io custom (yellow) shape handles: the
  // engine draws its own Precision selection frame and resize corners.
  mxVertexHandler.prototype.rotationEnabled = false;
  mxVertexHandler.prototype.createCustomHandles = function () { return null; };
  mxConstants.VERTEX_SELECTION_STROKEWIDTH = 0;
  // Graph.getSvg draws enumeration badges through a diagramly method; the
  // engine never sets `enumerate=1`, so a no-op is equivalent.
  if (typeof mxGraphView.prototype.redrawEnumerationState !== 'function') {
    mxGraphView.prototype.redrawEnumerationState = function () {};
  }
  // Opened files are untrusted and the page promises zero third-party
  // requests: label HTML (sanitized by draw.io through DOMPurify) keeps only
  // data:/blob: sources, loses CSS url()s, and can't pull custom fonts.
  if (typeof DOMPurify !== 'undefined' && DOMPurify.addHook) {
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      ['src', 'srcset', 'poster', 'href', 'xlink:href', 'background'].forEach((a) => {
        if (!node.hasAttribute || !node.hasAttribute(a)) return;
        if ((a === 'href' || a === 'xlink:href') && node.nodeName.toLowerCase() === 'a') return; // links fetch nothing
        if (!isInlineUrl(node.getAttribute(a))) node.removeAttribute(a);
      });
      if (node.hasAttribute && node.hasAttribute('style') && /url\s*\(/i.test(node.getAttribute('style'))) {
        node.setAttribute('style', node.getAttribute('style').replace(/url\s*\(\s*(['"]?)(?!data:|blob:)[^)]*\)/gi, 'none'));
      }
      if (node.removeAttribute) node.removeAttribute('data-font-src');
    });
  }
  // Graph.getSvg appends a "Text is not SVG" link to drawio.com whenever a
  // label uses foreignObject. Exports must carry no third-party links or
  // draw.io branding (BUILD.md decisions 3 and 5), so it is switched off.
  Graph.prototype.addForeignObjectWarning = function () {};
  // Graph.getSvg calls Editor.guid, which lives in draw.io's diagramly layer
  // (not vendored). Same contract: a random id of the given length.
  if (typeof Editor.guid !== 'function') {
    Editor.guid = function (length) {
      const abc = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_';
      const n = length != null ? length : 20;
      const bytes = new Uint8Array(n);
      crypto.getRandomValues(bytes);
      let out = '';
      for (let i = 0; i < n; i++) out += abc.charAt(bytes[i] % abc.length);
      return out;
    };
  }
}

function isInlineUrl(v) {
  return /^\s*(data:|blob:)/i.test(String(v || ''));
}

function applyHandleColors(theme) {
  const t = THEMES[theme];
  mxConstants.HANDLE_FILLCOLOR = t.surface;
  mxConstants.HANDLE_STROKECOLOR = ACCENT;
  mxConstants.VERTEX_SELECTION_COLOR = 'transparent';
  mxConstants.EDGE_SELECTION_COLOR = ACCENT;
  mxConstants.CONNECT_HANDLE_FILLCOLOR = t.surface;
  mxConstants.DEFAULT_VALID_COLOR = ACCENT;
  mxConstants.GUIDE_COLOR = ACCENT;
  mxConstants.OUTLINE_COLOR = ACCENT;
  mxConstants.LABEL_HANDLE_FILLCOLOR = t.surface;
  // Precision connector handles: surface-filled accent rings at the ends,
  // small accent dots on segments (replacing draw.io's cyan hover icons).
  const ring = Graph.createSvgImage(18, 18, `<circle cx="9" cy="9" r="5" fill="${t.surface}" stroke="${ACCENT}" stroke-width="2"/>`);
  const dot = Graph.createSvgImage(14, 14, `<circle cx="7" cy="7" r="3.5" fill="${ACCENT}" stroke="${t.surface}" stroke-width="1.5"/>`);
  mxEdgeHandler.prototype.handleImage = dot;
  mxEdgeHandler.prototype.endHandleImage = ring;
  mxEdgeHandler.prototype.terminalHandleImage = ring;
  mxEdgeHandler.prototype.endTerminalHandleImage = ring;
  mxEdgeHandler.prototype.fixedHandleImage = ring;
  mxEdgeHandler.prototype.endFixedHandleImage = ring;
  mxEdgeHandler.prototype.labelHandleImage = dot;
}

export function createEngine(container, options) {
  if (!container) throw new Error('createEngine: container is required');
  options = options || {};
  patchGlobals();

  let theme = options.theme === 'light' ? 'light' : 'dark';
  let gridMode = ['dots', 'lines', 'none'].indexOf(options.grid) >= 0 ? options.grid : 'dots';
  let snap = options.snap !== false;
  let tool = 'select';
  let preset = 'arrow';
  let portMode = PORT_MODES.indexOf(options.ports) >= 0 ? options.ports : 'hover';
  let hoverCell = null; // shape under (or next to) the pointer: its points show
  let connecting = null; // {source, side, target, tside, x, y} while dragging from a point
  let exporting = false;
  let destroyed = false;
  let suppress = 0; // >0 while switching pages/loading: no undo recording, no 'change'
  const listeners = {};
  EVENTS.forEach((e) => { listeners[e] = new Set(); });

  function emit(name, payload) {
    if (destroyed) return;
    listeners[name].forEach((fn) => {
      try { fn(payload); } catch (err) { console.error(err); }
    });
  }

  // ---- container
  container.classList.add('ed-engine');
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  container.setAttribute('data-ed-theme', theme);

  applyHandleColors(theme);
  const graph = new Graph(container);
  const model = graph.getModel();
  container.style.overflow = 'hidden';
  graph.setAdaptiveColors('none');
  graph.setTooltips(false);
  graph.setDropEnabled(false);
  graph.setAllowLoops(false);
  graph.setAllowDanglingEdges(false);
  graph.setDisconnectOnMove(false);
  graph.setPanning(false);
  graph.setHtmlLabels(true);
  graph.foldingEnabled = false;
  graph.connectionArrowsEnabled = false;
  graph.centerZoom = true;
  graph.gridSize = GRID;
  graph.setGridEnabled(snap);
  graph.isCellResizable = function () { return false; }; // the engine's own corners resize
  graph.isCellRotatable = function () { return false; };
  graph.graphHandler.guidesEnabled = true;
  // Double click edits an existing label only; it never inserts free text.
  graph.dblClick = function (evt, cell) {
    if (this.isEnabled() && cell != null) mxGraph.prototype.dblClick.call(this, evt, cell);
  };
  const rubberband = new mxRubberband(graph);

  // ---- pages
  let pages = [];
  let current = null;

  function makePage(name, root) {
    const r = root || (() => { const c = new mxCell(); c.insert(new mxCell()); return c; })();
    return { id: guid(), name: name || 'Page-' + (pages.length + 1), root: r, undo: new mxUndoManager(200), view: null };
  }

  function activate(page) {
    if (current && current !== page) {
      current.view = { scale: graph.view.scale, x: graph.view.translate.x, y: graph.view.translate.y };
    }
    current = page;
    suppress++;
    try {
      graph.clearSelection();
      if (graph.isEditing()) graph.stopEditing(true);
      model.setRoot(page.root);
      graph.setDefaultParent(null);
    } finally {
      suppress--;
    }
    if (page.view) graph.view.scaleAndTranslate(page.view.scale, page.view.x, page.view.y);
    else fitInternal();
  }

  // ---- undo
  model.addListener(mxEvent.UNDO, (sender, evt) => {
    if (suppress > 0 || !current) return;
    current.undo.undoableEditHappened(evt.getProperty('edit'));
  });
  model.addListener(mxEvent.CHANGE, () => {
    scheduleOverlay();
    if (suppress > 0) return;
    emit('change');
  });

  // ---- theming of cell styles (display only; the file keeps light-theme values)
  function highlightedEdges() {
    const set = new Set();
    graph.getSelectionCells().forEach((c) => {
      if (model.isEdge(c)) set.add(c);
      else if (model.isVertex(c)) (model.getEdges(c) || []).forEach((e) => set.add(e));
    });
    return set;
  }
  let highlight = new Set();

  const basePostProcess = graph.postProcessCellStyle;
  graph.postProcessCellStyle = function (cell, style) {
    style = basePostProcess.apply(this, arguments);
    if (style == null || cell == null) return style;
    const t = THEMES[theme];
    const tok = accentTokens(theme);
    // The file names the Plex family only (upstream-friendly); add fallbacks
    // for display so a missing webfont never drops to the serif default.
    if (style.fontFamily === 'IBM Plex Sans') style.fontFamily = FONT_SANS;
    else if (style.fontFamily === 'IBM Plex Mono') style.fontFamily = FONT_MONO;
    // Never fetch from a file: remote images and font sources are dropped
    // for display (the file keeps them, so upstream draw.io still shows them).
    if (style.image != null && !isInlineUrl(style.image)) delete style.image;
    if (style.fontSource != null) delete style.fontSource;
    if (model.isVertex(cell)) {
      const kind = kindOf(style);
      const colorName = style.edColor && COLORS[style.edColor] ? style.edColor : colorNameFromHex(style.strokeColor, COLORS);
      style.edShadow = exporting ? '0' : (style.shadow == '1' ? '1' : '0');
      if (!exporting) style.shadow = '0';
      if (kind === 'aws') {
        const svc = awsService(style.edAws) || awsService(DEFAULT_AWS_SERVICE);
        // The stroke isn't drawn for an image; it's what the glow animation uses.
        style.strokeColor = svc.color;
        style.fontColor = t.ink;
      } else if (kind === 'text') {
        if (style.edColor || colorName) style.fontColor = t.ink;
      } else if (colorName) {
        style.strokeColor = COLORS[colorName];
        style.fillColor = tint(COLORS[colorName], theme);
        style.fontColor = t.ink;
      }
    } else if (model.isEdge(cell)) {
      const name = style.edColor || colorNameFromHex(style.strokeColor, EDGE_COLORS) || (style.strokeColor ? null : 'default');
      const lit = !exporting && highlight.has(cell);
      if (name === 'default' || name === 'accent' || EDGE_COLORS[name]) {
        style.strokeColor = name === 'default' ? (lit ? tok.accent : t.edge) : name === 'accent' ? tok.accent : EDGE_COLORS[name];
      }
      // Diagrams saved before arrowheads scaled with width kept a 6px head.
      if (style.edColor) {
        if (style.endSize == '6') style.endSize = arrowSize(style.strokeWidth);
        if (style.startSize == '6') style.startSize = arrowSize(style.strokeWidth);
      }
      style.fontColor = lit ? tok.accentText : t.ink2;
      style.labelBackgroundColor = lit && graph.isCellSelected(cell) ? tok.accentSoft : t.surface;
      style.labelBorderColor = lit ? tok.accent : t.line;
    }
    return style;
  };

  function restyle(cells) {
    const list = cells || Object.values(model.cells || {});
    list.forEach((c) => {
      const st = graph.view.getState(c);
      if (st) st.invalidStyle = true;
      // Registers the cell for draw.io's incremental validation.
      graph.view.invalidate(c, false, false);
    });
    graph.view.validate();
  }

  // ---- animation
  const animator = createAnimator(graph, { container, accent: () => ACCENT });
  const baseRedraw = graph.cellRenderer.redraw;
  graph.cellRenderer.redraw = function (state) {
    const r = baseRedraw.apply(this, arguments);
    try { animator.apply(state); } catch (err) { console.error(err); }
    return r;
  };
  animator.setMotion(options.motion !== false);
  graph.addMouseListener({
    mouseDown() {},
    mouseMove(sender, me) {
      const st = me.getState();
      animator.setHover(st && model.isVertex(st.cell) ? st : null);
    },
    mouseUp() {},
  });

  // ---- models
  function kindOf(style) {
    const k = style.edKind;
    if (k && KINDS[k]) return k;
    if (style.edAws) return 'aws';
    const shape = style.shape;
    if (style.text === true || style.text === '1' || shape === 'text') return 'text';
    if (style.ellipse === true || shape === 'ellipse') return 'ellipse';
    if (style.rhombus === true || shape === 'rhombus') return 'diamond';
    if (shape === 'parallelogram') return 'para';
    if (shape === 'hexagon') return 'hex';
    if (shape === 'cylinder3' || shape === 'cylinder') return 'cyl';
    if (shape === 'document') return 'doc';
    if (shape === 'note' || shape === 'note2') return 'note';
    if (style.rounded == '1') {
      if (style.absoluteArcSize != '1' && parseFloat(style.arcSize) >= 50) return 'pill';
      if (style.absoluteArcSize == '1' && parseFloat(style.arcSize) <= 12) return 'rect';
      return 'round';
    }
    return 'rect';
  }

  function labelOf(cell) {
    let v = cell.value;
    if (v != null && mxUtils.isNode(v)) v = v.getAttribute('label');
    if (v == null) return '';
    const st = styleMap(cell.style);
    return st.html == '1' ? htmlToText(v) : String(v);
  }

  function shapeModel(cell) {
    const st = styleMap(cell.style);
    const kind = kindOf(st);
    const geo = cell.geometry || new mxGeometry();
    const color = st.edColor && COLORS[st.edColor] ? st.edColor : colorNameFromHex(st.strokeColor, COLORS) || KINDS[kind].color;
    let sw = parseFloat(st.strokeWidth);
    if (!(sw > 0)) sw = 1;
    let op = parseFloat(st.opacity);
    if (!(op >= 0)) op = 100;
    return {
      id: cell.id,
      type: 'shape',
      kind,
      label: labelOf(cell),
      x: round1(geo.x),
      y: round1(geo.y),
      w: round1(geo.width),
      h: round1(geo.height),
      color,
      strokeWidth: sw,
      opacity: clamp(Math.round(op), 20, 100),
      shadow: st.shadow == '1',
      anim: shapeAnimOf(st),
      ...(kind === 'aws' ? { service: awsService(st.edAws) ? st.edAws : DEFAULT_AWS_SERVICE } : {}),
    };
  }

  function edgeModel(cell) {
    const st = styleMap(cell.style);
    let lineStyle = 'solid';
    if (st.dashed == '1') {
      const dp = String(st.dashPattern || '').split(/\s+/).map(parseFloat);
      lineStyle = dp.length >= 2 && dp[0] <= 1.5 ? 'dotted' : 'dashed';
    }
    let color = 'default';
    if (st.edColor && (st.edColor === 'default' || st.edColor === 'accent' || EDGE_COLORS[st.edColor])) color = st.edColor;
    else color = colorNameFromHex(st.strokeColor, EDGE_COLORS) || 'default';
    let width = parseFloat(st.strokeWidth);
    if (!(width > 0)) width = 1;
    // draw.io draws a classic arrow at the end when endArrow is unset.
    const endA = st.endArrow == null ? 'classic' : String(st.endArrow);
    const startA = st.startArrow == null ? 'none' : String(st.startArrow);
    const hasEnd = endA !== 'none' && endA !== '';
    const hasStart = startA !== 'none' && startA !== '';
    const arrows = hasEnd && hasStart ? 'both' : hasEnd ? 'end' : hasStart ? 'start' : 'none';
    const marker = hasEnd ? endA : hasStart ? startA : 'block';
    const head = /^open/.test(marker) ? 'open' : marker === 'oval' || marker === 'dot' ? 'oval' : /^diamond/.test(marker) ? 'diamond' : 'block';
    const orth = st.edgeStyle != null && st.edgeStyle !== 'none' && st.edgeStyle !== '';
    const route = st.curved == '1' ? 'curved' : orth ? 'elbow' : 'straight';
    return {
      id: cell.id,
      type: 'edge',
      source: cell.source ? cell.source.id : null,
      target: cell.target ? cell.target.id : null,
      label: labelOf(cell),
      lineStyle,
      color,
      width,
      arrows,
      head,
      route,
      anim: edgeAnimOf(st),
    };
  }

  function cellModel(cell) {
    if (!cell) return null;
    if (model.isVertex(cell)) return shapeModel(cell);
    if (model.isEdge(cell)) return edgeModel(cell);
    return null;
  }

  // Style builders ---------------------------------------------------------

  function awsStyle(service) {
    const id = awsService(service) ? service : DEFAULT_AWS_SERVICE;
    let s = 'whiteSpace=wrap;html=1;';
    s = setStyleKeys(s, KIND_STYLE.aws);
    return setStyleKeys(s, {
      edKind: 'aws',
      edAws: id,
      image: awsIconDataUri(id),
      fontFamily: 'IBM Plex Sans',
      fontColor: THEMES.light.ink,
    });
  }

  function shapeStyle(kind, colorName, extra) {
    if (kind === 'aws') return awsStyle(extra && extra.edAws);
    const c = COLORS[colorName] || COLORS.blue;
    let s = 'whiteSpace=wrap;html=1;';
    const ks = KIND_STYLE[kind];
    Object.keys(ks).forEach((k) => { s = setStyleKeys(s, { [k]: ks[k] }); });
    const base = {
      edKind: kind,
      edColor: colorName,
      fontFamily: ks.fontFamily || 'IBM Plex Sans',
      fontSize: ks.fontSize || (kind === 'diamond' ? '12' : '13'),
      fontColor: THEMES.light.ink,
      strokeWidth: kind === 'note' ? '1' : '1.5',
      shadow: kind === 'text' ? null : '1',
    };
    if (kind !== 'text') {
      base.strokeColor = c;
      base.fillColor = tint(c, 'light');
    }
    s = setStyleKeys(s, base);
    if (extra) s = setStyleKeys(s, extra);
    return s;
  }

  function edgeStyle(colorName, extra) {
    let s = 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;';
    s = setStyleKeys(s, {
      strokeWidth: '1.8',
      fontFamily: 'IBM Plex Mono',
      fontSize: '11',
      fontColor: THEMES.light.ink2,
      labelBackgroundColor: THEMES.light.surface,
      labelBorderColor: THEMES.light.line,
    });
    s = setStyleKeys(s, edgeColorKeys(colorName || 'default'));
    s = setStyleKeys(s, arrowKeys('end', 'block', 1.8));
    if (extra) s = setStyleKeys(s, extra);
    return s;
  }

  function arrowKeys(ends, head, width) {
    const hd = ARROW_HEADS[head] || ARROW_HEADS.block;
    const size = arrowSize(width);
    const atEnd = ends === 'end' || ends === 'both';
    const atStart = ends === 'start' || ends === 'both';
    return {
      endArrow: atEnd ? hd.arrow : 'none', endFill: atEnd ? hd.fill : null, endSize: atEnd ? size : null,
      startArrow: atStart ? hd.arrow : 'none', startFill: atStart ? hd.fill : null, startSize: atStart ? size : null,
    };
  }

  function routeKeys(route) {
    if (route === 'straight') return { edgeStyle: 'none', curved: null };
    return { edgeStyle: 'orthogonalEdgeStyle', orthogonalLoop: '1', jettySize: 'auto', curved: route === 'curved' ? '1' : null };
  }

  function presetKeys(name, width) {
    const p = CONNECTOR_PRESETS[name] || CONNECTOR_PRESETS.arrow;
    return Object.assign({}, routeKeys(p.route), lineStyleKeys(p.lineStyle), arrowKeys(p.arrows, 'block', width || 1.8));
  }

  function sidePoint(g, side) {
    return { x: g.x + g.width * SIDES[side][0], y: g.y + g.height * SIDES[side][1] };
  }

  function nearestSide(g, p) {
    let best = 'l';
    let bd = Infinity;
    Object.keys(SIDES).forEach((k) => {
      const q = sidePoint(g, k);
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < bd) { bd = d; best = k; }
    });
    return best;
  }

  function portKeys(exit, entry) {
    return {
      exitX: SIDES[exit][0], exitY: SIDES[exit][1], exitDx: 0, exitDy: 0,
      entryX: SIDES[entry][0], entryY: SIDES[entry][1], entryDx: 0, entryDy: 0,
    };
  }

  function edgeColorKeys(name) {
    return {
      edColor: name,
      strokeColor: name === 'default' ? THEMES.light.edge : name === 'accent' ? ACCENT : EDGE_COLORS[name],
    };
  }

  function shapeAnimKeys(anim) {
    const a = Object.assign({ name: 'none', trigger: 'loop', speed: 'normal' }, anim || {});
    if (a.name === 'none' || SHAPE_ANIMS.indexOf(a.name) < 0) return { edAnim: null, edAnimTrigger: null, edAnimSpeed: null };
    return {
      edAnim: a.name,
      edAnimTrigger: TRIGGERS.indexOf(a.trigger) >= 0 ? a.trigger : 'loop',
      edAnimSpeed: SPEEDS.indexOf(a.speed) >= 0 ? a.speed : 'normal',
    };
  }

  function edgeAnimKeys(anim) {
    const a = Object.assign({ name: 'none', speed: 'normal', direction: 'normal' }, anim || {});
    if (a.name === 'none' || EDGE_ANIMS.indexOf(a.name) < 0) return { edAnim: null, edAnimSpeed: null, edAnimDir: null };
    return {
      edAnim: a.name,
      edAnimSpeed: SPEEDS.indexOf(a.speed) >= 0 ? a.speed : 'normal',
      edAnimDir: a.direction === 'reverse' ? 'reverse' : 'normal',
    };
  }

  function lineStyleKeys(ls) {
    if (ls === 'dashed') return { dashed: '1', dashPattern: '4 3' };
    if (ls === 'dotted') return { dashed: '1', dashPattern: '1 3' };
    return { dashed: null, dashPattern: null };
  }

  // Picks exit/entry ports from the shapes' relative position, like the
  // prototype: side by side -> right/left; otherwise leave from the top or
  // bottom and enter from the side facing the source (or top/bottom when the
  // shapes are stacked). Two edges from one diamond to targets above and below
  // then leave from different ports instead of sharing a segment.
  function autoPorts(a, b) {
    if (!a || !b) return {};
    const P = { r: [1, 0.5], l: [0, 0.5], t: [0.5, 0], b: [0.5, 1] };
    const vOverlap = a.y < b.y + b.height && b.y < a.y + a.height;
    const hGap = b.x >= a.x + a.width ? 'r' : b.x + b.width <= a.x ? 'l' : null;
    let exit;
    let entry;
    const opp = { r: 'l', l: 'r', t: 'b', b: 't' };
    if (vOverlap && hGap) {
      exit = hGap;
      entry = opp[hGap];
    } else if (hGap === 'l' && b.y + b.height <= a.y) {
      // Loop back to an earlier step above-left (e.g. "Retry"): run
      // underneath, bottom to bottom, like the prototype.
      exit = 'b';
      entry = 'b';
    } else {
      exit = b.y + b.height / 2 < a.y + a.height / 2 ? 't' : 'b';
      entry = hGap ? opp[hGap] : opp[exit];
    }
    return { exitX: P[exit][0], exitY: P[exit][1], exitDx: 0, exitDy: 0, entryX: P[entry][0], entryY: P[entry][1], entryDx: 0, entryDy: 0 };
  }

  function setLabel(cell, text) {
    const html = textToHtml(text == null ? '' : text);
    const v = cell.value;
    if (v != null && mxUtils.isNode(v)) {
      const clone = v.cloneNode(true);
      clone.setAttribute('label', html);
      model.setValue(cell, clone);
    } else {
      model.setValue(cell, html);
    }
    if (styleMap(cell.style).html != '1') model.setStyle(cell, setStyleKeys(cell.style, { html: '1' }));
  }

  function applyShapePatch(cell, patch) {
    let style = cell.style || '';
    const cur = shapeModel(cell);
    if (cur.kind === 'aws' && patch.service && awsService(patch.service) && patch.service !== cur.service) {
      style = setStyleKeys(style, { edAws: patch.service, image: awsIconDataUri(patch.service) });
      // Follow the service name unless the user renamed the shape.
      if (patch.label == null && cur.label === awsService(cur.service).label) patch = Object.assign({}, patch, { label: awsService(patch.service).label });
    }
    // An AWS icon can't turn into an outline shape (or back): it has no fill or stroke to keep.
    if (patch.kind && KINDS[patch.kind] && patch.kind !== cur.kind && patch.kind !== 'aws' && cur.kind !== 'aws') {
      const removed = {};
      KIND_KEYS.forEach((k) => { removed[k] = null; });
      ['ellipse', 'rhombus', 'text'].forEach((k) => { removed[k] = null; });
      style = setStyleKeys(style, removed);
      const ks = KIND_STYLE[patch.kind];
      style = setStyleKeys(style, Object.assign({}, ks, { edKind: patch.kind }));
      style = setStyleKeys(style, {
        fontFamily: ks.fontFamily || 'IBM Plex Sans',
        fontSize: ks.fontSize || (patch.kind === 'diamond' ? '12' : '13'),
      });
      if (patch.kind !== 'text' && cur.kind === 'text') {
        const c = COLORS[cur.color] || COLORS.blue;
        style = setStyleKeys(style, { strokeColor: c, fillColor: tint(c, 'light'), shadow: '1' });
      }
    }
    if (patch.color && COLORS[patch.color] && cur.kind !== 'aws') {
      const kind = patch.kind && KINDS[patch.kind] ? patch.kind : cur.kind;
      const c = COLORS[patch.color];
      style = setStyleKeys(style, kind === 'text' ? { edColor: patch.color } :
        { edColor: patch.color, strokeColor: c, fillColor: tint(c, 'light'), fontColor: THEMES.light.ink });
    }
    if (patch.strokeWidth != null && STROKE_WIDTHS.indexOf(Number(patch.strokeWidth)) >= 0) {
      style = setStyleKeys(style, { strokeWidth: String(Number(patch.strokeWidth)) });
    }
    if (patch.opacity != null && isFinite(patch.opacity)) {
      const o = clamp(Math.round(Number(patch.opacity)), 20, 100);
      style = setStyleKeys(style, o === 100 ? { opacity: null, textOpacity: null } : { opacity: o, textOpacity: o });
    }
    if (patch.shadow != null) style = setStyleKeys(style, { shadow: patch.shadow ? '1' : null });
    if (patch.anim) style = setStyleKeys(style, shapeAnimKeys(Object.assign({}, cur.anim, patch.anim)));
    if (style !== cell.style) model.setStyle(cell, style);

    if (['x', 'y', 'w', 'h'].some((k) => patch[k] != null && isFinite(patch[k]))) {
      const geo = (cell.geometry || new mxGeometry()).clone();
      if (patch.x != null && isFinite(patch.x)) geo.x = Number(patch.x);
      if (patch.y != null && isFinite(patch.y)) geo.y = Number(patch.y);
      if (patch.w != null && isFinite(patch.w)) geo.width = Math.max(10, Number(patch.w));
      if (patch.h != null && isFinite(patch.h)) geo.height = Math.max(10, Number(patch.h));
      model.setGeometry(cell, geo);
    }
    if (patch.label != null && patch.label !== cur.label) setLabel(cell, patch.label);
  }

  function applyEdgePatch(cell, patch) {
    let style = cell.style || '';
    const cur = edgeModel(cell);
    if (patch.lineStyle && LINE_STYLES.indexOf(patch.lineStyle) >= 0) style = setStyleKeys(style, lineStyleKeys(patch.lineStyle));
    if (patch.color && (patch.color === 'default' || patch.color === 'accent' || EDGE_COLORS[patch.color])) {
      style = setStyleKeys(style, edgeColorKeys(patch.color));
    }
    const width = patch.width != null && EDGE_WIDTHS.indexOf(Number(patch.width)) >= 0 ? Number(patch.width) : null;
    if (width != null) style = setStyleKeys(style, { strokeWidth: String(width) });
    const arrows = ARROW_ENDS.indexOf(patch.arrows) >= 0 ? patch.arrows : null;
    const head = ARROW_HEADS[patch.head] ? patch.head : null;
    // Width resizes the heads, so any of the three rewrites the arrow keys.
    if (arrows || head || width != null) style = setStyleKeys(style, arrowKeys(arrows || cur.arrows, head || cur.head, width != null ? width : cur.width));
    if (ROUTES.indexOf(patch.route) >= 0 && patch.route !== cur.route) style = setStyleKeys(style, routeKeys(patch.route));
    if (patch.anim) style = setStyleKeys(style, edgeAnimKeys(Object.assign({}, cur.anim, patch.anim)));
    if (style !== cell.style) model.setStyle(cell, style);
    if (patch.source != null) {
      const s = model.getCell(patch.source);
      if (s && model.isVertex(s) && s !== cell.source) model.setTerminal(cell, s, true);
    }
    if (patch.target != null) {
      const t = model.getCell(patch.target);
      if (t && model.isVertex(t) && t !== cell.target) model.setTerminal(cell, t, false);
    }
    if (patch.label != null && patch.label !== cur.label) setLabel(cell, patch.label);
  }

  function edit(fn) {
    let result;
    model.beginUpdate();
    try {
      result = fn();
    } finally {
      model.endUpdate();
    }
    return result;
  }

  function vertices() {
    const out = [];
    const walk = (cell) => {
      const n = model.getChildCount(cell);
      for (let i = 0; i < n; i++) {
        const c = model.getChildAt(cell, i);
        if (model.isVertex(c)) out.push(c);
        walk(c);
      }
    };
    walk(model.getRoot());
    return out;
  }

  function allCells() {
    const out = [];
    const walk = (cell) => {
      const n = model.getChildCount(cell);
      for (let i = 0; i < n; i++) {
        const c = model.getChildAt(cell, i);
        if (model.isVertex(c) || model.isEdge(c)) out.push(c);
        walk(c);
      }
    };
    walk(model.getRoot());
    return out;
  }

  // ---- geometry helpers
  function viewportModelRect() {
    const s = graph.view.scale;
    const t = graph.view.translate;
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;
    return { x: -t.x, y: -t.y, w: w / s, h: h / s };
  }

  function overlaps(x, y, w, h, margin, ignore) {
    return vertices().some((v) => {
      if (ignore && ignore.indexOf(v) >= 0) return false;
      const g = v.geometry;
      if (!g || g.relative) return false;
      return x < g.x + g.width + margin && x + w + margin > g.x && y < g.y + g.height + margin && y + h + margin > g.y;
    });
  }

  function snapV(v) {
    return snap ? Math.round(v / GRID) * GRID : Math.round(v);
  }

  function freeSpot(w, h) {
    const vp = viewportModelRect();
    const step = 20;
    const x0 = snapV(vp.x + 40);
    const y0 = snapV(vp.y + 40);
    for (let y = y0; y + h <= vp.y + vp.h - 20; y += step) {
      for (let x = x0; x + w <= vp.x + vp.w - 20; x += step) {
        if (!overlaps(x, y, w, h, 24)) return { x, y };
      }
    }
    // Viewport is full: place below everything.
    let maxY = -Infinity;
    let minX = Infinity;
    vertices().forEach((v) => {
      const g = v.geometry;
      if (g) { maxY = Math.max(maxY, g.y + g.height); minX = Math.min(minX, g.x); }
    });
    if (!isFinite(maxY)) return { x: x0, y: y0 };
    return { x: snapV(minX), y: snapV(maxY + 40) };
  }

  // ---- selection + overlays
  const overlay = document.createElement('div');
  overlay.className = 'ed-overlay';
  container.appendChild(overlay);
  const stopEvents = ['pointerdown', 'mousedown', 'touchstart', 'dblclick'];
  stopEvents.forEach((name) => overlay.addEventListener(name, (e) => {
    if (e.target !== overlay) e.stopPropagation();
  }));

  let overlayRaf = 0;
  function scheduleOverlay() {
    if (overlayRaf || destroyed) return;
    overlayRaf = requestAnimationFrame(() => {
      overlayRaf = 0;
      renderOverlay();
    });
  }

  let resizing = null;

  function renderOverlay() {
    if (destroyed || resizing) return;
    overlay.textContent = '';
    if (exporting) { syncPorts([]); return; }
    const sel = graph.getSelectionCells().filter((c) => model.isVertex(c));
    const single = sel.length === 1 && graph.getSelectionCount() === 1;
    sel.forEach((cell) => {
      const st = graph.view.getState(cell);
      if (!st) return;
      const b = { x: st.x, y: st.y, w: st.width, h: st.height };
      const frame = document.createElement('div');
      frame.className = 'ed-frame';
      frame.dataset.cellId = cell.id;
      frame.style.left = (b.x - 6) + 'px';
      frame.style.top = (b.y - 6) + 'px';
      frame.style.width = (b.w + 12) + 'px';
      frame.style.height = (b.h + 12) + 'px';
      if (single) {
        ['nw', 'ne', 'sw', 'se'].forEach((c) => {
          const k = document.createElement('span');
          k.className = 'ed-corner';
          k.dataset.c = c;
          k.setAttribute('aria-hidden', 'true');
          k.addEventListener('pointerdown', (e) => startResize(e, cell, c));
          frame.appendChild(k);
        });
      }
      overlay.appendChild(frame);
    });
    syncPorts(portCells(sel, single));
  }

  // ---- connection points
  // Which shapes show their points: every shape while connecting (or with
  // the connector tool, or "Always"); otherwise the hovered and the selected
  // shape, unless points are turned off.
  function portCells(sel, single) {
    if (graph.isEditing() || pan) return [];
    if (connecting || tool === 'connector' || portMode === 'always') return vertices();
    if (portMode === 'off' || tool !== 'select') return [];
    const out = new Set();
    if (single) out.add(sel[0]);
    if (hoverCell && model.contains(hoverCell)) out.add(hoverCell);
    return Array.from(out);
  }

  // Screen point (CSS px, container-relative) of a shape's connection point.
  // On a shape with its label underneath (AWS icons) the bottom point sits
  // below the label, so it never covers the text.
  function portScreen(st, side) {
    const p = { x: st.x + st.width * SIDES[side][0], y: st.y + st.height * SIDES[side][1] };
    if (side === 'b' && st.style && st.style.verticalLabelPosition === 'bottom' && st.text && st.text.boundingBox) {
      p.y = Math.max(p.y, st.text.boundingBox.y + st.text.boundingBox.height + 6);
    }
    return p;
  }

  // Connection points live in their own layer and are kept across redraws
  // (moved, not rebuilt), so focus, hover and their fade-in survive.
  const portLayer = document.createElement('div');
  portLayer.className = 'ed-overlay ed-ports';
  container.appendChild(portLayer);
  stopEvents.forEach((name) => portLayer.addEventListener(name, (e) => {
    if (e.target !== portLayer) e.stopPropagation();
  }));
  const ports = new Map(); // cellId:side -> button

  function syncPorts(cells) {
    const keep = new Set();
    cells.forEach((cell) => {
      const st = graph.view.getState(cell);
      if (!st) return;
      const name = labelOf(cell) || 'shape';
      Object.keys(SIDES).forEach((side) => {
        const key = cell.id + ':' + side;
        keep.add(key);
        let btn = ports.get(key);
        if (!btn) {
          btn = makePort(cell, side);
          ports.set(key, btn);
          portLayer.appendChild(btn);
        }
        const p = portScreen(st, side);
        btn.style.left = p.x + 'px';
        btn.style.top = p.y + 'px';
        btn.setAttribute('aria-label', `Connect from the ${SIDE_WORD[side]} of ${name}`);
        if (connecting && connecting.source === cell && connecting.side === side) btn.dataset.active = '1';
        else delete btn.dataset.active;
      });
    });
    ports.forEach((btn, key) => {
      if (!keep.has(key)) { btn.remove(); ports.delete(key); }
    });
  }

  function makePort(cell, side) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ed-port';
    btn.dataset.side = side;
    btn.dataset.cellId = cell.id;
    btn.title = 'Click to add a connected shape, or drag to another shape';
    const request = () => {
      const r = btn.getBoundingClientRect();
      emit('connect-request', { sourceId: cell.id, side, client: { x: r.left + r.width / 2, y: r.top + r.height / 2 }, at: null });
    };
    // A press without a drag is handled on pointerup (WebKit sends no
    // click after a touch tap whose pointerdown was cancelled); click
    // covers the keyboard.
    btn.addEventListener('pointerdown', (e) => startConnect(e, cell, side, request));
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!portClickSuppressed) request();
    });
    return btn;
  }

  // The topmost shape whose bounds (its label included), grown by `margin`
  // CSS px, contain the client point.
  function cellNear(clientX, clientY, margin, except) {
    const r = container.getBoundingClientRect();
    const x = clientX - r.left;
    const y = clientY - r.top;
    const vs = vertices();
    for (let i = vs.length - 1; i >= 0; i--) {
      const c = vs[i];
      if (c === except) continue;
      const st = graph.view.getState(c);
      if (!st) continue;
      let x1 = st.x, y1 = st.y, x2 = st.x + st.width, y2 = st.y + st.height;
      const tb = st.text && st.text.boundingBox;
      if (tb && st.style && st.style.verticalLabelPosition === 'bottom') {
        x1 = Math.min(x1, tb.x); x2 = Math.max(x2, tb.x + tb.width); y2 = Math.max(y2, tb.y + tb.height);
      }
      if (x >= x1 - margin && x <= x2 + margin && y >= y1 - margin && y <= y2 + margin) return c;
    }
    return null;
  }

  // The connection point of `cell` within PORT_SNAP of the client point, or null.
  function portAt(cell, clientX, clientY) {
    const st = graph.view.getState(cell);
    if (!st) return null;
    const r = container.getBoundingClientRect();
    let best = null;
    let bd = PORT_SNAP;
    Object.keys(SIDES).forEach((side) => {
      const p = portScreen(st, side);
      const d = Math.hypot(p.x - (clientX - r.left), p.y - (clientY - r.top));
      if (d <= bd) { bd = d; best = side; }
    });
    return best;
  }

  // Side of `target` a connector from `source` should enter: the point under
  // the pointer when it's near one, else the side facing the source's point.
  // Null when neither end is pinned (connector tool, dropped mid-shape):
  // connect() then picks both sides with autoPorts.
  function targetSide(source, side, target, clientX, clientY) {
    const near = portAt(target, clientX, clientY);
    if (near) return near;
    return side ? nearestSide(target.geometry, sidePoint(source.geometry, side)) : null;
  }

  function onHover(e) {
    if (connecting || pan || e.pointerType === 'touch') return;
    const c = tool === 'select' ? cellNear(e.clientX, e.clientY, PORT_SNAP / 2) : null;
    if (c !== hoverCell) {
      hoverCell = c;
      scheduleOverlay();
    }
  }
  function onHoverLeave() {
    if (hoverCell && !connecting) {
      hoverCell = null;
      scheduleOverlay();
    }
  }

  // Dashed accent preview of the connector being dragged, with a ring on the
  // point it will snap to. Its own layer, so overlay re-renders don't drop it.
  const previewLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  previewLayer.setAttribute('class', 'ed-connect-preview');
  previewLayer.setAttribute('aria-hidden', 'true');
  container.appendChild(previewLayer);

  function svgEl(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs).forEach((k) => el.setAttribute(k, attrs[k]));
    return el;
  }

  function drawPreview() {
    previewLayer.textContent = '';
    if (!connecting) return;
    const c = connecting;
    const r = container.getBoundingClientRect();
    const sst = graph.view.getState(c.source);
    if (!sst) return;
    const tst = c.target ? graph.view.getState(c.target) : null;
    const tside = tst ? c.tside || nearestSide(c.target.geometry, { x: c.source.geometry.getCenterX(), y: c.source.geometry.getCenterY() }) : null;
    const end = tst ? portScreen(tst, tside) : { x: c.x - r.left, y: c.y - r.top };
    let side = c.side;
    if (!side) {
      // Connector tool: leave from the side facing the pointer (or target).
      const s = graph.view.scale;
      const t = graph.view.translate;
      side = nearestSide(c.source.geometry, { x: end.x / s - t.x, y: end.y / s - t.y });
    }
    const a = portScreen(sst, side);
    const n = SIDES[side];
    const out = { x: a.x + (n[0] - 0.5) * 2 * 18, y: a.y + (n[1] - 0.5) * 2 * 18 };
    const horizontal = side === 'l' || side === 'r';
    const d = horizontal
      ? `M${a.x} ${a.y}L${out.x} ${out.y}L${(out.x + end.x) / 2} ${out.y}L${(out.x + end.x) / 2} ${end.y}L${end.x} ${end.y}`
      : `M${a.x} ${a.y}L${out.x} ${out.y}L${out.x} ${(out.y + end.y) / 2}L${end.x} ${(out.y + end.y) / 2}L${end.x} ${end.y}`;
    previewLayer.appendChild(svgEl('path', { class: 'ed-connect-line', d }));
    const ang = Math.atan2(end.y - (horizontal ? end.y : (out.y + end.y) / 2), end.x - (horizontal ? (out.x + end.x) / 2 : end.x));
    const hx = (k, s) => end.x - 9 * Math.cos(ang + k) * s;
    const hy = (k, s) => end.y - 9 * Math.sin(ang + k) * s;
    previewLayer.appendChild(svgEl('path', { class: 'ed-connect-head', d: `M${end.x} ${end.y}L${hx(0.45, 1)} ${hy(0.45, 1)}L${hx(-0.45, 1)} ${hy(-0.45, 1)}Z` }));
    if (tst) {
      previewLayer.appendChild(svgEl('circle', { class: 'ed-connect-snap', cx: end.x, cy: end.y, r: 11 }));
      previewLayer.appendChild(svgEl('circle', { class: 'ed-connect-dot', cx: end.x, cy: end.y, r: 4.5 }));
    }
  }

  let portClickSuppressed = false;

  // Drag from a connection point (side given) or, with the connector tool,
  // from anywhere on a shape (side null: chosen when it's dropped).
  // Dropped on a shape: connects, snapping to the nearest point. Dropped on
  // empty canvas: asks the shell to pick a shape to add there. A press
  // that never moves runs onTap instead.
  function startConnect(e, cell, side, onTap) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const sx = e.clientX;
    const sy = e.clientY;
    const id = e.pointerId;
    let moved = false;
    const move = (ev) => {
      if (ev.pointerId !== id) return;
      if (!moved) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
        moved = true;
        connecting = { source: cell, side, target: null, tside: null, x: ev.clientX, y: ev.clientY };
        container.classList.add('ed-connecting');
        renderOverlay();
      }
      const t = cellNear(ev.clientX, ev.clientY, 6, cell);
      connecting.x = ev.clientX;
      connecting.y = ev.clientY;
      connecting.target = t;
      connecting.tside = t ? targetSide(cell, side, t, ev.clientX, ev.clientY) : null;
      drawPreview();
    };
    const stop = () => {
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', cancel, true);
      window.removeEventListener('keydown', key, true);
    };
    // The release's own click (if the browser sends one) is already handled.
    const suppressClick = () => {
      portClickSuppressed = true;
      setTimeout(() => { portClickSuppressed = false; }, 0);
    };
    const reset = () => {
      connecting = null;
      container.classList.remove('ed-connecting');
      previewLayer.textContent = '';
      suppressClick();
    };
    const up = (ev) => {
      if (ev.pointerId !== id) return;
      stop();
      if (!moved) {
        if (onTap) { suppressClick(); onTap(); }
        return;
      }
      const c = connecting;
      reset();
      if (tool === 'connector') setToolInternal('select');
      if (c.target) {
        const edgeId = api.connect(cell.id, c.target.id, { preset, sourceSide: c.side || undefined, targetSide: c.tside || undefined });
        api.select([edgeId]);
      } else if (!cellNear(ev.clientX, ev.clientY, 0) && !(ev.target.closest && ev.target.closest('.ed-overlay *'))) {
        emit('connect-request', { sourceId: cell.id, side: c.side || nearestSide(cell.geometry, api.clientToModel(ev.clientX, ev.clientY)),
          client: { x: ev.clientX, y: ev.clientY }, at: api.clientToModel(ev.clientX, ev.clientY) });
      }
      scheduleOverlay();
    };
    const cancel = () => {
      stop();
      if (moved) reset();
      scheduleOverlay();
    };
    const key = (ev) => {
      if (ev.key !== 'Escape') return;
      ev.preventDefault();
      ev.stopPropagation();
      cancel();
    };
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', cancel, true);
    window.addEventListener('keydown', key, true);
  }

  function startResize(e, cell, corner) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const st = graph.view.getState(cell);
    if (!st) return;
    const s = graph.view.scale;
    const t = graph.view.translate;
    const geo = cell.geometry;
    const target = e.currentTarget;
    const frame = target.parentElement;
    target.setPointerCapture(e.pointerId);
    syncPorts([]);
    resizing = { cell, bounds: null };
    const sx = e.clientX;
    const sy = e.clientY;
    const move = (ev) => {
      const dx = (ev.clientX - sx) / s;
      const dy = (ev.clientY - sy) / s;
      let x1 = geo.x;
      let y1 = geo.y;
      let x2 = geo.x + geo.width;
      let y2 = geo.y + geo.height;
      if (corner.indexOf('w') >= 0) x1 = Math.min(snapV(geo.x + dx), x2 - 20);
      if (corner.indexOf('e') >= 0) x2 = Math.max(snapV(x2 + dx), x1 + 20);
      if (corner.indexOf('n') >= 0) y1 = Math.min(snapV(geo.y + dy), y2 - 20);
      if (corner.indexOf('s') >= 0) y2 = Math.max(snapV(y2 + dy), y1 + 20);
      resizing.bounds = new mxRectangle(x1, y1, x2 - x1, y2 - y1);
      const p = { x: (x1 + t.x) * s, y: (y1 + t.y) * s, w: (x2 - x1) * s, h: (y2 - y1) * s };
      frame.style.left = (p.x - 6) + 'px';
      frame.style.top = (p.y - 6) + 'px';
      frame.style.width = (p.w + 12) + 'px';
      frame.style.height = (p.h + 12) + 'px';
    };
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
      const r = resizing;
      resizing = null;
      if (r && r.bounds) graph.resizeCell(cell, r.bounds);
      scheduleOverlay();
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  }

  graph.getSelectionModel().addListener(mxEvent.CHANGE, () => {
    const next = highlightedEdges();
    const changed = [];
    highlight.forEach((c) => { if (!next.has(c)) changed.push(c); });
    next.forEach((c) => { if (!highlight.has(c)) changed.push(c); });
    graph.getSelectionCells().forEach((c) => { if (model.isEdge(c)) changed.push(c); });
    highlight = next;
    if (changed.length) restyle(changed);
    scheduleOverlay();
    emit('selection', api.getSelection());
  });

  // ---- view events
  function paintGrid() {
    const t = THEMES[theme];
    const s = graph.view.scale;
    const tr = graph.view.translate;
    const ox = tr.x * s;
    const oy = tr.y * s;
    container.style.backgroundColor = t.stage;
    if (gridMode === 'dots') {
      const minor = 20 * s;
      const major = 100 * s;
      container.style.backgroundImage =
        `radial-gradient(${t.dot} 1px, transparent 1.2px), linear-gradient(${t.major} 1px, transparent 1px), linear-gradient(90deg, ${t.major} 1px, transparent 1px)`;
      container.style.backgroundSize = `${minor}px ${minor}px, ${major}px ${major}px, ${major}px ${major}px`;
      container.style.backgroundPosition = `${ox - minor / 2}px ${oy - minor / 2}px, ${ox}px ${oy}px, ${ox}px ${oy}px`;
    } else if (gridMode === 'lines') {
      const minor = 20 * s;
      container.style.backgroundImage = `linear-gradient(${t.line} 1px, transparent 1px), linear-gradient(90deg, ${t.line} 1px, transparent 1px)`;
      container.style.backgroundSize = `${minor}px ${minor}px, ${minor}px ${minor}px`;
      container.style.backgroundPosition = `${ox}px ${oy}px, ${ox}px ${oy}px`;
    } else {
      container.style.backgroundImage = 'none';
    }
  }

  let lastScale = graph.view.scale;
  const onView = () => {
    paintGrid();
    scheduleOverlay();
    if (graph.view.scale !== lastScale) {
      lastScale = graph.view.scale;
      emit('zoom', lastScale);
    }
    emit('view');
  };
  graph.view.addListener(mxEvent.SCALE, onView);
  graph.view.addListener(mxEvent.TRANSLATE, onView);
  graph.view.addListener(mxEvent.SCALE_AND_TRANSLATE, onView);
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { scheduleOverlay(); emit('view'); }) : null;
  if (ro) ro.observe(container);
  graph.addListener(mxEvent.EDITING_STARTED, scheduleOverlay);
  graph.addListener(mxEvent.EDITING_STOPPED, scheduleOverlay);

  // ---- zoom
  function zoomAt(scale, cx, cy) {
    const s0 = graph.view.scale;
    const s1 = clamp(scale, MIN_ZOOM, MAX_ZOOM);
    if (Math.abs(s1 - s0) < 1e-6) return;
    const t = graph.view.translate;
    const mx = cx / s0 - t.x;
    const my = cy / s0 - t.y;
    graph.view.scaleAndTranslate(s1, cx / s1 - mx, cy / s1 - my);
  }

  function zoomCentered(scale) {
    zoomAt(scale, (container.clientWidth || 800) / 2, (container.clientHeight || 600) / 2);
  }

  function fitInternal() {
    const cells = vertices();
    const cw = container.clientWidth || 800;
    const ch = container.clientHeight || 600;
    if (!cells.length) {
      graph.view.scaleAndTranslate(1, 40, 40);
      return;
    }
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    allCells().forEach((c) => {
      const st = graph.view.getState(c);
      if (!st) return;
      const s = graph.view.scale;
      const t = graph.view.translate;
      x1 = Math.min(x1, st.x / s - t.x);
      y1 = Math.min(y1, st.y / s - t.y);
      x2 = Math.max(x2, (st.x + st.width) / s - t.x);
      y2 = Math.max(y2, (st.y + st.height) / s - t.y);
    });
    if (!isFinite(x1)) {
      cells.forEach((c) => {
        const g = c.geometry;
        x1 = Math.min(x1, g.x); y1 = Math.min(y1, g.y);
        x2 = Math.max(x2, g.x + g.width); y2 = Math.max(y2, g.y + g.height);
      });
    }
    const pad = 48;
    const bw = Math.max(1, x2 - x1);
    const bh = Math.max(1, y2 - y1);
    const s = clamp(Math.min((cw - 2 * pad) / bw, (ch - 2 * pad) / bh, 1), MIN_ZOOM, MAX_ZOOM);
    const tx = (cw / s - bw) / 2 - x1;
    const ty = (ch / s - bh) / 2 - y1;
    graph.view.scaleAndTranslate(s, tx, ty);
  }

  // ---- pointer: hand tool, middle-button pan, place tools, wheel
  let pan = null;
  // Stops the compat mouse events of a gesture the engine consumed (pan,
  // place) from reaching mxGraph. mouseup is the last one mxGraph reacts to.
  const consumeCapture = (e) => {
    if (pan || consumingGesture) {
      e.stopPropagation();
      if (e.type === 'mouseup' && !pan) consumingGesture = false;
    }
  };
  let consumingGesture = false;

  function onPointerDown(e) {
    consumingGesture = false;
    if (e.target.closest && e.target.closest('.ed-overlay *')) return;
    if (graph.isEditing() && e.target.closest && e.target.closest('.mxCellEditor')) return;
    const isMiddle = e.button === 1;
    const isLeft = e.button === 0;
    if ((tool === 'hand' && isLeft) || isMiddle) {
      e.preventDefault();
      e.stopPropagation();
      consumingGesture = true;
      pan = { x: e.clientX, y: e.clientY, tx: graph.view.translate.x, ty: graph.view.translate.y, id: e.pointerId };
      container.classList.add('ed-panning');
      try { container.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      return;
    }
    if (isLeft && tool === 'connector') {
      const cell = cellNear(e.clientX, e.clientY, 0);
      if (cell) {
        consumingGesture = true;
        startConnect(e, cell, portAt(cell, e.clientX, e.clientY));
      }
      return;
    }
    if (isLeft && PLACE_TOOLS[tool]) {
      e.preventDefault();
      e.stopPropagation();
      consumingGesture = true;
      const kind = PLACE_TOOLS[tool];
      const p = api.clientToModel(e.clientX, e.clientY);
      const d = KINDS[kind];
      setToolInternal('select'); // first: cells aren't selectable in place tools
      const id = api.addShape(kind, { x: snapV(p.x - d.w / 2), y: snapV(p.y - d.h / 2) });
      if (kind === 'text') {
        const cell = model.getCell(id);
        setTimeout(() => { if (!destroyed && cell) graph.startEditingAtCell(cell); }, 0);
      }
    }
  }
  function onPointerMove(e) {
    if (!pan || e.pointerId !== pan.id) return;
    const s = graph.view.scale;
    graph.view.setTranslate(pan.tx + (e.clientX - pan.x) / s, pan.ty + (e.clientY - pan.y) / s);
  }
  function onPointerUp(e) {
    if (pan && e.pointerId === pan.id) {
      pan = null;
      container.classList.remove('ed-panning');
    }
  }
  function onWheel(e) {
    if (graph.isEditing()) return;
    e.preventDefault();
    const rect = container.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) {
      const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0025));
      zoomAt(graph.view.scale * factor, e.clientX - rect.left, e.clientY - rect.top);
    } else {
      const s = graph.view.scale;
      const k = e.deltaMode === 1 ? 16 : 1;
      const t = graph.view.translate;
      const dx = (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX) * k;
      const dy = (e.shiftKey && !e.deltaX ? 0 : e.deltaY) * k;
      graph.view.setTranslate(t.x - dx / s, t.y - dy / s);
    }
  }
  container.addEventListener('pointerdown', onPointerDown, true);
  container.addEventListener('pointermove', onPointerMove, true);
  container.addEventListener('pointerup', onPointerUp, true);
  container.addEventListener('pointercancel', onPointerUp, true);
  ['mousedown', 'touchstart', 'mousemove', 'mouseup'].forEach((n) => container.addEventListener(n, consumeCapture, true));
  container.addEventListener('wheel', onWheel, { passive: false });
  container.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); });

  // Hover shows a shape's connection points (startConnect does the rest).
  container.addEventListener('pointermove', onHover, true);
  container.addEventListener('pointerleave', onHoverLeave);

  function setToolInternal(name) {
    if (TOOLS.indexOf(name) < 0) return false;
    const prev = tool;
    tool = name;
    const select = name === 'select';
    graph.graphHandler.setEnabled(select);
    rubberband.setEnabled(select);
    // Connectors are drawn by startConnect, never mxGraph's own handler.
    graph.setConnectable(false);
    if (name !== 'select') hoverCell = null;
    container.classList.toggle('ed-tool-hand', name === 'hand');
    container.classList.toggle('ed-tool-connector', name === 'connector');
    container.classList.toggle('ed-tool-place', !!PLACE_TOOLS[name]);
    if (name !== 'select' && graph.isEditing()) graph.stopEditing(false);
    if (prev !== name) emit('tool', name);
    scheduleOverlay();
    return true;
  }

  // ---- SVG / PNG export
  // `decorate(root)` runs while the export's display styles are still applied.
  function exportSvgNode(scale, transparent, foEnabled, decorate) {
    const t = THEMES[theme];
    exporting = true;
    const origCreate = graph.createSvgCanvas;
    try {
      restyle();
      if (foEnabled === false) {
        graph.createSvgCanvas = function () {
          const c = origCreate.apply(this, arguments);
          c.foEnabled = false;
          return c;
        };
      }
      const bg = transparent ? null : t.stage;
      const root = graph.getSvg(bg, scale || 1, 16, false, true, true, true, null, null, true);
      if (decorate) decorate(root);
      return root;
    } finally {
      graph.createSvgCanvas = origCreate;
      exporting = false;
      restyle();
      scheduleOverlay();
    }
  }

  function svgString(root) {
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + mxUtils.getXml(root);
  }

  function rasterize(svg, w, h, transparent) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(w));
          canvas.height = Math.max(1, Math.round(h));
          const ctx = canvas.getContext('2d');
          if (!transparent) {
            ctx.fillStyle = THEMES[theme].stage;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding failed'))), 'image/png');
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('Could not render the diagram image'));
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }

  // ---- XML
  function encodeRoot(root) {
    const m = root === model.getRoot() ? model : new mxGraphModel(root);
    const enc = new mxCodec(mxUtils.createXmlDocument());
    const node = enc.encode(m);
    const attrs = { grid: gridMode === 'none' ? '0' : '1', gridSize: String(GRID), guides: '1', tooltips: '1', connect: '1',
      arrows: '1', fold: '1', page: '0', pageScale: '1', pageWidth: '850', pageHeight: '1100', math: '0', shadow: '0' };
    Object.keys(attrs).forEach((k) => node.setAttribute(k, attrs[k]));
    return node;
  }

  function decodeModelNode(node) {
    // Decode from a document of its own: mxCodec indexes every id in the
    // document, and pages of one mxfile reuse ids such as "0" and "1".
    const doc = mxUtils.createXmlDocument();
    doc.appendChild(doc.importNode(node, true));
    const tmp = new mxGraphModel();
    const dec = new mxCodec(doc);
    dec.decode(doc.documentElement, tmp);
    let root = tmp.getRoot();
    if (!root || tmp.getChildCount(root) === 0) {
      root = new mxCell();
      root.insert(new mxCell());
    }
    return root;
  }

  function parseDiagrams(xml) {
    if (typeof xml !== 'string' || !xml.trim()) throw new Error('Empty diagram file');
    const doc = mxUtils.parseXml(xml);
    const el = doc.documentElement;
    if (!el || el.nodeName === 'parsererror' || doc.getElementsByTagName('parsererror').length) {
      throw new Error('Not a valid diagram file');
    }
    const out = [];
    const fromModelNode = (node, name, id) => out.push({ name, id, root: decodeModelNode(node) });
    if (el.nodeName === 'mxGraphModel') {
      fromModelNode(el, 'Page-1', null);
    } else if (el.nodeName === 'mxfile') {
      const diagrams = Array.prototype.filter.call(el.childNodes, (n) => n.nodeType === 1 && n.nodeName === 'diagram');
      diagrams.forEach((d, i) => {
        const name = d.getAttribute('name') || 'Page-' + (i + 1);
        const id = d.getAttribute('id');
        let node = Array.prototype.find.call(d.childNodes, (n) => n.nodeType === 1 && n.nodeName === 'mxGraphModel');
        if (!node) {
          const text = (d.textContent || '').trim();
          if (text) {
            let inflated;
            try {
              inflated = Graph.decompress(text);
            } catch (err) {
              throw new Error('Could not decompress page "' + name + '"');
            }
            const sub = mxUtils.parseXml(inflated).documentElement;
            if (!sub || sub.nodeName !== 'mxGraphModel') throw new Error('Page "' + name + '" is not a diagram');
            node = sub;
          }
        }
        if (node) fromModelNode(node, name, id);
        else out.push({ name, id, root: null });
      });
    } else {
      throw new Error('Not a diagram file (root element <' + el.nodeName + '>)');
    }
    return out;
  }

  function pageInfo() {
    return pages.map((p) => ({ id: p.id, name: p.name }));
  }

  // ---------------------------------------------------------------- API
  const api = {
    // document
    load(xml) {
      const parsed = parseDiagrams(xml);
      const next = parsed.map((d) => {
        const p = makePage(d.name, d.root);
        if (d.id && !parsed.some((o) => o !== d && o.id === d.id)) p.id = d.id;
        return p;
      });
      if (!next.length) next.push(makePage('Page-1'));
      pages = next;
      current = null;
      activate(pages[0]);
      emit('page', { id: current.id, pages: pageInfo() });
      emit('change');
      emit('selection', api.getSelection());
    },
    toXml() {
      const doc = mxUtils.createXmlDocument();
      const file = doc.createElement('mxfile');
      file.setAttribute('host', 'EasyDiagram');
      file.setAttribute('modified', new Date().toISOString());
      file.setAttribute('agent', 'Easy Diagram');
      file.setAttribute('version', '1.0');
      pages.forEach((p) => {
        const d = doc.createElement('diagram');
        d.setAttribute('id', p.id);
        d.setAttribute('name', p.name);
        d.appendChild(doc.importNode(encodeRoot(p.root), true));
        file.appendChild(d);
      });
      doc.appendChild(file);
      return mxUtils.getXml(file);
    },
    isEmpty() {
      return allCells().length === 0;
    },
    pages: pageInfo,
    currentPage() {
      return current ? current.id : null;
    },
    addPage(name) {
      const p = makePage(name && String(name).trim() ? String(name).trim() : 'Page-' + (pages.length + 1));
      pages.push(p);
      activate(p);
      emit('page', { id: p.id, pages: pageInfo() });
      emit('change');
      emit('selection', api.getSelection());
      return p.id;
    },
    selectPage(id) {
      const p = pages.find((x) => x.id === id);
      if (!p || p === current) return !!p;
      activate(p);
      emit('page', { id: p.id, pages: pageInfo() });
      emit('selection', api.getSelection());
      return true;
    },
    renamePage(id, name) {
      const p = pages.find((x) => x.id === id);
      const n = name == null ? '' : String(name).trim();
      if (!p || !n || p.name === n) return false;
      p.name = n;
      emit('page', { id: current.id, pages: pageInfo() });
      emit('change');
      return true;
    },
    removePage(id) {
      const idx = pages.findIndex((x) => x.id === id);
      if (idx < 0) return false;
      if (pages.length === 1) {
        // The last page can't go; it is cleared instead.
        const fresh = makePage(pages[0].name);
        fresh.id = pages[0].id;
        pages = [fresh];
        current = null;
        activate(fresh);
      } else {
        const wasCurrent = pages[idx] === current;
        pages.splice(idx, 1);
        if (wasCurrent) activate(pages[Math.min(idx, pages.length - 1)]);
      }
      emit('page', { id: current.id, pages: pageInfo() });
      emit('change');
      emit('selection', api.getSelection());
      return true;
    },

    // shapes & connectors
    addShape(kind, props) {
      if (!KINDS[kind]) throw new Error('Unknown shape kind: ' + kind);
      props = props || {};
      const d = KINDS[kind];
      const w = isFinite(props.w) && props.w > 0 ? Number(props.w) : d.w;
      const h = isFinite(props.h) && props.h > 0 ? Number(props.h) : d.h;
      const color = COLORS[props.color] ? props.color : d.color;
      let x = props.x;
      let y = props.y;
      if (!isFinite(x) || !isFinite(y) || x == null || y == null) {
        const spot = freeSpot(w, h);
        x = spot.x;
        y = spot.y;
      }
      const service = kind === 'aws' ? (awsService(props.service) ? props.service : DEFAULT_AWS_SERVICE) : null;
      const label = props.label != null ? String(props.label) : (service ? awsService(service).label : d.label);
      const style = kind === 'aws' ? shapeStyle('aws', null, { edAws: service }) : shapeStyle(kind, color);
      const cell = edit(() => graph.insertVertex(graph.getDefaultParent(), null, textToHtml(label), Number(x), Number(y), w, h, style));
      graph.setSelectionCell(cell);
      return cell.id;
    },
    // opts (all optional): kind + props pick the new shape (default: a
    // Rounded "Next step"), preset the connector, at {x, y} a model point
    // to centre the shape on instead of the free slot beside the source.
    addConnected(sourceId, side, opts) {
      const src = model.getCell(sourceId);
      if (!src || !model.isVertex(src)) throw new Error('addConnected: no shape ' + sourceId);
      if (!SIDES[side]) throw new Error('addConnected: side must be r|l|t|b');
      opts = opts || {};
      const props = opts.props || {};
      const kind = opts.kind && KINDS[opts.kind] ? opts.kind : null;
      const d = kind ? KINDS[kind] : null;
      const g = src.geometry;
      const sm = shapeModel(src);
      const w = d ? d.w : 150;
      const h = d ? d.h : 64;
      let x;
      let y;
      const at = opts.at && isFinite(opts.at.x) && isFinite(opts.at.y) ? opts.at : null;
      if (at) {
        x = snapV(at.x - w / 2);
        y = snapV(at.y - h / 2);
      } else {
        // An icon's label hangs below it: leave room for it.
        const under = side === 'b' && sm.kind === 'aws' ? 24 : 0;
        x = g.x + g.width / 2 - w / 2;
        y = g.y + g.height / 2 - h / 2;
        if (side === 'r') x = g.x + g.width + 80;
        if (side === 'l') x = g.x - 80 - w;
        if (side === 'b') y = g.y + g.height + 70 + under;
        if (side === 't') y = g.y - 70 - h - (kind === 'aws' ? 24 : 0);
        x = snapV(x);
        y = snapV(y);
        // Slide sideways to the nearest free slot so we never stack shapes.
        const horiz = side === 'r' || side === 'l';
        const stepLen = horiz ? h + 30 : w + 30;
        for (let i = 1, k = 0; i < 12 && overlaps(x + (horiz ? 0 : k), y + (horiz ? k : 0), w, h, 12); i++) {
          k = Math.ceil(i / 2) * stepLen * (i % 2 ? 1 : -1);
          if (!overlaps(x + (horiz ? 0 : k), y + (horiz ? k : 0), w, h, 12)) {
            if (horiz) y += k; else x += k;
            break;
          }
        }
      }
      let color = sm.kind === 'note' || sm.kind === 'text' || sm.kind === 'aws' || !COLORS[sm.color] ? 'blue' : sm.color;
      if (COLORS[props.color]) color = props.color;
      const service = kind === 'aws' ? (awsService(props.service) ? props.service : DEFAULT_AWS_SERVICE) : null;
      const label = props.label != null ? String(props.label) : service ? awsService(service).label : d ? d.label : 'Next step';
      const style = kind === 'aws' ? shapeStyle('aws', null, { edAws: service }) : shapeStyle(kind || 'round', color);
      const entry = at ? nearestSide({ x, y, width: w, height: h }, sidePoint(g, side)) : OPPOSITE[side];
      const name = CONNECTOR_PRESETS[opts.preset] ? opts.preset : preset;
      let created;
      edit(() => {
        created = graph.insertVertex(graph.getDefaultParent(), null, textToHtml(label), x, y, w, h, style);
        graph.insertEdge(graph.getDefaultParent(), null, '', src, created,
          setStyleKeys(edgeStyle('default', portKeys(side, entry)), presetKeys(name)));
      });
      graph.setSelectionCell(created);
      return created.id;
    },
    connect(sourceId, targetId, props) {
      const s = model.getCell(sourceId);
      const t = model.getCell(targetId);
      if (!s || !t || !model.isVertex(s) || !model.isVertex(t)) throw new Error('connect: source and target must be shapes');
      props = props || {};
      let style = edgeStyle(props.color && (props.color === 'accent' || EDGE_COLORS[props.color]) ? props.color : 'default');
      if (props.lineStyle) style = setStyleKeys(style, lineStyleKeys(props.lineStyle));
      const width = props.width != null && EDGE_WIDTHS.indexOf(Number(props.width)) >= 0 ? Number(props.width) : 1.8;
      style = setStyleKeys(style, { strokeWidth: String(width) });
      if (CONNECTOR_PRESETS[props.preset]) style = setStyleKeys(style, presetKeys(props.preset, width));
      if (props.arrows || props.head) {
        style = setStyleKeys(style, arrowKeys(ARROW_ENDS.indexOf(props.arrows) >= 0 ? props.arrows : 'end', ARROW_HEADS[props.head] ? props.head : 'block', width));
      }
      if (ROUTES.indexOf(props.route) >= 0) style = setStyleKeys(style, routeKeys(props.route));
      if (props.anim) style = setStyleKeys(style, edgeAnimKeys(props.anim));
      // Pinned sides (a dragged connection point); one given picks the
      // other as the side facing it; neither: autoPorts.
      let ss = SIDES[props.sourceSide] ? props.sourceSide : null;
      let ts = SIDES[props.targetSide] ? props.targetSide : null;
      if (ss && !ts) ts = nearestSide(t.geometry, sidePoint(s.geometry, ss));
      if (ts && !ss) ss = nearestSide(s.geometry, sidePoint(t.geometry, ts));
      style = setStyleKeys(style, ss ? portKeys(ss, ts) : autoPorts(s.geometry, t.geometry));
      const label = props.label != null ? textToHtml(props.label) : '';
      const e = edit(() => graph.insertEdge(graph.getDefaultParent(), null, label, s, t, style));
      return e.id;
    },
    getCell(id) {
      return cellModel(model.getCell(id));
    },
    cells() {
      return allCells().map(cellModel).filter(Boolean);
    },
    update(id, patch) {
      const cell = model.getCell(id);
      if (!cell || !patch) return false;
      edit(() => {
        if (model.isVertex(cell)) applyShapePatch(cell, patch);
        else if (model.isEdge(cell)) applyEdgePatch(cell, patch);
      });
      return true;
    },
    remove(ids) {
      const cells = (Array.isArray(ids) ? ids : [ids]).map((i) => model.getCell(i)).filter((c) => c && (model.isVertex(c) || model.isEdge(c)));
      if (!cells.length) return;
      edit(() => graph.removeCells(cells, true));
    },
    duplicate(ids) {
      const cells = (Array.isArray(ids) ? ids : [ids]).map((i) => model.getCell(i)).filter((c) => c && (model.isVertex(c) || model.isEdge(c)));
      if (!cells.length) return [];
      const clones = edit(() => graph.moveCells(cells, 20, 20, true)) || [];
      graph.setSelectionCells(clones);
      return clones.map((c) => c.id);
    },

    // selection
    getSelection() {
      const cells = graph.getSelectionCells().filter((c) => model.isVertex(c) || model.isEdge(c));
      const ids = cells.map((c) => c.id);
      let type = 'none';
      if (cells.length === 1) type = model.isEdge(cells[0]) ? 'edge' : 'shape';
      else if (cells.length > 1) type = 'multi';
      return { type, ids };
    },
    select(ids) {
      const cells = (Array.isArray(ids) ? ids : [ids]).map((i) => model.getCell(i)).filter(Boolean);
      graph.setSelectionCells(cells);
    },
    clearSelection() {
      graph.clearSelection();
    },

    // tools & view
    setTool(name) {
      return setToolInternal(name);
    },
    getTool() {
      return tool;
    },
    setConnectorPreset(name) {
      if (!CONNECTOR_PRESETS[name]) return false;
      preset = name;
      return true;
    },
    getConnectorPreset() {
      return preset;
    },
    setPortMode(mode) {
      if (PORT_MODES.indexOf(mode) < 0) return;
      portMode = mode;
      scheduleOverlay();
    },
    getPortMode() {
      return portMode;
    },
    // The shape at a viewport point and its connection point nearest to it.
    shapeAt(clientX, clientY) {
      const c = cellNear(clientX, clientY, 0);
      if (!c) return null;
      const r = container.getBoundingClientRect();
      const st = graph.view.getState(c);
      let side = 'r';
      let bd = Infinity;
      Object.keys(SIDES).forEach((k) => {
        const p = portScreen(st, k);
        const dd = Math.hypot(p.x - (clientX - r.left), p.y - (clientY - r.top));
        if (dd < bd) { bd = dd; side = k; }
      });
      return { id: c.id, side };
    },
    getZoom() {
      return graph.view.scale;
    },
    zoomTo(scale) {
      if (isFinite(scale) && scale > 0) zoomCentered(Number(scale));
    },
    zoomIn() {
      zoomCentered(graph.view.scale * 1.2);
    },
    zoomOut() {
      zoomCentered(graph.view.scale / 1.2);
    },
    fit() {
      fitInternal();
    },
    setGrid(mode) {
      if (['dots', 'lines', 'none'].indexOf(mode) < 0) return;
      gridMode = mode;
      paintGrid();
    },
    setSnap(on) {
      snap = !!on;
      graph.setGridEnabled(snap);
    },
    setTheme(name) {
      const next = name === 'light' ? 'light' : 'dark';
      if (next === theme) return;
      theme = next;
      container.setAttribute('data-ed-theme', theme);
      applyThemeVars();
      applyHandleColors(theme);
      paintGrid();
      restyle();
      graph.selectionCellsHandler.refresh();
    },

    // history
    undo() {
      if (graph.isEditing()) graph.stopEditing(false);
      if (current && current.undo.canUndo()) current.undo.undo();
    },
    redo() {
      if (graph.isEditing()) graph.stopEditing(false);
      if (current && current.undo.canRedo()) current.undo.redo();
    },
    canUndo() {
      return !!(current && current.undo.canUndo());
    },
    canRedo() {
      return !!(current && current.undo.canRedo());
    },

    // animation
    setMotion(on) {
      animator.setMotion(on);
    },
    replay(id) {
      return animator.replay(id);
    },

    // export
    toSvg(opts) {
      opts = opts || {};
      const root = exportSvgNode(1, !!opts.transparent);
      if (opts.embed) root.setAttribute('content', api.toXml());
      return svgString(root);
    },
    // The SVG for an HTML export: same drawing as toSvg, plus the animation
    // classes and connector overlays the editor shows (animation.js).
    toAnimatedSvg(opts) {
      opts = opts || {};
      let animated = 0;
      const root = exportSvgNode(1, !!opts.transparent, true, (svg) => {
        const states = Object.values(model.cells || {}).map((c) => graph.view.getState(c)).filter(Boolean);
        animated = animateExportSvg(svg, states, { accent: ACCENT, scale: 1 });
      });
      return { svg: mxUtils.getXml(root), animated, background: opts.transparent ? null : THEMES[theme].stage };
    },
    toPngBlob(opts) {
      opts = opts || {};
      const scale = clamp(Number(opts.scale) || 1, 0.1, 8);
      const make = (fo) => {
        const root = exportSvgNode(scale, !!opts.transparent, fo);
        const w = parseFloat(root.getAttribute('width'));
        const h = parseFloat(root.getAttribute('height'));
        return rasterize(svgString(root), w, h, !!opts.transparent);
      };
      // Safari taints canvases drawn from SVG with <foreignObject>; fall back
      // to plain SVG text labels there.
      return make(true).catch(() => make(false)).then(async (blob) => {
        if (!opts.embed) return blob;
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const out = insertPngText(bytes, 'mxfile', encodeURIComponent(api.toXml()));
        return new Blob([out], { type: 'image/png' });
      });
    },

    // geometry helpers
    clientToModel(clientX, clientY) {
      const pt = mxUtils.convertPoint(container, clientX, clientY);
      const s = graph.view.scale;
      const t = graph.view.translate;
      return { x: pt.x / s - t.x, y: pt.y / s - t.y };
    },
    getScreenBounds(id) {
      const cell = model.getCell(id);
      const st = cell ? graph.view.getState(cell) : null;
      if (!st) return null;
      return { x: st.x, y: st.y, w: st.width, h: st.height };
    },

    // events
    on(event, fn) {
      if (listeners[event] && typeof fn === 'function') listeners[event].add(fn);
    },
    off(event, fn) {
      if (listeners[event]) listeners[event].delete(fn);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (overlayRaf) cancelAnimationFrame(overlayRaf);
      if (ro) ro.disconnect();
      container.removeEventListener('pointerdown', onPointerDown, true);
      container.removeEventListener('pointermove', onPointerMove, true);
      container.removeEventListener('pointerup', onPointerUp, true);
      container.removeEventListener('pointercancel', onPointerUp, true);
      ['mousedown', 'touchstart', 'mousemove', 'mouseup'].forEach((n) => container.removeEventListener(n, consumeCapture, true));
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('pointermove', onHover, true);
      container.removeEventListener('pointerleave', onHoverLeave);
      previewLayer.remove();
      portLayer.remove();
      animator.destroy();
      rubberband.destroy();
      graph.destroy();
      overlay.remove();
      container.classList.remove('ed-engine', 'ed-paused', 'ed-tool-hand', 'ed-tool-connector', 'ed-tool-place', 'ed-connecting');
      EVENTS.forEach((e) => listeners[e].clear());
    },

    // Escape hatch for tests and debugging; not part of the contract.
    _graph: graph,
  };

  function applyThemeVars() {
    const t = THEMES[theme];
    const tok = accentTokens(theme);
    const vars = {
      '--ed-accent': tok.accent,
      '--ed-accent-text': tok.accentText,
      '--ed-accent-soft': tok.accentSoft,
      '--ed-on-accent': '#0A0B0D',
      '--ed-surface': t.surface,
      '--ed-stage': t.stage,
      '--ed-shadow': t.shadow,
    };
    Object.keys(vars).forEach((k) => container.style.setProperty(k, vars[k]));
  }

  applyThemeVars();
  setToolInternal('select');
  pages = [makePage('Page-1')];
  activate(pages[0]);
  paintGrid();
  return api;
}
