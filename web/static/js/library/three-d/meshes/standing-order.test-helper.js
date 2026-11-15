// Test support (not a test file) for counters whose top is a supporting
// surface (`under`, core.js settleUnderFaces): the painter must draw the top
// before everything standing on it, from every yaw, pitch and range the
// player can see it from, while the top itself, the counter's lower faces and
// every other mesh keep their plain mean-depth order. "Truly in front" is
// measured exactly: along each pixel's ray, the nearest face plane among the
// polygons covering it. Used by front-desk.test.js and fines-counter.test.js.
import { buildDrawList, cameraFromPose, screenOverlap } from '../core.js';
import { UNIT_SCALE, BASE_EYE } from '../scene.js';

const EPS = 1e-6;
const VIEW = 400;
const ENV = { viewport: { width: VIEW, height: VIEW }, light: { dir: [0.35, 1, 0.25], ambient: 0.5 } };

/** The full camera sweep: yaw every 15 degrees, the player's pitch range (±0.35) plus looking at the top, interact range out. */
export const SWEEP = {
  yaws: Array.from({ length: 24 }, (_, i) => i * 15),
  pitches: [-0.35, -0.2, 0, 0.2, 0.35, 'look'],
  radii: [1.5, 2.0, 2.5, 3.5],
};
/** A subsample of SWEEP for the pixel audits, which cost far more per camera. */
export const PIXEL_SWEEP = { yaws: [0, 45, 90, 135, 180, 225, 270, 315], pitches: [-0.35, 0, 0.35], radii: [1.5, 2.5] };

