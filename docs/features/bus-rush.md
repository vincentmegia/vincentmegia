# Feature: Bus Rush

## Status

`Shipped` — implemented and verified against a real Postgres: Go unit +
DB-gated e2e tests, `node --test` rules tests, and `e2e/bus-rush.spec.js`
(Chromium + WebKit). Tuning numbers remain illustrative. No `/projects`
screenshot yet (placeholder tile).

## Summary

A top-down canvas driving game at `/bus-rush`: the player has stolen a bus
and flees the police across four lanes of oncoming traffic, collecting
fares and dodging cars, vans and trucks while police cruisers chase from
behind. Fares earn tokens, which are spent between runs in a
depot shop on upgrades — chiefly a faster engine. A public Postgres
leaderboard shows the best runs.

## Problem / Motivation

Another "personal interests" mini-game alongside the Fishing Game, Kitchen
Shift and Library Shift, and a playful companion to the Bus Stop Finder. It
reuses the Fishing Game's proven loop (run → tokens → shop → stronger run)
and its leaderboard stack, so it adds a new game without new infrastructure.

## Scope

**In scope:**

* Canvas game: four lanes, the bus near the bottom, traffic coming down the
  screen toward it. Left/right changes lane; up/down accelerates/brakes.
* Speed is the core trade-off: driving faster covers more distance (score)
  but traffic arrives faster. The Engine upgrade raises top speed.
* Fares (coins) spawn in lanes; collecting one adds to the run's fares.
* Lives: a collision with a car or van costs one life, drops the bus to
  minimum speed, and grants a short invulnerability window. The run ends at
  zero lives.
* Trucks (from 800 m) and semi trucks (from 1500 m) are lethal: touching
  one ends the run instantly, regardless of lives left or grace.
* **Police pursuit** (the bus is stolen): cruisers close in from behind
  whenever they're faster than the bus and re-aim at its lane after a short
  reaction delay. Police are **lethal**: any contact with a cruiser,
  pursuer or roadblock, ends the run as "Busted!", lives and grace
  notwithstanding. A cruiser that touches oncoming
  traffic wrecks, which earns bonus score and tokens, so baiting them into
  traffic is a strategy. Further in, some traffic rows are **roadblocks**
  (rows of oncoming cruisers, still passable). A 1–5 star **wanted level**
  scales pursuit speed, cruiser count, reaction time, roadblock chance and
  wreck bonus.
* **Levels** (districts in one continuous run): every 800 m
  (`LEVEL_DISTANCE`) the bus escapes into the next of five districts —
  CBD → Heartland → Expressway → Industrial → Changi (the last is
  endless). Each has its own scenery (office rooftops, rain trees and bus
  shelters, guardrails and yellow edge lines, shipping containers and
  hazard kerbs, a pink-blooming tree avenue), crossfaded on entry with a
  "LEVEL n / district" banner and a checkpoint bonus (250 × district
  index). Each district starts the wanted level one star higher; every
  10 fares adds another.
* Depot shop between runs (tokens → leveled upgrades): Engine (top speed),
  Steering (faster lane changes), Bumpers (+1 life), Fare Box (more tokens
  per fare).
* Progress (tokens, upgrade levels, bests) in `localStorage`, same as the
  Fishing Game — there are no visitor accounts.
* Public leaderboard (Postgres), submitted voluntarily with a display name.
* A `/projects` card ("Play now", HTMX nav).
* Touch controls: on-screen ◀ ▲ ▼ ▶ buttons, plus tapping the canvas's left
  or right half to change lane.

**Out of scope:**

* Server-authoritative gameplay or anti-cheat — same reasoning as the
  Fishing Game's Scope: coarse server-side bounds only.
* Header nav link (projects card only, matching the other games).
* Real-Singapore bus routes/data — this is an arcade game, not tied to the
  Bus Stop Finder's LTA data.

---

## User Flow

