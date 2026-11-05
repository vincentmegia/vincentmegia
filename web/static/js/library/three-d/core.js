// Pure math for the software-3D renderer: column-major Mat4 (length-16 array),
// Vec3 = [x,y,z]. World X = game x, world Z = game y, world Y = up.

export function identityMat4() {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

// Returns a * b (apply b first, then a).
export function multiplyMat4(a, b) {
  const out = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = s;
    }
  }
  return out;
}

export function transformPoint(m, p) {
  const [x, y, z] = p;
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
    m[3] * x + m[7] * y + m[11] * z + m[15],
  ];
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
function normalize(a) {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

// Rodrigues rotation of v about unit axis k by angle t.
function rotate(v, k, t) {
  const c = Math.cos(t);
  const s = Math.sin(t);
  return add(add(scale(v, c), scale(cross(k, v), s)), scale(k, dot(k, v) * (1 - c)));
}

function lookAt(eye, target, up) {
  const f = normalize(sub(target, eye));
  const s = normalize(cross(f, up));
  const u = cross(s, f);
  return [
    s[0], u[0], -f[0], 0,
    s[1], u[1], -f[1], 0,
    s[2], u[2], -f[2], 0,
    -dot(s, eye), -dot(u, eye), dot(f, eye), 1,
  ];
}

function perspective(fov, aspect, near, far) {
  const t = 1 / Math.tan(fov / 2);
  const m = new Array(16).fill(0);
  m[0] = t / aspect;
  m[5] = t;
  m[10] = (far + near) / (near - far);
  m[11] = -1;
  m[14] = (2 * far * near) / (near - far);
  return m;
}

export function cameraFromPose(player, opts) {
  const { eyeHeight, pitch = 0, roll = 0, fov, aspect, near, far } = opts;
  const eye = [player.x, eyeHeight, player.y];
  const flat = [Math.sin(player.facing), 0, -Math.cos(player.facing)];
  const worldUp = [0, 1, 0];
  const right = normalize(cross(flat, worldUp));
  const forward = rotate(flat, right, pitch);
  const up = rotate(rotate(worldUp, right, pitch), forward, roll);
  const view = lookAt(eye, add(eye, forward), up);
  return { viewProj: multiplyMat4(perspective(fov, aspect, near, far), view), position: eye };
}

export function projectPoint(camera, world, viewport) {
  const [cx, cy, cz, cw] = transformPoint(camera.viewProj, world);
  // With this perspective matrix, clip w equals view-space distance along the view axis.
  const depth = cw;
  const visible = cw > 0 && cz >= -cw;
  const inv = cw !== 0 ? 1 / cw : 0;
  return {
    x: (cx * inv * 0.5 + 0.5) * viewport.width,
    y: (1 - (cy * inv * 0.5 + 0.5)) * viewport.height,
    depth,
    visible,
  };
}

/**
 * @typedef {[number, number, number]} Vec3
 * @typedef {{indices: number[], color: string}} Face   color: '#rgb' | '#rrggbb' | 'rgb(r,g,b)'
 * @typedef {{vertices: Vec3[], faces: Face[]}} Mesh
 * @typedef {{pos: Vec3, yaw: number, scale: number|Vec3}} Placement   yaw: radians about +Y
 * @typedef {{mesh: Mesh, placement: Placement}} Placed
 * @typedef {{screen: [number, number][], color: string, depth: number}} DrawPoly
 */

const NEAR_EPS = 1e-9;

/**
 * Sutherland-Hodgman clip of a convex polygon against the near plane, in clip
 * space. A vertex is in front of the near plane when z + w >= 0 (with this
 * perspective matrix that is exactly "at least `near` away"), so the signed
 * distance is z + w and a crossing edge is split at t = d0 / (d0 - d1).
 *
 * Clipping (rather than dropping the whole face) is what lets the camera stand
 * *inside* the room: the floor, ceiling and walls all straddle the near plane
 * from in there, and a dropped face leaves a hole in the frame.
 *
 * @param {number[][]} poly clip-space [x, y, z, w] points, convex, in order
 * @returns {number[][]} the part in front of the near plane ([] if none)
 */
function clipNear(poly) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i];
    const prev = poly[(i + poly.length - 1) % poly.length];
    const dCur = cur[2] + cur[3];
    const dPrev = prev[2] + prev[3];
    const curIn = dCur >= NEAR_EPS;
    const prevIn = dPrev >= NEAR_EPS;
    if (curIn !== prevIn) {
      const t = dPrev / (dPrev - dCur);
      out.push([
        prev[0] + (cur[0] - prev[0]) * t,
        prev[1] + (cur[1] - prev[1]) * t,
        prev[2] + (cur[2] - prev[2]) * t,
        prev[3] + (cur[3] - prev[3]) * t,
      ]);
    }
    if (curIn) out.push(cur);
  }
  return out;
}

