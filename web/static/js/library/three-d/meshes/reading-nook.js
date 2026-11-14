// First Person Reading Nook, referenced to Top-Down's drawReadingNook
// (docs/skills/2d-to-3d/SKILL.md). Its 2D is a small scene of rounded
// pastel shapes, not a flat front, so it is geometry in the drawer's own
// colours (READING_NOOK_COLORS): a lavender oval rug; a pink armchair facing
// +Z on four wooden legs, its back behind the seat and a darker arm either
// side, every block topped by a slab inset from its exposed edges so the
// silhouette reads rounded; a lighter cushion on the seat with the open
// white book on it; and the floor lamp, a slate base, a plum pole and an
// open, tapered gold shade (unlit: it glows). The 2D's heart and the lamp's
// radial glow are overlays and are not modelled.
//
// The renderer has no z-buffer, so the rug, every block's top and the
// cushion are supporting surfaces (`under`, geom.js supportTop): what stands
// on them is drawn after them. Every part sits exactly on its support and no
// two solids interpenetrate.
//
// Model space: the rug's centre on the floor at the origin, y up, the chair
// facing +Z. Pure and deterministic; it takes no art.
import { emptyMesh, merge, boxWithout, supportTop, prism, tube, quad, translate, faceNormal } from './geom.js';
import { READING_NOOK_COLORS } from '../../anime-furniture.js';

const C = READING_NOOK_COLORS;

/** The rug's radii (units), the chair back's and the lamp shade's tops. */
export const READING_NOOK_SIZE = { rugRx: 1.2, rugRz: 0.8, chairTop: 1.3, lampTop: 1.5 };

const RUG_TOP = 0.03;
const LEG_TOP = 0.15; // the chair's underside
const SLAB = 0.05; // the rounding slab's height and inset
const SEAT_TOP = 0.7;
const ARM_TOP = 0.85;
const CUSHION = { x: [-0.45, 0.25], z: [-0.1, 0.3], top: 0.81 };
const BOOK = { x: -0.1, z: 0.1, page: 0.2, length: 0.16, tilt: (12 * Math.PI) / 180 };
const LAMP = { x: 0.79, z: 0, baseR: 0.15, baseTop: 0.09, poleR: 0.03, shadeY: 1.3, shadeR: [0.22, 0.14] };

/** A horizontal quad facing up at height `y` over x0..x1, z0..z1. */
const ledge = (x0, x1, z0, z1, y, color) => quad([[x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0]], color);

/**
 * A block from `min` to `max` whose top is a SLAB-high slab inset SLAB from
 * each edge named in `inset` ('front' +Z, 'back', 'left' -X, 'right'), so the
 * rounded 2D block reads as rounded: the body, the ledge strips the inset
 * leaves on the body's top, and the slab. `drop` names body sides that rest
 * against a neighbour, `slabDrop` slab sides that do. Each top (the ledges
 * and the slab's) is a supporting surface.
 */
function roundedBlock(min, max, color, { inset, drop = [], slabDrop = [] }) {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  const yb = y1 - SLAB;
  const has = (e) => inset.includes(e);
  const sx0 = x0 + (has('left') ? SLAB : 0);
  const sx1 = x1 - (has('right') ? SLAB : 0);
  const sz0 = z0 + (has('back') ? SLAB : 0);
  const sz1 = z1 - (has('front') ? SLAB : 0);
  const out = [boxWithout([x0, y0, z0], [x1, yb, z1], color, ['top', 'bottom', ...drop])];
  if (sz1 < z1) out.push(ledge(x0, x1, sz1, z1, yb, color));
  if (sz0 > z0) out.push(ledge(x0, x1, z0, sz0, yb, color));
  if (sx0 > x0) out.push(ledge(x0, sx0, sz0, sz1, yb, color));
  if (sx1 < x1) out.push(ledge(sx1, x1, sz0, sz1, yb, color));
  for (const l of out.slice(1)) l.faces[0].under = true;
  out.push(supportTop(boxWithout([sx0, yb, sz0], [sx1, y1, sz1], color, ['bottom', ...slabDrop])));
  return out;
}

