import test from 'node:test';
import assert from 'node:assert/strict';
import { worldInventory, ALL_INVENTORY_KINDS, EXEMPT_KINDS } from './world-inventory.js';
import { buildStations, FLOOR_1, FLOOR_2 } from './floor-plan.js';
import { GENRES } from './rules.js';

const stations = buildStations(GENRES);

function stubSlots(floor) {
  return {
    stations,
    frontDeskSlots: floor === FLOOR_1 ? () => [
      { kind: 'borrow', id: 'b1', x: 300, y: 400 },
      { kind: 'karen', id: 'karen', x: 340, y: 400 },
      { kind: 'ghost', id: 'g1', x: 380, y: 400 },
    ] : () => [],
    finesCounterSlots: floor === FLOOR_1 ? () => [
      { kind: 'fine', id: 'f1', amountGard: 10, x: 500, y: 400 },
    ] : () => [],
    returnCartSlots: floor === FLOOR_1 ? () => [
      { id: 'rc1', genreId: 'fiction', x: 200, y: 300 },
    ] : () => [],
    ambient: [
      { key: 'guard', name: 'Security', floor: FLOOR_1, x: 200, y: 560, dir: 1, scale: undefined, action: null, actionT: 0, pause: 0, phase: 0 },
      { key: 'volunteer', name: 'Volunteer', floor: FLOOR_2, x: 380, y: 280, dir: 1, scale: undefined, action: null, actionT: 0, pause: 0, phase: 0 },
      { key: 'minjun', name: 'Min-jun', floor: FLOOR_2, x: 850, y: 290, dir: 1, scale: 1.5, action: 'reading', actionT: 2, pause: 1, phase: 0 },
    ],
    decorItems: [
      { kind: 'water-cooler', floor: FLOOR_1, x: 200, y: 120, w: 28, h: 52 },
      { kind: 'plant', floor: FLOOR_2, x: 40, y: 120, w: 30, h: 46 },
    ],
    halluc: {
      figures: [{ x: 400, y: 300, age: 0.5, life: 1.0 }],
      whispers: [],
      ghosts: [{ id: 'ghost-0', age: 0, life: 15 }],
    },
    bossOfficeLocked: true,
    coffeeOutOfOrder: false,
  };
}

test('worldInventory returns stations for the requested floor only', () => {
  const inv1 = worldInventory(FLOOR_1, stubSlots(FLOOR_1));
  const inv2 = worldInventory(FLOOR_2, stubSlots(FLOOR_2));
  const stationKinds1 = inv1.filter((i) => i.kind === 'station').map((i) => i.stationKind);
  const stationKinds2 = inv2.filter((i) => i.kind === 'station').map((i) => i.stationKind);
  assert.ok(stationKinds1.length > 0, 'Floor 1 has stations');
  assert.ok(stationKinds2.length > 0, 'Floor 2 has stations');
  for (const s of inv1) assert.equal(s.floor, FLOOR_1);
  for (const s of inv2) assert.equal(s.floor, FLOOR_2);
});

test('worldInventory includes Front Desk queue patrons on 1F', () => {
  const inv = worldInventory(FLOOR_1, stubSlots(FLOOR_1));
  const patrons = inv.filter((i) => i.kind === 'front-desk-patron');
  const karen = inv.filter((i) => i.kind === 'karen');
  const ghosts = inv.filter((i) => i.kind === 'ghost-patron');
  assert.equal(patrons.length, 1);
  assert.equal(karen.length, 1);
  assert.equal(ghosts.length, 1);
});

test('worldInventory includes Fines Counter queue on 1F', () => {
  const inv = worldInventory(FLOOR_1, stubSlots(FLOOR_1));
  const fines = inv.filter((i) => i.kind === 'fines-patron');
  assert.equal(fines.length, 1);
});

test('worldInventory includes Return Cart books on 1F', () => {
  const inv = worldInventory(FLOOR_1, stubSlots(FLOOR_1));
  const books = inv.filter((i) => i.kind === 'return-cart-book');
  assert.equal(books.length, 1);
});

test('worldInventory includes ambient staff on correct floor', () => {
  const inv1 = worldInventory(FLOOR_1, stubSlots(FLOOR_1));
  const inv2 = worldInventory(FLOOR_2, stubSlots(FLOOR_2));
  const staff1 = inv1.filter((i) => i.kind === 'ambient-staff');
  const staff2 = inv2.filter((i) => i.kind === 'ambient-staff');
  assert.equal(staff1.length, 1); // guard
  assert.equal(staff1[0].staffKey, 'guard');
  assert.equal(staff2.length, 2); // volunteer, minjun
});

