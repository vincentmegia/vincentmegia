// The Volunteer (자원봉사자), a university student who helps out on Library
// Shift's 2nd Floor and brings Eun-mi a coffee when asked ("make others more
// detailed like them", then "the volunteer looks ugly" — redrawn softer and
// slimmer). Long, wavy chestnut hair in a low side ponytail tied with a
// yellow ribbon, draped forward over her shoulder; wispy see-through bangs;
// big warm-brown eyes behind thin gold wire glasses, rosy cheeks and a
// small smile. A teal volunteer vest with yellow piping, a heart logo and a
// name badge over a cream cable-knit jumper with ribbed cuffs and a white
// shirt collar; a pleated teal skirt, white crew socks and brown loafers;
// a staff lanyard. She carries a tray with two takeaway coffees, steam
// curling from them. Layered flat shading, no eye highlights, like the
// game's other characters.
//
// Coordinates follow Hospital Shift's anime adult frame (feet at 0,
// shoulders about -40, face centre about -55); see staff-kit.js.

import {
  outline, fillPath, rr, dot, isBlinkingAt, walkCycle, groundShadow, limbSegment, legPoses,
  sleeve, swingArm, drawHand, drawFace, drawEars, drawNose, drawEyes, drawBrows, drawMouth, drawBlush, hairStrands,
} from './staff-kit.js';

const P = {
  skin: '#f8dcc6',
  skinShade: '#ecc0a2',
  skinDeep: '#d6a284',
  hair: '#6a3e2a',
  hairMid: '#86523a',
  hairDeep: '#4a2a1c',
  hairShine: 'rgba(230,170,130,0.55)',
  iris: '#6a3e22',
  irisLight: '#b07a48',
  vest: '#3f7a6a',
  vestShade: '#2f5e52',
  vestLight: '#55968a',
  piping: '#ffd166',
  knit: '#f6eedc',
  knitShade: '#e2d6bc',
  collar: '#ffffff',
  skirt: '#3f7a6a',
  skirtShade: '#2f5e52',
  sock: '#ffffff',
  sockShade: '#e4e6ee',
  shoe: '#7a4a32',
  shoeShade: '#5a3220',
  cup: '#f8f4ea',
  cupSleeve: '#a8744a',
  tray: '#c8a274',
  trayShade: '#a8845a',
  wire: '#c9a24a',
  lips: '#e07a86',
};

