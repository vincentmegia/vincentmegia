// World-anchored label chips for Library Shift's First Person view (camera
// parity P5, docs/features/library-first-person-3d.md). Pure and DOM-free:
// the game hands over label *stacks* (an entity's chip lines, built by the
// same content functions Top-Down's chips use, at the entity's world x/y and
// an anchor height), and this module projects them with the frame's camera,
// culls, fades, declutters and orders them. Drawing stays in library-game.js
// (`drawLabelChip`).
import { projectPoint } from './core.js';
import { meshForStationKind, UNIT_SCALE } from './scene.js';
import { buildStationBox } from './meshes/station-box.js';
import { FRAME } from './meshes/character-frame.js';

/** Labels farther than this (world px, along the floor) are not drawn, unless they are the crosshair target. */
export const LABEL_RANGE = 520;
/** Labels nearer than this are fully opaque; between it and LABEL_RANGE they fade to LABEL_MIN_ALPHA. */
export const LABEL_FADE_START = 200;
export const LABEL_MIN_ALPHA = 0.3;
/** Patience bars only show this close (world px); the crosshair target always shows its bar. */
export const BAR_RANGE = 300;
/** How far above an entity's top its label stack's bottom edge is anchored (world px). */
export const ANCHOR_GAP = 8;
/** A person's crown (world px) when their mesh isn't to hand: the adult frame. */
export const PERSON_TOP = FRAME.crown * UNIT_SCALE;
/** A plain station box's height (scene.js's BOX_HEIGHT), for kinds without their own mesh. */
const BOX_TOP = 40;

/** Screen-space sizes, matching animeChip (hospital/anime-ui.js): 14 px of padding, 16 px tall. */
export const CHIP_PAD = 14;
export const CHIP_H = 16;
export const SUB_H = 10;
export const BAR_W = 36;
export const BAR_H = 5;
export const LINE_GAP = 2;
/** Space kept clear between two chips (and between a chip and the HUD) before the farther one is dropped. */
export const DECLUTTER_PAD = 2;

const tops = new WeakMap();

/** The highest vertex of a mesh (model units), memoised on the mesh's identity (meshes are shared and read-only). */
export function meshTop(mesh) {
  let top = tops.get(mesh);
  if (top === undefined) {
    top = 0;
    for (const v of mesh.vertices) if (v[1] > top) top = v[1];
    tops.set(mesh, top);
  }
  return top;
}

const stationBoxes = new Map();

/**
 * A station kind's bounding box (world px about the station's centre:
 * `{minX, maxX, minZ, maxZ, top}`), from the very mesh First Person draws for
 * it, or null for a kind drawn as a plain box (its size is per station).
 */
function stationMeshBox(kind) {
  let b = stationBoxes.get(kind);
  if (b === undefined) {
    const builder = meshForStationKind(kind);
    b = null;
    if (builder !== buildStationBox) {
      const { vertices } = builder({});
      b = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity, top: meshTop({ vertices }) * UNIT_SCALE };
      for (const [x, , z] of vertices) {
        b.minX = Math.min(b.minX, x * UNIT_SCALE); b.maxX = Math.max(b.maxX, x * UNIT_SCALE);
        b.minZ = Math.min(b.minZ, z * UNIT_SCALE); b.maxZ = Math.max(b.maxZ, z * UNIT_SCALE);
      }
    }
    stationBoxes.set(kind, b);
  }
  return b;
}

/** A station's top (world px), from the very mesh First Person draws for its kind. */
export function stationTop(kind) {
  return stationMeshBox(kind)?.top ?? BOX_TOP;
}

/**
 * The footprint and top a station blocks the view with, in world px:
 * `{id, x0, z0, x1, z1, top}`. Uses its mesh's own bounds, or scene.js's
 * plain box (`w`×`h`, default 60×40) for a kind without a mesh.
 */
