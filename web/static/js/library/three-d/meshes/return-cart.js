// First Person Return Cart, referenced to Top-Down's drawReturnCart
// (docs/skills/2d-to-3d/SKILL.md). The geometry is real-world size and gives
// the depth: two wooden trays on plum posts, the push handle, the RETURNS tag
// hung at the back between the back posts (high enough to clear the books on
// the top tray), the lower tray's five pastel books and two round wheels with
// pale hubs. The flat fronts wear the 2D art itself: the game paints
// drawReturnCart into a canvas (paintReturnCartArt) and each tray and the tag
// show exactly their own region of it. The top tray holds the cart's real
// books (book.js; scene.js merges them into this mesh at
// RETURN_CART_BOOK_SLOTS so the trays' `under` tops order them), so the 2D's
// upper-tray books are not modelled. Without art (tests, no canvas) the same
// faces fall back to RETURN_CART_COLORS.
//
// Model space: base at y=0, centered on x/z, front facing +Z (the side the
// player walks up to). Pure and deterministic.
import { emptyMesh, merge, boxWithout, textureFront, tube } from './geom.js';
import {
  returnCartLayout, returnCartDecorBooks, drawReturnCart, drawReturnCartTray, drawReturnCartTag, RETURN_CART_COLORS,
} from '../../anime-furniture.js';

/** The box drawReturnCart is drawn into for First Person: Top-Down's own. */
export const RETURN_CART_ART = { w: 84, h: 84 };
/** Image px per art px: the tag's lettering stays sharp at interact range. */
export const RETURN_CART_ART_SCALE = 4;
/** The RETURNS tag board (units): its width and its bottom and top, the 2D tag's 52 : 14 aspect. */
export const RETURN_CART_TAG = { width: 0.9, y0: 1.2, y1: 1.2 + (0.9 * 14) / 52 };

const TOP_TRAY = 0.82; // the top tray's surface
const LOWER_TRAY = 0.32;
const TRAY = { x: 0.8, z: 0.5, lower: [0.2, LOWER_TRAY], upper: [0.7, TOP_TRAY] };
/** How many of the cart's books stand on its top tray: returnCartSlots' five. */
export const RETURN_CART_VISIBLE_BOOKS = 5;
const BOOK_PITCH = 0.29; // 0.25 m books with the 2D's 4 : 30 gap, inside the posts
/**
 * Model-space base point of the cart's book in each Top-Down slot, left to
 * right as returnCartSlots lays them out (slot 0 is the viewer's left seen
 * from the cart's +Z front).
 */
export const RETURN_CART_BOOK_SLOTS = Array.from({ length: RETURN_CART_VISIBLE_BOOKS }, (_, i) => (
  [(i - (RETURN_CART_VISIBLE_BOOKS - 1) / 2) * BOOK_PITCH, TOP_TRAY, 0.05]
));

const POST_X = 0.75;
const POST_HALF = 0.04;
const FRONT_POST_TOP = 1.1;
const BACK_Z = -0.45; // the back posts' and the tag's z
const BOARD = 0.03; // the tag board's thickness
const ARM = { h: 0.04, depth: 0.02 }; // the tag's arms, inside the board's thickness
// The handle juts out from the right-hand posts' outer faces, between them
// (it meets them only along their edges: a box lying on a post's face could
// not be painted in order against it).
const HANDLE = { x0: POST_X + POST_HALF, x1: 0.95, y0: 1.05, y1: 1.12, z: 0.45 - POST_HALF };
const BOOK = { w: 0.2, pitch: 0.24, depth: 0.3, perPx: 0.02 }; // the lower tray's books
const WHEEL = { x: 0.55, y: 0.1, r: 0.1, half: 0.06, sides: 8, hubSides: 6, hubR: 0.036, hubProud: 0.01 };
const DIV_WIDE = [2, 1];

// Box face corner indices (geom.js box), and for each its first edge (v0 to
// v1) and second edge (v0 to v3) as model axes.
const FACE_INDICES = { back: '1,0,2,3', right: '5,1,3,7', left: '0,4,6,2', top: '6,7,3,2' };
// Model x or z -> fraction along a face edge running from `a` to `b`.
const frac = (a, b) => (v) => (v - a) / (b - a);
const TRAY_X = [-TRAY.x, TRAY.x];
const TRAY_Z = [-TRAY.z, TRAY.z];
const along = (cuts, [a, b]) => [a, ...cuts, b].map(frac(a, b));
const backAlong = (cuts, [a, b]) => [b, ...[...cuts].reverse(), a].map(frac(b, a));
/** The cells of a grid at fractions `us` by `vs`, as splitFace takes them ([u0, u1, v0, v1]). */
const grid = (us, vs) => us.slice(1).flatMap((u1, i) => vs.slice(1).map((v1, j) => [us[i], u1, vs[j], v1]));
const LOWER_X = along([-0.65, -0.45, 0.45, 0.65], TRAY_X);
const LOWER_Z = backAlong([-0.1, 0.1], TRAY_Z);
/**
 * How each tray's faces are split, as [face, cells] (splitFace's fraction
 * rects; geom.js box winds a top's first edge along +x and its second along
 * −z). The painter sorts by mean depth, so a big face paints over what is
 * under or behind it wherever the thing's own centre is nearer: the upper
 * tray's top is in cells round the lower books (x and z) and its back and
 * ends in halves; the lower tray's top is in cells round the wheels (x and z
 * there) and one full-depth cell between them, under the lower books (rows
 * there let its rule move a lower book past the upper top's cells). Measured
 * with exact per-pixel truth over the standing-order sweep, the wrong samples
 * of what is under a tray against it drop from about 47 000 unsplit to about
 * 750 (docs/features/library-first-person-3d.md).
 */
