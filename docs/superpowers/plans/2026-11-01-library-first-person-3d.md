# Library Shift 3D First-Person View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Library Shift's first-person billboard-sprite view with a true software-3D renderer drawn on the existing 2D canvas, covering every object plus animated elevator/stair transitions.

**Architecture:** A pure, DOM-free `three-d/core.js` (vec/mat math, camera-from-pose, projection, a single painter-sorted draw path) with the mesh and placement data shapes frozen first. One pure mesh builder per object type builds model-space geometry against that frozen core. A per-frame `scene.js` places meshes from the live game state and folds head-bob/jump/tilt/fov into the camera; `library-game.js` draws the 3D pass then the existing 2D HUD on top. Interaction keeps using the existing, already-tested `first-person.js` projection.

**Tech Stack:** Plain ES modules, canvas 2D context, `node --test` for pure modules, Playwright for in-browser verification. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-01-library-first-person-3d-design.md`

## Global Constraints

- No WebGL / Three.js / external 3D dependency; rendering uses the 2D canvas context only.
- New rendering code lives under `web/static/js/library/three-d/`.
- Core and mesh/scene/transition logic modules are pure and DOM-free (except `drawScene`, which takes a `ctx`), mirroring `first-person.js` / `rules.js`; each has a `node --test` suite run by `npm run test:unit`.
- World→3D axis mapping is fixed: world X = world x, world Z = world y (depth), world Y = up; one world unit = one 3D unit. Facing angle reuses `first-person.js`'s convention (0 = north/−y, clockwise), forward = `(sin facing, 0, −cos facing)`.
- Top-Down mode and all interaction overlays are unchanged. Interaction/targeting keeps using `first-person.js`'s `projectEntity`/`findInteractTarget` unchanged.
- `make check` and `npm run test:unit` must stay green; the user's `:8080` dev server is never killed/restarted.
- Mesh builders stay low-poly (per-builder polygon budgets noted in each task).

## Review Focus

- **Face crossing the near plane** (camera walked into/through an object): `buildDrawList` must drop any face with a vertex at/behind the near plane rather than projecting garbage. Pinned in Task 2.
- **Empty scene** (floor/frame with no placeable entities, or offscreen-culled): `drawScene`/`buildDrawList` with empty `placed[]` must return an empty list and draw nothing, no throw. Pinned in Task 2.
- **Re-interacting or floor-switching during an active transition**: a second elevator/stair interact while a transition runs must be ignored. Pinned in Task 10.
- **Leaving first-person mid-transition** (camera toggled to top-down during a ride): the transition must cancel and release the movement-input block so controls aren't stuck. Pinned in Task 10.
- **Unknown/!mapped `station.kind`**: `scene.js` must fall back to the generic `station-box` mesh, never crash on a kind with no dedicated builder. Pinned in Task 9.

---

## Task 1: Core math + camera

**Files:**
- Create: `web/static/js/library/three-d/core.js`
- Test: `web/static/js/library/three-d/core.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `identityMat4(): Mat4` — `Mat4` is a length-16 `number[]`, column-major.
  - `multiplyMat4(a: Mat4, b: Mat4): Mat4`
  - `transformPoint(m: Mat4, p: Vec3): [number,number,number,number]` — `Vec3` is `[x,y,z]`; returns homogeneous `[x,y,z,w]`.
  - `cameraFromPose(player: {x:number,y:number,facing:number}, opts: {eyeHeight:number,pitch?:number,roll?:number,fov:number,aspect:number,near:number,far:number}): Camera` — `Camera = { viewProj: Mat4, position: Vec3 }`.
  - `projectPoint(camera: Camera, world: Vec3, viewport: {width:number,height:number}): {x:number,y:number,depth:number,visible:boolean}` — `depth` is view-space distance; `visible` is false when at/behind the near plane.

- [ ] **Step 1: Write failing tests** in `core.test.js`:
  - `identityMat4` × a vec returns the vec; `multiplyMat4(identity, m)` deep-equals `m`.
  - `cameraFromPose` with a player facing north (facing 0) at world center: a world point one unit *forward* (smaller world-y) projects to `x ≈ viewport.width/2` (dead center horizontally).
  - A world point to the player's right projects to `x > width/2`; to the left projects `x < width/2`.
  - A point behind the camera returns `visible: false`.