/** Whether she's blinking at time `t`. */
export function isVolunteerBlinkingAt(t) {
  return isBlinkingAt(t, 3.1, 0.4);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - feet centre
 * @param {number} y - feet line
 * @param {{scale?: number, t?: number, walking?: boolean}} [opts]
 */
export function drawVolunteer(ctx, x, y, opts = {}) {
  const k = (opts.scale ?? 1) * 0.96; // a little shorter than the men
  const t = opts.t ?? 0;
  // walk-styles.js's 'skip' hops at 6.
  const { phase, amount, stride, breathe } = walkCycle(t, 6, Boolean(opts.walking));
  // Her ponytail swings behind each hop, and sways a little standing.
  const sway = amount ? Math.sin(phase - 0.8) * 0.9 : Math.sin(t * 1.3) * 0.25;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  groundShadow(ctx, 12);
  drawHairBack(ctx);
  drawLegs(ctx, phase, amount);
  ctx.save();
  ctx.translate(0, -breathe * 0.4);
  drawSkirt(ctx, stride);
  drawTorso(ctx, stride);
  drawPonytail(ctx, sway);
  drawFreeArm(ctx, stride);
  drawTrayArm(ctx, t, amount);
  drawHead(ctx, t);
  ctx.restore();
  ctx.restore();
}

// -- Legs ---------------------------------------------------------------------

function drawLegs(ctx, phase, amount) {
  // A skip: a big knee lift on the swing.
  for (const { dir, hip, knee, ankle, pitch } of legPoses(phase, amount, { hipX: 3, hipY: -19, thigh: 10, shin: 10.4, swing: 0.3, bend: 0.75 })) {
    const fill = dir < 0 ? P.skin : P.skinShade;
    limbSegment(ctx, hip[0], hip[1], knee[0], knee[1], 4.8, 3.8, fill, 0.45);
    limbSegment(ctx, knee[0], knee[1], ankle[0], ankle[1], 3.8, 3, fill, 0.45);
    // Knee shading, and a soft highlight down the shin.
    ctx.fillStyle = 'rgba(220,150,130,0.35)';
    ctx.beginPath();
    ctx.ellipse(knee[0], knee[1], 1.4, 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    ctx.moveTo(knee[0] - 0.6, knee[1] + 1.4);
    ctx.lineTo(ankle[0] - 0.5, ankle[1] - 2.6);
    ctx.stroke();
    ctx.save();
    ctx.translate(ankle[0], ankle[1]);
    ctx.rotate(pitch);
    // A white crew sock with a ribbed top, then the loafer.
    rr(ctx, -1.9, -2.6, 3.8, 3.4, 0.6);
    fillPath(ctx, P.sock, 0.35);
    ctx.strokeStyle = P.sockShade;
    ctx.lineWidth = 0.2;
    for (let sx = -1.4; sx <= 1.4; sx += 0.7) {
      ctx.beginPath();
      ctx.moveTo(sx, -2.4);
      ctx.lineTo(sx, -1.4);
      ctx.stroke();
    }
    drawLoafer(ctx);
    ctx.restore();
  }
}

function drawLoafer(ctx) {
  rr(ctx, -3.3, 4, 7, 1.2, 0.5);
  fillPath(ctx, '#2a1810', 0.35);
  ctx.beginPath();
  ctx.moveTo(-3.1, 4.2);
  ctx.quadraticCurveTo(-3.3, 0.8, -1, 0.8);
  ctx.lineTo(0.9, 0.8);
  ctx.quadraticCurveTo(3.8, 1, 3.5, 4.2);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 0.8, 0, 4.4);
  g.addColorStop(0, P.shoe);
  g.addColorStop(1, P.shoeShade);
  fillPath(ctx, g, 0.4);
  // The penny strap, and a shine on the toe.
  rr(ctx, -1.8, 1.4, 4, 0.9, 0.3);
  fillPath(ctx, P.shoeShade, 0.2);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.moveTo(1.4, 2.8);
  ctx.quadraticCurveTo(2.5, 2.6, 2.8, 3.4);
  ctx.stroke();
}

// -- Clothes ------------------------------------------------------------------

function drawSkirt(ctx, stride) {
  const sway = stride * 1.6;
  ctx.beginPath();
  ctx.moveTo(-7.6, -22);
  ctx.lineTo(7.6, -22);
  ctx.lineTo(10.6 + sway, -9.6);
  ctx.quadraticCurveTo(0, -8, -10.6 + sway, -9.6);
  ctx.closePath();
  const g = ctx.createLinearGradient(-11, 0, 11, 0);
  g.addColorStop(0, P.vestLight);
  g.addColorStop(0.5, P.skirt);
  g.addColorStop(1, P.skirtShade);
  fillPath(ctx, g, 0.55);
  // Knife pleats fanning out, each a shadowed fold with a lit edge.
  for (let i = -3; i <= 3; i++) {
    ctx.strokeStyle = 'rgba(20,50,44,0.45)';
    ctx.lineWidth = 0.32;
    ctx.beginPath();
    ctx.moveTo(i * 2, -21.6);
    ctx.lineTo(i * 3 + sway * (0.5 + Math.abs(i) * 0.1), -9);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath();
    ctx.moveTo(i * 2 + 0.4, -21.6);
    ctx.lineTo(i * 3 + 0.6 + sway * 0.5, -9);
    ctx.stroke();
  }
  ctx.strokeStyle = P.piping;
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.moveTo(-10.1 + sway, -10.9);
  ctx.quadraticCurveTo(0, -9.5, 10.1 + sway, -10.9);
  ctx.stroke();
}

function drawTorso(ctx, stride) {
  // The cream jumper: narrow shoulders, a gentle waist.
  ctx.beginPath();
  ctx.moveTo(-4.4, -43.6);
  ctx.quadraticCurveTo(-9.4, -43.2, -9.2, -38);
  ctx.quadraticCurveTo(-7.6, -30, -7.8, -21);
  ctx.quadraticCurveTo(0, -20, 7.8, -21);
  ctx.quadraticCurveTo(7.6, -30, 9.2, -38);
  ctx.quadraticCurveTo(9.4, -43.2, 4.4, -43.6);
  ctx.closePath();
  fillPath(ctx, P.knit, 0.6);
  // Cable knit down the middle, showing between the vest panels.
  ctx.strokeStyle = P.knitShade;
  ctx.lineWidth = 0.32;
  for (const cx of [-1.2, 1.2]) {
    ctx.beginPath();
    for (let yy = -40.6; yy <= -22.6; yy += 1.3) {
      ctx.moveTo(cx - 0.6, yy);
      ctx.quadraticCurveTo(cx, yy + 0.8, cx + 0.6, yy);
    }
    ctx.stroke();
  }
  // The vest's two front panels, curving in at the waist.
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 3.2, -42.8);
    ctx.quadraticCurveTo(dir * 7.8, -43, dir * 8.4, -38.4);
    ctx.quadraticCurveTo(dir * 7, -30, dir * 7.8, -21.2);
    ctx.lineTo(dir * 2.8, -20.6);
    ctx.lineTo(dir * 2.4, -33.6);
    ctx.closePath();
    const g = ctx.createLinearGradient(dir * 2, 0, dir * 9, 0);
    g.addColorStop(0, P.vestLight);
    g.addColorStop(1, dir < 0 ? P.vest : P.vestShade);
    fillPath(ctx, g, 0.55);
    ctx.strokeStyle = P.piping;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(dir * 3.2, -42.4);
    ctx.lineTo(dir * 2.6, -33.6);
    ctx.lineTo(dir * 3, -21);
    ctx.stroke();
    // A welt pocket low on each panel.
    ctx.strokeStyle = 'rgba(10,40,34,0.55)';
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(dir * 4, -25.6);
    ctx.lineTo(dir * 6.8, -26);
    ctx.stroke();
  }
  // A white shirt collar over the jumper's neck.
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, -43.6);
    ctx.lineTo(dir * 4, -44.6);
    ctx.lineTo(dir * 3.4, -41.2);
    ctx.quadraticCurveTo(dir * 1.2, -41.4, 0, -42.4);
    ctx.closePath();
    fillPath(ctx, P.collar, 0.4);
  }
  // The heart logo and the 봉사 label on her left panel (viewer's right).
  ctx.save();
  ctx.translate(5.4, -36.6);
  ctx.beginPath();
  ctx.moveTo(0, 1.1);
  ctx.bezierCurveTo(-1.9, -0.2, -1.1, -1.8, 0, -0.8);
  ctx.bezierCurveTo(1.1, -1.8, 1.9, -0.2, 0, 1.1);
  ctx.closePath();
  fillPath(ctx, '#ff8fb8', 0.25);
  ctx.restore();
  ctx.fillStyle = P.piping;
  ctx.fillRect(3.9, -34.6, 3, 0.4);
  ctx.fillRect(3.9, -33.8, 2.2, 0.4);
  // Her name badge on the other panel.
  rr(ctx, -7.4, -37.6, 4, 1.8, 0.4);
  fillPath(ctx, '#ffffff', 0.3);
  ctx.fillStyle = P.vest;
  ctx.fillRect(-7.4, -37.6, 4, 0.5);
  ctx.fillStyle = '#5a5a68';
  for (let i = 0; i < 3; i++) ctx.fillRect(-6.9 + i * 1.1, -36.7, 0.7, 0.5);
  // The lanyard and ID card, swinging a little with her step.
  const swing = stride * 0.5;
  ctx.strokeStyle = '#4fa8e0';
  ctx.lineWidth = 0.45;
  ctx.beginPath();
  ctx.moveTo(-3, -42.4);
  ctx.quadraticCurveTo(-1.2 + swing, -35, swing, -31.6);
  ctx.quadraticCurveTo(1.2 + swing, -35, 3, -42.4);
  ctx.stroke();
  rr(ctx, -1.6 + swing, -31.8, 3.2, 4.2, 0.4);
  fillPath(ctx, '#ffffff', 0.3);
  ctx.fillStyle = '#4fa8e0';
  ctx.fillRect(-1.6 + swing, -31.8, 3.2, 0.9);
  rr(ctx, -1.1 + swing, -30.6, 1.2, 1.5, 0.2);
  fillPath(ctx, '#f0d2bc', 0.1);
  ctx.fillStyle = '#a0a0ae';
  ctx.fillRect(0.4 + swing, -30.4, 0.8, 0.3);
  ctx.fillRect(0.4 + swing, -29.8, 0.6, 0.3);
  // The jumper's ribbed hem below the vest.
  rr(ctx, -8, -22.4, 16, 1.6, 0.5);
  fillPath(ctx, P.knitShade, 0.4);
  ctx.strokeStyle = 'rgba(150,130,100,0.55)';
  ctx.lineWidth = 0.2;
  for (let xx = -7.4; xx <= 7.4; xx += 0.8) {
    ctx.beginPath();
    ctx.moveTo(xx, -22.2);
    ctx.lineTo(xx, -21);
    ctx.stroke();
  }
}

