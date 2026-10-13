import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  LANES,
  MIN_SPEED,
  BASE_MAX_SPEED,
  ENGINE_SPEED_STEP,
  UPGRADES,
  VEHICLES,
  BUS_LENGTH,
  PX_PER_METER,
  TRAFFIC_SPEED,
  ROW_SPACING_MAX,
  ROW_SPACING_MIN,
  SCORE_MAX,
  maxSpeed,
  stepSpeed,
  toKmh,
  laneChangeSeconds,
  maxLives,
  fareValue,
  runScore,
  runTokens,
  upgradeCost,
  canBuy,
  maxBlockedLanes,
  rowSpacingPx,
  pickBlockedLanes,
  openLanes,
  pickVehicle,
  rectsOverlap,
  livesAfterHit,
  WANTED_MAX,
  WRECK_TOKENS,
  POLICE_CAR,
  wantedLevel,
  policeSpeed,
  maxPolice,
  policeReactionSeconds,
  roadblockChance,
  policeWreckPoints,
  LEVELS,
  LEVEL_DISTANCE,
  levelAt,
  checkpointPoints,
  minSpeed,
  FARE_CLEARANCE,
  fareOffset,
  BANANA_DROP_MIN_Y,
  BANANA_DROP_MAX_Y,
  spillDrops,
  skidLane,
  SPILLS,
  BUSES,
  busDef,
  slowedTopSpeed,
  GARBAGE_SPEED_FACTOR,
  FUEL_STUN_SECONDS,
  FUEL_FUSE_SECONDS,
  inBlast,
  ramOutcome,
  SWAT_VAN,
  maxSwat,
  helicopterActive,
  SPIKE_LEAD_PX,
  POWERUPS,
  powerupAt,
  shieldAbsorbs,
  pedestriansAllowed,
  constructionLane,
  zonePushLane,
  MISSIONS,
  ACTIVE_MISSIONS,
  missionProgress,
  missionDone,
  refillMissions,
  ACHIEVEMENTS,
  addLifetime,
  newAchievements,
  HAZMAT_STUN_SECONDS,
  HAZMAT_FUSE_SECONDS,
  isHazmat,
  explosive,
  crashTimings,
  sandAllowed,
  WET_GRIP,
  stormStarts,
  STORM_MIN_DISTANCE,
  TIP_SECONDS,
  escapeLane,
  canDrift,
  MIXER_BRAKE_SECONDS,
  TRACK_SECONDS,
  TRAIN,
  TRAIN_WARNING_SECONDS,
  TRAIN_SPEED,
  TRAIN_LENGTH,
  nextTrainTrack,
  trainGapSeconds,
  trainClosingSpeed,
  RAMP_TRUCK,
  seededRng,
  dailyDate,
  dailySeed,
  DAILY_BUS,
  HEAVY_LIVES_LEFT,
  FLATBED_LOADS,
  flatbedLoad,
  isRunaway,
  runawayLane,
  RUNAWAY_MIN_DISTANCE,
  RUNAWAY_VEER_Y,
  RUNAWAY_VEER_SECONDS,
} from './rules.js';

// Small deterministic PRNG so the property-style tests below are repeatable.
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe('speed', () => {
  test('engine raises top speed by a fixed step and caps at max level', () => {
    assert.equal(maxSpeed(0), BASE_MAX_SPEED);
    assert.equal(maxSpeed(2), BASE_MAX_SPEED + 2 * ENGINE_SPEED_STEP);
    assert.equal(maxSpeed(99), maxSpeed(UPGRADES.engine.maxLevel));
    assert.equal(maxSpeed(-1), BASE_MAX_SPEED);
  });

  test('accelerate speeds up, brake slows down, neither holds', () => {
    assert.ok(stepSpeed(10, { accelerate: true }, 0.1, 0) > 10);
    assert.ok(stepSpeed(12, { brake: true }, 0.1, 0) < 12);
    assert.equal(stepSpeed(12, {}, 0.1, 0), 12);
  });

  test('brake wins when both are held', () => {
    assert.ok(stepSpeed(12, { accelerate: true, brake: true }, 0.1, 0) < 12);
  });

  test('speed is clamped to [MIN_SPEED, maxSpeed(engine)]', () => {
    assert.equal(stepSpeed(MIN_SPEED, { brake: true }, 10, 0), MIN_SPEED);
    assert.equal(stepSpeed(BASE_MAX_SPEED, { accelerate: true }, 10, 0), BASE_MAX_SPEED);
    assert.equal(stepSpeed(1000, {}, 0.1, 0), BASE_MAX_SPEED);
    assert.equal(stepSpeed(NaN, {}, 0.1, 0), MIN_SPEED);
  });

  test('toKmh converts m/s to whole km/h', () => {
    assert.equal(toKmh(10), 36);
  });
});

