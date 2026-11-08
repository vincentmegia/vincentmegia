import test from 'node:test';
import assert from 'node:assert/strict';
import { DECOR_BUILDERS, meshForDecorKind, buildPlant, buildWaitingChairs } from './decor.js';

// The kinds LIBRARY_DECOR places (library-game.js): a missing builder would
// leave that prop out of First Person entirely.
const LIBRARY_DECOR_KINDS = ['water-cooler', 'plant', 'ladder', 'waiting-chairs'];

test('every decor kind Library places has a builder', () => {
  for (const kind of LIBRARY_DECOR_KINDS) {
    assert.equal(typeof meshForDecorKind(kind), 'function', kind);
  }
});

test('an unknown decor kind has no mesh rather than a wrong one', () => {
  assert.equal(meshForDecorKind('vending-machine'), null);
  assert.equal(meshForDecorKind('nope'), null);
});

test('each decor mesh stands on the floor at a plausible height', () => {
  // Heights a person in the room would read as right (metres), since these
  // are placed at UNIT_SCALE like every other unit-sized mesh.
  const expected = {
    'water-cooler': [1.2, 1.5],
    plant: [0.9, 1.2],
    ladder: [1.4, 1.8],
    'waiting-chairs': [0.8, 1.0],
  };
  for (const [kind, [lo, hi]] of Object.entries(expected)) {
    const mesh = DECOR_BUILDERS[kind]();
    const ys = mesh.vertices.map((v) => v[1]);
    const foot = Math.min(...ys);
    const top = Math.max(...ys);
    assert.ok(Math.abs(foot) < 1e-9, `${kind} rests on y=0, not ${foot}`);
    assert.ok(top >= lo && top <= hi, `${kind} stands ${top}, want ${lo}..${hi}`);
  }
});

test('every decor face culls, so a prop is solid from any angle', () => {
  for (const kind of LIBRARY_DECOR_KINDS) {
    const mesh = DECOR_BUILDERS[kind]();
    assert.ok(mesh.faces.length > 0, kind);
    assert.ok(mesh.faces.every((f) => f.cull === true), `${kind} has an uncelled face`);
  }
});

test('decor wears its 2D drawer colours', () => {
  // drawPlant's leaf green and pot terracotta; drawWaitingChairs' three seats.
  const plant = buildPlant().faces.map((f) => f.color);
  assert.ok(plant.includes('#8fd6a4'), 'leaf green');
  assert.ok(plant.includes('#e8956a'), 'pot terracotta');
  const chairs = buildWaitingChairs().faces.map((f) => f.color);
  for (const c of ['#ffc2da', '#d8c9ff', '#bfeedd']) {
    assert.ok(chairs.includes(c), `chair ${c}`);
  }
});
