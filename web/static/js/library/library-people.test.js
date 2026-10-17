import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { LIBRARY_PATRON_DESIGNS, LIBRARY_PATRON_DESIGN_KEYS, LIBRARY_STAFF_DESIGNS, findLibraryDesign } from './library-people.js';
import { drawAnimePerson, PATIENT_DESIGN_KEYS, STAFF_DESIGNS } from '../hospital/anime-people.js';

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
  test('there are 19 new patrons and 4 new staff, all with unique keys', () => {
    assert.equal(LIBRARY_PATRON_DESIGNS.length, 19);
    assert.equal(Object.keys(LIBRARY_STAFF_DESIGNS).length, 4);
    const keys = [...LIBRARY_PATRON_DESIGN_KEYS, ...Object.keys(LIBRARY_STAFF_DESIGNS)];
    assert.equal(new Set(keys).size, keys.length);
    for (const key of keys) {
      assert.ok(!PATIENT_DESIGN_KEYS.includes(key), `${key} collides with a Hospital patient`);
      assert.ok(!(key in STAFF_DESIGNS), `${key} collides with Hospital staff`);
    }
  });

  test('every design is complete and draws without throwing', () => {
    const all = [...LIBRARY_PATRON_DESIGNS, ...Object.values(LIBRARY_STAFF_DESIGNS)];
    for (const d of all) {
      for (const field of ['key', 'label', 'age', 'skin', 'hair', 'eyes', 'brows', 'mouth', 'outfit']) {
        assert.ok(d[field], `${d.key} is missing ${field}`);
      }
      assert.ok(d.outfit.kind && d.outfit.top && d.outfit.shoes, `${d.key} needs an outfit kind, top and shoes`);
      const ctx = fakeContext();
      drawAnimePerson(ctx, 100, 200, d, { scale: 1.55, t: 1 });
      assert.ok(ctx.calls.count > 100, `${d.key} drew too little`);
    }
  });

  test('findLibraryDesign finds patrons and staff, and nothing else', () => {
    assert.equal(findLibraryDesign('libKpopFan').label, 'K-pop fan');
    assert.equal(findLibraryDesign('libArchivist').label, 'Archivist');
    assert.equal(findLibraryDesign('salaryman'), null);
  });
});
