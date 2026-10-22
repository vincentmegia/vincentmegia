// Library Shift patrons' heads (patron.js): face, eyes, hair and everything
// worn on the head, drawn from a library-people.js design in the detailed
// style of the staff renderers ("i want the characters to also be more
// detailed like min-jun, ji-ho, eun-mi and staff"). Hair has a back layer
// (drawn behind the body) and a front layer; headwear sits on top.
//
// Coordinates follow Hospital Shift's anime adult frame (face centre about
// -55); see staff-kit.js.

import { shadeColor } from '../shared/people.js';
import {
  fillPath, rr, dot, isBlinkingAt, drawFace, drawEars, drawNose, drawEyes, drawBrows, drawMouth, drawBlush, hairStrands,
} from './staff-kit.js';

export const HEAD_Y = -55;
const EYE_Y = -53.8;

/** Hair tones from the design's one colour: mid (lit), deep (shadow), shine (strands). */
export function hairTones(colour) {
  return {
    base: colour,
    mid: shadeColor(colour, 0.18),
    deep: shadeColor(colour, -0.32),
    shine: shadeColor(colour, 0.45),
  };
}

function skinTones(skin) {
  return { skin, shade: shadeColor(skin, -0.1), deep: shadeColor(skin, -0.22) };
}

/** A design's blink, offset by its key so a queue doesn't blink in unison. */
export function isPatronBlinkingAt(design, t) {
  let h = 0;
  for (const ch of design.key) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return isBlinkingAt(t, 3 + (h % 17) / 10, h / 97);
}

// -- Back hair (drawn before the body) ---------------------------------------------

