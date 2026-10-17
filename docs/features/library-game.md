# Feature: Library Shift

## Status

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

**v2.12 more character designs + the player is Coral James** — the
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
Sanity", and Coral wears steaming coffee stains for 6 s
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
to be "like hospital shift" (its anime look on `main`), Coral in a kimono
"like kimono from hospital shift", and a Korean library. Everything is
drawn with Hospital Shift's own anime kit rather than a copy of it:

* **Characters**: `drawLibraryPerson` now dispatches to Hospital Shift's
  renderers. Coral is drawn by `hospital/kimono-himura.js`'s
  `drawKimonoHimura` with `cap: false, look: 'coral'`, at Hospital's
  `PLAYER_ART_SCALE` (1.12) with its walking sway. The user first got an
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
  upturned toes. Her hands are folded in front. Patrons use Hospital's
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
* **Background staff**: a Security guard on the 1st Floor and a Volunteer
  on the 2nd walk fixed patrol loops around the furniture (random hops
  cut across the shelves). They're drawn back-to-front around Coral.
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

  His eyes were opened up so they read at game size (the user: "I can
  barely see his eyes"; they were near-black slits): the eye opening is
  a little taller, the lash line follows it, the violet is a step
  brighter, and the lid shadow is lighter. A bigger iris was tried and
  then set back to its original size at the user's request; the pupils
  were then enlarged instead (0.85×1.05 → 1.15×1.35, then shrunk in
  two steps at the user's request to 0.8×1.0, just under the original, with the ring around
  them, the iris lines and the lower crescent resized to match). The
  sharp, winged look is unchanged.
  He's drawn at 1.55× ("make min-jun bigger" took him from 1.05× to
  1.35×, then "make him more bigger in game" to 1.7×, then "a bit too
  big, make him a little smaller" to 1.55×; his path's shelf-side
  end nudged from x 740 to 755 so the tote clears the shelf) and paces
  the open aisle between the Reference Shelf and the Stairs/Elevator. At
  the bigger size his old loop around the shelf overlapped the Reading
  Nook. He's set dressing, not clickable.

e2e changes: the Boss's Office closing-wait test gives the wait 4 s
(the office is now about 2 s from the start, so a 2 s wait ended before
arrival), and the First Person "toggle back to Top-Down" test checks
that walking to the Coffee Machine opens its pour. It used to check for
an instant Sanity refill on arrival, from before the Coffee Pour
minigame, and only passed while the walk was short.

## Summary

A third canvas mini-game, `/library-game`, sibling to Kitchen Shift and the
Fishing Game: the player works library shifts, returning books to their
correct shelves (via one of several book-specific skill-check minigames) and
processing patron fines (via a coin/bill-sorting minigame at the fines
counter), earning **Gard** — this site's existing in-game currency, already
established by Kitchen Shift's shift payouts — over a 30-shift run. A
scripted disruptive patron ("Karen") appears once, on a shift randomly chosen
from 10–15.

## Problem / Motivation

The user asked for a new library-themed game reusing this codebase's
existing game conventions (shift structure, Gard currency, a Karen-style
disruptive-customer beat, procedural pixel-art characters with faces) but
with its own core mechanic: book-shelving skill checks and a fines-counter
sorting minigame, instead of Kitchen Shift's cooking/serving loop.

## Scope

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

## User Flow

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

## Visual Direction

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

## UI

```text
web/templates/pages/
└── library-game.html          # {{define "library-game-content"}}
web/templates/components/
└── library-leaderboard.html   # leaderboard fragment (mirrors
                                # cooking-leaderboard.html)
```

States (see `tailwind-ui` for the full state list):

| State    | Behavior |
| -------- | -------- |
| Default  | Start screen → floor plan gameplay. |
| Loading  | HTMX nav swap uses `#nav-loading`, same as every other route. |
| Empty    | Leaderboard with zero rows renders an empty-state message, same as Kitchen Shift's leaderboard fragment. |
| Error    | Leaderboard fetch failure renders an inline error state in the fragment, same as `writeCookingLeaderboardError`'s pattern. |
| Success  | Score submission refreshes the leaderboard fragment with the new row visible. |

---

## HTMX Interactions

| Trigger                     | Method | Endpoint                       | Target                    | Swap        | Indicator |
| ---------------------------- | ------ | -------------------------------- | -------------------------- | ----------- | --------- |
| Projects "Play now" card     | GET    | `/library-game`                  | `#main-content`            | `outerHTML` | `#nav-loading` |
| Leaderboard panel open/refresh | GET  | `/library-game/leaderboard`      | `#library-leaderboard`     | `innerHTML` | local     |
| Final Paycheck submit form   | POST   | `/library-game/score`            | `#library-leaderboard-panel` | `outerHTML` | local     |