```text
1. Visitor opens /bus-rush (or "Play now" on /projects).
2. Start screen shows tokens, best score, best distance; "Start Run" / "Depot Shop".
3. Run: traffic and fares scroll down; the player switches lanes and manages speed.
4. Each hit costs a life; at zero lives the Run Over screen shows distance,
   fares, score and tokens earned, with an optional leaderboard submit.
5. "Depot Shop" spends tokens on upgrades; "Drive Again" starts a new run.
```

---

## UI

```text
web/templates/
├── pages/bus-rush.html                (canvas, HUD, start/run-over overlays)
└── components/
    ├── bus-rush-shop.html             (upgrade shop overlay)
    └── bus-rush-leaderboard.html      (leaderboard fragment)
web/static/js/
├── bus-rush.js                        (canvas loop, input, localStorage, DOM wiring)
└── busrush/rules.js (+ rules.test.js) (pure game rules, `node --test`)
```

**Art style**: flat top-down vector art in the site's warm Organic
palette, lit from the top-left. The static roadside (grass verge, paved
footpath, striped kerbs, trees, street lamps, bus shelters with yellow
zigzag bays, asphalt grain/cracks/manholes, lane paint) is painted once
into a seeded offscreen tile (`buildScenery`) that scrolls seamlessly, so
per-frame cost stays small. Vehicles are drawn live with body shading,
glass, wheels, mirrors and lights; about 15% of cars are taxis. Trucks and
semis carry red/white rear chevrons and side tape to show they're lethal.
Coins spin, the bus's brake lights come on when braking, fare pickups
throw sparks and a "+$", and hits shake the screen and scatter debris. The
canvas is backed at `devicePixelRatio` (capped at 2) so it stays sharp on
high-DPI screens.

| State             | Behavior |
| ----------------- | -------- |
| Default           | Start screen over an idle road. |
| Loading           | Leaderboard shows "Loading leaderboard…" until its `load` request returns. |
| Empty             | Leaderboard: "No scores yet — be the first!" |
| Error             | Leaderboard: "Couldn't load the leaderboard."; the game still works. Storage unavailable: start screen notes progress won't be saved. |
| Success           | Submitting a score swaps in the refreshed leaderboard and disables the submit button. |

---

## HTMX Interactions

| Trigger                | Method | Endpoint               | Target                   | Swap        | Indicator |
| ---------------------- | ------ | ---------------------- | ------------------------ | ----------- | --------- |
| Page load              | GET    | `/bus-rush/leaderboard` | `#bus-rush-leaderboard` | `outerHTML` | `#bus-rush-leaderboard-loading` |
| Run Over "Submit"      | POST   | `/bus-rush/score`       | `#bus-rush-leaderboard` | `outerHTML` | `#bus-rush-leaderboard-loading` |

"Reset Progress" in the shop is destructive and asks `confirm()` first
(client-side only; it clears `localStorage`, never server data).

---

## Routes / Handlers

| Method | Path                    | Handler                    | Auth required | Notes |
| ------ | ----------------------- | -------------------------- | ------------- | ----- |
| GET    | `/bus-rush`             | `BusRushHandler.Index`       | no | Page shell; no DB read. |
| GET    | `/bus-rush/leaderboard` | `BusRushHandler.Leaderboard` | no | Top 20 fragment. |
| POST   | `/bus-rush/score`       | `BusRushHandler.SubmitScore` | no | Form-encoded `player_name`, `score`, `distance_meters`; rate-limited 5/min per client. |

---

## Data Model

`migrations/008_create_bus_rush_scores.sql`

| Table             | Column          | Type        | Constraints | Notes |
| ----------------- | --------------- | ----------- | ----------- | ----- |
| `bus_rush_scores` | `id`            | BIGINT identity | PK | |
|                   | `player_name`   | TEXT        | 1–20 chars | trimmed server-side |
|                   | `score`         | INT         | 0–999999   | |
|                   | `distance_meters` | INT       | 0–999999   | |
|                   | `created_at`    | TIMESTAMPTZ | default now() | |

Index on `score DESC` for the top-N query.

---

