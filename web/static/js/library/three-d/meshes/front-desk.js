// First Person Front Desk, referenced to Top-Down's drawFrontDesk
// (docs/skills/convert-2d-to-3d/SKILL.md). The geometry is real-world size and gives
// the depth: the counter body, the top slab standing proud of it, and on the
// slab the monitor, a stack of books, the service bell and the potted plant,
// each where frontDeskLayout puts it. The flat fronts wear the 2D art itself:
// the game paints drawFrontDesk into a canvas (paintFrontDeskArt) and the
// body (shine band, heart), the slab and the monitor (its screen of book
// covers) each show exactly their own region of it. Without art (tests, no
// canvas) the same faces fall back to FRONT_DESK_COLORS.
//
// Model space: base at y=0, centered on x/z, front facing +Z (the side the
// patrons queue on and the player walks up to). Pure and deterministic.
import { prism, merge, emptyMesh, boxWithout, textureFront, translate, supportTop } from './geom.js';
import { leafBlob } from './decor.js';
import { frontDeskLayout, drawFrontDesk, drawFrontDeskCounter, FRONT_DESK_COLORS } from '../../anime-furniture.js';

/** The box drawFrontDesk is drawn into for First Person: Top-Down's own. */
export const FRONT_DESK_ART = { w: 124, h: 84 };
/** Image px per art px: sharp at interact range without a large canvas. */
export const FRONT_DESK_ART_SCALE = 4;
/** Model units per art px, x and y alike: the 120 px top slab is 2.8 wide. */
export const FRONT_DESK_K = 2.8 / 120;
/** Real-world size, in units (~1 = one metre); the counter top is art y -6, 44 px above the floor line. */
export const FRONT_DESK_SIZE = { width: 2.8, depth: 1.0, counterTop: 44 * FRONT_DESK_K };

const BODY_Z = 0.4; // the body's front; the slab stands proud of it
const MONITOR_HALF = 0.05; // the monitor is 0.1 thick, centred on z = 0
const BOOK_HALF = 0.15; // the books are 0.3 deep
const STAND_DEPTH = 0.1; // the monitor's foot reaches this far in front of it
const DIV_WIDE = [2, 1];

/**
 * Paints the First Person front desk art: an opaque backing in the counter
 * colour (the renderer needs the mapped regions opaque, and the blocks'
 * rounded corners are not), seam fills under the slab and monitor, then
 * drawFrontDesk at FRONT_DESK_ART, then the counter again clipped to the
 * slab (drawFrontDeskCounter), so the slab's front is the clean slab. `ctx` is a
 * canvas of FRONT_DESK_ART.w x .h times FRONT_DESK_ART_SCALE. Reads only
 * `station.id`.
 */
export function paintFrontDeskArt(ctx, station) {
  ctx.fillStyle = FRONT_DESK_COLORS.counter;
  ctx.fillRect(0, 0, FRONT_DESK_ART.w * FRONT_DESK_ART_SCALE, FRONT_DESK_ART.h * FRONT_DESK_ART_SCALE);
  ctx.save();
  ctx.scale(FRONT_DESK_ART_SCALE, FRONT_DESK_ART_SCALE);
  ctx.translate(FRONT_DESK_ART.w / 2, FRONT_DESK_ART.h / 2);
  // Seam fills: the slab and the monitor are square boxes in 3D, so the
  // corners their rounded 2D blocks leave bare take the part's own colour,
  // not the counter backing (which showed as peach wedges).
  const L = frontDeskLayout(FRONT_DESK_ART);
  for (const [r, color] of [[L.top, FRONT_DESK_COLORS.top], [L.monitor, FRONT_DESK_COLORS.monitor]]) {
    ctx.fillStyle = color;
    ctx.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
  }
  const box = { id: station.id, w: FRONT_DESK_ART.w, h: FRONT_DESK_ART.h };
  drawFrontDesk(ctx, box);
  // A clean slab: the 2D draws the pot's foot, the monitor's stand, the
  // lowest book and the bell's base over the slab's edge, but in 3D those
  // stand on the slab, so its front shows only the counter, repainted here
  // clipped to the slab's region (on its seam fill, so its rounded corners
  // keep nothing of what was drawn over them).
  ctx.save();
  ctx.beginPath();
  ctx.rect(L.top.x0, L.top.y0, L.top.x1 - L.top.x0, L.top.y1 - L.top.y0);
  ctx.clip();
  ctx.fillStyle = FRONT_DESK_COLORS.top;
  ctx.fillRect(L.top.x0, L.top.y0, L.top.x1 - L.top.x0, L.top.y1 - L.top.y0);
  drawFrontDeskCounter(ctx, box);
  ctx.restore();
  ctx.restore();
}

