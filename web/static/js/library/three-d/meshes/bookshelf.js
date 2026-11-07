// First Person bookshelf, referenced to Top-Down's drawBookcase
// (docs/skills/2d-to-3d/SKILL.md). The geometry is real-world size and gives
// the depth: a case of crown, plinth and two sides, a recessed bay, and plank
// lips standing proud. The surface is the 2D art itself: the game paints
// drawBookcase into a canvas (paintBookshelfArt) and each box's front face
// shows exactly its own region of it, read from bookcaseLayout, the same
// layout drawBookcase draws with. Without art (tests, no canvas) the same
// faces fall back to the bookcase's flat colours.
//
// Model space: base at y=0, centered on x/z, front facing +Z. Pure and
// deterministic.
import { box, quad, merge, emptyMesh } from './geom.js';
import { bookcaseLayout, drawBookcase, BOOKCASE_COLORS } from '../../anime-furniture.js';

/** Real-world size, in units (~1 = one metre). */
export const BOOKSHELF_SIZE = { width: 1.0, height: 2.0, depth: 0.35 };
/**
 * The box drawBookcase is drawn into for First Person: the same 124 px width
 * as Top-Down, with the height chosen so the case (inset 3 px each side) has
 * the mesh's own 1:2 aspect, and 4 rows to suit a 2 m case.
 */
export const BOOKSHELF_ART = { w: 124, h: 242, rows: 4 };
/** Image px per art px: sharp at interact range without a large canvas. */
export const ART_SCALE = 3;

const RECESS = 0.07; // spine rows sit this far behind the frame's front
const LIP = 0.01; // plank lips stand this far proud of it
// [nu, nv] cells per textured face: enough to hide the affine mapping's
// missing perspective divide, few enough for four shelves on screen.
const DIV_WIDE = [2, 1];
const DIV_TALL = [1, 3];

/**
 * Paints the First Person bookshelf art: an opaque backing in the case colour
 * (the renderer needs the mapped region opaque, and the case's rounded corners
 * are not), then drawBookcase at BOOKSHELF_ART. `ctx` is a canvas of
 * BOOKSHELF_ART.w x .h times ART_SCALE; `drawOpts` are the same {color, sign,
 * titles} Top-Down passes, so both views show the same books.
 */
export function paintBookshelfArt(ctx, station, drawOpts) {
  ctx.save();
  ctx.fillStyle = BOOKCASE_COLORS.case;
  ctx.fillRect(0, 0, BOOKSHELF_ART.w * ART_SCALE, BOOKSHELF_ART.h * ART_SCALE);
  ctx.scale(ART_SCALE, ART_SCALE);
  ctx.translate(BOOKSHELF_ART.w / 2, BOOKSHELF_ART.h / 2);
  drawBookcase(ctx, { id: station.id, w: BOOKSHELF_ART.w, h: BOOKSHELF_ART.h }, { ...drawOpts, rows: BOOKSHELF_ART.rows });
  ctx.restore();
}

/** A box without the faces named in `drop` (hidden ones would only tie in the painter's sort). */
function boxWithout(min, max, color, drop) {
  const names = ['front', 'back', 'right', 'left', 'top', 'bottom']; // geom.box's face order
  const b = box(min, max, color);
  return { vertices: b.vertices, faces: b.faces.filter((_, i) => !drop.includes(names[i])) };
}

/**
 * @param {{art?: CanvasImageSource}} [opts] art: a canvas paintBookshelfArt painted
 * @returns {{vertices: number[][], faces: object[]}}
 */
export function buildBookshelf({ art } = {}) {
  const { width: W, height: H, depth: D } = BOOKSHELF_SIZE;
  const L = bookcaseLayout(BOOKSHELF_ART, BOOKSHELF_ART.rows);
  const c = L.case;
  // Art px -> model units: the case rect fills the mesh's width and height.
  const mx = (x) => ((x - c.x0) / (c.x1 - c.x0)) * W - W / 2;
  const my = (y) => ((c.y1 - y) / (c.y1 - c.y0)) * H;
  const zBack = -D / 2;
  const zFront = D / 2;
  const zRow = zFront - RECESS;
  const mesh = emptyMesh();

  // Texture the +Z face of a part (geom.box's first face) with art region r.
  const front = (part, r, color, div) => {
    const f = part.faces[0];
    if (art) {
      // box's front winds (x0,y0) (x1,y0) (x1,y1) (x0,y1) in model space;
      // model y up is art y down.
      const u = (x) => (x + BOOKSHELF_ART.w / 2) * ART_SCALE;
      const v = (y) => (y + BOOKSHELF_ART.h / 2) * ART_SCALE;
      f.texture = { image: art, uv: [[u(r.x0), v(r.y1)], [u(r.x1), v(r.y1)], [u(r.x1), v(r.y0)], [u(r.x0), v(r.y0)]], div };
      f.unlit = true;
    } else {
      f.color = color;
    }
    merge(mesh, part);
  };
  // A part spanning art region r, from z0 to z1, its front textured.
  const part = (r, z0, z1, color, drop, div) =>
    front(boxWithout([mx(r.x0), my(r.y1), z0], [mx(r.x1), my(r.y0), z1], color, drop), r, color, div);

  const last = L.shelves[L.shelves.length - 1].plank;
  // The case: crown (with the sign), plinth, and the two sides between them.
  part({ x0: c.x0, y0: c.y0, x1: c.x1, y1: L.back.y0 }, zBack, zFront, BOOKCASE_COLORS.case, [], DIV_WIDE);
  part({ x0: c.x0, y0: last.y1, x1: c.x1, y1: c.y1 }, zBack, zFront, BOOKCASE_COLORS.case, [], DIV_WIDE);
  part({ x0: c.x0, y0: L.back.y0, x1: L.back.x0, y1: last.y1 }, zBack, zFront, BOOKCASE_COLORS.case, ['top', 'bottom'], DIV_TALL);
  part({ x0: L.back.x1, y0: L.back.y0, x1: c.x1, y1: last.y1 }, zBack, zFront, BOOKCASE_COLORS.case, ['top', 'bottom'], DIV_TALL);
  // The bay: a spine row on the recessed plane above each plank lip.
  L.shelves.forEach((s, r) => {
    const rowTop = r === 0 ? L.back.y0 : L.shelves[r - 1].plank.y1;
    const row = quad([[mx(L.back.x0), my(s.plank.y0), zRow], [mx(L.back.x1), my(s.plank.y0), zRow], [mx(L.back.x1), my(rowTop), zRow], [mx(L.back.x0), my(rowTop), zRow]], BOOKCASE_COLORS.back);
    front(row, { x0: L.back.x0, y0: rowTop, x1: L.back.x1, y1: s.plank.y0 }, BOOKCASE_COLORS.back, DIV_WIDE);
    // The lip's ends sink into the sides and its back sits on the row plane, so neither shows.
    part(s.plank, zRow, zFront + LIP, BOOKCASE_COLORS.plank, ['back', 'left', 'right'], DIV_WIDE);
  });
  // The case's back, seen from behind the shelf.
  merge(mesh, quad([[mx(L.back.x1), my(last.y1), zBack], [mx(L.back.x0), my(last.y1), zBack], [mx(L.back.x0), my(L.back.y0), zBack], [mx(L.back.x1), my(L.back.y0), zBack]], BOOKCASE_COLORS.case));
  // Every face is wound to face out of the shelf (bookshelf.test.js renders it
  // from both sides), so all of them cull: a face turned away from the camera,
  // like the crown's top above eye level, can then never be painted over the
  // sign by the painter's sort.
  for (const f of mesh.faces) f.cull = true;
  return mesh;
}
