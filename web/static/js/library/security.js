// Security (보안), Library Shift's guard on the 1st Floor, who walks Karen
// out when asked ("make others more detailed like them": the staff drawn
// with the shared anime renderer get their own detailed figures, like
// Min-jun, Ji-ho and Director Seo). A broad, upright man in a navy uniform:
// a peaked cap with a silver badge and a glossy visor, a pale-blue shirt and
// navy tie under a fitted jacket with epaulettes, a "보안" shoulder patch, a
// shield badge and a name plate; a radio on his chest with a coiled cord to
// an earpiece, which he lifts to speak into now and then (its LED blinks);
// a duty belt with a torch, a key ring and a pouch; pressed trousers with a
// side stripe and polished black boots. Short black hair, sharp eyes,
// thick brows, a steady mouth. Layered flat shading, no eye highlights,
// like the game's other characters.
//
// Coordinates follow Hospital Shift's anime adult frame (feet at 0,
// shoulders about -40, face centre about -55); see staff-kit.js.

import {
  LINE, fillPath, rr, dot, isBlinkingAt, walkCycle, groundShadow, limbSegment, legPoses, kneeFold,
  sleeve, swingArm, drawHand, drawFace, drawEars, drawNose, drawEyes, drawBrows, drawMouth, hairStrands,
} from './staff-kit.js';

const P = {
  skin: '#dca578',
  skinShade: '#c48a5e',
  skinDeep: '#a8704a',
  hair: '#141012',
  hairMid: '#2a2428',
  iris: '#3a2416',
  irisLight: '#7a5032',
  jacket: '#2e3a5a',
  jacketShade: '#222b44',
  jacketLight: '#3c4b72',
  shirt: '#c9e4ff',
  shirtShade: '#a8c8e8',
  tie: '#1c2238',
  trousers: '#242c38',
  trousersShade: '#1a2028',
  stripe: '#5a6a8a',
  boot: '#14181f',
  bootShine: 'rgba(255,255,255,0.35)',
  silver: '#d6dae4',
  silverDeep: '#9ea4b2',
  gold: '#e8c25a',
  belt: '#1a1a1e',
  radio: '#2a2c30',
  lips: '#a8665a',
};

/** Whether he's blinking at time `t`. */
export function isSecurityBlinkingAt(t) {
  return isBlinkingAt(t, 4.3, 1.1);
}

