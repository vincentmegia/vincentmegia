// Export popover: PNG / SVG / PDF / .drawio, transparent, embed, scale.
import { h, icon, setPressed, toggleRow, segmented } from './dom.js';
import { I } from './defs.js';

const FORMATS = [['png', 'PNG'], ['svg', 'SVG'], ['pdf', 'PDF'], ['drawio', '.drawio']];

export function buildExportPopover(ctx) {
  const { store, actions } = ctx;
  const opts = { fmt: 'png', scale: 2, transparent: false, embed: true };

  const btn = h('button.accentbtn.ed-export', {
    'aria-expanded': 'false', 'aria-haspopup': 'dialog', 'aria-controls': 'ed-export-pop', 'aria-label': 'Export',
    onclick: (e) => { e.stopPropagation(); actions.toggleExport(); },
  }, icon(I.download, { size: 16, sw: 2 }), h('span.lbl', { text: 'Export' }));

  const title = h('div.ed-pop-title', { id: 'ed-export-title' });
  const fmtBtns = FORMATS.map(([id, label]) => h('button.chip', { 'aria-pressed': 'false', text: label, onclick: () => { opts.fmt = id; render(); } }));
  const transparent = toggleRow('Transparent background', () => { opts.transparent = !opts.transparent; render(); }, { light: true });
  const embed = toggleRow('Keep it editable (embed diagram)', () => { opts.embed = !opts.embed; render(); }, { light: true });
  const scale = segmented([[1, '1×'], [2, '2×'], [3, '3×']], (v) => { opts.scale = v; render(); }, { cls: 'seg inline on-bg', ariaLabel: 'Scale' });
  const scaleRow = h('div.ed-pop-scale', null, h('span', { text: 'Scale' }), scale.el);
  const go = h('button.accentbtn.ed-pop-go', { onclick: () => run() });
  const note = h('span.ed-pop-note', { text: 'Rendered in your browser. Nothing is uploaded.' });

  const pop = h('div.ed-pop', { id: 'ed-export-pop', role: 'dialog', 'aria-labelledby': 'ed-export-title', hidden: true },
    title,
    h('div.ed-formats', { role: 'group', 'aria-label': 'Format' }, fmtBtns),
    h('div.ed-pop-opts', null, transparent.el, embed.el),
    scaleRow, go, note);
  pop.addEventListener('click', (e) => e.stopPropagation());

  function render() {
    FORMATS.forEach(([id], i) => setPressed(fmtBtns[i], opts.fmt === id));
    transparent.set(opts.transparent);
    embed.set(opts.embed);
    scale.set(opts.scale);
    // Options that do not apply to a format are disabled, not hidden, so the layout stays put.
    const img = opts.fmt === 'png' || opts.fmt === 'svg';
    transparent.el.disabled = !img;
    embed.el.disabled = !img;
    scaleRow.classList.toggle('is-off', opts.fmt !== 'png');
    scaleRow.querySelectorAll('button').forEach((b) => { b.disabled = opts.fmt !== 'png'; });
    go.textContent = opts.fmt === 'pdf' ? 'Print / Save as PDF' : 'Download ' + FORMATS.find((f) => f[0] === opts.fmt)[1];
    title.textContent = `Export “${actions.currentPageName()}”`;
  }

  function run() {
    store.set({ exportOpen: false });
    if (opts.fmt === 'pdf') actions.print();
    else actions.exportAs(opts.fmt, { scale: opts.scale, transparent: opts.transparent, embed: opts.embed });
  }

  function onDocClick(e) { if (!pop.contains(e.target) && e.target !== btn) store.set({ exportOpen: false }); }

  store.subscribe((st, prev) => {
    if (st.exportOpen === prev.exportOpen) return;
    pop.hidden = !st.exportOpen;
    btn.setAttribute('aria-expanded', st.exportOpen ? 'true' : 'false');
    if (st.exportOpen) {
      render();
      document.addEventListener('click', onDocClick);
      requestAnimationFrame(() => fmtBtns.find((b) => b.getAttribute('aria-pressed') === 'true').focus());
    } else {
      document.removeEventListener('click', onDocClick);
      if (pop.contains(document.activeElement)) btn.focus();
    }
  });
  render();

  return { el: h('div.ed-export-wrap', null, btn, pop) };
}
