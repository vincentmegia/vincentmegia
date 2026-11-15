import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRoom, TILE, WALL_ART_TOP, WALL, WAINSCOT, CHAIR_RAIL, TRIM } from './room.js';
import {
  FLOOR_TILE, FLOOR_TILES, GUIDE_STRIPES, WALL_ART, WALL_ART_IDS, BACK_WALL,
  tileColor, floorDecals, floorRug, blendOver,
} from '../floor-dressing.js';
import { buildStations } from '../floor-plan.js';

const STATIONS = buildStations([
  { id: 'mystery' }, { id: 'romance' }, { id: 'scifi' }, { id: 'kids' }, { id: 'reference' },
]);
const dressed = (floor) => ({
  width: 960,
  depth: 600,
  height: 300,
  tileSize: FLOOR_TILE,
  tileColor: (col, row) => tileColor(floor, col, row),
  decals: floorDecals(floor, STATIONS),
  wallArt: WALL_ART_IDS.map((id) => ({ id, ...WALL_ART[id] })),
});
const OPTS = dressed(1);
const near = (a, b) => Math.abs(a - b) < 1e-6;
const pts = (m, f) => f.indices.map((i) => m.vertices[i]);
const span = (ps, axis) => [Math.min(...ps.map((p) => p[axis])), Math.max(...ps.map((p) => p[axis]))];
const isTile = (m) => (f) => f.ground && !f.decal;