/** Whether he has the radio up at his mouth at time `t` (about 1.6 s in every 7). */
export function isSecurityOnRadioAt(t) {
  return ((t % 7) + 7) % 7 > 5.4;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - feet centre
 * @param {number} y - feet line
 * @param {{scale?: number, t?: number, walking?: boolean}} [opts]
 */
export function drawSecurity(ctx, x, y, opts = {}) {
  const k = (opts.scale ?? 1) * 1.04; // a tall man
  const t = opts.t ?? 0;
  // walk-styles.js's 'march' bobs at 5; the legs land on it.
  const { phase, amount, stride, breathe } = walkCycle(t, 5, Boolean(opts.walking));
  const onRadio = isSecurityOnRadioAt(t);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  groundShadow(ctx, 15);
  drawLegs(ctx, phase, amount);
  ctx.save();
  ctx.translate(0, -breathe * 0.4);
  drawTorso(ctx);
  drawBelt(ctx, stride);
  drawFreeArm(ctx, stride);
  drawRadioArm(ctx, stride, onRadio, t);
  drawHead(ctx, t, onRadio);
  ctx.restore();
  ctx.restore();
}

// -- Legs and boots -------------------------------------------------------------

function drawLegs(ctx, phase, amount) {
  // A march: a firm, straight-kneed stride.
  for (const leg of legPoses(phase, amount, { hipX: 4.3, swing: 0.26, bend: 0.3 })) {
    const { dir, hip, knee, ankle, bend, pitch } = leg;
    const fill = dir < 0 ? P.trousers : P.trousersShade;
    limbSegment(ctx, hip[0], hip[1], knee[0], knee[1], 7.6, 6.6, fill);
    limbSegment(ctx, knee[0], knee[1], ankle[0], ankle[1], 6.6, 6, fill);
    // The uniform's side stripe down the outer seam, and a pressed crease.
    ctx.strokeStyle = P.stripe;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(hip[0] + dir * 3.3, hip[1] + 1);
    ctx.lineTo(knee[0] + dir * 2.9, knee[1]);
    ctx.lineTo(ankle[0] + dir * 2.6, ankle[1] - 1.5);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.moveTo(knee[0], knee[1] + 1);
    ctx.lineTo(ankle[0], ankle[1] - 2);
    ctx.stroke();
    kneeFold(ctx, knee, bend);
    ctx.save();
    ctx.translate(ankle[0], ankle[1]);
    ctx.rotate(pitch);
    drawBoot(ctx);
    ctx.restore();
  }
}

function drawBoot(ctx) {
  // The trouser hem breaking over the boot, then the boot.
  ctx.beginPath();
  ctx.moveTo(-3.4, -2.2);
  ctx.lineTo(3.4, -2.2);
  ctx.lineTo(3.8, 0.4);
  ctx.quadraticCurveTo(0, 1.2, -3.8, 0.4);
  ctx.closePath();
  fillPath(ctx, P.trousersShade, 0.4);
  rr(ctx, -4.4, 4.6, 9.2, 1.7, 0.6);
  fillPath(ctx, '#0a0c10', 0.4);
  ctx.beginPath();
  ctx.moveTo(-4.2, 4.8);
  ctx.quadraticCurveTo(-4.4, 0.6, -2.4, 0.2);
  ctx.lineTo(1.6, 0.4);
  ctx.quadraticCurveTo(5, 1.4, 4.8, 4.8);
  ctx.closePath();
  fillPath(ctx, P.boot, 0.45);
  // Polished: a long shine on the toe cap, the welt, and the laces.
  ctx.strokeStyle = P.bootShine;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(1.2, 2.2);
  ctx.quadraticCurveTo(2.8, 1.8, 3.6, 3);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 0.25;
  ctx.beginPath();
  ctx.moveTo(-4, 4.4);
  ctx.lineTo(4.5, 4.4);
  ctx.stroke();
  ctx.strokeStyle = '#3a3e48';
  ctx.lineWidth = 0.22;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-1.6 + i * 0.7, 0.8 + i * 0.3);
    ctx.lineTo(-0.4 + i * 0.7, 1.4 + i * 0.3);
    ctx.stroke();
  }
}

// -- Uniform ----------------------------------------------------------------

function jacketPath(ctx) {
  ctx.beginPath();
  ctx.moveTo(-5.6, -44);
  ctx.quadraticCurveTo(-12.6, -43.4, -12.4, -36.6);
  ctx.lineTo(-11.4, -18.6);
  ctx.quadraticCurveTo(0, -16.4, 11.4, -18.6);
  ctx.lineTo(12.4, -36.6);
  ctx.quadraticCurveTo(12.6, -43.4, 5.6, -44);
  ctx.closePath();
}

