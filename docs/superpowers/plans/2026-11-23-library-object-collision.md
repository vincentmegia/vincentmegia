# Library Shift Object Collision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Library Shift's objects solid — Eun-mi is blocked by furniture, decor and people in First Person, and no character's footprint is ever drawn inside furniture or another character in Top-Down.

**Architecture:** One new pure module, `web/static/js/library/collision.js`, owns all the geometry: a shortest-way-out resolver, a sliding blocking move, and an obstacle builder that reads `worldInventory` items and returns footprints for the requested camera. First Person applies the blocking move to the real `player.x/y`; Top-Down applies the resolver at draw time only, never touching `player.x/y`, because arrival detection reads it (see the spec's constraints 1 and 3). The two cameras collide against different footprints — tile boxes in Top-Down, mesh-sized boxes in First Person — because the game already draws two different sizes of the same furniture.

**Tech Stack:** Vanilla ES modules, no bundler, no dependencies. `node --test` for the pure modules, Playwright (Chromium + WebKit) for the browser behaviour.

**Spec:** `docs/superpowers/specs/2026-11-23-library-object-collision-design.md`

## Global Constraints

- No new dependencies, no build step, no framework (`docs/skills/javascript/SKILL.md`).
- `web/static/js/library/collision.js` is a **pure logic module**: zero DOM, canvas, timer, `localStorage` or network use; all context in arguments, all results returned.
- `PLAYER_COLLISION_RADIUS = 14` and `PERSON_COLLISION_RADIUS = 14` (px).
- **Top-Down must never write `player.x/y` or an ambient walker's `x/y`.** Resolution there is draw-time only.
- First Person writes `player.x/y` in exactly one place: `updateFirstPersonMovement`.
- Never solid: `ghost-patron` and `hallucination-figure` inventory items, and the Boss's Office in First Person only.
- Queued patrons (`front-desk-patron`, `fines-patron`, `karen`) are obstacles but their own drawn positions are never resolved.
- Pushes are **one-way**: Eun-mi resolves against furniture and decor only; walkers resolve against furniture, decor, Eun-mi's raw position and other walkers' raw positions.
- Feature docs change in the same commit as the behaviour they describe (`CLAUDE.md`).
- The user's dev server owns `:8080` — never kill or restart it. Run your own server on another port and give Playwright its own `--output` dir.

## Review Focus

1. **A stutter frame tunnels through a thin footprint.** `loop` clamps `deltaSeconds` at 0.1 s (`library-game.js:5378`), so one sprinting frame can move 200 × 1.6 × 0.1 = **32 px** — more than a bookshelf's whole 14 px-deep mesh footprint plus two radii. A tab regaining focus must not put Eun-mi through a shelf. *Pinned in Task 1 (substepping).*
2. **Hallucinations must never be solid.** At low Sanity, ghosts and shadow figures spawn near Eun-mi; one that blocks her, or shoves her sprite, is a bug. *Pinned in Task 3.*
3. **Two characters at the same point.** Security's loop ends at `[470, 562]` and Ji-ho's starts at `[470, 548]`, both pausing there every lap, so exact coincidence is reachable. The escape must be stable, not a per-frame flip. *Pinned in Task 1 and Task 6.*
4. **A no-input frame must not move her at all.** `e2e/library-game.spec.js:1707` asserts the arrow keys leave the position at exactly (480, 380). A resolver that returns a recomputed float for a clear position breaks it. *Pinned in Task 1.*
5. **Resolving out of furniture must not push her off the floor.** Entering First Person beside the fines room's wall or a corner plant resolves her up to 14 px — which must still land inside the canvas. Resolve first, then clamp. *Pinned in Task 4.*

---

### Task 1: Collision core

**Files:**
- Create: `web/static/js/library/collision.js`
- Test: `web/static/js/library/collision.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `resolveCollisions(x, y, radius, obstacles) -> {x, y}`; `slideMove(x, y, dx, dy, radius, obstacles) -> {x, y, blocked}`; `PLAYER_COLLISION_RADIUS = 14`; `PERSON_COLLISION_RADIUS = 14`; `MAX_SUBSTEP_PX = 14`. An obstacle is `{x, y, halfWidth, halfHeight}` (rectangle) or `{x, y, radius}` (circle).

- [ ] **Step 1: Write the failing tests**

```js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveCollisions, slideMove,
  PLAYER_COLLISION_RADIUS, PERSON_COLLISION_RADIUS, MAX_SUBSTEP_PX,
} from './collision.js';

