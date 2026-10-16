// Library Shift's book titles, in Korean with an English translation (the
// user: "make the books with korea titles and english translates" — it's
// a Korean library). Purely decorative flavor, no gameplay stake: a book's
// `title` is the combined string `bookTitle` builds ("침묵의 단서 · The
// Silent Clue"); the renderer splits it back with `splitTitle` to draw the
// Korean large and the English smaller, and narrow places (shelf spines,
// queue chips) show just the Korean.
//
// No DOM/canvas dependencies, so it's unit-tested with `node --test`.

/** Between the Korean title and its English translation. */
export const TITLE_SEPARATOR = ' · ';

/** Per-genre pools: { ko, en } pairs. */
export const TITLE_POOLS = {
  mystery: [
    { ko: '침묵의 단서', en: 'The Silent Clue' },
    { ko: '자정의 장부', en: 'Midnight Ledger' },
    { ko: '잠긴 방', en: 'The Locked Room' },
    { ko: '조용한 알리바이', en: 'A Quiet Alibi' },
    { ko: '사라진 한 시간', en: 'The Missing Hour' },
    { ko: '재 속의 발자국', en: 'Footprints in Ash' },
    { ko: '세 번째 목격자', en: 'The Third Witness' },
    { ko: '미제 사건과 커피', en: 'Cold Case Coffee' },
  ],
  romance: [
    { ko: '두 번째 기회', en: 'Second Chances' },
    { ko: '부치지 못한 편지', en: 'The Letter Never Sent' },
    { ko: '가르드의 노을', en: 'Sunset in Gard' },
    { ko: '두고 간 우산 두 개', en: 'Two Left Umbrellas' },
    { ko: '지켜진 약속', en: 'A Promise Kept' },
    { ko: '부두의 여름', en: 'Summer at the Pier' },
    { ko: '잉크와 장미', en: 'Ink and Roses' },
    { ko: '마지막 춤', en: 'The Last Dance' },
  ],
  scifi: [
    { ko: '마지막 신호', en: 'The Last Signal' },
    { ko: '궤도 표류', en: 'Orbit Drift' },
    { ko: '제9 식민지', en: 'Colony Nine' },
    { ko: '유리 엔진', en: 'The Glass Engine' },
    { ko: '잡음 너머', en: 'Beyond the Static' },
    { ko: '피어오르는 붉은 먼지', en: 'Red Dust Rising' },
    { ko: '고요한 기계', en: 'The Quiet Machine' },
    { ko: '별빛 기록 보관소', en: 'Starlight Archive' },
  ],
  kids: [
    { ko: '용감한 아기 여우', en: 'The Brave Little Fox' },
    { ko: '용들의 잠잘 시간', en: 'Bedtime for Dragons' },
    { ko: '구름 정원', en: 'The Cloud Garden' },
    { ko: '아주 엉뚱한 하루', en: 'A Very Silly Day' },
    { ko: '꼬마 탐험가', en: 'The Tiny Explorer' },
    { ko: '펭귄 핍', en: 'Pip the Penguin' },
    { ko: '달 장화', en: 'Moon Boots' },
    { ko: '잃어버린 풍선', en: 'The Lost Balloon' },
  ],
  reference: [
    { ko: '정원사의 연감', en: "The Gardener's Almanac" },
    { ko: '완벽한 문법 안내서', en: 'Complete Grammar Guide' },
    { ko: '세계 지도책 개정판', en: 'World Atlas, Revised' },
    { ko: '새 도감', en: 'Field Guide to Birds' },
    { ko: '집수리 책', en: 'The Home Repair Book' },
    { ko: '부엌 과학', en: 'Kitchen Science' },
    { ko: '지도의 역사', en: 'A History of Maps' },
    { ko: '포켓 사전', en: 'Pocket Dictionary' },
  ],
};

/** The combined title string a book carries: Korean, then the English. */
export function bookTitle({ ko, en }) {
  return `${ko}${TITLE_SEPARATOR}${en}`;
}

/** Splits a combined title back into its Korean and English parts (a title without both is all `ko`). */
export function splitTitle(title) {
  const text = String(title ?? '');
  const at = text.indexOf(TITLE_SEPARATOR);
  if (at < 0) return { ko: text, en: '' };
  return { ko: text.slice(0, at), en: text.slice(at + TITLE_SEPARATOR.length) };
}

/** Every combined title for a genre ([] for an unknown one). */
export function titlesForGenre(genreId) {
  return (TITLE_POOLS[genreId] ?? []).map(bookTitle);
}

/** A random combined title from a genre's pool; `random` returns [0, 1). */
export function titleForGenre(genreId, random) {
  const pool = titlesForGenre(genreId);
  if (!pool.length) return 'Untitled';
  return pool[Math.floor(random() * pool.length)];
}
