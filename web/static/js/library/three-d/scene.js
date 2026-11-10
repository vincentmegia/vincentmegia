// Per-frame first-person scene assembly: places the room, floor stations and
// characters and builds the camera. Pure/deterministic, no DOM. Task 11 draws it.
import { cameraFromPose } from './core.js';
import { buildRoom } from './room.js';
import { buildCharacter } from './meshes/character.js';
import { buildBookshelf } from './meshes/bookshelf.js';
import { buildStationBox } from './meshes/station-box.js';
import { buildCoffeeMachine } from './meshes/coffee-machine.js';
import { buildStairs } from './meshes/stairs.js';
import { buildElevator } from './meshes/elevator.js';
import { buildFrontDesk } from './meshes/front-desk.js';
import { buildReturnCart, RETURN_CART_BOOK_SLOTS } from './meshes/return-cart.js';
import { buildBook } from './meshes/book.js';
import { buildFinesCounter } from './meshes/fines-counter.js';
import { buildBossOffice } from './meshes/boss-office.js';
import { buildReadingNook } from './meshes/reading-nook.js';
import { meshForDecorKind } from './meshes/decor.js';

export const ROOM_HEIGHT = 300;
export const BASE_EYE = 60;
export const NEAR = 1;
export const FAR = 2000;
export const FLOOR_TINT = '#b08f5e';
// Unit-sized meshes (~1 = one metre) are scaled into game pixels.
export const UNIT_SCALE = 40;
const BOX_HEIGHT = 40;
const BOX_COLOR = '#8a6a44';

const BUILDERS = {
  bookshelf: buildBookshelf,
  'coffee-machine': buildCoffeeMachine,
  stairs: buildStairs,
  elevator: buildElevator,
  'front-desk': buildFrontDesk,
  'return-cart': buildReturnCart,
  'fines-counter': buildFinesCounter,
  'boss-office': buildBossOffice,
  'reading-nook': buildReadingNook,
};

export function meshForStationKind(kind) {
  return Object.prototype.hasOwnProperty.call(BUILDERS, kind) ? BUILDERS[kind] : buildStationBox;
}

// Station object -> {art, mesh}. Builders are pure, so a station's mesh only
// changes when its art does; the game keeps its station objects for the whole
// run, so identity hits every frame.
const stationMeshes = new WeakMap();

function stationMesh(s, builder, artFor, optsFor) {
  const art = artFor ? artFor(s) ?? undefined : undefined;
  const extra = optsFor ? optsFor(s) : undefined;
  const cacheKey = extra ? JSON.stringify(extra) : '';
  const hit = stationMeshes.get(s);
  if (hit && hit.art === art && hit.builder === builder && hit.cacheKey === cacheKey) return hit.mesh;
  const mesh = builder({ art, ...extra });
  stationMeshes.set(s, { art, builder, cacheKey, mesh });
  return mesh;
}

// Builder -> mesh. A decor prop's mesh depends on nothing but its kind, and
// the world inventory rebuilds its items every frame, so the memo is keyed on
// the builder: every plant in the room shares one read-only mesh.
const decorMeshes = new Map();

function decorMesh(builder) {
  let mesh = decorMeshes.get(builder);
  if (!mesh) {
    mesh = builder();
    decorMeshes.set(builder, mesh);
  }
  return mesh;
}

// `${id}|${title}|${coin}|${color}` -> {art, mesh}. Books come and go over a
// shift, so the memo is cleared once it holds more books than a cart shows
// several times over.
const bookMeshes = new Map();
const BOOK_MEMO_LIMIT = 64;

function bookMesh(book, art) {
  const key = `${book.id}|${book.title ?? ''}|${book.isCoinHunt ? 1 : 0}|${book.color}`;
  const hit = bookMeshes.get(key);
  if (hit && hit.art === art) return hit.mesh;
  if (bookMeshes.size >= BOOK_MEMO_LIMIT) bookMeshes.clear();
  const mesh = buildBook({ art, color: book.color, isCoinHunt: Boolean(book.isCoinHunt) });
  bookMeshes.set(key, { art, mesh });
  return mesh;
}

