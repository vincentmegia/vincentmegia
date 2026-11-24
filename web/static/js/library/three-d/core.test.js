import test from 'node:test';
import assert from 'node:assert/strict';
import {
  identityMat4, multiplyMat4, transformPoint, cameraFromPose, projectPoint,
  buildDrawList, drawScene, shadeColor, indexJoints, posedVertices,
} from './core.js';
import { box } from './meshes/geom.js';

const VP = { width: 800, height: 600 };
const OPTS = { eyeHeight: 1.6, fov: Math.PI / 3, aspect: 800 / 600, near: 0.1, far: 100 };
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

test('identity transform returns the vector with w=1', () => {
  assert.deepEqual(transformPoint(identityMat4(), [1, 2, 3]), [1, 2, 3, 1]);
});

test('multiplyMat4 with identity is a no-op', () => {
  const m = Array.from({ length: 16 }, (_, i) => i + 1);
  assert.deepEqual(multiplyMat4(identityMat4(), m), m);
  assert.deepEqual(multiplyMat4(m, identityMat4()), m);
});

test('point straight ahead (facing north) is horizontally centered', () => {
  const cam = cameraFromPose({ x: 10, y: 10, facing: 0 }, OPTS);
  const p = projectPoint(cam, [10, 1.6, 9], VP);
  assert.ok(p.visible);
  near(p.x, VP.width / 2);
  near(p.y, VP.height / 2);
  near(p.depth, 1);
});

test('facing east, a point east is centered', () => {
  const cam = cameraFromPose({ x: 10, y: 10, facing: Math.PI / 2 }, OPTS);
  near(projectPoint(cam, [12, 1.6, 10], VP).x, VP.width / 2);
});

test('right projects right, left projects left', () => {
  const cam = cameraFromPose({ x: 10, y: 10, facing: 0 }, OPTS);
  assert.ok(projectPoint(cam, [11, 1.6, 9], VP).x > VP.width / 2);
  assert.ok(projectPoint(cam, [9, 1.6, 9], VP).x < VP.width / 2);
});

test('higher points project higher on screen (smaller y)', () => {
  const cam = cameraFromPose({ x: 10, y: 10, facing: 0 }, OPTS);
  assert.ok(projectPoint(cam, [10, 3, 9], VP).y < VP.height / 2);
});

test('point behind the camera is not visible', () => {
  const cam = cameraFromPose({ x: 10, y: 10, facing: 0 }, OPTS);
  assert.equal(projectPoint(cam, [10, 1.6, 11], VP).visible, false);
});

test('camera position is the eye', () => {
  const cam = cameraFromPose({ x: 4, y: 7, facing: 1 }, OPTS);
  assert.deepEqual(cam.position, [4, 1.6, 7]);
});

test('positive pitch looks up: a high point nears center', () => {
  const flat = cameraFromPose({ x: 0, y: 0, facing: 0 }, OPTS);
  const up = cameraFromPose({ x: 0, y: 0, facing: 0 }, { ...OPTS, pitch: 0.3 });
  const a = projectPoint(flat, [0, 3, -5], VP).y;
  const b = projectPoint(up, [0, 3, -5], VP).y;
  assert.ok(b > a);
});

// ---- Task 2: draw list ----
const CAM = cameraFromPose({ x: 0, y: 0, facing: 0 }, { ...OPTS, eyeHeight: 0 });
const SCENE = { viewport: VP, light: { dir: [0, 0, 1], ambient: 0.2 } };
// quad in the XY plane facing +Z (toward the camera at z=0 looking down -Z)
const quad = (color = '#808080') => ({
  vertices: [[-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0]],
  faces: [{ indices: [0, 1, 2, 3], color }],
});
const at = (mesh, z, yaw = 0) => ({ mesh, placement: { pos: [0, 0, z], yaw, scale: 1 } });
const lightness = (c) => { const [r, g, b] = c.match(/\d+/g).map(Number); return (r + g + b) / 3; };

test('empty scene returns []', () => {
  assert.deepEqual(buildDrawList(CAM, [], SCENE), []);
});

test('polys are sorted farthest-first across meshes', () => {
  const list = buildDrawList(CAM, [at(quad(), -3), at(quad(), -10), at(quad(), -6)], SCENE);
  assert.equal(list.length, 3);
  assert.deepEqual(list.map((p) => Math.round(p.depth)), [10, 6, 3]);
  assert.equal(list[0].screen.length, 4);
});

test('faces entirely behind the near plane are dropped', () => {
  assert.deepEqual(buildDrawList(CAM, [at(quad(), 5)], SCENE), []);
  // exactly on the near plane (z = -near) has no area in front of it either
  const onPlane = { vertices: [[-1, -1, -0.1], [1, -1, -0.1], [1, 1, -0.1]], faces: [{ indices: [0, 1, 2], color: '#fff' }] };
  assert.deepEqual(buildDrawList(CAM, [at(onPlane, 0)], SCENE), []);
});