export function stationOccluder(station) {
  const b = stationMeshBox(station.kind);
  if (b) return { id: station.id, x0: station.x + b.minX, x1: station.x + b.maxX, z0: station.y + b.minZ, z1: station.y + b.maxZ, top: b.top };
  const hw = (station.w ?? 60) / 2;
  const hd = (station.h ?? 40) / 2;
  return { id: station.id, x0: station.x - hw, x1: station.x + hw, z0: station.y - hd, z1: station.y + hd, top: BOX_TOP };
}

/**
 * Whether the sight line from `eye` to `anchor` (both `[x, y, z]`, world px)
 * passes through an occluder below its top — a label behind a bookcase or
 * a wall of the fines room is hidden, as its entity is. `selfId` (the
 * label's own station) never occludes.
 */
export function isOccluded(eye, anchor, occluders, selfId = null) {
  const [ex, ey, ez] = eye;
  const dx = anchor[0] - ex;
  const dz = anchor[2] - ez;
  for (const o of occluders) {
    if (o.id === selfId) continue;
    // Slab test of the floor-plane segment against the footprint.
    let t0 = 0;
    let t1 = 1;
    for (const [d, p, lo, hi] of [[dx, ex, o.x0, o.x1], [dz, ez, o.z0, o.z1]]) {
      if (Math.abs(d) < 1e-9) {
        if (p < lo || p > hi) { t0 = 1; t1 = 0; }
        continue;
      }
      let a = (lo - p) / d;
      let b = (hi - p) / d;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, b);
    }
    if (t0 >= t1) continue;
    // The sight line is straight, so its lowest point over the hit is at one end.
    const low = Math.min(ey + (anchor[1] - ey) * t0, ey + (anchor[1] - ey) * t1);
    if (low < o.top) return true;
  }
  return false;
}

/** Where a character's label stack sits: just above their crown, from their own mesh (a kid's is lower). */
export function characterAnchorHeight(mesh) {
  return (mesh ? meshTop(mesh) * UNIT_SCALE : PERSON_TOP) + ANCHOR_GAP;
}

export function stationAnchorHeight(kind) {
  return stationTop(kind) + ANCHOR_GAP;
}

/** Opacity for a label `distance` world px away: 1 up to LABEL_FADE_START, then linear down to LABEL_MIN_ALPHA at LABEL_RANGE, 0 beyond. */
export function labelAlpha(distance) {
  if (distance > LABEL_RANGE) return 0;
  if (distance <= LABEL_FADE_START) return 1;
  const t = (distance - LABEL_FADE_START) / (LABEL_RANGE - LABEL_FADE_START);
  return 1 - t * (1 - LABEL_MIN_ALPHA);
}

/**
 * Screen rects the labels must never cover, in canvas (960×600 world) px:
 * the top-left gauges (Sanity/Mood bars, rating stars, gard counter), the
 * minimap (drawFpMinimap), the crosshair and its target tooltip
 * (drawFirstPersonCrosshair) and the bottom-centre pointer-lock hint /
 * daily chip / SPRINT text.
 */
export function fpHudRects(viewport) {
  const { width: w, height: h } = viewport;
  return [
    { x: 0, y: 0, w: 450, h: 58 },
    { x: w - 120, y: 0, w: 120, h: 84 },
    { x: w / 2 - 60, y: h / 2 - 16, w: 120, h: 62 },
    { x: w / 2 - 130, y: h - 56, w: 260, h: 56 },
  ];
}

export function rectsOverlap(a, b, pad = 0) {
  return a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
}

function lineSize(line, measure) {
  if (line.type === 'bar') return { w: BAR_W, h: BAR_H };
  if (line.type === 'sub') return { w: measure(line.text, line.font) + 4, h: SUB_H };
  return { w: measure(line.text, line.font) + CHIP_PAD, h: CHIP_H };
}

