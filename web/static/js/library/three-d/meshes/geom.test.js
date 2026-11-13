import { test } from 'node:test';
import assert from 'node:assert/strict';
import { box, prism, quad, translate, scaleMesh, scaleAbout, emptyMesh, merge, boxWithout, artFrontUV, textureFront, artBackUV, textureBack, tube, loft, faceNormal, projectFront } from './geom.js';

function normal(mesh, face) {
  const [a, b, c] = face.indices.map((i) => mesh.vertices[i]);
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
}
function centroid(pts) {
  const n = pts.length;
  return [0, 1, 2].map((k) => pts.reduce((s, p) => s + p[k], 0) / n);
}
function assertOutward(mesh, centre) {
  for (const f of mesh.faces) {
    const n = normal(mesh, f);
    const c = centroid(f.indices.map((i) => mesh.vertices[i]));
    const d = n[0] * (c[0] - centre[0]) + n[1] * (c[1] - centre[1]) + n[2] * (c[2] - centre[2]);
    assert.ok(d > 0, `face ${f.indices} wound inward (dot ${d})`);
  }
}
const rings3 = [
  { y: 0, rx: 0.2, rz: 0.2, color: '#100000' },
  { y: 0.5, rx: 0.3, rz: 0.25, color: '#200000' },
  { y: 1, rx: 0.1, rz: 0.1, color: '#300000' },
];

test('box has 8 vertices and 6 quad faces', () => {
  const m = box([0, 0, 0], [1, 1, 1], '#111111');
  assert.equal(m.vertices.length, 8);
  assert.equal(m.faces.length, 6);
  for (const f of m.faces) assert.equal(f.indices.length, 4);
});

test('box tint overrides only the named faces', () => {
  const m = box([0, 0, 0], [1, 1, 1], '#111111', { top: '#222222' });
  assert.equal(m.faces.filter((f) => f.color === '#222222').length, 1);
  assert.equal(m.faces.filter((f) => f.color === '#111111').length, 5);
  assert.equal(m.faces[4].color, '#222222');
});

test('box faces wind counter-clockwise seen from outside', () => {
  assertOutward(box([-1, 0, -2], [1, 3, 2], '#111111'), [0, 1.5, 0]);
});

test('prism ring count drives vertices and side faces', () => {
  const m = prism(rings3, 8, null, null);
  assert.equal(m.vertices.length, 24);
  assert.equal(m.faces.length, 16);
});

test('prism adds caps when colours are given', () => {
  const m = prism(rings3, 8, '#aa0000', '#00aa00');
  assert.equal(m.faces.length, 18);
  assert.equal(m.faces.filter((f) => f.indices.length === 8).length, 2);
});

test('prism side band takes the upper ring colour', () => {
  const m = prism(rings3, 8, null, null);
  assert.ok(m.faces.slice(0, 8).every((f) => f.color === '#200000'));
  assert.ok(m.faces.slice(8, 16).every((f) => f.color === '#300000'));
});

test('prism faces wind counter-clockwise seen from outside', () => {
  const m = prism(rings3, 8, '#aa0000', '#00aa00');
  assertOutward(m, [0, 0.5, 0]);
});

test('prism with even sides has a flat face toward +Z', () => {
  const m = prism(rings3.slice(0, 2), 4, null, null);
  const front = m.faces.find((f) => normal(m, f)[2] > 0 && Math.abs(normal(m, f)[0]) < 1e-9);
  assert.ok(front);
});

