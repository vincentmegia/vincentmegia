# Task 10 report: transition state machine

Files: web/static/js/library/three-d/transitions.js, transitions.test.js

## Signatures
- createTransition(kind: 'elevator'|'stairs', targetFloor) -> {kind,targetFloor,phase,t,committed,justSwitched,floorSwitched}
- updateTransition(state, dt) -> new state (never mutates)
- transitionCamera(state, basePose={x,y,facing}) -> {posOffset:{x,y,z}, doorOpen, floorSwitched}
- forceComplete(state) -> new done state
- Extra exports: ELEVATOR_DURATIONS, ELEVATOR_PHASES, STAIRS_DURATION, STAIRS_STEPS (10), ELEVATOR_BOB (0.05)

## Durations
Elevator: doors-close 0.6, rise 0.8, doors-open 0.6 (2.0s). Stairs: travel 1.5s.

## floorSwitched contract (Task 11)
- `justSwitched` (mirrored as `floorSwitched`) is true only on the one state returned by updateTransition/forceComplete that crosses the commit point; false on all others. transitionCamera(...).floorSwitched just reads it (pure per state).
- Commit point: elevator = entering 'doors-open'; stairs = reaching 'done'.
- Caller: each frame `state = updateTransition(state, dt); cam = transitionCamera(state, pose); if (cam.floorSwitched) switchFloor(state.targetFloor);` Act once per returned state; do not re-read an old state in a loop and act again.
- Large dt that skips the commit point still fires once on that state.
- forceComplete: returns phase 'done'; justSwitched=true if the switch had not yet happened (caller commits now), false if it already did. Further updates on done are no-ops (justSwitched false, t unchanged).
- Re-interact guard stays at the caller (ignore interact while a transition is active).

## Camera
- Stairs: y = STAIRS_STEPS*STAIR_RISE_PER_STEP*p, forward = STAIRS_STEPS*STAIR_RUN_PER_STEP*p, p=t/1.5 linear. Forward = (sin facing, cos facing) in (x,z); if the renderer's convention differs, adjust there. The offset stays at full value in 'done' (caller should drop the transition when applying the new floor pose).
- Elevator: y bob 0.05*sin(pi*p) during 'rise' only; 0 otherwise. doorOpen 0 through close/rise, ramps 0->1 in doors-open, 1 in done. Stairs doorOpen 0.

## Tests
`node --test web/static/js/library/three-d/transitions.test.js`: 14/14 pass (failed first: module missing). `npm run test:unit`: 1000 pass, 0 fail (986 + 14).

## Concerns
STAIRS_STEPS=10 is a guess for floor height; Task 11 may want it to match the real stair mesh/floor height.