/** A quad through `points`, wound to face along `normal`. */
function panel(points, color, normal) {
  const q = quad(points, color);
  const n = faceNormal(q, q.faces[0]);
  if (n[0] * normal[0] + n[1] * normal[1] + n[2] * normal[2] < 0) q.faces[0].indices.reverse();
  return q;
}
/** A vertical quad in the plane x = `x` over z0..z1, y0..y1, facing `side` (+1 +X, -1 -X). */
const xPanel = (x, z0, z1, y0, y1, color, side) => panel([[x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0]], color, [side, 0, 0]);
/** A vertical quad in the plane z = `z` over x0..x1, y0..y1, facing `side` (+1 +Z, -1 -Z). */
const zPanel = (z, x0, x1, y0, y1, color, side) => panel([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], color, [0, 0, side]);

/** One page of the open book: from the spine at x = BOOK.x out to `side` (-1 left, +1 right), rising BOOK.tilt to its outer edge. */
function page(side, y) {
  const xo = BOOK.x + side * BOOK.page * Math.cos(BOOK.tilt);
  const yo = y + BOOK.page * Math.sin(BOOK.tilt);
  const z0 = BOOK.z - BOOK.length / 2;
  const z1 = BOOK.z + BOOK.length / 2;
  // Facing up: only its upper side can be seen (it lies on the cushion).
  return panel([[BOOK.x, y, z0], [BOOK.x, y, z1], [xo, yo, z1], [xo, yo, z0]], C.book, [0, 1, 0]);
}

