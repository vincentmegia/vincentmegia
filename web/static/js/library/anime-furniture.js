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

/** The bookcase's own wood and paper colours (the genre colour comes in through opts). */
export const BOOKCASE_COLORS = { case: '#e3b98a', back: '#fff3e6', plank: '#c9925e' };

/**
 * Where drawBookcase puts its parts, in the station's centered px: the case,
 * the sign, the back panel the spines stand on, and each shelf (its spine
 * baseline `y` + 3 and its plank). First Person's bookshelf mesh maps its faces
 * onto these same regions of the drawn art (docs/skills/2d-to-3d/SKILL.md),
 * so this is the one contract between the two renderers: move a part here and
 * both views follow.
 *
 * @param {{w: number, h: number}} st
 * @param {number} [rows] shelves (Top-Down draws 2)
 */
export function bookcaseLayout(st, rows = 2) {
  const hw = st.w / 2;
  const hh = st.h / 2;
  const back = { x0: -hw + 10, y0: -hh + 27, x1: hw - 10, y1: hh - 9 };
  const rowH = (back.y1 - back.y0) / rows;
  const shelves = [];
  for (let r = 0; r < rows; r++) {
    const y = back.y0 + (r + 1) * rowH;
    shelves.push({ y, plank: { x0: back.x0 - 2, y0: y - 3, x1: back.x1 + 2, y1: y + 1 } });
  }
  return {
    case: { x0: -hw + 3, y0: -hh + 3, x1: hw - 3, y1: hh - 3 },
    sign: { x0: -hw + 9, y0: -hh + 7, x1: hw - 9, y1: -hh + 22 },
    back,
    rowH,
    shelves,
  };
}

/**
 * A wide wooden bookcase: a glossy genre-colored sign across the top
 * (`opts.sign`, e.g. "추리 · Mystery"), shelves of outlined spines in
 * tints of the genre's color, each carrying a title from its pool (the
 * Korean of a {ko, en} pair, or a plain string), and a sparkle. Top-Down
 * draws 2 shelves; First Person's taller bookshelf asks for `opts.rows`.
 *
 * @param {{id: string, w: number, h: number}} st
 * @param {{color: string, sign: string, titles: (string | {ko: string, en: string})[], rows?: number}} opts
 */
export function drawBookcase(ctx, st, opts) {
  const hw = st.w / 2;
  const hh = st.h / 2;
  const color = opts.color;
  const L = bookcaseLayout(st, opts.rows);
  const sg = L.sign;
  block(ctx, L.case.x0, L.case.y0, L.case.x1 - L.case.x0, L.case.y1 - L.case.y0, 8, BOOKCASE_COLORS.case, 1.5); // case
  // Sign.
  block(ctx, sg.x0, sg.y0, sg.x1 - sg.x0, sg.y1 - sg.y0, 7, color, 1.3);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  path(ctx, -hw + 14, -hh + 9, st.w - 28, 4, 2);
  ctx.fill();
  plaqueText(ctx, opts.sign, 0, -hh + 15, 'bold 9.5px sans-serif', '#ffffff', tint(color, -0.5), 2.2);
  // Back panel and shelves.
  const left = L.back.x0;
  const right = L.back.x1;
  const top = L.back.y0;
  const bottom = L.back.y1;
  flat(ctx, left, top, right - left, bottom - top, 4, BOOKCASE_COLORS.back, 1.2);
  const rowH = L.rowH;
  const rand = seeded(st.id);
  const titles = opts.titles?.length ? opts.titles : ['Untitled'];
  let titleIndex = Math.floor(rand() * titles.length);
  const palette = [tint(color, 0.55), tint(color, 0.3), color, tint(color, -0.2), '#fff1c8', tint(color, 0.7)];
  L.shelves.forEach(({ y: shelfY, plank }, r) => {
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
      // Title running up the spine: the whole Korean title if it fits, else
      // its longest word, at the largest size that fits.
      const entry = titles[titleIndex++ % titles.length];
      const ko = typeof entry === 'string' ? entry : entry.ko;
      const avail = h - 7;
      const fitLine = (text, maxSize, minSize) => {
        const words = text.split(' ').filter((wd) => wd.length > 1).sort((p, q) => q.length - p.length);
        let line = text;
        let size = maxSize;
        ctx.font = `bold ${size}px sans-serif`;
        if (ctx.measureText(text).width > avail && words.length) line = words[(r + titleIndex) % words.length];
        while (size > minSize && ctx.measureText(line).width > avail) {
          size -= 0.5;
          ctx.font = `bold ${size}px sans-serif`;
        }
        return { line, size };
      };
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, spineTop + 3, w, h - 6);
      ctx.clip();
      ctx.translate(x + w / 2, spineTop + h / 2 + 1);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = inkFor(c);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Korean only: a spine is too short for both titles, and cutting each
      // to its longest word pairs Korean and English words that don't match.
      const k = fitLine(ko, 6, 4.5);
      ctx.font = `bold ${k.size}px sans-serif`;
      ctx.fillText(k.line, 0, 0.3);
      ctx.restore();
      x += w + 0.6;
    }
    block(ctx, plank.x0, plank.y0, plank.x1 - plank.x0, plank.y1 - plank.y0, 2, BOOKCASE_COLORS.plank, 1);
  });
  sparkle(ctx, hw - 10, -hh + 12, 3.5, '#ffffff');
}

