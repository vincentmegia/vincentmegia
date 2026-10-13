// Bus Rush: canvas loop, input, localStorage progress, and DOM wiring
// (docs/features/bus-rush.md). Every rule/number lives in ./busrush/rules.js;
// this file only applies them frame by frame and draws the result.
//
// Nothing touches the DOM at module evaluation except the bootstrap at the
// bottom, which re-runs on every HTMX swap into #main-content — a module
// script only executes once per page lifetime, so a revisit via HTMX would
// otherwise leave the new canvas unwired (see fishing-game.js's bootstrap
// comment for the original bug).

import {
  LANES,
  PX_PER_METER,
  MIN_SPEED,
  TRAFFIC_SPEED,
  HIT_GRACE_SECONDS,
  BUS_LENGTH,
  DISTANCE_MAX,
  UPGRADES,
  VEHICLES,
  stepSpeed,
  minSpeed,
  toKmh,
  laneChangeSeconds,
  maxLives,
  runScore,
  runTokens,
  upgradeCost,
  canBuy,
  rowSpacingPx,
  pickBlockedLanes,
  openLanes,
  pickVehicle,
  rectsOverlap,
  livesAfterHit,
  fareOffset,
  WANTED_MAX,
  POLICE_FIRST_SECONDS,
  POLICE_SPAWN_SECONDS,
  POLICE_CAR,
  wantedLevel,
  policeSpeed,
  maxPolice,
  policeReactionSeconds,
  roadblockChance,
  policeWreckPoints,
  LEVELS,
  LEVEL_DISTANCE,
  LEVEL_SPEED_STEP,
  maxSpeed,
  levelAt,
  checkpointPoints,
  SKID_SECONDS,
  spillDrops,
  BUSES,
  busDef,
  GARBAGE_SLOW_SECONDS,
  skidLane,
  FUEL_STUN_SECONDS,
  FUEL_FUSE_SECONDS,
  FUEL_BLAST_RADIUS,
  TANKER_ESCAPE_POINTS,
  inBlast,
  ramOutcome,
  SWAT_VAN,
  maxSwat,
  helicopterActive,
  SPIKE_DROP_SECONDS,
  SPIKE_LEAD_PX,
  SPIKES,
  POWERUPS,
  NITRO_PUSH_PX,
  MAGNET_RADIUS,
  powerupAt,
  shieldAbsorbs,
  POTHOLE_CHANCE,
  POTHOLE_MIN_DISTANCE,
  PEDESTRIAN_CHANCE,
  PEDESTRIAN_MIN_DISTANCE,
  PEDESTRIAN_SPEED,
  PEDESTRIAN,
  pedestriansAllowed,
  CONSTRUCTION_MIN_DISTANCE,
  CONSTRUCTION_CHANCE,
  CONSTRUCTION_LENGTH,
  BARRIER,
  constructionLane,
  zonePushLane,
  MISSIONS,
  missionProgress,
  missionDone,
  refillMissions,
  ACHIEVEMENTS,
  addLifetime,
  newAchievements,
  explosive,
  isHazmat,
  crashTimings,
  SAND_CHANCE,
  SAND_SLOW_SECONDS,
  sandAllowed,
  STORM_SECONDS,
  WET_GRIP,
  PUDDLE_CHANCE,
  SPLASH_SECONDS,
  stormStarts,
  TIP_SECONDS,
  DRIFT_RADIUS,
  DRIFT_DRAG_PX,
  MIXER_BRAKE_SECONDS,
  TIP_SLOWMO,
  MIXER_TOPPLE_POINTS,
  canDrift,
  RAMP_MIN_DISTANCE,
  RAMP_CHANCE,
  RAMP_TRUCK,
  TRACK_SECONDS,
  TRACKS,
  TRAIN,
  TRAIN_LENGTH,
  TRAIN_WARNING_SECONDS,
  nextTrainTrack,
  trainGapSeconds,
  trainClosingSpeed,
  DAILY_BUS,
  seededRng,
  dailyDate,
  dailySeed,
} from './busrush/rules.js';
import { drawPerson } from './shared/people.js';

const STORAGE_KEY = 'bus-rush:v1';

const WIDTH = 480;
const HEIGHT = 640;
const SHOULDER = 40;
const LANE_WIDTH = (WIDTH - SHOULDER * 2) / LANES;
// Room below the bus for pursuing police to close in from.
const BUS_Y = HEIGHT - BUS_LENGTH - 110;
const POLICE_LANE_SECONDS = 0.35;
const BANNER_SECONDS = 2.4;
const FADE_SECONDS = 1.2;
const FARE_RADIUS = 13;
const FARE_CHANCE = 0.7;

const VEHICLE_COLORS = ['#3f6e9e', '#e8e1d3', '#33312e', '#d9a93f', '#5f8a5b', '#8c5a7a', '#7d8a94'];

function laneCenter(lane) {
  return SHOULDER + LANE_WIDTH * lane + LANE_WIDTH / 2;
}

// ---------------------------------------------------------------------------
// Progress (localStorage)
// ---------------------------------------------------------------------------

function defaultProgress() {
  return {
    tokens: 0,
    bestScore: 0,
    bestDistance: 0,
    upgrades: Object.fromEntries(Object.keys(UPGRADES).map((k) => [k, 0])),
    buses: ['single'], // owned
    bus: 'single', // selected
    missions: refillMissions(Math.random, []), // active mission keys
    achievements: [], // unlocked achievement keys
    lifetime: { runs: 0, wrecked: 0, fares: 0, distance: 0, rammed: 0 }, // running totals (addLifetime)
    daily: { date: '', best: 0 }, // best score on the most recent Daily Challenge played
  };
}

function storageAvailable() {
  try {
    const probe = '__bus-rush-probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function wholeNumber(n) {
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

// Corrupt or missing data falls back to defaults field by field.
function loadProgress() {
  const progress = defaultProgress();
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return progress;
    progress.tokens = wholeNumber(saved.tokens);
    progress.bestScore = wholeNumber(saved.bestScore);
    progress.bestDistance = wholeNumber(saved.bestDistance);
    Object.keys(UPGRADES).forEach((key) => {
      const lvl = wholeNumber(saved.upgrades && saved.upgrades[key]);
      progress.upgrades[key] = Math.min(lvl, UPGRADES[key].maxLevel);
    });
    if (Array.isArray(saved.buses)) {
      saved.buses.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(BUSES, key) && !progress.buses.includes(key)) progress.buses.push(key);
      });
    }
    if (progress.buses.includes(saved.bus)) progress.bus = saved.bus;
    if (Array.isArray(saved.missions)) progress.missions = refillMissions(Math.random, saved.missions, progress.upgrades);
    if (Array.isArray(saved.achievements)) {
      progress.achievements = saved.achievements.filter((k, i, arr) => ACHIEVEMENTS[k] && arr.indexOf(k) === i);
    }
    if (saved.lifetime && typeof saved.lifetime === 'object') {
      Object.keys(progress.lifetime).forEach((k) => { progress.lifetime[k] = wholeNumber(saved.lifetime[k]); });
    }
    if (saved.daily && typeof saved.daily.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(saved.daily.date)) {
      progress.daily = { date: saved.daily.date, best: wholeNumber(saved.daily.best) };
    }
  } catch {
    // fall through with defaults
  }
  return progress;
}

function saveProgress(progress) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // storage unavailable — the start screen already says so
  }
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------
//
// Flat top-down vector style in the site's warm "Organic" palette, lit from
// the top-left (shadows fall down-right). The static roadside — verge,
// pavement, trees, lamps, asphalt grain, lane paint — is painted once into
// an offscreen tile that scrolls seamlessly; vehicles, the bus, fares and
// effects are drawn live every frame.

const DASH = 36;
const DASH_GAP = 28;
const SCENERY_PERIOD = (DASH + DASH_GAP) * 20; // whole dash cycles, so it tiles

const PAINT = '#f1e9d6';
const BAY_YELLOW = '#e0b54a';
const ASPHALT = '#4a4643';
const GLASS = '#2e4552';
const GLASS_SHINE = 'rgba(255,255,255,0.22)';
const HEADLIGHT = '#fff3c4';
const TAILLIGHT = '#c9402c';
const TYRE = '#1f1d1b';
const SHADOW = 'rgba(28,22,16,0.3)';
const BUS_COLOR = '#c4532d';
const CARGO = '#e9e3d6';

const TAXI_COLORS = ['#2f78c4', '#e3bf3f'];
const TAXI_CHANCE = 0.15;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

function fillRoundRect(ctx, color, x, y, w, h, r) {
  ctx.fillStyle = color;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
}

/** Mixes a #rrggbb colour toward black (amount < 0) or white (amount > 0). */
function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const target = amount < 0 ? 0 : 255;
  const a = Math.abs(amount);
  const ch = (v) => Math.round(v + (target - v) * a);
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

/** Deterministic PRNG so the scenery tile looks the same on every visit. */
const seededRandom = seededRng;

/** Left-to-right gradient that makes a flat body read as rounded. */
function bodyGradient(ctx, color, x, w) {
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, shade(color, -0.3));
  g.addColorStop(0.22, color);
  g.addColorStop(0.5, shade(color, 0.12));
  g.addColorStop(0.78, color);
  g.addColorStop(1, shade(color, -0.3));
  return g;
}

/** Quadrilateral from a top edge (x1..x2 at y1) to a bottom edge (x3..x4 at y2). */
function quad(ctx, x1, x2, y1, x3, x4, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y1);
  ctx.lineTo(x4, y2);
  ctx.lineTo(x3, y2);
  ctx.closePath();
}

// --- scenery tile ------------------------------------------------------------

function drawTree(g, x, y, r, rand, bloom) {
  g.fillStyle = 'rgba(30,40,18,0.32)';
  g.beginPath();
  g.ellipse(x + 5, y + 7, r * 1.05, r, 0, 0, Math.PI * 2);
  g.fill();
  const blobs = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rand();
    blobs.push([x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.45, r * (0.5 + rand() * 0.2)]);
  }
  const layer = (color, dx, dy, k) => {
    g.fillStyle = color;
    g.beginPath();
    blobs.forEach(([bx, by, br]) => {
      g.moveTo(bx + dx + br * k, by + dy);
      g.arc(bx + dx, by + dy, br * k, 0, Math.PI * 2);
    });
    g.fill();
  };
  layer('#3d6638', 0, 0, 1);
  layer('#527f47', -2, -2, 0.78);
  layer('#6f9a5a', -4, -4, 0.45);
  // Some are in bloom (flame-of-the-forest, bougainvillea…).
  if (bloom && rand() < 0.3) {
    g.fillStyle = bloom;
    for (let i = 0; i < 9; i++) {
      g.beginPath();
      g.arc(x + (rand() - 0.5) * r * 1.4, y + (rand() - 0.5) * r * 1.4, 1.8, 0, Math.PI * 2);
      g.fill();
    }
  }
}

function drawShrub(g, x, y, rand) {
  g.fillStyle = 'rgba(30,40,18,0.28)';
  g.beginPath();
  g.ellipse(x + 3, y + 4, 7, 6, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#4c7a42';
  g.beginPath();
  g.arc(x - 3, y, 5, 0, Math.PI * 2);
  g.arc(x + 3, y + 1, 5.5, 0, Math.PI * 2);
  g.arc(x, y - 3, 5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#6f9a5a';
  g.beginPath();
  g.arc(x - 1, y - 3, 2.5, 0, Math.PI * 2);
  g.fill();
  if (rand() < 0.5) {
    g.fillStyle = rand() < 0.5 ? '#f2e3a0' : '#e79a8a';
    g.beginPath();
    g.arc(x + 3, y - 1, 1.4, 0, Math.PI * 2);
    g.arc(x - 3, y + 2, 1.4, 0, Math.PI * 2);
    g.fill();
  }
}

/** Street lamp on the pavement, arm reaching over the road. `side` is -1 (left) or 1 (right). */
function drawLamp(g, x, y, side) {
  const head = x - side * 22;
  g.strokeStyle = 'rgba(28,22,16,0.25)';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(x + 4, y + 6);
  g.lineTo(head + 4, y + 6);
  g.stroke();
  g.strokeStyle = '#6b6660';
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(head, y);
  g.stroke();
  fillRoundRect(g, '#5a5550', x - 3, y - 3, 6, 6, 2);
  fillRoundRect(g, '#d9d2c2', head - 6, y - 3, 12, 6, 3);
  g.fillStyle = '#fff3c4';
  g.fillRect(head - 4, y - 1, 8, 2);
}

/** Bus shelter on the left verge, with a yellow-zigzag bay in the near lane. */
function drawShelter(g, y) {
  const len = 78;
  g.fillStyle = 'rgba(28,22,16,0.3)';
  g.fillRect(6, y + 6, 26, len);
  fillRoundRect(g, '#7b8f86', 2, y, 26, len, 3);
  g.fillStyle = '#8fa39a';
  for (let ry = y + 6; ry < y + len - 4; ry += 9) g.fillRect(4, ry, 22, 4);
  // Stop pole sign at the kerb.
  g.fillStyle = '#5a5550';
  g.fillRect(30, y + len + 4, 3, 3);
  fillRoundRect(g, '#e7b93f', 27, y + len - 4, 9, 8, 2);
  // Zigzag bay markings along the kerb, longer than the shelter.
  g.strokeStyle = BAY_YELLOW;
  g.lineWidth = 2;
  g.beginPath();
  const left = SHOULDER + 8;
  const right = SHOULDER + 22;
  for (let zy = y - 40, i = 0; zy <= y + len + 40; zy += 10, i++) {
    const zx = i % 2 ? right : left;
    if (i === 0) g.moveTo(zx, zy);
    else g.lineTo(zx, zy);
  }
  g.stroke();
  g.font = 'bold 13px sans-serif';
  g.fillStyle = BAY_YELLOW;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.save();
  g.translate(SHOULDER + LANE_WIDTH / 2 + 10, y + len / 2);
  g.fillText('BUS', 0, 0);
  g.restore();
}

/**
 * One district's look (index matches LEVELS in rules.js). `roadside` picks
 * what lines the verge; `path` false swaps the footpath for an expressway
 * guardrail.
 */
const DISTRICTS = [
  { // CBD: plaza paving and office-tower rooftops.
    seed: 11, verge: '#a39d93', tufts: ['#948e84', '#b0aaa0'], path: '#cfc6b6', seam: '#bdb3a2',
    kerb: ['#e6dfcf', '#8a8276'], asphalt: '#47433f', edge: PAINT,
    roadside: 'towers', shelters: true, lampGap: 320, streetTrees: true,
  },
  { // Heartland: grass, rain trees, bus shelters.
    seed: 88, verge: '#7b9a58', tufts: ['#6c8b4c', '#8eab69'], path: '#d8ccb4', seam: '#c4b79d',
    kerb: ['#e6dfcf', '#8a8276'], asphalt: ASPHALT, edge: PAINT,
    roadside: 'trees', treeChance: 0.85, treeGap: [55, 100], bloom: '#d9663f', shelters: true, lampGap: 320,
  },
  { // Expressway: guardrails, sparse trees, yellow edge lines, frequent lamps.
    seed: 21, verge: '#6d8a4c', tufts: ['#5f7c40', '#7f9c5c'], path: false,
    kerb: ['#d9d2c4', '#bfb7a8'], asphalt: '#3f3c39', edge: BAY_YELLOW,
    roadside: 'trees', treeChance: 0.85, treeGap: [60, 120], bloom: null, shelters: false, lampGap: 160,
  },
  { // Industrial: dusty verge, shipping containers, hazard-striped kerbs.
    seed: 37, verge: '#a8957a', tufts: ['#988569', '#b6a48a'], path: '#c9bea9', seam: '#b5a990',
    kerb: ['#e0c35a', '#33312e'], asphalt: '#55504b', edge: PAINT,
    roadside: 'containers', shelters: false, lampGap: 320, streetTrees: true,
  },
  { // Changi: a dense avenue of trees in bougainvillea pink.
    seed: 64, verge: '#6f9650', tufts: ['#5f8642', '#86ab66'], path: '#d8ccb4', seam: '#c4b79d',
    kerb: ['#e6dfcf', '#8a8276'], asphalt: ASPHALT, edge: PAINT,
    roadside: 'trees', treeChance: 1, treeGap: [44, 60], bloom: '#c45a9a', shelters: false, lampGap: 320,
    night: true, // drawNight: darkness, with headlights and lamp pools
  },
  { // Sentosa: the sea on the left, a beach, palm trees on the right.
    seed: 52, verge: '#e3cf9c', tufts: ['#d6c08a', '#efdcae'], path: '#eadfc6', seam: '#d9cba9',
    kerb: ['#f1ebdd', '#c9bfa9'], asphalt: '#4d4844', edge: PAINT,
    roadside: 'beach', shelters: false, lampGap: 320,
  },
];

/** A coconut palm seen from above: fronds radiating from the crown, a few coconuts. */
function drawPalm(g, x, y, r, rand) {
  g.fillStyle = 'rgba(30,40,18,0.28)';
  g.beginPath();
  g.ellipse(x + 6, y + 8, r * 0.9, r * 0.8, 0, 0, Math.PI * 2);
  g.fill();
  const fronds = 7 + Math.floor(rand() * 3);
  for (let i = 0; i < fronds; i++) {
    const a = (i / fronds) * Math.PI * 2 + rand() * 0.4;
    const len = r * (0.85 + rand() * 0.3);
    const tipX = x + Math.cos(a) * len;
    const tipY = y + Math.sin(a) * len;
    g.strokeStyle = i % 2 ? '#4f7f3c' : '#6a9a4a';
    g.lineWidth = 5;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a + 0.4) * len * 0.6, y + Math.sin(a + 0.4) * len * 0.6, tipX, tipY);
    g.stroke();
    g.strokeStyle = '#86b25e';
    g.lineWidth = 1.2;
    g.stroke();
  }
  g.fillStyle = '#7a5a32';
  [[-3, -2], [3, -1], [0, 3]].forEach(([dx, dy]) => {
    g.beginPath();
    g.arc(x + dx, y + dy, 3, 0, Math.PI * 2);
    g.fill();
  });
}

/** Office-tower rooftop overhanging the verge: parapet, aircon units, water tank. */
function drawRooftop(g, x, y, w, h, color, rand) {
  g.fillStyle = 'rgba(28,22,16,0.3)';
  g.fillRect(x + 4, y + 6, w, h);
  fillRoundRect(g, color, x, y, w, h, 2);
  g.strokeStyle = shade(color, -0.25);
  g.lineWidth = 1.5;
  g.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  for (let i = 0; i < 3; i++) {
    fillRoundRect(g, '#d7d1c6', x + 3 + rand() * (w - 12), y + 6 + rand() * (h - 16), 7, 7, 1.5);
  }
  if (rand() < 0.5) {
    g.fillStyle = '#9ba3a8';
    g.beginPath();
    g.arc(x + w / 2, y + h - 12, 4, 0, Math.PI * 2);
    g.fill();
  }
}

