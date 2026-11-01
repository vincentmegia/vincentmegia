import test from 'node:test';
import assert from 'node:assert/strict';
import { buildElevator, ELEVATOR_DOOR_COLOR, ELEVATOR_HALF_DOORWAY } from './elevator.js';

// Door panels are identified by their dedicated door color (ELEVATOR_DOOR_COLOR).

test('returns a mesh', () => {
  const m = buildElevator();
  assert.ok(Array.isArray(m.vertices) && Array.isArray(m.faces));
});

test('doors meet at center when shut', () => {
  const xs = buildElevator({ doorOpen: 0 }).faces.filter((f) => f.color === ELEVATOR_DOOR_COLOR);
  const m = buildElevator({ doorOpen: 0 });
  const all = xs.flatMap((f) => f.indices.map((i) => m.vertices[i][0]));
  assert.ok(Math.abs(Math.max(...all.filter((x) => x <= 1e-6))) < 1e-6);
  assert.ok(Math.abs(Math.min(...all.filter((x) => x >= -1e-6))) < 1e-6);
});

test('doors slide apart by doorOpen * half doorway', () => {
  const gap = (open) => {
    const m = buildElevator({ doorOpen: open });
    const all = m.faces.filter((f) => f.color === ELEVATOR_DOOR_COLOR).flatMap((f) => f.indices.map((i) => m.vertices[i][0]));
    const left = Math.max(...all.filter((x) => x < 0), -Infinity);
    const right = Math.min(...all.filter((x) => x > 0), Infinity);
    return { left, right };
  };
  const g = gap(1);
  assert.ok(Math.abs(g.left + ELEVATOR_HALF_DOORWAY) < 1e-6);
  assert.ok(Math.abs(g.right - ELEVATOR_HALF_DOORWAY) < 1e-6);
  assert.ok(Math.abs(g.right - g.left - 2 * ELEVATOR_HALF_DOORWAY) < 1e-6);
  const h = gap(0.5);
  assert.ok(Math.abs(h.right - ELEVATOR_HALF_DOORWAY / 2) < 1e-6);
});

test('bounds, base and face budget', () => {
  const m = buildElevator();
  const ys = m.vertices.map((v) => v[1]);
  const xs = m.vertices.map((v) => v[0]);
  assert.ok(Math.abs(Math.min(...ys)) < 1e-9);
  assert.ok(Math.max(...ys) >= 2.0 && Math.max(...ys) <= 2.2 + 1e-9);
  assert.ok(Math.max(...xs) - Math.min(...xs) <= 1.4 + 1e-9);
  assert.ok(m.faces.length <= 50);
  const open = buildElevator({ doorOpen: 1 }).vertices.map((v) => v[0]);
  assert.ok(Math.max(...open) - Math.min(...open) <= 2.0 + 1e-9);
});

test('deterministic', () => {
  assert.deepEqual(buildElevator({ doorOpen: 0.3 }), buildElevator({ doorOpen: 0.3 }));
});