/** Long, medium, bob, twintail and ponytail hair that falls behind the head and shoulders. */
export function drawHairBack(ctx, design, sway) {
  const { back } = design.hair;
  const tone = hairTones(design.hair.color);
  const fall = { long: 24, medium: 11, bob: 8.6 }[back];
  if (fall) {
    ctx.beginPath();
    ctx.moveTo(-10.2, HEAD_Y - 6);
    ctx.bezierCurveTo(-12.8, HEAD_Y + 2, -12.2 + sway * 0.3, HEAD_Y + fall - 4, -10.6 + sway * 0.5, HEAD_Y + fall);
    if (back === 'long') {
      // A softly uneven ends line.
      for (let i = -4; i <= 4; i++) ctx.quadraticCurveTo(i * 2.6 - 1.3 + sway * 0.5, HEAD_Y + fall + 1.6, i * 2.6 + sway * 0.5, HEAD_Y + fall + (i % 2 ? 0.8 : 0));
      ctx.lineTo(10.6 + sway * 0.5, HEAD_Y + fall);
    } else {
      ctx.quadraticCurveTo(0, HEAD_Y + fall + 2, 10.6 + sway * 0.5, HEAD_Y + fall);
    }
    ctx.bezierCurveTo(12.2 + sway * 0.3, HEAD_Y + fall - 4, 12.8, HEAD_Y + 2, 10.2, HEAD_Y - 6);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, HEAD_Y - 6, 0, HEAD_Y + fall);
    g.addColorStop(0, tone.deep);
    g.addColorStop(1, tone.base);
    fillPath(ctx, g, 0.5);
    ctx.save();
    ctx.clip();
    hairStrands(ctx, HEAD_Y, [[-9, 0, -11, fall * 0.5, -9 + sway * 0.4, fall], [9, 0, 11, fall * 0.5, 9 + sway * 0.4, fall]], tone.mid, 0.4);
    ctx.restore();
  }
  if (back === 'twintails') {
    for (const dir of [-1, 1]) {
      ctx.save();
      ctx.translate(dir * 9.6, HEAD_Y - 9);
      ctx.rotate(dir * 0.12 + sway * 0.06);
      ctx.beginPath();
      ctx.moveTo(-1.6 * dir, 0);
      ctx.bezierCurveTo(dir * 6, 2, dir * 6.6, 12, dir * 3.4, 20);
      ctx.quadraticCurveTo(dir * 2.6, 22.6, dir * 1.4, 20.4);
      ctx.bezierCurveTo(dir * 3.4, 12, dir * 1.6, 5, -dir * 0.4, 3);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, 0, 0, 22);
      g.addColorStop(0, tone.mid);
      g.addColorStop(1, tone.base);
      fillPath(ctx, g, 0.5);
      hairStrands(ctx, 0, [[dir * 1, 2, dir * 5, 10, dir * 3, 18]], tone.shine, 0.3);
      ctx.restore();
    }
  }
  if (back === 'ponytail') {
    // A high ponytail swinging out behind, peeking past the head.
    ctx.save();
    ctx.translate(3, HEAD_Y - 15);
    ctx.rotate(0.2 + sway * 0.1);
    ctx.beginPath();
    ctx.moveTo(-2, 0);
    ctx.bezierCurveTo(7, -2, 12.6, 6, 11 + sway, 16);
    ctx.quadraticCurveTo(10 + sway * 1.4, 22, 8.4 + sway * 1.6, 25);
    ctx.quadraticCurveTo(6.4 + sway, 20, 6.4, 14);
    ctx.bezierCurveTo(6, 8, 4, 4, -1, 3);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 10, 24);
    g.addColorStop(0, tone.mid);
    g.addColorStop(1, tone.deep);
    fillPath(ctx, g, 0.5);
    hairStrands(ctx, 0, [[1, 1, 10, 4, 9.4, 16], [3, 2, 8.4, 10, 8.4 + sway, 22]], tone.shine, 0.3);
    ctx.restore();
  }
  if (back === 'curly') {
    // A full cloud of curls around the head.
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const cx = Math.cos(a) * 11.4;
      const cy = HEAD_Y - 6 + Math.sin(a) * 11.6;
      if (cy > HEAD_Y + 6) continue;
      ctx.beginPath();
      ctx.arc(cx, cy, 3.4, 0, Math.PI * 2);
      fillPath(ctx, i % 2 ? tone.base : tone.deep, 0.4);
    }
  }
  if (back === 'bun') {
    ctx.save();
    ctx.translate(0, HEAD_Y - 16.8);
    ctx.beginPath();
    ctx.ellipse(0, 0, 5, 4, 0, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(-1.4, -1.4, 0.4, 0, 0, 5.2);
    g.addColorStop(0, tone.mid);
    g.addColorStop(1, tone.deep);
    fillPath(ctx, g, 0.5);
    ctx.strokeStyle = tone.shine;
    ctx.lineWidth = 0.3;
    for (const r of [1.3, 2.5, 3.6]) {
      ctx.beginPath();
      ctx.ellipse(0.2, 0.1, r, r * 0.75, 0.3, Math.PI * 0.1, Math.PI * 1.4);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// -- Head --------------------------------------------------------------------

const EYE_SHAPE = { big: 'round', round: 'round', smile: 'smile', sharp: 'narrow', calm: 'almond' };

/**
 * The head: neck, ears, face, features, front hair, and headwear.
 * `angry` scowls (Karen); `kid` and `elder` adjust the face.
 */
export function drawPatronHead(ctx, design, t, { angry = false } = {}) {
  const st = skinTones(design.skin);
  const ex = design.extras ?? {};
  const kid = design.age === 'kid';
  const elder = design.age === 'elder';
  rr(ctx, -2.3, -47.4, 4.6, 4.2, 1);
  fillPath(ctx, st.shade, 0.4);
  ctx.fillStyle = 'rgba(120,60,50,0.18)';
  ctx.beginPath();
  ctx.ellipse(0, -46.6, 2.4, 0.9, 0, 0, Math.PI * 2);
  ctx.fill();
  drawEars(ctx, HEAD_Y, design.skin, st.deep, { x: kid ? 9.4 : 9.3 });
  if (ex.earrings) {
    for (const dir of [-1, 1]) {
      ctx.strokeStyle = ex.earrings;
      ctx.lineWidth = 0.35;
      ctx.beginPath();
      ctx.moveTo(dir * 9.5, HEAD_Y + 2.8);
      ctx.lineTo(dir * 9.5, HEAD_Y + 4.2);
      ctx.stroke();
      dot(ctx, dir * 9.5, HEAD_Y + 4.8, 0.65, ex.earrings, 0.15);
    }
  }
  drawFace(ctx, HEAD_Y, design.skin, st.shade, kid ? { w: 9.4, chin: 9.6 } : elder ? { w: 9.2, chin: 10.8, jaw: 0.3 } : { w: 9, chin: 10.6 });
  const eyes = design.eyes;
  const shape = EYE_SHAPE[eyes.style] ?? 'almond';
  const blinking = isPatronBlinkingAt(design, t);
  drawEyes(ctx, EYE_Y, { iris: eyes.color, irisLight: shadeColor(eyes.color, 0.35) }, {
    shape: angry ? 'narrow' : shape,
    lashes: Boolean(eyes.lashes),
    droop: eyes.style === 'calm' || elder ? 0.6 : 0,
    blinking,
  });
  if (elder) drawAgeLines(ctx);
  const browColour = shadeColor(design.hair.color, design.hair.color === '#e6e3dc' || design.hair.color === '#d8d6dc' ? -0.25 : -0.1);
  if (angry) {
    // Brows drawn down hard at the middle.
    ctx.fillStyle = browColour;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(dir * 1.6, EYE_Y - 2.6);
      ctx.lineTo(dir * 6.8, EYE_Y - 5.6);
      ctx.lineTo(dir * 6.8, EYE_Y - 4.8);
      ctx.lineTo(dir * 1.8, EYE_Y - 1.8);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    drawBrows(ctx, EYE_Y, browColour, { thick: design.brows === 'thick' ? 1 : 0.5, lift: eyes.style === 'smile' || kid ? 0.5 : 0.2, y: -4.8 });
  }
  if (kid || eyes.lashes || design.mouth === 'smile') drawBlush(ctx, EYE_Y, kid ? 0.38 : 0.24);
  drawNose(ctx, EYE_Y, `rgba(${parseInt(st.deep.slice(1, 3), 16)},${parseInt(st.deep.slice(3, 5), 16) - 20},${parseInt(st.deep.slice(5, 7), 16) - 20},0.55)`, kid ? -1.2 : elder ? 0.6 : -0.2);
  const lips = eyes.lashes ? '#d8707e' : shadeColor(design.skin, -0.38);
  if (angry) {
    drawMouth(ctx, HEAD_Y, 'grin', lips);
    // The anger mark at her temple.
    ctx.strokeStyle = '#e04a4a';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (const [a, b] of [[[6.4, -8], [7.6, -9.2]], [[8.4, -8], [7.2, -9.2]], [[6.4, -10.4], [7.6, -9.2]], [[8.4, -10.4], [7.2, -9.2]]]) {
      ctx.moveTo(a[0], HEAD_Y + a[1]);
      ctx.lineTo(b[0], HEAD_Y + b[1]);
    }
    ctx.stroke();
  } else if (!ex.mask) {
    drawMouth(ctx, HEAD_Y, design.mouth === 'open' ? 'open' : design.mouth === 'flat' ? 'flat' : 'smile', lips);
    // A soft lower lip, and a tiny shadow under it.
    ctx.fillStyle = eyes.lashes ? 'rgba(232,112,126,0.35)' : 'rgba(200,120,110,0.18)';
    ctx.beginPath();
    ctx.ellipse(0, HEAD_Y + 7.9, 1.1, 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(150,80,70,0.15)';
    ctx.beginPath();
    ctx.ellipse(0, HEAD_Y + 8.8, 0.9, 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (ex.beard) drawBeard(ctx, ex.beard);
  if (ex.mustache) drawMustache(ctx, ex.mustache);
  if (ex.mask) drawMask(ctx);
  if (ex.glasses) drawGlasses(ctx, ex.glasses);
  drawHairFront(ctx, design, t);
  drawHeadwear(ctx, design, t);
}

function drawAgeLines(ctx) {
  ctx.strokeStyle = 'rgba(150,96,76,0.4)';
  ctx.lineWidth = 0.26;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 7.7, EYE_Y + 0.4);
    ctx.lineTo(dir * 8.8, EYE_Y + 1.2);
    ctx.moveTo(dir * 3.5, EYE_Y + 4.8);
    ctx.quadraticCurveTo(dir * 4.7, EYE_Y + 6.8, dir * 4, EYE_Y + 8.6);
    ctx.stroke();
  }
}

function drawBeard(ctx, colour) {
  // A short, neat beard along the jaw and chin.
  ctx.beginPath();
  ctx.moveTo(-8.8, HEAD_Y + 1.6);
  ctx.quadraticCurveTo(-8.4, HEAD_Y + 9, 0, HEAD_Y + 12.6);
  ctx.quadraticCurveTo(8.4, HEAD_Y + 9, 8.8, HEAD_Y + 1.6);
  ctx.quadraticCurveTo(7.4, HEAD_Y + 6.4, 3.4, HEAD_Y + 8.4);
  ctx.quadraticCurveTo(0, HEAD_Y + 9.4, -3.4, HEAD_Y + 8.4);
  ctx.quadraticCurveTo(-7.4, HEAD_Y + 6.4, -8.8, HEAD_Y + 1.6);
  ctx.closePath();
  fillPath(ctx, colour, 0.4);
  hairStrands(ctx, HEAD_Y, [[-6, 4, -5, 8, -2, 10.6], [6, 4, 5, 8, 2, 10.6], [0, 9.6, 0, 10.6, 0, 11.8]], shadeColor(colour, -0.25), 0.25);
  drawMustache(ctx, colour);
}

function drawMustache(ctx, colour) {
  ctx.beginPath();
  ctx.moveTo(0, HEAD_Y + 4.7);
  ctx.bezierCurveTo(-1.6, HEAD_Y + 4.1, -3.4, HEAD_Y + 4.7, -3.5, HEAD_Y + 5.9);
  ctx.quadraticCurveTo(-1.8, HEAD_Y + 5.5, 0, HEAD_Y + 5.8);
  ctx.quadraticCurveTo(1.8, HEAD_Y + 5.5, 3.5, HEAD_Y + 5.9);
  ctx.bezierCurveTo(3.4, HEAD_Y + 4.7, 1.6, HEAD_Y + 4.1, 0, HEAD_Y + 4.7);
  ctx.closePath();
  fillPath(ctx, colour, 0.35);
}

function drawMask(ctx) {
  // A white face mask over nose and mouth, with pleats and ear loops.
  ctx.beginPath();
  ctx.moveTo(-6.4, HEAD_Y + 1);
  ctx.quadraticCurveTo(0, HEAD_Y - 0.6, 6.4, HEAD_Y + 1);
  ctx.quadraticCurveTo(7, HEAD_Y + 6, 4.6, HEAD_Y + 8.6);
  ctx.quadraticCurveTo(0, HEAD_Y + 10.2, -4.6, HEAD_Y + 8.6);
  ctx.quadraticCurveTo(-7, HEAD_Y + 6, -6.4, HEAD_Y + 1);
  ctx.closePath();
  fillPath(ctx, '#f6f6f8', 0.4);
  ctx.strokeStyle = 'rgba(150,150,170,0.6)';
  ctx.lineWidth = 0.25;
  for (const py of [3.4, 5.4]) {
    ctx.beginPath();
    ctx.moveTo(-5.8, HEAD_Y + py);
    ctx.quadraticCurveTo(0, HEAD_Y + py - 0.6, 5.8, HEAD_Y + py);
    ctx.stroke();
  }
  ctx.strokeStyle = '#e4e4ec';
  ctx.lineWidth = 0.4;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 6.4, HEAD_Y + 1.6);
    ctx.quadraticCurveTo(dir * 9.6, HEAD_Y + 1, dir * 9.4, HEAD_Y + 2.6);
    ctx.stroke();
  }
}

function drawGlasses(ctx, kind) {
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    if (kind === 'square') ctx.roundRect(dir * 4.3 - 3.1, EYE_Y - 2.3, 6.2, 4.6, 0.9);
    else ctx.arc(dir * 4.3, EYE_Y, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(210,230,255,0.12)';
    ctx.fill();
    ctx.strokeStyle = kind === 'square' ? '#1e1a22' : '#6a4a32';
    ctx.lineWidth = kind === 'square' ? 0.6 : 0.45;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 0.3;
    ctx.beginPath();
    ctx.moveTo(dir * 4.3 - 1.6, EYE_Y - 1.4);
    ctx.lineTo(dir * 4.3 - 0.6, EYE_Y - 1.9);
    ctx.stroke();
  }
  ctx.strokeStyle = kind === 'square' ? '#1e1a22' : '#6a4a32';
  ctx.lineWidth = 0.45;
  ctx.beginPath();
  ctx.moveTo(-1.3, EYE_Y - 0.4);
  ctx.quadraticCurveTo(0, EYE_Y - 1.2, 1.3, EYE_Y - 0.4);
  ctx.moveTo(-7.3, EYE_Y - 0.6);
  ctx.lineTo(-9.1, EYE_Y - 1.2);
  ctx.moveTo(7.3, EYE_Y - 0.6);
  ctx.lineTo(9.1, EYE_Y - 1.2);
  ctx.stroke();
}

// -- Front hair --------------------------------------------------------------

/** The crown dome every style shares; `top` is how high it sits. */
function crown(ctx, tone, top = 19.6, sideLen = 2) {
  ctx.beginPath();
  ctx.moveTo(-10.2, HEAD_Y + sideLen);
  ctx.bezierCurveTo(-12.4, HEAD_Y - top, 12.4, HEAD_Y - top, 10.2, HEAD_Y + sideLen);
  ctx.quadraticCurveTo(9.4, HEAD_Y - 3, 8.2, HEAD_Y - 6.8);
  ctx.lineTo(-8.2, HEAD_Y - 6.8);
  ctx.quadraticCurveTo(-9.4, HEAD_Y - 3, -10.2, HEAD_Y + sideLen);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, HEAD_Y - top + 4, 0, HEAD_Y);
  g.addColorStop(0, tone.mid);
  g.addColorStop(1, tone.base);
  fillPath(ctx, g, 0.55);
  ctx.save();
  ctx.clip();
  hairStrands(ctx, HEAD_Y, [
    [-1, -15.6, -6, -14, -9.6, -3], [-1, -15.6, -4, -11, -7.4, -6.4], [-1, -15.6, -8, -15, -10.4, -1],
    [-1, -15.6, 5, -15, 9.6, -3], [-1, -15.6, 3.6, -11.6, 7.4, -6.4], [-1, -15.6, 7, -16, 10.4, -1],
    [-1, -15.6, -2, -12, -3.4, -7.2], [-1, -15.6, 1.4, -12, 2.6, -7.2],
  ], tone.deep, 0.28);
  hairStrands(ctx, HEAD_Y, [[-6, -12.8, -7.6, -9, -8.6, -4], [5.4, -13, 7.2, -9.4, 8.2, -4.6]], tone.shine, 0.35);
  ctx.strokeStyle = tone.shine;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-6.4, HEAD_Y - 12.6);
  ctx.quadraticCurveTo(0, HEAD_Y - 15.2, 6.4, HEAD_Y - 12.6);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawHairFront(ctx, design, t) {
  const { back, fringe, streaks } = design.hair;
  const tone = hairTones(design.hair.color);
  if (back === 'bald') {
    drawBald(ctx, tone);
    return;
  }
  const sideLen = { long: 8, medium: 7, bob: 7.4, twintails: 4, ponytail: 0, bun: 0, short: -2, braid: 2, curly: 3 }[back] ?? 2;
  crown(ctx, tone, back === 'short' ? 18.6 : 19.6, sideLen);
  if (back === 'curly') {
    // Curls along the hairline.
    for (let i = -4; i <= 4; i++) {
      ctx.beginPath();
      ctx.arc(i * 2.2, HEAD_Y - 11 - Math.cos(i * 0.35) * 2.4, 1.9, 0, Math.PI * 2);
      fillPath(ctx, i % 2 ? tone.mid : tone.base, 0.3);
    }
  }
  if (back === 'braid') drawSideBraid(ctx, tone, t);
  // Side locks framing the face for longer styles.
  if (['long', 'medium', 'bob', 'twintails'].includes(back)) {
    for (const dir of [-1, 1]) {
      const end = back === 'bob' ? 8 : back === 'twintails' ? 5 : 10;
      ctx.beginPath();
      ctx.moveTo(dir * 8.6, HEAD_Y - 8.4);
      ctx.bezierCurveTo(dir * 10.8, HEAD_Y - 2, dir * 10.6, HEAD_Y + end - 4, dir * (back === 'bob' ? 10 : 9), HEAD_Y + end);
      ctx.quadraticCurveTo(dir * 8, HEAD_Y + end + 0.8, dir * 7.6, HEAD_Y + end - 1);
      ctx.quadraticCurveTo(dir * 8.8, HEAD_Y + 3, dir * 7.8, HEAD_Y - 4.6);
      ctx.closePath();
      fillPath(ctx, tone.base, 0.45);
      hairStrands(ctx, HEAD_Y, [[dir * 9, -6, dir * 10, 0, dir * 8.8, end - 1]], tone.mid, 0.3);
    }
  }
  if (fringe === 'blunt') {
    ctx.beginPath();
    ctx.moveTo(-9.1, HEAD_Y - 10);
    ctx.quadraticCurveTo(0, HEAD_Y - 13.8, 9.1, HEAD_Y - 10);
    ctx.lineTo(8.9, HEAD_Y - 5.4);
    ctx.quadraticCurveTo(0, HEAD_Y - 4.6, -8.9, HEAD_Y - 5.4);
    ctx.closePath();
    fillPath(ctx, tone.base, 0.5);
    ctx.strokeStyle = tone.deep;
    ctx.lineWidth = 0.28;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 2.4, HEAD_Y - 11.2);
      ctx.lineTo(i * 2.5, HEAD_Y - 5.6);
      ctx.stroke();
    }
  } else if (fringe === 'side') {
    ctx.beginPath();
    ctx.moveTo(-3, HEAD_Y - 11);
    ctx.quadraticCurveTo(-8, HEAD_Y - 9.4, -8.8, HEAD_Y - 3.4);
    ctx.quadraticCurveTo(-6.2, HEAD_Y - 6.8, -2, HEAD_Y - 7.6);
    ctx.quadraticCurveTo(3, HEAD_Y - 8.4, 8.4, HEAD_Y - 6.6);
    ctx.quadraticCurveTo(5, HEAD_Y - 11, -3, HEAD_Y - 11);
    ctx.closePath();
    fillPath(ctx, tone.base, 0.45);
    hairStrands(ctx, HEAD_Y, [[-3, -10.6, -6.6, -8.4, -8, -4.4], [0, -10.4, 4, -9, 7.6, -7]], tone.deep, 0.28);
  } else if (fringe === 'messy') {
    // Choppy locks of different lengths, a couple sticking up.
    for (const [x, len, lean] of [[-7.4, 4.6, -0.8], [-5, 6, -0.3], [-2.4, 5, 0.4], [0.2, 6.4, -0.2], [2.8, 5.2, 0.6], [5.4, 5.8, 0.3], [7.6, 4.2, 0.9]]) {
      ctx.beginPath();
      ctx.moveTo(x - 1.6, HEAD_Y - 10.6);
      ctx.quadraticCurveTo(x - 0.6, HEAD_Y - 10.6 + len * 0.5, x + lean, HEAD_Y - 10.6 + len);
      ctx.quadraticCurveTo(x + 0.8, HEAD_Y - 10.6 + len * 0.5, x + 1.6, HEAD_Y - 10.8);
      ctx.closePath();
      fillPath(ctx, tone.base, 0.35);
    }
    // A cowlick curling up off the crown (unless a hat's on it).
    const ex = design.extras ?? {};
    const hatted = ex.bandana || ex.beanie || ex.cap || ex.bikeHelmet || ex.sunhat || ex.witchHat || ex.beret || ex.bucketHat || ex.baseballCap;
    if (!hatted) {
      ctx.strokeStyle = tone.base;
      ctx.lineWidth = 0.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0.6, HEAD_Y - 12.4);
      ctx.quadraticCurveTo(1.2 + Math.sin(t * 1.6) * 0.3, HEAD_Y - 15.4, 2.8, HEAD_Y - 14.6);
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
  } else if (fringe === 'textured') {
    // A permed, curly fringe: rows of little curls.
    for (let i = -4; i <= 4; i++) {
      const cx = i * 2.05;
      const cy = HEAD_Y - 8.6 + Math.abs(i) * 0.25;
      ctx.beginPath();
      ctx.arc(cx, cy, 1.55, 0, Math.PI * 2);
      fillPath(ctx, i % 2 ? tone.base : tone.mid, 0.3);
      ctx.strokeStyle = tone.deep;
      ctx.lineWidth = 0.22;
      ctx.beginPath();
      ctx.arc(cx + 0.2, cy + 0.1, 0.7, Math.PI * 0.2, Math.PI * 1.5);
      ctx.stroke();
    }
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(i * 2.4, HEAD_Y - 11 - Math.abs(i) * 0.2, 1.6, 0, Math.PI * 2);
      fillPath(ctx, tone.mid, 0.3);
    }
  } else if (fringe === 'parted') {
    // Combed back from a neat side part, a soft wave over the forehead.
    ctx.strokeStyle = tone.deep;
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(-3.6, HEAD_Y - 14);
    ctx.lineTo(-4, HEAD_Y - 10.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-3.8, HEAD_Y - 10.6);
    ctx.quadraticCurveTo(1, HEAD_Y - 12.4, 7.8, HEAD_Y - 7.6);
    ctx.quadraticCurveTo(2, HEAD_Y - 9.2, -3.4, HEAD_Y - 9);
    ctx.closePath();
    fillPath(ctx, tone.mid, 0.35);
  }
  if (streaks) {
    ctx.strokeStyle = streaks;
    ctx.lineWidth = 0.9;
    ctx.lineCap = 'round';
    for (const [x0, x1] of [[-4, -7.6], [3, 6.4]]) {
      ctx.beginPath();
      ctx.moveTo(x0, HEAD_Y - 10.6);
      ctx.quadraticCurveTo((x0 + x1) / 2, HEAD_Y - 10, x1, HEAD_Y - 5.6);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }
}

