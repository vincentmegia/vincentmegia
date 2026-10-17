// Kimono Himura — Hospital Shift's player, drawn by her own renderer
// rather than the shared people.js body (docs/features/hospital-shift.md).
// The user asked for her to "look more beautiful like actual Japanese
// characters … better than library game and kitchen game", and for a
// kimono "something different from pink": so an anime-proportioned
// figure — slimmer body, a face with a tapered chin, big layered eyes —
// in a red furisode deepening to wine at the hem (it was indigo until the
// user asked for red), sakura on the hem and sleeves, a gold obi, long black hair with a hime fringe, a
// half-up bun with a kanzashi, and the white nurse cap.
//
// Pure canvas drawing (no DOM): `drawKimonoHimura(ctx, x, y, opts)` with
// (x, y) at her feet, matching drawPerson's anchor so labels, carried
// items and the coffee splash still line up.

export const HIMURA_PALETTE = {
  skin: '#fbe3d3',
  skinShade: '#f1c9b4',
  hair: '#1b1828',
  hairShine: '#4a4a78',
  eyeDark: '#2a1a2e',
  // Dark, reddish violet eyes with a gold pupil (the user's pick, after
  // rose, amber and a bluer violet).
  iris: '#3a1650',
  irisLight: '#6a2e86',
  pupil: '#f5c518',
  pupilLight: '#fff1a8',
  pupilDeep: '#b8800c',
  robeTop: '#c4202f',
  robeHem: '#6e1424',
  robeShade: '#5a0d18',
  collar: '#ffffff',
  obi: '#c23a3a',
  obiGold: '#e8c25a',
  obiage: '#f3b8c8',
  sakura: '#fff1f4',
  sakuraCore: '#f08aa4',
  lips: '#d0606f',
  blush: 'rgba(240,120,140,0.42)',
  cap: '#ffffff',
  capStripe: '#e06a7a',
  kanzashi: '#e0485f',
  zori: '#7a4a32',
  obiTop: '#f2d27a',
  obiBottom: '#c9982e',
  obiLine: '#9a2a2a',
  hairStrandSoft: 'rgba(74,74,120,0.55)',
  hairStrand: 'rgba(74,74,120,0.8)',
};

/**
 * Library Shift's librarian, Eun-mi, drawn by this same renderer but
 * as her own character (the user: "make the character different rather
 * than the same"): chestnut hair in a jaw-length bob with a ribbon, round
 * glasses, teal-green eyes — and, since Library Shift is a Korean library
 * ("make her wearing the official outfit of Koreans"), a hanbok instead of
 * a kimono: a pale-yellow jeogori with red cuffs, a purple collar with the
 * white dongjeong, a long red goreum ribbon, a rose chima with a gold-leaf
 * hem, and pink kkotsin shoes (drawHanbok).
 */
export const CORAL_PALETTE = {
  ...HIMURA_PALETTE,
  skin: '#f8dcc6',
  skinShade: '#ecc0a4',
  hair: '#6b3a26',
  hairShine: '#b57a54',
  eyeDark: '#123a36',
  iris: '#1f6e60',
  irisLight: '#5cc8a8',
  pupil: '#0e2a26',
  pupilLight: '#2a5a50',
  pupilDeep: '#081a18',
  robeTop: '#4a92d6',
  robeHem: '#25397a',
  robeShade: '#16224a',
  obiage: '#ffe08a',
  sakura: '#ffffff',
  sakuraCore: '#ff8fb8',
  lips: '#d8707c',
  zori: '#8a5a3a',
  obiTop: '#ffc2d6',
  obiBottom: '#e8709c',
  obiLine: '#8a2a5a',
  hairStrandSoft: 'rgba(181,122,84,0.55)',
  hairStrand: 'rgba(181,122,84,0.8)',
  ribbon: '#ff8fb8',
  ribbonDeep: '#e8558f',
  glasses: '#5a3a4a',
  book: '#ffd166',
  bookDeep: '#e0a020',
  // Hanbok.
  jeogori: '#fff2b8',
  jeogoriShade: '#f2d27a',
  chimaTop: '#f0607f',
  chimaHem: '#b8284f',
  chimaShade: 'rgba(110,10,40,0.22)',
  git: '#7a3a82',
  dongjeong: '#ffffff',
  goreum: '#d42a4c',
  goreumDeep: '#a01838',
  cuff: '#d42a4c',
  gold: '#ffd166',
  goldDeep: '#d4a640',
  kkotsin: '#ff8fb8',
  kkotsinDeep: '#e8558f',
};

/** The palette and look of the character being drawn right now (set per call by drawKimonoHimura). */
let P = HIMURA_PALETTE;
let LOOK = 'himura';

/** How far the head is lowered toward the collar (shorter neck). */
const NECK_DROP = 3;

/** The fine dark line-art stroke that gives her a crisp anime finish. */
const LINE = 'rgba(24,18,44,0.6)';

function outline(ctx, width = 0.55) {
  ctx.strokeStyle = LINE;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function sakura(ctx, cx, cy, r, petal = P.sakura, core = P.sakuraCore) {
  ctx.fillStyle = petal;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62, r * 0.52, r * 0.4, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.26, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * A suyari-gasumi mist band — a long rounded gold cloud with a white edge,
 * the classic furisode motif (the user: "add some gold and white").
 */
function goldMist(ctx, x, y, w, h) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, '#f6dc8a');
  grad.addColorStop(1, '#d4a640');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 0.45;
  ctx.stroke();
}

/** A band of seigaiha waves: overlapping white-and-gold arcs along a hem. */
function seigaiha(ctx, x0, x1, y, r) {
  for (let row = 0; row < 2; row++) {
    const off = row ? r : 0;
    for (let cx = x0 - r + off; cx <= x1 + r; cx += r * 2) {
      const cy = y + row * r * 0.9;
      for (const [rr, color] of [[r, '#ffffff'], [r * 0.66, P.obiGold], [r * 0.33, '#ffffff']]) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 0.4;
        ctx.beginPath();
        ctx.arc(cx, cy, rr, Math.PI, 0);
        ctx.stroke();
      }
    }
  }
}

