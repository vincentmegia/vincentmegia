// Shared drawing pieces for Library Shift's detailed staff renderers
// (security.js, volunteer.js, janitor.js, shelver.js, storyteller.js,
// archivist.js — "make others more detailed like them", i.e. like Min-jun,
// Ji-ho and Director Seo). Each of those draws its own outfit, hair and
// props; this holds what they'd otherwise each copy: outlines, tapered
// limbs, the walk cycle's leg poses, sleeves, hands, the face shape and
// the eyes. Pure canvas calls, testable with a fake context.
//
// Coordinates follow Hospital Shift's anime adult frame (feet at 0, hips
// about -20, shoulders about -38, face centre about -55), like
// director-seo.js.

export const LINE = 'rgba(24,18,44,0.68)';

export function outline(ctx, width = 0.55) {
  ctx.strokeStyle = LINE;
  ctx.lineWidth = width;
  ctx.stroke();
}

export function fillPath(ctx, fill, line = 0.55) {
  ctx.fillStyle = fill;
  ctx.fill();
  if (line > 0) outline(ctx, line);
}

export function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function dot(ctx, x, y, r, fill, line = 0) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  fillPath(ctx, fill, line);
}

/** A quick blink every `period` seconds; `offset` keeps two people out of step. */
export function isBlinkingAt(t, period, offset = 0) {
  const p = (((t + offset) % period) + period) % period;
  return p < 0.13;
}

/**
 * The walk cycle at time `t`: `freq` matches the walker's walk-styles.js
 * rhythm, so the legs land on the body's bob. One cycle is two steps.
 *
 * @returns {{phase: number, amount: number, stride: number, breathe: number}}
 */
export function walkCycle(t, freq, walking) {
  const amount = walking ? 1 : 0;
  const phase = t * freq;
  return {
    phase,
    amount,
    stride: Math.sin(phase) * amount,
    breathe: Math.sin(t * 1.5) * 0.3 * (1 - amount),
  };
}

