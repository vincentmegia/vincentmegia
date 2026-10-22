// The Archivist (기록관), who strolls the 2nd Floor between the Reading Nook
// and the Stairs and finds a requested book when asked ("make others more
// detailed like them"). A slight, scholarly old gentleman: silver hair
// neatly side-parted, a trim grey moustache, kindly drooping eyes over
// half-moon reading glasses; a long cream archive coat with a pen-filled
// breast pocket and a magnifying glass on a chain, over a mustard
// cardigan, a striped shirt and a knitted navy tie; brown corduroy
// trousers and polished brogues; white cotton archival gloves. One hand
// leans on a crook-handled walnut cane that taps along with his stroll;
// the other holds a worn leather ledger with a ribbon and an old index
// card tucked in it. Layered flat shading, no eye highlights, like the
// game's other characters.
//
// Coordinates follow Hospital Shift's anime adult frame (feet at 0,
// shoulders about -40, face centre about -55); see staff-kit.js.

import {
  fillPath, rr, dot, isBlinkingAt, walkCycle, groundShadow, limbSegment, legPoses, kneeFold,
  sleeve, drawHand, drawFace, drawEars, drawNose, drawEyes, drawBrows, drawMouth, hairStrands,
} from './staff-kit.js';

const P = {
  skin: '#f6d6bd',
  skinShade: '#e2b496',
  skinDeep: '#c99a7a',
  hair: '#c8c6cc',
  hairMid: '#dcdae0',
  hairDeep: '#9a969e',
  iris: '#3a2e26',
  irisLight: '#7a6450',
  coat: '#f4f0e6',
  coatShade: '#ddd6c4',
  coatDeep: '#c4bca8',
  cardigan: '#c99a3a',
  cardiganShade: '#a87c2a',
  shirt: '#eef2f8',
  shirtStripe: '#9ab0d0',
  tie: '#2e3a5a',
  trousers: '#6a4e3a',
  trousersShade: '#543c2c',
  shoe: '#6a3a22',
  shoeShade: '#4a2614',
  glove: '#fbfaf6',
  cane: '#6a4228',
  caneLight: '#8a5a38',
  ledger: '#7a3a26',
  ledgerShade: '#5a2818',
  brass: '#c9a24a',
  lips: '#b87a72',
};

