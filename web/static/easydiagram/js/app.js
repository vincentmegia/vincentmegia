// Easy Diagram entry point (WP3 Shell).
// Mounts the editor shell into #easy-diagram-app, boots the engine (WP2,
// engine.js) and wires local file IO (WP4, io.js). Plain ES module, no build.

import { createEngine } from './engine.js';
import * as io from './io.js';
import { h } from './shell/dom.js';
import { createStore } from './shell/store.js';
import { createActions } from './shell/actions.js';
import { buildTopbar } from './shell/topbar.js';
import { buildDock } from './shell/dock.js';
import { buildStage } from './shell/stage.js';
import { buildInspector } from './shell/inspector.js';
import { buildPalette } from './shell/palette.js';
import { createToasts } from './shell/toasts.js';
import { installShortcuts } from './shell/shortcuts.js';
import { installFiles } from './shell/files.js';

const THEME_KEY = 'easyDiagram.theme';

function savedTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === 'light' || t === 'dark') return t;
  } catch (_) { /* storage unavailable */ }
  return 'dark';
}

function boot() {
  const mount = document.getElementById('easy-diagram-app');
  if (!mount) return;

  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = createStore({
    theme: savedTheme(),
    motion: !reduceMotion,
    grid: 'dots',
    snap: true,
    exportOpen: false,
    paletteOpen: false,
    drawer: null, // 'dock' | 'insp' on phone width
    file: { name: 'Untitled.ed', handle: null },
    status: 'new', // new | saving | saved | draft
  });

  const root = h('div.ed', { 'data-theme': store.get().theme });
  mount.replaceChildren(root);

  const canvas = h('div.ed-canvas');
  const ctx = { root, store, io, canvas, engine: null, actions: null, toast: null, THEME_KEY };
  ctx.toast = createToasts(ctx);

  const s0 = store.get();
  const engine = createEngine(canvas, { theme: s0.theme, grid: s0.grid, snap: s0.snap, motion: s0.motion });
  ctx.engine = engine;
  ctx.actions = createActions(ctx);

  const top = buildTopbar(ctx);
  const dock = buildDock(ctx);
  const stage = buildStage(ctx);
  const insp = buildInspector(ctx);
  const body = h('div.ed-body', null, dock, stage, insp);
  const scrim = h('button.ed-drawer-scrim', { 'aria-label': 'Close panel', tabindex: '-1', hidden: true, onclick: () => store.set({ drawer: null }) });
  body.append(scrim);
  root.append(top, body, buildPalette(ctx), h('div.ed-print', { 'aria-hidden': 'true' }));

  // Root-level reflections of shell state.
  store.subscribe((st, prev) => {
    if (st.theme !== prev.theme) root.dataset.theme = st.theme;
    if (st.motion !== prev.motion) root.classList.toggle('paused', !st.motion);
    if (st.drawer !== prev.drawer) {
      if (st.drawer) root.dataset.drawer = st.drawer; else delete root.dataset.drawer;
      scrim.hidden = !st.drawer;
    }
  });
  root.classList.toggle('paused', !s0.motion);

  installShortcuts(ctx);
  installFiles(ctx);

  // The single allowed global: a test hook for Playwright.
  window.__easyDiagram = { engine, io };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
