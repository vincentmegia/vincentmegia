# 2D to 3D Conversion Skill

## Purpose

Make a First Person 3D object read as **the same object** as its Top-Down
2D art: same colours, same outlines and shading, same signs and lettering,
same layout. The 3D renderer is Library Shift's software painter
(`web/static/js/library/three-d/`, canvas 2D, no WebGL); the 2D art is the
game's canvas drawers (`library/anime-furniture.js`, `hospital/anime-furniture.js`,
`patron.js`, …).

Read this before building or changing any mesh in `three-d/meshes/`, and
before changing a 2D drawer that a mesh is referenced to (a 2D change shows
up in First Person too; that is the point).

Feature docs: `docs/features/library-first-person-3d.md`. Designs that
established this guideline: `docs/superpowers/specs/2026-11-05-library-fp-character-art-design.md`
(characters) and `docs/superpowers/specs/2026-11-07-library-fp-prop-art-design.md`
(props).

## The Rule

**The 2D drawer is the source of truth. The 3D never re-invents what the 2D
already draws.** Take everything from the 2D *code*: its colours, its
proportions, its layout and, for flat-fronted props, its pixels. Never copy
a value by hand into a mesh. Export it from the 2D module and import it, so
the two views cannot drift apart.

Before writing any geometry, **look at both renderers side by side**. Reading
the drawer's code is not enough: "matches the colours" is not "looks like it".
The first bookshelf attempt matched every colour and still did not look like
the 2D, because the look came from the outlines, gradients, rounded shapes
and lettering, which a colour table does not capture.

## Two Techniques, Chosen by the Object

| Object | Technique | Why |
|---|---|---|
| Characters (curved, seen from every side, posed) | **Geometry from the 2D's measurements**: proportions, full palette, baked tones | A texture can't wrap a curved, moving body; the measured silhouette is what reads |
| A character with its own detailed 2D renderer (Min-jun) | **Geometry from that renderer's measurements, wearing its drawing projected straight on** (`projectFront`): front-facing faces take the drawing, sides and back its palette | His look is in detail no design object holds (knit, lanyard, his own eyes); a straight-on projection needs no unwrap, so the drawing itself is what shows head-on. Procedure: `docs/skills/2d-character-to-3d/SKILL.md` |
| Props with a flat, readable front (bookshelf, coffee machine, elevator, signs, doors) | **The 2D art as a texture** on real 3D geometry | The look *is* the drawing (plum line art, gradients, lettering); only the drawer itself can reproduce it |
| Props whose 2D is a plan view (stairs) | **Geometry in the drawer's exported colours**, with only the parts that are flat in 2D (the stairs' arrow badge) as textures | A plan view can't be worn as a front; its colours, line art and signs still can |

Both keep real 3D depth. Neither is a billboard sprite.

## Procedure: Flat-Fronted Props (texture technique)

The bookshelf (`meshes/bookshelf.js`) is the reference implementation.

1. **Keep the real-world size, and face the player.** Meshes stay roughly
   metre-scale units (`UNIT_SCALE` 40). The 2D size of a station is a
   floor-plan footprint, not a physical size. Check which way the player
   actually approaches and interacts (the e2e spot, `transitions.js`) before
   dressing a front: the old stairs faced away from the player. A prop may
   face −Z (the elevator, on the room's south edge); use `textureBack`.
   Put a small prop at a height that reads from the 1.5 m eye (the coffee
   machine stands on a counter).
2. **Draw the 2D art at the mesh's own aspect.** Stretching the Top-Down
   drawing onto a different shape distorts it. Give the drawer an *optional*
   parameter whose default is today's 2D value (the bookcase's `opts.rows`,
   default 2), and call it with a box of the mesh's aspect (`BOOKSHELF_ART`:
   124 × 242, so the case inset is exactly 1:2). Top-Down must stay
   **byte-identical**: record the drawer's canvas calls through a recording
   proxy before the change and diff them after.
