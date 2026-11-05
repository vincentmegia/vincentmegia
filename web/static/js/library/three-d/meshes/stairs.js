// Stairs mesh: a flight of stacked step boxes plus two side rails.
// Model space: base at y=0, centered on x=0, ascends toward +Z.
import { box } from './geom.js';

export const STAIR_RISE_PER_STEP = 0.18;
export const STAIR_RUN_PER_STEP = 0.28;

const TREAD = '#c9a77c';
const RAIL = '#6b4a2f';
const HALF_WIDTH = 0.5;
const RAIL_THICK = 0.06;

export function buildStairs(opts = {}) {
  const steps = Math.max(1, Math.floor(opts.steps ?? 8));
  const totalRun = steps * STAIR_RUN_PER_STEP;
  const totalRise = steps * STAIR_RISE_PER_STEP;
  const vertices = [];
  const faces = [];
  const add = (b) => {
    const base = vertices.length;
    for (const v of b.vertices) vertices.push(v);
    for (const f of b.faces) faces.push({ indices: f.indices.map((i) => i + base), color: f.color });
  };

  // Step i spans z from i*run to the back; each tread top stays exposed.
  for (let i = 0; i < steps; i++) {
    add(box(
      [-HALF_WIDTH, i * STAIR_RISE_PER_STEP, i * STAIR_RUN_PER_STEP],
      [HALF_WIDTH, (i + 1) * STAIR_RISE_PER_STEP, totalRun],
      TREAD,
    ));
  }
  // Side rails sit just outside the steps (butt, not overlap).
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? -HALF_WIDTH - RAIL_THICK : HALF_WIDTH;
    add(box([x0, 0, 0], [x0 + RAIL_THICK, totalRise, totalRun], RAIL));
  }
  return { vertices, faces };
}
