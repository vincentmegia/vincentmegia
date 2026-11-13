// Min-jun's First Person body, chin down: slacks, sneakers, the shirt and
// sweater vest, neck, arms (posed), the books under his arm and the tote.
// Every dimension is read off library/minjun.js in its own art px (y down;
// z toward the viewer) and converted by minjun-frame.js. The front of the
// legs, torso and neck wears his own 2D drawing (paintMinjunBody), and the
// books and tote wear paintMinjunProps, both projected straight along Z;
// sides and backs are lit flat colours from MINJUN_PALETTE. Pure.

import { MINJUN_PALETTE as P, MINJUN_BOOK_SPINES, MINJUN_OPEN_BOOK, MINJUN_TOTE, minjunBookTop } from '../../minjun.js';
import { box, emptyMesh, loft, merge, projectFront, tube } from './geom.js';
import { MINJUN_ART, S, modelY, toModel, uvIn } from './minjun-frame.js';

const SKIN = new Set([P.skin, P.skinShade, P.skinDeep]);

/** A ring radius for an n-sided stack whose flat faces span `half` either side (prism puts faces on the axes). */
const ring = (half, sides) => half / Math.cos(Math.PI / sides);

/** An art-space stack of rings ({y, hw, hd, cx?, cz?, color}, bottom to top) as a model-space loft. */
function stack(rings, sides, capTop = null, capBottom = null) {
  return loft(
    rings.map((r) => ({
      y: modelY(r.y),
      rx: ring(r.hw, sides) * S,
      rz: ring(r.hd, sides) * S,
      cx: (r.cx ?? 0) * S,
      cz: (r.cz ?? 0) * S,
      color: r.color,
    })),
    sides,
    capTop,
    capBottom,
  );
}

/** An art-space box (x0..x1, y0..y1 with y down, z0..z1). */
function artBox(x0, y0, z0, x1, y1, z1, color, tint) {
  const a = toModel(x0, y1, z0);
  const b = toModel(x1, y0, z1);
  return box(a, b, color, tint);
}

// -- Legs and sneakers --------------------------------------------------------

/** Each slack leg (drawLegs at rest): hip -19 to the cuff at +2.4, a slight taper. */
export const LEG = {
  hip: { y: -19, cx: 4.1, hw: 3.7, hd: 3.6 },
  knee: { y: -7.5, cx: 3.9, hw: 3.45, hd: 3.25 },
  cuff: { y: 2.4, cx: 3.8, hw: 3.25, hd: 3.0 },
};

function buildLegs(art) {
  const m = emptyMesh();
  for (const dir of [-1, 1]) {
    const r = (k) => ({ ...LEG[k], cx: dir * LEG[k].cx, color: P.slacks });
    merge(m, stack([r('cuff'), r('knee'), r('hip')], 8, null, P.slacksShade));
  }
  return projectFront(m, { image: art?.body, toUV: uvIn(MINJUN_ART.body) });
}

/**
 * A white sneaker (drawSneaker): a grey sole, the upper with a lower toe
 * box, a navy swoosh stripe down the outer side and a navy heel tab.
 * Toes point +Z; the sole's bottom is the floor.
 */
function buildSneaker(dir) {
  const cx = dir * LEG.cuff.cx;
  const m = emptyMesh();
  merge(m, artBox(cx - 2.9, 6.5, -3.6, cx + 2.9, 8.3, 5.2, P.sole));
  merge(m, artBox(cx - 2.7, 2.2, -3.3, cx + 2.7, 6.5, 1.6, P.shoe, { top: P.shoeShade }));
  merge(m, artBox(cx - 2.6, 4.2, 1.6, cx + 2.6, 6.5, 4.8, P.shoe, { front: P.shoeShade }));
  // The swoosh, a stripe proud of the outer side.
  const out = cx + dir * 2.7;
  merge(m, artBox(Math.min(out, out + dir * 0.15), 4.4, -2.4, Math.max(out, out + dir * 0.15), 5.3, 3.6, P.shoeAccent));
  // Heel tab at the back.
  merge(m, artBox(cx - 0.6, 2.6, -3.45, cx + 0.6, 5.2, -3.3, P.shoeAccent));
  // The navy sock between the cuff and the shoe.
  merge(m, stack([{ y: 2.4, hw: 2.2, hd: 2.2, cx, color: P.vest }, { y: 0.4, hw: 2.3, hd: 2.3, cx, color: P.vest }], 6));
  return m;
}

