// The Janitor (미화원), who mops the 1st Floor by the Coffee Machine and tidies
// up for +Mood when asked ("make others more detailed like them", then "the
// janitor looks ugly" — redrawn kinder and less boxy). A warm older man:
// grey hair under a knotted navy bandana, gentle brown eyes with crow's
// feet, bushy grey brows, a trim grey moustache over a soft smile; a teal
// work shirt with rolled cuffs under a fitted navy utility vest (a
// reflective stripe, flap pockets, cloths, a pen, a walkie clip), a white
// towel round his neck;
// yellow rubber gloves; work trousers with knee patches, rolled at the hem
// over green rubber boots. He holds a mop in one hand, its cotton head
// swishing on the floor as he waddles, and a spray bottle in the other.
// Layered flat shading, no eye highlights, like the game's other characters.
//
// Coordinates follow Hospital Shift's anime adult frame (feet at 0,
// shoulders about -40, face centre about -55); see staff-kit.js.

import {
  fillPath, rr, dot, isBlinkingAt, walkCycle, groundShadow, limbSegment, legPoses, kneeFold,
  sleeve, swingArm, drawHand, drawFace, drawEars, drawNose, drawEyes, drawBrows, drawMouth, hairStrands,
} from './staff-kit.js';

const P = {
  skin: '#e6b48c',
  skinShade: '#d09a72',
  skinDeep: '#b07a56',
  hair: '#9a949c',
  hairDeep: '#6a646c',
  iris: '#2a1a12',
  irisLight: '#6a4a32',
  shirt: '#5a8a9a',
  shirtShade: '#46707e',
  vest: '#4e6270',
  vestShade: '#40525e',
  vestLight: '#62788a',
  reflect: '#e6eef2',
  trousers: '#4a5866',
  trousersShade: '#3a4652',
  patch: '#5e6e7c',
  boot: '#3f7a4a',
  bootShade: '#2c5a36',
  glove: '#f2c94c',
  towel: '#f8f6f0',
  towelShade: '#dcd8cc',
  bandana: '#2e3a5a',
  mopPole: '#8a5a3a',
  mopHead: '#f4f1ea',
  lips: '#a8665a',
};

