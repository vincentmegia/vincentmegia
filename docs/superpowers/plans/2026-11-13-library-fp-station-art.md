# Library FP Stations and Decor Referenced to the 2D Art — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Front Desk, Fines Counter, Return Cart, Reading Nook and the four decor props in Library Shift's First Person camera read as the same objects as their Top-Down art.

**Architecture:** Each 2D drawer exports the layout and colours it draws with; the mesh imports them. Flat fronts (counter, monitor, plaque, register, `RETURNS` tag, tray lips) wear the drawer's own pixels via `textureFront`; round or 3/4-sprite parts are geometry in the exported colours. `library-game.js` paints one art canvas per station through `FP_ART`.

**Tech Stack:** Plain ES modules, canvas 2D, the software 3D painter in `web/static/js/library/three-d/`, `node --test`, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-13-library-fp-station-art-design.md`. Read it and `docs/skills/convert-2d-to-3d/SKILL.md` first; `meshes/bookshelf.js` and `meshes/bookshelf.test.js` are the reference implementation and test.

## Global Constraints

- Top-Down stays byte-identical: the canvas call trace of every changed drawer must not change (Task 0's script; Hospital Shift's decor too).
- No value copied by hand into a mesh: every colour and every art rectangle is imported from the drawer's module.
- Every front faces **+Z** (patrons queue at `desk.y + hh + offset`, and the player approaches from there). All four current meshes face −Z; that is the bug being fixed.
- Textured faces are `unlit`; every other face lit. Every face `cull: true`, wound outward. Hidden faces dropped with `boxWithout`.
- Without `art` the same faces render in the exported flat colours.
- A paint function builds its own art box `{id, w, h}`; it never reads `station.w`/`station.h` (the Return Cart and Reading Nook stations have only `size`).
- Art px map to model units with one constant per mesh (`K`), x and y alike, so nothing stretches.
- `RETURN_CART_BOOK_SLOTS`, `RETURN_CART_VISIBLE_BOOKS` and the top tray's surface (0.82) do not change.
- Temp files only under `/tmp/claude/fp-stations/`. Own dev server on a port other than 8080; never touch the one on 8080.
- Each task's commit includes its doc update (`docs/features/library-first-person-3d.md`: the file list, a row per new export in the prop table; `library-game.md` when a drawer's exports change; `hospital-shift.md` in Task 5).

## Review Focus

1. **A canvas that is missing or null** (`artFor` returns null before first paint): the mesh must build with flat colours and the same geometry. Pinned by each mesh's "flat fallback" test.
2. **The camera behind or inside a station** (the player can walk round the desk): no face may paint over a nearer one. Pinned by each mesh's "cull from front and behind" test.
3. **Label chips and occlusion** read the mesh's bounds (`labels.js` `stationMeshBox`): a taller mesh (the fines plaque, the cart's tag) moves the chip and widens what hides other labels. Pinned in Tasks 2 and 3 by a `stationTop` assertion; run `labels.test.js`.
4. **A station object without `w`/`h`** passed to a paint function. Pinned by each `paint…Art` test calling it with `{id: 'x'}` only.
5. **Hospital Shift's decor** draws through the same drawers. Pinned by Task 5's trace covering every `DECOR_KINDS` kind, not just Library's four.

---

### Task 0: Baseline traces and the comparison harness (throwaway, not committed)

**Files:**
- Create: `/tmp/claude/fp-stations/trace.mjs`, `/tmp/claude/fp-stations/baseline.json`
- Create: `/tmp/claude/fp-stations/compare.html` (+ a tiny static server script if needed)

- [ ] **Step 1: Write `trace.mjs`.** It imports `drawFrontDesk`, `drawReturnCart`, `drawFinesRoom`, `drawReadingNook` from `web/static/js/library/anime-furniture.js` and `drawDecor`, `DECOR_KINDS` from `web/static/js/hospital/anime-furniture.js`, calls each with a recording `Proxy` context and writes `{name: calls}` as JSON to the path in `process.argv[2]`. Station boxes: front desk `{id, w: 124, h: 84}`, fines `{w: 130, h: 130}`, cart and nook `{w: 84, h: 84}`; decor: one `{kind, x: 100, y: 100, w: 30, h: 46}` per `DECOR_KINDS` entry plus Library's own five sizes (`library-game.js` `LIBRARY_DECOR`). The recorder logs `[method, args]` and `['set:prop', value]`; `createLinearGradient`/`createRadialGradient` return an object whose `addColorStop` also logs; `measureText` returns `{width: 5}`.
- [ ] **Step 2: Record the baseline.** Run: `node /tmp/claude/fp-stations/trace.mjs /tmp/claude/fp-stations/baseline.json`. Expected: a JSON file with 4 + decor entries, each non-empty.
- [ ] **Step 3: Write `compare.html`.** One page that, for a `?kind=` query, draws the real 2D drawer on a canvas (at 4×) beside the 3D mesh rendered by `drawScene` from three cameras: facing the front, 35° off, and at interact range (60 px from the front). It imports the modules from the repo's static root served on your own port.

No commit.

---

### Task 1: Front Desk

**Files:**
- Modify: `web/static/js/library/anime-furniture.js` (`drawFrontDesk`, ~line 400)
- Rewrite: `web/static/js/library/three-d/meshes/front-desk.js`
- Create: `web/static/js/library/three-d/meshes/front-desk.test.js`
- Modify: `web/static/js/library/anime-furniture.test.js`, `web/static/js/library/three-d/meshes/decor.js` (export `leafBlob`), `web/static/js/library-game.js` (`FP_ART`, ~line 3022)

**Interfaces:**
- Produces, from `anime-furniture.js`:
  - `FRONT_DESK_COLORS = {counter: '#ffcfa8', top: '#e8b58a', stand: '#8a8aa0', monitor: '#5a5a78', screen: '#d6ecff', covers: [ANIME.pink, ANIME.mint, ANIME.gold], books: [ANIME.sky, ANIME.coral, ANIME.lavender], bell: ANIME.gold, bellBase: ANIME.goldDeep, pot: '#f2a98a', leaf: ANIME.mint}`
  - `frontDeskLayout(st)` → rects `{x0, y0, x1, y1}` in the drawer's centred px, for a 124 × 84 station exactly: `body {-56, 2, 56, 38}`, `top {-60, -6, 60, 4}`, `stand {-24, -6, -14, -2}`, `monitor {-40, -36, 2, -6}`, `screen {-36, -32, -2, -10}`, `books [{6,-12,30,-5.5}, {5,-19,29,-12.5}, {4,-26,28,-19.5}]`, `bell {x: 46, y: -6, r: 8}`, `bellBase {36, -7, 56, -4}`, `bellButton {x: 46, y: -15, r: 1.8}`, `pot {-55, -18, -43, -5}`, `leaves [{x: -49, y: -24, r: 5}, {x: -53, y: -27, r: 3.5}, {x: -45, y: -28, r: 3.5}]`, `floor: 38`. Widths and the pot/sparkle keep following `st.w`/`st.h` as the drawer does today.
- Produces, from `decor.js`: `leafBlob(cx, cy, cz, r, color = PLANT_LEAF, {sides = 7, bands = 5} = {})` (today's private helper, exported; defaults unchanged).
- Produces, from `front-desk.js`:
  - `FRONT_DESK_ART = {w: 124, h: 84}`, `FRONT_DESK_ART_SCALE = 4`, `FRONT_DESK_K = 2.8 / 120` (units per art px; the top slab is 2.8 wide)
  - `FRONT_DESK_SIZE = {width: 2.8, depth: 1.0, counterTop: 44 * FRONT_DESK_K}` (art y −6 above floor y 38)
  - `paintFrontDeskArt(ctx, station)`, `buildFrontDesk({art} = {})`

- [ ] **Step 1: Write the failing drawer tests** in `anime-furniture.test.js`, in the style of the coffee machine's:

```js
test('frontDeskLayout keeps the Top-Down front desk geometry', () => {
  const L = frontDeskLayout({ w: 124, h: 84 });
  assert.deepEqual(L.body, { x0: -56, y0: 2, x1: 56, y1: 38 });
  assert.deepEqual(L.top, { x0: -60, y0: -6, x1: 60, y1: 4 });
  assert.deepEqual(L.monitor, { x0: -40, y0: -36, x1: 2, y1: -6 });
  assert.deepEqual(L.screen, { x0: -36, y0: -32, x1: -2, y1: -10 });
  assert.deepEqual(L.books[2], { x0: 4, y0: -26, x1: 28, y1: -19.5 });
  assert.deepEqual(L.pot, { x0: -55, y0: -18, x1: -43, y1: -5 });
  assert.equal(L.floor, 38);
});
test('drawFrontDesk draws its parts from frontDeskLayout', () => {
  const L = frontDeskLayout({ w: 124, h: 84 });
  const { ctx, calls } = recordingContext();
  drawFrontDesk(ctx, { w: 124, h: 84 });
  const rounds = calls.filter(([k]) => k === 'roundRect').map(([, a]) => rectOf(a));
  for (const r of [L.body, L.top, L.stand, L.monitor, L.screen, ...L.books, L.bellBase, L.pot]) {
    assert.ok(rounds.some((q) => ['x0', 'y0', 'x1', 'y1'].every((k) => Math.abs(q[k] - r[k]) < 1e-9)), JSON.stringify(r));
  }
});
```

(`recordingContext` needs gradient stubs if `block` uses a gradient; extend it there, once, the way Task 0's recorder does.)

- [ ] **Step 2: Run them; expect FAIL** (`frontDeskLayout` is not exported). Run: `node --test web/static/js/library/anime-furniture.test.js`
- [ ] **Step 3: Add `FRONT_DESK_COLORS` and `frontDeskLayout(st)`; make `drawFrontDesk` draw from them.** Same calls in the same order with the same numbers.
- [ ] **Step 4: Tests pass, and the trace is unchanged.** Run the test file, then `node /tmp/claude/fp-stations/trace.mjs /tmp/claude/fp-stations/after.json && diff /tmp/claude/fp-stations/baseline.json /tmp/claude/fp-stations/after.json`. Expected: tests PASS, `diff` prints nothing.
- [ ] **Step 5: Write `front-desk.test.js`** with the bookshelf test's helpers (`bbox`, `near`, `textured`, `uvBox`). Tests and their assertions:
  - *size*: bbox x = ±1.4, y from 0, z = ±0.5; highest vertex = `(38 + 36) * K` (the monitor's top) within 1e-9 plus the leaf blobs' height.
  - *three textured fronts*: with `art`, exactly 3 textured faces, each `unlit`, all four vertices on one +Z plane, uv on the image; their `uvBox`es equal `L.body`, `L.top` and `L.monitor`.
  - *planes*: body front at z = 0.4, slab front at z = 0.5, monitor front at z > its back; no untextured face coplanar with a textured one.
  - *flat fallback*: `buildFrontDesk()` has no `texture`, the same face count as with art, and those three faces are coloured `FRONT_DESK_COLORS.counter`, `.top`, `.monitor`.
  - *colours*: every face colour is in `Object.values(FRONT_DESK_COLORS).flat()`.
  - *cull*: every face `cull === true`; rendered with `buildDrawList` from a camera in front (+Z) and one behind (−Z), no textured face appears in the list from behind.
  - *budget and determinism*: `faces.length <= 140`; two builds `deepEqual`.
  - *paint*: `paintFrontDeskArt(recorder, {id: 'x'})`'s first two calls are `set:fillStyle` = `FRONT_DESK_COLORS.counter` and `fillRect(0, 0, 496, 336)`.
- [ ] **Step 6: Run; expect FAIL.** Run: `node --test web/static/js/library/three-d/meshes/front-desk.test.js`
- [ ] **Step 7: Rewrite `front-desk.js`.** `mx(x) = x * K`, `my(y) = (L.floor - y) * K`. Parts: body `boxWithout` (z ±0.4, drop bottom) with its front textured `L.body`; top slab (z ±0.5, drop bottom) with front `L.top`; stand box; monitor box 0.1 thick centred on z = 0 with front `L.monitor`, `div [2, 1]`; the three books as boxes 0.3 deep at `L.books` rects and colours; bell as a 3-ring 8-sided `prism` dome of radius `L.bell.r * K` on a base box, with a small button box; pot as a tapered 6-sided `prism` over `L.pot`; one `leafBlob(…, FRONT_DESK_COLORS.leaf, {sides: 6, bands: 3})` per `L.leaves` entry. `paintFrontDeskArt` mirrors `paintBookshelfArt`: opaque backing, scale, translate to the centre, `drawFrontDesk(ctx, {id: station.id, w: 124, h: 84})`.
- [ ] **Step 8: Run; expect PASS.** Also `node --test web/static/js/library/three-d/*.test.js web/static/js/library/three-d/meshes/*.test.js`.
- [ ] **Step 9: Register the art.** In `library-game.js` `FP_ART`: `'front-desk': {w: FRONT_DESK_ART.w * FRONT_DESK_ART_SCALE, h: FRONT_DESK_ART.h * FRONT_DESK_ART_SCALE, paint: paintFrontDeskArt}`.
- [ ] **Step 10: Look at it.** Open `compare.html?kind=front-desk` from your own port and screenshot the three views beside the 2D; fix what does not read as the same desk. Save the screenshots in `/tmp/claude/fp-stations/` for the user.
- [ ] **Step 11: Update the docs, run `npm run test:unit`, commit.**

```bash
git add web/static/js/library/anime-furniture.js web/static/js/library/anime-furniture.test.js web/static/js/library/three-d/meshes/front-desk.js web/static/js/library/three-d/meshes/front-desk.test.js web/static/js/library/three-d/meshes/decor.js web/static/js/library-game.js docs/features/library-first-person-3d.md docs/features/library-game.md
git commit -m "library-fp: Front Desk wears its 2D art and faces the player"
```

---

### Task 2: Fines Counter

**Files:**
- Modify: `web/static/js/library/anime-furniture.js` (`drawFinesRoom`, ~line 474), `anime-furniture.test.js`, `library-game.js` (`FP_ART`)
- Rewrite: `web/static/js/library/three-d/meshes/fines-counter.js`
- Create: `web/static/js/library/three-d/meshes/fines-counter.test.js`

**Interfaces:**
- Produces, from `anime-furniture.js`:
  - `FINES_ROOM_COLORS = {plaque: ANIME.coral, counter: '#ffcfa8', top: '#e8b58a', housing: '#5a5a78', display: '#bff2e0', register: ANIME.lavender, keys: '#ffffff', coin: ANIME.gold, coinDeep: ANIME.goldDeep}`
  - `finesRoomLayout(st)`, for a 130 × 130 station exactly: `plaque {-36, -57, 36, -40}`, `body {-53, 12, 53, 55}`, `top {-57, 6, 57, 15}`, `housing {-8, -22, 22, -13}`, `display {-5, -20.5, 13, -15}`, `register {-14, -14, 26, 6}`, `coins [{x: -34, n: 4}, {x: -25, n: 2}]` with `coinBase: 4`, `coinPitch: 3.6`, `coinR: 5`, `floor: 55`.
- Produces, from `fines-counter.js`: `FINES_COUNTER_ART = {w: 130, h: 130}`, `FINES_COUNTER_ART_SCALE = 4`, `FINES_COUNTER_K = 2.4 / 114`, `FINES_COUNTER_SIZE = {width: 2.4, depth: 1.1}`, `paintFinesCounterArt(ctx, station)`, `buildFinesCounter({art} = {})`.

- [ ] **Step 1: Failing drawer tests** as in Task 1: `finesRoomLayout({w: 130, h: 130})` `deepEqual`s the rects above; `drawFinesRoom`'s `roundRect` calls include `plaque`, `body`, `top`, `housing`, `display`, `register`; it draws 6 `ellipse` calls at the coin positions.
- [ ] **Step 2: Run; expect FAIL.**
- [ ] **Step 3: Add the exports; `drawFinesRoom` draws from them.**
- [ ] **Step 4: Tests PASS; trace `diff` prints nothing.**
- [ ] **Step 5: Write `fines-counter.test.js`**, same set as Task 1 Step 5 with these values: 5 textured fronts whose `uvBox`es equal `body`, `top`, `plaque`, `register`, `housing`; bbox x = ±1.2; plaque spans model y `(55 + 40) * K` to `(55 + 57) * K`; exactly 6 coin discs (count faces coloured `coin` + `coinDeep` by their caps: 4 + 2 top caps); fallback colours `counter`, `top`, `plaque`, `register`, `housing`; `faces.length <= 140`; `paintFinesCounterArt(recorder, {id: 'x'})` starts with `fillStyle = FINES_ROOM_COLORS.counter`, `fillRect(0, 0, 520, 520)`. Add: `stationTop('fines-counter')` (from `labels.js`) equals the plaque's top × `UNIT_SCALE`.
- [ ] **Step 6: Run; expect FAIL.**
- [ ] **Step 7: Rewrite `fines-counter.js`.** Body (z ±0.45) and overhanging top (z ±0.55) with textured fronts; the register a box 0.5 deep on the top, front textured `L.register` (`div [1, 1]`), the display housing a thinner box above it with front `L.housing`; coin stacks as 8-sided `prism` discs `coinPitch * K` high, alternating `coin`/`coinDeep` from the bottom, standing on the top; the plaque a 0.04-thick board at the counter's back edge (z = −0.5), front textured `L.plaque`, `div [2, 1]`, held by two 0.04-square posts in `top` colour at x = ±0.75 rising from the counter top to the plaque's top. `paintFinesCounterArt`: opaque `counter` backing, then `drawFinesRoom` at 130 × 130.
- [ ] **Step 8: Run; expect PASS** (the mesh tests and `labels.test.js`).
- [ ] **Step 9: Register `FP_ART['fines-counter']`** (520 × 520, `paint: paintFinesCounterArt`).
- [ ] **Step 10: Look at it** in `compare.html?kind=fines-counter`; the plaque's lettering must be legible at interact range. Screenshot.
- [ ] **Step 11: Docs, `npm run test:unit`, commit** (`library-fp: Fines Counter wears its 2D art, with a lettered plaque`).

---

### Task 3: Return Cart

**Files:**
- Modify: `web/static/js/library/anime-furniture.js` (`drawReturnCart`, ~line 434), `anime-furniture.test.js`, `library-game.js` (`FP_ART`)
- Rewrite: `web/static/js/library/three-d/meshes/return-cart.js`
- Create: `web/static/js/library/three-d/meshes/return-cart.test.js`

**Interfaces:**
- Produces, from `anime-furniture.js`:
  - `RETURN_CART_COLORS = {wood: '#d9a877', frame: ANIME.ink, tag: '#ffffff', tagInk: ANIME.coralDeep, wheel: '#5a5a78', hub: '#d6ecff', books: [ANIME.coral, ANIME.sky, ANIME.gold, ANIME.mint, ANIME.lavender, ANIME.pink]}`
  - `returnCartDecorBooks(tray)` → `[{color, h}]`: `tray` 0 is the upper (6 books, colour index `i`), 1 the lower (5 books, colour index `i + 2`), `h = 13 + ((i * 7) % 5)`.
  - `returnCartLayout(st)`, for 84 × 84 exactly: `trays [{-33, -3, 33, 2}, {-33, 17, 33, 22}]`, `tag {-26, -37, 26, -23}`, `bookX0: -28`, `bookPitch: 9`, `bookW: 7.5`, `posts [-32, 32]`, `wheels [{x: -26, y: 32, r: 5}, {x: 26, y: 32, r: 5}]`, `hubR: 1.8`.
- Produces, from `return-cart.js`: unchanged `RETURN_CART_VISIBLE_BOOKS`, `RETURN_CART_BOOK_SLOTS`; new `RETURN_CART_ART = {w: 84, h: 84}`, `RETURN_CART_ART_SCALE = 4`, `RETURN_CART_TAG = {width: 0.9, y0: 1.2, y1: 1.2 + 0.9 * 14 / 52}`, `paintReturnCartArt(ctx, station)`, `buildReturnCart({art} = {})`.

- [ ] **Step 1: Failing drawer tests**: the layout `deepEqual`s; `returnCartDecorBooks(1)` is 5 books whose colours are `books[2..6 mod 6]` and heights `[13, 15, 17, 14, 16]`; `drawReturnCart`'s `roundRect` calls include both trays and the tag; `fillText` is called with `'RETURNS'`.
- [ ] **Step 2: Run; expect FAIL.**
- [ ] **Step 3: Add the exports; `drawReturnCart` draws from them.**
- [ ] **Step 4: Tests PASS; trace `diff` prints nothing.**
- [ ] **Step 5: Write `return-cart.test.js`**: `RETURN_CART_BOOK_SLOTS` `deepEqual`s today's five `[x, 0.82, 0.05]` points (x = −0.58, −0.29, 0, 0.29, 0.58); 3 textured fronts whose `uvBox`es equal `tag` and the two trays; the tag's face is at z ≤ −0.4, facing +Z, its bottom ≥ `0.82 + BOOK_SIZE.height` (clear of the real books; import `BOOK_SIZE` from `book.js`); the 5 lower-tray books carry `returnCartDecorBooks(1)`'s colours left to right and stay under the upper tray's underside (0.7); wheels are not boxes (each has ≥ 8 side faces); every colour is in `RETURN_CART_COLORS`; fallback colours `tag`, `wood`, `wood`; `faces.length <= 170`; cull both ways; determinism; `paintReturnCartArt(recorder, {id: 'x'})` starts with `fillStyle = RETURN_CART_COLORS.wood`, `fillRect(0, 0, 336, 336)`; `stationTop('return-cart')` equals `RETURN_CART_TAG.y1 × UNIT_SCALE`.
- [ ] **Step 6: Run; expect FAIL.**
- [ ] **Step 7: Rewrite `return-cart.js`.** Keep today's tray boxes (x ±0.8, z ±0.5, lower 0.2–0.32, upper 0.7–0.82) and texture each +Z face with its tray rect (`div [2, 1]`). Posts in `frame`: the two front ones to 1.1 as now, the two back ones (z = −0.45) to `RETURN_CART_TAG.y1`; the handle box as now. The tag: a 0.03-thick board between the back posts spanning `RETURN_CART_TAG`, front textured `L.tag`. Lower-tray books: width 0.2, pitch 0.24, centred, height `h * 0.02`, depth 0.3, from `returnCartDecorBooks(1)`. Wheels: `tube([x, 0.1, -0.06], [x, 0.1, 0.06], 0.1, 0.1, 8, wheel, {capA: wheel, capB: wheel})` at x = ±0.55, with a hub `tube` of radius 0.036 standing 0.01 proud of each cap.
- [ ] **Step 8: Run; expect PASS**, including `scene.test.js` and `labels.test.js`.
- [ ] **Step 9: Register `FP_ART['return-cart']`** (336 × 336).
- [ ] **Step 10: Look at it** in `compare.html?kind=return-cart`, then in the game with books on the cart: the tag must not hide the real books from the 60 px eye at interact range. Screenshot.
- [ ] **Step 11: Docs, `npm run test:unit`, commit** (`library-fp: Return Cart gets its RETURNS tag, round wheels and the 2D's books`).

---

### Task 4: Reading Nook

**Files:**
- Modify: `web/static/js/library/anime-furniture.js` (`drawReadingNook`, ~line 612), `anime-furniture.test.js`
- Rewrite: `web/static/js/library/three-d/meshes/reading-nook.js`
- Create: `web/static/js/library/three-d/meshes/reading-nook.test.js`

**Interfaces:**
- Produces, from `anime-furniture.js`: `READING_NOOK_COLORS = {rug: ANIME.lavender, chair: ANIME.pink, arm: tint(ANIME.pink, -0.12), cushion: tint(ANIME.pink, 0.2), leg: '#8a6a4a', book: '#ffffff', pole: ANIME.ink, base: '#5a5a78', shade: ANIME.gold}`; `drawReadingNook` draws with them.
- Produces, from `reading-nook.js`: `READING_NOOK_SIZE = {rugRx: 1.2, rugRz: 0.8, chairTop: 1.3, lampTop: 1.5}`, `buildReadingNook()` (no art).

- [ ] **Step 1: Failing drawer test**: every `fillStyle`/`strokeStyle` `drawReadingNook` sets is in `Object.values(READING_NOOK_COLORS)` or is one of its `rgba(` overlays (the glow, the heart), and `READING_NOOK_COLORS.arm === tint(ANIME.pink, -0.12)`.
- [ ] **Step 2: Run; expect FAIL. Step 3: add the export, draw with it. Step 4: PASS and trace `diff` empty.**
- [ ] **Step 5: Write `reading-nook.test.js`**: the rug is a 12-sided disc (12 vertices at y = 0.03 on the ellipse `(x/1.2)² + (z/0.8)² = 1` within 1e-9) and is the mesh's widest part; highest vertex = 1.5; the chair's back is on the −Z side of its seat and the open book's faces sit above the cushion, facing up (`faceNormal` y > 0.8); the shade's top ring is narrower than its bottom ring and it has no top or bottom cap; the shade's faces are `unlit`, no other face is; every colour is in `READING_NOOK_COLORS`; cull; `faces.length <= 170`; determinism.
- [ ] **Step 6: Run; expect FAIL.**
- [ ] **Step 7: Rewrite `reading-nook.js`.** Rug: a 2-ring 12-sided `prism` 0.03 high. Chair in today's footprint, turned to face +Z (back at z −0.4…−0.15), each of seat, back and both arms a box topped by a 0.05 slab inset 0.05 on its exposed edges so the silhouette is rounded; the cushion likewise; four legs. Open book: two quads 0.2 × 0.16 meeting at a spine on the cushion, each tilted 12° up at its outer edge. Lamp at x = 0.79: base an 8-sided disc r 0.15, pole a 6-sided `tube` r 0.03 to 1.3, shade a 2-ring 8-sided `prism` from r 0.22 at 1.3 to r 0.14 at 1.5, no caps, `unlit`, both windings present (inside and outside) since it is open.
- [ ] **Step 8: Run; expect PASS** (with `labels.test.js`).
- [ ] **Step 9: Look at it** in `compare.html?kind=reading-nook` and on the 2nd Floor in the game (it stands on the floor rug decal; the mesh's rug must sit above the decal without z-fighting in the painter's sort). Screenshot.
- [ ] **Step 10: Docs, `npm run test:unit`, commit** (`library-fp: Reading Nook is a rounded armchair with its book, rug and lamp`).

---

### Task 5: Decor colours

**Files:**
- Modify: `web/static/js/hospital/anime-furniture.js` (`drawWaitingChairs`, `drawWaterCooler`, `drawPlant`, `drawLadder`, ~lines 1156–1300), `web/static/js/library/three-d/meshes/decor.js`, `decor.test.js`
- Docs: `library-first-person-3d.md`, `hospital-shift.md`

**Interfaces:**
- Produces, from `hospital/anime-furniture.js`: `DECOR_COLORS = {waterCooler: {bottle: '#bfe6ff', body: '#ffffff', tapCold: ANIME.skyDeep, tapHot: ANIME.coralDeep, cups: '#fff6d6'}, plant: {leaf: '#8fd6a4', flower: '#ffd1e3', pot: '#e8956a', rim: '#f2a882'}, ladder: {rail: '#e8b58a', rung: '#f2c8a0'}, waitingChairs: {backs: ['#ffc2da', '#d8c9ff', '#bfeedd'], seatTint: -0.05, leg: ANIME.ink}}`; the four drawers draw with it.

- [ ] **Step 1: Failing test** in `decor.test.js`: for each builder, every face colour is in that kind's `DECOR_COLORS` values, plus `tint(back, seatTint)` for the chair seats and `tint(leaf, -0.3)` for the plant's stem; the water cooler's two tap boxes are on the +Z side (z > 0.17).
- [ ] **Step 2: Run; expect FAIL** (no export; the taps are at −Z; the seats and stem are hand-picked hexes).
- [ ] **Step 3: Export `DECOR_COLORS`, draw with it; in `decor.js` delete every colour constant and import instead; move the cooler's taps and cup stack to the front.**
- [ ] **Step 4: PASS; trace `diff` prints nothing** (this is the Hospital Shift check: the trace covers every `DECOR_KINDS` kind).
- [ ] **Step 5: Look at it**: `compare.html?kind=` each of the four; fix a silhouette only where it visibly differs from the 2D.
- [ ] **Step 6: Docs, `npm run test:unit`, commit** (`library-fp: decor meshes take their colours from the 2D decor drawers`).

---

### Task 6: Whole-game verification

- [ ] **Step 1:** `make check` and `npm run test:unit`. Expected: all pass.
- [ ] **Step 2:** Start your own server on a free port (not 8080) and run the Library Playwright spec against it with its own output dir: `E2E_BASE_URL=http://localhost:<port> npx playwright test e2e/library-game.spec.js --output /tmp/claude/fp-stations/pw`. Expected: pass (rerun a timing flake once before investigating).
- [ ] **Step 3:** In the real game, First Person on the 1st Floor: screenshot the desk, cart and fines counter from the approach side and from behind; on the 2nd Floor the nook. Check the label chips sit just above each mesh.
- [ ] **Step 4:** Frame time on the 1st Floor facing the desk, cart and shelves (headless Chromium, the method the prop spec used): must hold 60 fps. If not, lower `div` on the widest fronts to `[1, 1]` and re-measure.
- [ ] **Step 5:** Update `CLAUDE.md`'s "Library first-person is software 3D" gotcha: the list of drawers whose change shows in both cameras gains `drawFrontDesk`, `drawFinesRoom`, `drawReturnCart`. Set the spec's Status to implemented. Commit.
- [ ] **Step 6:** Show the user the side-by-side screenshots.
