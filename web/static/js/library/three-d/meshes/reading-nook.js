// First Person Reading Nook, referenced to Top-Down's drawReadingNook
// (docs/skills/2d-to-3d/SKILL.md). Its 2D is a small scene of rounded
// pastel shapes, not a flat front, so it is geometry in the drawer's own
// colours (READING_NOOK_COLORS): a lavender oval rug; a pink armchair facing
// +Z on four wooden legs, its back behind the seat and a darker arm either
// side, every block's top chamfered in from its exposed edges and the back's
// rear and the arms' outer front corners cut, so it reads plump like the 2D's
// rounded blocks; a lighter, chamfered cushion on the seat with the open
// white book on it; and the floor lamp, a slate base, a plum pole and an
// open, tapered gold shade (unlit: it glows). The 2D's heart and the lamp's
// radial glow are overlays and are not modelled.
//
// The renderer has no z-buffer, so the rug, the lamp's base and every
// block's flat top are supporting surfaces (`under`): what stands on them is
// drawn after them. Every part sits exactly on its support and no two solids
// interpenetrate.
//
// Model space: the rug's centre on the floor at the origin, y up, the chair
// facing +Z. Pure and deterministic; it takes no art.
import { emptyMesh, merge, boxWithout, prism, tube, quad, translate, faceNormal } from './geom.js';
import { READING_NOOK_COLORS } from '../../anime-furniture.js';

const C = READING_NOOK_COLORS;

/** The rug's radii (units), the chair back's and the lamp shade's tops. */
export const READING_NOOK_SIZE = { rugRx: 1.2, rugRz: 0.8, chairTop: 1.3, lampTop: 1.5 };

const RUG_TOP = 0.03;
const LEG_TOP = 0.15; // the chair's underside
/** Each block's top chamfer: its height, how far its flat top sits in from an exposed edge, and the corner cut in plan. */
export const READING_NOOK_ROUND = { chamfer: 0.1, inset: 0.08, corner: 0.08 };
const H = READING_NOOK_ROUND.chamfer;
const IN = READING_NOOK_ROUND.inset;
const CUT = READING_NOOK_ROUND.corner;
const SEAT_TOP = 0.7;
const ARM_TOP = 0.85;
const ARM_BODY = ARM_TOP - H;
const CHAIR_FRONT = 0.4;
const BACK = { x: [-0.6, 0.4], z: [-0.4, -0.15] };
const CUSHION = { x: [-0.45, 0.25], z: [-0.1, 0.3], top: 0.81 };
const BOOK = { x: -0.1, z: 0.1, page: 0.2, length: 0.16, tilt: (12 * Math.PI) / 180 };
const LAMP = { x: 0.79, z: 0, baseR: 0.15, baseTop: 0.09, poleR: 0.03, shadeY: 1.3, shadeR: [0.22, 0.14] };

/**
 * A rectangle's outline in plan (x, z), going round from the front-left,
 * each corner named in `cut` cut off by CUT: `[{p: [x, z], edge, inset}]`,
 * where `edge` names the side from that point to the next ('front' +Z,
 * 'right' +X, 'back', 'left', or a cut corner 'fr', 'br', 'bl', 'fl') and
 * `inset` is how far the block's flat top sits in from it (IN for the sides
 * named in `round` and every cut corner, else 0).
 */
function rectPlan([x0, x1], [z0, z1], { round = [], cut = [] }) {
  const c = (k) => cut.includes(k);
  const pts = [];
  const at = (p, edge) => pts.push({ p, edge, inset: edge.length === 2 || round.includes(edge) ? IN : 0 });
  at(c('fl') ? [x0 + CUT, z1] : [x0, z1], 'front');
  if (c('fr')) { at([x1 - CUT, z1], 'fr'); at([x1, z1 - CUT], 'right'); } else at([x1, z1], 'right');
  if (c('br')) { at([x1, z0 + CUT], 'br'); at([x1 - CUT, z0], 'back'); } else at([x1, z0], 'back');
  if (c('bl')) { at([x0 + CUT, z0], 'bl'); at([x0, z0 + CUT], 'left'); } else at([x0, z0], 'left');
  if (c('fl')) at([x0, z1 - CUT], 'fl');
  return pts;
}

