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
| `meshes/geom.js` | Shared primitives every mesh is built from: `emptyMesh`, `merge`, `box`, `prism`, `quad`, `translate`, `scaleMesh`, `scaleAbout` |
| `meshes/*.js` | One builder per object: `character.js`, `bookshelf.js`, `station-box.js`, `coffee-machine.js`, `stairs.js`, `elevator.js` |

### The character meshes

A First Person patron is built from **the very same design object the
top-down art draws** (`library/library-people.js`, Hospital Shift's
`anime-people.js` format), not from a reduced palette, so a patron's hair,
outfit, glasses, hat and age are the same in both cameras.

| File | Role |
|---|---|
| `meshes/character.js` | `buildCharacter(design, opts)`: metrics + palette, body and head merged at the chin, then the one and only age scale |
| `meshes/character-frame.js` | `FRAME` (the proportions, as heights above the floor), `ART`/`GROUND`/`artY` (the art's own coordinates and the lift onto the floor), `PX`, `CIRC`, `AGE_SCALE`, `KID_HEAD`, and `metricsFor(design)` |
| `meshes/character-palette.js` | `paletteFor(design)` resolves every colour the mesh needs (skin/hair tones, top, inner, apron, tie, trim, bottom, skirt, legs, shoes, eyes, brow, lips); optional slots are `null`, never `undefined` |
| `meshes/character-body.js` | `buildBody(design, palette, metrics)`: shoes, legs, lower garment, torso, sleeves, hands, neck — chin down |
| `meshes/character-head.js` | `buildHead(design, palette, metrics, {angry})`: skull, ears, face, hair, facial hair and headwear — chin up |

```js
buildCharacter(design, { angry: true })   // angry is an OPTION, not design data
```

`opts.angry` scowls (Karen's outburst); it is deliberately not part of the
design, since the design is shared with the 2D renderer. Nothing outside the
mesh layer builds a palette: callers pass the design straight through.
`scene.js`'s `characters` entries are `{x, y, design, angry?, floor?}`.

Karen is the one character with no roster entry (`findLibraryDesign('karen')`
is `null`), so `library-people.js` also exports `KAREN_DESIGN` — a design in
the same shape, carrying the four colours her old first-person palette had so
her 3D look is unchanged. `fpDesignFor` in `library-game.js` is the whole
mapping: `'karen'` to `KAREN_DESIGN`, anything else to `findLibraryDesign`.

#### Proportions

Everything is measured off the 2D art (`patron.js`/`patron-head.js`) in its
own pixels and divided by `UNIT_SCALE` (40) by `PX`, so a 3D patron is the
same chibi — **3.36 heads tall** — the top-down view draws.

**Art px are not heights.** `patron.js` draws a patron around a hip-height
origin and the figure stands `GROUND` = 7.1 px *below* it: `legPoses({hipY:
-19.6, thigh: 10.8, shin: 10.4})` puts the ankle at +1.6, `drawShoe` lays the
sole to ankle-local +5.5, and `groundShadow`'s contact ellipse sits at +7.
`artY(px) = (px + GROUND) * PX` is the one place art coordinates become scene
units above the floor, and `ART` holds the landmarks in the art's own numbers
so each can be checked against the 2D source; `character-body.js` and
`character-head.js` both write their dimensions as art px and convert through
it. (The frame was first measured as if the origin *were* the floor, which
cost 7.1 px off every landmark and out of the legs alone: the figure came out
3.03 heads tall with legs 29% of its height, against the art's 3.36 and 36%.)

| Constant | Where | Value (2D px) |
|---|---|---|
| `GROUND` / `artY` / `ART` | `character-frame.js` | 7.1 px below patron.js's origin; `artY` lifts art px onto the floor; `ART` = `shoeTop` -2.1, `hem` 19.4, `shoulder` 43.4, `chin` 44.4, `eye` 53.8, `crown` 66.25 |
| `FRAME` | `character-frame.js` | heights above the floor: `foot` 0, `shoeTop` 5.0, `hem` 26.5, `shoulder` 50.5, `chin` 51.5, `eye` 60.9, `crown` 73.35 |
| head half-width | `metricsFor` | 9 (adult), 9.2 (elder), 9.4 (kid) either side of the centre line |
| `halfTorso` / `halfShoulder` | `metricsFor` | 9.8 / 10.6, or 7.8 / 9.2 when `slim` (a skirt, or a kid) |
| `depth` | `metricsFor` | 6.6, or 5.6 when `slim` |
| `AGE_SCALE` | `character-frame.js` | kid 0.74, teen 0.95, elder 0.95, adult 1 |
| `KID_HEAD` | `character-frame.js` | 1.26 (a kid's head alone, about `FRAME.chin`) |
| `STOOP` / `DETAIL` | `character-head.js` | 0.05 units forward for an elder; 0.01 units proud for face detail |

So an adult is 73.35 px tall on a 21.85 px head (3.357 heads), legs are
26.5/73.35 = 36.1% of the height, and head ÷ shoulder stays 18/21.2 = 0.849 —
the frame fix moves y only, never x or z. `FRAME.eye` at 60.9 px also lands
within 1 px of `scene.js`'s `BASE_EYE` (60), so the player now meets a
patron's eye line instead of looking 6 px over it; no camera constant moves.

`CIRC = 1 / cos(pi/8)` is the one correction both halves share (the body
imports it from the frame): `geom.js`'s `prism` puts flat faces on the axes,
so an 8-sided ring of radius r is only `r*cos(pi/8)` wide. Ring radii are
scaled up by `CIRC` so the silhouette a player sees is the width that was
designed. `metricsFor` therefore returns the head prism's **radii**
(`headRX`, `headRZ`), not half-widths, and every part of the head — skull,
ears, face details, hair, hats — is placed as a multiple of them, so the whole
head widens together.

Wiring lives in `web/static/js/library-game.js`: `drawFirstPersonView`
builds the scene and calls `drawScene(ctx, camera, placed, {viewport,
light: FP_LIGHT, fog: FP_FOG})`, then draws the 2D HUD on top (dust,
vignette, interact flash, crosshair, minimap). `fpCameraParams` maps the
effect state to camera params. `first-person.js` is still the projection
used for `findInteractTarget`; it does not draw.

### Data shapes (JSDoc in `core.js`)

* `Vec3` = `[x, y, z]`.
* `Mesh` = `{vertices: Vec3[], faces: Face[]}`; `Face` = `{indices: number[],
  color: string, unlit?: boolean}` with color `#rgb`, `#rrggbb` or
  `rgb(r,g,b)`; `unlit` skips scene lighting (see Rendering model). Faces are
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
*unclipped* world vertices (a face marked `unlit` takes intensity 1 instead),
fogs toward `fog.color` between `fog.start` and
`fog.end` by face depth, and sorts back to front (painter's algorithm, face
depth = mean clip-space w of the clipped polygon's vertices).

Clipping is what lets the camera stand inside the room: the shell's floor,
ceiling and walls always straddle the near plane from in there. `drawScene`
fills each polygon and then strokes it in the same color, which covers the
antialiasing hairline that would otherwise show between two faces meeting on
a shared edge (visible as a grid over the tiled shell).

**`unlit` faces: one material, one rule — everything painted in a skin tone.**
Every face `buildHead` emits is `unlit`, and so are the body's skin-toned
parts: the hands, the neck and bare legs. Clothing keeps its flat design
colours and stays lit. The rule is the material, not the mesh: `skinTones()`
already bakes skin/shade/deep out of one hex exactly as the 2D paints them,
and the scene light points down, so lighting a forward-facing skin surface
again only greys it out. Fog still applies to an `unlit` face, so a distant
patron still recedes into the haze.

The earlier rule — the whole head `unlit`, no body face ever — split that
material in half. The hands use `palette.skin.skin`, the *same hex* as the
skull's upper bands, so one colour rendered `rgb(239,196,159)` on the face
and `rgb(174,143,116)` on the hands: a 27% step across the wrist, and the
same step from chin to neck. Checked by eye at first-person distance against
the same patron in Top-Down, that read as a seam rather than as hands in
shadow. The alternative — dropping `unlit` from the head's skin and leaving
it only on `buildFace`'s detail quads — was rejected because it greys out the
face, which is what `unlit` exists to prevent. Bare legs stay flat under
`unlit` because the 2D paints a bare leg as one fill with a thin crease.
`character-body.test.js` pins the rule: a body face is `unlit` if and only if
its colour is one of that design's skin tones.

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
override) in `scene.js`. Characters take `{x, y, design, angry?, floor?}`
(`fpDesignFor` in `library-game.js` looks the design up; Karen uses
`KAREN_DESIGN`); their own proportion constants are in the table under
**The character meshes**.

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
   `Mesh`. Compose it from `meshes/geom.js`'s primitives — `box(min, max,
   color)`, `prism(rings, sides, capTop, capBottom)`, `quad(points, color)`
   — and `merge(target, part)`, which offsets the indices for you. Model
   space: base at y=0, centered on x/z, about one unit tall per metre, front
   facing +Z.
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
* The visual constants above are plausible but untuned; the character
  proportions are the exception — they are measured off the 2D art.
* The face budget (`character.test.js`, ceiling 340) now has less headroom:
  the heaviest shipped design is 320 faces, up from 278, after the sleeve
  gained three y bands per side and each eye gained a pupil and an
  unconditional lash line. The ceiling still guards runaway growth, but a
  future design stacking headwear would reach it sooner.
* Nothing tests the head's attachments against the head's own silhouette:
  ears, hats, earrings and headphones are placed off `headRX`/`headRZ` by
  convention only, so one of them could be decoupled from the skull and the
  suite would stay green.

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
* Visual tuning is manual: run `make dev` (on a port other than 8080, which
  is a developer's own server) and look at `/library-game` in First Person
  beside the same patrons in Top-Down. That comparison is what settled the
  `unlit` set above; `character.test.js` covers the proportions it cannot.
