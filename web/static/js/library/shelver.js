// The Shelver (정리 담당), who power-walks the 1st Floor between the Front
// Desk and the Stairs and shelves the oldest Return Cart book when asked
// ("make others more detailed like them"). A brisk, tidy woman: chestnut
// hair twisted into a high bun with a yellow claw clip and a pencil stuck
// through it, a few loose wisps; cat-eye glasses on a beaded chain; a green
// cardigan with pearl buttons and a sticky-note pad in its pocket over a
// white blouse with a Peter Pan collar; a navy A-line skirt, sheer tights and
// flat loafers; a staff lanyard. She hugs a stack of returns, each book with
// a call-number label, the top one bristling with bookmarks. Layered flat
// shading, no eye highlights, like the game's other characters.
//
// Coordinates follow Hospital Shift's anime adult frame (feet at 0,
// shoulders about -40, face centre about -55); see staff-kit.js.

import {
  fillPath, rr, dot, isBlinkingAt, walkCycle, groundShadow, limbSegment, legPoses,
  sleeve, drawHand, drawFace, drawEars, drawNose, drawEyes, drawBrows, drawMouth, drawBlush, hairStrands,
} from './staff-kit.js';

const P = {
  skin: '#f6d6bd',
  skinShade: '#e6b898',
  skinDeep: '#cf9c7c',
  hair: '#5a3420',
  hairMid: '#744632',
  hairDeep: '#3a2014',
  hairShine: 'rgba(210,150,110,0.5)',
  iris: '#3a2a1a',
  irisLight: '#8a6a3a',
  cardigan: '#3fb58f',
  cardiganShade: '#2f9474',
  cardiganLight: '#5ac8a2',
  blouse: '#ffffff',
  blouseShade: '#e2e4ea',
  skirt: '#2e3a5a',
  skirtShade: '#222b44',
  tights: '#e8d2c2',
  tightsShade: '#d4b8a6',
  shoe: '#6a3a2a',
  shoeShade: '#4a2618',
  clip: '#ffd166',
  frame: '#2a1e2a',
  lips: '#c8707a',
};

/** The returns she's carrying, bottom to top: cover colour, and a ribbon if any. */
const BOOKS = [
  { w: 13, h: 2.6, colour: '#8a2a3e', dx: 0 },
  { w: 12, h: 2.2, colour: '#2e3a5a', dx: 0.6 },
  { w: 12.6, h: 3, colour: '#e8c25a', dx: -0.4 },
  { w: 11.4, h: 2.2, colour: '#3fb58f', dx: 0.8 },
  { w: 12.2, h: 2.6, colour: '#e8558f', dx: 0 },
];

