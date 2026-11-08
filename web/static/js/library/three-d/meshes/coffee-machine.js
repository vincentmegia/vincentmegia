// First Person coffee machine, referenced to Top-Down's drawCoffeeMachine
// (docs/skills/2d-to-3d/SKILL.md). The geometry is real-world size and gives
// the depth: a 0.4 x 0.5 x 0.4 machine standing on a counter-height wooden
// stand (so it reads at the 1.5 m eye height), its brewing bay recessed into
// the body, the group head and spouts hanging inside the bay, the drip tray
// standing proud, and the clear bean hopper on top. The surface is the 2D art
// itself: the game paints drawCoffeeMachine into a canvas
// (paintCoffeeMachineArt) and each part's front shows exactly its own region
// of it, read from coffeeMachineLayout, the layout drawCoffeeMachine draws
// with. Without art (tests, no canvas) the same faces take the drawer's flat
// colours. The stand wears the library's own wood (BOOKCASE_COLORS).
//
// Model space: base at y=0, centered on x/z, front facing +Z. Pure and
// deterministic.
import { quad, merge, emptyMesh, boxWithout, textureFront } from './geom.js';
import {
  coffeeMachineLayout, drawCoffeeMachine, drawOutOfOrderTape, COFFEE_MACHINE_COLORS, BOOKCASE_COLORS,
} from '../../anime-furniture.js';

/** The machine's real-world size, in units (~1 = one metre). */
export const COFFEE_MACHINE_SIZE = { width: 0.4, height: 0.5, depth: 0.4 };
/** The counter-height stand it sits on. */
export const COFFEE_MACHINE_STAND = { width: 0.6, height: 0.9, depth: 0.5 };
/**
 * The box drawCoffeeMachine is drawn into for First Person: Top-Down's 84 px
 * width, with the height chosen so the machine (body plus hopper) has the
 * mesh's own 0.4 : 0.5 aspect. A taller box only makes the bay taller
 * (coffeeMachineLayout).
 */
export const COFFEE_MACHINE_ART = { w: 84, h: 94.5 };
/** Image px per art px: sharp at interact range (a 336 x 378 canvas). */
export const ART_SCALE = 4;

const RECESS = 0.07; // the bay's back sits this far behind the body's front
const GROUP_HEAD = 0.05; // the group head stands this far off the bay's back
const SPOUT = [0.01, 0.035]; // the spouts' back and front, off the bay's back
const TRAY_LIP = 0.03; // the drip tray stands this far proud of the body
const HOPPER_Z = [-0.04, 0.12]; // the hopper's back and front
const SLAB = 0.04; // the stand's top slab
const HOPPER_SEAM = 0.5; // art px of band colour under the hopper (paintCoffeeMachineArt)
const CABINET_INSET = 0.03; // the cabinet below sits in from the slab (its front clear of the tray's plane)
const DIV_WIDE = [2, 1];
const DIV_TALL = [1, 2];
const DIV_BAY = [2, 2];
const DIV_ONE = [1, 1];

/**
 * Paints the First Person coffee machine art: an opaque backing (the body
 * colour, the top band's colour under its rounded corners, and the station
 * ground behind the clear hopper, as Top-Down shows it), then
 * drawCoffeeMachine at COFFEE_MACHINE_ART, then, when `drawOpts.outOfOrder`,
 * the OUT OF ORDER tape over it. `ctx` is a canvas of COFFEE_MACHINE_ART.w x
 * .h times ART_SCALE.
 *
 * @param {{outOfOrder?: boolean}} [drawOpts]
 */
