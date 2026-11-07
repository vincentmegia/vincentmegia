import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBookshelf, paintBookshelfArt, BOOKSHELF_ART, BOOKSHELF_SIZE, ART_SCALE } from './bookshelf.js';
import { bookcaseLayout, BOOKCASE_COLORS } from '../../anime-furniture.js';

// A stand-in for the canvas the game paints drawBookcase into.
const ART = { width: BOOKSHELF_ART.w * ART_SCALE, height: BOOKSHELF_ART.h * ART_SCALE };
const L = bookcaseLayout(BOOKSHELF_ART, BOOKSHELF_ART.rows);
const bbox = (m) => [0, 1, 2].map((k) => {
  const a = m.vertices.map((v) => v[k]);
  return [Math.min(...a), Math.max(...a)];
});
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);
const textured = (m) => m.faces.filter((f) => f.texture);
// A textured face's uv box, back in the art's centered px.
const uvBox = (f) => {
  const us = f.texture.uv.map(([u]) => u / ART_SCALE - BOOKSHELF_ART.w / 2);
  const vs = f.texture.uv.map(([, v]) => v / ART_SCALE - BOOKSHELF_ART.h / 2);
  return { x0: Math.min(...us), y0: Math.min(...vs), x1: Math.max(...us), y1: Math.max(...vs) };
};

test('real-world size: base on the floor, centered, the case filling the box', () => {
  for (const m of [buildBookshelf(), buildBookshelf({ art: ART })]) {
    const [bx, by, bz] = bbox(m);
    near(bx[0], -BOOKSHELF_SIZE.width / 2);
    near(bx[1], BOOKSHELF_SIZE.width / 2);
    near(by[0], 0);
    near(by[1], BOOKSHELF_SIZE.height);
    near(bz[0], -BOOKSHELF_SIZE.depth / 2);
    assert.ok(bz[1] <= BOOKSHELF_SIZE.depth / 2 + 0.02, 'only the plank lips stand proud');
  }
});

test('the art is drawn at the mesh\'s own aspect, so it maps without stretching', () => {
  const c = L.case;
  near((c.x1 - c.x0) / (c.y1 - c.y0), BOOKSHELF_SIZE.width / BOOKSHELF_SIZE.height);
});

test('with art, every front is a textured, unlit face whose uv stays on the image', () => {
  const m = buildBookshelf({ art: ART });
  const t = textured(m);
  // crown + plinth + 2 sides + a spine row and a plank per shelf
  assert.equal(t.length, 4 + 2 * BOOKSHELF_ART.rows);
  for (const f of t) {
    assert.equal(f.texture.image, ART);
    assert.equal(f.unlit, true, 'the 2D art carries its own top-lit shading');
    assert.equal(f.indices.length, 4);
    for (const [u, v] of f.texture.uv) {
      assert.ok(u >= 0 && u <= ART.width && v >= 0 && v <= ART.height, `uv ${u},${v} off the image`);
    }
    // Every textured face looks out of the shelf (+Z).
    const z = f.indices.map((i) => m.vertices[i][2]);
    assert.ok(z.every((v) => Math.abs(v - z[0]) < 1e-12));
  }
});

test('each front maps exactly its own region of bookcaseLayout', () => {
  const t = textured(buildBookshelf({ art: ART }));
  const boxes = t.map(uvBox);
  const has = (r) => assert.ok(boxes.some((b) => ['x0', 'y0', 'x1', 'y1'].every((k) => Math.abs(b[k] - r[k]) < 1e-9)), JSON.stringify(r));
  // The crown carries the sign.
  has({ x0: L.case.x0, y0: L.case.y0, x1: L.case.x1, y1: L.back.y0 });
  assert.ok(L.sign.y1 <= L.back.y0, 'the sign sits inside the crown');
  for (const s of L.shelves) has(s.plank);
  L.shelves.forEach((s, r) => has({ x0: L.back.x0, y0: r === 0 ? L.back.y0 : L.shelves[r - 1].plank.y1, x1: L.back.x1, y1: s.plank.y0 }));
});

test('spine rows sit recessed behind the frame; plank lips stand in front of it', () => {
  const m = buildBookshelf({ art: ART });
  const frontZ = (f) => m.vertices[f.indices[0]][2];
  const t = textured(m);
  const planks = new Set(L.shelves.map((s) => JSON.stringify(s.plank)));
  const isPlank = (f) => planks.has(JSON.stringify(Object.fromEntries(Object.entries(uvBox(f)).map(([k, v]) => [k, Math.round(v * 1e6) / 1e6]))));
  const rows = t.filter((f) => uvBox(f).x0 === L.back.x0 && !isPlank(f));
  const frame = t.filter((f) => !rows.includes(f) && !isPlank(f));
  const lips = t.filter(isPlank);
  assert.equal(rows.length, BOOKSHELF_ART.rows);
  assert.equal(lips.length, BOOKSHELF_ART.rows);
  const fz = Math.max(...frame.map(frontZ));
  for (const f of rows) assert.ok(frontZ(f) < fz - 0.05, 'rows are recessed into the bay');
  for (const f of lips) assert.ok(frontZ(f) > fz, 'planks stand proud of the frame');
});

