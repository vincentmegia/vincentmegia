import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { drawMinjun, isBlinkingAt, MINJUN_BOOKS } from './minjun.js';

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

describe('Min-jun', () => {
  test('draws standing, mid-blink and walking, in rich detail', () => {
    for (const opts of [{}, { t: 1 }, { t: 0.05 }, { t: 2.3, walking: true, scale: 1.05 }]) {
      const ctx = fakeContext();
      drawMinjun(ctx, 100, 200, opts);
      assert.ok(ctx.calls.count > 500, `too little drawn for ${JSON.stringify(opts)}: ${ctx.calls.count}`);
    }
  });

  test('he blinks briefly, sometimes twice, but mostly has his eyes open', () => {
    assert.equal(isBlinkingAt(0.05), true);
    assert.equal(isBlinkingAt(1), false);
    assert.equal(isBlinkingAt(0.27), true, 'a double blink on the first cycle');
    assert.equal(isBlinkingAt(4.1 + 0.27), false, 'but not every cycle');
    let shut = 0;
    for (let i = 0; i < 2000; i++) if (isBlinkingAt(i * 0.031)) shut++;
    assert.ok(shut > 0 && shut < 200);
  });

  test('his books have Korean titles', () => {
    assert.equal(MINJUN_BOOKS.length, 3);
    for (const title of MINJUN_BOOKS) assert.match(title, /[가-힣]/);
  });
});
