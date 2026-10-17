// Top bar: brand, file name + save status, page tabs, Motion, undo/redo,
// theme, "Search & commands" and the Export popover.
import { h, s, icon, setPressed, MOD } from './dom.js';
import { I } from './defs.js';
import { buildExportPopover } from './export.js';

function logo() {
  return s('svg', { width: 22, height: 22, viewBox: '0 0 22 22', 'aria-hidden': 'true', focusable: 'false' },
    s('rect', { x: 1, y: 1, width: 8, height: 8, rx: 1.5, fill: 'var(--accent)' }),
    s('rect', { x: 13, y: 13, width: 8, height: 8, rx: 1.5, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 1.5 }),
    s('path', { d: 'M5 9v8h8', fill: 'none', stroke: 'var(--ink2)', 'stroke-width': 1.5 }));
}

const STATUS_TEXT = {
  new: 'Not saved yet',
  saving: 'Saving…',
  saved: 'Saved on this device',
  draft: 'Draft kept on this device',
};

export function buildTopbar(ctx) {
  const { engine, store, actions } = ctx;

  // --- left: brand + file
  const fileName = h('span.ed-filename', { 'data-testid': 'file-name' });
  const statusText = h('span.txt');
  const status = h('span.ed-status', { 'data-testid': 'save-status' },
    s('svg', { class: 'spin', width: 12, height: 12, viewBox: '0 0 24 24', 'aria-hidden': 'true' },
      s('path', { d: 'M12 3a9 9 0 1 0 9 9', fill: 'none', stroke: 'currentColor', 'stroke-width': 3, 'stroke-linecap': 'round' })),
    h('span.dot', { 'aria-hidden': 'true' }), statusText);
  const left = h('div.ed-top-left', null,
    h('a.ed-brand', { href: '/projects', 'aria-label': 'Easy Diagram, back to Projects' }, logo(), h('span.ed-brand-name', { text: 'Easy Diagram' })),
    h('span.ed-sep', { 'aria-hidden': 'true' }),
    h('div.ed-file', null, fileName, status));

  // --- page tabs
  const tabs = h('div');
  tabs.style.display = 'contents';
  const addPageBtn = h('button.ibtn', { 'aria-label': 'Add page', title: 'Add page', onclick: () => actions.newPage() }, icon(I.plus, { size: 16, sw: 2 }));
  const nav = h('nav.ed-pages', { 'aria-label': 'Pages' }, tabs, addPageBtn);

  let tabSig = '';
  function renderTabs() {
    const cur = engine.currentPage();
    const pages = engine.pages();
    // Rebuild only when pages actually changed, so a focused tab keeps focus.
    const sig = JSON.stringify([cur, pages]);
    if (sig === tabSig) return;
    tabSig = sig;
    const focusedId = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.pageId : null;
    tabs.replaceChildren(...engine.pages().map((p) => h('button.ed-tab', {
      'aria-current': p.id === cur ? 'page' : 'false',
      'data-page-id': p.id,
      text: p.name,
      onclick: () => { if (engine.currentPage() !== p.id) engine.selectPage(p.id); },
      ondblclick: () => {
        const name = window.prompt('Rename page', p.name);
        if (name != null) { if (engine.currentPage() !== p.id) engine.selectPage(p.id); actions.renamePage(name); }
      },
    })));
    if (focusedId) { const b = tabs.querySelector(`[data-page-id="${CSS.escape(focusedId)}"]`); if (b) b.focus(); }
  }

  // --- right cluster
  const dockBtn = h('button.ibtn.ed-drawer-btn', { 'aria-label': 'Shapes panel', 'aria-expanded': 'false', 'aria-controls': 'ed-dock', onclick: () => actions.toggleDrawer('dock') }, icon(I.shapes, { size: 18 }));
  const inspBtn = h('button.ibtn.ed-drawer-btn', { 'aria-label': 'Format panel', 'aria-expanded': 'false', 'aria-controls': 'ed-insp', onclick: () => actions.toggleDrawer('insp') }, icon(I.sliders, { size: 18 }));

  const motionPath = s('path', { d: I.pause });
  const motionLbl = h('span.lbl');
  const motionBtn = h('button.ed-motion', { 'aria-pressed': 'true', 'aria-label': null, onclick: () => actions.toggleMotion() },
    s('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, motionPath),
    motionLbl);
  const undoBtn = h('button.ibtn', { 'aria-label': 'Undo', title: `Undo (${MOD}Z)`, onclick: () => actions.undo() }, icon(I.undo, { size: 18 }));
  const redoBtn = h('button.ibtn', { 'aria-label': 'Redo', title: `Redo (${MOD}⇧Z)`, onclick: () => actions.redo() }, icon(I.redo, { size: 18 }));
  const themePath = s('path', { d: I.sun });
  const themeBtn = h('button.ibtn', { onclick: () => actions.toggleTheme() },
    s('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, themePath));
  const searchBtn = h('button.ed-search', { 'aria-label': 'Search & commands', 'aria-haspopup': 'dialog', onclick: () => actions.openPalette() },
    icon(I.search), h('span.lbl', { text: 'Search & commands' }), h('span.kbd', { text: MOD + 'K' }));
  const exp = buildExportPopover(ctx);

  const right = h('div.ed-top-right', null, dockBtn, motionBtn, undoBtn, redoBtn, themeBtn, searchBtn, exp.el, inspBtn);
  const header = h('header.ed-top', null, left, nav, right);

  function renderHistory() {
    undoBtn.disabled = !engine.canUndo();
    redoBtn.disabled = !engine.canRedo();
  }
  function renderShell(st, prev) {
    if (!prev || st.motion !== prev.motion) {
      setPressed(motionBtn, st.motion);
      motionLbl.textContent = st.motion ? 'Motion on' : 'Motion off';
      motionBtn.setAttribute('aria-label', 'Motion');
      motionBtn.title = st.motion ? 'Pause all animations' : 'Play all animations';
      motionPath.setAttribute('d', st.motion ? I.pause : I.play);
    }
    if (!prev || st.theme !== prev.theme) {
      const dark = st.theme === 'dark';
      themeBtn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      themeBtn.title = themeBtn.getAttribute('aria-label');
      themePath.setAttribute('d', dark ? I.sun : I.moon);
    }
    if (!prev || st.file !== prev.file) {
      fileName.textContent = st.file.name;
      fileName.title = st.file.name;
      document.title = `${st.file.name} · Easy Diagram`;
    }
    if (!prev || st.status !== prev.status) {
      status.dataset.state = st.status;
      statusText.textContent = STATUS_TEXT[st.status] || '';
    }
    if (!prev || st.drawer !== prev.drawer) {
      dockBtn.setAttribute('aria-expanded', st.drawer === 'dock' ? 'true' : 'false');
      inspBtn.setAttribute('aria-expanded', st.drawer === 'insp' ? 'true' : 'false');
    }
  }

  store.subscribe(renderShell);
  renderShell(store.get(), null);
  engine.on('change', () => { renderHistory(); renderTabs(); });
  engine.on('page', () => { renderHistory(); renderTabs(); });
  renderHistory();
  renderTabs();
  return header;
}
