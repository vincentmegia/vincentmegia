// Pure, canvas-independent game-logic functions for Hospital Shift
// (docs/features/hospital-shift.md's Business Rules / Validation).
//
// No DOM/canvas/localStorage/timer dependencies, so it runs under
// `node --test` and is imported unchanged by hospital-game.js. Mirrors
// Library Shift's rules.js (web/static/js/library/rules.js): named,
// tunable constants, the same round-tier shape, the same shiftPaycheck,
// Sanity, Coffee Pour, star-rating and hallucination rules — ported, not
// reinvented, since the user asked for this game to mirror Library Shift.
// This file has no RNG: callers draw rolls in [0, 1) and pass them in.

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Shifts per run — same 30 as Kitchen/Library Shift. */
export const SHIFTS_PER_MONTH = 30;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clampShift(shiftNumber) {
  const shift = Number.isFinite(shiftNumber) ? Math.floor(shiftNumber) : 1;
  return clamp(shift, 1, SHIFTS_PER_MONTH);
}

function clampRoll(roll) {
  return clamp(Number.isFinite(roll) ? roll : 0.5, 0, 0.999999);
}

/** Exponential ramp from 0 (shift 1) toward 1, shared by every "gets harder with shift number" curve. */
function shiftRamp(shiftNumber, saturation) {
  return 1 - Math.exp(-(clampShift(shiftNumber) - 1) / saturation);
}

// ---------------------------------------------------------------------------
// 1. Round tiers
// ---------------------------------------------------------------------------

export const ROUND_TIER_COUNT = 3;
export const ROUND_TIER_SHIFT_SPAN = 10;

/** Real seconds per shift, per tier — Library Shift's slow 10/8/6 minutes. */
export const ROUND_TIER_CLOCK_SECONDS = [600, 480, 360];

/** Patients arriving at triage over one shift, per tier. Raised from [6, 9, 12] — the user asked to "make it more busier". */
export const ROUND_TIER_PATIENT_VOLUME = [12, 16, 22];

/** The opening patients of every shift arrive within this window (seconds in), so the ER is busy from the start. */
export const FIRST_PATIENT_ARRIVAL_SECONDS = [4, 20];

/** How many patients arrive in that opening window. */
export const EARLY_PATIENT_COUNT = 2;

/** Arrivals stop this far into the shift, leaving time to treat the last ones. */
export const ARRIVAL_WINDOW_FRACTION = 0.85;

export function roundTier(shiftNumber) {
  return clamp(Math.ceil(clampShift(shiftNumber) / ROUND_TIER_SHIFT_SPAN), 1, ROUND_TIER_COUNT);
}

export function shiftClockSecondsForShift(shiftNumber) {
  return ROUND_TIER_CLOCK_SECONDS[roundTier(shiftNumber) - 1];
}

export function patientVolumeForShift(shiftNumber) {
  return ROUND_TIER_PATIENT_VOLUME[roundTier(shiftNumber) - 1];
}

/**
 * When each of a shift's patients arrives, in seconds since the shift
 * began, sorted. The first EARLY_PATIENT_COUNT land in the opening window;
 * the rest are spread evenly — one per equal slice of the remaining
 * arrival window, at a random point inside its slice — so the flow is
 * steady instead of clumping into rushes and dead spells.
 *
 * @param {number} count
 * @param {number} totalSeconds - the shift clock.
 * @param {number[]} rolls - one value in [0, 1) per patient (missing → 0.5).
 * @returns {number[]}
 */
