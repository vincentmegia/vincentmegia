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
};

export function meshForStationKind(kind) {
  return Object.prototype.hasOwnProperty.call(BUILDERS, kind) ? BUILDERS[kind] : buildStationBox;
}

export function buildFirstPersonScene({ player, floor, stations, characters, cameraParams, viewport }) {
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
      placed.push({ mesh: builder(), placement: { pos: [s.x, 0, s.y], yaw: 0, scale: UNIT_SCALE } });
    }
  }

  for (const c of characters) {
    if (c.floor !== undefined && c.floor !== floor) continue;
    placed.push({ mesh: buildCharacter(c.palette), placement: { pos: [c.x, 0, c.y], yaw: 0, scale: UNIT_SCALE } });
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