/** A bald crown with a shine, grey hair left only round the sides. */
function drawBald(ctx, tone) {
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.ellipse(-3, HEAD_Y - 11.4, 3, 1.4, -0.3, 0, Math.PI * 2);
  ctx.fill();
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 8.8, HEAD_Y - 7.6);
    ctx.quadraticCurveTo(dir * 10.6, HEAD_Y - 4, dir * 9.8, HEAD_Y + 1);
    ctx.lineTo(dir * 8.6, HEAD_Y + 0.4);
    ctx.quadraticCurveTo(dir * 9.2, HEAD_Y - 3.6, dir * 8, HEAD_Y - 7);
    ctx.closePath();
    fillPath(ctx, tone.base, 0.35);
  }
}

/** A thick side braid falling forward over the right shoulder (viewer's left), tied with a ribbon. */
function drawSideBraid(ctx, tone, t) {
  const sway = Math.sin(t * 1.2) * 0.3;
  ctx.save();
  ctx.translate(-8.4, HEAD_Y + 3);
  for (let i = 0; i < 7; i++) {
    const y = i * 3.2;
    const x = Math.sin(i * 0.5) * 0.6 + sway * i * 0.2 - i * 0.25;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(x + dir * 0.9, y + (dir > 0 ? 1.6 : 0), 1.7, 2, dir * 0.6, 0, Math.PI * 2);
      fillPath(ctx, dir > 0 ? tone.base : tone.mid, 0.35);
    }
  }
  const endX = Math.sin(3) * 0.6 + sway * 1.4 - 1.75;
  rr(ctx, endX - 1.4, 22.6, 2.8, 1.2, 0.4);
  fillPath(ctx, '#ffd166', 0.3);
  ctx.beginPath();
  ctx.moveTo(endX - 1, 23.8);
  ctx.lineTo(endX + 1, 23.8);
  ctx.lineTo(endX + 0.4, 27);
  ctx.lineTo(endX - 0.6, 27);
  ctx.closePath();
  fillPath(ctx, tone.base, 0.3);
  ctx.restore();
}