/** Whether she's blinking at time `t`. */
export function isShelverBlinkingAt(t) {
  return isBlinkingAt(t, 3.4, 0.9);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - feet centre
 * @param {number} y - feet line
 * @param {{scale?: number, t?: number, walking?: boolean}} [opts]
 */
export function drawShelver(ctx, x, y, opts = {}) {
  const k = (opts.scale ?? 1) * 0.97;
  const t = opts.t ?? 0;
  // walk-styles.js's 'power-walk' steps at 9; quick, short strides.
  const { phase, amount, stride, breathe } = walkCycle(t, 9, Boolean(opts.walking));

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  groundShadow(ctx, 13);
  drawLegs(ctx, phase, amount);
  ctx.save();
  ctx.translate(0, -breathe * 0.4);
  drawSkirt(ctx, stride);
  drawTorso(ctx, stride);
  drawHead(ctx, t, amount);
  drawArmsAndBooks(ctx, stride, amount);
  ctx.restore();
  ctx.restore();
}

// -- Legs ---------------------------------------------------------------------

function drawLegs(ctx, phase, amount) {
  for (const { dir, hip, knee, ankle, pitch } of legPoses(phase, amount, { hipX: 3.2, hipY: -19, thigh: 10, shin: 10.6, swing: 0.2, bend: 0.4 })) {
    const fill = dir < 0 ? P.tights : P.tightsShade;
    limbSegment(ctx, hip[0], hip[1], knee[0], knee[1], 5.2, 4.4, fill, 0.45);
    limbSegment(ctx, knee[0], knee[1], ankle[0], ankle[1], 4.4, 3.4, fill, 0.45);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(knee[0] - 0.5, knee[1] + 1);
    ctx.lineTo(ankle[0] - 0.3, ankle[1] - 1.4);
    ctx.stroke();
    ctx.save();
    ctx.translate(ankle[0], ankle[1]);
    ctx.rotate(pitch);
    drawLoafer(ctx);
    ctx.restore();
  }
}

function drawLoafer(ctx) {
  rr(ctx, -3.4, 4, 7.4, 1.3, 0.5);
  fillPath(ctx, '#2a1810', 0.35);
  ctx.beginPath();
  ctx.moveTo(-3.2, 4.2);
  ctx.quadraticCurveTo(-3.4, 1, -1, 1);
  ctx.lineTo(1, 1);
  ctx.quadraticCurveTo(4, 1.2, 3.8, 4.2);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 1, 0, 4.4);
  g.addColorStop(0, P.shoe);
  g.addColorStop(1, P.shoeShade);
  fillPath(ctx, g, 0.4);
  // The penny strap with its slot, and a toe shine.
  rr(ctx, -2, 1.6, 4.4, 1, 0.3);
  fillPath(ctx, P.shoeShade, 0.25);
  ctx.fillStyle = '#2a1810';
  ctx.fillRect(-0.2, 1.9, 1.2, 0.35);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.moveTo(1.6, 3);
  ctx.quadraticCurveTo(2.8, 2.8, 3.1, 3.6);
  ctx.stroke();
}

// -- Clothes ------------------------------------------------------------------

