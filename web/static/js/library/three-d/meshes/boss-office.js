// First Person Boss's Office, referenced to Top-Down's drawBossDoor
// (library/anime-furniture.js; docs/skills/2d-to-3d/SKILL.md). The geometry
// is real-world size and gives the depth: the office is a small room built
// against the back wall, its front a wall section (the Top-Down tile) with
// the door frame standing proud of it, the door recessed in the frame, and
// the knob, the gold BOSS plaque and (while locked) the padlock badge proud
// again. Its sides and roof run back toward the room's north wall.
// The surface is the 2D art itself: the game paints drawBossDoor into a
// canvas (paintBossOfficeArt) and each part's front shows exactly its own
// region of it, read from bossDoorLayout, the layout drawBossDoor draws with.
// Without art (tests, no canvas) the same faces take drawBossDoor's colours.
//
// Model space: base at y=0, centered on x. The door faces +Z (the office is
// on the 1st Floor's top row; the player walks up from game south, looking
// toward -Z); the room behind it extends toward -Z. Pure and deterministic.
import { emptyMesh, merge, boxWithout, textureFront } from './geom.js';
import { bossDoorLayout, drawBossDoor, drawBossLock, BOSS_DOOR_COLORS } from '../../anime-furniture.js';
import { animeTile } from '../../../hospital/anime-ui.js';

const TILE_RADIUS = 12; // the corner radius drawStation gives animeTile

/**
 * The box drawBossDoor is drawn into for First Person: Top-Down's 84 px tile
 * width, and the height at which the door (54 px wide, height - 18 tall) has
 * a real door's ~1 : 2.
 */
export const BOSS_OFFICE_ART = { w: 84, h: 124 };
/** Image px per art px. */
export const BOSS_OFFICE_ART_SCALE = 3;

const L = bossDoorLayout({ w: BOSS_OFFICE_ART.w }, BOSS_OFFICE_ART.h);
const F = L.frame;
/** The door frame and the office, in units (~1 = one metre). */
export const BOSS_OFFICE_SIZE = {
  frameWidth: 1.2,
  width: (BOSS_OFFICE_ART.w / (F.x1 - F.x0)) * 1.2,
  height: ((F.y1 + BOSS_OFFICE_ART.h / 2) / (F.x1 - F.x0)) * 1.2,
  depth: 2.5, // back to within ~0.4 m of the north wall (the office stands at game y 115)
};
const S = BOSS_OFFICE_SIZE.frameWidth / (F.x1 - F.x0); // units per art px
const X = (x) => x * S;
const Y = (y) => (F.y1 - y) * S; // the frame's foot stands on the floor

const Z_WALL = 0; // the wall section's front
const Z_SHELL = Z_WALL - 0.05; // the shell behind it
const Z_FRAME = Z_WALL + 0.04; // the frame stands proud of the wall
const Z_DOOR = Z_WALL - 0.02; // the door sits back in the frame
const Z_KNOB = Z_DOOR + 0.06;
const Z_LOCK = Z_DOOR + 0.03;
const Z_PLAQUE = Z_FRAME + 0.03; // over the lintel and the wall above it
const Z_BACK = Z_WALL - BOSS_OFFICE_SIZE.depth;
// [nu, nv] cells per textured face (see bookshelf.js).
const DIV_TALL = [1, 3];
const DIV_WIDE = [2, 1];
const DIV_ONE = [1, 1];

/** The tile colour the office's walls take: grey while locked, as Top-Down's tile. */
export function bossOfficeTileColor(locked) {
  return locked ? BOSS_DOOR_COLORS.tileLocked : BOSS_DOOR_COLORS.tile;
}

/**
 * Paints the First Person Boss's Office art: an opaque backing in the tile
 * colour (the renderer needs the mapped region opaque, and the tile's rounded
 * corners are not), the station tile Top-Down draws the door on (animeTile,
 * grey while locked), drawBossDoor at BOSS_OFFICE_ART and, while locked, the
 * padlock badge drawStation puts over it. `ctx` is a canvas of
 * BOSS_OFFICE_ART.w x .h times BOSS_OFFICE_ART_SCALE.
 */