## Business Rules / Validation

All numbers live in `web/static/js/busrush/rules.js` and are tunable; the
*shape* is what's fixed:

* **Speed**: between a floor (`MIN_SPEED`) and `maxSpeed(engineLevel)`.
  Holding up accelerates, down brakes, neither holds speed. A hit resets
  speed to the floor.
* **Traffic**: vehicles move down the screen at the bus's speed minus their
  own (slower) speed, so they always close in, faster when the bus is faster.
  Spawns come in rows; a row never blocks all four lanes
  (`pickBlockedLanes`), so every row is passable. The spawn gap shrinks with
  distance down to a minimum (`spawnGapMeters`).
* **Collisions** (`livesAfterHit`): a vehicle marked `lethal` in
  `VEHICLES` (truck, semi) or `POLICE_CAR` takes every life, even during
  post-hit grace; anything else takes one life, or none while grace is
  active. Bumpers therefore never save you from a truck or the police.
* **Row spacing floor** must fit the longest vehicle (the semi), the bus,
  and one unupgraded lane change at top speed — a unit test enforces this,
  so adding a longer vehicle means raising `ROW_SPACING_MIN`.
* **Score** = `floor(distance) + fares × 25 + bonus` — speed pays via
  distance; the bonus is each wrecked cruiser's `policeWreckPoints(stars)`
  (50 × stars) plus each district's `checkpointPoints`.
* **Wanted** = `min(5, district + 1 + floor(fares / 10))`.
* **Tokens per run** = `fares × fareValue(fareBoxLevel) + floor(distance / 100) + wrecks × WRECK_TOKENS`.
* **Police** (`wantedLevel`, `policeSpeed`, `maxPolice`,
  `policeReactionSeconds`, `roadblockChance` in `rules.js`): one star is
  outrun by an unupgraded bus at full throttle; five stars only with
  Engine upgrades. Pursuers never overtake the bus (alongside at most), and
  are "lost" once far enough behind. Roadblocks move at traffic speed and
  use `pickBlockedLanes`, so they keep the every-row-is-passable guarantee.
* **Upgrades**: cost grows per level (`upgradeCost`); every upgrade has a
  max level and the buy button disables at max or when tokens are short.
* **Leaderboard bounds** (server, mirrored by CHECK constraints): name
  trimmed and 1–20 runes; score and distance 0–999999.

---

## Security Considerations

* **Authz**: public, like the other game leaderboards.
* **Destructive actions**: Reset Progress confirms first; local only.
* **Input handling**: server validates bounds before insert; names are
  rendered via `html/template` escaping. Per-client in-memory rate limiter
  (`scoreSubmitLimiter`, shared with the other games). Same CSRF gap as the
  other score routes (no CSRF infra yet — see `PagesHandler.Logout`).
* **Secrets**: none.

---

## Testing Plan

* [x] `rules.test.js`: speed bounds, lane-blocking never blocks all lanes,
      spawn gap shrinks and floors, score/token formulas, upgrade costs/max.
* [x] Go: validation bounds, service rejects invalid input before the repo,
      handler empty/populated/escaped leaderboard, 400 on bad input, 429 on
      flood, error fragment on DB failure.
* [x] `cmd/server/e2e_test.go`: real round-trip through `bus_rush_scores`.
* [x] Playwright `e2e/bus-rush.spec.js`: start a run (HUD distance
      advances), shop purchase persists, run-over → leaderboard submit,
      HTMX revisit still wires the game; plus the `/projects` card; a
      police ram is instantly "Busted!" (`__busRushTestHooks.policeRam`);
      crossing 800 m enters level 2 (`__busRushTestHooks.warp`).

---

## Definition of Done

* [x] User flow works end-to-end.
* [x] All UI states implemented.
* [x] Reset Progress confirms.
* [x] Migration with working Down.
* [x] Handler/service/repository boundaries followed.
* [x] Keyboard and touch playable; overlays are focusable buttons.
* [x] Tests in the Testing Plan pass.
