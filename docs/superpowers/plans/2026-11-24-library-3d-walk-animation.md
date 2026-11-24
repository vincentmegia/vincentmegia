# Library Shift First Person Walk Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every First Person character a walk — swinging legs and arms plus their own whole-body gait — so Library Shift's 3D staff walk the way their 2D sprites do instead of gliding.

**Architecture:** The 3D core gains one additive concept: a mesh may declare **joints** as vertex ranges with a pivot, and a placement may pose them. `buildDrawList` already maps every vertex into world space exactly once (`core.js:357`), and `merge` gives each limb box its own vertices, so a joint is a contiguous vertex range — no skinning, no shared-vertex problem, one extra rotation per vertex. A new pure gait module turns `(character, t, walking, dir)` into those joint angles plus the body rhythm, reusing `staff-kit.js`'s `walkCycle` and `walk-styles.js`'s per-character constants so the two cameras cannot drift apart.

**Tech Stack:** Vanilla ES modules, no bundler, no dependencies. `node --test` for the pure modules; Playwright for the browser behaviour.

**Spec:** No separate design doc — the user opted out of the design round ("just make a unique walking animation") after choosing the target ("as the 2D ones") and leaving the approach to me. This plan's Architecture and Global Constraints are the spec; the brainstorming conversation's option C is the approach.

## Global Constraints

- No new dependencies, no build step, no WebGL. The 3D renderer stays canvas-2D software rendering.
- `three-d/core.js`, `three-d/meshes/*.js` and the new gait module are **pure logic modules** (`docs/skills/javascript/SKILL.md`): no DOM, no canvas, no clock, all context in arguments.
- **Additive only:** a mesh with no `joints`, or a placement with no `jointPose`, must draw byte-for-byte as it does today. Every static patron, prop and room face depends on this.
- One rhythm, two cameras: leg and arm swing come from `staff-kit.js`'s `walkCycle(t, freq, walking)`, and each character's body gait from the same constants as `walk-styles.js`'s `WALK_STYLES`. No second copy of either.
- Walk frequencies per character stay exactly the 2D's: guard 5, volunteer 6, libJanitor 3.2, libShelver 9, libStoryteller 2.6, libDirector 4.2, libArchivist 2.2 (`walk-styles.js`).
- Characters are built feet-at-y-0, facing +Z (`character-body.js` header). Joint pivots are in the same model space, before `metrics.ageScale`.
- The user's dev server owns `:8080` — never kill or restart it. Playwright runs get their own `--output` dir.

## Review Focus

1. **A standing character must not move.** Queued patrons, Karen and every ghost are drawn by the same `buildCharacter` mesh; `walking: false` must leave their geometry exactly as today, not at a mid-stride pose. *Pinned in Task 3.*
2. **Min-jun's textured faces.** His mesh wears his 2D drawing as a texture (`paintMinjun*`), and `pushTexturedFace` reads world vertices. A joint rotation must not tear his art or flip a UV. *Pinned in Task 5.*
3. **A face must not span two joints.** If one face indexes a thigh vertex and a torso vertex, posing the joint stretches it into a spike. *Pinned in Task 2.*
4. **Back-face culling and near-plane clipping after posing.** `face.cull` and `clipNear` use the world vertices, so a swung leg's normal must come from its posed position, not its rest position, or limbs vanish at some angles. *Pinned in Task 1.*
5. **Eight walkers at 60 fps.** The per-vertex joint lookup runs for every character every frame; a per-vertex search over a joint list would be ~8 × 400 × 7 comparisons a frame. *Pinned in Task 1 (precomputed per-vertex index).*

---

### Task 1: Joints in the 3D core

