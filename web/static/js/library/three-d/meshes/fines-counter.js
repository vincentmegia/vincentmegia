// First Person Fines Counter, referenced to Top-Down's drawFinesRoom
// (docs/skills/convert-2d-to-3d/SKILL.md). The geometry is real-world size and gives
// the depth: the counter body, the top standing proud of it, and on the top
// the register with its display housing, two stacks of coins, and at the
// back edge the plaque on its two posts, each where finesRoomLayout puts it.
// The flat fronts wear the 2D art itself: the game paints drawFinesRoom into
// a canvas (paintFinesCounterArt) and the body (its heart), the top, the
// register (its keypad), the housing (its display) and the plaque (its
// 벌금 · FINES lettering) each show exactly their own region of it. The
// room's tiles and lamp glow are not modelled. Without art (tests, no
// canvas) the same faces fall back to FINES_ROOM_COLORS.
//
// Model space: base at y=0, centered on x/z, front facing +Z (the side the
// patrons queue on and the player walks up to). Pure and deterministic.
import { prism, merge, emptyMesh, boxWithout, textureFront, translate, supportTop } from './geom.js';
import {
  finesRoomLayout, drawFinesRoom, drawFinesPlaque, drawFinesCounterBase, drawFinesDisplay, drawFinesRegister,
  FINES_ROOM_COLORS,
} from '../../anime-furniture.js';

/** The box drawFinesRoom is drawn into for First Person: Top-Down's own. */
export const FINES_COUNTER_ART = { w: 130, h: 130 };
/** Image px per art px: the plaque's lettering stays sharp at interact range. */
export const FINES_COUNTER_ART_SCALE = 4;
/** Model units per art px, x and y alike: the 114 px top is 2.4 wide. */
export const FINES_COUNTER_K = 2.4 / 114;
/** The art region the housing's front shows: L.housing down to the register's top (the 2D tucks its last px behind the register). */
export const FINES_HOUSING_FRONT = (() => {
  const L = finesRoomLayout(FINES_COUNTER_ART);
  return { ...L.housing, y1: Math.min(L.housing.y1, L.register.y0) };
})();
/** Real-world size, in units (~1 = one metre): the top's width and depth. */
export const FINES_COUNTER_SIZE = { width: 2.4, depth: 1.1 };

const BODY_Z = 0.45; // the body's front; the top overhangs it
const REGISTER_HALF = 0.25; // the register is 0.5 deep, centred on z = 0
const HOUSING_HALF = 0.15; // the display housing is thinner, set back from the register's front
const PLAQUE_BACK = -0.5; // the plaque board's back, at the counter's back edge
const BOARD = 0.04; // the plaque board's thickness and the posts' side
const POST_X = 0.75;
const COIN_SIDES = 8;
// The 2D draws the second stack over the first's edge. In 3D two discs 9 art
// px apart would intersect (and intersecting solids cannot be painted in
// order), so the first stands back and the second forward, a disc's
// half-width each, their footprints just touching.
const COIN_SIDES_COS = Math.cos(Math.PI / COIN_SIDES); // an 8-gon disc's half-width over its radius
const DIV_WIDE = [2, 1];
const DIV_ONE = [1, 1];

/**
 * Paints the First Person fines counter art: an opaque backing in the
 * counter colour (the renderer needs the mapped regions opaque), then
 * drawFinesRoom at FINES_COUNTER_ART, then each textured part again, clipped
 * to its own region on a fill of its own colour: the plaque, the body and
 * top, the housing, the register. So each front shows only its own part:
 * none of the room's tiles or glow at the rounded corners, none of the
 * register or coins the 2D draws over the top's edge (they stand on the top
 * in 3D). The register runs last, so the housing region's bottom art row
 * (y -14..-13) shows the register's top edge again, as the 2D does; the
 * housing's 3D front shows its region only down to the register's top
 * (FINES_HOUSING_FRONT), so that row is not used. `ctx` is a canvas of
 * FINES_COUNTER_ART.w x .h times FINES_COUNTER_ART_SCALE. Reads only
 * `station.id`.
 */
export function paintFinesCounterArt(ctx, station) {
  const C = FINES_ROOM_COLORS;
  ctx.fillStyle = C.counter;
  ctx.fillRect(0, 0, FINES_COUNTER_ART.w * FINES_COUNTER_ART_SCALE, FINES_COUNTER_ART.h * FINES_COUNTER_ART_SCALE);
  ctx.save();
  ctx.scale(FINES_COUNTER_ART_SCALE, FINES_COUNTER_ART_SCALE);
  ctx.translate(FINES_COUNTER_ART.w / 2, FINES_COUNTER_ART.h / 2);
  const box = { id: station.id, w: FINES_COUNTER_ART.w, h: FINES_COUNTER_ART.h };
  drawFinesRoom(ctx, box);
  const L = finesRoomLayout(FINES_COUNTER_ART);
  const parts = [
    [[[L.plaque, C.plaque]], drawFinesPlaque],
    [[[L.body, C.counter], [L.top, C.top]], drawFinesCounterBase],
    [[[L.housing, C.housing]], drawFinesDisplay],
    [[[L.register, C.register]], drawFinesRegister],
  ];
  for (const [regions, draw] of parts) {
    ctx.save();
    ctx.beginPath();
    for (const [r] of regions) ctx.rect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
    ctx.clip();
    for (const [r, color] of regions) {
      ctx.fillStyle = color;
      ctx.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
    }
    draw(ctx, box);
    ctx.restore();
  }
  ctx.restore();
}

