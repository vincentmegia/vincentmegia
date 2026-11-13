# Library Shift — Min-jun's Own First Person Mesh (wave 3)

Date: 2026-11-13
Status: Implemented (branch `fp-minjun`)

## Goal

Make Kang Min-jun in First Person read as his detailed 2D self
(`web/static/js/library/minjun.js`, about 2,600 lines of art): his own shape,
his outfit and props, his own face, and what he is doing. "Realistic" here
means faithful to his 2D anime design as real 3D, not photoreal (the
renderer is canvas-2D painting with flat shading; photoreal would need
WebGL).

Parent docs: `docs/features/library-first-person-3d.md`,
`docs/skills/2d-to-3d/SKILL.md`,
`docs/superpowers/specs/2026-11-05-library-fp-character-art-design.md`.
The reusable procedure this wave produced: `docs/skills/2d-character-to-3d/SKILL.md`.

## The problem, measured

* First Person drew him with `buildCharacter` from a short design entry in
  `library-people.js` (a "blazer" outfit, "medium/messy" hair, "big" eyes):
  the patron chibi, 3.36 heads tall, scaled 0.95 for a teen.
* His 2D art is drawn in Hospital Shift's anime frame: the sole's bottom at
  y +8.3, his chin at -43.7 and his tallest tuft at -77.6, so **2.5 heads
  tall**. Top-Down draws him at 1.5×.
* None of the sweater vest's knit and V-neck, the striped tie, the lanyard
  and ID card, the headphones, the three books, the tote, the cowlick, his
  sharp eyes or his actions (read, hum, wave, help; the parity rule P4)
  reached First Person.

## Decisions (with the user)

1. **His shape, at human height.** Every proportion measured off
   `minjun.js`, scaled so his eyes sit at the player's eye line
   (`BASE_EYE`, 60 px): 0.948 game px per art px, 81.4 px tall against an
   adult patron's 73.35. (The alternatives: Top-Down's literal 1.5×, about a
   head and a half above the player's eye; or the shared patron frame.)
2. **A live face plus action poses**, no walk cycle yet. (The
   alternatives: a live face only; or everything including a stride.)
3. **A dedicated mesh** (approach A), not "signature" options on
   `buildCharacter` (which would weigh on the 76 other characters and their
   face budget) and not a camera-facing sprite (the skill rules out
   billboards).

## Design

### The technique: geometry wearing the drawing, projected straight on

The skill's two techniques were "geometry from the 2D's measurements" for
characters and "the 2D art as a texture" for flat-fronted props. Min-jun
combines them. His body is real geometry measured off his renderer, and
every face that turns toward the viewer wears his own drawing **projected
straight along Z**: each vertex takes the image point of its own art x, y
(`geom.js`'s `projectFront`). A planar projection needs no unwrapping, so
head-on the drawing itself is what the player sees (knit, tie, lanyard,
trinkets, eyes, fringe), and its silhouette is the geometry's. The sides and
back are lit flat colours from `MINJUN_PALETTE`. Textured faces are `unlit`,
as on the props.

### Units

* `minjun.js` (2D) exports, without changing what Top-Down draws:
  `MINJUN_FRAME` (his landmarks), `faceForAction`, `MINJUN_BOOK_SPINES`,
  `minjunBookTop`, `MINJUN_TOTE`, `MINJUN_OPEN_BOOK`, and three painters
  (`paintMinjunBody`, `paintMinjunHead(ctx, face)`, `paintMinjunProps`)
  that draw his parts at rest. `drawHead` takes its blink from `face.blink`
  when given; the book spines moved out of `drawBookArm` into
  `drawBookSpines`. Checked with a `drawMinjun` call-trace diff over 50
  cases: identical.
* `three-d/meshes/minjun-frame.js`: the scale, the one art → model
  conversion, the three canvases' art boxes (`MINJUN_ART`), `uvIn`.
* `three-d/meshes/minjun-body.js`: legs, sneakers, torso, neck, arms
  (`tube`s between the 2D drawers' own joint points, plus a z per pose),
  books, tote, open book. Each arm ends in a real hand (`buildHand`: palm,
  four fingers, thumb), or in his pocket when walking (bulge and hooked
  thumb); added after review ("the hand is missed out": the first hands
  were plain tapered stubs and the pocket pose had none).
* `three-d/meshes/minjun-head.js`: a 12-sided stack along `facePath`'s
  V-jaw and `drawHair`'s crown, the chin set forward.
* `three-d/meshes/minjun.js`: `buildMinjun({pose, art})` memoised per art
  and pose; `minjunPoseFor`; `minjunFace`; `paintMinjun*Art` (an opaque
  backing, then the painter).
* `scene.js`: `characterMesh(c)` sends `design.key === 'minjun'` to
  `buildMinjun`, everyone else to `buildCharacter`.
* `library-game.js`: `fpMinjunFor(a)` paints the body and props canvases
  once, repaints the head canvas in place when `minjunFace`'s key changes,
  and passes `{pose, art}` with his character entry. The label anchor and
  crosshair height use his own mesh's top. Test hooks: `getFpMinjun`,
  `setMinjunAction`.

### Poses and faces

| Top-Down | Pose | Face |
|---|---|---|
| walking | `walk`: hand in pocket | blink |
| `read` | `read`: open book before his chest (its art from the props canvas, his hand on it) | talking |
| `wave`, `help` | `wave`: arm raised | talking |
| `hum` | `idle` | eyes closed, round "o" |
| standing | `idle`: arm hanging | blink |

The mouth is cut into 3 steps and the blink follows `isBlinkingAt`, so the
face canvas is repainted a few times a second at most. The mesh rebuilds
only on a pose change, at most four meshes per art set.

## Testing

`minjun.test.js` (19 tests), `geom.test.js` (`tube`, `loft`,
`projectFront`), one Playwright test (pose per action, the humming face key,
no repaint while his face holds, his world label), the call-trace diff, and
side-by-side screenshots of the 2D and the 3D from the front, at 3/4, the
side and behind, in every pose, plus in the game. A 2nd Floor frame with him
at interact range ran at 60 fps in headless Chromium.

## Not in this wave

A walk cycle; head motion while humming or reading; the cowlick, the pencil
behind his ear, his speech bubbles and music notes (they lie outside his
body's silhouette); a renderer-wide outline or cel shading pass. See the
feature doc's Known gaps.
