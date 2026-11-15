import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBook, paintReturnCartBookArt, starOverhang, BOOK_SIZE, BOOK_ART, BOOK_ART_SCALE, BOOK_PAGES, BOOK_STAR_FALLBACK,
} from './book.js';
import { RETURN_CART_BOOK_SLOTS, RETURN_CART_VISIBLE_BOOKS, buildReturnCart } from './return-cart.js';
import { RETURN_CART_COVER, returnCartStar, drawReturnCartCover } from '../../book-cover.js';
import { ANIME } from '../../../hospital/anime-ui.js';
import { buildDrawList, cameraFromPose } from '../core.js';

const ART = { width: BOOK_ART.w * BOOK_ART_SCALE, height: BOOK_ART.h * BOOK_ART_SCALE };
const RED = '#e06a5b';
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);
const bbox = (m, faces = m.faces) => [0, 1, 2].map((k) => {
  const a = faces.flatMap((f) => f.indices.map((i) => m.vertices[i][k]));
  return [Math.min(...a), Math.max(...a)];
});
const K = BOOK_SIZE.width / RETURN_CART_COVER.w;
const cover = (m) => m.faces[0];
const star = (m) => m.faces.slice(5);

test('real-world size: a 30 : 40 cover 25 cm wide, standing on its base', () => {
  const m = buildBook({ color: RED });
  const [bx, by, bz] = bbox(m);
  near(bx[0], -BOOK_SIZE.width / 2);
  near(bx[1], BOOK_SIZE.width / 2);
  near(by[0], 0);
  near(by[1], BOOK_SIZE.height);
  near(BOOK_SIZE.height / BOOK_SIZE.width, RETURN_CART_COVER.h / RETURN_CART_COVER.w);
  near(bz[1] - bz[0], BOOK_SIZE.depth);
});

test('five faces (no bottom); cover and spine in the genre colour, fore-edge and top are pages', () => {
  const m = buildBook({ color: RED });
  assert.equal(m.faces.length, 5);
  assert.equal(cover(m).color, RED);
  const on = (k, value) => m.faces.find((f) => f.indices.every((i) => Math.abs(m.vertices[i][k] - value) < 1e-12));
  assert.equal(on(0, -BOOK_SIZE.width / 2).color, RED, 'spine (-X)');
  assert.equal(on(0, BOOK_SIZE.width / 2).color, BOOK_PAGES, 'fore-edge (+X)');
  assert.equal(on(1, BOOK_SIZE.height).color, BOOK_PAGES, 'top');
  assert.equal(on(2, -BOOK_SIZE.depth / 2).color, RED, 'back');
  assert.ok(m.faces.every((f) => f.cull === true));
});

test('with art, the cover is textured, unlit and maps exactly the cover rect of the art box', () => {
  const m = buildBook({ art: ART, color: RED });
  const f = cover(m);
  assert.equal(f.texture.image, ART);
  assert.equal(f.unlit, true);
  const us = f.texture.uv.map((p) => p[0] / BOOK_ART_SCALE - BOOK_ART.w / 2);
  const vs = f.texture.uv.map((p) => p[1] / BOOK_ART_SCALE - BOOK_ART.h / 2);
  near(Math.min(...us), -RETURN_CART_COVER.w / 2);
  near(Math.max(...us), RETURN_CART_COVER.w / 2);
  near(Math.min(...vs), -RETURN_CART_COVER.h / 2);
  near(Math.max(...vs), RETURN_CART_COVER.h / 2);
  // Only the cover wears the art on a plain book; sides stay lit.
  assert.equal(m.faces.filter((x) => x.texture).length, 1);
  assert.ok(m.faces.slice(1).every((x) => !x.unlit));
});

test('the Coin Hunt star is present only when flagged', () => {
  assert.equal(buildBook({ color: RED }).faces.length, 5);
  assert.equal(buildBook({ color: RED, isCoinHunt: false, art: ART }).faces.length, 5);
  const flat = buildBook({ color: RED, isCoinHunt: true });
  assert.ok(star(flat).length > 0);
  assert.ok(star(flat).every((f) => f.color === BOOK_STAR_FALLBACK && !f.texture));
  const art = buildBook({ color: RED, isCoinHunt: true, art: ART });
  assert.equal(star(art).length, star(flat).length);
  assert.ok(star(art).every((f) => f.texture.image === ART && f.unlit && f.cull));
  assert.ok(art.faces.length <= 24, `face budget: ${art.faces.length}`);
});

test('the star overhang sits in the cover plane, outside the cover, around the 2D star\'s centre', () => {
  const m = buildBook({ color: RED, isCoinHunt: true, art: ART });
  const s = returnCartStar(-RETURN_CART_COVER.w / 2, -RETURN_CART_COVER.h / 2, RETURN_CART_COVER.w);
  const cx = s.cx * K;
  const cy = BOOK_SIZE.height / 2 - s.cy * K;
  for (const f of star(m)) {
    const p = f.indices.map((i) => m.vertices[i]);
    // Coplanar with the cover (z = front), never overlapping it.
    for (const v of p) near(v[2], BOOK_SIZE.depth / 2);
    const c = p.reduce((a, v) => [a[0] + v[0] / 4, a[1] + v[1] / 4], [0, 0]);
    assert.ok(c[0] >= BOOK_SIZE.width / 2 - 1e-9 || c[1] >= BOOK_SIZE.height - 1e-9, 'outside the cover');
    for (const v of p) assert.ok(Math.hypot(v[0] - cx, v[1] - cy) <= (s.outer + 0.6) * K + 1e-9, 'inside the star');
    // Wound counter-clockwise seen from +Z (the cover's way).
    const [a, b, d] = p;
    const crossZ = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]);
    assert.ok(crossZ > 0, 'faces +Z');
    // Its uv stays on the canvas.
    for (const [u, v] of f.texture.uv) {
      assert.ok(u >= 0 && u <= ART.width && v >= 0 && v <= ART.height);
    }
  }
  // Every overhang polygon is convex and outside the cover rect (art px).
  for (const poly of starOverhang()) {
    assert.ok(poly.every(([x, y]) => x >= RETURN_CART_COVER.w / 2 - 1e-9 || y <= -RETURN_CART_COVER.h / 2 + 1e-9));
  }
});

