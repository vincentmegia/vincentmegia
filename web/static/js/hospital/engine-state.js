// Pure, DOM-free shift-state management for Hospital Shift
// (docs/features/hospital-shift.md). Same contract as Library Shift's
// engine-state.js: every function takes a state and returns a new one (or
// the same object when the call is a no-op, so callers can detect "nothing
// happened" with `next === state`), and nothing reads a clock — time deltas
// are explicit arguments.
//
// State shape (`ShiftState`):
//   {
//     phase: 'not-started' | 'playing' | 'closing-wait' | 'paycheck' | 'game-over',
//     gameOverReason: null | 'sanity' | 'stars',  // why a 'game-over' shift ended
//     shiftNumber, clockSeconds, totalClockSeconds, closingWaitSecondsRemaining,
//
//     triageQueue: Patient[],       // waiting at the Triage Desk (wait timer each)
//     beds: (BedPatient | null)[],  // BED_COUNT slots
//     carried: null | { kind: 'meds' | 'gurney', bedIndex, patientId }, // what's in your hands
//     hasBandage: boolean,          // a bandage roll in your pocket — never blocks the hands
//       // (the user: "even when i have bandage on i should still be able to
//       // perform the surgery"); any patient's Bandage step uses it
//     activeTask: null | { kind, bedIndex, patientId },
//       // the minigame in progress: 'vitals' | 'oxygen' | 'iv' | 'bandage'
//       // (at a bed), 'meds-dispense' (searching the cabinet), 'meds-give'
//       // (the skill check at the bed, meds still in hand), 'surgery' (in the OR)
//
//     orderlyGurney: null | { bedIndex, patientId }, // the Orderly wheeling a patient to the OR
//     orPatient: null | { bedIndex, patientId },     // a patient the Orderly left waiting on the OR table
//     doctorCooldownSeconds: number,                 // until Dr. Okafor can step in again
//     doctorAssists: number,                         // times he did this shift
//     karen: { shiftNumber, active, triggered, resolved, outcome, timerSecondsRemaining },
//     mel: { waiting, visited },  // the easter egg: in the triage line / already visited this shift
//     hunger, thirst, zeroHungerSeconds, zeroThirstSeconds,  // rules.js "Hunger and Thirst"
//     night, flashlight: { on, battery, spares },  // rules.js "Night shifts and the flashlight"
//     surgeryKit: { scalpel, item },  // scrubbed-in items for the next operation (item = SURGERY_ITEMS id)
//     xp,     // career XP earned this shift (rules.js's XP_*); the game adds it to the save
//     perks,  // { walk, skillZone, patience, sanityDrain, pay } from the nurse's rank (rules.js's perksForRank)
//     wardMood, sanity, rating, walkouts, transfers, discharged,
//     zeroSanitySeconds, mistakeCount, bonusGard, payout,
//   }
//   Patient    = { id, conditionId, level, waitRemainingSeconds, waitMaxSeconds }
//   BedPatient = { id, conditionId, level, plan: string[], step: number,
//                  patienceRemainingSeconds, patienceMaxSeconds, inSurgery: boolean }
//
// Failing a minigame (a missed skill check, a bad bandage, the wrong drug)
// is a mistake but leaves `activeTask` set so the player retries at once —
// Library Shift's retry-on-failure. The patient's patience keeps ticking
// meanwhile, except while they're in surgery (their gurney is being pushed
// or they're on the table), so a patient can't be "transferred" mid-op.

import {
  shiftClockSecondsForShift,
  shiftPaycheck,
  findCondition,
  BED_MINIGAME_TREATMENTS,
  treatmentPatienceSeconds,
  WARD_MOOD_MAX,
  WARD_MOOD_DRAIN_PER_MISTAKE,
  clampWardMood,
  patienceMultiplierForWardMood,
  SANITY_MAX,
  SANITY_DRAIN_PER_SECOND,
  SANITY_DRAIN_PER_UPSET,
  clampSanity,
  KAREN_EVENT_TIMER_SECONDS,
  KAREN_CALMED_TIP_GARD,
  KAREN_MOOD_PENALTY,
  MEL_GIFT_GARD,
  MEL_SANITY_RESTORE,
  MEL_MOOD_RESTORE,
  XP_CORRECT_TRIAGE,
  XP_TREATMENT_STEP,
  XP_DISCHARGE,
  XP_KAREN_CALMED,
  XP_MEL_VISIT,
  NEUTRAL_PERKS,
  SURGERY_ITEMS,
  HUNGER_MAX,
  THIRST_MAX,
  HUNGER_DRAIN_PER_SECOND,
  THIRST_DRAIN_PER_SECOND,
  EMPTY_STAT_SANITY_DRAIN,
  HUNGER_THIRST_COLLAPSE_SECONDS,
  clampHunger,
  clampThirst,
  findVendingItem,
  CAFE_MEAL,
  FLASHLIGHT_BATTERY_MAX,
  FLASHLIGHT_DRAIN_PER_SECOND,
  FLASHLIGHT_MAX_SPARES,
  BATTERY_PRICE,
  LOST_CHILD_GARD,
  LOST_CHILD_MOOD,
  CAT_PET_SANITY,
  CELEBRITY_DISCHARGE_MULTIPLIER,
  surgeryItemFor,
  CLOSING_WAIT_SECONDS,
  COFFEE_SANITY_RESTORE,
  COFFEE_PERFECT_TIP_GARD,
  COFFEE_MOOD_RESTORE,
  TREATMENT_TIP_GARD,
  DISCHARGE_GARD,
  RATING_MAX,
  RATING_PENALTY_PER_WALKOUT,
  ZERO_SANITY_COLLAPSE_SECONDS,
  clampRating,
  paycheckMultiplierForRating,
  hallucinationPayMultiplier,
  HALLUCINATION_STARTLE_SANITY,
  DOCTOR_ASSIST_PATIENCE_FRACTION,
  DOCTOR_ASSIST_PATIENCE_REFILL,
  DOCTOR_ASSIST_COOLDOWN_SECONDS,
} from './rules.js';

