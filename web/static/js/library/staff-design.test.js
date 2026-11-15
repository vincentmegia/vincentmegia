import test from 'node:test';
import assert from 'node:assert/strict';
import { LIBRARY_STAFF_DESIGNS, LIBRARY_STAFF_DESIGN_KEYS, findStaffDesign } from './library-people.js';
import { buildCharacter } from './three-d/meshes/character.js';
import { paletteFor } from './three-d/meshes/character-palette.js';

const EXPECTED_KEYS = ['guard', 'volunteer', 'minjun', 'libJanitor', 'libShelver', 'libStoryteller', 'libArchivist', 'jiho'];

test('every ambient-staff key has a design', () => {
  for (const key of EXPECTED_KEYS) {
    const d = findStaffDesign(key);
    assert.ok(d, `findStaffDesign("${key}") returned null`);
    assert.equal(d.key, key);
  }
});

test('LIBRARY_STAFF_DESIGN_KEYS matches EXPECTED_KEYS', () => {
  assert.deepEqual([...LIBRARY_STAFF_DESIGN_KEYS].sort(), [...EXPECTED_KEYS].sort());
});

test('each design has required fields', () => {
  for (const d of LIBRARY_STAFF_DESIGNS) {
    assert.ok(typeof d.key === 'string', `key: ${d.key}`);
    assert.ok(typeof d.label === 'string', `label missing for ${d.key}`);
    assert.ok(typeof d.skin === 'string', `skin should be a hex string for ${d.key}`);
    assert.ok(d.skin.startsWith('#'), `skin should start with # for ${d.key}`);
    assert.ok(d.hair && typeof d.hair.color === 'string', `hair.color for ${d.key}`);
    assert.ok(d.eyes && typeof d.eyes.color === 'string', `eyes.color for ${d.key}`);
    assert.ok(typeof d.brows === 'string', `brows for ${d.key}`);
    assert.ok(typeof d.mouth === 'string', `mouth for ${d.key}`);
    assert.ok(d.outfit && typeof d.outfit.kind === 'string', `outfit.kind for ${d.key}`);
    assert.ok(['teen', 'adult', 'elder'].includes(d.age), `age for ${d.key}`);
  }
});

test('buildCharacter succeeds for each staff design', () => {
  for (const d of LIBRARY_STAFF_DESIGNS) {
    const mesh = buildCharacter(d);
    assert.ok(mesh.vertices.length > 0, `${d.key}: no vertices`);
    assert.ok(mesh.faces.length > 0, `${d.key}: no faces`);
  }
});

test('paletteFor resolves for each staff design', () => {
  for (const d of LIBRARY_STAFF_DESIGNS) {
    const p = paletteFor(d);
    assert.ok(p.skin && typeof p.skin.skin === 'string', `${d.key}: skin tone`);
    assert.ok(p.hair && typeof p.hair.base === 'string', `${d.key}: hair tone`);
    assert.ok(typeof p.top === 'string', `${d.key}: top`);
    assert.ok(typeof p.shoes === 'string', `${d.key}: shoes`);
  }
});

test('skin colour matches 2D renderer palette', () => {
  const expected = {
    guard: '#dca578',
    volunteer: '#f8dcc6',
    minjun: '#f8dcc4',
    libJanitor: '#e6b48c',
    libShelver: '#f6d6bd',
    libStoryteller: '#efc49f',
    libArchivist: '#f6d6bd',
    jiho: '#f8dcc6',
  };
  for (const [key, skin] of Object.entries(expected)) {
    const d = findStaffDesign(key);
    assert.equal(d.skin, skin, `${key} skin`);
  }
});

test('hair colour matches 2D renderer palette', () => {
  const expected = {
    guard: '#141012',
    volunteer: '#6a3e2a',
    minjun: '#2a2028',
    libJanitor: '#9a949c',
    libShelver: '#5a3420',
    libStoryteller: '#8a4a2a',
    libArchivist: '#c8c6cc',
    jiho: '#4a2e22',
  };
  for (const [key, color] of Object.entries(expected)) {
    const d = findStaffDesign(key);
    assert.equal(d.hair.color, color, `${key} hair`);
  }
});

test('outfit primary colour matches 2D renderer palette', () => {
  const expected = {
    guard: '#2e3a5a',       // jacket
    volunteer: '#3f7a6a',   // vest
    minjun: '#2d3a64',      // vest
    libJanitor: '#4e6270',  // vest
    libShelver: '#3fb58f',  // cardigan
    libStoryteller: '#ffd166', // top
    libArchivist: '#f4f0e6', // coat
    jiho: '#22305a',        // blazer
  };
  for (const [key, top] of Object.entries(expected)) {
    const d = findStaffDesign(key);
    assert.equal(d.outfit.top, top, `${key} outfit.top`);
  }
});

test('findStaffDesign returns null for unknown keys', () => {
  assert.equal(findStaffDesign('unknown'), null);
  assert.equal(findStaffDesign('karen'), null);
});
