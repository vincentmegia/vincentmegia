// First Person decor, referenced to Top-Down's drawDecor
// (hospital/anime-furniture.js; docs/skills/2d-to-3d/SKILL.md). Each drawer
// is a 3/4 sprite rather than a plan view, so these are geometry in the
// drawers' own colours at real-world size, not front textures.

import { emptyMesh, merge, box, boxWithout, prism, translate } from './geom.js';
import { DECOR_COLORS } from '../../../hospital/anime-furniture.js';
import { tint } from '../../../hospital/anime-ui.js';

const COOLER = DECOR_COLORS.waterCooler;

// What stands on the cooler's +Z front: [x0, y0, x1, y1, colour]. The body's
// front is built as cells that leave these rectangles out, so no body face
// lies behind a tap or the cups (with no z-buffer, the whole front face would
// sort after a far tap at 15 to 60 degrees off-axis and paint over it).
const COOLER_HALF = 0.17;
const COOLER_FIXTURES = [
  [-0.09, 0.6, -0.03, 0.66, COOLER.tapCold],
  [0.03, 0.6, 0.09, 0.66, COOLER.tapHot],
  [-0.06, 0.28, 0.06, 0.4, COOLER.cups],
];

// The body's front, x +-COOLER_HALF by y 0..0.8, as quads wound like box's
// front face, minus the fixtures' rectangles; the cells tile the rest exactly.
const COOLER_XS = [...new Set([-COOLER_HALF, COOLER_HALF, ...COOLER_FIXTURES.flatMap((f) => [f[0], f[2]])])].sort((a, b) => a - b);

function coolerFront() {
  const xs = COOLER_XS;
  const ys = [...new Set([0, 0.8, ...COOLER_FIXTURES.flatMap((f) => [f[1], f[3]])])].sort((a, b) => a - b);
  const part = { vertices: [], faces: [] };
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const mx = (xs[i] + xs[i + 1]) / 2;
      const my = (ys[j] + ys[j + 1]) / 2;
      if (COOLER_FIXTURES.some((f) => mx > f[0] && mx < f[2] && my > f[1] && my < f[3])) continue;
      const n = part.vertices.length;
      part.vertices.push([xs[i], ys[j], COOLER_HALF], [xs[i + 1], ys[j], COOLER_HALF], [xs[i + 1], ys[j + 1], COOLER_HALF], [xs[i], ys[j + 1], COOLER_HALF]);
      part.faces.push({ indices: [n, n + 1, n + 2, n + 3], color: COOLER.body });
    }
  }
  return part;
}

export function buildWaterCooler() {
  const mesh = emptyMesh();
  // Body: 0.34 wide, 0.34 deep, up to 0.8.
  merge(mesh, boxWithout([-COOLER_HALF, 0, -COOLER_HALF], [COOLER_HALF, 0.8, COOLER_HALF], COOLER.body, ['bottom', 'front']));
  merge(mesh, coolerFront());
  // Bottle on top, inset so the body's shoulders read.
  merge(mesh, boxWithout([-0.13, 0.8, -0.13], [0.13, 1.32, 0.13], COOLER.bottle, ['bottom']));
  // Two taps and the cup stack, on the front face (+Z) as the 2D has them,
  // seated exactly on it; their backs lie in the body's front plane, over the
  // cut-outs, so they are dropped.
  // Each one's own front is cut into the body cells' columns: a wide front
  // would sort by its centre and could land before the cell under it.
  const out = COOLER_HALF + 0.03;
  for (const [x0, y0, x1, y1, colour] of COOLER_FIXTURES) {
    merge(mesh, boxWithout([x0, y0, COOLER_HALF], [x1, y1, out], colour, ['back', 'front']));
    const cols = COOLER_XS.filter((x) => x >= x0 - 1e-9 && x <= x1 + 1e-9);
    for (let i = 0; i < cols.length - 1; i++) {
      merge(mesh, { vertices: [[cols[i], y0, out], [cols[i + 1], y0, out], [cols[i + 1], y1, out], [cols[i], y1, out]], faces: [{ indices: [0, 1, 2, 3], color: colour }] });
    }
  }
  for (const f of mesh.faces) f.cull = true;
  return mesh;
}

const PLANT = DECOR_COLORS.plant;
const PLANT_STEM = tint(PLANT.leaf, -0.3);

// One round clump of leaves centred on (cx, cy, cz): rings whose radius
// follows sin, so the blob is as tall as it is wide.
export function leafBlob(cx, cy, cz, r, color = PLANT.leaf, { sides = 7, bands = 5 } = {}) {
  const rings = [];
  for (let i = 0; i <= bands; i++) {
    const t = i / bands;
    rings.push({ y: -r + 2 * r * t, rx: r * Math.sin(t * Math.PI) || r * 0.2, rz: r * Math.sin(t * Math.PI) || r * 0.2, color });
  }
  return translate(prism(rings, sides, color, color), [cx, cy, cz]);
}

