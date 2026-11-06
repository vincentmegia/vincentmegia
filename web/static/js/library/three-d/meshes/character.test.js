import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCharacter } from './character.js';
import { FRAME, PX, metricsFor } from './character-frame.js';
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

// Everything is measured on the built mesh, after undoing the whole-figure age
// scale (so a kid's bands line up with the unscaled frame).
//
// - heightTop: highest vertex (scaled, as the player sees it).
// - headH: y extent of the head's skin-toned unlit faces (skin/shade/deep). Hair
//   below the chin and headwear above the crown are other colours.
// - headW: the skull's own width, from the skin-toned head vertices on the skull's
//   upper rim ring (FRAME's 60px row, moved by the kid's head scale). That row is
//   above the ear boxes (52-56px), so ears are excluded. This is the RAW x extent
//   of those vertices — the silhouette a player sees — with no trigonometric
//   correction: metricsFor scales the head's ring radii by CIRC (as the torso's
//   own CIRC does), so an 8-sided ring already reaches the half-width we designed.
// - shoulderW: x extent of the lit body vertices on the torso's 38px shoulder ring
//   (the band y 36-40px). Sleeves (box corners at 28 and 43px) and hands (24-28px)
//   have no vertices in that band, so this is the torso's own widest point.
// - legTop: highest vertex of the leg boxes, i.e. the lit faces in `legColour`
//   that reach down below 0.3 (the hips, same colour, start higher).
function measure(design, legColour = design.outfit.bottom) {
  const built = buildCharacter(design);
  const metrics = metricsFor(design);
  const k = metrics.ageScale;
  const m = { vertices: built.vertices.map((v) => v.map((c) => c / k)), faces: built.faces };
  const tones = new Set(Object.values(paletteFor(design).skin));
  const skull = verts(m, m.faces.filter((f) => f.unlit && tones.has(f.color)));
  const [y0, y1] = range(skull.map((v) => v[1]));
  const rimY = FRAME.chin + (60 * PX - FRAME.chin) * metrics.headScale;
  const rim = skull.filter((v) => Math.abs(v[1] - rimY) < 0.005);
  const [h0, h1] = range(rim.map((v) => v[0]));
  const shoulder = verts(m, m.faces.filter((f) => !f.unlit)).filter((v) => v[1] >= 36 * PX && v[1] <= 40 * PX);
  const [s0, s1] = range(shoulder.map((v) => v[0]));
  const legs = verts(m, m.faces.filter((f) => !f.unlit && f.color === legColour && Math.min(...f.indices.map((i) => m.vertices[i][1])) < 0.3));
  const legTop = legs.length ? Math.max(...legs.map((v) => v[1])) : NaN;
  return {
    m: built,
    top: Math.max(...ys(built)),
    headH: (y1 - y0) * k,
    headW: (h1 - h0) * k,
    shoulderW: (s1 - s0) * k,
    legTop: legTop * k,
  };
}

test('an adult is 3.0 heads tall', () => {
  const { top, headH } = measure(bald);
  assert.ok(Math.abs(top / headH - 3.0) <= 0.15, `heads tall ${top / headH}`);
});

// The 0.85 +- 0.05 contract is the spec's reference (non-slim) adult, measured on
// the silhouette: head 2*9 = 18 px over shoulders 2*10.6 = 21.2 px is 0.849. A slim
// adult (skirt) has narrower shoulders (18.4 px) under the same head, so its ratio
// is higher by design (18/18.4 = 0.978); it gets its own, wider bound so a runaway
// is still caught.
test('head is 85% of shoulder width (non-slim adult)', () => {
  const { headW, shoulderW } = measure(bald);
  assert.ok(Math.abs(headW / shoulderW - 0.85) <= 0.05, `ratio ${headW / shoulderW}`);
});

test('a slim adult keeps the head within 0.9-1.05 of its shoulders', () => {
  const { headW, shoulderW } = measure({ ...bald, outfit: skirt.outfit }, skirt.outfit.legs);
  const r = headW / shoulderW;
  assert.ok(r >= 0.9 && r <= 1.05, `slim ratio ${r}`);
});

test('legs are 29% of total height', () => {
  // Leg length is read off the built leg boxes, not FRAME.hem.
  const { top, legTop } = measure(bald);
  assert.ok(Math.abs(legTop / top - 0.29) <= 0.02, `legs ${legTop / top}`);
  const s = measure({ ...bald, outfit: skirt.outfit }, skirt.outfit.legs);
  assert.ok(Math.abs(s.legTop / s.top - 0.29) <= 0.02, `skirt legs ${s.legTop / s.top}`);
});

test('an adult is 1.66 units tall', () => {
  const { top } = measure(bald);
  assert.ok(Math.abs(top - 1.66) <= 0.02, `height ${top}`);
  // With hair the figure stays within the same silhouette band (hair adds < 0.08).
  // The hair cap puffs above the skull (2D art too): between 2% and 7% of the crown height.
  const puff = measure(adult).top - top;
  assert.ok(puff > 0.02 * FRAME.crown && puff < 0.07 * FRAME.crown, `puff ${puff}`);
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

// Proportion envelope over the real roster (nothing else measures shipped patrons).
// Observed: heads tall 2.73-3.97, head/shoulder 0.849-1.287. Every bound below is
// derived from the designed px widths, which `headW` now measures directly: head
// 2*9 px (adult), 2*9.2 (elder), 2*9.4*1.26 = 23.69 (kid); shoulders 2*10.6 px
// (non-slim) or 2*9.2 (slim). The ratios are unchanged from the first derivation
// because the cos(pi/8) factor this test used to divide out by hand now lives in
// metricsFor's ring radii — the numbers mean the silhouette, not the design intent.
// - heads tall in [2.5, 4.2]: untouched by that change (it widens x/z only, never
//   y): a bald adult is 3.03; hair adds ~0.13; a kid's head is 1.26x larger (2.73
//   lowest); the witch hat is the tallest headwear (3.97).
// - non-slim non-kids honour the spec's 0.85 +- 0.05: 18/21.2 = 0.849, and an
//   elder's wider head 18.4/21.2 = 0.868; both sit inside [0.80, 0.90].
// - slim non-kids run 18/18.4 = 0.978 to an elder's 18.4/18.4 = 1.0, so [0.9, 1.05]
//   brackets them with a margin on each side rather than hugging the observed pair.
// - kids are slim with a 1.26x head: 23.69/18.4 = 1.287 for all nine, inside
//   [1.0, 1.35].
test('every shipped design stays inside the proportion envelope', () => {
  for (const d of LIBRARY_PATRON_DESIGNS) {
    const me = metricsFor(d);
    const r = measure(d);
    const tall = r.top / r.headH;
    assert.ok(tall >= 2.5 && tall <= 4.2, `${d.key} heads tall ${tall}`);
    const ratio = r.headW / r.shoulderW;
    if (me.kid) assert.ok(ratio >= 1.0 && ratio <= 1.35, `${d.key} kid ratio ${ratio}`);
    else if (me.slim) assert.ok(ratio >= 0.9 && ratio <= 1.05, `${d.key} slim ratio ${ratio}`);
    else assert.ok(Math.abs(ratio - 0.85) <= 0.05, `${d.key} ratio ${ratio}`);
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