function drawContainer(g, x, y, w, h, color) {
  g.fillStyle = 'rgba(28,22,16,0.3)';
  g.fillRect(x + 3, y + 5, w, h);
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
  g.fillStyle = shade(color, -0.2);
  for (let ry = y + 4; ry < y + h - 2; ry += 5) g.fillRect(x + 1, ry, w - 2, 1.5);
  g.strokeStyle = shade(color, -0.35);
  g.lineWidth = 1;
  g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

/**
 * Paints one seamless SCENERY_PERIOD-tall strip of road and roadside for a
 * district, at the canvas's pixel ratio. Anything that could straddle the
 * tile's top/bottom edge is drawn at y, y - period and y + period so the
 * seam never shows.
 */
function buildScenery(dpr, d) {
  const tile = document.createElement('canvas');
  tile.width = WIDTH * dpr;
  tile.height = SCENERY_PERIOD * dpr;
  const g = tile.getContext('2d');
  g.scale(dpr, dpr);
  const P = SCENERY_PERIOD;
  const rand = seededRandom(d.seed);
  const wrapped = (y, fn) => [y - P, y, y + P].forEach(fn);

  // Verge with tufts.
  g.fillStyle = d.verge;
  g.fillRect(0, 0, WIDTH, P);
  for (let i = 0; i < 260; i++) {
    const side = rand() < 0.5;
    const x = side ? rand() * 24 : WIDTH - rand() * 24;
    g.fillStyle = rand() < 0.5 ? d.tufts[0] : d.tufts[1];
    g.fillRect(x, rand() * P, 2, 3);
  }

  if (d.path) {
    // Paved footpath with tile seams.
    g.fillStyle = d.path;
    g.fillRect(22, 0, 12, P);
    g.fillRect(WIDTH - 34, 0, 12, P);
    g.fillStyle = d.seam;
    for (let y = 0; y < P; y += 12) {
      g.fillRect(22, y, 12, 1);
      g.fillRect(WIDTH - 34, y, 12, 1);
    }
  } else {
    // Guardrail on posts.
    for (const x of [28, WIDTH - 31]) {
      g.fillStyle = 'rgba(28,22,16,0.25)';
      g.fillRect(x + 3, 0, 3, P);
      g.fillStyle = '#6b6660';
      for (let y = 0; y < P; y += 20) g.fillRect(x - 1, y, 5, 4);
      g.fillStyle = '#c9c3b7';
      g.fillRect(x, 0, 3, P);
    }
  }

  // Kerbs in alternating blocks — they also sell the sense of speed.
  for (let y = 0; y < P; y += 16) {
    g.fillStyle = (y / 16) % 2 ? d.kerb[1] : d.kerb[0];
    g.fillRect(SHOULDER - 6, y, 6, 16);
    g.fillRect(WIDTH - SHOULDER, y, 6, 16);
  }

  // Asphalt: base, grain, darker wheel tracks, patches, a few cracks.
  g.fillStyle = d.asphalt;
  g.fillRect(SHOULDER, 0, WIDTH - SHOULDER * 2, P);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = rand() < 0.5 ? 'rgba(255,240,220,0.06)' : 'rgba(0,0,0,0.12)';
    g.fillRect(SHOULDER + rand() * (WIDTH - SHOULDER * 2), rand() * P, 1.5, 1.5);
  }
  g.fillStyle = 'rgba(0,0,0,0.05)';
  for (let lane = 0; lane < LANES; lane++) {
    const cx = laneCenter(lane);
    g.fillRect(cx - 19, 0, 9, P);
    g.fillRect(cx + 10, 0, 9, P);
  }
  for (let i = 0; i < 4; i++) {
    const w = 30 + rand() * 50;
    const h = 30 + rand() * 70;
    const x = SHOULDER + 8 + rand() * (WIDTH - SHOULDER * 2 - w - 16);
    const y = rand() * (P - h);
    g.fillStyle = rand() < 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,240,220,0.035)';
    g.fillRect(x, y, w, h);
  }
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.lineWidth = 1;
  for (let i = 0; i < 10; i++) {
    let x = SHOULDER + 10 + rand() * (WIDTH - SHOULDER * 2 - 20);
    let y = rand() * (P - 40);
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < 4; s++) {
      x += (rand() - 0.5) * 12;
      y += 4 + rand() * 8;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  // Manhole covers.
  for (let i = 0; i < 3; i++) {
    const x = laneCenter(Math.floor(rand() * LANES)) + (rand() - 0.5) * 20;
    const y = 40 + rand() * (P - 80);
    g.fillStyle = '#3a3734';
    g.beginPath();
    g.arc(x, y, 9, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#5c5753';
    g.lineWidth = 1.5;
    g.stroke();
    g.beginPath();
    g.moveTo(x - 6, y);
    g.lineTo(x + 6, y);
    g.moveTo(x, y - 6);
    g.lineTo(x, y + 6);
    g.stroke();
  }

  // Lane paint, slightly worn.
  for (let lane = 1; lane < LANES; lane++) {
    const x = SHOULDER + LANE_WIDTH * lane - 2;
    for (let y = 0; y < P; y += DASH + DASH_GAP) {
      g.globalAlpha = 0.82 + rand() * 0.18;
      g.fillStyle = PAINT;
      g.fillRect(x, y, 4, DASH);
    }
  }
  g.globalAlpha = 1;
  g.fillStyle = d.edge;
  g.fillRect(SHOULDER + 4, 0, 3, P);
  g.fillRect(WIDTH - SHOULDER - 7, 0, 3, P);

  // Shelters first so roadside items and lamps never land on top of them.
  const shelterYs = d.shelters ? [P * 0.3, P * 0.8] : [];
  shelterYs.forEach((y) => drawShelter(g, y));
  const nearShelter = (y) => shelterYs.some((sy) => y > sy - 30 && y < sy + 110);

  // Every copy of a wrapped item must come out identical, so each one gets
  // its own seed rather than drawing from the shared stream.
  if (d.roadside === 'beach') {
    // The sea laps at the left edge, with foam along the sand.
    g.fillStyle = '#4f93b8';
    g.fillRect(0, 0, 15, P);
    g.fillStyle = '#7fb8d4';
    for (let y = 0; y < P; y += 6) g.fillRect(0, y, 4 + rand() * 6, 2);
    g.fillStyle = 'rgba(255,255,255,0.75)';
    for (let y = 0; y < P; y += 8) g.fillRect(13 + Math.sin(y / 15) * 2, y, 3, 5);
  }
  for (const [x, side] of [[11, -1], [WIDTH - 11, 1]]) {
    if (d.roadside === 'beach') {
      if (side === -1) continue; // the sea side has no trees
      for (let y = 30; y < P; y += 70 + rand() * 40) {
        const r = 22 + rand() * 6;
        const seed = Math.floor(y * 5 + x);
        wrapped(y, (wy) => drawPalm(g, x - 6, wy, r, seededRandom(seed)));
      }
    } else if (d.roadside === 'trees') {
      for (let y = 20; y < P; y += d.treeGap[0] + rand() * (d.treeGap[1] - d.treeGap[0])) {
        if (side === -1 && nearShelter(y)) continue;
        // Big enough to overhang the footpath and kerb, not just peek in
        // from the canvas edge.
        const r = 18 + rand() * 7;
        const jitter = side * -(4 + rand() * 4);
        const seed = Math.floor(y * 7 + x);
        const isTree = rand() < d.treeChance;
        wrapped(y, (wy) => {
          if (isTree) drawTree(g, x + jitter, wy, r, seededRandom(seed), d.bloom);
          else drawShrub(g, x, wy, seededRandom(seed));
        });
      }
    } else {
      const palette = d.roadside === 'towers'
        ? ['#bdb5a8', '#a8a097', '#c98f6b', '#8e9a94']
        : ['#c4532d', '#3f6e9e', '#5f8a5b', '#d9a93f', '#8a8276'];
      for (let y = 10; y < P - 20;) {
        const h = d.roadside === 'towers' ? 70 + rand() * 90 : 46 + rand() * 14;
        if (side === -1 && (nearShelter(y) || nearShelter(y + h))) { y += 30; continue; }
        const color = palette[Math.floor(rand() * palette.length)];
        const seed = Math.floor(y * 13 + x);
        const left = side === -1 ? -4 : WIDTH - 22;
        if (d.roadside === 'towers') drawRooftop(g, left, y, 26, h, color, seededRandom(seed));
        else drawContainer(g, side === -1 ? 1 : WIDTH - 20, y, 19, h, color);
        y += h + (d.roadside === 'towers' ? 8 + rand() * 14 : 4 + rand() * 30);
      }
    }
  }
  // Street trees in round planters along the footpath, between the lamps,
  // for districts whose verge is taken by buildings or containers.
  if (d.streetTrees) {
    for (const [x, side] of [[30, -1], [WIDTH - 30, 1]]) {
      for (let y = d.lampGap / 4; y < P; y += d.lampGap / 2) {
        if (side === -1 && nearShelter(y)) continue;
        const r = 14 + rand() * 4;
        const seed = Math.floor(y * 11 + x);
        wrapped(y, (wy) => {
          g.fillStyle = '#8a8276';
          g.beginPath();
          g.arc(x, wy, 7, 0, Math.PI * 2);
          g.fill();
          drawTree(g, x, wy, r, seededRandom(seed), d.bloom);
        });
      }
    }
  }

  for (let y = 0; y < P; y += d.lampGap) {
    const ly = y + d.lampGap / 2;
    if (!nearShelter(ly)) wrapped(ly, (wy) => drawLamp(g, 28, wy, -1));
    wrapped(y, (wy) => drawLamp(g, WIDTH - 28, wy, 1));
  }
  return tile;
}

function drawScenery(ctx, tile, scroll, dpr) {
  const offset = Math.round(((scroll % SCENERY_PERIOD) - SCENERY_PERIOD) * dpr) / dpr;
  ctx.drawImage(tile, 0, offset, WIDTH, SCENERY_PERIOD);
  ctx.drawImage(tile, 0, offset + SCENERY_PERIOD, WIDTH, SCENERY_PERIOD);
}

// --- vehicles ----------------------------------------------------------------

function drawShadow(ctx, x, y, w, l, r) {
  ctx.fillStyle = SHADOW;
  roundRect(ctx, x + 4, y + 6, w, l, r);
  ctx.fill();
}

/** Tyres peeking out from under the body at the given fractions of length. */
function drawWheels(ctx, x, y, w, l, at) {
  const wl = Math.max(10, l * 0.15);
  at.forEach((f) => {
    const wy = y + l * f - wl / 2;
    fillRoundRect(ctx, TYRE, x - 2, wy, 6, wl, 2);
    fillRoundRect(ctx, TYRE, x + w - 4, wy, 6, wl, 2);
  });
}

function drawMirrors(ctx, x, y, w, color) {
  fillRoundRect(ctx, shade(color, -0.2), x - 4, y, 5, 4, 1.5);
  fillRoundRect(ctx, shade(color, -0.2), x + w - 1, y, 5, 4, 1.5);
}

function drawGlass(ctx) {
  ctx.fillStyle = GLASS;
  ctx.fill();
}

function drawBody(ctx, color, x, y, w, l, r) {
  ctx.fillStyle = bodyGradient(ctx, color, x, w);
  roundRect(ctx, x, y, w, l, r);
  ctx.fill();
  ctx.strokeStyle = shade(color, -0.45);
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

/** Oncoming lights: headlights on the nose (bottom), tail lights at the rear (top). */
function drawLights(ctx, x, y, w, l) {
  ctx.fillStyle = HEADLIGHT;
  ctx.fillRect(x + 4, y + l - 4, 9, 3);
  ctx.fillRect(x + w - 13, y + l - 4, 9, 3);
  ctx.fillStyle = TAILLIGHT;
  ctx.fillRect(x + 4, y + 1, 8, 3);
  ctx.fillRect(x + w - 12, y + 1, 8, 3);
}

function drawCar(ctx, v, x, y, w, l) {
  drawWheels(ctx, x, y, w, l, [0.2, 0.78]);
  drawBody(ctx, v.color, x, y, w, l, 12);
  drawMirrors(ctx, x, y + l * 0.6, w, v.color);
  // Rear window (narrower toward the back), roof, windscreen (wider toward the nose).
  quad(ctx, x + 10, x + w - 10, y + l * 0.18, x + 7, x + w - 7, y + l * 0.32);
  drawGlass(ctx);
  fillRoundRect(ctx, shade(v.color, 0.08), x + 7, y + l * 0.33, w - 14, l * 0.27, 4);
  quad(ctx, x + 7, x + w - 7, y + l * 0.61, x + 5, x + w - 5, y + l * 0.78);
  drawGlass(ctx);
  ctx.fillStyle = GLASS_SHINE;
  quad(ctx, x + 12, x + 18, y + l * 0.62, x + 8, x + 13, y + l * 0.77);
  ctx.fill();
  // Bonnet crease.
  ctx.strokeStyle = shade(v.color, -0.15);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y + l * 0.8);
  ctx.lineTo(x + w / 2, y + l - 6);
  ctx.stroke();
  if (v.taxi) {
    fillRoundRect(ctx, '#f6edd2', x + w / 2 - 9, y + l * 0.42, 18, 8, 2);
    ctx.fillStyle = '#c9402c';
    ctx.fillRect(x + w / 2 - 6, y + l * 0.42 + 3, 12, 2);
  }
  drawLights(ctx, x, y, w, l);
}

function drawVan(ctx, v, x, y, w, l) {
  drawWheels(ctx, x, y, w, l, [0.18, 0.8]);
  drawBody(ctx, v.color, x, y, w, l, 8);
  drawMirrors(ctx, x, y + l * 0.74, w, v.color);
  // Long flat roof with stiffening ribs, split rear doors.
  fillRoundRect(ctx, shade(v.color, 0.1), x + 5, y + 4, w - 10, l * 0.68, 4);
  ctx.fillStyle = shade(v.color, -0.12);
  for (let ry = y + 14; ry < y + l * 0.68; ry += 12) ctx.fillRect(x + 8, ry, w - 16, 2);
  ctx.fillRect(x + w / 2 - 0.5, y, 1, 6);
  quad(ctx, x + 6, x + w - 6, y + l * 0.74, x + 5, x + w - 5, y + l * 0.86);
  drawGlass(ctx);
  ctx.fillStyle = GLASS_SHINE;
  quad(ctx, x + 11, x + 17, y + l * 0.75, x + 8, x + 13, y + l * 0.85);
  ctx.fill();
  drawLights(ctx, x, y, w, l);
}

/** Red/white chevron band — the rear-end warning on lethal vehicles. */
function drawChevrons(ctx, x, y, w) {
  ctx.save();
  roundRect(ctx, x + 2, y + 2, w - 4, 8, 2);
  ctx.clip();
  ctx.fillStyle = '#f4efe4';
  ctx.fillRect(x, y, w, 12);
  ctx.fillStyle = '#c9402c';
  for (let sx = x - 8; sx < x + w + 8; sx += 10) {
    ctx.beginPath();
    ctx.moveTo(sx, y + 12);
    ctx.lineTo(sx + 5, y + 12);
    ctx.lineTo(sx + 11, y);
    ctx.lineTo(sx + 6, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawCab(ctx, color, x, y, w, len) {
  drawBody(ctx, color, x, y, w, len, 7);
  fillRoundRect(ctx, shade(color, 0.12), x + 6, y + 3, w - 12, len * 0.42, 4); // air deflector
  quad(ctx, x + 5, x + w - 5, y + len * 0.58, x + 4, x + w - 4, y + len - 7);
  drawGlass(ctx);
  ctx.fillStyle = GLASS_SHINE;
  quad(ctx, x + 10, x + 16, y + len * 0.6, x + 8, x + 13, y + len - 8);
  ctx.fill();
  drawMirrors(ctx, x - 2, y + len * 0.6, w + 4, color);
  ctx.fillStyle = HEADLIGHT;
  ctx.fillRect(x + 4, y + len - 4, 10, 3);
  ctx.fillRect(x + w - 14, y + len - 4, 10, 3);
}

function drawCargoBox(ctx, x, y, w, len) {
  drawBody(ctx, CARGO, x, y, w, len, 3);
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  for (let ry = y + 10; ry < y + len - 4; ry += 10) ctx.fillRect(x + 3, ry, w - 6, 2);
  // Reflective tape down both sides.
  ctx.fillStyle = '#c9402c';
  for (let ry = y + 4; ry < y + len - 6; ry += 14) {
    ctx.fillRect(x + 1, ry, 2, 7);
    ctx.fillRect(x + w - 3, ry, 2, 7);
  }
  drawChevrons(ctx, x, y, w);
}

function drawTruck(ctx, v, x, y, w, l) {
  const cab = 34;
  drawWheels(ctx, x, y, w, l, [0.12, 0.28, 0.86]);
  drawCargoBox(ctx, x, y, w, l - cab - 3);
  drawCab(ctx, v.color, x + 2, y + l - cab, w - 4, cab);
}

function drawSemi(ctx, v, x, y, w, l) {
  const cab = 36;
  const trailer = l - cab - 6;
  drawWheels(ctx, x, y, w, l, [0.07, 0.16, 0.25, 0.78, 0.92]);
  drawCargoBox(ctx, x, y, w, trailer);
  ctx.fillStyle = '#3a3734';
  ctx.fillRect(x + w / 2 - 5, y + trailer, 10, 7); // hitch
  drawCab(ctx, v.color, x + 3, y + l - cab, w - 6, cab);
  // Exhaust stacks behind the cab.
  ctx.fillStyle = '#9a948b';
  ctx.beginPath();
  ctx.arc(x + 7, y + l - cab + 3, 3, 0, Math.PI * 2);
  ctx.arc(x + w - 7, y + l - cab + 3, 3, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Garbage truck: green cab, ribbed compactor body, and an open rear hopper
 * with rubbish visible inside. Rear chevrons, like the other lethal trucks.
 */
function drawGarbageTruck(ctx, v, x, y, w, l) {
  const cab = 32;
  const hopper = 22;
  drawWheels(ctx, x, y, w, l, [0.14, 0.3, 0.85]);
  drawBody(ctx, '#5c8a52', x, y, w, l - cab - 3, 6);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let ry = y + hopper + 6; ry < y + l - cab - 8; ry += 9) ctx.fillRect(x + 4, ry, w - 8, 2);
  fillRoundRect(ctx, '#e9e3d6', x + 8, y + hopper + 18, w - 16, 18, 3); // side stripe panel
  ctx.fillStyle = '#5c8a52';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('♻', x + w / 2, y + hopper + 27);
  // Open hopper at the rear, rubbish poking out.
  fillRoundRect(ctx, '#2b2724', x + 5, y + 3, w - 10, hopper, 4);
  [['#3b3f36', 14, 10, 7], ['#4f6b3f', 30, 14, 6], ['#e8e1d3', 42, 9, 4], ['#c9402c', 22, 18, 3], ['#3b3f36', 44, 18, 5]]
    .forEach(([c, bx, by, r]) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x + bx * (w / 60), y + by, r, 0, Math.PI * 2);
      ctx.fill();
    });
  drawChevrons(ctx, x, y - 2, w);
  drawCab(ctx, '#e9e3d6', x + 2, y + l - cab, w - 4, cab);
}

/**
 * Fuel tanker: a round steel tank (shaded across its width), a red band and
 * a red "flammable" diamond placard, hatches along a top walkway.
 */
function drawFuelTanker(ctx, v, x, y, w, l) {
  const cab = 34;
  const tank = l - cab - 5;
  drawWheels(ctx, x, y, w, l, [0.08, 0.18, 0.3, 0.86]);
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, '#7f868c');
  g.addColorStop(0.32, '#e6eaec');
  g.addColorStop(0.55, '#c3c9cd');
  g.addColorStop(1, '#6a7177');
  ctx.fillStyle = g;
  roundRect(ctx, x + 2, y, w - 4, tank, 18);
  ctx.fill();
  ctx.strokeStyle = '#555b60';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = '#c9402c';
  ctx.fillRect(x + 2, y + tank * 0.5 - 5, w - 4, 10);
  ctx.fillStyle = '#7b8287';
  ctx.fillRect(x + w / 2 - 1.5, y + 8, 3, tank - 16); // walkway
  ctx.fillStyle = '#9aa1a6';
  for (const f of [0.18, 0.32, 0.7, 0.84]) {
    ctx.beginPath();
    ctx.arc(x + w / 2, y + tank * f, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Flammable placard: a white-edged red diamond with a flame.
  const px = x + w / 2;
  const py = y + tank * 0.5;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(Math.PI / 4);
  fillRoundRect(ctx, '#f4efe4', -10, -10, 20, 20, 2);
  fillRoundRect(ctx, '#d8452f', -8, -8, 16, 16, 1.5);
  ctx.restore();
  ctx.fillStyle = '#ffe08a';
  ctx.beginPath();
  ctx.moveTo(px, py - 6);
  ctx.quadraticCurveTo(px + 5, py, px + 2, py + 5);
  ctx.lineTo(px - 2, py + 5);
  ctx.quadraticCurveTo(px - 5, py, px, py - 6);
  ctx.fill();
  drawCab(ctx, v.color, x + 3, y + l - cab, w - 6, cab);
}

/** Dump truck: yellow tipper bed heaped with rubble, cab canopy, rear chevrons. */
function drawDumpTruck(ctx, v, x, y, w, l) {
  const cab = 30;
  const bed = l - cab - 4;
  drawWheels(ctx, x, y, w, l, [0.12, 0.3, 0.84]);
  drawBody(ctx, '#d9a93f', x, y, w, bed, 4);
  fillRoundRect(ctx, '#6b5a43', x + 5, y + 6, w - 10, bed - 12, 3);
  const rand = seededRandom(v.seed || 7);
  const rubble = ['#8a7a62', '#a3937a', '#5f5240', '#b9ab92'];
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = rubble[Math.floor(rand() * rubble.length)];
    ctx.beginPath();
    ctx.arc(x + 9 + rand() * (w - 18), y + 10 + rand() * (bed - 20), 2 + rand() * 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = shade('#d9a93f', -0.3);
  for (let ry = y + 8; ry < y + bed - 6; ry += 11) {
    ctx.fillRect(x, ry, 3, 5);
    ctx.fillRect(x + w - 3, ry, 3, 5);
  }
  drawChevrons(ctx, x, y - 2, w);
  fillRoundRect(ctx, '#c7952f', x + 4, y + bed - 3, w - 8, 8, 2); // canopy over the cab
  drawCab(ctx, '#e3b23c', x + 3, y + l - cab, w - 6, cab);
}

/**
 * Tow truck: a cab with a flashing amber beacon, a tilted flatbed carrying a
 * dented, scorched broken-down car, and a boom and hook at the rear.
 */
function drawTowTruck(ctx, v, x, y, w, l, t) {
  const cab = 34;
  const bed = l - cab - 3;
  drawWheels(ctx, x, y, w, l, [0.12, 0.3, 0.86]);
  drawBody(ctx, '#5a5550', x + 2, y, w - 4, bed, 3); // flatbed
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let ry = y + 6; ry < y + bed - 4; ry += 8) ctx.fillRect(x + 4, ry, w - 8, 1.5);
  // The broken car riding on the bed, nose up, battered.
  const car = { color: v.wreckColor || '#8a8276' };
  ctx.save();
  ctx.translate(x + w / 2, y + bed / 2);
  ctx.rotate(Math.PI + 0.05);
  drawCar(ctx, car, -24, -bed / 2 + 6, 48, bed - 12);
  ctx.fillStyle = 'rgba(30,26,22,0.45)'; // scorch and dents
  ctx.beginPath();
  ctx.arc(-6, -10, 9, 0, Math.PI * 2);
  ctx.arc(8, 14, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; // cracked windscreen
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-8, 12);
  ctx.lineTo(0, 18);
  ctx.lineTo(9, 13);
  ctx.moveTo(0, 18);
  ctx.lineTo(2, 24);
  ctx.stroke();
  ctx.restore();
  // Boom and hook at the rear (top).
  ctx.fillStyle = '#e0b54a';
  ctx.fillRect(x + w / 2 - 3, y - 6, 6, 14);
  ctx.fillStyle = '#3a3734';
  ctx.beginPath();
  ctx.arc(x + w / 2, y - 7, 3, 0, Math.PI * 2);
  ctx.fill();
  drawCab(ctx, '#e0b54a', x + 2, y + l - cab, w - 4, cab);
  // Amber beacon on the cab roof.
  const on = Math.floor(t * 4) % 2;
  fillRoundRect(ctx, on ? '#ffb547' : '#9a6a20', x + w / 2 - 7, y + l - cab + 4, 14, 6, 2);
  if (on) {
    const g = ctx.createRadialGradient(x + w / 2, y + l - cab + 7, 1, x + w / 2, y + l - cab + 7, 26);
    g.addColorStop(0, 'rgba(255,181,71,0.45)');
    g.addColorStop(1, 'rgba(255,181,71,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 6, y + l - cab - 20, w + 12, 54);
  }
}

/** A cement mixer's drum seen from above: a barrel with spiral stripes that turn. */
function drawMixerDrum(ctx, cx, top, w, len, t, color = '#e8833a') {
  ctx.save();
  roundRect(ctx, cx - w / 2, top, w, len, w / 2.4);
  ctx.clip();
  const g = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
  g.addColorStop(0, shade(color, -0.35));
  g.addColorStop(0.4, shade(color, 0.15));
  g.addColorStop(1, shade(color, -0.4));
  ctx.fillStyle = g;
  ctx.fillRect(cx - w / 2, top, w, len);
  ctx.strokeStyle = 'rgba(244,239,228,0.85)';
  ctx.lineWidth = 5;
  const turn = (t * 30) % 22;
  for (let sy = top - 30 + turn; sy < top + len + 30; sy += 22) {
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, sy);
    ctx.lineTo(cx + w / 2, sy - 14);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = shade(color, -0.5);
  ctx.lineWidth = 1.2;
  roundRect(ctx, cx - w / 2, top, w, len, w / 2.4);
  ctx.stroke();
}

/**
 * Cement mixer, nose down: chassis, a turning striped drum on a cradle, the
 * chute at the rear, rear chevrons (it's lethal) and the cab.
 */
function drawMixer(ctx, v, x, y, w, l, t) {
  const cab = 32;
  drawWheels(ctx, x, y, w, l, [0.1, 0.24, 0.84]);
  drawBody(ctx, '#6b6660', x + 3, y, w - 6, l - cab - 2, 4); // chassis
  drawMixerDrum(ctx, x + w / 2, y + 8, w - 10, l - cab - 18, t);
  fillRoundRect(ctx, '#9a948b', x + w / 2 - 5, y - 6, 10, 14, 3); // chute
  drawChevrons(ctx, x, y + l - cab - 12, w);
  drawCab(ctx, '#e9e3d6', x + 2, y + l - cab, w - 4, cab);
}

/**
 * A mixer lying on its side after being tipped over — seen from above you
 * get its flank: wheels sticking out toward the lane it fell from, the drum
 * and cab sideways across the lane it fell into, cement oozing out.
 * `dir` is -1 (fell left) or 1 (fell right); `w` is how far it sprawls.
 */
function drawFallenMixer(ctx, v, t) {
  const dir = v.fallDir;
  const w = v.sprawl;
  const l = v.length;
  const left = dir > 0 ? v.x - v.width / 2 : v.x + v.width / 2 - w;
  const y = v.y;
  // Cement spilling out of the drum's mouth.
  ctx.fillStyle = 'rgba(150,146,138,0.85)';
  ctx.beginPath();
  ctx.ellipse(left + w / 2, y - 18, w * 0.42, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(175,171,163,0.9)';
  ctx.beginPath();
  ctx.ellipse(left + w / 2 + 6, y - 14, w * 0.28, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  drawShadow(ctx, left, y, w, l, 10);
  drawBody(ctx, '#6b6660', left, y, w, l, 8); // the underside/chassis
  // Wheels along the edge it pivoted on.
  const wheelX = dir > 0 ? left - 6 : left + w - 8;
  for (const f of [0.1, 0.24, 0.84]) fillRoundRect(ctx, TYRE, wheelX, y + l * f - 9, 14, 18, 4);
  drawMixerDrum(ctx, left + w / 2 + dir * 6, y + 6, w - 22, l - 42, t * 0.15);
  fillRoundRect(ctx, '#e9e3d6', left + 6, y + l - 34, w - 12, 30, 6); // cab, on its side
  ctx.fillStyle = GLASS;
  ctx.fillRect(left + w / 2 - 14, y + l - 28, 28, 10);
}

/** Orange hazmat panel and a red flammable diamond on a gasoline-laden truck. */
function drawHazmatMarks(ctx, x, y, w, len) {
  ctx.fillStyle = '#e8833a';
  ctx.fillRect(x + 4, y + len * 0.35, w - 8, 12);
  ctx.fillStyle = '#1f1d1b';
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GASOLINE', x + w / 2, y + len * 0.35 + 6.5);
  const px = x + w / 2;
  const py = y + len * 0.62;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(Math.PI / 4);
  fillRoundRect(ctx, '#f4efe4', -9, -9, 18, 18, 2);
  fillRoundRect(ctx, '#d8452f', -7, -7, 14, 14, 1.5);
  ctx.restore();
  ctx.fillStyle = '#ffe08a';
  ctx.beginPath();
  ctx.moveTo(px, py - 5);
  ctx.quadraticCurveTo(px + 4, py, px + 2, py + 4);
  ctx.lineTo(px - 2, py + 4);
  ctx.quadraticCurveTo(px - 4, py, px, py - 5);
  ctx.fill();
}

/**
 * The ramp truck, parked facing the same way as the bus (nose up): a
 * low-loader with its loading ramps folded down at the back, striped and
 * arrowed, hazard lights blinking and an "MRT ↑" sign on the cab.
 */
function drawRampTruck(ctx, ramp, t) {
  const w = RAMP_TRUCK.width;
  const l = RAMP_TRUCK.length;
  const x = ramp.x - w / 2;
  const y = ramp.y;
  drawShadow(ctx, x, y, w, l, 6);
  drawWheels(ctx, x, y, w, l, [0.16, 0.5, 0.64]);
  // Cab at the top (nose up), drawn as a downward cab rotated 180°.
  ctx.save();
  ctx.translate(x + w / 2, y + 17);
  ctx.rotate(Math.PI);
  drawCab(ctx, '#3f6e9e', -w / 2 + 2, -17, w - 4, 34);
  ctx.restore();
  // Deck and ramps.
  drawBody(ctx, '#7d8a94', x + 2, y + 36, w - 4, l - 66, 3);
  ctx.save();
  roundRect(ctx, x + 4, y + l - 32, w - 8, 32, 2);
  ctx.clip();
  ctx.fillStyle = '#e0b54a';
  ctx.fillRect(x, y + l - 32, w, 32);
  ctx.fillStyle = '#1f1d1b';
  for (let sx = x - 30; sx < x + w + 10; sx += 12) {
    ctx.beginPath();
    ctx.moveTo(sx, y + l);
    ctx.lineTo(sx + 6, y + l);
    ctx.lineTo(sx + 30, y + l - 32);
    ctx.lineTo(sx + 24, y + l - 32);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = '#f4efe4';
  for (const ay of [y + 52, y + 74]) {
    ctx.beginPath();
    ctx.moveTo(x + w / 2, ay - 9);
    ctx.lineTo(x + w / 2 + 10, ay + 3);
    ctx.lineTo(x + w / 2 - 10, ay + 3);
    ctx.closePath();
    ctx.fill();
  }
  fillRoundRect(ctx, '#2b2724', x + 8, y + 2, w - 16, 12, 2);
  ctx.fillStyle = '#ffb547';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('MRT ↑', x + w / 2, y + 8.5);
  if (Math.floor(t * 3) % 2) {
    for (const hx of [x + 3, x + w - 3]) {
      for (const hy of [y + 3, y + l - 3]) {
        const g = ctx.createRadialGradient(hx, hy, 1, hx, hy, 14);
        g.addColorStop(0, 'rgba(255,181,71,0.9)');
        g.addColorStop(1, 'rgba(255,181,71,0)');
        ctx.fillStyle = g;
        ctx.fillRect(hx - 14, hy - 14, 28, 28);
      }
    }
  }
}

// Oncoming vehicle, nose pointing down the screen. A crashed tanker is
// drawn jackknifed (`crashAngle`).
function drawVehicle(ctx, v, t) {
  if (v.police) {
    if (v.swat) drawSwat(ctx, v, t, false);
    else drawPolice(ctx, v, t, false);
    return;
  }
  const x = v.x - v.width / 2;
  ctx.save();
  if (v.crashAngle) {
    ctx.translate(v.x, v.y + v.length / 2);
    ctx.rotate(v.crashAngle);
    ctx.translate(-v.x, -(v.y + v.length / 2));
  }
  drawShadow(ctx, x, v.y, v.width, v.length, 8);
  if (v.fallen) {
    ctx.restore();
    drawFallenMixer(ctx, v, t);
    return;
  }
  if (v.tipping) {
    // Drifted into: it leans toward the lane it's falling into, its flank
    // widening and darkening as it goes.
    const k = smoothstep(v.tip);
    ctx.translate(v.x + v.fallDir * k * LANE_WIDTH * 0.45, 0);
    ctx.scale(1 + k * 0.7, 1);
    ctx.translate(-v.x, 0);
    ctx.rotate(v.fallDir * k * 0.06);
  }
  if (v.kind === 'fuel') drawFuelTanker(ctx, v, x, v.y, v.width, v.length);
  else if (v.kind === 'mixer') drawMixer(ctx, v, x, v.y, v.width, v.length, t);
  else if (v.kind === 'tow') drawTowTruck(ctx, v, x, v.y, v.width, v.length, t);
  else if (v.kind === 'dump') drawDumpTruck(ctx, v, x, v.y, v.width, v.length);
  else if (v.bus) drawTrafficBus(ctx, v, x, v.y, v.width, v.length);
  else if (v.kind === 'semi') drawSemi(ctx, v, x, v.y, v.width, v.length);
  else if (v.kind === 'garbage') drawGarbageTruck(ctx, v, x, v.y, v.width, v.length);
  else if (v.kind === 'truck') drawTruck(ctx, v, x, v.y, v.width, v.length);
  else if (v.kind === 'van') drawVan(ctx, v, x, v.y, v.width, v.length);
  else drawCar(ctx, v, x, v.y, v.width, v.length);
  if (v.hazmat) drawHazmatMarks(ctx, x, v.y, v.width, v.length - 36);
  ctx.restore();
}

const POLICE_WHITE = '#f1ede4';
const POLICE_NAVY = '#24345a';

/** Light bar colours swap a few times a second. */
function sirenPhase(t) {
  return Math.floor(t * 6) % 2;
}

/**
 * A police cruiser: a car with a chequered navy livery and a flashing light
 * bar. Pursuers face up the screen (chasing the bus); roadblock cars face
 * down like the rest of the oncoming traffic.
 */
function drawPolice(ctx, p, t, facingUp, angle = 0) {
  const x = p.x - p.width / 2;
  const w = p.width;
  const l = p.length;
  drawShadow(ctx, x, p.y, w, l, 8);
  ctx.save();
  if (facingUp || angle) {
    ctx.translate(p.x, p.y + l / 2);
    ctx.rotate((facingUp ? Math.PI : 0) + angle);
    ctx.translate(-p.x, -(p.y + l / 2));
  }
  drawCar(ctx, { color: POLICE_WHITE }, x, p.y, w, l);
  ctx.fillStyle = POLICE_NAVY;
  for (let i = 0, cy = p.y + l * 0.12; cy < p.y + l * 0.88; i++, cy += 6) {
    if (i % 2) continue;
    ctx.fillRect(x + 1, cy, 4, 6);
    ctx.fillRect(x + w - 5, cy, 4, 6);
  }
  ctx.fillRect(x + 8, p.y + l * 0.82, w - 16, 3);
  drawLightBar(ctx, x, w, p.y + l * 0.44, t);
  ctx.restore();
}

/** Flashing red/blue roof light bar with its glow, `by` its top edge. */
function drawLightBar(ctx, x, w, by, t) {
  const phase = sirenPhase(t);
  fillRoundRect(ctx, '#2b2724', x + 9, by - 1, w - 18, 7, 2);
  ctx.fillStyle = phase ? '#ff4b3a' : '#7a2a22';
  ctx.fillRect(x + 10, by, (w - 20) / 2, 5);
  ctx.fillStyle = phase ? '#2a3f7a' : '#4f8bff';
  ctx.fillRect(x + w / 2, by, (w - 20) / 2, 5);
  const glow = ctx.createRadialGradient(x + w / 2, by + 2, 2, x + w / 2, by + 2, 30);
  glow.addColorStop(0, phase ? 'rgba(255,75,58,0.35)' : 'rgba(79,139,255,0.35)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 10, by - 28, w + 20, 60);
}

/**
 * SWAT van: an armoured navy van with riveted plates, a push bar on the
 * nose, "SWAT" on the roof (kept readable however it faces) and a light bar.
 */
function drawSwat(ctx, p, t, facingUp, angle = 0) {
  const x = p.x - p.width / 2;
  const w = p.width;
  const l = p.length;
  drawShadow(ctx, x, p.y, w, l, 8);
  ctx.save();
  if (facingUp || angle) {
    ctx.translate(p.x, p.y + l / 2);
    ctx.rotate((facingUp ? Math.PI : 0) + angle);
    ctx.translate(-p.x, -(p.y + l / 2));
  }
  drawVan(ctx, { color: '#2a3446' }, x, p.y, w, l);
  ctx.fillStyle = '#1b2230';
  for (let ry = p.y + 10; ry < p.y + l * 0.66; ry += 14) {
    ctx.fillRect(x + 7, ry, 2.5, 2.5);
    ctx.fillRect(x + w - 9.5, ry, 2.5, 2.5);
  }
  fillRoundRect(ctx, '#15181e', x - 2, p.y + l - 3, w + 4, 6, 2); // push bar
  drawLightBar(ctx, x, w, p.y + l * 0.62, t);
  ctx.save();
  ctx.translate(p.x, p.y + l * 0.32);
  if (facingUp) ctx.rotate(Math.PI);
  ctx.fillStyle = '#e9e3d6';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SWAT', 0, 0);
  ctx.restore();
  ctx.restore();
}

/** A wrecked cruiser: charred, skewed, smoking. Harmless scenery. */
function drawWreck(ctx, wk, t) {
  ctx.save();
  ctx.translate(wk.x, wk.y + wk.length / 2);
  ctx.rotate(wk.angle);
  drawCar(ctx, { color: '#6a645c' }, -wk.width / 2, -wk.length / 2, wk.width, wk.length);
  ctx.fillStyle = 'rgba(30,26,22,0.55)';
  ctx.beginPath();
  ctx.arc(-6, -4, 12, 0, Math.PI * 2);
  ctx.arc(8, 8, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  for (let i = 0; i < 3; i++) {
    const k = (t * 0.8 + i / 3 + wk.angle) % 1;
    ctx.fillStyle = `rgba(90,86,80,${0.45 * (1 - k)})`;
    ctx.beginPath();
    ctx.arc(wk.x + Math.sin(k * 6 + i) * 6, wk.y + wk.length / 2 - k * 40, 7 + k * 10, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Red/blue glow on the bottom edge for a pursuer that's still off-screen. */
function drawSirenCue(ctx, p, t) {
  const color = sirenPhase(t) ? '255,75,58' : '79,139,255';
  const g = ctx.createRadialGradient(p.x, HEIGHT, 2, p.x, HEIGHT, 60);
  g.addColorStop(0, `rgba(${color},0.6)`);
  g.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(p.x - 60, HEIGHT - 60, 120, 60);
}

/** "LEVEL 2 / Heartland" card across the road; fades in and out over BANNER_SECONDS. */
function drawBanner(ctx, b) {
  ctx.globalAlpha = Math.max(0, Math.min(1, b.t / 0.4, (BANNER_SECONDS - b.t) / 0.25));
  ctx.fillStyle = 'rgba(36,30,24,0.75)';
  ctx.fillRect(0, 150, WIDTH, 92);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffb547';
  ctx.font = 'bold 34px Caprasimo, Georgia, serif';
  ctx.fillText(b.title, WIDTH / 2, 185);
  ctx.fillStyle = '#f1e9d6';
  ctx.font = '600 17px Figtree, sans-serif';
  ctx.fillText(b.sub, WIDTH / 2, 221);
  ctx.globalAlpha = 1;
}

// --- fares, bus, effects -----------------------------------------------------

/** A spinning gold fare coin; `t` is seconds, `f.phase` staggers the spin. */
function drawFare(ctx, f, t) {
  const glow = ctx.createRadialGradient(f.x, f.y, 4, f.x, f.y, FARE_RADIUS * 2);
  glow.addColorStop(0, 'rgba(255,214,102,0.45)');
  glow.addColorStop(1, 'rgba(255,214,102,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(f.x - FARE_RADIUS * 2, f.y - FARE_RADIUS * 2, FARE_RADIUS * 4, FARE_RADIUS * 4);

  const spin = Math.max(0.18, Math.abs(Math.cos(t * 3 + (f.phase || 0))));
  const rx = FARE_RADIUS * spin;
  ctx.fillStyle = SHADOW;
  ctx.beginPath();
  ctx.ellipse(f.x + 3, f.y + 5, rx, FARE_RADIUS, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#a8741a'; // coin edge
  ctx.beginPath();
  ctx.ellipse(f.x, f.y + 1.5, rx, FARE_RADIUS, 0, 0, Math.PI * 2);
  ctx.fill();
  const face = ctx.createRadialGradient(f.x - rx * 0.4, f.y - 5, 1, f.x, f.y, FARE_RADIUS);
  face.addColorStop(0, '#fff0b3');
  face.addColorStop(0.5, '#f2c94c');
  face.addColorStop(1, '#d9a22a');
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.ellipse(f.x, f.y, rx, FARE_RADIUS, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(140,96,20,0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(f.x, f.y, rx * 0.72, FARE_RADIUS * 0.72, 0, 0, Math.PI * 2);
  ctx.stroke();
  if (spin > 0.55) {
    ctx.save();
    ctx.translate(f.x, f.y + 1);
    ctx.scale(spin, 1);
    ctx.fillStyle = '#8a5e10';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 0, 0);
    ctx.restore();
  }
}

/** Drawn scale of a banana peel, and the half-size of its square skid hitbox to match. */
const BANANA_SCALE = 1.5;
const BANANA_HALF = 13;

function bananaBox(b) {
  return { x: b.x - BANANA_HALF, y: b.y - BANANA_HALF, w: BANANA_HALF * 2, h: BANANA_HALF * 2 };
}

/** A spilled garbage pile, top-down: two tied bin bags, a can and paper. */
function drawGarbage(ctx, b) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.angle * 0.3);
  ctx.fillStyle = SHADOW;
  ctx.beginPath();
  ctx.ellipse(3, 5, 17, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8e1d3'; // paper scraps
  ctx.fillRect(-15, 4, 7, 5);
  ctx.fillRect(9, -10, 6, 4);
  const bag = (bx, by, r, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(bx, by, r, r * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.ellipse(bx - r * 0.35, by - r * 0.35, r * 0.35, r * 0.22, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(color.startsWith('#') ? color : '#3b3f36', -0.3); // knot
    ctx.beginPath();
    ctx.arc(bx + r * 0.5, by - r * 0.6, 2.2, 0, Math.PI * 2);
    ctx.fill();
  };
  bag(-5, -1, 10, '#3b3f36');
  bag(7, 4, 8, '#4f6b3f');
  ctx.fillStyle = '#b9bfc4'; // can
  ctx.fillRect(-2, 8, 7, 4);
  ctx.fillStyle = '#c9402c';
  ctx.fillRect(1, 8, 2, 4);
  ctx.restore();
}

/**
 * A banana peel lying on the road (slipped out of a truck), top-down: the
 * classic cartoon peel, five splayed flaps around a stem.
 */
function drawBanana(ctx, b) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.angle);
  ctx.scale(BANANA_SCALE, BANANA_SCALE);
  ctx.fillStyle = SHADOW;
  ctx.beginPath();
  ctx.ellipse(2, 4, 11, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const a of [-2.4, -1.25, -0.1, 1.05, 2.2]) {
    ctx.save();
    ctx.rotate(a);
    const g = ctx.createLinearGradient(0, 0, 0, 14);
    g.addColorStop(0, '#e9b93a');
    g.addColorStop(1, '#f7dc6b');
    ctx.fillStyle = g;
    ctx.strokeStyle = '#a8741a';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-3.5, 0);
    ctx.quadraticCurveTo(-5.5, 8, -1.5, 14);
    ctx.quadraticCurveTo(0, 15.5, 1.5, 14);
    ctx.quadraticCurveTo(5.5, 8, 3.5, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff6d0'; // pale inside of the peel
    ctx.beginPath();
    ctx.ellipse(0, 7, 1.2, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5a4320'; // brown tip
    ctx.beginPath();
    ctx.arc(0, 14, 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#c99a2e';
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6b4f22'; // stem
  ctx.fillRect(-1.5, -7, 3, 6);
  ctx.restore();
}

/** Per-bus paint: body colour and roof colour. */
const BUS_LOOKS = {
  single: { body: '#c4532d', roof: '#efe4d0' },
  minibus: { body: '#d9a93f', roof: '#f4ecd8' },
  double: { body: '#5f8a5b', roof: '#e9e1cf' },
  electric: { body: '#3f6e9e', roof: '#e3e8ea' },
};

/** LED route sign; `flip` counter-rotates the text on a bus drawn upside down. */
function drawDestinationSign(ctx, x, y, w, text = '88', flip = false) {
  fillRoundRect(ctx, '#2b2724', x - w / 2, y, w, 10, 2);
  ctx.save();
  ctx.translate(x, y + 5.5);
  if (flip) ctx.rotate(Math.PI);
  ctx.fillStyle = '#ffb547';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** Single-decker roof: aircon pod with twin fans and a rear hatch. */
function drawSingleRoof(ctx, x, left, top, w) {
  fillRoundRect(ctx, '#d7ccb8', left + 11, top + 34, w - 22, 26, 4);
  ctx.strokeStyle = '#bfb39d';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let gy = top + 38; gy < top + 58; gy += 4) {
    ctx.moveTo(left + 14, gy);
    ctx.lineTo(left + w - 14, gy);
  }
  ctx.stroke();
  [x - 8, x + 8].forEach((fx) => {
    ctx.fillStyle = '#a99d88';
    ctx.beginPath();
    ctx.arc(fx, top + 47, 5, 0, Math.PI * 2);
    ctx.fill();
  });
  fillRoundRect(ctx, '#d7ccb8', left + 17, top + 65, w - 34, 10, 2);
}

/** Double-decker roof: upper-deck window band all round, two escape hatches. */
function drawDoubleRoof(ctx, x, left, top, w, l, roof = BUS_LOOKS.double.roof) {
  ctx.fillStyle = GLASS;
  ctx.fillRect(left + 8, top + 31, 4, l - 44);
  ctx.fillRect(left + w - 12, top + 31, 4, l - 44);
  ctx.fillStyle = roof;
  for (let y = top + 38; y < top + l - 14; y += 12) {
    ctx.fillRect(left + 8, y, 4, 2);
    ctx.fillRect(left + w - 12, y, 4, 2);
  }
  fillRoundRect(ctx, '#d7ccb8', left + 18, top + 40, w - 36, 12, 2);
  fillRoundRect(ctx, '#d7ccb8', left + 18, top + 62, w - 36, 12, 2);
  ctx.strokeStyle = '#bfb39d';
  ctx.lineWidth = 1;
  ctx.strokeRect(left + 18.5, top + 40.5, w - 37, 11);
  ctx.strokeRect(left + 18.5, top + 62.5, w - 37, 11);
}

/** Electric bus roof: battery packs with a lightning bolt, plus a charging rail. */
function drawElectricRoof(ctx, x, left, top, w, l) {
  fillRoundRect(ctx, '#3a4248', left + 11, top + 34, w - 22, 34, 4);
  ctx.strokeStyle = '#59636b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, top + 35);
  ctx.lineTo(x, top + 67);
  ctx.stroke();
  ctx.fillStyle = '#ffd34d';
  ctx.beginPath(); // bolt
  ctx.moveTo(x + 3, top + 40);
  ctx.lineTo(x - 5, top + 52);
  ctx.lineTo(x, top + 52);
  ctx.lineTo(x - 3, top + 63);
  ctx.lineTo(x + 5, top + 50);
  ctx.lineTo(x, top + 50);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#8a959c';
  ctx.fillRect(left + 14, top + l - 18, w - 28, 3);
}

/** Minibus roof: short panel with one hatch and a roof rail each side. */
function drawMiniRoof(ctx, x, left, top, w, l) {
  ctx.fillStyle = '#bfb39d';
  ctx.fillRect(left + 9, top + 32, 2, l - 44);
  ctx.fillRect(left + w - 11, top + 32, 2, l - 44);
  fillRoundRect(ctx, '#d7ccb8', left + 15, top + 38, w - 30, 14, 3);
}

/** School bus roof: black rub stripes down both sides and a roof hatch. */
function drawSchoolRoof(ctx, x, left, top, w, l) {
  ctx.fillStyle = '#2b2724';
  ctx.fillRect(left + 9, top + 32, 2, l - 44);
  ctx.fillRect(left + w - 11, top + 32, 2, l - 44);
  fillRoundRect(ctx, '#e8d9b0', left + 16, top + 44, w - 32, 14, 2);
}

/**
 * A bus body drawn nose-up with its nose at `top`: wheels, shaded body,
 * mirrors, windscreen, side windows, roof + route sign, the roof `kit`
 * ('single' | 'double' | 'electric' | 'minibus' | 'school'), then grille
 * and lamps. `opts`: `braking` lights the brake lamps; `route` is the sign
 * text and `flipSign` keeps it readable when the whole bus is rotated 180°;
 * `shadow` false skips the drop shadow (drawn by the caller when rotating).
 */
function drawBusShape(ctx, x, top, w, l, look, kit, opts = {}) {
  const left = x - w / 2;
  if (opts.shadow !== false) drawShadow(ctx, left, top, w, l, 10);
  drawWheels(ctx, left, top, w, l, [0.2, 0.76]);
  drawBody(ctx, look.body, left, top, w, l, kit === 'minibus' ? 12 : 10);
  drawMirrors(ctx, left - 1, top + 6, w + 2, look.body);

  // Windscreen across the nose.
  quad(ctx, left + 5, left + w - 5, top + 4, left + 6, left + w - 6, top + 15);
  drawGlass(ctx);
  ctx.fillStyle = GLASS_SHINE;
  quad(ctx, left + 10, left + 17, top + 5, left + 12, left + 18, top + 14);
  ctx.fill();

  // Side window strips with pillars.
  ctx.fillStyle = GLASS;
  for (let y = top + 20; y < top + l - 14; y += 13) {
    ctx.fillRect(left + 2, y, 4, 10);
    ctx.fillRect(left + w - 6, y, 4, 10);
  }

  // Roof, route sign, then the kit.
  fillRoundRect(ctx, look.roof, left + 7, top + 17, w - 14, l - 28, 5);
  drawDestinationSign(ctx, x, top + 19, w - 24, opts.route, opts.flipSign);
  if (kit === 'double') drawDoubleRoof(ctx, x, left, top, w, l, look.roof);
  else if (kit === 'electric') drawElectricRoof(ctx, x, left, top, w, l);
  else if (kit === 'minibus') drawMiniRoof(ctx, x, left, top, w, l);
  else if (kit === 'school') drawSchoolRoof(ctx, x, left, top, w, l);
  else drawSingleRoof(ctx, x, left, top, w);

  // Engine grille (none on the electric) and lamps at the rear.
  if (kit !== 'electric') {
    ctx.fillStyle = shade(look.body, -0.3);
    for (let gx = left + 14; gx < left + w - 14; gx += 4) ctx.fillRect(gx, top + l - 8, 2, 5);
  }
  ctx.fillStyle = HEADLIGHT;
  ctx.fillRect(left + 4, top + 1, 9, 3);
  ctx.fillRect(left + w - 13, top + 1, 9, 3);
  if (opts.braking) {
    const glow = ctx.createRadialGradient(x, top + l, 2, x, top + l, 34);
    glow.addColorStop(0, 'rgba(255,70,40,0.45)');
    glow.addColorStop(1, 'rgba(255,70,40,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(left - 10, top + l - 20, w + 20, 50);
  }
  ctx.fillStyle = opts.braking ? '#ff5a3c' : '#8e2f1f';
  ctx.fillRect(left + 4, top + l - 4, 9, 3);
  ctx.fillRect(left + w - 13, top + l - 4, 9, 3);
}

/**
 * The player's bus, nose up, in the selected style (`busKey`, a BUSES key).
 * `braking` lights the brake lamps; `angle` (radians) twists it about its
 * centre for a banana skid.
 */
function drawBus(ctx, x, flashing, braking, angle = 0, busKey = 'single') {
  const def = busDef(busKey);
  const look = BUS_LOOKS[busKey] || BUS_LOOKS.single;
  ctx.save();
  if (angle) {
    ctx.translate(x, BUS_Y + def.length / 2);
    ctx.rotate(angle);
    ctx.translate(-x, -(BUS_Y + def.length / 2));
  }
  if (flashing) ctx.globalAlpha = 0.4;
  drawBusShape(ctx, x, BUS_Y, def.width, def.length, look, busKey, { braking });
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** Oncoming traffic buses: paint and roof kit per kind. */
const TRAFFIC_BUS_LOOKS = {
  schoolbus: { body: '#e3a43a', roof: '#f1d58a', kit: 'school' },
  citybus: { body: '#7a4f8c', roof: '#ebe3ee', kit: 'single' },
  doubledecker: { body: '#b5463a', roof: '#efe4d0', kit: 'double' },
  bendy: { body: '#4f8a7a', roof: '#e6efe9', kit: 'single' },
};
const ROUTES = ['7', '12', '14', '32', '61', '75', '175', '190', '960', '10e'];

/**
 * An oncoming bus, nose pointing down the screen: drawn nose-up and rotated
 * 180° about its centre, without its own shadow (drawVehicle's unrotated
 * one keeps the light coming from the top-left). A bendy bus is two sections with a concertina
 * joint between them.
 */
function drawTrafficBus(ctx, v, x, y, w, l) {
  const look = TRAFFIC_BUS_LOOKS[v.kind] || TRAFFIC_BUS_LOOKS.citybus;
  const cx = x + w / 2;
  ctx.save();
  ctx.translate(cx, y + l / 2);
  ctx.rotate(Math.PI);
  ctx.translate(-cx, -(y + l / 2));
  const opts = { route: v.route, flipSign: true, shadow: false };
  if (v.kind === 'bendy') {
    const front = Math.round(l * 0.56);
    const joint = 10;
    const rearTop = y + front + joint;
    const rear = l - front - joint;
    // Rear section: plain body, windows, roof hatch, grille and lamps.
    drawWheels(ctx, x, rearTop, w, rear, [0.7]);
    drawBody(ctx, look.body, x, rearTop, w, rear, 8);
    ctx.fillStyle = GLASS;
    for (let wy = rearTop + 6; wy < rearTop + rear - 14; wy += 13) {
      ctx.fillRect(x + 2, wy, 4, 10);
      ctx.fillRect(x + w - 6, wy, 4, 10);
    }
    fillRoundRect(ctx, look.roof, x + 7, rearTop + 4, w - 14, rear - 14, 5);
    fillRoundRect(ctx, '#d7ccb8', x + 17, rearTop + 16, w - 34, 12, 2);
    ctx.fillStyle = shade(look.body, -0.3);
    for (let gx = x + 14; gx < x + w - 14; gx += 4) ctx.fillRect(gx, rearTop + rear - 8, 2, 5);
    ctx.fillStyle = '#8e2f1f';
    ctx.fillRect(x + 4, rearTop + rear - 4, 9, 3);
    ctx.fillRect(x + w - 13, rearTop + rear - 4, 9, 3);
    // Concertina joint.
    ctx.fillStyle = '#3a3734';
    ctx.fillRect(x + 4, y + front - 2, w - 8, joint + 4);
    ctx.fillStyle = '#5c5753';
    for (let jy = y + front; jy < y + front + joint; jy += 3) ctx.fillRect(x + 4, jy, w - 8, 1.5);
    // Front section last so its rear edge overlaps the joint cleanly.
    drawBusShape(ctx, cx, y, w, front, look, 'bendy-front', opts);
  } else {
    drawBusShape(ctx, cx, y, w, l, look, look.kit, opts);
  }
  ctx.restore();
}

/** Green stink lines and buzzing flies around a bus slowed by garbage. */
function drawStink(ctx, x, t, busKey) {
  const l = busDef(busKey).length;
  const cy = BUS_Y + l / 2;
  ctx.strokeStyle = 'rgba(150,180,90,0.7)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const k = (t * 0.9 + i / 3) % 1;
    const sx = x + (i - 1) * 16;
    ctx.globalAlpha = 1 - k;
    ctx.beginPath();
    for (let j = 0; j <= 6; j++) {
      const yy = BUS_Y + l * 0.3 - k * 40 - j * 4;
      const xx = sx + Math.sin(j * 1.3 + t * 6 + i) * 3;
      if (j === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#1f1d1b';
  for (let i = 0; i < 4; i++) {
    const a = t * (5 + i) + i * 1.7;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * (34 + i * 3), cy + Math.sin(a * 1.3) * (l / 2 + 6), 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Sparks and debris: { x, y, vx, vy, life, max, size, color } in canvas px/s. */
function stepEffects(effects, dt) {
  for (const p of effects) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - 2.5 * dt;
    p.vy *= 1 - 2.5 * dt;
  }
  return effects.filter((p) => p.life > 0);
}

function drawEffects(ctx, effects) {
  for (const p of effects) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    if (p.text) {
      ctx.fillStyle = p.color;
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = 'rgba(40,28,10,0.6)';
      ctx.lineWidth = 3;
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillText(p.text, p.x, p.y);
    } else {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
  }
  ctx.globalAlpha = 1;
}

function burst(effects, x, y, colors, count, speed, size) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.6);
    const max = 0.4 + Math.random() * 0.35;
    effects.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: max, max,
      size: size * (0.6 + Math.random() * 0.6),
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  }
}

// --- road hazards ------------------------------------------------------------

/** Spike strip hitbox: across most of a lane, thin. */
const SPIKE_W = LANE_WIDTH - 14;
function spikeBox(b) {
  return { x: b.x - SPIKE_W / 2, y: b.y - 8, w: SPIKE_W, h: 16 };
}

/** A police spike strip across one lane: dark band, steel teeth, yellow end caps. */
function drawSpikes(ctx, b) {
  const x0 = b.x - SPIKE_W / 2;
  ctx.fillStyle = SHADOW;
  ctx.fillRect(x0 + 3, b.y - 2, SPIKE_W, 10);
  fillRoundRect(ctx, '#3a3734', x0, b.y - 5, SPIKE_W, 10, 2);
  ctx.fillStyle = '#d3cdc2';
  for (let sx = x0 + 4; sx < x0 + SPIKE_W - 6; sx += 7) {
    ctx.beginPath();
    ctx.moveTo(sx, b.y - 4);
    ctx.lineTo(sx + 3.5, b.y - 11);
    ctx.lineTo(sx + 7, b.y - 4);
    ctx.moveTo(sx, b.y + 4);
    ctx.lineTo(sx + 3.5, b.y + 11);
    ctx.lineTo(sx + 7, b.y + 4);
    ctx.fill();
  }
  fillRoundRect(ctx, '#e0b54a', x0 - 3, b.y - 6, 6, 12, 2);
  fillRoundRect(ctx, '#e0b54a', x0 + SPIKE_W - 3, b.y - 6, 6, 12, 2);
}

const POTHOLE_RX = 18;
const POTHOLE_RY = 11;
function potholeBox(h) {
  return { x: h.x - POTHOLE_RX + 4, y: h.y - POTHOLE_RY + 3, w: POTHOLE_RX * 2 - 8, h: POTHOLE_RY * 2 - 6 };
}

/** A pothole: broken asphalt rim, a dark hole, a few radiating cracks. */
function drawPothole(ctx, h) {
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(h.angle);
  ctx.fillStyle = 'rgba(255,240,220,0.1)';
  ctx.beginPath();
  ctx.ellipse(0, 0, POTHOLE_RX + 5, POTHOLE_RY + 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#25221f';
  ctx.beginPath();
  ctx.ellipse(0, 0, POTHOLE_RX, POTHOLE_RY, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#171513';
  ctx.beginPath();
  ctx.ellipse(-3, -2, POTHOLE_RX * 0.6, POTHOLE_RY * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const a of [0.4, 2.1, 3.6, 5.2]) {
    ctx.moveTo(Math.cos(a) * POTHOLE_RX, Math.sin(a) * POTHOLE_RY);
    ctx.lineTo(Math.cos(a + 0.2) * (POTHOLE_RX + 10), Math.sin(a + 0.2) * (POTHOLE_RY + 7));
  }
  ctx.stroke();
  ctx.restore();
}

/** Jaywalkers: a few everyday looks, drawn with the shared people renderer. */
const PEDESTRIAN_LOOKS = [
  { bodyColor: '#c4532d', pantsColor: '#3a3f5a', headColor: '#f1c27d', hairColor: '#2a1a10', eyeColor: '#2a2a2a', eyeShape: 'roundSmall', browAngle: 0.2, mouthCurve: 0.4, blush: false, hairStyle: 'sidePart', outfit: 'collar' },
  { bodyColor: '#5f8a5b', pantsColor: '#4a4f5a', headColor: '#8d5524', hairColor: '#1a120c', eyeColor: '#1a1a1a', eyeShape: 'bigRound', browAngle: 0.4, mouthCurve: 0.8, blush: true, hairStyle: 'bun', outfit: 'dress' },
  { bodyColor: '#6a7bd0', pantsColor: '#2e3346', headColor: '#e0ac69', hairColor: '#3a2a20', eyeColor: '#2a2a3a', eyeShape: 'narrow', browAngle: -0.2, mouthCurve: 0, blush: false, hairStyle: 'beanie', hatColor: '#d9a93f', outfit: 'hoodie' },
];
const PED_SCALE = 0.62;

function pedBox(p) {
  return { x: p.x - 9, y: p.y - 30, w: 18, h: 32 };
}

/**
 * A jaywalker with a little walking bob; one that's dodging traffic shows a
 * "!" and one that's been hit tumbles away.
 */
function drawPedestrian(ctx, p, t) {
  ctx.save();
  if (p.hit) {
    ctx.globalAlpha = Math.max(0, 1 - p.hitT / 0.9);
    ctx.translate(p.x, p.y - 14);
    ctx.rotate(p.hitT * 9 * p.dir);
    ctx.translate(-p.x, -(p.y - 14));
  }
  const bob = p.hit ? 0 : Math.abs(Math.sin(t * 10 + p.phase)) * 2;
  drawPerson(ctx, p.x, p.y - bob, PEDESTRIAN_LOOKS[p.look], { scale: PED_SCALE });
  ctx.restore();
  if (p.fleeing && !p.hit) {
    ctx.fillStyle = '#ffb547';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', p.x, p.y - 42);
  }
}

/** A traffic cone, top-down: orange disc, white band, square base. */
function drawCone(ctx, x, y) {
  ctx.fillStyle = SHADOW;
  ctx.fillRect(x - 5, y - 3, 12, 12);
  fillRoundRect(ctx, '#2b2724', x - 7, y - 7, 14, 14, 2);
  ctx.fillStyle = '#e8763a';
  ctx.beginPath();
  ctx.arc(x, y, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f4efe4';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, 3.2, 0, Math.PI * 2);
  ctx.stroke();
}

/** The part of the road a construction zone's barriers block (its hitbox). */
function zoneBox(z) {
  return { x: SHOULDER + LANE_WIDTH * z.lane + 8, y: z.y + 12, w: LANE_WIDTH - 16, h: z.length - 24 };
}

/**
 * A construction zone closing one edge lane: dug-up gravel, striped
 * water-filled barriers along the open side, cones tapering in at both
 * ends, a sand pile, a blinking amber lamp and a parked dump truck.
 */
function drawZone(ctx, z, t) {
  const left = SHOULDER + LANE_WIDTH * z.lane;
  const bottom = z.y + z.length;
  const inner = z.lane === 0 ? left + LANE_WIDTH - 12 : left + 4;
  const outer = z.lane === 0 ? left + 14 : left + LANE_WIDTH - 14;
  ctx.fillStyle = 'rgba(176,150,112,0.55)';
  ctx.fillRect(left + 6, z.y + 70, LANE_WIDTH - 12, z.length - 140);
  const rand = seededRandom(z.seed);
  ctx.fillStyle = 'rgba(90,76,58,0.5)';
  for (let i = 0; i < 40; i++) ctx.fillRect(left + 10 + rand() * (LANE_WIDTH - 20), z.y + 80 + rand() * (z.length - 160), 2, 2);
  for (let y = z.y + 70, i = 0; y < bottom - 70; y += 26, i++) {
    fillRoundRect(ctx, i % 2 ? '#f4efe4' : '#e8763a', inner, y, 8, 24, 3);
  }
  // Cones taper across the lane at both ends.
  for (let i = 0; i <= 5; i++) {
    const k = i / 5;
    drawCone(ctx, outer + (inner + 4 - outer) * k, bottom - 8 - k * 62);
    drawCone(ctx, outer + (inner + 4 - outer) * k, z.y + 8 + k * 62);
  }
  ctx.fillStyle = '#c9a96e';
  ctx.beginPath();
  ctx.ellipse(left + LANE_WIDTH / 2, z.y + z.length * 0.72, 26, 18, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#b8955a';
  ctx.beginPath();
  ctx.ellipse(left + LANE_WIDTH / 2 - 4, z.y + z.length * 0.72 - 3, 15, 10, 0.3, 0, Math.PI * 2);
  ctx.fill();
  const truck = { seed: z.seed, color: '#e3b23c' };
  const tx = left + (LANE_WIDTH - 62) / 2;
  const ty = z.y + z.length * 0.3;
  drawShadow(ctx, tx, ty, 62, 104, 6);
  drawDumpTruck(ctx, truck, tx, ty, 62, 104);
  // A cement mixer parked between the dump truck and the sand pile, its drum turning.
  const my = z.y + z.length * 0.47;
  drawShadow(ctx, tx, my, 62, 128, 6);
  drawMixer(ctx, {}, tx, my, 62, 128, t);
  // Blinking amber lamp on the first barrier.
  if (Math.floor(t * 3) % 2) {
    const g = ctx.createRadialGradient(inner + 4, bottom - 72, 1, inner + 4, bottom - 72, 18);
    g.addColorStop(0, 'rgba(255,190,70,0.9)');
    g.addColorStop(1, 'rgba(255,190,70,0)');
    ctx.fillStyle = g;
    ctx.fillRect(inner - 14, bottom - 90, 36, 36);
  }
}

// --- power-ups ---------------------------------------------------------------

const POWERUP_RADIUS = 15;
const POWERUP_COLORS = { nitro: '#e8763a', shield: '#4f8bff', magnet: '#c9402c', emp: '#8a5cc7' };

/** The icon inside a power-up badge, centred on (0, 0). */
function drawPowerupIcon(ctx, kind) {
  const c = POWERUP_COLORS[kind];
  ctx.fillStyle = c;
  ctx.strokeStyle = c;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (kind === 'nitro') {
    // A gas canister with a valve.
    roundRect(ctx, -4.5, -5, 9, 12, 3);
    ctx.fill();
    ctx.fillRect(-1.5, -9, 3, 4);
    ctx.fillStyle = '#fff6d8';
    ctx.fillRect(-2.5, -1, 5, 2);
  } else if (kind === 'shield') {
    ctx.moveTo(0, -9);
    ctx.lineTo(8, -5);
    ctx.quadraticCurveTo(7, 5, 0, 9);
    ctx.quadraticCurveTo(-7, 5, -8, -5);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'magnet') {
    ctx.arc(0, 0, 6, Math.PI, 0, true);
    ctx.moveTo(-6, 0);
    ctx.lineTo(-6, -6);
    ctx.moveTo(6, 0);
    ctx.lineTo(6, -6);
    ctx.stroke();
    ctx.fillStyle = '#c9c3b7';
    ctx.fillRect(-7.5, -9, 3, 3);
    ctx.fillRect(4.5, -9, 3, 3);
  } else {
    // EMP: a lightning bolt.
    ctx.moveTo(2, -9);
    ctx.lineTo(-5, 1);
    ctx.lineTo(0, 1);
    ctx.lineTo(-2, 9);
    ctx.lineTo(5, -1);
    ctx.lineTo(0, -1);
    ctx.closePath();
    ctx.fill();
  }
}

/** A bobbing power-up badge on the road. */
function drawPowerup(ctx, p, t) {
  const y = p.y + Math.sin(t * 4 + p.phase) * 2.5;
  const c = POWERUP_COLORS[p.kind];
  const glow = ctx.createRadialGradient(p.x, y, 4, p.x, y, POWERUP_RADIUS * 2.2);
  glow.addColorStop(0, `${c}88`);
  glow.addColorStop(1, `${c}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(p.x - POWERUP_RADIUS * 2.2, y - POWERUP_RADIUS * 2.2, POWERUP_RADIUS * 4.4, POWERUP_RADIUS * 4.4);
  ctx.fillStyle = SHADOW;
  ctx.beginPath();
  ctx.arc(p.x + 3, y + 5, POWERUP_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fbf6ec';
  ctx.beginPath();
  ctx.arc(p.x, y, POWERUP_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = c;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.save();
  ctx.translate(p.x, y);
  drawPowerupIcon(ctx, p.kind);
  ctx.restore();
}

/** Shimmering bubble round a shielded bus. */
function drawShieldBubble(ctx, x, t, busKey, left) {
  const l = busDef(busKey).length;
  const cy = BUS_Y + l / 2;
  const fading = left < 2 && Math.floor(t * 8) % 2;
  if (fading) return;
  ctx.fillStyle = 'rgba(79,139,255,0.16)';
  ctx.strokeStyle = `rgba(150,190,255,${0.55 + Math.sin(t * 6) * 0.25})`;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(x, cy, 42, l / 2 + 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

/** Nitro flames out of the bus's rear. */
function drawNitroFlame(ctx, x, t, busKey, k) {
  const tail = BUS_Y + busDef(busKey).length;
  for (const dx of [-12, 12]) {
    const len = (22 + Math.sin(t * 40 + dx) * 6) * k;
    const g = ctx.createLinearGradient(0, tail, 0, tail + len);
    g.addColorStop(0, 'rgba(255,240,180,0.95)');
    g.addColorStop(0.4, 'rgba(255,150,60,0.85)');
    g.addColorStop(1, 'rgba(201,64,44,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x + dx - 5, tail);
    ctx.quadraticCurveTo(x + dx, tail + len * 1.2, x + dx + 5, tail);
    ctx.fill();
  }
}

/** Active power-up chips across the top-left of the road, with time bars. */
function drawPowerupChips(ctx, r) {
  const chips = [];
  if (r.shield > 0) chips.push(['shield', r.shield / POWERUPS.shield.seconds]);
  if (r.magnet > 0) chips.push(['magnet', r.magnet / POWERUPS.magnet.seconds]);
  chips.forEach(([kind, k], i) => {
    const x = SHOULDER + 8 + i * 74;
    const y = 10;
    fillRoundRect(ctx, 'rgba(36,30,24,0.7)', x, y, 68, 26, 6);
    ctx.save();
    ctx.translate(x + 14, y + 13);
    ctx.scale(0.75, 0.75);
    drawPowerupIcon(ctx, kind);
    ctx.restore();
    ctx.fillStyle = '#f1e9d6';
    ctx.font = '600 11px Figtree, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(POWERUPS[kind].label, x + 26, y + 10);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(x + 26, y + 18, 36, 3);
    ctx.fillStyle = POWERUP_COLORS[kind];
    ctx.fillRect(x + 26, y + 18, 36 * Math.max(0, k), 3);
  });
}

// --- helicopter --------------------------------------------------------------

/**
 * The police helicopter, top-down and nose toward the bus: a searchlight
 * on the bus, its shadow on the road, navy-and-white body, tail boom with
 * a tail rotor, skids, and a spinning main rotor.
 */
function drawHelicopter(ctx, h, t, busX, busKey) {
  if (h.grounded <= 0) {
    const cy = BUS_Y + busDef(busKey).length / 2;
    const g = ctx.createRadialGradient(busX, cy, 10, busX, cy, 70);
    g.addColorStop(0, 'rgba(255,246,200,0.32)');
    g.addColorStop(1, 'rgba(255,246,200,0)');
    ctx.fillStyle = g;
    ctx.fillRect(busX - 70, cy - 70, 140, 140);
  }
  ctx.fillStyle = 'rgba(28,22,16,0.22)';
  ctx.beginPath();
  ctx.ellipse(h.x + 34, h.y + 80, 22, 30, 0, 0, Math.PI * 2);
  ctx.fill();
  fillRoundRect(ctx, '#24345a', h.x - 3, h.y - 66, 6, 50, 3); // tail boom
  fillRoundRect(ctx, '#1b2230', h.x - 10, h.y - 70, 20, 5, 2); // tail fin
  ctx.save();
  ctx.translate(h.x + 6, h.y - 64);
  ctx.rotate(t * 30);
  ctx.fillStyle = 'rgba(40,40,40,0.7)';
  ctx.fillRect(-9, -1, 18, 2);
  ctx.restore();
  ctx.fillStyle = '#3a3734';
  ctx.fillRect(h.x - 20, h.y - 12, 3, 30);
  ctx.fillRect(h.x + 17, h.y - 12, 3, 30);
  ctx.fillStyle = bodyGradient(ctx, POLICE_WHITE, h.x - 16, 32);
  ctx.beginPath();
  ctx.ellipse(h.x, h.y, 16, 25, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = POLICE_NAVY;
  ctx.fillRect(h.x - 16, h.y - 4, 32, 6);
  ctx.fillStyle = GLASS;
  ctx.beginPath();
  ctx.ellipse(h.x, h.y + 13, 11, 10, 0, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = sirenPhase(t) ? '#ff4b3a' : '#4f8bff';
  ctx.beginPath();
  ctx.arc(h.x, h.y - 18, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(30,30,30,0.12)';
  ctx.beginPath();
  ctx.arc(h.x, h.y, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(t * 22);
  ctx.fillStyle = 'rgba(40,40,40,0.75)';
  ctx.fillRect(-46, -2, 92, 4);
  ctx.fillRect(-2, -46, 4, 92);
  ctx.restore();
  fillRoundRect(ctx, '#5a5550', h.x - 4, h.y - 4, 8, 8, 2);
}

// --- fuel tanker crash -------------------------------------------------------

/** Fuel leaking from a crashed tanker: a dark, oily puddle that spreads. */
function drawFuelPuddle(ctx, v, k, t) {
  const cx = v.x;
  const cy = v.y + v.length / 2;
  const r = 30 + 70 * k;
  ctx.fillStyle = 'rgba(30,26,34,0.55)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 10, r * 1.1, r * 0.75, 0.3, 0, Math.PI * 2);
  ctx.fill();
  const sheen = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
  const s = (t * 0.3) % 1;
  sheen.addColorStop(0, 'rgba(120,80,200,0)');
  sheen.addColorStop(Math.max(0, s - 0.15), 'rgba(120,80,200,0)');
  sheen.addColorStop(s, 'rgba(90,200,190,0.22)');
  sheen.addColorStop(Math.min(1, s + 0.15), 'rgba(220,180,80,0)');
  sheen.addColorStop(1, 'rgba(220,180,80,0)');
  ctx.fillStyle = sheen;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 10, r * 0.9, r * 0.55, 0.3, 0, Math.PI * 2);
  ctx.fill();
}

/** A scorch mark left on the road by a tanker blast. */
function drawScorch(ctx, s) {
  const g = ctx.createRadialGradient(s.x, s.y, 4, s.x, s.y, 90);
  g.addColorStop(0, 'rgba(20,16,12,0.7)');
  g.addColorStop(0.6, 'rgba(30,24,18,0.35)');
  g.addColorStop(1, 'rgba(30,24,18,0)');
  ctx.fillStyle = g;
  ctx.fillRect(s.x - 90, s.y - 90, 180, 180);
}

function centreText(ctx, text, x, y, font, fill, stroke = 'rgba(30,20,10,0.75)') {
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 5;
  ctx.lineJoin = 'round';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

/**
 * Over a tanker crash: dazed stars round the bus and a STUNNED countdown,
 * then a pulsing blast circle and "GET CLEAR!" with the fuse running down.
 */
function drawCrashOverlay(ctx, c, t, busX) {
  const cy = c.v.y + c.v.length / 2;
  if (c.stun > 0) {
    for (let i = 0; i < 4; i++) {
      const a = t * 4 + (i * Math.PI) / 2;
      ctx.fillStyle = '#ffe08a';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', busX + Math.cos(a) * 26, BUS_Y - 6 + Math.sin(a) * 8);
    }
    centreText(ctx, `STUNNED ${Math.ceil(c.stun)}`, WIDTH / 2, 70, 'bold 30px Caprasimo, Georgia, serif', '#ffb547');
    centreText(ctx, c.v.hazmat ? 'The gasoline is leaking…' : 'The tanker is leaking…', WIDTH / 2, 102, '600 15px Figtree, sans-serif', '#f1e9d6');
    return;
  }
  const flash = Math.floor(t * 8) % 2;
  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.lineDashOffset = -t * 40;
  ctx.strokeStyle = flash ? 'rgba(255,75,58,0.95)' : 'rgba(255,181,71,0.85)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(c.v.x, cy, FUEL_BLAST_RADIUS, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,75,58,0.08)';
  ctx.beginPath();
  ctx.arc(c.v.x, cy, FUEL_BLAST_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  // Flames licking the tanker.
  for (let i = 0; i < 6; i++) {
    const k = (t * 2 + i / 6) % 1;
    ctx.fillStyle = `rgba(255,${150 + Math.floor(k * 80)},60,${0.8 * (1 - k)})`;
    ctx.beginPath();
    ctx.arc(c.v.x + Math.sin(i * 2.3 + t * 5) * 14, cy - k * 30, 9 - k * 5, 0, Math.PI * 2);
    ctx.fill();
  }
  centreText(ctx, `GET CLEAR! ${Math.max(0, c.fuse).toFixed(1)}`, WIDTH / 2, 70, 'bold 30px Caprasimo, Georgia, serif', flash ? '#ff6a4d' : '#ffb547');
  centreText(ctx, '← → out of the blast!', WIDTH / 2, 102, '600 15px Figtree, sans-serif', '#f1e9d6');
}

/** A fireball: layered radial glow, `k` 0..1 through its life. */
function drawFireball(ctx, x, y, radius, k) {
  const g = ctx.createRadialGradient(x, y, 2, x, y, radius);
  g.addColorStop(0, `rgba(255,250,220,${1 - k * 0.6})`);
  g.addColorStop(0.3, `rgba(255,200,90,${0.95 - k * 0.5})`);
  g.addColorStop(0.65, `rgba(230,100,40,${0.8 - k * 0.5})`);
  g.addColorStop(1, 'rgba(90,40,20,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

// --- night (Changi) ----------------------------------------------------------

/**
 * Paints darkness into `layer` (a canvas the size of the game) with holes
 * cut for the bus's headlight beam, oncoming headlights, police lights and
 * the street lamps, then lays it over the road at `alpha`.
 */
function drawNight(ctx, layer, dpr, r, busKey, alpha) {
  const n = layer.getContext('2d');
  n.setTransform(dpr, 0, 0, dpr, 0, 0);
  n.globalCompositeOperation = 'source-over';
  n.clearRect(0, 0, WIDTH, HEIGHT);
  n.fillStyle = 'rgba(8,12,32,0.8)';
  n.fillRect(0, 0, WIDTH, HEIGHT);
  n.globalCompositeOperation = 'destination-out';
  const hole = (x, y, rad, k) => {
    const g = n.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(0,0,0,${k})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    n.fillStyle = g;
    n.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  };
  // The bus's headlight beam up the road.
  const beam = n.createLinearGradient(0, BUS_Y, 0, BUS_Y - 340);
  beam.addColorStop(0, 'rgba(0,0,0,0.95)');
  beam.addColorStop(1, 'rgba(0,0,0,0)');
  n.fillStyle = beam;
  n.beginPath();
  n.moveTo(r.busX - 20, BUS_Y + 4);
  n.lineTo(r.busX + 20, BUS_Y + 4);
  n.lineTo(r.busX + 120, BUS_Y - 340);
  n.lineTo(r.busX - 120, BUS_Y - 340);
  n.closePath();
  n.fill();
  hole(r.busX, BUS_Y + busDef(busKey).length / 2, 80, 0.9);
  r.vehicles.forEach((v) => {
    hole(v.x, v.y + v.length + 26, 58, 0.85);
    hole(v.x, v.y + v.length / 2, 36, 0.45);
  });
  r.police.forEach((p) => hole(p.x, p.y + p.length * 0.5, 54, 0.75));
  if (r.track && r.track.train) {
    const tr = r.track.train;
    hole(TRACK_X[tr.track], tr.track === 1 ? tr.y + TRAIN_LENGTH + 30 : tr.y - 30, 90, 0.85);
  }
  // Street-lamp pools, matching the scenery tile's lamp spacing.
  const gap = DISTRICTS[r.level].lampGap;
  for (let k = -1; k * gap < HEIGHT + gap; k++) {
    hole(WIDTH - 50, (r.scroll % gap) + k * gap, 70, 0.7);
    hole(50, ((r.scroll + gap / 2) % gap) + k * gap, 70, 0.7);
  }
  r.fareItems.forEach((f) => hole(f.x, f.y, 26, 0.6));
  r.powerups.forEach((p) => hole(p.x, p.y, 30, 0.7));
  n.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = alpha;
  ctx.drawImage(layer, 0, 0, WIDTH, HEIGHT);
  ctx.globalAlpha = 1;
}

// --- the elevated MRT track ---------------------------------------------------
//
// Up on the viaduct the road below is dimmed and the deck fills the middle
// of the screen: two tracks, 0 (left) running up the screen, 1 (right) down.

const DECK_LEFT = 104;
const DECK_RIGHT = WIDTH - 104;
const TRACK_X = [180, WIDTH - 180];
const TRACK_GAP = TRACK_X[1] - TRACK_X[0];
const TRAIN_WIDTH = 66;
const SLEEPER_GAP = 22;

/** Which track an x position is nearest to. */
function trackAt(x) {
  return Math.abs(x - TRACK_X[0]) <= Math.abs(x - TRACK_X[1]) ? 0 : 1;
}

/** The deck, ballast, sleepers and rails, scrolling with the bus; `alpha` fades it in/out. */
function drawViaduct(ctx, scroll, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(20,16,12,0.5)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; // the deck's shadow on the road below
  ctx.fillRect(DECK_LEFT + 18, 0, DECK_RIGHT - DECK_LEFT, HEIGHT);
  const g = ctx.createLinearGradient(DECK_LEFT, 0, DECK_RIGHT, 0);
  g.addColorStop(0, '#9e978c');
  g.addColorStop(0.5, '#c9c2b6');
  g.addColorStop(1, '#a39c91');
  ctx.fillStyle = g;
  ctx.fillRect(DECK_LEFT, 0, DECK_RIGHT - DECK_LEFT, HEIGHT);
  // Parapets with expansion joints.
  for (const px of [DECK_LEFT, DECK_RIGHT - 10]) {
    ctx.fillStyle = '#ddd6ca';
    ctx.fillRect(px, 0, 10, HEIGHT);
    ctx.fillStyle = '#857e74';
    for (let y = (scroll % 160) - 160; y < HEIGHT; y += 160) ctx.fillRect(px, y, 10, 2);
  }
  // Centre walkway between the tracks.
  ctx.fillStyle = '#b5aea2';
  ctx.fillRect(WIDTH / 2 - 6, 0, 12, HEIGHT);
  for (const tx of TRACK_X) {
    ctx.fillStyle = '#6b625a'; // ballast
    ctx.fillRect(tx - 44, 0, 88, HEIGHT);
    ctx.fillStyle = '#4a433d';
    for (let y = (scroll % SLEEPER_GAP) - SLEEPER_GAP; y < HEIGHT; y += SLEEPER_GAP) ctx.fillRect(tx - 36, y, 72, 8);
    ctx.fillStyle = '#d3cdc2'; // rails
    ctx.fillRect(tx - 26, 0, 4, HEIGHT);
    ctx.fillRect(tx + 22, 0, 4, HEIGHT);
  }
  // Direction arrows painted between the rails every so often.
  ctx.fillStyle = 'rgba(244,239,228,0.35)';
  for (let y = (scroll % 320) - 320; y < HEIGHT; y += 320) {
    [[TRACK_X[0], -1], [TRACK_X[1], 1]].forEach(([tx, dir]) => {
      const ay = y + 160;
      ctx.beginPath();
      ctx.moveTo(tx, ay + dir * 14);
      ctx.lineTo(tx + 10, ay - dir * 4);
      ctx.lineTo(tx - 10, ay - dir * 4);
      ctx.closePath();
      ctx.fill();
    });
  }
  ctx.restore();
}

/**
 * An MRT train of three cars: silver bodies with a red stripe, roof aircon
 * units, dark gangways between cars, and a windscreen and headlights at the
 * nose. `facingUp` puts the nose at the top.
 */
function drawTrain(ctx, x, y, length, facingUp) {
  const w = TRAIN_WIDTH;
  const left = x - w / 2;
  const carLen = (length - 8) / 3;
  ctx.fillStyle = SHADOW;
  ctx.fillRect(left + 6, y + 8, w, length);
  for (let i = 0; i < 3; i++) {
    const cy = y + i * (carLen + 4);
    ctx.fillStyle = bodyGradient(ctx, '#dcdedd', left, w);
    roundRect(ctx, left, cy, w, carLen, 8);
    ctx.fill();
    ctx.strokeStyle = '#8f9493';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = '#c9402c';
    ctx.fillRect(left + 2, cy + 6, 4, carLen - 12);
    ctx.fillRect(left + w - 6, cy + 6, 4, carLen - 12);
    for (let a = cy + 18; a < cy + carLen - 24; a += 30) fillRoundRect(ctx, '#b5b9b8', left + 16, a, w - 32, 16, 3);
    if (i < 2) {
      ctx.fillStyle = '#2b2724';
      ctx.fillRect(left + 14, cy + carLen, w - 28, 4);
    }
  }
  const noseY = facingUp ? y : y + length;
  const dir = facingUp ? 1 : -1;
  ctx.fillStyle = GLASS;
  ctx.fillRect(left + 8, noseY + dir * 4 - (facingUp ? 0 : 12), w - 16, 12);
  ctx.fillStyle = HEADLIGHT;
  ctx.fillRect(left + 6, noseY + (facingUp ? 1 : -4), 10, 3);
  ctx.fillRect(left + w - 16, noseY + (facingUp ? 1 : -4), 10, 3);
  const glow = ctx.createRadialGradient(x, noseY - dir * 30, 4, x, noseY - dir * 30, 70);
  glow.addColorStop(0, 'rgba(255,243,196,0.4)');
  glow.addColorStop(1, 'rgba(255,243,196,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 70, noseY - dir * 30 - 70, 140, 140);
}

/** The flashing "TRAIN!" warning down one track, from the end it's coming from. */
function drawTrainWarning(ctx, track, t) {
  const tx = TRACK_X[track];
  const flash = Math.floor(t * 8) % 2;
  ctx.fillStyle = flash ? 'rgba(255,75,58,0.28)' : 'rgba(255,181,71,0.18)';
  ctx.fillRect(tx - 44, 0, 88, HEIGHT);
  const fromTop = track === 1;
  const y = fromTop ? 34 : HEIGHT - 34;
  centreText(ctx, fromTop ? '▼ TRAIN! ▼' : '▲ TRAIN BEHIND! ▲', tx, y, 'bold 16px Figtree, sans-serif', flash ? '#ff6a4d' : '#ffb547');
}

/** The ride's countdown chip, top centre. */
function drawTrackTimer(ctx, left) {
  const secs = Math.max(0, Math.ceil(left));
  fillRoundRect(ctx, 'rgba(36,30,24,0.75)', WIDTH / 2 - 58, 10, 116, 28, 8);
  centreText(ctx, `MRT  0:${String(secs).padStart(2, '0')}`, WIDTH / 2, 25, 'bold 15px Figtree, sans-serif', secs <= 5 ? '#ff6a4d' : '#f1e9d6');
}

/**
 * The near edge of the viaduct along the side a ramp truck is parked on —
 * concrete deck over the verge, with pillars — so the jump has somewhere to go.
 */
function drawViaductEdge(ctx, side, scroll) {
  const x = side < 0 ? 0 : WIDTH - SHOULDER + 4;
  const w = SHOULDER - 4;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(side < 0 ? w : x - 8, 0, 8, HEIGHT);
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, '#a39c91');
  g.addColorStop(1, '#cfc8bc');
  ctx.fillStyle = g;
  ctx.fillRect(x, 0, w, HEIGHT);
  ctx.fillStyle = '#857e74';
  for (let y = (scroll % 160) - 160; y < HEIGHT; y += 160) ctx.fillRect(x, y, w, 2);
  ctx.fillStyle = '#6b625a';
  ctx.fillRect(side < 0 ? x : x + w - 10, 0, 10, HEIGHT);
}

// --- weather -------------------------------------------------------------------

/** How strong the storm looks: fades in over its first 2 s and out over its last 2 s. */
function stormStrength(w) {
  if (!w || w.rain <= 0) return 0;
  return Math.min(1, w.rain / 2, (STORM_SECONDS - w.rain) / 2);
}

/** Grey wash, slanting rain streaks and a lightning flash over everything. */
function drawRain(ctx, w, t) {
  const k = stormStrength(w);
  if (k > 0) {
    ctx.fillStyle = `rgba(40,55,75,${0.28 * k})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.strokeStyle = `rgba(200,220,240,${0.55 * k})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < 140; i++) {
      const x = (i * 73.3 + t * 70) % (WIDTH + 40) - 20;
      const y = (i * 131.7 + t * 950) % (HEIGHT + 40) - 20;
      ctx.moveTo(x, y);
      ctx.lineTo(x - 4, y + 16);
    }
    ctx.stroke();
  }
  if (w && w.flash > 0) {
    ctx.fillStyle = `rgba(240,244,255,${Math.min(0.75, w.flash * 3)})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
}

/** Muddy water over the windscreen after a puddle splash, `k` 1 → 0. */
function drawSplash(ctx, k) {
  if (k <= 0) return;
  ctx.fillStyle = `rgba(120,110,90,${0.45 * k})`;
  ctx.fillRect(0, 0, WIDTH, HEIGHT * 0.75);
  const rand = seededRandom(5);
  for (let i = 0; i < 26; i++) {
    const x = rand() * WIDTH;
    const y = rand() * HEIGHT * 0.8;
    const r = 14 + rand() * 34;
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
    g.addColorStop(0, `rgba(235,240,245,${0.5 * k})`);
    g.addColorStop(0.6, `rgba(140,130,110,${0.55 * k})`);
    g.addColorStop(1, 'rgba(140,130,110,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y + (1 - k) * 30, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

const PUDDLE_RX = 28;
const PUDDLE_RY = 15;
function puddleBox(p) {
  return { x: p.x - PUDDLE_RX + 6, y: p.y - PUDDLE_RY + 4, w: PUDDLE_RX * 2 - 12, h: PUDDLE_RY * 2 - 8 };
}

/** A rain puddle: dark water with a sky reflection and spreading ripples. */
function drawPuddle(ctx, p, t) {
  ctx.fillStyle = 'rgba(40,52,64,0.75)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, PUDDLE_RX, PUDDLE_RY, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(160,190,215,0.35)';
  ctx.beginPath();
  ctx.ellipse(p.x - 8, p.y - 4, PUDDLE_RX * 0.5, PUDDLE_RY * 0.35, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(210,225,240,0.5)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 2; i++) {
    const k = (t * 1.2 + i * 0.5 + p.phase) % 1;
    ctx.beginPath();
    ctx.ellipse(p.x + (i ? 9 : -6), p.y + (i ? 3 : -2), 3 + k * 10, 2 + k * 5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

const SAND_HALF = 22;
function sandBox(d) {
  return { x: d.x - SAND_HALF, y: d.y - 12, w: SAND_HALF * 2, h: 24 };
}

/** A sand drift blown across the road: a soft tan heap with wind ripples. */
function drawSandDrift(ctx, d) {
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.rotate(d.angle);
  ctx.fillStyle = 'rgba(214,190,140,0.9)';
  ctx.beginPath();
  ctx.ellipse(0, 0, SAND_HALF + 6, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(235,215,170,0.9)';
  ctx.beginPath();
  ctx.ellipse(-4, -3, SAND_HALF - 4, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(170,145,100,0.7)';
  ctx.lineWidth = 1;
  for (const dy of [-6, 0, 6]) {
    ctx.beginPath();
    ctx.moveTo(-SAND_HALF + 2, dy);
    ctx.quadraticCurveTo(0, dy - 4, SAND_HALF - 2, dy);
    ctx.stroke();
  }
  ctx.restore();
}

// --- cement mixer: drift ring, danger zone, the laugh ---------------------------

/**
 * The drift radius round a mixer the bus is closing on: a dashed ring that
 * lights up once the bus is inside it, plus a "DRAG → DRIFT!" bubble
 * pointing toward the mixer (`dir` -1/1) when a drift is on.
 */
function drawDriftRing(ctx, v, t, inRange, dir) {
  const cy = v.y + v.length / 2;
  ctx.save();
  ctx.setLineDash([8, 7]);
  ctx.lineDashOffset = -t * 30;
  ctx.strokeStyle = inRange ? `rgba(255,181,71,${0.75 + Math.sin(t * 10) * 0.2})` : 'rgba(241,233,214,0.35)';
  ctx.lineWidth = inRange ? 3 : 2;
  ctx.beginPath();
  ctx.arc(v.x, cy, DRIFT_RADIUS, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  if (!inRange) return;
  const pulse = 1 + Math.sin(t * 8) * 0.06;
  ctx.save();
  ctx.translate(v.x, cy);
  ctx.scale(pulse, pulse);
  fillRoundRect(ctx, 'rgba(36,30,24,0.85)', -64, -14, 128, 28, 8);
  centreText(ctx, dir < 0 ? 'DRAG ← DRIFT!' : 'DRAG → DRIFT!', 0, 1, 'bold 13px Figtree, sans-serif', '#ffb547');
  ctx.restore();
}

/** Tyre smoke and rubber off a drifting bus (or a mixer standing on its brakes). */
function drawTyreSmoke(ctx, x, y, t, k) {
  for (let i = 0; i < 6; i++) {
    const p = (t * 1.8 + i / 6) % 1;
    ctx.fillStyle = `rgba(225,220,212,${0.5 * k * (1 - p)})`;
    ctx.beginPath();
    ctx.arc(x + Math.sin(i * 2.1 + t * 3) * 18, y + p * 46, 8 + p * 16, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** The lane a tipping mixer will land in, flashing red over its length. */
function drawTipZone(ctx, v, t) {
  const left = SHOULDER + LANE_WIDTH * v.fallLane;
  const flash = Math.floor(t * 10) % 2;
  ctx.fillStyle = flash ? 'rgba(255,75,58,0.35)' : 'rgba(255,75,58,0.18)';
  ctx.fillRect(left + 2, v.y - 10, LANE_WIDTH - 4, v.length + 20);
  ctx.strokeStyle = 'rgba(255,106,77,0.9)';
  ctx.setLineDash([8, 6]);
  ctx.lineWidth = 2;
  ctx.strokeRect(left + 2, v.y - 10, LANE_WIDTH - 4, v.length + 20);
  ctx.setLineDash([]);
}

/** Black letterbox bars that mark a cutscene. */
function drawLetterbox(ctx, k) {
  ctx.fillStyle = '#0d0b09';
  ctx.fillRect(0, 0, WIDTH, 46 * k);
  ctx.fillRect(0, HEIGHT - 46 * k, WIDTH, 46 * k);
}

/**
 * Inside the bus after the mixer squashes the police: the driver doubled
 * over the wheel, howling with laughter, tears flying. `t` counts from the
 * start of the shot.
 */
function drawLaughScene(ctx, t) {
  // Dashboard view out of the windscreen: the road and the wreck behind in the mirror.
  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT * 0.55);
  sky.addColorStop(0, '#9cc3dd');
  sky.addColorStop(1, '#f1dfbf');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = '#4a4643';
  ctx.beginPath();
  ctx.moveTo(WIDTH / 2 - 20, HEIGHT * 0.32);
  ctx.lineTo(WIDTH / 2 + 20, HEIGHT * 0.32);
  ctx.lineTo(WIDTH + 80, HEIGHT * 0.62);
  ctx.lineTo(-80, HEIGHT * 0.62);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PAINT;
  for (let i = 0; i < 6; i++) {
    const k = ((t * 1.5 + i / 6) % 1);
    const y = HEIGHT * 0.32 + k * HEIGHT * 0.3;
    ctx.fillRect(WIDTH / 2 - 1 - k * 3, y, 2 + k * 6, 6 + k * 14);
  }
  // Windscreen frame and the dashboard.
  ctx.fillStyle = '#2b2724';
  ctx.fillRect(0, 0, WIDTH, 18);
  ctx.fillRect(0, 0, 22, HEIGHT);
  ctx.fillRect(WIDTH - 22, 0, 22, HEIGHT);
  fillRoundRect(ctx, '#3a3734', -10, HEIGHT * 0.6, WIDTH + 20, HEIGHT * 0.45, 30);
  // Rear-view mirror with the flattened police inside it.
  fillRoundRect(ctx, '#2b2724', WIDTH / 2 - 62, 56, 124, 44, 8);
  fillRoundRect(ctx, '#8fb0c4', WIDTH / 2 - 56, 61, 112, 34, 6);
  fillRoundRect(ctx, '#e8833a', WIDTH / 2 - 40, 72, 60, 16, 6);
  ctx.fillStyle = sirenPhase(t) ? '#ff4b3a' : '#4f8bff';
  ctx.fillRect(WIDTH / 2 + 18, 78, 18, 6);
  // The driver, shaking with laughter behind the wheel.
  const shakeX = Math.sin(t * 38) * 4;
  const bob = Math.abs(Math.sin(t * 14)) * 8;
  ctx.save();
  ctx.translate(WIDTH / 2 + shakeX, HEIGHT * 0.9 - bob);
  ctx.rotate(Math.sin(t * 9) * 0.08);
  drawPerson(ctx, 0, 0, LAUGHER, { scale: 3.1 });
  // Mouth wide open, mid-guffaw (people.js only draws a closed smile).
  const open = 0.7 + Math.abs(Math.sin(t * 14)) * 0.3;
  ctx.fillStyle = '#5a1f1a';
  ctx.beginPath();
  ctx.ellipse(0, -88, 10, 8 * open, 0, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = '#e07a6a';
  ctx.beginPath();
  ctx.ellipse(0, -88 + 5 * open, 5, 2.5 * open, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Steering wheel in front.
  ctx.strokeStyle = '#1f1d1b';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.ellipse(WIDTH / 2, HEIGHT * 0.99, 130, 46, 0, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  // Tears flying off and the laughing.
  ctx.fillStyle = '#9fd0f0';
  for (let i = 0; i < 6; i++) {
    const k = (t * 1.8 + i / 6) % 1;
    const side = i % 2 ? 1 : -1;
    ctx.beginPath();
    ctx.arc(WIDTH / 2 + shakeX + side * (60 + k * 90), HEIGHT * 0.5 - bob - Math.sin(k * Math.PI) * 60 + k * 40, 5 - k * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  const words = ['HA', 'HAHA', 'HA HA HA!', 'BWAHAHA', 'HAHAHA!'];
  for (let i = 0; i < words.length; i++) {
    const k = (t * 0.9 + i / words.length) % 1;
    ctx.globalAlpha = Math.sin(k * Math.PI);
    centreText(ctx, words[i], 70 + ((i * 97) % 340), HEIGHT * 0.45 - k * 120, `bold ${18 + i * 3}px Caprasimo, Georgia, serif`, '#ffb547');
  }
  ctx.globalAlpha = 1;
}

/** Skid marks behind a cruiser that slammed on its brakes. */
function drawSkidMarks(ctx, marks) {
  ctx.strokeStyle = 'rgba(20,16,12,0.5)';
  ctx.lineWidth = 5;
  marks.forEach((m) => {
    ctx.beginPath();
    ctx.moveTo(m.x - 14, m.y);
    ctx.lineTo(m.x - 14, m.y + m.len);
    ctx.moveTo(m.x + 14, m.y);
    ctx.lineTo(m.x + 14, m.y + m.len);
    ctx.stroke();
  });
}

/**
 * Flattened into a pancake: the mixer lands on the bus, rolls off, and
 * leaves a squashed, wide-open-eyed pancake of a bus behind. `t` is the
 * cutscene clock, `def` the bus's size.
 */
function drawPancake(ctx, cut, t, busKey) {
  const def = busDef(busKey);
  const cy = BUS_Y + def.length / 2;
  const k = smoothstep((t - 0.5) / 0.5); // 0 = still under the mixer, 1 = revealed
  if (t > 0.45) {
    // A splat of crushed bodywork around the flattened bus.
    ctx.save();
    ctx.globalAlpha = Math.min(1, k * 1.5);
    ctx.fillStyle = 'rgba(40,34,30,0.55)';
    ctx.beginPath();
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const rad = (i % 2 ? 0.86 : 1) * (Math.abs(Math.cos(a)) * 52 + Math.abs(Math.sin(a)) * 66);
      const px = cut.x + Math.cos(a) * rad;
      const py = cy + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(cut.x, cy);
    ctx.scale(1.55, 1.12);
    ctx.globalAlpha = Math.min(1, k * 1.5);
    const look = BUS_LOOKS[busKey] || BUS_LOOKS.single;
    drawBusShape(ctx, 0, -def.length / 2, def.width, def.length, { body: shade(look.body, -0.25), roof: '#bfb39d' }, busKey, { route: 'X_X', shadow: false });
    // Tyre-tread stripes across the flattened roof.
    ctx.fillStyle = 'rgba(20,16,12,0.35)';
    for (let y = -def.length / 2 + 6; y < def.length / 2; y += 9) ctx.fillRect(-def.width / 2 + 6, y, def.width - 12, 3);
    // Crumple lines.
    ctx.strokeStyle = 'rgba(20,16,12,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-def.width / 2, -10);
    ctx.lineTo(-6, -4);
    ctx.lineTo(4, -14);
    ctx.lineTo(def.width / 2, -6);
    ctx.moveTo(-def.width / 2, 22);
    ctx.lineTo(0, 16);
    ctx.lineTo(def.width / 2, 26);
    ctx.stroke();
    ctx.restore();
    // The flattened driver peeking out, pancake-flat.
    ctx.save();
    ctx.translate(cut.x + 46, cy + 10);
    ctx.scale(1.6, 0.35);
    drawPerson(ctx, 0, 24, DRIVER, { scale: 0.8 });
    ctx.restore();
    if (t > 1) {
      for (let i = 0; i < 3; i++) {
        const a = t * 4 + (i * Math.PI * 2) / 3;
        centreText(ctx, '★', cut.x + 46 + Math.cos(a) * 24, cy - 2 + Math.sin(a) * 8, 'bold 13px sans-serif', '#ffe08a');
      }
    }
  }
  // The mixer slamming down on top, then rolling away.
  if (t < 1.1) {
    const v = cut.v;
    const drop = Math.min(1, t / 0.35);
    const off = smoothstep((t - 0.6) / 0.5) * 220 * (v.fallDir || 1);
    ctx.save();
    ctx.globalAlpha = 1 - smoothstep((t - 0.75) / 0.35);
    ctx.translate(off, -(1 - drop) * 30);
    drawFallenMixer(ctx, v, t);
    ctx.restore();
    if (t > 0.3 && t < 0.8) {
      ctx.fillStyle = `rgba(200,190,170,${0.6 * (1 - (t - 0.3) / 0.5)})`;
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.arc(cut.x + Math.cos(i) * 70 * (t - 0.2), cy + Math.sin(i) * 50 * (t - 0.2), 14 + 20 * (t - 0.3), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

/** The WASTED card over the frozen scene; `k` 0..1 fades and settles it in. */
function drawWastedCard(ctx, k, sub) {
  ctx.fillStyle = `rgba(30,28,26,${0.55 * k})`;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = `rgba(0,0,0,${0.6 * k})`;
  ctx.fillRect(0, HEIGHT / 2 - 54, WIDTH, 108);
  ctx.save();
  ctx.translate(WIDTH / 2, HEIGHT / 2 - 6);
  const s = 1.5 - 0.5 * smoothstep(k);
  ctx.scale(s, s);
  ctx.globalAlpha = k;
  centreText(ctx, 'WASTED', 0, 0, 'bold 64px Caprasimo, Georgia, serif', '#d8452f', '#140c08');
  ctx.restore();
  ctx.globalAlpha = k;
  centreText(ctx, sub, WIDTH / 2, HEIGHT / 2 + 36, '600 15px Figtree, sans-serif', '#f1e9d6');
  ctx.globalAlpha = 1;
}

// --- WASTED cutscene ---------------------------------------------------------
//
// The bus blows up with the tanker: the driver is flung out of the
// fireball, sails across the sea from Singapore to Alcatraz, lands in the
// prison yard, the cell bars slam shut, and "WASTED" comes up.

const CUT_FLIGHT = 1.0; // the boom over the frozen road, then the flight
const CUT_LAND = 3.6; // touchdown on the island
const CUT_CELL = 4.2; // cut to the cell; bars slam
const CUT_WASTED = 4.7; // WASTED card
const CUT_END = 7.2; // Run Over screen

/** When each kind of WASTED cutscene shows its card, and when it ends. */
const CUTS = {
  alcatraz: { wasted: CUT_WASTED, end: CUT_END },
  pancake: { wasted: 1.7, end: 4.4 },
};

const DRIVER = {
  bodyColor: '#3f6e9e', pantsColor: '#2c3e57', headColor: '#e0ac69', hairColor: '#2a1a10', accentColor: '#e0c25a',
  eyeColor: '#2a2a2a', eyeShape: 'bigRound', browAngle: 0.9, mouthCurve: -1.6, blush: false,
  hairStyle: 'spiky', outfit: 'uniform', shoeColor: '#2b2724',
};
/** The driver again, in stitches (drawLaughScene). */
const LAUGHER = { ...DRIVER, eyeShape: 'narrow', browAngle: -0.6, mouthCurve: 1.6, blush: true };
const PRISONER = {
  ...DRIVER, bodyColor: '#e8833a', pantsColor: '#e8833a', accentColor: '#f4efe4', outfit: 'stripes',
  eyeShape: 'roundSmall', browAngle: 1, mouthCurve: -1.4,
};

function smoothstep(k) {
  const c = Math.min(Math.max(k, 0), 1);
  return c * c * (3 - 2 * c);
}

/** The boom, drawn over the frozen road: fireball, flash, driver launched skyward. */
function drawCutsceneBoom(ctx, cut) {
  const k = cut.t / CUT_FLIGHT;
  const cy = BUS_Y + BUS_LENGTH / 2;
  drawFireball(ctx, cut.x, cy, 40 + 150 * smoothstep(k * 2), k);
  const dy = 1100 * k - 300 * k * k;
  ctx.save();
  ctx.translate(cut.x + 60 * k, cy - dy);
  ctx.rotate(k * 9);
  drawPerson(ctx, 0, 20, DRIVER, { scale: 0.9 + k * 0.4 });
  ctx.restore();
  if (cut.t < 0.18) {
    ctx.fillStyle = `rgba(255,250,235,${1 - cut.t / 0.18})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
}

/** Sky, sea, Singapore's skyline, the Golden Gate in the haze and Alcatraz. */
function drawBayScene(ctx, time) {
  const sky = ctx.createLinearGradient(0, 0, 0, 420);
  sky.addColorStop(0, '#7fb2d9');
  sky.addColorStop(1, '#f3dcb8');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, 420);
  const sun = ctx.createRadialGradient(410, 90, 10, 410, 90, 80);
  sun.addColorStop(0, 'rgba(255,236,170,1)');
  sun.addColorStop(0.35, 'rgba(255,220,140,0.8)');
  sun.addColorStop(1, 'rgba(255,220,140,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(330, 10, 160, 160);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  [[40, 70, 1], [230, 130, 0.8], [380, 200, 1.1]].forEach(([bx, by, s], i) => {
    const x = ((bx + time * (10 + i * 4)) % (WIDTH + 120)) - 60;
    ctx.beginPath();
    ctx.arc(x, by, 14 * s, 0, Math.PI * 2);
    ctx.arc(x + 16 * s, by - 6 * s, 17 * s, 0, Math.PI * 2);
    ctx.arc(x + 34 * s, by, 13 * s, 0, Math.PI * 2);
    ctx.fill();
  });
  // Golden Gate in the haze.
  ctx.strokeStyle = 'rgba(192,80,58,0.55)';
  ctx.fillStyle = 'rgba(192,80,58,0.55)';
  ctx.lineWidth = 2;
  ctx.fillRect(196, 360, 5, 56);
  ctx.fillRect(262, 360, 5, 56);
  ctx.fillRect(160, 404, 150, 3);
  ctx.beginPath();
  ctx.moveTo(160, 380);
  ctx.quadraticCurveTo(178, 404, 198, 362);
  ctx.quadraticCurveTo(232, 404, 264, 362);
  ctx.quadraticCurveTo(290, 404, 310, 384);
  ctx.stroke();
  // Singapore skyline, Marina Bay Sands' three towers and its sky-park boat.
  ctx.fillStyle = '#7e8ea0';
  [[4, 46], [20, 70], [104, 58], [122, 84], [140, 40]].forEach(([x, h]) => ctx.fillRect(x, 420 - h, 14, h));
  ctx.fillStyle = '#5f6f82';
  [36, 56, 76].forEach((x) => ctx.fillRect(x, 352, 13, 68));
  fillRoundRect(ctx, '#5f6f82', 30, 345, 66, 8, 4);
  // The sea.
  const sea = ctx.createLinearGradient(0, 420, 0, HEIGHT);
  sea.addColorStop(0, '#5a8fb4');
  sea.addColorStop(1, '#2c5a7a');
  ctx.fillStyle = sea;
  ctx.fillRect(0, 420, WIDTH, HEIGHT - 420);
  ctx.strokeStyle = 'rgba(200,228,245,0.45)';
  ctx.lineWidth = 1.5;
  for (let row = 0; row < 7; row++) {
    const y = 438 + row * 28;
    for (let x = ((time * 20 + row * 37) % 60) - 60; x < WIDTH; x += 60) {
      ctx.beginPath();
      ctx.arc(x + 15, y, 8, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
  }
  // Alcatraz: a rocky island, the cellhouse, a lighthouse and a water tower.
  ctx.fillStyle = '#8b7355';
  ctx.beginPath();
  ctx.moveTo(286, 428);
  ctx.lineTo(304, 400);
  ctx.lineTo(332, 392);
  ctx.lineTo(440, 388);
  ctx.lineTo(462, 404);
  ctx.lineTo(476, 428);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#6f8a4f';
  ctx.fillRect(300, 400, 26, 5);
  ctx.fillRect(444, 396, 20, 5);
  fillRoundRect(ctx, '#e8e1d3', 334, 364, 98, 27, 2);
  fillRoundRect(ctx, '#b9b1a3', 330, 360, 106, 6, 2);
  ctx.fillStyle = '#4a4f5a';
  for (let x = 340; x < 428; x += 9) {
    ctx.fillRect(x, 371, 4, 7);
    ctx.fillRect(x, 381, 4, 6);
  }
  ctx.fillStyle = '#f4efe4';
  ctx.fillRect(446, 350, 8, 40);
  fillRoundRect(ctx, '#3a3734', 443, 344, 14, 8, 2);
  ctx.fillStyle = Math.floor(time * 2) % 2 ? '#ffe08a' : '#c9a24a';
  ctx.fillRect(446, 346, 8, 4);
  ctx.fillStyle = '#6b6660';
  ctx.fillRect(312, 380, 2, 14);
  ctx.fillRect(322, 380, 2, 14);
  fillRoundRect(ctx, '#8a8276', 308, 368, 20, 13, 3);
  ctx.font = 'bold 12px Figtree, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f4efe4';
  ctx.fillText('SINGAPORE', 70, 438);
  ctx.fillText('ALCATRAZ', 382, 444);
}

/** Where the flung driver is along the flight, u in 0..1. */
function flightPoint(u) {
  return { x: 70 + 312 * u, y: 380 - 4 * 300 * u * (1 - u) };
}

/** The cell: brick wall, a barred window, a bunk — and the prisoner. */
function drawCell(ctx, bars) {
  ctx.fillStyle = '#9a948b';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = '#8a8378';
  for (let y = 0, row = 0; y < HEIGHT; y += 22, row++) {
    for (let x = row % 2 ? -30 : 0; x < WIDTH; x += 60) ctx.fillRect(x + 2, y + 2, 56, 18);
  }
  ctx.fillStyle = '#6f6a62';
  ctx.fillRect(0, 520, WIDTH, HEIGHT - 520);
  fillRoundRect(ctx, '#87b3d6', 300, 110, 90, 70, 4);
  ctx.fillStyle = '#3a3734';
  for (let x = 314; x < 390; x += 18) ctx.fillRect(x, 110, 4, 70);
  fillRoundRect(ctx, '#6b5a43', 40, 430, 170, 22, 3);
  fillRoundRect(ctx, '#d8d0c0', 46, 420, 158, 14, 4);
  drawPerson(ctx, WIDTH / 2, 520, PRISONER, { scale: 3 });
  // Bars slam down from the top.
  const drop = smoothstep(bars);
  const top = -HEIGHT + drop * HEIGHT;
  ctx.fillStyle = '#2b2724';
  for (let x = 18; x < WIDTH; x += 46) {
    ctx.fillRect(x, top, 10, HEIGHT);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x + 2, top, 2, HEIGHT);
    ctx.fillStyle = '#2b2724';
  }
  ctx.fillRect(0, top + HEIGHT * 0.3, WIDTH, 12);
  ctx.fillRect(0, top + HEIGHT * 0.78, WIDTH, 12);
}

/**
 * Everything after the boom: the flight, the landing, the cell and WASTED.
 * `prompt` shows the skip hint (off once Run Over is up).
 */
function drawCutscene(ctx, cut, prompt) {
  const t = cut.t;
  if (t < CUT_CELL) {
    drawBayScene(ctx, t);
    const u = Math.min(1, (t - CUT_FLIGHT) / (CUT_LAND - CUT_FLIGHT));
    // Dotted flight path, then the smoke trail and the flailing driver.
    ctx.save();
    ctx.setLineDash([3, 7]);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const p = flightPoint(i / 40);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.restore();
    for (let i = 1; i <= 8; i++) {
      const p = flightPoint(Math.max(0, u - i * 0.025));
      ctx.fillStyle = `rgba(90,86,80,${0.4 * (1 - i / 9)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 14, 4 + i * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    const p = flightPoint(u);
    if (u < 1) {
      ctx.save();
      ctx.translate(p.x, p.y - 14);
      ctx.rotate(t * 9);
      drawPerson(ctx, 0, 14, DRIVER, { scale: 0.75 });
      ctx.restore();
      centreText(ctx, 'AAAAAH!', p.x, p.y - 56, 'bold 16px Figtree, sans-serif', '#fff6d8');
    } else {
      const k = (t - CUT_LAND) / (CUT_CELL - CUT_LAND);
      drawPerson(ctx, p.x, p.y + 6, PRISONER, { scale: 0.5 });
      ctx.fillStyle = `rgba(200,180,140,${0.7 * (1 - k)})`;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc(p.x + Math.cos(i) * 30 * k, p.y + 2 - Math.abs(Math.sin(i)) * 12 * k, 6 + 8 * k, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return;
  }
  drawCell(ctx, (t - CUT_CELL) / (CUT_WASTED - CUT_CELL));
  if (t >= CUT_WASTED) drawWastedCard(ctx, Math.min(1, (t - CUT_WASTED) / 0.35), 'Flung all the way to Alcatraz');
  if (prompt && Math.floor(t * 1.5) % 2 === 0) {
    centreText(ctx, 'Press any key to continue', WIDTH / 2, HEIGHT - 24, '600 13px Figtree, sans-serif', '#f1e9d6');
  }
}

// ---------------------------------------------------------------------------
// Game
// ---------------------------------------------------------------------------

let teardownCurrent = null;

/**
 * Wires one mounted page. `el` holds every element bootstrap() looked up.
 * Returns a teardown that removes window-level listeners and stops the loop,
 * so a later bootstrap (HTMX revisit) never leaves two games running.
 */
function init(canvas, el) {
  if (teardownCurrent) teardownCurrent();

  const ctx = canvas.getContext('2d');
  // Back the canvas at the screen's pixel ratio so the art stays crisp; all
  // drawing still happens in WIDTH x HEIGHT logical units.
  const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
  canvas.width = WIDTH * dpr;
  canvas.height = HEIGHT * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // District tiles are built on first use (and pre-warmed just before each
  // boundary), not all up front — each one is a full-resolution canvas.
  const sceneryCache = [];
  const sceneryFor = (i) => sceneryCache[i] || (sceneryCache[i] = buildScenery(dpr, DISTRICTS[i]));
  // Offscreen darkness layer for night districts (drawNight).
  const nightLayer = document.createElement('canvas');
  nightLayer.width = WIDTH * dpr;
  nightLayer.height = HEIGHT * dpr;
  let effects = [];
  let shake = 0;
  const hasStorage = storageAvailable();
  let progress = loadProgress();
  let run = null;
  let rafHandle = null;
  let lastTime = 0;
  let idleScroll = 0;
  let paused = false; // test hook only (__busRushTestHooks.pause)
  const input = { accelerate: false, brake: false };

  // --- screens ------------------------------------------------------------

  function show(screen) {
    [el.start.root, el.runOver.root, el.shop.root].forEach((s) => s && s.classList.toggle('hidden', s !== screen));
  }

  function renderStart() {
    el.start.tokens.textContent = progress.tokens;
    if (el.start.bus) el.start.bus.textContent = busDef(progress.bus).label;
    el.start.bestScore.textContent = progress.bestScore;
    el.start.bestDistance.textContent = `${progress.bestDistance} m`;
    if (el.start.dailyBest) {
      const today = dailyDate();
      el.start.dailyBest.textContent = progress.daily.date === today ? progress.daily.best : '—';
    }
    if (el.start.storageNotice) el.start.storageNotice.classList.toggle('hidden', hasStorage);
  }

  function renderShop() {
    el.shop.tokens.textContent = progress.tokens;
    Object.entries(el.shop.items).forEach(([key, item]) => {
      const lvl = progress.upgrades[key];
      const cost = upgradeCost(key, lvl);
      item.level.textContent = cost === null ? `${lvl} (max)` : lvl;
      item.cost.textContent = cost === null ? '—' : cost;
      item.buy.disabled = !canBuy(key, lvl, progress.tokens);
      item.buy.textContent = cost === null ? 'Maxed' : 'Buy';
    });
    Object.entries(el.shop.buses).forEach(([key, item]) => {
      const owned = progress.buses.includes(key);
      const selected = progress.bus === key;
      const cost = BUSES[key].cost;
      item.cost.textContent = owned ? 'Owned' : `${cost} tok`;
      item.button.textContent = selected ? 'Driving' : owned ? 'Drive' : 'Buy';
      item.button.disabled = selected || (!owned && progress.tokens < cost);
      item.row.classList.toggle('border-primary', selected);
    });
  }

  function openShop() {
    renderShop();
    show(el.shop.root);
    el.shop.close.focus();
  }

  function closeShop() {
    renderStart();
    show(el.start.root);
    el.start.startButton.focus();
  }

  // --- HUD ----------------------------------------------------------------

  function renderHud() {
    const r = run;
    el.hud.distance.textContent = `${r ? Math.floor(r.distance) : 0} m`;
    el.hud.speed.textContent = `${toKmh(r ? r.speed : 0)} km/h`;
    el.hud.score.textContent = r ? runScore(r.distance, r.fares, r.bonus) : 0;
    const stars = r ? wantedLevel(r.distance, r.fares) : 0;
    el.hud.level.textContent = r ? r.level + 1 : 1;
    el.hud.wanted.textContent = '★'.repeat(stars) + '☆'.repeat(WANTED_MAX - stars);
    el.hud.lives.textContent = r ? r.lives : maxLives(progress.upgrades.bumpers, progress.bus);
    el.hud.fares.textContent = r ? r.fares : 0;
  }

  // --- missions & achievements panel ---------------------------------------

  /** One run's stats, as MISSIONS/ACHIEVEMENTS read them. */
  function runStats(r) {
    if (!r) return {};
    return {
      fares: r.fares,
      wrecked: r.wrecked,
      distance: Math.floor(r.distance),
      level: r.level + 1,
      powerups: r.powerupsTaken,
      tankerEscapes: r.tankerEscapes,
      rammed: r.rammed,
      cleanStretch: Math.max(r.cleanBest, r.distance - r.lastHitAt),
      wanted: r.maxWanted,
      wasted: r.wasted ? 1 : 0,
      trackRides: r.trackRides,
      mixerTopples: r.mixerTopples,
      pancaked: r.pancaked ? 1 : 0,
      storms: r.storms,
    };
  }

  let missionsText = '';
  function renderMissions() {
    const stats = runStats(run);
    const text = JSON.stringify([progress.missions, run ? progress.missions.map((k) => missionProgress(k, stats)) : 0]);
    if (text === missionsText) return; // unchanged: skip the DOM writes
    missionsText = text;
    el.missions.forEach((slot, i) => {
      const key = progress.missions[i];
      slot.root.classList.toggle('hidden', !key);
      if (!key) return;
      const m = MISSIONS[key];
      const done = run && missionDone(key, stats);
      const value = run ? missionProgress(key, stats) : 0;
      slot.label.textContent = m.label;
      slot.reward.textContent = `+${m.reward} tok`;
      slot.progress.textContent = done ? 'Done!' : `${value} / ${m.target}`;
      slot.bar.style.width = `${Math.round((value / m.target) * 100)}%`;
      slot.root.classList.toggle('border-primary', Boolean(done));
    });
  }

  function renderAchievements() {
    let count = 0;
    Object.entries(el.achievements.items).forEach(([key, item]) => {
      const have = progress.achievements.includes(key);
      if (have) count += 1;
      item.mark.textContent = have ? '✓' : '·';
      item.root.classList.toggle('text-ink', have);
      item.root.classList.toggle('text-muted', !have);
    });
    if (el.achievements.count) el.achievements.count.textContent = `${count} / ${Object.keys(ACHIEVEMENTS).length}`;
  }

  // --- run lifecycle ------------------------------------------------------

  /** Mode of the last run started, so "Drive Again" repeats it. */
  let lastDaily = false;

  /**
   * Starts a run. A Daily Challenge (`daily`) drives today's seeded road
   * (every traffic row comes from one seeded stream) in the stock bus with
   * no upgrades, so everyone's run on the day is comparable.
   */
  function startRun(daily = false) {
    lastDaily = daily;
    const date = daily ? dailyDate() : null;
    const bus = daily ? DAILY_BUS : progress.bus;
    const upgrades = daily ? Object.fromEntries(Object.keys(UPGRADES).map((k) => [k, 0])) : progress.upgrades;
    run = {
      status: 'playing',
      daily: date,
      rng: daily ? seededRng(dailySeed(date)) : Math.random,
      bus,
      upgrades,
      distance: 0,
      speed: MIN_SPEED,
      fares: 0,
      lives: maxLives(upgrades.bumpers, bus),
      grace: 0,
      lane: 1,
      busX: laneCenter(1),
      vehicles: [],
      fareItems: [],
      spills: [],
      skid: 0,
      slow: 0,
      sinceRow: 0,
      prevOpen: null,
      scroll: 0,
      police: [],
      wrecks: [],
      wrecked: 0,
      bonus: 0,
      policeTimer: POLICE_FIRST_SECONDS,
      swatTimer: POLICE_SPAWN_SECONDS,
      level: 0,
      fadeFrom: 0,
      fade: 0,
      banner: daily
        ? { title: 'DAILY CHALLENGE', sub: `${date}  ·  stock bus, same road for everyone`, t: BANNER_SECONDS * 1.4 }
        : { title: 'LEVEL 1', sub: LEVELS[0], t: BANNER_SECONDS },
      // Hazards and power-ups.
      zone: null, // construction zone { lane, y, length, seed }
      potholes: [],
      peds: [],
      powerups: [],
      scorches: [],
      shield: 0,
      magnet: 0,
      nitro: 0,
      heli: null,
      crash: null, // fuel tanker crash { v, stun, fuse }
      cut: null, // WASTED cutscene { t, x, kind: 'alcatraz' | 'pancake' }
      wasted: false,
      pancaked: false,
      deathTitle: null,
      ramp: null, // parked ramp truck { lane, side, x, y }
      track: null, // up on the MRT viaduct (startJump)
      tip: null, // the cement mixer being tipped over
      scene: null, // the mixer-on-the-police cutscene
      weather: { rain: 0, splash: 0, flash: 0, nextFlash: 2 },
      puddles: [],
      sand: [],
      trackRides: 0,
      mixerTopples: 0,
      storms: 0,
      // Mission/achievement stats.
      powerupsTaken: 0,
      tankerEscapes: 0,
      rammed: 0,
      lastHitAt: 0,
      cleanBest: 0,
      maxWanted: 1,
      missionsDone: new Set(),
    };
    input.accelerate = false;
    input.brake = false;
    effects = [];
    shake = 0;
    missionsText = '';
    show(null);
    renderHud();
    renderMissions();
    canvas.focus({ preventScroll: true });
  }

  function endRun() {
    if (!run || (run.status !== 'playing' && run.status !== 'cutscene')) return;
    run.status = 'over';
    const distance = Math.min(Math.floor(run.distance), DISTANCE_MAX);
    const score = runScore(run.distance, run.fares, run.bonus);
    const stats = runStats(run);

    // Completed missions pay out and are replaced; achievements pay once.
    const done = progress.missions.filter((k) => missionDone(k, stats));
    const missionTokens = done.reduce((sum, k) => sum + MISSIONS[k].reward, 0);
    progress.lifetime = addLifetime(progress.lifetime, stats);
    const unlocked = newAchievements(progress.achievements, stats, progress.lifetime);
    const achievementTokens = unlocked.reduce((sum, k) => sum + ACHIEVEMENTS[k].reward, 0);
    progress.achievements.push(...unlocked);
    progress.missions = refillMissions(Math.random, progress.missions.filter((k) => !done.includes(k)), progress.upgrades, done);
    const tokens = runTokens(run.distance, run.fares, run.upgrades.fareBox, run.wrecked) + missionTokens + achievementTokens;

    progress.tokens += tokens;
    const newBest = score > progress.bestScore;
    progress.bestScore = Math.max(progress.bestScore, score);
    progress.bestDistance = Math.max(progress.bestDistance, distance);
    if (run.daily) {
      if (progress.daily.date !== run.daily) progress.daily = { date: run.daily, best: 0 };
      progress.daily.best = Math.max(progress.daily.best, score);
    }
    saveProgress(progress);

    const titles = [];
    if (run.daily) titles.push('Daily Challenge ·');
    if (run.wasted || run.pancaked) titles.push('WASTED');
    else if (run.deathTitle) titles.push(run.deathTitle);
    else if (run.killedBy) titles.push(`Flattened by a ${run.killedBy}!`);
    else if (run.busted) titles.push('Busted!');
    if (newBest) titles.push('New best run!');
    el.runOver.title.textContent = titles.length ? titles.join(' ') : 'Run over';
    el.runOver.distance.textContent = `${distance} m`;
    el.runOver.fares.textContent = run.fares;
    el.runOver.wrecked.textContent = run.wrecked;
    el.runOver.level.textContent = `${run.level + 1} · ${LEVELS[run.level]}`;
    el.runOver.score.textContent = score;
    el.runOver.tokens.textContent = `+${tokens}`;
    if (el.runOver.bonus) el.runOver.bonus.textContent = `+${missionTokens + achievementTokens}`;
    if (el.runOver.unlocks) {
      const names = [
        ...done.map((k) => `✓ ${MISSIONS[k].label}`),
        ...unlocked.map((k) => `🏆 ${ACHIEVEMENTS[k].label}`),
      ];
      el.runOver.unlocks.textContent = names.join(' · ');
      el.runOver.unlocks.classList.toggle('hidden', names.length === 0);
    }
    el.runOver.scoreInput.value = score;
    el.runOver.distanceInput.value = distance;
    if (el.runOver.dailyInput) el.runOver.dailyInput.value = run.daily || '';
    el.runOver.submit.disabled = false;
    el.runOver.submit.textContent = 'Submit';
    show(el.runOver.root);
    renderHud();
    missionsText = '';
    renderMissions();
    renderAchievements();
    el.runOver.again.focus();
  }

  function popText(x, y, text, color, life = 0.9) {
    effects.push({ x, y, vx: 0, vy: -60, life, max: life, text, color });
  }

  function hit(r, vehicle) {
    const lives = livesAfterHit(r.lives, vehicle, r.grace);
    if (lives === r.lives) return; // grace absorbed it
    r.lives = lives;
    r.cleanBest = Math.max(r.cleanBest, r.distance - r.lastHitAt);
    r.lastHitAt = r.distance;
    r.speed = minSpeed(r.level);
    shake = vehicle && vehicle.lethal ? 0.6 : 0.35;
    const impactX = (r.busX + (vehicle && vehicle.x ? vehicle.x : r.busX)) / 2;
    burst(effects, impactX, BUS_Y + 4, [(vehicle && vehicle.color) || '#888', '#2e4552', '#f1e9d6', BUS_COLOR], 18, 260, 5);
    r.grace = HIT_GRACE_SECONDS;
    if (r.lives <= 0) {
      r.busted = Boolean(vehicle && vehicle.police);
      r.killedBy = vehicle && vehicle.lethal && !r.busted ? vehicle.label || vehicle.kind : null;
      endRun();
    }
  }

  /**
   * An active shield soaks up a collision with `thing` (anything but a
   * tanker), popping the shield. Returns whether it did. A non-lethal bump
   * during post-hit grace doesn't waste the shield — grace already covers it.
   */
  function absorbWithShield(r, thing, x, y) {
    if (r.shield <= 0 || !shieldAbsorbs(thing) || (r.grace > 0 && !thing.lethal)) return false;
    r.shield = 0;
    r.grace = Math.max(r.grace, 0.6);
    shake = Math.max(shake, 0.25);
    burst(effects, x, y, ['#9fc4ff', '#4f8bff', '#f1e9d6'], 16, 240, 5);
    popText(r.busX, BUS_Y - 14, 'BLOCKED!', '#9fc4ff');
    return true;
  }

  /** Rams a police vehicle per the Ram Plating level. Returns whether it was rammed. */
  function tryRam(r, p) {
    const ram = ramOutcome(r.upgrades.ram, p);
    if (!ram) return false;
    r.rammed += 1;
    wreckPolice(r, p);
    popText(p.x, p.y - 20, 'RAMMED!', '#ffb547');
    if (ram.lifeCost) hit(r, { kind: 'ram', label: 'ram', color: p.color, x: p.x });
    return true;
  }

  function spawnRow(r, overshoot) {
    if (r.noTraffic) return;
    // Now and then a construction zone closes an edge lane, starting just
    // above this row: everything spawned from here on keeps out of its lane
    // until it has scrolled past. (Older rows are below it and pull away.)
    if (!r.zone && !r.ramp && r.distance >= CONSTRUCTION_MIN_DISTANCE && r.rng() < CONSTRUCTION_CHANCE) {
      r.zone = {
        lane: constructionLane(r.rng),
        y: overshoot - 180 - CONSTRUCTION_LENGTH,
        length: CONSTRUCTION_LENGTH,
        seed: Math.floor(r.rng() * 1e6),
      };
    } else if (!r.zone && !r.ramp && r.distance >= RAMP_MIN_DISTANCE && r.rng() < RAMP_CHANCE) {
      // A ramp truck parks half on the shoulder of an edge lane, the same
      // way, closing that lane to traffic the same way a zone does.
      const lane = r.rng() < 0.5 ? 0 : LANES - 1;
      const side = lane === 0 ? -1 : 1;
      r.ramp = { lane, side, x: laneCenter(lane) + side * 14, y: overshoot - 180 - RAMP_TRUCK.length };
    }
    if (stormStarts(r.rng, r.distance, r.weather.rain > 0)) {
      r.weather.rain = STORM_SECONDS;
      r.storms += 1;
      popText(WIDTH / 2, 150, 'STORM! Wet roads ahead', '#9fc4ff', 1.6);
    }
    const closed = [r.zone && r.zone.lane, r.ramp && r.ramp.lane].filter((l) => l !== null && l !== undefined);
    const blocked = pickBlockedLanes(r.rng, r.distance, r.prevOpen, closed);
    const open = openLanes(blocked, closed);
    r.prevOpen = open;
    // A roadblock is a row of oncoming cruisers — same lanes, same speed as
    // traffic, so it keeps the "every row is passable" guarantee.
    const roadblock = r.rng() < roadblockChance(r.distance, wantedLevel(r.distance, r.fares));
    const laneLength = {};
    blocked.forEach((lane) => {
      const kind = roadblock ? POLICE_CAR : pickVehicle(r.rng, r.distance, { construction: Boolean(r.zone) });
      const taxi = kind.kind === 'car' && r.rng() < TAXI_CHANCE;
      const hazmat = !roadblock && isHazmat(r.rng, kind);
      const palette = roadblock ? [POLICE_WHITE] : taxi ? TAXI_COLORS : VEHICLE_COLORS;
      laneLength[lane] = kind.length;
      r.vehicles.push({
        kind: kind.kind,
        lethal: Boolean(kind.lethal),
        fuel: Boolean(kind.fuel),
        drops: spillDrops(r.rng, kind),
        spills: kind.spills,
        label: kind.label || kind.kind,
        bus: Boolean(kind.bus),
        route: ROUTES[Math.floor(r.rng() * ROUTES.length)],
        x: laneCenter(lane),
        y: -kind.length + overshoot,
        width: kind.width,
        length: kind.length,
        color: palette[Math.floor(r.rng() * palette.length)],
        seed: Math.floor(r.rng() * 1e6),
        taxi,
        hazmat,
        wreckColor: VEHICLE_COLORS[Math.floor(r.rng() * VEHICLE_COLORS.length)],
        police: roadblock,
      });
    });
    if (roadblock) return;
    const spacing = rowSpacingPx(r.distance);
    const lanes = [...Array(LANES).keys()].filter((l) => !closed.includes(l));
    const pickLane = () => lanes[Math.floor(r.rng() * lanes.length)];
    // A fare (or now and then a power-up) sits in the clear gap behind this
    // row, in any open-road lane — sometimes one that takes a risky lane
    // change to reach.
    let fareLane = null;
    if (r.rng() < FARE_CHANCE) {
      fareLane = pickLane();
      const y = overshoot + fareOffset(spacing, laneLength[fareLane] || 0, FARE_RADIUS);
      const kind = powerupAt(r.rng, r.distance);
      if (kind) r.powerups.push({ kind, x: laneCenter(fareLane), y, phase: r.rng() * Math.PI * 2 });
      else r.fareItems.push({ x: laneCenter(fareLane), y, phase: r.rng() * Math.PI * 2 });
    }
    // Potholes lie still in the road (like spills), in another lane's gap.
    if (r.distance >= POTHOLE_MIN_DISTANCE && r.rng() < POTHOLE_CHANCE) {
      const lane = pickLane();
      if (lane !== fareLane) {
        const y = overshoot + fareOffset(spacing, laneLength[lane] || 0, POTHOLE_RY);
        r.potholes.push({ x: laneCenter(lane) + (r.rng() - 0.5) * 20, y, angle: (r.rng() - 0.5) * 0.6 });
      }
    }
    // Sentosa's sand drifts and a storm's puddles lie still too, in other lanes.
    if (sandAllowed(r.level) && r.rng() < SAND_CHANCE) {
      const lane = pickLane();
      if (lane !== fareLane) {
        r.sand.push({ x: laneCenter(lane), y: overshoot + fareOffset(spacing, laneLength[lane] || 0, 14), angle: (r.rng() - 0.5) * 0.5 });
      }
    }
    if (r.weather.rain > 0 && r.rng() < PUDDLE_CHANCE) {
      const lane = pickLane();
      if (lane !== fareLane) {
        r.puddles.push({ x: laneCenter(lane), y: overshoot + fareOffset(spacing, laneLength[lane] || 0, PUDDLE_RY), phase: r.rng() });
      }
    }
    // Jaywalkers step off a kerb — never on the expressway.
    if (pedestriansAllowed(r.level) && r.distance >= PEDESTRIAN_MIN_DISTANCE && r.rng() < PEDESTRIAN_CHANCE) {
      const dir = r.rng() < 0.5 ? 1 : -1;
      r.peds.push({
        x: dir > 0 ? SHOULDER - 4 : WIDTH - SHOULDER + 4,
        y: overshoot - 30,
        dir,
        look: Math.floor(r.rng() * PEDESTRIAN_LOOKS.length),
        phase: r.rng() * 6,
        fleeing: false,
        hit: false,
        hitT: 0,
      });
    }
  }

  /** Slides the bus toward its target lane at one lane per laneChangeSeconds. */
  function slideBus(r, dt) {
    const onTrack = r.track && r.track.phase === 'ride';
    const targetX = onTrack ? TRACK_X[r.track.lane] : laneCenter(r.lane);
    const gap = onTrack ? TRACK_GAP : LANE_WIDTH;
    const step = (gap / laneChangeSeconds(r.upgrades.steering, r.bus)) * dt;
    r.busX = Math.abs(targetX - r.busX) <= step ? targetX : r.busX + Math.sign(targetX - r.busX) * step;
  }

  /** The lane the bus is mostly in right now (it may be mid lane change). */
  function laneOf(x) {
    return Math.min(Math.max(Math.round((x - SHOULDER - LANE_WIDTH / 2) / LANE_WIDTH), 0), LANES - 1);
  }

  /** The bus's (slightly forgiving) hitbox. */
  function busBox(r) {
    const dims = busDef(r.bus);
    return { x: r.busX - dims.width / 2 + 5, y: BUS_Y + 6, w: dims.width - 10, h: dims.length - 10 };
  }

  /** Storm clock, splash and lightning. */
  function updateWeather(r, dt) {
    const w = r.weather;
    w.rain = Math.max(0, w.rain - dt);
    w.splash = Math.max(0, w.splash - dt);
    w.flash = Math.max(0, w.flash - dt);
    if (w.rain <= 0) return;
    w.nextFlash -= dt;
    if (w.nextFlash <= 0) {
      w.flash = 0.25;
      w.nextFlash = 3 + Math.random() * 6;
    }
  }

  function update(realDt) {
    const r = run;
    if (r.scene) {
      updateScene(r, realDt);
      return;
    }
    if (r.crash) {
      updateCrash(r, realDt);
      return;
    }
    // A mixer being tipped over plays everything in slow motion.
    const dt = r.tip ? realDt * TIP_SLOWMO : realDt;
    updateWeather(r, dt);
    if (r.track) {
      updateTrack(r, dt);
      return;
    }
    r.slow = Math.max(0, r.slow - dt);
    r.shield = Math.max(0, r.shield - dt);
    r.magnet = Math.max(0, r.magnet - dt);
    r.nitro = Math.max(0, r.nitro - dt);
    r.speed = stepSpeed(r.speed, input, dt, r.upgrades.engine, r.level, {
      accel: busDef(r.bus).accel,
      slowed: r.slow > 0,
      grip: r.weather.rain > 0 ? WET_GRIP : 1,
    });
    r.distance = Math.min(r.distance + r.speed * dt, DISTANCE_MAX);
    r.grace = Math.max(0, r.grace - dt);
    r.scroll += r.speed * dt * PX_PER_METER;
    r.maxWanted = Math.max(r.maxWanted, wantedLevel(r.distance, r.fares));
    updateLevel(r, dt);
    slideBus(r, dt);

    // Traffic, fares and power-ups close in at the bus's speed plus
    // traffic's own; potholes, peds, scorch marks and zones lie still on
    // the road, so they scroll at the bus's speed.
    const closing = (r.speed + TRAFFIC_SPEED) * dt * PX_PER_METER;
    const still = r.speed * dt * PX_PER_METER;
    r.vehicles.forEach((v) => { if (!v.tipping) v.y += closing; });
    updateSpills(r, dt);
    r.fareItems.forEach((f) => { f.y += closing; });
    r.powerups.forEach((p) => { p.y += closing; });
    r.potholes.forEach((h) => { h.y += still; });
    r.scorches.forEach((s) => { s.y += still; });
    if (r.zone) {
      r.zone.y += still;
      if (r.zone.y > HEIGHT) r.zone = null;
    }
    if (r.ramp) {
      r.ramp.y += still;
      if (r.ramp.y > HEIGHT) r.ramp = null;
    }
    r.puddles.forEach((p) => { p.y += still; });
    r.sand.forEach((d) => { d.y += still; });
    r.puddles = r.puddles.filter((p) => p.y - PUDDLE_RY < HEIGHT);
    r.sand = r.sand.filter((d) => d.y - 14 < HEIGHT);
    r.vehicles = r.vehicles.filter((v) => v.y < HEIGHT);
    r.fareItems = r.fareItems.filter((f) => f.y - FARE_RADIUS < HEIGHT);
    r.powerups = r.powerups.filter((p) => p.y - POWERUP_RADIUS < HEIGHT);
    r.potholes = r.potholes.filter((h) => h.y - POTHOLE_RY < HEIGHT);
    r.scorches = r.scorches.filter((s) => s.y - 90 < HEIGHT);
    updatePeds(r, dt, still);

    r.sinceRow += closing;
    const spacing = rowSpacingPx(r.distance);
    if (r.sinceRow >= spacing) {
      r.sinceRow -= spacing;
      spawnRow(r, r.sinceRow);
    }

    // Slightly forgiving hitboxes so a near-miss reads as a near-miss.
    const dims = busDef(r.bus);
    const bus = busBox(r);
    for (const v of r.vehicles) {
      if (v.gone || !rectsOverlap(bus, { x: v.x - v.width / 2 + 3, y: v.y + 3, w: v.width - 6, h: v.length - 6 })) continue;
      if (explosive(v)) {
        startCrash(r, v);
        return;
      }
      if (v.police && tryRam(r, v)) {
        v.gone = true;
      } else if (absorbWithShield(r, v, v.x, v.y + v.length)) {
        v.gone = true;
        if (v.police) wreckPolice(r, v);
      } else {
        hit(r, v);
      }
      if (r.status !== 'playing') return;
    }
    r.vehicles = r.vehicles.filter((v) => !v.gone);
    updatePolice(r, dt, bus);
    if (r.status !== 'playing') return;
    updateHelicopter(r, dt);

    // Drive up a ramp truck's ramps: airborne, onto the MRT track.
    if (r.ramp && !r.tip && rectsOverlap(bus, rampBox(r.ramp))) {
      startJump(r);
      return;
    }

    // Puddles splash the windscreen; Sentosa's sand bogs the bus down.
    const puddle = r.puddles.find((p) => !p.hit && rectsOverlap(bus, puddleBox(p)));
    if (puddle) {
      puddle.hit = true;
      r.weather.splash = SPLASH_SECONDS;
      burst(effects, puddle.x, puddle.y, ['#9fc4e0', '#d6e6f2', '#6d7f8c'], 16, 240, 4);
      popText(r.busX, BUS_Y - 14, 'SPLASH!', '#9fc4ff');
    }
    const drift = r.sand.find((d) => !d.hit && rectsOverlap(bus, sandBox(d)));
    if (drift) {
      drift.hit = true;
      r.slow = Math.max(r.slow, SAND_SLOW_SECONDS);
      r.slowKind = 'sand';
      burst(effects, drift.x, drift.y, ['#e3cf9c', '#c9b07a', '#f1e4c2'], 14, 200, 4);
      popText(r.busX, BUS_Y - 14, 'SAND!', '#e3cf9c');
    }

    // Construction zone barriers: a life, and shoved a lane inward.
    if (r.zone && r.skid <= 0 && rectsOverlap(bus, zoneBox(r.zone))) {
      burst(effects, r.busX, BUS_Y, ['#e8763a', '#f4efe4', '#c9a96e'], 14, 220, 5);
      if (!absorbWithShield(r, BARRIER, r.busX, BUS_Y)) hit(r, { ...BARRIER, color: '#e8763a', x: r.busX });
      if (r.status !== 'playing') return;
      r.lane = zonePushLane(r.zone.lane);
      r.skid = SKID_SECONDS;
    }

    // Spike strips (from the helicopter): a life lost, unless shielded.
    const spikes = r.spills.find((b) => b.kind === 'spikes' && rectsOverlap(bus, spikeBox(b)));
    if (spikes) {
      r.spills = r.spills.filter((b) => b !== spikes);
      burst(effects, spikes.x, spikes.y, ['#d3cdc2', '#3a3734', '#1f1d1b'], 12, 220, 4);
      popText(r.busX, BUS_Y - 14, 'POP!', '#ff8a6a');
      if (!absorbWithShield(r, SPIKES, spikes.x, spikes.y)) hit(r, { ...SPIKES, color: '#3a3734', x: spikes.x });
      if (r.status !== 'playing') return;
    }

    // Potholes: no life lost, but the jolt knocks speed to the floor.
    const hole = r.potholes.find((h) => !h.hit && rectsOverlap(bus, potholeBox(h)));
    if (hole) {
      hole.hit = true;
      r.speed = minSpeed(r.level);
      shake = Math.max(shake, 0.2);
      burst(effects, hole.x, hole.y, ['#4a4643', '#8a8276', '#25221f'], 10, 160, 4);
      popText(r.busX, BUS_Y - 14, 'BUMP!', '#e9e3d6');
    }

    // Jaywalkers: hitting one costs a life.
    const ped = r.peds.find((p) => !p.hit && rectsOverlap(bus, pedBox(p)));
    if (ped) {
      ped.hit = true;
      popText(ped.x, ped.y - 40, 'OOF!', '#ffb547');
      if (!absorbWithShield(r, PEDESTRIAN, ped.x, ped.y)) hit(r, { ...PEDESTRIAN, color: '#c4532d', x: ped.x });
      if (r.status !== 'playing') return;
    }

    // Run over garbage: top speed halved for a while (refreshed by more).
    const trash = r.spills.find((b) => b.kind === 'garbage' && rectsOverlap(bus, bananaBox(b)));
    if (trash) {
      r.spills = r.spills.filter((b) => b !== trash);
      r.slow = GARBAGE_SLOW_SECONDS;
      r.slowKind = 'garbage';
      burst(effects, trash.x, trash.y, ['#3b3f36', '#6b7a4f', '#c9b48a', '#8a8276'], 12, 200, 5);
      popText(r.busX, BUS_Y - 14, 'SLOWED!', '#b9d48a');
    }

    // Run over a banana: skid one lane over, steering locked meanwhile.
    if (r.skid <= 0) {
      const slipped = r.spills.find((b) => b.kind === 'banana' && rectsOverlap(bus, bananaBox(b)));
      if (slipped) {
        r.spills = r.spills.filter((b) => b !== slipped);
        r.skid = SKID_SECONDS;
        r.lane = skidLane(r.lane, Math.random);
        burst(effects, slipped.x, slipped.y, ['#f2d34c', '#b8860b', '#fff6c2'], 10, 200, 4);
        popText(r.busX, BUS_Y - 14, 'SKID!', '#f2d34c', 0.8);
      }
    }

    // A magnet pulls nearby fares in.
    if (r.magnet > 0) {
      const cy = BUS_Y + dims.length / 2;
      r.fareItems.forEach((f) => {
        const dx = r.busX - f.x;
        const dy = cy - f.y;
        const d = Math.hypot(dx, dy);
        if (d < MAGNET_RADIUS && d > 1) {
          const pull = Math.min(d, 520 * dt);
          f.x += (dx / d) * pull;
          f.y += (dy / d) * pull;
        }
      });
    }

    r.fareItems = r.fareItems.filter((f) => {
      const caught = rectsOverlap(bus, { x: f.x - FARE_RADIUS, y: f.y - FARE_RADIUS, w: FARE_RADIUS * 2, h: FARE_RADIUS * 2 });
      if (caught) {
        r.fares += 1;
        burst(effects, f.x, f.y, ['#ffe08a', '#f2c94c', '#fff6d8'], 10, 180, 4);
        effects.push({ x: f.x, y: f.y - 14, vx: 0, vy: -70, life: 0.7, max: 0.7, text: '+$', color: '#ffe08a' });
      }
      return !caught;
    });

    r.powerups = r.powerups.filter((p) => {
      const caught = rectsOverlap(bus, { x: p.x - POWERUP_RADIUS, y: p.y - POWERUP_RADIUS, w: POWERUP_RADIUS * 2, h: POWERUP_RADIUS * 2 });
      if (caught) applyPowerup(r, p);
      return !caught;
    });

    if (r.tip) updateTip(r, dt);
    if (r.drift) {
      r.drift.t += dt;
      if (r.drift.t > DRIFT_SECONDS) r.drift = null;
    }
    cheerMissions(r);
  }

  /** Missions completed mid-run get a cheer (they pay out at the end). */
  function cheerMissions(r) {
    progress.missions.forEach((key) => {
      if (r.missionsDone.has(key) || !missionDone(key, runStats(r))) return;
      r.missionsDone.add(key);
      popText(WIDTH / 2, 140, `MISSION ✓ +${MISSIONS[key].reward}`, '#b9d48a', 1.6);
    });
  }

  // --- the MRT track ------------------------------------------------------

  const JUMP_SECONDS = 1;
  const DRIFT_SECONDS = 0.5; // game time the bus fishtails for
  const DROP_SECONDS = 0.9;

  /** The ramp truck's hitbox: its deck and ramps. */
  function rampBox(ramp) {
    return { x: ramp.x - RAMP_TRUCK.width / 2 + 6, y: ramp.y + 6, w: RAMP_TRUCK.width - 12, h: RAMP_TRUCK.length - 10 };
  }

  /** Up the ramp: the police can't follow, and the bus flies onto the nearer track. */
  function startJump(r) {
    const lost = r.police.length;
    r.track = {
      phase: 'jump',
      t: 0,
      fromX: r.busX,
      lane: r.ramp.side < 0 ? 0 : 1,
      left: TRACK_SECONDS,
      train: null,
      warn: 0,
      pending: 0,
      gap: trainGapSeconds(Math.random) + 1,
      fares: [],
      fareTimer: 1,
    };
    r.ramp = null;
    r.trackRides += 1;
    r.police = [];
    r.tip = null;
    shake = Math.max(shake, 0.3);
    popText(r.busX, BUS_Y - 20, lost ? 'AIRBORNE! LOST THEM!' : 'AIRBORNE!', '#ffb547', 1.2);
  }

  /** Back down to the road once the time's up: a fresh, empty stretch. */
  function landFromTrack(r) {
    const lane = r.track.landLane;
    r.track = null;
    r.lane = lane;
    r.busX = laneCenter(lane);
    r.vehicles = [];
    r.fareItems = [];
    r.powerups = [];
    r.spills = [];
    r.potholes = [];
    r.peds = [];
    r.puddles = [];
    r.sand = [];
    r.zone = null;
    r.ramp = null;
    r.police = [];
    r.sinceRow = 0;
    r.prevOpen = null;
    r.policeTimer = POLICE_FIRST_SECONDS;
    r.grace = HIT_GRACE_SECONDS * 1.5;
    shake = Math.max(shake, 0.4);
    burst(effects, r.busX, BUS_Y + 40, ['#8a8276', '#c9c3b7', '#5a5550'], 18, 220, 5);
    popText(r.busX, BUS_Y - 20, 'THUD! Back on the road', '#f1e9d6', 1.2);
  }

  /**
   * Riding the viaduct: speed and distance carry on, one train at a time
   * runs down one of the two tracks after a warning, fares lie between the
   * rails, and after TRACK_SECONDS the bus drops back down to the road.
   */
  function updateTrack(r, dt) {
    const tr = r.track;
    r.speed = stepSpeed(r.speed, input, dt, r.upgrades.engine, r.level, {
      accel: busDef(r.bus).accel,
      grip: r.weather.rain > 0 ? WET_GRIP : 1,
    });
    r.distance = Math.min(r.distance + r.speed * dt, DISTANCE_MAX);
    r.scroll += r.speed * dt * PX_PER_METER;
    r.grace = Math.max(0, r.grace - dt);
    r.maxWanted = Math.max(r.maxWanted, wantedLevel(r.distance, r.fares));
    updateLevel(r, dt);
    tr.t += dt;
    if (tr.phase === 'jump') {
      const k = Math.min(1, tr.t / JUMP_SECONDS);
      r.busX = tr.fromX + (TRACK_X[tr.lane] - tr.fromX) * smoothstep(k);
      if (k >= 1) {
        tr.phase = 'ride';
        tr.t = 0;
        // The road below carries on without us.
        r.vehicles = [];
        r.fareItems = [];
        r.powerups = [];
        r.spills = [];
        r.potholes = [];
        r.peds = [];
        r.puddles = [];
        r.sand = [];
        r.zone = null;
        popText(WIDTH / 2, 150, `ON THE MRT TRACK! ${TRACK_SECONDS} s`, '#ffb547', 1.6);
      }
      return;
    }
    if (tr.phase === 'drop') {
      const k = Math.min(1, tr.t / DROP_SECONDS);
      r.busX = tr.fromX + (laneCenter(tr.landLane) - tr.fromX) * smoothstep(k);
      if (k >= 1) landFromTrack(r);
      return;
    }

    tr.left = Math.max(0, tr.left - dt);
    slideBus(r, dt);
    const still = r.speed * dt * PX_PER_METER;
    const bus = busBox(r);

    if (tr.train) {
      const train = tr.train;
      train.y += trainClosingSpeed(train.track, r.speed) * PX_PER_METER * dt;
      const box = { x: TRACK_X[train.track] - TRAIN_WIDTH / 2 + 4, y: train.y + 4, w: TRAIN_WIDTH - 8, h: TRAIN_LENGTH - 8 };
      if (rectsOverlap(bus, box)) {
        r.lives = 0;
        r.deathTitle = 'Hit by an MRT train!';
        shake = 1;
        burst(effects, r.busX, BUS_Y + 20, ['#dcdedd', '#c9402c', BUS_COLOR, '#2e4552'], 30, 360, 6);
        renderHud();
        endRun();
        return;
      }
      if (train.y > HEIGHT + 20 || train.y + TRAIN_LENGTH < -20) {
        tr.train = null;
        tr.gap = trainGapSeconds(Math.random);
      }
    } else if (tr.warn > 0) {
      tr.warn -= dt;
      if (tr.warn <= 0) {
        tr.train = { track: tr.pending, y: tr.pending === 1 ? -TRAIN_LENGTH : HEIGHT + 10 };
      }
    } else if (tr.left > 3) {
      tr.gap -= dt;
      if (tr.gap <= 0) {
        tr.pending = nextTrainTrack(Math.random);
        tr.warn = TRAIN_WARNING_SECONDS;
      }
    }

    // Fares lie between the rails, now and then.
    tr.fareTimer -= dt;
    if (tr.fareTimer <= 0) {
      tr.fareTimer = 0.8 + Math.random() * 0.9;
      tr.fares.push({ x: TRACK_X[Math.random() < 0.5 ? 0 : 1], y: -20, phase: Math.random() * 6 });
    }
    tr.fares.forEach((f) => { f.y += still; });
    tr.fares = tr.fares.filter((f) => {
      const caught = rectsOverlap(bus, { x: f.x - FARE_RADIUS, y: f.y - FARE_RADIUS, w: FARE_RADIUS * 2, h: FARE_RADIUS * 2 });
      if (caught) {
        r.fares += 1;
        burst(effects, f.x, f.y, ['#ffe08a', '#f2c94c', '#fff6d8'], 10, 180, 4);
        popText(f.x, f.y - 14, '+$', '#ffe08a', 0.7);
      }
      return !caught && f.y - FARE_RADIUS < HEIGHT;
    });

    if (tr.left <= 0 && !tr.train && tr.warn <= 0) {
      tr.phase = 'drop';
      tr.t = 0;
      tr.fromX = r.busX;
      tr.landLane = tr.lane === 0 ? 1 : 2;
      popText(WIDTH / 2, 150, 'END OF THE LINE — DROPPING DOWN!', '#ffb547', 1.4);
    }
    cheerMissions(r);
  }

  // --- the cement mixer ---------------------------------------------------

  /** Mixers worth showing a drift ring round: on the road, upright, not too far off. */
  function nearbyMixers(r) {
    if (r.track || r.tip || r.scene || r.crash) return [];
    const cy = BUS_Y + busDef(r.bus).length / 2;
    return r.vehicles.filter((v) => v.kind === 'mixer' && !v.tipping && !v.fallen && !v.gone
      && Math.hypot(v.x - r.busX, v.y + v.length / 2 - cy) < DRIFT_RADIUS * 1.6);
  }

  /** A mixer the bus is close enough to drift into right now, if any. */
  function driftTarget(r) {
    const lane = laneOf(r.busX);
    const cy = BUS_Y + busDef(r.bus).length / 2;
    return nearbyMixers(r).find((v) => canDrift(lane, r.busX, cy, laneOf(v.x), v.x, v.y + v.length / 2)) || null;
  }

  /**
   * Drift into the mixer: the bus fishtails toward it, the mixer stands on
   * its brakes (screeching, MIXER_BRAKE_SECONDS) and then tips over, in
   * slow motion, into the bus's lane. `dir`, when given, is the way the
   * player dragged — it has to be toward the mixer.
   */
  function drift(dir) {
    const r = run;
    if (!r || r.status !== 'playing') return false;
    const v = driftTarget(r);
    if (!v) return false;
    const toward = Math.sign(v.x - r.busX);
    if (dir && dir !== toward) return false;
    const lane = laneOf(r.busX);
    v.tipping = true;
    v.tip = 0;
    v.brake = MIXER_BRAKE_SECONDS;
    v.mixerLane = laneOf(v.x);
    v.fallLane = lane;
    v.fallDir = Math.sign(lane - v.mixerLane);
    r.tip = v;
    r.drift = { t: 0, dir: toward };
    shake = Math.max(shake, 0.3);
    burst(effects, r.busX + toward * 24, BUS_Y + 60, ['#e1dcd4', '#c9c3b7', '#2b2724'], 16, 200, 6);
    popText(r.busX, BUS_Y - 18, 'DRIFT!', '#ffb547', 1.2);
    popText(v.x, v.y + v.length + 12, 'SCREEEECH!', '#f1e9d6', 1.4);
    return true;
  }

  /**
   * The mixer brakes (MIXER_BRAKE_SECONDS, laying rubber), then tips over
   * TIP_SECONDS (game time) and lands in the lane it fell toward.
   */
  function updateTip(r, dt) {
    const v = r.tip;
    if (v.gone) {
      r.tip = null;
      return;
    }
    if (v.brake > 0) {
      v.brake = Math.max(0, v.brake - dt);
      if (v.brake === 0) popText(v.x, v.y + v.length / 2, 'TIMBER!', '#ffb547', 1.6);
      return;
    }
    v.tip = Math.min(1, v.tip + dt / TIP_SECONDS);
    if (v.tip < 1) return;
    r.tip = null;
    v.tipping = false;
    v.fallen = true;
    v.sprawl = v.width + LANE_WIDTH * 0.85;
    shake = 0.8;
    const zone = { x: SHOULDER + LANE_WIDTH * v.fallLane + 6, y: v.y + 4, w: LANE_WIDTH - 12, h: v.length - 8 };
    burst(effects, laneCenter(v.fallLane), v.y + v.length / 2, ['#9a948b', '#c9c3b7', '#e8833a'], 30, 300, 6);
    if (rectsOverlap(busBox(r), zone)) {
      startPancake(r, v);
      return;
    }
    // Anything else under it is crushed.
    r.vehicles = r.vehicles.filter((o) => {
      if (o === v || !rectsOverlap(zone, { x: o.x - o.width / 2, y: o.y, w: o.width, h: o.length })) return true;
      if (o.police) wreckPolice(r, o);
      else burst(effects, o.x, o.y + o.length / 2, [o.color || '#888', '#5a5650'], 10, 200, 5);
      return false;
    });
    startMixerScene(r, v);
  }

  const SCENE_BEAT = 0.45; // the mixer lies there a moment first
  const SCENE_SLIDE = 2.6; // ...then slides back into the police
  const SCENE_PAN = 190; // px the camera pans down the road to watch
  const SCENE_END = 5.4; // after the laugh

  /**
   * The bus got clear: cutscene. The fallen mixer slides back down the
   * road into the chasing police — crushing the ones in its path while the
   * rest screech to a stop — then a shot of the driver in stitches.
   */
  function startMixerScene(r, v) {
    // There's always someone to squash, and everyone chasing is pulled into
    // shot just behind the bus.
    // One in the mixer's path to squash, one beside it to screech to a stop.
    const clear = [...Array(LANES).keys()].filter((l) => l !== v.mixerLane && l !== v.fallLane)
      .sort((a, b) => Math.abs(a - v.mixerLane) - Math.abs(b - v.mixerLane));
    const lanes = [v.mixerLane, clear[0]];
    for (let i = r.police.length; i < 2; i++) spawnPolice(r, lanes[i % 2], 0);
    const busBottom = BUS_Y + busDef(r.bus).length;
    r.police.forEach((p, i) => {
      p.retarget = 99;
      p.y = Math.min(Math.max(p.y, busBottom + 14 + (i % 2) * 40), HEIGHT - p.length - 6);
    });
    r.scene = { t: 0, v, marks: [], screeched: false };
    r.tip = null;
  }

  function updateScene(r, dt) {
    const sc = r.scene;
    sc.t += dt;
    if (sc.t < SCENE_SLIDE) {
      const v = sc.v;
      if (sc.t > SCENE_BEAT) v.y += 260 * dt;
      const left = v.fallDir > 0 ? v.x - v.width / 2 : v.x + v.width / 2 - v.sprawl;
      const band = { x: left, y: v.y, w: v.sprawl, h: v.length };
      r.police = r.police.filter((p) => {
        const box = { x: p.x - p.width / 2, y: p.y, w: p.width, h: p.length };
        if (rectsOverlap(band, box)) {
          wreckPolice(r, p);
          popText(p.x, p.y, 'CRUNCH!', '#ffb547', 1);
          return false;
        }
        // The rest stand on the brakes, laying rubber.
        if (sc.t > SCENE_BEAT) {
          const brake = Math.max(0, 1 - (sc.t - SCENE_BEAT) / 1.2);
          p.y += 50 * brake * dt;
          if (brake > 0) sc.marks.push({ x: p.x, y: p.y + p.length - 4, len: 6 });
        }
        return true;
      });
      if (!sc.screeched && sc.t > SCENE_BEAT + 0.2) {
        sc.screeched = true;
        popText(WIDTH / 2, BUS_Y + 150, 'SCREEEECH!', '#f1e9d6', 1.6);
      }
      return;
    }
    if (sc.t >= SCENE_END) endScene(r);
  }

  function endScene(r) {
    const sc = r.scene;
    sc.v.gone = true;
    r.vehicles = r.vehicles.filter((o) => !o.gone);
    r.police = [];
    r.policeTimer = POLICE_SPAWN_SECONDS * 2;
    r.swatTimer = POLICE_SPAWN_SECONDS * 2;
    r.mixerTopples += 1;
    r.bonus += MIXER_TOPPLE_POINTS;
    r.grace = HIT_GRACE_SECONDS;
    r.scene = null;
    popText(WIDTH / 2, 150, `POUR DECISION! +${MIXER_TOPPLE_POINTS}`, '#ffe08a', 1.6);
  }

  /** Any key or tap skips the slide to the laugh, then the laugh. */
  function skipScene() {
    const sc = run && run.scene;
    if (!sc) return;
    if (sc.t < SCENE_SLIDE) {
      // Settle the slide at once: everyone in its path is crushed.
      sc.v.y = HEIGHT;
      wreckAllPolice(run);
      sc.t = SCENE_SLIDE;
    } else {
      endScene(run);
    }
  }

  function wreckAllPolice(r) {
    r.police.forEach((p) => wreckPolice(r, p));
    r.police = [];
  }

  /** Too slow: the mixer lands on the bus. */
  function startPancake(r, v) {
    r.vehicles = r.vehicles.filter((o) => o !== v);
    r.status = 'cutscene';
    r.pancaked = true;
    r.lives = 0;
    r.tip = null;
    r.cut = { t: 0, x: r.busX, kind: 'pancake', v };
    input.accelerate = false;
    input.brake = false;
    renderHud();
  }

  function applyPowerup(r, p) {
    r.powerupsTaken += 1;
    burst(effects, p.x, p.y, [POWERUP_COLORS[p.kind], '#fbf6ec', '#ffe08a'], 14, 220, 5);
    popText(p.x, p.y - 18, `${POWERUPS[p.kind].label.toUpperCase()}!`, POWERUP_COLORS[p.kind]);
    if (p.kind === 'nitro') {
      r.speed = maxSpeed(r.upgrades.engine, r.level);
      r.slow = 0;
      r.nitro = 1.4;
      r.police.forEach((c) => { c.y += NITRO_PUSH_PX; });
    } else if (p.kind === 'shield') {
      r.shield = POWERUPS.shield.seconds;
    } else if (p.kind === 'magnet') {
      r.magnet = POWERUPS.magnet.seconds;
    } else if (p.kind === 'emp') {
      r.police.forEach((c) => wreckPolice(r, c));
      r.police = [];
      if (r.heli) r.heli.grounded = POWERUPS.emp.seconds;
      r.empFlash = 0.5;
    }
  }

  /**
   * Jaywalkers walk across at PEDESTRIAN_SPEED; one about to be run down by
   * oncoming traffic turns and sprints back the way it came. A hit one
   * tumbles away and fades.
   */
  function updatePeds(r, dt, still) {
    for (const p of r.peds) {
      p.y += still;
      if (p.hit) {
        p.hitT += dt;
        p.x += p.dir * 160 * dt;
        continue;
      }
      if (!p.fleeing && r.vehicles.some((v) => rectsOverlap(pedBox(p), { x: v.x - v.width / 2, y: v.y, w: v.width, h: v.length + 40 }))) {
        p.fleeing = true;
        p.dir = -p.dir;
      }
      p.x += p.dir * PEDESTRIAN_SPEED * (p.fleeing ? 3 : 1) * dt;
    }
    r.peds = r.peds.filter((p) => p.y - 40 < HEIGHT && p.x > -20 && p.x < WIDTH + 20 && !(p.hit && p.hitT > 0.9));
  }

  // --- fuel tanker crash --------------------------------------------------

  function startCrash(r, v) {
    const { stun, fuse } = crashTimings(v);
    v.crashAngle = (v.x <= r.busX ? -1 : 1) * 0.35;
    r.crash = { v, stun, fuse, stunMax: stun };
    r.tip = null;
    r.speed = 0;
    r.lane = Math.round((r.busX - SHOULDER - LANE_WIDTH / 2) / LANE_WIDTH);
    input.accelerate = false;
    input.brake = false;
    shake = 0.6;
    burst(effects, (r.busX + v.x) / 2, BUS_Y, ['#c3c9cd', '#2e4552', '#f1e9d6', BUS_COLOR], 22, 260, 5);
    popText(r.busX, BUS_Y - 20, 'CRASH!', '#ffb547');
  }

  /**
   * A tanker or hazmat-truck crash freezes the road: stunned, then a fuse
   * to steer out of the blast radius before it blows (crashTimings).
   */
  function updateCrash(r, dt) {
    const c = r.crash;
    if (c.stun > 0) {
      c.stun = Math.max(0, c.stun - dt);
      if (c.stun === 0) shake = Math.max(shake, 0.2);
      return;
    }
    slideBus(r, dt);
    c.fuse -= dt;
    if (c.fuse <= 0) explodeTanker(r);
  }

  function explodeTanker(r) {
    const { v } = r.crash;
    const cx = v.x;
    const cy = v.y + v.length / 2;
    r.crash = null;
    shake = 1;
    burst(effects, cx, cy, ['#fff3c4', '#ffb547', '#e8763a', '#c9402c', '#5a5650'], 60, 520, 9);
    r.blast = { x: cx, y: cy, t: 0 };
    r.scorches.push({ x: cx, y: cy });
    // The blast takes out whatever else is close by.
    const caught = (o) => inBlast(o.x - cx, o.y + o.length / 2 - cy);
    r.vehicles = r.vehicles.filter((o) => {
      if (o === v) return false;
      if (!caught(o)) return true;
      if (o.police) wreckPolice(r, o);
      else burst(effects, o.x, o.y + o.length / 2, [o.color || '#888', '#5a5650'], 10, 200, 5);
      return false;
    });
    r.police = r.police.filter((p) => {
      if (!caught(p)) return true;
      wreckPolice(r, p);
      return false;
    });
    if (inBlast(r.busX - cx, BUS_Y + busDef(r.bus).length / 2 - cy)) {
      startCutscene(r);
      return;
    }
    r.tankerEscapes += 1;
    r.bonus += TANKER_ESCAPE_POINTS;
    r.speed = minSpeed(r.level);
    r.grace = HIT_GRACE_SECONDS;
    popText(WIDTH / 2, 150, `ESCAPED! +${TANKER_ESCAPE_POINTS}`, '#ffe08a', 1.6);
  }

  function startCutscene(r) {
    r.status = 'cutscene';
    r.wasted = true;
    r.lives = 0;
    r.cut = { t: 0, x: r.busX, kind: 'alcatraz' };
    input.accelerate = false;
    input.brake = false;
    renderHud();
  }

  /** Any key or tap during the cutscene skips ahead to WASTED, then on to Run Over. */
  function skipCutscene() {
    if (!run || run.status !== 'cutscene') return;
    const times = CUTS[run.cut.kind];
    if (run.cut.t < times.wasted) run.cut.t = times.wasted;
    else endRun();
  }

  /** Crossing into a new district: lives refilled, checkpoint bonus, banner, scenery crossfade. */
  function updateLevel(r, dt) {
    r.fade = Math.max(0, r.fade - dt / FADE_SECONDS);
    if (r.banner) {
      r.banner.t -= dt;
      if (r.banner.t <= 0) r.banner = null;
    }
    const lvl = levelAt(r.distance);
    if (lvl !== r.level) {
      const points = checkpointPoints(lvl);
      r.bonus += points;
      const refilled = r.lives < maxLives(r.upgrades.bumpers, r.bus);
      r.lives = maxLives(r.upgrades.bumpers, r.bus);
      // A kick of speed on entry; the higher floor/ceiling keep it after.
      r.speed = Math.min(r.speed + LEVEL_SPEED_STEP * 2, maxSpeed(r.upgrades.engine, lvl));
      r.fadeFrom = r.level;
      r.fade = 1;
      r.level = lvl;
      const sub = `${LEVELS[lvl]}  ·  +${points}${refilled ? '  ·  lives refilled' : ''}`;
      r.banner = { title: `LEVEL ${lvl + 1}`, sub, t: BANNER_SECONDS };
    } else if (lvl + 1 < LEVELS.length && r.distance % LEVEL_DISTANCE > LEVEL_DISTANCE - 150) {
      sceneryFor(lvl + 1);
    }
  }

  /**
   * Leaky trucks drop their spill (bananas, or garbage from a garbage
   * truck) from their rear each time they pass one of their `drops`
   * heights. A dropped spill lies still on the road — it scrolls at the
   * bus's speed, slower than traffic, so it falls in behind its truck —
   * after a brief slide and spin as it slips out.
   */
  function updateSpills(r, dt) {
    r.skid = Math.max(0, r.skid - dt);
    for (const v of r.vehicles) {
      while (v.drops && v.drops.length && v.y >= v.drops[0]) {
        v.drops.shift();
        r.spills.push({
          kind: v.spills,
          x: v.x + (Math.random() - 0.5) * 14,
          y: v.y - 4,
          vx: (Math.random() - 0.5) * 90,
          angle: Math.random() * Math.PI * 2,
          spin: (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 6),
        });
      }
    }
    const scroll = r.speed * PX_PER_METER * dt;
    const settle = Math.max(0, 1 - 4 * dt);
    for (const b of r.spills) {
      b.y += scroll;
      b.x += b.vx * dt;
      b.angle += b.spin * dt;
      b.vx *= settle;
      b.spin *= settle;
    }
    r.spills = r.spills.filter((b) => b.y < HEIGHT + 20);
  }

  function spawnPolice(r, lane, y, kind = POLICE_CAR) {
    r.police.push({
      ...kind,
      color: kind.swat ? '#2a3446' : POLICE_WHITE,
      lane,
      x: laneCenter(lane),
      y,
      retarget: 0,
    });
  }

  function wreckPolice(r, p) {
    const wanted = wantedLevel(r.distance, r.fares);
    const points = policeWreckPoints(wanted) * (p.swat ? 2 : 1);
    r.wrecked += 1;
    r.bonus += points;
    r.wrecks.push({ x: p.x, y: p.y, width: p.width, length: p.length, angle: (Math.random() - 0.5) * 1.2, swat: p.swat });
    burst(effects, p.x, p.y + p.length / 2, ['#f1ede4', '#24345a', '#ff4b3a', '#ffb547'], 16, 220, 5);
    effects.push({ x: p.x, y: p.y, vx: 0, vy: -60, life: 0.9, max: 0.9, text: `+${points}`, color: '#9fc4ff' });
    shake = Math.max(shake, 0.15);
  }

  /**
   * Pursuers close in from behind whenever they're faster than the bus,
   * re-aim at its lane every policeReactionSeconds (the juke window), end
   * the run on contact (Busted) unless Ram Plating or a shield says
   * otherwise, and wreck themselves on any oncoming vehicle — except the
   * armoured SWAT van, which shoves ordinary traffic aside and only wrecks
   * on a lethal truck. Construction barriers wreck any of them.
   */
  function updatePolice(r, dt, bus) {
    const wanted = wantedLevel(r.distance, r.fares);
    const cruisers = r.police.filter((p) => !p.swat).length;
    r.policeTimer -= dt;
    if (!r.noPolice && r.policeTimer <= 0 && cruisers < maxPolice(wanted)) {
      r.policeTimer = POLICE_SPAWN_SECONDS;
      const lane = Math.min(Math.max(r.lane + Math.floor(Math.random() * 3) - 1, 0), LANES - 1);
      spawnPolice(r, lane, HEIGHT + 20);
    }
    r.swatTimer -= dt;
    if (!r.noPolice && r.swatTimer <= 0 && r.police.filter((p) => p.swat).length < maxSwat(wanted)) {
      r.swatTimer = POLICE_SPAWN_SECONDS * 2;
      spawnPolice(r, r.lane, HEIGHT + 40, SWAT_VAN);
      popText(WIDTH / 2, HEIGHT - 60, 'SWAT INBOUND!', '#9fc4ff', 1.4);
    }

    const approach = (policeSpeed(wanted, r.level) - r.speed) * PX_PER_METER;
    const laneStep = (LANE_WIDTH / POLICE_LANE_SECONDS) * dt;
    for (const p of r.police) {
      p.y -= approach * dt;
      p.y = Math.max(p.y, BUS_Y - p.length / 2); // alongside at most, never ahead
      p.skid = Math.max(0, (p.skid || 0) - dt);
      p.retarget -= dt;
      if (p.retarget <= 0 && p.skid === 0) {
        p.retarget = policeReactionSeconds(wanted);
        p.lane += Math.sign(r.lane - p.lane);
      }
      const tx = laneCenter(p.lane);
      p.x = Math.abs(tx - p.x) <= laneStep ? tx : p.x + Math.sign(tx - p.x) * laneStep;
    }

    // Keep cruisers sharing a lane from stacking on top of each other.
    r.police.sort((a, b) => a.y - b.y);
    for (let i = 1; i < r.police.length; i++) {
      for (let j = 0; j < i; j++) {
        const a = r.police[j];
        const b = r.police[i];
        if (Math.abs(a.x - b.x) < a.width && b.y < a.y + a.length + 6) b.y = a.y + a.length + 6;
      }
    }

    const box = (v) => ({ x: v.x - v.width / 2 + 3, y: v.y + 3, w: v.width - 6, h: v.length - 6 });

    // Cruisers slip on bananas too: one lane over, no re-aiming meanwhile —
    // which can throw them into traffic (a wreck) or into the bus (Busted).
    for (const p of r.police) {
      if (p.skid > 0) continue;
      const slipped = r.spills.find((b) => b.kind === 'banana' && rectsOverlap(box(p), bananaBox(b)));
      if (!slipped) continue;
      r.spills = r.spills.filter((b) => b !== slipped);
      p.skid = SKID_SECONDS;
      p.lane = skidLane(p.lane, Math.random);
      burst(effects, slipped.x, slipped.y, ['#f2d34c', '#b8860b', '#fff6c2'], 8, 180, 4);
      effects.push({ x: p.x, y: p.y - 10, vx: 0, vy: -60, life: 0.7, max: 0.7, text: 'SKID!', color: '#9fc4ff' });
    }

    const zone = r.zone && zoneBox(r.zone);
    const ramp = r.ramp && rampBox(r.ramp);
    r.police = r.police.filter((p) => {
      let crashed = Boolean((zone && rectsOverlap(box(p), zone)) || (ramp && rectsOverlap(box(p), ramp)));
      for (const v of r.vehicles) {
        if (crashed || !rectsOverlap(box(p), box(v))) continue;
        if (p.swat && !v.lethal) {
          // Armoured: ordinary traffic is shoved aside.
          v.gone = true;
          burst(effects, v.x, v.y + v.length, [v.color || '#888', '#2e4552'], 10, 200, 5);
        } else {
          crashed = true;
        }
      }
      if (crashed) wreckPolice(r, p);
      return !crashed && p.y < HEIGHT + 220; // far enough back = lost them
    });
    r.vehicles = r.vehicles.filter((v) => !v.gone);

    for (const p of r.police) {
      if (!rectsOverlap(bus, box(p))) continue;
      if (tryRam(r, p)) {
        p.gone = true;
      } else if (absorbWithShield(r, p, p.x, p.y)) {
        wreckPolice(r, p);
        p.gone = true;
      } else {
        hit(r, p);
      }
      if (r.status !== 'playing') return;
    }
    r.police = r.police.filter((p) => !p.gone);

    r.wrecks.forEach((wk) => { wk.y += r.speed * PX_PER_METER * dt; });
    r.wrecks = r.wrecks.filter((wk) => wk.y < HEIGHT + 40);
  }

  /**
   * At five stars a helicopter hovers ahead of the bus, tracking its lane
   * and dropping a spike strip SPIKE_LEAD_PX ahead of it every
   * SPIKE_DROP_SECONDS. An EMP grounds it for a while (it backs off the top
   * of the screen).
   */
  function updateHelicopter(r, dt) {
    if (!r.heli && !r.noPolice && helicopterActive(wantedLevel(r.distance, r.fares))) {
      r.heli = { x: r.busX, y: -90, drop: SPIKE_DROP_SECONDS, grounded: 0 };
      popText(WIDTH / 2, 160, 'POLICE CHOPPER!', '#9fc4ff', 1.6);
    }
    const h = r.heli;
    if (!h) return;
    h.grounded = Math.max(0, h.grounded - dt);
    const targetY = h.grounded > 0 ? -150 : 110;
    h.y += (targetY - h.y) * Math.min(1, dt * 1.5);
    h.x += (r.busX - h.x) * Math.min(1, dt * 1.2);
    if (h.grounded > 0 || h.y < 60) return;
    h.drop -= dt;
    if (h.drop > 0) return;
    h.drop = SPIKE_DROP_SECONDS;
    const x = laneCenter(r.lane);
    r.spills.push({ kind: 'spikes', x, y: BUS_Y - SPIKE_LEAD_PX, vx: 0, angle: 0, spin: 0 });
    burst(effects, x, BUS_Y - SPIKE_LEAD_PX, ['#d3cdc2', '#3a3734'], 8, 120, 3);
  }

  function draw(t) {
    const r = run;
    const busKey = r ? r.bus : progress.bus;
    ctx.save();
    if (shake > 0) {
      const k = shake * 14;
      ctx.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
    }
    if (r && r.cut && r.cut.kind === 'alcatraz' && r.cut.t >= CUT_FLIGHT) {
      drawCutscene(ctx, r.cut, r.status === 'cutscene');
      ctx.restore();
      return;
    }
    if (r && r.scene && r.scene.t >= SCENE_SLIDE) {
      drawLaughScene(ctx, r.scene.t - SCENE_SLIDE);
      drawLetterbox(ctx, 1);
      ctx.restore();
      return;
    }
    // The mixer cutscene pans the camera back down the road to watch.
    const pan = r && r.scene ? SCENE_PAN * smoothstep(r.scene.t / 0.5) : 0;
    const scroll = (r ? r.scroll : idleScroll) + pan;
    drawScenery(ctx, sceneryFor(r ? r.level : 0), scroll, dpr);
    ctx.translate(0, -pan);
    if (r && r.fade > 0) {
      ctx.globalAlpha = r.fade;
      drawScenery(ctx, sceneryFor(r.fadeFrom), scroll, dpr);
      ctx.globalAlpha = 1;
    }
    const tr = r && r.track;
    if (r) {
      if (r.ramp) drawViaductEdge(ctx, r.ramp.side, scroll);
      r.scorches.forEach((s) => drawScorch(ctx, s));
      if (r.zone) drawZone(ctx, r.zone, t);
      r.potholes.forEach((h) => drawPothole(ctx, h));
      r.puddles.forEach((p) => drawPuddle(ctx, p, t));
      r.sand.forEach((d) => drawSandDrift(ctx, d));
      if (r.crash) drawFuelPuddle(ctx, r.crash.v, 1 - r.crash.stun / r.crash.stunMax, t);
      r.wrecks.forEach((wk) => drawWreck(ctx, wk, t));
      if (r.scene) drawSkidMarks(ctx, r.scene.marks);
      r.spills.forEach((b) => {
        if (b.kind === 'garbage') drawGarbage(ctx, b);
        else if (b.kind === 'spikes') drawSpikes(ctx, b);
        else drawBanana(ctx, b);
      });
      r.peds.forEach((p) => drawPedestrian(ctx, p, t));
      r.fareItems.forEach((f) => drawFare(ctx, f, t));
      r.powerups.forEach((p) => drawPowerup(ctx, p, t));
      if (r.ramp) drawRampTruck(ctx, r.ramp, t);
      if (r.tip) drawTipZone(ctx, r.tip, t);
      r.vehicles.forEach((v) => drawVehicle(ctx, v, t));
      if (r.tip && r.tip.brake > 0) drawTyreSmoke(ctx, r.tip.x, r.tip.y - 10, t, r.tip.brake / MIXER_BRAKE_SECONDS);
      r.police.forEach((p) => {
        if (p.y >= HEIGHT) drawSirenCue(ctx, p, t);
        else {
          const angle = p.skid > 0 ? Math.sin(p.skid * 40) * 0.3 * (p.skid / SKID_SECONDS) : 0;
          if (p.swat) drawSwat(ctx, p, t, true, angle);
          else drawPolice(ctx, p, t, true, angle);
        }
      });
      if (tr) {
        // Up on the viaduct: the deck fades in on the jump and out on the drop.
        const k = tr.phase === 'jump' ? smoothstep(tr.t / JUMP_SECONDS)
          : tr.phase === 'drop' ? 1 - smoothstep(tr.t / DROP_SECONDS) : 1;
        drawViaduct(ctx, scroll, k);
        if (tr.phase === 'ride') {
          tr.fares.forEach((f) => drawFare(ctx, f, t));
          if (tr.warn > 0) drawTrainWarning(ctx, tr.pending, t);
          if (tr.train) drawTrain(ctx, TRACK_X[tr.train.track], tr.train.y, TRAIN_LENGTH, tr.train.track === 0);
        }
      }
      if (r.cut && r.cut.kind === 'pancake') {
        drawPancake(ctx, r.cut, r.cut.t, busKey);
      } else if (!r.cut) {
        const flashing = r.grace > 0 && Math.floor(r.grace * 10) % 2 === 0;
        const skidWobble = r.skid > 0 ? Math.sin(r.skid * 40) * 0.3 * (r.skid / SKID_SECONDS) : 0;
        // A drift kicks the tail out toward the mixer, then snaps back.
        const wobble = r.drift ? r.drift.dir * 0.45 * Math.sin(Math.PI * Math.min(1, r.drift.t / DRIFT_SECONDS)) : skidWobble;
        if (r.drift) drawTyreSmoke(ctx, r.busX, BUS_Y + busDef(busKey).length - 6, t, 1 - r.drift.t / DRIFT_SECONDS);
        // Airborne off the ramp (or dropping off the viaduct): the bus swells
        // as it rises, its shadow falling away beneath it.
        const air = tr && tr.phase === 'jump' ? Math.sin(Math.PI * Math.min(1, tr.t / JUMP_SECONDS))
          : tr && tr.phase === 'drop' ? Math.sin(Math.PI * Math.min(1, tr.t / DROP_SECONDS)) * 0.6 : 0;
        const cy = BUS_Y + busDef(busKey).length / 2;
        if (air > 0) {
          ctx.fillStyle = `rgba(28,22,16,${0.35 - air * 0.15})`;
          ctx.beginPath();
          ctx.ellipse(r.busX + 18 + air * 30, cy + 20 + air * 40, 30, busDef(busKey).length / 2, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.save();
        if (air > 0) {
          ctx.translate(r.busX, cy);
          ctx.scale(1 + air * 0.35, 1 + air * 0.35);
          ctx.translate(-r.busX, -cy);
        }
        if (r.nitro > 0) drawNitroFlame(ctx, r.busX, t, busKey, Math.min(1, r.nitro / 0.4));
        drawBus(ctx, r.busX, flashing, r.status === 'playing' && input.brake, wobble, busKey);
        ctx.restore();
        if (r.slow > 0 && r.slowKind !== 'sand') drawStink(ctx, r.busX, t, busKey);
        if (r.shield > 0) drawShieldBubble(ctx, r.busX, t, busKey, r.shield);
        if (r.magnet > 0) {
          ctx.strokeStyle = `rgba(201,64,44,${0.25 + 0.15 * Math.sin(t * 8)})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(r.busX, BUS_Y + busDef(busKey).length / 2, MAGNET_RADIUS * (0.6 + 0.4 * ((t * 1.5) % 1)), 0, Math.PI * 2);
          ctx.stroke();
        }
      } else {
        // Blown up with the tanker: a charred shell where the bus was.
        const def = busDef(busKey);
        drawBusShape(ctx, r.cut.x, BUS_Y, def.width, def.length, { body: '#4a4440', roof: '#5f5852' }, busKey, { route: '--' });
      }
      if (r.heli && !tr) drawHelicopter(ctx, r.heli, t, r.busX, busKey);
      if (DISTRICTS[r.level].night) drawNight(ctx, nightLayer, dpr, r, busKey, 1 - r.fade);
      else if (r.fade > 0 && DISTRICTS[r.fadeFrom].night) drawNight(ctx, nightLayer, dpr, r, busKey, r.fade);
      ctx.translate(0, pan);
      drawRain(ctx, r.weather, t);
      if (r.status === 'playing' && !r.scene) {
        const target = driftTarget(r);
        nearbyMixers(r).forEach((v) => drawDriftRing(ctx, v, t, v === target, Math.sign(v.x - r.busX)));
      }
    } else {
      drawBus(ctx, laneCenter(1), false, false, 0, busKey);
    }
    // Effects live in road coordinates, so they pan with the cutscene camera.
    ctx.translate(0, -pan);
    drawEffects(ctx, effects);
    ctx.translate(0, pan);
    if (r && r.blast) {
      const k = r.blast.t / 0.9;
      drawFireball(ctx, r.blast.x, r.blast.y, 60 + FUEL_BLAST_RADIUS * smoothstep(k * 1.5), k);
      ctx.strokeStyle = `rgba(255,240,200,${0.8 * (1 - k)})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(r.blast.x, r.blast.y, FUEL_BLAST_RADIUS * 1.4 * smoothstep(k), 0, Math.PI * 2);
      ctx.stroke();
    }
    if (r && r.cut && r.cut.kind === 'alcatraz') drawCutsceneBoom(ctx, r.cut);
    if (r && r.cut && r.cut.kind === 'pancake' && r.cut.t >= CUTS.pancake.wasted) {
      drawWastedCard(ctx, Math.min(1, (r.cut.t - CUTS.pancake.wasted) / 0.35), 'Flattened into a pancake');
    }
    if (r && r.crash) drawCrashOverlay(ctx, r.crash, t, r.busX);
    if (r && !r.cut && !r.scene) drawPowerupChips(ctx, r);
    if (r && tr && tr.phase === 'ride') drawTrackTimer(ctx, tr.left);
    if (r && r.weather.splash > 0) drawSplash(ctx, r.weather.splash / SPLASH_SECONDS);
    if (r && r.scene) drawLetterbox(ctx, Math.min(1, r.scene.t / 0.3));
    if (r && r.cut && r.cut.kind === 'pancake') drawLetterbox(ctx, Math.min(1, r.cut.t / 0.3));
    if (r && r.tip) drawLetterbox(ctx, Math.min(1, r.tip.tip * 3) * 0.6);
    if (r && r.banner) drawBanner(ctx, r.banner);
    if (r && r.cut && r.cut.kind === 'pancake' && Math.floor(r.cut.t * 1.5) % 2 === 0 && r.status === 'cutscene') {
      centreText(ctx, 'Press any key to continue', WIDTH / 2, HEIGHT - 24, '600 13px Figtree, sans-serif', '#f1e9d6');
    }
    ctx.restore();
    if (shake > 0) {
      ctx.fillStyle = `rgba(201,64,44,${Math.min(shake, 0.5) * 0.35})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
    if (r && r.empFlash > 0) {
      ctx.fillStyle = `rgba(170,130,255,${r.empFlash * 0.6})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
  }

  function loop(now) {
    // Clamp dt so a backgrounded tab doesn't teleport traffic on return.
    const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0;
    lastTime = now;
    if (paused) {
      // test hook: simulation frozen
    } else if (run && run.status === 'playing') {
      update(dt);
      renderHud();
      renderMissions();
    } else if (run && run.status === 'cutscene') {
      run.cut.t += dt;
      if (run.cut.t >= CUTS[run.cut.kind].end) endRun();
    } else if (!run) {
      idleScroll += dt * 40;
    }
    if (run && run.blast) {
      run.blast.t += dt;
      if (run.blast.t > 0.9) run.blast = null;
    }
    if (run && run.empFlash > 0) run.empFlash = Math.max(0, run.empFlash - dt);
    effects = stepEffects(effects, dt);
    shake = Math.max(0, shake - dt);
    draw(now / 1000);
    rafHandle = window.requestAnimationFrame(loop);
  }

  // --- input --------------------------------------------------------------

  function steer(dir) {
    if (!run || run.status !== 'playing' || run.scene) return;
    if (run.track) {
      // Up on the viaduct, ← → hop between the two tracks.
      if (run.track.phase === 'ride') run.track.lane = Math.min(Math.max(run.track.lane + dir, 0), TRACKS - 1);
      return;
    }
    if (run.skid > 0 || (run.crash && run.crash.stun > 0)) return;
    run.lane = Math.min(Math.max(run.lane + dir, 0), LANES - 1);
  }

  function isTyping(target) {
    return target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
  }

  function onKeyDown(e) {
    if (isTyping(e.target) || !run) return;
    if (run.status === 'cutscene') {
      if (!e.repeat) skipCutscene();
      e.preventDefault();
      return;
    }
    if (run.status !== 'playing') return;
    if (run.scene) {
      if (!e.repeat) skipScene();
      e.preventDefault();
      return;
    }
    const key = e.key.toLowerCase();
    if (key === ' ' || key === 'e') { if (!e.repeat) drift(); }
    else if (key === 'arrowleft' || key === 'a') { if (!e.repeat) steer(-1); }
    else if (key === 'arrowright' || key === 'd') { if (!e.repeat) steer(1); }
    else if (key === 'arrowup' || key === 'w') input.accelerate = true;
    else if (key === 'arrowdown' || key === 's') input.brake = true;
    else return;
    e.preventDefault(); // keep arrows from scrolling the page mid-run
  }

  function onKeyUp(e) {
    const key = e.key.toLowerCase();
    if (key === 'arrowup' || key === 'w') input.accelerate = false;
    if (key === 'arrowdown' || key === 's') input.brake = false;
  }

  /**
   * Canvas pointer: a tap steers (left/right half), a drag toward a mixer
   * in range drifts into it. Taps steer on release so a drag never also
   * changes lane.
   */
  let press = null;
  function onCanvasPointerDown(e) {
    if (run && run.status === 'cutscene') {
      skipCutscene();
      return;
    }
    if (!run || run.status !== 'playing') return;
    if (run.scene) {
      skipScene();
      return;
    }
    press = { id: e.pointerId, x: e.clientX, dragged: false };
  }

  function onCanvasPointerMove(e) {
    if (!press || press.id !== e.pointerId || press.dragged || !run || run.status !== 'playing') return;
    const rect = canvas.getBoundingClientRect();
    const dx = ((e.clientX - press.x) / rect.width) * WIDTH;
    if (Math.abs(dx) < DRIFT_DRAG_PX) return;
    press.dragged = true;
    drift(Math.sign(dx));
  }

  function onCanvasPointerUp(e) {
    const p = press;
    press = null;
    if (!p || p.id !== e.pointerId || p.dragged || !run || run.status !== 'playing' || run.scene) return;
    const rect = canvas.getBoundingClientRect();
    steer(e.clientX - rect.left < rect.width / 2 ? -1 : 1);
  }

  const controlCleanups = el.controls.map((button) => {
    const action = button.dataset.busRushControl;
    const held = action === 'faster' ? 'accelerate' : action === 'slower' ? 'brake' : null;
    const press = () => {
      if (action === 'drift') drift();
      else steer(action === 'left' ? -1 : 1);
    };
    const down = (e) => {
      e.preventDefault();
      if (held) input[held] = true;
      else press();
    };
    const up = () => { if (held) input[held] = false; };
    // Keyboard activation (Enter/Space) of ◀/▶/Drift arrives as a click with
    // detail 0; pointer presses are already handled on pointerdown.
    const click = (e) => { if (!held && e.detail === 0) press(); };
    button.addEventListener('pointerdown', down);
    button.addEventListener('pointerup', up);
    button.addEventListener('pointerleave', up);
    button.addEventListener('pointercancel', up);
    button.addEventListener('click', click);
    return () => {
      button.removeEventListener('pointerdown', down);
      button.removeEventListener('pointerup', up);
      button.removeEventListener('pointerleave', up);
      button.removeEventListener('pointercancel', up);
      button.removeEventListener('click', click);
    };
  });

  // Element listeners die with the swapped-out DOM; only window-level ones
  // need explicit teardown.
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onCanvasPointerDown);
  canvas.addEventListener('pointermove', onCanvasPointerMove);
  canvas.addEventListener('pointerup', onCanvasPointerUp);
  canvas.addEventListener('pointercancel', () => { press = null; });
  canvas.tabIndex = 0;

  el.start.startButton.addEventListener('click', () => startRun(false));
  if (el.start.dailyButton) el.start.dailyButton.addEventListener('click', () => startRun(true));
  el.start.shopButton.addEventListener('click', openShop);
  el.runOver.again.addEventListener('click', () => startRun(lastDaily));
  el.runOver.shopButton.addEventListener('click', openShop);
  el.shop.close.addEventListener('click', closeShop);
  el.shop.reset.addEventListener('click', () => {
    if (!window.confirm('Reset all Bus Rush progress? Tokens, upgrades and bests will be cleared.')) return;
    progress = defaultProgress();
    saveProgress(progress);
    renderShop();
    renderHud();
    missionsText = '';
    renderMissions();
    renderAchievements();
  });
  // Buying a bus also selects it; an owned bus is selected for free.
  Object.entries(el.shop.buses).forEach(([key, item]) => {
    item.button.addEventListener('click', () => {
      if (!progress.buses.includes(key)) {
        if (progress.tokens < BUSES[key].cost) return;
        progress.tokens -= BUSES[key].cost;
        progress.buses.push(key);
      }
      progress.bus = key;
      saveProgress(progress);
      renderShop();
      renderStart();
      renderHud();
    });
  });
  Object.entries(el.shop.items).forEach(([key, item]) => {
    item.buy.addEventListener('click', () => {
      const cost = upgradeCost(key, progress.upgrades[key]);
      if (cost === null || progress.tokens < cost) return;
      progress.tokens -= cost;
      progress.upgrades[key] += 1;
      saveProgress(progress);
      renderShop();
      renderHud();
    });
  });

  // One submission per run: lock the button once the leaderboard swap
  // succeeds.
  if (el.runOver.form) {
    el.runOver.form.addEventListener('htmx:afterRequest', (e) => {
      if (e.detail && e.detail.successful) {
        el.runOver.submit.disabled = true;
        el.runOver.submit.textContent = 'Submitted';
      }
    });
  }

  // Test-only hook for e2e/bus-rush.spec.js: a natural crash depends on
  // random traffic, so tests call crash() to apply real hits through the
  // same hit()/endRun() path real play uses. Harmless in production, same
  // reasoning as fishing-game.js's __fishingGameTestHooks.
  window.__busRushTestHooks = {
    // Puts a cruiser right behind the bus, overlapping it, so the next
    // update() rams through the real police path.
    // Stops traffic (and clears what's on screen) so a run can't take damage
    // — isolates the police chase for tests.
    noTraffic() {
      if (!run) return;
      run.noTraffic = true;
      run.vehicles = [];
      run.zone = null;
      run.potholes = [];
      run.peds = [];
      run.powerups = [];
    },
    // Read-only view of the chase: gap is px from the bus's rear bumper to
    // each cruiser's nose (negative = alongside/overlapping).
    snapshot() {
      if (!run) return null;
      return {
        status: run.status,
        level: run.level + 1,
        kmh: toKmh(run.speed),
        lane: run.lane,
        skidding: run.skid > 0,
        bananas: run.spills.filter((b) => b.kind === 'banana').length,
        garbage: run.spills.filter((b) => b.kind === 'garbage').length,
        slowed: run.slow > 0,
        bus: run.bus,
        lives: run.lives,
        policeLanes: run.police.map((p) => p.lane),
        policeSkidding: run.police.filter((p) => p.skid > 0).length,
        wanted: wantedLevel(run.distance, run.fares),
        police: run.police.map((p) => Math.round(p.y - (BUS_Y + BUS_LENGTH))),
        swat: run.police.filter((p) => p.swat).length,
        crash: run.crash ? (run.crash.stun > 0 ? 'stun' : 'fuse') : null,
        cutscene: run.status === 'cutscene',
        wasted: run.wasted,
        tankerEscapes: run.tankerEscapes,
        wrecked: run.wrecked,
        rammed: run.rammed,
        shield: run.shield > 0,
        magnet: run.magnet > 0,
        powerups: run.powerupsTaken,
        zoneLane: run.zone ? run.zone.lane : null,
        heli: Boolean(run.heli),
        spikes: run.spills.filter((b) => b.kind === 'spikes').length,
        missions: [...progress.missions],
        daily: run.daily,
        upgradesUsed: { ...run.upgrades },
        track: run.track ? run.track.phase : null,
        trackLane: run.track ? run.track.lane : null,
        trackLeft: run.track ? run.track.left : null,
        train: run.track && run.track.train ? run.track.train.track : null,
        trackRides: run.trackRides,
        ramp: Boolean(run.ramp),
        tipping: Boolean(run.tip),
        scene: Boolean(run.scene),
        pancaked: run.pancaked,
        mixerTopples: run.mixerTopples,
        canDrift: Boolean(driftTarget(run)),
        drifting: Boolean(run.drift),
        mixerBraking: Boolean(run.tip && run.tip.brake > 0),
        raining: run.weather.rain > 0,
        splash: run.weather.splash > 0,
        storms: run.storms,
        hazmat: run.vehicles.filter((v) => v.hazmat).length,
        stun: run.crash ? run.crash.stun : null,
        fuse: run.crash ? run.crash.fuse : null,
      };
    },
    // A ramp truck parked in edge `lane` (default: the bus's, if it's an
    // edge lane, else lane 0), its rear `bottom` px down the screen —
    // by default just ahead of the bus, so it drives straight up it.
    ramp(lane = run && (run.lane === LANES - 1 ? LANES - 1 : 0), bottom = BUS_Y + 10) {
      if (!run || run.status !== 'playing') return;
      const side = lane === 0 ? -1 : 1;
      run.ramp = { lane, side, x: laneCenter(lane) + side * 14, y: bottom - RAMP_TRUCK.length };
    },
    // A train on `track` (0 up, 1 down) with its top at screen `y`.
    train(track, y) {
      if (run && run.track && run.track.phase === 'ride') run.track.train = { track, y };
    },
    // Sets how long the bus has left on the track.
    trackLeft(seconds) {
      if (run && run.track) run.track.left = seconds;
    },
    // Holds back trains (and their warnings) for `seconds`.
    quietTrack(seconds = 999) {
      if (!run || !run.track) return;
      run.track.train = null;
      run.track.warn = 0;
      run.track.gap = seconds;
    },
    // A cement mixer one lane over (toward the middle) alongside the bus.
    mixer(lane = run && (run.lane <= 1 ? run.lane + 1 : run.lane - 1), y = BUS_Y - 20) {
      const def = VEHICLES.find((v) => v.kind === 'mixer');
      if (!run || run.status !== 'playing') return;
      run.vehicles.push({ ...def, label: def.label, lethal: true, x: laneCenter(lane), y, color: VEHICLE_COLORS[0], drops: [] });
    },
    // Presses the Drift button (Space): drifts into a mixer in range.
    drift() {
      return drift();
    },
    // Fast-forwards a running cutscene/scene clock to `t` seconds.
    sceneTime(t) {
      if (run && run.scene) run.scene.t = t;
    },
    // Starts (or stops) a storm.
    storm(on = true) {
      if (!run) return;
      run.weather.rain = on ? STORM_SECONDS : 0;
      if (on) run.storms += 1;
    },
    // A rain puddle / sand drift just ahead of the bus in its lane.
    puddle(lane = run && run.lane, y = BUS_Y - 20) {
      if (run && run.status === 'playing') run.puddles.push({ x: laneCenter(lane), y, phase: 0 });
    },
    sand(lane = run && run.lane, y = BUS_Y - 20) {
      if (run && run.status === 'playing') run.sand.push({ x: laneCenter(lane), y, angle: 0 });
    },
    // Shortens a tanker crash's stun to `seconds`, so tests needn't wait 10 s.
    stunLeft(seconds) {
      if (run && run.crash) run.crash.stun = seconds;
    },
    // Sets an upgrade level directly (tests of Ram Plating).
    upgrade(key, lvl) {
      if (!Object.prototype.hasOwnProperty.call(UPGRADES, key)) return;
      progress.upgrades[key] = Math.min(Math.max(0, Math.floor(lvl)), UPGRADES[key].maxLevel);
      saveProgress(progress);
    },
    // A power-up of `kind` just ahead of the bus in its lane.
    powerup(kind, lane = run && run.lane, y = BUS_Y - 30) {
      if (!run || run.status !== 'playing' || !POWERUPS[kind]) return;
      run.powerups.push({ kind, x: laneCenter(lane), y, phase: 0 });
    },
    // A pothole / spike strip / jaywalker, by default just ahead of the bus
    // in its lane (lane and y are optional, for screenshots).
    pothole(lane = run && run.lane, y = BUS_Y - 20) {
      if (!run || run.status !== 'playing') return;
      run.potholes.push({ x: laneCenter(lane), y, angle: 0 });
    },
    spikes(lane = run && run.lane, y = BUS_Y - 20) {
      if (!run || run.status !== 'playing') return;
      run.spills.push({ kind: 'spikes', x: laneCenter(lane), y, vx: 0, angle: 0, spin: 0 });
    },
    pedestrian(lane = run && run.lane, y = BUS_Y - 4, look = 0) {
      if (!run || run.status !== 'playing') return;
      run.peds.push({ x: laneCenter(lane), y, dir: 1, look, phase: 0, fleeing: false, hit: false, hitT: 0 });
    },
    // A construction zone closing `lane` (default: the bus's), its near end
    // `bottom` px down the screen (default: just ahead of the bus).
    zone(lane = run && run.lane, bottom = BUS_Y + 10) {
      if (!run || run.status !== 'playing') return;
      run.zone = { lane, y: bottom - CONSTRUCTION_LENGTH, length: CONSTRUCTION_LENGTH, seed: 1 };
    },
    // Freezes the simulation (drawing carries on), for screenshots.
    pause(on = true) {
      paused = on;
    },
    // Jumps the WASTED cutscene to `t` seconds, for screenshots.
    cutTime(t) {
      if (run && run.cut) run.cut.t = t;
    },
    // A SWAT van ramming the bus from behind.
    swatRam() {
      if (!run || run.status !== 'playing') return;
      run.grace = 0;
      spawnPolice(run, run.lane, BUS_Y + BUS_LENGTH - 20, SWAT_VAN);
    },
    // Jumps the run to `meters` so district changes can be tested.
    warp(meters) {
      if (run && run.status === 'playing') run.distance = meters;
    },
    // Drops a banana just ahead of the bus in its lane, so the next frames
    // run it over through the real skid path.
    banana() {
      if (!run || run.status !== 'playing') return;
      run.spills.push({ kind: 'banana', x: laneCenter(run.lane), y: BUS_Y - 20, vx: 0, angle: 0, spin: 0 });
    },
    // Stops police spawning (and clears any) to isolate other mechanics.
    noPolice() {
      if (!run) return;
      run.noPolice = true;
      run.police = [];
    },
    // Drops a garbage pile just ahead of the bus in its lane.
    garbage() {
      if (!run || run.status !== 'playing') return;
      run.spills.push({ kind: 'garbage', x: laneCenter(run.lane), y: BUS_Y - 20, vx: 0, angle: 0, spin: 0 });
    },
    // A cruiser in the bus's lane, behind it and not re-aiming, with a
    // banana just ahead of its nose — it runs the banana over through the
    // real police path. Stops traffic so nothing else interferes.
    policeBanana() {
      if (!run || run.status !== 'playing') return;
      run.noTraffic = true;
      run.vehicles = [];
      const y = BUS_Y + BUS_LENGTH + 60;
      spawnPolice(run, run.lane, y);
      run.police[run.police.length - 1].retarget = 99;
      run.spills.push({ kind: 'banana', x: laneCenter(run.lane), y: y - 12, vx: 0, angle: 0, spin: 0 });
    },
    policeRam() {
      if (!run || run.status !== 'playing') return;
      run.grace = 0;
      spawnPolice(run, run.lane, BUS_Y + BUS_LENGTH - 20);
    },
    crash() {
      let guard = 0;
      while (run && run.status === 'playing' && guard < 50) {
        run.grace = 0;
        hit(run);
        guard += 1;
      }
    },
    // Places a vehicle of `kind` in `lane` at screen `y` (for screenshots
    // and tests that need traffic somewhere other than the bus's lane).
    place(kind, lane, y, { hazmat = false } = {}) {
      const def = VEHICLES.find((v) => v.kind === kind);
      if (!run || !def) return;
      run.vehicles.push({
        ...def,
        hazmat,
        lethal: Boolean(def.lethal),
        bus: Boolean(def.bus),
        x: laneCenter(lane),
        y,
        color: VEHICLE_COLORS[0],
        route: ROUTES[0],
        drops: [],
      });
    },
    // Drops one vehicle of `kind` into the bus's lane just above the
    // screen, so it collides through the real update() path. `hazmat`
    // loads a truck or semi with gasoline.
    spawn(kind, { hazmat = false } = {}) {
      const def = VEHICLES.find((v) => v.kind === kind);
      if (!run || run.status !== 'playing' || !def) return;
      run.vehicles.push({
        kind: def.kind,
        label: def.label || def.kind,
        lethal: Boolean(def.lethal),
        fuel: Boolean(def.fuel),
        hazmat,
        bus: Boolean(def.bus),
        route: ROUTES[0],
        x: laneCenter(run.lane),
        y: -def.length,
        width: def.width,
        length: def.length,
        color: VEHICLE_COLORS[0],
      });
    },
    grantTokens(n) {
      progress.tokens += n;
      saveProgress(progress);
      renderStart();
    },
  };

  renderStart();
  renderHud();
  renderMissions();
  renderAchievements();
  show(el.start.root);
  rafHandle = window.requestAnimationFrame(loop);

  teardownCurrent = () => {
    if (rafHandle !== null) window.cancelAnimationFrame(rafHandle);
    rafHandle = null;
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    controlCleanups.forEach((fn) => fn());
    teardownCurrent = null;
  };
}

// ---------------------------------------------------------------------------
// DOM lookup — the only place this file queries elements by ID.
// ---------------------------------------------------------------------------

function bootstrap() {
  const canvas = document.getElementById('bus-rush-canvas');
  if (!canvas) {
    // Navigated away: stop the old loop and listeners.
    if (teardownCurrent) teardownCurrent();
    return;
  }
  const $ = (id) => document.getElementById(id);
  const shopRoot = $('bus-rush-shop-screen');
  const items = {};
  Object.keys(UPGRADES).forEach((key) => {
    const row = shopRoot && shopRoot.querySelector(`[data-upgrade-key="${key}"]`);
    if (!row) return;
    items[key] = {
      level: row.querySelector('[data-upgrade-level]'),
      cost: row.querySelector('[data-upgrade-cost]'),
      buy: row.querySelector('[data-upgrade-buy]'),
    };
  });
  const buses = {};
  Object.keys(BUSES).forEach((key) => {
    const row = shopRoot && shopRoot.querySelector(`[data-bus-key="${key}"]`);
    if (!row) return;
    buses[key] = { row, cost: row.querySelector('[data-bus-cost]'), button: row.querySelector('[data-bus-select]') };
  });
  const submit = $('bus-rush-submit-button');
  const missions = [...document.querySelectorAll('[data-mission-slot]')].map((root) => ({
    root,
    label: root.querySelector('[data-mission-label]'),
    reward: root.querySelector('[data-mission-reward]'),
    progress: root.querySelector('[data-mission-progress]'),
    bar: root.querySelector('[data-mission-bar]'),
  }));
  const achievementItems = {};
  Object.keys(ACHIEVEMENTS).forEach((key) => {
    const root = document.querySelector(`[data-achievement-key="${key}"]`);
    if (root) achievementItems[key] = { root, mark: root.querySelector('[data-achievement-mark]') };
  });

  init(canvas, {
    hud: {
      distance: $('bus-rush-hud-distance'),
      speed: $('bus-rush-hud-speed'),
      score: $('bus-rush-hud-score'),
      lives: $('bus-rush-hud-lives'),
      fares: $('bus-rush-hud-fares'),
      wanted: $('bus-rush-hud-wanted'),
      level: $('bus-rush-hud-level'),
    },
    start: {
      root: $('bus-rush-start-screen'),
      tokens: $('bus-rush-start-tokens'),
      bestScore: $('bus-rush-start-best-score'),
      bestDistance: $('bus-rush-start-best-distance'),
      dailyBest: $('bus-rush-start-daily-best'),
      dailyButton: $('bus-rush-daily-button'),
      storageNotice: $('bus-rush-storage-notice'),
      startButton: $('bus-rush-start-button'),
      bus: $('bus-rush-start-bus'),
      shopButton: $('bus-rush-start-shop-button'),
    },
    runOver: {
      root: $('bus-rush-run-over-screen'),
      title: $('bus-rush-run-over-title'),
      distance: $('bus-rush-run-over-distance'),
      fares: $('bus-rush-run-over-fares'),
      wrecked: $('bus-rush-run-over-wrecked'),
      level: $('bus-rush-run-over-level'),
      score: $('bus-rush-run-over-score'),
      tokens: $('bus-rush-run-over-tokens'),
      bonus: $('bus-rush-run-over-bonus'),
      unlocks: $('bus-rush-run-over-unlocks'),
      form: submit && submit.form,
      submit,
      scoreInput: $('bus-rush-score-input'),
      distanceInput: $('bus-rush-distance-input'),
      dailyInput: $('bus-rush-daily-input'),
      again: $('bus-rush-again-button'),
      shopButton: $('bus-rush-run-over-shop-button'),
    },
    shop: {
      root: shopRoot,
      tokens: $('bus-rush-shop-tokens'),
      close: $('bus-rush-shop-close-button'),
      reset: $('bus-rush-shop-reset-button'),
      items,
      buses,
    },
    controls: [...document.querySelectorAll('[data-bus-rush-control]')],
    missions,
    achievements: { items: achievementItems, count: $('bus-rush-achievement-count') },
  });
}

if (typeof document !== 'undefined') {
  bootstrap();
  document.body.addEventListener('htmx:afterSwap', (e) => {
    if (e.target && e.target.id === 'main-content') bootstrap();
  });
}
