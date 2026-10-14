import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  drawOffice,
  drawTriageDesk,
  drawMedCabinet,
  drawOperatingRoom,
  drawStairs,
  drawElevator,
  drawSupplyCart,
  drawBandageRoll,
  drawDecor,
  drawVendingStation,
  drawCafeteriaDoor,
  drawCafeDoor,
  drawCafeCounter,
  drawFoodIcon,
  drawBatteryShelf,
  drawBatteryIcon,
  DECOR_KINDS,
} from './anime-furniture.js';
import { buildStations, buildDecor } from './floor-plan.js';

/** A canvas 2D context stand-in: every method is a no-op that counts calls. */
function fakeContext() {
  const calls = { count: 0 };
  const gradient = { addColorStop() {} };
  return new Proxy({ calls }, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'measureText') return (text) => ({ width: String(text).length * 7 });
      if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => gradient;
      return () => { calls.count++; };
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  });
}

describe('anime furniture', () => {
  test('every station drawer runs at the real station sizes', () => {
    const ctx = fakeContext();
    const byKind = Object.fromEntries(buildStations(4).map((st) => [st.kind, st]));
    drawOffice(ctx, byKind.office);
    drawTriageDesk(ctx, byKind['triage-desk']);
    drawMedCabinet(ctx, byKind['med-cabinet'], { colors: ['#ff0000', '#00ff00'] });
    drawMedCabinet(ctx, byKind['med-cabinet']);
    let onTable = null;
    drawOperatingRoom(ctx, byKind['operating-room'], { drawPatientOnTable: (x, y) => { onTable = [x, y]; } });
    drawOperatingRoom(ctx, byKind['operating-room']);
    drawStairs(ctx, byKind.stairs);
    drawElevator(ctx, byKind.elevator, { t: 0.5 });
    drawSupplyCart(ctx, byKind['supply-cart']);
    drawBandageRoll(ctx, 0, 0, 0.8);
    drawVendingStation(ctx, byKind['vending-machine']);
    drawCafeteriaDoor(ctx, byKind['cafeteria-door']);
    drawCafeDoor(ctx, byKind['cafe-door']);
    let ladyAt = null;
    drawCafeCounter(ctx, byKind['cafe-counter'], { drawLady: (x, y) => { ladyAt = [x, y]; } });
    assert.deepEqual(ladyAt, [0, 22]);
    for (const id of ['onigiri', 'chips', 'candy', 'water', 'juice', 'tea', 'meal']) drawFoodIcon(ctx, 0, 0, 1, id);
    drawBatteryShelf(ctx, byKind['battery-shelf']);
    for (const c of [0, 0.3, 1]) drawBatteryIcon(ctx, 0, 0, 1, c);
    assert.deepEqual(onTable, [0, 8]);
    assert.ok(ctx.calls.count > 200);
  });

  test('every decor prop in the floor plan has a drawer', () => {
    const ctx = fakeContext();
    const decor = buildDecor(4);
    for (const d of decor) {
      assert.ok(DECOR_KINDS.includes(d.kind), `no drawer for ${d.kind}`);
      const before = ctx.calls.count;
      drawDecor(ctx, d);
      assert.ok(ctx.calls.count > before, `${d.kind} drew nothing`);
    }
    drawDecor(ctx, { kind: 'unknown', x: 0, y: 0, w: 1, h: 1 });
  });
});
