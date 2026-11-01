import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCoffeeMachine } from './coffee-machine.js';

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
