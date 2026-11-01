import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStairs, STAIR_RISE_PER_STEP, STAIR_RUN_PER_STEP } from './stairs.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// y-levels of flat, upward-facing faces
const topLevels = (m) => {
  const ys = new Set();
  for (const f of m.faces) {
    const [a, b, c] = f.indices.map((i) => m.vertices[i]);
    const n = cross(sub(b, a), sub(c, a));
    const flat = f.indices.every((i) => Math.abs(m.vertices[i][1] - a[1]) < 1e-9);
    if (flat && n[1] > 0) ys.add(Math.round(a[1] * 1e6) / 1e6);
  }
  return [...ys].sort((p, q) => p - q);
};

test('returns a mesh', () => {
  const m = buildStairs();
  assert.ok(Array.isArray(m.vertices) && m.vertices.length > 0);
  assert.ok(Array.isArray(m.faces) && m.faces.length > 0);
});

test('exports finite positive step constants', () => {
  for (const v of [STAIR_RISE_PER_STEP, STAIR_RUN_PER_STEP]) {
    assert.ok(Number.isFinite(v) && v > 0);
  }
});

test('has at least `steps` increasing tread tops', () => {
  const tops = topLevels(buildStairs({ steps: 8 }));
  assert.ok(tops.length >= 8);
  for (let i = 1; i < tops.length; i++) assert.ok(tops[i] > tops[i - 1]);
});

test('base at y=0, height is steps * rise, ascends toward +z', () => {
  const steps = 8;
  const m = buildStairs({ steps });
  const ys = m.vertices.map((v) => v[1]);
  assert.ok(Math.abs(Math.min(...ys)) < 1e-9);
  assert.ok(Math.abs(Math.max(...ys) - steps * STAIR_RISE_PER_STEP) < 1e-9);
  const zs = m.vertices.map((v) => v[2]);
  assert.ok(Math.abs(Math.min(...zs)) < 1e-9);
});

test('face budget and valid indices', () => {
  const m = buildStairs();
  assert.ok(m.faces.length <= 90);
  for (const f of m.faces) for (const i of f.indices) assert.ok(i >= 0 && i < m.vertices.length);
});

test('deterministic', () => {
  assert.deepEqual(buildStairs(), buildStairs());
});