describe('upgrade effects', () => {
  test('steering shortens lane changes but never below 0.1s (single-decker)', () => {
    assert.ok(laneChangeSeconds(1) < laneChangeSeconds(0));
    assert.ok(laneChangeSeconds(99) >= 0.1);
  });

  test('bumpers add a life per level', () => {
    assert.equal(maxLives(0), 3);
    assert.equal(maxLives(2), 5);
    assert.equal(maxLives(99), 3 + UPGRADES.bumpers.maxLevel);
  });

  test('fare box adds a token per fare per level', () => {
    assert.equal(fareValue(0), 1);
    assert.equal(fareValue(3), 4);
  });
});

describe('scoring', () => {
  test('score is whole distance plus 25 per fare, capped', () => {
    assert.equal(runScore(1234.9, 2), 1284);
    assert.equal(runScore(-5, -1), 0);
    assert.equal(runScore(10_000_000, 0), SCORE_MAX);
  });

  test('tokens are fares × fare value plus one per 100 m', () => {
    assert.equal(runTokens(450, 3, 0), 3 + 4);
    assert.equal(runTokens(450, 3, 2), 9 + 4);
    assert.equal(runTokens(0, 0, 0), 0);
  });

  test('wrecked police add score and tokens', () => {
    assert.equal(runScore(100, 0, 150), 250);
    assert.equal(runTokens(0, 0, 0, 3), 3 * WRECK_TOKENS);
    assert.equal(runScore(100, 0, -50), 100);
  });
});

describe('police pursuit', () => {
  test('wanted level starts at one star, rises with distance and fares, caps', () => {
    assert.equal(wantedLevel(0, 0), 1);
    assert.ok(wantedLevel(1200, 0) > wantedLevel(0, 0));
    assert.ok(wantedLevel(0, 10) > wantedLevel(0, 0));
    assert.equal(wantedLevel(1e7, 1e7), WANTED_MAX);
    assert.equal(wantedLevel(NaN, -3), 1);
  });

  test('more stars mean faster, more numerous, quicker-reacting police', () => {
    for (let w = 2; w <= WANTED_MAX; w++) {
      assert.ok(policeSpeed(w) > policeSpeed(w - 1));
      assert.ok(maxPolice(w) >= maxPolice(w - 1));
      assert.ok(policeReactionSeconds(w) < policeReactionSeconds(w - 1));
      assert.ok(policeWreckPoints(w) > policeWreckPoints(w - 1));
    }
    assert.ok(policeReactionSeconds(WANTED_MAX) > 0);
  });

  test('a stock bus at full throttle outruns police at any star, in any level', () => {
    for (let lvl = 0; lvl < LEVELS.length; lvl++) {
      for (let w = 1; w <= WANTED_MAX; w++) {
        assert.ok(policeSpeed(w, lvl) < maxSpeed(0, lvl), `stock bus outruns ${w}★ in level ${lvl + 1}`);
        assert.ok(policeSpeed(w, lvl) > minSpeed(lvl), `${w}★ catches a bus at the floor in level ${lvl + 1}`);
      }
    }
  });

  test('roadblocks need distance and heat', () => {
    assert.equal(roadblockChance(100, WANTED_MAX), 0);
    assert.equal(roadblockChance(5000, 1), 0);
    assert.ok(roadblockChance(5000, WANTED_MAX) > 0 && roadblockChance(5000, WANTED_MAX) < 0.5);
  });

  test('police cars are lethal and fit the row spacing', () => {
    assert.equal(livesAfterHit(3, POLICE_CAR, 0), 0);
    assert.equal(livesAfterHit(3, POLICE_CAR, 1), 0);
    assert.ok(POLICE_CAR.length <= Math.max(...VEHICLES.map((v) => v.length)));
  });
});

describe('shop', () => {
  test('cost grows with level and is null at max level', () => {
    for (const key of Object.keys(UPGRADES)) {
      const max = UPGRADES[key].maxLevel;
      for (let lvl = 1; lvl < max; lvl++) {
        assert.ok(upgradeCost(key, lvl) > upgradeCost(key, lvl - 1), `${key} level ${lvl}`);
      }
      assert.equal(upgradeCost(key, max), null);
    }
    assert.equal(upgradeCost('nope', 0), null);
  });

  test('canBuy needs enough tokens and an unmaxed upgrade', () => {
    const cost = upgradeCost('engine', 0);
    assert.equal(canBuy('engine', 0, cost), true);
    assert.equal(canBuy('engine', 0, cost - 1), false);
    assert.equal(canBuy('engine', UPGRADES.engine.maxLevel, 1e9), false);
  });
});