// -- Torso and neck -----------------------------------------------------------

/**
 * The shirt and vest's silhouette (torsoPath / the vest path, at rest),
 * bottom to top: half-width `hw`, half-depth `hd`, and the band colour seen
 * from the side and back (the band ending at that ring).
 */
export const TORSO_RINGS = [
  { y: -15.6, hw: 10.5, hd: 6.0, color: P.shirt },
  { y: -19.4, hw: 10.5, hd: 6.2, color: P.belt },
  { y: -28, hw: 10.9, hd: 6.6, color: P.vest },
  { y: -36, hw: 11.5, hd: 6.4, color: P.vest },
  { y: -39.5, hw: 10.4, hd: 5.6, color: P.vest },
  { y: -41.5, hw: 7.0, hd: 4.6, color: P.shirt },
  { y: -42, hw: 5.0, hd: 3.8, color: P.shirt },
];

function buildTorso(art) {
  const m = stack(TORSO_RINGS, 12, P.shirt, P.slacks);
  return projectFront(m, { image: art?.body, toUV: uvIn(MINJUN_ART.body), minNz: 0.4 });
}

function buildNeck(art) {
  const m = stack([
    { y: -40.5, hw: 2.7, hd: 2.6, cz: -0.4, color: P.skin },
    { y: -46.5, hw: 2.6, hd: 2.5, cz: -0.6, color: P.skin },
  ], 8);
  return projectFront(m, { image: art?.body, toUV: uvIn(MINJUN_ART.body) });
}

// -- Arms ---------------------------------------------------------------------

/**
 * His arms' joints per pose, in art px (x, y down, z toward the viewer),
 * from the 2D drawers' own joint points: drawFreeArm (idle, wave),
 * drawPocketArm (walk), drawReadingArm (read) for his right arm (viewer's
 * left); drawBookArm for the left arm round the books, the same in every
 * pose. z is the one thing the 2D can't say: a hand in a front pocket, a
 * book held before his chest. `hand` says how the hand shows:
 *   - {dir, side, thumb}: a hand (buildHand) pointing along `dir`, its palm
 *     `side` wide, the thumb on `side`'s + or - edge;
 *   - 'pocket': in his trouser pocket (drawPocketArm): the pocket's bulge
 *     over the hand and the thumb hooked outside it;
 *   - 'book': on the open book's edge, where the book's own art draws it.
 */
export const MINJUN_POSES = {
  // Hanging: fingers down, the back of the hand turned out to the front.
  idle: { elbow: [-12.8, -27, 0.5], wrist: [-12.6, -17.4, 1.5], hand: { dir: [0.05, 1, 0.1], side: [0.9, 0, 0.45], thumb: 1 }, watch: true },
  walk: { elbow: [-15.6, -27.6, -0.5], wrist: [-8.2, -15, 4.2], hand: 'pocket', watch: true },
  read: { elbow: [-13.4, -27.5, 3], wrist: [-7.4, -26.8, 8.6], hand: 'book', watch: true, book: true },
  // Raised: fingers up, the palm to the viewer (drawFreeArm's wave turns the hand over).
  wave: { elbow: [-17, -33.5, 1.5], wrist: [-17.6, -43.5, 2.5], hand: { dir: [0, -1, 0], side: [1, 0, 0], thumb: 1 }, watch: true },
};

/** The left arm round the books: the hand lies across their fronts, fingers out past the last spine (drawBookArm's hand at -1.9 rad). */
export const BOOK_ARM = {
  shoulder: [10.6, -38, 0],
  elbow: [12.8, -27.6, 3],
  wrist: [16.2, -21.4, 4.4],
  hand: { dir: [0.95, -0.3, -0.12], side: [0.3, 0.95, 0], thumb: -1 },
};

const SHOULDER_R = 2.7; // drawArm's 5.4 px sleeve stroke
const FOREARM_R = 1.75; // its 3.5 px forearm stroke

/**
 * drawHand's hand, in art px: the 2D draws a 4 x 4.8 oval with three finger
 * lines and a thumb; here that is a flat palm, four fingers and a thumb.
 * `width` is the palm's half-width, `thick` its thickness as a part of it.
 */
export const HAND = { palm: 2.5, width: 1.95, thick: 0.5, finger: 2.1, fingerR: 0.4, thumb: 2.2, thumbR: 0.6 };

