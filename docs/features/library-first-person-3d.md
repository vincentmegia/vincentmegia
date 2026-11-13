# Feature: Library Shift first-person 3D renderer

## Status

`Shipped` (branch `fp-3d`); Top-Down ↔ First Person parity is `Planned`
(see Camera parity)

## Summary

Library Shift's First Person camera is a software-3D renderer that draws
flat-shaded, painter-sorted polygons onto the existing 2D canvas (no WebGL,
no dependencies). Its objects are referenced to their Top-Down 2D art
(`docs/skills/2d-to-3d/SKILL.md`): characters are built from the same design
the 2D draws; the bookshelf, coffee machine and elevator wear their 2D
drawer's own art as a texture; and the stairs (whose 2D is a plan view) are
geometry in their drawer's own colours with a textured arrow badge. It
replaced the older billboard-sprite view. Parent doc:
`library-game.md`.

## Scope

**In scope:** the room shell, stations, queue characters and Return Cart
books drawn as 3D meshes; jump, ↑/↓ pitch and sprint FOV as camera effects
(no head-bob or strafe roll: the view holds still while walking); the
animated elevator ride (with its doors) and stair climb in First Person.

**Out of scope:** Top-Down art (unchanged, detailed 2D); interaction and
targeting (still `library/first-person.js`); textures other than a 2D
drawer's own art; z-buffer, lighting beyond one directional light plus ambient.

**Required, not yet built:** full parity with Top-Down — every person,
prop, decor item, label and interaction Top-Down has, in FP too (ambient
staff included). See Camera parity for the requirements and work
breakdown.

---

## Architecture

All under `web/static/js/library/three-d/`. Everything except the canvas
call in `drawScene` is pure and DOM-free.

| File | Role |
|---|---|
| `core.js` | Column-major `Mat4` math, `cameraFromPose`, `projectPoint`, `shadeColor`, `buildDrawList`, `drawScene` |
| `room.js` | `buildRoom({width, depth, height, tileSize, tileColor, decals, wallArt})`: the checker floor, floor decals, ceiling, four walls (the back one with its art), wainscot, rail, windows, light fixtures; `WALL_ART_TOP` |
| `scene.js` | `buildFirstPersonScene(...)` assembles `{camera, placed}` per frame and memoises the room per floor; `meshForStationKind`; the `ROOM_HEIGHT`, `BASE_EYE`, `UNIT_SCALE`, `NEAR`, `FAR` constants |
| `../floor-dressing.js` | Shared with Top-Down's `drawFloor`: `FLOOR_TILE`, `WALL_BAND_HEIGHT`, `FLOOR_TILES`, `GUIDE_STRIPES`, `LIBRARY_SIGNS`, `BACK_WALL`, `WALL_ART`, `floorRug`; the painters (`drawBackWall`, `drawLibrarySign`, `drawWallBookShelf`, `drawWallSakura`, `drawWallClock`, `drawStitchedRug`, `drawGuideStripe`); for FP, `tileColor`, `floorDecals`, `roomArtRect`, `paintRoomArt`, `ROOM_ART_SCALE` |
| `transitions.js` | Pure elevator/stairs state machine: `createTransition`, `updateTransition`, `transitionCamera`, `forceComplete` |
| `labels.js` | World-anchored label chips (P5): anchor heights from the drawn meshes, distance fade, occlusion by stations, HUD avoidance, declutter and draw order — `layoutLabels`; see "World-anchored labels" |
| `meshes/geom.js` | Shared primitives every mesh is built from: `emptyMesh`, `merge`, `box`, `prism`, `quad`, `translate`, `scaleMesh`, `scaleAbout`; and for props wearing 2D art, `boxWithout` (a box minus its hidden faces), `artFrontUV`/`textureFront` (show an art rect on a box's +Z front) and their −Z twins `artBackUV`/`textureBack` |
| `meshes/*.js` | One builder per object: `character.js`, `bookshelf.js`, `station-box.js`, `coffee-machine.js`, `stairs.js`, `elevator.js`, `front-desk.js`, `return-cart.js` (with `RETURN_CART_BOOK_SLOTS`), `book.js` (a Return Cart book), `fines-counter.js`, `boss-office.js`, `reading-nook.js`, `decor.js` (four props plus `meshForDecorKind`) |

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

`buildCharacter` is **memoised on the design object's identity** (a `WeakMap`,
one slot each for calm and angry). `buildFirstPersonScene` runs per frame and
rebuilt every visible character every time — about 0.074 ms each, against
effectively nothing for a cache hit. Identity, not `design.key`: the roster's
designs are stable module-level objects, so identity hits every frame just as a
key would, but a key *collides* — `{ ...design, outfit: other }` keeps the key
while being a different character, and would be served the original's mesh.
Keying on `design.key` fails seven tests in the suite for exactly that reason.
The returned mesh is **shared, so treat it as read-only**; `buildDrawList` does,
mapping each vertex into world space rather than moving it. A design built fresh
on every call simply misses the cache, as before.
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
vignette, interact flash, world-anchored labels, crosshair, minimap). `fpCameraParams` maps the
effect state to camera params. `first-person.js` is still the projection
used for `findInteractTarget`; it does not draw.

### The prop meshes

A prop with a flat, readable front wears **its own Top-Down drawer's art**
(`docs/skills/2d-to-3d/SKILL.md`; design:
`docs/superpowers/specs/2026-11-07-library-fp-prop-art-design.md`): the
bookshelf, the coffee machine, the elevator and the Boss's Office. The stairs' 2D (`drawStairs`)
is a plan view, which can't be worn as a front, so the stairs are geometry
built from that drawer's exports plus one textured part, the arrow badge. The
other stations are geometry in their drawers' colours (see Known gaps).

`library-game.js`'s `FP_ART` is one entry per kind whose mesh wears art,
`{w, h, paint(ctx, station), stateKey?(station)}`: `fpArtFor` paints a canvas
of `w × h` image px once per `${station.id}|${stateKey}` and hands it to the
scene as `artFor`, so art that depends on game state (the coffee machine's
tape) is painted again only when that state changes, and the scene rebuilds
just that mesh.

