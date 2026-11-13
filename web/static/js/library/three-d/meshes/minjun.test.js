import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMinjun, minjunPoseFor, minjunFace, MOUTH_STEPS, MINJUN_POSES, MINJUN_ART_SIZE,
  paintMinjunBodyArt, paintMinjunHeadArt, paintMinjunPropsArt,
} from './minjun.js';
import { MINJUN_ART, MINJUN_EYE_PX, MINJUN_K, S, modelY, toArt, toModel, uvIn } from './minjun-frame.js';
import { HEAD_RINGS } from './minjun-head.js';
import { TORSO_RINGS, buildHand, HAND, POCKET, BOOK_ARM } from './minjun-body.js';
import { faceNormal } from './geom.js';
import { buildCharacter } from './character.js';
import { FRAME } from './character-frame.js';
import { MINJUN_FRAME, MINJUN_PALETTE as P, MINJUN_ACTIONS, isBlinkingAt } from '../../minjun.js';
import { BASE_EYE, UNIT_SCALE, characterMesh } from '../scene.js';
import { LIBRARY_STAFF_DESIGNS } from '../../library-people.js';
import { buildDrawList, cameraFromPose } from '../core.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);
const POSES = Object.keys(MINJUN_POSES);
const img = (name) => ({ name, width: 1, height: 1 }); // a stand-in image: the mesh only carries it
const ART = () => ({ body: img('body'), head: img('head'), props: img('props') });
const top = (m) => Math.max(...m.vertices.map((v) => v[1]));
const SKIN = new Set([P.skin, P.skinShade, P.skinDeep]);
const MINJUN_DESIGN = LIBRARY_STAFF_DESIGNS.find((d) => d.key === 'minjun');

test('his eyes are at the player\'s eye line: MINJUN_EYE_PX is scene.js\'s BASE_EYE', () => {
  assert.equal(MINJUN_EYE_PX, BASE_EYE);
  near(modelY(MINJUN_FRAME.eye) * UNIT_SCALE, BASE_EYE);
  near(MINJUN_K, BASE_EYE / (MINJUN_FRAME.ground - MINJUN_FRAME.eye));
});

test('art and model coordinates convert both ways; the sole is the floor', () => {
  near(toModel(0, MINJUN_FRAME.ground)[1], 0);
  const [x, y] = toArt(toModel(3.5, -27, 2));
  near(x, 3.5);
  near(y, -27);
  near(toModel(0, 0, 2)[2], 2 * S);
});

test('his own proportions: about 2.5 heads tall (a patron is 3.36), standing on the floor, a little taller than an adult patron', () => {
  for (const pose of POSES) {
    const m = buildMinjun({ pose });
    near(Math.min(...m.vertices.map((v) => v[1])), 0);
    const height = top(m) * UNIT_SCALE;
    near(height, (MINJUN_FRAME.ground - MINJUN_FRAME.crown) * MINJUN_K, 0.5);
    const patron = FRAME.crown * UNIT_SCALE;
    assert.ok(height > patron && height < patron * 1.15, `${height} px against a patron's ${patron}`);
  }
  const heads = (MINJUN_FRAME.ground - MINJUN_FRAME.crown) / (MINJUN_FRAME.chin - MINJUN_FRAME.crown);
  assert.ok(heads > 2.4 && heads < 2.7, `${heads} heads`);
});

test('the head follows his 2D silhouette: widest at drawHair\'s crown, chin set forward', () => {
  const m = buildMinjun({});
  const headVerts = m.vertices.filter((v) => v[1] > modelY(MINJUN_FRAME.chin) - 1e-9);
  const maxX = Math.max(...headVerts.map((v) => Math.abs(v[0])));
  const widest = Math.max(...HEAD_RINGS.map((r) => r.hw));
  // A 12-gon of radius hw / cos(15deg) has a flat face on the x axis, so it spans exactly hw.
  near(maxX, widest * S, 1e-6);
  assert.equal(HEAD_RINGS[0].y, MINJUN_FRAME.chin);
  assert.ok(HEAD_RINGS[0].cz > 0, 'the chin leads');
  near(HEAD_RINGS.at(-1).y, MINJUN_FRAME.crown, 0.5);
});

test('the torso follows torsoPath: shoulders at 11.5 either side, the shirt\'s neck at the top', () => {
  assert.equal(Math.max(...TORSO_RINGS.map((r) => r.hw)), 11.5);
  assert.equal(TORSO_RINGS.at(-1).color, P.shirt);
  assert.ok(TORSO_RINGS.some((r) => r.color === P.vest));
});