export function paintCoffeeMachineArt(ctx, station, drawOpts = {}) {
  const C = COFFEE_MACHINE_COLORS;
  const L = coffeeMachineLayout(COFFEE_MACHINE_ART);
  const fill = (r, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
  };
  ctx.save();
  ctx.fillStyle = C.body;
  ctx.fillRect(0, 0, COFFEE_MACHINE_ART.w * ART_SCALE, COFFEE_MACHINE_ART.h * ART_SCALE);
  ctx.scale(ART_SCALE, ART_SCALE);
  ctx.translate(COFFEE_MACHINE_ART.w / 2, COFFEE_MACHINE_ART.h / 2);
  fill(L.band, C.band);
  fill(L.hopper, C.ground);
  drawCoffeeMachine(ctx, { id: station.id, w: COFFEE_MACHINE_ART.w, h: COFFEE_MACHINE_ART.h });
  // The renderer grows each textured triangle a little past its edge, so the
  // head's top edge would show a sliver of the hopper's glass drawn just above
  // it. Its real neighbour there is the machine's top, in the band's colour:
  // a thin band-coloured seam, which reads as where the hopper sits.
  fill({ x0: L.body.x0, y0: L.body.y0 - HOPPER_SEAM, x1: L.body.x1, y1: L.body.y0 }, C.band);
  if (drawOpts.outOfOrder) drawOutOfOrderTape(ctx);
  ctx.restore();
}

/**
 * @param {{art?: CanvasImageSource}} [opts] art: a canvas paintCoffeeMachineArt painted
 * @returns {{vertices: number[][], faces: object[]}}
 */
