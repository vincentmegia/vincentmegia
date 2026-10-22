// Each Library Shift staff member's own walk ("make it so everyone has a
// unique walk"). Hospital Shift's anime renderer draws a body in one piece
// (no swinging legs), so a walk here is a rhythm applied to the whole
// figure around its feet — bob, hop, tilt, lean, squash, a twirl. The
// staff's own renderers (security.js, janitor.js, …) swing their legs and
// props at the same rhythm, so the two together make the walk. Min-jun and
// Eun-mi have their own walk cycles in their renderers, so they aren't
// listed. Pure canvas transforms: no DOM, testable with a fake context.

/**
 * The walk's transform at time `t` (seconds), facing `dir` (1 right, -1
 * left): `dy` lift (negative is up), `rot` tilt, `lean` skew toward the
 * direction of travel, `sx`/`sy` squash and stretch. All about the feet.
 *
 * @typedef {{dy: number, rot: number, lean: number, sx: number, sy: number}} WalkPose
 */

/** @type {Record<string, {name: string, pose: (t: number, dir: number) => WalkPose}>} */
export const WALK_STYLES = {
  // An upright march: a firm, even bob and a slight shoulder roll.
  guard: {
    name: 'march',
    pose: (t) => {
      const c = t * 5;
      return { dy: -Math.abs(Math.sin(c)) * 3, rot: Math.sin(c) * 0.02, lean: 0, sx: 1, sy: 1 };
    },
  },
  // A bouncy skip: hops, squashing a little on each landing.
  volunteer: {
    name: 'skip',
    pose: (t) => {
      const hop = Math.abs(Math.sin(t * 6));
      const land = 1 - hop;
      return { dy: -hop * hop * 9, rot: Math.sin(t * 6) * 0.03, lean: 0, sx: 1 + land * 0.05, sy: 1 - land * 0.06 };
    },
  },
  // A slow, side-to-side waddle behind his mop.
  libJanitor: {
    name: 'waddle',
    pose: (t) => {
      const c = t * 3.2;
      return { dy: -Math.abs(Math.cos(c)) * 1.5, rot: Math.sin(c) * 0.07, lean: 0, sx: 1, sy: 1 };
    },
  },
  // A brisk power-walk: quick steps, leaning into where she's going.
  libShelver: {
    name: 'power-walk',
    pose: (t, dir) => {
      const c = t * 9;
      return { dy: -Math.abs(Math.sin(c)) * 2, rot: 0, lean: 0.1 * dir, sx: 1, sy: 1 };
    },
  },
  // A dance-y sway with a little twirl every four seconds.
  libStoryteller: {
    name: 'dance',
    pose: (t) => {
      const c = t * 2.6;
      const spin = (t % 4) / 4;
      const sx = spin < 0.18 ? Math.cos((spin / 0.18) * Math.PI * 2) : 1;
      return { dy: -Math.abs(Math.sin(c * 2)) * 3, rot: Math.sin(c) * 0.09, lean: 0, sx, sy: 1 };
    },
  },
  // Director Seo's confident stride: an easy bounce, a slight swagger.
  libDirector: {
    name: 'confident stride',
    pose: (t) => {
      const c = t * 4.2;
      return { dy: -Math.abs(Math.sin(c)) * 1.6, rot: Math.sin(c) * 0.03, lean: 0, sx: 1, sy: 1 };
    },
  },
  // A slow, stooped stroll with a cane.
  libArchivist: {
    name: 'stroll',
    pose: (t, dir) => {
      const c = t * 2.2;
      return { dy: -Math.abs(Math.sin(c)) * 1.2, rot: Math.sin(c) * 0.015, lean: 0.06 * dir, sx: 1, sy: 1 };
    },
  },
};

/**
 * Applies `key`'s walk to the context, whose origin must be the walker's
 * feet. A no-op for anyone without a walk style, or when not walking.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} key
 * @param {number} t
 * @param {number} dir - 1 walking right, -1 left
 * @param {boolean} walking
 */
export function applyWalk(ctx, key, t, dir, walking) {
  const style = WALK_STYLES[key];
  if (!style || !walking) return;
  const p = style.pose(t, dir);
  ctx.translate(0, p.dy);
  // Lean: shear so the head moves toward the direction of travel while the
  // feet stay put (y is negative going up, so a negative x-per-y shear).
  if (p.lean) ctx.transform(1, 0, -p.lean, 1, 0, 0);
  if (p.rot) ctx.rotate(p.rot);
  if (p.sx !== 1 || p.sy !== 1) ctx.scale(p.sx, p.sy);
}
