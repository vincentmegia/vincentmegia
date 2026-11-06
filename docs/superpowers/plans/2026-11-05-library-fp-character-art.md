# Library Shift FP Character Art Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Library Shift's First Person characters read as the same people as their Top-Down 2D art — same proportions, palette, baked shading and silhouette — while staying 3D geometry.

**Architecture:** Replace the four-colour palette flattening with the patron design object itself, rebuild `buildCharacter` at the 2D art's chibi proportions (3.0 heads tall, not 6.5) out of new `geom.js` primitives, and add one optional `unlit` flag to `core.js` so baked-shade surfaces opt out of scene lighting. The builder splits into frame/palette/body/head modules mirroring the 2D side's `patron.js` / `patron-head.js` seam.

**Tech Stack:** Plain ES modules, no dependencies. `node --test` (`npm run test:unit`). The `three-d/` layer stays pure and DOM-free.

**Spec:** `docs/superpowers/specs/2026-11-05-library-fp-character-art-design.md`

## Global Constraints

- `web/static/js/library/three-d/**` stays **pure and DOM-free** — no canvas, no `document`, no imports that reach DOM-drawing code. `shared/people.js` is pure and may be imported.
- All mesh faces are **convex polygons wound counter-clockwise seen from outside**; the normal comes from the first three vertices. There is no back-face culling.
- Model space: **feet at y = 0, centred on x/z, facing +Z**, roughly one unit per metre. `UNIT_SCALE` is **40** game px per unit; `PX = 1/40`.
- Every face colour must be a string `core.js`'s `parseColor` accepts: `#rgb`, `#rrggbb` or `rgb(r,g,b)`. **Never `undefined`, `null` or a `#undefined` built by string concatenation.**
- Coplanar faces z-fight: sit detail faces about **0.01 unit** proud of their backing surface.
- Tests live beside their module as `<name>.test.js` and run under `node --test` with no DOM.
- `docs/features/library-first-person-3d.md` is updated in the **same commit** as the behaviour change that makes it stale (Task 8), per `CLAUDE.md`.
- Run `npm run test:unit` before every commit. Do not run `make check` against a `DATABASE_URL` that points at production.

## Review Focus

The spec implies these, but no task's main deliverable exercises them. Each line's test is assigned to the task that owns the code.