// Regression (the room shell): the floor/ceiling/walls the camera stands
// inside always straddle the near plane. Dropping such a face left a third of
// the first-person frame unpainted, so these faces must be CLIPPED, not
// dropped.
test('a face straddling the near plane is clipped, not dropped', () => {
  const straddling = {
    vertices: [[-1, -1, -3], [1, -1, -3], [1, -1, 5], [-1, -1, 5]],
    faces: [{ indices: [0, 1, 2, 3], color: '#808080' }],
  };
  const list = buildDrawList(CAM, [at(straddling, 0)], SCENE);
  assert.equal(list.length, 1);
  assert.ok(list[0].screen.length >= 3);
  for (const [x, y] of list[0].screen) {
    assert.ok(Number.isFinite(x) && Number.isFinite(y), `non-finite screen point ${x},${y}`);
    assert.ok(Math.abs(x) < 1e5 && Math.abs(y) < 1e5, `runaway screen point ${x},${y}`);
  }
  assert.ok(list[0].depth > 0);
});

test('a face with one vertex behind the camera is kept and clipped', () => {
  const tri = { vertices: [[-1, -1, 2], [1, -1, -3], [1, 1, -3]], faces: [{ indices: [0, 1, 2], color: '#fff' }] };
  const list = buildDrawList(CAM, [at(tri, 0)], SCENE);
  assert.equal(list.length, 1);
  assert.ok(list[0].screen.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)));
});

test('clipping does not change a face\'s shading', () => {
  const far = { vertices: [[-1, -1, -3], [1, -1, -3], [1, -1, -2], [-1, -1, -2]], faces: [{ indices: [0, 1, 2, 3], color: '#808080' }] };
  const straddling = { vertices: [[-1, -1, -3], [1, -1, -3], [1, -1, 5], [-1, -1, 5]], faces: [{ indices: [0, 1, 2, 3], color: '#808080' }] };
  const a = buildDrawList(CAM, [at(far, 0)], SCENE)[0];
  const b = buildDrawList(CAM, [at(straddling, 0)], SCENE)[0];
  assert.equal(a.color, b.color);
});

test('face toward the light is brighter than one facing away', () => {
  const toward = buildDrawList(CAM, [at(quad(), -5)], SCENE)[0];
  const away = buildDrawList(CAM, [at(quad(), -5, Math.PI)], SCENE)[0];
  assert.ok(lightness(toward.color) > lightness(away.color));
});

test('shadeColor scales and fogs as a pure transform', () => {
  assert.equal(shadeColor('#ffffff', 0.5), 'rgb(128,128,128)');
  assert.equal(shadeColor('#ffffff', 0, { color: '#000000', start: 0, end: 10 }, 10), 'rgb(0,0,0)');
  assert.equal(shadeColor('#ffffff', 1, { color: '#000000', start: 0, end: 10 }, 0), 'rgb(255,255,255)');
});

test('drawScene fills each poly via the ctx', () => {
  const calls = [];
  const ctx = new Proxy({}, { get: (_, k) => (...a) => calls.push(k), set: (_, k) => { calls.push('set:' + k); return true; } });
  drawScene(ctx, CAM, [at(quad(), -5)], SCENE);
  assert.ok(calls.includes('moveTo') && calls.includes('closePath') && calls.includes('fill'));
  // Each poly is also stroked in its own fill color, so adjacent faces (the
  // tiled room shell) don't show an antialiasing hairline between them.
  assert.ok(calls.includes('set:strokeStyle') && calls.includes('stroke'));
});

// ---- unlit faces ----
const litDir = (dir) => ({ ...SCENE, light: { dir, ambient: 0.2 } });
const quadWith = (extra) => {
  const q = quad('#808080');
  q.faces[0] = { ...q.faces[0], ...extra };
  return q;
};

test('an unlit face ignores light direction', () => {
  const toward = litDir([0, 0, 1]), away = litDir([0, 0, -1]);
  const unlit = quadWith({ unlit: true });
  assert.equal(
    buildDrawList(CAM, [at(unlit, -5)], toward)[0].color,
    buildDrawList(CAM, [at(unlit, -5)], away)[0].color,
  );
  // Control: the same mesh without the flag does react to the light.
  assert.notEqual(
    buildDrawList(CAM, [at(quad(), -5)], toward)[0].color,
    buildDrawList(CAM, [at(quad(), -5)], away)[0].color,
  );
});

test('an unlit face renders at full intensity', () => {
  const [p] = buildDrawList(CAM, [at(quadWith({ unlit: true }), -5)], litDir([0, 0, -1]));
  assert.equal(p.color, shadeColor('#808080', 1));
});

test('an unlit face still fogs with depth', () => {
  const scene = { ...SCENE, fog: { color: '#ffffff', start: 2, end: 20 } };
  const unlit = quadWith({ unlit: true });
  const nearC = buildDrawList(CAM, [at(unlit, -3)], scene)[0].color;
  const farC = buildDrawList(CAM, [at(unlit, -15)], scene)[0].color;
  assert.notEqual(nearC, farC);
  assert.ok(lightness(farC) > lightness(nearC)); // fog is white; far is closer to it
});

