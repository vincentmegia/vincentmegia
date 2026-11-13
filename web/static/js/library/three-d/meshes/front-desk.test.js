import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFrontDesk, paintFrontDeskArt, FRONT_DESK_ART, FRONT_DESK_ART_SCALE, FRONT_DESK_K, FRONT_DESK_SIZE,
} from './front-desk.js';
import { frontDeskLayout, FRONT_DESK_COLORS } from '../../anime-furniture.js';

// A stand-in for the canvas the game paints drawFrontDesk into.
const ART = { width: FRONT_DESK_ART.w * FRONT_DESK_ART_SCALE, height: FRONT_DESK_ART.h * FRONT_DESK_ART_SCALE };
const L = frontDeskLayout(FRONT_DESK_ART);
const K = FRONT_DESK_K;
const bbox = (m) => [0, 1, 2].map((k) => {
  const a = m.vertices.map((v) => v[k]);
  return [Math.min(...a), Math.max(...a)];
});
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);
const textured = (m) => m.faces.filter((f) => f.texture);
// A textured face's uv box, back in the art's centered px.
const uvBox = (f) => {
  const us = f.texture.uv.map(([u]) => u / FRONT_DESK_ART_SCALE - FRONT_DESK_ART.w / 2);
  const vs = f.texture.uv.map(([, v]) => v / FRONT_DESK_ART_SCALE - FRONT_DESK_ART.h / 2);
  return { x0: Math.min(...us), y0: Math.min(...vs), x1: Math.max(...us), y1: Math.max(...vs) };
};
const sameRect = (a, b) => ['x0', 'y0', 'x1', 'y1'].every((k) => Math.abs(a[k] - b[k]) < 1e-9);
const frontZ = (m, f) => m.vertices[f.indices[0]][2];

test('real-world size: the slab 2.8 x 1.0 on the floor, the monitor its highest point', () => {
  near(K * (L.top.x1 - L.top.x0), FRONT_DESK_SIZE.width);
  near(FRONT_DESK_SIZE.counterTop, (L.floor - L.top.y0) * K);
  for (const m of [buildFrontDesk(), buildFrontDesk({ art: ART })]) {
    const [bx, by, bz] = bbox(m);
    near(bx[0], -FRONT_DESK_SIZE.width / 2);
    near(bx[1], FRONT_DESK_SIZE.width / 2);
    near(by[0], 0);
    near(bz[0], -FRONT_DESK_SIZE.depth / 2);
    near(bz[1], FRONT_DESK_SIZE.depth / 2);
    // The monitor's top (38 + 36 art px up) is the highest point; the leaf
    // blobs (their tops at the 2D circles' tops) stay below it.
    near(by[1], (L.floor - L.monitor.y0) * K);
    const leafTop = Math.max(...L.leaves.map((l) => (L.floor - (l.y - l.r)) * K));
    assert.ok(leafTop < by[1]);
  }
});

test('with art, the body, slab and monitor fronts are textured, unlit, on +Z planes, uv on the image', () => {
  const m = buildFrontDesk({ art: ART });
  const t = textured(m);
  assert.equal(t.length, 3);
  for (const f of t) {
    assert.equal(f.texture.image, ART);
    assert.equal(f.unlit, true, 'the 2D art carries its own top-lit shading');
    assert.equal(f.indices.length, 4);
    const z = f.indices.map((i) => m.vertices[i][2]);
    assert.ok(z.every((v) => Math.abs(v - z[0]) < 1e-12), 'one plane');
    assert.ok(z[0] > 0, 'faces +Z, toward the patrons and the player');
    for (const [u, v] of f.texture.uv) {
      assert.ok(u >= 0 && u <= ART.width && v >= 0 && v <= ART.height, `uv ${u},${v} off the image`);
    }
  }
  const boxes = t.map(uvBox);
  for (const r of [L.body, L.top, L.monitor]) assert.ok(boxes.some((b) => sameRect(b, r)), JSON.stringify(r));
});