- [ ] **Step 2: Run tests, verify they fail** — `npm run test:unit` (new file errors on missing exports).
- [ ] **Step 3: Implement** the exports above in `core.js`. Build `cameraFromPose` as `perspective(fov,aspect,near,far) × lookAt(eye, eye+forward, up)` where `eye=[player.x, eyeHeight, player.y]`, `forward=[sin facing, 0, −cos facing]` rotated by `pitch`, and `up` rotated by `roll`. `projectPoint` applies `viewProj`, does the perspective divide, maps NDC → viewport.
- [ ] **Step 4: Run tests, verify they pass** — `npm run test:unit`.
- [ ] **Step 5: Commit** (`three-d core: math + camera-from-pose`).

## Task 2: Core draw list + drawScene

**Files:**
- Modify: `web/static/js/library/three-d/core.js`
- Test: `web/static/js/library/three-d/core.test.js`

**Interfaces:**
- Consumes: Task 1 exports; `Mesh = {vertices: Vec3[], faces: Face[]}`, `Face = {indices: number[], color: string}`; `Placement = {pos: Vec3, yaw: number, scale: number|Vec3}`; `Placed = {mesh: Mesh, placement: Placement}`.
- Produces:
  - `buildDrawList(camera: Camera, placed: Placed[], opts: {viewport, light:{dir:Vec3,ambient:number}, fog?:{color:string,start:number,end:number}}): DrawPoly[]` — `DrawPoly = {screen:[number,number][], color:string, depth:number}`, sorted farthest-first.
  - `drawScene(ctx, camera, placed, opts): void` — calls `buildDrawList` and fills each poly.

- [ ] **Step 1: Write failing tests** in `core.test.js`:
  - Two placed unit-quad meshes at different depths → `buildDrawList` returns them farthest-first.
  - A face with a vertex behind the near plane is omitted from the list (Review Focus: near-plane).
  - `buildDrawList(camera, [], opts)` returns `[]` (Review Focus: empty scene).
  - A face whose normal faces the light is brighter (higher resulting lightness) than one facing away — assert on the returned `color` lightness ordering.
