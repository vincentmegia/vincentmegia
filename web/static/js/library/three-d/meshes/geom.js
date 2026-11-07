// Mesh primitives shared by the three-d meshes. Pure and DOM-free.
// Mesh = {vertices: number[][], faces: {indices: number[], color: string, unlit?: boolean}[]}.
// Faces are convex polygons wound counter-clockwise seen from outside.

export function emptyMesh() {
  return { vertices: [], faces: [] };
}

/** Append `part` to `target` (indices offset). Mutates and returns `target`. */
export function merge(target, part) {
  const base = target.vertices.length;
  for (const v of part.vertices) target.vertices.push(v);
  for (const f of part.faces) target.faces.push({ ...f, indices: f.indices.map((i) => i + base) });
  return target;
}

/**
 * Axis-aligned box: 8 vertices + 6 quad faces (CCW seen from outside).
 * `tint` overrides individual face colours: front(+Z) back(-Z) right(+X) left(-X) top(+Y) bottom(-Y).
 */
export function box(min, max, color, tint = {}) {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  const vertices = [];
  for (let i = 0; i < 8; i++) {
    vertices.push([i & 1 ? x1 : x0, i & 2 ? y1 : y0, i & 4 ? z1 : z0]);
  }
  // index = x + 2*y + 4*z (each 0=min, 1=max)
  const quads = [
    ['front', [4, 5, 7, 6]], // +Z
    ['back', [1, 0, 2, 3]], // -Z
    ['right', [5, 1, 3, 7]], // +X
    ['left', [0, 4, 6, 2]], // -X
    ['top', [6, 7, 3, 2]], // +Y
    ['bottom', [0, 1, 5, 4]], // -Y
  ];
  return {
    vertices,
    faces: quads.map(([name, indices]) => ({ indices, color: tint[name] ?? color })),
  };
}

/**
 * Vertical stack of N-gon rings. The band between two rings takes the upper
 * ring's colour. Caps are added only when a colour is given.
 * @param {{y:number, rx:number, rz:number, color:string}[]} rings bottom to top
 */
export function prism(rings, sides, capTop = null, capBottom = null) {
  const vertices = [];
  for (const r of rings) {
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 + Math.PI / sides;
      vertices.push([Math.sin(a) * r.rx, r.y, Math.cos(a) * r.rz]);
    }
  }
  const faces = [];
  for (let k = 0; k < rings.length - 1; k++) {
    const lo = k * sides;
    const hi = (k + 1) * sides;
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      faces.push({ indices: [lo + i, lo + j, hi + j, hi + i], color: rings[k + 1].color });
    }
  }
  if (capTop && rings.length > 0) {
    const top = (rings.length - 1) * sides;
    const idx = [];
    for (let i = 0; i < sides; i++) idx.push(top + i);
    faces.push({ indices: idx, color: capTop });
  }
  if (capBottom && rings.length > 0) {
    const idx = [];
    for (let i = sides - 1; i >= 0; i--) idx.push(i);
    faces.push({ indices: idx, color: capBottom });
  }
  return { vertices, faces };
}

/** One 4-vertex face. */
export function quad(points, color, opts = {}) {
  const face = { indices: [0, 1, 2, 3], color };
  if (opts.unlit) face.unlit = true;
  return { vertices: points.map((p) => [...p]), faces: [face] };
}

export function translate(mesh, offset) {
  return {
    vertices: mesh.vertices.map((v) => [v[0] + offset[0], v[1] + offset[1], v[2] + offset[2]]),
    faces: mesh.faces,
  };
}

export function scaleMesh(mesh, k) {
  return { vertices: mesh.vertices.map((v) => [v[0] * k, v[1] * k, v[2] * k]), faces: mesh.faces };
}

/** Uniform scale about the plane y = pivotY. */
export function scaleAbout(mesh, k, pivotY) {
  return {
    vertices: mesh.vertices.map((v) => [v[0] * k, pivotY + (v[1] - pivotY) * k, v[2] * k]),
    faces: mesh.faces,
  };
}

const BOX_FACE_NAMES = ['front', 'back', 'right', 'left', 'top', 'bottom']; // box's face order

/**
 * A box without the faces named in `drop` ('front', 'back', 'right', 'left',
 * 'top', 'bottom'). Hidden faces would only tie in the painter's sort
 * (docs/skills/2d-to-3d/SKILL.md, step 7). The front (+Z), when kept, stays faces[0].
 */
export function boxWithout(min, max, color, drop = []) {
  const b = box(min, max, color);
  return { vertices: b.vertices, faces: b.faces.filter((_, i) => !drop.includes(BOX_FACE_NAMES[i])) };
}

/**
 * The uv corners for a box's +Z front (box winds it (x0,y0) (x1,y0) (x1,y1)
 * (x0,y1) in model space, y up) showing art rect `r`. `r` is in the drawer's
 * centered px (y down) for an art box of `artBox.w` x `artBox.h`, painted at
 * `scale` image px per art px.
 */
export function artFrontUV(r, artBox, scale) {
  const u = (x) => (x + artBox.w / 2) * scale;
  const v = (y) => (y + artBox.h / 2) * scale;
  return [[u(r.x0), v(r.y1)], [u(r.x1), v(r.y1)], [u(r.x1), v(r.y0)], [u(r.x0), v(r.y0)]];
}

/**
 * Dress a part's +Z front (its faces[0]) in its own region `r` of the 2D art:
 * textured and unlit when `image` is given, else the flat fallback `color`.
 * Mutates and returns `part`.
 * @param {{faces: object[]}} part
 * @param {{x0:number,y0:number,x1:number,y1:number}} r
 * @param {{image?: CanvasImageSource, artBox: {w:number,h:number}, scale: number, color: string, div?: number[]}} opts
 */
export function textureFront(part, r, { image, artBox, scale, color, div }) {
  const f = part.faces[0];
  if (image) {
    f.texture = { image, uv: artFrontUV(r, artBox, scale), div };
    f.unlit = true;
  } else {
    f.color = color;
  }
  return part;
}
