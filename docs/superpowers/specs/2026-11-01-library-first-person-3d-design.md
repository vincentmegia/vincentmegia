# Library Shift — True 3D First-Person View

Date: 2026-11-01
Status: Design (awaiting review)

## Goal

Replace the first-person **navigation** view's billboard-sprite renderer
with a true software-3D renderer drawn on the existing 2D canvas. Every
object the player walks around becomes real 3D geometry that rotates and
occludes correctly as the camera moves: characters (Eun-mi, Min-jun,
Ji-ho, staff, patrons, Karen), bookshelves, the coffee machine, the
stairs, the elevator, and the remaining station objects (front desk,
fines counter, return cart, boss's office, reading nook). The elevator
and stairs additionally get short animated first-person ride/climb
transitions that replace today's instant floor switch.

Controls and navigation are unchanged. Interaction overlays/minigames
(coffee-pour, checkout, till-count, reading) stay in their current 2D
presentation. Top-Down mode is untouched — it keeps the existing 2D art.

## Non-goals

- No WebGL / Three.js / external 3D dependency. Rendering stays on the
  2D canvas context, honoring the per-route CSP and the Render/Supabase
  deploy. (Decision confirmed with the user.)
- No re-rendering of interaction overlays in 3D.
- No change to game rules, scoring, Sanity, leaderboards, or the
  Top-Down camera.
- No change to the interaction/targeting logic — see "Interaction stays
  on the existing projection" below.

## Decisions (confirmed with the user)

1. **Software 3D on the 2D canvas** — author geometry as vertices/faces
   in pure JS modules; project with a small camera matrix; painter-sort
   and flat-shade polygons filled with the 2D context.
2. **Animated 3D ride/climb transitions** for both the elevator and the
   stairs.
3. **Navigation view only** — overlays stay 2D.

## Architecture

All new rendering code lives under `web/static/js/library/three-d/`.
The core is pure and DOM-free (mirroring `first-person.js`,
`rules.js`, `engine-state.js`), unit-tested with `node --test`. Each
object's geometry is its own small module so the work parallelizes and
each file stays focused.

### `three-d/core.js` — the frozen interface (pure, node-testable)

Responsibilities:

- **Math**: vec3 ops (add, sub, scale, dot, cross, normalize, length) and
  mat4 ops (identity, multiply, perspective, lookAt, translate, rotateX,
  rotateY, rotateZ, scale, transformPoint). Column-major, right-handed.
- **World/axis convention**: the existing 960×600 top-down world maps to
  3D as world **X = world x**, world **Z = world y** (depth into the
  scene), world **Y = up**. One world unit = one 3D unit. The
  `first-person.js` facing convention (angle 0 = north/−y, increasing
  clockwise) maps to a camera yaw by the identity already encoded in
  `forwardVector` — the core documents and reuses that exact mapping so
  "forward" in 3D matches "forward" for movement/interaction.
- **Camera**: `cameraFromPose(player, opts)` where
  `player = {x, y, facing}` and
  `opts = {eyeHeight, pitch, roll, fov, aspect, near, far}` returns a
  view-projection matrix plus the camera world position (needed for
  per-face lighting and fog).
- **Mesh shape** (plain data, model space):
  `{ vertices: [[x,y,z], …], faces: [{ indices: [i,…], color: '#rrggbb' }, …] }`.
  A face's vertices are listed counter-clockwise when seen from outside
  (so a normal can be derived). Faces may be triangles or convex polygons.
- **Placement**: a mesh is positioned in the world by
  `{ pos: [x,y,z], yaw, scale }` (scale may be a scalar or `[sx,sy,sz]`).
- **`drawScene(ctx, camera, placed, opts)`**: the single draw path.
  `placed` is an array of `{ mesh, placement }`. The function:
  1. transforms every face's vertices to world then view/clip space;
  2. near-plane clips (drops or splits faces crossing the near plane —
     v1 may simply drop any face with a vertex behind the near plane,
     documented as a known limitation);
  3. computes each face's world-space normal and a flat-shading
     brightness from `opts.light` (a direction + ambient term);
  4. applies distance fog from the camera position using `opts.fog`
     (color + start/end distances);
  5. **painter-sorts all faces across all meshes together** by view-space
     average depth (farthest first) and fills each as a 2D path. Drawing
     every object's faces in one sorted list is what makes cross-object
     occlusion correct.

The core never imports anything DOM-specific except that `drawScene`
takes a `ctx`; all math/projection is pure and tested without a canvas.

### `three-d/meshes/*.js` — one builder per object (pure, node-testable)

Each module exports a builder returning a `Mesh` (model-space geometry
centered sensibly, e.g. origin at the floor-contact point). Builders are
deterministic. Each has a focused unit test asserting vertex/face counts
and that the bounding box falls within expected extents (a cheap
regression guard).

- `character.js` — one parameterized low-poly humanoid (head, torso, two
  arms, two legs as boxes/prisms) taking a palette +
  flags: `{ skin, hair, top, bottom, angry }`. Eun-mi, Min-jun, Ji-ho,
  staff, patrons and Karen are all produced by passing different palettes
  (sourced from the existing personality/palette data), so there is one
  humanoid to maintain, in the spirit of the repo's shared-art rule. The
  detailed 2D character art is **not** ported; it remains for Top-Down.
- `bookshelf.js` — a tall box with horizontal shelf planks and rows of
  thin book-spine boxes in varied colors/heights.
- `coffee-machine.js` — a boxy body, a spout, a drip tray, a cup.
- `stairs.js` — a flight of steps (stacked boxes) with side rails.
- `elevator.js` — a car shell with two sliding door panels and a floor
  indicator face; doors are separate sub-parts the transition can animate
  (the builder exposes door panels as distinct faces/placement offsets).
- `station-box.js` — parameterized desk/counter/table geometry for the
  remaining stations (front desk, fines counter, return cart, boss's
  office, reading nook), tinted by the station's existing color.

### `three-d/room.js` — the room shell (pure geometry builder)

Builds the enclosing room as 3D geometry for a given floor: floor plane,
ceiling, four walls, window openings with warm panes, wainscoting, and
ceiling-light fixtures. Returns a `Mesh` (or a few meshes) placed so the
camera sits inside. Replaces today's `drawFirstPersonBackground`.

### `three-d/scene.js` — per-frame scene assembly (imported by library-game.js)

- `buildFirstPersonScene({ player, facing, floor, stations, patrons,
  cameraParams })` returns `{ camera, placed }` ready for
  `core.drawScene`. It:
  - builds/reuses the room shell for the current floor;
  - places one mesh per station on the current floor at its world x/y,
    choosing the mesh builder by `station.kind`;
  - places one character mesh per visible patron/staff/front-desk slot;
  - derives the camera from the player pose plus `cameraParams`
    (eye-height bob, jump offset, pitch, roll/tilt, fov) — the head-bob,
    jump, strafe-tilt and sprint-FOV effects move **into the camera**
    instead of canvas transforms.
- `library-game.js` calls this each frame in `drawFirstPersonView`,
  then draws the 2D HUD (crosshair, minimap, vignette, dust) on top of
  the 3D pass exactly as today.

### Interaction stays on the existing projection

`first-person.js`'s `projectEntity` / `findInteractTarget` already
answer "what is the player looking at, and is it in range," are fully
unit-tested, and pass. They are **kept unchanged** and continue to drive
interaction and the crosshair target label. The 3D core is
drawing-only. This deliberately decouples *how the view looks* (new, 3D)
from *what can be interacted with* (unchanged, tested), so the
re-render cannot regress interaction behavior.

### Elevator ride / stair climb transitions

A transition state machine in `library-game.js` (small, or extracted to
`three-d/transitions.js` if it grows):

- Interacting with the elevator starts an `elevator-ride` transition:
  doors slide shut, a floor indicator ticks, the car makes a subtle
  vertical camera move, doors slide open — ~2 seconds — then
  `switchFloor(targetFloor)` completes and control returns.
- Interacting with the stairs starts a `stair-climb` transition: the 3D
  camera travels up/down the staircase geometry over ~1.5 seconds, then
  `switchFloor` completes.
- While a transition is active, movement/turn/strafe/jump input is
  ignored and the HUD hint reflects the transition.
- `switchFloor` itself is unchanged (still the instant teleport); the
  transitions call it at their end. Top-Down mode's floor button keeps
  switching instantly (no transition) — transitions are a First-Person
  affordance only.
- Determinism: a `window.__libraryTestHooks` method force-completes any
  active transition immediately, so Playwright specs and the existing
  deterministic hooks never block on the animation.

## Data flow

```
player {x,y,facing} + floor + stations + patrons + cameraParams
        │
        ▼
three-d/scene.buildFirstPersonScene  ──►  { camera, placed[] }
        │
        ▼
three-d/core.drawScene(ctx, camera, placed, {light, fog})   // 3D pass
        │
        ▼
library-game HUD: crosshair, minimap, vignette, dust         // 2D overlay

(independently)  first-person.projectEntity/findInteractTarget  // targeting
```

## Testing

- **Core** (`three-d/core.test.js`): matrix identities/multiply,
  projection of known points to expected screen coords, camera-from-pose
  (a point dead ahead projects to screen center; a point to the right
  projects right), painter-sort ordering, normal/backface and
  flat-shading brightness for known inputs.
- **Meshes** (`meshes/*.test.js`, `room.test.js`): each builder returns
  the expected vertex/face counts and a bounding box within expected
  extents; the character builder honors its palette params.
- **Scene** (`three-d/scene.test.js`): given a fixed player/floor/station
  list, the right number and kinds of meshes are placed at the expected
  world positions, and camera params map through (bob raises eye height,
  tilt sets roll, sprint widens fov).
- **Transitions**: pure timing/state-machine logic unit-tested
  (phase progression over dt, force-complete). The visual animation is
  verified in a browser.
- **Integration**: not unit-tested (canvas). Verified by running the
  game in a browser and exercising First Person on both floors, every
  object type, and both transitions. Existing `make check` and
  `npm run test:unit` must stay green.

## Risks / limitations

- Flat-shaded, painter-sorted polygons can mis-order intersecting faces;
  objects in this scene are separated enough that this is acceptable, and
  per-face (not per-object) sorting handles the common cases.
- v1 near-plane handling may drop faces that cross the near plane rather
  than splitting them; walking a camera *through* an object can flicker.
  Documented; splitting can be added later if needed.
- Fill-rate: a roomful of low-poly meshes is a few hundred polygons per
  frame — fine for the canvas, but mesh builders must stay low-poly
  (budget noted per builder). Distance fog + culling offscreen meshes
  keep it bounded.

## Documentation to update

- `docs/features/library-game.md` — the First Person Mode section:
  describe the 3D renderer, the module layout, and the ride/climb
  transitions.
- `web/static/js/library/first-person.js` header — note that projection
  now drives interaction/targeting only; drawing is the `three-d/` core.
- New `docs/features/library-first-person-3d.md` — the renderer's
  architecture, the mesh format, how to add a new object, and the
  testing approach (starting from `docs/features/template.md`).
- `CLAUDE.md` "Shared art" / Library gotchas — note the 3D humanoid and
  the `three-d/` module boundary.

## Multi-agent task breakdown (for the implementation plan)

1. **Core** — `three-d/core.js` + tests. Blocking: freeze the mesh
   shape, placement shape, `cameraFromPose`, and `drawScene` signatures
   first; everything else builds against them.
2. **Meshes, in parallel against the frozen core** (one agent each):
   `character.js` · `bookshelf.js` + `station-box.js` ·
   `coffee-machine.js` · `stairs.js` · `elevator.js` · `room.js`.
3. **Scene assembly** — `three-d/scene.js` + wiring in `library-game.js`
   to replace the billboard/background path; move bob/jump/tilt/fov into
   camera params; keep the 2D HUD on top.
4. **Transitions** — elevator ride + stair climb state machine + test
   hook (needs scene + elevator/stairs meshes).
5. **Docs** — the four documentation updates above.

Dependency order: Core → (meshes ∥ scene scaffolding) → scene wiring →
transitions → docs.
