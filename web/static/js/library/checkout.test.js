import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  createCheckout, updateScan, updateWrite, updateStamp, pressStamp, barcodePosition, inArc, stampArcWidth,
  dueDateStrokes, dueDateText, writeProgress, GLYPHS, SCAN_HOLD_SECONDS, SCAN_RADIUS, SCAN_BOOK, WRITE_SLIP, WRITE_SPACING, STAMP_ARC,
} from './checkout.js';
import { seededRandom } from './rules.js';

const fresh = (seed = 1, opts) => createCheckout(seededRandom(seed), { dueText: '11/05', ...opts });

/** Holds the scanner on the barcode (following its drift) for `seconds`. */
function holdOnBarcode(scene, seconds, { from = 0, dt = 1 / 60, offset = 0 } = {}) {
  let s = scene;
  for (let t = from; t < from + seconds; t += dt) {
    const code = barcodePosition(s, t);
    s = updateScan(s, { x: code.x + offset, y: code.y }, dt, t);
  }
  return s;
}

describe('checkout: scan', () => {
  test('the barcode sits on the book, and the book drifts', () => {
    const s = fresh();
    const a = barcodePosition(s, 0);
    const b = barcodePosition(s, 2);
    assert.ok(a.x > SCAN_BOOK.x && a.x < SCAN_BOOK.x + SCAN_BOOK.w + 20);
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 1, 'it should drift');
  });

  test('held steady on the barcode long enough, it beeps and moves on to writing', () => {
    const s = holdOnBarcode(fresh(), SCAN_HOLD_SECONDS + 0.1);
    assert.equal(s.step, 'write');
  });

  test('off the barcode, or swiping across it, it never beeps', () => {
    assert.equal(holdOnBarcode(fresh(), 3, { offset: SCAN_RADIUS * 3 }).step, 'scan');
    // Swiping fast across the barcode, back and forth.
    let s = fresh();
    for (let i = 0, t = 0; i < 300; i++, t += 1 / 60) {
      const code = barcodePosition(s, t);
      s = updateScan(s, { x: code.x + (i % 2 ? 6 : -6), y: code.y }, 1 / 60, t);
    }
    assert.equal(s.step, 'scan');
  });

  test('wandering off drains the hold', () => {
    let s = holdOnBarcode(fresh(), SCAN_HOLD_SECONDS * 0.6);
    const held = s.scanHold;
    s = holdOnBarcode(s, 0.2, { from: 1, offset: 80 });
    assert.ok(s.scanHold < held);
  });

  test('shaky hands shrink the target', () => {
    const shaky = fresh(1, { zoneScale: 0.5 });
    // Just outside half the radius: fine normally, too far when shaky.
    const off = SCAN_RADIUS * 0.75;
    assert.equal(holdOnBarcode(fresh(), 2, { offset: off }).step, 'write');
    assert.equal(holdOnBarcode(shaky, 2, { offset: off }).step, 'scan');
  });
});

describe('checkout: write the due date', () => {
  const atWrite = (dueText = '11/05') => ({ ...fresh(1, { dueText }), step: 'write' });
  /** Traces strokes [from, to) with the pen down. */
  const trace = (scene, from = 0, to = scene.strokes.length) => {
    let s = scene;
    for (const stroke of scene.strokes.slice(from, to)) {
      for (const p of stroke) s = updateWrite(s, p, true);
      s = updateWrite(s, null, false);
    }
    return s;
  };

  test('the due date is two weeks out, as M/D', () => {
    assert.equal(dueDateText(new Date(2026, 9, 22)), '11/5');
    assert.equal(dueDateText(new Date(2026, 11, 25)), '1/8');
  });

  test('every digit and the slash has strokes, and the date fits on the slip', () => {
    for (const c of '0123456789/') assert.ok(GLYPHS[c]?.length, c);
    const strokes = dueDateStrokes('12/28');
    assert.ok(strokes.length >= 5);
    for (const stroke of strokes) {
      for (const p of stroke) {
        assert.ok(p.x > WRITE_SLIP.x && p.x < WRITE_SLIP.x + WRITE_SLIP.w, `x ${p.x}`);
        assert.ok(p.y > WRITE_SLIP.y && p.y < WRITE_SLIP.y + WRITE_SLIP.h, `y ${p.y}`);
      }
      // Evenly sampled, so the pen can't skip ahead.
      for (let i = 1; i < stroke.length; i++) assert.ok(Math.hypot(stroke[i].x - stroke[i - 1].x, stroke[i].y - stroke[i - 1].y) <= WRITE_SPACING + 0.5);
    }
  });

  test('writing every stroke, lifting the pen between them, moves on to the stamp', () => {
    const s = trace(atWrite());
    assert.equal(s.step, 'stamp');
    assert.equal(s.smudges, 0);
    assert.equal(writeProgress(s), 1);
  });

  test('strokes go in order: touching a later one does nothing', () => {
    let s = atWrite();
    s = updateWrite(s, s.strokes[2][0], true);
    assert.equal(s.stroke, 0);
    assert.equal(s.inked, 0);
  });

  test('straying off a stroke smudges just that stroke', () => {
    let s = trace(atWrite(), 0, 2);
    assert.equal(s.stroke, 2);
    const stroke = s.strokes[2];
    for (const p of stroke.slice(0, 5)) s = updateWrite(s, p, true);
    s = updateWrite(s, { x: stroke[4].x + 60, y: stroke[4].y + 60 }, true);
    assert.equal(s.stroke, 2, 'earlier strokes stay written');
    assert.equal(s.inked, 0);
    assert.equal(s.smudges, 1);
  });
});

describe('checkout: stamp (circle skill check)', () => {
  const atStamp = (opts) => ({ ...fresh(3, opts), step: 'stamp' });

  test('arcs wrap round 12 o’clock', () => {
    assert.ok(inArc(0.1, 6.2, 0.4));
    assert.ok(!inArc(1, 6.2, 0.4));
  });

  test('the needle turns', () => {
    const s = atStamp();
    assert.notEqual(updateStamp(s, 0.2).needle, s.needle);
  });

  test('pressing inside the arc finishes the checkout', () => {
    const s = atStamp();
    const { scene, hit } = pressStamp({ ...s, needle: s.target + stampArcWidth(s) / 2 }, seededRandom(4));
    assert.equal(hit, true);
    assert.equal(scene.step, 'done');
  });

  test('a miss counts and moves the target somewhere else', () => {
    const s = atStamp();
    const { scene, hit } = pressStamp({ ...s, needle: s.target + Math.PI }, seededRandom(4));
    assert.equal(hit, false);
    assert.equal(scene.step, 'stamp');
    assert.equal(scene.misses, 1);
    assert.notEqual(scene.target, s.target);
    // Never right under the needle.
    assert.ok(!inArc(scene.needle, scene.target, stampArcWidth(scene)));
  });

  test('shaky hands narrow the arc; later shifts spin it faster', () => {
    assert.ok(stampArcWidth(atStamp({ zoneScale: 0.5 })) < STAMP_ARC);
    const slow = updateStamp(atStamp(), 0.1).needle;
    const fast = updateStamp(atStamp({ speedScale: 1.6 }), 0.1).needle;
    assert.ok(fast - atStamp().needle > slow - atStamp().needle);
  });
});
