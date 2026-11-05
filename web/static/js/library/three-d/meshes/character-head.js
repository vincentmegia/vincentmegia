// The 3D patron's head, from the chin up: skull, ears, face, hair, and
// everything worn on the head. Built to match patron-head.js (the 2D art).
//
// Every face is `unlit`: the scene light comes from above and would grey out a
// forward-facing face, so the shading is baked into the ring and band colours
// instead (as the 2D bakes it into what it paints). Depth fog still applies.
// Note geom.js's `prism` colours each band from its UPPER ring, so a prism's
// first ring colour is never rendered; every row below is written with that
// in mind.
//
// Pure and DOM-free. Dimensions are 2D px (y measured up from the feet, like
// FRAME) and divide by PX; x is px from the centre line.

import { emptyMesh, merge, box, prism, quad, translate, scaleAbout } from './geom.js';
import { FRAME, PX } from './character-frame.js';
import { shadeColor } from '../../../shared/people.js';

const HEX6 = /^#[0-9a-f]{6}$/i;
const hexOr = (v, fallback) => (typeof v === 'string' && HEX6.test(v) ? v : fallback);
const y = (px) => px * PX;
const join = (parts) => parts.reduce((acc, p) => merge(acc, p), emptyMesh());

const EYE = FRAME.eye / PX; // 53.8 px
const STOOP = 0.05; // an elder's head leans forward by this many units
const DETAIL = 0.01; // how far detail faces sit proud of the head

// The skull: [y px, width factor] from chin to crown.
const SKULL = [[FRAME.chin / PX, 0.42], [47.6, 0.82], [53, 1], [60, 1], [FRAME.crown / PX, 0.62]];
const S1 = Math.sin(Math.PI / 8);
const S2 = Math.sin((3 * Math.PI) / 8);
const C1 = Math.cos(Math.PI / 8);
const C2 = Math.cos((3 * Math.PI) / 8);

function widthAt(yPx) {
  if (yPx <= SKULL[0][0]) return SKULL[0][1];
  for (let i = 1; i < SKULL.length; i++) {
    if (yPx <= SKULL[i][0]) {
      const [y0, f0] = SKULL[i - 1];
      const [y1, f1] = SKULL[i];
      return f0 + ((f1 - f0) * (yPx - y0)) / (y1 - y0);
    }
  }
  return SKULL[SKULL.length - 1][1];
}

/** Rings of a prism from `[yPx, widthFactor, colour]` rows. */
const rings = (rows, hx, hz) => rows.map(([yp, f, color]) => ({ y: y(yp), rx: hx * f, rz: hz * f, color }));

/**
 * Operations that hug the 8-sided skull (or a same-shaped shell of width
 * factor `fOverride`, e.g. the hair cap).
 */
export function faceOps(hx, hz) {
  /**
   * Z of the skull's surface at (x px, y px). Past the widest vertex
   * (|x| > S2*rx) it clamps to the side facet's z rather than being
   * undefined; don't trust it beyond the silhouette.
   */
  const surfaceZ = (xPx, yPx, fOverride) => {
    const f = fOverride ?? widthAt(yPx);
    const rx = (hx / PX) * f;
    const rz = (hz / PX) * f;
    const ax = Math.abs(xPx);
    let z;
    if (ax <= rx * S1) z = rz * C1;
    else if (ax <= rx * S2) z = rz * (C1 + ((C2 - C1) * (ax - rx * S1)) / (rx * (S2 - S1)));
    else z = rz * C2;
    return z * PX;
  };

  /**
   * A face-front shape, in px: its bottom edge runs from (x0, yb0) to
   * (x1, yb1) and its top from (x0, yt0) to (x1, yt1). Split where the skull's
   * facets change so each piece sits on one facet.
   */
  const strip = (x0, x1, yb0, yb1, yt0, yt1, color, eps = DETAIL, fOverride) => {
    const f = fOverride ?? widthAt((yb0 + yt0) / 2);
    const cuts = [-S2, -S1, S1, S2].map((s) => s * (hx / PX) * f).filter((c) => c > x0 && c < x1);
    const xs = [x0, ...cuts, x1];
    const lerp = (a, b, x) => a + ((b - a) * (x - x0)) / (x1 - x0);
    const parts = [];
    for (let i = 0; i < xs.length - 1; i++) {
      const a = xs[i];
      const b = xs[i + 1];
      const pts = [[a, lerp(yb0, yb1, a)], [b, lerp(yb0, yb1, b)], [b, lerp(yt0, yt1, b)], [a, lerp(yt0, yt1, a)]];
      parts.push(quad(pts.map(([px, py]) => [px * PX, y(py), surfaceZ(px, py, fOverride) + eps]), color, { unlit: true }));
    }
    return join(parts);
  };
  const rect = (x0, x1, y0, y1, color, eps, fOverride) => strip(x0, x1, y0, y0, y1, y1, color, eps, fOverride);
  return { surfaceZ, strip, rect };
}