describe('traffic', () => {
  test('rows get denser with distance but never block every lane', () => {
    assert.equal(maxBlockedLanes(0), 1);
    assert.ok(maxBlockedLanes(5000) <= LANES - 1);
    assert.equal(rowSpacingPx(0), ROW_SPACING_MAX);
    assert.ok(rowSpacingPx(600) < ROW_SPACING_MAX);
    assert.equal(rowSpacingPx(1e7), ROW_SPACING_MIN);
  });

  test('pickBlockedLanes always leaves a lane open that is reachable from the previous row', () => {
    const rng = seeded(42);
    let prevOpen = null;
    for (let i = 0; i < 5000; i++) {
      const distance = i * 3;
      const blocked = pickBlockedLanes(rng, distance, prevOpen);
      assert.ok(blocked.length >= 1 && blocked.length <= maxBlockedLanes(distance));
      assert.equal(new Set(blocked).size, blocked.length, 'no duplicate lanes');
      blocked.forEach((l) => assert.ok(l >= 0 && l < LANES));
      const open = openLanes(blocked);
      assert.ok(open.length >= 1);
      if (prevOpen) {
        assert.ok(
          open.some((l) => prevOpen.some((p) => Math.abs(p - l) <= 1)),
          `row ${i}: open ${open} unreachable from ${prevOpen}`,
        );
      }
      prevOpen = open;
    }
  });

  test('the minimum row spacing leaves room for one lane change at top speed, for every bus', () => {
    const longest = Math.max(...VEHICLES.map((v) => v.length));
    const topRelativePxPerSec = (maxSpeed(UPGRADES.engine.maxLevel, LEVELS.length - 1) + TRAFFIC_SPEED) * PX_PER_METER;
    for (const [key, bus] of Object.entries(BUSES)) {
      assert.ok(bus.length <= BUS_LENGTH, `${key} fits BUS_LENGTH`);
      const windowSeconds = (ROW_SPACING_MIN - longest - bus.length) / topRelativePxPerSec;
      assert.ok(windowSeconds >= laneChangeSeconds(0, key), `${key}: window ${windowSeconds}s`);
    }
  });

  test('fares never overlap the vehicle in their lane or the next row', () => {
    const radius = 13;
    // The next row's spacing can be a little tighter (spacing shrinks with
    // distance): allow for the distance covered between two rows.
    const shrink = 6;
    for (let spacing = ROW_SPACING_MIN; spacing <= ROW_SPACING_MAX; spacing += 5) {
      for (const len of [0, ...VEHICLES.map((v) => v.length)]) {
        const y = fareOffset(spacing, len, radius);
        assert.ok(y + radius <= -len - FARE_CLEARANCE, `clear of a ${len}px tail at spacing ${spacing}`);
        assert.ok(y - radius >= -(spacing - shrink) + FARE_CLEARANCE / 2, `clear of the next row at spacing ${spacing}`);
      }
    }
  });

  test('bigger vehicles unlock with distance', () => {
    const rng = seeded(7);
    const early = new Set(Array.from({ length: 200 }, () => pickVehicle(rng, 0).kind));
    assert.deepEqual([...early], ['car']);
    const late = new Set(Array.from({ length: 400 }, () => pickVehicle(rng, 5000).kind));
    assert.equal(late.size, VEHICLES.filter((v) => !v.construction).length);
  });

  test('dump trucks only turn up while a construction zone is on the road', () => {
    const rng = seeded(5);
    const plain = Array.from({ length: 2000 }, () => pickVehicle(rng, 5000).kind);
    assert.ok(!plain.includes('dump'));
    const zoned = Array.from({ length: 2000 }, () => pickVehicle(rng, 5000, { construction: true }).kind);
    assert.ok(zoned.includes('dump'));
  });

  test('oncoming buses unlock with distance, cost one life, and never crowd out trucks', () => {
    const buses = VEHICLES.filter((v) => v.bus);
    assert.deepEqual(buses.map((v) => v.kind).sort(), ['bendy', 'citybus', 'doubledecker', 'schoolbus']);
    buses.forEach((v) => {
      assert.ok(!v.lethal && !v.spills, `${v.kind} is a plain obstacle`);
      assert.equal(livesAfterHit(3, v, 0), 2);
    });
    // Late-game traffic: buses are a minority, lethal vehicles still common.
    const rng = seeded(11);
    const picks = Array.from({ length: 5000 }, () => pickVehicle(rng, 5000));
    const share = (f) => picks.filter(f).length / picks.length;
    assert.ok(share((v) => v.bus) < 0.35, `bus share ${share((v) => v.bus)}`);
    assert.ok(share((v) => v.lethal) > 0.35, `lethal share ${share((v) => v.lethal)}`);
    assert.equal(new Set(picks.filter((v) => v.bus).map((v) => v.kind)).size, 4);
  });

  test('trucks, semis, garbage, dump and tow trucks and cement mixers are lethal; cars, vans and tankers are not', () => {
    const lethal = VEHICLES.filter((v) => v.lethal).map((v) => v.kind).sort();
    assert.deepEqual(lethal, ['container', 'dump', 'flatbed', 'garbage', 'mixer', 'reefer', 'semi', 'tow', 'truck']);
    const tanker = VEHICLES.find((v) => v.kind === 'fuel');
    assert.ok(tanker.fuel && !tanker.lethal);
  });

  test('a lethal hit takes every life, even during grace', () => {
    const truck = VEHICLES.find((v) => v.kind === 'truck');
    const semi = VEHICLES.find((v) => v.kind === 'semi');
    assert.equal(livesAfterHit(6, truck, 0), 0);
    assert.equal(livesAfterHit(6, semi, 1.2), 0);
  });

  test('a non-lethal hit takes one life, none during grace', () => {
    const car = VEHICLES.find((v) => v.kind === 'car');
    assert.equal(livesAfterHit(3, car, 0), 2);
    assert.equal(livesAfterHit(3, car, 0.5), 3);
    assert.equal(livesAfterHit(0, car, 0), 0);
  });

  test('rectsOverlap ignores touching edges', () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    assert.equal(rectsOverlap(a, { x: 5, y: 5, w: 10, h: 10 }), true);
    assert.equal(rectsOverlap(a, { x: 10, y: 0, w: 10, h: 10 }), false);
  });
});

