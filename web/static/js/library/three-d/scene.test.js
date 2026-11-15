import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFirstPersonScene, meshForStationKind, ROOM_HEIGHT, BASE_EYE, UNIT_SCALE } from './scene.js';
import { buildDrawList, projectPoint } from './core.js';
import { FRAME } from './meshes/character-frame.js';
import { buildBookshelf } from './meshes/bookshelf.js';
import { buildCoffeeMachine } from './meshes/coffee-machine.js';
import { buildStairs } from './meshes/stairs.js';
import { buildElevator, elevatorDoorOpts, ELEVATOR_DOOR_STEPS } from './meshes/elevator.js';
import { createTransition, updateTransition, transitionCamera } from './transitions.js';
import { buildFrontDesk } from './meshes/front-desk.js';
import { buildReturnCart } from './meshes/return-cart.js';
import { buildFinesCounter } from './meshes/fines-counter.js';
import { buildBossOffice } from './meshes/boss-office.js';
import { buildReadingNook } from './meshes/reading-nook.js';
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
  assert.equal(meshForStationKind('front-desk'), buildFrontDesk);
  assert.equal(meshForStationKind('return-cart'), buildReturnCart);
  assert.equal(meshForStationKind('fines-counter'), buildFinesCounter);
  assert.equal(meshForStationKind('boss-office'), buildBossOffice);
  assert.equal(meshForStationKind('reading-nook'), buildReadingNook);
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

// This used to assert one back-to-front run over the whole list. core.js now
// paints the ground as its own layer first, so depth restarts at the far end
// once the floor is done: the invariant is back-to-front WITHIN a layer, plus
// the layer split itself. Asserting it across the join would forbid the fix for
// the floor painting over a patron's legs, which is the whole point.
test('the draw list stays sorted back to front within each layer', () => {
  const viewport = { width: 960, height: 600 };
  const { camera, placed } = buildFirstPersonScene(
    input({ player: { x: 480, y: 500, facing: 0 }, viewport }),
  );
  const list = buildDrawList(camera, placed, { viewport, light: LIGHT });
  assert.ok(list.length > 0);
  // Three layers: floor tiles, then the floor's decals (stripes, rugs), then
  // everything standing on the floor.
  const rank = (p) => (p.ground ? (p.decal ? 1 : 0) : 2);
  for (let i = 1; i < list.length; i++) assert.ok(rank(list[i - 1]) <= rank(list[i]), 'each layer is one contiguous run, in order');
  const split = list.findIndex((p) => !p.ground);
  assert.ok(split > 0, 'the floor is drawn, and before everything standing on it');
  assert.ok(list.some((p) => p.decal), 'the rug under the coffee machine is drawn');
  for (const layer of [0, 1, 2].map((r) => list.filter((p) => rank(p) === r))) {
    for (let i = 1; i < layer.length; i++) {
      assert.ok(layer[i - 1].depth >= layer[i].depth, 'each layer must stay sorted back to front');
    }
  }
});

// Even-odd point-in-polygon, and the colour a player actually sees at a pixel:
// the LAST poly in paint order that covers it.
const covers = (poly, x, y) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < xi + ((xj - xi) * (y - yi)) / (yj - yi)) inside = !inside;
  }
  return inside;
};
const topColourAt = (list, x, y) => {
  let c = null;
  for (const p of list) if (covers(p.screen, x, y)) c = p.color;
  return c;
};

