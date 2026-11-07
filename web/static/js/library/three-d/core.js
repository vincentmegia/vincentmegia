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
 * @typedef {{indices: number[], color: string, unlit?: boolean, cull?: boolean, texture?: Texture}} Face   unlit: skip scene lighting (fog still applies). cull: drop the face when it is turned away from the camera (opt in only where the winding is tested). color: '#rgb' | '#rrggbb' | 'rgb(r,g,b)'
 * @typedef {{image: CanvasImageSource, uv: [number, number][], div?: [number, number]}} Texture
 *   A quad face's surface art (docs/skills/2d-to-3d/SKILL.md): `image` is the 2D
 *   drawer's own output, `uv` one [u, v] in image px per face index, `div` the
 *   [nu, nv] cells it is cut into (default [1, 1]). The mapped region must be
 *   opaque: shading and fog are painted over each triangle as overlays.
 * @typedef {{vertices: Vec3[], faces: Face[]}} Mesh
 * @typedef {{pos: Vec3, yaw: number, scale: number|Vec3}} Placement   yaw: radians about +Y
 * @typedef {{mesh: Mesh, placement: Placement}} Placed
 * @typedef {{screen: [number, number][], color: string, depth: number}} DrawPoly
 *   A textured cell's triangles add `image`, `uv`, `intensity`, `fog` (0..1) and `fogColor`.
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

const lerp3 = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
const bilerp = (q, u, v) => lerp3(lerp3(q[0], q[1], u), lerp3(q[3], q[2], u), v);
const fogAmount = (fog, depth) => (fog ? Math.min(1, Math.max(0, (depth - fog.start) / (fog.end - fog.start))) : 0);

/**
 * Cuts a textured quad into div[0] x div[1] cells (bilinear in world space and
 * in uv) and pushes each cell as two textured triangles. Canvas 2D can only
 * draw an image through an affine map, so a small cell is what keeps the
 * missing perspective divide invisible. A cell the near plane cuts is pushed
 * as a flat, clipped polygon in the face's colour instead, so it leaves no hole.
 */
function pushTexturedFace(out, face, world, camera, viewport, fog, intensity) {
  const { image, uv, div = [1, 1] } = face.texture;
  const W = face.indices.map((i) => world[i]);
  const [nu, nv] = div;
  const toScreen = ([cx, cy, , cw]) => [(cx / cw * 0.5 + 0.5) * viewport.width, (1 - (cy / cw * 0.5 + 0.5)) * viewport.height];
  for (let iv = 0; iv < nv; iv++) {
    for (let iu = 0; iu < nu; iu++) {
      const corners = [[iu, iv], [iu + 1, iv], [iu + 1, iv + 1], [iu, iv + 1]].map(([a, b]) => [a / nu, b / nv]);
      const clip = corners.map(([a, b]) => transformPoint(camera.viewProj, bilerp(W, a, b)));
      if (clip.some((c) => c[2] + c[3] < NEAR_EPS)) {
        const poly = clipNear(clip);
        if (poly.length < 3) continue;
        const depth = poly.reduce((acc, c) => acc + c[3], 0) / poly.length;
        out.push({ screen: poly.map(toScreen), color: shadeColor(face.color, intensity, fog, depth), depth, ground: false });
        continue;
      }
      const cellUv = corners.map(([a, b]) => bilerp(uv, a, b));
      const screen = clip.map(toScreen);
      for (const tri of [[0, 1, 2], [0, 2, 3]]) {
        const depth = tri.reduce((acc, i) => acc + clip[i][3], 0) / 3;
        out.push({
          screen: tri.map((i) => screen[i]),
          uv: tri.map((i) => cellUv[i]),
          image,
          intensity,
          fog: fogAmount(fog, depth),
          fogColor: fog?.color,
          color: face.color,
          depth,
          ground: false,
        });
      }
    }
  }
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
      if (face.cull) {
        const a = world[idx[0]], b = world[idx[1]], c = world[idx[2]];
        if (dot(cross(sub(b, a), sub(c, a)), sub(camera.position, a)) <= 0) continue;
      }
      if (face.texture && idx.length === 4) {
        const a = world[idx[0]], b = world[idx[1]], c = world[idx[2]];
        const n = normalize(cross(sub(b, a), sub(c, a)));
        const intensity = face.unlit ? 1 : light.ambient + Math.max(0, dot(n, ld));
        pushTexturedFace(out, face, world, camera, viewport, fog, intensity);
        continue;
      }
      // Clip against the near plane; a face entirely behind it yields nothing.
      // Shading still comes from the unclipped world vertices, so a face looks
      // the same whether or not the camera happens to cut it.
      const poly = clipNear(idx.map((i) => clip[i]));
      if (poly.length < 3) continue;
      let depthSum = 0;
      for (const p of poly) depthSum += p[3];
      const a = world[idx[0]], b = world[idx[1]], c = world[idx[2]];
      const n = normalize(cross(sub(b, a), sub(c, a)));
      const intensity = face.unlit ? 1 : light.ambient + Math.max(0, dot(n, ld));
      const depth = depthSum / poly.length;
      const screen = poly.map(([cx, cy, , cw]) => [
        (cx / cw * 0.5 + 0.5) * viewport.width,
        (1 - (cy / cw * 0.5 + 0.5)) * viewport.height,
      ]);
      out.push({
        screen, color: shadeColor(face.color, intensity, fog, depth), depth, ground: Boolean(face.ground),
      });
    }
  }
  // Ground is its own layer, painted first and farthest-first within itself.
  // The floor is the shell's lowest surface and everything in the room rests on
  // it, so it can never legitimately occlude any of them — but its tiles are
  // wide, and sorting them by mean depth puts the tile underfoot in front of a
  // patron two metres away, painting out their feet and lower legs. Ordering by
  // (ground, depth) is still a total order, so the sort stays stable and the
  // floor keeps its own back-to-front overlap and fog gradient.
  return out.sort((p, q) => (p.ground === q.ground ? q.depth - p.depth : (p.ground ? -1 : 1)));
}