describe('levels', () => {
  test('a run moves through every district in order, the last one endless', () => {
    assert.equal(levelAt(0), 0);
    assert.equal(levelAt(LEVEL_DISTANCE - 1), 0);
    assert.equal(levelAt(LEVEL_DISTANCE), 1);
    assert.equal(levelAt(LEVEL_DISTANCE * 99), LEVELS.length - 1);
    assert.equal(levelAt(NaN), 0);
  });

  test('each district starts one wanted star hotter', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      assert.equal(wantedLevel(i * LEVEL_DISTANCE, 0), Math.min(WANTED_MAX, i + 1));
    }
  });

  test('each district is faster: higher speed floor and top speed', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      assert.ok(minSpeed(i) > minSpeed(i - 1));
      assert.ok(maxSpeed(0, i) > maxSpeed(0, i - 1));
      assert.equal(stepSpeed(0, {}, 0.1, 0, i), minSpeed(i));
    }
    assert.equal(minSpeed(99), minSpeed(LEVELS.length - 1));
    assert.equal(maxSpeed(0, 99), maxSpeed(0, LEVELS.length - 1));
    assert.ok(minSpeed(LEVELS.length - 1) < BASE_MAX_SPEED);
  });

  test('checkpoints pay more the deeper the district', () => {
    assert.equal(checkpointPoints(0), 0);
    assert.ok(checkpointPoints(2) > checkpointPoints(1));
  });
});

describe('bananas', () => {
  test('only trucks drop spills, up to their kind\'s max, inside the drop window', () => {
    const rng = seeded(3);
    for (const v of VEHICLES) {
      for (let i = 0; i < 200; i++) {
        const drops = spillDrops(rng, v);
        if (!v.spills) {
          assert.deepEqual(drops, [], `${v.kind} never drops`);
          continue;
        }
        assert.ok(drops.length <= SPILLS[v.spills].max);
        drops.forEach((y) => assert.ok(y >= BANANA_DROP_MIN_Y && y <= BANANA_DROP_MAX_Y));
        assert.deepEqual(drops, [...drops].sort((a, b) => a - b));
      }
    }
    assert.deepEqual(spillDrops(rng, POLICE_CAR), []);
    // Some trucks are leaky and some aren't.
    const truck = VEHICLES.find((v) => v.kind === 'truck');
    const counts = Array.from({ length: 200 }, () => spillDrops(rng, truck).length);
    assert.ok(counts.includes(0) && counts.some((c) => c > 0));
    assert.equal(VEHICLES.find((v) => v.kind === 'garbage').spills, 'garbage');
    assert.equal(truck.spills, 'banana');
  });

  test('a skid always throws the bus exactly one lane, and never off the road', () => {
    const rng = seeded(9);
    for (let lane = 0; lane < LANES; lane++) {
      for (let i = 0; i < 50; i++) {
        const next = skidLane(lane, rng);
        assert.equal(Math.abs(next - lane), 1);
        assert.ok(next >= 0 && next < LANES);
      }
    }
  });
});

describe('garbage', () => {
  test('slowed top speed is half, never below the district floor', () => {
    for (let lvl = 0; lvl < LEVELS.length; lvl++) {
      for (let eng = 0; eng <= UPGRADES.engine.maxLevel; eng++) {
        const slow = slowedTopSpeed(eng, lvl);
        assert.ok(slow >= minSpeed(lvl));
        assert.ok(slow <= maxSpeed(eng, lvl));
        assert.equal(slow, Math.max(minSpeed(lvl), maxSpeed(eng, lvl) * GARBAGE_SPEED_FACTOR));
      }
    }
  });

  test('while slowed, excess speed bleeds off gradually and ↑ cannot exceed the cap', () => {
    const top = maxSpeed(6, 2);
    const cap = slowedTopSpeed(6, 2);
    const next = stepSpeed(top, {}, 0.1, 6, 2, { slowed: true });
    assert.ok(next < top && next > cap, 'drops, but not instantly');
    let v = top;
    for (let i = 0; i < 100; i++) v = stepSpeed(v, { accelerate: true }, 0.05, 6, 2, { slowed: true });
    assert.equal(v, cap);
    assert.equal(stepSpeed(cap, { accelerate: true }, 0.1, 6, 2), Math.min(top, cap + 0.6));
  });
});

