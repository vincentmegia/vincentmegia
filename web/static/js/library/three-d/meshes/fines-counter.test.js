import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFinesCounter, paintFinesCounterArt, FINES_COUNTER_ART, FINES_COUNTER_ART_SCALE, FINES_COUNTER_K, FINES_COUNTER_SIZE,
} from './fines-counter.js';
import { finesRoomLayout, FINES_ROOM_COLORS } from '../../anime-furniture.js';
import { stationTop } from '../labels.js';
import { UNIT_SCALE } from '../scene.js';

// A stand-in for the canvas the game paints drawFinesRoom into.
const ART = { width: FINES_COUNTER_ART.w * FINES_COUNTER_ART_SCALE, height: FINES_COUNTER_ART.h * FINES_COUNTER_ART_SCALE };
const L = finesRoomLayout(FINES_COUNTER_ART);
const K = FINES_COUNTER_K;
const C = FINES_ROOM_COLORS;
const bbox = (m) => [0, 1, 2].map((k) => {
  const a = m.vertices.map((v) => v[k]);
  return [Math.min(...a), Math.max(...a)];
});
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);
const textured = (m) => m.faces.filter((f) => f.texture);
// A textured face's uv box, back in the art's centered px.
const uvBox = (f) => {
  const us = f.texture.uv.map(([u]) => u / FINES_COUNTER_ART_SCALE - FINES_COUNTER_ART.w / 2);
  const vs = f.texture.uv.map(([, v]) => v / FINES_COUNTER_ART_SCALE - FINES_COUNTER_ART.h / 2);
  return { x0: Math.min(...us), y0: Math.min(...vs), x1: Math.max(...us), y1: Math.max(...vs) };
};
const sameRect = (a, b) => ['x0', 'y0', 'x1', 'y1'].every((k) => Math.abs(a[k] - b[k]) < 1e-9);
const frontZ = (m, f) => m.vertices[f.indices[0]][2];
const PARTS = [['body', 'counter'], ['top', 'top'], ['plaque', 'plaque'], ['register', 'register'], ['housing', 'housing']];

test('real-world size: the top 2.4 x 1.1 on the floor, the plaque its highest point', () => {
  near(K * (L.top.x1 - L.top.x0), FINES_COUNTER_SIZE.width);
  near(K, 2.4 / 114);
  for (const m of [buildFinesCounter(), buildFinesCounter({ art: ART })]) {
    const [bx, by, bz] = bbox(m);
    near(bx[0], -1.2);
    near(bx[1], 1.2);
    near(by[0], 0);
    near(bz[0], -FINES_COUNTER_SIZE.depth / 2);
    near(bz[1], FINES_COUNTER_SIZE.depth / 2);
    near(by[1], (L.floor - L.plaque.y0) * K);
  }
});

test('the plaque spans model y (55 + 40) K to (55 + 57) K', () => {
  const m = buildFinesCounter({ art: ART });
  const f = textured(m).find((x) => sameRect(uvBox(x), L.plaque));
  const ys = f.indices.map((i) => m.vertices[i][1]);
  near(Math.min(...ys), (55 + 40) * K);
  near(Math.max(...ys), (55 + 57) * K);
});

test('the label chip sits on the plaque: stationTop is the plaque\'s top', () => {
  near(stationTop('fines-counter'), (L.floor - L.plaque.y0) * K * UNIT_SCALE);
});

test('with art, the body, top, plaque, register and housing fronts are textured, unlit, on +Z planes, uv on the image', () => {
  const m = buildFinesCounter({ art: ART });
  const t = textured(m);
  assert.equal(t.length, 5);
  for (const f of t) {
    assert.equal(f.texture.image, ART);
    assert.equal(f.unlit, true, 'the 2D art carries its own top-lit shading');
    assert.equal(f.indices.length, 4);
    const z = f.indices.map((i) => m.vertices[i][2]);
    assert.ok(z.every((v) => Math.abs(v - z[0]) < 1e-12), 'one plane');
    const n = (() => {
      const [p, q, r] = f.indices.slice(0, 3).map((i) => m.vertices[i]);
      return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    })();
    assert.ok(n > 0, 'faces +Z, toward the patrons and the player');
    for (const [u, v] of f.texture.uv) {
      assert.ok(u >= 0 && u <= ART.width && v >= 0 && v <= ART.height, `uv ${u},${v} off the image`);
    }
  }
  const boxes = t.map(uvBox);
  for (const [part] of PARTS) assert.ok(boxes.some((b) => sameRect(b, L[part])), part);
  const div = (r) => t.find((f) => sameRect(uvBox(f), r)).texture.div;
  assert.deepEqual(div(L.register), [1, 1]);
  assert.deepEqual(div(L.plaque), [2, 1]);
});