/**
 * @param {{art?: CanvasImageSource}} [opts] art: a canvas paintFrontDeskArt painted
 * @returns {{vertices: number[][], faces: object[]}}
 */
export function buildFrontDesk({ art } = {}) {
  const L = frontDeskLayout(FRONT_DESK_ART);
  const C = FRONT_DESK_COLORS;
  const K = FRONT_DESK_K;
  // Art px -> model units, one scale for x and y; model y is up from the floor line.
  const mx = (x) => x * K;
  const my = (y) => (L.floor - y) * K;
  const slabTop = my(L.top.y0);
  // Things on the counter stand on the slab, even where the 2D tucks their foot behind its edge.
  const onSlab = (y) => Math.max(my(y), slabTop);
  const mesh = emptyMesh();

  // Show art region r on a part's +Z face (boxWithout keeps it as faces[0]).
  const front = (part, r, color, div) =>
    merge(mesh, textureFront(part, r, { image: art, artBox: FRONT_DESK_ART, scale: FRONT_DESK_ART_SCALE, color, div }));
  const solid = (min, max, color, drop) => merge(mesh, boxWithout(min, max, color, drop));

  // The counter body (its top is inside the slab) and the top slab, proud of
  // it; the slab's top is a supporting surface, drawn before all that stands
  // on it (supportTop).
  front(boxWithout([mx(L.body.x0), my(L.body.y1), -BODY_Z], [mx(L.body.x1), my(L.body.y0), BODY_Z], C.counter, ['bottom', 'top']), L.body, C.counter, DIV_WIDE);
  front(supportTop(boxWithout([mx(L.top.x0), my(L.top.y1), -FRONT_DESK_SIZE.depth / 2], [mx(L.top.x1), slabTop, FRONT_DESK_SIZE.depth / 2], C.top, ['bottom'])), L.top, C.top, DIV_WIDE);

  // The monitor on its foot, the foot showing in front of it as the 2D's stand does below it.
  front(boxWithout([mx(L.monitor.x0), slabTop, -MONITOR_HALF], [mx(L.monitor.x1), my(L.monitor.y0), MONITOR_HALF], C.monitor, ['bottom']), L.monitor, C.monitor, DIV_WIDE);
  solid([mx(L.stand.x0), slabTop, MONITOR_HALF], [mx(L.stand.x1), slabTop + (L.stand.y1 - L.stand.y0) * K, MONITOR_HALF + STAND_DEPTH], C.stand, ['bottom', 'back']);

  // The stack of books, bottom first, each on the one below.
  let base = slabTop;
  L.books.forEach((b, i) => {
    solid([mx(b.x0), base, -BOOK_HALF], [mx(b.x1), my(b.y0), BOOK_HALF], C.books[i], ['bottom']);
    base = my(b.y0);
  });

  // The service bell: its base plate, a gold dome and the button on top.
  const bb = L.bellBase;
  const plateHalf = ((bb.x1 - bb.x0) / 2) * K;
  const plateTop = onSlab(bb.y0);
  solid([mx(bb.x0), slabTop, -plateHalf], [mx(bb.x1), plateTop, plateHalf], C.bellBase, ['bottom']);
  const R = L.bell.r * K;
  const dome = [0, 45, 75].map((deg) => {
    const a = (deg * Math.PI) / 180;
    return { y: plateTop + R * Math.sin(a), rx: R * Math.cos(a), rz: R * Math.cos(a), color: C.bell };
  });
  merge(mesh, translate(prism(dome, 8, C.bell, null), [mx(L.bell.x), 0, 0]));
  const btn = L.bellButton;
  solid([mx(btn.x - btn.r), my(btn.y + btn.r), -btn.r * K], [mx(btn.x + btn.r), my(btn.y - btn.r), btn.r * K], C.bellBase, ['bottom']);

  // The potted plant: a pot narrowing to its foot, and a leaf blob per 2D circle.
  const pr = ((L.pot.x1 - L.pot.x0) / 2) * K;
  const pot = prism([
    { y: onSlab(L.pot.y1), rx: pr * 0.8, rz: pr * 0.8, color: C.pot },
    { y: my(L.pot.y0), rx: pr, rz: pr, color: C.pot },
  ], 6, C.pot, null);
  merge(mesh, translate(pot, [mx((L.pot.x0 + L.pot.x1) / 2), 0, 0]));
  for (const l of L.leaves) merge(mesh, leafBlob(mx(l.x), my(l.y), 0, l.r * K, C.leaf, { sides: 6, bands: 3 }));

  // Every face is wound to face out of the desk (front-desk.test.js renders
  // it from both sides), so all of them cull.
  for (const f of mesh.faces) f.cull = true;
  return mesh;
}
