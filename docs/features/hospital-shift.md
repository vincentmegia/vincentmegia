# Feature: Hospital Shift

## Status

`Shipped` — implemented and covered by tests. JS: the pure modules in
`web/static/js/hospital/` (151 `node --test` tests); `web/static/js/
hospital-game.js` wires them to the canvas. Go: handler/service/validation
tests plus a real-Postgres round trip in `cmd/server/e2e_test.go`.
Playwright: `e2e/hospital-shift.spec.js` (49 tests, Chromium + WebKit),
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
  * **Surgery** (skill check, 3 stages, narrowest zone) — the patient must
    first be wheeled from their bed to the Operating Room (the player
    carries the gurney, or the Orderly does), then operated on there;
    afterwards they return to their bed. Since the surgery rework (below)
    the OR is a walk-in room and every operation needs a scalpel plus an
    organ or implant, and the stages are named for them (e.g. Incision →
    Transplant Kidney → Sutures).
  * **Walk-in OR and surgery items** (the user: "for surguries you have to
    enter the room and get organs if theres an transplant and sclapels and
    when you get the item you have to do a skillcheck", then "do all" to
    every option offered). The ER's Operating Room tile is now a door into
    its own room (`FLOOR_OR`): the Operating Table under a ring lamp, the
    Instrument Tray, the Organ Cooler, and swing doors back to the ER (the
    HUD button reads "Leave the OR" in there). Every surgery needs a
    **scalpel** (Instrument Tray) plus one item (`rules.js`
    `SURGERY_ITEMS`, `surgeryItemFor`): the matching **organ** for the new
    transplant cases (kidney, liver, heart failure; from
    `TRANSPLANT_START_SHIFT`, now shift 1) from the Organ Cooler, or an **implant**
    from the Supply Room's new **Implant Shelf** upstairs (a mesh patch for
    appendicitis, a bone plate for car-crash injuries). Each source opens a
    close-up of item cards — its real items plus look-alike decoys
    (forceps/scissors/clamp, lung/cornea, stent/steel pin); taking anything
    no waiting surgery needs (a decoy or the wrong organ) is a mistake and
    greys the card out. Choosing a needed item starts a **grab** skill check
    (`SKILL_CHECKS.grab`): a hit puts it in the surgery kit (engine-state's
    `surgeryKit`, a pocket separate from your hands, shown floating beside
    the nurse), a miss just drops it — no mistake — with a short lockout
    before the retry. The table only opens once the kit holds the scalpel
    and the patient's item (`surgeryMissing` says what's missing in a
    toast); then each item is its own stage at the table, and finishing the
    operation uses the kit up (a missed stage keeps it). Bed chips read
    "Transplant: Kidney" / "Surgery: Mesh patch", and the tray, cooler,
    shelf and ready table glow when they're the next stop.
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
* **Security** (the user: "add security", choosing a bigger in-game role
  for the guard plus leaderboard anti-cheat — see Security
  Considerations; `rules.js` "Security").
  * A **Security Desk** by the ER entrance (left wall): CCTV monitors with
    a blinking REC light, a radio on its charger and a gold nameplate
    (`drawSecurityDesk`, decor `security-desk`). The guard is posted beside it.
  * **Incidents**, one per shift at most from shift 2 (50% of day shifts,
    80% of nights; never in the Daily): a **rowdy visitor** shouting at the
    waiting chairs drains Ward Mood (0.6/s) and your Sanity (0.12/s) for
    up to 45 s; a **thief** jimmies the vending machine for 30 s. Click a
    guard ("click: send!") and the incident's clock stops while he walks
    over and escorts the culprit out the entrance: the ward relaxes
    (+10 Mood) or the vending company pays +20g. Ignored, the rowdy
    visitor storms out (−12 Mood) and the thief escapes with the cash:
    the vending machine is taped OUT OF ORDER for the rest of the shift
    (no snacks, drinks or batteries). Clicking a culprit hints to send
    Security. Engine: `securityIncidentStarts`, `dispatchSecurity`,
    `resolveSecurityIncident`, `tick`'s countdown and drain.
  * **Night Security**: night shifts add a second guard who patrols with a
    flashlight that lights the dark ER (`STAFF_DESIGNS.nightGuard`); either
    guard can be sent.
