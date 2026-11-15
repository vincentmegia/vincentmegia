// Library Shift's floor and back-wall dressing, shared by both cameras.
//
// Top-Down's drawFloor (library-game.js) paints the floor and back wall from
// these constants and painters; First Person's room (three-d/room.js, via
// three-d/scene.js) builds its checker tiles, floor decals and back-wall art
// from the very same ones, so the two cameras can't drift apart
// (docs/features/library-first-person-3d.md, Camera parity P4).
//
// Pure apart from the painters, which take a canvas 2D context: importable by
// `node --test` with no DOM.

import { ANIME, tint, sparkle, outlinedText, animeButton, sakuraBranch } from '../hospital/anime-ui.js';
import { FLOOR_1, FLOOR_2, CANVAS_WIDTH, CANVAS_HEIGHT } from './floor-plan.js';

/** Side of one floor checker tile, in game px. */
export const FLOOR_TILE = 40;
/** Height of Top-Down's back-wall band across the top of the canvas, in game px. */
export const WALL_BAND_HEIGHT = 58;

/**
 * Hospital Shift's checker tiles, per floor: `light` is the gradient's foot
 * (it starts at `tint(light, 0.3)` under the wall band), `dark` the solid
 * tile on even (row + col), `sheen` the glossy diagonal streaks.
 */
export const FLOOR_TILES = {
  [FLOOR_1]: { light: '#e6f6f0', dark: '#d8efe7', sheen: 'rgba(143,211,255,0.10)' },
  [FLOOR_2]: { light: '#f6efe4', dark: '#efe5d6', sheen: 'rgba(255,255,255,0.18)' },
};

/** Pastel guide stripes: 1F's aisle under the Front Desk's queue, and the lower aisle. */
export const GUIDE_STRIPES = {
  [FLOOR_1]: [
    { x: 190, y: 252, w: 720, h: 7, r: 3.5, fill: 'rgba(255,138,122,0.28)' },
    { x: 190, y: 500, w: 620, h: 7, r: 3.5, fill: 'rgba(63,181,143,0.26)' },
  ],
  [FLOOR_2]: [],
};

/** Each floor's sign, where Hospital Shift has its EMERGENCY button. */
export const LIBRARY_SIGNS = {
  [FLOOR_1]: { text: '도서관 · LIBRARY 1F', color: ANIME.coral, colorDeep: ANIME.coralDeep },
  [FLOOR_2]: { text: '열람실 · READING 2F', color: ANIME.lavender, colorDeep: ANIME.lavenderDeep },
};

/** drawBackWall's colours: cream to blush, a pink wainscot rail and plum trim. */
export const BACK_WALL = {
  top: '#fffaf3',
  bottom: '#fdeef3',
  rail: '#ffd1e3',
  trim: ANIME.ink,
  shadow: 'rgba(59,42,74,0.12)',
};

/**
 * The box (in Top-Down's band px) each piece of back-wall art paints inside,
 * stroke and shadow included. First Person cuts these out of its back wall
 * and fills each with a texture of that same art.
 */
export const WALL_ART = {
  clock: { x: 497, y: 5, w: 46, h: 47 },
  shelf: { x: 558, y: 14, w: 66, h: 32 },
  sakura: { x: 668, y: 2, w: 64, h: 48 },
  sign: { x: 741, y: 9, w: 196, h: 40 },
};
export const WALL_ART_IDS = Object.keys(WALL_ART);

/**
 * The stitched rug each floor lays under one station (1F's break-room rug
 * under the Coffee Machine, 2F's under the Reading Nook), as drawFloor
 * places it; null when the station isn't there.
 */