describe('buses', () => {
  test('the single-decker is free and the default; unknown keys fall back to it', () => {
    assert.equal(BUSES.single.cost, 0);
    assert.equal(busDef('nope'), BUSES.single);
    assert.equal(busDef('__proto__'), BUSES.single);
  });

  test('each bus changes handling the way its shop row says', () => {
    assert.ok(laneChangeSeconds(0, 'minibus') < laneChangeSeconds(0));
    assert.equal(maxLives(0, 'minibus'), maxLives(0) - 1);
    assert.equal(maxLives(0, 'double'), maxLives(0) + 1);
    assert.ok(stepSpeed(10, { accelerate: true }, 0.1, 0, 0, { accel: BUSES.electric.accel })
      > stepSpeed(10, { accelerate: true }, 0.1, 0, 0));
    assert.ok(stepSpeed(10, { accelerate: true }, 0.1, 0, 0, { accel: BUSES.double.accel })
      < stepSpeed(10, { accelerate: true }, 0.1, 0, 0));
  });

  test('no bus starts with fewer than one life, and none steers slower than the single-decker', () => {
    for (const key of Object.keys(BUSES)) {
      assert.ok(maxLives(0, key) >= 1);
      assert.ok(BUSES[key].steer <= 1);
    }
  });
});

describe('fuel tankers', () => {
  // Centre-to-centre gap after a head-on crash: the tanker's nose just
  // overlapping the bus's (hitboxes are inset 3 px / 6 px).
  const tanker = VEHICLES.find((v) => v.kind === 'fuel');
  const headOnDy = (tanker.length + BUS_LENGTH) / 2 - 9;
  const laneWidth = (480 - 80) / LANES;

  test('stun for 10 s, then 2 s to get clear', () => {
    assert.equal(FUEL_STUN_SECONDS, 10);
    assert.equal(FUEL_FUSE_SECONDS, 2);
  });

  test('one lane over is still caught in the blast; two lanes over is clear', () => {
    assert.ok(inBlast(0, headOnDy));
    assert.ok(inBlast(laneWidth, headOnDy));
    assert.ok(!inBlast(2 * laneWidth, headOnDy));
  });

  test('two lane changes always fit in the fuse, for every bus, from any lane', () => {
    for (const key of Object.keys(BUSES)) {
      assert.ok(2 * laneChangeSeconds(0, key) < FUEL_FUSE_SECONDS, key);
    }
    for (let lane = 0; lane < LANES; lane++) {
      assert.ok([lane - 2, lane + 2].some((l) => l >= 0 && l < LANES), `a lane two away from ${lane}`);
    }
  });

  test('a tanker fits the row spacing guarantee', () => {
    assert.ok(tanker.length <= Math.max(...VEHICLES.map((v) => v.length)));
  });
});

describe('ram plating and bosses', () => {
  test('ram levels: cruisers for a life, then free; SWAT vans only at max', () => {
    const swat = SWAT_VAN;
    assert.equal(ramOutcome(0, POLICE_CAR), null);
    assert.deepEqual(ramOutcome(1, POLICE_CAR), { lifeCost: 1 });
    assert.deepEqual(ramOutcome(2, POLICE_CAR), { lifeCost: 0 });
    assert.equal(ramOutcome(2, swat), null);
    assert.deepEqual(ramOutcome(3, swat), { lifeCost: 1 });
    assert.equal(ramOutcome(3, VEHICLES[0]), null, 'only police can be rammed');
    assert.equal(UPGRADES.ram.maxLevel, 3);
  });

  test('SWAT vans join at four stars, the helicopter at five', () => {
    assert.deepEqual([1, 2, 3, 4, 5].map(maxSwat), [0, 0, 0, 1, 1]);
    assert.deepEqual([1, 2, 3, 4, 5].map(helicopterActive), [false, false, false, false, true]);
    assert.ok(SWAT_VAN.lethal && SWAT_VAN.police && SWAT_VAN.length <= ROW_SPACING_MIN);
  });

  test('a spike strip lands far enough ahead to change lane at the fastest speed', () => {
    const fastest = maxSpeed(UPGRADES.engine.maxLevel, LEVELS.length - 1) * PX_PER_METER;
    assert.ok(SPIKE_LEAD_PX / fastest >= 2 * laneChangeSeconds(0, 'single'));
  });
});

describe('power-ups', () => {
  test('none before 100 m; afterwards an occasional fare spot holds one', () => {
    const rng = seeded(3);
    assert.ok(Array.from({ length: 500 }, () => powerupAt(rng, 50)).every((p) => p === null));
    const picks = Array.from({ length: 4000 }, () => powerupAt(rng, 1000));
    const share = picks.filter(Boolean).length / picks.length;
    assert.ok(share > 0.06 && share < 0.2, `share ${share}`);
    assert.deepEqual(new Set(picks.filter(Boolean)), new Set(Object.keys(POWERUPS)));
  });

  test('a shield absorbs anything but a fuel tanker', () => {
    assert.ok(shieldAbsorbs(POLICE_CAR));
    assert.ok(shieldAbsorbs(VEHICLES.find((v) => v.kind === 'semi')));
    assert.ok(!shieldAbsorbs(VEHICLES.find((v) => v.kind === 'fuel')));
  });
});

