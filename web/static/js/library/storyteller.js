// The Storyteller (동화 선생님), who dances about under the 2nd Floor's Kids
// Shelf and holds story time when asked, giving everyone waiting more
// patience ("make others more detailed like them"). A bubbly woman with an
// auburn bob and a blunt fringe under a pink beret with a felt star; big
// sparkly-lashed eyes, rosy cheeks, always mid-sentence; a yellow
// puff-sleeved top under a pink apron with a scalloped hem, a rainbow
// pocket full of crayons and a stitched heart; a sky-blue skirt, white
// tights with a polka dot or two, and pink bar shoes. A folk-tale tiger
// (호랑이) hand puppet on one hand snaps its mouth as she talks; the other
// holds a picture book open toward her audience, a moon and a rabbit on
// its pages. Layered flat shading, no eye highlights, like the game's
// other characters.
//
// Coordinates follow Hospital Shift's anime adult frame (feet at 0,
// shoulders about -40, face centre about -55); see staff-kit.js.

import {
  fillPath, rr, dot, isBlinkingAt, walkCycle, groundShadow, limbSegment, legPoses,
  sleeve, drawHand, drawFace, drawEars, drawNose, drawEyes, drawBrows, drawMouth, drawBlush, hairStrands,
} from './staff-kit.js';

const P = {
  skin: '#efc49f',
  skinShade: '#dca580',
  skinDeep: '#c08860',
  hair: '#8a4a2a',
  hairMid: '#a85e36',
  hairDeep: '#5e2e18',
  hairShine: 'rgba(250,180,130,0.55)',
  iris: '#5a3a2a',
  irisLight: '#b07a4a',
  top: '#ffd166',
  topShade: '#e8b448',
  apron: '#ff8fb8',
  apronShade: '#e8709c',
  apronLight: '#ffb0cc',
  skirt: '#4fa8e0',
  skirtShade: '#3a88c0',
  tights: '#ffffff',
  tightsShade: '#e4e6ee',
  shoe: '#e8558f',
  shoeShade: '#c03a70',
  beret: '#e8558f',
  beretShade: '#c03a70',
  tiger: '#f29a3a',
  tigerShade: '#d4782a',
  stripe: '#2a1e1a',
  lips: '#d8606a',
};

/** Whether she's blinking at time `t`. */
export function isStorytellerBlinkingAt(t) {
  return isBlinkingAt(t, 2.9, 1.7);
}

