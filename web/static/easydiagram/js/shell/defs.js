// Static definitions shared by the shell: shape kinds, palettes, tools,
// animation lists and icon paths (all lifted from the Precision prototype).

export const COLORS = [
  ['blue', 'Blue'], ['green', 'Teal'], ['violet', 'Violet'], ['pink', 'Rose'], ['amber', 'Amber'], ['slate', 'Slate'],
];

export const EDGE_COLORS = [
  ['default', 'Default', 'var(--edge)'], ['accent', 'Accent', 'var(--accent)'], ['blue', 'Blue', '#4C8DFF'],
  ['green', 'Green', '#2BB6A3'], ['pink', 'Pink', '#F0607A'], ['amber', 'Amber', '#E5A93B'],
];

// Dock order and metadata. Engine kind names (BUILD.md): `note` is the prototype's sticky.
export const KINDS = {
  rect: { name: 'Rectangle', cats: ['basic', 'flow'], label: 'Process', w: 150, h: 64 },
  round: { name: 'Rounded', cats: ['basic'], label: 'Step', w: 150, h: 64 },
  ellipse: { name: 'Ellipse', cats: ['basic'], label: 'Event', w: 130, h: 72 },
  diamond: { name: 'Decision', cats: ['basic', 'flow'], label: 'Decision', w: 130, h: 100 },
  pill: { name: 'Terminator', cats: ['flow'], label: 'Start / End', w: 150, h: 60 },
  para: { name: 'Data', cats: ['flow'], label: 'Input', w: 150, h: 64 },
  hex: { name: 'Hexagon', cats: ['basic'], label: 'Prepare', w: 150, h: 64 },
  cyl: { name: 'Database', cats: ['flow'], label: 'Database', w: 110, h: 86 },
  doc: { name: 'Document', cats: ['flow'], label: 'Report', w: 140, h: 80 },
  note: { name: 'Sticky', cats: ['basic'], label: 'New note', w: 170, h: 100 },
};
export const KIND_NAMES = Object.assign(
  Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, v.name])), { text: 'Text', aws: 'AWS' });

export const CATS = [['all', 'All'], ['basic', 'Basic'], ['flow', 'Flowchart'], ['aws', 'AWS']];

// Outline path for a shape kind at w×h (prototype shapePath).
export function shapePath(k, w, h) {
  const i = 1.5;
  const f = (v) => Math.round(v * 10) / 10;
  const rr = (r) => `M${f(r + i)} ${i}H${f(w - r - i)}A${f(r)} ${f(r)} 0 0 1 ${f(w - i)} ${f(r + i)}V${f(h - r - i)}A${f(r)} ${f(r)} 0 0 1 ${f(w - r - i)} ${f(h - i)}H${f(r + i)}A${f(r)} ${f(r)} 0 0 1 ${i} ${f(h - r - i)}V${f(r + i)}A${f(r)} ${f(r)} 0 0 1 ${f(r + i)} ${i}Z`;
  if (k === 'rect') return rr(Math.min(4, h / 4));
  if (k === 'round') return rr(Math.min(14, h / 3));
  if (k === 'pill') return rr(h / 2 - i);
  if (k === 'ellipse') { const rx = f(w / 2 - i), ry = f(h / 2 - i); return `M${i} ${f(h / 2)}A${rx} ${ry} 0 1 0 ${f(w - i)} ${f(h / 2)}A${rx} ${ry} 0 1 0 ${i} ${f(h / 2)}Z`; }
  if (k === 'diamond') return `M${f(w / 2)} ${i}L${f(w - i)} ${f(h / 2)}L${f(w / 2)} ${f(h - i)}L${i} ${f(h / 2)}Z`;
  if (k === 'para') { const sl = f(Math.min(18, w / 5)); return `M${f(sl + i)} ${i}H${f(w - i)}L${f(w - sl - i)} ${f(h - i)}H${i}Z`; }
  if (k === 'hex') { const sl = f(Math.min(16, w / 5)); return `M${f(sl + i)} ${i}H${f(w - sl - i)}L${f(w - i)} ${f(h / 2)}L${f(w - sl - i)} ${f(h - i)}H${f(sl + i)}L${i} ${f(h / 2)}Z`; }
  if (k === 'cyl') { const ry = f(Math.min(10, h / 6)), rx = f(w / 2 - i); return `M${i} ${f(ry + i)}V${f(h - ry - i)}A${rx} ${ry} 0 0 0 ${f(w - i)} ${f(h - ry - i)}V${f(ry + i)}A${rx} ${ry} 0 0 0 ${i} ${f(ry + i)}A${rx} ${ry} 0 0 0 ${f(w - i)} ${f(ry + i)}`; }
  if (k === 'doc') { const c = f(Math.min(12, h / 5)); return `M${i} ${i}H${f(w - i)}V${f(h - c - i)}Q${f(w * 0.75)} ${f(h - c * 2.4)} ${f(w / 2)} ${f(h - c - i)}T${i} ${f(h - c - i)}Z`; }
  if (k === 'note') { const fo = f(Math.min(18, w / 6)); return `M${i} ${i}H${f(w - i)}V${f(h - fo - i)}L${f(w - fo - i)} ${f(h - i)}H${i}Z`; }
  return rr(6);
}

