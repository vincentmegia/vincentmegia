# 2D Character to 3D Skill

## Purpose

Give a character that has **its own detailed 2D renderer** its own First
Person mesh, so that in 3D it reads as the same character: its own shape,
its own outfit and face, and what it is doing. Kang Min-jun
(`web/static/js/library/minjun.js` → `three-d/meshes/minjun*.js`) is the
reference implementation; follow it for the next one (Ji-ho, Director Seo,
the staff on `staff-kit.js`).

Read this before building or changing such a mesh, and before changing a 2D
character renderer a mesh wears (the change shows in First Person too).

This is a companion to `docs/skills/2d-to-3d/SKILL.md`, which holds the
general rule and the prop procedure; read that first. Feature doc:
`docs/features/library-first-person-3d.md` ("Min-jun's own mesh"). Design:
`docs/superpowers/specs/2026-11-13-library-fp-minjun-design.md`.

## When to Use It

| Character | Use |
|---|---|
| A patron or staff member drawn from a design object (`library-people.js`) | `buildCharacter` (the 2D-to-3D skill's character procedure). Nothing here |
| A character with a hand-written renderer whose look a design object can't hold (knit, lanyard, its own eyes, its own proportions) | This skill |

The test: put the 2D drawing beside the `buildCharacter` version. If what
makes the character recognisable is missing, it needs its own mesh.

## The Approach

**Real geometry measured off the 2D renderer, wearing that renderer's own
drawing projected straight onto the front.**

* The body is 3D shapes (ring stacks, tubes, boxes) whose sizes are read off
  the 2D code in its own art px.
* Every face that turns toward the viewer takes the 2D drawing **projected
  along Z**: each vertex shows the image point at its own art x, y
  (`geom.js`'s `projectFront`). A straight projection needs no unwrapping, so
  head-on the player sees the drawing itself, on a silhouette that is the
  drawing's own.
* The sides and back are lit flat colours from the renderer's palette.
* Anything that changes (the face) is a canvas **repainted in place**; the
  mesh is rebuilt only for a pose change.

It is not a billboard: the character has depth, turns, and is seen from
every side.

## Procedure

### 1. Measure the frame off the 2D code

1. Read the renderer for its landmarks in art px: the ground (the sole's
   bottom, **not** the drawing origin; Min-jun's is +8.3 below his feet
   line), hem, hip, waist, shoulder, neck, chin, eye, crown. Export them as
   one object from the 2D module (`MINJUN_FRAME`) so the mesh imports them
   and never copies a number.
2. Count the heads: (ground − crown) ÷ (chin − crown). If it differs from
   the patron's 3.36, the patron frame can't carry the character.
3. Pick **one scale**: game px per art px so the eyes sit at `BASE_EYE`
   (60), the player's eye line. Do not reuse Top-Down's draw scale (Min-jun
   is drawn at 1.5× there; in First Person that towers).
4. Put the scale and the one art → model conversion in a `<name>-frame.js`
   (`toModel`, `toArt`, `modelY`). Every other mesh file writes its numbers
   in art px (x right, y **down**, z toward the viewer) and converts there.

### 2. Export painters from the 2D renderer, changing nothing Top-Down draws

1. Save a copy of the renderer first (`/tmp/claude/<task>/old/`).
2. Export painters that draw the character's parts **at rest** (t 0, no
   stride, no breath), grouped by what will share a canvas:
   body (legs to neck, with trinkets), head (face and hair), props.
   They call the existing internal drawers; they don't redraw anything.
3. Where a drawer mixes a part you need with one you don't (the book spines
   inside the arm drawer), split it into two functions called in the same
   order. Where the mesh needs to choose state the drawer derives from time
   (the blink), add an **optional** override whose absence keeps today's
   behaviour (`face.blink ?? isBlinkingAt(t)`).
