import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTransition,
  updateTransition,
  transitionCamera,
  forceComplete,
  ELEVATOR_DURATIONS,
  STAIRS_DURATION,
  STAIRS_STEPS,
} from './transitions.js';
import { STAIR_RISE_PER_STEP, STAIR_RUN_PER_STEP } from './meshes/stairs.js';

const POSE = { x: 0, y: 0, facing: 0 };
const DT = 0.01;

function run(state, maxSeconds = 5) {
  const log = [];
  let s = state;
  for (let i = 0; i < maxSeconds / DT && s.phase !== 'done'; i++) {
    s = updateTransition(s, DT);
    log.push(s);
  }
  return log;
}

test('createTransition initial state', () => {
  const e = createTransition('elevator', 3);
  assert.equal(e.kind, 'elevator');
  assert.equal(e.targetFloor, 3);
  assert.equal(e.phase, 'doors-close');
  assert.equal(e.t, 0);
  assert.equal(e.floorSwitched, false);
  assert.equal(createTransition('stairs', 1).phase, 'travel');
});

test('elevator phase sequence and total duration', () => {
  const log = run(createTransition('elevator', 2));
  const seq = [];
  for (const s of log) if (seq[seq.length - 1] !== s.phase) seq.push(s.phase);
  assert.deepEqual(seq, ['doors-close', 'rise', 'doors-open', 'done']);
  const total = ELEVATOR_DURATIONS.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - 2.0) < 1e-9);
  assert.ok(log.length * DT >= total - 0.02 && log.length * DT <= total + 0.03);
});

test('stairs phase sequence over ~1.5s', () => {
  const log = run(createTransition('stairs', 2));
  assert.deepEqual([...new Set(log.map((s) => s.phase))], ['travel', 'done']);
  assert.ok(Math.abs(log.length * DT - STAIRS_DURATION) < 0.03);
  assert.equal(STAIRS_DURATION, 1.5);
});

test('updateTransition does not mutate input', () => {
  const s = createTransition('elevator', 1);
  const copy = { ...s };
  updateTransition(s, 0.3);
  assert.deepEqual(s, copy);
});

test('floor switch fires on exactly one update, both kinds', () => {
  for (const kind of ['elevator', 'stairs']) {
    const log = run(createTransition(kind, 2));
    const n = log.filter((s) => transitionCamera(s, POSE).floorSwitched).length;
    assert.equal(n, 1, kind);
  }
});

test('elevator switch commits on entering doors-open', () => {
  const log = run(createTransition('elevator', 2));
  const s = log.find((x) => x.justSwitched);
  assert.equal(s.phase, 'doors-open');
});

test('large dt still switches exactly once', () => {
  let s = updateTransition(createTransition('elevator', 2), 10);
  assert.equal(s.phase, 'done');
  assert.equal(s.justSwitched, true);
  s = updateTransition(s, 1);
  assert.equal(s.justSwitched, false);
});

test('transitionCamera is pure for the same state', () => {
  const s = updateTransition(createTransition('elevator', 2), 0.7);
  assert.deepEqual(transitionCamera(s, POSE), transitionCamera(s, POSE));
});

test('doorOpen: 0 at start, rises to ~1 in doors-open', () => {
  const s0 = createTransition('elevator', 2);
  assert.equal(transitionCamera(s0, POSE).doorOpen, 0);
  const log = run(s0);
  const rise = log.find((s) => s.phase === 'rise');
  assert.equal(transitionCamera(rise, POSE).doorOpen, 0);
  const opening = log.filter((s) => s.phase === 'doors-open');
  assert.ok(transitionCamera(opening[Math.floor(opening.length / 2)], POSE).doorOpen > 0);
  const last = log[log.length - 1];
  assert.equal(last.phase, 'done');
  assert.ok(Math.abs(transitionCamera(last, POSE).doorOpen - 1) < 1e-9);
  assert.equal(transitionCamera(createTransition('stairs', 2), POSE).doorOpen, 0);
});

test('stairs camera climbs steps * rise and advances steps * run', () => {
  const log = run(createTransition('stairs', 2));
  const end = transitionCamera(log[log.length - 1], POSE).posOffset;
  assert.ok(Math.abs(end.y - STAIRS_STEPS * STAIR_RISE_PER_STEP) < 1e-9);
  assert.ok(Math.abs(Math.hypot(end.x, end.z) - STAIRS_STEPS * STAIR_RUN_PER_STEP) < 1e-9);
  const start = transitionCamera(createTransition('stairs', 2), POSE).posOffset;
  assert.deepEqual(start, { x: 0, y: 0, z: 0 });
  let prev = 0;
  for (const s of log) {
    const y = transitionCamera(s, POSE).posOffset.y;
    assert.ok(y >= prev - 1e-12);
    prev = y;
  }
});

test('elevator rises in y during rise', () => {
  const log = run(createTransition('elevator', 2));
  const ys = log.map((s) => transitionCamera(s, POSE).posOffset.y);
  assert.ok(Math.max(...ys) > 0);
  assert.equal(transitionCamera(createTransition('elevator', 2), POSE).posOffset.y, 0);
});

test('forceComplete yields done with one switch; later updates no-op', () => {
  for (const kind of ['elevator', 'stairs']) {
    const f = forceComplete(createTransition(kind, 4));
    assert.equal(f.phase, 'done');
    assert.equal(transitionCamera(f, POSE).floorSwitched, true);
    const n = updateTransition(f, 0.5);
    assert.equal(n.phase, 'done');
    assert.equal(n.justSwitched, false);
    assert.equal(transitionCamera(n, POSE).floorSwitched, false);
    assert.equal(n.t, f.t);
  }
});

test('forceComplete after the switch already happened does not re-fire', () => {
  const log = run(createTransition('elevator', 2));
  const mid = log.find((s) => s.phase === 'doors-open' && !s.justSwitched);
  const f = forceComplete(mid);
  assert.equal(f.phase, 'done');
  assert.equal(f.justSwitched, false);
});

test('done state update is a no-op', () => {
  const log = run(createTransition('stairs', 2));
  const done = log[log.length - 1];
  const n = updateTransition(done, 1);
  assert.equal(n.phase, 'done');
  assert.equal(n.justSwitched, false);
  assert.equal(n.floorSwitched, false);
  assert.equal(n.t, done.t);
});

test('stairs forward drift follows engine convention (sin f, -cos f)', () => {
  const mid = updateTransition(createTransition('stairs', 2), 0.75);
  const n = transitionCamera(mid, { x: 0, y: 0, facing: 0 }).posOffset;
  assert.ok(n.z < 0, 'facing 0 moves toward -z');
  assert.ok(Math.abs(n.x) < 1e-9);
  const e = transitionCamera(mid, { x: 0, y: 0, facing: Math.PI / 2 }).posOffset;
  assert.ok(e.x > 0);
  assert.ok(Math.abs(e.z) < 1e-9);
});
