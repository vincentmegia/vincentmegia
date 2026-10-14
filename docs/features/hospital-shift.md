# Feature: Hospital Shift

## Status

`Shipped` — implemented and covered by tests. JS: the pure modules in
`web/static/js/hospital/` (133 `node --test` tests); `web/static/js/
hospital-game.js` wires them to the canvas. Go: handler/service/validation
tests plus a real-Postgres round trip in `cmd/server/e2e_test.go`.
Playwright: `e2e/hospital-shift.spec.js` (34 tests, Chromium + WebKit),
driving the real click/key paths with coordinates from
`window.__hospitalShiftTestHooks`. Manually checked with screenshots of a
full shift (every minigame, Karen, coffee, hallucinations, handover) with
zero console errors. `/projects` card uses a real screenshot
(`web/static/images/hospital/screenshot.png`).

Additions made during the build, beyond the original scope list: an ×
button (and Escape) backs out of any minigame without a mistake
(`cancelTask`), since a Red patient can arrive while you're mid-bandage;
the Med Cabinet always shows the ordered drug's look-alikes (Amoxicillin/
Amoxapine, Albuterol/Atenolol, Epinephrine/Ephedrine…), and is now a
search across 27 bottles with a skill check to give the meds at the bed.

## Summary

A fourth "Shift" canvas mini-game, `/hospital-shift`, sibling to Kitchen
Shift and Library Shift: the player is an ER nurse working 30 shifts —
triaging arriving patients, then treating them in the ward's beds through
patient-care minigames (Vitals Check, Oxygen, IV, Bandage, Meds Dispensing,
Surgery), earning **Gard** (the site's shared game currency).

## Problem / Motivation

The user asked for a new project, "hospital shift." When asked, they chose:

* **Role:** ER nurse — triage the queue, assign beds, treat patients.
* **Structure:** mirror Library Shift — canvas top-down map, click-to-move,
  timed shift, minigame overlays, Sanity + Coffee Machine, hallucinations,
  a scripted difficult-visitor event, Postgres leaderboard, `localStorage`
  progress, shared `people.js` art. (Progress was later made per-visit —
  see "Progress resets on leaving".)
* **Minigames:** all four offered (Triage sort, Meds dispensing, Vitals
  check, Bandage/IV), plus, in their words: "for the vitals checks and the
  stuff that pumps oxygen and surgeries i want there to be skill checks
  when they did it." So Vitals, Oxygen (bag-valve pumping) and Surgery
  started as timing-bar **skill checks**; Oxygen later became a
  find-the-hearts search where skulls stand for missed checks (see Scope).

## Scope

**In scope (v1):**

* `GET /hospital-shift` page + canvas game shell (960×600), click-to-move on
  two floors (see below), same architecture as Library Shift: pure DOM-free
  logic modules (`web/static/js/hospital/{rules,engine-state,floor-plan}.js`,
  `node --test`-covered) driven by one canvas engine
  (`web/static/js/hospital-game.js`).
* **30 shifts** in three 10-shift tiers. The shift clock runs 7:00 AM →
  7:00 PM over 600/480/360 real seconds (same slow pace as Library Shift),
  and patient volume grows each tier.
* **Triage**: patients queue at the Triage Desk with a wait timer. Click
  one → walk to the desk → **Triage Sort**: read their complaint and
  vitals (HR, BP, SpO₂, temperature) and pick Red / Yellow / Green.
  Correct or not, the patient is then put in a free bed (a wrong call is a
  mistake). No free bed → the desk says so and the patient keeps waiting.
* **Beds** (4): each bedded patient has an ordered treatment plan from
  their condition, shows the current step as a chip over the bed, and has a
  treatment-patience bar (shorter for Red). Running out = the patient is
  transferred to another hospital: a mistake and −1.5★.
* **Treatments** (each step is one minigame):
  * **Vitals Check** (skill check, 1 hit) — stop the marker on the
    heartbeat in the gold zone of an ECG strip.
  * **Oxygen** (find the hearts) — hearts and skulls bob around the
    scene beside the patient's bag-valve mask. Each heart clicked is one
    good pump (three finish it); a skull is a missed skill check — a
    mistake — and fades out so one slip can't cost twice. Changed from a
    3-hit timing bar at the user's request ("make it find hearts and
    there will be skulls that symbol missed skill checks"). Later restyled
    when the user asked to "make it better": the patient lies in bed
    under an SpO₂ monitor that climbs from their reading (≤ 88%, alarm
    blinking) to 98% as pumps land; a ribbed bag-valve mask with a gloved
    hand, reservoir bag and O₂ line squeezes and puffs air into the mask;
    the search field is a deep-teal airway with drifting bubbles, glowing
    hearts that burst into "+O₂", and skulls that shake when hit.
  * **IV** (skill check, 1 hit, narrower) — the needle sways over the arm;
    tap when it's over the vein.
  * **Surgery** (skill check, 3 stages: Incision → Repair → Sutures,
    narrowest zone) — the patient must first be wheeled from their bed to
    the Operating Room (the player carries the gurney), then operated on
    there; afterwards they return to their bed.
  * **Bandage** (precision trace) — needs a **bandage roll** from the
    Supply Cart upstairs in your pocket (without one the bed says where to get
    it, and its chip reads "Bandage (roll: 2F)"); then hold and trace the
    dashed line along the wound, graded on coverage and accuracy. A
    finished dressing uses up the roll; a botched one or backing out
    keeps it. Any patient's Bandage step can use any roll.
  * **Meds** (search + skill check) — the Med Cabinet is a **search**:
    three shelves of 27 small, slightly jumbled bottles, mostly look-alikes
    (`medCabinetStock`: the ordered drug exactly once, every look-alike at
    least once, ~35% of the rest look-alikes). Find the ordered bottle (a
    wrong one is a mistake and greys out so it can't cost twice), pick the
    dose, carry it to the patient's bed — where **giving** it is a 1-hit
    skill check (`SKILL_CHECKS.meds`, zone 0.18: push the syringe when it
    lines up with the IV port). The meds stay in your hands until that
    check passes, so backing out keeps them. Both added at the user's
    request: "when you get the meds you need to search for the med and when
    you go and get it to the patient you have to do a skill check".
  * A missed skill check, failed trace, or wrong drug/dose is a mistake;
    the minigame stays open for an immediate retry (Library Shift's
    retry-on-failure).
  * Finishing a step tips +5 Gard; finishing the last step discharges the
    patient for a Red/Yellow/Green bonus (60/40/25 Gard) and frees the bed.
* **Karen** (the scripted difficult visitor): once per run, on shift 2
  (rolled from 10–15 until the user asked for shift 2), an angry relative
  storms the Triage Desk demanding her
  mother be seen first. "Explain Triage" (+30 Gard) or "Let Her Cut In" (a
  mistake and −50 Ward Mood); a 12 s timer auto-resolves as the latter.
* **Mel — the easter egg** (the user: "the easter egg is mel in a kimono",
  then "add all" when offered four ways to find her). Kitchen Shift's Mel
  (`cooking-game.js`'s `drawMel`: honey-brown hair, white ribbon, yellow
  clip, a dandelion behind her ear, creamy yellow and white) visits in a
  cream kimono with a `dandelion` print and a white obi —
  `STAFF_DESIGNS.mel` in `anime-people.js`, with a single `bow` added
  for her. At most once per shift she
  joins the front of the triage line ("Mel ✿"), by any of four triggers:
  * a rare arrival — each arriving patient has a `MEL_ARRIVAL_CHANCE`
    (1/40) roll to bring her along;
  * always on `MEL_FIXED_SHIFT` (7), halfway through the clock;
  * `MEL_VASE_CLICKS` (5) clicks on the little dandelion vase on the ER's
    back wall (between the clock and the EMERGENCY sign; it only wiggles,
    giving nothing else away, and clicking it doesn't walk you there);
  * typing `MEL_SECRET_CODE` ("mel") during a shift with no overlay open
    (`typeSecretCodeKey`; any non-letter key resets it).

  Click her (or the desk) → walk to the Triage Desk → her overlay: Mel
  holds out a hand-drawn card (a crayon dandelion and sun, one of
  `MEL_CARD_LINES`, cycling per shift). "Thank you, Mel!", Enter/Space,
  Escape or × all accept it: +`MEL_GIFT_GARD` (40) Gard, +30 Sanity,
  +20 Ward Mood (engine-state's `melArrives`/`visitMel`; never a mistake).
  Finding her sets `foundMel`, which shows a
  "✿ You found Mel in her kimono" badge (`#hospital-mel-badge`) on the
  start screen for the rest of the visit. She doesn't time out; if the shift ends first she's gone.
* **Nurse career rank** (the user: "add levels", then chose a career rank
  over hospital stages, more severity levels or a level select). XP is
  earned every shift — +5 per correct triage call, +5 per treatment step
  you finish, +25/15/10 per Red/Yellow/Green discharge, +10 for calming
  Karen, +5 for Mel's visit (`rules.js` §3c `XP_*`; tracked as
  engine-state's `xp`) — and banked into `save.careerXp` at handover, and
  also on a game over (what you learned before collapsing still counts).
  Career XP carries across months within a visit (Start New Month keeps
  it), but leaving the page resets it with everything else. Ten ranks
  (`NURSE_RANKS`), each from 2 up unlocking a perk; a later perk of the
  same kind replaces the earlier one (`perksForRank`):

  | Lv | Rank | XP | Perk |
  | -- | ---- | -- | ---- |
  | 1 | Student Nurse | 0 | — |
  | 2 | Nursing Intern | 100 | Comfy Shoes: walk +10% |
  | 3 | Junior Nurse | 300 | Steady Hands: skill-check zones +15% |
  | 4 | Staff Nurse | 600 | Bedside Manner: patient patience +10% |
  | 5 | Senior Nurse | 1000 | Second Wind: Sanity drains 15% slower |
  | 6 | Triage Specialist | 1600 | Running Shoes: walk +20% |
  | 7 | Trauma Nurse | 2400 | Surgeon's Hands: skill-check zones +30% |
  | 8 | Nurse Practitioner | 3400 | Pay Raise: paychecks +10% |
  | 9 | Head Nurse | 4700 | Reassuring Presence: patience +20% |
  | 10 | Charge Nurse | 6200 | Charge Nurse Pay: paychecks +25% |

  Perks are fixed for the whole shift: they're set from the banked rank at
  shift start (engine-state's `perks` — patience, Sanity drain, pay;
  hospital-game.js applies walk speed and skill-check zones). Ranking up
  mid-shift shows a toast right away, but the perk starts next shift. The
  rank shows in the HUD ("Lv 3", full title on hover), in a live XP bar
  under the Gard counter, on the start screen's rank card (progress to the
  next rank, perks so far) and on the paycheck's Career row with any
  promotion. The bar's width is set from JS — the site CSP blocks inline
  `style` attributes.
* **Ward Mood** (Library Mood's analog): starts at 100, −25 per mistake,
  raised by coffee (below),
  scales new patients' wait and treatment patience (×1.0 → ×0.6), drives
  the HUD status (Calm / Busy / Chaotic).
* **Sanity + Coffee Machine**: Sanity drains passively and −15 per mistake,
  slowing the walk; the break room's Coffee Machine opens Library Shift's
  **Coffee Pour** — machine art and pour screen copied verbatim from
  Library Shift (perfect +100 Sanity & 10 Gard tip, good +70, sloppy +40,
  spilled −50 and a coffee stain). Unlike Library Shift, coffee also lifts
  **Ward Mood** (`COFFEE_MOOD_RESTORE`: perfect +20, good +12, sloppy +6,
  spilled 0) — the user asked for "the coffee also improve the mood".
* **Hallucinations** below 25 Sanity (Library Shift's v2.16 system, ER
  flavored): vignette, shadow figures, whispers ("code blue…", "bed five
  is empty"), flicker, shake; shaky hands (narrower/faster skill checks),
  carried meds can slip from your hands, ghost patients in the triage line
  (walking up to one costs 5 Sanity), and a pay cut for time at 0 Sanity.
* **Star rating**: 5★ each shift, −1.5★ per walk-out (a queued patient
  whose wait runs out, or a bed transfer); the rating scales the payout.
* **Game over** (the user: "after 20 seconds you have 0% sanity you
  instantly die also when the stars run out its instant game over"):
  `ZERO_SANITY_COLLAPSE_SECONDS` (20) at 0 Sanity collapses you, and
  reaching 0★ (a 4th walk-out/transfer) ends the shift at once. Either way
  `tick` moves to phase `'game-over'` (`gameOverReason` `'sanity'` |
  `'stars'`, payout 0). Asked what should follow, the user picked "Retry
  the shift": the paycheck panel shows "Game Over", the reason, 0 Gard and
  the untouched run total, and "Retry Shift N" replays the same shift (the
  save never advanced). A pulsing red chip counts down the seconds left
  while you're at 0 Sanity. Sanity drains 100 → 0 in 150 s, so going
  without coffee for ~2½ min now ends the shift.
* **Handover & paycheck**: at 7:00 PM a 20 s handover wait begins, then the
  Charge Nurse's office opens; walking in pays the shift: `shiftPaycheck
  (mistakes)` (4000 − 500 per mistake, floor 500) + bonuses, × rating ÷ 5,
  × the hallucination multiplier. Shift 30 shows a Final Paycheck with
  leaderboard submission.
* Big expressive characters via `web/static/js/shared/people.js` — a new
  `scrubs` outfit (V-neck, chest pocket, stethoscope) for the player,
  **Nurse Kimono Himura** (renamed from Maya Santos at the user's
  request, then restyled as a Japanese nurse with a lighter skin tone,
  then — "make her with a kimono" — dressed in a `kimono`: pink with
  sakura blossoms, wide sleeves, a crimson obi with a gold cord and side
  bow, the collar crossed wearer's-left over right (the reverse is
  funeral dress), tabi and zori; plus the white `nurseCap`, `bunBangs`
  hair with a kanzashi pin. A later polish pass ("make the character
  more better") gave her a soft hime-cut fringe with tapered side locks
  and a single high bun, a curved cap, opt-in `lashes`/`lipColor` face
  details, and an obi with an obiage band, diamond motif and jade
  obidome in place of side flaps. Then — "make the kimono color something
  different from pink … more beautiful like actual Japanese characters,
  better than library game and kitchen game" — she moved off `people.js`
  to her own anime-style renderer, `web/static/js/hospital/
  kimono-himura.js` (`drawKimonoHimura`, anchored at her feet like
  `drawPerson`): slimmer proportions, a tapered face with big gradient-iris
  eyes and lashes, hatched blush, long black hair with a hime fringe,
  angel-ring shine and a half-up bun with a swaying kanzashi, a red
  furisode deepening to wine at the hem (indigo-to-teal until the user
  asked for red), with gold and white accents ("add some gold and white"):
  gold suyari-gasumi mist bands, white-and-gold seigaiha waves at the hem
  and cuffs, and white and gold sakura, a gold obi with red brocade and a jade obidome,
  eyes squashed to half height (`EYE_HEIGHT_SCALE`, the user's pick)
  in a dark violet with metallic-gold pupils and no highlight sparkles, fine line-art outlines, a walking sway, and a
  worried face plus sweat drop at low Sanity. Alongside, the canvas now
  renders at the device pixel ratio (`syncBackingStore`, up to 3×) so the
  whole game stays crisp in fullscreen/Retina. The earlier people.js
  options remain (the earlier
  `nurseDress` outfit stays available); the staff keep `scrubs`), and the existing patient designs; bedded patients
  are drawn lying down under a blanket.
* **Anime patients** (the user: "many different patients designs and
  make them look like kimono", then — asked — her art style with mixed
  outfits): patients moved off `people.js` to
  `web/static/js/hospital/anime-people.js` (`drawAnimePatient`,
  feet-anchored; `PATIENT_DESIGNS`), twenty-two designs across ages (kids,
  teens, adults, grandparents — the body scales per age, the head is drawn
  around its own center), six skin tones, and a mix of kimono/yukata
  (asanoha, stripes, circles; women's wide obi, men's low kaku-obi) and
  everyday Japanese clothes (sailor and gakuran uniforms, a masked
  salaryman, office blouse, hoodie, cardigan, track suit, apron, biker
  jacket, a kid's tee and dress). Six more in kimono followed ("make some
  patients with kimonos": a teal furisode with a kanzashi, a tea teacher in
  lavender asanoha, a girl in red sakura, a boy in navy ichimatsu checks, a
  wedding guest in black crested montsuki, a shopkeeper in mustard
  seigaiha), so 10 of 22 wear traditional dress. A shuffled bag gives every design once
  before any repeats. They appear in the triage line, beds, triage chart,
  Names followed ("make the names more better"): instead of one shared
  list of 16 handed out at random, each design has its own pool of four
  names and an age range that fit how they look
  (`web/static/js/hospital/patient-names.js`'s `PATIENT_PROFILES` —
  grandparents 70–91, kids 5–10, the coming-of-age girl 20; mostly
  Japanese, a few international). Names don't repeat within a shift. The
  triage chart shows the full name and age ("Hana Sato, 81"); queue chips
  show the short form ("Hana S.") so the line still fits.
  Oxygen bed, OR table and hallucination ghosts; skin colors for the
  IV/Bandage/gurney scenes come from the design. Then — "the staff and
  karen to also match kimonos style" — `STAFF_DESIGNS` in the same module:
  Dr. Okafor (white lab coat, tie, stethoscope, glasses), the Orderly
  (blue scrubs), the Stock tech (scrubs, hi-vis vest, beanie) and Karen
  (streaked blonde angled bob, sunglasses on her head, red blazer,
  handbag, an angry `mood` with slammed-down brows and an open frown,
  plus the red `angryTint`). Dr. Okafor and the Orderly have a `textured` hair style
  — layered tufts with soft points and strand lines (the user wanted it
  "NOT smooth" but not spiky); the Stock tech keeps soft rounded tufts
  under his beanie, at the user's request. Necks were shortened for the whole cast
  (head 12 units above the shoulders, was 15; Kimono Himura's `NECK_DROP`).
  Hospital Shift no longer draws anyone with people.js. A polish pass
  followed ("make the characters look a little bit better"), applied in
  `anime-people.js` so every patient, staff member, Karen and Mel got it
  (Kimono Himura's own renderer was left as is): a soft lower lash line on
  every open eye; the bangs' shadow across the forehead and a soft radial
  shade under the jaw; anime blush hatch strokes; hair filled with a
  crown-to-bangs gradient (`hairFill`); and clothes cel-shaded light-left
  to shadow-right (`softShade`) instead of a hard dark strip. That pass
  also added eye catchlights and a glossy hair band, but the user then
  asked to "remove the shine" — both eyes and hair, as they had for
  Kimono Himura's eyes — so the crown shine and the eye highlights are
  gone.
* **Daily Challenge** (the user: "i want to add daily chalenge", then —
  asked — one seeded shift, a rotating twist and a separate daily board;
  `rules.js` §3d). A "Play Daily Challenge" card on the start screen shows
  today's UTC date, the twist and this visit's best. The challenge is
  shift 12's clock and pace (`DAILY_SHIFT_NUMBER`) with every patient —
  arrival time, condition, look, name/age and vitals — pre-rolled at shift
  start from one stream seeded by the date (`seededRandom(dailySeed(date))`),
  so everyone gets the same shift (the game's other randomness, like
  minigame layouts, isn't seeded and doesn't disturb it). Ranks don't
  apply: perks are `NEUTRAL_PERKS` plus the twist's own adjustment
  (`dailyPerksForTwist`); XP still counts toward the career. Each day rolls
  one of six twists (`DAILY_TWISTS`, `dailyTwistForDate`):

  | Twist | Effect |
  | ----- | ------ |
  | Flu Season | half of the arrivals are fever, pneumonia or dehydration |
  | Short Staffed | no Dr. Okafor (no rescues); patience +10% |
  | Coffee Machine Broken | no coffee (caution tape, "OUT OF ORDER"); Sanity drains 25% slower |
  | Night Shift | the ER is dimmed around a pool of light on the nurse; patience +15% |
  | Karen Day | Karen shows up |
  | Rush Hour | 40% more patients |

  A "Daily Challenge · {twist}" chip sits at the bottom of the canvas and
  the HUD's shift reads "Daily". The paycheck is the score: it shows the
  twist, "Today's best", Try Again (the same patients again) and Back to
  Start, and a submit form posting `daily_date` with `shifts_completed=1`.
  A daily run never touches the month run's shift or Gard.
* **Progress resets on leaving** (the user: "when you leave the website
  make it reset back to shift 1", then "ALL" — every way of leaving, and
  everything resets). Nothing is saved: shift, month Gard, best run total,
  nurse rank/XP and the Mel badge live in memory for one visit to the
  page. Closing the tab, going to another site, visiting another page of
  this site (an HTMX nav) or refreshing all start fresh at shift 1 as a
  Student Nurse. The old `localStorage` save (`hospital-game:v1`) is
  deleted on load so nothing stale lingers. Only the Postgres leaderboard
  outlasts a visit. Playwright starts tests mid-run through a one-time
  `window.__hospitalShiftTestSeed` that `takeTestSeed` reads and deletes.
* Postgres leaderboard
  (`hospital_scores`), `/projects` card.

* **Two floors + Supply Cart** (added after v1 — the user asked for a
  supply cart for bandages "and make a second floor where they are on",
  and for bandage steps to be more common): the 1st Floor is the ER; the
  2nd Floor is the **Supply Room**, holding only the **Supply Cart**
  (pocket a bandage roll — one at a time, kept separate from your hands so
  it never blocks meds, the gurney or surgery: the user said "even when i
  have bandage on i should still be able to perform the surgery").
  Library Shift's three ways between floors: **Stairs** and an
  **Elevator** at the same spot on both floors, and the HUD's
  `#hospital-floor-button` ("Go Upstairs"/"Go Downstairs"); all instant,
  allowed in every phase so you can always come back down for handover.
  You land beside the fixture you used. Patients keep ticking while you're
  upstairs. Hallucinations can make you drop a carried roll, like meds.
  New bandage conditions: **Kitchen burn** (green: vitals, bandage),
  **Dog bite** (yellow: vitals, bandage, Amoxicillin ×1) and **Bad fall**
  (yellow: vitals, bandage, IV) — bandage now appears in 7 of 14 plans.

* **Busier ER** (added after the user asked to "make it more busier"):
  patients per shift raised from 6/9/12 to **12/16/22** by tier, and
  arrivals are spread evenly (`patientArrivalTimes`: two in the opening
  4–20 s, then one per equal slice of the window up to 85% of the shift)
  instead of uniformly random, so there are no long dead spells. Three
  background staff wander the floors — Dr. Okafor and an Orderly in the ER
  (routes kept clear of the triage line), a Stock tech in the Supply Room.
* **Helping staff** (the user then asked what the workers do, and picked
  all three proposed jobs — engine-state.js "Helping staff", rules.js
  section 15):
  - **Dr. Okafor** (automatic): when a bedded patient drops below 30% of
    their patience (`DOCTOR_ASSIST_PATIENCE_FRACTION`) he walks over and
    finishes their current step — any step but surgery, never the patient
    you're mid-minigame with or carrying meds for — and tops their patience
    back up to 50%. No step tip (you didn't do it), but a discharge he
    completes still pays. Then a 50 s cooldown (also his delay at shift
    start).
  - **Orderly** (click him): wheels the most urgent surgery patient to the
    OR (`orderlyTakePatient` → `orderlyDeliverToOR`); their patience is
    paused from pickup until the operation. The OR table holds one waiting
    patient (`orPatient`); walk to the OR with free hands to operate. His
    label reads "Orderly (click: to OR)" whenever someone's waiting.
  - **Stock tech** (click him): 35 s upstairs, then 25 s in the ER with
    bandage rolls ("Stock tech · rolls (click)"). Clicking him makes him
    wait while you walk over, then he hands you a roll — no trip upstairs.

**Out of scope (v1):**

* First Person Mode, Reading Nook-style mood restore, 0-Mood
  penalties, shops/gear — Library Shift grew these over many follow-ups;
  v1 ships the mechanics the user chose.
* Mobile-specific controls beyond tap-to-move.
* Image assets (canvas primitives only, as every game here).

---

## User Flow

```text
1. Player opens /hospital-shift (Projects grid "Play now").
2. Start screen → "Start Shift" (also requests fullscreen).
3. Patients arrive at the Triage Desk queue. Click one → walk to the desk →
   Triage Sort: read vitals, pick Red/Yellow/Green → patient goes to a bed.
4. Click a bed → walk to it → its current step opens:
   - Vitals / IV: a skill check at the bed; Oxygen: find the hearts, avoid the skulls.
   - Bandage: get a roll from the Supply Cart on the 2nd Floor (Stairs,
     Elevator or "Go Upstairs"), come back down, trace the wound.
   - Meds: the bed says "Meds"; walk to the Med Cabinet → search the shelves
     for the ordered drug, pick the dose → carry it back to the bed → pass
     the give-meds skill check.
   - Surgery: at the bed you take the gurney; walk to the Operating Room →
     three-stage skill check → patient returns to the bed.
5. Last step done → discharged (+Gard), bed frees.
6. Coffee Machine any time: Coffee Pour restores Sanity and lifts Ward Mood.
7. 7:00 PM → 20 s handover → enter the Charge Nurse's office → paycheck.
8. Repeat for 30 shifts (Karen once, on shift 2). Shift 30: Final Paycheck +
   optional leaderboard submission; "Start New Month" resets.
```

---

## Visual Direction

Same as Library Shift: canvas primitives at 960×600, Organic palette, big
characters at Library Shift's 1.55 scale, label chips, the Caprasimo
Sanity label. The ER floor is pale mint vinyl tiles. Stations: Triage Desk
(top), Charge Nurse's office (top-left), Med Cabinet (top-right), four
curtained beds across the middle, Operating Room (right, green-tiled),
break-room Coffee Machine (bottom-left), Stairs (top-right) and Elevator
(bottom-right) — Library Shift's art for both. The 2nd Floor Supply Room
has warm grey tiles, wall shelving of gauze boxes and linen, and the steel
Supply Cart stacked with bandage rolls in the middle; it pulses while a
bed is waiting on a dressing and your hands are free. Minigames are full-canvas
overlays; each skill check has its own scene (ECG monitor, bag-valve mask,
arm with vein, surgical field) over one shared timing bar.

**Anime look** (the user: "i want the layouts now to be anime like", and —
asked which parts — all four: the ER and Supply Room, the minigame
screens, the HUD and labels, and the web page). The layout and every hit
area are unchanged; only the drawing moved to an anime game-UI style.

* **Kit:** `web/static/js/hospital/anime-ui.js` (pure canvas, unit-tested
  in `anime-ui.test.js`) holds the shared pieces: the `ANIME` palette
  (pastel pink/lavender/sky/mint/gold/coral with deep-plum `ink` line
  art), `animeChip` nameplates (still 16 px tall), `animeWindow` dialogs
  (paper-to-blush gradient, plum border with a pink inner line,
  screentone corners, sparkles, the title on a ribbon tab whose baseline
  is the old title's, so content below didn't move), `animeBackdrop` (a
  plum vignette with twinkling sparkles), candy `animeButton`s,
  `speechBubble`, HUD `animePlate`/`animeGauge`/`animeBadge`/`animeStar`,
  `animeTile` for stations, and `sakuraBranch`.
* **ER / Supply Room:** glossy pastel checker floors with reflection
  streaks and afternoon sunbeams, a cream-to-blush back wall with a pink
  wainscot rail, a painted sakura branch, an anime-plated EMERGENCY /
  SUPPLY ROOM sign, a pink-rimmed clock with bells, a stitched pink rug
  under the coffee machine; stations are pastel tiles with plum line art
  (a pink hover ring, a gold target ring); beds have pink pleated curtains,
  outlined frames/pillows/blankets and gauge patience bars; supply-room
  shelves hold outlined pastel boxes, some with tiny kawaii faces. The
  triage line's slot pitch went from 46 to 52 so long names don't touch.
* **HUD:** gauges with a heart (Sanity, mint) and smile (Mood, sky) badge,
  gold outlined stars on a plate, a coin badge on the Gard plate, and a
  level badge on the lavender XP gauge — positions unchanged.
* **Minigames:** each dialog's ribbon has its own color (triage/Karen
  coral, skill/oxygen sky, bandage mint, meds lavender, Mel gold, coffee
  latte). Triage gets a screentoned portrait card, outlined vitals rows
  and candy Red/Yellow/Green buttons; the timing bar is a gauge with a
  glossy sparkling gold zone and a heart-tipped marker (multi-stage
  progress shows as stars); Meds' order is a lavender plate with candy
  dose buttons; Karen speaks in a speech bubble pointing at her, with
  manga speed lines and a throbbing anger mark; Mel's thanks and the
  coffee pour use the same window and buttons.
* **Objects** (the user: "adjust the objects", then — asked — all four:
  redraw, resize, re-space and add more). Stations grew a little
  (`STATION_BOX_SIZE` 84 → 92, beds 92×120 → 100×128, the Triage Desk
  140 wide, the OR 150×160) and were re-spaced: beds evenly at x
  150/320/490/660 with room for an IV pole each, the office nudged right
  so its long label stays on screen. Every station's furniture is redrawn
  in `web/static/js/hospital/anime-furniture.js` (pure canvas,
  smoke-tested): a pastel door with a round window, gold plaque and a heart
  note; a peach triage counter with a heart-ECG monitor, clipboard,
  service bell and pen cup; a glass-door med cabinet of capped bottles; an
  OR with a gold lamp ring, sheeted table, monitor, tray and "OR" sign;
  outlined stairs and a lavender elevator with a pulsing call button; a pastel
  supply cart with outlined bandage rolls. The Coffee Machine keeps its
  original Library Shift art (the user: "i want the old coffee machine
  design to be kept"), drawn by `hospital-game.js`'s
  `drawCoffeeMachineDetail` on the new pastel tile. Set dressing comes from
  `floor-plan.js`'s `buildDecor()` (plain data, tested to stay clear of
  every station, the triage line and the player start): waiting chairs, a
  water cooler, potted plants, a vending machine and an IV pole by each bed
  in the ER; a step ladder and a plant upstairs. Props are drawn after the
  stations and under people; two staff waypoints moved off the cooler.
* **Page:** `.hospital-anime` on the page's `<main>` scopes an anime theme
  in `web/static/css/app.css` (`ha-*` classes): a candy-gradient title
  banner with a plum-outlined Caprasimo title, a plum-framed game with a
  pastel header bar and pill stats, candy buttons, ribbon-titled start and
  paycheck cards, chip toasts, and a themed leaderboard (styled by id, as
  its fragment is swapped in by HTMX). Dark mode keeps the candy accents on
  deep plum. The rules are unlayered and never set `display`, so
  Tailwind's `hidden` still hides what the game toggles. The `/projects`
  card screenshot was retaken in the new look.

---

## UI

```text
web/templates/pages/hospital-shift.html          # {{define "hospital-shift-content"}}
web/templates/components/hospital-leaderboard.html
```

| State   | Behavior |
| ------- | -------- |
| Default | Start screen → ER floor gameplay. |
| Loading | HTMX nav uses `#nav-loading`; leaderboard uses `#leaderboard-loading`. |
| Empty   | Leaderboard with no rows: "No scores yet — be the first!" |
| Error   | Leaderboard failure renders an inline "Couldn't load the leaderboard." fragment. |
| Success | Score submission swaps in the refreshed leaderboard. |

---

## HTMX Interactions

| Trigger                  | Method | Endpoint                       | Target                  | Swap        | Indicator |
| ------------------------ | ------ | ------------------------------ | ----------------------- | ----------- | --------- |
| Projects "Play now" card | GET    | `/hospital-shift`              | `#main-content`         | `outerHTML` | `#nav-loading` |
| Leaderboard load / "All-time" tab | GET | `/hospital-shift/leaderboard` | `#hospital-leaderboard` | `outerHTML` | `#leaderboard-loading` |
| "Daily Challenge" tab    | GET    | `/hospital-shift/leaderboard?board=daily` | `#hospital-leaderboard` | `outerHTML` | `#leaderboard-loading` |
| Final Paycheck / daily submit | POST | `/hospital-shift/score`     | `#hospital-leaderboard` | `outerHTML` | `#leaderboard-loading` |

The tabs live inside the fragment (`data-board="all"|"daily"`,
`aria-pressed`), so the server marks the active one; a daily submission
answers with the daily board (the Bus Rush leaderboard's pattern).

---

## Routes / Handlers

| Method | Path                          | Handler                          | Auth | Notes |
| ------ | ----------------------------- | -------------------------------- | ---- | ----- |
| GET    | `/hospital-shift`             | `HospitalShiftHandler.Index`       | no | `ContentTemplate: "hospital-shift-content"`. |
| GET    | `/hospital-shift/leaderboard` | `HospitalShiftHandler.Leaderboard` | no | Bare fragment; `?board=daily` for today's (UTC) Daily Challenge. |
| POST   | `/hospital-shift/score`       | `HospitalShiftHandler.SubmitScore` | no | Form `player_name`, `total_earnings`, `shifts_completed`, optional `daily_date` (YYYY-MM-DD, today ± 1 day UTC; a daily run must be 1 shift). Own per-IP `scoreSubmitLimiter` (5/min). |

---

## Data Model

`migrations/010_create_hospital_scores.sql`:

| Column           | Type        | Constraints |
| ---------------- | ----------- | ----------- |
| id               | BIGINT      | GENERATED ALWAYS AS IDENTITY PRIMARY KEY |
| player_name      | TEXT        | NOT NULL, 1–20 chars |
| total_earnings   | INT         | NOT NULL, 0–300000 (30 clean shifts with bonuses can pass Library Shift's 100000 cap) |
| shifts_completed | INT         | NOT NULL, 1–30 |
| created_at       | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| daily_date       | DATE        | nullable — the Daily Challenge's UTC day; NULL for an ordinary run. Added by `migrations/012_add_hospital_daily_date.sql`. |

Index `idx_hospital_scores_earnings (total_earnings DESC)`, plus
`idx_hospital_scores_daily (daily_date, total_earnings DESC) WHERE
daily_date IS NOT NULL` for the daily board. Unlike Bus Rush, the
all-time board ranks only ordinary runs (`WHERE daily_date IS NULL`): a
one-shift daily paycheck isn't comparable to a month's earnings. Leaderboard-only,
like every other game; run state isn't stored anywhere — it lasts one
visit to the page.

---

## Business Rules / Validation

All numbers are named constants in `web/static/js/hospital/rules.js`.

* **Tiers**: shifts 1–10 / 11–20 / 21–30; clock 600/480/360 s; patients
  per shift 12/16/22; two arrive in the first 4–20 s, the rest spread evenly.
* **Conditions** (`CONDITIONS`): each has a triage level, a complaint, an
  ordered treatment plan and (when it has a Meds step) a drug + dose.
  Surgery cases (appendicitis, crash injuries) arrive from shift 2
  (`SURGERY_START_SHIFT`; was 4 until the user asked for surgeries on
  shift 2), so shift 1 teaches the basic steps.
* **Triage vitals**: `vitalsForLevel(level, rolls)` generates vitals that
  `triageLevelForVitals` classifies back to that same level — Red: SpO₂ <
  90, HR > 130 or systolic BP < 90; Yellow: temp ≥ 38.5 °C or HR 101–130;
  Green: everything normal. The overlay prints this legend, so it's a real
  read-the-chart decision, not a guess.
* **Patience**: queue wait 90 s → 45 s floor by shift (Library Shift's
  `queueWaitSecondsForShift`); treatment patience by level (Red 90, Yellow
  120, Green 150 s) shrinking up to 35% by shift 30. Both × Ward Mood
  multiplier at arrival/bedding. A patient in surgery (gurney carried) has
  their patience paused.
* **Skill checks** (`SKILL_CHECKS`): zone width / hits — Vitals 0.22 / 1,
  Meds (giving) 0.18 / 1, IV 0.16 / 1, Surgery 0.14 / 3. Sweep speed ramps with
  shift number; shaky hands shrink the zone to 50% and speed it 1.6× at full
  hallucination.
* **Bandage trace**: graded by `gradeBandageTrace(samples, path)` —
  success needs ≥ 85% of the path covered (`BANDAGE_MIN_COVERAGE`) and ≥ 70%
  of samples within 16 px of it (`BANDAGE_MIN_ACCURACY`). Releasing early
  grades what was traced.
* **Meds**: the cabinet fills the oldest bed whose current step is Meds.
  Only one item (meds or a gurney) can be in your hands at a time; a
  bandage roll goes in your pocket and doesn't count.
* **Payout**: `max(0, shiftPaycheck(mistakes) + bonusGard) × rating/5 ×
  hallucinationPayMultiplier`. Bonuses: step tips, discharges, coffee tips,
  Karen.
* **Closing**: in-flight work is abandoned at 7:00 PM; no penalty beyond
  what already happened.

---

## Security Considerations

* `/hospital-shift` and its leaderboard GET are public; the score POST is
  rate-limited per IP with its own limiter.
* `player_name`/`total_earnings`/`shifts_completed` validated server-side
  against the same bounds as the CHECK constraints
  (`internal/service/hospital_validation.go`); player names are rendered
  through html/template auto-escaping. `daily_date` must be YYYY-MM-DD
  within a day of today's UTC date (`ValidateHospitalDailyDate`, Bus
  Rush's window — a run finished across midnight still counts, old days
  can't be back-filled), and a daily run must report exactly 1 shift.
* Same documented no-CSRF gap as the other games' score routes.
* No new secrets/config.

---

## Testing Plan

* [x] Go: handler tests (index, leaderboard, score happy/validation/
      rate-limit/DB-error, the daily board and a daily submit answering
      with it, a stale daily date → 400), validation + service tests
      (daily date window/format, a daily run must be 1 shift, daily rows
      kept off the all-time board), real-Postgres round trips in
      `cmd/server/e2e_test.go` (including a daily run landing on
      `?board=daily` and not the all-time board).
* [x] JS (`node --test`): tiers/clock label, Karen seed range, vitals ↔
      triage agreement, condition gating, skill-check zones, bandage
      grading, the cabinet's stock (ordered drug exactly once), every engine-state transition (triage, bed tasks, meds,
      surgery transport, patience transfers, Karen, Mel, coffee, closing,
      payout), Mel's arrival roll / secret code / card lines, patient name
      pools (one per design, no name shared, ages in range), career rank
      (thresholds, progress, stacking perks, XP from each source, perks on
      patience/Sanity drain/pay), the Daily Challenge (UTC date, seeded
      stream determinism, every twist reachable, neutral perks + twist,
      Rush Hour volume, Flu Season bias), floor-plan geometry (decor clear
      of stations, the triage line and the player start), anime-furniture
      smoke tests (every station and decor drawer runs; every decor kind
      has one).
* [x] Playwright (`e2e/hospital-shift.spec.js`, Chromium + WebKit): start →
      triage a patient → vitals skill check → meds → bandage → surgery →
      coffee → Karen → Mel (typing "mel" → card → gift → badge, gone after
      a reload; five vase clicks bring her in) → career rank (XP ranks you
      up with a toast, the paycheck shows it, the perk applies next shift,
      a reload resets it; the HUD doesn't double-count banked XP; a Charge
      Nurse starts with every top perk) → handover → paycheck →
      final-shift leaderboard submit; leaving resets (a refresh goes back
      to shift 1 with rank/badge reset and the old save cleared; an HTMX
      revisit after finishing shift 1 starts at 1/30 again); Daily
      Challenge (the start card shows today and its twist, the daily plays
      shift 12 with neutral perks, Try Again replays identical patients,
      the paycheck carries daily_date/1 shift, Back to Start leaves the
      month run untouched; a daily submit lands on the daily board and the
      tabs switch boards; Short Staffed has no Dr. Okafor and Coffee
      Machine Broken refuses to pour). Uses
      `window.__hospitalShiftTestHooks` for exact coordinates/timing.
* [x] Manual browser check: a click-driven shift with zero console errors,
      (the canvas uses its own fixed palette, like the other games).

---

## Open Questions

* Tuning (patience, zone widths, volumes) is implementation-time and
  expected to change after the user plays it.

---

## Definition of Done

* [x] User flow works end-to-end.
* [x] All UI states implemented.
* [x] Migration with a working Down.
* [x] Handler/service/repository boundaries followed.
* [x] Accessibility: Enter on a hovered station walks to it; skill checks
      accept Space/Enter; Triage Sort accepts 1/2/3; Meds accepts number
      keys for the dose. The cabinet search and the Bandage trace stay pointer-only (precision tracing has no
      keyboard equivalent — same stance as Library Shift's scene search).
* [x] Tests in the Testing Plan pass.
* [x] `/hospital-shift` on the Projects grid (real screenshot).