// -- Headwear ----------------------------------------------------------------

function drawHeadwear(ctx, design, t) {
  const ex = design.extras ?? {};
  if (design.hair.back === 'twintails') {
    // Hair ties where the tails leave the head.
    for (const dir of [-1, 1]) dot(ctx, dir * 9.6, HEAD_Y - 9.4, 1.1, ex.ribbon ?? ex.bow ?? '#ff8fb8', 0.3);
  }
  if (design.hair.back === 'ponytail') {
    ctx.save();
    ctx.translate(3.6, HEAD_Y - 15.4);
    ctx.rotate(0.3);
    rr(ctx, -1.4, -1, 2.8, 2, 0.8);
    fillPath(ctx, ex.bandana ?? '#e8558f', 0.3);
    ctx.restore();
  }
  if (ex.bow) drawBow(ctx, 0, HEAD_Y - 17.2, ex.bow, 1.2);
  if (ex.ribbon && design.hair.back !== 'twintails') drawBow(ctx, 6.4, HEAD_Y - 14, ex.ribbon, 0.8);
  if (ex.clip) {
    ctx.save();
    ctx.translate(-6.4, HEAD_Y - 12.4);
    ctx.rotate(-0.5);
    rr(ctx, -2.4, -0.8, 4.8, 1.6, 0.6);
    fillPath(ctx, ex.clip, 0.3);
    ctx.restore();
  }
  if (ex.sunglasses) {
    // Pushed up on the head.
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(dir * 3.8, HEAD_Y - 14.2, 2.8, 1.8, dir * 0.1, 0, Math.PI * 2);
      fillPath(ctx, '#2a2230', 0.4);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(dir * 3.8 - 1.6, HEAD_Y - 15, 1, 0.4);
    }
    ctx.strokeStyle = '#c9a24a';
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(-1, HEAD_Y - 14.6);
    ctx.lineTo(1, HEAD_Y - 14.6);
    ctx.stroke();
  }
  if (ex.headphones) drawHeadphones(ctx, ex.headphones);
  if (ex.catEars) drawCatEars(ctx, ex.catEars);
  if (ex.hachimaki) drawHachimaki(ctx, ex.hachimaki, t);
  if (ex.bandana && design.hair.back !== 'ponytail') drawBandana(ctx, ex.bandana);
  if (ex.bandana && design.hair.back === 'ponytail') drawHeadscarf(ctx, ex.bandana);
  if (ex.beanie) drawBeanie(ctx, ex.beanie);
  if (ex.cap) drawFlatCap(ctx, ex.cap);
  if (ex.bikeHelmet) drawBikeHelmet(ctx, ex.bikeHelmet);
  if (ex.flowerCrown) drawFlowerCrown(ctx, ex.flowerCrown);
  if (ex.beret) drawBeret(ctx, ex.beret);
  if (ex.bucketHat) drawBucketHat(ctx, ex.bucketHat);
  if (ex.baseballCap) drawBaseballCap(ctx, ex.baseballCap);
  if (ex.sunhat) drawSunhat(ctx, ex.sunhat);
  if (ex.witchHat) drawWitchHat(ctx, ex.witchHat, t);
}

