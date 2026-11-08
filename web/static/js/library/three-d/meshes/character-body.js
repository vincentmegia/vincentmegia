// The body of the 3D patron, chin down: shoes, legs, lower garment, torso,
// sleeves, hands and neck, built from the same 2D design (patron.js) the
// top-down view draws. Pure and DOM-free; feet at y = 0, facing +Z, full size
// (the caller applies metrics.ageScale to the whole figure).
//
// Dimensions are 2D art px, written as patron.js writes them (y up from its
// drawing origin, so bodyPath's -20.6 is 20.6 here); `artY` converts them once
// into scene units above the floor. See character-frame.js.

import { shadeColor } from '../../../shared/people.js';
import { box, prism, merge, emptyMesh } from './geom.js';
// CIRC is the head's too: one constant, so the head and the body can never
// widen by different amounts. It assumes SIDES === 8, as the head's prisms do.
import { ART, FRAME, PX, CIRC, artY } from './character-frame.js';

const SIDES = 8;
const PROUD = 0.01;

const WAIST_Y = artY(21);
const TORSO_HEM_Y = artY(20.6);

/** Half-width of the flat front face of the torso octagon at half-width `half`. */
const frontHalf = (half) => Math.tan(Math.PI / SIDES) * half;

function shoes(palette, legX, legHalf) {
  const mesh = emptyMesh();
  for (const dir of [-1, 1]) {
    const half = legHalf + 0.15 * PX;
    merge(
      mesh,
      box(
        [dir * legX - half, FRAME.foot, -legHalf],
        [dir * legX + half, FRAME.shoeTop, legHalf + 3 * PX],
        palette.shoes,
      ),
    );
  }
  return mesh;
}

/**
 * Shin to hem. `bakedSkin` marks the faces `unlit` when the colour is a skin
 * tone (bare legs under a skirt or shorts): see the note on buildBody. The 2D
 * paints a bare leg as one flat fill with a thin crease, so flat is faithful.
 */
function legs(colour, legX, legHalf, bakedSkin) {
  const mesh = emptyMesh();
  for (const dir of [-1, 1]) {
    const part = box(
      [dir * legX - legHalf, FRAME.shoeTop, -legHalf],
      [dir * legX + legHalf, FRAME.hem, legHalf],
      colour,
    );
    if (bakedSkin) for (const f of part.faces) f.unlit = true;
    merge(mesh, part);
  }
  return mesh;
}

function skirt(design, palette, metrics) {
  const o = design.outfit ?? {};
  const long = o.kind === 'dress' || o.kind === 'apron' || o.kind === 'hanbok' || metrics.elder;
  // patron.js drawLowerGarment: hem = long ? -7 : -10.
  const hemY = artY(long ? 7 : 10);
  const waistHalf = metrics.halfTorso + 0.02 * PX;
  const flare = (k) => 1 + (11.4 * PX / waistHalf - 1) * k;
  const ring = (y, k, color) => ({
    y,
    rx: waistHalf * flare(k) * CIRC,
    rz: waistHalf * flare(k) * 0.7 * CIRC,
    color,
  });
  return prism(
    [ring(hemY, 1, palette.skirt), ring((hemY + WAIST_Y) / 2, 0.55, shadeColor(palette.skirt, -0.1)), ring(WAIST_Y, 0, palette.skirt)],
    SIDES,
  );
}

function shortsGarment(palette, metrics) {
  const mesh = emptyMesh();
  const outer = Math.min(7.6 * PX, metrics.halfTorso - 0.2 * PX);
  for (const dir of [-1, 1]) {
    const [a, b] = dir < 0 ? [-outer, -0.3 * PX] : [0.3 * PX, outer];
    merge(mesh, box([a, artY(13.4), -metrics.depth * 0.9], [b, TORSO_HEM_Y, metrics.depth * 0.9], palette.bottom));
  }
  return mesh;
}

function hips(palette, metrics) {
  return box(
    [-metrics.halfTorso * 0.97, FRAME.hem, -metrics.depth * 0.9],
    [metrics.halfTorso * 0.97, TORSO_HEM_Y, metrics.depth * 0.9],
    palette.bottom,
  );
}

/**
 * The torso's rings, bottom to top: `[art-y px, half-width, half-depth]`, off
 * patron.js's bodyPath (-20.6 hem, the -30 waist pinch, -38 shoulder, and the
 * shoulder corners at -43.4 where the 2D path turns in to the neck).
 * `arms` reads the same rows, so a sleeve can never sit outside the body.
 */
function torsoRings(metrics) {
  const w = metrics.halfTorso;
  const s = metrics.halfShoulder;
  const d = metrics.depth;
  return [
    [20.6, w, d],
    [30, w - 0.4 * PX, d],
    [38, s, d],
    [ART.shoulder, s * 0.7, d * 0.8],
  ];
}

/** Half-width of the torso at art-y `yp`, along torso()'s rings (clamped outside them). */
function torsoHalfAt(rows, yp) {
  if (yp <= rows[0][0]) return rows[0][1];
  for (let i = 1; i < rows.length; i++) {
    if (yp <= rows[i][0]) {
      const [y0, h0] = rows[i - 1];
      const [y1, h1] = rows[i];
      return h0 + ((h1 - h0) * (yp - y0)) / (y1 - y0);
    }
  }
  return rows[rows.length - 1][1];
}

/** The narrowest the torso gets anywhere between art-y `yb` and `yt`, ring knots included. */
function torsoNarrowest(rows, yb, yt) {
  let half = Math.min(torsoHalfAt(rows, yb), torsoHalfAt(rows, yt));
  for (const [yp, h] of rows) if (yp > yb && yp < yt) half = Math.min(half, h);
  return half;
}