4. Export the layout numbers the mesh needs (spine rects, the tote's box,
   the open book's box) and make the drawer use those same constants.
5. **Prove Top-Down is unchanged**: record every canvas call of the public
   draw function through a recording proxy, old module against new, over
   every action, walking and standing, several times. Zero cases may differ.
   Re-run it after every later edit to the 2D file.

### 3. Paint the art into canvases the game owns

1. One art box per canvas in art px, with a scale (image px per art px): 4
   is enough for clothes, 6 for the face. Keep the boxes generous; `uvIn`
   clamps onto the image.
2. `paint<Name><Part>Art(ctx, …)` in the mesh module: an **opaque backing**
   over the whole canvas first, in bands of the colour round the drawing
   (vest round the torso, slacks round the legs, hair above the temples,
   skin below), then scale, translate, and the 2D painter. The renderer
   paints shade and fog as overlays, so a transparent pixel shows as a dark
   wedge.
3. The game (`library-game.js`) creates the canvases, paints the static
   ones once, and repaints a changing one only when its **state key**
   changes (`fpMinjunFor`).

### 4. Build the geometry

1. **Ring stacks** (`loft`) for the head, torso, neck and legs: one ring per
   landmark of the 2D outline, half-width from the outline, a half-depth you
   choose, and a centre offset where the shape leans (the chin leads the
   skull). A stack's flat faces sit on the axes, so its radius is
   `half / cos(π / sides)`. Use 12 sides for the head and torso, 8 for legs.
2. **Tubes** (`tube`) for limbs, between the 2D drawers' own joint points.
   `side` and `squash` flatten one into a palm or a pocket bulge.
3. **Boxes** for flat props (books, tote, shoes).
4. Dress each part with `projectFront(part, {image, toUV: uvIn(box), minNz})`.
   `minNz` is how far a face may turn away and still wear art: 0.3–0.4 on a
   stack (the front face and its two neighbours), 0.9 on a box (the front
   only). Without art the faces keep their flat colours: that is the test
   fallback.
5. Colour the faces that never wear art from the palette: the back of the
   head in hair (the undercut's shade low down), the vest's back, sleeves.
6. Material rule, as for every character: every skin-toned face is `unlit`,
   the whole head is `unlit`, clothes stay lit.

### 5. Poses from the 2D drawers' own joints

1. One pose table (`MINJUN_POSES`): for each pose the elbow and wrist the 2D
   drawer uses for that action, plus a **z per joint**. Depth is the one
   thing the 2D can't say; choose it so the pose makes sense in the round (a
   hand at a front pocket, a book before the chest).
2. Map game state to a pose in one pure function (`minjunPoseFor`), using
   the same `walking`/`action` Top-Down derives. Memoise the mesh per art
   object and pose, so the scene's per-frame call is a lookup.
3. **End every arm in a hand.** A tapered stub does not read as a hand, and
   an arm that just stops reads as an amputation. `buildHand` is a flat
   palm, four fingers with gaps, and a thumb, sized from the 2D hand. A hand
   the 2D hides still needs its stand-in (the pocket's bulge and the thumb
   hooked outside it). A hand the 2D draws on a prop (on the open book) can
   come from that prop's art instead.
4. **Without outlines, one-tone shapes vanish.** The 2D separates skin from
   a cream bag with ink lines; the 3D has none. Give adjoining parts
   different tones from the palette (palm in skin, fingers and thumb in its
   shade) and check each part against what is behind it.

### 6. The face

1. The head's front wears the head canvas, so the face is the drawing.
2. Derive the face from game state in one pure function (`minjunFace`): the
   mouth from the 2D's own function, **quantised** to a few steps; the blink
   from the 2D's own clock function. Return the face and a string key.
3. Repaint the head canvas in place when the key changes. Textures are read
   at draw time, so this never rebuilds the mesh.

### 7. Wire it in

1. `scene.js`'s `characterMesh(c)` picks the builder by `design.key`; add
   the new character there. Everyone else stays on `buildCharacter`.
2. The game passes `{pose, art}` with the character's entry.
3. The world label's anchor and the crosshair's target height come from the
   character's own mesh (`characterMesh` + `meshTop`), not `PERSON_TOP`.
4. Test hooks: one to read the First Person look (`getFpMinjun`: pose, face
   key, paint count) and one to set the action (`setMinjunAction`, used with
   `freezeStaff`).

## Verifying

* **Look at it, every time.** A throwaway harness under
  `/tmp/claude/<task>/` (never in the repo): a small static server that
  serves `web/static` and the harness page, and a page that draws the 2D
  renderer beside the mesh through the real `drawScene`, from the front, at
  3/4, the side and behind, for every pose and face. Then the real game on
  your own port (not 8080), with Playwright screenshots. Zoom into small
  parts (hands) with a `deviceScaleFactor: 3` clip: at thumbnail size a
  missing part and a low-contrast part look the same.
* Harness traps met building Min-jun:
  * `drawScene` resets the canvas transform. Draw each view into its own
    canvas and `drawImage` it.
  * To look at a mesh at the origin from bearing `yaw`, stand at
    `(sin yaw · d, cos yaw · d)` with `facing: -yaw`.
  * Entering First Person picks its own facing, so set the camera mode
    first, then the position and facing.
  * Check a new helper's winding numerically (`faceNormal` against the
    centroid) before trusting a picture.
  * When a part seems hidden, print the draw list (`buildDrawList`) for that
    screen region before blaming the painter's sort.
* **Unit tests** (`node --test`, `minjun.test.js` is the template): eye
  height equals `BASE_EYE`; height and head count; the stacks' widths
  against the 2D outline; the pose and face functions; the memo; that poses
  move only what they should; a face budget; the `unlit` rule; the flat
  fallback; that only faces turned toward the viewer wear art, with uv
  inside their canvas and never on the back; the straight-on projection;
  `characterMesh`'s dispatch; each `paint*Art`'s full opaque backing; every
  pose shows both hands.
* **Playwright**: each action gives its pose; the face key for a
  distinctive face; no head repaint while the face holds; the world label.
* **Frame cost**: about 100 textured faces is a clip and an image draw for
  each of 200 triangles. Measure a frame with the character at interact
  range (60 fps in headless Chromium).

## What This Approach Does Not Give

Say these in the feature doc's Known gaps rather than hiding them:

* The art is exact head-on and stretches over the faces at the edge of the
  front, so the face smears across the side of the head in profile.
* Anything the 2D draws outside the body's silhouette has no face to land
  on (a cowlick, a pencil behind the ear, speech bubbles).
* Lit white cloth reads grey beside the drawing's white.
* The drawing is painted at rest: nothing in it sways or breathes.
* At interact range the textured triangles' seams can show as faint
  hairlines (the renderer's affine cells).

## Feature Docs Are Part of the Change

Update `docs/features/library-first-person-3d.md` (the character's own
section, the audit row, Known gaps, the testing plan), the 2D character's
feature doc if its renderer changed, and `CLAUDE.md`'s gotchas when a new
2D renderer becomes shared with First Person, in the same commit.
