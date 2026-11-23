import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReturnCart, paintReturnCartArt, RETURN_CART_ART, RETURN_CART_ART_SCALE, RETURN_CART_TAG,
  RETURN_CART_BOOK_SLOTS, RETURN_CART_VISIBLE_BOOKS, RETURN_CART_SIZE,
} from './return-cart.js';
import { BOOK_SIZE } from './book.js';
import { returnCartLayout, returnCartDecorBooks, RETURN_CART_COLORS } from '../../anime-furniture.js';
import { stationTop } from '../labels.js';
import { UNIT_SCALE } from '../scene.js';

// A stand-in for the canvas the game paints drawReturnCart into.
const ART = { width: RETURN_CART_ART.w * RETURN_CART_ART_SCALE, height: RETURN_CART_ART.h * RETURN_CART_ART_SCALE };
const L = returnCartLayout(RETURN_CART_ART);
const C = RETURN_CART_COLORS;
const TOP_TRAY = 0.82;
const LOWER_TRAY = 0.32;
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);
const textured = (m) => m.faces.filter((f) => f.texture);
// A textured face's uv box, back in the art's centered px.
const uvBox = (f) => {
  const us = f.texture.uv.map(([u]) => u / RETURN_CART_ART_SCALE - RETURN_CART_ART.w / 2);
  const vs = f.texture.uv.map(([, v]) => v / RETURN_CART_ART_SCALE - RETURN_CART_ART.h / 2);
  return { x0: Math.min(...us), y0: Math.min(...vs), x1: Math.max(...us), y1: Math.max(...vs) };
};
const sameRect = (a, b) => ['x0', 'y0', 'x1', 'y1'].every((k) => Math.abs(a[k] - b[k]) < 1e-9);
const pts = (m, f) => f.indices.map((i) => m.vertices[i]);
const span = (m, f, k) => { const a = pts(m, f).map((v) => v[k]); return [Math.min(...a), Math.max(...a)]; };
const normalZ = (m, f) => {
  const [p, q, r] = pts(m, f);
  return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
};
// The mesh's parts: faces grouped by the vertices they share (each merged part is its own group).
function parts(m) {
  const parent = m.vertices.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (const f of m.faces) for (const i of f.indices) parent[find(i)] = find(f.indices[0]);
  const groups = new Map();
  m.faces.forEach((f) => {
    const k = find(f.indices[0]);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(f);
  });
  return [...groups.values()].map((faces) => {
    const vs = faces.flatMap((f) => pts(m, f));
    const lo = [0, 1, 2].map((k) => Math.min(...vs.map((v) => v[k])));
    const hi = [0, 1, 2].map((k) => Math.max(...vs.map((v) => v[k])));
    return { faces, lo, hi, color: faces[0].color };
  });
}

test('the top tray\'s book slots are unchanged: five, 0.29 apart, on the top tray', () => {
  assert.equal(RETURN_CART_VISIBLE_BOOKS, 5);
  const want = [-0.58, -0.29, 0, 0.29, 0.58];
  assert.equal(RETURN_CART_BOOK_SLOTS.length, 5);
  RETURN_CART_BOOK_SLOTS.forEach(([x, y, z], i) => {
    near(x, want[i]);
    assert.equal(y, TOP_TRAY);
    assert.equal(z, 0.05);
  });
});

