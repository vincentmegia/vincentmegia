import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStairs,
  paintStairsBadgeArt,
  STAIR_RISE_PER_STEP,
  STAIR_RUN_PER_STEP,
  STAIRS_SIZE,
  STAIRS_BADGE_ART,
  BADGE_ART_SCALE,
} from './stairs.js';
import { stairStepColor, STAIRS_COLORS, STAIRS_BADGE, drawStairsBadge, stairsArrowDir } from '../../../hospital/anime-furniture.js';
import { tint } from '../../../hospital/anime-ui.js';
import { buildDrawList, cameraFromPose } from '../core.js';

const R = STAIR_RISE_PER_STEP;
const U = STAIR_RUN_PER_STEP;
const EPS = 1e-9;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const pts = (m, f) => f.indices.map((i) => m.vertices[i]);
const normal = (m, f) => {
  const [a, b, c] = pts(m, f);
  return cross(sub(b, a), sub(c, a));
};
const unit = (v) => {
  const l = Math.hypot(...v);
  return v.map((x) => x / l);
};
const fakeImage = { width: STAIRS_BADGE_ART.w * BADGE_ART_SCALE, height: STAIRS_BADGE_ART.h * BADGE_ART_SCALE };

// Flat, upward-facing faces in the step colour ramp: the treads.
const treads = (m) => m.faces.filter((f) => f.part === 'tread');

test('keeps the rise, the run and the 8-step default', () => {
  assert.equal(R, 0.18);
  assert.equal(U, 0.28);
  assert.equal(treads(buildStairs()).length, 8);
  assert.equal(treads(buildStairs({ steps: 5 })).length, 5);
});

test('footprint: 1.12 wide flight over steps * run, centred on the station, base at y=0', () => {
  const m = buildStairs();
  const zs = m.vertices.map((v) => v[2]);
  const ys = m.vertices.map((v) => v[1]);
  const L = 8 * U;
  assert.ok(Math.abs(Math.max(...zs) - L / 2) < EPS);
  assert.ok(Math.abs(Math.min(...zs) + L / 2) < EPS);
  assert.ok(Math.abs(Math.min(...ys)) < EPS);
  assert.ok(Math.abs(STAIRS_SIZE.width - 1.12) < EPS);
  assert.equal(STAIRS_SIZE.depth, L);
  assert.equal(STAIRS_SIZE.height, 8 * R);
  // The flight (steps, stringers, rail) stays within the old 1.12 width; the
  // newels stand 0.01 proud of it, and only the badge sign reaches past that.
  for (const f of m.faces.filter((g) => g.part !== 'badge' && g.part !== 'badge-post')) {
    const lim = f.part === 'newel' ? 0.57 : 0.56;
    for (const p of pts(m, f)) assert.ok(Math.abs(p[0]) <= lim + EPS, `${f.part} at x=${p[0]}`);
  }
  // Inside the 84 px 2D station box (UNIT_SCALE 40: half 1.05) in x.
  for (const v of m.vertices) assert.ok(Math.abs(v[0]) < 1.05);
});

test('the foot faces +Z: step 0\'s front edge is the +Z-most point and the flight rises toward -Z', () => {
  const m = buildStairs();
  const zMax = Math.max(...m.vertices.map((v) => v[2]));
  const t = treads(m);
  const first = pts(m, t[0]);
  // Step 0's front edge is its nosing, which is the +Z-most point; its tread runs to the nosing.
  const nose0 = m.faces.find((f) => f.part === 'nosing' && normal(m, f)[2] > 0);
  assert.ok(pts(m, nose0).every((p) => Math.abs(p[2] - zMax) < EPS), 'nosing 0 is the front');
  assert.ok(zMax - Math.max(...first.map((p) => p[2])) < 0.02, 'tread 0 runs to the nosing');
  assert.ok(Math.abs(first[0][1] - R) < EPS);
  for (let i = 0; i < t.length; i++) {
    const p = pts(m, t[i]);
    const y = p[0][1];
    assert.ok(p.every((q) => Math.abs(q[1] - y) < EPS), 'tread is flat');
    assert.ok(Math.abs(y - (i + 1) * R) < EPS, `tread ${i} at its rise`);
    assert.ok(normal(m, t[i])[1] > 0, 'tread faces up');
    const zFront = Math.max(...p.map((q) => q[2]));
    const zBack = Math.min(...p.map((q) => q[2]));
    const edge = zMax - i * U; // step i's nosing front
    assert.ok(zFront < edge && zFront > edge - 0.02, `tread ${i} front`);
    assert.ok(Math.abs(zBack - Math.max(-zMax, zFront - U)) < EPS, `tread ${i} run`);
  }
  // Each riser faces +Z (toward the approaching player) under its tread's front edge.
  const risers = m.faces.filter((f) => f.part === 'riser');
  assert.equal(risers.length, 8);
  risers.forEach((f, i) => {
    assert.ok(normal(m, f)[2] > 0);
    const zFront = Math.max(...pts(m, t[i]).map((q) => q[2]));
    for (const p of pts(m, f)) assert.ok(Math.abs(p[2] - zFront) < EPS);
    const ys = pts(m, f).map((p) => p[1]);
    assert.ok(Math.abs(Math.min(...ys) - i * R) < EPS && Math.abs(Math.max(...ys) - (i + 1) * R) < EPS);
  });
});

