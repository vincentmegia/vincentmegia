import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCharacter } from './character.js';
import { FRAME } from './character-frame.js';
import { paletteFor } from './character-palette.js';
// library-people.js is pure data (no imports, no DOM), so the real roster is safe to load.
import { LIBRARY_PATRON_DESIGNS } from '../../library-people.js';

const COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$|^rgb\(/i;

// Hair puffs ~0.07 above the skull's crown by design (the 2D art does too), so the
// exact-height tests use a bald adult; `adult` carries short hair for the rest.
const adult = {
  key: 'testAdult', age: 'adult', skin: '#efc49f',
  hair: { color: '#2a2018', back: 'short', fringe: 'blunt' },
  eyes: { color: '#3a2a22', style: 'dot' }, brows: 'thin', mouth: 'smile',
  outfit: { kind: 'blazer', top: '#24305a', inner: '#ffffff', tie: '#b02a3a', trim: '#e8c25a', bottom: '#3a3a48', shoes: '#2a2226' },
};
const bald = { ...adult, hair: { color: '#2a2018', back: 'bald' } };
const plain = { ...adult, outfit: { kind: 'blazer', top: '#24305a', bottom: '#3a3a48', shoes: '#2a2226' } };
const skirt = { ...adult, outfit: { kind: 'cardigan', top: '#e8709c', skirt: '#4a3a5a', legs: '#d9c2b0', shoes: '#4a3a32' } };

const ys = (m) => m.vertices.map((v) => v[1]);
const range = (a) => [Math.min(...a), Math.max(...a)];
const verts = (m, faces) => faces.flatMap((f) => f.indices.map((i) => m.vertices[i]));

// Head height/width: the skull, i.e. the head's own skin-toned faces (skin, shade,
// deep). This is robust to long hair hanging below the chin and to hats above
// the crown, which are other colours. Shoulder width: the body's x extent (lit faces) at/below the
// shoulder line; arms hang at the shoulder so this is the shoulder-to-shoulder span.
function measure(design) {
  const m = buildCharacter(design);
  const tones = new Set(Object.values(paletteFor(design).skin));
  const skull = verts(m, m.faces.filter((f) => f.unlit && tones.has(f.color)));
  const [y0, y1] = range(skull.map((v) => v[1]));
  const [x0, x1] = range(skull.map((v) => v[0]));
  const body = verts(m, m.faces.filter((f) => !f.unlit)).filter((v) => v[1] <= FRAME.chin && v[1] >= FRAME.hem);
  const [b0, b1] = range(body.map((v) => v[0]));
  const [, top] = range(ys(m));
  return { m, top, headH: y1 - y0, headW: x1 - x0, shoulderW: b1 - b0 };
}

test('an adult is 3.0 heads tall', () => {
  const { top, headH } = measure(bald);
  assert.ok(Math.abs(top / headH - 3.0) <= 0.15, `heads tall ${top / headH}`);
});

test('head is 85% of shoulder width', () => {
  const { headW, shoulderW } = measure(bald);
  assert.ok(Math.abs(headW / shoulderW - 0.85) <= 0.05, `ratio ${headW / shoulderW}`);
});

test('legs are 29% of total height', () => {
  const { top } = measure(bald);
  assert.ok(Math.abs(FRAME.hem / top - 0.29) <= 0.02, `legs ${FRAME.hem / top}`);
});

test('an adult is 1.66 units tall', () => {
  const { top } = measure(bald);
  assert.ok(Math.abs(top - 1.66) <= 0.02, `height ${top}`);
  // With hair the figure stays within the same silhouette band (hair adds < 0.08).
  assert.ok(measure(adult).top - top < 0.08);
});

test('feet sit on the floor', () => {
  for (const d of [adult, skirt, { ...adult, age: 'kid' }, { ...adult, age: 'elder' }]) {
    assert.ok(Math.abs(Math.min(...ys(buildCharacter(d)))) < 1e-9, d.age);
  }
});

test('no colour from the design is dropped', () => {
  const colors = new Set(buildCharacter(adult).faces.map((f) => f.color));
  for (const c of [adult.skin, adult.outfit.top, adult.outfit.bottom, adult.outfit.shoes]) assert.ok(colors.has(c), c);
  const sk = new Set(buildCharacter(skirt).faces.map((f) => f.color));
  assert.ok(sk.has(skirt.outfit.skirt), 'skirt');
  const count = (d) => new Set(buildCharacter(d).faces.map((f) => f.color)).size;
  assert.ok(count(adult) > count(plain), 'inner + tie + trim add colours');
});

test('a kid has a proportionally larger head than an adult', () => {
  const k = measure({ ...bald, age: 'kid' });
  const a = measure(bald);
  assert.ok(k.headH / k.top > a.headH / a.top);
});

test('kid and elder figures are shorter than an adult', () => {
  const h = (d) => Math.max(...ys(buildCharacter(d)));
  assert.ok(h({ ...adult, age: 'kid' }) < h(adult));
  assert.ok(h({ ...adult, age: 'elder' }) < h(adult));
});

test('a design with glasses has more faces than one without', () => {
  const g = buildCharacter({ ...adult, extras: { glasses: 'round' } });
  assert.ok(g.faces.length > buildCharacter(adult).faces.length);
});

test('angry changes the mesh', () => {
  assert.notDeepEqual(buildCharacter(adult), buildCharacter(adult, { angry: true }));
});

test('output is deterministic and every index is in range', () => {
  const m = buildCharacter(adult);
  assert.deepEqual(m, buildCharacter(adult));
  for (const f of m.faces) {
    assert.ok(f.indices.length >= 3);
    for (const i of f.indices) assert.ok(Number.isInteger(i) && i >= 0 && i < m.vertices.length);
  }
});

test('every shipped design builds', () => {
  assert.equal(LIBRARY_PATRON_DESIGNS.length, 66);
  for (const d of LIBRARY_PATRON_DESIGNS) assert.doesNotThrow(() => buildCharacter(d), d.key);
});

test('every face colour is valid for parseColor', () => {
  for (const d of LIBRARY_PATRON_DESIGNS) {
    for (const f of buildCharacter(d).faces) assert.match(f.color, COLOR_RE, d.key);
  }
});

// Guards runaway growth, not a hard limit: the heaviest shipped design is 278 faces.
test('face budget', () => {
  let max = 0;
  for (const d of [adult, ...LIBRARY_PATRON_DESIGNS]) max = Math.max(max, buildCharacter(d).faces.length);
  assert.ok(max <= 340, `max faces ${max}`);
});
