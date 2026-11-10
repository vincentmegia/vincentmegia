// A book's front cover, as Top-Down draws it: the title fitted to the cover
// (drawCoverTitle, moved here from library-game.js) and the Return Cart's
// whole cover (drawReturnCartCover: shadow, genre colour, shine, line art,
// title and the Coin Hunt star). First Person's book mesh paints the same
// cover into the canvas it wears (three-d/meshes/book.js), so the two
// cameras show one cover. Pure canvas drawing, no DOM, no game state.
import { ANIME, animeStar } from '../hospital/anime-ui.js';
import { splitTitle } from './book-titles.js';

/**
 * Greedy word-wraps `title` into at most `maxLines` lines no wider than
 * `maxWidth`, stepping the font size down from `maxFont` to `minFont`
 * until it fits. Returns the font size + lines; if even `minFont` can't
 * fit, returns that size's best effort (callers clip to the book's rect).
 */
export function fitTitleLines(ctx, title, maxWidth, maxLines, maxFont, minFont, bold = true) {
  const words = title.split(' ');
  let best = null;
  for (let size = maxFont; size >= minFont; size -= 0.5) {
    ctx.font = `${bold ? 'bold ' : ''}${size}px sans-serif`;
    const lines = [];
    let fits = true;
    for (const word of words) {
      if (ctx.measureText(word).width > maxWidth) fits = false;
      const candidate = lines.length ? `${lines[lines.length - 1]} ${word}` : word;
      if (lines.length && ctx.measureText(candidate).width <= maxWidth) lines[lines.length - 1] = candidate;
      else lines.push(word);
    }
    if (lines.length > maxLines) fits = false;
    best = { size, lines: lines.slice(0, maxLines) };
    if (fits) return best;
  }
  return best;
}

/** Cream text on dark covers, dark text on light ones. */
export function titleInkFor(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 170 ? '#3a2a2a' : '#fdf8ee';
}

/**
 * Draws a book's full title centered on its front cover, wrapped and
 * shrunk to fit, clipped to the cover rect so it can never bleed into a
 * neighboring book (v1.4's original overflow bug).
 */
/**
 * A book's title on its cover: the Korean title large, its English
 * translation smaller underneath (library/book-titles.js); a title without
 * a translation fills the cover on its own.
 */
export function drawCoverTitle(ctx, title, x, y, w, h, coverColor, opts = {}) {
  const pad = opts.pad ?? 2;
  const maxFont = opts.maxFont ?? 8;
  const minFont = opts.minFont ?? 5;
  const { ko, en } = splitTitle(title);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = titleInkFor(coverColor);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const block = (text, top, height, bold, maxLines, hi, lo) => {
    const { size, lines } = fitTitleLines(ctx, text, w - pad * 2, maxLines, hi, lo, bold);
    ctx.font = `${bold ? 'bold ' : ''}${size}px sans-serif`;
    const lineH = size * 1.15;
    const first = top + height / 2 - ((lines.length - 1) * lineH) / 2;
    lines.forEach((line, i) => ctx.fillText(line, x + w / 2, first + i * lineH));
  };
  if (en) {
    const split = h * 0.56;
    block(ko, y, split, true, 2, maxFont, minFont);
    ctx.globalAlpha = 0.85;
    block(en, y + split - 1, h - split, false, 2, Math.max(4, maxFont * 0.72), 4);
  } else {
    block(ko, y, h, true, opts.maxLines ?? 4, maxFont, minFont);
  }
  ctx.restore();
}

/** The Return Cart cover's size in Top-Down px (returnCartCoverRect's 30 x 40). */
export const RETURN_CART_COVER = { w: 30, h: 40 };

/**
 * The Coin Hunt star on a Return Cart cover at (x, y, w): its centre sits on
 * the cover's top-right corner, 2 px in and 1 px down, so it overhangs the
 * cover. `outer`/`inner` are animeStar's radii.
 */
export function returnCartStar(x, y, w) {
  return { cx: x + w - 2, cy: y + 1, outer: 6, inner: 2.6 };
}

function drawRoundRect(ctx, x, y, w, h, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

/**
 * A Return Cart book's cover filling (x, y, w, h), as Top-Down draws it:
 * a soft drop shadow, the genre colour with plum line art, a spine shine,
 * the full title and, on a Coin Hunt book, the star. `shadow: false` leaves
 * out the drop shadow (First Person's book has real depth instead).
 */
export function drawReturnCartCover(ctx, x, y, w, h, color, title, isCoinHunt, { shadow = true } = {}) {
  // Anime book cover: a soft drop shadow, plum line art, a spine band and a shine.
  if (shadow) drawRoundRect(ctx, x + 1.5, y + 2.5, w, h, 3, 'rgba(59,42,74,0.2)');
  drawRoundRect(ctx, x, y, w, h, 3, color);
  ctx.fillStyle = 'rgba(255,251,246,0.5)';
  ctx.fillRect(x + 1, y + 1, 3, h - 2);
  ctx.strokeStyle = ANIME.ink;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 3);
  ctx.stroke();
  // Full title on the front cover (user: "add the title names on each
  // books") — wrapped and shrunk to fit rather than v1.4's first-four-
  // words-then-crop, which cut titles off at the cover's edges.
  if (title) drawCoverTitle(ctx, title, x + 3, y, w - 3, h, color, { maxFont: 7.5, minFont: 5 });
  if (isCoinHunt) {
    const s = returnCartStar(x, y, w);
    animeStar(ctx, s.cx, s.cy, s.outer, s.inner, 1);
  }
}
