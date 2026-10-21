# Kitchen Shift — Food Server Rules

> One of three rules docs split out of `docs/features/cooking-game.md`
> (with `cooking-game-customer.md` and `cooking-game-kitchen.md`); round
> tiers live in `cooking-game-food-server-leveling.md`. This doc covers the
> player's job: taking orders, serving them (correctly or not) and what
> that costs, Sanity, gear, closing up, and getting paid. Status, Testing
> Plan and the rest of the template live in the main doc. Rules are in
> `web/static/js/cooking/rules.js` and `engine-state.js`; the game loop is
> `web/static/js/cooking-game.js`.

## Shift payout

Paid when the player walks into Duke's office, which opens the moment the
shift clock ends (11:30 PM). `engine-state.js`'s `shiftPayout(state)`:

```
base   = shiftPaycheck(mistakeCount)            // 4,000 − 500 × mistakes, floored at 500
gross  = max(0, base + bonusGard − complaints × 25 − skippedChores.gard)
payout = round(gross × hallucinationPayMultiplier(zeroSanitySeconds)
                     × reputationPayMultiplier(zeroReputationSeconds))
```

* **Base** (`rules.js` §4): `SHIFT_PAYCHECK_FULL` (4,000) minus
  `SHIFT_PAYCHECK_PENALTY_PER_MISTAKE` (500) per mistake, floored at
  `SHIFT_PAYCHECK_MIN` (500). A mistake is a missed order (patience ran
  out, the clock ran out with it still queued, a 0-Reputation storm-out,
  or a customer walking out after four annoyances) or a wrong-dish serve.
* **Bonus Gard**: Karen's tip (100g, or 250g on her shift-18 rematch) and
  10g per perfect Coffee Pour.
* **Complaint letters**: 25g each while Reputation sits at 0 (customer doc).
* **Skipped closing chores** (`skippedChores`, `rules.js` §16): 50g per
  dirty table, 150g for unwashed dishes (only if there were any), 100g for
  not shutting down at the Counter.
* **Pay cuts**: −2% per full 10 s spent at 0 Sanity and, separately, at 0
  Reputation, each capped at −30%.

The paycheck screen's outcome line itemizes each part (mistakes, bonus,
skipped chores, complaint letters, both pay cuts). `shiftUpset` (a boolean
that latches on any mistake) still drives the HUD's "Going well"/upset
status and the paycheck screen's `data-outcome`.

Counter payments (below) are credited to the month total as each customer
pays, separately from this payout.

## Counter payment animation