// -- Skull and ears --

export function buildSkull(skin, { halfHeadX: hx, halfHeadZ: hz }) {
  const parts = [prism(rings([
    [SKULL[0][0], SKULL[0][1], skin.deep], // first row is never rendered
    [SKULL[1][0], SKULL[1][1], skin.deep],
    [SKULL[2][0], SKULL[2][1], skin.shade],
    [SKULL[3][0], SKULL[3][1], skin.skin],
    [SKULL[4][0], SKULL[4][1], skin.skin],
  ], hx, hz), 8, skin.shade, skin.deep)];
  for (const dir of [-1, 1]) {
    const x0 = dir > 0 ? hx * 0.9 : -hx * 0.9 - 0.05;
    parts.push(box([x0, y(52.2), -0.045], [x0 + 0.05, y(56.4), 0.045], skin.skin, { left: skin.shade, right: skin.shade, top: skin.shade, bottom: skin.deep }));
  }
  return join(parts);
}

// -- Face --

/** Eyes, brows, blush, nose and mouth, 0.01 proud of the skull. */
export function buildFace(design, palette, metrics, opts = {}) {
  const { strip, rect } = faceOps(metrics.halfHeadX, metrics.halfHeadZ);
  const d = design ?? {};
  const ex = d.extras ?? {};
  const lashes = Boolean(d.eyes?.lashes);
  const eyeHalfH = { big: 1.9, round: 1.9, smile: 0.7, sharp: 1.2, calm: 1.4 }[d.eyes?.style] ?? 1.5;
  const thick = d.brows === 'thick';
  const parts = [];
  for (const dir of [-1, 1]) {
    const cx = dir * 4.3;
    parts.push(rect(cx - 1.5, cx + 1.5, EYE - eyeHalfH, EYE + eyeHalfH, '#fbfbff'));
    parts.push(rect(cx - 0.9, cx + 0.9, EYE - eyeHalfH * 0.9, EYE + eyeHalfH * 0.9, palette.eyes, DETAIL * 1.4));
    parts.push(rect(cx - 0.5, cx + 0.1, EYE + eyeHalfH * 0.3, EYE + eyeHalfH * 0.75, '#ffffff', DETAIL * 1.8));
    if (lashes) parts.push(rect(cx - 1.9, cx + 1.9, EYE + eyeHalfH, EYE + eyeHalfH + 0.6, '#1e1418', DETAIL * 1.4));

    const [a, b] = dir > 0 ? [1.7, 6.8] : [-6.8, -1.7];
    if (opts.angry) {
      // Drawn down hard at the middle, as patron-head.js does.
      const extra = thick ? 0.7 : 0;
      const [yb0, yb1, yt0, yt1] = dir > 0 ? [1.8, 4.8, 2.6 + extra, 5.6 + extra] : [4.8, 1.8, 5.6 + extra, 2.6 + extra];
      parts.push(strip(a, b, EYE + yb0, EYE + yb1, EYE + yt0, EYE + yt1, palette.brow));
    } else {
      const half = thick ? 0.8 : 0.4;
      const [lo0, lo1] = dir > 0 ? [4.6, 5] : [5, 4.6];
      parts.push(strip(a + 0.5, b - 0.2, EYE + lo0 - half, EYE + lo1 - half, EYE + lo0 + half, EYE + lo1 + half, palette.brow));
    }
  }
  if (metrics.kid || lashes || d.mouth === 'smile') {
    for (const dir of [-1, 1]) parts.push(rect(dir * 5.6 - 1.5, dir * 5.6 + 1.5, EYE - 3.3, EYE - 1.9, '#f2a29a', DETAIL * 0.8));
  }
  parts.push(rect(-0.5, 0.5, EYE - 3.8, EYE - 2.2, palette.skin.deep, DETAIL * 0.8));
  if (!ex.mask) {
    const my = EYE - 6.4;
    if (d.mouth === 'open') {
      parts.push(rect(-1.4, 1.4, my - 1.1, my + 1.1, palette.lips));
      parts.push(rect(-0.9, 0.9, my - 0.7, my + 0.5, '#5a2a30', DETAIL * 1.4));
    } else {
      const w = d.mouth === 'flat' ? 1.6 : 1.8;
      parts.push(rect(-w, w, my - 0.3, my + 0.3, palette.lips));
    }
  }
  return join(parts);
}