function drawSkirt(ctx, stride) {
  const sway = stride * 1.2;
  ctx.beginPath();
  ctx.moveTo(-8.4, -21.6);
  ctx.lineTo(8.4, -21.6);
  ctx.lineTo(10.8 + sway, -6.4);
  ctx.quadraticCurveTo(0, -5, -10.8 + sway, -6.4);
  ctx.closePath();
  const g = ctx.createLinearGradient(-11, 0, 11, 0);
  g.addColorStop(0, '#3a4870');
  g.addColorStop(0.55, P.skirt);
  g.addColorStop(1, P.skirtShade);
  fillPath(ctx, g, 0.55);
  // Two soft A-line folds, a front seam and a hem stitch.
  ctx.strokeStyle = 'rgba(10,14,30,0.45)';
  ctx.lineWidth = 0.4;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 4, -19);
    ctx.quadraticCurveTo(dir * 5.4 + sway * 0.5, -12, dir * 6.4 + sway, -6);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 0.25;
  ctx.setLineDash([0.5, 0.4]);
  ctx.beginPath();
  ctx.moveTo(-10.2 + sway, -7.4);
  ctx.quadraticCurveTo(0, -6.1, 10.2 + sway, -7.4);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawTorso(ctx, stride) {
  // The blouse underneath.
  ctx.beginPath();
  ctx.moveTo(-4.8, -43.6);
  ctx.quadraticCurveTo(-10.2, -43, -10, -37);
  ctx.lineTo(-8.6, -21);
  ctx.quadraticCurveTo(0, -19.8, 8.6, -21);
  ctx.lineTo(10, -37);
  ctx.quadraticCurveTo(10.2, -43, 4.8, -43.6);
  ctx.closePath();
  fillPath(ctx, P.blouse, 0.6);
  for (const by of [-39, -34.6, -30.2, -25.8]) dot(ctx, 0, by, 0.4, P.blouseShade, 0.12);
  // The cardigan's front panels, open over it.
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 3.6, -43.6);
    ctx.quadraticCurveTo(dir * 9.4, -43.4, dir * 10.4, -37.6);
    ctx.lineTo(dir * 10.2, -18.8);
    ctx.quadraticCurveTo(dir * 6, -18, dir * 2.6, -18.6);
    ctx.lineTo(dir * 2.6, -36);
    ctx.closePath();
    const g = ctx.createLinearGradient(dir * 2.6, 0, dir * 10.4, 0);
    g.addColorStop(0, P.cardiganLight);
    g.addColorStop(1, P.cardiganShade);
    fillPath(ctx, g, 0.55);
    // Fine knit ribbing down the button band and along the hem.
    ctx.strokeStyle = 'rgba(20,90,70,0.5)';
    ctx.lineWidth = 0.25;
    ctx.beginPath();
    ctx.moveTo(dir * 3.6, -42.8);
    ctx.lineTo(dir * 3.6, -19);
    ctx.stroke();
    for (let xx = 3; xx <= 10; xx += 0.9) {
      ctx.beginPath();
      ctx.moveTo(dir * xx, -20.6);
      ctx.lineTo(dir * xx, -18.8);
      ctx.stroke();
    }
  }
  // Pearl buttons on her right panel (viewer's left).
  for (const by of [-38, -33.4, -28.8, -24.2]) {
    dot(ctx, -3.1, by, 0.6, '#fbf6ee', 0.18);
    ctx.fillStyle = 'rgba(200,190,220,0.6)';
    ctx.fillRect(-3.2, by + 0.1, 0.35, 0.3);
  }
  // A Peter Pan collar, rounded tips over the cardigan.
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, -44.4);
    ctx.quadraticCurveTo(dir * 3, -45.6, dir * 5.2, -44.4);
    ctx.quadraticCurveTo(dir * 5.6, -41.4, dir * 2.6, -41);
    ctx.quadraticCurveTo(dir * 0.8, -41.4, 0, -43);
    ctx.closePath();
    fillPath(ctx, P.blouse, 0.45);
  }
  // A thin black ribbon bow at the collar.
  ctx.fillStyle = '#1e1a22';
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, -43.2);
    ctx.lineTo(dir * 1.6, -44);
    ctx.lineTo(dir * 1.6, -42.4);
    ctx.closePath();
    ctx.fill();
  }
  // The staff lanyard, the card swinging out in front of the books.
  const swing = stride * 0.6;
  ctx.strokeStyle = '#e8558f';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(-3.4, -43.2);
  ctx.quadraticCurveTo(-1.4 + swing, -36, 0 + swing, -33);
  ctx.quadraticCurveTo(1.4 + swing, -36, 3.4, -43.2);
  ctx.stroke();
}

// -- Arms and the books --------------------------------------------------------------

