// Low-poly bookshelf: side panels, back panel, `rows`+1 planks (the topmost
// closes the unit) and two book blocks per row. Base at y=0, centered on x/z.
// Pure and deterministic. Details sit 0.01 proud of backing surfaces so the
// painter's sort never sees exactly-coplanar faces.
import { box } from './geom.js';

const HEIGHT = 2.0;
const DEPTH = 0.35;
const T = 0.04; // panel / plank thickness
const BACK = 0.03;
const KICK = 0.1;
const PLANK_COLOR = '#8a5a30';
const FRAME_COLOR = '#7a4e2a';
const PALETTE = ['#a8402f', '#2f5d8a', '#4f7a3a', '#c79a2e', '#6b3f7a', '#d9c9a3', '#2f7a74'];

function merge(parts) {
  const vertices = [];
  const faces = [];
  for (const p of parts) {
    const off = vertices.length;
    vertices.push(...p.vertices);
    for (const f of p.faces) faces.push({ indices: f.indices.map((i) => i + off), color: f.color });
  }
  return { vertices, faces };
}

export function buildBookshelf({ width = 1.0, rows = 4, accent } = {}) {
  const hw = width / 2;
  const hd = DEPTH / 2;
  const frame = accent || FRAME_COLOR;
  const parts = [];
  parts.push(box([-hw, 0, -hd], [-hw + T, HEIGHT, hd], frame));
  parts.push(box([hw - T, 0, -hd], [hw, HEIGHT, hd], frame));
  parts.push(box([-hw + T, 0, -hd], [hw - T, HEIGHT, -hd + BACK], frame));

  const step = (HEIGHT - KICK - T) / rows; // plank-to-plank pitch
  const zBack = -hd + BACK;
  let n = 0;
  for (let i = 0; i <= rows; i++) {
    const y0 = i === rows ? HEIGHT - T : KICK + i * step;
    // Recessed 0.01 so front faces don't tie with the side panels' fronts.
    parts.push(box([-hw + T, y0, zBack], [hw - T, y0 + T, hd - 0.01], PLANK_COLOR));
  }
  const inner = width - 2 * T;
  for (let i = 0; i < rows; i++) {
    const base = KICK + i * step + T;
    const clear = step - T;
    let x = -hw + T + 0.02;
    for (let b = 0; b < 2; b++) {
      const w = inner * (b === 0 ? 0.38 : 0.3);
      const h = clear * (0.65 + 0.05 * ((n * 3) % 5));
      const d = DEPTH - BACK - 0.08 - 0.02 * (n % 3);
      const gap = b === 0 ? 0 : inner * 0.12;
      x += gap;
      parts.push(box([x, base, zBack + 0.01], [x + w, base + h, zBack + 0.01 + d], PALETTE[n % PALETTE.length]));
      x += w;
      n++;
    }
  }
  return merge(parts);
}