// Blocking finding 2 of the whole-branch review: the floor tile the patron
// stands on sorted NEARER than the patron (a wide tile's mean depth beats a
// figure a couple of metres off) and painted over their lower body. At interact
// range only 26% of the legs survived and the shoes never did at all — which
// voided most of this branch's leg work.
//
// Asserting the draw order is not enough on its own, because it cannot tell
// whether the surviving order puts the patron where a player can see them. So
// this renders the same scene twice, with the patron and without, and samples
// up the patron's centre line: a sample whose top colour changes is a pixel the
// patron won off the floor. The legs are the band from the floor to FRAME.hem.
test('a patron at interact range keeps its legs and feet on screen', () => {
  const viewport = { width: 960, height: 600 };
  // Dead ahead at 120 units: facing 0 looks down -z, so the patron is 120 nearer.
  const base = {
    player: { x: 480, y: 500, facing: 0 },
    stations: [],
    characters: [{ x: 480, y: 380, floor: 1, design: DESIGN }],
    viewport,
  };
  const shown = buildFirstPersonScene(input(base));
  const hidden = buildFirstPersonScene(input({ ...base, characters: [] }));
  const opts = { viewport, light: LIGHT };
  const lit = buildDrawList(shown.camera, shown.placed, opts);
  const bare = buildDrawList(hidden.camera, hidden.placed, opts);

  const foot = projectPoint(shown.camera, [480, 0, 380], viewport);
  const hem = projectPoint(shown.camera, [480, FRAME.hem * UNIT_SCALE, 380], viewport);
  assert.ok(foot.visible && hem.visible, 'the legs are on screen at all');
  assert.ok(foot.y > hem.y, `foot ${foot.y} should project below hem ${hem.y}`);

  // The figure stands on two legs with a gap on its centre line, so sampling
  // that line alone reads the floor between the legs as a loss. A row counts as
  // visible when ANY pixel across the figure's width is the patron's; a row
  // where none is, is a row the floor swallowed whole. That band, counted up
  // from the feet, is what the review measured.
  const N = 20;
  const swallowed = [];
  for (let i = 0; i <= N; i++) {
    const py = hem.y + ((foot.y - hem.y) * i) / N;
    let won = false;
    for (let px = foot.x - 30; px <= foot.x + 30 && !won; px += 1) {
      if (topColourAt(lit, px, py) !== topColourAt(bare, px, py)) won = true;
    }
    if (!won) swallowed.push(Math.round(py));
  }
  assert.deepEqual(swallowed, [],
    `${swallowed.length}/${N + 1} leg rows are entirely floor, at screen y ${swallowed}`);
});

// ---- prop art (docs/skills/2d-to-3d/SKILL.md) ----
const shelfMeshes = (scene) => scene.placed.filter((p) => p.mesh.faces.some((f) => f.texture));

test('artFor hands each station its 2D art; the bookshelf wears it', () => {
  const asked = [];
  const art = { width: 372, height: 726 };
  const inp = input();
  const scene = buildFirstPersonScene({ ...inp, artFor: (st) => { asked.push(st); return st.kind === 'bookshelf' ? art : null; } });
  assert.ok(asked.includes(inp.stations[0]), 'asked for the floor-1 bookshelf');
  assert.ok(!asked.includes(inp.stations[2]), 'not asked for another floor');
  const shelves = shelfMeshes(scene);
  assert.equal(shelves.length, 1);
  assert.ok(shelves[0].mesh.faces.filter((f) => f.texture).every((f) => f.texture.image === art));
  assert.equal(shelves[0].placement.scale, UNIT_SCALE);
});

test('the coffee machine wears its art, and a new canvas (out of order) rebuilds just its mesh', () => {
  const inp = input();
  const machineAt = (placed) => placed.find((p) => p.placement.pos[0] === 400 && p.placement.pos[2] === 200);
  const working = { width: 336, height: 378 };
  const taped = { width: 336, height: 378 };
  const frame = (a) => buildFirstPersonScene({ ...inp, artFor: (st) => (st.kind === 'coffee-machine' ? a : null) }).placed;
  const m1 = machineAt(frame(working));
  assert.equal(m1.placement.scale, UNIT_SCALE);
  const tex = m1.mesh.faces.filter((f) => f.texture);
  assert.ok(tex.length > 0 && tex.every((f) => f.texture.image === working));
  assert.equal(machineAt(frame(working)).mesh, m1.mesh, 'reused while the art is unchanged');
  const m2 = machineAt(frame(taped)).mesh;
  assert.notEqual(m2, m1.mesh);
  assert.ok(m2.faces.filter((f) => f.texture).every((f) => f.texture.image === taped));
});

test('the elevator wears its own art too, facing the player (-Z), at UNIT_SCALE', () => {
  const art = { width: 252, height: 342 };
  const lift = { kind: 'elevator', x: 80, y: 540, floor: 1, targetFloor: 2 };
  const scene = buildFirstPersonScene(input({ stations: [lift], characters: [] }));
  const flat = scene.placed[1];
  assert.ok(!flat.mesh.faces.some((f) => f.texture), 'no artFor: flat colours');
  const dressed = buildFirstPersonScene(input({ stations: [lift], characters: [], artFor: (s) => (s === lift ? art : null) })).placed[1];
  const tex = dressed.mesh.faces.filter((f) => f.texture);
  assert.ok(tex.length > 0 && tex.every((f) => f.texture.image === art));
  assert.equal(dressed.placement.scale, UNIT_SCALE);
  assert.deepEqual(dressed.placement.pos, [80, 0, 540]);
  assert.equal(dressed.placement.yaw, 0, 'doors keep facing -Z, toward the room (the elevator sits at the room\'s south edge)');
});