// -- Hair --

const CAP_F = 1.1; // the hair cap's rim width factor

export function buildHair(design, palette, { halfHeadX: hx, halfHeadZ: hz }) {
  const hair = palette.hair;
  const back = design.hair?.back;
  const { strip } = faceOps(hx, hz);
  const parts = [];
  if (back === 'bald') {
    for (const dir of [-1, 1]) {
      const x0 = dir > 0 ? hx * 0.92 : -hx * 1.0;
      parts.push(box([x0, y(54), -hz * 0.5], [x0 + hx * 0.08, y(59), hz * 0.05], hair.base, { top: hair.mid, bottom: hair.deep }));
    }
    return join(parts);
  }
  // Three rendered bands (deep, base, mid) plus a shine cap: all four tones.
  parts.push(prism(rings([
    [61.2, CAP_F, hair.deep], // first row is never rendered
    [63.8, 1.15, hair.deep],
    [66.8, 1.0, hair.base],
    [69, 0.5, hair.mid],
  ], hx, hz), 8, hair.shine));
  const fringe = {
    blunt: [-9.1, 9.1, 60.2, 60.2],
    side: [-8.8, 8.4, 58.2, 60.6],
    messy: [-7.8, 7.8, 59.2, 59.2],
    textured: [-8.6, 8.6, 59.8, 59.8],
    parted: [-8, 8, 60.8, 60.8],
  }[design.hair?.fringe];
  // Hung from the cap's radius, not the skull's, so it sits in front of the rim.
  if (fringe) parts.push(strip(fringe[0], fringe[1], fringe[2], fringe[3], 62.6, 62.6, hair.base, DETAIL * 1.2, CAP_F));
  // Side locks, reaching further down and forward for the longer styles.
  const framing = ['long', 'medium', 'bob', 'twintails'].includes(back);
  const sideLen = { long: 8, medium: 7, bob: 7.4, twintails: 4, ponytail: 0, bun: 0, short: -2, braid: 2, curly: 3 }[back] ?? 2;
  for (const dir of [-1, 1]) {
    const x0 = dir > 0 ? hx * 0.9 : -hx * 1.12;
    parts.push(box([x0, y(55 - sideLen), -hz * 0.85], [x0 + hx * 0.22, y(61.5), framing ? hz * 0.25 : -hz * 0.15], hair.base, { top: hair.mid, bottom: hair.deep }));
  }
  return join(parts);
}

