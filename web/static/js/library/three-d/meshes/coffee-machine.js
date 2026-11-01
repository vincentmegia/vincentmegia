// Coffee machine mesh: body, group-head spout, drip tray, cup. Front faces +Z.
// Model space: base at y=0, centered x=0/z=0. ~0.4w x 0.5h x 0.4d.
import { box } from './character.js';

const BODY = '#3a3f47';
const TOP = '#505762';
const SPOUT = '#9aa3ad';
const TRAY = '#22252a';
const CUP = '#f2ece0';
const COFFEE = '#5a3b22';
export const PALETTE_COLORS = { BODY, TOP, SPOUT, TRAY, CUP, COFFEE };

/** @returns {{vertices: number[][], faces: {indices:number[], color:string}[]}} */
export function buildCoffeeMachine() {
  const parts = [
    // drip tray at the base, proud of the body front
    box([-0.19, 0, -0.14], [0.19, 0.03, 0.2], TRAY),
    // main body, set back
    box([-0.2, 0.03, -0.2], [0.2, 0.5, 0.05], BODY),
    // top cap, slightly proud
    box([-0.205, 0.46, -0.205], [0.205, 0.505, 0.055], TOP),
    // overhang housing the group head
    box([-0.2, 0.28, 0.05], [0.2, 0.4, 0.14], BODY),
    // spout jutting down from the overhang
    box([-0.03, 0.22, 0.09], [0.03, 0.28, 0.15], SPOUT),
    // cup under the spout
    box([-0.045, 0.03, 0.08], [0.045, 0.12, 0.16], CUP),
    // coffee surface, proud of cup top
    box([-0.035, 0.12, 0.09], [0.035, 0.125, 0.15], COFFEE),
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