// -- Arms ---------------------------------------------------------------------

/** A full knit sleeve, a little loose, ending in a ribbed cuff. */
function knitArm(ctx, shoulder, elbow, wrist) {
  sleeve(ctx, shoulder, elbow, wrist, P.knit, P.knitShade, 4.6);
  const a = Math.atan2(wrist[1] - elbow[1], wrist[0] - elbow[0]);
  ctx.save();
  ctx.translate(wrist[0] - Math.cos(a) * 0.8, wrist[1] - Math.sin(a) * 0.8);
  ctx.rotate(a - Math.PI / 2);
  rr(ctx, -2.2, -1, 4.4, 1.8, 0.6);
  fillPath(ctx, P.knitShade, 0.35);
  ctx.strokeStyle = 'rgba(150,130,100,0.55)';
  ctx.lineWidth = 0.18;
  for (let xx = -1.6; xx <= 1.6; xx += 0.6) {
    ctx.beginPath();
    ctx.moveTo(xx, -0.8);
    ctx.lineTo(xx, 0.6);
    ctx.stroke();
  }
  ctx.restore();
}

/** Her right arm (viewer's left) swings as she skips. */
function drawFreeArm(ctx, stride) {
  const shoulder = [-8.8, -39.6];
  const swing = -stride * 3.6;
  const { elbow, wrist } = swingArm(shoulder, swing, -1);
  knitArm(ctx, shoulder, elbow, wrist);
  drawHand(ctx, wrist[0], wrist[1] + 0.4, swing * 0.04, { skin: P.skin, deep: P.skinDeep });
}