test('the trays keep their size: 1.6 x 1.0, the lower 0.2-0.32, the upper 0.7-0.82, each top a supporting surface', () => {
  const m = buildReturnCart();
  const trays = parts(m).filter((p) => p.color === C.wood && p.hi[0] - p.lo[0] > 1.5);
  assert.equal(trays.length, 2);
  trays.sort((a, b) => a.lo[1] - b.lo[1]);
  assert.deepEqual(trays.map((t) => [t.lo, t.hi]), [[[-0.8, 0.2, -0.5], [0.8, LOWER_TRAY, 0.5]], [[-0.8, 0.7, -0.5], [0.8, TOP_TRAY, 0.5]]]);
  // Each top is split into cells (so the painter's mean depth keeps what sits
  // under a tray under it); the cells tile it exactly, face up, and each is
  // a supporting surface.
  const under = m.faces.filter((f) => f.under);
  assert.ok(under.every((f) => f.cull && f.color === C.wood && f.indices.length === 4));
  for (const y of [LOWER_TRAY, TOP_TRAY]) {
    const cells = under.filter((f) => pts(m, f).every((v) => v[1] === y));
    assert.ok(cells.length > 1, `the top at ${y} is split`);
    const area = cells.reduce((s, f) => {
      const [x0, x1] = span(m, f, 0);
      const [z0, z1] = span(m, f, 2);
      const [p, q, r] = pts(m, f);
      const up = (q[2] - p[2]) * (r[0] - p[0]) - (q[0] - p[0]) * (r[2] - p[2]);
      assert.ok(up > 0, 'faces up');
      assert.ok(x0 >= -0.8 && x1 <= 0.8 && z0 >= -0.5 && z1 <= 0.5);
      return s + (x1 - x0) * (z1 - z0);
    }, 0);
    near(area, 1.6, 1e-12);
  }
  assert.equal(under.length, m.faces.filter((f) => pts(m, f).every((v) => v[1] === LOWER_TRAY || v[1] === TOP_TRAY) && f.color === C.wood && span(m, f, 1)[0] === span(m, f, 1)[1]).length, 'only the tops');
});

test('with art, the tag and both trays wear their own regions on +Z fronts, unlit, uv on the image', () => {
  const m = buildReturnCart({ art: ART });
  const t = textured(m);
  assert.equal(t.length, 3);
  for (const f of t) {
    assert.equal(f.texture.image, ART);
    assert.equal(f.unlit, true, 'the 2D art carries its own top-lit shading');
    assert.equal(f.indices.length, 4);
    const z = pts(m, f).map((v) => v[2]);
    assert.ok(z.every((v) => Math.abs(v - z[0]) < 1e-12), 'one plane');
    assert.ok(normalZ(m, f) > 0, 'faces +Z');
    for (const [u, v] of f.texture.uv) assert.ok(u >= 0 && u <= ART.width && v >= 0 && v <= ART.height, `uv ${u},${v} off the image`);
  }
  for (const r of [L.tag, ...L.trays]) assert.ok(t.some((f) => sameRect(uvBox(f), r)), JSON.stringify(r));
  // The lower tray's front in four cells (the wheels stand just behind its outer quarters).
  assert.deepEqual([L.tag, ...L.trays].map((r) => t.find((f) => sameRect(uvBox(f), r)).texture.div), [[2, 1], [2, 1], [4, 1]]);
  // Each tray's front is its own tray box's front.
  L.trays.forEach((r, i) => {
    const f = t.find((x) => sameRect(uvBox(x), r));
    assert.deepEqual(span(m, f, 1), i === 0 ? [0.7, TOP_TRAY] : [0.2, LOWER_TRAY]);
    assert.deepEqual(span(m, f, 0), [-0.8, 0.8]);
    near(pts(m, f)[0][2], 0.5);
  });
});

test('the tag hangs at the back, facing +Z, clear above the real books, RETURN_CART_TAG\'s size', () => {
  near(RETURN_CART_TAG.width, 0.9);
  near(RETURN_CART_TAG.y0, 1.2);
  near(RETURN_CART_TAG.y1, 1.2 + (0.9 * 14) / 52);
  const m = buildReturnCart({ art: ART });
  const f = textured(m).find((x) => sameRect(uvBox(x), L.tag));
  assert.ok(pts(m, f)[0][2] <= -0.4, 'at the back of the cart');
  assert.ok(normalZ(m, f) > 0, 'facing +Z');
  const [y0, y1] = span(m, f, 1);
  assert.ok(y0 >= TOP_TRAY + BOOK_SIZE.height, `the tag's bottom ${y0} clears the books' tops`);
  near(y0, RETURN_CART_TAG.y0);
  near(y1, RETURN_CART_TAG.y1);
  const [x0, x1] = span(m, f, 0);
  near(x1 - x0, RETURN_CART_TAG.width);
  near(x0, -x1);
  // Its art keeps the 2D's aspect: nothing stretches.
  near((x1 - x0) / (y1 - y0), (L.tag.x1 - L.tag.x0) / (L.tag.y1 - L.tag.y0));
});

