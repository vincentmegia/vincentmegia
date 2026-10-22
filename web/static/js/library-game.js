// Library Shift canvas engine: rendering, input, station interaction,
// patron/book spawning, and localStorage progress persistence
// (docs/features/library-game.md). Mirrors Kitchen Shift's
// `cooking-game.js` architecture closely — same `bootstrap()`/`init()`
// split, same `requestAnimationFrame` loop, same click-to-move geometry
// (`canvasCoordsFromEvent`'s letterbox-aware coordinate mapping, ported
// verbatim — see that function's own comment below for why a naive version
// is a real, previously-shipped bug on that game), same Fullscreen
// handling, same htmx-revisit bootstrap fix. All shift-state transitions
// (Return Cart/fines/borrow-request queues, Karen's scripted event, the
// shift clock, closing-wait) are delegated to the pure `./library/
// engine-state.js` module; shift-tier/payout/skill-check/Karen-seed math to
// `./library/rules.js`; station-position/click-hit-testing/movement
// geometry to `./library/floor-plan.js`. This file owns everything HTMX
// cannot model: the render loop, canvas input, patron/book spawning
// pacing, the four minigame overlays (Shelf/Checkout Skill-Check share one
// timing-bar component; Coin Hunt/Fines Sort/Find the Book share one
// "scattered items on a scene" shape), and the single `localStorage`
// progress key.
//
// Two floors (doc's Scope): 1st Floor holds every non-shelf station (Front
// Desk, Return Cart, the Fines Counter, the Coffee Machine, Boss's Office)
// plus some Bookshelves; 2nd Floor holds only the remaining Bookshelves —
// purely additional shelving. Three independent, instant ways to switch
// floors (no ride/climb animation, allowed in every shift phase including
// 'closing-wait'): a Stairs station, a visually distinct Elevator station,
// and the `#library-floor-button` HUD shortcut — see `./library/
// floor-plan.js`'s header comment for the full reasoning.
//
// No DOM overlay elements exist for the five minigames (Shelf/Checkout
// Skill-Check, Coin Hunt, Fines Sort, Find the Book) — the backend's
// library-game.html template intentionally ships none (see its own header
// comment: "not this backend PR's [to build]"). Every minigame therefore
// renders as a full-canvas overlay drawn directly by this file's `render()`
// and reads input through the same canvas click/keydown listeners as normal
// movement, gated by the `overlay` variable — see `onCanvasClick`.
//
// External file, no inline <script> tag, per this codebase's CSP-compatible
// convention. Loaded as an ES module:
//
//   <script type="module" src="/static/js/library-game.js"></script>
//
// from web/templates/pages/library-game.html.

import { shadeColor } from './shared/people.js';
import {
  ANIME, DISPLAY_FONT, tint, sparkle, outlinedText, animeChip, animePlate, animeGauge, animeBadge, animeStar, animeTile, animeButton,
  animeBackdrop, animeWindow, speechBubble, sakuraBranch,
} from './hospital/anime-ui.js';
import { drawStairs, drawElevator, drawDecor } from './hospital/anime-furniture.js';
import { drawBookcase, drawFrontDesk, drawReturnCart, drawFinesRoom, drawBossDoor, drawReadingNook } from './library/anime-furniture.js';
import { drawMinjun } from './library/minjun.js';
import { drawDirectorSeo } from './library/director-seo.js';
import { drawJiho } from './library/jiho.js';
import { applyWalk, drawWalkProp } from './library/walk-styles.js';
import { findLibraryDesign, LIBRARY_PATRON_DESIGN_KEYS } from './library/library-people.js';
import { pickMinjunAction, MINJUN_ACTION_SECONDS } from './library/minjun-actions.js';
import { drawKimonoHimura } from './hospital/kimono-himura.js';
import { drawAnimePerson, findPatientDesign, PATIENT_DESIGN_KEYS, STAFF_DESIGNS } from './hospital/anime-people.js';
import {
  SHIFTS_PER_MONTH,
  shiftClockSecondsForShift,
  returnVolumeForShift,
  fineVolumeForShift,
  borrowVolumeForShift,
  inGameTimeLabel,
  karenShiftForSeed,
  KAREN_LINE,
  GENRES,
  findGenre,
  isCoinHuntBook,
  COIN_HUNT_ITEM_VALUE_GARD,
  COIN_HUNT_ITEMS_PER_BOOK,
  fineAmountForRoll,
  skillCheckSuccessZone,
  isSkillCheckSuccess,
  skillCheckSweepSpeed,
  borrowPatienceSeconds,
  LIBRARY_MOOD_MAX,
  SANITY_MAX,
  walkSpeedMultiplierForSanity,
  finesStartShiftForSeed,
  FIRST_BORROW_ARRIVAL_SECONDS,
  queueWaitSecondsForShift,
  RATING_MAX,
  RATING_PENALTY_PER_WALKOUT,
  paycheckMultiplierForRating,
  READING_MOOD_RESTORE,
  READING_CHOSEN_SANITY_RESTORE,
  hallucinationIntensity,
  shakyHandsZoneScale,
  shakyHandsSweepMultiplier,
  BOOK_DROP_CHANCE_PER_SECOND,
  HALLUCINATION_START_SANITY,
  hallucinationPayMultiplier,
  moodPayMultiplier,
  COMPLAINT_GARD,
  SHELVED_BOOK_TIP_GARD,
  UNSHELVED_BOOK_PENALTY_GARD,
  MESSY_CART_THRESHOLD,
  READING_PAGES,
  READING_SECONDS_PER_PAGE,
  TILL_DENOMINATIONS,
  tillCountResult,
  coffeePourTargetBand,
  gradeCoffeePour,
  COFFEE_POUR_SECONDS_TO_BRIM,
  COFFEE_PERFECT_TIP_GARD,
  DAILY_SHIFT_NUMBER,
  libraryDailyDate,
  dailySeed,
  seededRandom,
  dailyTwistForDate,
  dailyVolumes,
} from './library/rules.js';
import {
  createInitialState,
  startShift as startShiftState,
  addBookToCart,
  pickUpBook,
  arriveAtShelf,
  resolveShelfSkillCheck,
  resolveCoinHunt,
  addFineToQueue,
  arriveAtFinesCounter,
  resolveFinesSort,
  arriveAtFrontDeskWithFine,
  resolveTillCount,
  addBorrowRequest,
  acceptBorrowRequest,
  resolveFindTheBook,
  resolveCheckoutSkillCheck,
  startKarenEvent,
  resolveKarenEvent,
  tick,
  isBossOfficeReady,
  enterBossOffice,
  brewCoffee,
  canReadBook,
  finishReading,
  takeBookToRead,
  canMinjunHelp,
  minjunShelveCarriedBook,
  staffHelp,
  staffHelpBlocker,
  staffCooldownSeconds,
  dropCarriedBook,
  startleFromHallucination,
} from './library/engine-state.js';
import {
  buildStations,
  stationsOnFloor,
  stationAtPoint,
  stationExtents,
  approachPoint,
  clampToCanvas,
  entryPointForFloor,
  PLAYER_START,
  PLAYER_STOP_MARGIN,
  FLOOR_1,
  FLOOR_2,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from './library/floor-plan.js';
import { READING_STORIES, storyIndexForGenre } from './library/stories.js';
import { TITLE_POOLS, bookTitle, splitTitle, titlesForGenre, titleForGenre } from './library/book-titles.js';
import {
  defaultFacingTowardCenter,
  projectScene,
  findInteractTarget,
  turnFacing,
  stepForward,
  MOVE_SPEED_PIXELS_PER_SECOND,
} from './library/first-person.js';

// ---------------------------------------------------------------------------
// localStorage progress (doc's Data Model: "in-progress shift state, Gard,
// and shelf/book layout live in localStorage, not Postgres")
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'library-game:v1';

function defaultSave() {
  return {
    version: 1,
    monthToDateGard: 0,
    currentShift: 1,
    bestRunTotal: 0,
    // Karen's shift is randomInt(10,15) derived deterministically from this
    // seed (rules.js's karenShiftForSeed) so it stays stable across a page
    // reload mid-run, but re-rolls on "Start New Month" (doc's Business
    // Rules: "Karen shift").
    karenSeed: Date.now(),
  };
}

function probeStorageAvailable() {
  try {
    const probeKey = '\0library-game-probe';
    window.localStorage.setItem(probeKey, '1');
    window.localStorage.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
}

function isValidSaveShape(value) {
  if (!value || typeof value !== 'object') return false;
  if (value.version !== 1) return false;
  if (typeof value.monthToDateGard !== 'number' || !Number.isFinite(value.monthToDateGard)) return false;
  if (typeof value.currentShift !== 'number' || !Number.isFinite(value.currentShift)) return false;
  if (typeof value.bestRunTotal !== 'number' || !Number.isFinite(value.bestRunTotal)) return false;
  if (typeof value.karenSeed !== 'number' || !Number.isFinite(value.karenSeed)) return false;
  return true;
}

export function loadSave(storageAvailable) {
  if (!storageAvailable) return defaultSave();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    if (!isValidSaveShape(parsed)) return defaultSave();
    return {
      version: 1,
      monthToDateGard: Math.max(0, parsed.monthToDateGard),
      currentShift: Math.min(SHIFTS_PER_MONTH, Math.max(1, Math.round(parsed.currentShift))),
      bestRunTotal: Math.max(0, parsed.bestRunTotal),
      karenSeed: Math.round(parsed.karenSeed),
    };
  } catch {
    return defaultSave();
  }
}

/** This browser's best Daily Challenge paycheck, for one UTC date only. */
const DAILY_BEST_KEY = 'library-game:daily-best';

function loadDailyBest(storageAvailable, date) {
  if (!storageAvailable) return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DAILY_BEST_KEY) ?? 'null');
    return parsed && parsed.date === date && Number.isFinite(parsed.gard) ? parsed.gard : null;
  } catch {
    return null;
  }
}

function persistDailyBest(storageAvailable, date, gard) {
  if (!storageAvailable) return;
  try {
    window.localStorage.setItem(DAILY_BEST_KEY, JSON.stringify({ date, gard }));
  } catch {
    // Same posture as persistSave: keep playing, just stop remembering.
  }
}

function persistSave(storageAvailable, save) {
  if (!storageAvailable) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch {
    // Storage became unavailable mid-session — stays fully playable, just
    // silently stops persisting, same posture as Kitchen Shift's.
  }
}

// ---------------------------------------------------------------------------
// Drawing primitives (ported from cooking-game.js's own — no image assets
// anywhere on this site, canvas-primitives-only convention)
// ---------------------------------------------------------------------------

