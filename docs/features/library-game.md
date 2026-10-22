# Feature: Library Shift

## Status

`Shipped`. The game runs at `/library-game` and has a card on the
`/projects` grid (`web/static/images/library/screenshot.png`). There is no
score anti-cheat; see Security Considerations.

Tests:

* Go: `internal/handler/library_game_test.go`,
  `internal/service/library_service_test.go`,
  `internal/service/library_validation_test.go`, plus the DB-gated subtest
  "library shift routes round-trip through the real library_scores table"
  in `cmd/server/e2e_test.go`. Run them with `go test ./...`; the e2e
  subtest needs `DATABASE_URL`.
* JS unit tests: `web/static/js/library/*.test.js`, run with `node --test`.
  They cover the pure logic modules (`rules.js`, `engine-state.js`,
  `floor-plan.js`, `first-person.js`, `stories.js`, `book-titles.js`,
  `walk-styles.js`, `minjun-actions.js`) and smoke-test the renderers
  (`minjun.js`, `jiho.js`, `director-seo.js`, the six staff renderers and
  `staff-kit.js` in `staff.test.js`, `patron.js`, its props and trinkets and
  `karen.js` in `patron.test.js`, `library-people.js`,
  `anime-furniture.js`).
* Playwright: `e2e/library-game.spec.js`, run with `make test-e2e` on
  Chromium and WebKit. It drives the game through
  `window.__libraryGameTestHooks` (exact coordinates, clock control,
  `makeKarenAvailableNow`, etc.) so it doesn't have to wait out the
  600/480/360-second shift clocks. See the spec's header comment. Some
  tests can be flaky under heavy load: the staff-help tests click NPCs
  that are moving, and the Coffee Pour tests depend on how long a
  wall-clock hold lasts.

The version-by-version changelog (v1.1 to v2.21 and the character passes)
is in **History** at the end of this doc.

## Summary

`/library-game` is a canvas mini-game in the same family as Kitchen Shift
and Hospital Shift. The player is Eun-mi, a librarian, and plays a
30-shift month in a two-floor library. Each shift she shelves returned
books, collects fines, fulfils borrow requests, recommends books to
patrons who ask, and keeps her Sanity and the library's Mood up. She earns **Gard** (the site's in-game currency),
which is paid out at the Director's office at closing. A disruptive patron
("Karen") shows up once a month. A seeded Daily Challenge offers one
shared shift per UTC day. Postgres stores only the public leaderboard.

## Problem / Motivation

The user asked for a library-themed game that reuses this site's game
conventions: a shift structure, Gard, a Karen beat and expressive
characters. Its own core loop is book-shelving skill checks and fine
handling, in place of Kitchen Shift's cooking and serving.

## Scope

**In scope:**

* `GET /library-game`, a canvas game with click-to-move (Enter walks to
  the station under the cursor). It also has a First Person camera
  (`#library-camera-button`), which uses billboard sprites and its own
  turn/move/interact controls (`library/first-person.js`).
* A 30-shift month in three 10-shift tiers. The clock gets shorter and
  volumes grow with each tier. Progress is saved to `localStorage`.
* Two floors on one canvas, switched with the Stairs, the Elevator or the
  HUD floor button, in any phase including `closing-wait`.
  * 1st Floor: Boss's Office, Return Cart, Front Desk, Fines Counter (a
    small room), Coffee Machine, and 3 genre bookcases.
  * 2nd Floor: 2 genre bookcases and the Reading Nook.
  * Positions are in `buildStations` (`library/floor-plan.js`). Genres are
    `GENRES` in `rules.js`: Mystery, Romance, Sci-Fi, Kids, Reference.
* Minigames, all drawn on the canvas:
  * **Shelf Skill-Check**: a timing bar for a normal book.
  * **Coin Hunt**: find the hidden coins and bills in a marked book.
  * **Fines Sort**: find the coins and Gard bills among clutter at the
    Fines Counter.
  * **Count the Till**: tap the denominations to make the exact fine
    amount at the Front Desk.
  * **Find the Book**: pick the requested book from decoys on its shelf.
  * **Ask the Librarian** (책 추천): a patron hints at what they like to
    read; pick the one of three covers that fits them.
  * **Checkout Skill-Check**: the same timing bar, at the Front Desk.
  * **Coffee Pour**: hold to pour and release in the target band.
  * **Reading Nook**: a page-turning short story.
  * **Karen's event**: a two-button confirm.
* Helpful staff, patron queues with wait timers, a star rating, Library
  Mood, player Sanity, hallucinations at low Sanity, penalties at 0 Mood,
  shelving incentives, and a Gard counter. See Business Rules.
* Director Seo's office cutscene at clock-out, then the paycheck.
* A Daily Challenge, which has its own leaderboard tab.
* A Postgres leaderboard (`library_scores`) with all-time and daily
  boards.

**Out of scope:**

* Gear/shop upgrades or leveling.
* Touch-specific controls beyond tap-to-move and the on-screen First
  Person buttons.
* Image or sprite assets. Everything is drawn with canvas primitives.
* A manual "Reset progress" button. The owner decided against it. The
  only way to restart a month is **Start New Month**, which appears on the
  shift-30 Final Paycheck.
* Server-side per-player state and score anti-cheat (see Security
  Considerations).

---

## User Flow

```text
1. Player opens /library-game (Projects grid "Play now", an HTMX nav).
2. Start screen: "Start Shift" continues the saved month at its current
   shift. The Daily Challenge card plays today's seeded shift instead.
3. During the shift:
   - Returned books pile up on the Return Cart. Click a book or the cart to
     carry one, then walk to the bookcase for its genre. That starts the
     Shelf Skill-Check, or Coin Hunt for a marked book. The wrong bookcase
     does nothing.
   - Borrow patrons queue at the Front Desk. Accept one, find the book on
     its shelf (Find the Book), then return to the desk for the Checkout
     Skill-Check.
   - Fine patrons queue at the Fines Counter, starting from a shift rolled
     between 5 and 8. Collect a payment there (Fines Sort). Eun-mi then
     carries it (carriedFine) to the Front Desk and counts it into the till
     (Count the Till). An exact count banks it.
   - Some Front Desk patrons want a recommendation (a "?" speech bubble
     and a 추천? chip). Walking up opens Ask the Librarian: they hint at
     their taste in their own words, and Eun-mi picks one of three covers
     (click, or 1–3). A match tips Gard and lifts Mood; a miss dips Mood a
     little. Either way they leave; left waiting, they walk out.
   - Coffee Machine: Coffee Pour restores Sanity. Reading Nook (2nd
     Floor): a story restores Mood.
   - Staff can be clicked for help (see Business Rules).
   - On Karen's shift she joins the Front Desk line. Walking up to her
     starts her event, with 12 s to choose "collect the fine" or "let it
     slide". Security can escort her out before that.
4. At 11:00 PM in-game, a 20-second closing wait starts. After it, the
   Boss's Office opens. Entering plays Director Seo's cutscene, then the
   paycheck screen (base, bonuses, penalties, rating).
5. Next shift, and so on to shift 30. The shift-30 Final Paycheck offers a
   leaderboard submission and "Start New Month".
   A Daily Challenge paycheck is the score itself. It can be submitted to
   the daily board, retried, or dismissed with Back to Start.
```

---

## Visual Direction

* The game uses Hospital Shift's anime style (v2.21). The UI kit (tiles,
  gauges, chips, backdrops, windows, speech bubbles, `DISPLAY_FONT` =
  Caprasimo) comes from `hospital/anime-ui.js`. Stairs, elevator and decor
  come from `hospital/anime-furniture.js`.
* Library fixtures (bookcases, Front Desk, Return Cart, Fines room, Boss
  door, Reading Nook) are drawn by the library's own
  `library/anime-furniture.js`.
* Characters:
  * Eun-mi is `hospital/kimono-himura.js` with `look: 'coral'`.
  * Patrons are the library's own 66 modern-Seoul designs in
    `library/library-people.js` (`PATRON_PERSONALITY_KEYS`; Hospital's
    festival/kimono patients are no longer in the mix). With Eun-mi,
    Director Seo, Min-jun, Ji-ho, the six staff and Karen that makes 77
    characters, Hospital Shift's count (65 patients, 11 staff, Himura).
    `library/patron.js` draws them in the staff's detailed style from that
    data: age proportions (kids get a bigger head), walking legs, fifteen
    outfit kinds (hoodie, cardigan, blazer, apron, jacket, dress, tee,
    track, suit, blouse, gakuran, puffer, trench, overalls, hanbok) with
    their own seams and trims, and a head from `patron-head.js` (ten hair
    styles including a side braid, curls and bald; eye styles; blinking
    offset per patron; glasses, masks, beards; thirteen kinds of headwear).
    Each carries a prop from `patron-props.js` / `patron-props-more.js`
    (46 in all: a light stick, a scooter, a guitar case on the back, a dog
    on a leash, a cat peeking out of a tote, …), held raised, hugged, or
    hanging, and
    wears their own `trinkets` from `patron-trinkets.js` (pins, name tags,
    a lanyard, necklaces, a scarf, patches, a wallet chain, watches,
    bracelets, rings, socks, a knee plaster, earbuds, hairpins). Outfits
    also get fold shadows, elbow creases and stitched hems.
  * Karen has her own renderer, `library/karen.js`: a red power blazer,
    phone up filming; angry (in line and in her scripted event) she scowls,
    shouts and jabs a finger.
  * The six wandering staff each have their own detailed renderer, built
    on shared pieces in `library/staff-kit.js` (legs with a walk cycle,
    sleeves, hands, face, eyes) and picked by `STAFF_RENDERERS` in
    `library-game.js`:
    * Security (`security.js`): peaked cap, radio he lifts to speak into
      every ~7 s, duty belt, polished boots.
    * Volunteer (`volunteer.js`): low side ponytail with a ribbon, wispy
      bangs, thin gold glasses, teal volunteer vest over a cable knit, a
      tray of two steaming coffees.
    * Janitor (`janitor.js`): kind eyes, grey moustache, bandana, towel,
      utility vest, rubber gloves and boots, a mop whose head swishes on
      the floor, a spray bottle.
    * Shelver (`shelver.js`): high bun with a pencil, cat-eye glasses on
      a beaded chain, a stack of labelled returns.
    * Storyteller (`storyteller.js`): beret, apron with crayons, a tiger
      hand puppet whose jaw moves as she talks, an open picture book.
    * Archivist (`archivist.js`): half-moon readers, archive coat, white
      gloves, a cane that taps as he walks, a leather ledger.
  * Kang Min-jun is drawn by `library/minjun.js`, with his idle actions in
    `minjun-actions.js`.
  * Han Ji-ho is drawn by `library/jiho.js`.
  * Director Seo is drawn by `library/director-seo.js`.
  * Walk styles are in `library/walk-styles.js`: a whole-body rhythm
    (bob, tilt, lean, twirl). Each staff renderer swings its legs at the
    same rate, and `drawAmbient` passes the walker's own phase-shifted
    time to both so they stay in step.
* Book titles are bilingual (`library/book-titles.js`). Reading Nook
  stories come from `library/stories.js`.
* A changed Hospital module also changes this game.
* The page uses Hospital's anime page kit, re-tinted by `.library-anime`
  in `app.css`.
* There is a decorative wall clock on the 1st Floor (`drawWallClock`). The
  HUD's `#library-hud-clock` is the clock that actually counts.

---

## UI

```text
web/templates/pages/
└── library-game.html          # {{define "library-game-content"}}; header
                                # comment maps every #library-* element
web/templates/components/
└── library-leaderboard.html   # leaderboard fragment with All-time/Daily tabs
web/static/js/
├── library-game.js            # canvas wiring, overlays, save, test hooks
└── library/                   # pure logic + library-only renderers
```

| State    | Behavior |
| -------- | -------- |
| Default  | Start screen (month progress + Daily card) → floor gameplay. |
| Loading  | HTMX nav uses `#nav-loading`; leaderboard requests use `#leaderboard-loading`. |
| Empty    | Leaderboard with zero rows shows an empty-state message. |
| Error    | Leaderboard fetch/insert failure renders an inline error in the fragment. |
| Success  | Score submission re-renders the fragment with the new row (daily submits return the daily board). |

---

## HTMX Interactions

| Trigger                       | Method | Endpoint                                | Target                 | Swap        | Indicator |
| ----------------------------- | ------ | --------------------------------------- | ---------------------- | ----------- | --------- |
| Projects "Play now" card      | GET    | `/library-game`                         | `#main-content`        | `outerHTML` | `#nav-loading` |
| Leaderboard initial load (`hx-trigger="load"`) | GET | `/library-game/leaderboard` | `#library-leaderboard` (`this`) | `outerHTML` | `#leaderboard-loading` |
| "All-time" tab                | GET    | `/library-game/leaderboard`             | `#library-leaderboard` | `outerHTML` | `#leaderboard-loading` |
| "Daily Challenge" tab         | GET    | `/library-game/leaderboard?board=daily` | `#library-leaderboard` | `outerHTML` | `#leaderboard-loading` |
| Final Paycheck / daily submit | POST   | `/library-game/score`                   | `#library-leaderboard` | `outerHTML` | `#leaderboard-loading` |

The tabs live inside the fragment (`data-board="all"|"daily"`,
`aria-pressed`), so the server marks which one is active.

No destructive actions. "Start New Month" only appears after shift 30, so
it needs no confirmation.

---

## Routes / Handlers

| Method | Path                        | Handler                          | Auth required | Notes |
| ------ | --------------------------- | -------------------------------- | ------------- | ----- |
| GET    | `/library-game`             | `LibraryGameHandler.Index`       | no            | Sets `ContentTemplate: "library-game-content"`; no DB call. |
| GET    | `/library-game/leaderboard` | `LibraryGameHandler.Leaderboard` | no            | Bare fragment; `?board=daily` for today's (UTC) Daily Challenge. |
| POST   | `/library-game/score`       | `LibraryGameHandler.SubmitScore` | no            | Form `player_name`, `total_earnings`, `shifts_completed`, optional `daily_date` (YYYY-MM-DD, today ± 1 day UTC, `ValidateLibraryDailyDate`; a daily run must be 1 shift). Rate-limited per IP. No run ticket. |

Registered in `cmd/server/main.go`'s `newMux`. Service and repository:
`internal/service/library_service.go`,
`internal/repository/library_repository.go`.

---

## Data Model

`migrations/007_create_library_scores.sql`,
`migrations/013_add_library_daily_date.sql` and
`migrations/015_raise_library_cooking_earnings_caps.sql`. All have a
working `Down`.

| Table          | Column           | Type        | Constraints                              | Notes |
| -------------- | ---------------- | ----------- | ---------------------------------------- | ----- |
| library_scores | id               | BIGINT      | GENERATED ALWAYS AS IDENTITY PRIMARY KEY | |
| library_scores | player_name      | TEXT        | NOT NULL, length 1–20                    | |
| library_scores | total_earnings   | INT         | NOT NULL, range 0–200000                 | Gard total for the run (or the one daily shift). Raised from 100,000 by migration 015; see the ceiling below. |
| library_scores | shifts_completed | INT         | NOT NULL, range 1–30                     | Same range as `cooking_scores` (widened to 1–30 by its migration 004). |
| library_scores | created_at       | TIMESTAMPTZ | NOT NULL DEFAULT now()                   | |
| library_scores | daily_date       | DATE        | nullable                                 | Daily Challenge UTC day; NULL for a month run. Partial index `idx_library_scores_daily (daily_date, total_earnings DESC) WHERE daily_date IS NOT NULL`. The all-time board ranks only NULL rows. |