export function floorRug(floor, stations) {
  if (floor === FLOOR_1) {
    const coffee = stations.find((st) => st.kind === 'coffee-machine');
    if (!coffee) return null;
    return { x: Math.min(coffee.x - 70, CANVAS_WIDTH - 196), y: coffee.y - 62, w: 190, h: 120, fill: 'rgba(255,194,218,0.55)', stitch: 'rgba(232,85,143,0.55)' };
  }
  if (floor === FLOOR_2) {
    const nook = stations.find((st) => st.kind === 'reading-nook');
    if (!nook) return null;
    return { x: nook.x - 110, y: nook.y - 62, w: 220, h: 124, fill: 'rgba(201,184,255,0.4)', stitch: 'rgba(143,122,224,0.55)' };
  }
  return null;
}

// -- Colour helpers (pure) ----------------------------------------------------

function rgbOf(c) {
  if (c[0] === '#') {
    const n = parseInt(c.slice(1, 7), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const v = c.match(/[\d.]+/g).map(Number);
  return [v[0], v[1], v[2], v.length > 3 ? v[3] : 1];
}

const hex = (rgb) => `#${rgb.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** `top` (any of #rrggbb, rgb(), rgba()) composited over the opaque `base`, as #rrggbb. */
export function blendOver(top, base) {
  const t = rgbOf(top);
  const b = rgbOf(base);
  return hex([0, 1, 2].map((i) => b[i] + (t[i] - b[i]) * t[3]));
}

/**
 * The colour drawAnimeTiles gives the tile at (col, row) on `floor`: `dark`
 * on even (row + col), otherwise its gradient (tint(light, 0.3) at the wall
 * band's foot down to `light` at the canvas bottom) sampled at the row's
 * centre. #rrggbb.
 */
export function tileColor(floor, col, row) {
  const { light, dark } = FLOOR_TILES[floor] ?? FLOOR_TILES[FLOOR_1];
  if ((row + col) % 2 === 0) return dark;
  const cy = row * FLOOR_TILE + FLOOR_TILE / 2;
  const t = Math.min(1, Math.max(0, (cy - WALL_BAND_HEIGHT) / (CANVAS_HEIGHT - WALL_BAND_HEIGHT)));
  const a = rgbOf(tint(light, 0.3));
  const b = rgbOf(light);
  return hex([0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t));
}

/**
 * First Person's floor decals for `floor`, in game px: each guide stripe cut
 * at the tile grid into pieces whose flat colour is the stripe composited
 * over that very tile (so it reads exactly as Top-Down's translucent stripe),
 * and the rug as one piece that wears `paintRoomArt(…, 'rug')` (`color` is
 * its fallback, the rug over a light tile). Top-Down lays the rug over the
 * stripes, so a stripe is also cut at the rug's edges and the part under the
 * rug left to the rug's art, which paints it beneath the rug.
 * @returns {{id: string, x: number, y: number, w: number, h: number, color: string}[]}
 */
export function floorDecals(floor, stations) {
  const out = [];
  const rug = floorRug(floor, stations);
  const cuts = (lo, hi, rugLo, rugHi) => {
    const xs = [lo];
    for (let v = (Math.floor(lo / FLOOR_TILE) + 1) * FLOOR_TILE; v < hi; v += FLOOR_TILE) xs.push(v);
    if (rug) for (const v of [rugLo, rugHi]) if (v > lo && v < hi && !xs.includes(v)) xs.push(v);
    xs.push(hi);
    return xs.sort((a, b) => a - b);
  };
  for (const s of GUIDE_STRIPES[floor] ?? []) {
    const ys = cuts(s.y, s.y + s.h, rug?.y, rug && rug.y + rug.h);
    const xs = cuts(s.x, s.x + s.w, rug?.x, rug && rug.x + rug.w);
    for (let j = 0; j + 1 < ys.length; j++) {
      for (let i = 0; i + 1 < xs.length; i++) {
        const [x0, x1, y0, y1] = [xs[i], xs[i + 1], ys[j], ys[j + 1]];
        const under = rug && x0 >= rug.x && x1 <= rug.x + rug.w && y0 >= rug.y && y1 <= rug.y + rug.h;
        if (under) continue;
        const col = Math.floor(x0 / FLOOR_TILE);
        const row = Math.floor(y0 / FLOOR_TILE);
        out.push({ id: 'stripe', x: x0, y: y0, w: x1 - x0, h: y1 - y0, color: blendOver(s.fill, tileColor(floor, col, row)) });
      }
    }
  }
  if (rug) {
    const { light } = FLOOR_TILES[floor] ?? FLOOR_TILES[FLOOR_1];
    out.push({ id: 'rug', x: rug.x, y: rug.y, w: rug.w, h: rug.h, color: blendOver(rug.fill, light) });
  }
  return out;
}

// -- Painters (Top-Down draws with these; First Person paints its art with them) --

function fillRoundRect(ctx, x, y, w, h, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

export function drawStitchedRug(ctx, x, y, w, h, fill, stitch) {
  fillRoundRect(ctx, x, y, w, h, 22, fill);
  ctx.save();
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = stitch;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x + 7, y + 7, w - 14, h - 14, 17);
  ctx.stroke();
  ctx.restore();
}

/** A guide stripe, as drawFloor lays it. */
export function drawGuideStripe(ctx, s) {
  fillRoundRect(ctx, s.x, s.y, s.w, s.h, s.r, s.fill);
}

/** The back wall: cream to blush, a pink wainscot rail and plum trim. */
export function drawBackWall(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, WALL_BAND_HEIGHT);
  g.addColorStop(0, BACK_WALL.top);
  g.addColorStop(1, BACK_WALL.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CANVAS_WIDTH, WALL_BAND_HEIGHT);
  ctx.fillStyle = BACK_WALL.rail;
  ctx.fillRect(0, 48, CANVAS_WIDTH, 7);
  ctx.fillStyle = BACK_WALL.trim;
  ctx.fillRect(0, 55, CANVAS_WIDTH, 2.5);
  ctx.fillStyle = BACK_WALL.shadow;
  ctx.fillRect(0, 57.5, CANVAS_WIDTH, 4);
}

/** The sakura branch on the back wall. */
export function drawWallSakura(ctx) {
  sakuraBranch(ctx, 672, 28, 1.1);
}

/** The floor's sign, where Hospital Shift has its EMERGENCY button. */
export function drawLibrarySign(ctx, text, color, colorDeep) {
  animeButton(ctx, { x: 744, y: 12, w: 190, h: 32 }, '', color, colorDeep);
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  outlinedText(ctx, text, 839, 29, '#ffffff', tint(colorDeep, -0.45), 3.2);
  sparkle(ctx, 750, 14, 5, '#ffffff');
}

/** A little wall shelf of books between the clock and the sakura branch. */
export function drawWallBookShelf(ctx) {
  const x = 566;
  const y = 40;
  const colors = [ANIME.pink, ANIME.sky, ANIME.gold, ANIME.mint, ANIME.lavender, ANIME.coral];
  colors.forEach((color, i) => {
    const h = 18 + ((i * 5) % 7);
    const w = 7;
    const bx = x + i * 8;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(bx, y - h, w, h, 1.5);
    ctx.fill();
    ctx.strokeStyle = ANIME.ink;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(bx + 1.5, y - h + 3, w - 3, 1.5);
  });
  fillRoundRect(ctx, x - 6, y, 62, 4, 2, '#c9a77a');
  ctx.strokeStyle = ANIME.ink;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x - 6, y, 62, 4, 2);
  ctx.stroke();
}

/** The clock hands' reading of an `inGameTimeLabel` ("3:30 PM"), or null. */
export function clockHands(label) {
  const match = /^(\d+):(\d+)\s(AM|PM)$/.exec(label ?? '');
  if (!match) return null;
  return { hour: Number(match[1]) % 12, minute: Number(match[2]) };
}

/**
 * Hospital Shift's pastel wall clock — pink rim, plum line art, two
 * little bells. The authoritative reading is `#library-hud-clock`'s
 * `inGameTimeLabel` text; `label` is that same text and the hands are
 * parsed from it, so the two displays never drift apart.
 */
export function drawWallClock(ctx, label) {
  const hands = clockHands(label);
  if (!hands) return;
  const { hour, minute } = hands;
  const cx = 520;
  const cy = 29;
  for (const dir of [-1, 1]) {
    ctx.fillStyle = ANIME.gold;
    ctx.beginPath();
    ctx.arc(cx + dir * 13, cy - 16, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ANIME.ink;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  ctx.fillStyle = ANIME.pink;
  ctx.beginPath();
  ctx.arc(cx, cy, 21, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = ANIME.ink;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#fffaf3';
  ctx.beginPath();
  ctx.arc(cx, cy, 16.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.stroke();
  const hand = (angle, len, width) => {
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.sin(angle) * len, cy - Math.cos(angle) * len);
    ctx.stroke();
  };
  ctx.strokeStyle = ANIME.ink;
  ctx.lineCap = 'round';
  hand(((hour + minute / 60) / 12) * Math.PI * 2, 9, 2.5);
  hand((minute / 60) * Math.PI * 2, 13, 1.5);
  ctx.lineCap = 'butt';
  ctx.fillStyle = ANIME.pinkDeep;
  ctx.beginPath();
  ctx.arc(cx, cy, 2, 0, Math.PI * 2);
  ctx.fill();
}

// -- First Person art ---------------------------------------------------------

/** Image px per game px in First Person's room art canvases. */
export const ROOM_ART_SCALE = 4;

/**
 * The game-px box a room-art canvas covers: a WALL_ART entry (band px) or,
 * for 'rug', the floor's rug. Null when `floor` has no such piece.
 */
export function roomArtRect(floor, id, stations) {
  if (id === 'rug') {
    const rug = floorRug(floor, stations);
    return rug && { x: rug.x, y: rug.y, w: rug.w, h: rug.h };
  }
  return WALL_ART[id] ?? null;
}

/**
 * Paints one piece of First Person's room art into `ctx`, a canvas of
 * `rect.w × rect.h` times ROOM_ART_SCALE: an opaque backing (the wall's
 * cream, or the very checker tiles under the rug), then the same painter
 * Top-Down draws that piece with, at the same coordinates.
 * @param {{stations: object[], clockLabel?: string}} opts
 */
export function paintRoomArt(ctx, floor, id, { stations, clockLabel } = {}) {
  const rect = roomArtRect(floor, id, stations ?? []);
  if (!rect) return;
  ctx.save();
  ctx.scale(ROOM_ART_SCALE, ROOM_ART_SCALE);
  ctx.translate(-rect.x, -rect.y);
  if (id === 'rug') {
    for (let row = Math.floor(rect.y / FLOOR_TILE); row * FLOOR_TILE < rect.y + rect.h; row++) {
      for (let col = Math.floor(rect.x / FLOOR_TILE); col * FLOOR_TILE < rect.x + rect.w; col++) {
        ctx.fillStyle = tileColor(floor, col, row);
        ctx.fillRect(col * FLOOR_TILE, row * FLOOR_TILE, FLOOR_TILE, FLOOR_TILE);
      }
    }
    // Top-Down's order: tiles, guide stripes, then the rug over them.
    for (const stripe of GUIDE_STRIPES[floor] ?? []) drawGuideStripe(ctx, stripe);
    const rug = floorRug(floor, stations);
    drawStitchedRug(ctx, rug.x, rug.y, rug.w, rug.h, rug.fill, rug.stitch);
  } else {
    ctx.fillStyle = BACK_WALL.top;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    if (id === 'clock') drawWallClock(ctx, clockLabel);
    else if (id === 'shelf') drawWallBookShelf(ctx);
    else if (id === 'sakura') drawWallSakura(ctx);
    else if (id === 'sign') {
      const sign = LIBRARY_SIGNS[floor] ?? LIBRARY_SIGNS[FLOOR_1];
      drawLibrarySign(ctx, sign.text, sign.color, sign.colorDeep);
    }
  }
  ctx.restore();
}
