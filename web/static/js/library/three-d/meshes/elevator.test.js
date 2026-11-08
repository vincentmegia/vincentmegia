import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildElevator, paintElevatorArt, ELEVATOR_ART, ELEVATOR_ART_SCALE, ELEVATOR_SIZE,
  ELEVATOR_DOOR_COLOR, ELEVATOR_HALF_DOORWAY,
} from './elevator.js';
import { elevatorLayout, ELEVATOR_COLORS } from '../../../hospital/anime-furniture.js';

// A stand-in for the canvas the game paints drawElevator into.
const ART = { width: ELEVATOR_ART.w * ELEVATOR_ART_SCALE, height: ELEVATOR_ART.h * ELEVATOR_ART_SCALE };
const L = elevatorLayout({ w: ELEVATOR_ART.w }, { height: ELEVATOR_ART.h });
const F = L.frame;
const A = { x0: -ELEVATOR_ART.w / 2, y0: -ELEVATOR_ART.h / 2, x1: ELEVATOR_ART.w / 2 }; // the art box (= the tile)
const S = ELEVATOR_SIZE.width / F.w; // units per art px
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);
const bbox = (m) => [0, 1, 2].map((k) => {
  const a = m.vertices.map((v) => v[k]);
  return [Math.min(...a), Math.max(...a)];
});
const textured = (m) => m.faces.filter((f) => f.texture);
const pts = (m, f) => f.indices.map((i) => m.vertices[i]);
// A textured face's uv box, back in the art's centered px.
const uvBox = (f) => {
  const us = f.texture.uv.map(([u]) => u / ELEVATOR_ART_SCALE - ELEVATOR_ART.w / 2);
  const vs = f.texture.uv.map(([, v]) => v / ELEVATOR_ART_SCALE - ELEVATOR_ART.h / 2);
  return { x0: Math.min(...us), y0: Math.min(...vs), x1: Math.max(...us), y1: Math.max(...vs) };
};
const sameRect = (a, b) => ['x0', 'y0', 'x1', 'y1'].every((k) => Math.abs(a[k] - b[k]) < 1e-9);
const faceFor = (m, r) => textured(m).find((f) => sameRect(uvBox(f), r));
// The regions the mesh shows, read off elevatorLayout (the drawer's own layout).
const D0 = L.doors[0];
const D1 = L.doors[1];
const REGIONS = {
  wallLeft: { x0: A.x0, y0: F.y0, x1: F.x0, y1: F.y1 },
  wallRight: { x0: F.x1, y0: F.y0, x1: A.x1, y1: F.y1 },
  header: { x0: A.x0, y0: A.y0, x1: A.x1, y1: F.y0 },
  postLeft: { x0: F.x0, y0: D0.y0, x1: D0.x0, y1: D0.y1 },
  postRight: { x0: D1.x1, y0: D1.y0, x1: F.x1, y1: D1.y1 },
  lintel: { x0: F.x0, y0: F.y0, x1: F.x1, y1: D0.y0 },
  sill: { x0: F.x0, y0: D0.y1, x1: F.x1, y1: F.y1 },
  doorLeft: D0,
  doorRight: D1,
  indicator: L.indicator,
  panel: L.panel,
  button: L.button,
};
const doorFaces = (m) => [faceFor(m, D0), faceFor(m, D1)];
const xs = (m, f) => pts(m, f).map((p) => p[0]);
const zOf = (m, f) => {
  const z = pts(m, f).map((p) => p[2]);
  return z.every((v) => Math.abs(v - z[0]) < 1e-12) ? z[0] : null;
};

test('real-world size: the doorway and car keep 1.4 x 2.2, base on the floor', () => {
  for (const m of [buildElevator(), buildElevator({ art: ART })]) {
    const [bx, by, bz] = bbox(m);
    near(by[0], 0);
    // The whole thing: the wall section the 2D tile stands for, around the frame.
    near(bx[1] - bx[0], ELEVATOR_ART.w * S);
    near(by[1], (F.y1 - A.y0) * S);
    near(bz[1], ELEVATOR_SIZE.depth - 0.1);
    assert.ok(bz[0] >= -0.2, 'only the doors and fittings stand proud of the wall');
  }
  const m = buildElevator({ art: ART });
  const fx = [REGIONS.postLeft, REGIONS.postRight, REGIONS.lintel, REGIONS.sill].flatMap((r) => xs(m, faceFor(m, r)));
  near(Math.max(...fx) - Math.min(...fx), ELEVATOR_SIZE.width);
  const fy = [REGIONS.postLeft, REGIONS.lintel, REGIONS.sill].flatMap((r) => pts(m, faceFor(m, r)).map((p) => p[1]));
  near(Math.min(...fy), 0);
  near(Math.max(...fy), ELEVATOR_SIZE.height);
});

