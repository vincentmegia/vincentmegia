import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRoom } from './room.js';

const OPTS = { width: 960, depth: 600, height: 300, floorTint: '#b08f5e' };
const near = (a, b) => Math.abs(a - b) < 1e-6;

test('buildRoom returns a mesh with valid indices', () => {
  const m = buildRoom(OPTS);
  assert.ok(Array.isArray(m.vertices) && Array.isArray(m.faces));
  for (const f of m.faces) {
    assert.match(f.color, /^#[0-9a-f]{6}$/i);
    for (const i of f.indices) assert.ok(i >= 0 && i < m.vertices.length);
  }
});

test('floor spans the full rectangle at y=0 in floorTint', () => {
  const m = buildRoom(OPTS);
  const fl = m.vertices.filter((v) => near(v[1], 0));
  assert.equal(Math.min(...fl.map((v) => v[0])), 0);
  assert.equal(Math.max(...fl.map((v) => v[0])), 960);
  assert.equal(Math.min(...fl.map((v) => v[2])), 0);
  assert.equal(Math.max(...fl.map((v) => v[2])), 600);
  const floor = m.faces.find(
    (f) => f.color === '#b08f5e' && f.indices.every((i) => near(m.vertices[i][1], 0)),
  );
  assert.ok(floor);
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

test('face count within budget', () => {
  assert.ok(buildRoom(OPTS).faces.length <= 120);
});

test('deterministic', () => {
  assert.deepEqual(buildRoom(OPTS), buildRoom(OPTS));
});