test('faces without the flag are unchanged', () => {
  // Golden output captured from buildDrawList before `unlit` existed.
  const mesh = {
    vertices: [[-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0], [-1, 1, -2], [1, 1, -2]],
    faces: [{ indices: [0, 1, 2, 3], color: '#c08060' }, { indices: [3, 2, 5, 4], color: '#40a0ff' }],
  };
  const scene = {
    viewport: VP, light: { dir: [0.35, 1, 0.25], ambient: 0.5 },
    fog: { color: '#e8dcc8', start: 2, end: 20 },
  };
  const placed = [{ mesh, placement: { pos: [0, 0, -6], yaw: 0.4, scale: 1 } }];
  const cam = cameraFromPose({ x: 0, y: 0, facing: 0 }, { ...OPTS, eyeHeight: 0 });
  assert.deepEqual(buildDrawList(cam, placed, scene), [
    {
      screen: [[314.69737707341363, 207.3865645358996], [474.9046792531569, 218.67565802822145],
        [408.97789672559924, 236.8750900293754], [281.4802270285438, 230.27829000410242]],
      color: 'rgb(110,176,240)', depth: 6.921060994002885, ground: false, decal: false, alpha: 1,
    },
    {
      screen: [[314.69737707341363, 392.6134354641004], [474.9046792531569, 381.32434197177855],
        [474.9046792531569, 218.67565802822145], [314.69737707341363, 207.3865645358996]],
      color: 'rgb(177,132,107)', depth: 6, ground: false, decal: false, alpha: 1,
    },
  ]);
});

// A ground plane cannot occlude what stands on it, but a painter's sort on mean
// depth does exactly that: the tile the camera stands on has a nearer centroid
// than a figure a few metres away, so it is painted LAST and covers that
// figure's feet and lower legs. room.js's TILE subdivision only narrows the
// band -- the whole-branch review measured a patron at interact range keeping
// 26% of its legs and losing its shoes entirely. So the plane sorts before
// everything resting on it, whatever the centroids say. This is sound for the
// shell because the floor is its lowest surface: walls rise from its edges and
// the ceiling is above, so neither overlaps a floor tile on screen.
test('ground polys are painted before everything that stands on them', () => {
  const cam = cameraFromPose({ x: 0, y: 0, facing: 0 }, { ...OPTS, eyeHeight: 60, near: 1, far: 2000 });
  // Two 120-deep floor tiles, as room.js emits them, and a figure standing just
  // inside the far edge of the NEAR tile: that tile's centroid (z -60) is nearer
  // than the figure (z -111), so mean-depth order paints the tile over it.
  const tile = (z0, z1) => ({
    vertices: [[-60, 0, z0], [60, 0, z0], [60, 0, z1], [-60, 0, z1]],
    faces: [{ indices: [0, 1, 2, 3], color: '#b08f5e', ground: true }],
  });
  const figure = {
    vertices: [
      [-4, 0, -119], [4, 0, -119], [4, 0, -111], [-4, 0, -111],
      [-4, 30, -119], [4, 30, -119], [4, 30, -111], [-4, 30, -111],
    ],
    faces: [{ indices: [3, 2, 6, 7], color: '#334455' }],
  };
  const flat = (m) => ({ mesh: m, placement: { pos: [0, 0, 0], yaw: 0, scale: 1 } });
  const list = buildDrawList(cam, [flat(tile(-120, 0)), flat(tile(-240, -120)), flat(figure)], SCENE);

  const lastGround = list.reduce((acc, p, i) => (p.ground ? i : acc), -1);
  const firstStanding = list.findIndex((p) => !p.ground);
  assert.ok(lastGround >= 0, 'a ground poly is drawn');
  assert.ok(firstStanding >= 0, 'a standing poly is drawn');
  assert.ok(lastGround < firstStanding,
    `ground poly at ${lastGround} is painted after the standing poly at ${firstStanding}`);
  // ...and the ground is still sorted farthest-first among itself, so its own
  // fog gradient and overlaps stay right.
  const groundDepths = list.filter((p) => p.ground).map((p) => p.depth);
  assert.deepEqual(groundDepths, [...groundDepths].sort((a, b) => b - a), 'ground not far-to-near');
});

