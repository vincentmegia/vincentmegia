# Kitchen Shift — Customer Rules

> One of three rules docs split out of `docs/features/cooking-game.md`
> (with `cooking-game-food-server.md` and `cooking-game-kitchen.md`). This
> doc covers customers: arrival/patience ramp, Reputation, per-customer
> sanity, the named regulars and Karen, walk-ins, and the 0-Reputation
> penalties. Status, Testing Plan and the rest of the template live in the
> main doc.

## Startime Diner is card-only, no cash

Flavor about how the diner's *customers* pay for their meals, unrelated
to the player's own Gard paycheck from the boss (which is just how much
they're paid for the shift, not tied to any individual bill — see the
food-server doc's Shift paycheck rule). No gameplay mechanic hangs off
this; it may show up as ambient copy/UI (e.g. a card-reader prop at each
table) but never as a distinct interaction.

## Shift ramp

Customers arrive faster and are less patient as the month goes on.

**Arrival timing is jittered.** `customerArrivalIntervalSeconds` (14 s
easing toward 5 s over the month) is the average wait between arrivals;
`jitteredArrivalIntervalSeconds` multiplies it by a random factor in
`[0.6, 1.4]` (`ARRIVAL_INTERVAL_JITTER_MIN`/`_MAX`). `cooking-game.js`'s
`maybeSpawnCustomer` rolls a fresh wait each time the previous one
elapses, whether or not a customer could be seated. Tables are picked
uniformly from the tier's open, free tables (not ones a walking-in
customer or a ghost holds); the dish (or regular — see below) is picked
uniformly from the candidate list.

Patience (`customerPatienceSeconds`) eases from 45 s toward 20 s over the
month, +4 s per Regular's Patience level, then is scaled by Reputation
when the order is placed. Simultaneous orders are capped by
`tableCapacity` (round-tier base + Extra Table Service, capped by the
tier's open tables — leveling doc); customers walking in count toward it.

## Restaurant reputation

Modeled at the *restaurant* level: a shift-long `reputation` stat (`rules.js`'s `REPUTATION_MAX` = 100,
starts full every shift) that drains `REPUTATION_DRAIN_PER_MISTAKE` (25)
on every mistake — a missed order or a wrong-dish serve, see the
food-server doc's Wrong-dish serves rule — and nothing else; unlike
Sanity, reputation never drains passively.

`rules.js`'s `patienceMultiplierForReputation` (1.0 at full reputation,
linearly down to a 0.6 floor at zero — the same shape as
`walkSpeedMultiplierForSanity`) is applied once, at the moment *any*
order is taken, Karen and Mel included. So a mistake doesn't just cost
the mistaken table — it makes every customer seated *afterward*, for the
rest of that shift, more impatient than they'd otherwise have been,
functioning as an escalating chance of losing them before the player
even reaches their table. A bad review from one table sours the mood for
whoever walks in next. Reputation resets to full at the start of the
next shift, same as every other shift-scoped stat.

Displayed as an on-canvas bar (`drawReputationBar`, cooking-game.js)
directly below the Sanity bar it's visually paired with, same treatment
— and reflected in the paycheck screen's outcome line (food-server doc's
Shift paycheck rule).

## Per-customer sanity

Reputation (above) is restaurant-wide; this is the per-*order*
counterpart. Every order now carries its own `customerSanityRemaining`
(`engine-state.js`'s `Order` shape; `rules.js`'s `CUSTOMER_SANITY_MAX` =
100, starting full) — a *separate* stat from the time-based patience
countdown, tracking how many times this specific customer has had to
repeat themselves.

Two things "annoy" a customer, each draining
`CUSTOMER_SANITY_DRAIN_PER_ANNOYANCE` (25 — the same 4-hits-to-bottom-out
shape as reputation's own drain) via `engine-state.js`'s
`annoyCustomer(state, tableId)`:

* The food server re-visiting an already-ordered table before serving it
  (walking up without holding a dish) — a deliberate re-check that costs
  the customer's patience for being asked to repeat themselves.
* Serving the wrong dish — *additional* to that mistake's existing
  consequences (mistakeCount, player Sanity, Reputation, all unchanged —
  see above), not a replacement for them. A customer's own sanity hitting
  0 on a wrong serve is a second, separate consequence layered on top of
  the immediate one.

Either way, if sanity survives the hit, the order bubble re-shows their
dish (icon only) via `cooking-game.js`'s
`annoyCustomerAt` — the customer "repeats" their order — and a second
small on-canvas bar
(`#c9a0dc`, lavender, stacked just above the existing patience bar)
reflects the new `customerSanityRemaining` fraction. If it bottoms out,
`annoyCustomer` delegates straight to the existing `failOrderAt` — the
customer walks out exactly like a patience timeout does (order removed,
table freed dirty, `shiftUpset` latched, `mistakeCount`/player
Sanity/Reputation all drained), including the same Karen-ripple/Mel/
couple cleanup a time-based walkout already gets.

## Karen, Mel, and Olive & Oliver

Three named customers layered on top of the normal random-arrival pool
(`availableDishes`), none of whom ever come from that pool themselves:

* **Mel** (`MEL_DISH`, `"Mel's Usual"` — Lemonade, Star Cake, and Egg,
  station `none`). Sweet, kind, and caring; favorite color yellow,
  favorite flower a dandelion (both cosmetic). She gets
  `MEL_PATIENCE_BONUS_SECONDS` (15s) on top of the normal patience for
  that shift (itself already scaled by reputation above), and serving her
  correctly shows `MEL_THANK_YOU_LINE`. If she's mishandled (missed or
  served wrong), that's a normal `shiftUpset` latch/mistake like anyone
  else — no extra penalty; she's understanding, not vindictive.
