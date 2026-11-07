// First Person elevator, referenced to Top-Down's drawElevator (Hospital
// Shift's hospital/anime-furniture.js, which Library Shift draws with too;
// docs/skills/2d-to-3d/SKILL.md). The geometry is real-world size and gives
// the depth: a 1.4 x 2.2 frame (posts, lintel, sill) standing proud of a wall
// section, two door panels proud of the frame, an indicator plate and a call
// panel (its button proud again) on the wall, and a car behind the doorway.
// The surface is the 2D art itself: the game paints drawElevator into a
// canvas (paintElevatorArt) and each part's front shows exactly its own
// region of it, read from elevatorLayout, the layout drawElevator draws with.
// Without art (tests, no canvas) the same faces take drawElevator's colours.
//
// Model space: base at y=0, centered on x. The doors face -Z (the player
// walks up from game north, looking toward +Z); the car extends toward +Z.
// Seen from -Z, model -X is the viewer's right, so art x maps to -x.
// Pure and deterministic.
import { emptyMesh, merge, boxWithout, quad, textureBack } from './geom.js';
import { drawElevator, elevatorLayout, ELEVATOR_COLORS } from '../../../hospital/anime-furniture.js';
import { animeTile } from '../../../hospital/anime-ui.js';

const TILE_RADIUS = 12; // the corner radius both games' drawStation give animeTile

/** The doorway frame and car, in units (~1 = one metre). */
export const ELEVATOR_SIZE = { width: 1.4, height: 2.2, depth: 1.1 };
/**
 * The box drawElevator is drawn into for First Person: Library's 84 px
 * Top-Down width, and the height at which the drawer's frame (56 px wide,
 * height - 26 tall) has the mesh's own 1.4 : 2.2.
 */
export const ELEVATOR_ART = { w: 84, h: 114 };
/** Image px per art px. */
export const ELEVATOR_ART_SCALE = 3;
export const ELEVATOR_DOOR_COLOR = ELEVATOR_COLORS.door;

const L = elevatorLayout({ w: ELEVATOR_ART.w }, { height: ELEVATOR_ART.h });
const F = L.frame;
const S = ELEVATOR_SIZE.width / F.w; // units per art px
const X = (x) => -x * S;
const Y = (y) => (F.y1 - y) * S; // the frame's foot stands on the floor

/** Half the opening between the posts: an open door's inner edge sits here. */
export const ELEVATOR_HALF_DOORWAY = (F.w / 2 - (L.doors[0].x0 - F.x0)) * S;

const Z_WALL = -0.1; // the wall section's front
const Z_FRAME = Z_WALL - 0.03; // the frame stands proud of it
const Z_DOOR_BACK = Z_FRAME - 0.02; // the doors slide clear in front of the frame
const Z_DOOR = Z_DOOR_BACK - 0.03;
const Z_INDICATOR = Z_WALL - 0.02;
const Z_PANEL = Z_WALL - 0.03;
const Z_BUTTON = Z_PANEL - 0.005;
const Z_CAR = Z_WALL + ELEVATOR_SIZE.depth; // the car's back
const CAR_WALL = 0.05;
// [nu, nv] cells per textured face (see bookshelf.js).
const DIV_TALL = [1, 3];
const DIV_WIDE = [2, 1];
const DIV_ONE = [1, 1];

/**
 * Paints the First Person elevator art: an opaque backing in the tile colour
 * (the renderer needs the mapped region opaque, and the tile's rounded
 * corners are not), the station tile Top-Down draws the elevator on
 * (animeTile, filling the art box), then drawElevator at ELEVATOR_ART with
 * its call button at full glow (the art is painted once, so it does not
 * pulse). `ctx` is a canvas of ELEVATOR_ART.w x .h times ELEVATOR_ART_SCALE.
 */
export function paintElevatorArt(ctx, station) {
  const { w, h } = ELEVATOR_ART;
  ctx.save();
  ctx.fillStyle = ELEVATOR_COLORS.tile;
  ctx.fillRect(0, 0, w * ELEVATOR_ART_SCALE, h * ELEVATOR_ART_SCALE);
  ctx.scale(ELEVATOR_ART_SCALE, ELEVATOR_ART_SCALE);
  ctx.translate(w / 2, h / 2);
  animeTile(ctx, -w / 2, -h / 2, w, h, TILE_RADIUS, ELEVATOR_COLORS.tile);
  drawElevator(ctx, { id: station.id, floor: station.floor, targetFloor: station.targetFloor, w: ELEVATOR_ART.w }, { height: ELEVATOR_ART.h, pulse: 1 });
  ctx.restore();
}

