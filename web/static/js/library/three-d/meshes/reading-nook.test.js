import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReadingNook, READING_NOOK_SIZE, READING_NOOK_ROUND } from './reading-nook.js';
import { faceNormal } from './geom.js';
import { READING_NOOK_COLORS } from '../../anime-furniture.js';
import { stationTop } from '../labels.js';
import { UNIT_SCALE } from '../scene.js';

const C = READING_NOOK_COLORS;
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);
const pts = (m, f) => f.indices.map((i) => m.vertices[i]);
const ys = (m, f) => pts(m, f).map((v) => v[1]);
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
const RUG_TOP = 0.03;
// The chair's seat and its cushion (the parts their supporting tops belong to).
const seatTop = (m) => Math.max(...parts(m).filter((p) => p.color === C.chair && p.hi[1] < 1).map((p) => p.hi[1]));
const cushionTop = (m) => Math.max(...parts(m).filter((p) => p.color === C.cushion).map((p) => p.hi[1]));

test('READING_NOOK_SIZE: the rug\'s radii, the chair\'s and the lamp\'s tops', () => {
  assert.deepEqual(READING_NOOK_SIZE, { rugRx: 1.2, rugRz: 0.8, chairTop: 1.3, lampTop: 1.5 });
});

test('the rug is a 12-sided disc 0.03 high on the 1.2 x 0.8 ellipse, the mesh\'s widest part', () => {
  const m = buildReadingNook();
  const all = parts(m);
  const rug = all.filter((p) => p.color === C.rug);
  assert.equal(rug.length, 1);
  const top = [...new Set(rug[0].faces.flatMap((f) => f.indices))].map((i) => m.vertices[i]).filter((v) => v[1] === RUG_TOP);
  assert.equal(top.length, 12);
  for (const [x, , z] of top) near((x / READING_NOOK_SIZE.rugRx) ** 2 + (z / READING_NOOK_SIZE.rugRz) ** 2, 1);
  near(rug[0].lo[1], 0);
  near(rug[0].hi[1], RUG_TOP);
  // Its top, a 12-gon facing up, is a supporting surface.
  const cap = rug[0].faces.find((f) => f.indices.length === 12);
  assert.ok(cap.under && faceNormal(m, cap)[1] > 0.999);
  for (const p of all) {
    if (p === rug[0]) continue;
    for (const k of [0, 2]) assert.ok(Math.max(-p.lo[k], p.hi[k]) < Math.max(-rug[0].lo[k], rug[0].hi[k]), `${p.color} wider than the rug`);
  }
});

test('the lamp\'s shade is the highest point (1.5), the chair\'s back reaches 1.3', () => {
  const m = buildReadingNook();
  near(Math.max(...m.vertices.map((v) => v[1])), READING_NOOK_SIZE.lampTop);
  const chair = parts(m).filter((p) => p.color === C.chair);
  near(Math.max(...chair.map((p) => p.hi[1])), READING_NOOK_SIZE.chairTop);
});

test('the label chip keeps its height: stationTop is the shade\'s top', () => {
  near(stationTop('reading-nook'), READING_NOOK_SIZE.lampTop * UNIT_SCALE);
});

test('the chair faces +Z: its back stands on the -Z side of its seat, the arms beside the seat', () => {
  const m = buildReadingNook();
  const chair = parts(m).filter((p) => p.color === C.chair);
  const back = chair.filter((p) => p.hi[1] > 1);
  // The seat: the chair's low parts reaching the front (the back's lower half is behind it).
  const seat = chair.filter((p) => p.hi[1] < 1 && p.hi[2] > 0);
  assert.ok(back.length > 0 && seat.length > 0);
  const backZ1 = Math.max(...back.map((p) => p.hi[2]));
  assert.ok(backZ1 <= Math.min(...seat.map((p) => p.lo[2])) + 1e-9, 'the back is behind the seat');
  near(Math.min(...back.map((p) => p.lo[2])), -0.4);
  near(backZ1, -0.15);
  const arms = parts(m).filter((p) => p.color === C.arm);
  const seatX = [Math.min(...seat.map((p) => p.lo[0])), Math.max(...seat.map((p) => p.hi[0]))];
  assert.ok(arms.some((p) => p.hi[0] <= seatX[0] + 1e-9) && arms.some((p) => p.lo[0] >= seatX[1] - 1e-9), 'an arm each side');
  // Four wooden legs on the rug, under the chair.
  const legs = parts(m).filter((p) => p.color === C.leg);
  assert.equal(legs.length, 4);
  for (const l of legs) near(l.lo[1], RUG_TOP);
});