test('planes: body front at 0.4, slab front at 0.5, monitor front ahead of its back; no ties with a textured front', () => {
  const m = buildFrontDesk({ art: ART });
  const t = textured(m);
  const at = (r) => t.find((f) => sameRect(uvBox(f), r));
  near(frontZ(m, at(L.body)), 0.4);
  near(frontZ(m, at(L.top)), 0.5);
  const monitorZ = frontZ(m, at(L.monitor));
  const monitorBack = m.faces.find((f) => !f.texture && f.color === FRONT_DESK_COLORS.monitor
    && f.indices.every((i) => Math.abs(m.vertices[i][2] - m.vertices[f.indices[0]][2]) < 1e-12));
  assert.ok(monitorBack, 'the monitor has a back');
  assert.ok(monitorZ > frontZ(m, monitorBack));
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

test('without art the same faces are drawn in the desk\'s flat colours', () => {
  const flat = buildFrontDesk();
  const tex = buildFrontDesk({ art: ART });
  assert.ok(!flat.faces.some((f) => f.texture));
  assert.equal(flat.faces.length, tex.faces.length);
  assert.deepEqual(flat.vertices, tex.vertices);
  const idx = tex.faces.map((f, i) => (f.texture ? i : -1)).filter((i) => i >= 0);
  const byRect = Object.fromEntries(idx.map((i) => [JSON.stringify(uvBox(tex.faces[i])), flat.faces[i].color]));
  const colorOf = (r) => Object.entries(byRect).find(([k]) => sameRect(JSON.parse(k), r))[1];
  assert.equal(colorOf(L.body), FRONT_DESK_COLORS.counter);
  assert.equal(colorOf(L.top), FRONT_DESK_COLORS.top);
  assert.equal(colorOf(L.monitor), FRONT_DESK_COLORS.monitor);
});

test('every face colour comes from FRONT_DESK_COLORS', () => {
  const palette = new Set(Object.values(FRONT_DESK_COLORS).flat());
  for (const m of [buildFrontDesk(), buildFrontDesk({ art: ART })]) {
    for (const f of m.faces) assert.ok(palette.has(f.color), f.color);
  }
});

test('every face culls, and its winding faces out: fronts show from in front, never from behind', async () => {
  const { buildDrawList, cameraFromPose } = await import('../core.js');
  const m = buildFrontDesk({ art: ART });
  assert.ok(m.faces.every((f) => f.cull === true));
  const env = { viewport: { width: 400, height: 400 }, light: { dir: [0.35, 1, 0.25], ambient: 0.5 } };
  const placed = [{ mesh: m, placement: { pos: [0, 0, 0], yaw: 0, scale: 40 } }];
  const cam = (z, facing) => cameraFromPose({ x: 0, y: z, facing }, { eyeHeight: 60, fov: Math.PI / 3, aspect: 1, near: 1, far: 2000 });
  const count = (list) => list.filter((p) => p.image).length;
  // Head-on, every textured face is turned toward the camera: 2 triangles per cell.
  const cells = textured(m).reduce((n, f) => n + (f.texture.div ? f.texture.div[0] * f.texture.div[1] : 1), 0);
  assert.equal(count(buildDrawList(cam(160, 0), placed, env)), 2 * cells);
  const behind = buildDrawList(cam(-160, Math.PI), placed, env);
  assert.equal(count(behind), 0, 'no art seen through the back');
  assert.ok(behind.length > 0, 'the desk\'s back is seen');
});

test('face budget and determinism', () => {
  const m = buildFrontDesk({ art: ART });
  // 140 before the slab top was cut at what stands on it (18 cells for 1).
  assert.ok(m.faces.length <= 142, `${m.faces.length} faces`);
  for (const f of m.faces) for (const i of f.indices) assert.ok(i >= 0 && i < m.vertices.length);
  assert.deepEqual(buildFrontDesk({ art: ART }), buildFrontDesk({ art: ART }));
});

test('paintFrontDeskArt lays an opaque counter-coloured backing first, from a station with only an id', () => {
  const calls = [];
  const grad = { addColorStop() {} };
  const ctx = new Proxy({}, {
    get: (_, k) => (k === 'measureText' ? () => ({ width: 5 }) : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => grad : (...a) => calls.push([k, a])),
    set: (_, k, v) => { calls.push(['set:' + k, [v]]); return true; },
  });
  paintFrontDeskArt(ctx, { id: 'x' });
  assert.deepEqual(calls[0], ['set:fillStyle', [FRONT_DESK_COLORS.counter]]);
  assert.deepEqual(calls[1], ['fillRect', [0, 0, ART.width, ART.height]]);
  assert.equal(ART.width, 496);
  assert.equal(ART.height, 336);
  // drawFrontDesk ran at the 124 x 84 art box: its body block is there.
  assert.ok(calls.some(([k, a]) => k === 'roundRect' && sameRect({ x0: a[0], y0: a[1], x1: a[0] + a[2], y1: a[1] + a[3] }, L.body)));
});

test('paintFrontDeskArt repaints the slab clean: after the desk, a clip to L.top and the slab block again', () => {
  const calls = [];
  const grad = { addColorStop() {} };
  const ctx = new Proxy({}, {
    get: (_, k) => (k === 'measureText' ? () => ({ width: 5 }) : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => grad : (...a) => calls.push([k, a])),
    set: (_, k, v) => { calls.push(['set:' + k, [v]]); return true; },
  });
  paintFrontDeskArt(ctx, { id: 'x' });
  const rect = (a) => ({ x0: a[0], y0: a[1], x1: a[0] + a[2], y1: a[1] + a[3] });
  // drawFrontDesk's last call is the sparkle's fill; everything over the slab
  // edge (pot, stand, books, bell base) comes before it.
  const pot = calls.findIndex(([k, a]) => k === 'roundRect' && sameRect(rect(a), L.pot));
  assert.ok(pot > 0, 'the desk was drawn');
  const clip = calls.findIndex(([k], i) => i > pot && k === 'clip');
  assert.ok(clip > pot, 'a clip after the desk');
  const clipRect = calls.slice(pot + 1, clip).filter(([k]) => k === 'rect').map(([, a]) => rect(a)).pop();
  assert.ok(clipRect && sameRect(clipRect, L.top), `clip rect ${JSON.stringify(clipRect)}`);
  const slab = calls.findIndex(([k, a], i) => i > clip && k === 'roundRect' && sameRect(rect(a), L.top));
  assert.ok(slab > clip, 'the slab block is drawn inside the clip');
  // Nothing but the counter is drawn after the clip: no pot, books, bell.
  for (const r of [L.pot, L.bellBase, L.stand, ...L.books]) {
    assert.ok(!calls.slice(clip).some(([k, a]) => k === 'roundRect' && sameRect(rect(a), r)), JSON.stringify(r));
  }
  assert.equal(calls.filter(([k]) => k === 'save').length, calls.filter(([k]) => k === 'restore').length);
});

test('from every side, what stands on the slab is drawn after the slab beneath it (the painter sorts by mean depth)', async () => {
  const { standingOrderFailures, topAndStanding } = await import('./standing-order.test-helper.js');
  const topY = FRONT_DESK_SIZE.counterTop;
  const m = buildFrontDesk({ art: ART });
  // Monitor, stand, 3 books, bell plate, dome, button, pot, 3 leaf blobs.
  assert.equal(topAndStanding(m, topY).standing.length, 12);
  assert.deepEqual(standingOrderFailures(m, topY), []);
});
