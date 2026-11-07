import test from 'node:test';
import assert from 'node:assert/strict';
import { shadeColor } from '../../../shared/people.js';
import { metricsFor, ART, FRAME, GROUND, PX, CIRC, artY } from './character-frame.js';
import { paletteFor } from './character-palette.js';
import { LIBRARY_PATRON_DESIGNS } from '../../library-people.js';

test('frame landmarks agree in px and units', () => {
  assert.equal(PX, 1 / 40);
  // The art's own numbers (patron.js / patron-head.js), lifted onto the floor
  // the figure stands on: GROUND px below patron.js's drawing origin.
  assert.equal(GROUND, 7.1);
  assert.equal(FRAME.foot, 0);
  // In px, so the numbers read as the art measures them (artY is float maths,
  // hence the epsilon rather than strict equality).
  const px = (v) => v / PX;
  const near = (a, b, what) => assert.ok(Math.abs(a - b) < 1e-9, `${what} ${a} != ${b}`);
  near(px(artY(ART.chin)), 44.4 + 7.1, 'chin');
  near(px(FRAME.crown), 73.35, 'crown');
  near(px(FRAME.eye), 60.9, 'eye');
  near(px(FRAME.hem), 26.5, 'hem');
  near(px(FRAME.shoulder), 50.5, 'shoulder');
  near(px(FRAME.shoeTop), 5.0, 'shoeTop');
  // Head height and the leg share, the two numbers the first measurement got wrong.
  near((FRAME.crown - FRAME.chin) / PX, 21.85, 'head height');
  assert.ok(Math.abs(FRAME.hem / FRAME.crown - 0.361) < 0.001);
});

test('metricsFor marks a skirted design slim', () => {
  const m = metricsFor({ age: 'adult', outfit: { skirt: '#444444' } });
  assert.equal(m.slim, true);
  assert.equal(m.halfTorso, 7.8 / 40);
  assert.equal(m.halfShoulder, 9.2 / 40);
  assert.equal(m.depth, 5.6 / 40);
  assert.equal(metricsFor({ age: 'adult', outfit: {} }).slim, false);
  assert.equal(metricsFor({ age: 'adult', outfit: {} }).halfTorso, 9.8 / 40);
});

test('metricsFor marks a kid slim and scales the head', () => {
  const m = metricsFor({ age: 'kid', outfit: {} });
  assert.equal(m.slim, true);
  assert.equal(m.kid, true);
  assert.equal(m.headScale, 1.26);
  assert.equal(m.ageScale, 0.74);
  // headRX is a prism radius, so the width that renders is radius*cos(pi/8).
  assert.ok(Math.abs(m.headRX / CIRC - 9.4 / 40) < 1e-15, `kid head ${m.headRX / CIRC}`);
});

test('metricsFor uses the elder head width', () => {
  const m = metricsFor({ age: 'elder', outfit: {} });
  assert.equal(m.elder, true);
  // An elder's head renders 2*9.2 px wide: the stored radius is that over cos(pi/8).
  assert.ok(Math.abs(m.headRX / CIRC - 9.2 / 40) < 1e-15, `elder head ${m.headRX / CIRC}`);
  assert.equal(m.headRZ, m.headRX * 0.94);
  assert.equal(m.ageScale, 0.95);
  assert.equal(m.headScale, 1);
});

test('paletteFor keeps every outfit colour', () => {
  const p = paletteFor({
    skin: '#dca578',
    hair: { color: '#c9a8e8' },
    eyes: { color: '#6a3a8a' },
    outfit: { top: '#ff8fb8', inner: '#fff2b8', apron: '#6a4a32', tie: '#8a2a3a', trim: '#123456', skirt: '#4a3a5a', legs: '#d9c2b0', shoes: '#ffffff', bottom: '#2e2a3a' },
  });
  assert.equal(p.top, '#ff8fb8');
  assert.equal(p.inner, '#fff2b8');
  assert.equal(p.apron, '#6a4a32');
  assert.equal(p.tie, '#8a2a3a');
  assert.equal(p.trim, '#123456');
  assert.equal(p.skirt, '#4a3a5a');
  assert.equal(p.legs, '#d9c2b0');
  assert.equal(p.shoes, '#ffffff');
  assert.equal(p.bottom, '#2e2a3a');
  assert.equal(p.eyes, '#6a3a8a');
});

test('paletteFor derives hair and skin tones', () => {
  const p = paletteFor({ skin: '#dca578', hair: { color: '#3a2a2a' }, outfit: {} });
  assert.equal(new Set(Object.values(p.hair)).size, 4);
  assert.equal(new Set(Object.values(p.skin)).size, 3);
  assert.equal(p.hair.base, '#3a2a2a');
  assert.equal(p.skin.skin, '#dca578');
});

test('paletteFor turns a null outfit field into null, not a bad colour', () => {
  const p = paletteFor({ skin: '#efc49f', hair: { color: '#222222' }, outfit: { top: '#111111', legs: null, inner: null, trim: null }, eyes: { color: null } });
  assert.equal(p.legs, null);
  assert.equal(p.inner, null);
  assert.equal(p.trim, null);
  assert.equal(p.eyes, '#2e2a3a');
  assertSane(p);
});

test('paletteFor falls back for a design missing outfit and hair', () => {
  const p = paletteFor({});
  assertSane(p);
  assert.equal(p.skin.skin, '#efc49f');
  assert.equal(p.hair.base, '#2a2030');
  assert.equal(p.top, '#6a7a8a');
  assert.equal(p.bottom, '#3a3a48');
  assert.equal(p.shoes, '#2a2226');
  assert.equal(p.lips, shadeColor('#efc49f', -0.38));
});

test('paletteFor lips use the pink when lashes are set', () => {
  assert.equal(paletteFor({ eyes: { lashes: true } }).lips, '#d8707e');
});

test('paletteFor is sane for all real patron designs', () => {
  for (const d of LIBRARY_PATRON_DESIGNS) assertSane(paletteFor(d));
});

function assertSane(p) {
  const optional = ['inner', 'apron', 'tie', 'trim', 'skirt', 'legs'];
  const flat = [];
  const walk = (k, v) => {
    if (v && typeof v === 'object') Object.entries(v).forEach(([kk, vv]) => walk(`${k}.${kk}`, vv));
    else flat.push([k, v]);
  };
  Object.entries(p).forEach(([k, v]) => walk(k, v));
  for (const [k, v] of flat) {
    assert.notEqual(v, undefined, k);
    if (v === null) {
      assert.ok(optional.includes(k), `${k} must not be null`);
      continue;
    }
    assert.match(v, /^#[0-9a-f]{6}$/i, k);
  }
  for (const k of optional) assert.ok(k in p, k);
}

test('the keyword legs: "long" is not a colour but still means trousers', () => {
  const d = { outfit: { kind: 'tee', bottom: '#4a6a9a', legs: 'long' } };
  assert.equal(paletteFor(d).legs, null);
  assert.equal(metricsFor(d).trousers, true);
  assert.equal(metricsFor({ outfit: { kind: 'tee' } }).trousers, false);
  assert.equal(metricsFor({ outfit: { kind: 'tee', skirt: '#444444' } }).trousers, false);
});