| Piece | Where | Role |
|---|---|---|
| `bookcaseLayout(st, rows = 2)` | `library/anime-furniture.js` | Where `drawBookcase` puts the case, sign, back panel and each shelf's plank; `drawBookcase` draws from it, the mesh maps onto it |
| `drawBookcase(ctx, st, {color, sign, titles, rows?})`, `BOOKCASE_COLORS` | `library/anime-furniture.js` | The 2D drawer (Top-Down draws 2 rows) and its case/back/plank colours |
| `BOOKSHELF_SIZE`, `BOOKSHELF_ART`, `ART_SCALE` | `meshes/bookshelf.js` | 1.0 × 2.0 × 0.35 units; the art box `{w: 124, h: 242, rows: 4}` (its case inset is exactly the mesh's 1:2); 3 image px per art px |
| `paintBookshelfArt(ctx, station, drawOpts)` | `meshes/bookshelf.js` | Paints an opaque case-colour backing, then `drawBookcase` at `BOOKSHELF_ART` |
| `buildBookshelf({art})` | `meshes/bookshelf.js` | Crown (with the sign), plinth and sides at the front plane, four spine rows recessed 0.07, four plank lips 0.01 proud; each front textured with exactly its layout region; 37 faces, all `cull` |
| `bookcaseDrawOpts`, `FP_ART.bookshelf` | `library-game.js` | The one set of draw options Top-Down and FP share (so both show the same books), and the bookshelf's art entry |
| `coffeeMachineLayout(st)`, `drawCoffeeMachine(ctx, st)`, `COFFEE_MACHINE_COLORS` | `library/anime-furniture.js` | Where the coffee machine's drawer (moved out of `library-game.js`) puts the hopper (a trapezoid), body, band, display, buttons, bay, group head, spouts, drip, cup, tray, grate and steam. Widths come from `st.w`; the top hangs from `-h/2` and the bay's contents stand on `h/2`, so a taller box only grows the bay. `ground` is the station tile, `hopperSolid` the glass over it |
| `drawOutOfOrderTape(ctx)`, `OUT_OF_ORDER_TAPE_COLORS` | `library/anime-furniture.js` | The Coffee Machine Broken hazard tape, drawn by Top-Down's `drawCoffeeOutOfOrder` and painted into the FP art |
| `COFFEE_MACHINE_SIZE`, `COFFEE_MACHINE_STAND`, `COFFEE_MACHINE_ART`, `ART_SCALE` | `meshes/coffee-machine.js` | A 0.4 × 0.5 × 0.4 machine on a 0.6 × 0.9 × 0.5 counter-height stand (so it reads at eye height); the art box `{w: 84, h: 94.5}` (body plus hopper exactly 0.4 : 0.5); 4 image px per art px |
| `paintCoffeeMachineArt(ctx, station, {outOfOrder})` | `meshes/coffee-machine.js` | Opaque backing, then `drawCoffeeMachine`, then a 0.5 px band-coloured seam under the hopper (the renderer's 0.6 px seam grow would otherwise show the glass on the head's top edge), then the tape if out of order |
| `buildCoffeeMachine({art})` | `meshes/coffee-machine.js` | A stand in the bookcase's wood (`BOOKCASE_COLORS`); head and jambs at the front plane, the bay's back recessed 0.07 with its walls and a tray floor, the group head and two spouts hanging in the bay, the drip tray's lip 0.03 proud, the hopper a trapezoid mapped corner for corner. 43 faces (9 textured), all `cull` |
| `FP_ART['coffee-machine']` | `library-game.js` | `stateKey` is `'out'` on a Coffee Machine Broken day (`coffeeOutOfOrder()`, the one check Top-Down shares), so the taped canvas is painted once and the mesh rebuilds once |
| `elevatorLayout(st, {height})`, `drawElevator(ctx, st, {t, height?, pulse?})`, `ELEVATOR_COLORS` | `hospital/anime-furniture.js` | Where Hospital Shift's elevator drawer (Library draws with it too) puts the indicator plate, label, frame, doors (with shines), call panel and button. `height` (default `st.w`) stretches only the vertical runs and `pulse` fixes the button's glow; Top-Down passes neither. `ELEVATOR_COLORS.tile` is the station tile both games draw it on (`elevator.test.js` pins it to both games' `STATION_COLORS.elevator`) |
| `ELEVATOR_SIZE`, `ELEVATOR_ART`, `ELEVATOR_ART_SCALE` | `meshes/elevator.js` | The frame is 1.4 × 2.2 and the car 1.1 deep; the art box `{w: 84, h: 114}` makes the drawer's frame exactly 1.4 : 2.2; 3 image px per art px |
| `paintElevatorArt(ctx, station)` | `meshes/elevator.js` | Opaque tile backing, then `animeTile`, then `drawElevator` at `ELEVATOR_ART` with `pulse: 1` (painted once, so it does not pulse in FP) |
| `buildElevator({art, doorOpen})` | `meshes/elevator.js` | Faces −Z (art x maps to model −x, so the call panel is on the viewer's right). A tile-coloured wall section that carries the indicator and call panel (so the mesh is 2.1 × 2.7 overall), the frame 0.03 proud, the door panels recessed 0.015 behind the frame's face, and the car (ceiling, back wall, and the frame's back seen from inside). Opening, each door slides away behind its post, clipped to the doorway: what is left shows the inner part of its own door region (uv follows the visible part), so the doors never leave the doorway or cover the indicator or call panel; fully open they are gone. The door backs (and, shut, a strip over the 2D seam) face into the car. 56 faces shut, 49 fully open (12 / 10 textured), all `cull` |
| `elevatorDoorOpts(open)`, `ELEVATOR_DOOR_STEPS` | `meshes/elevator.js` | The `optsFor` value for a door opening: `{doorOpen}` quantised to 1/16, or `undefined` when shut so a closed elevator keeps the memo entry it has on approach. A ride rebuilds the ridden car's mesh at most 16 times opening (`scene.test.js` counts it over a simulated ride) instead of every frame |
| `elevatorRiderPose(station, unitScale)`, `isInElevatorCar(station, pos, unitScale)`, `ELEVATOR_CAR_STAND_Z` | `meshes/elevator.js` | Where an FP rider stands (0.85 back in the car, facing out: facing 0) and whether a game-px point is in the car or its doorway (where held doors stay open) |
| `bossDoorLayout(st, height = st.h)`, `drawBossDoor(ctx, st, {height?})`, `drawBossLock(ctx)`, `BOSS_DOOR_COLORS` | `library/anime-furniture.js` | Where the Boss's door drawer puts the frame, door, plaque, knob and padlock badge; `height` draws it into a taller box than the tile (Top-Down passes none, and its call trace is unchanged). `drawBossLock` is the padlock badge Top-Down's `drawStation` draws over the locked door (moved out of `library-game.js`). `BOSS_DOOR_COLORS.tile`/`tileLocked` are the tile it stands on |
| `BOSS_OFFICE_SIZE`, `BOSS_OFFICE_ART`, `BOSS_OFFICE_ART_SCALE` | `meshes/boss-office.js` | A 1.2 m frame around a ~1.05 × 2.05 m door in a 1.63 × 2.32 m wall section, the office running 2.5 back toward the north wall; the art box `{w: 84, h: 124}` gives the door a real door's aspect; 3 image px per art px |
| `paintBossOfficeArt(ctx, station, {locked})` | `meshes/boss-office.js` | Opaque tile backing (grey while locked), then `animeTile`, then `drawBossDoor` at `BOSS_OFFICE_ART`, then `drawBossLock` while locked |
| `buildBossOffice({art, locked})` | `meshes/boss-office.js` | Faces +Z toward the approaching player. A small office: lit tile-coloured sides, roof and back, its front a wall section (either side of the frame and a header) wearing the tile art, the frame 0.04 proud, the door recessed 0.02, the knob and (locked) padlock badge proud of the door, and the BOSS plaque proud over the lintel. 34 faces unlocked, 39 locked (9 / 10 textured), all `cull` |
| `FP_ART['boss-office']`, `bossOfficeLocked()` | `library-game.js` | `stateKey` is `'locked'` while the office is locked (all shift and through the closing wait; the one check Top-Down's tile, the inventory and `optsFor` share), so the greyed, padlocked canvas is painted once per state |
| `STAIRS_COLORS`, `STAIRS_RAIL`, `STAIRS_BADGE`, `stairStepColor(i, steps = 5)`, `stairsArrowDir(st)`, `drawStairsBadge(ctx, x, y, dir)` | `hospital/anime-furniture.js` | What `drawStairs` draws with: the step ramp (exact for 5 steps, spread over more), the edge/shadow/rail/badge colours, the rail's 5 px ink under 3 px wood, and the up/down badge |
| `STAIRS_SIZE`, `STAIRS_BADGE_ART`, `BADGE_ART_SCALE` | `meshes/stairs.js` | 1.12 wide × 1.44 tall × 2.24 deep for 8 steps (rise 0.18, run 0.28, unchanged); the badge art box 24 × 24 at 8 image px per art px |
| `paintStairsBadgeArt(ctx, station)` | `meshes/stairs.js` | Opaque step-colour backing, then `drawStairsBadge` pointing the station's way |
| `buildStairs({steps?, art?})` | `meshes/stairs.js` | Centred on the station, foot facing +Z toward the approaching player, climbing toward −Z (the way `transitionCamera` moves). Treads in the ramp, risers under the 2D shadow, plum nosings, pastel stringers with plum tops, the two-tone rail on the left between two newels, and the badge sign at the foot on the right (textured, `unlit`; flat white without art). 85 faces, all `cull` |

| `drawReturnCartCover(ctx, x, y, w, h, color, title, isCoinHunt, {shadow?})`, `drawCoverTitle`, `fitTitleLines`, `titleInkFor`, `returnCartStar`, `RETURN_CART_COVER` | `library/book-cover.js` | Top-Down's Return Cart cover (moved out of `library-game.js` with its title helpers; Top-Down's call trace is unchanged): drop shadow, genre colour, spine shine, plum line art, the fitted title in ink chosen by cover brightness, and the Coin Hunt star centred on the cover's top-right corner, overhanging it. `shadow: false` drops the shadow for FP |
| `BOOK_SIZE`, `BOOK_ART`, `BOOK_ART_SCALE`, `BOOK_PAGES` | `meshes/book.js` | A 0.25 × 0.333 × 0.06 book (the 2D cover's 30 : 40); the art box `{w: 40, h: 52}` is the cover plus room for the star's overhang; 4 image px per art px; fore-edge and top in `ANIME.paper` |
| `paintReturnCartBookArt(ctx, {title, color, isCoinHunt})` | `meshes/book.js` | Opaque ink backing, the cover rect in the genre colour (the 2D's rounded corners would show the backing), then `drawReturnCartCover` without its shadow |
| `buildBook({art, color, isCoinHunt})`, `starOverhang()` | `meshes/book.js` | A box without its bottom, cover (+Z, textured, `unlit`) and spine (−X) and back in the genre colour. On a Coin Hunt book the star's part *outside* the cover (its five kites, grown by the outline, clipped to the right of and above the cover) is extra faces in the cover's plane wearing the same canvas; inside the cover the star is already in the cover's pixels. Nothing overlaps the cover, so the painter's sort never has to pick. 5 faces, 11 with the star (the test budget is 24); all `cull`; flat genre colour / gold without art |
| `RETURN_CART_BOOK_SLOTS` | `meshes/return-cart.js` | The five Top-Down slots (`returnCartSlots`) as base points on the cart's top tray, left to right seen from the cart's front, 0.29 apart inside the posts. The cart's own decorative books moved to the lower tray (the 2D cart has books on both) |
| `cartBooks`, `bookArtFor`; `fpBookArtFor` | `scene.js`; `library-game.js` | `drawFirstPersonView` passes the inventory's `return-cart-book` items as `{id, title, color, isCoinHunt}` (colour as `drawReturnCartBooks` picks it); the scene stands the first five on this floor's cart, each mesh memoised on `id|title|coin|colour` and art. `fpBookArtFor` paints one canvas per the same key. Both caches clear at 64 entries, since books come and go |

Textured fronts are `unlit` (the 2D art carries its own top-lit gradients);
sides, tops and backs stay lit so each prop reads as solid. Without `art`
(node tests) the same faces take the drawer's exported flat colours.
`buildFirstPersonScene` asks `artFor(station)` for each same-floor station
with its own mesh, and `optsFor(station)` for any extra build options that
station's kind needs (the Boss's Office's `{locked}`, the elevator's
`{doorOpen}` from `elevatorDoorOpts`). The mesh is memoised
per station object, art, builder and those options serialised, so a station
whose state flips rebuilds and one that holds still does not.

### The room dressing (per floor)

The room is Top-Down's own floor and back wall (`drawFloor`), built from
`library/floor-dressing.js`, which `drawFloor` paints from too (it holds the
constants and the painters moved out of `library-game.js` verbatim, so
Top-Down's pixels are unchanged; outside the clock, whose time moved, the
wall band diffs to zero pixels before/after).

| Piece | First Person |
|---|---|
| Checker tiles | One ground face per 40 px `FLOOR_TILE` (24 × 15), coloured `tileColor(floor, col, row)`: `FLOOR_TILES[floor].dark` on even (row + col), otherwise `drawAnimeTiles`' gradient (`tint(light, 0.3)` under the wall band down to `light`) sampled at the row's centre. 1st Floor mint, 2nd Floor cream. Wound to face up, so the floor takes full light (it used to face down and render at the ambient 0.5) |
| Guide stripes (1F) | `floorDecals` cuts each `GUIDE_STRIPES` stripe at the tile grid (and at the rug's edges); each piece is a flat face in the stripe's rgba composited over its own tile (`blendOver`), so it reads as Top-Down's translucent stripe. The part under the rug is the rug art's |
| Rugs (1F Coffee Machine, 2F Reading Nook) | `floorRug` (drawFloor's placement); one decal face wearing `paintRoomArt(…, 'rug')`: the tiles, stripes and `drawStitchedRug` of exactly that box at `ROOM_ART_SCALE` 4 |
| Back wall (z = 0) | `BACK_WALL`'s colours on every wall: cream wall, blush wainscot, pink rail with the plum trim under it, plum baseboard. The back wall is `unlit` (it *is* Top-Down's band, and its art needs no darkening overlay); the other walls stay lit |
| Sign, sakura, wall shelf, wall clock | `WALL_ART` boxes (band px) cut out of the back wall and filled with `paintRoomArt`'s canvas of the same painter, at the same x, band y mapped to height `WALL_ART_TOP − y` (1:1, so above the rail at 135) |

Decals are a **second ground pass**: their faces carry `ground` and `decal`,
and `buildDrawList` sorts floor tiles, then decals, then everything else, so a
nearer tile can never cover a farther rug. Wall art is coplanar with the wall
but never overlaps a wall face (the wall is emitted around the boxes).

`library-game.js`'s `fpRoomArtFor(id)` hands the scene one canvas per floor
and piece, painted once; the clock's is repainted in place only when its
label (the HUD's `inGameTimeLabel` minute) changes, the `FP_ART` stateKey
pattern. Textures are read at draw time, so the repaint needs no mesh
rebuild; the scene rebuilds the room only when the floor, the decals or an
art canvas's identity changes. `getFpRoomArt()` on the test hooks lists each
canvas's key, stateKey and paint count.

### Data shapes (JSDoc in `core.js`)

* `Vec3` = `[x, y, z]`.
* `Mesh` = `{vertices: Vec3[], faces: Face[]}`; `Face` = `{indices: number[],
  color: string, unlit?: boolean, cull?: boolean, texture?: Texture}` with
  color `#rgb`, `#rrggbb` or `rgb(r,g,b)`; `unlit` skips scene lighting (see
  Rendering model). Faces are convex polygons (3+ indices), wound
  counter-clockwise seen from outside: the normal comes from the first three
  vertices, and a face lit from behind gets only the ambient term. Back-face
  culling is **opt-in per face**: `cull` drops a face turned away from the
  camera. Only meshes whose winding a test checks from both sides set it (the
  bookshelf, coffee machine, elevator and stairs); the room shell and
  characters don't.
* `Texture` = `{image, uv, div?}` on a 4-index face: `image` any canvas image
  source, `uv` one `[u, v]` in image px per index, `div` the `[nu, nv]` cells
  (default `[1, 1]`). The mapped region must be opaque.
* `Placement` = `{pos: Vec3, yaw, scale, alpha?}`; `yaw` is radians about +Y,
  `scale` a number or `Vec3`. Order is scale, yaw, translate. `alpha`
  (default 1) is a paint property only — `buildDrawList` copies it onto
  every poly the placement yields and both paint paths honour it, but it
  changes neither geometry nor colour, so a translucent mesh sorts and
  shades exactly as the opaque one does.
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

**Off-screen faces are dropped.** Only the near plane is clipped, so
`drawScene` passes `cullOffscreen` and `buildDrawList` drops any face (flat,
textured cell or near-clipped fallback) whose screen polygon lies wholly off
one side of the viewport; the 2D checker floor's 360 tiles made that matter
(705 polys a frame down to 280 at the harness pose). A bare `buildDrawList`
call keeps them, as the tests expect.

**Ground is its own layer.** A mean depth is wrong for a wide, near-horizontal
face: the floor tile a patron *stands on* can have a nearer centroid than the
patron, so a plain depth sort paints the floor over their legs and feet. (It
did: a patron at interact range kept only the top quarter of their legs and
never showed their shoes at all.) So every face a mesh marks `ground` — only
`room.js`'s floor does — sorts as a layer before everything else, each layer
still back to front within itself, which keeps the floor's own overlap and fog
gradient. Within the ground, faces also marked `decal` (stripes, rugs) are a
second pass after every tile. This is sound because the floor is the shell's lowest surface:
everything in the room rests on it, so it can never *legitimately* occlude any
of it, while the walls rise from its edges and the ceiling is above, so neither
overlaps a floor tile on screen. `room.test.js` pins that exactly the floor
carries the flag (a wall or the ceiling in that layer *would* occlude wrongly),
`core.test.js` pins the layer order, and `scene.test.js` renders a patron at
interact range with and without the floor behind them and requires every row of
their legs to win a pixel.

**Textured faces** are cut into `div` cells, bilinear in world and uv space,
and each cell is emitted as two triangles with their own depth. A cell the
near plane cuts is emitted as a flat clipped polygon in `face.color`, so it
leaves no hole. `drawScene` maps the image onto each triangle through the
affine transform from its uv triangle (canvas 2D has no perspective divide,
which the small cells hide), clipped to the triangle grown by 0.6 px so
cells meet without a seam, and sampling only that triangle's uv box. Darkening
by `1 - intensity` and fog are then painted over the exact triangle as
overlays, which is why the mapped region must be opaque.

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
  `TILE` = 120 units, so no single face spans the frame and each carries its
  own sort depth and fog). Tiling *narrows* a bad mean-depth sort but cannot
  fix one — halving a tile halves the error and doubles the polygons — so the
  floor's case is settled by the ground layer above, not by `TILE`. `TILE`
  stays for the per-tile fog gradient and near-plane clipping.
* **Coplanar-offset rule.** Faces that share a plane tie in the sort and
  z-fight. Sit details a small distance proud of their backing surface
  (`room.js` uses `PROUD = 0.1`; meshes use about 0.01 in unit space).
* **Textures are affine per triangle.** Perspective is only approximated by
  the `div` cells; a large textured face seen up close and edge-on will warp.
  Each cell costs a clip and an image draw, so keep `div` small (the bookshelf
  uses `[2, 1]` wide and `[1, 3]` tall; a floor with three shelves in view
  ran at 60 fps in headless Chromium, as did each of the other props in view).
  On a flat gradient (the elevator's tile) the cell-triangle seams can show
  as faint diagonal hairlines at interact range; busy art hides them.
* **Seam grow shows neighbouring art.** Each textured triangle is clipped to
  itself grown by 0.6 px, so it samples a sliver of the canvas just outside
  its region. Where a part's 2D neighbour is not its 3D neighbour (the coffee
  machine's head under the hopper's glass), paint a seam fill there in the FP
  art.
* **Near-plane clipping is per face, not per scene.** A face is cut against
  the near plane only; there is no side/top clipping, so off-screen geometry
  is still rasterized by the canvas.

## Tunables

| Name | Where | Value |
|---|---|---|
| `UNIT_SCALE` | `scene.js` | 40 (unit mesh to game px) |
| `BASE_EYE` | `scene.js` | 60 (eye height, game px) |
| `ROOM_HEIGHT`, `NEAR`, `FAR` | `scene.js` | 300, 1, 2000 |
| `FLOOR_TILE`, `FLOOR_TILES`, `BACK_WALL` | `library/floor-dressing.js` | 40 px; 1F `#e6f6f0`/`#d8efe7`, 2F `#f6efe4`/`#efe5d6`; `#fffaf3`/`#fdeef3`/`#ffd1e3`/plum |
| `WALL_ART_TOP` | `room.js` | 200 (wall height of the band's top; art at band y sits at 200 − y) |
| `ROOM_ART_SCALE` | `library/floor-dressing.js` | 4 image px per game px (rug and wall-art canvases) |
| `FP_BASE_VFOV_DEGREES` / `FP_SPRINT_VFOV_EXTRA` | `library-game.js` | 60 / +6 |
| `FP_LIGHT` | `library-game.js` | `{dir: [0.35, 1, 0.25], ambient: 0.5}` |
| `FP_FOG` / `FP_BACKDROP` | `library-game.js` | `{color: '#d8ccb0', start: 520, end: 1500}` / the same cream |
| `TILE` | `room.js` | 120 (longest edge of one shell face) |
| `ART_SCALE`, `RECESS`, `LIP` | `meshes/bookshelf.js` | 3 image px per art px; spine rows 0.07 behind the frame; plank lips 0.01 proud |
| `ART_SCALE`, stand | `meshes/coffee-machine.js` | 4 image px per art px; a 0.9 stand; bay back 0.07 behind the front, tray lip 0.03 proud |
| `ELEVATOR_ART_SCALE`, offsets | `meshes/elevator.js` | 3 image px per art px; frame 0.03 proud of the wall; doors 0.015 behind the frame's face (0.01 thick); indicator 0.02, call panel 0.03, button 0.005 proud; a rider stands 0.85 into the car |
| `BADGE_ART_SCALE` | `meshes/stairs.js` | 8 image px per art px (a 192 px badge canvas); nosings 0.006 proud of the riser |
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

**Elevator doors.** At the commit point an FP elevator ride also puts the
player in the new floor's car (`elevatorRiderPose`: 0.85 back from the
doorway, facing out), so the doors-open phase opens the doors in front of
them; the stairs still land at the floor's entry point, as Top-Down's
instant switch does for both. The ridden car alone gets the ride's
`doorOpen` (`fpOptsFor` → `fpElevatorDoorOpen` in `library-game.js`); it is
0 through doors-close and the rise, so the doors stay shut on approach and
while waiting, as before. After the ride `fpHeldDoors` keeps them open while
the player is in the car or its doorway (`isInElevatorCar`), then
`stepHeldDoors` (`transitions.js`) closes them at the ride's door speed
(0.6 s); leaving FP drops the hold. The `getElevatorDoorOpen()` test hook
returns the `doorOpen` this floor's elevator mesh is built with.

## How to add a new object mesh

Follow `docs/skills/2d-to-3d/SKILL.md` first: it decides whether the object
gets the 2D art as a texture (flat-fronted props) or measured geometry
(characters), and lists what the tests must pin.

1. Write `meshes/<name>.js` exporting `build<Name>(opts)` that returns a
   `Mesh`. Compose it from `meshes/geom.js`'s primitives — `box(min, max,
   color)`, `prism(rings, sides, capTop, capBottom)`, `quad(points, color)`
   — and `merge(target, part)`, which offsets the indices for you. Model
   space: base at y=0, centered on x/z, about one unit tall per metre, front
   facing +Z (or −Z, as the elevator does, toward the room from its south
   edge: use `textureBack`). Check the front faces the way the player
   actually approaches: the stairs used to face away from them.
2. Map the station kind to it in `scene.js`: add the entry to `BUILDERS`
   (`meshForStationKind(kind)` falls back to `buildStationBox` for unknown
   kinds). Builders are placed with `scale: UNIT_SCALE`, so no-arg
   builders work as is.
3. Offset detail faces slightly proud of their backing surface.
4. Add `meshes/<name>.test.js` (`node --test`): vertex/face counts, indices
   in range, bounds (base at y=0), and any colors that matter. Add a
   `scene.test.js` case if the mapping needs one.

## Camera parity (Top-Down ↔ First Person)

**Status: `Planned`.** The two cameras are two views of **one** game world.
Today the game state is shared (`player.x/y`, `currentFloor`, `shiftState`,
`ambient` all keep updating in either mode) but the First Person *scene*
only receives a subset of it, so flipping to 3D loses people, props and
information. This section is the requirement that closes that gap; each
work item below removes a row from the audit table when it ships.

### Requirements

* **P1 — One inventory, two renderers.** Both cameras draw from the same
  per-floor world inventory: a pure `worldInventory(floor, state)` returning
  every station, person, prop, decor item and state flag Top-Down draws.
  `render()`'s Top-Down branch and `drawFirstPersonView` both consume it;
  neither builds its own list (today `drawFirstPersonView` hand-picks queue
  slots and cart books, and `buildFirstPersonEntities` does the same).
* **P2 — Nothing disappears on a flip.** Every inventory item has an FP
  representation at the same `x`/`y`/floor, or is on the explicit
  exemption list below. A node test fails when an inventory kind has
  neither, so a new Top-Down object can't ship 2D-only by accident.
* **P3 — Flipping is lossless.** Switching cameras never changes game
  state: position, floor, shift clock, queues, carried book, open overlay,
  staff positions and actions are identical before and after, in both
  directions, any number of times. A ride/climb cut short by leaving FP
  lands on whichever floor the transition had committed to.
* **P4 — Same look, referenced to the 2D.** People are built from the design
  their 2D renderer draws; props wear their 2D drawer's art or colours
  (`docs/skills/2d-to-3d/SKILL.md`). State-dependent looks carry over: Boss's
  Office locked/unlocked, Coffee Machine out of order, ghost patrons
  translucent, Karen angry, Min-jun's current action.
* **P5 — Same information.** What a Top-Down chip tells the player (station
  names, staff names and help hints, patience bars, fine amounts, borrow
  titles, "Check out!", "Karen!", recommend bubble, "+N waiting", messy
  cart warning, OUT OF ORDER) is readable in FP — as world-anchored labels
  projected with `projectPoint`, shown for the crosshair target and nearby
  entities so the view doesn't drown in chips.
* **P6 — Same interactions.** Everything clickable in Top-Down is
  interactable in FP with the same result: stations, queue patrons, Return
  Cart books, **and the helpful staff** (Shelver, Ji-ho, Min-jun), which
  `buildFirstPersonEntities` doesn't list today.
* **P7 — World effects live in the world.** Effects drawn at world
  coordinates in Top-Down (hallucination shadow figures) are placed in the
  3D scene in FP, not painted at their 2D canvas coordinates over the 3D
  view. Screen-space HUD (bars, clock, daily chip, overlays) stays
  screen-space in both.

**Exempt (camera-specific by design):** Eun-mi herself (she is the FP
camera; FP shows the crosshair instead), Top-Down's hover/target rings
(FP's crosshair target highlight replaces them), FP's minimap, dust and
vignette, and the Boss cutscene / minigame overlays (full-screen in both).

### Audit (verified against the code, Nov 2026)

| Top-Down draws | Where | In FP today |
|---|---|---|
| Every floor-plan station | `drawStation` | ✅ all present; bookshelf, coffee machine, elevator, stairs referenced to 2D |
| Front Desk, Return Cart, Fines Counter, Reading Nook | `STATION_DETAIL_DRAWERS` | ✅ geometry meshes in `meshes/{front-desk,return-cart,fines-counter,reading-nook}.js` |
| Boss's Office | `drawBossDoor` | ✅ wears `drawBossDoor`'s art on a small office (`meshes/boss-office.js`) |
| Boss's Office locked state (grey + padlock) | `drawStation`, `drawBossLock` | ✅ `optsFor` passes `{locked}` to `buildBossOffice` and `FP_ART`'s stateKey repaints the art: grey tile + padlock badge, proud of the door |
| Front Desk / Fines queue patrons, Karen | `drawFrontDeskSlots`, `drawFinesCounterSlots` | ✅ built from the same design; each faces its own desk |
| Ghost patron (translucent, "???") | `drawFrontDeskSlots` | ✅ same shimmer alpha and drift via `placement.alpha`; "???" chip as a world label |
| Ambient staff: Security, Janitor, Shelver, Ji-ho (1F); Volunteer, Min-jun, Storyteller, Archivist (2F) | `drawAmbient` | ✅ design objects in `LIBRARY_STAFF_DESIGNS`, wired through `worldInventory` → `drawFirstPersonView` → `buildCharacter`; each faces the way it walks |
| Staff name chips and help hints ("click: shelve a return") | `drawAmbient` | ✅ world labels from `staffChips`; the crosshair target's chips also sit under the crosshair and in `#library-interact-hint` |
| Staff help interactions | Top-Down click | ✅ helpful staff are FP interact targets; interact runs `askStaffForHelp` |
| Return Cart books (genre colour, title, coin-hunt star) | `drawReturnCartBooks` | ✅ `meshes/book.js` on the cart's top tray, wearing `drawReturnCartCover`'s cover, star included; "+N more" as a world label |
| Decor: water cooler, 2 plants (1F); ladder, waiting chairs, 2 plants (2F) | `LIBRARY_DECOR` / `drawDecor` | ✅ geometry meshes in `meshes/decor.js`, placed from the inventory's `decor` items |
| Floor dressing: checker tiles, guide stripes, rugs, sunbeams; per-floor palette | `drawFloor` | ✅ per-floor checker, stripes and rugs from `floor-dressing.js` (sunbeams, tile sheen and grid lines ❌, see Known gaps) |
| Back wall: sign, sakura branch, wall book shelf, wall clock | `drawFloor` | ✅ textured boxes cut into the back wall at Top-Down's x; the clock shows the live time |
| Coffee Machine OUT OF ORDER | `drawCoffeeOutOfOrder` | ✅ tape, and the chip as a world label (`coffeeOutOfOrderChip`) |
| Queue/station label chips, patience bars, "+N waiting", "+N more", messy cart, Boss's Office countdown | slot drawers, `drawStation` | ✅ world labels from the same functions (`labelForStation`, `queueSlotChips`, `queueOverflowChip`, `returnCartChips`) |
| Hallucination shadow figures | `drawHallucinations` | ✅ dark camera-facing billboards (`meshes/shadow-figure.js`) at their world x/y, same fade/flicker alpha via `placement.alpha`; vignette, whispers, flicker and jump scare stay screen-space |
| Elevator doors | `drawElevator` | ✅ the ridden car's doors open during the ride (the rider stands in it) and close behind them; shut otherwise. Top-Down draws them shut and switches floors instantly |
| Where an elevator ride ends | `switchFloor` | ✅ both cameras land the rider in the new floor's car facing out (`switchFloor(floor, {viaElevator})` → `elevatorRiderPose`); the stairs and the HUD floor button land at the floor's entry point |
| Game state across a flip (P3) | `setCameraMode` | ✅ unchanged, mid-ride included (lossless-flip e2e, step 2) |
| Facing on entering FP | `setCameraMode` | ⚠️ reset toward the room centre on every flip (open question below) |

### Work breakdown

Ordered so each step is independently shippable; sizes are rough
(S < ½ day, M ≈ 1 day, L = several).

1. **~~Inventory + parity test (M)~~** ✅ — P1, P2. `world-inventory.js`
   (`worldInventory(floor, state)`), both renderers and
   `buildFirstPersonEntities` rewired to it, 14-test
   `world-inventory.test.js` with `FP_TODO_KINDS` that shrink as steps ship.
   `getWorldInventory()` exposed on `window.__libraryGameTestHooks`.
2. ✅ **Lossless-flip e2e (S)** — P3. `e2e/library-game.spec.js`, "First
   Person Mode › lossless camera flips (P3)": with the simulation frozen it
   snapshots both floors' `getWorldInventory`, `getShiftState` (carried
   book/fine included), position, floor, walk flag, queue/cart slots,
   overlay, active transition, scheduled events and hallucinations, flips
   with the real camera button three round trips, and asserts every
   snapshot deep-equal. Cases: a busy 1st Floor (cart books, one carried,
   borrows, a fine, a ghost patron), the 2nd Floor with that 1st Floor
   still queued, and leaving FP mid-transition (elevator in doors-close,
   rise and doors-open; stairs mid-climb). Facing is excluded on purpose
   (open question below). **Pinned behaviour:** leaving FP cancels an
   in-flight ride/climb outright (`setCameraMode` sets `fpTransition =
   null`, no forced completion), so the player stays on the floor already
   committed — the destination only once the elevator reached doors-open,
   the start floor for any unfinished climb — and re-entering FP does not
   resume it.
3. **~~Ambient staff in FP (L)~~** ✅ — P2, P4. `LIBRARY_STAFF_DESIGNS` in
   `library-people.js` (8 designs matching the 2D renderers' palettes),
   `findStaffDesign(key)`, wired into `drawFirstPersonView` via the world
   inventory. `staff-design.test.js` pins skin/hair/outfit colours to the
   2D.
4. ✅ **Character facing and state (S)** — P4. `placement.yaw` per
   character: queue patrons `atan2` towards their desk, ambient staff take
   the walker's own `a.facing` (set in `updateAmbient` from its step).
   `placement.alpha` threads through `buildDrawList` and both paint paths,
   so ghost patrons shimmer and drift as `drawFrontDeskSlots` paints them.
   Character meshes were already memoised on design identity
   (`meshes/character.js`'s `CACHE`).
5. ✅ **Staff interactions in FP (S)** — P6. `buildFirstPersonEntities`
   flags each `ambientStaff` entity `interactable: isHelpfulStaff(key)` (a
   `STAFF_HELP_TEXT` entry, or Min-jun; the same test `staffAtPoint` uses),
   and `findInteractTarget` skips `interactable: false` entities, so a
   future set-dressing walker can't hide a station behind it. Interact
   (Enter/Space, the Interact button, a pointer-locked canvas click) on a
   staff target calls
   `askStaffForHelp(key)`, the function Top-Down's click-then-walk ends in,
   so the rules (`staffHelpBlocker`/`staffHelp`/`askMinjunForHelp`) and
   toasts are shared. Decision: where Top-Down walks Eun-mi over, FP needs
   her within `DEFAULT_INTERACT_MAX_DISTANCE` (150 px), the gate stations
   already use; the staff member doesn't stop and wait, since she's already
   beside them. The crosshair shows the target's name as Top-Down's name
   chip, with the `ambientHint` chip ("click: tidy up" / "busy Ns") under
   it; `labelForFPTarget` puts `<name> — <hint>` in `#library-interact-hint`
   (which is hidden in fullscreen, hence the canvas chips). The hint keeps
   Top-Down's "click:" wording. Covered by `first-person.test.js` and two
   e2e tests (Janitor +Mood then busy, out-of-range; Volunteer on 2F).
6. ✅ **Remaining station meshes (L)** — P4. Front Desk, Return Cart,
   Fines Counter, Boss's Office (locked/unlocked via `optsFor`), Reading
   Nook: geometry-technique meshes in `meshes/` matching the 2D drawers'
   colours; `scene.js` BUILDERS map wired; boss locked state via `optsFor`
   callback.
7. ✅ **Return Cart books (S)** — P4. `meshes/book.js`: book meshes in the
   genre colour wearing Top-Down's cover (`drawReturnCartCover`, moved with
   `drawCoverTitle` into `library/book-cover.js`) as art, Coin Hunt star
   included, standing on the cart's top tray in slot order (up to five).
   **Decision:** in Top-Down the covers are laid out in a row just below the
   cart; in FP they stand *on* the cart, and the interaction anchors stay at
   the Top-Down slot points (see Known gaps).
8. ✅ **Decor meshes (M)** — P2, P4. `meshes/decor.js`: water cooler,
   plant, ladder and waiting chairs as geometry in `drawDecor`'s own
   colours (its drawers are 3/4 sprites, not plan views, so there is no
   front texture to wear). `buildFirstPersonScene` takes a `decor` list
   and memoises one shared mesh per kind. `meshes/decor.test.js` pins the
   kinds Library places, their standing heights and those colours.
9. ✅ **Room dressing per floor (M)** — P4. `library/floor-dressing.js`
   holds `drawFloor`'s palettes, placements and wall painters for both
   cameras; `buildRoom` takes the 40 px checker (`tileColor`), floor decals
   (stripes as flat composited pieces, rugs textured) and back-wall art
   (sign, sakura, wall shelf, live wall clock) as textured boxes; see The
   room dressing. `room.test.js` and `floor-dressing.test.js` pin the
   palette, decal and art placement, and FP's art to Top-Down's own
   painter calls. Measured in headless Chromium at 6× CPU throttle,
   facing the back wall from (480, 420): 1F 32.7 → 31 fps, 2F 24.7 →
   22–25 fps (unthrottled both stay at the 60 fps cap), after adding
   off-screen culling to `drawScene`.
10. ✅ **World-anchored labels (M)** — P5. `three-d/labels.js`'s
    `layoutLabels` projects each entity's label stack with `projectPoint`
    and the frame's camera, fades, occludes, declutters and depth-sorts it;
    `drawFpLabels` draws the chips with `drawLabelChip`. The text comes from
    one shared function per entity that Top-Down's drawers now call too
    (see "World-anchored labels"). `getFirstPersonLabels()` on
    `window.__libraryGameTestHooks` exposes the laid-out model.
11. ✅ **Hallucinations in 3D (S)** — P7. `three-d/shadow-figures.js`
    turns the inventory's `hallucination-figure` items (still created, aged
    and expired only by `updateHallucinations`) into placements of one
    shared flat silhouette, `meshes/shadow-figure.js`'s `buildShadowFigure`:
    `drawShadowFigure`'s head circle, sampled body curves and red eyes in
    its own colours, 75 px tall at `UNIT_SCALE` (an adult is 73), all faces
    `unlit` and unculled. `billboardYaw` turns its front to the camera each
    frame; `shadowFigureAlpha` is the one fade × flicker formula both
    cameras use, carried in `placement.alpha`, so the figures sort, occlude
    and fog with the rest of the scene. `drawHallucinations` paints the 2D
    figures only in Top-Down. Decision: the vignette, whispers, light
    flicker and the jump scare's giant figure rising from the bottom edge
    are screen-space effects (they aren't at a floor position) and stay as
    they are in both cameras. Hooks: `spawnShadowFigureNow(x, y)`,
    `getShadowFigures()` (`{figures, topDownDrawn, fpPlaced}`); tests:
    `shadow-figures.test.js`, e2e "shadow figures stand in the First Person
    scene…".
12. ✅ **Elevator doors (S)** — `optsFor` passes the ride's `doorOpen`
    (quantised to 1/16 by `elevatorDoorOpts`) to the ridden car only; the
    rider lands in the car facing out; the doors retract behind the posts,
    clipped to the doorway, and stay open until the player steps out.
    `elevator.test.js` pins the door extents at 0, 0.5 and 1 and the call
    panel staying clear; `scene.test.js` bounds the memo rebuilds over a
    ride; Playwright steps a frozen ride through `getElevatorDoorOpen`.

### Open questions

* Facing on entering FP: keep "face the room centre" (today) or face the way
  Eun-mi was last walking in Top-Down? The latter is more "same world";
  the former always shows something useful.
* ~~Label density in FP (P5)~~ **Resolved:** all labels within a world
  distance cutoff, faded by distance, with the crosshair target at full
  opacity on top. `LABEL_RANGE` 520 px (about half the room), opaque up to
  `LABEL_FADE_START` 200 px and fading to `LABEL_MIN_ALPHA` 0.3 at the
  cutoff; patience bars only within `BAR_RANGE` 300 px. The target ignores
  the cutoff, the bar range and occlusion. "Crosshair target + within N px"
  was rejected because station names are what you navigate by from across
  the room.
* Performance budget: ~8 more characters at up to 340 faces each on 1F —
  set a frame-time target before step 3 and measure it.

### World-anchored labels

Each entity's chips come from **one content function that both cameras
call**, so the two can't drift; Top-Down's drawers were refactored onto them
with their canvas output unchanged (a seeded canvas call trace of a busy
Top-Down frame matched the old one apart from time-driven bobbing).

| Entity | Content function (`library-game.js`) | FP stack, top to bottom |
|---|---|---|
| Station | `labelForStation` (incl. Reading Nook cooldown, Boss's Office locked / closing-wait countdown) | name; above it `coffeeOutOfOrderChip` on the Coffee Machine and `returnCartChips` ("+N more", pulsing messy cart) on the Return Cart |
| Front Desk / Fines patron, Karen, ghost | `queueSlotChips(slot)` → `{chip, sub, patience}` | chip ("Waiting", "Check out!", Korean title, "Karen!", "단골 ★"/"추천?", "???", "Ng"), the English title line, the patience bar (colour from `patienceColor`) |
| Ambient staff | `staffChips(a)` (name, then `ambientHint`) | name, help hint |
| A queue longer than it shows | `queueOverflowChip(kind)` | "+N waiting", at the line's end |

Chip models are `{text, font, fill?, ink?, maxWidth?}`; `chipText` applies
`truncateForChip` for `maxWidth` and `drawChip` draws one with
`drawLabelChip`. In FP, `fpLabelStacks(inventory)` turns the world
inventory into stacks, `layoutLabels` (pure, in `three-d/labels.js`) lays
them out, and `drawFpLabels` paints them after the vignette and before the
crosshair and minimap.

`layoutLabels(stacks, {camera, viewport, measure, targetId, hud, occluders})`:

* **Anchor:** a stack's bottom edge sits `ANCHOR_GAP` (8 px) above its
  entity's top, read from the very mesh FP draws: `stationTop(kind)` (mesh
  bounds × `UNIT_SCALE`, 40 for a plain box) or `characterAnchorHeight(mesh)`
  (the character mesh's crown, so a kid's label is lower). It is projected
  with `projectPoint` and the camera `drawScene` used that frame; behind
  the camera, or with any part of the stack off-screen, it is skipped.
* **Range and fade:** see the resolved open question above.
* **Occlusion:** a label whose sight line passes through another station's
  box below that station's top (`isOccluded`, a floor-plane slab test plus
  the line's height) is hidden, as its entity is.
* **HUD:** a stack overlapping one of `fpHudRects` (top-left gauges,
  minimap, crosshair and its tooltip, bottom-centre hint) first moves up
  clear of it; if that pushes it off-screen or into another HUD rect, it is
  dropped.
* **Declutter and order:** the target, then nearer stacks first, keep their
  place; a stack overlapping one already kept (2 px pad) is dropped. The
  survivors draw far to near, the target last.

## Known gaps

* Entering FP mid-walk stops the Top-Down click-to-move (`setCameraMode`
  clears `moveTarget` on purpose) but leaves the walk's queued
  `pendingFrontDeskAction` / `pendingCartPickupId` set, so it fires on the
  next arrival at that station instead of being dropped with the walk
  (re-clicking a plain station mid-walk in Top-Down leaves it set the same
  way). The lossless-flip e2e runs frozen with no walk in flight, so it
  doesn't cover this.
* The crosshair's pitch test uses each entity's *top* (`stationTop`,
  `PERSON_TOP`) and the fixed `BASE_EYE`, not its real silhouette or a
  jump's raised eye, so it is a slab test: looking at the gap above a short
  patron's head still counts as on them within the 9° slack.
* The elevator doors only open on arrival: doors-close keeps them shut
  (they are already shut on approach), so the departure has no closing
  animation.
* Return Cart books stand on the cart's top tray in FP, but their FP
  interaction entities (`buildFirstPersonEntities`) are still anchored at the
  Top-Down slot points, about 2 units in front of the cart. Aiming at the cart
  from a step or two away targets a book, as before; from right against the
  cart the crosshair names the cart itself (both pick up a book).
* The stairs climb (`transitions.js`, `STAIRS_STEPS` 10) is longer than the
  8-step mesh, so the camera overshoots the top by about 0.56 units; the
  2nd-Floor stairs also climb *up* on screen to go down.
* FP props have no plum station outline (Top-Down's `drawStation` strokes it,
  not the drawers).
* World labels are hidden only by *stations* (`stationOccluder` boxes):
  a person or decor prop between the camera and a label does not hide it,
  and labels always paint over the 3D frame (no z-buffer). Labels are a
  fixed screen size at every distance; the alpha fade is the only depth cue.
  A label partly off-screen is skipped rather than clamped to the edge.
* Top-Down's non-chip queue art has no FP counterpart: the recommend
  speech bubble (its "추천?"/"단골 ★" chip carries the same information),
  the genre swatch beside a borrower's head and the fines star.
* `ELEVATOR_COLORS.tile` is a copy of both games' `STATION_COLORS.elevator`,
  held equal by a source-text test rather than imported.
* The FP floor has no sunbeams, tile sheen or faint grid lines (they are
  lighting/gloss effects painted in plan space), and Top-Down's back-wall
  band covers the floor's first 58 px where FP has floor up to the wall.
  The side and front walls take `BACK_WALL`'s colours by choice (Top-Down
  never shows them).
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
  dropped) with its shading unchanged (and a textured cell to fall back to a
  flat poly there), `room.test.js` requires no shell face
  to span more than one `TILE`, and `scene.test.js` samples a grid of screen
  points from five poses inside the room and requires the shell to paint
  every one of them.
* `labels.test.js` pins the anchor heights to the meshes, the fade curve,
  culling (behind, out of range, off-screen), the bar range, occlusion,
  HUD avoidance and the declutter's priority and draw order. Playwright's
  "First Person shows world-anchored labels" checks, facing the Front Desk
  with a queued patron, that `getFirstPersonLabels()` holds the Front Desk
  label and the patron's chip (with its patience bar) on screen.
* Playwright (`e2e/library-game.spec.js`): First Person tests for the
  Stairs and Elevator check that interacting starts an animated transition
  (via `getActiveTransition`) and that completing it (via
  `forceCompleteTransition`, so specs don't wait out the animation) switches
  floors; a frozen, stepped elevator ride checks `getElevatorDoorOpen()` is 0
  on approach and through the rise, 0.5 mid doors-open with the player in
  the car facing out, held at 1 while they stay, and 0 after they step out. One pixel-level test covers the per-frame clear: with the
  simulation frozen (`freeze(true)`), the loop keeps rendering the same
  scene, so sampled canvas pixels must be identical ~35 frames later. Before
  the clear they darkened frame by frame.
* Visual tuning is manual: run `make dev` (on a port other than 8080, which
  is a developer's own server) and look at `/library-game` in First Person
  beside the same patrons in Top-Down. That comparison is what settled the
  `unlit` set above; `character.test.js` covers the proportions it cannot.
* Props referenced to 2D: `bookshelf.test.js`, `coffee-machine.test.js` and
  `elevator.test.js` pin each textured front to its exact layout region
  (the elevator's doors at `doorOpen` 0, 0.5 and 1, clipped to the doorway
  and clear of the call panel at every 1/16 step, and seen from inside the
  car), the art's aspect, no
  untextured face coplanar with a textured front, and culling from in front
  and behind; `stairs.test.js` pins the step ramp to `stairStepColor`, the
  foot facing +Z, the rail and badge, and culling; `transitions.test.js`
  checks the climbing camera stays on or above the treads from the e2e
  approach. `library/anime-furniture.test.js` and
  `hospital/anime-furniture.test.js` pin `bookcaseLayout`,
  `coffeeMachineLayout` and `elevatorLayout` to the Top-Down geometry.
  When changing a drawer a mesh wears, diff its canvas call trace before and
  after (the skill's step 2): Top-Down must stay byte-identical.
