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
      color: 'rgb(110,176,240)', depth: 6.921060994002885,
    },
    {
      screen: [[314.69737707341363, 392.6134354641004], [474.9046792531569, 381.32434197177855],
        [474.9046792531569, 218.67565802822145], [314.69737707341363, 207.3865645358996]],
      color: 'rgb(177,132,107)', depth: 6,
    },
  ]);
});
