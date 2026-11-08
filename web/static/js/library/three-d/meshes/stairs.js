// First Person stairs, referenced to Top-Down's drawStairs
// (hospital/anime-furniture.js; docs/skills/2d-to-3d/SKILL.md). drawStairs
// is a plan view, so it can't be a front texture: the flight is built as
// geometry from the drawer's own exports instead. Each step takes the 2D
// colour ramp (stairStepColor) on its tread, and its riser is that colour
// under the 2D's shadow line (STAIRS_COLORS.shadow); a thin plum nosing gives
// every step the 2D's line art; the handrail is the 2D's two-tone rail (an
// ink core, the wood colour over its middle 3/5, as the 2D strokes 3 px of
// wood over 5 px of ink); and the arrow badge is drawStairsBadge itself,
// painted into a canvas (paintStairsBadgeArt) and worn by a small unlit sign
// at the foot. Without art (tests, no canvas) the sign is a flat white plate.
//
// Model space: base at y=0, centered on x/z; the foot faces +Z (toward a
// player walking up to it) and the flight climbs toward -Z, the way
// transitions.js moves the camera on a climb. The handrail is on the left
// (-X) and the badge on the right (+X) seen from the foot, as in the 2D.
// Every face is wound outward and culls (stairs.test.js renders it from
// both sides). Pure and deterministic.
import { box, emptyMesh, merge, textureFront } from './geom.js';
import {
  stairStepColor,
  stairsArrowDir,
  drawStairsBadge,
  STAIRS_COLORS,
  STAIRS_RAIL,
} from '../../../hospital/anime-furniture.js';

export const STAIR_RISE_PER_STEP = 0.18;
export const STAIR_RUN_PER_STEP = 0.28;
const DEFAULT_STEPS = 8;
const HALF_WIDTH = 0.5; // half the flight between the stringers
const RAIL_THICK = 0.06; // stringer, handrail and newel thickness

/** Real-world size (units, ~1 = one metre) of the default 8-step flight. */
export const STAIRS_SIZE = {
  width: 2 * (HALF_WIDTH + RAIL_THICK),
  depth: DEFAULT_STEPS * STAIR_RUN_PER_STEP,
  height: DEFAULT_STEPS * STAIR_RISE_PER_STEP,
};

/** The box drawStairsBadge is painted into (art px): the 2D's 19.3 px disc with a margin. */
export const STAIRS_BADGE_ART = { w: 24, h: 24 };
/** Image px per art px for the badge (a 192 x 192 canvas). */
export const BADGE_ART_SCALE = 8;

// The nosing is the 2D's 1.1 px plum step outline: about 2% of the flight's
// width, as 1.1 px is of the 2D steps' ~60 px.
const NOSE_DROP = 0.016; // the nosing's plum strip runs this far down the riser...
const NOSE_PROUD = 0.006; // ...stands this far proud of the riser and the tread...
const NOSE_DEPTH = 0.04; // ...and this far back over the tread
const STRINGER_OVER = 0.08; // the stringers' top runs this far above the nosings
const RAIL_HEIGHT = 0.72; // the handrail's underside above the stringer's slope
const NEWEL_CAP = 0.03; // newels stand this far above the rail
const POST_PROUD = 0.01;
const BADGE_SIZE = 0.3;
const BADGE_Y = 1.12; // the sign's centre: below eye height (BASE_EYE 60 / UNIT_SCALE 40 = 1.5)
const BADGE_THICK = 0.03;

