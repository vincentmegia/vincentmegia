// Min-jun's First Person head, chin up: one 12-sided stack following his 2D
// head's own silhouette (facePath's V-jaw, then drawHair's crown), with the
// chin set forward of the skull. Its front wears his 2D head
// (paintMinjunHead: ears, face, eyes, brows, nose, mouth, fringe and crown)
// projected straight along Z, so the face IS the drawing: it blinks and
// talks when the game repaints that canvas, without a rebuild. The sides and
// back are his hair (the undercut's darker shade low at the back), the jaw
// sides skin. Every face is unlit, like every patron head
// (library-first-person-3d.md, "unlit faces"). Pure.

import { MINJUN_PALETTE as P, MINJUN_FRAME } from '../../minjun.js';
import { faceNormal, loft, projectFront } from './geom.js';
import { MINJUN_ART, S, modelY, uvIn } from './minjun-frame.js';

const SIDES = 12;
const H = MINJUN_FRAME.head; // -56

/**
 * The silhouette bottom to top, in art px: half-width `hw` (facePath's jaw
 * and cheek, then drawHair's crown outline), half-depth `hd`, and how far
 * forward the ring's centre sits (`cz`), so the chin leads.
 */
export const HEAD_RINGS = [
  { y: H + 12.3, hw: 1.8, hd: 2.4, cz: 4.4 }, // the chin
  { y: H + 9.8, hw: 5.2, hd: 5.6, cz: 2.6 }, // jawline
  { y: H + 6.2, hw: 7.8, hd: 8.0, cz: 1.0 }, // the jaw's soft corner
  { y: H + 2.8, hw: 9.9, hd: 9.2, cz: 0.2 }, // the fuller cheek
  { y: H - 1, hw: 10.7, hd: 10.0 }, // hair over the temples
  { y: H - 5, hw: 12.2, hd: 10.8 },
  { y: H - 8.6, hw: 12.3, hd: 10.9 },
  { y: H - 12.6, hw: 12.0, hd: 10.6 },
  { y: H - 16, hw: 10.4, hd: 9.4 },
  { y: H - 19, hw: 7.2, hd: 6.8 },
  { y: H - 21.2, hw: 3.4, hd: 3.2 }, // the top tufts
];

/** The highest ring of skin (the cheek); above it the stack is hair. */
const CHEEK_Y = H + 2.8;

const ring = (half) => half / Math.cos(Math.PI / SIDES);

/**
 * @param {{head?: CanvasImageSource}} [art]
 */
export function buildMinjunHead(art) {
  const m = loft(
    HEAD_RINGS.map((r) => ({
      y: modelY(r.y),
      rx: ring(r.hw) * S,
      rz: ring(r.hd) * S,
      cz: (r.cz ?? 0) * S,
      color: r.y >= CHEEK_Y ? P.skin : P.hair,
    })),
    SIDES,
    P.hair,
    P.skinShade,
  );
  // The back: hair all the way down, the undercut's shade below the temples.
  for (const f of m.faces) {
    const n = faceNormal(m, f);
    if (f.indices.length === 4 && n[2] < -0.3) {
      const y = Math.min(...f.indices.map((i) => m.vertices[i][1]));
      f.color = y < modelY(H - 1) ? P.hairShade : P.hair;
    }
    f.unlit = true;
  }
  return projectFront(m, { image: art?.head, toUV: uvIn(MINJUN_ART.head), minNz: 0.3 });
}