test('planes: body front 0.45, top front 0.55, register before the housing, the plaque at the back edge; no ties with a textured front', () => {
  const m = buildFinesCounter({ art: ART });
  const t = textured(m);
  const at = (r) => frontZ(m, t.find((f) => sameRect(uvBox(f), r)));
  near(at(L.body), 0.45);
  near(at(L.top), 0.55);
  near(at(L.register), 0.25);
  assert.ok(at(L.housing) < at(L.register), 'the housing is thinner than the register');
  near(at(L.plaque), -0.46);
  const plane = (f) => {
    const p = f.indices.map((i) => m.vertices[i]);
    return p.every((v) => Math.abs(v[2] - p[0][2]) < 1e-12) ? p[0][2] : null;
  };
  const texZ = new Set(t.map(plane).map((z) => z.toFixed(6)));
  for (const f of m.faces.filter((x) => !x.texture)) {
    const z = plane(f);
    if (z === null) continue;
    assert.ok(!texZ.has(z.toFixed(6)), `untextured face at z=${z} ties with a textured front`);
  }
});

test('exactly 6 coin discs, 4 and 2, alternating coin and coinDeep from the bottom, standing on the top', () => {
  const m = buildFinesCounter({ art: ART });
  const caps = m.faces.filter((f) => f.indices.length === 8 && (f.color === C.coin || f.color === C.coinDeep));
  assert.equal(caps.length, 6);
  const slabTop = (L.floor - L.top.y0) * K;
  const stacks = new Map();
  for (const f of caps) {
    const vs = f.indices.map((i) => m.vertices[i]);
    const x = vs.reduce((s, v) => s + v[0], 0) / vs.length;
    const key = x.toFixed(4);
    if (!stacks.has(key)) stacks.set(key, []);
    stacks.get(key).push({ y: vs[0][1], color: f.color });
  }
  const got = [...stacks.entries()].map(([x, cs]) => [Number(x), cs.sort((a, b) => a.y - b.y)]).sort((a, b) => a[0] - b[0]);
  assert.deepEqual(got.map(([x, cs]) => [Math.round(x / K), cs.length]), L.coins.map(({ x, n }) => [x, n]));
  for (const [, cs] of got) {
    cs.forEach((c, i) => {
      near(c.y, slabTop + (i + 1) * L.coinPitch * K);
      assert.equal(c.color, i % 2 ? C.coinDeep : C.coin);
    });
  }
});

test('without art the same faces are drawn in the counter\'s flat colours', () => {
  const flat = buildFinesCounter();
  const tex = buildFinesCounter({ art: ART });
  assert.ok(!flat.faces.some((f) => f.texture));
  assert.equal(flat.faces.length, tex.faces.length);
  assert.deepEqual(flat.vertices, tex.vertices);
  const idx = tex.faces.map((f, i) => (f.texture ? i : -1)).filter((i) => i >= 0);
  for (const [part, color] of PARTS) {
    const i = idx.find((j) => sameRect(uvBox(tex.faces[j]), L[part]));
    assert.equal(flat.faces[i].color, C[color], part);
  }
});

test('every face colour comes from FINES_ROOM_COLORS', () => {
  const palette = new Set(Object.values(C));
  for (const m of [buildFinesCounter(), buildFinesCounter({ art: ART })]) {
    for (const f of m.faces) assert.ok(palette.has(f.color), f.color);
  }
});

