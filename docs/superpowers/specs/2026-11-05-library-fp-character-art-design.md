# Library Shift — First-Person Characters Referenced to the 2D Art

Date: 2026-11-05
Status: Design (awaiting review)

## Goal

Make Library Shift's First Person characters read as the *same people* as
their Top-Down 2D art: same proportions, same palette, same baked surface
shading, same silhouette. They stay 3D geometry drawn by the existing
software renderer — this is not a return to billboard sprites.

Parent docs: `docs/features/library-first-person-3d.md`,
`docs/superpowers/specs/2026-11-01-library-first-person-3d-design.md`.

## The problem, measured

`buildCharacter` (`web/static/js/library/three-d/meshes/character.js`) draws
every First Person character as nine axis-aligned boxes coloured from a
four-entry palette, which `fpPaletteFor` (`web/static/js/library-game.js`)
derives by flattening a patron design. The result is a realistically
proportioned mannequin, while the 2D art is a chibi-anime figure.

Measured from `patron.js`, `patron-head.js` and `staff-kit.js`'s `facePath`
(2D, px, adult) against `character.js` (units × `UNIT_SCALE` 40):

> **Correction (2026-11-07, whole-branch review).** The first version of this
> table measured the 2D figure's vertical frame from `patron.js`'s drawing
> origin, which is hip height — **not** the ground. The figure stands 7.1 px
> below that origin (`legPoses` puts the ankle at +1.6, `drawShoe` lays the
> sole to +5.5, and `groundShadow` draws its contact ellipse at +7), so every
> height below was 7.1 px short and the whole deficit fell in the legs. The
> widths were measured correctly and are unchanged. The table below is the
> corrected one; `character-frame.js` now keeps the art's own coordinates in
> `ART` and converts once through `artY`, so the mistake cannot recur.

| Measure | 2D art | 3D today | Verdict |
|---|---|---|---|
| Overall height | 73.35 px | 68 px | 7% short |
| Head height | 21.85 px | 10.4 px | less than half size |
| Shoulder width | 21.2 px | 26 px | too broad |
| Head ÷ shoulder width | 85% | 41% | wrong |
| Torso height | 24 px | 22 px | close |
| Leg length | 26.5 px (36% of height) | 32 px (47%) | 21% too long |
| **Heads tall** | **3.36** | **6.5** | the core mismatch |

Overall height is 7% out, not a match: the figure grows about 10.6% against
the original (wrong) measurement. That is still well inside the room and
`UNIT_SCALE` stays 40, and `scene.js`'s `BASE_EYE` (60 px) stays too — the
corrected eye line is 60.9 px, so the player now meets a patron's eye
instead of looking 6.2 px over it. No camera constant moves, but for a
different reason than this spec first gave.

Three further gaps, on the axes the user named:

- **Colours** — `fpPaletteFor` keeps 4 of roughly 12 colours in a design.
  Dropped: `shoes`, `inner`, `shirt`, `apron`, `tie`, `legs`, `trim`,
  `print`, `stripe`. The 2D additionally *derives* tones per surface —
  `hairTones()` yields base/mid/deep/shine, `skinTones()` yields
  skin/shade/deep. The 3D uses one flat hex per part.
- **Texture** — the 2D cel-shades every surface (far-cheek shadow, the band
  under the fringe, armpit-to-waist fold shadows, a shoulder-seam highlight,
  dashed hem stitching). The 3D has one flat intensity per face.
- **Dimension** — no neck, no shoes, hair is a slab cap, and the sleeves are
  free-floating boxes outboard of the torso with a visible gap.

## Prototype findings

A throwaway prototype (`/tmp/claude/library-fp-proto/`, not in the repo)
rendered the same design five ways against the real 2D renderer. It settled
three open questions and surfaced one unplanned requirement:

1. **Re-proportioning carries most of the result.** A mesh at the 2D's
   proportions driven by the full design reads as the character; face count
   rises from 54 to roughly 200, which is negligible.
2. **Faces render muted, and this forces a renderer change.** `FP_LIGHT.dir`
   is `[0.35, 1, 0.25]` — lit from above — so a forward-facing surface gets
   `0.5 + 0.23 = 0.73` intensity while the 2D draws faces at full brightness.
   No mesh-only change fixes this. See "The `unlit` face flag".
3. **Per-face gradients are not worth it** — at this on-screen size they are
   nearly indistinguishable from flat fills, for the largest `core.js` risk.
   Cut.
4. **Silhouette outlines look right but need real tuning** — a naive pass
   also outlines every interior facet of a rounded head and every proud
   detail quad. Deferred rather than rushed.

## Decisions (confirmed with the user)

1. **Stay 3D geometry.** Art style, colours, texture and proportions
   reference the 2D; the characters remain real meshes that turn and catch
   light. No billboarding.
