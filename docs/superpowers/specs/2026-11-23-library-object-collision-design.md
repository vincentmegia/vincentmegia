# Design: Object collision in Library Shift

Date: 2026-11-23
Feature: Library Shift (`/library-game`) — `docs/features/library-game.md`,
`docs/features/library-first-person-3d.md`

## Intent and why

Nothing in Library Shift is solid. The only constraint on Eun-mi's position
is `clampToCanvas` (`web/static/js/library/floor-plan.js:249`), the canvas
edge, so she walks straight through bookcases, the Front Desk, the Fines
Counter room, the decor and every character — in both cameras. The user
asked for object collision, and when asked what should happen, said: "The
objects should not collide."

So the goal is physical plausibility: **no two objects in the library ever
occupy the same space**. In First Person this is the stronger ask — walking
through a bookshelf breaks the illusion the software-3D renderer exists to
create. In Top-Down it is a visual ask: Eun-mi and the patrol staff should
never be drawn with their footprints inside furniture or each other.

## Goals

* First Person: walking into a bookshelf, desk, decor item or person stops
  Eun-mi at its surface — **the surface she can see** (see constraint 2) —
  and she **slides along** it rather than sticking, so movement never feels
  like it jammed.
* Top-Down: Eun-mi's footprint and every patrol walker's footprint are never
  drawn inside a station, a decor item, or each other.
* One pure, `node --test`-covered module owns all the collision geometry for
  both cameras.
* Zero change to the shift loop: arrival, skill checks, queue patience, the
  600/480/360-second clocks, Gard payouts and the 30-shift balance behave
  exactly as they do today.

## Non-goals

* Pathfinding. Click-to-move stays a straight line toward its target.
* Making Top-Down movement *blocked*. See Approaches — blocking the
  simulated position is what approach B was, and it was not chosen.
* Sprite-level separation. The guarantee is about ground footprints
  (~28 px apart for two characters), not drawn pixels: library characters
  are drawn ~52 px wide and ~86 px tall above their feet
  (`LIBRARY_PERSON_SCALE = 1.55`), so two characters standing as close as
  collision allows still *draw* overlapped, and a character standing
  outside a bookcase's footprint still has her head drawn over its tile.
  That is the same deal Kitchen Shift shipped, and the feature doc must say
  so in those words.
* New obstacles, new layout, or moving any station. The floor plan is
  unchanged.
* Collision in any other game. Kitchen Shift already has its own; Hospital
  Shift is out of scope.

## Anti-goals

Things that would make this a failure even if "collision works":

* Wedging: a click-to-move walk that stops dead against a shelf corner and
  never arrives, with no way out but another click.
* The First Person camera popping *through* a shelf to its far side.
* **Invisible walls.** Being stopped by a footprint noticeably bigger than
  the art that footprint belongs to. In First Person that means never being
  able to get close enough to a shelf to read its spines.
* Changing how long a shift's work takes, and so the difficulty curve.
* Breaking arrival at a station. Shelving is the core loop.

## Constraints (verified in the code)

1. **Arrival reads the simulated position, and the approach point sits only
   just outside the furniture.** `updatePlayer` (`library-game.js:1091`)
   fires `handleArrival` when `dist <= step`. `commitStationTarget`
   (`library-game.js:1081`) walks her to
   `approachPoint(..., Math.max(hw, hh) + PLAYER_STOP_MARGIN)` — a *circle*
   of radius 90 px for a bookcase, 93 for the Fines Counter room, 70 for a
   square station. That circle is outside the station's box at every angle,
   so stations stay reachable; but the clearance between the circle and the
   box's surface is small, and smallest on a diagonal approach:

   | station | standoff | min clearance from the box |
   |---|---|---|
   | bookcase 124×100 | 90 | 10.4 px |
   | front desk 124×84 | 90 | 15.1 px |
   | fines room 130×130 | 93 | **1.1 px** |
   | square 84×84 | 70 | 10.6 px |

   Every one of those is under the 14 px footprint below. So a resolver that
   pushed the **simulated** position out of station boxes would shove her
   3–13 px off the exact point arrival is tested against — Kitchen Shift's
   recorded deadlock (constraint 3), and a visible slide on arrival even
   when it doesn't deadlock (see §3's arrival exemption).
