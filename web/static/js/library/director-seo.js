// Director Seo (서 관장), Library Shift's new head of library ("add a new
// detailed director": a young, stylish, modern man, seen in his office at
// clock-out). Dark-brown two-block hair with a comma fringe, warm brown
// eyes behind thin gold round glasses, a small silver hoop earring and a
// wireless earbud; a camel long
// coat (a silk pocket square, a gold flower brooch, loose belt ties) open
// over a black turtleneck with a thin silver chain, slim cropped charcoal
// trousers with a crease and a cuffed hem, white leather sneakers, a
// silver watch and a signet ring; he carries a tablet showing the
// library's stats. Detailed in layered flat shading, no eye highlights
// (like the game's other characters).
//
// Coordinates follow Hospital Shift's anime adult frame (feet at 0,
// shoulders about -40, face centre about -55), like kimono-himura.js.

const LINE = 'rgba(24,18,44,0.68)';

const P = {
  skin: '#f6d8c0',
  skinShade: '#e8bc9c',
  skinDeep: '#d29e80',
  hair: '#3a2620',
  hairMid: '#4e342a',
  hairShade: '#24160f',
  hairStrand: 'rgba(120,84,64,0.55)',
  iris: '#6a3e22',
  irisLight: '#a8703e',
  pupil: '#1e120c',
  coat: '#c99a62',
  coatShade: '#a97c48',
  coatDeep: '#8a6236',
  coatLight: '#dcb27e',
  turtleneck: '#24222a',
  turtleneckRib: '#36333e',
  trousers: '#3a3c46',
  trousersShade: '#2a2c34',
  sneaker: '#f8f8f6',
  sneakerShade: '#dcdde2',
  sole: '#c8cad2',
  silver: '#d6dae4',
  silverDeep: '#9ea4b2',
  tablet: '#2a2c34',
  screen: '#e6f2ff',
  lips: '#c87a72',
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

/** Whether he's blinking at time `t` (a quick blink every ~3.7 s). */
export function isDirectorBlinkingAt(t) {
  return ((t % 3.7) + 3.7) % 3.7 < 0.13;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - feet centre
 * @param {number} y - feet line
 * @param {{scale?: number, t?: number, walking?: boolean, walkAmount?: number}} [opts]
 *   walkAmount (0..1) blends between standing and walking; it overrides `walking`.
 */
export function drawDirectorSeo(ctx, x, y, opts = {}) {
  const k = (opts.scale ?? 1) * 1.06; // a touch taller than everyone else
  const t = opts.t ?? 0;
  // His walk cycle ("walk animation?", then "make it better"): `amount`
  // (0..1) eases him in and out of walking, so starting and stopping don't
  // snap. One cycle is two steps; `phase` drives the legs, a lagging phase
  // the coat, and he rises as his legs pass and dips on each heel strike.
  const amount = opts.walkAmount ?? (opts.walking ? 1 : 0);
  const phase = t * 6;
  const stride = Math.sin(phase) * amount;
  const bob = (1 - Math.abs(Math.sin(phase))) * 1.6 * amount;
  const breathe = Math.sin(t * 1.5) * 0.3 * (1 - amount);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);

  ctx.fillStyle = 'rgba(40,30,40,0.16)';
  ctx.beginPath();
  ctx.ellipse(0, 7, 14, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(0, -bob);
  const coatLag = Math.sin(phase - 0.7) * amount;
  drawCoatBack(ctx, coatLag);
  drawLegs(ctx, phase, amount);
  // The upper body counter-sways a touch against the hips.
  ctx.save();
  ctx.translate(0, -20);
  ctx.rotate(-stride * 0.025);
  ctx.translate(0, 20);
  drawTorso(ctx, breathe);
  drawCoatFront(ctx, coatLag);
  drawFreeArm(ctx, stride);
  drawTabletArm(ctx, t);
  // The head settles a beat after the body on each step.
  ctx.translate(0, Math.sin(phase * 2 - 0.9) * 0.35 * amount);
  drawHead(ctx, t);
  ctx.restore();
  ctx.restore();
}

// -- Legs and sneakers ------------------------------------------------------

const THIGH = 10.8;
const SHIN = 10.4;

/** One trouser segment from (x0,y0) to (x1,y1), `w0`/`w1` wide at each end. */
function trouserSegment(ctx, x0, y0, x1, y1, w0, w1, fill) {
  const a = Math.atan2(y1 - y0, x1 - x0) - Math.PI / 2;
  const c = Math.cos(a);
  const s2 = Math.sin(a);
  ctx.beginPath();
  ctx.moveTo(x0 - (w0 / 2) * c, y0 - (w0 / 2) * s2);
  ctx.lineTo(x0 + (w0 / 2) * c, y0 + (w0 / 2) * s2);
  ctx.lineTo(x1 + (w1 / 2) * c, y1 + (w1 / 2) * s2);
  ctx.lineTo(x1 - (w1 / 2) * c, y1 - (w1 / 2) * s2);
  ctx.closePath();
  fillPath(ctx, fill, 0.5);
}

function drawLegs(ctx, phase, amount) {
  const legs = [-1, 1].map((dir) => {
    const lp = phase + (dir < 0 ? 0 : Math.PI);
    // Hip swing; the knee bends as the leg swings forward (its "swing
    // phase"), straight while it carries his weight.
    const hip = Math.sin(lp) * 0.3 * amount;
    const knee = Math.max(0, Math.cos(lp)) ** 1.5 * 0.42 * amount;
    return { dir, lp, hip, knee };
  });
  // The leg further back is drawn first.
  legs.sort((a, b) => a.hip - b.hip);
  for (const { dir, lp, hip, knee } of legs) {
    const hx = dir * 3.9;
    const hy = -20;
    const kx = hx - Math.sin(hip) * THIGH;
    const ky = hy + Math.cos(hip) * THIGH;
    const shinAngle = hip - knee;
    const ax = kx - Math.sin(shinAngle) * SHIN;
    const ay = ky + Math.cos(shinAngle) * SHIN;
    const fill = dir < 0 ? P.trousers : P.trousersShade;
    trouserSegment(ctx, hx, hy, kx, ky, 7, 6.2, fill);
    trouserSegment(ctx, kx, ky, ax, ay, 6.2, 5.6, fill);
    // A pressed crease down the shin, and a knee fold while it's bent.
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.moveTo(kx, ky + 1);
    ctx.lineTo(ax, ay - 1);
    ctx.stroke();
    if (knee > 0.15) {
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.moveTo(kx - 2.2, ky - 0.4);
      ctx.quadraticCurveTo(kx, ky + 0.8, kx + 2.2, ky - 0.4);
      ctx.stroke();
    }
    // Heel-toe: the toe tips up as the heel strikes, the foot rolls off
    // the toe as it pushes away behind.
    const pitch = (Math.sin(lp) > 0 ? -Math.sin(lp) * 0.25 : -Math.sin(lp) * 0.35) * amount;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(Math.sin(lp) > 0 ? -pitch * 0.6 : pitch);
    // Cropped: a sliver of bare ankle above the sneaker, the turned-up
    // cuff sitting higher ("make him more stylish").
    rr(ctx, -2.2, -1.9, 4.4, 2.8, 0.8);
    fillPath(ctx, P.skin, 0.3);
    rr(ctx, -2.9, -3.4, 5.8, 1.7, 0.4);
    fillPath(ctx, P.trousersShade, 0.3);
    drawSneaker(ctx, 0, 1.4);
    ctx.restore();
  }
}

function drawSneaker(ctx, sx, lift) {
  const y0 = 1.6 - lift;
  // Sole, then the white leather upper with a rounded toe.
  rr(ctx, sx - 3.9, y0 + 3.6, 8.2, 1.7, 0.8);
  fillPath(ctx, P.sole, 0.4);
  ctx.beginPath();
  ctx.moveTo(sx - 3.7, y0 + 3.9);
  ctx.quadraticCurveTo(sx - 3.9, y0, sx - 1, y0 - 0.2);
  ctx.lineTo(sx + 1.4, y0 + 0.2);
  ctx.quadraticCurveTo(sx + 4.4, y0 + 1.2, sx + 4.1, y0 + 3.9);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, y0, 0, y0 + 4);
  g.addColorStop(0, P.sneaker);
  g.addColorStop(1, P.sneakerShade);
  fillPath(ctx, g, 0.45);
  // Laces, a heel tab and a little green brand dash.
  ctx.strokeStyle = 'rgba(80,84,96,0.6)';
  ctx.lineWidth = 0.22;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(sx - 1.2 + i * 0.8, y0 + 0.6);
    ctx.lineTo(sx - 0.2 + i * 0.8, y0 + 1.4);
    ctx.stroke();
  }
  rr(ctx, sx - 3.8, y0 + 0.6, 1, 1.8, 0.3);
  fillPath(ctx, '#2f6a4a', 0.15);
  ctx.strokeStyle = '#3fb58f';
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.moveTo(sx + 0.8, y0 + 2.8);
  ctx.quadraticCurveTo(sx + 2, y0 + 2.2, sx + 3.2, y0 + 2.6);
  ctx.stroke();
}

