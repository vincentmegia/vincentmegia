import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveCollisions,
  slideMove,
  PLAYER_COLLISION_RADIUS,
  PERSON_COLLISION_RADIUS,
  MAX_SUBSTEP_PX,
} from './collision.js';

/** A rectangular obstacle, the shape `obstaclesFor` emits for furniture. */
const box = (x, y, hw, hh) => ({ x, y, halfWidth: hw, halfHeight: hh });

describe('resolveCollisions', () => {
  test('leaves a clear position bit-identical', () => {
    const at = resolveCollisions(480, 380, 14, [box(580, 400, 20, 7)]);
    assert.equal(at.x, 480);
    assert.equal(at.y, 380);
  });

  test('pushes a circle out to the nearest face of a box', () => {
    // Inside a 40x14 box, just above its middle: pushed clear of its top face,
    // to 7 + 14 above the centre.
    const at = resolveCollisions(580, 397, 14, [box(580, 400, 20, 7)]);
    assert.equal(at.x, 580);
    assert.ok(Math.abs(at.y - (400 - 21)) < 1e-6, `y=${at.y}`);
  });

  test('a centre exactly inside a box escapes along the shallower axis', () => {
    const at = resolveCollisions(582, 400, 14, [box(580, 400, 20, 7)]);
    assert.equal(at.y, 400 + 7 + 14); // depth 7 is shallower than width 20
    assert.equal(at.x, 582);
  });

  test('separates two circles to exactly the sum of their radii', () => {
    const at = resolveCollisions(470, 562, 14, [{ x: 470, y: 548, radius: 14 }]);
    assert.ok(Math.abs(Math.hypot(at.x - 470, at.y - 548) - 28) < 1e-6);
  });

  test('coincident centres escape the same way every call', () => {
    const once = resolveCollisions(470, 548, 14, [{ x: 470, y: 548, radius: 14 }]);
    const twice = resolveCollisions(470, 548, 14, [{ x: 470, y: 548, radius: 14 }]);
    assert.deepEqual(once, twice);
    assert.ok(Math.hypot(once.x - 470, once.y - 548) >= 28 - 1e-9);
  });

  test('resolves against every obstacle in the list', () => {
    const at = resolveCollisions(100, 100, 14, [box(100, 112, 30, 8), box(112, 100, 8, 30)]);
    assert.ok(at.y < 100 && at.x < 100, `x=${at.x} y=${at.y}`);
  });
});

describe('slideMove', () => {
  test('passes a clear step through untouched and unblocked', () => {
    const at = slideMove(300, 300, 5, -5, 14, [box(580, 400, 20, 7)]);
    assert.deepEqual(at, { x: 305, y: 295, blocked: false });
  });

  test('slides along a blocked face instead of sticking', () => {
    // The box's bottom face is at y 407, so a 14 px circle is blocked below
    // y 421. Walking +x and -y from 424 into it: x advances, y does not.
    const at = slideMove(560, 424, 6, -6, 14, [box(580, 400, 20, 7)]);
    assert.equal(at.x, 566);
    assert.equal(at.y, 424);
    assert.equal(at.blocked, true);
  });

  test('a head-on step is fully blocked on that axis', () => {
    const at = slideMove(580, 424, 0, -6, 14, [box(580, 400, 20, 7)]);
    assert.equal(at.y, 424);
    assert.equal(at.blocked, true);
  });

  test('a 32 px sprint step cannot tunnel through a 14 px-deep footprint', () => {
    const at = slideMove(580, 428, 0, -32, 14, [box(580, 400, 20, 7)]);
    assert.ok(at.y >= 400 + 7 + 14 - 1e-6, `tunnelled to y=${at.y}`);
    assert.equal(at.blocked, true);
  });

  test('substeps never overshoot the requested step', () => {
    const at = slideMove(300, 300, 0, -32, 14, []);
    assert.ok(Math.abs(at.y - 268) < 1e-6, `y=${at.y}`);
    assert.equal(at.blocked, false);
  });

  test('a zero step returns the same position, unblocked', () => {
    assert.deepEqual(
      slideMove(480, 380, 0, 0, 14, [box(480, 380, 20, 7)]),
      { x: 480, y: 380, blocked: false },
    );
  });
});

test("the radii and substep cap are the spec's values", () => {
  assert.equal(PLAYER_COLLISION_RADIUS, 14);
  assert.equal(PERSON_COLLISION_RADIUS, 14);
  assert.equal(MAX_SUBSTEP_PX, 14);
});
