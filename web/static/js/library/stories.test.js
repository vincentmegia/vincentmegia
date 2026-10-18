import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { READING_STORIES, STORY_PAGE_COUNT, STORY_PAGE_MAX_CHARS } from './stories.js';
import { READING_PAGES } from './rules.js';

describe('Reading Nook stories', () => {
  test('there are several stories with distinct titles', () => {
    assert.ok(READING_STORIES.length >= 3);
    const titles = READING_STORIES.map((s) => s.title);
    assert.equal(new Set(titles).size, titles.length);
  });

  test('every story has a Korean title too', () => {
    for (const story of READING_STORIES) assert.match(story.koTitle ?? '', /[\uac00-\ud7a3]/, story.title);
  });

  test('every story fills exactly READING_PAGES two-page spreads', () => {
    assert.equal(STORY_PAGE_COUNT, READING_PAGES * 2);
    for (const story of READING_STORIES) {
      assert.equal(story.pages.length, STORY_PAGE_COUNT, story.title);
    }
  });

  test('every page is non-empty and short enough to fit the drawn page', () => {
    for (const story of READING_STORIES) {
      story.pages.forEach((page, i) => {
        assert.ok(page.trim().length > 0, `${story.title} p${i + 1} is empty`);
        assert.ok(page.length <= STORY_PAGE_MAX_CHARS, `${story.title} p${i + 1} is ${page.length} chars`);
      });
    }
  });
});

describe('readable books on the shelves', () => {
  test('every genre shelf holds exactly one readable story', async () => {
    const { GENRES } = await import('./rules.js');
    const { READING_STORIES, storyIndexForGenre } = await import('./stories.js');
    for (const genre of GENRES) {
      const i = storyIndexForGenre(genre.id);
      assert.ok(i >= 0, `${genre.id} has no story`);
      assert.equal(READING_STORIES.filter((s) => s.genreId === genre.id).length, 1);
    }
    assert.equal(storyIndexForGenre('nope'), -1);
  });
});