test('worldInventory includes decor on correct floor', () => {
  const inv1 = worldInventory(FLOOR_1, stubSlots(FLOOR_1));
  const inv2 = worldInventory(FLOOR_2, stubSlots(FLOOR_2));
  assert.equal(inv1.filter((i) => i.kind === 'decor').length, 1);
  assert.equal(inv2.filter((i) => i.kind === 'decor').length, 1);
});

test('worldInventory includes hallucination figures', () => {
  const inv = worldInventory(FLOOR_1, stubSlots(FLOOR_1));
  const figs = inv.filter((i) => i.kind === 'hallucination-figure');
  assert.equal(figs.length, 1);
});

test('Boss Office carries locked state', () => {
  const inv = worldInventory(FLOOR_1, stubSlots(FLOOR_1));
  const boss = inv.find((i) => i.stationKind === 'boss-office');
  assert.ok(boss, 'Boss Office is in inventory');
  assert.equal(boss.locked, true);
});

test('Coffee Machine carries outOfOrder state', () => {
  const opts = stubSlots(FLOOR_1);
  opts.coffeeOutOfOrder = true;
  const inv = worldInventory(FLOOR_1, opts);
  const coffee = inv.find((i) => i.stationKind === 'coffee-machine');
  assert.ok(coffee);
  assert.equal(coffee.outOfOrder, true);
});

test('every item has required fields', () => {
  const inv = worldInventory(FLOOR_1, stubSlots(FLOOR_1));
  for (const item of inv) {
    assert.ok(typeof item.kind === 'string', `kind is string: ${JSON.stringify(item)}`);
    assert.ok(typeof item.id === 'string', `id is string: ${JSON.stringify(item)}`);
    assert.ok(typeof item.x === 'number', `x is number: ${JSON.stringify(item)}`);
    assert.ok(typeof item.y === 'number', `y is number: ${JSON.stringify(item)}`);
    assert.equal(item.floor, FLOOR_1);
  }
});

test('ALL_INVENTORY_KINDS covers every kind worldInventory produces', () => {
  const kinds1 = new Set(worldInventory(FLOOR_1, stubSlots(FLOOR_1)).map((i) => i.kind));
  const kinds2 = new Set(worldInventory(FLOOR_2, stubSlots(FLOOR_2)).map((i) => i.kind));
  const all = new Set([...kinds1, ...kinds2]);
  for (const k of all) {
    assert.ok(ALL_INVENTORY_KINDS.includes(k), `kind "${k}" missing from ALL_INVENTORY_KINDS`);
  }
});

// --- Parity test: every kind has an FP builder or is exempt (P2) ---
// Kinds that have an FP mesh builder today (will grow as work ships).
const FP_BUILDER_KINDS = new Set([
  'station',            // buildStationBox / BUILDERS
  'front-desk-patron',  // buildCharacter
  'karen',              // buildCharacter
  'fines-patron',       // buildCharacter
  'ghost-patron',       // buildCharacter at placement.alpha
  'ambient-staff',      // buildCharacter via findStaffDesign
  'decor',              // DECOR_BUILDERS in meshes/decor.js
  'hallucination-figure', // buildShadowFigure billboard via three-d/shadow-figures.js
]);

// Kinds where the FP builder is planned but not yet shipped — the test
// marks these as TODO so CI stays green while each ships in its own step.
const FP_TODO_KINDS = new Set([
  'return-cart-book',      // Step 7: genre-colour book mesh
]);

test('parity: every inventory kind has an FP builder or is exempt', () => {
  const missing = [];
  for (const kind of ALL_INVENTORY_KINDS) {
    if (EXEMPT_KINDS.has(kind)) continue;
    if (FP_BUILDER_KINDS.has(kind)) continue;
    if (FP_TODO_KINDS.has(kind)) {
      // Tracked — will turn green when the step ships.
      continue;
    }
    missing.push(kind);
  }
  assert.deepEqual(missing, [], 'Kinds without an FP builder or exemption');
});

test('parity: TODO kinds shrink as steps ship', () => {
  // This test documents what's left. When a step ships, move its kind
  // from FP_TODO_KINDS to FP_BUILDER_KINDS — the test fails if a TODO
  // kind already has a builder (prompting the cleanup).
  for (const kind of FP_TODO_KINDS) {
    assert.ok(
      !FP_BUILDER_KINDS.has(kind),
      `"${kind}" is in both FP_TODO_KINDS and FP_BUILDER_KINDS — move it out of TODO`,
    );
  }
});

test('ghost patrons in Front Desk are kind ghost-patron', () => {
  const inv = worldInventory(FLOOR_1, stubSlots(FLOOR_1));
  const ghost = inv.find((i) => i.kind === 'ghost-patron');
  assert.ok(ghost, 'ghost-patron exists');
  assert.ok(ghost.id.startsWith('fd-'), 'ghost is a front-desk slot');
});
