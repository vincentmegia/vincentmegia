// Pure, canvas-independent floor-plan math for Library Shift
// (docs/features/library-game.md's Visual Direction/Scope — "click-to-move
// floor plan," "Two floors... sharing one canvas, never shown at once").
//
// This module has NO DOM/canvas/localStorage/timer dependencies on purpose,
// mirroring rules.js/engine-state.js's contract, so it can be unit-tested
// with `node --test` and imported unchanged by the canvas game loop
// (library-game.js). It owns station coordinates on the fixed 960x600 floor
// plan (matching library-game.html's canvas dimensions) and the
// click-to-move geometry: hit-testing a click/hover point against a
// station's box, and computing where the player should stop when walking up
// to interact with one (just outside its box, not dead-center on top of
// it). Ported directly from Kitchen Shift's own `cooking/floor-plan.js` —
// same STATION_BOX_SIZE/PLAYER_STOP_MARGIN/stationAtPoint/approachPoint/
// clampToCanvas shape, since this game's floor plan is simpler (no
// per-level table-unlock grid layout) and doesn't need that file's
// table-grid machinery.
//
// Two floors (doc's Scope, added after the initial build brief — the user
// asked for "more books" upstairs): mirrors Kitchen Shift's Dining/Kitchen
// room split exactly (`ROOM_DINING`/`ROOM_KITCHEN` there -> `FLOOR_1`/
// `FLOOR_2` here, `stationsInRoom` -> `stationsOnFloor`). 1st Floor keeps
// every non-shelf station (Front Desk, Return Cart, the Fines Counter, the
// Coffee Machine, Boss's Office) plus some Bookshelves (mystery/romance/
// sci-fi); 2nd Floor holds only the remaining Bookshelves (kids/reference)
// — purely additional shelving, not a place to relocate any other station.
// Three independent ways to move between floors, all instant (no ride/climb
// animation) and allowed in every `ShiftState.phase` (including
// 'closing-wait' — a shelving/borrow trip could still be in progress
// upstairs when the clock hits 11 PM, and the player must be able to come
// back down to reach the 1st-Floor-only Boss's Office): a Stairs station on
// each floor, a distinct Elevator station on each floor (visually different
// from Stairs so they read as two different fixtures — same "the user asked
// for both X and Y, so both exist" reasoning as Kitchen Shift's
// kitchen-door-plus-Enter-Kitchen-button), and library-game.js's own HUD
// "Go Upstairs"/"Go Downstairs" button (a DOM shortcut, not modeled here,
// same as Kitchen Shift's `#cooking-room-button`).

/** The floor plan's fixed canvas size, in pixels (matches library-game.html). */
export const CANVAS_WIDTH = 960;
export const CANVAS_HEIGHT = 600;

/** Box size (pixels, square) for every station — bigger than Kitchen Shift's 70px STATION_BOX_SIZE, to read clearly behind this game's bigger characters (doc's Visual Direction: "make the characters BIG"). */
export const STATION_BOX_SIZE = 84;

/**
 * Bigger, non-square furniture, in Hospital Shift's style (its triage desk
 * and beds are wider/taller than its square fixtures): a wide Front Desk,
 * wide bookcases, and a Fines Counter drawn as a small room like the ER's
 * Operating Room. `size` stays the square fallback; `w`/`h` are the real
 * box (see `stationExtents`).
 */
export const FRONT_DESK_WIDTH = 124;
export const BOOKCASE_WIDTH = 124;
export const BOOKCASE_HEIGHT = 100;
export const FINES_ROOM_SIZE = 130;

/**
 * How far outside a station's box edge the player stops when walking up to
 * interact with it — close enough to read as "at the shelf," far enough
 * that the player sprite never overlaps the station's box. Same value as
 * Kitchen Shift's PLAYER_STOP_MARGIN.
 */
export const PLAYER_STOP_MARGIN = 28;

/** Floor identifiers a station (and the player) can be on. Exactly one floor is ever visible/active at a time. */
export const FLOOR_1 = 1;
export const FLOOR_2 = 2;

/** The player's starting position every shift — the 1st Floor's open lower aisle, below the staggered shelves and clear of the queues. */
export const PLAYER_START = { x: 450, y: 500 };

/** Where the player lands after switching to 1st Floor (via Stairs, Elevator, or the HUD button) — clear of both fixtures, which sit at the same x/y on both floors. */
export const FLOOR_1_ENTRY_POINT = { x: 450, y: 500 };

/** Where the player lands after switching to 2nd Floor — the canvas center, the open middle between its two shelves. */
export const FLOOR_2_ENTRY_POINT = { x: 480, y: 300 };

