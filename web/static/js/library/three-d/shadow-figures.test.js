import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shadowFigureAlpha, billboardYaw, shadowFigurePlacements } from './shadow-figures.js';
import { buildShadowFigure, SHADOW_FIGURE_COLORS, SHADOW_FIGURE_HEIGHT } from './meshes/shadow-figure.js';
import { UNIT_SCALE } from './scene.js';
import { buildDrawList, cameraFromPose } from './core.js';

const fig = (over = {}) => ({ x: 300, y: 200, age: 0.5, life: 1, ...over });

test('alpha fades in and out over the life and peaks at 0.55 mid-life', () => {
  // t chosen so sin(t * 30) = 1: the flicker's top.
  const t = Math.PI / 60;
  assert.ok(Math.abs(shadowFigureAlpha(fig({ age: 0.5 }), t) - 0.55) < 1e-9);
  assert.ok(Math.abs(shadowFigureAlpha(fig({ age: 0 }), t)) < 1e-9);
  assert.ok(shadowFigureAlpha(fig({ age: 0.1 }), t) < shadowFigureAlpha(fig({ age: 0.4 }), t));
});

test('alpha flickers between 40% and 100% of its fade', () => {
  const low = shadowFigureAlpha(fig(), -Math.PI / 60); // sin = -1
  const high = shadowFigureAlpha(fig(), Math.PI / 60);
  assert.ok(Math.abs(low / high - 0.4) < 1e-9, `${low / high}`);
});

test('Top-Down draws the figures with the same alpha function', () => {
  // One formula, two cameras: the 2D path must call shadowFigureAlpha, not a copy.
  const src = readFileSync(new URL('../../library-game.js', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('function drawHallucinations('), src.indexOf('// Pulsing vignette'));
  assert.match(body, /shadowFigureAlpha\(f, t\)/);
  assert.doesNotMatch(body, /Math\.sin\(\(f\.age/);
});

test('billboard yaw turns the mesh +Z face toward the viewer', () => {
  const from = { x: 100, y: 100 };
  for (const viewer of [{ x: 100, y: 300 }, { x: 400, y: 100 }, { x: -50, y: -80 }, { x: 160, y: 20 }]) {
    const yaw = billboardYaw(from, viewer);
    // Model +Z under the scene's placement (core.js modelPoint).
    const facing = [Math.sin(yaw), Math.cos(yaw)];
    const toViewer = [viewer.x - from.x, viewer.y - from.y];
    const len = Math.hypot(...toViewer);
    const cos = (facing[0] * toViewer[0] + facing[1] * toViewer[1]) / len;
    assert.ok(Math.abs(cos - 1) < 1e-9, `viewer ${JSON.stringify(viewer)}: cos ${cos}`);
  }
});

test('one placement per figure, standing on the floor at its own x/y', () => {
  const figures = [fig({ x: 300, y: 200 }), fig({ x: 520, y: 410, age: 0.3, life: 1.5 })];
  const placed = shadowFigurePlacements(figures, { x: 480, y: 520 }, 0);
  assert.equal(placed.length, 2);
  assert.deepEqual(placed[0].placement.pos, [300, 0, 200]);
  assert.deepEqual(placed[1].placement.pos, [520, 0, 410]);
  for (const [i, p] of placed.entries()) {
    assert.equal(p.placement.scale, UNIT_SCALE);
    assert.equal(p.mesh, buildShadowFigure(), 'every figure shares one mesh');
    assert.ok(Math.abs(p.placement.alpha - shadowFigureAlpha(figures[i], 0)) < 1e-12);
    assert.ok(Math.abs(p.placement.yaw - billboardYaw(figures[i], { x: 480, y: 520 })) < 1e-12);
  }
});

test('a figure at zero opacity (the instant it spawns) is left out', () => {
  assert.equal(shadowFigurePlacements([fig({ age: 0 })], { x: 0, y: 0 }, 0).length, 0);
  assert.equal(shadowFigurePlacements([], { x: 0, y: 0 }, 0).length, 0);
});

test('the mesh is the 2D silhouette: 75 px tall on its feet, dark body, red eyes', () => {
  const mesh = buildShadowFigure();
  const ys = mesh.vertices.map((v) => v[1] * UNIT_SCALE);
  assert.ok(Math.abs(Math.min(...ys)) < 1e-9, 'feet on the floor');
  assert.ok(Math.abs(Math.max(...ys) - 75) < 1e-9, `top ${Math.max(...ys)}`);
  assert.ok(Math.abs(SHADOW_FIGURE_HEIGHT * UNIT_SCALE - 75) < 1e-9);
  const xs = mesh.vertices.map((v) => v[0] * UNIT_SCALE);
  assert.ok(Math.abs(Math.min(...xs) + 18) < 0.5 && Math.abs(Math.max(...xs) - 18) < 0.5, 'body 36 px wide, like the 2D');
  const colors = mesh.faces.map((f) => f.color);
  assert.equal(colors.filter((c) => c === SHADOW_FIGURE_COLORS.body).length, 2, 'body + head');
  assert.equal(colors.filter((c) => c === SHADOW_FIGURE_COLORS.eyes).length, 2, 'two eyes');
  assert.ok(mesh.faces.every((f) => f.unlit && !f.cull), 'flat, unshaded, visible from either side');
  // Same colours as the 2D drawer.
  const src = readFileSync(new URL('../../library-game.js', import.meta.url), 'utf8');
  const drawer = src.slice(src.indexOf('function drawShadowFigure('), src.indexOf('function drawHallucinations('));
  assert.ok(drawer.includes(`'${SHADOW_FIGURE_COLORS.body}'`) && drawer.includes(`'${SHADOW_FIGURE_COLORS.eyes}'`));
});

test('the eyes sort in front of the head from the viewer the figure faces', () => {
  const viewer = { x: 480, y: 520 };
  const placed = shadowFigurePlacements([fig({ x: 470, y: 380 })], viewer, 0);
  const camera = cameraFromPose({ x: viewer.x, y: viewer.y, facing: 0 }, { eyeHeight: 60, fov: 1, aspect: 1.6, near: 1, far: 2000 });
  const list = buildDrawList(camera, placed, {
    viewport: { width: 960, height: 600 }, light: { dir: [0, -1, 0], ambient: 1 }, fog: null,
  });
  assert.equal(list.length, 4, 'body, head and two eyes all in front of the camera');
  // Painted back to front: the two eyes come last.
  assert.deepEqual(list.slice(2).map((p) => p.color), ['rgb(255,80,80)', 'rgb(255,80,80)']);
  assert.ok(list.every((p) => Math.abs(p.alpha - placed[0].placement.alpha) < 1e-12), 'alpha threads to every poly');
});