function drawArmsAndBooks(ctx, stride, amount) {
  // The stack rides up a little on each quick step.
  const bounce = Math.abs(Math.sin(stride * 1.6)) * 0.6 * amount;
  const base = [0.8, -24.4 - bounce];
  // Her right arm (viewer's left) cradles the stack from below…
  sleeve(ctx, [-9.8, -39.6], [-12, -29.2], [-4.6, base[1] + 1.2], P.cardigan, P.cardiganShade, 5);
  rr(ctx, -6.6, base[1] - 0.4, 3, 2.6, 0.6);
  fillPath(ctx, P.cardiganShade, 0.35);
  let y = base[1];
  ctx.save();
  ctx.translate(base[0], 0);
  ctx.rotate(-0.04);
  BOOKS.forEach((b, i) => {
    const bx = -b.w / 2 + b.dx;
    // The fore-edge pages, a cover top band, and a call-number label.
    rr(ctx, bx, y - b.h, b.w, b.h, 0.4);
    fillPath(ctx, b.colour, 0.4);
    ctx.fillStyle = '#fbf6e6';
    ctx.fillRect(bx + 0.6, y - b.h + 0.5, b.w - 1.8, b.h - 1);
    ctx.strokeStyle = 'rgba(160,140,110,0.6)';
    ctx.lineWidth = 0.15;
    for (let j = 1; j < 3; j++) {
      ctx.beginPath();
      ctx.moveTo(bx + 0.6, y - b.h + 0.5 + j * (b.h - 1) / 3);
      ctx.lineTo(bx + b.w - 1.2, y - b.h + 0.5 + j * (b.h - 1) / 3);
      ctx.stroke();
    }
    ctx.fillStyle = b.colour;
    ctx.fillRect(bx + b.w - 1.2, y - b.h, 1.2, b.h);
    rr(ctx, bx + b.w - 4, y - b.h + 0.3, 2.4, b.h - 0.6, 0.2);
    fillPath(ctx, '#ffffff', 0.15);
    ctx.fillStyle = i % 2 ? '#e8558f' : '#4fa8e0';
    ctx.fillRect(bx + b.w - 4, y - b.h + 0.3, 2.4, 0.5);
    y -= b.h;
  });
  // Bookmarks sticking out of the top book.
  for (const [mx, col, h] of [[-3.6, '#ffd166', 2.6], [-1, '#ff8fb8', 2], [2.2, '#7ac74f', 3]]) {
    rr(ctx, mx, y - h, 1.2, h + 0.4, 0.2);
    fillPath(ctx, col, 0.25);
  }
  ctx.restore();
  // …and her left (viewer's right) wraps round and holds it to her side.
  sleeve(ctx, [9.8, -39.6], [12.6, -30.2], [6.8, base[1] - 5.6], P.cardigan, P.cardiganShade, 5);
  rr(ctx, 6, base[1] - 7, 2.8, 2.4, 0.6);
  fillPath(ctx, P.cardiganShade, 0.35);
  drawHand(ctx, 5.6, base[1] - 5.4, 1.5, { skin: P.skin, deep: P.skinDeep });
  // A slim gold watch.
  rr(ctx, 6.6, base[1] - 6.4, 1.1, 2.2, 0.3);
  fillPath(ctx, '#e8c25a', 0.15);
  drawHand(ctx, -5.6, base[1] + 0.6, -1.2, { skin: P.skin, deep: P.skinDeep });
  // The lanyard's ID card, hanging over the stack.
  const swing = stride * 0.6;
  rr(ctx, -1.6 + swing, -33.2, 3.2, 4.2, 0.4);
  fillPath(ctx, '#ffffff', 0.3);
  ctx.fillStyle = '#e8558f';
  ctx.fillRect(-1.6 + swing, -33.2, 3.2, 0.9);
  rr(ctx, -1.1 + swing, -32, 1.3, 1.6, 0.2);
  fillPath(ctx, P.tights, 0.1);
  ctx.fillStyle = '#9a9aa8';
  ctx.fillRect(0.4 + swing, -31.8, 0.9, 0.3);
  ctx.fillRect(0.4 + swing, -31.2, 0.7, 0.3);
  // A pad of sticky notes in her cardigan pocket.
  rr(ctx, -9.2, -22.8, 3.4, 3.2, 0.3);
  fillPath(ctx, P.clip, 0.3);
  rr(ctx, -10, -21.4, 5, 2.4, 0.5);
  fillPath(ctx, P.cardiganShade, 0.35);
}

// -- Head and hair ---------------------------------------------------------

const HEAD_Y = -55;
const EYE_Y = -54;

