// Pure floor-plan geometry for Hospital Shift (docs/features/hospital-
// shift.md's Visual Direction): station coordinates on the fixed 960x600
// ER and the click-to-move helpers, ported from Library Shift's
// floor-plan.js (same stationAtPoint/approachPoint/clampToCanvas shape).
//
// Two floors, Library Shift's way: the 1st Floor is the ER itself; the
// 2nd Floor is the Supply Room, home of the Supply Cart (bandage rolls) —
// the user asked for a supply cart "and make a second floor where they
// are on". Stairs and an Elevator sit at the same spot on both floors,
// alongside hospital-game.js's HUD button; all three switch instantly and
// work in every phase (you must be able to come back down for handover).

export const CANVAS_WIDTH = 960;
export const CANVAS_HEIGHT = 600;

/**
 * Box size for every ordinary station — Library Shift's 84 until the user
 * asked to "adjust the objects" (resize, re-space, redraw, add decor):
 * stations grew a little so their redrawn furniture reads at a glance.
 */
export const STATION_BOX_SIZE = 92;

/** Beds are taller than wide: a patient lies head-up on the pillow. */
export const BED_WIDTH = 100;
export const BED_HEIGHT = 128;

/** How far outside a station's box the player stops — Library Shift's value. */
export const PLAYER_STOP_MARGIN = 28;

export const FLOOR_1 = 1;
export const FLOOR_2 = 2;
/**
 * The walk-in Operating Room (the user: "for surguries you have to enter the
 * room"): its own full-canvas room, entered through the ER's Operating Room
 * door and left through its own door back to the ER.
 */
export const FLOOR_OR = 3;

/** Where the nurse starts each shift: the open middle of the floor, below the triage line. */
export const PLAYER_START = { x: 480, y: 520 };

/**
 * The fixed station list, each tagged with its floor. 1st Floor:
 * 'triage-desk', 'office' (Charge Nurse's office — the paycheck),
 * 'med-cabinet', 'operating-room', 'coffee-machine', 'bed' ×bedCount (each
 * with `bedIndex`). 2nd Floor: 'supply-cart'. Both: 'stairs' and
 * 'elevator' (with `targetFloor`).
 *
 * @param {number} bedCount
 * @returns {{id: string, kind: string, floor: number, x: number, y: number, w: number, h: number, bedIndex?: number, targetFloor?: number}[]}
 */
export function buildStations(bedCount = 4) {
  const s = STATION_BOX_SIZE;
  const stations = [
    // The office sits a little right of the wall so its long "Charge Nurse
    // (after 7 PM)" label stays on screen.
    { id: 'office', kind: 'office', floor: FLOOR_1, x: 96, y: 112, w: s, h: s },
    { id: 'triage-desk', kind: 'triage-desk', floor: FLOOR_1, x: 330, y: 112, w: 140, h: s },
    { id: 'med-cabinet', kind: 'med-cabinet', floor: FLOOR_1, x: 640, y: 112, w: s, h: s },
    { id: 'operating-room', kind: 'operating-room', floor: FLOOR_1, x: 866, y: 362, w: 150, h: 160 },
    { id: 'coffee-machine', kind: 'coffee-machine', floor: FLOOR_1, x: 90, y: 530, w: s, h: s },
    { id: 'stairs-1', kind: 'stairs', floor: FLOOR_1, targetFloor: FLOOR_2, x: 878, y: 112, w: s, h: s },
    { id: 'elevator-1', kind: 'elevator', floor: FLOOR_1, targetFloor: FLOOR_2, x: 878, y: 530, w: s, h: s },
    // The Supply Room: the cart sits in the middle, shelves line the walls.
    { id: 'supply-cart', kind: 'supply-cart', floor: FLOOR_2, x: 420, y: 330, w: 124, h: s },
    { id: 'stairs-2', kind: 'stairs', floor: FLOOR_2, targetFloor: FLOOR_1, x: 878, y: 112, w: s, h: s },
    { id: 'elevator-2', kind: 'elevator', floor: FLOOR_2, targetFloor: FLOOR_1, x: 878, y: 530, w: s, h: s },
    // Implants (mesh patches, bone plates) for surgery live upstairs.
    { id: 'implant-shelf', kind: 'implant-shelf', floor: FLOOR_2, x: 210, y: 330, w: 110, h: s },
    // Inside the Operating Room: the table in the middle under the lamp, the
    // Instrument Tray (scalpels) and the Organ Cooler at its sides, and the
    // door back out to the ER.
    { id: 'or-table', kind: 'or-table', floor: FLOOR_OR, x: 480, y: 330, w: 150, h: 200 },
    { id: 'instrument-tray', kind: 'instrument-tray', floor: FLOOR_OR, x: 230, y: 330, w: 120, h: s },
    { id: 'organ-cooler', kind: 'organ-cooler', floor: FLOOR_OR, x: 730, y: 330, w: 110, h: 120 },
    { id: 'or-door', kind: 'or-door', floor: FLOOR_OR, targetFloor: FLOOR_1, x: 480, y: 540, w: 120, h: 80 },
  ];
  // Evenly spaced, with room between beds for each bed's IV pole.
  const bedXs = [150, 320, 490, 660];
  for (let i = 0; i < bedCount; i++) {
    stations.push({ id: `bed-${i}`, kind: 'bed', floor: FLOOR_1, bedIndex: i, x: bedXs[i] ?? (150 + i * 170), y: 360, w: BED_WIDTH, h: BED_HEIGHT });
  }
  return stations;
}