/**
 * Projects, culls, fades, declutters and orders this frame's label stacks.
 *
 * @param {{id: string, x: number, y: number, height: number, lines: object[]}[]} stacks
 *   world x/y (game px; world Z = y), anchor `height` above the floor, and
 *   `lines` listed top to bottom: `{type: 'chip', text, font, fill?, ink?, pulse?}`,
 *   `{type: 'sub', text, font}` or `{type: 'bar', fraction}`.
 * @param {object} opts
 * @param {{viewProj: number[], position: number[]}} opts.camera  the camera drawScene used this frame
 * @param {{width: number, height: number}} opts.viewport
 * @param {(text: string, font: string) => number} opts.measure  text width in px
 * @param {string|null} [opts.targetId]  the crosshair target's stack id: drawn at full opacity, last, and kept first in the declutter
 * @param {{x, y, w, h}[]} [opts.hud]  rects no label may cover (default fpHudRects); a label under one moves up above it
 * @param {{id, x0, z0, x1, z1, top}[]} [opts.occluders]  station boxes (stationOccluder) that hide labels behind them
 * @returns {{id, x, y, depth, distance, alpha, target: boolean, rect: {x, y, w, h}, lines: object[]}[]}
 *   in draw order (far to near, the target last); each line carries its
 *   centre `cx`/`cy` and size `w`/`h` in screen px.
 */
export function layoutLabels(stacks, { camera, viewport, measure, targetId = null, hud = fpHudRects(viewport), occluders = [] }) {
  const [camX, , camZ] = camera.position;
  const candidates = [];
  for (const s of stacks) {
    const target = s.id === targetId;
    const distance = Math.hypot(s.x - camX, s.y - camZ);
    const alpha = target ? 1 : labelAlpha(distance);
    if (alpha <= 0) continue;
    const p = projectPoint(camera, [s.x, s.height, s.y], viewport);
    if (!p.visible) continue;
    if (!target && isOccluded(camera.position, [s.x, s.height, s.y], occluders, s.id)) continue;
    const lines = s.lines.filter((l) => l.type !== 'bar' || ((target || distance <= BAR_RANGE) && l.fraction != null));
    if (!lines.length) continue;
    const sizes = lines.map((l) => lineSize(l, measure));
    const totalH = sizes.reduce((sum, z) => sum + z.h, 0) + LINE_GAP * (sizes.length - 1);
    const width = Math.max(...sizes.map((z) => z.w));
    const rect = { x: p.x - width / 2, y: p.y - totalH, w: width, h: totalH };
    // Off-screen (wholly or partly): skip rather than draw a clipped chip.
    if (rect.x < 0 || rect.y < 0 || rect.x + rect.w > viewport.width || rect.y + rect.h > viewport.height) continue;
    // A label under a HUD element (the crosshair, usually) moves up clear of it.
    for (const r of hud) {
      if (rectsOverlap(rect, r)) rect.y = Math.min(rect.y, r.y - DECLUTTER_PAD - rect.h);
    }
    if (rect.y < 0) continue;
    let y = rect.y;
    const placedLines = lines.map((l, i) => {
      const { w, h } = sizes[i];
      const line = { ...l, cx: p.x, cy: y + h / 2, w, h };
      y += h + LINE_GAP;
      return line;
    });
    candidates.push({ id: s.id, x: p.x, y: rect.y + rect.h, depth: p.depth, distance, alpha, target, rect, lines: placedLines });
  }
  return declutter(candidates, hud);
}

/**
 * Keeps the target, then nearer labels first; drops any label covering the
 * HUD or a label already kept. Returns the survivors far to near, target last.
 */
export function declutter(candidates, hud = []) {
  const byPriority = [...candidates].sort((a, b) => (b.target - a.target) || (a.depth - b.depth));
  const kept = [];
  for (const c of byPriority) {
    if (hud.some((r) => rectsOverlap(c.rect, r))) continue;
    if (kept.some((k) => rectsOverlap(c.rect, k.rect, DECLUTTER_PAD))) continue;
    kept.push(c);
  }
  return kept.sort((a, b) => (a.target - b.target) || (b.depth - a.depth));
}
