// Pure, canvas-independent game rules for Bus Rush
// (docs/features/bus-rush.md's Business Rules).
//
// No DOM/canvas/localStorage/timer dependencies, so it runs under
// `node --test` and is imported unchanged by bus-rush.js. The numbers are
// tunable; the shapes (bounds, caps, "every row is passable") are not.

/** Number of road lanes. */
export const LANES = 4;

/** Canvas pixels per world metre — the scale traffic and fares scroll at. */
export const PX_PER_METER = 8;

/** Speeds are metres/second; the HUD shows km/h. */
export const MIN_SPEED = 8;
export const BASE_MAX_SPEED = 16;
export const ENGINE_SPEED_STEP = 3;
export const ACCELERATION = 6;
export const BRAKING = 14;

/** Oncoming traffic's own speed. One shared value on purpose: if vehicles
 * moved at different speeds, rows could drift into each other and close
 * every lane at once, breaking pickBlockedLanes' guarantee. */
export const TRAFFIC_SPEED = 6;

/** Seconds of invulnerability after a hit. */
export const HIT_GRACE_SECONDS = 1.5;

export const BASE_LIVES = 3;
export const FARE_POINTS = 25;

/** Leaderboard bounds — mirror internal/service/bus_rush_validation.go. */
export const SCORE_MAX = 999999;
export const DISTANCE_MAX = 999999;

/** Shop upgrades. `key` matches data-upgrade-key in bus-rush-shop.html. */
export const UPGRADES = {
  engine: { label: 'Engine', baseCost: 15, growth: 1.6, maxLevel: 6 },
  steering: { label: 'Steering', baseCost: 10, growth: 1.7, maxLevel: 4 },
  bumpers: { label: 'Bumpers', baseCost: 25, growth: 1.9, maxLevel: 3 },
  fareBox: { label: 'Fare Box', baseCost: 20, growth: 1.8, maxLevel: 4 },
  // Lets the bus ram police instead of being Busted — see ramOutcome.
  ram: { label: 'Ram Plating', baseCost: 50, growth: 2, maxLevel: 3 },
};

/** Construction zones (and their dump trucks) start at this distance. */
const CONSTRUCTION_MIN_DISTANCE_M = 300;

/**
 * Oncoming vehicle kinds; length/width in pixels. A `lethal` vehicle ends
 * the run on contact regardless of lives left or post-hit grace. `weight`
 * (default 1) is the relative chance pickVehicle picks it once unlocked —
 * buses (`bus: true`, non-lethal) are lighter so they add variety without
 * crowding out the trucks. A `fuel` tanker isn't lethal on contact: it
 * stuns the bus and then explodes (FUEL_STUN_SECONDS, FUEL_FUSE_SECONDS). A
 * `construction` vehicle (the dump truck) only turns up while a
 * construction zone is on the road — see pickVehicle. `hazmatChance` is the
 * chance a box truck or semi carries gasoline (isHazmat): contact then
 * stuns like a tanker, only longer (crashTimings). A `mixer` (cement mixer)
 * can be shoved over (canShove). The tow truck is a one-life hit.
 */
export const VEHICLES = [
  { kind: 'car', length: 64, width: 50, minDistance: 0 },
  { kind: 'schoolbus', label: 'school bus', length: 84, width: 54, minDistance: 150, bus: true, weight: 0.35 },
  { kind: 'citybus', label: 'bus', length: 92, width: 56, minDistance: 200, bus: true, weight: 0.5 },
  { kind: 'van', length: 82, width: 56, minDistance: 300 },
  { kind: 'doubledecker', label: 'double-decker', length: 92, width: 58, minDistance: 400, bus: true, weight: 0.4 },
  { kind: 'bendy', label: 'bendy bus', length: 150, width: 56, minDistance: 1000, bus: true, weight: 0.35 },
  { kind: 'garbage', label: 'garbage truck', length: 110, width: 60, minDistance: 500, lethal: true, spills: 'garbage' },
  { kind: 'truck', length: 118, width: 62, minDistance: 800, lethal: true, spills: 'banana', hazmatChance: 0.25 },
  { kind: 'semi', length: 170, width: 64, minDistance: 1500, lethal: true, spills: 'banana', hazmatChance: 0.3 },
  { kind: 'fuel', label: 'fuel tanker', length: 140, width: 60, minDistance: 700, fuel: true, weight: 0.4 },
  { kind: 'dump', label: 'dump truck', length: 104, width: 62, minDistance: CONSTRUCTION_MIN_DISTANCE_M, lethal: true, construction: true, weight: 1.5 },
  { kind: 'tow', label: 'tow truck', length: 124, width: 60, minDistance: 250, weight: 0.6 },
  { kind: 'mixer', label: 'cement mixer', length: 128, width: 62, minDistance: 600, lethal: true, mixer: true, weight: 0.6 },
];

function level(n, max) {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.floor(n), max);
}

/** Each district (level) raises both the speed floor and top speed by this much. */
export const LEVEL_SPEED_STEP = 1.5;