1. **A design field that is explicitly `null`** — `libScooterKid` and one other have `outfit.legs: null`. `??` treats null as absent, but a null reaching `shadeColor` throws. → Task 4.
2. **All 66 shipped designs must build** — any one of them throwing breaks the queue render for every player. → Task 7.
3. **An unrecognised `hair.back` or `extras` key** must be ignored, not throw — designs are data and will gain new values. → Task 6.
4. **A sparse, hand-written design** (Karen's `KAREN_DESIGN`, which has no `trinkets`, `prop` or most `extras`) must build. → Task 8.
5. **Every face colour valid for `parseColor`** across all 66 designs — the failure mode that silently paints a character black. → Task 7.

---

### Task 1: `geom.js` mesh primitives

**Files:**
- Create: `web/static/js/library/three-d/meshes/geom.js`
- Create: `web/static/js/library/three-d/meshes/geom.test.js`
- Modify: `web/static/js/library/three-d/meshes/character.js` (remove `box`, re-export nothing)
- Modify: `web/static/js/library/three-d/meshes/bookshelf.js:5`, `stairs.js:3`, `station-box.js:3`, `elevator.js:4`, `coffee-machine.js:3` (import `box` from `./geom.js`)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `emptyMesh(): Mesh` — `{vertices: [], faces: []}`
  - `merge(target: Mesh, part: Mesh): Mesh` — appends `part` with indices offset; mutates and returns `target`
  - `box(min: Vec3, max: Vec3, color: string, tint?: {front?, back?, right?, left?, top?, bottom?}): Mesh` — today's 8-vertex/6-quad box and winding; each `tint` entry overrides that face's colour, omitted entries fall back to `color`
  - `prism(rings: {y, rx, rz, color}[], sides: number, capTop?: string|null, capBottom?: string|null): Mesh` — vertical stack of N-gon rings; the side band between two rings takes the **upper** ring's colour; caps added only when a colour is given
  - `quad(points: Vec3[], color: string, opts?: {unlit?: boolean}): Mesh` — one 4-vertex face
  - `translate(mesh: Mesh, offset: Vec3): Mesh` — new mesh, shares `faces`
  - `scaleMesh(mesh: Mesh, k: number): Mesh` — new mesh, shares `faces`
  - `scaleAbout(mesh: Mesh, k: number, pivotY: number): Mesh` — uniform scale about the plane y = `pivotY`; new mesh, shares `faces`

- [ ] **Step 1: Write the failing tests** in `geom.test.js`

```js
test('box has 8 vertices and 6 quad faces', …)            // faces.length === 6, every face 4 indices
test('box tint overrides only the named faces', …)        // box(…, '#111111', {top: '#222222'})
                                                          // → exactly one face '#222222', five '#111111'
test('box faces wind counter-clockwise seen from outside', …)
                                                          // for each face, normal from first 3 vertices
                                                          // dotted with (faceCentroid - boxCentre) > 0
test('prism ring count drives vertices and side faces', …)// prism(3 rings, 8 sides) → 24 vertices,
                                                          // 16 side faces, no caps when both null
test('prism adds caps when colours are given', …)         // same call with caps → 18 faces
test('prism side band takes the upper ring colour', …)
test('prism faces wind counter-clockwise seen from outside', …)
test('quad marks the face unlit when asked', …)           // faces[0].unlit === true
test('translate and scaleMesh do not mutate the source', …)
test('scaleAbout keeps the pivot plane fixed', …)         // a vertex at y === pivotY stays at pivotY;
                                                          // one at pivotY + 1 moves to pivotY + k
test('every index is in range for box and prism', …)
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test web/static/js/library/three-d/meshes/geom.test.js`
Expected: FAIL — cannot find module `./geom.js`

- [ ] **Step 3: Implement `geom.js`**

Move `box` verbatim from `character.js` (keep its `index = x + 2*y + 4*z` vertex order and its six quads), then add the `tint` lookup. For `prism`, place ring vertex `i` at angle `(i / sides) * 2π + π / sides` so an even `sides` gives a flat front face toward +Z; emit each side band as `[lo+i, lo+j, hi+j, hi+i]`. Caps: top ring in order, bottom ring reversed (with this angle formula that is what points each cap outward).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test web/static/js/library/three-d/meshes/geom.test.js`
Expected: PASS

- [ ] **Step 5: Repoint the five `box` importers and remove `box` from `character.js`**

- [ ] **Step 6: Run the whole unit suite**

Run: `npm run test:unit`
Expected: PASS — `bookshelf`, `stairs`, `elevator`, `station-box`, `coffee-machine` tests unchanged and green

- [ ] **Step 7: Commit**

```bash
git add web/static/js/library/three-d/meshes/
git commit -m "three-d: extract mesh primitives into geom.js"
```

---

### Task 2: the `unlit` face flag in `core.js`

**Files:**
- Modify: `web/static/js/library/three-d/core.js` (the `Face` typedef, and `buildDrawList`'s intensity line)
- Modify: `web/static/js/library/three-d/core.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `Face` gains optional `unlit: boolean`. When true the face renders at intensity `1` regardless of light direction. Fog still applies.

- [ ] **Step 1: Write the failing tests** in `core.test.js`

```js
test('an unlit face ignores light direction', …)
  // same single-face mesh built twice with opposite light.dir;
  // unlit → identical colour, lit → different colour
test('an unlit face still fogs with depth', …)
  // unlit face near vs far under the same fog → different colours,
  // the far one closer to fog.color
test('faces without the flag are unchanged', …)
  // a pre-existing mesh's draw list is byte-identical to before
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test web/static/js/library/three-d/core.test.js`
Expected: FAIL — the unlit face shades with the light

- [ ] **Step 3: Implement the flag in `buildDrawList`**

```js
const intensity = face.unlit ? 1 : light.ambient + Math.max(0, dot(n, ld));
```

Update the `Face` typedef comment to `{indices, color, unlit?}`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test web/static/js/library/three-d/core.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/static/js/library/three-d/core.js web/static/js/library/three-d/core.test.js
git commit -m "three-d: let a face opt out of scene lighting"
```

---

### Task 3: move the tone helpers to `shared/people.js`

**Files:**
- Modify: `web/static/js/shared/people.js` (add two exports)
- Modify: `web/static/js/library/patron-head.js:19-30` (delete both, import them instead)
- Modify: `web/static/js/library/patron.test.js:5` (import `hairTones` from `../shared/people.js`)
- Create/Modify: a test for the two helpers beside `shared/people.js`

**Interfaces:**
- Consumes: `shadeColor` (already in `shared/people.js`).
- Produces:
  - `hairTones(colour: string): {base, mid, deep, shine}` — `shadeColor` at `0`, `0.18`, `-0.32`, `0.45`
  - `skinTones(skin: string): {skin, shade, deep}` — `shadeColor` at `0`, `-0.1`, `-0.22`

Both bodies move **verbatim** from `patron-head.js`. The 2D output must not change.

- [ ] **Step 1: Write the failing tests**

```js
test('hairTones derives four tones from one colour', …)  // exact values for '#6a3e2a'
test('skinTones derives three tones from one colour', …) // exact values for '#efc49f'
```

Take the expected strings from the current `patron-head.js` implementation so a changed constant fails loudly.

- [ ] **Step 2: Run to verify they fail**

Run: `node --test web/static/js/shared/people.test.js`
Expected: FAIL — not exported

- [ ] **Step 3: Move both functions to `shared/people.js` and re-point `patron-head.js` and `patron.test.js`**

`patron-head.js` keeps re-exporting `hairTones` only if something still imports it from there; otherwise delete the re-export.

- [ ] **Step 4: Run the whole unit suite**

Run: `npm run test:unit`
Expected: PASS — `patron.test.js`'s existing `hairTones` assertion still green

- [ ] **Step 5: Commit**

```bash
git add web/static/js/shared/ web/static/js/library/patron-head.js web/static/js/library/patron.test.js
git commit -m "people: share hairTones/skinTones between the 2D and 3D renderers"
```

---

### Task 4: the frame and the palette

**Files:**
- Create: `web/static/js/library/three-d/meshes/character-frame.js`
- Create: `web/static/js/library/three-d/meshes/character-palette.js`
- Create: `web/static/js/library/three-d/meshes/character-palette.test.js`

**Interfaces:**
- Consumes: `hairTones`, `skinTones`, `shadeColor` from Task 3.
- Produces:
  - `FRAME` (`character-frame.js`): `{foot: 0, shoeTop: 4.5/40, hem: 19.4/40, shoulder: 43.4/40, chin: 44.4/40, eye: 53.8/40, crown: 66.3/40}`
  - `AGE_SCALE = {kid: 0.74, teen: 0.95, elder: 0.95, adult: 1}`, `KID_HEAD = 1.26`
  - `metricsFor(design): {kid, elder, slim, ageScale, headScale, halfTorso, halfShoulder, headRX, headRZ, depth}` where `slim = Boolean(design.outfit?.skirt) || age === 'kid'`; `halfTorso = (slim ? 7.8 : 9.8)/40`; `halfShoulder = (slim ? 9.2 : 10.6)/40`; `headRX = (kid ? 9.4 : elder ? 9.2 : 9)/40 * CIRC`; `headRZ = headRX * 0.94`, where `CIRC = 1/Math.cos(Math.PI/8)`. An 8-gon's widest points sit at `cos(pi/8)` of its radius, so the prism radius must exceed the designed half-width for the silhouette to equal it — the compensation `character-body.js` already applies to the torso. Without it the head renders 7.6% narrow and head ÷ shoulder lands at 0.784, below the contract's floor; `depth = (slim ? 5.6 : 6.6)/40`; `headScale = kid ? KID_HEAD : 1`
  - `paletteFor(design)` (`character-palette.js`): `{skin: {skin, shade, deep}, hair: {base, mid, deep, shine}, top, inner, apron, tie, trim, bottom, skirt, legs, shoes, eyes, brow, lips}`

Fallbacks, matching today's `fpPaletteFor` and the 2D renderer: `skin` `#efc49f`, `hair.color` `#2a2030`, `top` `#6a7a8a`, `bottom` `outfit.bottom ?? outfit.skirt ?? outfit.inner ?? '#3a3a48'`, `shoes` `#2a2226`, `eyes.color` `#2e2a3a`. `inner` is `outfit.inner ?? outfit.shirt ?? null`. `trim` is `outfit.trim ?? outfit.print ?? outfit.stripe ?? null`. `brow` is `shadeColor(hairColour, -0.1)`. `lips` is `'#d8707e'` when `eyes.lashes`, else `shadeColor(skin, -0.38)`. Optional slots (`inner`, `apron`, `tie`, `trim`, `skirt`, `legs`) are `null` when absent — **never `undefined`**, so callers test them with a plain truthiness check.

- [ ] **Step 1: Write the failing tests** in `character-palette.test.js`

```js
test('metricsFor marks a skirted design slim', …)
test('metricsFor marks a kid slim and scales the head', …) // headScale === 1.26, ageScale === 0.74
test('metricsFor uses the elder head width', …)            // halfHeadX === 9.2/40
test('paletteFor keeps every outfit colour', …)            // a design with top/inner/tie/trim/shoes/legs
                                                           // → each value present on the palette
test('paletteFor derives hair and skin tones', …)          // four hair tones, three skin tones, all distinct
test('paletteFor turns a null outfit field into null, not a bad colour', …)
                                                           // REVIEW FOCUS 1: {legs: null} → palette.legs === null,
                                                           // and no palette value is undefined or contains 'null'
test('paletteFor falls back for a design missing outfit and hair', …)
                                                           // paletteFor({}) throws nothing; every colour slot
                                                           // that is not null matches /^#[0-9a-f]{6}$/i
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test web/static/js/library/three-d/meshes/character-palette.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `character-frame.js` and `character-palette.js`**

- [ ] **Step 4: Run to verify they pass**

Run: `node --test web/static/js/library/three-d/meshes/character-palette.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/static/js/library/three-d/meshes/character-frame.js web/static/js/library/three-d/meshes/character-palette.js web/static/js/library/three-d/meshes/character-palette.test.js
git commit -m "three-d: resolve a patron design's full palette and frame metrics"
```

---

### Task 5: the body

**Files:**
- Create: `web/static/js/library/three-d/meshes/character-body.js`
- Create: `web/static/js/library/three-d/meshes/character-body.test.js`

**Interfaces:**
- Consumes: `geom.js` (Task 1); `FRAME`, `metricsFor` (Task 4); `paletteFor`'s return shape (Task 4).
- Produces: `buildBody(design, palette, metrics): Mesh` — feet at y = 0, top of the neck at `FRAME.chin`. **No age scaling** — Task 7 applies it.

Geometry, per the spec's design-driven table. Lit normally (no `unlit`):

| Part | Build |
|---|---|
| Shoes | one box per foot, wider than the leg and pushed forward in +Z, `palette.shoes`, from `FRAME.foot` to `FRAME.shoeTop` |
| Legs | one box per leg, `FRAME.shoeTop` → `FRAME.hem`, colour `palette.legs ?? (palette.skirt ? skin.skin lightened : palette.bottom)` |
| Lower garment | when `palette.skirt`, a `prism` flared wide at `FRAME.hem` and narrow at the waist; otherwise a box in `palette.bottom` |
| Torso | a 4-ring `prism`, `sides: 8`, banded dark at the hem → light at the shoulder, around `palette.top` |
| Inner / tie / apron / trim | boxes 0.01 proud of the torso front, drawn only when that palette slot is truthy |
| Arms | one sleeve box per side **flush with the torso** (no gap), plus a 6-sided hand `prism` in `palette.skin` |
| Neck | box in `palette.skin.deep`, `FRAME.shoulder` → `FRAME.chin` |

- [ ] **Step 1: Write the failing tests** in `character-body.test.js`

```js
test('feet sit on the floor and the body stops at the chin', …)
  // min y === 0 (±1e-9), max y === FRAME.chin (±1e-9)
test('a skirted design builds a flared lower garment', …)
  // widest x near FRAME.hem is greater than the widest x at the waist
test('a trousered design does not flare', …)
test('optional layers appear only when the design has them', …)
  // a design with inner+tie+apron has more faces than the same design without
test('every leg and shoe colour comes from the palette', …)
test('no face is marked unlit', …)                         // the body is lit normally
test('indices in range and output deterministic', …)
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test web/static/js/library/three-d/meshes/character-body.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `buildBody`**

- [ ] **Step 4: Run to verify they pass**

Run: `node --test web/static/js/library/three-d/meshes/character-body.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/static/js/library/three-d/meshes/character-body.js web/static/js/library/three-d/meshes/character-body.test.js
git commit -m "three-d: build a patron's body from their 2D design"
```

---

### Task 6: the head

**Files:**
- Create: `web/static/js/library/three-d/meshes/character-head.js`
- Create: `web/static/js/library/three-d/meshes/character-head.test.js`

**Interfaces:**
- Consumes: `geom.js` (Task 1); the `unlit` flag (Task 2); `FRAME`, `metricsFor` (Task 4).
- Produces: `buildHead(design, palette, metrics): Mesh` — spans `FRAME.chin` to `FRAME.crown` (plus hair and headwear above it), already scaled about `y = FRAME.chin` by `metrics.headScale`, and already offset forward in +Z when `metrics.elder` (the stoop).

Geometry:

| Part | Build |
|---|---|
| Head | a 5-ring `prism`, `sides: 8`, tapering to a chin at `FRAME.chin` and a crown at `FRAME.crown`, banded in the three skin tones |
| Ears | one box per side at the head's half-width |
| Face | `quad`s 0.01 proud of the head front at `FRAME.eye`: eye white, iris in `palette.eyes`, a highlight, a brow bar (thicker when `design.brows === 'thick'`), a lash bar when `eyes.lashes`, a mouth in `palette.lips` (taller when `mouth === 'open'`), blush when kid or `eyes.lashes` or `mouth === 'smile'` |
| Hair | a 4-ring `prism` cap in the four hair tones, plus a fringe quad across the brow |
| `hair.back` | `long`/`medium`/`bob` → a fall box behind the head (24/11/8.6 px); `twintails` → a `prism` each side; `ponytail` → one behind; `bun` → one above |
| `extras` | `glasses` (lens + frame quads), `mask` (a `prism` over the lower face), `cap`/`beanie`/`sunhat`/`bikeHelmet`/`hachimaki` (a `prism`; `cap` also gets a forward peak), `catEars`, `headphones` |
| `angry` | narrowed brow bars angled down at the middle, as `patron-head.js` does |

**Every face this module emits is `unlit: true`** — its shading is baked into the ring and band colours, exactly as the 2D bakes it. This is the spec's starting proposal; the final set is tuned by eye in Task 8.

- [ ] **Step 1: Write the failing tests** in `character-head.test.js`

```js
test('the head spans chin to crown', …)                    // min y === FRAME.chin (±1e-9)
test('a kid head is scaled about the chin', …)             // kid max y > adult max y,
                                                           // and both min y === FRAME.chin
test('every face is unlit', …)
test('each hair.back style changes the mesh', …)           // long/bob/twintails/ponytail/bun/short
                                                           // all produce different face counts or bounds
test('an unknown hair.back is ignored, not thrown', …)     // REVIEW FOCUS 3
test('an unknown extras key is ignored, not thrown', …)    // REVIEW FOCUS 3
test('glasses and headphones add faces', …)
test('angry changes the brow faces', …)
test('indices in range and output deterministic', …)
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test web/static/js/library/three-d/meshes/character-head.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `buildHead`**

Build in unscaled space, then apply `scaleAbout(mesh, metrics.headScale, FRAME.chin)` and, for an elder, `translate` forward in +Z.

- [ ] **Step 4: Run to verify they pass**

Run: `node --test web/static/js/library/three-d/meshes/character-head.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/static/js/library/three-d/meshes/character-head.js web/static/js/library/three-d/meshes/character-head.test.js
git commit -m "three-d: build a patron's head, hair and extras from their 2D design"
```

---

### Task 7: assemble `buildCharacter` and pin the proportions

**Files:**
- Modify: `web/static/js/library/three-d/meshes/character.js` (full rewrite)
- Modify: `web/static/js/library/three-d/meshes/character.test.js` (full rewrite)

**Interfaces:**
- Consumes: `buildBody` (Task 5), `buildHead` (Task 6), `metricsFor`/`FRAME` (Task 4), `paletteFor` (Task 4), `scaleMesh` (Task 1).
- Produces: `buildCharacter(design, opts?: {angry?: boolean}): Mesh` — merges body and head, then applies `scaleMesh(mesh, metrics.ageScale)`. **This replaces the old four-colour-palette signature.**

- [ ] **Step 1: Write the failing tests** in `character.test.js` (replacing the file)

```js
// The guard that matters — adult design, tolerances from the spec:
test('an adult is 3.0 heads tall', …)                      // height / headHeight === 3.0 ± 0.15
test('head is 85% of shoulder width', …)                   // ± 0.05
test('legs are 29% of total height', …)                    // ± 2 percentage points
test('an adult is 1.66 units tall', …)                     // ± 0.02

test('feet sit on the floor', …)                           // min y === 0 (±1e-9)
test('no colour from the design is dropped', …)
  // design.skin, design.outfit.top, .bottom (or .skirt) and .shoes each appear
  // verbatim on at least one face; and for a design carrying inner + tie + trim,
  // the distinct-colour count exceeds that of the same design without them
  // (the old builder collapsed all of these into four colours)
test('a kid has a proportionally larger head than an adult', …)
test('kid and elder figures are shorter than an adult', …)
test('a design with glasses has more faces than one without', …)
test('angry changes the mesh', …)
test('output is deterministic and every index is in range', …)
test('face budget', …)                                     // faces.length <= 320

// REVIEW FOCUS 2 and 5 — the whole roster, in one place:
test('every shipped design builds', …)
  // for each of LIBRARY_PATRON_DESIGNS: buildCharacter does not throw
test('every face colour is valid for parseColor', …)
  // for each design, every face.color matches /^#([0-9a-f]{3}|[0-9a-f]{6})$|^rgb\(/i
```

The roster tests import `LIBRARY_PATRON_DESIGNS` from `../../library-people.js`, which is pure data — check it pulls in no DOM code before relying on it; if it does, inline a representative subset instead and say so in a comment.

- [ ] **Step 2: Run to verify they fail**

Run: `node --test web/static/js/library/three-d/meshes/character.test.js`
Expected: FAIL — `buildCharacter` still takes a palette, proportions are 6.5 heads tall

- [ ] **Step 3: Rewrite `buildCharacter`**

- [ ] **Step 4: Run to verify they pass**

Run: `node --test web/static/js/library/three-d/meshes/character.test.js`
Expected: PASS — in particular the 3.0-heads-tall assertion

- [ ] **Step 5: Run the whole unit suite**

Run: `npm run test:unit`
Expected: `scene.test.js` FAILS — it still calls `buildCharacter` with a palette. That is Task 8's job; do not fix it here.

- [ ] **Step 6: Commit**

```bash
git add web/static/js/library/three-d/meshes/character.js web/static/js/library/three-d/meshes/character.test.js
git commit -m "three-d: rebuild the FP character at the 2D art's proportions"
```

---

### Task 8: wire it up, tune, document

**Files:**
- Modify: `web/static/js/library/three-d/scene.js:60` (pass `c.design` instead of `c.palette`)
- Modify: `web/static/js/library/three-d/scene.test.js` (characters now carry a design)
- Modify: `web/static/js/library-game.js` — delete `fpPaletteFor` (~line 5026), replace `FP_KAREN_PALETTE` (~line 843) with `KAREN_DESIGN`, pass the design through in `drawFirstPersonView` (~line 5058)
- Modify: `docs/features/library-first-person-3d.md`

**Interfaces:**
- Consumes: `buildCharacter(design, opts)` (Task 7).
- Produces: `buildFirstPersonScene`'s `characters` entries become `{x, y, design, angry?, floor?}` instead of `{x, y, palette}`.

- [ ] **Step 1: Write the failing test** in `scene.test.js`

```js
test('a character entry carries a design and is placed in the scene', …)
  // characters: [{x, y, design: <a real design>}] → one more placed entry,
  // placed at [x, 0, y] with scale UNIT_SCALE
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test web/static/js/library/three-d/scene.test.js`
Expected: FAIL

- [ ] **Step 3: Update `scene.js` and `library-game.js`**

`KAREN_DESIGN` is a design-shaped literal carrying at minimum `skin`, `hair: {color, back, fringe}`, `eyes: {color, style, lashes}`, `brows`, `mouth`, `outfit: {kind, top, bottom, shoes}`, `age`. Build it from today's `FP_KAREN_PALETTE` values (`skin '#f0c7a0'`, `hair '#caa24e'`, `top '#c0432f'`, `bottom '#3a3238'`) so Karen's colours do not change. `drawFirstPersonView` passes `findLibraryDesign(personality)` straight through, with `angry: e.ref.kind === 'karen'`, falling back to `KAREN_DESIGN` when the personality is `karen`.

- [ ] **Step 4: Add the sparse-design test** (REVIEW FOCUS 4)

```js
test('the Karen design builds', …)   // in character.test.js: buildCharacter(KAREN_DESIGN)
                                     // does not throw and every face colour is valid
```

Export the design from a module the test can import. It belongs in `web/static/js/library/library-people.js` as `KAREN_DESIGN` — that file is pure data and is already where designs live — not in `library-game.js`, which is DOM-bound, and not in a mesh module. `library-game.js` imports it in place of today's `FP_KAREN_PALETTE`.

- [ ] **Step 5: Run the whole unit suite**

Run: `npm run test:unit`
Expected: PASS — all of it, including `scene.test.js`'s five-pose screen-coverage test

- [ ] **Step 6: Run the First Person Playwright specs**

Run: `make run-e2e` in one shell, then `npx playwright test e2e/library-game.spec.js --output /tmp/claude/fp-e2e`
Expected: PASS — stairs, elevator and the per-frame-clear pixel test unchanged

- [ ] **Step 7: Tune the `unlit` set by eye**

Run `make dev` on a port **other than 8080** and open `/library-game` in First Person. Compare a queued patron against the same patron in Top-Down. If a full-brightness head reads as pasted onto the body, narrow `unlit` to the face detail quads only, or raise the body's baked band colours. **Record the final set and the reasoning** in `docs/features/library-first-person-3d.md`.

- [ ] **Step 8: Update `docs/features/library-first-person-3d.md`**

Cover: the new module table (`geom.js`, `character-frame.js`, `character-palette.js`, `character-body.js`, `character-head.js`); `buildCharacter(design, opts)`'s signature replacing the palette; the proportion constants and where they come from; `unlit` in the `Face` shape and in the Rendering-model section; the tunables table; and the "How to add a new object mesh" steps, which currently tell the reader to import `box` from `character.js`. Move the "only 4 colours" limitation out of Known gaps.

- [ ] **Step 9: Run `make check`**

Run: `make check`
Expected: PASS (the DB-gated e2e test skips without `DATABASE_URL`)

- [ ] **Step 10: Commit**

```bash
git add web/static/js/library/three-d/ web/static/js/library-game.js docs/features/library-first-person-3d.md
git commit -m "library-fp: draw patrons from their 2D design, not a 4-colour palette"
```