test('minjunPoseFor: walking puts a hand in his pocket; read, wave and help raise an arm; humming and standing are idle', () => {
  assert.equal(minjunPoseFor({ walking: true, action: 'read' }), 'walk');
  assert.equal(minjunPoseFor({ walking: false, action: 'read' }), 'read');
  assert.equal(minjunPoseFor({ walking: false, action: 'wave' }), 'wave');
  assert.equal(minjunPoseFor({ walking: false, action: 'help' }), 'wave');
  assert.equal(minjunPoseFor({ walking: false, action: 'hum' }), 'idle');
  assert.equal(minjunPoseFor({ walking: false, action: null }), 'idle');
  for (const action of MINJUN_ACTIONS) assert.ok(POSES.includes(minjunPoseFor({ action })));
});

test('minjunFace: blinks on Top-Down\'s clock, talks in MOUTH_STEPS steps, hums with closed eyes, and walking drops the action', () => {
  const blinkT = 0.05;
  const openT = 1;
  assert.equal(isBlinkingAt(blinkT), true);
  assert.equal(isBlinkingAt(openT), false);
  assert.equal(minjunFace({ t: blinkT }).face.blink, true);
  assert.equal(minjunFace({ t: openT }).face.blink, false);
  assert.notEqual(minjunFace({ t: blinkT }).key, minjunFace({ t: openT }).key);
  // Talking: the mouth is cut into steps, so its keys are few.
  const keys = new Set();
  for (let at = 0; at < 3; at += 0.01) {
    const { face, key } = minjunFace({ t: openT, action: 'wave', actionT: at });
    keys.add(key);
    near(face.mouth * MOUTH_STEPS, Math.round(face.mouth * MOUTH_STEPS));
  }
  assert.ok(keys.size <= MOUTH_STEPS + 1, `${keys.size} face keys`);
  const hum = minjunFace({ t: blinkT, action: 'hum', actionT: 0.4 }).face;
  assert.equal(hum.eyesClosed, true);
  assert.equal(hum.round, true);
  assert.equal(hum.blink, false);
  assert.equal(minjunFace({ t: openT, walking: true, action: 'wave', actionT: 0.2 }).face.mouth, null);
});

test('memoised per art and pose: the same mesh comes back, a new pose or new art builds another', () => {
  const art = ART();
  for (const pose of POSES) assert.equal(buildMinjun({ pose, art }), buildMinjun({ pose, art }));
  assert.notEqual(buildMinjun({ pose: 'idle', art }), buildMinjun({ pose: 'read', art }));
  assert.notEqual(buildMinjun({ pose: 'idle', art }), buildMinjun({ pose: 'idle', art: ART() }));
  assert.equal(buildMinjun({ pose: 'idle' }), buildMinjun({}));
});

test('poses move only his free arm (and the read pose\'s open book): his left side is identical in every pose', () => {
  // The book arm, the books and everything right of centre stay put.
  const right = (m) => m.vertices.filter((v) => v[0] > 0.2).map((v) => v.join()).sort().join('|');
  const base = right(buildMinjun({ pose: 'idle' }));
  for (const pose of POSES) assert.equal(right(buildMinjun({ pose })), base, pose);
});

test('a face budget: under 500 faces in every pose', () => {
  for (const pose of POSES) assert.ok(buildMinjun({ pose }).faces.length < 500, pose);
});

test('buildHand: a flat palm, four fingers and a thumb, all in his skin tones, reaching past the wrist along `dir`', () => {
  const wrist = [-12.6, -17.4, 1.5];
  const m = buildHand(wrist, { dir: [0, 1, 0], side: [1, 0, 0], thumb: 1 });
  // Palm: 8 sides + 2 caps; four fingers and the thumb: 4 sides + a tip each.
  assert.equal(m.faces.length, 10 + 5 * 5);
  for (const f of m.faces) assert.ok(SKIN.has(f.color), f.color);
  const art = m.vertices.map(toArt);
  const ys = art.map((p) => p[1]);
  const xs = art.map((p) => p[0] - wrist[0]);
  // Fingers down: from just above the wrist to palm + finger below it.
  near(Math.min(...ys), wrist[1] - 0.5, 0.05);
  near(Math.max(...ys), wrist[1] + HAND.palm + HAND.finger, 0.05);
  // Wider than thick, and the thumb sticks out on the + side only.
  const zs = m.vertices.map((v) => v[2] / S - wrist[2]);
  assert.ok(Math.max(...xs) > HAND.width + 1, 'thumb');
  assert.ok(Math.min(...xs) > -HAND.width - 0.01);
  assert.ok(Math.max(...zs) < HAND.width * HAND.thick + 0.7);
  // Mirrored thumb.
  const left = buildHand(wrist, { dir: [0, 1, 0], side: [1, 0, 0], thumb: -1 });
  assert.ok(Math.min(...left.vertices.map((v) => toArt(v)[0] - wrist[0])) < -HAND.width - 1);
});

