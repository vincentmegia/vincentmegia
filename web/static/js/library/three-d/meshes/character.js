// Low-poly parameterized humanoid. Pure and deterministic.
// Model space: X right, Y up, Z depth; feet at y=0, centered on x/z, facing +Z.

/**
 * Axis-aligned box: 8 vertices + 6 quad faces (CCW seen from outside).
 * @returns {{vertices: number[][], faces: {indices: number[], color: string}[]}}
 */
export function box(min, max, color) {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  const vertices = [];
  for (let i = 0; i < 8; i++) {
    vertices.push([i & 1 ? x1 : x0, i & 2 ? y1 : y0, i & 4 ? z1 : z0]);
  }
  // index = x + 2*y + 4*z (each 0=min, 1=max)
  const quads = [
    [4, 5, 7, 6], // +Z
    [1, 0, 2, 3], // -Z
    [5, 1, 3, 7], // +X
    [0, 4, 6, 2], // -X
    [6, 7, 3, 2], // +Y
    [0, 1, 5, 4], // -Y
  ];
  return { vertices, faces: quads.map((indices) => ({ indices, color })) };
}

function shift(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + amount);
  const g = Math.max(0, ((n >> 8) & 255) - amount);
  const b = Math.max(0, (n & 255) - amount);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

/**
 * @param {{skin:string, hair:string, top:string, bottom:string, angry?:boolean}} opts
 * @returns {{vertices: number[][], faces: {indices:number[], color:string}[]}}
 */
export function buildCharacter(opts) {
  const { skin, hair, top, bottom, angry = false } = opts;
  const headColor = angry ? shift(skin, 40) : skin;
  const parts = [
    box([-0.17, 0, -0.1], [-0.01, 0.8, 0.1], bottom), // left leg
    box([0.01, 0, -0.1], [0.17, 0.8, 0.1], bottom), // right leg
    box([-0.2, 0.8, -0.11], [0.2, 1.35, 0.11], top), // torso
    box([-0.32, 0.88, -0.08], [-0.2, 1.33, 0.08], top), // left sleeve
    box([0.2, 0.88, -0.08], [0.32, 1.33, 0.08], top), // right sleeve
    box([-0.32, 0.76, -0.07], [-0.21, 0.88, 0.07], skin), // left hand
    box([0.21, 0.76, -0.07], [0.32, 0.88, 0.07], skin), // right hand
    box([-0.13, 1.4, -0.12], [0.13, 1.66, 0.12], headColor), // head
    box([-0.145, 1.58, -0.135], [0.145, 1.7, 0.12], hair), // hair cap
  ];
  const vertices = [];
  const faces = [];
  for (const p of parts) {
    const base = vertices.length;
    vertices.push(...p.vertices);
    for (const f of p.faces) faces.push({ indices: f.indices.map((i) => i + base), color: f.color });
  }
  return { vertices, faces };
}
