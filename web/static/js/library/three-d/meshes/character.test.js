import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCharacter } from './character.js';

const opts = { skin: '#e0b090', hair: '#222222', top: '#3366cc', bottom: '#554433' };

test('returns vertices and faces', () => {
  const m = buildCharacter(opts);
  assert.ok(Array.isArray(m.vertices));
  assert.ok(Array.isArray(m.faces));
});

test('bounding box is human-sized with feet on floor', () => {
  const { vertices } = buildCharacter(opts);
  const ys = vertices.map((v) => v[1]);
  const xs = vertices.map((v) => v[0]);
  assert.ok(Math.abs(Math.min(...ys)) < 1e-9);
  assert.ok(Math.max(...ys) >= 1.5 && Math.max(...ys) <= 1.9);
  assert.ok(Math.max(...xs) - Math.min(...xs) < 0.7);
});

test('uses the palette', () => {
  const colors = buildCharacter(opts).faces.map((f) => f.color);
  for (const c of [opts.skin, opts.top, opts.bottom, opts.hair]) assert.ok(colors.includes(c), c);
});

test('face budget', () => {
  assert.ok(buildCharacter(opts).faces.length <= 60);
});

test('angry changes a head face color', () => {
  const a = buildCharacter(opts).faces.map((f) => f.color);
  const b = buildCharacter({ ...opts, angry: true }).faces.map((f) => f.color);
  assert.notDeepEqual(a, b);
  assert.ok(b.some((c, i) => c !== a[i]));
});

test('deterministic and indices valid', () => {
  const m = buildCharacter(opts);
  assert.deepEqual(m, buildCharacter(opts));
  for (const f of m.faces) for (const i of f.indices) assert.ok(i >= 0 && i < m.vertices.length);
});
