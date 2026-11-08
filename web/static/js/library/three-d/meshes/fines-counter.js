// The Fines Counter: a counter with a register, coin stacks, and a coral
// plaque. Geometry technique from anime-furniture.js's drawFinesRoom colours.

import { emptyMesh, merge, box, boxWithout } from './geom.js';

const COUNTER = '#ffcfa8';
const COUNTER_TOP = '#e8b58a';
const PLAQUE = '#ff8a7a';
const REGISTER = '#c9b8ff';
const DISPLAY = '#bff2e0';
const COIN_GOLD = '#ffd166';
const COIN_DEEP = '#e0a020';

export function buildFinesCounter() {
  const mesh = emptyMesh();
  merge(mesh, boxWithout([-1.2, 0, -0.5], [1.2, 0.7, 0.5], COUNTER, ['bottom']));
  merge(mesh, boxWithout([-1.3, 0.7, -0.55], [1.3, 0.85, 0.55], COUNTER_TOP, ['bottom']));
  merge(mesh, box([-0.6, 1.2, -0.56], [0.6, 1.5, -0.55], PLAQUE));
  merge(mesh, boxWithout([-0.3, 0.85, -0.25], [0.5, 1.3, 0.25], REGISTER, ['bottom']));
  merge(mesh, box([-0.2, 1.1, -0.26], [0.3, 1.28, -0.26], DISPLAY));
  for (const [cx, n] of [[-0.8, 3], [-0.5, 2]]) {
    for (let i = 0; i < n; i++) {
      merge(mesh, box([cx - 0.1, 0.85 + i * 0.08, -0.1], [cx + 0.1, 0.85 + (i + 1) * 0.08, 0.1], i % 2 ? COIN_DEEP : COIN_GOLD));
    }
  }
  for (const f of mesh.faces) f.cull = true;
  return mesh;
}