Also `idx_library_scores_earnings (total_earnings DESC)`.

**Earnings ceiling (200,000, `libraryScoreEarningsMax`).** From `rules.js`
over a 30-shift month (tiers of 10 shifts):

| Source | Per month | Strong month | Theoretical max |
| ------ | --------- | ------------ | --------------- |
| Base paycheck (`SHIFT_PAYCHECK_FULL`) | 30 × 4,000 | 120,000 | 120,000 |
| Shelving tip (`SHELVED_BOOK_TIP_GARD` 5) | 10 × (6 + 10 + 16) = 320 returns | 1,600 | 1,600 |
| Coin Hunt (4 × 25 per Coin Hunt book) | 1 in 5 of 320 returns | 6,400 | 32,000 (every book) |
| Fines (20–80 each) | 174 (fines start on shift 5) | 8,700 | 13,920 |
| Re-shelving books read in the Nook | one per ~60 s cooldown and read | — | 1,200 |
| Karen's fine | once | 60 | 60 |
| Perfect pours (10 each) | one per ~150 s of Sanity drain | 960 | — |
| Recommendations (`RECOMMEND_TIP_GARD` 30) | 10 × (2 + 3 + 4) = 90 requests | 2,000 | 2,700 |
| **Total** | | **~139,700** | **~171,500** |

The rating multiplier never goes above 100%. The cap leaves ~43%
headroom over a strong month and ~17% over every bonus at its maximum.
Coffee Pour has no cooldown, so a month spent only refilling coffee could
in principle go higher. That isn't a real way to play (patrons walk out
and the rating drops), and the cap remains a sanity bound, not
anti-cheat.

Everything else is client-side in `localStorage`:

* `library-game:v1`: `{version, monthToDateGard, currentShift,
  bestRunTotal, karenSeed}`.
* `library-game:daily-best`: this browser's best daily paycheck for the
  current date.

In-shift state is not saved. Reloading in the middle of a shift restarts
that shift.

---

## Business Rules / Validation

Tuning constants live in `web/static/js/library/rules.js`, grouped into
numbered sections. Shift state transitions live in `engine-state.js`.
Look values up there rather than relying on this doc.

* **Tiers and clock**: shifts 1–10, 11–20 and 21–30. Each tier sets:
  * Real-time clock: `ROUND_TIER_CLOCK_SECONDS`, 600/480/360 s. This is
    much slower than Kitchen Shift, as the user asked.
  * Volumes: `ROUND_TIER_RETURN_VOLUME`, `ROUND_TIER_FINE_VOLUME`,
    `ROUND_TIER_BORROW_VOLUME` and `ROUND_TIER_RECOMMEND_VOLUME`.
  * In-game time runs from 8:00 AM to 11:00 PM (`inGameTimeLabel`).
* **Month seed**: `karenSeed` is stored once per month and re-rolled by
  Start New Month. Two values come from it:
  * Karen's shift: `karenShiftForSeed`, 10–15.
  * The shift fines start on: `finesStartShiftForSeed`, 5–8, an
    independent stream. Before that shift `fineVolumeForShift` returns 0.
* **Shelving**:
  * Carrying a book to the wrong genre's bookcase does nothing
    (`arriveAtShelf`), so a wrong shelf never counts as a mistake.
  * `COIN_HUNT_FREQUENCY` (0.2) of books are Coin Hunt books, each with
    `COIN_HUNT_ITEMS_PER_BOOK` items worth `COIN_HUNT_ITEM_VALUE_GARD`.
  * Every shelved book tips `SHELVED_BOOK_TIP_GARD` (5).
  * More than `MESSY_CART_THRESHOLD` (8) books on the cart drains Mood.
  * Books still unshelved at closing cost `UNSHELVED_BOOK_PENALTY_GARD`
    (10) each.
* **Fines** (since v2.4):
  * Fine patrons queue at the **Fines Counter** (`finesQueue`). Arriving
    there opens Fines Sort for the first patron (`arriveAtFinesCounter`).
  * Finding every real coin and bill makes the payment `carriedFine`
    (`resolveFinesSort`). Decoys do nothing when clicked. In the game
    Fines Sort has no fail path. The engine's failure branch (mistake,
    patron back to the front) exists but nothing calls it.
  * Walking to the **Front Desk** with `carriedFine` opens Count the Till
    (`arriveAtFrontDeskWithFine`), using `TILL_DENOMINATIONS` [1, 5, 10,
    20].
  * An exact count banks the amount into `bonusGard`. Going over counts as
    a mistake, resets the count and keeps the till open for a retry
    (`resolveTillCount`).
  * Eun-mi can't collect another fine while carrying one.
  * Fines are Gard only, 20–80 (`fineAmountForRoll`).
* **Borrowing**:
  * After a request is accepted, its search patience is
    `borrowPatienceSeconds` (60 s down to 30 s) times
    `patienceMultiplierForLibraryMood`, fixed at arrival.
  * Clicking a wrong book in Find the Book only shows a toast.
  * If patience runs out while searching, the request is dropped and
    counts as a mistake and a walk-out.
  * A failed Checkout Skill-Check is a mistake, and the player can retry
    straight away.
* **Queues and star rating**:
  * Every queued patron has a wait timer (`queueWaitSecondsForShift`, 90 s
    falling to 45 s, scaled by Mood at arrival).
  * When it runs out the patron walks out, costing
    `RATING_PENALTY_PER_WALKOUT` (1.5★). A walk-out is not a mistake.
  * The rating starts at 5★ and scales the whole payout (`rating ÷ 5`).
* **Karen** has three outcomes (`karen.outcome`):
  * `collectFine` banks `KAREN_FINE_AMOUNT_GARD` (60) with no cost.
  * `letItSlide`, also the result when her 12 s
    `KAREN_EVENT_TIMER_SECONDS` runs out, counts a mistake, −50 Mood
    (`KAREN_MOOD_PENALTY`) and the standard Sanity hit.
  * `escorted`: Security walked her out of the line before her event
    started (`staffHelp('guard')`). No fine, no mistake, no Mood hit.
* **Staff help** (`STAFF_HELP` in `rules.js` §20, `staffHelp` and
  `staffHelpBlocker` in `engine-state.js`): click a staff member to walk
  over and ask. Each helps only when there's something to do, then goes on
  cooldown.

  | Staff | Floor | Help | Cooldown |
  | ----- | ----- | ---- | -------- |
  | Security (`guard`) | 1st | Escorts Karen out while she's waiting in line | none (once) |
  | Shelver (`libShelver`) | 1st | Shelves the oldest Return Cart book (usual tip, no Coin Hunt coins) | 45 s |
  | Janitor (`libJanitor`) | 1st | +15 Mood | 60 s |
  | Han Ji-ho (`jiho`) | 1st | Collects the first fine in line (skips Fines Sort) → `carriedFine`, still counted at the till | 60 s |
  | Volunteer (`volunteer`) | 2nd | +30 Sanity | 60 s |
  | Archivist (`libArchivist`) | 2nd | Finds the requested book (skips Find the Book) | 60 s |
  | Storyteller (`libStoryteller`) | 2nd | +15 s to every waiting patron's timer and the searcher's patience | 75 s |
  | Kang Min-jun (`minjun`) | 2nd | Shelves the book Eun-mi is carrying (`minjunShelveCarriedBook`) | 60 s (`MINJUN_HELP_COOLDOWN_SECONDS`) |

  Staff help is not available in First Person Mode, where a canvas click
  is the interact action.
* **Library Mood** (0–100):
  * Starts each shift at 100.
  * −25 per mistake. Also drained by Karen and a messy cart.
  * Raised by the Reading Nook (+20, `READING_MOOD_RESTORE`, then a 45 s
    cooldown) and the Janitor.
  * Scales patron patience at arrival. Drives the HUD status text.
  * **At 0 Mood**:
    * Pay is cut 2% per 10 s, capped at 30% (`moodPayMultiplier`).
    * Every 20 s a patron storms out (−1.5★).
    * Every 30 s a complaint letter takes 25 Gard off the payout.
