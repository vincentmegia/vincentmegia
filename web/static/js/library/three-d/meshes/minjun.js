// Kang Min-jun in First Person: his own mesh (not buildCharacter's shared
// patron), measured off his own 2D renderer (library/minjun.js) and wearing
// its drawing on the front. Design: docs/superpowers/specs/2026-11-13-library-fp-minjun-design.md.
// Pure, except paintMinjun*Art, which draw into a canvas the game owns.

import { emptyMesh, merge } from './geom.js';
import { buildMinjunBody } from './minjun-body.js';
import { buildMinjunHead } from './minjun-head.js';
import { MINJUN_ART, artSize } from './minjun-frame.js';
import { MINJUN_PALETTE as P, MINJUN_FRAME, faceForAction, isBlinkingAt, paintMinjunBody, paintMinjunHead, paintMinjunProps } from '../../minjun.js';

export { MINJUN_POSES } from './minjun-body.js';

/**
 * His pose in First Person from what Top-Down draws him doing: walking with a
 * hand in his pocket, reading an open book, waving (or offering to help, the
 * same raised arm), otherwise standing (humming is in his face, not his arms).
 * @param {{walking?: boolean, action?: string|null}} s
 */
export function minjunPoseFor({ walking, action }) {
  if (walking) return 'walk';
  if (action === 'read') return 'read';
  if (action === 'wave' || action === 'help') return 'wave';
  return 'idle';
}

/** How many steps his mouth opening is cut into, so talking repaints the face canvas a few times a second, not every frame. */
export const MOUTH_STEPS = 3;

/**
 * His face at time `t` (seconds; Top-Down's own clock) doing `action` for
 * `actionT` seconds: faceForAction's mouth, quantised, plus the blink.
 * Walking, he has no action (drawMinjun drops it too).
 * @returns {{face: {mouth: number|null, round?: boolean, eyesClosed?: boolean, blink: boolean}, key: string}}
 */
export function minjunFace({ t, walking, action, actionT }) {
  const f = faceForAction(walking ? null : action ?? null, actionT ?? 0);
  const mouth = f.mouth == null ? null : Math.round(f.mouth * MOUTH_STEPS) / MOUTH_STEPS;
  const blink = f.eyesClosed ? false : isBlinkingAt(t);
  const face = { mouth, blink };
  if (f.round) face.round = true;
  if (f.eyesClosed) face.eyesClosed = true;
  const key = `${mouth ?? '-'}|${face.round ? 'o' : ''}|${face.eyesClosed ? 'z' : blink ? 'b' : 'e'}`;
  return { face, key };
}

// Memoised per art object and pose: the scene asks every frame, and only a
// pose change (at most four meshes per art set) or new art builds again. The
// face canvas is repainted in place, so blinking and talking never rebuild.
const BY_ART = new WeakMap();
const NO_ART = new Map();

/**
 * @param {{pose?: string, art?: {body?: CanvasImageSource, head?: CanvasImageSource, props?: CanvasImageSource}}} [opts]
 */
export function buildMinjun({ pose = 'idle', art } = {}) {
  let slot = NO_ART;
  if (art) {
    slot = BY_ART.get(art);
    if (!slot) BY_ART.set(art, (slot = new Map()));
  }
  const hit = slot.get(pose);
  if (hit) return hit;
  const m = emptyMesh();
  merge(m, buildMinjunBody(pose, art));
  merge(m, buildMinjunHead(art));
  slot.set(pose, m);
  return m;
}

/** The canvas sizes the game makes for his art. */
export const MINJUN_ART_SIZE = {
  body: artSize(MINJUN_ART.body),
  head: artSize(MINJUN_ART.head),
  props: artSize(MINJUN_ART.props),
};

function paintInto(ctx, box, backing, draw) {
  const { w, h } = artSize(box);
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  // Opaque everywhere a face samples (the renderer paints shade and fog as
  // overlays): the backing first, in the colours round the drawing.
  for (const [y0, y1, color] of backing) {
    ctx.fillStyle = color;
    const top = Math.max(0, (y0 - box.y0) * box.scale);
    const bottom = Math.min(h, (y1 - box.y0) * box.scale);
    ctx.fillRect(0, top, w, bottom - top);
  }
  ctx.scale(box.scale, box.scale);
  ctx.translate(-box.x0, -box.y0);
  draw(ctx);
  ctx.restore();
}

/** His body art: vest round the torso, slacks round the legs. */
export function paintMinjunBodyArt(ctx) {
  const b = MINJUN_ART.body;
  paintInto(ctx, b, [[b.y0, -40.5, P.shirt], [-40.5, MINJUN_FRAME.hip, P.vest], [MINJUN_FRAME.hip, b.y1, P.slacks]], paintMinjunBody);
}

/** His head art for one face (minjunFace's): hair above the temples, skin below. */
export function paintMinjunHeadArt(ctx, face) {
  const b = MINJUN_ART.head;
  paintInto(ctx, b, [[b.y0, MINJUN_FRAME.head - 1, P.hair], [MINJUN_FRAME.head - 1, b.y1, P.skin]], (c) => paintMinjunHead(c, face));
}

/** The tote and book spines. */
export function paintMinjunPropsArt(ctx) {
  const b = MINJUN_ART.props;
  paintInto(ctx, b, [[b.y0, b.y1, '#e4d9c1']], paintMinjunProps);
}