export const I = {
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  sunSmall: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M2 12h2M20 12h2',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  pause: 'M8 5v14M16 5v14',
  play: 'M7 4l13 8-13 8z',
  spark: 'M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z',
  dup: 'M9 9h11v11H9zM5 15H4V4h11v1',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  arrowR: 'M5 12h14M13 6l6 6-6 6',
  arrowL: 'M19 12H5M11 6l-6 6 6 6',
  check: 'M5 12l5 5 9-10',
  alert: 'M12 8v5M12 16.5v.5',
  rect: 'M6 5h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
  ellipse: 'M12 5c4.4 0 8 3.1 8 7s-3.6 7-8 7-8-3.1-8-7 3.6-7 8-7z',
  diamond: 'M12 3l9 9-9 9-9-9z',
  note: 'M5 4h14v10l-6 6H5zM13 20v-6h6',
  text: 'M5 7V5h14v2M12 5v14M9 19h6',
  page: 'M6 3h8l4 4v14H6zM14 3v4h4M12 11v6M9 14h6',
  pageX: 'M6 3h8l4 4v14H6zM14 3v4h4M9.5 12.5l5 5M14.5 12.5l-5 5',
  zoom100: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4M8 11h6',
  fit: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
  open: 'M4 6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v1M4 6v12a2 2 0 0 0 2 2h12l3-9H7l-3 9',
  save: 'M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6',
  print: 'M7 9V4h10v5M7 17H5v-6h14v6h-2M7 14h10v6H7z',
  shapes: 'M4 4h7v7H4zM13 13h7v7h-7zM17.5 4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z',
  sliders: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4',
  close: 'M6 6l12 12M18 6L6 18',
  logo: null,
};

// [engineTool, name, key, icon]
export const TOOLS = [
  ['select', 'Select', 'V', 'M5 3l14 7.5-6.2 1.8L10.5 18.5z'],
  ['hand', 'Hand', 'H', 'M8 12V5.5a1.5 1.5 0 0 1 3 0V11M11 10.5V4a1.5 1.5 0 0 1 3 0v6.5M14 10.5V5.5a1.5 1.5 0 0 1 3 0V12M17 11V9a1.5 1.5 0 0 1 3 0v5a7 7 0 0 1-7 7h-1.5a6 6 0 0 1-4.8-2.4L4 15.5a1.6 1.6 0 0 1 2.4-2L8 15'],
  ['rect', 'Rectangle', 'R', I.rect],
  ['ellipse', 'Ellipse', 'O', I.ellipse],
  ['diamond', 'Decision', 'D', I.diamond],
  ['connector', 'Connector', 'A', 'M5 19L19 5M11 5h8v8'],
  ['text', 'Text', 'T', I.text],
  ['note', 'Sticky note', 'N', I.note],
];
// Tools that add a shape immediately (prototype behaviour) instead of staying armed.
export const ADD_TOOLS = { rect: 'rect', ellipse: 'ellipse', diamond: 'diamond', note: 'note' };

export const SPEEDS = [['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']];
export const TRIGGERS = [['loop', 'Loop'], ['hover', 'On hover'], ['once', 'Once']];
export const NODE_ANIMS = [['none', 'None'], ['pulse', 'Pulse'], ['bounce', 'Bounce'], ['float', 'Float'], ['wiggle', 'Wiggle'], ['glow', 'Glow'], ['blink', 'Blink'], ['pop', 'Pop']];
export const EDGE_ANIMS = [['none', 'None'], ['flow', 'Flow'], ['dash', 'March'], ['comet', 'Comet'], ['pulse', 'Pulse'], ['draw', 'Draw']];
export const NODE_DUR = { pulse: 1.4, bounce: 1.2, float: 3, wiggle: 1, glow: 1.8, blink: 1.4, pop: 0.7 };
export const EDGE_DUR = { flow: 0.8, dash: 0.9, comet: 1.8, pulse: 1.6, draw: 2.4 };
export const SPEED_MULT = { slow: 1.8, normal: 1, fast: 0.55 };

export function animName(defs, id) {
  return (defs.find((d) => d[0] === (id || 'none')) || defs[0])[1];
}
