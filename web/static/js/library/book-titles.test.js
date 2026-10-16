import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { TITLE_POOLS, TITLE_SEPARATOR, bookTitle, splitTitle, titlesForGenre, titleForGenre } from './book-titles.js';
import { GENRES } from './rules.js';

const HANGUL = /[가-힣]/;

describe('bilingual book titles', () => {
  test('every genre has a pool of distinct Korean titles, each with an English translation', () => {
    for (const genre of GENRES) {
      const pool = TITLE_POOLS[genre.id];
      assert.ok(pool && pool.length >= 5, `${genre.id} has a pool`);
      for (const { ko, en } of pool) {
        assert.match(ko, HANGUL, `${ko} is Korean`);
        assert.ok(en.trim().length > 0, `${ko} has an English translation`);
        assert.equal(ko.includes(TITLE_SEPARATOR) || en.includes(TITLE_SEPARATOR), false);
      }
      assert.equal(new Set(pool.map((t) => t.ko)).size, pool.length, `${genre.id} Korean titles are distinct`);
      assert.equal(new Set(pool.map((t) => t.en)).size, pool.length, `${genre.id} English titles are distinct`);
    }
  });

  test('a combined title splits back into its two parts', () => {
    const t = { ko: '침묵의 단서', en: 'The Silent Clue' };
    assert.equal(bookTitle(t), '침묵의 단서 · The Silent Clue');
    assert.deepEqual(splitTitle(bookTitle(t)), t);
    assert.deepEqual(splitTitle('Plain title'), { ko: 'Plain title', en: '' });
    assert.deepEqual(splitTitle(undefined), { ko: '', en: '' });
  });

  test('titleForGenre picks from the genre pool, combined', () => {
    assert.equal(titleForGenre('mystery', () => 0), titlesForGenre('mystery')[0]);
    assert.equal(titleForGenre('mystery', () => 0.999), titlesForGenre('mystery').at(-1));
    assert.equal(titleForGenre('nope', () => 0), 'Untitled');
    assert.deepEqual(titlesForGenre('nope'), []);
  });
});
