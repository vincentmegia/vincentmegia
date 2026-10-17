// Global keyboard shortcuts. Ignored while typing in a field, except the
// few that are never text edits (⌘K, ⌘S, ⌘O, ⌘P, Esc).
import { isTyping } from './dom.js';

const TOOL_KEYS = { v: 'select', h: 'hand', r: 'rect', o: 'ellipse', d: 'diamond', a: 'connector', t: 'text', n: 'note' };

export function installShortcuts(ctx) {
  const { store, actions } = ctx;

  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.isComposing) return;
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const typing = isTyping(e.target);
    const paletteOpen = store.get().paletteOpen;

    // --- work everywhere
    if (mod && !e.altKey && key === 'k') { e.preventDefault(); paletteOpen ? actions.closePalette() : actions.openPalette(); return; }
    if (mod && !e.altKey && key === 's') { e.preventDefault(); e.shiftKey ? actions.saveAs() : actions.save(); return; }
    if (mod && !e.altKey && !e.shiftKey && key === 'o') { e.preventDefault(); actions.open(); return; }
    if (mod && !e.altKey && !e.shiftKey && key === 'p') { e.preventDefault(); actions.print(); return; }
    if (key === 'Escape') {
      if (typing && !paletteOpen) { e.target.blur(); return; }
      if (actions.escape()) e.preventDefault();
      return;
    }

    if (typing || paletteOpen) return;
    // Let buttons keep Space/Enter; everything below is single keys or mod combos.
    if (mod && !e.altKey) {
      if (key === 'z') { e.preventDefault(); e.shiftKey ? actions.redo() : actions.undo(); return; }
      if (key === 'y' && !e.shiftKey) { e.preventDefault(); actions.redo(); return; }
      if (key === 'd' && !e.shiftKey) { e.preventDefault(); actions.duplicate(); return; }
      if (key === 'e' && e.shiftKey) { e.preventDefault(); actions.exportAs('png'); return; }
      return;
    }
    if (key === 'Delete' || key === 'Backspace') {
      // Never delete shapes from inside any form control (e.g. the opacity slider).
      // (typing targets already returned above; for a slider etc. just swallow the key so
      // WebKit doesn't treat Backspace as "navigate back").
      if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]')) { e.preventDefault(); return; }
      e.preventDefault(); actions.remove(); return;
    }
    // ⌥P: e.key is "π" on macOS, so match the physical key.
    if (e.altKey && !e.shiftKey && e.code === 'KeyP') { e.preventDefault(); actions.animateSelection('pulse'); return; }
    if (e.altKey) return;
    if (e.shiftKey) {
      if (key === 'd') { e.preventDefault(); actions.toggleTheme(); return; }
      if (key === 'm') { e.preventDefault(); actions.toggleMotion(); return; }
      if (key === 'n') { e.preventDefault(); actions.newPage(); return; }
      if (e.code === 'Digit0') { e.preventDefault(); actions.zoomReset(); return; }
      if (e.code === 'Digit1') { e.preventDefault(); actions.fit(); return; }
      return;
    }
    if (TOOL_KEYS[key]) { e.preventDefault(); actions.pickTool(TOOL_KEYS[key]); return; }
    if (key === '+' || key === '=') { e.preventDefault(); actions.zoomIn(); return; }
    if (key === '-') { e.preventDefault(); actions.zoomOut(); return; }
  });
}