test('every face culls, and its winding faces out: fronts show from in front, never from behind', async () => {
  const { buildDrawList, cameraFromPose } = await import('../core.js');
  const m = buildFinesCounter({ art: ART });
  assert.ok(m.faces.every((f) => f.cull === true));
  const env = { viewport: { width: 400, height: 400 }, light: { dir: [0.35, 1, 0.25], ambient: 0.5 } };
  const placed = [{ mesh: m, placement: { pos: [0, 0, 0], yaw: 0, scale: 40 } }];
  const cam = (z, facing) => cameraFromPose({ x: 0, y: z, facing }, { eyeHeight: 60, fov: Math.PI / 3, aspect: 1, near: 1, far: 2000 });
  const count = (list) => list.filter((p) => p.image).length;
  const cells = textured(m).reduce((n, f) => n + (f.texture.div ? f.texture.div[0] * f.texture.div[1] : 1), 0);
  assert.equal(count(buildDrawList(cam(200, 0), placed, env)), 2 * cells);
  const behind = buildDrawList(cam(-200, Math.PI), placed, env);
  assert.equal(count(behind), 0, 'no art seen through the back');
  assert.ok(behind.length > 0, 'the counter\'s back is seen');
});

test('face budget and determinism', () => {
  const m = buildFinesCounter({ art: ART });
  assert.ok(m.faces.length <= 140, `${m.faces.length} faces`);
  for (const f of m.faces) for (const i of f.indices) assert.ok(i >= 0 && i < m.vertices.length);
  assert.deepEqual(buildFinesCounter({ art: ART }), buildFinesCounter({ art: ART }));
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

test('paintFinesCounterArt lays an opaque counter-coloured backing first, from a station with only an id', () => {
  const { ctx, calls } = recorder();
  paintFinesCounterArt(ctx, { id: 'x' });
  assert.deepEqual(calls[0], ['set:fillStyle', [C.counter]]);
  assert.deepEqual(calls[1], ['fillRect', [0, 0, 520, 520]]);
  assert.deepEqual([ART.width, ART.height], [520, 520]);
  // drawFinesRoom ran at the 130 x 130 art box: its body block is there.
  assert.ok(calls.some(([k, a]) => k === 'roundRect' && sameRect(rect(a), L.body)));
});

test('paintFinesCounterArt repaints each textured part clean: after the room, a clip per part and only that part again', () => {
  const { ctx, calls } = recorder();
  paintFinesCounterArt(ctx, { id: 'x' });
  // drawFinesRoom ends with the coins (ellipses) and the sparkle.
  const lastCoin = calls.map(([k]) => k).lastIndexOf('ellipse');
  assert.ok(lastCoin > 0, 'the room was drawn');
  const after = calls.slice(lastCoin + 1);
  assert.ok(!after.some(([k]) => k === 'ellipse'), 'no coin after the room');
  // Split what follows into clip groups: the rects before each clip, the roundRects after it.
  const groups = [];
  let rects = [];
  for (const [k, a] of after) {
    if (k === 'rect') rects.push(rect(a));
    else if (k === 'clip') { groups.push({ clip: rects, blocks: [] }); rects = []; }
    else if (k === 'roundRect' && groups.length) groups.at(-1).blocks.push(rect(a));
  }
  const want = [
    [[L.plaque], [L.plaque]],
    [[L.body, L.top], [L.body, L.top]],
    [[L.housing], [L.housing, L.display]],
    [[L.register], [L.register]],
  ];
  assert.equal(groups.length, want.length);
  want.forEach(([clip, blocks], i) => {
    assert.equal(groups[i].clip.length, clip.length);
    clip.forEach((r, j) => assert.ok(sameRect(groups[i].clip[j], r), `clip ${i}: ${JSON.stringify(groups[i].clip[j])}`));
    assert.equal(groups[i].blocks.length, blocks.length);
    blocks.forEach((r, j) => assert.ok(sameRect(groups[i].blocks[j], r), `block ${i}: ${JSON.stringify(groups[i].blocks[j])}`));
  });
  assert.equal(calls.filter(([k]) => k === 'save').length, calls.filter(([k]) => k === 'restore').length);
});

test('from every side, what stands on the top is drawn after the top beneath it (the painter sorts by mean depth)', async () => {
  const { standingOrderFailures, topAndStanding } = await import('./standing-order.test-helper.js');
  const topY = (L.floor - L.top.y0) * K;
  const m = buildFinesCounter({ art: ART });
  // Coins (6), register, housing, two posts; the plaque hangs above the eye.
  assert.equal(topAndStanding(m, topY).standing.length, 10);
  assert.deepEqual(standingOrderFailures(m, topY), []);
});