test('culls: the cover and star are seen from the front, not from behind', () => {
  const m = buildBook({ color: RED, isCoinHunt: true, art: ART });
  const opts = { viewport: { width: 320, height: 200 }, light: { dir: [0.35, 1, 0.25], ambient: 0.5 }, fog: null };
  const seen = (pose) => {
    const camera = cameraFromPose(pose, { eyeHeight: 10, pitch: 0, roll: 0, fov: Math.PI / 2.2, aspect: 1.6, near: 1, far: 2000 });
    return buildDrawList(camera, [{ mesh: m, placement: { pos: [0, 0, 0], yaw: 0, scale: 40 } }], opts);
  };
  assert.ok(seen({ x: 0, y: 40, facing: 0 }).some((p) => p.image === ART), 'front');
  assert.ok(!seen({ x: 0, y: -40, facing: Math.PI }).some((p) => p.image), 'culled from behind');
});

test('deterministic', () => {
  assert.deepEqual(buildBook({ color: RED, isCoinHunt: true }), buildBook({ color: RED, isCoinHunt: true }));
});

// A recording canvas: every call and assignment, with a measureText that
// fits titles the way a 0.5 em font would.
function recorder() {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (t, k) => {
      if (k in t) return t[k];
      if (k === 'measureText') return (s) => { calls.push([k, s]); return { width: s.length * 3 }; };
      if (k === 'createLinearGradient') return (...a) => { calls.push([k, ...a]); return { gradient: a, addColorStop: (...b) => calls.push(['addColorStop', ...b]) }; };
      return (...a) => calls.push([k, ...a]);
    },
    set: (t, k, v) => { calls.push(['set', k, v]); t[k] = v; return true; },
  });
  return { ctx, calls };
}

test('paintReturnCartBookArt: an opaque ink backing, the cover rect, then the Top-Down cover without its shadow', () => {
  for (const isCoinHunt of [false, true]) {
    const book = { title: '잠긴 방 · The Locked Room', color: RED, isCoinHunt };
    const { ctx, calls } = recorder();
    paintReturnCartBookArt(ctx, book);
    assert.deepEqual(calls[1], ['scale', BOOK_ART_SCALE, BOOK_ART_SCALE]);
    assert.deepEqual(calls[2], ['set', 'fillStyle', ANIME.ink]);
    assert.deepEqual(calls[3], ['fillRect', 0, 0, BOOK_ART.w, BOOK_ART.h]);
    assert.deepEqual(calls[4], ['translate', BOOK_ART.w / 2, BOOK_ART.h / 2]);
    assert.deepEqual(calls[6], ['fillRect', -15, -20, 30, 40]);
    // The rest is exactly drawReturnCartCover at the centred cover rect.
    const want = recorder();
    drawReturnCartCover(want.ctx, -15, -20, 30, 40, RED, book.title, isCoinHunt, { shadow: false });
    // (gradients are compared by their recorded calls, not their closures)
    const plain = (cs) => cs.map((c) => c.map((x) => (x && x.gradient ? ['gradient', ...x.gradient] : x)));
    assert.deepEqual(plain(calls.slice(7, calls.length - 1)), plain(want.calls));
    assert.equal(calls[calls.length - 1][0], 'restore');
    // The star is painted only on a Coin Hunt book (animeStar strokes a 10-point path).
    const lineTos = want.calls.filter((c) => c[0] === 'lineTo').length;
    assert.equal(lineTos > 0, isCoinHunt);
  }
});

test('drawReturnCartCover draws the shadow first in Top-Down, and not when asked', () => {
  const td = recorder();
  drawReturnCartCover(td.ctx, 0, 0, 30, 40, RED, 'x', false);
  assert.deepEqual(td.calls[0], ['set', 'fillStyle', 'rgba(59,42,74,0.2)']);
  const fp = recorder();
  drawReturnCartCover(fp.ctx, 0, 0, 30, 40, RED, 'x', false, { shadow: false });
  assert.deepEqual(fp.calls[0], ['set', 'fillStyle', RED]);
  assert.deepEqual(td.calls.slice(4), fp.calls);
});

test('cart slots: five, left to right, on the top tray, inside the posts', () => {
  assert.equal(RETURN_CART_BOOK_SLOTS.length, RETURN_CART_VISIBLE_BOOKS);
  assert.equal(RETURN_CART_VISIBLE_BOOKS, 5);
  const cart = buildReturnCart();
  const trayTop = Math.max(...cart.vertices.filter((v) => Math.abs(v[0]) === 0.8).map((v) => v[1]));
  for (let i = 0; i < 5; i++) {
    const [x, y] = RETURN_CART_BOOK_SLOTS[i];
    near(y, trayTop);
    if (i) assert.ok(x - RETURN_CART_BOOK_SLOTS[i - 1][0] >= BOOK_SIZE.width + 0.03, 'a gap between covers');
    assert.ok(Math.abs(x) + BOOK_SIZE.width / 2 <= 0.71, 'inside the posts');
  }
});
