// Test support (not a test file): checks that the painter draws a counter's
// top before everything standing on it, from every yaw, pitch and range the
// player can see it from, and that the top still sorts by depth against
// other meshes. Used by front-desk.test.js and fines-counter.test.js.
import { buildDrawList, cameraFromPose } from '../core.js';
import { UNIT_SCALE, BASE_EYE } from '../scene.js';

const EPS = 1e-6;
const ENV = { viewport: { width: 400, height: 400 }, light: { dir: [0.35, 1, 0.25], ambient: 0.5 } };

/** The yaws (every 15 degrees), pitches (the player's ±0.35 range, and looking at the top) and radii (interact range out) swept. */
export const SWEEP = {
  yaws: Array.from({ length: 24 }, (_, i) => i * 15),
  pitches: [-0.35, -0.2, 0, 0.2, 0.35, 'look'],
  radii: [1.5, 2.0, 2.5, 3.5],
};

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

/**
 * The top's faces (up-facing faces at y = `topY`) and the faces of every part
 * standing on or over it (its lowest point at or above `topY`).
 */
export function topAndStanding(mesh, topY) {
  const top = [];
  const standing = [];
  for (const part of components(mesh)) {
    const y0 = Math.min(...part.flatMap((i) => mesh.faces[i].indices.map((j) => mesh.vertices[j][1])));
    if (y0 >= topY - EPS) { standing.push(part); continue; }
    for (const i of part) {
      const f = mesh.faces[i];
      if (!f.indices.every((j) => Math.abs(mesh.vertices[j][1] - topY) < EPS)) continue;
      const [a, b, c] = f.indices.slice(0, 3).map((j) => mesh.vertices[j]);
      if ((c[0] - a[0]) * (b[2] - a[2]) - (c[2] - a[2]) * (b[0] - a[0]) > 0) top.push(i);
    }
  }
  return { top, standing };
}

/** Whether two convex screen polygons overlap with positive area (separating axis test; touching edges do not count). */
export function screenOverlap(a, b) {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const [x0, y0] = poly[i];
      const [x1, y1] = poly[(i + 1) % poly.length];
      const n = [y1 - y0, x0 - x1];
      const len = Math.hypot(n[0], n[1]);
      if (len < 1e-9) continue;
      const proj = (p) => (p[0] * n[0] + p[1] * n[1]) / len;
      const pa = a.map(proj);
      const pb = b.map(proj);
      if (Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb)) < 1e-3) return false;
    }
  }
  return true;
}

// Tag every face with its own colour: textured polygons keep the raw tag,
// flat ones are shaded at intensity 1 (unlit) so the tag survives.
const tag = (mesh, base = 0) => ({
  vertices: mesh.vertices,
  faces: mesh.faces.map((f, i) => ({ ...f, unlit: true, color: '#' + (base + i + 1).toString(16).padStart(6, '0') })),
});
const tagOf = (p) => {
  if (p.image) return parseInt(p.color.slice(1), 16) - 1;
  const [r, g, b] = p.color.match(/\d+/g).map(Number);
  return ((r << 16) | (g << 8) | b) - 1;
};

function camera(deg, pitch, radius, lookY) {
  const a = (deg * Math.PI) / 180;
  const R = radius * UNIT_SCALE;
  const p = pitch === 'look' ? -Math.atan2(BASE_EYE - lookY * UNIT_SCALE, R) : pitch;
  return cameraFromPose({ x: Math.sin(a) * R, y: Math.cos(a) * R, facing: -a }, {
    eyeHeight: BASE_EYE, pitch: p, fov: Math.PI / 3, aspect: 1, near: 1, far: 2000,
  });
}

/**
 * Over SWEEP (eye at the player's BASE_EYE), every pair where one of the top's
 * faces is drawn after a face of something standing on it while their screen
 * polygons overlap: the top painting over what stands on it. Returns the
 * count per `pitch@radius` and the first few pairs described.
 */
export function standingOrderPairs(mesh, topY) {
  const { top, standing } = topAndStanding(mesh, topY);
  const onTop = new Set(standing.flat());
  const topSet = new Set(top);
  const placed = [{ mesh: tag(mesh), placement: { pos: [0, 0, 0], yaw: 0, scale: UNIT_SCALE } }];
  const counts = {};
  const pairs = [];
  for (const radius of SWEEP.radii) {
    for (const pitch of SWEEP.pitches) {
      const key = `${pitch}@${radius}`;
      counts[key] = 0;
      for (const deg of SWEEP.yaws) {
        const list = buildDrawList(camera(deg, pitch, radius, topY), placed, ENV);
        const tops = [];
        list.forEach((p, k) => { if (topSet.has(tagOf(p))) tops.push({ k, p, f: tagOf(p) }); });
        // A top polygon drawn after an overlapping polygon of what stands on it.
        list.forEach((p, k) => {
          const f = tagOf(p);
          if (!onTop.has(f)) return;
          for (const t of tops) {
            if (t.k > k && screenOverlap(t.p.screen, p.screen)) {
              counts[key]++;
              if (pairs.length < 10) pairs.push(`yaw ${deg} pitch ${pitch} R ${radius}: top face ${t.f} after face ${f} (${mesh.faces[f].color})`);
            }
          }
        });
      }
    }
  }
  return { counts, pairs, total: Object.values(counts).reduce((s, n) => s + n, 0) };
}

/**
 * The top against other meshes: a character placed `gap` units behind the
 * counter's back edge and another `gap` in front of its front, seen from the
 * front and from behind (radius 3.5, level and looking at the top). The far
 * character's polygons that overlap a top polygon on screen must be drawn
 * before it, the near character's after it. Returns the violations.
 */
export function crossMeshFailures(mesh, topY, depth, character, gap = 1) {
  const { top } = topAndStanding(mesh, topY);
  const topSet = new Set(top);
  const n = mesh.faces.length;
  const zBack = (-depth / 2 - gap) * UNIT_SCALE;
  const zFront = (depth / 2 + gap) * UNIT_SCALE;
  const placed = [
    { mesh: tag(mesh), placement: { pos: [0, 0, 0], yaw: 0, scale: UNIT_SCALE } },
    { mesh: tag(character, n), placement: { pos: [0, 0, zBack], yaw: 0, scale: UNIT_SCALE } },
    { mesh: tag(character, n + character.faces.length), placement: { pos: [0, 0, zFront], yaw: 0, scale: UNIT_SCALE } },
  ];
  const which = (f) => (f < n ? 'mesh' : f < n + character.faces.length ? 'back' : 'front');
  const failures = [];
  let checked = 0;
  for (const deg of [0, 180]) {
    for (const pitch of [0, 'look']) {
      const list = buildDrawList(camera(deg, pitch, 3.5, topY), placed, ENV);
      const far = deg === 0 ? 'back' : 'front';
      list.forEach((p, k) => {
        const f = tagOf(p);
        if (!topSet.has(f)) return;
        list.forEach((q, j) => {
          const w = which(tagOf(q));
          if (w === 'mesh' || !screenOverlap(p.screen, q.screen)) return;
          checked++;
          const ok = w === far ? j < k : j > k;
          if (!ok) failures.push(`yaw ${deg} pitch ${pitch}: top face ${f} vs the ${w} character's polygon (${w === far ? 'far' : 'near'})`);
        });
      });
    }
  }
  return { failures, checked };
}