function drawHead(ctx, t, amount) {
  rr(ctx, -2.2, -47.4, 4.4, 4, 1);
  fillPath(ctx, P.skinShade, 0.4);
  drawBun(ctx);
  drawEars(ctx, HEAD_Y, P.skin, P.skinDeep, { x: 9.2 });
  // Small gold hoops.
  ctx.strokeStyle = '#e8c25a';
  ctx.lineWidth = 0.4;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(dir * 9.5, HEAD_Y + 3.4, 0.8, 0, Math.PI * 2);
    ctx.stroke();
  }
  drawFace(ctx, HEAD_Y, P.skin, P.skinShade, { w: 9, chin: 10.8 });
  drawEyes(ctx, EYE_Y, { iris: P.iris, irisLight: P.irisLight }, { lashes: true, blinking: isShelverBlinkingAt(t) });
  drawBrows(ctx, EYE_Y, P.hairMid, { thick: 0.55, lift: amount ? -0.3 : 0, y: -4.6 });
  drawBlush(ctx, EYE_Y, 0.2);
  drawNose(ctx, EYE_Y, 'rgba(200,130,110,0.5)', -0.3);
  drawMouth(ctx, HEAD_Y, 'smirk', P.lips);
  // A small beauty mark under her left eye (viewer's right).
  dot(ctx, 6.2, EYE_Y + 3, 0.28, '#5a3420', 0);
  drawCatEyeGlasses(ctx);
  drawFrontHair(ctx, t);
}