const vAdd = (p, q, k = 1) => [p[0] + q[0] * k, p[1] + q[1] * k, p[2] + q[2] * k];
const vUnit = (p) => { const l = Math.hypot(p[0], p[1], p[2]) || 1; return [p[0] / l, p[1] / l, p[2] / l]; };
const vDot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
/** An art-space direction (y down) as a model-space one (y up). */
const artDir = (d) => [d[0], -d[1], d[2]];
const at = (p) => toModel(p[0], p[1], p[2]);

/**
 * A hand at `wrist`: a flat palm widening from the wrist, four fingers with
 * gaps between them (shorter at the edges) and a thumb off one side. The
 * palm is his skin tone and the fingers and thumb its shade (the 2D separates
 * them with ink lines; without outlines a one-tone hand vanishes against the
 * cream tote behind it). All skin tones, so unlit like the rest of his skin.
 * @param {number[]} wrist art px
 * @param {{dir: number[], side: number[], thumb: number}} h
 */
export function buildHand(wrist, h) {
  const dir = vUnit(h.dir);
  // `side` square to the hand's direction.
  const side = vUnit(vAdd(h.side, dir, -vDot(h.side, dir)));
  const along = (d, across = 0) => vAdd(vAdd(wrist, dir, d), side, across);
  const flat = { side: artDir(side), squash: HAND.thick };
  const m = emptyMesh();
  merge(m, tube(at(along(-0.5)), at(along(HAND.palm)), 1.55 * S, HAND.width * S, 8, P.skin, { ...flat, capA: P.skin, capB: P.skinDeep }));
  [-1.44, -0.48, 0.48, 1.44].forEach((across, i) => {
    const len = HAND.finger - (i === 0 || i === 3 ? 0.45 : 0);
    merge(m, tube(at(along(HAND.palm - 0.2, across)), at(along(HAND.palm + len, across * 0.92)), HAND.fingerR * S, HAND.fingerR * 0.85 * S, 4, P.skinShade, { side: artDir(side), capB: P.skinDeep }));
  });
  const t = h.thumb;
  merge(m, tube(at(along(0.5, t * (HAND.width - 0.5))), at(along(0.5 + HAND.thumb * 0.8, t * (HAND.width + 1.2))), HAND.thumbR * S, HAND.thumbR * 0.8 * S, 4, P.skinShade, { side: artDir(side), capB: P.skinDeep }));
  return m;
}

/** drawPocketArm's pocket: the bulge the hidden hand makes (a shade lighter than the slacks) and the thumb hooked over its edge. */
export const POCKET = { color: '#4a4a58', from: [-8.4, -15.6, 4.0], to: [-6.9, -11.6, 3.3], thumbFrom: [-6.9, -16.6, 4.9], thumbTo: [-5.9, -14.5, 4.5] };

function buildPocketHand() {
  const m = emptyMesh();
  merge(m, tube(at(POCKET.from), at(POCKET.to), 2.3 * S, 1.6 * S, 6, POCKET.color, { side: [1, 0, 0], squash: 0.55, capA: POCKET.color, capB: POCKET.color }));
  merge(m, tube(at(POCKET.thumbFrom), at(POCKET.thumbTo), 0.75 * S, 0.6 * S, 4, P.skin, { capA: P.skin, capB: P.skinShade }));
  return m;
}

function buildArm(shoulder, elbow, wrist, { hand, watch }) {
  const m = emptyMesh();
  merge(m, tube(at(shoulder), at(elbow), SHOULDER_R * S, 2.45 * S, 6, P.shirt, { capA: P.shirt }));
  // The rolled cuff at the elbow (drawArm's 6.8 x 3.2 band).
  const dir = vUnit([wrist[0] - elbow[0], wrist[1] - elbow[1], wrist[2] - elbow[2]]);
  const along = (p, d) => vAdd(p, dir, d);
  merge(m, tube(at(along(elbow, -1.2)), at(along(elbow, 1.6)), 2.75 * S, 2.6 * S, 6, P.shirtShade, { capA: P.shirtShade, capB: P.shirtShade }));
  merge(m, tube(at(along(elbow, 1.6)), at(wrist), FOREARM_R * S, 1.5 * S, 6, P.skin));
  if (watch) merge(m, tube(at(along(wrist, -2.4)), at(along(wrist, -1.2)), 1.8 * S, 1.75 * S, 6, P.watchBand, { capA: P.watchFace, capB: P.watchBand }));
  if (hand === 'pocket') merge(m, buildPocketHand());
  else if (hand && typeof hand === 'object') merge(m, buildHand(wrist, hand));
  return m;
}

