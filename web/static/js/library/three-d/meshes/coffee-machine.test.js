import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCoffeeMachine, paintCoffeeMachineArt, COFFEE_MACHINE_SIZE, COFFEE_MACHINE_STAND, COFFEE_MACHINE_ART, ART_SCALE,
} from './coffee-machine.js';
import { coffeeMachineLayout, COFFEE_MACHINE_COLORS, OUT_OF_ORDER_TAPE_COLORS, BOOKCASE_COLORS } from '../../anime-furniture.js';

// A stand-in for the canvas the game paints drawCoffeeMachine into.
const ART = { width: COFFEE_MACHINE_ART.w * ART_SCALE, height: COFFEE_MACHINE_ART.h * ART_SCALE };
const L = coffeeMachineLayout(COFFEE_MACHINE_ART);
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);
const bbox = (m, faces = m.faces) => [0, 1, 2].map((k) => {
  const a = faces.flatMap((f) => f.indices.map((i) => m.vertices[i][k]));
  return [Math.min(...a), Math.max(...a)];
});
const textured = (m) => m.faces.filter((f) => f.texture);
const frontZ = (m, f) => m.vertices[f.indices[0]][2];
// A textured face's uv corners, back in the art's centered px.
const uvArt = (f) => f.texture.uv.map(([u, v]) => [u / ART_SCALE - COFFEE_MACHINE_ART.w / 2, v / ART_SCALE - COFFEE_MACHINE_ART.h / 2]);
const uvBox = (f) => {
  const p = uvArt(f);
  return { x0: Math.min(...p.map((q) => q[0])), y0: Math.min(...p.map((q) => q[1])), x1: Math.max(...p.map((q) => q[0])), y1: Math.max(...p.map((q) => q[1])) };
};
const same = (a, b) => ['x0', 'y0', 'x1', 'y1'].every((k) => Math.abs(a[k] - b[k]) < 1e-9);
const faceWith = (m, r) => textured(m).find((f) => same(uvBox(f), r));

// Every textured front and the layout region it must show.
const REGIONS = {
  head: { x0: L.body.x0, y0: L.body.y0, x1: L.body.x1, y1: L.bay.y0 },
  leftJamb: { x0: L.body.x0, y0: L.bay.y0, x1: L.bay.x0, y1: L.body.y1 },
  rightJamb: { x0: L.bay.x1, y0: L.bay.y0, x1: L.body.x1, y1: L.body.y1 },
  bay: { x0: L.bay.x0, y0: L.bay.y0, x1: L.bay.x1, y1: L.tray.y0 },
  tray: L.tray,
  groupHead: L.groupHead,
  spout0: L.spouts[0],
  spout1: L.spouts[1],
  hopper: { x0: L.hopper.x0, y0: L.hopper.y0, x1: L.hopper.x1, y1: L.hopper.y1 },
};

test('real-world size: a 0.4 x 0.5 x 0.4 machine on a counter-height stand, base on the floor', () => {
  for (const m of [buildCoffeeMachine(), buildCoffeeMachine({ art: ART })]) {
    const [bx, by, bz] = bbox(m);
    near(by[0], 0);
    near(by[1], COFFEE_MACHINE_STAND.height + COFFEE_MACHINE_SIZE.height);
    assert.ok(COFFEE_MACHINE_STAND.height >= 0.85 && COFFEE_MACHINE_STAND.height <= 0.95, 'counter height');
    near(bx[0], -bx[1]);
    near(bz[0], -COFFEE_MACHINE_STAND.depth / 2);
    near(bz[1], COFFEE_MACHINE_STAND.depth / 2);
    // The machine itself (every face above the stand's top) is its real size.
    const top = COFFEE_MACHINE_STAND.height;
    const ys = (f) => f.indices.map((i) => m.vertices[i][1]);
    const machine = m.faces.filter((f) => ys(f).every((y) => y >= top - 1e-9) && ys(f).some((y) => y > top + 1e-9));
    const [mx, my, mz] = bbox(m, machine);
    near(mx[0], -COFFEE_MACHINE_SIZE.width / 2);
    near(mx[1], COFFEE_MACHINE_SIZE.width / 2);
    near(my[1] - my[0], COFFEE_MACHINE_SIZE.height);
    near(mz[0], -COFFEE_MACHINE_SIZE.depth / 2);
    assert.ok(mz[1] <= COFFEE_MACHINE_SIZE.depth / 2 + 0.04, 'only the drip tray stands proud');
  }
});