function roundRect(ctx, x, y, w, h, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - feet center
 * @param {number} y - feet line
 * @param {{scale?: number, stress?: number, t?: number, walking?: boolean, cap?: boolean, look?: 'himura' | 'coral'}} [opts]
 *   stress 0..1 (low Sanity): worried brows, a frown, a sweat drop.
 *   cap: the white nurse cap (default true).
 *   look: 'himura' (default) or 'coral' — Library Shift's librarian, with
 *   her own hair, glasses, eyes, kimono and a book (CORAL_PALETTE).
 */
export function drawKimonoHimura(ctx, x, y, opts = {}) {
  const prevPalette = P;
  const prevLook = LOOK;
  LOOK = opts.look === 'coral' ? 'coral' : 'himura';
  P = LOOK === 'coral' ? CORAL_PALETTE : HIMURA_PALETTE;
  try {
    drawFigure(ctx, x, y, opts);
  } finally {
    P = prevPalette;
    LOOK = prevLook;
  }
}

function drawFigure(ctx, x, y, opts) {
  const k = opts.scale ?? 1;
  const stress = Math.max(0, Math.min(1, opts.stress ?? 0));
  const t = opts.t ?? 0;
  const walk = opts.walking ? Math.sin(t * 9) : 0;
  const bob = opts.walking ? Math.abs(Math.sin(t * 9)) * 1.2 : Math.sin(t * 1.6) * 0.4;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);

  // Ground shadow.
  ctx.fillStyle = 'rgba(40,30,40,0.16)';
  ctx.beginPath();
  ctx.ellipse(0, 8, 15, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(0, -bob);
  // Head and hair sit NECK_DROP lower than first drawn — the user found the
  // necks "too long".
  ctx.save();
  ctx.translate(0, NECK_DROP);
  drawBackHair(ctx, walk);
  ctx.restore();
  if (LOOK === 'coral') {
    drawHanbok(ctx, walk);
  } else {
    drawFeet(ctx, walk);
    drawRobe(ctx);
    drawSleeves(ctx, walk);
    drawObi(ctx);
    drawCollar(ctx);
    drawHands(ctx);
  }
  ctx.save();
  ctx.translate(0, NECK_DROP);
  drawHead(ctx, stress, t, opts.cap ?? true);
  ctx.restore();
  ctx.restore();
}

// -- Body -----------------------------------------------------------------------

function drawBackHair(ctx, walk) {
  if (LOOK === 'coral') {
    // A jaw-length bob, rounded at the ends and swinging a little.
    const w = walk * 0.4;
    ctx.fillStyle = P.hair;
    ctx.beginPath();
    ctx.moveTo(-11.5, -62);
    ctx.quadraticCurveTo(-15, -50, -12.5 + w, -42);
    ctx.quadraticCurveTo(-8 + w, -39.5, -5, -41);
    ctx.lineTo(5, -41);
    ctx.quadraticCurveTo(8 + w, -39.5, 12.5 + w, -42);
    ctx.quadraticCurveTo(15, -50, 11.5, -62);
    ctx.closePath();
    ctx.fill();
    outline(ctx, 0.5);
    // Strand lines curving down to the ends, and darker tips curling under.
    ctx.strokeStyle = P.hairStrandSoft;
    ctx.lineWidth = 0.35;
    for (const dir of [-1, 1]) {
      for (const [x0, x1] of [[10.6, 12.6], [12, 10.4], [9.4, 8.2]]) {
        ctx.beginPath();
        ctx.moveTo(dir * x0, -58);
        ctx.quadraticCurveTo(dir * (x0 + 2.2), -50, dir * x1 + w, -42.6);
        ctx.stroke();
      }
    }
    ctx.fillStyle = 'rgba(40,18,10,0.3)';
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(dir * 9.6 + w, -42, 3.2, 0.9, dir * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
    // The darker underlayer showing at the nape, between the ends.
    ctx.fillStyle = 'rgba(40,18,10,0.35)';
    ctx.beginPath();
    ctx.moveTo(-6, -41.2);
    ctx.quadraticCurveTo(0, -44, 6, -41.2);
    ctx.lineTo(5, -41);
    ctx.lineTo(-5, -41);
    ctx.closePath();
    ctx.fill();
    return;
  }
  // Long straight hair falling behind the shoulders to the obi.
  const w = walk * 0.6;
  ctx.fillStyle = P.hair;
  ctx.beginPath();
  ctx.moveTo(-11.5, -62);
  ctx.quadraticCurveTo(-15.5, -48, -14 + w, -30);
  ctx.lineTo(-12 + w, -24);
  ctx.lineTo(-10 + w, -28);
  ctx.lineTo(10 + w, -28);
  ctx.lineTo(12 + w, -24);
  ctx.lineTo(14 + w, -30);
  ctx.quadraticCurveTo(15.5, -48, 11.5, -62);
  ctx.closePath();
  ctx.fill();
  outline(ctx, 0.5);
}

function drawFeet(ctx, walk) {
  for (const dir of [-1, 1]) {
    const fx = dir * 4.2 + (dir < 0 ? walk : -walk) * 1.2;
    roundRect(ctx, fx - 3.6, 5.2, 7.2, 3.2, 1.6, P.zori);
    roundRect(ctx, fx - 2.8, 2.6, 5.6, 3.6, 2, '#ffffff'); // tabi
    ctx.strokeStyle = P.obi;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(fx - 2, 5.4);
    ctx.lineTo(fx, 4);
    ctx.lineTo(fx + 2, 5.4);
    ctx.stroke();
  }
}

/** The robe silhouette: shoulders to ankles, a gently tapered column. */
function robePath(ctx) {
  ctx.beginPath();
  ctx.moveTo(-6, -40);
  ctx.quadraticCurveTo(-12.5, -39, -12.5, -33);
  ctx.lineTo(-11.2, 4.5);
  ctx.quadraticCurveTo(0, 6.2, 11.2, 4.5);
  ctx.lineTo(12.5, -33);
  ctx.quadraticCurveTo(12.5, -39, 6, -40);
  ctx.closePath();
}

function drawRobe(ctx) {
  const grad = ctx.createLinearGradient(0, -40, 0, 5);
  grad.addColorStop(0, P.robeTop);
  grad.addColorStop(0.55, P.robeTop);
  grad.addColorStop(1, P.robeHem);
  robePath(ctx);
  ctx.fillStyle = grad;
  ctx.fill();
  outline(ctx);

  ctx.save();
  robePath(ctx);
  ctx.clip();
  // Volume: a shaded right side and a soft highlight down the left.
  ctx.fillStyle = 'rgba(60,4,14,0.22)';
  ctx.fillRect(5, -42, 9, 50);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(-9, -40, 4, 46);
  // The overlapping front panel (wearer's left over right) runs down to the hem.
  ctx.strokeStyle = 'rgba(60,4,14,0.45)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(2.4, -19);
  ctx.quadraticCurveTo(3.6, -6, 5.2, 5);
  ctx.stroke();
  // Gold mist bands drifting across the skirt.
  goldMist(ctx, -13, -13.5, 11, 2.4);
  goldMist(ctx, 1.5, -5.5, 12, 2.2);
  goldMist(ctx, -10, -0.5, 8, 1.8);
  // Seigaiha waves in white and gold along the hem.
  seigaiha(ctx, -12, 12, 3.4, 1.6);
  // Sakura — white with gold hearts, and gold with white hearts — gathered
  // toward the hem like a furisode.
  [[-7, -2, 2.6], [-2.5, 2, 2], [6.5, -1, 2.4], [8.8, -9, 1.8], [-8.8, -11, 1.7], [1.2, -8, 1.5], [-4.5, -16, 1.2]].forEach(([px, py, r], i) => {
    if (i % 3 === 1) sakura(ctx, px, py, r, P.obiGold, '#ffffff');
    else sakura(ctx, px, py, r, P.sakura, P.obiGold);
  });
  ctx.fillStyle = 'rgba(255,241,244,0.85)';
  for (const [px, py] of [[4, -13], [-6, -7], [9, 1.5], [-1, -3]]) {
    ctx.beginPath();
    ctx.ellipse(px, py, 0.9, 0.5, 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Gold hem line with a fine white edge.
  ctx.strokeStyle = P.obiGold;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-12, 2.2);
  ctx.quadraticCurveTo(0, 3.8, 12, 2.2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.moveTo(-12, 1.5);
  ctx.quadraticCurveTo(0, 3.1, 12, 1.5);
  ctx.stroke();
  ctx.restore();
}

/** One long furisode sleeve hanging from the shoulder (dir -1 left, 1 right). */
function sleevePath(ctx, dir, sway) {
  const o = dir * sway;
  ctx.beginPath();
  ctx.moveTo(dir * 9, -39);
  ctx.quadraticCurveTo(dir * 15.5, -38, dir * 16 + o * 0.3, -30);
  ctx.lineTo(dir * 16.5 + o, -9);
  ctx.quadraticCurveTo(dir * 16.5 + o, -4.5, dir * 12.5 + o, -4.5);
  ctx.lineTo(dir * 9.5 + o * 0.6, -4.5);
  ctx.quadraticCurveTo(dir * 7.5, -4.5, dir * 7.5, -9);
  ctx.lineTo(dir * 7.5, -14);
  ctx.lineTo(dir * 4, -14);
  ctx.lineTo(dir * 8, -33);
  ctx.closePath();
}

function drawSleeves(ctx, walk) {
  for (const dir of [-1, 1]) {
    const sway = (dir < 0 ? walk : -walk) * 0.8;
    const grad = ctx.createLinearGradient(0, -38, 0, -4);
    grad.addColorStop(0, P.robeTop);
    grad.addColorStop(0.5, P.robeTop);
    grad.addColorStop(1, P.robeHem);
    sleevePath(ctx, dir, sway);
    ctx.fillStyle = grad;
    ctx.fill();
    outline(ctx);
    ctx.save();
    sleevePath(ctx, dir, sway);
    ctx.clip();
    if (dir > 0) {
      ctx.fillStyle = 'rgba(60,4,14,0.2)';
      ctx.fillRect(12, -40, 8, 40);
    }
    goldMist(ctx, (dir < 0 ? -17 : 10.5) + sway, -14.5, 6.5, 2);
    sakura(ctx, dir * 12.5 + sway, -10, 2.1, P.sakura, P.obiGold);
    sakura(ctx, dir * 14.6 + sway, -17, 1.4, P.obiGold, '#ffffff');
    sakura(ctx, dir * 10.5 + sway, -6.5, 1.2, P.sakura, P.obiGold);
    seigaiha(ctx, dir < 0 ? -17 : 7.5, dir < 0 ? -7.5 : 17, -4.6, 1.3);
    ctx.strokeStyle = P.obiGold;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(dir * 7.5, -6);
    ctx.lineTo(dir * 17 + sway, -6);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.moveTo(dir * 7.5, -6.7);
    ctx.lineTo(dir * 17 + sway, -6.7);
    ctx.stroke();
    ctx.restore();
    // Crimson lining glimpsed at the sleeve opening.
    ctx.strokeStyle = 'rgba(255,200,210,0.7)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(dir * 7.8, -12.5);
    ctx.lineTo(dir * 7.8, -9);
    ctx.stroke();
    // The fold line where the sleeve meets the arm.
    ctx.strokeStyle = 'rgba(60,4,14,0.4)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(dir * 8.2, -33);
    ctx.lineTo(dir * 7.6, -14.5);
    ctx.stroke();
  }
}

function drawObi(ctx) {
  // Obiage peeking above the sash.
  roundRect(ctx, -11.8, -29.6, 23.6, 2.2, 1, P.obiage);
  const grad = ctx.createLinearGradient(0, -28, 0, -19);
  grad.addColorStop(0, P.obiTop);
  grad.addColorStop(1, P.obiBottom);
  roundRect(ctx, -12, -28, 24, 9, 1, grad);
  ctx.beginPath();
  ctx.roundRect(-12, -28, 24, 9, 1);
  outline(ctx, 0.5);
  // Brocade: edge lines and a row of small diamonds, in deep red on the gold.
  ctx.strokeStyle = P.obiLine;
  ctx.lineWidth = 0.55;
  for (const ly of [-27, -20]) {
    ctx.beginPath();
    ctx.moveTo(-11.8, ly);
    ctx.lineTo(11.8, ly);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(154,42,42,0.55)';
  for (const dx of [-9, -5.5, 5.5, 9]) {
    ctx.beginPath();
    ctx.moveTo(dx, -25.6);
    ctx.lineTo(dx + 1.3, -23.5);
    ctx.lineTo(dx, -21.4);
    ctx.lineTo(dx - 1.3, -23.5);
    ctx.closePath();
    ctx.fill();
  }
  // Obijime cord with a jade obidome.
  roundRect(ctx, -12, -24.1, 24, 1.2, 0.6, '#d8455a');
  roundRect(ctx, -2.2, -25.2, 4.4, 3.4, 1.4, '#4fae94');
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.arc(-0.9, -24.3, 0.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawCollar(ctx) {
  // Neck first, then the crossed collars: a white han-eri under the robe's
  // own collar, the wearer's left side (viewer's right) on top.
  roundRect(ctx, -2.6, -42.5, 5.2, 4.5, 2, P.skin);
  ctx.fillStyle = P.skinShade;
  ctx.beginPath();
  ctx.moveTo(-2.6, -41);
  ctx.lineTo(2.6, -41);
  ctx.lineTo(0, -36.5);
  ctx.closePath();
  ctx.fill();
  // Each side runs from the neck down to the center; the wearer's right
  // (viewer's left) is drawn first, the wearer's left laps over it.
  const side = (dir) => {
    ctx.beginPath();
    ctx.moveTo(dir * 4.4, -41);
    ctx.quadraticCurveTo(dir * 3.4, -35, dir * -1.2, -28.4);
    ctx.strokeStyle = P.collar;
    ctx.lineWidth = 1.9;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(dir * 5.6, -40.6);
    ctx.quadraticCurveTo(dir * 4.4, -34.6, dir * -0.2, -28.4);
    ctx.strokeStyle = P.robeShade;
    ctx.lineWidth = 0.7;
    ctx.stroke();
  };
  side(-1);
  side(1);
  ctx.lineCap = 'butt';
}

function drawHands(ctx) {
  if (LOOK === 'coral') {
    // A closed book held against her, hands at either side.
    roundRect(ctx, -4.6, -19.5, 9.2, 7.4, 1.2, P.bookDeep);
    roundRect(ctx, -4.2, -19.9, 8.8, 7.2, 1, P.book);
    ctx.beginPath();
    ctx.roundRect(-4.2, -19.9, 8.8, 7.2, 1);
    outline(ctx, 0.45);
    ctx.fillStyle = P.ribbon;
    ctx.fillRect(-0.4, -19.9, 1.1, 7.2);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(-3.2, -18.8, 2, 0.6);
    for (const dir of [-1, 1]) {
      ctx.fillStyle = P.skin;
      ctx.beginPath();
      ctx.ellipse(dir * 4.8, -15.6, 1.7, 1.3, 0, 0, Math.PI * 2);
      ctx.fill();
      outline(ctx, 0.4);
    }
    return;
  }
  // Hands folded in front, just below the obi, slender fingers overlapping.
  ctx.fillStyle = P.skin;
  ctx.beginPath();
  ctx.ellipse(-1.7, -15.4, 2.3, 1.35, 0.25, 0, Math.PI * 2);
  ctx.fill();
  outline(ctx, 0.4);
  ctx.fillStyle = P.skin;
  ctx.beginPath();
  ctx.ellipse(1.6, -15, 2.4, 1.35, -0.2, 0, Math.PI * 2);
  ctx.fill();
  outline(ctx, 0.4);
  ctx.strokeStyle = P.skinShade;
  ctx.lineWidth = 0.35;
  for (const fx of [2.2, 3.1]) {
    ctx.beginPath();
    ctx.moveTo(fx, -15.9);
    ctx.lineTo(fx + 0.4, -14.3);
    ctx.stroke();
  }
}

// -- Head -----------------------------------------------------------------------

const HEAD_Y = -55; // face center
const EYE_Y = -54;

function facePath(ctx) {
  ctx.beginPath();
  ctx.moveTo(-10.6, HEAD_Y - 2);
  ctx.bezierCurveTo(-10.6, HEAD_Y - 16, 10.6, HEAD_Y - 16, 10.6, HEAD_Y - 2);
  ctx.bezierCurveTo(10.6, HEAD_Y + 6, 6, HEAD_Y + 11.5, 0, HEAD_Y + 12.6);
  ctx.bezierCurveTo(-6, HEAD_Y + 11.5, -10.6, HEAD_Y + 6, -10.6, HEAD_Y - 2);
  ctx.closePath();
}

function drawHead(ctx, stress, t, cap) {
  if (LOOK === 'himura') {
    // Half-up bun behind the crown, with a kanzashi.
    ctx.fillStyle = P.hair;
    ctx.beginPath();
    ctx.arc(1.5, HEAD_Y - 14.5, 5.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = P.hairShine;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(1.5, HEAD_Y - 14.5, 3.8, Math.PI * 1.1, Math.PI * 1.6);
    ctx.stroke();
    drawKanzashi(ctx, t);
  }

  // Ears, face.
  ctx.fillStyle = P.skinShade;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(dir * 10.4, HEAD_Y + 0.5, 1.6, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (LOOK === 'coral') {
    ctx.strokeStyle = 'rgba(190,120,100,0.6)';
    ctx.lineWidth = 0.3;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(dir * 10.5, HEAD_Y + 0.5, 0.9, dir < 0 ? 0.6 * Math.PI : -0.4 * Math.PI, dir < 0 ? 1.4 * Math.PI : 0.4 * Math.PI);
      ctx.stroke();
    }
  }
  facePath(ctx);
  ctx.fillStyle = P.skin;
  ctx.fill();
  outline(ctx, 0.5);
  // Shadow under the fringe.
  ctx.save();
  facePath(ctx);
  ctx.clip();
  ctx.fillStyle = 'rgba(200,130,120,0.18)';
  ctx.fillRect(-11, HEAD_Y - 9, 22, 4);
  if (LOOK === 'coral') {
    // Soft cel shading down the far cheek and along the jaw.
    ctx.fillStyle = 'rgba(214,150,130,0.22)';
    ctx.beginPath();
    ctx.moveTo(7.4, HEAD_Y - 4);
    ctx.quadraticCurveTo(9.8, HEAD_Y + 3, 5.4, HEAD_Y + 9.6);
    ctx.quadraticCurveTo(3, HEAD_Y + 11.6, 0, HEAD_Y + 12.2);
    ctx.lineTo(11, HEAD_Y + 13);
    ctx.lineTo(11, HEAD_Y - 4);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  if (LOOK === 'coral') {
    // A soft peach-pink eyeshadow above each eye.
    ctx.fillStyle = 'rgba(240,140,150,0.22)';
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(dir * 4.8, EYE_Y - 2.4, 3.4, 1.2, dir * -0.08, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  drawEyes(ctx, stress);
  // Brows: thin and high; worried (inner ends raised) under stress.
  ctx.strokeStyle = P.hair;
  ctx.lineWidth = 0.7;
  ctx.lineCap = 'round';
  for (const dir of [-1, 1]) {
    const inner = -1.2 - stress * 1.4;
    ctx.beginPath();
    ctx.moveTo(dir * 2.4, EYE_Y - 6.4 + inner * 0.5);
    ctx.quadraticCurveTo(dir * 5, EYE_Y - 7.6 - stress * 0.4, dir * 7.4, EYE_Y - 6.4 + stress * 0.6);
    ctx.stroke();
  }
  if (LOOK === 'coral') {
    // A soft double-eyelid crease above each eye.
    ctx.strokeStyle = 'rgba(170,100,90,0.45)';
    ctx.lineWidth = 0.25;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(dir * 2.2, EYE_Y - 2.6);
      ctx.quadraticCurveTo(dir * 4.6, EYE_Y - 4, dir * 7.4, EYE_Y - 2.8);
      ctx.stroke();
    }
    // Fine hairs feathered along each brow.
    ctx.strokeStyle = 'rgba(107,58,38,0.6)';
    ctx.lineWidth = 0.22;
    for (const dir of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const bx = dir * (2.9 + i * 0.85);
        const by = EYE_Y - 6.6 - Math.sin((i / 5) * Math.PI) * 0.9 - stress * 0.3;
        ctx.beginPath();
        ctx.moveTo(bx, by + 0.4);
        ctx.lineTo(bx + dir * 0.55, by - 0.35);
        ctx.stroke();
      }
    }
  }
  // Blush with fine hatching.
  ctx.fillStyle = P.blush;
  ctx.strokeStyle = 'rgba(220,90,110,0.5)';
  ctx.lineWidth = 0.4;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(dir * 6.6, HEAD_Y + 3.4, 2.5, 1.3, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(dir * 6.6 + i * 1.1 + 0.4, HEAD_Y + 2.6);
      ctx.lineTo(dir * 6.6 + i * 1.1 - 0.4, HEAD_Y + 4.2);
      ctx.stroke();
    }
  }
  // Nose: a soft hint.
  ctx.strokeStyle = 'rgba(200,120,110,0.7)';
  ctx.lineWidth = 0.55;
  ctx.beginPath();
  ctx.moveTo(0.3, HEAD_Y + 2.2);
  ctx.lineTo(-0.4, HEAD_Y + 3.6);
  ctx.stroke();
  // Mouth: a small smile, a frown under stress.
  ctx.strokeStyle = P.lips;
  ctx.lineWidth = 0.75;
  ctx.beginPath();
  if (stress > 0.4) {
    ctx.arc(0, HEAD_Y + 8.6, 1.6, 1.2 * Math.PI, 1.8 * Math.PI);
  } else {
    ctx.arc(0, HEAD_Y + 5.4, 1.8, 0.2 * Math.PI, 0.8 * Math.PI);
  }
  ctx.stroke();
  if (LOOK === 'coral') {
    // A soft shadow under the nose tip, and a faint upper-lip line.
    ctx.fillStyle = 'rgba(200,120,110,0.2)';
    ctx.beginPath();
    ctx.ellipse(-0.1, HEAD_Y + 4.1, 0.9, 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (LOOK === 'coral' && stress <= 0.4) {
    ctx.strokeStyle = 'rgba(216,112,124,0.35)';
    ctx.lineWidth = 0.25;
    ctx.beginPath();
    ctx.moveTo(-1.1, HEAD_Y + 5.6);
    ctx.quadraticCurveTo(-0.5, HEAD_Y + 5.2, 0, HEAD_Y + 5.5);
    ctx.quadraticCurveTo(0.5, HEAD_Y + 5.2, 1.1, HEAD_Y + 5.6);
    ctx.stroke();
    // A soft rosy tint under the smile.
    ctx.fillStyle = 'rgba(216,112,124,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, HEAD_Y + 7.7, 1.2, 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.lineCap = 'butt';

  drawFrontHair(ctx);
  if (LOOK === 'coral') {
    drawFreckles(ctx);
    drawSideBraid(ctx, t);
    drawEarrings(ctx, t);
    drawHairPencil(ctx);
    drawBookClip(ctx);
    drawGlasses(ctx);
    drawGlassesChain(ctx);
    drawRibbon(ctx, t);
    drawPearlPins(ctx);
    drawTteoljam(ctx, t);
  }
  if (cap) drawNurseCap(ctx);

  if (stress > 0.3) {
    ctx.fillStyle = 'rgba(150,200,240,0.9)';
    ctx.beginPath();
    ctx.moveTo(9.5, HEAD_Y - 6);
    ctx.quadraticCurveTo(11.4, HEAD_Y - 2.4, 9.5, HEAD_Y - 1.4);
    ctx.quadraticCurveTo(7.6, HEAD_Y - 2.4, 9.5, HEAD_Y - 6);
    ctx.fill();
  }
}

/**
 * Eyes are squashed vertically by this much around their center — the same
 * width, less tall (the user: "not smaller by the sides … smaller by top
 * and down").
 */
const EYE_HEIGHT_SCALE = 0.5;

function drawEyes(ctx, stress) {
  const h = 4.6 - stress * 0.9; // half-height, before EYE_HEIGHT_SCALE
  for (const dir of [-1, 1]) {
    const ex = dir * 4.6;
    ctx.save();
    ctx.translate(ex, EYE_Y);
    ctx.scale(1, EYE_HEIGHT_SCALE);
    ctx.translate(-ex, -EYE_Y);
    // White of the eye.
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(ex, EYE_Y, 3, h, 0, 0, Math.PI * 2);
    ctx.fill();
    // Iris: dark at the top, glowing toward the bottom.
    const grad = ctx.createLinearGradient(0, EYE_Y - h, 0, EYE_Y + h);
    grad.addColorStop(0, P.eyeDark);
    grad.addColorStop(0.55, P.iris);
    grad.addColorStop(1, P.irisLight);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(ex + dir * 0.2, EYE_Y + 0.4, 2.5, h - 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    // A rich metallic gold: bright core, warm deep edge.
    const px = ex + dir * 0.2;
    const pupilGrad = ctx.createRadialGradient(px - 0.2, EYE_Y - 0.3, 0.1, px, EYE_Y + 0.2, 1.8);
    pupilGrad.addColorStop(0, P.pupilLight);
    pupilGrad.addColorStop(0.45, P.pupil);
    pupilGrad.addColorStop(1, P.pupilDeep);
    ctx.fillStyle = pupilGrad;
    ctx.beginPath();
    ctx.ellipse(px, EYE_Y + 0.2, 1.1, 1.8 - stress * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,8,30,0.55)';
    ctx.lineWidth = 0.3;
    ctx.stroke();
    if (LOOK === 'coral') {
      // Fine radial lines in the iris and a darker ring round its edge.
      ctx.strokeStyle = 'rgba(160,240,215,0.35)';
      ctx.lineWidth = 0.18;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(px + Math.cos(a) * 1.2, EYE_Y + 0.3 + Math.sin(a) * 1.9);
        ctx.lineTo(px + Math.cos(a) * 2.2, EYE_Y + 0.4 + Math.sin(a) * (h - 0.8));
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(8,30,26,0.6)';
      ctx.lineWidth = 0.35;
      ctx.beginPath();
      ctx.ellipse(px, EYE_Y + 0.4, 2.5, h - 0.4, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // No highlight sparkles — the user asked to remove the shine.
    // Upper lash line: thick, sweeping out to a flick at the outer corner.
    ctx.fillStyle = P.eyeDark;
    ctx.beginPath();
    ctx.moveTo(ex - dir * 3.3, EYE_Y - h + 1.6);
    ctx.quadraticCurveTo(ex, EYE_Y - h - 1.2, ex + dir * 3.6, EYE_Y - h + 0.6);
    ctx.lineTo(ex + dir * 4.8, EYE_Y - h - 0.4);
    ctx.lineTo(ex + dir * 3.9, EYE_Y - h + 1.8);
    ctx.quadraticCurveTo(ex, EYE_Y - h + 0.2, ex - dir * 3.3, EYE_Y - h + 2.4);
    ctx.closePath();
    ctx.fill();
    // Lower lash: a faint short stroke.
    ctx.strokeStyle = 'rgba(42,26,46,0.45)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(ex - dir * 1, EYE_Y + h + 0.3);
    ctx.lineTo(ex + dir * 2.4, EYE_Y + h - 0.4);
    ctx.stroke();
    if (LOOK === 'coral') {
      // Two extra lashes fanning off the outer flick, and two tiny lower ones.
      ctx.strokeStyle = P.eyeDark;
      ctx.lineWidth = 0.4;
      ctx.lineCap = 'round';
      for (const [dx, dy] of [[4.2, -2.2], [5.2, -1.2]]) {
        ctx.beginPath();
        ctx.moveTo(ex + dir * 3.4, EYE_Y - h + 0.9);
        ctx.lineTo(ex + dir * dx, EYE_Y - h + dy);
        ctx.stroke();
      }
      ctx.lineWidth = 0.3;
      for (const lx of [1.2, 2.2]) {
        ctx.beginPath();
        ctx.moveTo(ex + dir * lx, EYE_Y + h - 0.1);
        ctx.lineTo(ex + dir * (lx + 0.5), EYE_Y + h + 1.1);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
    }
    ctx.restore();
  }
}

function drawFrontHair(ctx) {
  // Crown cap of hair.
  ctx.fillStyle = P.hair;
  ctx.beginPath();
  ctx.moveTo(-11.4, HEAD_Y + 1);
  ctx.bezierCurveTo(-12.2, HEAD_Y - 17.5, 12.2, HEAD_Y - 17.5, 11.4, HEAD_Y + 1);
  ctx.lineTo(9.6, HEAD_Y - 4);
  ctx.lineTo(-9.6, HEAD_Y - 4);
  ctx.closePath();
  ctx.fill();
  // Hime fringe: soft, blunt-cut bangs falling to just above the eyes
  // (lengthened — a shorter fringe left a bare forehead and she "looks
  // bald"; then rounded off — the user didn't like a spiky look). The top
  // follows the skull; the bottom is a smooth curve of gently rounded clumps.
  const clumps = 5;
  const left = -11.2;
  const right = 11.2;
  const edgeY = (x) => HEAD_Y - 1.6 - 1.1 * (x / right) ** 2; // a little lower in the middle
  ctx.beginPath();
  ctx.moveTo(left, HEAD_Y - 2.8);
  ctx.bezierCurveTo(-12, HEAD_Y - 16.5, 12, HEAD_Y - 16.5, right, HEAD_Y - 2.8);
  for (let i = 0; i < clumps; i++) {
    const x0 = right - (i * (right - left)) / clumps;
    const x1 = right - ((i + 1) * (right - left)) / clumps;
    // Each clump bows softly downward between shallow rounded notches.
    ctx.bezierCurveTo(x0 - 0.6, edgeY(x0) + 0.9, x1 + 0.6, edgeY(x1) + 0.9, x1, edgeY(x1) - (i === clumps - 1 ? 1.2 : 0.35));
  }
  ctx.closePath();
  ctx.fill();
  outline(ctx, 0.45);
  ctx.strokeStyle = P.hairStrandSoft;
  ctx.lineWidth = 0.35;
  for (const sx of [-6.7, -2.2, 2.2, 6.7]) {
    ctx.beginPath();
    ctx.moveTo(sx * 0.9, HEAD_Y - 7.5);
    ctx.quadraticCurveTo(sx, HEAD_Y - 4.5, sx * 1.04, HEAD_Y - 2.6);
    ctx.stroke();
  }
  if (LOOK === 'coral') {
    // Finer strands between the clumps, crown strands, and two flyaways.
    ctx.lineWidth = 0.22;
    for (const sx of [-8.8, -4.5, 0, 4.5, 8.8]) {
      ctx.beginPath();
      ctx.moveTo(sx * 0.85, HEAD_Y - 8.4);
      ctx.quadraticCurveTo(sx * 0.98, HEAD_Y - 5, sx, HEAD_Y - 2.4);
      ctx.stroke();
    }
    for (const sx of [-5, -1.5, 2, 5.5]) {
      ctx.beginPath();
      ctx.moveTo(sx * 0.5, HEAD_Y - 12.6);
      ctx.quadraticCurveTo(sx * 0.9, HEAD_Y - 11.2, sx * 1.15, HEAD_Y - 9);
      ctx.stroke();
    }
    ctx.strokeStyle = P.hair;
    ctx.lineWidth = 0.3;
    ctx.beginPath();
    ctx.moveTo(-1.4, HEAD_Y - 13.2);
    ctx.quadraticCurveTo(-2.4, HEAD_Y - 14.9, -1, HEAD_Y - 15.2);
    ctx.moveTo(3.6, HEAD_Y - 12.9);
    ctx.quadraticCurveTo(4.8, HEAD_Y - 14.3, 5.8, HEAD_Y - 13.8);
    ctx.stroke();
  }
  // Side locks framing the face, falling to the collar.
  const lockEnd = LOOK === 'coral' ? 11 : 17;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 11.4, HEAD_Y - 5);
    ctx.quadraticCurveTo(dir * 12.6, HEAD_Y + lockEnd * 0.5, dir * 9.6, HEAD_Y + lockEnd);
    ctx.quadraticCurveTo(dir * 9.2, HEAD_Y + lockEnd * 0.4, dir * 8.4, HEAD_Y - 2);
    ctx.closePath();
    ctx.fill();
    outline(ctx, 0.45);
  }
  // Shine: an angel ring across the crown, plus a few strand lines.
  ctx.strokeStyle = P.hairShine;
  ctx.lineWidth = 1.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, HEAD_Y - 3, 9.6, Math.PI * 1.22, Math.PI * 1.4);
  ctx.moveTo(Math.cos(Math.PI * 1.55) * 9.6, HEAD_Y - 3 + Math.sin(Math.PI * 1.55) * 9.6);
  ctx.arc(0, HEAD_Y - 3, 9.6, Math.PI * 1.55, Math.PI * 1.72);
  ctx.stroke();
  ctx.lineWidth = 0.45;
  ctx.strokeStyle = P.hairStrand;
  for (const sx of [-5, 2]) {
    ctx.beginPath();
    ctx.moveTo(sx, HEAD_Y - 12);
    ctx.quadraticCurveTo(sx + 1.2, HEAD_Y - 8, sx + 0.4, HEAD_Y - 5.2);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}

function drawNurseCap(ctx) {
  const cy = HEAD_Y - 13;
  ctx.fillStyle = P.cap;
  ctx.beginPath();
  ctx.moveTo(-7.4, cy + 2.6);
  ctx.quadraticCurveTo(-7, cy - 3.2, -5.2, cy - 3.6);
  ctx.lineTo(5.2, cy - 3.6);
  ctx.quadraticCurveTo(7, cy - 3.2, 7.4, cy + 2.6);
  ctx.quadraticCurveTo(0, cy + 1.2, -7.4, cy + 2.6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,50,70,0.25)';
  ctx.lineWidth = 0.4;
  ctx.stroke();
  roundRect(ctx, -7, cy - 0.2, 14, 1.2, 0.5, P.capStripe);
  ctx.fillStyle = '#d9534f';
  ctx.fillRect(-0.5, cy - 3, 1, 2.4);
  ctx.fillRect(-1.2, cy - 2.3, 2.4, 1);
}

function drawKanzashi(ctx, t) {
  ctx.strokeStyle = P.obiGold;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(2, HEAD_Y - 15);
  ctx.lineTo(11, HEAD_Y - 18);
  ctx.stroke();
  sakura(ctx, 10, HEAD_Y - 18, 2.1, P.kanzashi, P.obiGold);
  sakura(ctx, 7.6, HEAD_Y - 19.5, 1.5, '#ffffff', P.sakuraCore);
  // Dangling bira-bira strands with tiny blossoms, swaying.
  const sway = Math.sin(t * 2.2) * 0.6;
  ctx.strokeStyle = P.obiGold;
  ctx.lineWidth = 0.4;
  for (const [dx, len] of [[0, 7], [1.4, 5]]) {
    ctx.beginPath();
    ctx.moveTo(10.6 + dx, HEAD_Y - 16.4);
    ctx.lineTo(10.6 + dx + sway, HEAD_Y - 16.4 + len);
    ctx.stroke();
    sakura(ctx, 10.6 + dx + sway, HEAD_Y - 15.8 + len, 0.9, dx ? P.kanzashi : '#ffffff', P.obiGold);
  }
}

/** Eun-mi's round glasses: thin frames, a bridge and a glint on each lens. */
function drawGlasses(ctx) {
  ctx.strokeStyle = P.glasses;
  ctx.lineWidth = 0.6;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(dir * 4.6, EYE_Y + 0.2, 3.6, 2.9, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(dir * 4.6 - 1.8, EYE_Y - 1.4);
    ctx.lineTo(dir * 4.6 - 0.8, EYE_Y - 2.2);
    ctx.stroke();
    ctx.strokeStyle = P.glasses;
    ctx.lineWidth = 0.6;
  }
  ctx.beginPath();
  ctx.moveTo(-1, EYE_Y - 0.4);
  ctx.quadraticCurveTo(0, EYE_Y - 1.2, 1, EYE_Y - 0.4);
  ctx.moveTo(-8.2, EYE_Y - 0.4);
  ctx.lineTo(-10.4, EYE_Y - 1.2);
  ctx.moveTo(8.2, EYE_Y - 0.4);
  ctx.lineTo(10.4, EYE_Y - 1.2);
  ctx.stroke();
  if (LOOK !== 'coral') return;
  // A faint blue tint in the lenses, deeper toward the top.
  for (const dir of [-1, 1]) {
    const tint = ctx.createLinearGradient(0, EYE_Y - 2.9, 0, EYE_Y + 3.1);
    tint.addColorStop(0, 'rgba(140,190,240,0.18)');
    tint.addColorStop(1, 'rgba(140,190,240,0.03)');
    ctx.fillStyle = tint;
    ctx.beginPath();
    ctx.ellipse(dir * 4.6, EYE_Y + 0.2, 3.3, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Frame depth: a lighter inner rim, gold hinge rivets and clear nose pads.
  ctx.strokeStyle = 'rgba(160,110,130,0.55)';
  ctx.lineWidth = 0.22;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(dir * 4.6, EYE_Y + 0.2, 3.25, 2.55, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = P.gold;
    ctx.beginPath();
    ctx.arc(dir * 8.2, EYE_Y - 0.4, 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.ellipse(dir * 1.3, EYE_Y + 1.5, 0.35, 0.55, dir * 0.3, 0, Math.PI * 2);
    ctx.fill();
    outline(ctx, 0.15);
  }
}

/** A light sprinkle of freckles across her nose and cheeks. */
function drawFreckles(ctx) {
  ctx.fillStyle = 'rgba(170,96,70,0.45)';
  for (const [fx, fy] of [[-1.6, 2.6], [-2.7, 3.2], [-3.6, 2.7], [1.7, 2.7], [2.8, 3.3], [3.8, 2.8], [-2.2, 3.9], [2.3, 4]]) {
    ctx.beginPath();
    ctx.arc(fx, HEAD_Y + fy, 0.22, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A thin braid falling from behind her right ear, tied with a pink band. */
function drawSideBraid(ctx, t) {
  const sway = Math.sin(t * 1.8) * 0.25;
  const x0 = 10.2;
  const y0 = HEAD_Y - 1;
  const segs = 7;
  for (let i = 0; i < segs; i++) {
    const u = i / segs;
    const x = x0 + Math.sin(u * 2) * 0.6 + sway * u;
    const y = y0 + i * 1.6;
    const side = i % 2 ? 1 : -1;
    ctx.fillStyle = i % 2 ? P.hair : '#7e4630';
    ctx.beginPath();
    ctx.ellipse(x + side * 0.35, y, 1.05 - u * 0.25, 0.95, side * 0.6, 0, Math.PI * 2);
    ctx.fill();
    outline(ctx, 0.25);
  }
  const ex = x0 + Math.sin(2) * 0.6 + sway;
  const ey = y0 + segs * 1.6 - 0.4;
  ctx.fillStyle = P.ribbonDeep;
  ctx.fillRect(ex - 0.7, ey - 0.3, 1.4, 0.7);
  ctx.fillStyle = P.hair;
  ctx.beginPath();
  ctx.moveTo(ex - 0.6, ey + 0.4);
  ctx.lineTo(ex - 0.9, ey + 2.2);
  ctx.lineTo(ex, ey + 1.6);
  ctx.lineTo(ex + 0.8, ey + 2.2);
  ctx.lineTo(ex + 0.6, ey + 0.4);
  ctx.closePath();
  ctx.fill();
  outline(ctx, 0.2);
}

/**
 * A tteoljam (떨잠), the "trembling hairpin": an oval gold plate with a jade
 * centre ringed by filigree and pearls, three jewelled ornaments (two enamel
 * flowers and a jade butterfly) on fine coiled gold springs that quiver as
 * she moves, two pearl drops on chains below, and the long pin pushed into
 * her hair.
 */
function drawTteoljam(ctx, t) {
  ctx.save();
  ctx.translate(-3.2, HEAD_Y - 11.6);
  ctx.rotate(-0.32);

  // The pin's shaft, slanting back into her hair.
  ctx.lineCap = 'round';
  ctx.strokeStyle = P.goldDeep;
  ctx.lineWidth = 0.55;
  ctx.beginPath();
  ctx.moveTo(-3.4, 0.9);
  ctx.lineTo(3.6, 1.6);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,240,190,0.8)';
  ctx.lineWidth = 0.18;
  ctx.beginPath();
  ctx.moveTo(-3.2, 0.75);
  ctx.lineTo(3.4, 1.45);
  ctx.stroke();
  // Its ball finial.
  ctx.fillStyle = P.gold;
  ctx.beginPath();
  ctx.arc(-3.6, 0.9, 0.45, 0, Math.PI * 2);
  ctx.fill();
  outline(ctx, 0.15);

  // Springs and their ornaments, behind the plate's top edge.
  const ornaments = [
    { x: -1.5, h: 2.4, kind: 'flower', petal: '#ff9fbf', core: P.gold },
    { x: 0.2, h: 3.1, kind: 'butterfly' },
    { x: 1.8, h: 2.2, kind: 'flower', petal: '#fff6f0', core: '#ff8fb8' },
  ];
  ornaments.forEach((o, i) => {
    const wob = Math.sin(t * 7 + i * 1.7) * 0.35;
    const topX = o.x + wob;
    const topY = -1.2 - o.h;
    // A fine coiled spring: a tight zigzag climbing to the ornament.
    ctx.strokeStyle = P.goldDeep;
    ctx.lineWidth = 0.14;
    ctx.beginPath();
    const turns = 7;
    for (let k = 0; k <= turns * 2; k++) {
      const u = k / (turns * 2);
      const cx = o.x + (topX - o.x) * u + (k % 2 ? 0.22 : -0.22);
      const cy = -1.2 + (topY - -1.2) * u;
      if (k === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();
    if (o.kind === 'flower') {
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
        ctx.fillStyle = o.petal;
        ctx.beginPath();
        ctx.ellipse(topX + Math.cos(a) * 0.55, topY + Math.sin(a) * 0.55, 0.42, 0.3, a, 0, Math.PI * 2);
        ctx.fill();
        outline(ctx, 0.12);
      }
      ctx.fillStyle = o.core;
      ctx.beginPath();
      ctx.arc(topX, topY, 0.28, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // The jade butterfly: four wings, gold body and antennae.
      for (const side of [-1, 1]) {
        ctx.fillStyle = '#7fd1b9';
        ctx.beginPath();
        ctx.ellipse(topX + side * 0.7, topY - 0.25, 0.75, 0.5, side * 0.5, 0, Math.PI * 2);
        ctx.fill();
        outline(ctx, 0.12);
        ctx.fillStyle = '#a8e6d2';
        ctx.beginPath();
        ctx.ellipse(topX + side * 0.55, topY + 0.45, 0.48, 0.34, side * -0.4, 0, Math.PI * 2);
        ctx.fill();
        outline(ctx, 0.12);
      }
      ctx.strokeStyle = P.goldDeep;
      ctx.lineWidth = 0.2;
      ctx.beginPath();
      ctx.moveTo(topX, topY - 0.6);
      ctx.lineTo(topX, topY + 0.7);
      ctx.moveTo(topX, topY - 0.6);
      ctx.lineTo(topX - 0.4, topY - 1.2);
      ctx.moveTo(topX, topY - 0.6);
      ctx.lineTo(topX + 0.4, topY - 1.2);
      ctx.stroke();
    }
  });

  // The oval gold plate.
  const plate = ctx.createLinearGradient(0, -1.8, 0, 1.8);
  plate.addColorStop(0, '#ffe39a');
  plate.addColorStop(1, P.goldDeep);
  ctx.fillStyle = plate;
  ctx.beginPath();
  ctx.ellipse(0, 0, 2.5, 1.75, 0, 0, Math.PI * 2);
  ctx.fill();
  outline(ctx, 0.25);
  // Filigree: a ring of tiny gold dots and fine scrolls.
  ctx.fillStyle = '#a8781e';
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 1.55, Math.sin(a) * 1.05, 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(140,96,20,0.7)';
  ctx.lineWidth = 0.12;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * 1.75, 0, 0.35, 0, Math.PI * 1.5);
    ctx.stroke();
  }
  // Pearls set round the rim.
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    ctx.fillStyle = '#fff6f0';
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 2.35, Math.sin(a) * 1.62, 0.3, 0, Math.PI * 2);
    ctx.fill();
    outline(ctx, 0.1);
  }
  // The jade centre, with a carved flower and a darker setting.
  ctx.fillStyle = '#5fbfa0';
  ctx.beginPath();
  ctx.ellipse(0, 0, 1.15, 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#a8781e';
  ctx.lineWidth = 0.22;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(220,255,240,0.65)';
  ctx.lineWidth = 0.12;
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * 0.35, Math.sin(a) * 0.25, 0.28, 0.16, a, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#ff8fb8';
  ctx.beginPath();
  ctx.arc(0, 0, 0.16, 0, Math.PI * 2);
  ctx.fill();

  // Two pearl drops on fine chains, swinging below the plate.
  for (const [dx, len] of [[-1, 1.6], [1, 2.1]]) {
    const sw = Math.sin(t * 3 + dx) * 0.25;
    ctx.strokeStyle = P.goldDeep;
    ctx.lineWidth = 0.12;
    ctx.beginPath();
    ctx.moveTo(dx, 1.5);
    ctx.lineTo(dx + sw, 1.5 + len);
    ctx.stroke();
    ctx.fillStyle = '#fff6f0';
    ctx.beginPath();
    ctx.ellipse(dx + sw, 1.5 + len + 0.35, 0.28, 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    outline(ctx, 0.1);
  }
  ctx.lineCap = 'butt';
  ctx.restore();
}

/** Three little pearl hairpins in a row below her bow. */
function drawPearlPins(ctx) {
  for (let i = 0; i < 3; i++) {
    const x = 4.4 + i * 1.5;
    const y = HEAD_Y - 9.2 + i * 0.5;
    ctx.fillStyle = '#fff6f0';
    ctx.beginPath();
    ctx.arc(x, y, 0.55, 0, Math.PI * 2);
    ctx.fill();
    outline(ctx, 0.2);
  }
}

/** A yellow pencil tucked into her hair above the book clip, eraser end out. */
function drawHairPencil(ctx) {
  ctx.save();
  ctx.translate(-7.4, HEAD_Y - 10.4);
  ctx.rotate(-0.6);
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(-2.6, -0.45, 3.6, 0.9);
  ctx.fillStyle = '#e0a020';
  ctx.fillRect(-2.6, 0.15, 3.6, 0.3);
  ctx.fillStyle = '#c8ccd4'; // ferrule
  ctx.fillRect(-3.3, -0.45, 0.7, 0.9);
  ctx.fillStyle = '#ff8fb8'; // eraser
  ctx.beginPath();
  ctx.roundRect(-4.2, -0.45, 0.95, 0.9, 0.3);
  ctx.fill();
  ctx.beginPath();
  ctx.rect(-4.2, -0.45, 5.2, 0.9);
  outline(ctx, 0.2);
  ctx.restore();
}

/** A little hair clip shaped like an open book, on the side opposite her bow. */
function drawBookClip(ctx) {
  ctx.save();
  ctx.translate(-8.4, HEAD_Y - 7.4);
  ctx.rotate(-0.35);
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, 0.4);
    ctx.quadraticCurveTo(dir * 1.1, -0.5, dir * 2.2, -0.2);
    ctx.lineTo(dir * 2.2, 1.6);
    ctx.quadraticCurveTo(dir * 1.1, 1.3, 0, 2);
    ctx.closePath();
    ctx.fillStyle = '#4fa8e0';
    ctx.fill();
    outline(ctx, 0.25);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 0.18;
    for (const ly of [0.5, 1]) {
      ctx.beginPath();
      ctx.moveTo(dir * 0.5, ly + 0.1);
      ctx.lineTo(dir * 1.8, ly - 0.1);
      ctx.stroke();
    }
  }
  ctx.fillStyle = P.gold;
  ctx.fillRect(-0.15, 0.2, 0.3, 1.9);
  ctx.restore();
}

/** Little pink pearl drops hanging from her ears, swinging gently. */
function drawEarrings(ctx, t) {
  const swing = Math.sin(t * 2.2) * 0.3;
  for (const dir of [-1, 1]) {
    const x = dir * 10.5;
    const y = HEAD_Y + 2.6;
    ctx.strokeStyle = P.goldDeep;
    ctx.lineWidth = 0.3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + swing, y + 1.4);
    ctx.stroke();
    ctx.fillStyle = '#ffd6e2';
    ctx.beginPath();
    ctx.arc(x + swing, y + 2.1, 0.75, 0, Math.PI * 2);
    ctx.fill();
    outline(ctx, 0.25);
    // A tiny gold cap on each pearl.
    ctx.fillStyle = P.gold;
    ctx.beginPath();
    ctx.ellipse(x + swing, y + 1.45, 0.42, 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A librarian's beaded glasses chain, looping from each temple down to her shoulders. */
function drawGlassesChain(ctx) {
  for (const dir of [-1, 1]) {
    const p0 = [dir * 10.4, EYE_Y - 1.2];
    const c = [dir * 14.2, EYE_Y + 6];
    const p1 = [dir * 8.4, EYE_Y + 15];
    for (let i = 1; i <= 14; i++) {
      const u = i / 14;
      const x = (1 - u) ** 2 * p0[0] + 2 * (1 - u) * u * c[0] + u ** 2 * p1[0];
      const y = (1 - u) ** 2 * p0[1] + 2 * (1 - u) * u * c[1] + u ** 2 * p1[1];
      ctx.fillStyle = i % 3 === 0 ? P.ribbonDeep : P.gold;
      ctx.beginPath();
      ctx.arc(x, y, i % 3 === 0 ? 0.42 : 0.28, 0, Math.PI * 2);
      ctx.fill();
    }
    // A tiny gold star charm where each side of the chain ends.
    ctx.fillStyle = P.gold;
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      const r = k % 2 ? 0.3 : 0.7;
      ctx.lineTo(p1[0] + Math.cos(a) * r, p1[1] + 0.9 + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    outline(ctx, 0.15);
  }
}

/** Eun-mi's pink ribbon bow on the side of her head, its tails swaying. */
function drawRibbon(ctx, t) {
  const cx = 8.6;
  const cy = HEAD_Y - 11.5;
  const sway = Math.sin(t * 2) * 0.5;
  ctx.fillStyle = P.ribbonDeep;
  for (const [dx, len] of [[-1, 6], [1.2, 5]]) {
    ctx.beginPath();
    ctx.moveTo(cx + dx * 0.6, cy + 0.6);
    ctx.lineTo(cx + dx * 2 + sway, cy + len);
    ctx.lineTo(cx + dx * 0.4 + sway, cy + len - 1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = P.ribbon;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo(cx + dir * 4.6, cy - 4.4, cx + dir * 4.8, cy);
    ctx.quadraticCurveTo(cx + dir * 4.6, cy + 3.6, cx, cy);
    ctx.fill();
    outline(ctx, 0.4);
  }
  // Fold creases in each loop, and a white polka-dot or two.
  ctx.strokeStyle = 'rgba(200,60,110,0.55)';
  ctx.lineWidth = 0.3;
  for (const dir of [-1, 1]) {
    for (const dy of [-1.2, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + dir * 1.2, cy + dy * 0.3);
      ctx.quadraticCurveTo(cx + dir * 2.8, cy + dy * 1.4, cx + dir * 4, cy + dy * 0.8);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.arc(cx + dir * 3.2, cy - 1.2, 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = P.ribbonDeep;
  ctx.beginPath();
  ctx.arc(cx, cy, 1.3, 0, Math.PI * 2);
  ctx.fill();
  outline(ctx, 0.35);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 0.25;
  ctx.beginPath();
  ctx.moveTo(cx - 0.6, cy - 0.7);
  ctx.lineTo(cx + 0.6, cy + 0.7);
  ctx.stroke();
  // A pearl set in the knot, and gold beads weighting the tail tips.
  ctx.fillStyle = '#fff6f0';
  ctx.beginPath();
  ctx.arc(cx, cy, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = P.gold;
  for (const [dx, len] of [[-1, 6], [1.2, 5]]) {
    ctx.beginPath();
    ctx.arc(cx + dx * 2 + sway, cy + len, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// -- Hanbok (Eun-mi's look) ---------------------------------------------------------

/** The chima: a high-waisted skirt from the chest, belling out to the floor. */
function chimaPath(ctx) {
  ctx.beginPath();
  ctx.moveTo(-10.6, -31.5);
  ctx.bezierCurveTo(-12.6, -20, -15.6, -6, -14.8, 4.6);
  ctx.quadraticCurveTo(0, 7.4, 14.8, 4.6);
  ctx.bezierCurveTo(15.6, -6, 12.6, -20, 10.6, -31.5);
  ctx.quadraticCurveTo(0, -32.6, -10.6, -31.5);
  ctx.closePath();
}

/** One slim jeogori sleeve, curving in at the bottom (dir -1 left, 1 right). */
function jeogoriSleevePath(ctx, dir, sway) {
  const o = dir * sway;
  ctx.beginPath();
  ctx.moveTo(dir * 8.6, -39.4);
  ctx.quadraticCurveTo(dir * 14.4, -38.6, dir * 14.8 + o * 0.3, -31);
  ctx.lineTo(dir * 14.4 + o, -18);
  ctx.quadraticCurveTo(dir * 14 + o, -13.4, dir * 10 + o * 0.6, -13.6);
  ctx.lineTo(dir * 5.8, -14.2);
  ctx.lineTo(dir * 6.6, -19);
  ctx.lineTo(dir * 8.2, -32);
  ctx.closePath();
}

function drawHanbok(ctx, walk) {
  // Kkotsin: flower shoes with upturned toes, peeking under the hem.
  for (const dir of [-1, 1]) {
    const fx = dir * 4.4 + (dir < 0 ? walk : -walk) * 1.1;
    ctx.fillStyle = P.kkotsin;
    ctx.beginPath();
    ctx.moveTo(fx - 3.4, 7.6);
    ctx.quadraticCurveTo(fx - 3.6, 4.6, fx - 0.6, 4.4);
    ctx.lineTo(fx + 2.4, 4.6);
    ctx.quadraticCurveTo(fx + 4.2, 4.4, fx + 4.6, 3.2); // the upturned toe
    ctx.quadraticCurveTo(fx + 4.4, 7.4, fx + 2.6, 7.6);
    ctx.closePath();
    ctx.fill();
    outline(ctx, 0.45);
    ctx.fillStyle = P.kkotsinDeep;
    ctx.beginPath();
    ctx.arc(fx + 0.6, 5.6, 0.9, 0, Math.PI * 2);
    ctx.fill();
    // Embroidered leaves either side of the flower, and a yellow centre.
    ctx.fillStyle = '#5fbf8a';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(fx + 0.6 + side * 1.5, 5.8, 0.75, 0.35, side * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = P.gold;
    ctx.beginPath();
    ctx.arc(fx + 0.6, 5.6, 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  // Chima.
  const skirt = ctx.createLinearGradient(0, -32, 0, 6);
  skirt.addColorStop(0, P.chimaTop);
  skirt.addColorStop(0.6, P.chimaTop);
  skirt.addColorStop(1, P.chimaHem);
  chimaPath(ctx);
  ctx.fillStyle = skirt;
  ctx.fill();
  outline(ctx);
  ctx.save();
  chimaPath(ctx);
  ctx.clip();
  // Volume and soft pleats fanning out toward the hem.
  ctx.fillStyle = P.chimaShade;
  ctx.fillRect(6, -33, 12, 42);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(-10, -30, 4, 36);
  ctx.strokeStyle = 'rgba(110,10,40,0.35)';
  ctx.lineWidth = 0.5;
  for (const px of [-6.5, -2.2, 2.2, 6.5]) {
    ctx.beginPath();
    ctx.moveTo(px * 0.95, -28);
    ctx.quadraticCurveTo(px * 1.15, -12, px * 1.6, 5);
    ctx.stroke();
  }
  // A faint woven flower pattern across the skirt.
  for (let row = 0; row < 5; row++) {
    for (let col = -3; col <= 3; col++) {
      const fx = col * 4.2 + (row % 2) * 2.1;
      const fy = -25 + row * 4.8;
      sakura(ctx, fx, fy, 0.9, 'rgba(255,255,255,0.16)', 'rgba(255,220,120,0.35)');
    }
  }
  // A soft silk sheen down the left of the skirt.
  const sheen = ctx.createLinearGradient(-12, 0, -4, 0);
  sheen.addColorStop(0, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.5, 'rgba(255,255,255,0.12)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(-12, -30, 8, 36);
  // Gathered tucks where the skirt is pleated into its waistband.
  ctx.strokeStyle = 'rgba(110,10,40,0.35)';
  ctx.lineWidth = 0.3;
  for (let gx = -9; gx <= 9; gx += 1.5) {
    ctx.beginPath();
    ctx.moveTo(gx, -29.4);
    ctx.lineTo(gx * 1.04, -26.6);
    ctx.stroke();
  }
  // Alternating lighter and darker pleat panels.
  for (let i = -4; i < 4; i++) {
    if (i % 2 === 0) continue;
    ctx.fillStyle = 'rgba(120,10,40,0.07)';
    ctx.beginPath();
    ctx.moveTo(i * 2.6, -30);
    ctx.lineTo((i + 1) * 2.6, -30);
    ctx.lineTo((i + 1) * 3.9, 6);
    ctx.lineTo(i * 3.9, 6);
    ctx.closePath();
    ctx.fill();
  }
  // Embroidered butterflies fluttering across the skirt.
  for (const [bx, by, rot] of [[-5.6, -7.2, -0.3], [6.6, -9.4, 0.35], [1.4, -6.4, 0.1]]) {
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(rot);
    for (const side of [-1, 1]) {
      ctx.fillStyle = 'rgba(255,230,150,0.75)';
      ctx.beginPath();
      ctx.ellipse(side * 0.9, -0.4, 0.95, 0.7, side * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.ellipse(side * 0.7, 0.6, 0.6, 0.45, side * -0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(120,40,40,0.6)';
    ctx.lineWidth = 0.2;
    ctx.beginPath();
    ctx.moveTo(0, -0.9);
    ctx.lineTo(0, 1);
    ctx.moveTo(0, -0.9);
    ctx.lineTo(-0.4, -1.6);
    ctx.moveTo(0, -0.9);
    ctx.lineTo(0.4, -1.6);
    ctx.stroke();
    ctx.restore();
  }
  // A gold vine scroll running just above the hem band.
  ctx.strokeStyle = 'rgba(255,209,102,0.7)';
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  for (let vx = -15; vx <= 15; vx += 0.5) {
    const vy = -4.4 + Math.sin(vx * 0.9) * 0.6 + Math.abs(vx) * 0.03;
    if (vx === -15) ctx.moveTo(vx, vy);
    else ctx.lineTo(vx, vy);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,209,102,0.7)';
  for (let vx = -13.3; vx <= 14; vx += 3.5) {
    ctx.beginPath();
    ctx.ellipse(vx, -5.2 + Math.abs(vx) * 0.03, 0.55, 0.25, -0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Geumbak: a band of gold-leaf flowers and lines along the hem.
  ctx.fillStyle = 'rgba(255,209,102,0.25)';
  ctx.fillRect(-16, -2.6, 32, 4.6);
  ctx.strokeStyle = P.gold;
  ctx.lineWidth = 0.6;
  for (const ly of [-2.6, 2]) {
    ctx.beginPath();
    ctx.moveTo(-16, ly);
    ctx.quadraticCurveTo(0, ly + 1.2, 16, ly);
    ctx.stroke();
  }
  for (let fx = -12; fx <= 12; fx += 4) sakura(ctx, fx, -0.2 + Math.abs(fx) * 0.04, 1.3, P.gold, '#ffffff');
  // Tiny white dots between the gold flowers.
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (let fx = -14; fx <= 14; fx += 4) {
    ctx.beginPath();
    ctx.arc(fx, -0.2 + Math.abs(fx) * 0.04, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // The white underskirt (sokchima) just peeking below the hem.
  ctx.strokeStyle = '#fbf6ee';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-14.2, 5.3);
  ctx.quadraticCurveTo(0, 8.1, 14.2, 5.3);
  ctx.stroke();
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  ctx.moveTo(-13.8, 5.8);
  ctx.quadraticCurveTo(0, 8.6, 13.8, 5.8);
  ctx.stroke();

  // Jeogori: a short jacket over the shoulders, ending above the chima band.
  ctx.fillStyle = 'rgba(60,30,40,0.18)';
  ctx.beginPath();
  ctx.ellipse(0, -29.6, 11, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();
  const jacketPath = () => {
    ctx.beginPath();
    ctx.moveTo(-6, -40.4);
    ctx.quadraticCurveTo(-12.4, -39.4, -12.4, -33.4);
    ctx.lineTo(-11.6, -29.6);
    ctx.quadraticCurveTo(0, -27.6, 11.6, -29.6);
    ctx.lineTo(12.4, -33.4);
    ctx.quadraticCurveTo(12.4, -39.4, 6, -40.4);
    ctx.closePath();
  };
  const jacket = ctx.createLinearGradient(0, -41, 0, -28);
  jacket.addColorStop(0, P.jeogori);
  jacket.addColorStop(1, P.jeogoriShade);
  jacketPath();
  ctx.fillStyle = jacket;
  ctx.fill();
  outline(ctx);
  // A faint damask of tiny gold diamonds woven through the jacket.
  ctx.save();
  jacketPath();
  ctx.clip();
  ctx.fillStyle = 'rgba(212,166,64,0.28)';
  for (let row = 0; row < 5; row++) {
    for (let col = -6; col <= 6; col++) {
      const dx = col * 2 + (row % 2);
      const dy = -39.2 + row * 2;
      ctx.beginPath();
      ctx.moveTo(dx, dy - 0.45);
      ctx.lineTo(dx + 0.35, dy);
      ctx.lineTo(dx, dy + 0.45);
      ctx.lineTo(dx - 0.35, dy);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
  // A thin gold-leaf trim just above the jacket's hem.
  ctx.strokeStyle = P.goldDeep;
  ctx.lineWidth = 0.4;
  ctx.setLineDash([0.9, 0.5]);
  ctx.beginPath();
  ctx.moveTo(-11.4, -30.6);
  ctx.quadraticCurveTo(0, -28.7, 11.4, -30.6);
  ctx.stroke();
  ctx.setLineDash([]);

  // Sleeves: slim, the classic curved underside (baerae), red cuffs (kkeutdong).
  for (const dir of [-1, 1]) {
    const sway = (dir < 0 ? walk : -walk) * 0.6;
    const grad = ctx.createLinearGradient(0, -39, 0, -14);
    grad.addColorStop(0, P.jeogori);
    grad.addColorStop(1, P.jeogoriShade);
    jeogoriSleevePath(ctx, dir, sway);
    ctx.fillStyle = grad;
    ctx.fill();
    outline(ctx);
    ctx.save();
    jeogoriSleevePath(ctx, dir, sway);
    ctx.clip();
    ctx.fillStyle = 'rgba(212,166,64,0.28)';
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 5; col++) {
        const dx = dir * (6.5 + col * 2 + (row % 2));
        const dy = -38 + row * 2;
        ctx.beginPath();
        ctx.moveTo(dx, dy - 0.45);
        ctx.lineTo(dx + 0.35, dy);
        ctx.lineTo(dx, dy + 0.45);
        ctx.lineTo(dx - 0.35, dy);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.fillStyle = P.cuff;
    ctx.fillRect(dir < 0 ? -18 : 4, -18.6, 14, 5.4);
    ctx.strokeStyle = 'rgba(255,220,180,0.55)';
    ctx.lineWidth = 0.2;
    ctx.setLineDash([0.45, 0.35]);
    ctx.beginPath();
    ctx.moveTo(dir * 5, -17.8);
    ctx.lineTo(dir * 17, -17.8);
    ctx.stroke();
    ctx.setLineDash([]);
    // The white inner lining showing at the cuff's edge.
    ctx.strokeStyle = '#fbf6ee';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(dir * 6, -13.9);
    ctx.lineTo(dir * 10 + sway * 0.6, -13.85);
    ctx.quadraticCurveTo(dir * 13.8 + sway, -13.7, dir * 14.2 + sway, -16);
    ctx.stroke();
    // Gold-leaf flowers stamped along the red cuff.
    for (const cx of [7.4, 9.8, 12.2, 14.4]) sakura(ctx, dir * cx + sway, -16, 0.75, P.gold, P.cuff);
    ctx.strokeStyle = P.gold;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(dir * 5, -18.6);
    ctx.lineTo(dir * 17, -18.6);
    ctx.stroke();
    if (dir > 0) {
      ctx.fillStyle = 'rgba(120,80,20,0.15)';
      ctx.fillRect(11.5, -40, 6, 28);
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(120,80,20,0.4)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(dir * 8.4, -33);
    ctx.lineTo(dir * 7.4, -20);
    ctx.stroke();
    // Folds gathering at the underarm.
    ctx.strokeStyle = 'rgba(160,110,30,0.3)';
    ctx.lineWidth = 0.3;
    for (const dy of [0, 1.4]) {
      ctx.beginPath();
      ctx.moveTo(dir * 8.6, -33 + dy);
      ctx.quadraticCurveTo(dir * 10, -32.2 + dy, dir * 11.6, -32.8 + dy);
      ctx.stroke();
    }
    // Soft creases where the sleeve bends at the elbow.
    ctx.strokeStyle = 'rgba(160,110,30,0.35)';
    ctx.lineWidth = 0.35;
    for (const [y0, y1] of [[-26, -24.6], [-23.6, -22.4]]) {
      ctx.beginPath();
      ctx.moveTo(dir * 14.2 + sway, y0);
      ctx.quadraticCurveTo(dir * 12.4 + sway * 0.8, y0 + 0.2, dir * 10.6, y1);
      ctx.stroke();
    }
    // An embroidered pink flower on each shoulder with a gold centre.
    sakura(ctx, dir * 11.8, -35.4, 1.4, P.ribbon, P.gold);
    ctx.strokeStyle = 'rgba(95,191,138,0.8)';
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.moveTo(dir * 11.8, -34.2);
    ctx.quadraticCurveTo(dir * 12.6, -32.6, dir * 13.4, -32.4);
    ctx.stroke();
  }

  // Neck, then the git collar crossing to the wearer's right with its white
  // dongjeong strip along the neckline.
  roundRect(ctx, -2.6, -42.5, 5.2, 4.5, 2, P.skin);
  ctx.fillStyle = P.skinShade;
  ctx.beginPath();
  ctx.moveTo(-2.6, -41);
  ctx.lineTo(2.6, -41);
  ctx.lineTo(0, -36.5);
  ctx.closePath();
  ctx.fill();
  // A fine gold chain with a tiny pink heart, resting at the base of her neck.
  ctx.strokeStyle = P.gold;
  ctx.lineWidth = 0.22;
  ctx.beginPath();
  ctx.moveTo(-2.5, -41.6);
  ctx.quadraticCurveTo(0, -38.8, 2.5, -41.6);
  ctx.stroke();
  ctx.fillStyle = P.ribbonDeep;
  ctx.beginPath();
  ctx.moveTo(0, -38.2);
  ctx.bezierCurveTo(-0.9, -38.9, -0.6, -39.9, 0, -39.4);
  ctx.bezierCurveTo(0.6, -39.9, 0.9, -38.9, 0, -38.2);
  ctx.fill();
  ctx.lineCap = 'round';
  for (const dir of [1, -1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 4.6, -41);
    ctx.quadraticCurveTo(dir * 3.4, -35.4, dir * -2.4, -30.6);
    ctx.strokeStyle = P.git;
    ctx.lineWidth = 2.6;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(dir * 4.1, -41.2);
    ctx.quadraticCurveTo(dir * 3.4, -38.2, dir * 1.6, -35.6);
    ctx.strokeStyle = P.dongjeong;
    ctx.lineWidth = 1.1;
    ctx.stroke();
    // Small gold dots stamped along the purple collar.
    ctx.fillStyle = 'rgba(255,209,102,0.85)';
    for (let i = 1; i <= 5; i++) {
      const u = i / 6;
      const x = (1 - u) ** 2 * dir * 4.6 + 2 * (1 - u) * u * dir * 3.4 + u ** 2 * dir * -2.4;
      const y = (1 - u) ** 2 * -41 + 2 * (1 - u) * u * -35.4 + u ** 2 * -30.6;
      ctx.beginPath();
      ctx.arc(x + dir * 0.6, y + 0.3, 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
    // Fine running stitches along the collar.
    ctx.setLineDash([0.5, 0.4]);
    ctx.beginPath();
    ctx.moveTo(dir * 5.4, -40.6);
    ctx.quadraticCurveTo(dir * 4.2, -34.8, dir * -1.6, -29.8);
    ctx.strokeStyle = 'rgba(255,220,255,0.6)';
    ctx.lineWidth = 0.2;
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.lineCap = 'butt';

  // Goreum: a bow at the chest with two long ribbon tails.
  const kx = -3.2;
  const ky = -31.4;
  for (const [dx, len, tilt] of [[-0.6, 17, -0.08], [0.8, 14, 0.05]]) {
    ctx.save();
    ctx.translate(kx + dx, ky + 0.6);
    ctx.rotate(tilt);
    roundRect(ctx, -0.9, 0, 1.8, len, 0.6, P.goreum);
    ctx.beginPath();
    ctx.roundRect(-0.9, 0, 1.8, len, 0.6);
    outline(ctx, 0.35);
    // Gold-leaf dots down the ribbon, and a notched (swallowtail) end.
    ctx.fillStyle = P.gold;
    for (let d = 2; d < len - 2; d += 2.6) {
      ctx.beginPath();
      ctx.arc(0, d, 0.28, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = P.chimaTop;
    ctx.beginPath();
    ctx.moveTo(-0.95, len + 0.05);
    ctx.lineTo(0, len - 1.1);
    ctx.lineTo(0.95, len + 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = P.goreum;
  ctx.beginPath();
  ctx.ellipse(kx - 3.4, ky - 0.2, 3.4, 1.5, -0.15, 0, Math.PI * 2);
  ctx.fill();
  outline(ctx, 0.4);
  ctx.strokeStyle = 'rgba(120,10,30,0.45)';
  ctx.lineWidth = 0.3;
  for (const dy of [-0.7, 0.7]) {
    ctx.beginPath();
    ctx.moveTo(kx - 1.2, ky + dy * 0.3);
    ctx.quadraticCurveTo(kx - 3, ky + dy * 1.2, kx - 5.6, ky + dy * 0.6 - 0.3);
    ctx.stroke();
  }
  sakura(ctx, kx - 3.6, ky - 0.2, 0.8, P.gold, '#ffffff');
  ctx.fillStyle = P.goreumDeep;
  ctx.beginPath();
  ctx.arc(kx, ky, 1.2, 0, Math.PI * 2);
  ctx.fill();
  outline(ctx, 0.35);

  // Norigae: a jade butterfly pendant on a knotted cord with a long tassel,
  // hanging from the bow.
  {
    const nx = 1.6;
    ctx.strokeStyle = P.goreumDeep;
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    ctx.moveTo(kx + 0.8, ky + 0.8);
    ctx.quadraticCurveTo(nx - 0.4, ky + 1.6, nx, -27.6);
    ctx.stroke();
    // The jade butterfly.
    ctx.fillStyle = '#7fd1b9';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(nx + side * 1, -26.6, 1.1, 0.8, side * 0.5, 0, Math.PI * 2);
      ctx.fill();
      outline(ctx, 0.25);
      ctx.beginPath();
      ctx.ellipse(nx + side * 0.8, -25.4, 0.7, 0.55, side * -0.4, 0, Math.PI * 2);
      ctx.fill();
      outline(ctx, 0.25);
    }
    ctx.fillStyle = P.goldDeep;
    ctx.fillRect(nx - 0.2, -27.6, 0.4, 2.8);
    // A decorative knot (maedeup), then the gold cap and pink tassel.
    ctx.fillStyle = P.goreum;
    ctx.beginPath();
    ctx.moveTo(nx, -24.4);
    ctx.lineTo(nx + 0.9, -23.4);
    ctx.lineTo(nx, -22.4);
    ctx.lineTo(nx - 0.9, -23.4);
    ctx.closePath();
    ctx.fill();
    outline(ctx, 0.25);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 0.15;
    ctx.beginPath();
    ctx.moveTo(nx - 0.45, -23.4);
    ctx.lineTo(nx + 0.45, -23.4);
    ctx.moveTo(nx, -23.85);
    ctx.lineTo(nx, -22.95);
    ctx.stroke();
    roundRect(ctx, nx - 0.6, -22.2, 1.2, 0.9, 0.3, P.gold);
    ctx.strokeStyle = P.ribbon;
    ctx.lineWidth = 0.3;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(nx + i * 0.16, -21.3);
      ctx.lineTo(nx + i * 0.32, -16.4);
      ctx.stroke();
    }
    // Made a samjak (three-pendant) norigae: a coral-bead cluster and a gold
    // flower hang either side of the jade, each with its own shorter tassel.
    for (const [side, kind, tassel] of [[-1, 'coral', '#a06ad0'], [1, 'gold', '#ffd166']]) {
      const sx = nx + side * 2.4;
      ctx.strokeStyle = P.goreumDeep;
      ctx.lineWidth = 0.35;
      ctx.beginPath();
      ctx.moveTo(nx, -27.6);
      ctx.quadraticCurveTo(sx, -27.4, sx, -25.8);
      ctx.stroke();
      if (kind === 'coral') {
        ctx.fillStyle = '#e8505a';
        for (const [bx, by] of [[0, -25.3], [-0.5, -24.6], [0.5, -24.6], [0, -23.9]]) {
          ctx.beginPath();
          ctx.arc(sx + bx, by, 0.42, 0, Math.PI * 2);
          ctx.fill();
          outline(ctx, 0.15);
        }
      } else {
        sakura(ctx, sx, -24.6, 1, P.gold, P.goldDeep);
      }
      roundRect(ctx, sx - 0.45, -23.2, 0.9, 0.7, 0.25, P.goldDeep);
      ctx.strokeStyle = tassel;
      ctx.lineWidth = 0.25;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(sx + i * 0.14, -22.5);
        ctx.lineTo(sx + i * 0.28, -19);
        ctx.stroke();
      }
    }
  }

  // A jumeoni (silk lucky pouch) hanging at her side below the sleeve: navy
  // with a gold 福 (good fortune), a red drawstring knot and a small tassel.
  {
    const px = -10.8;
    const py = -9.6;
    ctx.strokeStyle = P.goreumDeep;
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.moveTo(px + 1.4, -13.4);
    ctx.lineTo(px, py - 2.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px - 1.8, py - 1.6);
    ctx.quadraticCurveTo(px - 2.6, py + 1.8, px, py + 2.4);
    ctx.quadraticCurveTo(px + 2.6, py + 1.8, px + 1.8, py - 1.6);
    ctx.quadraticCurveTo(px, py - 2.2, px - 1.8, py - 1.6);
    ctx.closePath();
    ctx.fillStyle = '#2d3a7a';
    ctx.fill();
    outline(ctx, 0.3);
    // Gathered pleats at the neck, the drawstring and its knot.
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 0.18;
    for (const dx of [-1, 0, 1]) {
      ctx.beginPath();
      ctx.moveTo(px + dx * 0.9, py - 1.7);
      ctx.lineTo(px + dx * 1.1, py - 0.7);
      ctx.stroke();
    }
    ctx.strokeStyle = P.goreum;
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.moveTo(px - 1.7, py - 1.2);
    ctx.quadraticCurveTo(px, py - 0.7, px + 1.7, py - 1.2);
    ctx.stroke();
    ctx.fillStyle = P.goreum;
    ctx.beginPath();
    ctx.arc(px, py - 2.6, 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = P.gold;
    ctx.font = 'bold 1.9px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('福', px, py + 0.6);
    // A ring of gold embroidery dots round the 福.
    ctx.fillStyle = 'rgba(255,209,102,0.8)';
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(px + Math.cos(a) * 1.35, py + 0.6 + Math.sin(a) * 1.25, 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = P.ribbon;
    ctx.lineWidth = 0.22;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(px + i * 0.15, py + 2.4);
      ctx.lineTo(px + i * 0.3, py + 4.4);
      ctx.stroke();
    }
    roundRect(ctx, px - 0.4, py + 2.2, 0.8, 0.6, 0.2, P.gold);
  }

  // A small brass librarian's badge pinned on her jacket: "사서 은미".
  roundRect(ctx, 5.45, -34.2, 4.8, 2.4, 0.5, 'rgba(90,60,20,0.25)');
  roundRect(ctx, 5.2, -34.5, 4.8, 2.4, 0.5, P.gold);
  ctx.beginPath();
  ctx.roundRect(5.2, -34.5, 4.8, 2.4, 0.5);
  outline(ctx, 0.3);
  ctx.strokeStyle = 'rgba(120,80,20,0.6)';
  ctx.lineWidth = 0.15;
  ctx.beginPath();
  ctx.roundRect(5.5, -34.2, 4.2, 1.8, 0.35);
  ctx.stroke();
  ctx.fillStyle = '#5a3a1a';
  ctx.font = 'bold 1.25px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('사서 은미', 7.6, -33.3);

  // Hands folded in front, peeking from the cuffs.
  ctx.fillStyle = P.skin;
  ctx.beginPath();
  ctx.ellipse(-1.7, -15.2, 2.3, 1.35, 0.25, 0, Math.PI * 2);
  ctx.fill();
  outline(ctx, 0.4);
  ctx.fillStyle = P.skin;
  ctx.beginPath();
  ctx.ellipse(1.6, -14.8, 2.4, 1.35, -0.2, 0, Math.PI * 2);
  ctx.fill();
  outline(ctx, 0.4);
  ctx.strokeStyle = P.skinShade;
  ctx.lineWidth = 0.3;
  for (const fx of [2.2, 3.1]) {
    ctx.beginPath();
    ctx.moveTo(fx, -15.5);
    ctx.lineTo(fx + 0.4, -14.1);
    ctx.stroke();
  }
  for (const fx of [-2.6, -3.4]) {
    ctx.beginPath();
    ctx.moveTo(fx, -15.9);
    ctx.lineTo(fx - 0.3, -14.6);
    ctx.stroke();
  }
  // Pink-painted nails.
  ctx.fillStyle = '#ff9fbf';
  for (const [nx, ny] of [[3.4, -14.6], [3.1, -13.9], [-3.4, -15.3]]) {
    ctx.beginPath();
    ctx.ellipse(nx, ny, 0.35, 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