Every correctly served customer gets a cosmetic walk-out, independent of
the table (which is freed the instant they're served).
`cooking-game.js`'s `spawnPayingCustomer` pushes onto `payingCustomers`;
`updatePayingCustomers` walks each through `eating` (2.5–5.5 s, random per
customer; `drawEatingAnimation` bobs the dish icon by their head),
`walking` to a standoff point just outside the Counter, `paying`
(0.8–1.8 s, picked on arrival), then `leaving` toward the entrance, at
`PAYING_CUSTOMER_WALK_SPEED` (130 px/s). The figure matches who sat there
(`drawCustomerFigure`: Mel, Karen, Olive & Oliver as a pair, or the
regular's own look).

When `paying` completes, `COUNTER_PAYMENT_GARD` (50) is added to
`save.monthToDateGard` and persisted immediately.

## Wrong-dish serves and missed orders

A wrong dish is wasted ("That's not their order — Table N wanted …"), the
order stays open, and it counts as a mistake: `mistakeCount` +1,
`shiftUpset` latches, player Sanity −15, Reputation −25, and the customer
is annoyed once (customer doc). A missed order frees the table, marks it
dirty and is the same kind of mistake. Neither ends the shift or the month
early — there is no game-over.

## Taking an order: the order pad

Walking up to a waiting customer opens an on-canvas pad instead of taking
the order on the spot:

* The customer states their order in a speech bubble (icon only).
* The pad offers `ORDER_PAD_CHOICE_COUNT` (4) dishes: the right one plus
  decoys from this shift's dishes (`orderPadChoices`).
* Picking the right one (click/tap, or keys 1–4) places the order with its
  patience timer and order bubble.
* Each wrong pick is crossed out and becomes one customer-sanity annoyance
  when the order is placed; four and they walk out (a mistake).
* The ✕, clicking off the pad, or Escape leaves without ordering. The ✕
  exists because Safari spends Escape on leaving fullscreen.
* The player can't walk while the pad is open; the clock keeps running.
* Arriving when already at order capacity says "Too many open orders".

Written orders appear as tickets on the side order notepad
(`#cooking-order-notepad`) with table, dish icon/name, who it's for and a
live patience bar; clicking a ticket makes it the active order.

## Trash Bins

One per room (`trash-dining`, `trash-kitchen` in `floor-plan.js`).
Arriving throws away everything on the tray — a finished dish or loose
ingredients — but never cookware (`useTrashBin`). Works in any phase.

## In-game clock

The shift's real-time countdown is `shiftClockSecondsForShift(shift)` —
300/180/120 s by round tier (leveling doc). The HUD shows it as a time of
day, 8:30 AM to 11:30 PM (`inGameTimeLabel`, a linear map that takes the
tier's total as its second argument).

## Closing chores (any order)

When the clock ends, any orders still queued fail, and the shift enters
closing. Three optional chores can be done **in any order**
(`engine-state.js`'s `cleanTable`, `washDishes`, `shutDown`):

* clean each dirty table (Dining; a short timer on arrival, faster with
  Quick Clean; walking away cancels it);
* wash the dish stack at the Cleaning Closet (Kitchen);
* shut down at the Counter (Dining).

Duke's office opens at 11:30 PM regardless, and walking in pays at once,
docking whatever chores are still undone (Shift payout above). Shutting
down moves the shift to `paycheck`, after which tables and dishes can no
longer be done — so shut down last if you want the other chores credited.
A toast at 11:30 PM lists the chores; shutting down with chores left says
what Duke will dock. An idle shift with no dirty tables skips straight
past table cleaning. Room switching works in every phase, so every chore
is reachable.

## Gear upgrades

`GEAR_DEFS` in `cooking-game.js`; cost is
`round(baseCost × costGrowth ^ currentLevel)`. Levels persist across
months in `localStorage`.

| Gear | Levels | Effect per level |
|---|---|---|
| Running Shoes | 5 | +15% walking speed |
| Bigger Tray | 5 | +1 tray slot (base 3) |
| Sharp Knife | 5 | Cook success zone +0.03 wide (base 0.16, max 0.40) |
| Extra Table Service | 8 | +3 simultaneous orders, capped by the tier's open tables |
| Regular's Patience | 5 | +4 s customer patience |
| Quick Clean | 5 | −0.2 s per table clean (base 1.5 s, floor 0.4 s) |

Every upgrade helps avoid mistakes or speed up closing; none raises the
pay per dish. The base order capacity and the number of open tables come
from the round tier (leveling doc).

## Sanity and the Coffee Machine

`SANITY_MAX` = 100, full at every shift start, drawn on-canvas top-left.
It drains passively (`SANITY_DRAIN_PER_SECOND` = 100/150 per second) and
by `SANITY_DRAIN_PER_UPSET` (15) on every mistake.
`walkSpeedMultiplierForSanity` slows walking linearly to 0.6× at 0. The
Coffee Machine (Dining, bottom-left) opens the Coffee Pour.

## Coffee Pour

Ported from Library Shift (`rules.js` §12). Hold the mouse/touch, Space or
Enter to pour; the cup reaches the brim in 2.2 s. Release inside the gold
band, drawn at a random height each time (`coffeePourTargetBand`).
`gradeCoffeePour`, applied by `brewCoffee`:

| Grade | When | Sanity | Extra |
|---|---|---|---|
| Perfect | inside the band | to full | +10g bonus Gard |
| Good | within 0.1 of the band | +70 | |
| Sloppy | elsewhere | +40 | |
| Spilled | held to the brim | −50 | coffee stains on the player for 6 s |

The player can't walk while the overlay is open; it closes 1.2 s after the
result.

## Hallucinations

Ported from Library Shift (`rules.js` §13). `hallucinationIntensity` is 0
at 25+ Sanity, rising to 1 at 0. Below 25: the player's face turns
worried; shadow figures, whispers, a purple vignette and flickers; ghost
customers sit at empty tables (walking up to one costs −5 Sanity, not a
mistake, and real customers aren't seated there); shaky hands shrink the
cook zone to as little as half and speed the sweep up to 1.6×, and the
player may drop the held dish or an ingredient
(`CARRY_DROP_CHANCE_PER_SECOND`). Above 60% intensity the room shakes. At
0 Sanity there are jump scares and the 0-Sanity pay cut. Everything stops
once Sanity is back to 25.

## Gard counter

A HUD pill beside the Sanity/Reputation bars shows this shift's Gard so
far (Counter payments + bonus Gard − complaint letters) and the month
total, with a floating "+N g"/"−N g" on each change. The base paycheck
isn't shown until Duke's office.

## Mid-month resume

Month-to-date Gard, the current shift number, gear levels, best month and
`hasSeenIntro` persist in `localStorage` (`cooking-game:v2`). An
in-progress shift (orders, tray, cookware, tables, Sanity, Reputation,
mistakes, which regulars have appeared) does not: reloading mid-shift
restarts that shift from its beginning. Counter payments already credited
during the abandoned shift stay credited.

## Leaderboard

Top 20 by `total_earnings`, descending (`cookingLeaderboardLimit`).
Submission is optional and only offered on the Final Paycheck screen
after shift 30. It submits `save.monthToDateGard` — the month's Gard
minus anything spent in the shop — and `shifts_completed` = 30.

---

## History

Earlier text from this doc, kept verbatim. It describes superseded
behavior (strictly ordered closing chores, the pre-v4 paycheck formula,
the old renderer names).

### Shift paycheck (v3.11 — final, not illustrative)

A shift's Gard payout starts at `SHIFT_PAYCHECK_FULL` (4,000) and loses
`SHIFT_PAYCHECK_PENALTY_PER_MISTAKE` (500) for every mistake that
shift — a missed order (patience expired) or a wrong-dish serve — floored
at `SHIFT_PAYCHECK_MIN` (500) so a shift always pays *something*,
matching this game's "never a hard game-over" design. `rules.js`'s
`shiftPaycheck(mistakeCount)` computes it directly from
`shiftState.mistakeCount`, a running count kept alongside the older
`shiftUpset` boolean (which still just latches `true`/`false` and drives
the paycheck screen's ok/upset UI state).

This replaces the original flat "4,000 unless anything went wrong, then
2,000" split, which was a single binary outcome per shift — one upset
customer cost exactly as much as five, a deliberately simpler economy
than the Fishing Game's points-and-multipliers scoring. The user asked
for wrong-dish serves to "deduct negative points" directly, which
reverses that on purpose: every mistake now visibly costs Gard. See the
customer doc's Restaurant reputation rule for the other half of this
change — mistakes don't just cost money, they make every later customer
that shift harder to keep happy too.

### Counter payment animation (v3.28, eating step added v3.29)

Every *correctly* served customer (matched dish, `serveDish` in
`engine-state.js`) triggers a short cosmetic sequence, independent of the
table itself — the table is already freed the instant they're served, same
as before this existed. `cooking-game.js`'s `spawnPayingCustomer` pushes an
entry onto `payingCustomers`; each frame, `updatePayingCustomers` walks it
through four phases at `PAYING_CUSTOMER_WALK_SPEED` (130px/s): `eating` (a
randomized pause at the table, see below), `walking` from the table to the
Counter station, `paying` (a randomized pause once they arrive), then
`leaving` toward the same entrance/exit spot the one-time walk-in intro
uses. The figure drawn matches whoever was actually seated there (Mel,
Karen, Olive & Oliver as a pair, or a generic customer) via an `appearance`
tag captured at spawn time, reusing the same `drawMel`/`drawPixelPerson`
calls `drawTableContents` already used to draw them at the table.

While `eating`, `drawEatingAnimation` bobs the served dish's own icon
(`drawDishIcon` — the same icon shown in the order bubble and on the
player's tray, per this project's no-image-assets convention) beside the
customer's head at roughly mouth height, once per simulated "bite"
(~0.6s/cycle) — a small, mostly-stationary bob reads better on a ~50px-tall
figure than a long plate-to-mouth travel would.

v3.29: both the `eating` duration (`CUSTOMER_EATING_SECONDS_MIN`/`_MAX`,
2.5–5.5s) and the `paying` duration
(`PAYING_CUSTOMER_TRANSACTION_SECONDS_MIN`/`_MAX`, 0.8–1.8s) are randomized
per customer via a shared `randomBetween(min, max)` helper — the eating
duration is picked once at spawn time, the paying duration lazily on
arrival at the Counter (picking it at spawn would go stale sitting through
a variable-length `eating` phase first). This is purely a timing/feel
choice — several customers served close together visibly eat, pay, and
leave at different moments instead of in lockstep — and has no effect on
`COUNTER_PAYMENT_GARD` or `shiftPaycheck()`, both still exact and
unrandomized.

The moment the `paying` phase completes, `rules.js`'s
`COUNTER_PAYMENT_GARD` (50) is added to `save.monthToDateGard` and
persisted immediately — **additive on top of, not a replacement for**, the
unchanged end-of-shift `shiftPaycheck()` lump sum above. This is
deliberately small relative to that 500–4,000 range: it gives a per-customer
sense of progress toward shop upgrades (`GEAR_DEFS`, costs starting around
200–400 Gard) without shifting where a shift's earnings actually come from,
and without touching the `cooking_scores` leaderboard's `total_earnings`
bound (still 150,000 — see the main doc's Data Model — which already
carried ~25% headroom above the pure lump-sum max before this existed).

### Closing sequence order is enforced (superseded by v4.7/v4.8)

Matching the explicit clean → wash dishes → shut down → get paid order
from the feature request, not a cosmetic sequence the player could skip
or reorder: the cleaning closet isn't clickable until every table is
clean, the front counter isn't clickable until the cleaning closet's
dirty-dish stack (one dish per serve — successful, wrong, or missed
doesn't matter, a dish or pan still got used — accumulated that shift) is
fully washed, and the boss's office door isn't clickable until shutdown
is complete.

### Gear upgrades (pre-rewrite intro)

(illustrative costs/magnitudes, same "tune during build" status as the
kitchen doc's recipe table), 5 levels each unless noted, cost curve
`round(baseCost × costGrowth ^ currentLevel)`. Every upgrade here targets
avoiding a mistake or getting through closing faster — there's no "earn
more Gard per dish" upgrade, since a shift's payout is governed entirely
by mistake count (Shift paycheck rule above), not by how well any single
dish was served:

**Shipped (v3.14, "round tiers")**: separate from this Gard-purchased
gear, the *base* simultaneous-order capacity Extra Table Service adds on
top of, and how many of the dining room's 30 tables are open at all, are
gated together by which of the month's three round tiers the current
shift falls in — a fresh month starts with just one table open and one
order at a time (Tier 1, shifts 1–10), building up to the full 30-table,
5-capacity baseline by Tier 3 (shifts 21–30), then resetting back to
Tier 1 on the next "Start New Month." See
`cooking-game-food-server-leveling.md` for the full design.

### Sanity and the Coffee Machine (pre-v4 note)

A Coffee Machine station (near the front counter) restores it. Before v4
that was instant on arrival; v4 replaced it with the Coffee Pour minigame
below. Before v4, Sanity had no effect on pay. v4's hallucinations (below)
add a pay cut for time spent at 0.

### Shift payout (v4)

`engine-state.js`'s `shiftPayout`, Library Shift's formula:

```
gross  = max(0, shiftPaycheck(mistakes) + bonusGard − complaints × 25)
payout = round(gross × hallucinationPayMultiplier × reputationPayMultiplier)
```

The paycheck outcome line itemizes each part: bonus, complaint letters,
and the two pay cuts. Counter payments are still credited the moment
each customer pays, as before.

### Leaderboard (pre-v3.14)

Top N (e.g. 20) by `total_earnings`, descending; submission is optional
and only offered on the Final Paycheck screen (shift 20), never
automatic, never mid-month.