function drawTorso(ctx) {
  jacketPath(ctx);
  const g = ctx.createLinearGradient(-12, 0, 12, 0);
  g.addColorStop(0, P.jacketLight);
  g.addColorStop(0.5, P.jacket);
  g.addColorStop(1, P.jacketShade);
  fillPath(ctx, g, 0.65);
  // The shirt and tie in the jacket's V.
  ctx.beginPath();
  ctx.moveTo(-4.8, -44);
  ctx.lineTo(4.8, -44);
  ctx.lineTo(0, -31);
  ctx.closePath();
  fillPath(ctx, P.shirt, 0.45);
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, -44.6);
    ctx.lineTo(dir * 4.4, -45.6);
    ctx.lineTo(dir * 3.6, -42);
    ctx.lineTo(dir * 0.6, -42.4);
    ctx.closePath();
    fillPath(ctx, P.shirtShade, 0.35);
  }
  ctx.beginPath();
  ctx.moveTo(-1, -43);
  ctx.lineTo(1, -43);
  ctx.lineTo(1.5, -33.6);
  ctx.lineTo(0, -31.8);
  ctx.lineTo(-1.5, -33.6);
  ctx.closePath();
  fillPath(ctx, P.tie, 0.35);
  rr(ctx, -1.2, -44.2, 2.4, 1.6, 0.5);
  fillPath(ctx, P.tie, 0.3);
  // A silver tie bar.
  rr(ctx, -1.8, -37.4, 3.6, 0.5, 0.2);
  fillPath(ctx, P.silver, 0.12);
  // Lapels.
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 4.8, -44);
    ctx.lineTo(dir * 8.6, -42.6);
    ctx.lineTo(dir * 7.8, -38.4);
    ctx.lineTo(dir * 9, -37.2);
    ctx.lineTo(dir * 1.2, -30);
    ctx.closePath();
    fillPath(ctx, P.jacketShade, 0.45);
  }
  // The front placket and four silver buttons, from the V down.
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 0.45;
  ctx.beginPath();
  ctx.moveTo(0.6, -30.4);
  ctx.lineTo(0.6, -18);
  ctx.stroke();
  for (const by of [-29, -25.4, -21.8]) {
    dot(ctx, -0.8, by, 0.75, P.silver, 0.2);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(-1.1, by - 0.4, 0.4, 0.3);
  }
  // Two buttoned chest pockets.
  for (const dir of [-1, 1]) {
    rr(ctx, dir * 7 - 2.6, -35, 5.2, 4.8, 0.5);
    fillPath(ctx, P.jacket, 0.4);
    ctx.beginPath();
    ctx.moveTo(dir * 7 - 2.8, -35.2);
    ctx.lineTo(dir * 7 + 2.8, -35.2);
    ctx.lineTo(dir * 7 + 2.4, -33);
    ctx.lineTo(dir * 7, -32.4);
    ctx.lineTo(dir * 7 - 2.4, -33);
    ctx.closePath();
    fillPath(ctx, P.jacketShade, 0.35);
    dot(ctx, dir * 7, -33, 0.5, P.silver, 0.15);
  }
  // The shield badge over his right pocket (viewer's left), with a star.
  ctx.beginPath();
  ctx.moveTo(-7, -40.8);
  ctx.lineTo(-4.9, -40);
  ctx.lineTo(-5.1, -37.2);
  ctx.quadraticCurveTo(-5.6, -35.8, -7, -35.2);
  ctx.quadraticCurveTo(-8.4, -35.8, -8.9, -37.2);
  ctx.lineTo(-9.1, -40);
  ctx.closePath();
  const badge = ctx.createLinearGradient(0, -41, 0, -35);
  badge.addColorStop(0, '#f6f8fc');
  badge.addColorStop(1, P.silverDeep);
  fillPath(ctx, badge, 0.35);
  ctx.fillStyle = P.gold;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.5 : 1.15;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const px = -7 + Math.cos(a) * r;
    const py = -38 + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  // The name plate over the other pocket.
  rr(ctx, 4.2, -38.6, 5.6, 1.6, 0.3);
  fillPath(ctx, '#f4f2ea', 0.25);
  ctx.fillStyle = '#2a2c34';
  for (let i = 0; i < 4; i++) ctx.fillRect(4.8 + i * 1.2, -38.1, 0.8, 0.6);
  // Epaulettes with two silver bars each.
  for (const dir of [-1, 1]) {
    ctx.save();
    ctx.translate(dir * 9.4, -42.8);
    ctx.rotate(dir * 0.18);
    rr(ctx, -2.6, -1, 5.2, 2, 0.8);
    fillPath(ctx, P.jacketShade, 0.35);
    ctx.fillStyle = P.silver;
    ctx.fillRect(-1.2 * dir - 0.6, -0.7, 0.45, 1.4);
    ctx.fillRect(-0.2 * dir - 0.6, -0.7, 0.45, 1.4);
    dot(ctx, dir * 2, 0, 0.45, P.silver, 0.1);
    ctx.restore();
  }
  // Fold shadows at the waist.
  ctx.strokeStyle = 'rgba(10,16,30,0.35)';
  ctx.lineWidth = 0.35;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 9.8, -27);
    ctx.quadraticCurveTo(dir * 8.2, -23, dir * 9.6, -19.4);
    ctx.stroke();
  }
}

