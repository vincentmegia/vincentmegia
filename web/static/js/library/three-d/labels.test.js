import test from 'node:test';
import assert from 'node:assert/strict';
import { cameraFromPose } from './core.js';
import { BASE_EYE, NEAR, FAR, UNIT_SCALE } from './scene.js';
import { buildCharacter } from './meshes/character.js';
import {
  LABEL_RANGE, LABEL_FADE_START, LABEL_MIN_ALPHA, BAR_RANGE, ANCHOR_GAP, PERSON_TOP,
  meshTop, stationTop, characterAnchorHeight, stationAnchorHeight, labelAlpha,
  fpHudRects, rectsOverlap, layoutLabels, declutter, stationOccluder, isOccluded,
} from './labels.js';

const VP = { width: 960, height: 600 };
const cam = (x, y, facing = 0) => cameraFromPose({ x, y, facing }, {
  eyeHeight: BASE_EYE, fov: Math.PI / 3, aspect: VP.width / VP.height, near: NEAR, far: FAR,
});
const measure = (text) => text.length * 6;
const chip = (text) => ({ type: 'chip', text, font: 'bold 11px sans-serif' });
const stack = (id, x, y, lines, height = 90) => ({ id, x, y, height, lines });
// The player stands at (480, 500) facing north (−y), so "ahead" is smaller y.
const at = (opts = {}) => ({ camera: cam(480, 500), viewport: VP, measure, hud: [], ...opts });

test('meshTop is the highest vertex', () => {
  assert.equal(meshTop({ vertices: [[0, 0, 0], [1, 2.5, 0], [0, 1, 1]], faces: [] }), 2.5);
});

test('anchor heights sit just above the drawn mesh', () => {
  // A bookshelf mesh is 2 units tall; the elevator's wall is taller than the shelf.
  assert.equal(stationTop('bookshelf'), 2 * UNIT_SCALE);
  assert.ok(stationTop('elevator') > stationTop('bookshelf'));
  assert.equal(stationAnchorHeight('bookshelf'), 2 * UNIT_SCALE + ANCHOR_GAP);
  assert.equal(stationTop('no-such-kind'), 40); // scene.js's plain station box
  const adult = buildCharacter(null);
  const h = characterAnchorHeight(adult);
  assert.ok(Math.abs(h - (PERSON_TOP + ANCHOR_GAP)) < 6, `adult anchor ${h} near the frame's crown`);
  assert.equal(characterAnchorHeight(null), PERSON_TOP + ANCHOR_GAP);
  assert.ok(PERSON_TOP > BASE_EYE, 'a head label is above eye height');
});

test('labelAlpha: opaque near, fading to the floor at range, gone beyond', () => {
  assert.equal(labelAlpha(0), 1);
  assert.equal(labelAlpha(LABEL_FADE_START), 1);
  assert.ok(Math.abs(labelAlpha(LABEL_RANGE) - LABEL_MIN_ALPHA) < 1e-9);
  const mid = labelAlpha((LABEL_FADE_START + LABEL_RANGE) / 2);
  assert.ok(mid < 1 && mid > LABEL_MIN_ALPHA);
  assert.equal(labelAlpha(LABEL_RANGE + 1), 0);
});

test('a label ahead projects on screen, centred, its stack ending at the anchor', () => {
  const [l] = layoutLabels([stack('a', 480, 300, [chip('Front Desk')])], at());
  assert.equal(l.id, 'a');
  assert.ok(Math.abs(l.x - VP.width / 2) < 1e-6);
  assert.ok(l.y < VP.height / 2, 'above the horizon: the anchor is above eye height');
  assert.ok(Math.abs(l.rect.y + l.rect.h - l.y) < 1e-6);
  assert.equal(l.lines[0].w, 'Front Desk'.length * 6 + 14);
});

test('labels behind the camera, out of range or off-screen are skipped', () => {
  const out = layoutLabels([
    stack('behind', 480, 700, [chip('x')]),
    stack('far', 480, 500 - LABEL_RANGE - 20, [chip('x')]),
    stack('side', 80, 480, [chip('x')]), // nearly beside the player: projects past the left edge
  ], at());
  assert.deepEqual(out.map((l) => l.id), []);
});

test('the crosshair target is kept beyond range, at full opacity', () => {
  const far = stack('t', 480, 500 - LABEL_RANGE - 100, [chip('x')]);
  assert.equal(layoutLabels([far], at()).length, 0);
  const [l] = layoutLabels([far], at({ targetId: 't' }));
  assert.equal(l.alpha, 1);
  assert.equal(l.target, true);
});

test('patience bars only within BAR_RANGE (or on the target); null fractions never', () => {
  const lines = [chip('Waiting'), { type: 'bar', fraction: 0.5 }];
  const near = layoutLabels([stack('n', 480, 500 - (BAR_RANGE - 20), lines)], at())[0];
  assert.deepEqual(near.lines.map((l) => l.type), ['chip', 'bar']);
  const far = layoutLabels([stack('f', 480, 500 - (BAR_RANGE + 40), lines)], at())[0];
  assert.deepEqual(far.lines.map((l) => l.type), ['chip']);
  const tgt = layoutLabels([stack('f', 480, 500 - (BAR_RANGE + 40), lines)], at({ targetId: 'f' }))[0];
  assert.deepEqual(tgt.lines.map((l) => l.type), ['chip', 'bar']);
  const none = layoutLabels([stack('z', 480, 400, [chip('a'), { type: 'bar', fraction: null }])], at())[0];
  assert.deepEqual(none.lines.map((l) => l.type), ['chip']);
});

