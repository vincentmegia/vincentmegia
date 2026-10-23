// Library Shift's manual checkout ("make it harder like for the barcode add
// a scanner where you have to do it manually and scan it, then move on
// where you have to write, and then add a circle skillcheck"). Three
// steps, all in the Front Desk overlay:
//
//   1. scan  — aim a handheld scanner at the barcode on the book's back
//              cover. The book drifts on the counter; the laser has to sit
//              on the barcode, steady, until the beep fills up.
//   2. write — write the due date on the slip ("for due date make it to
//              actually write something"): trace each digit's strokes from
//              their start dots. Straying off a stroke smudges it, and that
//              stroke starts over.
//   3. stamp — a needle spins round a dial; stop it inside the small target
//              arc. A miss is a mistake and the target jumps elsewhere.
//
// Pure and DOM-free (the game draws it and feeds it pointer/keyboard
// input), so it's covered by node --test. Positions are canvas/world
// pixels (the 960×600 world); angles are radians, clockwise from 12
// o'clock.

export const CHECKOUT_STEPS = ['scan', 'write', 'stamp'];

// -- 1. Scan --------------------------------------------------------------------

/** The book's back cover on the counter (before it drifts). */
export const SCAN_BOOK = { x: 360, y: 214, w: 240, h: 252 };
/** How close the laser's centre must be to the barcode's centre. */
export const SCAN_RADIUS = 11;
/** How fast the scanner may be moving and still count as steady (px/s). */
export const SCAN_STEADY_SPEED = 80;
/** Seconds held on target, steady, before it beeps. */
export const SCAN_HOLD_SECONDS = 0.9;
/** Off target, the hold drains this many times faster than it fills. */
export const SCAN_DRAIN_RATE = 2;
/** How far (px) the book drifts round on the counter. */
export const SCAN_DRIFT = 12;

/** The book's drift at time `t`: a slow, lopsided wander. */
export function bookDrift(t) {
  return { dx: Math.sin(t * 0.9) * SCAN_DRIFT, dy: Math.cos(t * 0.63) * SCAN_DRIFT * 0.7 };
}

/** Where the barcode's centre is at time `t`. */
export function barcodePosition(scene, t) {
  const { dx, dy } = bookDrift(t);
  return { x: SCAN_BOOK.x + scene.barcode.x + dx, y: SCAN_BOOK.y + scene.barcode.y + dy };
}

// -- 2. Write --------------------------------------------------------------------
//
// The due date, written for real: each character is a handful of pen
// strokes (a simple handwriting "stroke font" in a 0..1 box), laid out
// across the slip, and each stroke is traced from its start dot. Lifting
// the pen between strokes is fine; straying off the stroke you're on
// smudges it and that stroke starts over.

/** The due-date slip the date is written on. */
export const WRITE_SLIP = { x: 250, y: 250, w: 460, h: 210 };
/** How close the pen must come to the next point of a stroke to ink it. */
export const WRITE_REACH = 13;
/** How far from the stroke the pen may stray before the ink smudges. */
export const WRITE_OFF_LINE = 20;
/** Spacing (px) between the points a stroke is sampled into. */
export const WRITE_SPACING = 8;
/** A character's height on the slip (px); widths are relative to it. */
const GLYPH_H = 92;
const GLYPH_W = 0.62;
const GLYPH_GAP = 0.2;

/** Points round an ellipse arc in the glyph box: centre (cx, cy), radii, from/to angle (radians, 0 = right, clockwise). */
function arc(cx, cy, rx, ry, from, to, n = 10) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = from + ((to - from) * i) / n;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return pts;
}

const PI = Math.PI;

/**
 * Each character's strokes, as polylines in a GLYPH_W × 1 box (y down), in
 * the order a hand writes them.
 */
export const GLYPHS = {
  0: [arc(0.31, 0.5, 0.27, 0.48, -PI / 2, PI * 1.5, 16)],
  1: [[[0.12, 0.22], [0.34, 0], [0.34, 1]]],
  2: [[...arc(0.31, 0.27, 0.25, 0.25, PI * 1.05, PI * 2.15, 8), [0.06, 1], [0.6, 1]]],
  3: [[...arc(0.3, 0.25, 0.24, 0.24, PI * 1.15, PI * 2.5, 8), ...arc(0.3, 0.74, 0.27, 0.26, -PI / 2, PI * 0.85, 9)]],
  4: [[[0.4, 0], [0.02, 0.66], [0.62, 0.66]], [[0.46, 0.3], [0.46, 1]]],
  5: [[[0.56, 0.02], [0.12, 0.02], [0.07, 0.46], ...arc(0.3, 0.7, 0.27, 0.29, -PI * 0.75, PI * 0.85, 10)]],
  6: [[[0.5, 0.04], [0.2, 0.36], ...arc(0.31, 0.7, 0.26, 0.29, PI * 1.05, PI * 3.05, 14)]],
  7: [[[0.02, 0.02], [0.6, 0.02], [0.22, 1]]],
  8: [[...arc(0.31, 0.26, 0.22, 0.24, PI / 2, PI * 2.5, 12), ...arc(0.31, 0.74, 0.27, 0.26, -PI / 2, PI * 1.5, 14)]],
  9: [[...arc(0.31, 0.3, 0.26, 0.29, PI * 0.05, PI * 2.05, 14), [0.52, 0.62], [0.36, 1]]],
  '/': [[[0.52, 0], [0.1, 1]]],
};