export function drawBow(ctx, x, y, colour, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(dir * 2.6, -2.6, dir * 3.4, -0.4);
    ctx.quadraticCurveTo(dir * 3, 1.8, 0, 0);
    ctx.closePath();
    fillPath(ctx, colour, 0.35);
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.2;
    ctx.beginPath();
    ctx.moveTo(dir * 0.6, 0);
    ctx.lineTo(dir * 2.6, -0.6);
    ctx.stroke();
  }
  dot(ctx, 0, 0, 0.8, colour, 0.3);
  ctx.restore();
}

function drawHeadphones(ctx, colour) {
  // Over-ear headphones on the head, the band across the crown.
  ctx.strokeStyle = 'rgba(24,18,44,0.68)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(0, HEAD_Y - 2, 11, Math.PI * 1.08, Math.PI * 1.92);
  ctx.stroke();
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  for (const dir of [-1, 1]) {
    rr(ctx, dir * 10.6 - 1.8, HEAD_Y - 4.6, 3.6, 5.6, 1.4);
    fillPath(ctx, colour, 0.45);
    rr(ctx, dir * 10.6 - 1, HEAD_Y - 3.6, 2, 3.6, 0.8);
    fillPath(ctx, '#ff8fb8', 0.25);
  }
}

function drawCatEars(ctx, colour) {
  ctx.strokeStyle = '#2a1e1a';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(0, HEAD_Y - 2, 10.6, Math.PI * 1.12, Math.PI * 1.88);
  ctx.stroke();
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 3.6, HEAD_Y - 14.6);
    ctx.lineTo(dir * 7.4, HEAD_Y - 20.4);
    ctx.lineTo(dir * 9, HEAD_Y - 12.4);
    ctx.closePath();
    fillPath(ctx, colour, 0.45);
    ctx.beginPath();
    ctx.moveTo(dir * 5, HEAD_Y - 14.4);
    ctx.lineTo(dir * 7.2, HEAD_Y - 18.2);
    ctx.lineTo(dir * 8, HEAD_Y - 13.4);
    ctx.closePath();
    fillPath(ctx, '#ffb0c4', 0);
  }
}

