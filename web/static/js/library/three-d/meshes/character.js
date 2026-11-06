// The first-person patron: the body (character-body.js) and the head
// (character-head.js) joined at the chin, in the 2D art's chibi proportions
// (3.0 heads tall). Pure and deterministic.
// Model space: X right, Y up, Z depth; feet at y=0, centered on x/z, facing +Z.

import { emptyMesh, merge, scaleMesh } from './geom.js';
import { metricsFor } from './character-frame.js';
import { paletteFor } from './character-palette.js';
import { buildBody } from './character-body.js';
import { buildHead } from './character-head.js';

/**
 * @param {object} design a patron/staff design (hospital/anime-people.js format)
 * @param {{angry?: boolean}} [opts] `angry` scowls (Karen)
 * @returns {{vertices: number[][], faces: {indices:number[], color:string, unlit?:boolean}[]}}
 */
export function buildCharacter(design, opts = {}) {
  const metrics = metricsFor(design);
  const palette = paletteFor(design);
  const mesh = emptyMesh();
  merge(mesh, buildBody(design, palette, metrics));
  merge(mesh, buildHead(design, palette, metrics, { angry: Boolean(opts.angry) }));
  // The only place age scaling happens.
  return scaleMesh(mesh, metrics.ageScale);
}
