import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { drawDirectorSeo, isDirectorBlinkingAt } from './director-seo.js';

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

describe('Director Seo', () => {
  test('draws standing, mid-blink and walking, in detail', () => {
    for (const opts of [{ t: 1 }, { t: 0.05 }, { t: 2, walking: true, scale: 2 }]) {
      const ctx = fakeContext();
      drawDirectorSeo(ctx, 100, 200, opts);
      assert.ok(ctx.calls.count > 400, `too little drawn for ${JSON.stringify(opts)}: ${ctx.calls.count}`);
    }
  });

  test('he blinks briefly and mostly has his eyes open', () => {
    assert.equal(isDirectorBlinkingAt(0.05), true);
    assert.equal(isDirectorBlinkingAt(1), false);
    let shut = 0;
    for (let i = 0; i < 1000; i++) if (isDirectorBlinkingAt(i * 0.037)) shut++;
    assert.ok(shut > 0 && shut < 100);
  });
});