/** A character's six test positions round a counter of `size` {width, depth}, in units from its centre. */
export function positions(size) {
  const hw = size.width / 2;
  const hd = size.depth / 2;
  return [
    ['behind 0.3', [0, -hd - 0.3]], ['behind 0.6', [0, -hd - 0.6]], ['behind 1.0', [0, -hd - 1.0]],
    ['left end 0.4', [-hw - 0.4, 0]], ['front 0.3', [0, hd + 0.3]], ['front 1.0', [0, hd + 1.0]],
  ];
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

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

const inPlane = (mesh, f, y) => mesh.faces[f].indices.every((j) => Math.abs(mesh.vertices[j][1] - y) < EPS);
const facesUp = (mesh, f) => {
  const [a, b, c] = mesh.faces[f].indices.slice(0, 3).map((j) => mesh.vertices[j]);
  return (c[0] - a[0]) * (b[2] - a[2]) - (c[2] - a[2]) * (b[0] - a[0]) > 0;
};

/**
 * The top's faces (up-facing faces at y = `topY`) and the parts standing on
 * or over it (lowest point at or above `topY`). A part made only of faces in
 * the top's plane is the top (a top split into cells), not something on it.
 */
export function topAndStanding(mesh, topY) {
  const top = [];
  const standing = [];
  for (const part of components(mesh)) {
    const y0 = Math.min(...part.flatMap((i) => mesh.faces[i].indices.map((j) => mesh.vertices[j][1])));
    const flat = part.every((i) => inPlane(mesh, i, topY));
    if (y0 >= topY - EPS && !flat) { standing.push(part); continue; }
    for (const i of part) if (inPlane(mesh, i, topY) && facesUp(mesh, i)) top.push(i);
  }
  return { top, standing };
}

/** The mesh with no `under` face: what plain mean-depth order draws. */
export function plain(mesh) {
  return { vertices: mesh.vertices, faces: mesh.faces.map(({ under, ...f }) => f) };
}

// Tag every face with its own colour: textured polygons keep the raw tag,
// flat ones are shaded at intensity 1 (unlit) so the tag survives.
const tag = (mesh, base) => ({
  vertices: mesh.vertices,
  faces: mesh.faces.map((f, i) => ({ ...f, unlit: true, color: '#' + (base + i + 1).toString(16).padStart(6, '0') })),
});
const tagOf = (p) => {
  if (p.image) return parseInt(p.color.slice(1), 16) - 1;
  const [r, g, b] = p.color.match(/\d+/g).map(Number);
  return ((r << 16) | (g << 8) | b) - 1;
};
const worldPoint = (v, pos) => [v[0] * UNIT_SCALE + pos[0], v[1] * UNIT_SCALE + pos[1], v[2] * UNIT_SCALE + pos[2]];

/**
 * A scene of the counter (its faces grouped 'top', 'stand' or 'body' for
 * `topY`) and, at `at` (units, x/z), a character ('char'), each tagged, with
 * every face's world plane. `variant` 'plain' strips the `under` hints.
 */
function scene(mesh, topY, character, at, variant) {
  const { top, standing } = topAndStanding(mesh, topY);
  const topSet = new Set(top);
  const standSet = new Set(standing.flat());
  const items = [{ mesh: variant === 'plain' ? plain(mesh) : mesh, pos: [0, 0, 0], group: (i) => (topSet.has(i) ? 'top' : standSet.has(i) ? 'stand' : 'body') }];
  if (character && at) items.push({ mesh: character, pos: [at[0] * UNIT_SCALE, 0, at[1] * UNIT_SCALE], group: () => 'char' });
  const placed = [];
  const faces = [];
  let base = 0;
  for (const { mesh: m, pos, group } of items) {
    placed.push({ mesh: tag(m, base), placement: { pos, yaw: 0, scale: UNIT_SCALE } });
    m.faces.forEach((f, i) => {
      const [a, b, c] = f.indices.slice(0, 3).map((k) => worldPoint(m.vertices[k], pos));
      faces[base + i] = { a, n: cross(sub(b, a), sub(c, a)), group: group(i) };
    });
    base += m.faces.length;
  }
  return { placed, faces };
}

/** A camera `radius` units from the centre at `deg` yaw, at the player's eye, pitched (or 'look': at the top), and its x/z in units. */
export function cameraAt(deg, pitch, radius, lookY) {
  const a = (deg * Math.PI) / 180;
  const R = radius * UNIT_SCALE;
  const p = pitch === 'look' ? -Math.atan2(BASE_EYE - lookY * UNIT_SCALE, R) : pitch;
  return {
    x: Math.sin(a) * radius,
    z: Math.cos(a) * radius,
    cam: cameraFromPose({ x: Math.sin(a) * R, y: Math.cos(a) * R, facing: -a }, {
      eyeHeight: BASE_EYE, pitch: p, fov: Math.PI / 3, aspect: 1, near: 1, far: 2000,
    }),
  };
}

/** Every camera of `sweep`, skipping those inside a character at `at` (the player cannot stand there). */
function* cameras(sweep, topY, at) {
  for (const radius of sweep.radii) {
    for (const pitch of sweep.pitches) {
      for (const deg of sweep.yaws) {
        const c = cameraAt(deg, pitch, radius, topY);
        if (at && Math.hypot(c.x - at[0], c.z - at[1]) < 0.45) continue;
        yield { ...c, deg, pitch, radius };
      }
    }
  }
}

/**
 * Over SWEEP, every pair where one of the top's polygons is drawn after a
 * polygon of something standing on it while their screen polygons overlap:
 * the top painting over what stands on it. Count per `pitch@radius`.
 */
export function standingOrderPairs(mesh, topY, sweep = SWEEP) {
  const s = scene(mesh, topY, null, null, 'hinted');
  const counts = {};
  const pairs = [];
  for (const c of cameras(sweep, topY, null)) {
    const key = `${c.pitch}@${c.radius}`;
    counts[key] ??= 0;
    const list = buildDrawList(c.cam, s.placed, ENV);
    const tops = [];
    list.forEach((p, k) => { if (s.faces[tagOf(p)].group === 'top') tops.push({ p, k }); });
    list.forEach((p, k) => {
      if (s.faces[tagOf(p)].group !== 'stand') return;
      for (const t of tops) {
        if (t.k > k && screenOverlap(t.p.screen, p.screen)) {
          counts[key]++;
          if (pairs.length < 10) pairs.push(`yaw ${c.deg} pitch ${c.pitch} R ${c.radius}: top face ${tagOf(t.p)} after face ${tagOf(p)}`);
        }
      }
    });
  }
  return { counts, pairs, total: Object.values(counts).reduce((a, n) => a + n, 0) };
}

/**
 * The rule moves only what stands on the top. With a character at each of
 * `positions(size)` (and with none), over `sweep`, the draw list with the
 * hints, restricted to every polygon not standing on the top (the top, the
 * counter's lower faces, the character), must equal plain mean-depth order's.
 * Returns the cameras checked and the mismatches.
 */
export function orderAudit(mesh, topY, size, character, sweep = SWEEP) {
  let checked = 0;
  const mismatches = [];
  for (const [name, at] of [['none', null], ...positions(size)]) {
    const hinted = scene(mesh, topY, character, at, 'hinted');
    const flat = scene(mesh, topY, character, at, 'plain');
    for (const c of cameras(sweep, topY, at)) {
      const keep = (s) => (p) => s.faces[tagOf(p)].group !== 'stand';
      const a = buildDrawList(c.cam, hinted.placed, ENV).filter(keep(hinted)).map(tagOf);
      const b = buildDrawList(c.cam, flat.placed, ENV).filter(keep(flat)).map(tagOf);
      checked++;
      if (a.length !== b.length || a.some((t, i) => t !== b[i])) mismatches.push(`${name}: yaw ${c.deg} pitch ${c.pitch} R ${c.radius}`);
    }
  }
  return { checked, mismatches };
}

function inv4(m) { // column-major 4x4 -> row-major inverse (Gauss-Jordan)
  const a = [0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((c) => m[c * 4 + r]));
  const I = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
  for (let c = 0; c < 4; c++) {
    let p = c;
    for (let r = c + 1; r < 4; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    [a[c], a[p]] = [a[p], a[c]];
    [I[c], I[p]] = [I[p], I[c]];
    const d = a[c][c];
    for (let k = 0; k < 4; k++) { a[c][k] /= d; I[c][k] /= d; }
    for (let r = 0; r < 4; r++) {
      if (r === c) continue;
      const f = a[r][c];
      for (let k = 0; k < 4; k++) { a[r][k] -= f * a[c][k]; I[r][k] -= f * I[c][k]; }
    }
  }
  return I;
}
const unproject = (Mi, sx, sy, nz) => {
  const v = [(sx / VIEW) * 2 - 1, (1 - sy / VIEW) * 2 - 1, nz, 1];
  const p = Mi.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2] + row[3] * v[3]);
  return [p[0] / p[3], p[1] / p[3], p[2] / p[3]];
};
function inside(x, y, P) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i];
    const [xj, yj] = P[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/**
 * Wrong pixels at one camera, sampled every `step` px over the top's screen
 * bounds: the group the painter leaves on the pixel (the last polygon over
 * it) against the group truly nearest along its ray. Counts `bodyOverTop`
 * (a lower face of the counter painted over its top), `charOverTop`,
 * `topOverChar`, `topOverStand` and `standOverChar` (something on the top
 * painted over a character in front of it: the rule's price).
 */
function pixelErrors(cam, s, step) {
  const list = buildDrawList(cam, s.placed, ENV).map((p) => {
    const xs = p.screen.map((v) => v[0]);
    const ys = p.screen.map((v) => v[1]);
    return { p, f: tagOf(p), x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  });
  const tops = list.filter((e) => s.faces[e.f].group === 'top');
  const r = { bodyOverTop: 0, charOverTop: 0, topOverChar: 0, topOverStand: 0, standOverChar: 0 };
  if (!tops.length) return r;
  const bx0 = Math.max(0, Math.min(...tops.map((e) => e.x0)));
  const bx1 = Math.min(VIEW, Math.max(...tops.map((e) => e.x1)));
  const by0 = Math.max(0, Math.min(...tops.map((e) => e.y0)));
  const by1 = Math.min(VIEW, Math.max(...tops.map((e) => e.y1)));
  const Mi = inv4(cam.viewProj);
  for (let y = Math.floor(by0) + 0.5; y < by1; y += step) {
    for (let x = Math.floor(bx0) + 0.5; x < bx1; x += step) {
      let painted = null;
      let best = null;
      let bt = Infinity;
      const o = unproject(Mi, x, y, -0.9);
      const d = sub(unproject(Mi, x, y, 0.9), o);
      for (let k = list.length - 1; k >= 0; k--) {
        const e = list[k];
        if (x < e.x0 || x > e.x1 || y < e.y0 || y > e.y1 || !inside(x, y, e.p.screen)) continue;
        if (painted === null) painted = e;
        const F = s.faces[e.f];
        const den = dot(F.n, d);
        if (Math.abs(den) < 1e-12) continue;
        const t = dot(F.n, sub(F.a, o)) / den;
        if (t < bt - 1e-9) { bt = t; best = e; }
      }
      if (!painted || !best || painted.f === best.f) continue;
      const gp = s.faces[painted.f].group;
      const gb = s.faces[best.f].group;
      if (gp === gb) continue;
      if (gp === 'body' && gb === 'top') r.bodyOverTop++;
      else if (gp === 'char' && gb === 'top') r.charOverTop++;
      else if (gp === 'top' && gb === 'char') r.topOverChar++;
      else if (gp === 'top' && gb === 'stand') r.topOverStand++;
      else if (gp === 'stand' && gb === 'char') r.standOverChar++;
    }
  }
  return r;
}

/**
 * The pixel audit: for no character and each of `positions(size)`, over
 * `sweep`, the wrong-pixel counts with the hints and with plain mean-depth
 * order, per camera. Returns per position the totals for both, the cameras
 * where the hinted order is worse on a count the rule must never worsen
 * (bodyOverTop, charOverTop, topOverChar), and the price (standOverChar)
 * total and worst camera.
 */
export function pixelAudit(mesh, topY, size, character, { sweep = PIXEL_SWEEP, step = 4 } = {}) {
  const out = {};
  for (const [name, at] of [['none', null], ...positions(size)]) {
    const hinted = scene(mesh, topY, character, at, 'hinted');
    const flat = scene(mesh, topY, character, at, 'plain');
    const tot = { hinted: {}, plain: {} };
    const worse = [];
    let worst = null;
    let cams = 0;
    for (const c of cameras(sweep, topY, at)) {
      cams++;
      const h = pixelErrors(c.cam, hinted, step);
      const p = pixelErrors(c.cam, flat, step);
      for (const k in h) { tot.hinted[k] = (tot.hinted[k] ?? 0) + h[k]; tot.plain[k] = (tot.plain[k] ?? 0) + p[k]; }
      for (const k of ['bodyOverTop', 'charOverTop', 'topOverChar']) if (h[k] > p[k]) worse.push(`${k} yaw ${c.deg} pitch ${c.pitch} R ${c.radius}: ${h[k]} > ${p[k]}`);
      if (!worst || h.standOverChar > worst.n) worst = { n: h.standOverChar, plain: p.standOverChar, deg: c.deg, pitch: c.pitch, radius: c.radius };
    }
    out[name] = { cams, hinted: tot.hinted, plain: tot.plain, worse, price: tot.hinted.standOverChar, worst };
  }
  return out;
}
