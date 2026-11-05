# Feature: Library Shift first-person 3D renderer

## Status

`Shipped` (branch `fp-3d`)

## Summary

Library Shift's First Person camera is a software-3D renderer that draws
flat-shaded, painter-sorted polygons onto the existing 2D canvas (no WebGL,
no dependencies). It replaced the older billboard-sprite view. Parent doc:
`library-game.md`.

## Scope

**In scope:** the room shell, stations, queue characters and Return Cart
books drawn as 3D meshes; head-bob/jump/tilt/sprint as camera effects; the
animated elevator ride and stair climb in First Person.

**Out of scope:** Top-Down art (unchanged, detailed 2D); interaction and
targeting (still `library/first-person.js`); textures, z-buffer, lighting
beyond one directional light plus ambient; ambient staff in FP (not drawn);
elevator door animation in the scene (see Known gaps).

---

## Architecture

All under `web/static/js/library/three-d/`. Everything except the canvas
call in `drawScene` is pure and DOM-free.

| File | Role |
|---|---|
| `core.js` | Column-major `Mat4` math, `cameraFromPose`, `projectPoint`, `shadeColor`, `buildDrawList`, `drawScene` |
| `room.js` | `buildRoom({width, depth, height, floorTint})`: floor, ceiling, four walls, wainscot, windows, light fixtures |
| `scene.js` | `buildFirstPersonScene(...)` assembles `{camera, placed}` per frame; `meshForStationKind`; the `ROOM_HEIGHT`, `BASE_EYE`, `UNIT_SCALE`, `NEAR`, `FAR`, `FLOOR_TINT` constants |
| `transitions.js` | Pure elevator/stairs state machine: `createTransition`, `updateTransition`, `transitionCamera`, `forceComplete` |
| `meshes/*.js` | One builder per object: `character.js` (also exports `box`), `bookshelf.js`, `station-box.js`, `coffee-machine.js`, `stairs.js`, `elevator.js` |

Wiring lives in `web/static/js/library-game.js`: `drawFirstPersonView`
builds the scene and calls `drawScene(ctx, camera, placed, {viewport,
light: FP_LIGHT, fog: FP_FOG})`, then draws the 2D HUD on top (dust,
vignette, interact flash, crosshair, minimap). `fpCameraParams` maps the
effect state to camera params. `first-person.js` is still the projection
used for `findInteractTarget`; it does not draw.

### Data shapes (JSDoc in `core.js`)

* `Vec3` = `[x, y, z]`.
* `Mesh` = `{vertices: Vec3[], faces: Face[]}`; `Face` = `{indices: number[],
  color: string}` with color `#rgb`, `#rrggbb` or `rgb(r,g,b)`. Faces are
  convex polygons (3+ indices), wound counter-clockwise seen from outside:
  the normal comes from the first three vertices, and a face lit from behind
  gets only the ambient term. There is no back-face culling.
* `Placement` = `{pos: Vec3, yaw, scale}`; `yaw` is radians about +Y,
  `scale` a number or `Vec3`. Order is scale, yaw, translate.
* `Placed` = `{mesh, placement}`.
* Camera = `{viewProj, position}` from `cameraFromPose(player, {eyeHeight,
  pitch, roll, fov, aspect, near, far})` where `player` is `{x, y, facing}`
  and `fov` is the vertical FOV in radians.

### World axes

World X = game x, world Z = game y, world Y = up. `facing` 0 is north and
increases clockwise; forward is `(sin f, 0, -cos f)` in (X, Y, Z). Meshes
are in model space (feet/base at y=0, centered on x/z) and are authored in
roughly metre units, then scaled into game pixels by `UNIT_SCALE`.

### Rendering model