// A decal (a rug, a guide stripe) lies ON the floor tiles, coplanar with them,
// so within the ground a mean-depth sort could still put a nearer tile over a
// farther rug. Decals are the ground's second pass: after every tile, textured
// or not, and before anything standing on the floor.
test('decal ground polys are painted after every floor tile and before standing polys', () => {
  const cam = cameraFromPose({ x: 0, y: 0, facing: 0 }, { ...OPTS, eyeHeight: 60, near: 1, far: 2000 });
  const flat = (m) => ({ mesh: m, placement: { pos: [0, 0, 0], yaw: 0, scale: 1 } });
  const plane = (z0, z1, extra) => ({
    vertices: [[-60, 0, z0], [-60, 0, z1], [60, 0, z1], [60, 0, z0]],
    faces: [{ indices: [0, 1, 2, 3], color: '#e6f6f0', ground: true, ...extra }],
  });
  // A rug far away (z -400) and a tile near (z -60): the rug is the farther
  // poly, so mean depth alone would paint it first and the tiles over it.
  const rug = plane(-420, -380, { decal: 'rug', texture: { image: { width: 8, height: 8 }, uv: [[0, 0], [0, 8], [8, 8], [8, 0]] } });
  const stripe = plane(-300, -296, { decal: 'stripe' });
  const tiles = [plane(-120, 0), plane(-440, -360)];
  const post = { vertices: [[-2, 0, -200], [2, 0, -200], [2, 40, -200], [-2, 40, -200]], faces: [{ indices: [0, 1, 2, 3], color: '#334455' }] };
  const list = buildDrawList(cam, [flat(rug), flat(stripe), ...tiles.map(flat), flat(post)], SCENE);
  const rank = (p) => (p.ground ? (p.decal ? 1 : 0) : 2);
  assert.ok(list.some((p) => p.decal && p.image), 'the textured rug keeps its ground/decal flags');
  assert.ok(list.some((p) => p.decal && !p.image), 'the flat stripe is a decal');
  for (let i = 1; i < list.length; i++) {
    assert.ok(rank(list[i - 1]) <= rank(list[i]), `layer order broken at ${i}: ${rank(list[i - 1])} then ${rank(list[i])}`);
  }
});

// ---- textured faces (docs/skills/convert-2d-to-3d/SKILL.md) ----
// A face may carry `texture: {image, uv, div?}`: the 2D drawer's own art,
// painted onto the face. uv is one [u, v] (texture px) per index.
const IMAGE = { width: 64, height: 32 };
const texQuad = (extra = {}) => {
  const q = quad('#808080');
  q.faces[0] = { ...q.faces[0], texture: { image: IMAGE, uv: [[0, 32], [64, 32], [64, 0], [0, 0]], ...extra } };
  return q;
};

test('a textured quad is emitted as two textured triangles per cell', () => {
  const list = buildDrawList(CAM, [at(texQuad(), -5)], SCENE);
  assert.equal(list.length, 2);
  for (const p of list) {
    assert.equal(p.image, IMAGE);
    assert.equal(p.screen.length, 3);
    assert.equal(p.uv.length, 3);
  }
  // The first triangle's corners keep the face's own uv.
  assert.deepEqual(list[0].uv, [[0, 32], [64, 32], [64, 0]]);
});

test('div subdivides the face into nu x nv cells with interpolated uv', () => {
  const list = buildDrawList(CAM, [at(texQuad({ div: [2, 3] }), -5)], SCENE);
  assert.equal(list.length, 2 * 2 * 3);
  const us = new Set(list.flatMap((p) => p.uv.map(([u]) => u)));
  assert.deepEqual([...us].sort((a, b) => a - b), [0, 32, 64]);
  // Cells carry their own depth, like room.js's tiles.
  assert.ok(list.every((p) => Number.isFinite(p.depth)));
});