/** A twisted bun high at the back, peeking over her crown, a pencil through it and a yellow claw clip. */
function drawBun(ctx) {
  ctx.save();
  ctx.translate(-4.6, HEAD_Y - 15.4);
  ctx.rotate(-0.25);
  // The pencil, behind the bun.
  ctx.save();
  ctx.rotate(0.9);
  rr(ctx, -8, -0.6, 14, 1.2, 0.3);
  fillPath(ctx, '#ffd166', 0.3);
  rr(ctx, -9.4, -0.6, 1.6, 1.2, 0.3);
  fillPath(ctx, '#ff8fb8', 0.25);
  ctx.restore();
  ctx.beginPath();
  ctx.ellipse(0, 0, 5.4, 4.2, 0, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(-1.4, -1.4, 0.5, 0, 0, 5.6);
  g.addColorStop(0, P.hairMid);
  g.addColorStop(1, P.hairDeep);
  fillPath(ctx, g, 0.5);
  // The twist, spiralling in.
  ctx.strokeStyle = P.hairShine;
  ctx.lineWidth = 0.35;
  for (const r of [1.4, 2.6, 3.8]) {
    ctx.beginPath();
    ctx.ellipse(0.2, 0.1, r, r * 0.75, 0.3, Math.PI * 0.1, Math.PI * 1.4);
    ctx.stroke();
  }
  // The pencil's point coming out the other side.
  ctx.save();
  ctx.rotate(0.9);
  ctx.beginPath();
  ctx.moveTo(5.4, -0.6);
  ctx.lineTo(8, 0);
  ctx.lineTo(5.4, 0.6);
  ctx.closePath();
  fillPath(ctx, '#e8c8a0', 0.25);
  ctx.restore();
  // The claw clip gripping the bun's base.
  ctx.translate(2.6, 3);
  ctx.rotate(0.3);
  rr(ctx, -3, -1.3, 6, 2.6, 1);
  fillPath(ctx, P.clip, 0.4);
  ctx.strokeStyle = '#e0a83a';
  ctx.lineWidth = 0.3;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 1.1, -1.1);
    ctx.lineTo(i * 1.1, 1.1);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCatEyeGlasses(ctx) {
  for (const dir of [-1, 1]) {
    const cx = dir * 4.3;
    ctx.beginPath();
    ctx.moveTo(cx - dir * 2.8, EYE_Y - 1.4);
    ctx.quadraticCurveTo(cx, EYE_Y - 3, cx + dir * 3.6, EYE_Y - 3.2);
    ctx.quadraticCurveTo(cx + dir * 3.2, EYE_Y + 2.6, cx, EYE_Y + 2.4);
    ctx.quadraticCurveTo(cx - dir * 3, EYE_Y + 2.2, cx - dir * 2.8, EYE_Y - 1.4);
    ctx.closePath();
    ctx.fillStyle = 'rgba(200,220,255,0.12)';
    ctx.fill();
    ctx.strokeStyle = P.frame;
    ctx.lineWidth = 0.75;
    ctx.stroke();
    // Little gold dots at the upswept corners.
    dot(ctx, cx + dir * 3, EYE_Y - 2.6, 0.32, '#e8c25a', 0);
  }
  ctx.strokeStyle = P.frame;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(-1.5, EYE_Y - 1.2);
  ctx.quadraticCurveTo(0, EYE_Y - 2, 1.5, EYE_Y - 1.2);
  ctx.moveTo(-7.9, EYE_Y - 2.6);
  ctx.lineTo(-9.2, EYE_Y - 1.6);
  ctx.moveTo(7.9, EYE_Y - 2.6);
  ctx.lineTo(9.2, EYE_Y - 1.6);
  ctx.stroke();
  // The beaded glasses chain looping down behind her ears to her collar.
  ctx.fillStyle = '#e8c25a';
  for (const dir of [-1, 1]) {
    for (let i = 0; i <= 9; i++) {
      const f = i / 9;
      const px = dir * (9.2 + Math.sin(f * Math.PI) * 1.6 - f * 3.4);
      const py = EYE_Y - 1.6 + f * 12.4;
      ctx.beginPath();
      ctx.arc(px, py, i % 3 ? 0.22 : 0.36, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawFrontHair(ctx, t) {
  // Hair smoothed back from a side part to the bun.
  ctx.beginPath();
  ctx.moveTo(-9.8, HEAD_Y + 2);
  ctx.bezierCurveTo(-11.8, HEAD_Y - 19.6, 11.8, HEAD_Y - 19.6, 9.8, HEAD_Y + 2);
  ctx.quadraticCurveTo(9.2, HEAD_Y - 4, 7.4, HEAD_Y - 7.6);
  ctx.quadraticCurveTo(2, HEAD_Y - 10, -2.6, HEAD_Y - 9.6);
  ctx.quadraticCurveTo(-7.6, HEAD_Y - 8, -8.6, HEAD_Y - 3);
  ctx.closePath();
  const g = ctx.createLinearGradient(-10, HEAD_Y - 18, 10, HEAD_Y);
  g.addColorStop(0, P.hairMid);
  g.addColorStop(1, P.hair);
  fillPath(ctx, g, 0.55);
  ctx.save();
  ctx.clip();
  hairStrands(ctx, HEAD_Y, [
    [-2.4, -16, -7, -12, -9, -2], [-2.4, -16, -5, -10, -7.6, -4],
    [-2.4, -16, 4, -14, 8.6, -3], [-2.4, -16, 3, -11, 6.6, -6], [-2.4, -16, 6, -16, 9.4, -6],
  ], P.hairShine);
  ctx.strokeStyle = 'rgba(230,170,130,0.45)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(0, HEAD_Y - 15.4);
  ctx.quadraticCurveTo(4.6, HEAD_Y - 15, 7, HEAD_Y - 11);
  ctx.stroke();
  ctx.restore();
  // The side part.
  ctx.strokeStyle = P.hairDeep;
  ctx.lineWidth = 0.45;
  ctx.beginPath();
  ctx.moveTo(-2.4, HEAD_Y - 14.4);
  ctx.lineTo(-2.8, HEAD_Y - 12.6);
  ctx.stroke();
  // A swept fringe from the part across her brow.
  ctx.beginPath();
  ctx.moveTo(-2.6, HEAD_Y - 10);
  ctx.quadraticCurveTo(-7.4, HEAD_Y - 8.6, -8.6, HEAD_Y - 3.4);
  ctx.quadraticCurveTo(-6.4, HEAD_Y - 6.4, -3, HEAD_Y - 7.4);
  ctx.closePath();
  fillPath(ctx, P.hair, 0.4);
  // Loose wisps by her ears, drifting.
  const drift = Math.sin(t * 1.7) * 0.4;
  ctx.strokeStyle = P.hair;
  ctx.lineWidth = 0.5;
  ctx.lineCap = 'round';
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 8.6, HEAD_Y - 3);
    ctx.quadraticCurveTo(dir * (9.8 + drift), HEAD_Y + 2, dir * (8.8 + drift), HEAD_Y + 6);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}
