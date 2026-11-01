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

test('faces touching or behind the near plane are dropped', () => {
  const behind = at(quad(), 5);
  assert.deepEqual(buildDrawList(CAM, [behind], SCENE), []);
  // one vertex exactly on the near plane (z = -near) drops the face
  const onPlane = { vertices: [[-1, -1, -0.1], [1, -1, -3], [1, 1, -3]], faces: [{ indices: [0, 1, 2], color: '#fff' }] };
  assert.deepEqual(buildDrawList(CAM, [at(onPlane, 0)], SCENE), []);
  const clear = { vertices: [[-1, -1, -0.2], [1, -1, -3], [1, 1, -3]], faces: [{ indices: [0, 1, 2], color: '#fff' }] };
  assert.equal(buildDrawList(CAM, [at(clear, 0)], SCENE).length, 1);
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
});