/** Hair that falls, hangs or is tied up behind and above the head. */
function buildHairBack(design, palette, { halfHeadX: hx, halfHeadZ: hz }) {
  const hair = palette.hair;
  const ex = design.extras ?? {};
  const back = design.hair?.back;
  const parts = [];
  const fall = { long: 24, medium: 11, bob: 8.6, curly: 6 }[back];
  if (fall) parts.push(box([-hx * 1.08, y(55 - fall), -hz * 1.12], [hx * 1.08, y(63), -hz * 0.6], hair.base, { front: hair.deep, top: hair.mid, bottom: hair.deep }));
  if (back === 'twintails') {
    const tie = hexOr(ex.ribbon, hexOr(ex.bow, '#ff8fb8'));
    for (const dir of [-1, 1]) {
      const tail = prism(rings([[45, 0.14, hair.deep], [50, 0.31, hair.deep], [58, 0.33, hair.base], [64, 0.18, hair.mid]], hx, hz), 6, hair.mid);
      const tx = dir * hx * 1.18;
      const tz = -hz * 0.1;
      parts.push(translate(tail, [tx, 0, tz]));
      parts.push(box([tx - 0.03, y(64.4) - 0.03, tz - 0.03], [tx + 0.03, y(64.4) + 0.03, tz + 0.03], tie));
    }
  }
  if (back === 'ponytail') {
    const tail = prism(rings([[45, 0.2, hair.deep], [52, 0.3, hair.deep], [62, 0.3, hair.base], [70, 0.2, hair.mid]], hx, hz), 6, hair.mid);
    parts.push(translate(tail, [0, 0, -hz * 1.1 - 0.04]));
    parts.push(box([-0.04, y(70) - 0.03, -hz * 1.1 - 0.08], [0.04, y(70) + 0.03, -hz * 1.1], '#e8558f'));
  }
  if (back === 'bun') {
    const bun = prism(rings([[67.4, 0.34, hair.deep], [70.2, 0.56, hair.deep], [73.4, 0.56, hair.base], [75.8, 0.28, hair.mid]], hx, hz), 8, hair.shine, hair.deep);
    parts.push(translate(bun, [0, 0, -hz * 0.1]));
  }
  return join(parts);
}

// -- Facial hair, mask, glasses, earrings --

function buildFacialHair(ex, palette, { halfHeadX: hx, halfHeadZ: hz }) {
  const { rect } = faceOps(hx, hz);
  const parts = [];
  if (ex.beard) {
    const c = hexOr(ex.beard, palette.hair.base);
    // A chin band, with whiskers down each jaw; the mouth stays clear.
    const m = (yp, col) => [yp, widthAt(yp) + 0.04 / hx, col];
    parts.push(prism(rings([m(44.7, c), m(45.6, shadeColor(c, -0.2)), m(46.6, c)], hx, hz), 8, null, shadeColor(c, -0.3)));
    for (const dir of [-1, 1]) {
      const x0 = dir > 0 ? hx * 0.78 : -hx * 1.02;
      parts.push(box([x0, y(47.8), -hz * 0.5], [x0 + hx * 0.24, y(53.4), hz * 0.1], c, { bottom: shadeColor(c, -0.3), top: shadeColor(c, 0.1) }));
    }
  }
  const stache = ex.mustache ?? (ex.beard ? true : null);
  if (stache) parts.push(rect(-3.4, 3.4, EYE - 4.9, EYE - 3.6, hexOr(ex.mustache, hexOr(ex.beard, palette.hair.base)), DETAIL * 1.6));
  return join(parts);
}

function buildMask({ halfHeadX: hx, halfHeadZ: hz }) {
  // Rings sit just outside the skull so the face features are covered.
  const m = (yp, c) => [yp, widthAt(yp) + 0.08 / hx, c];
  return prism(rings([m(44.9, '#e4e4ec'), m(47.2, '#e4e4ec'), m(49.5, '#eeeef2'), m(53.2, '#f6f6f8')], hx, hz), 8, null, '#dcdce4');
}