* **Sanity** (0–100, the player's own):
  * Drains passively (`SANITY_DRAIN_PER_SECOND`) and by 15 per mistake.
  * Low Sanity slows walking (`walkSpeedMultiplierForSanity`).
  * **Coffee Pour** (`gradeCoffeePour`) has no cooldown. The target band
    sits at 62–86% full.
    * Perfect: back to full Sanity plus a 10 Gard tip.
    * Good: +70.
    * Sloppy: +40.
    * Spilled (reaching the brim): −50 Sanity, with stains for 6 s.
  * Reading a book Eun-mi took off a shelf herself adds +10 Sanity
    (`READING_CHOSEN_SANITY_RESTORE`). The book then goes onto the Return
    Cart.
  * **Below 25 Sanity**, hallucinations start (`hallucinationIntensity`):
    * Scare visuals.
    * Shaky hands: the skill-check zone shrinks to as little as 50% and
      the sweep runs up to 1.6× faster.
    * Carried books can slip back onto the cart.
    * Ghost patrons appear in line. Walking up to one costs −5 Sanity.
    * Each 10 s at 0 Sanity cuts pay by 2%, capped at 30%.
* **Payout** (`enterBossOffice`):
  `max(0, shiftPaycheck(mistakes) + bonusGard − complaints×25 −
  unshelved×10) × rating/5 × hallucinationPayMultiplier ×
  moodPayMultiplier`.
  * `shiftPaycheck` is 4000 − 500 per mistake, with a floor of 500.
  * `bonusGard` covers Coin Hunt finds, fines, Karen's fine, coffee tips,
    shelving tips and recommendation tips.
* **Ask the Librarian** (`rules.js`, end of file; `engine-state.js`'s
  `addRecommendRequest` / `startRecommendation` / `resolveRecommendation`):
  * 2/3/4 requests per shift by tier (`ROUND_TIER_RECOMMEND_VOLUME`),
    arriving after the first tenth of the shift. The Daily Challenge uses
    shift 12's count (`dailyVolumes(...).recommends`).
  * The patron is drawn first: their design's `taste`
    (`library-people.js`, one of `GENRES`) is the right answer. The hint
    line (`recommendHint`, from `RECOMMEND_HINTS`) never names the genre.
    `recommendChoices` offers the taste plus two other genres in a
    seeded order, so every daily run gets the same choices.
  * A match: +`RECOMMEND_TIP_GARD` (30) to `bonusGard`,
    +`RECOMMEND_MOOD_BOOST` (10) Mood. A miss: −`RECOMMEND_MISS_MOOD` (5)
    Mood. Neither is a mistake. `recommendsMatched` / `recommendsMissed`
    count them, and the paycheck shows "N/M recommendations loved".
  * They queue with the same mood-scaled wait timer as borrowers
    (`queueWaitSecondsForShift`); a walkout costs stars like any other.
    The Storyteller's story time and zero-Mood storm-outs include them.
* **Closing wait**: at 11:00 PM the game enters `closing-wait` for
  `CLOSING_WAIT_SECONDS` (20 s). The Boss's Office is locked until then.
  Arriving early explains the wait, and the player is let in
  automatically once it ends.
* **Daily Challenge** (`rules.js` §19):
  * One shift per UTC day (`libraryDailyDate`), played as shift 12
    (`DAILY_SHIFT_NUMBER`).
  * Fines are always on.
  * Every arrival comes from a stream seeded by the date (`dailySeed`), so
    everyone gets the same shift.
  * One of `DAILY_TWISTS` applies each day: more returns, borrows or
    fines, no coffee, a Karen day, or Min-jun's day off.
  * The paycheck is the score, submitted with `daily_date`.
  * A daily run doesn't change the month save.

---

## Security Considerations

* **Authz**: every route is unauthenticated, the same as the other games.
  `POST /library-game/score` is rate-limited per IP by its own
  `scoreSubmitLimiter` (`libraryScoreSubmitLimit`/`libraryScoreSubmitWindow`
  in `library_game.go`).
* **Input handling**: the name, earnings, shifts and daily date are checked
  against the DB CHECK bounds before insert
  (`internal/service/library_validation.go`).
  `validatePlayerName` (`player_name.go`) rejects invalid UTF-8 and Cc/Cf
  characters.
* **No anti-cheat**: unlike Hospital Shift, this game has no run tickets,
  minimum-time check or per-shift cap. Any total within range is accepted.
  This is a known gap; see Open Questions.
* No secrets or config.

---

## Testing Plan

* [x] Go handler tests: index, empty and populated leaderboard, valid
      submit, validation rejection, out-of-range earnings, rate limit and
      daily board (`internal/handler/library_game_test.go`).
* [x] Go service and validation tests (`library_service_test.go`,
      `TestLibraryService_DailyChallenge`, `TestValidateLibraryScoreSubmission`).
* [x] Real-Postgres round trip (`cmd/server/e2e_test.go`, "library shift
      routes round-trip through the real library_scores table").
* [x] JS unit tests:
      * Tier math, `karenShiftForSeed`, `finesStartShiftForSeed`, payout,
        coffee grading and daily seeding (`rules.test.js`).
      * The fines flow ("Fines flow (Fines Counter -> Front Desk till)"),
        all three Karen outcomes including the timeout and Security's
        escort, staff help, and Ji-ho ("Han Ji-ho collecting a fine") in
        `engine-state.test.js`.
      * Floor geometry (`floor-plan.test.js`) and the First Person maths
        (`first-person.test.js`).
* [x] Playwright (`e2e/library-game.spec.js`):
      * Start screen; floor switching, including during closing-wait.
      * Shelving, including the wrong shelf, the cart click and Coin Hunt.
      * Borrowing.
      * Fines: banked; a miscount followed by a keyboard recount; fines
        starting on a shift rolled 5–8.
      * Coffee Pour: mouse, keyboard and spill.
      * Karen: collect, let it slide, and Security walking her out.
      * Closing-wait lock, Director Seo's cutscene and the Boss's Office
        wait.
      * Gard counter, hallucinations, zero Mood, shelving incentives, star
        rating and the Reading Nook (both kinds).
      * Daily Challenge (four tests) and the shift-30 submission round trip.
      * First Person Mode.
      * An HTMX revisit, and no console or CSP errors.
      * Ask the Librarian: a matching pick by clicking its cover (tip,
        Mood, the overlay closing itself) and a wrong pick by keyboard
        (Mood dip, no mistake), via `spawnRecommendNow` and
        `getRecommendCardRects`.
      * Staff help: Min-jun (shelving and empty-handed), the Shelver, the
        Volunteer, Ji-ho, the Janitor, the Storyteller and the Archivist
        (during a borrow).
      * Determinism under CPU load: `startShift` holds back scheduled
        arrivals (`pauseScheduledEvents`), `askStaff` freezes the wandering
        staff before clicking one (`freezeStaff`), and Coffee Pour sets the
        fill and releases with the simulation frozen (`freeze`/`step`;
        input handlers still run).

---

## Open Questions

* Score anti-cheat (run tickets like Hospital Shift's) is not built.
* Tuning magnitudes in `rules.js` are still illustrative.
* The Fines Sort failure branch in `engine-state.js` is never used by the
  game. Either give Fines Sort a fail path or drop the branch.

---

## Definition of Done

* [x] The user flow works end to end. Covered by `e2e/library-game.spec.js`
      as listed above.
* [x] All states in the UI table are implemented
      (`library-leaderboard.html` covers empty and error;
      `TestLibraryGameHandler_Leaderboard_Empty`).
* [x] Migrations 007, 013 and 015 are written, each with a working `Down`.
* [x] Handler/service/repository boundaries are followed.
* [x] Accessibility:
      * Enter walks to the hovered station (`onKeyDown` in
        `library-game.js`).
      * The skill checks, Count the Till, Coffee Pour, the Reading Nook
        and the cutscene accept Space/Enter.
      * Coin Hunt, Fines Sort and Find the Book need a pointer.
* [x] Tests cover the Testing Plan (except the unticked item).
* [x] `/library-game` is on the Projects grid with a real screenshot.
* [ ] No open questions remain. See Open Questions.

---

## History

The changelog and the original v1 plan, moved here verbatim from the top of this
doc. Version notes describe the game as it was at each step; where they
disagree with the sections above, the sections above (and the code) win.

### Original Shipped status note (v1)

`Shipped` — implemented and covered by tests. Go: handler tests
(`internal/handler/library_game_test.go`), service/validation tests
(`internal/service/library_service_test.go`/`library_validation_test.go`),
and a real-Postgres end-to-end subtest in `cmd/server/e2e_test.go`
("library shift routes round-trip through the real library_scores table").
JS: `web/static/js/library/{rules,engine-state,floor-plan}.js` are pure,
DOM-free logic modules covered by `node --test` (109 game-logic tests plus
`floor-plan.test.js`'s own suite); `web/static/js/library-game.js` wires
them to the canvas (click-to-move, the two-floor Stairs/Elevator/HUD-button
switch, the big personality-parameterized characters, all five minigame
overlays, Karen's scripted event, the Sanity/Mood bars, fullscreen,
`localStorage` persistence). `e2e/library-game.spec.js` drives the full
click-to-play loop end to end (17 tests, passing on both Chromium and
WebKit) using `window.__libraryGameTestHooks` to get exact coordinates/
timing rather than waiting out this game's deliberately slow real-time
shift clocks or guessing at randomly-scattered item positions — see that
file's own header comment. `/library-game` is on the `/projects` grid with
a real screenshot (`web/static/images/library/screenshot.png`). Manually
verified in a real browser: a full click-driven shift (shelving, a Coin
Hunt book, a fine, a borrow request, the Coffee Machine, Karen, closing-wait,
payout) and dark mode, both with zero console errors. Recipe/volume/
skill-check magnitudes remain illustrative/tunable, as called out throughout
this doc — nothing in that tuning blocks calling this Shipped.

**v1.1 character body redesign** — the user tried the shipped game and
reported not liking the character shape; they confirmed they wanted an
"articulated humanoid" (a visible neck/shoulders and distinct arms, not a
chibi/rounder direction) when asked to pick a direction. The root cause
of the original blob look: `drawLibraryPerson`'s arm rectangles sat
*underneath* the torso rectangle's x-range (only a ~1px sliver poking out
past the torso's rounded corners), and the head circle's bottom edge
overlapped directly into the torso's top edge with no gap — so arms were
functionally invisible and there was no neck. Fixed by narrowing the
torso so the arms sit fully outside its width (touching its edge, not
hidden behind it) and inserting a small skin-tone neck rectangle between
the head and the torso. Re-verified via a cropped Playwright screenshot
at native pixel size: both arms and a clear neck are now visible on the
player and every patron/personality template (they all share this one
draw function). The `/projects` grid screenshot
(`web/static/images/library/screenshot.png`) was recaptured with the new
shape. No logic changed — `node --test`/`go test ./...` unaffected (450/450
JS, Go green).

**v1.2 distinct skin tones per personality** — the user pointed out every
personality template's `headColor` was nearly the same light tan
(`#e3c2a0`/`#f0d9c0`/`#f6dcb8`/`#f0cba0`), so patrons didn't actually read
as having different skin tones despite the personality system's distinct
faces/hair/outfits. Spread across a genuinely distinct range instead —
Grumpy Regular `#c68642` (medium-tan), Shy Student `#ffdbac` (light),
Cheerful Kid `#8d5524` (deep brown, hair darkened to `#2a1a10` to pair
naturally with it), Karen `#e0ac69` (medium) — re-verified via a cropped
screenshot of all three regular patrons side by side. Projects-grid
screenshot recaptured again. `node --test`/`go test ./...` unaffected
(450/450 JS, Go green) — cosmetic-only change.

**v1.3 First Person Mode** — built per the Scope addition above (the
user's explicit "seeing in first person and seeing anything but
yourself"): a new `web/static/js/library/first-person.js` pure module
(angle/distance projection math — `projectEntity`/`projectScene`/
`screenXForAngleOffset`/`scaleForDistance`/`groundScreenY`/
`findInteractTarget`, plus turning/moving helpers — fully unit-tested,
`first-person.test.js`) driving a billboard-sprite camera in
`library-game.js`: a floor/horizon gradient, every visible station/patron
on the current floor projected by angle-and-distance from the player
(FOV-culled, back-to-front painter's-algorithm sort) and drawn with the
exact same `drawLibraryPerson`/station-drawing primitives Top-Down mode
uses, just at a computed screen position/scale instead of a world
position — no separate sprite art needed. A new `#library-camera-button`
toggles instantly between modes with no loss of position/floor; a new
`#library-fp-controls` cluster (turn left/right, move forward/back,
interact) plus arrow-key equivalents drive movement, since click-to-move
doesn't apply without a visible top-down floor; the interact
action/prompt calls the exact same station-arrival logic the Top-Down
click path already uses, not a duplicate. All five minigame overlays,
the Sanity/Mood bars, and the HUD clock are unchanged and confirmed
working identically in both camera modes.

**Two real bugs found during verification** (the implementing agent's
own manual-verification pass stalled/timed out before completing, so
these were caught in a follow-up verification pass instead):

1. **Stale compiled CSS made the on-screen Interact button unclickable.**
   `web/templates/pages/library-game.html`'s new `#library-fp-controls`
   bar uses `bottom-2` (among other new Tailwind classes), but
   `web/static/css/output.css` hadn't been rebuilt since those classes
   were added to the template, so the compiled stylesheet had no
   `.bottom-2` rule at all. With no `bottom` value, the browser fell back
   to the element's normal-flow static position — rendering the entire
   control bar directly below the canvas, outside
   `#library-canvas-wrapper`'s `overflow: hidden` box, where every button
   was geometrically present but visually/interactively unreachable
   (Playwright's actionability check reported the wrapper `<div>` itself
   intercepting every click). Fixed by rebuilding CSS
   (`npm run build:css`) — a build-step gap, not a logic bug, but a real
   regression a manual click-through would have caught immediately.
2. **Entering 2nd Floor left the player facing exactly backward.**
   `floor-plan.js`'s `FLOOR_1_ENTRY_POINT`/`FLOOR_2_ENTRY_POINT` are both
   defined as exactly the canvas center (`{x: 480, y: 300}` on the
   960x600 canvas), and `defaultFacingTowardCenter` computes "face toward
   the center" via `angleTo` from the player's own position — which, at
   an entry point, already IS the center. That's a zero-distance
   `Math.atan2(0, -0)` call, which JavaScript defines as returning `PI`
   (not `0`), so every arrival at either floor's entry point silently
   faced the player exactly backward instead of at the intended default.
   Fixed by having `defaultFacingTowardCenter` special-case near-zero
   distance and return `0` directly. Covered by a new regression test
   (`first-person.test.js`'s "a player already exactly at the center
   faces 0 (north), not PI").

Re-verified after both fixes: `node --test web/static/js/library/*.test.js`
(175/175, including the new regression test), full `npm run test:unit`
(498/498), `go build`/`go vet`/`go test ./...` clean, and
`e2e/library-game.spec.js`'s full 23-test suite green on both Chromium and
WebKit, including every First Person test (camera toggle, sprite
visibility, turn/move controls, Coffee Machine interaction via the Enter
key, and the Stairs floor-switch/facing-reset test that exercised bug #2
directly). Manually screenshotted First Person Mode via Playwright to
confirm it reads as a genuine first-person view (floor/horizon split,
centered crosshair, distance-scaled patron/station billboards, no player
avatar, control buttons along the bottom) rather than a re-skinned
top-down camera.

**v1.4 book titles on the front cover** — the user reported "the mini
games have problems... i dunno what book it is" for the Coin Hunt/Return
Cart/borrow-request flows (Find the Book already showed titles on its
candidate books; the others never rendered a title anywhere).
`spawnBook` now assigns each Return Cart book a `title` (via the existing
`titleForGenre` pool, already used for borrow requests) — a plain field
on the object `addBookToCart`/`pickUpBook` (engine-state.js) already pass
through untouched, so no pure-logic-layer change was needed to carry it
to `carriedBook`. Rendered in three places: the Return Cart's own book
covers, the Coin Hunt overlay's header (`Coin Hunt — "<title>" — find
every coin and bill`), and the front-desk borrow slot (a label chip below
the patron, same treatment as the fine amount chip).

**Two real overflow bugs caught during visual review** (not caught by
the automated suite, since it drives every minigame via exact coordinates
from `getOverlay()`/`getReturnCartSlots()` rather than actually reading
rendered text — a gap worth knowing about for any future purely-cosmetic
text change):

1. A title text wider than a Return Cart book's ~22px-wide cover bled
   directly into the neighboring book 30px away, since nothing clipped
   the draw — two adjacent books' titles visually merged into one
   unreadable smear. Fixed by widening each cover (22x30 → 26x32) and the
   cart's per-slot spacing (30px → 34px) *and*, more importantly, clipping
   the title draw to the book's own cover rect (`ctx.clip()`) so any
   remaining overflow is cropped cleanly rather than spilling outward
   regardless of title length.
2. Front-desk slots sit only 46px apart; `drawLabelChip` auto-sizes to
   its text's full width with no wrapping or truncation, so a full title
   like "Complete Grammar Guide" rendered a chip wider than the slot
   spacing itself, overlapping the neighboring slot's own chip. Fixed
   with a new `truncateForChip` helper (measures against the real font,
   appends "…" only if needed) capping the borrow slot's title chip to a
   safe width.

Re-verified via cropped Playwright screenshots at native scale: three
Return Cart books with different long titles show fully distinct,
non-overlapping cover text; a front-desk fine chip ("45g") and an
adjacent borrow-title chip ("The Sil…") render side by side with no
overlap; the Coin Hunt header fits a full title on one line inside its
box. `node --test web/static/js/library/*.test.js` (175/175, unaffected —
this is a pure-rendering change) and `e2e/library-game.spec.js`'s full
23-test suite (both Chromium and WebKit) still green, confirming the
widened Return Cart spacing didn't break click hit-testing on any book.

**v1.5 the neck still read as disconnected in real play** — the user
reported, with a screenshot from an actual play session, that a
character's "body is not great its seperated from the body its looking
disfigured" — the head visibly floating above the shoulders with a gap
of bare background between them. v1.1's neck (`drawLibraryPerson`) was
sized to just exactly bridge the head circle's bottom edge and the
torso's top edge (touching, not overlapping) — this session's own
Playwright screenshots of that geometry (both at native canvas
resolution and at the front-desk's smaller 0.62 scale) rendered it as
connected, so the exact-edges approach wasn't reproduced as broken here,
but the user's own screenshot from a real browser session is the ground
truth. Rather than chase a rendering-environment difference further, the
neck was made unconditionally robust: it now overlaps 2px *into* both the
head circle and the torso rect (grown from 6×4 to 10×8, at `y-26*s` to
`y-18*s` instead of exactly `y-24*s` to `y-20*s`) so there is no shared
edge for any renderer's sub-pixel handling to expose a seam on. Re-verified
via the same native-resolution screenshot technique as v1.1 — the neck now
reads as a solid, unambiguous column between head and shoulders. `node
--test web/static/js/library/*.test.js` (175/175) and
`e2e/library-game.spec.js` (23/23, both Chromium and WebKit) unaffected —
pure-rendering change, no logic touched.

**v2.0 art pass (characters, stations, floor)** — the user compared the
game against Kitchen Shift: "the art style isnt great like the kitchen the
body shapes just feel ugly the coffee machine isnt well done like the
kitchen." Three changes, all rendering-only in `library-game.js`:

1. `drawLibraryPerson` now follows Kitchen Shift's `drawPixelPerson`
   proportions (a wide rounded torso the head sits directly on, short arms
   peeking ~3 units past it with hands, short legs with shoes, a ground
   shadow) instead of v1.1's narrow torso/stick-limb/neck build. The
   separate neck from v1.1/v1.5 is gone entirely: the torso tucks under the
   head circle, so there is no seam for the floating-head issue to recur
   on. Each personality template also gained `hairStyle`/`outfit`/`glasses`/
   `shoeColor`, so they differ in silhouette, not just palette: Grumpy
   Regular (receding hair, glasses, cardigan), Shy Student/the player
   (bangs, collar, backpack strap), Cheerful Kid (pigtails, overalls),
   Karen (blonde asymmetric bob, blazer, pearls).
2. Every station kind except the bare box now has a detail drawer
   (`STATION_DETAIL_DRAWERS`, plus `drawStairsDetail`/`drawElevatorDetail`),
   the same pattern as Kitchen Shift's `draw*Detail` functions. Bookshelves
   are filled with deterministic per-shelf book spines in the genre's
   colors. The coffee machine has a bean hopper, display, brewing bay, cup
   and steam. The front desk has a monitor, bell, book stack and plant. The
   return cart has trays, books and wheels. The fines counter has a
   register and coin stacks. The boss's office is a paneled door, with the
   lock drawn as a badge over it while locked. The stairs show an up/down
   badge, and the elevator shows its target floor. Drawn in each station's
   local space, so First Person billboards pick it up unchanged.
3. The graph-paper grid floor became staggered wooden planks with a soft
   vignette (replaced by Hospital Shift's anime tiles in v2.21).

Verified with Playwright screenshots of the full floor and of all four
personalities at both player scale and the front desk's 0.62 scale.
`node --test web/static/js/library/*.test.js` and
`e2e/library-game.spec.js` (46/46, Chromium + WebKit) pass. The
`/projects` screenshot was recaptured.

**v2.1 titles on every book** — the user: "add the title names on each
books." Three places, sharing new `fitTitleLines`/`drawCoverTitle` helpers
that wrap a title by word, shrink its font until it fits, and pick cream or
dark ink by cover brightness:

1. Return Cart covers grew from 26x32 to 30x40 (the 34px slot pitch still
   leaves a 4px gap) and show the **full** title, replacing v1.4's
   first-four-words-then-crop that cut titles off mid-word ("he Las…").
   Click hit-testing moved from an 18px radius to the cover rect
   (`returnCartCoverRect`), so the whole taller cover is clickable.
2. Find the Book overlay covers use the same fitted full-title rendering.
3. Bookshelf spines show titles from that genre's `TITLE_POOLS`, rotated up
   the spine. Shelves now have two rows of taller, wider spines instead of
   three short ones. A whole title can't be legible on a ~30px spine, so
   each spine shows one of the title's main words (row 1 the longest, row 2
   the next-longest), so the two rows don't repeat each other.

The front desk's tiny borrow-request book icon is unchanged; its title is
still the truncated chip below the patron. Verified via Playwright
screenshots with spawned cart books/patrons; `node --test` (175/175) and
`e2e/library-game.spec.js` (46/46) pass. The Find the Book overlay was not
screenshotted.

**v2.2 Coffee Pour minigame** — the user: "i want to add a little
minigame when brewing coffee." Asked to choose, they picked hold-to-pour
(over a barista button sequence or latte-art tracing) with graded,
never-zero rewards; see Business Rules' Sanity/Coffee Machine for the
numbers. Logic lives in the DOM-free modules like every other minigame:
`rules.js` section 11 (`coffeePourTargetBand`, `gradeCoffeePour`, the
`COFFEE_*` constants) and `engine-state.js`'s `brewCoffee`, which replaces
`restoreSanity`. `library-game.js` adds the `coffee-pour` overlay. It is
this game's only *held* input: canvas `pointerdown` / window
`pointerup`/`pointercancel`, plus Space/Enter keydown/keyup (key repeat
ignored). Only a release that follows a press grades the pour, so in First
Person the keyup of the same Enter press that opened the overlay can't end
it at 0%. The result banner shows for 1.2 s, then the overlay closes.
New test hook: `setCoffeePourFill`. Tests: `node --test` 180/180 (new
rules and `brewCoffee` cases replace the `restoreSanity` ones);
`e2e/library-game.spec.js` 50/50 on Chromium and WebKit. The e2e cases
cover a mouse pour, a keyboard pour, an automatic spill, and First Person
via Enter. Manually played in a real browser with zero console errors.

**v2.3 Mood actually affects patience** — the user asked "what does mood
do". The answer was: nothing but the bar and HUD status text. Despite the
state comment "scales patron patience", `patienceMultiplierForLibraryMood`
existed in `rules.js` with its own tests but was never called. Now wired
into `engine-state.js`'s `addBorrowRequest`; see Business Rules' Library
Mood. New unit test for it (181/181); `e2e/library-game.spec.js` 50/50.

**v2.4 fines reversed + Count the Till minigame + late start** — the
user: fine patrons pay at the fines register and the player carries the
Gard to the Front Desk; fines start "around shift 5-8"; "add a minigame".
Fine patrons now queue under the Fines Counter (`finesCounterSlots`),
not the Front Desk. Arriving there runs Fines Sort for the first in line
(`arriveAtFinesCounter`; a failure is a mistake and the patron steps back
to the front of the queue). Success hands the player the payment
(`carriedFine`). Arriving at the Front Desk with it opens the new **Count
the Till** minigame (`arriveAtFrontDeskWithFine`/`resolveTillCount`): tap
1/5/10/20 Gard coins/bills (or keys 1-4, Undo/Backspace) to reach the
fine exactly. Going over is a miscount: a mistake, the count resets, and
the till stays open. An exact count banks it into `bonusGard`.
`acceptFine` was removed. Fines start on a per-month shift rolled in 5–8
(`finesStartShiftForSeed`, from the same month seed as Karen's roll but
an independent stream); `fineVolumeForShift(shift, start)` is 0 before
it. Patron queues moved 14px lower (`QUEUE_SLOT_OFFSET_Y`) so heads,
stars and book icons no longer cover station labels. New hooks:
`getFinesCounterSlots`, `getFinesStartShift`, `getTillButtonRects`.
`node --test` 186/186, `e2e/library-game.spec.js` 52/52.

**v2.5 borrow requests were unfindable** — the user: "when i try to get
the book the costermer borrowed i couldnt." Three causes. (1) Find the
Book never showed which title was wanted; the only hint was a truncated
desk chip. (2) Its 5 decoys each rolled a title independently from a
5-title genre pool, so a decoy could carry the requested title itself,
and clicking it said "Not the one…". (3) Visiting a wrong shelf was
silent. Fixes: `TITLE_POOLS` grew to 8 titles per genre; decoys draw
shuffled distinct titles that exclude the requested one; the overlay
shows "Looking for: “…”" with books kept below that line. The accept
toast names the book and its shelf (noting "upstairs" for 2nd-floor
genres), and a wrong shelf while searching says where it actually is.
Also: v2.4's fines test rewrite had accidentally deleted the `borrowing`
e2e test (it sat between the replaced sections), so v2.4's "52/52" was
missing it. It is restored, with regression assertions for unique
titles and the toast. `e2e/library-game.spec.js` 54/54,
`node --test` 186/186.

**v2.6 queued patrons are clickable anywhere on their body** — the user:
"how do i take the book from the costermer?????". A queued patron's slot
(x, y) is their feet, and the hit test was a 26px radius around that
point, so clicks on the head/torso missed and were treated as a floor
click. Now `isPointOnQueuedPatron` tests the whole drawn body (±22px, head
top to below the shoes) for both the Front Desk and Fines Counter
queues. The canvas also shows a pointer cursor over anything clickable.
Verified by clicking a patron's face in a real browser; 54/54 e2e,
186/186 unit.

**v2.7 borrow patrons no longer give up mid-search** — the user: "when i
get the book the costermer dissapears and i didnt get the book." The
search-phase patience (40 s, floor 18 s, times the Mood multiplier, so
as low as ~11 s) kept ticking *inside* the Find the Book minigame.
Running out closed it with "They gave up waiting…". The patron also
vanished from the desk on accept, with no visible timer. Fixes: `tick`
takes `{ pauseBorrowPatience }`, and the game passes true while Find the
Book is open. `BORROW_PATIENCE_BASE_SECONDS`/`MIN` were raised to 60/30.
The active patron stays at the desk as a `borrow-active` slot with a
green→amber→red patience bar ("Waiting", then "Check out!"). The player
shows a carried-book badge once the book is found. Unit 187/187 (new
pause test); e2e 54/54, with the borrow test now also asserting the
patron stays and patience pauses.

**v2.8 busier shifts** — the user: "when doe sthe costermers come??? i
cant see them." Shifts 1–10 had only 2 borrow patrons at random times
across a 10-minute shift, and no fines before shift 5–8. Raised
`ROUND_TIER_BORROW_VOLUME` to [5, 8, 12] and `ROUND_TIER_FINE_VOLUME` to
[4, 6, 9] (fines still gated by `finesStartShiftForSeed`). The first
borrow patron of every shift now arrives 5–20 s in
(`FIRST_BORROW_ARRIVAL_SECONDS`, applied in `scheduleShiftEvents`).

**v2.9 star rating** — the user: "add a rating bar when a costermer is
left waiting too long you lose 1 and half stars". Asked to choose, they
picked: everyone in line has a timer, the rating scales the paycheck,
and Mood is kept. See Business Rules' Star rating. `rules.js` section 13
(`RATING_*`, `clampRating`, `paycheckMultiplierForRating`,
`queueWaitSecondsForShift`). `engine-state.js`: `rating`/`walkouts`
state; `waitSeconds` on `addFineToQueue`/`addBorrowRequest` (omitted =
no timer, so older callers/tests are unaffected); `tick` walks out
expired queue entries; `enterBossOffice` scales the payout. Patience
bars now sit under name chips (above heads they covered the station
labels), and the "+N waiting" chips moved down to match. Unit 195/195;
e2e 56/56 (new star-rating test).

**v2.10 Reading Nook** — the user: "add on a reading a book system to
increase your mood". Asked to choose, they picked: a new Reading Nook
station, a page-turn minigame, and +20 Mood with a 45 s cooldown. See
Business Rules' Reading Nook. `floor-plan.js` adds the station;
`rules.js` section 14 holds the `READING_*` constants; `engine-state.js`
adds `readingCooldownSeconds` (ticked down in `tick`), `canReadBook`
and `finishReading`. `library-game.js` adds `drawReadingNookDetail`
(armchair, lamp, rug, open book), the `reading` overlay, and the
`finishReadingPageNow` test hook. Unit 200/200, e2e 58/58 (new Reading Nook test).

**v2.11 real stories in the Reading Nook** — the user: "add real words
and let me read". The faux text lines became five original short stories
(`web/static/js/library/stories.js`, 12 pages each, ≤260 chars/page),
drawn word-wrapped in 17px Georgia in a wider book (two 290px pages).
The per-spread timer is now a 2.5 s anti-skip minimum (was 1.4 s of auto
"reading"), and ←/→ page back and forward. New `stories.test.js`
enforces page count and length.

**v2.12 more character designs + the player is Coral James** (renamed
**Eun-mi** later, "make corals name eun-mi": her name tag reads
"Eun-mi · 은미", like Min-jun's, and the start screen says "You're
Eun-mi (은미)"; the renderer key is still `look: 'coral'`) — the
user: "make the characters have different designs" and "i want the
player's name to be coral james". Six new `PERSONALITY_TEMPLATES`, each
with its own hairstyle, outfit and accessory rather than a recolor:
Teen (spiky hair, hoodie, headphones), Grandma (grey bun, shawl,
glasses), Businessman (side part, suit and tie), Artist (long hair,
beret, dress), Bearded Guy (beanie, flannel, beard) and Curly (curly
hair, striped tee). With the original three that gives 9 patron designs
(`PATRON_PERSONALITY_KEYS`). Patrons now get a design hashed from their
id (`personalityForId`), replacing the 3-design cycle by queue position,
so each patron keeps one look. The player uses a new `librarian`
template (hair bun, glasses, sweater vest, lanyard badge) instead of
sharing Shy Student's, and draws a "Coral James" name chip
(`PLAYER_NAME`). The start screen's stale "Coming soon" copy now
introduces Coral. New template fields: `accentColor`, `accessory`,
`hatColor`. Rendering-only; unit 203/203, e2e 58/58.

**v2.13 Boss's Office during the closing wait** — the user: "when i want
to get into the bosses office i cannot." During the 20 s closing wait
the office *looked* unlocked (padlock hidden, plain label), but arriving
before the wait ended did nothing and showed no message. Standing there
until it ended didn't help either; you had to walk away and back. Now
the padlock and a "Boss's Office (Ns)" countdown label stay up through
the wait. Arriving mid-wait toasts "wait here Ns" and sets
`waitingAtBossOffice`; the loop lets the player in automatically the
moment the wait ends, as long as they're still at the door
(`isPlayerAtBossOffice`). Arriving mid-shift now says how long the
shift has left. New e2e test; unit 203/203, e2e 60/60.

**v2.14 better coin and Gard bill art** — the user (with a Coin Hunt
screenshot): "i want the designs to be better for the coins and gard."
`drawCoinIcon` (shared by Coin Hunt and Fines Sort) now draws coins as a
gold disc with a raised rim, a radial-gradient face, an inner ring, an
embossed "G" and a shine, and bills as a 38×20 green banknote with an
inner border, a "G" seal and corner "10"s. Both cast a soft shadow, and
bills get a small per-item tilt (seeded by item id). `SCENE_Y` narrowed
from [180, 480] to [205, 445], so scattered items no longer overlap an
overlay's header line or its "N / M found" counter. Unit 203/203,
e2e 60/60.

**v2.15 Gard counter** — the user: "add something where there's [a]
gard keeping track of your gard". Asked to choose, they picked an
on-screen counter. A HUD pill beside the stars shows a mini Gard coin,
this shift's bonus Gard ("+45g shift": tips, fines, Coin Hunt, Karen)
and the month-to-date total from earlier shifts ("Month 320g"). Each
time `bonusGard` rises, a "+N g" pop floats up and fades over 1.4 s
(`trackGardPops`, test hook `getGardPops`). The shift's base pay isn't
shown until the paycheck, since mistakes and the star rating decide it.

**v2.16 hallucinations at low Sanity** — the user: "when sanity drops to
0 I want to have hallucinations to scare the player and the work drops",
then "when sanity drops below 25 make the facial expression change".
Asked to choose, they picked: creeping in below 25 and full at 0; all
four penalties (shaky hands, dropped books, ghost patrons, less pay).
See Business Rules' Hallucinations. `rules.js` section 15;
`skillCheckSuccessZone(scale)`. `engine-state.js`: `zeroSanitySeconds`,
`dropCarriedBook`, `startleFromHallucination`, and the payout
multiplier. Three older payout tests now zero `zeroSanitySeconds` to
isolate the base formula, because fast-forwarding a shift without coffee
spends most of it at 0 Sanity. New hooks: `getHallucinations`,
`spawnGhostPatronNow`. Unit 211/211; e2e 64/64 (new hallucination
test). One run hit a WebKit timeout in the Karen test under parallel
load; it passed 3/3 alone and in a full rerun.

**v2.17 penalties at 0 Mood** — the user asked what happens at 0 Mood
(answer: only indirectly, via shorter patience) and then "yes add
penalty". Asked to choose, they picked all three: a pay cut, storm-outs
and complaint letters. See Business Rules' Library Mood. `rules.js`
section 16; `engine-state.js`: `zeroMoodSeconds`/`moodStormTimer`/
`complaints`, `stormOutLongestWaiting`, and the payout subtracting
complaints then applying `moodPayMultiplier`. Unit 217/217;
e2e 66/66 (new zero-Mood test).

**v2.18 shelving incentives** — the user asked "what happens when I
leave the library books" (answer: nothing; ignoring the cart was even
safer than shelving, since a failed check is a mistake) and then said
"yes" to adding all three suggestions: a shelving tip, a messy-cart Mood
drain and an unshelved-books penalty. See Business Rules' Shelving
incentives. `rules.js` section 17; `engine-state.js` adds the tip in
`resolveShelfSkillCheck`/`resolveCoinHunt`, the drain in `tick`,
`unshelvedAtClose` at the closing transition, and the payout deduction.
Coin Hunt/payout test expectations updated for the tip and the docked
book. The "+N more" cart chip moved down 12px to clear the taller
covers. Unit 220/220, e2e 68/68 (new shelving-incentives test).

**v2.19 spills burn** — the user: "when it spills it spills onto you and
drains 50 of your sanity." `COFFEE_SANITY_RESTORE.spilled` changed from
+40 to −50 (clamped at 0). The pour overlay now shows coffee splashing
out of the mug, the toast says "Ow! Hot coffee all over you — −50
Sanity", and Eun-mi wears steaming coffee stains for 6 s
(`drawCoffeeSplash`). Tests that encoded "every grade restores
something" now cover the spill drain instead. Unit 221/221, e2e 68/68.

**v2.20 shared character renderer** — no behavior change. Kitchen Shift's
v4 art pass (docs/features/cooking-game.md) wanted this game's
characters, so the renderer moved out of `library-game.js` into
`web/static/js/shared/people.js`:
* `drawPerson` with the face, hair, outfit, accessory and stress helpers,
  plus `shadeColor`.
* The generic patron designs, as `PEOPLE_TEMPLATES`.

What stays here:
* `drawLibraryPerson`, a thin wrapper that applies `LIBRARY_PERSON_SCALE`.
* `PERSONALITY_TEMPLATES`, which is now `PEOPLE_TEMPLATES` plus the
  player's `librarian` look.

Unit 221/221 and every `e2e/library-game.spec.js` test pass unchanged on
Chromium + WebKit.

**v2.21 Hospital Shift's anime style** — the user asked for Library Shift
to be "like hospital shift" (its anime look on `main`), Eun-mi in a kimono
"like kimono from hospital shift", and a Korean library. Everything is
drawn with Hospital Shift's own anime kit rather than a copy of it:

* **Characters**: `drawLibraryPerson` now dispatches to Hospital Shift's
  renderers. Eun-mi is drawn by `hospital/kimono-himura.js`'s
  `drawKimonoHimura` with `cap: false, look: 'coral'`, at
  `PLAYER_ART_SCALE` 1.5 (Hospital's 1.12 until "make her bigger in game to
  see the detail"; the coffee stains and the carried book/fine badge scale
  with her via `PLAYER_SIZE_RATIO`) with its walking sway. Then "just make
  all characters like her size": every other character is drawn about as
  tall as she is (~104px, `PERSON_HEIGHT`). Queued Front Desk and Fines
  Counter patrons (0.62 before), Security and the Volunteer (0.8 before)
  all use `LIBRARY_PERSON_SCALE` (1.55, Hospital's PERSON_SCALE), and
  Min-jun went from 1.4× to 1.3× to match. To fit, the queues spread out
  (`SLOT_PITCH` 60, was 46), the click box covers the taller patrons, the
  fine star and wanted-book icons sit above their heads, title chips
  truncate to the wider pitch, "+N waiting" moved down below the English
  title line, and the Front Desk and Fines Counter name chips are drawn
  again on top of the queue (`drawQueueStationLabels`). The Karen event
  screen and First Person billboards keep their own scales.
* **More characters** ("make 19 more newest character and 4 more staff"):
  `web/static/js/library/library-people.js` holds Library Shift's own
  designs, in Hospital's anime-people data format and drawn by its
  `drawAnimePerson`, but kept out of `anime-people.js` so Hospital
  Shift's roster is unchanged. Keys are prefixed `lib`.
  - 19 new patrons (`LIBRARY_PATRON_DESIGNS`), modern Seoul
    library-goers: a K-pop fan (lavender twintails, headphones), a
    neighbourhood auntie (sun hat, handbag), an exam student (red
    hachimaki), a webtoon artist (beanie), a café barista, a baduk
    grandpa, a mint-dress twin, a scooter kid (bike helmet), a pilates
    mom, a professor (beard, tweed suit), an all-nighter (face mask), a
    cat lover (cat ears), a backpacker, a retired teacher (pearls), an
    indie guitarist (blue streaks), a grad student, a florist (flower
    crown), a chess-club kid and a book-club witch (witch hat). They're
    added to `PATRON_PERSONALITY_KEYS`, so Front Desk and Fines Counter
    patrons are hashed across 84 designs (65 + 19); `drawLibraryPerson`
    checks `findLibraryDesign` before Hospital's designs.
  - 4 new staff (`LIBRARY_STAFF_DESIGNS`) in `AMBIENT_STAFF`, set
    dressing like Security and the Volunteer: on the 1st Floor, a Janitor
    · 미화원 (bandana, vest) along the bottom aisle and a Shelver · 정리
    담당 (mint cardigan) between the Front Desk and the Return Cart; on the
    2nd Floor, a Storyteller · 동화 선생님 (pink beret and apron) by the
    reading chairs and an Archivist · 기록관 (lab coat, glasses, mustache)
    left of the Kids Shelf. Their routes keep clear of the furniture and
    the queues.
  - Covered by `library-people.test.js`: the counts, unique keys that
    don't collide with Hospital's, complete designs that all draw, and
    `findLibraryDesign`.
* **Page layout and start screen** ("now redo the layout including starting
  screen"): `library-game.html` now uses Hospital Shift's anime page kit
  (`.hospital-anime` + `ha-*` classes) re-tinted to the library's canvas
  palette by `.library-anime` in `app.css` (mint, coral, sakura, warm
  paper; 📚 and ✿ hero sparkles). A hero banner with a Korean kicker and
  four "how you play" chips; the game frame with a pill HUD (it takes its
  own row on phones) and soft candy buttons; a two-card start screen — the
  month run (Eun-mi, `#library-start-progress` "Shift N of 30 · X Gard
  this month", three tips, Start Shift) and the Daily Challenge card; and a
  numbered How to play panel under the leaderboard. Every element id the
  game and tests bind to is unchanged.
* **Daily Challenge** ("add a daily challenge", modelled on Hospital
  Shift's; `rules.js` §19). The start screen's card shows today's UTC date,
  the twist, its blurb and this browser's best today
  (`library-game:daily-best` in `localStorage`). The challenge plays as
  shift 12 (`DAILY_SHIFT_NUMBER`: its clock and pace, fines always on) with
  every return, fine and borrow request — arrival times, genres, titles,
  Coin Hunt books, fine amounts and the patrons' looks — drawn from one
  stream seeded by the date (`seededRandom(dailySeed(date))`, id counters
  reset), so everyone gets the same shift; minigame layouts stay
  unseeded. Each day rolls one of six twists (`DAILY_TWISTS`,
  `dailyTwistForDate`, volumes via `dailyVolumes`):

  | Twist | Effect |
  | ----- | ------ |
  | Overdue Amnesty | 50% more returns |
  | Exam Week | 50% more borrow requests |
  | Fine Friday | twice as many fines |
  | Coffee Machine Broken | the Coffee Machine is taped off ("OUT OF ORDER") |
  | Karen Day | Karen shows up |
  | Min-jun's Day Off | Min-jun isn't upstairs, so no shelving help |

  The HUD's shift reads "Daily" and a "Daily Challenge · {twist}" chip sits
  at the bottom of the canvas. The paycheck is the score: titled "Daily
  Challenge", the twist leads the outcome line, "Today's best" replaces
  Run total, and the submit form posts `daily_date` with
  `shifts_completed=1`; Try Again replays the same shift and Back to Start
  returns to the start screen. A daily run never touches the month run's
  shift or Gard. Covered by `rules.test.js` (date, seed, twists, volumes),
  Go service/handler tests (daily board, 1-shift rule, stale/malformed
  dates), `cmd/server/e2e_test.go` (a daily row lands on `?board=daily`,
  not all-time) and four Playwright tests (the card and a "Daily" shift;
  the daily paycheck; the same date giving the same returns/borrows; a
  daily submit landing on the daily board). The user first got an
  exact copy of Kimono Himura, then asked for "the character different
  rather than the same". So the `coral` look (`CORAL_PALETTE`) keeps the
  anime style but has its own design: a chestnut jaw-length bob with a
  pink ribbon (no bun or kanzashi), round glasses (her look from the
  original game) and teal-green eyes. Her outfit went through a blue
  furisode first; then the user asked for "the official outfit of
  Koreans", since this is a Korean library. So she wears a **hanbok**
  (`drawHanbok`): a pale-yellow jeogori with slim curved sleeves and red
  kkeutdong cuffs, a purple git collar with the white dongjeong, a long
  red goreum ribbon tied at the chest, a high-waisted rose chima belled
  to the floor with a gold-leaf (geumbak) hem band, and pink kkotsin with
  upturned toes. Her hands are folded in front. A detail pass ("now make
  her detailed", after her rename to Eun-mi) added, all behind
  `LOOK === 'coral'` so Kimono Himura is unchanged: strand lines and
  darker curled-under tips in her bob; small pink pearl drop earrings that
  swing; a beaded gold-and-pink glasses chain looping from her temples to
  her shoulders; fold creases, white dots and a highlight on her bow; a
  dashed gold trim above the jeogori hem; an embroidered pink flower on
  each shoulder; a brass librarian's badge reading "사서 은미" (librarian
  Eun-mi); a norigae (a jade butterfly on a cord with a red knot, gold
  cap and pink tassel) hanging from the goreum; a faint woven flower
  pattern across the chima; embroidered leaves and a gold centre on the
  kkotsin flowers; and pink-painted nails. A second pass ("more
  detailed"), still Eun-mi only: a sprinkle of freckles across her nose
  and cheeks; a hair clip shaped like a blue open book, opposite her bow;
  an inner rim, gold hinge rivets and clear nose pads on her glasses; fine
  running stitches along the git collar; soft elbow creases in both
  sleeves; gold-leaf dots down the goreum tails, with notched swallowtail
  ends; and a small gold flower on the goreum's bow loop. A third pass
  ("make her super super detailed"), still Eun-mi only: fine radial lines
  and a darker ring in her irises, two extra lashes at each outer flick
  and two tiny lower lashes; feathered hairs along her brows; inner-ear
  folds; a rosy tint under her smile; finer fringe strands, crown strands
  and a small flyaway; a faint damask of tiny gold diamonds over the
  jeogori and its sleeves; gold-leaf flowers stamped along the red cuffs;
  the white sokchima underskirt peeking below the hem; the norigae made a
  samjak (three pendants: a coral-bead cluster with a purple tassel and a
  gold flower with a yellow one, either side of the jade butterfly); a
  navy silk jumeoni (lucky pouch) at her side with a gold 福, gathered
  pleats, a red drawstring and a pink tassel; and knuckle lines on her
  hands. A fourth pass ("more DETAILED"), Eun-mi only: soft cel shading
  down her far cheek and jaw; a faint blue tint in her glasses' lenses;
  tiny gold caps on her pearl earrings; a short yellow pencil (pink
  eraser) tucked into her hair above the book clip; a fine gold necklace
  with a tiny pink heart at the base of her neck; fold creases in the
  goreum bow; dashed stitching along the cuffs; three embroidered
  butterflies on the chima and a gold vine scroll above its hem band; an
  engraved border on her badge; and a ring of gold embroidery dots round
  the jumeoni's 福. A fifth pass ("make her MORE MORE DETAILED"), Eun-mi
  only: a soft peach-pink eyeshadow; a thin two-tone braid falling from
  behind her right ear, tied with a pink band (her earring drawn over
  it); three little pearl hairpins below her bow; a pearl in the bow's
  knot and gold beads on its tail tips; gold dots stamped along the
  purple git collar; the white inner lining showing at each cuff's edge;
  alternating lighter and darker pleat panels down the chima; tiny white
  dots between the hem band's gold flowers; and cross lines on the
  norigae's knot. A sixth pass ("detail"), Eun-mi only: soft
  double-eyelid creases; a shadow under her nose tip and a faint
  upper-lip line; the darker underlayer of her bob showing at the nape;
  a tiny gold star charm at each end of the glasses chain (her badge
  moved down a little so the right-hand charm sits just above it rather
  than over the text); a soft silk sheen down the chima and gathered
  tucks where it's pleated into the waistband; folds at each underarm;
  a drop shadow under the badge; a gold cap on the pouch's tassel; and
  finger lines on her left hand. Then a hairpin ("now add a hair pin a
  detailed one"): a tteoljam (떨잠, the Korean "trembling hairpin"), set
  low and tilted on top of her head between the pencil and the bow
  (`drawTteoljam`). An oval gold plate with a gradient, a filigree ring
  of tiny dots and two scrolls, ten pearls round the rim and a jade
  centre with a carved flower and a pink stone. Two enamel flowers (pink,
  and white with a pink centre) and a jade butterfly sit on fine coiled
  gold springs that quiver. Two pearl drops swing on chains below, and
  the long gold pin, with a ball finial, slants back into her hair. A
  first, taller version stood up like a tiara, so it was lowered and the
  springs shortened. Patrons use Hospital's
  anime patient designs (`PATRON_PERSONALITY_KEYS` is now
  `anime-people.js`'s `PATIENT_DESIGN_KEYS`, still hashed from the patron
  id); Karen and the Security guard use `STAFF_DESIGNS`; the 2nd-Floor
  Volunteer is the `bookworm` design. `LIBRARY_PERSON_SCALE` (1.55) now
  only sizes the coffee splash.
* **HUD**: Hospital's anime gauges with heart/smile badges and outlined
  labels for Sanity (mint) and Mood (sky), plated anime stars, and the
  Gard counter on an anime plate with a gold G badge; label chips are
  `animeChip`.
* **Floor and wall**: Hospital's glossy pastel checker tiles (mint on the
  1st Floor, cream on the 2nd, like the ER and Supply Room) with afternoon
  sunbeams and pastel guide stripes; the cream-to-blush back wall with the
  pink rail; a glossy sign button where the ER's EMERGENCY sign is
  ("도서관 · LIBRARY 1F" / "열람실 · READING 2F"); a painted sakura
  branch, a little wall shelf of books, and Hospital's pink bell clock;
  stitched pastel rugs under the Coffee Machine and Reading Nook; and
  decor from `hospital/anime-furniture.js`'s `drawDecor` (plants, a water
  cooler, a library ladder, reading chairs).
* **Stations**: every station is an `animeTile` with plum line art and
  Hospital's pink (hover) / gold (target) glow ring. Library's fixtures
  are drawn by the new `web/static/js/library/anime-furniture.js` in the
  same kit: wide bookcases with a glossy Korean/English genre sign
  ("추리 · Mystery") over two shelves of titled spines, the Front Desk,
  the Return Cart, the Fines Counter as a small room like the ER's
  Operating Room ("벌금 · FINES"), the Boss's door ("관장 · BOSS") and the
  Reading Nook. Stairs and the Elevator are Hospital's own drawers; the
  Coffee Machine keeps its original art, as Hospital's does. Return Cart
  covers get line art and shadows.
* **Layout** (`floor-plan.js`): mirrors the ER. Stations can be
  rectangles: every station has `w`/`h` (defaulting to `size`), read
  through `stationExtents` by hit-testing, the walk-up standoff, the
  queue offsets, `drawStation` and First Person's billboards. There's a
  fixture row under the wall at y=110 (Boss's Office, a 124px-wide Front
  Desk, Return Cart, Stairs), 124×100 bookcases at y=340, the Fines
  Counter as a 130×130 room at (860, 320), and the Coffee Machine and
  Elevator in the bottom corners. `PLAYER_START`/`FLOOR_1_ENTRY_POINT`
  moved to the open lower aisle (480, 500).
  **Second floor plan** ("make a whole diffrent floors layout"), replacing
  the one above. 1st Floor, a lobby: Boss's Office (80, 115), Return
  Cart (300, 115), the Front Desk as the circulation desk top-center
  (520, 115), Stairs (880, 115); the Fines Counter room on the left wall
  (100, 290); three bookcases staggered across the middle (Mystery
  (360, 320), Romance lower at (580, 400) so it clears the Front Desk's
  queue, Sci-Fi (800, 320)); the Elevator bottom-left (80, 540) and the
  Coffee Machine bottom-right (880, 530), its rug clamped inside the
  canvas. 2nd Floor, a reading room: the Reading Nook top-center
  (480, 130), the Kids Shelf (250, 320) and Reference Shelf (710, 320)
  either side, reading chairs along the bottom, the ladder left of the
  Kids Shelf; Stairs and Elevator on the same footprint as downstairs.
  `PLAYER_START`/`FLOOR_1_ENTRY_POINT` is (450, 500); the 2nd Floor entry
  stays the canvas center (480, 300). The floor guide stripes, decor
  (water cooler, plants, ladder, chairs) and every walker's route
  (Security, the Volunteer, Min-jun, the Janitor, Shelver, Storyteller
  and Archivist) were redrawn to keep clear of the furniture, the queues
  and the shelf labels. Note for the Playwright suite: it now submits four
  scores per run (a month run and a Daily, in two browsers) against the
  5-per-minute submit limit, so a second run within a minute of the last
  can fail with 429s. Restart the server, or wait a minute, between runs.
  Then an overlap pass ("some thing is overlapping"): queued patrons now
  stand `QUEUE_SLOT_OFFSET_Y` 126 below the Front Desk/Fines Counter (72
  was sized for the old 0.62 patrons, so full-size heads covered the
  furniture and its name chip); the Fines Counter moved up to (100, 250)
  and the water cooler to (200, 120) to make room; each line's "+N
  waiting" chip sits beside it rather than under it (the Romance Shelf and
  the Elevator are below); the fine star and wanted-book icons sit beside
  a patron's head instead of above it; and Security (bottom-left), the
  Janitor (now by the Coffee Machine) and the Storyteller (below the Kids
  Shelf's label) were rerouted off the labels and each other.
* **Staff help** ("make staff help the plyer"), extending Min-jun's help to
  every staff member: click one (Top-Down) and Eun-mi walks up beside
  them (they wait for her); they help if they can, then need a cooldown
  (`STAFF_HELP`, `rules.js` §20; `staffHelpBlocker`/`staffHelp` in
  `engine-state.js`, `staffCooldowns` in the shift state):

  | Staff | Floor | Help | Cooldown |
  | ----- | ----- | ---- | -------- |
  | Security | 1st | Escorts Karen out while she waits in line (her event resolves as 'escorted': no fine, no mistake, no Mood hit) | once |
  | Shelver | 1st | Shelves the oldest Return Cart book (+5g tip; a Coin Hunt book's coins are skipped) | 45 s |
  | Janitor | 1st | Tidies up: +15 Mood | 60 s |
  | Volunteer | 2nd | Brings Eun-mi a coffee: +30 Sanity | 60 s |
  | Archivist | 2nd | Finds the requested book (skips Find the Book; on to checkout) | 60 s |
  | Storyteller | 2nd | Story time: every waiting patron (and the searching borrower) gets 15 s of patience back, up to their max | 75 s |

  A small second chip under a staff member's name says "click: …" (deep
  mint) when they can help, or "busy Ns" on cooldown; with nothing to do
  (full bar, empty cart, nobody waiting) there's no hint, and asking gets
  a short line of dialogue instead. Min-jun's hint moved to the same
  second chip. Security's and the Janitor's routes moved up so the hint
  line fits on the canvas, and the Shelver's up so it clears the Sci-Fi
  Shelf. Covered by `engine-state.test.js` (every helper, cooldowns,
  blockers, Karen's escort) and two Playwright tests (the Shelver, and the
  Volunteer's coffee).
* **Background staff**: a Security guard on the 1st Floor and a Volunteer
  on the 2nd walk fixed patrol loops around the furniture (random hops
  cut across the shelves). They're drawn back-to-front around Eun-mi.
* **Overlays**: Hospital's `animeBackdrop` and `animeWindow` (a trim
  color per minigame) behind every minigame, a `speechBubble` and
  `animeButton`s for Karen, and an outlined anime skill-check bar.
* **Crisp canvas**: the backing store tracks the device pixel ratio (up
  to 3×), as Hospital's does; input mapping already used
  CANVAS_WIDTH/HEIGHT, so it's unaffected.

* **Bilingual book titles** (the user: "make the books with korea titles
  and english translates"): the title pools moved to
  `web/static/js/library/book-titles.js` as Korean/English pairs. A book's
  `title` is "침묵의 단서 · The Silent Clue" (`bookTitle`), so toasts and
  overlay headers show both. Covers (`drawCoverTitle`) draw the Korean
  large with the English smaller beneath (`splitTitle`). Front Desk
  queue chips show the Korean title with its English meaning just below,
  under the patience bar (the user: "on the below add english meaning").
  Shelf spines stay Korean only: a spine is too short for both, and
  cutting each to its longest word paired Korean and English words that
  didn't match. Find the Book's covers grew to 68×48, with the whole cover
  clickable, to fit both lines. The Return Cart covers sit 6 px lower,
  clear of the cart's label. The Reading Nook stories have Korean titles
  too (`koTitle` in stories.js).

* **Clicking the Return Cart picks up a book**: the user couldn't pick up
  a book, because only the small covers under the cart were clickable.
  Clicking the cart itself just walked over and did nothing, even though
  the cart (now drawn with books on it) is the obvious target. Arriving at
  the cart now picks up the clicked cover's book, or else the next one in
  line, and the toast names it. If the cart is empty, it says so. Covered
  by the "clicking the Return Cart itself" e2e test.

* **Kang Min-jun (강민준)**: the user asked for "a VERY VERY detailed
  character … a boy". A first attempt, Director Park, was removed as not
  detailed enough. Min-jun is a student library assistant with his own
  renderer, `web/static/js/library/minjun.js` (`drawMinjun`). He has
  layered cel shading and line art but no eye highlights or hair shine,
  which the user had removed from Hospital Shift's characters.
  - Face: sharp, cool eyes (the user picked these over the first,
    softer almond ones). They're narrow and tilted up at the outer
    corners, with a heavy lash line ending in a pointed flick, a straight
    lower lid, an angled crease, and a deep iris tucked under the lid.
    They blink, now and then twice. Then the user asked to "adjust the
    stuff near the eyes". The blush was removed; the brows
    are slimmer and set higher; the crease and lower-lid lines are
    lighter; and the fringe locks taper to points above the brows, over a
    softly fading fringe shadow. Last, the eyes were made "a little bit
    straighter": the outer corners rise less, and the lash flick is
    flatter to match. The brows were relaxed too ("not like it's
    angry"): instead of sloping down toward the nose, they're nearly
    level with a soft arch. The head shape changed to a sharper anime
    V-jaw, then made "a little round": the cheeks curve down to soft jaw
    corners and taper to a gently rounded chin. Also relaxed, softly arched brows, a shaded nose, a small smile (no blush), ears with inner folds, a softly rounded V-jaw, and a jaw shadow.
  - Hair: a tufted crown in two tones, seven pointed fringe locks
    falling over the brows, side locks, strand lines and a bobbing ahoge.
  - Clothes: a white shirt with collar points and rolled sleeves, a navy
    cable-knit sweater vest with ribbed V-neck and hem, and a striped tie.
    A mint lanyard holds a swinging ID card with a photo and barcode.
    Headphones rest around his neck. He wears a wristwatch, slacks with a
    belt and creases, and laced sneakers.
  - Books: three under his arm, with Korean titles on the spines.
  - Motion: a walking stride with arm swing, and breathing when idle.

  - A further detail pass ("make him detailed"):
    - Hair: each fringe lock shaded root-to-tip with a second strand
      line, and tufts over the ears.
    - Eyes: radial texture lines in the iris, a lighter lower crescent and
      a pink inner corner. The iris is now a deep violet at the user's
      request: near-black violet at the top, an amethyst lower crescent,
      violet texture lines and a darker pupil.
    - Face: a nose-bridge shadow, a lower-lip tint and a silver stud
      earring.
    - Shirt: sleeve wrinkles, cuff buttons, collar shadows and stitching.
    - Vest and tie: a tie dimple and gold tie clip, vest side seams, and an
      enamel open-book pin.
    - Slacks: side seams, pockets and ankle folds.
    - Sneakers: eyelets, heel tabs and dashed sole stitching.
    - Hands and watch: fingernails and knuckle creases; the watch has a
      crown and tick marks.
    - Headphones: band stitching and logo rings.
    - Books: page edges and a ribbon bookmark.
  - One more pass ("a little more detailed"):
    - Eyes: a darker ring around each pupil and two extra lashes at the
      outer flick.
    - Face: faint under-eye shading and an upper-lip line.
    - Hair: more crown strands and two short flyaways.
    - Lanyard and ID card: a woven pattern on the strap, and a card
      printed with "LIBRARY · 도서관", 강민준 and "Assistant".
    - Belt and vest: belt loops, holes and a buckle prong, plus soft
      shadows where his arms meet the vest.
    - Feet: navy ribbed socks above the sneakers, with tied lace bows.
  - A third pass ("make min-jun more detailed"), adding new items rather
    than more texture:
    - Books: library call-number stickers with a coloured band, set
      between each title and the gold foot band.
    - A pencil tucked behind his right ear, the hair tuft falling back
      over its tucked end.
    - A keychain on a belt loop (ring, key, mint book charm) that swings
      as he walks.
    - Knit stitches (rows of tiny Vs) across the vest between the cables.
    - Sneaker tongues and a small mint star logo on each shoe, and dashed
      hem stitching on the slacks.
    - Faint cheekbone shading low on the cheeks.
  - A fourth pass ("a little more detailed"): a small beauty mark under
    his left eye, inner-ear shading, his shirt hem slipping out under the
    vest, a woven brand label on the vest's hem band, a tiny embroidered
    crest on the tie, a holographic sticker on the ID card, holes in the
    watch strap, and a plaster on one finger.
  - "Make him more handsome" was tried (a clean lash line, bolder
    straight brows, a natural half-smile, a defined nose, a jawline shadow
    and a thicker neck). The user then picked the earlier face back: the
    winged liner with extra lashes, the thin arched brows and the pink
    lips. That is the face he has now; the body details below stayed.
  - Another pass ("a little more detailed"), keeping the handsome face:
    ribbed armhole bands on the vest, a faint forearm vein and a wrist
    bone, his phone's outline pressing through the front pocket,
    sticky-note tabs poking out of the tallest book, and silver aglets
    on the lace ends.
  - Another pass ("make him more detailed"), face unchanged: two silver
    bobby pins over his side fringe, an inline remote with a mic on the
    headphone cable, shoulder seams on the shirt sleeves, a welt pocket on
    the vest with a pen clipped in, a violet beaded bracelet on his book
    wrist (matching his eyes), and a soft shadow the books cast on his
    side.
  - Another pass ("a little more detailed"): a small taegeuk pin (the
    Korean flag's red-and-blue swirl) below the book pin, a red second
    hand and centre pin on his watch, notched metal sliders on the
    headphone band, dimpled rubber toe caps and a heel seam on the
    sneakers, and turned-up cuffs on his slacks.
  - Another pass ("a little detailed"): dashed stitching along the belt's
    edges, folds in the tie knot, a swivel clasp where the lanyard meets
    the ID card, a library due-date slip sticking out of the side of the green book, and
    engraved title lines on the keychain's book charm.
  - The bobby pins were then detailed ("make the hair pins a little more
    detailed"): each is now a real hair pin, a straight prong and a wavy
    prong joined by a rounded bend, with rubber-dipped tips, a dark metal
    edge and a thin highlight along the straight prong.
  - Another pass ("make him more detailed"), face unchanged: a thin silver
    hoop through the upper rim of his left ear (above the stud), a plain
    silver ring on his free hand, a faded blue date stamp on the back of
    that hand (from testing the desk stamp), and a small yellow star
    sticker on one headphone cup.
  - Another pass ("make him even more detailed"), sized to read in the game:
    a canvas library tote on his right shoulder (viewer's left), hanging
    behind his free arm and swinging as he walks. It has a canvas weave,
    a stitched top hem, X-box stitching where the straps are sewn on, a
    navy open-book logo printed over "도서관", a mint patch pocket with a
    pen, and an enamel cat pin. A rolled poster with a pink band and an
    orange book poke out of the top. The front strap runs up over his
    upper arm to the shoulder; the back strap shows as a sliver behind the
    arm. (His path was later nudged so it clears the Reference Shelf; see
    below.)
  - Another pass ("make him more detailed"), at his new 1.7× size: a mint
    plush bear charm (pink inner ears, bow tie, stitched tummy) dangling on
    a chain from the tote's top corner and swinging as he walks; a yellow
    sticky note on the tote reading "반납" (returns); and a silver wallet
    chain of alternating links from his right-hip belt loop, sagging round
    to a back pocket.
  - Another pass ("i want him even more detailed"), face unchanged, Korean
    student touches: a bottle of banana milk (바나나맛 우유: round yellow
    belly, green cap) poking out of the tote beside the orange book; a
    K-pop photocard holder on a ball chain from his left belt loop (a
    lavender frame round a tiny idol portrait, star stickers, a clear
    shine) that swings as he walks; a pink "♥책" (I love books) button
    pinned halfway up the tote strap; a mint "도서" (library) armband with
    dashed stitching on his book arm's upper sleeve; a tiny gold open-book
    pin on his right collar point; and two mint varsity stripes round his
    navy socks.
  - His own walk ("make him have a special walk putting his hands in his
    pockets"): while walking (and not mid-action), his free hand goes
    into his trouser pocket (`drawPocketArm`) — elbow out and loose, the
    forearm angled down across his belt (drawn over the vest, like the
    reading arm), a pocket bulge a shade lighter than his slacks with its
    slanted opening, and his thumb hooked outside — and his body sways
    easily side to side from the hips (±0.025 rad). His other arm keeps
    carrying the books. When he stops to read, hum, wave or help, the hand
    comes out. The photocard moved to his right-hip belt loop so it
    doesn't hide the pocket.
  - Another pass ("make him detailer"), face unchanged: his T-money
    transit card tucked in the badge holder behind the ID (a teal corner
    with a white "T" and a gold stripe peeking out); the shirt's red-and-
    navy plaid lining showing on both rolled cuffs; mint NATO-style stripes
    along his watch strap; a blue ballpoint star doodled on the back of his
    book hand; and a faint woven check in his slacks.
  - And another ("even more detailed"), face unchanged: dashed stitching
    round both headphone cushions with a tiny L / R on the cups; "M.J."
    embroidered in gold under his vest's welt pocket; a mint scrunchie on
    his book wrist above the bracelet; tread notches along his sneaker
    soles; and a folded lavender umbrella with a hooked wooden handle
    tucked in the tote's back corner.
* **Taking books to read** ("add so that i can take books and read it in
  reading nook"). The Reading Nook's five stories are now real books on the
  shelves, one per genre (`stories.js`'s `genreId`, `storyIndexForGenre`):
  The Lighthouse Keeper (Mystery), A Quiet Afternoon (Romance), The Long
  Walk Home (Sci-Fi), Paper Boats (Kids), Tea for One (Reference). With
  empty hands and no borrow search underway, clicking a shelf takes its
  book (`takeBookToRead`, `readingBook` in the shift state; one at a time,
  shown as the carry badge in the genre's color). At the Reading Nook that
  book opens ("Your pick from the shelf"); finishing it gives the usual
  +20 Mood plus READING_CHOSEN_SANITY_RESTORE (+10) Sanity (`rules.js`
  §21), then it goes on the Return Cart to be reshelved like any return.
  Without a book of your own the Nook works as before (a random story, Mood
  only). The page's How to play panel gained a fifth step. Covered by
  `engine-state.test.js`, `stories.test.js` (one story per genre) and a
  Playwright test (take the Mystery book, read it, Sanity up, it's on the
  cart).
* **Unique walks** ("make it so everyone has a unique walk"). Hospital's
  anime renderer draws a body in one piece (no swinging legs), so each
  staff walk is a rhythm applied to the whole figure about its feet
  (`library/walk-styles.js`: `WALK_STYLES`, `applyWalk`, `drawWalkProp`),
  only while they're actually walking:

  | Who | Walk |
  | --- | ---- |
  | Security | march: a firm, even bob and a slight shoulder roll |
  | Volunteer | skip: hops, squashing a little on each landing |
  | Janitor | waddle: slow side to side, pushing a swishing mop |
  | Shelver | power-walk: quick steps, leaning into her direction |
  | Storyteller | dance: a swaying bob and a twirl every four seconds |
  | Archivist | stroll: slow and stooped, tapping a wooden cane |

  Min-jun keeps his hand-in-pocket walk and Eun-mi her own (both in their
  renderers). Walkers now remember which way they're heading (`dir`) so
  leans and props face it, and each has a phase offset so no two step in
  time. Covered by `walk-styles.test.js` (every walker has a distinct walk,
  finite poses, leans follow direction, props for the Janitor and
  Archivist only).
* **Director Park** was added (a simple design, then an office cutscene
  on clocking out, then several redesigns) and then removed at the user's
  request ("just remove him from the game"): no character, cutscene or
  renderer. Clocking out goes straight to the paycheck again.
* **Han Ji-ho** (한지호; "add another super detailed character a boy
  again" — asked: a high-school student who helps the player; the user
  asked for a name other than "Do-yun"). His own renderer,
  `library/jiho.js` (`drawJiho`, 3% shorter than adults): fluffy black
  hair with a soft fringe of separate tapered locks and a small bobbing
  cowlick, big round sleepy eyes with heavy lids (exam season; a sleepy
  double-length blink; the shadows under them were removed — "remove ey
  bags"), a plaster on his cheek and a mole;
  a navy school blazer with gold-piped lapels, a gold book crest on the
  breast pocket, a pen, gold buttons, flap pockets and a "한지호" name tag,
  over a grey hoodie (hood on his shoulders, drawstrings, cuffs at his
  wrists) and a white shirt with a loosened striped tie; grey trousers,
  white crew socks and canvas high-tops with red-dot ankle patches; a
  black backpack on both shoulders with stitched straps, buckles, a star
  pin badge and a swinging plush bunny; one hand on a strap, the other
  holding a ring of vocab flashcards ("단어" / "word", flipping) by a black
  digital watch reading 23:00. Same knee-bend, heel-toe walk cycle as
  Director Seo. He paces a short stretch of the 1st Floor's lower aisle
  between Security and the Janitor, and helps like the other staff: click
  him and he collects the first fine in line (`STAFF_HELP.jiho`, 60 s
  cooldown) as if Fines Sort had succeeded — Eun-mi still counts it into
  the till at the Front Desk. Covered by `engine-state.test.js` and a
  Playwright test. A second pass ("even more detailed"): a red "수능 D-100"
  exam-countdown pin on his left lapel; neon sticky tabs and a yellow
  highlighter poking out of his left pocket; gold dashed stitching round
  the blazer's pockets and down its sides; a mint-and-pink woven friendship
  bracelet on his strap hand; button details on the digital watch; navy
  stripes round his socks; scuffs and a blue ballpoint star doodled on his
  high-tops; and a blue ink smudge on his jaw from sleeping on his notes. Then
  "make him more handsome and even detailed": a slimmer, more defined
  V-jaw with a soft shadow under the chin; almond eyes (the round sleepy
  ones replaced) with a defined lash line that thickens at the outer
  corner, a double-eyelid crease, finer iris lines and a warm lower
  crescent; straight, tapering brows, the fringe shortened so they show;
  a defined nose bridge; a calm closed half-smile with a lower-lip tint in
  place of the open mouth; a fainter cheek flush; glossier hair strands;
  and one wired white earphone, its cable curling into his hoodie collar.
  The ink smudge was dropped. Then "make him better": his hair restyled from a blunt,
  bowl-like fringe into a modern side-swept one — parted right of centre
  with a little forehead showing, the main sweep falling left in tapered
  locks of uneven length, strand lines following the sweep, a part line
  and a soft glossy band across the crown — and warmer, lighter brown eyes
  with a lighter lid shadow. And another pass ("more detaile"): a mint water bottle
  in the backpack's mesh side pocket (white cap, yellow sticker); a silver
  tie clip; three small gold buttons on each blazer cuff; metal eyelets and
  a loose lace with an aglet on his high-tops; reflective silver strips on
  both backpack straps; and a second pin, a green "A+", on the left strap. Then
  "make him better" again: a tailored silhouette in place of the boxy one —
  the blazer has sloped shoulders, a nipped-in waist and a curved hem that
  falls a little lower, with cloth shading (the far side in shadow, folds
  under the arms, a highlight down the near front); slimmer, tapered
  trousers and sleeves; and a slightly narrower backpack. Then "change the
  hair" (asked: fluffy messy, dark brown): his hair is now dark brown and
  fluffy — a cloud of rounded tufts over the crown (outlined only on the
  outside, with curl strokes, a soft shadow low down and two shine
  arcs), a tousled fringe of tufts leaning different ways that stops above
  his brows, side tufts flicking out over the ears, and a three-tuft
  bouncing cowlick; the tufts bob gently. Then "make the high school student more
  detailed": hands with four separate fingers (curled short on the strap,
  open with pale nails on the card hand), knuckle dimples and a thumbnail;
  a shoulder seam and elbow creases on both blazer sleeves; a side seam,
  a hip fold and fabric stacking above the hem on his trousers; a red heel
  tab, a red foxing stripe and tread ticks on his high-tops; thread holes
  in the gold front buttons with a buttonhole opposite, a stitched lapel
  buttonhole, the shirt's top button and a folded tie knot with a dimple; a
  silver clip on his pen; ruled handwriting lines on the top flashcard; a
  jaw shadow and faint tendons on his neck; an inner rim on each ear; two
  small nostrils; and two short flyaway hairs off the sides of the fluff.
  (Lower lashes, outer-corner lash flicks and a philtrum were tried and
  dropped: at full size they read as marks on his cheeks and eyeliner.)
  Then "more detailed and stylish": cream over-ear headphones (silver
  sliders, mint accents) resting round his neck replace the wired earphone;
  slimmer, tapered trousers cropped above the ankle with a rolled cuff, over
  ribbed white socks with a navy and a burgundy stripe; a fine twill weave
  on the blazer; a ribbed hoodie hem; a silver stud in his right ear and a
  silver ring on his strap hand; the "수능 D-100" pin moved lower on the
  lapel, clear of the headphones; and the fringe's locks fade in from their
  roots, so they grow out of the crown instead of meeting it in a hard line.
  Then "make it better": the fluffy crown hugs his head and tapers toward
  the ears (smaller lobes, bigger on top) instead of spreading wide like a
  helmet; each trouser leg is one outline (`limbPath`), so no seam shows at
  the knee; and the headphone cups have a visible side wall, a highlight and
  a small mint logo bar in place of the ring-and-dot that read as eyes.
  Then "make him more detailed like min-jun but not exact": Min-jun's
  density comes from big, readable props that break his silhouette, so Ji-ho
  got his own exam-student ones rather than copies of Min-jun's — a thick
  blue "수능특강" (국어 · 영어) workbook with neon page flags and a clear ruler
  sticking up out of his backpack behind his shoulder (`drawPackTop`); round
  gold-wire study glasses pushed up into his hair (`drawPushedUpGlasses`); a
  red "합격" good-luck charm with a gold tassel swinging from his flashcard
  ring; a mint phone (camera bump, bunny sticker, pink strap) sticking out
  of his right blazer pocket; a faint grey check on his trousers like a
  Korean uniform's; bigger flashcards; and a stronger blazer twill.
  Then "more detailed": a sternum strap clipped across his chest (sliders
  on both shoulder straps, a buckle with a tiny orange whistle) and loose
  webbing tails with plastic tips hanging from the straps; pick stitching
  inside the lapel edges; the hood's lighter heather lining and a stitched
  seam over it; tied lace bows on his high-tops; the top flashcard's word
  underlined twice in red pen with a red star; a lighter mid-tone layer of
  curls and long strand lines in his hair, and darker hair showing behind
  his ears; and a soft cheekbone contour on the shaded side. (A shadow
  under the lower lip was tried and dropped: it read as a second lip.)
  Then "make his t shirt better" (the white shirt under the blazer — he
  has no T-shirt): a real collar (`drawShirtCollar`, drawn after the head
  so it wraps over the front of his neck) — a band round the neck and two
  crisp points lying over the tie knot, each with a cast shadow,
  topstitching and a collar-stay line; the shirt front shaded cool at the
  sides with the collar's shadow across the top and two creases by the
  tie; and the grey hoodie under it given a heather speckle, shade where
  the blazer overlaps and a ribbed neckline band, its drawstrings now
  coming out of that band instead of lying over the shirt. Then "better":
  a button-down collar (a tiny white button holding each point down); a
  fine oxford basket weave on the shirt front; his shirttail slipping out
  under the hoodie on one side, a curved white hem with stitching and a
  fold, over the trousers; and the drawstrings hanging outward so their
  tips tuck under the lapels, clear of the collar buttons and tie clip.
  Then "detailed": the back of the collar standing up behind his neck,
  with its fold line; and on the shirttail a stitched button placket with
  a four-hole white button, two more creases and a small triangular gusset
  reinforcing the side-seam split.
  Then "more more detailed": an embroidered school emblem on his upper
  sleeve (a navy shield, gold border, open book and laurels); a tiny gold
  crest on the tie above the clip; stitching along the headphones' padded
  band and round each ear cushion; the water bottle's water level,
  measurement ticks and a carry loop on its cap; a canvas weave on the
  high-tops; and a stitched seam and a red bow on the plush bunny.
* **Director Seo** (서 관장; "add a new detailed director" — asked: a
  young, stylish, modern man, in an office cutscene at clock-out). His own
  renderer, `library/director-seo.js` (`drawDirectorSeo`), drawn 6%
  taller than everyone: dark-brown two-block hair with a comma fringe and
  strand lines, warm brown eyes (no highlights, a quick blink —
  `isDirectorBlinkingAt`), straight groomed brows, a half-smile, a silver
  hoop earring and a white wireless earbud; a camel long coat open over a
  ribbed black turtleneck (notched lapels with stitching, horn buttons and
  buttonholes, flap pockets, fold shadows), a thin silver chain with a bar
  pendant, slim charcoal trousers with a crease and cuffed hem, white
  leather sneakers with laces, a heel tab and a green dash, a silver watch,
  a signet ring, and a tablet whose screen shows a bar chart and a moving
  pulse line. He walks with a "confident stride" (`WALK_STYLES.libDirector`). His
  own walk cycle was then made visible ("walk animation?" — the legs and
  arms barely moved): each leg swings from the hip (±0.22 rad, back leg
  drawn first), the trailing foot lifts, a knee fold shows mid-step, the
  free arm swings ±4.6, the coat hem sways ±2.4 and he bobs on each step.
  Then "make it better": two-segment legs (thigh and shin) with a soft
  knee bend during each leg's swing phase, heel-toe feet (the toe tips up
  at heel strike, the foot rolls off behind), a rise as the legs pass and a
  dip on each heel strike, a slight upper-body counter-sway, the coat hem
  lagging the stride, the head settling a beat late, a forearm lift on the
  forward arm swing, and `walkAmount` (0..1) easing him into and out of
  walking so the cutscene's start and stop don't snap. Then "make him more
  stylish": thin gold round glasses with faintly tinted lenses; more
  volume and shine in his hair; a burgundy silk pocket square with gold
  dots in a breast pocket and a gold flower brooch with a pearl on the
  right lapel; the coat's loose belt ties hanging at his hips through belt
  loops, swinging as he walks; cropped trousers showing a sliver of ankle
  above his sneakers; and a stack of two thin rings (silver and gold).
  The office was then redone ("make teh office look better",
  `drawDirectorOffice`): pinstriped wallpaper with crown molding and
  paneled wainscoting; a floor-to-ceiling window onto Seoul at night
  (twinkling stars, a glowing moon, Namsan Tower with a blinking light,
  two layers of skyline with lit windows) between sheer curtains on a rod;
  a styled bookcase (a potted plant, a framed photo, a gold trophy, a
  leaning book); the framed 감사장 with a red seal; a tall monstera in a
  white planter, its leaves swaying; a walnut desk on metal legs with a
  glowing monitor showing a chart, a keyboard, a steaming coffee, a brass
  arc lamp with a warm glow, and his nameplate; staggered glossy planks
  with a moonlight pool; a burgundy rug with gold diamonds and fringe; and
  a soft vignette. The speech bubble moved up above the monstera.
  Clocking out plays his cutscene (`boss-cutscene`, ~4.8 s, skip with a
  click or Space/Enter/Esc) before the paycheck: his office at night (city
  window and moon, bookcase, a framed 감사장, his desk with a lamp, files and
  a "관장 · Director Seo" nameplate); he walks over from his desk, says a
  line about the shift (`directorLine`: flawless, ordinary, rough, the 30th
  shift, or the Daily Challenge) and hands Eun-mi the pay envelope. Covered
  by `director-seo.test.js`, `walk-styles.test.js` and a Playwright test;
  the tests that clock out skip it with a click (`skipBossCutscene`).

  Min-jun's eyes were opened up so they read at game size (the user: "I can
  barely see his eyes"; they were near-black slits): the eye opening is
  a little taller, the lash line follows it, the violet is a step
  brighter, and the lid shadow is lighter. A bigger iris was tried and
  then set back to its original size at the user's request; the pupils
  were then enlarged instead (0.85×1.05 → 1.15×1.35, then shrunk in
  two steps at the user's request to 0.8×1.0, just under the original, with the ring around
  them, the iris lines and the lower crescent resized to match). The
  sharp, winged look is unchanged.
  He's drawn at 1.5× ("make him bigger in game", from the 1.3× he got to
  match everyone's height; the top of his walk dropped to y 290 so his
  head clears the Stairs). Before that, 1.4× ("make min-jun bigger" took him from 1.05× to
  1.35×, then "make him more bigger in game" to 1.7×, then "a bit too
  big, make him a little smaller" to 1.55×, then "make him smaller" to
  1.4×; his path's shelf-side
  end nudged from x 740 to 755 so the tote clears the shelf) and paces
  the open aisle between the Reference Shelf and the Stairs/Elevator. At
  the bigger size his old loop around the shelf overlapped the Reading
  Nook. He was set dressing until "make him HELP the player"; see below.


  He does things now ("make min-jun do smth"): at each corner of his walk
  he stops for a few seconds and either reads (his free arm comes up
  across his chest holding an open blue book, a page turning over every
  ~2.4 s, his head dipped toward it; ~6 s), hums (his head bops and violet
  and pink notes drift up beside it; ~4.5 s), or, when Eun-mi is on his
  floor within 260 px, waves (free arm raised and rocking, a "안녕!"
  speech bubble popping in; ~2.6 s). He never waves twice running and
  otherwise alternates reading and humming. The choice and durations live
  in `web/static/js/library/minjun-actions.js` (`pickMinjunAction`,
  `MINJUN_ACTION_SECONDS`), the poses in `drawMinjun`'s `action`/`actionT`
  options; both are unit-tested in `minjun.test.js`.
  His face moves with it ("when he reads and says hello and sings make
  his mouth open, for singing he closes his eyes"): reading (aloud),
  waving hello and offering to help, his mouth opens and closes as he
  talks (a wide opening with top teeth and a tongue); humming is singing,
  with a rounder "o" mouth and his eyes closed in happy, upturned arcs
  (lash flicks kept). Otherwise he has his usual closed smile
  (`faceForAction`, `drawOpenMouth`, `drawEyes(ctx, 'happy')`).

  He helps ("make him HELP the player"), in the spirit of Hospital
  Shift's Orderly: click him (2nd Floor, Top-Down) and Eun-mi walks up
  beside him, following him if he's moving. He stops and waits while she
  comes. If she's carrying a book, he takes it and shelves it for her
  (`minjunShelveCarriedBook` in `engine-state.js`): the book is cleared,
  she gets the usual SHELVED_BOOK_TIP_GARD shelving tip with no minigame
  and no mistake risk, a Coin Hunt book's coins are skipped, and the toast
  reads `Min-jun: "제가 할게요!"` ("I'll do it!"). He raises his arm with a
  "제가 할게요!" bubble (the `help` action), then can't take another book
  for MINJUN_HELP_COOLDOWN_SECONDS (60, `rules.js` §18). Empty-handed, he
  asks her to bring him a book from the Return Cart; on cooldown, the
  toast says how long is left. While she's carrying a book, his name chip
  reads "(click: shelve it)" or "(busy Ns)". It's a trade-off rather than
  a free pass: he's upstairs, so a 1st-floor book still means a trip up
  the stairs. Not available in First Person Mode, where a canvas click is
  the interact action. State fields: `minjunCooldownSeconds`,
  `minjunHelps`. Covered by `engine-state.test.js` and two e2e tests
  (shelving a carried book; asking empty-handed).

e2e changes: the Boss's Office closing-wait test gives the wait 4 s
(the office is now about 2 s from the start, so a 2 s wait ended before
arrival), and the First Person "toggle back to Top-Down" test checks
that walking to the Coffee Machine opens its pour. It used to check for
an instant Sanity refill on arrival, from before the Coffee Pour
minigame, and only passed while the walk was short.

### Superseded v1 plan: Scope, User Flow and Visual Direction

The original v1 plan, before the v2.x changes (fines reversed in v2.4, the
anime restyle in v2.21, new minigames and staff). Kept for reference only.

#### Scope (v1)

**In scope (v1):**

* `GET /library-game` page + canvas game shell, click-to-move floor plan,
  mirroring Kitchen Shift's v2+ architecture (canvas-primitive rendering,
  no image assets, `image-rendering` not needed since there's no pixel
  upscaling requirement beyond what "pixel art" primitives already look
  like — see Visual Direction).
* **30 shifts**, split into three 10-shift tiers (reusing Kitchen Shift's
  round-tier pattern: shift clock shrinks and return/fine volume grows each
  tier) — see Business Rules.
* **Return-cart shelving loop**: books accumulate on a Return Cart at the
  front desk; the player carries one at a time to its correct shelf
  (matched by a genre/color-coded call number) and completes a
  **Shelf Skill-Check** minigame (a timing bar — stop a moving indicator in
  a target zone) to shelve it.
* **Coin Hunt books**: a subset of returned books instead trigger a
  hidden-object minigame (find every coin and every dollar bill scattered
  among the book's pages) before they can be shelved; found currency is
  added to the shift's Gard total as a bonus.
* **Fines counter loop**: patrons at the front desk occasionally pay a
  fine (Gard only, per the user's "for the fines its gard only"); the
  player carries that payment to the Fines Counter station and completes a
  **Fines Sort** minigame (find and click every gold coin and Gard bill
  among decoy clutter in a register-drawer scene) to bank it.
* **Borrowing loop** (the mirror image of shelving): a patron at the front
  desk requests a specific book; the player must go to the shelves and
  complete a **Find the Book** minigame (search among the shelved books
  for the one matching the patron's request, among visually similar
  decoys — same "search the scene" shape as Coin Hunt, but the target is
  a single correct book rather than every coin/bill) and then complete a
  **Checkout Skill-Check** (a timing-bar check, same mechanic as the
  Shelf Skill-Check) to hand it over. Failing either step costs the
  patron's patience, same consequence class as a late/failed shelving.
* **Karen event**: once per 30-shift run, on a shift chosen randomly from
  10–15 at month start (deterministic per save, mirroring how Kitchen
  Shift's own scripted customers are chosen) — a disruptive patron who
  returns an overdue book without paying its fine and argues, draining a
  restaurant-mood-equivalent stat (see Business Rules) if mishandled.
* **Player Sanity + Coffee Machine**: a player-only Sanity stat (0-100,
  same scale/shape as Kitchen Shift's own Sanity — passively drains over
  the shift and drains further per mistake, slows walk speed as it drops)
  and a **Coffee Machine** station (in a staff break room, or tucked near
  the Fines Counter) that restores Sanity to full when the player
  interacts with it — mirrors Kitchen Shift's Coffee Machine mechanic
  exactly (`SANITY_MAX`/`SANITY_DRAIN_PER_SECOND`/
  `walkSpeedMultiplierForSanity` in `rules.js`), reused rather than
  reinvented. Distinct from `libraryMood` (Business Rules), which tracks
  the library's reputation, not the player's own stress.
* **Big, expressive pixel characters**: canvas-primitive rendering scaled
  up beyond Kitchen Shift's base scale (per "make the characters BIG"),
  each built from a shared `drawLibraryPerson` helper (the same
  head/body/anime-face composition pattern as Kitchen Shift's
  `drawPixelPerson`/`drawAnimeFace`) parameterized by a **personality
  template** (distinct face-expression parameters — eyebrow angle, mouth
  curve, eye shape — plus hair/outfit palette, not just a palette swap) so
  patrons visibly read as different people (Grumpy Regular, Shy Student,
  Cheerful Kid, Karen, etc.).
* Shift-end Gard payout (base amount, plus Coin Hunt/fines bonuses, minus a
  per-mistake penalty — same shape as Kitchen Shift's `shiftPaycheck`),
  client-side `localStorage` progress persistence, and a Postgres-backed
  public leaderboard (`library_scores`, mirroring `cooking_scores`).
* **Two floors, the 2nd purely for more books**: mirroring Kitchen Shift's
  Dining/Kitchen room split (`docs/features/cooking-game.md`'s "v3.1 room
  split"), a **1st Floor** keeps every non-shelf station (Front Desk,
  Return Cart, the Fines Counter, the Coffee Machine, Boss's Office) plus
  some Bookshelves, and a **2nd Floor** holds additional Bookshelves only
  — more genres/more shelf capacity, per the user's "for more books,"
  not a relocation of any other station. The two floors share one canvas,
  never shown at once, reachable via **three** independent routes on each
  floor: a **Stairs** station, an **Elevator** station, and a "Go
  Upstairs"/"Go Downstairs" HUD button — the user asked for stairs *and*
  an elevator specifically, so both exist side by side rather than
  picking one, same reasoning Kitchen Shift applied when the user asked
  for both a door and a button ("v3.1 room split"). All three switch
  instantly with no loading state (no ride/climb animation gating it) and
  reposition the player at that floor's entry point.
  Switching floors must work in every shift phase, including
  `closing-wait` — a borrow/shelving trip could still be in progress on
  the 2nd Floor when the clock hits 11 PM, and the player must be able to
  come back down to reach the (1st-Floor-only) Boss's Office.
* **First Person Mode**: an HUD toggle switching the camera from the
  default top-down click-to-move view to a genuine first-person
  perspective — the player sees the world from their character's own
  eyes (floor/stations/patrons ahead of them) and does not see their own
  avatar at all, per the user's explicit "seeing in first person and
  seeing anything but yourself." Since there's no 3D engine or wall
  textures anywhere in this codebase, the view is a lightweight
  billboard-sprite perspective (a simple floor/horizon gradient, with
  stations and patrons drawn as the same existing canvas-primitive art —
  `drawLibraryPerson`, station shapes — scaled and horizontally
  positioned by their angle/distance from the player, not a textured
  raycast engine). Click-to-move doesn't apply in this mode, so it adds
  its own controls: turn left/right and move forward/back (arrow keys or
  on-screen buttons), plus a "look at a station, then interact" prompt
  for whichever station is centered in view within range, functionally
  equivalent to clicking that station in Top-Down mode. All five minigame
  overlays are unchanged and camera-mode-agnostic (they're already
  full-canvas takeovers). Switching modes is instant and preserves the
  player's position/floor; it's a pure alternate camera+control scheme,
  not a separate game mode with different rules.
* `/library-game` added to the `/projects` grid (`internal/handler/
  pages.go`'s `projectItems`), following the exact Fishing Game/Kitchen
  Shift/Puzzle Solver pattern.

**Out of scope (v1):**

* Any second art style pass (this ships pixel-primitive art directly, no
  "v1 primitives → v2 restyle" split like Kitchen Shift went through) —
  the user asked for pixel + big expressive faces from the start, so that
  is v1, not a later redesign.
* Gear/shop upgrades, leveling systems, or a second scripted recurring
  patron beyond Karen — Kitchen Shift only grew these over many follow-up
  sessions; v1 here ships the mechanics the user actually asked for and
  nothing speculative.
* Mobile/touch-specific controls beyond what click/tap-to-move already
  gives for free (same stance Kitchen Shift took).
* Real hand-drawn or generated sprite/image assets — same constraint as
  every other game on this site (no image-generation tool available);
  "pixel" here means canvas-primitive rendering at a blocky scale, as
  established by Kitchen Shift's own Visual Direction notes.

---

#### User Flow (v1)

```text
1. Player navigates to /library-game (via the Projects grid's "Play now").
2. Start screen → "Start Shift" launches Shift 1 on the library floor plan.
3. Books pile up on the Return Cart over the shift. Player clicks a book,
   carries it (click-to-move) to the shelf matching its color-coded genre.
4. Arriving at the correct shelf launches the Shelf Skill-Check minigame
   (most books) or the Coin Hunt minigame (marked books) — success shelves
   the book and, for Coin Hunt books, adds found Gard to the shift total.
5. Separately, patrons occasionally arrive at the front desk to pay a fine.
   Accepting the payment sends the player to the Fines Counter, where the
   Fines Sort minigame (find every coin/bill in the drawer) banks it.
5b. Other patrons instead arrive requesting to borrow a specific book.
    Accepting the request sends the player to the shelves for the Find
    the Book minigame (locate the requested book among decoys), then back
    to the patron for the Checkout Skill-Check (a timing-bar check) to
    complete the loan.
6. Shift clock hits 11:00 PM → a 20-second closing wait begins (the Boss's
   Office door stays locked/non-interactive until it elapses — walking up
   to it early does nothing); once the 20 seconds pass, the boss lets the
   player in, and entering the office collects the shift's paycheck —
   payout screen shows Gard earned this shift (base + bonuses − mistakes)
   and updates the running total.
7. Steps 3-6 repeat for 30 shifts, in three difficulty tiers (1-10/11-20/
   21-30). On the Karen shift (randomly 10-15), an extra scripted patron
   event plays out at the front desk.
8. After shift 30, a Final Paycheck screen totals the run and offers
   leaderboard submission (player name + total Gard), same flow as Kitchen
   Shift's Final Paycheck.
```

---

#### Visual Direction (v1)

Canvas-primitive rendering, matching Kitchen Shift's proven approach (flat
shapes scaled to a fixed internal resolution — no external image/sprite
assets exist or are generatable in this environment):

* **Floor plan**: a library floor — Front Desk (patron queue + fine
  payments), Return Cart, several color-coded Bookshelves (one per genre),
  a Fines Counter station (separate room or distinct floor area from the
  desk, so "carrying the payment to the counter" is a real click-to-move
  trip, not instantaneous), reading tables/chairs as background dressing.
* **Big characters**: `drawLibraryPerson` scales noticeably larger than
  Kitchen Shift's player scale (that game's own v3.3 changelog is the
  precedent for "characters read too small, make them bigger" — this game
  starts at that larger scale instead of needing a later bump).
* **Faces with personality**: every character gets an anime-style
  procedural face (big eyes, brow, mouth) via a shared face-drawing helper,
  but — unlike Kitchen Shift's one-size-fits-most `drawAnimeFace` — each
  personality template supplies its own expression parameters (e.g.
  Grumpy Regular: down-angled brows, flat mouth; Cheerful Kid: raised
  brows, wide smile; Karen: sharply angled brows, small tight mouth,
  reddish face tint during her scripted outburst) so patrons are visually
  distinguishable at a glance, not palette-swapped clones.
* **Sanity bar gets a distinct font**: Kitchen Shift's on-canvas Sanity
  label renders in a plain `'bold 10px sans-serif'` (`cooking-game.js`'s
  `drawSanityBar`) — this game's Sanity bar instead uses the site's own
  display font, **Caprasimo** (already self-hosted via `@font-face` in
  `web/static/css/app.css`, no new font file needed), e.g. `` `bold 11px
  "Caprasimo", sans-serif` `` with the generic family kept as a fallback.
  Since a canvas draw issued before a `@font-face` finishes loading
  silently falls back to the generic font with no error, the renderer
  must `await document.fonts.ready` (or `document.fonts.load(...)`)
  before the first frame that draws the Sanity bar, or retry the draw
  once the font's load promise resolves.
* **A visible clock**: the 8:00 AM-11:00 PM in-game time
  (`inGameTimeLabel`) is shown two ways — the HUD's `#library-hud-clock`
  text (already wired by the backend template) for at-a-glance tracking,
  and a diegetic **wall clock** drawn as floor decoration on the 1st
  Floor (analog clock face, hands positioned per the current in-game
  time) purely for scene flavor — the HUD text is the actual source of
  truth a player tracks time by, the wall clock is not a second
  interactive/authoritative display, just set dressing.
* **Minigame overlays** render on-canvas, not as separate DOM panels,
  matching Kitchen Shift's fridge/cabinet panel precedent where it makes
  sense but as full-canvas takeovers for the two "search the scene"
  minigames (Coin Hunt, Fines Sort), since both need a larger interactive
  area than a HUD-sized panel.

---