- [ ] **Step 2: Run tests, verify they fail.**
- [ ] **Step 3: Implement** `buildDrawList` (transform each face's vertices by placement→world→`viewProj`; drop faces touching the near plane; world-space normal via cross product of two edges; flat-shade `color` by `ambient + max(0, normal·light.dir)`; optional fog lerp toward `fog.color` by view depth; sort by average view depth) and `drawScene` (loop filling `moveTo/lineTo` paths). Keep shading as a pure color transform so it is testable.
- [ ] **Step 4: Run tests, verify they pass.**
- [ ] **Step 5: Commit** (`three-d core: painter-sorted draw list + drawScene`).

## Task 3: Character mesh

**Files:**
- Create: `web/static/js/library/three-d/meshes/character.js`
- Test: `web/static/js/library/three-d/meshes/character.test.js`

**Interfaces:**
- Consumes: `Mesh` shape (Task 2).
- Produces: `buildCharacter(opts: {skin:string, hair:string, top:string, bottom:string, angry?:boolean}): Mesh` — origin at floor-contact (feet at y=0), facing +Z-forward in model space. Budget ≤ ~60 faces.

- [ ] **Step 1: Write failing test** — `buildCharacter({...})` returns a `Mesh` whose vertices' bounding box is within expected human extents (height ~1.7 units, width < 0.7, feet at y≈0), face colors include the passed `skin`/`top`/`bottom`, and face count is within budget.
- [ ] **Step 2: Run test, verify it fails.**
- [ ] **Step 3: Implement** a low-poly humanoid (head, torso, two arms, two legs as boxes/prisms) colored from `opts`; `angry` tweaks head tint per existing Karen convention.
- [ ] **Step 4: Run test, verify it passes.**
- [ ] **Step 5: Commit** (`three-d: parameterized character mesh`).

## Task 4: Bookshelf + station-box meshes

**Files:**
- Create: `web/static/js/library/three-d/meshes/bookshelf.js`, `web/static/js/library/three-d/meshes/station-box.js`
- Test: `web/static/js/library/three-d/meshes/bookshelf.test.js`, `.../station-box.test.js`

**Interfaces:**
- Consumes: `Mesh` shape.
- Produces:
  - `buildBookshelf(opts?: {width?:number, rows?:number, accent?:string}): Mesh` — origin at floor-contact. Budget ≤ ~120 faces.
  - `buildStationBox(opts: {width:number, depth:number, height:number, color:string}): Mesh` — a desk/counter/table box, origin at floor-contact.

- [ ] **Step 1: Write failing tests** — bounding boxes match the passed dimensions; `buildStationBox` honors `color`; `buildBookshelf` produces ≥ `rows` shelf planks and some book-spine faces; face counts within budget.
- [ ] **Step 2: Run tests, verify they fail.**
- [ ] **Step 3: Implement** both builders.
- [ ] **Step 4: Run tests, verify they pass.**
- [ ] **Step 5: Commit** (`three-d: bookshelf + station-box meshes`).

## Task 5: Coffee-machine mesh

**Files:**
- Create: `web/static/js/library/three-d/meshes/coffee-machine.js`
- Test: `web/static/js/library/three-d/meshes/coffee-machine.test.js`

**Interfaces:**
- Consumes: `Mesh` shape.
- Produces: `buildCoffeeMachine(): Mesh` — body + spout + drip tray + cup, origin at floor-contact. Budget ≤ ~50 faces.

- [ ] **Step 1: Write failing test** — returns a `Mesh`; bounding box within counter-appliance extents; face count within budget.
- [ ] **Step 2: Run test, verify it fails.**
- [ ] **Step 3: Implement** the builder.
- [ ] **Step 4: Run test, verify it passes.**
- [ ] **Step 5: Commit** (`three-d: coffee-machine mesh`).

## Task 6: Stairs mesh

**Files:**
- Create: `web/static/js/library/three-d/meshes/stairs.js`
- Test: `web/static/js/library/three-d/meshes/stairs.test.js`

**Interfaces:**
- Consumes: `Mesh` shape.
- Produces: `buildStairs(opts?: {steps?:number}): Mesh` — a flight of stacked step boxes + side rails, origin at floor-contact, ascending toward +Z. Budget ≤ ~90 faces. Exposes `STAIR_RISE_PER_STEP` and `STAIR_RUN_PER_STEP` constants for the transition to walk the camera along.

- [ ] **Step 1: Write failing test** — returns a `Mesh` with ≥ `steps` distinct step tops at increasing y; exports the two step constants; face count within budget.
- [ ] **Step 2: Run test, verify it fails.**
- [ ] **Step 3: Implement** the builder and constants.
- [ ] **Step 4: Run test, verify it passes.**
- [ ] **Step 5: Commit** (`three-d: stairs mesh`).

## Task 7: Elevator mesh

**Files:**
- Create: `web/static/js/library/three-d/meshes/elevator.js`
- Test: `web/static/js/library/three-d/meshes/elevator.test.js`

**Interfaces:**
- Consumes: `Mesh` shape.
- Produces: `buildElevator(opts?: {doorOpen?:number}): Mesh` — car shell + two door panels + indicator face, origin at floor-contact. `doorOpen` in `[0,1]` slides the two door panels apart (0 = shut, 1 = fully open). Budget ≤ ~50 faces.

- [ ] **Step 1: Write failing test** — with `doorOpen:0` the two door panels meet at center; with `doorOpen:1` their inner edges are separated by the car width; bounding box within a doorway extent; face count within budget.
- [ ] **Step 2: Run test, verify it fails.**
- [ ] **Step 3: Implement** the builder; door panel x-offset = `doorOpen × halfCarWidth`.
- [ ] **Step 4: Run test, verify it passes.**
- [ ] **Step 5: Commit** (`three-d: elevator mesh with animatable doors`).

## Task 8: Room shell mesh

**Files:**
- Create: `web/static/js/library/three-d/room.js`
- Test: `web/static/js/library/three-d/room.test.js`

**Interfaces:**
- Consumes: `Mesh` shape; floor dimensions `CANVAS_WIDTH`/`CANVAS_HEIGHT` (import from where `first-person.js`/`floor-plan.js` expose them).
- Produces: `buildRoom(opts: {width:number, depth:number, height:number, floorTint:string}): Mesh` — floor plane, ceiling, four walls, window openings, wainscoting band, and light-fixture faces, sized so the camera stands inside. Budget ≤ ~120 faces.

- [ ] **Step 1: Write failing test** — the floor plane spans `[0,width]×[0,depth]` at y=0, the ceiling at y=height, four walls enclose the box; face count within budget.
- [ ] **Step 2: Run test, verify it fails.**
- [ ] **Step 3: Implement** the builder (reuse the palette from the current `drawFirstPersonBackground`).
- [ ] **Step 4: Run test, verify it passes.**
- [ ] **Step 5: Commit** (`three-d: 3D room shell`).

## Task 9: Scene assembly

**Files:**
- Create: `web/static/js/library/three-d/scene.js`
- Test: `web/static/js/library/three-d/scene.test.js`

**Interfaces:**
- Consumes: `cameraFromPose` (Task 1); all mesh builders (Tasks 3–8); `Placed` shape.
- Produces: `buildFirstPersonScene(input): {camera: Camera, placed: Placed[]}` where `input = {player:{x,y,facing}, floor, stations:[], characters:[{x,y,palette}], cameraParams:{bobOffset,jumpOffset,pitch,roll,fov}, viewport:{width,height}}`. Includes `meshForStationKind(kind): (mesh builder)` mapping `bookshelf→buildBookshelf`, `coffee-machine→buildCoffeeMachine`, `stairs→buildStairs`, `elevator→buildElevator`, and everything else → `buildStationBox` (Review Focus: unknown kind).

- [ ] **Step 1: Write failing tests** — given a fixed player/floor/stations/characters input: the room mesh is placed; one mesh per station on that floor is placed at its world `(x, 0, y)`; one character mesh per character; an unrecognized `station.kind` places a `station-box` (not a throw); `cameraParams.bobOffset` raises `camera.position` y, `roll` and `fov` thread into the camera.
- [ ] **Step 2: Run tests, verify they fail.**
- [ ] **Step 3: Implement** `buildFirstPersonScene` and `meshForStationKind`. Cull stations/characters not on `floor`. Build `camera` via `cameraFromPose(player, {eyeHeight: baseEye+bobOffset+jumpOffset, pitch, roll, fov, aspect: width/height, near, far})`.
- [ ] **Step 4: Run tests, verify they pass.**
- [ ] **Step 5: Commit** (`three-d: per-frame scene assembly`).

## Task 10: Elevator/stair transition state machine

**Files:**
- Create: `web/static/js/library/three-d/transitions.js`
- Test: `web/static/js/library/three-d/transitions.test.js`

**Interfaces:**
- Consumes: `STAIR_RISE_PER_STEP`/`STAIR_RUN_PER_STEP` (Task 6).
- Produces:
  - `createTransition(kind: 'elevator'|'stairs', targetFloor): TransitionState`
  - `updateTransition(state, dt): TransitionState` — advances phase/time; returns a new state. Elevator phases: `doors-close → rise → doors-open → done` (~2s total); stairs: `travel → done` (~1.5s).
  - `transitionCamera(state, basePose): {posOffset, doorOpen, floorSwitched:boolean}` — per-frame camera offsets + elevator door-open fraction; `floorSwitched` flips true exactly once when the floor change should commit.
  - `forceComplete(state): TransitionState` — jumps to `done` with `floorSwitched:true`.

- [ ] **Step 1: Write failing tests** — elevator advances through all phases over its duration; `floorSwitched` becomes true exactly once; `doorOpen` is 0 at start, returns to >0 at `doors-open`; stairs camera rises by `steps × STAIR_RISE_PER_STEP` across `travel`; `forceComplete` jumps straight to `done` with `floorSwitched:true`; calling `updateTransition` on a `done` state is a no-op (Review Focus: re-interact ignored is enforced at the caller, but a done state never re-fires `floorSwitched`).
- [ ] **Step 2: Run tests, verify they fail.**
- [ ] **Step 3: Implement** the pure state machine.
- [ ] **Step 4: Run tests, verify they pass.**
- [ ] **Step 5: Commit** (`three-d: elevator/stair transition state machine`).

## Task 11: Wire the 3D renderer into library-game.js

**Files:**
- Modify: `web/static/js/library-game.js` (the First Person render path: `drawFirstPersonView`, `drawFirstPersonBackground`/billboard draw, `attemptInteract` for stairs/elevator, `switchFloor` callers, the camera-params derivation, and `window.__libraryGameTestHooks`)

**Interfaces:**
- Consumes: `buildFirstPersonScene` (Task 9), `drawScene` (Task 2), the transition functions (Task 10).
- Produces: new test hooks `getActiveTransition()`, `forceCompleteTransition()`; unchanged interaction/targeting via `first-person.js`.

- [ ] **Step 1:** Replace the billboard/background path in `drawFirstPersonView` with: assemble `cameraParams` from the existing bob/jump/tilt/sprint-fov values → `buildFirstPersonScene(...)` → `drawScene(ctx, camera, placed, {light, fog, viewport})`; then draw the existing 2D HUD (crosshair, minimap, vignette, dust) on top unchanged.
- [ ] **Step 2:** On elevator/stairs interact, start a transition instead of calling `switchFloor` directly; block movement/turn/strafe/jump input while a transition is active; call `switchFloor(targetFloor)` when `transitionCamera().floorSwitched` fires; drive the elevator door + camera offset from `transitionCamera`. Ignore a new elevator/stairs interact while one is active (Review Focus). On `setCameraMode` away from first-person, cancel any active transition and clear the input block (Review Focus).
- [ ] **Step 3:** Add `getActiveTransition`/`forceCompleteTransition` to `window.__libraryGameTestHooks`.
- [ ] **Step 4: Verify in a browser** (own port, not :8080): First Person on both floors renders 3D room + all object types; walking around occludes correctly; elevator and stairs play their transitions and land on the right floor; `npm run test:unit` and `make check` stay green.
- [ ] **Step 5: Commit** (`Library Shift: render first-person view in true 3D`).

## Task 12: Playwright coverage for 3D transitions

**Files:**
- Create or modify: the Library Shift Playwright spec under the e2e tests (follow the existing spec's location/pattern)

**Interfaces:**
- Consumes: `__libraryGameTestHooks.setCameraMode`, `getActiveTransition`, `forceCompleteTransition`, `getCurrentFloor`.

- [ ] **Step 1: Write a failing/err-guarded spec** — enter First Person, interact with the elevator, assert a transition becomes active, `forceCompleteTransition()`, assert `getCurrentFloor()` changed; repeat for stairs.
- [ ] **Step 2: Run it** against a server on a non-:8080 port with its own `--output` dir; verify it passes (Chromium + WebKit).
- [ ] **Step 3: Commit** (`e2e: Library Shift 3D floor-transition coverage`).

## Task 13: Documentation

**Files:**
- Modify: `docs/features/library-game.md` (First Person Mode section), `web/static/js/library/first-person.js` (header comment), `CLAUDE.md` (Library gotchas / shared-art note)
- Create: `docs/features/library-first-person-3d.md` (from `docs/features/template.md`)

- [ ] **Step 1:** Update `library-game.md`'s First Person section to describe the 3D renderer, the `three-d/` module layout, and the ride/climb transitions.
- [ ] **Step 2:** Update the `first-person.js` header to say projection now drives interaction/targeting only; drawing is the `three-d/` core.
- [ ] **Step 3:** Write `docs/features/library-first-person-3d.md`: architecture, the mesh/placement/camera data shapes, how to add a new object mesh, and the testing approach.
- [ ] **Step 4:** Add the 3D humanoid + `three-d/` boundary note to `CLAUDE.md`'s Library gotchas.
- [ ] **Step 5: Commit** (`docs: Library Shift 3D first-person renderer`).
