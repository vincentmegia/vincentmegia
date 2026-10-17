// Library Shift's own characters ("make 19 more newest character and 4 more
// staff"): designs in hospital/anime-people.js's data format, drawn by its
// drawAnimePerson, but kept here so Hospital Shift's patient roster is
// unchanged. They're modern Seoul library-goers rather than Hospital's
// festival/kimono crowd. Keys are prefixed `lib` so they never collide with
// a Hospital design key.

const SKIN = {
  porcelain: '#fbe3d3',
  light: '#f6d6bd',
  warm: '#efc49f',
  tan: '#dca578',
  brown: '#b97c52',
  deep: '#8a5636',
};
const GOLD = '#e8c25a';
const SILVER = '#d6dae4';

/** Nineteen new patrons who queue at the Front Desk and Fines Counter. */
export const LIBRARY_PATRON_DESIGNS = [
  {
    key: 'libKpopFan', label: 'K-pop fan', age: 'teen', skin: SKIN.porcelain,
    hair: { color: '#c9a8e8', back: 'twintails', fringe: 'blunt' },
    eyes: { color: '#6a3a8a', style: 'big', lashes: true }, brows: 'thin', mouth: 'open',
    outfit: { kind: 'hoodie', top: '#ff8fb8', bottom: '#2e2a3a', shoes: '#ffffff' },
    extras: { headphones: '#ffffff', ribbon: '#8f7ae0' },
  },
  {
    key: 'libPermAjumma', label: 'Neighbourhood auntie', age: 'elder', skin: SKIN.warm,
    hair: { color: '#3a2a2a', back: 'bob', fringe: 'textured' },
    eyes: { color: '#4a3a2e', style: 'smile' }, brows: 'thin', mouth: 'smile',
    outfit: { kind: 'cardigan', top: '#e8709c', inner: '#fff2b8', skirt: '#4a3a5a', legs: '#d9c2b0', shoes: '#4a3a32' },
    extras: { sunhat: '#f2e2c4', handbag: '#a0522d', earrings: GOLD },
  },
  {
    key: 'libExamStudent', label: 'Exam student', age: 'teen', skin: SKIN.light,
    hair: { color: '#1b1828', back: 'short', fringe: 'messy' },
    eyes: { color: '#2e2a3a', style: 'sharp' }, brows: 'thick', mouth: 'flat',
    outfit: { kind: 'blazer', top: '#24305a', inner: '#ffffff', bottom: '#3a3a48', shoes: '#2a2226' },
    extras: { glasses: 'round', hachimaki: '#d23a4a' },
  },
  {
    key: 'libWebtoonArtist', label: 'Webtoon artist', age: 'adult', skin: SKIN.porcelain,
    hair: { color: '#2a2030', back: 'medium', fringe: 'side' },
    eyes: { color: '#3a3a5a', style: 'calm' }, brows: 'thin', mouth: 'flat',
    outfit: { kind: 'hoodie', top: '#3a3a48', bottom: '#5a5a6a', shoes: '#f2f2f2' },
    extras: { beanie: '#e8c25a', glasses: 'square' },
  },
  {
    key: 'libBarista', label: 'Café barista', age: 'adult', skin: SKIN.tan,
    hair: { color: '#3a2618', back: 'ponytail', fringe: 'side' },
    eyes: { color: '#4a2e1a', style: 'round', lashes: true }, brows: 'thin', mouth: 'smile',
    outfit: { kind: 'apron', top: '#f2ead8', apron: '#6a4a32', skirt: '#2e2a30', legs: '#e0c8b0', shoes: '#2a2226' },
    extras: { bandana: '#3fb58f' },
  },
  {
    key: 'libBadukGrandpa', label: 'Baduk grandpa', age: 'elder', skin: SKIN.warm,
    hair: { color: '#d8d6dc', back: 'short', fringe: 'parted' },
    eyes: { color: '#3a2e26', style: 'calm' }, brows: 'thick', mouth: 'smile',
    outfit: { kind: 'jacket', top: '#6a7a5a', inner: '#f2ead8', bottom: '#5a5048', shoes: '#3a2a22' },
    extras: { cap: '#4a5a3a', glasses: 'square', mustache: '#d8d6dc' },
  },
  {
    key: 'libMintTwin', label: 'Kid', age: 'kid', skin: SKIN.porcelain,
    hair: { color: '#4a2e22', back: 'twintails', fringe: 'blunt' },
    eyes: { color: '#2e6a5a', style: 'big', lashes: true }, brows: 'thin', mouth: 'open',
    outfit: { kind: 'dress', top: '#9fe3cc', skirt: '#9fe3cc', trim: '#ffffff', legs: '#ffffff', shoes: '#3fb58f' },
    extras: { bow: '#ffffff' },
  },
  {
    key: 'libScooterKid', label: 'Kid', age: 'kid', skin: SKIN.brown,
    hair: { color: '#1e1410', back: 'short', fringe: 'messy' },
    eyes: { color: '#2a1a12', style: 'big' }, brows: 'thick', mouth: 'open',
    outfit: { kind: 'tee', top: '#4fa8e0', print: '#ffd166', bottom: '#3a3a48', legs: null, shoes: '#e06a5b' },
    extras: { bikeHelmet: '#f2c94c' },
  },
  {
    key: 'libPilatesMom', label: 'Pilates mom', age: 'adult', skin: SKIN.light,
    hair: { color: '#5a3a26', back: 'ponytail', fringe: 'side' },
    eyes: { color: '#5a3a2a', style: 'round', lashes: true }, brows: 'thin', mouth: 'smile',
    outfit: { kind: 'track', top: '#c9b6e8', stripe: '#ffffff', bottom: '#8a7ab8', shoes: '#ffffff' },
    extras: { earrings: SILVER, sunglasses: true },
  },
  {
    key: 'libProfessor', label: 'Professor', age: 'elder', skin: SKIN.light,
    hair: { color: '#b8b4bc', back: 'short', fringe: 'side' },
    eyes: { color: '#3a2e26', style: 'calm' }, brows: 'thick', mouth: 'flat',
    outfit: { kind: 'suit', top: '#7a5a3e', shirt: '#f4f0e6', tie: '#8a2a3a', bottom: '#5a4a3a', shoes: '#2a1e18' },
    extras: { glasses: 'round', beard: '#b8b4bc' },
  },
  {
    key: 'libNightOwl', label: 'All-nighter', age: 'adult', skin: SKIN.porcelain,
    hair: { color: '#2a1e2a', back: 'bun', fringe: 'messy' },
    eyes: { color: '#4a3a5a', style: 'calm' }, brows: 'thin', mouth: 'flat',
    outfit: { kind: 'hoodie', top: '#8a8a98', bottom: '#3a3a48', shoes: '#2a2a2a' },
    extras: { mask: true },
  },
  {
    key: 'libCatLover', label: 'Cat lover', age: 'adult', skin: SKIN.light,
    hair: { color: '#8a5a3a', back: 'long', fringe: 'blunt' },
    eyes: { color: '#5a7a3a', style: 'big', lashes: true }, brows: 'thin', mouth: 'smile',
    outfit: { kind: 'cardigan', top: '#f2d6a8', inner: '#ffffff', skirt: '#6a5a4a', legs: '#e8d6c8', shoes: '#5a4a3a' },
    extras: { catEars: '#8a5a3a' },
  },
  {
    key: 'libBackpacker', label: 'Backpacker', age: 'adult', skin: SKIN.tan,
    hair: { color: '#c9a26a', back: 'short', fringe: 'messy' },
    eyes: { color: '#3a6a8a', style: 'round' }, brows: 'thick', mouth: 'smile',
    outfit: { kind: 'jacket', top: '#4f8a5a', inner: '#f2f2f2', bottom: '#8a7a5a', shoes: '#5a3a22' },
    extras: { bandana: '#d23a4a', beard: '#a07a4a' },
  },
  {
    key: 'libRetiredTeacher', label: 'Retired teacher', age: 'elder', skin: SKIN.porcelain,
    hair: { color: '#e6e3dc', back: 'bun', fringe: 'parted' },
    eyes: { color: '#4a3a2e', style: 'smile' }, brows: 'thin', mouth: 'smile',
    outfit: { kind: 'blouse', top: '#dbe8f6', skirt: '#4a5a7a', legs: '#e8d6c8', shoes: '#3a2a32' },
    extras: { glasses: 'round', pearls: true },
  },
  {
    key: 'libIndieGuitarist', label: 'Indie guitarist', age: 'adult', skin: SKIN.light,
    hair: { color: '#1e1a22', back: 'medium', fringe: 'messy', streaks: '#4fa8e0' },
    eyes: { color: '#2e2a3a', style: 'sharp' }, brows: 'thin', mouth: 'flat',
    outfit: { kind: 'jacket', top: '#1e1e24', inner: '#e8e8e8', bottom: '#2a2a3a', shoes: '#1e1e22' },
    extras: { earrings: SILVER },
  },
  {
    key: 'libGradStudent', label: 'Grad student', age: 'adult', skin: SKIN.deep,
    hair: { color: '#141012', back: 'bun', fringe: 'textured' },
    eyes: { color: '#2a1a12', style: 'round', lashes: true }, brows: 'thick', mouth: 'smile',
    outfit: { kind: 'cardigan', top: '#3a6a8a', inner: '#f2ead8', skirt: '#3a3a48', legs: '#5a4636', shoes: '#2a2226' },
    extras: { glasses: 'square', clip: '#ffd166' },
  },
  {
    key: 'libFlorist', label: 'Florist', age: 'adult', skin: SKIN.warm,
    hair: { color: '#6a3a22', back: 'long', fringe: 'side' },
    eyes: { color: '#5a3a2a', style: 'round', lashes: true }, brows: 'thin', mouth: 'smile',
    outfit: { kind: 'apron', top: '#ffffff', apron: '#7ab86a', skirt: '#e8c48e', legs: '#e8d2c2', shoes: '#6a4a3a' },
    extras: { flowerCrown: '#ff8fb8' },
  },
  {
    key: 'libChessKid', label: 'Chess-club kid', age: 'kid', skin: SKIN.light,
    hair: { color: '#2a1e18', back: 'short', fringe: 'side' },
    eyes: { color: '#3a2a20', style: 'round' }, brows: 'thin', mouth: 'smile',
    outfit: { kind: 'gakuran', top: '#2e3a5a', bottom: '#2e3a5a', buttons: GOLD, shoes: '#2a2226' },
    extras: { glasses: 'round' },
  },
  {
    key: 'libBookClubWitch', label: 'Book-club witch', age: 'adult', skin: SKIN.porcelain,
    hair: { color: '#5a2a6a', back: 'long', fringe: 'blunt' },
    eyes: { color: '#8a3a9a', style: 'sharp', lashes: true }, brows: 'thin', mouth: 'smile',
    outfit: { kind: 'dress', top: '#3a2a5a', skirt: '#3a2a5a', trim: '#e8c25a', legs: '#2a2232', shoes: '#1e1a22' },
    extras: { witchHat: '#2a1e3a', earrings: GOLD },
  },
];