// -- Coat, turtleneck --------------------------------------------------------

/** The coat's back panel, seen behind the legs below the knee line. */
function drawCoatBack(ctx, stride) {
  const sway = stride * 2.4;
  ctx.beginPath();
  ctx.moveTo(-11.8, -36);
  ctx.lineTo(-13.4 + sway * 0.4, -7);
  ctx.quadraticCurveTo(0, -5.6, 13.4 + sway * 0.4, -7);
  ctx.lineTo(11.8, -36);
  ctx.closePath();
  fillPath(ctx, P.coatDeep, 0.55);
}

function drawTorso(ctx, breathe) {
  ctx.save();
  ctx.translate(0, -breathe * 0.4);
  // The black turtleneck, ribbed, filling the coat's opening.
  ctx.beginPath();
  ctx.moveTo(-5.4, -42);
  ctx.lineTo(5.4, -42);
  ctx.lineTo(6.4, -18);
  ctx.lineTo(-6.4, -18);
  ctx.closePath();
  fillPath(ctx, P.turtleneck, 0.5);
  ctx.strokeStyle = P.turtleneckRib;
  ctx.lineWidth = 0.3;
  for (let x = -5; x <= 5; x += 1.2) {
    ctx.beginPath();
    ctx.moveTo(x, -40);
    ctx.lineTo(x * 1.15, -19);
    ctx.stroke();
  }
  // The folded neck of the turtleneck.
  rr(ctx, -3.9, -46.6, 7.8, 4.4, 1.6);
  fillPath(ctx, P.turtleneck, 0.45);
  ctx.strokeStyle = P.turtleneckRib;
  for (let x = -3.2; x <= 3.2; x += 0.9) {
    ctx.beginPath();
    ctx.moveTo(x, -46.2);
    ctx.lineTo(x, -42.6);
    ctx.stroke();
  }
  // A thin silver chain with a small bar pendant.
  ctx.strokeStyle = P.silver;
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  ctx.moveTo(-3.6, -42.2);
  ctx.quadraticCurveTo(0, -35.6, 3.6, -42.2);
  ctx.stroke();
  rr(ctx, -0.35, -38.9, 0.7, 2.2, 0.3);
  fillPath(ctx, P.silver, 0.15);
  ctx.restore();
}

