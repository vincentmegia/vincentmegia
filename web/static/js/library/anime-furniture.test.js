import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  bookcaseLayout,
  drawBookcase,
  drawFrontDesk,
  drawReturnCart,
  drawFinesRoom,
  drawBossDoor,
  drawReadingNook,
  coffeeMachineLayout,
  drawCoffeeMachine,
  drawOutOfOrderTape,
  COFFEE_MACHINE_COLORS,
  OUT_OF_ORDER_TAPE_COLORS,
} from './anime-furniture.js';
import { buildStations, stationExtents } from './floor-plan.js';
import { GENRES } from './rules.js';

/** A canvas 2D context stand-in: every method is a no-op that counts calls. */
function fakeContext() {
  const calls = { count: 0 };
  const gradient = { addColorStop() {} };
  return new Proxy({ calls }, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'measureText') return (text) => ({ width: String(text).length * 5 });
      if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => gradient;
      return () => { calls.count++; };
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  });
}

/** A station's box the way library-game.js's drawStation hands it over. */
function box(st) {
  const { hw, hh } = stationExtents(st);
  return { ...st, w: hw * 2, h: hh * 2 };
}

describe('library anime furniture', () => {
  test('every fixture drawer runs at the real station sizes', () => {
    const stations = buildStations(GENRES);
    const byKind = Object.fromEntries(stations.map((st) => [st.kind, st]));
    const drawers = [
      ['front-desk', (ctx, st) => drawFrontDesk(ctx, st)],
      ['return-cart', (ctx, st) => drawReturnCart(ctx, st)],
      ['fines-counter', (ctx, st) => drawFinesRoom(ctx, st)],
      ['boss-office', (ctx, st) => drawBossDoor(ctx, st)],
      ['reading-nook', (ctx, st) => drawReadingNook(ctx, st)],
      ['coffee-machine', (ctx, st) => drawCoffeeMachine(ctx, st)],
    ];
    for (const [kind, draw] of drawers) {
      const ctx = fakeContext();
      draw(ctx, box(byKind[kind]));
      assert.ok(ctx.calls.count > 20, `${kind} drew too little`);
    }
  });

  test('every genre bookcase draws: bilingual titles, plain titles, or none', () => {
    for (const shelf of buildStations(GENRES).filter((st) => st.kind === 'bookshelf')) {
      const genre = GENRES.find((g) => g.id === shelf.genreId);
      const ctx = fakeContext();
      drawBookcase(ctx, box(shelf), { color: genre.color, sign: genre.name, titles: [{ ko: '침묵의 단서', en: 'The Silent Clue' }, { ko: '궤도 표류', en: 'Orbit Drift' }] });
      drawBookcase(fakeContext(), box(shelf), { color: genre.color, sign: genre.name, titles: ['The Silent Clue'] });
      assert.ok(ctx.calls.count > 50, `${shelf.id} drew too little`);
      drawBookcase(fakeContext(), box(shelf), { color: genre.color, sign: genre.name, titles: [] });
    }
  });

  // The First Person bookshelf maps its faces onto these same regions of the
  // art (docs/skills/2d-to-3d/SKILL.md), so the layout is the one contract
  // between the two renderers.
  test('bookcaseLayout keeps the Top-Down bookcase geometry', () => {
    const L = bookcaseLayout({ w: 124, h: 100 });
    assert.deepEqual(L.case, { x0: -59, y0: -47, x1: 59, y1: 47 });
    assert.deepEqual(L.sign, { x0: -53, y0: -43, x1: 53, y1: -28 });
    assert.deepEqual(L.back, { x0: -52, y0: -23, x1: 52, y1: 41 });
    assert.equal(L.shelves.length, 2);
    assert.deepEqual(L.shelves.map((s) => s.y), [9, 41]);
    assert.deepEqual(L.shelves[1].plank, { x0: -54, y0: 38, x1: 54, y1: 42 });
  });

  test('bookcaseLayout splits the back panel into `rows` equal rows', () => {
    const L = bookcaseLayout({ w: 124, h: 242 }, 4);
    assert.equal(L.shelves.length, 4);
    const pitch = (L.back.y1 - L.back.y0) / 4;
    L.shelves.forEach((s, r) => assert.ok(Math.abs(s.y - (L.back.y0 + (r + 1) * pitch)) < 1e-9));
    assert.equal(L.shelves.at(-1).y, L.back.y1);
  });

  test('drawBookcase draws one plank per row when given rows', () => {
    const planks = (rows) => {
      let n = 0;
      const ctx = fakeContext();
      const orig = ctx.roundRect;
      // Count the plank blocks: 4 px tall and the back panel's width + 4 (the
      // sign's shine strip is 4 px tall too, but narrower).
      const counting = new Proxy(ctx, { get: (t, k) => (k === 'roundRect' ? (x, y, w, h) => { if (h === 4 && w === 108) n++; return orig(x, y, w, h); } : t[k]) });
      drawBookcase(counting, { id: 'bookshelf-mystery', w: 124, h: 242 }, { color: '#4a4e69', sign: 'Mystery', titles: ['가'], rows });
      return n;
    };
    assert.equal(planks(undefined), 2);
    assert.equal(planks(4), 4);
  });

  /** Records [method, args] and ['set:prop', [value]] for every ctx touch. */
  function recordingContext() {
    const calls = [];
    return {
      calls,
      ctx: new Proxy({}, {
        get: (_, k) => (k === 'measureText' ? () => ({ width: 5 }) : (...a) => calls.push([k, a])),
        set: (_, k, v) => { calls.push(['set:' + k, [v]]); return true; },
      }),
    };
  }
  const rectOf = (a) => ({ x0: a[0], y0: a[1], x1: a[0] + a[2], y1: a[1] + a[3] });

  // The First Person coffee machine maps its faces onto these regions, so
  // the layout must keep Top-Down's own numbers (the 84 px station).
  test('coffeeMachineLayout keeps the Top-Down coffee machine geometry', () => {
    const L = coffeeMachineLayout({ w: 84, h: 84 });
    assert.deepEqual(L.hopper, { x0: -12, x1: 12, bx0: -7, bx1: 7, y0: -38, y1: -26 });
    assert.deepEqual(L.body, { x0: -33, y0: -26, x1: 33, y1: 34 });
    assert.deepEqual(L.band, { x0: -33, y0: -26, x1: 33, y1: -16 });
    assert.deepEqual(L.display, { x0: -10, y0: -23, x1: 10, y1: -18 });
    assert.deepEqual(L.buttons.map((b) => [b.x, b.y, b.r]), [[-25, -20.5, 2.6], [25, -20.5, 2.6]]);
    assert.deepEqual(L.bay, { x0: -27, y0: -12, x1: 27, y1: 34 });
    assert.deepEqual(L.groupHead, { x0: -9, y0: -12, x1: 9, y1: -6 });
    assert.deepEqual(L.spouts, [{ x0: -5, y0: -7, x1: -2, y1: -2 }, { x0: 2, y0: -7, x1: 5, y1: -2 }]);
    assert.deepEqual(L.cup, { x0: -8, y0: 17, x1: 8, y1: 29 });
    assert.deepEqual(L.tray, { x0: -29, y0: 29, x1: 29, y1: 34 });
    assert.deepEqual(L.steam[0], { x: -14, ys: [16, 10, 4, -1, -6] });
  });

  test('drawCoffeeMachine draws its parts from coffeeMachineLayout, also in a taller box', () => {
    for (const st of [{ w: 84, h: 84 }, { w: 84, h: 94.5 }]) {
      const L = coffeeMachineLayout(st);
      const { ctx, calls } = recordingContext();
      drawCoffeeMachine(ctx, st);
      const rounds = calls.filter(([k]) => k === 'roundRect').map(([, a]) => rectOf(a));
      for (const part of ['body', 'band', 'display', 'bay', 'groupHead', 'cup', 'coffee', 'tray']) {
        assert.ok(rounds.some((r) => ['x0', 'y0', 'x1', 'y1'].every((k) => Math.abs(r[k] - L[part][k]) < 1e-9)), `${part} @ h=${st.h}`);
      }
      const rects = calls.filter(([k]) => k === 'fillRect').map(([, a]) => rectOf(a));
      for (const s of L.spouts) assert.ok(rects.some((r) => r.x0 === s.x0 && r.y0 === s.y0 && r.x1 === s.x1 && r.y1 === s.y1));
      // The hopper's trapezoid is the first path drawn.
      const moves = calls.filter(([k]) => k === 'moveTo' || k === 'lineTo').slice(0, 4).map(([, a]) => a);
      assert.deepEqual(moves, [[L.hopper.x0, L.hopper.y0], [L.hopper.x1, L.hopper.y0], [L.hopper.bx1, L.hopper.y1], [L.hopper.bx0, L.hopper.y1]]);
      // Every colour comes from COFFEE_MACHINE_COLORS.
      const palette = new Set(Object.values(COFFEE_MACHINE_COLORS).flat());
      for (const [k, [v]] of calls) if (k === 'set:fillStyle' || k === 'set:strokeStyle') assert.ok(palette.has(v), v);
    }
  });

  test('a taller box only makes the bay taller: the top hangs from the top, the cup and tray stand on the bottom', () => {
    const a = coffeeMachineLayout({ w: 84, h: 84 });
    const b = coffeeMachineLayout({ w: 84, h: 104 });
    assert.equal(b.groupHead.y0 - b.body.y0, a.groupHead.y0 - a.body.y0);
    assert.equal(b.body.y1 - b.cup.y1, a.body.y1 - a.cup.y1);
    assert.equal(b.bay.y1 - b.bay.y0, a.bay.y1 - a.bay.y0 + 20);
    assert.equal(b.body.x1 - b.body.x0, a.body.x1 - a.body.x0);
  });

  test('drawOutOfOrderTape draws two crossed, clipped yellow strips of black stripes', () => {
    const { ctx, calls } = recordingContext();
    drawOutOfOrderTape(ctx);
    const rot = calls.filter(([k]) => k === 'rotate').map(([, a]) => a[0]);
    assert.deepEqual(rot, [-0.35, 0.35]);
    const fills = calls.filter(([k]) => k === 'set:fillStyle').map(([, a]) => a[0]);
    assert.equal(fills.filter((c) => c === OUT_OF_ORDER_TAPE_COLORS.tape).length, 2);
    assert.ok(fills.includes(OUT_OF_ORDER_TAPE_COLORS.stripe));
    assert.equal(calls.filter(([k]) => k === 'clip').length, 2);
    assert.equal(calls.filter(([k]) => k === 'save').length, calls.filter(([k]) => k === 'restore').length);
  });
});
