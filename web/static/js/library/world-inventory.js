// Pure, DOM-free world inventory for Library Shift's camera-parity
// requirement (P1): both cameras draw from this single per-floor list.
// No renderer, no canvas, no state mutation — just reads game state and
// returns every entity the two cameras should show.

import { stationsOnFloor } from './floor-plan.js';

// Entity kinds that only make sense in one camera, not both (P2 exemptions).
export const EXEMPT_KINDS = new Set([
  'player',         // Eun-mi IS the FP camera; TD draws her sprite
  'hover-ring',     // TD's hover/target rings → FP's crosshair highlight
  'minimap',        // FP-only HUD element
  'dust',           // FP-only particle effect
  'vignette',       // FP-only screen-space overlay
  'boss-cutscene',  // full-screen overlay in both cameras
]);

/**
 * Returns every world entity for `floor` that both cameras must draw.
 *
 * Each entry has at minimum:
 *   { kind: string, id: string, x: number, y: number, floor: number }
 * plus kind-specific fields (ref, design, slotIndex, …).
 *
 * Callers (the Top-Down branch and drawFirstPersonView) consume this list
 * instead of building their own — so the two views can never disagree about
 * what exists. The parity test asserts every `kind` maps to an FP builder
 * or is in EXEMPT_KINDS.
 *
 * @param {number} floor
 * @param {object} opts
 * @param {object[]} opts.stations       - buildStations() output
 * @param {Function} opts.frontDeskSlots - () => slot[]
 * @param {Function} opts.finesCounterSlots - () => slot[]
 * @param {Function} opts.returnCartSlots - () => book[]
 * @param {object[]} opts.ambient        - the live ambient-staff array
 * @param {object[]} opts.decorItems     - LIBRARY_DECOR
 * @param {object}   opts.halluc         - hallucination state { figures, whispers, ghosts, … }
 * @param {boolean}  [opts.bossOfficeLocked] - Boss's Office padlock state
 * @param {boolean}  [opts.coffeeOutOfOrder] - Coffee Machine out-of-order state
 * @returns {{ kind: string, id: string, x: number, y: number, floor: number }[]}
 */
export function worldInventory(floor, opts) {
  const items = [];

  // --- Stations (every kind on this floor) ---
  for (const s of stationsOnFloor(opts.stations, floor)) {
    items.push({
      kind: 'station',
      id: s.id,
      x: s.x,
      y: s.y,
      floor,
      stationKind: s.kind,
      ref: s,
      locked: s.kind === 'boss-office' && Boolean(opts.bossOfficeLocked),
      outOfOrder: s.kind === 'coffee-machine' && Boolean(opts.coffeeOutOfOrder),
    });
  }

  // --- Front Desk queue patrons (1F only) ---
  if (opts.frontDeskSlots) {
    for (const slot of opts.frontDeskSlots()) {
      items.push({
        kind: slot.kind === 'ghost' ? 'ghost-patron' : (slot.kind === 'karen' ? 'karen' : 'front-desk-patron'),
        id: `fd-${slot.id}`,
        x: slot.x,
        y: slot.y,
        floor,
        ref: slot,
        slotIndex: items.filter((i) => i.kind === 'front-desk-patron' || i.kind === 'karen' || i.kind === 'ghost-patron').length,
      });
    }
  }

  // --- Fines Counter queue patrons (1F only) ---
  if (opts.finesCounterSlots) {
    for (const slot of opts.finesCounterSlots()) {
      items.push({
        kind: 'fines-patron',
        id: `fc-${slot.id}`,
        x: slot.x,
        y: slot.y,
        floor,
        ref: slot,
        slotIndex: items.filter((i) => i.kind === 'fines-patron').length,
      });
    }
  }

  // --- Return Cart books (1F only) ---
  if (opts.returnCartSlots) {
    for (const book of opts.returnCartSlots()) {
      items.push({
        kind: 'return-cart-book',
        id: `cart-${book.id}`,
        x: book.x,
        y: book.y,
        floor,
        ref: book,
      });
    }
  }

  // --- Ambient staff ---
  if (opts.ambient) {
    for (const a of opts.ambient) {
      if (a.floor !== floor) continue;
      items.push({
        kind: 'ambient-staff',
        id: `staff-${a.key}`,
        x: a.x,
        y: a.y,
        floor,
        staffKey: a.key,
        name: a.name,
        dir: a.dir,
        facing: a.facing ?? 0,
        scale: a.scale,
        action: a.action,
        actionT: a.actionT,
        pause: a.pause,
        phase: a.phase,
        ref: a,
      });
    }
  }

  // --- Decor items ---
  if (opts.decorItems) {
    for (const d of opts.decorItems) {
      if (d.floor !== floor) continue;
      items.push({
        kind: 'decor',
        id: `decor-${d.kind}-${d.x}-${d.y}`,
        x: d.x,
        y: d.y,
        floor,
        decorKind: d.kind,
        w: d.w,
        h: d.h,
        ref: d,
      });
    }
  }

  // --- Hallucination shadow figures ---
  if (opts.halluc) {
    for (const f of opts.halluc.figures) {
      items.push({
        kind: 'hallucination-figure',
        id: `halluc-fig-${f.x.toFixed(0)}-${f.y.toFixed(0)}`,
        x: f.x,
        y: f.y,
        floor,
        age: f.age,
        life: f.life,
        ref: f,
      });
    }
  }

  return items;
}

/**
 * All entity kinds worldInventory can produce. The parity test checks
 * that every kind here has either an FP mesh builder or is in EXEMPT_KINDS.
 */
export const ALL_INVENTORY_KINDS = [
  'station',
  'front-desk-patron',
  'karen',
  'ghost-patron',
  'fines-patron',
  'return-cart-book',
  'ambient-staff',
  'decor',
  'hallucination-figure',
];