function levelSpeedBonus(levelIndex) {
  return level(levelIndex, LEVELS.length - 1) * LEVEL_SPEED_STEP;
}

/** Speed floor in a district (0-based level index) — what a hit drops you to. */
export function minSpeed(levelIndex = 0) {
  return MIN_SPEED + levelSpeedBonus(levelIndex);
}

/** Top speed for an Engine level in a district (0-based level index). */
export function maxSpeed(engineLevel, levelIndex = 0) {
  return BASE_MAX_SPEED + level(engineLevel, UPGRADES.engine.maxLevel) * ENGINE_SPEED_STEP + levelSpeedBonus(levelIndex);
}

/** Top speed while slowed by garbage: halved, never below the district's floor. */
export function slowedTopSpeed(engineLevel, levelIndex = 0) {
  return Math.max(minSpeed(levelIndex), maxSpeed(engineLevel, levelIndex) * GARBAGE_SPEED_FACTOR);
}

/**
 * Advances speed by one frame: holding accelerate speeds up (scaled by the
 * bus's `accel`), brake slows down (brake wins if both are held), neither
 * holds speed. While `slowed`, anything above slowedTopSpeed bleeds off at
 * braking rate rather than snapping down. Always clamped to
 * [minSpeed(levelIndex), maxSpeed(engineLevel, levelIndex)]. `grip` (WET_GRIP
 * in a storm) scales both accelerating and braking.
 */
export function stepSpeed(speed, input, dt, engineLevel, levelIndex = 0, { accel = 1, slowed = false, grip = 1 } = {}) {
  const floor = minSpeed(levelIndex);
  const ceiling = maxSpeed(engineLevel, levelIndex);
  const cap = slowed ? slowedTopSpeed(engineLevel, levelIndex) : ceiling;
  const start = Number.isFinite(speed) ? speed : floor;
  let next = start;
  const step = Number.isFinite(dt) && dt > 0 ? dt : 0;
  if (input && input.brake) next -= BRAKING * grip * step;
  else if (input && input.accelerate) next += ACCELERATION * accel * grip * step;
  if (next > cap) next = Math.max(cap, Math.min(next, start - BRAKING * step));
  return Math.min(Math.max(next, floor), ceiling);
}

/** m/s → whole km/h for the HUD. */
export function toKmh(speed) {
  return Math.round(speed * 3.6);
}

/**
 * Player buses: bought once in the depot shop, then selectable. Every bus
 * fits within BUS_LENGTH and none steers slower than the single-decker, so
 * the row-spacing guarantee ("every row is passable") holds for all of
 * them. `lives` adds to the starting lives, `steer` scales lane-change time
 * (lower is quicker), `accel` scales acceleration.
 */
export const BUSES = {
  single: { label: 'Single-decker', cost: 0, length: 88, width: 54, lives: 0, steer: 1, accel: 1 },
  minibus: { label: 'Minibus', cost: 60, length: 70, width: 46, lives: -1, steer: 0.75, accel: 1 },
  double: { label: 'Double-decker', cost: 100, length: 88, width: 56, lives: 1, steer: 1, accel: 0.7 },
  electric: { label: 'Electric bus', cost: 150, length: 88, width: 54, lives: 0, steer: 1, accel: 1.6 },
};

/** A bus's definition; anything unknown is the single-decker. */
export function busDef(key) {
  return Object.prototype.hasOwnProperty.call(BUSES, key) ? BUSES[key] : BUSES.single;
}

/** Seconds a lane change takes at a Steering level, for a bus. */
export function laneChangeSeconds(steeringLevel, busKey = 'single') {
  return Math.max(0.1, 0.24 - level(steeringLevel, UPGRADES.steering.maxLevel) * 0.035) * busDef(busKey).steer;
}

/** Lives at the start of a run for a Bumpers level and bus — always at least one. */
export function maxLives(bumpersLevel, busKey = 'single') {
  return Math.max(1, BASE_LIVES + level(bumpersLevel, UPGRADES.bumpers.maxLevel) + busDef(busKey).lives);
}

/** Tokens each collected fare is worth at a Fare Box level. */
export function fareValue(fareBoxLevel) {
  return 1 + level(fareBoxLevel, UPGRADES.fareBox.maxLevel);
}