test('the label chip sits on the tag: stationTop is the tag\'s top', () => {
  near(stationTop('return-cart'), RETURN_CART_TAG.y1 * UNIT_SCALE);
});

test('the lower tray holds the 2D\'s five books, left to right in its colours and heights, under the upper tray', () => {
  const m = buildReturnCart({ art: ART });
  const want = returnCartDecorBooks(1);
  const palette = new Set(want.map((b) => b.color));
  const books = parts(m).filter((p) => palette.has(p.color) && near0(p.lo[1] - LOWER_TRAY)).sort((a, b) => a.lo[0] - b.lo[0]);
  assert.equal(books.length, 5);
  books.forEach((b, i) => {
    assert.equal(b.color, want[i].color);
    near(b.hi[1] - b.lo[1], want[i].h * 0.02);
    near(b.hi[0] - b.lo[0], 0.2);
    near((b.lo[0] + b.hi[0]) / 2, (i - 2) * 0.24);
    near(b.hi[2] - b.lo[2], 0.3);
    assert.ok(b.hi[1] <= 0.7, 'under the upper tray\'s underside');
  });
});
function near0(x) { return Math.abs(x) < 1e-9; }

test('the wheels are round: a front and a back pair of 8-sided tubes, each round face and pale hub facing out at the tray\'s edge', () => {
  const m = buildReturnCart();
  const wheels = parts(m).filter((p) => p.color === C.wheel);
  assert.equal(wheels.length, 4);
  const at = wheels.map((w) => [(w.lo[0] + w.hi[0]) / 2, (w.lo[2] + w.hi[2]) / 2].map((v) => Math.round(v * 100) / 100)).sort();
  assert.deepEqual(at, [[-0.55, -0.38], [-0.55, 0.38], [0.55, -0.38], [0.55, 0.38]]);
  for (const w of wheels) {
    assert.ok(w.faces.filter((f) => f.indices.length === 4).length >= 8, 'not a box');
    near(w.lo[1], 0);
    near(w.hi[1], 0.2, 1e-12);
    const out = Math.sign(w.lo[2] + w.hi[2]);
    // Its round faces (8-gon caps) face along z, the outer one toward the cart's edge, inside the tray's footprint.
    const caps = w.faces.filter((f) => f.indices.length === 8);
    assert.equal(caps.length, 2);
    assert.ok(caps.some((f) => normalZ(m, f) * out > 0), 'a cap faces out');
    assert.ok(Math.max(Math.abs(w.lo[2]), Math.abs(w.hi[2])) <= 0.45);
  }
  // One hub per wheel, on the outer cap, its own cap facing out.
  const hubs = parts(m).filter((p) => p.color === C.hub);
  assert.equal(hubs.length, 4);
  for (const h of hubs) {
    const out = Math.sign(h.lo[2] + h.hi[2]);
    near(Math.min(Math.abs(h.lo[2]), Math.abs(h.hi[2])), 0.44, 1e-12);
    assert.ok(h.faces.some((f) => f.indices.length === 6 && normalZ(m, f) * out > 0));
  }
});