const TRAY_CELLS = [
  [
    ['top', grid(along([-0.4, 0, 0.4], TRAY_X), backAlong([-0.15, 0.15], TRAY_Z))],
    ['back', grid(backAlong([0], TRAY_X), [0, 1])],
    ['right', grid(backAlong([0], TRAY_Z), [0, 1])],
    ['left', grid(along([0], TRAY_Z), [0, 1])],
  ],
  [
    ['top', [
      ...grid(LOWER_X.slice(0, 3), LOWER_Z),
      [LOWER_X[2], LOWER_X[3], 0, 1],
      ...grid(LOWER_X.slice(3), LOWER_Z),
    ]],
  ],
];

/**
 * Replace box face `name` of `part` by quads, one per [u0, u1, v0, v1] in
 * `rects` (fractions along the face's first and second edge, 0 to 1), wound
 * as the face was and sharing its corners. `extra` is set on every cell.
 */
function splitFace(part, name, rects, extra) {
  const k = part.faces.findIndex((f) => f.indices.join() === FACE_INDICES[name]);
  const f = part.faces[k];
  const [p0, p1, , p3] = f.indices.map((i) => part.vertices[i]);
  const corner = new Map([['0,0', f.indices[0]], ['1,0', f.indices[1]], ['1,1', f.indices[2]], ['0,1', f.indices[3]]]);
  const at = (u, v) => {
    const key = `${u},${v}`;
    if (!corner.has(key)) {
      part.vertices.push([0, 1, 2].map((d) => p0[d] + u * (p1[d] - p0[d]) + v * (p3[d] - p0[d])));
      corner.set(key, part.vertices.length - 1);
    }
    return corner.get(key);
  };
  const cells = rects.map(([u0, u1, v0, v1]) => ({ ...f, ...extra, indices: [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)] }));
  part.faces.splice(k, 1, ...cells);
}

/**
 * Paints the First Person return cart art: an opaque backing in the wood
 * colour (the renderer needs the mapped regions opaque), then drawReturnCart
 * at RETURN_CART_ART, then each textured part again, clipped to its own
 * region on a fill of its own colour: the upper tray, the lower tray, the
 * tag. So each front shows only its own part: none of the books, posts or
 * wheels the 2D draws over the trays (they are geometry in 3D), and no
 * backing at the rounded corners. `ctx` is a canvas of RETURN_CART_ART.w x .h
 * times RETURN_CART_ART_SCALE. Reads only `station.id`.
 */
export function paintReturnCartArt(ctx, station) {
  const C = RETURN_CART_COLORS;
  ctx.fillStyle = C.wood;
  ctx.fillRect(0, 0, RETURN_CART_ART.w * RETURN_CART_ART_SCALE, RETURN_CART_ART.h * RETURN_CART_ART_SCALE);
  ctx.save();
  ctx.scale(RETURN_CART_ART_SCALE, RETURN_CART_ART_SCALE);
  ctx.translate(RETURN_CART_ART.w / 2, RETURN_CART_ART.h / 2);
  const box = { id: station.id, w: RETURN_CART_ART.w, h: RETURN_CART_ART.h };
  drawReturnCart(ctx, box);
  const L = returnCartLayout(RETURN_CART_ART);
  const parts = [
    [L.trays[0], C.wood, (c) => drawReturnCartTray(c, box, 0)],
    [L.trays[1], C.wood, (c) => drawReturnCartTray(c, box, 1)],
    [L.tag, C.tag, (c) => drawReturnCartTag(c, box)],
  ];
  for (const [r, color, draw] of parts) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
    ctx.clip();
    ctx.fillStyle = color;
    ctx.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
    draw(ctx);
    ctx.restore();
  }
  ctx.restore();
}

/**
 * @param {{art?: CanvasImageSource}} [opts] art: a canvas paintReturnCartArt painted
 * @returns {{vertices: number[][], faces: object[]}}
 */