test('2D: stairStepColor(i, 5) is exactly Top-Down\'s tint(#b9d4f2, 0.1 + i * 0.12)', () => {
  for (let i = 0; i < 5; i++) assert.equal(stairStepColor(i, 5), tint('#b9d4f2', 0.1 + i * 0.12));
  assert.equal(stairStepColor(0), stairStepColor(0, 5));
  // 8 steps spread the same ramp: same ends, monotonically lighter.
  assert.equal(stairStepColor(0, 8), stairStepColor(0, 5));
  assert.equal(stairStepColor(7, 8), stairStepColor(4, 5));
  const lum = (c) => c.match(/\d+/g).map(Number).reduce((a, b) => a + b, 0);
  for (let i = 1; i < 8; i++) assert.ok(lum(stairStepColor(i, 8)) >= lum(stairStepColor(i - 1, 8)));
});

test('treads take the 2D ramp; risers are that colour under the 2D shadow line', () => {
  const m = buildStairs();
  treads(m).forEach((f, i) => assert.equal(f.color, stairStepColor(i, 8)));
  const [sr, sg, sb, sa] = STAIRS_COLORS.shadow.match(/[\d.]+/g).map(Number);
  m.faces.filter((f) => f.part === 'riser').forEach((f, i) => {
    const base = stairStepColor(i, 8).match(/\d+/g).map(Number);
    const want = `rgb(${[sr, sg, sb].map((s, k) => Math.round(base[k] * (1 - sa) + s * sa)).join(',')})`;
    assert.equal(f.color, want);
  });
});

test('each step has a plum nosing proud of its riser and tread', () => {
  const m = buildStairs();
  const noses = m.faces.filter((f) => f.part === 'nosing');
  assert.ok(noses.length >= 8);
  for (const f of noses) assert.equal(f.color, STAIRS_COLORS.edge);
  const zMax = Math.max(...m.vertices.map((v) => v[2]));
  for (let i = 0; i < 8; i++) {
    const front = noses.filter((f) => normal(m, f)[2] > 0 && pts(m, f).every((p) => p[2] > zMax - i * U - EPS && p[2] < zMax - i * U + 0.02));
    assert.equal(front.length, 1, `step ${i} nosing front`);
    const ys = pts(m, front[0]).map((p) => p[1]);
    assert.ok(Math.min(...ys) < (i + 1) * R && Math.max(...ys) > (i + 1) * R, 'straddles the tread edge');
  }
});

test('a two-tone handrail along the slope: ink core, the 2D rail colour on top in the 2D widths', () => {
  const m = buildStairs();
  const rail = m.faces.filter((f) => f.part === 'rail');
  assert.ok(rail.length >= 5);
  const top = rail.filter((f) => unit(normal(m, f))[1] > 0.5);
  const wood = top.filter((f) => f.color === STAIRS_COLORS.rail);
  assert.equal(wood.length, 1);
  for (const f of rail) assert.ok(f.color === STAIRS_COLORS.rail || f.color === STAIRS_COLORS.railInk);
  // The wood strip is wood/ink of the beam's width, like the 2D's 3 px over 5 px.
  const xs = (f) => pts(m, f).map((p) => p[0]);
  const beamX = top.flatMap(xs);
  const beamW = Math.max(...beamX) - Math.min(...beamX);
  const woodW = Math.max(...xs(wood[0])) - Math.min(...xs(wood[0]));
  assert.ok(Math.abs(woodW / beamW - 3 / 5) < 1e-6);
  // It climbs toward -Z: higher at the back than at the foot.
  const p = pts(m, wood[0]);
  const back = p.reduce((a, b) => (b[2] < a[2] ? b : a));
  const front = p.reduce((a, b) => (b[2] > a[2] ? b : a));
  assert.ok(back[1] > front[1] + 1);
  // On the left (-X) seen from the foot, as the 2D draws it.
  assert.ok(beamX.every((x) => x < 0));
  // Newel posts hold it at both ends.
  assert.equal(m.faces.filter((f) => f.part === 'newel' && unit(normal(m, f))[1] > 0.99).length, 2);
});

