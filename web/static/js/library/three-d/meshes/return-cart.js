// The Return Cart: a wooden cart with shelves, posts and wheels.
// Geometry technique — flat-coloured 3D from anime-furniture.js's drawReturnCart.

import { emptyMesh, merge, box, boxWithout } from './geom.js';

const WOOD = '#d9a877';
const FRAME = '#8a6a4a';
const WHEEL = '#5a5a78';
const WHEEL_HUB = '#d6ecff';
const BOOK_COLOURS = ['#ff8a7a', '#8fd3ff', '#ffd166', '#8fe3c8', '#c9b8ff', '#ff8fb8'];

export function buildReturnCart() {
  const mesh = emptyMesh();
  merge(mesh, boxWithout([-0.8, 0.2, -0.5], [0.8, 0.32, 0.5], WOOD, ['bottom']));
  merge(mesh, boxWithout([-0.8, 0.7, -0.5], [0.8, 0.82, 0.5], WOOD, ['bottom']));
  for (const x of [-0.75, 0.75]) {
    for (const z of [-0.45, 0.45]) {
      merge(mesh, box([x - 0.04, 0.2, z - 0.04], [x + 0.04, 1.1, z + 0.04], FRAME));
    }
  }
  merge(mesh, box([0.75, 1.05, -0.45], [0.95, 1.12, 0.45], FRAME));
  for (let i = 0; i < 5; i++) {
    const x = -0.6 + i * 0.28;
    merge(mesh, box([x, 0.82, -0.2], [x + 0.18, 0.82 + 0.24 + (i % 3) * 0.06, 0.1], BOOK_COLOURS[i % 6]));
  }
  for (const x of [-0.55, 0.55]) {
    merge(mesh, box([x - 0.12, 0, -0.06], [x + 0.12, 0.2, 0.06], WHEEL));
    merge(mesh, box([x - 0.04, 0.06, -0.02], [x + 0.04, 0.14, 0.02], WHEEL_HUB));
  }
  for (const f of mesh.faces) f.cull = true;
  return mesh;
}