function drawHachimaki(ctx, colour, t) {
  // A study headband with the rising-sun dot, tied at the side with tails.
  ctx.beginPath();
  ctx.moveTo(-10, HEAD_Y - 9.6);
  ctx.quadraticCurveTo(0, HEAD_Y - 12.4, 10, HEAD_Y - 9.6);
  ctx.lineTo(10, HEAD_Y - 7.4);
  ctx.quadraticCurveTo(0, HEAD_Y - 10.2, -10, HEAD_Y - 7.4);
  ctx.closePath();
  fillPath(ctx, '#ffffff', 0.45);
  dot(ctx, 0, HEAD_Y - 9.8, 1, colour, 0);
  // 합격 ("pass!") scribbled either side.
  ctx.fillStyle = '#1e1a22';
  for (const x of [-4.4, -3.2, 3.2, 4.4]) ctx.fillRect(x - 0.4, HEAD_Y - 10.2, 0.8, 0.9);
  const flap = Math.sin(t * 2.2) * 0.15;
  ctx.save();
  ctx.translate(10, HEAD_Y - 8.6);
  for (const [r, len] of [[0.5, 5], [0.95, 4]]) {
    ctx.save();
    ctx.rotate(r + flap);
    rr(ctx, 0, -0.8, len, 1.6, 0.4);
    fillPath(ctx, '#ffffff', 0.35);
    ctx.restore();
  }
  ctx.restore();
}