export function paintBossOfficeArt(ctx, station, { locked } = {}) {
  const { w, h } = BOSS_OFFICE_ART;
  const tile = bossOfficeTileColor(locked);
  ctx.save();
  ctx.fillStyle = tile;
  ctx.fillRect(0, 0, w * BOSS_OFFICE_ART_SCALE, h * BOSS_OFFICE_ART_SCALE);
  ctx.scale(BOSS_OFFICE_ART_SCALE, BOSS_OFFICE_ART_SCALE);
  ctx.translate(w / 2, h / 2);
  animeTile(ctx, -w / 2, -h / 2, w, h, TILE_RADIUS, tile);
  drawBossDoor(ctx, { id: station.id, w, h });
  if (locked) drawBossLock(ctx);
  ctx.restore();
}

/**
 * @param {{art?: CanvasImageSource, locked?: boolean}} [opts] art: a canvas
 *   paintBossOfficeArt painted (in the same locked state); locked adds the
 *   padlock badge, proud of the door, and greys the walls' flat colour.
 * @returns {{vertices: number[][], faces: object[]}}
 */
export function buildBossOffice({ art, locked = false } = {}) {
  const C = BOSS_DOOR_COLORS;
  const tile = bossOfficeTileColor(locked);
  const A = { x0: -BOSS_OFFICE_ART.w / 2, y0: -BOSS_OFFICE_ART.h / 2, x1: BOSS_OFFICE_ART.w / 2 };
  const mesh = emptyMesh();

  // A part showing art region r on its +Z front, from z0 to z1 deep.
  const part = (r, z0, z1, color, drop, div) => {
    merge(mesh, textureFront(boxWithout([X(r.x0), Y(r.y1), z0], [X(r.x1), Y(r.y0), z1], color, drop), r,
      { image: art, artBox: BOSS_OFFICE_ART, scale: BOSS_OFFICE_ART_SCALE, color, div }));
  };

  // The office behind the front: its sides, roof and back wall (lit, so it
  // reads as solid). Its front is the wall section below, so it has none.
  merge(mesh, boxWithout([X(A.x0), 0, Z_BACK], [X(A.x1), Y(A.y0), Z_SHELL], tile, ['front', 'bottom']));

  // The wall section the Top-Down tile stands for: either side of the frame
  // and a header over it. Their backs are against the shell.
  part({ x0: A.x0, y0: A.y0, x1: F.x0, y1: F.y1 }, Z_SHELL, Z_WALL, tile, ['back', 'right', 'bottom'], DIV_TALL);
  part({ x0: F.x1, y0: A.y0, x1: A.x1, y1: F.y1 }, Z_SHELL, Z_WALL, tile, ['back', 'left', 'bottom'], DIV_TALL);
  part({ x0: F.x0, y0: A.y0, x1: F.x1, y1: F.y0 }, Z_SHELL, Z_WALL, tile, ['back', 'left', 'right', 'bottom'], DIV_WIDE);

  // The frame, proud of the wall: two posts and a lintel. Their inner faces
  // are the reveal down to the recessed door.
  const D = L.door;
  part({ x0: F.x0, y0: D.y0, x1: D.x0, y1: F.y1 }, Z_SHELL, Z_FRAME, C.frame, ['back', 'bottom'], DIV_TALL);
  part({ x0: D.x1, y0: D.y0, x1: F.x1, y1: F.y1 }, Z_SHELL, Z_FRAME, C.frame, ['back', 'bottom'], DIV_TALL);
  part({ x0: F.x0, y0: F.y0, x1: F.x1, y1: D.y0 }, Z_SHELL, Z_FRAME, C.frame, ['back', 'left', 'right'], DIV_WIDE);

  // The door, back in the frame (only its front shows), and its knob.
  part(D, Z_SHELL, Z_DOOR, C.door, ['back', 'left', 'right', 'top', 'bottom'], DIV_TALL);
  part(L.knobBox, Z_DOOR, Z_KNOB, C.knob, ['back'], DIV_ONE);
  if (locked) part(L.lock, Z_DOOR, Z_LOCK, C.lock, ['back'], DIV_ONE);

  // The BOSS plaque, over the lintel and the wall above it.
  part(L.plaque, Z_FRAME, Z_PLAQUE, C.plaque, ['back'], DIV_WIDE);

  // Every face is wound to face out (boss-office.test.js renders it from
  // both sides), so all of them cull.
  for (const f of mesh.faces) f.cull = true;
  return mesh;
}