/**
 * Builds the fixed station list for both floors, each tagged with which
 * floor it's on (`FLOOR_1`/`FLOOR_2`). The full combined list is always
 * returned — game logic that isn't floor-scoped (e.g. looking up the
 * Front Desk) doesn't need to filter; callers that render/hit-test only the
 * currently-visible floor should run the result through `stationsOnFloor`.
 *
 * Station kinds:
 * - 1st Floor: 'front-desk' (patron queue — fine payments and borrow
 *   requests), 'return-cart' (books awaiting shelving), 'bookshelf' (one
 *   per `genreId` in this floor's slice of GENRES), 'fines-counter',
 *   'coffee-machine', 'boss-office', 'stairs' (-> 2nd Floor), 'elevator'
 *   (-> 2nd Floor).
 * - 2nd Floor: 'bookshelf' (the remaining genres), 'stairs' (-> 1st Floor),
 *   'elevator' (-> 1st Floor).
 *
 * @param {{id: string}[]} genres - rules.js's GENRES (or a test double )import order preserved: the first `FLOOR_1_GENRE_COUNT` go on 1st Floor, the rest on 2nd Floor.
 * @returns {{id: string, kind: string, floor: number, x: number, y: number, size: number, genreId?: string, targetFloor?: number}[]}
 */
const FLOOR_1_GENRE_COUNT = 3;

export function buildStations(genres) {
  const size = STATION_BOX_SIZE;
  // The second floor plan ("make a whole diffrent floors layout"). The 1st
  // Floor is a lobby: the Front Desk is the circulation desk top-center
  // (its queue forms below it), the Return Cart beside it, the Fines Counter
  // a room on the left wall (its queue below it), three bookcases staggered
  // across the middle, the Coffee Machine bottom-right and the Elevator
  // bottom-left. The 2nd Floor is a reading room: the Reading Nook
  // top-center under the windows, the Kids and Reference shelves either
  // side, reading chairs along the bottom. Stairs stay top-right and the
  // Elevator bottom-left on both floors (the same shaft on every floor).
  const stations = [
    { id: 'boss-office', kind: 'boss-office', floor: FLOOR_1, x: 80, y: 115, size },
    { id: 'return-cart', kind: 'return-cart', floor: FLOOR_1, x: 300, y: 115, size },
    { id: 'front-desk', kind: 'front-desk', floor: FLOOR_1, x: 520, y: 115, size, w: FRONT_DESK_WIDTH, h: size },
    { id: 'stairs-1', kind: 'stairs', floor: FLOOR_1, x: 880, y: 115, size, targetFloor: FLOOR_2 },
    { id: 'fines-counter', kind: 'fines-counter', floor: FLOOR_1, x: 100, y: 250, size, w: FINES_ROOM_SIZE, h: FINES_ROOM_SIZE },
    { id: 'elevator-1', kind: 'elevator', floor: FLOOR_1, x: 80, y: 540, size, targetFloor: FLOOR_2 },
    { id: 'coffee-machine', kind: 'coffee-machine', floor: FLOOR_1, x: 880, y: 530, size },
    { id: 'stairs-2', kind: 'stairs', floor: FLOOR_2, x: 880, y: 115, size, targetFloor: FLOOR_1 },
    { id: 'elevator-2', kind: 'elevator', floor: FLOOR_2, x: 80, y: 540, size, targetFloor: FLOOR_1 },
    // v2.10: a cozy Reading Nook (armchair + lamp) — read a book to restore
    // Library Mood. Top-center of the 2nd Floor, between its two shelves.
    { id: 'reading-nook', kind: 'reading-nook', floor: FLOOR_2, x: 480, y: 130, size },
  ];

  const floor1Genres = genres.slice(0, FLOOR_1_GENRE_COUNT);
  const floor2Genres = genres.slice(FLOOR_1_GENRE_COUNT);

  // Staggered: the middle bookcase sits lower, clear of the Front Desk's queue.
  const floor1Shelves = [[360, 320], [580, 400], [800, 320], [580, 220]];
  floor1Genres.forEach((genre, i) => {
    const [x, y] = floor1Shelves[i] ?? [180 + i * 240, 340];
    stations.push({
      id: `bookshelf-${genre.id}`,
      kind: 'bookshelf',
      floor: FLOOR_1,
      genreId: genre.id,
      x,
      y,
      size,
      w: BOOKCASE_WIDTH,
      h: BOOKCASE_HEIGHT,
    });
  });

  const floor2Shelves = [[250, 320], [710, 320], [480, 430], [250, 470], [710, 470]];
  floor2Genres.forEach((genre, i) => {
    const [x, y] = floor2Shelves[i] ?? [320 + i * 220, 300];
    stations.push({
      id: `bookshelf-${genre.id}`,
      kind: 'bookshelf',
      floor: FLOOR_2,
      genreId: genre.id,
      x,
      y,
      size,
      w: BOOKCASE_WIDTH,
      h: BOOKCASE_HEIGHT,
    });
  });

  return stations.map((st) => ({ w: st.size, h: st.size, ...st }));
}

