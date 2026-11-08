// The Boss's Office: a pastel door with panels, a round window, a gold
// plaque and a door knob. Locked state greys it out.
// Geometry technique from anime-furniture.js's drawBossDoor colours.

import { emptyMesh, merge, box, boxWithout } from './geom.js';

const DOOR_FRAME = '#c9a0d8';
const DOOR = '#f2e2ff';
const DOOR_LOCKED = '#cfc8d8';
const WINDOW = '#e6dcff';
const PLAQUE = '#ffd166';
const KNOB = '#ffd166';

export function buildBossOffice({ locked } = {}) {
  const doorColour = locked ? DOOR_LOCKED : DOOR;
  const mesh = emptyMesh();
  merge(mesh, boxWithout([-1.0, 0, -0.1], [1.0, 2.2, 0.1], DOOR_FRAME, ['bottom']));
  merge(mesh, boxWithout([-0.8, 0, -0.12], [0.8, 2.0, 0.12], doorColour, ['bottom']));
  merge(mesh, box([-0.2, 1.5, -0.13], [0.2, 1.8, -0.13], WINDOW));
  merge(mesh, box([-0.5, 2.0, -0.13], [0.5, 2.2, -0.13], PLAQUE));
  merge(mesh, box([0.55, 1.1, -0.14], [0.7, 1.25, -0.14], KNOB));
  if (locked) {
    merge(mesh, box([-0.2, 1.0, -0.15], [0.2, 1.35, -0.15], '#5a5060'));
  }
  for (const f of mesh.faces) f.cull = true;
  return mesh;
}