test('lines stack top to bottom without overlapping', () => {
  const [l] = layoutLabels([stack('s', 480, 400, [chip('Name'), { type: 'sub', text: 'sub', font: '7px' }, { type: 'bar', fraction: 1 }])], at());
  for (let i = 1; i < l.lines.length; i++) {
    const a = l.lines[i - 1];
    const b = l.lines[i];
    assert.ok(a.cy + a.h / 2 <= b.cy - b.h / 2, `line ${i - 1} ends above line ${i}`);
  }
});

test('declutter drops the farther of two overlapping labels and keeps the target first', () => {
  const near = stack('near', 480, 350, [chip('Near label')]);
  const far = stack('far', 482, 250, [chip('Far label')], 110);
  const both = layoutLabels([far, near], at());
  // Same screen column, overlapping? Check, then assert who won.
  const all = [layoutLabels([near], at())[0], layoutLabels([far], at())[0]];
  if (rectsOverlap(all[0].rect, all[1].rect, 2)) {
    assert.deepEqual(both.map((l) => l.id), ['near']);
    assert.deepEqual(layoutLabels([far, near], at({ targetId: 'far' })).map((l) => l.id), ['far']);
  } else {
    assert.fail('fixture labels should overlap');
  }
});

test('declutter orders far to near with the target last, and respects the HUD', () => {
  const mk = (id, depth, x, target = false) => ({ id, depth, target, rect: { x, y: 200, w: 40, h: 16 } });
  const out = declutter([mk('mid', 200, 100), mk('t', 300, 300, true), mk('far', 400, 500), mk('near', 100, 700)]);
  assert.deepEqual(out.map((c) => c.id), ['far', 'mid', 'near', 't']);
  const hud = [{ x: 90, y: 190, w: 20, h: 20 }];
  assert.deepEqual(declutter([mk('a', 100, 100), mk('b', 200, 500)], hud).map((c) => c.id), ['b']);
});

test('fpHudRects cover the gauges, minimap and crosshair', () => {
  const rects = fpHudRects(VP);
  const inAny = (x, y) => rects.some((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  assert.ok(inAny(20, 20), 'top-left gauges');
  assert.ok(inAny(VP.width - 60, 40), 'minimap');
  assert.ok(inAny(VP.width / 2, VP.height / 2), 'crosshair');
  assert.ok(inAny(VP.width / 2, VP.height - 20), 'pointer-lock hint');
  assert.ok(!inAny(VP.width / 2, VP.height / 3), 'the view above the crosshair is free for labels');
});

test('stationOccluder uses the mesh bounds, or the plain box for a kind without a mesh', () => {
  const shelf = stationOccluder({ id: 's', kind: 'bookshelf', x: 100, y: 200 });
  assert.equal(shelf.top, 2 * UNIT_SCALE);
  assert.ok(Math.abs(shelf.x1 - shelf.x0 - 1.0 * UNIT_SCALE) < 1.5, 'a bookcase is about one unit wide');
  assert.ok(shelf.x0 < 100 && shelf.x1 > 100 && shelf.z0 < 200 && shelf.z1 > 200);
  assert.deepEqual(stationOccluder({ id: 'b', kind: 'no-such-kind', x: 0, y: 0, w: 20, h: 10 }), { id: 'b', x0: -10, x1: 10, z0: -5, z1: 5, top: 40 });
});

test('isOccluded: a tall box between eye and anchor hides it; a low one, its own box or one off the line do not', () => {
  const eye = [0, BASE_EYE, 0];
  const anchor = [0, 90, -300];
  const wall = { id: 'w', x0: -20, x1: 20, z0: -160, z1: -140, top: 80 };
  assert.equal(isOccluded(eye, anchor, [wall]), true);
  assert.equal(isOccluded(eye, anchor, [{ ...wall, top: 40 }]), false, 'below the sight line');
  assert.equal(isOccluded(eye, anchor, [wall], 'w'), false, 'the label\'s own station');
  assert.equal(isOccluded(eye, anchor, [{ ...wall, x0: 50, x1: 90 }]), false, 'beside the line');
  assert.equal(isOccluded(eye, anchor, [{ ...wall, z0: -400, z1: -350 }]), false, 'beyond the anchor');
});

test('layoutLabels hides an occluded label unless it is the crosshair target', () => {
  const s = stack('p', 480, 200, [chip('Patron')]);
  const wall = { id: 'w', x0: 440, x1: 520, z0: 330, z1: 350, top: 200 };
  assert.equal(layoutLabels([s], at({ occluders: [wall] })).length, 0);
  assert.equal(layoutLabels([s], at({ occluders: [wall], targetId: 'p' })).length, 1);
});

test('a label under the crosshair moves up clear of it instead of vanishing', () => {
  const hud = fpHudRects(VP);
  // Anchored just above eye height, far ahead: it projects onto the crosshair.
  const s = stack('n', 480, 100, [chip('Reading Nook')], BASE_EYE + 2);
  const [l] = layoutLabels([s], at({ hud }));
  assert.ok(l, 'still drawn');
  assert.ok(!hud.some((r) => rectsOverlap(l.rect, r)), 'clear of the HUD');
  assert.ok(l.lines[0].cy + l.lines[0].h / 2 <= l.rect.y + l.rect.h + 1e-6);
});