2. **The two cameras disagree about how big the furniture is, by up to
   1.4 m.** Top-Down tiles are stylised and oversized —
   `STATION_BOX_SIZE = 84` is deliberately "bigger than Kitchen Shift's
   70px … to read clearly behind this game's bigger characters". The FP
   meshes are real-world-scaled, placed at `pos: [s.x, 0, s.y]`,
   `scale: UNIT_SCALE` where `UNIT_SCALE = 40` (`three-d/scene.js:27,198`):

   | | Top-Down box | FP mesh footprint |
   |---|---|---|
   | bookshelf | 124 × 100 | `BOOKSHELF_SIZE {width: 1.0, depth: 0.35}` → **40 × 14** |
   | front desk | 124 × 84 | `FRONT_DESK_SIZE {width: 2.8, depth: 1.0}` → 112 × 40 |
   | fines counter | 130 × 130 | `FINES_COUNTER_SIZE {width: 2.4, depth: 1.1}` → 96 × 44 |
   | coffee machine | 84 × 84 | `COFFEE_MACHINE_STAND {width: 0.6, depth: 0.5}` → 24 × 20 |
   | water cooler | 28 × 52 | body 0.34 × 0.34 → 13.6 × 13.6 |

   Colliding FP against the Top-Down box would stop Eun-mi 64 px from a
   bookshelf's centre whose visible front face is 7 px out: a 57 px
   invisible wall, and she could never get near enough to read a shelf.
   **The user chose: each camera collides with the art it draws** — FP
   against mesh footprints, Top-Down against tile boxes.
3. **The deadlock precedent.** Kitchen Shift's `updatePlayer` JSDoc
   (`web/static/js/cooking-game.js:3184`) records that "a naive 'collision
   nudges the real position' version of this deadlocked in testing: two
   customers converging on nearly the same Counter standoff point pushed
   each other back exactly as far as they'd just advanced, forever, since
   arrival detection also read the nudged position." Its draw-time
   resolution lives in `currentPlayerDrawPose` (`cooking-game.js:4807`), and
   it resolves the player against **stations only**
   (`stationObstaclesForRoom`, `:3175`); characters resolve against the
   player **one-way**, in `drawPayingCustomers` (`:3473`).
4. **The elevator is meant to be stood in, but only its doorway.**
   `elevatorRiderPose` (`library/three-d/meshes/elevator.js:99`) poses
   Eun-mi inside the car — (80, 574) on floor 1 — and `isInElevatorCar`
   (same file, `:104`) holds the doors open while she is there. But that
   doorway is only `|x − 80| < 28` of an 84-wide tile, so the wall sections
   either side of it are visible wall she must not walk through.
5. **First Person has one movement site and no distance-based timing.**
   `updateFirstPersonMovement` (`library-game.js:1240`) is the only place FP
   writes `player.x/y`; it early-returns while a stair/elevator transition
   plays; the FP camera is `player.x + offX` with `offX ≠ 0` only during a
   transition (`:5251`), so blocking the real position there really does
   control the camera. FP interaction is crosshair-based
   (`findInteractTarget`), not proximity-based.
6. **Interact range leaves plenty of room.**
   `DEFAULT_INTERACT_MAX_DISTANCE` is 150 px centre-to-centre
   (`library/first-person.js:102`). The worst blocked standoff is the Fines
   Counter at ~79 px, so every station stays interactable from the surface
   she is stopped at.
7. **Playwright drives exact coordinates.** `e2e/library-game.spec.js` uses
   `setPlayerPosition` and real clicks at `getStaff`/`getStations`
   coordinates, and several specs are timing-sensitive. Top-Down positions
   and timings must not move. Two specs need attention anyway — see §4.
8. **Decor `h` is a sprite height, not a floor depth.** The decor drawers
   are elevation sprites whose ground contact is at `d.y + d.h / 2`
   (`hospital/anime-furniture.js:1201`), so `h/2` as a half-depth would give
   the ladder a 62 px-deep floor box centred half a sprite north of where it
   stands. FP already places decor at `pos: [d.x, 0, d.y]`
   (`three-d/scene.js:206`).
9. **The cast is small.** Per floor: 10 stations on floor 1, 5 on floor 2,
   3–4 decor items, 7–8 patrol walkers, plus queued patrons. An O(n) sweep
   per moving entity per frame is cheap at 60 fps; no spatial index.