/**
 * A station's half-width and half-height — `w`/`h` when it has them, else
 * the square `size`.
 *
 * @param {{size?: number, w?: number, h?: number}} station
 * @returns {{hw: number, hh: number}}
 */
export function stationExtents(station) {
  return { hw: (station.w ?? station.size) / 2, hh: (station.h ?? station.size) / 2 };
}

/**
 * Filters a station list down to just the ones on the given floor — the
 * pure "what's visible/clickable right now" query, used for rendering and
 * hit-testing so the inactive floor's stations never render or intercept
 * clicks. Mirrors Kitchen Shift's `stationsInRoom` exactly.
 *
 * @param {{floor: number}[]} stations
 * @param {number} floor - `FLOOR_1` or `FLOOR_2`.
 * @returns {object[]}
 */
export function stationsOnFloor(stations, floor) {
  return stations.filter((station) => station.floor === floor);
}

/**
 * The station whose box contains (x, y), if any — a rectangle hit-test used
 * for both click-to-target and mouse-hover tooltips. `null` if the point
 * isn't over any station. Every station's box is a rectangle centered on
 * (x, y) — `stationExtents` gives its half-width/height (this game has no
 * table-style sprite that overhangs its own box, so there's no
 * `hitExtendDown` equivalent).
 *
 * @param {number} x
 * @param {number} y
 * @param {{x: number, y: number, size: number}[]} stations
 * @returns {object | null}
 */
export function stationAtPoint(x, y, stations) {
  for (const station of stations) {
    const { hw, hh } = stationExtents(station);
    if (x >= station.x - hw && x <= station.x + hw
      && y >= station.y - hh && y <= station.y + hh) {
      return station;
    }
  }
  return null;
}

/**
 * Where the player should walk to in order to interact with a station: a
 * point `standoffDistance` outside the station's center, along the line
 * toward the player's current position — so the player approaches from
 * whichever side they're already on, rather than always attaching to one
 * fixed edge. If the player is already within `standoffDistance`, they
 * don't move at all (returns their current position unchanged). Identical
 * to Kitchen Shift's `approachPoint`.
 *
 * @param {number} stationX
 * @param {number} stationY
 * @param {number} fromX - the player's current x.
 * @param {number} fromY - the player's current y.
 * @param {number} standoffDistance - typically station.size / 2 + PLAYER_STOP_MARGIN.
 * @returns {{x: number, y: number}}
 */
export function approachPoint(stationX, stationY, fromX, fromY, standoffDistance) {
  const dx = fromX - stationX;
  const dy = fromY - stationY;
  const dist = Math.hypot(dx, dy);
  if (dist <= standoffDistance) return { x: fromX, y: fromY };
  const ratio = standoffDistance / dist;
  return { x: stationX + dx * ratio, y: stationY + dy * ratio };
}

/**
 * Clamps a proposed player position to stay within the canvas bounds (with
 * a small margin so the player sprite never draws half off-screen).
 * Identical to Kitchen Shift's `clampToCanvas`.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} [margin]
 * @returns {{x: number, y: number}}
 */
export function clampToCanvas(x, y, margin = 24) {
  const clampX = (value) => Math.min(CANVAS_WIDTH - margin, Math.max(margin, value));
  const clampY = (value) => Math.min(CANVAS_HEIGHT - margin, Math.max(margin, value));
  return { x: clampX(x), y: clampY(y) };
}

/**
 * The entry point the player lands at after switching to `floor` — the
 * pure lookup `library-game.js`'s floor-switch handler (fired from Stairs,
 * Elevator, or the HUD button alike) uses so all three call sites land in
 * the same spot.
 *
 * @param {number} floor - `FLOOR_1` or `FLOOR_2`.
 * @returns {{x: number, y: number}}
 */
export function entryPointForFloor(floor) {
  return floor === FLOOR_2 ? FLOOR_2_ENTRY_POINT : FLOOR_1_ENTRY_POINT;
}