test('the art is drawn at the mesh\'s own aspect, so it maps without stretching', () => {
  near(F.w / F.h, ELEVATOR_SIZE.width / ELEVATOR_SIZE.height);
  // One scale for x and y: every textured face is as wide/tall as its region times S.
  const m = buildElevator({ art: ART });
  for (const f of textured(m)) {
    const b = uvBox(f);
    const p = pts(m, f);
    near(Math.max(...p.map((v) => v[0])) - Math.min(...p.map((v) => v[0])), (b.x1 - b.x0) * S);
    near(Math.max(...p.map((v) => v[1])) - Math.min(...p.map((v) => v[1])), (b.y1 - b.y0) * S);
  }
});

test('with art, every front is a textured, unlit -Z face whose uv stays on the image', () => {
  const m = buildElevator({ art: ART });
  const t = textured(m);
  assert.equal(t.length, Object.keys(REGIONS).length);
  for (const f of t) {
    assert.equal(f.texture.image, ART);
    assert.equal(f.unlit, true, 'the 2D art carries its own top-lit shading');
    assert.equal(f.indices.length, 4);
    for (const [u, v] of f.texture.uv) assert.ok(u >= 0 && u <= ART.width && v >= 0 && v <= ART.height, `uv ${u},${v} off the image`);
    const p = pts(m, f);
    const n = [0, 1, 2].map((k) => {
      const a = p[0], b = p[1], c = p[2];
      const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      return [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]][k];
    });
    assert.ok(n[2] < 0 && Math.abs(n[0]) < 1e-12 && Math.abs(n[1]) < 1e-12, 'faces -Z, toward the player');
  }
  // Every other face stays lit, so the elevator still reads as solid.
  assert.ok(m.faces.filter((f) => !f.texture).every((f) => !f.unlit));
});

test('each front maps exactly its own region of elevatorLayout, the right way round', () => {
  for (const open of [0, 1]) {
    const m = buildElevator({ art: ART, doorOpen: open });
    for (const [name, r] of Object.entries(REGIONS)) {
      const f = faceFor(m, r);
      assert.ok(f, `${name} at doorOpen ${open}`);
      // Seen from -Z, art x runs toward model -X, and art y down while model y
      // goes up: along every edge, u falls as x rises and v falls as y rises.
      const p = pts(m, f);
      for (let k = 0; k < 4; k++) {
        const j = (k + 1) % 4;
        const [du, dv] = [f.texture.uv[j][0] - f.texture.uv[k][0], f.texture.uv[j][1] - f.texture.uv[k][1]];
        const [dx, dy] = [p[j][0] - p[k][0], p[j][1] - p[k][1]];
        if (Math.abs(dx) > 1e-12) near(du / dx, -ELEVATOR_ART_SCALE / S, 1e-6);
        if (Math.abs(dy) > 1e-12) near(dv / dy, -ELEVATOR_ART_SCALE / S, 1e-6);
      }
    }
  }
  // The pieces sit where the art puts them: the call panel on the viewer's
  // right (model -X, since the player looks toward +Z), the indicator above the doors.
  const m = buildElevator({ art: ART });
  assert.ok(Math.max(...xs(m, faceFor(m, L.panel))) < -ELEVATOR_SIZE.width / 2);
  near(Math.min(...pts(m, faceFor(m, L.indicator)).map((p) => p[1])), (F.y1 - L.indicator.y1) * S);
  near(Math.min(...xs(m, faceFor(m, D1))), -(D1.x1) * S);
});