describe('road hazards', () => {
  test('nobody jaywalks on the Expressway', () => {
    assert.deepEqual(LEVELS.map((_, i) => pedestriansAllowed(i)), LEVELS.map((name) => name !== 'Expressway'));
    assert.equal(pedestriansAllowed(LEVELS.indexOf('Expressway')), false);
  });

  test('construction zones close an edge lane and push the bus inward', () => {
    const rng = seeded(9);
    const lanes = new Set(Array.from({ length: 200 }, () => constructionLane(rng)));
    assert.deepEqual([...lanes].sort(), [0, LANES - 1]);
    assert.equal(zonePushLane(0), 1);
    assert.equal(zonePushLane(LANES - 1), LANES - 2);
  });

  test('with a lane closed, rows still leave a reachable open lane and never use the closed one', () => {
    const rng = seeded(21);
    for (const closed of [[0], [LANES - 1]]) {
      let prevOpen = [closed[0]]; // the bus may arrive in the lane that's closing
      for (let i = 0; i < 500; i++) {
        const blocked = pickBlockedLanes(rng, 5000, prevOpen, closed);
        assert.ok(!blocked.includes(closed[0]), 'no vehicle in a closed lane');
        const open = openLanes(blocked, closed);
        assert.ok(open.length >= 1);
        assert.ok(open.some((l) => prevOpen.some((p) => Math.abs(l - p) <= 1)), `reachable from ${prevOpen}`);
        prevOpen = open;
      }
    }
  });
});

describe('missions and achievements', () => {
  test('progress is capped at the target', () => {
    assert.equal(missionProgress('fares30', { fares: 12 }), 12);
    assert.equal(missionProgress('fares30', { fares: 99 }), 30);
    assert.ok(missionDone('fares30', { fares: 30 }));
    assert.ok(!missionDone('nope', { fares: 30 }));
  });

  test('refill keeps active missions, fills to three distinct, skips just-completed ones', () => {
    const rng = seeded(4);
    const fresh = refillMissions(rng, []);
    assert.equal(fresh.length, ACTIVE_MISSIONS);
    assert.equal(new Set(fresh).size, ACTIVE_MISSIONS);
    const next = refillMissions(rng, [fresh[0], fresh[1]], {}, [fresh[2]]);
    assert.deepEqual(next.slice(0, 2), [fresh[0], fresh[1]]);
    assert.notEqual(next[2], fresh[2]);
    assert.deepEqual(refillMissions(rng, ['bogus', fresh[0], fresh[0]]).slice(0, 1), [fresh[0]]);
  });

  test('missions that need an upgrade are offered only once it is bought', () => {
    const rng = seeded(8);
    for (let i = 0; i < 200; i++) assert.ok(!refillMissions(rng, []).includes('ram2'));
    const offered = Array.from({ length: 300 }, () => refillMissions(rng, [], { ram: 1 })).flat();
    assert.ok(offered.includes('ram2'));
    assert.ok(Object.values(MISSIONS).every((m) => m.reward > 0 && m.target > 0));
  });

  test('achievements unlock once, from run stats or lifetime totals', () => {
    const lifetime = addLifetime(addLifetime(undefined, { wrecked: 20, fares: 3 }), { wrecked: 6 });
    assert.deepEqual(lifetime, { runs: 2, wrecked: 26, fares: 3, distance: 0, rammed: 0 });
    const earned = newAchievements([], { level: 5, wasted: 1 }, lifetime);
    assert.deepEqual(earned.sort(), ['copBait', 'islandHopper', 'joyrider', 'wasted']);
    assert.deepEqual(newAchievements(earned, { level: 5, wasted: 1 }, lifetime), []);
    assert.ok(Object.values(ACHIEVEMENTS).every((a) => a.reward > 0));
  });
});

describe('hazmat trucks', () => {
  test('only box trucks and semis can carry gasoline, at their own odds', () => {
    const carriers = VEHICLES.filter((v) => v.hazmatChance).map((v) => v.kind).sort();
    assert.deepEqual(carriers, ['semi', 'truck']);
    const rng = seeded(3);
    const semi = VEHICLES.find((v) => v.kind === 'semi');
    const hits = Array.from({ length: 4000 }, () => isHazmat(rng, semi)).filter(Boolean).length / 4000;
    assert.ok(Math.abs(hits - semi.hazmatChance) < 0.03, `semi hazmat rate ${hits}`);
    assert.equal(isHazmat(rng, VEHICLES.find((v) => v.kind === 'car')), false);
  });

  test('a hazmat crash stuns for 20 s with a 4 s fuse; a tanker keeps its own', () => {
    assert.deepEqual(crashTimings({ hazmat: true }), { stun: HAZMAT_STUN_SECONDS, fuse: HAZMAT_FUSE_SECONDS });
    assert.equal(HAZMAT_STUN_SECONDS, 20);
    assert.equal(HAZMAT_FUSE_SECONDS, 4);
    assert.deepEqual(crashTimings({ fuel: true }), { stun: FUEL_STUN_SECONDS, fuse: FUEL_FUSE_SECONDS });
  });

  test('explosive vehicles and trains get through a shield', () => {
    assert.ok(explosive({ hazmat: true }) && explosive({ fuel: true }) && !explosive({ kind: 'truck' }));
    assert.equal(shieldAbsorbs({ hazmat: true, lethal: true }), false);
    assert.equal(shieldAbsorbs(TRAIN), false);
    assert.equal(shieldAbsorbs({ kind: 'truck', lethal: true }), true);
  });
});

