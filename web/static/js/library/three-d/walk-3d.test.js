import test from 'node:test';
import assert from 'node:assert/strict';

import { walk3dPose, GAIT_3D } from './walk-3d.js';
import { WALK_STYLES } from '../walk-styles.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);
/** The first t > 0 at which `pick` peaks, sampled finely. */
function firstPeak(key, pick) {
  let best = { v: -Infinity, t: 0 };
  for (let t = 0; t < 2; t += 0.001) {
    const v = pick(walk3dPose(key, { t, walking: true, dir: 1 }));
    if (v > best.v) best = { v, t };
  }
  return best.t;
}

test('a standing character has no pose at all', () => {
  const p = walk3dPose('guard', { t: 3.21, walking: false, dir: 1 });
  assert.deepEqual(p.jointPose, {});
  assert.equal(p.lift, 0);
  assert.equal(p.roll, 0);
  assert.equal(p.lean, 0);
  assert.equal(p.yawSpin, 0);
  assert.deepEqual(p.squash, [1, 1]);
});

test('every 2D walk style has a 3D gait', () => {
  assert.deepEqual(Object.keys(GAIT_3D).sort(), Object.keys(WALK_STYLES).sort());
});

test('each gait keeps its 2D leg frequency', () => {
  // The frequencies each character's own 2D renderer passes to walkCycle.
  assert.equal(GAIT_3D.guard.freq, 5); // security.js
  assert.equal(GAIT_3D.volunteer.freq, 6); // volunteer.js
  assert.equal(GAIT_3D.libJanitor.freq, 3.2); // janitor.js
  assert.equal(GAIT_3D.libShelver.freq, 9); // shelver.js
  assert.equal(GAIT_3D.libStoryteller.freq, 5.2); // storyteller.js
  assert.equal(GAIT_3D.libArchivist.freq, 2.2); // archivist.js
});

test('the legs swing in opposite phase, and the arms oppose the legs', () => {
  const { jointPose } = walk3dPose('guard', { t: 0.07, walking: true, dir: 1 });
  near(jointPose['leg.left'].rotX, -jointPose['leg.right'].rotX);
  assert.ok(jointPose['leg.left'].rotX !== 0, 'the legs should be swinging');
  // An arm swings against the leg on its own side.
  assert.ok(Math.sign(jointPose['arm.left'].rotX) !== Math.sign(jointPose['leg.left'].rotX));
  assert.ok(Math.sign(jointPose['arm.right'].rotX) !== Math.sign(jointPose['leg.right'].rotX));
});

test("a hip's swing is the 2D's own angle: sin(phase) x swing", () => {
  const t = 0.11;
  const g = GAIT_3D.libShelver;
  const { jointPose } = walk3dPose('libShelver', { t, walking: true, dir: 1 });
  near(jointPose['leg.left'].rotX, -Math.sin(t * g.freq) * g.swing);
});

test('an arm swings less than the leg it opposes', () => {
  const { jointPose } = walk3dPose('volunteer', { t: 0.09, walking: true, dir: 1 });
  assert.ok(Math.abs(jointPose['arm.left'].rotX) < Math.abs(jointPose['leg.left'].rotX));
});

test('a faster gait reaches its first stride peak sooner', () => {
  // The shelver power-walks at 9, the archivist strolls at 2.2.
  assert.ok(firstPeak('libShelver', (p) => p.jointPose['leg.left'].rotX)
    < firstPeak('libArchivist', (p) => p.jointPose['leg.left'].rotX));
});

test("the body rhythm is the 2D style's own, converted to scene units", () => {
  const t = 0.33;
  const pose = walk3dPose('guard', { t, walking: true, dir: 1 });
  const flat = WALK_STYLES.guard.pose(t, 1);
  // The 2D lifts by a negative canvas y; the scene lifts by a positive height.
  assert.ok(pose.lift > 0 === flat.dy < 0);
  near(pose.roll, flat.rot);
});

test('the volunteer skips: the body squashes as the hop lands', () => {
  // walk-styles.js: land = 1 - hop, sx = 1 + land*0.05, sy = 1 - land*0.06.
  let landed = null;
  for (let t = 0; t < 2; t += 0.001) {
    const p = walk3dPose('volunteer', { t, walking: true, dir: 1 });
    if (p.lift < 1e-4 && (landed === null || p.squash[1] < landed[1])) landed = p.squash;
  }
  assert.ok(landed[1] < 1, `sy should squash on landing, got ${landed[1]}`);
  assert.ok(landed[0] > 1, `sx should widen on landing, got ${landed[0]}`);
});

test('the shelver leans the way she is going, and flips with direction', () => {
  const right = walk3dPose('libShelver', { t: 0.4, walking: true, dir: 1 });
  const left = walk3dPose('libShelver', { t: 0.4, walking: true, dir: -1 });
  assert.ok(right.lean !== 0);
  near(right.lean, -left.lean);
});

test('the storyteller twirls on her yaw, never by mirroring her mesh', () => {
  // The 2D spins her by flipping sx negative; a negative scale would turn a
  // 3D mesh inside out, so the twirl is a yaw instead.
  let spun = false;
  for (let t = 0; t < 4.2; t += 0.002) {
    const p = walk3dPose('libStoryteller', { t, walking: true, dir: 1 });
    assert.ok(p.squash[0] > 0 && p.squash[1] > 0, `squash must stay positive, got ${p.squash}`);
    if (Math.abs(p.yawSpin) > 0.5) spun = true;
  }
  assert.ok(spun, 'she should turn a full circle every four seconds');
});

test('nobody else twirls', () => {
  for (const key of Object.keys(GAIT_3D)) {
    if (key === 'libStoryteller') continue;
    for (let t = 0; t < 4.2; t += 0.01) {
      assert.equal(walk3dPose(key, { t, walking: true, dir: 1 }).yawSpin, 0, key);
    }
  }
});

test('an unknown character still swings its legs, with a flat body', () => {
  // Queued patrons and Karen have no 2D walk style; patron.js walks at 5.
  const p = walk3dPose('nobodyInParticular', { t: 0.1, walking: true, dir: 1 });
  assert.ok(p.jointPose['leg.left'].rotX !== 0);
  assert.equal(p.lift, 0);
  assert.equal(p.roll, 0);
  assert.deepEqual(p.squash, [1, 1]);
});