export function patientArrivalTimes(count, totalSeconds, rolls = []) {
  const roll = (i) => clampRoll(rolls[i]);
  const [early, late] = FIRST_PATIENT_ARRIVAL_SECONDS;
  const times = [];
  const earlyCount = Math.min(count, EARLY_PATIENT_COUNT);
  for (let i = 0; i < earlyCount; i++) times.push(early + roll(i) * (late - early));
  const rest = count - earlyCount;
  const windowEnd = Math.max(late, totalSeconds * ARRIVAL_WINDOW_FRACTION);
  const slice = (windowEnd - late) / Math.max(1, rest);
  for (let i = 0; i < rest; i++) times.push(late + (i + roll(earlyCount + i)) * slice);
  return times.sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// 2. In-game clock — the ER day shift runs 7:00 AM to 7:00 PM.
// ---------------------------------------------------------------------------

export const SHIFT_START_MINUTES = 7 * 60;
export const SHIFT_END_MINUTES = 19 * 60;

/**
 * Formats the in-game time from the real seconds left on the shift clock.
 *
 * @param {number} clockSecondsRemaining
 * @param {number} totalClockSeconds
 * @returns {string} e.g. "7:00 AM", "1:30 PM", "7:00 PM".
 */
export function inGameTimeLabel(clockSecondsRemaining, totalClockSeconds) {
  const total = Number.isFinite(totalClockSeconds) && totalClockSeconds > 0 ? totalClockSeconds : ROUND_TIER_CLOCK_SECONDS[0];
  const remaining = Number.isFinite(clockSecondsRemaining) ? clamp(clockSecondsRemaining, 0, total) : total;
  const elapsedFraction = 1 - remaining / total;
  const totalMinutes = Math.round(SHIFT_START_MINUTES + elapsedFraction * (SHIFT_END_MINUTES - SHIFT_START_MINUTES));
  const hour24 = Math.floor(totalMinutes / 60) % 24;
  const minute = totalMinutes % 60;
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
}

// ---------------------------------------------------------------------------
// 3. Karen — the angry relative, once per run. She was rolled from shifts
//    10–15 (Library Shift's karenShiftForSeed, same mulberry32 hash); the
//    user asked for her on shift 2, so the range is now just 2 — widen
//    MIN/MAX again to bring back the roll.
// ---------------------------------------------------------------------------

export const KAREN_SHIFT_MIN = 2;
export const KAREN_SHIFT_MAX = 2;

function mulberry32(seed) {
  let t = seed >>> 0;
  return function next() {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function karenShiftForSeed(seed) {
  const value = Number.isFinite(seed) ? Math.floor(seed) : 0;
  const roll = mulberry32(value)();
  const span = KAREN_SHIFT_MAX - KAREN_SHIFT_MIN + 1;
  return KAREN_SHIFT_MIN + Math.min(span - 1, Math.floor(roll * span));
}

/** Seconds to respond before her event auto-resolves as "let her cut in". */
export const KAREN_EVENT_TIMER_SECONDS = 12;
/** Gard for calmly explaining triage (the family's thank-you card). */
export const KAREN_CALMED_TIP_GARD = 30;
/** Ward Mood lost when she's allowed to cut the line — double a normal mistake. */
export const KAREN_MOOD_PENALTY = 50;
export const KAREN_LINE = "MY MOTHER HAS BEEN WAITING FOR HOURS! SEE HER RIGHT NOW!";

// ---------------------------------------------------------------------------
// 3b. Mel — the easter egg (the user: "the easter egg is mel in a kimono",
//     then "add all" of the ways to find her). Kitchen Shift's Mel visits in
//     a kimono at most once per shift, joining the triage line; talking to
//     her at the desk gets you a hand-drawn card and a pick-me-up. She shows
//     up four ways: rarely with an arriving patient (MEL_ARRIVAL_CHANCE),
//     always on MEL_FIXED_SHIFT, after MEL_VASE_CLICKS clicks on the
//     dandelion vase on the ER's back wall, or by typing MEL_SECRET_CODE.
// ---------------------------------------------------------------------------

/** Chance, per arriving patient, that Mel walks in with them. */
export const MEL_ARRIVAL_CHANCE = 1 / 40;
/** The shift she always visits on (if she hasn't already that shift). */
export const MEL_FIXED_SHIFT = 7;
/** How far into that shift she walks in (fraction of the clock). */
export const MEL_FIXED_SHIFT_AT = 0.5;
/** Clicks on the dandelion vase that bring her in. */
export const MEL_VASE_CLICKS = 5;
/** Typed during a shift (case-insensitive) to bring her in. */
export const MEL_SECRET_CODE = 'mel';
/** Her visit: a thank-you card worth Gard, plus Sanity and Ward Mood back. */
export const MEL_GIFT_GARD = 40;
export const MEL_SANITY_RESTORE = 30;
export const MEL_MOOD_RESTORE = 20;

/** What she writes on the card — one per shift, cycling. */
export const MEL_CARD_LINES = [
  "I drew you a dandelion! Make a wish — you're doing great.",
  'Brought you a little sunshine for your shift. Don\'t forget to drink water!',
  'I cycled all the way here to say: you\'re the kindest nurse on the ward.',
  'A tulip, a rose and a dandelion — one for every patient you made smile today.',
  "Take a deep breath. You've got this, and I'm cheering for you!",
];

export function melCardLineForShift(shiftNumber) {
  const n = Number.isFinite(shiftNumber) ? Math.max(1, Math.floor(shiftNumber)) : 1;
  return MEL_CARD_LINES[(n - 1) % MEL_CARD_LINES.length];
}

/** Whether Mel walks in with this arriving patient, given a 0..1 roll. */
export function melArrivesWithPatient(roll) {
  return roll < MEL_ARRIVAL_CHANCE;
}

/**
 * The secret-code tracker: append a typed key to the last few typed
 * letters (kept no longer than the code) and report whether they now
 * spell it. Non-letter keys reset it.
 *
 * @returns {{buffer: string, matched: boolean}}
 */
export function typeSecretCodeKey(buffer, key, code = MEL_SECRET_CODE) {
  if (typeof key !== 'string' || !/^[a-z]$/i.test(key)) return { buffer: '', matched: false };
  const next = (buffer + key.toLowerCase()).slice(-code.length);
  return next === code ? { buffer: '', matched: true } : { buffer: next, matched: false };
}

// ---------------------------------------------------------------------------
// 3d. Daily Challenge (the user: "i want to add daily chalenge", then — asked
//     — one seeded shift, a rotating twist and a separate daily board). One
//     shift per UTC day, the same for everyone: its patients (arrival times,
//     conditions, vitals, looks, names) all come from one stream seeded by
//     the date, and each day rolls one twist. Ranks don't apply — everyone
//     plays with NEUTRAL_PERKS (plus the twist's own adjustment) so scores
//     compare. The score is that shift's paycheck.
// ---------------------------------------------------------------------------

/** The tier-2 shift the challenge plays as (16 patients, surgery possible). */
export const DAILY_SHIFT_NUMBER = 12;

/**
 * Each twist's `effect`: `volume` multiplies the patient count,
 * `conditionBias` (ids) gets half of all arrivals, `noDoctor` keeps
 * Dr. Okafor off shift, `noCoffee` breaks the coffee machine, `night` dims
 * the ER, `karen` brings Karen in, and `perks` adjusts the neutral perks
 * (a small compensation where a twist is mostly a handicap).
 */
export const DAILY_TWISTS = [
  { id: 'flu-season', name: 'Flu Season', blurb: 'Half of today\'s patients have fevers, pneumonia or dehydration.', effect: { conditionBias: ['fever', 'pneumonia', 'dehydration'] } },
  { id: 'short-staffed', name: 'Short Staffed', blurb: 'Dr. Okafor called in sick — no rescues today. Patients are a bit more patient.', effect: { noDoctor: true, perks: { patience: 1.1 } } },
  { id: 'broken-coffee', name: 'Coffee Machine Broken', blurb: 'No coffee all shift! Pace yourself — Sanity drains a little slower.', effect: { noCoffee: true, perks: { sanityDrain: 0.75 } } },
  { id: 'night-shift', name: 'Night Shift', blurb: 'The ER is dim and quiet. Sleepy patients wait longer.', effect: { night: true, perks: { patience: 1.15 } } },
  { id: 'karen-day', name: 'Karen Day', blurb: 'Karen is back, and she wants the manager.', effect: { karen: true } },
  { id: 'rush-hour', name: 'Rush Hour', blurb: 'A pile-up downtown: 40% more patients.', effect: { volume: 1.4 } },
];

/** A Date's UTC calendar day as YYYY-MM-DD (the server's daily_date). */
export function hospitalDailyDate(now = new Date()) {
  const d = now instanceof Date && Number.isFinite(now.getTime()) ? now : new Date(0);
  return d.toISOString().slice(0, 10);
}

/** A 32-bit seed from a date string (FNV-1a), stable across browsers. */
export function dailySeed(date) {
  let h = 0x811c9dc5;
  for (const ch of String(date)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** A deterministic 0..1 random stream for a seed (Library Shift's mulberry32). */
export function seededRandom(seed) {
  return mulberry32(seed);
}

/** The day's twist: the same for everyone on that date. */
export function dailyTwistForDate(date) {
  return DAILY_TWISTS[seededRandom(dailySeed(`twist:${date}`))() * DAILY_TWISTS.length | 0];
}

export function findDailyTwist(id) {
  return DAILY_TWISTS.find((t) => t.id === id) ?? null;
}

/** The challenge's perks: everyone neutral, then the twist's adjustment. */
export function dailyPerksForTwist(twist) {
  return { ...NEUTRAL_PERKS, ...(twist?.effect?.perks ?? {}) };
}

/** How many patients the challenge brings in. */
export function dailyPatientVolume(twist) {
  return Math.round(patientVolumeForShift(DAILY_SHIFT_NUMBER) * (twist?.effect?.volume ?? 1));
}

/**
 * The condition for a daily arrival: with a `conditionBias` twist, `biasRoll`
 * under 0.5 picks from the biased list (by `roll`); otherwise the usual pool.
 */
export function dailyConditionForRolls(twist, biasRoll, roll) {
  const bias = (twist?.effect?.conditionBias ?? []).map(findCondition).filter(Boolean);
  if (bias.length && clampRoll(biasRoll) < 0.5) return bias[Math.floor(clampRoll(roll) * bias.length)];
  return conditionForRoll(DAILY_SHIFT_NUMBER, roll);
}

// ---------------------------------------------------------------------------
// 3c. Nurse career rank (the user: "add levels", then picked a career rank
//     over hospital stages/severity levels/level select). XP is earned in
//     every shift — correct triage calls, finished treatment steps,
//     discharges (sicker = more), calming Karen, Mel's visit — and adds up
//     across months in the save (`careerXp`; Start New Month keeps it).
//     Each rank from 2 up unlocks one perk; a later perk of the same kind
//     replaces the earlier one.
// ---------------------------------------------------------------------------

export const XP_CORRECT_TRIAGE = 5;
export const XP_TREATMENT_STEP = 5;
export const XP_DISCHARGE = { red: 25, yellow: 15, green: 10 };
export const XP_KAREN_CALMED = 10;
export const XP_MEL_VISIT = 5;

/** Every perk at 1 — what a Student Nurse works with. */
export const NEUTRAL_PERKS = Object.freeze({ walk: 1, skillZone: 1, patience: 1, sanityDrain: 1, pay: 1 });

/**
 * The ten ranks: `xp` is the career total needed to reach it. A full
 * month earns very roughly 5–8k XP, so Charge Nurse takes about a month
 * of good shifts.
 */
export const NURSE_RANKS = [
  { rank: 1, title: 'Student Nurse', xp: 0, perk: null },
  { rank: 2, title: 'Nursing Intern', xp: 100, perk: { name: 'Comfy Shoes', description: 'walk 10% faster', effect: { walk: 1.1 } } },
  { rank: 3, title: 'Junior Nurse', xp: 300, perk: { name: 'Steady Hands', description: 'skill-check zones 15% wider', effect: { skillZone: 1.15 } } },
  { rank: 4, title: 'Staff Nurse', xp: 600, perk: { name: 'Bedside Manner', description: 'patients wait 10% longer', effect: { patience: 1.1 } } },
  { rank: 5, title: 'Senior Nurse', xp: 1000, perk: { name: 'Second Wind', description: 'Sanity drains 15% slower', effect: { sanityDrain: 0.85 } } },
  { rank: 6, title: 'Triage Specialist', xp: 1600, perk: { name: 'Running Shoes', description: 'walk 20% faster', effect: { walk: 1.2 } } },
  { rank: 7, title: 'Trauma Nurse', xp: 2400, perk: { name: 'Surgeon\'s Hands', description: 'skill-check zones 30% wider', effect: { skillZone: 1.3 } } },
  { rank: 8, title: 'Nurse Practitioner', xp: 3400, perk: { name: 'Pay Raise', description: 'paychecks +10%', effect: { pay: 1.1 } } },
  { rank: 9, title: 'Head Nurse', xp: 4700, perk: { name: 'Reassuring Presence', description: 'patients wait 20% longer', effect: { patience: 1.2 } } },
  { rank: 10, title: 'Charge Nurse', xp: 6200, perk: { name: 'Charge Nurse Pay', description: 'paychecks +25%', effect: { pay: 1.25 } } },
];

function safeXp(xp) {
  return Number.isFinite(xp) && xp > 0 ? xp : 0;
}

/** The rank a career XP total has reached. */
export function rankForXp(xp) {
  const total = safeXp(xp);
  let reached = NURSE_RANKS[0];
  for (const r of NURSE_RANKS) if (total >= r.xp) reached = r;
  return reached;
}

/**
 * Where a career XP total sits within its rank, for progress bars.
 * At the top rank `next` is null and `fraction` is 1.
 */
export function rankProgress(xp) {
  const total = safeXp(xp);
  const rank = rankForXp(total);
  const next = NURSE_RANKS.find((r) => r.rank === rank.rank + 1) ?? null;
  if (!next) return { rank, next: null, intoRank: total - rank.xp, needed: 0, fraction: 1 };
  const needed = next.xp - rank.xp;
  return { rank, next, intoRank: total - rank.xp, needed, fraction: (total - rank.xp) / needed };
}

/** Every perk unlocked up to `rankNumber`, later ones replacing earlier ones of the same kind. */
export function perksForRank(rankNumber) {
  const perks = { ...NEUTRAL_PERKS };
  for (const r of NURSE_RANKS) {
    if (r.rank <= rankNumber && r.perk) Object.assign(perks, r.perk.effect);
  }
  return perks;
}

/** The ranks newly reached going from `beforeXp` to `afterXp` (usually zero or one). */
export function ranksGained(beforeXp, afterXp) {
  const from = rankForXp(beforeXp).rank;
  const to = rankForXp(afterXp).rank;
  return NURSE_RANKS.filter((r) => r.rank > from && r.rank <= to);
}

// ---------------------------------------------------------------------------
// 4. Triage levels and vitals. vitalsForLevel generates a chart that
//    triageLevelForVitals classifies back to the same level, so the Triage
//    Sort is a real read-the-vitals decision with one right answer.
// ---------------------------------------------------------------------------

export const TRIAGE_LEVELS = [
  { id: 'red', name: 'Red', label: 'Critical', color: '#d9534f' },
  { id: 'yellow', name: 'Yellow', label: 'Urgent', color: '#e8b440' },
  { id: 'green', name: 'Green', label: 'Minor', color: '#5fa86a' },
];

export function findTriageLevel(levelId) {
  return TRIAGE_LEVELS.find((l) => l.id === levelId) ?? null;
}

/** Red-flag thresholds — any one makes a patient Red. */
export const RED_SPO2_BELOW = 90;
export const RED_HR_ABOVE = 130;
export const RED_SYSTOLIC_BELOW = 90;
/** Yellow-flag thresholds (when nothing is Red). */
export const YELLOW_TEMP_AT_LEAST = 38.5;
export const YELLOW_HR_ABOVE = 100;

/** The legend printed on the Triage Sort chart. */
export const TRIAGE_LEGEND = [
  `Red: SpO₂ < ${RED_SPO2_BELOW}%, HR > ${RED_HR_ABOVE} or BP < ${RED_SYSTOLIC_BELOW}`,
  `Yellow: temp ≥ ${YELLOW_TEMP_AT_LEAST}°C or HR ${YELLOW_HR_ABOVE + 1}–${RED_HR_ABOVE}`,
  'Green: everything normal',
];

/**
 * Classifies a set of vitals.
 *
 * @param {{hr: number, systolic: number, diastolic: number, spo2: number, temp: number}} v
 * @returns {'red' | 'yellow' | 'green'}
 */
export function triageLevelForVitals(v) {
  if (v.spo2 < RED_SPO2_BELOW || v.hr > RED_HR_ABOVE || v.systolic < RED_SYSTOLIC_BELOW) return 'red';
  if (v.temp >= YELLOW_TEMP_AT_LEAST || v.hr > YELLOW_HR_ABOVE) return 'yellow';
  return 'green';
}

function lerpInt(min, max, roll) {
  return Math.round(min + clampRoll(roll) * (max - min));
}

function lerpTenth(min, max, roll) {
  return Math.round((min + clampRoll(roll) * (max - min)) * 10) / 10;
}

/**
 * Generates a vitals chart for a triage level from five rolls in [0, 1).
 * Red patients get exactly one red flag (picked by rolls[0]) with the rest
 * normal-ish; Yellow get a fever or a raised HR; Green are normal.
 *
 * @param {'red' | 'yellow' | 'green'} level
 * @param {number[]} rolls - at least 5 values in [0, 1); missing ones default to 0.5.
 * @returns {{hr: number, systolic: number, diastolic: number, spo2: number, temp: number}}
 */
export function vitalsForLevel(level, rolls = []) {
  const r = (i) => (Number.isFinite(rolls[i]) ? rolls[i] : 0.5);
  const normal = {
    hr: lerpInt(62, 96, r(1)),
    systolic: lerpInt(105, 135, r(2)),
    spo2: lerpInt(95, 99, r(3)),
    temp: lerpTenth(36.4, 37.6, r(4)),
  };
  let v = { ...normal };
  if (level === 'red') {
    const flag = Math.floor(clampRoll(r(0)) * 3);
    if (flag === 0) v.spo2 = lerpInt(78, 88, r(3));
    else if (flag === 1) v.hr = lerpInt(135, 165, r(1));
    else v.systolic = lerpInt(70, 85, r(2));
  } else if (level === 'yellow') {
    if (clampRoll(r(0)) < 0.5) v.temp = lerpTenth(38.6, 40.2, r(4));
    else v.hr = lerpInt(104, 126, r(1));
  }
  v.diastolic = Math.round(v.systolic * 0.62);
  return v;
}

// ---------------------------------------------------------------------------
// 5. Conditions — each patient has one: a triage level, a complaint, an
//    ordered treatment plan, and (if it includes 'meds') a drug and dose.
// ---------------------------------------------------------------------------

/** Every treatment step a plan can contain. */
export const TREATMENTS = ['vitals', 'oxygen', 'iv', 'bandage', 'meds', 'surgery'];

/** Steps done as a minigame right at the bed (meds needs the cabinet, surgery the OR). */
export const BED_MINIGAME_TREATMENTS = ['vitals', 'oxygen', 'iv', 'bandage'];

export const TREATMENT_LABELS = {
  vitals: 'Vitals',
  oxygen: 'Oxygen',
  iv: 'IV',
  bandage: 'Bandage',
  meds: 'Meds',
  surgery: 'Surgery',
};

// Bandage steps need a roll from the 2nd-Floor Supply Cart in hand
// (engine-state.js's pickUpBandage) — the user asked for a supply cart "and
// make a second floor where they are on", and for bandages to be more
// common: burn, dog bite and bad fall joined sprain, cut, broken arm and
// crash injuries.

/** Surgery cases only arrive from this shift on, so shift 1 teaches the basics. Was 4 — the user asked for surgeries "on shift 2". */
export const SURGERY_START_SHIFT = 2;

/** Organ transplants join the surgery cases from this shift on. */
export const TRANSPLANT_START_SHIFT = 4;

export const CONDITIONS = [
  { id: 'sprain', name: 'Sprained ankle', level: 'green', complaint: 'Twisted my ankle on the stairs.', plan: ['vitals', 'bandage'] },
  { id: 'migraine', name: 'Migraine', level: 'green', complaint: 'Pounding headache since this morning.', plan: ['vitals', 'meds'], med: { drug: 'Ibuprofen', dose: 2 } },
  { id: 'burn', name: 'Kitchen burn', level: 'green', complaint: 'Grabbed a hot pan by the handle.', plan: ['vitals', 'bandage'] },
  { id: 'dehydration', name: 'Dehydration', level: 'green', complaint: 'Dizzy after a long run in the heat.', plan: ['vitals', 'iv'] },
  { id: 'cut', name: 'Deep cut', level: 'yellow', complaint: 'Sliced my hand open cooking dinner.', plan: ['vitals', 'bandage', 'meds'], med: { drug: 'Amoxicillin', dose: 2 } },
  { id: 'bite', name: 'Dog bite', level: 'yellow', complaint: "The neighbor's dog bit my leg.", plan: ['vitals', 'bandage', 'meds'], med: { drug: 'Amoxicillin', dose: 1 } },
  { id: 'fall', name: 'Bad fall', level: 'yellow', complaint: 'Slipped in the shower — scraped and woozy.', plan: ['vitals', 'bandage', 'iv'] },
  { id: 'fever', name: 'High fever', level: 'yellow', complaint: 'Burning up and shivering all night.', plan: ['vitals', 'iv', 'meds'], med: { drug: 'Acetaminophen', dose: 2 } },
  { id: 'fracture', name: 'Broken arm', level: 'yellow', complaint: 'Fell off my bike — my arm looks wrong.', plan: ['vitals', 'meds', 'bandage'], med: { drug: 'Morphine', dose: 1 } },
  { id: 'pneumonia', name: 'Pneumonia', level: 'yellow', complaint: "Coughing for a week, can't catch my breath.", plan: ['vitals', 'oxygen', 'iv'] },
  { id: 'asthma', name: 'Asthma attack', level: 'red', complaint: "Can't… breathe… inhaler isn't working.", plan: ['oxygen', 'meds', 'vitals'], med: { drug: 'Albuterol', dose: 2 } },
  { id: 'allergy', name: 'Allergic reaction', level: 'red', complaint: 'Ate peanuts — throat is closing up.', plan: ['oxygen', 'meds'], med: { drug: 'Epinephrine', dose: 1 } },
  { id: 'appendicitis', name: 'Appendicitis', level: 'red', complaint: 'Sharp pain in my lower right side.', plan: ['vitals', 'iv', 'surgery'], minShift: SURGERY_START_SHIFT, surgeryItem: 'mesh' },
  { id: 'crash', name: 'Car crash injuries', level: 'red', complaint: 'Car accident — bleeding badly.', plan: ['oxygen', 'iv', 'surgery', 'bandage'], minShift: SURGERY_START_SHIFT, surgeryItem: 'plate' },
  // Transplants (the user: "get organs if theres an transplant") — the
  // matching organ comes from the OR's Organ Cooler.
  { id: 'kidney-failure', name: 'Kidney failure', level: 'red', complaint: "My dialysis isn't working anymore.", plan: ['vitals', 'iv', 'surgery'], minShift: TRANSPLANT_START_SHIFT, surgeryItem: 'kidney' },
  { id: 'liver-failure', name: 'Liver failure', level: 'red', complaint: "I've turned yellow and I'm so tired.", plan: ['vitals', 'iv', 'surgery'], minShift: TRANSPLANT_START_SHIFT, surgeryItem: 'liver' },
  { id: 'heart-failure', name: 'Heart failure', level: 'red', complaint: 'My heart is giving out — the donor heart just arrived.', plan: ['oxygen', 'vitals', 'surgery'], minShift: TRANSPLANT_START_SHIFT, surgeryItem: 'heart' },
];

// ---------------------------------------------------------------------------
// Surgery items (the user: "for surguries you have to enter the room and get
// organs if theres an transplant and sclapels and when you get the item you
// have to do a skillcheck", then "do all"). Every operation needs a scalpel
// from the OR's Instrument Tray plus one item: the matching organ from the
// OR's Organ Cooler for a transplant, or an implant from the Supply Room's
// Implant Shelf. Each source also holds look-alike decoys; taking one that
// no waiting surgery needs is a mistake. Taking an item is a `grab` skill
// check; at the table each item is its own stage (Incision → Place → Sutures).
// ---------------------------------------------------------------------------

/** id -> { name, source, color } for everything a surgery can need. */
export const SURGERY_ITEMS = {
  scalpel: { name: 'Scalpel', source: 'instrument-tray', color: '#c8d0e0' },
  kidney: { name: 'Kidney', source: 'organ-cooler', color: '#c0506a' },
  liver: { name: 'Liver', source: 'organ-cooler', color: '#9a3a3a' },
  heart: { name: 'Heart', source: 'organ-cooler', color: '#e04a5f' },
  mesh: { name: 'Mesh patch', source: 'implant-shelf', color: '#f2f0ea' },
  plate: { name: 'Bone plate', source: 'implant-shelf', color: '#b8c4d8' },
};

/** Each source's display: the real items plus decoys (decoys are never needed). */
export const SURGERY_SOURCES = {
  'instrument-tray': { name: 'Instrument Tray', items: ['scalpel'], decoys: ['Forceps', 'Scissors', 'Clamp'] },
  'organ-cooler': { name: 'Organ Cooler', items: ['kidney', 'liver', 'heart'], decoys: ['Lung', 'Cornea'] },
  'implant-shelf': { name: 'Implant Shelf', items: ['mesh', 'plate'], decoys: ['Stent', 'Steel pin'] },
};

/** The second item a condition's surgery needs (besides the scalpel), or null. */
export function surgeryItemFor(conditionId) {
  return findCondition(conditionId)?.surgeryItem ?? null;
}

/** Whether a condition's surgery is an organ transplant. */
export function isTransplant(conditionId) {
  return SURGERY_ITEMS[surgeryItemFor(conditionId)]?.source === 'organ-cooler';
}

/** The table's three stages for this condition: one per item, then closing up. */
export function surgeryStagesFor(conditionId) {
  const item = SURGERY_ITEMS[surgeryItemFor(conditionId)];
  if (!item) return [...SURGERY_STAGES];
  return ['Incision', isTransplant(conditionId) ? `Transplant ${item.name}` : `Place ${item.name}`, 'Sutures'];
}

export function findCondition(conditionId) {
  return CONDITIONS.find((c) => c.id === conditionId) ?? null;
}

/** Conditions that can arrive on a given shift (surgery cases gated by SURGERY_START_SHIFT). */
export function conditionsForShift(shiftNumber) {
  const shift = clampShift(shiftNumber);
  return CONDITIONS.filter((c) => (c.minShift ?? 1) <= shift);
}

/** Picks a condition for a roll in [0, 1) from those available on this shift. */
export function conditionForRoll(shiftNumber, roll) {
  const pool = conditionsForShift(shiftNumber);
  return pool[Math.floor(clampRoll(roll) * pool.length)];
}

// ---------------------------------------------------------------------------
// 6. Medications — the Med Cabinet shows the ordered drug among look-alike
//    names, so reading the label matters.
// ---------------------------------------------------------------------------

export const MEDICATIONS = [
  { name: 'Amoxicillin', color: '#e8b440' },
  { name: 'Amoxapine', color: '#e0a83a' },
  { name: 'Acetaminophen', color: '#f2f0ea' },
  { name: 'Acetazolamide', color: '#ece6da' },
  { name: 'Albuterol', color: '#7fb0d6' },
  { name: 'Atenolol', color: '#8cbbe0' },
  { name: 'Epinephrine', color: '#e06a5b' },
  { name: 'Ephedrine', color: '#e47a6b' },
  { name: 'Ibuprofen', color: '#c65f7c' },
  { name: 'Ibandronate', color: '#c8708a' },
  { name: 'Morphine', color: '#9a7ac0' },
  { name: 'Moxifloxacin', color: '#a688c6' },
];

/** Dose choices offered in the Meds Dispensing overlay. */
export const DOSE_CHOICES = [1, 2, 3];

/**
 * The Med Cabinet is a search: its shelves hold this many bottles, the
 * ordered drug exactly once among decoys (the user: "when you get the meds
 * you need to search for the med").
 */
export const MED_CABINET_SHELVES = 3;
export const MED_CABINET_BOTTLES_PER_SHELF = 9;
export const MED_CABINET_BOTTLES = MED_CABINET_SHELVES * MED_CABINET_BOTTLES_PER_SHELF;
/** Share of decoys that are the ordered drug's look-alikes (same first letter), so the shelf is full of near misses. */
export const MED_CABINET_LOOKALIKE_SHARE = 0.35;

/**
 * Fills the cabinet: `MED_CABINET_BOTTLES` drug names, shuffled, with
 * `orderDrug` exactly once and every other bottle a decoy (look-alikes
 * repeated). `random` is a () => [0, 1) source so tests can seed it.
 *
 * @param {string} orderDrug
 * @param {() => number} random
 * @returns {string[]}
 */
export function medCabinetStock(orderDrug, random) {
  const decoys = MEDICATIONS.map((m) => m.name).filter((n) => n !== orderDrug);
  const lookAlikes = decoys.filter((n) => n[0] === orderDrug[0]);
  const pickFrom = (list) => list[Math.min(list.length - 1, Math.floor(clampRoll(random()) * list.length))];
  const stock = [orderDrug];
  // Every look-alike appears at least once, then the rest is a weighted mix.
  stock.push(...lookAlikes);
  while (stock.length < MED_CABINET_BOTTLES) {
    stock.push(lookAlikes.length && random() < MED_CABINET_LOOKALIKE_SHARE ? pickFrom(lookAlikes) : pickFrom(decoys));
  }
  for (let i = stock.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(clampRoll(random()) * (i + 1)));
    [stock[i], stock[j]] = [stock[j], stock[i]];
  }
  return stock;
}

/**
 * Grades a Meds Dispensing pick.
 *
 * @param {{drug: string, dose: number}} order
 * @param {string} pickedDrug
 * @param {number} pickedDose
 * @returns {'correct' | 'wrong-drug' | 'wrong-dose'}
 */
export function gradeMedsPick(order, pickedDrug, pickedDose) {
  if (pickedDrug !== order.drug) return 'wrong-drug';
  if (pickedDose !== order.dose) return 'wrong-dose';
  return 'correct';
}

// ---------------------------------------------------------------------------
// 7. Skill checks — the timing bar behind Vitals, Oxygen, IV and Surgery
//    (the user: "for the vitals checks and the stuff that pumps oxygen and
//    surgeries i want there to be skill checks"). Same centered gold zone
//    and bouncing sweep as Library Shift's, with a per-treatment width and
//    hit count: Oxygen takes three good pumps, Surgery three stages.
// ---------------------------------------------------------------------------

export const SKILL_CHECKS = {
  vitals: { zoneWidth: 0.22, hits: 1, speedMultiplier: 1 },
  iv: { zoneWidth: 0.16, hits: 1, speedMultiplier: 1 },
  surgery: { zoneWidth: 0.14, hits: 3, speedMultiplier: 1.15 },
  // Lifting a surgical item carefully off its tray/cooler/shelf (a miss just
  // drops it — no mistake — and you try again).
  grab: { zoneWidth: 0.24, hits: 1, speedMultiplier: 0.95 },
  // Giving the meds at the bed (the user: "when you go and get it to the
  // patient you have to do a skill check") — push the syringe into the IV port.
  meds: { zoneWidth: 0.18, hits: 1, speedMultiplier: 1.05 },
};

/** Surgery's three stages, one per hit. */
export const SURGERY_STAGES = ['Incision', 'Repair', 'Sutures'];

export function skillCheckHitsRequired(kind) {
  return SKILL_CHECKS[kind]?.hits ?? 1;
}

/**
 * The gold zone for a skill check, centered at 0.5.
 *
 * @param {string} kind - a SKILL_CHECKS key (unknown kinds use vitals').
 * @param {number} [scale=1] - shaky-hands shrink factor.
 * @returns {{start: number, end: number, width: number}}
 */
export function skillCheckSuccessZone(kind, scale = 1) {
  const base = (SKILL_CHECKS[kind] ?? SKILL_CHECKS.vitals).zoneWidth;
  const width = base * (Number.isFinite(scale) && scale > 0 ? scale : 1);
  return { start: 0.5 - width / 2, end: 0.5 + width / 2, width };
}

export function isSkillCheckSuccess(gaugePosition, zone) {
  return Number.isFinite(gaugePosition) && gaugePosition >= zone.start && gaugePosition <= zone.end;
}

const SKILL_CHECK_SWEEP_SPEED_BASE = 0.6;
const SKILL_CHECK_SWEEP_SPEED_MAX = 1.5;
const SKILL_CHECK_SWEEP_SHIFT_SATURATION = 12;

/** Sweep speed (fraction of the bar per second), ramping with shift number. */
export function skillCheckSweepSpeed(shiftNumber, kind) {
  const ramp = shiftRamp(shiftNumber, SKILL_CHECK_SWEEP_SHIFT_SATURATION);
  const base = SKILL_CHECK_SWEEP_SPEED_BASE + (SKILL_CHECK_SWEEP_SPEED_MAX - SKILL_CHECK_SWEEP_SPEED_BASE) * ramp;
  return base * (SKILL_CHECKS[kind]?.speedMultiplier ?? 1);
}

// ---------------------------------------------------------------------------
// 7.5. Oxygen — a search scene, not a timing bar (the user: "make it find
//      hearts and there will be skulls that symbol missed skill checks").
//      Hearts and skulls are scattered over the scene; each heart clicked
//      is one good pump of the bag, and clicking a skull is a missed skill
//      check — a mistake, with the minigame staying open for a retry.
// ---------------------------------------------------------------------------

/** Hearts to find — one pump each. */
export const OXYGEN_HEARTS = 3;
/** Skull decoys scattered among them. */
export const OXYGEN_SKULLS = 5;

/**
 * Grades a click on the Oxygen scene.
 *
 * @param {{kind: 'heart' | 'skull', found: boolean} | null} item - the item under the click, if any.
 * @returns {'pump' | 'miss' | 'nothing'} 'pump' for a heart, 'miss' for a skull, 'nothing' for empty space or anything already clicked (a clicked skull fades out, so one slip never costs twice).
 */
export function gradeOxygenClick(item) {
  if (!item || item.found) return 'nothing';
  return item.kind === 'skull' ? 'miss' : 'pump';
}

// ---------------------------------------------------------------------------
// 8. Bandage trace — hold and trace the dashed line along the wound.
// ---------------------------------------------------------------------------

/** A sample within this many pixels of the path counts as on it. */
export const BANDAGE_TOLERANCE_PX = 16;
/** Share of the path that must be covered. */
export const BANDAGE_MIN_COVERAGE = 0.85;
/** Share of samples that must be on the path. */
export const BANDAGE_MIN_ACCURACY = 0.7;
/** The path is split into this many segments for coverage. */
export const BANDAGE_COVERAGE_BUCKETS = 20;

/** Distance from point p to segment ab, plus the position t (0..1) along it. */
function projectOntoSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq, 0, 1);
  const cx = a.x + dx * t;
  const cy = a.y + dy * t;
  return { distance: Math.hypot(p.x - cx, p.y - cy), t };
}

/**
 * The nearest point on a polyline to p: its distance and how far along the
 * whole path (0..1, by length) it sits.
 *
 * @param {{x: number, y: number}} p
 * @param {{x: number, y: number}[]} path - at least 2 points.
 * @returns {{distance: number, along: number}}
 */
export function nearestOnPath(p, path) {
  const lengths = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const len = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    lengths.push(len);
    total += len;
  }
  let best = { distance: Infinity, along: 0 };
  let walked = 0;
  for (let i = 1; i < path.length; i++) {
    const { distance, t } = projectOntoSegment(p, path[i - 1], path[i]);
    if (distance < best.distance) best = { distance, along: total === 0 ? 0 : (walked + t * lengths[i - 1]) / total };
    walked += lengths[i - 1];
  }
  return best;
}

/**
 * Grades a bandage trace.
 *
 * @param {{x: number, y: number}[]} samples - pointer positions while held.
 * @param {{x: number, y: number}[]} path
 * @returns {{coverage: number, accuracy: number, success: boolean}}
 */
export function gradeBandageTrace(samples, path) {
  if (!Array.isArray(samples) || samples.length === 0 || !Array.isArray(path) || path.length < 2) {
    return { coverage: 0, accuracy: 0, success: false };
  }
  const covered = new Set();
  let onPath = 0;
  for (const s of samples) {
    const { distance, along } = nearestOnPath(s, path);
    if (distance <= BANDAGE_TOLERANCE_PX) {
      onPath++;
      covered.add(Math.min(BANDAGE_COVERAGE_BUCKETS - 1, Math.floor(along * BANDAGE_COVERAGE_BUCKETS)));
    }
  }
  const coverage = covered.size / BANDAGE_COVERAGE_BUCKETS;
  const accuracy = onPath / samples.length;
  return { coverage, accuracy, success: coverage >= BANDAGE_MIN_COVERAGE && accuracy >= BANDAGE_MIN_ACCURACY };
}

/**
 * A wavy wound path across the overlay's work area from rolls in [0, 1).
 *
 * @param {number[]} rolls - 5 values.
 * @returns {{x: number, y: number}[]} 6 points, left to right.
 */
export function bandagePathForRolls(rolls = []) {
  const points = [];
  for (let i = 0; i < 6; i++) {
    const roll = Number.isFinite(rolls[i]) ? rolls[i] : 0.5;
    points.push({ x: 250 + i * 92, y: Math.round(300 + (clampRoll(roll) - 0.5) * 110) });
  }
  return points;
}

// ---------------------------------------------------------------------------
// 9. Patience — queue wait at triage and treatment patience in a bed. Both
//    shrink with shift number and are scaled by Ward Mood at arrival.
// ---------------------------------------------------------------------------

const QUEUE_WAIT_BASE_SECONDS = 90;
const QUEUE_WAIT_MIN_SECONDS = 45;
const QUEUE_WAIT_SHIFT_SATURATION = 10;

export function queueWaitSecondsForShift(shiftNumber) {
  const ramp = shiftRamp(shiftNumber, QUEUE_WAIT_SHIFT_SATURATION);
  return QUEUE_WAIT_BASE_SECONDS - (QUEUE_WAIT_BASE_SECONDS - QUEUE_WAIT_MIN_SECONDS) * ramp;
}

/** Treatment patience at shift 1, by triage level — Red patients can't wait as long. */
export const TREATMENT_PATIENCE_SECONDS = { red: 90, yellow: 120, green: 150 };
/** By late shifts patience shrinks by up to this fraction. */
const TREATMENT_PATIENCE_MAX_SHRINK = 0.35;
const TREATMENT_PATIENCE_SHIFT_SATURATION = 12;

export function treatmentPatienceSeconds(level, shiftNumber) {
  const base = TREATMENT_PATIENCE_SECONDS[level] ?? TREATMENT_PATIENCE_SECONDS.yellow;
  return base * (1 - TREATMENT_PATIENCE_MAX_SHRINK * shiftRamp(shiftNumber, TREATMENT_PATIENCE_SHIFT_SATURATION));
}

// ---------------------------------------------------------------------------
// 10. Ward Mood — Library Mood's analog: −25 per mistake, scales patience.
// ---------------------------------------------------------------------------

export const WARD_MOOD_MAX = 100;
export const WARD_MOOD_DRAIN_PER_MISTAKE = 25;
const WARD_MOOD_MIN_PATIENCE_MULTIPLIER = 0.6;

export function clampWardMood(mood) {
  return clamp(Number.isFinite(mood) ? mood : 0, 0, WARD_MOOD_MAX);
}

export function patienceMultiplierForWardMood(mood) {
  const fraction = clampWardMood(mood) / WARD_MOOD_MAX;
  return WARD_MOOD_MIN_PATIENCE_MULTIPLIER + (1 - WARD_MOOD_MIN_PATIENCE_MULTIPLIER) * fraction;
}

// ---------------------------------------------------------------------------
// 11. Player Sanity — identical to Library/Kitchen Shift's.
// ---------------------------------------------------------------------------

export const SANITY_MAX = 100;
export const SANITY_DRAIN_PER_SECOND = SANITY_MAX / 150;
export const SANITY_DRAIN_PER_UPSET = 15;
const SANITY_MIN_WALK_MULTIPLIER = 0.6;

export function clampSanity(sanity) {
  return clamp(Number.isFinite(sanity) ? sanity : 0, 0, SANITY_MAX);
}

export function walkSpeedMultiplierForSanity(sanity) {
  const fraction = clampSanity(sanity) / SANITY_MAX;
  return SANITY_MIN_WALK_MULTIPLIER + (1 - SANITY_MIN_WALK_MULTIPLIER) * fraction;
}

/** Pushing a gurney is slower than walking. */
export const GURNEY_WALK_MULTIPLIER = 0.8;

// ---------------------------------------------------------------------------
// 12. Coffee Pour — ported from Library Shift (including v2.19's spill).
// ---------------------------------------------------------------------------

export const COFFEE_POUR_SECONDS_TO_BRIM = 2.2;
export const COFFEE_POUR_BAND_WIDTH = 0.12;
export const COFFEE_POUR_GOOD_MARGIN = 0.1;
export const COFFEE_PERFECT_TIP_GARD = 10;
export const COFFEE_SANITY_RESTORE = { perfect: SANITY_MAX, good: 70, sloppy: 40, spilled: -50 };
/**
 * Ward Mood restored per grade — a caffeinated nurse calms the ward (the
 * user: "make the coffee also improve the mood"). Unlike Library Shift,
 * where coffee only touches Sanity. A spill helps nobody.
 */
export const COFFEE_MOOD_RESTORE = { perfect: 20, good: 12, sloppy: 6, spilled: 0 };

export function coffeePourTargetBand(roll) {
  const r = clamp(Number.isFinite(roll) ? roll : 0, 0, 1);
  const center = 0.62 + r * 0.24;
  return { low: center - COFFEE_POUR_BAND_WIDTH / 2, high: center + COFFEE_POUR_BAND_WIDTH / 2 };
}

export function gradeCoffeePour(fill, band) {
  const f = Number.isFinite(fill) ? fill : 0;
  if (f >= 1) return 'spilled';
  if (f >= band.low && f <= band.high) return 'perfect';
  if (f >= band.low - COFFEE_POUR_GOOD_MARGIN && f <= band.high + COFFEE_POUR_GOOD_MARGIN) return 'good';
  return 'sloppy';
}

// ---------------------------------------------------------------------------
// 13. Pay — shiftPaycheck, step tips, discharge bonuses, star rating.
// ---------------------------------------------------------------------------

export const SHIFT_PAYCHECK_FULL = 4000;
export const SHIFT_PAYCHECK_PENALTY_PER_MISTAKE = 500;
export const SHIFT_PAYCHECK_MIN = 500;

export function shiftPaycheck(mistakeCount) {
  const mistakes = Number.isFinite(mistakeCount) && mistakeCount > 0 ? mistakeCount : 0;
  return Math.max(SHIFT_PAYCHECK_MIN, SHIFT_PAYCHECK_FULL - mistakes * SHIFT_PAYCHECK_PENALTY_PER_MISTAKE);
}

/** Gard tip for each treatment step completed. */
export const TREATMENT_TIP_GARD = 5;

/** Gard bonus for discharging a patient, by triage level. */
export const DISCHARGE_GARD = { red: 60, yellow: 40, green: 25 };

export const RATING_MAX = 5;
export const RATING_PENALTY_PER_WALKOUT = 1.5;

export function clampRating(rating) {
  return clamp(Number.isFinite(rating) ? rating : 0, 0, RATING_MAX);
}

export function paycheckMultiplierForRating(rating) {
  return clampRating(rating) / RATING_MAX;
}

/** Seconds of handover after 7:00 PM before the Charge Nurse lets you in. */
export const CLOSING_WAIT_SECONDS = 20;

// ---------------------------------------------------------------------------
// 14. Hallucinations — Library Shift's v2.16 rules.
// ---------------------------------------------------------------------------

export const HALLUCINATION_START_SANITY = 25;

export function hallucinationIntensity(sanity) {
  const s = clampSanity(sanity);
  if (s >= HALLUCINATION_START_SANITY) return 0;
  return (HALLUCINATION_START_SANITY - s) / HALLUCINATION_START_SANITY;
}

export const SHAKY_HANDS_MIN_ZONE_SCALE = 0.5;
export const SHAKY_HANDS_MAX_SWEEP_MULTIPLIER = 1.6;

export function shakyHandsZoneScale(intensity) {
  const i = clamp(Number.isFinite(intensity) ? intensity : 0, 0, 1);
  return 1 - (1 - SHAKY_HANDS_MIN_ZONE_SCALE) * i;
}

export function shakyHandsSweepMultiplier(intensity) {
  const i = clamp(Number.isFinite(intensity) ? intensity : 0, 0, 1);
  return 1 + (SHAKY_HANDS_MAX_SWEEP_MULTIPLIER - 1) * i;
}

/** Chance per second, at full intensity, that carried meds slip from your hands. */
export const MEDS_DROP_CHANCE_PER_SECOND = 0.06;
export const HALLUCINATION_STARTLE_SANITY = 5;
export const ZERO_SANITY_PAY_CUT_PER_10S = 0.02;
/**
 * Seconds at 0 Sanity before you collapse — game over for the shift (the
 * user: "after 20 seconds you have 0% sanity you instantly die"). Running
 * out of stars is an instant game over too; either way the shift pays
 * nothing and is retried (the user picked "Retry the shift").
 */
export const ZERO_SANITY_COLLAPSE_SECONDS = 20;
export const ZERO_SANITY_PAY_CUT_MAX = 0.3;

export function hallucinationPayMultiplier(zeroSanitySeconds) {
  const seconds = Number.isFinite(zeroSanitySeconds) && zeroSanitySeconds > 0 ? zeroSanitySeconds : 0;
  return 1 - Math.min(ZERO_SANITY_PAY_CUT_MAX, Math.floor(seconds / 10) * ZERO_SANITY_PAY_CUT_PER_10S);
}

export function monthTotal(shiftPayouts) {
  return Array.isArray(shiftPayouts) ? shiftPayouts.reduce((sum, p) => sum + (Number.isFinite(p) ? p : 0), 0) : 0;
}

// ---------------------------------------------------------------------------
// 15. Helping staff — the user picked all three jobs for the background
//     workers ("help"): Dr. Okafor rescues patients about to be transferred,
//     the Orderly wheels surgery patients to the OR on request, and the
//     Stock tech brings bandage rolls downstairs now and then.
// ---------------------------------------------------------------------------

/** Dr. Okafor steps in for a patient below this share of their patience... */
export const DOCTOR_ASSIST_PATIENCE_FRACTION = 0.3;
/** ...finishes their current step (never surgery) and tops their patience up to at least this share... */
export const DOCTOR_ASSIST_PATIENCE_REFILL = 0.5;
/** ...then needs this long before he can help again (also his delay at shift start). */
export const DOCTOR_ASSIST_COOLDOWN_SECONDS = 50;

/** The Stock tech's rhythm: this long upstairs, then this long downstairs with bandage rolls. */
export const STOCK_TECH_UPSTAIRS_SECONDS = 35;
export const STOCK_TECH_DOWNSTAIRS_SECONDS = 25;
