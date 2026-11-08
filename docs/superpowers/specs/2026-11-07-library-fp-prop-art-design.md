# Library Shift — First-Person Props Referenced to the 2D Art

Date: 2026-11-07
Status: Bookshelf, coffee machine, elevator and stairs implemented

## Goal

Make Library Shift's First Person props read as the *same objects* as their
Top-Down 2D art, as the characters now do
(`2026-11-05-library-fp-character-art-design.md`). The procedure is written
up as a convention in `docs/skills/2d-to-3d/SKILL.md`.

## Decisions (confirmed with the user)

1. **Scope: the four props that already have meshes**: bookshelf, coffee
   machine, stairs, elevator. The five stations still drawn as a plain box
   (front desk, return cart, fines counter, boss office, reading nook) are
   out. The bookshelf is built first.
2. **Real-world sizes.** Meshes keep their metre-scale size (`UNIT_SCALE`
   40); only the look comes from 2D.
3. **The 2D art is the texture.** The first proposal (shapes only, colours
   matched from the 2D code, no lettering) was rejected on sight: the 2D's look
   is its plum line art, gradients, rounded shapes, glossy sign and Korean
   spine titles, and none of that survives a colour table. So the 2D drawer
   paints a canvas and the mesh's faces show it.

## The problem, seen

Today's FP bookshelf: a dark-brown 1 × 2 m case, four rows of two deep
cubes each in a fixed rainbow palette, no sign. The 2D `drawBookcase`: a
honey case with a cream back, a genre-coloured glossy sign ("추리 · Mystery"),
rows of outlined spines in tints of the genre colour, each titled in Korean.

## Prototype findings

A throwaway prototype (`/tmp/claude/fp-props-compare/`, not in the repo)
textured a bookshelf with `drawBookcase`'s output:

1. **It reads as the 2D bookcase** facing it, at an angle and at interact
   range, while keeping real depth (recessed rows, proud plank lips).
2. **Cost depends on cell count.** Four shelves cost 5.4 ms/frame cut into
   `[6, 2]` cells and 2.5 ms at `[2, 1]` (headless Chromium, no GPU), with no
   visible difference. Shipped: `[2, 1]` wide, `[1, 3]` tall.