export function buildReadingNook() {
  const mesh = emptyMesh();
  const add = (p) => merge(mesh, p);
  const rug = prism([
    { y: 0, rx: READING_NOOK_SIZE.rugRx, rz: READING_NOOK_SIZE.rugRz, color: C.rug },
    { y: RUG_TOP, rx: READING_NOOK_SIZE.rugRx, rz: READING_NOOK_SIZE.rugRz, color: C.rug },
  ], 12, C.rug);
  rug.faces.at(-1).under = true; // chair legs and lamp base stand on it
  add(rug);

  // Four legs on the rug, under the back's and the arms' corners.
  for (const [x, z] of [[-0.56, -0.36], [0.36, -0.36], [-0.66, 0.36], [0.46, 0.36]]) {
    add(boxWithout([x - 0.04, RUG_TOP, z - 0.04], [x + 0.04, LEG_TOP, z + 0.04], C.leg, ['top', 'bottom']));
  }
  // The back, behind the seat; its front below the seat is covered by the seat and arms.
  const backZ = [-0.4, -0.15];
  add(boxWithout([-0.6, LEG_TOP, backZ[0]], [0.4, SEAT_TOP, backZ[1]], C.chair, ['front', 'top', 'bottom']));
  const backTop = READING_NOOK_SIZE.chairTop - SLAB;
  for (const p of roundedBlock([-0.6, SEAT_TOP, backZ[0]], [0.4, READING_NOOK_SIZE.chairTop, backZ[1]], C.chair, {
    inset: ['front', 'back', 'left', 'right'], drop: ['front', 'left', 'right'],
  })) add(p);
  // Its front only where it shows: above the arms' bodies (their slabs are
  // inset, so it shows above their back ledges too), and between them above
  // the seat; its sides split at the arms' height, so the part beside an
  // arm's back end sorts with it.
  const armBody = ARM_TOP - SLAB;
  add(zPanel(backZ[1], -0.6, 0.4, armBody, backTop, C.chair, 1));
  add(zPanel(backZ[1], -0.5, 0.3, SEAT_TOP, armBody, C.chair, 1));
  for (const [x, side] of [[-0.6, -1], [0.4, 1]]) {
    add(xPanel(x, backZ[0], backZ[1], SEAT_TOP, ARM_TOP, C.chair, side));
    add(xPanel(x, backZ[0], backZ[1], ARM_TOP, backTop, C.chair, side));
  }
  // The arms either side of the seat, from the back to the chair's front.
  // Each arm's inner side shows only above the seat, its back only beyond the
  // chair's back; those are panels of their own, the inner one in three cells
  // along z so it sorts behind the cushion where it is behind it.
  for (const [x0, x1, side] of [[-0.7, -0.5, -1], [0.3, 0.5, 1]]) {
    const inner = side < 0 ? 'right' : 'left';
    for (const p of roundedBlock([x0, LEG_TOP, backZ[1]], [x1, ARM_TOP, 0.4], C.arm, { inset: ['front', 'back', 'left', 'right'], drop: [inner, 'back'] })) add(p);
    const xi = side < 0 ? x1 : x0;
    const cells = 3;
    for (let k = 0; k < cells; k++) {
      const za = backZ[1] + ((0.4 - backZ[1]) * k) / cells;
      const zb = backZ[1] + ((0.4 - backZ[1]) * (k + 1)) / cells;
      add(xPanel(xi, za, zb, SEAT_TOP, armBody, C.arm, -side));
    }
    // and beside the seat's front ledge, where its slab is inset.
    add(xPanel(xi, 0.4 - SLAB, 0.4, SEAT_TOP - SLAB, SEAT_TOP, C.arm, -side));
    add(side < 0 ? zPanel(backZ[1], x0, -0.6, LEG_TOP, armBody, C.arm, -1) : zPanel(backZ[1], 0.4, x1, LEG_TOP, armBody, C.arm, -1));
  }
  // The seat between the arms: only its front shows, rounded at the front edge.
  for (const p of roundedBlock([-0.5, LEG_TOP, backZ[1]], [0.3, SEAT_TOP, 0.4], C.chair, {
    inset: ['front'], drop: ['back', 'left', 'right'], slabDrop: ['back', 'left', 'right'],
  })) add(p);
  // The cushion on the seat, clear of the arms and the back.
  for (const p of roundedBlock([CUSHION.x[0], SEAT_TOP, CUSHION.z[0]], [CUSHION.x[1], CUSHION.top, CUSHION.z[1]], C.cushion, {
    inset: ['front', 'back', 'left', 'right'],
  })) add(p);
  // The open book on the cushion.
  add(page(-1, CUSHION.top));
  add(page(1, CUSHION.top));

  // The floor lamp beside the chair.
  const base = prism([
    { y: RUG_TOP, rx: LAMP.baseR, rz: LAMP.baseR, color: C.base },
    { y: LAMP.baseTop, rx: LAMP.baseR, rz: LAMP.baseR, color: C.base },
  ], 8, C.base);
  base.faces.at(-1).under = true; // the pole stands on it
  add(translate(base, [LAMP.x, 0, LAMP.z]));
  // The pole in short lengths, so each sorts at its own depth (a whole pole
  // sorts at its middle and would paint over the shade it ends in).
  const poleY = [LAMP.baseTop, 0.4, 0.7, 1.0, 1.2, LAMP.shadeY];
  for (let i = 0; i + 1 < poleY.length; i++) {
    add(tube([LAMP.x, poleY[i], LAMP.z], [LAMP.x, poleY[i + 1], LAMP.z], LAMP.poleR, LAMP.poleR, 6, C.pole));
  }
  const shade = prism([
    { y: LAMP.shadeY, rx: LAMP.shadeR[0], rz: LAMP.shadeR[0], color: C.shade },
    { y: READING_NOOK_SIZE.lampTop, rx: LAMP.shadeR[1], rz: LAMP.shadeR[1], color: C.shade },
  ], 8);
  // Open at both ends, so both windings: the outside and the inside.
  shade.faces.push(...shade.faces.map((f) => ({ ...f, indices: [...f.indices].reverse() })));
  for (const f of shade.faces) f.unlit = true;
  add(translate(shade, [LAMP.x, 0, LAMP.z]));

  for (const f of mesh.faces) f.cull = true;
  return mesh;
}