/** How open her mouth (and the tiger's) is at time `t`, 0..1: she's always telling a story. */
export function storytellerTalkAt(t) {
  // Words in bursts, with a pause between sentences.
  const sentence = ((t % 3.2) + 3.2) % 3.2;
  if (sentence > 2.6) return 0;
  return Math.max(0, Math.sin(t * 11)) * (0.6 + 0.4 * Math.sin(t * 3.7) ** 2);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - feet centre
 * @param {number} y - feet line
 * @param {{scale?: number, t?: number, walking?: boolean}} [opts]
 */
export function drawStoryteller(ctx, x, y, opts = {}) {
  const k = (opts.scale ?? 1) * 0.96;
  const t = opts.t ?? 0;
  // walk-styles.js's 'dance' bobs twice per 2.6-cycle; the legs keep step.
  const { phase, amount, stride, breathe } = walkCycle(t, 5.2, Boolean(opts.walking));
  const talk = storytellerTalkAt(t);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  groundShadow(ctx, 13);
  drawHairBack(ctx);
  drawLegs(ctx, phase, amount);
  ctx.save();
  ctx.translate(0, -breathe * 0.4);
  drawSkirt(ctx, stride);
  drawTorso(ctx, stride);
  drawHead(ctx, t, talk);
  drawBookArm(ctx, stride, t);
  drawPuppetArm(ctx, stride, talk, t);
  ctx.restore();
  ctx.restore();
}

// -- Legs ---------------------------------------------------------------------

function drawLegs(ctx, phase, amount) {
  // A dancer's step: light, with a pointed toe on the swing.
  for (const { dir, hip, knee, ankle, pitch } of legPoses(phase, amount, { hipX: 3.2, hipY: -18, thigh: 9.6, shin: 10.4, swing: 0.26, bend: 0.55 })) {
    const fill = dir < 0 ? P.tights : P.tightsShade;
    limbSegment(ctx, hip[0], hip[1], knee[0], knee[1], 5, 4.2, fill, 0.45);
    limbSegment(ctx, knee[0], knee[1], ankle[0], ankle[1], 4.2, 3.4, fill, 0.45);
    // A few pink polka dots on the tights.
    for (const f of [0.3, 0.7]) {
      dot(ctx, knee[0] + (ankle[0] - knee[0]) * f + dir * 0.6, knee[1] + (ankle[1] - knee[1]) * f, 0.45, '#ffb0cc', 0);
    }
    dot(ctx, hip[0] + (knee[0] - hip[0]) * 0.8 - dir * 0.4, hip[1] + (knee[1] - hip[1]) * 0.8, 0.45, '#ffb0cc', 0);
    ctx.save();
    ctx.translate(ankle[0], ankle[1]);
    ctx.rotate(pitch);
    drawBarShoe(ctx);
    ctx.restore();
  }
}

function drawBarShoe(ctx) {
  rr(ctx, -3.4, 4, 7.2, 1.3, 0.6);
  fillPath(ctx, '#ffffff', 0.35);
  ctx.beginPath();
  ctx.moveTo(-3.2, 4.2);
  ctx.quadraticCurveTo(-3.4, 0.8, -1, 0.8);
  ctx.lineTo(1, 0.8);
  ctx.quadraticCurveTo(4, 1, 3.6, 4.2);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 0.8, 0, 4.4);
  g.addColorStop(0, P.shoe);
  g.addColorStop(1, P.shoeShade);
  fillPath(ctx, g, 0.4);
  // The bar strap with a heart-shaped button.
  ctx.strokeStyle = P.shoeShade;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(-2.4, 1.2);
  ctx.lineTo(2.2, 1.2);
  ctx.stroke();
  ctx.save();
  ctx.translate(1.6, 1.2);
  ctx.beginPath();
  ctx.moveTo(0, 0.5);
  ctx.bezierCurveTo(-0.9, -0.1, -0.5, -0.8, 0, -0.35);
  ctx.bezierCurveTo(0.5, -0.8, 0.9, -0.1, 0, 0.5);
  fillPath(ctx, '#ffd166', 0.1);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.moveTo(1.4, 2.8);
  ctx.quadraticCurveTo(2.6, 2.6, 2.9, 3.4);
  ctx.stroke();
}

// -- Clothes ------------------------------------------------------------------

function drawSkirt(ctx, stride) {
  // A full skirt that flares and swishes as she dances.
  const sway = stride * 2.2;
  ctx.beginPath();
  ctx.moveTo(-8.6, -22);
  ctx.lineTo(8.6, -22);
  ctx.quadraticCurveTo(12 + sway, -14, 13.6 + sway, -9);
  for (let i = 6; i >= -6; i--) ctx.quadraticCurveTo(i * 2.2 + 1.1 + sway, -7.4, i * 2.2 + sway * (0.5 + Math.abs(i) * 0.08), -9 + (i % 2 ? 0.5 : 0));
  ctx.quadraticCurveTo(-12 + sway, -14, -8.6, -22);
  ctx.closePath();
  const g = ctx.createLinearGradient(-13, 0, 13, 0);
  g.addColorStop(0, '#78c0ec');
  g.addColorStop(0.5, P.skirt);
  g.addColorStop(1, P.skirtShade);
  fillPath(ctx, g, 0.55);
  ctx.strokeStyle = 'rgba(20,70,120,0.4)';
  ctx.lineWidth = 0.35;
  for (let i = -4; i <= 4; i += 2) {
    ctx.beginPath();
    ctx.moveTo(i * 1.6, -20.6);
    ctx.quadraticCurveTo(i * 2.4 + sway * 0.4, -14, i * 2.9 + sway * 0.7, -9);
    ctx.stroke();
  }
  // Little white stars printed on it.
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (const [sx, sy] of [[-9, -12], [-4.4, -16.4], [2.6, -13], [8, -15.6], [-1, -10], [10.6, -10.6]]) {
    star(ctx, sx + sway * 0.4, sy, 0.8);
    ctx.fill();
  }
}

