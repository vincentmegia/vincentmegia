// Kang Min-jun (강민준), Library Shift's student library assistant — a very
// detailed character with his own renderer (the user: "make a new VERY
// VERY detailed character but this time a boy"), drawn in Hospital
// Shift's anime style like Kimono Himura (hospital/kimono-himura.js).
// Detail comes from layered cel shading, line art and texture rather than
// shine: Hospital Shift's characters had their eye highlights and hair
// shine removed at the user's request, so he has none either.
//
// * Face: a softly rounded V-jaw and chin with a shadow under it, ears with an inner
//   fold, sharp, cool eyes — narrow, gently tilted up at the outer corners, a
//   heavy lash line with a pointed flick, a deep iris under the lid, an
//   angled crease — that blink; relaxed, softly arched brows; a shaded
//   nose with a nostril hint, a small smile.
// * Hair: a layered two-block cut — dark brown-black in two tones, a
//   side-swept fringe of overlapping clumps, strand lines, a short
//   undercut at the sides, and an ahoge (cowlick) that bobs.
// * Outfit: a white shirt (collar points, sleeves rolled to the elbow with
//   folded cuffs), a navy cable-knit sweater vest with ribbed V-neck and
//   hem, a burgundy tie with diagonal stripes, a mint lanyard with an ID
//   card (photo, name, barcode) that swings, over-ear headphones around
//   his neck, a gold wristwatch, charcoal slacks with crease lines and a
//   belt, and white sneakers with navy accents and laces.
// * Props: three books under his arm, their spines in Korean with
//   library call-number stickers; a pencil behind his ear; a keychain
//   (key + book charm) swinging from a belt loop.
// * Motion: blinking, breathing, a walking stride with opposite arm swing,
//   and the cowlick and ID card swaying.
//
// Pure canvas drawing (no DOM): `drawMinjun(ctx, x, y, opts)` with (x, y)
// at his feet, like every other character. Coordinates are Hospital
// Shift's anime adult frame (shoulders y ≈ -40, feet 0).

const LINE = 'rgba(24,18,44,0.68)';

export const MINJUN_PALETTE = {
  skin: '#f8dcc4',
  skinShade: '#ecbf9f',
  skinDeep: '#d9a283',
  hair: '#2a2028',
  hairMid: '#3c2e36',
  hairShade: '#170f16',
  hairStrand: 'rgba(90,70,80,0.55)',
  // Deep violet eyes (the user's pick).
  irisDark: '#150a22',
  // Brightened a step so the violet shows at game size.
  iris: '#5a2c96',
  irisLight: '#a476e0',
  irisTexture: 'rgba(176,130,230,0.45)',
  irisCrescent: 'rgba(196,150,246,0.6)',
  pupil: '#0b0614',
  shirt: '#fbfbf8',
  shirtShade: '#dfe2ea',
  vest: '#2d3a64',
  vestShade: '#1f2a4c',
  vestRib: '#3a4a7c',
  tie: '#8a2a3a',
  tieStripe: '#d8b04a',
  lanyard: '#3fb58f',
  card: '#ffffff',
  cardBand: '#4fa8e0',
  slacks: '#3a3a46',
  slacksShade: '#2a2a34',
  belt: '#4a3226',
  buckle: '#d8c27a',
  shoe: '#fafafa',
  shoeShade: '#d6d8e0',
  shoeAccent: '#2d3a64',
  sole: '#b8bcc8',
  phones: '#26262e',
  phonesCushion: '#8fe3c8',
  watchBand: '#5a3a2a',
  watchFace: '#f2d27a',
  books: ['#e8558f', '#4fa8e0', '#3fb58f'],
  lips: '#c86a6a',
};

const P = MINJUN_PALETTE;

/** The Korean titles on the spines of the books he carries. */
export const MINJUN_BOOKS = ['별의 노래', '바다 일기', '작은 숲'];

/** Whether his eyes are shut in a blink at time `t` (a quick blink every 4.1 s, with a double blink now and then). */
export function isBlinkingAt(t) {
  const phase = ((t % 4.1) + 4.1) % 4.1;
  if (phase < 0.12) return true;
  // Every third cycle, a second quick blink.
  return Math.floor(t / 4.1) % 3 === 0 && phase > 0.22 && phase < 0.32;
}

function outline(ctx, width = 0.55) {
  ctx.strokeStyle = LINE;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function fillPath(ctx, fill, line = 0.55) {
  ctx.fillStyle = fill;
  ctx.fill();
  if (line > 0) outline(ctx, line);
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - feet center
 * @param {number} y - feet line
 * @param {{scale?: number, t?: number, walking?: boolean, action?: MinjunAction|null, actionT?: number}} [opts]
 *   `action` is what he's doing while stopped (see MINJUN_ACTIONS), and
 *   `actionT` how many seconds he's been at it.
 */
export function drawMinjun(ctx, x, y, opts = {}) {
  const k = opts.scale ?? 1;
  const t = opts.t ?? 0;
  const action = opts.walking ? null : opts.action ?? null;
  const at = opts.actionT ?? 0;
  const stride = opts.walking ? Math.sin(t * 8) : 0;
  const bob = opts.walking ? Math.abs(Math.sin(t * 8)) * 1.1 : 0;
  const breathe = opts.walking ? 0 : Math.sin(t * 1.7) * 0.35;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);

  ctx.fillStyle = 'rgba(40,30,40,0.16)';
  ctx.beginPath();
  ctx.ellipse(0, 8, 13, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(0, -bob);
  drawLegs(ctx, stride);
  drawTote(ctx, stride, t);
  // Reading, the free arm comes across in front of the vest, so it's drawn
  // after the torso; waving or hanging, it's behind.
  const armUp = action === 'wave' || action === 'help';
  if (action !== 'read') drawFreeArm(ctx, stride, t, armUp ? at : null);
  drawTorso(ctx, breathe, t);
  if (action === 'read') drawReadingArm(ctx);
  drawToteStrap(ctx, stride);
  drawKeychain(ctx, t, stride);
  drawWalletChain(ctx, t, stride);
  drawArmShadows(ctx);
  drawBookArm(ctx, stride);
  if (action === 'read') drawOpenBook(ctx, at);
  drawNeckAndPhones(ctx, t);
  ctx.save();
  if (action === 'hum') {
    // Bopping his head to the tune, pivoting at the neck.
    ctx.translate(0, -46);
    ctx.rotate(Math.sin(at * 5) * 0.07);
    ctx.translate(0, 46 - Math.abs(Math.sin(at * 5)) * 0.5);
  } else if (action === 'read') {
    ctx.translate(0, 0.8); // head dipped toward the page
  }
  drawHead(ctx, t, stride, faceForAction(action, at));
  ctx.restore();
  if (action === 'hum') drawMusicNotes(ctx, at);
  if (action === 'wave') drawSpeechBubble(ctx, '안녕!', at);
  if (action === 'help') drawSpeechBubble(ctx, '제가 할게요!', at); // "I'll do it!"
  ctx.restore();
}

/** @typedef {'read' | 'hum' | 'wave' | 'help'} MinjunAction */

/**
 * His face while he's doing something: talking (reading aloud, saying
 * hello, offering to help) opens and closes his mouth; singing holds it in
 * a rounder open "o" with his eyes closed. `mouth` is how open (0..1), or
 * null for his usual closed smile.
 *
 * @returns {{mouth: number|null, round?: boolean, eyesClosed?: boolean}}
 */
function faceForAction(action, at) {
  if (action === 'hum') return { mouth: 0.6 + 0.4 * Math.abs(Math.sin(at * 3.2)), round: true, eyesClosed: true };
  if (action === 'read' || action === 'wave' || action === 'help') {
    return { mouth: 0.25 + 0.75 * Math.abs(Math.sin(at * 9)) };
  }
  return { mouth: null };
}

/** What Min-jun can stop to do: read a book, hum a tune, wave hello to Eun-mi, or take her book to shelve it. */
export const MINJUN_ACTIONS = /** @type {const} */ (['read', 'hum', 'wave', 'help']);

// -- Actions -------------------------------------------------------------------

/** His free arm bent up across his chest, holding an open book. */
function drawReadingArm(ctx) {
  drawArm(ctx, [-10.6, -38], [-13.4, -27.5], [-7.4, -26.8], { watch: true });
}

/** The open book in his free hand, a page turning every couple of seconds. */
function drawOpenBook(ctx, at) {
  const cx = -1.2;
  const cy = -27.6;
  const w = 6; // half width
  const h = 7.4;
  // Cover peeking out round the pages.
  rr(ctx, cx - w - 0.5, cy - h / 2 - 0.4, (w + 0.5) * 2, h + 0.9, 0.5);
  fillPath(ctx, '#4fa8e0', 0.4);
  // Two pages, bowing up from the spine.
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - h / 2 + 0.6);
    ctx.quadraticCurveTo(cx + dir * w * 0.5, cy - h / 2 - 0.3, cx + dir * w, cy - h / 2);
    ctx.lineTo(cx + dir * w, cy + h / 2);
    ctx.quadraticCurveTo(cx + dir * w * 0.5, cy + h / 2 - 0.3, cx, cy + h / 2 + 0.4);
    ctx.closePath();
    const g = ctx.createLinearGradient(cx, 0, cx + dir * w, 0);
    g.addColorStop(0, '#e6dcc4');
    g.addColorStop(0.25, '#fbf6ea');
    g.addColorStop(1, '#fbf6ea');
    fillPath(ctx, g, 0.3);
    // Lines of text.
    ctx.fillStyle = 'rgba(60,60,80,0.4)';
    for (let i = 0; i < 6; i++) {
      const ly = cy - h / 2 + 1.1 + i * 0.85;
      const len = i === 5 ? 0.5 : 0.85;
      const x0 = dir < 0 ? cx - w + 0.7 : cx + 0.8;
      ctx.fillRect(x0, ly, (w - 1.5) * len, 0.22);
    }
  }
  // A page turning over: its free edge sweeps from right to left.
  const phase = at % 2.4;
  if (phase < 0.6) {
    const ex = cx + Math.cos((phase / 0.6) * Math.PI) * w;
    const lift = Math.sin((phase / 0.6) * Math.PI) * 1.4;
    ctx.beginPath();
    ctx.moveTo(cx, cy - h / 2 + 0.6);
    ctx.quadraticCurveTo((cx + ex) / 2, cy - h / 2 - 0.3 - lift, ex, cy - h / 2 - lift * 0.5);
    ctx.lineTo(ex, cy + h / 2 - lift * 0.5);
    ctx.quadraticCurveTo((cx + ex) / 2, cy + h / 2 - 0.3 - lift, cx, cy + h / 2 + 0.4);
    ctx.closePath();
    fillPath(ctx, '#f3ecda', 0.25);
  }
  // His thumb and fingers over the book's left edge.
  drawHand(ctx, cx - w - 0.3, cy + 0.6, -1.6, 0.6);
}

