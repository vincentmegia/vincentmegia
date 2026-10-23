// The back-cover description of each Library Shift book, read while
// scanning its barcode at checkout ("when you scan the book add a
// description since it's on the back"). One blurb per title in
// book-titles.js's TITLE_POOLS (keyed by its English title), plus a short
// Korean review quote per genre for under the blurb. Purely decorative.
//
// No DOM/canvas dependencies, so it's unit-tested with `node --test`.

import { splitTitle } from './book-titles.js';

/** English title → back-cover blurb. */
export const BLURBS = {
  // Mystery
  'The Silent Clue': 'A village where no one talks, a clue no one will name, and one detective who listens to the silence.',
  'Midnight Ledger': 'Every night at twelve, a new name appears in the old bank ledger. Tonight, it is hers.',
  'The Locked Room': 'The door was bolted from the inside. The window was painted shut. So how did the diary walk out?',
  'A Quiet Alibi': 'He was at the library all evening — the librarian swears it. But the librarian is lying.',
  'The Missing Hour': 'Every clock in the house agrees on the time, except for one hour none of the guests remember.',
  'Footprints in Ash': 'After the fire, only one set of footprints leads away from the cottage. They are far too small.',
  'The Third Witness': 'Two witnesses saw the thief. The third saw something stranger — and has not spoken since.',
  'Cold Case Coffee': 'A retired detective reopens old files over terrible café coffee. The barista knows more than she says.',
  // Romance
  'Second Chances': 'Ten years after she left Seoul, she comes back for one week. He never moved away from the bakery.',
  'The Letter Never Sent': 'Found in a returned book: a love letter, never posted, addressed to the librarian’s grandmother.',
  'Sunset in Gard': 'Two rival tour guides, one coastal town, and a summer of sunsets neither of them planned to share.',
  'Two Left Umbrellas': 'Every rainy Tuesday someone leaves an umbrella at the desk. Every rainy Wednesday, someone else returns it.',
  'A Promise Kept': 'They promised to meet under the ginkgo tree in thirty years. Only one of them remembered the date.',
  'Summer at the Pier': 'A noodle stand, a broken ferry, and a summer that was supposed to be only a summer.',
  'Ink and Roses': 'A tattoo artist and a florist share a wall, a shop sign, and an increasingly complicated love story.',
  'The Last Dance': 'At the senior centre’s final ball, two old friends finally say what they should have said at twenty.',
  // Sci-Fi
  'The Last Signal': 'The colony ship’s last message took four hundred years to arrive. It is a warning, and it is for us.',
  'Orbit Drift': 'A repair drone wakes up alone on a station that is slowly falling toward a blue planet.',
  'Colony Nine': 'Colonies One to Eight went silent. The crew of Nine has started having the same dream.',
  'The Glass Engine': 'Inventors race to build an engine powered by light — and to sabotage everyone else’s.',
  'Beyond the Static': 'A radio host hears a voice between stations that answers questions no one has asked yet.',
  'Red Dust Rising': 'On Mars, a farmer finds green shoots in the red dust — and someone else’s footprints beside them.',
  'The Quiet Machine': 'The city’s helper robot has stopped helping. It just sits in the park, watching the birds.',
  'Starlight Archive': 'A library on the far side of the Moon keeps a copy of every book. One has just gone missing.',
  // Kids
  'The Brave Little Fox': 'Little Fox is scared of the dark. But tonight the moon is lost, and only Fox can find it!',
  'Bedtime for Dragons': 'How do you put a dragon to bed? A warm milk, a soft song, and no sneezing, please.',
  'The Cloud Garden': 'Mina plants a seed on a cloud and grows the fluffiest garden in the whole sky.',
  'A Very Silly Day': 'Socks on hands, cereal for dinner, and a cat who thinks she is a teacher. What a day!',
  'The Tiny Explorer': 'An ant with a backpack sets off to explore the biggest jungle of all: the back garden.',
  'Pip the Penguin': 'Pip wants to fly. Pip cannot fly. But Pip is the best swimmer in the whole wide sea.',
  'Moon Boots': 'Jun’s new boots are so bouncy that one jump takes him all the way to the Moon.',
  'The Lost Balloon': 'A red balloon floats away from the fair and makes friends all across town.',
  // Reference
  "The Gardener's Almanac": 'When to sow, when to prune, and when to sit in the sun and do nothing. Month-by-month advice.',
  'Complete Grammar Guide': 'Every rule, every exception, and a clear answer to the semicolon question at last.',
  'World Atlas, Revised': 'Two hundred maps, every country and capital, now with updated borders and ocean depths.',
  'Field Guide to Birds': 'Identify more than 400 birds by colour, song and silhouette. Fits in a coat pocket.',
  'The Home Repair Book': 'Dripping taps, squeaky doors, wobbly chairs: step-by-step fixes, with pictures.',
  'Kitchen Science': 'Why bread rises, why onions make you cry, and forty experiments you can eat afterwards.',
  'A History of Maps': 'From clay tablets to satellite images: how people drew the world, and got it wrong.',
  'Pocket Dictionary': 'Forty thousand words, clear meanings and example sentences, small enough to carry anywhere.',
};

/** A short Korean review quote (with its English meaning) for each genre, shown under the blurb. */
export const REVIEW_QUOTES = {
  mystery: { ko: '“끝까지 눈을 뗄 수 없다!”', en: 'Couldn’t look away to the very end!' },
  romance: { ko: '“마음이 따뜻해지는 이야기”', en: 'A story that warms the heart' },
  scifi: { ko: '“상상력이 놀랍다!”', en: 'Astonishing imagination!' },
  kids: { ko: '“아이들이 정말 좋아해요”', en: 'Kids really love it' },
  reference: { ko: '“꼭 필요한 한 권”', en: 'The one book you need' },
};

/** The blurb for a book `title` (the combined "ko · en" string), or a plain line if it has none. */
export function blurbForTitle(title) {
  const { en } = splitTitle(title);
  return BLURBS[en] ?? 'A Library Shift favourite. Please return it by the due date stamped inside.';
}
