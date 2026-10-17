// Local file IO wiring (WP4's io.js): Save/Save as/Open, export, print to
// PDF, IndexedDB drafts with a restore prompt, and drag-and-drop import.
// Pickers need user activation, so save/open call io synchronously from the
// originating click/keydown (no await before the io call).
import { h } from './dom.js';

const isCancel = (io, err) => (typeof io.isCancel === 'function' ? io.isCancel(err) : err && err.name === 'AbortError');
const baseName = (name) => String(name || 'Untitled').replace(/\.(ed|drawio|xml)(\.(png|svg))?$/i, '').replace(/\.(png|svg)$/i, '') || 'Untitled';

export function installFiles(ctx) {
  const { engine, io, store, actions, root } = ctx;
  const stage = ctx.stageEl;
  const toast = (...a) => ctx.toast(...a);
  let loading = false;       // suppress dirty/draft during engine.load
  let draftDecided = true;   // false while the restore prompt is pending
  let draftTimer = 0;
  let saving = false;

  const fail = (err) => { if (!isCancel(io, err)) toast((err && err.message) || 'Something went wrong', 'error'); };

  function load(xml, file, status) {
    loading = true;
    try { engine.load(xml); } finally { loading = false; }
    store.set({ file, status });
  }

  // ---- change -> draft
  let changeSeq = 0;         // bumps on every user edit; lets a save tell if edits raced it
  engine.on('change', () => {
    if (loading) return;
    changeSeq++;
    // "Saving…" is reserved for real file saves; edits are kept as a draft.
    if (!saving) store.set({ status: 'draft' });
    clearTimeout(draftTimer);
    draftTimer = setTimeout(writeDraft, 600);
  });
  function writeDraft() {
    if (!draftDecided) return; // never overwrite a draft the user hasn't answered for
    const name = store.get().file.name;
    Promise.resolve(io.saveDraft(engine.toXml(), name)).catch(() => false);
  }

  // ---- save / open
  actions.save = () => doSave(false);
  actions.saveAs = () => doSave(true);
  function doSave(as) {
    if (saving) return;
    store.set({ paletteOpen: false, exportOpen: false });
    const file = store.get().file;
    const prevStatus = store.get().status;
    const seqAtStart = changeSeq;
    let p;
    try { p = as ? io.saveAs(engine, file) : io.save(engine, file); } catch (err) { fail(err); return; }
    saving = true;
    store.set({ status: 'saving' });
    Promise.resolve(p).then((res) => {
      const next = { name: (res && res.name) || file.name, handle: (res && res.handle) || null };
      const clean = changeSeq === seqAtStart;
      store.set({ file: next, status: clean ? 'saved' : 'draft' });
      if (clean) {
        clearTimeout(draftTimer);
        Promise.resolve(io.clearDraft(file.name)).catch(() => {});
        if (next.name !== file.name) Promise.resolve(io.clearDraft(next.name)).catch(() => {});
      }
      toast(`Saved “${next.name}”`);
    }, (err) => {
      store.set({ status: changeSeq === seqAtStart ? prevStatus : 'draft' });
      fail(err);
    }).finally(() => { saving = false; });
  }

  actions.open = () => {
    store.set({ paletteOpen: false, exportOpen: false });
    if (store.get().status === 'draft' && !engine.isEmpty() &&
        !window.confirm('Open another file? Your unsaved changes stay in this browser as a draft.')) return;
    let p;
    try { p = io.openFile(); } catch (err) { fail(err); return; }
    Promise.resolve(p).then((res) => {
      load(res.xml, { name: res.name, handle: res.handle || null }, 'saved');
      dismissDraftPrompt();
      toast(`Opened “${res.name}”`);
    }, fail);
  };

  // ---- export / print
  actions.exportAs = (format, opts = {}) => {
    store.set({ paletteOpen: false, exportOpen: false });
    const page = actions.currentPageName();
    const name = format === 'ed' ? baseName(store.get().file.name) : `${baseName(store.get().file.name)}-${page}`;
    const o = { format, scale: opts.scale || 2, transparent: !!opts.transparent, embed: opts.embed !== false, name };
    let p;
    try { p = io.exportFile(engine, o); } catch (err) { fail(err); return; }
    Promise.resolve(p).then((res) => {
      const fname = (res && res.name) || `${name}.${format}`;
      toast(format === 'png' ? `Exported “${fname}” at ${o.scale}×` : `Exported “${fname}”`);
    }, fail);
  };

  const printHost = () => root.querySelector('.ed-print');
  actions.print = () => {
    store.set({ paletteOpen: false, exportOpen: false });
    const host = printHost();
    try {
      const svgText = engine.toSvg({ transparent: false, embed: false });
      const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
      const svg = doc.documentElement;
      if (svg && svg.nodeName.toLowerCase() === 'svg') {
        svg.removeAttribute('width'); svg.removeAttribute('height');
        // Drop anything executable before adopting the node into the page.
        svg.querySelectorAll('script, foreignObject iframe').forEach((n) => n.remove());
        host.replaceChildren(document.importNode(svg, true));
      }
    } catch (_) {
      // Fall back to the live canvas so the print is never blank.
      const live = ctx.canvas.querySelector('svg');
      host.replaceChildren(...(live ? [live.cloneNode(true)] : []));
    }
    window.print();
  };
  window.addEventListener('afterprint', () => { const host = printHost(); if (host) host.replaceChildren(); });

  // ---- draft restore prompt
  let prompt = null;
  function dismissDraftPrompt() {
    if (prompt) { prompt.remove(); prompt = null; }
    draftDecided = true;
  }
  function showDraftPrompt(draft) {
    draftDecided = false;
    const when = new Date(draft.savedAt || Date.now());
    const sameDay = when.toDateString() === new Date().toDateString();
    const stamp = sameDay ? when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : when.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    prompt = h('div.ed-draft', { role: 'alertdialog', 'aria-label': 'Restore draft', 'data-testid': 'draft-prompt' },
      h('span', { text: `You have an unsaved draft${draft.name ? ` of “${draft.name}”` : ''} from ${stamp}.` }),
      h('button.accentbtn', { text: 'Restore', onclick: () => {
        load(draft.xml, { name: draft.name || 'Untitled.ed', handle: null }, 'draft');
        dismissDraftPrompt();
        toast('Draft restored');
      } }),
      h('button.ghostbtn', { text: 'Discard', onclick: () => {
        Promise.resolve(io.clearDraft(draft.name)).catch(() => {});
        dismissDraftPrompt();
        // Edits made while the prompt was up still deserve a draft.
        if (store.get().status === 'draft') writeDraft();
      } }));
    stage.append(prompt);
  }
  Promise.resolve()
    .then(() => io.loadDraft())
    .then((d) => { if (d && d.xml) showDraftPrompt(d); })
    .catch(() => {});

  // ---- drag-and-drop file import
  let depth = 0;
  const msg = h('div.ed-dropmsg', { text: 'Drop to open', hidden: true, 'aria-hidden': 'true' });
  stage.append(msg);
  const hasFiles = (e) => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
  const setOver = (on) => { stage.classList.toggle('is-drop-target', on); msg.hidden = !on; };
  root.addEventListener('dragenter', (e) => { if (!hasFiles(e)) return; e.preventDefault(); depth++; setOver(true); });
  root.addEventListener('dragover', (e) => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
  root.addEventListener('dragleave', (e) => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) setOver(false); });
  root.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth = 0; setOver(false);
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file) return;
    if (store.get().status === 'draft' && !engine.isEmpty() &&
        !window.confirm(`Open “${file.name}”? Your unsaved changes stay in this browser as a draft.`)) return;
    Promise.resolve(io.importDroppedFile(file)).then((res) => {
      load(res.xml, { name: res.name, handle: null }, 'saved');
      dismissDraftPrompt();
      toast(`Opened “${res.name}”`);
    }, fail);
  });
}