test('the art is drawn at the mesh\'s own aspect, so it maps without stretching', () => {
  near((L.body.x1 - L.body.x0) / (L.body.y1 - L.hopper.y0), COFFEE_MACHINE_SIZE.width / COFFEE_MACHINE_SIZE.height);
  assert.equal(COFFEE_MACHINE_ART.w, 84, 'the Top-Down width, so the machine keeps its 2D proportions across');
});

test('with art, every front is a textured, unlit +Z face whose uv stays on the image', () => {
  const m = buildCoffeeMachine({ art: ART });
  const t = textured(m);
  assert.equal(t.length, Object.keys(REGIONS).length);
  for (const f of t) {
    assert.equal(f.texture.image, ART);
    assert.equal(f.unlit, true, 'the 2D art carries its own shading');
    assert.equal(f.indices.length, 4);
    for (const [u, v] of f.texture.uv) assert.ok(u >= 0 && u <= ART.width && v >= 0 && v <= ART.height, `uv ${u},${v} off the image`);
    const z = f.indices.map((i) => m.vertices[i][2]);
    assert.ok(z.every((v) => Math.abs(v - z[0]) < 1e-12), 'flat in z, facing the front');
  }
});

test('each front maps exactly its own region of coffeeMachineLayout', () => {
  const m = buildCoffeeMachine({ art: ART });
  for (const [name, r] of Object.entries(REGIONS)) assert.ok(faceWith(m, r), name);
  // The cup, the drip and the steam ride in the bay's own texture.
  for (const r of [L.cup, L.drip]) assert.ok(r.x0 >= REGIONS.bay.x0 && r.x1 <= REGIONS.bay.x1 && r.y0 >= REGIONS.bay.y0 && r.y1 <= REGIONS.bay.y1);
});

test('the hopper is a trapezoid whose corners map onto the drawn trapezoid', () => {
  const m = buildCoffeeMachine({ art: ART });
  const f = faceWith(m, REGIONS.hopper);
  const hp = L.hopper;
  // Model corners (y up) and art corners (y down), in the same order.
  assert.deepEqual(uvArt(f).map((p) => p.map((v) => Math.round(v * 1e9) / 1e9)), [[hp.bx0, hp.y1], [hp.bx1, hp.y1], [hp.x1, hp.y0], [hp.x0, hp.y0]]);
  const xs = f.indices.map((i) => m.vertices[i][0]);
  near((xs[1] - xs[0]) / (xs[2] - xs[3]), (hp.bx1 - hp.bx0) / (hp.x1 - hp.x0));
});

test('the bay is recessed; the group head and spouts hang inside it; the drip tray stands proud', () => {
  const m = buildCoffeeMachine({ art: ART });
  const z = (r) => frontZ(m, faceWith(m, r));
  const front = z(REGIONS.head);
  near(z(REGIONS.leftJamb), front);
  near(z(REGIONS.rightJamb), front);
  assert.ok(z(REGIONS.bay) < front - 0.05, 'the bay is recessed');
  for (const r of [REGIONS.groupHead, REGIONS.spout0, REGIONS.spout1]) {
    assert.ok(z(r) > z(REGIONS.bay) && z(r) < front, 'inside the bay, standing off its back');
  }
  assert.ok(z(REGIONS.spout0) < z(REGIONS.groupHead), 'spouts sit under the group head');
  assert.ok(z(REGIONS.tray) > front, 'the drip tray stands proud');
  assert.ok(z(REGIONS.hopper) < front, 'the hopper sits back on the top');
});

test('no untextured face is coplanar with a textured front (no painter-sort ties)', () => {
  const m = buildCoffeeMachine({ art: ART });
  const plane = (f) => {
    const p = f.indices.map((i) => m.vertices[i]);
    return p.every((v) => Math.abs(v[2] - p[0][2]) < 1e-12) ? p[0][2] : null;
  };
  const texZ = new Set(textured(m).map(plane).map((v) => v.toFixed(6)));
  for (const f of m.faces.filter((x) => !x.texture)) {
    const zp = plane(f);
    if (zp !== null) assert.ok(!texZ.has(zp.toFixed(6)), `untextured face at z=${zp} ties with a textured front`);
  }
});

