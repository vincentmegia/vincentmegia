// Hospital Shift's patient names (docs/features/hospital-shift.md). Each
// anime patient design (anime-people.js's PATIENT_DESIGNS) has its own pool
// of names and an age range that fit how they look — a kimono'd grandma is
// a Fumiko or a Chiyo, a kid in a sakura kimono is six — instead of one
// shared list handed out at random (the user: "make the names more
// better"). Mostly Japanese to match the setting, with a few international
// names in the mix. Pure data + one picker; no DOM.

/** designKey -> { names: full names (given family), ages: [min, max] } */
export const PATIENT_PROFILES = {
  obaachan: { names: ['Hana Sato', 'Chiyo Watanabe', 'Fumiko Ito', 'Setsuko Mori'], ages: [74, 89] },
  ojiichan: { names: ['Shigeru Tanaka', 'Isamu Kobayashi', 'Tadashi Kato', 'Masao Yamada'], ages: [76, 91] },
  salaryman: { names: ['Takeshi Nakamura', 'Hiroshi Suzuki', 'Daisuke Kimura', 'Kenta Hayashi'], ages: [34, 52] },
  officeLady: { names: ['Yuki Matsumoto', 'Aya Inoue', 'Mariko Shimizu', 'Nana Ogawa'], ages: [24, 38] },
  schoolgirl: { names: ['Sakura Takahashi', 'Hinata Saito', 'Mio Fujita', 'Rin Okada'], ages: [15, 17] },
  schoolboy: { names: ['Haruto Yoshida', 'Sota Ishikawa', 'Ren Maeda', 'Kaito Hasegawa'], ages: [15, 17] },
  kidBoy: { names: ['Yuto Kondo', 'Riku Endo', 'Minato Aoki', 'Leo Santos'], ages: [6, 10] },
  kidGirl: { names: ['Himari Goto', 'Emma Ishii', 'Koharu Murata', 'Mei Ueda'], ages: [5, 9] },
  yukataGirl: { names: ['Aoi Nishimura', 'Kokona Fukuda', 'Yui Ota', 'Saki Miura'], ages: [16, 19] },
  yukataMan: { names: ['Shota Takeda', 'Ryota Nakajima', 'Yusuke Harada', 'Kenji Arai'], ages: [22, 34] },
  hoodieTeen: { names: ['Rafael Mendoza', 'Arjun Mehta', 'Taiga Ono', 'Jun Abe'], ages: [14, 18] },
  pastelArtist: { names: ['Momo Hoshino', 'Rei Kanda', 'Akari Sakamoto', 'Luna Morita'], ages: [23, 31] },
  athlete: { names: ['Kana Iwasaki', 'Maya Reyes', 'Miku Sugiyama', 'Erika Kudo'], ages: [21, 33] },
  mother: { names: ['Amara Okoye', 'Grace Mensah', 'Nia Tanabe', 'Fatima Diallo'], ages: [30, 42] },
  grandmaCardigan: { names: ['Kazuko Yamaguchi', 'Toshiko Nomura', 'Haruko Ikeda', 'Michiko Sasaki'], ages: [70, 86] },
  delinquent: { names: ['Ryuji Kuroda', 'Tetsuya Ishida', 'Daiki Matsuda', 'Shin Kaneko'], ages: [19, 27] },
  // Coming-of-age day is the year you turn 20.
  furisodeWoman: { names: ['Ayaka Hirano', 'Misaki Kubo', 'Reina Taniguchi', 'Honoka Imai'], ages: [20, 20] },
  teaLady: { names: ['Keiko Ueno', 'Sachiko Noguchi', 'Yoko Kikuchi', 'Junko Arakawa'], ages: [48, 64] },
  kimonoKidGirl: { names: ['Tsumugi Kawai', 'Sana Ishihara', 'Ichika Sakai', 'Hina Oshima'], ages: [5, 8] },
  kimonoKidBoy: { names: ['Hayato Takagi', 'Asahi Hirata', 'Itsuki Kono', 'Yamato Sano'], ages: [6, 9] },
  formalMan: { names: ['Kazuya Fujiwara', 'Makoto Shibata', 'Akira Uchida', 'Noboru Kawamoto'], ages: [30, 55] },
  waveWoman: { names: ['Leilani Higa', 'Sofia Kaneshiro', 'Midori Tamura', 'Chie Oshiro'], ages: [35, 58] },
};

const FALLBACK_PROFILE = { names: ['Alex Mori'], ages: [30, 50] };

/** "Hana Sato" -> "Hana S." — what fits on a queue chip. */
export function shortPatientName(fullName) {
  const [given, ...rest] = String(fullName).trim().split(/\s+/);
  const family = rest.join(' ');
  return family ? `${given} ${family[0]}.` : given;
}

/**
 * A name and age for a patient of `designKey`. Picks from that design's
 * pool, skipping names already in `usedNames` (one shift's patients) until
 * the pool runs out. `rollName`/`rollAge` are 0..1.
 *
 * @returns {{name: string, shortName: string, age: number}}
 */
export function patientProfileFor(designKey, rollName, rollAge, usedNames = new Set()) {
  const profile = PATIENT_PROFILES[designKey] ?? FALLBACK_PROFILE;
  const fresh = profile.names.filter((n) => !usedNames.has(n));
  const pool = fresh.length ? fresh : profile.names;
  const name = pool[Math.min(pool.length - 1, Math.floor(rollName * pool.length))];
  const [min, max] = profile.ages;
  const age = min + Math.min(max - min, Math.floor(rollAge * (max - min + 1)));
  return { name, shortName: shortPatientName(name), age };
}