function buildGlasses(kind, metrics) {
  const { strip, rect } = faceOps(metrics.halfHeadX, metrics.halfHeadZ);
  const square = kind === 'square';
  const frame = square ? '#1e1a22' : '#6a4a32';
  const t = square ? 0.6 : 0.45;
  const [w, ht] = square ? [6.2, 4.6] : [6, 6];
  const e = DETAIL * 2.6;
  const parts = [];
  for (const dir of [-1, 1]) {
    const cx = dir * 4.3;
    parts.push(rect(cx - w / 2, cx + w / 2, EYE + ht / 2 - t, EYE + ht / 2, frame, e));
    parts.push(rect(cx - w / 2, cx + w / 2, EYE - ht / 2, EYE - ht / 2 + t, frame, e));
    parts.push(rect(cx - w / 2, cx - w / 2 + t, EYE - ht / 2 + t, EYE + ht / 2 - t, frame, e));
    parts.push(rect(cx + w / 2 - t, cx + w / 2, EYE - ht / 2 + t, EYE + ht / 2 - t, frame, e));
    parts.push(rect(cx - 1.6, cx - 0.6, EYE + 0.9, EYE + 1.5, '#ffffff', e * 1.2));
    const [t0, t1] = dir > 0 ? [w / 2 + 4.3, 9.1] : [-9.1, -(w / 2 + 4.3)];
    parts.push(strip(t0, t1, EYE - 0.9, EYE - 1.5, EYE - 0.4, EYE - 1.0, frame, e));
  }
  parts.push(rect(-1.3, 1.3, EYE - 0.1, EYE + 0.5, frame, e));
  return join(parts);
}

/** Sunglasses pushed up onto the front of the head. */
function buildSunglasses({ halfHeadX: hx, halfHeadZ: hz }) {
  const zf = hz * 0.924 * 1.05 + 0.02;
  const parts = [];
  for (const dir of [-1, 1]) {
    const cx = dir * 3.8 * PX;
    parts.push(box([cx - 0.07, y(64.4), hz * 0.85], [cx + 0.07, y(67.4), zf], '#2a2230', { top: '#4a4254', front: '#2a2230' }));
  }
  parts.push(box([-0.025, y(65.6), hz * 0.85], [0.025, y(66.2), zf], '#c9a24a'));
  return join(parts);
}

function buildEarrings(colour, { halfHeadX: hx }) {
  const c = hexOr(colour, '#c9a24a');
  return join([-1, 1].map((dir) => {
    const cx = dir * hx * 1.04;
    return box([cx - 0.02, y(49.6), -0.02], [cx + 0.02, y(52.4), 0.02], c, { bottom: shadeColor(c, -0.25) });
  }));
}

// -- Headwear --

/** A flat-topped dome of rings (see the note on `prism` bands at the top). */
const dome = (rows, hx, hz, capTop) => prism(rings(rows, hx, hz), 8, capTop);
/** A brim: two rings, a lit top, a dark underside. */
const brim = (yLow, yHigh, f, c, hx, hz) => prism(rings([[yLow, f, shadeColor(c, -0.2)], [yHigh, f, c]], hx, hz), 8, c, shadeColor(c, -0.3));

