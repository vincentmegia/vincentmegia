// Karen, Library Shift's scripted troublemaker at the Front Desk ("i want
// the characters to also be more detailed like min-jun, ji-ho, eun-mi and
// staff"). A sleek, angled blonde bob with darker roots and a swoop over one
// eye, sunglasses pushed up on her head; sharp blue eyes with heavy lashes;
// a red power blazer with shoulder pads and gold buttons over a cream silk
// blouse with a pussy-bow; a black pencil skirt, sheer tights and pointed
// black heels; gold drop earrings and a tennis bracelet; a big designer tote
// on her forearm; her phone held up, filming, its REC light blinking.
// Calm, she wears a smug half-smile and one raised brow. `angry` (her
// outburst, and always in line): a scowl, a shouting mouth, a flush, an
// anger mark, her bob bouncing, and a finger jabbing at you.
// Layered flat shading, no eye highlights, like the game's other characters.
//
// Coordinates follow Hospital Shift's anime adult frame (feet at 0,
// shoulders about -40, face centre about -55); see staff-kit.js.

import {
  fillPath, rr, dot, isBlinkingAt, walkCycle, groundShadow, limbSegment, legPoses,
  sleeve, swingArm, drawHand, drawFace, drawEars, drawNose, drawEyes, drawBrows, drawMouth, hairStrands,
} from './staff-kit.js';

const P = {
  skin: '#f8dcc8',
  skinShade: '#ecc0a6',
  skinDeep: '#d6a288',
  hair: '#e2bf5a',
  hairMid: '#f0d684',
  hairDeep: '#b8923a',
  roots: '#8a6a2a',
  iris: '#3a6a9a',
  irisLight: '#7aaad8',
  blazer: '#d23a4a',
  blazerShade: '#a82838',
  blazerLight: '#e85a68',
  blouse: '#f6ecd8',
  blouseShade: '#e2d4b8',
  skirt: '#1e1a22',
  tights: '#e8cdb8',
  heel: '#141018',
  gold: '#e8c25a',
  goldDeep: '#b8923a',
  bag: '#8a5a3a',
  bagShade: '#6a4228',
  phone: '#2a2a34',
  lips: '#c83a4a',
};

/** Whether she's blinking at time `t`. */
export function isKarenBlinkingAt(t) {
  return isBlinkingAt(t, 3.6, 0.7);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - feet centre
 * @param {number} y - feet line
 * @param {{scale?: number, t?: number, walking?: boolean, angry?: boolean}} [opts]
 */
export function drawKaren(ctx, x, y, opts = {}) {
  const k = (opts.scale ?? 1) * 1.0;
  const t = opts.t ?? 0;
  const angry = Boolean(opts.angry);
  const { phase, amount, stride, breathe } = walkCycle(t, 5.4, Boolean(opts.walking));
  // Ranting, she bobs on her heels and her hair bounces.
  const rant = angry ? Math.abs(Math.sin(t * 7)) : 0;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  groundShadow(ctx, 12);
  drawHairBack(ctx, rant);
  drawLegs(ctx, phase, amount);
  ctx.save();
  ctx.translate(0, -breathe * 0.4 - rant * 0.6);
  drawSkirt(ctx, stride);
  drawTorso(ctx);
  drawBagArm(ctx, stride, t);
  drawHead(ctx, t, angry, rant);
  drawPhoneArm(ctx, t, angry);
  ctx.restore();
  ctx.restore();
}

// -- Legs and heels ---------------------------------------------------------

function drawLegs(ctx, phase, amount) {
  // A clipped, one-foot-in-front-of-the-other walk.
  for (const { dir, hip, knee, ankle, pitch } of legPoses(phase, amount, { hipX: 2.8, hipY: -19.6, thigh: 10.2, shin: 10.6, swing: 0.2, bend: 0.32 })) {
    const fill = dir < 0 ? P.tights : '#dcbfaa';
    limbSegment(ctx, hip[0], hip[1], knee[0], knee[1], 4.6, 3.6, fill, 0.45);
    limbSegment(ctx, knee[0], knee[1], ankle[0], ankle[1], 3.6, 2.8, fill, 0.45);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(knee[0] - 0.4, knee[1] + 1.2);
    ctx.lineTo(ankle[0] - 0.3, ankle[1] - 2);
    ctx.stroke();
    ctx.save();
    ctx.translate(ankle[0], ankle[1]);
    ctx.rotate(pitch);
    drawHeel(ctx);
    ctx.restore();
  }
}

function drawHeel(ctx) {
  // A pointed pump on a stiletto heel, a red sole flashing under it.
  ctx.beginPath();
  ctx.moveTo(-2.4, 0.6);
  ctx.quadraticCurveTo(-2.8, 3, -2, 4.4);
  ctx.lineTo(5.2, 4.8);
  ctx.quadraticCurveTo(2.6, 2.6, 1.6, 0.8);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 0.6, 0, 4.8);
  g.addColorStop(0, '#2e2a36');
  g.addColorStop(1, P.heel);
  fillPath(ctx, g, 0.4);
  ctx.strokeStyle = '#d23a4a';
  ctx.lineWidth = 0.45;
  ctx.beginPath();
  ctx.moveTo(-1.8, 4.7);
  ctx.lineTo(4.8, 5);
  ctx.stroke();
  rr(ctx, -2.2, 4, 0.9, 2.2, 0.2);
  fillPath(ctx, P.heel, 0.25);
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.moveTo(0.8, 2.2);
  ctx.quadraticCurveTo(2.4, 2.8, 3.4, 3.8);
  ctx.stroke();
}

