import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  buildStations,
  buildDecor,
  stationsOnFloor,
  entryPointFor,
  FLOOR_1,
  FLOOR_2,
  FLOOR_OR,
  FLOOR_CAFE,
  stationAtPoint,
  standoffFor,
  approachPoint,
  clampToCanvas,
  PLAYER_START,
  PLAYER_STOP_MARGIN,
} from './floor-plan.js';

describe('floor plan', () => {
  const stations = buildStations(4);

  test('the ER on the 1st Floor, the Supply Cart alone upstairs, stairs and an elevator on both', () => {
    const kinds = (floor) => new Set(stationsOnFloor(stations, floor).map((s) => s.kind));
    for (const kind of ['office', 'triage-desk', 'med-cabinet', 'operating-room', 'coffee-machine', 'bed', 'stairs', 'elevator', 'vending-machine', 'cafeteria-door']) assert.ok(kinds(FLOOR_1).has(kind), kind);
    assert.deepEqual([...kinds(FLOOR_CAFE)].sort(), ['cafe-counter', 'cafe-door']);
    assert.deepEqual([...kinds(FLOOR_2)].sort(), ['battery-shelf', 'elevator', 'implant-shelf', 'stairs', 'supply-cart']);
    assert.deepEqual([...kinds(FLOOR_OR)].sort(), ['instrument-tray', 'or-door', 'or-table', 'organ-cooler']);
    assert.deepEqual(stations.filter((s) => s.kind === 'bed').map((s) => s.bedIndex), [0, 1, 2, 3]);
    assert.ok(stations.every((s) => [FLOOR_1, FLOOR_2, FLOOR_OR, FLOOR_CAFE].includes(s.floor)));
  });

  test('stairs and elevator lead to the other floor from the same spot', () => {
    for (const kind of ['stairs', 'elevator']) {
      const [a, b] = stations.filter((s) => s.kind === kind);
      assert.deepEqual([a.x, a.y], [b.x, b.y]);
      assert.equal(a.targetFloor, b.floor);
      assert.equal(b.targetFloor, a.floor);
    }
  });

  test('you land beside the fixture you used, clear of every station', () => {
    // Where each way in lands: the stairs/elevator/button on either floor,
    // the OR door's two sides on their own floors.
    const floorsFor = { stairs: [FLOOR_1, FLOOR_2], elevator: [FLOOR_1, FLOOR_2], button: [FLOOR_1, FLOOR_2], 'or-enter': [FLOOR_OR], 'or-exit': [FLOOR_1], 'cafe-enter': [FLOOR_CAFE], 'cafe-exit': [FLOOR_1] };
    for (const [via, floors] of Object.entries(floorsFor)) {
      const p = entryPointFor(via);
      for (const floor of floors) assert.equal(stationAtPoint(p.x, p.y, stationsOnFloor(stations, floor)), null, `${via} on floor ${floor}`);
    }
  });

  test('stations fit on the canvas and never overlap', () => {
    for (const s of stations) {
      assert.ok(s.x - s.w / 2 >= 0 && s.x + s.w / 2 <= CANVAS_WIDTH, s.id);
      assert.ok(s.y - s.h / 2 >= 0 && s.y + s.h / 2 <= CANVAS_HEIGHT, s.id);
    }
    for (let i = 0; i < stations.length; i++) {
      for (let j = i + 1; j < stations.length; j++) {
        const a = stations[i];
        const b = stations[j];
        if (a.floor !== b.floor) continue;
        const overlapX = Math.abs(a.x - b.x) < (a.w + b.w) / 2;
        const overlapY = Math.abs(a.y - b.y) < (a.h + b.h) / 2;
        assert.ok(!(overlapX && overlapY), `${a.id} overlaps ${b.id}`);
      }
    }
  });

  test('the player starts clear of every station', () => {
    assert.equal(stationAtPoint(PLAYER_START.x, PLAYER_START.y, stationsOnFloor(stations, FLOOR_1)), null);
  });

  test('stationAtPoint hits inside a box and misses outside', () => {
    const bed = stations.find((s) => s.id === 'bed-0');
    assert.equal(stationAtPoint(bed.x, bed.y + bed.h / 2 - 1, stations), bed);
    assert.equal(stationAtPoint(bed.x, bed.y + bed.h / 2 + 1, stations), null);
  });

  test('approaching a bed from below stops just under its box', () => {
    const bed = stations.find((s) => s.id === 'bed-2');
    const standoff = standoffFor(bed, bed.x, 560);
    assert.equal(standoff, bed.h / 2 + PLAYER_STOP_MARGIN);
    const stop = approachPoint(bed.x, bed.y, bed.x, 560, standoff);
    assert.equal(stop.x, bed.x);
    assert.equal(stop.y, bed.y + standoff);
  });

  test('approaching from the side uses the half-width', () => {
    const or = stations.find((s) => s.kind === 'operating-room');
    assert.equal(standoffFor(or, or.x - 300, or.y), or.w / 2 + PLAYER_STOP_MARGIN);
  });

  test('a player already in range stays put; clampToCanvas keeps them on screen', () => {
    assert.deepEqual(approachPoint(100, 100, 110, 100, 50), { x: 110, y: 100 });
    assert.deepEqual(clampToCanvas(-50, 9999), { x: 24, y: CANVAS_HEIGHT - 24 });
  });

  test('decor sits on the canvas, clear of every station, the triage line and the player start', () => {
    const decor = buildDecor(4);
    const rectOf = (o) => ({ l: o.x - o.w / 2, r: o.x + o.w / 2, t: o.y - o.h / 2, b: o.y + o.h / 2 });
    const overlaps = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
    const desk = stations.find((st) => st.kind === 'triage-desk');
    // The triage line: up to seven 52-px slots centered under the desk (people ~50 px tall).
    const line = { l: desk.x - 3 * 52 - 22, r: desk.x + 3 * 52 + 22, t: desk.y + desk.h / 2 + 20, b: desk.y + desk.h / 2 + 106 };
    assert.ok(decor.filter((d) => d.kind === 'iv-pole').length === 4);
    for (const d of decor) {
      const r = rectOf(d);
      assert.ok(r.l >= 0 && r.r <= CANVAS_WIDTH && r.t >= 58 && r.b <= CANVAS_HEIGHT, `${d.kind} off the floor`);
      for (const st of stationsOnFloor(stations, d.floor)) {
        // A bed's curtain hangs 14 px left of its box, so give beds that margin.
        const box = rectOf(st);
        if (st.kind === 'bed') box.l -= 14;
        assert.ok(!overlaps(r, box), `${d.kind} at ${d.x},${d.y} overlaps ${st.id}`);
      }
      if (d.floor === FLOOR_1) {
        assert.ok(!overlaps(r, line), `${d.kind} blocks the triage line`);
        assert.ok(!(PLAYER_START.x > r.l && PLAYER_START.x < r.r && PLAYER_START.y > r.t && PLAYER_START.y < r.b), `${d.kind} covers the player start`);
      }
    }
  });
});
