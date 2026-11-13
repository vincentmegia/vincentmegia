// Test support (not a test file): checks that the painter's sort draws what
// stands on a counter top after the top's faces beneath it, from cameras all
// the way round. Used by front-desk.test.js and fines-counter.test.js.
import { buildDrawList, cameraFromPose } from '../core.js';
import { UNIT_SCALE, BASE_EYE } from '../scene.js';

const EPS = 1e-6;
const EYE = BASE_EYE / UNIT_SCALE; // the player's eye height, in model units

/** The mesh's parts: faces grouped by the vertices they share (each merged part is its own group). */
function components(mesh) {
  const parent = mesh.vertices.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (const f of mesh.faces) for (const i of f.indices) parent[find(i)] = find(f.indices[0]);
  const groups = new Map();
  mesh.faces.forEach((f, i) => {
    const k = find(f.indices[0]);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(i);
  });
  return [...groups.values()];
}

const rectOf = (mesh, faces) => {
  const vs = faces.flatMap((i) => mesh.faces[i].indices.map((j) => mesh.vertices[j]));
  return {
    x0: Math.min(...vs.map((v) => v[0])), x1: Math.max(...vs.map((v) => v[0])),
    y0: Math.min(...vs.map((v) => v[1])),
    z0: Math.min(...vs.map((v) => v[2])), z1: Math.max(...vs.map((v) => v[2])),
  };
};
const overlaps = (a, b) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > EPS && Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > EPS;

/**
 * The top's faces (up-facing quads at y = `topY`) and the objects standing
 * on or over it (every part whose lowest point is at or above `topY`), each
 * with its x/z footprint. A part wholly above the eye (the Fines Counter's
 * plaque) is left out: the plane at eye height projects to one screen line,
 * with everything above it on one side and the top on the other, so the top
 * can never cover it.
 */
export function topAndStanding(mesh, topY) {
  const top = [];
  const standing = [];
  for (const part of components(mesh)) {
    const cells = part.filter((i) => {
      const f = mesh.faces[i];
      if (f.indices.length !== 4 || !f.indices.every((j) => Math.abs(mesh.vertices[j][1] - topY) < EPS)) return false;
      const [a, b, c] = f.indices.slice(0, 3).map((j) => mesh.vertices[j]);
      const ny = (c[0] - a[0]) * (b[2] - a[2]) - (c[2] - a[2]) * (b[0] - a[0]);
      return ny > 0;
    });
    const r = rectOf(mesh, part);
    // A part of top cells alone (cutTop's own vertices) is the top, not something on it.
    if (r.y0 >= EYE) continue;
    if (r.y0 >= topY - EPS && cells.length < part.length) standing.push({ faces: part, rect: r });
    else for (const i of cells) top.push({ face: i, rect: rectOf(mesh, [i]) });
  }
  return { top, standing };
}

/**
 * For every 15 degrees round the mesh (radius 2.5 units, at the player's eye,
 * looking at the centre at `lookY` units), the pairs that draw in the wrong
 * order: a top face beneath an object's footprint drawn after one of the
 * object's faces. Returns [] when the sort is right from every angle.
 */
export function standingOrderFailures(mesh, topY, lookY = topY) {
  const { top, standing } = topAndStanding(mesh, topY);
  // Tag every face with its own colour; textured polygons keep the raw tag,
  // flat ones are shaded at intensity 1 (unlit) so the tag survives.
  const tagged = {
    vertices: mesh.vertices,
    faces: mesh.faces.map((f, i) => ({ ...f, unlit: true, color: '#' + (i + 1).toString(16).padStart(6, '0') })),
  };
  const faceOf = (p) => {
    if (p.image) return parseInt(p.color.slice(1), 16) - 1;
    const [r, g, b] = p.color.match(/\d+/g).map(Number);
    return ((r << 16) | (g << 8) | b) - 1;
  };
  const R = 2.5 * UNIT_SCALE;
  const eye = BASE_EYE;
  const failures = [];
  for (let deg = 0; deg < 360; deg += 15) {
    const a = (deg * Math.PI) / 180;
    const cam = cameraFromPose({ x: Math.sin(a) * R, y: Math.cos(a) * R, facing: -a }, {
      eyeHeight: eye, pitch: -Math.atan2(eye - lookY * UNIT_SCALE, R), fov: Math.PI / 3, aspect: 1, near: 1, far: 2000,
    });
    const list = buildDrawList(cam, [{ mesh: tagged, placement: { pos: [0, 0, 0], yaw: 0, scale: UNIT_SCALE } }], {
      viewport: { width: 400, height: 400 }, light: { dir: [0.35, 1, 0.25], ambient: 0.5 },
    });
    const first = new Map();
    const last = new Map();
    list.forEach((p, k) => {
      const i = faceOf(p);
      if (!first.has(i)) first.set(i, k);
      last.set(i, k);
    });
    for (const obj of standing) {
      const drawn = obj.faces.filter((i) => first.has(i));
      if (!drawn.length) continue;
      const objFirst = Math.min(...drawn.map((i) => first.get(i)));
      for (const cell of top) {
        if (!last.has(cell.face) || !overlaps(cell.rect, obj.rect)) continue;
        if (last.get(cell.face) > objFirst) {
          const bad = drawn.find((i) => first.get(i) === objFirst);
          failures.push(`${deg}deg: top face ${cell.face} (x ${cell.rect.x0.toFixed(3)}..${cell.rect.x1.toFixed(3)} z ${cell.rect.z0.toFixed(3)}..${cell.rect.z1.toFixed(3)}) after face ${bad} (${mesh.faces[bad].color}) of the part at x ${obj.rect.x0.toFixed(3)}..${obj.rect.x1.toFixed(3)}`);
        }
      }
    }
  }
  return failures;
}