function drawBelt(ctx, stride) {
  rr(ctx, -11.8, -20.6, 23.6, 2.8, 0.6);
  fillPath(ctx, P.belt, 0.5);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 0.2;
  ctx.setLineDash([0.4, 0.4]);
  ctx.beginPath();
  ctx.moveTo(-11.2, -20.1);
  ctx.lineTo(11.2, -20.1);
  ctx.moveTo(-11.2, -18.3);
  ctx.lineTo(11.2, -18.3);
  ctx.stroke();
  ctx.setLineDash([]);
  // A square silver buckle.
  rr(ctx, -1.8, -20.9, 3.6, 3.4, 0.4);
  fillPath(ctx, P.silver, 0.35);
  rr(ctx, -1, -20.1, 2, 1.8, 0.2);
  fillPath(ctx, P.belt, 0.2);
  // A pouch on his right hip (viewer's left).
  rr(ctx, -9.6, -19.6, 3.6, 4.2, 0.6);
  fillPath(ctx, '#22242a', 0.4);
  rr(ctx, -9.6, -19.6, 3.6, 1.6, 0.6);
  fillPath(ctx, '#2c2e36', 0.3);
  dot(ctx, -7.8, -18.4, 0.35, P.silverDeep, 0);
  // The torch in its holster, and a key ring that jingles as he walks.
  ctx.save();
  ctx.translate(8.4, -18.8);
  ctx.rotate(0.08);
  rr(ctx, -1.2, 0, 2.4, 6.4, 0.6);
  fillPath(ctx, '#3a3c44', 0.4);
  rr(ctx, -1.6, 5.6, 3.2, 1.6, 0.5);
  fillPath(ctx, '#2a2c32', 0.35);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(-0.8, 0.6, 0.35, 4.6);
  ctx.restore();
  const jingle = Math.sin(stride * 3) * 0.6;
  ctx.save();
  ctx.translate(4.6, -18.4);
  ctx.rotate(jingle * 0.3);
  ctx.strokeStyle = P.silverDeep;
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.arc(0, 1.2, 1.1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = P.silver;
  for (const [kx, kr] of [[-0.8, 0.3], [0.3, -0.1], [1, -0.4]]) {
    ctx.save();
    ctx.translate(kx, 2.2);
    ctx.rotate(kr);
    ctx.fillRect(-0.2, 0, 0.4, 2.2);
    ctx.fillRect(-0.2, 1.6, 0.8, 0.3);
    ctx.restore();
  }
  ctx.restore();
}

// -- Arms ---------------------------------------------------------------------

function drawCuff(ctx, wrist) {
  rr(ctx, wrist[0] - 2.4, wrist[1] - 1.6, 4.8, 1.6, 0.5);
  fillPath(ctx, P.jacketShade, 0.3);
  ctx.fillStyle = P.silver;
  ctx.fillRect(wrist[0] - 2, wrist[1] - 1.2, 4, 0.25);
}

/** His right arm (viewer's left) swings in time with the march. */
function drawFreeArm(ctx, stride) {
  const shoulder = [-11.2, -39.6];
  const { elbow, wrist } = swingArm(shoulder, -stride * 4.4, -1);
  sleeve(ctx, shoulder, elbow, wrist, P.jacket, P.jacketShade, 5.4);
  // The "보안" patch on his upper sleeve.
  ctx.save();
  ctx.translate(shoulder[0] - 0.8 + (elbow[0] - shoulder[0]) * 0.3, shoulder[1] + 3.4);
  rr(ctx, -1.8, -1.2, 3.6, 2.6, 0.6);
  fillPath(ctx, '#f2c94c', 0.3);
  ctx.fillStyle = P.jacketShade;
  ctx.fillRect(-1.2, -0.5, 1, 1.2);
  ctx.fillRect(0.3, -0.5, 1, 1.2);
  ctx.restore();
  drawCuff(ctx, wrist);
  drawHand(ctx, wrist[0], wrist[1], -stride * 0.18, { skin: P.skin, deep: P.skinDeep });
}

/** His left arm (viewer's right): at his side, or lifting the radio to speak. */
function drawRadioArm(ctx, stride, onRadio, t) {
  const shoulder = [11.2, -39.6];
  // The radio on its chest clip, a coiled cord running up to his earpiece.
  const radioAt = onRadio ? [7.6, -45.6] : [8.6, -40.4];
  ctx.strokeStyle = '#1a1a1e';
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.moveTo(radioAt[0] + 0.6, radioAt[1] - 2.6);
  for (let i = 0; i <= 10; i++) {
    const f = i / 10;
    const px = radioAt[0] + 0.6 + (9.6 - radioAt[0]) * f + Math.sin(f * Math.PI * 8) * 0.5;
    const py = radioAt[1] - 2.6 + (-52.4 - radioAt[1] + 2.6) * f;
    ctx.lineTo(px, py);
  }
  ctx.stroke();
  let elbow;
  let wrist;
  if (onRadio) {
    elbow = [14, -31];
    wrist = [9.6, -42.6];
  } else {
    ({ elbow, wrist } = swingArm(shoulder, stride * 4.4, 1));
  }
  if (!onRadio) drawRadio(ctx, radioAt, t, false);
  sleeve(ctx, shoulder, elbow, wrist, P.jacket, P.jacketShade, 5.4);
  drawCuff(ctx, wrist);
  if (onRadio) {
    drawRadio(ctx, radioAt, t, true);
    drawHand(ctx, wrist[0] - 0.6, wrist[1] - 0.6, 2.4, { skin: P.skin, deep: P.skinDeep });
  } else {
    drawHand(ctx, wrist[0], wrist[1], stride * 0.18, { skin: P.skin, deep: P.skinDeep });
  }
}

function drawRadio(ctx, at, t, talking) {
  ctx.save();
  ctx.translate(at[0], at[1]);
  ctx.rotate(talking ? -0.35 : 0.06);
  // The stubby antenna, the body, a speaker grille, the channel knob and
  // an LED that blinks green while he's talking.
  rr(ctx, 0.4, -5.6, 0.8, 2.6, 0.3);
  fillPath(ctx, '#111114', 0.25);
  rr(ctx, -1.6, -3.2, 3.4, 5.4, 0.6);
  fillPath(ctx, P.radio, 0.4);
  ctx.fillStyle = '#3a3c44';
  for (let i = 0; i < 4; i++) ctx.fillRect(-1.1, -1.8 + i * 0.75, 2.4, 0.35);
  dot(ctx, -0.8, -3.6, 0.45, '#4a4c54', 0.15);
  const lit = talking && Math.sin(t * 14) > 0;
  dot(ctx, 1, -2.6, 0.3, lit ? '#5cf08a' : '#2a5a3a', 0);
  ctx.restore();
}

// -- Head -----------------------------------------------------------------------

const HEAD_Y = -55;
const EYE_Y = -54.2;

function drawHead(ctx, t, onRadio) {
  // Neck, with the shadow of his jaw.
  rr(ctx, -2.8, -47.4, 5.6, 4.2, 1);
  fillPath(ctx, P.skinShade, 0.45);
  // Short back and sides under the cap.
  ctx.fillStyle = P.hair;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(dir * 8.6, HEAD_Y - 2.4, 1.6, 4, dir * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  drawEars(ctx, HEAD_Y, P.skin, P.skinDeep);
  // The earpiece in his left ear (viewer's right), where the cord ends.
  dot(ctx, 9.8, HEAD_Y + 1.2, 0.8, '#1a1a1e', 0.2);
  drawFace(ctx, HEAD_Y, P.skin, P.skinShade, { jaw: 0.8 });
  // Faint stubble along the jaw.
  ctx.fillStyle = 'rgba(40,30,30,0.12)';
  ctx.beginPath();
  ctx.ellipse(0, HEAD_Y + 7.6, 6.4, 3.6, 0, 0, Math.PI);
  ctx.fill();
  drawEyes(ctx, EYE_Y, { iris: P.iris, irisLight: P.irisLight }, { shape: 'narrow', blinking: isSecurityBlinkingAt(t) });
  drawBrows(ctx, EYE_Y, P.hair, { thick: 1.15, lift: -0.4 });
  drawNose(ctx, EYE_Y, 'rgba(150,90,60,0.6)', 0.3);
  drawMouth(ctx, HEAD_Y, onRadio ? 'open' : 'flat', P.lips);
  // A small scar through his left brow (viewer's right).
  ctx.strokeStyle = 'rgba(240,210,190,0.8)';
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.moveTo(5.2, EYE_Y - 5.6);
  ctx.lineTo(5.9, EYE_Y - 3.4);
  ctx.stroke();
  // Sideburns below the cap.
  ctx.fillStyle = P.hair;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 8.2, HEAD_Y - 6);
    ctx.lineTo(dir * 9.4, HEAD_Y - 6);
    ctx.lineTo(dir * 9, HEAD_Y + 0.6);
    ctx.lineTo(dir * 8.3, HEAD_Y + 0.6);
    ctx.closePath();
    ctx.fill();
  }
  drawCap(ctx);
}