describe('new traffic', () => {
  test('tow trucks and cement mixers are lethal', () => {
    const tow = VEHICLES.find((v) => v.kind === 'tow');
    const mixer = VEHICLES.find((v) => v.kind === 'mixer');
    assert.equal(livesAfterHit(3, tow, 0), 0);
    assert.equal(livesAfterHit(3, mixer, 0), 0);
    assert.ok(tow.length <= ROW_SPACING_MIN && mixer.length <= ROW_SPACING_MIN);
  });
});

describe('Sentosa', () => {
  test('is the sixth, endless district, and the only one with sand drifts', () => {
    assert.equal(LEVELS[5], 'Sentosa');
    assert.equal(levelAt(LEVEL_DISTANCE * 5), 5);
    assert.deepEqual(LEVELS.map((_, i) => sandAllowed(i)), LEVELS.map((name) => name === 'Sentosa'));
  });
});

describe('weather', () => {
  test('storms start only past the minimum distance, and never on top of one', () => {
    const always = () => 0;
    assert.equal(stormStarts(always, STORM_MIN_DISTANCE - 1, false), false);
    assert.equal(stormStarts(always, STORM_MIN_DISTANCE, false), true);
    assert.equal(stormStarts(always, STORM_MIN_DISTANCE, true), false);
  });

  test('wet roads weaken accelerating and braking, never the speed bounds', () => {
    const dry = stepSpeed(12, { accelerate: true }, 0.1, 0);
    const wet = stepSpeed(12, { accelerate: true }, 0.1, 0, 0, { grip: WET_GRIP });
    assert.ok(wet > 12 && wet < dry);
    const dryBrake = stepSpeed(14, { brake: true }, 0.1, 0);
    const wetBrake = stepSpeed(14, { brake: true }, 0.1, 0, 0, { grip: WET_GRIP });
    assert.ok(wetBrake < 14 && wetBrake > dryBrake);
    assert.equal(stepSpeed(MIN_SPEED, { brake: true }, 10, 0, 0, { grip: WET_GRIP }), MIN_SPEED);
  });
});

describe('cement mixer drift', () => {
  test('needs the bus one lane over, within the radius, with a way out', () => {
    assert.ok(canDrift(1, 150, 486, 2, 250, 444));
    assert.ok(canDrift(1, 150, 486, 2, 250, 370), 'a little ahead is still in range');
    assert.ok(!canDrift(1, 150, 486, 3, 350, 444), 'two lanes over');
    assert.ok(!canDrift(1, 150, 486, 2, 250, 200), 'outside the radius');
    assert.ok(!canDrift(0, 50, 486, 1, 150, 444), 'no escape lane at the road edge');
    assert.ok(!canDrift(3, 350, 486, 2, 250, 444), 'no escape lane at the other edge');
    assert.equal(escapeLane(1, 2), 0);
    assert.equal(escapeLane(2, 1), 3);
    assert.equal(escapeLane(0, 1), null);
  });

  test('every bus can change lane before the mixer lands', () => {
    for (const key of Object.keys(BUSES)) {
      assert.ok(laneChangeSeconds(0, key) < MIXER_BRAKE_SECONDS, `${key} clears while it's still braking`);
      assert.ok(laneChangeSeconds(0, key) < TIP_SECONDS, key);
    }
  });
});

describe('MRT track', () => {
  test('lasts 50 seconds, and trains are lethal', () => {
    assert.equal(TRACK_SECONDS, 50);
    assert.equal(livesAfterHit(5, TRAIN, 3), 0);
    assert.ok(RAMP_TRUCK.length <= ROW_SPACING_MIN);
  });

  test('oncoming trains close at bus speed plus their own; up trains always overtake', () => {
    assert.equal(trainClosingSpeed(1, 20), 20 + TRAIN_SPEED);
    for (const speed of [MIN_SPEED, 20, maxSpeed(UPGRADES.engine.maxLevel, LEVELS.length - 1)]) {
      assert.ok(trainClosingSpeed(0, speed) < 0, 'moves up the screen');
    }
  });

  test('the warning leaves time to switch tracks, and both tracks get trains', () => {
    for (const key of Object.keys(BUSES)) assert.ok(TRAIN_WARNING_SECONDS > 2 * laneChangeSeconds(0, key), key);
    const rng = seeded(11);
    const tracks = new Set(Array.from({ length: 50 }, () => nextTrainTrack(rng)));
    assert.deepEqual([...tracks].sort(), [0, 1]);
    for (let i = 0; i < 100; i++) {
      const gap = trainGapSeconds(rng);
      assert.ok(gap >= 1.5 && gap <= 4);
    }
    assert.ok(TRAIN_LENGTH > 0);
  });
});