test('every pose shows his hands: a hand on the free arm (the pocket and its hooked thumb when walking, the book art when reading) and one round the books', () => {
  const below = (m, y) => m.faces.filter((f) => SKIN.has(f.color) && f.indices.every((i) => toArt(m.vertices[i])[1] > y));
  for (const pose of POSES) {
    const m = buildMinjun({ pose });
    // The book hand: skin right of the last spine's left edge, in front of the books.
    const bookHand = m.faces.filter((f) => SKIN.has(f.color) && f.indices.every((i) => toArt(m.vertices[i])[0] > BOOK_ARM.wrist[0] - 1 && m.vertices[i][2] > 0));
    assert.ok(bookHand.length >= 30, `:  book-hand faces`);
    const p = MINJUN_POSES[pose];
    if (p.hand === 'pocket') {
      assert.equal(m.faces.filter((f) => f.color === POCKET.color).length, 8, 'the pocket bulge');
      assert.ok(below(m, POCKET.thumbFrom[1] - 1).length >= 5, 'the thumb');
    } else {
      assert.equal(m.faces.filter((f) => f.color === POCKET.color).length, 0);
    }
  }
  // Standing, the hand hangs below the wrist; waving, it is above it.
  const y = (pose) => { const m = buildMinjun({ pose }); const w = MINJUN_POSES[pose].wrist; return m.vertices.map(toArt).filter((q) => Math.abs(q[0] - w[0]) < 2.2).map((q) => q[1]); };
  assert.ok(Math.max(...y('idle')) > MINJUN_POSES.idle.wrist[1] + 4);
  assert.ok(Math.min(...y('wave')) < MINJUN_POSES.wave.wrist[1] - 4);
});

test('the material rule: every skin-toned face is unlit; clothes are lit; the whole head is unlit', () => {
  for (const pose of POSES) {
    const m = buildMinjun({ pose });
    for (const f of m.faces) if (SKIN.has(f.color)) assert.equal(f.unlit, true, `${pose} ${f.color}`);
    const lit = m.faces.filter((f) => !f.unlit);
    assert.ok(lit.length > 50, 'his clothes stay lit');
    for (const f of lit) assert.ok(!SKIN.has(f.color));
  }
  const chinY = modelY(MINJUN_FRAME.chin);
  const m = buildMinjun({});
  const head = m.faces.filter((f) => f.indices.every((i) => m.vertices[i][1] >= chinY - 1e-9) && f.indices.some((i) => m.vertices[i][1] > modelY(MINJUN_FRAME.eye)));
  assert.ok(head.length > 60, `${head.length} head faces`);
  for (const f of head.filter((f) => f.color === P.hair || f.color === P.hairShade || SKIN.has(f.color))) assert.equal(f.unlit, true);
});

