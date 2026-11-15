// First Person decor, referenced to Top-Down's drawDecor
// (hospital/anime-furniture.js; docs/skills/2d-to-3d/SKILL.md). Each drawer
// is a 3/4 sprite rather than a plan view, so these are geometry in the
// drawers' own colours at real-world size, not front textures.

import { emptyMesh, merge, box, boxWithout, prism, translate } from './geom.js';

// drawWaterCooler: #bfe6ff bottle, white body, skyDeep/coralDeep taps,
// #fff6d6 cup stack.
const COOLER_BOTTLE = '#bfe6ff';
const COOLER_BODY = '#ffffff';
const COOLER_TAP_COLD = '#4fa8e0';
const COOLER_TAP_HOT = '#e0503e';
const COOLER_CUPS = '#fff6d6';

export function buildWaterCooler() {
  const mesh = emptyMesh();
  // Body: 0.34 wide, 0.34 deep, up to 0.8.
  merge(mesh, boxWithout([-0.17, 0, -0.17], [0.17, 0.8, 0.17], COOLER_BODY, ['bottom']));
  // Bottle on top, inset so the body's shoulders read.
  merge(mesh, boxWithout([-0.13, 0.8, -0.13], [0.13, 1.32, 0.13], COOLER_BOTTLE, ['bottom']));
  // Two taps on the front face.
  merge(mesh, box([-0.09, 0.6, -0.2], [-0.03, 0.66, -0.17], COOLER_TAP_COLD));
  merge(mesh, box([0.03, 0.6, -0.2], [0.09, 0.66, -0.17], COOLER_TAP_HOT));
  // Cup stack clipped to the side.
  merge(mesh, box([0.17, 0.5, -0.06], [0.22, 0.74, 0.06], COOLER_CUPS));
  for (const f of mesh.faces) f.cull = true;
  return mesh;
}

// drawPlant: #8fd6a4 leaf clumps, #ffd1e3 flower, #e8956a pot with a
// #f2a882 rim.
const PLANT_LEAF = '#8fd6a4';
const PLANT_FLOWER = '#ffd1e3';
const PLANT_POT = '#e8956a';
const PLANT_POT_RIM = '#f2a882';
const PLANT_STEM = '#5f9e6e';

// One round clump of leaves centred on (cx, cy, cz): rings whose radius
// follows sin, so the blob is as tall as it is wide.
function leafBlob(cx, cy, cz, r) {
  const bands = 5;
  const rings = [];
  for (let i = 0; i <= bands; i++) {
    const t = i / bands;
    rings.push({ y: -r + 2 * r * t, rx: r * Math.sin(t * Math.PI) || r * 0.2, rz: r * Math.sin(t * Math.PI) || r * 0.2, color: PLANT_LEAF });
  }
  return translate(prism(rings, 7, PLANT_LEAF, PLANT_LEAF), [cx, cy, cz]);
}

export function buildPlant() {
  const mesh = emptyMesh();
  // Pot: a tapered 8-gon, narrower at the foot as the 2D trapezoid is.
  merge(mesh, prism([
    { y: 0, rx: 0.13, rz: 0.13, color: PLANT_POT },
    { y: 0.26, rx: 0.17, rz: 0.17, color: PLANT_POT },
    { y: 0.3, rx: 0.19, rz: 0.19, color: PLANT_POT_RIM },
  ], 8, PLANT_POT_RIM, null));
  merge(mesh, box([-0.02, 0.3, -0.02], [0.02, 0.56, 0.02], PLANT_STEM));
  // The 2D's five leaf clumps. Each is a round blob, not a flat disc: a
  // ring stack whose radii follow a half-sine so its height matches its
  // width, and the clumps spread in z as well as x so the foliage reads as
  // a bush rather than a stack seen edge-on.
  const clumps = [
    [-0.15, 0.66, -0.05, 0.15], [0.14, 0.68, 0.06, 0.15],
    [0.01, 0.86, -0.02, 0.17], [-0.07, 0.56, 0.11, 0.13], [0.1, 0.58, -0.11, 0.13],
  ];
  for (const [cx, cy, cz, r] of clumps) merge(mesh, leafBlob(cx, cy, cz, r));
  merge(mesh, box([-0.02, 0.97, -0.04], [0.06, 1.03, 0.04], PLANT_FLOWER));
  for (const f of mesh.faces) f.cull = true;
  return mesh;
}

// drawLadder: #e8b58a rails splaying toward the foot, #f2c8a0 rungs and cap.
const LADDER_RAIL = '#e8b58a';
const LADDER_RUNG = '#f2c8a0';

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
      merge(mesh, box([lo - 0.03, y0, -0.03], [hi + 0.03, y1, 0.03], LADDER_RAIL));
    }
  }
  // Three rungs, each spanning the rails at its own height.
  for (let i = 1; i <= 3; i++) {
    const f = i / 4;
    const y = top * (1 - f);
    const spread = 0.15 + 0.15 * f;
    merge(mesh, box([-spread, y - 0.025, -0.025], [spread, y + 0.025, 0.025], LADDER_RUNG));
  }
  merge(mesh, box([-0.2, top, -0.05], [0.2, top + 0.06, 0.05], LADDER_RUNG));
  for (const f of mesh.faces) f.cull = true;
  return mesh;
}

// drawWaitingChairs: three chairs in pink, lavender and mint, each seat a
// shade darker than its back.
const CHAIR_COLOURS = ['#ffc2da', '#d8c9ff', '#bfeedd'];
const CHAIR_SEATS = ['#f2b7cf', '#cdbef2', '#b5e2d2'];
const CHAIR_LEG = '#3b2a4a';

export function buildWaitingChairs() {
  const mesh = emptyMesh();
  const pitch = 0.56;
  CHAIR_COLOURS.forEach((colour, i) => {
    const cx = (i - 1) * pitch;
    const hw = 0.22;
    // Seat pan.
    merge(mesh, box([cx - hw, 0.4, -0.22], [cx + hw, 0.47, 0.18], CHAIR_SEATS[i]));
    // Back, standing up behind the pan (+Z is toward the room).
    merge(mesh, box([cx - hw, 0.47, 0.1], [cx + hw, 0.92, 0.18], colour));
    // Four legs.
    for (const lx of [cx - hw + 0.04, cx + hw - 0.04]) {
      for (const lz of [-0.18, 0.14]) {
        merge(mesh, box([lx - 0.02, 0, lz - 0.02], [lx + 0.02, 0.4, lz + 0.02], CHAIR_LEG));
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