test('the doors carry their own art as they slide: shut leaves the 2D seam, open clears the doorway', () => {
  const inner = (open) => {
    const m = buildElevator({ art: ART, doorOpen: open });
    const [l, r] = doorFaces(m);
    // Art-left door is model +X, so its inner edge is its smallest x.
    return { left: Math.min(...xs(m, l)), right: Math.max(...xs(m, r)), m, l, r };
  };
  const shut = inner(0);
  near(shut.left, -D0.x1 * S);
  near(shut.right, -D1.x0 * S);
  near(shut.left - shut.right, (D1.x0 - D0.x1) * S); // the drawer's 1 px seam
  const open = inner(1);
  near(open.left, ELEVATOR_HALF_DOORWAY);
  near(open.right, -ELEVATOR_HALF_DOORWAY);
  near(ELEVATOR_HALF_DOORWAY, (F.w / 2 - (D0.x0 - F.x0)) * S); // the posts' inner edges
  const half = inner(0.5);
  near(half.left, (shut.left + open.left) / 2);
  // Same uv at every doorOpen: the art moves with the panel.
  assert.deepEqual(open.l.texture.uv, shut.l.texture.uv);
  assert.deepEqual(open.r.texture.uv, shut.r.texture.uv);
  // doorOpen is clamped.
  assert.deepEqual(buildElevator({ art: ART, doorOpen: 3 }), open.m);
  assert.deepEqual(buildElevator({ art: ART, doorOpen: -1 }), shut.m);
  // Door faces keep the door colour (the flat fallback and the side faces).
  assert.ok(buildElevator().faces.some((f) => f.color === ELEVATOR_DOOR_COLOR));
  assert.equal(ELEVATOR_DOOR_COLOR, ELEVATOR_COLORS.door);
});

test('depth: frame proud of the wall, doors proud of the frame, fittings proud of the wall', () => {
  const m = buildElevator({ art: ART });
  const z = (r) => zOf(m, faceFor(m, r));
  const wall = z(REGIONS.wallLeft);
  assert.equal(z(REGIONS.wallRight), wall);
  assert.equal(z(REGIONS.header), wall);
  for (const r of [REGIONS.postLeft, REGIONS.postRight, REGIONS.lintel, REGIONS.sill]) assert.ok(z(r) < wall - 0.02, 'frame proud of the wall');
  for (const r of [D0, D1]) assert.ok(z(r) < z(REGIONS.lintel) - 0.01, 'doors proud of the frame');
  assert.ok(z(L.indicator) < wall && z(L.panel) < wall, 'indicator and call panel stand on the wall');
  assert.ok(z(L.button) < z(L.panel), 'the button stands proud of its panel');
  // Behind the doorway is a car you can see into: its back wall faces the doors.
  const back = m.faces.filter((f) => !f.texture && zOf(m, f) !== null && zOf(m, f) > 0.5);
  assert.ok(back.length >= 2);
});

test('no untextured face is coplanar with a textured front (no painter-sort ties)', () => {
  for (const open of [0, 1]) {
    const m = buildElevator({ art: ART, doorOpen: open });
    const texZ = new Set(textured(m).map((f) => zOf(m, f).toFixed(6)));
    for (const f of m.faces.filter((x) => !x.texture)) {
      const z = zOf(m, f);
      if (z === null) continue;
      assert.ok(!texZ.has(z.toFixed(6)), `untextured face at z=${z} ties with a textured front`);
    }
  }
});

test('without art the same geometry is drawn in the drawer\'s flat colours', () => {
  const flat = buildElevator();
  const tex = buildElevator({ art: ART });
  assert.equal(flat.faces.length, tex.faces.length);
  assert.deepEqual(flat.vertices, tex.vertices);
  assert.ok(!flat.faces.some((f) => f.texture || f.unlit));
  const colors = new Set(flat.faces.map((f) => f.color));
  for (const c of [ELEVATOR_COLORS.tile, ELEVATOR_COLORS.frame, ELEVATOR_COLORS.door, ELEVATOR_COLORS.indicator, ELEVATOR_COLORS.panel, ELEVATOR_COLORS.button]) assert.ok(colors.has(c), c);
  assert.equal(colors.size, new Set(Object.values(ELEVATOR_COLORS)).size - 1, 'only the drawer\'s colours (no shine)');
  // The wall section is the station tile: its sides take the tile colour too.
  assert.equal(flat.faces[0].color, ELEVATOR_COLORS.tile);
});

test('ELEVATOR_COLORS.tile is the tile both games draw the elevator on', async () => {
  const { readFileSync } = await import('node:fs');
  for (const game of ['library-game.js', 'hospital-game.js']) {
    const src = readFileSync(new URL(`../../../${game}`, import.meta.url), 'utf8');
    const m = src.match(/STATION_COLORS = \{[^}]*?\belevator: '(#[0-9a-f]{6})'/i);
    assert.ok(m, `${game}: STATION_COLORS.elevator`);
    assert.equal(m[1], ELEVATOR_COLORS.tile, game);
  }
});