Confirmation required for destructive actions:

* "Reset progress" (clears `localStorage` save) — same confirm-dialog
  convention as Kitchen Shift/Fishing Game.

---

## Routes / Handlers

| Method | Path                       | Handler                       | Auth required | Notes |
| ------ | --------------------------- | -------------------------------- | ------------- | ----- |
| GET    | `/library-game`              | `LibraryGameHandler.Index`       | no            | Sets `ContentTemplate: "library-game-content"`. |
| GET    | `/library-game/leaderboard`  | `LibraryGameHandler.Leaderboard`  | no            | Bare fragment. |
| POST   | `/library-game/score`        | `LibraryGameHandler.SubmitScore`  | no            | Rate-limited per-IP, mirrors `CookingGameHandler.SubmitScore`. |

Registered in `cmd/server/main.go`'s `newMux`, following the exact
Fishing/Cooking game registration pattern (handler + service + repository
wiring in `cmd/server/main.go`'s dependency construction).

---

## Data Model

```sql
-- migrations/005_create_library_scores.sql
```

| Table           | Column           | Type        | Constraints                                         | Notes |
| ---------------- | ---------------- | ----------- | ----------------------------------------------------- | ----- |
| library_scores   | id               | BIGINT      | GENERATED ALWAYS AS IDENTITY PRIMARY KEY              | |
| library_scores   | player_name      | TEXT        | NOT NULL, length 1–20                                 | |
| library_scores   | total_earnings   | INT         | NOT NULL, range 0–100000                              | Gard total across the run. |
| library_scores   | shifts_completed | INT         | NOT NULL, range 1–30                                  | Wider than `cooking_scores`' 1-20 since this game always runs 30 shifts. |
| library_scores   | created_at       | TIMESTAMPTZ | NOT NULL DEFAULT now()                                | |

Same "leaderboard only, no per-player server-side state" posture as
`cooking_scores`/`fishing_scores` — in-progress shift state, Gard, and
shelf/book layout live in `localStorage` (`library-game:v1` key), not
Postgres, per this doc's Security Considerations and every other game's
established precedent.

---

## Business Rules / Validation

* **Shift tiers**: Tier 1 (shifts 1-10), Tier 2 (11-20), Tier 3 (21-30) —
  each with its own shift-clock budget and Return Cart/fine volume,
  mirroring Kitchen Shift's round-tier shape (`SHIFTS_PER_MONTH = 30`,
  reused directly rather than picking a different number).