test('no two parts interpenetrate: their boxes meet in at most a plane', () => {
  const ps = parts(buildReturnCart());
  for (let i = 0; i < ps.length; i++) {
    for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i];
      const b = ps[j];
      const overlap = [0, 1, 2].every((k) => Math.min(a.hi[k], b.hi[k]) - Math.max(a.lo[k], b.lo[k]) > 1e-9);
      assert.ok(!overlap, `${JSON.stringify([a.lo, a.hi])} and ${JSON.stringify([b.lo, b.hi])}`);
    }
  }
});

test('without art the same faces are drawn in the cart\'s flat colours: tag white, trays wood', () => {
  const flat = buildReturnCart();
  const tex = buildReturnCart({ art: ART });
  assert.ok(!flat.faces.some((f) => f.texture));
  assert.equal(flat.faces.length, tex.faces.length);
  assert.deepEqual(flat.vertices, tex.vertices);
  const idx = tex.faces.map((f, i) => (f.texture ? i : -1)).filter((i) => i >= 0);
  const colorOf = (r) => flat.faces[idx.find((j) => sameRect(uvBox(tex.faces[j]), r))].color;
  assert.deepEqual([colorOf(L.tag), colorOf(L.trays[0]), colorOf(L.trays[1])], [C.tag, C.wood, C.wood]);
});

test('every face colour comes from RETURN_CART_COLORS', () => {
  const palette = new Set(Object.values(C).flat());
  for (const m of [buildReturnCart(), buildReturnCart({ art: ART })]) {
    for (const f of m.faces) assert.ok(palette.has(f.color), f.color);
  }
});

test('every face culls, and its winding faces out: fronts show from in front, never from behind', async () => {
  const { buildDrawList, cameraFromPose } = await import('../core.js');
  const m = buildReturnCart({ art: ART });
  assert.ok(m.faces.every((f) => f.cull === true));
  const env = { viewport: { width: 400, height: 400 }, light: { dir: [0.35, 1, 0.25], ambient: 0.5 } };
  const placed = [{ mesh: m, placement: { pos: [0, 0, 0], yaw: 0, scale: 40 } }];
  const cam = (z, facing) => cameraFromPose({ x: 0, y: z, facing }, { eyeHeight: 60, fov: Math.PI / 3, aspect: 1, near: 1, far: 2000 });
  const count = (list) => list.filter((p) => p.image).length;
  const cells = textured(m).reduce((n, f) => n + f.texture.div[0] * f.texture.div[1], 0);
  assert.equal(count(buildDrawList(cam(200, 0), placed, env)), 2 * cells);
  const behind = buildDrawList(cam(-200, Math.PI), placed, env);
  assert.equal(count(behind), 0, 'no art seen through the back');
  assert.ok(behind.length > 0, 'the cart\'s back is seen');
});

test('face budget and determinism', () => {
  const m = buildReturnCart({ art: ART });
  assert.ok(m.faces.length <= 200, `${m.faces.length} faces`);
  for (const f of m.faces) for (const i of f.indices) assert.ok(i >= 0 && i < m.vertices.length);
  assert.deepEqual(buildReturnCart({ art: ART }), buildReturnCart({ art: ART }));
});

function recorder() {
  const calls = [];
  const grad = { addColorStop() {} };
  const ctx = new Proxy({}, {
    get: (_, k) => (k === 'measureText' ? () => ({ width: 5 }) : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => grad : (...a) => calls.push([k, a])),
    set: (_, k, v) => { calls.push(['set:' + k, [v]]); return true; },
  });
  return { ctx, calls };
}
const rect = (a) => ({ x0: a[0], y0: a[1], x1: a[0] + a[2], y1: a[1] + a[3] });

test('paintReturnCartArt lays an opaque wood backing first, from a station with only an id', () => {
  const { ctx, calls } = recorder();
  paintReturnCartArt(ctx, { id: 'x' });
  assert.deepEqual(calls[0], ['set:fillStyle', [C.wood]]);
  assert.deepEqual(calls[1], ['fillRect', [0, 0, 336, 336]]);
  assert.deepEqual(calls[2], ['save', []]);
  assert.deepEqual([ART.width, ART.height], [336, 336]);
  // drawReturnCart ran at the 84 x 84 art box: its tag is there.
  assert.ok(calls.some(([k, a]) => k === 'roundRect' && sameRect(rect(a), L.tag)));
});