test('without artFor the bookshelf falls back to flat colours', () => {
  assert.equal(shelfMeshes(buildFirstPersonScene(input())).length, 0);
});

test('a station mesh is built once per art, then reused frame to frame', () => {
  const inp = input();
  const art = { width: 372, height: 726 };
  const frame = (a) => buildFirstPersonScene({ ...inp, artFor: () => a }).placed;
  const meshOf = (placed) => placed.find((p) => p.placement.pos[0] === 100 && p.placement.pos[2] === 120).mesh;
  const first = meshOf(frame(art));
  assert.equal(meshOf(frame(art)), first, 'same art: same mesh object');
  const other = { width: 372, height: 726 };
  assert.notEqual(meshOf(frame(other)), first, 'new art: rebuilt');
});

test('the stairs wear their own badge art, centred on the station, foot toward +Z', () => {
  const up = { id: 'stairs-1', kind: 'stairs', x: 880, y: 115, floor: 1, targetFloor: 2 };
  const down = { id: 'stairs-2', kind: 'stairs', x: 880, y: 115, floor: 2, targetFloor: 1 };
  const arts = new Map([[up, { width: 192, height: 192 }], [down, { width: 192, height: 192 }]]);
  for (const st of [up, down]) {
    const scene = buildFirstPersonScene({ ...input({ stations: [up, down], floor: st.floor }), artFor: (s) => arts.get(s) });
    const stairs = scene.placed.filter((p) => p.mesh.faces.some((f) => f.part === 'tread'));
    assert.equal(stairs.length, 1);
    const [p] = stairs;
    assert.deepEqual(p.placement, { pos: [880, 0, 115], yaw: 0, scale: UNIT_SCALE });
    const badge = p.mesh.faces.filter((f) => f.texture);
    assert.equal(badge.length, 1);
    assert.equal(badge[0].texture.image, arts.get(st));
    const zs = p.mesh.vertices.map((v) => v[2]);
    assert.ok(Math.abs(Math.max(...zs) + Math.min(...zs)) < 1e-9, 'centred in z');
  }
});

test('a character placement carries its own yaw and alpha', () => {
  const inp = input({
    characters: [
      { x: 300, y: 350, floor: 1, design: DESIGN, yaw: Math.PI / 2 },
      { x: 320, y: 350, floor: 1, design: DESIGN, alpha: 0.4 },
      { x: 340, y: 350, floor: 1, design: DESIGN },
    ],
  });
  const { placed } = buildFirstPersonScene(inp);
  const people = placed.slice(-3).map((p) => p.placement);
  assert.equal(people[0].yaw, Math.PI / 2);
  assert.equal(people[0].alpha, 1, 'yaw alone leaves alpha opaque');
  assert.equal(people[1].alpha, 0.4);
  assert.equal(people[1].yaw, 0, 'alpha alone leaves yaw facing +Z');
  assert.deepEqual([people[2].yaw, people[2].alpha], [0, 1], 'neither given: the old defaults');
});

test("buildBossOffice's locked state changes the mesh and busts the memo", () => {
  const office = { id: 'boss-1', kind: 'boss-office', x: 500, y: 200, floor: 1 };
  const meshFor = (locked) => {
    const scene = buildFirstPersonScene({
      ...input({ stations: [office], characters: [] }),
      optsFor: () => ({ locked }),
    });
    return scene.placed.find((p) => p.placement.pos[0] === 500).mesh;
  };
  const open = meshFor(false);
  const shut = meshFor(true);
  assert.notEqual(open, shut, 'a different locked state rebuilds');
  assert.ok(shut.faces.length > open.faces.length, 'locked adds the lock badge');
  assert.equal(meshFor(true), shut, 'the same state hits the memo');
});

test('an elevator ride opens the ridden car\'s doors through optsFor, rebuilding a bounded number of times', () => {
  const ridden = { id: 'elevator-2', kind: 'elevator', x: 80, y: 540, floor: 1 };
  const other = { id: 'elevator-x', kind: 'elevator', x: 300, y: 540, floor: 1 };
  let ride = createTransition('elevator', 2);
  const optsFor = (s) => (s === ridden ? elevatorDoorOpts(transitionCamera(ride).doorOpen) : undefined);
  const meshesOf = (s) => buildFirstPersonScene({ ...input({ stations: [ridden, other], characters: [] }), optsFor })
    .placed.find((p) => p.placement.pos[0] === s.x).mesh;
  const closed = meshesOf(ridden);
  const otherMesh = meshesOf(other);
  const ridden_ = new Set([closed]);
  let frames = 0;
  while (ride.phase !== 'done') {
    ride = updateTransition(ride, 1 / 60);
    frames++;
    ridden_.add(meshesOf(ridden));
    assert.equal(meshesOf(other), otherMesh, 'only the ridden elevator changes');
  }
  assert.ok(frames > 100);
  assert.equal(ridden_.size, ELEVATOR_DOOR_STEPS + 1, 'shut plus one rebuild per 1/16 step, not one per frame');
  // Shut during doors-close and the rise: the approach's mesh (one memo entry
  // per station, so it rebuilds once after the open one, to the same mesh).
  ride = updateTransition(createTransition('elevator', 2), 1.0);
  assert.deepEqual(meshesOf(ridden), closed);
  // The fully open mesh has no door faces; a half-open one has narrower doors.
  ride = updateTransition(createTransition('elevator', 2), 1.4 + 0.3);
  const half = meshesOf(ridden);
  assert.notDeepEqual(half.vertices, closed.vertices);
  assert.deepEqual(half, buildElevator({ doorOpen: 0.5 }));
});