/** Whether he's blinking at time `t` (a slow, unhurried blink). */
export function isArchivistBlinkingAt(t) {
  return isBlinkingAt(t, 4.8, 3.2);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - feet centre
 * @param {number} y - feet line
 * @param {{scale?: number, t?: number, walking?: boolean}} [opts]
 */
export function drawArchivist(ctx, x, y, opts = {}) {
  const k = (opts.scale ?? 1) * 0.95; // a little stooped
  const t = opts.t ?? 0;
  // walk-styles.js's 'stroll' ambles at 2.2.
  const { phase, amount, stride, breathe } = walkCycle(t, 2.2, Boolean(opts.walking));
  // The cane taps down once a step, lifting between.
  const tap = amount ? Math.max(0, Math.sin(phase)) * 2.4 : 0;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  groundShadow(ctx, 14);
  drawCoatBack(ctx, stride);
  drawLegs(ctx, phase, amount);
  ctx.save();
  ctx.translate(0, -breathe * 0.4);
  drawTorso(ctx);
  drawCoatFront(ctx, stride, t);
  drawLedgerArm(ctx, stride);
  // His head sits a touch forward of his shoulders.
  ctx.save();
  ctx.translate(0.4, 0.8);
  drawHead(ctx, t);
  ctx.restore();
  drawCaneArm(ctx, tap);
  ctx.restore();
  ctx.restore();
}

// -- Legs and brogues -----------------------------------------------------------

function drawLegs(ctx, phase, amount) {
  // An unhurried stroll: short swing, a soft knee.
  for (const { dir, hip, knee, ankle, bend, pitch } of legPoses(phase, amount, { hipX: 3.6, swing: 0.14, bend: 0.3 })) {
    const fill = dir < 0 ? P.trousers : P.trousersShade;
    limbSegment(ctx, hip[0], hip[1], knee[0], knee[1], 6.6, 5.8, fill);
    limbSegment(ctx, knee[0], knee[1], ankle[0], ankle[1], 5.8, 5.4, fill);
    // Corduroy wales down the leg.
    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.lineWidth = 0.22;
    for (const off of [-1.6, -0.5, 0.6, 1.7]) {
      ctx.beginPath();
      ctx.moveTo(knee[0] + off, knee[1] - 4);
      ctx.lineTo(ankle[0] + off * 0.9, ankle[1] - 1);
      ctx.stroke();
    }
    kneeFold(ctx, knee, bend);
    ctx.save();
    ctx.translate(ankle[0], ankle[1]);
    ctx.rotate(pitch);
    drawBrogue(ctx);
    ctx.restore();
  }
}

function drawBrogue(ctx) {
  rr(ctx, -3, -2.2, 6, 2.6, 0.6);
  fillPath(ctx, P.trousersShade, 0.35);
  rr(ctx, -4, 4.4, 8.6, 1.5, 0.6);
  fillPath(ctx, '#2a1810', 0.4);
  ctx.beginPath();
  ctx.moveTo(-3.8, 4.6);
  ctx.quadraticCurveTo(-4, 0.4, -1.4, 0.2);
  ctx.lineTo(1.2, 0.4);
  ctx.quadraticCurveTo(4.6, 1, 4.4, 4.6);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 0.2, 0, 4.6);
  g.addColorStop(0, P.shoe);
  g.addColorStop(1, P.shoeShade);
  fillPath(ctx, g, 0.45);
  // The wingtip's punched broguing, a lace and a shine.
  ctx.fillStyle = 'rgba(30,14,8,0.6)';
  for (let i = 0; i < 6; i++) {
    const a = Math.PI * (0.15 + i * 0.14);
    ctx.beginPath();
    ctx.arc(2 + Math.cos(a) * 2, 3.4 - Math.sin(a) * 2, 0.16, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#d8c8a8';
  ctx.lineWidth = 0.25;
  ctx.beginPath();
  ctx.moveTo(-1.4, 1);
  ctx.lineTo(0.4, 1.4);
  ctx.moveTo(-1.4, 1.6);
  ctx.lineTo(0.4, 1);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.moveTo(2, 2.2);
  ctx.quadraticCurveTo(3.4, 2, 3.8, 3);
  ctx.stroke();
}

// -- Coat, cardigan, shirt -----------------------------------------------------------

function drawCoatBack(ctx, stride) {
  const sway = stride * 1.8;
  ctx.beginPath();
  ctx.moveTo(-11.6, -36);
  ctx.lineTo(-13 + sway * 0.4, -5);
  ctx.quadraticCurveTo(0, -3.6, 13 + sway * 0.4, -5);
  ctx.lineTo(11.6, -36);
  ctx.closePath();
  fillPath(ctx, P.coatDeep, 0.55);
}

function drawTorso(ctx) {
  // The shirt in the cardigan's V, striped, with the knitted tie.
  ctx.beginPath();
  ctx.moveTo(-5, -43.4);
  ctx.lineTo(5, -43.4);
  ctx.lineTo(6.2, -18.6);
  ctx.lineTo(-6.2, -18.6);
  ctx.closePath();
  fillPath(ctx, P.shirt, 0.5);
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = P.shirtStripe;
  ctx.lineWidth = 0.3;
  for (let xx = -6; xx <= 6; xx += 1.1) {
    ctx.beginPath();
    ctx.moveTo(xx, -44);
    ctx.lineTo(xx, -18);
    ctx.stroke();
  }
  ctx.restore();
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, -44.6);
    ctx.lineTo(dir * 4.2, -45.4);
    ctx.lineTo(dir * 3.4, -41.6);
    ctx.lineTo(dir * 0.6, -42.4);
    ctx.closePath();
    fillPath(ctx, P.shirt, 0.35);
  }
  // A knitted tie: square-ended, with a textured weave.
  ctx.beginPath();
  ctx.moveTo(-1, -43);
  ctx.lineTo(1, -43);
  ctx.lineTo(1.3, -31);
  ctx.lineTo(-1.3, -31);
  ctx.closePath();
  fillPath(ctx, P.tie, 0.35);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  for (let yy = -42; yy < -31.5; yy += 0.9) ctx.fillRect(-0.9, yy, 1.8, 0.3);
  rr(ctx, -1.2, -44.2, 2.4, 1.6, 0.5);
  fillPath(ctx, P.tie, 0.3);
  // The mustard cardigan, buttoned, its V framing the tie.
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 4.4, -43.2);
    ctx.quadraticCurveTo(dir * 9.6, -42.8, dir * 10.2, -37.6);
    ctx.lineTo(dir * 9.8, -17.6);
    ctx.lineTo(0, -17.6);
    ctx.lineTo(0, -30);
    ctx.closePath();
    fillPath(ctx, dir < 0 ? P.cardigan : P.cardiganShade, 0.5);
  }
  ctx.strokeStyle = 'rgba(90,60,10,0.4)';
  ctx.lineWidth = 0.22;
  for (let yy = -28; yy < -18; yy += 0.8) {
    ctx.beginPath();
    ctx.moveTo(-6, yy);
    ctx.lineTo(6, yy);
    ctx.stroke();
  }
  for (const by of [-28, -24.6, -21.2]) dot(ctx, 0, by, 0.55, '#6a4a22', 0.15);
}

