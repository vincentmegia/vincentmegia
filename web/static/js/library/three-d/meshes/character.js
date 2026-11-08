// The first-person patron: the body (character-body.js) and the head
// (character-head.js) joined at the chin, in the 2D art's chibi proportions
// (3.36 heads tall). Pure and deterministic.
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
// buildCharacter is pure in (design, angry), but the first-person scene rebuilds
// every visible character on every frame, so the same handful of roster designs
// were rebuilt 60 times a second: ~0.045 ms each against ~0.003 ms to look one
// up, and buildDrawList's 2702 polys behind that.
//
// Memoised on the design OBJECT's identity, not on `design.key` as the review
// suggested. The roster's designs are stable module-level objects, so identity
// hits on every frame just as a key would, and identity cannot collide:
// `{ ...design, outfit: other }` keeps the key while being a different
// character, so a key would hand it the wrong mesh — silently, and in a test
// most of all. A design built fresh on each call simply misses, as it does
// today. A WeakMap also lets a discarded design's mesh be collected.
const CACHE = new WeakMap();

export function buildCharacter(design, opts = {}) {
  const angry = Boolean(opts.angry);
  const slot = CACHE.get(design);
  // The mesh is shared, so callers must treat it as read-only; buildDrawList
  // does, mapping every vertex into world space rather than moving it.
  if (slot && slot[angry ? 'angry' : 'calm']) return slot[angry ? 'angry' : 'calm'];

  const metrics = metricsFor(design);
  const palette = paletteFor(design);
  const mesh = emptyMesh();
  merge(mesh, buildBody(design, palette, metrics));
  merge(mesh, buildHead(design, palette, metrics, { angry }));
  // The only place age scaling happens.
  const built = scaleMesh(mesh, metrics.ageScale);

  if (design !== null && typeof design === 'object') {
    const next = slot ?? {};
    next[angry ? 'angry' : 'calm'] = built;
    CACHE.set(design, next);
  }
  return built;
}