/**
 * Set dressing (the user: "add more objects"): non-interactive props drawn
 * on the floor under everyone, kept clear of every station box, the triage
 * line and the player's start (floor-plan.test.js checks). `x, y` is the
 * prop's center, `w, h` its footprint; hospital-game.js draws each kind.
 *
 * @returns {{kind: string, floor: number, x: number, y: number, w: number, h: number}[]}
 */
export function buildDecor(bedCount = 4) {
  const decor = [
    // Waiting chairs beside the triage line, under the Med Cabinet.
    { kind: 'waiting-chairs', floor: FLOOR_1, x: 600, y: 206, w: 96, h: 34 },
    // A water cooler between the Med Cabinet and the Stairs.
    { kind: 'water-cooler', floor: FLOOR_1, x: 772, y: 196, w: 28, h: 52 },
    // Potted plants along the left wall, by the first bed's curtain (off
    // the staff's walking routes).
    { kind: 'plant', floor: FLOOR_1, x: 36, y: 372, w: 30, h: 46 },
    { kind: 'plant', floor: FLOOR_1, x: 34, y: 452, w: 30, h: 46 },
    // A vending machine across from the Elevator.
    { kind: 'vending-machine', floor: FLOOR_1, x: 762, y: 524, w: 46, h: 78 },
    // Supply Room: a step ladder and a plant.
    { kind: 'ladder', floor: FLOOR_2, x: 566, y: 232, w: 30, h: 62 },
    { kind: 'plant', floor: FLOOR_2, x: 878, y: 318, w: 30, h: 46 },
  ];
  // An IV pole at each bed's right, in the gap before the next curtain.
  const beds = buildStations(bedCount).filter((st) => st.kind === 'bed');
  for (const bed of beds) decor.push({ kind: 'iv-pole', floor: FLOOR_1, x: bed.x + bed.w / 2 + 16, y: bed.y - 4, w: 16, h: 112 });
  return decor;
}

/** Just the stations on one floor — what's drawn and clickable there. */
export function stationsOnFloor(stations, floor) {
  return stations.filter((station) => station.floor === floor);
}

/**
 * Where the nurse lands after switching floors: beside whichever fixture
 * they used (Stairs or Elevator sit at the same spot on both floors), or
 * beside the Stairs for the HUD button.
 *
 * @param {'stairs' | 'elevator' | 'button'} via
 * @returns {{x: number, y: number}}
 */
export function entryPointFor(via) {
  if (via === 'or-enter') return { x: 480, y: 470 }; // just inside the OR door
  if (via === 'or-exit') return { x: 760, y: 362 }; // in the ER, beside the OR door
  return via === 'elevator' ? { x: 790, y: 530 } : { x: 790, y: 130 };
}

/** The station whose box contains (x, y), or null. */
export function stationAtPoint(x, y, stations) {
  for (const station of stations) {
    if (Math.abs(x - station.x) <= station.w / 2 && Math.abs(y - station.y) <= station.h / 2) return station;
  }
  return null;
}

/** How far from a station's center the player stops: just outside its box, toward wherever they're coming from. */
export function standoffFor(station, fromX, fromY) {
  const dx = Math.abs(fromX - station.x);
  const dy = Math.abs(fromY - station.y);
  // Approaching mostly from the side, stop past the half-width; from above/below, past the half-height.
  const half = dx * station.h > dy * station.w ? station.w / 2 : station.h / 2;
  return half + PLAYER_STOP_MARGIN;
}

/**
 * Where to walk to interact with a station at (stationX, stationY): a point
 * `standoffDistance` from it on the line toward the player. Already within
 * range → stay put.
 */
export function approachPoint(stationX, stationY, fromX, fromY, standoffDistance) {
  const dx = fromX - stationX;
  const dy = fromY - stationY;
  const dist = Math.hypot(dx, dy);
  if (dist <= standoffDistance) return { x: fromX, y: fromY };
  const ratio = standoffDistance / dist;
  return { x: stationX + dx * ratio, y: stationY + dy * ratio };
}

export function clampToCanvas(x, y, margin = 24) {
  return {
    x: Math.min(CANVAS_WIDTH - margin, Math.max(margin, x)),
    y: Math.min(CANVAS_HEIGHT - margin, Math.max(margin, y)),
  };
}
