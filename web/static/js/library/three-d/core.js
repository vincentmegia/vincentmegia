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