/**
 * @param {object} input
 * @param {(station: object) => (CanvasImageSource | null | undefined)} [input.artFor]
 *   a station's 2D art for its mesh to wear (docs/skills/2d-to-3d/SKILL.md);
 *   asked only for stations on this floor that have their own mesh.
 * @param {(station: object) => (object | undefined)} [input.optsFor]
 *   extra build options a station's kind needs (the Boss's Office's
 *   `{locked}`); they take part in the mesh memo's key.
 * @param {{decorKind: string, x: number, y: number, floor?: number}[]} [input.decor]
 *   decor props from the world inventory; a kind with no mesh is skipped.
 * @param {{id: string, title?: string, color: string, isCoinHunt?: boolean}[]} [input.cartBooks]
 *   the Return Cart's books in Top-Down slot order; the first
 *   RETURN_CART_BOOK_SLOTS.length stand on this floor's cart's top tray.
 * @param {(book: object) => (CanvasImageSource | null | undefined)} [input.bookArtFor]
 *   a cart book's painted cover (meshes/book.js's paintReturnCartBookArt).
 */
export function buildFirstPersonScene({ player, floor, stations, characters, decor, cartBooks, bookArtFor, cameraParams, viewport, artFor, optsFor }) {
  const placed = [];
  const room = buildRoom({ width: viewport.width, depth: viewport.height, height: ROOM_HEIGHT, floorTint: FLOOR_TINT });
  placed.push({ mesh: room, placement: { pos: [0, 0, 0], yaw: 0, scale: 1 } });

  for (const s of stations) {
    if (s.floor !== floor) continue;
    const builder = meshForStationKind(s.kind);
    if (builder === buildStationBox) {
      const width = s.w ?? 60;
      const depth = s.h ?? 40;
      placed.push({
        mesh: buildStationBox({ width, depth, height: BOX_HEIGHT, color: s.color ?? BOX_COLOR }),
        placement: { pos: [s.x, 0, s.y], yaw: 0, scale: 1 },
      });
    } else {
      placed.push({ mesh: stationMesh(s, builder, artFor, optsFor), placement: { pos: [s.x, 0, s.y], yaw: 0, scale: UNIT_SCALE } });
    }
  }

  const cart = cartBooks?.length ? stations.find((s) => s.kind === 'return-cart' && s.floor === floor) : null;
  if (cart) {
    cartBooks.slice(0, RETURN_CART_BOOK_SLOTS.length).forEach((book, i) => {
      const [bx, by, bz] = RETURN_CART_BOOK_SLOTS[i];
      const art = bookArtFor ? bookArtFor(book) ?? undefined : undefined;
      placed.push({
        mesh: bookMesh(book, art),
        placement: { pos: [cart.x + bx * UNIT_SCALE, by * UNIT_SCALE, cart.y + bz * UNIT_SCALE], yaw: 0, scale: UNIT_SCALE },
      });
    });
  }

  for (const d of decor ?? []) {
    if (d.floor !== undefined && d.floor !== floor) continue;
    const builder = meshForDecorKind(d.decorKind);
    if (!builder) continue;
    placed.push({ mesh: decorMesh(builder), placement: { pos: [d.x, 0, d.y], yaw: d.yaw ?? 0, scale: UNIT_SCALE } });
  }

  for (const c of characters) {
    if (c.floor !== undefined && c.floor !== floor) continue;
    placed.push({
      mesh: buildCharacter(c.design, { angry: Boolean(c.angry) }),
      placement: { pos: [c.x, 0, c.y], yaw: c.yaw ?? 0, scale: UNIT_SCALE, alpha: c.alpha ?? 1 },
    });
  }

  const camera = cameraFromPose(player, {
    eyeHeight: BASE_EYE + cameraParams.bobOffset + cameraParams.jumpOffset,
    pitch: cameraParams.pitch,
    roll: cameraParams.roll,
    fov: cameraParams.fov,
    aspect: viewport.width / viewport.height,
    near: NEAR,
    far: FAR,
  });
  return { camera, placed };
}