const parseRgb = (c) => c.match(/[\d.]+/g).map(Number);
/** `base` ('rgb(...)' or '#rrggbb') with the 2D's translucent shadow composited over it. */
function underShadow(base) {
  const b = base[0] === '#' ? [1, 3, 5].map((i) => parseInt(base.slice(i, i + 2), 16)) : parseRgb(base);
  const [sr, sg, sb, sa] = parseRgb(STAIRS_COLORS.shadow);
  return `rgb(${[sr, sg, sb].map((s, k) => Math.round(b[k] * (1 - sa) + s * sa)).join(',')})`;
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Paints the First Person badge: an opaque backing in the stairs' step
 * colour (the renderer needs the mapped region opaque, and the badge is a
 * disc), then drawStairsBadge centred, pointing the station's way. `ctx` is a
 * canvas of STAIRS_BADGE_ART times BADGE_ART_SCALE.
 */
export function paintStairsBadgeArt(ctx, station) {
  const { w, h } = STAIRS_BADGE_ART;
  ctx.save();
  ctx.fillStyle = STAIRS_COLORS.step;
  ctx.fillRect(0, 0, w * BADGE_ART_SCALE, h * BADGE_ART_SCALE);
  ctx.scale(BADGE_ART_SCALE, BADGE_ART_SCALE);
  ctx.translate(w / 2, h / 2);
  drawStairsBadge(ctx, 0, 0, stairsArrowDir(station));
  ctx.restore();
}

/**
 * @param {{steps?: number, art?: CanvasImageSource}} [opts] art: a canvas paintStairsBadgeArt painted
 * @returns {{vertices: number[][], faces: object[]}}
 */
export function buildStairs(opts = {}) {
  const steps = Math.max(1, Math.floor(opts.steps ?? DEFAULT_STEPS));
  const R = STAIR_RISE_PER_STEP;
  const U = STAIR_RUN_PER_STEP;
  const H = steps * R;
  const zFoot = (steps * U) / 2;
  const zTop = -zFoot;
  const W = HALF_WIDTH;
  const T = RAIL_THICK;
  const mesh = emptyMesh();
  let solid = 0;

  // An axis-aligned box: `colors` by face name (front back right left top
  // bottom); faces not named are dropped (hidden). One convex solid.
  const boxPart = (min, max, colors, part) => {
    const b = box(min, max, '#000000', colors);
    const names = ['front', 'back', 'right', 'left', 'top', 'bottom'];
    const kept = b.faces.filter((_, i) => names[i] in colors);
    for (const f of kept) Object.assign(f, { part, solid });
    solid++;
    return merge(mesh, { vertices: b.vertices, faces: kept });
  };
  // Convex polygons [points, color, outward hint, part?] making up one convex
  // solid, each wound so its normal agrees with its outward hint.
  const polys = (list, part) => {
    for (const [points, color, out, own] of list) {
      const n = cross(sub(points[1], points[0]), sub(points[2], points[0]));
      const p = dot(n, out) < 0 ? [...points].reverse() : points;
      merge(mesh, { vertices: p.map((v) => [...v]), faces: [{ indices: p.map((_, i) => i), color, part: own ?? part, solid }] });
    }
    solid++;
  };

  // The stringers' top: through the nosings plus STRINGER_OVER, flat over the top step.
  const yTop = (z) => Math.min(H + STRINGER_OVER, R + STRINGER_OVER + (R * (zFoot - z)) / U);
  const stringer = underShadow(STAIRS_COLORS.step); // the step base under the 2D's shadow

  // Steps: a column per step, its riser recessed NOSE_PROUD behind its nosing.
  // Only the tread and the visible riser band show (the sides sit against the
  // stringers, the rest is inside the flight); the top step's back closes it.
  for (let i = 0; i < steps; i++) {
    const zR = zFoot - NOSE_PROUD - i * U;
    const zB = Math.max(zTop, zR - U);
    const y1 = (i + 1) * R;
    const color = stairStepColor(i, steps);
    const list = [
      [[[-W, y1, zB], [W, y1, zB], [W, y1, zR], [-W, y1, zR]], color, [0, 1, 0], 'tread'],
      [[[-W, i * R, zR], [W, i * R, zR], [W, y1, zR], [-W, y1, zR]], underShadow(color), [0, 0, 1], 'riser'],
    ];
    if (i === steps - 1) list.push([[[-W, 0, zTop], [W, 0, zTop], [W, H, zTop], [-W, H, zTop]], stringer, [0, 0, -1], 'back']);
    polys(list);
    // The plum nosing along the tread's front edge.
    boxPart(
      [-W, y1 - NOSE_DROP, zR + NOSE_PROUD - NOSE_DEPTH],
      [W, y1 + NOSE_PROUD, zR + NOSE_PROUD],
      { front: STAIRS_COLORS.edge, top: STAIRS_COLORS.edge },
      'nosing',
    );
  }

  // Stringers: sloped side walls, pastel, with a plum top and ends (the 2D's
  // outline). Inside the flight only the band above each tread shows.
  for (const s of [-1, 1]) {
    const xi = s * W;
    const xo = s * (W + T);
    const zKnee = zTop + U; // where the slope meets the flat over the top step
    const list = [
      [[[xo, 0, zFoot], [xo, 0, zTop], [xo, H + STRINGER_OVER, zTop], [xo, H + STRINGER_OVER, zKnee], [xo, yTop(zFoot), zFoot]], stringer, [s, 0, 0]],
      [[[xi, yTop(zFoot), zFoot], [xo, yTop(zFoot), zFoot], [xo, yTop(zKnee), zKnee], [xi, yTop(zKnee), zKnee]], STAIRS_COLORS.edge, [0, 1, 1]],
      [[[xi, H + STRINGER_OVER, zKnee], [xo, H + STRINGER_OVER, zKnee], [xo, H + STRINGER_OVER, zTop], [xi, H + STRINGER_OVER, zTop]], STAIRS_COLORS.edge, [0, 1, 0]],
      [[[xi, 0, zFoot], [xo, 0, zFoot], [xo, yTop(zFoot), zFoot], [xi, yTop(zFoot), zFoot]], STAIRS_COLORS.edge, [0, 0, 1]],
      [[[xi, 0, zTop], [xo, 0, zTop], [xo, H + STRINGER_OVER, zTop], [xi, H + STRINGER_OVER, zTop]], STAIRS_COLORS.edge, [0, 0, -1]],
    ];
    for (let i = 0; i < steps; i++) {
      const za = Math.max(zTop, zFoot - NOSE_PROUD - (i + 1) * U);
      const zb = zFoot - i * U;
      const y = (i + 1) * R;
      list.push([[[xi, y, za], [xi, y, zb], [xi, yTop(zb), zb], [xi, yTop(za), za]], stringer, [-s, 0, 0]]);
    }
    polys(list, 'stringer');
  }

  // The handrail on the left: a beam parallel to the stringer's slope between
  // two newels, its top ink | wood | ink in the 2D's 5 px : 3 px widths.
  const xa = -W - T;
  const xb = -W;
  const z0 = zFoot - T / 2;
  const z1 = zTop + U / 2;
  const yb = (z) => R + STRINGER_OVER + RAIL_HEIGHT + (R * (zFoot - z)) / U;
  const RH = RAIL_THICK;
  const inkW = (T * (STAIRS_RAIL.ink - STAIRS_RAIL.wood)) / 2 / STAIRS_RAIL.ink;
  const strip = (x0, x1, color) => [[[x0, yb(z0) + RH, z0], [x1, yb(z0) + RH, z0], [x1, yb(z1) + RH, z1], [x0, yb(z1) + RH, z1]], color, [0, 1, 0]];
  polys([
    strip(xa, xa + inkW, STAIRS_COLORS.railInk),
    strip(xa + inkW, xb - inkW, STAIRS_COLORS.rail),
    strip(xb - inkW, xb, STAIRS_COLORS.railInk),
    [[[xa, yb(z0), z0], [xa, yb(z1), z1], [xa, yb(z1) + RH, z1], [xa, yb(z0) + RH, z0]], STAIRS_COLORS.railInk, [-1, 0, 0]],
    [[[xb, yb(z0), z0], [xb, yb(z1), z1], [xb, yb(z1) + RH, z1], [xb, yb(z0) + RH, z0]], STAIRS_COLORS.railInk, [1, 0, 0]],
    [[[xa, yb(z0), z0], [xb, yb(z0), z0], [xb, yb(z1), z1], [xa, yb(z1), z1]], STAIRS_COLORS.railInk, [0, -1, 0]],
  ], 'rail');
  // Newels and the badge post stand POST_PROUD wider than the stringer they
  // sit on, so none of their sides is coplanar with a stringer or rail face.
  const newel = (zc, yFloor) => boxPart(
    [xa - POST_PROUD, yFloor, zc - T / 2],
    [xb + POST_PROUD, yb(zc) + RH + NEWEL_CAP, zc + T / 2],
    { front: STAIRS_COLORS.railInk, back: STAIRS_COLORS.railInk, right: STAIRS_COLORS.railInk, left: STAIRS_COLORS.railInk, top: STAIRS_COLORS.rail },
    'newel',
  );
  newel(z0, yTop(zFoot));
  newel(z1, H + STRINGER_OVER);

  // The arrow badge: a sign at the foot on the right stringer, facing +Z.
  const bx = W + T / 2;
  const half = BADGE_SIZE / 2;
  const signStart = mesh.faces.length;
  boxPart(
    [bx - half, BADGE_Y - half, zFoot - BADGE_THICK],
    [bx + half, BADGE_Y + half, zFoot],
    { front: STAIRS_COLORS.badge, back: STAIRS_COLORS.edge, right: STAIRS_COLORS.edge, left: STAIRS_COLORS.edge, top: STAIRS_COLORS.edge, bottom: STAIRS_COLORS.edge },
    'badge',
  );
  const sign = { faces: [mesh.faces[signStart]] }; // box's front stays first
  const a = STAIRS_BADGE_ART;
  textureFront(sign, { x0: -a.w / 2, y0: -a.h / 2, x1: a.w / 2, y1: a.h / 2 }, { image: opts.art, artBox: a, scale: BADGE_ART_SCALE, color: STAIRS_COLORS.badge });
  boxPart(
    [W - POST_PROUD, yTop(zFoot), zFoot - BADGE_THICK - T],
    [W + T + POST_PROUD, BADGE_Y, zFoot - BADGE_THICK],
    { front: STAIRS_COLORS.railInk, back: STAIRS_COLORS.railInk, right: STAIRS_COLORS.railInk, left: STAIRS_COLORS.railInk },
    'badge-post',
  );

  for (const f of mesh.faces) f.cull = true;
  return mesh;
}