test('no coplanar same-facing overlapping faces (painter flicker guard)', () => {
  const m = buildCoffeeMachine({ art: ART });
  const info = m.faces.map((f) => {
    const [a, b, c] = f.indices.map((i) => m.vertices[i]);
    const u = b.map((v, i) => v - a[i]);
    const w = c.map((v, i) => v - b[i]);
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const len = Math.hypot(...n);
    const nn = n.map((x) => x / len);
    const d = nn[0] * a[0] + nn[1] * a[1] + nn[2] * a[2];
    const vs = f.indices.map((i) => m.vertices[i]);
    const lo = [0, 1, 2].map((k) => Math.min(...vs.map((v) => v[k])));
    const hi = [0, 1, 2].map((k) => Math.max(...vs.map((v) => v[k])));
    return { nn, d, lo, hi };
  });
  const eps = 1e-6;
  for (let i = 0; i < info.length; i++) for (let j = i + 1; j < info.length; j++) {
    const p = info[i], q = info[j];
    const dot = p.nn[0] * q.nn[0] + p.nn[1] * q.nn[1] + p.nn[2] * q.nn[2];
    if (dot < 1 - eps || Math.abs(p.d - q.d) > eps) continue;
    const overlaps = [0, 1, 2].every((k) => {
      const flat = p.hi[k] - p.lo[k] < eps;
      return flat || Math.min(p.hi[k], q.hi[k]) - Math.max(p.lo[k], q.lo[k]) > eps;
    });
    assert.ok(!overlaps, `faces ${i} and ${j} are coplanar and overlap`);
  }
});

test('without art the same geometry is drawn in the 2D drawer\'s flat colours', () => {
  const flat = buildCoffeeMachine();
  const tex = buildCoffeeMachine({ art: ART });
  assert.equal(flat.faces.length, tex.faces.length);
  assert.deepEqual(flat.vertices, tex.vertices);
  assert.ok(!flat.faces.some((f) => f.texture || f.unlit));
  const colors = new Set(flat.faces.map((f) => f.color));
  for (const c of [COFFEE_MACHINE_COLORS.body, COFFEE_MACHINE_COLORS.bay, COFFEE_MACHINE_COLORS.steel, COFFEE_MACHINE_COLORS.hopperSolid]) assert.ok(colors.has(c), c);
});

test('every colour, the stand\'s included, comes from the 2D modules\' exports', () => {
  const palette = new Set([...Object.values(COFFEE_MACHINE_COLORS).flat(), ...Object.values(BOOKCASE_COLORS)]);
  for (const m of [buildCoffeeMachine(), buildCoffeeMachine({ art: ART })]) {
    for (const f of m.faces) assert.ok(palette.has(f.color), f.color);
  }
});

test('face budget, valid indices and determinism', () => {
  const m = buildCoffeeMachine({ art: ART });
  assert.ok(m.faces.length <= 60, `${m.faces.length} faces`);
  for (const f of m.faces) for (const i of f.indices) assert.ok(i >= 0 && i < m.vertices.length);
  assert.deepEqual(buildCoffeeMachine({ art: ART }), buildCoffeeMachine({ art: ART }));
});

