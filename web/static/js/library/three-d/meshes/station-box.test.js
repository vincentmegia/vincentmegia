import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStationBox } from './station-box.js';

test('station box matches dimensions, base at 0, single color', () => {
  const m = buildStationBox({ width: 1.4, depth: 0.6, height: 0.9, color: '#c0a060' });
  const xs = m.vertices.map((v) => v[0]);
  const ys = m.vertices.map((v) => v[1]);
  const zs = m.vertices.map((v) => v[2]);
  const ext = (a) => Math.max(...a) - Math.min(...a);
  assert.ok(Math.abs(ext(xs) - 1.4) < 1e-9);
  assert.ok(Math.abs(ext(ys) - 0.9) < 1e-9);
  assert.ok(Math.abs(ext(zs) - 0.6) < 1e-9);
  assert.ok(Math.abs(Math.min(...ys)) < 1e-9);
  assert.ok(Math.abs(Math.min(...xs) + Math.max(...xs)) < 1e-9);
  assert.equal(m.faces.length, 6);
  assert.ok(m.faces.every((f) => f.color === '#c0a060'));
});
