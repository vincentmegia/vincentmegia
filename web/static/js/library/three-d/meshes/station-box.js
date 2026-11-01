// Generic station box (desk / counter / table): width x height x depth,
// base at y=0, centered on x/z. Pure and deterministic.
import { box } from './character.js';

export function buildStationBox({ width, depth, height, color }) {
  return box([-width / 2, 0, -depth / 2], [width / 2, height, depth / 2], color);
}
