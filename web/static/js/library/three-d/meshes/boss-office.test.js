import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBossOffice, paintBossOfficeArt, bossOfficeTileColor, BOSS_OFFICE_ART, BOSS_OFFICE_ART_SCALE, BOSS_OFFICE_SIZE,
} from './boss-office.js';
import { bossDoorLayout, BOSS_DOOR_COLORS } from '../../anime-furniture.js';

// A stand-in for the canvas the game paints drawBossDoor into.
const ART = { width: BOSS_OFFICE_ART.w * BOSS_OFFICE_ART_SCALE, height: BOSS_OFFICE_ART.h * BOSS_OFFICE_ART_SCALE };
const L = bossDoorLayout({ w: BOSS_OFFICE_ART.w }, BOSS_OFFICE_ART.h);
const F = L.frame;
const A = { x0: -BOSS_OFFICE_ART.w / 2, y0: -BOSS_OFFICE_ART.h / 2, x1: BOSS_OFFICE_ART.w / 2 };
const S = BOSS_OFFICE_SIZE.frameWidth / (F.x1 - F.x0);
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);
const bbox = (m) => [0, 1, 2].map((k) => {
  const a = m.vertices.map((v) => v[k]);
  return [Math.min(...a), Math.max(...a)];
});
const textured = (m) => m.faces.filter((f) => f.texture);
const pts = (m, f) => f.indices.map((i) => m.vertices[i]);
const uvBox = (f) => {
  const us = f.texture.uv.map(([u]) => u / BOSS_OFFICE_ART_SCALE - BOSS_OFFICE_ART.w / 2);
  const vs = f.texture.uv.map(([, v]) => v / BOSS_OFFICE_ART_SCALE - BOSS_OFFICE_ART.h / 2);
  return { x0: Math.min(...us), y0: Math.min(...vs), x1: Math.max(...us), y1: Math.max(...vs) };
};
const sameRect = (a, b) => ['x0', 'y0', 'x1', 'y1'].every((k) => Math.abs(a[k] - b[k]) < 1e-9);
const faceFor = (m, r) => textured(m).find((f) => sameRect(uvBox(f), r));
const zOf = (m, f) => {
  const z = pts(m, f).map((p) => p[2]);
  return z.every((v) => Math.abs(v - z[0]) < 1e-12) ? z[0] : null;
};
const D = L.door;
const REGIONS = {
  wallLeft: { x0: A.x0, y0: A.y0, x1: F.x0, y1: F.y1 },
  wallRight: { x0: F.x1, y0: A.y0, x1: A.x1, y1: F.y1 },
  header: { x0: F.x0, y0: A.y0, x1: F.x1, y1: F.y0 },
  postLeft: { x0: F.x0, y0: D.y0, x1: D.x0, y1: F.y1 },
  postRight: { x0: D.x1, y0: D.y0, x1: F.x1, y1: F.y1 },
  lintel: { x0: F.x0, y0: F.y0, x1: F.x1, y1: D.y0 },
  door: D,
  knob: L.knobBox,
  plaque: L.plaque,
};

test('real-world size: a ~1 x 2 m door in a wall section, a room behind it, base on the floor', () => {
  for (const m of [buildBossOffice(), buildBossOffice({ art: ART, locked: true })]) {
    const [bx, by, bz] = bbox(m);
    near(by[0], 0);
    near(bx[1] - bx[0], BOSS_OFFICE_ART.w * S);
    near(by[1], BOSS_OFFICE_SIZE.height);
    assert.ok(bz[0] <= -2.4 && bz[1] < 0.1, 'deep behind, nothing far in front');
    const doorH = (D.y1 - D.y0) * S;
    const doorW = (D.x1 - D.x0) * S;
    assert.ok(doorH > 1.9 && doorH < 2.3, `door ${doorH} m tall`);
    assert.ok(doorH / doorW > 1.7, 'a door, not a square');
  }
});

test('the art box has the mesh front\'s own aspect', () => {
  near((BOSS_OFFICE_ART.w * S) / BOSS_OFFICE_SIZE.height, BOSS_OFFICE_ART.w / (F.y1 - A.y0));
});

test('each textured front shows exactly its layout region of the art, on the image', () => {
  const m = buildBossOffice({ art: ART });
  for (const [name, r] of Object.entries(REGIONS)) {
    const f = faceFor(m, r);
    assert.ok(f, `${name} is textured`);
    assert.equal(f.unlit, true, `${name} is unlit`);
    for (const [u, v] of f.texture.uv) assert.ok(u >= 0 && u <= ART.width && v >= 0 && v <= ART.height, `${name} stays on the image`);
  }
  assert.equal(textured(m).length, Object.keys(REGIONS).length);
  // Everything else stays lit, so the office reads as solid.
  assert.ok(m.faces.filter((f) => !f.texture).every((f) => !f.unlit));
});