function drawCap(ctx) {
  // The crown, wider at the top, then the band, the visor and the badge.
  ctx.beginPath();
  ctx.moveTo(-9.6, HEAD_Y - 7.6);
  ctx.quadraticCurveTo(-13, HEAD_Y - 13.6, -10.4, HEAD_Y - 16.8);
  ctx.quadraticCurveTo(0, HEAD_Y - 20.2, 10.4, HEAD_Y - 16.8);
  ctx.quadraticCurveTo(13, HEAD_Y - 13.6, 9.6, HEAD_Y - 7.6);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, HEAD_Y - 20, 0, HEAD_Y - 8);
  g.addColorStop(0, '#323c50');
  g.addColorStop(1, '#1c222e');
  fillPath(ctx, g, 0.6);
  hairStrands(ctx, HEAD_Y, [[-9, -15.6, 0, -18.6, 9, -15.6]], 'rgba(255,255,255,0.12)', 0.5);
  rr(ctx, -9.8, HEAD_Y - 10.4, 19.6, 3, 0.5);
  fillPath(ctx, '#11151d', 0.45);
  // A silver braid cord across the band.
  ctx.strokeStyle = P.silver;
  ctx.lineWidth = 0.4;
  ctx.setLineDash([0.7, 0.35]);
  ctx.beginPath();
  ctx.moveTo(-9.2, HEAD_Y - 8.6);
  ctx.lineTo(9.2, HEAD_Y - 8.6);
  ctx.stroke();
  ctx.setLineDash([]);
  dot(ctx, -9, HEAD_Y - 8.6, 0.5, P.silver, 0.15);
  dot(ctx, 9, HEAD_Y - 8.6, 0.5, P.silver, 0.15);
  // The glossy visor shading his brow.
  ctx.beginPath();
  ctx.moveTo(-9.6, HEAD_Y - 7.6);
  ctx.quadraticCurveTo(0, HEAD_Y - 9, 9.6, HEAD_Y - 7.6);
  ctx.quadraticCurveTo(0, HEAD_Y - 3.6, -9.6, HEAD_Y - 7.6);
  ctx.closePath();
  fillPath(ctx, '#0a0c10', 0.45);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.moveTo(-5, HEAD_Y - 6.8);
  ctx.quadraticCurveTo(0, HEAD_Y - 5.6, 4, HEAD_Y - 6.6);
  ctx.stroke();
  // The cap badge: a silver wreath round a gold emblem.
  ctx.beginPath();
  ctx.ellipse(0, HEAD_Y - 13.4, 2.4, 2.8, 0, 0, Math.PI * 2);
  fillPath(ctx, P.silver, 0.35);
  ctx.strokeStyle = P.silverDeep;
  ctx.lineWidth = 0.25;
  for (const dir of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(dir * (1.5 - i * 0.1), HEAD_Y - 14.8 + i * 1.1, 0.5, 0.25, dir * 0.6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  dot(ctx, 0, HEAD_Y - 13.4, 1, P.gold, 0.2);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillRect(-0.4, HEAD_Y - 14, 0.4, 0.4);
}
