// Room shell mesh: floor, ceiling, four walls, windows, wainscoting and light
// fixtures, plus the floor's dressing. WORLD coordinates (x∈[0,width],
// z∈[0,depth], y∈[0,height]); the camera stands inside. Pure and
// deterministic. The floor's checker, decals and back-wall art come from the
// caller (scene.js passes library/floor-dressing.js's, the same constants
// Top-Down's drawFloor paints with); the walls take drawBackWall's colours.
import { BACK_WALL } from '../floor-dressing.js';

export const WALL = BACK_WALL.top;
export const WAINSCOT = BACK_WALL.bottom;
export const CHAIR_RAIL = BACK_WALL.rail;
export const TRIM = BACK_WALL.trim;
export const BASEBOARD = BACK_WALL.trim;
const PANE = '#f5ecd8';
const FRAME = '#7a5a3a';
const CEILING = '#c4b8a0';
const LIGHT = '#fff0c8';

const PROUD = 0.1; // detail offset off its surface (painter-sort, no z-buffer)
// Longest edge of one shell face. The shell is the only geometry the camera
// stands inside, so its faces are the ones that straddle the near plane and
// that span the whole frame. Tiles bound both: each tile clips to a small
// piece and carries its own sort depth, instead of one room-sized quad whose
// single mean depth could put the floor over the furniture standing on it.
export const TILE = 120;
// Wall height (game px) of Top-Down's back-wall band top (band y = 0): band
// art at band y sits at height WALL_ART_TOP - y, 1:1 with x, so every piece
// keeps the x it has in Top-Down and its own proportions, just above the rail.
export const WALL_ART_TOP = 200;
// Texture cells per wall-art / rug tile, against the affine warp.
const ART_DIV = [1, 1];
const RUG_DIV = [2, 2];

/**
 * @param {object} opts
 * @param {number} opts.width
 * @param {number} opts.depth
 * @param {number} opts.height
 * @param {number} opts.tileSize side of one floor checker tile
 * @param {(col: number, row: number) => string} opts.tileColor the tile's #rrggbb
 * @param {{id: string, x: number, y: number, w: number, h: number, color: string, image?: CanvasImageSource}[]} [opts.decals]
 *   floor decals in game px, painted as their own ground layer over the tiles;
 *   one with an `image` wears it (opaque, covering exactly its box)
 * @param {{id: string, x: number, y: number, w: number, h: number, image?: CanvasImageSource}[]} [opts.wallArt]
 *   back-wall (z = 0) art boxes in Top-Down band px: cut out of the wall and
 *   filled with `image` (or WALL without one)
 * @returns {{vertices:number[][], faces:object[]}}
 */
