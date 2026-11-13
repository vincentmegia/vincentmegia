// Kang Min-jun's First Person frame: his own proportions, measured off his
// own 2D renderer (library/minjun.js), not the shared patron frame
// (character-frame.js). He is drawn in Hospital Shift's anime frame, about
// 2.6 heads tall where a patron is 3.36, so the patron frame can't carry him.
// Pure and DOM-free.
//
// Everything in meshes/minjun-*.js is written in the art's own coordinates
// (x right, y DOWN, feet line at 0; z toward the viewer) and converted here,
// in one place, onto the floor in scene units.

import { MINJUN_FRAME } from '../../minjun.js';

/**
 * His eye height in game px. scene.js's BASE_EYE (60), so he meets the
 * player's eye line (minjun.test.js holds the two equal; importing scene.js
 * here would be circular).
 */
export const MINJUN_EYE_PX = 60;

/** Art px from the ground to his eyes: the sole's bottom up to EYE_Y. */
export const EYE_ABOVE_GROUND = MINJUN_FRAME.ground - MINJUN_FRAME.eye; // 63.3

/**
 * Game px per art px: the one scale, chosen so his eyes sit at
 * MINJUN_EYE_PX. That makes him (8.3 + 77.6) * 0.948 = 81.4 px tall, a
 * little taller than an adult patron's 73.35. Top-Down draws him at 1.5x;
 * in First Person that would put his eyes a metre above the player's.
 */
export const MINJUN_K = MINJUN_EYE_PX / EYE_ABOVE_GROUND;

/** Scene units per art px (UNIT_SCALE is 40 game px per unit). */
export const S = MINJUN_K / 40;

const G = MINJUN_FRAME.ground;

/** Art point (x, y down, z toward the viewer) to a model-space vertex. */
export function toModel(x, y, z = 0) {
  return [x * S, (G - y) * S, z * S];
}

/** A model-space vertex back to the art's (x, y). */
export function toArt(v) {
  return [v[0] / S, G - v[1] / S];
}

/** A model-space height for art y. */
export function modelY(y) {
  return (G - y) * S;
}

/**
 * The three canvases his 2D art is painted into for First Person, as art-px
 * boxes (y down) and image px per art px. `body` holds paintMinjunBody
 * (legs to neck), `head` paintMinjunHead (repainted as he blinks and
 * talks), `props` paintMinjunProps (the tote and the book spines).
 */
export const MINJUN_ART = {
  body: { x0: -14, y0: -48, x1: 14, y1: 4, scale: 4 },
  head: { x0: -15, y0: -84, x1: 15, y1: -40, scale: 6 },
  props: { x0: -22, y0: -36, x1: 20, y1: -4, scale: 4 },
};

/** A canvas's size in image px. */
export function artSize(box) {
  return { w: Math.round((box.x1 - box.x0) * box.scale), h: Math.round((box.y1 - box.y0) * box.scale) };
}

/** The image point a model vertex shows, projected straight along Z into `box`, clamped onto the image. */
export function uvIn(box) {
  const { w, h } = artSize(box);
  return (v) => {
    const [x, y] = toArt(v);
    const u = Math.min(w, Math.max(0, (x - box.x0) * box.scale));
    const t = Math.min(h, Math.max(0, (y - box.y0) * box.scale));
    return [u, t];
  };
}