const box = (x, y, hw, hh) => ({ x, y, halfWidth: hw, halfHeight: hh });

describe('resolveCollisions', () => {
  test('leaves a clear position bit-identical', () => {   // Review Focus 4
    const at = resolveCollisions(480, 380, 14, [box(580, 400, 20, 7)]);
    assert.equal(at.x, 480);
    assert.equal(at.y, 380);
  });

  test('pushes a circle out to the nearest face of a box', () => {
    // 10 px into the top face of a 40x14 box: pushed back to 7 + 14 above centre.
    const at = resolveCollisions(580, 397, 14, [box(580, 400, 20, 7)]);
    assert.equal(at.x, 580);
    assert.ok(Math.abs(at.y - (400 - 21)) < 1e-6);
  });

  test('a centre exactly inside a box escapes along the shallower axis', () => {
    const at = resolveCollisions(582, 400, 14, [box(580, 400, 20, 7)]);
    assert.equal(at.y, 400 + 7 + 14);    // depth 7 is shallower than width 20
    assert.equal(at.x, 582);
  });

  test('separates two circles to exactly the sum of their radii', () => {
    const at = resolveCollisions(470, 562, 14, [{ x: 470, y: 548, radius: 14 }]);
    assert.ok(Math.abs(Math.hypot(at.x - 470, at.y - 548) - 28) < 1e-6);
  });

  test('coincident centres escape the same way every call', () => {   // Review Focus 3
    const once = resolveCollisions(470, 548, 14, [{ x: 470, y: 548, radius: 14 }]);
    const twice = resolveCollisions(470, 548, 14, [{ x: 470, y: 548, radius: 14 }]);
    assert.deepEqual(once, twice);
    assert.ok(Math.hypot(once.x - 470, once.y - 548) >= 28 - 1e-9);
  });

  test('resolves against every obstacle in the list', () => {
    const at = resolveCollisions(100, 100, 14, [box(100, 112, 30, 8), box(112, 100, 8, 30)]);
    assert.ok(at.y < 100 && at.x < 100);
  });
});

describe('slideMove', () => {
  test('passes a clear step through untouched and unblocked', () => {
    const at = slideMove(300, 300, 5, -5, 14, [box(580, 400, 20, 7)]);
    assert.deepEqual(at, { x: 305, y: 295, blocked: false });
  });

  test('slides along a blocked face instead of sticking', () => {
    // Walking +x and -y into the box's bottom face: x advances, y does not.
    const at = slideMove(560, 428, 6, -6, 14, [box(580, 400, 20, 7)]);
    assert.equal(at.x, 566);
    assert.equal(at.y, 428);
    assert.equal(at.blocked, true);
  });

  test('a head-on step is fully blocked on that axis', () => {
    const at = slideMove(580, 428, 0, -6, 14, [box(580, 400, 20, 7)]);
    assert.equal(at.y, 428);
    assert.equal(at.blocked, true);
  });

  test('a 32 px sprint step cannot tunnel through a 14 px-deep footprint', () => {   // Review Focus 1
    const at = slideMove(580, 428, 0, -32, 14, [box(580, 400, 20, 7)]);
    assert.ok(at.y >= 400 + 7 + 14 - 1e-6, `tunnelled to y=${at.y}`);
    assert.equal(at.blocked, true);
  });

  test('substeps never overshoot the requested step', () => {
    const at = slideMove(300, 300, 0, -32, 14, []);
    assert.ok(Math.abs(at.y - 268) < 1e-6);
    assert.equal(at.blocked, false);
  });

  test('a zero step returns the same position, unblocked', () => {   // Review Focus 4
    assert.deepEqual(slideMove(480, 380, 0, 0, 14, [box(480, 380, 20, 7)]), { x: 480, y: 380, blocked: false });
  });
});