export { WARD_MOOD_MAX, SANITY_MAX, RATING_MAX };

/** Treatment beds on the ward. */
export const BED_COUNT = 4;

export function createInitialState(shiftNumber, karenShiftNumber, overrides = {}) {
  const totalClockSeconds = shiftClockSecondsForShift(shiftNumber);
  return {
    phase: 'not-started',
    shiftNumber,
    clockSeconds: totalClockSeconds,
    totalClockSeconds,
    closingWaitSecondsRemaining: 0,

    triageQueue: [],
    beds: Array.from({ length: BED_COUNT }, () => null),
    carried: null,
    hasBandage: false,
    surgeryKit: { scalpel: false, item: null },
    night: false,
    flashlight: { on: false, battery: FLASHLIGHT_BATTERY_MAX, spares: 0 },
    activeTask: null,
    orderlyGurney: null,
    orPatient: null,
    doctorCooldownSeconds: DOCTOR_ASSIST_COOLDOWN_SECONDS,
    doctorAssists: 0,

    karen: {
      shiftNumber: karenShiftNumber,
      active: false,
      triggered: false,
      resolved: false,
      outcome: null,
      timerSecondsRemaining: 0,
    },
    mel: { waiting: false, visited: false },
    lostChild: { waiting: false, helped: false },
    xp: 0,
    perks: { ...NEUTRAL_PERKS },

    wardMood: WARD_MOOD_MAX,
    sanity: SANITY_MAX,
    hunger: HUNGER_MAX,
    thirst: THIRST_MAX,
    zeroHungerSeconds: 0,
    zeroThirstSeconds: 0,
    rating: RATING_MAX,
    walkouts: 0,
    transfers: 0,
    discharged: 0,
    zeroSanitySeconds: 0,
    mistakeCount: 0,
    bonusGard: 0,
    payout: null,
    gameOverReason: null,

    ...overrides,
  };
}