export function buildCoffeeMachine({ art } = {}) {
  const C = COFFEE_MACHINE_COLORS;
  const L = coffeeMachineLayout(COFFEE_MACHINE_ART);
  const { width: W, depth: D } = COFFEE_MACHINE_SIZE;
  const S = COFFEE_MACHINE_STAND;
  // Art px -> model units: the body's width fills the machine's, one scale
  // both ways, and the body's bottom stands on the stand.
  const k = W / (L.body.x1 - L.body.x0);
  const mx = (x) => x * k;
  const my = (y) => S.height + (L.body.y1 - y) * k;
  const zB = -D / 2;
  const zF = D / 2;
  const zRow = zF - RECESS;
  const mesh = emptyMesh();

  // Show art region r on a part's +Z face (its faces[0]).
  const front = (part, r, color, div) =>
    merge(mesh, textureFront(part, r, { image: art, artBox: COFFEE_MACHINE_ART, scale: ART_SCALE, color, div }));
  // A part spanning art region r, from z0 to z1, its front textured.
  const part = (r, z0, z1, color, drop, div) =>
    front(boxWithout([mx(r.x0), my(r.y1), z0], [mx(r.x1), my(r.y0), z1], color, drop), r, color, div);

  // The stand: a wooden top slab on a cabinet set in under it.
  const sw = S.width / 2;
  const sd = S.depth / 2;
  merge(mesh, boxWithout([-sw, S.height - SLAB, -sd], [sw, S.height, sd], BOOKCASE_COLORS.plank, ['bottom']));
  const ci = CABINET_INSET;
  merge(mesh, boxWithout([-sw + ci, 0, -sd + ci], [sw - ci, S.height - SLAB, sd - ci], BOOKCASE_COLORS.case, ['top', 'bottom']));

  // The body: a head across the top (band, display, buttons) and a jamb either
  // side of the bay, all at the front plane.
  const head = { x0: L.body.x0, y0: L.body.y0, x1: L.body.x1, y1: L.bay.y0 };
  const headPart = boxWithout([mx(head.x0), my(head.y1), zB], [mx(head.x1), my(head.y0), zF], C.body, ['bottom']);
  // Seen from above, the machine's top is the band's colour.
  for (const f of headPart.faces) if (f.indices.every((i) => headPart.vertices[i][1] === my(head.y0))) f.color = C.band;
  front(headPart, head, C.body, DIV_WIDE);
  part({ x0: L.body.x0, y0: L.bay.y0, x1: L.bay.x0, y1: L.body.y1 }, zB, zF, C.body, ['top', 'bottom', 'right'], DIV_TALL);
  part({ x0: L.bay.x1, y0: L.bay.y0, x1: L.body.x1, y1: L.body.y1 }, zB, zF, C.body, ['top', 'bottom', 'left'], DIV_TALL);

  // The bay: its back (group head, drip, cup and steam are in its art) on the
  // recessed plane down to the drip tray, its two side walls, and the tray's
  // floor. Its ceiling faces down, above nobody's eye, so it is left out.
  const bx0 = mx(L.bay.x0);
  const bx1 = mx(L.bay.x1);
  const yTray = my(L.tray.y0);
  const yBayTop = my(L.bay.y0);
  const bayBack = { x0: L.bay.x0, y0: L.bay.y0, x1: L.bay.x1, y1: L.tray.y0 };
  front(quad([[bx0, yTray, zRow], [bx1, yTray, zRow], [bx1, yBayTop, zRow], [bx0, yBayTop, zRow]], C.bay), bayBack, C.bay, DIV_BAY);
  merge(mesh, quad([[bx0, yTray, zF], [bx0, yTray, zRow], [bx0, yBayTop, zRow], [bx0, yBayTop, zF]], C.bay)); // left wall, facing +X
  merge(mesh, quad([[bx1, yTray, zRow], [bx1, yTray, zF], [bx1, yBayTop, zF], [bx1, yBayTop, zRow]], C.bay)); // right wall, facing -X
  merge(mesh, quad([[bx0, yTray, zF], [bx1, yTray, zF], [bx1, yTray, zRow], [bx0, yTray, zRow]], C.steel)); // tray floor
  // The body's back behind the bay (the head and jambs bring their own).
  merge(mesh, quad([[bx1, my(L.body.y1), zB], [bx0, my(L.body.y1), zB], [bx0, yBayTop, zB], [bx1, yBayTop, zB]], C.body));

  // Proud parts in the bay: the group head, its two spouts and the drip tray's lip.
  part(L.groupHead, zRow, zRow + GROUP_HEAD, C.steel, ['back', 'top', 'bottom'], DIV_ONE);
  for (const s of L.spouts) part(s, zRow + SPOUT[0], zRow + SPOUT[1], C.steel, ['back', 'top', 'bottom'], DIV_ONE);
  part(L.tray, zF, zF + TRAY_LIP, C.steel, ['back', 'bottom'], DIV_WIDE);

  // The hopper: a box whose bottom edge is pulled in to the drawn trapezoid,
  // its front mapped corner for corner onto the drawn one.
  const hp = L.hopper;
  const hopper = boxWithout([mx(hp.x0), my(hp.y1), HOPPER_Z[0]], [mx(hp.x1), my(hp.y0), HOPPER_Z[1]], C.hopperSolid, ['bottom']);
  for (const v of hopper.vertices) if (v[1] === my(hp.y1)) v[0] = v[0] < 0 ? mx(hp.bx0) : mx(hp.bx1);
  for (const f of hopper.faces) if (f.indices.every((i) => hopper.vertices[i][1] === my(hp.y0))) f.color = C.beans; // beans, seen from above
  const u = (x) => (x + COFFEE_MACHINE_ART.w / 2) * ART_SCALE;
  const v = (y) => (y + COFFEE_MACHINE_ART.h / 2) * ART_SCALE;
  const hf = hopper.faces[0];
  if (art) {
    hf.texture = { image: art, uv: [[u(hp.bx0), v(hp.y1)], [u(hp.bx1), v(hp.y1)], [u(hp.x1), v(hp.y0)], [u(hp.x0), v(hp.y0)]], div: DIV_ONE };
    hf.unlit = true;
  }
  merge(mesh, hopper);

  // Every face is wound to face out of the machine (coffee-machine.test.js
  // renders it from in front, the side and behind), so all of them cull.
  for (const f of mesh.faces) f.cull = true;
  return mesh;
}