/** The open long coat: two front panels with lapels, pockets and buttons. */
function drawCoatFront(ctx, stride) {
  const sway = stride * 2.4;
  for (const dir of [-1, 1]) {
    const hem = dir * 13.6 + sway * 0.5;
    ctx.beginPath();
    ctx.moveTo(dir * 5.2, -43.2);
    ctx.quadraticCurveTo(dir * 11.8, -42.6, dir * 12.2, -36);
    ctx.lineTo(hem, -7);
    ctx.lineTo(dir * 6.4 + sway * 0.3, -6.6);
    ctx.lineTo(dir * 5.6, -24);
    ctx.lineTo(dir * 4.4, -33);
    ctx.closePath();
    const g = ctx.createLinearGradient(dir * 4, 0, dir * 13.6, 0);
    g.addColorStop(0, P.coatLight);
    g.addColorStop(0.45, P.coat);
    g.addColorStop(1, P.coatShade);
    fillPath(ctx, g, 0.6);
    // The notched lapel folding back from the collar.
    ctx.beginPath();
    ctx.moveTo(dir * 5.2, -43.2);
    ctx.lineTo(dir * 8.4, -41.8);
    ctx.lineTo(dir * 8, -37.6);
    ctx.lineTo(dir * 9.4, -36.4);
    ctx.lineTo(dir * 6.2, -27.6);
    ctx.lineTo(dir * 4.4, -33);
    ctx.closePath();
    fillPath(ctx, P.coatShade, 0.45);
    ctx.strokeStyle = 'rgba(90,60,30,0.45)';
    ctx.lineWidth = 0.18;
    ctx.setLineDash([0.4, 0.3]);
    ctx.beginPath();
    ctx.moveTo(dir * 5.8, -42.4);
    ctx.lineTo(dir * 7.6, -41.4);
    ctx.lineTo(dir * 7.3, -37.4);
    ctx.lineTo(dir * 8.5, -36.4);
    ctx.lineTo(dir * 6, -29.4);
    ctx.stroke();
    // Front edge stitching down the panel.
    ctx.beginPath();
    ctx.moveTo(dir * 6.6, -26);
    ctx.lineTo(dir * 7 + sway * 0.3, -8);
    ctx.stroke();
    ctx.setLineDash([]);
    // A flap pocket low on the panel.
    rr(ctx, dir * 8.2 - 2.6 + sway * 0.2, -16.6, 5.2, 1.4, 0.3);
    fillPath(ctx, P.coatShade, 0.3);
    // Two horn buttons on the right panel (viewer's left), loose on the other.
    if (dir < 0) {
      for (const by of [-25, -17.6]) {
        ctx.beginPath();
        ctx.arc(-7.4, by, 0.75, 0, Math.PI * 2);
        fillPath(ctx, '#4a3424', 0.2);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(-7.6, by - 0.2, 0.2, 0.2);
        ctx.fillRect(-7.2, by - 0.2, 0.2, 0.2);
      }
    } else {
      // The buttonholes on the open left panel.
      ctx.strokeStyle = 'rgba(90,60,30,0.6)';
      ctx.lineWidth = 0.3;
      for (const by of [-25, -17.6]) {
        ctx.beginPath();
        ctx.moveTo(6.8, by);
        ctx.lineTo(8.2, by);
        ctx.stroke();
      }
    }
    // Soft fold shadows down the coat.
    ctx.strokeStyle = 'rgba(90,60,30,0.28)';
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(dir * 10.6, -30);
    ctx.quadraticCurveTo(dir * 11.6, -18, dir * 12 + sway * 0.4, -8);
    ctx.stroke();
    // The coat's loose belt, untied, its ends hanging at each hip with a
    // metal-tipped end, swinging a little behind his stride.
    ctx.save();
    ctx.translate(dir * 11.2, -22.4);
    ctx.rotate(dir * 0.05 + sway * 0.03);
    rr(ctx, -1, 0, 2, 9.4, 0.5);
    fillPath(ctx, P.coatShade, 0.4);
    rr(ctx, -1, 8.6, 2, 1.2, 0.4);
    fillPath(ctx, P.silverDeep, 0.25);
    ctx.restore();
  }
  // A belt loop on each side, and the slit where the belt passes through.
  for (const dir of [-1, 1]) {
    rr(ctx, dir * 11.6 - 0.9, -23.6, 1.8, 2.4, 0.3);
    fillPath(ctx, P.coat, 0.3);
  }
  // A breast pocket on the right panel (viewer's left, clear of the tablet)
  // with a silk pocket square — burgundy with tiny gold dots — folded into
  // two points.
  rr(ctx, -9.4, -29.4, 3.4, 0.9, 0.2);
  fillPath(ctx, P.coatShade, 0.3);
  ctx.beginPath();
  ctx.moveTo(-9.2, -29.4);
  ctx.lineTo(-8.4, -31.6);
  ctx.lineTo(-7.7, -30.1);
  ctx.lineTo(-7, -31.9);
  ctx.lineTo(-6.2, -29.4);
  ctx.closePath();
  fillPath(ctx, '#8a2a3e', 0.3);
  ctx.fillStyle = '#e8c25a';
  for (const [dx, dy] of [[-8.3, -30.4], [-7.1, -30.7], [-7.6, -29.8]]) {
    ctx.beginPath();
    ctx.arc(dx, dy, 0.16, 0, Math.PI * 2);
    ctx.fill();
  }
  // A small gold flower brooch with a pearl centre on the right lapel.
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.ellipse(-7.6 + Math.cos(a) * 0.7, -36.4 + Math.sin(a) * 0.7, 0.55, 0.38, a, 0, Math.PI * 2);
    fillPath(ctx, '#e8c25a', 0.15);
  }
  ctx.beginPath();
  ctx.arc(-7.6, -36.4, 0.42, 0, Math.PI * 2);
  fillPath(ctx, '#fff6f0', 0.12);
}