/** How far before his chest the open book is held (art px, z). */
export const OPEN_BOOK_Z = 9.6;

/**
 * The open book he reads from (drawOpenBook, MINJUN_OPEN_BOOK): a blue
 * cover, and two pages bowing up from the spine that wear the drawing itself
 * (pages, lines of text and his hand on the edge) from the props art.
 */
function buildOpenBook(art) {
  const { cx, cy, w, h } = MINJUN_OPEN_BOOK;
  const z = OPEN_BOOK_Z;
  const m = emptyMesh();
  merge(m, artBox(cx - w - 0.5, cy - h / 2 - 0.45, z - 0.5, cx + w + 0.5, cy + h / 2 + 0.45, z - 0.1, '#4fa8e0'));
  for (const d of [-1, 1]) {
    // Each page from the spine (pages' edges 0.6 past the cover so the hand
    // over the edge shows) out to its edge, which lifts 0.5 toward him.
    const x0 = cx;
    const x1 = cx + d * (w + 0.6);
    const pts = [toModel(x0, cy + h / 2 + 0.45, z), toModel(x1, cy + h / 2 + 0.45, z + 0.5), toModel(x1, cy - h / 2 - 0.45, z + 0.5), toModel(x0, cy - h / 2 - 0.45, z)];
    // Wound to face +Z either side of the spine.
    const quad = d > 0 ? pts : [pts[1], pts[0], pts[3], pts[2]];
    merge(m, { vertices: quad, faces: [{ indices: [0, 1, 2, 3], color: '#fbf6ea' }] });
  }
  return projectFront(m, { image: art?.props, toUV: uvIn(MINJUN_ART.props), minNz: 0.9 });
}

function buildArms(pose, art) {
  const p = MINJUN_POSES[pose] ?? MINJUN_POSES.idle;
  const m = emptyMesh();
  merge(m, buildArm([-10.6, -38, 0], p.elbow, p.wrist, p));
  merge(m, buildArm(BOOK_ARM.shoulder, BOOK_ARM.elbow, BOOK_ARM.wrist, { hand: BOOK_ARM.hand, watch: false }));
  if (p.book) merge(m, buildOpenBook(art));
  return m;
}

// -- Books and tote -----------------------------------------------------------

/** The books' depth front to back (art px): held against his side, spines toward the viewer. */
export const BOOK_Z = { back: -4.2, front: 2.6 };

function buildBooks(art) {
  const m = emptyMesh();
  for (const b of MINJUN_BOOK_SPINES) {
    const top = minjunBookTop(b, 0);
    merge(m, artBox(b.x, top, BOOK_Z.back, b.x + b.w, top + b.h, BOOK_Z.front, b.color, { top: '#fbf3e0' }));
  }
  return projectFront(m, { image: art?.props, toUV: uvIn(MINJUN_ART.props), minNz: 0.9 });
}

/** The tote hangs behind his free arm, a flat canvas bag (drawTote). */
export const TOTE_Z = { back: -3.4, front: -1.0 };

function buildTote(art) {
  const { l, r, top, bottom } = MINJUN_TOTE;
  const m = artBox(l, top, TOTE_Z.back, r, bottom, TOTE_Z.front, '#e4d9c1', { top: '#d9cfb8' });
  return projectFront(m, { image: art?.props, toUV: uvIn(MINJUN_ART.props), minNz: 0.9 });
}

/**
 * @param {string} pose one of MINJUN_POSES' keys
 * @param {{body?: CanvasImageSource, props?: CanvasImageSource}} [art]
 */
export function buildMinjunBody(pose, art) {
  const m = emptyMesh();
  merge(m, buildLegs(art));
  for (const dir of [-1, 1]) merge(m, buildSneaker(dir));
  merge(m, buildTorso(art));
  merge(m, buildNeck(art));
  merge(m, buildArms(pose, art));
  merge(m, buildBooks(art));
  merge(m, buildTote(art));
  // The material rule (library-first-person-3d.md): every skin-toned face is unlit.
  for (const f of m.faces) if (SKIN.has(f.color)) f.unlit = true;
  return m;
}
