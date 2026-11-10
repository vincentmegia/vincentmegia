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
import { buildReturnCart } from './meshes/return-cart.js';
import { buildFinesCounter } from './meshes/fines-counter.js';
import { buildBossOffice } from './meshes/boss-office.js';
import { buildReadingNook } from './meshes/reading-nook.js';
import { meshForDecorKind } from './meshes/decor.js';
import { FLOOR_TILE, tileColor, floorDecals, WALL_ART_IDS, roomArtRect } from '../floor-dressing.js';

export const ROOM_HEIGHT = 300;
export const BASE_EYE = 60;
export const NEAR = 1;
export const FAR = 2000;
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

// The room shell for one floor: Top-Down's checker, decals and back-wall art
// (library/floor-dressing.js). Rebuilt only when the floor, the room size, the
// decals or an art canvas's identity changes; a canvas repainted in place
// (the wall clock) needs no rebuild, since textures are read at draw time.
let roomMemo = null;

function roomMesh(floor, stations, viewport, roomArtFor) {
  const decals = floorDecals(floor, stations);
  const wallArt = WALL_ART_IDS.map((id) => ({ id, ...roomArtRect(floor, id, stations) }));
  const asked = new Map(); // id -> image, once per id (the stripes share one)
  const ask = (id) => {
    if (!asked.has(id)) asked.set(id, roomArtFor ? roomArtFor(id) ?? null : null);
    return asked.get(id);
  };
  const images = [...decals.map((d) => d.id), ...WALL_ART_IDS].map(ask);
  const key = `${floor}|${viewport.width}x${viewport.height}|${JSON.stringify(decals)}`;
  if (roomMemo && roomMemo.key === key && roomMemo.images.every((im, i) => im === images[i])) return roomMemo.mesh;
  decals.forEach((d, i) => { if (images[i]) d.image = images[i]; });
  wallArt.forEach((a, i) => { const im = images[decals.length + i]; if (im) a.image = im; });
  const mesh = buildRoom({
    width: viewport.width,
    depth: viewport.height,
    height: ROOM_HEIGHT,
    tileSize: FLOOR_TILE,
    tileColor: (col, row) => tileColor(floor, col, row),
    decals,
    wallArt,
  });
  roomMemo = { key, images, mesh };
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
 * @param {(id: string) => (CanvasImageSource | null | undefined)} [input.roomArtFor]
 *   the room art canvas for 'rug' or a WALL_ART id ('clock', 'shelf',
 *   'sakura', 'sign'), painted by floor-dressing.js's paintRoomArt for this
 *   floor; without one that piece is a flat face.
 */
export function buildFirstPersonScene({ player, floor, stations, characters, decor, cameraParams, viewport, artFor, optsFor, roomArtFor }) {
  const placed = [];
  const room = roomMesh(floor, stations, viewport, roomArtFor);
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