2. **Scope is re-proportioning plus the `unlit` flag.** Outlines, gradients,
   props, trinkets, walk cycle and ground shadow are out.
3. **One source of truth for character data** — the mesh builder reads the
   same design object the 2D renderer reads.

## Non-goals

- No change to Top-Down art, game rules, scoring, Sanity or leaderboards.
- No silhouette outlines or per-face gradients in `core.js`.
- No carried props, trinkets, walk cycle or ground shadow in First Person.
- No change to interaction or targeting (`first-person.js` still owns
  `findInteractTarget`).
- No ambient staff drawn in First Person — unchanged from today.

## Architecture

### Character data: design in, mesh out

`fpPaletteFor`'s four-colour flattening is the root cause and is removed.
`buildCharacter` takes **the same design object `drawPatron` takes**, so a
new patron added to `LIBRARY_PATRON_DESIGNS` appears correctly in both views
with no second edit.

```js
buildCharacter(design, { angry = false } = {})  // design: a library-people.js patron design
```

`library-game.js` already resolves a design via `findLibraryDesign`, so
`drawFirstPersonView` passes it straight through instead of a palette.

Karen has no `library-people.js` design — she has her own 2D renderer
(`karen.js`) — so `FP_KAREN_PALETTE` becomes `FP_KAREN_DESIGN`, a
design-shaped literal in the same place in `library-game.js`.

### Module layout

`character.js` is 60 lines today and the new builder is roughly 400. It
splits along the same seam the 2D side already uses (`patron.js` vs
`patron-head.js`):

| File | Role |
|---|---|
| `three-d/meshes/geom.js` | **new** — `box`, `prism`, `quad`, `merge`, `translate`, `scaleMesh` |
| `three-d/meshes/character.js` | `buildCharacter(design, opts)`; owns the proportion constants |
| `three-d/meshes/character-body.js` | **new** — shoes, legs, lower garment, torso and its layers, arms, neck |
| `three-d/meshes/character-head.js` | **new** — head volume, ears, face quads, hair and `back` styles, extras |
| `three-d/meshes/character-palette.js` | **new** — `paletteFor(design)`: the one place a design's ~12 colours and their derived tones are resolved, so the body and head builders never read `design.outfit` directly |
| `shared/people.js` | `hairTones` and `skinTones` **move here** from `patron-head.js` |

Two supporting refactors, both small and both fixing existing problems:

- **`box` moves to `geom.js`.** Five unrelated meshes (`bookshelf`,
  `stairs`, `elevator`, `station-box`, `coffee-machine`) currently import
  `box` from `character.js`, which is a wrong dependency. Their imports
  update; their behaviour does not.
- **`hairTones`/`skinTones` move to `shared/people.js`.** Both renderers
  then derive tones from one implementation. The alternative — duplicating
  them inside `three-d/` — guarantees the two drift apart, which is exactly
  the class of bug this change exists to fix. `shared/people.js` is already
  pure and already exports `shadeColor`, so `three-d/` stays DOM-free.
  `hairTones` is currently exported from `patron-head.js` and used there and
  in `patron.test.js`; `skinTones` is private to `patron-head.js`. Both
  importers update.

### `geom.js` primitives

`box(min, max, color, tint?)` keeps today's eight-vertex, six-quad form and
winding, and gains an optional per-face `tint` of
`{front, back, right, left, top, bottom}` so one box can carry baked
shading. Omitted entries fall back to `color`, so existing call sites are
unaffected.

`prism(rings, sides, capTop?, capBottom?)` builds a vertical stack of
N-gon rings, each `{y, rx, rz, color}`, with the side band between two rings
taking the upper ring's colour. This is what gives heads, hair and flared
skirts rounded volume instead of slab faces, and what lets a surface carry
the 2D's banded cel-shading. Faces are wound counter-clockwise seen from
outside, as `core.js` requires.

### The proportion contract

Constants are the 2D frame divided by `UNIT_SCALE` 40 (`PX = 1/40`):

Art px are measured up from `patron.js`'s drawing origin; the floor is 7.1 px
below it (`GROUND`), so a landmark's height is `art px + 7.1`.

| Landmark | 2D art (px) | Height (px) | Units |
|---|---|---|---|
| Feet | -7.1 | 0 | 0 |
| Shoe top | -2.1 | 5.0 | 0.125 |
| Torso hem | 19.4 | 26.5 | 0.6625 |
| Shoulders | 43.4 | 50.5 | 1.2625 |
| Chin | 44.4 | 51.5 | 1.2875 |
| Eyes | 53.8 | 60.9 | 1.5225 |
| Crown | 66.25 | 73.35 | 1.834 |

Half-widths: torso 9.8 (7.8 slim), shoulder 10.6 (9.2 slim), head 9 (9.4
kid, 9.2 elder). `slim` is `Boolean(outfit.skirt) || age === 'kid'`, matching
`patron.js`.

