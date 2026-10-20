// Han Ji-ho (한지호), a high-school student who studies at the library and
// helps Eun-mi ("add another super detailed character a boy again": a
// high-school student who helps the player). A navy school blazer with a
// gold crest, piping and a "한지호" name tag over a grey hoodie (its hood on
// his shoulders), a white shirt and striped tie, grey trousers, white socks
// and canvas high-tops; fluffy black hair with a fringe and a cowlick, big
// tired eyes (exam season; the eye bags were removed at the user's request); a heavy black backpack on
// both shoulders with a plush bunny and a pin badge; one hand on a strap,
// the other holding a ring of vocabulary flashcards; a black digital watch.
// Layered flat shading, no eye highlights, like the game's other characters.
//
// Coordinates follow Hospital Shift's anime adult frame (feet at 0,
// shoulders about -40, face centre about -55), like kimono-himura.js.

const LINE = 'rgba(24,18,44,0.68)';

const P = {
  skin: '#f8dcc6',
  skinShade: '#eac0a2',
  skinDeep: '#d6a284',
  // Dark brown ("change the hair": fluffy, messy, dark brown).
  hair: '#4a2e22',
  hairMid: '#6a4432',
  hairDeep: '#33201a',
  hairShine: 'rgba(214,160,120,0.5)',
  iris: '#5a3826',
  irisLight: '#a8724a',
  pupil: '#120c10',
  blazer: '#22305a',
  blazerShade: '#18223f',
  blazerLight: '#2e3f72',
  piping: '#c9a24a',
  hoodie: '#a8acb6',
  hoodieShade: '#8a8e9a',
  shirt: '#f6f6f2',
  tie: '#8a2a3e',
  tieStripe: '#22305a',
  trousers: '#6e7280',
  trousersShade: '#5a5e6a',
  sock: '#f4f4f2',
  shoe: '#f6f2e8',
  shoeShade: '#ddd6c6',
  sole: '#e6e2d8',
  bag: '#26262e',
  bagShade: '#16161c',
  card: '#fffaf0',
  lips: '#cf8a82',
};

