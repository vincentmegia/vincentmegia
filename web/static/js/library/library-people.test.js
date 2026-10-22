import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { LIBRARY_PATRON_DESIGNS, LIBRARY_PATRON_DESIGN_KEYS, findLibraryDesign } from './library-people.js';
import { PATIENT_DESIGN_KEYS, STAFF_DESIGNS } from '../hospital/anime-people.js';
import { drawPatron } from './patron.js';
import { PROPS } from './patron-props.js';
import { GENRES } from './rules.js';

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

describe("Library Shift's own characters", () => {
  test('there are 66 patrons (77 characters in all, like Hospital Shift), all with unique keys', () => {
    assert.equal(LIBRARY_PATRON_DESIGNS.length, 66);
    const keys = [...LIBRARY_PATRON_DESIGN_KEYS];
    assert.equal(new Set(keys).size, keys.length);
    for (const key of keys) {
      assert.ok(!PATIENT_DESIGN_KEYS.includes(key), `${key} collides with a Hospital patient`);
      assert.ok(!(key in STAFF_DESIGNS), `${key} collides with Hospital staff`);
    }
  });

  test('every design is complete and draws without throwing', () => {
    const all = LIBRARY_PATRON_DESIGNS;
    for (const d of all) {
      for (const field of ['key', 'label', 'age', 'skin', 'hair', 'eyes', 'brows', 'mouth', 'outfit']) {
        assert.ok(d[field], `${d.key} is missing ${field}`);
      }
      assert.ok(d.outfit.kind && d.outfit.top && d.outfit.shoes, `${d.key} needs an outfit kind, top and shoes`);
      assert.ok(PROPS[d.prop], `${d.key} carries an unknown prop: ${d.prop}`);
      assert.ok(GENRES.some((g) => g.id === d.taste), `${d.key} has an unknown taste: ${d.taste}`);
      for (const opts of [{ t: 1 }, { t: 2, walking: true }, { t: 3, angryTint: true }]) {
        const ctx = fakeContext();
        drawPatron(ctx, 100, 200, d, { scale: 1.55, ...opts });
        assert.ok(ctx.calls.count > 400, `${d.key} drew too little for ${JSON.stringify(opts)}: ${ctx.calls.count}`);
      }
    }
  });

  test('findLibraryDesign finds patrons, and nothing else', () => {
    assert.equal(findLibraryDesign('libKpopFan').label, 'K-pop fan');
    assert.equal(findLibraryDesign('libArchivist'), null);
    assert.equal(findLibraryDesign('salaryman'), null);
  });
});
