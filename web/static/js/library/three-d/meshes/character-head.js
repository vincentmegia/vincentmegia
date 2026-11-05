// The 3D patron's head, from the chin up: skull, ears, face, hair, and
// everything worn on the head. Built to match patron-head.js (the 2D art).
//
// Every face is `unlit`: the scene light comes from above and would grey out a
// forward-facing face, so the shading is baked into the ring and band colours
// instead (as the 2D bakes it into what it paints). Depth fog still applies.
//
// Pure and DOM-free. Dimensions below are 2D px (y measured up from the feet,
// like FRAME) and divide by PX; x is px from the centre line.

import { emptyMesh, merge, box, prism, quad, translate, scaleAbout } from './geom.js';
import { FRAME, PX } from './character-frame.js';
import { shadeColor } from '../../../shared/people.js';

const HEX6 = /^#[0-9a-f]{6}$/i;
const hexOr = (v, fallback) => (typeof v === 'string' && HEX6.test(v) ? v : fallback);
const y = (px) => px * PX;

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

export function buildHead(design, palette, metrics, opts = {}) {
  const d = design ?? {};
  const hx = metrics.halfHeadX;
  const hz = metrics.halfHeadZ;
  const skin = palette.skin;
  const hair = palette.hair;
  const ex = d.extras ?? {};
  const back = d.hair?.back;
  const mesh = emptyMesh();
  const add = (part) => merge(mesh, part);

  /** Z of the 8-sided skull's surface at (x px, y px). */
  const surfaceZ = (xPx, yPx) => {
    const f = widthAt(yPx);
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
   * A face-front shape hugging the skull, in px: its bottom edge runs from
   * (x0, yb0) to (x1, yb1) and its top from (x0, yt0) to (x1, yt1). It is split
   * where the skull's facets change, so each piece sits on one facet.
   */
  const strip = (x0, x1, yb0, yb1, yt0, yt1, color, eps = DETAIL) => {
    const f = widthAt((yb0 + yt0) / 2);
    const cuts = [-S2, -S1, S1, S2].map((s) => s * (hx / PX) * f).filter((c) => c > x0 && c < x1);
    const xs = [x0, ...cuts, x1];
    const lerp = (a, b, x) => a + ((b - a) * (x - x0)) / (x1 - x0);
    for (let i = 0; i < xs.length - 1; i++) {
      const a = xs[i];
      const b = xs[i + 1];
      const pts = [[a, lerp(yb0, yb1, a)], [b, lerp(yb0, yb1, b)], [b, lerp(yt0, yt1, b)], [a, lerp(yt0, yt1, a)]];
      add(quad(pts.map(([px, py]) => [px * PX, y(py), surfaceZ(px, py) + eps]), color, { unlit: true }));
    }
  };
  const rect = (x0, x1, y0, y1, color, eps) => strip(x0, x1, y0, y0, y1, y1, color, eps);

  // -- Skull and ears --
  add(prism(rings([
    [SKULL[0][0], SKULL[0][1], skin.deep],
    [SKULL[1][0], SKULL[1][1], skin.shade],
    [SKULL[2][0], SKULL[2][1], skin.skin],
    [SKULL[3][0], SKULL[3][1], skin.skin],
    [SKULL[4][0], SKULL[4][1], skin.shade],
  ], hx, hz), 8, skin.shade, skin.deep));
  for (const dir of [-1, 1]) {
    const x0 = dir > 0 ? hx * 0.9 : -hx * 0.9 - 0.05;
    add(box([x0, y(52.2), -0.045], [x0 + 0.05, y(56.4), 0.045], skin.skin, { left: skin.shade, right: skin.shade, top: skin.shade, bottom: skin.deep }));
  }

  // -- Face --
  const eyeStyle = d.eyes?.style;
  const lashes = Boolean(d.eyes?.lashes);
  const kid = metrics.kid;
  const eyeHalfH = { big: 1.9, round: 1.9, smile: 0.7, sharp: 1.2, calm: 1.4 }[eyeStyle] ?? 1.5;
  for (const dir of [-1, 1]) {
    const cx = dir * 4.3;
    rect(cx - 1.5, cx + 1.5, EYE - eyeHalfH, EYE + eyeHalfH, '#fbfbff');
    rect(cx - 0.9, cx + 0.9, EYE - eyeHalfH * 0.9, EYE + eyeHalfH * 0.9, palette.eyes, DETAIL * 1.4);
    rect(cx - 0.5, cx + 0.1, EYE + eyeHalfH * 0.3, EYE + eyeHalfH * 0.75, '#ffffff', DETAIL * 1.8);
    if (lashes) rect(cx - 1.9, cx + 1.9, EYE + eyeHalfH, EYE + eyeHalfH + 0.6, '#1e1418', DETAIL * 1.4);
  }
  const angry = Boolean(opts.angry);
  for (const dir of [-1, 1]) {
    const [a, b] = dir > 0 ? [1.7, 6.8] : [-6.8, -1.7];
    if (angry) {
      // Drawn down hard at the middle, as patron-head.js does.
      const [yb0, yb1, yt0, yt1] = dir > 0 ? [1.8, 4.8, 2.6, 5.6] : [4.8, 1.8, 5.6, 2.6];
      strip(a, b, EYE + yb0, EYE + yb1, EYE + yt0, EYE + yt1, palette.brow);
    } else {
      const half = d.brows === 'thick' ? 0.8 : 0.4;
      const [lo0, lo1] = dir > 0 ? [4.6, 5] : [5, 4.6];
      strip(a + 0.5, b - 0.2, EYE + lo0 - half, EYE + lo1 - half, EYE + lo0 + half, EYE + lo1 + half, palette.brow);
    }
  }
  if (kid || lashes || d.mouth === 'smile') {
    for (const dir of [-1, 1]) rect(dir * 5.6 - 1.5, dir * 5.6 + 1.5, EYE - 3.3, EYE - 1.9, '#f2a29a', DETAIL * 0.8);
  }
  rect(-0.5, 0.5, EYE - 3.8, EYE - 2.2, skin.deep, DETAIL * 0.8);
  if (!ex.mask) {
    const my = EYE - 6.4;
    if (d.mouth === 'open') {
      rect(-1.4, 1.4, my - 1.1, my + 1.1, palette.lips);
      rect(-0.9, 0.9, my - 0.7, my + 0.5, '#5a2a30', DETAIL * 1.4);
    } else {
      rect(d.mouth === 'flat' ? -1.6 : -1.8, d.mouth === 'flat' ? 1.6 : 1.8, my - 0.3, my + 0.3, palette.lips);
    }
  }

  // -- Hair --
  const bald = back === 'bald';
  if (!bald) {
    add(prism(rings([
      [61.2, 1.1, hair.deep],
      [63.8, 1.15, hair.base],
      [66.8, 1.0, hair.mid],
      [69, 0.5, hair.shine],
    ], hx, hz), 8, hair.mid));
    const fringe = {
      blunt: [-9.1, 9.1, 60.2, 60.2],
      side: [-8.8, 8.4, 58.2, 60.6],
      messy: [-7.8, 7.8, 59.2, 59.2],
      textured: [-8.6, 8.6, 59.8, 59.8],
      parted: [-8, 8, 60.8, 60.8],
    }[d.hair?.fringe];
    if (fringe) strip(fringe[0], fringe[1], fringe[2], fringe[3], 62.6, 62.6, hair.base, DETAIL * 1.2);
    // Side locks, reaching further down and forward for the longer styles.
    const framing = ['long', 'medium', 'bob', 'twintails'].includes(back);
    const sideLen = { long: 8, medium: 7, bob: 7.4, twintails: 4, ponytail: 0, bun: 0, short: -2, braid: 2, curly: 3 }[back] ?? 2;
    for (const dir of [-1, 1]) {
      const x0 = dir > 0 ? hx * 0.9 : -hx * 1.12;
      add(box([x0, y(55 - sideLen), -hz * 0.85], [x0 + hx * 0.22, y(61.5), framing ? hz * 0.25 : -hz * 0.15], hair.base, { top: hair.mid, bottom: hair.deep }));
    }
  } else {
    for (const dir of [-1, 1]) {
      const x0 = dir > 0 ? hx * 0.92 : -hx * 1.0;
      add(box([x0, y(54), -hz * 0.5], [x0 + hx * 0.08, y(59), hz * 0.05], hair.base, { top: hair.mid, bottom: hair.deep }));
    }
  }

  const fall = { long: 24, medium: 11, bob: 8.6, curly: 6 }[back];
  if (fall) add(box([-hx * 1.08, y(55 - fall), -hz * 1.12], [hx * 1.08, y(63), -hz * 0.6], hair.base, { front: hair.deep, top: hair.mid, bottom: hair.deep }));
  if (back === 'twintails') {
    const tie = hexOr(ex.ribbon, hexOr(ex.bow, '#ff8fb8'));
    for (const dir of [-1, 1]) {
      const tail = prism(rings([[45, 0.14, hair.deep], [50, 0.31, hair.base], [58, 0.33, hair.mid], [64, 0.18, hair.mid]], hx, hz), 6, hair.mid);
      add(translate(tail, [dir * hx * 1.18, 0, -hz * 0.1]));
      add(box([dir * hx * 1.18 - 0.03, y(64.4) - 0.03, -hz * 0.1 - 0.03], [dir * hx * 1.18 + 0.03, y(64.4) + 0.03, -hz * 0.1 + 0.03], tie));
    }
  }
  if (back === 'ponytail') {
    const tail = prism(rings([[45, 0.2, hair.deep], [52, 0.3, hair.base], [62, 0.3, hair.mid], [70, 0.2, hair.mid]], hx, hz), 6, hair.mid);
    add(translate(tail, [0, 0, -hz * 1.1 - 0.04]));
    add(box([-0.04, y(70) - 0.03, -hz * 1.1 - 0.08], [0.04, y(70) + 0.03, -hz * 1.1], '#e8558f'));
  }
  if (back === 'bun') {
    const bun = prism(rings([[67.4, 0.34, hair.deep], [70.2, 0.56, hair.base], [73.4, 0.56, hair.mid], [75.8, 0.28, hair.shine]], hx, hz), 8, hair.shine, hair.deep);
    add(translate(bun, [0, 0, -hz * 0.1]));
  }

  // -- Moustache and worn extras --
  if (ex.mustache) rect(-3.4, 3.4, EYE - 4.9, EYE - 3.6, hexOr(ex.mustache, hair.base), DETAIL * 1.6);
  if (ex.mask) {
    // Rings sit just outside the skull so the face features are covered.
    const m = (yp, c) => [yp, widthAt(yp) + 0.08 / hx, c];
    add(prism(rings([m(44.9, '#e4e4ec'), m(49.5, '#eeeef2'), m(53.2, '#f6f6f8')], hx, hz), 8, null, '#dcdce4'));
  }
  if (ex.glasses) {
    const square = ex.glasses === 'square';
    const frame = square ? '#1e1a22' : '#6a4a32';
    const t = square ? 0.6 : 0.45;
    const [w, ht] = square ? [6.2, 4.6] : [6, 6];
    const e = DETAIL * 2.6;
    for (const dir of [-1, 1]) {
      const cx = dir * 4.3;
      rect(cx - w / 2, cx + w / 2, EYE + ht / 2 - t, EYE + ht / 2, frame, e);
      rect(cx - w / 2, cx + w / 2, EYE - ht / 2, EYE - ht / 2 + t, frame, e);
      rect(cx - w / 2, cx - w / 2 + t, EYE - ht / 2 + t, EYE + ht / 2 - t, frame, e);
      rect(cx + w / 2 - t, cx + w / 2, EYE - ht / 2 + t, EYE + ht / 2 - t, frame, e);
      rect(cx - 1.6, cx - 0.6, EYE + 0.9, EYE + 1.5, '#ffffff', e * 1.2);
      const [t0, t1] = dir > 0 ? [w / 2 + 4.3, 9.1] : [-9.1, -(w / 2 + 4.3)];
      strip(t0, t1, EYE - 0.9, EYE - 1.5, EYE - 0.4, EYE - 1.0, frame, e);
    }
    rect(-1.3, 1.3, EYE - 0.1, EYE + 0.5, frame, e);
  }
  if (ex.beanie) {
    const c = hexOr(ex.beanie, '#e8c25a');
    add(prism(rings([[60.2, 1.22, shadeColor(c, -0.3)], [63.4, 1.25, shadeColor(c, -0.1)], [67, 1.2, c], [70.5, 0.95, shadeColor(c, 0.12)], [72.5, 0.4, shadeColor(c, 0.15)]], hx, hz), 8, shadeColor(c, 0.15)));
  }
  if (ex.cap) {
    const c = hexOr(ex.cap, '#8a6a4a');
    add(prism(rings([[62, 1.2, shadeColor(c, -0.25)], [64.5, 1.24, c], [68, 1.18, shadeColor(c, 0.08)], [70.4, 0.62, shadeColor(c, 0.12)]], hx, hz), 8, shadeColor(c, 0.12)));
    add(box([-hx * 0.7, y(61.6), hz * 1.05], [hx * 0.7, y(62.6), hz * 1.05 + 0.15], shadeColor(c, -0.2), { top: shadeColor(c, 0.05), bottom: shadeColor(c, -0.35) }));
  }
  if (ex.bikeHelmet) {
    const c = hexOr(ex.bikeHelmet, '#3a8ac0');
    add(prism(rings([[59.5, 1.26, shadeColor(c, -0.15)], [63.5, 1.3, c], [68, 1.22, shadeColor(c, 0.15)], [71.2, 0.7, shadeColor(c, 0.3)]], hx, hz), 8, shadeColor(c, 0.3)));
  }
  if (ex.sunhat) {
    const c = hexOr(ex.sunhat, '#e8d29a');
    add(prism(rings([[62.2, 1.9, shadeColor(c, -0.2)], [63, 1.9, c]], hx, hz), 8, c, shadeColor(c, -0.3)));
    add(prism(rings([[62.8, 1.22, '#e8709c'], [66, 1.26, shadeColor(c, 0.05)], [70.4, 1.08, shadeColor(c, 0.1)]], hx, hz), 8, shadeColor(c, 0.1)));
  }
  if (ex.hachimaki) {
    add(prism(rings([[61.6, 1.2, '#e8e8f0'], [64.4, 1.2, '#ffffff']], hx, hz), 8));
    const zf = surfaceZ(0, 63) * 1.2 + 0.02;
    add(quad([[-0.05, y(63.2) - 0.05, zf], [0.05, y(63.2) - 0.05, zf], [0.05, y(63.2) + 0.05, zf], [-0.05, y(63.2) + 0.05, zf]], hexOr(ex.hachimaki, '#d23a4a'), { unlit: true }));
  }
  if (ex.catEars) {
    const c = hexOr(ex.catEars, '#8a5a3a');
    for (const dir of [-1, 1]) {
      const ear = prism(rings([[65, 0.3, shadeColor(c, -0.2)], [69, 0.2, c], [74, 0.02, shadeColor(c, 0.1)]], hx, hz), 4, shadeColor(c, 0.1));
      add(translate(ear, [dir * hx * 0.62, 0, 0]));
    }
  }
  if (ex.headphones) {
    const c = hexOr(ex.headphones, '#ffffff');
    const edge = shadeColor(c, -0.3);
    const out = hx * 1.12;
    for (const dir of [-1, 1]) {
      const x0 = dir > 0 ? out : -out - 0.09;
      add(box([x0, y(51.5), -0.07], [x0 + 0.09, y(57.5), 0.07], c, { left: edge, right: edge, bottom: edge, top: shadeColor(c, 0.1) }));
      const px0 = dir > 0 ? out + 0.02 : -out - 0.05;
      add(box([px0, y(57.5), -0.015], [px0 + 0.03, y(69.4), 0.015], edge));
    }
    add(box([-out - 0.05, y(69.4), -0.02], [out + 0.05, y(70.4), 0.02], edge, { top: shadeColor(c, 0.1) }));
  }

  for (const f of mesh.faces) f.unlit = true;
  let out = metrics.headScale === 1 ? mesh : scaleAbout(mesh, metrics.headScale, FRAME.chin);
  if (metrics.elder) out = translate(out, [0, 0, STOOP]);
  return out;
}