describe('daily challenge', () => {
  test('the same date always gives the same road; different dates differ', () => {
    const a = seededRng(dailySeed('2026-10-13'));
    const b = seededRng(dailySeed('2026-10-13'));
    const c = seededRng(dailySeed('2026-10-14'));
    const seqA = Array.from({ length: 20 }, a);
    assert.deepEqual(Array.from({ length: 20 }, b), seqA);
    assert.notDeepEqual(Array.from({ length: 20 }, c), seqA);
    assert.ok(seqA.every((x) => x >= 0 && x < 1));
    const blockedA = pickBlockedLanes(seededRng(dailySeed('2026-10-13')), 900, null);
    assert.deepEqual(pickBlockedLanes(seededRng(dailySeed('2026-10-13')), 900, null), blockedA);
  });

  test('the date is the UTC day, and the daily bus is the stock single-decker', () => {
    assert.equal(dailyDate(new Date('2026-10-13T23:30:00Z')), '2026-10-13');
    assert.equal(dailyDate(new Date('2026-10-13T16:30:00-08:00')), '2026-10-14');
    assert.equal(DAILY_BUS, 'single');
    assert.equal(busDef(DAILY_BUS).cost, 0);
  });
});

describe('new missions and achievements', () => {
  test('track, mixer and Sentosa missions and achievements count the right stats', () => {
    const stats = { trackRides: 1, mixerTopples: 1, level: 6, pancaked: 1, storms: 1 };
    for (const key of ['track', 'mixer', 'sentosa']) assert.ok(missionDone(key, stats), key);
    const earned = newAchievements([], stats, addLifetime(undefined, {}));
    for (const key of ['beachBum', 'skyRail', 'pourDecision', 'pancake', 'stormChaser', 'islandHopper']) {
      assert.ok(earned.includes(key), key);
    }
  });
});

describe('container, flatbed and refrigerated trucks, and lorries', () => {
  test('the new trucks kill on contact and fit the row spacing', () => {
    for (const kind of ['container', 'flatbed', 'reefer']) {
      const v = VEHICLES.find((x) => x.kind === kind);
      assert.equal(livesAfterHit(5, v, 0), 0, kind);
      assert.equal(livesAfterHit(5, v, 1), 0, `${kind} ignores grace`);
      assert.ok(v.length <= ROW_SPACING_MIN, kind);
    }
  });

  test('a lorry takes most of your lives, and your last one', () => {
    const lorry = VEHICLES.find((v) => v.kind === 'lorry');
    assert.ok(!lorry.lethal && lorry.heavy);
    assert.equal(HEAVY_LIVES_LEFT, 1);
    assert.equal(livesAfterHit(6, lorry, 0), 1);
    assert.equal(livesAfterHit(3, lorry, 0), 1);
    assert.equal(livesAfterHit(2, lorry, 0), 1);
    assert.equal(livesAfterHit(1, lorry, 0), 0);
    assert.equal(livesAfterHit(3, lorry, 1), 3, 'grace still covers it');
  });

  test('flatbed loads follow their odds, steel coils included', () => {
    assert.ok(Math.abs(Object.values(FLATBED_LOADS).reduce((a, b) => a + b, 0) - 1) < 1e-9);
    const rng = seeded(21);
    const counts = {};
    for (let i = 0; i < 5000; i++) { const l = flatbedLoad(rng); counts[l] = (counts[l] || 0) + 1; }
    for (const [load, odds] of Object.entries(FLATBED_LOADS)) {
      assert.ok(Math.abs(counts[load] / 5000 - odds) < 0.03, load);
    }
  });

  test('only steel-coil flatbeds past the minimum distance run away', () => {
    const always = () => 0;
    assert.equal(isRunaway(always, 'coils', RUNAWAY_MIN_DISTANCE), true);
    assert.equal(isRunaway(always, 'coils', RUNAWAY_MIN_DISTANCE - 1), false);
    assert.equal(isRunaway(always, 'lumber', 5000), false);
  });

  test('a runaway swerves one lane toward the bus, never off the road or into a closed lane', () => {
    const rng = seeded(5);
    assert.equal(runawayLane(2, 0, rng), 1);
    assert.equal(runawayLane(1, 3, rng), 2);
    assert.equal(runawayLane(2, 0, rng, [1]), 3, 'blocked toward the bus: it lurches the other way');
    for (let i = 0; i < 50; i++) {
      const l = runawayLane(0, 0, rng);
      assert.equal(l, 1);
      assert.ok([2, 0].includes(runawayLane(1, 1, rng)));
    }
  });

  test('a runaway swerves high enough up the screen to dodge at the fastest closing speed', () => {
    const fastest = (maxSpeed(UPGRADES.engine.maxLevel, LEVELS.length - 1) + TRAFFIC_SPEED) * PX_PER_METER;
    const busY = 640 - BUS_LENGTH - 110;
    // Time from the swerve finishing (and its new lane being plain) until its nose reaches the bus.
    const travelled = RUNAWAY_VEER_SECONDS * fastest;
    const window = (busY - (RUNAWAY_VEER_Y + 150 + travelled)) / fastest;
    for (const key of Object.keys(BUSES)) assert.ok(window > laneChangeSeconds(0, key), `${key}: still ${window}s to react after the swerve`);
  });
});
