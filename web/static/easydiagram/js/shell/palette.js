// ⌘K command palette: a filterable list of real actions.
import { h, icon, srOnly, MOD, SHIFT, ALT } from './dom.js';
import { I } from './defs.js';

export function commandList(ctx) {
  const { engine, store, actions } = ctx;
  const st = store.get();
  const dark = st.theme === 'dark';
  const sel = engine.getSelection();
  const list = [
    ['Add rectangle', 'R', I.rect, () => actions.addShape('rect')],
    ['Add ellipse', 'O', I.ellipse, () => actions.addShape('ellipse')],
    ['Add decision', 'D', I.diamond, () => actions.addShape('diamond')],
    ['Add sticky note', 'N', I.note, () => actions.addShape('note')],
    ['Add text', '', I.text, () => actions.addShape('text')],
    [dark ? 'Switch to light mode' : 'Switch to dark mode', SHIFT + 'D', dark ? I.sunSmall : I.moon, () => actions.toggleTheme()],
    [st.motion ? 'Pause all animations' : 'Play all animations', SHIFT + 'M', st.motion ? I.pause : I.play, () => actions.toggleMotion()],
    ['Animate selection: Pulse', ALT + 'P', I.spark, () => actions.animateSelection('pulse')],
    ['Save', MOD + 'S', I.save, () => actions.save()],
    ['Save as…', SHIFT + MOD + 'S', I.save, () => actions.saveAs()],
    ['Open…', MOD + 'O', I.open, () => actions.open()],
    ['Export as PNG', MOD + SHIFT + 'E', I.download, () => actions.exportAs('png')],
    ['Export as SVG', '', I.download, () => actions.exportAs('svg')],
    ['Download .drawio', '', I.file, () => actions.exportAs('drawio')],
    ['Print / Save as PDF', MOD + 'P', I.print, () => actions.print()],
    ['New page', SHIFT + 'N', I.page, () => actions.newPage()],
    ['Delete page', '', I.pageX, () => actions.deletePage()],
    ['Zoom to 100%', SHIFT + '0', I.zoom100, () => actions.zoomReset()],
    ['Zoom to fit', SHIFT + '1', I.fit, () => actions.fit()],
    ['Undo', MOD + 'Z', I.undo, () => actions.undo(), !engine.canUndo()],
    ['Redo', SHIFT + MOD + 'Z', I.redo, () => actions.redo(), !engine.canRedo()],
    ['Duplicate selection', MOD + 'D', I.dup, () => actions.duplicate(), sel.type === 'none'],
    ['Delete selection', '⌫', I.trash, () => actions.remove(), sel.type === 'none'],
  ];
  return list.filter((c) => !c[4]).map(([label, key, ic, run]) => ({ label, key, icon: ic, run }));
}

export function buildPalette(ctx) {
  const { store } = ctx;
  let items = [], active = 0, opener = null;

  const input = h('input', { type: 'text', placeholder: 'Type a command or search…', autocomplete: 'off', spellcheck: 'false',
    role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'ed-pal-list', 'aria-autocomplete': 'list' });
  const list = h('div.ed-pal-list', { id: 'ed-pal-list', role: 'listbox', 'aria-label': 'Commands' });
  const pal = h('div.ed-pal', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Command palette' },
    h('label.ed-pal-search', null, icon(I.search, { size: 20 }), srOnly('Search commands'), input, h('span.kbd', { text: 'esc' })),
    list);
  const backdrop = h('button.ed-pal-backdrop', { 'aria-label': 'Close command palette', tabindex: '-1', onclick: () => store.set({ paletteOpen: false }) });
  const layer = h('div.ed-pal-layer', { hidden: true }, backdrop, pal);

  function run(item) {
    store.set({ paletteOpen: false });
    item.run();
  }

  function render() {
    const q = input.value.trim().toLowerCase();
    items = commandList(ctx).filter((c) => !q || c.label.toLowerCase().includes(q));
    active = Math.min(active, Math.max(0, items.length - 1));
    if (!items.length) {
      list.replaceChildren(h('div.ed-pal-empty', { role: 'status', text: `No commands match “${input.value.trim()}”.` }));
      input.removeAttribute('aria-activedescendant');
      return;
    }
    list.replaceChildren(...items.map((c, i) => h('button.ed-cmd', {
      id: 'ed-cmd-' + i, role: 'option', 'aria-selected': i === active ? 'true' : 'false', tabindex: '-1',
      onclick: () => run(c), onmousemove: () => { if (active !== i) { active = i; mark(); } },
    }, h('span.ico', { 'aria-hidden': 'true' }, icon(c.icon)), h('span.lbl', { text: c.label }), c.key ? h('span.kbd', { text: c.key }) : null)));
    mark();
  }
  function mark() {
    [...list.children].forEach((b, i) => b.setAttribute('aria-selected', i === active ? 'true' : 'false'));
    const el = list.children[active];
    if (el) { input.setAttribute('aria-activedescendant', el.id); el.scrollIntoView({ block: 'nearest' }); }
  }

  input.addEventListener('input', () => { active = 0; render(); });
  pal.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % Math.max(1, items.length); mark(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + items.length) % Math.max(1, items.length); mark(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (items[active]) run(items[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); store.set({ paletteOpen: false }); }
    else if (e.key === 'Tab') { e.preventDefault(); input.focus(); } // keep focus inside the dialog
  });

  store.subscribe((st, prev) => {
    if (st.paletteOpen === prev.paletteOpen) return;
    layer.hidden = !st.paletteOpen;
    if (st.paletteOpen) {
      opener = document.activeElement;
      input.value = '';
      active = 0;
      render();
      input.focus();
    } else if (pal.contains(document.activeElement)) {
      document.activeElement.blur();
      if (opener && opener !== document.body && document.contains(opener) && !opener.closest('[hidden]')) opener.focus();
    }
  });
  return layer;
}