export function buildReturnCart({ art } = {}) {
  const L = returnCartLayout(RETURN_CART_ART);
  const C = RETURN_CART_COLORS;
  const mesh = emptyMesh();
  // Show art region r on a part's +Z face (boxWithout keeps it as faces[0]).
  const front = (part, r, color) =>
    merge(mesh, textureFront(part, r, { image: art, artBox: RETURN_CART_ART, scale: RETURN_CART_ART_SCALE, color, div: DIV_WIDE }));
  const solid = (min, max, color, drop) => merge(mesh, boxWithout(min, max, color, drop));

  // The two trays, each top a supporting surface (`under`): the lower tray's
  // books and the posts stand on the lower one, the real books on the upper
  // one. The painter sorts by mean depth, so a big face would paint over
  // what sits under or behind it (the lower books under the upper tray, the
  // wheels under the lower one); each such face is split into cells round
  // what it covers (TRAY_CELLS).
  [TRAY.upper, TRAY.lower].forEach(([y0, y1], t) => {
    const part = boxWithout([-TRAY.x, y0, -TRAY.z], [TRAY.x, y1, TRAY.z], C.wood, ['bottom']);
    textureFront(part, L.trays[t], { image: art, artBox: RETURN_CART_ART, scale: RETURN_CART_ART_SCALE, color: C.wood, div: DIV_WIDE });
    const cells = TRAY_CELLS[t];
    for (const [name, rects] of cells) splitFace(part, name, rects, name === 'top' ? { under: true } : {});
    merge(mesh, part);
  });

  // The posts at the corners, in segments between and above the trays (never
  // through them): the front two to FRONT_POST_TOP, the back two up to the
  // tag's top, their last ARM_H a block of its own whose inner face the
  // tag's arm covers. The handle juts out from the right-hand posts.
  for (const x of [-POST_X, POST_X]) {
    for (const z of [-BACK_Z, BACK_Z]) {
      const min = (y) => [x - POST_HALF, y, z - POST_HALF];
      const max = (y) => [x + POST_HALF, y, z + POST_HALF];
      solid(min(LOWER_TRAY), max(TRAY.upper[0]), C.frame, ['bottom', 'top']);
      if (z === BACK_Z) {
        const armY0 = RETURN_CART_TAG.y1 - ARM.h;
        solid(min(TOP_TRAY), max(armY0), C.frame, ['bottom', 'top']);
        solid(min(armY0), max(RETURN_CART_TAG.y1), C.frame, ['bottom', x > 0 ? 'left' : 'right']);
      } else {
        solid(min(TOP_TRAY), max(FRONT_POST_TOP), C.frame, ['bottom']);
      }
    }
  }
  solid([HANDLE.x0, HANDLE.y0, -HANDLE.z], [HANDLE.x1, HANDLE.y1, HANDLE.z], C.frame, ['bottom']);

  // The RETURNS tag: a board between the back posts, hung from an arm on
  // each side that runs from its top corner to the post's top.
  const tw = RETURN_CART_TAG.width / 2;
  front(boxWithout([-tw, RETURN_CART_TAG.y0, BACK_Z - BOARD / 2], [tw, RETURN_CART_TAG.y1, BACK_Z + BOARD / 2], C.tag, ['bottom']), L.tag, C.tag);
  for (const s of [-1, 1]) {
    const xs = [s * tw, s * (POST_X - POST_HALF)].sort((a, b) => a - b);
    solid([xs[0], RETURN_CART_TAG.y1 - ARM.h, BACK_Z - ARM.depth / 2], [xs[1], RETURN_CART_TAG.y1, BACK_Z + ARM.depth / 2], C.frame, ['bottom', 'left', 'right']);
  }

  // The lower tray's books, the 2D's five left to right, standing on it.
  const books = returnCartDecorBooks(1);
  books.forEach(({ color, h }, i) => {
    const cx = (i - (books.length - 1) / 2) * BOOK.pitch;
    solid([cx - BOOK.w / 2, LOWER_TRAY, -BOOK.depth / 2], [cx + BOOK.w / 2, LOWER_TRAY + h * BOOK.perPx, BOOK.depth / 2], color, ['bottom']);
  });

  // The wheels: round tubes along z under the lower tray, a hub standing
  // proud of each cap.
  for (const x of [-WHEEL.x, WHEEL.x]) {
    merge(mesh, tube([x, WHEEL.y, -WHEEL.half], [x, WHEEL.y, WHEEL.half], WHEEL.r, WHEEL.r, WHEEL.sides, C.wheel, { capA: C.wheel, capB: C.wheel }));
    for (const s of [-1, 1]) {
      const a = [x, WHEEL.y, s * WHEEL.half];
      const b = [x, WHEEL.y, s * (WHEEL.half + WHEEL.hubProud)];
      merge(mesh, tube(a, b, WHEEL.hubR, WHEEL.hubR, WHEEL.hubSides, C.hub, { capB: C.hub }));
    }
  }

  // Every face is wound to face out of the cart (return-cart.test.js renders
  // it from both sides), so all of them cull.
  for (const f of mesh.faces) f.cull = true;
  return mesh;
}
