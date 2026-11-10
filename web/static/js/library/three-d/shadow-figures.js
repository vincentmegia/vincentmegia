// Hallucination shadow figures in First Person (camera parity P7: world
// effects live in the world). library-game.js's updateHallucinations stays
// the single source of truth for where a figure is and how long it lives;
// this turns those {x, y, age, life} records into scene placements. Pure,
// DOM-free.
import { buildShadowFigure } from './meshes/shadow-figure.js';

const UNIT_SCALE = 40; // scene.js's; repeated so this module stays a leaf

/**
 * A figure's opacity at time `t` (seconds): it fades in and out over its life
 * and flickers fast. Top-Down's drawHallucinations and First Person both use
 * this, so the two can't drift.
 */
export function shadowFigureAlpha(figure, t) {
  const fade = Math.sin((figure.age / figure.life) * Math.PI);
  return 0.55 * fade * (0.7 + 0.3 * Math.sin(t * 30));
}

/**
 * Billboard yaw (radians about +Y): turns the mesh's +Z face toward the viewer.
 * The scene's placement maps model +Z to world (sin yaw, cos yaw) in (x, y),
 * the same convention the queue patrons' yaw toward their desk uses.
 */
export function billboardYaw(from, viewer) {
  return Math.atan2(viewer.x - from.x, viewer.y - from.y);
}

/**
 * @param {{x: number, y: number, age: number, life: number}[]} figures
 * @param {{x: number, y: number}} viewer the camera's position on the floor plan
 * @param {number} t seconds, for the flicker
 * @returns {{mesh: object, placement: {pos: number[], yaw: number, scale: number, alpha: number}}[]}
 *   one placement per visible figure, standing at its own x/y on the floor
 */
export function shadowFigurePlacements(figures, viewer, t) {
  const mesh = buildShadowFigure();
  const out = [];
  for (const f of figures) {
    const alpha = shadowFigureAlpha(f, t);
    if (!(alpha > 0)) continue;
    out.push({ mesh, placement: { pos: [f.x, 0, f.y], yaw: billboardYaw(f, viewer), scale: UNIT_SCALE, alpha: Math.min(1, alpha) } });
  }
  return out;
}