function star(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? r * 0.45 : r;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    if (i === 0) ctx.moveTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
    else ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  ctx.closePath();
}

function drawTorso(ctx, stride) {
  // The yellow top.
  ctx.beginPath();
  ctx.moveTo(-4.6, -43.6);
  ctx.quadraticCurveTo(-10, -43, -9.8, -37);
  ctx.lineTo(-8.6, -21);
  ctx.quadraticCurveTo(0, -19.6, 8.6, -21);
  ctx.lineTo(9.8, -37);
  ctx.quadraticCurveTo(10, -43, 4.6, -43.6);
  ctx.closePath();
  fillPath(ctx, P.top, 0.6);
  // A rounded collar trimmed in white rick-rack.
  ctx.beginPath();
  ctx.ellipse(0, -43.6, 4.4, 1.8, 0, 0, Math.PI);
  fillPath(ctx, P.topShade, 0.4);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * Math.PI;
    const r = i % 2 ? 4.1 : 4.6;
    const px = Math.cos(a) * r;
    const py = -43.4 + Math.sin(a) * r * 0.42;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  // The apron: a bib on a neck strap, ties at the waist, a scalloped hem.
  const sway = stride * 1.4;
  ctx.strokeStyle = P.apronShade;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(-4.4, -36);
  ctx.lineTo(-3, -44.4);
  ctx.moveTo(4.4, -36);
  ctx.lineTo(3, -44.4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-5, -37);
  ctx.lineTo(5, -37);
  ctx.lineTo(5.6, -24);
  ctx.lineTo(9.4, -23.4);
  ctx.lineTo(10.4 + sway, -10.6);
  for (let i = 5; i >= -5; i--) {
    const sx = i * 2 + sway * 0.6;
    ctx.quadraticCurveTo(sx + 1, -8.6, sx, -10.6);
  }
  ctx.lineTo(-10.4 + sway, -10.6);
  ctx.lineTo(-9.4, -23.4);
  ctx.lineTo(-5.6, -24);
  ctx.closePath();
  const g = ctx.createLinearGradient(-10, 0, 10, 0);
  g.addColorStop(0, P.apronLight);
  g.addColorStop(0.5, P.apron);
  g.addColorStop(1, P.apronShade);
  fillPath(ctx, g, 0.55);
  // The waist ties, a bow at her side.
  rr(ctx, -9.8, -24.4, 19.6, 1.6, 0.5);
  fillPath(ctx, P.apronShade, 0.35);
  ctx.save();
  ctx.translate(9.6, -23.6);
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(dir * 1.2, -0.3, 1.3, 0.8, dir * 0.4, 0, Math.PI * 2);
    fillPath(ctx, P.apronShade, 0.3);
  }
  rr(ctx, 0, 0, 0.9, 3.6, 0.3);
  fillPath(ctx, P.apronShade, 0.25);
  rr(ctx, -1.2, 0, 0.9, 3, 0.3);
  fillPath(ctx, P.apronShade, 0.25);
  ctx.restore();
  // A stitched heart on the bib.
  ctx.save();
  ctx.translate(0, -31.4);
  ctx.beginPath();
  ctx.moveTo(0, 2.2);
  ctx.bezierCurveTo(-3.4, -0.2, -2, -3, 0, -1.4);
  ctx.bezierCurveTo(2, -3, 3.4, -0.2, 0, 2.2);
  fillPath(ctx, '#ffffff', 0.35);
  ctx.strokeStyle = P.apronShade;
  ctx.lineWidth = 0.25;
  ctx.setLineDash([0.4, 0.3]);
  ctx.beginPath();
  ctx.moveTo(0, 1.4);
  ctx.bezierCurveTo(-2.6, -0.2, -1.6, -2.2, 0, -0.9);
  ctx.bezierCurveTo(1.6, -2.2, 2.6, -0.2, 0, 1.4);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  // The rainbow pocket, crayons poking out.
  for (const [cx, col, h] of [[-4.6, '#e8558f', 3], [-3.2, '#ffd166', 3.6], [-1.8, '#7ac74f', 2.6], [-0.4, '#4fa8e0', 3.2], [1, '#8f7ae0', 2.4]]) {
    rr(ctx, cx - 0.55 + sway * 0.4, -20.4 - h, 1.1, h + 1, 0.2);
    fillPath(ctx, col, 0.2);
    ctx.beginPath();
    ctx.moveTo(cx - 0.55 + sway * 0.4, -20.4 - h);
    ctx.lineTo(cx + sway * 0.4, -21.4 - h);
    ctx.lineTo(cx + 0.55 + sway * 0.4, -20.4 - h);
    ctx.closePath();
    fillPath(ctx, col, 0.15);
  }
  rr(ctx, -6.4 + sway * 0.4, -20.6, 9, 5.6, 0.8);
  fillPath(ctx, '#ffffff', 0.4);
  ['#e8558f', '#ffd166', '#7ac74f', '#4fa8e0'].forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.fillRect(-6.1 + sway * 0.4, -19.8 + i * 1.2, 8.4, 0.7);
  });
}