test('decor is placed on its own floor and shares one mesh per kind', () => {
  const decor = [
    { decorKind: 'plant', x: 930, y: 240, floor: 1 },
    { decorKind: 'plant', x: 930, y: 420, floor: 1 },
    { decorKind: 'water-cooler', x: 200, y: 120, floor: 1 },
    { decorKind: 'ladder', x: 150, y: 300, floor: 2 },
  ];
  const { placed } = buildFirstPersonScene({ ...input({ characters: [] }), decor });
  const props = placed.filter((p) => decor.some((d) => d.x === p.placement.pos[0] && d.y === p.placement.pos[2]));
  assert.equal(props.length, 3, "floor 2's ladder is left out");
  const plants = props.filter((p) => p.placement.pos[0] === 930);
  assert.equal(plants.length, 2);
  assert.equal(plants[0].mesh, plants[1].mesh, 'both plants share the memoised mesh');
  assert.notEqual(plants[0].mesh, props.find((p) => p.placement.pos[0] === 200).mesh);
});

test('a decor kind with no mesh yet is skipped, not drawn as a box', () => {
  const decor = [{ decorKind: 'vending-machine', x: 300, y: 300, floor: 1 }];
  const bare = buildFirstPersonScene(input({ characters: [] })).placed.length;
  const { placed } = buildFirstPersonScene({ ...input({ characters: [] }), decor });
  assert.equal(placed.length, bare);
});

test('Return Cart books stand on this floor\'s cart top tray, in slot order, at most five, memoised', async () => {
  const { RETURN_CART_BOOK_SLOTS } = await import('./meshes/return-cart.js');
  const { BOOK_SIZE } = await import('./meshes/book.js');
  const cart = { kind: 'return-cart', x: 300, y: 115, floor: 1 };
  const books = Array.from({ length: 7 }, (_, i) => ({ id: `b${i}`, title: `T${i}`, color: '#8fd3ff', isCoinHunt: i === 1 }));
  const art = { width: 160, height: 208 };
  const asked = [];
  const run = (over) => buildFirstPersonScene(input({ stations: [cart], characters: [], cartBooks: books, bookArtFor: (b) => { asked.push(b.id); return art; }, ...over }));
  const { placed } = run();
  // room + cart + 5 books
  assert.equal(placed.length, 7);
  const bookPlaced = placed.slice(2);
  bookPlaced.forEach((p, i) => {
    const [bx, by, bz] = RETURN_CART_BOOK_SLOTS[i];
    assert.deepEqual(p.placement.pos, [cart.x + bx * UNIT_SCALE, by * UNIT_SCALE, cart.y + bz * UNIT_SCALE]);
    assert.equal(p.placement.scale, UNIT_SCALE);
    const ys = p.mesh.vertices.map((v) => v[1]);
    assert.ok(Math.abs(Math.max(...ys) - BOOK_SIZE.height) < 1e-9 || i === 1, 'a plain book is its own height');
    assert.equal(p.mesh.faces[0].texture.image, art);
  });
  assert.deepEqual(asked, ['b0', 'b1', 'b2', 'b3', 'b4']);
  assert.ok(bookPlaced[1].mesh.faces.length > bookPlaced[0].mesh.faces.length, 'the Coin Hunt book carries its star');
  // Memoised per book: the same book and art reuse the mesh next frame.
  const again = run().placed.slice(2);
  again.forEach((p, i) => assert.equal(p.mesh, bookPlaced[i].mesh));
  // Another floor's cart shows none; no books, none.
  assert.equal(run({ floor: 2 }).placed.length, 1);
  assert.equal(run({ cartBooks: [] }).placed.length, 2);
});