function parseColor(c) {
  if (c[0] === '#') {
    const h = c.length === 4 ? c.slice(1).replace(/./g, (x) => x + x) : c.slice(1, 7);
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  return c.match(/[\d.]+/g).slice(0, 3).map(Number);
}

/**
 * Pure color transform: scale base color by `intensity` (0..1), then lerp toward
 * fog.color by (depth - start) / (end - start). Returns 'rgb(r,g,b)'.
 */
export function shadeColor(base, intensity, fog, depth = 0) {
  const k = Math.min(1, Math.max(0, intensity));
  let rgb = parseColor(base).map((v) => v * k);
  if (fog) {
    const t = Math.min(1, Math.max(0, (depth - fog.start) / (fog.end - fog.start)));
    const f = parseColor(fog.color);
    rgb = rgb.map((v, i) => v + (f[i] - v) * t);
  }
  return `rgb(${rgb.map((v) => Math.round(v)).join(',')})`;
}

function modelPoint(p, pl) {
  const s = Array.isArray(pl.scale) ? pl.scale : [pl.scale, pl.scale, pl.scale];
  const x = p[0] * s[0], y = p[1] * s[1], z = p[2] * s[2];
  const c = Math.cos(pl.yaw), sn = Math.sin(pl.yaw);
  return [x * c + z * sn + pl.pos[0], y + pl.pos[1], -x * sn + z * c + pl.pos[2]];
}

export function buildDrawList(camera, placed, opts) {
  const { viewport, light, fog } = opts;
  const ld = normalize(light.dir);
  const out = [];
  for (const { mesh, placement } of placed) {
    const world = mesh.vertices.map((v) => modelPoint(v, placement));
    const clip = world.map((w) => transformPoint(camera.viewProj, w));
    for (const face of mesh.faces) {
      const idx = face.indices;
      if (idx.length < 3) continue;
      // Clip against the near plane; a face entirely behind it yields nothing.
      // Shading still comes from the unclipped world vertices, so a face looks
      // the same whether or not the camera happens to cut it.
      const poly = clipNear(idx.map((i) => clip[i]));
      if (poly.length < 3) continue;
      let depthSum = 0;
      for (const p of poly) depthSum += p[3];
      const a = world[idx[0]], b = world[idx[1]], c = world[idx[2]];
      const n = normalize(cross(sub(b, a), sub(c, a)));
      const intensity = light.ambient + Math.max(0, dot(n, ld));
      const depth = depthSum / poly.length;
      const screen = poly.map(([cx, cy, , cw]) => [
        (cx / cw * 0.5 + 0.5) * viewport.width,
        (1 - (cy / cw * 0.5 + 0.5)) * viewport.height,
      ]);
      out.push({ screen, color: shadeColor(face.color, intensity, fog, depth), depth });
    }
  }
  return out.sort((p, q) => q.depth - p.depth);
}

export function drawScene(ctx, camera, placed, opts) {
  for (const poly of buildDrawList(camera, placed, opts)) {
    ctx.beginPath();
    poly.screen.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = poly.color;
    ctx.fill();
    // Canvas antialiases each fill independently, so two polygons meeting on a
    // shared edge leave a half-covered hairline of whatever is underneath —
    // a visible grid over the tiled room shell. Stroking in the fill color
    // covers that seam without changing the shape.
    ctx.strokeStyle = poly.color;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