/**
 * @param {{art?: CanvasImageSource}} [opts] art: a canvas paintFinesCounterArt painted
 * @returns {{vertices: number[][], faces: object[]}}
 */
export function buildFinesCounter({ art } = {}) {
  const L = finesRoomLayout(FINES_COUNTER_ART);
  const C = FINES_ROOM_COLORS;
  const K = FINES_COUNTER_K;
  // Art px -> model units, one scale for x and y; model y is up from the floor line.
  const mx = (x) => x * K;
  const my = (y) => (L.floor - y) * K;
  const topY = my(L.top.y0);
  const mesh = emptyMesh();

  // Show art region r on a part's +Z face (boxWithout keeps it as faces[0]).
  const front = (part, r, color, div) =>
    merge(mesh, textureFront(part, r, { image: art, artBox: FINES_COUNTER_ART, scale: FINES_COUNTER_ART_SCALE, color, div }));
  const solid = (min, max, color, drop) => merge(mesh, boxWithout(min, max, color, drop));

  const r = L.coinR * K;
  const rr = r * COIN_SIDES_COS; // the disc's half-width on x and z
  const coinZ = (s) => (s === 0 ? -rr : rr);

  // The counter body (its top is inside the top) and the top, overhanging
  // it; the top's top face is a supporting surface, drawn before all that
  // stands on it (supportTop).
  front(boxWithout([mx(L.body.x0), 0, -BODY_Z], [mx(L.body.x1), my(L.body.y0), BODY_Z], C.counter, ['bottom', 'top']), L.body, C.counter, DIV_WIDE);
  front(supportTop(boxWithout([mx(L.top.x0), my(L.top.y1), -FINES_COUNTER_SIZE.depth / 2], [mx(L.top.x1), topY, FINES_COUNTER_SIZE.depth / 2], C.top, ['bottom'])), L.top, C.top, DIV_WIDE);

  // The register on the top, its top a supporting surface too, and its
  // display housing standing on it. The 2D tucks the housing 1 art px behind
  // the register's edge; in 3D it sits on the register's top and its front
  // shows its art region cropped there (FINES_HOUSING_FRONT), not stretched.
  front(supportTop(boxWithout([mx(L.register.x0), topY, -REGISTER_HALF], [mx(L.register.x1), my(L.register.y0), REGISTER_HALF], C.register, ['bottom'])), L.register, C.register, DIV_ONE);
  const hf = FINES_HOUSING_FRONT;
  front(boxWithout([mx(hf.x0), my(hf.y1), -HOUSING_HALF], [mx(hf.x1), my(hf.y0), HOUSING_HALF], C.housing, ['bottom']), hf, C.housing, DIV_ONE);

  // The coin stacks: discs coinPitch high, coin and coinDeep from the bottom, on the top.
  const h = L.coinPitch * K;
  L.coins.forEach(({ x, n }, s) => {
    for (let i = 0; i < n; i++) {
      const color = i % 2 ? C.coinDeep : C.coin;
      const disc = prism([
        { y: topY + i * h, rx: r, rz: r, color },
        { y: topY + (i + 1) * h, rx: r, rz: r, color },
      ], COIN_SIDES, color, null);
      merge(mesh, translate(disc, [mx(x), 0, coinZ(s)]));
    }
  });

  // The plaque: a board at the counter's back edge, on two posts behind it
  // rising from the top to the plaque's top.
  front(boxWithout([mx(L.plaque.x0), my(L.plaque.y1), PLAQUE_BACK], [mx(L.plaque.x1), my(L.plaque.y0), PLAQUE_BACK + BOARD], C.plaque), L.plaque, C.plaque, DIV_WIDE);
  for (const px of [-POST_X, POST_X]) {
    solid([px - BOARD / 2, topY, PLAQUE_BACK - BOARD], [px + BOARD / 2, my(L.plaque.y0), PLAQUE_BACK], C.top, ['bottom']);
  }

  // Every face is wound to face out of the counter (fines-counter.test.js
  // renders it from both sides), so all of them cull.
  for (const f of mesh.faces) f.cull = true;
  return mesh;
}