// -- Arms ---------------------------------------------------------------------

function sleeve(ctx, shoulder, elbow, wrist) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 6.2;
  ctx.beginPath();
  ctx.moveTo(...shoulder);
  ctx.lineTo(...elbow);
  ctx.lineTo(...wrist);
  ctx.stroke();
  ctx.strokeStyle = P.coat;
  ctx.lineWidth = 5.1;
  ctx.stroke();
  ctx.strokeStyle = P.coatShade;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(shoulder[0] + 1.2, shoulder[1] + 1);
  ctx.lineTo(elbow[0] + 1.2, elbow[1]);
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
}

function drawHand(ctx, x, y, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.ellipse(0, 1, 1.9, 2.3, 0, 0, Math.PI * 2);
  fillPath(ctx, P.skin, 0.45);
  ctx.strokeStyle = P.skinDeep;
  ctx.lineWidth = 0.28;
  for (const fx of [-0.7, 0, 0.7]) {
    ctx.beginPath();
    ctx.moveTo(fx, 1.7);
    ctx.lineTo(fx, 3.1);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(-1.7, 0.4, 0.65, 1.2, 0.5, 0, Math.PI * 2);
  fillPath(ctx, P.skin, 0.32);
  ctx.restore();
}

/** His right arm (viewer's left) hangs and swings: a silver watch at the wrist. */
function drawFreeArm(ctx, stride) {
  const swing = -stride * 4.6;
  const shoulder = [-10.8, -38.4];
  const elbow = [-12.8 + swing * 0.35, -28];
  const bend = Math.max(0, swing) * 0.35; // forearm lifts a touch swinging forward
  const wrist = [-12.6 + swing * 1.1, -18.6 - bend];
  sleeve(ctx, shoulder, elbow, wrist);
  // The turtleneck cuff peeking out, then the watch and the hand.
  rr(ctx, wrist[0] - 2.2, wrist[1] - 1.4, 4.4, 1.5, 0.5);
  fillPath(ctx, P.turtleneck, 0.3);
  drawHand(ctx, wrist[0], wrist[1], swing * 0.04);
  // Two thin rings stacked on one finger.
  for (const dy of [2.5, 3]) {
    rr(ctx, wrist[0] + 0.2, wrist[1] + dy, 0.9, 0.32, 0.15);
    fillPath(ctx, dy < 2.8 ? P.silver : '#e8c25a', 0.1);
  }
  rr(ctx, wrist[0] - 2, wrist[1] - 0.4, 4, 1.2, 0.4);
  fillPath(ctx, P.silverDeep, 0.25);
  ctx.beginPath();
  ctx.arc(wrist[0] + 0.2, wrist[1] + 0.2, 1, 0, Math.PI * 2);
  fillPath(ctx, P.silver, 0.25);
  ctx.strokeStyle = '#2a2c34';
  ctx.lineWidth = 0.15;
  ctx.beginPath();
  ctx.moveTo(wrist[0] + 0.2, wrist[1] + 0.2);
  ctx.lineTo(wrist[0] + 0.2, wrist[1] - 0.5);
  ctx.moveTo(wrist[0] + 0.2, wrist[1] + 0.2);
  ctx.lineTo(wrist[0] + 0.7, wrist[1] + 0.3);
  ctx.stroke();
}

/** His left arm (viewer's right) holds a tablet against his side. */
function drawTabletArm(ctx, t) {
  const shoulder = [10.8, -38.4];
  const elbow = [13, -28];
  const wrist = [9.4, -22.6];
  // The tablet, tucked against him, its screen showing the day's stats.
  ctx.save();
  ctx.translate(8.6, -27.4);
  ctx.rotate(0.12);
  rr(ctx, -4.2, -5.6, 8.4, 11.2, 1);
  fillPath(ctx, P.tablet, 0.5);
  rr(ctx, -3.5, -4.9, 7, 9.8, 0.5);
  ctx.fillStyle = P.screen;
  ctx.fill();
  // A bar chart rising, and a pulse line that animates.
  const bars = [1.8, 2.8, 2.2, 3.6, 4.4];
  bars.forEach((h, i) => {
    ctx.fillStyle = i === bars.length - 1 ? '#3fb58f' : '#8fd3ff';
    ctx.fillRect(-2.8 + i * 1.25, 3.6 - h, 0.85, h);
  });
  ctx.strokeStyle = '#e8558f';
  ctx.lineWidth = 0.28;
  ctx.beginPath();
  for (let i = 0; i <= 12; i++) {
    const px = -2.9 + i * 0.5;
    const py = -2.6 + Math.sin(i * 0.9 + t * 3) * 0.7;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(42,44,52,0.55)';
  ctx.fillRect(-2.9, -4.3, 3.2, 0.4);
  ctx.restore();
  sleeve(ctx, shoulder, elbow, wrist);
  rr(ctx, wrist[0] - 1.6, wrist[1] - 1.6, 3.4, 1.5, 0.5);
  fillPath(ctx, P.turtleneck, 0.3);
  drawHand(ctx, wrist[0] - 0.4, wrist[1] + 0.2, 1.2);
  // A silver signet ring.
  rr(ctx, wrist[0] - 1.8, wrist[1] + 0.4, 0.9, 0.5, 0.2);
  fillPath(ctx, P.silver, 0.15);
}

// -- Head -----------------------------------------------------------------------

const HEAD_Y = -55;
const EYE_Y = -54.4;

function facePath(ctx) {
  ctx.beginPath();
  ctx.moveTo(-9.4, HEAD_Y - 3);
  ctx.bezierCurveTo(-9.6, HEAD_Y - 14, 9.6, HEAD_Y - 14, 9.4, HEAD_Y - 3);
  ctx.bezierCurveTo(9.4, HEAD_Y + 4, 5.6, HEAD_Y + 10, 0, HEAD_Y + 11.4);
  ctx.bezierCurveTo(-5.6, HEAD_Y + 10, -9.4, HEAD_Y + 4, -9.4, HEAD_Y - 3);
  ctx.closePath();
}

function drawHead(ctx, t) {
  // Undercut sides and back of the head, then ears.
  ctx.fillStyle = P.hairShade;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(dir * 8.6, HEAD_Y - 2.6, 1.8, 4.6, dir * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(dir * 9.6, HEAD_Y + 0.6, 1.7, 2.7, dir * 0.1, 0, Math.PI * 2);
    fillPath(ctx, P.skin, 0.45);
    ctx.strokeStyle = P.skinDeep;
    ctx.lineWidth = 0.32;
    ctx.beginPath();
    ctx.arc(dir * 9.6, HEAD_Y + 0.6, 0.95, dir < 0 ? 0.6 * Math.PI : -0.4 * Math.PI, dir < 0 ? 1.4 * Math.PI : 0.4 * Math.PI);
    ctx.stroke();
  }
  // A silver hoop in his left ear (viewer's right), a white earbud in his right.
  ctx.strokeStyle = P.silver;
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.arc(10.2, HEAD_Y + 3.2, 0.75, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(-9.8, HEAD_Y + 1, 0.8, 0.95, 0, 0, Math.PI * 2);
  fillPath(ctx, '#ffffff', 0.25);
  rr(ctx, -10.1, HEAD_Y + 1.6, 0.6, 1.8, 0.3);
  fillPath(ctx, '#ffffff', 0.2);

  facePath(ctx);
  fillPath(ctx, P.skin, 0.55);
  ctx.save();
  facePath(ctx);
  ctx.clip();
  // Cel shading down the far cheek and jaw, and under the fringe.
  ctx.fillStyle = 'rgba(214,160,130,0.32)';
  ctx.beginPath();
  ctx.moveTo(6.2, HEAD_Y - 5);
  ctx.quadraticCurveTo(9, HEAD_Y + 2, 5.6, HEAD_Y + 7.6);
  ctx.quadraticCurveTo(3.4, HEAD_Y + 10.6, 0.8, HEAD_Y + 11.6);
  ctx.lineTo(10, HEAD_Y + 12);
  ctx.lineTo(10, HEAD_Y - 5);
  ctx.closePath();
  ctx.fill();
  const fringeShadow = ctx.createLinearGradient(0, HEAD_Y - 10, 0, HEAD_Y - 5);
  fringeShadow.addColorStop(0, 'rgba(214,160,130,0.45)');
  fringeShadow.addColorStop(1, 'rgba(214,160,130,0)');
  ctx.fillStyle = fringeShadow;
  ctx.fillRect(-10, HEAD_Y - 10, 20, 5);
  ctx.restore();

  drawEyes(ctx, isDirectorBlinkingAt(t));
  // Straight, groomed brows (the left one partly under the fringe).
  ctx.fillStyle = P.hair;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 2, EYE_Y - 4.4);
    ctx.lineTo(dir * 6.6, EYE_Y - 5.1);
    ctx.lineTo(dir * 6.8, EYE_Y - 4.5);
    ctx.lineTo(dir * 2.1, EYE_Y - 3.7);
    ctx.closePath();
    ctx.fill();
  }
  // Thin gold round glasses, the lenses faintly tinted.
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(dir * 4.3, EYE_Y - 0.1, 3.1, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(200,170,120,0.1)';
    ctx.fill();
    ctx.strokeStyle = '#c9a24a';
    ctx.lineWidth = 0.42;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-1.3, EYE_Y - 0.6);
  ctx.quadraticCurveTo(0, EYE_Y - 1.5, 1.3, EYE_Y - 0.6);
  ctx.moveTo(-7.4, EYE_Y - 0.4);
  ctx.lineTo(-9.4, EYE_Y - 1.4);
  ctx.moveTo(7.4, EYE_Y - 0.4);
  ctx.lineTo(9.4, EYE_Y - 1.4);
  ctx.stroke();
  // Nose: a bridge shadow and a soft tip.
  ctx.strokeStyle = 'rgba(200,130,110,0.6)';
  ctx.lineWidth = 0.45;
  ctx.beginPath();
  ctx.moveTo(0.8, EYE_Y + 0.6);
  ctx.lineTo(1.2, EYE_Y + 4);
  ctx.quadraticCurveTo(0.6, EYE_Y + 4.8, -0.4, EYE_Y + 4.4);
  ctx.stroke();
  // A confident half-smile.
  ctx.strokeStyle = P.lips;
  ctx.lineWidth = 0.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-1.8, HEAD_Y + 6.6);
  ctx.quadraticCurveTo(0.4, HEAD_Y + 7.6, 2.4, HEAD_Y + 6.2);
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.fillStyle = 'rgba(200,120,110,0.22)';
  ctx.beginPath();
  ctx.ellipse(0.3, HEAD_Y + 7.6, 1.1, 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  drawHair(ctx);
}

function drawEyes(ctx, blinking) {
  for (const dir of [-1, 1]) {
    const ex = dir * 4.3;
    const inner = [ex - dir * 2.6, EYE_Y + 0.4];
    const outer = [ex + dir * 2.9, EYE_Y - 0.3];
    if (blinking) {
      ctx.strokeStyle = '#1e140f';
      ctx.lineWidth = 0.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(inner[0], inner[1]);
      ctx.quadraticCurveTo(ex, EYE_Y + 0.8, outer[0], outer[1]);
      ctx.stroke();
      ctx.lineCap = 'butt';
      continue;
    }
    const shape = () => {
      ctx.beginPath();
      ctx.moveTo(inner[0], inner[1]);
      ctx.quadraticCurveTo(ex - dir * 0.3, EYE_Y - 2.6, outer[0], outer[1]);
      ctx.quadraticCurveTo(ex + dir * 0.8, EYE_Y + 1.9, inner[0], inner[1]);
      ctx.closePath();
    };
    shape();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.save();
    shape();
    ctx.clip();
    const g = ctx.createLinearGradient(0, EYE_Y - 2, 0, EYE_Y + 2);
    g.addColorStop(0, P.pupil);
    g.addColorStop(0.5, P.iris);
    g.addColorStop(1, P.irisLight);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(ex + dir * 0.1, EYE_Y - 0.1, 1.95, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = P.pupil;
    ctx.beginPath();
    ctx.ellipse(ex + dir * 0.1, EYE_Y - 0.2, 0.85, 1.05, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,180,0.35)';
    ctx.lineWidth = 0.13;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(ex + Math.cos(a) * 1.05, EYE_Y + Math.sin(a) * 1.15);
      ctx.lineTo(ex + Math.cos(a) * 1.8, EYE_Y + Math.sin(a) * 1.8);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(30,14,14,0.22)';
    ctx.fillRect(ex - 3, EYE_Y - 3, 6, 1.6);
    ctx.restore();
    // Upper lash line, slightly heavier at the outer corner.
    ctx.fillStyle = '#1e140f';
    ctx.beginPath();
    ctx.moveTo(inner[0], inner[1] + 0.1);
    ctx.quadraticCurveTo(ex - dir * 0.4, EYE_Y - 3.1, outer[0] + dir * 0.4, outer[1] - 0.4);
    ctx.lineTo(outer[0] + dir * 0.2, outer[1] + 0.4);
    ctx.quadraticCurveTo(ex - dir * 0.4, EYE_Y - 2, inner[0], inner[1] + 0.6);
    ctx.closePath();
    ctx.fill();
    // Lower lid and a soft crease above.
    ctx.strokeStyle = 'rgba(30,18,18,0.3)';
    ctx.lineWidth = 0.26;
    ctx.beginPath();
    ctx.moveTo(ex - dir * 1, EYE_Y + 1.6);
    ctx.quadraticCurveTo(ex + dir * 1, EYE_Y + 1.9, outer[0] - dir * 0.2, outer[1] + 0.8);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(150,92,72,0.35)';
    ctx.beginPath();
    ctx.moveTo(ex - dir * 1.6, EYE_Y - 2.9);
    ctx.quadraticCurveTo(ex + dir * 0.6, EYE_Y - 3.5, outer[0] + dir * 0.3, outer[1] - 1.5);
    ctx.stroke();
  }
}

function drawHair(ctx) {
  // The crown: a full, glossy top swept from left to right.
  ctx.beginPath();
  ctx.moveTo(-9.6, HEAD_Y - 2);
  ctx.bezierCurveTo(-11.8, HEAD_Y - 20.4, 11.6, HEAD_Y - 21, 9.8, HEAD_Y - 3.6);
  ctx.lineTo(8.4, HEAD_Y - 6.4);
  ctx.quadraticCurveTo(4, HEAD_Y - 9.4, -1, HEAD_Y - 8.2);
  ctx.quadraticCurveTo(-6, HEAD_Y - 7.6, -8.6, HEAD_Y - 4.6);
  ctx.closePath();
  const g = ctx.createLinearGradient(-10, HEAD_Y - 16, 10, HEAD_Y - 4);
  g.addColorStop(0, P.hairMid);
  g.addColorStop(1, P.hair);
  fillPath(ctx, g, 0.55);
  // Strand lines and a soft sheen, kept inside the crown.
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = P.hairStrand;
  ctx.lineWidth = 0.32;
  for (const [x0, y0, cx, cy, x1, y1] of [
    [-7, -12, -2, -15, 5, -12.6],
    [-5, -10, 0, -13.2, 7, -10],
    [-8, -8.4, -4, -11.4, 2, -10.6],
    [-2, -13.6, 3, -14.4, 8, -11],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x0, HEAD_Y + y0);
    ctx.quadraticCurveTo(cx, HEAD_Y + cy, x1, HEAD_Y + y1);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(190,150,120,0.5)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(-4.4, HEAD_Y - 14.2);
  ctx.quadraticCurveTo(0, HEAD_Y - 16.2, 4.6, HEAD_Y - 14.4);
  ctx.stroke();
  ctx.restore();
  // The comma fringe: a lock curling down over his right brow.
  ctx.beginPath();
  ctx.moveTo(-6.6, HEAD_Y - 8);
  ctx.quadraticCurveTo(-8.6, HEAD_Y - 4.6, -6.4, HEAD_Y - 2.2);
  ctx.quadraticCurveTo(-5.2, HEAD_Y - 1.2, -4.4, HEAD_Y - 2.6);
  ctx.quadraticCurveTo(-5.6, HEAD_Y - 3.4, -5, HEAD_Y - 5);
  ctx.quadraticCurveTo(-3, HEAD_Y - 8.4, 1.2, HEAD_Y - 9.2);
  ctx.closePath();
  fillPath(ctx, P.hair, 0.45);
  // Two smaller locks across the forehead.
  for (const [x0, x1, y1] of [[-1, 2.6, -6.2], [3.2, 6.4, -5.6]]) {
    ctx.beginPath();
    ctx.moveTo(x0, HEAD_Y - 8.8);
    ctx.quadraticCurveTo(x1 - 1.4, HEAD_Y - 7.6, x1 - 0.2, HEAD_Y + y1);
    ctx.quadraticCurveTo(x1 + 0.6, HEAD_Y + y1 - 0.2, x1 + 0.9, HEAD_Y - 7.4);
    ctx.quadraticCurveTo(x1 + 1, HEAD_Y - 8.4, x1 + 1.8, HEAD_Y - 8.8);
    ctx.closePath();
    fillPath(ctx, P.hair, 0.4);
  }
}