* **Olive & Oliver** (`COUPLE_DISH`, `"Olive & Oliver's Order"` — Matcha
  and Cake, station `none`). An engaged couple sharing one table and one
  order, not two separate orders. Olive: brave, smart, neat, favorite
  color green (`OLIVE_FAVORITE_COLOR`), favorite flower tulips. Oliver:
  intelligent, brave, favorite color blue (`OLIVER_FAVORITE_COLOR`),
  favorite flower rose — his usual order is the same as his fiancée's,
  which is why they share `COUPLE_DISH` rather than each getting their
  own. No special patience/ripple mechanic; purely a recurring-cast/
  rendering distinction (drawn as two people at one table).

  **When Mel and the couple appear.** Each is guaranteed exactly once per
  shift at a random point: while not yet spawned, each is one entry in
  `maybeSpawnCustomer`'s candidate list, weighted the same as any single
  unlocked regular dish. The flags latch when they're picked, so they
  can't be drawn twice while walking in.
* **Karen** (`KAREN_SHIFT_NUMBERS` = [12, 18]) is not part of the spawn
  timer: on her shifts `spawnKarenIfDue` picks an open, unlocked table at
  shift start and she walks in from the entrance; her line shows the
  moment she's seated. Her order is a random dish from that shift's pool.
  Her patience is far shorter than a normal customer's (still scaled by
  Reputation). Served correctly, she tips (bonus Gard). Missed or served
  wrong, it's a normal mistake *plus* a ripple: one other active order,
  picked at random, is force-failed (`failOrderAt`, a second full
  mistake).

  Shift 18 is a rematch: she remembers you. `karenEncounter(shift)`
  returns that visit's line, patience and tip:

  | Visit | Line | Patience | Tip on a correct serve |
  |---|---|---|---|
  | Shift 12 | "HEY YOU THERE COME OVER HERE" | 12 s | 100g |
  | Shift 18 (rematch) | "YOU AGAIN?! I remember you. Do NOT mess this up this time." | 9 s | 250g |

  The tip goes to the shift's bonus Gard, paid at Duke's office, so it
  shows on the Gard counter. The ripple applies on both visits.
  She's drawn with the shared `karen` design and an angry red tint while
  seated (and while walking in for the rematch).

## Customers walk in from the entrance

