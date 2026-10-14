// Hospital Shift canvas engine: rendering, input, station interaction,
// patient spawning, minigame overlays and per-visit progress
// (docs/features/hospital-shift.md). Same architecture as Library Shift's
// library-game.js — bootstrap()/init() split, one requestAnimationFrame
// loop, letterbox-aware click mapping, the htmx-revisit bootstrap fix —
// with every shift-state transition delegated to ./hospital/engine-state.js,
// the numbers to ./hospital/rules.js and the geometry to
// ./hospital/floor-plan.js. This file owns what those can't: drawing, input,
// spawn pacing, the overlays' own transient state (gauge position, traced
// points, picked bottle) and the visit's progress (nothing is saved).
//
// Every minigame is a full-canvas overlay drawn by render() and fed by the
// same canvas listeners as movement, gated on `overlay`.
//
// Loaded as a module from web/templates/pages/hospital-shift.html.

import { shadeColor } from './shared/people.js';
import {
  SHIFTS_PER_MONTH,
  patientVolumeForShift,
  patientArrivalTimes,
  inGameTimeLabel,
  karenShiftForSeed,
  KAREN_LINE,
  KAREN_CALMED_TIP_GARD,
  MEL_FIXED_SHIFT,
  MEL_FIXED_SHIFT_AT,
  MEL_VASE_CLICKS,
  MEL_GIFT_GARD,
  MEL_SANITY_RESTORE,
  MEL_MOOD_RESTORE,
  melCardLineForShift,
  melArrivesWithPatient,
  typeSecretCodeKey,
  rankForXp,
  rankProgress,
  perksForRank,
  ranksGained,
  NURSE_RANKS,
  DAILY_SHIFT_NUMBER,
  hospitalDailyDate,
  dailySeed,
  seededRandom,
  dailyTwistForDate,
  dailyPerksForTwist,
  dailyPatientVolume,
  dailyConditionForRolls,
  TRIAGE_LEVELS,
  findTriageLevel,
  TRIAGE_LEGEND,
  vitalsForLevel,
  findCondition,
  conditionForRoll,
  TREATMENT_LABELS,
  BED_MINIGAME_TREATMENTS,
  MEDICATIONS,
  DOSE_CHOICES,
  MED_CABINET_SHELVES,
  MED_CABINET_BOTTLES_PER_SHELF,
  medCabinetStock,
  gradeMedsPick,
  SURGERY_STAGES,
  SURGERY_ITEMS,
  SURGERY_SOURCES,
  surgeryItemFor,
  surgeryStagesFor,
  isTransplant,
  skillCheckHitsRequired,
  skillCheckSuccessZone,
  isSkillCheckSuccess,
  skillCheckSweepSpeed,
  gradeBandageTrace,
  bandagePathForRolls,
  BANDAGE_TOLERANCE_PX,
  OXYGEN_HEARTS,
  OXYGEN_SKULLS,
  gradeOxygenClick,
  queueWaitSecondsForShift,
  WARD_MOOD_MAX,
  SANITY_MAX,
  walkSpeedMultiplierForSanity,
  GURNEY_WALK_MULTIPLIER,
  coffeePourTargetBand,
  gradeCoffeePour,
  COFFEE_POUR_SECONDS_TO_BRIM,
  COFFEE_PERFECT_TIP_GARD,
  COFFEE_MOOD_RESTORE,
  RATING_MAX,
  RATING_PENALTY_PER_WALKOUT,
  paycheckMultiplierForRating,
  hallucinationIntensity,
  shakyHandsZoneScale,
  shakyHandsSweepMultiplier,
  MEDS_DROP_CHANCE_PER_SECOND,
  HALLUCINATION_START_SANITY,
  hallucinationPayMultiplier,
  TREATMENT_TIP_GARD,
  DISCHARGE_GARD,
  STOCK_TECH_UPSTAIRS_SECONDS,
  STOCK_TECH_DOWNSTAIRS_SECONDS,
  ZERO_SANITY_COLLAPSE_SECONDS,
  HUNGER_MAX,
  THIRST_MAX,
  HUNGER_THIRST_LOW,
  HUNGER_THIRST_COLLAPSE_SECONDS,
  VENDING_ITEMS,
  CAFE_MEAL,
  CAFE_LADY_NAME,
  CAFE_LADY_LINE,
  walkMultiplierForHungerThirst,
  skillZoneScaleForHungerThirst,
  isNightShift,
  patientVolumeFor,
  BATTERY_PRICE,
  FLASHLIGHT_BATTERY_MAX,
  FLASHLIGHT_MAX_SPARES,
  RECEPTIONIST_WAIT_BONUS,
  WET_FLOOR_WALK_MULTIPLIER,
  WET_FLOOR_RADIUS,
  WET_FLOOR_SECONDS,
  JANITOR_MOP_EVERY_SECONDS,
  LOST_CHILD_CHANCE,
  LOST_CHILD_GARD,
  LOST_CHILD_LINE,
  CAT_CHANCE,
  SECURITY_INCIDENT_CHANCE,
  SECURITY_INCIDENT_CHANCE_NIGHT,
  SECURITY_FROM_SHIFT,
  SECURITY_INCIDENT_WINDOW,
  SECURITY_INCIDENT_KINDS,
  THIEF_CAUGHT_GARD,
  CAT_PET_COOLDOWN_SECONDS,
  CELEBRITY_CHANCE,
} from './hospital/rules.js';
import { drawKimonoHimura } from './hospital/kimono-himura.js';
import { patientProfileFor } from './hospital/patient-names.js';
import {
  ANIME,
  animeChip,
  animeCloseButton,
  animeBackdrop,
  animeWindow,
  animeButton,
  speechBubble,
  sparkle,
  screentone,
  outlinedText,
  tint,
  animePlate,
  animeGauge,
  animeBadge,
  animeStar,
  animeTile,
  sakuraBranch,
} from './hospital/anime-ui.js';
import {
  drawOffice,
  drawTriageDesk,
  drawMedCabinet,
  drawOperatingRoom,
  drawStairs,
  drawElevator,
  drawSupplyCart,
  drawBandageRoll as drawBandageRollArt,
  drawDecor,
  drawSurgeryItemIcon,
  drawOrTable,
  drawInstrumentTray,
  drawOrganCooler,
  drawOrDoor,
  drawImplantShelf,
  drawVendingStation,
  drawOutOfOrder,
  drawCafeteriaDoor,
  drawCafeDoor,
  drawCafeCounter,
  drawFoodIcon,
  drawBatteryShelf,
  drawBatteryIcon,
  drawCat,
  drawWetFloor,
} from './hospital/anime-furniture.js';
import { drawAnimePatient, drawAnimePerson, findPatientDesign, PATIENT_DESIGN_KEYS, STAFF_DESIGNS, animeHeadCenterY } from './hospital/anime-people.js';
import {
  createInitialState,
  startShift as startShiftState,
  addPatientToTriage,
  canTriage,
  resolveTriage,
  currentStep,
  freeBedIndex,
  startBedTask,
  resolveBedTask,
  startMedsDispense,
  resolveMedsDispense,
  deliverMeds,
  resolveMedsGive,
  dropCarriedSupply,
  pickUpBandage,
  startSurgeryTransport,
  startSurgery,
  resolveSurgery,
  cancelTask,
  startKarenEvent,
  resolveKarenEvent,
  melArrives,
  visitMel,
  tick,
  isOfficeReady,
  collapseSecondsRemaining,
  enterOffice,
  brewCoffee,
  startleFromHallucination,
  nextSurgeryBedIndex,
  orderlyTakePatient,
  orderlyDeliverToOR,
  takeSurgeryItem,
  surgeryMissing,
  surgeryPatient,
  surgeryItemsNeeded,
  buyVendingItem,
  cafeteriaMeal,
  hungerThirstCollapse,
  toggleFlashlight,
  pickUpBattery,
  buyBattery,
  lostChildArrives,
  helpLostChild,
  petCat,
  securityIncidentStarts,
  dispatchSecurity,
  resolveSecurityIncident,
  doctorAssistTarget,
  doctorAssist,
} from './hospital/engine-state.js';
import {
  buildStations,
  buildDecor,
  stationsOnFloor,
  entryPointFor,
  FLOOR_1,
  FLOOR_2,
  FLOOR_OR,
  FLOOR_CAFE,
  stationAtPoint,
  standoffFor,
  approachPoint,
  clampToCanvas,
  PLAYER_START,
  PLAYER_STOP_MARGIN,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from './hospital/floor-plan.js';

// ---------------------------------------------------------------------------
// Progress: this visit only
// ---------------------------------------------------------------------------
//
// The user asked for leaving to reset the game ("when you leave the website
// make it reset back to shift 1", then "ALL" — every way of leaving, and
// everything resets). So nothing is saved: progress — shift, month Gard,
// best run, nurse rank/XP, the Mel badge — lives in memory for one visit
// to the page. Closing the tab, going to another site or another page here,
// or refreshing all start fresh at shift 1 as a Student Nurse. Only the
// Postgres leaderboard outlasts a visit.

/** Where progress used to be kept; cleared on load so no stale save lingers. */
const LEGACY_STORAGE_KEY = 'hospital-game:v1';

function clearLegacySave() {
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Storage blocked — there's nothing of ours in it to clear.
  }
}

function defaultSave() {
  return { version: 1, monthToDateGard: 0, currentShift: 1, bestRunTotal: 0, karenSeed: Date.now(), foundMel: false, careerXp: 0 };
}

/**
 * Playwright's starting progress (e2e/hospital-shift.spec.js's seedSave):
 * read once, then deleted, so a refresh or HTMX revisit starts fresh.
 */
function takeTestSeed() {
  const seed = window.__hospitalShiftTestSeed;
  delete window.__hospitalShiftTestSeed;
  return seed && typeof seed === 'object' ? seed : {};
}

// ---------------------------------------------------------------------------
// Drawing primitives (Library Shift's)
// ---------------------------------------------------------------------------