/**
 * The Coffee Machine's own colours. `ground` is its station tile, the colour
 * Top-Down shows through the clear hopper (the game's STATION_COLORS uses it);
 * `hopperSolid` is that glass composited over the ground, for First Person's
 * untextured hopper faces.
 */
export const COFFEE_MACHINE_COLORS = {
  ground: '#f5d3bd',
  hopper: 'rgba(255,255,255,0.75)',
  hopperSolid: tint('#f5d3bd', 0.75),
  beans: '#6a4a30',
  body: '#7a5a42',
  band: '#8f6c50',
  display: '#9fe0a8',
  buttons: ['#e8b95a', '#e06a5b'],
  bay: '#4a3424',
  steel: '#b0a090',
  drip: '#c47f4e',
  cup: '#fdf8ee',
  coffee: '#6a4a30',
  grateSlot: 'rgba(58,42,42,0.4)',
  steam: 'rgba(255,255,255,0.8)',
};

/**
 * Where drawCoffeeMachine puts its parts, in the station's centered px:
 * the hopper (a trapezoid: `x0`/`x1` across its top, `bx0`/`bx1` across its
 * bottom), the body and its top band, the display and buttons, the recessed
 * brewing bay with the group head, spouts and drip inside it, the cup, and
 * the drip tray. Widths come from `st.w`; the top of the machine hangs from
 * `-st.h / 2` and the bay's contents stand on `st.h / 2`, so a taller box
 * (First Person's) only makes the bay taller. Top-Down's box is square
 * (84 x 84). First Person's coffee-machine mesh maps its faces onto these
 * same regions (docs/skills/2d-to-3d/SKILL.md).
 *
 * @param {{w: number, h: number}} st
 */
export function coffeeMachineLayout(st) {
  const hw = st.w / 2;
  const hh = st.h / 2;
  const body = { x0: -hw + 9, y0: -hh + 16, x1: hw - 9, y1: hh - 8 };
  return {
    hopper: { x0: -12, x1: 12, bx0: -7, bx1: 7, y0: -hh + 4, y1: -hh + 16 },
    beans: [[-6, -hh + 9], [0, -hh + 8], [6, -hh + 9], [-3, -hh + 12], [3, -hh + 12], [0, -hh + 14.5]],
    body,
    band: { x0: body.x0, y0: body.y0, x1: body.x1, y1: -hh + 26 },
    display: { x0: -10, y0: -hh + 19, x1: 10, y1: -hh + 24 },
    buttons: [{ x: -hw + 17, y: -hh + 21.5, r: 2.6 }, { x: hw - 17, y: -hh + 21.5, r: 2.6 }],
    bay: { x0: -hw + 15, y0: -hh + 30, x1: hw - 15, y1: hh - 8 },
    groupHead: { x0: -9, y0: -hh + 30, x1: 9, y1: -hh + 36 },
    spouts: [{ x0: -5, y0: -hh + 35, x1: -2, y1: -hh + 40 }, { x0: 2, y0: -hh + 35, x1: 5, y1: -hh + 40 }],
    drip: { x0: -0.75, y0: -hh + 40, x1: 0.75, y1: -hh + 44 },
    cup: { x0: -8, y0: hh - 25, x1: 8, y1: hh - 13 },
    coffee: { x0: -6.5, y0: hh - 24, x1: 6.5, y1: hh - 21.5 },
    handle: { x: 9, y: hh - 19.5, r: 3.2 },
    tray: { x0: -hw + 13, y0: hh - 13, x1: hw - 13, y1: hh - 8 },
    // The grate's slots: one every `step` px from x0 while x < x1.
    grate: { x0: -hw + 17, x1: hw - 15, y: hh - 12, step: 5, w: 1.5, h: 3 },
    // Steam wisps from the cup's rim up: start, control, mid, control, end y.
    steam: [-14, 14].map((x) => ({ x, ys: [hh - 26, hh - 32, hh - 38, hh - 43, hh - 48] })),
  };
}