test('face budget, indices in range and determinism', () => {
  const m = buildElevator({ art: ART, doorOpen: 0.3 });
  assert.ok(m.faces.length <= 60, `${m.faces.length} faces`);
  for (const f of m.faces) for (const i of f.indices) assert.ok(i >= 0 && i < m.vertices.length);
  assert.deepEqual(buildElevator({ art: ART, doorOpen: 0.3 }), m);
  assert.deepEqual(buildElevator({ doorOpen: 0.3 }), buildElevator({ doorOpen: 0.3 }));
});

test('paintElevatorArt paints an opaque backing, then drawElevator at the art box, at full glow', () => {
  const calls = [];
  const grad = { addColorStop() {} };
  const ctx = new Proxy({}, {
    get: (_, k) => ((k === 'createLinearGradient' || k === 'createRadialGradient') ? () => grad : (...a) => calls.push([k, a])),
    set: (_, k, v) => { calls.push(['set:' + k, [v]]); return true; },
  });
  paintElevatorArt(ctx, { id: 'elevator-2', floor: 2, targetFloor: 1 });
  const firstFill = calls.findIndex(([k]) => k === 'fillRect');
  assert.deepEqual(calls[firstFill][1], [0, 0, ART.width, ART.height]);
  assert.ok(calls.slice(0, firstFill).some(([k, a]) => k === 'set:fillStyle' && a[0] === ELEVATOR_COLORS.tile));
  assert.ok(!calls.slice(0, firstFill).some(([k]) => k === 'roundRect' || k === 'fillText'), 'backing first');
  // Then the station tile Top-Down draws it on, filling the art box, then the
  // drawer at the art box's height: its frame is the layout's.
  const rects = calls.filter(([k]) => k === 'roundRect').map(([, a]) => a.slice(0, 4));
  assert.deepEqual(rects[1], [A.x0, A.y0, ELEVATOR_ART.w, ELEVATOR_ART.h], 'the tile');
  const frameAt = rects.findIndex((r) => r.join() === [F.x, F.y, F.w, F.h].join());
  assert.ok(frameAt > 1, 'the drawer draws over the tile');
  assert.deepEqual(calls.find(([k]) => k === 'fillText')[1], ['▼ 1', L.label.x, L.label.y]);
  assert.ok(calls.some(([k, a]) => k === 'set:globalAlpha' && a[0] === 1), 'the call button at full glow');
});

test('every face culls, and its winding faces out: art shows from in front, never from behind', async () => {
  const { buildDrawList, cameraFromPose } = await import('../core.js');
  const env = { viewport: { width: 400, height: 400 }, light: { dir: [0.35, 1, 0.25], ambient: 0.5 } };
  const cam = (z, facing, x = 0, eye = 60) => cameraFromPose({ x, y: z, facing }, { eyeHeight: eye, fov: Math.PI / 3, aspect: 1, near: 1, far: 2000 });
  for (const open of [0, 1]) {
    const m = buildElevator({ art: ART, doorOpen: open });
    assert.ok(m.faces.every((f) => f.cull === true));
    const placed = [{ mesh: m, placement: { pos: [0, 0, 0], yaw: 0, scale: 40 } }];
    const tri = (list) => list.filter((p) => p.image).length;
    const cells = textured(m).reduce((n, f) => n + f.texture.div[0] * f.texture.div[1], 0);
    // The player approaches from -Z (game north), looking toward +Z (facing pi).
    assert.equal(tri(buildDrawList(cam(-150, Math.PI), placed, env)), 2 * cells, 'every front seen head-on');
    // Mid-jump, from an angle: still all fronts, never a back.
    assert.equal(tri(buildDrawList(cam(-150, Math.PI - 0.6, 90, 115), placed, env)), 2 * cells);
    const behind = buildDrawList(cam(200, 0), placed, env);
    assert.equal(tri(behind), 0, 'no art seen through the back');
    assert.ok(behind.length > 0, 'the car\'s back is seen');
  }
  // Wound outward: from behind, only faces turned toward +Z or the sides survive.
  const m = buildElevator();
  const placed = [{ mesh: m, placement: { pos: [0, 0, 0], yaw: 0, scale: 40 } }];
  const front = buildDrawList(cam(-150, Math.PI), placed, env).length;
  const back = buildDrawList(cam(200, 0), placed, env).length;
  assert.ok(front > 0 && back > 0 && front !== back);
});