test('buildRoom returns a mesh with valid indices', () => {
  const m = buildRoom(OPTS);
  assert.ok(Array.isArray(m.vertices) && Array.isArray(m.faces));
  for (const f of m.faces) {
    assert.match(f.color, /^#[0-9a-f]{6}$/i);
    for (const i of f.indices) assert.ok(i >= 0 && i < m.vertices.length);
  }
});

test('floor spans the full rectangle at y=0', () => {
  const m = buildRoom(OPTS);
  const fl = m.vertices.filter((v) => near(v[1], 0));
  assert.equal(Math.min(...fl.map((v) => v[0])), 0);
  assert.equal(Math.max(...fl.map((v) => v[0])), 960);
  assert.equal(Math.min(...fl.map((v) => v[2])), 0);
  assert.equal(Math.max(...fl.map((v) => v[2])), 600);
});

// P4: the FP floor is Top-Down's drawAnimeTiles checker, tile for tile.
test('the floor is the 2D checker: one FLOOR_TILE face per tile, in tileColor', () => {
  for (const floor of [1, 2]) {
    const m = buildRoom(dressed(floor));
    const tiles = m.faces.filter(isTile(m));
    assert.equal(tiles.length, (960 / FLOOR_TILE) * (600 / FLOOR_TILE), `floor ${floor} tile count`);
    for (const f of tiles) {
      const [x0, x1] = span(pts(m, f), 0);
      const [z0, z1] = span(pts(m, f), 2);
      assert.equal(x1 - x0, FLOOR_TILE);
      assert.equal(z1 - z0, FLOOR_TILE);
      assert.equal(f.color, tileColor(floor, x0 / FLOOR_TILE, z0 / FLOOR_TILE));
    }
  }
});

test('1st Floor is mint, 2nd Floor cream: the dark tiles are drawFloor’s own', () => {
  const colors = (floor) => new Set(buildRoom(dressed(floor)).faces.filter((f) => f.ground && !f.decal).map((f) => f.color));
  const f1 = colors(1);
  const f2 = colors(2);
  assert.ok(f1.has(FLOOR_TILES[1].dark) && !f1.has(FLOOR_TILES[2].dark));
  assert.ok(f2.has(FLOOR_TILES[2].dark) && !f2.has(FLOOR_TILES[1].dark));
  // The light tiles run drawAnimeTiles' gradient: tint(light, 0.3) under the
  // wall band, down to `light` itself at the front of the room.
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const close = (a, b, tol) => rgb(a).every((v, i) => Math.abs(v - rgb(b)[i]) <= tol);
  for (const floor of [1, 2]) {
    const { light } = FLOOR_TILES[floor];
    assert.ok(close(tileColor(floor, 1, 14), light, 2), `floor ${floor} front row ~ light`);
    const top = rgb(light).map((v) => Math.round(v + (255 - v) * 0.3));
    assert.ok(close(tileColor(floor, 0, 1), `#${top.map((v) => v.toString(16).padStart(2, '0')).join('')}`, 2), `floor ${floor} back row ~ tint(light, 0.3)`);
  }
});

test('the floor faces up, so it takes the scene light like every upward surface', () => {
  const m = buildRoom(OPTS);
  for (const f of m.faces.filter((x) => x.ground)) {
    const [a, b, c] = pts(m, f);
    const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    assert.ok(ny > 0, 'normal is +Y');
  }
});

test('ceiling exists at y=height', () => {
  const m = buildRoom(OPTS);
  const top = m.vertices.filter((v) => near(v[1], 300));
  assert.ok(top.length >= 4);
  assert.equal(Math.min(...top.map((v) => v[0])), 0);
  assert.equal(Math.max(...top.map((v) => v[2])), 600);
});

test('four walls enclose the box over the full height', () => {
  const m = buildRoom(OPTS);
  const spans = (axis, val) => {
    const ys = m.vertices.filter((v) => near(v[axis], val)).map((v) => v[1]);
    return Math.min(...ys) === 0 && Math.max(...ys) === 300;
  };
  assert.ok(spans(0, 0));
  assert.ok(spans(0, 960));
  assert.ok(spans(2, 0));
  assert.ok(spans(2, 600));
});

test('all vertices lie inside the room box', () => {
  const m = buildRoom(OPTS);
  for (const [x, y, z] of m.vertices) {
    assert.ok(x >= 0 && x <= 960 && y >= 0 && y <= 300 && z >= 0 && z <= 600);
  }
});

// The shell used to be six room-sized quads. With no z-buffer a face that
// large sorts by one mean depth, so the floor could paint over the objects
// standing on it, and the whole face vanished the moment it straddled the
// near plane (which, standing inside the room, it always does). Tiling keeps
// both the sort and the near-plane clip local.
test('no shell face spans more than one tile', () => {
  for (const floor of [1, 2]) {
    const m = buildRoom(dressed(floor));
    for (const f of m.faces) {
      const ps = pts(m, f);
      const biggest = Math.max(...[0, 1, 2].map((a) => span(ps, a)[1] - span(ps, a)[0]));
      assert.ok(biggest <= TILE, `face spans ${biggest.toFixed(1)} units (${f.color})`);
    }
  }
});

test('face count within budget', () => {
  // Tiling the shell trades face count for correct sorting and clipping; the
  // 2D's 40 px checker is 360 of them.
  for (const floor of [1, 2]) assert.ok(buildRoom(dressed(floor)).faces.length <= 900);
});

test('deterministic', () => {
  assert.deepEqual(buildRoom(OPTS), buildRoom(OPTS));
});

// core.js paints ground polys as their own layer, before everything resting on
// them, so that a wide floor tile's mean depth cannot sort in front of a patron
// and paint out their legs. That layer is selected by this flag alone, so if the
// floor ever stopped carrying it the sort would silently go back to mean depth
// and core.js's own test would still pass, on an empty ground layer. Only the
// floor (and the decals lying on it) may carry it: a wall or the ceiling in that
// layer WOULD occlude wrongly, since things stand in front of walls but never in
// front of the floor.
test('exactly the floor faces are marked ground', () => {
  const m = buildRoom(OPTS);
  const isFloor = (f) => f.indices.every((i) => near(m.vertices[i][1], 0));
  const floor = m.faces.filter(isFloor);
  assert.ok(floor.length > 0, 'the floor has faces');
  for (const f of m.faces) {
    assert.equal(Boolean(f.ground), isFloor(f),
      `face at y=${m.vertices[f.indices[0]][1]} ground=${Boolean(f.ground)}`);
  }
  // The wall bases also sit at y=0 but are not horizontal, so `isFloor` must not
  // have swept them in: the floor is exactly the tiles of the y=0 rectangle plus
  // the decals.
  const tiles = floor.filter((f) => !f.decal);
  assert.equal(tiles.length, (960 / FLOOR_TILE) * (600 / FLOOR_TILE), `floor tiles ${tiles.length}`);
});

// -- Decals: the guide stripes and rugs, at Top-Down's own world positions ----

const decalBoxes = (m, id) => m.faces.filter((f) => f.decal === id).map((f) => {
  const ps = pts(m, f);
  return { x: span(ps, 0), z: span(ps, 2), color: f.color };
});
const union = (boxes) => ({
  x: [Math.min(...boxes.map((b) => b.x[0])), Math.max(...boxes.map((b) => b.x[1]))],
  z: [Math.min(...boxes.map((b) => b.z[0])), Math.max(...boxes.map((b) => b.z[1]))],
});

test('1F guide stripes lie where drawFloor draws them, each piece the stripe over its tile', () => {
  const m = buildRoom(OPTS);
  const pieces = decalBoxes(m, 'stripe');
  const rug = floorRug(1, STATIONS);
  const overlap = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
  for (const s of GUIDE_STRIPES[1]) {
    const mine = pieces.filter((p) => p.z[0] >= s.y && p.z[1] <= s.y + s.h);
    assert.ok(mine.length > 0, `stripe at y ${s.y}`);
    // The pieces start where the stripe starts and, with the part the rug
    // covers (Top-Down lays the rug over it), make up exactly the stripe.
    assert.equal(union(mine).x[0], s.x);
    assert.deepEqual(union(mine).z, [s.y, s.y + s.h]);
    const area = mine.reduce((a, p) => a + (p.x[1] - p.x[0]) * (p.z[1] - p.z[0]), 0);
    const underRug = overlap(s.x, s.x + s.w, rug.x, rug.x + rug.w) * overlap(s.y, s.y + s.h, rug.y, rug.y + rug.h);
    assert.ok(near(area + underRug, s.w * s.h), `stripe at y ${s.y}: ${area} + ${underRug}`);
    for (const p of mine) {
      assert.ok(p.x[0] >= s.x && p.x[1] <= s.x + s.w);
      assert.equal(overlap(p.x[0], p.x[1], rug.x, rug.x + rug.w) * overlap(p.z[0], p.z[1], rug.y, rug.y + rug.h), 0, 'no stripe over the rug');
    }
    for (const p of mine) {
      const col = Math.floor(p.x[0] / FLOOR_TILE);
      const row = Math.floor(p.z[0] / FLOOR_TILE);
      assert.equal(p.color, blendOver(s.fill, tileColor(1, col, row)));
    }
  }
  assert.equal(decalBoxes(buildRoom(dressed(2)), 'stripe').length, 0, '2F has no guide stripes');
});

test('each floor’s rug lies where drawFloor draws it (1F coffee machine, 2F reading nook)', () => {
  for (const floor of [1, 2]) {
    const rug = floorRug(floor, STATIONS);
    assert.ok(rug, `floor ${floor} has a rug`);
    const boxes = decalBoxes(buildRoom(dressed(floor)), 'rug');
    assert.deepEqual(union(boxes), { x: [rug.x, rug.x + rug.w], z: [rug.y, rug.y + rug.h] });
  }
  // drawFloor's own placement formulas, on the shipped floor plan.
  const coffee = STATIONS.find((s) => s.kind === 'coffee-machine');
  const nook = STATIONS.find((s) => s.kind === 'reading-nook');
  assert.deepEqual(
    [floorRug(1, STATIONS).x, floorRug(1, STATIONS).y],
    [Math.min(coffee.x - 70, 960 - 196), coffee.y - 62],
  );
  assert.deepEqual([floorRug(2, STATIONS).x, floorRug(2, STATIONS).y], [nook.x - 110, nook.y - 62]);
});

test('a decal with an image wears it, mapped top-down over exactly its box', () => {
  const image = { width: 760, height: 480 };
  const rug = floorDecals(1, STATIONS).find((d) => d.id === 'rug');
  const m = buildRoom({ ...OPTS, decals: [{ ...rug, image }] });
  const faces = m.faces.filter((f) => f.decal === 'rug');
  assert.ok(faces.length > 0 && faces.every((f) => f.texture?.image === image));
  for (const f of faces) {
    f.indices.forEach((vi, k) => {
      const [x, , z] = m.vertices[vi];
      const [u, v] = f.texture.uv[k];
      assert.ok(near(u, ((x - rug.x) / rug.w) * image.width), 'u follows x');
      assert.ok(near(v, ((z - rug.y) / rug.h) * image.height), 'v follows z');
    });
  }
});

// -- Back-wall art: sign, sakura, wall shelf, clock, at Top-Down's x ---------

test('back-wall art sits on the z=0 wall at Top-Down’s x, above the rail, cut out of the wall', () => {
  const m = buildRoom(OPTS);
  const railY = 300 * 0.45;
  for (const id of WALL_ART_IDS) {
    const r = WALL_ART[id];
    const faces = m.faces.filter((f) => f.wallArt === id);
    assert.ok(faces.length > 0, id);
    const all = faces.flatMap((f) => pts(m, f));
    assert.ok(all.every((p) => p[2] === 0), `${id} lies on the back wall plane`);
    assert.deepEqual(span(all, 0), [r.x, r.x + r.w], `${id} x`);
    assert.deepEqual(span(all, 1), [WALL_ART_TOP - r.y - r.h, WALL_ART_TOP - r.y], `${id} height`);
    assert.ok(WALL_ART_TOP - r.y - r.h > railY, `${id} clears the rail`);
  }
  // No plain wall face overlaps any art box (they're coplanar, so an overlap
  // would be a sort coin-toss).
  const plain = m.faces.filter((f) => !f.wallArt && pts(m, f).every((p) => p[2] === 0));
  for (const f of plain) {
    const ps = pts(m, f);
    const [x0, x1] = span(ps, 0);
    const [y0, y1] = span(ps, 1);
    for (const id of WALL_ART_IDS) {
      const r = WALL_ART[id];
      const ax0 = r.x, ax1 = r.x + r.w, ay0 = WALL_ART_TOP - r.y - r.h, ay1 = WALL_ART_TOP - r.y;
      const overlaps = x0 < ax1 - 1e-9 && x1 > ax0 + 1e-9 && y0 < ay1 - 1e-9 && y1 > ay0 + 1e-9;
      assert.ok(!overlaps, `a ${f.color} wall face overlaps the ${id}`);
    }
  }
  // ...and the back wall is still whole: plain + art cover 0..960 x 0..300.
  const area = (fs) => fs.reduce((acc, f) => {
    const ps = pts(m, f);
    return acc + (span(ps, 0)[1] - span(ps, 0)[0]) * (span(ps, 1)[1] - span(ps, 1)[0]);
  }, 0);
  const wallFaces = m.faces.filter((f) => f.color === WALL && pts(m, f).every((p) => p[2] === 0));
  assert.ok(near(area(wallFaces), 960 * 300), `back wall area ${area(wallFaces)}`);
});

test('wall art with an image wears it upright, art x along the wall', () => {
  const image = { width: 784, height: 160 };
  const sign = { id: 'sign', ...WALL_ART.sign, image };
  const m = buildRoom({ ...OPTS, wallArt: [sign] });
  const faces = m.faces.filter((f) => f.wallArt === 'sign');
  assert.ok(faces.length > 0 && faces.every((f) => f.texture?.image === image && f.unlit));
  for (const f of faces) {
    f.indices.forEach((vi, k) => {
      const [x, y] = m.vertices[vi];
      const [u, v] = f.texture.uv[k];
      assert.ok(near(u, ((x - sign.x) / sign.w) * image.width), 'u follows x');
      assert.ok(near(v, ((WALL_ART_TOP - sign.y - y) / sign.h) * image.height), 'v runs down the wall');
    });
  }
});

test('the walls wear drawBackWall’s colours', () => {
  assert.equal(WALL, BACK_WALL.top);
  assert.equal(WAINSCOT, BACK_WALL.bottom);
  assert.equal(CHAIR_RAIL, BACK_WALL.rail);
  assert.equal(TRIM, BACK_WALL.trim);
  const colors = new Set(buildRoom(OPTS).faces.map((f) => f.color));
  for (const c of [WALL, WAINSCOT, CHAIR_RAIL, TRIM]) assert.ok(colors.has(c), c);
});

// The back wall is Top-Down's back-wall band: it shows the band's own colours
// (unlit, like a textured prop's front), and so does its art, so the art's
// opaque cream backing meets the wall around it without a step.
test('exactly the back wall (z=0) is unlit; the other walls take the light', () => {
  const m = buildRoom(OPTS);
  for (const f of m.faces) {
    const onBack = pts(m, f).every((p) => near(p[2], 0) || p[2] <= 0.2 + 1e-9) && span(pts(m, f), 1)[1] > span(pts(m, f), 1)[0];
    if (f.ground) continue;
    assert.equal(Boolean(f.unlit), onBack, `${f.color} face unlit=${Boolean(f.unlit)}`);
  }
});
