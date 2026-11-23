import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveCollisions,
  slideMove,
  PLAYER_COLLISION_RADIUS,
  PERSON_COLLISION_RADIUS,
  MAX_SUBSTEP_PX,
  obstaclesFor,
} from './collision.js';
import { elevatorRiderPose } from './three-d/meshes/elevator.js';
import { UNIT_SCALE } from './three-d/scene.js';
import { buildStations } from './floor-plan.js';
import { GENRES } from './rules.js';

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

const station = (id, stationKind, x, y, ref) => ({ kind: 'station', id, stationKind, x, y, ref });
const shelfRef = { kind: 'bookshelf', x: 580, y: 400, size: 84, w: 124, h: 100 };

describe('obstaclesFor', () => {
  test('a bookshelf is tile-sized top-down and mesh-sized in First Person', () => {
    const items = [station('bookshelf-scifi', 'bookshelf', 580, 400, shelfRef)];
    const [td] = obstaclesFor(items, { camera: 'top-down' });
    assert.deepEqual([td.halfWidth, td.halfHeight], [62, 50]);
    const [fp] = obstaclesFor(items, { camera: 'first-person' });
    // BOOKSHELF_SIZE 1.0 x 0.35 at UNIT_SCALE 40.
    assert.deepEqual([fp.halfWidth, fp.halfHeight], [20, 7]);
  });

  test("the Boss's Office is solid top-down and absent in First Person", () => {
    const items = [station('boss-office', 'boss-office', 80, 115, { kind: 'boss-office', x: 80, y: 115, size: 84 })];
    assert.equal(obstaclesFor(items, { camera: 'top-down' }).length, 1);
    assert.equal(obstaclesFor(items, { camera: 'first-person' }).length, 0);
  });

  test('an elevator is two wall sections with its doorway left open', () => {
    const items = [station('elevator-1', 'elevator', 80, 540, { kind: 'elevator', x: 80, y: 540, size: 84 })];
    const walls = obstaclesFor(items, { camera: 'first-person' });
    assert.equal(walls.length, 2);
    const inside = (x) => walls.some((w) => Math.abs(x - w.x) <= w.halfWidth);
    assert.equal(inside(80), false); // the doorway: |x - 80| < 28
    assert.equal(inside(80 + 35), true); // the wall beside it
    assert.equal(inside(80 - 35), true);
  });

  test('the elevator rider pose is clear of both wall sections', () => {
    const car = { kind: 'elevator', x: 80, y: 540, size: 84 };
    const walls = obstaclesFor([station('elevator-1', 'elevator', 80, 540, car)], { camera: 'first-person' });
    const pose = elevatorRiderPose(car, UNIT_SCALE);
    for (const w of walls) {
      assert.ok(
        Math.abs(pose.x - w.x) > w.halfWidth + PLAYER_COLLISION_RADIUS
          || Math.abs(pose.y - w.y) > w.halfHeight + PLAYER_COLLISION_RADIUS,
        `rider pose ${pose.x},${pose.y} is inside a wall at ${w.x},${w.y}`,
      );
    }
  });

  test('decor is a square from w top-down and its mesh footprint in First Person', () => {
    const items = [{ kind: 'decor', id: 'decor-ladder-150-300', decorKind: 'ladder', x: 150, y: 300, w: 30, h: 62 }];
    const [td] = obstaclesFor(items, { camera: 'top-down' });
    // From w alone: h is a sprite height measured from the ground contact.
    assert.deepEqual([td.halfWidth, td.halfHeight], [15, 15]);
    const [fp] = obstaclesFor(items, { camera: 'first-person' });
    assert.ok(fp.halfWidth > 0 && fp.halfHeight > 0 && fp.halfHeight < fp.halfWidth);
  });

  test('people are circles', () => {
    const items = [{ kind: 'ambient-staff', id: 'staff-guard', staffKey: 'guard', x: 470, y: 562 }];
    assert.deepEqual(obstaclesFor(items, { camera: 'top-down' }), [{ x: 470, y: 562, radius: PERSON_COLLISION_RADIUS }]);
  });

  test('queued patrons and Karen are obstacles', () => {
    const items = [
      { kind: 'front-desk-patron', id: 'p1', x: 520, y: 241 },
      { kind: 'fines-patron', id: 'p2', x: 100, y: 376 },
      { kind: 'karen', id: 'p3', x: 560, y: 241 },
    ];
    assert.equal(obstaclesFor(items, { camera: 'top-down' }).length, 3);
  });

  test('hallucinations are never solid', () => {
    const items = [
      { kind: 'ghost-patron', id: 'g1', x: 480, y: 380 },
      { kind: 'hallucination-figure', id: 'h1', x: 481, y: 381 },
    ];
    assert.deepEqual(obstaclesFor(items, { camera: 'top-down' }), []);
    assert.deepEqual(obstaclesFor(items, { camera: 'first-person' }), []);
  });

  test('return-cart books and other non-physical items are not obstacles', () => {
    const items = [{ kind: 'return-cart-book', id: 'b1', x: 300, y: 115 }];
    assert.deepEqual(obstaclesFor(items, { camera: 'top-down' }), []);
  });

  test('people: false returns furniture and decor only', () => {
    const items = [
      station('bookshelf-scifi', 'bookshelf', 580, 400, shelfRef),
      { kind: 'ambient-staff', id: 'staff-guard', staffKey: 'guard', x: 470, y: 562 },
      { kind: 'front-desk-patron', id: 'p1', x: 520, y: 241 },
    ];
    const obstacles = obstaclesFor(items, { camera: 'top-down', people: false });
    assert.equal(obstacles.length, 1);
    assert.equal(obstacles[0].halfWidth, 62);
  });

  test('exclude drops the subject by inventory id', () => {
    const items = [
      { kind: 'ambient-staff', id: 'staff-guard', staffKey: 'guard', x: 470, y: 562 },
      { kind: 'ambient-staff', id: 'staff-jiho', staffKey: 'jiho', x: 470, y: 548 },
    ];
    const obstacles = obstaclesFor(items, { camera: 'top-down', exclude: 'staff-guard' });
    assert.deepEqual(obstacles, [{ x: 470, y: 548, radius: PERSON_COLLISION_RADIUS }]);
  });

  test('a station kind with no First Person footprint falls back to its tile', () => {
    const ref = { kind: 'future-kiosk', x: 300, y: 300, size: 84 };
    const [fp] = obstaclesFor([station('kiosk', 'future-kiosk', 300, 300, ref)], { camera: 'first-person' });
    assert.deepEqual([fp.halfWidth, fp.halfHeight], [42, 42]);
  });

  test('every station kind the floor plan builds is accounted for', () => {
    const items = buildStations(GENRES).map((s) => station(s.id, s.kind, s.x, s.y, s));
    for (const camera of ['top-down', 'first-person']) {
      for (const item of items) {
        const obstacles = obstaclesFor([item], { camera });
        // Every kind either is solid, or is deliberately not (the Boss's
        // Office in First Person, which is a door in the room's own wall).
        const expected = camera === 'first-person' && item.stationKind === 'boss-office' ? 0
          : item.stationKind === 'elevator' && camera === 'first-person' ? 2 : 1;
        assert.equal(obstacles.length, expected, `${item.stationKind} in ${camera}`);
      }
    }
  });
});