test('paintReturnCartArt repaints each textured part clean: after the cart, a clip per part and only that part again', () => {
  const { ctx, calls } = recorder();
  paintReturnCartArt(ctx, { id: 'x' });
  // drawReturnCart ends with the wheels and hubs (arcs).
  const lastArc = calls.map(([k]) => k).lastIndexOf('arc');
  assert.ok(lastArc > 0, 'the cart was drawn');
  const after = calls.slice(lastArc + 1);
  assert.ok(!after.some(([k]) => k === 'arc'), 'no wheel after the cart');
  const groups = [];
  let rects = [];
  for (const [k, a] of after) {
    if (k === 'rect') rects.push(rect(a));
    else if (k === 'clip') { groups.push({ clip: rects, blocks: [], fills: [], texts: [] }); rects = []; } else if (groups.length) {
      if (k === 'roundRect') groups.at(-1).blocks.push(rect(a));
      if (k === 'fillRect') groups.at(-1).fills.push(rect(a));
      if (k === 'fillText') groups.at(-1).texts.push(a[0]);
      if (k === 'moveTo' || k === 'lineTo') groups.at(-1).blocks.push('line');
    }
  }
  const want = [[L.trays[0], []], [L.trays[1], []], [L.tag, ['RETURNS']]];
  assert.equal(groups.length, want.length);
  want.forEach(([r, texts], i) => {
    assert.equal(groups[i].clip.length, 1);
    assert.ok(sameRect(groups[i].clip[0], r), `clip ${i}`);
    assert.ok(sameRect(groups[i].fills[0], r), `fill ${i}: the rounded corners take the part's own colour`);
    assert.deepEqual(groups[i].blocks.map((b) => (b === 'line' ? b : sameRect(b, r))), [true], `group ${i} draws only its part`);
    assert.deepEqual(groups[i].texts, texts);
  });
  assert.equal(calls.filter(([k]) => k === 'save').length, calls.filter(([k]) => k === 'restore').length);
});

// The cart as the scene places it with five books on its top tray (scene.js
// merges them into the cart's mesh, so the `under` rule orders them).
async function cartWithBooks() {
  const { buildFirstPersonScene } = await import('../scene.js');
  const cart = { id: 'cart', kind: 'return-cart', x: 0, y: 0, floor: 1 };
  const books = ['Orbit Drift', 'Coin Hunt', 'The Silent Clue', 'Sakura', 'Night Bus'].map((title, i) => ({
    id: `b${i}`, title, color: C.books[i], isCoinHunt: i === 1,
  }));
  const { placed } = buildFirstPersonScene({
    player: { x: 0, y: 200, facing: 0 }, floor: 1, stations: [cart], characters: [], cartBooks: books,
    artFor: () => ART, bookArtFor: () => ({ width: 160, height: 208 }),
    cameraParams: { pitch: 0, roll: 0, fov: Math.PI / 3, bobOffset: 0, jumpOffset: 0 }, viewport: { width: 960, height: 600 },
  });
  return placed[1].mesh;
}

// The full sweep runs with the books on the cart (below); the bare cart, a
// subset of that mesh, gets the subsample.
test('from every yaw, pitch and range, nothing standing on either tray is painted over by it', async () => {
  const { standingOrderPairs, topAndStanding, PIXEL_SWEEP } = await import('./standing-order.test-helper.js');
  const m = buildReturnCart({ art: ART });
  // On the top tray: the four posts' upper segments, the handle, the tag and its two arms.
  assert.equal(topAndStanding(m, TOP_TRAY).standing.length, 10);
  for (const y of [TOP_TRAY, LOWER_TRAY]) {
    const r = standingOrderPairs(m, y, PIXEL_SWEEP);
    assert.equal(r.total, 0, `${y}: ${JSON.stringify(r)}`);
  }
});

