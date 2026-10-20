// Every user-facing command lives here, so the tool pill, the keyboard
// shortcuts, the command palette and the inspector all run the same code.
import { ADD_TOOLS, KIND_NAMES } from './defs.js';
import { MOD } from './dom.js';

export function createActions(ctx) {
  const { engine, store } = ctx;
  const toast = (...a) => ctx.toast(...a);
  const phone = () => window.matchMedia('(max-width: 760px)').matches;

  const has = (name) => typeof engine[name] === 'function';

  function selectedShape() {
    const sel = engine.getSelection();
    if (sel.type !== 'shape') return null;
    return engine.getCell(sel.ids[0]);
  }

  // The two selected shapes, in selection order, or null.
  function selectedPair() {
    const sel = engine.getSelection();
    if (sel.type !== 'multi' || sel.ids.length !== 2) return null;
    return sel.ids.every((id) => { const c = engine.getCell(id); return c && c.type === 'shape'; }) ? sel.ids : null;
  }

  const a = {
    addShape(kind, props) {
      store.set({ paletteOpen: false, exportOpen: false });
      const id = engine.addShape(kind, props);
      if (phone()) store.set({ drawer: null });
      return id;
    },

    pickTool(tool) {
      if (ADD_TOOLS[tool]) {
        a.addShape(ADD_TOOLS[tool]);
        engine.setTool('select');
        return;
      }
      engine.setTool(tool);
    },

    // ---- connectors (docs/features/easy-diagram.md, "Connectors")
    setConnector(id) {
      if (!engine.setConnectorPreset(id)) return;
      store.set({ connector: id });
      try { localStorage.setItem(ctx.CONNECTOR_KEY, id); } catch (_) { /* ignore */ }
    },

    // A dock connector tile: with two shapes selected it joins them;
    // otherwise it arms the connector tool (clicking it again disarms).
    armConnector(id) {
      const same = engine.getTool() === 'connector' && store.get().connector === id;
      a.setConnector(id);
      store.set({ picker: null });
      if (selectedPair()) { a.connectSelected(); return; }
      engine.setTool(same ? 'select' : 'connector');
    },

    connectSelected() {
      const pair = selectedPair();
      if (!pair) { toast('Select two shapes to connect them'); return; }
      const edge = engine.connect(pair[0], pair[1], { preset: store.get().connector });
      engine.select([edge]);
    },

    setPortMode(portMode) {
      store.set({ portMode });
      engine.setPortMode(portMode);
      try { localStorage.setItem(ctx.PORTS_KEY, portMode); } catch (_) { /* ignore */ }
    },

    openConnectPicker(req) { store.set({ picker: req, paletteOpen: false, exportOpen: false }); },
    closeConnectPicker() { store.set({ picker: null }); },

    duplicate() {
      const sel = engine.getSelection();
      if (sel.type === 'none' || !sel.ids.length) { toast('Select a shape first'); return; }
      engine.duplicate(sel.ids);
    },

    remove() {
      const sel = engine.getSelection();
      if (sel.type === 'none' || !sel.ids.length) return;
      let msg;
      if (sel.type === 'shape') {
        const c = engine.getCell(sel.ids[0]);
        const name = (c && (c.label || KIND_NAMES[c.kind])) || 'shape';
        msg = `Deleted “${name}”. Undo with ${MOD}Z`;
      } else if (sel.type === 'edge') msg = `Connector deleted. Undo with ${MOD}Z`;
      else msg = `Deleted ${sel.ids.length} items. Undo with ${MOD}Z`;
      engine.remove(sel.ids);
      toast(msg);
    },

    undo() { if (engine.canUndo()) engine.undo(); },
    redo() { if (engine.canRedo()) engine.redo(); },

    setTheme(theme) {
      store.set({ theme });
      engine.setTheme(theme);
      try { localStorage.setItem(ctx.THEME_KEY, theme); } catch (_) { /* ignore */ }
    },
    toggleTheme() { a.setTheme(store.get().theme === 'dark' ? 'light' : 'dark'); store.set({ paletteOpen: false }); },

    toggleMotion() {
      const motion = !store.get().motion;
      store.set({ motion, paletteOpen: false });
      engine.setMotion(motion);
      toast(motion ? 'Animations playing' : 'Animations paused');
    },

    setGrid(grid) { store.set({ grid }); engine.setGrid(grid); },
    toggleSnap() { const snap = !store.get().snap; store.set({ snap }); engine.setSnap(snap); },

    zoomIn() { engine.zoomIn(); },
    zoomOut() { engine.zoomOut(); },
    zoomReset() { engine.zoomTo(1); store.set({ paletteOpen: false }); },
    fit() { engine.fit(); store.set({ paletteOpen: false }); },

    newPage() {
      const n = engine.pages().length + 1;
      engine.addPage('Page ' + n);
      store.set({ paletteOpen: false });
    },
    deletePage() {
      store.set({ paletteOpen: false });
      const pages = engine.pages();
      if (pages.length < 2) { toast('A file needs at least one page', 'error'); return; }
      const cur = pages.find((p) => p.id === engine.currentPage());
      if (!engine.isEmpty() && !window.confirm(`Delete page “${cur ? cur.name : ''}” and everything on it?`)) return;
      engine.removePage(engine.currentPage());
      toast(`Deleted page “${cur ? cur.name : ''}”`);
    },
    renamePage(name) {
      const v = String(name || '').trim();
      if (v) engine.renamePage(engine.currentPage(), v);
    },
    currentPageName() {
      const p = engine.pages().find((x) => x.id === engine.currentPage());
      return p ? p.name : 'Page 1';
    },

    animateSelection(name) {
      store.set({ paletteOpen: false });
      const c = selectedShape();
      if (!c) { toast('Select a shape first'); return; }
      engine.update(c.id, { anim: { ...(c.anim || {}), trigger: (c.anim && c.anim.trigger) || 'loop', speed: (c.anim && c.anim.speed) || 'normal', name } });
    },

    openPalette() { store.set({ paletteOpen: true, exportOpen: false, drawer: null }); },
    closePalette() { store.set({ paletteOpen: false }); },
    toggleExport(open) {
      const exportOpen = open == null ? !store.get().exportOpen : open;
      store.set({ exportOpen, paletteOpen: false });
    },
    toggleDrawer(which) { store.set({ drawer: store.get().drawer === which ? null : which, exportOpen: false }); },

    // Esc: close the innermost overlay, else clear the selection.
    escape() {
      const st = store.get();
      if (st.picker) { store.set({ picker: null }); return true; }
      if (st.paletteOpen) { store.set({ paletteOpen: false }); return true; }
      if (st.exportOpen) { store.set({ exportOpen: false }); return true; }
      if (st.drawer) { store.set({ drawer: null }); return true; }
      if (has('setTool') && engine.getTool() !== 'select') { engine.setTool('select'); return true; }
      if (engine.getSelection().type !== 'none') { engine.clearSelection(); return true; }
      return false;
    },
  };
  // File actions (save/open/export/print) are attached by files.js.
  return a;
}