function torso(palette, metrics) {
  const tints = [
    shadeColor(palette.top, -0.16),
    shadeColor(palette.top, -0.1),
    palette.top,
    shadeColor(palette.top, 0.1),
  ];
  return prism(
    torsoRings(metrics).map(([yp, half, depth], i) => ({ y: artY(yp), rx: half * CIRC, rz: depth * CIRC, color: tints[i] })),
    SIDES,
    shadeColor(palette.top, 0.1),
  );
}

/** Flat panels laid 0.01 proud of the torso's vertical front face (below the shoulder slope). */
function frontLayers(palette, metrics) {
  const mesh = emptyMesh();
  const fh = frontHalf(metrics.halfTorso - 0.4 * PX) * 0.95;
  const panel = (half, y0, y1, color, proud) =>
    merge(mesh, box([-half, y0, metrics.depth - 0.002], [half, y1, metrics.depth + proud], color));
  if (palette.inner) panel(Math.min(1.8 * PX, fh), artY(26), artY(38), palette.inner, PROUD);
  if (palette.tie) panel(Math.min(0.9 * PX, fh), artY(28), artY(38), palette.tie, 2 * PROUD);
  if (palette.apron) panel(fh, artY(21), artY(33), palette.apron, 3 * PROUD);
  if (palette.trim) panel(fh, TORSO_HEM_Y, artY(22), palette.trim, PROUD);
  return mesh;
}

// The sleeve's y bands, in art px. Its inner edge used to be pinned at the
// torso's hem half-width for the whole 28 -> 43 run, so above the 38 px
// shoulder ring — where torsoRings turns in to halfShoulder * 0.7 — each
// sleeve stood 0.6-1.7 px clear of the body. One box per band instead, each
// set to the narrowest the torso gets inside that band, follows the shoulder
// slope the way the 2D's sleeve()/swingArm do. The 38/40/41.5 cuts keep every
// step under 0.9 px; the band below 38 spans the 30 px waist knot, which
// torsoNarrowest accounts for.
const SLEEVE_BANDS = [28, 38, 40, 41.5, 43];

function arms(palette, metrics) {
  const mesh = emptyMesh();
  const armW = 3 * PX;
  const armZ = 2.4 * PX;
  const tuck = 0.02 * PX; // tucked into the torso, so no seam shows
  const rows = torsoRings(metrics);
  for (const dir of [-1, 1]) {
    for (let i = 0; i < SLEEVE_BANDS.length - 1; i++) {
      const [yb, yt] = [SLEEVE_BANDS[i], SLEEVE_BANDS[i + 1]];
      const inner = torsoNarrowest(rows, yb, yt) - tuck;
      const [a, b] = dir < 0 ? [-(inner + armW), -inner] : [inner, inner + armW];
      merge(mesh, box([a, artY(yb), -armZ], [b, artY(yt), armZ], palette.top));
    }
    const cx = dir * (torsoNarrowest(rows, SLEEVE_BANDS[0], SLEEVE_BANDS[1]) - tuck + armW / 2);
    const hand = prism(
      [
        { y: artY(24), rx: 1.4 * PX, rz: 1.4 * PX, color: palette.skin.skin },
        { y: artY(28), rx: 1.7 * PX, rz: 1.7 * PX, color: palette.skin.skin },
      ],
      6,
      palette.skin.shade,
      palette.skin.deep,
    );
    for (const f of hand.faces) f.unlit = true; // baked skin: see buildBody
    merge(mesh, { vertices: hand.vertices.map((v) => [v[0] + cx, v[1], v[2]]), faces: hand.faces });
  }
  return mesh;
}

/**
 * @param {object} design the patron's 2D design (patron.js)
 * @param {ReturnType<import('./character-palette.js').paletteFor>} palette
 * @param {ReturnType<import('./character-frame.js').metricsFor>} metrics
 *
 * One material, one rule: the skin tones carry their own shading (shared
 * people.js bakes skin/shade/deep out of one hex), so every surface painted in
 * them opts out of the scene light — the whole head does, and so do the hands,
 * the neck and bare legs here. Clothing keeps its flat design colours and is
 * lit. Before this, the hands and the face shared a hex but not a rule, and the
 * same #efc49f rendered rgb(239,196,159) on the face against rgb(174,143,116)
 * on the hands: a 27% step across the wrist and the chin.
 */
export function buildBody(design, palette, metrics) {
  const bare = !metrics.trousers; // a skirt or shorts: legs below are not trousers
  const legX = (bare ? 3.1 : 3.8) * PX;
  const legHalf = (bare ? 1.98 : 2.95) * PX;
  // patron.js legFill: skirt -> legs ?? skin; shorts -> skin; trousers -> bottom.
  const legColour = palette.skirt ? (palette.legs ?? palette.skin.skin) : bare ? palette.skin.skin : palette.bottom;
  const legsAreSkin = legColour === palette.skin.skin;

  const mesh = emptyMesh();
  merge(mesh, shoes(palette, legX, legHalf));
  merge(mesh, legs(legColour, legX, legHalf, legsAreSkin));
  if (palette.skirt) merge(mesh, skirt(design, palette, metrics));
  else merge(mesh, bare ? shortsGarment(palette, metrics) : hips(palette, metrics));
  merge(mesh, torso(palette, metrics));
  merge(mesh, frontLayers(palette, metrics));
  merge(mesh, arms(palette, metrics));
  const neck = box([-2.2 * PX, FRAME.shoulder, -2 * PX], [2.2 * PX, FRAME.chin, 2 * PX], palette.skin.deep);
  for (const f of neck.faces) f.unlit = true; // baked skin, and it meets the unlit chin
  merge(mesh, neck);
  return mesh;
}
