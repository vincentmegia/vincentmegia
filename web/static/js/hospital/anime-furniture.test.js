import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  drawOffice,
  drawTriageDesk,
  drawMedCabinet,
  drawOperatingRoom,
  drawStairs,
  drawElevator,
  elevatorLayout,
  ELEVATOR_COLORS,
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

  test('elevatorLayout keeps the Top-Down geometry drawElevator always drew', () => {
    // Library's box (84) and Hospital's (92): the numbers drawElevator used
    // inline before it drew from the layout.
    for (const w of [84, 92]) {
      const half = w / 2;
      const L = elevatorLayout({ w, h: w, floor: 1, targetFloor: 2 });
      const r = (x) => [x.x, x.y, x.w, x.h];
      assert.deepEqual(r(L.indicator), [-16, -half + 5, 32, 12]);
      assert.deepEqual([L.label.x, L.label.y], [0, -half + 11.5]);
      assert.deepEqual(r(L.frame), [-28, -half + 20, 56, half * 2 - 26]);
      assert.deepEqual(L.doors.map(r), [[-25, -half + 23, 24.5, half * 2 - 32], [0.5, -half + 23, 24.5, half * 2 - 32]]);
      assert.deepEqual(L.doors.map((d) => r(d.shine)), [[-21, -half + 26, 3, half * 2 - 38], [4.5, -half + 26, 3, half * 2 - 38]]);
      assert.deepEqual(r(L.panel), [31, -8, 9, 18]);
      assert.deepEqual([L.button.cx, L.button.cy, L.button.r], [35.5, 1, 2.8]);
      // Every rect also carries its corners, for a mesh to map onto.
      for (const x of [L.indicator, L.frame, ...L.doors, L.panel, L.button]) {
        assert.equal(x.x0, x.x);
        assert.equal(x.y0, x.y);
        assert.ok(Math.abs(x.x1 - (x.x + x.w)) < 1e-12 && Math.abs(x.y1 - (x.y + x.h)) < 1e-12);
      }
      assert.ok(Math.abs(L.button.x0 - (35.5 - 2.8)) < 1e-12 && Math.abs(L.button.y1 - (1 + 2.8)) < 1e-12);
    }
  });

  test('elevatorLayout\'s optional height stretches only the vertical runs', () => {
    const L = elevatorLayout({ w: 84, h: 84 }, { height: 114 });
    assert.equal(L.indicator.y, -57 + 5);
    assert.equal(L.frame.y, -57 + 20);
    assert.equal(L.frame.y1, 51); // 6 px above the box's bottom, as in Top-Down
    assert.equal(L.doors[0].y1, 48); // 3 px of frame below the doors
    assert.equal(L.frame.x, -28); // widths never change
    assert.deepEqual([L.panel.y, L.button.cy], [-8, 1]); // the call panel stays at the centre line
  });

  test('drawElevator draws from elevatorLayout, at an optional height and pulse', () => {
    const calls = [];
    const grad = { addColorStop() {} };
    const ctx = new Proxy({}, {
      get: (_, k) => ((k === 'createLinearGradient' || k === 'createRadialGradient') ? () => grad : (...a) => calls.push([k, a])),
      set: (_, k, v) => { calls.push(['set:' + k, [v]]); return true; },
    });
    const st = { w: 84, h: 84, floor: 2, targetFloor: 1 };
    drawElevator(ctx, st, { t: 0, height: 114, pulse: 1 });
    const L = elevatorLayout(st, { height: 114 });
    const rects = calls.filter(([k]) => k === 'roundRect').map(([, a]) => a.slice(0, 4));
    const r = (x) => [x.x, x.y, x.w, x.h];
    assert.deepEqual(rects, [r(L.indicator), r(L.frame), r(L.doors[0]), r(L.doors[1]), r(L.panel)]);
    assert.deepEqual(calls.filter(([k]) => k === 'fillRect').map(([, a]) => a), L.doors.map((d) => r(d.shine)));
    assert.deepEqual(calls.find(([k]) => k === 'fillText')[1], ['▼ 1', L.label.x, L.label.y]);
    assert.deepEqual(calls.find(([k]) => k === 'arc')[1].slice(0, 3), [L.button.cx, L.button.cy, L.button.r]);
    assert.ok(calls.some(([k, a]) => k === 'set:globalAlpha' && a[0] === 1), 'pulse 1 = full glow');
    // The exported colours are the ones it paints with.
    const fills = new Set(calls.filter(([k]) => k === 'set:fillStyle').map(([, a]) => a[0]));
    for (const c of [ELEVATOR_COLORS.indicator, ELEVATOR_COLORS.text, ELEVATOR_COLORS.panel, ELEVATOR_COLORS.button, ELEVATOR_COLORS.shine]) assert.ok(fills.has(c), c);
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