3. **Export the drawer's layout as a function and draw with it.** The mesh
   needs to know where the drawer puts each part (`bookcaseLayout(st, rows)`
   gives the case, sign, back panel and each shelf's plank). The drawer must
   *use* that function, not keep its own copy of the numbers, so moving a
   part in 2D moves it in 3D. Export the drawer's own colours the same way
   (`BOOKCASE_COLORS`) for the flat fallback.
4. **Paint the art once into a canvas, opaque.** A `paint<Name>Art(ctx,
   station, drawOpts)` in the mesh module fills an opaque backing in the
   object's base colour, then calls the drawer. The renderer paints shading
   and fog as overlays, so the mapped region must have no transparent pixels
   (rounded corners otherwise show the overlay as a dark wedge). The game
   (`library-game.js`) owns the canvas: it creates it, caches it per station
   id, and passes the **same draw options Top-Down uses** (one shared
   function, `bookcaseDrawOpts`), so both views show the same books.
5. **Model geometry for depth; map each box's front onto its own art
   region.** Split the object where it has real depth (crown, plinth and sides
   at the front plane; shelf rows recessed by `RECESS`; plank lips standing
   proud by `LIP`). Each part's +Z face gets `texture: {image, uv, div}` with
   uv taken from that part's layout rectangle. Model y is up, art y is down.
   Use `geom.js`'s `boxWithout`, `textureFront`/`artFrontUV` (and the −Z
   `textureBack`/`artBackUV`); don't re-derive the corner order. Each
   textured triangle samples 0.6 px past its region (the seam grow), so
   where a part's 2D neighbour isn't its 3D neighbour, paint a seam fill
   into the FP art there (the coffee machine's head under the hopper).
6. **Textured fronts are `unlit`; everything else stays lit.** The 2D art
   already carries its own top-lit gradients. Lighting it again greys it out.
   Sides, tops and backs stay lit so the object still reads as solid.
7. **Drop hidden faces and opt into `cull`.** With no z-buffer, any face
   coplanar with a textured front ties in the painter's sort, and a face
   turned away from the camera can be painted over a nearer one (the
   bookshelf's crown top over its own sign). So drop faces that can never be
   seen (`boxWithout`), wind every face outward, and set `cull: true` on
   every face, once a test renders the mesh from both sides.
8. **Accept a fallback.** Without art (node tests, no canvas) the same faces
   render in the drawer's flat colours. The geometry is identical either way.
9. **Wire it through the scene.** Add the kind to `FP_ART` in
   `library-game.js` (`{w, h, paint, stateKey?}`; a `stateKey` repaints the
   art when game state it shows changes). `buildFirstPersonScene({..., artFor})` asks
   `artFor(station)` for each station on the floor with its own mesh and
   passes `{art}` to the builder; meshes are memoised per station object and
   art, so a frame does not rebuild them.

## Procedure: Characters (geometry technique)

Summarised from the character spec; read it for the measurements.

1. Build from the **same design object** the 2D draws, never a reduced
   palette (`paletteFor(design)` resolves every colour).
2. Measure proportions off the 2D code, in the art's own coordinates, with
   one conversion onto the floor (`ART`, `artY` in `character-frame.js`).
   Measure from the ground the art stands on, not the drawing origin.
3. Share derived tones with the 2D (`hairTones`, `skinTones` in
   `shared/people.js`); bake them per face with `box`'s `tint`.
4. `unlit` is a material rule: every skin-toned face, nothing else.
5. A character with their own detailed renderer (Min-jun, `meshes/minjun*.js`)
   gets their own mesh wearing that renderer's drawing on its front. That
   has its own procedure: `docs/skills/2d-character-to-3d/SKILL.md`.

## Verifying

- **Side-by-side screenshots, every time.** Render the real 2D drawer and the
  3D mesh in one page (a throwaway harness under `/tmp/claude/<task>/`, never
  in the repo) facing it, at an angle and at interact range, then in the real
  game on your own port (not 8080). The user judges by eye, so show them.
- **Unit tests** (`node --test`, no DOM): the mesh's size and base; that the
  art box has the mesh's aspect; that each textured face maps exactly its
  layout region and stays on the image; no untextured face coplanar with a
  textured front; recessed/proud planes; `cull` set and correct from front and
  behind (render with `buildDrawList`); the flat fallback; a face budget;
  determinism; and that `paint<Name>Art` lays the opaque backing first.
- **Top-Down unchanged**: the drawer's call trace diff in step 2.
- **Frame cost**: textured cells cost a clip plus an image draw each. Keep
  `div` small (the bookshelf uses `[2, 1]` wide and `[1, 3]` tall) and measure
  a full floor in the game (60 fps with three shelves in view, headless
  Chromium).

## Feature Docs Are Part of the Change

Update `docs/features/library-first-person-3d.md` (and the 2D object's own
feature doc when its drawer changes) in the same commit.
