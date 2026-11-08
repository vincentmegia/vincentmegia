import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBody } from './character-body.js';
import { FRAME, PX, artY, metricsFor } from './character-frame.js';
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
  const atWaist = widthIn(mesh, artY(21), artY(22.5));
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

// One material, one rule (see buildBody): the skin tones already carry their
// shading, so every surface painted in them opts out of the scene light — the
// head's faces do, and so must the hands, the neck and bare legs, or the same
// hex renders 27% brighter on the face than on the hands of the same patron.
// Clothing keeps its flat design colours and stays lit.
test('only the baked skin-toned faces are unlit, and every colour is valid', () => {
  for (const d of [trousered, skirted, shorts, teeLong, ...LIBRARY_PATRON_DESIGNS]) {
    const { mesh, palette } = build(d);
    const skin = new Set(Object.values(palette.skin));
    for (const f of mesh.faces) {
      assert.equal(Boolean(f.unlit), skin.has(f.color), `${d.key ?? d.outfit.kind} ${f.color} unlit=${Boolean(f.unlit)}`);
      assert.match(f.color, COLOUR);
    }
  }
});

// The sleeve's inner edge used to be pinned at the torso's hem half-width for
// its whole run, but torso() pulls its top ring in to halfShoulder * 0.7, so
// above the 38px shoulder ring each sleeve floated 0.6-1.7px clear of the body
// (+0.57 at y 41, +1.74 at 43). It now follows the torso's own profile. This
// measures the real thing: for every box the sleeve is built from, at nine
// heights across it, the box's inner face is inside the torso's silhouette at
// that height.
test('the sleeves stay attached to the torso at every height, slim and not', () => {
  const ARM_Z = 2.4 * PX;
  for (const d of [trousered, skirted]) {
    const { mesh, metrics } = build(d);
    // The torso prism's rings: the vertices at a ring height that are not a
    // sleeve's (|z| exactly ARM_Z). Its widest x at a height is its half-width.
    const ringYs = [artY(20.6), artY(30), artY(38), FRAME.shoulder];
    const halves = ringYs.map((ry) =>
      maxAbsX(mesh.vertices.filter((v) => Math.abs(v[1] - ry) < EPS && Math.abs(Math.abs(v[2]) - ARM_Z) > EPS)));
    const torsoHalf = (yv) => {
      if (yv <= ringYs[0]) return halves[0];
      for (let i = 1; i < ringYs.length; i++) {
        if (yv <= ringYs[i]) return halves[i - 1] + ((halves[i] - halves[i - 1]) * (yv - ringYs[i - 1])) / (ringYs[i] - ringYs[i - 1]);
      }
      return halves[halves.length - 1];
    };
    assert.ok(Math.abs(halves[2] - metrics.halfShoulder) < 1e-9, `shoulder ring ${halves[2]}`);
    // A sleeve box's +Z face: four vertices at z = +ARM_Z. Take the right side.
    const faces = mesh.faces.filter((f) => {
      const vs = faceVerts(mesh, f);
      return vs.length === 4 && vs.every((v) => Math.abs(v[2] - ARM_Z) < EPS) && vs.every((v) => v[0] > 0);
    });
    assert.ok(faces.length >= 3, `found ${faces.length} sleeve boxes`);
    let highest = 0;
    let protrudes = false;
    for (const f of faces) {
      const vs = faceVerts(mesh, f);
      const inner = Math.min(...vs.map((v) => v[0]));
      const outer = Math.max(...vs.map((v) => v[0]));
      const yb = Math.min(...vs.map((v) => v[1]));
      const yt = Math.max(...vs.map((v) => v[1]));
      highest = Math.max(highest, yt);
      for (let i = 0; i <= 8; i++) {
        const yv = yb + ((yt - yb) * i) / 8;
        assert.ok(inner <= torsoHalf(yv) + EPS,
          `sleeve inner ${inner / PX}px is ${(inner - torsoHalf(yv)) / PX}px clear of the torso at ${yv / PX}px`);
      }
      if (outer > torsoHalf(yb)) protrudes = true;
    }
    // ...and it still reaches the shoulder and still reads as an arm, so the
    // gap cannot be closed by shortening or burying the sleeve.
    assert.ok(highest >= artY(42) - EPS, `sleeve stops at ${highest / PX}px`);
    assert.ok(protrudes, 'the sleeve never clears the torso silhouette');
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
