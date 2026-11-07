import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHead, buildFace, buildHeadwear, buildSkull, buildHair } from './character-head.js';
import { paletteFor } from './character-palette.js';
import { metricsFor, FRAME, PX, artY } from './character-frame.js';

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

test('the skull bands in three skin tones and the hair in three plus a shine cap', () => {
  const d = design();
  const p = paletteFor(d);
  const m = metricsFor(d);
  // buildSkull: a 5-ring prism (4 bands x 8 sides) first, then the caps and ears.
  const skull = buildSkull(p.skin, m);
  assert.deepEqual(new Set(skull.faces.slice(0, 32).map((f) => f.color)), new Set([p.skin.deep, p.skin.shade, p.skin.skin]));
  // buildHair: a 4-ring cap (3 bands x 8 sides) then its top cap.
  const hair = buildHair(d, p, m);
  assert.deepEqual(new Set(hair.faces.slice(0, 24).map((f) => f.color)), new Set([p.hair.deep, p.hair.base, p.hair.mid]));
  assert.equal(hair.faces[24].color, p.hair.shine);
});

/** The skull's own surface z at (x, y): the front-facing facet spanning x, from the mesh's vertices. */
function skullZ(skull, x, yv) {
  const bandY = [FRAME.chin, artY(47.6), artY(53), artY(60), FRAME.crown];
  let k = bandY.findIndex((top, i) => i > 0 && yv <= top + 1e-12);
  if (k < 1) k = 1;
  const t = (yv - bandY[k - 1]) / (bandY[k] - bandY[k - 1]);
  for (let i = 0; i < 8; i++) {
    const [a, b, c, dd] = skull.faces[(k - 1) * 8 + i].indices.map((n) => skull.vertices[n]);
    // a,b on the lower ring; dd,c above them.
    const p0 = [a[0] + (dd[0] - a[0]) * t, a[2] + (dd[2] - a[2]) * t];
    const p1 = [b[0] + (c[0] - b[0]) * t, b[2] + (c[2] - b[2]) * t];
    if (p0[1] <= 0 && p1[1] <= 0) continue; // a back facet
    const lo = Math.min(p0[0], p1[0]);
    const hi = Math.max(p0[0], p1[0]);
    if (x >= lo - 1e-9 && x <= hi + 1e-9) return p0[1] + ((p1[1] - p0[1]) * (x - p0[0])) / (p1[0] - p0[0]);
  }
  return null;
}

test('face features lie on the real skull, the right distance proud', () => {
  const d = design({ eyes: { style: 'big', color: '#4a3a6a', lashes: true }, brows: 'thick', mouth: 'open' });
  const m = metricsFor(d);
  const p = paletteFor(d);
  const skull = buildSkull(p.skin, m);
  const eps = { '#fbfbff': 0.01, [p.eyes]: 0.014, '#1e120c': 0.016, '#ffffff': 0.02, '#1e1418': 0.014, '#f2a29a': 0.008, [p.skin.deep]: 0.008, [p.brow]: 0.01, [p.lips]: 0.01, '#5a2a30': 0.014 };
  for (const opts of [{}, { angry: true }]) {
    const face = buildFace(d, p, m, opts);
    for (const f of face.faces) {
      assert.ok(f.color in eps, `unexpected face colour ${f.color}`);
      const vs = f.indices.map((i) => face.vertices[i]);
      // Corners lie on the skull, and so do the horizontal edges' midpoints (no chord sinks into a facet change).
      const samples = vs.map((v) => ({ v, tol: 1e-9 }));
      const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
      // Only the horizontal edges: a tall quad legitimately sags a little across a skull ring (y) kink.
      samples.push({ v: mid(vs[0], vs[1]), tol: 0.003, sinkOnly: true }, { v: mid(vs[3], vs[2]), tol: 0.003, sinkOnly: true });
      for (const { v, tol, sinkOnly } of samples) {
        const z = skullZ(skull, v[0], v[1]);
        assert.notEqual(z, null, `x ${v[0] / PX} px is past the widest front vertex at y ${v[1] / PX} px`);
        const diff = v[2] - z;
        if (sinkOnly) assert.ok(diff >= eps[f.color] - tol, `${f.color} sinks into the skull by ${eps[f.color] - diff}`);
        else assert.ok(Math.abs(diff - eps[f.color]) < tol, `${f.color} is ${diff} off the skull, expected ${eps[f.color]}`);
      }
    }
  }
  const face = buildFace(d, p, m);
  const ys = face.faces.filter((f) => f.color === '#fbfbff').flatMap((f) => f.indices.map((i) => face.vertices[i][1]));
  assert.ok(ys.length >= 8);
  assert.ok(Math.abs((Math.min(...ys) + Math.max(...ys)) / 2 - FRAME.eye) < PX);
});

test('an angry thick-browed patron keeps thick brows', () => {
  const thin = head(design(), { angry: true });
  const thick = head(design({ brows: 'thick' }), { angry: true });
  assert.notDeepEqual(thick.vertices, thin.vertices);
});