10. **One walker pair already overlaps.** Security's loop ends at
    `[470, 562]` and Ji-ho's begins at `[470, 548]`, 14 px apart, and both
    pause there every lap (`library-game.js:434,456`). Walker-vs-walker
    resolution will fire there constantly, which is what makes §3's one-way
    rule matter rather than being theoretical.

## Approaches

**A. Solid in First Person, non-overlapping in Top-Down — chosen.**
One pure collision module. First Person applies it to the *real* position
every frame with axis-separated sliding, against mesh-sized footprints.
Top-Down applies it at *draw time* only, against tile boxes, via a shared
draw-pose function — Kitchen Shift's pattern (constraint 3). The walkers'
drawn positions resolve the same way.

*Why it wins:* it makes the camera that needs solidity actually solid, and
gets "nothing overlaps" in Top-Down for free, while constraints 1, 3 and 7
stay untouched — no deadlock, no timing drift, no arrival regression, no
e2e coordinate churn.

*What it trades off:* Top-Down stays "soft" underneath — her simulated
position still passes through a shelf; what the player sees is the slide
around it. And the two cameras collide against different footprints, which
is honest to how they already draw but has to be documented, not hidden.

**B. Truly solid in both cameras — rejected.**
Top-Down blocks the real position too. Constraint 1 makes that a direct
re-run of Kitchen Shift's deadlock, and it needs wall-sliding plus
realistically a waypoint graph so a cross-room click routes down an aisle
instead of wedging (anti-goal 1). It also moves every walk's duration and so
the difficulty curve, and would need the timing-sensitive e2e specs
revisited. Roughly double the work, against the one goal the user stated.

**C. Kitchen Shift's pattern verbatim in both cameras — dropped.**
Draw-time nudge only, everywhere. Cheapest, but in First Person the camera
*is* the position: once the simulated position is deep inside a wide shelf,
the shortest way out is the far side, so the view would pop through the
bookcase.

The user picked **A**.

## The design

### 1. A new pure module: `web/static/js/library/collision.js`

No DOM, no canvas; covered by `web/static/js/library/collision.test.js`.
Per `docs/skills/javascript/SKILL.md`, it takes all context as arguments and
returns values.

* `resolveCollisions(x, y, radius, obstacles)` → `{x, y}`
  Pushes a circle out of every obstacle it overlaps, shortest way out, one
  obstacle at a time in list order. Rectangles (`{x, y, halfWidth,
  halfHeight}`) resolve circle-vs-AABB through the closest point on the box;
  circles (`{x, y, radius}`) resolve circle-vs-circle; a centre exactly
  inside a box escapes along the shallower axis. Same contract as Kitchen
  Shift's `resolveObstacleCollisions` (`cooking/floor-plan.js:493`).
  **Restate it here rather than sharing it.** Cross-game imports do exist
  (`library-game.js` imports from `hospital/`), so the reason isn't purity:
  it's that the obstacle *sets* differ and lifting the function into
  `shared/` would put Kitchen Shift's shipped behaviour at risk for no gain
  here. Note the kinship in a comment.
* `slideMove(x, y, dx, dy, radius, obstacles)` → `{x, y, blocked}`
  The *blocking* step First Person needs, and the one piece Kitchen Shift
  has no equivalent of. Try the full step; if the result overlaps anything,
  try x-only, then y-only, and take the first that is clear. That is what
  makes a shelf face slide instead of stick. `blocked` reports whether the
  full step was reduced, for a future bump cue; nothing reads it yet.
* `obstaclesFor(inventory, { camera, exclude })` → array
  One frame's obstacle list, built from `getWorldInventory(floor)`
  (`library/world-inventory.js` — already pure, already floor-filtered,
  already carrying `ref`) rather than re-deriving from `stations`/`decor`.
  `camera` is `'top-down'` or `'first-person'` and picks the footprint set
  below. `exclude` drops the entity being resolved.

**Two footprint sets, one module.** A `FOOTPRINTS` table maps each station
`kind` and decor `decorKind` to its half-extents per camera:

* Top-Down: the tile — `stationExtents(station)`, and for decor a **square
  from `w` alone** (`halfWidth = halfHeight = d.w / 2`), centred at
  `d.x, d.y`, because `h` is a sprite height (constraint 8). Drop the
  `h`-as-depth idea with a comment saying why.
