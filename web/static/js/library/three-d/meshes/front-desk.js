// The Front Desk: a wide counter with a monitor, book stack and service bell.
// Geometry technique — flat-coloured 3D shapes matching anime-furniture.js's
// drawFrontDesk colours (no texture).

import { emptyMesh, merge, box, boxWithout } from './geom.js';

const COUNTER = '#ffcfa8';
const COUNTER_TOP = '#e8b58a';
const MONITOR_BODY = '#5a5a78';
const MONITOR_SCREEN = '#d6ecff';
const BOOK_COLOURS = ['#8fd3ff', '#ff8a7a', '#c9b8ff'];
const BELL = '#ffd166';

export function buildFrontDesk() {
  const mesh = emptyMesh();
  merge(mesh, boxWithout([-1.3, 0, -0.4], [1.3, 0.8, 0.4], COUNTER, ['bottom']));
  merge(mesh, boxWithout([-1.4, 0.8, -0.5], [1.4, 0.95, 0.5], COUNTER_TOP, ['bottom']));
  merge(mesh, boxWithout([-0.9, 0.95, -0.15], [-0.1, 1.7, 0.15], MONITOR_BODY, ['bottom']));
  merge(mesh, box([-0.85, 1.0, -0.16], [-0.15, 1.55, -0.16], MONITOR_SCREEN));
  BOOK_COLOURS.forEach((c, i) => {
    merge(mesh, box([0.2, 0.95 + i * 0.16, -0.3], [0.8, 0.95 + (i + 1) * 0.14, 0.0], c));
  });
  merge(mesh, box([1.0, 0.95, -0.2], [1.3, 1.15, 0.1], BELL));
  for (const f of mesh.faces) f.cull = true;
  return mesh;
}
