import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  bookcaseLayout,
  drawBookcase,
  drawFrontDesk,
  drawFrontDeskCounter,
  frontDeskLayout,
  drawReturnCart,
  drawReturnCartTray,
  drawReturnCartTag,
  returnCartLayout,
  returnCartDecorBooks,
  RETURN_CART_COLORS,
  drawFinesRoom,
  drawFinesPlaque,
  drawFinesCounterBase,
  drawFinesDisplay,
  drawFinesRegister,
  finesRoomLayout,
  FINES_ROOM_COLORS,
  drawBossDoor,
  drawReadingNook,
  READING_NOOK_COLORS,
  coffeeMachineLayout,
  drawCoffeeMachine,
  drawOutOfOrderTape,
  COFFEE_MACHINE_COLORS,
  OUT_OF_ORDER_TAPE_COLORS,
} from './anime-furniture.js';
import { buildStations, stationExtents } from './floor-plan.js';
import { GENRES } from './rules.js';
import { ANIME, tint } from '../hospital/anime-ui.js';

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
        get: (_, k) => (k === 'measureText' ? () => ({ width: 5 })
          : (k === 'createLinearGradient' || k === 'createRadialGradient') ? (...a) => { calls.push([k, a]); return { addColorStop: (...s) => calls.push(['addColorStop', s]) }; }
            : (...a) => calls.push([k, a])),
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

  // The First Person front desk maps its faces onto these regions, so the
  // layout must keep Top-Down's own numbers (the 124 x 84 station).
  test('frontDeskLayout keeps the Top-Down front desk geometry', () => {
    const L = frontDeskLayout({ w: 124, h: 84 });
    assert.deepEqual(L.body, { x0: -56, y0: 2, x1: 56, y1: 38 });
    assert.deepEqual(L.top, { x0: -60, y0: -6, x1: 60, y1: 4 });
    assert.deepEqual(L.monitor, { x0: -40, y0: -36, x1: 2, y1: -6 });
    assert.deepEqual(L.screen, { x0: -36, y0: -32, x1: -2, y1: -10 });
    assert.deepEqual(L.books[2], { x0: 4, y0: -26, x1: 28, y1: -19.5 });
    assert.deepEqual(L.pot, { x0: -55, y0: -18, x1: -43, y1: -5 });
    assert.equal(L.floor, 38);
  });

  test('drawFrontDesk draws its parts from frontDeskLayout', () => {
    const L = frontDeskLayout({ w: 124, h: 84 });
    const { ctx, calls } = recordingContext();
    drawFrontDesk(ctx, { w: 124, h: 84 });
    const rounds = calls.filter(([k]) => k === 'roundRect').map(([, a]) => rectOf(a));
    for (const r of [L.body, L.top, L.stand, L.monitor, L.screen, ...L.books, L.bellBase, L.pot]) {
      assert.ok(rounds.some((q) => ['x0', 'y0', 'x1', 'y1'].every((k) => Math.abs(q[k] - r[k]) < 1e-9)), JSON.stringify(r));
    }
  });

  test('drawFrontDeskCounter is a contiguous run of drawFrontDesk\'s own calls', () => {
    const whole = recordingContext();
    drawFrontDesk(whole.ctx, { w: 124, h: 84 });
    const part = recordingContext();
    drawFrontDeskCounter(part.ctx, { w: 124, h: 84 });
    const L = frontDeskLayout({ w: 124, h: 84 });
    const rounds = part.calls.filter(([k]) => k === 'roundRect').map(([, a]) => rectOf(a));
    assert.deepEqual(rounds, [L.body, L.top]);
    const a = JSON.stringify(whole.calls);
    const b = JSON.stringify(part.calls).slice(1, -1);
    assert.ok(part.calls.length > 0 && a.includes(b), 'the counter\'s calls appear in order, unbroken, in drawFrontDesk');
  });

  // The First Person fines counter maps its faces onto these regions, so the
  // layout must keep Top-Down's own numbers (the 130 x 130 room).
  test('finesRoomLayout keeps the Top-Down fines counter geometry', () => {
    const L = finesRoomLayout({ w: 130, h: 130 });
    assert.deepEqual(L.plaque, { x0: -36, y0: -57, x1: 36, y1: -40 });
    assert.deepEqual(L.body, { x0: -53, y0: 12, x1: 53, y1: 55 });
    assert.deepEqual(L.top, { x0: -57, y0: 6, x1: 57, y1: 15 });
    assert.deepEqual(L.housing, { x0: -8, y0: -22, x1: 22, y1: -13 });
    assert.deepEqual(L.display, { x0: -5, y0: -20.5, x1: 13, y1: -15 });
    assert.deepEqual(L.register, { x0: -14, y0: -14, x1: 26, y1: 6 });
    assert.deepEqual(L.coins, [{ x: -34, n: 4 }, { x: -25, n: 2 }]);
    assert.equal(L.coinBase, 4);
    assert.equal(L.coinPitch, 3.6);
    assert.equal(L.coinR, 5);
    assert.equal(L.floor, 55);
  });

  test('drawFinesRoom draws its parts from finesRoomLayout', () => {
    const L = finesRoomLayout({ w: 130, h: 130 });
    const { ctx, calls } = recordingContext();
    drawFinesRoom(ctx, { w: 130, h: 130 });
    const rounds = calls.filter(([k]) => k === 'roundRect').map(([, a]) => rectOf(a));
    for (const r of [L.plaque, L.body, L.top, L.housing, L.display, L.register]) {
      assert.ok(rounds.some((q) => ['x0', 'y0', 'x1', 'y1'].every((k) => Math.abs(q[k] - r[k]) < 1e-9)), JSON.stringify(r));
    }
    const coins = calls.filter(([k]) => k === 'ellipse').map(([, a]) => [a[0], a[1], a[2]]);
    const want = L.coins.flatMap(({ x, n }) => Array.from({ length: n }, (_, i) => [x, L.coinBase - i * L.coinPitch, L.coinR]));
    assert.deepEqual(coins, want);
    assert.equal(coins.length, 6);
    // The flat fills of the parts are FINES_ROOM_COLORS' (the blocks' are gradients of them).
    const fills = new Set(calls.filter(([k]) => k === 'set:fillStyle').map(([, [v]]) => v));
    for (const c of ['display', 'keys', 'coin', 'coinDeep']) assert.ok(fills.has(FINES_ROOM_COLORS[c]), c);
  });

  // First Person repaints each textured part alone, clipped to its region, so
  // each helper must be exactly the drawer's own unbroken run of calls.
  test('the fines part helpers are contiguous runs of drawFinesRoom\'s own calls', () => {
    const st = { w: 130, h: 130 };
    const L = finesRoomLayout(st);
    const whole = JSON.stringify((() => { const r = recordingContext(); drawFinesRoom(r.ctx, st); return r.calls; })());
    for (const [draw, parts] of [
      [drawFinesPlaque, [L.plaque]],
      [drawFinesCounterBase, [L.body, L.top]],
      [drawFinesDisplay, [L.housing, L.display]],
      [drawFinesRegister, [L.register]],
    ]) {
      const part = recordingContext();
      draw(part.ctx, st);
      assert.deepEqual(part.calls.filter(([k]) => k === 'roundRect').map(([, a]) => rectOf(a)), parts, draw.name);
      assert.ok(part.calls.length > 0 && whole.includes(JSON.stringify(part.calls).slice(1, -1)), `${draw.name} is unbroken in drawFinesRoom`);
    }
  });

  // The First Person return cart maps its faces onto these regions, so the
  // layout must keep Top-Down's own numbers (the 84 x 84 station).
  test('returnCartLayout keeps the Top-Down return cart geometry', () => {
    const L = returnCartLayout({ w: 84, h: 84 });
    assert.deepEqual(L, {
      trays: [{ x0: -33, y0: -3, x1: 33, y1: 2 }, { x0: -33, y0: 17, x1: 33, y1: 22 }],
      tag: { x0: -26, y0: -37, x1: 26, y1: -23 },
      bookX0: -28,
      bookPitch: 9,
      bookW: 7.5,
      posts: [-32, 32],
      wheels: [{ x: -26, y: 32, r: 5 }, { x: 26, y: 32, r: 5 }],
      hubR: 1.8,
    });
  });

  test('returnCartDecorBooks: 6 on the upper tray, 5 on the lower in the 2D\'s colour order and stepped heights', () => {
    const B = RETURN_CART_COLORS.books;
    assert.deepEqual(RETURN_CART_COLORS.books, [ANIME.coral, ANIME.sky, ANIME.gold, ANIME.mint, ANIME.lavender, ANIME.pink]);
    assert.deepEqual(returnCartDecorBooks(0).map((b) => b.color), B);
    const lower = returnCartDecorBooks(1);
    assert.equal(lower.length, 5);
    assert.deepEqual(lower.map((b) => b.color), [2, 3, 4, 5, 0].map((i) => B[i]));
    assert.deepEqual(lower.map((b) => b.h), [13, 15, 17, 14, 16]);
  });

  test('drawReturnCart draws its trays and tag from returnCartLayout, and the RETURNS lettering', () => {
    const st = { w: 84, h: 84 };
    const L = returnCartLayout(st);
    const { ctx, calls } = recordingContext();
    drawReturnCart(ctx, st);
    const rounds = calls.filter(([k]) => k === 'roundRect').map(([, a]) => rectOf(a));
    for (const r of [...L.trays, L.tag]) {
      assert.ok(rounds.some((q) => ['x0', 'y0', 'x1', 'y1'].every((k) => Math.abs(q[k] - r[k]) < 1e-9)), JSON.stringify(r));
    }
    assert.ok(calls.some(([k, a]) => k === 'fillText' && a[0] === 'RETURNS'));
    const fills = new Set(calls.filter(([k]) => k === 'set:fillStyle').map(([, [v]]) => v));
    for (const c of ['tag', 'tagInk', 'wheel', 'hub']) assert.ok(fills.has(RETURN_CART_COLORS[c]), c);
  });

  // First Person repaints each textured part alone, clipped to its region, so
  // each helper must be exactly the drawer's own unbroken run of calls.
  test('the return cart part helpers are contiguous runs of drawReturnCart\'s own calls', () => {
    const st = { w: 84, h: 84 };
    const L = returnCartLayout(st);
    const whole = JSON.stringify((() => { const r = recordingContext(); drawReturnCart(r.ctx, st); return r.calls; })());
    for (const [draw, parts] of [
      [(c) => drawReturnCartTray(c, st, 0), [L.trays[0]]],
      [(c) => drawReturnCartTray(c, st, 1), [L.trays[1]]],
      [(c) => drawReturnCartTag(c, st), [L.tag]],
    ]) {
      const part = recordingContext();
      draw(part.ctx);
      assert.deepEqual(part.calls.filter(([k]) => k === 'roundRect').map(([, a]) => rectOf(a)), parts);
      assert.ok(part.calls.length > 0 && whole.includes(JSON.stringify(part.calls).slice(1, -1)), `${JSON.stringify(parts)} is unbroken in drawReturnCart`);
    }
  });

  // The First Person Reading Nook builds in these colours, so the drawer must
  // paint with exactly them: its flat fills and strokes are table values, and
  // its blocks' gradients are block()'s two tints of one. The heart on the
  // chair (ANIME.pinkDeep) and the lamp's glow (rgba stops) are overlays the
  // mesh doesn't model.
  test('drawReadingNook draws in READING_NOOK_COLORS', () => {
    const C = READING_NOOK_COLORS;
    assert.deepEqual(C, {
      rug: ANIME.lavender, chair: ANIME.pink, arm: tint(ANIME.pink, -0.12), cushion: tint(ANIME.pink, 0.2),
      leg: '#8a6a4a', book: '#ffffff', pole: ANIME.ink, base: '#5a5a78', shade: ANIME.gold,
    });
    const palette = new Set(Object.values(C));
    const { ctx, calls } = recordingContext();
    drawReadingNook(ctx, { w: 84, h: 84 });
    const styles = calls.filter(([k]) => k === 'set:fillStyle' || k === 'set:strokeStyle').map(([, [v]]) => v);
    const flatStyles = styles.filter((v) => typeof v === 'string');
    assert.ok(styles.length - flatStyles.length >= 5, 'the blocks and the glow are gradients');
    for (const v of flatStyles) assert.ok(palette.has(v) || v === ANIME.pinkDeep, v);
    const tints = new Set(Object.values(C).flatMap((c) => [tint(c, 0.22), tint(c, -0.06)]));
    for (const [, [, c]] of calls.filter(([k]) => k === 'addColorStop')) assert.ok(tints.has(c) || c.startsWith('rgba('), c);
    for (const c of ['rug', 'leg', 'book', 'pole', 'base', 'shade']) assert.ok(flatStyles.includes(C[c]), c);
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