test('without art: the flat fallback, no textures, every colour a hex', () => {
  for (const pose of POSES) {
    for (const f of buildMinjun({ pose }).faces) {
      assert.equal(f.texture, undefined);
      assert.match(f.color, /^#[0-9a-f]{6}$/i);
    }
  }
});

test('with art: only faces turned toward the viewer wear it, unlit, sampling inside their own canvas', () => {
  const art = ART();
  const sizes = new Map([[art.body, MINJUN_ART_SIZE.body], [art.head, MINJUN_ART_SIZE.head], [art.props, MINJUN_ART_SIZE.props]]);
  for (const pose of POSES) {
    const m = buildMinjun({ pose, art });
    const textured = m.faces.filter((f) => f.texture);
    assert.ok(textured.length > 60 && textured.length < 140, `${pose}: ${textured.length} textured`);
    const used = new Set(textured.map((f) => f.texture.image));
    assert.ok(used.has(art.body) && used.has(art.head) && used.has(art.props));
    for (const f of textured) {
      assert.equal(f.unlit, true);
      assert.equal(f.indices.length, 4);
      assert.ok(faceNormal(m, f)[2] >= 0.3 - 1e-9, 'faces the viewer');
      const { w, h } = sizes.get(f.texture.image);
      for (const [u, v] of f.texture.uv) assert.ok(u >= 0 && u <= w && v >= 0 && v <= h, `${u},${v} on ${w}x${h}`);
    }
    // The back of him never wears the front's art.
    for (const f of m.faces) if (faceNormal(m, f)[2] < 0) assert.equal(f.texture, undefined);
  }
});

test('the face is projected straight on: a vertex shows the head art at its own art x, y', () => {
  const art = ART();
  const m = buildMinjun({ art });
  const uv = uvIn(MINJUN_ART.head);
  const f = m.faces.find((x) => x.texture?.image === art.head);
  f.indices.forEach((i, k) => assert.deepEqual(f.texture.uv[k], uv(m.vertices[i])));
  // The eye line lands on EYE_Y's row of the canvas.
  const [, v] = uv(toModel(0, MINJUN_FRAME.eye));
  near(v, (MINJUN_FRAME.eye - MINJUN_ART.head.y0) * MINJUN_ART.head.scale);
});

test('deterministic: the same geometry with or without art, build after build', () => {
  const verts = (art) => JSON.stringify(buildMinjun({ pose: 'read', art }).vertices);
  assert.equal(verts(ART()), verts(ART()));
  assert.equal(verts(ART()), verts(undefined));
});

test('scene.characterMesh: Min-jun gets his own mesh, posed and wearing his art; everyone else buildCharacter', () => {
  const art = ART();
  assert.equal(characterMesh({ design: MINJUN_DESIGN, pose: 'wave', art }), buildMinjun({ pose: 'wave', art }));
  assert.equal(characterMesh({ design: MINJUN_DESIGN }), buildMinjun({}));
  const other = LIBRARY_STAFF_DESIGNS.find((d) => d.key !== 'minjun');
  assert.equal(characterMesh({ design: other }), buildCharacter(other));
});

test('he renders from the front, the side and behind, and his face is in the list head-on', () => {
  const art = ART();
  for (const yaw of [0, 0.7, Math.PI / 2, Math.PI]) {
    const cam = cameraFromPose({ x: Math.sin(yaw) * 90, y: Math.cos(yaw) * 90, facing: -yaw }, { eyeHeight: 60, fov: 1, aspect: 0.8, near: 1, far: 2000 });
    const polys = buildDrawList(cam, [{ mesh: buildMinjun({ art }), placement: { pos: [0, 0, 0], yaw: 0, scale: UNIT_SCALE } }], { viewport: { width: 400, height: 500 }, light: { dir: [0.35, 1, 0.25], ambient: 0.5 } });
    assert.ok(polys.length > 100, `yaw ${yaw}: ${polys.length}`);
    const faceCells = polys.filter((p) => p.image === art.head);
    if (yaw === 0) assert.ok(faceCells.length >= 10, 'his face, head-on');
  }
});

// A recording canvas.
function recorder() {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (t, k) => {
      if (k in t) return t[k];
      if (k === 'measureText') return (s) => ({ width: s.length * 2 });
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return (...a) => { calls.push([k, ...a]); return { addColorStop: () => {} }; };
      return (...a) => calls.push([k, ...a]);
    },
    set: (t, k, v) => { calls.push(['set', k, v]); t[k] = v; return true; },
  });
  return { ctx, calls };
}

test('paint*Art: an opaque backing over the whole canvas first, then the 2D drawing at its art scale', () => {
  for (const [paint, box, size] of [
    [paintMinjunBodyArt, MINJUN_ART.body, MINJUN_ART_SIZE.body],
    [(c) => paintMinjunHeadArt(c, { mouth: null, blink: false }), MINJUN_ART.head, MINJUN_ART_SIZE.head],
    [paintMinjunPropsArt, MINJUN_ART.props, MINJUN_ART_SIZE.props],
  ]) {
    const { ctx, calls } = recorder();
    paint(ctx);
    const scaleAt = calls.findIndex((c) => c[0] === 'scale');
    assert.deepEqual(calls[scaleAt], ['scale', box.scale, box.scale]);
    const backing = calls.slice(0, scaleAt).filter((c) => c[0] === 'fillRect');
    // Bands that together cover every row, full width, in opaque hex colours.
    let covered = 0;
    for (const [, x, y, w, h] of backing) {
      assert.equal(x, 0);
      assert.equal(w, size.w);
      near(y, covered, 1e-6);
      covered = y + h;
    }
    near(covered, size.h, 1e-6);
    for (const c of calls.slice(0, scaleAt)) if (c[0] === 'set' && c[1] === 'fillStyle') assert.match(c[2], /^#[0-9a-f]{6}$/i);
    assert.ok(calls.length - scaleAt > 200, 'then the drawing itself');
  }
});

test('the head canvas shows the face asked for: a blink and an open mouth draw differently', () => {
  const draw = (face) => { const r = recorder(); paintMinjunHeadArt(r.ctx, face); return JSON.stringify(r.calls); };
  const open = draw({ mouth: null, blink: false });
  assert.notEqual(draw({ mouth: null, blink: true }), open);
  assert.notEqual(draw({ mouth: 2 / 3, blink: false }), open);
  assert.equal(draw({ mouth: null, blink: false }), open);
});