/** Her left arm (viewer's right) holds the coffee tray out in front. */
function drawTrayArm(ctx, t, amount) {
  const shoulder = [8.8, -39.6];
  const elbow = [11.6, -30.4];
  const wrist = [8, -26.8];
  knitArm(ctx, shoulder, elbow, wrist);
  // The tray, held level (it barely jiggles even while she skips).
  const jiggle = Math.sin(t * 12) * 0.3 * amount;
  ctx.save();
  ctx.translate(6.8, -27.6 + jiggle);
  ctx.beginPath();
  ctx.moveTo(-5, 0);
  ctx.lineTo(5, 0);
  ctx.lineTo(4.3, 1.5);
  ctx.lineTo(-4.3, 1.5);
  ctx.closePath();
  fillPath(ctx, P.tray, 0.4);
  ctx.strokeStyle = P.trayShade;
  ctx.lineWidth = 0.25;
  ctx.beginPath();
  ctx.moveTo(-4.5, 0.75);
  ctx.lineTo(4.5, 0.75);
  ctx.stroke();
  for (const cx of [-2.4, 2.4]) drawCup(ctx, cx, t, cx > 0 ? '#3fb58f' : '#e8558f');
  ctx.restore();
  drawHand(ctx, wrist[0] + 0.4, wrist[1] + 0.2, -1.3, { skin: P.skin, deep: P.skinDeep });
}