export function startShift(state) {
  if (state.phase !== 'not-started') return state;
  return { ...state, phase: 'playing' };
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function applyMistake(state) {
  return {
    mistakeCount: state.mistakeCount + 1,
    wardMood: clampWardMood(state.wardMood - WARD_MOOD_DRAIN_PER_MISTAKE),
    sanity: clampSanity(state.sanity - SANITY_DRAIN_PER_UPSET),
  };
}

function applyWalkout(state) {
  return {
    rating: clampRating(state.rating - RATING_PENALTY_PER_WALKOUT),
    walkouts: state.walkouts + 1,
  };
}

function setBed(beds, index, value) {
  return beds.map((b, i) => (i === index ? value : b));
}

/** The step a bedded patient needs next, or null for an empty bed. */
export function currentStep(bedPatient) {
  if (!bedPatient) return null;
  return bedPatient.plan[bedPatient.step] ?? null;
}

/** Index of the first empty bed, or -1 when the ward is full. */
export function freeBedIndex(state) {
  return state.beds.findIndex((b) => b === null);
}

/**
 * Completes the current step of the patient in `bedIndex`: +TREATMENT_TIP_GARD,
 * and if that was the last step, discharges them (DISCHARGE_GARD by level)
 * and frees the bed.
 */
function advanceStep(state, bedIndex, { tip: earnsTip = true } = {}) {
  const patient = state.beds[bedIndex];
  const nextStep = patient.step + 1;
  const tip = state.bonusGard + (earnsTip ? TREATMENT_TIP_GARD : 0);
  const xp = state.xp + (earnsTip ? XP_TREATMENT_STEP : 0);
  if (nextStep >= patient.plan.length) {
    return {
      ...state,
      beds: setBed(state.beds, bedIndex, null),
      // A celebrity's discharge pays CELEBRITY_DISCHARGE_MULTIPLIER times over.
      bonusGard: tip + (DISCHARGE_GARD[patient.level] ?? 0) * (patient.vip ? CELEBRITY_DISCHARGE_MULTIPLIER : 1),
      xp: xp + (XP_DISCHARGE[patient.level] ?? 0),
      discharged: state.discharged + 1,
    };
  }
  return { ...state, beds: setBed(state.beds, bedIndex, { ...patient, step: nextStep, inSurgery: false }), bonusGard: tip, xp };
}

// ---------------------------------------------------------------------------
// Triage
// ---------------------------------------------------------------------------

/**
 * A patient arrives at the Triage Desk. Their wait is `waitSeconds` × the
 * Ward Mood multiplier at arrival (omitted = no wait timer).
 *
 * @param {ShiftState} state
 * @param {{id: string, conditionId: string, waitSeconds?: number}} patient
 */
export function addPatientToTriage(state, patient) {
  if (state.phase !== 'playing') return state;
  const condition = findCondition(patient.conditionId);
  if (!condition) return state;
  const wait = Number.isFinite(patient.waitSeconds) && patient.waitSeconds > 0
    ? patient.waitSeconds * patienceMultiplierForWardMood(state.wardMood) * state.perks.patience
    : null;
  return {
    ...state,
    triageQueue: [...state.triageQueue, {
      id: patient.id,
      conditionId: condition.id,
      level: condition.level,
      vip: Boolean(patient.vip),
      waitRemainingSeconds: wait,
      waitMaxSeconds: wait,
    }],
  };
}

/** Whether the Triage Sort can open for this patient: queued, a bed free, nothing else in progress. */
export function canTriage(state, patientId) {
  return state.phase === 'playing'
    && !state.activeTask
    && freeBedIndex(state) !== -1
    && state.triageQueue.some((p) => p.id === patientId);
}

/**
 * Resolves a Triage Sort: the patient leaves the queue for the first free
 * bed whatever the call (the charge nurse corrects a wrong one), and a
 * wrong call is a mistake. Treatment patience is set here, scaled by Ward
 * Mood at bedding. A no-op unless `canTriage`.
 *
 * @param {ShiftState} state
 * @param {string} patientId
 * @param {'red' | 'yellow' | 'green'} chosenLevel
 */
export function resolveTriage(state, patientId, chosenLevel) {
  if (!canTriage(state, patientId)) return state;
  const patient = state.triageQueue.find((p) => p.id === patientId);
  const condition = findCondition(patient.conditionId);
  const bedIndex = freeBedIndex(state);
  const correct = chosenLevel === patient.level;
  const after = correct ? { ...state, xp: state.xp + XP_CORRECT_TRIAGE } : { ...state, ...applyMistake(state) };
  const patience = treatmentPatienceSeconds(patient.level, state.shiftNumber)
    * patienceMultiplierForWardMood(after.wardMood) * state.perks.patience;
  return {
    ...after,
    triageQueue: state.triageQueue.filter((p) => p !== patient),
    beds: setBed(state.beds, bedIndex, {
      id: patient.id,
      conditionId: patient.conditionId,
      level: patient.level,
      plan: [...condition.plan],
      step: 0,
      vip: Boolean(patient.vip),
      patienceRemainingSeconds: patience,
      patienceMaxSeconds: patience,
      inSurgery: false,
    }),
  };
}

// ---------------------------------------------------------------------------
// Bed-side minigames: Vitals, Oxygen, IV, Bandage
// ---------------------------------------------------------------------------

/**
 * Starts the bed's current step when it's a bed-side minigame. A no-op if
 * something else is in progress, a gurney is being pushed, or the step
 * needs the cabinet/OR instead.
 */
export function startBedTask(state, bedIndex) {
  if (state.phase !== 'playing' || state.activeTask || state.carried?.kind === 'gurney') return state;
  const patient = state.beds[bedIndex];
  const step = currentStep(patient);
  if (!BED_MINIGAME_TREATMENTS.includes(step)) return state;
  // A Bandage step needs a roll from the Supply Cart in your pocket.
  if (step === 'bandage' && !state.hasBandage) return state;
  return { ...state, activeTask: { kind: step, bedIndex, patientId: patient.id } };
}

/**
 * Resolves the active bed-side minigame. Success completes the step; a
 * failure is a mistake and leaves the task active for a retry.
 */
export function resolveBedTask(state, success) {
  const task = state.activeTask;
  if (state.phase !== 'playing' || !task || !BED_MINIGAME_TREATMENTS.includes(task.kind)) return state;
  if (state.beds[task.bedIndex]?.id !== task.patientId) return { ...state, activeTask: null };
  if (!success) return { ...state, ...applyMistake(state) };
  // A successful dressing uses up the bandage roll.
  const hasBandage = task.kind === 'bandage' ? false : state.hasBandage;
  return advanceStep({ ...state, activeTask: null, hasBandage }, task.bedIndex);
}

// ---------------------------------------------------------------------------
// Meds: dispense at the cabinet, then deliver to the bed
// ---------------------------------------------------------------------------

/** The bed the cabinet fills next: the lowest-patience bed whose current step is Meds, or -1. */
export function nextMedsBedIndex(state) {
  let best = -1;
  state.beds.forEach((patient, i) => {
    if (currentStep(patient) !== 'meds') return;
    if (best === -1 || patient.patienceRemainingSeconds < state.beds[best].patienceRemainingSeconds) best = i;
  });
  return best;
}

/** Opens Meds Dispensing at the cabinet for `nextMedsBedIndex`. A no-op with hands full or no meds order. */
export function startMedsDispense(state) {
  if (state.phase !== 'playing' || state.activeTask || state.carried) return state;
  const bedIndex = nextMedsBedIndex(state);
  if (bedIndex === -1) return state;
  return { ...state, activeTask: { kind: 'meds-dispense', bedIndex, patientId: state.beds[bedIndex].id } };
}

/** Success: now carrying that patient's meds. Failure (wrong drug/dose): a mistake, cabinet stays open. */
export function resolveMedsDispense(state, success) {
  const task = state.activeTask;
  if (state.phase !== 'playing' || task?.kind !== 'meds-dispense') return state;
  if (state.beds[task.bedIndex]?.id !== task.patientId) return { ...state, activeTask: null };
  if (!success) return { ...state, ...applyMistake(state) };
  return { ...state, activeTask: null, carried: { kind: 'meds', bedIndex: task.bedIndex, patientId: task.patientId } };
}

/**
 * Arriving at a bed with that patient's meds opens the give-meds skill
 * check (`activeTask` 'meds-give'); the meds stay in your hands until it's
 * passed, so backing out keeps them.
 */
export function deliverMeds(state, bedIndex) {
  const carried = state.carried;
  if (state.phase !== 'playing' || state.activeTask || carried?.kind !== 'meds' || carried.bedIndex !== bedIndex) return state;
  const patient = state.beds[bedIndex];
  if (patient?.id !== carried.patientId || currentStep(patient) !== 'meds') return state;
  return { ...state, activeTask: { kind: 'meds-give', bedIndex, patientId: patient.id } };
}

/** Success: the meds are given and the Meds step completes. A miss is a mistake; the check stays open. */
export function resolveMedsGive(state, success) {
  const task = state.activeTask;
  if (state.phase !== 'playing' || task?.kind !== 'meds-give') return state;
  if (state.beds[task.bedIndex]?.id !== task.patientId) return { ...state, activeTask: null };
  if (!success) return { ...state, ...applyMistake(state) };
  return advanceStep({ ...state, activeTask: null, carried: null }, task.bedIndex);
}

/**
 * Hallucination: carried meds — or, with none, the pocketed bandage roll —
 * slip away (the order stays; fetch another). Never mid-minigame.
 */
export function dropCarriedSupply(state) {
  if (state.phase !== 'playing' || state.activeTask) return state;
  if (state.carried?.kind === 'meds') return { ...state, carried: null };
  if (state.hasBandage) return { ...state, hasBandage: false };
  return state;
}

// ---------------------------------------------------------------------------
// Supply Cart (2nd Floor): bandage rolls
// ---------------------------------------------------------------------------

/** Pockets a bandage roll (Supply Cart or the Stock tech). Works with your hands full; one roll at a time. */
export function pickUpBandage(state) {
  if (state.phase !== 'playing' || state.activeTask || state.hasBandage) return state;
  return { ...state, hasBandage: true };
}

// ---------------------------------------------------------------------------
// Surgery: wheel the patient to the OR, then operate
// ---------------------------------------------------------------------------

/** At a bed whose step is Surgery with empty hands: take the gurney. Their patience pauses. */
export function startSurgeryTransport(state, bedIndex) {
  if (state.phase !== 'playing' || state.activeTask || state.carried) return state;
  const patient = state.beds[bedIndex];
  if (currentStep(patient) !== 'surgery' || patient.inSurgery) return state;
  return {
    ...state,
    carried: { kind: 'gurney', bedIndex, patientId: patient.id },
    beds: setBed(state.beds, bedIndex, { ...patient, inSurgery: true }),
  };
}

/** The patient the next operation would be on: the gurney you're pushing, or the one on the table. */
export function surgeryPatient(state) {
  const carried = state.carried;
  const patient = carried?.kind === 'gurney' ? carried : (!carried ? state.orPatient : null);
  if (!patient) return null;
  const bed = state.beds[patient.bedIndex];
  return bed?.id === patient.patientId ? { ...patient, conditionId: bed.conditionId } : { ...patient, conditionId: null };
}

/**
 * Every item some waiting surgery needs right now — beds whose next step is
 * surgery, the patient on the table, on your gurney or on the Orderly's —
 * plus the scalpel whenever any surgery is waiting.
 */
export function surgeryItemsNeeded(state) {
  const needed = new Set();
  state.beds.forEach((patient) => {
    if (currentStep(patient) !== 'surgery') return;
    needed.add('scalpel');
    const item = surgeryItemFor(patient.conditionId);
    if (item) needed.add(item);
  });
  return needed;
}

/**
 * Takes a surgery item into the kit (after its grab skill check). The
 * scalpel fills the scalpel slot; anything else fills the one item slot
 * (taking another swaps it — the old one goes back). An item no waiting
 * surgery needs — a decoy, or the wrong organ — is a mistake and isn't
 * taken.
 *
 * @param {string} itemId a SURGERY_ITEMS id, or a decoy's name
 */
export function takeSurgeryItem(state, itemId) {
  if (state.phase !== 'playing') return state;
  if (!surgeryItemsNeeded(state).has(itemId)) return { ...state, ...applyMistake(state) };
  if (itemId === 'scalpel') return { ...state, surgeryKit: { ...state.surgeryKit, scalpel: true } };
  return { ...state, surgeryKit: { ...state.surgeryKit, item: itemId } };
}

/**
 * What's still missing to operate on `surgeryPatient`: [] when the kit is
 * complete, else the SURGERY_ITEMS ids still needed.
 */
export function surgeryMissing(state) {
  const patient = surgeryPatient(state);
  if (!patient) return [];
  const missing = [];
  if (!state.surgeryKit.scalpel) missing.push('scalpel');
  const item = surgeryItemFor(patient.conditionId);
  if (item && state.surgeryKit.item !== item) missing.push(item);
  return missing;
}

/**
 * At the Operating Table: opens the surgery — for the gurney you're
 * pushing, or else for a patient the Orderly left on the table (your hands
 * must be free to scrub in) — once the kit holds the scalpel and the
 * patient's item. A no-op otherwise (the game says what's missing).
 */
export function startSurgery(state) {
  if (state.phase !== 'playing' || state.activeTask) return state;
  const patient = surgeryPatient(state);
  if (!patient || surgeryMissing(state).length) return state;
  return { ...state, activeTask: { kind: 'surgery', bedIndex: patient.bedIndex, patientId: patient.patientId } };
}

/**
 * Success: the patient goes back to their bed with Surgery done, and the
 * kit is used up. Failure: a mistake, stay on the table (kit kept).
 */
export function resolveSurgery(state, success) {
  const task = state.activeTask;
  if (state.phase !== 'playing' || task?.kind !== 'surgery') return state;
  if (!success) return { ...state, ...applyMistake(state) };
  const carried = state.carried?.patientId === task.patientId ? null : state.carried;
  const orPatient = state.orPatient?.patientId === task.patientId ? null : state.orPatient;
  return advanceStep({ ...state, activeTask: null, carried, orPatient, surgeryKit: { scalpel: false, item: null } }, task.bedIndex);
}

// ---------------------------------------------------------------------------
// Helping staff (rules.js section 15)
// ---------------------------------------------------------------------------

/** A bed waiting on surgery that nobody has wheeled out yet, or -1. The lowest-patience one first. */
export function nextSurgeryBedIndex(state) {
  let best = -1;
  state.beds.forEach((patient, i) => {
    if (currentStep(patient) !== 'surgery' || patient.inSurgery) return;
    if (best === -1 || patient.patienceRemainingSeconds < state.beds[best].patienceRemainingSeconds) best = i;
  });
  return best;
}

/** The Orderly reaches a surgery patient's bed and takes them (their patience pauses). One at a time; the OR table must be free. */
export function orderlyTakePatient(state, bedIndex) {
  if (state.phase !== 'playing' || state.orderlyGurney || state.orPatient) return state;
  const patient = state.beds[bedIndex];
  if (currentStep(patient) !== 'surgery' || patient.inSurgery) return state;
  return {
    ...state,
    orderlyGurney: { bedIndex, patientId: patient.id },
    beds: setBed(state.beds, bedIndex, { ...patient, inSurgery: true }),
  };
}

/** The Orderly reaches the OR: the patient waits on the table for you. */
export function orderlyDeliverToOR(state) {
  if (state.phase !== 'playing' || !state.orderlyGurney) return state;
  return { ...state, orPatient: state.orderlyGurney, orderlyGurney: null };
}

/**
 * The patient Dr. Okafor would step in for right now, or -1: his cooldown
 * is up and someone below DOCTOR_ASSIST_PATIENCE_FRACTION of their
 * patience needs a step other than surgery, isn't mid-minigame with you,
 * and isn't the one whose meds you're carrying. Most urgent first.
 */
export function doctorAssistTarget(state) {
  if (state.phase !== 'playing' || state.doctorCooldownSeconds > 0) return -1;
  let best = -1;
  let bestFraction = DOCTOR_ASSIST_PATIENCE_FRACTION;
  state.beds.forEach((patient, i) => {
    if (!patient || patient.inSurgery || currentStep(patient) === 'surgery') return;
    if (state.activeTask?.patientId === patient.id || state.carried?.patientId === patient.id) return;
    const fraction = patient.patienceRemainingSeconds / patient.patienceMaxSeconds;
    if (fraction < bestFraction) {
      best = i;
      bestFraction = fraction;
    }
  });
  return best;
}

/**
 * Dr. Okafor finishes the current step for the patient in `bedIndex` (no
 * tip — you didn't do it; a discharge still pays), tops their patience up
 * to DOCTOR_ASSIST_PATIENCE_REFILL, and starts his cooldown. A no-op if
 * they're no longer a valid target (the renderer picks the target, then he
 * walks over, so it re-checks on arrival).
 */
export function doctorAssist(state, bedIndex, patientId) {
  if (state.phase !== 'playing' || state.doctorCooldownSeconds > 0) return state;
  const patient = state.beds[bedIndex];
  if (!patient || patient.id !== patientId || patient.inSurgery || currentStep(patient) === 'surgery') return state;
  if (state.activeTask?.patientId === patientId || state.carried?.patientId === patientId) return state;
  if (patient.patienceRemainingSeconds / patient.patienceMaxSeconds >= DOCTOR_ASSIST_PATIENCE_FRACTION) return state;
  const refilled = {
    ...patient,
    patienceRemainingSeconds: Math.max(patient.patienceRemainingSeconds, patient.patienceMaxSeconds * DOCTOR_ASSIST_PATIENCE_REFILL),
  };
  const next = advanceStep({ ...state, beds: setBed(state.beds, bedIndex, refilled) }, bedIndex, { tip: false });
  return { ...next, doctorCooldownSeconds: DOCTOR_ASSIST_COOLDOWN_SECONDS, doctorAssists: state.doctorAssists + 1 };
}

/**
 * Backs out of the active minigame without resolving it (the overlay's ×
 * button): no mistake, the step stays where it was. A gurney already on
 * its way to the OR stays in hand.
 */
export function cancelTask(state) {
  if (state.phase !== 'playing' || !state.activeTask) return state;
  return { ...state, activeTask: null };
}

// ---------------------------------------------------------------------------
// Karen — the angry relative
// ---------------------------------------------------------------------------

export function startKarenEvent(state) {
  if (state.phase !== 'playing') return state;
  if (state.karen.triggered || state.shiftNumber !== state.karen.shiftNumber) return state;
  return {
    ...state,
    karen: { ...state.karen, active: true, triggered: true, timerSecondsRemaining: KAREN_EVENT_TIMER_SECONDS },
  };
}

function resolveKarenOutcome(state, outcome) {
  const karen = { ...state.karen, active: false, resolved: true, outcome };
  // Security escorts her out: no mistake, but no thank-you tip either.
  if (outcome === 'security') return { ...state, karen };
  if (outcome === 'explain') {
    return { ...state, karen, bonusGard: state.bonusGard + KAREN_CALMED_TIP_GARD, xp: state.xp + XP_KAREN_CALMED };
  }
  return {
    ...state,
    karen,
    mistakeCount: state.mistakeCount + 1,
    wardMood: clampWardMood(state.wardMood - KAREN_MOOD_PENALTY),
    sanity: clampSanity(state.sanity - SANITY_DRAIN_PER_UPSET),
  };
}

/** @param {'explain' | 'security' | 'letCut'} outcome */
export function resolveKarenEvent(state, outcome) {
  if (state.phase !== 'playing' || !state.karen.active) return state;
  return resolveKarenOutcome(state, ['explain', 'security'].includes(outcome) ? outcome : 'letCut');
}

// ---------------------------------------------------------------------------
// Mel — the easter egg: once per shift she joins the triage line, and
// talking to her there is a gift (Gard, Sanity, Ward Mood), never a mistake.
// ---------------------------------------------------------------------------

export function melArrives(state) {
  if (state.phase !== 'playing' || state.mel.waiting || state.mel.visited) return state;
  return { ...state, mel: { ...state.mel, waiting: true } };
}

export function visitMel(state) {
  if (state.phase !== 'playing' || !state.mel.waiting) return state;
  return {
    ...state,
    mel: { waiting: false, visited: true },
    bonusGard: state.bonusGard + MEL_GIFT_GARD,
    xp: state.xp + XP_MEL_VISIT,
    sanity: clampSanity(state.sanity + MEL_SANITY_RESTORE),
    wardMood: clampWardMood(state.wardMood + MEL_MOOD_RESTORE),
  };
}

// ---------------------------------------------------------------------------
// Clock / phase progression
// ---------------------------------------------------------------------------

/**
 * Advances time. In 'playing': the shift clock, Sanity drain (and time at
 * 0 Sanity), triage-queue waits (a timeout is a walk-out: −1.5★), bed
 * patience (a timeout transfers the patient out: a mistake and a
 * walk-out, and drops anything carried/in progress for them), and Karen's
 * timer. At 0 the shift enters 'closing-wait'. In 'closing-wait' only the
 * handover countdown moves.
 */
export function tick(state, deltaSeconds) {
  if (state.phase !== 'playing' && state.phase !== 'closing-wait') return state;
  const delta = Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 0;

  if (state.phase === 'closing-wait') {
    return { ...state, closingWaitSecondsRemaining: Math.max(0, state.closingWaitSecondsRemaining - delta) };
  }

  // Hunger and Thirst drain; each one sitting at 0 drains Sanity faster.
  const hunger = clampHunger(state.hunger - HUNGER_DRAIN_PER_SECOND * delta);
  const thirst = clampThirst(state.thirst - THIRST_DRAIN_PER_SECOND * delta);
  const emptyStats = (hunger <= 0 ? 1 : 0) + (thirst <= 0 ? 1 : 0);
  const drainPerSecond = SANITY_DRAIN_PER_SECOND * state.perks.sanityDrain + EMPTY_STAT_SANITY_DRAIN * emptyStats;
  let next = {
    ...state,
    hunger,
    thirst,
    zeroHungerSeconds: hunger <= 0 ? state.zeroHungerSeconds + Math.max(0, delta - Math.max(0, state.hunger) / HUNGER_DRAIN_PER_SECOND) : 0,
    zeroThirstSeconds: thirst <= 0 ? state.zeroThirstSeconds + Math.max(0, delta - Math.max(0, state.thirst) / THIRST_DRAIN_PER_SECOND) : 0,
    sanity: clampSanity(state.sanity - drainPerSecond * delta),
    doctorCooldownSeconds: Math.max(0, (state.doctorCooldownSeconds ?? 0) - delta),
  };
  if (next.sanity <= 0) {
    const secondsToZero = Math.max(0, state.sanity) / drainPerSecond;
    next.zeroSanitySeconds = state.zeroSanitySeconds + Math.max(0, delta - secondsToZero);
  }

  // The flashlight drains while on; an empty battery swaps in a spare.
  if (next.flashlight.on) {
    let battery = next.flashlight.battery - FLASHLIGHT_DRAIN_PER_SECOND * delta;
    let { spares } = next.flashlight;
    let on = true;
    if (battery <= 0) {
      if (spares > 0) { spares -= 1; battery = FLASHLIGHT_BATTERY_MAX; } else { battery = 0; on = false; }
    }
    next = { ...next, flashlight: { on, battery, spares } };
  }

  // Triage queue walk-outs.
  let walkedOut = 0;
  const queue = [];
  for (const p of next.triageQueue) {
    if (p.waitRemainingSeconds == null) { queue.push(p); continue; }
    const remaining = p.waitRemainingSeconds - delta;
    if (remaining <= 0) walkedOut++;
    else queue.push({ ...p, waitRemainingSeconds: remaining });
  }
  next.triageQueue = queue;
  for (let i = 0; i < walkedOut; i++) next = { ...next, ...applyWalkout(next) };

  // Bed patience — a patient left too long is transferred out.
  next.beds.forEach((patient, i) => {
    if (!patient || patient.inSurgery) return;
    const remaining = patient.patienceRemainingSeconds - delta;
    if (remaining > 0) {
      next = { ...next, beds: setBed(next.beds, i, { ...patient, patienceRemainingSeconds: remaining }) };
      return;
    }
    next = {
      ...next,
      ...applyMistake(next),
      ...applyWalkout(next),
      transfers: next.transfers + 1,
      beds: setBed(next.beds, i, null),
      carried: next.carried?.patientId === patient.id ? null : next.carried,
      activeTask: next.activeTask?.patientId === patient.id ? null : next.activeTask,
    };
  });

  if (next.karen.active) {
    const remaining = next.karen.timerSecondsRemaining - delta;
    next = remaining <= 0
      ? resolveKarenOutcome(next, 'letCut')
      : { ...next, karen: { ...next.karen, timerSecondsRemaining: remaining } };
  }

  // Game over: collapsing after too long at 0 Sanity, or running out of stars.
  if (next.zeroSanitySeconds >= ZERO_SANITY_COLLAPSE_SECONDS) return gameOver(next, 'sanity');
  if (next.zeroHungerSeconds >= HUNGER_THIRST_COLLAPSE_SECONDS) return gameOver(next, 'hunger');
  if (next.zeroThirstSeconds >= HUNGER_THIRST_COLLAPSE_SECONDS) return gameOver(next, 'thirst');
  if (next.rating <= 0) return gameOver(next, 'stars');

  const clockSeconds = Math.max(0, next.clockSeconds - delta);
  if (clockSeconds <= 0) {
    return { ...next, clockSeconds: 0, phase: 'closing-wait', closingWaitSecondsRemaining: CLOSING_WAIT_SECONDS, activeTask: null };
  }
  return { ...next, clockSeconds };
}

/** Ends the shift as a game over: nothing in hand, nothing in progress, no pay. */
function gameOver(state, reason) {
  return { ...state, phase: 'game-over', gameOverReason: reason, activeTask: null, carried: null, payout: 0 };
}

/** Seconds left before a collapse while at 0 Sanity, or null when Sanity is above 0. */
export function collapseSecondsRemaining(state) {
  if (state.phase !== 'playing' || state.sanity > 0) return null;
  return Math.max(0, ZERO_SANITY_COLLAPSE_SECONDS - state.zeroSanitySeconds);
}

/**
 * The most urgent Hunger/Thirst collapse countdown: { stat, seconds } while
 * either is at 0, else null.
 */
export function hungerThirstCollapse(state) {
  if (state.phase !== 'playing') return null;
  const timers = [];
  if (state.hunger <= 0) timers.push({ stat: 'hunger', seconds: Math.max(0, HUNGER_THIRST_COLLAPSE_SECONDS - state.zeroHungerSeconds) });
  if (state.thirst <= 0) timers.push({ stat: 'thirst', seconds: Math.max(0, HUNGER_THIRST_COLLAPSE_SECONDS - state.zeroThirstSeconds) });
  return timers.sort((a, b) => a.seconds - b.seconds)[0] ?? null;
}

/** Applies a food/drink's effects; leaving 0 resets that stat's collapse timer. */
function feed(state, { hunger = 0, thirst = 0, sanity = 0 }) {
  const nextHunger = clampHunger(state.hunger + hunger);
  const nextThirst = clampThirst(state.thirst + thirst);
  return {
    ...state,
    hunger: nextHunger,
    thirst: nextThirst,
    sanity: clampSanity(state.sanity + sanity),
    zeroHungerSeconds: nextHunger > 0 ? 0 : state.zeroHungerSeconds,
    zeroThirstSeconds: nextThirst > 0 ? 0 : state.zeroThirstSeconds,
  };
}

/**
 * Buys one vending-machine item (rules.js VENDING_ITEMS): its price comes
 * off the shift's pay and its effects apply — only if you can afford it
 * (`availableGard`, which the game passes as the month's Gard plus this
 * shift's earnings so far; the user asked for "not enough Gard" to block
 * snacks and drinks too, like batteries). Unknown items do nothing.
 */
export function buyVendingItem(state, itemId, availableGard = Infinity) {
  if (state.phase !== 'playing') return state;
  const item = findVendingItem(itemId);
  if (!item || !(availableGard >= item.price)) return state;
  return { ...feed(state, item), bonusGard: state.bonusGard - item.price };
}

/**
 * F / the HUD button: switches the flashlight on (only with charge left —
 * a spare is loaded if the battery is flat) or off.
 */
export function toggleFlashlight(state) {
  if (state.phase !== 'playing') return state;
  const f = state.flashlight;
  if (f.on) return { ...state, flashlight: { ...f, on: false } };
  if (f.battery > 0) return { ...state, flashlight: { ...f, on: true } };
  if (f.spares > 0) return { ...state, flashlight: { on: true, battery: FLASHLIGHT_BATTERY_MAX, spares: f.spares - 1 } };
  return state;
}

/** Takes a spare battery (the Supply Room shelf); a no-op at FLASHLIGHT_MAX_SPARES. */
export function pickUpBattery(state) {
  if (state.phase !== 'playing' || state.flashlight.spares >= FLASHLIGHT_MAX_SPARES) return state;
  return { ...state, flashlight: { ...state.flashlight, spares: state.flashlight.spares + 1 } };
}

/**
 * Buys a spare battery at the vending machine, off the shift's pay. A no-op
 * when your pockets are full or you can't afford it: `availableGard` is
 * what you have to spend (the game passes the month's Gard plus this
 * shift's earnings so far) — the user: "if you do not have enough gard you
 * cannot buy battery".
 */
export function buyBattery(state, availableGard = Infinity) {
  if (!(availableGard >= BATTERY_PRICE)) return state;
  const after = pickUpBattery(state);
  if (after === state) return state;
  return { ...after, bonusGard: after.bonusGard - BATTERY_PRICE };
}

/** The lost child joins the triage line (once per shift). */
export function lostChildArrives(state) {
  if (state.phase !== 'playing' || state.lostChild.waiting || state.lostChild.helped) return state;
  return { ...state, lostChild: { ...state.lostChild, waiting: true } };
}

/** Walking the lost child to the waiting chairs: their parent's thanks (Gard) and a happier ward. */
export function helpLostChild(state) {
  if (state.phase !== 'playing' || !state.lostChild.waiting) return state;
  return {
    ...state,
    lostChild: { waiting: false, helped: true },
    bonusGard: state.bonusGard + LOST_CHILD_GARD,
    wardMood: clampWardMood(state.wardMood + LOST_CHILD_MOOD),
  };
}

/** Petting the hospital cat: a little Sanity (the game keeps the cooldown). */
export function petCat(state) {
  if (state.phase !== 'playing') return state;
  return { ...state, sanity: clampSanity(state.sanity + CAT_PET_SANITY) };
}

/** The Cafeteria Lady's free meal and water (rules.js CAFE_MEAL). */
export function cafeteriaMeal(state) {
  if (state.phase !== 'playing') return state;
  return feed(state, CAFE_MEAL);
}

export function isOfficeReady(state) {
  return state.phase === 'closing-wait' && state.closingWaitSecondsRemaining <= 0;
}

/**
 * Walking into the Charge Nurse's office after handover: 'paycheck', with
 * payout = (shiftPaycheck(mistakes) + bonusGard) × rating/5 × the
 * hallucination multiplier × the rank's pay perk.
 */
export function enterOffice(state) {
  if (!isOfficeReady(state)) return state;
  const gross = Math.max(0, shiftPaycheck(state.mistakeCount) + state.bonusGard);
  const multiplier = paycheckMultiplierForRating(state.rating) * hallucinationPayMultiplier(state.zeroSanitySeconds) * state.perks.pay;
  return { ...state, phase: 'paycheck', payout: Math.round(gross * multiplier) };
}

/** A finished Coffee Pour: that grade's Sanity and Ward Mood change, plus a tip for a perfect pour. */
export function brewCoffee(state, grade) {
  if (state.phase !== 'playing') return state;
  const known = grade in COFFEE_SANITY_RESTORE ? grade : 'sloppy';
  return {
    ...state,
    sanity: clampSanity(state.sanity + COFFEE_SANITY_RESTORE[known]),
    wardMood: clampWardMood(state.wardMood + COFFEE_MOOD_RESTORE[known]),
    bonusGard: state.bonusGard + (grade === 'perfect' ? COFFEE_PERFECT_TIP_GARD : 0),
  };
}

/** Walking up to a ghost patient who isn't there: −5 Sanity, not a mistake. */
export function startleFromHallucination(state) {
  if (state.phase !== 'playing') return state;
  return { ...state, sanity: clampSanity(state.sanity - HALLUCINATION_STARTLE_SANITY) };
}
