# Library Shift — First-Person Stations and Decor Referenced to the 2D Art

Date: 2026-11-13
Status: Implemented

## Goal

Bring the last First Person meshes that do not follow
`docs/skills/2d-to-3d/SKILL.md` up to it, so that every object in the FP
camera reads as the same object as its Top-Down art. This continues
`2026-11-07-library-fp-prop-art-design.md`, which left these stations out.

## Decisions (confirmed with the user)

1. **Scope: Front Desk, Fines Counter, Return Cart, Reading Nook, and the
   four decor props** (water cooler, plant, ladder, waiting chairs). The
   bookshelf, coffee machine, elevator, Boss's Office, stairs, cart books,
   Min-jun and the shared character mesh are already converted and are not
   touched. More characters getting their own mesh is a separate project.
2. **Technique per part, as the skill splits it**: a part whose 2D is a flat,
   readable front wears the drawer's art as a texture; a part whose 2D is a
   3/4 sprite or a small round object is geometry in the drawer's exported
   colours. Geometry-only everywhere and one-card-per-object were both
   rejected (the first loses line art and lettering, the second is a
   billboard).
3. **Real-world sizes stay.** Meshes keep their metre-scale footprints
   (`UNIT_SCALE` 40).

## The problem, seen

| Mesh | Today |
|---|---|
| `front-desk.js` | Plain boxes; 6 hex colours copied by hand; monitor is a blank pale rectangle on the −Z side; no plant, no heart, no shine band; bell is a cube |
| `fines-counter.js` | Plain boxes; 7 hand-copied colours; the `벌금 · FINES` plaque is a blank coral slab on the −Z side; register has no keypad; coins are square |
| `return-cart.js` | Plain boxes; 5 hand-copied colours; no `RETURNS` tag; square wheels; lower-tray book heights and colours invented, not the drawer's |
| `reading-nook.js` | Plain boxes; 7 hand-copied colours; rectangular rug (2D: an ellipse); no open book; box lamp shade (2D: a trapezoid) |
| `decor.js` | Reasonable silhouettes, but every colour is copied by hand from Hospital Shift's private decor drawers |

None of the four station meshes has a test file.

## Design

### Shared rules (from the skill)

For every object:

- The drawer exports what the mesh needs and **draws with those exports
  itself**: a `<NAME>_COLORS` table, and for textured objects a
  `<name>Layout(st, …)` function giving each part's rectangle in the
  drawer's centred px. Any parameter added to a drawer is optional and
  defaults to today's Top-Down value.
- **Top-Down stays byte-identical.** Before touching a drawer, record its
  canvas calls through a recording proxy; diff after. The trace must not
  change.
- A `paint<Name>Art(ctx, station, opts)` in the mesh module lays an opaque
  backing in the object's base colour, then calls the drawer at an art box
  of the mesh's own aspect. `library-game.js` registers it in `FP_ART`.
- Textured fronts are `unlit`; all other faces lit. Hidden faces are dropped
  (`boxWithout`), every face is wound outward and `cull: true`.
- Without art (node tests) the same faces render in the exported flat
  colours.
- **Facing.** All four current meshes put their detail on −Z. The bookshelf
  and Boss's Office face +Z toward the approaching player. Before dressing a
  front, confirm each station's interact side in the game (the e2e spot and
  the player's approach) and face the front that way.

### Front Desk (`drawFrontDesk`, texture + geometry)

- `frontDeskLayout(st)`, `FRONT_DESK_COLORS` exported from
  `library/anime-furniture.js`: counter body, top slab, monitor (stand,
  body, screen), book stack (three rects), bell, plant pot and leaves.
