import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { drawPatron } from './patron.js';
import { isPatronBlinkingAt, hairTones } from './patron-head.js';
import { PROPS } from './patron-props.js';
import { drawTorsoTrinkets, drawWristTrinkets, drawLegTrinkets, drawHeadTrinkets } from './patron-trinkets.js';
import { drawKaren, isKarenBlinkingAt } from './karen.js';
import { LIBRARY_PATRON_DESIGNS } from './library-people.js';

/** A canvas 2D context stand-in that counts calls and records scale()s. */
function fakeContext() {
  const calls = { count: 0, scales: [] };
  const gradient = { addColorStop() {} };
  return new Proxy({ calls }, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => gradient;
      if (key === 'scale') return (sx, sy) => { calls.count++; calls.scales.push([sx, sy]); };
      return () => { calls.count++; };
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  });
}

describe('detailed patrons', () => {
  test('every prop draws, and says how it is held', () => {
    const design = LIBRARY_PATRON_DESIGNS[0];
    for (const [name, prop] of Object.entries(PROPS)) {
      assert.ok(['raise', 'hug', 'hang', 'none'].includes(prop.pose), `${name} has pose ${prop.pose}`);
      const ctx = fakeContext();
      prop.draw(ctx, [10, -28], 1, design);
      if (prop.back) prop.drawBack(ctx, 1);
      assert.ok(ctx.calls.count > 10, `${name} drew too little`);
    }
  });

  test('props vary: every one is carried by someone, none by too many', () => {
    const counts = {};
    for (const d of LIBRARY_PATRON_DESIGNS) counts[d.prop] = (counts[d.prop] ?? 0) + 1;
    for (const name of Object.keys(PROPS)) assert.ok(counts[name], `nobody carries ${name}`);
    for (const [name, n] of Object.entries(counts)) assert.ok(n <= 7, `${name} is carried by ${n}`);
  });

  test('kids are drawn smaller, with a bigger head', () => {
    const kid = LIBRARY_PATRON_DESIGNS.find((d) => d.age === 'kid');
    const ctx = fakeContext();
    drawPatron(ctx, 0, 0, kid, { scale: 1, t: 1 });
    const [first] = ctx.calls.scales;
    assert.ok(first[0] < 0.8, `body scale ${first[0]}`);
    assert.ok(ctx.calls.scales.some(([sx]) => sx > 1.2), 'no enlarged head');
  });

  test("a queue doesn't blink in unison", () => {
    const pattern = (d) => [...Array(200).keys()].map((i) => (isPatronBlinkingAt(d, i * 0.05) ? 1 : 0)).join('');
    const patterns = LIBRARY_PATRON_DESIGNS.map(pattern);
    assert.ok(new Set(patterns).size > LIBRARY_PATRON_DESIGNS.length / 2);
    for (const p of patterns) assert.ok(p.includes('1') && p.split('1').length - 1 < 40);
  });

  test('every patron wears a few trinkets, and each one draws something', () => {
    const where = {
      torso: ['pin', 'nametag', 'lanyard', 'necklace', 'choker', 'scarf', 'patch', 'walletChain'],
      wrist: ['watch', 'bracelet', 'wristband', 'ring'],
      leg: ['socks', 'plaster'],
      head: ['glassesChain', 'earbuds', 'hairpins'],
    };
    const known = Object.values(where).flat();
    for (const d of LIBRARY_PATRON_DESIGNS) {
      assert.ok((d.trinkets ?? []).length >= 3, `${d.key} has too few trinkets`);
      for (const tr of d.trinkets) {
        assert.ok(known.includes(tr.kind), `${d.key}: unknown trinket ${tr.kind}`);
        const one = { ...d, trinkets: [tr] };
        const ctx = fakeContext();
        drawTorsoTrinkets(ctx, one);
        drawWristTrinkets(ctx, one, [-12, -20]);
        for (const dir of [-1, 1]) drawLegTrinkets(ctx, one, { knee: [dir * 3, -9], ankle: [dir * 3, 1], dir });
        drawHeadTrinkets(ctx, one);
        assert.ok(ctx.calls.count > 0, `${d.key}: ${tr.kind} drew nothing`);
      }
    }
  });

  test('hair tones are lighter and darker than the base', () => {
    const { mid, deep } = hairTones('#6a3e2a');
    const lum = (hex) => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);
    assert.ok(lum(mid) > lum('#6a3e2a'));
    assert.ok(lum(deep) < lum('#6a3e2a'));
  });
});

describe('Karen', () => {
  test('draws calm, mid-blink, angry and walking, in detail', () => {
    const blinkT = [...Array(400).keys()].map((i) => i * 0.05).find((t) => isKarenBlinkingAt(t));
    for (const opts of [{ t: 1 }, { t: blinkT }, { t: 1.1, angry: true }, { t: 2, walking: true, scale: 1.55 }]) {
      const ctx = fakeContext();
      drawKaren(ctx, 100, 200, opts);
      assert.ok(ctx.calls.count > 400, `too little for ${JSON.stringify(opts)}: ${ctx.calls.count}`);
    }
  });

  test('angry, she draws something different from calm', () => {
    const calm = fakeContext();
    drawKaren(calm, 0, 0, { t: 1 });
    const angry = fakeContext();
    drawKaren(angry, 0, 0, { t: 1, angry: true });
    assert.notEqual(calm.calls.count, angry.calls.count);
  });
});
