---
name: javascript
description: Write clean, testable, performant vanilla JavaScript for this project — ES modules, canvas games, DOM interactions, and node --test unit tests. Use when adding or changing any browser-side JavaScript under web/static/js/.
---

# JavaScript Skill

## Purpose

Write reliable, testable, performant JavaScript for a vanilla ES module
codebase — no framework, no bundler, no TypeScript. The JavaScript in this
project powers canvas mini-games, browser tools, and lightweight DOM
interactions alongside a server-rendered Go + HTMX stack.

Feature-specific behavior belongs in:

```text
docs/features/
```

---

## Core Principles

Prioritize:

1. Purity — logic separated from DOM and canvas
2. Simplicity — vanilla JS over libraries
3. Testability — every rule and state transition covered by `node --test`
4. Correctness — explicit state, no hidden mutation
5. Performance — 60 fps canvas rendering on mid-range hardware
6. Security — CSP-compatible, no `eval`, no inline scripts

Avoid introducing libraries, polyfills or build steps unless a dependency
provides significant value that vanilla JS cannot reasonably match.

---

## Module Organization

The codebase uses native browser ES modules (`<script type="module">`), not
a bundler. Every `.js` file is either a **pure logic module** or a **canvas
entry file**.

```text
web/static/js/
├── <game>-game.js           ← canvas entry file (DOM, canvas, rAF loop)
├── <game>/
│   ├── rules.js             ← pure game logic (no DOM, no canvas)
│   ├── engine-state.js      ← pure state transitions
│   ├── floor-plan.js        ← pure geometry / layout
│   ├── *.test.js            ← unit tests for the pure modules
│   └── ...
├── shared/                   ← cross-game utilities (people.js, etc.)
├── library/three-d/          ← software 3D renderer (pure core + meshes)
└── <page>.js                 ← lightweight page scripts (nav, carousel)
```

### Pure logic modules

The architectural backbone. These modules:

* Export pure functions and constants — no side effects on import
* Have **zero** DOM, canvas, `localStorage`, timer, or network dependencies
* Accept all context through arguments, return all results as values
* Are the only modules covered by `node --test` unit tests

If a function needs randomness, time, or I/O, take it as a parameter
(a clock value, a random seed, a callback) so tests can control it.

### Canvas entry files

The `-game.js` files own everything the pure modules cannot:

* The `requestAnimationFrame` render loop
* Canvas context creation and input event listeners
* `localStorage` persistence
* DOM manipulation (HUD overlays, fullscreen)
* `window.__*TestHooks` for Playwright

They delegate every decision to the pure modules. A canvas entry file should
read like a wiring diagram — "on click, call `rules.foo(state)`; if result,
draw `bar`" — with no business logic of its own.

### Lightweight page scripts

Small ES modules for non-game pages (`nav-menu.js`, `carousel-nav.js`,
`header-scroll.js`). Some older ones use IIFEs with `'use strict'` rather
than ES module syntax — that is legacy, not a pattern to follow. New page
scripts are ES modules.

---

## ES Module Patterns

### Imports and exports

Use named exports for everything. Default exports make refactoring harder
and give no hint of what is being imported.

```js
// good
export function streakMultiplier(miles) { ... }
export const MAX_LIVES = 3;

// avoid
export default function streakMultiplier(miles) { ... }
```

Import with explicit names, never `import *`:

```js
import { streakMultiplier, MAX_LIVES } from './rules.js';
```

Always include the `.js` extension — there is no bundler to resolve bare
specifiers.

### Re-exports for shared modules

When a module re-exports from several sources, do it at the top level so
consumers import from one place:

```js
// library/library-people.js
export { PEOPLE_TEMPLATES } from '../shared/people.js';
export { KAREN_DESIGN, findLibraryDesign } from './designs.js';
```

### No circular imports