/** Little violet notes drifting up and fading as he hums. */
function drawMusicNotes(ctx, at) {
  for (let i = 0; i < 3; i++) {
    const u = ((at + i * 0.7) % 2.1) / 2.1;
    const x = 13 + i * 1.6 + Math.sin(u * 6 + i) * 1.2;
    const y = -62 - u * 14;
    ctx.globalAlpha = Math.min(1, (1 - u) * 2.5) * Math.min(1, u * 6);
    ctx.fillStyle = i % 2 ? '#e8558f' : '#7c4cb4';
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.ellipse(x, y, 0.95, 0.7, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 0.85, y - 0.2);
    ctx.lineTo(x + 0.85, y - 3.6);
    ctx.quadraticCurveTo(x + 2.2, y - 2.8, x + 2, y - 1.6);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** A small speech bubble above his head that pops in. */
function drawSpeechBubble(ctx, text, at) {
  const pop = Math.min(1, at * 5);
  ctx.save();
  ctx.translate(10, -84);
  ctx.scale(pop, pop);
  ctx.font = 'bold 3.6px sans-serif';
  const w = ctx.measureText(text).width + 3.2;
  rr(ctx, -w / 2, -3.4, w, 6, 2.4);
  fillPath(ctx, '#ffffff', 0.4);
  ctx.beginPath();
  ctx.moveTo(-2.2, 2.4);
  ctx.lineTo(-4.2, 5.2);
  ctx.lineTo(-0.4, 2.5);
  fillPath(ctx, '#ffffff', 0);
  ctx.fillStyle = '#5a2c96';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, -0.3);
  ctx.restore();
}

// -- Legs and shoes ------------------------------------------------------------

function drawLegs(ctx, stride) {
  for (const dir of [-1, 1]) {
    const swing = (dir < 0 ? stride : -stride) * 1.6;
    const lift = Math.max(0, dir < 0 ? stride : -stride) * 0.9;
    const lx = dir * 3.7 + swing * 0.5;
    // Slack leg: a slight taper, shaded on the outer side, a crease down the front.
    ctx.beginPath();
    ctx.moveTo(dir * 0.4, -19);
    ctx.lineTo(dir * 7.8, -19);
    ctx.lineTo(lx + dir * 3.3, 2.4 - lift);
    ctx.lineTo(lx - dir * 3.1, 2.4 - lift);
    ctx.closePath();
    const g = ctx.createLinearGradient(dir * 0.4, 0, dir * 7.8, 0);
    g.addColorStop(0, P.slacks);
    g.addColorStop(1, P.slacksShade);
    fillPath(ctx, g, 0.5);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(dir * 4, -17);
    ctx.lineTo(lx, 1.6 - lift);
    ctx.stroke();
    // A knee fold.
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.moveTo(lx - dir * 1.6 + swing * -0.1, -7.5);
    ctx.quadraticCurveTo(lx + swing * -0.1, -6.6, lx + dir * 1.8, -7.6);
    ctx.stroke();
    // Outer side seam, a slanted front pocket, and the hem's break folds.
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 0.3;
    ctx.beginPath();
    ctx.moveTo(dir * 7.6, -18.6);
    ctx.lineTo(lx + dir * 3.1, 2 - lift);
    ctx.moveTo(dir * 3.4, -18.6);
    ctx.quadraticCurveTo(dir * 5.6, -16, dir * 7.4, -13.6);
    ctx.stroke();
    if (dir > 0) {
      // His phone's outline pressing through the front pocket.
      ctx.strokeStyle = 'rgba(0,0,0,0.32)';
      ctx.lineWidth = 0.28;
      ctx.beginPath();
      ctx.roundRect(4.6, -14.2, 2.6, 4.4, 0.5);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.moveTo(lx - dir * 2.6, -0.4 - lift);
    ctx.quadraticCurveTo(lx, 0.6 - lift, lx + dir * 2.8, -0.6 - lift);
    ctx.moveTo(lx - dir * 2.2, 1.2 - lift);
    ctx.quadraticCurveTo(lx + dir * 0.4, 1.9 - lift, lx + dir * 2.6, 1 - lift);
    ctx.stroke();
    // A turned-up cuff: a band at the hem with its fold line.
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.moveTo(lx - dir * 3.05, 0.4 - lift);
    ctx.lineTo(lx + dir * 3.25, 0.4 - lift);
    ctx.lineTo(lx + dir * 3.3, 2.4 - lift);
    ctx.lineTo(lx - dir * 3.1, 2.4 - lift);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 0.3;
    ctx.beginPath();
    ctx.moveTo(lx - dir * 3.05, 0.4 - lift);
    ctx.lineTo(lx + dir * 3.25, 0.4 - lift);
    ctx.stroke();
    // Dashed hem stitching just above the cuff.
    ctx.save();
    ctx.setLineDash([0.45, 0.4]);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 0.2;
    ctx.beginPath();
    ctx.moveTo(lx - dir * 2.9, 2 - lift);
    ctx.lineTo(lx + dir * 3.1, 2 - lift);
    ctx.stroke();
    ctx.restore();
    drawSneaker(ctx, lx, lift);
  }
}

function drawSneaker(ctx, sx, lift) {
  const y0 = 2.2 - lift;
  // A navy sock peeking between the hem and the shoe, with a ribbed cuff.
  rr(ctx, sx - 2.4, y0 - 1.4, 4.8, 2, 0.6);
  fillPath(ctx, P.vest, 0.3);
  ctx.strokeStyle = 'rgba(120,140,200,0.5)';
  ctx.lineWidth = 0.15;
  for (let k = -1.8; k <= 1.8; k += 0.6) {
    ctx.beginPath();
    ctx.moveTo(sx + k, y0 - 1.3);
    ctx.lineTo(sx + k, y0 + 0.4);
    ctx.stroke();
  }
  // Sole.
  rr(ctx, sx - 4, y0 + 4.3, 8.4, 1.8, 0.9);
  fillPath(ctx, P.sole, 0.4);
  // Upper with a rounded toe.
  ctx.beginPath();
  ctx.moveTo(sx - 3.8, y0 + 4.6);
  ctx.quadraticCurveTo(sx - 4, y0, sx - 1, y0 - 0.2);
  ctx.lineTo(sx + 1.6, y0 + 0.2);
  ctx.quadraticCurveTo(sx + 4.6, y0 + 1.4, sx + 4.2, y0 + 4.6);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, y0, 0, y0 + 4.6);
  g.addColorStop(0, P.shoe);
  g.addColorStop(1, P.shoeShade);
  fillPath(ctx, g, 0.45);
  // The tongue poking up from under the laces, and a tiny mint logo star.
  rr(ctx, sx - 1.6, y0 - 0.9, 2.6, 1.5, 0.6);
  fillPath(ctx, P.shoe, 0.3);
  ctx.fillStyle = P.phonesCushion;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 ? 0.28 : 0.65;
    const px = sx - 2.3 + Math.cos(a) * r;
    const py = y0 + 2.5 + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  // Navy swoosh accent, toe cap line, laces.
  ctx.strokeStyle = P.shoeAccent;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(sx - 3.2, y0 + 3.6);
  ctx.quadraticCurveTo(sx, y0 + 2.4, sx + 3.6, y0 + 3.2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(40,40,60,0.35)';
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.arc(sx + 2.6, y0 + 4, 1.6, Math.PI * 1.1, Math.PI * 1.8);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(40,40,60,0.6)';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(sx - 1.6 + i * 0.9, y0 + 0.6 + i * 0.25);
    ctx.lineTo(sx + 0.2 + i * 0.9, y0 + 1.4 + i * 0.25);
    ctx.stroke();
  }
  // Eyelets either side of the laces.
  ctx.fillStyle = 'rgba(45,58,100,0.75)';
  for (let i = 0; i < 3; i++) {
    for (const ox of [-1.9, 0.5]) {
      ctx.beginPath();
      ctx.arc(sx + ox + i * 0.9, y0 + 0.9 + i * 0.25, 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Heel tab, in navy, at the back of the shoe.
  rr(ctx, sx - 4.1, y0 + 1.6, 1, 2.6, 0.4);
  fillPath(ctx, P.shoeAccent, 0.25);
  // A small tied lace bow.
  ctx.strokeStyle = 'rgba(40,40,60,0.7)';
  ctx.lineWidth = 0.22;
  for (const d of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(sx + 0.9 + d * 0.7, y0 + 0.2, 0.6, 0.35, d * 0.4, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(sx + 0.9, y0 + 0.3);
  ctx.lineTo(sx + 0.4, y0 + 1.3);
  ctx.moveTo(sx + 0.9, y0 + 0.3);
  ctx.lineTo(sx + 1.5, y0 + 1.2);
  ctx.stroke();
  // Silver aglets on the lace ends.
  ctx.fillStyle = '#c0c4cc';
  for (const [ax, ay] of [[0.4, 1.3], [1.5, 1.2]]) {
    ctx.beginPath();
    ctx.ellipse(sx + ax, y0 + ay + 0.15, 0.14, 0.26, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Rubber toe-cap dimples and the heel counter's seam.
  ctx.fillStyle = 'rgba(150,156,172,0.7)';
  for (const [dx, dy] of [[2.9, 3.5], [3.5, 3.9], [2.5, 4.1], [3.2, 4.3]]) {
    ctx.beginPath();
    ctx.arc(sx + dx, y0 + dy, 0.12, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(120,126,146,0.6)';
  ctx.lineWidth = 0.18;
  ctx.beginPath();
  ctx.moveTo(sx - 2.6, y0 + 1);
  ctx.quadraticCurveTo(sx - 2.2, y0 + 2.6, sx - 2.9, y0 + 4.2);
  ctx.stroke();
  // Dashed stitching around the sole.
  ctx.save();
  ctx.setLineDash([0.5, 0.45]);
  ctx.strokeStyle = 'rgba(80,86,104,0.7)';
  ctx.lineWidth = 0.22;
  ctx.beginPath();
  ctx.moveTo(sx - 3.6, y0 + 5.2);
  ctx.lineTo(sx + 4, y0 + 5.2);
  ctx.stroke();
  ctx.restore();
}

// -- Tote bag -------------------------------------------------------------------

// A canvas library tote hanging from his right shoulder (viewer's left),
// behind the free arm, swinging a little as he walks.
const TOTE = { l: -21, r: -11.6, top: -21.5, bottom: -6.5 };

function drawTote(ctx, stride, t) {
  const sw = stride * 0.6;
  const { l, r, top, bottom } = TOTE;
  ctx.save();
  ctx.translate(sw, 0);
  // The back strap, behind the arm and body, showing only as a sliver.
  ctx.beginPath();
  ctx.moveTo(l + 1.1, top + 0.6);
  ctx.quadraticCurveTo(-18, -28, -14, -34);
  ctx.lineTo(-13.3, -34);
  ctx.quadraticCurveTo(-17.2, -28, l + 2.1, top + 0.6);
  ctx.closePath();
  fillPath(ctx, '#d9cfb8', 0.3);
  // Things poking out of the top: a rolled poster with a rubber band and
  // the corner of a book.
  ctx.save();
  ctx.translate(l + 2.4, top + 0.5);
  ctx.rotate(-0.25);
  rr(ctx, -0.9, -6.2, 1.8, 7, 0.9);
  fillPath(ctx, '#bfe0f2', 0.3);
  ctx.strokeStyle = 'rgba(60,110,150,0.45)';
  ctx.lineWidth = 0.2;
  ctx.beginPath();
  ctx.ellipse(0, -6.2, 0.9, 0.35, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#e8558f';
  ctx.fillRect(-0.9, -3.6, 1.8, 0.35);
  ctx.restore();
  rr(ctx, l + 4.2, top - 2.6, 3.4, 4, 0.4);
  fillPath(ctx, '#f2a541', 0.3);
  ctx.fillStyle = '#fbf3e0';
  ctx.fillRect(l + 4.4, top - 2.4, 0.5, 3.6);
  // The bag itself: slightly wider at the bottom, sagging under its load.
  ctx.beginPath();
  ctx.moveTo(l + 0.6, top);
  ctx.lineTo(r - 0.6, top);
  ctx.lineTo(r, bottom - 0.6);
  ctx.quadraticCurveTo((l + r) / 2, bottom + 0.6, l, bottom - 0.6);
  ctx.closePath();
  const g = ctx.createLinearGradient(l, 0, r, 0);
  g.addColorStop(0, '#d9cfb8');
  g.addColorStop(0.35, '#efe6d2');
  g.addColorStop(1, '#e4d9c1');
  fillPath(ctx, g, 0.5);
  // Canvas weave: faint crossing lines, clipped to the bag.
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(150,130,100,0.16)';
  ctx.lineWidth = 0.12;
  for (let y = top + 0.8; y < bottom; y += 0.7) {
    ctx.beginPath();
    ctx.moveTo(l, y);
    ctx.lineTo(r, y);
    ctx.stroke();
  }
  for (let x = l + 0.5; x < r; x += 0.7) {
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
  }
  // A soft fold down the middle where the load pulls it.
  ctx.fillStyle = 'rgba(120,100,70,0.12)';
  ctx.beginPath();
  ctx.ellipse((l + r) / 2 - 1, top + 7, 0.6, 5.5, 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // The hemmed top band with dashed stitching.
  ctx.fillStyle = 'rgba(150,130,100,0.25)';
  ctx.fillRect(l + 0.6, top, r - l - 1.2, 1.1);
  ctx.strokeStyle = 'rgba(110,90,60,0.55)';
  ctx.lineWidth = 0.15;
  ctx.setLineDash([0.4, 0.3]);
  ctx.beginPath();
  ctx.moveTo(l + 0.8, top + 1.4);
  ctx.lineTo(r - 0.8, top + 1.4);
  ctx.stroke();
  ctx.setLineDash([]);
  // The printed library logo: a navy open book over "도서관".
  const cx = (l + r) / 2 - 1.4;
  const cy = top + 5.6;
  ctx.fillStyle = P.vest;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + 0.4);
    ctx.quadraticCurveTo(cx + dir * 1, cy - 0.5, cx + dir * 2, cy - 0.2);
    ctx.lineTo(cx + dir * 2, cy + 1.6);
    ctx.quadraticCurveTo(cx + dir * 1, cy + 1.3, cx, cy + 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = '#efe6d2';
  ctx.lineWidth = 0.14;
  for (const dir of [-1, 1]) {
    for (const k of [0.4, 0.85]) {
      ctx.beginPath();
      ctx.moveTo(cx + dir * 0.4, cy + k + 0.1);
      ctx.lineTo(cx + dir * 1.6, cy + k - 0.1);
      ctx.stroke();
    }
  }
  ctx.fillStyle = P.vest;
  ctx.font = 'bold 1.5px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('도서관', cx, cy + 3.3);
  ctx.fillRect(cx - 1.9, cy + 4.3, 3.8, 0.18);
  // A mint patch pocket low on the front, with a pen clipped in.
  rr(ctx, l + 1.2, bottom - 4.6, 4.2, 3.2, 0.4);
  fillPath(ctx, '#8fe3c8', 0.3);
  ctx.strokeStyle = 'rgba(30,110,85,0.5)';
  ctx.lineWidth = 0.13;
  ctx.setLineDash([0.35, 0.25]);
  ctx.beginPath();
  ctx.moveTo(l + 1.5, bottom - 4.1);
  ctx.lineTo(r - 4.5, bottom - 4.1);
  ctx.stroke();
  ctx.setLineDash([]);
  rr(ctx, l + 2, bottom - 5.1, 0.6, 1.9, 0.25);
  fillPath(ctx, '#e8558f', 0.2);
  // An enamel cat pin near the top corner.
  {
    const px = l + 2;
    const py = top + 3;
    ctx.beginPath();
    ctx.moveTo(px - 0.75, py - 0.2);
    ctx.lineTo(px - 0.6, py - 1);
    ctx.lineTo(px - 0.2, py - 0.55);
    ctx.lineTo(px + 0.2, py - 0.55);
    ctx.lineTo(px + 0.6, py - 1);
    ctx.lineTo(px + 0.75, py - 0.2);
    ctx.arc(px, py - 0.1, 0.78, 0, Math.PI);
    ctx.closePath();
    fillPath(ctx, '#2a2028', 0.15);
    ctx.fillStyle = '#ffd166';
    for (const dx of [-0.3, 0.3]) {
      ctx.beginPath();
      ctx.arc(px + dx, py - 0.15, 0.14, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // A yellow sticky note slapped on the front: "반납" (returns).
  ctx.save();
  ctx.translate(r - 2.8, bottom - 4.4);
  ctx.rotate(0.12);
  rr(ctx, -1.5, -1.4, 3, 2.8, 0.15);
  fillPath(ctx, '#ffe58a', 0.18);
  ctx.fillStyle = 'rgba(200,160,40,0.35)';
  ctx.fillRect(-1.5, -1.4, 3, 0.6);
  ctx.fillStyle = '#c0392b';
  ctx.font = 'bold 1.15px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('반납', 0, 0.25);
  ctx.strokeStyle = 'rgba(192,57,43,0.7)';
  ctx.lineWidth = 0.12;
  ctx.beginPath();
  ctx.moveTo(-0.9, 0.95);
  ctx.lineTo(0.9, 0.95);
  ctx.stroke();
  ctx.restore();
  // A little mint plush bear dangling on a chain from the top corner.
  {
    const swing = Math.sin(t * 2.4) * 0.18 + stride * 0.3;
    ctx.save();
    ctx.translate(l + 0.4, top + 0.6);
    ctx.rotate(swing);
    ctx.strokeStyle = '#c0c4cc';
    ctx.lineWidth = 0.25;
    ctx.beginPath();
    ctx.arc(0, 0, 0.5, 0, Math.PI * 2);
    ctx.moveTo(0, 0.5);
    ctx.lineTo(0, 2);
    ctx.stroke();
    const by = 3.3;
    // Ears, head, body, arms.
    for (const dx of [-0.9, 0.9]) {
      ctx.beginPath();
      ctx.arc(dx, by - 1, 0.5, 0, Math.PI * 2);
      fillPath(ctx, '#8fe3c8', 0.15);
      ctx.fillStyle = '#ffc2d4';
      ctx.beginPath();
      ctx.arc(dx, by - 1, 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(0, by + 2, 1.1, 1.2, 0, 0, Math.PI * 2);
    fillPath(ctx, '#8fe3c8', 0.2);
    ctx.beginPath();
    ctx.arc(0, by, 1.3, 0, Math.PI * 2);
    fillPath(ctx, '#8fe3c8', 0.2);
    ctx.beginPath();
    ctx.ellipse(0, by + 0.45, 0.6, 0.45, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#f6efe0';
    ctx.fill();
    ctx.fillStyle = '#1c1420';
    for (const dx of [-0.5, 0.5]) {
      ctx.beginPath();
      ctx.arc(dx, by - 0.2, 0.17, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(0, by + 0.3, 0.2, 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    // A pink bow tie and a stitched seam down the tummy.
    ctx.fillStyle = '#e8558f';
    ctx.beginPath();
    ctx.moveTo(0, by + 1.05);
    ctx.lineTo(-0.55, by + 0.75);
    ctx.lineTo(-0.55, by + 1.35);
    ctx.closePath();
    ctx.moveTo(0, by + 1.05);
    ctx.lineTo(0.55, by + 0.75);
    ctx.lineTo(0.55, by + 1.35);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,110,85,0.5)';
    ctx.lineWidth = 0.1;
    ctx.setLineDash([0.2, 0.15]);
    ctx.beginPath();
    ctx.moveTo(0, by + 1.5);
    ctx.lineTo(0, by + 2.9);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
  // Where the strap is sewn on: a stitched box with an X.
  for (const sx of [l + 1.6, r - 2]) {
    ctx.strokeStyle = 'rgba(110,90,60,0.6)';
    ctx.lineWidth = 0.12;
    ctx.strokeRect(sx - 0.55, top + 0.15, 1.1, 1.1);
    ctx.beginPath();
    ctx.moveTo(sx - 0.55, top + 0.15);
    ctx.lineTo(sx + 0.55, top + 1.25);
    ctx.moveTo(sx + 0.55, top + 0.15);
    ctx.lineTo(sx - 0.55, top + 1.25);
    ctx.stroke();
  }
  ctx.restore();
}

/** The tote's front strap, up over his shoulder (drawn over the shirt). */
function drawToteStrap(ctx, stride) {
  const sw = stride * 0.6;
  const { l, r, top } = TOTE;
  for (const [x0, w] of [[r - 2 + sw, 1.1]]) {
    ctx.beginPath();
    ctx.moveTo(x0 - w / 2, top + 0.6);
    ctx.quadraticCurveTo(-12.6, -31, -8.8, -41.6);
    ctx.lineTo(-7.4, -41.6);
    ctx.quadraticCurveTo(-11.2, -31, x0 + w / 2, top + 0.6);
    ctx.closePath();
    fillPath(ctx, '#e4d9c1', 0.35);
    ctx.strokeStyle = 'rgba(110,90,60,0.45)';
    ctx.lineWidth = 0.12;
    ctx.setLineDash([0.35, 0.25]);
    ctx.beginPath();
    ctx.moveTo(x0, top + 0.4);
    ctx.quadraticCurveTo(-11.9, -31, -8.1, -41.2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

// -- Torso ----------------------------------------------------------------------

function torsoPath(ctx) {
  ctx.beginPath();
  ctx.moveTo(-5, -42);
  ctx.quadraticCurveTo(-11.5, -41.5, -11.6, -36);
  ctx.lineTo(-10.6, -17);
  ctx.quadraticCurveTo(0, -15.6, 10.6, -17);
  ctx.lineTo(11.6, -36);
  ctx.quadraticCurveTo(11.5, -41.5, 5, -42);
  ctx.closePath();
}

function drawTorso(ctx, breathe, t) {
  ctx.save();
  ctx.translate(0, -breathe * 0.4);
  // Shirt underneath (shows at the shoulders, the V and below the vest).
  torsoPath(ctx);
  fillPath(ctx, P.shirt, 0.55);
  // Belt and buckle peeking under the vest's hem.
  rr(ctx, -10, -18.6, 20, 2.2, 0.6);
  fillPath(ctx, P.belt, 0.35);
  // Dashed stitching along both edges of the leather.
  ctx.save();
  ctx.setLineDash([0.4, 0.35]);
  ctx.strokeStyle = 'rgba(232,200,160,0.55)';
  ctx.lineWidth = 0.12;
  ctx.beginPath();
  ctx.moveTo(-9.6, -18.2);
  ctx.lineTo(9.6, -18.2);
  ctx.moveTo(-9.6, -16.8);
  ctx.lineTo(9.6, -16.8);
  ctx.stroke();
  ctx.restore();
  // Belt loops, a row of holes, and the buckle with its prong.
  for (const lx of [-7.6, -4, 4.6, 8]) {
    rr(ctx, lx - 0.4, -18.9, 0.8, 2.8, 0.2);
    fillPath(ctx, P.slacks, 0.2);
  }
  ctx.fillStyle = 'rgba(20,10,6,0.7)';
  for (const hx of [2.6, 3.4, 4.2]) {
    ctx.beginPath();
    ctx.arc(hx - 0.4, -17.5, 0.18, 0, Math.PI * 2);
    ctx.fill();
  }
  rr(ctx, -1.6, -18.9, 3.2, 2.8, 0.6);
  fillPath(ctx, P.buckle, 0.35);
  rr(ctx, -1, -18.3, 2, 1.6, 0.3);
  fillPath(ctx, P.belt, 0.2);
  ctx.strokeStyle = '#b8a25a';
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  ctx.moveTo(-1, -17.5);
  ctx.lineTo(1.2, -17.5);
  ctx.stroke();

  // Sweater vest: shoulders to hip, a deep V neck.
  const vest = () => {
    ctx.beginPath();
    ctx.moveTo(-7.6, -41);
    ctx.quadraticCurveTo(-10.4, -39.6, -10.4, -36.4);
    ctx.lineTo(-10.2, -19.4);
    ctx.quadraticCurveTo(0, -17.8, 10.2, -19.4);
    ctx.lineTo(10.4, -36.4);
    ctx.quadraticCurveTo(10.4, -39.6, 7.6, -41);
    ctx.lineTo(4.4, -41);
    ctx.lineTo(0, -29.6);
    ctx.lineTo(-4.4, -41);
    ctx.closePath();
  };
  vest();
  const g = ctx.createLinearGradient(-10, 0, 10, 0);
  g.addColorStop(0, P.vest);
  g.addColorStop(0.7, P.vest);
  g.addColorStop(1, P.vestShade);
  fillPath(ctx, g, 0.6);
  ctx.save();
  vest();
  ctx.clip();
  // Cable knit: two twisted cables and fine purl texture.
  ctx.strokeStyle = 'rgba(120,140,200,0.4)';
  ctx.lineWidth = 0.45;
  for (const cx of [-5.6, 5.6]) {
    for (let cy = -36; cy < -20; cy += 2.4) {
      ctx.beginPath();
      ctx.moveTo(cx - 1.2, cy);
      ctx.quadraticCurveTo(cx, cy + 1.2, cx + 1.2, cy + 2.4);
      ctx.moveTo(cx + 1.2, cy);
      ctx.quadraticCurveTo(cx, cy + 1.2, cx - 1.2, cy + 2.4);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = 'rgba(10,16,40,0.25)';
  ctx.lineWidth = 0.3;
  for (let px = -9; px <= 9; px += 1.5) {
    if (Math.abs(Math.abs(px) - 5.6) < 2) continue;
    ctx.beginPath();
    ctx.moveTo(px, -38);
    ctx.lineTo(px, -21);
    ctx.stroke();
  }
  // Knit stitches: rows of tiny Vs between the cables.
  ctx.strokeStyle = 'rgba(150,170,225,0.22)';
  ctx.lineWidth = 0.18;
  for (let ky = -36.5; ky < -22.5; ky += 1.3) {
    for (let kx = -9.3; kx <= 9.3; kx += 1.5) {
      if (Math.abs(Math.abs(kx) - 5.6) < 1.6) continue;
      ctx.beginPath();
      ctx.moveTo(kx - 0.4, ky);
      ctx.lineTo(kx, ky + 0.55);
      ctx.lineTo(kx + 0.4, ky);
      ctx.stroke();
    }
  }
  // Ribbed hem band.
  ctx.fillStyle = P.vestRib;
  ctx.fillRect(-11, -22.2, 22, 3.2);
  ctx.strokeStyle = 'rgba(10,16,40,0.4)';
  ctx.lineWidth = 0.3;
  for (let px = -10.5; px <= 10.5; px += 0.9) {
    ctx.beginPath();
    ctx.moveTo(px, -22.2);
    ctx.lineTo(px, -19);
    ctx.stroke();
  }
  // A small woven brand label stitched onto the hem band.
  rr(ctx, -9.4, -21.7, 1.9, 1.3, 0.15);
  fillPath(ctx, '#fdfcf8', 0.15);
  ctx.fillStyle = '#d42a4c';
  ctx.fillRect(-9.1, -21.2, 1.3, 0.3);
  ctx.restore();
  // His shirt's hem slipping out under the vest on one side.
  ctx.beginPath();
  ctx.moveTo(-9.8, -19.6);
  ctx.quadraticCurveTo(-8, -18.3, -5.4, -18.9);
  ctx.lineTo(-5.6, -19.7);
  ctx.closePath();
  fillPath(ctx, P.shirt, 0.3);
  ctx.strokeStyle = 'rgba(120,130,160,0.5)';
  ctx.lineWidth = 0.2;
  ctx.beginPath();
  ctx.moveTo(-9.2, -19.4);
  ctx.quadraticCurveTo(-7.8, -18.9, -6, -19.2);
  ctx.stroke();
  // Ribbed armhole bands where the vest meets the shirt sleeves.
  for (const dir of [-1, 1]) {
    ctx.strokeStyle = P.vestRib;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(dir * 7.6, -41);
    ctx.quadraticCurveTo(dir * 10.6, -39.4, dir * 10.3, -34);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(10,16,40,0.4)';
    ctx.lineWidth = 0.2;
    for (let k = 0; k < 6; k++) {
      const f = k / 5;
      const bx = dir * (7.6 + 2.8 * Math.sin(f * Math.PI / 2));
      const by = -41 + 7 * f;
      ctx.beginPath();
      ctx.moveTo(bx - dir * 0.45, by - 0.2);
      ctx.lineTo(bx + dir * 0.45, by + 0.2);
      ctx.stroke();
    }
  }
  // Ribbed V-neck trim.
  ctx.strokeStyle = P.vestRib;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-4.6, -41.2);
  ctx.lineTo(0, -30);
  ctx.lineTo(4.6, -41.2);
  ctx.stroke();

  // Tie in the V: knot, blade, diagonal stripes.
  const tie = () => {
    ctx.beginPath();
    ctx.moveTo(-1.3, -39.6);
    ctx.lineTo(1.3, -39.6);
    ctx.lineTo(1.9, -31);
    ctx.lineTo(0, -29.4);
    ctx.lineTo(-1.9, -31);
    ctx.closePath();
  };
  tie();
  fillPath(ctx, P.tie, 0.4);
  ctx.save();
  tie();
  ctx.clip();
  ctx.strokeStyle = P.tieStripe;
  ctx.lineWidth = 0.45;
  for (let sy = -40; sy < -28; sy += 1.8) {
    ctx.beginPath();
    ctx.moveTo(-2, sy);
    ctx.lineTo(2, sy + 1.4);
    ctx.stroke();
  }
  ctx.restore();
  rr(ctx, -1.5, -41, 3, 2, 0.8);
  fillPath(ctx, P.tie, 0.4);
  // Folds in the knot.
  ctx.strokeStyle = 'rgba(40,10,16,0.45)';
  ctx.lineWidth = 0.18;
  ctx.beginPath();
  ctx.moveTo(-1, -40.6);
  ctx.quadraticCurveTo(-0.2, -40, -0.6, -39.2);
  ctx.moveTo(0.9, -40.7);
  ctx.quadraticCurveTo(0.3, -40.1, 0.6, -39.3);
  ctx.stroke();
  // The tie's dimple under the knot, and a gold tie clip.
  ctx.strokeStyle = 'rgba(40,10,16,0.5)';
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  ctx.moveTo(0, -38.8);
  ctx.quadraticCurveTo(0.4, -37.6, 0, -36.6);
  ctx.stroke();
  rr(ctx, -2.2, -34.4, 4.4, 0.7, 0.3);
  fillPath(ctx, '#e8c25a', 0.25);
  // A tiny embroidered crest on the tie blade below the clip.
  ctx.fillStyle = '#e8c25a';
  ctx.beginPath();
  ctx.moveTo(-0.6, -33.2);
  ctx.lineTo(0.6, -33.2);
  ctx.lineTo(0.6, -32.4);
  ctx.lineTo(0, -31.8);
  ctx.lineTo(-0.6, -32.4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = P.tie;
  ctx.fillRect(-0.12, -33, 0.24, 0.9);
  // Shirt collar points over the vest, each casting a small shadow.
  for (const dir of [-1, 1]) {
    ctx.fillStyle = 'rgba(30,40,80,0.25)';
    ctx.beginPath();
    ctx.moveTo(dir * 1.6, -41);
    ctx.lineTo(dir * 5, -41.4);
    ctx.lineTo(dir * 4.4, -37.6);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(dir * 1.2, -41.6);
    ctx.lineTo(dir * 5.4, -42.4);
    ctx.lineTo(dir * 4.2, -38.4);
    ctx.closePath();
    fillPath(ctx, P.shirt, 0.45);
    // A collar-stitch line along the edge.
    ctx.strokeStyle = 'rgba(120,130,160,0.5)';
    ctx.lineWidth = 0.22;
    ctx.beginPath();
    ctx.moveTo(dir * 1.8, -41.2);
    ctx.lineTo(dir * 4.4, -39.2);
    ctx.stroke();
  }
  // Vest side seams.
  ctx.strokeStyle = 'rgba(10,16,40,0.35)';
  ctx.lineWidth = 0.3;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 9.6, -35);
    ctx.lineTo(dir * 9.8, -22.4);
    ctx.stroke();
  }
  // A welt pocket on his right chest (viewer's left) with a pen clipped in.
  rr(ctx, -8.4, -33.6, 3.4, 0.7, 0.2);
  fillPath(ctx, P.vestRib, 0.22);
  rr(ctx, -7.4, -36.4, 0.75, 3.1, 0.3); // the pen's body above the pocket
  fillPath(ctx, '#2f3a5a', 0.2);
  rr(ctx, -7.35, -36.9, 0.65, 0.65, 0.25); // its cap button
  fillPath(ctx, '#c0c4cc', 0.15);
  ctx.strokeStyle = '#c0c4cc'; // the clip
  ctx.lineWidth = 0.22;
  ctx.beginPath();
  ctx.moveTo(-6.8, -36.4);
  ctx.lineTo(-6.75, -33.4);
  ctx.stroke();
  // A small taegeuk pin (the red-and-blue swirl of the Korean flag) just
  // below the book pin.
  ctx.save();
  ctx.translate(7.6, -32.2);
  ctx.beginPath();
  ctx.arc(0, 0, 1.05, 0, Math.PI * 2);
  fillPath(ctx, '#ffffff', 0.22);
  ctx.fillStyle = '#cd2e3a'; // red upper half
  ctx.beginPath();
  ctx.arc(0, 0, 0.82, Math.PI, 0);
  ctx.arc(0.41, 0, 0.41, 0, Math.PI, true);
  ctx.arc(-0.41, 0, 0.41, 0, Math.PI, false);
  ctx.fill();
  ctx.fillStyle = '#0047a0'; // blue lower half
  ctx.beginPath();
  ctx.arc(0, 0, 0.82, 0, Math.PI);
  ctx.arc(-0.41, 0, 0.41, Math.PI, 0, true);
  ctx.arc(0.41, 0, 0.41, Math.PI, 0, false);
  ctx.fill();
  ctx.restore();
  // An enamel library pin on his left chest: a little open book.
  ctx.save();
  ctx.translate(6.2, -35.2);
  ctx.beginPath();
  ctx.arc(0, 0, 1.6, 0, Math.PI * 2);
  fillPath(ctx, '#ffd166', 0.3);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(-1, -0.4);
  ctx.quadraticCurveTo(-0.5, -0.8, 0, -0.4);
  ctx.quadraticCurveTo(0.5, -0.8, 1, -0.4);
  ctx.lineTo(1, 0.6);
  ctx.quadraticCurveTo(0.5, 0.2, 0, 0.6);
  ctx.quadraticCurveTo(-0.5, 0.2, -1, 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#8a2a3a';
  ctx.lineWidth = 0.18;
  ctx.beginPath();
  ctx.moveTo(0, -0.4);
  ctx.lineTo(0, 0.6);
  ctx.stroke();
  ctx.restore();

  // Lanyard and ID card, swinging a little.
  const swing = Math.sin(t * 2.1) * 0.06;
  const strap = () => {
    ctx.beginPath();
    ctx.moveTo(-5.4, -41);
    ctx.quadraticCurveTo(-4.4, -34, -3.4, -29.4);
    ctx.moveTo(5.4, -41);
    ctx.quadraticCurveTo(4, -34, -2.2, -29.4);
  };
  strap();
  ctx.strokeStyle = P.lanyard;
  ctx.lineWidth = 0.9;
  ctx.stroke();
  // A woven pattern down the strap.
  ctx.save();
  strap();
  ctx.setLineDash([0.35, 0.45]);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 0.3;
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.translate(-2.8, -29.2);
  ctx.rotate(swing);
  // The lanyard's swivel clasp: a metal ring above a hinged clip.
  ctx.strokeStyle = '#c8ccd4';
  ctx.lineWidth = 0.28;
  ctx.beginPath();
  ctx.arc(0, -0.75, 0.45, 0, Math.PI * 2);
  ctx.stroke();
  rr(ctx, -0.8, -0.2, 1.6, 1.6, 0.4);
  fillPath(ctx, '#c8ccd4', 0.3);
  ctx.fillStyle = 'rgba(60,60,72,0.55)';
  ctx.fillRect(-0.5, 0.55, 1, 0.18);
  rr(ctx, -3.6, 1.2, 7.2, 9.4, 0.9);
  fillPath(ctx, P.card, 0.45);
  ctx.fillStyle = P.cardBand;
  ctx.fillRect(-3.6, 1.2, 7.2, 1.6);
  // Photo: a tiny head-and-shoulders.
  rr(ctx, -2.8, 3.4, 2.8, 3.2, 0.4);
  fillPath(ctx, '#e6eef8', 0.25);
  ctx.fillStyle = P.hair;
  ctx.beginPath();
  ctx.arc(-1.4, 4.5, 0.9, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = P.skin;
  ctx.beginPath();
  ctx.arc(-1.4, 4.8, 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = P.vest;
  ctx.fillRect(-2.4, 5.8, 2, 0.8);
  // Header, his name, and a barcode.
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 0.85px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('LIBRARY · 도서관', 0, 2.05);
  ctx.fillStyle = '#2a2a3a';
  ctx.font = 'bold 1.05px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('강민준', 0.4, 4.1);
  ctx.fillStyle = 'rgba(40,40,60,0.55)';
  ctx.font = '0.7px sans-serif';
  ctx.fillText('Assistant', 0.4, 5.3);
  for (let i = 0; i < 9; i++) ctx.fillRect(-2.8 + i * 0.62, 7.6, i % 3 ? 0.25 : 0.4, 2);
  // A holographic security sticker in the corner.
  const holo = ctx.createLinearGradient(1.9, 5.8, 3.1, 7);
  holo.addColorStop(0, '#8fd3ff');
  holo.addColorStop(0.5, '#ff8fb8');
  holo.addColorStop(1, '#ffd166');
  ctx.fillStyle = holo;
  ctx.beginPath();
  ctx.arc(2.5, 6.4, 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

/** A silver wallet chain from his right-hip belt loop, sagging round to a back pocket. */
function drawWalletChain(ctx, t, stride) {
  const sag = Math.sin(t * 2.6 + 1) * 0.25 + stride * 0.4;
  const p0 = [8, -16.4];
  const c = [7.6 + sag * 0.5, -10.6 + Math.abs(sag) * 0.3];
  const p1 = [10.3, -13.2];
  // Oval links along the curve, alternating flat and edge-on.
  for (let i = 0; i <= 12; i++) {
    const u = i / 12;
    const x = (1 - u) ** 2 * p0[0] + 2 * (1 - u) * u * c[0] + u ** 2 * p1[0];
    const y = (1 - u) ** 2 * p0[1] + 2 * (1 - u) * u * c[1] + u ** 2 * p1[1];
    ctx.beginPath();
    if (i % 2) ctx.ellipse(x, y, 0.18, 0.18, 0, 0, Math.PI * 2);
    else ctx.ellipse(x, y, 0.42, 0.26, u * 1.6 - 0.6, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(30,30,40,0.7)';
    ctx.lineWidth = 0.32;
    ctx.stroke();
    ctx.strokeStyle = '#d6dae4';
    ctx.lineWidth = 0.18;
    ctx.stroke();
  }
  // The clip on the belt loop.
  rr(ctx, p0[0] - 0.45, p0[1] - 0.9, 0.9, 1.1, 0.3);
  fillPath(ctx, '#c0c4cc', 0.2);
}

/** A keychain clipped to a belt loop: a ring, a small key and a mint book charm, swinging as he walks. */
function drawKeychain(ctx, t, stride) {
  const swing = Math.sin(t * 2.6) * 0.12 + stride * 0.25;
  ctx.save();
  ctx.translate(-4, -16.8);
  ctx.rotate(swing);
  ctx.strokeStyle = '#c0c4cc';
  ctx.lineWidth = 0.35;
  ctx.beginPath(); // the clip and ring
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 1.4);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 2.2, 0.8, 0, Math.PI * 2);
  ctx.stroke();
  // The key: a round bow and a toothed blade.
  ctx.fillStyle = '#d8c27a';
  ctx.beginPath();
  ctx.arc(-0.7, 3.5, 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-0.95, 3.9, 0.5, 2.6);
  ctx.fillRect(-0.45, 5.3, 0.4, 0.35);
  ctx.fillRect(-0.45, 6, 0.3, 0.3);
  ctx.fillStyle = 'rgba(80,60,20,0.5)';
  ctx.beginPath();
  ctx.arc(-0.7, 3.5, 0.25, 0, Math.PI * 2);
  ctx.fill();
  // The charm: a tiny mint book with a white page edge.
  rr(ctx, 0.3, 3, 1.8, 2.2, 0.3);
  fillPath(ctx, P.phonesCushion, 0.22);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(1.75, 3.25, 0.25, 1.7);
  ctx.strokeStyle = 'rgba(30,90,70,0.55)'; // engraved title lines on its cover
  ctx.lineWidth = 0.12;
  ctx.beginPath();
  ctx.moveTo(0.6, 3.7);
  ctx.lineTo(1.5, 3.7);
  ctx.moveTo(0.6, 4.1);
  ctx.lineTo(1.3, 4.1);
  ctx.stroke();
  ctx.restore();
}

/** Soft shadows on the vest where the arms meet the body. */
function drawArmShadows(ctx) {
  for (const dir of [-1, 1]) {
    const g = ctx.createLinearGradient(dir * 10.6, 0, dir * 7.6, 0);
    g.addColorStop(0, 'rgba(8,12,32,0.35)');
    g.addColorStop(1, 'rgba(8,12,32,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(dir * 10.4, -37);
    ctx.lineTo(dir * 10.2, -22.4);
    ctx.lineTo(dir * 7.6, -23);
    ctx.lineTo(dir * 7.8, -36);
    ctx.closePath();
    ctx.fill();
  }
}

// -- Arms -----------------------------------------------------------------------

/** One arm in a shirt sleeve rolled to the elbow: upper sleeve, cuff, forearm, hand. */
function drawArm(ctx, shoulder, elbow, wrist, { watch = false } = {}) {
  const [sx, sy] = shoulder;
  const [ex, ey] = elbow;
  const [wx, wy] = wrist;
  ctx.lineCap = 'round';
  // Upper sleeve.
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 6.4;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  ctx.strokeStyle = P.shirt;
  ctx.lineWidth = 5.4;
  ctx.stroke();
  ctx.strokeStyle = P.shirtShade;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(sx + 1.2, sy + 1);
  ctx.lineTo(ex + 1.2, ey);
  ctx.stroke();
  // The shoulder seam where the sleeve is set in.
  {
    const ang = Math.atan2(ey - sy, ex - sx);
    const nx = -Math.sin(ang) * 2.6;
    const ny = Math.cos(ang) * 2.6;
    const mx = sx + (ex - sx) * 0.14;
    const my = sy + (ey - sy) * 0.14;
    ctx.strokeStyle = 'rgba(120,130,160,0.55)';
    ctx.lineWidth = 0.25;
    ctx.beginPath();
    ctx.moveTo(mx - nx, my - ny);
    ctx.quadraticCurveTo(mx + Math.cos(ang) * 0.6, my + Math.sin(ang) * 0.6, mx + nx, my + ny);
    ctx.stroke();
  }
  // Forearm.
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 4.4;
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(wx, wy);
  ctx.stroke();
  ctx.strokeStyle = P.skin;
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.strokeStyle = P.skinShade;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ex + 0.9, ey + 0.4);
  ctx.lineTo(wx + 0.9, wy);
  ctx.stroke();
  // A faint vein along the forearm, and the wrist bone's bump.
  ctx.strokeStyle = 'rgba(150,120,160,0.28)';
  ctx.lineWidth = 0.25;
  ctx.beginPath();
  ctx.moveTo(ex + (wx - ex) * 0.25 - 0.5, ey + (wy - ey) * 0.25);
  ctx.quadraticCurveTo(ex + (wx - ex) * 0.55 - 0.1, ey + (wy - ey) * 0.55, wx - 0.6, wy - 0.4);
  ctx.stroke();
  ctx.fillStyle = 'rgba(217,162,131,0.5)';
  ctx.beginPath();
  ctx.arc(wx + 1.1, wy - 0.3, 0.35, 0, Math.PI * 2);
  ctx.fill();
  // Sleeve wrinkles bunching toward the rolled cuff.
  ctx.strokeStyle = 'rgba(120,130,160,0.55)';
  ctx.lineWidth = 0.28;
  for (const f of [0.55, 0.75]) {
    const mx = sx + (ex - sx) * f;
    const my = sy + (ey - sy) * f;
    ctx.beginPath();
    ctx.moveTo(mx - 1.8, my - 0.4);
    ctx.quadraticCurveTo(mx, my + 0.6, mx + 1.6, my - 0.2);
    ctx.stroke();
  }
  // Rolled cuff: a fat band with fold lines.
  const ang = Math.atan2(wy - ey, wx - ex);
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(ang - Math.PI / 2);
  rr(ctx, -3.4, -1.6, 6.8, 3.2, 1.2);
  fillPath(ctx, P.shirt, 0.45);
  ctx.strokeStyle = 'rgba(80,90,120,0.45)';
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  ctx.moveTo(-3.2, -0.4);
  ctx.lineTo(3.2, -0.4);
  ctx.moveTo(-3.2, 0.6);
  ctx.lineTo(3.2, 0.6);
  ctx.stroke();
  // A cuff button.
  ctx.beginPath();
  ctx.arc(2.2, 0.1, 0.45, 0, Math.PI * 2);
  fillPath(ctx, '#e6e8ee', 0.2);
  ctx.restore();
  if (watch) {
    ctx.save();
    ctx.translate(wx + (ex - wx) * 0.12, wy + (ey - wy) * 0.12);
    ctx.rotate(ang - Math.PI / 2);
    rr(ctx, -2.2, -0.8, 4.4, 1.6, 0.5);
    fillPath(ctx, P.watchBand, 0.3);
    ctx.fillStyle = 'rgba(20,10,6,0.6)'; // strap holes
    for (const hx of [-1.85, 1.6, 1.95]) {
      ctx.beginPath();
      ctx.arc(hx, 0, 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, 0, 1.25, 0, Math.PI * 2);
    fillPath(ctx, P.watchFace, 0.35);
    rr(ctx, 1.15, -0.25, 0.5, 0.5, 0.15); // the crown
    fillPath(ctx, P.watchFace, 0.15);
    ctx.fillStyle = '#3a2a2a';
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      ctx.fillRect(Math.cos(a) * 0.95 - 0.08, Math.sin(a) * 0.95 - 0.08, 0.16, 0.16);
    }
    ctx.strokeStyle = '#3a2a2a';
    ctx.lineWidth = 0.2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -0.8);
    ctx.moveTo(0, 0);
    ctx.lineTo(0.6, 0.2);
    ctx.stroke();
    // A thin red second hand and the centre pin.
    ctx.strokeStyle = '#d42a4c';
    ctx.lineWidth = 0.1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-0.55, 0.75);
    ctx.stroke();
    ctx.fillStyle = '#3a2a2a';
    ctx.beginPath();
    ctx.arc(0, 0, 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.lineCap = 'butt';
}

function drawHand(ctx, x, y, rot, curl = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.ellipse(0, 1, 2, 2.4, 0, 0, Math.PI * 2);
  fillPath(ctx, P.skin, 0.45);
  // Finger lines and a thumb.
  ctx.strokeStyle = P.skinDeep;
  ctx.lineWidth = 0.3;
  for (const fx of [-0.8, 0, 0.8]) {
    ctx.beginPath();
    ctx.moveTo(fx, 1.6 - curl);
    ctx.lineTo(fx, 3.2 - curl);
    ctx.stroke();
  }
  // Fingernails and knuckle creases.
  ctx.fillStyle = 'rgba(255,236,226,0.9)';
  for (const fx of [-0.8, 0, 0.8]) {
    ctx.beginPath();
    ctx.ellipse(fx + 0.1, 3.05 - curl, 0.3, 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(217,162,131,0.7)';
  ctx.lineWidth = 0.22;
  ctx.beginPath();
  ctx.moveTo(-1.2, 0.6);
  ctx.quadraticCurveTo(0, 0.9, 1.2, 0.6);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(-1.8, 0.4, 0.7, 1.3, 0.5, 0, Math.PI * 2);
  fillPath(ctx, P.skin, 0.35);
  ctx.restore();
}

/** His right arm (viewer's left) hangs free and swings opposite the stride, watch on the wrist. */
function drawFreeArm(ctx, stride, t, waveT = null) {
  const swing = -stride * 2.4 + Math.sin(t * 1.7) * 0.15;
  const shoulder = [-10.6, -38];
  let elbow = [-12.6 + swing * 0.35, -27];
  let wrist = [-12.4 + swing, -17.4];
  let rot = swing * 0.04;
  if (waveT !== null) {
    // Raised to wave: elbow out, forearm up, the hand rocking side to side.
    const wag = Math.sin(waveT * 11);
    elbow = [-17, -33.5];
    wrist = [-17.6 + wag * 1.2, -43.5];
    rot = Math.PI + wag * 0.25;
  }
  drawArm(ctx, shoulder, elbow, wrist, { watch: true });
  drawHand(ctx, wrist[0], wrist[1], rot);
  // A little plaster wrapped round one finger (paper cuts come with the job).
  ctx.save();
  ctx.translate(wrist[0], wrist[1]);
  ctx.rotate(rot);
  rr(ctx, 0.25, 2.1, 1.2, 0.75, 0.3);
  fillPath(ctx, '#f2d2a8', 0.2);
  ctx.fillStyle = 'rgba(160,110,70,0.6)';
  for (const px of [0.55, 0.85, 1.15]) {
    ctx.beginPath();
    ctx.arc(px, 2.48, 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
  // A plain silver ring on another finger.
  rr(ctx, -1.25, 2.15, 0.9, 0.38, 0.15);
  fillPath(ctx, '#d6dae4', 0.15);
  // A faded blue date stamp on the back of his hand, from testing the
  // desk stamp: a box outline with a smudged line of "date" inside.
  ctx.strokeStyle = 'rgba(52,96,190,0.5)';
  ctx.lineWidth = 0.18;
  ctx.strokeRect(-1.1, -0.85, 1.6, 0.95);
  ctx.fillStyle = 'rgba(52,96,190,0.4)';
  ctx.fillRect(-0.85, -0.5, 1.1, 0.22);
  ctx.restore();
}

/** His left arm (viewer's right) holds three books against his side. */
function drawBookArm(ctx, stride) {
  const sway = stride * 0.5;
  // A soft shadow the books cast against his side.
  ctx.fillStyle = 'rgba(10,12,30,0.18)';
  ctx.beginPath();
  ctx.ellipse(10.4, -23, 1.1, 7.2, 0, 0, Math.PI * 2);
  ctx.fill();
  // The books, standing with their spines out, Korean titles running down.
  const spines = [
    { x: 10.4, w: 3, h: 15.4, color: P.books[0] },
    { x: 13.4, w: 2.6, h: 14, color: P.books[1] },
    { x: 16, w: 3.2, h: 16.2, color: P.books[2] },
  ];
  spines.forEach((b, i) => {
    const top = -31.4 + (16.2 - b.h) + sway * 0.3;
    rr(ctx, b.x, top, b.w, b.h, 0.6);
    fillPath(ctx, b.color, 0.45);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(b.x + 0.4, top + 0.8, 0.5, b.h - 1.6);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(b.x, top + 1.6, b.w, 0.5);
    ctx.fillRect(b.x, top + b.h - 2.2, b.w, 0.5);
    // Page edges peeking at the top, and a ribbon bookmark on the middle book.
    ctx.fillStyle = '#fbf3e0';
    ctx.fillRect(b.x + 0.5, top - 0.6, b.w - 1, 0.8);
    ctx.strokeStyle = 'rgba(160,140,110,0.6)';
    ctx.lineWidth = 0.12;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(b.x + 0.5, top - 0.4 + k * 0.25);
      ctx.lineTo(b.x + b.w - 0.5, top - 0.4 + k * 0.25);
      ctx.stroke();
    }
    if (i === 2) {
      // A library due-date slip sticking out of the side, its stamped
      // lines showing (on this book because the arm hides the others).
      rr(ctx, b.x + b.w - 0.4, top + 5.2, 2.2, 2.8, 0.2);
      fillPath(ctx, '#fff6dc', 0.15);
      ctx.fillStyle = 'rgba(212,42,76,0.7)';
      ctx.fillRect(b.x + b.w, top + 5.55, 1.5, 0.24);
      ctx.fillStyle = 'rgba(40,40,60,0.55)';
      for (const ly of [6.2, 6.7, 7.2]) ctx.fillRect(b.x + b.w, top + ly, 1.3, 0.14);
      // Sticky-note tabs marking pages, poking out of the top.
      for (const [ox, c] of [[0.5, '#ffd166'], [1.6, '#8fe3c8']]) {
        rr(ctx, b.x + ox, top - 1.6 + sway * 0.1, 0.9, 1.4, 0.15);
        fillPath(ctx, c, 0.15);
      }
    }
    if (i === 1) {
      ctx.strokeStyle = '#e8558f';
      ctx.lineWidth = 0.45;
      ctx.beginPath();
      ctx.moveTo(b.x + b.w * 0.6, top - 0.4);
      ctx.quadraticCurveTo(b.x + b.w * 0.9, top - 2.4, b.x + b.w + 0.6, top - 2.8 + sway * 0.4);
      ctx.stroke();
    }
    // The Korean title, vertical, one syllable per line.
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 1.9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    [...MINJUN_BOOKS[i]].filter((ch) => ch !== ' ').forEach((ch, j) => {
      ctx.fillText(ch, b.x + b.w / 2, top + 4 + j * 2.3);
    });
    // A library call-number sticker near the foot of the spine: a white
    // label with two lines of tiny "numbers" and a coloured section band.
    // Sits between the title and the gold foot band, clear of both.
    const ly = top + b.h - 4.2;
    rr(ctx, b.x + 0.35, ly, b.w - 0.7, 1.8, 0.3);
    fillPath(ctx, '#fdfcf8', 0.18);
    ctx.fillStyle = ['#4fa8e0', '#e8558f', '#ffd166'][i];
    ctx.fillRect(b.x + 0.35, ly, b.w - 0.7, 0.4);
    ctx.fillStyle = 'rgba(40,40,60,0.7)';
    ctx.fillRect(b.x + 0.7, ly + 0.75, b.w - 1.4, 0.25);
    ctx.fillRect(b.x + 0.7, ly + 1.25, (b.w - 1.4) * 0.6, 0.25);
  });
  // The arm wrapped around them: upper arm down, forearm across the front.
  const shoulder = [10.6, -38];
  const elbow = [12.8, -27.6];
  const wrist = [17.2 + sway * 0.2, -21.4];
  drawArm(ctx, shoulder, elbow, wrist);
  // A beaded bracelet in violets, matching his eyes, just above the hand.
  {
    const bx = wrist[0] - 0.9;
    const by = wrist[1] - 1.2;
    const beads = ['#7c4cb4', '#3f1c66', '#b08ae0', '#7c4cb4', '#3f1c66', '#b08ae0', '#7c4cb4'];
    beads.forEach((c, k) => {
      const a = (k / (beads.length - 1)) * Math.PI - Math.PI / 2;
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(bx + Math.cos(a) * 0.4 - 0.2, by + Math.sin(a) * 1.7 + 0.4, 0.42, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  drawHand(ctx, wrist[0] + 0.8, wrist[1] - 0.6, -1.9, 0.6);
}

// -- Neck, headphones -------------------------------------------------------------

function drawNeckAndPhones(ctx, t) {
  rr(ctx, -2.7, -46.5, 5.4, 6, 2);
  fillPath(ctx, P.skin, 0);
  // Shadow under the jaw on the neck.
  ctx.fillStyle = P.skinShade;
  ctx.beginPath();
  ctx.moveTo(-2.7, -45.6);
  ctx.quadraticCurveTo(0, -42.4, 2.7, -45.6);
  ctx.lineTo(2.7, -44);
  ctx.quadraticCurveTo(0, -41.6, -2.7, -44);
  ctx.closePath();
  ctx.fill();
  // Adam's apple hint.
  ctx.strokeStyle = P.skinDeep;
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  ctx.arc(0.2, -42.4, 0.6, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();

  // Over-ear headphones resting around his neck: a band behind, two cups.
  const wob = Math.sin(t * 2) * 0.15;
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(0, -43, 7.6, 0.08 * Math.PI, 0.92 * Math.PI);
  ctx.stroke();
  ctx.strokeStyle = P.phones;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  for (const dir of [-1, 1]) {
    ctx.save();
    ctx.translate(dir * 7.4, -40.6 + wob * dir);
    ctx.rotate(dir * 0.35);
    rr(ctx, -2.2, -2.8, 4.4, 5.6, 1.8);
    fillPath(ctx, P.phones, 0.45);
    // A small mint logo ring on the cup.
    ctx.strokeStyle = 'rgba(143,227,200,0.85)';
    ctx.lineWidth = 0.3;
    ctx.beginPath();
    ctx.arc(dir < 0 ? -0.9 : 0.9, 1.4, 0.55, 0, Math.PI * 2);
    ctx.stroke();
    if (dir < 0) {
      // A little yellow star sticker stuck on one cup.
      ctx.beginPath();
      for (let s = 0; s < 10; s++) {
        const a = -Math.PI / 2 + (s * Math.PI) / 5;
        const r = s % 2 ? 0.3 : 0.7;
        ctx.lineTo(-0.9 + Math.cos(a) * r, -1.2 + Math.sin(a) * r);
      }
      ctx.closePath();
      fillPath(ctx, '#ffd166', 0.15);
    }
    rr(ctx, dir < 0 ? 0.4 : -2.2, -2.2, 1.8, 4.4, 0.8);
    fillPath(ctx, P.phonesCushion, 0.3);
    ctx.fillStyle = 'rgba(143,227,200,0.6)';
    ctx.beginPath();
    ctx.arc(dir < 0 ? -0.8 : 0.8, 0, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // The band's adjustment sliders, a notched metal strip by each cup.
  for (const dir of [-1, 1]) {
    ctx.save();
    ctx.translate(dir * 6.6, -43.6);
    ctx.rotate(dir * 0.9);
    rr(ctx, -0.35, -1.3, 0.7, 2.2, 0.2);
    fillPath(ctx, '#c0c4cc', 0.18);
    ctx.strokeStyle = 'rgba(60,60,72,0.6)';
    ctx.lineWidth = 0.1;
    for (const ny of [-0.8, -0.3, 0.2, 0.7]) {
      ctx.beginPath();
      ctx.moveTo(-0.3, ny);
      ctx.lineTo(0.3, ny);
      ctx.stroke();
    }
    ctx.restore();
  }
  // Stitching along the padded band.
  ctx.save();
  ctx.setLineDash([0.45, 0.4]);
  ctx.strokeStyle = 'rgba(160,170,190,0.6)';
  ctx.lineWidth = 0.2;
  ctx.beginPath();
  ctx.arc(0, -43, 7.6, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.restore();
  // The cable curling down into the vest.
  ctx.strokeStyle = P.phones;
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.moveTo(-7.8, -38);
  ctx.quadraticCurveTo(-9, -34, -7.6, -31);
  ctx.stroke();
  // An inline remote with a mic on the cable: a little capsule with three
  // buttons and a mic hole.
  ctx.save();
  ctx.translate(-8.5, -34.6);
  ctx.rotate(0.15);
  rr(ctx, -0.55, -1.3, 1.1, 2.6, 0.5);
  fillPath(ctx, P.phones, 0.22);
  ctx.fillStyle = '#8fe3c8';
  for (const by of [-0.7, 0, 0.7]) {
    ctx.beginPath();
    ctx.arc(0, by, 0.17, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#5a5a66';
  ctx.beginPath();
  ctx.arc(0, 1.05, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// -- Head -----------------------------------------------------------------------

const HEAD_Y = -56;
const EYE_Y = -55;

/**
 * The face: a rounded forehead, then an anime V-jaw (the user picked a
 * "sharper anime V-jaw" over the first, rounder oval, then asked for it
 * "a little round") — cheeks curving down to soft jaw corners, tapering
 * to a gently rounded chin.
 */
function facePath(ctx) {
  const H = HEAD_Y;
  ctx.beginPath();
  ctx.moveTo(-9.6, H - 3);
  ctx.bezierCurveTo(-9.8, H - 15, 9.8, H - 15, 9.6, H - 3);
  ctx.quadraticCurveTo(10, H + 2.8, 7.8, H + 6.2); // a fuller cheek down to a soft jaw corner
  ctx.quadraticCurveTo(5.2, H + 9.8, 2, H + 11.3); // jawline to the chin
  ctx.quadraticCurveTo(0, H + 12.3, -2, H + 11.3); // a gently rounded chin
  ctx.quadraticCurveTo(-5.2, H + 9.8, -7.8, H + 6.2);
  ctx.quadraticCurveTo(-10, H + 2.8, -9.6, H - 3);
  ctx.closePath();
}

function drawHead(ctx, t, stride, face = { mouth: null }) {
  // Short undercut at the back/sides, behind the ears.
  ctx.fillStyle = P.hairShade;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(dir * 9.2, HEAD_Y - 2.4, 1.9, 4.8, dir * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }
  // Ears with an inner fold.
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(dir * 9.9, HEAD_Y + 0.6, 1.8, 2.8, dir * 0.1, 0, Math.PI * 2);
    fillPath(ctx, P.skin, 0.45);
    ctx.strokeStyle = P.skinDeep;
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.arc(dir * 9.9, HEAD_Y + 0.6, 1, dir < 0 ? 0.6 * Math.PI : -0.4 * Math.PI, dir < 0 ? 1.4 * Math.PI : 0.4 * Math.PI);
    ctx.stroke();
    // A soft shadow in the hollow of the ear.
    ctx.fillStyle = 'rgba(217,162,131,0.45)';
    ctx.beginPath();
    ctx.ellipse(dir * 9.8, HEAD_Y + 0.8, 0.6, 1.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // A small silver stud in his left ear (viewer's right).
  ctx.beginPath();
  ctx.arc(10.1, HEAD_Y + 2.6, 0.5, 0, Math.PI * 2);
  fillPath(ctx, '#d6dae4', 0.25);
  // And a thin silver hoop through the upper rim of the same ear.
  ctx.strokeStyle = '#3a3440';
  ctx.lineWidth = 0.55;
  ctx.beginPath();
  ctx.arc(10.9, HEAD_Y - 1.1, 0.6, -0.6 * Math.PI, 0.75 * Math.PI);
  ctx.stroke();
  ctx.strokeStyle = '#d6dae4';
  ctx.lineWidth = 0.3;
  ctx.stroke();
  facePath(ctx);
  fillPath(ctx, P.skin, 0.55);
  ctx.save();
  facePath(ctx);
  ctx.clip();
  // Cel shading: the far cheek and under the fringe.
  ctx.fillStyle = 'rgba(217,162,131,0.35)';
  ctx.beginPath();
  ctx.moveTo(6.4, HEAD_Y - 6);
  ctx.quadraticCurveTo(9, HEAD_Y + 1.6, 6.2, HEAD_Y + 6.6);
  ctx.quadraticCurveTo(4.2, HEAD_Y + 9.8, 1.6, HEAD_Y + 11.6);
  ctx.lineTo(10, HEAD_Y + 12);
  ctx.lineTo(10, HEAD_Y - 6);
  ctx.closePath();
  ctx.fill();
  // Soft cheekbone contours sweeping down toward the jaw.
  ctx.fillStyle = 'rgba(217,162,131,0.1)';
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(dir * 7.2, HEAD_Y + 5.6, 1, 2.6, dir * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  // The fringe's shadow on the forehead, fading out softly.
  const fringeShadow = ctx.createLinearGradient(0, HEAD_Y - 10, 0, HEAD_Y - 5);
  fringeShadow.addColorStop(0, 'rgba(217,162,131,0.45)');
  fringeShadow.addColorStop(1, 'rgba(217,162,131,0)');
  ctx.fillStyle = fringeShadow;
  ctx.fillRect(-10, HEAD_Y - 10, 20, 5);
  ctx.restore();

  // Blush.
  // No blush — the user asked for it removed.

  // A small beauty mark under his left eye (viewer's right).
  ctx.fillStyle = 'rgba(70,40,34,0.75)';
  ctx.beginPath();
  ctx.arc(6.3, EYE_Y + 2.8, 0.26, 0, Math.PI * 2);
  ctx.fill();
  // Soft shading under the eyes.
  ctx.fillStyle = 'rgba(217,162,131,0.08)';
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(dir * 4.8, EYE_Y + 1.8, 2, 0.45, dir * -0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  drawEyes(ctx, face.eyesClosed ? 'happy' : isBlinkingAt(t));

  // Brows: relaxed — nearly level with a soft arch, thicker at the inner
  // end and tapering out (they used to slope down toward the nose, which
  // the user said looked angry).
  ctx.fillStyle = P.hair;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 1.9, EYE_Y - 5);
    ctx.quadraticCurveTo(dir * 4.8, EYE_Y - 6.9, dir * 7.8, EYE_Y - 5.6);
    ctx.quadraticCurveTo(dir * 4.8, EYE_Y - 6.2, dir * 2, EYE_Y - 4.2);
    ctx.closePath();
    ctx.fill();
  }

  // The nose bridge: a soft shadow line down from between the brows.
  ctx.strokeStyle = 'rgba(217,162,131,0.45)';
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.moveTo(1.3, EYE_Y - 3);
  ctx.quadraticCurveTo(1.6, EYE_Y - 0.6, 0.9, EYE_Y + 1.2);
  ctx.stroke();
  // Nose: a shadowed side and a nostril hint.
  ctx.fillStyle = 'rgba(217,162,131,0.55)';
  ctx.beginPath();
  ctx.moveTo(0.6, EYE_Y + 1);
  ctx.quadraticCurveTo(1.8, EYE_Y + 4.4, 0.8, EYE_Y + 5.6);
  ctx.lineTo(0.2, EYE_Y + 5.4);
  ctx.quadraticCurveTo(1, EYE_Y + 3.6, 0.2, EYE_Y + 1.2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = P.skinDeep;
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.moveTo(-0.8, EYE_Y + 5.6);
  ctx.quadraticCurveTo(0, EYE_Y + 6.1, 0.8, EYE_Y + 5.6);
  ctx.stroke();

  if (face.mouth != null) {
    drawOpenMouth(ctx, face.mouth, Boolean(face.round));
    ctx.lineCap = 'butt';
    drawHair(ctx, t, stride);
    return;
  }

  // Mouth: a small, slightly lopsided smile.
  ctx.strokeStyle = P.lips;
  ctx.lineWidth = 0.65;
  ctx.lineCap = 'round';
  // Set a little higher and narrower to sit inside the V-jaw.
  ctx.beginPath();
  ctx.moveTo(-1.7, EYE_Y + 7.4);
  ctx.quadraticCurveTo(0, EYE_Y + 8.5, 2, EYE_Y + 7.1);
  ctx.stroke();
  // Upper lip: a soft line above the smile.
  ctx.strokeStyle = 'rgba(200,120,110,0.2)';
  ctx.lineWidth = 0.25;
  ctx.beginPath();
  ctx.moveTo(-1.2, EYE_Y + 6.9);
  ctx.quadraticCurveTo(0, EYE_Y + 6.5, 1.4, EYE_Y + 6.7);
  ctx.stroke();
  // A faint lower-lip tint.
  ctx.fillStyle = 'rgba(214,140,130,0.35)';
  ctx.beginPath();
  ctx.ellipse(0.1, EYE_Y + 8.3, 1.3, 0.45, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineCap = 'butt';

  drawHair(ctx, t, stride);
}

/**
 * Sharp, cool eyes (the user picked "sharp, cool eyes" over the first,
 * softer almond ones): narrow, with the outer corners tilted up; a heavy,
 * angular upper lash line ending in a pointed flick; a straight lower lid;
 * an angled crease; and a deep iris tucked partly under the upper lid.
 */
/**
 * His mouth open: talking (`round` false) it's a wide, smiling opening with
 * a line of top teeth; singing (`round`) it's a rounder "o". `open` 0..1.
 */
function drawOpenMouth(ctx, open, round) {
  const w = round ? 1.25 : 1.9;
  const h = 0.55 + (round ? 1.9 : 1.6) * open;
  const cx = 0.15;
  const top = EYE_Y + 7.1;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(cx - w, top + (round ? 0.5 : 0.2));
    ctx.quadraticCurveTo(cx, top - (round ? 0.35 : 0.15), cx + w, top + (round ? 0.5 : 0));
    ctx.quadraticCurveTo(cx + w * (round ? 1.05 : 0.8), top + h, cx, top + h + 0.15);
    ctx.quadraticCurveTo(cx - w * (round ? 1.05 : 0.8), top + h, cx - w, top + (round ? 0.5 : 0.2));
    ctx.closePath();
  };
  path();
  ctx.fillStyle = '#6e2633';
  ctx.fill();
  ctx.save();
  path();
  ctx.clip();
  // Tongue at the bottom, top teeth when talking.
  ctx.fillStyle = '#e07a86';
  ctx.beginPath();
  ctx.ellipse(cx, top + h + 0.1, w * 0.75, h * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  if (!round) {
    ctx.fillStyle = '#fbf8f2';
    ctx.fillRect(cx - w, top - 0.3, w * 2, 0.55);
  }
  ctx.restore();
  path();
  ctx.strokeStyle = P.lips;
  ctx.lineWidth = 0.4;
  ctx.lineJoin = 'round';
  ctx.stroke();
  // The faint lower-lip tint, under the opening.
  ctx.fillStyle = 'rgba(214,140,130,0.3)';
  ctx.beginPath();
  ctx.ellipse(cx, top + h + 0.55, w * 0.6, 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** `blinking` is true for a blink, or 'happy' for closed, upturned eyes (singing). */
function drawEyes(ctx, blinking) {
  for (const dir of [-1, 1]) {
    const ex = dir * 4.5;
    // A gentle upward tilt (the user asked for them "a little bit
    // straighter" than the first, steeper version).
    const inner = [ex - dir * 3, EYE_Y + 0.5];
    const outer = [ex + dir * 3.3, EYE_Y - 0.7];
    if (blinking === 'happy') {
      // Closed and arched up, lost in the song, with the lash flick kept.
      ctx.strokeStyle = '#1a1214';
      ctx.lineWidth = 0.9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(inner[0], inner[1] + 0.3);
      ctx.quadraticCurveTo(ex, EYE_Y - 1.8, outer[0], outer[1] + 0.2);
      ctx.lineTo(outer[0] + dir * 1.1, outer[1] - 0.4);
      ctx.stroke();
      ctx.lineCap = 'butt';
      continue;
    }
    if (blinking) {
      ctx.strokeStyle = '#1a1214';
      ctx.lineWidth = 0.85;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(inner[0], inner[1]);
      ctx.quadraticCurveTo(ex, EYE_Y + 0.6, outer[0] + dir * 0.6, outer[1] - 0.2);
      ctx.stroke();
      ctx.lineCap = 'butt';
      continue;
    }
    const shape = () => {
      ctx.beginPath();
      ctx.moveTo(inner[0], inner[1]);
      // Opened a little taller so the eyes read at game size (the user:
      // "I can barely see his eyes").
      ctx.quadraticCurveTo(ex - dir * 0.4, EYE_Y - 2.5, outer[0], outer[1]);
      ctx.quadraticCurveTo(ex + dir * 1, EYE_Y + 1.9, inner[0], inner[1]);
      ctx.closePath();
    };
    shape();
    ctx.fillStyle = '#f7f5f0';
    ctx.fill();
    ctx.save();
    shape();
    ctx.clip();
    const cx = ex + dir * 0.15;
    const cy = EYE_Y - 0.1;
    // The original iris size; only the eye opening was enlarged.
    const IRIS_R = 2.05;
    const g = ctx.createLinearGradient(0, cy - IRIS_R, 0, cy + IRIS_R);
    g.addColorStop(0, P.irisDark);
    g.addColorStop(0.55, P.iris);
    g.addColorStop(1, P.irisLight);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, IRIS_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = P.pupil;
    ctx.beginPath();
    // Pupils enlarged (the user: "make it bigger now the pupils"), then
    // shrunk twice ("make his pupils smaller", "make it smaller") to just
    // under their original size.
    ctx.ellipse(cx, cy - 0.1, 0.8, 1.0, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(12,6,22,0.6)';
    ctx.lineWidth = 0.28;
    ctx.beginPath();
    ctx.arc(cx, cy, IRIS_R, 0, Math.PI * 2);
    ctx.stroke();
    // Iris texture: fine radial lines and a lighter lower crescent.
    ctx.strokeStyle = P.irisTexture;
    ctx.lineWidth = 0.14;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 1.0, cy + Math.sin(a) * 1.15);
      ctx.lineTo(cx + Math.cos(a) * (IRIS_R - 0.15), cy + Math.sin(a) * (IRIS_R - 0.1));
      ctx.stroke();
    }
    ctx.strokeStyle = P.irisCrescent;
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.arc(cx, cy, IRIS_R - 0.5, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
    // A darker ring hugging the pupil.
    ctx.strokeStyle = 'rgba(12,6,22,0.55)';
    ctx.lineWidth = 0.25;
    ctx.beginPath();
    ctx.ellipse(cx, cy - 0.1, 1.1, 1.3, 0, 0, Math.PI * 2);
    ctx.stroke();
    // The upper lid's shadow across the top of the iris.
    ctx.fillStyle = 'rgba(30,14,14,0.2)';
    ctx.beginPath();
    ctx.moveTo(inner[0], inner[1] - 1.6);
    ctx.quadraticCurveTo(ex - dir * 0.6, EYE_Y - 1.6, outer[0], outer[1] + 0.45);
    ctx.lineTo(outer[0], outer[1] - 3);
    ctx.lineTo(inner[0], inner[1] - 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // Heavy, angular upper lash line with a pointed outer flick.
    ctx.fillStyle = '#140d0e';
    ctx.beginPath();
    ctx.moveTo(inner[0] - dir * 0.2, inner[1] + 0.1);
    ctx.quadraticCurveTo(ex - dir * 0.6, EYE_Y - 3.1, outer[0], outer[1] - 0.5);
    ctx.lineTo(outer[0] + dir * 1.5, outer[1] - 0.9); // the flick
    ctx.lineTo(outer[0] + dir * 0.2, outer[1] + 0.5);
    ctx.quadraticCurveTo(ex - dir * 0.6, EYE_Y - 2, inner[0] - dir * 0.2, inner[1] + 0.6);
    ctx.closePath();
    ctx.fill();
    // Two small extra lashes fanning from the outer flick.
    ctx.strokeStyle = '#140d0e';
    ctx.lineWidth = 0.3;
    ctx.lineCap = 'round';
    for (const [dx, dy] of [[0.9, -1.6], [1.6, -1.1]]) {
      ctx.beginPath();
      ctx.moveTo(outer[0] - dir * 0.2, outer[1] - 0.5);
      ctx.lineTo(outer[0] + dir * dx, outer[1] + dy);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
    // Straight lower lid line under the outer half.
    ctx.strokeStyle = 'rgba(30,18,18,0.32)';
    ctx.lineWidth = 0.28;
    ctx.beginPath();
    ctx.moveTo(ex + dir * 0.4, EYE_Y + 1.1);
    ctx.lineTo(outer[0] - dir * 0.1, outer[1] + 0.9);
    ctx.stroke();
    // A pink inner corner.
    ctx.fillStyle = 'rgba(230,140,140,0.6)';
    ctx.beginPath();
    ctx.ellipse(inner[0] + dir * 0.45, inner[1] - 0.05, 0.4, 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Angled crease above, following the tilt.
    ctx.strokeStyle = 'rgba(150,92,72,0.32)';
    ctx.lineWidth = 0.24;
    ctx.beginPath();
    ctx.moveTo(ex - dir * 0.8, EYE_Y - 2.4);
    ctx.quadraticCurveTo(ex + dir * 0.8, EYE_Y - 3.2, outer[0] + dir * 0.4, outer[1] - 1.6);
    ctx.stroke();
  }
}

/**
 * The layered cut: a tufted crown with volume, a two-tone shaded side,
 * seven pointed fringe locks in alternating tones falling over the brows,
 * side locks in front of the ears, strand lines, and a thin bobbing ahoge.
 */
function drawHair(ctx, t, stride) {
  const H = HEAD_Y;
  const sway = Math.sin(t * 1.9) * 0.25 + stride * 0.3;

  // Crown silhouette: soft tufts around the top of the head.
  const crown = () => {
    ctx.beginPath();
    ctx.moveTo(-10.6, H - 1);
    ctx.quadraticCurveTo(-12.8, H - 5, -12.2, H - 8.6);
    ctx.quadraticCurveTo(-11, H - 10.4, -11.6, H - 12.4);
    ctx.quadraticCurveTo(-11.8, H - 16.6, -10.2, H - 17.6);
    ctx.quadraticCurveTo(-8, H - 16.4, -6.6, H - 17);
    ctx.quadraticCurveTo(-5.6, H - 20.4, -3.2, H - 20.4);
    ctx.quadraticCurveTo(-1.6, H - 18.6, -0.6, H - 19);
    ctx.quadraticCurveTo(1.4, H - 21.6, 3.8, H - 20.6);
    ctx.quadraticCurveTo(4.8, H - 18.4, 6.2, H - 18.6);
    ctx.quadraticCurveTo(9.4, H - 19, 10.2, H - 16);
    ctx.quadraticCurveTo(10.6, H - 14.2, 12.6, H - 12.8);
    ctx.quadraticCurveTo(12.2, H - 9.6, 11.4, H - 8);
    ctx.quadraticCurveTo(12, H - 4.6, 10.6, H - 1);
    // The hairline sits up behind the fringe locks, so no straight edge
    // shows under their tips.
    ctx.quadraticCurveTo(9.4, H - 6, 8.6, H - 9.6);
    ctx.quadraticCurveTo(0, H - 11.4, -8.6, H - 9.6);
    ctx.quadraticCurveTo(-9.4, H - 6, -10.6, H - 1);
    ctx.closePath();
  };
  crown();
  fillPath(ctx, P.hair, 0.5);
  // Shaded side and a mid-tone layer across the crown for depth.
  ctx.save();
  crown();
  ctx.clip();
  ctx.fillStyle = P.hairShade;
  ctx.beginPath();
  ctx.moveTo(3, H - 22);
  ctx.quadraticCurveTo(9, H - 14, 13, H - 2);
  ctx.lineTo(14, H - 22);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = P.hairMid;
  ctx.beginPath();
  ctx.moveTo(-9, H - 15);
  ctx.quadraticCurveTo(-4, H - 19.4, 2, H - 18.6);
  ctx.quadraticCurveTo(-3, H - 16.8, -8.4, H - 12.6);
  ctx.closePath();
  ctx.fill();
  // Crown strand lines following the tufts.
  ctx.strokeStyle = P.hairStrand;
  ctx.lineWidth = 0.32;
  for (const [x0, y0, cx, cy, x1, y1] of [
    [-3, -19.6, -5, -15, -8.6, -10],
    [0.4, -19.4, -1, -15, -3.4, -10.6],
    [3.6, -19.8, 4.4, -15, 3.6, -10.4],
    [6.4, -18, 8.6, -14, 9.6, -9],
    [-7, -16.6, -9.6, -13, -10.8, -7],
    [-5.2, -18.6, -6.6, -15.6, -9.6, -12.4],
    [1.8, -20, 2.4, -16, 0.6, -11.4],
    [5, -19, 6.8, -15.4, 7.4, -11],
    [8.4, -16.8, 10.6, -13, 11.4, -9.4],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x0, H + y0);
    ctx.quadraticCurveTo(cx, H + cy, x1, H + y1);
    ctx.stroke();
  }
  ctx.restore();

  // Fringe: pointed locks falling from the hairline over the brows, swept
  // slightly to his left; drawn shade-first so the lighter locks overlap.
  const locks = [
    // Tips end above the brows so the eyes stay clear.
    { l: -10.4, r: -6.8, tip: [-9.8, -3.8], c: P.hairShade },
    { l: -8.4, r: -3.8, tip: [-6.6, -6.6], c: P.hair },
    { l: -5.6, r: -0.8, tip: [-2.8, -7.4], c: P.hairMid },
    { l: -2.6, r: 2.4, tip: [0.6, -6.8], c: P.hair },
    { l: 0.6, r: 5.2, tip: [3.8, -7.6], c: P.hairMid },
    { l: 3.6, r: 8.4, tip: [7.2, -6.2], c: P.hair },
    { l: 6.6, r: 10.6, tip: [10.2, -2.6], c: P.hairShade },
  ];
  for (const lk of locks) {
    const [tx, ty] = lk.tip;
    const mid = (lk.l + lk.r) / 2;
    // Filled from inside the crown, but outlined only along its two sides,
    // so the locks' roots blend into the crown instead of drawing a band.
    // Control points sit between root and tip, so each lock tapers to a point.
    const cy = H + (-12 + ty) / 2;
    const sides = () => {
      ctx.moveTo(lk.l, H - 12);
      ctx.quadraticCurveTo(lk.l + (tx - lk.l) * 0.35 - 0.3, cy, tx + sway, H + ty);
      ctx.quadraticCurveTo(lk.r + (tx - lk.r) * 0.45 + 0.3, cy - 0.4, lk.r, H - 12);
    };
    ctx.beginPath();
    sides();
    ctx.quadraticCurveTo(mid, H - 13.4, lk.l, H - 12);
    ctx.closePath();
    // Each lock is darker at the root and a touch lighter toward its tip.
    // Roots in the crown's own colour so they blend into it.
    const lockGrad = ctx.createLinearGradient(0, H - 13, 0, H + ty);
    lockGrad.addColorStop(0, P.hair);
    lockGrad.addColorStop(0.5, lk.c);
    lockGrad.addColorStop(1, lk.c === P.hairShade ? P.hair : P.hairMid);
    ctx.fillStyle = lockGrad;
    ctx.fill();
    // A second, shorter strand line along each lock's edge.
    ctx.strokeStyle = P.hairStrand;
    ctx.lineWidth = 0.22;
    ctx.beginPath();
    ctx.moveTo(lk.l + 0.8, H - 11);
    ctx.quadraticCurveTo(lk.l + (tx - lk.l) * 0.4, cy + 0.6, tx * 0.7 + lk.l * 0.3, H + ty - 2.4);
    ctx.stroke();
    ctx.beginPath();
    sides();
    outline(ctx, 0.42);
    // A strand line down the middle of each lock.
    ctx.strokeStyle = P.hairStrand;
    ctx.lineWidth = 0.28;
    ctx.beginPath();
    ctx.moveTo(mid, H - 11.4);
    ctx.quadraticCurveTo(mid + (tx - mid) * 0.4, cy, tx * 0.85 + mid * 0.15 + sway * 0.7, H + ty - 1.2);
    ctx.stroke();
  }

  // Side locks in front of the ears, tapering to points.
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 11, H - 8);
    ctx.quadraticCurveTo(dir * 11.6, H - 1, dir * 10 + sway * 0.3, H + 5.4);
    ctx.quadraticCurveTo(dir * 9.6, H - 0.6, dir * 8.4, H - 6);
    ctx.closePath();
    fillPath(ctx, dir > 0 ? P.hairShade : P.hair, 0.42);
  }

  // Small tufts over the tops of the ears.
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 9.6, H - 4.4);
    ctx.quadraticCurveTo(dir * 11.4, H - 2.6, dir * 11.6, H + 0.4);
    ctx.quadraticCurveTo(dir * 10.6, H - 1.6, dir * 9.4, H - 2);
    ctx.closePath();
    fillPath(ctx, dir > 0 ? P.hairShade : P.hairMid, 0.35);
  }
  // A couple of loose flyaway strands off the crown.
  ctx.strokeStyle = P.hair;
  ctx.lineWidth = 0.3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-7.2, H - 16.8);
  ctx.quadraticCurveTo(-8.4, H - 18 + sway * 0.4, -9.2, H - 17.4);
  ctx.moveTo(9, H - 17);
  ctx.quadraticCurveTo(10.2, H - 17.8 + sway * 0.4, 10.9, H - 17);
  ctx.stroke();
  ctx.lineCap = 'butt';
  // Ahoge: a thin, tapered strand curling up from the crown, bobbing.
  const bounce = Math.sin(t * 3.1) * 0.8 + stride * 0.6;
  ctx.beginPath();
  ctx.moveTo(-0.6, H - 19.2);
  ctx.bezierCurveTo(-2.2, H - 23.6, 2.4 + bounce, H - 26.4, 3.8 + bounce, H - 23.4);
  ctx.bezierCurveTo(2 + bounce, H - 24.6, -0.6, H - 23, 0.6, H - 19.4);
  ctx.closePath();
  fillPath(ctx, P.hair, 0.38);

  // Two silver bobby pins clipped over his side fringe (viewer's right).
  // Each is a real hair pin: a straight prong and a wavy prong joined by a
  // rounded bend, with rubber-dipped tips at the open end, drawn with a
  // darker edge first so the metal reads against the hair.
  const bobbyPin = (x, y, angle, len) => {
    ctx.save();
    ctx.translate(x, H + y);
    ctx.rotate(angle);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const wavy = () => {
      ctx.moveTo(0, 0.32);
      for (let k = 1; k <= 4; k++) {
        const px = (len * k) / 4;
        ctx.quadraticCurveTo(px - len / 8, k % 2 ? 0.62 : 0.2, px, 0.4);
      }
    };
    const pin = () => {
      ctx.beginPath();
      ctx.moveTo(len, -0.12);
      ctx.lineTo(0, -0.12); // the straight prong
      ctx.arc(0, 0.1, 0.22, -Math.PI / 2, Math.PI / 2, true); // the bend
      wavy();
    };
    for (const [color, width] of [['#6a7080', 0.42], ['#d8dce6', 0.26]]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      pin();
      ctx.stroke();
    }
    // A thin highlight along the straight prong.
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 0.08;
    ctx.beginPath();
    ctx.moveTo(0.2, -0.16);
    ctx.lineTo(len - 0.3, -0.16);
    ctx.stroke();
    // Rubber-dipped tips on both prongs.
    ctx.fillStyle = '#4a4e5c';
    for (const ty of [-0.12, 0.4]) {
      ctx.beginPath();
      ctx.arc(len + 0.05, ty, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };
  bobbyPin(6.7, -9.7, 0.62, 3.4);
  bobbyPin(7.3, -7.9, 0.5, 3);
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  // A pencil tucked behind his right ear (viewer's left): it rests on the
  // ear, its eraser end tucked into the hair and the sharpened end sticking
  // out past the side of his head.
  ctx.save();
  ctx.translate(-12, H - 1.4);
  ctx.rotate(0.32);
  rr(ctx, -2.4, -0.5, 4.6, 1, 0.2);
  fillPath(ctx, '#ffd166', 0.25);
  ctx.fillStyle = 'rgba(224,160,32,0.6)';
  ctx.fillRect(-2.4, -0.05, 4.6, 0.18); // a facet line
  ctx.fillStyle = '#f3d6ac'; // sharpened wood, then the lead
  ctx.beginPath();
  ctx.moveTo(-2.4, -0.5);
  ctx.lineTo(-3.7, 0);
  ctx.lineTo(-2.4, 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3a3a44';
  ctx.beginPath();
  ctx.moveTo(-3.3, -0.15);
  ctx.lineTo(-3.7, 0);
  ctx.lineTo(-3.3, 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // The hair tuft over the ear falls back over the pencil's tucked end.
  ctx.beginPath();
  ctx.moveTo(-9.6, H - 4.4);
  ctx.quadraticCurveTo(-11.4, H - 2.6, -11.6, H + 0.4);
  ctx.quadraticCurveTo(-10.6, H - 1.6, -9.4, H - 2);
  ctx.closePath();
  fillPath(ctx, P.hairMid, 0.35);
}
