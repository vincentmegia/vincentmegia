import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { WALK_STYLES, applyWalk } from './walk-styles.js';

/** A canvas 2D context stand-in that records each method call's name. */
function fakeContext() {
  const calls = [];
  return new Proxy({ calls }, {
    get(target, key) {
      if (key in target) return target[key];
      return (...args) => { calls.push([key, ...args]); };
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  });
}

describe('walk styles', () => {
  const walkers = ['guard', 'volunteer', 'libJanitor', 'libShelver', 'libStoryteller', 'libArchivist', 'libDirector'];

  test('every staff walker has a walk, and no two share one', () => {
    for (const key of walkers) assert.ok(WALK_STYLES[key], `${key} has no walk`);
    const names = walkers.map((k) => WALK_STYLES[k].name);
    assert.equal(new Set(names).size, names.length);
  });

  test('each walk gives finite poses over a few seconds, and they differ from each other', () => {
    const traces = walkers.map((key) => {
      const out = [];
      for (let t = 0; t < 4; t += 0.37) {
        const p = WALK_STYLES[key].pose(t, 1);
        for (const v of Object.values(p)) assert.ok(Number.isFinite(v), `${key} gave ${v}`);
        out.push(JSON.stringify(p));
      }
      return out.join('|');
    });
    assert.equal(new Set(traces).size, walkers.length);
  });

  test('leaning walkers lean the way they walk', () => {
    assert.equal(WALK_STYLES.libShelver.pose(1, 1).lean, -WALK_STYLES.libShelver.pose(1, -1).lean);
  });

  test('standing still, or without a style, nothing is transformed', () => {
    const still = fakeContext();
    applyWalk(still, 'guard', 1, 1, false);
    applyWalk(still, 'nobody', 1, 1, true);
    assert.equal(still.calls.length, 0);
    const moving = fakeContext();
    applyWalk(moving, 'volunteer', 0.3, 1, true);
    assert.ok(moving.calls.some(([name]) => name === 'translate'));
  });
});
