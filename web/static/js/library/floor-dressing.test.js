import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FLOOR_TILES, GUIDE_STRIPES, LIBRARY_SIGNS, BACK_WALL, WALL_ART, WALL_ART_IDS, ROOM_ART_SCALE,
  tileColor, blendOver, floorDecals, clockHands, paintRoomArt, roomArtRect,
  drawWallClock, drawWallBookShelf, drawWallSakura, drawLibrarySign,
} from './floor-dressing.js';
import { buildStations } from './floor-plan.js';
import { ANIME } from '../hospital/anime-ui.js';

const STATIONS = buildStations([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }]);
const GAME = readFileSync(new URL('../library-game.js', import.meta.url), 'utf8');
const drawFloorSource = () => {
  const start = GAME.indexOf('  function drawFloor() {');
  return GAME.slice(start, GAME.indexOf('\n  }\n', start));
};

// The constants are the 2D's own: Top-Down's drawFloor draws from them (not
// from copies), so First Person, which builds from them too, can't drift.
test('drawFloor paints from floor-dressing.js, with no palette of its own', () => {
  const src = drawFloorSource();
  for (const name of ['FLOOR_TILES[currentFloor]', 'GUIDE_STRIPES[currentFloor]', 'LIBRARY_SIGNS[currentFloor]', 'floorRug(currentFloor, stations)', 'drawBackWall(ctx)', 'drawWallSakura(ctx)', 'drawWallBookShelf(ctx)', 'drawWallClock(ctx']) {
    assert.ok(src.includes(name), `drawFloor uses ${name}`);
  }
  assert.doesNotMatch(src, /#[0-9a-f]{6}|rgba\(/i, 'no colour literal left in drawFloor');
  assert.match(GAME, /from '\.\/library\/floor-dressing\.js'/);
});

test('the per-floor palette: 1F mint checker, 2F cream', () => {
  assert.deepEqual(FLOOR_TILES[1], { light: '#e6f6f0', dark: '#d8efe7', sheen: 'rgba(143,211,255,0.10)' });
  assert.deepEqual(FLOOR_TILES[2], { light: '#f6efe4', dark: '#efe5d6', sheen: 'rgba(255,255,255,0.18)' });
  assert.equal(tileColor(1, 0, 0), FLOOR_TILES[1].dark);
  assert.equal(tileColor(2, 3, 5), FLOOR_TILES[2].dark);
  assert.equal(GUIDE_STRIPES[1].length, 2);
  assert.equal(GUIDE_STRIPES[2].length, 0);
  assert.equal(LIBRARY_SIGNS[1].color, ANIME.coral);
  assert.equal(LIBRARY_SIGNS[2].color, ANIME.lavender);
  assert.equal(BACK_WALL.top, '#fffaf3');
});

test('blendOver composites rgba over an opaque base', () => {
  assert.equal(blendOver('rgba(255,0,0,0.5)', '#000000'), '#800000');
  assert.equal(blendOver('rgba(255,0,0,0)', '#123456'), '#123456');
  assert.equal(blendOver('#abcdef', '#000000'), '#abcdef');
});

test('floorDecals: stripes cut at the tile grid, one rug per floor', () => {
  const d1 = floorDecals(1, STATIONS);
  const d2 = floorDecals(2, STATIONS);
  const total = (ds) => ds.filter((d) => d.id === 'stripe').reduce((a, d) => a + d.w, 0);
  // The lower stripe runs 46 px under the break-room rug (764..810), which
  // Top-Down lays over it: that part is the rug art's, not a decal.
  const rug = d1.find((d) => d.id === 'rug');
  assert.equal(rug.x, 764);
  assert.equal(total(d1), 720 + 620 - (810 - 764));
  for (const d of d1.filter((x) => x.id === 'stripe')) {
    const inside = d.x >= rug.x && d.x + d.w <= rug.x + rug.w && d.y >= rug.y && d.y + d.h <= rug.y + rug.h;
    const overlaps = d.x < rug.x + rug.w && d.x + d.w > rug.x && d.y < rug.y + rug.h && d.y + d.h > rug.y;
    assert.ok(!inside && !overlaps, `stripe piece at ${d.x},${d.y} is under the rug`);
  }
  assert.ok(d1.filter((d) => d.id === 'stripe').every((d) => Math.floor(d.x / 40) === Math.floor((d.x + d.w - 1e-9) / 40)));
  assert.equal(d1.filter((d) => d.id === 'rug').length, 1);
  assert.equal(d2.filter((d) => d.id === 'stripe').length, 0);
  assert.equal(d2.filter((d) => d.id === 'rug').length, 1);
});

test('clockHands reads the inGameTimeLabel the HUD shows', () => {
  assert.deepEqual(clockHands('3:45 PM'), { hour: 3, minute: 45 });
  assert.deepEqual(clockHands('12:00 PM'), { hour: 0, minute: 0 });
  assert.equal(clockHands(''), null);
  assert.equal(clockHands(undefined), null);
});

// A recording 2D context: every call and property write, in order.
function recorder() {
  const log = [];
  const handler = {
    get(target, prop) {
      if (prop === 'log') return log;
      if (prop === 'createLinearGradient') {
        return (...a) => {
          log.push(['createLinearGradient', ...a]);
          // A plain tag (the stop logger non-enumerable), so two recordings compare equal.
          const g = { gradient: a };
          Object.defineProperty(g, 'addColorStop', { value: (...s) => log.push(['stop', ...s]) });
          return g;
        };
      }
      if (prop === 'measureText') return () => ({ width: 10 });
      return (...a) => log.push([prop, ...a]);
    },
    set(target, prop, value) { log.push([`=${String(prop)}`, value]); return true; },
  };
  return new Proxy({}, handler);
}

// FP's art IS the 2D drawing: after its backing and the art-space transform,
// paintRoomArt makes exactly the calls Top-Down's painter makes.
test('paintRoomArt paints each wall piece with Top-Down’s own painter, inside its WALL_ART box', () => {
  const direct = {
    clock: (c) => drawWallClock(c, '10:20 AM'),
    shelf: (c) => drawWallBookShelf(c),
    sakura: (c) => drawWallSakura(c),
    sign: (c) => drawLibrarySign(c, LIBRARY_SIGNS[2].text, LIBRARY_SIGNS[2].color, LIBRARY_SIGNS[2].colorDeep),
  };
  for (const id of WALL_ART_IDS) {
    const fp = recorder();
    paintRoomArt(fp, 2, id, { stations: STATIONS, clockLabel: '10:20 AM' });
    const td = recorder();
    direct[id](td);
    const r = WALL_ART[id];
    assert.deepEqual(fp.log.slice(0, 6), [
      ['save'], ['scale', ROOM_ART_SCALE, ROOM_ART_SCALE], ['translate', -r.x, -r.y],
      ['=fillStyle', BACK_WALL.top], ['fillRect', r.x, r.y, r.w, r.h],
      ...td.log.slice(0, 1),
    ], id);
    assert.deepEqual(fp.log.slice(5, -1), td.log, `${id}: the same calls as Top-Down`);
  }
});

test('the clock art moves with the label; the rug art backs itself with the tiles', () => {
  const a = recorder();
  const b = recorder();
  paintRoomArt(a, 1, 'clock', { stations: STATIONS, clockLabel: '9:00 AM' });
  paintRoomArt(b, 1, 'clock', { stations: STATIONS, clockLabel: '9:01 AM' });
  assert.notDeepEqual(a.log, b.log);
  const rug = recorder();
  paintRoomArt(rug, 1, 'rug', { stations: STATIONS });
  // ...and the stripes between the tiles and the rug, in Top-Down's order.
  const fills = rug.log.filter((c) => c[0] === '=fillStyle').map((c) => c[1]);
  const stripeAt = fills.indexOf(GUIDE_STRIPES[1][1].fill);
  assert.ok(stripeAt > 0 && stripeAt < fills.indexOf('rgba(255,194,218,0.55)'), 'stripes painted under the rug');
  const r = roomArtRect(1, 'rug', STATIONS);
  const rects = rug.log.filter((c) => c[0] === 'fillRect');
  // Every tile under the rug is painted, covering the whole box (opaque art).
  const x0 = Math.min(...rects.map((c) => c[1])), y0 = Math.min(...rects.map((c) => c[2]));
  const x1 = Math.max(...rects.map((c) => c[1] + c[3])), y1 = Math.max(...rects.map((c) => c[2] + c[4]));
  assert.ok(x0 <= r.x && y0 <= r.y && x1 >= r.x + r.w && y1 >= r.y + r.h);
});

test('WALL_ART boxes do not overlap and contain each drawer’s stroke', () => {
  const boxes = WALL_ART_IDS.map((id) => WALL_ART[id]).sort((p, q) => p.x - q.x);
  for (let i = 1; i < boxes.length; i++) assert.ok(boxes[i - 1].x + boxes[i - 1].w <= boxes[i].x);
  // Spot-check the extents the drawers reach: the clock's rim (520 ± 22) and
  // bells (y ≥ 7), the sign's button with its 3 px drop (744..934, 12..47).
  const { clock, sign } = WALL_ART;
  assert.ok(clock.x <= 498 && clock.x + clock.w >= 542 && clock.y <= 7 && clock.y + clock.h >= 51);
  assert.ok(sign.x <= 743 && sign.x + sign.w >= 935 && sign.y <= 9 && sign.y + sign.h >= 48);
});
