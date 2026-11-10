// Hallucination shadow figure (library-game.js's drawShadowFigure) as a flat,
// camera-facing silhouette: the same head circle, the same body outline (its
// two quadratic curves sampled) and the same two red eyes, in the 2D drawer's
// own pixels divided by UNIT_SCALE, so at the usual UNIT_SCALE placement the
// figure stands as tall in First Person (75 px) as it does in Top-Down. Pure,
// DOM-free. The faces don't cull: a billboard has no back to hide, and the
// caller yaws it toward the camera (shadow-figures.js) so it is never edge-on.

const PX = 1 / 40; // 2D px -> mesh units (UNIT_SCALE; not imported, scene.js imports meshes)

export const SHADOW_FIGURE_COLORS = { body: '#140c18', eyes: '#ff5050' };
/** Total height, mesh units: the 2D head top is 62 + 13 px above the feet. */
export const SHADOW_FIGURE_HEIGHT = 75 * PX;

const HEAD = { cy: 62, r: 13, sides: 16 }; // a multiple of 4, so the crown is a vertex
const EYE = { dx: 4.5, cy: 63, r: 1.8, sides: 6 };
// The eyes sit a hair in front of the head so they always sort over it.
const EYE_Z = 0.4 * PX;
const CURVE_STEPS = 6;

function quadAt(p0, c, p1, t) {
  const u = 1 - t;
  return [u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]];
}

/** The 2D body path (y up): (-18,0) curve to (-9,52), line to (9,52), curve to (18,0), close. Convex. */
function bodyOutline() {
  const pts = [];
  for (let i = 0; i <= CURVE_STEPS; i++) pts.push(quadAt([-18, 0], [-20, 40], [-9, 52], i / CURVE_STEPS));
  for (let i = 0; i <= CURVE_STEPS; i++) pts.push(quadAt([9, 52], [20, 40], [18, 0], i / CURVE_STEPS));
  // Wound counter-clockwise seen from +Z, the side the caller turns to the camera.
  return pts.reverse();
}

function disc(cx, cy, r, sides) {
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

function addPolygon(mesh, pts2d, z, face) {
  const base = mesh.vertices.length;
  for (const [x, y] of pts2d) mesh.vertices.push([x * PX, y * PX, z]);
  mesh.faces.push({ indices: pts2d.map((_, i) => base + i), ...face });
}

let cached = null;

/** The one shared, read-only shadow-figure mesh (it depends on nothing). */
export function buildShadowFigure() {
  if (cached) return cached;
  const mesh = { vertices: [], faces: [] };
  // Unlit: a shadow has no shading, it is the same flat dark in every light (fog still applies).
  addPolygon(mesh, bodyOutline(), 0, { color: SHADOW_FIGURE_COLORS.body, unlit: true });
  addPolygon(mesh, disc(0, HEAD.cy, HEAD.r, HEAD.sides), 0, { color: SHADOW_FIGURE_COLORS.body, unlit: true });
  for (const dir of [-1, 1]) {
    addPolygon(mesh, disc(dir * EYE.dx, EYE.cy, EYE.r, EYE.sides), EYE_Z, { color: SHADOW_FIGURE_COLORS.eyes, unlit: true });
  }
  cached = mesh;
  return mesh;
}