test('the badge sign: textured, unlit, uv exactly the badge art box and on the image', () => {
  const m = buildStairs({ art: fakeImage });
  const tex = m.faces.filter((f) => f.texture);
  assert.equal(tex.length, 1);
  const f = tex[0];
  assert.equal(f.part, 'badge');
  assert.equal(f.unlit, true);
  assert.equal(f.texture.image, fakeImage);
  const W = fakeImage.width;
  const H = fakeImage.height;
  // box front winds (x0,y0) (x1,y0) (x1,y1) (x0,y1), y up -> art y down.
  assert.deepEqual(f.texture.uv, [[0, H], [W, H], [W, 0], [0, 0]]);
  for (const [u, v] of f.texture.uv) assert.ok(u >= 0 && u <= W && v >= 0 && v <= H);
  // It faces +Z, at the foot, at the front of the footprint, above the first steps.
  assert.ok(normal(m, f)[2] > 0);
  const zMax = Math.max(...m.vertices.map((v) => v[2]));
  for (const p of pts(m, f)) assert.ok(Math.abs(p[2] - zMax) < EPS);
  const ys = pts(m, f).map((p) => p[1]);
  assert.ok(Math.min(...ys) > 0.8 && Math.max(...ys) < 1.5, 'below eye height (1.5)');
  // Square face for a square art box.
  const xs = pts(m, f).map((p) => p[0]);
  assert.ok(Math.abs((Math.max(...xs) - Math.min(...xs)) - (Math.max(...ys) - Math.min(...ys))) < EPS);
  assert.equal(STAIRS_BADGE_ART.w, STAIRS_BADGE_ART.h);
  // On the right (+X), where the 2D puts it.
  assert.ok(xs.every((x) => x > 0));
  // Only the badge is unlit.
  assert.deepEqual(m.faces.filter((g) => g.unlit).map((g) => g.part), ['badge']);
});

test('the badge art box fits the 2D badge disc', () => {
  const d = 2 * (STAIRS_BADGE.r + STAIRS_BADGE.line / 2);
  assert.ok(STAIRS_BADGE_ART.w > d && STAIRS_BADGE_ART.w < d * 1.4);
});

test('no untextured face is coplanar with the badge', () => {
  const m = buildStairs({ art: fakeImage });
  const f = m.faces.find((g) => g.texture);
  const n = unit(normal(m, f));
  const a = pts(m, f)[0];
  const [x0, x1] = [Math.min(...pts(m, f).map((p) => p[0])), Math.max(...pts(m, f).map((p) => p[0]))];
  const [y0, y1] = [Math.min(...pts(m, f).map((p) => p[1])), Math.max(...pts(m, f).map((p) => p[1]))];
  for (const g of m.faces) {
    if (g === f) continue;
    const gn = unit(normal(m, g));
    const coplanar = Math.abs(Math.abs(dot(gn, n)) - 1) < 1e-9 && pts(m, g).every((p) => Math.abs(dot(sub(p, a), n)) < 1e-9);
    if (!coplanar) continue;
    // A coplanar face elsewhere on that plane is fine; one overlapping the badge is not.
    const overlaps = pts(m, g).some((p) => p[0] > x0 + EPS && p[0] < x1 - EPS && p[1] > y0 + EPS && p[1] < y1 - EPS);
    assert.ok(!overlaps, `${g.part} is coplanar with and over the badge`);
  }
});

test('flat fallback: no art, no texture, the same faces', () => {
  const flat = buildStairs();
  const art = buildStairs({ art: fakeImage });
  assert.ok(flat.faces.every((f) => !f.texture && !f.unlit));
  assert.equal(flat.faces.length, art.faces.length);
  assert.deepEqual(flat.vertices, art.vertices);
  assert.equal(flat.faces.find((f) => f.part === 'badge').color, STAIRS_COLORS.badge);
});

