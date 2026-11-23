// Collision geometry for Library Shift (docs/features/library-game.md,
// docs/superpowers/specs/2026-11-23-library-object-collision-design.md).
//
// The user's ask was "the objects should not collide". Nothing in this game
// was solid before: the only constraint on Eun-mi was floor-plan.js's
// `clampToCanvas`, the canvas edge, so she walked through bookcases, desks,
// decor and people in both cameras.
//
// This module is pure — no DOM, no canvas, no clock (docs/skills/javascript/
// SKILL.md's "pure logic module" contract) — so every push, slide and
// footprint is unit-tested in collision.test.js and both cameras can share
// exactly one source of the geometry.
//
// Two cameras, two footprint sets, one module: the game draws its furniture
// at two different sizes (a bookshelf tile is 124 x 100 px; its First Person
// mesh is 40 x 14), so colliding one camera against the other's art would
// leave a 57 px invisible wall in front of every shelf. `obstaclesFor` takes
// the camera and answers with the footprints of the art that camera draws.
//
// How each camera uses it (library-game.js):
//   * First Person BLOCKS — `slideMove` against the real `player.x/y`, since
//     the camera *is* that position.
//   * Top-Down RESOLVES AT DRAW TIME ONLY — `resolveCollisions` inside the
//     draw pose, never writing `player.x/y`, because arrival detection reads
//     it and the approach circle clears furniture by as little as 1.1 px.
//     Kitchen Shift already recorded what happens if you push the real
//     position there: `cooking-game.js`'s `updatePlayer` JSDoc describes two
//     customers at one standoff point shoving each other back forever.
//
// `resolveCollisions` restates Kitchen Shift's `resolveObstacleCollisions`
// (web/static/js/cooking/floor-plan.js) rather than sharing it: the two
// games' obstacle sets differ, and lifting that function into shared/ would
// put Kitchen Shift's shipped behaviour at risk for no gain here.
//
// An obstacle is one of:
//   * `{x, y, halfWidth, halfHeight}` — an axis-aligned rectangle (furniture)
//   * `{x, y, radius}`                — a circle (people)

/** Eun-mi's collision footprint (px). Roughly her body's own width, so being stopped reads as the body rather than an invisible bubble; matches Kitchen Shift's player radius. */
export const PLAYER_COLLISION_RADIUS = 14;

/** Every other character's footprint (px) — patrol staff, queued patrons, Karen. */
export const PERSON_COLLISION_RADIUS = 14;

/**
 * The longest single hop `slideMove` will take before testing for overlap
 * again (px).
 *
 * `library-game.js`'s `loop` clamps a frame's `deltaSeconds` to 0.1 s, so one
 * sprinting frame asks to move 200 * 1.6 * 0.1 = 32 px — more than a
 * bookshelf's whole 14 px-deep First Person footprint plus two radii. Without
 * substepping, a tab regaining focus would put Eun-mi straight through a
 * shelf. Every obstacle is at least 2 * radius = 28 px thick once the
 * footprint is added, so hops of at most 14 px cannot cross one.
 */
export const MAX_SUBSTEP_PX = 14;

/** The point on a rectangular obstacle closest to (x, y) — the basis of both the overlap test and the push. */
function closestPointOnBox(x, y, obs) {
  return {
    x: Math.max(obs.x - obs.halfWidth, Math.min(x, obs.x + obs.halfWidth)),
    y: Math.max(obs.y - obs.halfHeight, Math.min(y, obs.y + obs.halfHeight)),
  };
}

/** Whether a circle of `radius` at (x, y) overlaps one obstacle. */
function overlaps(x, y, radius, obs) {
  if (obs.radius !== undefined) {
    return Math.hypot(x - obs.x, y - obs.y) < radius + obs.radius;
  }
  const near = closestPointOnBox(x, y, obs);
  const dx = x - near.x;
  const dy = y - near.y;
  return dx * dx + dy * dy < radius * radius;
}

/** Whether a circle of `radius` at (x, y) is clear of every obstacle. */
function isClear(x, y, radius, obstacles) {
  for (const obs of obstacles) if (overlaps(x, y, radius, obs)) return false;
  return true;
}