// -- Arms, the book and the puppet -----------------------------------------------------

function puffSleeve(ctx, shoulder, dir) {
  ctx.beginPath();
  ctx.ellipse(shoulder[0] + dir * 0.8, shoulder[1] + 2.4, 3.4, 3.6, dir * 0.3, 0, Math.PI * 2);
  fillPath(ctx, P.top, 0.5);
  ctx.strokeStyle = P.topShade;
  ctx.lineWidth = 0.3;
  for (const a of [-0.6, 0, 0.6]) {
    ctx.beginPath();
    ctx.moveTo(shoulder[0] + dir * 0.8 + Math.sin(a) * 2.6, shoulder[1] - 0.4);
    ctx.lineTo(shoulder[0] + dir * 0.8 + Math.sin(a) * 3, shoulder[1] + 4.6);
    ctx.stroke();
  }
  rr(ctx, shoulder[0] + dir * 0.8 - 2.8, shoulder[1] + 5, 5.6, 1, 0.4);
  fillPath(ctx, '#ffffff', 0.3);
}

/** Her right arm (viewer's left) holds the picture book open, facing out. */
function drawBookArm(ctx, stride, t) {
  const shoulder = [-9.6, -39.6];
  const lift = Math.sin(t * 1.3) * 0.6;
  const elbow = [-14.2, -31];
  const wrist = [-13.4, -36.4 + lift];
  sleeve(ctx, [shoulder[0] - 0.6, shoulder[1] + 3], elbow, wrist, P.skin, P.skinShade, 3.4);
  puffSleeve(ctx, shoulder, -1);
  // The open book: two pages, a spine, a moon and a rabbit on the left page
  // and a tiger's paw-print on the right.
  ctx.save();
  ctx.translate(-14.4, -42.6 + lift);
  ctx.rotate(-0.08 + stride * 0.03);
  ctx.beginPath();
  ctx.moveTo(-6.4, -4);
  ctx.quadraticCurveTo(-3.2, -4.8, 0, -4);
  ctx.lineTo(0, 4.2);
  ctx.quadraticCurveTo(-3.2, 3.4, -6.4, 4.2);
  ctx.closePath();
  fillPath(ctx, '#1e3a6a', 0.45);
  ctx.beginPath();
  ctx.moveTo(0, -4);
  ctx.quadraticCurveTo(3.2, -4.8, 6.4, -4);
  ctx.lineTo(6.4, 4.2);
  ctx.quadraticCurveTo(3.2, 3.4, 0, 4.2);
  ctx.closePath();
  fillPath(ctx, '#fff8e6', 0.45);
  // The night-sky page: a crescent moon and a rabbit pounding rice cakes.
  ctx.fillStyle = '#ffe680';
  ctx.beginPath();
  ctx.arc(-3.2, -1.2, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1e3a6a';
  ctx.beginPath();
  ctx.arc(-2.4, -1.6, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(-3.8, 2.2, 1, 0.8, 0, 0, Math.PI * 2);
  ctx.ellipse(-3.4, 0.8, 0.25, 0.8, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (const [sx, sy] of [[-5.4, -2.6], [-1.2, 2.4], [-5.6, 0.6]]) {
    star(ctx, sx, sy, 0.45);
    ctx.fill();
  }
  // The other page: a paw print and a few lines of text.
  ctx.fillStyle = P.tiger;
  ctx.beginPath();
  ctx.ellipse(3.2, -0.6, 1.1, 0.9, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const [px, py] of [[2, -2], [3.2, -2.5], [4.4, -2]]) {
    ctx.beginPath();
    ctx.arc(px, py, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#9a8a74';
  for (const ly of [1.4, 2.3, 3.1]) ctx.fillRect(1, ly, 4.4, 0.35);
  // The spine shadow.
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.moveTo(0, -4);
  ctx.lineTo(0, 4.2);
  ctx.stroke();
  ctx.restore();
  drawHand(ctx, wrist[0] + 0.6, wrist[1] - 1.4, 2.8, { skin: P.skin, deep: P.skinDeep });
  // A stack of bangles.
  for (const [col, dy] of [['#ffd166', 0], ['#7ac74f', 0.6], ['#e8558f', 1.2]]) {
    ctx.strokeStyle = col;
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.ellipse(wrist[0], wrist[1] + 0.8 + dy, 1.6, 0.5, -0.2, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** Her left arm (viewer's right) wears the tiger puppet, raised and talking. */
function drawPuppetArm(ctx, stride, talk, t) {
  const shoulder = [9.6, -39.6];
  const wave = Math.sin(t * 2.2) * 0.8 + stride * 0.6;
  const elbow = [14, -30.6];
  const wrist = [15.2 + wave * 0.3, -36.4];
  sleeve(ctx, [shoulder[0] + 0.6, shoulder[1] + 3], elbow, wrist, P.skin, P.skinShade, 3.4);
  puffSleeve(ctx, shoulder, 1);
  ctx.save();
  ctx.translate(wrist[0], wrist[1] - 2);
  ctx.rotate(-0.15 + wave * 0.05);
  // The sleeve of the puppet over her forearm.
  ctx.beginPath();
  ctx.moveTo(-2.6, 2);
  ctx.lineTo(2.6, 2);
  ctx.lineTo(2.2, 5.4);
  ctx.lineTo(-2.2, 5.4);
  ctx.closePath();
  fillPath(ctx, P.tiger, 0.45);
  ctx.fillStyle = P.stripe;
  for (const sy of [3, 4.4]) ctx.fillRect(-2.2, sy, 1.6, 0.4);
  // The head: ears, a striped brow, eyes, a white muzzle and a jaw that
  // drops as she talks.
  const jaw = talk * 1.8;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(dir * 3.2, -5.4, 1.5, 0, Math.PI * 2);
    fillPath(ctx, P.tiger, 0.4);
    dot(ctx, dir * 3.2, -5.2, 0.7, '#ffe0c0', 0);
  }
  ctx.beginPath();
  ctx.ellipse(0, -2.6, 4.6, 3.8, 0, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(-1, -3.6, 0.5, 0, -2.6, 5);
  g.addColorStop(0, '#ffb05a');
  g.addColorStop(1, P.tigerShade);
  fillPath(ctx, g, 0.5);
  ctx.fillStyle = P.stripe;
  for (const [sx, sy, w, h, r] of [[0, -5.8, 0.6, 1.6, 0], [-1.4, -5.4, 0.45, 1.2, 0.4], [1.4, -5.4, 0.45, 1.2, -0.4], [-4, -2.6, 1.4, 0.4, 0.2], [4, -2.6, 1.4, 0.4, -0.2]]) {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(r);
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  }
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(dir * 1.7, -3.4, 0.8, 0.95, 0, 0, Math.PI * 2);
    fillPath(ctx, '#ffffff', 0.2);
    dot(ctx, dir * 1.8, -3.3, 0.45, '#1e140f', 0);
  }
  // The mouth opening, then the muzzle and jaw.
  ctx.beginPath();
  ctx.ellipse(0, -0.6 + jaw * 0.5, 2.2, 0.4 + jaw * 0.6, 0, 0, Math.PI * 2);
  fillPath(ctx, '#8a2a3e', 0.3);
  ctx.beginPath();
  ctx.ellipse(0, -1.4, 2.4, 1.3, 0, 0, Math.PI * 2);
  fillPath(ctx, '#fff6ea', 0.35);
  dot(ctx, 0, -1.9, 0.55, '#3a2018', 0);
  ctx.beginPath();
  ctx.ellipse(0, 0.6 + jaw, 2, 0.9, 0, 0, Math.PI * 2);
  fillPath(ctx, '#fff6ea', 0.35);
  // Whisker dots.
  for (const dir of [-1, 1]) {
    for (const wy of [-1.6, -0.9]) dot(ctx, dir * 1.4, wy, 0.15, '#3a2018', 0);
  }
  ctx.restore();
}

// -- Head and hair ---------------------------------------------------------

const HEAD_Y = -55;
const EYE_Y = -53.6;

/** The bob's back, behind her face and neck. */
function drawHairBack(ctx) {
  ctx.beginPath();
  ctx.moveTo(-10.6, HEAD_Y - 6);
  ctx.bezierCurveTo(-12.6, HEAD_Y + 2, -11.8, HEAD_Y + 7, -10.4, HEAD_Y + 8.6);
  ctx.quadraticCurveTo(0, HEAD_Y + 10, 10.4, HEAD_Y + 8.6);
  ctx.bezierCurveTo(11.8, HEAD_Y + 7, 12.6, HEAD_Y + 2, 10.6, HEAD_Y - 6);
  ctx.closePath();
  fillPath(ctx, P.hairDeep, 0.5);
}

function drawHead(ctx, t, talk) {
  rr(ctx, -2.2, -47.4, 4.4, 4, 1);
  fillPath(ctx, P.skinShade, 0.4);
  drawEars(ctx, HEAD_Y, P.skin, P.skinDeep, { x: 9.2 });
  drawFace(ctx, HEAD_Y, P.skin, P.skinShade, { w: 9.2, chin: 10.4 });
  // Freckles across her nose.
  ctx.fillStyle = 'rgba(160,90,50,0.45)';
  for (const [fx, fy] of [[-3.6, 3], [-2.6, 3.6], [-1.8, 2.8], [2.2, 2.8], [3, 3.6], [3.8, 3]]) {
    ctx.beginPath();
    ctx.arc(fx, EYE_Y + fy, 0.25, 0, Math.PI * 2);
    ctx.fill();
  }
  drawEyes(ctx, EYE_Y, { iris: P.iris, irisLight: P.irisLight }, { shape: 'round', lashes: true, blinking: isStorytellerBlinkingAt(t) });
  drawBrows(ctx, EYE_Y, P.hairDeep, { thick: 0.55, lift: 0.9 + talk * 0.4, y: -5.2 });
  drawBlush(ctx, EYE_Y, 0.38);
  drawNose(ctx, EYE_Y, 'rgba(190,120,90,0.5)', -0.6);
  if (talk > 0.15) {
    ctx.save();
    ctx.translate(0, HEAD_Y + 7);
    ctx.scale(1, 0.6 + talk * 0.6);
    ctx.translate(0, -(HEAD_Y + 7));
    drawMouth(ctx, HEAD_Y, 'open', P.lips);
    ctx.restore();
  } else {
    drawMouth(ctx, HEAD_Y, 'smile', P.lips);
  }
  drawFrontHair(ctx);
  drawBeret(ctx);
  // Dangly star earrings, swinging.
  const swing = Math.sin(t * 2.6) * 0.3;
  for (const dir of [-1, 1]) {
    ctx.save();
    ctx.translate(dir * 9.4, HEAD_Y + 3);
    ctx.rotate(swing);
    ctx.strokeStyle = '#e8c25a';
    ctx.lineWidth = 0.25;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 1.6);
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    star(ctx, 0, 2.4, 1);
    fillPath(ctx, '#ffd166', 0.2);
    ctx.restore();
  }
}

function drawFrontHair(ctx) {
  // The crown and the sides of the bob, curling under at her jaw.
  ctx.beginPath();
  ctx.moveTo(-10.6, HEAD_Y + 7.6);
  ctx.bezierCurveTo(-13, HEAD_Y - 4, -12.4, HEAD_Y - 19.8, 0, HEAD_Y - 19.8);
  ctx.bezierCurveTo(12.4, HEAD_Y - 19.8, 13, HEAD_Y - 4, 10.6, HEAD_Y + 7.6);
  ctx.quadraticCurveTo(9.4, HEAD_Y + 8.8, 8, HEAD_Y + 7.4);
  ctx.quadraticCurveTo(9.4, HEAD_Y, 8.6, HEAD_Y - 5);
  ctx.lineTo(-8.6, HEAD_Y - 5);
  ctx.quadraticCurveTo(-9.4, HEAD_Y, -8, HEAD_Y + 7.4);
  ctx.quadraticCurveTo(-9.4, HEAD_Y + 8.8, -10.6, HEAD_Y + 7.6);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, HEAD_Y - 20, 0, HEAD_Y + 8);
  g.addColorStop(0, P.hairMid);
  g.addColorStop(1, P.hair);
  fillPath(ctx, g, 0.55);
  ctx.save();
  ctx.clip();
  hairStrands(ctx, HEAD_Y, [
    [-6, -17, -11, -8, -10, 6], [-3, -18, -9.6, -6, -9, 4], [6, -17, 11, -8, 10, 6], [3, -18, 9.6, -6, 9, 4],
  ], P.hairShine, 0.4);
  // A glossy ring of shine across the crown.
  ctx.strokeStyle = 'rgba(255,200,160,0.5)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(-7.4, HEAD_Y - 13);
  ctx.quadraticCurveTo(0, HEAD_Y - 16.4, 7.4, HEAD_Y - 13);
  ctx.stroke();
  ctx.restore();
  // A thick blunt fringe, cut straight just above her brows.
  ctx.beginPath();
  ctx.moveTo(-9.2, HEAD_Y - 10);
  ctx.quadraticCurveTo(0, HEAD_Y - 14, 9.2, HEAD_Y - 10);
  ctx.lineTo(9, HEAD_Y - 5.4);
  ctx.quadraticCurveTo(0, HEAD_Y - 4.6, -9, HEAD_Y - 5.4);
  ctx.closePath();
  fillPath(ctx, P.hair, 0.5);
  ctx.strokeStyle = P.hairDeep;
  ctx.lineWidth = 0.3;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 2.4, HEAD_Y - 11.4);
    ctx.lineTo(i * 2.5, HEAD_Y - 5.6);
    ctx.stroke();
  }
}

function drawBeret(ctx) {
  // A slouchy pink beret tipped to her left (viewer's right), with a stalk
  // and a yellow felt star.
  ctx.save();
  ctx.translate(2.4, HEAD_Y - 16);
  ctx.rotate(0.22);
  ctx.beginPath();
  ctx.ellipse(0, 0, 11, 4.6, 0, 0, Math.PI * 2);
  const g = ctx.createLinearGradient(0, -4.6, 0, 4.6);
  g.addColorStop(0, '#f27aa8');
  g.addColorStop(1, P.beretShade);
  fillPath(ctx, g, 0.55);
  ctx.strokeStyle = 'rgba(120,20,60,0.35)';
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.moveTo(-8, 1.4);
  ctx.quadraticCurveTo(0, 4.2, 8, 1.4);
  ctx.stroke();
  rr(ctx, -9.4, 2, 18.8, 1.6, 0.8);
  fillPath(ctx, P.beretShade, 0.4);
  rr(ctx, -0.5, -6, 1, 1.8, 0.4);
  fillPath(ctx, P.beretShade, 0.3);
  star(ctx, 5.6, -0.6, 2);
  fillPath(ctx, '#ffd166', 0.35);
  ctx.strokeStyle = '#e0a83a';
  ctx.lineWidth = 0.2;
  ctx.setLineDash([0.3, 0.3]);
  star(ctx, 5.6, -0.6, 1.4);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}
