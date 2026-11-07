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
});