- Mesh: counter body and overhanging top slab; the body's front wears the
  counter region (shine band, heart, plum outline) and the slab's front edge
  its own region. Monitor: a thin box on a stand, its front wearing the
  body-plus-screen region (the three book covers and the caption line).
  Book stack: three boxes at the drawer's offsets and colours. Bell: a
  low dome (`prism`) on a base with a button. Plant: a tapered pot with
  three leaf blobs (reusing decor's leaf blob).
- Art box: the station's own aspect is `FRONT_DESK_WIDTH × size`; the art is
  drawn at an aspect that makes the counter front match the mesh's counter.

### Fines Counter (`drawFinesRoom`, texture + geometry)

- `finesRoomLayout(st)`, `FINES_ROOM_COLORS`: plaque, counter body, counter
  top, register (display housing, display, body, keypad), coin stacks.
- Mesh: counter body and top with the front wearing its region (heart
  included). The plaque is a sign standing proud above the counter wearing
  its region, so `벌금 · FINES` is legible in FP. Register: body with the
  keypad on its front and the display housing above it, both textured.
  Coin stacks: 8-sided discs alternating `gold`/`goldDeep`, 4 and 2 high as
  the drawer draws them (today 3 and 2).
- The room's tile grid and lamp glow are floor dressing, not part of the
  counter; they stay out of the mesh. The art backing is the counter colour.

### Return Cart (`drawReturnCart`, texture + geometry)

- `returnCartLayout(st)`, `RETURN_CART_COLORS`, and
  `returnCartDecorBooks(tray)` (the drawer's own colour order and height
  formula `13 + (i * 7) % 5`) exported; the drawer draws from them.
- Mesh: two trays whose front lips wear the wood region; four posts and the
  angled handle in the frame colour; the `RETURNS` tag as a textured sign
  above the top tray, mounted where it does not hide the tray's real books;
  lower-tray decorative books from `returnCartDecorBooks`; round wheels
  (8-sided) with hubs.
- `RETURN_CART_BOOK_SLOTS`, `RETURN_CART_VISIBLE_BOOKS` and the top tray's
  height are unchanged, so the scene's real cart books and
  `scene.test.js` are unaffected.

### Reading Nook (`drawReadingNook`, geometry)

The drawer is a 3/4 sprite, so no front texture.

- `READING_NOOK_COLORS` exported (rug, chair, arm = `tint(pink, -0.12)`,
  cushion = `tint(pink, 0.2)`, leg, lamp pole, lamp base, shade, book); the
  drawer draws with them.
- Mesh: an elliptical rug (a flat 12-sided disc in the 2D's proportions);
  the armchair with rounded seat, back and arms (`prism`/`loft` with
  chamfered rings rather than cubes); the seat cushion; the open book on
  the seat (two tilted page quads); four legs; the lamp as a pole, a base
  disc and a tapered shade open top and bottom.
- The lamp's radial glow is a 2D overlay with no solid counterpart; the
  shade is `unlit` so it reads as lit, and no glow geometry is added.

### Decor (`drawWaitingChairs`, `drawWaterCooler`, `drawPlant`, `drawLadder`)

- `hospital/anime-furniture.js` exports `DECOR_COLORS` (per kind) and its
  four drawers draw with it. Hospital Shift's Top-Down trace must stay
  byte-identical too, since both games draw decor with these.
- `decor.js` imports the table and drops its hand-copied constants. The
  chair seat becomes the drawer's `tint(back, -0.05)` computed from the
  shared colour instead of three copied hexes.
- Silhouettes change only where the side-by-side shows a mismatch (known:
  the cooler's taps are on −Z; check against the approach side).

### Wiring (`library-game.js`, `scene.js`)

- `FP_ART` gains `front-desk`, `fines-counter` and `return-cart` entries
  (`{w, h, paint}`; none has state, so no `stateKey`). `scene.js` already
  passes `{art}` to every builder in `BUILDERS`; the builders gain an
  `{art}` parameter and nothing else changes there.
- Reading Nook and decor take no art.

## Testing

Per mesh, a `meshes/<name>.test.js` (`node --test`, no DOM):

- size and base on the floor; the art box has the textured part's aspect;
- each textured face maps exactly its layout region and stays on the image;
- no untextured face coplanar with a textured front;
- `cull` set on every face and correct rendered from front and behind
  (`buildDrawList`);
- flat fallback colours equal the drawer's exports;
- a face budget, and determinism;
- `paint<Name>Art` lays the opaque backing before the drawer's first call.

Plus: the drawers' Top-Down call-trace diffs (Library and Hospital), the
existing `scene.test.js`/`labels.test.js` still passing (label anchors read
mesh heights), `npm run test:unit`, `make check`, and the Library Playwright
specs.

## Verification by eye

A throwaway harness under `/tmp/claude/fp-stations/` renders each 2D drawer
beside its mesh, facing it, at an angle and at interact range. Then the real
game on a port other than 8080, with a frame-time check on the 1st Floor
(the densest: desk, cart, fines counter, coffee machine, shelves).

## Delivery

One commit per object, each with its tests and its doc update
(`docs/features/library-first-person-3d.md`, `library-game.md`, and
`hospital-shift.md` for the decor exports): Front Desk, Fines Counter,
Return Cart, Reading Nook, decor.

## Out of scope

- Already-converted meshes, and `station-box.js` (the fallback for kinds
  without a builder; no Library station uses it once these land).
- Own meshes for more characters.
- Decor kinds with no mesh today (`cafe-table`, `vending-machine`,
  `iv-pole`, `security-desk`).
