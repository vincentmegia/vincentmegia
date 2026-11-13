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
 * The uv corners for a box's -Z face showing art rect `r`, for a part that
 * faces -Z: seen from -Z, model -X is the viewer's right, so the part spans
 * model x from -r.x1 to -r.x0 (art x = -model x). box winds that face
 * (x1,y0) (x0,y0) (x0,y1) (x1,y1), which is the viewer's bottom-left first,
 * exactly like the +Z front seen from +Z, so the corners come out the same
 * as artFrontUV's.
 */
export function artBackUV(r, artBox, scale) {
  return artFrontUV(r, artBox, scale);
}

const BACK_INDICES = '1,0,2,3'; // box's -Z face, kept as is by boxWithout

/**
 * textureFront for a part facing -Z: dresses its -Z face (box's 'back', found
 * wherever boxWithout left it) in art region `r`. Mutates and returns `part`.
 */
export function textureBack(part, r, { image, artBox, scale, color, div }) {
  const f = part.faces.find((x) => x.indices.join() === BACK_INDICES);
  if (image) {
    f.texture = { image, uv: artBackUV(r, artBox, scale), div };
    f.unlit = true;
  } else {
    f.color = color;
  }
  return part;
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

/**
 * A tapered tube from point `a` (radius `ra`) to point `b` (radius `rb`),
 * `sides` faces round, with optional end caps. Its rings are perpendicular
 * to a→b, so it follows a limb at any angle (an arm from shoulder to elbow).
 * Faces wind outward. `capA`/`capB` colour the end caps (null for none).
 * `side` and `squash` make a flattened tube (a palm, a pocket's bulge): the
 * rings are `ra`/`rb` wide along `side` (taken square to the axis) and
 * `squash` times that thick the other way.
 */
export function tube(a, b, ra, rb, sides, color, { capA = null, capB = null, side = null, squash = 1 } = {}) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(d[0], d[1], d[2]) || 1;
  const ax = d.map((c) => c / len);
  // Any vector not parallel to the axis gives the ring's basis.
  const ref = Math.abs(ax[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const cross = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
  const norm = (p) => { const l = Math.hypot(p[0], p[1], p[2]); return p.map((c) => c / l); };
  let u = norm(cross(ax, ref));
  if (side) {
    // `side` with its part along the axis removed.
    const along = side[0] * ax[0] + side[1] * ax[1] + side[2] * ax[2];
    u = norm([side[0] - ax[0] * along, side[1] - ax[1] * along, side[2] - ax[2] * along]);
  }
  const w = cross(ax, u);
  const vertices = [];
  for (const [c, r] of [[a, ra], [b, rb]]) {
    for (let i = 0; i < sides; i++) {
      const t = (i / sides) * Math.PI * 2;
      const cs = Math.cos(t) * r;
      const sn = Math.sin(t) * r * squash;
      vertices.push([c[0] + u[0] * cs + w[0] * sn, c[1] + u[1] * cs + w[1] * sn, c[2] + u[2] * cs + w[2] * sn]);
    }
  }
  const faces = [];
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    // Ring angle runs u → w, so j follows i anticlockwise about the axis;
    // i, j, j + sides, i + sides is outward-CCW.
    faces.push({ indices: [i, j, j + sides, i + sides], color });
  }
  if (capA) faces.push({ indices: Array.from({ length: sides }, (_, i) => sides - 1 - i), color: capA });
  if (capB) faces.push({ indices: Array.from({ length: sides }, (_, i) => sides + i), color: capB });
  return { vertices, faces };
}

/** A face's unit normal from its first three vertices (CCW seen from outside). */
export function faceNormal(mesh, face) {
  const [p, q, r] = face.indices.slice(0, 3).map((i) => mesh.vertices[i]);
  const e1 = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
  const e2 = [r[0] - p[0], r[1] - p[1], r[2] - p[2]];
  const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  const l = Math.hypot(n[0], n[1], n[2]) || 1;
  return n.map((c) => c / l);
}

/**
 * Wear 2D art projected straight along Z onto every 4-vertex face of `part`
 * that turns toward +Z (normal z >= `minNz`): each vertex takes the image
 * point `toUV(vertex)`, so the art lands on the curved front exactly as the
 * flat drawing shows it seen head-on (a character's front, which a flat
 * `textureFront` can't wrap). Dressed faces are `unlit` (the art carries its
 * own shading). Without `image` nothing changes: the faces keep their flat
 * colours. `only(face)` limits it to some faces. Mutates and returns `part`.
 */
export function projectFront(part, { image, toUV, minNz = 0.35, div, only = () => true }) {
  if (!image) return part;
  for (const f of part.faces) {
    if (f.indices.length !== 4 || !only(f)) continue;
    if (faceNormal(part, f)[2] < minNz) continue;
    f.texture = { image, uv: f.indices.map((i) => toUV(part.vertices[i])), div };
    f.unlit = true;
  }
  return part;
}

/**
 * prism with a centre per ring: each ring is {y, rx, rz, color, cx?, cz?}
 * (cx/cz default 0), so a stack can lean (a chin set forward of the skull).
 * Bands, caps and winding exactly as prism's.
 */
export function loft(rings, sides, capTop = null, capBottom = null) {
  const m = prism(rings, sides, capTop, capBottom);
  m.vertices.forEach((v, i) => {
    const r = rings[Math.floor(i / sides)];
    v[0] += r.cx ?? 0;
    v[2] += r.cz ?? 0;
  });
  return m;
}