test('the real books on the top tray: the tray is never painted over them, from every yaw, pitch and range', async () => {
  const { standingOrderPairs, topAndStanding } = await import('./standing-order.test-helper.js');
  const { buildBook } = await import('./book.js');
  const m = await cartWithBooks();
  // The cart's ten, the five books and the Coin Hunt star's quads beside its cover.
  const starQuads = buildBook({ color: '#000', isCoinHunt: true }).faces.length - buildBook({ color: '#000' }).faces.length;
  assert.ok(starQuads > 0);
  assert.equal(topAndStanding(m, TOP_TRAY).standing.length, 10 + 5 + starQuads);
  for (const y of [TOP_TRAY, LOWER_TRAY]) {
    const { total, counts, pairs } = standingOrderPairs(m, y);
    assert.equal(total, 0, `${y}: ${JSON.stringify({ counts, pairs })}`);
  }
});

// The audits run at the lower tray's plane: everything either tray's rule
// moves stands on or above it (the upper tray itself, its books, the tag),
// so what must keep plain mean-depth order is the lower tray, the wheels and
// a character. (At the upper plane the lower tray's rule, which moves the
// lower books after its top, shows as the residual the report measures.)
test('the tops keep their mean-depth place: with a character at each of six positions, everything but what stands on the trays is drawn in plain order', async () => {
  const { orderAudit, PIXEL_SWEEP } = await import('./standing-order.test-helper.js');
  const { buildCharacter } = await import('./character.js');
  const { checked, mismatches } = orderAudit(await cartWithBooks(), LOWER_TRAY, { width: 1.6, depth: 1.0 }, buildCharacter(null), PIXEL_SWEEP);
  assert.ok(checked > 300, `${checked} cameras`);
  assert.deepEqual(mismatches, []);
});

test('exact pixels: the rule never worsens the lower tray against its own faces or a character, and its price stays bounded', async () => {
  const { pixelAudit } = await import('./standing-order.test-helper.js');
  const { buildCharacter } = await import('./character.js');
  // A subsample of PIXEL_SWEEP (the full one adds ~0.5 s): its looking-down and looking-up pitches, near and mid range.
  const sweep = { yaws: [0, 45, 90, 135, 180, 225, 270, 315], pitches: [-0.35, 0.35], radii: [1.5, 2.5] };
  const audit = pixelAudit(await cartWithBooks(), LOWER_TRAY, { width: 1.6, depth: 1.0 }, buildCharacter(null), { sweep });
  for (const [pos, r] of Object.entries(audit)) {
    assert.deepEqual(r.worse, [], pos);
    // Nothing on the cart is painted over a character in front of it. Measured on this sample: 0 at every position.
    assert.ok(r.price <= 0, `${pos}: ${r.price} px (worst ${JSON.stringify(r.worst)})`);
    // And the tray no longer paints over what stands on it (plain order: 254-292 samples per position).
    assert.equal(r.hinted.topOverStand, 0, pos);
  }
});

// Collision (library/collision.js) needs the cart's floor footprint, and it
// must track the mesh rather than being retyped beside it: `standing` drops
// floor-level geometry (a rug, a decal) the way the collision footprints do.
test('RETURN_CART_SIZE matches the mesh it is built from', () => {
  const mesh = buildReturnCart();
  const standing = mesh.vertices.filter((v) => v[1] > 0.1);
  const hw = Math.max(...standing.map((v) => Math.abs(v[0])));
  const hd = Math.max(...standing.map((v) => Math.abs(v[2])));
  near(RETURN_CART_SIZE.width / 2, hw, 0.01);
  near(RETURN_CART_SIZE.depth / 2, hd, 0.01);
});