function drawBandana(ctx, colour) {
  ctx.beginPath();
  ctx.moveTo(-10.2, HEAD_Y - 5);
  ctx.bezierCurveTo(-11.8, HEAD_Y - 19.6, 11.8, HEAD_Y - 19.6, 10.2, HEAD_Y - 5);
  ctx.quadraticCurveTo(0, HEAD_Y - 9.6, -10.2, HEAD_Y - 5);
  ctx.closePath();
  fillPath(ctx, colour, 0.5);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const [px, py] of [[-6, -13], [-2, -15.4], [3, -14.2], [7, -10.6], [-7.6, -8.6], [0, -10.6]]) {
    ctx.beginPath();
    ctx.ellipse(px, HEAD_Y + py, 0.7, 0.45, px * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  dot(ctx, 9.8, HEAD_Y - 9.6, 1.3, colour, 0.4);
  for (const r of [0.5, 1.1]) {
    ctx.save();
    ctx.translate(9.8, HEAD_Y - 9.6);
    ctx.rotate(r);
    rr(ctx, 0, -0.7, 4.4, 1.4, 0.4);
    fillPath(ctx, colour, 0.35);
    ctx.restore();
  }
}

/** A thin folded headscarf band (with a ponytail): just across the hairline. */
function drawHeadscarf(ctx, colour) {
  ctx.beginPath();
  ctx.moveTo(-10, HEAD_Y - 9.8);
  ctx.quadraticCurveTo(0, HEAD_Y - 14.4, 10, HEAD_Y - 9.8);
  ctx.lineTo(10, HEAD_Y - 7.4);
  ctx.quadraticCurveTo(0, HEAD_Y - 12, -10, HEAD_Y - 7.4);
  ctx.closePath();
  fillPath(ctx, colour, 0.45);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.arc(i * 2.6, HEAD_Y - 10.8 + Math.abs(i) * 0.3, 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBeanie(ctx, colour) {
  ctx.beginPath();
  ctx.moveTo(-10.4, HEAD_Y - 8);
  ctx.bezierCurveTo(-11.6, HEAD_Y - 22.6, 11.6, HEAD_Y - 22.6, 10.4, HEAD_Y - 8);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, HEAD_Y - 20, 0, HEAD_Y - 8);
  g.addColorStop(0, shadeColor(colour, 0.15));
  g.addColorStop(1, shadeColor(colour, -0.1));
  fillPath(ctx, g, 0.55);
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = shadeColor(colour, -0.25);
  ctx.lineWidth = 0.3;
  for (let x = -9; x <= 9; x += 1.5) {
    ctx.beginPath();
    ctx.moveTo(x, HEAD_Y - 9);
    ctx.quadraticCurveTo(x * 0.7, HEAD_Y - 16, x * 0.2, HEAD_Y - 20);
    ctx.stroke();
  }
  ctx.restore();
  rr(ctx, -10.8, HEAD_Y - 10.6, 21.6, 3.6, 1);
  fillPath(ctx, shadeColor(colour, -0.08), 0.5);
  ctx.strokeStyle = shadeColor(colour, -0.28);
  ctx.lineWidth = 0.28;
  for (let x = -10; x <= 10; x += 1) {
    ctx.beginPath();
    ctx.moveTo(x, HEAD_Y - 10.2);
    ctx.lineTo(x, HEAD_Y - 7.4);
    ctx.stroke();
  }
  // A little woven label.
  rr(ctx, 4.6, HEAD_Y - 10, 2.8, 2, 0.2);
  fillPath(ctx, '#2a2a34', 0.2);
}

function drawFlatCap(ctx, colour) {
  // A tweed flat cap, its peak over the brow.
  ctx.beginPath();
  ctx.moveTo(-10.6, HEAD_Y - 8.4);
  ctx.bezierCurveTo(-12, HEAD_Y - 20, 10, HEAD_Y - 21, 11.6, HEAD_Y - 10.6);
  ctx.quadraticCurveTo(12, HEAD_Y - 8.4, 9.6, HEAD_Y - 8);
  ctx.closePath();
  fillPath(ctx, colour, 0.55);
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 0.25;
  for (let x = -12; x <= 12; x += 1.1) {
    ctx.beginPath();
    ctx.moveTo(x, HEAD_Y - 22);
    ctx.lineTo(x + 4, HEAD_Y - 6);
    ctx.stroke();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(-9.6, HEAD_Y - 8.6);
  ctx.quadraticCurveTo(0, HEAD_Y - 10.6, 10.4, HEAD_Y - 8.4);
  ctx.quadraticCurveTo(1, HEAD_Y - 5, -9.6, HEAD_Y - 8.6);
  ctx.closePath();
  fillPath(ctx, shadeColor(colour, -0.2), 0.45);
  dot(ctx, 1.4, HEAD_Y - 18.2, 0.6, shadeColor(colour, -0.2), 0.2);
}

function drawBikeHelmet(ctx, colour) {
  ctx.beginPath();
  ctx.moveTo(-11.2, HEAD_Y - 6.6);
  ctx.bezierCurveTo(-12.6, HEAD_Y - 22.4, 12.6, HEAD_Y - 22.4, 11.2, HEAD_Y - 6.6);
  ctx.quadraticCurveTo(0, HEAD_Y - 9.4, -11.2, HEAD_Y - 6.6);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, HEAD_Y - 21, 0, HEAD_Y - 7);
  g.addColorStop(0, shadeColor(colour, 0.25));
  g.addColorStop(1, shadeColor(colour, -0.12));
  fillPath(ctx, g, 0.6);
  // Vents, a stripe and a shine.
  for (const x of [-4.4, 0, 4.4]) {
    rr(ctx, x - 1, HEAD_Y - 18.4 + Math.abs(x) * 0.25, 2, 4.6, 0.9);
    fillPath(ctx, '#2a2a34', 0.3);
  }
  ctx.strokeStyle = '#e06a5b';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-10.6, HEAD_Y - 9.6);
  ctx.quadraticCurveTo(0, HEAD_Y - 12.4, 10.6, HEAD_Y - 9.6);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(-7.6, HEAD_Y - 15.4);
  ctx.quadraticCurveTo(-5.6, HEAD_Y - 18.6, -2.4, HEAD_Y - 19.6);
  ctx.stroke();
  // The chin strap.
  ctx.strokeStyle = '#2a2a34';
  ctx.lineWidth = 0.5;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 9.6, HEAD_Y - 6.4);
    ctx.lineTo(dir * 5.6, HEAD_Y + 9);
    ctx.stroke();
  }
  rr(ctx, -1.4, HEAD_Y + 9.6, 2.8, 1.4, 0.4);
  fillPath(ctx, '#2a2a34', 0.2);
}

function drawBeret(ctx, colour) {
  ctx.save();
  ctx.translate(-1.6, HEAD_Y - 15.4);
  ctx.rotate(-0.2);
  ctx.beginPath();
  ctx.ellipse(0, 0, 11, 4.6, 0, 0, Math.PI * 2);
  const g = ctx.createLinearGradient(0, -4.6, 0, 4.6);
  g.addColorStop(0, shadeColor(colour, 0.15));
  g.addColorStop(1, shadeColor(colour, -0.15));
  fillPath(ctx, g, 0.55);
  rr(ctx, -9.4, 2, 18.8, 1.6, 0.8);
  fillPath(ctx, shadeColor(colour, -0.2), 0.4);
  rr(ctx, -0.5, -6, 1, 1.8, 0.4);
  fillPath(ctx, shadeColor(colour, -0.2), 0.3);
  ctx.restore();
}

