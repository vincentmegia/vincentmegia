# Feature: Fishing Game

## Status

`Shipped` — implemented and running against a real Postgres instance.
Point values, the streak curve, token conversion and gear costs are final
(Business Rules; Open Questions); the seaweed-wall cadence and gap curve
are still tunable.

Reachability: the game is linked from the `/projects` card ("Play now",
`internal/handler/pages.go`'s `projectItems`) and the landing page's
Selected work, not from the header nav (which is a flat Home/Projects/About
row, `internal/handler/nav.go`'s `primaryNavItems`).

How to run the tests:

* Go: `go test ./...` — `internal/service/fishing_validation_test.go`,
  `fishing_service_test.go`, `internal/handler/fishing_game_test.go`, plus
  the `DATABASE_URL`-gated subtest "fishing game routes round-trip through
  the real fishing_scores table" in `cmd/server/e2e_test.go`.
* JS unit: `node --test web/static/js/fishing/*.test.js` (`rules`,
  `engine-state`, `world-scroll`, `boat-visuals`).
* Playwright: `make test-e2e` runs `e2e/fishing-game.spec.js`.

The seaweed-wall and HTMX-revisit changes made after first ship are
recorded under History at the end of this doc.

## Summary

A playable arcade mini-game at `/fishing-game` (no longer linked from the
header nav — see the Status note above): the player casts a line from a boat and
steers it down through the ocean, catching increasingly valuable fish the
deeper they go without taking a hit from a hazard. Rounds earn fishing tokens, spent between
rounds on gear upgrades that make deeper, higher-scoring runs survivable. A
small public leaderboard shows the best runs across all visitors.

## Problem / Motivation

CLAUDE.md names "Personal interests" as planned content — a section outside
the professional/resume material. The site currently has no content there,
and no interactive, just-for-fun feature at all; everything shipped so far
(Resume, the landing carousel) is informational. A small game gives the site
a personal, playful moment and, as a side effect, gives Postgres a second
real consumer beyond Resume (the leaderboard) distinct from that feature's
read-mostly structured-content use case.

## Scope

**In scope:**

* A canvas-based descent game: auto-scrolling downward through the ocean,
  player steers left/right to catch fish and dodge hazards.
* Depth-gated fish variety: which fish (and their point values) can spawn is
  driven by current depth.
* A no-hit streak multiplier layered on top of depth: the longer the player
  goes without taking a hit, the more the spawn pool and catch value both
  bias toward higher-value fish; a hit resets the multiplier (but not
  depth), so "deeper without getting hit" is the literal scoring mechanic,
  not just a byproduct of depth alone.
* A lives/hit system: a hazard collision costs one life; the round ends when
  lives reach zero, or in a success state if the player reaches the 1000-mile
  depth cap.
* Per-round scoring (fish points + a depth bonus) converted to fishing tokens
  at round end.
* A gear upgrade shop between rounds: tokens buy leveled-up equipment (more
  lives, faster steering, wider catch radius, better spawn odds for rare
  fish) that persists across rounds.
* Player progress (tokens, gear levels, personal best) persisted in the
  browser (`localStorage`) — no visitor accounts exist on this site (see Open
  Questions in `docs/features/home.md`'s Settings scope; Settings is
  site-owner-only), so there's no identity to hang server-side per-player
  state off of.
* A small public leaderboard (Postgres-backed): top scores across all
  visitors, submitted voluntarily after a round with a self-chosen display
  name, visible to everyone.
* A `/projects` card and a landing "Selected work" card linking into the
  game. (It was originally a Home-dropdown nav item; that dropdown was
  removed when the header became a flat link row — see History.)
* Hand-authored SVG illustrations for the fish varieties and hazards,
  matching the placeholder-illustration approach already used for the landing
  carousel (`docs/features/landing-carousel.md`).

**Out of scope:**

* Server-authoritative gameplay / real anti-cheat. The game simulation runs
  entirely client-side; the leaderboard trusts submitted scores subject only
  to coarse sanity bounds (see Security Considerations). This is a casual
  arcade toy with no stakes, not a competitive product — full server-side
  replay validation is not worth building for it.
* Visitor accounts, cross-device sync, or any server-side persistence of an
  individual player's tokens/gear/history. `localStorage` only; clearing
  browser data resets progress. Revisit if that turns out to bother players
  enough to matter.
* Multiplayer or real-time interaction between players.
* Sound design (music/SFX) — a mute-by-default, visual-only game is enough
  for v1; can be added later without changing this doc's scope.
* Mobile-native app packaging — this is a browser game like the rest of the site.

---

## User Flow

```text
1. User clicks "Play now" on the /projects card (or the landing page's
   Selected work card, or navigates directly to /fishing-game).
   Page loads: a start screen shows current tokens, best depth/score (read
   from localStorage), the gear shop, and a "Start Dive" button, plus the
   public leaderboard fragment loaded alongside it.
2. User clicks "Start Dive". A fisherman figure standing in the boat/rod,
   anchored near the top of the canvas, casts a line with a hook at its end
   — a brief cast animation (the line paying out to its full length) plays
   before normal play begins; the line then stays out for the whole round
   (see Business Rules — one continuous descent, not repeated cast/reel
   cycles). Arrow keys / WASD **or the mouse** move the boat, line, and hook
   left/right together as one rigid unit — there is no separate "swing" for
   the hook independent of the boat. Descent itself is conveyed visually:
   the water/background and every fish/hazard sprite scroll *upward* past
   the fixed boat position at a rate tied to the current descent speed, the
   same illusion any vertical scroller uses to read as "the player is moving
   down" without the boat's own screen position ever changing. As depth
   increases, the boat (and its fisherman) gradually fades out — the line
   and hook stay fully visible throughout, so the impression is of a boat
   left far behind at the surface while the line keeps paying out into the
   depths below it (see Visual Direction's "Cast animation and boat fade").
   A HUD overlays the canvas: current depth (miles), score, lives remaining,
   tokens balance, and the current streak multiplier.
3. Fish scroll up from the bottom of the screen toward the boat; touching one
   with the hook is the catch — no separate cast/reel input beyond the
   initial throw — and adds its point value (times the current streak
   multiplier) to the score. Which fish varieties can appear is gated by
   current depth and, on top of that, by the no-hit streak multiplier (see
   Business Rules): the longer the player has gone without a hit, the
   higher-value fish start appearing and are worth more.
4. Hazards also scroll up toward the boat; colliding with one costs a life,
   resets the streak multiplier back to its base, and grants a brief
   invulnerability window before another hit can register. Losing all lives
   ends the round immediately ("You were caught!"). Descent speed gradually
   ramps up both with depth and with how long the round has run — the same
   speed value that drives both the scoring math (unchanged) and how fast
   the world scrolls past the boat, so a visually faster descent and a
   harder round are always the same moment, not two separate systems that
   could drift out of sync.
5. Reaching 1000 miles depth ends the round in a success state ("You reached
   the abyss!") instead, awarding a completion bonus.
6. Round-over screen shows: fish caught, final score, depth reached, tokens
   earned this round (added to the running balance), and a "Submit to
   leaderboard" name field (optional) plus "Dive Again" and "Open Shop"
   buttons.
7. In the shop (reachable from the start screen or round-over screen), the
   player spends their token balance leveling up gear: each upgrade shows its
   current level, effect, and next-level token cost; buying deducts tokens
   and immediately applies for the next round.
8. User can follow any nav link away at any time; an
   in-progress round is abandoned (no partial-round token award) if the user
   navigates away mid-dive.
```

---

## Visual Direction

Follows `tailwind-ui`'s Visual Style principles; specifics for this feature:

* The canvas game scene (ocean, boat/line/hook, fish, hazards) uses its own
  fixed dark-ocean palette regardless of the site's light/dark mode toggle —
  a bright, light-mode ocean would undercut the setting, and every other site
  using this pattern (e.g. games with a night sky, a stage) commits to one
  scene palette rather than skinning the play area itself. The HUD, start
  screen, shop, and leaderboard chrome *around* the canvas still fully follow
  the site's dark mode like every other page (`tailwind-ui`'s Dark Mode).
* **The boat/rod is the only screen-fixed element.** It sits anchored near
  the top of the canvas and never moves vertically — its horizontal position
  is the one thing the player directly controls (arrows/WASD/mouse), and the
  line + hook hang from it and move with it as a single rigid unit (no
  independent hook "swing"). Depth is communicated entirely by the world
  scrolling upward past this fixed anchor, not by the boat itself descending
  — see Client-side Behavior's "World scroll" note for why a screen-fixed
  anchor plus a scrolling world reads as continuous descent without an
  unbounded canvas.
* **A fisherman figure stands in the boat**, holding the rod — a small
  silhouette (head + body, matching the flat/simple shape language used
  throughout this feature) rather than a bare hull, so the boat reads as
  "someone fishing" rather than an empty vessel.
* **Cast animation and boat fade** (cosmetic only — see Business Rules'
  explicit callout that neither of these changes the hook's collision
  position or timing): at the start of every round, a brief cast animation
  plays — the line visibly pays out from a short, just-cast length to its
  normal full length over roughly the first half-second — before settling
  into normal play. From then on, as depth increases, the boat/fisherman/rod
  group gradually fades toward a faint, near-transparent minimum (the line
  and hook are never affected by this fade and stay fully opaque for the
  whole round), so the visual read over a dive is: a cast at the surface,
  then a boat left further and further behind while the line keeps paying
  out into the depths below it. This is pure presentation layered on top of
  the existing fixed boat/hook positions (Client-side Behavior's "World
  scroll" and "Cast animation and boat fade" notes) — it doesn't move the
  hook, change collision, or pause/alter scoring or spawning while the cast
  animation plays.
* **Fish and hazard sprites render as their actual hand-authored SVGs**
  (`web/static/images/fishing/fish-*.svg` / `hazard-*.svg`), not the flat
  colored circles used as a scaffolding placeholder earlier in this
  feature's build-out — that placeholder was always meant to be temporary
  (see Client-side Behavior's "Sprite image rendering"), not a final visual
  choice, and this doc treats it as a defect, not an accepted gap. Same
  illustrative style as the landing carousel's placeholder art
  (`docs/features/landing-carousel.md`) — simple, flat, readable at small
  size, one silhouette-recognizable shape per creature so players can tell
  fish from hazards at a glance without reading anything. Sprites scroll
  upward with the rest of the world (spawning off the bottom edge, despawning
  once they exit the top) rather than drifting in place, per World scroll.
  The boat/rod/fisherman remain canvas-drawn primitives, not images — that
  is an intentional, permanent choice (Client-side Behavior's "World scroll"
  and "Cast animation and boat fade" notes), unrelated to this gap.
* Higher-value fish read as visually "richer" (e.g. warmer/brighter accent
  color, slightly larger) so a player can eyeball that a catch was worth more
  without checking the score number.
* HUD numbers use a monospace or tabular-figure treatment so depth/score
  don't jitter in width as digits change every frame.

---

## UI

```text
web/templates/
├── pages/
│   └── fishing-game.html        # canvas + HUD + start/round-over/shop overlays
└── components/
    ├── fishing-shop.html        # gear upgrade list (level, effect, cost, buy button)
    └── fishing-leaderboard.html # top-N scores fragment (also the HTMX partial)

web/static/
├── images/fishing/
│   ├── fish-*.svg                # one per variety (see Business Rules), loaded and drawn as the real sprite image
│   └── hazard-*.svg              # one per hazard type, loaded and drawn as the real sprite image
│                                  # (diver.svg is the one exception, and stays
│                                  #  unused/superseded — the boat/rod/
│                                  #  fisherman are drawn with canvas
│                                  #  primitives, not a loaded image, an
│                                  #  intentional and permanent choice, unlike
│                                  #  fish/hazard sprites above — see Open
│                                  #  Questions for diver.svg's disposition)
└── js/
    ├── fishing-game.js           # canvas game loop, input, localStorage progress
    └── fishing/
        ├── rules.js               # unchanged by this revision — pure scoring/spawn/speed/token math
        ├── engine-state.js        # unchanged by this revision — pure round-state (lives/streak/depth-cap)
        └── world-scroll.js        # pure: converts descent speed into a per-frame scroll offset,
                                    # spawn-from-bottom / despawn-past-top sprite positioning
```

States this feature's UI must handle:

| State                     | Behavior |
| -------------------------- | -------- |
| Start screen                | Shows tokens/best score from `localStorage`, shop entry point, leaderboard, "Start Dive". |
| Playing                     | Canvas game loop running; HUD updates every frame. |
| Hit / life lost              | Brief visual/knockback feedback with a flicker for the invulnerability window; HUD lives count decrements and streak multiplier resets. |
| Round over — caught          | "You were caught!" summary screen; lives reached zero. |
| Round over — reached bottom  | "You reached the abyss!" summary screen; depth cap hit. |
| Shop                         | Upgrade list with affordable vs. too-expensive items visually distinguished; buying is disabled (not just visually, but functionally) once the balance can't cover the next level. |
| Leaderboard loading          | A local loading indicator while the fragment fetches. |
| Leaderboard empty            | "No scores yet — be the first!" rather than a blank list. |
| Leaderboard error             | A generic "couldn't load the leaderboard" message; the rest of the page (game, shop) still works. |
| `localStorage` unavailable   | (private browsing / disabled storage) Game still fully playable for the session; tokens/gear reset to defaults each visit and a small notice explains progress won't be saved — never a hard error that blocks play. |
| Reduced motion                | See Client-side Behavior — the canvas gameplay itself can't honor `prefers-reduced-motion` (motion is the game), but all *surrounding* UI transitions (shop, screens) do. |
| Sonar callout                | Visible (HUD banner naming the next hazard) only while Sonar Range is purchased and the next hazard's predicted spawn falls within that level's lookahead window; hidden otherwise, and never blocks/delays canvas gameplay underneath it. |
| Sprite image failed/slow to load | That one sprite instance falls back to its original flat colored circle (fish: blue, or gold if `rare`; hazard: red) for the frames until the image is ready or is confirmed to have failed — never a broken-image icon, and never blocking the rest of the game. Matches the landing carousel's "Image failed to load" precedent (`docs/features/landing-carousel.md`). |

---

## HTMX Interactions

The game loop itself (canvas rendering, input, collisions, scoring, gear
effects, `localStorage` reads/writes) is not represented as HTTP requests —
see Client-side Behavior below for why, consistent with `htmx-ui`'s "avoid
unnecessary JavaScript" principle allowing a scoped exception where an
interaction genuinely can't be modeled as request/response (the same
reasoning `docs/features/home.md` uses for `header-scroll.js`). HTMX is used
for the two things that *are* naturally request/response: page navigation and
the leaderboard.

| Trigger                          | Method | Endpoint                  | Target                  | Swap        | `hx-push-url` | Indicator            |
| ---------------------------------- | ------ | --------------------------- | -------------------------- | ----------- | -------------- | ---------------------- |
| `/projects` "Play now" → Fishing Game | GET    | `/fishing-game`             | `#main-content`            | `outerHTML` | `true`         | `#nav-loading`          |
| Page load (leaderboard fragment)     | GET    | `/fishing-game/leaderboard` | `#fishing-leaderboard`     | `innerHTML` | n/a            | `#leaderboard-loading`  |
| "Submit to leaderboard" (round over) | POST   | `/fishing-game/score`       | `#fishing-leaderboard`     | `outerHTML` | n/a            | `#leaderboard-loading`  |

`POST /fishing-game/score` returns the same leaderboard fragment
(`fishing-leaderboard.html`), re-rendered with the new entry included if it
placed — so a successful submission's own row becomes visible immediately
without a second round-trip.

Confirmation required for destructive actions:

* "Reset progress" (shop screen, clears local tokens/gear/best-score) uses a
  native `confirm()` prompt before clearing `localStorage` — it only affects
  this browser's local game state, never the shared leaderboard, so it's a
  lighter-weight confirmation than a server-side destructive action, but
  still irreversible from the player's point of view and shouldn't be a
  single accidental click.

---

## Client-side Behavior (non-HTMX)

`fishing-game.js` (one external file, no inline `<script>` tags, consistent
with `docs/features/home.md`'s CSP rule) owns everything HTMX cannot model:

* **Game loop**: `requestAnimationFrame`-driven canvas rendering — boat/
  line/hook position, world-scroll offset (ramping with depth and elapsed
  time, via the same `descentSpeed()` value the scoring math already uses —
  see "World scroll" below), fish/hazard spawning and movement, collision
  detection (including the post-hit invulnerability window and
  streak-multiplier tracking), HUD updates. Pauses automatically when the
  tab loses focus (`visibilitychange`) so a backgrounded tab doesn't burn a
  life pool the player never saw coming.
* **World scroll**: the boat's on-screen position never changes vertically —
  depth is communicated by scrolling the water/background and every fish/
  hazard sprite *upward* past the fixed boat at a rate derived from
  `descentSpeed()`, the standard illusion vertical scrollers use ("you're
  moving down relative to the world" reads identically to "the world is
  moving up relative to you"). This avoids needing an unbounded canvas or a
  camera that follows the boat down forever. Fish/hazards spawn just past
  the bottom edge and are removed once they scroll past the top edge, rather
  than the previous behavior of drifting/bouncing within a fixed box — see
  `world-scroll.js`, a pure module (no DOM/canvas access) so this
  spawn/scroll/despawn math is unit-testable the same way `rules.js` and
  `engine-state.js` already are.
* **Sprite image rendering**: fish and hazard sprites draw their actual
  `fish-*.svg`/`hazard-*.svg` image (`web/static/images/fishing/`), keyed by
  the `imageSlug` already computed at spawn time (see
  `spawnFishSprite`/`spawnHazardSprite`), not the flat colored circles used
  as a scaffolding placeholder earlier in this feature's build-out. A small
  in-memory cache (a plain `Map`, keyed by `` `${kind}:${imageSlug}` `` — not
  just `imageSlug`, since fish and hazard art live in separate filename
  namespaces and a slug collision between them isn't otherwise ruled out —
  this is inherently DOM-dependent via the `Image` constructor, so unlike
  `world-scroll.js`/`boat-visuals.js` it isn't a candidate for a separate
  pure/tested module, same reasoning as why `localStorage` handling also
  lives directly in `fishing-game.js`) holds one `Image` per distinct sprite
  variety, created and assigned its `src` once on first use rather than once
  per sprite instance — many sprites of the same fish/hazard variety share
  one already-loading-or-loaded `Image` object, they never each trigger
  their own fetch. Each frame, a sprite draws via `ctx.drawImage(...)`,
  sized off its existing `hitboxRadius` (e.g. roughly `hitboxRadius * 2` to
  `* 2.2` square, centered on `sprite.x`/`sprite.y`), if-and-only-if that
  variety's cached `Image` reports itself loaded and valid
  (`image.complete && image.naturalWidth > 0`); otherwise (still loading, or
  the request failed) the sprite falls back to exactly the same flat colored
  circle rendering this feature already had, per the UI states table's
  "Sprite image failed/slow to load" row — every sprite is always drawn as
  *something* representable, never a blank gap or a broken-image glyph, and
  a slow/broken fish or hazard image never blocks or delays the rest of the
  game loop.
* **Cast animation and boat fade**: purely presentational, computed each
  frame alongside the rest of rendering — neither ever touches `boat.x`,
  `HOOK_Y`, collision detection, spawning, or scoring math. `state.elapsedSeconds`
  (already reset to 0 and incremented every frame by `engine-state.js`, with
  no separate timer needed) drives the initial cast: for roughly its first
  0.4-0.5s, the rendered line length is interpolated from near-zero up to
  the normal boat-to-hook distance rather than drawn at full length
  immediately, purely as a drawing detail — the
  round's actual state (`engine-state.js`'s `roundStatus`, hook position,
  collision) is already fully live from frame one, so a fish or hazard that
  happens to spawn during this brief window still behaves normally; nothing
  is paused or gated on the animation finishing. Once that window elapses,
  the boat/fisherman/rod group's opacity is derived directly from
  `state.depthMiles` — e.g. linearly interpolated from fully opaque at 0mi
  down to a faint, non-zero minimum by some illustrative depth (tune during
  build; not fully `0` opacity, so the boat never disappears entirely) — and
  stays at that minimum for the rest of the round. The line and hook are
  drawn in a separate pass at full opacity regardless of the boat's current
  fade, so they never fade with it.
* **Sonar callout**: computed every frame in the game loop, driven by the
  same `hazardSpawnIntervalSeconds(depth)` / `timeSinceHazardSpawn`
  countdown that already governs real hazard spawning — not a separate
  timer or a new queueing system. Once Sonar Range is actually purchased
  (gear level > 0) and that countdown drops to within
  `sonarLookaheadSeconds(save.gear.sonarRange)` (`rules.js`) of the next
  spawn, the HUD's optional `elements.hud.sonarCallout` element
  (`<p id="fishing-sonar-callout">`, hidden by default,
  `role="status" aria-live="polite"`) shows text naming the predicted
  hazard, resolved via the existing non-randomized
  `hazardBandFor(depthMiles)` (hazard *type* is a pure function of current
  depth; only spawn *timing* is randomized, so predicting the type slightly
  ahead of the real spawn is exact, not a guess). It clears the same frame
  the real hazard actually spawns, since the interval timer resets to 0
  immediately before this check runs each frame. Purely informational —
  it never gates, delays, or alters real spawn timing, hazard type, or
  collision, the same discipline as the Cast animation/boat fade note
  above.
* **Input**: arrow keys / WASD, **or the mouse** (moving the mouse over the
  canvas sets the boat's target horizontal position) on desktop; on-screen
  touch buttons (or drag-to-steer) on mobile/touch viewports, since a canvas
  game has no natural HTMX or keyboard-only equivalent for touch devices. All
  three input methods drive the same single horizontal position — the boat,
  line, and hook always move together as one unit, never independently.
  Keyboard and drag are *directional* — `boat.x` moves at a capped
  `steeringSpeed` (px/s, boosted by Ballast Thrusters) toward wherever
  they're steering — but the mouse is *positional*: `boat.x` snaps directly
  to the cursor's canvas x every frame, uncapped, since "moving the mouse
  sets the target position" reads as 1:1 tracking, not a slower directional
  nudge toward it (capping it to the same speed as keyboard/drag made mouse
  steering visibly lag behind normal cursor movement — a real, discovered
  defect, not a documented design choice). This distinction only holds if a
  desktop mouse actually reaches `onMouseMove`'s instant-tracking path
  rather than the drag-to-steer one: `pointerdown`/`pointermove` (the
  handlers backing drag-to-steer) fire for a plain mouse click too, not
  just touch, since Pointer Events unify mouse/touch/pen — so both handlers
  explicitly ignore `e.pointerType === 'mouse'`, letting a click-and-hold
  (or even a stray click) fall through to `onMouseMove` instead of
  re-engaging the capped drag easing. Without that guard, clicking or
  holding the button while moving — an easy, natural instinct — silently
  put a desktop mouse user back on the slow, capped path even after the
  hover-only case above was already instant; this was a real, initially-
  missed second instance of the same lag, not a separate design decision.
  Priority when more than one
  method has a live input is keyboard > drag > mouse, resolved once per
  frame in `updateBoat()`; critically, pressing a movement key also clears
  any in-flight `mouseTargetX` (not just outranks it while held) so a stale
  cursor position — e.g. wherever the mouse was resting when "Start Dive"
  was clicked — can't silently reassert control the instant the key is
  released and visibly snap/ease the boat back. Mouse regains control only
  once the cursor actually moves again after that.
* **Progress persistence**: reads/writes a single `localStorage` key (e.g.
  `fishing-game:v1`) holding `{tokens, gear: {...levels}, bestScore,
  bestDepth}`. Versioned key name so a future save-format change can migrate
  or safely discard old saves rather than crash on unexpected shape.
* **Reduced motion**: the gameplay canvas itself can't honor
  `prefers-reduced-motion` — continuous motion is the mechanic — but every
  *non-gameplay* transition this feature owns (shop panel open/close,
  round-over screen appearing) does, per `htmx-ui`'s timing guidance. This is
  called out explicitly as the one place this site's UI doesn't fully honor
  that preference, rather than silently ignoring it.
* **Cleanup**: the loop is torn down (canceled `requestAnimationFrame`,
  listeners removed) when the user navigates away via an HTMX nav click, not
  just on a full page unload — otherwise a backgrounded game loop from a
  previous visit to `/fishing-game` would keep running after an HTMX swap
  replaces `#main-content`.

---

### Test-only hook

`fishing-game.js` defines `window.__fishingGameTestHooks.forceRoundOver(outcome)`
(`outcome` is `'caught'` (default) or `'reached-abyss'`). It ends the
in-progress round through the real transitions — repeated
`applyHazardHit` calls (an Emergency Ballast charge absorbs the first, as
in play) or `advance(state, DEPTH_CAP_MILES, 0)` — then the real
`endRound()`, so `e2e/fishing-game.spec.js` can reach the round-over
screen without waiting on random spawns. It is a no-op unless a round is
running. It is installed unconditionally (no env flag); it only ends the
visitor's own local round.

---

## Routes / Handlers

| Method | Path                        | Handler                          | Auth required | Notes |
| ------ | ---------------------------- | ----------------------------------- | ------------- | ----- |
| GET    | `/fishing-game`               | `FishingGameHandler.Index`          | no            | Page shell; leaderboard fragment loads via its own request, not inline, so a slow leaderboard query never blocks first paint of the game itself. |
| GET    | `/fishing-game/leaderboard`   | `FishingGameHandler.Leaderboard`    | no            | Returns top-N scores fragment. |
| POST   | `/fishing-game/score`         | `FishingGameHandler.SubmitScore`    | no            | Validates and inserts a leaderboard entry; returns the refreshed fragment. Rate-limited (see Security Considerations). |

---

## Data Model

```sql
-- migrations/002_create_fishing_scores.sql
CREATE TABLE fishing_scores (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    player_name         TEXT NOT NULL,
    score               INT NOT NULL,
    depth_reached_miles INT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fishing_scores_player_name_length CHECK (char_length(player_name) BETWEEN 1 AND 20),
    CONSTRAINT fishing_scores_score_range CHECK (score BETWEEN 0 AND 999999),
    CONSTRAINT fishing_scores_depth_range CHECK (depth_reached_miles BETWEEN 0 AND 1000)
);

CREATE INDEX idx_fishing_scores_score ON fishing_scores (score DESC);
```

| Table            | Column                | Type          | Constraints                          | Notes |
| ------------------ | ------------------------ | --------------- | ---------------------------------------- | ----- |
| `fishing_scores`   | `id`                     | `BIGINT`        | PK, identity                              | |
| `fishing_scores`   | `player_name`            | `TEXT`          | not null, 1–20 chars                      | Self-chosen display name, not an account — rendered on the public leaderboard. |
| `fishing_scores`   | `score`                  | `INT`           | not null, `0..999999`                     | Coarse upper bound only; not real anti-cheat (see Security Considerations). |
| `fishing_scores`   | `depth_reached_miles`    | `INT`           | not null, `0..1000`                       | Enforces the game's own depth cap at the DB layer too. |
| `fishing_scores`   | `created_at`             | `TIMESTAMPTZ`   | not null, default `now()`                 | |

Player tokens, gear levels, and personal best are **not** stored in Postgres
— they live in the browser's `localStorage` (Client-side Behavior above),
since this site has no visitor identity to key server-side per-player state
on. `fishing_scores` is the only server-side table this feature adds, and it
holds only voluntarily-submitted, already-finished round results.

---

## Business Rules / Validation

* **Fish varieties, gated by depth** (point values are final, not
  illustrative — locked in and matching `rules.js`'s `FISH_BANDS` exactly.
  Roughly 1.3-2x apart within a band and 2-3x apart across bands, so a catch
  visibly "feels" like a tier-up rather than a marginal difference, with
  Golden Koi's 750 as a deliberate, disproportionate jackpot for the single
  rarest catch in the game rather than a smooth continuation of the curve):

  | Depth range (mi)  | Fish            | Points |
  | -------------------- | ----------------- | -------- |
  | 0–100                 | Sardine            | 10       |
  | 0–100                 | Anchovy            | 15       |
  | 100–300                | Mackerel           | 30       |
  | 100–300                | Clownfish          | 40       |
  | 300–600                | Tuna               | 75       |
  | 300–600                | Swordfish          | 100      |
  | 600–900                | Anglerfish         | 200      |
  | 600–900                | Giant Squid        | 300      |
  | 900–1000               | Golden Koi (rare)  | 750      |

  A fish's variety pool is drawn only from the player's *current* depth's
  row(s) — reaching a deeper band doesn't retroactively make shallow fish
  stop spawning entirely, but the spawn-weight shifts increasingly toward the
  higher band the deeper the player is.
* **No-hit streak multiplier** (the actual "deeper without getting hit"
  mechanic — depth-gating above is necessary but not sufficient on its own):
  a streak counter tracks depth descended (miles) since the last hit — the
  same unit as the depth bonus and fish-gating, not raw on-screen path
  length, so weaving side-to-side doesn't build streak faster than
  descending in a straight line — and drives a multiplier, final (not
  illustrative): starting at 1.0x and gaining +0.05x per 10 miles hit-free,
  capped at 2.5x (matching `rules.js`'s `STREAK_MULTIPLIER_STEP`/`_MAX`) —
  chosen so the cap takes 300 hit-free miles to reach, comfortably achievable
  within a single strong band-3/band-4 run without trivializing the risk of
  a hit resetting it. While the streak is elevated it (a) biases
  spawn weighting further toward the top of the currently-reachable pool —
  including letting the *next* depth band's lowest-tier fish start appearing
  a little early — and (b) directly multiplies the point value of each fish
  caught. Taking a hit resets the multiplier to 1.0x immediately (but never
  reduces depth itself — depth only ever goes up), so a hit is a real,
  visible cost without erasing overall run progress. This is what makes
  "descend far without getting hit" the actual scoring lever, not just a
  side effect of depth.
* **Hazards** increase in frequency and speed with depth — descending isn't
  free; it's the risk half of the risk/reward loop (illustrative, tune
  during build):

  | Depth range (mi)  | Hazard         | Behavior |
  | -------------------- | ---------------- | ---------- |
  | 0–200                 | Jellyfish         | Slow drift, small hitbox |
  | 200–500                | Rock / mine        | Stationary or slow, larger hitbox |
  | 500–800                | Eel                | Fast, erratic movement |
  | 800–1000               | Shark              | Fast, actively steers horizontally toward the boat's current x-position |

  Horizontal movement is free/continuous (not a discrete-lane system) —
  stated explicitly here since gear like Magnetic Lure's catch radius and
  Ballast Thrusters' steering speed only make sense against a continuous
  position, not lane slots. There is no vertical positioning to speak of:
  the boat/line/hook's on-screen vertical position never changes (see
  Visual Direction and Client-side Behavior's "World scroll") — only the
  world scrolls, so "movement" for every sprite in this table is a
  horizontal-only component layered on top of the shared upward scroll.
* **Seaweed obstacle walls**: a periodic "obstacle course" event layered on
  top of the continuous hazard rotation above, not a fifth row in that
  table — a horizontal band of stationary seaweed strands spans the play
  area with one navigable gap the player must steer through, rather than a
  single point-hazard to dodge. Depth-triggered, not time-triggered: the
  first wall spawns at 80 depth-miles (easing a fresh round in before the
  first gap-navigation challenge), then every 120 depth-miles after that —
  a wall's *frequency* doesn't scale with depth, only its *difficulty*
  does. That difficulty comes entirely from the gap narrowing:
  `seaweedGapWidth(depthMiles)` (`rules.js`) interpolates linearly from
  170px wide at depth 0 down to a 95px hard floor at the 1000-mile depth
  cap — never narrower, so a wall is harder at depth but never literally
  unfair/impassable, the same "harder but never unplayable" shape
  `descentSpeed`'s own asymptote already commits to elsewhere in this
  table. The gap's horizontal center is randomized per wall (kept fully
  on-screen), so its position is never predictable from depth alone.
  Colliding with any individual strand costs a life exactly like colliding
  with any other hazard — `engine-state.js`'s `applyHazardHit` needed zero
  changes, since a strand is architecturally just an ordinary hazard-kind
  sprite (stationary: `vx: 0` on the existing generic per-sprite
  horizontal-motion update, no new movement `behavior` needed) placed in a
  row, with none placed across the gap's x-range. See Client-side
  Behavior's "Sprite image rendering" for the strand art
  (`hazard-seaweed.svg`).
* **One continuous cast per round, not repeated cast/reel cycles**: the line
  goes out once, at the start of the round, and stays out until the round
  ends (a hit-based "caught" or the depth-cap "reached the abyss") — there is
  no manual reel-in/re-cast action mid-round. The boat, line, and hook always
  move together as a single rigid horizontal unit under arrow/WASD/mouse
  control; the hook has no independent movement relative to the boat (no
  swing/pendulum/trailing behavior).
* **The cast animation and the boat's depth-based fade are purely cosmetic**:
  neither changes the hook's fixed collision position (`HOOK_Y`), delays
  when collision/scoring becomes active, or affects `boat.x`'s response to
  input in any way — a fish or hazard spawning during the initial cast
  animation, or once the boat has faded to its minimum opacity, behaves
  exactly as it would at any other point in the round. This is stated
  explicitly because it's the kind of thing that's easy to accidentally
  couple to gameplay state while implementing a visual effect, and doing so
  isn't the intent here.
* **Lives and hit recovery**: default 3 lives (Hull Plating gear level 0);
  each hazard collision costs exactly one life regardless of hazard type and
  resets the streak multiplier. A ~1.2s invulnerability window (with a
  visual flicker) follows every hit — including a hit absorbed by Emergency
  Ballast (see Gear upgrades below), which grants the same window even
  though no life was lost, so a hazard cluster can't cost a real life
  immediately after the shield burns simply because the i-frames never
  started. Zero lives ends the round immediately in the "caught" state.
* **Fish/hazard overlap**: a fish catch and a hazard hit are evaluated
  independently each frame — if a fish and a hazard sprite happen to overlap
  the hook in the same frame, both resolve (the fish is caught *and* the
  hit registers). No special-cased priority between them; this keeps
  collision handling simple and avoids an exploit where hovering into a
  hazard's exact position would otherwise block an otherwise-legitimate
  catch.
* **Depth cap**: 1000 miles is the hard maximum (per the feature request);
  reaching it ends the round in the "reached the abyss" success state with a
  completion bonus, rather than the player being able to continue
  indefinitely. This is an intentionally arcade/whimsical unit, not a claim
  about real ocean depths.
* **Descent speed ramps up gradually on two axes**: with current depth (e.g.
  a small speed increase every 100 miles) and with elapsed time in the round
  (a slow continuous ramp independent of depth) — so a run that's both deep
  and long-running is meaningfully harder to navigate than the opening
  seconds, reinforcing the "how far do you push it" tension rather than
  presenting a flat, unchanging difficulty for the whole dive. Both ramps
  approach a documented maximum speed asymptotically rather than increasing
  without bound, so an extremely long/deep run gets harder without ever
  becoming literally unplayable or glitching past what collision detection
  can handle at a given frame rate.
* **Catching a fish** is passive: the hook's hitbox touching a fish sprite
  is the catch, with no separate cast/hook input beyond the round's single
  initial throw. Consistent with hazard
  collision using the same touch-based model, so the player only has one
  input concept (steer to touch what you want, avoid what you don't) rather
  than two different interaction styles for fish vs. hazards.
* **Scoring**: round score = sum of (caught-fish point value × streak
  multiplier at the moment of catch) + a depth bonus of +1 point per whole
  mile descended (final, not illustrative — matches `rules.js`), so purely
  surviving deep without many catches still rewards something, though it's
  deliberately a minor contributor next to actual catches (a full 1000-mile
  dive is worth 1000 points from depth alone — roughly one Golden Koi
  catch's worth, and still well short of what a handful of real catches
  along the way would add — so catching fish, not just surviving, stays the
  dominant scoring lever).
* **Tokens**: awarded at round end only (no partial credit for an abandoned
  round — see User Flow step 8). Final formula (matching `rules.js`'s
  `roundTokens`): `floor(score / 20) + 5 × ⌊depth reached / 100⌋` — a flat
  20:1 score-to-token rate plus a flat 5-token bonus per full 100-mile band
  reached that round, chosen so depth milestones stay meaningfully rewarding
  even on a low-catch run (surviving to 900mi alone is worth 45 tokens
  before any fish are counted), without letting the milestone bonus dwarf
  score-driven tokens on a genuinely good run.
* **Gear upgrades** — costs and magnitudes are final, not illustrative,
  matching `GEAR_DEFS`/the gear-effect functions in `fishing-game.js`, with
  one exception noted in the table below (Sonar Range's lookahead-seconds
  magnitude, which is new and still illustrative). Every cost curve is
  `round(baseCost × costGrowth ^ currentLevel)`, 5 levels except Emergency
  Ballast (a single 0/1 unlock, per its own note below):

  | Gear             | Effect per level                              | Base cost | Growth ×/level |
  | ------------------ | ------------------------------------------------ | ----------- | ----------------- |
  | Hull Plating        | +1 max life                                        | 40          | 1.6                |
  | Ballast Thrusters    | +15% lateral steering speed (easier hazard dodges) | 35          | 1.6                |
  | Magnetic Lure        | +6px catch radius around the hook                  | 35          | 1.6                |
  | Golden Bait            | Shifts spawn weight further toward higher-value fish for the current depth | 45 | 1.7 |
  | Sonar Range         | HUD callout names the next hazard shortly before it spawns; advance warning scales with level (0.4s per level, up to 2.0s at max) | 30 | 1.6 |
  | Emergency Ballast       | Once per round, automatically absorbs a hit — no life lost, streak not reset — then must recharge (available again next round) | 60 | n/a (single level) |

  Maxing any one 5-level line costs roughly 475-850 tokens total across its
  5 levels (the exact total varies by base cost/growth rate above; Sonar
  Range's own 30-base/1.6-growth line is the cheapest of the five at ~475) —
  by design a multi-run investment, not a first-round purchase, so the shop
  stays a meaningful long-term goal rather than something a single good dive
  clears out.

  Emergency Ballast is deliberately not just another flat number: it's a
  once-per-round safety net rather than a permanent stat increase, giving
  the shop a second kind of decision (raw survivability/speed/reward vs. a
  one-shot mistake-forgiveness tool) instead of parallel sliders.

  **Sonar Range's effect is a HUD callout that names the next hazard
  shortly before it spawns** — the fix for a real, previously-discovered
  defect where the gear was purchasable and cost tokens like every other
  item, but nothing in the game loop ever read the multiplier
  `fishing-game.js` computed for it (see Open Questions for how that was
  found and how this resolves it). Its originally-intended effect
  ("fish/hazards become visible farther ahead") never had an obvious
  implementation in this game's fixed-canvas/world-scroll architecture: a
  sprite already becomes visible at the exact same on-screen moment
  (crossing the bottom edge) regardless of how far below the canvas it
  originally spawned, so simply increasing its spawn margin would have had
  no effect on when the player can actually see it. A HUD callout sidesteps
  that architecture problem entirely by predicting rather than
  pre-rendering: `sonarLookaheadSeconds(sonarRangeLevel)` (`rules.js`)
  returns `clampedLevel × 0.4` seconds of advance warning (level clamped to
  `[0, 5]`; 0 at level 0, up to 2.0s at max level 5; non-finite/negative
  input → 0), and the game loop, every frame, compares that lookahead
  against the same `hazardSpawnIntervalSeconds(depth) - timeSinceHazardSpawn`
  countdown that already drives real hazard spawning — no new queueing or
  prediction system needed, since hazard *type* is already a pure,
  non-randomized function of current depth (`hazardBandFor(depthMiles)`;
  only spawn *timing* has randomness), so naming the next hazard slightly
  ahead of its actual spawn is exact, not a guess. See Client-side
  Behavior's "Sonar callout" note for the frame-by-frame mechanics. Unlike
  the rest of this table, the 0.4s-per-level/2.0s-max magnitude is new and
  illustrative/tunable, not final — it has no prior playtesting data behind
  it the way the other gear numbers above do.

  Each gear item has its own level track and token cost curve; levels only
  ever go up (no sell-back/refund) and apply starting the *next* round, not
  retroactively to a round in progress.
* **Leaderboard**: top N (e.g. 20) by score, descending; submission is
  optional and only offered on the round-over screen, never automatic.

---

## Security Considerations

* **Authz**: none required — this is a public, anonymous feature like the
  rest of the unauthenticated site.
* **Input handling**: `player_name` is user-supplied text rendered back to
  every visitor on the public leaderboard — it must go through
  `html/template`'s normal auto-escaping like any other dynamic,
  visitor-sourced content (unlike `NavItem.Icon` in `internal/handler/nav.go`,
  which is trusted because it's hardcoded, never user input). Trim
  whitespace and enforce the 1–20 char bound server-side (not just in the
  DB constraint, so a bad request gets a clear 4xx rather than a raw
  constraint-violation error); invalid UTF-8 and control/format characters (Unicode Cc/Cf: newlines, bidi overrides, zero-width characters) are rejected (`validatePlayerName`, `internal/service/player_name.go`, shared by every game).
* **Untrusted score submissions**: the game simulation is entirely
  client-side (Scope), so `POST /fishing-game/score` is trusting the
  client's reported `score`/`depth_reached_miles`. Mitigate with sanity
  bounds only — the same `0..999999` / `0..1000` ranges as the DB
  constraints, checked in the handler before insert — not full replay
  validation. This is an accepted limitation for a casual, stakes-free arcade
  leaderboard; explicitly not attempting to be cheat-proof.
* **Abuse / spam**: `POST /fishing-game/score` should be rate-limited (e.g.
  per-IP) to prevent a script from flooding the leaderboard with junk
  entries — the concern here is nuisance/pollution, not high-value fraud.
  "Per-IP" is resolved via `internal/middleware.ClientKey`
  (`config.Config.TrustProxyHeaders`), not a raw `r.RemoteAddr` read —
  behind this app's Render deployment, `r.RemoteAddr` is the platform's
  own reverse proxy for every request, so reading it directly would
  collapse every player into one shared rate-limit bucket instead of
  limiting each player independently.
* **The project's own e2e suite is a pollution source too**: this repo has
  no separate test database (`docs/skills/postgres/SKILL.md`) — `e2e/`
  runs against the same `DATABASE_URL` real local development uses (see
  `e2e/playwright.config.js`'s `webServer`). `e2e/fishing-game.spec.js`'s
  leaderboard-submission test therefore deletes its own row (by exact
  `player_name`, in a `finally` block so it runs even on assertion
  failure) immediately after asserting against it, the same discipline
  `cmd/server/e2e_test.go`'s equivalent subtest already had via `t.Cleanup`.
  This was a real, previously-shipped gap: the Playwright test had no such
  cleanup for a while, and every full suite run (Chromium + WebKit) quietly
  left 2 junk `e2e-*` rows on the real leaderboard — 18 accumulated across
  one development session before a user noticed "garbage data" on
  `/fishing-game` and it was traced back here. Any new e2e test that
  submits a real score must clean up after itself the same way.
* **CSRF**: `POST /fishing-game/score`, like every POST/PUT/DELETE, goes
  through `middleware.CrossOriginProtection`, which 403s a browser request
  sent from another site (`Sec-Fetch-Site`/`Origin` check). That stops
  cross-site forgery from a browser only; a script calling the route
  directly is limited only by the per-IP rate limit and validation.
* **Secrets**: none introduced by this feature.
* **No inline `<script>` tags** — `fishing-game.js` is external, consistent
  with this site's strict CSP (`docs/features/home.md`'s Security
  Considerations).

---

## Testing Plan

Unit files below are under `web/static/js/fishing/`; Go tests under
`internal/`.

* [x] Fish spawn pool shifts toward higher-value varieties as depth
      increases (`rules.test.js` `fishSpawnPool`: band selection per depth
      range, streak bias, no low-tier extinction).
* [x] Streak multiplier increases with hit-free distance, caps at 2.5x,
      and a hit resets streak distance (`rules.test.js` `streakMultiplier`;
      `engine-state.test.js` "a hit decrements lives by exactly one and
      resets streak distance").
* [x] A hazard collision costs exactly one life, starts invulnerability; a
      second hit inside the window is a no-op; zero lives → `caught`
      (`engine-state.test.js` `applyHazardHit`).
* [x] Reaching 1000 miles ends in `reached-abyss` even at full lives
      (`engine-state.test.js` `advance`).
* [x] Descent speed increases with depth and elapsed time, and approaches
      but never exceeds its max (`rules.test.js` `descentSpeed`).
* [x] Emergency Ballast absorbs exactly one hit without a life or streak
      loss, starts the invulnerability window, and stays spent until
      recharged (`engine-state.test.js` "Emergency Ballast").
* [x] `world-scroll.js`: sprites move upward only and report off-screen
      past the top edge (`world-scroll.test.js`).
* [x] `sonarLookaheadSeconds`: 0 at level 0, 2.0 s at level 5, clamps
      above, negative/non-finite → 0 (`rules.test.js`).
* [x] `seaweedGapWidth`: max at depth 0, min at the cap and beyond,
      monotonic, bad input → depth 0 (`rules.test.js`).
* [x] Manual: the first seaweed wall appears past 80 miles with a
      navigable gap, and hitting a strand costs one life (recorded at the
      time in a real Playwright session — see History).
* [x] Boat fade is a pure function: 1.0 at depth 0, monotonic, never
      below its minimum (`boat-visuals.test.js` `boatOpacityForDepth`);
      the cast-progress curve likewise (`castProgress`).
* [x] Round-end tokens match the formula (`rules.test.js` `roundTokens`).
* [x] `POST /fishing-game/score` rejects out-of-range score/depth and
      blank/oversized names with a clear 400
      (`TestValidateFishingScoreSubmission`,
      `TestFishingGameHandler_SubmitScore_ValidationRejected`,
      `TestFishingGameHandler_SubmitScore_OutOfRangeScore`).
* [x] HTML/script in `player_name` renders as literal text
      (`TestFishingGameHandler_Leaderboard_Populated`).
* [x] Leaderboard fragment renders empty and populated
      (`TestFishingGameHandler_Leaderboard_Empty`/`_Populated`; e2e
      "leaderboard fragment loads on page load…").
* [x] Rate limiting rejects rapid repeated submissions
      (`TestFishingGameHandler_SubmitScore_RateLimited`).
* [x] e2e: Start Dive advances the depth HUD; round-over for both outcomes
      (via `forceRoundOver`); leaderboard submission round trip (the test
      deletes its own row); Dive Again resets; shop lists all six gear rows;
      Reset progress confirm/decline; revisiting via HTMX from `/projects`;
      no console errors (`e2e/fishing-game.spec.js`).

Not covered by any automated test (implemented, but verify by hand or add
a test):

* [ ] A shop purchase deducts tokens and its effect shows next round (the
      e2e shop test only checks the rows with 0 tokens).
* [ ] `localStorage` progress persists across a reload, and corrupted or
      missing data falls back to defaults without an error.
* [ ] Pressing a movement key clears a stale mouse target, so the boat
      stays where the keyboard left it (`fishing-game.js` sets
      `input.mouseTargetX = null` on a movement key); all three input
      methods share one horizontal position.
* [ ] The leaderboard fragment's fetch-error state.
* [ ] Gear levels apply from the next round, not mid-round (only
      `createInitialState`'s overrides are unit-tested).
* [ ] Visual checks: fish/hazard SVG sprites render (with the
      colored-circle fallback before load or on failure) and share one
      `Image` per variety; the boat's vertical position never changes;
      the cast animation plays every round; spawns during the cast or
      after the fade still collide; the Sonar callout names the next
      hazard inside the lookahead window and never at level 0.

---

## Open Questions

* **Resolved**: fish point values, the streak multiplier curve, the
  score-to-token conversion, and gear costs/magnitudes are now final,
  locked-in numbers (Business Rules), not illustrative placeholders —
  matching what's already live in `rules.js`/`fishing-game.js`.
* **Resolved**: two spots in the shipped UI copy (`fishing-game.html`'s
  intro paragraph, `fishing-shop.html`'s Magnetic Lure description) still
  said "diver" — leftover text from before the boat/rod/fisherman rework.
  `diver.svg` itself being superseded was already documented (see the open
  item below), but the stale player-facing wording was a real, undocumented
  bug, not a design gap; fixed to say "boat" and "hook" respectively,
  matching the terms used throughout this doc.
* **Resolved**: Sonar Range's effect — a real defect, found while
  finalizing gear magnitudes above, not a design gap, where the gear was
  purchasable and cost tokens like every other item but nothing in the game
  loop read the multiplier `fishing-game.js` already computed for it — is
  now a HUD callout that names the next hazard shortly before it spawns,
  with the advance-warning window scaling with gear level via
  `sonarLookaheadSeconds` (`rules.js`). See the Gear upgrades table and the
  paragraph right after it in Business Rules, and Client-side Behavior's
  "Sonar callout" note, for the finished mechanism.
* Whether the leaderboard needs any abuse moderation beyond rate limiting
  (e.g. a profanity filter on `player_name`) if it turns out to attract spam
  once live.
* The streak multiplier's spawn-weight bias and Golden Bait's spawn-weight
  bias both push toward higher-value fish and stack multiplicatively at max
  level — worth a playtesting pass to confirm low-tier fish don't become
  effectively extinct at depth for a fully-geared player, rather than
  assuming the combination is automatically fine.
* `diver.svg` (the earlier diver-character art) is superseded by the
  boat/rod/fisherman, which are drawn via canvas primitives — an
  intentional, permanent choice, not a placeholder gap (unlike fish/hazard
  sprites, which do render their real SVGs — see Client-side Behavior's
  "Sprite image rendering"). Whether `diver.svg` is deleted, kept unused, or
  repurposed (e.g. a "caught!" splash animation) is left open rather than
  decided as part of this revision.
* Seaweed obstacle walls (Business Rules) don't get a Sonar Range HUD
  callout the way point-hazards do — that gear's lookahead logic reads
  `hazardBandFor`/`hazardSpawnIntervalSeconds`, which the depth-triggered
  wall spawn deliberately doesn't go through (see Business Rules). A wall
  arriving with zero warning may feel unfair at depth once gaps have
  narrowed toward their 95px floor; extending Sonar Range to also preview
  walls, or giving walls their own distinct warning affordance, is left
  open rather than bundled into this pass.
* The seaweed wall's spawn cadence (first at 80mi, then every 120mi) and
  gap-width curve (170px down to a 95px floor) are illustrative/tunable
  like the original hazard-band numbers were before their own
  playtesting pass — worth the same kind of real-play validation before
  calling them final, particularly whether a 95px gap (against a boat
  clamped to a 16px-margin steering range) is actually comfortable to
  thread at normal steering speed, not just mathematically non-zero.

---

## Definition of Done

* [x] User flow works end-to-end, including hit-based round-over,
      depth-cap round-over and leaderboard submit (`e2e/fishing-game.spec.js`).
      The abandoned-round rule (no partial award on nav-away) has no test.
* [ ] All states in the UI table are implemented.
* [x] ~~"Fishing Game" appears in the Home dropdown and mobile nav panel~~ —
      superseded: the Home dropdown was later removed (see History); the game
      itself remains fully reachable at `/fishing-game` directly, just not
      linked from the header.
* [x] Migration written and includes a working `Down`
      (`migrations/002_create_fishing_scores.sql` drops the index and table).
* [x] Handler/service/repository boundaries followed for the leaderboard
      routes (`internal/handler/fishing_game.go` → `internal/service/fishing_service.go`
      → `internal/repository/fishing_repository.go`).
* [x] `player_name` is rendered through `html/template` auto-escaping, with a
      passing XSS-regression test (`TestFishingGameHandler_Leaderboard_Populated`).
* [x] `POST /fishing-game/score` is rate-limited
      (`TestFishingGameHandler_SubmitScore_RateLimited`) and covered by
      `middleware.CrossOriginProtection` (`TestCrossOriginProtection`,
      `TestHandlerChain_RejectsCrossSiteWrites` — the latter exercises
      `/logout`, not this route specifically).
* [x] No inline `<script>` tags; CSP-clean on load (e2e "no console errors
      on load, including no CSP violations").
* [x] `fishing-game.js` cleans up its `requestAnimationFrame` loop and
      listeners on HTMX nav-away (`teardown` on `htmx:beforeSwap` of
      `#main-content`; exercised by the e2e HTMX-revisit test).
* [ ] Accessibility checked for all non-canvas UI (keyboard, focus, contrast,
      semantic HTML); the one deliberate `prefers-reduced-motion` gap
      (gameplay canvas) is documented, not accidental.
* [ ] Tests cover the behavior in the Testing Plan above — see its
      "Not covered" list.
* [ ] No open questions remain unresolved (or remaining ones are explicitly
      accepted as implementation-time tuning, not design gaps).

---

## History

### Status notes added after first ship (kept verbatim)

**Later change**: the header nav was redesigned to a flat Home/Projects/About
link row (`docs/features/home.md`'s Status note, `internal/handler/nav.go`'s
`primaryNavItems`), which dropped the Home dropdown this game's "Fishing
Game" entry lived in. The game itself is unaffected — still fully working at
`/fishing-game` — but it's no longer linked from the header at all, desktop
or mobile; the "Home dropdown"/"Home ▾" references below predate that change.
It's since been re-linked from elsewhere, though: `/projects` now leads with
a card that links straight into the game via a "Play now" button
(`docs/features/projects.md`'s `Project.External` field), so it isn't
reachable only by typing the URL directly.

**Later change**: seaweed obstacle walls — a depth-triggered gap the player
must steer through, distinct from the continuous dodge-a-hazard rotation —
were added on top of the original hazard system (Business Rules "Seaweed
obstacle walls"). Unit-tested (`rules.js`'s `seaweedGapWidth`) and manually
verified end-to-end in a real session (wall spawns at the documented depth,
renders with a navigable gap, and a strand collision costs a life exactly
like any other hazard) — nothing about the original hazard rotation or its
own tests changed.

**Later change**: a real bug, first reported against Puzzle Solver
(`docs/features/puzzle-solver.md`'s own "Later change" note has the full
writeup) but confirmed to affect this game identically — `fishing-game.js`'s
DOM wiring (`bootstrap()`) only ran from a plain top-level call, and a
`<script type="module">`'s top-level code executes at most once per
resolved URL for the page's whole lifetime (per spec). htmx recreates and
re-inserts the `<script>` tag on every HTMX navigation, but the browser
does not re-execute an already-evaluated module — so a second visit to
`/fishing-game` in the same browser tab (navigate away, then back) left the
freshly swapped-in canvas/start screen completely unwired. It was invisible
here (unlike Puzzle Solver, where it was obvious) because the start screen
is static HTML that still renders correctly even when totally inert — only
clicking "Start Dive" revealed nothing happened. Fixed by also re-running
`bootstrap()` from a persistent `htmx:afterSwap` listener on
`document.body`. Covered by a new regression test in
`e2e/fishing-game.spec.js` ("revisiting via HTMX after navigating away")
that drives the exact real-world path (`/projects` → Play now → back →
Play now again) and asserts genuine interactivity (the depth HUD advancing
after Start Dive), not just that the canvas is present. Verified against a
real Postgres instance — the full spec's leaderboard/round-over/shop tests
all still pass.