/** Resamples a polyline at about every `spacing` px along its length. */
function resample(points, spacing) {
  const out = [points[0]];
  let carry = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    let d = spacing - carry;
    while (d <= len) {
      out.push({ x: a.x + ((b.x - a.x) * d) / len, y: a.y + ((b.y - a.y) * d) / len });
      d += spacing;
    }
    carry = len - (d - spacing);
  }
  const last = points[points.length - 1];
  if (Math.hypot(last.x - out[out.length - 1].x, last.y - out[out.length - 1].y) > spacing * 0.3) out.push(last);
  return out;
}

/**
 * The strokes for writing `text` (digits and "/") centred on the slip,
 * each sampled every WRITE_SPACING px.
 *
 * @param {string} text
 * @returns {{x: number, y: number}[][]}
 */
export function dueDateStrokes(text) {
  const chars = [...text].filter((c) => GLYPHS[c]);
  const width = (chars.length * GLYPH_W + (chars.length - 1) * GLYPH_GAP) * GLYPH_H;
  const left = WRITE_SLIP.x + (WRITE_SLIP.w - width) / 2;
  const top = WRITE_SLIP.y + 74;
  const strokes = [];
  chars.forEach((c, i) => {
    const ox = left + i * (GLYPH_W + GLYPH_GAP) * GLYPH_H;
    for (const stroke of GLYPHS[c]) {
      strokes.push(resample(stroke.map(([gx, gy]) => ({ x: ox + gx * GLYPH_H, y: top + gy * GLYPH_H })), WRITE_SPACING));
    }
  });
  return strokes;
}

/**
 * The due date `days` after `today`, as "M/D" (the slip's date).
 *
 * @param {Date} today
 * @param {number} [days]
 * @returns {string}
 */
export function dueDateText(today, days = 14) {
  const due = new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);
  return `${due.getMonth() + 1}/${due.getDate()}`;
}

// -- 3. Stamp (circle skill check) -------------------------------------------------

/** Where the dial is drawn. */
export const STAMP_DIAL = { x: 480, y: 360, r: 92 };
/** The target arc's width (radians, ≈ 32°). */
export const STAMP_ARC = 0.56;
/** The needle's base speed (radians/s, ≈ 0.5 turns a second). */
export const STAMP_SPEED = 3.2;

const TAU = Math.PI * 2;

/** A target arc start somewhere away from the needle's position `from`, so it's never already on it. */
function stampTarget(rand, from = 0) {
  const offset = Math.PI * 0.5 + rand() * Math.PI * 1.1;
  return ((from + offset) % TAU + TAU) % TAU;
}

/** Whether `angle` is inside the arc starting at `start`, `width` wide. */
export function inArc(angle, start, width) {
  const d = ((angle - start) % TAU + TAU) % TAU;
  return d <= width;
}

// -- The checkout ------------------------------------------------------------

/**
 * A fresh checkout, at the scan step.
 *
 * @param {() => number} rand
 * @param {{zoneScale?: number, speedScale?: number, dueText?: string}} [opts] - zoneScale
 *   shrinks the scan radius, the writing tolerance and the stamp arc (shaky
 *   hands); speedScale speeds the stamp needle (later shifts, shaky hands);
 *   dueText is the date written on the slip ("M/D", see dueDateText).
 */
export function createCheckout(rand, { zoneScale = 1, speedScale = 1, dueText = '1/1' } = {}) {
  return {
    step: 'scan',
    zoneScale,
    speedScale,
    // The barcode, somewhere along the bottom band of the back cover (the
    // description fills the rest).
    barcode: { x: 52 + rand() * (SCAN_BOOK.w - 104), y: SCAN_BOOK.h * 0.8 + rand() * SCAN_BOOK.h * 0.04 },
    scanHold: 0,
    scanner: null,
    dueText,
    strokes: dueDateStrokes(dueText),
    stroke: 0,
    inked: 0,
    penDown: false,
    smudges: 0,
    needle: 0,
    target: stampTarget(rand, 0),
    misses: 0,
  };
}