/**
 * Pushes a circle (`radius`, centred at `x, y`) out of every `obstacles`
 * entry it overlaps, each along the shortest way out.
 *
 * Obstacles resolve one at a time in list order, so two overlapping
 * obstacles can fight over the same push. That never happens here: real
 * obstacles (stations, decor, characters) don't overlap each other — only the
 * moving entity passing near or between them.
 *
 * A position that is already clear is returned unchanged, not recomputed, so
 * a resolved pose is bit-identical to the raw one when nothing is in the way.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} radius
 * @param {({x: number, y: number, radius: number}|{x: number, y: number, halfWidth: number, halfHeight: number})[]} obstacles
 * @returns {{x: number, y: number}}
 */
export function resolveCollisions(x, y, radius, obstacles) {
  let rx = x;
  let ry = y;
  for (const obs of obstacles) {
    if (obs.radius !== undefined) {
      const dx = rx - obs.x;
      const dy = ry - obs.y;
      const minDist = radius + obs.radius;
      const dist = Math.hypot(dx, dy);
      if (dist >= minDist) continue;
      if (dist > 0) {
        const push = minDist - dist;
        rx += (dx / dist) * push;
        ry += (dy / dist) * push;
      } else {
        // Exactly coincident centres. Any direction is as good as another, so
        // pick one that is the same on every call — two walkers pausing on the
        // same spot (Security and Ji-ho share [470, ~555] every lap) must not
        // flip between escapes frame to frame.
        rx = obs.x + minDist;
        ry = obs.y;
      }
      continue;
    }
    const near = closestPointOnBox(rx, ry, obs);
    const dx = rx - near.x;
    const dy = ry - near.y;
    const distSq = dx * dx + dy * dy;
    if (distSq >= radius * radius) continue;
    const dist = Math.sqrt(distSq);
    if (dist > 0) {
      const push = radius - dist;
      rx += (dx / dist) * push;
      ry += (dy / dist) * push;
    } else {
      // The centre is inside the box: leave by whichever axis is shallower.
      const overlapX = obs.halfWidth + radius - Math.abs(rx - obs.x);
      const overlapY = obs.halfHeight + radius - Math.abs(ry - obs.y);
      if (overlapX < overlapY) rx = obs.x + (rx >= obs.x ? 1 : -1) * (obs.halfWidth + radius);
      else ry = obs.y + (ry >= obs.y ? 1 : -1) * (obs.halfHeight + radius);
    }
  }
  return { x: rx, y: ry };
}

/**
 * One frame's *blocked* move: walks a circle from (x, y) by (dx, dy) as far as
 * the obstacles allow, sliding along a surface rather than sticking to it.
 *
 * Per substep (see `MAX_SUBSTEP_PX`): try both axes; if that lands in an
 * obstacle, try the x component alone, then the y component alone, and keep
 * the first that is clear. Walking into a shelf face at an angle therefore
 * keeps the component along the face and drops the one into it — the
 * difference between sliding and jamming. If neither axis is clear, the
 * substep is refused and the walk stops there.
 *
 * This is what First Person needs and Kitchen Shift has no equivalent of: its
 * collision is draw-time only, so it never has to stop anyone.
 *
 * @returns {{x: number, y: number, blocked: boolean}} `blocked` is true if any
 *   substep had to be reduced — for a future bump cue; nothing reads it yet.
 */
export function slideMove(x, y, dx, dy, radius, obstacles) {
  if (dx === 0 && dy === 0) return { x, y, blocked: false };

  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / MAX_SUBSTEP_PX));
  const stepX = dx / steps;
  const stepY = dy / steps;

  let cx = x;
  let cy = y;
  let blocked = false;

  for (let i = 0; i < steps; i++) {
    if (isClear(cx + stepX, cy + stepY, radius, obstacles)) {
      cx += stepX;
      cy += stepY;
    } else if (stepX !== 0 && isClear(cx + stepX, cy, radius, obstacles)) {
      cx += stepX;
      blocked = true;
    } else if (stepY !== 0 && isClear(cx, cy + stepY, radius, obstacles)) {
      cy += stepY;
      blocked = true;
    } else {
      blocked = true;
      break;
    }
  }

  return { x: cx, y: cy, blocked };
}