* First Person: the mesh — sourced from the mesh modules' own exported
  constants (`BOOKSHELF_SIZE`, `FRONT_DESK_SIZE`, `FINES_COUNTER_SIZE`,
  `COFFEE_MACHINE_STAND`, `STAIRS_SIZE`, `READING_NOOK_SIZE`, the decor
  meshes' own) × `UNIT_SCALE`, so a mesh resize moves its footprint with
  it. Two kinds need a hand-written entry, each with its reason:
  * **Boss office: no FP footprint.** Its mesh is a door *in* the north wall
    running backwards (`Z_BACK = Z_WALL - 2.5`), so there is nothing standing
    on the floor to walk into; the room shell already stops her. Top-Down
    keeps its tile.
  * **Elevator: the two wall sections, not the box** (constraint 4). Two
    rectangles derived from `ELEVATOR_SIZE.width` and `isInElevatorCar`'s
    own doorway bounds, so they track the mesh; the 56 px doorway stays
    open and `elevatorRiderPose` (80, 574) stays clear. This reverses an
    earlier "exempt the whole kind, side walls later" note: exempting the
    kind would mean walking through visible wall in the very change that
    exists to stop that, for about fifteen lines' difference.
  * Stairs are solid in both; nothing poses her inside them.

**Radii:** `PLAYER_COLLISION_RADIUS = 14` and `PERSON_COLLISION_RADIUS = 14`,
matching Kitchen Shift — roughly the body's own width, so the footprint
reads as the body rather than an invisible bubble. Non-goal 3 states what
that does and does not guarantee.

**Never solid:** the hallucinated figures (`ghost-patron`,
`hallucination-figure` in the world inventory). A hallucination that blocks
you, or that spawns beside Eun-mi and shoves her sprite, is a bug.

**Queued patrons and Karen are obstacles but are never themselves
resolved** — their slots are fixed positions below their station and a
resolved queue would visibly bend. (With `QUEUE_SLOT_OFFSET_Y = 126` no slot
is within 28 px of furniture or of an arrival point, so this costs nothing.)

### 2. First Person: block the real position

In `updateFirstPersonMovement`, replace the
`clampToCanvas(player.x + dx, player.y + dy)` step (`library-game.js:1267`)
with `slideMove` against this floor's `'first-person'` obstacles, then
`clampToCanvas` the result as today. The existing `fpTransition` early
return leaves stair climbs and elevator rides untouched.

On entering First Person (`setCameraMode`), resolve the position once out of
anything it is inside. This is **required, not belt-and-braces**: Top-Down
can legitimately park her simulated position inside furniture — decor isn't
in `stationAtPoint`'s list, so clicking a plant walks her onto it, and
`moveTarget.staffKey` parks her "46 px beside" a walker
(`library-game.js:1096`), which can be inside a shelf box. The resolve moves
her ≤14 px, which is safe: the only slack-based read of her position is
`isPlayerAtBossOffice` (`:1076`), with 30 px of slack.

`switchFloor` keeps `elevatorRiderPose` exactly as it is — the doorway is
open, so there is nothing to push her out of.

### 3. Top-Down: resolve at draw time

Add `currentPlayerDrawPose()` to `library-game.js`, mirroring Kitchen
Shift's, returning a `Math.round`ed pose so sprite edges stay crisp.
`drawPlayer` (`library-game.js:3479`) draws the body, the label chip and the
carry badge from it. `drawCoffeeSplash` (`:2123`) currently reads
`player.x/y` directly and takes no arguments — it needs a pose parameter, or
the splash detaches from the sprite. That is a small signature change, not
free.

`player.x/y` itself is never touched, so `updatePlayer`, `handleArrival`,
`approachPoint` and every distance check keep today's behaviour
(constraints 1, 3, 7).

**Resolve one-way** (constraint 3's precedent, and constraint 10's reason):
Eun-mi's pose resolves against stations and decor only; each walker's pose
resolves against stations, decor, Eun-mi's **raw** position and the other
walkers' **raw** positions. A mutual push would separate a 14 px overlap
into as much as 56 px of visible gap, with jitter while both move — and the
Security/Ji-ho pair would do it every lap.

**Layering follows the resolved poses.** `drawAmbient` splits front/back on
`(a.y > player.y) !== inFront` (`library-game.js:764`), and the Min-jun
proximity check at `:637` reads raw positions. Feed the layering decision
the same resolved y the sprite is drawn at, or a walker nudged across
Eun-mi's y draws on the wrong side of her. The Min-jun check stays on raw
positions — it's a 260 px gameplay radius, not a drawing concern.

**Hit-testing moves with the drawing.** `staffAtPoint` (`:712`) tests raw
`a.x/a.y`, and `e2e/library-game.spec.js:213` clicks the coordinates the
`getStaff` hook (`:5637`) reports. Route **both** through the resolved pose
in the same change; changing one without the other silently breaks either
the staff-click specs or the click box.

**Exempt the station she has arrived at** from her own draw resolve.
Constraint 1's clearances are all under 14 px, so without this she visibly
slides on arrival — 3.4 px at a square station, and 12.9 px at the Fines
Counter, the most-visited diagonal approach in the game. Standing at a
counter should read as contact, so the station that is `moveTarget.station`,
or the one she last arrived at while she is still within its standoff, is
not an obstacle to her. Everything else still is.

### 4. Tests

* `web/static/js/library/collision.test.js` (`node --test`; `library/*.test.js`
  is already in `npm run test:unit`, so no `package.json` change): a circle
  pushed out of a box on each face and from dead centre; circle-vs-circle;
  coincident centres; `slideMove` sliding along a face with one axis blocked,
  passing a clear step through untouched, and reporting `blocked`;
  `obstaclesFor` filtering by floor, excluding the subject, omitting
  hallucinations, returning *different* extents for the two cameras for the
  same bookshelf, giving the boss office no FP footprint, and leaving the
  elevator's doorway open while its side walls are solid.
* `e2e/library-game.spec.js`, driven with the `freeze`/`step` hooks the other
  FP specs use rather than wall-clock holds: walking forward into a known
  bookshelf never puts `getPlayerPosition` inside its **mesh** footprint;
  aimed at its corner, she still moves (slides) rather than stopping dead;
  and walking into an elevator's side wall is blocked while its doorway
  still admits her.
* **Confirm, don't move, the existing position-asserting FP specs.** The
  diagonal-walk specs (`:1850`) start at (480, 380) and walk ~45 px over
  24 stepped frames. Against *tile* boxes the `w+d` / `s+d` cases would have
  clipped bookshelf `[580, 400]` and halved their margin; against its
  **mesh** footprint (40 × 14 → blocked at x ≥ 546 from centre) they stay
  clear, as does every other floor-1 obstacle. Verify that by running them
  rather than editing them — if they do tighten, the footprint table is
  wrong, not the spec. The arrow-key spec (`:1707`) is safe either way:
  nothing overlaps (480, 380), and it sets the position after entering FP,
  so §2's resolve never fires.
* Everything else — Go tests, the other JS unit tests, the rest of the
  Playwright suite — must pass unchanged. A Top-Down spec that needs editing
  is a signal that the draw-time-only boundary leaked.

### 5. Docs, in the same commit

* `docs/features/library-game.md`: collision in Scope, and a History entry.
  State the asymmetry plainly — blocked in First Person against mesh
  footprints, non-overlapping at draw time against tile boxes in Top-Down —
  and why (constraints 1, 2, 3), so the next reader does not "fix" the
  inconsistency and re-introduce the deadlock. Include non-goal 3's wording:
  footprints don't overlap, sprites still can.
* `docs/features/library-first-person-3d.md`: FP movement is now blocked by
  the mesh footprints, which are read from the mesh modules' own size
  constants; the elevator doorway is the one gap in a wall.
* `CLAUDE.md`'s library gotcha: `library/collision.js` is the one source of
  the collision geometry, it holds a footprint set per camera, and Top-Down's
  resolution is visual only.

## What's left to the builder

* The exact `FOOTPRINTS` table shape, and which mesh modules already export
  a usable size constant versus which need one added (several do; check each
  rather than assuming).
* How `library-game.js` memoizes the obstacle list — one build per frame per
  camera, reused by the player and every walker, is the obvious shape.
* Whether the Fines Counter's mesh footprint (96 × 44, against a 130 × 130
  tile) reads correctly as solid in First Person once it is, or whether its
  room wants a wall. If it looks wrong, raise it rather than redesigning the
  room here.
* Whether two characters at touching distance (28 px = 0.7 units, inside
  `NEAR` = 1 unit) look acceptable in FP. Their front faces get clipped by
  `clipNear` (`three-d/core.js:131`) and textured cells fall back to flat
  colour. This is pre-existing in kind — you can already stand on top of
  someone — and collision makes it rarer, not worse. Note it, don't fix it.