function drawCup(ctx, cx, t, mark) {
  // The cup, its cardboard sleeve with a dot, the lid, and steam.
  ctx.beginPath();
  ctx.moveTo(cx - 1.8, 0);
  ctx.lineTo(cx - 2.1, -5.2);
  ctx.lineTo(cx + 2.1, -5.2);
  ctx.lineTo(cx + 1.8, 0);
  ctx.closePath();
  fillPath(ctx, P.cup, 0.4);
  rr(ctx, cx - 2.05, -3.8, 4.1, 1.9, 0.2);
  fillPath(ctx, P.cupSleeve, 0.3);
  dot(ctx, cx, -2.85, 0.42, mark, 0);
  rr(ctx, cx - 2.4, -6.2, 4.8, 1.1, 0.4);
  fillPath(ctx, '#ffffff', 0.35);
  ctx.fillStyle = '#5a4a40';
  ctx.fillRect(cx + 0.5, -6, 0.8, 0.3);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 0.4;
  ctx.lineCap = 'round';
  for (const off of [0, 1]) {
    const rise = ((t * 0.7 + off + cx * 0.3) % 2) / 2;
    ctx.globalAlpha = 1 - rise;
    ctx.beginPath();
    ctx.moveTo(cx, -6.6 - rise * 3);
    ctx.bezierCurveTo(cx - 1.1, -8 - rise * 3, cx + 1.1, -8.8 - rise * 3, cx, -10.2 - rise * 3);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.lineCap = 'butt';
}

// -- Head and hair ---------------------------------------------------------

const HEAD_Y = -55;
const EYE_Y = -53.6;

/** Long hair behind her head and shoulders. */
function drawHairBack(ctx) {
  ctx.beginPath();
  ctx.moveTo(-10, HEAD_Y - 6);
  ctx.bezierCurveTo(-12.4, HEAD_Y + 2, -11.6, HEAD_Y + 9, -9.4, HEAD_Y + 12);
  ctx.quadraticCurveTo(0, HEAD_Y + 14, 9.4, HEAD_Y + 12);
  ctx.bezierCurveTo(11.6, HEAD_Y + 9, 12.4, HEAD_Y + 2, 10, HEAD_Y - 6);
  ctx.closePath();
  fillPath(ctx, P.hairDeep, 0.5);
}

function drawHead(ctx, t) {
  rr(ctx, -2, -47.4, 4, 4, 1);
  fillPath(ctx, P.skinShade, 0.4);
  drawEars(ctx, HEAD_Y, P.skin, P.skinDeep, { x: 9.1 });
  // Small pearl studs.
  dot(ctx, -9.2, HEAD_Y + 2.6, 0.45, '#fff6f0', 0.15);
  dot(ctx, 9.2, HEAD_Y + 2.6, 0.45, '#fff6f0', 0.15);
  drawFace(ctx, HEAD_Y, P.skin, P.skinShade, { w: 8.9, chin: 10.4 });
  drawEyes(ctx, EYE_Y, { iris: P.iris, irisLight: P.irisLight, lash: '#2a1810' }, { shape: 'round', lashes: true, blinking: isVolunteerBlinkingAt(t) });
  drawBrows(ctx, EYE_Y, P.hairMid, { thick: 0.45, lift: 0.3, y: -5 });
  drawBlush(ctx, EYE_Y, 0.32);
  drawNose(ctx, EYE_Y, 'rgba(210,140,120,0.5)', -0.8);
  drawMouth(ctx, HEAD_Y, 'smile', P.lips);
  // A touch of colour on her lower lip.
  ctx.fillStyle = 'rgba(232,120,134,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, HEAD_Y + 7.6, 1.1, 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  drawGlasses(ctx);
  drawFrontHair(ctx);
}

function drawGlasses(ctx) {
  // Thin gold wire rounds, sitting just around her eyes.
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(dir * 4.3, EYE_Y, 2.95, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(220,235,255,0.1)';
    ctx.fill();
    ctx.strokeStyle = P.wire;
    ctx.lineWidth = 0.35;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 0.3;
    ctx.beginPath();
    ctx.arc(dir * 4.3, EYE_Y, 2.3, Math.PI * 1.15, Math.PI * 1.4);
    ctx.stroke();
  }
  ctx.strokeStyle = P.wire;
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.moveTo(-1.35, EYE_Y - 0.4);
  ctx.quadraticCurveTo(0, EYE_Y - 1.2, 1.35, EYE_Y - 0.4);
  ctx.moveTo(-7.25, EYE_Y - 0.4);
  ctx.lineTo(-9, EYE_Y - 1);
  ctx.moveTo(7.25, EYE_Y - 0.4);
  ctx.lineTo(9, EYE_Y - 1);
  ctx.stroke();
}

function drawFrontHair(ctx) {
  // The crown, with a soft middle-side part and volume.
  ctx.beginPath();
  ctx.moveTo(-10.2, HEAD_Y + 4);
  ctx.bezierCurveTo(-12.6, HEAD_Y - 19.6, 12.6, HEAD_Y - 19.6, 10.2, HEAD_Y + 4);
  ctx.quadraticCurveTo(9.4, HEAD_Y - 3, 8, HEAD_Y - 6.6);
  ctx.lineTo(-8, HEAD_Y - 6.6);
  ctx.quadraticCurveTo(-9.4, HEAD_Y - 3, -10.2, HEAD_Y + 4);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, HEAD_Y - 18, 0, HEAD_Y);
  g.addColorStop(0, P.hairMid);
  g.addColorStop(1, P.hair);
  fillPath(ctx, g, 0.55);
  ctx.save();
  ctx.clip();
  hairStrands(ctx, HEAD_Y, [
    [-1.2, -15.6, -6, -14, -9.6, -4], [-1.2, -15.6, -4, -11, -7.4, -6.4],
    [-1.2, -15.6, 5, -15, 9.6, -4], [-1.2, -15.6, 3.6, -11.6, 7.4, -6.4], [-1.2, -15.6, 8, -12, 10, 2],
  ], P.hairShine, 0.35);
  // A glossy band of shine across the crown.
  ctx.strokeStyle = 'rgba(240,190,150,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-6.6, HEAD_Y - 12.6);
  ctx.quadraticCurveTo(0, HEAD_Y - 15.2, 6.6, HEAD_Y - 12.6);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = P.hairDeep;
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.moveTo(-1.2, HEAD_Y - 13.4);
  ctx.lineTo(-1.4, HEAD_Y - 10.4);
  ctx.stroke();
  // Soft see-through bangs: a light fringe parted a little off-centre,
  // its edge falling in rounded wisps, with strands drawn through it.
  const wisps = [[6.6, -4.4], [4.4, -5.2], [2.2, -4.2], [0.2, -5], [-1.4, -6.6], [-3, -4.4], [-5.2, -5], [-7.4, -4.6]];
  const wispEdge = () => {
    let prevX = 8.2;
    for (const [wx, wy] of wisps) {
      ctx.quadraticCurveTo((prevX + wx) / 2, HEAD_Y + wy + 1.2, wx, HEAD_Y + wy);
      prevX = wx;
    }
  };
  ctx.beginPath();
  ctx.moveTo(-8.6, HEAD_Y - 10.8);
  ctx.quadraticCurveTo(-1.4, HEAD_Y - 13.2, 8.6, HEAD_Y - 10.8);
  ctx.quadraticCurveTo(9, HEAD_Y - 7.6, 8.2, HEAD_Y - 5.4);
  wispEdge();
  ctx.quadraticCurveTo(-9, HEAD_Y - 7.4, -8.6, HEAD_Y - 10.8);
  ctx.closePath();
  const fringe = ctx.createLinearGradient(0, HEAD_Y - 12, 0, HEAD_Y - 4);
  fringe.addColorStop(0, P.hairMid);
  fringe.addColorStop(1, P.hair);
  // Filled without an outline (it melts into the crown), then only the
  // wispy lower edge is outlined.
  fillPath(ctx, fringe, 0);
  ctx.save();
  ctx.clip();
  hairStrands(ctx, HEAD_Y, [
    [-1.4, -12, -4, -9, -5.2, -5], [-1.4, -12, -2.2, -9, -3, -4.6], [-1.4, -12, -6.4, -10, -7.4, -5],
    [-1.4, -12, 1.4, -9, 2.2, -4.4], [-1.4, -12, 3.6, -9.6, 4.4, -5.2], [-1.4, -12, 5.8, -10.4, 6.6, -4.6],
  ], P.hairDeep, 0.3);
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(8.6, HEAD_Y - 10.8);
  ctx.quadraticCurveTo(9, HEAD_Y - 7.6, 8.2, HEAD_Y - 5.4);
  wispEdge();
  ctx.quadraticCurveTo(-9, HEAD_Y - 7.4, -8.6, HEAD_Y - 10.8);
  outline(ctx, 0.45);
  // Long side locks framing her face, curling at the tips.
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 8.6, HEAD_Y - 8.4);
    ctx.bezierCurveTo(dir * 10.8, HEAD_Y - 2, dir * 10.6, HEAD_Y + 5, dir * 9, HEAD_Y + 9.6);
    ctx.quadraticCurveTo(dir * 8, HEAD_Y + 10.4, dir * 7.6, HEAD_Y + 9);
    ctx.quadraticCurveTo(dir * 8.8, HEAD_Y + 4, dir * 7.8, HEAD_Y - 4.6);
    ctx.closePath();
    fillPath(ctx, P.hair, 0.45);
    hairStrands(ctx, HEAD_Y, [[dir * 9, -6, dir * 10, 0, dir * 8.8, 8]], P.hairShine, 0.3);
  }
}