// -- Clothes ------------------------------------------------------------------

function drawSkirt(ctx, stride) {
  const sway = stride * 0.6;
  // A black pencil skirt, narrowing to the knee, a back slit and a seam.
  ctx.beginPath();
  ctx.moveTo(-7.8, -22.4);
  ctx.lineTo(7.8, -22.4);
  ctx.quadraticCurveTo(8.8, -15, 7 + sway, -7.6);
  ctx.lineTo(-7 + sway, -7.6);
  ctx.quadraticCurveTo(-8.8, -15, -7.8, -22.4);
  ctx.closePath();
  const g = ctx.createLinearGradient(-8, 0, 8, 0);
  g.addColorStop(0, '#3a3440');
  g.addColorStop(0.5, P.skirt);
  g.addColorStop(1, '#0e0c10');
  fillPath(ctx, g, 0.55);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  ctx.moveTo(2.4, -21.6);
  ctx.lineTo(2 + sway * 0.6, -8);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath();
  ctx.moveTo(-1 + sway, -7.6);
  ctx.lineTo(-1 + sway * 0.8, -10.6);
  ctx.stroke();
}

function drawTorso(ctx) {
  // The cream blouse showing in the blazer's V, with its pussy-bow.
  ctx.beginPath();
  ctx.moveTo(-4.6, -43.6);
  ctx.lineTo(4.6, -43.6);
  ctx.lineTo(3, -30);
  ctx.lineTo(-3, -30);
  ctx.closePath();
  fillPath(ctx, P.blouse, 0.45);
  ctx.strokeStyle = P.blouseShade;
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  ctx.moveTo(-1.6, -40);
  ctx.quadraticCurveTo(-1, -35, -1.8, -31);
  ctx.stroke();
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, -42.6);
    ctx.quadraticCurveTo(dir * 2.8, -44.6, dir * 3.6, -42.4);
    ctx.quadraticCurveTo(dir * 2.6, -41, 0, -42.6);
    ctx.closePath();
    fillPath(ctx, P.blouse, 0.35);
    ctx.beginPath();
    ctx.moveTo(dir * 0.4, -42);
    ctx.quadraticCurveTo(dir * 1.6, -38, dir * 1.2, -35.6);
    ctx.lineTo(dir * 2.2, -36);
    ctx.quadraticCurveTo(dir * 2.2, -38.6, dir * 1, -42);
    ctx.closePath();
    fillPath(ctx, P.blouse, 0.3);
  }
  dot(ctx, 0, -42.4, 0.8, P.blouseShade, 0.3);
  // The blazer: sharp shoulders, nipped waist, peaked lapels.
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 4.6, -43.8);
    ctx.lineTo(dir * 10.8, -43);
    ctx.quadraticCurveTo(dir * 11.4, -40.6, dir * 10.4, -37.6);
    ctx.quadraticCurveTo(dir * 7.8, -30, dir * 8.8, -20.6);
    ctx.lineTo(dir * 0.4, -19.8);
    ctx.lineTo(dir * 0.4, -28);
    ctx.lineTo(dir * 3, -30);
    ctx.closePath();
    const g = ctx.createLinearGradient(dir * 0.4, 0, dir * 11, 0);
    g.addColorStop(0, P.blazerLight);
    g.addColorStop(1, dir < 0 ? P.blazer : P.blazerShade);
    fillPath(ctx, g, 0.6);
    ctx.beginPath();
    ctx.moveTo(dir * 4.6, -43.8);
    ctx.lineTo(dir * 8.4, -42.6);
    ctx.lineTo(dir * 7.4, -38.6);
    ctx.lineTo(dir * 9.6, -38.8);
    ctx.lineTo(dir * 3, -30);
    ctx.closePath();
    fillPath(ctx, P.blazerShade, 0.45);
    // Darts at the waist, and a welt pocket.
    ctx.strokeStyle = 'rgba(100,10,20,0.45)';
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.moveTo(dir * 5.6, -34);
    ctx.quadraticCurveTo(dir * 5, -28, dir * 5.6, -22);
    ctx.stroke();
    rr(ctx, dir * 5.8 - 2, -24.4, 4, 0.8, 0.2);
    fillPath(ctx, P.blazerShade, 0.3);
  }
  // Gold buttons, and a gold chain-and-crest brooch on her lapel.
  for (const by of [-27, -23.4]) {
    dot(ctx, -1.4, by, 0.8, P.gold, 0.25);
    dot(ctx, -1.4, by, 0.35, P.goldDeep, 0);
  }
  dot(ctx, -6.4, -38.6, 1, P.gold, 0.25);
  ctx.strokeStyle = P.gold;
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  ctx.moveTo(-6.4, -37.6);
  ctx.quadraticCurveTo(-5.4, -35.6, -4.2, -36);
  ctx.stroke();
}