* **In-game clock, paced slower than Kitchen Shift's**: each shift covers
  an 8:00 AM–11:00 PM library day (15 in-game hours, same
  `inGameTimeLabel`-style formatting as Kitchen Shift's clock), but the
  user explicitly asked that time not "go so fast" — Kitchen Shift
  compresses its own full day into a 120-300s real-time shift clock,
  which reads as very fast. This game's real-time shift-clock budgets per
  tier must be long enough that the 15-hour day advances at a noticeably
  slower, more readable pace: **600s/480s/360s (10/8/6 real minutes)**
  for Tiers 1/2/3, not Kitchen Shift's 300s/180s/120s — still shrinking
  per tier for difficulty, just from a much higher floor. (Tunable at
  implementation time like everything else in this section, but must stay
  well above Kitchen Shift's numbers, not just copy them.)
* **Karen shift**: chosen once per save as `randomInt(10, 15)` at month
  start (a fresh "Start New Month" re-rolls it, same as any other
  per-month scripted state), stored in the `localStorage` save so it's
  stable across a page reload mid-run.
* **Book routing**: every book has a genre/shelf id; shelving at the wrong
  shelf either blocks the skill-check from starting (preferred, avoids a
  silent wrong-shelf mistake — mirrors Kitchen Shift's dish-must-match-
  order strictness) or counts as a mistake if forced through, deferred as
  an implementation-agent decision within this doc's spirit.
* **Coin Hunt frequency**: a configurable fraction of returned books (e.g.
  ~1 in 5) are Coin Hunt books, tuned by a named constant, not hardcoded
  inline — matching this codebase's convention of named, doc-referenced
  tuning constants (`SHIFT_PAYCHECK_FULL`, etc. in Kitchen Shift's
  `rules.js`).
* **Payout**: `shiftPaycheck(mistakeCount)` — a base amount minus a flat
  per-mistake penalty, floored above zero (never a hard game-over),
  matching Kitchen Shift's `shiftPaycheck` shape exactly; Coin Hunt finds
  and fines processed add on top rather than replacing the base.
* **Closing wait**: when the shift clock reaches 11:00 PM, the game enters
  a `closing-wait` phase (named alongside Kitchen Shift's own
  `closing-clean`/`closing-dishes` phase-naming convention) lasting
  exactly 20 real seconds; the Boss's Office station is non-interactive
  until that timer elapses, at which point it becomes enterable and
  walking in immediately triggers the paycheck (no further confirmation
  step) — "the boss will let you inside" once the wait is over, not
  before.
* **Library Mood**: `libraryMood` starts each shift at 100 and only
  moves down: −25 per mistake (`LIBRARY_MOOD_DRAIN_PER_MISTAKE`), −50 for
  letting Karen's fine slide (`KAREN_MOOD_PENALTY`). It never recovers
  within a shift. Since v2.3 it scales patron patience: each borrow
  request's patience is `borrowPatienceSeconds(shift) ×
  patienceMultiplierForLibraryMood(mood)` (1.0 at 100 mood, down to 0.6 at
  0), fixed when the patron arrives (`addBorrowRequest`), the same
  fold-in-at-spawn shape as Kitchen Shift's Reputation. It also drives the
  HUD status text (Calm > 70, Tense > 30, else Frustrated patrons). The
  Reading Nook (+20) is the only way to raise it mid-shift. **At 0 Mood**
  (v2.17), three penalties run:
  - **Pay cut:** −2% per full 10 s, capped at 30% (`moodPayMultiplier`,
    tracked in `zeroMoodSeconds`).
  - **Storm-outs:** every 20 s the queued patron with the least wait left
    storms out, a walk-out worth −1.5★. If nobody is in line, the next
    arrival storms out immediately.
  - **Complaint letters:** one every 30 s, each taking 25 Gard off the
    payout (`complaints`; the Gard counter shows the net, with a red
    "−25g" pop).

  The paycheck lists each penalty that applied.
* **Star rating** (v2.9): every shift starts at 5★ (`RATING_MAX`). Every
  queued patron, borrow and fine alike, has a wait timer:
  `queueWaitSecondsForShift` (90 s, shrinking to a 45 s floor), scaled by
  Library Mood at arrival. It shows as a bar under their name chip. A
  patron whose wait runs out walks out and costs 1.5★
  (`RATING_PENALTY_PER_WALKOUT`, toast "−1.5★"). So does a borrow patron
  whose search-phase patience runs out, on top of that case's existing
  mistake. Queue walk-outs are *not* mistakes. The rating, never below
  0★, multiplies the whole payout (base + bonuses): `rating ÷ 5`, so
  3.5★ = 70%. The paycheck screen shows "N★ rating (P% pay)". Shown on
  canvas as five half-fillable stars beside the Sanity/Mood bars. Mood is
  unchanged and separate.
* **Reading Nook** (v2.10): a 2nd-Floor station (480, 480). Arriving opens
  a page-turning minigame. Since v2.11 it shows a real short story (one
  of five in `library/stories.js`, 12 pages shown as 6 two-page spreads,
  `READING_PAGES`), read at your own pace. Each spread has a 2.5 s
  minimum (`READING_SECONDS_PER_PAGE`, an anti-skip floor shown as a slim
  bar). →/Space/Enter/click turns a page, and ← goes back a spread.
  Turning before the minimum only nudges.
  Finishing restores +20 Library Mood (`READING_MOOD_RESTORE`, clamped)
  and starts a 45 s cooldown (`READING_COOLDOWN_SECONDS`), shown in the
  station label ("Reading Nook (32s)"). The × button puts the book down
  with no reward and no cooldown. The shift clock and patron timers keep
  running while you read, which is the intended trade-off.
* **Hallucinations** (v2.16): below 25 Sanity (`HALLUCINATION_START_SANITY`)
  `hallucinationIntensity` rises from 0 to 1 at 0 Sanity.
  - **Scare visuals:** a pulsing dark vignette closing in, red-eyed shadow
    figures, drifting whispers ("overdue…", "turn around"), light
    flickers, screen shake above 0.6, and occasional jump scares at full
    intensity.
  - **Work penalties:** shaky hands (skill-check zone shrinks to 50% and
    the sweep speeds up to 1.6×); carried books can slip back onto the
    Return Cart (`dropCarriedBook`, 6%/s at full intensity); ghost
    patrons ("???") appear in the Front Desk line from 0.5 intensity, and
    walking up to one costs 5 Sanity (`startleFromHallucination`).
  - **Pay:** every full 10 s at 0 Sanity cuts the payout 2%, capped at
    30% (`hallucinationPayMultiplier`, tracked in `zeroSanitySeconds`;
    only the part of a tick after Sanity actually hits 0 counts). The
    paycheck shows "−N% for hallucinating".
  - **Coral's face:** the player's expression shifts with it (`opts.stress`
    on `drawLibraryPerson`): worried brows, a frown, smaller pupils, eye
    bags and a sweat drop, plus stray hairs near 0.
  - **Recovery:** restoring Sanity (coffee) ends everything.
* **Shelving incentives** (v2.18):
  - **Tip:** every shelved book tips +5 Gard (`SHELVED_BOOK_TIP_GARD`, on
    a successful Shelf Skill-Check or a finished Coin Hunt).
  - **Messy cart:** with more than 8 books waiting
    (`MESSY_CART_THRESHOLD`), Library Mood drains 0.25/s
    (`MESSY_CART_MOOD_DRAIN_PER_SECOND`), with a pulsing "Messy cart!"
    warning under the cart.
  - **Docked at closing:** books still on the cart or in hand when the
    shift clock runs out (`unshelvedAtClose`) cost 10 Gard each at payout
    (`UNSHELVED_BOOK_PENALTY_GARD`), listed on the paycheck.
* **Sanity/Coffee Machine**: Sanity drains passively and per-mistake
  exactly as Kitchen Shift's does (same constants, reused). Since v2.2,
  visiting the Coffee Machine opens the **Coffee Pour** minigame instead of
  refilling instantly: hold (mouse/touch, or Space/Enter) to pour and
  release inside a gold target band whose position varies per pour
  (62–86% full). Graded by `gradeCoffeePour`: perfect (in the band) adds
  100 Sanity plus a 10 Gard tip, good (within 10% of the band) +70, sloppy
  +40. Spilled (reaching the brim, which ends the pour automatically)
  originally gave +40, per the user's first choice of "graded, never
  zero"; since v2.19 it splashes you for **−50 Sanity** instead, with
  coffee stains steaming on Coral for 6 s. Still no cooldown or usage limit. The original instant full
  refill matched Kitchen Shift's Coffee Machine rule; the two games now
  differ here on purpose.
* **Fines are Gard-only**: the Fines Sort minigame's clutter never
  includes any other currency type as a "correct" pick — only coins and
  Gard bills count; other clutter items are decoys that do nothing if
  clicked (not penalized), keeping the minigame about finding the right
  items, not punishing exploration.
* **Find the Book decoys**: the Find the Book minigame's shelf scene
  includes several visually-similar wrong books (same shelf/genre color,
  different title) alongside the one correct match — clicking a wrong
  book is a miss (costs time/patience) but not an instant mistake,
  matching the Fines Sort minigame's "decoys do nothing punitive by
  themselves" posture; only running out of the patron's patience while
  searching counts as a mistake.

---

## Security Considerations

* **Authz**: `/library-game` and its leaderboard GET are unauthenticated,
  matching Fishing Game/Kitchen Shift. `POST /library-game/score` is
  rate-limited per-IP via a dedicated `scoreSubmitLimiter` instance (own
  limit/window, not shared with the other two games' limiters).
* **Input handling**: `player_name`/`total_earnings`/`shifts_completed`
  validated server-side against the same bounds as the DB CHECK
  constraints before insert (mirrors `internal/service/
  cooking_validation.go`'s pattern) — never trust client-submitted Gard
  totals beyond range-checking them.
* **No new secrets/config** introduced by this feature.

---

## Testing Plan

* [x] Go: handler tests for `/library-game`, `/library-game/leaderboard`,
      `/library-game/score` (happy path, validation-rejection path,
      rate-limit path) — mirrors `cooking_game_test.go`.
* [x] Go: `internal/service/library_validation_test.go` /
      `library_service_test.go` — mirrors the cooking-game equivalents.
* [x] Real-Postgres end-to-end subtest in `cmd/server/e2e_test.go` — round
      trip through the real `library_scores` table.
* [x] JS (`node --test`): shift-tier math, Karen-shift selection range
      (always 10-15), `shiftPaycheck` payout math, Coin Hunt frequency
      constant, Shelf Skill-Check pass/fail thresholds (`library/rules.test.js`,
      `library/engine-state.test.js`, `library/floor-plan.test.js` — 109
      pure game-logic tests plus the floor-plan geometry suite).
* [x] Playwright (`e2e/library-game.spec.js`): start screen → floor plan →
      shelve a normal book (Shelf Skill-Check) → shelve a Coin Hunt book →
      process a fine at the Fines Counter (Fines Sort) → fulfill a borrow
      request (Find the Book → Checkout Skill-Check) → full shift →
      payout screen → leaderboard submission round-trip; plus the
      HTMX-revisit regression class already known to bite every canvas
      game on this site (`docs/features/cooking-game.md`'s "Another real
      bug" note) — visiting `/library-game`, navigating away, and
      returning must still be fully interactive. Also covers the two-floor
      Stairs/Elevator/HUD-button switch (including mid-`closing-wait`) and
      both Karen outcomes. 17 tests, passing on both Chromium and WebKit.
      Real click-to-play coordinates come from `window.__libraryGameTestHooks`
      (see that file's header comment) rather than waiting out this game's
      600/480/360-real-second shift clocks or guessing at randomly-scattered
      item positions.
* [x] Manual verification in a real browser: a full click-driven shift
      (shelving, Coin Hunt, a fine, a borrow request, the Coffee Machine,
      a forced Karen event, closing-wait, payout) and dark mode, both with
      zero console errors.

---

## Open Questions

* Exact skill-check difficulty curve per tier, exact Coin Hunt frequency
  constant, and exact fine/Return Cart volume per tier are left as
  implementation-time tuning, same as Kitchen Shift's own recipe/gear
  magnitudes ("illustrative/tunable... nothing in that tuning blocks
  calling this Shipped"). **Landed values** (`web/static/js/library/
  rules.js`): `COIN_HUNT_FREQUENCY=0.2`, `ROUND_TIER_RETURN_VOLUME=[6,10,16]`,
  `ROUND_TIER_FINE_VOLUME=[4,6,9]`, `ROUND_TIER_BORROW_VOLUME=[5,8,12]` (both raised from [2,4,6] in v2.8),
  `ROUND_TIER_CLOCK_SECONDS=[600,480,360]` (per the "don't go so fast"
  request — deliberately far above Kitchen Shift's 300/180/120).
* **Resolved**: wrong-shelf attempts block the Shelf Skill-Check from
  starting at all (`arriveAtShelf`) rather than counting as a forced
  mistake — no silent wrong-shelf penalty is possible.
* **Resolved**: Karen's scripted beat — a forced, two-outcome event with a
  12-second timer (`KAREN_EVENT_TIMER_SECONDS`) firing once on her
  deterministically-seeded shift (`karenShiftForSeed`, stable per save,
  re-rolled on "Start New Month"). `collectFine` (handled well) banks
  `KAREN_FINE_AMOUNT_GARD` (60) with no cost; `letItSlide` (mishandled) —
  or letting her 12-second timer expire unresolved, which auto-resolves
  as `letItSlide` — counts as a mistake and drains `libraryMood` by
  `KAREN_MOOD_PENALTY` (50, double the normal per-mistake drain) plus the
  standard Sanity hit. See `engine-state.js`'s `startKarenEvent`/
  `resolveKarenEvent`.
* Failure semantics for the other minigames (landed, not left open): Shelf/
  Checkout Skill-Check and Fines Sort failures count a mistake but let the
  player retry immediately with the item still in hand; only a borrow
  request's search-phase patience timing out drops the request outright,
  matching this doc's "only running out of the patron's patience while
  searching counts as a mistake" Business Rule for Find the Book.

---

## Definition of Done

* [x] User flow works end-to-end, including edge cases above.
* [x] All states in the UI table are implemented.
* [x] Migration written, reviewed, includes a working `Down`.
* [x] Handler/service/repository boundaries followed (`go-backend`).
* [x] Accessibility checked: hovering a station and pressing Enter walks to
      it, same as Kitchen Shift's own click-only-plus-Enter posture; the
      shared Shelf/Checkout Skill-Check overlay also accepts Space/Enter as
      a non-pointer alternative to clicking. The two "search the scene"
      minigames (Coin Hunt, Fines Sort, Find the Book) remain pointer-only,
      matching Kitchen Shift's precedent that scene-search interactions
      need pointer precision ("where feasible" — a keyboard equivalent for
      *finding* a specific scattered item isn't).
* [x] Tests cover the behavior in the Testing Plan above.
* [x] `/library-game` added to the Projects grid with a real screenshot.
* [x] No open questions remain unresolved.
