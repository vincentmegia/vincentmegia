// Elevator doorway + car. Pure and deterministic.
// Model space: X right, Y up, Z depth; base y=0, centered x=0. The doors face -Z
// (toward the player); the car extends back toward +Z.
import { box } from './character.js';

export const ELEVATOR_DOOR_COLOR = '#b8bec6';
export const ELEVATOR_HALF_DOORWAY = 0.5;
const CAR = '#6e7681';
const INDICATOR = '#f5b82e';

/**
 * @param {{doorOpen?: number}} [opts] doorOpen in [0,1]; each panel's inner edge
 *   sits doorOpen * ELEVATOR_HALF_DOORWAY from center (left -X, right +X).
 * @returns {{vertices: number[][], faces: {indices:number[], color:string}[]}}
 */
export function buildElevator(opts = {}) {
  const open = Math.min(1, Math.max(0, opts.doorOpen ?? 0));
  const h = ELEVATOR_HALF_DOORWAY;
  const d = open * h;
  const parts = [
    box([-0.7, 0, -0.1], [-h, 2.0, 1.0], CAR), // left side wall / post
    box([h, 0, -0.1], [0.7, 2.0, 1.0], CAR), // right side wall / post
    box([-h, 0.02, 0.95], [h, 2.0, 1.0], CAR), // back wall
    box([-0.7, 2.0, -0.1], [0.7, 2.2, 1.0], CAR), // lintel + roof
    // door panels, proud of the frame front (z=-0.1), width 0.5 each
    box([-d - 0.5, 0.02, -0.16], [-d, 2.0, -0.11], ELEVATOR_DOOR_COLOR),
    box([d, 0.02, -0.16], [d + 0.5, 2.0, -0.11], ELEVATOR_DOOR_COLOR),
    box([-0.15, 2.05, -0.11], [0.15, 2.15, -0.1], INDICATOR), // floor indicator
  ];
  const vertices = [];
  const faces = [];
  for (const p of parts) {
    const off = vertices.length;
    vertices.push(...p.vertices);
    for (const f of p.faces) faces.push({ indices: f.indices.map((i) => i + off), color: f.color });
  }
  return { vertices, faces };
}