/** A filled rounded rect, no outline (the coffee machine's own primitive). */
function fillRound(ctx, r, radius, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0, radius);
  ctx.fill();
}

/**
 * The Coffee Machine, front on: a clear bean hopper, a brown body with a
 * lighter top band, a green display between two buttons, and a recessed
 * brewing bay with the group head, a drip, a steaming cup and the drip
 * tray's grate. Drawn from coffeeMachineLayout. This is the original
 * machine, kept as it was; hospital-game.js keeps its own verbatim copy and
 * cooking-game.js a resized one.
 *
 * @param {{w: number, h: number}} st
 */
export function drawCoffeeMachine(ctx, st) {
  const L = coffeeMachineLayout(st);
  const C = COFFEE_MACHINE_COLORS;
  // Bean hopper on top: a clear trapezoid full of beans.
  const hp = L.hopper;
  ctx.fillStyle = C.hopper;
  ctx.beginPath();
  ctx.moveTo(hp.x0, hp.y0);
  ctx.lineTo(hp.x1, hp.y0);
  ctx.lineTo(hp.bx1, hp.y1);
  ctx.lineTo(hp.bx0, hp.y1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = C.beans;
  for (const [bx, by] of L.beans) {
    ctx.beginPath();
    ctx.ellipse(bx, by, 2.1, 1.4, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Machine body (a slightly lighter top band for a metallic read).
  fillRound(ctx, L.body, 7, C.body);
  fillRound(ctx, L.band, [7, 7, 0, 0], C.band);
  // Display + buttons.
  fillRound(ctx, L.display, 1.5, C.display);
  L.buttons.forEach((b, i) => {
    ctx.fillStyle = C.buttons[i];
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  });
  // Recessed brewing bay.
  fillRound(ctx, L.bay, 5, C.bay);
  // Group head + spouts.
  fillRound(ctx, L.groupHead, 2, C.steel);
  ctx.fillStyle = C.steel;
  for (const s of L.spouts) ctx.fillRect(s.x0, s.y0, s.x1 - s.x0, s.y1 - s.y0);
  // A coffee drip.
  ctx.fillStyle = C.drip;
  ctx.fillRect(L.drip.x0, L.drip.y0, L.drip.x1 - L.drip.x0, L.drip.y1 - L.drip.y0);
  // Cup with coffee + handle.
  fillRound(ctx, L.cup, [1, 1, 4, 4], C.cup);
  fillRound(ctx, L.coffee, 1, C.coffee);
  ctx.strokeStyle = C.cup;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(L.handle.x, L.handle.y, L.handle.r, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  // Drip tray grate.
  fillRound(ctx, L.tray, 2, C.steel);
  const gr = L.grate;
  ctx.fillStyle = C.grateSlot;
  for (let gx = gr.x0; gx < gr.x1; gx += gr.step) ctx.fillRect(gx, gr.y, gr.w, gr.h);
  // Steam wisps curling out of the bay.
  ctx.strokeStyle = C.steam;
  ctx.lineWidth = 1.5;
  for (const { x: dx, ys } of L.steam) {
    ctx.beginPath();
    ctx.moveTo(dx, ys[0]);
    ctx.quadraticCurveTo(dx - 4, ys[1], dx, ys[2]);
    ctx.quadraticCurveTo(dx + 4, ys[3], dx, ys[4]);
    ctx.stroke();
  }
}

/** The OUT OF ORDER hazard tape's colours. */
export const OUT_OF_ORDER_TAPE_COLORS = { tape: '#ffd23a', stripe: '#2a2226' };

/**
 * Two crossed strips of yellow-and-black hazard tape over the Coffee Machine
 * (the Coffee Machine Broken daily twist), centered on the origin. Top-Down
 * draws it over the station and First Person paints it into the machine's
 * art.
 */
export function drawOutOfOrderTape(ctx) {
  for (const [rot, dy] of [[-0.35, -6], [0.35, 8]]) {
    ctx.save();
    ctx.rotate(rot);
    ctx.translate(0, dy);
    ctx.beginPath();
    ctx.rect(-52, -6, 104, 12);
    ctx.fillStyle = OUT_OF_ORDER_TAPE_COLORS.tape;
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = OUT_OF_ORDER_TAPE_COLORS.stripe;
    for (let x = -60; x < 60; x += 14) {
      ctx.beginPath();
      ctx.moveTo(x, 6);
      ctx.lineTo(x + 7, -6);
      ctx.lineTo(x + 13, -6);
      ctx.lineTo(x + 6, 6);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
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

/** drawBossDoor's colours (and the tile Top-Down draws it on), for First Person's flat fallback. */
export const BOSS_DOOR_COLORS = {
  tile: '#e6dcf5',
  tileLocked: '#cfc8d8',
  frame: '#c9a0d8',
  door: '#f2e2ff',
  plaque: ANIME.gold,
  knob: ANIME.gold,
  lock: '#5a5060',
};

/**
 * Where drawBossDoor puts each part, in its centered px (y down), for a box
 * `st.w` wide and `height` (default `st.h`) tall: the frame, the door inside
 * it, the gold plaque over it, the knob's square and the padlock badge
 * (drawBossLock). First Person's mesh maps its faces onto these regions
 * (docs/skills/2d-to-3d/SKILL.md).
 */
export function bossDoorLayout(st, height = st.h) {
  const hh = height / 2;
  const dw = st.w - 30;
  const dx = -dw / 2;
  const dy = -hh + 14;
  const dh = height - 18;
  const knob = { x: dx + dw - 8, y: dy + dh * 0.55, r: 3 };
  return {
    hw: st.w / 2,
    hh,
    door: { x0: dx, y0: dy, x1: dx + dw, y1: dy + dh, w: dw, h: dh },
    frame: { x0: dx - 4, y0: dy - 4, x1: dx + dw + 4, y1: dy + dh },
    plaque: { x0: -30, y0: -hh + 2, x1: 30, y1: -hh + 13 },
    knob,
    knobBox: { x0: knob.x - 4, y0: knob.y - 4, x1: knob.x + 4, y1: knob.y + 4 },
    lock: { x0: -14, y0: -12, x1: 14, y1: 16 },
  };
}

/** The padlock badge over the locked (greyed) Boss's Office door, centered on the station. */
export function drawBossLock(ctx) {
  ctx.fillStyle = 'rgba(255,251,246,0.92)';
  ctx.beginPath();
  ctx.roundRect(-14, -12, 28, 28, 14);
  ctx.fill();
  ctx.strokeStyle = BOSS_DOOR_COLORS.lock;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, -2, 5.5, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = BOSS_DOOR_COLORS.lock;
  ctx.beginPath();
  ctx.roundRect(-7.5, 1, 15, 11, 3);
  ctx.fill();
}

/**
 * The Boss's Office: Hospital Shift's pastel door (round window, panels,
 * plaque, heart note), labelled BOSS. `opts.height` draws it into a taller
 * box than the tile (First Person's door, at a real door's aspect);
 * Top-Down leaves it at `st.h`.
 */
export function drawBossDoor(ctx, st, opts = {}) {
  const L = bossDoorLayout(st, opts.height);
  const { hw, hh } = L;
  const { x0: dx, y0: dy, w: dw, h: dh } = L.door;
  const C = BOSS_DOOR_COLORS;
  block(ctx, L.frame.x0, L.frame.y0, L.frame.x1 - L.frame.x0, L.frame.y1 - L.frame.y0, 6, C.frame, 1.4);
  block(ctx, dx, dy, dw, dh, 4, C.door, 1.4);
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
  flat(ctx, L.plaque.x0, L.plaque.y0, L.plaque.x1 - L.plaque.x0, L.plaque.y1 - L.plaque.y0, 3, C.plaque, 1.2);
  ctx.fillStyle = INK;
  ctx.font = 'bold 6.5px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('관장 · BOSS', 0, -hh + 7.8);
  circle(ctx, L.knob.x, L.knob.y, L.knob.r, C.knob, 1.1);
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
