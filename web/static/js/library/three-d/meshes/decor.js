// First Person decor, referenced to Top-Down's drawDecor
// (hospital/anime-furniture.js; docs/skills/2d-to-3d/SKILL.md). Each drawer
// is a 3/4 sprite rather than a plan view, so these are geometry in the
// drawers' own colours at real-world size, not front textures.

import { emptyMesh, merge, box, boxWithout, prism, translate } from './geom.js';
import { DECOR_COLORS } from '../../../hospital/anime-furniture.js';
import { tint } from '../../../hospital/anime-ui.js';

const COOLER = DECOR_COLORS.waterCooler;

export function buildWaterCooler() {
  const mesh = emptyMesh();
  // Body: 0.34 wide, 0.34 deep, up to 0.8.
  merge(mesh, boxWithout([-0.17, 0, -0.17], [0.17, 0.8, 0.17], COOLER.body, ['bottom']));
  // Bottle on top, inset so the body's shoulders read.
  merge(mesh, boxWithout([-0.13, 0.8, -0.13], [0.13, 1.32, 0.13], COOLER.bottle, ['bottom']));
  // Two taps and the cup stack, on the front face (+Z) as the 2D has them,
  // seated exactly on it.
  merge(mesh, box([-0.09, 0.6, 0.17], [-0.03, 0.66, 0.2], COOLER.tapCold));
  merge(mesh, box([0.03, 0.6, 0.17], [0.09, 0.66, 0.2], COOLER.tapHot));
  merge(mesh, box([-0.06, 0.28, 0.17], [0.06, 0.4, 0.2], COOLER.cups));
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
    merge(mesh, box([cx - hw, 0.4, -0.18], [cx + hw, 0.47, 0.22], tint(colour, CHAIRS.seatTint)));
    // Back, standing up behind the pan: the seat faces +Z, toward the room.
    merge(mesh, box([cx - hw, 0.47, -0.18], [cx + hw, 0.92, -0.1], colour));
    // Four legs.
    for (const lx of [cx - hw + 0.04, cx + hw - 0.04]) {
      for (const lz of [-0.14, 0.18]) {
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
