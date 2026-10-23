import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { BLURBS, REVIEW_QUOTES, blurbForTitle } from './book-blurbs.js';
import { TITLE_POOLS, bookTitle } from './book-titles.js';
import { GENRES } from './rules.js';

describe('back-cover descriptions', () => {
  test('every book title has its own blurb, and every blurb is for a real title', () => {
    const titles = Object.values(TITLE_POOLS).flat();
    for (const t of titles) assert.ok(BLURBS[t.en], `no blurb for ${t.en}`);
    assert.equal(Object.keys(BLURBS).length, titles.length);
    assert.equal(new Set(Object.values(BLURBS)).size, titles.length, 'blurbs should all differ');
  });

  test('blurbs are short enough for the back cover', () => {
    for (const [title, blurb] of Object.entries(BLURBS)) assert.ok(blurb.length <= 130, `${title}: ${blurb.length}`);
  });

  test('looked up by the combined Korean · English title', () => {
    const { ko, en } = TITLE_POOLS.mystery[0];
    assert.equal(blurbForTitle(bookTitle({ ko, en })), BLURBS[en]);
    assert.ok(blurbForTitle('nonsense').length > 10);
  });

  test('every genre has a review quote', () => {
    for (const g of GENRES) assert.ok(REVIEW_QUOTES[g.id]?.ko && REVIEW_QUOTES[g.id]?.en, g.id);
  });
});