/**
 * @param {{art?: CanvasImageSource, doorOpen?: number}} [opts] art: a canvas
 *   paintElevatorArt painted; doorOpen in [0,1]: 0 shut (the drawer's 1 px
 *   seam between the doors), 1 with each door's inner edge at
 *   ±ELEVATOR_HALF_DOORWAY. Each door keeps its own art as it slides.
 * @returns {{vertices: number[][], faces: object[]}}
 */
export function buildElevator({ art, doorOpen = 0 } = {}) {
  const open = Math.min(1, Math.max(0, doorOpen));
  const C = ELEVATOR_COLORS;
  const A = { x0: -ELEVATOR_ART.w / 2, y0: -ELEVATOR_ART.h / 2, x1: ELEVATOR_ART.w / 2 };
  const [D0, D1] = L.doors;
  const mesh = emptyMesh();

  // A part showing art region r on its -Z face, from z0 to z1 deep.
  const part = (r, z0, z1, color, drop, div, offset = 0) => {
    const p = textureBack(boxWithout([X(r.x1) + offset, Y(r.y1), z0], [X(r.x0) + offset, Y(r.y0), z1], color, drop), r,
      { image: art, artBox: ELEVATOR_ART, scale: ELEVATOR_ART_SCALE, color, div });
    merge(mesh, p);
  };

  // The wall section the Top-Down tile stands for: either side of the frame
  // (the call panel's side on the viewer's right) and a header over it (with
  // the indicator). It is the car's shell too, so it runs back to Z_CAR.
  part({ x0: A.x0, y0: F.y0, x1: F.x0, y1: F.y1 }, Z_WALL, Z_CAR, C.tile, ['top', 'bottom'], DIV_TALL);
  part({ x0: F.x1, y0: F.y0, x1: A.x1, y1: F.y1 }, Z_WALL, Z_CAR, C.tile, ['top', 'bottom'], DIV_TALL);
  part({ x0: A.x0, y0: A.y0, x1: A.x1, y1: F.y0 }, Z_WALL, Z_CAR, C.tile, ['bottom'], DIV_WIDE);
  // The car: its ceiling (facing down) and back wall, seen through the doorway.
  const yTop = Y(F.y0);
  merge(mesh, quad([[X(F.x1), yTop, Z_WALL], [X(F.x0), yTop, Z_WALL], [X(F.x0), yTop, Z_CAR - CAR_WALL], [X(F.x1), yTop, Z_CAR - CAR_WALL]], C.frame));
  merge(mesh, boxWithout([X(F.x1), 0, Z_CAR - CAR_WALL], [X(F.x0), yTop, Z_CAR], C.frame, ['left', 'right', 'top', 'bottom']));

  // The frame, proud of the wall; its back faces into the car and is never seen.
  part({ x0: F.x0, y0: D0.y0, x1: D0.x0, y1: D0.y1 }, Z_FRAME, Z_WALL, C.frame, ['front', 'top', 'bottom'], DIV_TALL);
  part({ x0: D1.x1, y0: D1.y0, x1: F.x1, y1: D1.y1 }, Z_FRAME, Z_WALL, C.frame, ['front', 'top', 'bottom'], DIV_TALL);
  part({ x0: F.x0, y0: F.y0, x1: F.x1, y1: D0.y0 }, Z_FRAME, Z_WALL, C.frame, ['front'], DIV_WIDE);
  part({ x0: F.x0, y0: D0.y1, x1: F.x1, y1: F.y1 }, Z_FRAME, Z_WALL, C.frame, ['front', 'bottom'], DIV_WIDE);

  // The doors, each wearing its own region as it slides apart (the art-left
  // door is model +X). Fully open, each inner edge reaches the post.
  const slide = open * (ELEVATOR_HALF_DOORWAY - X(D0.x1));
  part(D0, Z_DOOR, Z_DOOR_BACK, C.door, ['front', 'bottom'], DIV_TALL, slide);
  part(D1, Z_DOOR, Z_DOOR_BACK, C.door, ['front', 'bottom'], DIV_TALL, -slide);

  // The fittings on the wall: the indicator plate (with the floor label), the
  // call panel and its button.
  part(L.indicator, Z_INDICATOR, Z_WALL, C.indicator, ['front'], DIV_ONE);
  part(L.panel, Z_PANEL, Z_WALL, C.panel, ['front'], DIV_ONE);
  part(L.button, Z_BUTTON, Z_PANEL, C.button, ['front'], DIV_ONE);

  // Every face is wound to face out (elevator.test.js renders it from both
  // sides), so all of them cull.
  for (const f of mesh.faces) f.cull = true;
  return mesh;
}