/** The low side ponytail, gathered under her right ear (viewer's left) and draped over her shoulder; `sway` swings it. */
function drawPonytail(ctx, sway) {
  ctx.save();
  ctx.translate(-8.2, HEAD_Y + 7.4);
  ctx.rotate(sway * 0.08);
  ctx.beginPath();
  ctx.moveTo(-1.8, 0);
  ctx.bezierCurveTo(-5.4, 4, -3.2, 9, -5 + sway, 14);
  ctx.bezierCurveTo(-6.6 + sway, 18, -3.6 + sway, 22, -4.4 + sway * 1.4, 25.4);
  ctx.quadraticCurveTo(-1.6 + sway, 23.6, -1 + sway, 20);
  ctx.bezierCurveTo(-0.4, 16, 1.8, 12, 0.6, 7);
  ctx.quadraticCurveTo(0.2, 3, 1.8, 0);
  ctx.closePath();
  const g = ctx.createLinearGradient(-5, 0, 0, 26);
  g.addColorStop(0, P.hairMid);
  g.addColorStop(1, P.hair);
  fillPath(ctx, g, 0.55);
  ctx.save();
  ctx.clip();
  hairStrands(ctx, 0, [[-1, 1, -4, 8, -3.4, 14], [0.4, 1, -1.6, 10, -2.6 + sway, 20], [-0.4, 4, -4.6, 14, -3.6 + sway, 24]], P.hairShine, 0.35);
  ctx.restore();
  // The yellow ribbon tying it, with two short tails.
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(dir * 1.5, 0.6, 1.6, 0.9, dir * 0.35, 0, Math.PI * 2);
    fillPath(ctx, P.piping, 0.3);
  }
  dot(ctx, 0, 0.8, 0.7, '#f2bc4a', 0.25);
  for (const [dx, r] of [[-0.6, 0.25], [0.6, -0.15]]) {
    ctx.save();
    ctx.translate(dx, 1.2);
    ctx.rotate(r);
    ctx.beginPath();
    ctx.moveTo(-0.4, 0);
    ctx.lineTo(0.4, 0);
    ctx.lineTo(0.6, 3);
    ctx.lineTo(0, 2.5);
    ctx.lineTo(-0.6, 3);
    ctx.closePath();
    fillPath(ctx, P.piping, 0.2);
    ctx.restore();
  }
  ctx.restore();
}
