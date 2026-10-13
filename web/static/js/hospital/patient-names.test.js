import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { PATIENT_PROFILES, patientProfileFor, shortPatientName } from './patient-names.js';
import { PATIENT_DESIGN_KEYS } from './anime-people.js';

describe('patient names', () => {
  test('every patient design has a name pool and a sane age range', () => {
    for (const key of PATIENT_DESIGN_KEYS) {
      const profile = PATIENT_PROFILES[key];
      assert.ok(profile, `no names for ${key}`);
      assert.ok(profile.names.length >= 3, key);
      assert.ok(profile.ages[0] <= profile.ages[1], key);
    }
  });

  test('no full name is shared between designs', () => {
    const all = Object.values(PATIENT_PROFILES).flatMap((p) => p.names);
    assert.equal(new Set(all).size, all.length);
  });

  test('the age stays inside the design range, ends included', () => {
    assert.equal(patientProfileFor('obaachan', 0, 0).age, 74);
    assert.equal(patientProfileFor('obaachan', 0, 0.9999).age, 89);
    assert.equal(patientProfileFor('furisodeWoman', 0.5, 0.5).age, 20);
  });

  test('names already used this shift are skipped until the pool runs out', () => {
    const used = new Set(['Hana Sato', 'Chiyo Watanabe', 'Fumiko Ito']);
    assert.equal(patientProfileFor('obaachan', 0, 0, used).name, 'Setsuko Mori');
    used.add('Setsuko Mori');
    assert.ok(PATIENT_PROFILES.obaachan.names.includes(patientProfileFor('obaachan', 0.3, 0, used).name));
  });

  test('short names fit a queue chip; unknown designs still get a name', () => {
    assert.equal(shortPatientName('Hana Sato'), 'Hana S.');
    assert.equal(shortPatientName('Mel'), 'Mel');
    assert.equal(patientProfileFor('nope', 0, 0).shortName, 'Alex M.');
  });
});
