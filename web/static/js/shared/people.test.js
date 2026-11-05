import { test } from 'node:test';
import assert from 'node:assert/strict';

import { hairTones, skinTones } from './people.js';

test('hairTones derives four tones from one colour', () => {
  assert.deepEqual(hairTones('#6a3e2a'), {
    base: '#6a3e2a',
    mid: '#856150',
    deep: '#482a1d',
    shine: '#ad958a',
  });
});

test('skinTones derives three tones from one colour', () => {
  assert.deepEqual(skinTones('#efc49f'), {
    skin: '#efc49f',
    shade: '#d7b08f',
    deep: '#ba997c',
  });
});
