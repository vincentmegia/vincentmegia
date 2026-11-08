import test from 'node:test';
import assert from 'node:assert/strict';
import {
  identityMat4, multiplyMat4, transformPoint, cameraFromPose, projectPoint,
  buildDrawList, drawScene, shadeColor,
} from './core.js';

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
      color: 'rgb(110,176,240)', depth: 6.921060994002885, ground: false, alpha: 1,
    },
    {
      screen: [[314.69737707341363, 392.6134354641004], [474.9046792531569, 381.32434197177855],
        [474.9046792531569, 218.67565802822145], [314.69737707341363, 207.3865645358996]],
      color: 'rgb(177,132,107)', depth: 6, ground: false, alpha: 1,
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

// ---- textured faces (docs/skills/2d-to-3d/SKILL.md) ----
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
