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
// * Props: three books under his arm, their spines in Korean.
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
  iris: '#3f1c66',
  irisLight: '#7c4cb4',
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
 * @param {{scale?: number, t?: number, walking?: boolean}} [opts]
 */
export function drawMinjun(ctx, x, y, opts = {}) {
  const k = opts.scale ?? 1;
  const t = opts.t ?? 0;
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
  drawFreeArm(ctx, stride, t);
  drawTorso(ctx, breathe, t);
  drawArmShadows(ctx);
  drawBookArm(ctx, stride);
  drawNeckAndPhones(ctx, t);
  drawHead(ctx, t, stride);
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
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.moveTo(lx - dir * 2.6, -0.4 - lift);
    ctx.quadraticCurveTo(lx, 0.6 - lift, lx + dir * 2.8, -0.6 - lift);
    ctx.moveTo(lx - dir * 2.2, 1.2 - lift);
    ctx.quadraticCurveTo(lx + dir * 0.4, 1.9 - lift, lx + dir * 2.6, 1 - lift);
    ctx.stroke();
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
  ctx.restore();
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
  // The tie's dimple under the knot, and a gold tie clip.
  ctx.strokeStyle = 'rgba(40,10,16,0.5)';
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  ctx.moveTo(0, -38.8);
  ctx.quadraticCurveTo(0.4, -37.6, 0, -36.6);
  ctx.stroke();
  rr(ctx, -2.2, -34.4, 4.4, 0.7, 0.3);
  fillPath(ctx, '#e8c25a', 0.25);
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
  rr(ctx, -0.8, -0.2, 1.6, 1.6, 0.4);
  fillPath(ctx, '#c8ccd4', 0.3);
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
  ctx.restore();
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
function drawFreeArm(ctx, stride, t) {
  const swing = -stride * 2.4 + Math.sin(t * 1.7) * 0.15;
  const shoulder = [-10.6, -38];
  const elbow = [-12.6 + swing * 0.35, -27];
  const wrist = [-12.4 + swing, -17.4];
  drawArm(ctx, shoulder, elbow, wrist, { watch: true });
  drawHand(ctx, wrist[0], wrist[1], swing * 0.04);
}

/** His left arm (viewer's right) holds three books against his side. */
function drawBookArm(ctx, stride) {
  const sway = stride * 0.5;
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
  });
  // The arm wrapped around them: upper arm down, forearm across the front.
  const shoulder = [10.6, -38];
  const elbow = [12.8, -27.6];
  const wrist = [17.2 + sway * 0.2, -21.4];
  drawArm(ctx, shoulder, elbow, wrist);
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
    rr(ctx, dir < 0 ? 0.4 : -2.2, -2.2, 1.8, 4.4, 0.8);
    fillPath(ctx, P.phonesCushion, 0.3);
    ctx.fillStyle = 'rgba(143,227,200,0.6)';
    ctx.beginPath();
    ctx.arc(dir < 0 ? -0.8 : 0.8, 0, 0.5, 0, Math.PI * 2);
    ctx.fill();
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

function drawHead(ctx, t, stride) {
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
  }
  // A small silver stud in his left ear (viewer's right).
  ctx.beginPath();
  ctx.arc(10.1, HEAD_Y + 2.6, 0.5, 0, Math.PI * 2);
  fillPath(ctx, '#d6dae4', 0.25);
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
  // The fringe's shadow on the forehead, fading out softly.
  const fringeShadow = ctx.createLinearGradient(0, HEAD_Y - 10, 0, HEAD_Y - 5);
  fringeShadow.addColorStop(0, 'rgba(217,162,131,0.45)');
  fringeShadow.addColorStop(1, 'rgba(217,162,131,0)');
  ctx.fillStyle = fringeShadow;
  ctx.fillRect(-10, HEAD_Y - 10, 20, 5);
  ctx.restore();

  // Blush.
  // No blush — the user asked for it removed.

  // Soft shading under the eyes.
  ctx.fillStyle = 'rgba(217,162,131,0.08)';
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(dir * 4.8, EYE_Y + 1.8, 2, 0.45, dir * -0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  drawEyes(ctx, isBlinkingAt(t));

  // Straight, slightly raised brows with a tapered tail.
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

  // Mouth: a small, slightly lopsided smile with a lower-lip shadow.
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
function drawEyes(ctx, blinking) {
  for (const dir of [-1, 1]) {
    const ex = dir * 4.5;
    // A gentle upward tilt (the user asked for them "a little bit
    // straighter" than the first, steeper version).
    const inner = [ex - dir * 3, EYE_Y + 0.5];
    const outer = [ex + dir * 3.3, EYE_Y - 0.7];
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
      ctx.quadraticCurveTo(ex - dir * 0.4, EYE_Y - 2, outer[0], outer[1]);
      ctx.quadraticCurveTo(ex + dir * 1, EYE_Y + 1.5, inner[0], inner[1]);
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
    const g = ctx.createLinearGradient(0, cy - 2.1, 0, cy + 2.1);
    g.addColorStop(0, P.irisDark);
    g.addColorStop(0.55, P.iris);
    g.addColorStop(1, P.irisLight);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, 2.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = P.pupil;
    ctx.beginPath();
    ctx.ellipse(cx, cy - 0.1, 0.85, 1.05, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(12,6,22,0.6)';
    ctx.lineWidth = 0.28;
    ctx.beginPath();
    ctx.arc(cx, cy, 2.05, 0, Math.PI * 2);
    ctx.stroke();
    // Iris texture: fine radial lines and a lighter lower crescent.
    ctx.strokeStyle = P.irisTexture;
    ctx.lineWidth = 0.14;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 1.05, cy + Math.sin(a) * 1.2);
      ctx.lineTo(cx + Math.cos(a) * 1.9, cy + Math.sin(a) * 1.95);
      ctx.stroke();
    }
    ctx.strokeStyle = P.irisCrescent;
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.arc(cx, cy, 1.6, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
    // A darker ring hugging the pupil.
    ctx.strokeStyle = 'rgba(12,6,22,0.55)';
    ctx.lineWidth = 0.25;
    ctx.beginPath();
    ctx.ellipse(cx, cy - 0.1, 1.15, 1.35, 0, 0, Math.PI * 2);
    ctx.stroke();
    // The upper lid's shadow across the top of the iris.
    ctx.fillStyle = 'rgba(30,14,14,0.3)';
    ctx.beginPath();
    ctx.moveTo(inner[0], inner[1] - 1.4);
    ctx.quadraticCurveTo(ex - dir * 0.6, EYE_Y - 1.2, outer[0], outer[1] + 0.6);
    ctx.lineTo(outer[0], outer[1] - 3);
    ctx.lineTo(inner[0], inner[1] - 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // Heavy, angular upper lash line with a pointed outer flick.
    ctx.fillStyle = '#140d0e';
    ctx.beginPath();
    ctx.moveTo(inner[0] - dir * 0.2, inner[1] + 0.1);
    ctx.quadraticCurveTo(ex - dir * 0.6, EYE_Y - 2.6, outer[0], outer[1] - 0.5);
    ctx.lineTo(outer[0] + dir * 1.5, outer[1] - 0.9); // the flick
    ctx.lineTo(outer[0] + dir * 0.2, outer[1] + 0.5);
    ctx.quadraticCurveTo(ex - dir * 0.6, EYE_Y - 1.5, inner[0] - dir * 0.2, inner[1] + 0.6);
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
}