/** `plan` with each edge moved in by its inset: the corners where the moved edges meet. */
function insetPlan(plan) {
  const n = plan.length;
  const cx = plan.reduce((a, v) => a + v.p[0], 0) / n;
  const cz = plan.reduce((a, v) => a + v.p[1], 0) / n;
  const lines = plan.map((v, i) => {
    const a = v.p;
    const b = plan[(i + 1) % n].p;
    const d = [b[0] - a[0], b[1] - a[1]];
    const len = Math.hypot(d[0], d[1]);
    let nrm = [-d[1] / len, d[0] / len];
    if (nrm[0] * (cx - a[0]) + nrm[1] * (cz - a[1]) < 0) nrm = [-nrm[0], -nrm[1]];
    return { a: [a[0] + nrm[0] * v.inset, a[1] + nrm[1] * v.inset], d };
  });
  return plan.map((_, i) => {
    const L1 = lines[(i + n - 1) % n];
    const L2 = lines[i];
    const den = L1.d[0] * L2.d[1] - L1.d[1] * L2.d[0];
    const t = ((L2.a[0] - L1.a[0]) * L2.d[1] - (L2.a[1] - L1.a[1]) * L2.d[0]) / den;
    return [L1.a[0] + L1.d[0] * t, L1.a[1] + L1.d[1] * t];
  });
}

/**
 * A block standing on y0 over `plan`, up to `y1`: straight sides up to
 * `y1 - chamfer`, then each side sloping in by its inset to a flat top
 * (`under`, a supporting surface) at y1. `drop` names straight sides that
 * rest against a neighbour (or are drawn as panels of their own),
 * `slopeDrop` chamfer sides that do; `top: false` leaves the top off. No
 * bottom: the eye is always above the chair's underside.
 */