function drawBucketHat(ctx, colour) {
  ctx.beginPath();
  ctx.moveTo(-14.4, HEAD_Y - 6.4);
  ctx.quadraticCurveTo(0, HEAD_Y - 11, 14.4, HEAD_Y - 6.4);
  ctx.lineTo(10.4, HEAD_Y - 10.6);
  ctx.quadraticCurveTo(0, HEAD_Y - 13.4, -10.4, HEAD_Y - 10.6);
  ctx.closePath();
  fillPath(ctx, shadeColor(colour, -0.1), 0.5);
  ctx.beginPath();
  ctx.moveTo(-10.2, HEAD_Y - 10.4);
  ctx.bezierCurveTo(-10.6, HEAD_Y - 21.4, 10.6, HEAD_Y - 21.4, 10.2, HEAD_Y - 10.4);
  ctx.closePath();
  fillPath(ctx, colour, 0.5);
  // Rows of stitching round the brim, and a woven tab.
  ctx.strokeStyle = shadeColor(colour, 0.3);
  ctx.lineWidth = 0.22;
  ctx.setLineDash([0.4, 0.3]);
  for (const off of [0.9, 2]) {
    ctx.beginPath();
    ctx.moveTo(-13.6 + off, HEAD_Y - 7 - off * 0.6);
    ctx.quadraticCurveTo(0, HEAD_Y - 11.4 - off * 0.3, 13.6 - off, HEAD_Y - 7 - off * 0.6);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  rr(ctx, 5, HEAD_Y - 13.6, 2.6, 1.6, 0.2);
  fillPath(ctx, '#ffffff', 0.2);
}

function drawBaseballCap(ctx, colour) {
  ctx.beginPath();
  ctx.moveTo(-10.4, HEAD_Y - 8.6);
  ctx.bezierCurveTo(-11.2, HEAD_Y - 22, 11.2, HEAD_Y - 22, 10.4, HEAD_Y - 8.6);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, HEAD_Y - 21, 0, HEAD_Y - 8);
  g.addColorStop(0, shadeColor(colour, 0.15));
  g.addColorStop(1, shadeColor(colour, -0.1));
  fillPath(ctx, g, 0.55);
  ctx.strokeStyle = shadeColor(colour, -0.28);
  ctx.lineWidth = 0.3;
  for (const x of [-4, 4]) {
    ctx.beginPath();
    ctx.moveTo(x * 0.3, HEAD_Y - 18.6);
    ctx.quadraticCurveTo(x, HEAD_Y - 15, x * 1.6, HEAD_Y - 9);
    ctx.stroke();
  }
  dot(ctx, 0, HEAD_Y - 18.8, 0.7, shadeColor(colour, -0.2), 0.2);
  // The curved brim, seen from the front.
  ctx.beginPath();
  ctx.moveTo(-10, HEAD_Y - 9);
  ctx.quadraticCurveTo(0, HEAD_Y - 11, 10, HEAD_Y - 9);
  ctx.quadraticCurveTo(0, HEAD_Y - 4.6, -10, HEAD_Y - 9);
  ctx.closePath();
  fillPath(ctx, shadeColor(colour, -0.22), 0.45);
  // A logo on the front panel.
  dot(ctx, 0, HEAD_Y - 14, 1.8, '#ffffff', 0.25);
  ctx.fillStyle = colour;
  ctx.fillRect(-0.9, HEAD_Y - 14.6, 1.8, 1.2);
}

function drawFlowerCrown(ctx, colour) {
  const flowers = [[-9, -9.6], [-6.4, -12.6], [-3.2, -14.2], [0, -14.8], [3.2, -14.2], [6.4, -12.6], [9, -9.6]];
  ctx.strokeStyle = '#5a8a4a';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  flowers.forEach(([x, y], i) => (i ? ctx.lineTo(x, HEAD_Y + y) : ctx.moveTo(x, HEAD_Y + y)));
  ctx.stroke();
  flowers.forEach(([x, y], i) => {
    if (i % 2) {
      ctx.save();
      ctx.translate(x - 1.2, HEAD_Y + y + 0.6);
      ctx.rotate(-0.6);
      ctx.beginPath();
      ctx.ellipse(0, 0, 1.2, 0.55, 0, 0, Math.PI * 2);
      fillPath(ctx, '#7ab86a', 0.2);
      ctx.restore();
    }
    const c = i % 3 === 1 ? '#ffffff' : i % 3 === 2 ? '#ffd166' : colour;
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * 0.9, HEAD_Y + y + Math.sin(a) * 0.9, 0.8, 0.55, a, 0, Math.PI * 2);
      fillPath(ctx, c, 0.18);
    }
    dot(ctx, x, HEAD_Y + y, 0.45, '#e8a83a', 0);
  });
}

function drawSunhat(ctx, colour) {
  // A wide-brimmed straw sun visor-hat, ribbon band and all.
  ctx.beginPath();
  ctx.ellipse(0, HEAD_Y - 11, 17, 3.6, 0, 0, Math.PI * 2);
  fillPath(ctx, colour, 0.55);
  ctx.strokeStyle = shadeColor(colour, -0.2);
  ctx.lineWidth = 0.25;
  for (const r of [12, 14.6]) {
    ctx.beginPath();
    ctx.ellipse(0, HEAD_Y - 11, r, r * 0.21, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-9, HEAD_Y - 11.6);
  ctx.bezierCurveTo(-9.6, HEAD_Y - 21.6, 9.6, HEAD_Y - 21.6, 9, HEAD_Y - 11.6);
  ctx.closePath();
  fillPath(ctx, shadeColor(colour, 0.05), 0.5);
  rr(ctx, -9.2, HEAD_Y - 14.4, 18.4, 2.4, 0.4);
  fillPath(ctx, '#e8709c', 0.35);
  drawBow(ctx, 7, HEAD_Y - 13.2, '#e8709c', 0.7);
}

function drawWitchHat(ctx, colour, t) {
  const tip = Math.sin(t * 1.2) * 0.8;
  ctx.beginPath();
  ctx.ellipse(0, HEAD_Y - 12.2, 15, 3.4, 0, 0, Math.PI * 2);
  fillPath(ctx, colour, 0.55);
  ctx.beginPath();
  ctx.moveTo(-8.6, HEAD_Y - 12.6);
  ctx.quadraticCurveTo(-5, HEAD_Y - 24, 1 + tip, HEAD_Y - 32);
  ctx.quadraticCurveTo(5 + tip, HEAD_Y - 30, 7 + tip * 1.5, HEAD_Y - 28);
  ctx.quadraticCurveTo(3.6, HEAD_Y - 24, 8.6, HEAD_Y - 12.6);
  ctx.closePath();
  const g = ctx.createLinearGradient(-8, 0, 8, 0);
  g.addColorStop(0, shadeColor(colour, 0.15));
  g.addColorStop(1, shadeColor(colour, -0.2));
  fillPath(ctx, g, 0.55);
  rr(ctx, -8.6, HEAD_Y - 15.6, 17.2, 2.6, 0.5);
  fillPath(ctx, '#e8c25a', 0.35);
  // A buckle and a little silver star charm.
  rr(ctx, -1.6, HEAD_Y - 16, 3.2, 3.4, 0.3);
  fillPath(ctx, '#8a6a2a', 0.3);
  rr(ctx, -0.8, HEAD_Y - 15.2, 1.6, 1.8, 0.2);
  fillPath(ctx, colour, 0.15);
  ctx.fillStyle = '#d6dae4';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.45 : 1;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const px = 4 + tip + Math.cos(a) * r;
    const py = HEAD_Y - 22 + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}
