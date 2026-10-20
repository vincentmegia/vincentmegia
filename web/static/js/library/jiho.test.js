import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { drawJiho, isJihoBlinkingAt } from './jiho.js';

function fakeContext() {
  const calls = { count: 0 };
  const gradient = { addColorStop() {} };
  return new Proxy({ calls }, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => gradient;
      return () => { calls.count++; };
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  });
}

describe('Han Ji-ho', () => {
  test('draws standing, mid-blink and walking, in detail', () => {
    for (const opts of [{ t: 1 }, { t: 0.05 }, { t: 2, walking: true, scale: 2 }]) {
      const ctx = fakeContext();
      drawJiho(ctx, 100, 200, opts);
      assert.ok(ctx.calls.count > 500, `too little drawn for ${JSON.stringify(opts)}: ${ctx.calls.count}`);
    }
  });

  test('he blinks, sometimes slowly, but mostly has his eyes open', () => {
    assert.equal(isJihoBlinkingAt(0.05), true);
    assert.equal(isJihoBlinkingAt(1), false);
    let shut = 0;
    for (let i = 0; i < 2000; i++) if (isJihoBlinkingAt(i * 0.031)) shut++;
    assert.ok(shut > 0 && shut < 300);
  });
});
