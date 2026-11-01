import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCoffeeMachine, PALETTE_COLORS } from './coffee-machine.js';

const extents = (m) => {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const v of m.vertices) for (let i = 0; i < 3; i++) {
    min[i] = Math.min(min[i], v[i]);
    max[i] = Math.max(max[i], v[i]);
  }
  return { min, max };
};

test('returns a mesh with vertices and faces', () => {
  const m = buildCoffeeMachine();
  assert.ok(Array.isArray(m.vertices) && m.vertices.length > 0);
  assert.ok(Array.isArray(m.faces) && m.faces.length > 0);
});

test('counter-appliance extents, base at y=0', () => {
  const { min, max } = extents(buildCoffeeMachine());
  assert.ok(max[0] - min[0] < 0.6);
  assert.ok(max[1] - min[1] < 0.6);
  assert.ok(max[2] - min[2] < 0.6);
  assert.ok(Math.abs(min[1]) < 1e-9);
});

test('face budget', () => {
  assert.ok(buildCoffeeMachine().faces.length <= 50);
});

test('deterministic', () => {
  assert.deepEqual(buildCoffeeMachine(), buildCoffeeMachine());
});

test('has distinct colors and valid indices', () => {
  const m = buildCoffeeMachine();
  assert.ok(new Set(m.faces.map((f) => f.color)).size >= 2);
  for (const f of m.faces) for (const i of f.indices) assert.ok(i >= 0 && i < m.vertices.length);
});

test('cup and spout parts are present', () => {
  const colors = buildCoffeeMachine().faces.map((f) => f.color);
  assert.ok(colors.includes(PALETTE_COLORS.CUP));
  assert.ok(colors.includes(PALETTE_COLORS.SPOUT));
});

test('no coplanar same-facing overlapping faces (painter flicker guard)', () => {
  const m = buildCoffeeMachine();
  const info = m.faces.map((f) => {
    const [a, b, c] = f.indices.map((i) => m.vertices[i]);
    const u = b.map((v, i) => v - a[i]);
    const w = c.map((v, i) => v - b[i]);
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const len = Math.hypot(...n);
    const nn = n.map((x) => x / len);
    const d = nn[0] * a[0] + nn[1] * a[1] + nn[2] * a[2];
    const vs = f.indices.map((i) => m.vertices[i]);
    const lo = [0, 1, 2].map((k) => Math.min(...vs.map((v) => v[k])));
    const hi = [0, 1, 2].map((k) => Math.max(...vs.map((v) => v[k])));
    return { nn, d, lo, hi };
  });
  const eps = 1e-6;
  for (let i = 0; i < info.length; i++) for (let j = i + 1; j < info.length; j++) {
    const p = info[i], q = info[j];
    const dot = p.nn[0] * q.nn[0] + p.nn[1] * q.nn[1] + p.nn[2] * q.nn[2];
    if (dot < 1 - eps || Math.abs(p.d - q.d) > eps) continue;
    // axis-aligned faces: overlap area is positive when all non-flat axes overlap
    const overlaps = [0, 1, 2].every((k) => {
      const flat = p.hi[k] - p.lo[k] < eps;
      return flat || Math.min(p.hi[k], q.hi[k]) - Math.max(p.lo[k], q.lo[k]) > eps;
    });
    assert.ok(!overlaps, `faces ${i} and ${j} are coplanar and overlap`);
  }
});