function drawCoatFront(ctx, stride, t) {
  const sway = stride * 1.8;
  for (const dir of [-1, 1]) {
    const hem = dir * 13.2 + sway * 0.5;
    ctx.beginPath();
    ctx.moveTo(dir * 5, -43.6);
    ctx.quadraticCurveTo(dir * 11.4, -43, dir * 11.8, -36);
    ctx.lineTo(hem, -5);
    ctx.lineTo(dir * 7.4 + sway * 0.3, -4.6);
    ctx.lineTo(dir * 6.6, -24);
    ctx.lineTo(dir * 5.4, -34);
    ctx.closePath();
    const g = ctx.createLinearGradient(dir * 5, 0, dir * 13, 0);
    g.addColorStop(0, '#fffdf6');
    g.addColorStop(0.5, P.coat);
    g.addColorStop(1, P.coatShade);
    fillPath(ctx, g, 0.6);
    // A shawl lapel and a long fold down the coat.
    ctx.beginPath();
    ctx.moveTo(dir * 5, -43.6);
    ctx.quadraticCurveTo(dir * 9.4, -40, dir * 7, -28);
    ctx.lineTo(dir * 5.4, -34);
    ctx.closePath();
    fillPath(ctx, P.coatShade, 0.4);
    ctx.strokeStyle = 'rgba(140,120,90,0.35)';
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(dir * 10.2, -30);
    ctx.quadraticCurveTo(dir * 11, -18, dir * 11.6 + sway * 0.4, -6);
    ctx.stroke();
    // Patch pockets at the hip.
    rr(ctx, dir * 9.4 - 2.8 + sway * 0.2, -16, 5.6, 5.4, 0.6);
    fillPath(ctx, P.coat, 0.4);
    ctx.strokeStyle = 'rgba(140,120,90,0.5)';
    ctx.lineWidth = 0.2;
    ctx.setLineDash([0.4, 0.3]);
    ctx.beginPath();
    ctx.moveTo(dir * 9.4 - 2.4 + sway * 0.2, -15.4);
    ctx.lineTo(dir * 9.4 + 2.4 + sway * 0.2, -15.4);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // The breast pocket on his left (viewer's right): a fountain pen, a pencil
  // and a red pen, and the magnifying glass's chain looping to a button.
  for (const [px, col, h] of [[6.8, '#1e1a22', 3.4], [8, '#ffd166', 2.6], [9, '#d23a4a', 3]]) {
    rr(ctx, px - 0.4, -33.6 - h, 0.8, h + 1, 0.3);
    fillPath(ctx, col, 0.2);
  }
  dot(ctx, 6.8, -37, 0.3, P.brass, 0);
  rr(ctx, 5.8, -34, 4.6, 3.6, 0.4);
  fillPath(ctx, P.coat, 0.4);
  // The magnifying glass, hanging and swinging gently.
  const swing = Math.sin(t * 1.4) * 0.15 + stride * 0.1;
  ctx.strokeStyle = P.brass;
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  ctx.moveTo(10.2, -32);
  ctx.quadraticCurveTo(9.4, -27, 8 + swing * 6, -24.2);
  ctx.stroke();
  ctx.save();
  ctx.translate(8 + swing * 6, -24.2);
  ctx.rotate(swing);
  rr(ctx, -0.4, 0, 0.8, 2.4, 0.3);
  fillPath(ctx, '#3a2418', 0.2);
  ctx.beginPath();
  ctx.arc(0, 4.2, 2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(200,230,255,0.45)';
  ctx.fill();
  ctx.strokeStyle = P.brass;
  ctx.lineWidth = 0.55;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  ctx.arc(0, 4.2, 1.3, Math.PI * 1.1, Math.PI * 1.5);
  ctx.stroke();
  ctx.restore();
  // A small library pin on his lapel.
  rr(ctx, -8.6, -38.6, 2, 2.4, 0.3);
  fillPath(ctx, P.brass, 0.25);
  ctx.fillStyle = '#2e3a5a';
  ctx.fillRect(-8.2, -38, 1.2, 1.2);
}

// -- Arms ---------------------------------------------------------------------

/** His right arm (viewer's left) rests on the cane, which taps as he walks. */
function drawCaneArm(ctx, tap) {
  const shoulder = [-10.8, -39];
  const grip = [-15.6, -22.6 - tap];
  const elbow = [-14.2, -30.4 - tap * 0.4];
  // The shaft, from its rubber tip to the crook.
  const tip = [-17.4, 5.6 - tap];
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(30,18,12,0.7)';
  ctx.lineWidth = 2.1;
  ctx.beginPath();
  ctx.moveTo(...tip);
  ctx.lineTo(grip[0] - 0.4, grip[1] + 1);
  ctx.stroke();
  ctx.strokeStyle = P.cane;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.strokeStyle = P.caneLight;
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.moveTo(tip[0] - 0.3, tip[1] - 1);
  ctx.lineTo(grip[0] - 0.7, grip[1] + 1.4);
  ctx.stroke();
  // The crook curling over his hand, a brass collar below it.
  ctx.strokeStyle = 'rgba(30,18,12,0.7)';
  ctx.lineWidth = 2.1;
  ctx.beginPath();
  ctx.arc(grip[0] + 1.8, grip[1] - 0.2, 2.2, Math.PI, Math.PI * 1.95);
  ctx.stroke();
  ctx.strokeStyle = P.cane;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.lineCap = 'butt';
  rr(ctx, grip[0] - 1.2, grip[1] + 2.4, 1.8, 0.9, 0.3);
  fillPath(ctx, P.brass, 0.2);
  rr(ctx, tip[0] - 0.9, tip[1] - 0.4, 1.8, 1.4, 0.4);
  fillPath(ctx, '#1e1a1a', 0.2);
  sleeve(ctx, shoulder, elbow, grip, P.coat, P.coatShade, 5.2);
  rr(ctx, grip[0] - 2.2, grip[1] - 2.2, 4.4, 1.6, 0.5);
  fillPath(ctx, P.coatShade, 0.3);
  drawHand(ctx, grip[0] + 0.4, grip[1] - 0.6, 0.4, { glove: P.glove });
}

/** His left arm (viewer's right) holds the ledger against his chest. */
function drawLedgerArm(ctx, stride) {
  const shoulder = [10.8, -39];
  const elbow = [13.6, -29.6 + stride * 0.3];
  const wrist = [7.2, -28.4];
  sleeve(ctx, shoulder, elbow, wrist, P.coat, P.coatShade, 5.2);
  // The ledger, tilted against him: a cracked leather cover, brass corners,
  // a ribbon and an index card sticking out.
  ctx.save();
  ctx.translate(5.6, -31.4);
  ctx.rotate(-0.3);
  rr(ctx, 3.2, -6.2, 1, 3, 0.2);
  fillPath(ctx, '#d23a4a', 0.2);
  rr(ctx, -3.4, -7.8, 3.6, 2.8, 0.2);
  fillPath(ctx, '#fbf2d8', 0.25);
  ctx.strokeStyle = '#d23a4a';
  ctx.lineWidth = 0.2;
  ctx.beginPath();
  ctx.moveTo(-3.2, -7);
  ctx.lineTo(0, -7);
  ctx.stroke();
  rr(ctx, -4.6, -5.6, 9.2, 11.2, 0.6);
  const g = ctx.createLinearGradient(-4.6, 0, 4.6, 0);
  g.addColorStop(0, P.ledger);
  g.addColorStop(1, P.ledgerShade);
  fillPath(ctx, g, 0.5);
  ctx.strokeStyle = 'rgba(255,220,180,0.25)';
  ctx.lineWidth = 0.25;
  ctx.beginPath();
  ctx.moveTo(-3, -2);
  ctx.lineTo(-1.6, -0.4);
  ctx.lineTo(-2.4, 1.6);
  ctx.moveTo(2, 2.4);
  ctx.lineTo(3, 3.6);
  ctx.stroke();
  // Gilt title panel and spine bands.
  rr(ctx, -2.4, -3.4, 4.8, 2.4, 0.3);
  fillPath(ctx, P.ledgerShade, 0.25);
  ctx.strokeStyle = P.brass;
  ctx.lineWidth = 0.25;
  ctx.strokeRect(-2.2, -3.2, 4.4, 2);
  ctx.fillStyle = P.brass;
  ctx.fillRect(-1.6, -2.4, 3.2, 0.3);
  for (const by of [-4.4, 4]) ctx.fillRect(-4.6, by, 1.2, 0.4);
  for (const [cx, cy] of [[-4.6, -5.6], [4.6, -5.6], [-4.6, 5.6], [4.6, 5.6]]) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx - Math.sign(cx) * 1.4, cy);
    ctx.lineTo(cx, cy - Math.sign(cy) * 1.4);
    ctx.closePath();
    fillPath(ctx, P.brass, 0.15);
  }
  ctx.restore();
  rr(ctx, wrist[0] - 2, wrist[1] - 2, 4, 1.6, 0.5);
  fillPath(ctx, P.coatShade, 0.3);
  drawHand(ctx, wrist[0] - 0.6, wrist[1], 1.4, { glove: P.glove });
}