test('a textured cell crossing the near plane falls back to a flat clipped poly', () => {
  // The quad passes through the camera plane: some cells are behind it.
  const q = {
    vertices: [[-1, -1, 1], [1, -1, 1], [1, -1, -9], [-1, -1, -9]],
    faces: [{ indices: [0, 1, 2, 3], color: '#808080', texture: { image: IMAGE, uv: [[0, 32], [64, 32], [64, 0], [0, 0]], div: [1, 4] } }],
  };
  const list = buildDrawList(CAM, [at(q, 0)], SCENE);
  assert.ok(list.some((p) => p.image), 'cells in front keep their texture');
  const flat = list.filter((p) => !p.image);
  assert.ok(flat.length >= 1, 'the straddling cell is drawn flat, not dropped');
  for (const p of flat) assert.match(p.color, /^rgb\(/);
});

test('a textured face carries its shading and fog for the draw pass', () => {
  const lit = buildDrawList(CAM, [at(texQuad(), -5)], litDir([0, 0, -1]));
  assert.ok(lit.every((p) => p.intensity < 1));
  const unlit = buildDrawList(CAM, [at(quadWith({ unlit: true, texture: texQuad().faces[0].texture }), -5)], litDir([0, 0, -1]));
  assert.ok(unlit.every((p) => p.intensity === 1));
  const fogged = buildDrawList(CAM, [at(texQuad(), -5)], { ...SCENE, fog: { color: '#e8dcc8', start: 0, end: 10 } });
  assert.ok(fogged.every((p) => p.fog > 0 && p.fog < 1 && p.fogColor === '#e8dcc8'));
});

test('drawScene paints a textured triangle with the image, clipped to it', () => {
  const calls = [];
  const ctx = new Proxy({}, { get: (_, k) => (...a) => calls.push([k, a]), set: (_, k) => { calls.push(['set:' + k]); return true; } });
  drawScene(ctx, CAM, [at(quadWith({ unlit: true, texture: texQuad().faces[0].texture }), -5)], SCENE);
  const names = calls.map(([k]) => k);
  assert.equal(names.filter((k) => k === 'drawImage').length, 2);
  assert.ok(names.includes('clip') && names.includes('transform'));
  for (const [k, a] of calls.filter(([k]) => k === 'drawImage')) assert.equal(a[0], IMAGE, k);
  // Unlit and unfogged: no shading overlay fill.
  assert.ok(!names.includes('fill'));
});

test('drawScene shades a lit, fogged textured triangle with an overlay', () => {
  const calls = [];
  const ctx = new Proxy({}, { get: (_, k) => (...a) => calls.push(k), set: (_, k) => { calls.push('set:' + k); return true; } });
  drawScene(ctx, CAM, [at(texQuad(), -5)], { ...litDir([0, 0, -1]), fog: { color: '#e8dcc8', start: 0, end: 10 } });
  assert.equal(calls.filter((k) => k === 'fill').length, 4, 'one darken + one fog fill per triangle');
});

// ---- opt-in back-face culling ----
// The painter's sort has no z-buffer, so a face turned away from the camera
// can still be painted over a nearer one (a bookshelf's crown top, above eye
// level, over its own sign). A face that sets `cull` is dropped when it faces
// away; meshes opt in only where their winding is tested.
test('a culled face is dropped when it faces away from the camera', () => {
  const facing = quadWith({ cull: true }); // normal +Z, camera at z=0 looking down -Z
  assert.equal(buildDrawList(CAM, [at(facing, -5)], SCENE).length, 1);
  assert.equal(buildDrawList(CAM, [at(facing, -5, Math.PI)], SCENE).length, 0, 'turned away');
});

test('faces without cull are drawn from either side, as before', () => {
  assert.equal(buildDrawList(CAM, [at(quad(), -5, Math.PI)], SCENE).length, 1);
});

test('a culled textured face is dropped when it faces away', () => {
  const t = texQuad();
  t.faces[0].cull = true;
  assert.equal(buildDrawList(CAM, [at(t, -5, Math.PI)], SCENE).length, 0);
});

test('a placement alpha rides onto every poly it produces', () => {
  const mesh = {
    vertices: [[-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0]],
    faces: [{ indices: [0, 1, 2, 3], color: '#c08060' }],
  };
  const scene = { viewport: VP, light: { dir: [0, 1, 0], ambient: 0.5 }, fog: null };
  const cam = cameraFromPose({ x: 0, y: 0, facing: 0 }, { ...OPTS, eyeHeight: 0 });
  const listFor = (alpha) => buildDrawList(cam, [{ mesh, placement: { pos: [0, 0, -6], yaw: 0, scale: 1, alpha } }], scene);
  assert.equal(listFor(0.4)[0].alpha, 0.4);
  assert.equal(listFor(undefined)[0].alpha, 1, 'no alpha given stays opaque');
  // Alpha is a paint property only: it must not move or recolour anything.
  const ghost = listFor(0.4)[0], solid = listFor(undefined)[0];
  assert.deepEqual(ghost.screen, solid.screen);
  assert.equal(ghost.color, solid.color);
});

// Only the near plane is clipped, so a face beside the frame used to reach the
// canvas anyway (the 2D checker floor made that ~400 wasted fills a frame).
// drawScene passes `cullOffscreen`; a bare buildDrawList keeps every face.
test('cullOffscreen drops faces wholly outside the viewport, flat or textured', () => {
  const beside = (m) => ({ mesh: m, placement: { pos: [40, 0, -5], yaw: 0, scale: 1 } });
  const tex = texQuad();
  for (const m of [quad(), tex]) {
    assert.ok(buildDrawList(CAM, [beside(m)], SCENE).length > 0, 'kept without the flag');
    assert.equal(buildDrawList(CAM, [beside(m)], { ...SCENE, cullOffscreen: true }).length, 0, 'dropped with it');
    assert.deepEqual(
      buildDrawList(CAM, [at(m, -5)], { ...SCENE, cullOffscreen: true }),
      buildDrawList(CAM, [at(m, -5)], SCENE),
      'an on-screen face is untouched',
    );
  }
});

// Plain mean-depth order, re-implemented independently of buildDrawList:
// every face that survives culling, keyed (layer, depth, push index), with
// the push index as an explicit tie-break. Flat faces only, and cameras far
// enough that nothing is near-clipped.
function referenceOrder(camera, placed) {
  const rows = [];
  placed.forEach(({ mesh, placement }, mi) => {
    const c = Math.cos(placement.yaw), sn = Math.sin(placement.yaw), k = placement.scale;
    // Scale, then turn about Y, then move: the same arithmetic as placing a mesh, so depths match to the bit.
    const world = mesh.vertices.map(([x0, y0, z0]) => {
      const x = x0 * k, y = y0 * k, z = z0 * k;
      return [x * c + z * sn + placement.pos[0], y + placement.pos[1], -x * sn + z * c + placement.pos[2]];
    });
    mesh.faces.forEach((f, fi) => {
      const [a, b, d] = f.indices.slice(0, 3).map((i) => world[i]);
      const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const v = [camera.position[0] - a[0], camera.position[1] - a[1], camera.position[2] - a[2]];
      if (f.cull && n[0] * v[0] + n[1] * v[1] + n[2] * v[2] <= 0) return;
      const depth = f.indices.reduce((s, i) => s + transformPoint(camera.viewProj, world[i])[3], 0) / f.indices.length;
      rows.push({ id: `${mi}:${fi}`, layer: f.ground ? (f.decal ? 1 : 0) : 2, depth, at: rows.length });
    });
  });
  rows.sort((p, q) => p.layer - q.layer || q.depth - p.depth || p.at - q.at);
  return rows.map((r) => r.id);
}

test('without `under` faces the draw list is exactly plain mean-depth order, ties in push order (checked against an independent re-implementation)', async () => {
  const { buildBookshelf } = await import('./meshes/bookshelf.js');
  const { buildCoffeeMachine } = await import('./meshes/coffee-machine.js');
  const { buildCharacter } = await import('./meshes/character.js');
  const twin = box([-0.5, 0, -0.5], [0.5, 1, 0.5], '#000000');
  twin.faces.forEach((f) => { f.cull = true; });
  // The twin box is placed twice at the same spot: every face of it ties exactly.
  const meshes = [buildBookshelf(), buildCoffeeMachine(), buildCharacter(null), twin, twin];
  assert.ok(meshes.every((m) => !m.faces.some((f) => f.under || f.texture)));
  const pos = [[-60, 0, 0], [0, 0, 40], [60, 0, -30], [0, 0, -80], [0, 0, -80]];
  let n = 0;
  const tagged = meshes.map((m) => ({ vertices: m.vertices, faces: m.faces.map((f) => ({ ...f, unlit: true, color: '#' + (++n).toString(16).padStart(6, '0') })) }));
  const ids = [];
  meshes.forEach((m, mi) => m.faces.forEach((_, fi) => ids.push(`${mi}:${fi}`)));
  const placed = tagged.map((mesh, i) => ({ mesh, placement: { pos: pos[i], yaw: i * 0.6, scale: 40 } }));
  const env = { viewport: { width: 400, height: 300 }, light: { dir: [0.35, 1, 0.25], ambient: 0.5 } };
  let ties = 0;
  for (let k = 0; k < 12; k++) {
    const a = k * 0.53;
    const cam = cameraFromPose({ x: Math.sin(a) * 420, y: Math.cos(a) * 420, facing: -a }, { eyeHeight: 60, pitch: ((k % 3) - 1) * 0.3, fov: Math.PI / 3, aspect: 4 / 3, near: 1, far: 3000 });
    const list = buildDrawList(cam, placed, env);
    const got = list.map((p) => { const [r, g, b] = p.color.match(/\d+/g).map(Number); return ids[((r << 16) | (g << 8) | b) - 1]; });
    assert.deepEqual(got, referenceOrder(cam, placed));
    for (let i = 1; i < list.length; i++) if (list[i].depth === list[i - 1].depth) ties++;
  }
  assert.ok(ties > 0, 'the twin boxes do tie');
});

test('an `under` face is drawn before every face of its mesh on or above its plane, and keeps its depth against other meshes', () => {
  // A wide slab whose top (its own colour) has a tall thin post standing on
  // its far edge: by mean depth the top's centre is nearer than the post, so
  // it would be drawn over it. A cube stands far behind, another in front.
  const slab = (under) => {
    const m = { vertices: [], faces: [] };
    const add = (part) => { const b = m.vertices.length; m.vertices.push(...part.vertices); for (const f of part.faces) m.faces.push({ ...f, indices: f.indices.map((i) => i + b), cull: true, unlit: true }); };
    const top = box([-2, 0.9, -1], [2, 1, 1], '#aa0000', { top: '#ff0000' });
    if (under) top.faces[4].under = true;
    add(top);
    add(box([-0.1, 1, -1], [0.1, 3, -0.8], '#00aa00'));
    return m;
  };
  const cube = box([-0.5, 0, -0.5], [0.5, 1, 0.5], '#0000aa');
  cube.faces = cube.faces.map((f) => ({ ...f, cull: true, unlit: true }));
  const env = { viewport: { width: 400, height: 400 }, light: { dir: [0, 1, 0], ambient: 1 } };
  const cam = cameraFromPose({ x: 0, y: 160, facing: 0 }, { eyeHeight: 90, pitch: 0.3, fov: Math.PI / 3, aspect: 1, near: 1, far: 2000 });
  const run = (under) => buildDrawList(cam, [
    { mesh: slab(under), placement: { pos: [0, 0, 0], yaw: 0, scale: 40 } },
    { mesh: cube, placement: { pos: [0, 0, -400], yaw: 0, scale: 40 } },
    { mesh: cube, placement: { pos: [0, 0, 120], yaw: 0, scale: 40 } },
  ], env);
  const idx = (list, color, keep = () => true) => list.map((p, i) => (p.color === shadeColor(color, 1) && keep(p) ? i : -1)).filter((i) => i >= 0);
  for (const under of [false, true]) {
    const list = run(under);
    const [top] = idx(list, '#ff0000');
    const post = idx(list, '#00aa00');
    assert.ok(top >= 0 && post.length > 0);
    if (under) assert.ok(post.every((i) => i > top), 'with `under` the top is drawn before the post');
    else assert.ok(post.some((i) => i < top), 'by mean depth alone the post is drawn first (the bug)');
    // The far cube is drawn before the whole slab and the near one after it, either way.
    const slabAll = [...idx(list, '#ff0000'), ...idx(list, '#aa0000'), ...post];
    const far = idx(list, '#0000aa', (p) => p.depth > 300);
    const nearCube = idx(list, '#0000aa', (p) => p.depth < 100);
    assert.ok(far.length > 0 && nearCube.length > 0);
    assert.ok(Math.max(...far) < Math.min(...slabAll), 'the far cube first');
    assert.ok(Math.min(...nearCube) > Math.max(...slabAll), 'the near cube last');
  }
});

test('an `under` face without `cull` is an ordinary face: the mesh keeps plain mean-depth order', () => {
  // The slab of the test above, but its top is `under` without `cull`. The
  // mesh is still hinted, because a small separate top far off to the side
  // is a proper `under` + `cull` one (it overlaps nothing on screen). Were
  // the demotion in buildDrawList missing, the slab's top would act as a
  // supporting surface and pull the post after it; it must not.
  const mesh = (under) => {
    const m = { vertices: [], faces: [] };
    const add = (part, cull) => { const b = m.vertices.length; m.vertices.push(...part.vertices); for (const f of part.faces) m.faces.push({ ...f, indices: f.indices.map((i) => i + b), unlit: true, cull }); };
    const top = box([-2, 0.9, -1], [2, 1, 1], '#aa0000', { top: '#ff0000' });
    top.faces[4].under = under;
    add(top, false);
    add(box([-0.1, 1, -1], [0.1, 3, -0.8], '#00aa00'), false);
    const side = box([29, 0, -1], [31, 0.2, 1], '#0000aa', { top: '#00ffff' });
    side.faces[4].under = under;
    add(side, true);
    return m;
  };
  const env = { viewport: { width: 400, height: 400 }, light: { dir: [0, 1, 0], ambient: 1 } };
  const cam = cameraFromPose({ x: 0, y: 160, facing: 0 }, { eyeHeight: 90, pitch: 0.3, fov: Math.PI / 3, aspect: 1, near: 1, far: 2000 });
  const run = (under) => buildDrawList(cam, [{ mesh: mesh(under), placement: { pos: [0, 0, 0], yaw: 0, scale: 40 } }], env)
    .map((p) => `${p.color}@${p.depth}`);
  const withUnder = run(true);
  const plain = run(false);
  assert.deepEqual(withUnder, plain);
  const post = (l) => l.map((s, i) => (s.startsWith(shadeColor('#00aa00', 1)) ? i : -1)).filter((i) => i >= 0);
  const top = plain.findIndex((s) => s.startsWith(shadeColor('#ff0000', 1)));
  assert.ok(top >= 0 && post(plain).some((i) => i < top), 'by mean depth the post is drawn before the top, so the guard is what keeps it so');
});

// -- Joints (walk animation) -------------------------------------------------
// A mesh may declare joints as vertex ranges with a pivot, and a placement may
// pose them; both are optional and absent means "exactly as before". See
// docs/features/library-first-person-3d.md's "Walk animation".

/** A two-box mesh: vertices 0..7 are a leg below y=1, 8..15 a torso above it. */
function jointedMesh() {
  const mesh = { vertices: [], faces: [] };
  const merge = (part) => {
    const n = mesh.vertices.length;
    mesh.vertices.push(...part.vertices);
    mesh.faces.push(...part.faces.map((f) => ({ ...f, indices: f.indices.map((i) => i + n) })));
    return [n, mesh.vertices.length];
  };
  const [legFrom, legTo] = merge(box([-0.2, 0, -0.2], [0.2, 1, 0.2], '#111'));
  merge(box([-0.4, 1, -0.3], [0.4, 2, 0.3], '#222'));
  mesh.joints = [{ name: 'leg.left', pivot: [0, 1, 0], from: legFrom, to: legTo }];
  return mesh;
}

const JOINT_CAM = cameraFromPose({ x: 0, y: 0, facing: 0 }, { ...OPTS, eyeHeight: 0 });
const JOINT_LIGHT = { dir: [0.3, -1, 0.2], ambient: 0.5 };
const JOINT_DRAW = { viewport: VP, light: JOINT_LIGHT, fog: null };
const placeAt = (extra = {}) => ({ pos: [0, 0, -6], yaw: 0, scale: 1, ...extra });

test('a mesh with no joints draws exactly as a plain mesh does', () => {
  const plain = box([-0.2, 0, -0.2], [0.2, 1, 0.2], '#111');
  const a = buildDrawList(JOINT_CAM, [{ mesh: plain, placement: placeAt() }], JOINT_DRAW);
  const jointless = { vertices: plain.vertices, faces: plain.faces };
  const b = buildDrawList(JOINT_CAM, [{ mesh: jointless, placement: placeAt({ jointPose: { 'leg.left': { rotX: 0.4 } } }) }], JOINT_DRAW);
  assert.deepEqual(b, a);
});

test('posing a joint moves its own vertex range and leaves the rest alone', () => {
  const mesh = indexJoints(jointedMesh());
  const j = mesh.joints[0];
  const posed = posedVertices(mesh, { 'leg.left': { rotX: 0.4 } });
  for (let i = 0; i < mesh.vertices.length; i++) {
    if (i >= j.from && i < j.to) continue;
    assert.deepEqual(posed[i], mesh.vertices[i], `vertex ${i} is outside the joint and must not move`);
  }
  const swung = posed.slice(j.from, j.to).some((v, k) => Math.abs(v[2] - mesh.vertices[j.from + k][2]) > 1e-9);
  assert.ok(swung, 'the leg should swing in z');
  // And it reaches the draw list, not just the vertex helper.
  const rest = buildDrawList(JOINT_CAM, [{ mesh, placement: placeAt() }], JOINT_DRAW);
  const drawnSwung = buildDrawList(JOINT_CAM, [{ mesh, placement: placeAt({ jointPose: { 'leg.left': { rotX: 0.4 } } }) }], JOINT_DRAW);
  assert.notDeepEqual(drawnSwung, rest);
});

test('a joint pivot is the one point its own rotation leaves fixed', () => {
  const mesh = indexJoints(jointedMesh());
  // The leg's top face sits exactly at the pivot height, so its corners stay
  // at the same distance from the pivot however far the joint swings.
  const posed = posedVertices(mesh, { 'leg.left': { rotX: 0.5 } });
  const distance = (v) => Math.hypot(v[0] - 0, v[1] - 1, v[2] - 0);
  for (let i = mesh.joints[0].from; i < mesh.joints[0].to; i++) {
    near(distance(posed[i]), distance(mesh.vertices[i]), 1e-9);
  }
});

test('the body rhythm lifts, leans and squashes about the feet', () => {
  const mesh = indexJoints(jointedMesh());
  const posed = posedVertices(mesh, {}, { lift: 0.1, lean: 0.2, squash: [1.1, 0.9] });
  // A foot vertex (y = 0) stays on the floor apart from the lift.
  const foot = mesh.vertices.findIndex((v) => v[1] === 0);
  near(posed[foot][1], 0.1);
  near(posed[foot][0], mesh.vertices[foot][0] * 1.1);
  // A vertex at the top leans toward +z — the character's own forward axis,
  // which the placement's yaw points along their travel.
  const top = mesh.vertices.findIndex((v) => v[1] === 2);
  assert.ok(posed[top][2] > mesh.vertices[top][2] * 1.1, 'the top should lean forward');
  near(posed[top][0], mesh.vertices[top][0] * 1.1);
});

test('a roll tilts the figure about its feet', () => {
  const mesh = indexJoints(jointedMesh());
  const posed = posedVertices(mesh, {}, { roll: 0.2 });
  const foot = mesh.vertices.findIndex((v) => v[1] === 0 && v[0] === 0.2);
  near(Math.hypot(posed[foot][0], posed[foot][1]), 0.2, 1e-9);
  const top = mesh.vertices.findIndex((v) => v[1] === 2);
  assert.ok(Math.abs(posed[top][0] - mesh.vertices[top][0]) > 0.1, 'the top should swing out');
});

test('back-face culling reads the posed vertices, not the rest pose', () => {
  // A one-face mesh whose rest normal points away from the camera and whose
  // posed normal points at it: culled at rest, drawn when posed.
  const quad = {
    vertices: [[-0.5, 1, 0], [0.5, 1, 0], [0.5, 1.001, -1], [-0.5, 1.001, -1]],
    faces: [{ indices: [0, 1, 2, 3], color: '#333', cull: true }],
    joints: [{ name: 'leg.left', pivot: [0, 1, 0], from: 0, to: 4 }],
  };
  const mesh = indexJoints(quad);
  const atRest = buildDrawList(JOINT_CAM, [{ mesh, placement: placeAt() }], JOINT_DRAW);
  const flipped = buildDrawList(JOINT_CAM, [{ mesh, placement: placeAt({ jointPose: { 'leg.left': { rotX: Math.PI / 2 } } }) }], JOINT_DRAW);
  assert.notEqual(atRest.length, flipped.length, 'posing should change what is culled');
});

test('indexJoints gives every vertex an entry and is idempotent', () => {
  const mesh = indexJoints(jointedMesh());
  assert.equal(mesh.vertexJoint.length, mesh.vertices.length);
  assert.equal(mesh.vertexJoint[0], 0);
  assert.equal(mesh.vertexJoint[mesh.vertices.length - 1], null);
  const again = indexJoints(mesh);
  assert.deepEqual(again.vertexJoint, mesh.vertexJoint);
});

test('a mesh with no joints is left without a vertexJoint table', () => {
  const plain = indexJoints(box([0, 0, 0], [1, 1, 1], '#444'));
  assert.equal(plain.vertexJoint, undefined);
});