3. **The painter's sort needs help.** Large untextured faces coplanar with or
   just behind the textured fronts covered them (whole spine rows vanished),
   and a face turned away from the camera (the crown's top, above eye level)
   painted over the sign. Fixed by never emitting faces hidden behind the art
   and by an opt-in back-face `cull`.
4. **The seam grow shows neighbouring art.** Each textured triangle is
   clipped to itself grown by 0.6 px, so it samples just outside its region;
   the coffee machine's head picked up the hopper's glass as a light line,
   fixed by a seam fill in the FP art only.

## Design

### Renderer (`core.js`)

- `Face.texture = {image, uv, div?}` on a quad: `image` is any canvas image
  source, `uv` one `[u, v]` in image px per index, `div` the `[nu, nv]` cells.
  `buildDrawList` cuts the face bilinearly in world and uv space and emits two
  triangles per cell, each with its own depth; a cell the near plane cuts is
  emitted as a flat, clipped polygon in `face.color` (no hole). `drawScene`
  maps the image onto each triangle with the affine transform from its uv
  triangle, clipped to the triangle grown by 0.6 px (no seams), sampling only
  the triangle's uv box; darkening `1 - intensity` and fog are painted as
  overlays, so **the mapped region must be opaque**.
- `Face.cull`: opt in to dropping the face when it is turned away from the
  camera. Off by default, so the room shell and characters are unchanged.

### 2D side (`library/anime-furniture.js`)

- `bookcaseLayout(st, rows = 2)`: the case, sign, back panel and each shelf's
  spine line and plank, in the station's centered px. `drawBookcase` draws
  from it.
- `drawBookcase` takes optional `opts.rows` (default 2); `BOOKCASE_COLORS`
  exports its case, back and plank colours. Top-Down's drawing is
  byte-identical (its canvas call trace, recorded through a proxy for every
  shelf, is unchanged).

### Mesh (`three-d/meshes/bookshelf.js`)

- `BOOKSHELF_SIZE` 1.0 × 2.0 × 0.35; `BOOKSHELF_ART` `{w: 124, h: 242,
  rows: 4}`, so the drawn case is exactly the mesh's 1:2; `ART_SCALE` 3 image
  px per art px (a 372 × 726 canvas per shelf).
- `paintBookshelfArt(ctx, station, drawOpts)`: an opaque case-colour backing,
  then `drawBookcase` at `BOOKSHELF_ART` with 4 rows.
- `buildBookshelf({art})`: crown (with the sign), plinth and two sides at the
  front plane; four spine rows recessed 0.07; four plank lips 0.01 proud. Each
  front shows exactly its `bookcaseLayout` region, `unlit`; sides, tops and
  the back stay lit; every face culls. 37 faces (12 textured). Without `art` the same faces
  take `BOOKCASE_COLORS`.

### Scene and game

- `buildFirstPersonScene({..., artFor})` asks `artFor(station)` for each
  same-floor station with its own mesh and passes `{art}` to its builder,
  memoised per station object and art (stations are stable for the run).
- `library-game.js`: `bookcaseDrawOpts(station)` (colour, sign, titles) is
  shared by Top-Down and FP; `fpArtFor` paints and caches one canvas per
  bookshelf id.

## Testing

- `core.test.js`: cells and interpolated uv, near-plane fallback, shading and
  fog carried to the draw pass, `drawImage` + clip per triangle, overlays only
  when lit or fogged, and `cull` (and its default off).
- `anime-furniture.test.js`: `bookcaseLayout` keeps the Top-Down geometry;
  rows split evenly; `drawBookcase` draws one plank per row.
- `bookshelf.test.js`: size and base, the art's aspect, every front textured
  and `unlit` with uv on the image, each front mapping exactly its layout
  region, recessed rows and proud lips, no untextured face coplanar with a
  textured front, plank tops plank-coloured, culling correct from in front and
  behind, the flat fallback, a 60-face budget, determinism, and the opaque
  backing painted first.
- `scene.test.js`: `artFor` is asked per same-floor station and its image
  reaches the mesh; no `artFor` keeps flat colours; meshes are reused while
  the art is unchanged.
- In the game (own port): 60 fps in headless Chromium with three shelves in
  view, no page errors. The Playwright First Person subset fails the same
  Chromium tests with and without this change (slow-frame timeouts in this
  environment: 5 failures on the base, 4 with it); WebKit passes.

## Follow-ups

1. **Coffee machine (done).** `drawCoffeeMachine` and `drawOutOfOrderTape`
   moved into `library/anime-furniture.js` with `coffeeMachineLayout`
   (Top-Down's call trace unchanged). A 0.4 × 0.5 × 0.4 machine on a 0.9 m
   stand in the library's wood, textured per layout region with a recessed
   bay, proud tray, hanging group head and spouts, and a trapezoid hopper.
   The art carries the tape on Coffee Machine Broken days through `FP_ART`'s
   `stateKey`. 60 fps in headless Chromium.
2. **Elevator (done).** `elevatorLayout`, `ELEVATOR_COLORS` and optional
   `height`/`pulse` on Hospital's `drawElevator`; both games' Top-Down
   drawing byte-identical by call-trace diff. The mesh faces −Z (new geom
   helpers `artBackUV`/`textureBack`), each door panel wears its own door
   region as it slides, on a wall section in the station's tile colour.
   **Stairs (done), by the geometry technique**, since `drawStairs` is a plan
   view: steps in `stairStepColor`'s ramp with plum nosings, the two-tone
   rail, and only the arrow badge textured. The mesh was also **turned to
   face the player**: it used to start at the station centre and climb
   toward +Z, away from the approach, so a player at the interact spot stood
   inside it facing its solid back while the camera climbed the other way.
   It is now centred on the station with its foot toward +Z, climbing toward
   −Z as `transitionCamera` does.
3. The five plain-box stations, if wanted later.
4. Wire `doorOpen` into the scene (needs it in the mesh memo key, and a
   choice of whether open doors retract behind the wall), and make the
   stairs climb (`STAIRS_STEPS` 10) match the 8-step mesh.
