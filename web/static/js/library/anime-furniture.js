// Library Shift's station furniture in Hospital Shift's anime style
// (docs/features/library-game.md — the user: "make it like hospital
// shift"). Same kit as hospital/anime-furniture.js: pastel fills with a
// soft top-lit gradient, deep-plum line art, glass shines, sparkles and
// small cute details, built on hospital/anime-ui.js's palette.
//
// Pure canvas drawing (no DOM, no game state). Every drawer is called with
// the context already translated to the station's center and gets its box
// `st` ({w, h}); anything game-dependent (the genre, its titles, the
// locked state) comes in through `opts`.

import { ANIME, sparkle, tint } from '../hospital/anime-ui.js';

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

function heart(ctx, x, y, s, color = ANIME.pinkDeep) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.8);
  ctx.bezierCurveTo(x - s * 1.2, y, x - s * 0.6, y - s * 0.9, x, y - s * 0.3);
  ctx.bezierCurveTo(x + s * 0.6, y - s * 0.9, x + s * 1.2, y, x, y + s * 0.8);
  ctx.fill();
}

/** Centered text with a plum outline, for plaques and signs. */
function plaqueText(ctx, text, x, y, font, fill = '#ffffff', stroke = INK, width = 2.4) {
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

/** A small deterministic PRNG so a shelf's spines are stable across frames. */
function seeded(seedText) {
  let h = 2166136261;
  for (let i = 0; i < seedText.length; i++) h = Math.imul(h ^ seedText.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/** Dark or light ink for text on a spine of this color. */
function inkFor(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 150 ? INK : '#ffffff';
}

// ---------------------------------------------------------------------------
// Stations
// ---------------------------------------------------------------------------

/**
 * A wide wooden bookcase: a glossy genre-colored sign across the top
 * (`opts.sign`, e.g. "추리 · Mystery"), two shelves of outlined spines in
 * tints of the genre's color carrying titles from its pool, and a sparkle.
 *
 * @param {{id: string, w: number, h: number}} st
 * @param {{color: string, sign: string, titles: string[]}} opts
 */
export function drawBookcase(ctx, st, opts) {
  const hw = st.w / 2;
  const hh = st.h / 2;
  const color = opts.color;
  block(ctx, -hw + 3, -hh + 3, st.w - 6, st.h - 6, 8, '#e3b98a', 1.5); // case
  // Sign.
  block(ctx, -hw + 9, -hh + 7, st.w - 18, 15, 7, color, 1.3);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  path(ctx, -hw + 14, -hh + 9, st.w - 28, 4, 2);
  ctx.fill();
  plaqueText(ctx, opts.sign, 0, -hh + 15, 'bold 9.5px sans-serif', '#ffffff', tint(color, -0.5), 2.2);
  // Back panel and shelves.
  const left = -hw + 10;
  const right = hw - 10;
  const top = -hh + 27;
  const bottom = hh - 9;
  flat(ctx, left, top, right - left, bottom - top, 4, '#fff3e6', 1.2);
  const rows = 2;
  const rowH = (bottom - top) / rows;
  const rand = seeded(st.id);
  const titles = opts.titles?.length ? opts.titles : ['Untitled'];
  let titleIndex = Math.floor(rand() * titles.length);
  const palette = [tint(color, 0.55), tint(color, 0.3), color, tint(color, -0.2), '#fff1c8', tint(color, 0.7)];
  for (let r = 0; r < rows; r++) {
    const shelfY = top + (r + 1) * rowH;
    let x = left + 3;
    while (x < right - 5) {
      const w = Math.min(10 + Math.floor(rand() * 3), right - 3 - x);
      if (w < 8) break;
      const h = rowH - 6 - Math.floor(rand() * 4);
      const c = palette[Math.floor(rand() * palette.length)];
      const spineTop = shelfY - 3 - h;
      flat(ctx, x, spineTop, w, h, 2, c, 0.9);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillRect(x + 1.5, spineTop + 2.5, w - 3, 1.2);
      // Title running up the spine: the whole title if it fits, else its
      // longest word, at the largest size (6 → 4.5px) that fits.
      const title = titles[titleIndex++ % titles.length];
      const avail = h - 7;
      const words = title.split(' ').filter((wd) => wd.length > 2).sort((p, q) => q.length - p.length);
      let text = words.length ? words[(r + titleIndex) % words.length] : title;
      let size = 6;
      ctx.font = `bold ${size}px sans-serif`;
      if (ctx.measureText(title).width <= avail) text = title;
      while (size > 4.5 && ctx.measureText(text).width > avail) {
        size -= 0.5;
        ctx.font = `bold ${size}px sans-serif`;
      }
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, spineTop + 4, w, h - 7);
      ctx.clip();
      ctx.translate(x + w / 2, spineTop + h / 2 + 1);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = inkFor(c);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 0, 0.3);
      ctx.restore();
      x += w + 0.6;
    }
    block(ctx, left - 2, shelfY - 3, right - left + 4, 4, 2, '#c9925e', 1);
  }
  sparkle(ctx, hw - 10, -hh + 12, 3.5, '#ffffff');
}

/** The Front Desk: a peach counter with a monitor of book covers, a stack of books, a bell and a plant. */
export function drawFrontDesk(ctx, st) {
  const hw = st.w / 2;
  const hh = st.h / 2;
  block(ctx, -hw + 6, 2, st.w - 12, hh - 6, 8, '#ffcfa8', 1.5);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(-hw + 7, 12, st.w - 14, 6);
  block(ctx, -hw + 2, -6, st.w - 4, 10, 5, '#e8b58a', 1.5);
  heart(ctx, 0, hh - 14, 4.5, 'rgba(232,85,143,0.7)');
  // Monitor with the catalogue on screen.
  flat(ctx, -24, -6, 10, 4, 1, '#8a8aa0', 1);
  block(ctx, -40, -36, 42, 30, 5, '#5a5a78', 1.5);
  flat(ctx, -36, -32, 34, 22, 3, '#d6ecff', 1);
  [ANIME.pink, ANIME.mint, ANIME.gold].forEach((c, i) => flat(ctx, -33 + i * 10, -29, 8, 12, 1.5, c, 0.8));
  ctx.fillStyle = 'rgba(59,42,74,0.35)';
  ctx.fillRect(-33, -14, 28, 1.4);
  // A stack of books.
  [[ANIME.sky, 0], [ANIME.coral, 1], [ANIME.lavender, 2]].forEach(([c, i]) => block(ctx, 6 - i, -12 - i * 7, 24, 6.5, 2, c, 1.1));
  // Service bell.
  ctx.fillStyle = ANIME.gold;
  ctx.beginPath();
  ctx.arc(46, -6, 8, Math.PI, 0);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  flat(ctx, 36, -7, 20, 3, 1.5, ANIME.goldDeep, 1);
  circle(ctx, 46, -15, 1.8, ANIME.goldDeep, 0.9);
  // A little potted plant.
  flat(ctx, -hw + 7, -18, 12, 13, 3, '#f2a98a', 1.1);
  for (const [dx, dy, r] of [[-hw + 13, -24, 5], [-hw + 9, -27, 3.5], [-hw + 17, -28, 3.5]]) circle(ctx, dx, dy, r, ANIME.mint, 1);
  sparkle(ctx, hw - 10, -hh + 10, 3.5, '#ffffff');
}

/** The Return Cart: a wooden cart with two trays of pastel books and wheels, under a RETURNS tag. */
export function drawReturnCart(ctx, st) {
  const hw = st.w / 2;
  const hh = st.h / 2;
  const books = [ANIME.coral, ANIME.sky, ANIME.gold, ANIME.mint, ANIME.lavender, ANIME.pink];
  for (const [ty, n] of [[-3, 6], [17, 5]]) {
    for (let i = 0; i < n; i++) {
      const h = 13 + ((i * 7) % 5);
      flat(ctx, -hw + 14 + i * 9, ty - h, 7.5, h, 1.5, books[(i + (ty > 0 ? 2 : 0)) % books.length], 0.9);
    }
    block(ctx, -hw + 9, ty, st.w - 18, 5, 2.5, '#d9a877', 1.2);
  }
  // Frame posts and handle.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-hw + 10, -8);
  ctx.lineTo(-hw + 10, hh - 14);
  ctx.moveTo(hw - 10, -8);
  ctx.lineTo(hw - 10, hh - 14);
  ctx.moveTo(hw - 10, -8);
  ctx.lineTo(hw - 2, -12);
  ctx.stroke();
  // RETURNS tag, drawn last so the books never cover it.
  flat(ctx, -26, -hh + 5, 52, 14, 7, '#ffffff', 1.2);
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = ANIME.coralDeep;
  ctx.fillText('RETURNS', 0, -hh + 12.5);
  for (const wx of [-hw + 16, hw - 16]) {
    circle(ctx, wx, hh - 10, 5, '#5a5a78', 1.2);
    circle(ctx, wx, hh - 10, 1.8, '#d6ecff', 0.8);
  }
}

/**
 * The Fines Counter as a small room, the way Hospital Shift draws its
 * Operating Room: its own pastel tiles and lamp glow inside the box, a
 * plaque, and the counter with a register and coin stacks.
 */
export function drawFinesRoom(ctx, st) {
  const hw = st.w / 2;
  const hh = st.h / 2;
  ctx.save();
  path(ctx, -hw, -hh, st.w, st.h, 12);
  ctx.clip();
  ctx.strokeStyle = 'rgba(224,80,62,0.14)';
  ctx.lineWidth = 1;
  for (let gx = -hw; gx < hw; gx += 14) { ctx.beginPath(); ctx.moveTo(gx, -hh); ctx.lineTo(gx, hh); ctx.stroke(); }
  for (let gy = -hh; gy < hh; gy += 14) { ctx.beginPath(); ctx.moveTo(-hw, gy); ctx.lineTo(hw, gy); ctx.stroke(); }
  const glow = ctx.createRadialGradient(0, -6, 4, 0, -6, hw);
  glow.addColorStop(0, 'rgba(255,250,225,0.85)');
  glow.addColorStop(1, 'rgba(255,250,225,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-hw, -hh, st.w, st.h);
  ctx.restore();
  // Plaque.
  block(ctx, -36, -hh + 8, 72, 17, 8, ANIME.coral, 1.3);
  plaqueText(ctx, '벌금 · FINES', 0, -hh + 16.8, 'bold 9.5px sans-serif', '#ffffff', ANIME.coralDeep, 2.2);
  // Counter.
  block(ctx, -hw + 12, 12, st.w - 24, hh - 22, 8, '#ffcfa8', 1.5);
  block(ctx, -hw + 8, 6, st.w - 16, 9, 4.5, '#e8b58a', 1.4);
  heart(ctx, 0, hh - 20, 4, 'rgba(232,85,143,0.7)');
  // Register: display, body, keypad, drawer.
  block(ctx, -8, -22, 30, 9, 2, '#5a5a78', 1.2);
  flat(ctx, -5, -20.5, 18, 5.5, 1, '#bff2e0', 0.8);
  block(ctx, -14, -14, 40, 20, 4, ANIME.lavender, 1.3);
  ctx.fillStyle = '#ffffff';
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) ctx.fillRect(-9 + c * 6.5, -10 + r * 4.6, 4.2, 3);
  }
  // Coin stacks.
  for (const [cx, n] of [[-34, 4], [-25, 2]]) {
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i % 2 ? ANIME.goldDeep : ANIME.gold;
      ctx.beginPath();
      ctx.ellipse(cx, 4 - i * 3.6, 5, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }
  sparkle(ctx, hw - 12, -hh + 30, 4, '#ffffff');
}

/** The Boss's Office: Hospital Shift's pastel door (round window, panels, plaque, heart note), labelled BOSS. */
export function drawBossDoor(ctx, st) {
  const hw = st.w / 2;
  const hh = st.h / 2;
  const dw = st.w - 30;
  const dx = -dw / 2;
  const dy = -hh + 14;
  const dh = st.h - 18;
  block(ctx, dx - 4, dy - 4, dw + 8, dh + 4, 6, '#c9a0d8', 1.4);
  block(ctx, dx, dy, dw, dh, 4, '#f2e2ff', 1.4);
  ctx.strokeStyle = 'rgba(59,42,74,0.35)';
  ctx.lineWidth = 1;
  path(ctx, dx + 6, dy + 32, dw - 12, 16, 3);
  ctx.stroke();
  path(ctx, dx + 6, dy + 52, dw - 12, dh - 58, 3);
  ctx.stroke();
  circle(ctx, 0, dy + 18, 8, '#e6dcff', 1.3);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, dy + 18, 5, Math.PI * 1.1, Math.PI * 1.5);
  ctx.stroke();
  flat(ctx, -30, -hh + 2, 60, 11, 3, ANIME.gold, 1.2);
  ctx.fillStyle = INK;
  ctx.font = 'bold 6.5px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('관장 · BOSS', 0, -hh + 7.8);
  circle(ctx, dx + dw - 8, dy + dh * 0.55, 3, ANIME.gold, 1.1);
  flat(ctx, dx + 7, dy + 36, 13, 10, 1.5, '#ffe3ee', 0.9);
  heart(ctx, dx + 13.5, dy + 41, 3.2);
  sparkle(ctx, hw - 10, -hh + 22, 3.5, '#ffffff');
}