test('no untextured face is coplanar with a textured front (no painter-sort ties)', () => {
  const m = buildBookshelf({ art: ART });
  const plane = (f) => {
    const p = f.indices.map((i) => m.vertices[i]);
    return p.every((v) => Math.abs(v[2] - p[0][2]) < 1e-12) ? p[0][2] : null;
  };
  const texZ = new Set(textured(m).map(plane).map((z) => z.toFixed(6)));
  for (const f of m.faces.filter((x) => !x.texture)) {
    const z = plane(f);
    if (z === null) continue;
    assert.ok(!texZ.has(z.toFixed(6)), `untextured face at z=${z} ties with a textured front`);
  }
});

test('without art the same geometry is drawn in the bookcase\'s flat colours', () => {
  const flat = buildBookshelf();
  const tex = buildBookshelf({ art: ART });
  assert.equal(flat.faces.length, tex.faces.length);
  assert.ok(!flat.faces.some((f) => f.texture));
  const colors = new Set(flat.faces.map((f) => f.color));
  for (const c of [BOOKCASE_COLORS.case, BOOKCASE_COLORS.back, BOOKCASE_COLORS.plank]) assert.ok(colors.has(c), c);
});

test('a plank lip is plank-coloured where the art does not cover it (its top)', () => {
  const m = buildBookshelf({ art: ART });
  const tops = m.faces.filter((f) => !f.texture && f.color === BOOKCASE_COLORS.plank);
  assert.ok(tops.length >= BOOKSHELF_ART.rows);
});

test('face budget and determinism', () => {
  const m = buildBookshelf({ art: ART });
  assert.ok(m.faces.length <= 60, `${m.faces.length} faces`);
  for (const f of m.faces) for (const i of f.indices) assert.ok(i >= 0 && i < m.vertices.length);
  assert.deepEqual(buildBookshelf({ art: ART }), buildBookshelf({ art: ART }));
});

test('paintBookshelfArt paints an opaque backing, then drawBookcase at the art box and rows', () => {
  const calls = [];
  const grad = { addColorStop() {} };
  const ctx = new Proxy({}, {
    get: (_, k) => (k === 'measureText' ? () => ({ width: 5 }) : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => grad : (...a) => calls.push([k, a])),
    set: (_, k, v) => { calls.push(['set:' + k, [v]]); return true; },
  });
  paintBookshelfArt(ctx, { id: 'bookshelf-mystery' }, { color: '#4a4e69', sign: '추리 · Mystery', titles: ['가나다'] });
  // The backing goes down first and covers the whole image: the renderer's
  // shading overlays need the mapped region opaque (the case's rounded
  // corners would otherwise show through).
  const firstFill = calls.findIndex(([k]) => k === 'fillRect');
  assert.ok(firstFill >= 0);
  assert.deepEqual(calls[firstFill][1], [0, 0, ART.width, ART.height]);
  assert.ok(calls.slice(0, firstFill).some(([k, a]) => k === 'set:fillStyle' && a[0] === BOOKCASE_COLORS.case));
  // One plank block per row: drawBookcase got rows.
  const planks = calls.filter(([k, a]) => k === 'roundRect' && a[3] === 4 && a[2] === L.back.x1 - L.back.x0 + 4);
  assert.equal(planks.length, BOOKSHELF_ART.rows);
});

test('every face culls, and its winding faces out: fronts show from in front, never from behind', async () => {
  const { buildDrawList, cameraFromPose } = await import('../core.js');
  const m = buildBookshelf({ art: ART });
  assert.ok(m.faces.every((f) => f.cull === true));
  const env = { viewport: { width: 400, height: 400 }, light: { dir: [0.35, 1, 0.25], ambient: 0.5 } };
  const placed = [{ mesh: m, placement: { pos: [0, 0, 0], yaw: 0, scale: 40 } }];
  const cam = (z, facing) => cameraFromPose({ x: 0, y: z, facing }, { eyeHeight: 60, fov: Math.PI / 3, aspect: 1, near: 1, far: 2000 });
  const textured = (list) => list.filter((p) => p.image).length;
  const front = buildDrawList(cam(120, 0), placed, env);
  // Head-on, every textured face is turned toward the camera: 2 triangles per cell.
  const cells = m.faces.filter((f) => f.texture).reduce((n, f) => n + f.texture.div[0] * f.texture.div[1], 0);
  assert.equal(textured(front), 2 * cells);
  // Eye (60) is below the crown (80): its top face is turned away and dropped.
  const behind = buildDrawList(cam(-120, Math.PI), placed, env);
  assert.equal(textured(behind), 0, 'no art seen through the back');
  assert.ok(behind.length > 0, 'the case back is seen');
});