test('depth: frame proud of the wall, the door back in it, knob and plaque proud', () => {
  const m = buildBossOffice({ art: ART, locked: true });
  const z = (r) => zOf(m, faceFor(m, r));
  assert.ok(z(REGIONS.postLeft) > z(REGIONS.wallLeft), 'frame proud of the wall');
  assert.ok(z(REGIONS.door) < z(REGIONS.wallLeft), 'door recessed');
  assert.ok(z(REGIONS.knob) > z(REGIONS.door), 'knob proud of the door');
  assert.ok(z(L.lock) > z(REGIONS.door), 'lock badge proud of the door');
  assert.ok(z(REGIONS.plaque) > z(REGIONS.lintel), 'plaque over the lintel');
  // No untextured face coplanar with, and overlapping, a textured front.
  for (const t of textured(m)) {
    const tz = zOf(m, t);
    const [tx0, tx1] = [Math.min(...pts(m, t).map((p) => p[0])), Math.max(...pts(m, t).map((p) => p[0]))];
    for (const f of m.faces.filter((g) => !g.texture)) {
      if (zOf(m, f) === null || Math.abs(zOf(m, f) - tz) > 1e-9) continue;
      const xs = pts(m, f).map((p) => p[0]);
      assert.ok(Math.max(...xs) <= tx0 + 1e-9 || Math.min(...xs) >= tx1 - 1e-9, 'coplanar overlap');
    }
  }
});

test('locked adds the padlock badge and greys the walls; the flat fallback takes the drawer\'s colours', () => {
  const open = buildBossOffice();
  const shut = buildBossOffice({ locked: true });
  assert.equal(shut.faces.length, open.faces.length + 5);
  assert.ok(open.faces.some((f) => f.color === BOSS_DOOR_COLORS.tile));
  assert.ok(!open.faces.some((f) => f.color === BOSS_DOOR_COLORS.tileLocked));
  assert.ok(shut.faces.some((f) => f.color === BOSS_DOOR_COLORS.tileLocked));
  assert.ok(shut.faces.some((f) => f.color === BOSS_DOOR_COLORS.lock));
  for (const c of [BOSS_DOOR_COLORS.frame, BOSS_DOOR_COLORS.door, BOSS_DOOR_COLORS.plaque]) {
    assert.ok(open.faces.some((f) => f.color === c), c);
  }
  assert.equal(textured(open).length, 0);
  assert.equal(bossOfficeTileColor(true), BOSS_DOOR_COLORS.tileLocked);
});

test('a face budget, valid indices, deterministic', () => {
  const m = buildBossOffice({ art: ART, locked: true });
  assert.ok(m.faces.length <= 50, `${m.faces.length} faces`);
  for (const f of m.faces) for (const i of f.indices) assert.ok(i >= 0 && i < m.vertices.length);
  assert.deepEqual(buildBossOffice({ art: ART, locked: true }), m);
});

test('paintBossOfficeArt paints an opaque backing, the tile, then drawBossDoor at the art box (and the lock)', () => {
  for (const locked of [false, true]) {
    const calls = [];
    const grad = { addColorStop() {} };
    const ctx = new Proxy({}, {
      get: (_, k) => ((k === 'createLinearGradient' || k === 'createRadialGradient') ? () => grad : (...a) => calls.push([k, a])),
      set: (_, k, v) => { calls.push(['set:' + k, [v]]); return true; },
    });
    paintBossOfficeArt(ctx, { id: 'boss-office' }, { locked });
    const firstFill = calls.findIndex(([k]) => k === 'fillRect');
    assert.deepEqual(calls[firstFill][1], [0, 0, ART.width, ART.height]);
    assert.ok(calls.slice(0, firstFill).some(([k, a]) => k === 'set:fillStyle' && a[0] === bossOfficeTileColor(locked)));
    assert.ok(!calls.slice(0, firstFill).some(([k]) => k === 'roundRect'), 'backing first');
    const rects = calls.filter(([k]) => k === 'roundRect').map(([, a]) => a.slice(0, 4));
    assert.deepEqual(rects[1], [A.x0, A.y0, BOSS_OFFICE_ART.w, BOSS_OFFICE_ART.h], 'the tile');
    const frameAt = rects.findIndex((r) => r.join() === [F.x0, F.y0, F.x1 - F.x0, F.y1 - F.y0].join());
    assert.ok(frameAt > 1, 'the drawer draws over the tile, at the layout');
    const lockAt = rects.findIndex((r) => r.join() === '-14,-12,28,28');
    assert.equal(lockAt > frameAt, locked, 'the padlock only while locked, over the door');
  }
});

test('every face culls, and its winding faces out: art shows from in front, never from behind', async () => {
  const { buildDrawList, cameraFromPose } = await import('../core.js');
  const env = { viewport: { width: 400, height: 400 }, light: { dir: [0.35, 1, 0.25], ambient: 0.5 } };
  const cam = (z, facing, x = 0, eye = 60) => cameraFromPose({ x, y: z, facing }, { eyeHeight: eye, fov: Math.PI / 3, aspect: 1, near: 1, far: 2000 });
  for (const locked of [false, true]) {
    const m = buildBossOffice({ art: ART, locked });
    assert.ok(m.faces.every((f) => f.cull === true));
    const placed = [{ mesh: m, placement: { pos: [0, 0, 0], yaw: 0, scale: 40 } }];
    const tri = (list) => list.filter((p) => p.image).length;
    const cells = textured(m).reduce((n, f) => n + f.texture.div[0] * f.texture.div[1], 0);
    // The player approaches from +Z (game south), looking toward -Z (facing 0).
    assert.equal(tri(buildDrawList(cam(150, 0), placed, env)), 2 * cells, 'every front seen head-on');
    const behind = buildDrawList(cam(-250, Math.PI), placed, env);
    assert.equal(tri(behind), 0, 'no art seen through the back');
    assert.ok(behind.length > 0, 'the office\'s back wall is seen');
  }
});
