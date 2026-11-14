import test from 'node:test';
import assert from 'node:assert/strict';
import { DECOR_BUILDERS, meshForDecorKind, buildPlant, buildWaitingChairs, buildWaterCooler } from './decor.js';
import { buildDrawList, screenOverlap } from '../core.js';
import { cameraAt } from './standing-order.test-helper.js';
import { UNIT_SCALE } from '../scene.js';
import { DECOR_COLORS } from '../../../hospital/anime-furniture.js';
import { tint } from '../../../hospital/anime-ui.js';

// The kinds LIBRARY_DECOR places (library-game.js): a missing builder would
// leave that prop out of First Person entirely.
const LIBRARY_DECOR_KINDS = ['water-cooler', 'plant', 'ladder', 'waiting-chairs'];

test('every decor kind Library places has a builder', () => {
  for (const kind of LIBRARY_DECOR_KINDS) {
    assert.equal(typeof meshForDecorKind(kind), 'function', kind);
  }
});

test('an unknown decor kind has no mesh rather than a wrong one', () => {
  assert.equal(meshForDecorKind('vending-machine'), null);
  assert.equal(meshForDecorKind('nope'), null);
});

test('each decor mesh stands on the floor at a plausible height', () => {
  // Heights a person in the room would read as right (metres), since these
  // are placed at UNIT_SCALE like every other unit-sized mesh.
  const expected = {
    'water-cooler': [1.2, 1.5],
    plant: [0.9, 1.2],
    ladder: [1.4, 1.8],
    'waiting-chairs': [0.8, 1.0],
  };
  for (const [kind, [lo, hi]] of Object.entries(expected)) {
    const mesh = DECOR_BUILDERS[kind]();
    const ys = mesh.vertices.map((v) => v[1]);
    const foot = Math.min(...ys);
    const top = Math.max(...ys);
    assert.ok(Math.abs(foot) < 1e-9, `${kind} rests on y=0, not ${foot}`);
    assert.ok(top >= lo && top <= hi, `${kind} stands ${top}, want ${lo}..${hi}`);
  }
});

test('every decor face culls, so a prop is solid from any angle', () => {
  for (const kind of LIBRARY_DECOR_KINDS) {
    const mesh = DECOR_BUILDERS[kind]();
    assert.ok(mesh.faces.length > 0, kind);
    assert.ok(mesh.faces.every((f) => f.cull === true), `${kind} has an uncelled face`);
  }
});

test('every decor face wears a colour the 2D drawer exports', () => {
  const allowed = {
    'water-cooler': Object.values(DECOR_COLORS.waterCooler),
    plant: [...Object.values(DECOR_COLORS.plant), tint(DECOR_COLORS.plant.leaf, -0.3)],
    ladder: Object.values(DECOR_COLORS.ladder),
    'waiting-chairs': [
      ...DECOR_COLORS.waitingChairs.backs,
      ...DECOR_COLORS.waitingChairs.backs.map((c) => tint(c, DECOR_COLORS.waitingChairs.seatTint)),
      DECOR_COLORS.waitingChairs.leg,
    ],
  };
  for (const [kind, colours] of Object.entries(allowed)) {
    for (const f of DECOR_BUILDERS[kind]().faces) {
      assert.ok(colours.includes(f.color), `${kind} face colour ${f.color}`);
    }
  }
  // Every colour the drawer exports shows somewhere on its mesh.
  assert.ok(buildPlant().faces.some((f) => f.color === DECOR_COLORS.plant.flower));
  for (const c of DECOR_COLORS.waitingChairs.backs) {
    assert.ok(buildWaitingChairs().faces.some((f) => f.color === c), c);
  }
});

test("the water cooler's taps and cups stand on its +Z front", () => {
  const cooler = DECOR_COLORS.waterCooler;
  const mesh = buildWaterCooler();
  for (const colour of [cooler.tapCold, cooler.tapHot, cooler.cups]) {
    const zs = mesh.faces.filter((f) => f.color === colour).flatMap((f) => f.indices.map((i) => mesh.vertices[i][2]));
    assert.ok(zs.length > 0, colour);
    assert.ok(Math.min(...zs) >= 0.17 - 1e-9, `${colour} is not sunk into the body`);
    assert.ok(Math.max(...zs) > 0.17, `${colour} protrudes on +Z`);
  }
});

test('the waiting chairs seat is on the -Z side because the row stands against the south edge', () => {
  const mesh = buildWaitingChairs();
  const zOf = (colour, pick) => pick(...mesh.faces.filter((f) => f.color === colour).flatMap((f) => f.indices.map((i) => mesh.vertices[i][2])));
  for (const back of DECOR_COLORS.waitingChairs.backs) {
    const seat = tint(back, DECOR_COLORS.waitingChairs.seatTint);
    assert.ok(zOf(seat, Math.min) < zOf(back, Math.min), `${back}: the seat reaches further toward -Z than the back`);
    assert.ok(zOf(back, Math.min) > 0, `${back}: the back stands on +Z`);
  }
});

test('the water cooler front cells tile the body front around the fixtures exactly', () => {
  const mesh = buildWaterCooler();
  const cells = mesh.faces.filter((f) => f.color === DECOR_COLORS.waterCooler.body && f.indices.every((i) => Math.abs(mesh.vertices[i][2] - 0.17) < 1e-9));
  let area = 0;
  for (const f of cells) {
    const xs = f.indices.map((i) => mesh.vertices[i][0]);
    const ys = f.indices.map((i) => mesh.vertices[i][1]);
    area += (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
  }
  const fixtures = 2 * 0.06 * 0.06 + 0.12 * 0.12;
  assert.ok(Math.abs(area - (0.34 * 0.8 - fixtures)) < 1e-9, `front area ${area}`);
});

test('no cooler body face is drawn after a tap or cup face it overlaps, at oblique views', () => {
  const mesh = buildWaterCooler();
  const fixture = new Set([DECOR_COLORS.waterCooler.tapCold, DECOR_COLORS.waterCooler.tapHot, DECOR_COLORS.waterCooler.cups]);
  // Tag each face with its own unlit colour so the draw list says which is which.
  const tagged = { vertices: mesh.vertices, faces: mesh.faces.map((f, i) => ({ ...f, unlit: true, color: '#' + (i + 1).toString(16).padStart(6, '0') })) };
  const isFixture = (i) => fixture.has(mesh.faces[i].color);
  const env = { viewport: { width: 400, height: 400 }, light: { dir: [0.35, 1, 0.25], ambient: 0.5 } };
  for (const deg of [-75, -60, -35, -15, 0, 15, 35, 60, 75]) {
    for (const radius of [1.5, 2.5, 3.5]) {
      const { cam } = cameraAt(deg, 0, radius, 0.6);
      const list = buildDrawList(cam, [{ mesh: tagged, placement: { pos: [0, 0, 0], yaw: 0, scale: UNIT_SCALE } }], env);
      const tags = list.map((p) => { const [r, g, b] = p.color.match(/\d+/g).map(Number); return ((r << 16) | (g << 8) | b) - 1; });
      list.forEach((p, a) => {
        if (!isFixture(tags[a])) return;
        for (let b = a + 1; b < list.length; b++) {
          if (isFixture(tags[b])) continue;
          assert.ok(!screenOverlap(p.screen, list[b].screen), `${deg} deg at ${radius}: body face ${tags[b]} is drawn after fixture face ${tags[a]}`);
        }
      });
    }
  }
});