// -- Head -----------------------------------------------------------------------

const HEAD_Y = -55;
const EYE_Y = -54.4;

function drawHead(ctx, t) {
  rr(ctx, -2.6, -47.4, 5.2, 4.2, 1);
  fillPath(ctx, P.skinShade, 0.45);
  ctx.fillStyle = P.hair;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(dir * 8.8, HEAD_Y - 1.8, 1.9, 4.6, dir * 0.1, 0, Math.PI * 2);
    fillPath(ctx, P.hair, 0.3);
  }
  drawEars(ctx, HEAD_Y, P.skin, P.skinDeep, { x: 9.6 });
  drawFace(ctx, HEAD_Y, P.skin, P.skinShade, { w: 9.2, chin: 11 });
  const blinking = isArchivistBlinkingAt(t);
  drawEyes(ctx, EYE_Y, { iris: P.iris, irisLight: P.irisLight }, { droop: 0.9, shape: 'narrow', blinking });
  // Age lines: under the eyes, at the corners, across the brow.
  ctx.strokeStyle = 'rgba(160,100,80,0.45)';
  ctx.lineWidth = 0.28;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 2.6, EYE_Y + 2.2);
    ctx.quadraticCurveTo(dir * 4.4, EYE_Y + 3, dir * 6.4, EYE_Y + 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(dir * 7.6, EYE_Y + 0.6);
    ctx.lineTo(dir * 8.8, EYE_Y + 1.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(dir * 3.4, EYE_Y + 5.2);
    ctx.quadraticCurveTo(dir * 4.6, EYE_Y + 7.2, dir * 4, EYE_Y + 9.2);
    ctx.stroke();
  }
  for (const dy of [-8.4, -7.2]) {
    ctx.beginPath();
    ctx.moveTo(-3.6, EYE_Y + dy);
    ctx.quadraticCurveTo(0, EYE_Y + dy - 0.6, 3.6, EYE_Y + dy);
    ctx.stroke();
  }
  // Bushy white brows, a little wild.
  drawBrows(ctx, EYE_Y, P.hairMid, { thick: 1.1, lift: 0.8, y: -4.2 });
  ctx.strokeStyle = P.hairDeep;
  ctx.lineWidth = 0.25;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 6.4, EYE_Y - 4.6);
    ctx.lineTo(dir * 7.4, EYE_Y - 5.4);
    ctx.stroke();
  }
  drawNose(ctx, EYE_Y, 'rgba(180,110,90,0.65)', 1);
  drawMouth(ctx, HEAD_Y, 'smile', P.lips);
  // A trim grey moustache over a gentle smile.
  ctx.beginPath();
  ctx.moveTo(0, HEAD_Y + 4.8);
  ctx.quadraticCurveTo(-2.4, HEAD_Y + 4.2, -3.6, HEAD_Y + 6);
  ctx.quadraticCurveTo(-1.6, HEAD_Y + 5.6, 0, HEAD_Y + 5.8);
  ctx.quadraticCurveTo(1.6, HEAD_Y + 5.6, 3.6, HEAD_Y + 6);
  ctx.quadraticCurveTo(2.4, HEAD_Y + 4.2, 0, HEAD_Y + 4.8);
  ctx.closePath();
  fillPath(ctx, P.hair, 0.35);
  hairStrands(ctx, HEAD_Y, [[-2.8, 5.4, -1.6, 4.9, -0.4, 5.2], [2.8, 5.4, 1.6, 4.9, 0.4, 5.2]], P.hairDeep, 0.22);
  drawHalfMoonGlasses(ctx);
  drawHair(ctx);
}