/** Whether he's blinking at time `t`. */
export function isJanitorBlinkingAt(t) {
  return isBlinkingAt(t, 5.1, 2.3);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - feet centre
 * @param {number} y - feet line
 * @param {{scale?: number, t?: number, walking?: boolean}} [opts]
 */
export function drawJanitor(ctx, x, y, opts = {}) {
  const k = (opts.scale ?? 1) * 0.97;
  const t = opts.t ?? 0;
  // walk-styles.js's 'waddle' rocks at 3.2.
  const { phase, amount, stride, breathe } = walkCycle(t, 3.2, Boolean(opts.walking));
  // The mop swishes side to side as he goes, and idly while he stands.
  const swish = amount ? Math.sin(phase) * 5 : Math.sin(t * 0.9) * 1.6;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  groundShadow(ctx, 16);
  drawMopHead(ctx, swish);
  drawLegs(ctx, phase, amount);
  ctx.save();
  ctx.translate(0, -breathe * 0.4);
  drawTorso(ctx);
  drawSprayArm(ctx, stride);
  drawHead(ctx, t);
  drawTowel(ctx, stride);
  drawMopArm(ctx, swish);
  ctx.restore();
  ctx.restore();
}

// -- Mop ------------------------------------------------------------------------

const MOP_FOOT_X = -19;

function drawMopHead(ctx, swish) {
  const fx = MOP_FOOT_X + swish;
  // A puddle sheen where he's just mopped.
  ctx.fillStyle = 'rgba(140,200,240,0.22)';
  ctx.beginPath();
  ctx.ellipse(fx + 1, 6.4, 9, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  // The blue band, then the cotton strands fanning onto the floor.
  rr(ctx, fx - 5, 0, 10, 3.4, 0.8);
  fillPath(ctx, '#4fa8e0', 0.45);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  ctx.moveTo(fx - 4.4, 1.7);
  ctx.lineTo(fx + 4.4, 1.7);
  ctx.stroke();
  for (let i = -5; i <= 5; i++) {
    ctx.strokeStyle = 'rgba(40,40,60,0.5)';
    ctx.lineWidth = 1.9;
    ctx.lineCap = 'round';
    const ex = fx + i * 1.3 - swish * 0.35;
    ctx.beginPath();
    ctx.moveTo(fx + i * 0.8, 3.2);
    ctx.quadraticCurveTo(fx + i * 1.1 - swish * 0.15, 5, ex, 6.8);
    ctx.stroke();
    ctx.strokeStyle = i % 2 ? P.mopHead : '#e6e2d6';
    ctx.lineWidth = 1.3;
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}

/** The mop's handle, from its head up through his gloved hand. */
function drawMopPole(ctx, swish) {
  const fx = MOP_FOOT_X + swish;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(30,20,20,0.6)';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(fx, 0.6);
  ctx.lineTo(-15.4 + swish * 0.2, -46);
  ctx.stroke();
  ctx.strokeStyle = P.mopPole;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,230,200,0.4)';
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.moveTo(fx - 0.4, 0);
  ctx.lineTo(-15.8 + swish * 0.2, -45);
  ctx.stroke();
  // A red hanging loop at the top.
  ctx.strokeStyle = '#d23a4a';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.ellipse(-15.6 + swish * 0.2, -47.6, 0.8, 1.4, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

// -- Legs and boots -------------------------------------------------------------

function drawLegs(ctx, phase, amount) {
  // A short-stepped waddle: little swing, a soft knee.
  for (const { dir, hip, knee, ankle, bend, pitch } of legPoses(phase, amount, { hipX: 4.4, swing: 0.16, bend: 0.28 })) {
    const fill = dir < 0 ? P.trousers : P.trousersShade;
    limbSegment(ctx, hip[0], hip[1], knee[0], knee[1], 7.8, 7, fill);
    limbSegment(ctx, knee[0], knee[1], ankle[0], ankle[1], 7, 6.6, fill);
    // A patched knee with running stitches.
    rr(ctx, knee[0] - 1.8, knee[1] - 1.6, 3.6, 2.8, 0.8);
    fillPath(ctx, P.patch, 0.25);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 0.18;
    ctx.setLineDash([0.4, 0.35]);
    ctx.strokeRect(knee[0] - 1.4, knee[1] - 1.2, 2.8, 2);
    ctx.setLineDash([]);
    kneeFold(ctx, knee, bend);
    ctx.save();
    ctx.translate(ankle[0], ankle[1]);
    ctx.rotate(pitch);
    drawBoot(ctx);
    ctx.restore();
  }
}

function drawBoot(ctx) {
  // Rubber boots, the trouser hem rolled over their tops.
  rr(ctx, -4.4, 4.6, 9.2, 1.7, 0.6);
  fillPath(ctx, '#1e2a20', 0.4);
  ctx.beginPath();
  ctx.moveTo(-3.4, -2.6);
  ctx.lineTo(3.2, -2.6);
  ctx.lineTo(3.6, 1);
  ctx.quadraticCurveTo(5, 1.6, 4.8, 4.8);
  ctx.lineTo(-4.2, 4.8);
  ctx.quadraticCurveTo(-4.4, 1.4, -3.6, 0.6);
  ctx.closePath();
  const g = ctx.createLinearGradient(-4, 0, 5, 0);
  g.addColorStop(0, P.boot);
  g.addColorStop(1, P.bootShade);
  fillPath(ctx, g, 0.45);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(-2.3, -1.8);
  ctx.lineTo(-2.3, 2);
  ctx.stroke();
  ctx.fillStyle = '#e8c25a';
  ctx.fillRect(-3.4, 3.6, 7.6, 0.5);
  rr(ctx, -3.8, -4, 7.4, 2, 0.7);
  fillPath(ctx, P.trousersShade, 0.4);
}

// -- Shirt, vest, towel ------------------------------------------------------------

function drawTorso(ctx) {
  // A sturdy build with a slight middle.
  ctx.beginPath();
  ctx.moveTo(-5, -44);
  ctx.quadraticCurveTo(-11, -43.4, -11, -37);
  ctx.quadraticCurveTo(-11.6, -26, -10.4, -18.6);
  ctx.quadraticCurveTo(0, -17, 10.4, -18.6);
  ctx.quadraticCurveTo(11.6, -26, 11, -37);
  ctx.quadraticCurveTo(11, -43.4, 5, -44);
  ctx.closePath();
  fillPath(ctx, P.shirt, 0.6);
  // The shirt's placket and buttons where the vest opens.
  ctx.strokeStyle = P.shirtShade;
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.moveTo(0, -42);
  ctx.lineTo(0, -19);
  ctx.stroke();
  for (const by of [-39, -34, -29, -24]) dot(ctx, 0.8, by, 0.45, '#e6eef2', 0.12);
  // The vest's two panels.
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 3.4, -43.6);
    ctx.quadraticCurveTo(dir * 8.4, -43.4, dir * 9.2, -38);
    ctx.quadraticCurveTo(dir * 11, -27, dir * 10.2, -18.6);
    ctx.lineTo(dir * 3.2, -17.8);
    ctx.lineTo(dir * 2.8, -36);
    ctx.closePath();
    const g = ctx.createLinearGradient(dir * 3, 0, dir * 12, 0);
    g.addColorStop(0, P.vestLight);
    g.addColorStop(1, P.vestShade);
    fillPath(ctx, g, 0.55);
    // One thin reflective stripe across the chest.
    ctx.beginPath();
    ctx.moveTo(dir * 3.1, -31.4);
    ctx.lineTo(dir * 9.8, -31.6);
    ctx.lineTo(dir * 9.9, -30.6);
    ctx.lineTo(dir * 3.1, -30.4);
    ctx.closePath();
    fillPath(ctx, P.reflect, 0.25);
    // A flap pocket below it, the same navy, with a snap.
    rr(ctx, dir * 6.6 - 2.3, -28.2, 4.6, 4.6, 0.5);
    fillPath(ctx, P.vest, 0.35);
    ctx.beginPath();
    ctx.moveTo(dir * 6.6 - 2.5, -28.4);
    ctx.lineTo(dir * 6.6 + 2.5, -28.4);
    ctx.lineTo(dir * 6.6 + 2.2, -26.6);
    ctx.lineTo(dir * 6.6 - 2.2, -26.6);
    ctx.closePath();
    fillPath(ctx, P.vestLight, 0.3);
    dot(ctx, dir * 6.6, -27.1, 0.35, '#d6dae4', 0.1);
  }
  // Cleaning cloths poking out of his left pocket (viewer's right) and a
  // pen in the right; a walkie on a clip at the left chest.
  for (const [cx, col] of [[5.4, '#ff8fb8'], [6.6, '#ffd166'], [7.8, '#4fa8e0']]) {
    ctx.beginPath();
    ctx.moveTo(cx - 0.7, -28.4);
    ctx.quadraticCurveTo(cx, -30.6, cx + 0.7, -28.4);
    ctx.closePath();
    fillPath(ctx, col, 0.3);
  }
  rr(ctx, -6, -30.8, 0.7, 3, 0.3);
  fillPath(ctx, '#2e3a5a', 0.25);
  dot(ctx, -5.65, -31, 0.35, '#d6dae4', 0.1);
  rr(ctx, 5.4, -40.6, 2.6, 4, 0.5);
  fillPath(ctx, '#2a2c30', 0.35);
  rr(ctx, 6.4, -42.6, 0.6, 2, 0.2);
  fillPath(ctx, '#111114', 0.15);
  dot(ctx, 7.4, -39.8, 0.3, '#5cf08a', 0);
  // A name tag stitched above the right pocket.
  rr(ctx, -9.6, -37.6, 5, 1.6, 0.3);
  fillPath(ctx, '#f4f2ea', 0.25);
  ctx.fillStyle = '#3a4a52';
  for (let i = 0; i < 3; i++) ctx.fillRect(-9 + i * 1.4, -37.1, 1, 0.6);
  // A canvas belt with a key ring, peeking under the vest.
  rr(ctx, -3, -19.8, 6, 2, 0.4);
  fillPath(ctx, '#6a5a44', 0.35);
  ctx.strokeStyle = '#d6dae4';
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.arc(1.6, -17.2, 0.9, 0, Math.PI * 2);
  ctx.stroke();
}

function drawTowel(ctx, stride) {
  // A white towel slung round his neck, the ends hanging down his front.
  const sway = stride * 0.8;
  ctx.beginPath();
  ctx.moveTo(-6.4, -46.4);
  ctx.quadraticCurveTo(0, -43.4, 6.4, -46.4);
  ctx.lineTo(7.4, -43);
  ctx.quadraticCurveTo(0, -40.4, -7.4, -43);
  ctx.closePath();
  fillPath(ctx, P.towel, 0.5);
  for (const [dir, len] of [[-1, 9], [1, 7]]) {
    ctx.beginPath();
    ctx.moveTo(dir * 3.6, -42);
    ctx.lineTo(dir * 7.4, -43);
    ctx.lineTo(dir * 6.8 + sway, -43 + len);
    ctx.lineTo(dir * 3 + sway, -42 + len);
    ctx.closePath();
    fillPath(ctx, P.towel, 0.5);
    // Terry stripes near the end, and a fringe.
    ctx.strokeStyle = '#4fa8e0';
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    ctx.moveTo(dir * 3.1 + sway, -44.4 + len);
    ctx.lineTo(dir * 6.9 + sway, -45.4 + len);
    ctx.stroke();
    ctx.strokeStyle = P.towelShade;
    ctx.lineWidth = 0.25;
    for (let i = 0; i < 5; i++) {
      const fx = dir * (3.3 + i * 0.85) + sway;
      ctx.beginPath();
      ctx.moveTo(fx, -42.4 + len - i * 0.2);
      ctx.lineTo(fx, -41.4 + len - i * 0.2);
      ctx.stroke();
    }
  }
}

// -- Arms ---------------------------------------------------------------------

/** A rolled-up work-shirt sleeve, a bare forearm, then a rubber glove. */
function workArm(ctx, shoulder, elbow, wrist) {
  sleeve(ctx, shoulder, elbow, elbow, P.shirt, P.shirtShade, 5.4);
  const mid = [elbow[0] + (wrist[0] - elbow[0]) * 0.62, elbow[1] + (wrist[1] - elbow[1]) * 0.62];
  sleeve(ctx, elbow, mid, mid, P.skin, P.skinShade, 3.4);
  sleeve(ctx, mid, wrist, wrist, P.glove, '#d8a83a', 3.3);
  // The rolled cuff band at the elbow, and the glove's flared top.
  const a = Math.atan2(wrist[1] - elbow[1], wrist[0] - elbow[0]);
  ctx.beginPath();
  ctx.ellipse(elbow[0], elbow[1], 2.9, 1.4, a + Math.PI / 2, 0, Math.PI * 2);
  fillPath(ctx, P.shirtShade, 0.4);
  ctx.beginPath();
  ctx.ellipse(mid[0], mid[1], 2.2, 1, a + Math.PI / 2, 0, Math.PI * 2);
  fillPath(ctx, P.glove, 0.35);
}

/** His left arm (viewer's right) carries a spray bottle. */
function drawSprayArm(ctx, stride) {
  const shoulder = [11.4, -39.4];
  const { elbow, wrist } = swingArm(shoulder, stride * 3, 1);
  workArm(ctx, shoulder, elbow, wrist);
  // The bottle hangs from his fingers by its trigger.
  ctx.save();
  ctx.translate(wrist[0], wrist[1] + 2.6);
  ctx.rotate(stride * 0.08);
  ctx.beginPath();
  ctx.moveTo(-2, 1.4);
  ctx.lineTo(2, 1.4);
  ctx.quadraticCurveTo(2.8, 6, 2.2, 9);
  ctx.lineTo(-2.2, 9);
  ctx.quadraticCurveTo(-2.8, 6, -2, 1.4);
  ctx.closePath();
  const g = ctx.createLinearGradient(-2, 0, 2, 0);
  g.addColorStop(0, 'rgba(160,220,255,0.85)');
  g.addColorStop(1, 'rgba(100,170,220,0.85)');
  fillPath(ctx, g, 0.4);
  ctx.fillStyle = 'rgba(60,150,220,0.5)';
  ctx.fillRect(-2.2, 4.6, 4.4, 4.2);
  rr(ctx, -1.6, 4.8, 3.2, 2.2, 0.3);
  fillPath(ctx, '#ffffff', 0.2);
  ctx.fillStyle = '#3fb58f';
  ctx.fillRect(-1.1, 5.4, 2.2, 0.4);
  ctx.fillRect(-1.1, 6.1, 1.4, 0.3);
  // The trigger head and nozzle.
  rr(ctx, -1.6, -0.6, 3.6, 2.2, 0.5);
  fillPath(ctx, '#e8558f', 0.35);
  rr(ctx, 1.8, -0.4, 1.6, 0.9, 0.2);
  fillPath(ctx, '#e8558f', 0.25);
  ctx.restore();
  drawHand(ctx, wrist[0], wrist[1], 0.2, { glove: P.glove });
}

/** His right arm (viewer's left) grips the mop handle. */
function drawMopArm(ctx, swish) {
  const shoulder = [-11.4, -39.4];
  const grip = [-16.4 + swish * 0.12, -27.4];
  const elbow = [-15.2, -31.4];
  drawMopPole(ctx, swish);
  workArm(ctx, shoulder, elbow, grip);
  drawHand(ctx, grip[0] + 0.4, grip[1] - 0.4, 0.3, { glove: P.glove });
  // His fingers wrapped round the handle.
  ctx.strokeStyle = 'rgba(160,110,30,0.7)';
  ctx.lineWidth = 0.3;
  for (const dy of [-0.2, 0.7, 1.6]) {
    ctx.beginPath();
    ctx.moveTo(grip[0] - 1, grip[1] + dy);
    ctx.lineTo(grip[0] + 1.6, grip[1] + dy - 0.2);
    ctx.stroke();
  }
}

// -- Head -----------------------------------------------------------------------

const HEAD_Y = -55;
const EYE_Y = -54;

function drawHead(ctx, t) {
  rr(ctx, -3, -47.6, 6, 4.4, 1);
  fillPath(ctx, P.skinShade, 0.45);
  // Short grey hair at the sides, under the bandana.
  ctx.fillStyle = P.hair;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(dir * 8.8, HEAD_Y - 2, 1.8, 4.2, dir * 0.1, 0, Math.PI * 2);
    fillPath(ctx, P.hair, 0.3);
  }
  drawEars(ctx, HEAD_Y, P.skin, P.skinDeep, { x: 9.8 });
  drawFace(ctx, HEAD_Y, P.skin, P.skinShade, { w: 9.6, chin: 10.8, jaw: 0.5 });
  drawEyes(ctx, EYE_Y, { iris: P.iris, irisLight: P.irisLight }, { droop: 0.7, blinking: isJanitorBlinkingAt(t) });
  // Crow's feet and smile lines.
  ctx.strokeStyle = 'rgba(150,90,60,0.45)';
  ctx.lineWidth = 0.28;
  for (const dir of [-1, 1]) {
    for (const dy of [-0.4, 0.8]) {
      ctx.beginPath();
      ctx.moveTo(dir * 7.8, EYE_Y + dy * 0.6);
      ctx.lineTo(dir * 8.9, EYE_Y + dy);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(dir * 3.6, EYE_Y + 4.6);
    ctx.quadraticCurveTo(dir * 4.8, EYE_Y + 6.8, dir * 4, EYE_Y + 8.4);
    ctx.stroke();
  }
  // Bushy grey brows, a few hairs out of place, kindly raised.
  drawBrows(ctx, EYE_Y, P.hairDeep, { thick: 1, lift: 0.7, y: -4.6 });
  ctx.strokeStyle = P.hair;
  ctx.lineWidth = 0.28;
  for (const dir of [-1, 1]) {
    for (const bx of [2.8, 4.2, 5.6]) {
      ctx.beginPath();
      ctx.moveTo(dir * bx, EYE_Y - 4.4 - (bx < 3 ? 0.6 : 0));
      ctx.lineTo(dir * (bx + 0.9), EYE_Y - 5);
      ctx.stroke();
    }
  }
  drawNose(ctx, EYE_Y, 'rgba(160,96,64,0.6)', 0.5);
  // Warm, slightly ruddy cheeks and nose tip.
  ctx.fillStyle = 'rgba(220,110,90,0.18)';
  for (const [cx, cy, rx] of [[-5.6, 3.8, 1.9], [5.6, 3.8, 1.9], [0.4, 4.4, 1.3]]) {
    ctx.beginPath();
    ctx.ellipse(cx, EYE_Y + cy, rx, rx * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  drawMouth(ctx, HEAD_Y, 'smile', P.lips);
  // A trim grey moustache over the smile.
  ctx.beginPath();
  ctx.moveTo(0, HEAD_Y + 4.6);
  ctx.bezierCurveTo(-1.6, HEAD_Y + 4, -3.6, HEAD_Y + 4.6, -3.6, HEAD_Y + 5.8);
  ctx.quadraticCurveTo(-1.8, HEAD_Y + 5.4, 0, HEAD_Y + 5.7);
  ctx.quadraticCurveTo(1.8, HEAD_Y + 5.4, 3.6, HEAD_Y + 5.8);
  ctx.bezierCurveTo(3.6, HEAD_Y + 4.6, 1.6, HEAD_Y + 4, 0, HEAD_Y + 4.6);
  ctx.closePath();
  fillPath(ctx, P.hair, 0.35);
  hairStrands(ctx, HEAD_Y, [[-2.8, 5.2, -1.6, 4.7, -0.5, 5], [2.8, 5.2, 1.6, 4.7, 0.5, 5]], P.hairDeep, 0.22);
  drawBandana(ctx, t);
}

function drawBandana(ctx, t) {
  // The cloth hugging his head, cinched at the brow.
  ctx.beginPath();
  ctx.moveTo(-10, HEAD_Y - 4.6);
  ctx.bezierCurveTo(-11.8, HEAD_Y - 19.6, 11.8, HEAD_Y - 19.6, 10, HEAD_Y - 4.6);
  ctx.quadraticCurveTo(0, HEAD_Y - 8.6, -10, HEAD_Y - 4.6);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, HEAD_Y - 18, 0, HEAD_Y - 5);
  g.addColorStop(0, '#3a4870');
  g.addColorStop(1, P.bandana);
  fillPath(ctx, g, 0.55);
  // A white paisley-ish dot pattern and fold creases.
  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const [px, py] of [[-6, -13], [-2, -15.4], [3, -14.2], [7, -11], [-8, -8.6], [0, -10.6], [5, -8.2]]) {
    ctx.beginPath();
    ctx.ellipse(px, HEAD_Y + py, 0.8, 0.5, px * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(px + 0.6, HEAD_Y + py - 1, 0.3, 0.3);
  }
  hairStrands(ctx, HEAD_Y, [[-8, -7, -4, -12, 2, -16], [8, -7, 5, -11, 4, -16.4]], 'rgba(10,16,30,0.4)', 0.4);
  ctx.restore();
  // The knot and its two tails at the back, peeking out on his left
  // (viewer's right), fluttering a little.
  const flutter = Math.sin(t * 2.4) * 0.12;
  ctx.save();
  ctx.translate(9.6, HEAD_Y - 9.4);
  dot(ctx, 0, 0, 1.5, P.bandana, 0.45);
  for (const [r, len] of [[0.5, 5.6], [1.1, 4.4]]) {
    ctx.save();
    ctx.rotate(r + flutter);
    ctx.beginPath();
    ctx.moveTo(0, -0.8);
    ctx.lineTo(len, -1.2);
    ctx.lineTo(len - 0.6, 1);
    ctx.lineTo(0, 0.8);
    ctx.closePath();
    fillPath(ctx, P.bandana, 0.4);
    ctx.restore();
  }
  ctx.restore();
}
