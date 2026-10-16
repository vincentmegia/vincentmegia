import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
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

  test('every genre bookcase draws, with titles or without', () => {
    for (const shelf of buildStations(GENRES).filter((st) => st.kind === 'bookshelf')) {
      const genre = GENRES.find((g) => g.id === shelf.genreId);
      const ctx = fakeContext();
      drawBookcase(ctx, box(shelf), { color: genre.color, sign: genre.name, titles: ['The Silent Clue', 'Orbit Drift'] });
      assert.ok(ctx.calls.count > 50, `${shelf.id} drew too little`);
      drawBookcase(fakeContext(), box(shelf), { color: genre.color, sign: genre.name, titles: [] });
    }
  });
});