test('every chair block is chamfered: its flat top sits in from its front, reached by sloped faces, not steps', () => {
  const m = buildReadingNook();
  const { chamfer, inset } = READING_NOOK_ROUND;
  const blocks = parts(m).filter((p) => [C.chair, C.arm, C.cushion].includes(p.color) && p.faces.some((f) => f.under));
  // The back's upper part, both arms, the seat and the cushion.
  assert.equal(blocks.length, 5);
  for (const p of blocks) {
    const top = p.faces.filter((f) => f.under);
    assert.equal(top.length, 1, 'one flat top');
    for (const y of ys(m, top[0])) near(y, p.hi[1]);
    // The front edge is chamfered: the top ends `inset` short of the block's front.
    near(p.hi[2] - Math.max(...pts(m, top[0]).map((v) => v[2])), inset);
    const slopes = p.faces.filter((f) => { const ny = faceNormal(m, f)[1]; return ny > 0.3 && ny < 0.98; });
    assert.ok(slopes.length > 0, `${p.color}: sloped faces`);
    for (const f of slopes) {
      near(Math.max(...ys(m, f)), p.hi[1]);
      near(Math.min(...ys(m, f)), p.hi[1] - chamfer);
    }
    // No flat face but the top: no ledges.
    assert.ok(p.faces.every((f) => f.under || Math.abs(faceNormal(m, f)[1]) < 0.98), 'no ledge');
  }
  // In plan, the back's rear corners and the arms' outer front corners are cut (a vertical face at 45 degrees).
  const diagonal = (p) => p.faces.some((f) => { const n = faceNormal(m, f); return Math.abs(n[1]) < 1e-9 && Math.abs(Math.abs(n[0]) - Math.SQRT1_2) < 1e-9; });
  const back = blocks.find((p) => p.color === C.chair && p.hi[1] > 1);
  assert.ok(diagonal(back), 'the back');
  for (const arm of blocks.filter((p) => p.color === C.arm)) assert.ok(diagonal(arm), 'an arm');
  assert.ok(diagonal(blocks.find((p) => p.color === C.cushion)), 'the cushion');
});

test('the open book lies on the cushion: two pages facing up, above it, white', () => {
  const m = buildReadingNook();
  const top = cushionTop(m);
  const pages = m.faces.filter((f) => f.color === C.book);
  assert.equal(pages.length, 2);
  for (const f of pages) {
    assert.ok(Math.min(...ys(m, f)) >= top - 1e-9, 'on the cushion, not in it');
    assert.ok(faceNormal(m, f)[1] > 0.8, 'faces up');
    near(Math.acos(faceNormal(m, f)[1]), (12 * Math.PI) / 180, 1e-9);
  }
  // The pages meet at the spine, which lies on the cushion.
  const spine = pts(m, pages[0]).filter((p) => pts(m, pages[1]).some((q) => q.every((c, k) => Math.abs(c - p[k]) < 1e-9)));
  assert.equal(spine.length, 2);
  for (const v of spine) near(v[1], top);
});

test('the shade is an open, tapered 8-sided ring from 1.3 to 1.5, unlit, inside and out; nothing else is unlit', () => {
  const m = buildReadingNook();
  const shade = m.faces.filter((f) => f.color === C.shade);
  assert.equal(shade.length, 16);
  assert.ok(shade.every((f) => f.unlit === true && f.indices.length === 4));
  assert.ok(m.faces.filter((f) => f.color !== C.shade).every((f) => !f.unlit));
  for (const f of shade) assert.ok(new Set(ys(m, f)).size === 2, 'no cap');
  const vs = [...new Set(shade.flatMap((f) => f.indices))].map((i) => m.vertices[i]);
  const cx = vs.reduce((s, v) => s + v[0], 0) / vs.length;
  const cz = vs.reduce((s, v) => s + v[2], 0) / vs.length;
  near(cx, 0.79);
  const radius = (y) => vs.filter((v) => Math.abs(v[1] - y) < 1e-9).map((v) => Math.hypot(v[0] - cx, v[2] - cz));
  assert.equal(radius(1.3).length, 8);
  for (const r of radius(1.3)) near(r, 0.22);
  for (const r of radius(1.5)) near(r, 0.14);
  // Each band twice, wound both ways: an outside and an inside face.
  const key = (f) => [...f.indices].sort((a, b) => a - b).join();
  const byBand = new Map();
  for (const f of shade) byBand.set(key(f), [...(byBand.get(key(f)) ?? []), f]);
  assert.equal(byBand.size, 8);
  for (const [a, b] of byBand.values()) {
    const [na, nb] = [faceNormal(m, a), faceNormal(m, b)];
    near(na[0] + nb[0], 0);
    near(na[2] + nb[2], 0);
  }
  // The pole stands on the base and stops where the shade starts, in short
  // stacked lengths (each sorts at its own depth).
  const pole = parts(m).filter((p) => p.color === C.pole).sort((a, b) => a.lo[1] - b.lo[1]);
  assert.ok(pole.length > 1);
  near(pole.at(-1).hi[1], 1.3);
  pole.slice(1).forEach((p, i) => near(p.lo[1], pole[i].hi[1]));
  for (const p of pole) near((p.lo[0] + p.hi[0]) / 2, 0.79);
  const base = parts(m).filter((p) => p.color === C.base);
  assert.equal(base.length, 1);
  near(pole[0].lo[1], base[0].hi[1]);
  near(base[0].lo[1], RUG_TOP);
});