function drawRoundRect(ctx, x, y, w, h, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function drawStar(ctx, cx, cy, outerRadius, innerRadius, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const px = cx + Math.cos(angle) * radius;
    const py = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

const LABEL_TEXT_COLOR = ANIME.ink;

/** A name/label chip — Hospital Shift's anime nameplate (hospital/anime-ui.js's animeChip). */
function drawLabelChip(ctx, x, y, text, font, fill = null, ink = LABEL_TEXT_COLOR) {
  animeChip(ctx, x, y, text, font, fill, ink);
}

/** Truncates `text` (adding "…") to fit within `maxWidth` at `font`, measured via the same canvas context text will render in — used wherever a label chip's width must stay bounded (e.g. front-desk slots sitting only SLOT_PITCH apart) rather than auto-sizing to a title of arbitrary length. */
function truncateForChip(ctx, text, maxWidth, font) {
  ctx.save();
  ctx.font = font;
  if (ctx.measureText(text).width <= maxWidth) {
    ctx.restore();
    return text;
  }
  let truncated = text;
  while (truncated.length > 1 && ctx.measureText(`${truncated}…`).width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  ctx.restore();
  return `${truncated}…`;
}

// ---------------------------------------------------------------------------
// Characters — drawn in Hospital Shift's anime style: Eun-mi uses Kimono
// Himura's renderer (hospital/kimono-himura.js) with her own `coral` look —
// her own hair and glasses, and a Korean hanbok for this Korean library — and
// patrons, Karen and the staff use Hospital Shift's anime designs
// (hospital/anime-people.js).
// ---------------------------------------------------------------------------

/**
 * Everyone else's body scale — Hospital Shift's PERSON_SCALE. At 1.55 an
 * anime patron stands about as tall as Eun-mi at PLAYER_ART_SCALE 1.5
 * (~104px), so queued patrons, Security and the Volunteer all use it ("just
 * make all characters like her size"; patrons queued at 0.62 before).
 */
export const LIBRARY_PERSON_SCALE = 1.55;
/** About how tall (px) a character is at that size — for placing icons over queued patrons' heads. */
const PERSON_HEIGHT = 104;

/**
 * Eun-mi's draw scale: was Hospital Shift's PLAYER_ART_SCALE (1.12), drawn
 * bigger so her detail shows ("make her bigger in game to see the detail").
 */
const PLAYER_ART_SCALE = 1.5;
/** How much bigger she is than the 1.12 figure the coffee stains and carry badge were placed for. */
const PLAYER_SIZE_RATIO = PLAYER_ART_SCALE / 1.12;

/** Background staff (set dressing — Hospital Shift's ER has its own wandering staff); they can't be clicked. */
const AMBIENT_STAFF = [
  // Patrol loops, walked in order, that go around the furniture rather than
  // through it (random hops cut straight across the shelves).
  // (Routes redrawn for the second floor plan — floor-plan.js's
  // buildStations — keeping every walker clear of the furniture and queues.)
  { key: 'guard', name: 'Security', floor: FLOOR_1, waypoints: [[200, 560], [470, 562]] },
  { key: 'volunteer', name: 'Volunteer', floor: FLOOR_2, waypoints: [[380, 280], [590, 280], [590, 500], [380, 500]] },
  // Kang Min-jun (library/minjun.js), the student assistant, drawn bigger
  // than the others (the user: "make min-jun bigger", then "more bigger"
  // — 1.05× → 1.35× → 1.7×, then "a little smaller" → 1.55× → 1.4×, then
  // 1.3× to match Eun-mi's height with everyone else, then "make him bigger
  // in game" → 1.5× to show his detail), pacing the open aisle
  // right of the Reference Shelf, below the Stairs.
  { key: 'minjun', name: 'Min-jun · 민준', floor: FLOOR_2, scale: 1.5, waypoints: [[850, 290], [885, 340], [885, 480], [845, 535]] },
  // Four more staff ("make … 4 more staff", designs in library/library-
  // people.js): a janitor mopping by the Coffee Machine, a shelver
  // between the Front Desk's queue and the Stairs, a storyteller under the
  // Kids Shelf, and an archivist between the Reading Nook and the Stairs.
  { key: 'libJanitor', name: 'Janitor · 미화원', floor: FLOOR_1, waypoints: [[665, 555], [755, 556]] },
  { key: 'libShelver', name: 'Shelver · 정리 담당', floor: FLOOR_1, waypoints: [[680, 214], [760, 216]] },
  { key: 'libStoryteller', name: 'Storyteller · 동화 선생님', floor: FLOOR_2, waypoints: [[200, 505], [340, 510]] },
  { key: 'libArchivist', name: 'Archivist · 기록관', floor: FLOOR_2, waypoints: [[620, 200], [760, 210]] },
  // Han Ji-ho (한지호, library/jiho.js), a high-school student who studies
  // here and helps Eun-mi ("add another super detailed character a boy
  // again"): he paces a short stretch of the 1st Floor's lower aisle, between
  // Security's and the Janitor's routes, and
  // collects the first fine in line when asked.
  { key: 'jiho', name: 'Ji-ho · 지호', floor: FLOOR_1, scale: 1, waypoints: [[470, 548], [540, 550]] },
];
const AMBIENT_SPEED = 60;

/** Which anime design each non-patron character uses. */
const SPECIAL_DESIGNS = {
  karen: () => STAFF_DESIGNS.karen,
  guard: () => STAFF_DESIGNS.guard,
  volunteer: () => findPatientDesign('bookworm'),
};

/**
 * Every design a regular patron can have (not Karen, not the player):
 * Hospital Shift's patient designs plus Library Shift's own 19
 * (library/library-people.js).
 */
export const PATRON_PERSONALITY_KEYS = [...PATIENT_DESIGN_KEYS, ...LIBRARY_PATRON_DESIGN_KEYS];

/** The player character's name (v2.12) — shown on a name tag under the sprite. */
export const PLAYER_NAME = 'Eun-mi · 은미';

/**
 * Picks a patron's design from their id, so the same patron always looks
 * the same and different patrons spread across all designs.
 */
function personalityForId(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PATRON_PERSONALITY_KEYS[h % PATRON_PERSONALITY_KEYS.length];
}

/**
 * Draws a Library Shift character, feet at (x, y). `personalityKey` is
 * 'librarian' (Eun-mi, in her hanbok), 'karen', 'guard', 'volunteer', or a
 * patron's anime design key. `angryTint` is Karen's outburst; `stress`
 * (0..1) is the player's low-Sanity face; `walking` sways Eun-mi's step.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {{personalityKey?: string, scale?: number, angryTint?: boolean, stress?: number, walking?: boolean, action?: string|null, actionT?: number}} [opts]
 *   `action`/`actionT` are Min-jun's: what he's doing while stopped, and for how long.
 */
export function drawLibraryPerson(ctx, x, y, opts = {}) {
  const t = performance.now() / 1000;
  const scale = opts.scale ?? 1;
  if (opts.personalityKey === 'jiho') {
    drawJiho(ctx, x, y, { scale: scale * PLAYER_ART_SCALE, t, walking: Boolean(opts.walking) });
    return;
  }
  if (opts.personalityKey === 'libDirector') {
    drawDirectorSeo(ctx, x, y, { scale: scale * PLAYER_ART_SCALE, t, walking: Boolean(opts.walking) });
    return;
  }
  if (opts.personalityKey === 'minjun') {
    drawMinjun(ctx, x, y, { scale, t, walking: Boolean(opts.walking), action: opts.action ?? null, actionT: opts.actionT ?? 0 });
    return;
  }
  if (opts.personalityKey === 'librarian') {
    drawKimonoHimura(ctx, x, y, { scale: scale * PLAYER_ART_SCALE, stress: opts.stress ?? 0, t, walking: Boolean(opts.walking), cap: false, look: 'coral' });
    return;
  }
  const design = SPECIAL_DESIGNS[opts.personalityKey]?.() ?? findLibraryDesign(opts.personalityKey) ?? findPatientDesign(opts.personalityKey);
  drawAnimePerson(ctx, x, y, design, { scale, t, angryTint: Boolean(opts.angryTint) });
}

// ---------------------------------------------------------------------------
// Scattered-item scene helper (shared shape behind Coin Hunt / Fines Sort /
// Find the Book — doc: "same 'search the scene' shape")
// ---------------------------------------------------------------------------

const SCENE_X = [120, 840];
// v2.14: was [180, 480] — the top of that range overlapped each overlay's
// header line (a coin sat on the Coin Hunt title) and the bottom the
// "N / M found" counter at y=470.
const SCENE_Y = [205, 445];

/** Scatters `count` points inside the scene bounds with a minimum separation, retrying on overlap (bounded attempts, falls back to whatever fits). */
/**
 * Greedy word-wraps `title` into at most `maxLines` lines no wider than
 * `maxWidth`, stepping the font size down from `maxFont` to `minFont`
 * until it fits. Returns the font size + lines; if even `minFont` can't
 * fit, returns that size's best effort (callers clip to the book's rect).
 */
function fitTitleLines(ctx, title, maxWidth, maxLines, maxFont, minFont, bold = true) {
  const words = title.split(' ');
  let best = null;
  for (let size = maxFont; size >= minFont; size -= 0.5) {
    ctx.font = `${bold ? 'bold ' : ''}${size}px sans-serif`;
    const lines = [];
    let fits = true;
    for (const word of words) {
      if (ctx.measureText(word).width > maxWidth) fits = false;
      const candidate = lines.length ? `${lines[lines.length - 1]} ${word}` : word;
      if (lines.length && ctx.measureText(candidate).width <= maxWidth) lines[lines.length - 1] = candidate;
      else lines.push(word);
    }
    if (lines.length > maxLines) fits = false;
    best = { size, lines: lines.slice(0, maxLines) };
    if (fits) return best;
  }
  return best;
}

/** Cream text on dark covers, dark text on light ones. */
function titleInkFor(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 170 ? '#3a2a2a' : '#fdf8ee';
}

/**
 * Draws a book's full title centered on its front cover, wrapped and
 * shrunk to fit, clipped to the cover rect so it can never bleed into a
 * neighboring book (v1.4's original overflow bug).
 */
/**
 * A book's title on its cover: the Korean title large, its English
 * translation smaller underneath (library/book-titles.js); a title without
 * a translation fills the cover on its own.
 */
function drawCoverTitle(ctx, title, x, y, w, h, coverColor, opts = {}) {
  const pad = opts.pad ?? 2;
  const maxFont = opts.maxFont ?? 8;
  const minFont = opts.minFont ?? 5;
  const { ko, en } = splitTitle(title);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = titleInkFor(coverColor);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const block = (text, top, height, bold, maxLines, hi, lo) => {
    const { size, lines } = fitTitleLines(ctx, text, w - pad * 2, maxLines, hi, lo, bold);
    ctx.font = `${bold ? 'bold ' : ''}${size}px sans-serif`;
    const lineH = size * 1.15;
    const first = top + height / 2 - ((lines.length - 1) * lineH) / 2;
    lines.forEach((line, i) => ctx.fillText(line, x + w / 2, first + i * lineH));
  };
  if (en) {
    const split = h * 0.56;
    block(ko, y, split, true, 2, maxFont, minFont);
    ctx.globalAlpha = 0.85;
    block(en, y + split - 1, h - split, false, 2, Math.max(4, maxFont * 0.72), 4);
  } else {
    block(ko, y, h, true, opts.maxLines ?? 4, maxFont, minFont);
  }
  ctx.restore();
}

function scatterPoints(count, random, minDist = 70) {
  const points = [];
  for (let i = 0; i < count; i++) {
    let placed = null;
    for (let attempt = 0; attempt < 40; attempt++) {
      const candidate = {
        x: SCENE_X[0] + random() * (SCENE_X[1] - SCENE_X[0]),
        y: SCENE_Y[0] + random() * (SCENE_Y[1] - SCENE_Y[0]),
      };
      if (points.every((p) => Math.hypot(p.x - candidate.x, p.y - candidate.y) >= minDist)) {
        placed = candidate;
        break;
      }
      placed = candidate; // last attempt's candidate if every retry collided
    }
    points.push(placed);
  }
  return points;
}

// ---------------------------------------------------------------------------
// init()
// ---------------------------------------------------------------------------

/**
 * Wires up the canvas game loop against library-game.html's DOM elements.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object} elements
 * @returns {() => void} a teardown function (also auto-invoked on htmx nav-away).
 */
export function init(canvas, elements) {
  if (typeof teardownActiveInstance === 'function') teardownActiveInstance();

  const ctx = canvas.getContext('2d');
  const storageAvailable = probeStorageAvailable();
  let save = loadSave(storageAvailable);
  const random = Math.random;

  let ambient = [];
  // Test-only (window.__libraryGameTestHooks.freezeStaff): staff stop
  // walking, so an e2e test can click one where a read put them — under CPU
  // load several frames can pass between the read and the click.
  let testStaffFrozen = false;
  // Test-only (pauseScheduledEvents): holds back the shift's scheduled
  // returns/fines/borrows/Karen, so a random arrival can't reorder the
  // Front Desk line under a click or walk out during a test's fast-forward.
  let testEventsPaused = false;

  function resetAmbient() {
    const minjunOff = Boolean(daily?.twist.effect.noMinjun);
    ambient = AMBIENT_STAFF.filter((def) => !(minjunOff && def.key === 'minjun')).map((def, i) => {
      const [x, y] = def.waypoints[i % def.waypoints.length];
      return { ...def, x, y, target: (i + 1) % def.waypoints.length, pause: random() * 2, action: null, actionT: 0, lastAction: null, dir: 1, phase: i * 1.3 };
    });
  }

  function updateAmbient(dt) {
    if (testStaffFrozen) return;
    for (const a of ambient) {
      // A staff member stands still while Eun-mi is on her way to ask them.
      if (moveTarget?.staffKey === a.key && a.pause <= 0) {
        a.action = null;
        continue;
      }
      if (a.pause > 0) {
        a.pause -= dt;
        a.actionT += dt;
        if (a.pause <= 0) a.action = null;
        continue;
      }
      const [tx, ty] = a.waypoints[a.target];
      const dx = tx - a.x;
      const dy = ty - a.y;
      const dist = Math.hypot(dx, dy);
      const step = AMBIENT_SPEED * dt;
      if (dist <= step) {
        a.x = tx;
        a.y = ty;
        a.pause = 0.8 + random() * 2.2;
        a.target = (a.target + 1) % a.waypoints.length;
        if (a.key === 'minjun') {
          // Min-jun stops to do something: read, hum, or wave at Eun-mi when
          // she's nearby on his floor.
          const coralNear = currentFloor === a.floor && Math.hypot(player.x - a.x, player.y - a.y) < 260;
          a.action = pickMinjunAction({ coralNear, last: a.lastAction, random });
          a.lastAction = a.action;
          a.actionT = 0;
          a.pause = MINJUN_ACTION_SECONDS[a.action] * (0.85 + random() * 0.3);
        }
      } else {
        a.x += (dx / dist) * step;
        if (Math.abs(dx) > 0.5) a.dir = dx > 0 ? 1 : -1;
        a.y += (dy / dist) * step;
      }
    }
  }

  /**
   * What each staff member does when asked ("make staff help the plyer";
   * the rules are engine-state.js's staffHelp): the name chip's verb, what
   * they say when they help, and what they say when there's nothing to do.
   */
  const STAFF_HELP_TEXT = {
    guard: { verb: 'escort Karen out', done: 'Security walks Karen out — no scene, no mistake.', nothing: 'Security: "All quiet. Call me if anyone makes trouble at the desk."' },
    libShelver: { verb: 'shelve a return', done: (b) => `The Shelver shelves “${b}” from the Return Cart for you.`, nothing: 'Shelver: "The Return Cart is empty — nothing to shelve!"' },
    libJanitor: { verb: 'tidy up', done: 'The Janitor tidies up — the library feels calmer (+Mood).', nothing: 'Janitor: "Spotless already!"' },
    volunteer: { verb: 'coffee for you', done: 'The Volunteer brings you a coffee (+Sanity).', nothing: 'Volunteer: "You look wide awake — maybe later!"' },
    libArchivist: { verb: 'find the book', done: (b) => `The Archivist finds “${b}” — take it to the desk to check it out.`, nothing: 'Archivist: "Take a borrow request first, and I\'ll find the book."' },
    jiho: { verb: 'collect a fine', done: 'Ji-ho collects the fine for you — take it to the Front Desk till.', nothing: 'Ji-ho: "No fines waiting right now. Back to my vocab cards…"' },
    libStoryteller: { verb: 'story time', done: 'Story time! Everyone waiting calms down (+patience).', nothing: 'Storyteller: "No one is waiting right now."' },
  };

  /** Whether Karen has arrived in the Front Desk line and hasn't started yet (Security can walk her out). */
  function karenWaiting() {
    return Boolean(karenAvailable && shiftState && !shiftState.karen.triggered);
  }

  /**
   * A staff member's help hint for the small line under their name chip:
   * "click: …" when they can help, "busy Ns" on cooldown, else null.
   */
  function ambientHint(a) {
    if (!shiftState || shiftState.phase !== 'playing') return null;
    if (a.key === 'minjun') {
      if (!shiftState.carriedBook) return null;
      const wait = Math.ceil(shiftState.minjunCooldownSeconds ?? 0);
      return wait > 0 ? `busy ${wait}s` : 'click: shelve it';
    }
    const text = STAFF_HELP_TEXT[a.key];
    if (!text) return null;
    const blocker = staffHelpBlocker(shiftState, a.key, { karenWaiting: karenWaiting() });
    if (blocker === 'cooldown') return `busy ${Math.ceil(staffCooldownSeconds(shiftState, a.key))}s`;
    return blocker === null ? `click: ${text.verb}` : null;
  }

  /** The staff member on the current floor whose drawn figure (x, y) is on, if any. */
  function staffAtPoint(x, y) {
    for (const a of ambient) {
      if (a.floor !== currentFloor || (a.key !== 'minjun' && !STAFF_HELP_TEXT[a.key])) continue;
      const k = a.scale ?? LIBRARY_PERSON_SCALE;
      // Min-jun's renderer units (tote and books included) vs. the anime people's.
      const [hw, top] = a.key === 'minjun' ? [22 * k, 78 * k]
        : a.key === 'jiho' ? [18 * k * PLAYER_ART_SCALE, 72 * k * PLAYER_ART_SCALE]
        : [17 * k, 68 * k];
      if (Math.abs(x - a.x) <= hw && y <= a.y + 8 * k && y >= a.y - top) return a;
    }
    return null;
  }

  /** Eun-mi reached a staff member: they help if they can, or say why not. */
  function askStaffForHelp(key) {
    if (key === 'minjun') { askMinjunForHelp(); return; }
    if (!shiftState || shiftState.phase !== 'playing') return;
    const text = STAFF_HELP_TEXT[key];
    const ctx = { karenWaiting: karenWaiting() };
    const blocker = staffHelpBlocker(shiftState, key, ctx);
    if (blocker === 'cooldown') {
      showToast(`They're still busy — ask again in ${Math.ceil(staffCooldownSeconds(shiftState, key))}s.`);
      return;
    }
    if (blocker !== null) {
      showToast(text.nothing, 3);
      return;
    }
    const title = key === 'libShelver'
      ? shiftState.returnCart[0]?.title
      : bookCatalog.get(shiftState.activeBorrow?.bookId)?.title;
    shiftState = staffHelp(shiftState, key, ctx);
    showToast(typeof text.done === 'function' ? text.done(title ?? 'a book') : text.done, 3.5);
  }

  /** Eun-mi reached Min-jun: he takes the carried book and shelves it, if he can. */
  function askMinjunForHelp() {
    const mj = ambient.find((a) => a.key === 'minjun');
    if (!shiftState || shiftState.phase !== 'playing' || !mj) return;
    if (!shiftState.carriedBook) {
      showToast('Min-jun: "Bring me a book from the Return Cart and I\'ll shelve it for you!"');
      return;
    }
    if (!canMinjunHelp(shiftState)) {
      if (shiftState.minjunCooldownSeconds > 0) showToast(`Min-jun is still shelving the last one — ask again in ${Math.ceil(shiftState.minjunCooldownSeconds)}s.`);
      return;
    }
    const title = shiftState.carriedBook.title;
    const coins = shiftState.carriedBook.isCoinHunt;
    shiftState = minjunShelveCarriedBook(shiftState);
    mj.action = 'help';
    mj.lastAction = 'help';
    mj.actionT = 0;
    mj.pause = MINJUN_ACTION_SECONDS.help;
    showToast(`Min-jun: "제가 할게요!" — he shelves “${title}” for you. +${SHELVED_BOOK_TIP_GARD}g${coins ? ' (no time to hunt its coins)' : ''}`, 3.5);
  }

  /** `inFront` picks the staff drawn after the player (lower on screen), so people overlap back-to-front. */
  function drawAmbient(inFront) {
    for (const a of ambient) {
      if (a.floor !== currentFloor || (a.y > player.y) !== inFront) continue;
      // Each walker's own walk (library/walk-styles.js), about their feet.
      const walking = a.pause <= 0 && moveTarget?.staffKey !== a.key;
      const t = performance.now() / 1000 + a.phase;
      ctx.save();
      ctx.translate(a.x, a.y);
      applyWalk(ctx, a.key, t, a.dir, walking);
      drawLibraryPerson(ctx, 0, 0, { personalityKey: a.key, scale: a.scale ?? LIBRARY_PERSON_SCALE, walking, action: a.action, actionT: a.actionT });
      drawWalkProp(ctx, a.key, t, a.dir, walking);
      ctx.restore();
      drawLabelChip(ctx, a.x, a.y + 20, a.name, '9px sans-serif');
      const hint = ambientHint(a);
      if (hint) drawLabelChip(ctx, a.x, a.y + 34, hint, 'bold 8px sans-serif', hint.startsWith('busy') ? null : '#2f9a78', hint.startsWith('busy') ? undefined : '#ffffff');
    }
  }
  const world = { width: CANVAS_WIDTH, height: CANVAS_HEIGHT };

  let stations = buildStations(GENRES);
  let currentFloor = FLOOR_1;
  let player = { ...PLAYER_START };
  let moveTarget = null; // { x, y, station: station|null }
  let hoverStation = null;

  // First Person Mode (docs/features/library-game.md's Scope addition) —
  // a pure alternate camera+control scheme over the SAME player.x/y/floor,
  // not a separate game mode. `cameraMode` toggles which of render()'s two
  // branches draws and which input path (click-to-move vs. turn/move/
  // interact) is active; `playerFacing` only matters in First Person but is
  // tracked unconditionally so switching floors (which picks a fresh
  // "sensible facing angle" — see `switchFloor`) doesn't need special-casing.
  let cameraMode = 'top-down'; // 'top-down' | 'first-person'
  let playerFacing = 0;
  const heldFP = { turnLeft: false, turnRight: false, forward: false, back: false };
  // Recomputed once per frame by `updateFirstPersonScene` — the projected
  // station/patron/book billboards for the current frame, and whichever one
  // (if any) is centered near the crosshair within interact range. Read by
  // both `render()`'s First Person branch and `updateHoverHint()`/
  // `attemptInteract()`, so both act on the exact same frame's projection.
  let fpScene = { projected: [], interactTarget: null };

  let currentShiftNumber = save.currentShift;
  let karenShiftNumber = karenShiftForSeed(save.karenSeed);
  let finesStartShiftNumber = finesStartShiftForSeed(save.karenSeed);
  let karenAvailable = false; // true once her scheduled appearance time has passed this shift, until triggered

  let shiftState = null;
  let running = false;
  let paused = false;
  let lastTimestamp = null;
  let rafHandle = null;
  let toastTimeoutHandle = null;

  let scheduledEvents = [];
  // The Daily Challenge being played ({ date, twist }), or null for the
  // month run. While it's set, spawns draw from `spawnRandom`, a stream
  // seeded by the date, so everyone gets the same returns/fines/borrows.
  let daily = null;
  let spawnRandom = random;
  let bookIdCounter = 0;
  let fineIdCounter = 0;
  let borrowIdCounter = 0;
  const bookCatalog = new Map(); // bookId -> { genreId, title } — for borrow requests, whose engine-state shape only carries an opaque bookId.

  let overlay = null; // one of the five minigame overlays, or null
  let pendingFrontDeskAction = null; // { kind: 'fine'|'borrow'|'karen', id? } queued by clicking a front-desk slot, executed on arrival
  let pendingCartPickupId = null; // queued by clicking a Return Cart book, executed on arrival

  let sanityFontReady = false;
  document.fonts.ready.then(() => { sanityFontReady = true; }).catch(() => {});

  // -- Save / toast / screen helpers --------------------------------------

  function showToast(text, seconds = 2.5) {
    elements.toast.textContent = text;
    elements.toast.classList.remove('hidden');
    if (toastTimeoutHandle) window.clearTimeout(toastTimeoutHandle);
    toastTimeoutHandle = window.setTimeout(() => {
      elements.toast.classList.add('hidden');
    }, seconds * 1000);
  }

  function showScreen(name) {
    elements.startScreen.root.classList.toggle('hidden', name !== 'start');
    elements.paycheckScreen.root.classList.toggle('hidden', name !== 'paycheck');
  }

  function renderStartScreen() {
    if (elements.startProgress) {
      elements.startProgress.textContent = `Shift ${save.currentShift} of ${SHIFTS_PER_MONTH} · ${save.monthToDateGard} Gard this month`;
    }
    showScreen('start');
  }

  function renderHud() {
    elements.hud.shift.textContent = daily ? 'Daily' : `${currentShiftNumber}/${SHIFTS_PER_MONTH}`;
    if (!shiftState) {
      elements.hud.clock.textContent = '--:--';
      elements.hud.status.textContent = 'Quiet';
      return;
    }
    elements.hud.clock.textContent = inGameTimeLabel(shiftState.clockSeconds, shiftState.totalClockSeconds);
    if (shiftState.phase === 'closing-wait') {
      elements.hud.status.textContent = isBossOfficeReady(shiftState) ? 'Closing — boss is ready' : 'Closing up…';
    } else if (shiftState.phase === 'paycheck') {
      elements.hud.status.textContent = 'Shift complete';
    } else if (shiftState.libraryMood > 70) {
      elements.hud.status.textContent = 'Calm';
    } else if (shiftState.libraryMood > 30) {
      elements.hud.status.textContent = 'Tense';
    } else {
      elements.hud.status.textContent = 'Frustrated patrons';
    }
  }

  function updateFloorButton() {
    if (!elements.floorButton) return;
    const upstairs = currentFloor === FLOOR_2;
    elements.floorButton.textContent = upstairs ? 'Go Downstairs' : 'Go Upstairs';
    elements.floorButton.setAttribute('aria-pressed', String(upstairs));
  }

  const STATION_LABELS = {
    'front-desk': 'Front Desk',
    'return-cart': 'Return Cart',
    'fines-counter': 'Fines Counter',
    'coffee-machine': 'Coffee Machine',
    'boss-office': "Boss's Office",
    stairs: 'Stairs',
    elevator: 'Elevator',
    'reading-nook': 'Reading Nook',
    bookshelf: null, // resolved per-station via genreId below
  };

  function labelForStation(station) {
    if (station.kind === 'bookshelf') {
      const genre = findGenre(station.genreId);
      return genre ? `${genre.name} Shelf` : 'Bookshelf';
    }
    if (station.kind === 'reading-nook' && shiftState && shiftState.readingCooldownSeconds > 0) {
      return `Reading Nook (${Math.ceil(shiftState.readingCooldownSeconds)}s)`;
    }
    if (station.kind === 'boss-office' && shiftState && shiftState.phase === 'playing') {
      return "Boss's Office (locked)";
    }
    if (station.kind === 'boss-office' && shiftState && shiftState.phase === 'closing-wait' && !isBossOfficeReady(shiftState)) {
      return `Boss's Office (${Math.ceil(shiftState.closingWaitSecondsRemaining)}s)`;
    }
    return STATION_LABELS[station.kind] || '';
  }

  /** The station a First Person interact target ultimately maps to, for hint-text purposes — front-desk slots/Return Cart books read as their parent station's label, same text a Top-Down hover over that station box would show. */
  function labelForFPTarget(target) {
    if (target.entityKind === 'station') return labelForStation(target.ref);
    if (target.entityKind === 'frontDeskSlot') return labelForStation(stations.find((s) => s.kind === 'front-desk'));
    if (target.entityKind === 'finesSlot') return labelForStation(stations.find((s) => s.kind === 'fines-counter'));
    if (target.entityKind === 'returnCartBook') return labelForStation(stations.find((s) => s.kind === 'return-cart'));
    return '';
  }

  function updateHoverHint() {
    if (overlay || !running) {
      elements.hoverHint.classList.add('hidden');
      return;
    }
    if (cameraMode === 'first-person') {
      const target = fpScene.interactTarget;
      const label = target ? labelForFPTarget(target) : '';
      if (!label) {
        elements.hoverHint.classList.add('hidden');
        return;
      }
      elements.hoverHint.textContent = label;
      elements.hoverHint.classList.remove('hidden');
      return;
    }
    if (!hoverStation) {
      elements.hoverHint.classList.add('hidden');
      return;
    }
    elements.hoverHint.textContent = labelForStation(hoverStation);
    elements.hoverHint.classList.remove('hidden');
  }

  // -- Movement geometry ----------------------------------------------------

  // Letterbox-aware coordinate mapping — ported verbatim from
  // cooking-game.js's own `canvasCoordsFromEvent` (see that file's header
  // comment above this function for the full "its not working when i click
  // it" bug writeup this fixes): the canvas's CSS box (getBoundingClientRect)
  // isn't always 960:600, especially in fullscreen where app.css's
  // `:fullscreen` override lets #library-canvas-wrapper flex-fill whatever
  // space is under the HUD bar. object-fit: contain letterboxes the actual
  // rendered content inside that box; this computes the real content
  // rectangle and maps against that instead of the raw box.
  function canvasCoordsFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const worldAspect = world.width / world.height;
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
      x: ((e.clientX - rect.left - offsetX) / contentWidth) * world.width,
      y: ((e.clientY - rect.top - offsetY) / contentHeight) * world.height,
    };
  }

  /** Set when the player arrives at the Boss's Office during the closing wait; the loop lets them in once it ends, as long as they're still there. */
  let waitingAtBossOffice = false;

  function enterBossOfficeNow() {
    waitingAtBossOffice = false;
    shiftState = enterBossOffice(shiftState);
    // Director Seo's cutscene in his office, then the paycheck.
    overlay = { kind: 'boss-cutscene', t: 0, line: directorLine() };
  }

  // -- Director Seo's cutscene ("add a new detailed director": a young,
  // stylish man, seen in his office at clock-out). His office at night —
  // the city through a big window, a bookcase, a framed 감사장, his desk with
  // a lamp and nameplate. He walks over from his desk with his confident
  // stride (library/walk-styles.js), says a line about the shift and hands
  // Eun-mi the pay envelope; then the paycheck. A click (or
  // Space/Enter/Esc) skips it.
  const BOSS_CUTSCENE_SECONDS = 4.8;
  const DIRECTOR_FROM_X = 600;
  const DIRECTOR_TO_X = 420;
  const DIRECTOR_WALK = [0.4, 2.4]; // seconds he's walking

  function directorLine() {
    if (daily) return "Nice run on today's challenge, Eun-mi. Same time tomorrow?";
    if (currentShiftNumber >= SHIFTS_PER_MONTH) return 'Thirty shifts! Honestly, this place runs on you, Eun-mi.';
    if (shiftState.mistakeCount === 0 && shiftState.rating >= RATING_MAX) return 'Flawless shift, Eun-mi. The numbers look amazing.';
    if (shiftState.mistakeCount > 2 || shiftState.rating < 3) return "Tough day, huh? Get some rest — tomorrow's a fresh chapter.";
    return 'Good work today, Eun-mi. Here you go.';
  }

  function finishBossCutscene() {
    if (overlay?.kind !== 'boss-cutscene') return;
    overlay = null;
    endShift();
  }

  /** Whether the player is standing at the Boss's Office (within the normal arrival distance plus a little slack). */
  function isPlayerAtBossOffice() {
    const office = stations.find((st) => st.kind === 'boss-office');
    if (!office || currentFloor !== office.floor) return false;
    return Math.hypot(player.x - office.x, player.y - office.y) <= office.size / 2 + PLAYER_STOP_MARGIN + 30;
  }

  function commitStationTarget(station, rawPoint) {
    if (station?.kind !== 'boss-office') waitingAtBossOffice = false;
    if (station) {
      const { hw, hh } = stationExtents(station);
      const standoff = Math.max(hw, hh) + PLAYER_STOP_MARGIN;
      const approach = approachPoint(station.x, station.y, player.x, player.y, standoff);
      moveTarget = { x: approach.x, y: approach.y, station };
    } else if (rawPoint) {
      moveTarget = { x: rawPoint.x, y: rawPoint.y, station: null };
    }
  }

  function updatePlayer(deltaSeconds) {
    if (!moveTarget) return;
    if (moveTarget.staffKey) {
      // Walk up beside them (on whichever side Eun-mi's coming from).
      const staff = ambient.find((a) => a.key === moveTarget.staffKey);
      if (!staff || staff.floor !== currentFloor) { moveTarget = null; return; }
      const side = player.x < staff.x ? -1 : 1;
      moveTarget.x = staff.x + side * 46;
      moveTarget.y = staff.y;
    }
    const sanityMultiplier = walkSpeedMultiplierForSanity(shiftState ? shiftState.sanity : SANITY_MAX);
    const step = 240 * sanityMultiplier * deltaSeconds;
    const dx = moveTarget.x - player.x;
    const dy = moveTarget.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= step || dist === 0) {
      const clamped = clampToCanvas(moveTarget.x, moveTarget.y);
      player.x = clamped.x;
      player.y = clamped.y;
      const arrivedStation = moveTarget.station;
      const staffKey = moveTarget.staffKey;
      moveTarget = null;
      if (arrivedStation) handleArrival(arrivedStation);
      else if (staffKey) askStaffForHelp(staffKey);
    } else {
      const next = clampToCanvas(player.x + (dx / dist) * step, player.y + (dy / dist) * step);
      player.x = next.x;
      player.y = next.y;
    }
  }

  function switchFloor(floor) {
    currentFloor = floor;
    const entry = entryPointForFloor(floor);
    player.x = entry.x;
    player.y = entry.y;
    moveTarget = null;
    hoverStation = null;
    // "Picking a sensible default facing angle... is fine" (doc's Scope) —
    // face the new floor's room center rather than keeping whatever facing
    // happened to be current, same reasoning as `setCameraMode`'s own
    // default below. Harmless in Top-Down mode, which never reads facing.
    playerFacing = defaultFacingTowardCenter(entry.x, entry.y, CANVAS_WIDTH, CANVAS_HEIGHT);
    updateFloorButton();
  }

  // -- First Person Mode ------------------------------------------------------
  //
  // A pure alternate camera+control scheme over the same player.x/y/floor
  // (doc's Scope: "not a separate game mode with different rules"). Toggled
  // instantly by `#library-camera-button`; click-to-move doesn't apply here,
  // so it adds its own turn/move controls (keyboard + on-screen buttons) and
  // an "interact" action that calls the exact same `handleArrival` station
  // logic Top-Down's click-to-move already uses — see `attemptInteract`.

  function setCameraMode(mode) {
    if (cameraMode === mode) return;
    cameraMode = mode;
    if (mode === 'first-person') {
      playerFacing = defaultFacingTowardCenter(player.x, player.y, CANVAS_WIDTH, CANVAS_HEIGHT);
      hoverStation = null;
      moveTarget = null; // stop any in-flight Top-Down walk — First Person has its own movement
    } else {
      heldFP.turnLeft = false;
      heldFP.turnRight = false;
      heldFP.forward = false;
      heldFP.back = false;
      fpScene = { projected: [], interactTarget: null };
    }
    updateCameraButton();
    updateFPControlsVisibility();
  }

  function updateCameraButton() {
    if (!elements.cameraButton) return;
    const isFirstPerson = cameraMode === 'first-person';
    elements.cameraButton.textContent = isFirstPerson ? 'Top-Down View' : 'First Person';
    elements.cameraButton.setAttribute('aria-pressed', String(isFirstPerson));
  }

  function updateFPControlsVisibility() {
    if (!elements.fpControls?.root) return;
    elements.fpControls.root.classList.toggle('hidden', cameraMode !== 'first-person');
  }

  /** Builds this frame's First Person entity list: every station on the current floor, plus (1st Floor only, mirroring `drawFrontDeskSlots`/`drawReturnCartBooks`'s own floor gate) every front-desk patron slot and Return Cart book — the doc's "every station... and every visible patron on the current floor." */
  function buildFirstPersonEntities() {
    const entities = [];
    for (const station of stationsOnFloor(stations, currentFloor)) {
      entities.push({ id: station.id, x: station.x, y: station.y, entityKind: 'station', ref: station });
    }
    if (currentFloor === FLOOR_1) {
      frontDeskSlots().forEach((slot, i) => {
        entities.push({ id: `fd-${slot.id}`, x: slot.x, y: slot.y, entityKind: 'frontDeskSlot', ref: slot, slotIndex: i });
      });
      finesCounterSlots().forEach((slot, i) => {
        entities.push({ id: `fc-${slot.id}`, x: slot.x, y: slot.y, entityKind: 'finesSlot', ref: slot, slotIndex: i });
      });
      returnCartSlots().forEach((book) => {
        entities.push({ id: `cart-${book.id}`, x: book.x, y: book.y, entityKind: 'returnCartBook', ref: book });
      });
    }
    return entities;
  }

  /** Recomputes this frame's projection + interact target — called once per frame from `loop`, read by both `render()` and `updateHoverHint()`/`attemptInteract()` so all three act on the same frame's numbers. */
  function updateFirstPersonScene() {
    if (cameraMode !== 'first-person') {
      fpScene = { projected: [], interactTarget: null };
      return;
    }
    const projected = projectScene(
      { x: player.x, y: player.y, facing: playerFacing },
      buildFirstPersonEntities(),
      { canvasWidth: CANVAS_WIDTH },
    );
    fpScene = { projected, interactTarget: findInteractTarget(projected) };
  }

  function updateFirstPersonMovement(deltaSeconds) {
    if (cameraMode !== 'first-person') return;
    let turnDirection = 0;
    if (heldFP.turnLeft) turnDirection -= 1;
    if (heldFP.turnRight) turnDirection += 1;
    if (turnDirection !== 0) playerFacing = turnFacing(playerFacing, turnDirection, deltaSeconds);

    let moveDirection = 0;
    if (heldFP.forward) moveDirection += 1;
    if (heldFP.back) moveDirection -= 1;
    if (moveDirection !== 0) {
      const sanityMultiplier = walkSpeedMultiplierForSanity(shiftState ? shiftState.sanity : SANITY_MAX);
      const distance = MOVE_SPEED_PIXELS_PER_SECOND * sanityMultiplier * deltaSeconds;
      const next = stepForward(player.x, player.y, playerFacing, moveDirection, distance);
      const clamped = clampToCanvas(next.x, next.y);
      player.x = clamped.x;
      player.y = clamped.y;
    }
  }

  /**
   * First Person's "interact" action — the interact key/button, or a canvas
   * click while in First Person (doc: "a 'look at a station, then interact'
   * prompt... functionally equivalent to clicking that station in Top-Down
   * mode"). Deliberately calls into the SAME functions Top-Down's
   * click-to-move arrival already uses (`handleArrival`, and the same
   * pending-action queue variables `onCanvasClick` sets for a front-desk
   * slot/Return Cart book click) rather than duplicating any of that logic.
   */
  function attemptInteract() {
    if (!running || overlay || cameraMode !== 'first-person') return;
    const target = fpScene.interactTarget;
    if (!target) return;
    if (target.entityKind === 'frontDeskSlot') {
      const slot = target.ref;
      pendingFrontDeskAction = slot.kind === 'karen' ? { kind: 'karen' } : (slot.kind === 'borrow-active' ? null : { kind: slot.kind, id: slot.id });
      handleArrival(stations.find((s) => s.kind === 'front-desk'));
    } else if (target.entityKind === 'finesSlot') {
      handleArrival(stations.find((s) => s.kind === 'fines-counter'));
    } else if (target.entityKind === 'returnCartBook') {
      if (shiftState && !shiftState.carriedBook) {
        pendingCartPickupId = target.ref.id;
        handleArrival(stations.find((s) => s.kind === 'return-cart'));
      }
    } else if (target.entityKind === 'station') {
      handleArrival(target.ref);
    }
  }

  // -- Front Desk / Return Cart queue slots ---------------------------------

  const SLOT_VISIBLE_MAX = 3;
  /** Spacing between queued patrons — 46 until they were drawn full size. */
  const SLOT_PITCH = 60;
  /** How far below a station's box its patron queue stands — far enough that patrons' heads clear the station's label chip. */
  // Far enough below the Front Desk/Fines Counter that a full-size patron's
  // head clears the furniture and its name chip (72 was for the 0.62-scale
  // patrons).
  const QUEUE_SLOT_OFFSET_Y = 126;

  function frontDeskSlots() {
    if (!shiftState) return [];
    const slots = [];
    if (karenAvailable && !shiftState.karen.triggered) {
      slots.push({ kind: 'karen', id: 'karen' });
    }
    // The patron whose request you're fulfilling stays at the desk (with a
    // patience bar) instead of vanishing on accept — v2.7, user: "the
    // costermer dissapears and i didnt get the book".
    if (shiftState.activeBorrow) {
      const a = shiftState.activeBorrow;
      slots.push({
        kind: 'borrow-active', id: a.id, bookId: a.bookId, stage: a.stage,
        patienceFraction: a.patienceMaxSeconds > 0 ? a.patienceRemainingSeconds / a.patienceMaxSeconds : 1,
      });
    }
    shiftState.borrowQueue.slice(0, SLOT_VISIBLE_MAX).forEach((r) => slots.push({ kind: 'borrow', id: r.id, bookId: r.bookId, waitFraction: waitFractionOf(r) }));
    // v2.16 hallucinated patrons — not really there.
    halluc.ghosts.forEach((g) => slots.push({ kind: 'ghost', id: g.id }));
    return slots.map((slot, i) => {
      const desk = stations.find((s) => s.kind === 'front-desk');
      const totalWidth = (slots.length - 1) * SLOT_PITCH;
      return { ...slot, x: desk.x - totalWidth / 2 + i * SLOT_PITCH, y: desk.y + stationExtents(desk).hh + QUEUE_SLOT_OFFSET_Y };
    });
  }

  function frontDeskSlotAtPoint(x, y) {
    if (currentFloor !== FLOOR_1) return null;
    return frontDeskSlots().find((slot) => isPointOnQueuedPatron(slot, x, y)) || null;
  }

  /**
   * Hit-tests a queued patron's whole drawn body. Their slot (x, y) is
   * their *feet*; the old 26px radius around it missed clicks on the
   * head/torso entirely (user: "how do i take the book from the
   * costermer?????"). The box spans head-top to shoes and half the
   * SLOT_PITCH on each side, so neighbours never overlap.
   */
  /** A queued patron's remaining wait as 0..1, or null if they have no wait timer. */
  function waitFractionOf(entry) {
    return entry.waitMaxSeconds ? entry.waitRemainingSeconds / entry.waitMaxSeconds : null;
  }

  /** Patience bar under a patron's name chip (above their head it collided with the station's label), green -> amber -> red. */
  function drawPatienceBar(slot, fraction) {
    if (fraction == null) return;
    const f = Math.max(0, Math.min(1, fraction));
    const y = slot.y + 30;
    drawRoundRect(ctx, slot.x - 18, y, 36, 5, 2.5, 'rgba(58,42,42,0.25)');
    drawRoundRect(ctx, slot.x - 18, y, 36 * f, 5, 2.5, f > 0.5 ? '#7fd68a' : (f > 0.25 ? '#e0a83a' : '#e06a5b'));
  }

  function isPointOnQueuedPatron(slot, x, y) {
    return Math.abs(x - slot.x) <= SLOT_PITCH / 2 - 2 && y >= slot.y - PERSON_HEIGHT && y <= slot.y + 26;
  }

  /** Fine-paying patrons queue under the Fines Counter (v2.4), laid out the same way as the Front Desk's queue. */
  function finesCounterSlots() {
    if (!shiftState) return [];
    const counter = stations.find((s) => s.kind === 'fines-counter');
    const queue = shiftState.finesQueue.slice(0, SLOT_VISIBLE_MAX);
    const totalWidth = (queue.length - 1) * SLOT_PITCH;
    return queue.map((f, i) => ({
      kind: 'fine', id: f.id, amountGard: f.amountGard, waitFraction: waitFractionOf(f),
      x: counter.x - totalWidth / 2 + i * SLOT_PITCH,
      y: counter.y + stationExtents(counter).hh + QUEUE_SLOT_OFFSET_Y,
    }));
  }

  function finesCounterSlotAtPoint(x, y) {
    if (currentFloor !== FLOOR_1) return null;
    return finesCounterSlots().find((slot) => isPointOnQueuedPatron(slot, x, y)) || null;
  }

  function returnCartSlots() {
    if (!shiftState) return [];
    const cart = stations.find((s) => s.kind === 'return-cart');
    return shiftState.returnCart.slice(0, 5).map((book, i) => ({
      ...book,
      x: cart.x - 68 + (i % 5) * 34,
      y: cart.y + cart.size / 2 + 40, // clear of the cart's label chip
    }));
  }

  /** A Return Cart book's cover rect — 30x40, grown from 26x32 to fit full titles (34px slot pitch leaves a 4px gap). */
  function returnCartCoverRect(book) {
    return { x: book.x - 14, y: book.y - 16, w: 30, h: 40 };
  }

  function returnCartSlotAtPoint(x, y) {
    if (currentFloor !== FLOOR_1) return null;
    return returnCartSlots().find((book) => {
      const r = returnCartCoverRect(book);
      return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    }) || null;
  }

  // -- Patron/book spawn scheduling -----------------------------------------

  function scheduleShiftEvents() {
    const total = shiftState.totalClockSeconds;
    const events = [];
    const volumes = daily ? dailyVolumes(daily.twist) : null;
    const bookCount = volumes ? volumes.books : returnVolumeForShift(currentShiftNumber);
    const fineCount = volumes ? volumes.fines : fineVolumeForShift(currentShiftNumber, finesStartShiftNumber);
    const borrowCount = volumes ? volumes.borrows : borrowVolumeForShift(currentShiftNumber);
    const rnd = spawnRandom;
    for (let i = 0; i < bookCount; i++) events.push({ type: 'book', at: rnd() * total * 0.85 });
    for (let i = 0; i < fineCount; i++) events.push({ type: 'fine', at: rnd() * total * 0.85 });
    for (let i = 0; i < borrowCount; i++) {
      // The first borrow patron always shows up within the opening seconds.
      const [early, late] = FIRST_BORROW_ARRIVAL_SECONDS;
      const at = i === 0 ? early + rnd() * (late - early) : rnd() * total * 0.85;
      events.push({ type: 'borrow', at });
    }
    if (currentShiftNumber === karenShiftNumber) {
      events.push({ type: 'karen', at: total * 0.3 });
    }
    events.sort((a, b) => a.at - b.at);
    return events;
  }

  function spawnBook(forceCoinHunt) {
    const genre = GENRES[Math.floor(spawnRandom() * GENRES.length)];
    const isCoinHunt = forceCoinHunt ?? isCoinHuntBook(spawnRandom());
    // `title` is purely cosmetic (drawn on the Return Cart cover and the
    // Coin Hunt header — user feedback: "i dunno what book it is") — it
    // rides along on the plain object engine-state.js's addBookToCart/
    // pickUpBook store and pass through verbatim (they never touch fields
    // they don't know about), so no engine-state.js/rules.js change is
    // needed to carry it all the way to `carriedBook`.
    const title = titleForGenre(genre.id, spawnRandom);
    const book = { id: `book-${bookIdCounter++}`, genreId: genre.id, isCoinHunt, title };
    shiftState = addBookToCart(shiftState, book);
  }

  function spawnFine(forcedAmount) {
    const amountGard = Number.isFinite(forcedAmount) ? forcedAmount : fineAmountForRoll(spawnRandom());
    shiftState = addFineToQueue(shiftState, { id: `fine-${fineIdCounter++}`, amountGard, waitSeconds: queueWaitSecondsForShift(currentShiftNumber) });
  }

  function spawnBorrow() {
    const genre = GENRES[Math.floor(spawnRandom() * GENRES.length)];
    const bookId = `borrow-book-${borrowIdCounter++}`;
    const title = titleForGenre(genre.id, spawnRandom);
    bookCatalog.set(bookId, { genreId: genre.id, title });
    shiftState = addBorrowRequest(shiftState, {
      id: `borrow-${borrowIdCounter}`,
      bookId,
      patienceSeconds: borrowPatienceSeconds(currentShiftNumber),
      waitSeconds: queueWaitSecondsForShift(currentShiftNumber),
    });
  }

  function processScheduledEvents() {
    if (!shiftState || shiftState.phase !== 'playing' || testEventsPaused) return;
    const elapsed = shiftState.totalClockSeconds - shiftState.clockSeconds;
    while (scheduledEvents.length && scheduledEvents[0].at <= elapsed) {
      const event = scheduledEvents.shift();
      if (event.type === 'book') spawnBook();
      else if (event.type === 'fine') spawnFine();
      else if (event.type === 'borrow') spawnBorrow();
      else if (event.type === 'karen') karenAvailable = true;
    }
  }

  // -- Overlays: shared skill-check timing bar ------------------------------

  function openSkillCheckOverlay(context) {
    overlay = { kind: 'skill-check', context, gaugePosition: 0, direction: 1 };
  }

  function openCoinHuntOverlay() {
    const points = scatterPoints(COIN_HUNT_ITEMS_PER_BOOK, random, 90);
    overlay = {
      kind: 'coin-hunt',
      items: points.map((p, i) => ({ ...p, id: i, found: false, isBill: i % 2 === 1 })),
    };
  }

  const FINES_SORT_REAL_COUNT = 4;
  const FINES_SORT_DECOY_COUNT = 5;
  const DECOY_KINDS = ['paperclip', 'pen', 'button', 'key', 'stamp'];

  function openFinesSortOverlay() {
    const points = scatterPoints(FINES_SORT_REAL_COUNT + FINES_SORT_DECOY_COUNT, random, 70);
    const items = points.map((p, i) => {
      if (i < FINES_SORT_REAL_COUNT) return { ...p, id: i, found: false, real: true, isBill: i % 2 === 1 };
      return { ...p, id: i, found: false, real: false, decoyKind: DECOY_KINDS[(i - FINES_SORT_REAL_COUNT) % DECOY_KINDS.length] };
    });
    overlay = { kind: 'fines-sort', items };
  }

  const FIND_THE_BOOK_DECOY_COUNT = 5;

  function openFindTheBookOverlay(genreId, correctTitle) {
    const genre = findGenre(genreId);
    const points = scatterPoints(FIND_THE_BOOK_DECOY_COUNT + 1, random, 90);
    const correctIndex = Math.floor(random() * points.length);
    // Decoys draw *distinct* titles that never match the requested one —
    // previously each decoy rolled independently from a 5-title pool, so a
    // decoy could carry the very title being searched for (bug report: "when
    // i try to get the book the costermer borrowed i couldnt").
    const decoyTitles = titlesForGenre(genreId).filter((t) => t !== correctTitle);
    for (let i = decoyTitles.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [decoyTitles[i], decoyTitles[j]] = [decoyTitles[j], decoyTitles[i]];
    }
    let decoyIndex = 0;
    // Squeeze the scatter's y-range down so no book overlaps the
    // "Looking for" header line (y≈194).
    const items = points.map((p, i) => ({
      ...p,
      x: Math.min(828, Math.max(132, p.x)), // keep the wider covers inside the window
      y: 218 + ((p.y - SCENE_Y[0]) / (SCENE_Y[1] - SCENE_Y[0])) * (SCENE_Y[1] - 218),
      id: i,
      title: i === correctIndex ? correctTitle : (decoyTitles[decoyIndex++] ?? 'Untitled'),
      correct: i === correctIndex,
      color: genre ? genre.color : '#8a6a4a',
    }));
    overlay = { kind: 'find-the-book', items, genreId };
  }

  // -- Count the Till (v2.4): count a collected fine into the Front Desk till
  // Tap coin/bill denominations (or press 1-4) to add them, Undo (or
  // Backspace) to take the last one back. Reaching the exact amount banks
  // it; going over is a miscount: a mistake, and the count resets.

  function openTillCountOverlay() {
    overlay = { kind: 'till-count', target: shiftState.carriedFine.amountGard, added: [], flash: null };
  }

  function tillButtonRects() {
    const w = 104;
    const h = 64;
    const gap = 18;
    const startX = CANVAS_WIDTH / 2 - (TILL_DENOMINATIONS.length * w + (TILL_DENOMINATIONS.length - 1) * gap) / 2;
    const denominations = TILL_DENOMINATIONS.map((value, i) => ({ value, x: startX + i * (w + gap), y: 330, w, h }));
    return { denominations, undo: { x: CANVAS_WIDTH / 2 - 60, y: 420, w: 120, h: 36 } };
  }

  function tillTotal() {
    return overlay.added.reduce((sum, v) => sum + v, 0);
  }

  function addToTill(value) {
    overlay.added.push(value);
    const result = tillCountResult(tillTotal(), overlay.target);
    if (result === 'exact') {
      shiftState = resolveTillCount(shiftState, true);
      showToast(`Counted ${overlay.target} Gard into the till — fine banked!`);
      overlay = null;
    } else if (result === 'over') {
      shiftState = resolveTillCount(shiftState, false);
      showToast(`Miscounted (${tillTotal()} Gard) — start over.`);
      overlay.added = [];
      overlay.flash = { text: 'Over! Recount', seconds: 1 };
    }
  }

  function undoTill() {
    overlay.added.pop();
  }

  function handleTillCountClick(x, y) {
    const inside = (r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    const rects = tillButtonRects();
    const hit = rects.denominations.find(inside);
    if (hit) addToTill(hit.value);
    else if (inside(rects.undo)) undoTill();
  }

  /** The active borrow request's title, and where its shelf is (with "upstairs" for 2nd-floor genres). */
  function borrowTitle() {
    return bookCatalog.get(shiftState?.activeBorrow?.bookId)?.title ?? 'the book';
  }

  function borrowShelfLabel() {
    const entry = bookCatalog.get(shiftState?.activeBorrow?.bookId);
    const shelf = entry && stations.find((st) => st.kind === 'bookshelf' && st.genreId === entry.genreId);
    if (!shelf) return 'shelves';
    return `${labelForStation(shelf)}${shelf.floor === FLOOR_2 ? ' (upstairs)' : ''}`;
  }

  function openKarenOverlay() {
    overlay = { kind: 'karen' };
  }

  // -- Hallucinations (v2.16) -----------------------------------------------
  // Below HALLUCINATION_START_SANITY the library turns creepy, scaled by
  // rules.js's hallucinationIntensity: a pulsing vignette, shadow figures,
  // whispers, light flickers, screen shake, and at full intensity the odd
  // jump scare. Work suffers too: shaky hands (skill checks), dropped
  // books, and ghost patrons in the Front Desk line who aren't really
  // there (walking up to one costs Sanity). Coffee ends it.

  const WHISPERS = ['shhh…', 'overdue…', "they're watching", 'you missed one', 'turn around', 'quiet…', 'it was due yesterday', 'who left the lights on?'];
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

    if (i > 0.3 && random() < 0.35 * i * dt) {
      halluc.figures.push({ x: 80 + random() * (CANVAS_WIDTH - 160), y: 160 + random() * 380, age: 0, life: 0.8 + random() * 1.2 });
    }
    if (random() < 0.3 * i * dt) {
      halluc.whispers.push({
        text: WHISPERS[Math.floor(random() * WHISPERS.length)],
        x: 120 + random() * (CANVAS_WIDTH - 240), y: 140 + random() * 380, age: 0, life: 2.6,
      });
    }
    if (random() < 0.12 * i * dt) halluc.flicker = 0.18;
    if (i >= 1 && random() < 0.04 * dt) halluc.scare = 0.45;
    if (i >= 0.5 && halluc.ghosts.length === 0 && random() < 0.06 * i * dt) {
      halluc.ghosts.push({ id: `ghost-${halluc.ghostCounter++}`, age: 0, life: 15 });
    }

    // Dropped books: a carried book can slip back onto the cart.
    if (!overlay && shiftState.carriedBook && random() < BOOK_DROP_CHANCE_PER_SECOND * i * dt) {
      const before = shiftState;
      shiftState = dropCarriedBook(shiftState);
      if (shiftState !== before) showToast('Your hands shake — the book slips back onto the Return Cart.');
    }
  }

  function drawShadowFigure(fx, fy, alpha, scale = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#140c18';
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
      ctx.fillStyle = `rgba(110,40,90,${0.75 * fade})`;
      ctx.fillText(w.text, w.x + Math.sin(t * 2 + w.x) * 6, w.y - w.age * 8);
    }
    ctx.restore();

    // Pulsing vignette closing in.
    const pulse = 0.85 + 0.15 * Math.sin(t * 2.2);
    const v = ctx.createRadialGradient(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 90 + 170 * (1 - i), CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 560);
    v.addColorStop(0, 'rgba(25,0,35,0)');
    v.addColorStop(0.6, `rgba(25,0,35,${0.45 * i * pulse})`);
    v.addColorStop(1, `rgba(15,0,20,${0.9 * i * pulse})`);
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (halluc.flicker > 0) {
      ctx.fillStyle = 'rgba(10,0,15,0.55)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
    if (halluc.scare > 0) {
      ctx.fillStyle = `rgba(10,0,10,${0.6 * (halluc.scare / 0.45)})`;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      drawShadowFigure(CANVAS_WIDTH / 2, CANVAS_HEIGHT + 120, halluc.scare / 0.45, 4.2);
    }
  }

  // -- Reading (v2.10): turn the pages of a short book to restore Mood -----
  // Each page "reads" itself over READING_SECONDS_PER_PAGE (a bar fills);
  // click/tap or Space/Enter turns it once full. Turning early just nudges
  // you to finish the page. The last page turn finishes the book. The ×
  // button puts the book down early: no Mood, no cooldown.

  /** Takes a shelf's one readable book (stories.js's storyIndexForGenre) to read in the Reading Nook. */
  function takeShelfBookToRead(station) {
    if (shiftState.readingBook) {
      showToast(`You're already holding “${shiftState.readingBook.title}” — read it in the Reading Nook upstairs.`);
      return;
    }
    const storyIndex = storyIndexForGenre(station.genreId);
    if (storyIndex < 0) return;
    const story = READING_STORIES[storyIndex];
    const title = bookTitle({ ko: story.koTitle, en: story.title });
    shiftState = takeBookToRead(shiftState, { id: `read-${bookIdCounter++}`, genreId: station.genreId, title, storyIndex });
    const where = currentFloor === FLOOR_2 ? 'over in the corner' : 'upstairs';
    showToast(`You took “${title}” off the shelf — read it in the Reading Nook ${where}.`, 3.5);
  }

  /** Opens the reading overlay: the book Eun-mi brought if she has one, else a story off the nook's own side table. */
  function openReadingOverlay() {
    const held = shiftState?.readingBook;
    const storyIndex = held ? held.storyIndex : Math.floor(random() * READING_STORIES.length);
    overlay = {
      kind: 'reading',
      storyIndex,
      ownBook: Boolean(held),
      title: bookTitle({ ko: READING_STORIES[storyIndex].koTitle, en: READING_STORIES[storyIndex].title }),
      page: 0,
      progress: 0,
      nudge: 0,
    };
  }

  /** Back one spread (← key) to re-read; already-read spreads can be turned again at once. */
  function previousReadingPage() {
    if (overlay?.kind !== 'reading' || overlay.page === 0) return;
    overlay.page -= 1;
    overlay.progress = 1;
  }

  function turnReadingPage() {
    if (overlay?.kind !== 'reading') return;
    if (overlay.progress < 1) {
      overlay.nudge = 0.6;
      return;
    }
    overlay.page += 1;
    overlay.progress = 0;
    if (overlay.page >= READING_PAGES) {
      const before = shiftState;
      const own = before.readingBook;
      shiftState = finishReading(shiftState);
      overlay = null;
      if (shiftState !== before) {
        showToast(own
          ? `Finished “${own.title}” — +${READING_MOOD_RESTORE} Mood, +${READING_CHOSEN_SANITY_RESTORE} Sanity. It's on the Return Cart to reshelve.`
          : `What a lovely read — +${READING_MOOD_RESTORE} Mood.`, own ? 4 : 2.5);
      }
    }
  }

  function readingCloseRect() {
    return { x: CANVAS_WIDTH / 2 + 288, y: 104, w: 30, h: 30 };
  }

  function handleReadingClick(x, y) {
    const r = readingCloseRect();
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      overlay = null;
      return;
    }
    turnReadingPage();
  }

  // -- Coffee Pour (v2.2): hold to pour, release inside the gold band -------
  // Held input, unlike every other overlay's click: pointerdown on the
  // canvas or a Space/Enter keydown starts pouring, the matching
  // pointerup/keyup stops it and grades the pour (rules.js's
  // gradeCoffeePour). Reaching the brim spills and ends it automatically.
  // The result stays on screen for COFFEE_RESULT_SECONDS, then closes.

  const COFFEE_RESULT_SECONDS = 1.2;
  const COFFEE_RESULT_TEXT = {
    perfect: `Perfect pour! Fully refreshed, +${COFFEE_PERFECT_TIP_GARD} Gard tip.`,
    good: 'Nice cup — feeling better.',
    sloppy: 'A bit sloppy, but coffee is coffee.',
    spilled: 'Ow! Hot coffee all over you — −50 Sanity.',
  };

  // v2.19: after a spill, Eun-mi wears coffee stains for a few seconds.
  const COFFEE_SPLASH_SECONDS = 6;
  let coffeeSplashSeconds = 0;

  function drawCoffeeSplash() {
    if (coffeeSplashSeconds <= 0) return;
    const s = LIBRARY_PERSON_SCALE * PLAYER_SIZE_RATIO;
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

  function openCoffeePourOverlay() {
    overlay = { kind: 'coffee-pour', fill: 0, pouring: false, band: coffeePourTargetBand(random()), grade: null, closeIn: 0 };
  }

  function startCoffeePour() {
    if (overlay?.kind === 'coffee-pour' && !overlay.grade) overlay.pouring = true;
  }

  function stopCoffeePour() {
    // Only a release that follows a press grades the pour — the keyup of
    // the very Enter press that *opened* the overlay (First Person's
    // interact key) must not end it at 0%.
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

  function onCanvasPointerDown(e) {
    if (!running || overlay?.kind !== 'coffee-pour') return;
    e.preventDefault();
    startCoffeePour();
  }

  function onWindowPointerUp() {
    stopCoffeePour();
  }

  function updateOverlay(deltaSeconds) {
    if (!overlay) return;
    if (overlay.kind === 'boss-cutscene') {
      overlay.t += deltaSeconds;
      if (overlay.t >= BOSS_CUTSCENE_SECONDS) finishBossCutscene();
      return;
    }
    if (overlay.kind === 'reading') {
      overlay.progress = Math.min(1, overlay.progress + deltaSeconds / READING_SECONDS_PER_PAGE);
      overlay.nudge = Math.max(0, overlay.nudge - deltaSeconds);
      return;
    }
    if (overlay.kind === 'till-count') {
      if (overlay.flash) {
        overlay.flash.seconds -= deltaSeconds;
        if (overlay.flash.seconds <= 0) overlay.flash = null;
      }
      return;
    }
    if (overlay.kind === 'coffee-pour') {
      if (overlay.grade) {
        overlay.closeIn -= deltaSeconds;
        if (overlay.closeIn <= 0) overlay = null;
      } else if (overlay.pouring) {
        overlay.fill = Math.min(1, overlay.fill + deltaSeconds / COFFEE_POUR_SECONDS_TO_BRIM);
        if (overlay.fill >= 1) finishCoffeePour();
      }
      return;
    }
    if (overlay.kind === 'skill-check') {
      if (overlay.frozen) return; // test hook: held in place until the next click
      const speed = skillCheckSweepSpeed(currentShiftNumber) * shakyHandsSweepMultiplier(currentIntensity());
      overlay.gaugePosition += overlay.direction * speed * deltaSeconds;
      if (overlay.gaugePosition >= 1) { overlay.gaugePosition = 1; overlay.direction = -1; }
      else if (overlay.gaugePosition <= 0) { overlay.gaugePosition = 0; overlay.direction = 1; }
    }
  }

  // -- Arrival dispatch ------------------------------------------------------

  function handleArrival(station) {
    if (station.kind === 'stairs' || station.kind === 'elevator') {
      switchFloor(station.targetFloor);
      return;
    }
    if (!shiftState) return;

    if (station.kind === 'front-desk') {
      if (shiftState.activeBorrow?.stage === 'checkout') {
        openSkillCheckOverlay('checkout');
        return;
      }
      // A collected fine payment goes into the till first (Count the Till);
      // any queued desk action waits for the next visit.
      if (shiftState.carriedFine) {
        const before = shiftState;
        shiftState = arriveAtFrontDeskWithFine(shiftState);
        if (shiftState !== before) openTillCountOverlay();
        return;
      }
      if (pendingFrontDeskAction) {
        const action = pendingFrontDeskAction;
        pendingFrontDeskAction = null;
        if (action.kind === 'ghost') {
          halluc.ghosts = halluc.ghosts.filter((g) => g.id !== action.id);
          shiftState = startleFromHallucination(shiftState);
          showToast("…there's no one there. Your heart pounds.");
        } else if (action.kind === 'borrow') {
          const before = shiftState;
          shiftState = acceptBorrowRequest(shiftState, action.id);
          if (shiftState !== before) showToast(`Borrow request: “${borrowTitle()}” — find it on the ${borrowShelfLabel()}.`);
        } else if (action.kind === 'karen') {
          const before = shiftState;
          shiftState = startKarenEvent(shiftState);
          if (shiftState !== before) openKarenOverlay();
        }
      }
      return;
    }

    if (station.kind === 'return-cart') {
      // A clicked cover picks that book; clicking the cart itself picks the
      // next one in line (the user: "im not able to pick up the book" — the
      // cart is the obvious thing to click, but it used to do nothing).
      const id = pendingCartPickupId ?? shiftState.returnCart[0]?.id ?? null;
      pendingCartPickupId = null;
      if (id && !shiftState.carriedBook) {
        const before = shiftState;
        shiftState = pickUpBook(shiftState, id);
        if (shiftState !== before) showToast(`Picked up “${shiftState.carriedBook.title}” — take it to its shelf.`);
      } else if (!shiftState.carriedBook) {
        showToast('The Return Cart is empty.');
      }
      return;
    }

    if (station.kind === 'bookshelf') {
      if (shiftState.carriedBook) {
        const before = shiftState;
        shiftState = arriveAtShelf(shiftState, station.genreId);
        if (shiftState !== before) {
          if (shiftState.shelfCheck?.kind === 'coin-hunt') openCoinHuntOverlay();
          else openSkillCheckOverlay('shelf');
        } else {
          const genre = findGenre(station.genreId);
          showToast(`Wrong shelf — this book belongs on the ${genre ? genre.name : ''} shelf.`);
        }
      }
      if (shiftState.activeBorrow?.stage === 'searching' && !overlay) {
        const entry = bookCatalog.get(shiftState.activeBorrow.bookId);
        if (entry && entry.genreId === station.genreId) {
          openFindTheBookOverlay(station.genreId, entry.title);
        } else if (entry && !shiftState.carriedBook) {
          showToast(`Not here — “${entry.title}” is on the ${borrowShelfLabel()}.`);
        }
        return;
      }
      // Empty-handed (no return, no borrow search): take this shelf's
      // readable book to the Reading Nook ("take books and read it").
      if (!shiftState.carriedBook && !shiftState.carriedFine && !overlay) takeShelfBookToRead(station);
      return;
    }

    if (station.kind === 'fines-counter') {
      if (shiftState.carriedFine) {
        showToast("Take the payment you're holding to the Front Desk till first.");
        return;
      }
      const before = shiftState;
      shiftState = arriveAtFinesCounter(shiftState);
      if (shiftState !== before && shiftState.finesSortActive) openFinesSortOverlay();
      return;
    }

    if (station.kind === 'reading-nook') {
      if (shiftState.phase !== 'playing') return;
      if (!canReadBook(shiftState)) {
        showToast(`Still savoring the last book — ready in ${Math.ceil(shiftState.readingCooldownSeconds)}s.`);
        return;
      }
      openReadingOverlay();
      return;
    }

    if (station.kind === 'coffee-machine') {
      if (daily?.twist.effect.noCoffee) {
        showToast("Out of order today — no coffee this shift (Daily Challenge twist).");
        return;
      }
      if (shiftState.phase === 'playing') openCoffeePourOverlay();
      return;
    }

    if (station.kind === 'boss-office') {
      if (isBossOfficeReady(shiftState)) {
        enterBossOfficeNow();
      } else if (shiftState.phase === 'closing-wait') {
        // Wait right here: the loop lets you in the moment the wait ends.
        waitingAtBossOffice = true;
        showToast(`The boss is finishing up — wait here ${Math.ceil(shiftState.closingWaitSecondsRemaining)}s and you'll be let in.`);
      } else if (shiftState.phase === 'playing') {
        const left = Math.ceil(shiftState.clockSeconds);
        showToast(`The boss will let you in after closing — the shift ends in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}.`);
      }
    }
  }

  // -- Overlay input ----------------------------------------------------------

  function resolveSkillCheck() {
    overlay.frozen = false;
    const success = isSkillCheckSuccess(overlay.gaugePosition, skillCheckSuccessZone(shakyHandsZoneScale(currentIntensity())));
    if (overlay.context === 'shelf') {
      shiftState = resolveShelfSkillCheck(shiftState, success);
      showToast(success ? `Shelved! +${SHELVED_BOOK_TIP_GARD}g` : 'Missed the mark — try again.');
      if (success) overlay = null;
      else { overlay.gaugePosition = 0; overlay.direction = 1; } // immediate retry, still carrying the book
    } else {
      shiftState = resolveCheckoutSkillCheck(shiftState, success);
      showToast(success ? 'Checked out — thank you!' : 'Fumbled the checkout — try again.');
      if (success) overlay = null;
      else { overlay.gaugePosition = 0; overlay.direction = 1; }
    }
  }

  function handleCoinHuntClick(x, y) {
    const item = overlay.items.find((it) => !it.found && Math.hypot(it.x - x, it.y - y) <= 20);
    if (!item) return;
    item.found = true;
    if (overlay.items.every((it) => it.found)) {
      const total = overlay.items.length * COIN_HUNT_ITEM_VALUE_GARD;
      shiftState = resolveCoinHunt(shiftState, total);
      showToast(`Found every coin — +${total + SHELVED_BOOK_TIP_GARD} Gard (incl. the shelving tip)!`);
      overlay = null;
    }
  }

  function handleFinesSortClick(x, y) {
    const item = overlay.items.find((it) => !it.found && Math.hypot(it.x - x, it.y - y) <= 20);
    if (!item) return;
    item.found = true;
    if (!item.real) return; // decoy clutter — inert, no penalty (doc's Business Rules)
    const remainingReal = overlay.items.some((it) => it.real && !it.found);
    if (!remainingReal) {
      shiftState = resolveFinesSort(shiftState, true);
      showToast('Payment collected — count it into the Front Desk till.');
      overlay = null;
    }
  }

  /** A Find the Book cover's rect, centered on the item. */
  function findBookCoverRect(item) {
    return { x: item.x - 34, y: item.y - 24, w: 68, h: 48 };
  }

  function handleFindTheBookClick(x, y) {
    const item = overlay.items.find((it) => {
      const r = findBookCoverRect(it);
      return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    });
    if (!item) return;
    if (item.correct) {
      shiftState = resolveFindTheBook(shiftState, true);
      showToast('Found it! Bring it to the Front Desk to check it out.');
      overlay = null;
    } else {
      showToast('Not the one…');
    }
  }

  function handleKarenClick(x, y) {
    const buttons = karenButtonRects();
    if (x >= buttons.collect.x && x <= buttons.collect.x + buttons.collect.w
      && y >= buttons.collect.y && y <= buttons.collect.y + buttons.collect.h) {
      shiftState = resolveKarenEvent(shiftState, 'collectFine');
      showToast('Collected the overdue fine.');
      overlay = null;
    } else if (x >= buttons.slide.x && x <= buttons.slide.x + buttons.slide.w
      && y >= buttons.slide.y && y <= buttons.slide.y + buttons.slide.h) {
      shiftState = resolveKarenEvent(shiftState, 'letItSlide');
      showToast('Let it slide — the library will hear about this.');
      overlay = null;
    }
  }

  function karenButtonRects() {
    const w = 150;
    const h = 40;
    return {
      collect: { x: CANVAS_WIDTH / 2 - w - 10, y: 430, w, h },
      slide: { x: CANVAS_WIDTH / 2 + 10, y: 430, w, h },
    };
  }

  function onOverlayClick(x, y) {
    if (overlay.kind === 'skill-check') resolveSkillCheck();
    else if (overlay.kind === 'coin-hunt') handleCoinHuntClick(x, y);
    else if (overlay.kind === 'fines-sort') handleFinesSortClick(x, y);
    else if (overlay.kind === 'find-the-book') handleFindTheBookClick(x, y);
    else if (overlay.kind === 'karen') handleKarenClick(x, y);
    else if (overlay.kind === 'till-count') handleTillCountClick(x, y);
    else if (overlay.kind === 'reading') handleReadingClick(x, y);
    else if (overlay.kind === 'boss-cutscene') finishBossCutscene();
  }

  // -- Canvas input -----------------------------------------------------------

  function onCanvasClick(e) {
    if (!running) return;
    const { x, y } = canvasCoordsFromEvent(e);

    if (overlay) {
      onOverlayClick(x, y);
      return;
    }

    // Click-to-move doesn't apply in First Person (doc's Scope) — a canvas
    // click there is instead the same "interact" action as the interact
    // key/on-screen button, per that same section's "pressing the interact
    // key/clicking triggers the exact same station-arrival logic."
    if (cameraMode === 'first-person') {
      attemptInteract();
      return;
    }

    if (shiftState && shiftState.phase === 'playing') {
      const slot = frontDeskSlotAtPoint(x, y);
      if (slot) {
        if (slot.kind === 'karen') pendingFrontDeskAction = { kind: 'karen' };
        else if (slot.kind === 'borrow-active') pendingFrontDeskAction = null;
        else pendingFrontDeskAction = { kind: slot.kind, id: slot.id };
        const desk = stations.find((s) => s.kind === 'front-desk');
        commitStationTarget(desk, null);
        return;
      }

      const staff = staffAtPoint(x, y);
      if (staff) {
        waitingAtBossOffice = false;
        moveTarget = { x: player.x, y: player.y, station: null, staffKey: staff.key };
        return;
      }

      const finePatron = finesCounterSlotAtPoint(x, y);
      if (finePatron) {
        commitStationTarget(stations.find((s) => s.kind === 'fines-counter'), null);
        return;
      }

      if (!shiftState.carriedBook) {
        const book = returnCartSlotAtPoint(x, y);
        if (book) {
          pendingCartPickupId = book.id;
          const cart = stations.find((s) => s.kind === 'return-cart');
          commitStationTarget(cart, null);
          return;
        }
      }
    }

    const station = stationAtPoint(x, y, stationsOnFloor(stations, currentFloor));
    commitStationTarget(station, { x, y });
  }

  function onCanvasMouseMove(e) {
    if (overlay || cameraMode === 'first-person') { canvas.style.cursor = ''; return; }
    const { x, y } = canvasCoordsFromEvent(e);
    hoverStation = stationAtPoint(x, y, stationsOnFloor(stations, currentFloor));
    // A hand cursor over anything clickable (stations, queued patrons,
    // Return Cart books), so it's clear patrons can be clicked.
    const clickable = hoverStation || frontDeskSlotAtPoint(x, y) || finesCounterSlotAtPoint(x, y) || returnCartSlotAtPoint(x, y) || staffAtPoint(x, y);
    canvas.style.cursor = clickable ? 'pointer' : '';
  }

  function onCanvasMouseLeave() {
    hoverStation = null;
  }

  const FP_TURN_KEYS = { ArrowLeft: 'turnLeft', ArrowRight: 'turnRight' };
  const FP_MOVE_KEYS = { ArrowUp: 'forward', ArrowDown: 'back' };

  function onKeyDown(e) {
    if (overlay?.kind === 'boss-cutscene' && [' ', 'Enter', 'Escape'].includes(e.key)) {
      e.preventDefault();
      finishBossCutscene();
      return;
    }
    if (overlay?.kind === 'till-count') {
      const index = Number(e.key) - 1;
      if (Number.isInteger(index) && index >= 0 && index < TILL_DENOMINATIONS.length) {
        e.preventDefault();
        addToTill(TILL_DENOMINATIONS[index]);
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        undoTill();
        return;
      }
    }
    // Reading: ←/→ page back/forward.
    if (overlay?.kind === 'reading' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      e.preventDefault();
      if (!e.repeat) {
        if (e.key === 'ArrowRight') turnReadingPage();
        else previousReadingPage();
      }
      return;
    }
    if (overlay && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault();
      if (overlay.kind === 'coffee-pour') {
        if (!e.repeat) startCoffeePour();
        return;
      }
      if (overlay.kind === 'reading') {
        if (!e.repeat) turnReadingPage();
        return;
      }
      // Sample at the overlay's center — a keyboard-reachable equivalent to
      // clicking, satisfying this game's accessibility requirement for a
      // non-pointer alternative to the timing-bar minigame specifically
      // (the two "search the scene" minigames still need pointer precision,
      // same as Kitchen Shift's own click-only station interactions).
      if (overlay.kind === 'skill-check') resolveSkillCheck();
      return;
    }

    // First Person's own turn/move/interact keys (doc's Scope: "arrow keys
    // or on-screen buttons") — arrow keys are otherwise unused anywhere in
    // this game, so there's no conflict with the existing Enter/Space
    // handling above or below. Held (not one-shot): keydown sets the flag,
    // `onKeyUp` clears it, and `updateFirstPersonMovement` applies it every
    // frame for as long as it's held, same press-and-hold feel as the
    // on-screen buttons.
    if (cameraMode === 'first-person' && running && !overlay) {
      if (e.key in FP_TURN_KEYS || e.key in FP_MOVE_KEYS) {
        e.preventDefault();
        heldFP[FP_TURN_KEYS[e.key] ?? FP_MOVE_KEYS[e.key]] = true;
        return;
      }
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        attemptInteract();
        return;
      }
    }

    if (e.key !== 'Enter') return;
    if (overlay || !running || !hoverStation) return;
    e.preventDefault();
    commitStationTarget(hoverStation, null);
  }

  function onKeyUp(e) {
    if (e.key === ' ' || e.key === 'Enter') stopCoffeePour();
    if (e.key in FP_TURN_KEYS) heldFP[FP_TURN_KEYS[e.key]] = false;
    else if (e.key in FP_MOVE_KEYS) heldFP[FP_MOVE_KEYS[e.key]] = false;
  }

  // -- Shift lifecycle ----------------------------------------------------

  function beginShift() {
    waitingAtBossOffice = false;
    coffeeSplashSeconds = 0;
    resetHallucinations();
    lastSeenBonusGard = 0;
    gardPops = [];
    if (daily) {
      currentShiftNumber = DAILY_SHIFT_NUMBER;
      karenShiftNumber = daily.twist.effect.karen ? DAILY_SHIFT_NUMBER : -1;
      finesStartShiftNumber = 1;
      spawnRandom = seededRandom(dailySeed(daily.date));
      // Same ids every attempt, so patrons look the same too (their designs
      // are hashed from their ids).
      bookIdCounter = 0;
      fineIdCounter = 0;
      borrowIdCounter = 0;
    } else {
      currentShiftNumber = save.currentShift;
      karenShiftNumber = karenShiftForSeed(save.karenSeed);
      finesStartShiftNumber = finesStartShiftForSeed(save.karenSeed);
      spawnRandom = random;
    }
    shiftState = startShiftState(createInitialState(currentShiftNumber, karenShiftNumber));
    player = { ...PLAYER_START };
    resetAmbient();
    playerFacing = defaultFacingTowardCenter(player.x, player.y, CANVAS_WIDTH, CANVAS_HEIGHT);
    heldFP.turnLeft = false;
    heldFP.turnRight = false;
    heldFP.forward = false;
    heldFP.back = false;
    currentFloor = FLOOR_1;
    updateFloorButton();
    moveTarget = null;
    overlay = null;
    pendingFrontDeskAction = null;
    pendingCartPickupId = null;
    karenAvailable = false;
    bookCatalog.clear();
    scheduledEvents = scheduleShiftEvents();
    lastTimestamp = null;
    running = true;
    paused = false;
    showScreen(null);
    renderHud();
    if (rafHandle === null) rafHandle = window.requestAnimationFrame(loop);
  }

  function startShift() {
    daily = null;
    requestFullscreen();
    beginShift();
  }

  /** Plays today's Daily Challenge (the same seeded shift and twist for everyone). */
  function startDailyChallenge() {
    const date = libraryDailyDate();
    daily = { date, twist: dailyTwistForDate(date) };
    requestFullscreen();
    beginShift();
  }

  /** Fills the start screen's Daily Challenge card with today's date, twist and best. */
  function renderDailyCard() {
    const card = elements.dailyCard;
    if (!card?.root) return;
    const date = libraryDailyDate();
    const twist = dailyTwistForDate(date);
    const best = loadDailyBest(storageAvailable, date);
    card.date.textContent = date;
    card.twist.textContent = twist.name;
    card.blurb.textContent = twist.blurb;
    card.best.textContent = best === null ? 'No run yet today.' : `Your best today: ${best} Gard`;
  }

  /** Leaves the Daily Challenge for the start screen (the month run is untouched). */
  function backToStart() {
    daily = null;
    shiftState = null;
    currentShiftNumber = save.currentShift;
    renderHud();
    renderDailyCard();
    renderStartScreen();
  }

  function endShift() {
    running = false;
    if (rafHandle !== null) {
      window.cancelAnimationFrame(rafHandle);
      rafHandle = null;
    }

    const payout = shiftState.payout ?? 0;
    if (daily) {
      endDailyShift(payout);
      return;
    }
    resetPaycheckForMonthRun();
    save.monthToDateGard += payout;
    const isFinalShift = currentShiftNumber >= SHIFTS_PER_MONTH;
    if (isFinalShift) {
      save.bestRunTotal = Math.max(save.bestRunTotal, save.monthToDateGard);
    } else {
      save.currentShift = currentShiftNumber + 1;
    }
    persistSave(storageAvailable, save);

    elements.paycheckScreen.root.dataset.outcome = shiftState.mistakeCount > 0 ? 'upset' : 'ok';
    elements.paycheckScreen.root.dataset.final = isFinalShift ? 'true' : 'false';
    elements.paycheckScreen.title.textContent = isFinalShift ? 'Final Paycheck' : 'Closing up';
    // v2.9: the star rating scales the payout — say so on the paycheck.
    elements.paycheckScreen.outcome.textContent = paycheckOutcomeText();
    elements.paycheckScreen.shiftTotal.textContent = `${payout} Gard`;
    elements.paycheckScreen.monthTotal.textContent = `${save.monthToDateGard} Gard`;
    elements.paycheckScreen.nextShiftButton.classList.toggle('hidden', isFinalShift);
    elements.paycheckScreen.newMonthButton.classList.toggle('hidden', !isFinalShift);
    elements.paycheckScreen.finalBlock.classList.toggle('hidden', !isFinalShift);
    if (isFinalShift) {
      if (elements.paycheckScreen.earningsInput) elements.paycheckScreen.earningsInput.value = String(save.monthToDateGard);
      if (elements.paycheckScreen.shiftsInput) elements.paycheckScreen.shiftsInput.value = String(SHIFTS_PER_MONTH);
      if (elements.paycheckScreen.submitButton) elements.paycheckScreen.submitButton.disabled = false;
    }

    renderHud();
    showScreen('paycheck');
  }

  /** The paycheck's outcome line: mistakes, rating and every pay cut. */
  function paycheckOutcomeText() {
    const mistakesText = shiftState.mistakeCount > 0
      ? `${shiftState.mistakeCount} mistake${shiftState.mistakeCount === 1 ? '' : 's'} this shift`
      : 'Went well';
    const payPercent = Math.round(paycheckMultiplierForRating(shiftState.rating) * 100);
    const hallucinationCut = Math.round((1 - hallucinationPayMultiplier(shiftState.zeroSanitySeconds)) * 100);
    const moodCut = Math.round((1 - moodPayMultiplier(shiftState.zeroMoodSeconds)) * 100);
    return `${mistakesText} · ${shiftState.rating}★ rating (${payPercent}% pay)`
      + (hallucinationCut > 0 ? ` · −${hallucinationCut}% for hallucinating` : '')
      + (moodCut > 0 ? ` · −${moodCut}% for a frustrated library` : '')
      + ((shiftState.unshelvedAtClose ?? 0) > 0 ? ` · ${shiftState.unshelvedAtClose} book${shiftState.unshelvedAtClose === 1 ? '' : 's'} left unshelved (−${shiftState.unshelvedAtClose * UNSHELVED_BOOK_PENALTY_GARD}g)` : '')
      + ((shiftState.complaints ?? 0) > 0 ? ` · ${shiftState.complaints} complaint letter${shiftState.complaints === 1 ? '' : 's'} (−${shiftState.complaints * COMPLAINT_GARD}g)` : '');
  }

  /** Puts back the month run's paycheck labels and buttons after a Daily Challenge. */
  function resetPaycheckForMonthRun() {
    const ps = elements.paycheckScreen;
    ps.root.dataset.daily = 'false';
    if (ps.monthLabel) ps.monthLabel.textContent = 'Run total';
    if (ps.finalHeading) ps.finalHeading.textContent = 'Final Paycheck';
    if (ps.dailyInput) ps.dailyInput.value = '';
    ps.nextShiftButton.textContent = 'Start Next Shift';
    ps.backButton?.classList.add('hidden');
  }

  /**
   * A Daily Challenge shift is over: its paycheck is the score. Nothing in
   * the month run's save changes; this browser's best for the day does.
   */
  function endDailyShift(payout) {
    const ps = elements.paycheckScreen;
    const prevBest = loadDailyBest(storageAvailable, daily.date);
    const best = Math.max(prevBest ?? 0, payout);
    persistDailyBest(storageAvailable, daily.date, best);
    ps.root.dataset.outcome = shiftState.mistakeCount > 0 ? 'upset' : 'ok';
    ps.root.dataset.final = 'false';
    ps.root.dataset.daily = 'true';
    ps.title.textContent = 'Daily Challenge';
    ps.outcome.textContent = `${daily.twist.name} · ${paycheckOutcomeText()}`;
    ps.shiftTotal.textContent = `${payout} Gard`;
    if (ps.monthLabel) ps.monthLabel.textContent = "Today's best";
    ps.monthTotal.textContent = `${best} Gard`;
    if (ps.finalHeading) ps.finalHeading.textContent = `Submit today's score (${daily.date})`;
    ps.finalBlock.classList.remove('hidden');
    if (ps.earningsInput) ps.earningsInput.value = String(payout);
    if (ps.shiftsInput) ps.shiftsInput.value = '1';
    if (ps.dailyInput) ps.dailyInput.value = daily.date;
    if (ps.submitButton) ps.submitButton.disabled = false;
    ps.nextShiftButton.textContent = 'Try Again';
    ps.nextShiftButton.classList.remove('hidden');
    ps.newMonthButton.classList.add('hidden');
    ps.backButton?.classList.remove('hidden');
    renderHud();
    showScreen('paycheck');
  }

  function startNewMonth() {
    save.currentShift = 1;
    save.monthToDateGard = 0;
    save.karenSeed = Date.now();
    persistSave(storageAvailable, save);
    startShift();
  }

  // -- Rendering ------------------------------------------------------------

  // Pastel anime tiles, Hospital Shift's palette (hospital/anime-ui.js's animeTile shades them).
  const STATION_COLORS = {
    'front-desk': '#ffe0c2',
    'return-cart': '#f2e6d0',
    'fines-counter': '#ffe4dc',
    'coffee-machine': '#f5d3bd',
    'reading-nook': '#f0e6ff',
    'boss-office': '#e6dcf5',
    bookshelf: '#fff0dc',
    stairs: '#b9d4f2',
    elevator: '#d8b9f2',
  };

  // The floor and back wall in Hospital Shift's anime style (the user:
  // "make it like hospital shift"): glossy pastel checker tiles with
  // afternoon sunbeams, a cream-to-blush back wall with a pink rail, a
  // glossy sign button (Korean and English — the user asked for a Korean
  // library), a painted sakura branch, a little wall shelf of books, and the
  // pink bell clock. The HUD bars sit on the wall band.
  const TILE = 40;
  const WALL_BAND_HEIGHT = 58;

  /** Set dressing from Hospital Shift's decor kit (hospital/anime-furniture.js's drawDecor). */
  const LIBRARY_DECOR = [
    { kind: 'water-cooler', floor: FLOOR_1, x: 200, y: 120, w: 28, h: 52 },
    { kind: 'plant', floor: FLOOR_1, x: 930, y: 240, w: 30, h: 46 },
    { kind: 'plant', floor: FLOOR_1, x: 930, y: 420, w: 30, h: 46 },
    { kind: 'ladder', floor: FLOOR_2, x: 150, y: 300, w: 30, h: 62 },
    { kind: 'waiting-chairs', floor: FLOOR_2, x: 480, y: 570, w: 96, h: 34 },
    { kind: 'plant', floor: FLOOR_2, x: 40, y: 120, w: 30, h: 46 },
    { kind: 'plant', floor: FLOOR_2, x: 40, y: 420, w: 30, h: 46 },
  ];

  function drawFloor() {
    if (currentFloor === FLOOR_1) {
      drawAnimeTiles('#e6f6f0', '#d8efe7', 'rgba(143,211,255,0.10)');
      drawSunbeams();
      // Pastel guide stripes: the aisle under the Front Desk's queue, and the lower aisle.
      drawRoundRect(ctx, 190, 252, 720, 7, 3.5, 'rgba(255,138,122,0.28)');
      drawRoundRect(ctx, 190, 500, 620, 7, 3.5, 'rgba(63,181,143,0.26)');
      drawBackWall();
      sakuraBranch(ctx, 672, 28, 1.1);
      drawWallBookShelf();
      drawLibrarySign('도서관 · LIBRARY 1F', ANIME.coral, ANIME.coralDeep);
      // Break-room rug under the coffee machine: soft pink, stitched border.
      const coffee = stations.find((st) => st.kind === 'coffee-machine');
      if (coffee) drawStitchedRug(Math.min(coffee.x - 70, CANVAS_WIDTH - 196), coffee.y - 62, 190, 120, 'rgba(255,194,218,0.55)', 'rgba(232,85,143,0.55)');
    } else {
      drawAnimeTiles('#f6efe4', '#efe5d6', 'rgba(255,255,255,0.18)');
      drawSunbeams();
      drawBackWall();
      sakuraBranch(ctx, 672, 28, 1.1);
      drawWallBookShelf();
      drawLibrarySign('열람실 · READING 2F', ANIME.lavender, ANIME.lavenderDeep);
      const nook = stations.find((st) => st.kind === 'reading-nook');
      if (nook) drawStitchedRug(nook.x - 110, nook.y - 62, 220, 124, 'rgba(201,184,255,0.4)', 'rgba(143,122,224,0.55)');
    }
    for (const d of LIBRARY_DECOR) if (d.floor === currentFloor) drawDecor(ctx, d);
    drawWallClock();
  }

  function drawStitchedRug(x, y, w, h, fill, stitch) {
    drawRoundRect(ctx, x, y, w, h, 22, fill);
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = stitch;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x + 7, y + 7, w - 14, h - 14, 17);
    ctx.stroke();
    ctx.restore();
  }

  /** Hospital Shift's floor: big pastel checker tiles with a glossy sheen. */
  function drawAnimeTiles(light, dark, sheen) {
    const g = ctx.createLinearGradient(0, WALL_BAND_HEIGHT, 0, CANVAS_HEIGHT);
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
    [[560, 160], [700, 120], [820, 90]].forEach(([bx, bw], i) => {
      const g = ctx.createLinearGradient(bx, WALL_BAND_HEIGHT, bx - 260, CANVAS_HEIGHT);
      g.addColorStop(0, 'rgba(255,246,214,0.42)');
      g.addColorStop(1, 'rgba(255,246,214,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(bx, WALL_BAND_HEIGHT);
      ctx.lineTo(bx + bw, WALL_BAND_HEIGHT);
      ctx.lineTo(bx + bw - 300 - i * 20, CANVAS_HEIGHT);
      ctx.lineTo(bx - 330 - i * 20, CANVAS_HEIGHT);
      ctx.closePath();
      ctx.fill();
    });
    ctx.restore();
  }

  /** The back wall: cream to blush, a pink wainscot rail and plum trim. */
  function drawBackWall() {
    const g = ctx.createLinearGradient(0, 0, 0, WALL_BAND_HEIGHT);
    g.addColorStop(0, '#fffaf3');
    g.addColorStop(1, '#fdeef3');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CANVAS_WIDTH, WALL_BAND_HEIGHT);
    ctx.fillStyle = '#ffd1e3';
    ctx.fillRect(0, 48, CANVAS_WIDTH, 7);
    ctx.fillStyle = ANIME.ink;
    ctx.fillRect(0, 55, CANVAS_WIDTH, 2.5);
    ctx.fillStyle = 'rgba(59,42,74,0.12)';
    ctx.fillRect(0, 57.5, CANVAS_WIDTH, 4);
  }

  /** The floor's sign, where Hospital Shift has its EMERGENCY button. */
  function drawLibrarySign(text, color, colorDeep) {
    animeButton(ctx, { x: 744, y: 12, w: 190, h: 32 }, '', color, colorDeep);
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    outlinedText(ctx, text, 839, 29, '#ffffff', tint(colorDeep, -0.45), 3.2);
    sparkle(ctx, 750, 14, 5, '#ffffff');
  }

  /** A little wall shelf of books between the clock and the sakura branch. */
  function drawWallBookShelf() {
    const x = 566;
    const y = 40;
    const colors = [ANIME.pink, ANIME.sky, ANIME.gold, ANIME.mint, ANIME.lavender, ANIME.coral];
    colors.forEach((color, i) => {
      const h = 18 + ((i * 5) % 7);
      const w = 7;
      const bx = x + i * 8;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(bx, y - h, w, h, 1.5);
      ctx.fill();
      ctx.strokeStyle = ANIME.ink;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(bx + 1.5, y - h + 3, w - 3, 1.5);
    });
    drawRoundRect(ctx, x - 6, y, 62, 4, 2, '#c9a77a');
    ctx.strokeStyle = ANIME.ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x - 6, y, 62, 4, 2);
    ctx.stroke();
  }

  /**
   * Hospital Shift's pastel wall clock — pink rim, plum line art, two
   * little bells. The authoritative reading is `#library-hud-clock`'s
   * `inGameTimeLabel` text; hands are derived by parsing that same label so
   * the two displays never drift apart.
   */
  function drawWallClock() {
    if (!shiftState) return;
    const label = inGameTimeLabel(shiftState.clockSeconds, shiftState.totalClockSeconds);
    const match = /^(\d+):(\d+)\s(AM|PM)$/.exec(label);
    if (!match) return;
    const hour = Number(match[1]) % 12;
    const minute = Number(match[2]);
    const cx = 520;
    const cy = 29;
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

  // -- Station art: Hospital Shift's anime furniture kit -----------------------
  // Library's own fixtures live in library/anime-furniture.js; Stairs and
  // the Elevator are Hospital Shift's own (hospital/anime-furniture.js).
  // Each drawer paints in the station's local space (origin = box center,
  // already translated/scaled by drawStation, so First Person's billboards
  // get it for free).

  /** Korean genre names for the bookcase signs (the Korean-library theme). */
  const GENRE_SIGNS_KO = { mystery: '추리', romance: '로맨스', scifi: 'SF', kids: '어린이', reference: '참고' };

  // The original coffee machine, kept as is — Hospital Shift kept this same
  // art for its own machine.
  function drawCoffeeMachineDetail(half) {
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

  /** The Boss's Office as a hanok door: a timber frame around hanji-papered lattice panels, a brass ring pull and a name plaque. */
  const STATION_DETAIL_DRAWERS = {
    bookshelf: (station) => {
      const genre = findGenre(station.genreId);
      const ko = GENRE_SIGNS_KO[station.genreId];
      drawBookcase(ctx, station, {
        color: genre?.color ?? ANIME.coral,
        sign: ko ? `${ko} · ${genre?.name ?? ''}` : (genre?.name ?? ''),
        titles: TITLE_POOLS[station.genreId] ?? [], // Korean on each spine, its English meaning beside it
      });
    },
    'return-cart': (station) => drawReturnCart(ctx, station),
    'front-desk': (station) => drawFrontDesk(ctx, station),
    'fines-counter': (station) => drawFinesRoom(ctx, station),
    'coffee-machine': (station) => drawCoffeeMachineDetail(station.w / 2),
    'boss-office': (station) => drawBossDoor(ctx, station),
    'reading-nook': (station) => drawReadingNook(ctx, station),
    stairs: (station) => drawStairs(ctx, station),
    elevator: (station) => drawElevator(ctx, station, { t: performance.now() / 1000 }),
  };

  /**
   * Draws one station's box. `opts` is First Person's billboard hook (doc's
   * "draw it via the *same* existing drawing functions"): `scale`,
   * `centerX`/`centerY` and `skipLabel`. Hospital Shift's look: an anime
   * tile, the fixture art, plum line art, and a glowing ring + sparkle when
   * hovered (pink) or targeted (gold).
   */
  function drawStation(station, opts = {}) {
    const billboard = opts.scale !== undefined;
    const scale = opts.scale ?? 1;
    const isHovered = !billboard && hoverStation && hoverStation.id === station.id;
    const isTarget = !billboard && moveTarget && moveTarget.station && moveTarget.station.id === station.id;
    const { hw, hh } = stationExtents(station);
    const box = { ...station, w: hw * 2, h: hh * 2 };
    // Locked all shift and through the closing wait — v2.13: it used to
    // *look* unlocked during the 20 s closing wait while arriving did
    // nothing (user: "when i want to get into the bosses office i cannot").
    const locked = station.kind === 'boss-office' && shiftState
      && (shiftState.phase === 'playing' || (shiftState.phase === 'closing-wait' && !isBossOfficeReady(shiftState)));
    const cx = opts.centerX ?? station.x;
    const cy = opts.centerY ?? station.y;

    ctx.save();
    ctx.translate(Math.round(cx), Math.round(cy));
    ctx.scale(scale, scale);
    animeTile(ctx, -hw, -hh, hw * 2, hh * 2, 12, locked ? '#cfc8d8' : (STATION_COLORS[station.kind] || '#f2e6d0'));
    STATION_DETAIL_DRAWERS[station.kind]?.(box);
    if (locked) {
      // A padlock badge over the (greyed) office door.
      drawRoundRect(ctx, -14, -12, 28, 28, 14, 'rgba(255,251,246,0.92)');
      ctx.strokeStyle = '#5a5060';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, -2, 5.5, Math.PI, 0);
      ctx.stroke();
      drawRoundRect(ctx, -7.5, 1, 15, 11, 3, '#5a5060');
    }
    ctx.strokeStyle = ANIME.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-hw, -hh, hw * 2, hh * 2, 12);
    ctx.stroke();
    const ring = isTarget ? ANIME.gold : (isHovered ? ANIME.pink : null);
    if (ring) {
      ctx.strokeStyle = ring;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-hw - 3, -hh - 3, hw * 2 + 6, hh * 2 + 6, 15);
      ctx.stroke();
      sparkle(ctx, hw - 2, -hh + 2, 6, '#ffffff');
    }

    if (!opts.skipLabel) {
      const label = labelForStation(station);
      if (label) {
        const labelBelowFits = cy + hh + 13 + 7 <= CANVAS_HEIGHT;
        drawLabelChip(ctx, 0, labelBelowFits ? hh + 13 : -hh - 13, label, 'bold 11px sans-serif');
      }
    }

    ctx.restore();
  }

  /**
   * Full-size queued patrons stand over the Front Desk's and Fines
   * Counter's name chips, so those two chips are drawn again on top.
   */
  function drawQueueStationLabels() {
    for (const station of stationsOnFloor(stations, currentFloor)) {
      if (station.kind !== 'front-desk' && station.kind !== 'fines-counter') continue;
      const label = labelForStation(station);
      if (label) drawLabelChip(ctx, station.x, station.y + stationExtents(station).hh + 13, label, 'bold 11px sans-serif');
    }
  }

  /** "Daily Challenge · {twist}" along the bottom of the play area during a daily run. */
  function drawDailyChip() {
    if (!daily) return;
    drawLabelChip(ctx, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 16, `Daily Challenge · ${daily.twist.name}`, 'bold 13px sans-serif', ANIME.coral, '#ffffff');
  }

  /** The Coffee Machine taped off with an "OUT OF ORDER" sign (the Coffee Machine Broken twist). */
  function drawCoffeeOutOfOrder() {
    if (!daily?.twist.effect.noCoffee || currentFloor !== FLOOR_1) return;
    const coffee = stations.find((st) => st.kind === 'coffee-machine');
    if (!coffee) return;
    ctx.save();
    ctx.translate(coffee.x, coffee.y);
    for (const [rot, dy] of [[-0.35, -6], [0.35, 8]]) {
      ctx.save();
      ctx.rotate(rot);
      ctx.translate(0, dy);
      ctx.beginPath();
      ctx.rect(-52, -6, 104, 12);
      ctx.fillStyle = '#ffd23a';
      ctx.fill();
      ctx.clip();
      ctx.fillStyle = '#2a2226';
      for (let x = -60; x < 60; x += 14) {
        ctx.beginPath();
        ctx.moveTo(x, 6);
        ctx.lineTo(x + 7, -6);
        ctx.lineTo(x + 13, -6);
        ctx.lineTo(x + 6, 6);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
    drawLabelChip(ctx, coffee.x, coffee.y - 50, 'OUT OF ORDER', 'bold 10px sans-serif', '#e06a5b', '#ffffff');
  }

  function drawReturnCartBooks() {
    if (currentFloor !== FLOOR_1) return;
    for (const book of returnCartSlots()) {
      const genre = findGenre(book.genreId);
      const color = genre ? genre.color : '#8a6a4a';
      const { x: coverX, y: coverY, w: coverW, h: coverH } = returnCartCoverRect(book);
      // Anime book cover: a soft drop shadow, plum line art, a spine band and a shine.
      drawRoundRect(ctx, coverX + 1.5, coverY + 2.5, coverW, coverH, 3, 'rgba(59,42,74,0.2)');
      drawRoundRect(ctx, coverX, coverY, coverW, coverH, 3, color);
      ctx.fillStyle = 'rgba(255,251,246,0.5)';
      ctx.fillRect(coverX + 1, coverY + 1, 3, coverH - 2);
      ctx.strokeStyle = ANIME.ink;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(coverX, coverY, coverW, coverH, 3);
      ctx.stroke();
      // Full title on the front cover (user: "add the title names on each
      // books") — wrapped and shrunk to fit rather than v1.4's first-four-
      // words-then-crop, which cut titles off at the cover's edges.
      if (book.title) drawCoverTitle(ctx, book.title, coverX + 3, coverY, coverW - 3, coverH, color, { maxFont: 7.5, minFont: 5 });
      if (book.isCoinHunt) animeStar(ctx, coverX + coverW - 2, coverY + 1, 6, 2.6, 1);
    }
    const cart = stations.find((s) => s.kind === 'return-cart');
    if (shiftState && shiftState.returnCart.length > 5) {
      drawLabelChip(ctx, cart.x, cart.y + cart.size / 2 + 78, `+${shiftState.returnCart.length - 5} more`, 'bold 10px sans-serif');
    }
    // v2.18: a messy cart drains Mood — say so, pulsing red.
    if (shiftState && shiftState.phase === 'playing' && shiftState.returnCart.length > MESSY_CART_THRESHOLD) {
      const pulse = 0.85 + 0.15 * Math.sin(performance.now() / 200);
      ctx.save();
      ctx.globalAlpha = pulse;
      const warnY = cart.y + cart.size / 2 + 100; // below the covers and the "+N more" chip
      drawLabelChip(ctx, cart.x, warnY, 'Messy cart! Mood dropping', 'bold 10px sans-serif', ANIME.coralDeep, '#ffffff');
      ctx.restore();
    }
  }

  const SLOT_PERSONALITY_CACHE = new Map();
  function personalityForSlot(slot, index) {
    if (slot.kind === 'karen') return 'karen';
    if (!SLOT_PERSONALITY_CACHE.has(slot.id)) SLOT_PERSONALITY_CACHE.set(slot.id, personalityForId(slot.id));
    return SLOT_PERSONALITY_CACHE.get(slot.id);
  }

  function drawFinesCounterSlots() {
    if (currentFloor !== FLOOR_1) return;
    finesCounterSlots().forEach((slot, i) => {
      drawLibraryPerson(ctx, slot.x, slot.y, { personalityKey: personalityForSlot(slot, i), scale: LIBRARY_PERSON_SCALE });
      drawStar(ctx, slot.x + 24, slot.y - PERSON_HEIGHT + 14, 6, 2.5, '#f2d98a'); // beside the head, clear of the counter's name chip
      drawPatienceBar(slot, slot.waitFraction);
      drawLabelChip(ctx, slot.x, slot.y + 20, `${slot.amountGard}g`, 'bold 9px sans-serif');
    });
    const waiting = shiftState?.finesQueue.length || 0;
    if (waiting > SLOT_VISIBLE_MAX) {
      const counter = stations.find((s) => s.kind === 'fines-counter');
      // Beside the line rather than under it: the Elevator sits below.
      drawLabelChip(ctx, counter.x + SLOT_PITCH * 2 + 4, counter.y + stationExtents(counter).hh + QUEUE_SLOT_OFFSET_Y + 20, `+${waiting - SLOT_VISIBLE_MAX} waiting`, 'bold 10px sans-serif');
    }
  }

  function drawFrontDeskSlots() {
    if (currentFloor !== FLOOR_1) return;
    const slots = frontDeskSlots();
    slots.forEach((slot, i) => {
      const personality = personalityForSlot(slot, i);
      if (slot.kind === 'ghost') {
        ctx.save();
        ctx.globalAlpha = 0.35 + 0.2 * Math.sin(performance.now() / 90);
        drawLibraryPerson(ctx, slot.x + Math.sin(performance.now() / 140) * 2, slot.y, { personalityKey: personality, scale: LIBRARY_PERSON_SCALE });
        ctx.restore();
        drawLabelChip(ctx, slot.x, slot.y + 20, '???', 'bold 9px sans-serif');
        return;
      }
      drawLibraryPerson(ctx, slot.x, slot.y, { personalityKey: personality, scale: LIBRARY_PERSON_SCALE, angryTint: slot.kind === 'karen' });
      if (slot.kind === 'borrow-active') {
        if (slot.stage === 'searching') {
          // Patience bar over their head, green -> amber -> red.
          drawPatienceBar(slot, slot.patienceFraction);
          drawLabelChip(ctx, slot.x, slot.y + 20, 'Waiting', 'bold 9px sans-serif');
        } else {
          drawLabelChip(ctx, slot.x, slot.y + 20, 'Check out!', 'bold 9px sans-serif');
        }
      } else if (slot.kind === 'borrow') {
        drawPatienceBar(slot, slot.waitFraction);
        const entry = bookCatalog.get(slot.bookId);
        const genre = entry ? findGenre(entry.genreId) : null;
        drawRoundRect(ctx, slot.x + 20, slot.y - PERSON_HEIGHT + 4, 10, 14, 1, genre ? genre.color : '#8a6a4a'); // beside the head
        // Front-desk slots sit only SLOT_PITCH apart (frontDeskSlots) — a full
        // title's label chip (drawLabelChip auto-sizes to text width, no
        // wrapping) can run wider than that and spill into the
        // neighboring slot's own chip, same class of overflow bug as the
        // Return Cart covers above. Truncated to a short, single-word-ish
        // snippet that reliably stays inside one slot's width instead.
        if (entry?.title) {
          // The Korean title on the chip, its English meaning just below
          // (under the patience bar), both cut to the slot's SLOT_PITCH.
          const { ko, en } = splitTitle(entry.title);
          drawLabelChip(ctx, slot.x, slot.y + 20, truncateForChip(ctx, ko, SLOT_PITCH - 6, 'bold 9px sans-serif'), 'bold 9px sans-serif');
          if (en) {
            ctx.font = 'bold 7.5px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            outlinedText(ctx, truncateForChip(ctx, en, SLOT_PITCH - 2, 'bold 7.5px sans-serif'), slot.x, slot.y + 42, ANIME.ink, '#ffffff', 2.4);
          }
        }
      } else if (slot.kind === 'karen') {
        drawLabelChip(ctx, slot.x, slot.y + 20, 'Karen!', 'bold 10px sans-serif');
      }
    });
    const total = shiftState?.borrowQueue.length || 0;
    const shown = Math.min(total, SLOT_VISIBLE_MAX);
    if (total > shown) {
      const desk = stations.find((s) => s.kind === 'front-desk');
      // Beside the line, clear of the bookcase below it.
      drawLabelChip(ctx, desk.x + SLOT_PITCH * 2 + 6, desk.y + stationExtents(desk).hh + QUEUE_SLOT_OFFSET_Y + 20, `+${total - shown} waiting`, 'bold 10px sans-serif');
    }
  }

  function currentPlayerBadge() {
    if (shiftState?.carriedBook) {
      const genre = findGenre(shiftState.carriedBook.genreId);
      return { color: genre ? genre.color : '#8a6a4a', kind: 'book' };
    }
    if (shiftState?.carriedFine) return { color: '#f2d98a', kind: 'coin' };
    if (shiftState?.readingBook) {
      const genre = findGenre(shiftState.readingBook.genreId);
      return { color: genre ? genre.color : '#8a6a4a', kind: 'book' };
    }
    if (shiftState?.activeBorrow?.stage === 'checkout') {
      const entry = bookCatalog.get(shiftState.activeBorrow.bookId);
      const genre = entry ? findGenre(entry.genreId) : null;
      return { color: genre ? genre.color : '#8a6a4a', kind: 'book' };
    }
    return null;
  }

  // Set by `drawPlayer` (Top-Down only — First Person never calls it, per
  // the doc's "the player's own sprite is never drawn in this mode"), reset
  // false at the top of every `render()`. Exists so a test can assert this
  // directly (`window.__libraryGameTestHooks.wasPlayerSpriteDrawnLastFrame`)
  // rather than inferring it from pixel sampling.
  let lastFrameDrewPlayerSprite = false;

  function drawPlayer() {
    lastFrameDrewPlayerSprite = true;
    const sanity = shiftState ? shiftState.sanity : SANITY_MAX;
    const stress = sanity < HALLUCINATION_START_SANITY ? (HALLUCINATION_START_SANITY - sanity) / HALLUCINATION_START_SANITY : 0;
    drawLibraryPerson(ctx, player.x, player.y, { personalityKey: 'librarian', scale: 1, stress, walking: moveTarget !== null });
    drawCoffeeSplash();
    drawLabelChip(ctx, player.x, player.y + 24, PLAYER_NAME, 'bold 10px sans-serif');
    const badge = currentPlayerBadge();
    if (badge) {
      const r = PLAYER_SIZE_RATIO;
      if (badge.kind === 'book') drawRoundRect(ctx, player.x + 16 * r, player.y - 86 * r, 12, 16, 2, badge.color);
      else drawStar(ctx, player.x + 20 * r, player.y - 82 * r, 7, 3, badge.color);
    }
  }

  /** Hospital Shift's anime stat gauge (badge, gauge, outlined label): healthy in its own color, then gold, then coral when low. */
  function drawStatBar(y, label, value, max, colorHigh, font) {
    const x = 14;
    const width = 130;
    const height = 16;
    const percent = Math.round(value);
    const frac = Math.max(0, Math.min(1, value / max));
    const [top, deep] = percent > 50 ? colorHigh : (percent > 20 ? [ANIME.gold, ANIME.goldDeep] : [ANIME.coral, ANIME.coralDeep]);
    animeGauge(ctx, x + 6, y, width - 6, height, frac, top, deep);
    animeBadge(ctx, x + 6, y + height / 2, 10, top, deep, label === 'Sanity' ? 'heart' : 'smile');
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    outlinedText(ctx, `${label} ${percent}%`, x + width / 2 + 9, y + height / 2 + 0.5, '#ffffff', ANIME.ink, 2.6);
  }

  function drawSanityBar() {
    // The Sanity label uses the site's display font (Caprasimo) once
    // `document.fonts.ready` has resolved (see `sanityFontReady`).
    drawStatBar(14, 'Sanity', shiftState ? shiftState.sanity : SANITY_MAX, SANITY_MAX, [ANIME.mint, ANIME.mintDeep],
      sanityFontReady ? 'bold 11px "Caprasimo", sans-serif' : 'bold 11px sans-serif');
  }

  // v2.15 Gard counter (user: "something ... keeping track of your gard"):
  // this shift's bonus Gard (tips, fines, Coin Hunt, Karen) plus the
  // month-to-date total banked from earlier shifts, with a floating "+N"
  // pop each time bonusGard goes up. The shift's base pay isn't included
  // until the paycheck, since it depends on mistakes and the rating.
  let lastSeenBonusGard = 0;
  let gardPops = [];

  /** This shift's Gard so far: bonuses minus complaint letters (v2.17). */
  function netShiftGard() {
    return shiftState ? shiftState.bonusGard - (shiftState.complaints ?? 0) * COMPLAINT_GARD : 0;
  }

  function trackGardPops(deltaSeconds) {
    const net = netShiftGard();
    if (net !== lastSeenBonusGard) gardPops.push({ amount: net - lastSeenBonusGard, age: 0 });
    lastSeenBonusGard = net;
    gardPops = gardPops.map((pop) => ({ ...pop, age: pop.age + deltaSeconds })).filter((pop) => pop.age < 1.4);
  }

  function drawGardCounter() {
    const bonus = netShiftGard();
    const x = 264;
    const y = 14;
    const w = 176;
    const h = 22;
    animePlate(ctx, x, y, w, h, 11);
    animeBadge(ctx, x + 13, y + 11, 8.5, ANIME.gold, ANIME.goldDeep, 'G');
    ctx.fillStyle = LABEL_TEXT_COLOR;
    ctx.textAlign = 'left';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(`${bonus >= 0 ? '+' : '−'}${Math.abs(bonus)}g shift`, x + 26, y + 11.5);
    ctx.font = '10px sans-serif';
    ctx.fillStyle = ANIME.inkSoft;
    ctx.textAlign = 'right';
    ctx.fillText(`Month ${save.monthToDateGard}g`, x + w - 9, y + 11.5);
    // "+N" pops float up and fade.
    for (const pop of gardPops) {
      const t = pop.age / 1.4;
      ctx.globalAlpha = 1 - t;
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'left';
      const popY = y + h + 20 - t * 10;
      ctx.strokeStyle = '#fdf8ee';
      ctx.lineWidth = 3.5;
      ctx.lineJoin = 'round';
      const popText = `${pop.amount >= 0 ? '+' : '−'}${Math.abs(pop.amount)}g`;
      ctx.strokeText(popText, x + 26, popY);
      ctx.fillStyle = pop.amount >= 0 ? '#b07a1e' : '#c0392b';
      ctx.fillText(popText, x + 26, popY);
      ctx.globalAlpha = 1;
    }
  }

  /** v2.9 star rating, right of the Sanity/Mood bars: Hospital Shift's anime stars with half-star fills. */
  function drawRatingStars() {
    const rating = shiftState ? shiftState.rating : RATING_MAX;
    const x0 = 152;
    const cy = 25;
    animePlate(ctx, x0 - 4, cy - 12, 5 * 20 + 8, 24, 12);
    for (let i = 0; i < RATING_MAX; i++) {
      animeStar(ctx, x0 + 10 + i * 20, cy, 8.5, 3.9, Math.max(0, Math.min(1, rating - i)));
    }
  }

  function drawLibraryMoodBar() {
    drawStatBar(36, 'Mood', shiftState ? shiftState.libraryMood : LIBRARY_MOOD_MAX, LIBRARY_MOOD_MAX, [ANIME.sky, ANIME.skyDeep], 'bold 10px sans-serif');
  }

  // -- Overlay rendering ------------------------------------------------------

  /** Hospital Shift's dialog dim: a plum vignette with slow sparkles. */
  function drawOverlayBackdrop() {
    animeBackdrop(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, performance.now() / 1000);
  }

  /** Each overlay's window trim, so screens are told apart at a glance (Hospital Shift's PANEL_ACCENTS). */
  const WINDOW_ACCENTS = {
    'coin-hunt': [ANIME.gold, ANIME.goldDeep],
    'fines-sort': [ANIME.coral, ANIME.coralDeep],
    'find-the-book': [ANIME.sky, ANIME.skyDeep],
    reading: [ANIME.lavender, ANIME.lavenderDeep],
    'till-count': [ANIME.mint, ANIME.mintDeep],
    'coffee-pour': [ANIME.gold, ANIME.goldDeep],
  };

  /** A Hospital Shift anime dialog window behind an overlay's content. */
  function drawWindow(x, y, w, h) {
    const [accent, accentDeep] = WINDOW_ACCENTS[overlay?.kind] ?? [ANIME.pink, ANIME.pinkDeep];
    animeWindow(ctx, { x, y, w, h }, { t: performance.now() / 1000, accent, accentDeep });
  }

  function drawSkillCheckOverlay() {
    drawOverlayBackdrop();
    const zone = skillCheckSuccessZone(shakyHandsZoneScale(currentIntensity()));
    const barX = 130;
    const barW = CANVAS_WIDTH - 260;
    const barY = CANVAS_HEIGHT / 2 - 10;
    const barH = 24;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `22px ${DISPLAY_FONT}`;
    outlinedText(ctx, overlay.context === 'shelf' ? 'Shelf Skill-Check' : 'Checkout Skill-Check', CANVAS_WIDTH / 2, barY - 40, '#ffffff', ANIME.ink, 4);
    ctx.font = 'bold 13px sans-serif';
    outlinedText(ctx, 'Click, tap, or press Space/Enter to stop the marker in the gold zone', CANVAS_WIDTH / 2, barY - 16, '#ffffff', ANIME.ink, 3);

    drawRoundRect(ctx, barX, barY, barW, barH, 12, ANIME.paper);
    drawRoundRect(ctx, barX + zone.start * barW, barY, zone.width * barW, barH, 6, ANIME.gold);
    ctx.strokeStyle = ANIME.ink;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 12);
    ctx.stroke();

    const markerX = barX + overlay.gaugePosition * barW;
    ctx.fillStyle = ANIME.pinkDeep;
    ctx.beginPath();
    ctx.moveTo(markerX, barY - 6);
    ctx.lineTo(markerX - 7, barY - 18);
    ctx.lineTo(markerX + 7, barY - 18);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * A Gard coin or Gard bill (v2.14 redesign — user: "i want the designs to
   * be better for the coins and gard"). Coins: a gold disc with a raised
   * rim, an inner ring, an embossed "G" and a shine. Bills: a green banknote
   * with an inner border, a "G" seal and corner denominations, tilted a
   * little per item so a scatter doesn't look stamped. Both cast a soft
   * shadow. Shared by Coin Hunt and Fines Sort.
   */
  function drawCoinIcon(x, y, isBill, seed = 0) {
    ctx.save();
    if (isBill) {
      const tilt = (((seed * 37) % 11) - 5) * 0.045;
      ctx.translate(x, y);
      ctx.rotate(tilt);
      const w = 38;
      const h = 20;
      drawRoundRect(ctx, -w / 2 + 2, -h / 2 + 3, w, h, 3, 'rgba(58,42,42,0.18)');
      drawRoundRect(ctx, -w / 2, -h / 2, w, h, 3, '#8cc48a');
      ctx.strokeStyle = '#4f8a52';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, 3);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(240,250,232,0.85)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 2);
      ctx.stroke();
      // Center seal.
      ctx.fillStyle = '#e8f4dc';
      ctx.beginPath();
      ctx.ellipse(0, 0, 6.5, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#4f8a52';
      ctx.stroke();
      ctx.fillStyle = '#3f7a46';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('G', 0, 0.5);
      // Corner denominations.
      ctx.font = 'bold 5.5px sans-serif';
      ctx.fillText('10', -w / 2 + 7, -h / 2 + 6);
      ctx.fillText('10', w / 2 - 7, h / 2 - 5.5);
    } else {
      const r = 12;
      ctx.fillStyle = 'rgba(58,42,42,0.2)';
      ctx.beginPath();
      ctx.ellipse(x + 1.5, y + 3, r, r * 0.9, 0, 0, Math.PI * 2);
      ctx.fill();
      // Rim, then a gradient face.
      ctx.fillStyle = '#c28a2c';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      const face = ctx.createRadialGradient(x - 3, y - 4, 1, x, y, r - 1.5);
      face.addColorStop(0, '#fff2bf');
      face.addColorStop(0.55, '#f2cf6a');
      face.addColorStop(1, '#dca842');
      ctx.fillStyle = face;
      ctx.beginPath();
      ctx.arc(x, y, r - 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(160,110,30,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, r - 4.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#a8741e';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('G', x, y + 0.5);
      // Shine.
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(x, y, r - 3, Math.PI * 1.1, Math.PI * 1.45);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawDecoyIcon(x, y, kind) {
    ctx.strokeStyle = '#8a8a8a';
    ctx.fillStyle = '#b8b8b8';
    ctx.lineWidth = 2;
    if (kind === 'paperclip') {
      ctx.beginPath();
      ctx.ellipse(x, y, 4, 9, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (kind === 'pen') {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(0.5);
      drawRoundRect(ctx, -3, -12, 6, 24, 2, '#6a8ab0');
      ctx.restore();
    } else if (kind === 'key') {
      ctx.beginPath();
      ctx.arc(x - 4, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x, y - 2, 12, 4);
    } else if (kind === 'stamp') {
      drawRoundRect(ctx, x - 8, y - 6, 16, 12, 2, '#c98a8a');
    } else {
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCoinHuntOverlay() {
    drawOverlayBackdrop();
    drawWindow(90, 140, CANVAS_WIDTH - 180, 360);
    ctx.fillStyle = LABEL_TEXT_COLOR;
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    const huntTitle = shiftState?.carriedBook?.title;
    if (huntTitle) ctx.font = 'bold 16px sans-serif'; // a bit smaller than the plain header, to keep the longest titles on one line within the box
    ctx.fillText(
      huntTitle ? `Coin Hunt — "${huntTitle}" — find every coin and bill` : 'Coin Hunt — find every coin and bill',
      CANVAS_WIDTH / 2,
      170,
    );
    for (const item of overlay.items) {
      if (item.found) continue;
      drawCoinIcon(item.x, item.y, item.isBill, item.id);
    }
    const foundCount = overlay.items.filter((i) => i.found).length;
    ctx.font = '14px sans-serif';
    ctx.fillText(`${foundCount} / ${overlay.items.length} found`, CANVAS_WIDTH / 2, 470);
  }

  function drawFinesSortOverlay() {
    drawOverlayBackdrop();
    drawWindow(90, 140, CANVAS_WIDTH - 180, 360);
    ctx.fillStyle = LABEL_TEXT_COLOR;
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Fines Sort — find every coin and Gard bill', CANVAS_WIDTH / 2, 170);
    for (const item of overlay.items) {
      if (item.found) continue;
      if (item.real) drawCoinIcon(item.x, item.y, item.isBill, item.id);
      else drawDecoyIcon(item.x, item.y, item.decoyKind);
    }
    const foundReal = overlay.items.filter((i) => i.real && i.found).length;
    const totalReal = overlay.items.filter((i) => i.real).length;
    ctx.font = '14px sans-serif';
    ctx.fillText(`${foundReal} / ${totalReal} found`, CANVAS_WIDTH / 2, 470);
  }

  function drawFindTheBookOverlay() {
    drawOverlayBackdrop();
    drawWindow(90, 140, CANVAS_WIDTH - 180, 360);
    ctx.fillStyle = LABEL_TEXT_COLOR;
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    const genre = findGenre(overlay.genreId);
    ctx.fillText(`Find the requested book (${genre ? genre.name : ''})`, CANVAS_WIDTH / 2, 170);
    const wanted = overlay.items.find((it) => it.correct)?.title;
    if (wanted) {
      ctx.font = 'bold 15px sans-serif';
      ctx.fillStyle = '#c65f7c';
      ctx.fillText(`Looking for: “${wanted}”`, CANVAS_WIDTH / 2, 194);
    }
    // Covers are big enough for the Korean title and its English translation.
    for (const item of overlay.items) {
      const { x: bx, y: by, w: bw, h: bh } = findBookCoverRect(item);
      drawRoundRect(ctx, bx + 1.5, by + 2.5, bw, bh, 4, 'rgba(59,42,74,0.2)');
      drawRoundRect(ctx, bx, by, bw, bh, 4, item.color);
      ctx.strokeStyle = ANIME.ink;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 4);
      ctx.stroke();
      drawCoverTitle(ctx, item.title, bx + 2, by + 2, bw - 4, bh - 4, item.color, { maxFont: 11, minFont: 6 });
    }
  }

  /** Greedy word-wrap of `text` into lines no wider than `maxWidth` at the current ctx.font. */
  function wrapLines(text, maxWidth) {
    const lines = [];
    let line = '';
    for (const word of text.split(' ')) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function drawReadingOverlay() {
    drawOverlayBackdrop();
    const cx = CANVAS_WIDTH / 2;
    drawWindow(cx - 330, 94, 660, 440);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = LABEL_TEXT_COLOR;
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`“${overlay.title}”`, cx, 126);
    ctx.font = '12px sans-serif';
    ctx.fillText(overlay.ownBook
      ? 'Your pick from the shelf. → / Space / Enter / click turns the page, ← goes back.'
      : 'Read at your own pace. → / Space / Enter / click turns the page, ← goes back.', cx, 146);

    const close = readingCloseRect();
    drawRoundRect(ctx, close.x, close.y, close.w, close.h, 15, 'rgba(58,42,42,0.12)');
    ctx.fillStyle = LABEL_TEXT_COLOR;
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('×', close.x + close.w / 2, close.y + 21);

    // Open book: two cream pages with a spine shadow and the story's text.
    const bookY = 160;
    const pageW = 290;
    const pageH = 300;
    drawRoundRect(ctx, cx - pageW - 10, bookY - 6, pageW * 2 + 20, pageH + 12, 10, '#8a5a3a');
    drawRoundRect(ctx, cx - pageW, bookY, pageW, pageH, [8, 2, 2, 8], '#fdf8ee');
    drawRoundRect(ctx, cx, bookY, pageW, pageH, [2, 8, 8, 2], '#fdf8ee');
    const spine = ctx.createLinearGradient(cx - 14, 0, cx + 14, 0);
    spine.addColorStop(0, 'rgba(58,42,42,0)');
    spine.addColorStop(0.5, 'rgba(58,42,42,0.22)');
    spine.addColorStop(1, 'rgba(58,42,42,0)');
    ctx.fillStyle = spine;
    ctx.fillRect(cx - 14, bookY, 28, pageH);

    const story = READING_STORIES[overlay.storyIndex];
    ctx.textAlign = 'left';
    ctx.fillStyle = '#3a2a2a';
    ctx.font = '17px Georgia, "Times New Roman", serif';
    for (const side of [0, 1]) {
      const pageIndex = overlay.page * 2 + side;
      const text = story.pages[pageIndex] ?? '';
      const x0 = side === 0 ? cx - pageW + 24 : cx + 24;
      wrapLines(text, pageW - 48).forEach((line, i) => ctx.fillText(line, x0, bookY + 42 + i * 25));
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(58,42,42,0.5)';
    ctx.font = '11px sans-serif';
    ctx.fillText(String(overlay.page * 2 + 1), cx - pageW / 2, bookY + pageH - 12);
    ctx.fillText(String(overlay.page * 2 + 2), cx + pageW / 2, bookY + pageH - 12);

    // A slim bar fills over the minimum time per spread; then you may turn.
    const barY = bookY + pageH + 20;
    drawRoundRect(ctx, cx - 120, barY, 240, 6, 3, 'rgba(58,42,42,0.15)');
    drawRoundRect(ctx, cx - 120, barY, 240 * overlay.progress, 6, 3, overlay.progress >= 1 ? '#7fd68a' : '#7fb0d6');
    ctx.fillStyle = LABEL_TEXT_COLOR;
    ctx.font = 'bold 13px sans-serif';
    const isLast = overlay.page >= READING_PAGES - 1;
    const ready = isLast ? 'Close the book when you\'re done →' : 'Turn the page when you\'re ready →';
    const status = overlay.progress >= 1 ? ready : (overlay.nudge > 0 ? 'Take your time — keep reading…' : 'Reading…');
    ctx.fillText(`${status}   (${overlay.page + 1}/${READING_PAGES})`, cx, barY + 26);
  }

  function drawTillCountOverlay() {
    drawOverlayBackdrop();
    const cx = CANVAS_WIDTH / 2;
    drawWindow(120, 130, CANVAS_WIDTH - 240, 360);
    ctx.fillStyle = LABEL_TEXT_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('Count the Till', cx, 165);
    ctx.font = '13px sans-serif';
    ctx.fillText(`Count exactly ${overlay.target} Gard into the till. Tap coins/bills or press 1-4; Undo or Backspace takes one back.`, cx, 187);

    // Running total vs. the fine owed, with a progress bar.
    const total = tillTotal();
    drawRoundRect(ctx, cx - 160, 205, 320, 64, 12, '#3a3440');
    ctx.fillStyle = '#9fe0a8';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(`${total} / ${overlay.target}g`, cx, 248);
    drawRoundRect(ctx, cx - 150, 278, 300, 10, 5, 'rgba(58,42,42,0.15)');
    drawRoundRect(ctx, cx - 150, 278, 300 * Math.min(1, total / overlay.target), 10, 5, '#e0a83a');

    // What's been counted so far, as little coin/bill tokens.
    overlay.added.slice(-16).forEach((v, i, arr) => {
      const tx = cx - ((arr.length - 1) * 14) / 2 + i * 14;
      if (v >= 10) drawRoundRect(ctx, tx - 6, 298, 12, 18, 2, v === 20 ? '#7fb08a' : '#9fc4d6');
      else {
        ctx.fillStyle = v === 5 ? '#e0a83a' : '#c9a24a';
        ctx.beginPath();
        ctx.arc(tx, 307, v === 5 ? 6.5 : 5, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    const rects = tillButtonRects();
    rects.denominations.forEach((r, i) => {
      drawRoundRect(ctx, r.x, r.y, r.w, r.h, 12, '#fdf8ee');
      ctx.strokeStyle = 'rgba(58,42,42,0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 12);
      ctx.stroke();
      const mx = r.x + r.w / 2;
      const my = r.y + 26;
      if (r.value >= 10) {
        drawRoundRect(ctx, mx - 22, my - 12, 44, 24, 3, r.value === 20 ? '#7fb08a' : '#9fc4d6');
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(mx - 18, my - 8, 36, 16);
      } else {
        ctx.fillStyle = r.value === 5 ? '#e0a83a' : '#c9a24a';
        ctx.beginPath();
        ctx.arc(mx, my, r.value === 5 ? 14 : 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(138,90,40,0.6)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.fillStyle = LABEL_TEXT_COLOR;
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(`${r.value}g`, mx, my + 4);
      ctx.font = '10px sans-serif';
      ctx.fillStyle = 'rgba(58,42,42,0.6)';
      ctx.fillText(`[${i + 1}]`, mx, r.y + r.h - 6);
    });

    const u = rects.undo;
    drawRoundRect(ctx, u.x, u.y, u.w, u.h, 10, overlay.added.length ? '#a08a7a' : 'rgba(160,138,122,0.4)');
    ctx.fillStyle = '#fdf8ee';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('Undo', u.x + u.w / 2, u.y + u.h / 2 + 4);

    if (overlay.flash) {
      drawRoundRect(ctx, cx - 90, 468, 180, 28, 14, '#e06a5b');
      ctx.fillStyle = '#fdf8ee';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(overlay.flash.text, cx, 487);
    }
  }

  function drawCoffeePourOverlay() {
    drawOverlayBackdrop();
    const cx = CANVAS_WIDTH / 2;
    drawWindow(cx - 210, 110, 420, 400);
    ctx.fillStyle = LABEL_TEXT_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('Pour a Coffee', cx, 145);
    ctx.font = '13px sans-serif';
    ctx.fillText('Hold mouse/tap or Space/Enter to pour. Let go in the gold band.', cx, 167);

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

  function drawKarenOverlay() {
    drawOverlayBackdrop();
    drawLibraryPerson(ctx, CANVAS_WIDTH / 2, 340, { personalityKey: 'karen', scale: 1.3, angryTint: true });
    speechBubble(ctx, { x: 130, y: 150, w: CANVAS_WIDTH - 260, h: 90 }, { tailX: CANVAS_WIDTH / 2, tailY: 262 });
    ctx.fillStyle = LABEL_TEXT_COLOR;
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    wrapText(KAREN_LINE, CANVAS_WIDTH / 2, 185, CANVAS_WIDTH - 300, 20);
    ctx.font = '12px sans-serif';
    ctx.fillText(`${Math.max(0, Math.ceil(shiftState.karen.timerSecondsRemaining))}s to respond`, CANVAS_WIDTH / 2, 225);

    const buttons = karenButtonRects();
    animeButton(ctx, buttons.collect, 'Collect the Fine', ANIME.sky, ANIME.skyDeep, 'bold 13px sans-serif');
    animeButton(ctx, buttons.slide, 'Let It Slide', ANIME.gold, ANIME.goldDeep, 'bold 13px sans-serif');
  }

  function wrapText(text, cx, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let lineY = y;
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      if (ctx.measureText(testLine).width > maxWidth && line) {
        ctx.fillText(line, cx, lineY);
        line = word;
        lineY += lineHeight;
      } else {
        line = testLine;
      }
    }
    if (line) ctx.fillText(line, cx, lineY);
  }

  function drawOverlay() {
    if (!overlay) return;
    if (overlay.kind === 'skill-check') drawSkillCheckOverlay();
    else if (overlay.kind === 'coin-hunt') drawCoinHuntOverlay();
    else if (overlay.kind === 'fines-sort') drawFinesSortOverlay();
    else if (overlay.kind === 'find-the-book') drawFindTheBookOverlay();
    else if (overlay.kind === 'karen') drawKarenOverlay();
    else if (overlay.kind === 'coffee-pour') drawCoffeePourOverlay();
    else if (overlay.kind === 'till-count') drawTillCountOverlay();
    else if (overlay.kind === 'reading') drawReadingOverlay();
    else if (overlay.kind === 'boss-cutscene') drawBossCutscene();
  }

  /**
   * Director Seo's office ("make teh office look better"): striped wallpaper
   * with crown molding and wainscot panels; a floor-to-ceiling window onto
   * Seoul at night (layered skyline, lit windows, Namsan Tower, a glowing
   * moon, stars) between sheer curtains; a styled bookcase; a framed 감사장;
   * a tall monstera; a walnut desk with a glowing monitor, keyboard,
   * steaming coffee, a lamp and his nameplate; glossy planks with a
   * patterned rug; moonlight and lamplight pools and a soft vignette.
   */
  function drawDirectorOffice(T) {
    const W = CANVAS_WIDTH;
    const H = CANVAS_HEIGHT;
    const FLOOR_Y = 400;

    // Wall: warm gradient with a soft pinstripe wallpaper.
    const wall = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
    wall.addColorStop(0, '#efe0c8');
    wall.addColorStop(1, '#e4cfb0');
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, W, FLOOR_Y);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    for (let x = 0; x < W; x += 22) ctx.fillRect(x, 24, 8, FLOOR_Y - 120);
    // Crown molding.
    ctx.fillStyle = '#f8efe0';
    ctx.fillRect(0, 0, W, 24);
    ctx.fillStyle = 'rgba(120,80,40,0.25)';
    ctx.fillRect(0, 24, W, 3);
    // Wainscot: a chair rail and recessed panels.
    ctx.fillStyle = '#a77a52';
    ctx.fillRect(0, FLOOR_Y - 96, W, 96);
    ctx.fillStyle = '#bc8e64';
    ctx.fillRect(0, FLOOR_Y - 100, W, 8);
    for (let x = 14; x < W; x += 118) {
      drawRoundRect(ctx, x, FLOOR_Y - 80, 100, 66, 4, 'rgba(0,0,0,0.12)');
      drawRoundRect(ctx, x + 3, FLOOR_Y - 77, 94, 60, 3, '#ad8058');
    }

    // The big window onto Seoul at night.
    const win = { x: 520, y: 34, w: 400, h: 300 };
    const sky = ctx.createLinearGradient(0, win.y, 0, win.y + win.h);
    sky.addColorStop(0, '#141c44');
    sky.addColorStop(0.6, '#2c3470');
    sky.addColorStop(1, '#5a4c86');
    drawRoundRect(ctx, win.x - 8, win.y - 8, win.w + 16, win.h + 16, 6, '#f6ecdc');
    ctx.fillStyle = sky;
    ctx.fillRect(win.x, win.y, win.w, win.h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(win.x, win.y, win.w, win.h);
    ctx.clip();
    // Stars, twinkling.
    for (let i = 0; i < 26; i++) {
      const sx = win.x + ((i * 97) % win.w);
      const sy = win.y + 8 + ((i * 53) % 120);
      ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.35 * Math.sin(T * 3 + i)})`;
      ctx.fillRect(sx, sy, 2, 2);
    }
    // The moon with a soft glow.
    const mx = win.x + 320;
    const my = win.y + 70;
    const glow = ctx.createRadialGradient(mx, my, 10, mx, my, 70);
    glow.addColorStop(0, 'rgba(255,246,207,0.45)');
    glow.addColorStop(1, 'rgba(255,246,207,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(mx - 70, my - 70, 140, 140);
    ctx.fillStyle = '#fff6cf';
    ctx.beginPath();
    ctx.arc(mx, my, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(220,200,150,0.35)';
    ctx.beginPath();
    ctx.arc(mx - 6, my - 4, 5, 0, Math.PI * 2);
    ctx.arc(mx + 7, my + 6, 3.5, 0, Math.PI * 2);
    ctx.fill();
    // Namsan Tower on its hill, far away.
    ctx.fillStyle = '#2a2f5e';
    ctx.beginPath();
    ctx.moveTo(win.x + 40, win.y + win.h);
    ctx.quadraticCurveTo(win.x + 120, win.y + 170, win.x + 200, win.y + win.h);
    ctx.fill();
    ctx.fillStyle = '#3a4078';
    ctx.fillRect(win.x + 117, win.y + 120, 6, 66);
    drawRoundRect(ctx, win.x + 108, win.y + 128, 24, 12, 4, '#3a4078');
    ctx.fillStyle = 'rgba(255,120,140,0.9)';
    ctx.beginPath();
    ctx.arc(win.x + 120, win.y + 104, 2.4 + Math.sin(T * 4) * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a4078';
    ctx.fillRect(win.x + 119, win.y + 104, 2, 18);
    // Far skyline, then the nearer, darker one with lit windows.
    for (const [layer, color, minH, maxH, lit] of [[0, '#2e3366', 60, 120, 0.25], [1, '#1c2146', 80, 170, 0.6]]) {
      let x = win.x - 10;
      let n = layer * 7;
      while (x < win.x + win.w) {
        const bw = 26 + ((n * 17) % 22);
        const bh = minH + ((n * 41) % (maxH - minH));
        const top = win.y + win.h - bh;
        ctx.fillStyle = color;
        ctx.fillRect(x, top, bw, bh);
        for (let wy = top + 8; wy < win.y + win.h - 6; wy += 10) {
          for (let wx = x + 4; wx < x + bw - 4; wx += 7) {
            if (((wx * 7 + wy * 3 + n) % 10) / 10 < lit) {
              ctx.fillStyle = layer ? 'rgba(255,214,120,0.9)' : 'rgba(255,214,120,0.45)';
              ctx.fillRect(wx, wy, 3, 4);
            }
          }
        }
        x += bw + 3;
        n++;
      }
    }
    ctx.restore();
    // Mullions and a sill.
    ctx.fillStyle = '#f6ecdc';
    ctx.fillRect(win.x + win.w / 2 - 3, win.y, 6, win.h);
    ctx.fillRect(win.x, win.y + win.h * 0.55, win.w, 5);
    drawRoundRect(ctx, win.x - 14, win.y + win.h + 6, win.w + 28, 10, 3, '#e8d8bf');
    // Sheer curtains gathered at each side, with folds.
    for (const side of [-1, 1]) {
      const cx = side < 0 ? win.x - 18 : win.x + win.w - 34;
      const cw = 52;
      const g = ctx.createLinearGradient(cx, 0, cx + cw, 0);
      g.addColorStop(0, 'rgba(255,250,240,0.85)');
      g.addColorStop(1, 'rgba(255,250,240,0.55)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx, win.y - 14);
      ctx.lineTo(cx + cw, win.y - 14);
      ctx.quadraticCurveTo(cx + cw * (side < 0 ? 0.6 : 0.4), win.y + 160, cx + cw * (side < 0 ? 0.8 : 0.2), win.y + win.h + 18);
      ctx.lineTo(cx + cw * (side < 0 ? 0.1 : 0.9) - side * 4, win.y + win.h + 18);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(200,180,150,0.45)';
      ctx.lineWidth = 1.2;
      for (let k = 1; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(cx + (cw * k) / 4, win.y - 10);
        ctx.quadraticCurveTo(cx + (cw * k) / 4 + side * 2, win.y + 150, cx + cw * (side < 0 ? 0.25 + k * 0.15 : 0.75 - k * 0.15), win.y + win.h + 14);
        ctx.stroke();
      }
    }
    // The curtain rod.
    drawRoundRect(ctx, win.x - 34, win.y - 20, win.w + 68, 6, 3, '#8a6a4a');

    // The bookcase, styled with books, a plant, a photo and a trophy.
    drawRoundRect(ctx, 30, 96, 180, 306, 8, '#6e4428');
    drawRoundRect(ctx, 38, 104, 164, 290, 6, '#4e2f1c');
    const colors = [ANIME.pink, ANIME.sky, ANIME.gold, ANIME.mint, ANIME.lavender, ANIME.coral, '#f2e6d0'];
    for (let r = 0; r < 4; r++) {
      const sy = 112 + r * 70;
      drawRoundRect(ctx, 38, sy + 60, 164, 8, 2, '#7a4e30');
      if (r === 1) {
        // A small potted plant and a framed photo.
        drawRoundRect(ctx, 54, sy + 38, 22, 22, 4, '#e8e0d4');
        ctx.fillStyle = '#4f9a6a';
        for (const [lx, ly, rot] of [[60, sy + 30, -0.5], [70, sy + 28, 0.4], [65, sy + 24, 0]]) {
          ctx.beginPath();
          ctx.ellipse(lx, ly, 5, 9, rot, 0, Math.PI * 2);
          ctx.fill();
        }
        drawRoundRect(ctx, 94, sy + 22, 32, 38, 3, '#c9a24a');
        drawRoundRect(ctx, 98, sy + 26, 24, 30, 2, '#cfe4f6');
        ctx.fillStyle = '#f2d2b6';
        ctx.beginPath();
        ctx.arc(110, sy + 38, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3a2620';
        ctx.fillRect(104, sy + 46, 12, 10);
        for (let b = 0; b < 4; b++) drawRoundRect(ctx, 140 + b * 14, sy + 10 + (b % 2) * 4, 11, 50 - (b % 2) * 4, 2, colors[(b + 2) % colors.length]);
      } else if (r === 3) {
        // A gold trophy and books leaning on it.
        ctx.fillStyle = '#e8c25a';
        ctx.beginPath();
        ctx.moveTo(150, sy + 12);
        ctx.lineTo(176, sy + 12);
        ctx.quadraticCurveTo(174, sy + 34, 163, sy + 38);
        ctx.quadraticCurveTo(152, sy + 34, 150, sy + 12);
        ctx.fill();
        ctx.fillRect(160, sy + 38, 6, 12);
        drawRoundRect(ctx, 152, sy + 50, 22, 10, 2, '#7a4e30');
        for (let b = 0; b < 6; b++) drawRoundRect(ctx, 48 + b * 14, sy + 8 + (b % 3) * 3, 11, 52 - (b % 3) * 3, 2, colors[(b + r) % colors.length]);
        ctx.save();
        ctx.translate(136, sy + 60);
        ctx.rotate(-0.28);
        drawRoundRect(ctx, -11, -50, 11, 50, 2, ANIME.coral);
        ctx.restore();
      } else {
        for (let b = 0; b < 10; b++) drawRoundRect(ctx, 46 + b * 15, sy + 8 + ((b + r) % 3) * 3, 12, 52 - ((b + r) % 3) * 3, 2, colors[(b + r) % colors.length]);
      }
    }

    // The framed certificate.
    drawRoundRect(ctx, 262, 40, 128, 92, 6, '#c9a24a');
    drawRoundRect(ctx, 270, 48, 112, 76, 4, '#fffaf0');
    ctx.strokeStyle = 'rgba(201,162,74,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(276, 54, 100, 64);
    ctx.fillStyle = '#5a3a1a';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('감사장', 326, 76);
    ctx.font = '10px sans-serif';
    ctx.fillText('Seoul Library Award', 326, 100);
    ctx.fillStyle = '#d42a4c';
    ctx.beginPath();
    ctx.arc(362, 112, 6, 0, Math.PI * 2);
    ctx.fill();

    // A tall monstera in a white planter by the wall.
    const px = 450;
    drawRoundRect(ctx, px - 24, FLOOR_Y - 46, 48, 46, 8, '#f4efe6');
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(px - 24, FLOOR_Y - 46, 48, 8);
    for (const [lx, ly, rot, sz] of [[-26, -110, -0.7, 1], [24, -120, 0.6, 1.1], [-6, -150, -0.1, 1.15], [30, -78, 1, 0.85], [-30, -70, -1.1, 0.8]]) {
      const sway = Math.sin(T * 1.2 + lx) * 0.03;
      ctx.save();
      ctx.translate(px + lx, FLOOR_Y + ly);
      ctx.rotate(rot + sway);
      ctx.fillStyle = '#3f8a5a';
      ctx.beginPath();
      ctx.ellipse(0, 0, 20 * sz, 26 * sz, 0, 0, Math.PI * 2);
      ctx.fill();
      // Monstera splits.
      ctx.strokeStyle = '#e4cfb0';
      ctx.lineWidth = 2;
      for (const k of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(k * 20 * sz, -6 * sz);
        ctx.lineTo(k * 9 * sz, -3 * sz);
        ctx.moveTo(k * 19 * sz, 8 * sz);
        ctx.lineTo(k * 8 * sz, 6 * sz);
        ctx.stroke();
      }
      ctx.strokeStyle = '#2f6a44';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, -24 * sz);
      ctx.lineTo(0, 24 * sz);
      ctx.stroke();
      ctx.restore();
    }
    ctx.strokeStyle = '#2f6a44';
    ctx.lineWidth = 2;
    for (const [lx, ly] of [[-26, -90], [24, -100], [-6, -130], [30, -66], [-30, -58]]) {
      ctx.beginPath();
      ctx.moveTo(px, FLOOR_Y - 44);
      ctx.quadraticCurveTo(px + lx * 0.3, FLOOR_Y + ly * 0.6, px + lx, FLOOR_Y + ly + 16);
      ctx.stroke();
    }

    // Floor: glossy walnut planks, staggered seams, the window's moonlight.
    const floor = ctx.createLinearGradient(0, FLOOR_Y, 0, H);
    floor.addColorStop(0, '#8a5a36');
    floor.addColorStop(1, '#6e4428');
    ctx.fillStyle = floor;
    ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);
    ctx.strokeStyle = 'rgba(40,20,8,0.3)';
    ctx.lineWidth = 1.5;
    for (let row = 0, y = FLOOR_Y + 22; y < H; y += 26, row++) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      for (let x = (row % 2) * 70; x < W; x += 140) {
        ctx.beginPath();
        ctx.moveTo(x, y - 26);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }
    ctx.fillStyle = 'rgba(180,200,255,0.12)';
    ctx.beginPath();
    ctx.moveTo(win.x + 20, FLOOR_Y);
    ctx.lineTo(win.x + win.w - 20, FLOOR_Y);
    ctx.lineTo(win.x + win.w + 60, H);
    ctx.lineTo(win.x - 80, H);
    ctx.closePath();
    ctx.fill();
    // A patterned rug where the two of them meet.
    drawRoundRect(ctx, 130, 470, 420, 96, 10, '#8a2a3e');
    drawRoundRect(ctx, 140, 478, 400, 80, 8, '#b84a5a');
    ctx.strokeStyle = '#e8c25a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(150, 486, 380, 64, 6);
    ctx.stroke();
    ctx.fillStyle = 'rgba(232,194,90,0.7)';
    for (let x = 175; x < 520; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 506);
      ctx.lineTo(x + 8, 518);
      ctx.lineTo(x, 530);
      ctx.lineTo(x - 8, 518);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = '#f2e6d0';
    ctx.lineWidth = 1.2;
    for (let x = 134; x < 548; x += 6) {
      for (const y of [470, 566]) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + (y === 470 ? -5 : 5));
        ctx.stroke();
      }
    }

    // The walnut desk on slim metal legs.
    const dx = 600;
    const dy = 318;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(dx + 150, FLOOR_Y + 70, 170, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const lx of [dx + 18, dx + 282]) drawRoundRect(ctx, lx, dy + 20, 8, FLOOR_Y + 66 - dy - 20, 3, '#3a3c46');
    drawRoundRect(ctx, dx + 30, dy + 22, 240, 70, 6, '#5e3a24');
    drawRoundRect(ctx, dx + 40, dy + 32, 220, 22, 4, '#6e4428');
    drawRoundRect(ctx, dx + 140, dy + 40, 20, 5, 2, '#c9a24a');
    drawRoundRect(ctx, dx, dy, 300, 24, 6, '#7a4e30');
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(dx + 8, dy + 3, 284, 4);
    // Monitor with a glowing screen, keyboard, coffee and nameplate.
    drawRoundRect(ctx, dx + 108, dy - 74, 112, 70, 6, '#24262e');
    const scr = ctx.createLinearGradient(0, dy - 68, 0, dy - 10);
    scr.addColorStop(0, '#cfe8ff');
    scr.addColorStop(1, '#9ec8f0');
    drawRoundRect(ctx, dx + 114, dy - 68, 100, 58, 3, scr);
    ctx.fillStyle = '#3fb58f';
    for (let b = 0; b < 6; b++) ctx.fillRect(dx + 124 + b * 14, dy - 24 - b * 5, 8, 10 + b * 5);
    drawRoundRect(ctx, dx + 156, dy - 6, 16, 8, 2, '#3a3c46');
    drawRoundRect(ctx, dx + 112, dy + 2, 92, 8, 3, '#e8e8ee');
    drawRoundRect(ctx, dx + 228, dy - 14, 16, 16, 3, '#ffffff');
    ctx.fillStyle = '#5a3a26';
    ctx.fillRect(dx + 230, dy - 12, 12, 3);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1.4;
    for (const k of [0, 1]) {
      ctx.beginPath();
      ctx.moveTo(dx + 233 + k * 6, dy - 17);
      ctx.quadraticCurveTo(dx + 237 + k * 6 + Math.sin(T * 3 + k) * 2, dy - 26, dx + 233 + k * 6, dy - 34);
      ctx.stroke();
    }
    drawRoundRect(ctx, dx + 14, dy - 22, 84, 20, 4, '#24262e');
    ctx.fillStyle = '#e8c25a';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('관장 · Director Seo', dx + 56, dy - 12);
    // A brass arc desk lamp and its warm glow.
    ctx.strokeStyle = '#c9a24a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(dx + 276, dy);
    ctx.quadraticCurveTo(dx + 290, dy - 90, dx + 250, dy - 96);
    ctx.stroke();
    ctx.fillStyle = '#2f6a4a';
    ctx.beginPath();
    ctx.ellipse(dx + 246, dy - 92, 18, 9, 0.2, Math.PI, Math.PI * 2);
    ctx.fill();
    const lamp = ctx.createRadialGradient(dx + 240, dy - 70, 6, dx + 240, dy - 40, 120);
    lamp.addColorStop(0, 'rgba(255,220,140,0.42)');
    lamp.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.fillStyle = lamp;
    ctx.fillRect(dx + 100, dy - 160, 280, 260);

    // A soft vignette pulling the eye to the middle.
    const vig = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, W * 0.75);
    vig.addColorStop(0, 'rgba(20,10,20,0)');
    vig.addColorStop(1, 'rgba(20,10,20,0.35)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  function drawBossCutscene() {
    const T = overlay.t;
    const W = CANVAS_WIDTH;
    const H = CANVAS_HEIGHT;
    ctx.save();
    drawDirectorOffice(T);
    // Eun-mi by the door, Director Seo walking over from his desk.
    const walkU = Math.min(1, Math.max(0, (T - DIRECTOR_WALK[0]) / (DIRECTOR_WALK[1] - DIRECTOR_WALK[0])));
    const eased = walkU * walkU * (3 - 2 * walkU);
    const dirX = DIRECTOR_FROM_X + (DIRECTOR_TO_X - DIRECTOR_FROM_X) * eased;
    const walking = walkU > 0 && walkU < 1;
    // Eases in over the first steps and out as he arrives.
    const walkAmount = Math.min(1, Math.sin(walkU * Math.PI) * 2.2);
    const FEET = 540;
    drawLibraryPerson(ctx, 220, FEET, { personalityKey: 'librarian', scale: 1.45 });
    ctx.save();
    ctx.translate(dirX, FEET);
    applyWalk(ctx, 'libDirector', T, -1, walking);
    drawDirectorSeo(ctx, 0, 0, { scale: 1.45 * PLAYER_ART_SCALE, t: T, walkAmount });
    ctx.restore();
    drawLabelChip(ctx, 220, FEET + 22, PLAYER_NAME, 'bold 12px sans-serif');
    drawLabelChip(ctx, dirX, FEET + 22, 'Director Seo · 서 관장', 'bold 12px sans-serif');

    // His line, in a speech bubble once he's arrived.
    if (T > DIRECTOR_WALK[1]) {
      ctx.font = 'bold 15px sans-serif';
      const lines = wrapLines(overlay.line, 300);
      const bw = 330;
      const bh = 26 + lines.length * 20;
      const bx = DIRECTOR_TO_X - bw / 2 + 30;
      const by = FEET - 330 - bh; // above the monstera
      drawRoundRect(ctx, bx, by, bw, bh, 14, '#ffffff');
      ctx.strokeStyle = ANIME.ink;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 14);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(DIRECTOR_TO_X - 10, by + bh - 1);
      ctx.lineTo(DIRECTOR_TO_X + 6, by + bh + 26);
      ctx.lineTo(DIRECTOR_TO_X + 14, by + bh - 1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = ANIME.ink;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      lines.forEach((ln, i) => ctx.fillText(ln, bx + bw / 2, by + 22 + i * 20));
    }
    // The pay envelope passing from his hand to hers.
    if (T > 3.0) {
      const u = Math.min(1, (T - 3.0) / 0.7);
      const ex = DIRECTOR_TO_X - 40 + (220 + 40 - (DIRECTOR_TO_X - 40)) * u;
      const ey = FEET - 95 - Math.sin(u * Math.PI) * 18;
      drawRoundRect(ctx, ex - 18, ey - 11, 36, 22, 3, '#fffaf0');
      ctx.strokeStyle = 'rgba(90,60,30,0.6)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(ex - 18, ey - 11);
      ctx.lineTo(ex, ey + 2);
      ctx.lineTo(ex + 18, ey - 11);
      ctx.stroke();
      ctx.fillStyle = '#d42a4c';
      ctx.beginPath();
      ctx.arc(ex, ey + 2, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    drawLabelChip(ctx, 130, 30, '관장실 · Director\'s Office', 'bold 13px sans-serif', ANIME.coral, '#ffffff');
    drawLabelChip(ctx, W - 92, 30, 'Click to continue ▶', 'bold 12px sans-serif');
    // Fade in from, and out to, black.
    const fade = Math.max(0, 1 - T / 0.35, (T - (BOSS_CUTSCENE_SECONDS - 0.35)) / 0.35);
    if (fade > 0) {
      ctx.fillStyle = `rgba(20,14,24,${Math.min(1, fade)})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  // -- First Person rendering --------------------------------------------

  const FP_HORIZON_Y = CANVAS_HEIGHT / 2;
  const FP_CEILING_COLOR = '#e8ddc8';
  const FP_FLOOR_COLOR_NEAR = '#cbab7c';
  const FP_FLOOR_COLOR_FAR = '#b08f5e';

  /**
   * Doc's Visual Direction for First Person: "a simple background: a
   * floor-color band below a horizon line and a sky/ceiling-color band
   * above it" — no wall texture or raycast, just the two flat bands plus a
   * subtle floor gradient for a cheap sense of depth.
   */
  function drawFirstPersonBackground() {
    ctx.fillStyle = FP_CEILING_COLOR;
    ctx.fillRect(0, 0, CANVAS_WIDTH, FP_HORIZON_Y);

    const floorGradient = ctx.createLinearGradient(0, FP_HORIZON_Y, 0, CANVAS_HEIGHT);
    floorGradient.addColorStop(0, FP_FLOOR_COLOR_NEAR);
    floorGradient.addColorStop(1, FP_FLOOR_COLOR_FAR);
    ctx.fillStyle = floorGradient;
    ctx.fillRect(0, FP_HORIZON_Y, CANVAS_WIDTH, CANVAS_HEIGHT - FP_HORIZON_Y);

    ctx.strokeStyle = 'rgba(58,42,42,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, FP_HORIZON_Y);
    ctx.lineTo(CANVAS_WIDTH, FP_HORIZON_Y);
    ctx.stroke();

    ctx.fillStyle = '#8a6a4a';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(currentFloor === FLOOR_1 ? '1st Floor' : '2nd Floor', CANVAS_WIDTH / 2, 24);
  }

  /**
   * Draws one projected entity (as produced by `first-person.js`'s
   * `projectScene`) via the SAME art functions Top-Down uses —
   * `drawLibraryPerson` for a front-desk patron, `drawStation`'s billboard
   * mode for every station — per the doc's explicit instruction not to
   * reinvent the art for this camera mode. `entity.groundY` is where the
   * entity's ground-contact point sits on screen (first-person.js's
   * perspective stand-in); each branch below anchors its own art to that
   * point using its own known height, same as Top-Down anchors each shape
   * to the station/player's own y.
   */
  function drawFirstPersonEntity(entity) {
    if (entity.entityKind === 'frontDeskSlot' || entity.entityKind === 'finesSlot') {
      const slot = entity.ref;
      const personality = personalityForSlot(slot, entity.slotIndex ?? 0);
      drawLibraryPerson(ctx, entity.screenX, entity.groundY, {
        personalityKey: personality,
        scale: entity.scale * 0.62,
        angryTint: slot.kind === 'karen',
      });
      return;
    }
    if (entity.entityKind === 'returnCartBook') {
      const book = entity.ref;
      const genre = findGenre(book.genreId);
      const w = 18 * entity.scale;
      const h = 24 * entity.scale;
      drawRoundRect(ctx, entity.screenX - w / 2, entity.groundY - h, w, h, 2 * entity.scale, genre ? genre.color : '#8a6a4a');
      return;
    }
    // 'station' — anchor the box's bottom edge (not its center) to groundY,
    // so it visually "stands" on the floor band rather than floating
    // centered on the horizon.
    const station = entity.ref;
    const halfOnScreen = stationExtents(station).hh * entity.scale;
    drawStation(station, {
      scale: entity.scale,
      centerX: entity.screenX,
      centerY: entity.groundY - halfOnScreen,
      skipLabel: true,
    });
  }

  function drawFirstPersonCrosshair() {
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;
    const armLength = 9;
    const gap = 3;
    ctx.save();
    ctx.strokeStyle = fpScene.interactTarget ? '#e0a83a' : 'rgba(58,42,42,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - armLength, cy);
    ctx.lineTo(cx - gap, cy);
    ctx.moveTo(cx + gap, cy);
    ctx.lineTo(cx + armLength, cy);
    ctx.moveTo(cx, cy - armLength);
    ctx.lineTo(cx, cy - gap);
    ctx.moveTo(cx, cy + gap);
    ctx.lineTo(cx, cy + armLength);
    ctx.stroke();
    ctx.restore();
  }

  function drawFirstPersonView() {
    drawFirstPersonBackground();
    // `fpScene.projected` is already sorted back-to-front by
    // `first-person.js`'s `projectScene` — drawing in that order alone
    // gives correct nearer-over-farther layering (simple painter's
    // algorithm), no per-entity z-check needed here.
    for (const entity of fpScene.projected) drawFirstPersonEntity(entity);
    drawFirstPersonCrosshair();
  }

  /**
   * Keeps the canvas's backing store matched to its on-screen size × the
   * device pixel ratio (capped at 3×), as Hospital Shift does, so the art
   * stays crisp when the 960×600 world is shown larger, in fullscreen or on
   * a Retina display. The world coordinate system is unchanged — render()
   * scales into it, and input mapping already uses CANVAS_WIDTH/HEIGHT.
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
    lastFrameDrewPlayerSprite = false;
    const shake = currentIntensity() > 0.6 ? (currentIntensity() - 0.6) * 5 : 0;
    ctx.save();
    if (shake > 0) ctx.translate((random() - 0.5) * shake, (random() - 0.5) * shake);
    if (cameraMode === 'first-person') {
      drawFirstPersonView();
    } else {
      drawFloor();
      stationsOnFloor(stations, currentFloor).forEach((station) => drawStation(station));
      drawCoffeeOutOfOrder();
      drawReturnCartBooks();
      drawFrontDeskSlots();
      drawFinesCounterSlots();
      drawQueueStationLabels();
      drawAmbient(false);
      drawPlayer();
      drawAmbient(true);
    }
    drawHallucinations();
    drawDailyChip();
    ctx.restore();
    // Doc's Scope: "Sanity/Mood bars, the HUD clock, and all five minigame
    // overlays are unchanged and must still work identically in First
    // Person Mode" — drawn unconditionally, outside the camera-mode branch
    // above, same as every other frame.
    drawSanityBar();
    drawLibraryMoodBar();
    drawRatingStars();
    drawGardCounter();
    drawOverlay();
  }

  // -- Game loop --------------------------------------------------------------

  // Test-only (window.__libraryGameTestHooks.freeze/step): while frozen
  // the loop keeps drawing but stops advancing the simulation, so an e2e
  // test can set a value (a coffee fill) and act on it through the real
  // input handlers, which still run, without live frames moving it first.
  let testFrozen = false;

  function loop(timestamp) {
    if (!running || paused) { rafHandle = null; return; }
    if (lastTimestamp === null) lastTimestamp = timestamp;
    const deltaSeconds = Math.min(0.1, (timestamp - lastTimestamp) / 1000);
    lastTimestamp = timestamp;

    if (testFrozen) render();
    else stepSimulation(deltaSeconds);

    rafHandle = window.requestAnimationFrame(loop);
  }

  function stepSimulation(deltaSeconds) {
    if (!overlay) {
      updatePlayer(deltaSeconds);
      updateFirstPersonMovement(deltaSeconds);
    }
    updateAmbient(deltaSeconds);

    const beforeBorrowStage = shiftState.activeBorrow?.stage;
    const beforeKarenActive = shiftState.karen.active;
    const beforeWalkouts = shiftState.walkouts;
    const beforeComplaints = shiftState.complaints ?? 0;
    shiftState = tick(shiftState, deltaSeconds, { pauseBorrowPatience: overlay?.kind === 'find-the-book' });

    if (beforeBorrowStage === 'searching' && !shiftState.activeBorrow && overlay?.kind === 'find-the-book') {
      overlay = null;
      showToast('They gave up waiting…');
    }
    if (beforeKarenActive && !shiftState.karen.active && overlay?.kind === 'karen') {
      overlay = null;
      showToast('Karen stormed off without paying.');
    }

    trackGardPops(deltaSeconds);
    coffeeSplashSeconds = Math.max(0, coffeeSplashSeconds - deltaSeconds);
    updateHallucinations(deltaSeconds);

    if (waitingAtBossOffice && isBossOfficeReady(shiftState) && !overlay) {
      if (isPlayerAtBossOffice()) {
        enterBossOfficeNow();
      } else {
        waitingAtBossOffice = false;
      }
    }

    if ((shiftState.complaints ?? 0) > beforeComplaints) {
      showToast(`📨 A complaint letter from the boss — −${COMPLAINT_GARD} Gard. The library's mood is at rock bottom.`);
    } else if (shiftState.walkouts > beforeWalkouts) {
      showToast(shiftState.libraryMood <= 0
        ? `A frustrated patron stormed out — −${RATING_PENALTY_PER_WALKOUT}★`
        : `A patron got tired of waiting and left — −${RATING_PENALTY_PER_WALKOUT}★`);
    }

    if (shiftState.phase === 'playing') processScheduledEvents();

    updateOverlay(deltaSeconds);
    updateFirstPersonScene();
    updateHoverHint();
    renderHud();
    render();
  }

  // -- Fullscreen ---------------------------------------------------------

  function requestFullscreen() {
    if (document.fullscreenElement) return;
    const container = document.getElementById('library-game-container');
    container.requestFullscreen?.().catch(() => {});
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

  // -- Event wiring ---------------------------------------------------------

  canvas.addEventListener('click', onCanvasClick);
  canvas.addEventListener('pointerdown', onCanvasPointerDown);
  window.addEventListener('pointerup', onWindowPointerUp);
  window.addEventListener('pointercancel', onWindowPointerUp);
  canvas.addEventListener('mousemove', onCanvasMouseMove);
  canvas.addEventListener('mouseleave', onCanvasMouseLeave);
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  document.addEventListener('visibilitychange', onVisibilityChange);
  elements.fullscreenButton.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', onFullscreenChange);
  elements.floorButton?.addEventListener('click', () => switchFloor(currentFloor === FLOOR_1 ? FLOOR_2 : FLOOR_1));
  elements.cameraButton?.addEventListener('click', () => setCameraMode(cameraMode === 'top-down' ? 'first-person' : 'top-down'));

  // First Person's on-screen turn/move buttons (doc: "on-screen buttons (for
  // parity with the existing on-screen Fullscreen/floor-switch buttons)") —
  // press-and-hold, same continuous-while-held feel as the arrow keys
  // (`onKeyDown`/`onKeyUp`), not a one-shot click. Pointer events cover
  // mouse and touch alike; `pointerleave`/`pointercancel` guard against a
  // press that ends by the pointer sliding off the button rather than a
  // clean release, which would otherwise leave the direction stuck "held."
  function bindHoldButton(button, key) {
    if (!button) return;
    const press = (e) => { e.preventDefault(); heldFP[key] = true; };
    const release = () => { heldFP[key] = false; };
    button.addEventListener('pointerdown', press);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointerleave', release);
    button.addEventListener('pointercancel', release);
  }
  bindHoldButton(elements.fpControls?.turnLeftButton, 'turnLeft');
  bindHoldButton(elements.fpControls?.turnRightButton, 'turnRight');
  bindHoldButton(elements.fpControls?.forwardButton, 'forward');
  bindHoldButton(elements.fpControls?.backButton, 'back');
  elements.fpControls?.interactButton?.addEventListener('click', attemptInteract);

  elements.startScreen.shiftButton.addEventListener('click', startShift);
  elements.dailyCard?.button?.addEventListener('click', startDailyChallenge);
  elements.paycheckScreen.nextShiftButton.addEventListener('click', () => (daily ? startDailyChallenge() : startShift()));
  elements.paycheckScreen.backButton?.addEventListener('click', backToStart);
  renderDailyCard();
  elements.paycheckScreen.newMonthButton.addEventListener('click', startNewMonth);
  if (elements.paycheckScreen.submitButton) {
    elements.paycheckScreen.submitButton.addEventListener('click', () => {
      // Same real bug fixed in cooking-game.js/fishing-game.js's round-over
      // submit handlers: disabling a submit <button> synchronously in its
      // own click handler suppresses the form's default submit action.
      window.setTimeout(() => { elements.paycheckScreen.submitButton.disabled = true; }, 0);
    });
  }

  function teardown() {
    running = false;
    if (rafHandle !== null) {
      window.cancelAnimationFrame(rafHandle);
      rafHandle = null;
    }
    if (toastTimeoutHandle) window.clearTimeout(toastTimeoutHandle);
    canvas.removeEventListener('click', onCanvasClick);
    canvas.removeEventListener('pointerdown', onCanvasPointerDown);
    window.removeEventListener('pointerup', onWindowPointerUp);
    window.removeEventListener('pointercancel', onWindowPointerUp);
    canvas.removeEventListener('mousemove', onCanvasMouseMove);
    canvas.removeEventListener('mouseleave', onCanvasMouseLeave);
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
    document.removeEventListener('fullscreenchange', onFullscreenChange);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    document.body.removeEventListener('htmx:beforeSwap', teardown);
    if (teardownActiveInstance === teardown) teardownActiveInstance = null;
  }

  document.body.addEventListener('htmx:beforeSwap', (e) => {
    if (e.target && e.target.id === 'main-content') teardown();
  });

  teardownActiveInstance = teardown;

  // Test-only debug hooks for e2e/library-game.spec.js — real-time shift
  // clocks here run 600/480/360 real seconds (doc's Business Rules,
  // deliberately much slower than Kitchen Shift's), far too slow to wait
  // out in a browser test. These expose exact canvas-space coordinates
  // (front-desk slots, Return Cart books, overlay item positions, the
  // skill-check gauge) so Playwright can drive the SAME real click path a
  // player uses, converted to page coordinates via the canvas's own
  // getBoundingClientRect — not a bypass of the UI, same spirit as Kitchen
  // Shift's own test-hooks comment.
  if (typeof window !== 'undefined') {
    window.__libraryGameTestHooks = {
      getPlayerPosition: () => ({ ...player }),
      setPlayerPosition: (x, y) => { player.x = x; player.y = y; },
      isPlayerMoving: () => moveTarget !== null,
      getCurrentFloor: () => currentFloor,
      getStations: () => stations.map((s) => ({ ...s })),
      getFrontDeskSlots: () => frontDeskSlots(),
      getFinesCounterSlots: () => finesCounterSlots(),
      getFinesStartShift: () => finesStartShiftNumber,
      getTillButtonRects: () => tillButtonRects(),
      getReturnCartSlots: () => returnCartSlots(),
      getOverlay: () => (overlay ? JSON.parse(JSON.stringify(overlay)) : null),
      // First Person Mode hooks — same "expose exact state, drive the real
      // input path" spirit as the rest of this object: tests call
      // `setCameraMode`/`setPlayerFacing` to get into a known camera/facing
      // state without hunting for the right turn amount, then still drive
      // the SAME `attemptInteract`/keyboard/on-screen-button paths a real
      // player uses for movement and interaction.
      getCameraMode: () => cameraMode,
      setCameraMode: (mode) => setCameraMode(mode),
      getPlayerFacing: () => playerFacing,
      setPlayerFacing: (facing) => { playerFacing = facing; },
      getFirstPersonScene: () => JSON.parse(JSON.stringify(fpScene)),
      attemptInteractNow: () => attemptInteract(),
      wasPlayerSpriteDrawnLastFrame: () => lastFrameDrewPlayerSprite,
      getShiftState: () => shiftState,
      skipCutscene: () => finishBossCutscene(),
      getDaily: () => (daily ? { date: daily.date, twistId: daily.twist.id } : null),
      getStaff(key) {
        const a = ambient.find((s) => s.key === key);
        // `scale` is in the anime-people units the click box uses (Ji-ho's renderer draws at PLAYER_ART_SCALE).
        return a ? { x: a.x, y: a.y, floor: a.floor, scale: a.key === 'jiho' ? (a.scale ?? 1) * PLAYER_ART_SCALE : a.scale ?? LIBRARY_PERSON_SCALE } : null;
      },
      getMinjun() {
        const mj = ambient.find((a) => a.key === 'minjun');
        return mj ? { x: mj.x, y: mj.y, floor: mj.floor, scale: mj.scale ?? 1, action: mj.action } : null;
      },
      isBossOfficeReady: () => shiftState && isBossOfficeReady(shiftState),
      spawnBookNow(isCoinHunt) { if (shiftState?.phase === 'playing') spawnBook(Boolean(isCoinHunt)); },
      spawnFineNow(amount) { if (shiftState?.phase === 'playing') spawnFine(amount); },
      spawnBorrowNow() { if (shiftState?.phase === 'playing') spawnBorrow(); },
      makeKarenAvailableNow() { karenAvailable = true; },
      forceKarenShiftNow() {
        // Karen's real shift is a deterministic hash of the save's seed
        // (rules.js's karenShiftForSeed) — this overrides
        // shiftState.karen.shiftNumber to the current shift directly so a
        // test doesn't need to hunt for (or reseed to land on) her actual
        // randomized shift.
        if (!shiftState) return;
        shiftState = { ...shiftState, karen: { ...shiftState.karen, shiftNumber: currentShiftNumber } };
        karenAvailable = true;
      },
      getActiveBorrowInfo() {
        const bookId = shiftState?.activeBorrow?.bookId;
        return bookId ? { bookId, ...bookCatalog.get(bookId) } : null;
      },
      finishReadingPageNow() { if (overlay?.kind === 'reading') overlay.progress = 1; },
      getGardPops: () => gardPops.map((pop) => ({ ...pop })),
      getHallucinations: () => ({ intensity: currentIntensity(), ghosts: halluc.ghosts.map((g) => ({ ...g })), figures: halluc.figures.length, whispers: halluc.whispers.length }),
      spawnGhostPatronNow() { halluc.ghosts.push({ id: `ghost-${halluc.ghostCounter++}`, age: 0, life: 60 }); },
      setCoffeePourFill(fill) { if (overlay?.kind === 'coffee-pour' && !overlay.grade) overlay.fill = fill; },
      /** Stops (true) or resumes (false) the simulation; input handlers still run, so a press/release while frozen acts on exactly the values a test set. */
      freeze(on) { testFrozen = Boolean(on); },
      /** Advances the simulation by one frame of `seconds` (default 1/60), frozen or not. */
      step(seconds = 1 / 60) { if (running && shiftState) stepSimulation(seconds); },
      /** Stops (true) or resumes (false) the wandering staff, so a test can click one where it read them. */
      freezeStaff(on) { testStaffFrozen = Boolean(on); },
      /** Holds back (true) or releases (false) the shift's scheduled arrivals; the hooks' own spawn*Now still work. */
      pauseScheduledEvents(on) { testEventsPaused = Boolean(on); },
      // `freeze` holds the marker still until the next click resolves it, so
      // a test's set-then-click can't race the sweep under load.
      setSkillCheckGauge(pos, { freeze = false } = {}) {
        if (overlay?.kind !== 'skill-check') return;
        overlay.gaugePosition = pos;
        overlay.frozen = freeze;
      },
      skipToClosing() {
        if (!running || !shiftState || shiftState.phase !== 'playing') return;
        shiftState = tick(shiftState, shiftState.totalClockSeconds + 1);
        shiftState = tick(shiftState, 9999);
        overlay = null;
      },
      collectPaycheck() {
        if (!shiftState || !isBossOfficeReady(shiftState)) return;
        shiftState = enterBossOffice(shiftState);
        endShift();
      },
    };
  }

  renderStartScreen();

  return teardown;
}

let teardownActiveInstance = null;

// ---------------------------------------------------------------------------
// Auto-bootstrap (browser only)
// ---------------------------------------------------------------------------

function bootstrap() {
  const canvas = document.getElementById('library-canvas');
  if (!canvas) return; // this page isn't mounted — no-op, same convention as cooking-game.js

  const elements = {
    hud: {
      shift: document.getElementById('library-hud-shift'),
      clock: document.getElementById('library-hud-clock'),
      status: document.getElementById('library-hud-status'),
    },
    hoverHint: document.getElementById('library-interact-hint'),
    toast: document.getElementById('library-toast'),
    fullscreenButton: document.getElementById('library-fullscreen-button'),
    floorButton: document.getElementById('library-floor-button'),
    cameraButton: document.getElementById('library-camera-button'),
    fpControls: {
      root: document.getElementById('library-fp-controls'),
      turnLeftButton: document.getElementById('library-fp-turn-left-button'),
      turnRightButton: document.getElementById('library-fp-turn-right-button'),
      forwardButton: document.getElementById('library-fp-forward-button'),
      backButton: document.getElementById('library-fp-back-button'),
      interactButton: document.getElementById('library-fp-interact-button'),
    },
    startScreen: {
      root: document.getElementById('library-start-screen'),
      shiftButton: document.getElementById('library-start-shift-button'),
    },
    startProgress: document.getElementById('library-start-progress'),
    dailyCard: {
      root: document.getElementById('library-daily-card'),
      date: document.getElementById('library-daily-date'),
      twist: document.getElementById('library-daily-twist'),
      blurb: document.getElementById('library-daily-blurb'),
      best: document.getElementById('library-daily-best'),
      button: document.getElementById('library-daily-button'),
    },
    paycheckScreen: {
      root: document.getElementById('library-paycheck-screen'),
      title: document.getElementById('library-paycheck-title'),
      outcome: document.getElementById('library-paycheck-outcome'),
      shiftTotal: document.getElementById('library-paycheck-shift-total'),
      monthTotal: document.getElementById('library-paycheck-month-total'),
      monthLabel: document.getElementById('library-paycheck-month-label'),
      finalHeading: document.getElementById('library-final-paycheck-heading'),
      dailyInput: document.getElementById('library-paycheck-daily-input'),
      backButton: document.getElementById('library-paycheck-back-button'),
      finalBlock: document.getElementById('library-final-paycheck-block'),
      earningsInput: document.getElementById('library-paycheck-earnings-input'),
      shiftsInput: document.getElementById('library-paycheck-shifts-input'),
      submitButton: document.getElementById('library-paycheck-submit-button'),
      nextShiftButton: document.getElementById('library-paycheck-next-shift-button'),
      newMonthButton: document.getElementById('library-paycheck-new-month-button'),
    },
  };

  init(canvas, elements);
}

if (typeof document !== 'undefined') {
  bootstrap();

  // A `<script type="module">`'s top-level code runs at most once per
  // resolved URL for the whole document's lifetime — so a revisit via HTMX
  // (navigate away from /library-game and back) recreates #library-canvas
  // but does NOT re-execute this file, leaving the freshly swapped-in start
  // screen visually intact but completely inert. Same real, previously-
  // shipped bug documented in cooking-game.js's own bootstrap() comment
  // (see that file for the full writeup) — fixed the identical way here:
  // document.body survives every #main-content swap, so this listener,
  // registered once during this file's one-and-only execution, re-runs
  // bootstrap() on every later swap too. init()'s own
  // teardown-previous-instance guard makes calling bootstrap() again safe
  // even when this listener and the direct call above both fire for the
  // same navigation.
  document.body.addEventListener('htmx:afterSwap', (e) => {
    if (e.target && e.target.id === 'main-content') bootstrap();
  });
}