function drawRoundRect(ctx, x, y, w, h, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

const LABEL_TEXT_COLOR = ANIME.ink;
const CREAM = '#fdf8ee';

/** A name/label chip — the anime nameplate (hospital/anime-ui.js's animeChip). */
function drawLabelChip(ctx, x, y, text, font, fill = null, ink = LABEL_TEXT_COLOR) {
  animeChip(ctx, x, y, text, font, fill, ink);
}

function insideRect(r, x, y) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

// ---------------------------------------------------------------------------
// Characters
// ---------------------------------------------------------------------------

/** Library Shift's big-character scale. */
export const PERSON_SCALE = 1.55;

// Helping staff: they wander between waypoints (set dressing first — the
// user asked to make the ER "more busier") and then do their jobs (the
// user picked all three: "help"): Dr. Okafor rescues a patient about to be
// transferred, the Orderly wheels a surgery patient to the OR when you
// click him, and the Stock tech brings bandage rolls downstairs now and
// then — click him for one. Everyone — player, patients, staff, Karen — is
// drawn in the anime style (hospital/kimono-himura.js, hospital/anime-people.js).

/** Who wanders where, and the clear spots they walk between. */
const AMBIENT_STAFF = [
  // Floor 1 routes stay below the beds and in the right-hand corridor, clear
  // of the triage line, so staff never read as patients waiting there.
  { key: 'doctor', name: 'Dr. Okafor', floor: 1, waypoints: [[220, 462], [420, 470], [600, 462], [700, 470], [736, 262]] },
  { key: 'orderly', name: 'Orderly', floor: 1, waypoints: [[512, 472], [300, 525], [170, 520], [730, 266], [480, 520]] },
  { key: 'stockTech', name: 'Stock tech', floor: 2, waypoints: [[160, 250], [600, 330], [240, 430], [560, 440], [700, 200]] },
  // More staff (the user: "i want there to be more characters"): the
  // janitor mops (a wet floor slows you), Security keeps watch by the
  // entrance side, the pharmacist potters by the Med Cabinet.
  { key: 'janitor', name: 'Janitor', floor: 1, waypoints: [[260, 470], [440, 478], [640, 262], [700, 470]] },
  { key: 'guard', name: 'Security', floor: 1, waypoints: [[96, 262], [150, 258], [96, 300]] },
  // Security (the user: "add security"): a second guard with a flashlight
  // walks the ER on night shifts.
  { key: 'nightGuard', name: 'Night Security', floor: 1, nightOnly: true, waypoints: [[300, 525], [520, 532], [700, 470], [220, 470]] },
  { key: 'pharmacist', name: 'Pharmacist', floor: 1, waypoints: [[580, 252], [700, 258], [640, 250]] },
];
const AMBIENT_SPEED = 70;
/** Staff on an errand walk faster than when they're idling. */
const ERRAND_SPEED = 130;
/** Where the Stock tech walks while he's downstairs with bandages (start and end at the Elevator). */
const STOCK_TECH_ER_WAYPOINTS = [[690, 470], [560, 470], [400, 525], [650, 478]];
const STOCK_TECH_ER_ELEVATOR = [840, 530];
const STOCK_TECH_SUPPLY_WAYPOINTS = AMBIENT_STAFF.find((d) => d.key === 'stockTech').waypoints;

export const PLAYER_NAME = 'Kimono Himura';
/** Kimono Himura's renderer is drawn in px at her feet; this sizes her beside the rest of the cast. */
const PLAYER_ART_SCALE = 1.12;

// ---------------------------------------------------------------------------
// init()
// ---------------------------------------------------------------------------

/** Overlays tied to an engine `activeTask` (closing it means cancelTask). */
const TASK_OVERLAYS = new Set(['skill', 'oxygen', 'bandage', 'meds']);

/**
 * Wires the game to hospital-shift.html's elements.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object} elements
 * @returns {() => void} teardown (also run on htmx nav-away).
 */
export function init(canvas, elements) {
  if (typeof teardownActiveInstance === 'function') teardownActiveInstance();

  const ctx = canvas.getContext('2d');
  clearLegacySave();
  const save = { ...defaultSave(), ...takeTestSeed() };
  const random = Math.random;

  const stations = buildStations();
  const stationOfKind = (kind) => stations.find((s) => s.kind === kind);
  const visibleStations = () => stationsOnFloor(stations, currentFloor);
  const bedStation = (index) => stations.find((s) => s.kind === 'bed' && s.bedIndex === index);

  let player = { ...PLAYER_START };
  let currentFloor = FLOOR_1;
  let moveTarget = null; // { x, y, station }
  let hoverStation = null;

  let currentShiftNumber = save.currentShift;
  let karenShiftNumber = karenShiftForSeed(save.karenSeed);
  let karenAvailable = false;

  // Daily Challenge (rules.js §3d): set while a daily shift is being played
  // (and through its paycheck, so Try Again replays it); null for the
  // month run. dailyBest is this visit's best paycheck on today's date —
  // nothing outlasts a visit (see "Progress: this visit only").
  let daily = null; // { date, twist }
  // Leaderboard anti-cheat: each run (a month from shift 1, or one Daily)
  // gets a signed ticket from the server when it starts; the Final
  // Paycheck submits it with the score, and the server rejects a score that
  // comes back faster than the shift clock allows (docs/features/
  // hospital-shift.md's Security Considerations). Promises of the ticket
  // text, or null if the request failed.
  let monthTicket = null;
  let dailyTicket = null;
  function requestRunTicket() {
    return fetch('/hospital-shift/run', { method: 'POST', credentials: 'same-origin' })
      .then((r) => (r.ok ? r.text() : null))
      .catch(() => null);
  }
  let dailyBest = null; // { date, payout }
  /** The stream a shift's patients are rolled from: seeded by the date in a Daily Challenge. */
  let shiftRandom = random;
  const dailyEffect = (key) => Boolean(daily?.twist?.effect?.[key]);

  let shiftState = null;
  let running = false;
  let paused = false;
  let lastTimestamp = null;
  let rafHandle = null;
  let toastTimeoutHandle = null;

  let scheduledEvents = [];
  let patientIdCounter = 0;
  /** id -> { name, shortName, age, vitals, designKey } — chart flavor the engine doesn't carry (names: hospital/patient-names.js). */
  const patientInfo = new Map();

  let ambient = [];
  let pendingStaffPickup = false; // walking up to the Stock tech for a roll

  function resetAmbient() {
    ambient = AMBIENT_STAFF.filter((def) => !(def.key === 'doctor' && dailyEffect('noDoctor')) && !(def.nightOnly && !shiftState?.night)).map((def, i) => {
      const [x, y] = def.waypoints[i % def.waypoints.length];
      return {
        ...def, x, y, target: (i + 1) % def.waypoints.length, pause: random() * 2,
        errand: null, // { kind, ...} — overrides wandering while set
        dest: null, // [x, y] the errand is walking to
        phaseSeconds: def.key === 'stockTech' ? STOCK_TECH_UPSTAIRS_SECONDS : 0,
      };
    });
    pendingStaffPickup = false;
  }

  const staff = (key) => ambient.find((a) => a.key === key);

  /** Steps a staff member toward [x, y]; true once they're there. */
  function walkToward(a, [tx, ty], speed, dt) {
    const dx = tx - a.x;
    const dy = ty - a.y;
    const dist = Math.hypot(dx, dy);
    const step = speed * dt;
    if (dist <= step) {
      a.x = tx;
      a.y = ty;
      return true;
    }
    a.x += (dx / dist) * step;
    a.y += (dy / dist) * step;
    return false;
  }

  function wander(a, dt) {
    if (a.pause > 0) { a.pause -= dt; return; }
    if (walkToward(a, a.waypoints[a.target], AMBIENT_SPEED, dt)) {
      a.pause = 0.8 + random() * 2.2;
      let next = Math.floor(random() * a.waypoints.length);
      if (next === a.target) next = (next + 1) % a.waypoints.length;
      a.target = next;
    }
  }

  /** The spot just below a bed where staff stand to work on it. */
  function bedSide(bedIndex) {
    const bed = bedStation(bedIndex);
    return [bed.x + 26, bed.y + bed.h / 2 + 30];
  }

  function updateDoctor(a, dt) {
    if (shiftState?.phase !== 'playing') { a.errand = null; wander(a, dt); return; }
    if (!a.errand) {
      const bedIndex = doctorAssistTarget(shiftState);
      if (bedIndex !== -1) a.errand = { kind: 'assist', bedIndex, patientId: shiftState.beds[bedIndex].id };
    }
    if (!a.errand) { wander(a, dt); return; }
    if (!walkToward(a, bedSide(a.errand.bedIndex), ERRAND_SPEED, dt)) return;
    const { bedIndex, patientId } = a.errand;
    a.errand = null;
    a.pause = 1.5;
    const before = shiftState;
    const step = currentStep(before.beds[bedIndex]);
    shiftState = doctorAssist(shiftState, bedIndex, patientId);
    if (shiftState === before) return;
    const name = patientInfo.get(patientId)?.name ?? 'a patient';
    showToast(shiftState.beds[bedIndex]
      ? `Dr. Okafor stepped in at ${bedLabel(bedIndex)} — did ${name}'s ${TREATMENT_LABELS[step]} and bought you time.`
      : `Dr. Okafor stepped in at ${bedLabel(bedIndex)} — ${name} is discharged! +${DISCHARGE_GARD[before.beds[bedIndex].level]}g`, 3.4);
  }

  /** Clicking the Orderly: send him for the most urgent surgery patient. */
  function requestOrderly() {
    const a = staff('orderly');
    if (a.errand) {
      showToast('The Orderly is already moving a patient.');
      return;
    }
    if (shiftState.orPatient) {
      showToast("There's already a patient on the OR table — go operate first.");
      return;
    }
    const bedIndex = nextSurgeryBedIndex(shiftState);
    if (bedIndex === -1) {
      showToast('Nobody needs wheeling to the Operating Room right now.');
      return;
    }
    a.errand = { kind: 'fetch', bedIndex, patientId: shiftState.beds[bedIndex].id };
    showToast(`The Orderly is on his way to ${bedLabel(bedIndex)} to take them to the OR.`);
  }

  function updateOrderly(a, dt) {
    if (shiftState?.phase !== 'playing') {
      a.errand = null;
      wander(a, dt);
      return;
    }
    if (!a.errand) { wander(a, dt); return; }
    if (a.errand.kind === 'fetch') {
      if (!walkToward(a, bedSide(a.errand.bedIndex), ERRAND_SPEED, dt)) return;
      const before = shiftState;
      shiftState = orderlyTakePatient(shiftState, a.errand.bedIndex);
      if (shiftState === before || shiftState.orderlyGurney?.patientId !== a.errand.patientId) {
        showToast(`The Orderly found ${bedLabel(a.errand.bedIndex)} already handled.`);
        a.errand = null;
        return;
      }
      a.errand = { ...a.errand, kind: 'deliver' };
      return;
    }
    const or = stationOfKind('operating-room');
    if (!walkToward(a, [or.x - or.w / 2 - 40, or.y + 20], ERRAND_SPEED * 0.8, dt)) return;
    shiftState = orderlyDeliverToOR(shiftState);
    showToast(`${bedLabel(a.errand.bedIndex)}'s patient is on the OR table — go scrub in.`, 3.4);
    a.errand = null;
    a.pause = 2;
  }

  /** Upstairs for a while, then downstairs with bandage rolls, then back up. */
  function updateStockTech(a, dt) {
    if (a.errand?.kind === 'leaving') {
      if (walkToward(a, STOCK_TECH_ER_ELEVATOR, ERRAND_SPEED, dt)) {
        a.errand = null;
        a.floor = FLOOR_2;
        a.waypoints = STOCK_TECH_SUPPLY_WAYPOINTS;
        a.target = 0;
        a.phaseSeconds = STOCK_TECH_UPSTAIRS_SECONDS;
      }
      return;
    }
    a.phaseSeconds -= dt;
    if (a.phaseSeconds <= 0) {
      if (a.floor === FLOOR_2) {
        a.floor = FLOOR_1;
        [a.x, a.y] = STOCK_TECH_ER_ELEVATOR;
        a.waypoints = STOCK_TECH_ER_WAYPOINTS;
        a.target = 0;
        a.pause = 0;
        a.phaseSeconds = STOCK_TECH_DOWNSTAIRS_SECONDS;
        if (currentFloor === FLOOR_1 && shiftState?.phase === 'playing') showToast('The Stock tech is down with bandage rolls — click him for one.');
      } else {
        a.errand = { kind: 'leaving' };
      }
      return;
    }
    wander(a, dt);
  }

  function updateExtras(dt) {
    updateCat(dt);
    updateSecurity(dt);
    if (wetFloor) {
      wetFloor.seconds -= dt;
      if (wetFloor.seconds <= 0) wetFloor = null;
    }
  }

  function updateAmbient(dt) {
    for (const a of ambient) {
      if (a.key === 'doctor') updateDoctor(a, dt);
      else if (a.key === 'orderly') updateOrderly(a, dt);
      else if (a.key === 'stockTech') updateStockTech(a, dt);
      else if (a.key === 'janitor') updateJanitor(a, dt);
      else if (a.key === 'guard' || a.key === 'nightGuard') updateGuard(a, dt);
      else wander(a, dt);
    }
  }

  function staffAtPoint(x, y) {
    return ambient.find((a) => a.floor === currentFloor && Math.abs(x - a.x) <= 20 && y >= a.y - 46 && y <= a.y + 24) || null;
  }

  /** Clicking a staff member: the Orderly takes an order; the Stock tech waits while you walk over for a roll. */
  function onStaffClick(a) {
    if (shiftState?.phase !== 'playing') return;
    if (a.key === 'orderly') {
      requestOrderly();
    } else if (a.key === 'stockTech') {
      if (shiftState.hasBandage) {
        showToast('You already have a bandage roll in your pocket.');
        return;
      }
      a.pause = 5;
      pendingStaffPickup = true;
      moveTarget = { x: a.x - 36, y: a.y, station: null };
    } else if (a.key === 'janitor') {
      showToast('Janitor: "Mind the wet floor — it\'s slippery! You\'ll walk slower across it."');
    } else if (a.key === 'guard' || a.key === 'nightGuard') {
      sendSecurity(a);
    } else if (a.key === 'pharmacist') {
      showToast('Pharmacist: "Read every label twice, dear — the look-alikes are sneaky!"');
    } else {
      showToast('Dr. Okafor steps in by himself when a patient is about to be transferred.');
    }
  }

  /** The janitor wanders, and every so often stops to mop: a wet floor appears where he stood. */
  let wetFloor = null; // { x, y, seconds }
  let mopTimer = JANITOR_MOP_EVERY_SECONDS;
  function updateJanitor(a, dt) {
    wander(a, dt);
    if (shiftState?.phase !== 'playing') return;
    mopTimer -= dt;
    if (mopTimer <= 0 && a.pause <= 0) {
      mopTimer = JANITOR_MOP_EVERY_SECONDS;
      a.pause = 3;
      wetFloor = { x: a.x + 6, y: a.y + 4, seconds: WET_FLOOR_SECONDS };
    }
  }

  function isOnWetFloor() {
    return Boolean(wetFloor) && currentFloor === FLOOR_1 && Math.hypot(player.x - wetFloor.x, (player.y - wetFloor.y) * 2) <= WET_FLOOR_RADIUS;
  }

  function arriveAtStockTech() {
    pendingStaffPickup = false;
    const a = staff('stockTech');
    if (a.floor !== currentFloor || Math.hypot(a.x - player.x, a.y - player.y) > 90) {
      showToast('The Stock tech moved on — try again.');
      return;
    }
    const before = shiftState;
    shiftState = pickUpBandage(shiftState);
    if (shiftState !== before) showToast('The Stock tech hands you a bandage roll.');
  }

  function staffLabel(a) {
    if (a.key === 'orderly') {
      if (a.errand) return 'Orderly → OR';
      return shiftState && nextSurgeryBedIndex(shiftState) !== -1 && !shiftState.orPatient ? 'Orderly (click: to OR)' : 'Orderly';
    }
    if (a.key === 'stockTech' && a.floor === FLOOR_1) return 'Stock tech · rolls (click)';
    if (a.key === 'doctor' && a.errand) return 'Dr. Okafor (helping)';
    if (a.key === 'janitor' && wetFloor) return 'Janitor (mopping)';
    if (a.key === 'guard' || a.key === 'nightGuard') {
      if (a.errand?.kind === 'respond') return `${a.name} → on his way`;
      if (a.errand?.kind === 'escort') return `${a.name} (escorting)`;
      if (incident?.phase === 'active' && !securityBusy()) return `${a.name} (click: send!)`;
    }
    return a.name;
  }

  function drawAmbient() {
    for (const a of ambient) {
      if (a.floor !== currentFloor) continue;
      if (a.key === 'orderly' && a.errand?.kind === 'deliver') drawGurney(a.x + 34, a.y - 6, a.errand.patientId);
      drawAnimePerson(ctx, a.x, a.y, STAFF_DESIGNS[a.key], { scale: 0.8, t: performance.now() / 1000 });
      if (a.key === 'stockTech' && a.floor === FLOOR_1) drawBandageRoll(a.x + 16, a.y - 58, 1);
      if (a.key === 'nightGuard') {
        // His flashlight, held out ahead of him.
        const dir = guardFacing(a);
        ctx.save();
        const beam = ctx.createRadialGradient(a.x + dir * 12, a.y - 26, 2, a.x + dir * 12, a.y - 26, 60);
        beam.addColorStop(0, 'rgba(255,244,190,0.45)');
        beam.addColorStop(1, 'rgba(255,244,190,0)');
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.moveTo(a.x + dir * 12, a.y - 26);
        ctx.arc(a.x + dir * 12, a.y - 26, 60, dir > 0 ? -0.35 : Math.PI - 0.35, dir > 0 ? 0.55 : Math.PI + 0.55);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#2a2622';
        ctx.fillRect(a.x + dir * 8 - 3, a.y - 29, 7, 4);
        ctx.restore();
      }
      const label = staffLabel(a);
      const actionable = label !== a.name;
      drawLabelChip(ctx, a.x, a.y + 20, label, actionable ? 'bold 9px sans-serif' : '9px sans-serif',
        actionable ? '#2f5f6f' : 'rgba(255,251,246,0.75)', actionable ? CREAM : LABEL_TEXT_COLOR);
    }
  }

  let overlay = null;
  let pendingTriageAction = null; // { kind: 'patient'|'karen'|'mel'|'ghost', id? }
  let waitingAtOffice = false;

  let sanityFontReady = false;
  document.fonts.ready.then(() => { sanityFontReady = true; }).catch(() => {});

  // -- Toast / screens / HUD -----------------------------------------------

  function showToast(text, seconds = 2.8) {
    elements.toast.textContent = text;
    elements.toast.classList.remove('hidden');
    if (toastTimeoutHandle) window.clearTimeout(toastTimeoutHandle);
    toastTimeoutHandle = window.setTimeout(() => elements.toast.classList.add('hidden'), seconds * 1000);
  }

  function showScreen(name) {
    elements.startScreen.root.classList.toggle('hidden', name !== 'start');
    elements.paycheckScreen.root.classList.toggle('hidden', name !== 'paycheck');
    updateFlashlightButton();
  }

  function renderHud() {
    elements.hud.shift.textContent = daily ? 'Daily' : `${currentShiftNumber}/${SHIFTS_PER_MONTH}`;
    if (elements.hud.rank) {
      const rank = rankForXp(liveCareerXp());
      elements.hud.rank.textContent = `Lv ${rank.rank}`;
      elements.hud.rank.title = rank.title;
    }
    if (!shiftState) {
      elements.hud.clock.textContent = '--:--';
      elements.hud.status.textContent = 'Quiet';
      return;
    }
    elements.hud.clock.textContent = inGameTimeLabel(shiftState.clockSeconds, shiftState.totalClockSeconds, { night: shiftState.night });
    let status;
    if (shiftState.phase === 'closing-wait') status = isOfficeReady(shiftState) ? 'Handover — go in' : 'Handover…';
    else if (shiftState.phase === 'paycheck') status = 'Shift over';
    else if (shiftState.phase === 'game-over') status = 'Game over';
    else if (shiftState.wardMood > 70) status = 'Calm';
    else if (shiftState.wardMood > 30) status = 'Busy';
    else status = 'Chaotic';
    elements.hud.status.textContent = status;
  }

  function bedLabel(index) {
    return `Bed ${index + 1}`;
  }

  function labelForStation(station) {
    switch (station.kind) {
      case 'bed': return bedLabel(station.bedIndex);
      case 'triage-desk': return 'Triage Desk';
      case 'med-cabinet': return 'Med Cabinet';
      case 'operating-room': return 'Operating Room (enter)';
      case 'or-table': return 'Operating Table';
      case 'instrument-tray': return 'Instrument Tray';
      case 'organ-cooler': return 'Organ Cooler';
      case 'implant-shelf': return 'Implant Shelf';
      case 'or-door': return 'Door → ER';
      case 'vending-machine': return 'Vending Machine';
      case 'cafeteria-door': return shiftState?.night ? 'Cafeteria (closed)' : 'Cafeteria ↓';
      case 'cafe-counter': return `${CAFE_LADY_NAME} · free meals`;
      case 'cafe-door': return 'Door → ER';
      case 'battery-shelf': return 'Batteries';
      case 'coffee-machine': return dailyEffect('noCoffee') ? 'Coffee (out of order)' : 'Coffee Machine';
      case 'supply-cart': return 'Supply Cart';
      case 'stairs': return station.targetFloor === FLOOR_2 ? 'Stairs ↑ Supply Room' : 'Stairs ↓ ER';
      case 'elevator': return station.targetFloor === FLOOR_2 ? 'Elevator ↑' : 'Elevator ↓';
      case 'office':
        if (shiftState?.phase === 'playing') return 'Charge Nurse (after 7 PM)';
        if (shiftState?.phase === 'closing-wait' && !isOfficeReady(shiftState)) return `Charge Nurse (${Math.ceil(shiftState.closingWaitSecondsRemaining)}s)`;
        return 'Charge Nurse';
      default: return '';
    }
  }

  function hintForStation(station) {
    const label = labelForStation(station);
    if (station.kind !== 'bed' || !shiftState) return label;
    const patient = shiftState.beds[station.bedIndex];
    if (!patient) return `${label} — empty`;
    if (patient.inSurgery) return `${label} — in the OR`;
    const step = currentStep(patient);
    const name = patientInfo.get(patient.id)?.name ?? 'Patient';
    if (step === 'surgery') return `${label} — ${name} needs surgery: ${describeItems(['scalpel', surgeryItemFor(patient.conditionId)].filter(Boolean))}`;
    return `${label} — ${name} needs ${TREATMENT_LABELS[step]}`;
  }

  function updateHoverHint() {
    if (overlay || !running || !hoverStation) {
      elements.hoverHint.classList.add('hidden');
      return;
    }
    elements.hoverHint.textContent = hintForStation(hoverStation);
    elements.hoverHint.classList.remove('hidden');
  }

  // -- Movement ---------------------------------------------------------------

  // Letterbox-aware mapping, ported from library-game.js: in fullscreen the
  // canvas box isn't 960:600 and object-fit: contain letterboxes it.
  function canvasCoordsFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const worldAspect = CANVAS_WIDTH / CANVAS_HEIGHT;
    let contentWidth = rect.width;
    let contentHeight = rect.height;
    let offsetX = 0;
    let offsetY = 0;
    if (rect.width / rect.height > worldAspect) {
      contentWidth = rect.height * worldAspect;
      offsetX = (rect.width - contentWidth) / 2;
    } else {
      contentHeight = rect.width / worldAspect;
      offsetY = (rect.height - contentHeight) / 2;
    }
    return {
      x: ((e.clientX - rect.left - offsetX) / contentWidth) * CANVAS_WIDTH,
      y: ((e.clientY - rect.top - offsetY) / contentHeight) * CANVAS_HEIGHT,
    };
  }

  function commitStationTarget(station, rawPoint) {
    if (station?.kind !== 'office') waitingAtOffice = false;
    pendingStaffPickup = false;
    if (station) {
      const approach = approachPoint(station.x, station.y, player.x, player.y, standoffFor(station, player.x, player.y));
      moveTarget = { x: approach.x, y: approach.y, station };
    } else if (rawPoint) {
      moveTarget = { x: rawPoint.x, y: rawPoint.y, station: null };
    }
  }

  function updatePlayer(deltaSeconds) {
    if (!moveTarget) return;
    const gurney = shiftState?.carried?.kind === 'gurney' ? GURNEY_WALK_MULTIPLIER : 1;
    const rankWalk = (shiftState?.perks?.walk ?? 1) * (shiftState ? walkMultiplierForHungerThirst(shiftState.hunger, shiftState.thirst) : 1)
      * (isOnWetFloor() ? WET_FLOOR_WALK_MULTIPLIER : 1);
    const step = 240 * walkSpeedMultiplierForSanity(shiftState ? shiftState.sanity : SANITY_MAX) * gurney * rankWalk * deltaSeconds;
    const dx = moveTarget.x - player.x;
    const dy = moveTarget.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= step || dist === 0) {
      player = clampToCanvas(moveTarget.x, moveTarget.y);
      const arrived = moveTarget.station;
      moveTarget = null;
      if (arrived) handleArrival(arrived);
      else if (pendingStaffPickup) arriveAtStockTech();
    } else {
      player = clampToCanvas(player.x + (dx / dist) * step, player.y + (dy / dist) * step);
    }
  }

  function updateFloorButton() {
    if (!elements.floorButton) return;
    const upstairs = currentFloor === FLOOR_2;
    elements.floorButton.textContent = currentFloor === FLOOR_OR ? 'Leave the OR'
      : currentFloor === FLOOR_CAFE ? 'Leave the Cafeteria'
        : (upstairs ? 'Go Downstairs' : 'Go Upstairs');
    elements.floorButton.setAttribute('aria-pressed', String(currentFloor !== FLOOR_1));
  }

  /** Instant floor switch (Stairs, Elevator or the HUD button), allowed in every phase. */
  function switchFloor(floor, via) {
    currentFloor = floor;
    player = { ...entryPointFor(via) };
    moveTarget = null;
    hoverStation = null;
    pendingTriageAction = null;
    updateFloorButton();
  }

  function isPlayerAtOffice() {
    if (currentFloor !== FLOOR_1) return false;
    const office = stationOfKind('office');
    return Math.hypot(player.x - office.x, player.y - office.y) <= office.w / 2 + PLAYER_STOP_MARGIN + 30;
  }

  function enterOfficeNow() {
    waitingAtOffice = false;
    shiftState = enterOffice(shiftState);
    endShift();
  }

  // -- Triage queue -------------------------------------------------------------

  const QUEUE_VISIBLE_MAX = 4;
  const QUEUE_SLOT_PITCH = 52;
  const QUEUE_SLOT_OFFSET_Y = 72;

  function triageSlots() {
    if (!shiftState) return [];
    const slots = [];
    if (karenAvailable && !shiftState.karen.triggered && shiftState.phase === 'playing') slots.push({ kind: 'karen', id: 'karen' });
    if (shiftState.mel.waiting && shiftState.phase === 'playing') slots.push({ kind: 'mel', id: 'mel' });
    if (shiftState.lostChild.waiting && shiftState.phase === 'playing') slots.push({ kind: 'lost-child', id: 'lost-child' });
    shiftState.triageQueue.slice(0, QUEUE_VISIBLE_MAX).forEach((p) => slots.push({
      kind: 'patient', id: p.id, waitFraction: p.waitMaxSeconds ? p.waitRemainingSeconds / p.waitMaxSeconds : null,
    }));
    halluc.ghosts.forEach((g) => slots.push({ kind: 'ghost', id: g.id }));
    const desk = stationOfKind('triage-desk');
    const totalWidth = (slots.length - 1) * QUEUE_SLOT_PITCH;
    return slots.map((slot, i) => ({
      ...slot,
      x: desk.x - totalWidth / 2 + i * QUEUE_SLOT_PITCH,
      y: desk.y + desk.h / 2 + QUEUE_SLOT_OFFSET_Y,
    }));
  }

  /** A queued patient's whole drawn body (their slot y is their feet). */
  function triageSlotAtPoint(x, y) {
    if (currentFloor !== FLOOR_1) return null;
    return triageSlots().find((slot) => Math.abs(x - slot.x) <= 22 && y >= slot.y - 50 && y <= slot.y + 26) || null;
  }

  // -- Spawning -------------------------------------------------------------------

  /**
   * Schedules the shift's arrivals and pre-rolls every patient (condition,
   * look, name, age, vitals) from shiftRandom, in a fixed order — so a
   * Daily Challenge's patients are identical for everyone, however the
   * shift is played.
   */
  function scheduleShiftEvents() {
    const total = shiftState.totalClockSeconds;
    const events = [];
    const count = daily ? dailyPatientVolume(daily.twist) : patientVolumeFor(currentShiftNumber, isNightShift(currentShiftNumber));
    const rolls = Array.from({ length: count }, () => shiftRandom());
    for (const at of patientArrivalTimes(count, total, rolls)) {
      const r = shiftRandom;
      events.push({
        type: 'patient',
        at,
        spec: {
          conditionId: (daily ? dailyConditionForRolls(daily.twist, r(), r()) : conditionForRoll(currentShiftNumber, r())).id,
          designKey: nextPatientDesignKey(r),
          nameRoll: r(),
          ageRoll: r(),
          vitalsRolls: [r(), r(), r(), r(), r()],
        },
      });
    }
    // One patient may be a celebrity (seeded in the Daily, so it's the same for everyone).
    if (shiftRandom() < CELEBRITY_CHANCE) {
      const patients = events.filter((e) => e.type === 'patient');
      const pick = patients[Math.min(patients.length - 1, 2 + Math.floor(shiftRandom() * Math.max(1, patients.length - 2)))];
      if (pick) pick.spec.vip = true;
    }
    if (random() < LOST_CHILD_CHANCE) events.push({ type: 'lost-child', at: total * (0.2 + random() * 0.5) });
    if (currentShiftNumber === karenShiftNumber) events.push({ type: 'karen', at: total * 0.3 });
    if (currentShiftNumber === MEL_FIXED_SHIFT) events.push({ type: 'mel', at: total * MEL_FIXED_SHIFT_AT });
    return events.sort((a, b) => a.at - b.at);
  }

  /** A shuffled bag of patient designs, so every design shows up before any repeats. */
  let designBag = [];
  function nextPatientDesignKey(rng = random) {
    if (!designBag.length) {
      designBag = [...PATIENT_DESIGN_KEYS];
      for (let i = designBag.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [designBag[i], designBag[j]] = [designBag[j], designBag[i]];
      }
    }
    return designBag.pop();
  }

  /** Draws a patient (feet at x, y) in the anime style. */
  function drawPatient(x, y, info, scale, design = findPatientDesign(info?.designKey)) {
    drawAnimePatient(ctx, x, y, design, { scale, t: performance.now() / 1000 });
  }

  function patientSkin(info) {
    return findPatientDesign(info?.designKey).skin;
  }

  /** Adds a patient to triage: from a pre-rolled `spec` (scheduled arrivals), or fresh rolls (test hooks). */
  function spawnPatient(conditionId, spec = null) {
    const condition = findCondition(spec?.conditionId ?? conditionId) ?? conditionForRoll(currentShiftNumber, random());
    const id = `patient-${patientIdCounter++}`;
    const designKey = spec?.designKey ?? nextPatientDesignKey();
    const usedNames = new Set([...patientInfo.values()].map((info) => info.name));
    patientInfo.set(id, {
      ...patientProfileFor(designKey, spec?.nameRoll ?? random(), spec?.ageRoll ?? random(), usedNames),
      vitals: vitalsForLevel(condition.level, spec?.vitalsRolls ?? [random(), random(), random(), random(), random()]),
      designKey,
    });
    // The receptionist keeps the line calm: waits last RECEPTIONIST_WAIT_BONUS longer.
    shiftState = addPatientToTriage(shiftState, {
      id, conditionId: condition.id, vip: Boolean(spec?.vip),
      waitSeconds: queueWaitSecondsForShift(currentShiftNumber) * RECEPTIONIST_WAIT_BONUS,
    });
    if (spec?.vip) {
      patientInfo.get(id).name = CELEBRITY_NAMES[hashString(id) % CELEBRITY_NAMES.length];
      patientInfo.get(id).shortName = `★ ${patientInfo.get(id).name.split(' ')[0]}`;
      patientInfo.get(id).vip = true;
      showToast('A celebrity just walked in — cameras flashing at the door! Treat them well: their discharge pays double.', 4);
    }
    return id;
  }

  function processScheduledEvents() {
    const elapsed = shiftState.totalClockSeconds - shiftState.clockSeconds;
    while (scheduledEvents.length && scheduledEvents[0].at <= elapsed) {
      const event = scheduledEvents.shift();
      if (event.type === 'patient') {
        spawnPatient(null, event.spec);
        if (melArrivesWithPatient(random())) bringMelIn('arrival');
      } else if (event.type === 'karen') karenAvailable = true;
      else if (event.type === 'mel') bringMelIn('arrival');
      else if (event.type === 'lost-child') {
        const before = shiftState;
        shiftState = lostChildArrives(shiftState);
        if (shiftState !== before) showToast('A little kid is standing in the triage line, looking lost…', 3.6);
      }
    }
  }

  // -- Mel, the easter egg ----------------------------------------------------------
  //
  // Kitchen Shift's Mel, in a dandelion kimono, visits at most once per shift
  // (engine-state's melArrives/visitMel). Four ways in, all landing her in
  // the triage line: a rare arrival with a patient, MEL_FIXED_SHIFT, five
  // clicks on the dandelion vase on the back wall, or typing "mel".

  // On the back wall between the clock and the EMERGENCY sign, clear of the HUD.
  const MEL_VASE_RECT = { x: 616, y: 6, w: 40, h: 52 };
  let melVaseClicks = 0;
  let melVaseWiggle = 0;
  let melCodeBuffer = '';

  const MEL_ARRIVAL_TOASTS = {
    arrival: 'Someone in a dandelion kimono just joined the triage line…',
    vase: 'The dandelions rustle… and someone in a matching kimono joins the triage line.',
    code: 'You whisper her name — Mel waves at you from the triage line!',
  };

  /** Puts Mel in the triage line (once per shift); true if she wasn't there yet. */
  function bringMelIn(via) {
    if (!shiftState) return false;
    const before = shiftState;
    shiftState = melArrives(shiftState);
    if (shiftState === before) return false;
    showToast(MEL_ARRIVAL_TOASTS[via] ?? MEL_ARRIVAL_TOASTS.arrival, 4);
    return true;
  }

  function onMelVaseClick() {
    melVaseWiggle = 0.5;
    melVaseClicks++;
    if (melVaseClicks >= MEL_VASE_CLICKS) {
      melVaseClicks = 0;
      bringMelIn('vase');
    }
  }

  // -- Nurse career rank ------------------------------------------------------------
  //
  // XP (engine-state's `xp`, rules.js's XP_*) adds up in save.careerXp
  // across shifts and months; the rank sets next shift's perks
  // (perksForRank). A rank reached mid-shift is announced right away, but
  // its perk waits for the next shift so a shift's rules never change
  // halfway through.

  let lastLiveRank = 1;
  /** Set once the shift's XP is in save.careerXp, so it isn't counted twice. */
  let shiftXpAwarded = false;

  /** Career XP right now, including the running shift's until it's banked. */
  function liveCareerXp() {
    return save.careerXp + (shiftXpAwarded ? 0 : (shiftState?.xp ?? 0));
  }

  function announceLiveRankUp() {
    if (!shiftState) return;
    const live = rankForXp(liveCareerXp());
    if (live.rank <= lastLiveRank) return;
    lastLiveRank = live.rank;
    showToast(`Promoted to ${live.title} (Lv ${live.rank})! ${live.perk.name} — ${live.perk.description} — starts next shift.`, 4.5);
  }

  /** Adds the shift's XP to the career; returns what it gained. */
  function awardShiftXp() {
    if (shiftXpAwarded) return { gained: 0, ranks: [] };
    const before = save.careerXp;
    save.careerXp = before + (shiftState?.xp ?? 0);
    shiftXpAwarded = true;
    return { gained: save.careerXp - before, ranks: ranksGained(before, save.careerXp) };
  }

  function renderPaycheckXp({ gained, ranks }) {
    const screen = elements.paycheckScreen;
    const rank = rankForXp(save.careerXp);
    if (screen.xp) screen.xp.textContent = `+${gained} XP · Lv ${rank.rank} ${rank.title}`;
    if (screen.rankUp) {
      screen.rankUp.classList.toggle('hidden', ranks.length === 0);
      screen.rankUp.textContent = ranks.length
        ? `Promoted to ${rank.title}! Unlocked: ${ranks.map((r) => `${r.perk.name} (${r.perk.description})`).join(', ')}.`
        : '';
    }
  }

  /** The start screen's career card: rank, progress to the next one, perks so far. */
  function renderRankCard() {
    const card = elements.startScreen.rank;
    if (!card?.root) return;
    const p = rankProgress(save.careerXp);
    card.title.textContent = `Lv ${p.rank.rank} · ${p.rank.title}`;
    card.bar.style.width = `${Math.round(p.fraction * 100)}%`;
    card.next.textContent = p.next
      ? `${p.intoRank} / ${p.needed} XP to ${p.next.title}`
      : 'Top rank reached';
    const perks = [];
    const seen = new Set();
    // Latest tier of each perk kind only (Running Shoes, not Comfy Shoes too).
    for (const r of [...NURSE_RANKS].reverse()) {
      if (r.rank > p.rank.rank || !r.perk) continue;
      const kind = Object.keys(r.perk.effect)[0];
      if (seen.has(kind)) continue;
      seen.add(kind);
      perks.unshift(r.perk.name);
    }
    card.perks.textContent = perks.length ? `Perks: ${perks.join(', ')}` : 'Earn XP to unlock perks.';
  }

  function renderMelBadge() {
    elements.startScreen.melBadge?.classList.toggle('hidden', !save.foundMel);
  }

  /** Accepting her card — the button, Enter/Space, or closing the overlay all do it. */
  function thankMel() {
    if (overlay?.kind !== 'mel') return;
    shiftState = visitMel(shiftState);
    overlay = null;
    const firstTime = !save.foundMel;
    if (firstTime) {
      save.foundMel = true;
      renderMelBadge();
    }
    const gift = `+${MEL_GIFT_GARD}g, +${MEL_SANITY_RESTORE} Sanity, +${MEL_MOOD_RESTORE} Mood`;
    showToast(firstTime
      ? `✿ Easter egg found — Mel in a kimono! ${gift}.`
      : `Mel waves goodbye and pedals off. ${gift}.`, 4.5);
  }

  // -- Overlays: open ---------------------------------------------------------------

  function openTriageOverlay(patientId) {
    overlay = { kind: 'triage', patientId };
  }

  function openSkillOverlay(task) {
    overlay = {
      kind: 'skill', task, gauge: 0, direction: 1, hits: 0,
      required: skillCheckHitsRequired(task), flash: null,
    };
  }

  function openBandageOverlay() {
    overlay = {
      kind: 'bandage',
      path: bandagePathForRolls([random(), random(), random(), random(), random(), random()]),
      samples: [], tracing: false, flash: null, closeIn: 0,
    };
  }

  /** The Med Cabinet's shelves: where its bottles stand (see medsBottleRects). */
  const MED_CABINET = { x: 140, y: 172, w: CANVAS_WIDTH - 280, shelfH: 92 };

  /**
   * The cabinet is a search (the user: "when you get the meds you need to
   * search for the med"): a crowded shelf of small bottles, mostly
   * look-alikes, with the ordered drug exactly once. Each bottle gets a
   * fixed jitter — size, offset, a slight tilt — when the cabinet opens, so
   * the shelf doesn't shuffle while you look.
   */
  function openMedsOverlay() {
    const order = findCondition(shiftState.beds[shiftState.activeTask.bedIndex].conditionId).med;
    const slotW = MED_CABINET.w / MED_CABINET_BOTTLES_PER_SHELF;
    const bottles = medCabinetStock(order.drug, random).map((name, i) => {
      const shelf = Math.floor(i / MED_CABINET_BOTTLES_PER_SHELF);
      const slot = i % MED_CABINET_BOTTLES_PER_SHELF;
      const w = 44 + random() * 14;
      const h = 50 + random() * 22;
      const x = MED_CABINET.x + slot * slotW + (slotW - w) / 2 + (random() - 0.5) * 8;
      const shelfFloor = MED_CABINET.y + (shelf + 1) * MED_CABINET.shelfH - 6;
      return {
        name, color: MEDICATIONS.find((m) => m.name === name)?.color ?? '#e8b440',
        x, y: shelfFloor - h, w, h, tilt: (random() - 0.5) * 0.22, found: false,
      };
    });
    overlay = { kind: 'meds', order, bottles, picked: null, flash: null };
  }

  function openKarenOverlay() {
    overlay = { kind: 'karen' };
  }

  function openMelOverlay() {
    overlay = { kind: 'mel', line: melCardLineForShift(currentShiftNumber), age: 0 };
  }

  /** "Scalpel (Instrument Tray), Kidney (Organ Cooler)" for a list of SURGERY_ITEMS ids. */
  function describeItems(ids) {
    return ids.map((id) => `${SURGERY_ITEMS[id].name} (${SURGERY_SOURCES[SURGERY_ITEMS[id].source].name}${SURGERY_ITEMS[id].source === 'implant-shelf' ? ', 2F' : ''})`).join(', ');
  }

  /**
   * A close-up of a tray/cooler/shelf (the user: "get organs if theres an
   * transplant and sclapels and when you get the item you have to do a
   * skillcheck"): pick the right item from its real items and look-alike
   * decoys, then lift it with a grab skill check — a miss just drops it.
   */
  function openPickOverlay(source) {
    const def = SURGERY_SOURCES[source];
    const cards = [...def.items, ...def.decoys];
    // A fixed shuffle per source so the cards don't jump between visits.
    const order = cards.map((id, i) => [id, (hashString(`${source}:${id}`) + i) % 97]).sort((a, b) => a[1] - b[1]).map(([id]) => id);
    overlay = { kind: 'pick', source, cards: order, chosen: null, gauge: 0, direction: 1, wrong: [], flash: null, closeIn: 0, dropLock: 0 };
  }

  function hashString(text) {
    let h = 0;
    for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return h;
  }

  const PICK_CARD = { w: 120, h: 120, gap: 18, y: 170 };

  function pickCardRects() {
    if (overlay?.kind !== 'pick') return [];
    const n = overlay.cards.length;
    const total = n * PICK_CARD.w + (n - 1) * PICK_CARD.gap;
    const x0 = CANVAS_WIDTH / 2 - total / 2;
    return overlay.cards.map((id, i) => ({ id, x: x0 + i * (PICK_CARD.w + PICK_CARD.gap), y: PICK_CARD.y, w: PICK_CARD.w, h: PICK_CARD.h }));
  }

  /** Whether the kit already holds this item. */
  function kitHas(id) {
    return id === 'scalpel' ? shiftState.surgeryKit.scalpel : shiftState.surgeryKit.item === id;
  }

  function choosePickCard(id) {
    if (overlay.chosen || overlay.closeIn > 0 || overlay.wrong.includes(id)) return;
    if (SURGERY_ITEMS[id] && kitHas(id)) {
      flash(`You already have the ${SURGERY_ITEMS[id].name.toLowerCase()}.`, true);
      return;
    }
    if (!surgeryItemsNeeded(shiftState).has(id)) {
      shiftState = takeSurgeryItem(shiftState, id); // a mistake
      overlay.wrong.push(id);
      flash(SURGERY_ITEMS[id] ? `No surgery needs a ${SURGERY_ITEMS[id].name.toLowerCase()}! (mistake)` : `That's ${id.toLowerCase()} — wrong item! (mistake)`, false);
      return;
    }
    overlay.chosen = id;
    overlay.gauge = 0;
    overlay.direction = 1;
  }

  /** The grab skill check: a hit takes the item, a miss drops it (no mistake). */
  function samplePickGrab() {
    if (!overlay.chosen || overlay.closeIn > 0) return;
    if (overlay.dropLock > 0) return; // a beat after a drop, so mashing doesn't retry instantly
    const zone = skillCheckSuccessZone('grab', skillZoneScaleNow());
    if (!isSkillCheckSuccess(overlay.gauge, zone)) {
      flash('Dropped it! Try again.', false);
      overlay.gauge = 0;
      overlay.direction = 1;
      overlay.dropLock = 0.3;
      return;
    }
    const id = overlay.chosen;
    shiftState = takeSurgeryItem(shiftState, id);
    flash(`Got the ${SURGERY_ITEMS[id].name.toLowerCase()}!`, true);
    overlay.closeIn = 0.7;
  }

  function openCoffeeOverlay() {
    overlay = { kind: 'coffee-pour', fill: 0, pouring: false, band: coffeePourTargetBand(random()), grade: null, closeIn: 0 };
  }

  /** Where the Oxygen scene scatters its hearts and skulls (right of the patient and bag). */
  const OXYGEN_SCENE = { x: 390, y: 172, w: 420, h: 276 };
  const OXYGEN_HIT_RADIUS = 26;

  function openOxygenOverlay() {
    const count = OXYGEN_HEARTS + OXYGEN_SKULLS;
    const points = [];
    for (let i = 0; i < count; i++) {
      let candidate;
      for (let attempt = 0; attempt < 60; attempt++) {
        candidate = { x: OXYGEN_SCENE.x + random() * OXYGEN_SCENE.w, y: OXYGEN_SCENE.y + random() * OXYGEN_SCENE.h };
        if (points.every((p) => Math.hypot(p.x - candidate.x, p.y - candidate.y) >= 72)) break;
      }
      points.push(candidate);
    }
    // Shuffle which points are hearts so they aren't always the first-placed ones.
    const kinds = [...Array(OXYGEN_HEARTS).fill('heart'), ...Array(OXYGEN_SKULLS).fill('skull')];
    for (let i = kinds.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
    }
    overlay = {
      kind: 'oxygen',
      items: points.map((p, i) => ({ id: i, x: p.x, y: p.y, kind: kinds[i], found: false, fade: 0, phase: random() * Math.PI * 2 })),
      hits: 0, required: OXYGEN_HEARTS, squeeze: 0, flash: null,
      // The monitor's SpO₂ climbs from the patient's triage reading to 98%
      // as the good pumps land (display only — the step is the three hearts).
      spo2Start: Math.min(88, patientInfo.get(shiftState.activeTask?.patientId)?.vitals?.spo2 ?? 86),
      spo2: Math.min(88, patientInfo.get(shiftState.activeTask?.patientId)?.vitals?.spo2 ?? 86),
    };
  }

  function openTaskOverlay(task) {
    if (task === 'bandage') openBandageOverlay();
    else if (task === 'oxygen') openOxygenOverlay();
    else openSkillOverlay(task);
  }

  function flash(text, good) {
    if (overlay) overlay.flash = { text, good, seconds: 0.9 };
  }

  // -- Arrival dispatch ---------------------------------------------------------

  function handleArrival(station) {
    if (station.kind === 'stairs' || station.kind === 'elevator') {
      switchFloor(station.targetFloor, station.kind);
      return;
    }
    if (!shiftState) return;
    const playing = shiftState.phase === 'playing';

    if (station.kind === 'office') {
      if (isOfficeReady(shiftState)) {
        enterOfficeNow();
      } else if (shiftState.phase === 'closing-wait') {
        waitingAtOffice = true;
        showToast(`Handing over to the night shift — wait here ${Math.ceil(shiftState.closingWaitSecondsRemaining)}s.`);
      } else if (playing) {
        showToast('The charge nurse pays you after the shift ends at 7:00 PM.');
      }
      return;
    }
    if (!playing) return;

    if (station.kind === 'triage-desk') {
      const action = pendingTriageAction
        ?? (karenAvailable && !shiftState.karen.triggered ? { kind: 'karen' } : null)
        ?? (shiftState.mel.waiting ? { kind: 'mel' } : null)
        ?? (shiftState.lostChild.waiting ? { kind: 'lost-child' } : null)
        ?? (shiftState.triageQueue[0] ? { kind: 'patient', id: shiftState.triageQueue[0].id } : null);
      pendingTriageAction = null;
      if (!action) {
        showToast('Nobody waiting at triage right now.');
      } else if (action.kind === 'ghost') {
        halluc.ghosts = halluc.ghosts.filter((g) => g.id !== action.id);
        shiftState = startleFromHallucination(shiftState);
        showToast("…the chair is empty. There was nobody there.");
      } else if (action.kind === 'mel') {
        if (shiftState.mel.waiting) openMelOverlay();
      } else if (action.kind === 'lost-child') {
        if (shiftState.lostChild.waiting) overlay = { kind: 'lost-child', flash: null };
      } else if (action.kind === 'karen') {
        const before = shiftState;
        shiftState = startKarenEvent(shiftState);
        if (shiftState !== before) openKarenOverlay();
      } else if (canTriage(shiftState, action.id)) {
        openTriageOverlay(action.id);
      } else if (freeBedIndex(shiftState) === -1) {
        showToast('No free beds — treat and discharge someone first.');
      }
      return;
    }

    if (station.kind === 'bed') {
      handleBedArrival(station.bedIndex);
      return;
    }

    if (station.kind === 'supply-cart') {
      if (shiftState.hasBandage) {
        showToast('You already have a bandage roll in your pocket — use it on a wound first.');
        return;
      }
      shiftState = pickUpBandage(shiftState);
      const waiting = shiftState.beds.map((b, i) => (currentStep(b) === 'bandage' && !b.inSurgery ? bedLabel(i) : null)).filter(Boolean);
      showToast(waiting.length
        ? `Got a bandage roll — ${waiting.join(', ')} ${waiting.length === 1 ? 'needs' : 'need'} a dressing downstairs.`
        : 'Got a bandage roll — keep it for the next wound.');
      return;
    }

    if (station.kind === 'med-cabinet') {
      if (shiftState.carried) {
        showToast(`Your hands are full — ${handsFullReason()}`);
        return;
      }
      const before = shiftState;
      shiftState = startMedsDispense(shiftState);
      if (shiftState !== before) openMedsOverlay();
      else showToast('No medication orders right now.');
      return;
    }

    if (station.kind === 'operating-room') {
      // The ER's OR tile is the door into the walk-in Operating Room.
      switchFloor(FLOOR_OR, 'or-enter');
      const missing = surgeryMissing(shiftState);
      showToast(surgeryPatient(shiftState)
        ? (missing.length ? `In the OR. Still need: ${describeItems(missing)}.` : 'In the OR — everything is ready. Go to the table.')
        : 'In the OR. Grab a scalpel and what the next surgery needs, then bring the patient.', 3.6);
      return;
    }
    if (station.kind === 'or-door') {
      switchFloor(FLOOR_1, 'or-exit');
      return;
    }
    if (station.kind === 'cafeteria-door') {
      // Shut at night (the user: "make it so that the cafeteria is shut down
      // in night shift") — the vending machine is the only food then.
      if (shiftState.night) {
        showToast("The Cafeteria is closed for the night — try the vending machine.", 3.6);
        return;
      }
      switchFloor(FLOOR_CAFE, 'cafe-enter');
      showToast(`The Cafeteria — ${CAFE_LADY_NAME} serves free meals and water at the counter.`);
      return;
    }
    if (station.kind === 'cafe-door') {
      switchFloor(FLOOR_1, 'cafe-exit');
      return;
    }
    if (station.kind === 'battery-shelf') {
      const before = shiftState;
      shiftState = pickUpBattery(shiftState);
      showToast(shiftState === before
        ? `Your pockets are full — ${FLASHLIGHT_MAX_SPARES} spare batteries is the most you can carry.`
        : `Got a spare battery (${shiftState.flashlight.spares}/${FLASHLIGHT_MAX_SPARES}). It swaps in when the flashlight runs flat.`);
      return;
    }
    if (station.kind === 'vending-machine') {
      if (shiftState.security?.vendingBroken) {
        showToast("The vending machine is out of order — the thief cleaned it out. Try the Cafeteria (or tomorrow's shift).", 3.4);
        return;
      }
      overlay = { kind: 'vending', flash: null };
      return;
    }
    if (station.kind === 'cafe-counter') {
      overlay = { kind: 'cafe', flash: null, served: false, closeIn: 0 };
      return;
    }
    if (station.kind === 'or-table') {
      const before = shiftState;
      shiftState = startSurgery(shiftState);
      if (shiftState !== before) {
        openSkillOverlay('surgery');
        return;
      }
      const missing = surgeryMissing(shiftState);
      if (shiftState.orPatient && shiftState.carried) showToast(`A patient is waiting on the table — free your hands to scrub in (${handsFullReason()})`);
      else if (!surgeryPatient(shiftState)) showToast('Bring a patient who needs surgery — take their gurney from the bed, or click the Orderly.');
      else if (missing.length) showToast(`You can't operate yet — get ${describeItems(missing)}.`, 3.4);
      return;
    }
    if (station.kind === 'instrument-tray' || station.kind === 'organ-cooler' || station.kind === 'implant-shelf') {
      openPickOverlay(station.kind);
      return;
    }

    if (station.kind === 'coffee-machine') {
      if (dailyEffect('noCoffee')) showToast("The coffee machine is out of order today — that's the Daily Challenge twist.");
      else openCoffeeOverlay();
    }
  }

  function handsFullReason() {
    const carried = shiftState.carried;
    if (carried?.kind === 'meds') return `you're holding meds for ${bedLabel(carried.bedIndex)}.`;
    if (carried?.kind === 'gurney') return 'get the gurney to the OR first.';
    return '';
  }

  function handleBedArrival(bedIndex) {
    const patient = shiftState.beds[bedIndex];
    const label = bedLabel(bedIndex);
    const carried = shiftState.carried;
    if (!patient) {
      showToast(`${label} is empty — triage someone into it.`);
      return;
    }
    if (patient.inSurgery) {
      showToast(`${label}'s patient is in surgery — head to the Operating Room.`);
      return;
    }
    if (carried?.kind === 'meds') {
      if (carried.bedIndex !== bedIndex) {
        showToast(`These meds are for ${bedLabel(carried.bedIndex)}.`);
        return;
      }
      // Giving them is a skill check (the user: "when you go and get it to
      // the patient you have to do a skill check").
      const before = shiftState;
      shiftState = deliverMeds(shiftState, bedIndex);
      if (shiftState !== before) openSkillOverlay('meds');
      return;
    }
    if (carried?.kind === 'gurney') {
      showToast("You're pushing a gurney — take it to the Operating Room.");
      return;
    }
    const step = currentStep(patient);
    if (step === 'bandage' && !shiftState.hasBandage) {
      showToast(`${label} needs a bandage — grab a roll from the Supply Cart upstairs (2nd Floor).`);
      return;
    }
    if (BED_MINIGAME_TREATMENTS.includes(step)) {
      const before = shiftState;
      shiftState = startBedTask(shiftState, bedIndex);
      if (shiftState !== before) openTaskOverlay(step);
    } else if (step === 'meds') {
      const med = findCondition(patient.conditionId).med;
      showToast(`${label} needs ${med.drug} ×${med.dose} — get it from the Med Cabinet.`);
    } else if (step === 'surgery') {
      const before = shiftState;
      shiftState = startSurgeryTransport(shiftState, bedIndex);
      if (shiftState !== before) showToast(`Wheeling ${label}'s patient to the Operating Room…`);
      else showToast(`${label} needs surgery, but your hands are full — ${handsFullReason()}`);
    }
  }

  /** Toast for a completed step — "discharged" when it emptied the bed. */
  function announceStepDone(bedIndex, before, what) {
    const patient = before.beds[bedIndex];
    const name = patientInfo.get(patient.id)?.name ?? 'The patient';
    if (!shiftState.beds[bedIndex]) {
      showToast(`${what} — ${name} is discharged! +${TREATMENT_TIP_GARD + DISCHARGE_GARD[patient.level]}g`);
    } else {
      showToast(`${what} +${TREATMENT_TIP_GARD}g — next for ${name}: ${TREATMENT_LABELS[currentStep(shiftState.beds[bedIndex])]}.`);
    }
  }

  // -- Overlay input ------------------------------------------------------------------

  const PANEL = { x: 110, y: 64, w: 740, h: 480 };
  const CLOSE_RECT = { x: PANEL.x + PANEL.w - 40, y: PANEL.y + 12, w: 28, h: 28 };

  function closeOverlay() {
    if (!overlay) return;
    if (overlay.kind === 'karen') return; // she won't be ignored — answer her
    if (overlay.kind === 'mel') { thankMel(); return; }
    if (overlay.kind === 'coffee-pour' && (overlay.pouring || overlay.grade)) return;
    if (TASK_OVERLAYS.has(overlay.kind)) shiftState = cancelTask(shiftState);
    overlay = null;
  }

  function triageButtonRects() {
    const w = 170;
    const gap = 20;
    const startX = CANVAS_WIDTH / 2 - (TRIAGE_LEVELS.length * w + (TRIAGE_LEVELS.length - 1) * gap) / 2;
    return TRIAGE_LEVELS.map((level, i) => ({ level: level.id, x: startX + i * (w + gap), y: 462, w, h: 50 }));
  }

  function chooseTriage(levelId) {
    const patientId = overlay.patientId;
    const queued = shiftState.triageQueue.find((p) => p.id === patientId);
    if (!queued) { overlay = null; return; }
    const bedIndex = freeBedIndex(shiftState);
    shiftState = resolveTriage(shiftState, patientId, levelId);
    overlay = null;
    const actual = findTriageLevel(queued.level);
    const name = patientInfo.get(patientId)?.name ?? 'Patient';
    if (levelId === queued.level) showToast(`${name} → ${bedLabel(bedIndex)} (${actual.name}). Good call.`);
    else showToast(`Not quite — ${name} is ${actual.name}. The charge nurse corrected it. ${name} → ${bedLabel(bedIndex)}.`, 3.6);
  }

  /** Every skill-check zone's scale right now: shaky hands, the rank perk, and Hunger/Thirst. */
  function skillZoneScaleNow() {
    const fed = shiftState ? skillZoneScaleForHungerThirst(shiftState.hunger, shiftState.thirst) : 1;
    return shakyHandsZoneScale(currentIntensity()) * (shiftState?.perks?.skillZone ?? 1) * fed;
  }

  /** The table's stage names for the patient in surgery (SURGERY_STAGES for other tasks). */
  function skillStages() {
    if (overlay?.task !== 'surgery') return SURGERY_STAGES;
    const bed = shiftState.beds[shiftState.activeTask?.bedIndex];
    return bed ? surgeryStagesFor(bed.conditionId) : SURGERY_STAGES;
  }

  function sampleSkillCheck() {
    if (overlay.flash && !overlay.flash.good && overlay.flash.seconds > 0.6) return; // brief lockout after a miss
    const zone = skillCheckSuccessZone(overlay.task, skillZoneScaleNow());
    const hit = isSkillCheckSuccess(overlay.gauge, zone);
    const resolve = overlay.task === 'surgery' ? resolveSurgery : (overlay.task === 'meds' ? resolveMedsGive : resolveBedTask);
    if (!hit) {
      shiftState = resolve(shiftState, false);
      flash('Missed!', false);
      overlay.gauge = 0;
      overlay.direction = 1;
      return;
    }
    overlay.hits += 1;
    if (overlay.hits < overlay.required) {
      flash(`${skillStages()[overlay.hits - 1] ?? 'Step'} done!`, true);
      return;
    }
    const before = shiftState;
    const bedIndex = shiftState.activeTask.bedIndex;
    shiftState = resolve(shiftState, true);
    const task = overlay.task;
    overlay = null;
    const doneText = task === 'surgery' ? 'Surgery went well' : (task === 'meds' ? 'Meds given' : `${TREATMENT_LABELS[task]} done`);
    announceStepDone(bedIndex, before, doneText);
  }

  /**
   * A click on the Oxygen scene: a heart is one good pump (three finish
   * the step), a skull is a missed skill check — a mistake — and fades out
   * so the same slip can't cost twice.
   */
  function handleOxygenClick(x, y) {
    const item = overlay.items
      .filter((it) => !it.found && Math.hypot(it.x - x, it.y - y) <= OXYGEN_HIT_RADIUS)
      .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0] ?? null;
    const result = gradeOxygenClick(item);
    if (result === 'nothing') return;
    item.found = true;
    if (result === 'miss') {
      shiftState = resolveBedTask(shiftState, false);
      flash('A skull — missed pump!', false);
      return;
    }
    overlay.hits += 1;
    overlay.squeeze = 1;
    if (overlay.hits < overlay.required) {
      flash('Good pump!', true);
      return;
    }
    const before = shiftState;
    const bedIndex = shiftState.activeTask.bedIndex;
    shiftState = resolveBedTask(shiftState, true);
    overlay = null;
    announceStepDone(bedIndex, before, 'Breathing easier — Oxygen done');
  }

  function finishBandageTrace() {
    if (overlay?.kind !== 'bandage' || !overlay.tracing) return;
    overlay.tracing = false;
    const grade = gradeBandageTrace(overlay.samples, overlay.path);
    if (grade.success) {
      const before = shiftState;
      const bedIndex = shiftState.activeTask.bedIndex;
      shiftState = resolveBedTask(shiftState, true);
      overlay.closeIn = 0.8;
      overlay.flash = { text: 'Neatly dressed!', good: true, seconds: 0.8 };
      announceStepDone(bedIndex, before, 'Bandaged');
    } else {
      shiftState = resolveBedTask(shiftState, false);
      flash(grade.coverage < 0.85 ? 'Cover the whole wound — start to end!' : 'Too wobbly — stay on the line!', false);
      overlay.samples = [];
    }
  }

  function medsBottleRects() {
    return overlay.bottles.map((b, i) => ({ ...b, index: i }));
  }

  /**
   * A click on a cabinet bottle: the ordered drug is found (then pick the
   * dose); any other bottle is the wrong medication — a mistake, and that
   * bottle is set aside (greyed) so the same slip can't cost twice.
   */
  function pickBottle(index) {
    const bottle = overlay.bottles[index];
    if (bottle.found || overlay.picked) return;
    if (gradeMedsPick(overlay.order, bottle.name, overlay.order.dose) === 'wrong-drug') {
      bottle.found = true;
      shiftState = resolveMedsDispense(shiftState, false);
      flash(`That's ${bottle.name} — read the label!`, false);
      return;
    }
    overlay.picked = bottle.name;
    flash(`Found ${bottle.name}! Now the dose.`, true);
  }

  function medsDoseRects() {
    const w = 96;
    const gap = 18;
    const startX = CANVAS_WIDTH / 2 + 20;
    return DOSE_CHOICES.map((dose, i) => ({ dose, x: startX + i * (w + gap), y: 470, w, h: 46 }));
  }

  function pickDose(dose) {
    if (!overlay.picked) {
      flash(`Find the ${overlay.order.drug} first.`, false);
      return;
    }
    const result = gradeMedsPick(overlay.order, overlay.picked, dose);
    if (result === 'correct') {
      const bedIndex = shiftState.activeTask.bedIndex;
      const drug = overlay.order.drug;
      shiftState = resolveMedsDispense(shiftState, true);
      overlay = null;
      showToast(`Got ${drug} × ${dose} — take them to ${bedLabel(bedIndex)}.`);
      return;
    }
    shiftState = resolveMedsDispense(shiftState, false);
    flash('Wrong dose — check the order!', false);
  }

  function karenButtonRects() {
    const w = 160;
    const h = 42;
    const gap = 14;
    const x0 = CANVAS_WIDTH / 2 - (w * 3 + gap * 2) / 2;
    return {
      explain: { x: x0, y: 470, w, h },
      security: { x: x0 + w + gap, y: 470, w, h },
      letCut: { x: x0 + (w + gap) * 2, y: 470, w, h },
    };
  }

  function melButtonRect() {
    return { x: 540, y: 462, w: 220, h: 44 };
  }

  function answerKaren(outcome) {
    shiftState = resolveKarenEvent(shiftState, outcome);
    overlay = null;
    showToast({
      explain: `She calms down and waits her turn. (Later: a thank-you card, +${KAREN_CALMED_TIP_GARD}g)`,
      security: 'Security politely escorts her out. Crisis over — no thank-you card, though.',
    }[outcome] ?? 'She barges ahead — the whole waiting room is furious.');
  }

  function onOverlayClick(x, y) {
    if (insideRect(CLOSE_RECT, x, y) && overlay.kind !== 'karen' && overlay.kind !== 'coffee-pour') {
      closeOverlay();
      return;
    }
    if (overlay.kind === 'triage') {
      const hit = triageButtonRects().find((r) => insideRect(r, x, y));
      if (hit) chooseTriage(hit.level);
    } else if (overlay.kind === 'skill') {
      sampleSkillCheck();
    } else if (overlay.kind === 'oxygen') {
      handleOxygenClick(x, y);
    } else if (overlay.kind === 'meds') {
      // Topmost (last-drawn) bottle wins where neighbours overlap.
      const bottle = medsBottleRects().filter((r) => insideRect(r, x, y)).pop();
      if (bottle) { pickBottle(bottle.index); return; }
      const dose = medsDoseRects().find((r) => insideRect(r, x, y));
      if (dose) pickDose(dose.dose);
    } else if (overlay.kind === 'karen') {
      const b = karenButtonRects();
      if (insideRect(b.explain, x, y)) answerKaren('explain');
      else if (insideRect(b.security, x, y)) answerKaren('security');
      else if (insideRect(b.letCut, x, y)) answerKaren('letCut');
    } else if (overlay.kind === 'mel') {
      if (insideRect(melButtonRect(), x, y)) thankMel();
    } else if (overlay.kind === 'vending') {
      const card = vendingCardRects().find((r) => insideRect(r, x, y));
      if (card) buyFromVending(card.id);
      else if (insideRect(vendingBatteryRect(), x, y)) {
        const before = shiftState;
        shiftState = buyBattery(shiftState, spendableGard());
        if (shiftState !== before) flash(`Battery! −${BATTERY_PRICE}g`, true);
        else if (spendableGard() < BATTERY_PRICE) flash(`Not enough Gard — a battery is ${BATTERY_PRICE}g.`, false);
        else flash('Your pockets are full of batteries!', false);
      }
    } else if (overlay.kind === 'cafe') {
      if (insideRect(cafeButtonRect(), x, y)) eatCafeMeal();
    } else if (overlay.kind === 'lost-child') {
      if (insideRect(lostChildButtonRect(), x, y)) walkLostChild();
    } else if (overlay.kind === 'pick') {
      if (overlay.chosen) { samplePickGrab(); return; }
      const card = pickCardRects().find((r) => insideRect(r, x, y));
      if (card) choosePickCard(card.id);
    }
  }

  // -- Coffee Pour (ported from Library Shift) ----------------------------------------

  const COFFEE_RESULT_SECONDS = 1.2;
  const COFFEE_RESULT_TEXT = {
    perfect: `Perfect pour! Fully refreshed, +${COFFEE_MOOD_RESTORE.perfect} Mood, +${COFFEE_PERFECT_TIP_GARD} Gard tip.`,
    good: `Nice cup — feeling better. +${COFFEE_MOOD_RESTORE.good} Mood.`,
    sloppy: `A bit sloppy, but coffee is coffee. +${COFFEE_MOOD_RESTORE.sloppy} Mood.`,
    spilled: 'Ow! Hot coffee all over your scrubs — −50 Sanity.',
  };
  const COFFEE_SPLASH_SECONDS = 6;
  let coffeeSplashSeconds = 0;

  function startCoffeePour() {
    if (overlay?.kind === 'coffee-pour' && !overlay.grade) overlay.pouring = true;
  }

  function stopCoffeePour() {
    if (overlay?.kind === 'coffee-pour' && overlay.pouring && !overlay.grade) finishCoffeePour();
  }

  function finishCoffeePour() {
    overlay.pouring = false;
    overlay.grade = gradeCoffeePour(overlay.fill, overlay.band);
    overlay.closeIn = COFFEE_RESULT_SECONDS;
    shiftState = brewCoffee(shiftState, overlay.grade);
    if (overlay.grade === 'spilled') coffeeSplashSeconds = COFFEE_SPLASH_SECONDS;
    showToast(COFFEE_RESULT_TEXT[overlay.grade]);
  }

  // -- Hallucinations (Library Shift's v2.16, ER-flavored) ------------------------------

  const WHISPERS = ['code blue…', 'beep… beep… beep…', 'bed five is empty', "you missed a dose", 'they never left', 'who paged me?', 'turn around', 'flatline…'];
  let halluc = { figures: [], whispers: [], ghosts: [], flicker: 0, scare: 0, ghostCounter: 0 };

  function currentIntensity() {
    return shiftState && shiftState.phase === 'playing' ? hallucinationIntensity(shiftState.sanity) : 0;
  }

  function resetHallucinations() {
    halluc = { figures: [], whispers: [], ghosts: [], flicker: 0, scare: 0, ghostCounter: halluc.ghostCounter };
  }

  function updateHallucinations(dt) {
    const i = currentIntensity();
    if (i <= 0) {
      if (halluc.figures.length || halluc.whispers.length || halluc.ghosts.length) resetHallucinations();
      return;
    }
    const age = (list) => list.map((it) => ({ ...it, age: it.age + dt })).filter((it) => it.age < it.life);
    halluc.figures = age(halluc.figures);
    halluc.whispers = age(halluc.whispers);
    halluc.ghosts = age(halluc.ghosts);
    halluc.flicker = Math.max(0, halluc.flicker - dt);
    halluc.scare = Math.max(0, halluc.scare - dt);
    if (i > 0.3 && random() < 0.35 * i * dt) halluc.figures.push({ x: 80 + random() * (CANVAS_WIDTH - 160), y: 180 + random() * 360, age: 0, life: 0.8 + random() * 1.2 });
    if (random() < 0.3 * i * dt) {
      halluc.whispers.push({ text: WHISPERS[Math.floor(random() * WHISPERS.length)], x: 120 + random() * (CANVAS_WIDTH - 240), y: 160 + random() * 360, age: 0, life: 2.6 });
    }
    if (random() < 0.12 * i * dt) halluc.flicker = 0.18;
    if (i >= 1 && random() < 0.04 * dt) halluc.scare = 0.45;
    if (i >= 0.5 && halluc.ghosts.length === 0 && random() < 0.06 * i * dt) halluc.ghosts.push({ id: `ghost-${halluc.ghostCounter++}`, age: 0, life: 15 });
    const dropping = shiftState.carried?.kind === 'meds' ? 'meds' : (shiftState.hasBandage ? 'bandage' : null);
    if (!overlay && dropping && random() < MEDS_DROP_CHANCE_PER_SECOND * i * dt) {
      shiftState = dropCarriedSupply(shiftState);
      showToast(dropping === 'meds'
        ? 'Your hands shake — the pills scatter across the floor. Fetch them again.'
        : 'Your hands shake — the bandage roll unravels across the floor. Get another upstairs.');
    }
  }

  function drawShadowFigure(fx, fy, alpha, scale = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#0c1418';
    ctx.beginPath();
    ctx.arc(fx, fy - 62 * scale, 13 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(fx - 18 * scale, fy);
    ctx.quadraticCurveTo(fx - 20 * scale, fy - 40 * scale, fx - 9 * scale, fy - 52 * scale);
    ctx.lineTo(fx + 9 * scale, fy - 52 * scale);
    ctx.quadraticCurveTo(fx + 20 * scale, fy - 40 * scale, fx + 18 * scale, fy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff5050';
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(fx + dir * 4.5 * scale, fy - 63 * scale, 1.8 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawHallucinations() {
    const i = currentIntensity();
    if (i <= 0) return;
    const t = performance.now() / 1000;
    for (const f of halluc.figures) {
      const fade = Math.sin((f.age / f.life) * Math.PI);
      drawShadowFigure(f.x, f.y, 0.55 * fade * (0.7 + 0.3 * Math.sin(t * 30)));
    }
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'italic 15px Georgia, serif';
    for (const w of halluc.whispers) {
      const fade = Math.sin((w.age / w.life) * Math.PI);
      ctx.fillStyle = `rgba(40,90,90,${0.8 * fade})`;
      ctx.fillText(w.text, w.x + Math.sin(t * 2 + w.x) * 6, w.y - w.age * 8);
    }
    ctx.restore();
    const pulse = 0.85 + 0.15 * Math.sin(t * 2.2);
    const v = ctx.createRadialGradient(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 90 + 170 * (1 - i), CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 560);
    v.addColorStop(0, 'rgba(0,25,30,0)');
    v.addColorStop(0.6, `rgba(0,25,30,${0.45 * i * pulse})`);
    v.addColorStop(1, `rgba(0,15,20,${0.9 * i * pulse})`);
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    if (halluc.flicker > 0) {
      ctx.fillStyle = 'rgba(0,10,15,0.55)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
    if (halluc.scare > 0) {
      ctx.fillStyle = `rgba(0,10,10,${0.6 * (halluc.scare / 0.45)})`;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      drawShadowFigure(CANVAS_WIDTH / 2, CANVAS_HEIGHT + 120, halluc.scare / 0.45, 4.2);
    }
  }

  // -- Overlay updates ----------------------------------------------------------------

  function updateOverlay(dt) {
    if (!overlay) return;
    if (overlay.flash) {
      overlay.flash.seconds -= dt;
      if (overlay.flash.seconds <= 0) overlay.flash = null;
    }
    if (overlay.kind === 'oxygen') {
      overlay.squeeze = Math.max(0, overlay.squeeze - dt * 2.2);
      const spo2Target = overlay.spo2Start + (98 - overlay.spo2Start) * (overlay.hits / overlay.required);
      overlay.spo2 += (spo2Target - overlay.spo2) * Math.min(1, dt * 2.5);
      for (const it of overlay.items) if (it.found) it.fade = Math.min(1, it.fade + dt * 2.5);
    } else if (overlay.kind === 'skill') {
      const speed = skillCheckSweepSpeed(currentShiftNumber, overlay.task) * shakyHandsSweepMultiplier(currentIntensity());
      overlay.gauge += overlay.direction * speed * dt;
      if (overlay.gauge >= 1) { overlay.gauge = 1; overlay.direction = -1; } else if (overlay.gauge <= 0) { overlay.gauge = 0; overlay.direction = 1; }
    } else if (overlay.kind === 'cafe' && overlay.closeIn > 0) {
      overlay.closeIn -= dt;
      if (overlay.closeIn <= 0) overlay = null;
    } else if (overlay.kind === 'pick') {
      overlay.dropLock = Math.max(0, overlay.dropLock - dt);
      if (overlay.closeIn > 0) {
        overlay.closeIn -= dt;
        if (overlay.closeIn <= 0) overlay = null;
      } else if (overlay.chosen && overlay.direction !== 0) {
        const speed = skillCheckSweepSpeed(currentShiftNumber, 'grab') * shakyHandsSweepMultiplier(currentIntensity());
        overlay.gauge += overlay.direction * speed * dt;
        if (overlay.gauge >= 1) { overlay.gauge = 1; overlay.direction = -1; } else if (overlay.gauge <= 0) { overlay.gauge = 0; overlay.direction = 1; }
      }
    } else if (overlay.kind === 'bandage' && overlay.closeIn > 0) {
      overlay.closeIn -= dt;
      if (overlay.closeIn <= 0) overlay = null;
    } else if (overlay.kind === 'coffee-pour') {
      if (overlay.grade) {
        overlay.closeIn -= dt;
        if (overlay.closeIn <= 0) overlay = null;
      } else if (overlay.pouring) {
        overlay.fill = Math.min(1, overlay.fill + dt / COFFEE_POUR_SECONDS_TO_BRIM);
        if (overlay.fill >= 1) finishCoffeePour();
      }
    }
  }

  // -- Canvas input ----------------------------------------------------------------

  function onCanvasClick(e) {
    if (!running) return;
    const { x, y } = canvasCoordsFromEvent(e);
    if (overlay) {
      onOverlayClick(x, y);
      return;
    }
    // People before the cat: clicking a nurse with the cat at their feet
    // should reach the nurse.
    const member = staffAtPoint(x, y);
    if (member && shiftState?.phase === 'playing') {
      onStaffClick(member);
      return;
    }
    if (incidentAtPoint(x, y) && shiftState?.phase === 'playing') {
      showToast(incident.phase === 'active'
        ? 'Better leave this to Security — click a guard to send him over.'
        : 'Security has it handled.');
      return;
    }
    if (catAtPoint(x, y) && shiftState?.phase === 'playing') {
      petTheCat();
      return;
    }
    if (shiftState?.phase === 'playing' && currentFloor === FLOOR_1 && insideRect(MEL_VASE_RECT, x, y)) {
      onMelVaseClick();
      return;
    }
    if (shiftState?.phase === 'playing') {
      const slot = triageSlotAtPoint(x, y);
      if (slot) {
        pendingTriageAction = { kind: slot.kind, id: slot.id };
        commitStationTarget(stationOfKind('triage-desk'), null);
        return;
      }
    }
    pendingTriageAction = null;
    commitStationTarget(stationAtPoint(x, y, visibleStations()), { x, y });
  }

  function onCanvasPointerDown(e) {
    if (!running || !overlay) return;
    if (overlay.kind === 'coffee-pour') {
      e.preventDefault();
      startCoffeePour();
    } else if (overlay.kind === 'bandage' && overlay.closeIn <= 0) {
      const p = canvasCoordsFromEvent(e);
      if (insideRect(CLOSE_RECT, p.x, p.y)) return;
      e.preventDefault();
      overlay.tracing = true;
      overlay.samples = [p];
    }
  }

  function onCanvasPointerMove(e) {
    aim = canvasCoordsFromEvent(e);
    if (overlay?.kind === 'bandage' && overlay.tracing) {
      overlay.samples.push(canvasCoordsFromEvent(e));
      return;
    }
    if (overlay) { canvas.style.cursor = ''; return; }
    const { x, y } = canvasCoordsFromEvent(e);
    hoverStation = stationAtPoint(x, y, visibleStations());
    canvas.style.cursor = hoverStation || triageSlotAtPoint(x, y) || staffAtPoint(x, y) ? 'pointer' : '';
  }

  function onWindowPointerUp() {
    stopCoffeePour();
    finishBandageTrace();
  }

  function onCanvasMouseLeave() {
    hoverStation = null;
  }

  function onKeyDown(e) {
    if (!running) return;
    if (overlay) {
      if (e.key === 'Escape') { e.preventDefault(); closeOverlay(); return; }
      const digit = Number(e.key);
      if (overlay.kind === 'triage' && digit >= 1 && digit <= TRIAGE_LEVELS.length) {
        e.preventDefault();
        chooseTriage(TRIAGE_LEVELS[digit - 1].id);
        return;
      }
      if (overlay.kind === 'meds') {
        if (overlay.picked && DOSE_CHOICES.includes(digit)) { e.preventDefault(); pickDose(digit); return; }
      }
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (e.repeat) return;
        if (overlay.kind === 'coffee-pour') startCoffeePour();
        else if (overlay.kind === 'skill') sampleSkillCheck();
        else if (overlay.kind === 'mel') thankMel();
        else if (overlay.kind === 'pick') samplePickGrab();
        else if (overlay.kind === 'cafe') eatCafeMeal();
        else if (overlay.kind === 'lost-child') walkLostChild();
      }
      return;
    }
    if (shiftState?.phase === 'playing' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const typed = typeSecretCodeKey(melCodeBuffer, e.key);
      melCodeBuffer = typed.buffer;
      if (typed.matched) bringMelIn('code');
    }
    if ((e.key === 'f' || e.key === 'F') && shiftState?.night && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      flipFlashlight();
      return;
    }
    if (e.key === 'Enter' && hoverStation) {
      e.preventDefault();
      commitStationTarget(hoverStation, null);
    }
  }

  function onKeyUp(e) {
    if (e.key === ' ' || e.key === 'Enter') stopCoffeePour();
  }

  // -- Shift lifecycle ------------------------------------------------------------------

  function beginShift() {
    if (daily) dailyTicket = requestRunTicket();
    else if (!monthTicket || save.currentShift === 1) monthTicket = requestRunTicket();
    waitingAtOffice = false;
    coffeeSplashSeconds = 0;
    resetHallucinations();
    lastSeenBonusGard = 0;
    gardPops = [];
    if (daily) {
      // The day's shift: shift 12's clock and pace, neutral perks plus the
      // twist's, Karen only on Karen Day, patients from the date's stream.
      currentShiftNumber = DAILY_SHIFT_NUMBER;
      karenShiftNumber = dailyEffect('karen') ? DAILY_SHIFT_NUMBER : 0;
      shiftRandom = seededRandom(dailySeed(daily.date));
      designBag = [];
    } else {
      currentShiftNumber = save.currentShift;
      karenShiftNumber = karenShiftForSeed(save.karenSeed);
      shiftRandom = random;
    }
    shiftState = startShiftState(createInitialState(currentShiftNumber, karenShiftNumber, {
      perks: daily ? dailyPerksForTwist(daily.twist) : perksForRank(rankForXp(save.careerXp).rank),
      // Night shifts (every 5th of the month, or the Daily's Night Shift twist).
      night: daily ? dailyEffect('night') : isNightShift(currentShiftNumber),
    }));
    lastLiveRank = rankForXp(save.careerXp).rank;
    shiftXpAwarded = false;
    player = { ...PLAYER_START };
    resetAmbient();
    resetCat();
    resetSecurity();
    wetFloor = null;
    mopTimer = JANITOR_MOP_EVERY_SECONDS;
    currentFloor = FLOOR_1;
    updateFloorButton();
    moveTarget = null;
    overlay = null;
    pendingTriageAction = null;
    karenAvailable = false;
    melVaseClicks = 0;
    melCodeBuffer = '';
    patientInfo.clear();
    scheduledEvents = scheduleShiftEvents();
    lastTimestamp = null;
    running = true;
    paused = false;
    showScreen(null);
    renderHud();
    updateFlashlightButton();
    if (shiftState.night) showToast('Night shift — the ER is dark. Press F (or the Flashlight button) for your flashlight; spare batteries are upstairs.', 5);
    if (rafHandle === null) rafHandle = window.requestAnimationFrame(loop);
  }

  function startShift() {
    daily = null;
    requestFullscreen();
    beginShift();
  }

  /** Today's Daily Challenge (the UTC date's seeded shift and twist). */
  function startDaily() {
    const date = hospitalDailyDate();
    daily = { date, twist: dailyTwistForDate(date) };
    requestFullscreen();
    beginShift();
  }

  /** The paycheck's main button: the next month shift, or the daily again. */
  function continueFromPaycheck() {
    if (daily) startDaily();
    else startShift();
  }

  /** Back to the start screen from a daily paycheck. */
  function backToStart() {
    daily = null;
    shiftState = null;
    renderHud();
    renderDailyCard();
    showScreen('start');
  }

  /** The start screen's Daily Challenge card: today's date, twist and this visit's best. */
  function renderDailyCard() {
    const card = elements.startScreen.daily;
    if (!card?.root) return;
    const date = hospitalDailyDate();
    const twist = dailyTwistForDate(date);
    card.date.textContent = date;
    card.twist.textContent = twist.name;
    card.blurb.textContent = twist.blurb;
    card.best.textContent = dailyBest?.date === date ? `Your best today: ${dailyBest.payout} Gard` : 'No run yet today.';
  }

  /** Sets up the paycheck's submit form and labels for a month run or a Daily Challenge. */
  function setPaycheckMode({ submit, payout = 0, earnings = 0 }) {
    const screen = elements.paycheckScreen;
    screen.finalBlock.classList.toggle('hidden', !submit);
    screen.backButton?.classList.toggle('hidden', !daily);
    if (screen.monthLabel) screen.monthLabel.textContent = daily ? "Today's best" : 'Run total';
    if (screen.finalHeading) screen.finalHeading.textContent = daily ? `Daily Challenge · ${daily.twist.name}` : 'Final Paycheck';
    if (screen.dailyInput) screen.dailyInput.value = daily ? daily.date : '';
    if (submit) {
      if (screen.earningsInput) screen.earningsInput.value = String(daily ? payout : earnings);
      if (screen.shiftsInput) screen.shiftsInput.value = String(daily ? 1 : SHIFTS_PER_MONTH);
      if (screen.submitButton) screen.submitButton.disabled = false;
      screen.submitError?.classList.add('hidden');
      const ticket = daily ? dailyTicket : monthTicket;
      Promise.resolve(ticket).then((t) => {
        if (screen.ticketInput) screen.ticketInput.value = t ?? '';
      });
    }
  }

  function endShift() {
    running = false;
    if (rafHandle !== null) {
      window.cancelAnimationFrame(rafHandle);
      rafHandle = null;
    }
    const payout = shiftState.payout ?? 0;
    const xpResult = awardShiftXp();
    if (daily) {
      showDailyPaycheck(payout, xpResult);
      return;
    }
    save.monthToDateGard += payout;
    const isFinalShift = currentShiftNumber >= SHIFTS_PER_MONTH;
    if (isFinalShift) save.bestRunTotal = Math.max(save.bestRunTotal, save.monthToDateGard);
    else save.currentShift = currentShiftNumber + 1;

    const screen = elements.paycheckScreen;
    screen.root.dataset.outcome = shiftState.mistakeCount > 0 ? 'upset' : 'ok';
    screen.root.dataset.final = isFinalShift ? 'true' : 'false';
    screen.root.dataset.daily = 'false';
    screen.title.textContent = isFinalShift ? 'Final Paycheck' : 'Handover';
    const s = shiftState;
    const parts = [
      s.mistakeCount > 0 ? `${s.mistakeCount} mistake${s.mistakeCount === 1 ? '' : 's'}` : 'No mistakes',
      `${s.discharged} discharged`,
      `${s.rating}★ (${Math.round(paycheckMultiplierForRating(s.rating) * 100)}% pay)`,
    ];
    if (s.transfers > 0) parts.push(`${s.transfers} transferred out`);
    const hallucinationCut = Math.round((1 - hallucinationPayMultiplier(s.zeroSanitySeconds)) * 100);
    if (hallucinationCut > 0) parts.push(`−${hallucinationCut}% for hallucinating`);
    screen.outcome.textContent = parts.join(' · ');
    screen.shiftTotal.textContent = `${payout} Gard`;
    screen.monthTotal.textContent = `${save.monthToDateGard} Gard`;
    screen.nextShiftButton.textContent = isNightShift(currentShiftNumber + 1) ? 'Start Night Shift 🌙' : 'Start Next Shift';
    screen.nextShiftButton.classList.toggle('hidden', isFinalShift);
    screen.newMonthButton.classList.toggle('hidden', !isFinalShift);
    setPaycheckMode({ submit: isFinalShift, earnings: save.monthToDateGard });
    renderPaycheckXp(xpResult);
    renderRankCard();
    renderHud();
    showScreen('paycheck');
  }

  /** A finished Daily Challenge: the shift's paycheck is the score, submittable to today's board. */
  function showDailyPaycheck(payout, xpResult) {
    if (dailyBest?.date !== daily.date || payout > dailyBest.payout) dailyBest = { date: daily.date, payout };
    const screen = elements.paycheckScreen;
    const s = shiftState;
    screen.root.dataset.outcome = s.mistakeCount > 0 ? 'upset' : 'ok';
    screen.root.dataset.final = 'false';
    screen.root.dataset.daily = 'true';
    screen.title.textContent = 'Daily Challenge';
    screen.outcome.textContent = [
      daily.twist.name,
      s.mistakeCount > 0 ? `${s.mistakeCount} mistake${s.mistakeCount === 1 ? '' : 's'}` : 'No mistakes',
      `${s.discharged} discharged`,
      `${s.rating}★`,
    ].join(' · ');
    screen.shiftTotal.textContent = `${payout} Gard`;
    screen.monthTotal.textContent = `${dailyBest.payout} Gard`;
    screen.nextShiftButton.textContent = 'Try Again';
    screen.nextShiftButton.classList.remove('hidden');
    screen.newMonthButton.classList.add('hidden');
    setPaycheckMode({ submit: true, payout });
    renderPaycheckXp(xpResult);
    renderRankCard();
    renderDailyCard();
    renderHud();
    showScreen('paycheck');
  }

  /**
   * Game over (20 s at 0 Sanity, or out of stars): the shift pays nothing
   * and the save stays on this shift, so "Retry Shift N" replays it with
   * the month's earnings kept. Reuses the paycheck panel.
   */
  function showGameOver() {
    running = false;
    if (rafHandle !== null) {
      window.cancelAnimationFrame(rafHandle);
      rafHandle = null;
    }
    overlay = null;
    moveTarget = null;
    render();
    // XP earned before the collapse still counts toward the career.
    const xpResult = awardShiftXp();
    renderPaycheckXp(xpResult);
    renderRankCard();
    const screen = elements.paycheckScreen;
    screen.root.dataset.outcome = 'game-over';
    screen.root.dataset.final = 'false';
    screen.title.textContent = 'Game Over';
    screen.outcome.textContent = {
      sanity: `You collapsed after ${ZERO_SANITY_COLLAPSE_SECONDS} seconds at 0% Sanity. Grab coffee before it runs out!`,
      hunger: `You collapsed from hunger after ${HUNGER_THIRST_COLLAPSE_SECONDS} seconds at 0%. Grab a snack or visit the Cafeteria!`,
      thirst: `You collapsed from thirst after ${HUNGER_THIRST_COLLAPSE_SECONDS} seconds at 0%. Grab a drink or visit the Cafeteria!`,
    }[shiftState.gameOverReason] ?? 'Out of stars — too many patients walked out or were transferred.';
    screen.root.dataset.daily = daily ? 'true' : 'false';
    screen.shiftTotal.textContent = '0 Gard';
    screen.monthTotal.textContent = daily ? `${dailyBest?.date === daily.date ? dailyBest.payout : 0} Gard` : `${save.monthToDateGard} Gard`;
    screen.nextShiftButton.textContent = daily ? 'Try Again' : `Retry Shift ${currentShiftNumber}`;
    screen.nextShiftButton.classList.remove('hidden');
    screen.newMonthButton.classList.add('hidden');
    setPaycheckMode({ submit: false });
    renderHud();
    showScreen('paycheck');
  }

  function startNewMonth() {
    save.currentShift = 1;
    save.monthToDateGard = 0;
    save.karenSeed = Date.now();
    startShift();
  }

  // -- Rendering: floor and stations -------------------------------------------------------

  const TILE = 40;

  function drawFloor() {
    if (currentFloor === FLOOR_2) {
      drawSupplyRoomFloor();
      return;
    }
    if (currentFloor === FLOOR_OR) {
      drawOperatingTheaterFloor();
      return;
    }
    if (currentFloor === FLOOR_CAFE) {
      drawCafeteriaFloor();
      return;
    }
    drawAnimeTiles('#e6f6f0', '#d8efe7', 'rgba(143,211,255,0.10)');
    drawSunbeams();

    // Pastel guide stripes on the floor leading from triage to the beds.
    drawRoundRect(ctx, 0, 261, 790, 7, 3.5, 'rgba(255,138,122,0.28)');
    drawRoundRect(ctx, 0, 455, 790, 7, 3.5, 'rgba(63,181,143,0.26)');

    drawBackWall();
    // A painted sakura branch on the wall between the vase and the sign.
    sakuraBranch(ctx, 672, 28, 1.1);
    drawEmergencySign('✚ EMERGENCY', ANIME.coral, ANIME.coralDeep);

    // Break-room rug under the coffee machine: a soft pink rug with a
    // stitched border.
    const coffee = stationOfKind('coffee-machine');
    const rx = coffee.x - 70;
    const ry = coffee.y - 62;
    drawRoundRect(ctx, rx, ry, 190, 120, 22, 'rgba(255,194,218,0.55)');
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = 'rgba(232,85,143,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(rx + 7, ry + 7, 176, 106, 17);
    ctx.stroke();
    ctx.restore();
    drawWallClock();
    drawDandelionVase();
  }

  /** The floor: big pastel checker tiles with a glossy sheen. */
  function drawAnimeTiles(light, dark, sheen) {
    const g = ctx.createLinearGradient(0, 58, 0, CANVAS_HEIGHT);
    g.addColorStop(0, tint(light, 0.3));
    g.addColorStop(1, light);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = dark;
    for (let row = 0; row * TILE < CANVAS_HEIGHT; row++) {
      for (let col = 0; col * TILE < CANVAS_WIDTH; col++) {
        if ((row + col) % 2 === 0) ctx.fillRect(col * TILE, row * TILE, TILE, TILE);
      }
    }
    ctx.strokeStyle = 'rgba(59,42,74,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= CANVAS_WIDTH; x += TILE) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, CANVAS_HEIGHT); }
    for (let y = 0; y <= CANVAS_HEIGHT; y += TILE) { ctx.moveTo(0, y + 0.5); ctx.lineTo(CANVAS_WIDTH, y + 0.5); }
    ctx.stroke();
    // Glossy floor: soft diagonal reflection streaks.
    ctx.save();
    ctx.fillStyle = sheen;
    for (const sx of [120, 420, 700]) {
      ctx.beginPath();
      ctx.moveTo(sx, CANVAS_HEIGHT);
      ctx.lineTo(sx + 60, CANVAS_HEIGHT);
      ctx.lineTo(sx + 260, 60);
      ctx.lineTo(sx + 230, 60);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /** Warm light falling in from the upper right, like an anime afternoon. */
  function drawSunbeams() {
    ctx.save();
    const beams = [[560, 160], [700, 120], [820, 90]];
    beams.forEach(([bx, bw], i) => {
      const g = ctx.createLinearGradient(bx, 58, bx - 260, CANVAS_HEIGHT);
      g.addColorStop(0, 'rgba(255,246,214,0.42)');
      g.addColorStop(1, 'rgba(255,246,214,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(bx, 58);
      ctx.lineTo(bx + bw, 58);
      ctx.lineTo(bx + bw - 300 - i * 20, CANVAS_HEIGHT);
      ctx.lineTo(bx - 330 - i * 20, CANVAS_HEIGHT);
      ctx.closePath();
      ctx.fill();
    });
    ctx.restore();
  }

  /** The back wall: cream to blush, a pink wainscot rail and plum trim. */
  function drawBackWall() {
    const g = ctx.createLinearGradient(0, 0, 0, 58);
    g.addColorStop(0, '#fffaf3');
    g.addColorStop(1, '#fdeef3');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CANVAS_WIDTH, 58);
    ctx.fillStyle = '#ffd1e3';
    ctx.fillRect(0, 48, CANVAS_WIDTH, 7);
    ctx.fillStyle = ANIME.ink;
    ctx.fillRect(0, 55, CANVAS_WIDTH, 2.5);
    ctx.fillStyle = 'rgba(59,42,74,0.12)';
    ctx.fillRect(0, 57.5, CANVAS_WIDTH, 4);
  }

  /** Uncomfortable (Hunger/Thirst under 25%): a faint warm vignette that pulses, stronger as a bar nears 0. */
  function drawDiscomfortVignette() {
    const lowest = Math.min(shiftState.hunger, shiftState.thirst);
    const depth = 1 - lowest / HUNGER_THIRST_LOW; // 0 at the line, 1 at empty
    const pulse = 0.75 + 0.25 * Math.sin(performance.now() / 260);
    const g = ctx.createRadialGradient(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_HEIGHT * 0.45, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH * 0.62);
    g.addColorStop(0, 'rgba(224,80,62,0)');
    g.addColorStop(1, `rgba(224,80,62,${(0.12 + 0.22 * depth) * pulse})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  // -- Night shifts and the flashlight -----------------------------------------
  //
  // At night the ER and the Supply Room are dark (the OR and Cafeteria keep
  // their lights on): an offscreen layer of deep-blue night with holes cut
  // out for a small glow around the nurse, a few glowing fixtures, and the
  // flashlight's cone toward the mouse (rules.js "Night shifts and the
  // flashlight").

  /** Where the flashlight points: the mouse, last seen over the canvas. */
  let aim = null;
  const darkness = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (darkness) { darkness.width = CANVAS_WIDTH; darkness.height = CANVAS_HEIGHT; }
  const FLASHLIGHT_REACH = 340;
  const FLASHLIGHT_SPREAD = 0.42; // half-angle, radians

  function isDarkHere() {
    return Boolean(shiftState?.night) && (currentFloor === FLOOR_1 || currentFloor === FLOOR_2);
  }

  /** Cuts a soft round hole of light into the darkness layer. */
  function cutGlow(dctx, x, y, r, strength = 1) {
    const g = dctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(0,0,0,${strength})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    dctx.fillStyle = g;
    dctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function drawDarkness() {
    if (!darkness) return;
    const dctx = darkness.getContext('2d');
    dctx.globalCompositeOperation = 'source-over';
    dctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    dctx.fillStyle = 'rgba(8,10,34,0.88)';
    dctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    dctx.globalCompositeOperation = 'destination-out';
    const px = player.x;
    const py = player.y - 30;
    cutGlow(dctx, px, py, 78, 0.85);
    // Glowing fixtures: the vending machine, the elevator button, the signs.
    for (const st of visibleStations()) {
      if (st.kind === 'vending-machine') cutGlow(dctx, st.x, st.y, 60, 0.7);
      if (st.kind === 'elevator') cutGlow(dctx, st.x + 35, st.y, 26, 0.6);
      if (st.kind === 'cafeteria-door') cutGlow(dctx, st.x, st.y + 6, 48, 0.65); // its CLOSED sign
    }
    cutGlow(dctx, 839, 28, 90, 0.55);
    // The night guard's flashlight, pointed where he's walking.
    const nightGuard = currentFloor === FLOOR_1 ? staff('nightGuard') : null;
    if (nightGuard) cutGlow(dctx, nightGuard.x + guardFacing(nightGuard) * 44, nightGuard.y - 12, 46, 0.75);
    const f = shiftState.flashlight;
    if (f.on) {
      const tx = aim?.x ?? px + 100;
      const ty = aim?.y ?? py;
      const angle = Math.atan2(ty - py, tx - px);
      // A flickering cone when the battery is nearly flat.
      const flicker = f.battery < 15 ? 0.55 + 0.45 * Math.abs(Math.sin(performance.now() / 70)) : 1;
      const g = dctx.createRadialGradient(px, py, 10, px, py, FLASHLIGHT_REACH);
      g.addColorStop(0, `rgba(0,0,0,${flicker})`);
      g.addColorStop(0.7, `rgba(0,0,0,${0.85 * flicker})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      dctx.fillStyle = g;
      dctx.beginPath();
      dctx.moveTo(px, py);
      dctx.arc(px, py, FLASHLIGHT_REACH, angle - FLASHLIGHT_SPREAD, angle + FLASHLIGHT_SPREAD);
      dctx.closePath();
      dctx.fill();
    }
    dctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(darkness, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    // A warm tint inside the beam.
    if (f.on) {
      const tx = aim?.x ?? px + 100;
      const ty = aim?.y ?? py;
      const angle = Math.atan2(ty - py, tx - px);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(px, py, 10, px, py, FLASHLIGHT_REACH);
      g.addColorStop(0, 'rgba(255,240,180,0.18)');
      g.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.arc(px, py, FLASHLIGHT_REACH, angle - FLASHLIGHT_SPREAD, angle + FLASHLIGHT_SPREAD);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  /** The battery meter left of the wall clock, with a dot per spare (night shifts only). */
  function drawBatteryMeter() {
    const f = shiftState.flashlight;
    animePlate(ctx, 446, 39, 50, 18, 9);
    drawBatteryIcon(ctx, 466, 48, 1, f.battery / FLASHLIGHT_BATTERY_MAX);
    for (let i = 0; i < FLASHLIGHT_MAX_SPARES; i++) {
      ctx.fillStyle = i < f.spares ? ANIME.goldDeep : 'rgba(59,42,74,0.25)';
      ctx.beginPath();
      ctx.arc(484 + i * 6, 48, 2.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function flipFlashlight() {
    if (!shiftState?.night) return;
    const before = shiftState;
    shiftState = toggleFlashlight(shiftState);
    if (shiftState === before && !before.flashlight.on) showToast('The flashlight is dead — grab a battery from the Supply Room shelf or the vending machine.', 3.6);
    updateFlashlightButton();
  }

  function updateFlashlightButton() {
    const button = elements.flashlightButton;
    if (!button) return;
    const night = Boolean(shiftState?.night) && running;
    button.classList.toggle('hidden', !night);
    const on = Boolean(shiftState?.flashlight.on);
    button.textContent = on ? '🔦 Light: On (F)' : '🔦 Light: Off (F)';
    button.setAttribute('aria-pressed', String(on));
  }

  /** The sign on the back wall (EMERGENCY / SUPPLY ROOM), anime-plated. */
  function drawEmergencySign(text, color, colorDeep) {
    animeButton(ctx, { x: 744, y: 12, w: 190, h: 32 }, '', color, colorDeep);
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    outlinedText(ctx, text, 839, 29, '#ffffff', tint(colorDeep, -0.45), 3.2);
    sparkle(ctx, 750, 14, 5, '#ffffff');
  }

  /**
   * A little vase of dandelions on a shelf on the back wall — set dressing
   * that's secretly the easter egg's trigger (click it five times). It
   * wiggles when clicked and gives nothing else away.
   */
  function drawDandelionVase() {
    const cx = MEL_VASE_RECT.x + MEL_VASE_RECT.w / 2;
    const base = MEL_VASE_RECT.y + MEL_VASE_RECT.h - 4;
    drawRoundRect(ctx, cx - 22, base, 44, 4, 2, '#c9a77a');
    ctx.save();
    ctx.translate(cx, base);
    ctx.rotate(Math.sin(melVaseWiggle * 40) * melVaseWiggle * 0.5);
    ctx.strokeStyle = '#6f9a4a';
    ctx.lineWidth = 1.4;
    const heads = [[-9, -36], [0, -42], [9, -34]];
    for (const [hx, hy] of heads) {
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.quadraticCurveTo(hx * 0.4, (hy - 12) / 2, hx, hy);
      ctx.stroke();
    }
    heads.forEach(([hx, hy], i) => {
      ctx.fillStyle = i === 2 ? '#ffffff' : '#f2c230';
      for (let k = 0; k < 10; k++) {
        const ang = (k / 10) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(hx + Math.cos(ang) * 3.4, hy + Math.sin(ang) * 3.4, 1.9, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = i === 2 ? '#d8d2c0' : '#e0a81e';
      ctx.beginPath();
      ctx.arc(hx, hy, 2, 0, Math.PI * 2);
      ctx.fill();
    });
    drawRoundRect(ctx, -7, -14, 14, 14, 4, 'rgba(160,200,215,0.85)');
    ctx.strokeStyle = 'rgba(58,42,42,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(-7, -14, 14, 14, 4);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Inside the walk-in Operating Room: mint surgical tiles, a sterile green
   * wall with a scrub sink and an X-ray light box, and the table's lamp.
   */
  function drawOperatingTheaterFloor() {
    drawAnimeTiles('#dff7ee', '#cdeee2', 'rgba(255,255,255,0.16)');
    const g = ctx.createLinearGradient(0, 0, 0, 58);
    g.addColorStop(0, '#f2fff9');
    g.addColorStop(1, '#d4f5e8');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CANVAS_WIDTH, 58);
    ctx.fillStyle = ANIME.mint;
    ctx.fillRect(0, 48, CANVAS_WIDTH, 7);
    ctx.fillStyle = ANIME.ink;
    ctx.fillRect(0, 55, CANVAS_WIDTH, 2.5);
    drawEmergencySign('OPERATING ROOM', ANIME.mint, ANIME.mintDeep);
    // An X-ray light box and a scrub sink on the wall.
    drawRoundRect(ctx, 610, 8, 90, 42, 6, '#e8f4ff');
    ctx.strokeStyle = ANIME.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(610, 8, 90, 42, 6);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(59,42,74,0.45)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(655, 26 + i * 5, 14 - i * 1.5, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
    drawWallClock();
  }

  /**
   * The Cafeteria: warm peach tiles, sunbeams, a pink wall with a chalk menu
   * board, a sakura branch and the sign.
   */
  function drawCafeteriaFloor() {
    drawAnimeTiles('#fff1e2', '#ffe6cf', 'rgba(255,255,255,0.18)');
    drawSunbeams();
    drawBackWall();
    drawEmergencySign('☕ CAFETERIA', ANIME.gold, ANIME.goldDeep);
    sakuraBranch(ctx, 470, 24, 1.1);
    // A chalk menu board.
    drawRoundRect(ctx, 590, 6, 120, 46, 6, '#3f5a4a');
    ctx.strokeStyle = '#c99e78';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(590, 6, 120, 46, 6);
    ctx.stroke();
    ctx.fillStyle = '#fffaf0';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText("TODAY'S MENU", 602, 17);
    ctx.font = '8px sans-serif';
    ctx.fillText('Curry rice · Miso soup', 602, 30);
    ctx.fillText('Water · Green tea ♥', 602, 42);
    drawWallClock();
  }

  /** The 2nd Floor: a stockroom — warm grey tiles, shelving along the walls. */
  function drawSupplyRoomFloor() {
    drawAnimeTiles('#f6efe4', '#efe5d6', 'rgba(255,255,255,0.18)');
    drawSunbeams();
    drawBackWall();
    drawEmergencySign('SUPPLY ROOM · 2F', ANIME.lavender, ANIME.lavenderDeep);

    // Wall shelving full of boxes, gauze and linen — set dressing only.
    // Pastel boxes with plum line art; every few gets a tiny kawaii face.
    const kawaiiFace = (cx, cy) => {
      ctx.fillStyle = ANIME.ink;
      for (const dx of [-3, 3]) {
        ctx.beginPath();
        ctx.arc(cx + dx, cy, 1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = ANIME.ink;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.arc(cx, cy + 1.2, 1.6, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,143,184,0.6)';
      for (const dx of [-5, 5]) {
        ctx.beginPath();
        ctx.ellipse(cx + dx, cy + 2, 1.4, 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    const shelf = (x, y, w) => {
      animeTile(ctx, x, y, w, 70, 8, '#e8c9a8');
      for (let r = 0; r < 2; r++) {
        const sy = y + 8 + r * 32;
        ctx.fillStyle = '#c99e78';
        ctx.fillRect(x + 4, sy + 24, w - 8, 3);
        for (let bx = x + 8, k = 0; bx < x + w - 26; bx += 26, k++) {
          const tone = ['#ffffff', '#c9e4ff', '#ffe2b8', '#ffd1e3', '#d4f2de'][(k + r * 2 + Math.round(x)) % 5];
          drawRoundRect(ctx, bx, sy + 4, 22, 20, 4, tone);
          ctx.strokeStyle = ANIME.ink;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(bx, sy + 4, 22, 20, 4);
          ctx.stroke();
          if (tone === '#ffffff') {
            ctx.fillStyle = ANIME.coralDeep;
            ctx.fillRect(bx + 9, sy + 8, 4, 10);
            ctx.fillRect(bx + 6, sy + 11, 10, 4);
          } else if ((k + r) % 3 === 0) {
            kawaiiFace(bx + 11, sy + 13);
          }
        }
      }
      ctx.strokeStyle = ANIME.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, w, 70, 8);
      ctx.stroke();
    };
    shelf(20, 74, 260);
    shelf(320, 74, 260);
    shelf(20, 500, 300);
    shelf(380, 500, 300);
    // A rolled-up mop bucket and a cardboard stack for life.
    for (const [bx, by, bw, bh] of [[640, 230, 70, 50], [648, 200, 56, 34]]) {
      animeTile(ctx, bx, by, bw, bh, 7, '#e8c48e');
      ctx.strokeStyle = ANIME.ink;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 7);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(122,80,40,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(640, 255);
    ctx.lineTo(710, 255);
    ctx.moveTo(676, 200);
    ctx.lineTo(676, 234);
    ctx.stroke();
    kawaiiFace(660, 268);
    drawWallClock();
  }

  function drawWallClock() {
    if (!shiftState) return;
    const label = inGameTimeLabel(shiftState.clockSeconds, shiftState.totalClockSeconds, { night: shiftState.night });
    const match = /^(\d+):(\d+) (AM|PM)$/.exec(label);
    if (!match) return;
    const hour = Number(match[1]) % 12;
    const minute = Number(match[2]);
    const cx = 520;
    const cy = 29;
    // A cute pastel clock: pink rim, plum line art, two little bells on top.
    for (const dir of [-1, 1]) {
      ctx.fillStyle = ANIME.gold;
      ctx.beginPath();
      ctx.arc(cx + dir * 13, cy - 16, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = ANIME.ink;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
    ctx.fillStyle = ANIME.pink;
    ctx.beginPath();
    ctx.arc(cx, cy, 21, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ANIME.ink;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fffaf3';
    ctx.beginPath();
    ctx.arc(cx, cy, 16.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.stroke();
    const hand = (angle, len, width) => {
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.sin(angle) * len, cy - Math.cos(angle) * len);
      ctx.stroke();
    };
    ctx.strokeStyle = ANIME.ink;
    ctx.lineCap = 'round';
    hand(((hour + minute / 60) / 12) * Math.PI * 2, 9, 2.5);
    hand((minute / 60) * Math.PI * 2, 13, 1.5);
    ctx.lineCap = 'butt';
    ctx.fillStyle = ANIME.pinkDeep;
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Station furniture, redrawn in the anime style (hospital/anime-furniture.js).
  const drawOfficeDetail = (st) => drawOffice(ctx, st);
  const drawTriageDeskDetail = (st) => drawTriageDesk(ctx, st, {
    drawClerk: (x, y) => drawAnimePerson(ctx, x, y, STAFF_DESIGNS.receptionist, { scale: 1, t: performance.now() / 1000 }),
  });
  const drawMedCabinetDetail = (st) => drawMedCabinet(ctx, st, { colors: MEDICATIONS.map((m) => m.color) });
  const drawStairsDetail = (st) => drawStairs(ctx, st);
  const drawElevatorDetail = (st) => drawElevator(ctx, st, { t: performance.now() / 1000 });
  const drawSupplyCartDetail = (st) => drawSupplyCart(ctx, st);
  const drawBandageRoll = (x, y, s = 1) => drawBandageRollArt(ctx, x, y, s);

  // The original coffee machine, kept as is (the user: "i want the old
  // coffee machine design to be kept") — ported verbatim from
  // library-game.js so the two machines match.
  function drawCoffeeMachineDetail(st) {
    const half = st.w / 2;
    // Bean hopper on top: a clear trapezoid full of beans.
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.moveTo(-12, -half + 4);
    ctx.lineTo(12, -half + 4);
    ctx.lineTo(7, -half + 16);
    ctx.lineTo(-7, -half + 16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#6a4a30';
    for (const [bx, by] of [[-6, -half + 9], [0, -half + 8], [6, -half + 9], [-3, -half + 12], [3, -half + 12], [0, -half + 14.5]]) {
      ctx.beginPath();
      ctx.ellipse(bx, by, 2.1, 1.4, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Machine body (a slightly lighter top band for a metallic read).
    drawRoundRect(ctx, -half + 9, -half + 16, half * 2 - 18, half * 2 - 24, 7, '#7a5a42');
    drawRoundRect(ctx, -half + 9, -half + 16, half * 2 - 18, 10, [7, 7, 0, 0], '#8f6c50');
    // Display + buttons.
    drawRoundRect(ctx, -10, -half + 19, 20, 5, 1.5, '#9fe0a8');
    for (const [bx, color] of [[-half + 17, '#e8b95a'], [half - 17, '#e06a5b']]) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(bx, -half + 21.5, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Recessed brewing bay.
    drawRoundRect(ctx, -half + 15, -half + 30, half * 2 - 30, half + 4, 5, '#4a3424');
    // Group head + spouts.
    drawRoundRect(ctx, -9, -half + 30, 18, 6, 2, '#b0a090');
    ctx.fillStyle = '#b0a090';
    ctx.fillRect(-5, -half + 35, 3, 5);
    ctx.fillRect(2, -half + 35, 3, 5);
    // A coffee drip.
    ctx.fillStyle = '#c47f4e';
    ctx.fillRect(-0.75, -half + 40, 1.5, 4);
    // Cup with coffee + handle.
    drawRoundRect(ctx, -8, half - 25, 16, 12, [1, 1, 4, 4], '#fdf8ee');
    drawRoundRect(ctx, -6.5, half - 24, 13, 2.5, 1, '#6a4a30');
    ctx.strokeStyle = '#fdf8ee';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(9, half - 19.5, 3.2, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    // Drip tray grate.
    drawRoundRect(ctx, -half + 13, half - 13, half * 2 - 26, 5, 2, '#b0a090');
    ctx.fillStyle = 'rgba(58,42,42,0.4)';
    for (let gx = -half + 17; gx < half - 15; gx += 5) ctx.fillRect(gx, half - 12, 1.5, 3);
    // Steam wisps curling out of the bay.
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.5;
    for (const dx of [-14, 14]) {
      ctx.beginPath();
      ctx.moveTo(dx, half - 26);
      ctx.quadraticCurveTo(dx - 4, half - 32, dx, half - 38);
      ctx.quadraticCurveTo(dx + 4, half - 43, dx, half - 48);
      ctx.stroke();
    }
  }

  function drawOperatingRoomDetail(st) {
    // A patient on the table while the operation's under way.
    const onTable = shiftState?.activeTask?.kind === 'surgery' ? shiftState.activeTask.patientId : shiftState?.orPatient?.patientId;
    drawOperatingRoom(ctx, st, {
      drawPatientOnTable: onTable ? (x, y) => drawPatient(x, y, patientInfo.get(onTable), 0.6) : null,
    });
  }

  /** Set dressing on the current floor (floor-plan.js's buildDecor), under everyone. */
  const decor = buildDecor();
  function drawDecorOnFloor() {
    for (const d of decor) if (d.floor === currentFloor) drawDecor(ctx, d);
  }

  // Pastel anime tiles (hospital/anime-ui.js's animeTile shades them).
  const STATION_COLORS = {
    stairs: '#b9d4f2',
    elevator: '#d8b9f2',
    'supply-cart': '#f2e6d0',
    office: '#cfe0f5',
    'triage-desk': '#ffe0c2',
    'med-cabinet': '#d6e8ff',
    'operating-room': '#bdeedd',
    'coffee-machine': '#f5d3bd',
    'or-table': '#d4f5e8',
    'instrument-tray': '#e8f2f8',
    'organ-cooler': '#e0f6ff',
    'or-door': '#d4f5e8',
    'implant-shelf': '#f2e6d0',
    'vending-machine': '#e6ddff',
    'cafeteria-door': '#ffe8d0',
    'cafe-counter': '#fff0dc',
    'cafe-door': '#ffe8d0',
    'battery-shelf': '#fff6d6',
  };
  const STATION_DETAILS = {
    office: drawOfficeDetail,
    'triage-desk': drawTriageDeskDetail,
    'med-cabinet': drawMedCabinetDetail,
    'operating-room': drawOperatingRoomDetail,
    'coffee-machine': drawCoffeeMachineDetail,
    stairs: drawStairsDetail,
    elevator: drawElevatorDetail,
    'supply-cart': drawSupplyCartDetail,
    'or-table': (st) => {
      // The patient the Orderly left on the table (yours rides on your gurney).
      const onTable = shiftState?.orPatient?.patientId ?? null;
      drawOrTable(ctx, st, {
        ready: Boolean(shiftState && surgeryPatient(shiftState) && !surgeryMissing(shiftState).length),
        drawPatientOnTable: onTable ? (x, y) => drawPatient(x, y, patientInfo.get(onTable), 0.7) : null,
      });
    },
    'instrument-tray': (st) => drawInstrumentTray(ctx, st, { hasScalpel: Boolean(shiftState?.surgeryKit.scalpel) }),
    'organ-cooler': (st) => drawOrganCooler(ctx, st, { organs: ['kidney', 'liver', 'heart'].filter((id) => shiftState?.surgeryKit.item !== id) }),
    'or-door': (st) => drawOrDoor(ctx, st),
    'implant-shelf': (st) => drawImplantShelf(ctx, st),
    'vending-machine': (st) => {
      drawVendingStation(ctx, st);
      if (shiftState?.security?.vendingBroken) drawOutOfOrder(ctx, st);
    },
    'cafeteria-door': (st) => {
      drawCafeteriaDoor(ctx, st);
      if (shiftState?.night) drawLabelChip(ctx, 0, 6, 'CLOSED', 'bold 11px sans-serif', ANIME.coralDeep, '#ffffff');
    },
    'cafe-door': (st) => drawCafeDoor(ctx, st),
    'battery-shelf': (st) => drawBatteryShelf(ctx, st),
    'cafe-counter': (st) => drawCafeCounter(ctx, st, {
      drawLady: (x, y) => drawAnimePerson(ctx, x, y + 6, STAFF_DESIGNS.cafeLady, { scale: 1.25, t: performance.now() / 1000 }),
    }),
  };

  function stationOutline(st, highlightColor) {
    const isHovered = hoverStation?.id === st.id;
    const isTarget = moveTarget?.station?.id === st.id;
    // Plum line art always; a glowing ring on top when hovered/targeted/needed.
    ctx.strokeStyle = ANIME.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-st.w / 2, -st.h / 2, st.w, st.h, 12);
    ctx.stroke();
    const ring = highlightColor ?? (isTarget ? ANIME.gold : (isHovered ? ANIME.pink : null));
    if (ring) {
      ctx.strokeStyle = ring;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-st.w / 2 - 3, -st.h / 2 - 3, st.w + 6, st.h + 6, 15);
      ctx.stroke();
      sparkle(ctx, st.w / 2 - 2, -st.h / 2 + 2, 6, '#ffffff');
    }
  }

  function drawStation(st) {
    if (st.kind === 'bed') { drawBed(st); return; }
    const locked = st.kind === 'office' && shiftState && !isOfficeReady(shiftState) && shiftState.phase !== 'paycheck';
    ctx.save();
    ctx.translate(Math.round(st.x), Math.round(st.y));
    animeTile(ctx, -st.w / 2, -st.h / 2, st.w, st.h, 12, locked ? '#cfc8d8' : STATION_COLORS[st.kind]);
    STATION_DETAILS[st.kind]?.(st);
    if (st.kind === 'coffee-machine' && dailyEffect('noCoffee')) {
      // Out of order: caution tape across it and a sign.
      ctx.save();
      ctx.rotate(-0.35);
      drawRoundRect(ctx, -st.w / 2 - 6, -6, st.w + 12, 12, 2, ANIME.gold);
      ctx.fillStyle = ANIME.ink;
      for (let x = -st.w / 2 - 4; x < st.w / 2 + 6; x += 10) {
        ctx.beginPath();
        ctx.moveTo(x, -6);
        ctx.lineTo(x + 5, -6);
        ctx.lineTo(x, 6);
        ctx.lineTo(x - 5, 6);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      drawLabelChip(ctx, 0, -st.h / 2 - 10, 'OUT OF ORDER', 'bold 10px sans-serif', ANIME.coralDeep, '#ffffff');
    }
    if (locked) {
      drawRoundRect(ctx, -14, -12, 28, 28, 14, 'rgba(255,251,246,0.92)');
      ctx.strokeStyle = '#5a5060';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, -2, 5.5, Math.PI, 0);
      ctx.stroke();
      drawRoundRect(ctx, -7.5, 1, 15, 11, 3, '#5a5060');
    }
    const pulse = (st.kind === 'operating-room' && (shiftState?.carried?.kind === 'gurney' || shiftState?.orPatient))
      || (st.kind === 'med-cabinet' && shiftState && !shiftState.carried && shiftState.beds.some((b) => currentStep(b) === 'meds'))
      || (st.kind === 'supply-cart' && shiftState && !shiftState.hasBandage && shiftState.beds.some((b) => currentStep(b) === 'bandage'))
      || (['instrument-tray', 'organ-cooler', 'implant-shelf'].includes(st.kind) && shiftState
        && [...surgeryItemsNeeded(shiftState)].some((id) => SURGERY_ITEMS[id].source === st.kind && !kitHas(id)))
      || (st.kind === 'or-table' && shiftState && surgeryPatient(shiftState) && !surgeryMissing(shiftState).length);
    stationOutline(st, pulse ? `rgba(224,168,58,${0.55 + 0.45 * Math.sin(performance.now() / 180)})` : null);
    drawLabelChip(ctx, 0, st.h / 2 + 13, labelForStation(st), 'bold 11px sans-serif');
    ctx.restore();
  }

  function drawBed(st) {
    const patient = shiftState?.beds[st.bedIndex] ?? null;
    const hw = st.w / 2;
    const hh = st.h / 2;
    ctx.save();
    ctx.translate(st.x, st.y);
    // Privacy curtain on its rail, bunched to the left: pastel pink pleats.
    ctx.strokeStyle = ANIME.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-hw - 6, -hh - 4);
    ctx.lineTo(hw + 6, -hh - 4);
    ctx.stroke();
    const curtain = ctx.createLinearGradient(-hw - 14, 0, -hw - 2, 0);
    curtain.addColorStop(0, '#ffc2da');
    curtain.addColorStop(1, '#ffe3ee');
    ctx.fillStyle = curtain;
    ctx.beginPath();
    ctx.moveTo(-hw - 4, -hh - 4);
    for (let i = 0; i <= 4; i++) ctx.lineTo(-hw - 4 + (i % 2 ? 5 : 0), -hh - 4 + i * 30);
    ctx.lineTo(-hw - 14, hh + 2);
    ctx.lineTo(-hw - 14, -hh - 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = ANIME.ink;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(232,85,143,0.45)';
    ctx.lineWidth = 1;
    for (const fx of [-hw - 11, -hw - 8]) {
      ctx.beginPath();
      ctx.moveTo(fx, -hh);
      ctx.lineTo(fx + 1, hh - 4);
      ctx.stroke();
    }
    // Frame, mattress, pillow — outlined.
    animeTile(ctx, -hw, -hh, st.w, st.h, 12, '#c9c3e6');
    drawRoundRect(ctx, -hw + 5, -hh + 5, st.w - 10, st.h - 10, 8, '#fbfaff');
    ctx.strokeStyle = 'rgba(59,42,74,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(-hw + 5, -hh + 5, st.w - 10, st.h - 10, 8);
    ctx.stroke();
    drawRoundRect(ctx, -hw + 16, -hh + 9, st.w - 32, 18, 9, '#ffffff');
    ctx.strokeStyle = ANIME.ink;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(-hw + 16, -hh + 9, st.w - 32, 18, 9);
    ctx.stroke();

    if (patient && !patient.inSurgery) {
      const info = patientInfo.get(patient.id);
      const level = findTriageLevel(patient.level);
      drawPatient(0, 0, info, 0.75);
      // Blanket in a tint of their triage color, folded back at the chest.
      drawRoundRect(ctx, -hw + 9, -24, st.w - 18, hh + 16, 7, shadeColor(level.color, 0.55));
      drawRoundRect(ctx, -hw + 9, -24, st.w - 18, 8, [7, 7, 0, 0], shadeColor(level.color, 0.78));
      ctx.strokeStyle = 'rgba(59,42,74,0.55)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.roundRect(-hw + 9, -24, st.w - 18, hh + 16, 7);
      ctx.stroke();
      ctx.fillStyle = patientSkin(info);
      for (const dx of [-14, 14]) {
        ctx.beginPath();
        ctx.arc(dx, -12, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      // Triage badge and patience bar.
      ctx.fillStyle = level.color;
      ctx.beginPath();
      ctx.arc(hw - 10, -hh + 10, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = ANIME.ink;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      const f = Math.max(0, Math.min(1, patient.patienceRemainingSeconds / patient.patienceMaxSeconds));
      const [pTop, pDeep] = f > 0.5 ? [ANIME.mint, ANIME.mintDeep] : (f > 0.25 ? [ANIME.gold, ANIME.goldDeep] : [ANIME.coral, ANIME.coralDeep]);
      animeGauge(ctx, -34, hh - 17, 68, 8, f, pTop, pDeep);
    }

    const mine = shiftState?.carried?.kind === 'meds' && shiftState.carried.bedIndex === st.bedIndex;
    stationOutline(st, mine ? `rgba(224,168,58,${0.55 + 0.45 * Math.sin(performance.now() / 180)})` : null);
    drawLabelChip(ctx, 0, hh + 13, bedLabel(st.bedIndex), 'bold 11px sans-serif');

    if (patient) {
      const step = currentStep(patient);
      if (patient.inSurgery) {
        const withOrderly = shiftState.orderlyGurney?.patientId === patient.id;
        drawLabelChip(ctx, 0, -hh - 16, withOrderly ? 'Orderly → OR' : 'In the OR', 'bold 10px sans-serif', '#3a6a5a', CREAM);
      } else {
        let text = TREATMENT_LABELS[step];
        if (step === 'meds') text = `Meds: ${findCondition(patient.conditionId).med.drug} ×${findCondition(patient.conditionId).med.dose}`;
        else if (step === 'bandage' && !shiftState.hasBandage) text = 'Bandage (roll: 2F)';
        else if (step === 'surgery') {
          const item = SURGERY_ITEMS[surgeryItemFor(patient.conditionId)];
          text = item ? `${isTransplant(patient.conditionId) ? 'Transplant' : 'Surgery'}: ${item.name}` : 'Surgery';
        }
        drawLabelChip(ctx, 0, -hh - 16, `${patient.vip ? '★ VIP · ' : ''}${patient.step + 1}/${patient.plan.length} ${text}`, 'bold 10px sans-serif', patient.vip ? ANIME.goldDeep : '#2f5f6f', CREAM);
      }
    }
    ctx.restore();
  }

  function drawTriageQueue() {
    for (const slot of triageSlots()) {
      if (slot.kind === 'ghost') {
        ctx.save();
        ctx.globalAlpha = 0.35 + 0.2 * Math.sin(performance.now() / 90);
        drawPatient(slot.x + Math.sin(performance.now() / 140) * 2, slot.y, null, 0.62, findPatientDesign('obaachan'));
        ctx.restore();
        drawLabelChip(ctx, slot.x, slot.y + 20, '???', 'bold 9px sans-serif');
        continue;
      }
      if (slot.kind === 'karen') {
        drawAnimePerson(ctx, slot.x, slot.y, STAFF_DESIGNS.karen, { scale: 0.62, angryTint: true, t: performance.now() / 1000 });
        drawLabelChip(ctx, slot.x, slot.y + 20, 'Karen!', 'bold 10px sans-serif');
        continue;
      }
      if (slot.kind === 'lost-child') {
        drawPatient(slot.x, slot.y, null, 0.62, findPatientDesign(LOST_CHILD_DESIGN));
        drawLabelChip(ctx, slot.x, slot.y + 20, 'Lost kid ?', 'bold 10px sans-serif', ANIME.sky, ANIME.ink);
        continue;
      }
      if (slot.kind === 'mel') {
        drawAnimePerson(ctx, slot.x, slot.y, STAFF_DESIGNS.mel, { scale: 0.62, t: performance.now() / 1000 });
        drawLabelChip(ctx, slot.x, slot.y + 20, 'Mel ✿', 'bold 10px sans-serif', '#f6dc8a');
        continue;
      }
      const info = patientInfo.get(slot.id);
      drawPatient(slot.x, slot.y, info, 0.62);
      if (info?.vip) {
        // Paparazzi flashes around the celebrity.
        const t = performance.now() / 1000;
        for (let i = 0; i < 3; i++) {
          const phase = (t * 1.7 + i * 0.37) % 1;
          if (phase < 0.12) sparkle(ctx, slot.x - 20 + i * 20, slot.y - 52 + (i % 2) * 10, 7, '#ffffff');
        }
        drawLabelChip(ctx, slot.x, slot.y + 20, info.shortName, 'bold 9px sans-serif', ANIME.gold, ANIME.ink);
      } else {
        drawLabelChip(ctx, slot.x, slot.y + 20, info?.shortName ?? '', 'bold 9px sans-serif');
      }
      if (slot.waitFraction != null) {
        const f = Math.max(0, Math.min(1, slot.waitFraction));
        const [wTop, wDeep] = f > 0.5 ? [ANIME.mint, ANIME.mintDeep] : (f > 0.25 ? [ANIME.gold, ANIME.goldDeep] : [ANIME.coral, ANIME.coralDeep]);
        animeGauge(ctx, slot.x - 19, slot.y + 30, 38, 7, f, wTop, wDeep);
      }
    }
    const total = shiftState?.triageQueue.length ?? 0;
    if (total > QUEUE_VISIBLE_MAX) {
      const desk = stationOfKind('triage-desk');
      drawLabelChip(ctx, desk.x + 150, desk.y + desk.h / 2 + QUEUE_SLOT_OFFSET_Y - 20, `+${total - QUEUE_VISIBLE_MAX} waiting`, 'bold 10px sans-serif');
    }
  }

  function drawPillBottle(x, y, color, s = 1) {
    drawRoundRect(ctx, x - 6 * s, y - 7 * s, 12 * s, 16 * s, 2.5 * s, color);
    drawRoundRect(ctx, x - 7 * s, y - 11 * s, 14 * s, 5 * s, 1.5 * s, '#f2f0ea');
    drawRoundRect(ctx, x - 5 * s, y - 2 * s, 10 * s, 6 * s, 1 * s, CREAM);
  }

  function drawGurney(x, y, patientId) {
    drawRoundRect(ctx, x - 16, y - 34, 32, 64, 6, '#9aa6b0');
    drawRoundRect(ctx, x - 13, y - 31, 26, 58, 5, '#f6f8fa');
    for (const [wx, wy] of [[-12, 32], [12, 32], [-12, -36], [12, -36]]) {
      ctx.fillStyle = '#4a4a52';
      ctx.beginPath();
      ctx.arc(x + wx, y + wy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    const info = patientInfo.get(patientId);
    ctx.fillStyle = patientSkin(info);
    ctx.beginPath();
    ctx.arc(x, y - 20, 8, 0, Math.PI * 2);
    ctx.fill();
    drawRoundRect(ctx, x - 12, y - 12, 24, 38, 4, '#a9cfe0');
  }

  let lastFrameDrewPlayer = false;

  function drawPlayer() {
    lastFrameDrewPlayer = true;
    const sanity = shiftState ? shiftState.sanity : SANITY_MAX;
    const stress = sanity < HALLUCINATION_START_SANITY ? (HALLUCINATION_START_SANITY - sanity) / HALLUCINATION_START_SANITY : 0;
    const carried = shiftState?.carried;
    if (carried?.kind === 'gurney') drawGurney(player.x + 40, player.y - 6, carried.patientId);
    drawKimonoHimura(ctx, player.x, player.y, { scale: PLAYER_ART_SCALE, stress, t: performance.now() / 1000, walking: moveTarget !== null });
    if (coffeeSplashSeconds > 0) drawCoffeeSplash();
    drawLabelChip(ctx, player.x, player.y + 24, PLAYER_NAME, 'bold 10px sans-serif');
    // The pocketed roll sits on the left, clear of a meds bottle on the right.
    if (shiftState?.hasBandage) drawBandageRoll(player.x - 24, player.y - 90, 1.1);
    // A little thought bubble when she's hungry or thirsty.
    if (shiftState && (shiftState.hunger < HUNGER_THIRST_LOW || shiftState.thirst < HUNGER_THIRST_LOW)) {
      const want = shiftState.thirst <= shiftState.hunger ? 'water' : 'onigiri';
      const bob = Math.sin(performance.now() / 300) * 2;
      speechBubble(ctx, { x: player.x - 46, y: player.y - 118 + bob, w: 30, h: 26 }, { tailX: player.x - 24, tailY: player.y - 84 + bob });
      drawFoodIcon(ctx, player.x - 31, player.y - 105 + bob, 0.8, want);
    }
    // The surgery kit floats beside her: scalpel and organ/implant.
    if (shiftState?.surgeryKit.scalpel) drawSurgeryItemIcon(ctx, player.x + 26, player.y - 96, 0.9, 'scalpel');
    if (shiftState?.surgeryKit.item) drawSurgeryItemIcon(ctx, player.x + 26, player.y - 78, 0.9, shiftState.surgeryKit.item);
    if (carried?.kind === 'meds') {
      const order = findCondition(shiftState.beds[carried.bedIndex]?.conditionId)?.med;
      const color = MEDICATIONS.find((m) => m.name === order?.drug)?.color ?? '#e8b440';
      drawPillBottle(player.x + 22, player.y - 92, color, 1.1);
    }
  }

  function drawCoffeeSplash() {
    const s = PERSON_SCALE;
    ctx.save();
    ctx.globalAlpha = Math.min(1, coffeeSplashSeconds / 1.5);
    ctx.fillStyle = 'rgba(106,74,48,0.85)';
    for (const [dx, dy, r] of [[-5, -19, 4.2], [3, -14, 3.4], [6, -21, 2.6], [-2, -10, 2.4], [-8, -13, 2], [9, -9, 1.8]]) {
      ctx.beginPath();
      ctx.arc(player.x + dx * s, player.y + dy * s, r * s, 0, Math.PI * 2);
      ctx.fill();
    }
    // Steam curling off the stain.
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    const t = performance.now() / 300;
    for (const dx of [-6, 4]) {
      ctx.beginPath();
      ctx.moveTo(player.x + dx * s, player.y - 24 * s);
      ctx.quadraticCurveTo(player.x + (dx - 3 + Math.sin(t)) * s, player.y - 30 * s, player.x + dx * s, player.y - 36 * s);
      ctx.stroke();
    }
    ctx.restore();
  }

  // -- Rendering: canvas HUD -------------------------------------------------------------

  function drawStatBar(y, label, value, max, colorHigh, font) {
    const x = 14;
    const width = 130;
    const height = 16;
    const percent = Math.round(value);
    const frac = Math.max(0, Math.min(1, value / max));
    // Healthy in the stat's own color, then gold, then coral when low.
    const [top, deep] = percent > 50 ? colorHigh : (percent > 20 ? [ANIME.gold, ANIME.goldDeep] : [ANIME.coral, ANIME.coralDeep]);
    animeGauge(ctx, x + 6, y, width - 6, height, frac, top, deep);
    animeBadge(ctx, x + 6, y + height / 2, 10, top, deep, label === 'Sanity' ? 'heart' : 'smile');
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    outlinedText(ctx, `${label} ${percent}%`, x + width / 2 + 9, y + height / 2 + 0.5, '#ffffff', ANIME.ink, 2.6);
  }

  function drawRatingStars() {
    const rating = shiftState ? shiftState.rating : RATING_MAX;
    const x0 = 152;
    const cy = 25;
    animePlate(ctx, x0 - 4, cy - 12, 5 * 20 + 8, 24, 12);
    for (let i = 0; i < RATING_MAX; i++) {
      animeStar(ctx, x0 + 10 + i * 20, cy, 8.5, 3.9, Math.max(0, Math.min(1, rating - i)));
    }
  }

  /** Two compact gauges under the stars: Hunger (onigiri badge) and Thirst (drop badge). */
  function drawHungerThirst() {
    const hunger = shiftState ? shiftState.hunger : HUNGER_MAX;
    const thirst = shiftState ? shiftState.thirst : THIRST_MAX;
    const gauges = [
      { x: 160, value: hunger, max: HUNGER_MAX, colors: [ANIME.gold, ANIME.goldDeep], glyph: '🍙' },
      { x: 214, value: thirst, max: THIRST_MAX, colors: [ANIME.sky, ANIME.skyDeep], glyph: '💧' },
    ];
    for (const g of gauges) {
      const frac = g.value / g.max;
      const [top, deep] = g.value < HUNGER_THIRST_LOW ? [ANIME.coral, ANIME.coralDeep] : g.colors;
      animeGauge(ctx, g.x, 41, 44, 14, frac, top, deep);
      animeBadge(ctx, g.x, 48, 8, top, deep, null);
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(g.glyph, g.x, 48.5);
      ctx.font = 'bold 9px sans-serif';
      outlinedText(ctx, `${Math.round(g.value)}%`, g.x + 25, 48.5, '#ffffff', ANIME.ink, 2.2);
    }
  }

  let lastSeenBonusGard = 0;
  let gardPops = [];

  function trackGardPops(dt) {
    const net = shiftState ? shiftState.bonusGard : 0;
    if (net !== lastSeenBonusGard) gardPops.push({ amount: net - lastSeenBonusGard, age: 0 });
    lastSeenBonusGard = net;
    gardPops = gardPops.map((pop) => ({ ...pop, age: pop.age + dt })).filter((pop) => pop.age < 1.4);
  }

  /** Under the Gard counter: rank and live progress, this shift's XP included. */
  function drawRankBar() {
    const x = 264;
    const y = 40;
    const w = 176;
    const h = 16;
    const p = rankProgress(liveCareerXp());
    animeGauge(ctx, x + 8, y, w - 8, h, p.fraction, ANIME.lavender, ANIME.lavenderDeep);
    animeBadge(ctx, x + 8, y + h / 2, 9.5, ANIME.lavender, ANIME.lavenderDeep, String(p.rank.rank));
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = 'bold 9.5px sans-serif';
    outlinedText(ctx, `Lv ${p.rank.rank} ${p.rank.title}`, x + 22, y + h / 2 + 0.5, '#ffffff', ANIME.ink, 2.4);
    ctx.textAlign = 'right';
    ctx.font = 'bold 9px sans-serif';
    outlinedText(ctx, `+${shiftState?.xp ?? 0} XP`, x + w - 8, y + h / 2 + 0.5, '#ffffff', ANIME.ink, 2.4);
  }

  function drawGardCounter() {
    const bonus = shiftState ? shiftState.bonusGard : 0;
    const x = 264;
    const y = 14;
    const w = 176;
    const h = 22;
    animePlate(ctx, x, y, w, h, 11);
    animeBadge(ctx, x + 13, y + 11, 8.5, ANIME.gold, ANIME.goldDeep, 'G');
    ctx.fillStyle = LABEL_TEXT_COLOR;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(`${bonus < 0 ? '−' : '+'}${Math.abs(bonus)}g shift`, x + 27, y + 11.5);
    ctx.font = '10px sans-serif';
    ctx.fillStyle = ANIME.inkSoft;
    ctx.textAlign = 'right';
    ctx.fillText(`Month ${save.monthToDateGard}g`, x + w - 9, y + 11.5);
    for (const pop of gardPops) {
      const t = pop.age / 1.4;
      ctx.globalAlpha = 1 - t;
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'left';
      const popY = y + h + 36 - t * 10;
      const text = `${pop.amount >= 0 ? '+' : '−'}${Math.abs(pop.amount)}g`;
      ctx.strokeStyle = CREAM;
      ctx.lineWidth = 3.5;
      ctx.lineJoin = 'round';
      ctx.strokeText(text, x + 26, popY);
      ctx.fillStyle = pop.amount >= 0 ? '#b07a1e' : '#c0392b';
      ctx.fillText(text, x + 26, popY);
      ctx.globalAlpha = 1;
    }
  }

  // -- Rendering: overlays ------------------------------------------------------------

  /** Each overlay's ribbon color, so screens are told apart at a glance. */
  const PANEL_ACCENTS = {
    triage: [ANIME.coral, ANIME.coralDeep],
    skill: [ANIME.sky, ANIME.skyDeep],
    oxygen: [ANIME.sky, ANIME.skyDeep],
    bandage: [ANIME.mint, ANIME.mintDeep],
    meds: [ANIME.lavender, ANIME.lavenderDeep],
    karen: [ANIME.coral, ANIME.coralDeep],
    mel: [ANIME.gold, ANIME.goldDeep],
    pick: [ANIME.mint, ANIME.mintDeep],
    vending: [ANIME.lavender, ANIME.lavenderDeep],
    'lost-child': [ANIME.sky, ANIME.skyDeep],
    cafe: [ANIME.gold, ANIME.goldDeep],
  };

  /** An anime dialog window (hospital/anime-ui.js) over a dimmed, sparkly ER. */
  function drawPanel(title, subtitle) {
    const t = performance.now() / 1000;
    animeBackdrop(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, t);
    const [accent, accentDeep] = PANEL_ACCENTS[overlay.kind] ?? [ANIME.pink, ANIME.pinkDeep];
    animeWindow(ctx, PANEL, { title, subtitle, t, accent, accentDeep });
    ctx.fillStyle = LABEL_TEXT_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    if (overlay.kind !== 'karen') animeCloseButton(ctx, CLOSE_RECT);
  }

  function drawFlash(y) {
    if (!overlay.flash) return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, overlay.flash.seconds / 0.3);
    drawLabelChip(ctx, CANVAS_WIDTH / 2, y, overlay.flash.text, 'bold 15px sans-serif', overlay.flash.good ? ANIME.mintDeep : ANIME.coralDeep, '#ffffff');
    ctx.restore();
  }

  function wrapText(text, cx, y, maxWidth, lineHeight) {
    let line = '';
    let lineY = y;
    for (const word of text.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, cx, lineY);
        line = word;
        lineY += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, cx, lineY);
  }

  function drawTriageOverlay() {
    const queued = shiftState.triageQueue.find((p) => p.id === overlay.patientId);
    if (!queued) return;
    const info = patientInfo.get(queued.id);
    const condition = findCondition(queued.conditionId);
    const v = info.vitals;
    drawPanel('Triage', 'Read the vitals and pick a priority (or press 1 / 2 / 3).');

    // Portrait card: a pastel frame with screentone, like a character profile.
    animeTile(ctx, PANEL.x + 30, 140, 190, 300, 16, '#d8f0ea');
    screentone(ctx, PANEL.x + 34, 144, 182, 120, 'rgba(255,255,255,0.55)', 8, 1.6);
    ctx.strokeStyle = ANIME.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(PANEL.x + 30, 140, 190, 300, 16);
    ctx.stroke();
    drawPatient(PANEL.x + 125, 418, info, 2.55);

    const left = PANEL.x + 250;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = LABEL_TEXT_COLOR;
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`${info.name}, ${info.age}`, left, 162);
    ctx.font = 'italic 14px Georgia, serif';
    ctx.fillStyle = 'rgba(58,42,42,0.85)';
    ctx.fillText(`“${condition.complaint}”`, left, 188);

    const rows = [
      ['Heart rate', `${v.hr} bpm`],
      ['Blood pressure', `${v.systolic}/${v.diastolic}`],
      ['SpO₂', `${v.spo2}%`],
      ['Temperature', `${v.temp.toFixed(1)}°C`],
    ];
    rows.forEach(([name, value], i) => {
      const y = 214 + i * 34;
      drawRoundRect(ctx, left, y, 330, 28, 10, i % 2 ? '#f6ecff' : '#ffffff');
      ctx.strokeStyle = 'rgba(59,42,74,0.35)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(left, y, 330, 28, 10);
      ctx.stroke();
      ctx.fillStyle = ANIME.inkSoft;
      ctx.font = '14px sans-serif';
      ctx.fillText(name, left + 12, y + 19);
      ctx.fillStyle = LABEL_TEXT_COLOR;
      ctx.font = 'bold 15px ui-monospace, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(value, left + 318, y + 19);
      ctx.textAlign = 'left';
    });
    ctx.font = '12px sans-serif';
    TRIAGE_LEGEND.forEach((line, i) => {
      ctx.fillStyle = TRIAGE_LEVELS[i].color;
      ctx.beginPath();
      ctx.arc(left + 6, 362 + i * 20, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(58,42,42,0.8)';
      ctx.fillText(line, left + 18, 366 + i * 20);
    });

    const TRIAGE_CANDY = { red: [ANIME.coral, ANIME.coralDeep], yellow: [ANIME.gold, ANIME.goldDeep], green: [ANIME.mint, ANIME.mintDeep] };
    triageButtonRects().forEach((r, i) => {
      const level = findTriageLevel(r.level);
      const [top, deep] = TRIAGE_CANDY[r.level] ?? [level.color, level.color];
      animeButton(ctx, r, '', top, deep);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.font = 'bold 16px sans-serif';
      outlinedText(ctx, `${i + 1}  ${level.name}`, r.x + r.w / 2, r.y + 22, '#ffffff', tint(deep, -0.45), 3);
      ctx.font = 'bold 11px sans-serif';
      outlinedText(ctx, level.label, r.x + r.w / 2, r.y + 40, '#ffffff', tint(deep, -0.45), 2.4);
    });
  }

  const SKILL_TITLES = {
    vitals: ['Vitals Check', 'Stop the marker in the gold zone to log the reading.'],
    iv: ['Start an IV', 'The needle sways — tap when it lines up with the vein.'],
    surgery: ['Surgery', 'Three steady hands: Incision, Repair, Sutures.'],
    meds: ['Give Meds', 'Push the syringe when it lines up with the IV port.'],
  };

  function skillBar() {
    return { x: 170, y: 440, w: CANVAS_WIDTH - 340, h: 26 };
  }

  function drawSkillOverlay() {
    let [title, subtitle] = SKILL_TITLES[overlay.task];
    if (overlay.task === 'surgery') {
      // Name the patient's own stages: Incision → Transplant Kidney → Sutures.
      const bed = shiftState.beds[shiftState.activeTask?.bedIndex];
      if (bed && isTransplant(bed.conditionId)) title = 'Transplant';
      subtitle = `Three steady hands: ${skillStages().join(' → ')}.`;
    }
    drawPanel(title, subtitle);
    const bar = skillBar();
    const zone = skillCheckSuccessZone(overlay.task, skillZoneScaleNow());
    const patientId = shiftState.activeTask?.patientId;
    const info = patientInfo.get(patientId);
    const t = performance.now() / 1000;

    if (overlay.task === 'vitals') {
      drawRoundRect(ctx, 250, 146, 460, 220, 12, '#1e2a30');
      ctx.strokeStyle = '#7fd68a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let px = 0; px <= 300; px += 3) {
        const phase = ((px + t * 160) % 110);
        let dy = 0;
        if (phase > 40 && phase < 46) dy = -48 * Math.sin(((phase - 40) / 6) * Math.PI);
        else if (phase > 46 && phase < 52) dy = 18 * Math.sin(((phase - 46) / 6) * Math.PI);
        else if (phase > 70 && phase < 86) dy = -8 * Math.sin(((phase - 70) / 16) * Math.PI);
        const x = 270 + px;
        if (px === 0) ctx.moveTo(x, 266 + dy); else ctx.lineTo(x, 266 + dy);
      }
      ctx.stroke();
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';
      const v = info?.vitals;
      const readouts = [['HR', v ? `${v.hr}` : '--', '#7fd68a'], ['BP', v ? `${v.systolic}/${v.diastolic}` : '--', '#e8b95a'], ['SpO₂', v ? `${v.spo2}%` : '--', '#7fc7e0']];
      readouts.forEach(([label, value, color], i) => {
        ctx.fillStyle = color;
        ctx.font = '11px sans-serif';
        ctx.fillText(label, 690, 180 + i * 60);
        ctx.font = 'bold 26px ui-monospace, monospace';
        ctx.fillText(value, 690, 208 + i * 60);
      });
    } else if (overlay.task === 'iv') {
      const skin = patientSkin(info);
      drawRoundRect(ctx, bar.x - 20, 250, bar.w + 40, 110, 50, skin);
      ctx.fillStyle = 'rgba(58,42,42,0.08)';
      ctx.fillRect(bar.x - 20, 335, bar.w + 40, 10);
      // The vein lines up with the gold zone.
      const veinX = bar.x + 0.5 * bar.w;
      const veinW = Math.max(6, zone.width * bar.w * 0.6);
      ctx.strokeStyle = 'rgba(70,90,170,0.75)';
      ctx.lineWidth = veinW;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(veinX - 10, 256);
      ctx.quadraticCurveTo(veinX + 12, 305, veinX - 6, 354);
      ctx.stroke();
      ctx.lineCap = 'butt';
      // Needle following the marker.
      const nx = bar.x + overlay.gauge * bar.w;
      drawRoundRect(ctx, nx - 7, 150, 14, 60, 4, '#e8eef2');
      drawRoundRect(ctx, nx - 9, 140, 18, 12, 3, '#7fb0d6');
      ctx.strokeStyle = '#8a9098';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(nx, 210);
      ctx.lineTo(nx, 262);
      ctx.stroke();
    } else if (overlay.task === 'meds') {
      // An arm with an IV port at the gold zone; the syringe rides the marker.
      const skin = patientSkin(info);
      drawRoundRect(ctx, bar.x - 20, 270, bar.w + 40, 96, 46, skin);
      ctx.fillStyle = 'rgba(58,42,42,0.08)';
      ctx.fillRect(bar.x - 20, 344, bar.w + 40, 10);
      const portX = bar.x + 0.5 * bar.w;
      const portW = Math.max(14, zone.width * bar.w * 0.7);
      drawRoundRect(ctx, portX - portW / 2, 300, portW, 30, 6, 'rgba(240,246,250,0.92)');
      drawRoundRect(ctx, portX - 8, 278, 16, 26, 4, '#7fb0d6');
      ctx.strokeStyle = 'rgba(58,42,42,0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(portX - portW / 2, 300, portW, 30, 6);
      ctx.stroke();
      const order = findCondition(shiftState.beds[shiftState.activeTask?.bedIndex]?.conditionId)?.med;
      const drugColor = MEDICATIONS.find((m) => m.name === order?.drug)?.color ?? '#e8b440';
      const nx = bar.x + overlay.gauge * bar.w;
      drawRoundRect(ctx, nx - 6, 130, 12, 14, 2, '#d8dde2'); // plunger
      drawRoundRect(ctx, nx - 12, 142, 24, 6, 2, '#d8dde2');
      drawRoundRect(ctx, nx - 9, 148, 18, 92, 4, 'rgba(240,246,250,0.95)');
      drawRoundRect(ctx, nx - 7, 178, 14, 60, 3, drugColor);
      ctx.strokeStyle = '#8a9098';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(nx, 240);
      ctx.lineTo(nx, 276);
      ctx.stroke();
      if (order) {
        ctx.fillStyle = LABEL_TEXT_COLOR;
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(`${order.drug} × ${order.dose}`, CANVAS_WIDTH / 2, 404);
      }
    } else if (overlay.task === 'surgery') {
      drawRoundRect(ctx, 230, 140, 500, 230, 14, '#5f9e86');
      const skin = patientSkin(info);
      drawRoundRect(ctx, 380, 190, 200, 130, 16, skin);
      ctx.strokeStyle = 'rgba(58,42,42,0.25)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(410, 255);
      ctx.lineTo(550, 255);
      ctx.stroke();
      ctx.setLineDash([]);
      const done = overlay.hits;
      if (done >= 1) {
        ctx.strokeStyle = '#b03a32';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(410, 255);
        ctx.lineTo(550, 255);
        ctx.stroke();
      }
      if (done >= 2) {
        ctx.strokeStyle = '#3a3a44';
        ctx.lineWidth = 2;
        for (let sx = 420; sx <= 540; sx += 16) {
          ctx.beginPath();
          ctx.moveTo(sx - 4, 247);
          ctx.lineTo(sx + 4, 263);
          ctx.stroke();
        }
      }
      ctx.fillStyle = CREAM;
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      const stages = skillStages();
      const stage = stages[Math.min(done, stages.length - 1)];
      ctx.fillText(`Stage ${Math.min(done + 1, 3)} of 3: ${stage}`, CANVAS_WIDTH / 2, 166);
      // Scalpel at the marker.
      const sx = bar.x + overlay.gauge * bar.w;
      ctx.save();
      ctx.translate(sx, 352);
      ctx.rotate(-0.5);
      drawRoundRect(ctx, -4, -40, 8, 34, 3, '#c8ccd4');
      ctx.fillStyle = '#eef2f6';
      ctx.beginPath();
      ctx.moveTo(-4, -6);
      ctx.lineTo(4, -6);
      ctx.lineTo(0, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Shared timing bar.
    // Anime timing bar: screentoned track, a glossy gold zone with a
    // sparkle, and a heart-tipped pink marker.
    animeGauge(ctx, bar.x, bar.y, bar.w, bar.h, 0, ANIME.pink, ANIME.pinkDeep);
    const zx = bar.x + zone.start * bar.w;
    const zw = zone.width * bar.w;
    const zg = ctx.createLinearGradient(0, bar.y, 0, bar.y + bar.h);
    zg.addColorStop(0, '#fff0a8');
    zg.addColorStop(1, ANIME.gold);
    ctx.fillStyle = zg;
    ctx.fillRect(zx, bar.y + 1.5, zw, bar.h - 3);
    ctx.strokeStyle = ANIME.goldDeep;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(zx, bar.y + 1.5, zw, bar.h - 3);
    sparkle(ctx, zx + zw / 2, bar.y + bar.h / 2, 6, '#ffffff');
    const mx = bar.x + overlay.gauge * bar.w;
    ctx.fillStyle = ANIME.pinkDeep;
    ctx.fillRect(mx - 1.5, bar.y - 2, 3, bar.h + 4);
    drawHeart(mx, bar.y - 11, 9, ANIME.pinkDeep);

    if (overlay.required > 1) {
      for (let i = 0; i < overlay.required; i++) {
        animeStar(ctx, CANVAS_WIDTH / 2 - 26 + i * 26, 498, 10, 4.6, i < overlay.hits ? 1 : 0);
      }
    }
    drawFlash(406);
  }

  function drawHeart(x, y, size, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y + size * 0.9);
    ctx.bezierCurveTo(x - size * 1.3, y + size * 0.1, x - size * 0.9, y - size * 0.95, x, y - size * 0.35);
    ctx.bezierCurveTo(x + size * 0.9, y - size * 0.95, x + size * 1.3, y + size * 0.1, x, y + size * 0.9);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(x - size * 0.42, y - size * 0.3, size * 0.18, size * 0.11, -0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSkull(x, y, size) {
    ctx.fillStyle = '#efeadf';
    ctx.beginPath();
    ctx.arc(x, y - size * 0.15, size * 0.8, 0, Math.PI * 2);
    ctx.fill();
    drawRoundRect(ctx, x - size * 0.45, y + size * 0.35, size * 0.9, size * 0.45, size * 0.12, '#efeadf');
    ctx.strokeStyle = 'rgba(58,42,42,0.35)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y - size * 0.15, size * 0.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#2a2226';
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(x + dir * size * 0.32, y - size * 0.12, size * 0.22, size * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(x, y + size * 0.12);
    ctx.lineTo(x - size * 0.1, y + size * 0.3);
    ctx.lineTo(x + size * 0.1, y + size * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#2a2226';
    ctx.lineWidth = 1.2;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * size * 0.2, y + size * 0.45);
      ctx.lineTo(x + i * size * 0.2, y + size * 0.75);
      ctx.stroke();
    }
  }

  /** The Oxygen overlay's left column: SpO₂ monitor, then the patient in bed with the bag-valve mask. */
  const OXYGEN_BAY = { x: PANEL.x + 24, y: 142, w: 230, h: 336 };

  function drawOxygenMonitor(t) {
    const m = { x: OXYGEN_BAY.x + 12, y: OXYGEN_BAY.y + 12, w: OXYGEN_BAY.w - 24, h: 74 };
    drawRoundRect(ctx, m.x - 4, m.y - 4, m.w + 8, m.h + 8, 10, '#4a5560');
    drawRoundRect(ctx, m.x, m.y, m.w, m.h, 7, '#14211f');
    const spo2 = Math.round(overlay.spo2);
    const color = spo2 >= 95 ? '#7fd68a' : (spo2 >= 90 ? '#e8c45a' : '#ef6f6a');
    // Pleth wave: bigger, steadier beats as saturation recovers.
    const amp = 6 + 10 * ((spo2 - overlay.spo2Start) / Math.max(1, 98 - overlay.spo2Start));
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let px = 0; px <= 110; px += 2) {
      const phase = ((px + t * 90) % 46) / 46;
      const dy = phase < 0.35 ? -Math.sin((phase / 0.35) * Math.PI) * amp : -Math.sin(((phase - 0.35) / 0.65) * Math.PI) * amp * 0.25;
      const x = m.x + 10 + px;
      const y = m.y + 50 + dy;
      if (px === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(200,230,220,0.7)';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('SpO₂ %', m.x + m.w - 10, m.y + 18);
    ctx.fillStyle = color;
    ctx.font = 'bold 32px ui-monospace, monospace';
    ctx.fillText(String(spo2), m.x + m.w - 10, m.y + 56);
    // Alarm light blinks while it's low.
    if (spo2 < 90 && Math.sin(t * 8) > 0) {
      ctx.fillStyle = '#ef6f6a';
      ctx.beginPath();
      ctx.arc(m.x + 12, m.y + 12, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawOxygenPatient(info, t) {
    const bay = OXYGEN_BAY;
    const cx = bay.x + 84;
    const squeeze = overlay.squeeze;
    // Bed: frame, mattress, pillow.
    drawRoundRect(ctx, bay.x + 22, bay.y + 108, 140, 216, 14, '#9aa6b0');
    drawRoundRect(ctx, bay.x + 28, bay.y + 114, 128, 204, 10, '#f6f8fa');
    drawRoundRect(ctx, bay.x + 42, bay.y + 120, 100, 36, 14, '#ffffff');
    // The patient, head on the pillow; the blanket rises with each breath.
    const scale = 1.7;
    const bodyY = bay.y + 232;
    const headY = bodyY + animeHeadCenterY(findPatientDesign(info?.designKey)) * scale;
    if (info) drawPatient(cx, bodyY, info, scale);
    const breath = 3 * squeeze + 1.2 * Math.sin(t * 2.4);
    const level = findTriageLevel(shiftState.beds[shiftState.activeTask?.bedIndex]?.level ?? 'yellow');
    drawRoundRect(ctx, bay.x + 32, bodyY - 50 - breath, 120, 136 + breath, 10, shadeColor(level.color, 0.55));
    drawRoundRect(ctx, bay.x + 32, bodyY - 50 - breath, 120, 12, [10, 10, 0, 0], shadeColor(level.color, 0.75));
    ctx.fillStyle = patientSkin(info);
    for (const dx of [-24, 24]) {
      ctx.beginPath();
      ctx.arc(cx + dx, bodyY - 34 - breath, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Mask over nose and mouth, fogging on each pump.
    const maskY = headY + 8;
    ctx.fillStyle = `rgba(190,228,240,${0.55 + 0.35 * squeeze})`;
    ctx.beginPath();
    ctx.ellipse(cx, maskY, 15, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(70,120,140,0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(70,120,140,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 15, maskY - 2);
    ctx.lineTo(cx - 22, maskY - 10);
    ctx.moveTo(cx + 15, maskY - 2);
    ctx.lineTo(cx + 22, maskY - 10);
    ctx.stroke();

    // Valve + self-inflating bag to the right of the head, reservoir behind it.
    const valveX = cx + 20;
    drawRoundRect(ctx, valveX, maskY - 6, 16, 12, 3, '#5a7080');
    const bagCx = cx + 74;
    const bagRx = 38 - 8 * squeeze;
    const bagRy = 20 - 5 * squeeze;
    // Reservoir bag (green) hanging below, and the O₂ tube up to the wall flowmeter.
    ctx.fillStyle = 'rgba(127,200,140,0.8)';
    ctx.beginPath();
    ctx.ellipse(bagCx + 14, maskY + 50, 15, 22 + 3 * squeeze, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8fbf9a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bagCx + 26, maskY + 60);
    ctx.bezierCurveTo(bay.x + bay.w - 4, maskY + 70, bay.x + bay.w - 4, bay.y + 140, bay.x + bay.w - 16, bay.y + 114);
    ctx.stroke();
    drawRoundRect(ctx, bay.x + bay.w - 28, bay.y + 96, 22, 18, 4, '#3f7a6a');
    ctx.fillStyle = CREAM;
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('O₂', bay.x + bay.w - 17, bay.y + 109);
    // The bag itself, ribbed.
    ctx.fillStyle = '#7fb8d0';
    ctx.beginPath();
    ctx.ellipse(bagCx, maskY, bagRx, bagRy, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4f8aa8';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(79,138,168,0.45)';
    ctx.lineWidth = 1.5;
    for (let i = -2; i <= 2; i++) {
      const rx = bagCx + i * bagRx * 0.32;
      const ry = bagRy * Math.sqrt(Math.max(0, 1 - (i * 0.32) ** 2)) * 0.85;
      ctx.beginPath();
      ctx.moveTo(rx, maskY - ry);
      ctx.lineTo(rx, maskY + ry);
      ctx.stroke();
    }
    drawRoundRect(ctx, valveX + 14, maskY - 4, bagCx - bagRx - valveX - 12, 8, 2, '#8a9aa6');
    // Gloved hand squeezing from above.
    ctx.fillStyle = '#9c8ed8';
    drawRoundRect(ctx, bagCx - 24, maskY - bagRy - 10 + 6 * squeeze, 48, 16, 8, '#9c8ed8');
    for (let i = 0; i < 4; i++) drawRoundRect(ctx, bagCx - 22 + i * 12, maskY - bagRy + 2 + 6 * squeeze, 10, 12, 5, '#8a7cc8');

    // A puff of air travelling down the tube into the mask after each pump.
    if (squeeze > 0) {
      const k = 1 - squeeze;
      for (let i = 0; i < 3; i++) {
        const f = Math.min(1, k * 1.4 + i * 0.12);
        ctx.fillStyle = `rgba(220,245,255,${squeeze})`;
        ctx.beginPath();
        ctx.arc(bagCx - bagRx + (cx - (bagCx - bagRx)) * f, maskY - 2 + i * 2, 3.5 - i * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawOxygenOverlay() {
    drawPanel('Oxygen', 'Find the hearts to pump the bag — three good pumps. Skulls are missed pumps!');
    const info = patientInfo.get(shiftState.activeTask?.patientId);
    const t = performance.now() / 1000;

    // Left: the patient bay.
    drawRoundRect(ctx, OXYGEN_BAY.x, OXYGEN_BAY.y, OXYGEN_BAY.w, OXYGEN_BAY.h, 14, '#dfe9e5');
    drawOxygenMonitor(t);
    drawOxygenPatient(info, t);

    // Right: the search field — a deep-teal airway with drifting O₂ bubbles.
    const field = { x: OXYGEN_SCENE.x - 30, y: OXYGEN_SCENE.y - 30, w: OXYGEN_SCENE.w + 60, h: OXYGEN_SCENE.h + 60 };
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(field.x, field.y, field.w, field.h, 16);
    ctx.clip();
    const bg = ctx.createLinearGradient(0, field.y, 0, field.y + field.h);
    bg.addColorStop(0, '#2c5a66');
    bg.addColorStop(1, '#1d3b45');
    ctx.fillStyle = bg;
    ctx.fillRect(field.x, field.y, field.w, field.h);
    for (let i = 0; i < 22; i++) {
      const speed = 14 + (i % 4) * 7;
      const bx = field.x + ((i * 97 + Math.sin(t * 0.8 + i) * 14) % field.w);
      const by = field.y + field.h - ((t * speed + i * 53) % (field.h + 20)) + 10;
      const r = 2 + (i % 5);
      ctx.strokeStyle = 'rgba(190,232,245,0.22)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    for (const it of overlay.items) {
      const bob = Math.sin(t * 2 + it.phase) * 5;
      const x = it.x;
      const y = it.y + bob;
      if (it.kind === 'heart') {
        if (!it.found) {
          const pulse = 1 + 0.1 * Math.max(0, Math.sin(t * 5 + it.phase));
          const glow = ctx.createRadialGradient(x, y, 4, x, y, 40);
          glow.addColorStop(0, 'rgba(255,140,150,0.45)');
          glow.addColorStop(1, 'rgba(255,140,150,0)');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(x, y, 40, 0, Math.PI * 2);
          ctx.fill();
          drawHeart(x, y, 21 * pulse, '#ef4f5a');
        } else {
          // Burst: expanding rings and a rising "+O₂", then a faint outline stays.
          const k = it.fade;
          if (k < 1) {
            ctx.strokeStyle = `rgba(255,170,175,${1 - k})`;
            ctx.lineWidth = 3;
            for (const r of [18 + 40 * k, 10 + 26 * k]) {
              ctx.beginPath();
              ctx.arc(x, y, r, 0, Math.PI * 2);
              ctx.stroke();
            }
            ctx.globalAlpha = 1 - k;
            drawLabelChip(ctx, x, y - 22 - 30 * k, '+O₂', 'bold 13px sans-serif', '#5fa86a', CREAM);
            ctx.globalAlpha = 1;
          }
          drawHeart(x, y, 16, 'rgba(255,170,175,0.25)');
        }
      } else {
        const alpha = 1 - it.fade;
        if (alpha <= 0) continue;
        ctx.save();
        ctx.globalAlpha = alpha;
        const glow = ctx.createRadialGradient(x, y, 4, x, y, 36);
        glow.addColorStop(0, 'rgba(120,80,150,0.4)');
        glow.addColorStop(1, 'rgba(120,80,150,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, 36, 0, Math.PI * 2);
        ctx.fill();
        const shake = it.found ? Math.sin(t * 60) * 3 * alpha : 0;
        drawSkull(x + shake, y, 21);
        if (it.found) {
          ctx.strokeStyle = '#ef4f5a';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(x - 16, y - 18);
          ctx.lineTo(x + 16, y + 14);
          ctx.moveTo(x + 16, y - 18);
          ctx.lineTo(x - 16, y + 14);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // Pump counter.
    const pipsX = OXYGEN_SCENE.x + OXYGEN_SCENE.w / 2;
    ctx.fillStyle = LABEL_TEXT_COLOR;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Pumps ${overlay.hits}/${overlay.required}`, pipsX - 34, 510);
    for (let i = 0; i < overlay.required; i++) {
      drawHeart(pipsX - 8 + i * 32, 508, 11, i < overlay.hits ? '#ef4f5a' : 'rgba(58,42,42,0.18)');
    }
    drawFlash(160);
  }

  function drawBandageOverlay() {
    drawPanel('Bandage', 'Hold and trace the dashed line along the wound, start to end.');
    const info = patientInfo.get(shiftState.activeTask?.patientId);
    const skin = patientSkin(info);
    drawRoundRect(ctx, 200, 170, 560, 260, 40, skin);
    const path = overlay.path;
    // The wound: a jagged red line along the path.
    ctx.strokeStyle = '#b03a32';
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    path.forEach((p, i) => {
      if (i === 0) { ctx.moveTo(p.x, p.y); return; }
      const prev = path[i - 1];
      const mx = (prev.x + p.x) / 2;
      const my = (prev.y + p.y) / 2 + (i % 2 ? 6 : -6);
      ctx.lineTo(mx, my);
      ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    // Tolerance band and dashed guide.
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = BANDAGE_TOLERANCE_PX * 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    path.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
    ctx.strokeStyle = CREAM;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 7]);
    ctx.beginPath();
    path.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
    ctx.setLineDash([]);
    // Start/end markers.
    const start = path[0];
    const end = path[path.length - 1];
    ctx.fillStyle = '#5fa86a';
    ctx.beginPath();
    ctx.arc(start.x, start.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d9534f';
    ctx.beginPath();
    ctx.arc(end.x, end.y, 9, 0, Math.PI * 2);
    ctx.fill();
    drawLabelChip(ctx, start.x, start.y - 22, 'START', 'bold 10px sans-serif');
    // The gauze laid so far.
    if (overlay.samples.length > 1) {
      ctx.strokeStyle = 'rgba(250,250,245,0.95)';
      ctx.lineWidth = 16;
      ctx.beginPath();
      overlay.samples.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
      ctx.strokeStyle = 'rgba(200,200,190,0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
    drawFlash(470);
  }

  function drawMedsOverlay() {
    const bedIndex = shiftState.activeTask?.bedIndex ?? 0;
    const name = patientInfo.get(shiftState.activeTask?.patientId)?.name ?? '';
    drawPanel('Med Cabinet', overlay.picked
      ? 'Found it — now pick the dose (keys 1–3).'
      : 'Search the shelves for the ordered medication. Look-alikes are everywhere!');
    animeButton(ctx, { x: CANVAS_WIDTH / 2 - 210, y: 134, w: 420, h: 30 }, '', ANIME.lavender, ANIME.lavenderDeep);
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    outlinedText(ctx, `Order · ${bedLabel(bedIndex)} · ${name}: ${overlay.order.drug} × ${overlay.order.dose}`, CANVAS_WIDTH / 2, 150, '#ffffff', tint(ANIME.lavenderDeep, -0.45), 3);

    // The cabinet: a wooden frame with glass-backed shelves.
    const cab = MED_CABINET;
    const cabH = MED_CABINET_SHELVES * cab.shelfH;
    drawRoundRect(ctx, cab.x - 12, cab.y - 6, cab.w + 24, cabH + 14, 10, '#8a6a4a');
    drawRoundRect(ctx, cab.x, cab.y, cab.w, cabH, 4, '#e6eef0');
    for (let shelf = 0; shelf < MED_CABINET_SHELVES; shelf++) {
      const floorY = cab.y + (shelf + 1) * cab.shelfH - 6;
      drawRoundRect(ctx, cab.x - 4, floorY, cab.w + 8, 8, 2, '#b08a62');
    }

    for (const b of overlay.bottles) {
      const picked = overlay.picked === b.name;
      ctx.save();
      ctx.translate(b.x + b.w / 2, b.y + b.h);
      ctx.rotate(b.tilt);
      ctx.globalAlpha = b.found ? 0.3 : 1;
      const w = b.w;
      const h = b.h;
      drawRoundRect(ctx, -w / 2 + 4, -h + 10, w - 8, h - 10, 6, b.color);
      drawRoundRect(ctx, -w / 2 + 8, -h, w - 16, 12, 3, '#f2f0ea');
      drawRoundRect(ctx, -w / 2 + 6, -h * 0.62, w - 12, 18, 2, CREAM);
      ctx.fillStyle = LABEL_TEXT_COLOR;
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.name, 0, -h * 0.62 + 9, w - 14);
      if (picked) {
        ctx.strokeStyle = '#e0a83a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(-w / 2 + 1, -h - 3, w - 2, h + 3, 8);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = LABEL_TEXT_COLOR;
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(overlay.picked ? `${overlay.picked} — dose:` : 'Dose:', CANVAS_WIDTH / 2 + 6, 499);
    medsDoseRects().forEach((r) => {
      if (overlay.picked) animeButton(ctx, r, `× ${r.dose}`, ANIME.sky, ANIME.skyDeep);
      else animeButton(ctx, r, `× ${r.dose}`, '#e4e0ec', '#bdb6cc');
    });
    drawFlash(118);
  }

  function drawKarenOverlay() {
    const t = performance.now() / 1000;
    drawPanel('An angry relative', null);
    // Manga speed lines radiating from behind her, clipped to the window.
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(PANEL.x + 8, PANEL.y + 8, PANEL.w - 16, PANEL.h - 16, 18);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,138,122,0.22)';
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2 + Math.sin(t * 3 + i) * 0.01;
      ctx.lineWidth = 1 + (i % 3);
      ctx.beginPath();
      ctx.moveTo(CANVAS_WIDTH / 2 + Math.cos(a) * 90, 340 + Math.sin(a) * 90);
      ctx.lineTo(CANVAS_WIDTH / 2 + Math.cos(a) * 520, 340 + Math.sin(a) * 520);
      ctx.stroke();
    }
    ctx.restore();
    drawAnimePerson(ctx, CANVAS_WIDTH / 2, 452, STAFF_DESIGNS.karen, { scale: 2.7, angryTint: true, t });
    drawAngerMark(CANVAS_WIDTH / 2 + 50, 284 + Math.sin(t * 8) * 2, 19);

    // Her line in a speech bubble pointing down at her.
    speechBubble(ctx, { x: 180, y: 112, w: CANVAS_WIDTH - 360, h: 100 }, { tailX: CANVAS_WIDTH / 2 + 20, tailY: 258 });
    ctx.fillStyle = ANIME.ink;
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    wrapText(KAREN_LINE, CANVAS_WIDTH / 2, 152, CANVAS_WIDTH - 400, 22);
    drawLabelChip(ctx, CANVAS_WIDTH / 2, 194, `${Math.max(0, Math.ceil(shiftState.karen.timerSecondsRemaining))}s to respond`, 'bold 11px sans-serif', ANIME.coralDeep, '#ffffff');
    const b = karenButtonRects();
    animeButton(ctx, b.explain, 'Explain Triage', ANIME.mint, ANIME.mintDeep, 'bold 14px sans-serif');
    animeButton(ctx, b.security, 'Call Security', ANIME.sky, ANIME.skyDeep, 'bold 14px sans-serif');
    animeButton(ctx, b.letCut, 'Let Her Cut In', ANIME.gold, ANIME.goldDeep, 'bold 14px sans-serif');
  }

  /** The anime anger mark (a throbbing red cross-vein) centered on (x, y). */
  function drawAngerMark(x, y, r) {
    ctx.save();
    ctx.strokeStyle = '#e0303a';
    ctx.lineWidth = r * 0.28;
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const cx = x + Math.cos(a) * r * 0.62;
      const cy = y + Math.sin(a) * r * 0.62;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.42, a + Math.PI * 0.75, a + Math.PI * 1.25);
      ctx.stroke();
    }
    ctx.restore();
  }

  // -- Hunger and Thirst: the vending machine and the Cafeteria ----------------

  const VENDING_CARD = { w: 160, h: 130, gap: 22, top: 140 };

  /** The vending machine's 3×2 grid of item cards. */
  function vendingCardRects() {
    if (overlay?.kind !== 'vending') return [];
    const cols = 3;
    const total = cols * VENDING_CARD.w + (cols - 1) * VENDING_CARD.gap;
    const x0 = CANVAS_WIDTH / 2 - total / 2;
    return VENDING_ITEMS.map((item, i) => ({
      id: item.id,
      x: x0 + (i % cols) * (VENDING_CARD.w + VENDING_CARD.gap),
      y: VENDING_CARD.top + Math.floor(i / cols) * (VENDING_CARD.h + VENDING_CARD.gap),
      w: VENDING_CARD.w,
      h: VENDING_CARD.h,
    }));
  }

  function buyFromVending(id) {
    const item = VENDING_ITEMS.find((i) => i.id === id);
    if (!item) return;
    const before = shiftState;
    shiftState = buyVendingItem(shiftState, id, spendableGard());
    if (shiftState !== before) flash(`${item.name}! −${item.price}g`, true);
    else flash(`Not enough Gard — ${item.name} is ${item.price}g.`, false);
  }

  function cafeButtonRect() {
    return { x: 520, y: 430, w: 250, h: 50 };
  }

  /** Auntie Yumi's free meal and water. */
  function eatCafeMeal() {
    if (overlay?.kind !== 'cafe' || overlay.served) return;
    shiftState = cafeteriaMeal(shiftState);
    overlay.served = true;
    overlay.closeIn = 1.2;
    flash(`Full and refreshed! +${CAFE_MEAL.sanity} Sanity`, true);
    showToast(`${CAFE_LADY_NAME}: "Back to work, dear — and come see me again!"`);
  }

  function effectText(item) {
    const parts = [];
    if (item.hunger > 0) parts.push(`+${item.hunger} Hunger`);
    if (item.thirst > 0) parts.push(`+${item.thirst} Thirst`);
    if (item.sanity > 0) parts.push(`+${item.sanity} Sanity`);
    return parts.join(' · ');
  }

  function drawVendingOverlay() {
    drawPanel('Vending Machine', `Snacks and drinks — you have ${Math.max(0, spendableGard())}g to spend.`);
    for (const r of vendingCardRects()) {
      const item = VENDING_ITEMS.find((i) => i.id === r.id);
      const affordable = spendableGard() >= item.price;
      ctx.save();
      if (!affordable) ctx.globalAlpha = 0.45;
      animeTile(ctx, r.x, r.y, r.w, r.h, 16, item.kind === 'snack' ? '#fff2dc' : '#e6f4ff');
      ctx.strokeStyle = ANIME.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 16);
      ctx.stroke();
      drawFoodIcon(ctx, r.x + r.w / 2, r.y + 42, 2.2, item.id);
      ctx.fillStyle = LABEL_TEXT_COLOR;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(item.name, r.x + r.w / 2, r.y + 88);
      ctx.font = '10px sans-serif';
      ctx.fillStyle = ANIME.inkSoft;
      ctx.fillText(effectText(item), r.x + r.w / 2, r.y + 104, r.w - 12);
      drawLabelChip(ctx, r.x + r.w / 2, r.y + r.h - 12, affordable ? `${item.price}g` : `${item.price}g · not enough`, 'bold 11px sans-serif', affordable ? ANIME.goldDeep : '#a8a0b8', '#ffffff');
      ctx.restore();
    }
    const b = vendingBatteryRect();
    const affordable = spendableGard() >= BATTERY_PRICE;
    const [top, deep] = affordable ? [ANIME.gold, ANIME.goldDeep] : ['#d8d2e2', '#a8a0b8'];
    animeButton(ctx, b, '', top, deep);
    drawBatteryIcon(ctx, b.x + 26, b.y + b.h / 2, 1.3, affordable ? 1 : 0);
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const label = affordable
      ? `Flashlight battery · ${BATTERY_PRICE}g (${shiftState.flashlight.spares}/${FLASHLIGHT_MAX_SPARES})`
      : `Battery ${BATTERY_PRICE}g — not enough Gard (${Math.max(0, spendableGard())}g)`;
    outlinedText(ctx, label, b.x + 46, b.y + b.h / 2 + 1, '#ffffff', tint(deep, -0.45), 3);
    drawFlash(118);
  }

  /** Gard you can spend right now: the month's total plus this shift's earnings so far. */
  function spendableGard() {
    return save.monthToDateGard + (shiftState?.bonusGard ?? 0);
  }

  function vendingBatteryRect() {
    return { x: CANVAS_WIDTH / 2 - 170, y: 452, w: 340, h: 40 };
  }

  function drawCafeOverlay() {
    const t = performance.now() / 1000;
    drawPanel('The Cafeteria', `${CAFE_LADY_NAME} serves a warm meal and water — free for staff.`);
    drawAnimePerson(ctx, 280, 500, STAFF_DESIGNS.cafeLady, { scale: 3.2, t });
    speechBubble(ctx, { x: 440, y: 150, w: 360, h: 92 }, { tailX: 400, tailY: 290 });
    ctx.fillStyle = ANIME.ink;
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    wrapText(CAFE_LADY_LINE, 620, 186, 320, 20);
    drawFoodIcon(ctx, 645, 330, 4.2, 'meal');
    ctx.fillStyle = ANIME.inkSoft;
    ctx.font = '12px sans-serif';
    ctx.fillText(`Hunger and Thirst to full · +${CAFE_MEAL.sanity} Sanity`, 645, 408);
    animeButton(ctx, cafeButtonRect(), overlay.served ? 'Itadakimasu! ♥' : 'Eat & Drink (free)', ANIME.gold, ANIME.goldDeep);
    drawFlash(118);
  }

  // -- Special visitors: the lost child, the hospital cat, celebrities -------

  const LOST_CHILD_DESIGN = 'kimonoKidGirl';
  const CELEBRITY_NAMES = ['Rina Starlight', 'Kaito Blaze', 'Mimi Moonbeam', 'Haru Sparkle'];

  function lostChildButtonRect() {
    return { x: 520, y: 430, w: 260, h: 50 };
  }

  function walkLostChild() {
    if (overlay?.kind !== 'lost-child') return;
    shiftState = helpLostChild(shiftState);
    overlay = null;
    showToast(`You sit the kid on the waiting chairs. Their mom rushes in: "Thank you!" +${LOST_CHILD_GARD}g, the ward cheers up.`, 4);
  }

  function drawLostChildOverlay() {
    const t = performance.now() / 1000;
    drawPanel('A lost child', 'A little one wandered in on their own.');
    drawAnimePatient(ctx, 290, 470, findPatientDesign(LOST_CHILD_DESIGN), { scale: 3.6, t });
    speechBubble(ctx, { x: 440, y: 150, w: 360, h: 100 }, { tailX: 380, tailY: 300 });
    ctx.fillStyle = ANIME.ink;
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    wrapText(LOST_CHILD_LINE, 620, 186, 320, 20);
    ctx.fillStyle = ANIME.inkSoft;
    ctx.font = '12px sans-serif';
    ctx.fillText(`Their mom's thanks: +${LOST_CHILD_GARD}g and a happier ward`, 650, 408);
    animeButton(ctx, lostChildButtonRect(), 'Walk them to the chairs', ANIME.sky, ANIME.skyDeep);
  }

  /** The hospital cat (on some shifts): wanders the ER; clicking it pets it. */
  let cat = null; // { x, y, target, pause, dir, cooldown }
  const CAT_WAYPOINTS = [[230, 470], [460, 492], [690, 466], [160, 250], [520, 250], [380, 470]];
  function resetCat() {
    cat = random() < CAT_CHANCE
      ? { x: 380, y: 476, target: 0, pause: 2, dir: 1, cooldown: 0, hearts: 0 }
      : null;
  }
  function updateCat(dt) {
    if (!cat) return;
    cat.cooldown = Math.max(0, cat.cooldown - dt);
    cat.hearts = Math.max(0, cat.hearts - dt);
    if (cat.pause > 0) { cat.pause -= dt; return; }
    const [tx, ty] = CAT_WAYPOINTS[cat.target];
    const dx = tx - cat.x;
    const dy = ty - cat.y;
    const dist = Math.hypot(dx, dy);
    const step = 45 * dt;
    if (Math.abs(dx) > 1) cat.dir = dx > 0 ? 1 : -1;
    if (dist <= step) {
      cat.x = tx;
      cat.y = ty;
      cat.pause = 2 + random() * 4;
      cat.target = Math.floor(random() * CAT_WAYPOINTS.length);
    } else {
      cat.x += (dx / dist) * step;
      cat.y += (dy / dist) * step;
    }
  }
  function catAtPoint(x, y) {
    return cat && currentFloor === FLOOR_1 && Math.abs(x - cat.x) <= 22 && y >= cat.y - 30 && y <= cat.y + 8;
  }
  function petTheCat() {
    if (!cat) return;
    if (cat.cooldown > 0) {
      showToast('The cat is happily grooming itself. Try again in a little while.');
      return;
    }
    shiftState = petCat(shiftState);
    cat.cooldown = CAT_PET_COOLDOWN_SECONDS;
    cat.hearts = 1.6;
    cat.pause = 3;
    showToast('Purrr… petting the hospital cat calms you down. +Sanity');
  }
  function drawHospitalCat() {
    if (!cat || currentFloor !== FLOOR_1) return;
    const t = performance.now() / 1000;
    drawCat(ctx, cat.x, cat.y, 1, cat.dir, t);
    if (cat.hearts > 0) {
      for (let i = 0; i < 3; i++) {
        const rise = (1.6 - cat.hearts) * 18 + i * 8;
        drawHeart(cat.x - 10 + i * 10, cat.y - 30 - rise, 5, ANIME.pinkDeep);
      }
    }
    drawLabelChip(ctx, cat.x, cat.y + 14, 'Cat ♥', 'bold 9px sans-serif', 'rgba(255,250,246,0.85)', ANIME.ink);
  }

  /** Visitors in the waiting chairs and off-duty staff in the Cafeteria (set dressing). */
  const WAITING_VISITORS = [
    { x: 568, design: () => findPatientDesign('grandmaCardigan') },
    { x: 632, design: () => findPatientDesign('salaryman') },
  ];
  const CAFE_DINERS = [
    { x: 160, y: 318, design: () => STAFF_DESIGNS.orderly },
    { x: 802, y: 318, design: () => STAFF_DESIGNS.receptionist },
    { x: 160, y: 468, design: () => STAFF_DESIGNS.pharmacist },
    { x: 802, y: 468, design: () => STAFF_DESIGNS.janitor },
  ];
  // -- Security (rules.js "Security"; the user: "add security") ------------
  // One incident per shift at most, from shift 2: a rowdy visitor shouting
  // by the waiting chairs (Ward Mood and Sanity drain), or a thief
  // jimmying the vending machine (if he gets away it's out of order all
  // shift). Click a guard to send him: he walks over and escorts the
  // culprit out the entrance on the left. The engine keeps the clock and
  // the rewards; this keeps the positions.
  const ROWDY_SPOT = [506, 242];
  const THIEF_SPOT = [706, 548];
  const ENTRANCE = [-40, 300];
  let incident = null; // { kind, x, y, phase: 'active'|'escorted'|'fleeing', guardKey }
  let plannedIncident = null; // { kind, atElapsed } — this shift's roll

  function resetSecurity() {
    incident = null;
    plannedIncident = null;
    if (daily || currentShiftNumber < SECURITY_FROM_SHIFT) return;
    if (random() >= (shiftState.night ? SECURITY_INCIDENT_CHANCE_NIGHT : SECURITY_INCIDENT_CHANCE)) return;
    const [lo, hi] = SECURITY_INCIDENT_WINDOW;
    plannedIncident = {
      kind: SECURITY_INCIDENT_KINDS[Math.floor(random() * SECURITY_INCIDENT_KINDS.length)],
      atElapsed: shiftState.totalClockSeconds * (lo + random() * (hi - lo)),
    };
  }

  function startIncident(kind) {
    const before = shiftState;
    shiftState = securityIncidentStarts(shiftState, kind);
    if (shiftState === before) return false;
    const [x, y] = kind === 'thief' ? THIEF_SPOT : ROWDY_SPOT;
    incident = { kind, x, y, phase: 'active', guardKey: null };
    showToast(kind === 'thief'
      ? 'A thief is breaking into the vending machine! Click a Security guard to send him.'
      : 'A rowdy visitor is shouting at the waiting chairs and upsetting everyone! Click Security to have him walked out.', 4);
    return true;
  }

  const securityBusy = () => ambient.some((g) => g.errand?.kind === 'respond' || g.errand?.kind === 'escort');

  /** Clicking a guard: send him to the incident, or a word about his job. */
  function sendSecurity(a) {
    if (incident?.phase === 'active' && shiftState.security.incident) {
      if (securityBusy()) {
        showToast('Security is already on it.');
        return;
      }
      shiftState = dispatchSecurity(shiftState);
      a.errand = { kind: 'respond' };
      a.pause = 0;
      incident.guardKey = a.key;
      showToast(`${a.name} is on his way!`);
      return;
    }
    showToast(a.key === 'nightGuard'
      ? 'Night Security: "Quiet night so far. I\'ll keep my light on things."'
      : 'Security keeps watch from his desk — send him to deal with trouble, or call him on Karen.');
  }

  function updateGuard(a, dt) {
    const kind = a.errand?.kind;
    if (kind === 'respond') {
      if (!incident || incident.phase !== 'active') { a.errand = { kind: 'return' }; return; }
      if (walkToward(a, [incident.x + 26, incident.y], ERRAND_SPEED, dt)) {
        incident.phase = 'escorted';
        a.errand = { kind: 'escort' };
        showToast(incident.kind === 'thief'
          ? `${a.name} caught the thief red-handed and is walking him out.`
          : `${a.name} is walking the rowdy visitor out. "Let's take this outside, sir."`, 3);
      }
      return;
    }
    if (kind === 'escort') return; // walked out beside the culprit (updateSecurity)
    if (kind === 'return') {
      if (walkToward(a, a.waypoints[0], AMBIENT_SPEED, dt)) { a.errand = null; a.pause = 1.5; }
      return;
    }
    wander(a, dt);
  }

  function updateSecurity(dt) {
    if (!shiftState) return;
    if (plannedIncident && shiftState.phase === 'playing'
      && shiftState.totalClockSeconds - shiftState.clockSeconds >= plannedIncident.atElapsed) {
      startIncident(plannedIncident.kind);
      plannedIncident = null;
    }
    if (!incident) return;
    if (incident.phase === 'active' && shiftState.security.outcome === 'escaped') {
      incident.phase = 'fleeing';
      showToast(incident.kind === 'thief'
        ? "The thief got away with the vending machine's cash — it's out of order for the rest of the shift."
        : 'The rowdy visitor stormed out on his own, leaving the whole ward rattled.', 3.6);
    }
    if (incident.phase === 'fleeing') {
      if (walkToward(incident, ENTRANCE, 150, dt)) incident = null;
      return;
    }
    if (incident.phase !== 'escorted') return;
    const guard = staff(incident.guardKey);
    const out = walkToward(incident, ENTRANCE, 80, dt);
    if (guard) walkToward(guard, [incident.x + 24, incident.y], 120, dt);
    if (!out) return;
    shiftState = resolveSecurityIncident(shiftState);
    showToast(incident.kind === 'thief'
      ? `The thief is out — the vending company sends a reward: +${THIEF_CAUGHT_GARD}g`
      : 'The rowdy visitor is gone. The waiting area breathes a sigh of relief. +Mood', 3.2);
    if (guard) guard.errand = { kind: 'return' };
    incident = null;
  }

  function incidentAtPoint(x, y) {
    return Boolean(incident) && currentFloor === FLOOR_1 && Math.abs(x - incident.x) <= 20 && y >= incident.y - 46 && y <= incident.y + 14;
  }

  /** Which way a guard faces: toward where he's heading. */
  function guardFacing(a) {
    let tx = a.waypoints[a.target][0];
    if (a.errand?.kind === 'return') tx = a.waypoints[0][0];
    else if (a.errand) tx = incident ? incident.x : ENTRANCE[0];
    return tx < a.x ? -1 : 1;
  }

  const ROWDY_DESIGN = { ...findPatientDesign('delinquent'), mood: 'angry' };
  const thiefBase = findPatientDesign('hoodieTeen');
  const THIEF_DESIGN = {
    ...thiefBase,
    hair: { ...thiefBase.hair, color: '#1a161e' },
    outfit: { ...thiefBase.outfit, top: '#2a2a33', bottom: '#1e1e24', shoes: '#14141a' },
    extras: { ...thiefBase.extras, mask: true, cap: '#1e1e24' },
  };

  function drawSecurityIncident() {
    if (!incident || currentFloor !== FLOOR_1) return;
    const t = performance.now() / 1000;
    const shaking = incident.phase === 'active';
    const jx = shaking ? Math.sin(t * (incident.kind === 'thief' ? 30 : 18)) * 1.4 : 0;
    const design = incident.kind === 'thief' ? THIEF_DESIGN : ROWDY_DESIGN;
    drawAnimePerson(ctx, incident.x + jx, incident.y, design, { scale: 0.8, t, angryTint: incident.kind === 'rowdy' && shaking });
    if (incident.kind === 'thief' && incident.phase !== 'active') {
      // The loot bag he's carrying out.
      ctx.fillStyle = '#c9b6a4';
      ctx.beginPath();
      ctx.ellipse(incident.x - 14, incident.y - 22, 7, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5a3a22';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', incident.x - 14, incident.y - 19);
    }
    if (shaking) {
      // Shouting, or the rattle of a crowbar on the machine.
      const words = incident.kind === 'thief' ? ['*clank*', '*rattle*'] : ['!!', '#@%!', 'MANAGER!'];
      const word = words[Math.floor(t * 1.5) % words.length];
      drawLabelChip(ctx, incident.x + 4, incident.y - 70 - Math.abs(Math.sin(t * 4)) * 3, word, 'bold 10px sans-serif', incident.kind === 'thief' ? '#ffe9a8' : '#ffd1d1', '#8a1a2a');
      const left = Math.ceil(shiftState?.security?.secondsLeft ?? 0);
      const label = incident.kind === 'thief' ? `Thief! ${left}s` : `Rowdy visitor! ${left}s`;
      drawLabelChip(ctx, incident.x, incident.y + 22, label, 'bold 9px sans-serif', '#c0304a', CREAM);
    } else if (incident.phase === 'escorted') {
      drawLabelChip(ctx, incident.x, incident.y + 22, 'escorted out', '9px sans-serif', 'rgba(255,251,246,0.75)', LABEL_TEXT_COLOR);
    }
  }

  function drawCrowds() {
    const t = performance.now() / 1000;
    if (currentFloor === FLOOR_1) {
      WAITING_VISITORS.forEach((v, i) => drawAnimePerson(ctx, v.x, 214 + Math.sin(t * 1.2 + i) * 0.4, v.design(), { scale: 0.5, t }));
      if (shiftState?.lostChild.helped) drawAnimePatient(ctx, 600, 214, findPatientDesign(LOST_CHILD_DESIGN), { scale: 0.5, t });
    } else if (currentFloor === FLOOR_CAFE) {
      CAFE_DINERS.forEach((d, i) => drawAnimePerson(ctx, d.x, d.y + Math.sin(t * 1.4 + i) * 0.5, d.design(), { scale: 0.62, t }));
    }
  }

  /** A tray/cooler/shelf close-up: item cards, then the grab check for the chosen one. */
  function drawPickOverlay() {
    const def = SURGERY_SOURCES[overlay.source];
    const needed = surgeryItemsNeeded(shiftState);
    drawPanel(def.name, overlay.chosen
      ? 'Lift it carefully — stop the marker in the gold zone (click or Space).'
      : 'Pick what the surgery needs. Look-alikes are a mistake!');
    for (const r of pickCardRects()) {
      const wrong = overlay.wrong.includes(r.id);
      const held = SURGERY_ITEMS[r.id] && kitHas(r.id);
      const chosen = overlay.chosen === r.id;
      ctx.save();
      if (wrong || (overlay.chosen && !chosen)) ctx.globalAlpha = 0.4;
      animeTile(ctx, r.x, r.y, r.w, r.h, 16, chosen ? '#fff0b8' : '#ffffff');
      ctx.strokeStyle = chosen ? ANIME.goldDeep : ANIME.ink;
      ctx.lineWidth = chosen ? 3 : 2;
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 16);
      ctx.stroke();
      drawSurgeryItemIcon(ctx, r.x + r.w / 2, r.y + 50, 2.4, r.id);
      ctx.fillStyle = LABEL_TEXT_COLOR;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(SURGERY_ITEMS[r.id]?.name ?? r.id, r.x + r.w / 2, r.y + r.h - 16);
      if (held) drawLabelChip(ctx, r.x + r.w / 2, r.y + 12, 'In your kit', 'bold 10px sans-serif', ANIME.mintDeep, '#ffffff');
      else if (needed.has(r.id)) sparkle(ctx, r.x + r.w - 14, r.y + 14, 6, ANIME.gold);
      ctx.restore();
    }
    if (overlay.chosen) {
      const bar = skillBar();
      const zone = skillCheckSuccessZone('grab', skillZoneScaleNow());
      animeGauge(ctx, bar.x, bar.y, bar.w, bar.h, 0, ANIME.pink, ANIME.pinkDeep);
      const zx = bar.x + zone.start * bar.w;
      const zw = zone.width * bar.w;
      drawRoundRect(ctx, zx, bar.y + 1.5, zw, bar.h - 3, 4, ANIME.gold);
      sparkle(ctx, zx + zw / 2, bar.y + bar.h / 2, 6, '#ffffff');
      const mx = bar.x + overlay.gauge * bar.w;
      ctx.fillStyle = ANIME.pinkDeep;
      ctx.fillRect(mx - 1.5, bar.y - 2, 3, bar.h + 4);
      drawHeart(mx, bar.y - 11, 9, ANIME.pinkDeep);
    }
    drawFlash(406);
  }

  /** Mel's visit: her, in her kimono, holding out a hand-drawn card. */
  function drawMelOverlay() {
    const t = performance.now() / 1000;
    drawPanel('A visitor in a dandelion kimono', 'Mel cycled over with something for you');
    // Dandelion seeds drifting across the panel.
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeStyle = 'rgba(120,110,90,0.45)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 9; i++) {
      const sx = PANEL.x + 40 + ((i * 97 + t * 26) % (PANEL.w - 80));
      const sy = PANEL.y + 120 + ((i * 53) % 300) + Math.sin(t * 1.3 + i) * 10;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx, sy + 7);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(sx, sy, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    drawAnimePerson(ctx, 300, 500, STAFF_DESIGNS.mel, { scale: 3.3, t });

    // The card, tilted a touch, with her crayon drawing and note.
    ctx.save();
    ctx.translate(650, 280);
    ctx.rotate(-0.04);
    drawRoundRect(ctx, -150, -150, 300, 300, 10, '#fffdf6');
    ctx.strokeStyle = '#f2c230';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-142, -142, 284, 284, 8);
    ctx.stroke();
    // Crayon dandelion and a sun.
    ctx.strokeStyle = '#6f9a4a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-40, 10);
    ctx.quadraticCurveTo(-30, -30, -36, -70);
    ctx.stroke();
    ctx.fillStyle = '#f2c230';
    for (let k = 0; k < 14; k++) {
      const ang = (k / 14) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(-36 + Math.cos(ang) * 14, -84 + Math.sin(ang) * 14, 7, 4, ang, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#e0a81e';
    ctx.beginPath();
    ctx.arc(-36, -84, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f6b64a';
    ctx.lineWidth = 2;
    for (let k = 0; k < 8; k++) {
      const ang = (k / 8) * Math.PI * 2 + t * 0.3;
      ctx.beginPath();
      ctx.moveTo(70 + Math.cos(ang) * 20, -90 + Math.sin(ang) * 20);
      ctx.lineTo(70 + Math.cos(ang) * 28, -90 + Math.sin(ang) * 28);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffd86a';
    ctx.beginPath();
    ctx.arc(70, -90, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = LABEL_TEXT_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = 'italic 15px sans-serif';
    wrapText(overlay.line, 0, 42, 250, 21);
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('— Mel ✿', 70, 128);
    ctx.restore();

    ctx.fillStyle = 'rgba(58,42,42,0.75)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`+${MEL_GIFT_GARD}g · +${MEL_SANITY_RESTORE} Sanity · +${MEL_MOOD_RESTORE} Ward Mood`, 650, 450);
    animeButton(ctx, melButtonRect(), 'Thank you, Mel!', ANIME.gold, ANIME.goldDeep);
  }

  function drawCoffeePourOverlay() {
    const t = performance.now() / 1000;
    animeBackdrop(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, t);
    const cx = CANVAS_WIDTH / 2;
    animeWindow(ctx, { x: cx - 210, y: 104, w: 420, h: 406 }, {
      title: 'Pour a Coffee', subtitle: 'Hold mouse/tap or Space/Enter. Let go in the gold band.', t,
      accent: '#d9a27a', accentDeep: '#a8683e',
    });
    ctx.fillStyle = LABEL_TEXT_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    // Machine head + spout above the cup.
    drawRoundRect(ctx, cx - 70, 180, 140, 34, 8, '#7a5a42');
    drawRoundRect(ctx, cx - 24, 214, 48, 12, 3, '#b0a090');
    ctx.fillStyle = '#9fe0a8';
    ctx.fillRect(cx - 40, 190, 26, 8);
    ctx.fillStyle = overlay.pouring ? '#e06a5b' : '#e8b95a';
    ctx.beginPath();
    ctx.arc(cx + 44, 197, 6, 0, Math.PI * 2);
    ctx.fill();

    // Cup geometry: a slightly tapered mug, fill measured bottom -> brim.
    const cupTop = 268;
    const cupBottom = 450;
    const cupH = cupBottom - cupTop;
    const topHalfW = 78;
    const bottomHalfW = 64;
    const halfWAt = (y) => bottomHalfW + (topHalfW - bottomHalfW) * ((cupBottom - y) / cupH);
    const yForFill = (f) => cupBottom - f * cupH;

    // Stream while pouring.
    if (overlay.pouring) {
      ctx.fillStyle = '#6a4a30';
      const surfaceY = yForFill(overlay.fill);
      ctx.fillRect(cx - 3, 226, 6, surfaceY - 226);
    }

    // Saucer, mug body (cream), handle.
    drawRoundRect(ctx, cx - 110, cupBottom + 4, 220, 14, 7, '#e3d6c2');
    ctx.strokeStyle = '#fdf8ee';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(cx + topHalfW + 6, cupTop + 70, 30, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.fillStyle = '#fdf8ee';
    ctx.beginPath();
    ctx.moveTo(cx - topHalfW, cupTop);
    ctx.lineTo(cx + topHalfW, cupTop);
    ctx.lineTo(cx + bottomHalfW, cupBottom);
    ctx.quadraticCurveTo(cx, cupBottom + 10, cx - bottomHalfW, cupBottom);
    ctx.closePath();
    ctx.fill();

    // Coffee inside the cup, clipped to the mug's inner shape.
    ctx.save();
    ctx.beginPath();
    const inset = 8;
    ctx.moveTo(cx - topHalfW + inset, cupTop + 2);
    ctx.lineTo(cx + topHalfW - inset, cupTop + 2);
    ctx.lineTo(cx + bottomHalfW - inset, cupBottom - inset);
    ctx.lineTo(cx - bottomHalfW + inset, cupBottom - inset);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = '#efe4d2';
    ctx.fillRect(cx - topHalfW, cupTop, topHalfW * 2, cupH);
    const surfaceY = yForFill(overlay.fill);
    ctx.fillStyle = '#6a4a30';
    ctx.fillRect(cx - topHalfW, surfaceY, topHalfW * 2, cupBottom - surfaceY);
    ctx.fillStyle = '#c49a6c'; // crema on top
    ctx.fillRect(cx - topHalfW, surfaceY, topHalfW * 2, Math.min(6, cupBottom - surfaceY));

    // Target band.
    const bandTop = yForFill(overlay.band.high);
    const bandBottom = yForFill(overlay.band.low);
    ctx.fillStyle = 'rgba(242,217,138,0.45)';
    ctx.fillRect(cx - topHalfW, bandTop, topHalfW * 2, bandBottom - bandTop);
    ctx.strokeStyle = '#e0a83a';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    for (const y of [bandTop, bandBottom]) {
      ctx.beginPath();
      ctx.moveTo(cx - topHalfW, y);
      ctx.lineTo(cx + topHalfW, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();

    // Side markers so the band reads even when the coffee covers it.
    ctx.fillStyle = '#e0a83a';
    for (const dir of [-1, 1]) {
      const bx = cx + dir * (halfWAt(bandTop) + 12);
      ctx.beginPath();
      ctx.moveTo(bx - dir * 8, (bandTop + bandBottom) / 2);
      ctx.lineTo(bx, bandTop);
      ctx.lineTo(bx, bandBottom);
      ctx.closePath();
      ctx.fill();
    }

    // Spill: coffee sloshes over the rim and splashes out at you.
    if (overlay.grade === 'spilled') {
      ctx.fillStyle = '#6a4a30';
      for (const [sx, sy, r] of [[-40, -40, 9], [30, -55, 7], [-10, -70, 6], [55, -25, 5], [-62, -18, 5], [12, -88, 4]]) {
        ctx.beginPath();
        ctx.arc(cx + sx, cupTop + sy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#6a4a30';
      for (const [dx, len] of [[-topHalfW + 4, 30], [-topHalfW + 22, 16], [topHalfW - 10, 24]]) {
        drawRoundRect(ctx, cx + dx, cupTop - 2, 7, len, 3.5, '#6a4a30');
      }
      ctx.beginPath();
      ctx.ellipse(cx - 30, cupBottom + 12, 34, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Steam once it's done.
    if (overlay.grade && overlay.grade !== 'spilled') {
      ctx.strokeStyle = 'rgba(120,100,80,0.45)';
      ctx.lineWidth = 3;
      for (const dx of [-24, 0, 24]) {
        ctx.beginPath();
        ctx.moveTo(cx + dx, cupTop - 6);
        ctx.quadraticCurveTo(cx + dx - 8, cupTop - 18, cx + dx, cupTop - 30);
        ctx.quadraticCurveTo(cx + dx + 8, cupTop - 40, cx + dx, cupTop - 50);
        ctx.stroke();
      }
    }

    // Result banner.
    if (overlay.grade) {
      const label = { perfect: 'Perfect!', good: 'Good', sloppy: 'Sloppy', spilled: 'Spilled!' }[overlay.grade];
      const color = { perfect: '#e0a83a', good: '#7fb0d6', sloppy: '#a08a7a', spilled: '#e06a5b' }[overlay.grade];
      drawRoundRect(ctx, cx - 70, 474, 140, 30, 15, color);
      ctx.fillStyle = '#fdf8ee';
      ctx.font = 'bold 16px sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, cx, 489);
      ctx.textBaseline = 'alphabetic';
    }
  }

  function drawOverlay() {
    if (!overlay) return;
    ctx.save();
    if (overlay.kind === 'triage') drawTriageOverlay();
    else if (overlay.kind === 'skill') drawSkillOverlay();
    else if (overlay.kind === 'oxygen') drawOxygenOverlay();
    else if (overlay.kind === 'bandage') drawBandageOverlay();
    else if (overlay.kind === 'meds') drawMedsOverlay();
    else if (overlay.kind === 'karen') drawKarenOverlay();
    else if (overlay.kind === 'mel') drawMelOverlay();
    else if (overlay.kind === 'pick') drawPickOverlay();
    else if (overlay.kind === 'vending') drawVendingOverlay();
    else if (overlay.kind === 'lost-child') drawLostChildOverlay();
    else if (overlay.kind === 'cafe') drawCafeOverlay();
    else if (overlay.kind === 'coffee-pour') drawCoffeePourOverlay();
    ctx.restore();
  }

  /**
   * Keeps the canvas's backing store matched to its on-screen size × the
   * device pixel ratio (capped at 3×), so the art stays crisp when the
   * 960×600 world is shown larger, in fullscreen or on a Retina display.
   * The world coordinate system is unchanged — render() scales into it.
   */
  let backingScale = 1;
  function syncBackingStore() {
    const rect = canvas.getBoundingClientRect();
    const wanted = Math.min(3, Math.max(1, Math.round(((window.devicePixelRatio || 1) * rect.width / CANVAS_WIDTH) * 2) / 2));
    if (wanted !== backingScale || canvas.width !== CANVAS_WIDTH * wanted) {
      backingScale = wanted;
      canvas.width = CANVAS_WIDTH * wanted;
      canvas.height = CANVAS_HEIGHT * wanted;
    }
    ctx.setTransform(backingScale, 0, 0, backingScale, 0, 0);
  }

  function render() {
    syncBackingStore();
    lastFrameDrewPlayer = false;
    const intensity = currentIntensity();
    const shake = intensity > 0.6 ? (intensity - 0.6) * 5 : 0;
    ctx.save();
    if (shake > 0) ctx.translate((random() - 0.5) * shake, (random() - 0.5) * shake);
    drawFloor();
    visibleStations().forEach(drawStation);
    drawDecorOnFloor();
    if (wetFloor && currentFloor === FLOOR_1) drawWetFloor(ctx, wetFloor.x, wetFloor.y, WET_FLOOR_RADIUS, Math.min(1, wetFloor.seconds / 3));
    drawCrowds();
    drawHospitalCat();
    drawSecurityIncident();
    if (currentFloor === FLOOR_1) drawTriageQueue();
    drawAmbient();
    drawPlayer();
    drawHallucinations();
    ctx.restore();
    if (isDarkHere()) drawDarkness();
    if (shiftState && (shiftState.hunger < HUNGER_THIRST_LOW || shiftState.thirst < HUNGER_THIRST_LOW)) drawDiscomfortVignette();
    if (daily && shiftState) {
      drawLabelChip(ctx, CANVAS_WIDTH / 2, 588, `✦ Daily Challenge · ${daily.twist.name} ✦`, 'bold 11px sans-serif', ANIME.lavenderDeep, '#ffffff');
    }
    drawStatBar(14, 'Sanity', shiftState ? shiftState.sanity : SANITY_MAX, SANITY_MAX, [ANIME.mint, ANIME.mintDeep], sanityFontReady ? 'bold 11px "Caprasimo", sans-serif' : 'bold 11px sans-serif');
    drawStatBar(36, 'Mood', shiftState ? shiftState.wardMood : WARD_MOOD_MAX, WARD_MOOD_MAX, [ANIME.sky, ANIME.skyDeep], 'bold 10px sans-serif');
    const collapseIn = shiftState ? collapseSecondsRemaining(shiftState) : null;
    if (collapseIn != null && !overlay) {
      const pulse = 0.75 + 0.25 * Math.sin(performance.now() / 120);
      ctx.save();
      ctx.globalAlpha = pulse;
      drawLabelChip(ctx, CANVAS_WIDTH / 2, 80, `0% Sanity — you'll collapse in ${Math.ceil(collapseIn)}s! Get coffee!`, 'bold 13px sans-serif', '#d9534f', CREAM);
      ctx.restore();
    }
    const starving = shiftState ? hungerThirstCollapse(shiftState) : null;
    if (starving && !overlay) {
      ctx.save();
      ctx.globalAlpha = 0.75 + 0.25 * Math.sin(performance.now() / 120);
      const what = starving.stat === 'hunger' ? 'Hunger — eat something' : 'Thirst — drink something';
      drawLabelChip(ctx, CANVAS_WIDTH / 2, collapseIn != null ? 102 : 80, `0% ${what}! You'll collapse in ${Math.ceil(starving.seconds)}s!`, 'bold 13px sans-serif', '#d9534f', CREAM);
      ctx.restore();
    }
    drawRatingStars();
    drawHungerThirst();
    if (shiftState?.night) drawBatteryMeter();
    drawGardCounter();
    drawRankBar();
    drawOverlay();
  }

  // -- Game loop ---------------------------------------------------------------------------

  function loop(timestamp) {
    if (!running || paused) { rafHandle = null; return; }
    if (lastTimestamp === null) lastTimestamp = timestamp;
    const dt = Math.min(0.1, (timestamp - lastTimestamp) / 1000);
    lastTimestamp = timestamp;

    if (!overlay) updatePlayer(dt);
    melVaseWiggle = Math.max(0, melVaseWiggle - dt);

    const before = shiftState;
    shiftState = tick(shiftState, dt);
    if (shiftState.phase === 'game-over' && before.phase !== 'game-over') {
      showGameOver();
      return;
    }

    // A task overlay whose task the engine dropped (patient transferred, or
    // the clock ran out) closes with an explanation.
    if (overlay && TASK_OVERLAYS.has(overlay.kind) && !shiftState.activeTask && !(overlay.closeIn > 0)) {
      overlay = null;
      if (shiftState.phase === 'playing') showToast('Too late — the patient was transferred to another hospital.');
    }
    if (overlay && ['triage', 'coffee-pour', 'mel', 'pick', 'vending', 'cafe', 'lost-child'].includes(overlay.kind) && shiftState.phase !== 'playing') overlay = null;
    if (overlay?.kind === 'triage' && !shiftState.triageQueue.some((p) => p.id === overlay.patientId)) {
      overlay = null;
      showToast('They got tired of waiting and left.');
    }
    if (overlay?.kind === 'karen' && !shiftState.karen.active) {
      overlay = null;
      showToast('Karen shoves past you to the front of the line.');
    }

    // XP mostly changes in click/key handlers between frames, so check the
    // live rank every frame rather than diffing this tick.
    announceLiveRankUp();
    if (before.flashlight.on !== shiftState.flashlight.on) {
      updateFlashlightButton();
      if (!shiftState.flashlight.on) showToast('Your flashlight battery died! Grab a spare from the Supply Room or the vending machine.', 3.6);
    }
    // Getting uncomfortable: a heads-up the moment Hunger or Thirst dips under the line.
    for (const [stat, fix] of [['hunger', 'grab a snack'], ['thirst', 'grab a drink']]) {
      if (before[stat] >= HUNGER_THIRST_LOW && shiftState[stat] < HUNGER_THIRST_LOW) {
        const where = shiftState.night ? 'from the vending machine (the Cafeteria is closed tonight)' : 'or visit the Cafeteria';
        showToast(`You're getting uncomfortable — ${stat === 'hunger' ? 'hungry' : 'thirsty'}! ${fix[0].toUpperCase()}${fix.slice(1)} ${where}.`, 3.6);
      }
    }

    if (shiftState.transfers > before.transfers) {
      showToast(`A patient waited too long and was transferred out — mistake, −${RATING_PENALTY_PER_WALKOUT}★`);
    } else if (shiftState.walkouts > before.walkouts) {
      showToast(`Someone in the triage line gave up and left — −${RATING_PENALTY_PER_WALKOUT}★`);
    }
    if (before.phase === 'playing' && shiftState.phase === 'closing-wait') {
      showToast("7:00 PM — handover time. Head to the Charge Nurse's office.", 4);
    }

    trackGardPops(dt);
    updateAmbient(dt);
    updateExtras(dt);
    coffeeSplashSeconds = Math.max(0, coffeeSplashSeconds - dt);
    updateHallucinations(dt);

    if (waitingAtOffice && isOfficeReady(shiftState) && !overlay) {
      if (isPlayerAtOffice()) { enterOfficeNow(); return; }
      waitingAtOffice = false;
    }

    if (shiftState.phase === 'playing') processScheduledEvents();
    updateOverlay(dt);
    updateHoverHint();
    renderHud();
    render();
    rafHandle = window.requestAnimationFrame(loop);
  }

  // -- Fullscreen / visibility ----------------------------------------------------------------

  function requestFullscreen() {
    if (document.fullscreenElement) return;
    document.getElementById('hospital-game-container')?.requestFullscreen?.().catch(() => {});
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) requestFullscreen();
    else document.exitFullscreen?.().catch(() => {});
  }

  function onFullscreenChange() {
    elements.fullscreenButton.textContent = document.fullscreenElement ? 'Exit Fullscreen' : 'Fullscreen';
  }

  function onVisibilityChange() {
    paused = document.hidden;
    if (!paused && running && rafHandle === null) {
      lastTimestamp = null;
      rafHandle = window.requestAnimationFrame(loop);
    }
  }

  // -- Wiring ---------------------------------------------------------------------------------

  canvas.addEventListener('click', onCanvasClick);
  canvas.addEventListener('pointerdown', onCanvasPointerDown);
  canvas.addEventListener('pointermove', onCanvasPointerMove);
  canvas.addEventListener('mouseleave', onCanvasMouseLeave);
  window.addEventListener('pointerup', onWindowPointerUp);
  window.addEventListener('pointercancel', onWindowPointerUp);
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  document.addEventListener('visibilitychange', onVisibilityChange);
  document.addEventListener('fullscreenchange', onFullscreenChange);
  elements.fullscreenButton.addEventListener('click', toggleFullscreen);
  elements.flashlightButton?.addEventListener('click', flipFlashlight);
  elements.floorButton?.addEventListener('click', () => {
    if (currentFloor === FLOOR_OR) switchFloor(FLOOR_1, 'or-exit');
    else if (currentFloor === FLOOR_CAFE) switchFloor(FLOOR_1, 'cafe-exit');
    else switchFloor(currentFloor === FLOOR_1 ? FLOOR_2 : FLOOR_1, 'button');
  });
  elements.startScreen.shiftButton.addEventListener('click', startShift);
  elements.startScreen.daily?.button?.addEventListener('click', startDaily);
  elements.paycheckScreen.nextShiftButton.addEventListener('click', continueFromPaycheck);
  elements.paycheckScreen.backButton?.addEventListener('click', backToStart);
  elements.paycheckScreen.newMonthButton.addEventListener('click', startNewMonth);
  elements.paycheckScreen.submitButton?.addEventListener('click', () => {
    // Disabling a submit button synchronously in its own click handler
    // suppresses the form submit (the same bug the other games fixed).
    window.setTimeout(() => { elements.paycheckScreen.submitButton.disabled = true; }, 0);
  });
  // A rejected score (a 4xx — HTMX doesn't swap those) says why, under
  // the form, instead of failing silently: e.g. the anti-cheat's "that
  // score came in faster than those shifts can be played".
  elements.paycheckScreen.form?.addEventListener('htmx:responseError', (e) => {
    // Handled here: without this, nav-menu.js's page-wide error state
    // replaces all of #main-content (the game included) with "Couldn't
    // load this page".
    e.stopPropagation();
    const box = elements.paycheckScreen.submitError;
    if (!box) return;
    box.textContent = (e.detail?.xhr?.responseText || "Couldn't submit that score.").trim();
    box.classList.remove('hidden');
    if (elements.paycheckScreen.submitButton) elements.paycheckScreen.submitButton.disabled = false;
  });

  function teardown() {
    running = false;
    if (rafHandle !== null) {
      window.cancelAnimationFrame(rafHandle);
      rafHandle = null;
    }
    if (toastTimeoutHandle) window.clearTimeout(toastTimeoutHandle);
    canvas.removeEventListener('click', onCanvasClick);
    canvas.removeEventListener('pointerdown', onCanvasPointerDown);
    canvas.removeEventListener('pointermove', onCanvasPointerMove);
    canvas.removeEventListener('mouseleave', onCanvasMouseLeave);
    window.removeEventListener('pointerup', onWindowPointerUp);
    window.removeEventListener('pointercancel', onWindowPointerUp);
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    document.removeEventListener('fullscreenchange', onFullscreenChange);
    document.body.removeEventListener('htmx:beforeSwap', onBeforeSwap);
    if (teardownActiveInstance === teardown) teardownActiveInstance = null;
  }

  function onBeforeSwap(e) {
    if (e.target && e.target.id === 'main-content') teardown();
  }
  document.body.addEventListener('htmx:beforeSwap', onBeforeSwap);
  teardownActiveInstance = teardown;

  // Test-only hooks for e2e/hospital-shift.spec.js: the real shift clock is
  // 6–10 real minutes and spawns are random, so tests read exact positions
  // and force spawns here, then drive the same click/key paths a player uses.
  window.__hospitalShiftTestHooks = {
    getStations: () => stations.map((s) => ({ ...s })),
    getPlayerPosition: () => ({ ...player }),
    setPlayerPosition: (x, y) => { player = { x, y }; },
    isPlayerMoving: () => moveTarget !== null,
    getCurrentFloor: () => currentFloor,
    getStaff: () => ambient.map((a) => ({ key: a.key, x: a.x, y: a.y, floor: a.floor, errand: a.errand ? { ...a.errand } : null })),
    setDoctorCooldown(seconds) { if (shiftState) shiftState = { ...shiftState, doctorCooldownSeconds: seconds }; },
    setBedPatienceFraction(bedIndex, fraction) {
      if (!shiftState?.beds[bedIndex]) return;
      shiftState = { ...shiftState, beds: shiftState.beds.map((b, i) => (i === bedIndex ? { ...b, patienceRemainingSeconds: b.patienceMaxSeconds * fraction } : b)) };
    },
    bringStockTechDownNow() { const a = staff('stockTech'); if (a && a.floor === FLOOR_2) a.phaseSeconds = 0; },
    freezeStaff(key) { const a = staff(key); if (a) a.pause = 9999; },
    getShiftState: () => shiftState,
    getOverlay: () => (overlay ? JSON.parse(JSON.stringify(overlay)) : null),
    getTriageSlots: () => triageSlots(),
    getTriageButtonRects: () => triageButtonRects(),
    getMedsLayout: () => (overlay?.kind === 'meds' ? { bottles: medsBottleRects(), doses: medsDoseRects() } : null),
    getKarenButtonRects: () => karenButtonRects(),
    getMelButtonRect: () => melButtonRect(),
    getPickCardRects: () => pickCardRects(),
    getVendingCardRects: () => vendingCardRects(),
    getCafeButtonRect: () => cafeButtonRect(),
    setHunger(value) { if (shiftState) shiftState = { ...shiftState, hunger: value }; },
    setThirst(value) { if (shiftState) shiftState = { ...shiftState, thirst: value }; },
    setAim(x, y) { aim = { x, y }; },
    setFlashlightBattery(value) { if (shiftState) shiftState = { ...shiftState, flashlight: { ...shiftState.flashlight, battery: value } }; },
    getVendingBatteryRect: () => vendingBatteryRect(),
    bringLostChildNow() { if (shiftState) shiftState = lostChildArrives(shiftState); },
    getLostChildButtonRect: () => lostChildButtonRect(),
    getCat: () => (cat ? { ...cat } : null),
    spawnCatNow() { cat = { x: 380, y: 476, target: 0, pause: 999, dir: 1, cooldown: 0, hearts: 0 }; },
    getWetFloor: () => (wetFloor ? { ...wetFloor } : null),
    mopNow(x, y) { wetFloor = { x, y, seconds: WET_FLOOR_SECONDS }; },
    setPickGauge(pos) { if (overlay?.kind === 'pick') { overlay.gauge = pos; overlay.direction = 0; } },
    giveSurgeryKit(item) { if (shiftState) shiftState = { ...shiftState, surgeryKit: { scalpel: true, item } }; },
    getMelVaseRect: () => ({ ...MEL_VASE_RECT }),
    getCloseRect: () => ({ ...CLOSE_RECT }),
    getPatientInfo: (id) => patientInfo.get(id) ?? null,
    spawnPatientNow: (conditionId) => (shiftState?.phase === 'playing' ? spawnPatient(conditionId) : null),
    setSkillGauge(pos) { if (overlay?.kind === 'skill') { overlay.gauge = pos; overlay.direction = 0; } },
    setCoffeePourFill(fill) { if (overlay?.kind === 'coffee-pour' && !overlay.grade) overlay.fill = fill; },
    setSanity(value) { if (shiftState) shiftState = { ...shiftState, sanity: value }; },
    setZeroSanitySeconds(value) { if (shiftState) shiftState = { ...shiftState, zeroSanitySeconds: value }; },
    setRating(value) { if (shiftState) shiftState = { ...shiftState, rating: value }; },
    setWardMood(value) { if (shiftState) shiftState = { ...shiftState, wardMood: value }; },
    forceKarenShiftNow() {
      if (!shiftState) return;
      shiftState = { ...shiftState, karen: { ...shiftState.karen, shiftNumber: currentShiftNumber } };
      karenAvailable = true;
    },
    bringMelInNow: () => bringMelIn('code'),
    getDaily: () => (daily ? { date: daily.date, twist: daily.twist.id } : null),
    /** The shift's pre-rolled arrivals still to come (condition, look, name/age rolls). */
    getScheduledPatients: () => scheduledEvents.filter((e) => e.type === 'patient').map((e) => ({ at: e.at, ...e.spec })),
    /** Starts a Daily Challenge for any date (twists are date-driven). */
    startDailyFor(date) {
      daily = { date, twist: dailyTwistForDate(date) };
      beginShift();
    },
    getCareerXp: () => save.careerXp,
    /** Security: start an incident now ('rowdy'|'thief'), read it, or run its clock out. */
    startSecurityIncidentNow: (kind) => startIncident(kind),
    getSecurityIncident: () => (incident || shiftState?.security?.outcome
      ? { ...(incident ? { kind: incident.kind, x: incident.x, y: incident.y, phase: incident.phase } : {}), ...shiftState.security }
      : null),
    expireSecurityIncidentNow() {
      if (shiftState?.security?.incident) shiftState = { ...shiftState, security: { ...shiftState.security, secondsLeft: 0.01 } };
    },
    addShiftXp(amount) { if (shiftState) shiftState = { ...shiftState, xp: shiftState.xp + amount }; },
    spawnGhostNow() { halluc.ghosts.push({ id: `ghost-${halluc.ghostCounter++}`, age: 0, life: 60 }); },
    getHallucinations: () => ({ intensity: currentIntensity(), ghosts: halluc.ghosts.length }),
    wasPlayerDrawnLastFrame: () => lastFrameDrewPlayer,
    skipToClosing() {
      // Jump the clock to its last instant so only a tiny tick passes —
      // patience and Sanity don't drain by the whole remaining shift.
      if (!running || shiftState?.phase !== 'playing') return;
      shiftState = tick({ ...shiftState, clockSeconds: 0.001 }, 0.01);
      shiftState = { ...shiftState, closingWaitSecondsRemaining: 0 };
      overlay = null;
    },
  };

  showScreen('start');
  renderHud();
  renderMelBadge();
  renderRankCard();
  renderDailyCard();
  return teardown;
}

let teardownActiveInstance = null;

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

function bootstrap() {
  const canvas = document.getElementById('hospital-canvas');
  if (!canvas) return;
  const byId = (id) => document.getElementById(id);
  init(canvas, {
    hud: { shift: byId('hospital-hud-shift'), clock: byId('hospital-hud-clock'), status: byId('hospital-hud-status'), rank: byId('hospital-hud-rank') },
    hoverHint: byId('hospital-interact-hint'),
    toast: byId('hospital-toast'),
    fullscreenButton: byId('hospital-fullscreen-button'),
    floorButton: byId('hospital-floor-button'),
    flashlightButton: byId('hospital-flashlight-button'),
    startScreen: {
      root: byId('hospital-start-screen'),
      shiftButton: byId('hospital-start-shift-button'),
      melBadge: byId('hospital-mel-badge'),
      rank: { root: byId('hospital-rank-card'), title: byId('hospital-rank-title'), bar: byId('hospital-rank-bar'), next: byId('hospital-rank-next'), perks: byId('hospital-rank-perks') },
      daily: {
        root: byId('hospital-daily-card'),
        date: byId('hospital-daily-date'),
        twist: byId('hospital-daily-twist'),
        blurb: byId('hospital-daily-blurb'),
        best: byId('hospital-daily-best'),
        button: byId('hospital-daily-button'),
      },
    },
    paycheckScreen: {
      root: byId('hospital-paycheck-screen'),
      title: byId('hospital-paycheck-title'),
      outcome: byId('hospital-paycheck-outcome'),
      shiftTotal: byId('hospital-paycheck-shift-total'),
      monthTotal: byId('hospital-paycheck-month-total'),
      xp: byId('hospital-paycheck-xp'),
      rankUp: byId('hospital-paycheck-rankup'),
      monthLabel: byId('hospital-paycheck-month-label'),
      finalHeading: byId('hospital-final-paycheck-heading'),
      dailyInput: byId('hospital-paycheck-daily-input'),
      ticketInput: byId('hospital-paycheck-ticket-input'),
      submitError: byId('hospital-paycheck-submit-error'),
      form: byId('hospital-paycheck-form'),
      backButton: byId('hospital-paycheck-back-button'),
      finalBlock: byId('hospital-final-paycheck-block'),
      earningsInput: byId('hospital-paycheck-earnings-input'),
      shiftsInput: byId('hospital-paycheck-shifts-input'),
      submitButton: byId('hospital-paycheck-submit-button'),
      nextShiftButton: byId('hospital-paycheck-next-shift-button'),
      newMonthButton: byId('hospital-paycheck-new-month-button'),
    },
  });
}

if (typeof document !== 'undefined') {
  bootstrap();
  // A module's top level runs once per document, so an HTMX revisit
  // (navigate away and back) would leave a fresh but inert canvas — re-run
  // bootstrap on every #main-content swap (the fix every game here uses).
  document.body.addEventListener('htmx:afterSwap', (e) => {
    if (e.target && e.target.id === 'main-content') bootstrap();
  });
}