function drawHalfMoonGlasses(ctx) {
  // Half-moon readers perched low on his nose, so he looks over them.
  const gy = EYE_Y + 2.4;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 1.4, gy);
    ctx.lineTo(dir * 6.8, gy);
    ctx.quadraticCurveTo(dir * 6.6, gy + 3, dir * 4.1, gy + 3);
    ctx.quadraticCurveTo(dir * 1.6, gy + 3, dir * 1.4, gy);
    ctx.closePath();
    ctx.fillStyle = 'rgba(200,220,255,0.2)';
    ctx.fill();
    ctx.strokeStyle = P.brass;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-1.4, gy);
  ctx.quadraticCurveTo(0, gy - 0.9, 1.4, gy);
  ctx.moveTo(-6.8, gy);
  ctx.lineTo(-9.4, gy - 2);
  ctx.moveTo(6.8, gy);
  ctx.lineTo(9.4, gy - 2);
  ctx.stroke();
}

function drawHair(ctx) {
  // Neatly combed silver hair from a side part, thinning a little on top.
  ctx.beginPath();
  ctx.moveTo(-9.6, HEAD_Y - 1);
  ctx.bezierCurveTo(-11.4, HEAD_Y - 18.6, 11.4, HEAD_Y - 18.6, 9.6, HEAD_Y - 1);
  ctx.quadraticCurveTo(9.2, HEAD_Y - 5.6, 7.8, HEAD_Y - 7.6);
  ctx.quadraticCurveTo(1, HEAD_Y - 10.6, -4.6, HEAD_Y - 10);
  ctx.quadraticCurveTo(-8, HEAD_Y - 8.4, -8.8, HEAD_Y - 4);
  ctx.closePath();
  const g = ctx.createLinearGradient(-10, HEAD_Y - 17, 10, HEAD_Y - 2);
  g.addColorStop(0, P.hairMid);
  g.addColorStop(1, P.hair);
  fillPath(ctx, g, 0.55);
  ctx.save();
  ctx.clip();
  hairStrands(ctx, HEAD_Y, [
    [-4.4, -15.6, 2, -16, 9, -6], [-4.4, -15.6, 3, -13, 8, -8.4], [-4.4, -15.6, 0, -11.6, 5, -9.8],
    [-4.4, -15.6, -7, -13, -9, -3], [-4.4, -15.6, -6, -11, -7.6, -6],
  ], P.hairDeep, 0.3);
  // A soft pinkish sheen of scalp through the thinning crown.
  ctx.fillStyle = 'rgba(246,214,189,0.35)';
  ctx.beginPath();
  ctx.ellipse(1.6, HEAD_Y - 14.2, 3.6, 1.6, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = P.hairDeep;
  ctx.lineWidth = 0.45;
  ctx.beginPath();
  ctx.moveTo(-4.4, HEAD_Y - 14);
  ctx.lineTo(-5, HEAD_Y - 11);
  ctx.stroke();
  // A combed wave lifting off the part over his forehead.
  ctx.beginPath();
  ctx.moveTo(-4.6, HEAD_Y - 11);
  ctx.quadraticCurveTo(0, HEAD_Y - 12.8, 5.4, HEAD_Y - 9.2);
  ctx.quadraticCurveTo(1, HEAD_Y - 9.8, -4.2, HEAD_Y - 9.4);
  ctx.closePath();
  fillPath(ctx, P.hairMid, 0.4);
}
