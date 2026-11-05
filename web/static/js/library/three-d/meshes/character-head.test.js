import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHead, buildFace, buildHeadwear, faceOps } from './character-head.js';
import { paletteFor } from './character-palette.js';
import { metricsFor, FRAME, PX } from './character-frame.js';

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
  assert.ok(kid.hi[0] > adult.hi[0], 'wider too');
  assert.ok(kid.hi[2] > adult.hi[2], 'deeper too');
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
    extras: {
      glasses: 'square', mask: true, headphones: '#ffffff', catEars: '#8a5a3a', earrings: '#c9a24a', beard: '#b8b4bc', mustache: '#d8d6dc', sunglasses: true,
      cap: '#4a5a3a', beanie: '#e8c25a', sunhat: '#e8d29a', bikeHelmet: '#3a8ac0', hachimaki: '#d23a4a', bucketHat: '#c8b88a',
      baseballCap: '#3a6ab0', beret: '#a03a4a', bandana: '#d84a5a', witchHat: '#3a2a4a', flowerCrown: '#f08ab0',
    },
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
  const d = design();
  const p = paletteFor(d);
  const m = metricsFor(d);
  const slope = (opts) => {
    const vs = buildFace(d, p, m, opts).faces.filter((f) => f.color === p.brow).flatMap((f) => f.indices.map((i) => buildFace(d, p, m, opts).vertices[i]));
    const right = vs.filter((v) => v[0] > 0);
    const min = (arr) => Math.min(...arr.map((v) => v[1]));
    return min(right.filter((v) => v[0] / PX >= 5.5)) - min(right.filter((v) => v[0] / PX <= 2.5));
  };
  // Angry: the outer end sits well above the inner end (down at the middle).
  assert.ok(slope({ angry: true }) > 2 * PX, `angry slope ${slope({ angry: true })}`);
  assert.ok(slope({ angry: true }) > slope({}) + PX);
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

const REAL_EXTRAS = [{ mask: true }, { cap: '#4a5a3a' }, { beanie: '#e8c25a' }, { sunhat: '#e8d29a' }, { bikeHelmet: '#3a8ac0' }, { hachimaki: '#d23a4a' }, { catEars: '#8a5a3a' },
  { bucketHat: '#c8b88a' }, { baseballCap: '#3a6ab0' }, { beret: '#a03a4a' }, { bandana: '#d84a5a' }, { witchHat: '#3a2a4a' }, { flowerCrown: '#f08ab0' },
  { earrings: '#c9a24a' }, { beard: '#b8b4bc' }, { sunglasses: true }];

test('earrings, beard, sunglasses and the extra hats each change the mesh', () => {
  const base = signature(head(design()));
  for (const extras of REAL_EXTRAS) assert.notEqual(signature(head(design({ extras }))), base, JSON.stringify(extras));
});

test('headwear sits above the eyes', () => {
  const m = metricsFor(design());
  for (const extras of REAL_EXTRAS.filter((e) => !e.mask && !e.earrings && !e.beard && !e.sunglasses)) {
    const hat = buildHeadwear(extras, 'short', m);
    assert.ok(hat.vertices.length > 0, JSON.stringify(extras));
    for (const v of hat.vertices) assert.ok(v[1] > FRAME.eye, `${JSON.stringify(extras)} reaches y ${v[1]}`);
  }
});

test('the skull and hair render every tone they claim', () => {
  const d = design();
  const p = paletteFor(d);
  const colours = new Set(head(d).faces.map((f) => f.color));
  for (const c of [p.skin.deep, p.skin.shade, p.skin.skin, p.hair.deep, p.hair.base, p.hair.mid, p.hair.shine]) assert.ok(colours.has(c), c);
});

test('face features lie on the skull surface, on the front', () => {
  const d = design({ eyes: { style: 'big', color: '#4a3a6a', lashes: true }, brows: 'thick', mouth: 'open', age: 'adult' });
  const m = metricsFor(d);
  const p = paletteFor(d);
  const { surfaceZ } = faceOps(m.halfHeadX, m.halfHeadZ);
  const S2 = Math.sin((3 * Math.PI) / 8);
  const epsOk = [1, 0.8, 1.4, 1.8].map((k) => k * 0.01);
  for (const opts of [{}, { angry: true }]) {
    const face = buildFace(d, p, m, opts);
    for (const f of face.faces) {
      for (const i of f.indices) {
        const [x, vy, z] = face.vertices[i];
        const yPx = vy / PX;
        const xPx = x / PX;
        assert.ok(Math.abs(xPx) <= S2 * (m.halfHeadX / PX) * 1.0001 + 1e-9, `x ${xPx} past the widest vertex`);
        const diff = z - surfaceZ(xPx, yPx);
        assert.ok(epsOk.some((e) => Math.abs(diff - e) < 1e-9), `z is ${diff} off the surface`);
      }
    }
  }
  const eyes = buildFace(d, p, m).faces.filter((f) => f.color === '#fbfbff');
  assert.equal(eyes.length >= 2, true);
  const face = buildFace(d, p, m);
  const ys = eyes.flatMap((f) => f.indices.map((i) => face.vertices[i][1]));
  const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
  assert.ok(Math.abs(mid - FRAME.eye) < PX, `eyes centred at ${mid}, eye line ${FRAME.eye}`);
});

test('an angry thick-browed patron keeps thick brows', () => {
  const thin = head(design(), { angry: true });
  const thick = head(design({ brows: 'thick' }), { angry: true });
  assert.notDeepEqual(thick.vertices, thin.vertices);
});