// -- Arms ---------------------------------------------------------------------

/** Her right arm (viewer's left): the designer tote hooked on her forearm. */
function drawBagArm(ctx, stride, t) {
  const shoulder = [-10.2, -40.4];
  const elbow = [-13.4, -31.4];
  const wrist = [-9.6, -27.2 + stride * 0.4];
  sleeve(ctx, shoulder, elbow, wrist, P.blazer, P.blazerShade, 5);
  // The tote, hanging from the crook of her arm.
  const swing = Math.sin(t * 2) * 0.04 + stride * 0.06;
  ctx.save();
  ctx.translate(-13.2, -30.6);
  ctx.rotate(swing);
  ctx.strokeStyle = P.bagShade;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(-3, 6);
  ctx.quadraticCurveTo(-2, -0.4, 0, 0);
  ctx.quadraticCurveTo(2, -0.4, 3, 6);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-5.4, 5.6);
  ctx.lineTo(5.4, 5.6);
  ctx.lineTo(6.4, 15);
  ctx.lineTo(-6.4, 15);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 5.6, 0, 15);
  g.addColorStop(0, '#a87a52');
  g.addColorStop(1, P.bag);
  fillPath(ctx, g, 0.5);
  // A monogram pattern and a gold clasp.
  ctx.fillStyle = 'rgba(232,194,90,0.45)';
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      ctx.beginPath();
      ctx.arc(-4 + c * 2.6 + (r % 2) * 1.3, 8 + r * 2.4, 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  rr(ctx, -1.4, 6.4, 2.8, 1.8, 0.4);
  fillPath(ctx, P.gold, 0.25);
  ctx.restore();
  rr(ctx, wrist[0] - 2, wrist[1] - 1.6, 4, 1.5, 0.4);
  fillPath(ctx, P.blazerShade, 0.3);
  drawHand(ctx, wrist[0] + 0.4, wrist[1], 1.2, { skin: P.skin, deep: P.skinDeep });
  // Red nails.
  ctx.fillStyle = '#c83a4a';
  for (const dx of [-0.6, 0.2, 1]) ctx.fillRect(wrist[0] + dx + 0.6, wrist[1] + 2.6, 0.5, 0.5);
  // A tennis bracelet.
  ctx.strokeStyle = '#f2f4fa';
  ctx.lineWidth = 0.45;
  ctx.setLineDash([0.4, 0.2]);
  ctx.beginPath();
  ctx.moveTo(wrist[0] - 1.6, wrist[1] - 0.4);
  ctx.lineTo(wrist[0] + 1.8, wrist[1] - 0.4);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** Her left arm (viewer's right): phone up, filming — or, angry, jabbing a finger at you. */
function drawPhoneArm(ctx, t, angry) {
  const shoulder = [10.2, -40.4];
  if (angry) {
    const jab = Math.max(0, Math.sin(t * 7)) * 1.4;
    const elbow = [14, -35.4];
    const wrist = [12 - jab * 0.3, -41.6 - jab];
    sleeve(ctx, shoulder, elbow, wrist, P.blazer, P.blazerShade, 5);
    rr(ctx, wrist[0] - 2, wrist[1] - 0.4, 4, 1.5, 0.4);
    fillPath(ctx, P.blazerShade, 0.3);
    // A fist with the index finger pointing out at you.
    ctx.save();
    ctx.translate(wrist[0], wrist[1] - 2);
    ctx.beginPath();
    ctx.ellipse(0, 0, 2, 2.2, 0, 0, Math.PI * 2);
    fillPath(ctx, P.skin, 0.45);
    rr(ctx, -0.6, -5.4, 1.3, 4.4, 0.6);
    fillPath(ctx, P.skin, 0.4);
    ctx.fillStyle = '#c83a4a';
    ctx.fillRect(-0.4, -5.2, 0.9, 0.9);
    ctx.strokeStyle = P.skinDeep;
    ctx.lineWidth = 0.25;
    for (const yy of [-0.4, 0.6]) {
      ctx.beginPath();
      ctx.moveTo(-1.4, yy);
      ctx.lineTo(1.4, yy);
      ctx.stroke();
    }
    ctx.restore();
    // Motion lines from the jab.
    if (jab > 0.6) {
      ctx.strokeStyle = 'rgba(200,40,60,0.6)';
      ctx.lineWidth = 0.4;
      for (const a of [-0.5, 0, 0.5]) {
        ctx.beginPath();
        ctx.moveTo(wrist[0] + Math.sin(a) * 6, wrist[1] - 8 - Math.cos(a) * 2);
        ctx.lineTo(wrist[0] + Math.sin(a) * 8, wrist[1] - 9.6 - Math.cos(a) * 3);
        ctx.stroke();
      }
    }
    return;
  }
  const { elbow } = swingArm(shoulder, 0, 1);
  const wrist = [11.6, -38.4];
  sleeve(ctx, shoulder, [elbow[0] + 2, elbow[1] - 2], wrist, P.blazer, P.blazerShade, 5);
  rr(ctx, wrist[0] - 2, wrist[1] - 0.4, 4, 1.5, 0.4);
  fillPath(ctx, P.blazerShade, 0.3);
  // The phone, held up and filming.
  ctx.save();
  ctx.translate(wrist[0] + 0.4, wrist[1] - 4.6);
  ctx.rotate(-0.12);
  rr(ctx, -2.2, -4, 4.4, 8, 0.8);
  fillPath(ctx, P.phone, 0.45);
  rr(ctx, -1.7, -3.4, 3.4, 6.8, 0.4);
  ctx.fillStyle = '#9ad0ff';
  ctx.fill();
  if (Math.sin(t * 4) > 0) dot(ctx, -0.8, -2.6, 0.4, '#ff3a4a', 0);
  rr(ctx, -0.4, 2.6, 0.8, 0.4, 0.2);
  fillPath(ctx, '#ffffff', 0);
  ctx.restore();
  drawHand(ctx, wrist[0], wrist[1] - 0.6, Math.PI * 0.9, { skin: P.skin, deep: P.skinDeep });
}

// -- Head and hair ---------------------------------------------------------

const HEAD_Y = -55;
const EYE_Y = -53.8;

function drawHairBack(ctx, rant) {
  // The angled bob: shorter at the back, longer at the front.
  const bounce = rant * 0.8;
  ctx.beginPath();
  ctx.moveTo(-10.4, HEAD_Y - 6);
  ctx.bezierCurveTo(-12.8, HEAD_Y + 1, -12.4, HEAD_Y + 6 + bounce, -11, HEAD_Y + 8.6 + bounce);
  ctx.quadraticCurveTo(0, HEAD_Y + 6, 11, HEAD_Y + 8.6 + bounce);
  ctx.bezierCurveTo(12.4, HEAD_Y + 6 + bounce, 12.8, HEAD_Y + 1, 10.4, HEAD_Y - 6);
  ctx.closePath();
  fillPath(ctx, P.hairDeep, 0.5);
}

function drawHead(ctx, t, angry, rant) {
  rr(ctx, -2.1, -47.4, 4.2, 4, 1);
  fillPath(ctx, P.skinShade, 0.4);
  drawEars(ctx, HEAD_Y, P.skin, P.skinDeep, { x: 9.1 });
  // Gold drop earrings, swinging with her head.
  for (const dir of [-1, 1]) {
    ctx.save();
    ctx.translate(dir * 9.4, HEAD_Y + 3);
    ctx.rotate(Math.sin(t * 7) * 0.3 * rant);
    dot(ctx, 0, 0, 0.5, P.gold, 0.15);
    ctx.beginPath();
    ctx.moveTo(0, 0.6);
    ctx.lineTo(-0.9, 2.8);
    ctx.quadraticCurveTo(0, 3.8, 0.9, 2.8);
    ctx.closePath();
    fillPath(ctx, P.gold, 0.2);
    ctx.restore();
  }
  drawFace(ctx, HEAD_Y, P.skin, P.skinShade, { w: 8.9, chin: 10.8 });
  drawEyes(ctx, EYE_Y, { iris: P.iris, irisLight: P.irisLight, lash: '#1e1418' }, { shape: angry ? 'narrow' : 'almond', lashes: true, blinking: !angry && isKarenBlinkingAt(t) });
  // Winged liner flicks.
  ctx.strokeStyle = '#1e1418';
  ctx.lineWidth = 0.45;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 7.1, EYE_Y - 0.4);
    ctx.lineTo(dir * 8.6, EYE_Y - 1.6);
    ctx.stroke();
  }
  if (angry) {
    // A scowl: brows hard down, a flush, the anger mark.
    ctx.fillStyle = P.roots;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(dir * 1.6, EYE_Y - 2.6);
      ctx.lineTo(dir * 6.8, EYE_Y - 5.4);
      ctx.lineTo(dir * 6.8, EYE_Y - 4.7);
      ctx.lineTo(dir * 1.8, EYE_Y - 1.9);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = `rgba(230,70,80,${0.28 + rant * 0.12})`;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(dir * 5.6, EYE_Y + 3.4, 2.2, 1.1, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#e04a4a';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (const [a, b] of [[[6.2, -8], [7.4, -9.2]], [[8.6, -8], [7.4, -9.2]], [[6.2, -10.4], [7.4, -9.2]], [[8.6, -10.4], [7.4, -9.2]]]) {
      ctx.moveTo(a[0], HEAD_Y + a[1]);
      ctx.lineTo(b[0], HEAD_Y + b[1]);
    }
    ctx.stroke();
  } else {
    // One brow arched: unimpressed.
    drawBrows(ctx, EYE_Y, P.roots, { thick: 0.5, lift: 0, y: -4.6 });
    ctx.fillStyle = P.roots;
    ctx.beginPath();
    ctx.moveTo(2, EYE_Y - 5.4);
    ctx.quadraticCurveTo(4.6, EYE_Y - 7.4, 6.8, EYE_Y - 5.6);
    ctx.lineTo(6.8, EYE_Y - 5);
    ctx.quadraticCurveTo(4.6, EYE_Y - 6.8, 2.1, EYE_Y - 4.8);
    ctx.closePath();
    ctx.fill();
  }
  drawNose(ctx, EYE_Y, 'rgba(200,130,110,0.5)', -0.2);
  if (angry) {
    // Shouting, the mouth opening and closing with the rant.
    ctx.save();
    ctx.translate(0, HEAD_Y + 7);
    ctx.scale(1.2, 0.8 + rant * 0.7);
    ctx.translate(0, -(HEAD_Y + 7));
    drawMouth(ctx, HEAD_Y, 'open', P.lips);
    ctx.restore();
  } else {
    drawMouth(ctx, HEAD_Y, 'smirk', P.lips);
    ctx.fillStyle = 'rgba(200,58,74,0.4)';
    ctx.beginPath();
    ctx.ellipse(0.3, HEAD_Y + 7.4, 1.4, 0.45, -0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  drawFrontHair(ctx, rant);
  drawSunglasses(ctx);
}

function drawFrontHair(ctx, rant) {
  const bounce = rant * 0.8;
  // The crown, sleek, with darker roots at the part.
  ctx.beginPath();
  ctx.moveTo(-10.6, HEAD_Y + 8 + bounce);
  ctx.bezierCurveTo(-13, HEAD_Y - 4, -12.4, HEAD_Y - 19.6, 0, HEAD_Y - 19.6);
  ctx.bezierCurveTo(12.4, HEAD_Y - 19.6, 13, HEAD_Y - 4, 11, HEAD_Y + 10 + bounce);
  ctx.quadraticCurveTo(9.4, HEAD_Y + 10.6 + bounce, 8.2, HEAD_Y + 8.6);
  ctx.quadraticCurveTo(9.4, HEAD_Y, 8.4, HEAD_Y - 5);
  ctx.lineTo(-8.4, HEAD_Y - 5);
  ctx.quadraticCurveTo(-9.4, HEAD_Y, -8.2, HEAD_Y + 6.6);
  ctx.quadraticCurveTo(-9.4, HEAD_Y + 8.8 + bounce, -10.6, HEAD_Y + 8 + bounce);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, HEAD_Y - 20, 0, HEAD_Y + 9);
  g.addColorStop(0, P.roots);
  g.addColorStop(0.22, P.hair);
  g.addColorStop(0.6, P.hairMid);
  g.addColorStop(1, P.hair);
  fillPath(ctx, g, 0.55);
  ctx.save();
  ctx.clip();
  hairStrands(ctx, HEAD_Y, [
    [2, -18, -8, -12, -10, 6], [2, -18, -6, -8, -8.6, 6], [2, -18, 9, -12, 10.6, 8], [2, -18, 7, -6, 9, 8],
  ], P.hairDeep, 0.35);
  ctx.strokeStyle = 'rgba(255,250,220,0.7)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(-7.4, HEAD_Y - 12.4);
  ctx.quadraticCurveTo(-1, HEAD_Y - 15.6, 6, HEAD_Y - 13.4);
  ctx.stroke();
  ctx.restore();
  // The swoop: a deep side fringe sweeping across her brow from the part.
  ctx.beginPath();
  ctx.moveTo(2, HEAD_Y - 14);
  ctx.quadraticCurveTo(-4, HEAD_Y - 12, -9, HEAD_Y - 5);
  ctx.quadraticCurveTo(-9.4, HEAD_Y - 1.6, -8.4, HEAD_Y + 0.6);
  ctx.quadraticCurveTo(-6.4, HEAD_Y - 6, -1, HEAD_Y - 8.6);
  ctx.quadraticCurveTo(4, HEAD_Y - 10, 8.6, HEAD_Y - 7.4);
  ctx.quadraticCurveTo(6, HEAD_Y - 12.6, 2, HEAD_Y - 14);
  ctx.closePath();
  const sw = ctx.createLinearGradient(-9, 0, 8, 0);
  sw.addColorStop(0, P.hairMid);
  sw.addColorStop(1, P.hair);
  fillPath(ctx, sw, 0.45);
  hairStrands(ctx, HEAD_Y, [[1, -13, -5, -10, -8.4, -2], [3, -12.4, 5, -10, 7.6, -7.6]], P.hairDeep, 0.3);
}

function drawSunglasses(ctx) {
  // Designer sunglasses pushed up on her head, gold arms.
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(dir * 4, HEAD_Y - 14.6, 3.2, 2, dir * 0.12, 0, Math.PI * 2);
    const g = ctx.createLinearGradient(0, HEAD_Y - 16.6, 0, HEAD_Y - 12.6);
    g.addColorStop(0, '#4a3a2a');
    g.addColorStop(1, '#1a1410');
    fillPath(ctx, g, 0.45);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(dir * 4 - 2, HEAD_Y - 15.6, 1.2, 0.45);
  }
  ctx.strokeStyle = P.gold;
  ctx.lineWidth = 0.45;
  ctx.beginPath();
  ctx.moveTo(-0.9, HEAD_Y - 15);
  ctx.lineTo(0.9, HEAD_Y - 15);
  ctx.moveTo(-7.2, HEAD_Y - 14.6);
  ctx.lineTo(-9.6, HEAD_Y - 12.4);
  ctx.moveTo(7.2, HEAD_Y - 14.6);
  ctx.lineTo(9.6, HEAD_Y - 12.4);
  ctx.stroke();
}