export function buildHeadwear(ex, back, { halfHeadX: hx, halfHeadZ: hz }) {
  const sh = shadeColor;
  const parts = [];
  if (ex.beanie) {
    const c = hexOr(ex.beanie, '#e8c25a');
    parts.push(dome([[60.2, 1.22, sh(c, -0.3)], [63.4, 1.25, sh(c, -0.3)], [67, 1.2, sh(c, -0.1)], [70.5, 0.95, c], [72.5, 0.4, sh(c, 0.12)]], hx, hz, sh(c, 0.15)));
  }
  const capLike = (c, bottom, peakY, peakLen) => {
    parts.push(dome([[bottom, 1.2, sh(c, -0.25)], [bottom + 2.5, 1.24, sh(c, -0.25)], [bottom + 6, 1.18, c], [bottom + 8.4, 0.62, sh(c, 0.08)]], hx, hz, sh(c, 0.12)));
    parts.push(box([-hx * 0.7, y(peakY), hz * 1.05], [hx * 0.7, y(peakY + 1), hz * 1.05 + peakLen], sh(c, -0.2), { top: sh(c, 0.05), bottom: sh(c, -0.35) }));
  };
  if (ex.cap) capLike(hexOr(ex.cap, '#8a6a4a'), 62, 61.6, 0.15);
  if (ex.baseballCap) capLike(hexOr(ex.baseballCap, '#3a6ab0'), 61.2, 60.6, 0.19);
  if (ex.bikeHelmet) {
    const c = hexOr(ex.bikeHelmet, '#3a8ac0');
    parts.push(dome([[59.5, 1.26, sh(c, -0.15)], [63.5, 1.3, sh(c, -0.15)], [68, 1.22, c], [71.2, 0.7, sh(c, 0.15)]], hx, hz, sh(c, 0.3)));
  }
  if (ex.bucketHat) {
    const c = hexOr(ex.bucketHat, '#c8b88a');
    parts.push(prism(rings([[61.4, 1.65, sh(c, -0.1)], [63.2, 1.3, sh(c, -0.1)]], hx, hz), 8, sh(c, -0.1), sh(c, -0.3)));
    parts.push(dome([[63, 1.24, c], [67, 1.24, c], [71, 1.0, sh(c, 0.1)]], hx, hz, sh(c, 0.12)));
  }
  if (ex.sunhat) {
    const c = hexOr(ex.sunhat, '#e8d29a');
    parts.push(brim(62.2, 63, 1.9, c, hx, hz));
    parts.push(dome([[62.8, 1.22, '#e8709c'], [66, 1.26, '#e8709c'], [70.4, 1.08, sh(c, 0.05)]], hx, hz, sh(c, 0.1)));
  }
  if (ex.witchHat) {
    const c = hexOr(ex.witchHat, '#3a2a4a');
    parts.push(brim(62.2, 63, 1.67, c, hx, hz));
    parts.push(dome([[62.8, 1.22, c], [65.6, 1.2, '#e8c25a'], [68, 1.1, c], [78, 0.55, sh(c, 0.1)], [87, 0.08, c]], hx, hz, c));
  }
  if (ex.beret) {
    const c = hexOr(ex.beret, '#a03a4a');
    parts.push(translate(dome([[65, 1.2, sh(c, -0.2)], [67, 1.42, sh(c, -0.2)], [70, 1.42, c], [72.2, 0.9, sh(c, 0.15)]], hx, hz, sh(c, 0.15)), [-0.04, 0, 0]));
  }
  if (ex.hachimaki) {
    parts.push(prism(rings([[61.6, 1.2, '#e8e8f0'], [64.4, 1.2, '#ffffff']], hx, hz), 8));
    const { rect } = faceOps(hx, hz);
    parts.push(rect(-1.2, 1.2, 62.4, 64.2, hexOr(ex.hachimaki, '#d23a4a'), DETAIL * 2, 1.2));
  }
  if (ex.bandana) {
    const c = hexOr(ex.bandana, '#d84a5a');
    if (back === 'ponytail') {
      parts.push(prism(rings([[61.4, 1.2, sh(c, -0.1)], [64.2, 1.2, c]], hx, hz), 8));
    } else {
      parts.push(dome([[60, 1.2, sh(c, -0.2)], [63, 1.23, sh(c, -0.2)], [67, 1.2, c], [70.4, 0.75, sh(c, 0.1)]], hx, hz, sh(c, 0.12)));
      parts.push(box([hx * 1.15, y(62.6), -0.04], [hx * 1.15 + 0.08, y(65.2), 0.04], c, { bottom: sh(c, -0.3) }));
    }
  }
  if (ex.flowerCrown) {
    const c = hexOr(ex.flowerCrown, '#f08ab0');
    const spots = [[-9, 64.6], [-6.4, 67.6], [-3.2, 69.2], [0, 69.8], [3.2, 69.2], [6.4, 67.6], [9, 64.6]];
    spots.forEach(([fx, fy], i) => {
      const col = i % 3 === 1 ? '#ffffff' : i % 3 === 2 ? '#ffd166' : c;
      const r = hx / PX * 1.12;
      const z = hz * 1.1 * Math.sqrt(Math.max(0.05, 1 - (fx / r) ** 2)) * (fy > 68 ? 0.7 : 1);
      parts.push(box([fx * PX - 0.035, y(fy) - 0.035, z - 0.03], [fx * PX + 0.035, y(fy) + 0.035, z + 0.03], col, { top: sh(col, 0.1) }));
    });
  }
  if (ex.catEars) {
    const c = hexOr(ex.catEars, '#8a5a3a');
    for (const dir of [-1, 1]) {
      const ear = prism(rings([[65, 0.3, c], [69, 0.2, sh(c, -0.2)], [74, 0.02, sh(c, 0.1)]], hx, hz), 4, sh(c, 0.1));
      parts.push(translate(ear, [dir * hx * 0.62, 0, 0]));
    }
  }
  return join(parts);
}

