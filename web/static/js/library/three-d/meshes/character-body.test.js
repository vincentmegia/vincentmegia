import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBody } from './character-body.js';
import { FRAME, metricsFor } from './character-frame.js';
import { paletteFor } from './character-palette.js';
import { LIBRARY_PATRON_DESIGNS } from '../../library-people.js';

const COLOUR = /^(#[0-9a-f]{3}|#[0-9a-f]{6}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\))$/i;
const EPS = 1e-9;

const build = (design) => {
  const palette = paletteFor(design);
  const metrics = metricsFor(design);
  return { mesh: buildBody(design, palette, metrics), palette, metrics };
};
const faceVerts = (mesh, f) => f.indices.map((i) => mesh.vertices[i]);
const maxAbsX = (verts) => Math.max(...verts.map((v) => Math.abs(v[0])));
/** Widest |x| among vertices with lo <= y <= hi. */
const widthIn = (mesh, lo, hi) =>
  maxAbsX(mesh.vertices.filter((v) => v[1] >= lo - EPS && v[1] <= hi + EPS));

const trousered = { age: 'adult', skin: '#efc49f', outfit: { kind: 'jacket', top: '#335577', bottom: '#223344', shoes: '#111111' } };
const skirted = { age: 'adult', skin: '#efc49f', outfit: { kind: 'dress', top: '#aa3355', skirt: '#cc5577', legs: '#eeeeee', shoes: '#111111' } };
const shorts = { age: 'adult', skin: '#efc49f', outfit: { kind: 'tee', top: '#3a7a5a', bottom: '#5577aa', shoes: '#eeeeee' } };
const teeLong = { age: 'adult', skin: '#efc49f', outfit: { kind: 'tee', top: '#3a7a5a', bottom: '#5577aa', legs: 'long', shoes: '#eeeeee' } };

test('feet sit on the floor and the body stops at the chin', () => {
  for (const d of [trousered, skirted, shorts]) {
    const { mesh } = build(d);
    const ys = mesh.vertices.map((v) => v[1]);
    assert.ok(Math.abs(Math.min(...ys) - 0) < EPS);
    assert.ok(Math.abs(Math.max(...ys) - FRAME.chin) < EPS);
  }
});

test('a skirted design builds a flared lower garment', () => {
  const { mesh } = build(skirted);
  const atHem = widthIn(mesh, FRAME.foot, FRAME.hem);
  const atWaist = widthIn(mesh, 21 / 40, 22.5 / 40);
  assert.ok(atHem > atWaist + 2 / 40, `hem ${atHem} should flare past waist ${atWaist}`);
});

test('a trousered design does not flare', () => {
  const { mesh, metrics } = build(trousered);
  assert.ok(widthIn(mesh, FRAME.foot, FRAME.hem) < metrics.halfTorso);
});

test('bare legs (shorts) are skin and narrower than trousers', () => {
  const legFaces = (d) => {
    const { mesh } = build(d);
    return mesh.faces.filter((f) => {
      const ys = faceVerts(mesh, f).map((v) => v[1]);
      return Math.abs(Math.min(...ys) - FRAME.shoeTop) < EPS && Math.abs(Math.max(...ys) - FRAME.hem) < EPS;
    });
  };
  const { palette: shortsPal } = build(shorts);
  const sf = legFaces(shorts);
  assert.ok(sf.length > 0);
  assert.ok(sf.every((f) => f.color === shortsPal.skin.skin));
  const width = (d) => {
    const { mesh } = build(d);
    return Math.max(...legFaces(d).flatMap((f) => faceVerts(mesh, f).map((v) => Math.abs(v[0]))));
  };
  assert.ok(width(shorts) < width(trousered));
});

test('a tee design with legs:"long" wears trousers, not shorts', () => {
  const { mesh, palette } = build(teeLong);
  assert.equal(palette.legs, null);
  const legs = mesh.faces.filter((f) => {
    const ys = faceVerts(mesh, f).map((v) => v[1]);
    return Math.abs(Math.min(...ys) - FRAME.shoeTop) < EPS && Math.abs(Math.max(...ys) - FRAME.hem) < EPS;
  });
  assert.ok(legs.length > 0);
  assert.ok(legs.every((f) => f.color === palette.bottom));
});

test('a skirted design takes its leg colour from outfit.legs, else skin', () => {
  const colours = (d) => {
    const { mesh } = build(d);
    return new Set(
      mesh.faces
        .filter((f) => {
          const ys = faceVerts(mesh, f).map((v) => v[1]);
          return Math.abs(Math.min(...ys) - FRAME.shoeTop) < EPS && Math.abs(Math.max(...ys) - FRAME.hem) < EPS;
        })
        .map((f) => f.color),
    );
  };
  assert.deepEqual([...colours(skirted)], ['#eeeeee']);
  const bare = { ...skirted, outfit: { ...skirted.outfit, legs: undefined } };
  assert.deepEqual([...colours(bare)], [paletteFor(bare).skin.skin]);
});

test('optional layers appear only when the design has them', () => {
  const plain = { age: 'adult', skin: '#efc49f', outfit: { kind: 'cardigan', top: '#335577', bottom: '#223344' } };
  const layered = { ...plain, outfit: { ...plain.outfit, inner: '#eeeeee', tie: '#aa0000', apron: '#ddddcc', trim: '#ffcc00' } };
  const base = build(plain).mesh.faces.length;
  assert.ok(build(layered).mesh.faces.length > base + 6 * 3);
  for (const key of ['inner', 'tie', 'apron', 'trim']) {
    const one = { ...plain, outfit: { ...plain.outfit, [key]: key === 'tie' ? '#aa0000' : '#eeeeee' } };
    assert.ok(build(one).mesh.faces.length > base, key);
  }
});

test('every shoe face is the palette shoe colour', () => {
  for (const d of [trousered, skirted, shorts]) {
    const { mesh, palette } = build(d);
    const shoes = mesh.faces.filter((f) => Math.min(...faceVerts(mesh, f).map((v) => v[1])) < EPS);
    assert.ok(shoes.length >= 10);
    assert.ok(shoes.every((f) => f.color === palette.shoes));
  }
});

test('no face is marked unlit and every colour is valid', () => {
  for (const d of [trousered, skirted, shorts, teeLong, ...LIBRARY_PATRON_DESIGNS]) {
    const { mesh } = build(d);
    for (const f of mesh.faces) {
      assert.ok(!f.unlit);
      assert.match(f.color, COLOUR);
    }
  }
});

test('every library patron design builds within the frame', () => {
  for (const d of LIBRARY_PATRON_DESIGNS) {
    const { mesh } = build(d);
    const ys = mesh.vertices.map((v) => v[1]);
    assert.ok(Math.abs(Math.min(...ys)) < EPS, d.key);
    assert.ok(Math.abs(Math.max(...ys) - FRAME.chin) < EPS, d.key);
  }
});

test('indices in range and output deterministic', () => {
  const { mesh } = build(skirted);
  for (const f of mesh.faces) {
    assert.ok(f.indices.length >= 3);
    for (const i of f.indices) assert.ok(Number.isInteger(i) && i >= 0 && i < mesh.vertices.length);
  }
  assert.deepEqual(build(skirted).mesh, mesh);
});

test('the body is built at full size (no age scaling)', () => {
  const kid = { ...trousered, age: 'kid' };
  const ys = build(kid).mesh.vertices.map((v) => v[1]);
  assert.ok(Math.abs(Math.max(...ys) - FRAME.chin) < EPS);
});
