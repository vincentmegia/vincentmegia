// Hospital Shift's furniture and set dressing in the anime style
// (docs/features/hospital-shift.md — the user: "adjust the objects", then
// all four of: redraw them anime-style, resize, re-space, add more). Every
// station's interior (except the Coffee Machine, whose original
// Library Shift art the user asked to keep — it's in hospital-game.js)
// and every decor prop is drawn here with the same kit
// as the rest of the game (hospital/anime-ui.js): pastel fills, soft
// top-lit shading, deep-plum line art and small cute details.
//
// Pure canvas drawing (no DOM, no game state). Station drawers are called
// with the context already translated to the station's center and get its
// box `st` ({w, h, floor, targetFloor}); anything that depends on the game
// (the patient on the OR table, the cabinet's bottle colors) comes in
// through `opts`. Decor drawers get a prop from floor-plan.js's
// buildDecor() ({x, y, w, h}, center-anchored, in world coordinates).

import { ANIME, sparkle, tint } from './anime-ui.js';

const INK = ANIME.ink;

function path(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** A rounded rect with a top-lit gradient of `color` and plum line art. */
function block(ctx, x, y, w, h, r, color, line = 1.4) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, tint(color, 0.22));
  g.addColorStop(1, tint(color, -0.06));
  ctx.fillStyle = g;
  path(ctx, x, y, w, h, r);
  ctx.fill();
  if (line > 0) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = line;
    ctx.stroke();
  }
}

/** A flat outlined rounded rect. */
function flat(ctx, x, y, w, h, r, color, line = 1.2) {
  ctx.fillStyle = color;
  path(ctx, x, y, w, h, r);
  ctx.fill();
  if (line > 0) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = line;
    ctx.stroke();
  }
}

function circle(ctx, x, y, r, color, line = 1.2) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  if (line > 0) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = line;
    ctx.stroke();
  }
}

