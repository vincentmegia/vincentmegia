import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFirstPersonScene, meshForStationKind, ROOM_HEIGHT, BASE_EYE } from './scene.js';
import { buildBookshelf } from './meshes/bookshelf.js';
import { buildCoffeeMachine } from './meshes/coffee-machine.js';
import { buildStairs } from './meshes/stairs.js';
import { buildElevator } from './meshes/elevator.js';
import { buildStationBox } from './meshes/station-box.js';

const PALETTE = { skin: '#e0b090', hair: '#222', top: '#3a6', bottom: '#348', angry: false };
const CAM = { bobOffset: 0, jumpOffset: 0, pitch: 0, roll: 0, fov: 1 };
function input(over = {}) {
  return {
    player: { x: 200, y: 300, facing: 0 },
    floor: 1,
    stations: [
      { kind: 'bookshelf', x: 100, y: 120, floor: 1 },
      { kind: 'coffee-machine', x: 400, y: 200, floor: 1 },
      { kind: 'bookshelf', x: 500, y: 250, floor: 2 },
    ],
    characters: [{ x: 300, y: 350, floor: 1, palette: PALETTE }],
    cameraParams: { ...CAM },
    viewport: { width: 960, height: 600 },
    ...over,
  };
}

test('places room + floor stations + characters, culls other floors', () => {
  const { placed } = buildFirstPersonScene(input());
  assert.equal(placed.length, 4);
  assert.deepEqual(placed[0].placement.pos, [0, 0, 0]);
  assert.deepEqual(placed[1].placement.pos, [100, 0, 120]);
  assert.deepEqual(placed[2].placement.pos, [400, 0, 200]);
  assert.deepEqual(placed[3].placement.pos, [300, 0, 350]);
  assert.ok(!placed.some((p) => p.placement.pos[0] === 500));
  assert.ok(ROOM_HEIGHT > 0);
});

test('meshForStationKind mapping and unknown fallback', () => {
  assert.equal(meshForStationKind('bookshelf'), buildBookshelf);
  assert.equal(meshForStationKind('coffee-machine'), buildCoffeeMachine);
  assert.equal(meshForStationKind('stairs'), buildStairs);
  assert.equal(meshForStationKind('elevator'), buildElevator);
  assert.equal(meshForStationKind('front-desk'), buildStationBox);
  assert.doesNotThrow(() => meshForStationKind('totally-unknown-kind'));
  assert.equal(meshForStationKind('totally-unknown-kind'), buildStationBox);
});

test('unknown station kind places a box without throwing', () => {
  const inp = input({ stations: [{ kind: 'nope', x: 10, y: 20, floor: 1 }], characters: [] });
  const { placed } = buildFirstPersonScene(inp);
  assert.equal(placed.length, 2);
  assert.deepEqual(placed[1].placement.pos, [10, 0, 20]);
});

test('camera params thread through', () => {
  const base = buildFirstPersonScene(input()).camera;
  const bob = buildFirstPersonScene(input({ cameraParams: { ...CAM, bobOffset: 5 } })).camera;
  const jump = buildFirstPersonScene(input({ cameraParams: { ...CAM, jumpOffset: 7 } })).camera;
  assert.ok(Math.abs(base.position[1] - BASE_EYE) < 1e-6);
  assert.ok(bob.position[1] > base.position[1]);
  assert.ok(Math.abs(jump.position[1] - (BASE_EYE + 7)) < 1e-6);
  const roll = buildFirstPersonScene(input({ cameraParams: { ...CAM, roll: 0.2 } })).camera;
  const fov = buildFirstPersonScene(input({ cameraParams: { ...CAM, fov: 1.4 } })).camera;
  assert.notDeepEqual(Array.from(roll.viewProj), Array.from(base.viewProj));
  assert.notDeepEqual(Array.from(fov.viewProj), Array.from(base.viewProj));
});