Every newly picked customer (`maybeSpawnCustomer`, and Karen's
`spawnKarenIfDue`) walks in before being seated. `cooking-game.js`'s `arrivingCustomers` is
the mirror image of that existing `payingCustomers` system: a newly
picked customer now walks in from the same entrance/exit spot paying
customers walk *out* to (`INTRO_ENTRANCE_POSITION`, the Dining room's
door sprite), and only "materializes" as a real, interactable
`pendingCustomers` entry — the table starts drawing them seated
(`drawTableContents`), and `mel`/`couple`/`karen`'s "currently active"
tracking, patience, and (for Karen) her line all start — on arrival
(`updateArrivingCustomers`). `melSpawnedThisShift`/`coupleSpawnedThisShift`
still latch the moment they're *picked*, not on arrival — otherwise a
second spawn attempt could draw Mel again while her first pick is still
mid-walk. Counts toward the shift's capacity cap and reserves its table
the same way a `pendingCustomers` entry does, so a customer already
walking in can't be double-booked or push the shift over its concurrent-
order limit before they've technically "arrived." Drawn with the same
`resolveObstacleCollisions` visual-avoidance treatment `payingCustomers`
gets (kitchen rules doc's Collision avoidance section) — an arriving
customer won't visually walk through the player, a station, or another
character either, sharing the exact same `drawCustomerFigure` appearance
logic (mel/couple/karen/regular) so they look identical whichever
direction they're walking.

## Security guard

A stationary figure near the entrance/counter — "there's security to
protect the place." Cosmetic only: not a `floor-plan.js` station, no
click target, no interaction, no effect on Karen or anyone else. Present
every shift, unconditionally.

## Penalties at 0 Reputation

Ported from Library Shift's 0-Mood penalties (`rules.js` section 14;
`engine-state.js`'s `tick`). Before v4, 0 Reputation only meant shorter
patience. Now, while it sits at 0:

* **Storm-outs**: every `ZERO_REPUTATION_STORM_OUT_SECONDS` (20 s), the
  customer with the least patience left walks out. That is a full mistake,
  exactly like a timeout (`stormOuts` counts them). With nobody waiting,
  the timer holds, so the next order taken storms out right away.
* **Complaint letters**: one every `COMPLAINT_INTERVAL_SECONDS` (30 s),
  each docking `COMPLAINT_GARD` (25g). The Gard counter drops live.
* **Pay cut**: −2% per full 10 s spent at 0, capped at −30%
  (`reputationPayMultiplier`).

A toast announces each storm-out and letter. The paycheck line itemizes
them too.

## Mel's look

Redesigned in v4.1:
* A yellow sundress with a white sash and a white-daisy print.
* Long honey-brown hair tied with her white ribbon, plus her yellow hair
  clip.
* A dandelion tucked behind her ear.
* White tights and shoes.

It's drawn by `cooking-game.js`'s `drawMel`, on top of the shared
`dress` outfit in `shared/people.js`.

---

## History

Earlier text from this doc, kept verbatim.

### Shift ramp — v3.34 jitter narrative

**Arrival timing is jittered, not metronomic (v3.34)** — the user asked to
"enhance randomization of the customers... make it random so it makes the
game mechanics better." `rules.js`'s `customerArrivalIntervalSeconds`
(the ramp above) was always a single exact value, consumed as an
unvarying wait every time — a given shift sat customers on a perfectly
regular beat, identical on every replay. `jitteredArrivalIntervalSeconds`
widens that into a multiplicative `[0.6, 1.4]` range around it
(`ARRIVAL_INTERVAL_JITTER_MIN`/`_MAX`), so consecutive arrivals land in
bursts and lulls instead — sometimes two customers close together,
sometimes a longer gap — without changing the *average* pace a shift
ramps toward (the pre-existing doc comment already called the base value
an "average"; this makes that literally true). `cooking-game.js`'s
`maybeSpawnCustomer` re-rolls a fresh jittered wait
(`nextCustomerArrivalSeconds`) every time the previous one elapses —
whether or not a customer actually ends up spawning that cycle (a full
table/no-room rejection already restarted the whole wait before this
existed; that's preserved, just with a freshly jittered length now) —
never mid-countdown, so the wait an in-progress countdown is aiming for
never changes out from under it. Table selection among open tables and
dish selection among unlocked dishes were already uniformly random before
this and are unchanged. At the time this shipped, Mel/Olive & Oliver's
guaranteed first-two-customers-of-the-shift slot was still deliberately
untouched — but the user reported that gap immediately ("first customer
is still the same"), and v3.35 (below, Karen/Mel/Olive & Oliver section)
randomized *when* they appear too, right after this. Karen's fixed
shift-12 trigger remains unchanged by either version.

### Karen — original shift-12-only bullet

* **Karen** (`KAREN_SHIFT_NUMBER` = 12, one of the "12 or 18" the user
  offered — picked to keep this a single well-defined trigger) appears
  once, immediately at shift start, on that one shift only — not part of
  the normal spawn timer. Her line (`KAREN_LINE`, shown the moment she's
  seated): "HEY YOU THERE COME OVER HERE." Much shorter patience
  (`KAREN_PATIENCE_SECONDS` = 12s, itself already scaled by reputation
  above) than a normal customer at that shift. If her order isn't served
  correctly in time (missed or wrong dish), that's a normal `shiftUpset`
  latch/mistake *plus* a ripple effect: one other currently-active order
  (picked at random, if any exist) is force-failed too
  (`engine-state.js`'s `failOrderAt`, itself a second full mistake —
  reputation/Gard both take the hit twice) — she's rude enough to sour
  the mood for someone else, literally. Served correctly, no ripple,
  business as usual.

### Mel / Olive & Oliver — v3.35 timing narrative

  **v3.35: appearance timing is randomized, not fixed slots.** Before
  this, Mel was unconditionally the literal first customer seated every
  single shift, and the couple unconditionally the second, before the
  random pool ever got a turn — the user reported this directly ("first
  customer is still the same") after v3.34's arrival-*timing* jitter
  didn't touch *who* arrived first. `maybeSpawnCustomer` now builds one
  flat candidate list per spawn attempt — Mel (if not yet spawned this
  shift) and the couple (ditto) each get exactly one entry, the same
  weight as any single currently-unlocked regular dish — and draws one
  random pick from it. They're still guaranteed to appear exactly once
  per shift (still a candidate on every later attempt until picked,
  same as before), only *when* within the shift is now random rather
  than forced into the first two slots — mirroring how v3.34 randomized
  the *timing between* arrivals without changing the average pace. Their
  own dish stays fixed to their signature order (`MEL_DISH`/
  `COUPLE_DISH`) — "usual" stays usual; only which slot they land in,
  and (unchanged, already random before this) which table and which
  *regular* dish gets picked, are randomized.