export function buildRoom({ width, depth, height, tileSize, tileColor, decals = [], wallArt = [] }) {
  const vertices = [];
  const faces = [];
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const lerp = (a, b, t) => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
  const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  // Emits the quad [p0, p1, p2, p3] as a grid of at most TILE-sized tiles,
  // keeping the winding (so every tile's normal matches the original face).
  // `extra` is merged into every tile's face (the floor marks itself `ground`).
  // With `tex` ({image, uv: one [u, v] per corner, div}), each tile wears its
  // own bilinear share of the image.
  const quad = (pts, color, extra, tex) => {
    const [p0, p1, p2, p3] = pts;
    const nu = Math.max(1, Math.ceil(Math.max(dist(p0, p1), dist(p3, p2)) / TILE));
    const nv = Math.max(1, Math.ceil(Math.max(dist(p0, p3), dist(p1, p2)) / TILE));
    const at = (u, v) => lerp(lerp(p0, p1, u), lerp(p3, p2, u), v);
    const uvAt = (u, v) => lerp2(lerp2(tex.uv[0], tex.uv[1], u), lerp2(tex.uv[3], tex.uv[2], u), v);
    for (let iv = 0; iv < nv; iv++) {
      for (let iu = 0; iu < nu; iu++) {
        const u0 = iu / nu, u1 = (iu + 1) / nu;
        const v0 = iv / nv, v1 = (iv + 1) / nv;
        const base = vertices.length;
        vertices.push(at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1));
        const face = { indices: [base, base + 1, base + 2, base + 3], color, ...extra };
        if (tex?.image) {
          face.texture = {
            image: tex.image,
            uv: [uvAt(u0, v0), uvAt(u1, v0), uvAt(u1, v1), uvAt(u0, v1)],
            div: tex.div,
          };
        }
        faces.push(face);
      }
    }
  };

  // The floor: Top-Down's checker, one face per tile, wound to face up (+Y) so
  // the scene light reaches it as it does every other upward surface.
  const cols = Math.ceil(width / tileSize);
  const rows = Math.ceil(depth / tileSize);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x0 = col * tileSize, x1 = Math.min(width, x0 + tileSize);
      const z0 = row * tileSize, z1 = Math.min(depth, z0 + tileSize);
      quad([[x0, 0, z0], [x0, 0, z1], [x1, 0, z1], [x1, 0, z0]], tileColor(col, row), { ground: true });
    }
  }
  // Decals (guide stripes, rugs): the ground layer's second pass, over the tiles.
  for (const d of decals) {
    const x0 = d.x, x1 = d.x + d.w, z0 = d.y, z1 = d.y + d.h;
    const tex = d.image && {
      image: d.image,
      // Corners in the order below: (x0,z0) (x0,z1) (x1,z1) (x1,z0); the image
      // is the decal's box top-down, x right and y (= z) down.
      uv: [[0, 0], [0, d.image.height], [d.image.width, d.image.height], [d.image.width, 0]],
      div: RUG_DIV,
    };
    quad([[x0, 0, z0], [x0, 0, z1], [x1, 0, z1], [x1, 0, z0]], d.color, { ground: true, decal: d.id }, tex);
  }
  quad([[0, height, 0], [0, height, depth], [width, height, depth], [width, height, 0]], CEILING);

  // Each wall: origin point, along-wall axis (unit), inward normal, length.
  const walls = [
    { o: [0, 0, 0], u: [1, 0, 0], n: [0, 0, 1], len: width }, // z=0
    { o: [width, 0, depth], u: [-1, 0, 0], n: [0, 0, -1], len: width }, // z=depth
    { o: [0, 0, depth], u: [0, 0, -1], n: [1, 0, 0], len: depth }, // x=0
    { o: [width, 0, 0], u: [0, 0, 1], n: [-1, 0, 0], len: depth }, // x=width
  ];
  // Point on wall at distance s along it, height y, offset d inward.
  const at = (w, s, y, d) => [
    w.o[0] + w.u[0] * s + w.n[0] * d,
    y,
    w.o[2] + w.u[2] * s + w.n[2] * d,
  ];
  const rect = (w, s0, s1, y0, y1, d, color, extra, tex) =>
    quad([at(w, s0, y0, d), at(w, s1, y0, d), at(w, s1, y1, d), at(w, s0, y1, d)], color, extra, tex);

  // The back wall's plain surface with the art boxes cut out, and the art in
  // them: coplanar but never overlapping, so no sort can put wall over art.
  // The whole back wall is `unlit`, like a textured prop's front: it is
  // Top-Down's back-wall band, so it shows that band's own colours, and its
  // art needs no darkening overlay (whose per-triangle edges showed as seams).
  const UNLIT = { unlit: true };
  const backWall = (w) => {
    const arts = wallArt
      .map((a) => ({ ...a, s0: a.x, s1: a.x + a.w, y0: WALL_ART_TOP - a.y - a.h, y1: WALL_ART_TOP - a.y }))
      .sort((a, b) => a.s0 - b.s0);
    if (!arts.length) { rect(w, 0, w.len, 0, height, 0, WALL, UNLIT); return; }
    const lo = Math.min(...arts.map((a) => a.y0));
    const hi = Math.max(...arts.map((a) => a.y1));
    rect(w, 0, w.len, 0, lo, 0, WALL, UNLIT);
    rect(w, 0, w.len, hi, height, 0, WALL, UNLIT);
    let s = 0;
    for (const a of arts) {
      if (a.s0 > s) rect(w, s, a.s0, lo, hi, 0, WALL, UNLIT);
      if (a.y0 > lo) rect(w, a.s0, a.s1, lo, a.y0, 0, WALL, UNLIT);
      if (hi > a.y1) rect(w, a.s0, a.s1, a.y1, hi, 0, WALL, UNLIT);
      const tex = a.image && {
        image: a.image,
        uv: [[0, a.image.height], [a.image.width, a.image.height], [a.image.width, 0], [0, 0]],
        div: ART_DIV,
      };
      rect(w, a.s0, a.s1, a.y0, a.y1, 0, WALL, { unlit: true, wallArt: a.id }, tex);
      s = a.s1;
    }
    if (s < w.len) rect(w, s, w.len, lo, hi, 0, WALL, UNLIT);
  };

  const railY = height * 0.45;
  walls.forEach((w, wi) => {
    const lit = wi === 0 ? UNLIT : undefined;
    if (wi === 0) backWall(w);
    else rect(w, 0, w.len, 0, height, 0, WALL);
    rect(w, 0, w.len, 0, railY, PROUD, WAINSCOT, lit);
    // drawBackWall's rail: the pink band with the plum trim under it.
    rect(w, 0, w.len, railY - 7, railY, PROUD * 2, CHAIR_RAIL, lit);
    rect(w, 0, w.len, railY - 9.5, railY - 7, PROUD * 2, TRIM, lit);
    rect(w, 0, w.len, 0, height * 0.04, PROUD * 2, BASEBOARD, lit);
    // Three windows on the far wall (z=depth) and on each side wall.
    if (wi === 0) return;
    const ww = Math.min(w.len * 0.1, 80);
    const y0 = height * 0.55;
    const y1 = height * 0.9;
    for (let i = 0; i < 3; i++) {
      const c = w.len * (0.2 + i * 0.3);
      rect(w, c - ww / 2 - 3, c + ww / 2 + 3, y0 - 3, y1 + 3, PROUD, FRAME);
      rect(w, c - ww / 2, c + ww / 2, y0, y1, PROUD * 2, PANE);
    }
  });

  // Ceiling light fixtures: 3 x 2 grid, just below the ceiling.
  const ly = height - PROUD;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 2; j++) {
      const cx = width * (0.25 + i * 0.25);
      const cz = depth * (0.33 + j * 0.34);
      quad(
        [[cx - 25, ly, cz - 15], [cx - 25, ly, cz + 15], [cx + 25, ly, cz + 15], [cx + 25, ly, cz - 15]],
        LIGHT,
      );
    }
  }

  return { vertices, faces };
}
