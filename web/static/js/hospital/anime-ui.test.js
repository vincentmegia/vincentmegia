import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  ANIME,
  tint,
  sparkle,
  screentone,
  outlinedText,
  animeChip,
  animeCloseButton,
  animeBackdrop,
  animeWindow,
  animeButton,
  speechBubble,
  animePlate,
  animeGauge,
  animeBadge,
  animeStar,
  animeTile,
  sakuraBranch,
} from './anime-ui.js';

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

describe('tint', () => {
  test('lightens toward white and darkens toward black', () => {
    assert.equal(tint('#000000', 1), 'rgb(255,255,255)');
    assert.equal(tint('#ffffff', -1), 'rgb(0,0,0)');
    assert.equal(tint('#808080', 0), 'rgb(128,128,128)');
    assert.equal(tint('#ff0000', 0.5), 'rgb(255,128,128)');
  });

  test('leaves a non-hex color alone', () => {
    assert.equal(tint('rebeccapurple', 0.3), 'rebeccapurple');
  });
});

describe('drawing helpers', () => {
  test('every helper draws without throwing, including edge values', () => {
    const ctx = fakeContext();
    const rect = { x: 10, y: 10, w: 200, h: 120 };
    sparkle(ctx, 5, 5, 4);
    screentone(ctx, 0, 0, 50, 30);
    outlinedText(ctx, 'Hi', 0, 0);
    animeChip(ctx, 50, 50, 'Bed 1', 'bold 11px sans-serif');
    animeChip(ctx, 50, 50, 'Go', 'bold 11px sans-serif', ANIME.mintDeep, '#ffffff');
    animeChip(ctx, 50, 50, '', 'bold 11px sans-serif');
    animeCloseButton(ctx, { x: 0, y: 0, w: 28, h: 28 });
    animeBackdrop(ctx, 960, 600, 1.5);
    animeWindow(ctx, rect, { title: 'Triage', subtitle: 'Pick one', t: 2 });
    animeWindow(ctx, rect);
    animeButton(ctx, rect, 'OK');
    animeButton(ctx, rect, '');
    speechBubble(ctx, rect, { tailX: 100, tailY: 200 });
    speechBubble(ctx, rect);
    animePlate(ctx, 0, 0, 100, 20);
    for (const frac of [-1, 0, 0.5, 1, 2]) animeGauge(ctx, 0, 0, 100, 16, frac, ANIME.mint, ANIME.mintDeep);
    for (const glyph of ['heart', 'smile', 'G', null]) animeBadge(ctx, 10, 10, 9, ANIME.gold, ANIME.goldDeep, glyph);
    for (const fill of [0, 0.5, 1]) animeStar(ctx, 10, 10, 8, 4, fill);
    animeTile(ctx, 0, 0, 84, 84, 12, '#ffe0c2');
    sakuraBranch(ctx, 0, 0, 1.1);
    assert.ok(ctx.calls.count > 100);
  });
});