**Files:**
- Modify: `web/static/js/library/three-d/core.js` (`modelPoint` ~line 246, the world map at ~line 357)
- Test: `web/static/js/library/three-d/core.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - A mesh may carry `joints: {name: string, pivot: [x, y, z], from: number, to: number}[]` (vertex index range `[from, to)`), and `vertexJoint: (number|null)[]` — one entry per vertex, the index into `joints`, precomputed by `indexJoints(mesh)`.
  - `indexJoints(mesh)` → the same mesh with `vertexJoint` filled in; idempotent, safe on a frozen/cached mesh (it only adds the field once).
  - A placement may carry `jointPose: {[name: string]: {rotX?: number, rotZ?: number}}` (radians, about the joint's pivot) and the body rhythm `lift?: number, roll?: number, lean?: number, squash?: [sx, sy]` — all optional, all no-ops when absent.
- Produces for Task 3/5: `posedPoint(vertex, jointIndex, mesh, jointPose)` is internal; callers only set the fields above.

- [ ] **Step 1: Write the failing tests**

```js
// A two-box mesh: vertices 0..7 are the "leg", 8..15 the torso.
test('a mesh with no joints draws exactly as before', () => {
  // buildDrawList output deep-equals the same call on a mesh without the fields.
});
test('posing a joint rotates only its own vertex range, about its pivot', () => {
  // jointPose {leg: {rotX: 0.3}} moves the leg's vertices and leaves the torso's identical.
});
test('a joint pivot stays fixed under its own rotation', () => {
  // the vertex at the pivot maps to the same world point posed and unposed.
});
test('the body rhythm lifts, rolls, leans and squashes about the feet', () => {
  // lift/roll/lean/squash move the top of a box and leave y=0 vertices on the floor.
});
test('face normals come from posed world vertices', () => {   // Review Focus 4
  // a face whose rest normal faces away from the camera but whose posed normal
  // faces it is NOT culled (and the reverse is).
});
test('indexJoints precomputes one entry per vertex and is idempotent', () => {   // Review Focus 5
  // vertexJoint.length === vertices.length; calling it twice changes nothing.
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test web/static/js/library/three-d/core.test.js`
Expected: FAIL — `indexJoints` is not exported; the posing tests see unmoved vertices.

- [ ] **Step 3: Implement `indexJoints(mesh)` and joint posing in `core.js`**

In `buildDrawList`, replace the world map with one that poses first: for each vertex, if its `vertexJoint` names a joint the placement's `jointPose` poses, rotate it about that joint's pivot (X then Z) in model space; then apply the body rhythm (lift, lean shear, roll, squash — about the feet, i.e. model y = 0, mirroring `walk-styles.js`'s `applyWalk` order) and finally the existing `modelPoint`. Everything downstream keeps reading `world`, so culling, clipping, shading and texturing stay correct by construction (Review Focus 4).

- [ ] **Step 4: Run the full 3D suite**

Run: `node --test web/static/js/library/three-d/*.test.js web/static/js/library/three-d/meshes/*.test.js`
Expected: PASS, every existing suite included — the additive guarantee.

- [ ] **Step 5: Commit**

```bash
git add web/static/js/library/three-d/core.js web/static/js/library/three-d/core.test.js
git commit -m "library-fp: meshes can declare joints and placements can pose them"
```

---

### Task 2: The character mesh declares its limbs

**Files:**
- Modify: `web/static/js/library/three-d/meshes/character-body.js` (`shoes` ~25, `legs` ~46, `arms` ~172, `buildBody` ~214)
- Modify: `web/static/js/library/three-d/meshes/character.js` (`buildCharacter` ~31)
- Test: `web/static/js/library/three-d/meshes/character.test.js`

**Interfaces:**
- Consumes: Task 1's mesh `joints` shape and `indexJoints`.
- Produces: `buildCharacter(design, opts)`'s mesh carries six joints, named `'leg.left'`, `'leg.right'`, `'arm.left'`, `'arm.right'` plus `'foot.left'`, `'foot.right'`, each with its pivot: legs and feet pivot at the hip (`[±legX, FRAME.hem, 0]`), arms at the shoulder (`[±shoulderX, FRAME.shoulder, 0]`). A shoe's range is folded into its leg's joint unless a separate ankle is needed; if folded, only four joints exist and the test asserts four.

- [ ] **Step 1: Write the failing tests**

```js
test('a built character declares a joint per limb, pivoted at hip and shoulder', () => {
  // joints' names, and each pivot's y equals FRAME.hem / FRAME.shoulder times ageScale.
});
test('no face spans two joints', () => {   // Review Focus 3
  // for every face, the set of its vertices' vertexJoint values has size 1.
});
test('every leg, shoe, hand and sleeve vertex belongs to a joint, and the torso to none', () => {
  // a vertex below FRAME.hem is in a leg joint; the neck's are unjointed.
});
test('the joint ranges survive the mesh cache', () => {
  // two buildCharacter calls with the same design return the same posed-capable mesh.
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test web/static/js/library/three-d/meshes/character.test.js`
Expected: FAIL — the mesh has no `joints`.

- [ ] **Step 3: Record each limb's vertex range as it is merged**

`buildBody` already merges in a fixed order (shoes, legs, garment, torso, front layers, arms, neck). Capture `mesh.vertices.length` before and after each limb's own merge and build the `joints` array from those bounds, per side — which requires `shoes`, `legs` and `arms` to merge one side at a time rather than both in one call. `buildCharacter` then scales the pivots by `metrics.ageScale` alongside `scaleMesh` and calls `indexJoints` once before caching.

- [ ] **Step 4: Run the mesh suites**

Run: `node --test web/static/js/library/three-d/meshes/*.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/static/js/library/three-d/meshes/character-body.js web/static/js/library/three-d/meshes/character.js web/static/js/library/three-d/meshes/character.test.js
git commit -m "library-fp: the 3D humanoid declares hip and shoulder joints"
```

---

### Task 3: The gait module

**Files:**
- Create: `web/static/js/library/three-d/walk-3d.js`
- Test: `web/static/js/library/three-d/walk-3d.test.js`

**Interfaces:**
- Consumes: `walkCycle` from `library/staff-kit.js`; the per-character constants of `library/walk-styles.js`.
- Produces: `walk3dPose(key, {t, walking, dir})` → `{jointPose: {...}, lift: number, roll: number, lean: number, squash: [number, number]}`, ready to spread onto a placement; and `GAIT_3D`, the per-character table (frequency, stride swing, knee bend, arm swing, and the body rhythm's amplitudes), keyed as `WALK_STYLES` is.

- [ ] **Step 1: Write the failing tests**

```js
test('a standing character has an identity pose', () => {   // Review Focus 1
  const p = walk3dPose('guard', { t: 3.21, walking: false, dir: 1 });
  assert.deepEqual(p.jointPose, {});
  assert.equal(p.lift, 0);
  assert.equal(p.roll, 0);
  assert.deepEqual(p.squash, [1, 1]);
});
test('the legs swing in opposite phase, and the arms oppose the legs', () => {
  // at a phase where leg.left swings forward, leg.right swings back and arm.left back.
});
test('each character walks at its own 2D frequency', () => {
  // the first leg-forward peak for guard (freq 5) comes before libArchivist's (2.2).
});
test('every walk style in the 2D table has a 3D gait', () => {
  assert.deepEqual(Object.keys(GAIT_3D).sort(), Object.keys(WALK_STYLES).sort());
});
test('the volunteer skips: lift peaks and the body squashes on landing', () => {
  // squash[1] < 1 at the moment lift returns to 0 — the 2D's land = 1 - hop.
});
test('an unknown key gets a plain neutral walk rather than nothing', () => {
  // a patron with no style still swings legs; only the body rhythm is flat.
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test web/static/js/library/three-d/walk-3d.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `GAIT_3D` and `walk3dPose(key, {t, walking, dir})`**

Each entry carries the 2D's frequency and the body amplitudes read off `WALK_STYLES`' own expressions (guard: `dy -3·|sin|`, `rot 0.02·sin`; volunteer: hop² × 9 with the landing squash; janitor `1.5·|cos|`, `rot 0.07`; shelver `2·|sin|` with `lean 0.1·dir`; storyteller `3·|sin 2c|`, `rot 0.09` and the 4-second twirl; director `1.6·|sin|`, `rot 0.03`; archivist `1.2·|sin|`, `rot 0.015`, `lean 0.06·dir`). Lift is in **art px** in the 2D and must be converted to scene units (`artY`-style, `PX`) — state the conversion in a comment. Joint angles come from `walkCycle(t, freq, walking)`: hip swing from `stride`, knee from the same phase a quarter-cycle later as `legPoses` does, arms in opposite phase at a smaller amplitude.

- [ ] **Step 4: Run it, then the whole unit suite**

Run: `node --test web/static/js/library/three-d/walk-3d.test.js` → PASS.
Run: `npm run test:unit` → PASS (1400+ tests).

- [ ] **Step 5: Commit**

```bash
git add web/static/js/library/three-d/walk-3d.js web/static/js/library/three-d/walk-3d.test.js
git commit -m "library-fp: each character's 3D gait, from the same cycle the 2D walks"
```

---

### Task 4: Wire the gait into the scene

**Files:**
- Modify: `web/static/js/library/three-d/scene.js` (character placement ~line 209)
- Modify: `web/static/js/library-game.js` (the characters list, ~line 5327 and ~5339)
- Test: `web/static/js/library/three-d/scene.test.js`, `e2e/library-game.spec.js`

**Interfaces:**
- Consumes: Task 3's `walk3dPose`; Task 1's placement fields.
- Produces: a scene character may carry `walk: {key: string, t: number, walking: boolean, dir: number}`; `buildScene` spreads `walk3dPose(...)` onto that character's placement. A character without `walk` places exactly as today.

- [ ] **Step 1: Write the failing tests**

```js
// scene.test.js
test('a walking character is placed with a posed gait, a standing one is not', () => {
  // placement.jointPose is non-empty for walk.walking true, absent/empty for false.
});
```

```js
// library-game.spec.js, in First Person, frozen and stepped
test('in First Person, a patrolling staff member swings their legs', async ({ page }) => {
  // __libraryGameTestHooks.getFpCharacterPose(staffKey) over several stepped
  // frames: leg.left's rotX changes sign across the cycle while the walker moves.
});
test('in First Person, a queued patron stands still', async ({ page }) => {
  // the same hook reports no jointPose for a front-desk patron across frames.
});
```

Add `getFpCharacterPose(key)` to `window.__libraryGameTestHooks`, reporting the placement a named character got this frame.

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test web/static/js/library/three-d/scene.test.js`, then the two specs.
Expected: FAIL — no `walk` handling, no hook.

- [ ] **Step 3: Pass each walker's walk state, and pose it in the scene**

In `library-game.js`, the ambient-staff branch already computes `walking` and `t` for Min-jun exactly as `drawAmbient` does (`fpMinjunFor`: `a.pause <= 0 && moveTarget?.staffKey !== a.key`, `performance.now() / 1000 + a.phase`) — lift that into a small helper and give every walker a `walk` entry with its `staffKey`, that `t`, `walking`, and `dir`. Queued patrons, Karen and ghosts get none. In `scene.js`, spread `walk3dPose(c.walk.key, c.walk)` onto the placement when `c.walk` is present.

- [ ] **Step 4: Run the specs and the First Person suite**

Run: the two new specs, then `-g "First Person"` on Chromium and WebKit.
Expected: PASS, with the collision and camera-parity specs unchanged.

- [ ] **Step 5: Commit, with the docs**

Update `docs/features/library-first-person-3d.md` (a new "Walk animation" section: joints, the gait module, the shared cycle, and that standing characters are unposed) and `docs/features/library-game.md`'s First Person scope line.

```bash
git add web/static/js/library/three-d/scene.js web/static/js/library-game.js web/static/js/library/three-d/scene.test.js e2e/library-game.spec.js docs/features/library-first-person-3d.md docs/features/library-game.md
git commit -m "library-fp: patrolling staff walk in First Person, each with their own gait"
```

---

### Task 5: Min-jun walks too

**Files:**
- Modify: `web/static/js/library/three-d/meshes/minjun-body.js` (`buildArms` ~236, `buildMinjunBody` ~272)
- Modify: `web/static/js/library/three-d/scene.js` (`characterMesh` ~148)
- Test: `web/static/js/library/three-d/meshes/minjun.test.js`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: Min-jun's mesh declares the same joint names as the generic humanoid, so `walk3dPose` poses him through the identical path.

Min-jun is the one character whose mesh wears his own 2D drawing as a texture on its front, so his legs are **painted**, not shaded boxes. Pose his joints and the art rides along with the geometry — which is what we want, but it is also the one place a joint rotation can tear a textured face (Review Focus 2).

- [ ] **Step 1: Write the failing tests**

```js
test('Min-jun declares leg and arm joints like the generic humanoid', () => {
  // the same four (or six) names Task 2 produces.
});
test('no textured face spans two joints', () => {   // Review Focus 2
  // every face with a `texture` has one distinct vertexJoint across its vertices.
});
test('his posed legs keep their uv box', () => {
  // posing changes world vertices, never face.uv.
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test web/static/js/library/three-d/meshes/minjun.test.js`
Expected: FAIL — no joints on his mesh.

- [ ] **Step 3: Give his body the same joints**

Record his leg and arm vertex ranges as `buildMinjunBody` merges them, with pivots at his own hip and shoulder heights (his frame, not the generic one). If a textured face turns out to span his hip line, split that face at the hem rather than widening the joint — the split belongs in his mesh, not in the core.

- [ ] **Step 4: Run his suite, the unit suite, then the First Person specs**

Run: `node --test .../minjun.test.js` → PASS; `npm run test:unit` → PASS; `-g "First Person"` on both browsers → PASS.

- [ ] **Step 5: Commit, with his doc note**

Update `library-first-person-3d.md`'s Min-jun section: his joints are the generic names, so one gait table drives both him and everyone else.

```bash
git add web/static/js/library/three-d/meshes/minjun-body.js web/static/js/library/three-d/scene.js web/static/js/library/three-d/meshes/minjun.test.js docs/features/library-first-person-3d.md
git commit -m "library-fp: Min-jun walks on the same joints as everyone else"
```