export function buildPlant() {
  const mesh = emptyMesh();
  // Pot: a tapered 8-gon, narrower at the foot as the 2D trapezoid is.
  merge(mesh, prism([
    { y: 0, rx: 0.13, rz: 0.13, color: PLANT.pot },
    { y: 0.26, rx: 0.17, rz: 0.17, color: PLANT.pot },
    { y: 0.3, rx: 0.19, rz: 0.19, color: PLANT.rim },
  ], 8, PLANT.rim, null));
  merge(mesh, box([-0.02, 0.3, -0.02], [0.02, 0.46, 0.02], PLANT_STEM));
  // The 2D's five leaf clumps. Each is a round blob, not a flat disc: a
  // ring stack whose radii follow a half-sine so its height matches its
  // width, and the clumps spread in z as well as x so the foliage reads as
  // a bush rather than a stack seen edge-on.
  const clumps = [
    [-0.15, 0.66, -0.05, 0.15], [0.14, 0.68, 0.06, 0.15],
    [0.01, 0.86, -0.02, 0.17], [-0.07, 0.45, 0.11, 0.13], [0.1, 0.45, -0.11, 0.13],
  ];
  for (const [cx, cy, cz, r] of clumps) merge(mesh, leafBlob(cx, cy, cz, r));
  merge(mesh, box([-0.02, 0.97, -0.04], [0.06, 1.03, 0.04], PLANT.flower));
  for (const f of mesh.faces) f.cull = true;
  return mesh;
}

const LADDER = DECOR_COLORS.ladder;

export function buildLadder() {
  const mesh = emptyMesh();
  const top = 1.55;
  // Two rails: the 2D splays them, so each is a stack of short boxes
  // stepping outward on the way down.
  for (const side of [-1, 1]) {
    const steps = 6;
    for (let i = 0; i < steps; i++) {
      const y0 = top * (1 - (i + 1) / steps);
      const y1 = top * (1 - i / steps);
      const f0 = (i + 1) / steps, f1 = i / steps;
      const x0 = side * (0.15 + 0.15 * f0), x1 = side * (0.15 + 0.15 * f1);
      const lo = Math.min(x0, x1), hi = Math.max(x0, x1);
      merge(mesh, box([lo - 0.03, y0, -0.03], [hi + 0.03, y1, 0.03], LADDER.rail));
    }
  }
  // Three rungs, each spanning the rails at its own height.
  for (let i = 1; i <= 3; i++) {
    const f = i / 4;
    const y = top * (1 - f);
    const spread = 0.15 + 0.15 * f;
    merge(mesh, box([-spread, y - 0.025, -0.025], [spread, y + 0.025, 0.025], LADDER.rung));
  }
  merge(mesh, box([-0.2, top, -0.05], [0.2, top + 0.06, 0.05], LADDER.rung));
  for (const f of mesh.faces) f.cull = true;
  return mesh;
}

const CHAIRS = DECOR_COLORS.waitingChairs;

export function buildWaitingChairs() {
  const mesh = emptyMesh();
  const pitch = 0.56;
  CHAIRS.backs.forEach((colour, i) => {
    const cx = (i - 1) * pitch;
    const hw = 0.22;
    // Seat pan.
    merge(mesh, box([cx - hw, 0.4, -0.22], [cx + hw, 0.47, 0.18], tint(colour, CHAIRS.seatTint)));
    // Back, standing up behind the pan. The seat is on the -Z side because
    // the only row (2nd floor) stands against the south edge, so the player
    // is always north of it, on -Z.
    merge(mesh, box([cx - hw, 0.47, 0.1], [cx + hw, 0.92, 0.18], colour));
    // Four legs.
    for (const lx of [cx - hw + 0.04, cx + hw - 0.04]) {
      for (const lz of [-0.18, 0.14]) {
        merge(mesh, box([lx - 0.02, 0, lz - 0.02], [lx + 0.02, 0.4, lz + 0.02], CHAIRS.leg));
      }
    }
  });
  for (const f of mesh.faces) f.cull = true;
  return mesh;
}

export const DECOR_BUILDERS = {
  'water-cooler': buildWaterCooler,
  plant: buildPlant,
  ladder: buildLadder,
  'waiting-chairs': buildWaitingChairs,
};

/** The builder for a decor kind, or null for one with no mesh yet. */
export function meshForDecorKind(kind) {
  return Object.prototype.hasOwnProperty.call(DECOR_BUILDERS, kind) ? DECOR_BUILDERS[kind] : null;
}