/** The Reading Nook: a round rug, a plump pastel armchair with an open book, and a glowing floor lamp. */
export function drawReadingNook(ctx, st) {
  const hw = st.w / 2;
  const hh = st.h / 2;
  ctx.fillStyle = ANIME.lavender;
  ctx.beginPath();
  ctx.ellipse(0, hh - 14, hw - 8, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.1;
  ctx.stroke();
  // Armchair.
  block(ctx, -26, -16, 40, 28, 10, ANIME.pink, 1.4);
  block(ctx, -32, -4, 11, 26, 5, tint(ANIME.pink, -0.12), 1.3);
  block(ctx, 9, -4, 11, 26, 5, tint(ANIME.pink, -0.12), 1.3);
  block(ctx, -22, 4, 32, 15, 6, tint(ANIME.pink, 0.2), 1.3);
  for (const lx of [-27, 14]) flat(ctx, lx, 21, 3.5, 6, 1, '#8a6a4a', 0.8);
  // Open book on the seat.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(-14, 6);
  ctx.quadraticCurveTo(-9, 3, -6, 6);
  ctx.quadraticCurveTo(-3, 3, 2, 6);
  ctx.lineTo(2, 12);
  ctx.quadraticCurveTo(-3, 9, -6, 12);
  ctx.quadraticCurveTo(-9, 9, -14, 12);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.9;
  ctx.stroke();
  heart(ctx, -6, -6, 3);
  // Floor lamp with a warm glow.
  const glow = ctx.createRadialGradient(28, -26, 2, 28, -26, 24);
  glow.addColorStop(0, 'rgba(255,236,160,0.8)');
  glow.addColorStop(1, 'rgba(255,236,160,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(28, -26, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(28, -22);
  ctx.lineTo(28, 22);
  ctx.stroke();
  flat(ctx, 21, 21, 14, 3.5, 1.5, '#5a5a78', 1);
  ctx.fillStyle = ANIME.gold;
  ctx.beginPath();
  ctx.moveTo(20, -22);
  ctx.lineTo(36, -22);
  ctx.lineTo(32, -36);
  ctx.lineTo(24, -36);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  sparkle(ctx, -hw + 10, -hh + 12, 3.5, '#ffffff');
}