test('every face culls, and is wound to face out (rendered from front, behind and both sides)', () => {
  const m = buildStairs({ art: fakeImage });
  assert.ok(m.faces.every((f) => f.cull === true));
  const S = 40;
  const opts = { viewport: { width: 320, height: 200 }, light: { dir: [0.35, 1, 0.25], ambient: 0.5 }, fog: null };
  const seen = (pose) => {
    const camera = cameraFromPose(pose, { eyeHeight: 60, pitch: 0, roll: 0, fov: Math.PI / 2.2, aspect: 1.6, near: 1, far: 2000 });
    const list = buildDrawList(camera, [{ mesh: m, placement: { pos: [0, 0, 0], yaw: 0, scale: S } }], opts);
    return list;
  };
  // From the e2e spot (60 px in front, facing north = -Z): the badge, the risers and treads.
  const front = seen({ x: 0, y: 60, facing: 0 });
  assert.ok(front.some((p) => p.image === fakeImage), 'badge seen from the front');
  // From behind (facing +Z): no badge, and every polygon drawn faces the camera.
  const behind = seen({ x: 0, y: -160, facing: Math.PI });
  assert.ok(!behind.some((p) => p.image), 'badge culled from behind');
  // Winding: the mesh is a set of convex solids (`solid` ids). Every face's
  // normal points away from its own solid's centroid (the mean of that
  // solid's vertices, which lies inside it), so a culled face is one turned
  // away from the camera, never one facing it.
  const solids = new Map();
  for (const f of m.faces) {
    const s = solids.get(f.solid) ?? new Set();
    for (const i of f.indices) s.add(i);
    solids.set(f.solid, s);
  }
  for (const f of m.faces) {
    assert.ok(Number.isInteger(f.solid), `${f.part} has a solid`);
    const ids = [...solids.get(f.solid)];
    const g = ids.reduce((acc, i) => acc.map((v, k) => v + m.vertices[i][k] / ids.length), [0, 0, 0]);
    const p = pts(m, f);
    const c = p.reduce((acc, q) => acc.map((v, k) => v + q[k] / p.length), [0, 0, 0]);
    assert.ok(dot(normal(m, f), sub(c, g)) > 1e-12, `${f.part} (solid ${f.solid}) faces inward`);
  }
  // Seen from the front, the treads and risers are drawn; from behind, none of them.
  const only = (part) => ({ vertices: m.vertices, faces: m.faces.filter((f) => f.part === part) });
  const drawn = (mesh, pose) => {
    const camera = cameraFromPose(pose, { eyeHeight: 60, pitch: 0, roll: 0, fov: Math.PI / 2.2, aspect: 1.6, near: 1, far: 2000 });
    return buildDrawList(camera, [{ mesh, placement: { pos: [0, 0, 0], yaw: 0, scale: S } }], opts).length;
  };
  assert.equal(drawn(only('riser'), { x: 0, y: 100, facing: 0 }), 8);
  assert.equal(drawn(only('riser'), { x: 0, y: -160, facing: Math.PI }), 0);
  assert.equal(drawn(only('tread'), { x: 0, y: 100, facing: 0 }), 8); // eye 1.5 > the top tread's 1.44
  assert.equal(drawn(only('back'), { x: 0, y: 100, facing: 0 }), 0);
  assert.equal(drawn(only('back'), { x: 0, y: -160, facing: Math.PI }), 1);
  // From each side: the stringer's outer face is drawn.
  for (const [x, facing] of [[120, -Math.PI / 2], [-120, Math.PI / 2]]) {
    const side = seen({ x, y: 0, facing });
    assert.ok(side.length > 0);
  }
});

test('face budget and valid indices', () => {
  const m = buildStairs({ art: fakeImage });
  assert.ok(m.faces.length <= 100, `${m.faces.length} faces`);
  for (const f of m.faces) for (const i of f.indices) assert.ok(i >= 0 && i < m.vertices.length);
});

test('deterministic', () => {
  assert.deepEqual(buildStairs(), buildStairs());
  assert.deepEqual(buildStairs({ art: fakeImage }), buildStairs({ art: fakeImage }));
});

test('paintStairsBadgeArt: the opaque backing first, then drawStairsBadge pointing the station\'s way', () => {
  for (const [st, dir] of [[{ floor: 1, targetFloor: 2 }, -1], [{ floor: 2, targetFloor: 1 }, 1]]) {
    assert.equal(stairsArrowDir(st), dir);
    const calls = [];
    const ctx = new Proxy({}, {
      get: (t, k) => (k in t ? t[k] : (...a) => calls.push([k, ...a])),
      set: (t, k, v) => { calls.push(['set', k, v]); t[k] = v; return true; },
    });
    paintStairsBadgeArt(ctx, st);
    const fill = calls.findIndex((c) => c[0] === 'fillRect');
    assert.ok(fill >= 0);
    assert.deepEqual(calls[fill].slice(1), [0, 0, STAIRS_BADGE_ART.w * BADGE_ART_SCALE, STAIRS_BADGE_ART.h * BADGE_ART_SCALE]);
    const firstDraw = calls.findIndex((c) => ['arc', 'fill', 'stroke', 'moveTo'].includes(c[0]));
    assert.ok(fill < firstDraw, 'backing before the badge');
    // The rest is exactly drawStairsBadge at the art box's centre.
    const want = [];
    const rec = new Proxy({}, {
      get: (t, k) => (k in t ? t[k] : (...a) => want.push([k, ...a])),
      set: (t, k, v) => { want.push(['set', k, v]); t[k] = v; return true; },
    });
    drawStairsBadge(rec, 0, 0, dir);
    const tail = calls.slice(calls.length - want.length - 1, calls.length - 1);
    assert.deepEqual(tail, want);
    assert.equal(calls[calls.length - 1][0], 'restore');
  }
});