export function groundShadow(ctx, w = 14) {
  ctx.fillStyle = 'rgba(40,30,40,0.16)';
  ctx.beginPath();
  ctx.ellipse(0, 7, w, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** One tapered limb segment from (x0,y0) to (x1,y1), `w0`/`w1` wide at each end. */
export function limbSegment(ctx, x0, y0, x1, y1, w0, w1, fill, line = 0.5) {
  const a = Math.atan2(y1 - y0, x1 - x0) - Math.PI / 2;
  const c = Math.cos(a);
  const s = Math.sin(a);
  ctx.beginPath();
  ctx.moveTo(x0 - (w0 / 2) * c, y0 - (w0 / 2) * s);
  ctx.lineTo(x0 + (w0 / 2) * c, y0 + (w0 / 2) * s);
  ctx.lineTo(x1 + (w1 / 2) * c, y1 + (w1 / 2) * s);
  ctx.lineTo(x1 - (w1 / 2) * c, y1 - (w1 / 2) * s);
  ctx.closePath();
  fillPath(ctx, fill, line);
}

/**
 * Both legs' joints for the walk `phase`, back leg first (draw in order).
 * The hip swings, the knee bends while the leg swings forward and stays
 * straight while it carries the weight; `pitch` rolls the foot heel-to-toe.
 * `swing`/`bend` scale the stride (an elder shuffles, a skipper kicks).
 *
 * @returns {{dir: number, hip: number[], knee: number[], ankle: number[], bend: number, pitch: number}[]}
 */
export function legPoses(phase, amount, { hipX = 3.9, hipY = -20, thigh = 10.8, shin = 10.4, swing = 0.3, bend = 0.42 } = {}) {
  const legs = [-1, 1].map((dir) => {
    const lp = phase + (dir < 0 ? 0 : Math.PI);
    const hipA = Math.sin(lp) * swing * amount;
    const kneeA = Math.max(0, Math.cos(lp)) ** 1.5 * bend * amount;
    const hip = [dir * hipX, hipY];
    const knee = [hip[0] - Math.sin(hipA) * thigh, hip[1] + Math.cos(hipA) * thigh];
    const shinA = hipA - kneeA;
    const ankle = [knee[0] - Math.sin(shinA) * shin, knee[1] + Math.cos(shinA) * shin];
    const s = Math.sin(lp);
    const pitch = (s > 0 ? s * 0.15 : -s * 0.35) * amount;
    return { dir, hip, knee, ankle, bend: kneeA, pitch, order: hipA };
  });
  legs.sort((a, b) => a.order - b.order);
  return legs;
}

/** A knee fold drawn while the leg is bent. */
export function kneeFold(ctx, knee, bend) {
  if (bend <= 0.15) return;
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.moveTo(knee[0] - 2.1, knee[1] - 0.4);
  ctx.quadraticCurveTo(knee[0], knee[1] + 0.8, knee[0] + 2.1, knee[1] - 0.4);
  ctx.stroke();
}

/** A sleeve along shoulder → elbow → wrist: an outline, the cloth, a shade down its back. */
export function sleeve(ctx, shoulder, elbow, wrist, fill, shade, width = 5.1) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = LINE;
  ctx.lineWidth = width + 1.1;
  ctx.beginPath();
  ctx.moveTo(...shoulder);
  ctx.lineTo(...elbow);
  ctx.lineTo(...wrist);
  ctx.stroke();
  ctx.strokeStyle = fill;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.strokeStyle = shade;
  ctx.lineWidth = width * 0.27;
  ctx.beginPath();
  ctx.moveTo(shoulder[0] + 1.2, shoulder[1] + 1);
  ctx.lineTo(elbow[0] + 1.2, elbow[1]);
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
}

/** Where an arm's elbow and wrist hang for a walking swing (forward when `swing` > 0). */
export function swingArm(shoulder, swing, side) {
  const elbow = [shoulder[0] + side * 2 + swing * 0.35, shoulder[1] + 10.4];
  const lift = Math.max(0, swing) * 0.35;
  const wrist = [shoulder[0] + side * 1.8 + swing * 1.1, shoulder[1] + 19.8 - lift];
  return { elbow, wrist };
}

/** A relaxed hand; `glove` draws it in that colour with a cuff instead of skin. */
export function drawHand(ctx, x, y, rot, { skin, deep, glove = null } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const fill = glove ?? skin;
  ctx.beginPath();
  ctx.ellipse(0, 1, 1.9, 2.3, 0, 0, Math.PI * 2);
  fillPath(ctx, fill, 0.45);
  ctx.strokeStyle = glove ? 'rgba(0,0,0,0.22)' : deep;
  ctx.lineWidth = 0.28;
  for (const fx of [-0.7, 0, 0.7]) {
    ctx.beginPath();
    ctx.moveTo(fx, 1.7);
    ctx.lineTo(fx, 3.1);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(-1.7, 0.4, 0.65, 1.2, 0.5, 0, Math.PI * 2);
  fillPath(ctx, fill, 0.32);
  if (glove) {
    rr(ctx, -2.1, -1.6, 4.2, 1.3, 0.4);
    fillPath(ctx, fill, 0.3);
  }
  ctx.restore();
}

/**
 * The face outline, centred on `headY`: `w` half-width, `chin` how far the
 * chin drops, `jaw` how square the jaw is (0 soft, 1 square).
 */
export function facePath(ctx, headY, { w = 9.4, chin = 11.4, jaw = 0 } = {}) {
  const jx = 5.6 + jaw * 2;
  ctx.beginPath();
  ctx.moveTo(-w, headY - 3);
  ctx.bezierCurveTo(-w - 0.2, headY - 14, w + 0.2, headY - 14, w, headY - 3);
  ctx.bezierCurveTo(w, headY + 4 + jaw, jx, headY + chin - 1.4, 0, headY + chin);
  ctx.bezierCurveTo(-jx, headY + chin - 1.4, -w, headY + 4 + jaw, -w, headY - 3);
  ctx.closePath();
}

/** Fills the face, then cel-shades the far cheek and the band under the fringe. */
export function drawFace(ctx, headY, skin, shade, shape = {}) {
  facePath(ctx, headY, shape);
  fillPath(ctx, skin, 0.55);
  ctx.save();
  facePath(ctx, headY, shape);
  ctx.clip();
  ctx.fillStyle = shade;
  ctx.globalAlpha = 0.32;
  ctx.beginPath();
  ctx.moveTo(6.2, headY - 5);
  ctx.quadraticCurveTo(9, headY + 2, 5.6, headY + 7.6);
  ctx.quadraticCurveTo(3.4, headY + 10.6, 0.8, headY + 11.6);
  ctx.lineTo(10.5, headY + 12.5);
  ctx.lineTo(10.5, headY - 5);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 0.4;
  ctx.fillRect(-10.5, headY - 10, 21, 3.2);
  ctx.globalAlpha = 1;
  ctx.restore();
}

export function drawEars(ctx, headY, skin, deep, { x = 9.6 } = {}) {
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(dir * x, headY + 0.6, 1.7, 2.7, dir * 0.1, 0, Math.PI * 2);
    fillPath(ctx, skin, 0.45);
    ctx.strokeStyle = deep;
    ctx.lineWidth = 0.32;
    ctx.beginPath();
    ctx.arc(dir * x, headY + 0.6, 0.95, dir < 0 ? 0.6 * Math.PI : -0.4 * Math.PI, dir < 0 ? 1.4 * Math.PI : 0.4 * Math.PI);
    ctx.stroke();
  }
}

/** A nose: a bridge shadow and a soft tip. */
export function drawNose(ctx, eyeY, colour = 'rgba(200,130,110,0.6)', long = 0) {
  ctx.strokeStyle = colour;
  ctx.lineWidth = 0.45;
  ctx.beginPath();
  ctx.moveTo(0.8, eyeY + 0.6);
  ctx.lineTo(1.2, eyeY + 4 + long);
  ctx.quadraticCurveTo(0.6, eyeY + 4.8 + long, -0.4, eyeY + 4.4 + long);
  ctx.stroke();
}

/** Soft pink cheeks. */
export function drawBlush(ctx, eyeY, alpha = 0.22) {
  ctx.fillStyle = `rgba(240,120,130,${alpha})`;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(dir * 5.6, eyeY + 3.6, 1.9, 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Both eyes in the game's style (iris with radial strands, a shadow from
 * the upper lid, no highlights). `shape`: 'almond' (default), 'round'
 * (bigger, younger), 'narrow' (sharp), 'smile' (closed arcs, always).
 * `lashes` adds a flick at the outer corner; `droop` lowers the outer
 * corners (kindly, older).
 */
export function drawEyes(ctx, eyeY, colours, { spacing = 4.3, shape = 'almond', lashes = false, droop = 0, blinking = false } = {}) {
  const { iris, irisLight, pupil = '#1e120c', lash = '#1e140f' } = colours;
  const tall = shape === 'round' ? 1.25 : shape === 'narrow' ? 0.7 : 1;
  for (const dir of [-1, 1]) {
    const ex = dir * spacing;
    const inner = [ex - dir * 2.6, eyeY + 0.4];
    const outer = [ex + dir * 2.9, eyeY - 0.3 + droop];
    if (blinking || shape === 'smile') {
      ctx.strokeStyle = lash;
      ctx.lineWidth = 0.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(inner[0], inner[1]);
      if (shape === 'smile' && !blinking) ctx.quadraticCurveTo(ex, eyeY - 2, outer[0], outer[1]);
      else ctx.quadraticCurveTo(ex, eyeY + 0.8, outer[0], outer[1]);
      ctx.stroke();
      if (lashes) {
        ctx.beginPath();
        ctx.moveTo(outer[0], outer[1]);
        ctx.lineTo(outer[0] + dir * 0.9, outer[1] - 0.5);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
      continue;
    }
    const shapePath = () => {
      ctx.beginPath();
      ctx.moveTo(inner[0], inner[1]);
      ctx.quadraticCurveTo(ex - dir * 0.3, eyeY - 2.6 * tall, outer[0], outer[1]);
      ctx.quadraticCurveTo(ex + dir * 0.8, eyeY + 1.9 * tall, inner[0], inner[1]);
      ctx.closePath();
    };
    shapePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.save();
    shapePath();
    ctx.clip();
    const r = 1.95 * (shape === 'round' ? 1.15 : 1);
    const g = ctx.createLinearGradient(0, eyeY - 2, 0, eyeY + 2);
    g.addColorStop(0, pupil);
    g.addColorStop(0.5, iris);
    g.addColorStop(1, irisLight);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(ex + dir * 0.1, eyeY - 0.1, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pupil;
    ctx.beginPath();
    ctx.ellipse(ex + dir * 0.1, eyeY - 0.2, 0.85, 1.05, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,180,0.35)';
    ctx.lineWidth = 0.13;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(ex + Math.cos(a) * 1.05, eyeY + Math.sin(a) * 1.15);
      ctx.lineTo(ex + Math.cos(a) * (r - 0.15), eyeY + Math.sin(a) * (r - 0.15));
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(30,14,14,0.22)';
    ctx.fillRect(ex - 3, eyeY - 3 * tall, 6, 1.6);
    ctx.restore();
    // Upper lash line, heavier at the outer corner.
    ctx.fillStyle = lash;
    ctx.beginPath();
    ctx.moveTo(inner[0], inner[1] + 0.1);
    ctx.quadraticCurveTo(ex - dir * 0.4, eyeY - 3.1 * tall, outer[0] + dir * 0.4, outer[1] - 0.4);
    ctx.lineTo(outer[0] + dir * 0.2, outer[1] + 0.4);
    ctx.quadraticCurveTo(ex - dir * 0.4, eyeY - 2 * tall, inner[0], inner[1] + 0.6);
    ctx.closePath();
    ctx.fill();
    if (lashes) {
      ctx.strokeStyle = lash;
      ctx.lineWidth = 0.4;
      ctx.lineCap = 'round';
      for (const k of [0, 1]) {
        ctx.beginPath();
        ctx.moveTo(outer[0] - dir * k * 0.9, outer[1] - 0.3 - k * 0.5);
        ctx.lineTo(outer[0] + dir * (1 - k * 0.5), outer[1] - 1.1 - k * 0.6);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
    }
    // Lower lid, and a soft crease above.
    ctx.strokeStyle = 'rgba(30,18,18,0.3)';
    ctx.lineWidth = 0.26;
    ctx.beginPath();
    ctx.moveTo(ex - dir * 1, eyeY + 1.6 * tall);
    ctx.quadraticCurveTo(ex + dir * 1, eyeY + 1.9 * tall, outer[0] - dir * 0.2, outer[1] + 0.8);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(150,92,72,0.35)';
    ctx.beginPath();
    ctx.moveTo(ex - dir * 1.6, eyeY - 2.9 * tall);
    ctx.quadraticCurveTo(ex + dir * 0.6, eyeY - 3.5 * tall, outer[0] + dir * 0.3, outer[1] - 1.5);
    ctx.stroke();
  }
}

/** Two brows: `lift` raises the inner ends (worried/kind), `thick` widens them. */
export function drawBrows(ctx, eyeY, colour, { thick = 0.7, lift = 0, y = -4.4 } = {}) {
  ctx.fillStyle = colour;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 2, eyeY + y - lift);
    ctx.lineTo(dir * 6.6, eyeY + y - 0.7);
    ctx.lineTo(dir * 6.8, eyeY + y - 0.7 + thick);
    ctx.lineTo(dir * 2.1, eyeY + y - lift + thick);
    ctx.closePath();
    ctx.fill();
  }
}

/** A mouth: 'smile', 'grin' (open, teeth), 'open' (talking), 'flat' or 'smirk'. */
export function drawMouth(ctx, headY, kind, lips = '#c87a72') {
  ctx.lineCap = 'round';
  ctx.strokeStyle = lips;
  ctx.lineWidth = 0.6;
  if (kind === 'grin' || kind === 'open') {
    ctx.beginPath();
    if (kind === 'grin') {
      ctx.moveTo(-2.6, headY + 6.2);
      ctx.quadraticCurveTo(0, headY + 6.8, 2.6, headY + 6.2);
      ctx.quadraticCurveTo(0, headY + 9.4, -2.6, headY + 6.2);
    } else {
      ctx.ellipse(0, headY + 7, 1.5, 1.3, 0, 0, Math.PI * 2);
    }
    ctx.closePath();
    fillPath(ctx, '#7a2e34', 0.4);
    if (kind === 'grin') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-2, headY + 6.4, 4, 0.8);
    } else {
      ctx.fillStyle = '#e8828a';
      ctx.beginPath();
      ctx.ellipse(0, headY + 7.8, 0.9, 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.beginPath();
    if (kind === 'flat') {
      ctx.moveTo(-1.8, headY + 7);
      ctx.lineTo(1.8, headY + 7);
    } else if (kind === 'smirk') {
      ctx.moveTo(-1.8, headY + 6.8);
      ctx.quadraticCurveTo(0.4, headY + 7.6, 2.4, headY + 6.2);
    } else {
      ctx.moveTo(-2.2, headY + 6.4);
      ctx.quadraticCurveTo(0, headY + 8, 2.2, headY + 6.4);
    }
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}

/** Strand lines inside the current clip: each entry is [x0, y0, cx, cy, x1, y1] relative to `headY`. */
export function hairStrands(ctx, headY, strands, colour, width = 0.32) {
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  for (const [x0, y0, cx, cy, x1, y1] of strands) {
    ctx.beginPath();
    ctx.moveTo(x0, headY + y0);
    ctx.quadraticCurveTo(cx, headY + cy, x1, headY + y1);
    ctx.stroke();
  }
}