test('the radii and substep cap are the spec\'s values', () => {
  assert.equal(PLAYER_COLLISION_RADIUS, 14);
  assert.equal(PERSON_COLLISION_RADIUS, 14);
  assert.equal(MAX_SUBSTEP_PX, 14);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test web/static/js/library/collision.test.js`
Expected: FAIL — cannot find module `./collision.js`.

- [ ] **Step 3: Implement `resolveCollisions(x, y, radius, obstacles)` in `web/static/js/library/collision.js`**

Circle-vs-AABB through the closest point on the box; circle-vs-circle directly; a centre inside a box escapes along the axis with the shallower penetration; obstacles resolve one at a time in list order. A clear position must be returned unchanged, not recomputed. Head the module with a comment noting it restates Kitchen Shift's `resolveObstacleCollisions` (`web/static/js/cooking/floor-plan.js:493`) rather than sharing it — the obstacle sets differ per game and moving that function would put Kitchen Shift's shipped behaviour at risk.

- [ ] **Step 4: Implement `slideMove(x, y, dx, dy, radius, obstacles)` in the same file**

Split the requested step into equal substeps of at most `MAX_SUBSTEP_PX` (Review Focus 1: a 0.1 s sprint frame is 32 px, and the thinnest footprint plus two radii is 28 px, so a 14 px cap cannot cross any obstacle). For each substep: try both axes; if the result overlaps an obstacle, try x-only, then y-only, and keep the first that is clear; if neither is, stay put for that substep. Set `blocked` if any substep was reduced. Overlap tests reuse the same closest-point maths as `resolveCollisions` — factor out one `overlaps(x, y, radius, obstacle)` helper rather than duplicating it.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test web/static/js/library/collision.test.js`
Expected: PASS, all tests.

- [ ] **Step 6: Commit**

```bash
git add web/static/js/library/collision.js web/static/js/library/collision.test.js
git commit -m "library: pure collision core — shortest-way-out resolve and sliding blocked move"
```

---

### Task 2: Footprint constants for the two meshes that lack them

**Files:**
- Modify: `web/static/js/library/three-d/meshes/return-cart.js` (near the other exports, ~line 26)
- Modify: `web/static/js/library/three-d/meshes/decor.js` (near `DECOR_BUILDERS`, ~line 160)
- Test: `web/static/js/library/three-d/meshes/return-cart.test.js`, `web/static/js/library/three-d/meshes/decor.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `RETURN_CART_SIZE = { width, depth }` (mesh units) from `return-cart.js`; `DECOR_FOOTPRINTS` from `decor.js`, keyed by the same kind strings `DECOR_BUILDERS` uses (`'water-cooler'`, `'plant'`, `'ladder'`, `'waiting-chairs'`), each `{ width, depth }` in mesh units.

Every other First Person footprint already has an exported constant — `BOOKSHELF_SIZE`, `FRONT_DESK_SIZE`, `FINES_COUNTER_SIZE`, `COFFEE_MACHINE_STAND`, `STAIRS_SIZE`, `READING_NOOK_SIZE`, `ELEVATOR_SIZE`, `BOSS_OFFICE_SIZE`. These two kinds do not.

- [ ] **Step 1: Write the failing tests**

Add to each mesh's existing test file. Assert each constant is derived from the module's own private geometry rather than retyped, by checking it against the mesh the builder produces: for each kind, the constant's half-width must be within 0.01 units of the largest `|vertex.x|` among vertices with `y > 0.1`, and its half-depth likewise for `|vertex.z|`. (The `y > 0.1` floor is what keeps the Reading Nook's floor rug and other floor-level decoration out of a footprint.)

```js
test('RETURN_CART_SIZE matches the mesh it is built from', () => {
  const mesh = buildReturnCart();
  const standing = mesh.vertices.filter((v) => v[1] > 0.1);
  const hw = Math.max(...standing.map((v) => Math.abs(v[0])));
  const hd = Math.max(...standing.map((v) => Math.abs(v[2])));
  assert.ok(Math.abs(RETURN_CART_SIZE.width / 2 - hw) < 0.01);
  assert.ok(Math.abs(RETURN_CART_SIZE.depth / 2 - hd) < 0.01);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test web/static/js/library/three-d/meshes/return-cart.test.js web/static/js/library/three-d/meshes/decor.test.js`
Expected: FAIL — `RETURN_CART_SIZE` / `DECOR_FOOTPRINTS` is not exported.

- [ ] **Step 3: Add the two exports**

In `return-cart.js`, derive `RETURN_CART_SIZE` from the existing private `TRAY` (`{x: 0.8, z: 0.5}`) — `{ width: 2 * TRAY.x, depth: 2 * TRAY.z }` — so a tray resize carries it along. In `decor.js`, derive each `DECOR_FOOTPRINTS` entry from that builder's own constants (`COOLER_HALF` for the cooler; the pot's widest ring for the plant; the rails' full splay plus thickness for the ladder; `pitch` and `hw` across the three seats for the waiting chairs), each with a one-line comment naming what it measures. Do not hard-code numbers the module already holds. If a test shows a footprint that disagrees with the mesh, trust the mesh.

- [ ] **Step 4: Run them to verify they pass**

Run: `node --test web/static/js/library/three-d/meshes/return-cart.test.js web/static/js/library/three-d/meshes/decor.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/static/js/library/three-d/meshes/return-cart.js web/static/js/library/three-d/meshes/decor.js web/static/js/library/three-d/meshes/return-cart.test.js web/static/js/library/three-d/meshes/decor.test.js
git commit -m "library-fp: export the Return Cart's and decor's mesh footprints"
```

---

### Task 3: The obstacle builder, with a footprint set per camera

**Files:**
- Modify: `web/static/js/library/collision.js`
- Test: `web/static/js/library/collision.test.js`

**Interfaces:**
- Consumes: Task 1's module; Task 2's `RETURN_CART_SIZE` and `DECOR_FOOTPRINTS`; `UNIT_SCALE` from `three-d/scene.js`; `stationExtents` from `floor-plan.js`; the mesh size constants named in Task 2.
- Produces: `obstaclesFor(items, { camera, exclude, people = true })` → an array of `{x, y, halfWidth, halfHeight}` and `{x, y, radius}`. `items` is `worldInventory(floor, …)` output (`library/world-inventory.js`), already floor-filtered. `camera` is `'top-down'` or `'first-person'`. `exclude` is an optional inventory `id` to drop. `people: false` returns furniture and decor only — the returned obstacles carry no kind tag, so a caller that wants only furniture must say so here rather than filter afterwards (Task 5 does).

- [ ] **Step 1: Write the failing tests**

```js
const station = (id, stationKind, x, y, ref) => ({ kind: 'station', id, stationKind, x, y, ref });
const shelfRef = { kind: 'bookshelf', x: 580, y: 400, size: 84, w: 124, h: 100 };

describe('obstaclesFor', () => {
  test('a bookshelf is tile-sized top-down and mesh-sized in First Person', () => {
    const items = [station('bookshelf-scifi', 'bookshelf', 580, 400, shelfRef)];
    const [td] = obstaclesFor(items, { camera: 'top-down' });
    assert.deepEqual([td.halfWidth, td.halfHeight], [62, 50]);
    const [fp] = obstaclesFor(items, { camera: 'first-person' });
    assert.deepEqual([fp.halfWidth, fp.halfHeight], [20, 7]);   // BOOKSHELF_SIZE 1.0 x 0.35 at UNIT_SCALE 40
  });

  test('the Boss\'s Office is solid top-down and absent in First Person', () => {
    const items = [station('boss-office', 'boss-office', 80, 115, { kind: 'boss-office', x: 80, y: 115, size: 84 })];
    assert.equal(obstaclesFor(items, { camera: 'top-down' }).length, 1);
    assert.equal(obstaclesFor(items, { camera: 'first-person' }).length, 0);
  });

  test('an elevator is two wall sections with its doorway left open', () => {
    const items = [station('elevator-1', 'elevator', 80, 540, { kind: 'elevator', x: 80, y: 540, size: 84 })];
    const walls = obstaclesFor(items, { camera: 'first-person' });
    assert.equal(walls.length, 2);
    const inside = (x) => walls.some((w) => Math.abs(x - w.x) <= w.halfWidth);
    assert.equal(inside(80), false);        // the doorway: |x - 80| < 28
    assert.equal(inside(80 + 35), true);    // the wall beside it
    assert.equal(inside(80 - 35), true);
  });

  test('the elevator rider pose is clear of both wall sections', () => {
    const car = { kind: 'elevator', x: 80, y: 540, size: 84 };
    const walls = obstaclesFor([station('elevator-1', 'elevator', 80, 540, car)], { camera: 'first-person' });
    const pose = elevatorRiderPose(car, UNIT_SCALE);
    for (const w of walls) {
      assert.ok(Math.abs(pose.x - w.x) > w.halfWidth + PLAYER_COLLISION_RADIUS
        || Math.abs(pose.y - w.y) > w.halfHeight + PLAYER_COLLISION_RADIUS);
    }
  });

  test('decor is a square from w top-down and its mesh footprint in First Person', () => {
    const items = [{ kind: 'decor', id: 'decor-ladder-150-300', decorKind: 'ladder', x: 150, y: 300, w: 30, h: 62 }];
    const [td] = obstaclesFor(items, { camera: 'top-down' });
    assert.deepEqual([td.halfWidth, td.halfHeight], [15, 15]);   // from w alone — h is a sprite height
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

  test('hallucinations are never solid', () => {   // Review Focus 2
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
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test web/static/js/library/collision.test.js`
Expected: FAIL — `obstaclesFor` is not exported.

- [ ] **Step 3: Implement the `FOOTPRINTS` table and `obstaclesFor(items, {camera, exclude})`**

A module-level table maps each station `kind` and decor `decorKind` to its First Person half-extents, each entry computed from that mesh's exported size constant × `UNIT_SCALE` (`three-d/scene.js:27`), so a mesh resize moves its footprint with it. Top-Down half-extents come from `stationExtents(item.ref)` for stations and from `w / 2` on both axes for decor — never `h`, which is a sprite height measured from the ground contact at `d.y + d.h / 2` (`hospital/anime-furniture.js:1201`); say that in a comment.

Two station kinds are special, each with its reason in a comment: the Boss's Office has no First Person footprint (its mesh is a door *in* the north wall running backwards, `Z_BACK = Z_WALL - 2.5`, so nothing stands on the floor and the room shell already stops her), and the elevator becomes two wall-section rectangles flanking its doorway, derived from `ELEVATOR_SIZE.width` and the doorway bounds `isInElevatorCar` uses (`three-d/meshes/elevator.js:104`), so Eun-mi can still ride the car.

Also note in a comment the alternative considered and rejected: measuring footprints from built meshes' vertex bounds. It is DRYer but couples this pure module to the whole mesh-building stack, and it needs the same two exceptions anyway plus a floor-height threshold to keep the Reading Nook's rug out.

- [ ] **Step 4: Run them to verify they pass**

Run: `node --test web/static/js/library/collision.test.js`
Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add web/static/js/library/collision.js web/static/js/library/collision.test.js
git commit -m "library: obstacle builder with a footprint set per camera"
```

---

### Task 4: First Person blocks the real position

**Files:**
- Modify: `web/static/js/library-game.js` — imports (~line 193), `setCameraMode` (~line 2700), `updateFirstPersonMovement` (`:1267`)
- Modify: `e2e/library-game.spec.js`
- Modify: `docs/features/library-first-person-3d.md`, `docs/features/library-game.md`, `CLAUDE.md`

**Interfaces:**
- Consumes: `slideMove`, `resolveCollisions`, `obstaclesFor`, `PLAYER_COLLISION_RADIUS` from `library/collision.js`; the existing `getWorldInventory(floor)` helper in `library-game.js`.
- Produces: no new exports. A new private helper `collisionObstacles(camera, opts)` → `obstaclesFor(getWorldInventory(currentFloor), { camera, ...opts })`, which caches the inventory build for the current frame so the player and every walker share one, and which Tasks 5 and 6 also call.

- [ ] **Step 1: Write the failing Playwright tests**

In `e2e/library-game.spec.js`, beside the other First Person specs, using `freeze`/`step` (never wall-clock holds):

```js
test('in First Person, walking into a bookshelf is blocked at its face', async ({ page }) => {
  // Facing south (PI) from above bookshelf [580, 400], hold W for 60 stepped frames.
  // Expected: y stops at 400 - (7 + 14) and never enters the mesh footprint.
});

test('in First Person, a bookshelf corner slides instead of sticking', async ({ page }) => {
  // Aimed at the corner, the held walk still changes x by more than 10 px.
});

test('in First Person, the elevator doorway admits her but its side walls do not', async ({ page }) => {
  // At the doorway x, walking in succeeds; offset 35 px along the wall, it is blocked.
});

test('entering First Person inside a decor item pushes her out and keeps her on the floor', async ({ page }) => {
  // setPlayerPosition onto the 2F ladder (150, 300), then setCameraMode('first-person'):
  // the position moves out of its footprint and stays within the canvas margin. (Review Focus 5)
});
```

Give each the exact coordinates from `getStations`/`getWorldInventory` the way the neighbouring specs do, and assert on `getPlayerPosition`.

- [ ] **Step 2: Run them to verify they fail**

Run your own server on a free port (not `:8080`), then:
`E2E_BASE_URL=http://localhost:<port> npx playwright test e2e/library-game.spec.js -g "First Person, walking into a bookshelf" --output /tmp/claude/library-collision/test-results`
Expected: FAIL — she walks through the shelf.

- [ ] **Step 3: Block the move in `updateFirstPersonMovement`**

Replace the `clampToCanvas(player.x + dx, player.y + dy)` call at `library-game.js:1267` with `slideMove(player.x, player.y, dx, dy, PLAYER_COLLISION_RADIUS, collisionObstacles('first-person'))`, then `clampToCanvas` that result — resolve first, clamp second (Review Focus 5). Leave the `fpTransition` early return above it untouched, so stair climbs and elevator rides still move her freely.

- [ ] **Step 4: Resolve once on entering First Person**

In `setCameraMode`, when switching *to* `'first-person'`, run `resolveCollisions` on `player.x/y` against the same obstacles and `clampToCanvas` the result. This is required, not defensive: Top-Down can park her inside furniture, because `stationAtPoint` doesn't include decor (so clicking a plant walks her onto it) and `moveTarget.staffKey` parks her "46 px beside" a walker (`:1096`), which can be inside a shelf box. The ≤14 px move is safe — the only slack-based read of her position is `isPlayerAtBossOffice` (`:1076`), with 30 px of slack.

- [ ] **Step 5: Run the new specs, then the whole First Person suite**

Run: the four new specs, then
`E2E_BASE_URL=http://localhost:<port> npx playwright test e2e/library-game.spec.js -g "First Person" --output /tmp/claude/library-collision/test-results`
Expected: PASS on Chromium and WebKit, including the diagonal-walk specs (`:1850`) and the arrow-key spec (`:1707`) **unchanged**. Those start at (480, 380), whose nearest obstacle is bookshelf `[580, 400]` — blocked at x ≥ 546 from centre, well clear of the ~45 px they walk. If either tightens or fails, the footprint table is wrong, not the spec: do not edit the spec to fit.

- [ ] **Step 6: Update the docs**

`docs/features/library-first-person-3d.md`: First Person movement is now blocked by mesh-sized footprints read from the meshes' own size constants, with sliding along faces, the Boss's Office covered by the room shell, and the elevator doorway the one gap in a wall. `docs/features/library-game.md`: collision in Scope and a History entry, stating the asymmetry (blocked in First Person; draw-time only in Top-Down, because arrival reads `player.x/y` and the approach circle clears furniture by as little as 1.1 px) and that the guarantee is about footprints, not drawn pixels — characters draw ~52 px wide and ~86 px tall above their feet, so they still overlap visually. `CLAUDE.md`'s library gotcha: `library/collision.js` is the one source of the collision geometry and holds a footprint set per camera.

Two things to look at while the specs run, and report rather than fix: whether the Fines Counter's mesh footprint (96 × 44, against a 130 × 130 tile) reads as solid in First Person or whether its room wants a wall; and whether two characters at touching distance (28 px = 0.7 units, inside `NEAR` = 1 unit) look acceptable, since `clipNear` (`three-d/core.js:131`) cuts their front faces and textured cells fall back to flat colour. The second is pre-existing in kind — you can already stand on top of someone — and collision makes it rarer, not worse.

- [ ] **Step 7: Commit**

```bash
git add web/static/js/library-game.js e2e/library-game.spec.js docs/features/library-first-person-3d.md docs/features/library-game.md CLAUDE.md
git commit -m "library-fp: furniture, decor and people block and slide in First Person"
```

---

### Task 5: Top-Down resolves Eun-mi at draw time

**Files:**
- Modify: `web/static/js/library-game.js` — `drawCoffeeSplash` (`:2123`), `drawPlayer` (`:3479`), a new `currentPlayerDrawPose()` beside it
- Test: `e2e/library-game.spec.js`

**Interfaces:**
- Consumes: Task 4's `collisionObstacles('top-down')`; `resolveCollisions`, `PLAYER_COLLISION_RADIUS`.
- Produces: `currentPlayerDrawPose()` → `{x, y}`, rounded, for Task 6's layering and hit-testing to share.

- [ ] **Step 1: Write the failing test**

```js
test('top-down, Eun-mi is never drawn with her footprint inside a bookshelf', async ({ page }) => {
  // setPlayerPosition to the centre of bookshelf [580, 400], step one frame,
  // then assert getPlayerDrawPose() is outside its 124 x 100 tile by at least
  // PLAYER_COLLISION_RADIUS, while getPlayerPosition() is still exactly (580, 400).
});

test('top-down, arriving at the Fines Counter does not slide her off the counter', async ({ page }) => {
  // Click the Fines Counter from a diagonal, run to arrival, then assert the draw
  // pose equals the raw position: the station she has arrived at is not an obstacle.
});
```

Add a `getPlayerDrawPose: () => currentPlayerDrawPose()` hook to `window.__libraryGameTestHooks` for these, beside `getPlayerPosition`.

- [ ] **Step 2: Run them to verify they fail**

Run: `E2E_BASE_URL=http://localhost:<port> npx playwright test e2e/library-game.spec.js -g "top-down, Eun-mi is never drawn" --output /tmp/claude/library-collision/test-results`
Expected: FAIL — no `getPlayerDrawPose` hook.

- [ ] **Step 3: Implement `currentPlayerDrawPose()`**

Resolve `player.x/y` against `obstaclesFor(getWorldInventory(currentFloor), { camera: 'top-down', people: false })` — never people, because pushes are one-way — and `Math.round` the result so sprite edges stay crisp. **Exempt the station she has arrived at**: drop `moveTarget.station`, or the station she is within standoff of while not moving, from the obstacle list. Without that she visibly slides on arrival — 3.4 px at a square station and 12.9 px at the Fines Counter, whose approach circle clears its room by only 1.1 px. Never write `player.x/y` here.

- [ ] **Step 4: Draw everything about her from that pose**

`drawPlayer` takes the pose once and uses it for the body, the label chip and the carry badge. `drawCoffeeSplash` currently takes no arguments and reads `player.x/y` directly — give it a pose parameter and pass the same value, or the splash detaches from the sprite.

- [ ] **Step 5: Run the new specs, then the full Top-Down suite**

Run: the two new specs, then `E2E_BASE_URL=http://localhost:<port> npx playwright test e2e/library-game.spec.js --output /tmp/claude/library-collision/test-results`
Expected: PASS on both browsers, with **no edits** to any existing spec. A Top-Down spec that needs editing means the draw-time-only boundary leaked and `player.x/y` moved.

- [ ] **Step 6: Update `docs/features/library-game.md`**

Describe `currentPlayerDrawPose` as the single pose her sprite, chip, badge and coffee splash are drawn from, and the arrival exemption with its reason.

- [ ] **Step 7: Commit**

```bash
git add web/static/js/library-game.js e2e/library-game.spec.js docs/features/library-game.md
git commit -m "library: Eun-mi's top-down sprite never overlaps furniture"
```

---

### Task 6: The walkers get the same treatment

**Files:**
- Modify: `web/static/js/library-game.js` — `staffAtPoint` (`:704`), `drawAmbient` (`:764`), the `getStaff` hook (`:5634`)
- Test: `e2e/library-game.spec.js`

**Interfaces:**
- Consumes: Task 5's `currentPlayerDrawPose()`; `resolveCollisions`, `obstaclesFor`, `PERSON_COLLISION_RADIUS`.
- Produces: `staffDrawPose(a)` → `{x, y}`, rounded — the one pose `drawAmbient`, `staffAtPoint` and the `getStaff` hook all read.

- [ ] **Step 1: Write the failing test**

```js
test('top-down, Security and Ji-ho are never drawn on top of each other', async ({ page }) => {
  // Both pause ~14 px apart at [470, 562] / [470, 548] every lap. Freeze staff there,
  // step a frame, and assert their draw poses are at least 2 * PERSON_COLLISION_RADIUS
  // apart while their raw positions are unchanged. (Review Focus 3)
});

test('top-down, clicking a resolved walker still asks them for help', async ({ page }) => {
  // Click the coordinates getStaff reports for the Shelver and assert the help toast,
  // proving hit-testing and the hook moved together with the drawing.
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `E2E_BASE_URL=http://localhost:<port> npx playwright test e2e/library-game.spec.js -g "never drawn on top of each other" --output /tmp/claude/library-collision/test-results`
Expected: FAIL — the two are drawn overlapping.

- [ ] **Step 3: Implement `staffDrawPose(a)`**

Resolve the walker's position against stations, decor, Eun-mi's **raw** position and the other walkers' **raw** positions — `obstaclesFor(..., { exclude: \`staff-${a.key}\` })` — rounded. Reading raw positions keeps the push one-way: a mutual push would separate a 14 px overlap into as much as 56 px of visible gap with jitter while both move, and the Security/Ji-ho pair would do it every lap. Never write `a.x/a.y`.

- [ ] **Step 4: Point the drawing, the layering and the hit-testing at it**

In `drawAmbient`, use the pose for the `translate`, the name chip and the hint chip, **and for the front/back split** — `(a.y > player.y) !== inFront` must compare resolved y against Eun-mi's resolved y, or a nudged walker draws on the wrong side of her. Leave Min-jun's 260 px proximity check (`:637`) on raw positions: that is gameplay, not drawing. Route `staffAtPoint` (`:712`) and the `getStaff` hook (`:5634`) through the same pose — both, in this change, since `e2e/library-game.spec.js:213` clicks the coordinates the hook reports, so moving one without the other silently breaks either the staff-click specs or the click box.

- [ ] **Step 5: Run the new specs, then the whole suite on both browsers**

Run: `E2E_BASE_URL=http://localhost:<port> npx playwright test e2e/library-game.spec.js --output /tmp/claude/library-collision/test-results`
Expected: PASS, including the existing staff-help and staff-click specs unchanged. (These click moving NPCs and are known to flake under load — re-run a single failure before treating it as a regression.)

- [ ] **Step 6: Verify the whole project**

Run: `npm run test:unit` → PASS. Run: `make check` → PASS (no Go changed; this proves nothing else broke).

- [ ] **Step 7: Update `docs/features/library-game.md` and commit**

Document the walkers' draw poses, the one-way push and its reason, and that layering and hit-testing follow the resolved pose.

```bash
git add web/static/js/library-game.js e2e/library-game.spec.js docs/features/library-game.md
git commit -m "library: patrol staff never overlap each other, the furniture or Eun-mi"
```