Circular dependencies silently produce `undefined` at the point of use
(the imported binding exists but hasn't been initialized yet). The symptom
is a `TypeError: X is not a function` at runtime that only appears when
the import order changes. Break cycles by extracting the shared piece into
its own module.

---

## Naming Conventions

```text
files:         kebab-case.js, kebab-case.test.js
constants:     UPPER_SNAKE_CASE
functions:     camelCase (verb-first: drawPatron, applyHit, isBlinking)
classes:       PascalCase (rare — prefer plain functions and objects)
test files:    <module>.test.js, co-located with the module
```

Name functions for what they compute or do, not what calls them. A function
called `handleClick` says nothing about its purpose; `movePlayerToStation`
says exactly what it does.

Design-object keys and palette entries use `camelCase`
(`bodyColor`, `hairStyle`). Keep these stable — game-state serialization
depends on them.

---

## State Management

### Immutable state transitions

Pure modules return new state rather than mutating the old:

```js
export function applyHazardHit(state, now) {
  if (now < state.invulnerableUntil) return state;
  return {
    ...state,
    lives: state.lives - 1,
    invulnerableUntil: now + INVULNERABILITY_SECONDS,
    roundStatus: state.lives - 1 <= 0 ? 'caught' : 'playing',
  };
}
```

The canvas entry file owns the mutable `let state = ...` variable and
replaces it on each transition. This keeps every intermediate state
inspectable in tests.

### State shape documentation

Document the shape of a state object in a comment at the top of the module
that defines it, the way `engine-state.js` does for `RoundState`. This is
the contract between the pure module and its consumers — anyone reading
the entry file or writing a test can find the shape in one place.

### Derived values

Compute derived values from state at render time rather than storing them.
If a value can be calculated from existing state, it is not state — it is a
view. Storing it creates a synchronization bug waiting to happen.

---

## Error Handling

### In pure modules

Pure functions signal errors through return values, not exceptions. A
function that validates input returns `{ valid: false, reason: '...' }`
or a sentinel (`null`, `-1`, a tagged union). Exceptions in pure code mean
a programming error (a violated precondition), not a recoverable condition.

### In canvas entry files

Catch errors at the boundary — the `requestAnimationFrame` callback, event
listeners, `fetch` calls — and either recover gracefully or surface a
visible message. An uncaught exception in the rAF loop silently kills the
game.

```js
function tick(timestamp) {
  try {
    update(timestamp);
    render();
  } catch (err) {
    console.error('frame error:', err);
    // show a visible "something went wrong" rather than a frozen canvas
  }
  requestAnimationFrame(tick);
}
```

### Never swallow errors

`catch (e) {}` hides bugs. If you catch, log or handle. If you cannot do
either, do not catch.

---

## Testing

### Runner and assertions

Use Node's built-in test runner — no test framework dependency:

```js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
```

Run with `npm run test:unit` (which expands to `node --test` over all
`*.test.js` files).

### What to test

Test **behavior**, not implementation:

* Every exported function in a pure module
* Boundary conditions: zero, one, maximum, just-over-maximum
* State transitions: each transition function with before/after assertions
* Ramp/progression curves: that difficulty, payout, unlock thresholds
  match the feature doc's tables
* Determinism: same inputs always produce same outputs
* Edge cases the feature doc calls out

Do not test canvas rendering or DOM manipulation in `node --test` — those
belong in Playwright e2e tests.

### Table-driven tests

When testing a function over many inputs, use a data table:

```js
const cases = [
  { miles: 0,   expected: 1.0 },
  { miles: 50,  expected: 1.5 },
  { miles: 100, expected: 2.0 },
];

for (const { miles, expected } of cases) {
  test(`streakMultiplier(${miles}) → ${expected}`, () => {
    assert.equal(streakMultiplier(miles), expected);
  });
}
```

### Test isolation

Each test must be independent — no shared mutable state between tests.
Create fresh state inside each `test()` callback. If multiple tests need
the same setup, extract a factory function, do not share a `let` declared
outside the test.

### Test file location

Co-locate `<module>.test.js` next to `<module>.js`. Do not put tests in a
separate `__tests__/` directory — co-location makes it obvious which
modules are tested and which are not.

---

## Canvas Rendering

One `requestAnimationFrame` loop per game: `update(dt)` then `render()`.
Keep game logic out of `render()`. Maintain a logical coordinate system
separate from canvas pixels. Always `save()`/`restore()` around transforms.

See `references/canvas-rendering.md` for coordinate systems, letterboxing,
drawing helpers and canvas state management.

---

## Performance

### Keep the hot path lean

The rAF callback runs every 16 ms. Avoid allocations, closures, and
string operations inside it. Pre-compute what you can outside the loop.

### Cache expensive draws

If a visual element does not change every frame (a character's outfit, a
prop's texture), paint it into an off-screen canvas once and `drawImage`
it each frame. This is the texture pattern used throughout the 3D renderer
and the game engines.

### Measure, do not guess

Use the browser's performance tools, not intuition, to find bottlenecks.
The constraint is 60 fps in headless Chromium on CI — if a change drops
below that, profile before optimizing.

### Object pooling

For objects created and discarded every frame (particles, hit-test
results), reuse from a pool rather than allocating. The GC pause from
thousands of short-lived objects is visible as frame jank.

---

## Security

### CSP compliance

This site uses a strict Content Security Policy: `default-src 'self'`.
That means:

* No inline `<script>` tags — all JS is in external `.js` files
* No `eval()`, `new Function()`, or `setTimeout('string')`
* No CDN script loads (except routes with their own CSP, like Bus Stops)
* Fonts and images served from `/static/`

A script that violates the CSP silently fails in production. Test with the
CSP enabled, not just in a bare HTML file.

### Input handling

Never insert user-controlled strings into the DOM with `innerHTML`. Use
`textContent` for text, `createElement`/`setAttribute` for structure. The
HTMX UI skill covers this in more detail — the same rule applies to any
DOM manipulation in JavaScript.

Canvas `fillText`/`strokeText` are inherently safe (they rasterize, not
parse), but watch for cases where a user-controlled string ends up in a
URL, `postMessage`, or `localStorage` key.

### Secrets stay server-side

API keys, tokens, and secrets are never embedded in client-side JavaScript.
If a page needs data that requires authentication, the server renders it
into the initial HTML or the page fetches it from an authenticated endpoint.

---

## Playwright Test Hooks

Canvas games expose `window.__<game>TestHooks` for Playwright e2e tests.
These hooks let tests inspect and control game state without depending on
pixel-level canvas assertions:

```js
window.__libraryGameTestHooks = {
  getState: () => ({ ... }),
  freezeStaff: () => { ... },
  setMinjunAction: (action) => { ... },
  // ...
};
```

Rules for test hooks:

* Prefix with `window.__` and include the game name to avoid collisions
* Expose read-only getters for state inspection, write functions for
  control (freeze time, force a state, trigger an event)
* Never call test hooks from production code — they exist only for
  Playwright
* Define them in the canvas entry file, not in pure modules (pure modules
  have no `window`)
* Document each hook briefly in the feature doc's Testing Plan section

---

## Async Patterns

For the few modules that use async (Bus Stops, fetch calls):

* Use `async`/`await` over raw `.then()` chains — it reads sequentially
  and handles errors with `try`/`catch`
* Always handle the rejection path — an unhandled promise rejection
  crashes the page in strict environments
* Abort long-running fetches with `AbortController` when the user
  navigates away or the component unmounts
* Never `await` inside a `requestAnimationFrame` callback — it stalls
  the render loop

---

## Code Style

### `const` and `let`, never `var`

`var` hoists to function scope and allows re-declaration, which are both
sources of subtle bugs. `const` by default; `let` only when rebinding is
needed. ES modules are strict mode by default, so `var`'s quirks are
doubly unnecessary.

### Early returns

Prefer early returns over deeply nested `if`/`else`:

```js
// good
function process(input) {
  if (!input) return null;
  if (input.type !== 'valid') return null;
  return transform(input);
}

// avoid
function process(input) {
  if (input) {
    if (input.type === 'valid') {
      return transform(input);
    }
  }
  return null;
}
```

### Small functions

If a function is longer than ~40 lines, it is doing too much. Extract
sub-functions with names that explain the step — the names serve as
documentation. This matters especially in canvas entry files, which
naturally grow large; the `render()` function should read as a list of
named drawing steps, not a wall of `ctx.*` calls.

### Avoid classes when plain functions suffice

This codebase models game state as plain objects and operates on them with
exported functions. That pattern is simpler, more testable, and composes
better than class hierarchies. Reach for a class only when you need
encapsulated mutable state with a stable identity (rare in this project).

---

## Feature Docs Are Part of the Change

Every feature has a doc under `docs/features/<feature>.md`. A requirement
change is not finished until that doc describes what the code now does.

* Read the doc before touching the feature, and verify its claims against
  the code — these docs have drifted before.
* Update it in the same commit as the behavior change.
* A change spanning several features updates each of their docs.
* A new feature starts from `docs/features/template.md` and gets its row
  in the table in `CLAUDE.md`.
* "Code works, doc not updated yet" is incomplete work, not a follow-up
  task.

## Definition of Done

JavaScript work is complete when:

* Logic is in pure modules, rendering in entry files
* Every exported function in a pure module has unit tests
* Tests pass: `npm run test:unit`
* No `var`, no `eval`, no inline scripts
* Canvas state (`save`/`restore`) is managed correctly
* Performance is acceptable (60 fps with the feature in view)
* CSP is not violated
* Test hooks are exposed for any new Playwright-testable behavior
* No business logic lives in the canvas entry file
* The feature's `docs/features/<feature>.md` is updated in the same commit
