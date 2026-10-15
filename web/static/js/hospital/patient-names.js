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
  constructionWorker: { names: ['Goro Okamoto', 'Tatsuya Mizuno', 'Carlos Mendes', 'Hideo Kurata'], ages: [26, 54] },
  chef: { names: ['Emi Kitagawa', 'Rina Takano', 'Natsumi Ogura', 'Isabella Rossi'], ages: [24, 45] },
  cosplayer: { names: ['Kirara Aizawa', 'Momoka Hayase', 'Yuna Shiraishi', 'Hikari Nonaka'], ages: [16, 19] },
  monk: { names: ['Ryokan Tsuji', 'Shinkai Oda', 'Genshin Hara', 'Eisai Kuno'], ages: [58, 82] },
  grandpaCap: { names: ['Tokuzo Nagai', 'Hachiro Sakuma', 'Benjiro Imamura', 'Mitsuo Kanda'], ages: [70, 88] },
  businesswoman: { names: ['Adaeze Nwosu', 'Reiko Furuya', 'Priya Raman', 'Kaori Mikami'], ages: [32, 50] },
  fisherman: { names: ['Kwame Asante', 'Isamu Ebina', 'Jomo Kariuki', 'Tetsu Ishiguro'], ages: [30, 62] },
  punkTeen: { names: ['Akira Hoshi', 'Sora Kirishima', 'Nao Kuze', 'Riku Shindo'], ages: [15, 19] },
  idol: { names: ['Luna Amano', 'Miyu Sakurai', 'Hoshino Rei', 'Tsubasa Kaneda'], ages: [16, 19] },
  deliveryRider: { names: ['Yohei Tamaki', 'Diego Morales', 'Kenshin Ueda', 'Jiro Hamada'], ages: [21, 38] },
  kendoStudent: { names: ['Musashi Kondo', 'Kotaro Ichikawa', 'Shun Asakura', 'Ryo Tanabe'], ages: [15, 18] },
  painter: { names: ['Aiko Matsuura', 'Camille Laurent', 'Yuzuki Hirose', 'Sayaka Mori'], ages: [26, 44] },
  grandmaSunhat: { names: ['Umeko Higashi', 'Sumiko Arai', 'Fuyuko Kagawa', 'Tamae Ozaki'], ages: [68, 85] },
  surfer: { names: ['Kai Nakoa', 'Tomas Silva', 'Shoma Inagaki', 'Makoa Kalani'], ages: [20, 35] },
  officer: { names: ['Obi Nwankwo', 'Tetsuo Ikari', 'Daisuke Mabuchi', 'Samuel Adeyemi'], ages: [30, 52] },
  baker: { names: ['Haruna Kosaka', 'Chiaki Domoto', 'Mariko Ebisu', 'Elena Petrova'], ages: [25, 48] },
  tourist: { names: ['Oliver Brandt', 'Emma Lindqvist', 'Noah Fischer', 'Chloe Martin'], ages: [22, 60] },
  bookworm: { names: ['Fumika Yagi', 'Shiori Kanzaki', 'Aya Morimoto', 'Kanon Seki'], ages: [15, 18] },
  flowerGirl: { names: ['Sakura Nishida', 'Ayumi Tokunaga', 'Lily Okonkwo', 'Hana Komatsu'], ages: [5, 9] },
  gothTeen: { names: ['Kurumi Kagami', 'Yoru Tsukishima', 'Mirai Sumeragi', 'Rei Ayanami'], ages: [16, 19] },
  streetDancer: { names: ['Jayden Okafor', 'Taiga Hoshino', 'Malik Mensah', 'Shoto Kai'], ages: [15, 19] },
  scientist: { names: ['Hiroshi Agasa', 'Marie Lefort', 'Kenji Sato', 'Ingrid Holm'], ages: [38, 62] },
  beardedGrandpa: { names: ['Genzo Matsuda', 'Kichiro Oyama', 'Yasaburo Ono', 'Tomoji Kuroki'], ages: [74, 92] },
  farmer: { names: ['Kenta Inaba', 'Masaru Tanaka', 'Juan Herrera', 'Shigeo Mita'], ages: [28, 60] },
  gamerGirl: { names: ['Mika Kotobuki', 'Nanami Aoyagi', 'Kyoka Shirasaki', 'Yui Hoshikawa'], ages: [15, 19] },
  firefighter: { names: ['Daigo Kurosawa', 'Ryosuke Nagata', 'Marcus Bell', 'Takuma Iwata'], ages: [25, 45] },
  executive: { names: ['Seiji Kuramoto', 'Gonzo Takeuchi', 'Richard Hale', 'Kozo Ishimaru'], ages: [55, 72] },
  bride: { names: ['Yoko Hanazono', 'Mariana Costa', 'Asuka Kirishima', 'Nozomi Fujisaki'], ages: [24, 34] },
  momijiLady: { names: ['Kaede Akiyama', 'Momiji Tachibana', 'Ayame Saionji', 'Shizuka Hino'], ages: [30, 50] },
  goldfishKid: { names: ['Kintaro Yoshino', 'Haruki Mochizuki', 'Sota Kaneko', 'Tomo Ichinose'], ages: [5, 9] },
  kikkoGrandpa: { names: ['Kamejiro Ueno', 'Tsurukichi Hata', 'Bunzo Okada', 'Heihachi Mishima'], ages: [72, 90] },
  cyclist: { names: ['Kenji Shimano', 'Lukas Vogel', 'Takumi Kawaguchi', 'Ana Rocha'], ages: [24, 45] },
  pageantQueen: { names: ['Valentina Cruz', 'Reika Hoshizora', 'Celeste Moreau', 'Mina Takarada'], ages: [21, 28] },
  pirate: { names: ['Kaizoku Taro', 'Jack Morrow', 'Umi Sasaki', 'Anne Bonnet'], ages: [20, 35] },
  rockStar: { names: ['Ruby Kurenai', 'Axel Storm', 'Yoshiki Hayama', 'Raven Black'], ages: [22, 38] },
  wizard: { names: ['Merlina Tsukino', 'Elara Moonwell', 'Mahou Shiori', 'Luna Starling'], ages: [15, 19] },
  yogaTeacher: { names: ['Ananya Rao', 'Shanti Mendes', 'Keiko Asahina', 'Zara Okafor'], ages: [26, 44] },
  mailCarrier: { names: ['Kofi Boateng', 'Yubin Takeda', 'Pat Hollis', 'Norio Sugawara'], ages: [28, 55] },
  ramenChef: { names: ['Taishō Menma', 'Hiroki Tonkotsu', 'Goemon Ishida', 'Shoyu Kanemoto'], ages: [35, 62] },
  ballerina: { names: ['Clara Shirotori', 'Odette Minami', 'Yume Kanzaki', 'Aurora Ishii'], ages: [5, 9] },
  gardenGrandma: { names: ['Kiku Nagano', 'Rose Whitfield', 'Botan Ueshima', 'Sumire Hattori'], ages: [68, 86] },
  shiromukuBride: { names: ['Shirayuki Hanazono', 'Mashiro Tsurugaoka', 'Yukino Shirakawa', 'Sayuri Hakuba'], ages: [24, 32] },
  // The showpiece maiko always has the one name (the user: "i want it to
  // be hiko maiko").
  maiko: { names: ['Hiko Maiko'], ages: [16, 20] },
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