/** A diagonal glass shine across a rect. */
function glassShine(ctx, x, y, w, h) {
  ctx.save();
  path(ctx, x, y, w, h, 2);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  for (const off of [0.15, 0.5]) {
    const sx = x + w * off;
    ctx.beginPath();
    ctx.moveTo(sx, y + h);
    ctx.lineTo(sx + 8, y + h);
    ctx.lineTo(sx + 8 + h * 0.6, y);
    ctx.lineTo(sx + h * 0.6, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** A small red-cross badge centered on (x, y). */
function crossBadge(ctx, x, y, size = 16) {
  flat(ctx, x - size / 2, y - size / 2, size, size, size * 0.28, '#ffffff', 1.2);
  ctx.fillStyle = ANIME.coralDeep;
  const t = size * 0.22;
  ctx.fillRect(x - t / 2, y - size * 0.32, t, size * 0.64);
  ctx.fillRect(x - size * 0.32, y - t / 2, size * 0.64, t);
}

/** A tiny ECG trace inside (x, y, w, h). */
function ecg(ctx, x, y, w, h, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.3;
  ctx.lineJoin = 'round';
  const mid = y + h / 2;
  ctx.beginPath();
  ctx.moveTo(x, mid);
  ctx.lineTo(x + w * 0.3, mid);
  ctx.lineTo(x + w * 0.38, y + h * 0.15);
  ctx.lineTo(x + w * 0.48, y + h * 0.9);
  ctx.lineTo(x + w * 0.56, mid);
  ctx.lineTo(x + w, mid);
  ctx.stroke();
}

/** A tiny pink heart centered on (x, y). */
function heart(ctx, x, y, s, color = ANIME.pinkDeep) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.8);
  ctx.bezierCurveTo(x - s * 1.2, y, x - s * 0.6, y - s * 0.9, x, y - s * 0.3);
  ctx.bezierCurveTo(x + s * 0.6, y - s * 0.9, x + s * 1.2, y, x, y + s * 0.8);
  ctx.fill();
}

/** A kawaii face: two dot eyes, a smile, blush. */
function kawaii(ctx, x, y, s = 1) {
  ctx.fillStyle = INK;
  for (const dx of [-3, 3]) {
    ctx.beginPath();
    ctx.arc(x + dx * s, y, 1 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.9 * s;
  ctx.beginPath();
  ctx.arc(x, y + 1.2 * s, 1.6 * s, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,143,184,0.6)';
  for (const dx of [-5, 5]) {
    ctx.beginPath();
    ctx.ellipse(x + dx * s, y + 2 * s, 1.4 * s, 0.8 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Stations (context translated to the station's center)
// ---------------------------------------------------------------------------

/** The Charge Nurse's office: a pastel door with a round window, plaque and a heart note. */
export function drawOffice(ctx, st) {
  const hw = st.w / 2;
  const hh = st.h / 2;
  const dw = st.w - 30;
  const dx = -dw / 2;
  const dy = -hh + 14;
  const dh = st.h - 18;
  block(ctx, dx - 4, dy - 4, dw + 8, dh + 4, 6, '#9fb8d8', 1.4); // frame
  block(ctx, dx, dy, dw, dh, 4, '#dcebff', 1.4); // door
  // Panels.
  ctx.strokeStyle = 'rgba(59,42,74,0.35)';
  ctx.lineWidth = 1;
  path(ctx, dx + 6, dy + 32, dw - 12, 16, 3);
  ctx.stroke();
  path(ctx, dx + 6, dy + 52, dw - 12, dh - 58, 3);
  ctx.stroke();
  // Round window with a reflection.
  circle(ctx, 0, dy + 18, 8, '#c9ecff', 1.3);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, dy + 18, 5, Math.PI * 1.1, Math.PI * 1.5);
  ctx.stroke();
  // Gold plaque.
  flat(ctx, -30, -hh + 2, 60, 11, 3, ANIME.gold, 1.2);
  ctx.fillStyle = INK;
  ctx.font = 'bold 6.5px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CHARGE NURSE', 0, -hh + 7.8);
  // Doorknob and a pink heart note taped on.
  circle(ctx, dx + dw - 8, dy + dh * 0.55, 3, ANIME.gold, 1.1);
  flat(ctx, dx + 7, dy + 36, 13, 10, 1.5, '#ffe3ee', 0.9);
  heart(ctx, dx + 13.5, dy + 41, 3.2);
  sparkle(ctx, hw - 10, -hh + 22, 3.5, '#ffffff');
}

/** The Triage Desk: a peach counter with a monitor, clipboard, bell and pen cup. */
export function drawTriageDesk(ctx, st) {
  const hw = st.w / 2;
  const hh = st.h / 2;
  // Counter: a wooden top over a peach front with a soft stripe.
  block(ctx, -hw + 6, 2, st.w - 12, hh - 6, 8, '#ffcfa8', 1.5);
  flat(ctx, -hw + 6, 12, st.w - 12, 6, 0, 'rgba(255,255,255,0.35)', 0);
  block(ctx, -hw + 2, -6, st.w - 4, 10, 5, '#e8b58a', 1.5);
  heart(ctx, 0, hh - 14, 4.5, 'rgba(232,85,143,0.7)');
  // Monitor on a stand.
  flat(ctx, -32, -6, 10, 4, 1, '#8a8aa0', 1);
  block(ctx, -48, -36, 42, 30, 5, '#5a5a78', 1.5);
  flat(ctx, -44, -32, 34, 22, 3, '#bff2e0', 1);
  ecg(ctx, -43, -30, 32, 18, ANIME.mintDeep);
  heart(ctx, -14, -27, 2.4);
  // Clipboard.
  block(ctx, 10, -34, 24, 30, 3, '#d8a070', 1.3);
  flat(ctx, 13, -30, 18, 23, 1.5, '#ffffff', 0.9);
  flat(ctx, 17, -37, 10, 6, 2, '#b8b4c8', 1);
  ctx.fillStyle = 'rgba(59,42,74,0.35)';
  for (let i = 0; i < 4; i++) ctx.fillRect(16, -25 + i * 4.5, 12, 1.2);
  // Service bell and a cup of pens.
  ctx.fillStyle = ANIME.gold;
  ctx.beginPath();
  ctx.arc(46, -6, 8, Math.PI, 0);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  flat(ctx, 36, -7, 20, 3, 1.5, ANIME.goldDeep, 1);
  circle(ctx, 46, -15, 1.8, ANIME.goldDeep, 0.9);
  flat(ctx, -hw + 10, -20, 13, 15, 3, ANIME.lavender, 1.1);
  for (const [px, c] of [[-hw + 13, ANIME.pinkDeep], [-hw + 16.5, ANIME.skyDeep], [-hw + 20, ANIME.mintDeep]]) {
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, -20);
    ctx.lineTo(px + (px - (-hw + 16.5)) * 0.25, -29);
    ctx.stroke();
  }
  crossBadge(ctx, -hw + 16, -hh + 12, 16);
}

/**
 * The Med Cabinet: a white glass-door cabinet, three shelves of capped
 * bottles (`opts.colors`), glass shine and a cross badge on top.
 */
export function drawMedCabinet(ctx, st, opts = {}) {
  const colors = opts.colors?.length ? opts.colors : [ANIME.coral, ANIME.sky, ANIME.gold, ANIME.mint, ANIME.lavender];
  const hw = st.w / 2;
  const hh = st.h / 2;
  const x = -hw + 8;
  const y = -hh + 12;
  const w = st.w - 16;
  const h = st.h - 18;
  block(ctx, x, y, w, h, 6, '#ffffff', 1.5);
  flat(ctx, x + 4, y + 4, w - 8, h - 8, 3, '#eaf4ff', 1);
  for (let shelf = 0; shelf < 3; shelf++) {
    const sy = y + 4 + (shelf + 1) * ((h - 8) / 3);
    for (let b = 0; b < 6; b++) {
      const bx = x + 9 + b * ((w - 18) / 6) + (b >= 3 ? 2 : 0);
      const color = colors[(shelf * 6 + b) % colors.length];
      flat(ctx, bx, sy - 13, 7, 11, 2, color, 0.8);
      flat(ctx, bx + 0.5, sy - 15.5, 6, 3, 1, '#ffffff', 0.7);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillRect(bx + 1.5, sy - 9, 4, 2.5);
    }
    ctx.fillStyle = tint('#c9b8ff', -0.1);
    ctx.fillRect(x + 4, sy - 2, w - 8, 2);
  }
  // Two glass doors meeting in the middle, with handles.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, y + 4);
  ctx.lineTo(0, y + h - 4);
  ctx.stroke();
  glassShine(ctx, x + 4, y + 4, w - 8, h - 8);
  flat(ctx, -5, 0, 3, 10, 1.5, ANIME.lavenderDeep, 0.8);
  flat(ctx, 2, 0, 3, 10, 1.5, ANIME.lavenderDeep, 0.8);
  crossBadge(ctx, 0, -hh + 8, 16);
}

/**
 * The Operating Room: mint tiles, a glowing overhead lamp, the table with
 * its sheet, a monitor and an instrument tray. `opts.drawPatientOnTable`
 * draws whoever is on the table (centered, feet at the given y).
 */
export function drawOperatingRoom(ctx, st, opts = {}) {
  const hw = st.w / 2;
  const hh = st.h / 2;
  ctx.save();
  path(ctx, -hw, -hh, st.w, st.h, 12);
  ctx.clip();
  ctx.fillStyle = '#d4f5e8';
  ctx.fillRect(-hw, -hh, st.w, st.h);
  ctx.strokeStyle = 'rgba(63,181,143,0.22)';
  ctx.lineWidth = 1;
  for (let gx = -hw; gx < hw; gx += 15) { ctx.beginPath(); ctx.moveTo(gx, -hh); ctx.lineTo(gx, hh); ctx.stroke(); }
  for (let gy = -hh; gy < hh; gy += 15) { ctx.beginPath(); ctx.moveTo(-hw, gy); ctx.lineTo(hw, gy); ctx.stroke(); }
  const glow = ctx.createRadialGradient(0, -4, 6, 0, -4, 70);
  glow.addColorStop(0, 'rgba(255,250,214,0.95)');
  glow.addColorStop(1, 'rgba(255,250,214,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-hw, -hh, st.w, st.h);
  ctx.restore();
  // Table and sheet.
  block(ctx, -24, -50, 48, 94, 10, '#b8b4d8', 1.5);
  flat(ctx, -20, -46, 40, 86, 8, '#f4fffb', 1);
  flat(ctx, -12, -43, 24, 12, 6, '#ffffff', 1);
  if (opts.drawPatientOnTable) {
    opts.drawPatientOnTable(0, 8);
    flat(ctx, -19, -14, 38, 52, 6, '#9fe0c8', 1.1);
  }
  // Overhead lamp: a gold ring with a soft lens.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.arc(0, -4, 20, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = ANIME.gold;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  sparkle(ctx, 14, -20, 5, '#ffffff');
  // Monitor (top-left) and instrument tray (bottom-right).
  block(ctx, -hw + 8, -hh + 10, 32, 24, 4, '#5a5a78', 1.3);
  flat(ctx, -hw + 11, -hh + 13, 26, 18, 2, '#1f2a3a', 0.8);
  ecg(ctx, -hw + 12, -hh + 15, 24, 14, '#8fe3c8');
  block(ctx, hw - 34, 22, 26, 34, 4, '#e4e6f0', 1.2);
  ctx.strokeStyle = '#8a8aa0';
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(hw - 28 + i * 7, 27);
    ctx.lineTo(hw - 28 + i * 7, 50);
    ctx.stroke();
  }
  // A little "OR" sign.
  flat(ctx, hw - 30, -hh + 8, 22, 12, 4, ANIME.mintDeep, 1);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('OR', hw - 19, -hh + 14.5);
}

/** The Stairs: pastel steps with plum edges, a handrail and an arrow badge. */
export function drawStairs(ctx, st) {
  const half = st.w / 2;
  const steps = 5;
  const stepH = (half * 2 - 18) / steps;
  for (let i = 0; i < steps; i++) {
    const y = half - 9 - (i + 1) * stepH;
    const inset = 9 + i * 2.6;
    block(ctx, -half + inset, y, half * 2 - inset * 2, stepH, 2, tint('#b9d4f2', 0.1 + i * 0.12), 1.1);
    ctx.fillStyle = 'rgba(59,42,74,0.18)';
    ctx.fillRect(-half + inset + 1, y + stepH - 3, half * 2 - inset * 2 - 2, 2);
  }
  // Handrail.
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-half + 8, half - 11);
  ctx.lineTo(-half + 19, -half + 11);
  ctx.stroke();
  ctx.strokeStyle = '#e8b58a';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.lineCap = 'butt';
  // Arrow badge: up to the Supply Room, down to the ER.
  const dir = st.targetFloor > st.floor ? -1 : 1;
  circle(ctx, half - 14, -half + 14, 9, '#ffffff', 1.3);
  ctx.fillStyle = ANIME.skyDeep;
  ctx.beginPath();
  const ay = -half + 14;
  ctx.moveTo(half - 14, ay + dir * 5.5);
  ctx.lineTo(half - 19.5, ay - dir * 3);
  ctx.lineTo(half - 8.5, ay - dir * 3);
  ctx.closePath();
  ctx.fill();
}

/** The Elevator: lavender-silver doors, a floor indicator and a glowing call button. */
export function drawElevator(ctx, st, opts = {}) {
  const half = st.w / 2;
  const t = opts.t ?? 0;
  flat(ctx, -16, -half + 5, 32, 12, 5, '#3b2a4a', 1.2);
  ctx.fillStyle = ANIME.gold;
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${st.targetFloor > st.floor ? '▲' : '▼'} ${st.targetFloor}`, 0, -half + 11.5);
  block(ctx, -28, -half + 20, 56, half * 2 - 26, 5, '#ece6fa', 1.4);
  for (const dx of [-25, 0.5]) {
    block(ctx, dx, -half + 23, 24.5, half * 2 - 32, 3, '#c9c0e6', 1.1);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(dx + 4, -half + 26, 3, half * 2 - 38);
  }
  flat(ctx, 31, -8, 9, 18, 4, '#ece6fa', 1.1);
  const pulse = 0.65 + 0.35 * Math.sin(t * 3);
  ctx.save();
  ctx.globalAlpha = pulse;
  circle(ctx, 35.5, 1, 2.8, ANIME.gold, 0.9);
  ctx.restore();
}

/** A bandage roll seen side-on (x, y its center), its loose end trailing. */
export function drawBandageRoll(ctx, x, y, s = 1) {
  flat(ctx, x - 9 * s, y + 5 * s, 7 * s, 9 * s, 1.5 * s, '#fffdf6', 0.8 * s);
  flat(ctx, x - 9 * s, y - 7 * s, 18 * s, 14 * s, 4 * s, '#fffdf6', 1 * s);
  ctx.strokeStyle = 'rgba(201,184,255,0.9)';
  ctx.lineWidth = 1 * s;
  for (const dx of [-4, 0, 4]) {
    ctx.beginPath();
    ctx.moveTo(x + dx * s, y - 6 * s);
    ctx.lineTo(x + dx * s, y + 6 * s);
    ctx.stroke();
  }
  ctx.fillStyle = '#f0e8f8';
  ctx.beginPath();
  ctx.ellipse(x + 9 * s, y, 3 * s, 7 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1 * s;
  ctx.stroke();
  circle(ctx, x + 9 * s, y, 1.4 * s, '#c9b8ff', 0);
}

/** The Supply Cart: a pastel cart with bandage rolls on top and boxes below. */
export function drawSupplyCart(ctx, st) {
  const hw = st.w / 2;
  const hh = st.h / 2;
  block(ctx, -hw + 8, -hh + 10, st.w - 16, st.h - 24, 8, '#d8e4f4', 1.5);
  flat(ctx, -hw + 8, -4, st.w - 16, 4, 0, '#a8b8d0', 1);
  for (let i = 0; i < 4; i++) drawBandageRoll(ctx, -hw + 28 + i * ((st.w - 40) / 4), -hh + 26, 0.85);
  block(ctx, -hw + 16, 6, 36, 22, 4, '#ffffff', 1.2);
  ctx.fillStyle = ANIME.coralDeep;
  ctx.fillRect(-hw + 32, 10, 4, 14);
  ctx.fillRect(-hw + 27, 15, 14, 4);
  block(ctx, -hw + 60, 6, 36, 22, 4, '#ffd1e3', 1.2);
  kawaii(ctx, -hw + 78, 16, 0.9);
  // Handle and wheels.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(hw - 8, -hh + 14);
  ctx.lineTo(hw - 2, -hh + 8);
  ctx.stroke();
  for (const wx of [-hw + 16, hw - 16]) circle(ctx, wx, hh - 7, 4.5, '#5a5a78', 1.2);
}

// ---------------------------------------------------------------------------
// Surgery items (rules.js SURGERY_ITEMS + each source's decoys)
// ---------------------------------------------------------------------------

function drawOrgan(ctx, x, y, s, kind) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = INK;
  if (kind === 'kidney') {
    ctx.fillStyle = '#d0607a';
    ctx.beginPath();
    ctx.moveTo(4, -9);
    ctx.bezierCurveTo(-10, -12, -12, 10, 2, 9);
    ctx.bezierCurveTo(8, 8, 2, 3, 6, 0);
    ctx.bezierCurveTo(9, -3, 9, -7, 4, -9);
    ctx.fill();
    ctx.stroke();
  } else if (kind === 'liver') {
    ctx.fillStyle = '#a84848';
    ctx.beginPath();
    ctx.moveTo(-11, -4);
    ctx.bezierCurveTo(-8, -10, 10, -10, 11, -5);
    ctx.bezierCurveTo(12, 0, 2, 8, -6, 7);
    ctx.bezierCurveTo(-12, 6, -13, 0, -11, -4);
    ctx.fill();
    ctx.stroke();
  } else if (kind === 'heart' || kind === 'lung') {
    if (kind === 'heart') {
      ctx.fillStyle = '#e04a5f';
      ctx.beginPath();
      ctx.moveTo(0, 9);
      ctx.bezierCurveTo(-13, 1, -8, -11, 0, -5);
      ctx.bezierCurveTo(8, -11, 13, 1, 0, 9);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#7a2a3a';
      ctx.beginPath();
      ctx.moveTo(-2, -7);
      ctx.lineTo(-2, -11);
      ctx.moveTo(2, -7);
      ctx.lineTo(3, -11);
      ctx.stroke();
    } else {
      for (const dir of [-1, 1]) {
        ctx.fillStyle = '#f0a0b0';
        ctx.beginPath();
        ctx.ellipse(dir * 5, 1, 5, 9, dir * 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  } else if (kind === 'cornea') {
    circle(ctx, 0, 0, 8, '#e8f4ff', 1.2);
    circle(ctx, 0, 0, 4, '#7ab0e0', 1);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.ellipse(-3, -3, 2.5, 1.4, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * An item's icon centered on (x, y) at scale s: the scalpel, an organ, an
 * implant, or a decoy by its display name.
 */
export function drawSurgeryItemIcon(ctx, x, y, s, id) {
  const key = String(id).toLowerCase();
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (key === 'scalpel') {
    flat(ctx, -12, -1.8, 13, 3.6, 1.5, '#8f7ae0', 1);
    ctx.fillStyle = '#e8eef8';
    ctx.beginPath();
    ctx.moveTo(1, -2);
    ctx.lineTo(12, -1);
    ctx.quadraticCurveTo(13, 1.5, 9, 2.5);
    ctx.lineTo(1, 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.stroke();
  } else if (key === 'forceps' || key === 'clamp' || key === 'scissors') {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(-11, -5);
    ctx.lineTo(10, 1);
    ctx.moveTo(-11, 5);
    ctx.lineTo(10, -1);
    ctx.stroke();
    ctx.strokeStyle = '#d8dce8';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    if (key !== 'forceps') {
      for (const dy of [-5, 5]) {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.2;
        ctx.fillStyle = key === 'scissors' ? '#ffc2da' : '#c9b8ff';
        ctx.beginPath();
        ctx.arc(-12, dy, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  } else if (['kidney', 'liver', 'heart', 'lung', 'cornea'].includes(key)) {
    drawOrgan(ctx, 0, 0, 1, key);
  } else if (key === 'mesh' || key === 'mesh patch') {
    flat(ctx, -10, -8, 20, 16, 3, '#ffffff', 1.1);
    ctx.strokeStyle = 'rgba(143,122,224,0.6)';
    ctx.lineWidth = 0.8;
    for (let i = -6; i <= 6; i += 4) {
      ctx.beginPath();
      ctx.moveTo(i, -7);
      ctx.lineTo(i, 7);
      ctx.moveTo(-9, i * 0.9);
      ctx.lineTo(9, i * 0.9);
      ctx.stroke();
    }
  } else if (key === 'plate' || key === 'bone plate') {
    flat(ctx, -11, -3.5, 22, 7, 3.5, '#c8d4e8', 1.1);
    for (const hx of [-6, 0, 6]) circle(ctx, hx, 0, 1.4, '#5a5a78', 0);
  } else if (key === 'stent') {
    flat(ctx, -10, -3.5, 20, 7, 3.5, '#e4e6f0', 1.1);
    ctx.strokeStyle = 'rgba(59,42,74,0.5)';
    ctx.lineWidth = 0.8;
    for (let i = -8; i <= 8; i += 3) {
      ctx.beginPath();
      ctx.moveTo(i, -3);
      ctx.lineTo(i + 2, 3);
      ctx.stroke();
    }
  } else {
    // Steel pin and anything else: a thin pin.
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-11, 0);
    ctx.lineTo(11, 0);
    ctx.stroke();
    ctx.strokeStyle = '#d8dce8';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    circle(ctx, -11, 0, 2.4, '#d8dce8', 1);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// The walk-in Operating Room and the Supply Room's Implant Shelf
// ---------------------------------------------------------------------------

/**
 * The operating table under a big ring lamp. `opts.drawPatientOnTable`
 * draws whoever is on it (centered, feet at the given y); `opts.ready`
 * glows the table when the kit is complete.
 */
export function drawOrTable(ctx, st, opts = {}) {
  const hw = st.w / 2;
  const hh = st.h / 2;
  const glow = ctx.createRadialGradient(0, -10, 10, 0, -10, hw + 30);
  glow.addColorStop(0, opts.ready ? 'rgba(255,240,170,0.75)' : 'rgba(255,250,214,0.55)');
  glow.addColorStop(1, 'rgba(255,250,214,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-hw - 30, -hh - 30, st.w + 60, st.h + 60);
  // Pedestal and table.
  flat(ctx, -16, hh - 26, 32, 22, 4, '#9a96b8', 1.3);
  block(ctx, -40, -hh + 14, 80, st.h - 40, 14, '#c9c3e6', 1.6);
  flat(ctx, -34, -hh + 20, 68, st.h - 52, 10, '#f4fffb', 1.1);
  flat(ctx, -18, -hh + 24, 36, 16, 8, '#ffffff', 1.1);
  if (opts.drawPatientOnTable) {
    opts.drawPatientOnTable(0, 12);
    flat(ctx, -30, -10, 60, 66, 8, '#9fe0c8', 1.2);
    ctx.strokeStyle = 'rgba(63,181,143,0.6)';
    ctx.lineWidth = 1;
    for (const y of [6, 22, 38]) {
      ctx.beginPath();
      ctx.moveTo(-26, y);
      ctx.lineTo(26, y);
      ctx.stroke();
    }
  }
  // The ring lamp above.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(0, -hh - 4, 26, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.stroke();
  ctx.strokeStyle = ANIME.gold;
  ctx.lineWidth = 3.5;
  ctx.stroke();
  for (let i = 0; i < 5; i++) circle(ctx, -16 + i * 8, -hh + 18, 2.6, '#fff8d6', 0.9);
  if (opts.ready) sparkle(ctx, hw - 18, -hh + 26, 6, '#ffffff');
}

/** A rolling tray of instruments; the scalpel's spot is empty once you've taken it. */
export function drawInstrumentTray(ctx, st, opts = {}) {
  const hw = st.w / 2;
  const hh = st.h / 2;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  for (const lx of [-hw + 16, hw - 16]) {
    ctx.beginPath();
    ctx.moveTo(lx, 0);
    ctx.lineTo(lx, hh - 8);
    ctx.stroke();
    circle(ctx, lx, hh - 6, 3.5, '#5a5a78', 1);
  }
  block(ctx, -hw + 8, -hh + 12, st.w - 16, 42, 8, '#e4e6f0', 1.5);
  flat(ctx, -hw + 13, -hh + 17, st.w - 26, 32, 5, '#cfe8f2', 1);
  if (!opts.hasScalpel) drawSurgeryItemIcon(ctx, -hw + 32, -hh + 33, 1.1, 'scalpel');
  else {
    ctx.strokeStyle = 'rgba(59,42,74,0.35)';
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(-hw + 18, -hh + 28, 28, 10);
    ctx.setLineDash([]);
  }
  drawSurgeryItemIcon(ctx, 2, -hh + 30, 0.9, 'forceps');
  drawSurgeryItemIcon(ctx, hw - 28, -hh + 36, 0.85, 'scissors');
}

/**
 * The Organ Cooler: a mint cooler with a frosty window showing organ jars
 * (`opts.organs`: ids still in it) and a little snowflake.
 */
export function drawOrganCooler(ctx, st, opts = {}) {
  const hw = st.w / 2;
  const hh = st.h / 2;
  const organs = opts.organs ?? ['kidney', 'liver', 'heart'];
  block(ctx, -hw + 8, -hh + 10, st.w - 16, st.h - 18, 10, '#bfeedd', 1.6);
  flat(ctx, -hw + 14, -hh + 16, st.w - 28, 12, 4, '#ffffff', 1.1);
  ctx.fillStyle = ANIME.mintDeep;
  ctx.font = 'bold 7px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ORGANS', 0, -hh + 22.5);
  flat(ctx, -hw + 14, -hh + 34, st.w - 28, st.h - 54, 6, '#e8fbff', 1.1);
  organs.slice(0, 3).forEach((id, i) => {
    const jx = -hw + 28 + i * ((st.w - 52) / 2);
    const jy = 4;
    flat(ctx, jx - 11, jy - 16, 22, 30, 6, 'rgba(201,236,255,0.9)', 1);
    drawSurgeryItemIcon(ctx, jx, jy, 0.75, id);
  });
  glassShine(ctx, -hw + 14, -hh + 34, st.w - 28, st.h - 54);
  sparkle(ctx, hw - 16, hh - 16, 5, '#ffffff');
}

/** The OR's double swing doors back to the ER, with round windows. */
export function drawOrDoor(ctx, st) {
  const hw = st.w / 2;
  const hh = st.h / 2;
  for (const dir of [-1, 1]) {
    const x = dir < 0 ? -hw + 10 : 1;
    block(ctx, x, -hh + 8, hw - 11, st.h - 14, 5, '#d4f5e8', 1.4);
    circle(ctx, x + (hw - 11) / 2, -hh + 26, 8, '#c9ecff', 1.2);
  }
  flat(ctx, -22, -hh - 2, 44, 12, 4, ANIME.coral, 1.2);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('↓ ER', 0, -hh + 4.5);
}

/** The Supply Room's Implant Shelf: two shelves of mesh patches, bone plates and decoys. */
export function drawImplantShelf(ctx, st) {
  const hw = st.w / 2;
  const hh = st.h / 2;
  block(ctx, -hw + 6, -hh + 8, st.w - 12, st.h - 14, 8, '#e8d4f2', 1.6);
  const rows = [['mesh', 'mesh patch', 'stent'], ['plate', 'steel pin', 'plate']];
  rows.forEach((row, r) => {
    const sy = -hh + 34 + r * 32;
    ctx.fillStyle = tint('#c9b8ff', -0.15);
    ctx.fillRect(-hw + 10, sy, st.w - 20, 3);
    row.forEach((id, i) => drawSurgeryItemIcon(ctx, -hw + 26 + i * ((st.w - 44) / 2), sy - 10, 0.75, id));
  });
}

// ---------------------------------------------------------------------------
// Decor (world coordinates; floor-plan.js's buildDecor)
// ---------------------------------------------------------------------------

function drawWaitingChairs(ctx, d) {
  const colors = ['#ffc2da', '#d8c9ff', '#bfeedd'];
  const cw = d.w / 3 - 4;
  colors.forEach((c, i) => {
    const x = d.x - d.w / 2 + i * (cw + 6);
    const y = d.y - d.h / 2;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x + 4, y + d.h - 6);
    ctx.lineTo(x + 4, y + d.h);
    ctx.moveTo(x + cw - 4, y + d.h - 6);
    ctx.lineTo(x + cw - 4, y + d.h);
    ctx.stroke();
    block(ctx, x, y, cw, d.h * 0.55, 6, c, 1.3); // back
    block(ctx, x - 1, y + d.h * 0.5, cw + 2, d.h * 0.32, 5, tint(c, -0.05), 1.3); // seat
  });
}

function drawWaterCooler(ctx, d) {
  const x = d.x;
  const top = d.y - d.h / 2;
  // Bottle with a shine and bubbles.
  block(ctx, x - 10, top, 20, d.h * 0.42, 7, '#bfe6ff', 1.3);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillRect(x - 6, top + 3, 3, d.h * 0.3);
  circle(ctx, x + 3, top + 10, 1.5, 'rgba(255,255,255,0.8)', 0);
  circle(ctx, x + 5, top + 15, 1, 'rgba(255,255,255,0.8)', 0);
  // Body, taps and a stack of cups.
  block(ctx, x - d.w / 2, top + d.h * 0.4, d.w, d.h * 0.6, 4, '#ffffff', 1.3);
  circle(ctx, x - 5, top + d.h * 0.55, 2.2, ANIME.skyDeep, 0.9);
  circle(ctx, x + 5, top + d.h * 0.55, 2.2, ANIME.coralDeep, 0.9);
  flat(ctx, x - 6, top + d.h * 0.72, 12, 8, 1.5, '#fff6d6', 0.9);
}

function drawPlant(ctx, d) {
  const x = d.x;
  const base = d.y + d.h / 2;
  // Leafy clumps first, then the pot over their stems.
  const leaves = [[-9, -30, 9], [8, -31, 9], [0, -38, 10], [-4, -24, 8], [6, -24, 8]];
  for (const [lx, ly, r] of leaves) circle(ctx, x + lx, base + ly, r, '#8fd6a4', 1.2);
  for (const [lx, ly, r] of leaves.slice(0, 3)) circle(ctx, x + lx - r * 0.3, base + ly - r * 0.3, r * 0.35, 'rgba(255,255,255,0.35)', 0);
  circle(ctx, x + 2, base - 41, 3, '#ffd1e3', 0.9);
  ctx.fillStyle = '#e8956a';
  ctx.beginPath();
  ctx.moveTo(x - 11, base - 18);
  ctx.lineTo(x + 11, base - 18);
  ctx.lineTo(x + 8, base);
  ctx.lineTo(x - 8, base);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.3;
  ctx.stroke();
  flat(ctx, x - 12.5, base - 21, 25, 5, 2, '#f2a882', 1.2);
}

function drawVendingMachine(ctx, d) {
  const x = d.x - d.w / 2;
  const y = d.y - d.h / 2;
  block(ctx, x, y, d.w, d.h, 6, '#c9b8ff', 1.5);
  // Glowing sign.
  flat(ctx, x + 5, y + 4, d.w - 10, 10, 3, '#fff6d6', 1);
  ctx.fillStyle = ANIME.pinkDeep;
  ctx.font = 'bold 7px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SNACKS', d.x, y + 9.5);
  // Window with rows of snacks.
  flat(ctx, x + 5, y + 18, d.w - 18, d.h - 34, 3, '#eaf4ff', 1);
  const snack = [ANIME.coral, ANIME.gold, ANIME.mint, ANIME.sky, ANIME.pink];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 3; col++) {
      flat(ctx, x + 8 + col * 8.5, y + 21 + row * 10, 6, 7, 1.5, snack[(row * 3 + col) % snack.length], 0.7);
    }
  }
  glassShine(ctx, x + 5, y + 18, d.w - 18, d.h - 34);
  // Coin slot and the pickup tray.
  flat(ctx, x + d.w - 11, y + 24, 6, 12, 2, '#ece6fa', 0.9);
  flat(ctx, x + 6, y + d.h - 13, d.w - 12, 8, 2, '#5a5a78', 1);
}

function drawIvPole(ctx, d) {
  const x = d.x;
  const top = d.y - d.h / 2;
  const base = d.y + d.h / 2;
  // Wheeled base and pole.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x - 8, base - 2);
  ctx.lineTo(x + 8, base - 2);
  ctx.stroke();
  circle(ctx, x - 8, base - 1, 2, '#5a5a78', 0.8);
  circle(ctx, x + 8, base - 1, 2, '#5a5a78', 0.8);
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(x, base - 2);
  ctx.lineTo(x, top + 4);
  ctx.stroke();
  ctx.strokeStyle = '#d8d0e0';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // Hook and a fluid bag with its line.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x - 6, top + 4);
  ctx.lineTo(x + 6, top + 4);
  ctx.stroke();
  flat(ctx, x - 5, top + 6, 10, 15, 3, 'rgba(191,230,255,0.95)', 1.1);
  flat(ctx, x - 3, top + 11, 6, 8, 2, '#8fd3ff', 0);
  ctx.strokeStyle = 'rgba(143,211,255,0.9)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, top + 21);
  ctx.quadraticCurveTo(x - 8, top + 40, x - 12, top + 52);
  ctx.stroke();
}

function drawLadder(ctx, d) {
  const x = d.x;
  const top = d.y - d.h / 2;
  const base = d.y + d.h / 2;
  ctx.lineCap = 'round';
  for (const [x0, x1] of [[x - 6, x - 12], [x + 6, x + 12]]) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x0, top);
    ctx.lineTo(x1, base);
    ctx.stroke();
    ctx.strokeStyle = '#e8b58a';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  for (let i = 1; i <= 3; i++) {
    const f = i / 4;
    const y = top + f * d.h;
    const spread = 6 + f * 6;
    flat(ctx, x - spread, y - 2, spread * 2, 4, 1.5, '#f2c8a0', 1);
  }
  flat(ctx, x - 8, top - 3, 16, 5, 2, '#f2c8a0', 1.1);
  ctx.lineCap = 'butt';
}

const DECOR_DRAWERS = {
  'waiting-chairs': drawWaitingChairs,
  'water-cooler': drawWaterCooler,
  plant: drawPlant,
  'vending-machine': drawVendingMachine,
  'iv-pole': drawIvPole,
  ladder: drawLadder,
};

/** Draws one decor prop from buildDecor(); unknown kinds draw nothing. */
export function drawDecor(ctx, d) {
  DECOR_DRAWERS[d.kind]?.(ctx, d);
}

export const DECOR_KINDS = Object.keys(DECOR_DRAWERS);
