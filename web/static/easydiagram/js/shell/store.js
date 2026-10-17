// Minimal state store for shell-only UI state (theme, popovers, file name).
// Diagram state lives in the engine; this never mirrors it.

export function createStore(initial) {
  let state = Object.freeze({ ...initial });
  const subs = new Set();
  return {
    get: () => state,
    set(patch) {
      const prev = state;
      const next = typeof patch === 'function' ? patch(prev) : patch;
      let changed = false;
      for (const k of Object.keys(next)) if (next[k] !== prev[k]) { changed = true; break; }
      if (!changed) return;
      state = Object.freeze({ ...prev, ...next });
      subs.forEach((fn) => fn(state, prev));
    },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}