/**
 * The scan step for one frame: `scanner` is where the laser's centre is
 * now (or null when the pointer is off the canvas), `t` the overlay's
 * clock. On target and steady, the hold fills; otherwise it drains. When it
 * fills, the step moves on to writing.
 */
export function updateScan(scene, scanner, dt, t) {
  if (scene.step !== 'scan') return scene;
  const prev = scene.scanner;
  const speed = scanner && prev && dt > 0 ? Math.hypot(scanner.x - prev.x, scanner.y - prev.y) / dt : 0;
  const code = barcodePosition(scene, t);
  const onTarget = Boolean(scanner) && Math.hypot(scanner.x - code.x, scanner.y - code.y) <= SCAN_RADIUS * scene.zoneScale;
  const steady = speed <= SCAN_STEADY_SPEED;
  const hold = onTarget && steady
    ? scene.scanHold + dt
    : Math.max(0, scene.scanHold - dt * SCAN_DRAIN_RATE);
  if (hold >= SCAN_HOLD_SECONDS) return { ...scene, step: 'write', scanHold: SCAN_HOLD_SECONDS, scanner };
  return { ...scene, scanHold: hold, scanner, onTarget };
}

/** Distance from `p` to the nearest of `path[from..to]`. */
function nearest(path, p, from, to) {
  let best = Infinity;
  for (let i = Math.max(0, from); i <= Math.min(path.length - 1, to); i++) best = Math.min(best, Math.hypot(path[i].x - p.x, path[i].y - p.y));
  return best;
}

/**
 * The write step for one pen sample: `pen` is the pen's position, `down`
 * whether it's pressed. A stroke starts by touching its first point; then
 * each next point the pen comes within reach of is inked. Straying off the
 * stroke with the pen down smudges it (`smudged: true` for that sample) and
 * that stroke starts over. Finishing a stroke moves to the next (lift the
 * pen or not); finishing the last moves on to stamping.
 */
export function updateWrite(scene, pen, down) {
  if (scene.step !== 'write') return scene;
  if (!down || !pen) return { ...scene, penDown: false, smudged: false };
  const reach = WRITE_REACH * scene.zoneScale + 4;
  const off = WRITE_OFF_LINE * scene.zoneScale + 4;
  const path = scene.strokes[scene.stroke];
  let inked = scene.inked;
  if (inked === 0) {
    if (Math.hypot(pen.x - path[0].x, pen.y - path[0].y) > reach) return { ...scene, penDown: true, smudged: false };
    inked = 1;
  } else if (nearest(path, pen, inked - 2, inked + 2) > off) {
    return { ...scene, inked: 0, penDown: true, smudges: scene.smudges + 1, smudged: true };
  }
  while (inked < path.length && Math.hypot(pen.x - path[inked].x, pen.y - path[inked].y) <= reach) inked++;
  if (inked < path.length) return { ...scene, inked, penDown: true, smudged: false };
  const next = scene.stroke + 1;
  if (next >= scene.strokes.length) return { ...scene, stroke: next, inked: 0, step: 'stamp', penDown: false, smudged: false };
  return { ...scene, stroke: next, inked: 0, penDown: true, smudged: false };
}

/** How much of the date is written, 0..1 (by points inked). */
export function writeProgress(scene) {
  const total = scene.strokes.reduce((n, st) => n + st.length, 0);
  const done = scene.strokes.slice(0, scene.stroke).reduce((n, st) => n + st.length, 0) + scene.inked;
  return total ? Math.min(1, done / total) : 1;
}

/** The stamp step's needle, turning for `dt` seconds. */
export function updateStamp(scene, dt) {
  if (scene.step !== 'stamp') return scene;
  return { ...scene, needle: (scene.needle + STAMP_SPEED * scene.speedScale * dt) % TAU };
}

/** The stamp's target arc width, after shaky hands. */
export function stampArcWidth(scene) {
  return STAMP_ARC * scene.zoneScale;
}

/**
 * Stops the needle: inside the arc, the checkout is done (`step: 'done'`);
 * outside it, a miss — the target jumps somewhere else.
 *
 * @returns {{scene: object, hit: boolean}}
 */
export function pressStamp(scene, rand) {
  if (scene.step !== 'stamp') return { scene, hit: false };
  if (inArc(scene.needle, scene.target, stampArcWidth(scene))) return { scene: { ...scene, step: 'done' }, hit: true };
  return { scene: { ...scene, target: stampTarget(rand, scene.needle), misses: scene.misses + 1 }, hit: false };
}
