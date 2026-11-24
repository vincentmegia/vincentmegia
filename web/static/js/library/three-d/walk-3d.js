// Each First Person character's walk — "just make a unique walking animation",
// "as the 2D ones" (the user, Nov 2026).
//
// The 2D walk is two layers, and this module is the 3D side of both:
//
//   1. An articulated cycle. `staff-kit.js`'s `walkCycle(t, freq, walking)`
//      drives `legPoses`, whose hip angle is `sin(phase + side) * swing`. The
//      same angle swings the 3D mesh's hip joints (core.js's `joints`), so the
//      legs step in the same rhythm, at each character's own frequency, as the
//      sprite the Top-Down camera draws.
//   2. A whole-body rhythm. `walk-styles.js` gives every character their own
//      gait about their feet — the guard's march, the volunteer's squashing
//      skip, the janitor's waddle, the shelver's lean, the storyteller's
//      twirl, the director's swagger, the archivist's stoop. This module calls
//      that table's own `pose()` rather than restating it, so the two cameras
//      cannot drift apart: a change there shows up in both.
//
// Pure and DOM-free, like the rest of `three-d/`: it answers with numbers a
// placement can carry, and `scene.js` spreads them onto one.
//
// Two things the 3D cannot take literally from the 2D:
//
//   * **No knee.** A 3D leg is one rigid box from hip to shoe
//     (`character-body.js`), so `legPoses`' knee bend has nowhere to go. The
//     hip swing alone reads as walking; a knee would need the leg split in
//     two, which is a mesh change, not a gait change.
//   * **No mirror twirl.** The storyteller's 2D spin is a negative x scale,
//     which in 3D would turn her mesh inside out and invert its back-face
//     culling. She gets a real yaw spin instead (`yawSpin`).

import { walkCycle } from '../staff-kit.js';
import { WALK_STYLES } from '../walk-styles.js';
import { PX } from './meshes/character-frame.js';

/**
 * `walk-styles.js` works in canvas px at the scale Top-Down draws a library
 * person (library-game.js's `LIBRARY_PERSON_SCALE`), so its lift converts to
 * scene units through that scale and then art px -> units.
 */
const SPRITE_SCALE = 1.55;
const CANVAS_PX_TO_UNITS = PX / SPRITE_SCALE;

/** How much of the hip's swing an arm takes, opposing it. The 2D's `swingArm` hangs the arm off the same stride at a visibly smaller amplitude. */
const ARM_SWING_RATIO = 0.6;

/**
 * Each character's leg cycle, with the frequency and the `legPoses` tuning
 * their own 2D renderer passes — so a 3D stride is the same length and speed
 * as the sprite's. `bend` is carried for the record even though a rigid 3D leg
 * cannot use it (see the header); it is what the 2D knee does.
 *
 * Keyed exactly as `WALK_STYLES` is, which the tests hold us to.
 */
export const GAIT_3D = {
  guard: { freq: 5, swing: 0.26, bend: 0.3 }, // security.js
  volunteer: { freq: 6, swing: 0.3, bend: 0.75 }, // volunteer.js
  libJanitor: { freq: 3.2, swing: 0.16, bend: 0.28 }, // janitor.js
  libShelver: { freq: 9, swing: 0.2, bend: 0.4 }, // shelver.js
  libStoryteller: { freq: 5.2, swing: 0.26, bend: 0.55 }, // storyteller.js
  // director-seo.js steps at t * 6 and draws its own legs rather than calling
  // legPoses, so the stride is legPoses' own default.
  libDirector: { freq: 6, swing: 0.3, bend: 0.42 },
  libArchivist: { freq: 2.2, swing: 0.14, bend: 0.3 }, // archivist.js
};

/** Anyone with no 2D walk style of their own — a queued patron, Karen — walks like patron.js does. */
const DEFAULT_GAIT = { freq: 5, swing: 0.26, bend: 0.45 };

/** The pose a character who is standing still gets: nothing at all. */
const AT_REST = { jointPose: {}, lift: 0, roll: 0, lean: 0, squash: [1, 1], yawSpin: 0 };

/** How long the storyteller's twirl lasts, as a fraction of her 4-second cycle (walk-styles.js's `spin < 0.18`). */
const TWIRL_SECONDS = 4;
const TWIRL_FRACTION = 0.18;

/**
 * One character's walk this frame, ready to spread onto a placement
 * (`core.js` reads `jointPose`, `lift`, `roll`, `lean`, `squash`; `scene.js`
 * adds `yawSpin` to the character's facing).
 *
 * @param {string} key - the character's `WALK_STYLES`/`GAIT_3D` key (an
 *   ambient-staff key); anything unknown gets `DEFAULT_GAIT`.
 * @param {{t: number, walking: boolean, dir: number}} state - `t` seconds
 *   (the walker's own clock, phase included), `dir` 1 moving right, -1 left.
 * @returns {{jointPose: object, lift: number, roll: number, lean: number, squash: [number, number], yawSpin: number}}
 */
export function walk3dPose(key, { t, walking, dir = 1 }) {
  if (!walking) return { ...AT_REST, jointPose: {} };

  const gait = GAIT_3D[key] ?? DEFAULT_GAIT;
  const { phase, amount } = walkCycle(t, gait.freq, true);

  // legPoses' own hip angle, per side: the left leg leads, the right follows
  // half a cycle later. Negated because a character faces +Z, so a positive
  // hip angle has to swing the foot forward rather than back.
  const jointPose = {};
  for (const [name, arm, side] of [['leg.left', 'arm.left', -1], ['leg.right', 'arm.right', 1]]) {
    const hip = Math.sin(phase + (side < 0 ? 0 : Math.PI)) * gait.swing * amount;
    jointPose[name] = { rotX: -hip };
    jointPose[arm] = { rotX: hip * ARM_SWING_RATIO };
  }

  const style = WALK_STYLES[key];
  if (!style) return { jointPose, lift: 0, roll: 0, lean: 0, squash: [1, 1], yawSpin: 0 };

  const body = style.pose(t, dir);
  // The 2D's dy is a canvas offset with +y down, so an upward lift is negative
  // there and positive here. Its sx can go negative (the storyteller's mirror
  // twirl); a negative 3D scale would invert the mesh, so the spin becomes a
  // yaw and the scale stays positive.
  const twirl = key === 'libStoryteller' ? (t % TWIRL_SECONDS) / TWIRL_SECONDS : 1;
  const spinning = twirl < TWIRL_FRACTION;
  return {
    jointPose,
    lift: -body.dy * CANVAS_PX_TO_UNITS,
    roll: body.rot,
    lean: body.lean,
    squash: [Math.abs(body.sx), Math.abs(body.sy)],
    yawSpin: spinning ? (twirl / TWIRL_FRACTION) * Math.PI * 2 : 0,
  };
}