function wholeOrZero(n) {
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * Run score: distance pays (so speed pays), fares add a bonus, and
 * `bonusPoints` is what wrecked police earned (policeWreckPoints).
 */
export function runScore(distanceMeters, fares, bonusPoints = 0) {
  return Math.min(wholeOrZero(distanceMeters) + wholeOrZero(fares) * FARE_POINTS + wholeOrZero(bonusPoints), SCORE_MAX);
}

/** Tokens earned by a finished run. */
export function runTokens(distanceMeters, fares, fareBoxLevel, wrecks = 0) {
  return wholeOrZero(fares) * fareValue(fareBoxLevel)
    + Math.floor(wholeOrZero(distanceMeters) / 100)
    + wholeOrZero(wrecks) * WRECK_TOKENS;
}

// ---------------------------------------------------------------------------
// Police pursuit — the bus is stolen. Everything scales with the wanted level.
// ---------------------------------------------------------------------------

export const WANTED_MAX = 5;
export const WRECK_TOKENS = 2;

/** Seconds into a run before the first cruiser, and between later ones. */
export const POLICE_FIRST_SECONDS = 4;
export const POLICE_SPAWN_SECONDS = 3.5;

/** Roadblocks (rows of oncoming cruisers) start at this distance. */
export const ROADBLOCK_MIN_DISTANCE = 600;

/** The cruiser used for both pursuit cars and roadblocks. Lethal: any contact is Busted. */
export const POLICE_CAR = { kind: 'police', length: 64, width: 50, police: true, lethal: true };

// ---------------------------------------------------------------------------
// Levels — districts one continuous run passes through, every LEVEL_DISTANCE.
// ---------------------------------------------------------------------------

export const LEVEL_DISTANCE = 800;
export const LEVELS = ['CBD', 'Heartland', 'Expressway', 'Industrial', 'Changi', 'Sentosa'];
export const CHECKPOINT_POINTS = 250;

/** 0-based district index for a distance; the last district is endless. */
export function levelAt(distanceMeters) {
  return Math.min(LEVELS.length - 1, Math.floor(wholeOrZero(distanceMeters) / LEVEL_DISTANCE));
}

/** Score for reaching district `levelIndex` (0-based; the start earns nothing). */
export function checkpointPoints(levelIndex) {
  return CHECKPOINT_POINTS * wholeOrZero(levelIndex);
}

/**
 * Wanted stars (1..WANTED_MAX): each district starts one star hotter, and
 * every 10 fares on top adds another.
 */
export function wantedLevel(distanceMeters, fares) {
  return Math.min(WANTED_MAX, levelAt(distanceMeters) + 1 + Math.floor(wholeOrZero(fares) / 10));
}

function stars(wanted) {
  return Number.isFinite(wanted) ? Math.min(Math.max(Math.floor(wanted), 1), WANTED_MAX) : 1;
}

/** Police pace as a fraction of the district's stock top speed, by star. */
export const POLICE_PACE = [0.8, 0.84, 0.88, 0.92, 0.96];

/**
 * Pursuit speed (m/s) in a district (0-based level index). Pegged to an
 * unupgraded bus's top speed *in that district*, so levelling up never
 * makes police uncatchable: a stock bus at full throttle always pulls
 * away, just more slowly at higher stars. They catch you when you brake
 * or get knocked down to the speed floor.
 */
export function policeSpeed(wanted, levelIndex = 0) {
  return maxSpeed(0, levelIndex) * POLICE_PACE[stars(wanted) - 1];
}

/** Most cruisers chasing at once. */
export function maxPolice(wanted) {
  return [1, 1, 2, 2, 3][stars(wanted) - 1];
}

/** Seconds a cruiser waits before re-aiming at the bus's lane — the window to juke it. */
export function policeReactionSeconds(wanted) {
  return 1.0 - stars(wanted) * 0.12;
}

/** Chance a traffic row is a police roadblock instead. */
export function roadblockChance(distanceMeters, wanted) {
  if (wholeOrZero(distanceMeters) < ROADBLOCK_MIN_DISTANCE) return 0;
  return 0.06 * (stars(wanted) - 1);
}

/** Score for wrecking a cruiser into traffic. */
export function policeWreckPoints(wanted) {
  return 50 * stars(wanted);
}

/** Cost of the next level of an upgrade, or null when it's maxed/unknown. */
export function upgradeCost(key, currentLevel) {
  const def = UPGRADES[key];
  if (!def) return null;
  const lvl = level(currentLevel, def.maxLevel);
  if (lvl >= def.maxLevel) return null;
  return Math.round(def.baseCost * def.growth ** lvl);
}

/** Whether the next level of an upgrade is affordable. */
export function canBuy(key, currentLevel, tokens) {
  const cost = upgradeCost(key, currentLevel);
  return cost !== null && tokens >= cost;
}

/** Most lanes a traffic row may block at a given distance (never all). */
export function maxBlockedLanes(distanceMeters) {
  if (distanceMeters >= 1500) return LANES - 1;
  if (distanceMeters >= 400) return 2;
  return 1;
}

/**
 * Screen-space gap between traffic-row fronts: shrinks with distance down
 * to a floor. The floor leaves room, after the longest vehicle and the bus
 * itself (BUS_LENGTH), for one unupgraded lane change at top speed — the
 * move pickBlockedLanes may require between two rows.
 */
export const BUS_LENGTH = 88;
export const ROW_SPACING_MAX = 460;
export const ROW_SPACING_MIN = 360;
export function rowSpacingPx(distanceMeters) {
  const d = Number.isFinite(distanceMeters) && distanceMeters > 0 ? distanceMeters : 0;
  return Math.max(ROW_SPACING_MIN, ROW_SPACING_MAX - d / 10);
}

// ---------------------------------------------------------------------------
// Spills — cargo that slips out of the back of trucks: bananas from trucks
// and semis, garbage from garbage trucks.
// ---------------------------------------------------------------------------

/** Per spill kind: chance a truck carrying it leaks, and most it drops. */
export const SPILLS = {
  banana: { chance: 0.6, max: 2 },
  garbage: { chance: 0.8, max: 3 },
};

/**
 * Screen y range (px, the truck's rear) where spills may drop. The floor
 * keeps every spill high enough up the screen to be seen and dodged; a
 * dropped spill lies still, so it then scrolls down at the bus's speed.
 */
export const BANANA_DROP_MIN_Y = 20;
export const BANANA_DROP_MAX_Y = 220;

/** Garbage: how long it slows the bus, and the top-speed factor meanwhile. */
export const GARBAGE_SLOW_SECONDS = 5.5;
export const GARBAGE_SPEED_FACTOR = 0.5;

/** Seconds the bus skids (steering locked) after running over a banana. */
export const SKID_SECONDS = 0.5;

/**
 * The rear-y positions at which one vehicle drops its spill, sorted: none
 * for a vehicle without `spills` or a non-leaky one, otherwise 1..max of
 * that spill kind within [BANANA_DROP_MIN_Y, BANANA_DROP_MAX_Y].
 */
export function spillDrops(rng, vehicle) {
  const spec = vehicle && SPILLS[vehicle.spills];
  if (!spec || rng() >= spec.chance) return [];
  const count = 1 + Math.floor(rng() * spec.max);
  return Array.from({ length: count }, () => BANANA_DROP_MIN_Y + rng() * (BANANA_DROP_MAX_Y - BANANA_DROP_MIN_Y))
    .sort((a, b) => a - b);
}

/** Lane a banana skid throws the bus into: one over, at random, inward at the edges. */
export function skidLane(lane, rng) {
  if (lane <= 0) return 1;
  if (lane >= LANES - 1) return LANES - 2;
  return lane + (rng() < 0.5 ? -1 : 1);
}

/** Clear space kept between a fare's edge and any vehicle, px. */
export const FARE_CLEARANCE = 10;

/**
 * Where a fare sits behind a traffic row: a y offset in px (negative = up
 * the screen) from the row's front bumpers. It's centred in the clear gap
 * between the tail of whatever blocks its lane in this row (`blockerLength`,
 * 0 for an open lane) and the front of the next row, one spacing further
 * up. Traffic and fares scroll at the same speed, so clear at spawn means
 * clear all the way down the screen.
 */
export function fareOffset(spacingPx, blockerLength, radius) {
  const nearest = -(blockerLength + radius + FARE_CLEARANCE);
  const farthest = -(spacingPx - radius - FARE_CLEARANCE);
  return (nearest + farthest) / 2;
}

/**
 * Chooses which lanes the next traffic row blocks. `closed` lanes (a
 * construction zone) get no vehicle and never count as open. Guarantees:
 *   - at least one lane stays open, and
 *   - when prevOpen is given, at least one new open lane is the same as or
 *     next to a previous open lane, so the bus is never asked to cross
 *     the whole road between two rows.
 * `rng` returns [0, 1), e.g. Math.random. Returns blocked lanes, sorted.
 */
export function pickBlockedLanes(rng, distanceMeters, prevOpen, closed = []) {
  const usable = [...Array(LANES).keys()].filter((l) => !closed.includes(l));
  const cap = maxBlockedLanes(distanceMeters);
  const count = 1 + Math.floor(rng() * cap);
  const reachable = new Set();
  (prevOpen && prevOpen.length ? prevOpen : usable).forEach((lane) => {
    [lane - 1, lane, lane + 1].forEach((l) => { if (usable.includes(l)) reachable.add(l); });
  });
  const reachableList = reachable.size ? [...reachable] : usable;
  const keepOpen = reachableList[Math.floor(rng() * reachableList.length)];

  const candidates = usable.filter((l) => l !== keepOpen);
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  return candidates.slice(0, Math.min(count, usable.length - 1)).sort((a, b) => a - b);
}

/**
 * Lives left after a collision. A lethal vehicle (truck, semi) takes them
 * all; anything else takes one, unless the bus is still in its post-hit
 * grace window. Lethal vehicles ignore grace — a flashing bus still can't
 * survive a truck.
 */
export function livesAfterHit(lives, vehicle, graceSeconds) {
  if (vehicle && vehicle.lethal) return 0;
  if (graceSeconds > 0) return lives;
  return Math.max(0, lives - 1);
}

/** Lanes neither `blocked` by traffic nor `closed` by a construction zone. */
export function openLanes(blocked, closed = []) {
  return [...Array(LANES).keys()].filter((l) => !blocked.includes(l) && !closed.includes(l));
}

/**
 * Picks a vehicle kind by `weight`, unlocking bigger ones as distance grows.
 * Dump trucks (`construction`) are only in the pool while a construction
 * zone is on the road.
 */
export function pickVehicle(rng, distanceMeters, { construction = false } = {}) {
  const pool = VEHICLES.filter((v) => distanceMeters >= v.minDistance && (construction || !v.construction));
  const total = pool.reduce((sum, v) => sum + (v.weight ?? 1), 0);
  let roll = rng() * total;
  for (const v of pool) {
    roll -= v.weight ?? 1;
    if (roll < 0) return v;
  }
  return pool[pool.length - 1];
}

/** Axis-aligned rectangle overlap ({x, y, w, h}); touching edges don't count. */
export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

// ---------------------------------------------------------------------------
// Fuel tankers — a crash stuns the bus, then the tanker blows.
// ---------------------------------------------------------------------------

/** Seconds the bus is stunned (frozen, no steering) after hitting a tanker. */
export const FUEL_STUN_SECONDS = 10;
/** Seconds after the stun to steer clear before the tanker explodes. */
export const FUEL_FUSE_SECONDS = 2;
/**
 * Blast radius (px, centre to centre). Sized so that after a head-on crash
 * one lane over is still caught but two lanes over is clear — and two lane
 * changes always fit inside FUEL_FUSE_SECONDS (a unit test checks both).
 */
export const FUEL_BLAST_RADIUS = 180;
/** Score for steering clear of a tanker blast. */
export const TANKER_ESCAPE_POINTS = 300;

/** Hazmat trucks: a longer stun and a longer fuse than a tanker. */
export const HAZMAT_STUN_SECONDS = 20;
export const HAZMAT_FUSE_SECONDS = 4;

/** Whether a newly spawned vehicle of `kind` carries gasoline (its `hazmatChance`). */
export function isHazmat(rng, kind) {
  return Boolean(kind && kind.hazmatChance) && rng() < kind.hazmatChance;
}

/** Whether touching `v` starts a stun-then-explode crash instead of a normal hit. */
export function explosive(v) {
  return Boolean(v && (v.fuel || v.hazmat));
}

/** How long a crash into an explosive vehicle stuns the bus, and the fuse after it. */
export function crashTimings(v) {
  return v && v.hazmat
    ? { stun: HAZMAT_STUN_SECONDS, fuse: HAZMAT_FUSE_SECONDS }
    : { stun: FUEL_STUN_SECONDS, fuse: FUEL_FUSE_SECONDS };
}

/** Whether a bus centre offset (dx, dy) px from the tanker's centre is inside the blast. */
export function inBlast(dx, dy) {
  return Math.hypot(dx, dy) < FUEL_BLAST_RADIUS;
}

// ---------------------------------------------------------------------------
// Ram Plating, SWAT vans and the police helicopter.
// ---------------------------------------------------------------------------

/** Armoured pursuer: shoves ordinary traffic aside instead of wrecking on it. */
export const SWAT_VAN = { kind: 'swat', label: 'SWAT van', length: 84, width: 58, police: true, swat: true, lethal: true };
export const SWAT_MIN_WANTED = 4;
export const HELICOPTER_WANTED = 5;

/** SWAT vans chasing at once: one from SWAT_MIN_WANTED stars. */
export function maxSwat(wanted) {
  return stars(wanted) >= SWAT_MIN_WANTED ? 1 : 0;
}

/** The helicopter (and its spike strips) only joins at five stars. */
export function helicopterActive(wanted) {
  return stars(wanted) >= HELICOPTER_WANTED;
}

/** Seconds between the helicopter's spike-strip drops. */
export const SPIKE_DROP_SECONDS = 4.5;
/**
 * How far ahead of the bus's nose (px) a spike strip lands — far enough
 * that at the fastest possible speed there's still time to change lane.
 */
export const SPIKE_LEAD_PX = 300;
/** A spike strip is a non-lethal hazard: it costs one life (grace applies). */
export const SPIKES = { kind: 'spikes', label: 'spike strip' };

/**
 * What ramming a police vehicle does at a Ram Plating level: null means the
 * usual Busted; otherwise the target is wrecked and the bus loses
 * `lifeCost` lives (still subject to post-hit grace).
 *   Lv1 — cruisers wreck, costing a life.  Lv2 — cruisers wreck for free.
 *   Lv3 — SWAT vans wreck too, costing a life.
 */
export function ramOutcome(ramLevel, target) {
  const lvl = level(ramLevel, UPGRADES.ram.maxLevel);
  if (!target || !target.police) return null;
  if (target.swat) return lvl >= 3 ? { lifeCost: 1 } : null;
  if (lvl >= 2) return { lifeCost: 0 };
  if (lvl >= 1) return { lifeCost: 1 };
  return null;
}

// ---------------------------------------------------------------------------
// Power-ups — occasionally a fare spot holds one instead.
// ---------------------------------------------------------------------------

/**
 * nitro: instant top speed and pursuers shoved back NITRO_PUSH_PX.
 * shield: absorbs the next collision (not a fuel tanker) within `seconds`.
 * magnet: pulls fares within MAGNET_RADIUS for `seconds`.
 * emp: wrecks every pursuer and grounds the helicopter for `seconds`.
 */
export const POWERUPS = {
  nitro: { label: 'Nitro', seconds: 0 },
  shield: { label: 'Shield', seconds: 10 },
  magnet: { label: 'Magnet', seconds: 8 },
  emp: { label: 'EMP', seconds: 6 },
};
export const POWERUP_CHANCE = 0.12;
export const POWERUP_MIN_DISTANCE = 100;
export const NITRO_PUSH_PX = 300;
export const MAGNET_RADIUS = 170;

/** The power-up (a POWERUPS key) a fare spot holds instead of a fare, or null. */
export function powerupAt(rng, distanceMeters) {
  if (wholeOrZero(distanceMeters) < POWERUP_MIN_DISTANCE || rng() >= POWERUP_CHANCE) return null;
  const keys = Object.keys(POWERUPS);
  return keys[Math.floor(rng() * keys.length)];
}

/**
 * Whether an active shield absorbs a collision with `thing` — everything
 * but something explosive (a tanker or a hazmat truck) or an MRT train.
 */
export function shieldAbsorbs(thing) {
  return !(explosive(thing) || (thing && thing.train));
}

// ---------------------------------------------------------------------------
// Road hazards: potholes, jaywalkers, construction zones.
// ---------------------------------------------------------------------------

/** Potholes: chance per traffic row; one drops the bus to the district's speed floor. */
export const POTHOLE_CHANCE = 0.15;
export const POTHOLE_MIN_DISTANCE = 200;

/** Jaywalkers: chance per traffic row, walking speed in px/s. A hit costs one life. */
export const PEDESTRIAN_CHANCE = 0.18;
export const PEDESTRIAN_MIN_DISTANCE = 100;
export const PEDESTRIAN_SPEED = 38;
export const PEDESTRIAN = { kind: 'pedestrian', label: 'pedestrian' };

/** Sand drifts blown across Sentosa's road: chance per row; one slows the bus like garbage. */
export const SAND_CHANCE = 0.22;
export const SAND_SLOW_SECONDS = 2.5;

/** Sand drifts only turn up on Sentosa. */
export function sandAllowed(levelIndex) {
  return LEVELS[level(levelIndex, LEVELS.length - 1)] === 'Sentosa';
}

/** Nobody jaywalks across an expressway. */
export function pedestriansAllowed(levelIndex) {
  return LEVELS[level(levelIndex, LEVELS.length - 1)] !== 'Expressway';
}

/**
 * Construction zones close one edge lane for CONSTRUCTION_LENGTH px of road
 * (world-stationary, like a spill). While one is on the road its lane gets
 * no traffic (pickBlockedLanes' `closed`) and dump trucks join the traffic.
 * Touching the barriers costs one life and shoves the bus a lane inward.
 */
export const CONSTRUCTION_MIN_DISTANCE = CONSTRUCTION_MIN_DISTANCE_M;
export const CONSTRUCTION_CHANCE = 0.05;
export const CONSTRUCTION_LENGTH = 720;
export const BARRIER = { kind: 'barrier', label: 'roadworks barrier' };

/** Which lane a new zone closes: an edge lane, at random. */
export function constructionLane(rng) {
  return rng() < 0.5 ? 0 : LANES - 1;
}

/** The lane a bus bounced off a zone in `lane` lands in: one lane inward. */
export function zonePushLane(lane) {
  return lane <= 0 ? 1 : lane >= LANES - 1 ? LANES - 2 : lane;
}

// ---------------------------------------------------------------------------
// Weather — storms roll in now and then: wet roads and puddles.
// ---------------------------------------------------------------------------

/**
 * A storm can start on any traffic row from STORM_MIN_DISTANCE while the
 * sky is clear, and lasts STORM_SECONDS. While it rains, accelerating and
 * braking work at WET_GRIP, and puddles (PUDDLE_CHANCE per row) splash the
 * windscreen for SPLASH_SECONDS. Steering is untouched on purpose: a slower
 * lane change would break the row-spacing guarantee.
 */
export const STORM_MIN_DISTANCE = 400;
export const STORM_CHANCE = 0.035;
export const STORM_SECONDS = 25;
export const WET_GRIP = 0.6;
export const PUDDLE_CHANCE = 0.3;
export const SPLASH_SECONDS = 1.4;

/** Whether a storm starts on this row. */
export function stormStarts(rng, distanceMeters, raining) {
  if (raining || wholeOrZero(distanceMeters) < STORM_MIN_DISTANCE) return false;
  return rng() < STORM_CHANCE;
}

// ---------------------------------------------------------------------------
// Cement mixers — shove one over onto the police, or get flattened by it.
// ---------------------------------------------------------------------------

/**
 * Slack (px) on the vertical overlap that counts as "alongside" for a shove.
 * TIP_SECONDS is game time from the shove to the mixer landing in the bus's
 * lane, all played at TIP_SLOWMO; a lane change must fit inside it.
 */
export const SHOVE_REACH_PX = 20;
export const TIP_SECONDS = 1;
export const TIP_SLOWMO = 0.3;
export const MIXER_TOPPLE_POINTS = 500;

/**
 * The lane a bus alongside a mixer could escape to once it starts tipping
 * into the bus's lane — one further away from the mixer — or null at the
 * road edge, where there's no way out.
 */
export function escapeLane(busLane, mixerLane) {
  const lane = busLane + Math.sign(busLane - mixerLane);
  return lane >= 0 && lane < LANES && lane !== busLane ? lane : null;
}

/**
 * Whether the bus (lane, top/bottom y) can shove a mixer (lane, top/bottom
 * y): one lane over, overlapping it top to bottom (with SHOVE_REACH_PX
 * slack), and with an escape lane on the far side.
 */
export function canShove(busLane, busTop, busBottom, mixerLane, mixerTop, mixerBottom) {
  if (Math.abs(busLane - mixerLane) !== 1 || escapeLane(busLane, mixerLane) === null) return false;
  return busTop < mixerBottom + SHOVE_REACH_PX && mixerTop - SHOVE_REACH_PX < busBottom;
}

// ---------------------------------------------------------------------------
// The elevated MRT track, reached off a ramp truck parked on the shoulder.
// ---------------------------------------------------------------------------

/** Ramp trucks park in an edge lane (like a construction zone, which they never share the road with). */
export const RAMP_MIN_DISTANCE = 400;
export const RAMP_CHANCE = 0.05;
export const RAMP_TRUCK = { kind: 'ramp', label: 'ramp truck', length: 120, width: 60 };

/** Seconds the bus may stay up on the track before it drops back to the road. */
export const TRACK_SECONDS = 50;

/**
 * Two tracks: 0 runs up the screen (trains overtake the bus from behind,
 * UP_TRAIN_OVERTAKE m/s faster), 1 runs down (oncoming, at TRAIN_SPEED on
 * top of the bus's own). Only one train is ever on the viaduct at a time,
 * announced TRAIN_WARNING_SECONDS ahead, so the other track is always safe.
 * A train is lethal — even a shield won't stop one.
 */
export const TRACKS = 2;
export const TRAIN_SPEED = 18;
export const UP_TRAIN_OVERTAKE = 25;
export const TRAIN_LENGTH = 330;
export const TRAIN_WARNING_SECONDS = 1.2;
export const TRAIN_GAP_SECONDS = [1.5, 4];
export const TRAIN = { kind: 'train', label: 'MRT train', train: true, lethal: true };

/** Which track the next train runs on. */
export function nextTrainTrack(rng) {
  return rng() < 0.5 ? 0 : 1;
}

/** Seconds of quiet before the next train's warning. */
export function trainGapSeconds(rng) {
  return TRAIN_GAP_SECONDS[0] + rng() * (TRAIN_GAP_SECONDS[1] - TRAIN_GAP_SECONDS[0]);
}

/**
 * How fast (m/s) a train on `track` moves down the screen relative to the
 * bus: an oncoming one closes at the bus's speed plus its own; an up train
 * is always overtaking, so it moves up the screen (negative).
 */
export function trainClosingSpeed(track, busSpeed) {
  return track === 1 ? busSpeed + TRAIN_SPEED : -UP_TRAIN_OVERTAKE;
}

// ---------------------------------------------------------------------------
// Daily Challenge — one seeded road per (UTC) day, the stock bus, its own board.
// ---------------------------------------------------------------------------

/** The bus every daily run drives (with no upgrades), so the board is fair. */
export const DAILY_BUS = 'single';

/** Deterministic [0, 1) PRNG (mulberry32). */
export function seededRng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The challenge's date, YYYY-MM-DD in UTC — the server checks it the same way. */
export function dailyDate(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

/** A day's road seed: an FNV-1a hash of its date string. */
export function dailySeed(date) {
  let h = 0x811c9dc5;
  for (const ch of String(date)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// ---------------------------------------------------------------------------
// Missions (three active at a time, paid when done) and achievements.
// ---------------------------------------------------------------------------

/**
 * Per-run missions. `stat` names a field of the run's stats (see
 * bus-rush.js's runStats); `level` and `wanted` are the highest reached.
 * `needs` lists upgrades a mission needs before it can be offered.
 */
export const MISSIONS = {
  fares30: { label: 'Collect 30 fares in one run', stat: 'fares', target: 30, reward: 15 },
  wreck3: { label: 'Wreck 3 police cars in one run', stat: 'wrecked', target: 3, reward: 20 },
  distance1500: { label: 'Drive 1,500 m in one run', stat: 'distance', target: 1500, reward: 15 },
  expressway: { label: 'Reach the Expressway', stat: 'level', target: 3, reward: 20 },
  powerups3: { label: 'Grab 3 power-ups in one run', stat: 'powerups', target: 3, reward: 10 },
  tanker: { label: 'Escape a fuel tanker blast', stat: 'tankerEscapes', target: 1, reward: 25 },
  ram2: { label: 'Ram 2 police cars in one run', stat: 'rammed', target: 2, reward: 20, needs: ['ram'] },
  clean600: { label: 'Drive 600 m without a scratch', stat: 'cleanStretch', target: 600, reward: 15 },
  wanted4: { label: 'Reach a 4-star wanted level', stat: 'wanted', target: 4, reward: 15 },
  track: { label: 'Ride the MRT track', stat: 'trackRides', target: 1, reward: 20 },
  mixer: { label: 'Topple a cement mixer onto the police', stat: 'mixerTopples', target: 1, reward: 25 },
  sentosa: { label: 'Reach Sentosa', stat: 'level', target: 6, reward: 30 },
};
export const ACTIVE_MISSIONS = 3;

/** Progress toward a mission, 0..target. */
export function missionProgress(key, stats) {
  const m = MISSIONS[key];
  if (!m || !stats) return 0;
  return Math.min(m.target, wholeOrZero(stats[m.stat]));
}

export function missionDone(key, stats) {
  return Boolean(MISSIONS[key]) && missionProgress(key, stats) >= MISSIONS[key].target;
}

/**
 * Tops `active` back up to ACTIVE_MISSIONS distinct missions, keeping the
 * valid ones in order. New picks skip `exclude` (just completed) when the
 * pool allows, and missions whose `needs` upgrades are still at level 0.
 */
export function refillMissions(rng, active, upgrades = {}, exclude = []) {
  const kept = (Array.isArray(active) ? active : [])
    .filter((k, i, arr) => MISSIONS[k] && arr.indexOf(k) === i)
    .slice(0, ACTIVE_MISSIONS);
  const eligible = Object.keys(MISSIONS).filter((k) => !kept.includes(k)
    && (MISSIONS[k].needs || []).every((u) => (upgrades[u] || 0) > 0));
  const fresh = eligible.filter((k) => !exclude.includes(k));
  const pool = fresh.length >= ACTIVE_MISSIONS - kept.length ? fresh : eligible;
  while (kept.length < ACTIVE_MISSIONS && pool.length) {
    kept.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return kept;
}

/**
 * One-time achievements. `scope` 'run' checks one run's stats, 'lifetime'
 * the running totals (addLifetime). Each pays `reward` tokens once.
 */
export const ACHIEVEMENTS = {
  joyrider: { label: 'Joyrider', desc: 'Finish your first run', scope: 'lifetime', stat: 'runs', target: 1, reward: 5 },
  copBait: { label: 'Cop Bait', desc: 'Wreck 25 police cars', scope: 'lifetime', stat: 'wrecked', target: 25, reward: 40 },
  fareCollector: { label: 'Fare Collector', desc: 'Collect 500 fares', scope: 'lifetime', stat: 'fares', target: 500, reward: 50 },
  marathon: { label: 'Marathon', desc: 'Drive 10,000 m in total', scope: 'lifetime', stat: 'distance', target: 10000, reward: 40 },
  demolition: { label: 'Demolition Driver', desc: 'Ram 10 police cars', scope: 'lifetime', stat: 'rammed', target: 10, reward: 40 },
  islandHopper: { label: 'Island Hopper', desc: 'Reach Changi in one run', scope: 'run', stat: 'level', target: 5, reward: 50 },
  mostWanted: { label: 'Most Wanted', desc: 'Hit a 5-star wanted level', scope: 'run', stat: 'wanted', target: 5, reward: 30 },
  tooClose: { label: 'Too Close for Comfort', desc: 'Escape a fuel tanker blast', scope: 'run', stat: 'tankerEscapes', target: 1, reward: 20 },
  wasted: { label: 'Scenic Route', desc: 'Get flung to Alcatraz', scope: 'run', stat: 'wasted', target: 1, reward: 10 },
  beachBum: { label: 'Beach Bum', desc: 'Reach Sentosa in one run', scope: 'run', stat: 'level', target: 6, reward: 60 },
  skyRail: { label: 'Sky Rail', desc: 'Ride the MRT track', scope: 'run', stat: 'trackRides', target: 1, reward: 20 },
  pourDecision: { label: 'Pour Decision', desc: 'Topple a cement mixer onto the police', scope: 'run', stat: 'mixerTopples', target: 1, reward: 25 },
  pancake: { label: 'Pancake Day', desc: 'Get flattened by a cement mixer', scope: 'run', stat: 'pancaked', target: 1, reward: 10 },
  stormChaser: { label: 'Storm Chaser', desc: 'Drive through a storm', scope: 'run', stat: 'storms', target: 1, reward: 15 },
};

/** Lifetime totals after one more run. */
export function addLifetime(lifetime, stats) {
  const base = lifetime || {};
  const s = stats || {};
  return {
    runs: wholeOrZero(base.runs) + 1,
    wrecked: wholeOrZero(base.wrecked) + wholeOrZero(s.wrecked),
    fares: wholeOrZero(base.fares) + wholeOrZero(s.fares),
    distance: wholeOrZero(base.distance) + wholeOrZero(s.distance),
    rammed: wholeOrZero(base.rammed) + wholeOrZero(s.rammed),
  };
}

/** Achievement keys newly earned by a run (not already in `unlocked`). */
export function newAchievements(unlocked, stats, lifetime) {
  const have = new Set(Array.isArray(unlocked) ? unlocked : []);
  return Object.entries(ACHIEVEMENTS)
    .filter(([key, a]) => !have.has(key)
      && wholeOrZero(((a.scope === 'run' ? stats : lifetime) || {})[a.stat]) >= a.target)
    .map(([key]) => key);
}
