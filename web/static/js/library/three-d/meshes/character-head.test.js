import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHead } from './character-head.js';
import { paletteFor } from './character-palette.js';
import { metricsFor, FRAME } from './character-frame.js';

const COLOUR = /^(#[0-9a-f]{3}|#[0-9a-f]{6}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\))$/i;

function design(over = {}) {
  return {
    key: 't',
    age: 'adult',
    skin: '#efc49f',
    hair: { color: '#3a2a22', back: 'short', fringe: 'blunt' },
    eyes: { style: 'calm', color: '#4a3a6a', lashes: false },
    brows: 'thin',
    mouth: 'smile',
    extras: {},
    ...over,
  };
}
function head(d, opts) {
  return buildHead(d, paletteFor(d), metricsFor(d), opts);
}
function bounds(m) {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const v of m.vertices) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v[k]); hi[k] = Math.max(hi[k], v[k]); }
  return { lo, hi };
}
const signature = (m) => `${m.faces.length}|${m.vertices.length}|${bounds(m).lo.map((n) => n.toFixed(4))}|${bounds(m).hi.map((n) => n.toFixed(4))}`;
const withBack = (back) => design({ hair: { color: '#3a2a22', back, fringe: 'blunt' } });

test('the head spans chin to crown', () => {
  const b = bounds(head(design()));
  assert.ok(Math.abs(b.lo[1] - FRAME.chin) < 1e-9, `min y ${b.lo[1]}`);
  assert.ok(b.hi[1] >= FRAME.crown);
});

test('a kid head is scaled about the chin', () => {
  const adult = bounds(head(design()));
  const kid = bounds(head(design({ age: 'kid' })));
  assert.ok(kid.hi[1] > adult.hi[1]);
  assert.ok(Math.abs(kid.lo[1] - FRAME.chin) < 1e-9);
  assert.ok(Math.abs(adult.lo[1] - FRAME.chin) < 1e-9);
});

test('an elder head is offset forward', () => {
  const adult = bounds(head(design()));
  const elder = bounds(head(design({ age: 'elder' })));
  assert.ok(elder.hi[2] > adult.hi[2]);
});

test('every face is unlit and has a valid colour', () => {
  const d = design({
    eyes: { style: 'big', color: '#4a3a6a', lashes: true },
    extras: { glasses: 'square', mask: true, cap: '#4a5a3a', headphones: '#ffffff', catEars: '#8a5a3a' },
  });
  for (const m of [head(d), head(design({ age: 'kid' })), head(design(), { angry: true })]) {
    assert.ok(m.faces.length > 0);
    for (const f of m.faces) {
      assert.equal(f.unlit, true);
      assert.match(f.color, COLOUR);
    }
  }
});

test('each hair.back style changes the mesh', () => {
  const styles = ['long', 'medium', 'bob', 'twintails', 'ponytail', 'bun', 'short'];
  const sigs = styles.map((s) => signature(head(withBack(s))));
  assert.equal(new Set(sigs).size, styles.length);
});

test('bald hair drops the cap', () => {
  assert.ok(head(withBack('bald')).faces.length < head(withBack('short')).faces.length);
});

test('an unknown hair.back is ignored, not thrown', () => {
  const m = head(design({ hair: { color: '#3a2a22', back: 'mullet-from-the-future', fringe: 'zigzag' } }));
  assert.ok(m.faces.length > 0);
});

test('an unknown extras key is ignored, not thrown', () => {
  const base = head(design());
  const m = head(design({ extras: { hoverCrown: '#ff00ff', jetpack: true } }));
  assert.equal(m.faces.length, base.faces.length);
});

test('missing extras are tolerated', () => {
  const d = design();
  delete d.extras;
  assert.ok(head(d).faces.length > 0);
});

test('glasses and headphones add faces', () => {
  const base = head(design()).faces.length;
  assert.ok(head(design({ extras: { glasses: 'round' } })).faces.length > base);
  assert.ok(head(design({ extras: { glasses: 'square' } })).faces.length > base);
  assert.ok(head(design({ extras: { headphones: '#ffffff' } })).faces.length > base);
});

test('each worn extra changes the mesh', () => {
  const base = signature(head(design()));
  for (const extras of [{ mask: true }, { cap: '#4a5a3a' }, { beanie: '#e8c25a' }, { sunhat: '#e8d29a' }, { bikeHelmet: '#3a8ac0' }, { hachimaki: '#d23a4a' }, { catEars: '#8a5a3a' }]) {
    assert.notEqual(signature(head(design({ extras }))), base, JSON.stringify(extras));
  }
});

test('angry changes the brow faces', () => {
  const calm = head(design());
  const angry = head(design(), { angry: true });
  assert.notDeepEqual(angry.vertices, calm.vertices);
});

test('thick brows and lashes and an open mouth add detail', () => {
  const base = head(design());
  assert.notDeepEqual(head(design({ brows: 'thick' })).vertices, base.vertices);
  assert.ok(head(design({ eyes: { style: 'calm', color: '#4a3a6a', lashes: true } })).faces.length > base.faces.length);
  assert.notDeepEqual(head(design({ mouth: 'open' })).vertices, base.vertices);
});

test('indices in range and output deterministic', () => {
  const d = design({ hair: { color: '#3a2a22', back: 'twintails', fringe: 'side' }, extras: { glasses: 'round', cap: '#4a5a3a' } });
  const a = head(d);
  for (const f of a.faces) {
    assert.ok(f.indices.length >= 3);
    for (const i of f.indices) assert.ok(Number.isInteger(i) && i >= 0 && i < a.vertices.length);
  }
  for (const v of a.vertices) for (const n of v) assert.ok(Number.isFinite(n));
  assert.deepEqual(head(d), a);
});
