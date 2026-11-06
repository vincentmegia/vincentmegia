import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFirstPersonScene, meshForStationKind, ROOM_HEIGHT, BASE_EYE, UNIT_SCALE } from './scene.js';
import { buildDrawList } from './core.js';
import { buildBookshelf } from './meshes/bookshelf.js';
import { buildCoffeeMachine } from './meshes/coffee-machine.js';
import { buildStairs } from './meshes/stairs.js';
import { buildElevator } from './meshes/elevator.js';
import { buildStationBox } from './meshes/station-box.js';
// library-people.js is pure data (no imports, no DOM), so a real design is safe to load.
import { KAREN_DESIGN, findLibraryDesign } from '../library-people.js';

// Characters carry the same 2D design the top-down view draws, not a palette.
const DESIGN = findLibraryDesign('libExamStudent');
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
    characters: [{ x: 300, y: 350, floor: 1, design: DESIGN }],
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

test('a character entry carries a design and is placed in the scene', () => {
  const bare = buildFirstPersonScene(input({ characters: [] })).placed.length;
  const { placed } = buildFirstPersonScene(input({ characters: [{ x: 120, y: 340, design: DESIGN }] }));
  assert.equal(placed.length, bare + 1);
  const ch = placed[placed.length - 1];
  assert.deepEqual(ch.placement.pos, [120, 0, 340]);
  assert.equal(ch.placement.scale, UNIT_SCALE);
  // The design reaches buildCharacter: its own outfit colours are in the mesh.
  const colors = new Set(ch.mesh.faces.map((f) => f.color));
  assert.ok(colors.has(DESIGN.outfit.top), 'top colour');
  assert.ok(colors.has(DESIGN.outfit.shoes), 'shoe colour');
});

test('angry rides in buildCharacter opts, not in the character data', () => {
  const calm = buildFirstPersonScene(input({ characters: [{ x: 1, y: 2, design: KAREN_DESIGN }] }));
  const mad = buildFirstPersonScene(input({ characters: [{ x: 1, y: 2, design: KAREN_DESIGN, angry: true }] }));
  assert.notDeepEqual(mad.placed[mad.placed.length - 1].mesh, calm.placed[calm.placed.length - 1].mesh);
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

// ---- Regression: the first-person frame must be fully painted ----
// The canvas keeps whatever was drawn last frame, so any pixel the scene
// does not cover shows stale art (and the per-frame vignette compounds on
// it into a black smear). Standing inside the room shell, the shell alone
// has to cover every pixel of the viewport.
const LIGHT = { dir: [0.35, 1, 0.25], ambient: 0.5 };

// A sample that lands exactly on the shared edge of two tiles is counted as
// covered: the even-odd rule below assigns such a point to neither polygon,
// but the canvas paints both tiles up to that edge, so it is not a hole.
function pointInPoly(poly, px, py) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    const dx = xi - xj;
    const dy = yi - yj;
    const t = Math.max(0, Math.min(1, ((px - xj) * dx + (py - yj) * dy) / (dx * dx + dy * dy || 1)));
    if (Math.hypot(px - (xj + t * dx), py - (yj + t * dy)) < 1e-6) return true;
  }
  return inside;
}

function uncoveredPixels(pose, viewport = { width: 960, height: 600 }) {
  const { camera, placed } = buildFirstPersonScene(
    input({ player: pose, stations: [], characters: [], viewport }),
  );
  const list = buildDrawList(camera, placed, { viewport, light: LIGHT });
  const misses = [];
  for (let y = 4; y < viewport.height; y += 12) {
    for (let x = 4; x < viewport.width; x += 12) {
      if (!list.some((p) => pointInPoly(p.screen, x, y))) misses.push([x, y]);
    }
  }
  return misses;
}

test('the room shell covers the whole viewport from inside', () => {
  for (const pose of [
    { x: 480, y: 300, facing: 0 },
    { x: 480, y: 300, facing: Math.PI },
    { x: 60, y: 60, facing: Math.PI * 0.75 },
    { x: 900, y: 540, facing: -0.4 },
    { x: 480, y: 30, facing: 0 },
  ]) {
    const misses = uncoveredPixels(pose);
    assert.equal(
      misses.length,
      0,
      `facing ${pose.facing} at (${pose.x},${pose.y}): ${misses.length} unpainted samples, e.g. ${JSON.stringify(misses.slice(0, 3))}`,
    );
  }
});

test('the draw list stays sorted back to front once faces are clipped', () => {
  const viewport = { width: 960, height: 600 };
  const { camera, placed } = buildFirstPersonScene(
    input({ player: { x: 480, y: 500, facing: 0 }, viewport }),
  );
  const list = buildDrawList(camera, placed, { viewport, light: LIGHT });
  assert.ok(list.length > 0);
  for (let i = 1; i < list.length; i++) {
    assert.ok(list[i - 1].depth >= list[i].depth, 'draw list must stay sorted back to front');
  }
});
