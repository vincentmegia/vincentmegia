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
};

const P = HIMURA_PALETTE;

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
 * @param {{scale?: number, stress?: number, t?: number, walking?: boolean}} [opts]
 *   stress 0..1 (low Sanity): worried brows, a frown, a sweat drop.
 */
export function drawKimonoHimura(ctx, x, y, opts = {}) {
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
  drawBackHair(ctx, walk);
  drawFeet(ctx, walk);
  drawRobe(ctx);
  drawSleeves(ctx, walk);
  drawObi(ctx);
  drawCollar(ctx);
  drawHands(ctx);
  drawHead(ctx, stress, t);
  ctx.restore();
}

// -- Body -----------------------------------------------------------------------

function drawBackHair(ctx, walk) {
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
  grad.addColorStop(0, '#f2d27a');
  grad.addColorStop(1, '#c9982e');
  roundRect(ctx, -12, -28, 24, 9, 1, grad);
  ctx.beginPath();
  ctx.roundRect(-12, -28, 24, 9, 1);
  outline(ctx, 0.5);
  // Brocade: edge lines and a row of small diamonds, in deep red on the gold.
  ctx.strokeStyle = '#9a2a2a';
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
  roundRect(ctx, -2.6, -44, 5.2, 6, 2, P.skin);
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

function drawHead(ctx, stress, t) {
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

  // Ears, face.
  ctx.fillStyle = P.skinShade;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(dir * 10.4, HEAD_Y + 0.5, 1.6, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
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
  ctx.restore();

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
  ctx.lineCap = 'butt';

  drawFrontHair(ctx);
  drawNurseCap(ctx);

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
  ctx.strokeStyle = 'rgba(74,74,120,0.55)';
  ctx.lineWidth = 0.35;
  for (const sx of [-6.7, -2.2, 2.2, 6.7]) {
    ctx.beginPath();
    ctx.moveTo(sx * 0.9, HEAD_Y - 7.5);
    ctx.quadraticCurveTo(sx, HEAD_Y - 4.5, sx * 1.04, HEAD_Y - 2.6);
    ctx.stroke();
  }
  // Side locks framing the face, falling to the collar.
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 11.4, HEAD_Y - 5);
    ctx.quadraticCurveTo(dir * 12.6, HEAD_Y + 8, dir * 9.6, HEAD_Y + 17);
    ctx.quadraticCurveTo(dir * 9.2, HEAD_Y + 7, dir * 8.4, HEAD_Y - 2);
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
  ctx.strokeStyle = 'rgba(74,74,120,0.8)';
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
