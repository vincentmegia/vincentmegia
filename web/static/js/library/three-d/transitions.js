// Pure state machine for the elevator ride and stair climb floor transitions.
// No DOM, timers or randomness: everything is driven by dt.
//
// One-shot floor switch contract (Task 11 caller):
//   - Every state carries `justSwitched` (mirrored as `floorSwitched`). It is
//     true ONLY on the single state returned by updateTransition()/
//     forceComplete() that crosses the commit point, and false on every other
//     state. transitionCamera(state).floorSwitched just reads it, so the same
//     state always reports the same value.
//   - Caller loop: `state = updateTransition(state, dt); const cam =
//     transitionCamera(state, pose); if (cam.floorSwitched) switchFloor(
//     state.targetFloor);` Act on each state returned by update once.
//   - Commit point: elevator = entering 'doors-open'; stairs = end of
//     'travel' (the state that first has phase 'done').
//   - forceComplete(state) jumps to 'done'. If the switch has not happened yet
//     it returns justSwitched=true (caller commits the floor now); if it
//     already happened it returns justSwitched=false. Later updates on a done
//     state are no-ops with justSwitched=false.
import { STAIR_RISE_PER_STEP, STAIR_RUN_PER_STEP } from './meshes/stairs.js';

export const ELEVATOR_DURATIONS = [0.6, 0.8, 0.6]; // doors-close, rise, doors-open
export const ELEVATOR_PHASES = ['doors-close', 'rise', 'doors-open'];
export const STAIRS_DURATION = 1.5;
export const STAIRS_STEPS = 10;
export const ELEVATOR_BOB = 0.05; // peak camera lift (world units) mid-rise

const EPS = 1e-9;
const ELEVATOR_TOTAL = ELEVATOR_DURATIONS.reduce((a, b) => a + b, 0);
const ELEVATOR_COMMIT_T = ELEVATOR_DURATIONS[0] + ELEVATOR_DURATIONS[1];

const totalOf = (kind) => (kind === 'elevator' ? ELEVATOR_TOTAL : STAIRS_DURATION);
const commitT = (kind) => (kind === 'elevator' ? ELEVATOR_COMMIT_T : STAIRS_DURATION);

function phaseAt(kind, t) {
  if (t >= totalOf(kind) - EPS) return 'done';
  if (kind === 'stairs') return 'travel';
  if (t < ELEVATOR_DURATIONS[0] - EPS) return 'doors-close';
  if (t < ELEVATOR_COMMIT_T - EPS) return 'rise';
  return 'doors-open';
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));

export function createTransition(kind, targetFloor) {
  if (kind !== 'elevator' && kind !== 'stairs') throw new Error(`unknown transition kind: ${kind}`);
  return {
    kind,
    targetFloor,
    phase: kind === 'elevator' ? 'doors-close' : 'travel',
    t: 0,
    committed: false,
    justSwitched: false,
    floorSwitched: false,
  };
}

export function updateTransition(state, dt) {
  if (state.phase === 'done') {
    return { ...state, justSwitched: false, floorSwitched: false };
  }
  const t = Math.min(totalOf(state.kind), state.t + Math.max(0, dt));
  const phase = phaseAt(state.kind, t);
  const crossed = !state.committed && t >= commitT(state.kind) - EPS;
  return {
    ...state,
    t,
    phase,
    committed: state.committed || crossed,
    justSwitched: crossed,
    floorSwitched: crossed,
  };
}

export function forceComplete(state) {
  if (state.phase === 'done') {
    return { ...state, justSwitched: false, floorSwitched: false };
  }
  const fire = !state.committed;
  return {
    ...state,
    t: totalOf(state.kind),
    phase: 'done',
    committed: true,
    justSwitched: fire,
    floorSwitched: fire,
  };
}

// basePose = { x, y, facing } (facing in radians; forward = (sin f, -cos f) in x/z).
export function transitionCamera(state, basePose = { x: 0, y: 0, facing: 0 }) {
  const floorSwitched = !!state.justSwitched;
  let y = 0;
  let fwd = 0;
  let doorOpen = 0;
  if (state.kind === 'stairs') {
    const p = clamp01(state.t / STAIRS_DURATION);
    y = STAIRS_STEPS * STAIR_RISE_PER_STEP * p;
    fwd = STAIRS_STEPS * STAIR_RUN_PER_STEP * p;
  } else {
    if (state.phase === 'rise') {
      const p = clamp01((state.t - ELEVATOR_DURATIONS[0]) / ELEVATOR_DURATIONS[1]);
      y = ELEVATOR_BOB * Math.sin(Math.PI * p);
    }
    if (state.phase === 'doors-open') {
      doorOpen = clamp01((state.t - ELEVATOR_COMMIT_T) / ELEVATOR_DURATIONS[2]);
    } else if (state.phase === 'done') {
      doorOpen = 1;
    }
  }
  const f = basePose.facing || 0;
  return {
    posOffset: { x: Math.sin(f) * fwd, y, z: -Math.cos(f) * fwd },
    doorOpen,
    floorSwitched,
  };
}