test('no two solids interpenetrate: their boxes meet in at most a plane', () => {
  const ps = parts(buildReadingNook());
  for (let i = 0; i < ps.length; i++) {
    for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i];
      const b = ps[j];
      const overlap = [0, 1, 2].every((k) => Math.min(a.hi[k], b.hi[k]) - Math.max(a.lo[k], b.lo[k]) > 1e-9);
      assert.ok(!overlap, `${a.color} ${JSON.stringify([a.lo, a.hi])} and ${b.color} ${JSON.stringify([b.lo, b.hi])}`);
    }
  }
});

test('every face colour comes from READING_NOOK_COLORS, every face culls', () => {
  const palette = new Set(Object.values(C));
  const m = buildReadingNook();
  for (const f of m.faces) {
    assert.ok(palette.has(f.color), f.color);
    assert.equal(f.cull, true);
  }
});

test('the supporting tops: the rug, the seat and the cushion', () => {
  const m = buildReadingNook();
  const planes = [...new Set(m.faces.filter((f) => f.under).map((f) => ys(m, f)[0]))].sort();
  for (const y of [RUG_TOP, seatTop(m), cushionTop(m)]) assert.ok(planes.some((p) => Math.abs(p - y) < 1e-9), `${y} in ${planes}`);
  for (const f of m.faces.filter((x) => x.under)) assert.ok(new Set(ys(m, f)).size === 1 && faceNormal(m, f)[1] > 0.999);
});

// The nook is seen from every side. A subsample of the full sweep (all 24
// yaws, all six pitches and four ranges were measured by hand: 0 pairs).
test('from every side, pitch and range, no supporting top is painted over what stands on it', async () => {
  const { standingOrderPairs } = await import('./standing-order.test-helper.js');
  const m = buildReadingNook();
  const sweep = { yaws: [0, 45, 90, 135, 180, 225, 270, 315], pitches: [-0.35, 0, 0.35, 'look'], radii: [1.5, 2.5] };
  for (const y of [...new Set(m.faces.filter((f) => f.under).map((f) => ys(m, f)[0]))]) {
    const r = standingOrderPairs(m, y, sweep);
    assert.equal(r.total, 0, `${y}: ${JSON.stringify(r)}`);
  }
});

// The rug keeps its mean-depth place against a character round it (the full
// sweep, measured by hand: 3954 cameras, 0 mismatches, and 0 wrong pixels).
test('the rug keeps its place: with a character round the nook, all but what stands on it is drawn in plain order', async () => {
  const { orderAudit } = await import('./standing-order.test-helper.js');
  const { buildCharacter } = await import('./character.js');
  const sweep = { yaws: [0, 90, 180, 270], pitches: [-0.35, 0.35], radii: [1.5, 2.5] };
  const { checked, mismatches } = orderAudit(buildReadingNook(), RUG_TOP, { width: 2.4, depth: 1.6 }, buildCharacter(null), sweep);
  assert.ok(checked >= 100, `${checked} cameras`);
  assert.deepEqual(mismatches, []);
});

test('face budget and determinism', () => {
  const m = buildReadingNook();
  assert.ok(m.faces.length <= 170, `${m.faces.length} faces`);
  for (const f of m.faces) for (const i of f.indices) assert.ok(i >= 0 && i < m.vertices.length);
  assert.deepEqual(buildReadingNook(), buildReadingNook());
  // No art: the builder takes the scene's options and ignores them.
  assert.deepEqual(buildReadingNook({ art: { width: 1, height: 1 } }), buildReadingNook());
});
