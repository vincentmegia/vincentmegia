import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBookshelf } from './bookshelf.js';

const PLANK = '#8a5a30';
const bbox = (m) => {
  const c = [0, 1, 2].map((k) => m.vertices.map((v) => v[k]));
  return c.map((a) => [Math.min(...a), Math.max(...a)]);
};

test('bookshelf has planks, books, bbox, budget', () => {
  const rows = 4;
  const m = buildBookshelf({ rows });
  const [bx, by] = bbox(m);
  assert.ok(Math.abs(bx[1] - bx[0] - 1.0) < 1e-9);
  assert.ok(Math.abs(by[0]) < 1e-9);
  assert.ok(m.faces.length <= 120);
  const plankLevels = new Set(
    m.faces.filter((f) => f.color === PLANK).map((f) => m.vertices[f.indices[0]][1].toFixed(3)),
  );
  assert.ok(plankLevels.size >= rows);
  const spines = m.faces.filter((f) => f.color !== PLANK && f.color !== '#7a4e2a');
  assert.ok(spines.length > 0);
  assert.ok(new Set(spines.map((f) => f.color)).size > 1);
});

test('width option and accent', () => {
  const m = buildBookshelf({ width: 1.6, rows: 3, accent: '#112233' });
  const [bx] = bbox(m);
  assert.ok(Math.abs(bx[1] - bx[0] - 1.6) < 1e-9);
  assert.ok(m.faces.some((f) => f.color === '#112233'));
});

test('deterministic', () => {
  assert.deepEqual(buildBookshelf(), buildBookshelf());
});
