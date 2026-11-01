import test from 'node:test';
import assert from 'node:assert/strict';
import {
  identityMat4, multiplyMat4, transformPoint, cameraFromPose, projectPoint,
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
