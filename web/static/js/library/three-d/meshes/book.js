// First Person Return Cart book, referenced to Top-Down's drawReturnCartCover
// (library/book-cover.js; docs/skills/2d-to-3d/SKILL.md). The geometry is a
// real-size book standing on the cart's top tray; the cover is the 2D cover
// itself: the game paints drawReturnCartCover into a canvas
// (paintReturnCartBookArt) and the book's +Z front wears exactly its cover
// rect. A Coin Hunt book's star overhangs the cover's top-right corner, as in
// 2D, so the part of the star outside the cover is its own geometry in the
// front plane (the star's kites clipped to outside the cover), wearing the
// same canvas; inside the cover the star is already in the cover's pixels.
// Nothing overlaps the cover, so the painter's sort never has to choose.
// Without art (tests, no canvas) the cover is the genre colour and the star
// flat gold.
//
// Model space: base at y=0, centred on x/z, cover facing +Z. The spine is on
// the left (-X), where the 2D cover draws its shine; the fore-edge (+X) and
// the top are pages. Pure and deterministic.
import { boxWithout, textureFront } from './geom.js';
import { ANIME } from '../../../hospital/anime-ui.js';
import { RETURN_CART_COVER, returnCartStar, drawReturnCartCover } from '../../book-cover.js';

/** Real-world size (units, ~1 = one metre): the 2D cover's 30 : 40, 25 cm wide. */
export const BOOK_SIZE = { width: 0.25, height: 0.25 * (RETURN_CART_COVER.h / RETURN_CART_COVER.w), depth: 0.06 };
/** The box the cover is painted into (art px, centred): the 30 x 40 cover plus room for the star's overhang. */
export const BOOK_ART = { w: 40, h: 52 };
/** Image px per art px (a 160 x 208 canvas): the 5 px title floor is 20 image px. */
export const BOOK_ART_SCALE = 4;
/** The pages' colour (fore-edge and top). */
export const BOOK_PAGES = ANIME.paper;
/** The flat fallback for the star (no art). */
export const BOOK_STAR_FALLBACK = ANIME.gold;

// The cover in the art box's centred px, and the star drawReturnCartCover puts on it.
const COVER = { x0: -RETURN_CART_COVER.w / 2, y0: -RETURN_CART_COVER.h / 2, x1: RETURN_CART_COVER.w / 2, y1: RETURN_CART_COVER.h / 2 };
const STAR = returnCartStar(COVER.x0, COVER.y0, RETURN_CART_COVER.w);
const STROKE_HALF = 0.6; // animeStar's 1.2 px outline reaches this far past its path
const K = BOOK_SIZE.width / RETURN_CART_COVER.w; // units per art px

/**
 * Paints the cover a book's mesh wears: an opaque ink backing (the star's
 * kites sample their outline's colour past the stroke), the cover rect in the
 * genre colour (the 2D's rounded corners would otherwise leave the backing
 * showing at the corners), then drawReturnCartCover without its drop shadow.
 * `ctx` is a canvas of BOOK_ART times BOOK_ART_SCALE.
 */
export function paintReturnCartBookArt(ctx, { title, color, isCoinHunt }) {
  const { w, h } = BOOK_ART;
  ctx.save();
  ctx.scale(BOOK_ART_SCALE, BOOK_ART_SCALE);
  ctx.fillStyle = ANIME.ink;
  ctx.fillRect(0, 0, w, h);
  ctx.translate(w / 2, h / 2);
  ctx.fillStyle = color;
  ctx.fillRect(COVER.x0, COVER.y0, RETURN_CART_COVER.w, RETURN_CART_COVER.h);
  drawReturnCartCover(ctx, COVER.x0, COVER.y0, RETURN_CART_COVER.w, RETURN_CART_COVER.h, color, title, isCoinHunt, { shadow: false });
  ctx.restore();
}

// Sutherland-Hodgman against one half-plane: keeps points where `inside(p)`;
// `cut(a, b)` is where the edge a-b crosses the boundary.
function clip(poly, inside, cut) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if (inside(a)) out.push(a);
    if (inside(a) !== inside(b)) out.push(cut(a, b));
  }
  return out;
}
const atX = (x) => (a, b) => [x, a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1])];
const atY = (y) => (a, b) => [a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]), y];
const area = (p) => p.reduce((s, q, i) => s + q[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * q[1], 0) / 2;

/**
 * The star's area outside the cover, in art px, as convex polygons: the
 * star (grown by its outline) is five convex kites, centre - inner - tip -
 * inner, and each kite is clipped to the right of the cover and to above it.
 */
export function starOverhang() {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = (i % 2 === 0 ? STAR.outer : STAR.inner) + STROKE_HALF;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push([STAR.cx + Math.cos(a) * r, STAR.cy + Math.sin(a) * r]);
  }
  const polys = [];
  for (let k = 0; k < 5; k++) {
    const kite = [[STAR.cx, STAR.cy], pts[(2 * k + 9) % 10], pts[2 * k], pts[2 * k + 1]];
    const right = clip(kite, (p) => p[0] >= COVER.x1, atX(COVER.x1));
    const above = clip(clip(kite, (p) => p[0] <= COVER.x1, atX(COVER.x1)), (p) => p[1] <= COVER.y0, atY(COVER.y0));
    for (const p of [right, above]) if (p.length >= 3 && Math.abs(area(p)) > 1e-6) polys.push(p);
  }
  return polys;
}

const toModel = ([x, y]) => [x * K, BOOK_SIZE.height / 2 - y * K, BOOK_SIZE.depth / 2];
const toUv = ([x, y]) => [(x + BOOK_ART.w / 2) * BOOK_ART_SCALE, (y + BOOK_ART.h / 2) * BOOK_ART_SCALE];

/**
 * @param {{art?: CanvasImageSource, color: string, isCoinHunt?: boolean}} opts
 *   `color` is the book's genre colour.
 */
export function buildBook({ art, color, isCoinHunt = false }) {
  const { width: w, height: h, depth: d } = BOOK_SIZE;
  const mesh = boxWithout([-w / 2, 0, -d / 2], [w / 2, h, d / 2], color, ['bottom']);
  mesh.faces.find((f) => f.indices.join() === '5,1,3,7').color = BOOK_PAGES; // right: fore-edge
  mesh.faces.find((f) => f.indices.join() === '6,7,3,2').color = BOOK_PAGES; // top
  textureFront(mesh, COVER, { image: art, artBox: BOOK_ART, scale: BOOK_ART_SCALE, color });
  if (isCoinHunt) {
    for (const poly of starOverhang()) {
      // Art y runs down, model y up: reverse to wind counter-clockwise seen from +Z.
      const p = area(poly) > 0 ? [...poly].reverse() : poly;
      // Fan the convex polygon into quads (a leftover triangle repeats its last corner).
      for (let i = 1; i < p.length - 1; i += 2) {
        const corners = [p[0], p[i], p[i + 1], p[Math.min(i + 2, p.length - 1)]];
        const base = mesh.vertices.length;
        for (const c of corners) mesh.vertices.push(toModel(c));
        const face = { indices: [base, base + 1, base + 2, base + 3], color: BOOK_STAR_FALLBACK };
        if (art) {
          face.texture = { image: art, uv: corners.map(toUv) };
          face.unlit = true;
        }
        mesh.faces.push(face);
      }
    }
  }
  for (const f of mesh.faces) f.cull = true;
  return mesh;
}
