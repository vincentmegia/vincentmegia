// Room shell mesh: floor, ceiling, four walls, windows, wainscoting and light
// fixtures. WORLD coordinates (x∈[0,width], z∈[0,depth], y∈[0,height]); the
// camera stands inside. Pure and deterministic. Palette lifted from the old 2D
// drawFirstPersonBackground in library-game.js.

const WALL = '#d8ccb4';
const WAINSCOT = '#a08060';
const CHAIR_RAIL = '#7a5a3a';
const BASEBOARD = '#6a4a2a';
const PANE = '#f5ecd8';
const FRAME = '#7a5a3a';
const CEILING = '#c4b8a0';
const LIGHT = '#fff0c8';

const PROUD = 0.1; // detail offset off its surface (painter-sort, no z-buffer)

/**
 * @param {{width:number, depth:number, height:number, floorTint:string}} opts
 * @returns {{vertices:number[][], faces:{indices:number[], color:string}[]}}
 */
export function buildRoom({ width, depth, height, floorTint }) {
  const vertices = [];
  const faces = [];
  const quad = (pts, color) => {
    const base = vertices.length;
    for (const p of pts) vertices.push(p);
    faces.push({ indices: [base, base + 1, base + 2, base + 3], color });
  };

  quad([[0, 0, 0], [width, 0, 0], [width, 0, depth], [0, 0, depth]], floorTint);
  quad([[0, height, 0], [0, height, depth], [width, height, depth], [width, height, 0]], CEILING);

  // Each wall: origin point, along-wall axis (unit), inward normal, length.
  const walls = [
    { o: [0, 0, 0], u: [1, 0, 0], n: [0, 0, 1], len: width }, // z=0
    { o: [width, 0, depth], u: [-1, 0, 0], n: [0, 0, -1], len: width }, // z=depth
    { o: [0, 0, depth], u: [0, 0, -1], n: [1, 0, 0], len: depth }, // x=0
    { o: [width, 0, 0], u: [0, 0, 1], n: [-1, 0, 0], len: depth }, // x=width
  ];
  // Point on wall at distance s along it, height y, offset d inward.
  const at = (w, s, y, d) => [
    w.o[0] + w.u[0] * s + w.n[0] * d,
    y,
    w.o[2] + w.u[2] * s + w.n[2] * d,
  ];
  const rect = (w, s0, s1, y0, y1, d, color) =>
    quad([at(w, s0, y0, d), at(w, s1, y0, d), at(w, s1, y1, d), at(w, s0, y1, d)], color);

  const railY = height * 0.45;
  walls.forEach((w, wi) => {
    rect(w, 0, w.len, 0, height, 0, WALL);
    rect(w, 0, w.len, 0, railY, PROUD, WAINSCOT);
    rect(w, 0, w.len, railY - 2, railY, PROUD * 2, CHAIR_RAIL);
    rect(w, 0, w.len, 0, height * 0.04, PROUD * 2, BASEBOARD);
    // Three windows on the far wall (z=depth) and on each side wall.
    if (wi === 0) return;
    const ww = Math.min(w.len * 0.1, 80);
    const y0 = height * 0.55;
    const y1 = height * 0.9;
    for (let i = 0; i < 3; i++) {
      const c = w.len * (0.2 + i * 0.3);
      rect(w, c - ww / 2 - 3, c + ww / 2 + 3, y0 - 3, y1 + 3, PROUD, FRAME);
      rect(w, c - ww / 2, c + ww / 2, y0, y1, PROUD * 2, PANE);
    }
  });

  // Ceiling light fixtures: 3 x 2 grid, just below the ceiling.
  const ly = height - PROUD;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 2; j++) {
      const cx = width * (0.25 + i * 0.25);
      const cz = depth * (0.33 + j * 0.34);
      quad(
        [[cx - 25, ly, cz - 15], [cx - 25, ly, cz + 15], [cx + 25, ly, cz + 15], [cx + 25, ly, cz - 15]],
        LIGHT,
      );
    }
  }

  return { vertices, faces };
}