* **More characters** (the user: "i want there to be more characters",
  then all four kinds offered; `rules.js` "More characters").
  * *Patients:* eight more designs — a builder in a hard hat, a chef in
    a toque, a cat-ear cosplayer, a monk in saffron robes, a grandpa in a
    cap, a manager, a fisherman in a beanie and a punk teen with
    headphones — then ten more ("add more like 10 more"): an idol, a
    courier, a kendo student, a painter in a beret, a grandma in a sun hat,
    a surfer, an off-duty officer, a baker, a tourist and a bookish
    student — and ten more again ("add 10 more characters"): a flower
    girl, a gothic-lolita teen, a street dancer, a scientist, a bearded
    grandpa in a kimono, a farmer, a gamer girl, an off-duty firefighter, a
    moustached executive and a bride straight from her wedding — then three
    more in kimono ("now add 3 more characters with kimonos"), each with a
    new robe pattern, then polished ("could you improve it more please?"):
    a lady in maple leaves drifting on a stream (`momiji`) with a
    kanzashi, an obiage and an obijime cord with a jade obidome; a kid in
    a goldfish yukata (`goldfish`) with a heko-obi bow, holding a festival
    goldfish in a bag of water; and a grandpa in tortoiseshell hexagons
    with little flowers (`kikko`) under an open haori tied with a white
    himo, a fan tucked in his obi. The kimono outfit gained optional
    `obiage`, `obijime`, `heko`, `haori` and `sensu` fields.
  * *The maiko* ("add one more character add tons of details on it and
    add an rlly detailed kimono"): a showpiece with its own renderers
    (`drawMaikoKimono`, `drawMaikoHair`), 54 designs in all. A
    bokashi-dyed hikizuri (dusk purple into vermilion) painted with gold
    kasumi mist bands, flying cranes, sakura and ume branches, pine
    sprigs, a winding stream and gold-leaf flecks; a padded fuki hem and
    pink juban edges; long furisode sleeves; a gold brocade obi with a
    key-fret weave and medallions, red shibori obiage, a braided obijime
    and a jeweled pocchiri clasp; a red embroidered eri over a white
    under-collar; a hakoseko purse with chain and tassel; a kinchaku pouch
    on her wrist; tall okobo clogs with bells. Her wareshinobu updo has
    red kanoko silk, a tortoiseshell kushi, a coral tama pin, a silver
    fan kanzashi with dangles, and hana-kanzashi silk flowers with
    cascading strands; white oshiroi makeup with red beni at the eyes and
    on the lower lip. Then made prettier ("make her lok even prettier"):
    warm brown lashed eyes, beni blended softly up from the eye corners
    with a fine red liner, rosebud lips, a low, wide two-lobed mage drawn
    behind the head (`hair.back: 'maiko'`, `drawMaikoMage`) so the front
    hair laps over it, a warm pink bang shadow on the oshiroi instead of
    grey, and a finer obi brocade with a soft sheen. Her lips sit lower
    than other mouths ("make the mouth lower": `MAIKO_MOUTH_DROP`). A little more detail ("make hiko have a little
    more detail"): a gold-and-red folded sensu with a tassel held in her
    hands, a butterfly kanzashi among her hair flowers, gold embroidery
    stitched along her sleeve edges and the kimono's front edge
    (`goldStitches`), and a fine red line under each eye. Then "even
    prettier and detailed": a soft pink lid shadow, the red underlay
    painted beneath her black brows, fine lower lashes and a gentler nose
    on the oshiroi (`drawMaikoEyeDetails`); gold piping and stitching along
    the obi's edges; gold lacquer bands on her okobo; and a few sakura
    petals drifting down around her wherever she is (`extras.petals`,
    `drawPetalDrift`). Her right-side silver fan pin became a showpiece
    tsumami kanzashi ("add a very detailed hair pin",
    `drawTsumamiKanzashi`): a chrysanthemum of three rings of folded-silk
    petals (white, pink, deep rose, each with a fold crease) round a
    gold-leaf center ringed with tiny pearls, two plum-blossom buds,
    veined silver leaves, a tortoiseshell double-pronged pin, and three
    swaying silver chains of links ending in a blossom, a pearl and a
    little gold bell. Her small folded fan became a large open sensu held
    up at its pivot in front of her obi ("make her holding a very detailed
    fan", `drawOpenSensu`/`drawSensuTassel`): a 20-pleat paper leaf
    shading from gold leaf to crimson, alternate pleats lit and shaded,
    painted with a winding stream, a flowering sakura branch, falling
    petals and gold flecks; bamboo inner sticks; gold borders;
    black-lacquered guard ribs inlaid with gold; a mother-of-pearl rivet;
    and a red silk tassel with a gold knot swaying below her hands. She's drawn 35% bigger than everyone else
    wherever she appears — in line, in bed, on the triage card ("make her
    bigger": the design's `sizeScale`, applied in `drawAnimePatient`); the
    Triage Desk's label sits up on the desk (see the shiromuku
    bride below) so her taller hair doesn't hide it. She's always named Hiko Maiko ("Hiko M." on
    her chip; "i want it to be hiko maiko").
  * *The shiromuku bride* ("now add another very detailed character with
    a white kimono"): a second showpiece, a Shinto bride in the all-white
    wedding kimono, with her own renderers (`drawShiromuku`,
    `drawShiromukuHair`) and Hiko Maiko's 35% `sizeScale`. A padded white
    uchikake trailing at the hem with a satin sheen, its red beni-ura
    lining curling at the hem and sleeve openings; a woven white-on-white
    scene in silver (seigaiha waves, pine, plum, karakusa scrolls, cranes);
    the inner kakeshita's sayagata weave in the front opening; a silver
    brocade obi with a kaiken (a small dagger in a red-and-gold brocade bag,
    tasselled) tucked in it; long red-lined furisode sleeves with gold
    stitching; layered collars with a red line; a white-and-gold hakoseko;
    a closed white-and-gold sensu in her hands; lacquered zori. Her updo
    sits under the white tsunokakushi hood (woven diamonds, soft folds, a
    red-lined front fold) with tortoiseshell pins fanning out behind it;
    white makeup (later softened to her own bridal look) with small full
    lips in a soft natural pink — no lipstick ("remove the lipstick"; `mouth: 'bride'`), and sakura
    petals drift around her. Then made better ("make her better"): a
    satin twill sheen across the silk (`satinTwill`), bigger cranes
    embroidered in silver thread with gold-thread clouds
    (`embroideredCrane`), the kakeshita's layered red-and-white hems at
    her feet, a softer obi with a white shibori obiage, a braided gold
    obijime fastened with a pearl obidome and tasselled ends, the kaiken
    seated lower in the obi, a tortoiseshell kushi with gold maki-e under
    the hood's edge, and pearl-tipped pins at the hood's sides. Then
    "more beatifuller and detailed": the tsunokakushi's side drapes
    folding down past her hair (woven diamonds, red inner edge), an
    embroidered plum spray (silver branch, pink and white blossoms, gold
    buds) on the kakeshita below her hands, gold-and-silver vines down the
    uchikake's front edges, a line of tiny pearls along the outer collar,
    silver bira dangles and a pearl on the hakoseko's second chain, and
    red hanao on her zori. Then "more DETAILED": silver crane-in-a-circle
    crests (`craneCrest`) on the hood's front and both sleeves, gold cord
    trim along the hood, fine combed strands in her side wings, long red,
    white and gold silk cords with tassels hanging from her fan, slender
    fingers with pink tips, gold stitching along the padded hem, and
    three-layer zori on a sole. Then "beatifuler": her own soft bridal
    makeup instead of a maiko's (`extras.bridal`, `drawBridalEyeMakeup`) —
    a peach-pink wash on the lids, fine rose liner with a gentle lift,
    fluttery outer lashes, a whisper of pink on the lower lids, a soft
    round rosy blush in place of the hatch-stroke blush, warmer brown eyes,
    and the faintest smile at the corners of her lips. Then "more
    detailed please": the uchikake's train spread on the floor round her
    feet (white silk, silver waves, red lining and gold stitching at the
    edge), a soft ring and fine radial lines in her irises (detail, no
    highlights), a fringe of tiny pearls along the hood's front edge,
    silver blossoms embroidered down the hood's drapes, silver flower
    medallions on the obi, and little red silk tassels weighting each
    sleeve's corner. Her closed fan became an open bridal sensu ("make
    her hold a detailed fan"): `drawOpenSensu` now takes a style
    (`SENSU_STYLES.hiko`/`.bride`), and hers is a pleated leaf shading
    from white silk to gold leaf, painted (`paintCraneLeaf`) with silver
    mist bands, a red rising sun, a pine on a gold-edged hill and two
    cranes in flight, on white-lacquered sticks and guards with gold
    inlay and a pearl rivet; her red, white and gold silk cords still hang
    from it past her hands. Her eyes are red with gold pupils ("make her
    eyes red with gold pupils and detailed"), then reworked when the user
    found the first pass ugly ("make it more fitting with the outfit"): a
    deep garnet iris (`#a8182c`, the family of her red lining) shading
    darker under the upper lid and glowing rosier round the pupil, a fine
    dark wine edge, and a small antique-gold pupil (`#d9a63a`, like her gold
    accents; `eyes.pupil` and `eyes.pupilScale`, optional pupil color and
    size in `drawEyes`) with a fine darker rim — no spokes, flecks or gold
    frame, and still no highlights. Then "a little bit detailed": a few
    soft rose fibers in the lower iris only and a hairline gold halo just
    round the pupil. Names: Shirayuki Hanazono, Mashiro
    Tsurugaoka, Yukino Shirakawa, Sayuri Hakuba. The Triage Desk's label
    now sits on the desk's front panel like a nameplate
    (`stationLabelOffset`), so the tall showpieces at the front of the line
    neither cover it nor get covered; 65 patient designs in all.
  * *Ten more again* ("now i want to add EVEN more characters"): a cyclist
    in a vented helmet, a pageant queen in a tiara, a pirate cosplayer
    with a polka-dot bandana and an eyepatch, a red-haired rock star, a
    wizard cosplayer in a starry pointed hat, a yoga teacher with a
    sweatband, a mail carrier with a satchel, a ramen chef in a hachimaki,
    a little ballerina and a gardening grandma; 64 designs in all.
  * New head pieces across these batches: `hardhat`, `chefHat`,
    `catEars`, `beret`, `sunhat`, `flowerCrown`, `veil`, a `beard`,
    `bikeHelmet`, `tiara`, `bandana`, `eyepatch`, `witchHat`,
    `hachimaki` and `sweatband`; each design has its own name pool.
  * *Staff:* a **janitor** wanders and every ~45 s
    (`JANITOR_MOP_EVERY_SECONDS`) mops: a puddle with a yellow sign that
    slows you to 60% while you cross it for ~22 s; a **receptionist** sits
    behind the triage counter and keeps the line calm (triage waits ×1.1,
    `RECEPTIONIST_WAIT_BONUS`); a **security guard** patrols by the office
    and adds a third button to Karen's scene, "Call Security", which ends
    it with no mistake but no tip (engine `resolveKarenEvent(…,
    'security')`); a **pharmacist** potters by the Med Cabinet with advice.
    Their designs are `STAFF_DESIGNS.janitor/receptionist/guard/pharmacist`.
  * *Visitors:* on ~40% of shifts a **lost child** stands in the triage
    line; walking them to the waiting chairs (their own scene) earns their
    mom's thanks, +25g and +15 Ward Mood (`lostChildArrives`/
    `helpLostChild`), and they sit on the chairs for the rest of the shift.
    On ~55% of shifts the **hospital cat** wanders the ER; clicking it pets
    it for +6 Sanity, then it needs 30 s to itself (`petCat`). On ~30% of
    shifts one patient is a **celebrity** (seeded in the Daily) with a
    stage name, a gold ★ chip, paparazzi flashes in line and a "★ VIP" bed
    tag; their discharge pays double (`CELEBRITY_DISCHARGE_MULTIPLIER`).
  * *Crowds:* two visitors sit on the ER's waiting chairs and four
    off-duty staff eat at the Cafeteria tables (set dressing).
* **Night shifts and the flashlight** (the user: "i want to add a
  flashlight for night shifts", then — asked — night shifts in the month
  and a toggled flashlight with a battery; `rules.js` "Night shifts and the
  flashlight"). Every 5th month shift (5, 10 … 30; `isNightShift`) and the
  Daily's Night Shift twist run 7 PM → 7 AM (`inGameTimeLabel(…, { night })`)
  with 20% fewer patients (`patientVolumeFor`), and the ER and Supply Room
  are dark: an offscreen deep-blue layer with soft holes for a glow around
  the nurse, the vending machine, the elevator button and the EMERGENCY
  sign (the OR and Cafeteria keep their lights on). The flashlight (F, or
  the "🔦 Light" HUD button shown only at night) cuts a warm cone toward the
  mouse; its battery (`FLASHLIGHT_BATTERY_MAX`, ~2½ min of light) drains
  only while on and flickers when low, and a flat battery swaps in a spare
  automatically (engine-state's `flashlight`, `toggleFlashlight`). Spares
  (up to `FLASHLIGHT_MAX_SPARES` 2) come from the Supply Room's new battery
  shelf (`pickUpBattery`) or the vending machine for `BATTERY_PRICE` 15g
  (`buyBattery`) — only if you can afford it (the user: "if you do not
  have enough gard you cannot buy battery"): your spendable Gard is the
  month's total plus this shift's earnings so far, and without 15g the
  button greys out and says "not enough Gard". A battery meter with spare dots sits left of the wall
  clock at night; the paycheck's button reads "Start Night Shift 🌙" before
  one; the Cafeteria is closed at night (the user: "make it so that the
  cafeteria is shut down in night shift") — its door wears a CLOSED sign
  and a toast points to the vending machine, which is then the only food; the Daily twist's old soft shade was replaced by this darkness.
* **Hunger, Thirst and the Cafeteria** (the user: "add an hunger and
  thirst system you can get snacks from the vending machine and drinks add
  an cafetria for breaks and add an cafetria lady which she gives food and
  water", then — asked — slow down and hurt Sanity when low, a walk-in
  Cafeteria, vending costs Gard and the lady is free, plus "when 0%
  hunger/thrist you collaspe"; `rules.js` "Hunger and Thirst"). Both start
  full and drain over the shift (Hunger empties in ~9 min, Thirst in ~7);
  compact gauges with onigiri/droplet badges sit under the stars. Under
  25% (`HUNGER_THIRST_LOW`; was 30 until the user said "low 25% you start
  to get uncomfortable") you're uncomfortable: a toast the moment a bar
  crosses the line, a faint pulsing warm vignette that deepens toward 0%,
  a thought bubble over the nurse showing what she wants, 15% slower
  walking and 15% narrower skill-check zones. At 0% each empty stat drains
  Sanity faster (`EMPTY_STAT_SANITY_DRAIN`), and 5 s at 0%
  (`HUNGER_THIRST_COLLAPSE_SECONDS`; was 20 until "if it is on 0% you have
  5 seconds before game over") is a collapse — game over — with a pulsing
  countdown chip like 0% Sanity's. The ER's vending machine
  is now a station: a shop close-up of six snacks and drinks
  (`VENDING_ITEMS`: onigiri, chips, candy bar, water, juice, green tea)
  whose prices come off the shift's pay — but only if you can afford them
  (the user, after the battery rule: "apply it too"): spendable Gard is the
  month's total plus this shift's earnings so far, the shop's subtitle
  shows it, and cards you can't afford grey out with "not enough". A door at the bottom of the ER leads to the
  walk-in **Cafeteria** (`FLOOR_CAFE`; "Leave the Cafeteria" on the HUD
  button): peach tiles, a chalk menu board, four tables, plants, and the
  counter where **Auntie Yumi** (`STAFF_DESIGNS.cafeLady`, apron and
  kerchief) serves a free meal and water — both bars to full and +10
  Sanity (`cafeteriaMeal`). Two staff waypoints moved off the new door,
  and the vending machine left the decor list for the station list.
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
| POST   | `/hospital-shift/score`       | `HospitalShiftHandler.SubmitScore` | no | Form `player_name`, `total_earnings`, `shifts_completed`, optional `daily_date` (YYYY-MM-DD, today ± 1 day UTC; a daily run must be 1 shift), `run_ticket` (anti-cheat, below). Own per-IP `scoreSubmitLimiter` (5/min). A 4xx's reason shows under the form. |
| POST   | `/hospital-shift/run`         | `HospitalShiftHandler.StartRun`    | no | Starts a run: returns a signed, single-use run ticket as `text/plain` (`Cache-Control: no-store`). Called by the page when a month starts at shift 1 (or the page's first shift) and for each Daily. Own per-IP limiter (120/min — tickets are a cheap HMAC, and the Playwright suite starts a run for nearly every test). |

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
  Surgery cases (appendicitis, crash injuries, and the kidney/liver/heart
  transplants) arrive from shift 1 (`SURGERY_START_SHIFT` and
  `TRANSPLANT_START_SHIFT`; surgery was gated to shift 4, then shift 2,
  until the user asked to "make it so that surgeries start on shift 1").
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
* **Leaderboard anti-cheat** (the user: "add security", choosing it;
  `internal/service/hospital_run.go`). The game runs client-side, so a
  score can't be proven — but faking one now takes about as long as
  playing:
  * *Run tickets.* When a run starts, the page asks
    `POST /hospital-shift/run` for a ticket, `v1.<issued unix>.<nonce>.<HMAC-SHA256>`,
    and the Final Paycheck submits it as `run_ticket`. No ticket, a
    tampered or foreign-signed one, or one older than 12 h is a 400.
  * *Minimum time.* Shifts run a fixed real-time clock (10/8/6 minutes by
    tier, `ROUND_TIER_CLOCK_SECONDS`) that can't end early, and progress
    never survives leaving the page, so a 30-shift run is one ~4-hour page
    session. A score is rejected ("faster than those shifts can be
    played") unless 90% of its shifts' clock time has really passed since
    the ticket was issued: 3.6 h for a month, 7.2 min for a Daily (shift
    12's clock). The Go side mirrors the clock table
    (`hospitalShiftClockSeconds`) — change both together.
  * *Single use.* A ticket redeems once (remembered in memory for its
    12 h life; given back if the insert fails), so one honest run can't be
    replayed into many rows.
  * *Plausible earnings.* At most 10,000 Gard per claimed shift
    (`hospitalMaxEarningsPerShift`, above a perfect shift at the +25% rank
    perk), so a 1-shift Daily can't claim a month's pay.
  * Limits: a determined cheater can still play in real time and edit the
    final number within the cap, or script the page. It stops instant fake
    submissions and replays.
  * Config: `HOSPITAL_RUN_SECRET` signs tickets; unset, a random secret is
    made per process, so a run in progress across a deploy can't submit —
    **set it in production**. `HOSPITAL_RUN_TIME_CHECK=off` (only
    `make run-e2e`) skips the time check for the Playwright suite, which
    seeds a run straight to shift 30.
* A rejected score's reason shows under the Final Paycheck form. The form
  stops the `htmx:responseError` from reaching `nav-menu.js`'s page-wide
  handler, which would otherwise replace the whole game with "Couldn't
  load this page" (the other games' score forms still have that problem).
* Same documented no-CSRF gap as the other games' score routes.

---

## Testing Plan

* [x] Go: handler tests (index, leaderboard, score happy/validation/
      rate-limit/DB-error, the daily board and a daily submit answering
      with it, a stale daily date → 400), validation + service tests
      (daily date window/format, a daily run must be 1 shift, daily rows
      kept off the all-time board), real-Postgres round trips in
      `cmd/server/e2e_test.go` (including a daily run landing on
      `?board=daily` and not the all-time board). Anti-cheat
      (`hospital_run_test.go`, `TestHospitalShiftHandler_RunTickets`): the
      month/Daily minimum durations; an honest run accepted once, then
      replay rejected, and released after a failed insert; missing,
      garbage, tampered, foreign-signed, too-fast and expired tickets
      rejected; the time check's off switch; the per-shift earnings cap; the
      handler's ticket route (no-store, rate-limited) and its 400 reasons.
      The real-Postgres round trips start a run first.
* [x] JS (`node --test`): tiers/clock label, Karen seed range, vitals ↔
      triage agreement, condition gating, skill-check zones, bandage
      grading, the cabinet's stock (ordered drug exactly once), every engine-state transition (triage, bed tasks, meds,
      surgery transport, patience transfers, Karen, Mel, coffee, closing,
      payout), Mel's arrival roll / secret code / card lines, patient name
      pools (one per design, no name shared, ages in range), career rank
      (thresholds, progress, stacking perks, XP from each source, perks on
      patience/Sanity drain/pay), the Daily Challenge (UTC date, seeded
      stream determinism, every twist reachable, neutral perks + twist,
      Rush Hour volume, Flu Season bias), the surgery kit (items per
      condition and stage names, wrong organ/decoy = mistake, the table
      waits for the full kit, a finished operation uses it up), floor-plan
      geometry (the OR room and Implant Shelf, the Cafeteria, floor-aware
      entry points), hunger/thirst (drain, low effects, extra Sanity drain
      and collapse at 0, vending prices, the free meal), visitors (the lost
      child once per shift, petting the cat, a celebrity's double discharge,
      Security ending Karen's event) (decor clear
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
      Machine Broken refuses to pour); the walk-in OR (the table refuses
      without a kit; scalpel from the tray, mesh patch from the Implant
      Shelf upstairs, then three stages; a transplant where the wrong organ
      and a decoy are mistakes and a dropped grab isn't; the HUD button
      leaves the OR); hunger/thirst (the vending machine sells water and an
      onigiri off the shift pay; the Cafeteria's free meal fills both bars;
      5 s at 0% Thirst is a collapse); night shifts (shift 5 is a night
      with a PM clock, F toggles the light, the shelf's spare swaps in when
      the battery runs flat, then it dies; the vending machine sells a
      battery; day shifts have no flashlight); more characters (Call
      Security ends Karen's scene with no mistake, the lost child's scene
      pays +25g, petting the cat restores Sanity then needs a break). The
      deep-cut and gurney-surgery flows, the suite's longest, have a 60 s
      timeout. Security: sending a guard walks a rowdy visitor out; a
      thief caught pays, one that escapes leaves the vending machine out
      of order; night shifts add the night guard; the score carries the
      run ticket fetched at the shift start, and a rejected score shows its
      reason under the form. Clicking a staff member wins over the cat at their feet.
      Uses
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