test('every face culls, and its winding faces out: fronts show from in front, never from behind', async () => {
  const { buildDrawList, cameraFromPose } = await import('../core.js');
  const m = buildCoffeeMachine({ art: ART });
  assert.ok(m.faces.every((f) => f.cull === true));
  const env = { viewport: { width: 400, height: 400 }, light: { dir: [0.35, 1, 0.25], ambient: 0.5 } };
  const placed = [{ mesh: m, placement: { pos: [0, 0, 0], yaw: 0, scale: 40 } }];
  const cam = (x, z, facing) => cameraFromPose({ x, y: z, facing }, { eyeHeight: 60, fov: Math.PI / 3, aspect: 1, near: 1, far: 2000 });
  const images = (list) => list.filter((p) => p.image).length;
  // Head-on from interact range, every textured face is turned toward the camera.
  const cells = textured(m).reduce((n, f) => n + (f.texture.div?.[0] ?? 1) * (f.texture.div?.[1] ?? 1), 0);
  assert.equal(images(buildDrawList(cam(0, 60, 0), placed, env)), 2 * cells);
  // Behind it, no art shows through, but the machine and stand backs do.
  const behind = buildDrawList(cam(0, -120, Math.PI), placed, env);
  assert.equal(images(behind), 0, 'no art seen through the back');
  assert.ok(behind.length > 0);
  // From the right at ~35 degrees (forward = (sin f, -cos f)) the art still shows.
  const side = buildDrawList(cam(70, 100, Math.atan2(-70, 100)), placed, env);
  assert.ok(images(side) > 0);
});

test('paintCoffeeMachineArt lays an opaque backing first, then drawCoffeeMachine at the art box', () => {
  const run = (opts) => {
    const calls = [];
    const ctx = new Proxy({}, {
      get: (_, k) => (k === 'measureText' ? () => ({ width: 5 }) : (...a) => calls.push([k, a])),
      set: (_, k, v) => { calls.push(['set:' + k, [v]]); return true; },
    });
    paintCoffeeMachineArt(ctx, { id: 'coffee-machine' }, opts);
    return calls;
  };
  const calls = run({});
  const firstFill = calls.findIndex(([k]) => k === 'fillRect' || k === 'fill');
  assert.equal(calls[firstFill][0], 'fillRect');
  assert.deepEqual(calls[firstFill][1], [0, 0, ART.width, ART.height]);
  assert.ok(calls.slice(0, firstFill).some(([k, a]) => k === 'set:fillStyle' && a[0] === COFFEE_MACHINE_COLORS.body));
  // The drawer ran at the art box: its bay is the art box's bay.
  const bay = calls.find(([k, a]) => k === 'roundRect' && Math.abs(a[1] - L.bay.y0) < 1e-9 && Math.abs(a[3] - (L.bay.y1 - L.bay.y0)) < 1e-9);
  assert.ok(bay, 'bay drawn from coffeeMachineLayout(COFFEE_MACHINE_ART)');
  // Behind the clear hopper: the station's ground colour, as in Top-Down.
  assert.ok(calls.some(([k, a]) => k === 'set:fillStyle' && a[0] === COFFEE_MACHINE_COLORS.ground));
  // After the drawer, a thin band-coloured seam under the hopper, so the
  // head's top edge never shows the hopper's glass.
  const seam = calls.findIndex(([k, a]) => k === 'fillRect' && a[1] < L.body.y0 && a[1] + a[3] === L.body.y0 && a[2] === L.body.x1 - L.body.x0);
  assert.ok(seam > calls.findIndex(([k]) => k === 'moveTo'), 'seam painted after the hopper');
  assert.deepEqual(calls[seam - 1], ['set:fillStyle', [COFFEE_MACHINE_COLORS.band]]);
  // No tape unless the machine is out of order.
  assert.ok(!calls.some(([k, a]) => k === 'set:fillStyle' && a[0] === OUT_OF_ORDER_TAPE_COLORS.tape));
});

test('paintCoffeeMachineArt paints the OUT OF ORDER tape over the machine when out of order', () => {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (_, k) => (k === 'measureText' ? () => ({ width: 5 }) : (...a) => calls.push([k, a])),
    set: (_, k, v) => { calls.push(['set:' + k, [v]]); return true; },
  });
  paintCoffeeMachineArt(ctx, { id: 'coffee-machine' }, { outOfOrder: true });
  const tape = calls.findIndex(([k, a]) => k === 'set:fillStyle' && a[0] === OUT_OF_ORDER_TAPE_COLORS.tape);
  const steam = calls.findIndex(([k, a]) => k === 'set:strokeStyle' && a[0] === COFFEE_MACHINE_COLORS.steam);
  assert.ok(tape > steam, 'the tape goes on after the machine');
  assert.equal(calls.filter(([k, a]) => k === 'set:fillStyle' && a[0] === OUT_OF_ORDER_TAPE_COLORS.tape).length, 2);
});