function planBlock(plan, y0, y1, color, { chamfer = H, drop = [], slopeDrop = [], top = true }) {
  const n = plan.length;
  const rings = chamfer > 0
    ? [[y0, plan.map((v) => v.p)], [y1 - chamfer, plan.map((v) => v.p)], [y1, insetPlan(plan)]]
    : [[y0, plan.map((v) => v.p)], [y1, plan.map((v) => v.p)]];
  const vertices = rings.flatMap(([y, ps]) => ps.map(([x, z]) => [x, y, z]));
  const m = { vertices, faces: [] };
  const cx = plan.reduce((a, v) => a + v.p[0], 0) / n;
  const cz = plan.reduce((a, v) => a + v.p[1], 0) / n;
  const orient = (face, want) => {
    const nn = faceNormal(m, face);
    if (nn[0] * want[0] + nn[1] * want[1] + nn[2] * want[2] < 0) face.indices.reverse();
    return face;
  };
  for (let k = 0; k + 1 < rings.length; k++) {
    const skip = k === 0 ? drop : slopeDrop;
    for (let i = 0; i < n; i++) {
      if (skip.includes(plan[i].edge)) continue;
      const j = (i + 1) % n;
      const out = [(plan[i].p[0] + plan[j].p[0]) / 2 - cx, 0, (plan[i].p[1] + plan[j].p[1]) / 2 - cz];
      m.faces.push(orient({ indices: [k * n + i, k * n + j, (k + 1) * n + j, (k + 1) * n + i], color }, out));
    }
  }
  if (top) {
    const last = (rings.length - 1) * n;
    m.faces.push(orient({ indices: plan.map((_, i) => last + i), color, under: true }, [0, 1, 0]));
  }
  return m;
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
/** A triangle through `points`, wound to face along `normal`. */
function triangle(points, color, normal) {
  const t = { vertices: points.map((p) => [...p]), faces: [{ indices: [0, 1, 2], color }] };
  const n = faceNormal(t, t.faces[0]);
  if (n[0] * normal[0] + n[1] * normal[1] + n[2] * normal[2] < 0) t.faces[0].indices.reverse();
  return t;
}
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

  // Four legs on the rug at the chair's corners, each with the corner above
  // it cut, so its outer faces run on down from the back's and the arms'
  // (a leg tucked in under them would sort over the face above it).
  for (const [xs, zs, cut] of [[[-0.6, -0.5], [-0.4, -0.3], 'bl'], [[0.3, 0.4], [-0.4, -0.3], 'br'], [[-0.7, -0.6], [0.3, 0.4], 'fl'], [[0.4, 0.5], [0.3, 0.4], 'fr']]) {
    add(planBlock(rectPlan(xs, zs, { cut: [cut] }), RUG_TOP, LEG_TOP, C.leg, { chamfer: 0, top: false }));
  }

  // The back, behind the seat, its rear corners cut: a straight lower part
  // whose front the seat and arms cover, and a chamfered upper part.
  const backPlan = rectPlan(BACK.x, BACK.z, { round: ['front', 'back', 'left', 'right'], cut: ['br', 'bl'] });
  add(planBlock(backPlan, LEG_TOP, SEAT_TOP, C.chair, { chamfer: 0, drop: ['front'], top: false }));
  const backBody = READING_NOOK_SIZE.chairTop - H;
  add(planBlock(backPlan, SEAT_TOP, READING_NOOK_SIZE.chairTop, C.chair, { drop: ['front', 'left', 'right'] }));
  // Its front only where it shows: above the arms' bodies (their tops slope
  // away from it), and between them above the seat; its sides split at the
  // arms' height, so the part beside an arm's back end sorts with it.
  add(zPanel(BACK.z[1], BACK.x[0], BACK.x[1], ARM_TOP, backBody, C.chair, 1));
  add(zPanel(BACK.z[1], -0.5, 0.3, SEAT_TOP, ARM_TOP, C.chair, 1));
  // Behind each arm's sloping back edge, a strip of its own (sorting with the slope).
  add(zPanel(BACK.z[1], BACK.x[0], -0.5, ARM_BODY, ARM_TOP, C.chair, 1));
  add(zPanel(BACK.z[1], 0.3, BACK.x[1], ARM_BODY, ARM_TOP, C.chair, 1));
  for (const [x, side] of [[BACK.x[0], -1], [BACK.x[1], 1]]) {
    add(xPanel(x, BACK.z[0] + CUT, BACK.z[1], SEAT_TOP, ARM_TOP, C.chair, side));
    add(xPanel(x, BACK.z[0] + CUT, BACK.z[1], ARM_TOP, backBody, C.chair, side));
  }

  // The arms either side of the seat, from the back to the chair's front,
  // their outer front corners cut. Each arm's inner side shows only above
  // the seat, its back only beyond the chair's back; those are panels of
  // their own, the inner one in three cells along z so it sorts behind the
  // cushion where it is behind it.
  for (const [x0, x1, side] of [[-0.7, -0.5, -1], [0.3, 0.5, 1]]) {
    const inner = side < 0 ? 'right' : 'left';
    const plan = rectPlan([x0, x1], [BACK.z[1], CHAIR_FRONT], { round: ['front', 'back', 'left', 'right'], cut: [side < 0 ? 'fl' : 'fr'] });
    add(planBlock(plan, LEG_TOP, ARM_TOP, C.arm, { drop: [inner, 'back'] }));
    const xi = side < 0 ? x1 : x0;
    const cells = 3;
    for (let k = 0; k < cells; k++) {
      const za = BACK.z[1] + ((CHAIR_FRONT - BACK.z[1]) * k) / cells;
      const zb = BACK.z[1] + ((CHAIR_FRONT - BACK.z[1]) * (k + 1)) / cells;
      add(xPanel(xi, za, zb, SEAT_TOP, ARM_BODY, C.arm, -side));
    }
    // and beside the seat's chamfered front edge: the triangle above its slope.
    add(triangle([[xi, SEAT_TOP - H, CHAIR_FRONT], [xi, SEAT_TOP, CHAIR_FRONT], [xi, SEAT_TOP, CHAIR_FRONT - IN]], C.arm, [-side, 0, 0]));
    add(side < 0 ? zPanel(BACK.z[1], x0, BACK.x[0], LEG_TOP, ARM_BODY, C.arm, -1) : zPanel(BACK.z[1], BACK.x[1], x1, LEG_TOP, ARM_BODY, C.arm, -1));
  }
  // The seat between the arms: only its front shows, chamfered at the front edge.
  add(planBlock(rectPlan([-0.5, 0.3], [BACK.z[1], CHAIR_FRONT], { round: ['front'] }), LEG_TOP, SEAT_TOP, C.chair, {
    drop: ['back', 'left', 'right'], slopeDrop: ['back', 'left', 'right'],
  }));
  // The cushion on the seat, clear of the arms and the back: chamfered all
  // round with its corners cut, so it is mostly slope, plump like the 2D's.
  add(planBlock(rectPlan(CUSHION.x, CUSHION.z, { round: ['front', 'back', 'left', 'right'], cut: ['fl', 'fr', 'br', 'bl'] }), SEAT_TOP, CUSHION.top, C.cushion, {}));
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
