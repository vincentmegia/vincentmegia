// The Reading Nook: a plump armchair on a lavender rug with a floor lamp.
// Geometry technique from anime-furniture.js's drawReadingNook colours.

import { emptyMesh, merge, box, boxWithout } from './geom.js';

const RUG = '#c9b8ff';
const CHAIR = '#ff8fb8';
const CHAIR_ARM = '#e87aa8';
const CUSHION = '#ffb0cc';
const LAMP_POLE = '#5a5a78';
const LAMP_SHADE = '#ffd166';
const WOOD_LEG = '#8a6a4a';

export function buildReadingNook() {
  const mesh = emptyMesh();
  merge(mesh, box([-1.2, 0, -0.8], [1.2, 0.03, 0.8], RUG));
  merge(mesh, boxWithout([-0.6, 0.15, -0.4], [0.4, 0.7, 0.4], CHAIR, ['bottom']));
  merge(mesh, boxWithout([-0.6, 0.7, 0.15], [0.4, 1.3, 0.4], CHAIR, ['bottom']));
  merge(mesh, box([-0.7, 0.4, -0.4], [-0.55, 0.8, 0.3], CHAIR_ARM));
  merge(mesh, box([0.35, 0.4, -0.4], [0.5, 0.8, 0.3], CHAIR_ARM));
  merge(mesh, box([-0.5, 0.7, -0.3], [0.3, 0.8, 0.15], CUSHION));
  for (const [x, z] of [[-0.55, -0.35], [-0.55, 0.35], [0.35, -0.35], [0.35, 0.35]]) {
    merge(mesh, box([x - 0.04, 0, z - 0.04], [x + 0.04, 0.15, z + 0.04], WOOD_LEG));
  }
  merge(mesh, box([0.75, 0, -0.04], [0.83, 1.5, 0.04], LAMP_POLE));
  merge(mesh, boxWithout([0.6, 1.3, -0.2], [1.0, 1.5, 0.2], LAMP_SHADE, ['bottom', 'top']));
  merge(mesh, box([0.65, 0, -0.15], [0.95, 0.06, 0.15], LAMP_POLE));
  for (const f of mesh.faces) f.cull = true;
  return mesh;
}