function buildHeadphones(colour, { halfHeadX: hx }) {
  const c = hexOr(colour, '#ffffff');
  const edge = shadeColor(c, -0.3);
  const out = hx * 1.12;
  const parts = [];
  for (const dir of [-1, 1]) {
    const x0 = dir > 0 ? out : -out - 0.09;
    parts.push(box([x0, y(51.5), -0.07], [x0 + 0.09, y(57.5), 0.07], c, { left: edge, right: edge, bottom: edge, top: shadeColor(c, 0.1) }));
    const px0 = dir > 0 ? out + 0.02 : -out - 0.05;
    parts.push(box([px0, y(57.5), -0.015], [px0 + 0.03, y(69.4), 0.015], edge));
  }
  parts.push(box([-out - 0.05, y(69.4), -0.02], [out + 0.05, y(70.4), 0.02], edge, { top: shadeColor(c, 0.1) }));
  return join(parts);
}

/**
 * The whole head, `FRAME.chin` up, already scaled for a kid and leaned forward
 * for an elder. `opts.angry` scowls (Karen). Unknown hair/extras are ignored.
 */
export function buildHead(design, palette, metrics, opts = {}) {
  const d = design ?? {};
  const ex = d.extras ?? {};
  const parts = [
    buildSkull(palette.skin, metrics),
    buildFace(d, palette, metrics, opts),
    buildHair(d, palette, metrics),
    buildHairBack(d, palette, metrics),
    buildFacialHair(ex, palette, metrics),
    buildHeadwear(ex, d.hair?.back, metrics),
  ];
  if (ex.mask) parts.push(buildMask(metrics));
  if (ex.glasses) parts.push(buildGlasses(ex.glasses, metrics));
  if (ex.sunglasses) parts.push(buildSunglasses(metrics));
  if (ex.earrings) parts.push(buildEarrings(ex.earrings, metrics));
  if (ex.headphones) parts.push(buildHeadphones(ex.headphones, metrics));
  const mesh = join(parts);
  for (const f of mesh.faces) f.unlit = true;
  let out = metrics.headScale === 1 ? mesh : scaleAbout(mesh, metrics.headScale, FRAME.chin);
  if (metrics.elder) out = translate(out, [0, 0, STOOP]);
  return out;
}