test('quad marks the face unlit when asked', () => {
  const m = quad([[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], '#fff', { unlit: true });
  assert.equal(m.faces[0].unlit, true);
  assert.equal(m.vertices.length, 4);
  assert.equal(quad([[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], '#fff').faces[0].unlit, undefined);
});

test('translate and scaleMesh do not mutate the source', () => {
  const src = box([0, 0, 0], [1, 1, 1], '#111111');
  const snap = JSON.stringify(src);
  const t = translate(src, [1, 2, 3]);
  const s = scaleMesh(src, 2);
  assert.equal(JSON.stringify(src), snap);
  assert.deepEqual(t.vertices[0], [1, 2, 3]);
  assert.deepEqual(s.vertices[7], [2, 2, 2]);
  assert.equal(t.faces, src.faces);
  assert.equal(s.faces, src.faces);
});

test('scaleAbout keeps the pivot plane fixed', () => {
  const src = { vertices: [[1, 0.5, 1], [1, 1.5, 1]], faces: [] };
  const m = scaleAbout(src, 2, 0.5);
  assert.deepEqual(m.vertices[0], [2, 0.5, 2]);
  assert.deepEqual(m.vertices[1], [2, 2.5, 2]);
  assert.deepEqual(src.vertices[0], [1, 0.5, 1]);
});

test('merge offsets indices and mutates the target', () => {
  const t = emptyMesh();
  merge(t, box([0, 0, 0], [1, 1, 1], '#111111'));
  const r = merge(t, box([2, 0, 0], [3, 1, 1], '#111111'));
  assert.equal(r, t);
  assert.equal(t.vertices.length, 16);
  assert.ok(t.faces[6].indices.every((i) => i >= 8));
});

test('every index is in range for box and prism', () => {
  for (const m of [box([0, 0, 0], [1, 1, 1], '#111111'), prism(rings3, 6, '#aa0000', '#00aa00')]) {
    for (const f of m.faces) for (const i of f.indices) assert.ok(i >= 0 && i < m.vertices.length);
  }
});

test('boxWithout drops only the named faces and keeps the front first', () => {
  const b = boxWithout([0, 0, 0], [1, 1, 1], '#111', ['back', 'top']);
  assert.equal(b.faces.length, 4);
  assert.deepEqual(b.faces[0].indices, box([0, 0, 0], [1, 1, 1], '#111').faces[0].indices);
  assert.equal(boxWithout([0, 0, 0], [1, 1, 1], '#111').faces.length, 6);
});

test('artFrontUV maps an art rect onto the +Z front, model y up = art y down', () => {
  const uv = artFrontUV({ x0: -10, y0: -20, x1: 10, y1: 20 }, { w: 40, h: 80 }, 2);
  // corners in box front order: (x0,yLow) (x1,yLow) (x1,yHigh) (x0,yHigh)
  assert.deepEqual(uv, [[20, 120], [60, 120], [60, 40], [20, 40]]);
});

test('artBackUV maps an art rect onto the -Z face, seen from -Z (art x = -model x)', () => {
  // A viewer on the -Z side looking toward +Z has model -X on their right, so
  // a part showing art rect r spans model x from -r.x1 to -r.x0.
  const r = { x0: -10, y0: -20, x1: 6, y1: 20 };
  const artBox = { w: 40, h: 80 };
  const b = box([-r.x1, -r.y1, 0], [-r.x0, -r.y0, 1], '#000');
  const back = b.faces[1];
  const uv = artBackUV(r, artBox, 2);
  back.indices.forEach((vi, k) => {
    const [X, Y] = b.vertices[vi];
    assert.deepEqual(uv[k], [(-X + artBox.w / 2) * 2, (-Y + artBox.h / 2) * 2], `corner ${k}`);
  });
});

test('textureBack textures and unlights the -Z face, wherever boxWithout left it', () => {
  const r = { x0: 0, y0: 0, x1: 5, y1: 5 };
  const opts = { artBox: { w: 10, h: 10 }, scale: 1, color: '#abc', div: [1, 2] };
  const img = { width: 10, height: 10 };
  for (const drop of [[], ['front'], ['front', 'top']]) {
    const part = textureBack(boxWithout([0, 0, 0], [1, 1, 1], '#000', drop), r, { ...opts, image: img });
    const tex = part.faces.filter((f) => f.texture);
    assert.equal(tex.length, 1);
    assert.deepEqual(tex[0].indices, [1, 0, 2, 3], 'the -Z face');
    assert.equal(tex[0].unlit, true);
    assert.deepEqual(tex[0].texture.uv, artBackUV(r, opts.artBox, 1));
  }
  const flat = textureBack(boxWithout([0, 0, 0], [1, 1, 1], '#000', ['front']), r, opts);
  assert.equal(flat.faces[0].color, '#abc');
  assert.ok(!flat.faces.some((f) => f.texture || f.unlit));
});

test('textureFront textures and unlights faces[0] with art, else flat-colours it', () => {
  const r = { x0: 0, y0: 0, x1: 5, y1: 5 };
  const opts = { artBox: { w: 10, h: 10 }, scale: 1, color: '#abc', div: [2, 1] };
  const img = { width: 10, height: 10 };
  const lit = textureFront(box([0, 0, 0], [1, 1, 1], '#000'), r, { ...opts, image: img });
  assert.equal(lit.faces[0].texture.image, img);
  assert.deepEqual(lit.faces[0].texture.div, [2, 1]);
  assert.equal(lit.faces[0].unlit, true);
  assert.equal(lit.faces[1].texture, undefined);
  const flat = textureFront(box([0, 0, 0], [1, 1, 1], '#000'), r, opts);
  assert.equal(flat.faces[0].color, '#abc');
  assert.equal(flat.faces[0].texture, undefined);
  assert.equal(flat.faces[0].unlit, undefined);
});

// -- tube, loft, faceNormal, projectFront (Min-jun's mesh) ---------------------

const faceCentre = (m, f) => f.indices.reduce((s, i) => s.map((x, k) => x + m.vertices[i][k] / f.indices.length), [0, 0, 0]);

test('tube: a ring at each end, perpendicular to the axis, every face (caps too) wound outward', () => {
  for (const [a, b] of [[[0, 0, 0], [0, 1, 0]], [[0, 0, 0], [0, -1, 0.3]], [[0.2, 0.1, 0], [1, 0, 0]], [[0, 0, 0], [0, 0, 1]]]) {
    const m = tube(a, b, 0.1, 0.05, 6, '#ffffff', { capA: '#ff0000', capB: '#00ff00' });
    assert.equal(m.vertices.length, 12);
    assert.equal(m.faces.length, 8);
    const ax = b.map((c, k) => c - a[k]);
    const mid = a.map((c, k) => (c + b[k]) / 2);
    for (const f of m.faces) {
      const n = faceNormal(m, f);
      const c = faceCentre(m, f);
      assert.ok(n[0] * (c[0] - mid[0]) + n[1] * (c[1] - mid[1]) + n[2] * (c[2] - mid[2]) > 0, `${f.color} outward`);
    }
    // Each ring's points are its radius from its end, square to the axis.
    m.vertices.slice(0, 6).forEach((v) => {
      const d = v.map((c, k) => c - a[k]);
      assert.ok(Math.abs(Math.hypot(...d) - 0.1) < 1e-9);
      assert.ok(Math.abs(d[0] * ax[0] + d[1] * ax[1] + d[2] * ax[2]) < 1e-9);
    });
  }
});

test('loft: prism with each ring moved to its own centre', () => {
  const rings = [{ y: 0, rx: 1, rz: 1, color: '#111111' }, { y: 1, rx: 1, rz: 1, cx: 0.5, cz: -0.25, color: '#222222' }];
  const p = prism(rings, 8);
  const l = loft(rings, 8);
  assert.deepEqual(l.faces, p.faces);
  l.vertices.forEach((v, i) => {
    const r = rings[Math.floor(i / 8)];
    assert.deepEqual(v, [p.vertices[i][0] + (r.cx ?? 0), p.vertices[i][1], p.vertices[i][2] + (r.cz ?? 0)]);
  });
});

test('projectFront: only quads turned toward +Z take the art (unlit, uv from toUV); nothing changes without an image', () => {
  const make = () => prism([{ y: 0, rx: 1, rz: 1, color: '#333333' }, { y: 1, rx: 1, rz: 1, color: '#333333' }], 8, '#444444');
  const image = { width: 10, height: 10 };
  const m = projectFront(make(), { image, toUV: (v) => [v[0] * 5 + 5, 10 - v[1] * 10], minNz: 0.35 });
  const dressed = m.faces.filter((f) => f.texture);
  assert.equal(dressed.length, 3, 'the front and the two faces either side of it');
  for (const f of dressed) {
    assert.ok(faceNormal(m, f)[2] >= 0.35);
    assert.equal(f.unlit, true);
    assert.deepEqual(f.texture.uv, f.indices.map((i) => [m.vertices[i][0] * 5 + 5, 10 - m.vertices[i][1] * 10]));
  }
  assert.equal(m.faces.at(-1).texture, undefined, 'the top cap is not a +Z quad');
  assert.deepEqual(projectFront(make(), { image: null, toUV: () => [0, 0] }), make());
  const some = projectFront(make(), { image, toUV: () => [0, 0], only: (f) => f === undefined });
  assert.equal(some.faces.filter((f) => f.texture).length, 0);
});
