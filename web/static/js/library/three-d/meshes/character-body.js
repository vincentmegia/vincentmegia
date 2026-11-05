// The body of the 3D patron, chin down: shoes, legs, lower garment, torso,
// sleeves, hands and neck, built from the same 2D design (patron.js) the
// top-down view draws. Pure and DOM-free; feet at y = 0, facing +Z, full size
// (the caller applies metrics.ageScale to the whole figure).

import { shadeColor } from '../../../shared/people.js';
import { box, prism, merge, emptyMesh } from './geom.js';
import { FRAME, PX } from './character-frame.js';

const SIDES = 8;
// prism() puts flat faces on the axes, so a ring of radius r reaches only
// r*cos(pi/sides); scale radii up so a ring spans the half-width we mean.
const CIRC = 1 / Math.cos(Math.PI / SIDES);
const PROUD = 0.01;

const WAIST_Y = 21 * PX;
const TORSO_HEM_Y = 20.6 * PX;

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

function legs(colour, legX, legHalf) {
  const mesh = emptyMesh();
  for (const dir of [-1, 1]) {
    merge(
      mesh,
      box([dir * legX - legHalf, FRAME.shoeTop, -legHalf], [dir * legX + legHalf, FRAME.hem, legHalf], colour),
    );
  }
  return mesh;
}

function skirt(design, palette, metrics) {
  const o = design.outfit ?? {};
  const long = o.kind === 'dress' || o.kind === 'apron' || o.kind === 'hanbok' || metrics.elder;
  const hemY = (long ? 7 : 10) * PX;
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
    merge(mesh, box([a, 13.4 * PX, -metrics.depth * 0.9], [b, TORSO_HEM_Y, metrics.depth * 0.9], palette.bottom));
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

function torso(palette, metrics) {
  const w = metrics.halfTorso;
  const s = metrics.halfShoulder;
  const d = metrics.depth;
  const ring = (y, half, depth, color) => ({ y, rx: half * CIRC, rz: depth * CIRC, color });
  return prism(
    [
      ring(TORSO_HEM_Y, w, d, shadeColor(palette.top, -0.16)),
      ring(30 * PX, w - 0.4 * PX, d, shadeColor(palette.top, -0.1)),
      ring(38 * PX, s, d, palette.top),
      ring(FRAME.shoulder, s * 0.7, d * 0.8, shadeColor(palette.top, 0.1)),
    ],
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
  if (palette.inner) panel(Math.min(1.8 * PX, fh), 26 * PX, 38 * PX, palette.inner, PROUD);
  if (palette.tie) panel(Math.min(0.9 * PX, fh), 28 * PX, 38 * PX, palette.tie, 2 * PROUD);
  if (palette.apron) panel(fh, 21 * PX, 33 * PX, palette.apron, 3 * PROUD);
  if (palette.trim) panel(fh, TORSO_HEM_Y, 22 * PX, palette.trim, PROUD);
  return mesh;
}

function arms(palette, metrics) {
  const mesh = emptyMesh();
  const armW = 3 * PX;
  const armZ = 2.4 * PX;
  const hemX = metrics.halfTorso - 0.4 * PX; // torso half-width at the sleeve's lower edge
  for (const dir of [-1, 1]) {
    const x0 = hemX - 0.02 * PX; // tucked into the torso, so no gap
    const [a, b] = dir < 0 ? [-(x0 + armW), -x0] : [x0, x0 + armW];
    merge(mesh, box([a, 28 * PX, -armZ], [b, 43 * PX, armZ], palette.top));
    const cx = dir * (x0 + armW / 2);
    const hand = prism(
      [
        { y: 24 * PX, rx: 1.4 * PX, rz: 1.4 * PX, color: palette.skin.skin },
        { y: 28 * PX, rx: 1.7 * PX, rz: 1.7 * PX, color: palette.skin.skin },
      ],
      6,
      palette.skin.shade,
      palette.skin.deep,
    );
    merge(mesh, { vertices: hand.vertices.map((v) => [v[0] + cx, v[1], v[2]]), faces: hand.faces });
  }
  return mesh;
}

/**
 * @param {object} design the patron's 2D design (patron.js)
 * @param {ReturnType<import('./character-palette.js').paletteFor>} palette
 * @param {ReturnType<import('./character-frame.js').metricsFor>} metrics
 */
export function buildBody(design, palette, metrics) {
  const bare = !metrics.trousers; // a skirt or shorts: legs below are not trousers
  const legX = (bare ? 3.1 : 3.8) * PX;
  const legHalf = (bare ? 1.98 : 2.95) * PX;
  // patron.js legFill: skirt -> legs ?? skin; shorts -> skin; trousers -> bottom.
  const legColour = palette.skirt ? (palette.legs ?? palette.skin.skin) : bare ? palette.skin.skin : palette.bottom;

  const mesh = emptyMesh();
  merge(mesh, shoes(palette, legX, legHalf));
  merge(mesh, legs(legColour, legX, legHalf));
  if (palette.skirt) merge(mesh, skirt(design, palette, metrics));
  else merge(mesh, bare ? shortsGarment(palette, metrics) : hips(palette, metrics));
  merge(mesh, torso(palette, metrics));
  merge(mesh, frontLayers(palette, metrics));
  merge(mesh, arms(palette, metrics));
  merge(mesh, box([-2.2 * PX, FRAME.shoulder, -2 * PX], [2.2 * PX, FRAME.chin, 2 * PX], palette.skin.deep));
  return mesh;
}