`buildDrawList` transforms every vertex, **clips each face against the near
plane** (Sutherland-Hodgman in clip space, keeping `z + w >= 0`; a face
entirely behind it is dropped, one that straddles it is cut down to the part
in front), computes flat intensity `ambient + max(0, n . lightDir)` from the
*unclipped* world vertices, fogs toward `fog.color` between `fog.start` and
`fog.end` by face depth, and sorts back to front (painter's algorithm, face
depth = mean clip-space w of the clipped polygon's vertices).

Clipping is what lets the camera stand inside the room: the shell's floor,
ceiling and walls always straddle the near plane from in there. `drawScene`
fills each polygon and then strokes it in the same color, which covers the
antialiasing hairline that would otherwise show between two faces meeting on
a shared edge (visible as a grid over the tiled shell).

**Every First Person frame starts from a clean canvas.** `render` in
`library-game.js` calls `ctx.clearRect` and, in First Person, fills
`FP_BACKDROP` (= `FP_FOG.color`) over the whole frame before drawing —
outside the hallucination shake, so a shaken frame can't leave an unpainted
strip. Top-Down repaints every pixel through `drawFloor`; First Person draws
polygons only, so without this the canvas kept the previous frame: dust
smeared into streaks, the per-frame vignette compounded toward black, and
leftover Top-Down art showed through.

## Limitations

* **No z-buffer.** Sorting is per face, so large faces and interpenetrating
  or very close objects can mis-order. Keep objects as small boxes — and keep
  shell faces tiled (`room.js` emits every quad as a grid of at most
  `TILE` = 120 units, so no face is large enough for its single mean depth to
  sort it in front of the furniture standing on it).
* **Coplanar-offset rule.** Faces that share a plane tie in the sort and
  z-fight. Sit details a small distance proud of their backing surface
  (`room.js` uses `PROUD = 0.1`; meshes use about 0.01 in unit space).
* **Near-plane clipping is per face, not per scene.** A face is cut against
  the near plane only; there is no side/top clipping, so off-screen geometry
  is still rasterized by the canvas.

## Tunables

| Name | Where | Value |
|---|---|---|
| `UNIT_SCALE` | `scene.js` | 40 (unit mesh to game px) |
| `BASE_EYE` | `scene.js` | 60 (eye height, game px) |
| `ROOM_HEIGHT`, `NEAR`, `FAR` | `scene.js` | 300, 1, 2000 |
| `FLOOR_TINT` | `scene.js` | `#b08f5e` |
| `FP_BASE_VFOV_DEGREES` / `FP_SPRINT_VFOV_EXTRA` | `library-game.js` | 60 / +6 |
| `FP_LIGHT` | `library-game.js` | `{dir: [0.35, 1, 0.25], ambient: 0.5}` |
| `FP_FOG` / `FP_BACKDROP` | `library-game.js` | `{color: '#d8ccb0', start: 520, end: 1500}` / the same cream |
| `TILE` | `room.js` | 120 (longest edge of one shell face) |
| `FP_HEAD_BOB_AMP`, `FP_TILT_MAX` | `library-game.js` | 3.5 px, 0.035 rad (bob and roll) |

Generic station boxes use `BOX_HEIGHT` 40 and default 60x40 (`s.w`/`s.h`
override) in `scene.js`. Characters take a palette `{skin, hair, top,
bottom, angry?}` (`fpPaletteFor` in `library-game.js` derives it from the
patron design; Karen uses `FP_KAREN_PALETTE`).

## Floor transitions

Taking the Stairs or Elevator in First Person (`attemptInteract`) creates a
transition with `createTransition(kind, targetFloor)`; Top-Down still calls
`switchFloor` instantly. Input is frozen while `fpTransition` is set, and
leaving FP cancels it.

| Kind | Phases | Duration | Floor switch |
|---|---|---|---|
| `stairs` | `travel` then `done` | `STAIRS_DURATION` 1.5 s, `STAIRS_STEPS` 10 | end of travel |
| `elevator` | `doors-close`, `rise`, `doors-open`, `done` | 0.6 + 0.8 + 0.6 s | entering `doors-open` |

The state carries a one-shot `floorSwitched` flag set only on the state that
crosses the commit point; `commitFpTransition` in `library-game.js` reads it
once and calls `switchFloor`. `transitionCamera(state, pose)` returns
`{posOffset, doorOpen, floorSwitched}`; `drawFirstPersonView` multiplies the
offset by `UNIT_SCALE` and adds it to the camera. `forceComplete` jumps to
`done` (committing the floor if not yet done); the test hooks
`getActiveTransition` and `forceCompleteTransition` on
`window.__libraryGameTestHooks` expose this to Playwright.

## How to add a new object mesh

1. Write `meshes/<name>.js` exporting `build<Name>(opts)` that returns a
   `Mesh`. Compose it from `box(min, max, color)` (exported by
   `character.js`), offsetting indices when merging boxes (see `merge` in
   `bookshelf.js`). Model space: base at y=0, centered on x/z, about one
   unit tall per metre, front facing +Z.
2. Map the station kind to it in `scene.js`: add the entry to `BUILDERS`
   (`meshForStationKind(kind)` falls back to `buildStationBox` for unknown
   kinds). Builders are placed with `scale: UNIT_SCALE`, so no-arg
   builders work as is.
3. Offset detail faces slightly proud of their backing surface.
4. Add `meshes/<name>.test.js` (`node --test`): vertex/face counts, indices
   in range, bounds (base at y=0), and any colors that matter. Add a
   `scene.test.js` case if the mapping needs one.

## Known gaps

* `buildElevator` accepts `{doorOpen}` and `transitionCamera` returns
  `doorOpen`, but `buildFirstPersonScene` does not pass it, so only the
  camera animates during the ride.
* In FP only the Front Desk / Fines Counter queues (1st Floor) and Return
  Cart books are drawn as characters/props, as before.
* The visual constants above are plausible but untuned.

## Testing Plan

* `node --test` (`npm run test:unit`): `core.test.js`, `room.test.js`,
  `scene.test.js`, `transitions.test.js` and one test per mesh, all beside
  their modules. They need no DOM or canvas. Three of them guard what the
  renderer actually puts on screen, which face/vertex counts alone missed:
  `core.test.js` requires a near-plane-straddling face to be clipped (not
  dropped) with its shading unchanged, `room.test.js` requires no shell face
  to span more than one `TILE`, and `scene.test.js` samples a grid of screen
  points from five poses inside the room and requires the shell to paint
  every one of them.
* Playwright (`e2e/library-game.spec.js`): First Person tests for the
  Stairs and Elevator check that interacting starts an animated transition
  (via `getActiveTransition`) and that completing it (via
  `forceCompleteTransition`, so specs don't wait out the animation) switches
  floors. One pixel-level test covers the per-frame clear: with the
  simulation frozen (`freeze(true)`), the loop keeps rendering the same
  scene, so sampled canvas pixels must be identical ~35 frames later. Before
  the clear they darkened frame by frame.
* Visual tuning is manual: run `make dev` and look at `/library-game` in
  First Person.