function outline(ctx, width = 0.55) {
  ctx.strokeStyle = LINE;
  ctx.lineWidth = width;
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

/** Whether he's blinking at time `t` (a sleepy blink every ~3.1 s, sometimes a slow one). */
export function isJihoBlinkingAt(t) {
  const m = ((t % 3.1) + 3.1) % 3.1;
  return m < 0.14 || (Math.floor(t / 3.1) % 4 === 2 && m > 0.6 && m < 0.95);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - feet centre
 * @param {number} y - feet line
 * @param {{scale?: number, t?: number, walking?: boolean, walkAmount?: number}} [opts]
 */
export function drawJiho(ctx, x, y, opts = {}) {
  const k = (opts.scale ?? 1) * 0.97; // a teen: a touch shorter
  const t = opts.t ?? 0;
  const amount = opts.walkAmount ?? (opts.walking ? 1 : 0);
  const phase = t * 6.4;
  const stride = Math.sin(phase) * amount;
  const bob = (1 - Math.abs(Math.sin(phase))) * 1.5 * amount;
  const breathe = Math.sin(t * 1.6) * 0.3 * (1 - amount);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);

  ctx.fillStyle = 'rgba(40,30,40,0.16)';
  ctx.beginPath();
  ctx.ellipse(0, 7, 13, 3.1, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(0, -bob);
  drawBackpackBody(ctx, stride, t);
  drawLegs(ctx, phase, amount);
  ctx.save();
  ctx.translate(0, -breathe * 0.4);
  drawTorso(ctx);
  drawStrapArm(ctx, stride);
  drawCardArm(ctx, stride, t);
  drawHood(ctx);
  ctx.translate(0, Math.sin(phase * 2 - 0.9) * 0.35 * amount);
  drawHead(ctx, t);
  ctx.restore();
  ctx.restore();
}

// -- Backpack (behind him) ---------------------------------------------------

function drawBackpackBody(ctx, stride, t) {
  // The pack sticks out either side of his back, bouncing a little.
  const sway = stride * 0.5;
  rr(ctx, -12.6 + sway, -41.4, 25.2, 23, 5);
  fillPath(ctx, P.bag, 0.6);
  ctx.fillStyle = P.bagShade;
  ctx.fillRect(8.4 + sway, -39.4, 3.6, 19);
  // A mint water bottle in the side mesh pocket, its cap and a sticker.
  rr(ctx, 12.2 + sway, -36.4, 3.6, 11, 1.2);
  fillPath(ctx, '#9fe3cc', 0.4);
  rr(ctx, 12.4 + sway, -38.4, 3.2, 2.4, 0.6);
  fillPath(ctx, '#ffffff', 0.35);
  ctx.beginPath();
  ctx.arc(14 + sway, -31, 0.9, 0, Math.PI * 2);
  fillPath(ctx, '#ffd166', 0.15);
  rr(ctx, 11.6 + sway, -29.6, 4.8, 5, 1);
  ctx.fillStyle = 'rgba(30,30,40,0.75)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 0.15;
  for (let k = 0; k < 4; k++) {
    ctx.beginPath();
    ctx.moveTo(11.8 + sway, -28.8 + k * 1.2);
    ctx.lineTo(16.2 + sway, -28.8 + k * 1.2);
    ctx.stroke();
  }
  // A plush bunny keychain hanging from one side, swinging.
  const swing = Math.sin(t * 2.6) * 0.25 + stride * 0.3;
  ctx.save();
  ctx.translate(-12.2 + sway, -27);
  ctx.rotate(swing);
  ctx.strokeStyle = '#c0c4cc';
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 2);
  ctx.stroke();
  for (const dx of [-0.8, 0.8]) {
    ctx.beginPath();
    ctx.ellipse(dx, 2.8, 0.6, 1.6, dx * 0.2, 0, Math.PI * 2);
    fillPath(ctx, '#fbe6ee', 0.2);
  }
  ctx.beginPath();
  ctx.arc(0, 5, 1.7, 0, Math.PI * 2);
  fillPath(ctx, '#fbe6ee', 0.25);
  ctx.beginPath();
  ctx.ellipse(0, 7.6, 1.5, 1.6, 0, 0, Math.PI * 2);
  fillPath(ctx, '#fbe6ee', 0.25);
  ctx.fillStyle = '#1c1820';
  for (const dx of [-0.6, 0.6]) {
    ctx.beginPath();
    ctx.arc(dx, 4.8, 0.22, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ff8fb8';
  ctx.beginPath();
  ctx.arc(0, 5.5, 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// -- Legs, socks and high-tops ---------------------------------------------------

const THIGH = 10.4;
const SHIN = 10;

function segment(ctx, x0, y0, x1, y1, w0, w1, fill) {
  const a = Math.atan2(y1 - y0, x1 - x0) - Math.PI / 2;
  const c = Math.cos(a);
  const s = Math.sin(a);
  ctx.beginPath();
  ctx.moveTo(x0 - (w0 / 2) * c, y0 - (w0 / 2) * s);
  ctx.lineTo(x0 + (w0 / 2) * c, y0 + (w0 / 2) * s);
  ctx.lineTo(x1 + (w1 / 2) * c, y1 + (w1 / 2) * s);
  ctx.lineTo(x1 - (w1 / 2) * c, y1 - (w1 / 2) * s);
  ctx.closePath();
  fillPath(ctx, fill, 0.5);
}

function drawLegs(ctx, phase, amount) {
  const legs = [-1, 1].map((dir) => {
    const lp = phase + (dir < 0 ? 0 : Math.PI);
    return { dir, lp, hip: Math.sin(lp) * 0.3 * amount, knee: Math.max(0, Math.cos(lp)) ** 1.5 * 0.45 * amount };
  });
  legs.sort((a, b) => a.hip - b.hip);
  for (const { dir, lp, hip, knee } of legs) {
    const hx = dir * 3.4;
    const hy = -19.4;
    const kx = hx - Math.sin(hip) * THIGH;
    const ky = hy + Math.cos(hip) * THIGH;
    const sa = hip - knee;
    const ax = kx - Math.sin(sa) * SHIN;
    const ay = ky + Math.cos(sa) * SHIN;
    const fill = dir < 0 ? P.trousers : P.trousersShade;
    // School trousers: a little loose, a soft crease, a fold at the knee.
    segment(ctx, hx, hy, kx, ky, 6.6, 5.8, fill);
    segment(ctx, kx, ky, ax, ay, 5.8, 5.2, fill);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.moveTo(kx, ky + 1);
    ctx.lineTo(ax, ay - 2);
    ctx.stroke();
    if (knee > 0.12) {
      ctx.strokeStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.moveTo(kx - 2.2, ky - 0.3);
      ctx.quadraticCurveTo(kx, ky + 0.8, kx + 2.2, ky - 0.3);
      ctx.stroke();
    }
    const pitch = Math.sin(lp) > 0 ? Math.sin(lp) * 0.15 * amount : -Math.sin(lp) * 0.3 * amount;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(pitch * (Math.sin(lp) > 0 ? -1 : 1));
    // The trouser hem breaking over a white crew sock.
    rr(ctx, -3.1, -2.2, 6.2, 1.4, 0.4);
    fillPath(ctx, P.trousersShade, 0.3);
    rr(ctx, -2.4, -1.2, 4.8, 2.6, 0.6);
    fillPath(ctx, P.sock, 0.3);
    // A navy stripe round the sock.
    ctx.fillStyle = P.blazer;
    ctx.fillRect(-2.3, -0.6, 4.6, 0.4);
    drawHighTop(ctx);
    ctx.restore();
  }
}

/** A canvas high-top: rubber sole and toe cap, laces, a round ankle patch. */
function drawHighTop(ctx) {
  const y0 = 1.2;
  rr(ctx, -3.9, y0 + 3.4, 8.4, 1.8, 0.8);
  fillPath(ctx, P.sole, 0.4);
  ctx.strokeStyle = 'rgba(40,40,60,0.45)';
  ctx.lineWidth = 0.25;
  ctx.beginPath();
  ctx.moveTo(-3.6, y0 + 4.3);
  ctx.lineTo(4.2, y0 + 4.3);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-3.6, y0 + 3.6);
  ctx.lineTo(-3.4, y0 - 1.6);
  ctx.lineTo(0.8, y0 - 1.8);
  ctx.quadraticCurveTo(4.6, y0 + 0.6, 4.3, y0 + 3.6);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, y0 - 2, 0, y0 + 4);
  g.addColorStop(0, P.shoe);
  g.addColorStop(1, P.shoeShade);
  fillPath(ctx, g, 0.45);
  // Rubber toe cap.
  ctx.beginPath();
  ctx.moveTo(2, y0 + 3.6);
  ctx.quadraticCurveTo(4.4, y0 + 3.4, 4.3, y0 + 1.6);
  ctx.quadraticCurveTo(3.4, y0 + 1.2, 2.4, y0 + 2);
  ctx.closePath();
  fillPath(ctx, P.sole, 0.3);
  // Laces crossing up the tongue.
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 0.35;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-0.6 + i * 0.7, y0 - 1.2 + i * 0.9);
    ctx.lineTo(0.8 + i * 0.7, y0 - 0.4 + i * 0.9);
    ctx.stroke();
  }
  // Metal eyelets beside the laces, and the lace ends with aglets.
  ctx.fillStyle = '#9ea4b2';
  for (let i = 0; i < 3; i++) {
    for (const off of [-0.7, 1]) {
      ctx.beginPath();
      ctx.arc(-0.6 + i * 0.7 + off, y0 - 1 + i * 0.9 + (off > 0 ? 0.6 : 0), 0.16, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  ctx.moveTo(-0.4, y0 - 1.6);
  ctx.quadraticCurveTo(-1.6, y0 - 1.4, -1.8, y0 + 0.6);
  ctx.stroke();
  ctx.fillStyle = '#9ea4b2';
  ctx.fillRect(-2, y0 + 0.5, 0.4, 0.6);
  // Scuffs and a ballpoint star doodled on the canvas.
  ctx.strokeStyle = 'rgba(120,110,100,0.35)';
  ctx.lineWidth = 0.2;
  ctx.beginPath();
  ctx.moveTo(-2.6, y0 + 2.6);
  ctx.lineTo(-1.6, y0 + 2.9);
  ctx.moveTo(1.4, y0 + 2.4);
  ctx.lineTo(2.2, y0 + 2.2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(58,98,200,0.7)';
  ctx.lineWidth = 0.15;
  ctx.beginPath();
  for (let k = 0; k <= 5; k++) {
    const a = -Math.PI / 2 + (k * 4 * Math.PI) / 5;
    const px = 3 + Math.cos(a) * 0.5;
    const py = y0 + 2.4 + Math.sin(a) * 0.5;
    if (k === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  // The round ankle patch.
  ctx.beginPath();
  ctx.arc(-2.2, y0 + 0.4, 0.8, 0, Math.PI * 2);
  fillPath(ctx, '#ffffff', 0.2);
  ctx.fillStyle = '#d42a4c';
  ctx.beginPath();
  ctx.arc(-2.2, y0 + 0.4, 0.35, 0, Math.PI * 2);
  ctx.fill();
}

// -- Torso: hoodie, shirt, tie, blazer ---------------------------------------

// Tailored ("make him better"): sloped shoulders, a nipped-in waist and a
// curved hem that falls a little lower, in place of the old boxy rectangle.
function blazerPath(ctx) {
  ctx.beginPath();
  ctx.moveTo(-5.4, -42.6);
  ctx.quadraticCurveTo(-10.8, -42, -11.4, -36.4);
  ctx.quadraticCurveTo(-9.8, -26, -10.6, -15);
  ctx.quadraticCurveTo(0, -12.8, 10.6, -15);
  ctx.quadraticCurveTo(9.8, -26, 11.4, -36.4);
  ctx.quadraticCurveTo(10.8, -42, 5.4, -42.6);
  ctx.closePath();
}

function drawTorso(ctx) {
  const g = ctx.createLinearGradient(-12, 0, 12, 0);
  g.addColorStop(0, P.blazerLight);
  g.addColorStop(0.5, P.blazer);
  g.addColorStop(1, P.blazerShade);
  blazerPath(ctx);
  fillPath(ctx, g, 0.6);
  // Soft cloth shading: the far side in shadow, a fold under each arm, and
  // a highlight down the near front.
  ctx.save();
  blazerPath(ctx);
  ctx.clip();
  ctx.fillStyle = 'rgba(8,12,30,0.25)';
  ctx.beginPath();
  ctx.moveTo(7.6, -42);
  ctx.quadraticCurveTo(9.4, -28, 8.6, -12);
  ctx.lineTo(12, -12);
  ctx.lineTo(12, -42);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(8,12,30,0.35)';
  ctx.lineWidth = 0.4;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 10.2, -33);
    ctx.quadraticCurveTo(dir * 9, -29, dir * 9.6, -25);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(-9.6, -40, 2.4, 25);
  ctx.restore();
  // The open V: grey hoodie front, then the white shirt collar and tie.
  ctx.beginPath();
  ctx.moveTo(-5, -42.4);
  ctx.lineTo(0, -27.4);
  ctx.lineTo(5, -42.4);
  ctx.closePath();
  fillPath(ctx, P.hoodie, 0.45);
  ctx.beginPath();
  ctx.moveTo(-3.2, -42.6);
  ctx.lineTo(0, -34);
  ctx.lineTo(3.2, -42.6);
  ctx.closePath();
  fillPath(ctx, P.shirt, 0.35);
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 0.4, -42.4);
    ctx.lineTo(dir * 3.4, -43);
    ctx.lineTo(dir * 2.6, -40);
    ctx.closePath();
    fillPath(ctx, P.shirt, 0.3);
  }
  // The striped tie, loosened a little.
  ctx.beginPath();
  ctx.moveTo(-1.1, -41.4);
  ctx.lineTo(1.1, -41.4);
  ctx.lineTo(1.6, -33.4);
  ctx.lineTo(0, -31.6);
  ctx.lineTo(-1.6, -33.4);
  ctx.closePath();
  fillPath(ctx, P.tie, 0.35);
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = P.tieStripe;
  ctx.lineWidth = 0.55;
  for (let y = -41; y < -31; y += 1.6) {
    ctx.beginPath();
    ctx.moveTo(-2, y + 1.2);
    ctx.lineTo(2, y);
    ctx.stroke();
  }
  ctx.restore();
  rr(ctx, -1.2, -42.2, 2.4, 1.4, 0.4);
  fillPath(ctx, P.tie, 0.3);
  // A silver tie clip with a tiny engraved line.
  rr(ctx, -2, -36.2, 4, 0.6, 0.2);
  fillPath(ctx, '#d6dae4', 0.15);
  ctx.fillStyle = 'rgba(80,84,96,0.6)';
  ctx.fillRect(-1.3, -36, 2.6, 0.12);
  // Hoodie drawstrings hanging down the V.
  ctx.strokeStyle = '#f4f4f2';
  ctx.lineWidth = 0.4;
  for (const dx of [-2.6, 2.6]) {
    ctx.beginPath();
    ctx.moveTo(dx, -40.6);
    ctx.lineTo(dx * 1.08, -33.6);
    ctx.stroke();
    rr(ctx, dx * 1.08 - 0.3, -33.8, 0.6, 1, 0.2);
    fillPath(ctx, '#c0c4cc', 0.1);
  }
  // Lapels with gold piping, the blazer edges and two gold buttons.
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 5.4, -42.6);
    ctx.lineTo(dir * 8.4, -41.4);
    ctx.lineTo(dir * 7.6, -37.4);
    ctx.lineTo(dir * 8.8, -36.4);
    ctx.lineTo(dir * 2.2, -26.6);
    ctx.lineTo(dir * 0.2, -27.4);
    ctx.closePath();
    fillPath(ctx, P.blazerShade, 0.45);
    ctx.strokeStyle = P.piping;
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.moveTo(dir * 5.6, -42.2);
    ctx.lineTo(dir * 8, -41.2);
    ctx.lineTo(dir * 7.3, -37.4);
    ctx.lineTo(dir * 8.4, -36.4);
    ctx.lineTo(dir * 2.2, -27.2);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(10,16,40,0.6)';
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.moveTo(0, -27.4);
  ctx.lineTo(0.4, -16);
  ctx.stroke();
  for (const by of [-24.4, -19.8]) {
    ctx.beginPath();
    ctx.arc(-0.9, by, 0.7, 0, Math.PI * 2);
    fillPath(ctx, P.piping, 0.2);
  }
  // A breast pocket with the gold school crest: a shield with a book.
  rr(ctx, -9.4, -34.6, 4.4, 0.6, 0.2);
  fillPath(ctx, P.blazerShade, 0.2);
  ctx.beginPath();
  ctx.moveTo(-9, -33.6);
  ctx.lineTo(-5.4, -33.6);
  ctx.lineTo(-5.4, -31.4);
  ctx.quadraticCurveTo(-7.2, -29.2, -9, -31.4);
  ctx.closePath();
  fillPath(ctx, P.piping, 0.25);
  ctx.fillStyle = P.blazer;
  ctx.fillRect(-8, -32.8, 1.5, 1);
  ctx.fillRect(-7.2, -32.8, 1.5, 1);
  ctx.fillStyle = P.piping;
  ctx.fillRect(-7.25, -32.8, 0.15, 1);
  // A pen clipped in the breast pocket.
  rr(ctx, -6.4, -36.8, 0.6, 2.4, 0.25);
  fillPath(ctx, '#4fa8e0', 0.15);
  // The name tag (명찰) on the other side: white, blue band, "한지호".
  // (Low on the blazer front, below the lapel, clear of the backpack strap.)
  rr(ctx, 1.6, -25.4, 5, 1.9, 0.3);
  fillPath(ctx, '#ffffff', 0.25);
  ctx.fillStyle = '#4fa8e0';
  ctx.fillRect(1.6, -25.4, 0.7, 1.9);
  ctx.fillStyle = '#1c1820';
  ctx.font = 'bold 1.15px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('한지호', 4.5, -24.4);
  // Flap pockets low on the blazer and a soft fold at the waist.
  for (const dir of [-1, 1]) {
    rr(ctx, dir * 7.2 - 2.4, -21.4, 4.8, 1.2, 0.3);
    fillPath(ctx, P.blazerShade, 0.25);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.moveTo(-9, -25);
  ctx.quadraticCurveTo(-7, -24, -5, -25.4);
  ctx.stroke();
  // Neon sticky tabs poking out of the left flap pocket, and a yellow
  // highlighter.
  for (const [dx, c] of [[5.4, '#ffe066'], [6.6, '#8fe3c8'], [7.8, '#ff8fb8']]) {
    rr(ctx, dx, -23.4, 1, 2.2, 0.15);
    fillPath(ctx, c, 0.15);
  }
  rr(ctx, 8.8, -24.6, 0.8, 3.4, 0.3);
  fillPath(ctx, '#f2e24a', 0.2);
  rr(ctx, 8.8, -24.6, 0.8, 0.9, 0.3);
  fillPath(ctx, '#2a2a30', 0.15);
  // A round "수능 D-100" exam-countdown pin on the left lapel.
  ctx.beginPath();
  ctx.arc(4.2, -38.8, 1.35, 0, Math.PI * 2);
  fillPath(ctx, '#ffffff', 0.25);
  ctx.strokeStyle = '#d42a4c';
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  ctx.arc(4.2, -38.8, 1.1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#d42a4c';
  ctx.font = 'bold 0.62px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('수능', 4.2, -39.25);
  ctx.fillText('D-100', 4.2, -38.4);
  // Blazer stitching: dashed lines round the pockets and down the front.
  ctx.strokeStyle = 'rgba(201,162,74,0.4)';
  ctx.lineWidth = 0.15;
  ctx.setLineDash([0.35, 0.25]);
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.roundRect(dir * 7.2 - 2.6, -21.6, 5.2, 1.6, 0.3);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(10.6, -35);
  ctx.lineTo(10.4, -17.6);
  ctx.moveTo(-10.6, -35);
  ctx.lineTo(-10.4, -17.6);
  ctx.stroke();
  ctx.setLineDash([]);
  // The hoodie's hem showing under the blazer.
  rr(ctx, -10, -15.4, 20, 1.8, 0.8);
  fillPath(ctx, P.hoodieShade, 0.35);
}

/** The grey hood gathered on his shoulders behind his neck. */
function drawHood(ctx) {
  ctx.beginPath();
  ctx.moveTo(-8.6, -42.4);
  ctx.quadraticCurveTo(-7, -47.4, 0, -47.6);
  ctx.quadraticCurveTo(7, -47.4, 8.6, -42.4);
  ctx.quadraticCurveTo(0, -44.2, -8.6, -42.4);
  ctx.closePath();
  fillPath(ctx, P.hoodie, 0.45);
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.moveTo(-5, -45.4);
  ctx.quadraticCurveTo(0, -46.4, 5, -45.4);
  ctx.stroke();
}

// -- Arms ------------------------------------------------------------------------

function sleeve(ctx, shoulder, elbow, wrist) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 5.2;
  ctx.beginPath();
  ctx.moveTo(...shoulder);
  ctx.lineTo(...elbow);
  ctx.lineTo(...wrist);
  ctx.stroke();
  ctx.strokeStyle = P.blazer;
  ctx.lineWidth = 4.2;
  ctx.stroke();
  ctx.strokeStyle = P.blazerLight;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(shoulder[0] - 1, shoulder[1] + 1);
  ctx.lineTo(elbow[0] - 1, elbow[1]);
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  // The grey hoodie cuff peeking out of the blazer sleeve.
  const a = Math.atan2(wrist[1] - elbow[1], wrist[0] - elbow[0]);
  ctx.save();
  ctx.translate(wrist[0], wrist[1]);
  ctx.rotate(a - Math.PI / 2);
  // Three small gold buttons up the blazer cuff.
  for (let b = 0; b < 3; b++) {
    ctx.beginPath();
    ctx.arc(1.4, -2.2 - b * 0.9, 0.32, 0, Math.PI * 2);
    fillPath(ctx, P.piping, 0.1);
  }
  rr(ctx, -2.3, -1.2, 4.6, 1.8, 0.6);
  fillPath(ctx, P.hoodie, 0.3);
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 0.2;
  for (let x = -1.8; x <= 1.8; x += 0.6) {
    ctx.beginPath();
    ctx.moveTo(x, -1);
    ctx.lineTo(x, 0.4);
    ctx.stroke();
  }
  ctx.restore();
}

function hand(ctx, x, y, rot, grip = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.ellipse(0, 1, 1.9, 2.2, 0, 0, Math.PI * 2);
  fillPath(ctx, P.skin, 0.45);
  ctx.strokeStyle = P.skinDeep;
  ctx.lineWidth = 0.26;
  for (const fx of [-0.7, 0, 0.7]) {
    ctx.beginPath();
    ctx.moveTo(fx, grip ? 0.6 : 1.7);
    ctx.lineTo(fx, grip ? 1.8 : 3);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(-1.7, 0.4, 0.6, 1.1, 0.5, 0, Math.PI * 2);
  fillPath(ctx, P.skin, 0.3);
  ctx.restore();
}

/** His right arm (viewer's left) holds the backpack strap at his chest. */
function drawStrapArm(ctx, stride) {
  const sway = stride * 0.4;
  // Both backpack straps over his shoulders, with buckles and adjusters.
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 6.4, -42.8);
    ctx.quadraticCurveTo(dir * 8.2, -34, dir * 9.8 + sway * 0.2, -22);
    ctx.lineTo(dir * 7.8 + sway * 0.2, -22);
    ctx.quadraticCurveTo(dir * 6.4, -34, dir * 4.6, -42.8);
    ctx.closePath();
    fillPath(ctx, P.bag, 0.4);
    rr(ctx, dir * 8 - 1.3 + sway * 0.2, -29.4, 2.6, 1.6, 0.3);
    fillPath(ctx, '#3a3c46', 0.25);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 0.18;
    ctx.setLineDash([0.4, 0.3]);
    ctx.beginPath();
    ctx.moveTo(dir * 5.6, -42);
    ctx.quadraticCurveTo(dir * 7.4, -34, dir * 8.8, -23);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // Reflective silver strips across both straps.
  for (const dir of [-1, 1]) {
    ctx.save();
    ctx.translate(dir * 7.4, -34);
    ctx.rotate(dir * 0.16);
    rr(ctx, -1.1, 0, 2.2, 0.7, 0.2);
    fillPath(ctx, '#d6dae4', 0.15);
    ctx.restore();
  }
  // A second pin lower on the left strap: a little green "A+".
  ctx.beginPath();
  ctx.arc(8.4, -26.6, 1.1, 0, Math.PI * 2);
  fillPath(ctx, '#3fb58f', 0.25);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 0.95px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('A+', 8.4, -26.5);
  // A round enamel pin badge on the right strap: a star.
  ctx.beginPath();
  ctx.arc(-7.4, -37, 1.25, 0, Math.PI * 2);
  fillPath(ctx, '#ffd166', 0.25);
  ctx.fillStyle = '#e8558f';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? 0.32 : 0.75;
    ctx.lineTo(-7.4 + Math.cos(a) * r, -37 + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  // The arm bends up, the hand gripping the strap.
  const shoulder = [-10.4, -38.6];
  const elbow = [-12.6, -28.4 - stride * 0.4];
  const wrist = [-8.8, -31.2];
  sleeve(ctx, shoulder, elbow, wrist);
  hand(ctx, -8.4, -32.2, 2.4, true);
  // A woven friendship bracelet in mint and pink.
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = i % 2 ? '#8fe3c8' : '#ff8fb8';
    ctx.beginPath();
    ctx.arc(-9.9 + i * 0.5, -30.6 + i * 0.14, 0.32, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** His left arm (viewer's right) swings, holding a ring of flashcards; a digital watch. */
function drawCardArm(ctx, stride, t) {
  const swing = stride * 3.8;
  const shoulder = [10.4, -38.6];
  const elbow = [12.4 + swing * 0.3, -28.4];
  const wrist = [12 + swing, -19.4];
  sleeve(ctx, shoulder, elbow, wrist);
  // The black digital watch.
  rr(ctx, wrist[0] - 1.8, wrist[1] - 0.6, 3.6, 1.6, 0.4);
  fillPath(ctx, '#1c1c22', 0.25);
  rr(ctx, wrist[0] - 1, wrist[1] - 0.35, 2, 1.1, 0.2);
  ctx.fillStyle = '#9fe3cc';
  ctx.fill();
  ctx.fillStyle = '#1c1c22';
  ctx.font = 'bold 0.7px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('23:00', wrist[0], wrist[1] + 0.2);
  ctx.fillStyle = '#3a3c46';
  for (const dx of [-1.95, 1.75]) ctx.fillRect(wrist[0] + dx, wrist[1] - 0.2, 0.2, 0.5);
  hand(ctx, wrist[0], wrist[1] + 0.8, swing * 0.04);
  // The vocab cards: a metal ring through a fanned stack, the top card
  // showing "단어 · word" and flipping now and then.
  ctx.save();
  ctx.translate(wrist[0] + 1.2, wrist[1] + 3.6);
  ctx.rotate(0.25 + swing * 0.03);
  for (let i = 3; i >= 0; i--) {
    ctx.save();
    ctx.rotate(i * 0.09);
    rr(ctx, -1.2, -0.6, 6, 3.6, 0.4);
    fillPath(ctx, ['#fffaf0', '#ffe9a8', '#cfeaff', '#ffd6e2'][i], 0.25);
    ctx.restore();
  }
  ctx.fillStyle = '#22305a';
  ctx.font = 'bold 0.9px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const flip = Math.floor(t / 2) % 2 === 0;
  ctx.fillText(flip ? '단어' : 'word', 1.8, 1.2);
  ctx.strokeStyle = '#c0c4cc';
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.arc(-0.6, 0.2, 0.8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// -- Head ---------------------------------------------------------------------------

const HEAD_Y = -55;
const EYE_Y = -54.2;

function facePath(ctx) {
  ctx.beginPath();
  ctx.moveTo(-9.6, HEAD_Y - 3);
  ctx.bezierCurveTo(-9.8, HEAD_Y - 14.4, 9.8, HEAD_Y - 14.4, 9.6, HEAD_Y - 3);
  // A slimmer, more defined V-jaw ("make him more handsome").
  ctx.bezierCurveTo(9.5, HEAD_Y + 3.6, 6.4, HEAD_Y + 8.6, 0, HEAD_Y + 11.2);
  ctx.bezierCurveTo(-6.4, HEAD_Y + 8.6, -9.5, HEAD_Y + 3.6, -9.6, HEAD_Y - 3);
  ctx.closePath();
}

function drawHead(ctx, t) {
  // Neck, ears.
  rr(ctx, -2.6, -46.4, 5.2, 5, 2);
  fillPath(ctx, P.skin, 0.4);
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(dir * 9.8, HEAD_Y + 0.8, 1.7, 2.7, dir * 0.1, 0, Math.PI * 2);
    fillPath(ctx, P.skin, 0.45);
    ctx.fillStyle = 'rgba(214,162,132,0.5)';
    ctx.beginPath();
    ctx.ellipse(dir * 9.8, HEAD_Y + 1, 0.6, 1.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  facePath(ctx);
  fillPath(ctx, P.skin, 0.55);
  ctx.save();
  facePath(ctx);
  ctx.clip();
  ctx.fillStyle = 'rgba(214,160,130,0.3)';
  ctx.beginPath();
  ctx.moveTo(6.4, HEAD_Y - 5);
  ctx.quadraticCurveTo(9.2, HEAD_Y + 2, 5.8, HEAD_Y + 7.6);
  ctx.quadraticCurveTo(3.4, HEAD_Y + 10.4, 0.8, HEAD_Y + 11.2);
  ctx.lineTo(10, HEAD_Y + 12);
  ctx.lineTo(10, HEAD_Y - 5);
  ctx.closePath();
  ctx.fill();
  const fringeShadow = ctx.createLinearGradient(0, HEAD_Y - 8, 0, HEAD_Y - 3);
  fringeShadow.addColorStop(0, 'rgba(214,160,130,0.5)');
  fringeShadow.addColorStop(1, 'rgba(214,160,130,0)');
  ctx.fillStyle = fringeShadow;
  ctx.fillRect(-10, HEAD_Y - 8, 20, 5);
  ctx.restore();

  drawEyes(ctx, isJihoBlinkingAt(t));
  // Straight, defined brows, tapering at the tail.
  ctx.fillStyle = P.hair;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 1.9, EYE_Y - 4.2);
    ctx.quadraticCurveTo(dir * 4.4, EYE_Y - 5.2, dir * 6.8, EYE_Y - 4.5);
    ctx.lineTo(dir * 6.6, EYE_Y - 4.1);
    ctx.quadraticCurveTo(dir * 4.4, EYE_Y - 4.5, dir * 2, EYE_Y - 3.4);
    ctx.closePath();
    ctx.fill();
  }
  // A defined nose: a soft bridge shadow and the tip.
  ctx.fillStyle = 'rgba(214,160,130,0.35)';
  ctx.beginPath();
  ctx.moveTo(0.4, EYE_Y + 0.4);
  ctx.lineTo(1.2, EYE_Y + 3.8);
  ctx.lineTo(0.5, EYE_Y + 3.8);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(200,130,110,0.65)';
  ctx.lineWidth = 0.42;
  ctx.beginPath();
  ctx.moveTo(1.1, EYE_Y + 3.4);
  ctx.quadraticCurveTo(0.9, EYE_Y + 4.6, -0.4, EYE_Y + 4.3);
  ctx.stroke();
  // A faint flush high on the cheeks.
  ctx.fillStyle = 'rgba(240,140,150,0.2)';
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(dir * 5.9, HEAD_Y + 3.2, 1.7, 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // A calm, closed half-smile and a soft lower-lip tint.
  ctx.strokeStyle = P.lips;
  ctx.lineWidth = 0.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-1.9, HEAD_Y + 6.6);
  ctx.quadraticCurveTo(0.2, HEAD_Y + 7.7, 2.1, HEAD_Y + 6.3);
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.fillStyle = 'rgba(207,138,130,0.3)';
  ctx.beginPath();
  ctx.ellipse(0.1, HEAD_Y + 7.8, 1.1, 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  // A soft jawline shadow under the chin.
  ctx.strokeStyle = 'rgba(214,160,130,0.45)';
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.moveTo(-3.4, HEAD_Y + 9.6);
  ctx.quadraticCurveTo(0, HEAD_Y + 10.8, 3.4, HEAD_Y + 9.6);
  ctx.stroke();
  ctx.fillStyle = 'rgba(60,40,36,0.7)';
  ctx.beginPath();
  ctx.arc(-4.4, HEAD_Y + 5.6, 0.22, 0, Math.PI * 2);
  ctx.fill();
  // A small plaster on his cheek (he fell asleep on his desk again).
  ctx.save();
  ctx.translate(6.2, HEAD_Y + 4.6);
  ctx.rotate(-0.3);
  rr(ctx, -1.4, -0.5, 2.8, 1, 0.4);
  fillPath(ctx, '#f2d2a8', 0.2);
  ctx.fillStyle = 'rgba(160,110,70,0.5)';
  for (const px of [-0.3, 0.3]) {
    ctx.beginPath();
    ctx.arc(px, 0, 0.08, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  drawHair(ctx, t);
  // One wired earphone in his left ear (viewer's right), its white cable
  // curling down into his hoodie collar.
  ctx.beginPath();
  ctx.ellipse(10.2, HEAD_Y + 1.6, 0.8, 0.9, 0, 0, Math.PI * 2);
  fillPath(ctx, '#ffffff', 0.25);
  ctx.strokeStyle = '#f4f4f2';
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.moveTo(10.2, HEAD_Y + 2.4);
  ctx.quadraticCurveTo(10.8, HEAD_Y + 6, 7.4, HEAD_Y + 9.4);
  ctx.quadraticCurveTo(5.4, HEAD_Y + 11.4, 4.4, -43);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(24,18,44,0.35)';
  ctx.lineWidth = 0.12;
  ctx.stroke();
}

function drawEyes(ctx, blinking) {
  for (const dir of [-1, 1]) {
    const ex = dir * 4.3;
    // Almond-shaped, the outer corner lifting a touch.
    const inner = [ex - dir * 2.6, EYE_Y + 0.5];
    const outer = [ex + dir * 2.8, EYE_Y - 0.3];
    if (blinking) {
      ctx.strokeStyle = '#1c1418';
      ctx.lineWidth = 0.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(inner[0], inner[1]);
      ctx.quadraticCurveTo(ex, EYE_Y + 1.2, outer[0], outer[1]);
      ctx.stroke();
      ctx.lineCap = 'butt';
      continue;
    }
    const shape = () => {
      ctx.beginPath();
      ctx.moveTo(inner[0], inner[1]);
      ctx.quadraticCurveTo(ex - dir * 0.2, EYE_Y - 2.6, outer[0], outer[1]);
      ctx.quadraticCurveTo(ex + dir * 0.6, EYE_Y + 2.1, inner[0], inner[1]);
      ctx.closePath();
    };
    shape();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.save();
    shape();
    ctx.clip();
    const g = ctx.createLinearGradient(0, EYE_Y - 2.2, 0, EYE_Y + 2.2);
    g.addColorStop(0, P.pupil);
    g.addColorStop(0.5, P.iris);
    g.addColorStop(1, P.irisLight);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(ex + dir * 0.1, EYE_Y, 1.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = P.pupil;
    ctx.beginPath();
    ctx.ellipse(ex + dir * 0.1, EYE_Y - 0.1, 0.85, 1, 0, 0, Math.PI * 2);
    ctx.fill();
    // Fine iris lines and a warmer lower crescent.
    ctx.strokeStyle = 'rgba(200,160,140,0.35)';
    ctx.lineWidth = 0.13;
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(ex + Math.cos(a) * 1.05, EYE_Y + Math.sin(a) * 1.15);
      ctx.lineTo(ex + Math.cos(a) * 1.75, EYE_Y + Math.sin(a) * 1.75);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(190,140,110,0.5)';
    ctx.lineWidth = 0.3;
    ctx.beginPath();
    ctx.arc(ex, EYE_Y, 1.45, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
    // The upper lid's soft shadow over the iris.
    ctx.fillStyle = 'rgba(40,20,20,0.12)';
    ctx.fillRect(ex - 3, EYE_Y - 2.8, 6, 1.2);
    ctx.restore();
    // A defined upper lash line that thickens toward the outer corner.
    ctx.fillStyle = '#1c1418';
    ctx.beginPath();
    ctx.moveTo(inner[0], inner[1] + 0.1);
    ctx.quadraticCurveTo(ex - dir * 0.2, EYE_Y - 2.9, outer[0] + dir * 0.3, outer[1] - 0.3);
    ctx.lineTo(outer[0] + dir * 0.1, outer[1] + 0.35);
    ctx.quadraticCurveTo(ex - dir * 0.2, EYE_Y - 2, inner[0], inner[1] + 0.55);
    ctx.closePath();
    ctx.fill();
    // The double-eyelid crease, and a faint lower lid.
    ctx.strokeStyle = 'rgba(150,92,72,0.45)';
    ctx.lineWidth = 0.28;
    ctx.beginPath();
    ctx.moveTo(ex - dir * 1.4, EYE_Y - 2.7);
    ctx.quadraticCurveTo(ex + dir * 0.6, EYE_Y - 3.5, outer[0] + dir * 0.2, outer[1] - 1.3);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(30,18,18,0.28)';
    ctx.lineWidth = 0.25;
    ctx.beginPath();
    ctx.moveTo(ex - dir * 0.8, EYE_Y + 1.7);
    ctx.quadraticCurveTo(ex + dir * 1, EYE_Y + 1.9, outer[0] - dir * 0.2, outer[1] + 0.8);
    ctx.stroke();
  }
}

function drawHair(ctx, t) {
  // Fluffy and messy: a cloud of rounded tufts over the crown, a tousled
  // fringe of tufts pointing every which way, side tufts flicking out over
  // the ears, and a bouncy cowlick.
  const Y = HEAD_Y;
  const bounce = Math.sin(t * 2.4) * 0.25;
  // The crown lobes: outlines first, then fills, so only the outer edge of
  // the cloud keeps a line.
  const lobes = [];
  for (let k = 0; k <= 10; k++) {
    const a = Math.PI * (1.08 + k * 0.084);
    const r = 3.4 + ((k * 7) % 4) * 0.35;
    lobes.push([Math.cos(a) * 10.4, Y - 4.4 + Math.sin(a) * 10.4 + (k % 2 ? bounce : 0), r]);
  }
  const crownBase = () => {
    ctx.beginPath();
    ctx.moveTo(-10.2, Y - 1);
    ctx.bezierCurveTo(-12.4, Y - 18.6, 12.4, Y - 18.6, 10.2, Y - 1);
    ctx.lineTo(9.8, Y - 6.4);
    ctx.quadraticCurveTo(0, Y - 12, -9.8, Y - 6.4);
    ctx.closePath();
  };
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1.1;
  for (const [x, y, r] of lobes) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  crownBase();
  ctx.stroke();
  const g = ctx.createLinearGradient(0, Y - 20, 0, Y - 4);
  g.addColorStop(0, P.hairMid);
  g.addColorStop(1, P.hair);
  ctx.fillStyle = g;
  for (const [x, y, r] of lobes) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  crownBase();
  ctx.fill();
  // Darker shading low in the crown, lighter curls and strands on top.
  ctx.save();
  crownBase();
  for (const [x, y, r] of lobes) ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  const shade = ctx.createLinearGradient(0, Y - 13, 0, Y - 5);
  shade.addColorStop(0, 'rgba(40,20,14,0)');
  shade.addColorStop(1, 'rgba(40,20,14,0.35)');
  ctx.fillStyle = shade;
  ctx.fillRect(-14, Y - 13, 28, 9);
  ctx.strokeStyle = 'rgba(160,110,80,0.55)';
  ctx.lineWidth = 0.32;
  for (const [x, y] of lobes) {
    ctx.beginPath();
    ctx.arc(x, y + 0.6, 1.8, Math.PI * 1.1, Math.PI * 1.75);
    ctx.stroke();
  }
  ctx.strokeStyle = P.hairShine;
  ctx.lineWidth = 0.9;
  for (const [x0, x1, y0] of [[-6.6, -2.4, -14.6], [0.6, 4.8, -15.4]]) {
    ctx.beginPath();
    ctx.moveTo(x0, Y + y0 + 1);
    ctx.quadraticCurveTo((x0 + x1) / 2, Y + y0 - 1, x1, Y + y0 + 0.6);
    ctx.stroke();
  }
  ctx.restore();
  // The tousled fringe: tufts of uneven length, leaning different ways;
  // the tips stop above the brows (two longer pieces just touch them).
  const tufts = [
    [-8.4, -10.8, -2.6], [-6, -7.6, -5.4], [-3.6, -5.2, -4.2], [-1.2, 0.2, -5.8],
    [1.2, 2.8, -4.4], [3.6, 5.8, -5.6], [6.2, 7.2, -4.6], [8.4, 10.6, -2.8],
  ];
  for (const [rx, tx, ty] of tufts) {
    const tipY = Y + ty + bounce * 0.4;
    ctx.beginPath();
    ctx.moveTo(rx - 2.4, Y - 10.6);
    ctx.quadraticCurveTo(rx - 1.6, Y + ty - 2.6, tx, tipY);
    ctx.quadraticCurveTo(rx + 1, Y + ty - 3, rx + 2.4, Y - 10.8);
    ctx.closePath();
    ctx.fillStyle = P.hair;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(rx - 1.9, Y + ty - 4.6);
    ctx.quadraticCurveTo(rx - 1.4, Y + ty - 1.8, tx, tipY);
    ctx.quadraticCurveTo(rx + 0.8, Y + ty - 2.2, rx + 1.9, Y + ty - 4.8);
    outline(ctx, 0.4);
    ctx.strokeStyle = 'rgba(160,110,80,0.5)';
    ctx.lineWidth = 0.25;
    ctx.beginPath();
    ctx.moveTo(rx, Y - 9.6);
    ctx.quadraticCurveTo(rx - 0.4, Y + ty - 2.6, tx * 0.6 + rx * 0.4, tipY - 1);
    ctx.stroke();
  }
  // A shadow the fringe casts on the forehead.
  ctx.fillStyle = 'rgba(150,90,70,0.16)';
  ctx.beginPath();
  ctx.ellipse(0, Y - 4.6, 8.6, 1.2, 0, 0, Math.PI * 2);
  ctx.fill();
  // Side tufts flicking out over the ears.
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 8.6, Y - 9);
    ctx.quadraticCurveTo(dir * 11.8, Y - 4, dir * 11.4, Y + 1);
    ctx.quadraticCurveTo(dir * 12.6, Y + 1.6, dir * 12.2, Y + 2.8);
    ctx.quadraticCurveTo(dir * 10.4, Y + 1.4, dir * 9.6, Y - 1);
    ctx.quadraticCurveTo(dir * 9, Y - 4, dir * 8, Y - 6);
    ctx.closePath();
    fillPath(ctx, P.hair, 0.4);
    ctx.strokeStyle = 'rgba(160,110,80,0.5)';
    ctx.lineWidth = 0.25;
    ctx.beginPath();
    ctx.moveTo(dir * 9.2, Y - 7);
    ctx.quadraticCurveTo(dir * 10.8, Y - 3, dir * 11.2, Y + 1);
    ctx.stroke();
  }
  // The cowlick: three springy tufts at the crown, bouncing.
  const bob = Math.sin(t * 3) * 0.4;
  ctx.strokeStyle = P.hair;
  ctx.lineWidth = 0.75;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(1, Y - 17.6);
  ctx.quadraticCurveTo(2, Y - 20 + bob, 3.8, Y - 19.4 + bob);
  ctx.moveTo(0.2, Y - 17.8);
  ctx.quadraticCurveTo(-0.4, Y - 20.2 + bob, 1, Y - 21 + bob);
  ctx.moveTo(-0.6, Y - 17.6);
  ctx.quadraticCurveTo(-2, Y - 19.4 + bob, -3, Y - 18.6 + bob);
  ctx.stroke();
  ctx.lineCap = 'butt';
}