Age handling copies `patron.js` exactly, including the detail the prototype
got wrong:

- `AGE_SCALE = {kid: 0.74, teen: 0.95, elder: 0.95, adult: 1}` scales the
  whole figure.
- `KID_HEAD = 1.26` scales **the whole head about the neck** (`withHead` in
  `patron.js`), not only its width.
- Elders stoop: the head sits slightly forward of the shoulders.

### Design-driven geometry

| Design field | Geometry |
|---|---|
| `outfit.top` | torso prism, banded dark→light bottom to shoulder |
| `outfit.inner` / `shirt` | panel proud of the torso front |
| `outfit.tie` | narrow strip over the inner panel |
| `outfit.apron` | panel across the torso front |
| `outfit.trim` / `print` / `stripe` | chest band |
| `outfit.bottom` | trouser box |
| `outfit.skirt` | flared prism, narrow at the waist |
| `outfit.legs` | tights colour on the leg boxes |
| `outfit.shoes` | shoe boxes, wider than the leg and pushed forward |
| `hair.color` | four tones via `hairTones`: cap, fringe band, shine, underside |
| `hair.back` | `long`/`medium`/`bob` fall volume; `twintails`, `ponytail`, `bun` |
| `eyes.color`, `eyes.lashes` | iris and highlight quads; lash bar |
| `brows` | brow bar thickness |
| `mouth` | mouth quad, taller when `open` |
| `skin` | three tones via `skinTones`: head bands, neck, hands, ears |
| `extras` | `glasses`, `mask`, `cap`/`beanie`/`sunhat`/`bikeHelmet`, `catEars`, `headphones` |
| `age` | `AGE_SCALE`, `KID_HEAD`, elder stoop |

Unrecognised `extras` are ignored rather than throwing, as today.

### The `unlit` face flag

The only `core.js` change. `Face` gains an optional `unlit`:

```js
// Face = {indices, color, unlit?}
const intensity = face.unlit ? 1 : light.ambient + Math.max(0, dot(n, ld));
```

Backward compatible — every existing mesh omits it and is unaffected. Fog
still applies, so distant patrons still fade into the room.

**Which faces set it is a visual-tuning question, deliberately left open.**
The starting proposal is the head group — face detail quads plus the head
and hair surfaces — on the rule *parts whose shading is already baked into
their colours opt out of scene lighting*, which is what the 2D does. The
known risk is a full-brightness head reading as pasted onto a 0.73-brightness
body. The implementation ships the mechanism, tunes the set by eye against
`make dev`, and records the final set in
`docs/features/library-first-person-3d.md`.

## Testing

`node --test` (`npm run test:unit`), no DOM, each test beside its module.

**`character.test.js`** — rewritten:

- **Proportions** (the guard that matters), for an **adult** design, with
  explicit tolerances so the test is unambiguous: heads-tall 3.357 ± 0.05,
  head ÷ shoulder width 0.85 ± 0.05, legs 36.1% ± 2% of total height, overall
  height 1.834 ± 0.02 units. This encodes the requirement so it cannot
  silently regress. (The 3.0 / 29% / 1.66 first written here came from the
  mis-measured frame corrected above.)
- **No colour dropped**: every colour present in a design appears on some
  face of the mesh — the exact failure being fixed.
- **Age variants**: a kid's head-to-height ratio exceeds an adult's; kid and
  elder figures are shorter than an adult.
- **Extras add geometry**: a design with `glasses` has more faces than the
  same design without.
- Feet at y = 0, every index in range, deterministic output, face budget.

**`geom.test.js`** — new: `box` and `prism` vertex and face counts, indices
in range, outward winding (a computed normal points away from the centroid),
`tint` overrides applied per face.

**`core.test.js`** — one new case: an `unlit` face ignores light direction
but still fogs by depth.

**`scene.test.js`** — its five-pose screen-coverage test must keep passing
unchanged.

**Playwright** — no new specs. The existing First Person specs must keep
passing.

**Visual tuning is manual**: `make dev`, then `/library-game` in First
Person, which is also where the `unlit` set is settled.

## Rollout

Single change, no flag, no migration. `docs/features/library-first-person-3d.md`
is updated in the same commit per the repo rule, covering: the new module
layout, `buildCharacter`'s signature, the proportion constants, the `unlit`
flag in the `Face` shape and the rendering-model section, the tunables table,
and the "How to add a new object mesh" instructions (which reference `box`
from `character.js`).

## Follow-ups, explicitly deferred

In rough priority order, each its own spec:

1. **Carried props** — every patron design has one (`lightstick`,
   `briefcase`, `pictureBook`, …) and it is a large part of how they read.
2. **Silhouette outlines** in `core.js` — the remaining big step toward the
   2D's anime look, needing a tuned edge pass that excludes creases and
   proud detail quads.
3. **Walk cycle and ground shadow** in First Person.
4. **Trinkets**.