export function drawScene(ctx, camera, placed, opts) {
  for (const poly of buildDrawList(camera, placed, opts)) {
    if (poly.image) {
      drawTexturedTriangle(ctx, poly);
      continue;
    }
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

const SEAM_GROW = 0.6; // px the image clip grows about the centroid, so cells meet without hairlines

function trianglePath(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  ctx.lineTo(pts[1][0], pts[1][1]);
  ctx.lineTo(pts[2][0], pts[2][1]);
  ctx.closePath();
}

/**
 * Paints one textured triangle: the image through the affine map that takes
 * its uv triangle onto its screen triangle, clipped to that triangle (grown by
 * SEAM_GROW), then darkening (1 - intensity) and fog as flat overlays clipped
 * to the exact triangle.
 */
function drawTexturedTriangle(ctx, p) {
  const [[x0, y0], [x1, y1], [x2, y2]] = p.screen;
  const [[u0, v0], [u1, v1], [u2, v2]] = p.uv;
  const det = (u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0);
  if (Math.abs(det) < 1e-12) return;
  const a = ((x1 - x0) * (v2 - v0) - (x2 - x0) * (v1 - v0)) / det;
  const c = ((x2 - x0) * (u1 - u0) - (x1 - x0) * (u2 - u0)) / det;
  const b = ((y1 - y0) * (v2 - v0) - (y2 - y0) * (v1 - v0)) / det;
  const d = ((y2 - y0) * (u1 - u0) - (y1 - y0) * (u2 - u0)) / det;
  const e = x0 - a * u0 - c * v0;
  const f = y0 - b * u0 - d * v0;
  const cx = (x0 + x1 + x2) / 3, cy = (y0 + y1 + y2) / 3;
  const grown = p.screen.map(([x, y]) => {
    const dx = x - cx, dy = y - cy, len = Math.hypot(dx, dy) || 1;
    return [x + (dx / len) * SEAM_GROW, y + (dy / len) * SEAM_GROW];
  });
  // Only the triangle's own uv box is sampled, not the whole image.
  const sx = Math.max(0, Math.floor(Math.min(u0, u1, u2)) - 1);
  const sy = Math.max(0, Math.floor(Math.min(v0, v1, v2)) - 1);
  const sw = Math.min(p.image.width, Math.ceil(Math.max(u0, u1, u2)) + 1) - sx;
  const sh = Math.min(p.image.height, Math.ceil(Math.max(v0, v1, v2)) + 1) - sy;
  ctx.save();
  trianglePath(ctx, grown);
  ctx.clip();
  ctx.transform(a, b, c, d, e, f);
  if (sw > 0 && sh > 0) ctx.drawImage(p.image, sx, sy, sw, sh, sx, sy, sw, sh);
  ctx.restore();
  const dark = 1 - Math.min(1, Math.max(0, p.intensity));
  if (dark <= 0 && p.fog <= 0) return;
  ctx.save();
  trianglePath(ctx, p.screen);
  if (dark > 0) {
    ctx.globalAlpha = dark;
    ctx.fillStyle = '#000000';
    ctx.fill();
  }
  if (p.fog > 0) {
    ctx.globalAlpha = p.fog;
    ctx.fillStyle = p.fogColor;
    ctx.fill();
  }
  ctx.restore();
}