export const LIBRARY_PATRON_DESIGN_KEYS = LIBRARY_PATRON_DESIGNS.map((d) => d.key);

/** Four new library staff who wander the floors (library-game.js's AMBIENT_STAFF). */
export const LIBRARY_STAFF_DESIGNS = {
  libJanitor: {
    key: 'libJanitor', label: 'Janitor', age: 'elder', skin: SKIN.tan,
    hair: { color: '#5a5258', back: 'short', fringe: 'textured' },
    eyes: { color: '#2a1a12', style: 'smile' }, brows: 'thick', mouth: 'smile',
    outfit: { kind: 'scrubs', top: '#5a8a9a', bottom: '#3a4a52', shoes: '#2a2a2a', vest: true },
    extras: { bandana: '#3a4a52' },
  },
  libShelver: {
    key: 'libShelver', label: 'Shelver', age: 'adult', skin: SKIN.light,
    hair: { color: '#3a2618', back: 'ponytail', fringe: 'side' },
    eyes: { color: '#3a2a1a', style: 'round', lashes: true }, brows: 'thin', mouth: 'smile',
    outfit: { kind: 'cardigan', top: '#3fb58f', inner: '#ffffff', skirt: '#2e3a5a', legs: '#e8d2c2', shoes: '#2a2226' },
    extras: { clip: '#ffd166', glasses: 'round' },
  },
  libStoryteller: {
    key: 'libStoryteller', label: 'Storyteller', age: 'adult', skin: SKIN.warm,
    hair: { color: '#8a4a2a', back: 'bob', fringe: 'blunt' },
    eyes: { color: '#5a3a2a', style: 'big', lashes: true }, brows: 'thin', mouth: 'open',
    outfit: { kind: 'apron', top: '#ffd166', apron: '#ff8fb8', skirt: '#4fa8e0', legs: '#ffffff', shoes: '#e8558f' },
    extras: { beret: '#e8558f' },
  },
  libArchivist: {
    key: 'libArchivist', label: 'Archivist', age: 'elder', skin: SKIN.light,
    hair: { color: '#9a969e', back: 'short', fringe: 'side' },
    eyes: { color: '#3a2e26', style: 'calm' }, brows: 'thick', mouth: 'flat',
    outfit: { kind: 'labcoat', top: '#f4f0e6', shirt: '#8a6a4a', tie: '#2e3a5a', bottom: '#4a4038', shoes: '#2a1e18' },
    extras: { glasses: 'square', mustache: '#9a969e' },
  },
};

/** A Library Shift-only design by key, or null. */
export function findLibraryDesign(key) {
  return LIBRARY_STAFF_DESIGNS[key] ?? LIBRARY_PATRON_DESIGNS.find((d) => d.key === key) ?? null;
}
