// Easy Diagram — file IO (WP4).
//
// Everything stays on the user's device: the File System Access API where
// the browser has it, a hidden <input type=file> / <a download> otherwise,
// and IndexedDB for drafts. No network requests, no third-party code.
//
// Contract (docs/features/easy-diagram/BUILD.md, "IO contract"):
//   openFile()                      -> Promise<{name, xml, handle|null}>
//   save(engine, file)              -> Promise<{name, handle|null}>
//   saveAs(engine, file)            -> Promise<{name, handle|null}>
//   exportFile(engine, opts)        -> Promise<{name}>   (triggers a download)
//   saveDraft(xml, name?)           -> Promise<boolean>  (never rejects)
//   loadDraft(name?)                -> Promise<{name, xml, savedAt}|null>
//   clearDraft(name?)               -> Promise<boolean>  (never rejects)
//   importDroppedFile(file)         -> Promise<{name, xml}>
// Extras: isCancel(err), IoError, parseDiagramBytes(name, bytes),
// extractXmlFromPng(bytes), embedXmlInPng(blob, xml).
//
// A user dismissing a picker rejects with a DOMException named 'AbortError'
// (test with isCancel). Every other failure is an IoError whose .message is
// a plain sentence fit for a toast (render it as text, never as HTML).
//
// Diagram XML is untrusted. It is only ever parsed with DOMParser and
// serialized back with XMLSerializer; label sanitizing is the engine's job.

const MAX_FILE_BYTES = 50 * 1024 * 1024;      // refuse anything bigger
const MAX_INFLATED_BYTES = 100 * 1024 * 1024; // decompression-bomb guard, per FILE (all pages/chunks share it)
const MAX_XML_CHARS = 100 * 1024 * 1024;      // cap on the normalised XML handed to the engine

// One decompression budget per opened file, shared by every page and chunk.
function newBudget() {
  return { left: MAX_INFLATED_BYTES };
}
const TOO_LARGE = 'The diagram is too large to open.';
const DEFAULT_NAME = 'Untitled';

export class IoError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'IoError';
    if (cause !== undefined) this.cause = cause;
  }
}

function abortError() {
  return new DOMException('The user cancelled.', 'AbortError');
}

export function isCancel(err) {
  return !!err && err.name === 'AbortError';
}

// ---------------------------------------------------------------------------
// Names

const KNOWN_EXT = /(\.drawio)?\.(drawio|xml|png|svg)$/i;

function cleanName(name) {
  let n = String(name == null ? '' : name)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (n.length > 120) n = n.slice(0, 120).trim();
  return n;
}

// "flow.drawio.png" -> "flow", "My diagram" -> "My diagram"
export function baseName(name) {
  const n = cleanName(name).replace(KNOWN_EXT, '').trim();
  return n || DEFAULT_NAME;
}

function drawioName(name) {
  return baseName(name) + '.drawio';
}

// ---------------------------------------------------------------------------
// Byte helpers

const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];

function isPng(bytes) {
  if (bytes.length < 8) return false;
  for (let i = 0; i < 8; i++) if (bytes[i] !== PNG_SIG[i]) return false;
  return true;
}

function latin1(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return s;
}

function utf8(bytes) {
  return new TextDecoder('utf-8').decode(bytes);
}

function binaryStringToBytes(s) {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

function base64ToBytes(b64) {
  let bin;
  try {
    bin = atob(String(b64).replace(/\s+/g, ''));
  } catch (e) {
    throw new IoError('The diagram data is corrupt (bad base64).', e);
  }
  return binaryStringToBytes(bin);
}

async function readStreamCapped(stream, budget) {
  const reader = stream.getReader();
  const parts = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > budget.left) {
      try { await reader.cancel(); } catch (_) { /* ignore */ }
      throw new IoError(TOO_LARGE);
    }
    parts.push(value);
  }
  budget.left -= total; // only successful inflates spend the budget
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

// format: 'deflate' (zlib, RFC 1950) or 'deflate-raw' (RFC 1951)
async function inflate(bytes, format, budget) {
  if (typeof DecompressionStream !== 'function') {
    throw new IoError('This browser cannot open compressed diagrams (no DecompressionStream).');
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
  return readStreamCapped(stream, budget);
}

function decodeUri(s) {
  try {
    return decodeURIComponent(s);
  } catch (e) {
    throw new IoError('The diagram data is corrupt (bad URI encoding).', e);
  }
}

// ---------------------------------------------------------------------------
// XML normalisation: whatever we were given, hand the engine a full,
// uncompressed <mxfile> string.

function parseXml(text, what) {
  let doc;
  try {
    doc = new DOMParser().parseFromString(text, 'application/xml');
  } catch (e) {
    throw new IoError(`The ${what} is not valid XML.`, e);
  }
  if (!doc || !doc.documentElement || doc.getElementsByTagName('parsererror').length > 0) {
    throw new IoError(`The ${what} is not valid XML.`);
  }
  return doc;
}

function childElements(node) {
  return Array.prototype.filter.call(node.childNodes, (n) => n.nodeType === 1);
}

async function inflateDiagramText(text, budget) {
  const raw = await inflate(base64ToBytes(text), 'deflate-raw', budget).catch((e) => {
    if (e instanceof IoError) throw e;
    throw new IoError('A page of this diagram is corrupt and could not be decompressed.', e);
  });
  // The inflated payload is encodeURIComponent output, i.e. ASCII.
  return decodeUri(latin1(raw));
}

let idCounter = 0;
function newId() {
  idCounter += 1;
  return 'ed-' + Date.now().toString(36) + '-' + idCounter.toString(36);
}

// Returns an uncompressed <mxfile> string, or throws IoError.
export async function normalizeDiagramXml(text, budget = newBudget()) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new IoError('The file is empty.');
  }
  const src = text.replace(/^\uFEFF/, '').trim();
  // Diagram files never carry a DTD. Refusing one up front means entity
  // expansion never reaches the parser (defence in depth over libxml's guard).
  if (/<!DOCTYPE|<!ENTITY/i.test(src)) {
    throw new IoError('This file contains a DTD, which diagram files never do, so it was not opened.');
  }
  const doc = parseXml(src, 'file');
  let root = doc.documentElement;

  if (root.nodeName === 'mxGraphModel' || root.nodeName === 'diagram') {
    const wrapper = parseXml('<mxfile/>', 'file');
    const mxfile = wrapper.documentElement;
    let diagram;
    if (root.nodeName === 'diagram') {
      diagram = wrapper.importNode(root, true);
    } else {
      diagram = wrapper.createElement('diagram');
      diagram.setAttribute('name', 'Page-1');
      diagram.appendChild(wrapper.importNode(root, true));
    }
    mxfile.appendChild(diagram);
    root = mxfile;
  }

  if (root.nodeName !== 'mxfile') {
    throw new IoError('This file is not a diagram (expected <mxfile> or <mxGraphModel>).');
  }
  const owner = root.ownerDocument;
  const diagrams = childElements(root).filter((n) => n.nodeName === 'diagram');
  if (diagrams.length === 0) {
    throw new IoError('This diagram file has no pages.');
  }

  for (const d of diagrams) {
    if (!d.getAttribute('id')) d.setAttribute('id', newId());
    const model = childElements(d).find((n) => n.nodeName === 'mxGraphModel');
    if (model) continue;
    const content = (d.textContent || '').trim();
    if (!content) {
      // Empty page: give it an empty model so every engine path sees one.
      while (d.firstChild) d.removeChild(d.firstChild);
      const m = owner.createElement('mxGraphModel');
      const r = owner.createElement('root');
      const c0 = owner.createElement('mxCell'); c0.setAttribute('id', '0');
      const c1 = owner.createElement('mxCell'); c1.setAttribute('id', '1'); c1.setAttribute('parent', '0');
      r.appendChild(c0); r.appendChild(c1); m.appendChild(r); d.appendChild(m);
      continue;
    }
    const inflated = content.charAt(0) === '<' ? content : await inflateDiagramText(content, budget);
    const inner = parseXml(inflated, 'diagram page').documentElement;
    if (inner.nodeName !== 'mxGraphModel') {
      throw new IoError('A page of this diagram is corrupt (no <mxGraphModel>).');
    }
    while (d.firstChild) d.removeChild(d.firstChild);
    d.appendChild(owner.importNode(inner, true));
  }

  const out = new XMLSerializer().serializeToString(root);
  if (out.length > MAX_XML_CHARS) throw new IoError(TOO_LARGE);
  return out;
}

// ---------------------------------------------------------------------------
// PNG: own chunk parser / writer.

function readU32(bytes, off) {
  return ((bytes[off] << 24) | (bytes[off + 1] << 16) | (bytes[off + 2] << 8) | bytes[off + 3]) >>> 0;
}

// Yields {type, start, length, dataStart} for every chunk up to IEND.
function* pngChunks(bytes) {
  let off = 8;
  while (off + 12 <= bytes.length) {
    const length = readU32(bytes, off);
    const type = String.fromCharCode(bytes[off + 4], bytes[off + 5], bytes[off + 6], bytes[off + 7]);
    const dataStart = off + 8;
    if (dataStart + length + 4 > bytes.length) {
      throw new IoError('The PNG file is truncated or corrupt.');
    }
    yield { type, start: off, length, dataStart };
    if (type === 'IEND') return;
    off = dataStart + length + 4;
  }
}

function decodeEmbeddedValue(value) {
  let v = value.trim();
  if (v.charAt(0) === '%') {
    // Java's URL encoder writes spaces as '+'; encodeURIComponent never
    // emits a bare '+', so this is safe (same as upstream).
    v = decodeUri(v.replace(/\+/g, ' '));
    if (v.charAt(0) === '%') v = decodeUri(v); // double-encoded content
  }
  return v;
}

// Returns the embedded diagram text (not yet normalised) or null.
export async function extractXmlFromPng(input, budget = newBudget()) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (!isPng(bytes)) throw new IoError('This is not a PNG file.');
  for (const c of pngChunks(bytes)) {
    if (c.type === 'IDAT' || c.type === 'IEND') break; // our chunks precede image data
    if (c.type !== 'tEXt' && c.type !== 'zTXt') continue;
    const data = bytes.subarray(c.dataStart, c.dataStart + c.length);
    const nul = data.indexOf(0);
    if (nul <= 0) continue;
    const keyword = latin1(data.subarray(0, nul));
    if (keyword !== 'mxfile' && keyword !== 'mxGraphModel') continue;
    let text;
    if (c.type === 'tEXt') {
      text = latin1(data.subarray(nul + 1));
    } else {
      // zTXt: keyword \0 method(1 byte, 0 = deflate) compressed-data
      const payload = data.subarray(nul + 2);
      let raw;
      try {
        raw = await inflate(payload, 'deflate', budget);
      } catch (e) {
        if (e instanceof IoError && e.message === TOO_LARGE) throw e;
        try {
          // Older CLI builds wrote a raw DEFLATE stream.
          raw = await inflate(payload, 'deflate-raw', budget);
        } catch (e2) {
          if (e2 instanceof IoError && e2.message === TOO_LARGE) throw e2;
          throw new IoError('The diagram embedded in this PNG is corrupt.', e2);
        }
      }
      text = latin1(raw);
    }
    const value = decodeEmbeddedValue(text);
    if (value) return value;
  }
  return null;
}

let crcTable = null;
function crc32(bytes, crc = 0xffffffff) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return crc >>> 0;
}

function u32(n) {
  return new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);
}

// Writes a tEXt 'mxfile' chunk (value = encodeURIComponent(xml), as upstream
// does) before the first IDAT, replacing any existing mxfile chunk.
export async function embedXmlInPng(blob, xml) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (!isPng(bytes)) throw new IoError('Cannot embed the diagram: the image is not a PNG.');
  const body = new TextEncoder().encode('tEXt' + 'mxfile\0' + encodeURIComponent(xml)); // all ASCII
  const chunk = [u32(body.length - 4), body, u32((crc32(body) ^ 0xffffffff) >>> 0)];
  const parts = [bytes.subarray(0, 8)];
  let inserted = false;
  for (const c of pngChunks(bytes)) {
    const whole = bytes.subarray(c.start, c.dataStart + c.length + 4);
    if (!inserted && (c.type === 'IDAT' || c.type === 'IEND')) {
      parts.push(...chunk);
      inserted = true;
    }
    if ((c.type === 'tEXt' || c.type === 'zTXt') && !inserted) {
      const data = bytes.subarray(c.dataStart, c.dataStart + c.length);
      const nul = data.indexOf(0);
      const kw = nul > 0 ? latin1(data.subarray(0, nul)) : '';
      if (kw === 'mxfile' || kw === 'mxGraphModel') continue; // drop stale copy
    }
    parts.push(whole);
  }
  if (!inserted) throw new IoError('Cannot embed the diagram: the PNG has no image data.');
  return new Blob(parts, { type: 'image/png' });
}

// ---------------------------------------------------------------------------
// SVG

function extractXmlFromSvgText(text) {
  if (/<!ENTITY/i.test(text) || /<!DOCTYPE[^>]*\[/i.test(text)) {
    throw new IoError('This SVG declares XML entities, so it was not opened.');
  }
  let doc;
  try {
    doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  } catch (e) {
    throw new IoError('The SVG file is not valid.', e);
  }
  if (!doc || doc.getElementsByTagName('parsererror').length > 0 || !doc.documentElement ||
      doc.documentElement.localName !== 'svg') {
    throw new IoError('The SVG file is not valid.');
  }
  const content = doc.documentElement.getAttribute('content');
  if (!content || !content.trim()) return null;
  let v = content.trim();
  if (v.charAt(0) !== '<' && v.charAt(0) !== '%') {
    // Old upstream format: base64 of (possibly URI-encoded) XML.
    const bin = latin1(base64ToBytes(v));
    v = bin.charAt(0) === '%' ? bin : utf8(binaryStringToBytes(bin));
  }
  return decodeEmbeddedValue(v);
}

function addSvgContent(svg, xml) {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  if (doc.getElementsByTagName('parsererror').length > 0) return svg;
  doc.documentElement.setAttribute('content', xml);
  return new XMLSerializer().serializeToString(doc);
}

// ---------------------------------------------------------------------------
// Format detection (shared by openFile and importDroppedFile)

const UNSUPPORTED = 'Unsupported file. Open a .drawio or .xml diagram, or a .png/.svg exported with the diagram embedded.';

// bytes: Uint8Array. Returns {kind: 'xml'|'png'|'svg', xml}.
export async function parseDiagramBytes(name, bytes) {
  if (!bytes || bytes.length === 0) throw new IoError('The file is empty.');
  if (bytes.length > MAX_FILE_BYTES) throw new IoError('The file is too large to open (limit 50 MB).');
  const lower = String(name || '').toLowerCase();

  if (isPng(bytes)) {
    const budget = newBudget();
    const embedded = await extractXmlFromPng(bytes, budget);
    if (!embedded) throw new IoError('This PNG has no embedded diagram. Export with "Embed diagram" on to make it editable.');
    return { kind: 'png', xml: await normalizeDiagramXml(embedded, budget) };
  }
  if (/\.(png|jpe?g|gif|webp|pdf|vsdx?|zip)$/.test(lower)) throw new IoError(UNSUPPORTED);

  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (e) {
    throw new IoError(UNSUPPORTED, e);
  }
  text = text.replace(/^﻿/, '');
  const head = text.slice(0, 2048);
  if (lower.endsWith('.svg') || /<svg[\s>]/.test(head) && !/<mxfile[\s>]/.test(head)) {
    const embedded = extractXmlFromSvgText(text);
    if (!embedded) throw new IoError('This SVG has no embedded diagram. Export with "Embed diagram" on to make it editable.');
    return { kind: 'svg', xml: await normalizeDiagramXml(embedded) };
  }
  if (!/^\s*</.test(text)) throw new IoError(UNSUPPORTED);
  return { kind: 'xml', xml: await normalizeDiagramXml(text) };
}

async function readFileObject(file) {
  if (!file || typeof file.arrayBuffer !== 'function') throw new IoError('No file to open.');
  if (file.size > MAX_FILE_BYTES) throw new IoError('The file is too large to open (limit 50 MB).');
  let buf;
  try {
    buf = await file.arrayBuffer();
  } catch (e) {
    throw new IoError('The file could not be read.', e);
  }
  return new Uint8Array(buf);
}

async function fileToDiagram(file) {
  const parsed = await parseDiagramBytes(file.name, await readFileObject(file));
  // An image keeps its pixels: saving must never overwrite it with XML.
  const name = parsed.kind === 'xml' ? cleanName(file.name) || drawioName(file.name) : drawioName(file.name);
  return { name, xml: parsed.xml, kind: parsed.kind };
}

export async function importDroppedFile(file) {
  const { name, xml } = await fileToDiagram(file);
  return { name, xml };
}

// ---------------------------------------------------------------------------
// Open

const OPEN_ACCEPT = '.drawio,.xml,.svg,.png,application/xml,text/xml,image/svg+xml,image/png';

function hasOpenPicker() {
  return typeof window.showOpenFilePicker === 'function';
}

// Must be called from a user gesture (no await before it in the caller).
export function openFile() {
  if (hasOpenPicker()) return openWithPicker();
  return openWithInput();
}

async function openWithPicker() {
  let handles;
  try {
    handles = await window.showOpenFilePicker({
      multiple: false,
      types: [{
        description: 'Diagrams',
        accept: {
          'application/xml': ['.drawio', '.xml'],
          'image/svg+xml': ['.svg'],
          'image/png': ['.png'],
        },
      }],
    });
  } catch (e) {
    if (isCancel(e)) throw abortError();
    // No fallback to the <input> here: after an await the user activation is
    // gone, so input.click() would be silently ignored and never settle.
    throw new IoError('The file picker could not be opened.', e);
  }
  const handle = handles && handles[0];
  if (!handle) throw abortError();
  let file;
  try {
    file = await handle.getFile();
  } catch (e) {
    throw new IoError('The file could not be read.', e);
  }
  const d = await fileToDiagram(file);
  return { name: d.name, xml: d.xml, handle: d.kind === 'xml' ? handle : null };
}

function openWithInput() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = OPEN_ACCEPT;
    input.hidden = true;
    let settled = false;
    let focusTimer = 0;

    const cleanup = () => {
      settled = true;
      clearTimeout(focusTimer);
      window.removeEventListener('focus', onFocus, true);
      input.remove();
    };
    const onFocus = () => {
      // Fallback cancel detection for browsers without the 'cancel' event:
      // focus returns to the page; if no file arrives soon, treat as cancel.
      clearTimeout(focusTimer);
      focusTimer = setTimeout(() => {
        if (!settled && !(input.files && input.files.length)) { cleanup(); reject(abortError()); }
      }, 1500);
    };

    input.addEventListener('change', () => {
      if (settled) return;
      const file = input.files && input.files[0];
      cleanup();
      if (!file) { reject(abortError()); return; }
      fileToDiagram(file).then(
        (d) => resolve({ name: d.name, xml: d.xml, handle: null }),
        reject,
      );
    });
    input.addEventListener('cancel', () => {
      if (!settled) { cleanup(); reject(abortError()); }
    });
    window.addEventListener('focus', onFocus, true);
    document.body.appendChild(input);
    input.click();
  });
}

// ---------------------------------------------------------------------------
// Save

function engineXml(engine) {
  if (!engine || typeof engine.toXml !== 'function') throw new IoError('Nothing to save.');
  let xml;
  try {
    xml = engine.toXml();
  } catch (e) {
    throw new IoError('The diagram could not be serialized.', e);
  }
  if (typeof xml !== 'string' || !xml.trim()) throw new IoError('The diagram could not be serialized.');
  return xml;
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  a.hidden = true;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke later: Safari starts the download asynchronously.
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function writeToHandle(handle, data) {
  if (typeof handle.queryPermission === 'function') {
    let state = 'granted';
    try { state = await handle.queryPermission({ mode: 'readwrite' }); } catch (_) { /* ignore */ }
    if (state !== 'granted' && typeof handle.requestPermission === 'function') {
      state = await handle.requestPermission({ mode: 'readwrite' });
      if (state !== 'granted') throw new DOMException('Write permission denied.', 'NotAllowedError');
    }
  }
  const w = await handle.createWritable();
  try {
    await w.write(data);
    await w.close();
  } catch (e) {
    try { await w.abort(); } catch (_) { /* ignore */ }
    throw e;
  }
}

const XML_BLOB_TYPE = 'application/vnd.jgraph.mxfile';

function pickerFallsBack(e) {
  // No user activation, sandboxed/cross-origin frame, bad options:
  // fall back to a plain download rather than failing the save.
  return !!e && (e.name === 'SecurityError' || e.name === 'NotAllowedError' || e instanceof TypeError);
}

async function saveWithPickerOrDownload(xml, name) {
  if (typeof window.showSaveFilePicker === 'function') {
    let handle = null;
    try {
      handle = await window.showSaveFilePicker({
        suggestedName: name,
        types: [{ description: 'Diagram', accept: { 'application/xml': ['.drawio'] } }],
      });
    } catch (e) {
      if (isCancel(e)) throw abortError();
      if (!pickerFallsBack(e)) throw new IoError('The save dialog could not be opened.', e);
    }
    if (handle) {
      try {
        await writeToHandle(handle, new Blob([xml], { type: XML_BLOB_TYPE }));
      } catch (e) {
        if (isCancel(e)) throw abortError();
        throw new IoError('The file could not be written.', e);
      }
      return { name: handle.name || name, handle };
    }
  }
  downloadBlob(new Blob([xml], { type: XML_BLOB_TYPE }), name);
  return { name, handle: null };
}

export async function save(engine, file) {
  const xml = engineXml(engine);
  const f = file || {};
  const handle = f.handle && typeof f.handle.createWritable === 'function' ? f.handle : null;
  if (handle) {
    try {
      await writeToHandle(handle, new Blob([xml], { type: XML_BLOB_TYPE }));
      return { name: handle.name || drawioName(f.name), handle };
    } catch (e) {
      if (isCancel(e)) throw abortError();
      // Permission denied, file moved/deleted, read-only volume...:
      // ask where to save instead of losing the work.
    }
  }
  return saveWithPickerOrDownload(xml, drawioName(f.name));
}

export async function saveAs(engine, file) {
  const xml = engineXml(engine);
  return saveWithPickerOrDownload(xml, drawioName((file || {}).name));
}

// ---------------------------------------------------------------------------
// Export

async function pngHasDiagram(blob) {
  try {
    return !!(await extractXmlFromPng(new Uint8Array(await blob.arrayBuffer())));
  } catch (_) {
    return false;
  }
}

export async function exportFile(engine, opts) {
  const o = opts || {};
  const format = String(o.format || '').toLowerCase();
  const base = baseName(o.name);
  const scale = [1, 2, 3].includes(Number(o.scale)) ? Number(o.scale) : 1;
  const transparent = !!o.transparent;
  const embed = !!o.embed;
  if (!engine) throw new IoError('Nothing to export.');

  if (format === 'drawio') {
    const name = base + '.drawio';
    downloadBlob(new Blob([engineXml(engine)], { type: XML_BLOB_TYPE }), name);
    return { name };
  }

  if (format === 'svg') {
    let svg;
    try {
      svg = engine.toSvg({ transparent, embed });
    } catch (e) {
      throw new IoError('The SVG export failed.', e);
    }
    if (typeof svg !== 'string' || !/<svg[\s>]/.test(svg)) throw new IoError('The SVG export failed.');
    if (embed && !/<svg[^>]*\scontent=/.test(svg)) svg = addSvgContent(svg, engineXml(engine));
    if (!/^\s*<\?xml/.test(svg)) svg = '<?xml version="1.0" encoding="UTF-8"?>\n' + svg;
    const name = base + (embed ? '.drawio.svg' : '.svg');
    downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), name);
    return { name };
  }

  if (format === 'png') {
    let blob;
    try {
      blob = await engine.toPngBlob({ scale, transparent, embed });
    } catch (e) {
      throw new IoError('The PNG export failed.', e);
    }
    if (!(blob instanceof Blob) || blob.size === 0) throw new IoError('The PNG export failed.');
    if (embed && !(await pngHasDiagram(blob))) blob = await embedXmlInPng(blob, engineXml(engine));
    const name = base + (embed ? '.drawio.png' : '.png');
    downloadBlob(blob.type === 'image/png' ? blob : new Blob([blob], { type: 'image/png' }), name);
    return { name };
  }

  throw new IoError('Unknown export format: ' + format);
}

// ---------------------------------------------------------------------------
// Drafts (IndexedDB). Never rejects; private mode / blocked storage just
// means no drafts.
//
// One draft per (tab, document name): two tabs both editing "Untitled.drawio",
// or two different files that share a name, never overwrite each other. The
// tab id lives in sessionStorage, so it survives a reload of the same tab.
// The public API is name-based and unchanged:
//   saveDraft(xml, name?)  writes this tab's draft for `name`.
//   loadDraft(name)        this tab's draft for `name`.
//   loadDraft()            the most recent draft from ANY tab. If it belongs
//                          to another tab, it is moved to this tab, so that a
//                          later clearDraft(draft.name) or saveDraft(.., name)
//                          here acts on that same record.
//   clearDraft(name)       this tab's draft for `name`.
//   clearDraft()           every draft.

const DB_NAME = 'easy-diagram';
const DB_VERSION = 2; // v2: records keyed by tab + name (v1 was name only)
const STORE = 'drafts';
const MAX_DRAFTS = 20;
const TAB_KEY = 'easyDiagram.tabId';

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    let req;
    try {
      if (typeof indexedDB === 'undefined' || !indexedDB) throw new Error('no indexedDB');
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) {
      reject(e);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      // v1 drafts were keyed by name only and never shipped; start clean.
      if (db.objectStoreNames.contains(STORE)) db.deleteObjectStore(STORE);
      db.createObjectStore(STORE, { keyPath: 'key' });
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { try { db.close(); } catch (_) { /* ignore */ } dbPromise = null; };
      db.onclose = () => { dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => reject(req.error || new Error('indexedDB open failed'));
    req.onblocked = () => reject(new Error('indexedDB blocked'));
  });
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

async function tx(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let result;
    const r = fn(store);
    if (r) r.onsuccess = () => { result = r.result; };
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('transaction aborted'));
  });
}

let memoryTabId = null;
function randomId() {
  try {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
  } catch (_) { /* insecure context */ }
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}
function tabId() {
  if (memoryTabId) return memoryTabId;
  try {
    const id = sessionStorage.getItem(TAB_KEY);
    if (id) { memoryTabId = id; return id; }
  } catch (_) { /* storage blocked */ }
  memoryTabId = randomId();
  try { sessionStorage.setItem(TAB_KEY, memoryTabId); } catch (_) { /* storage blocked */ }
  return memoryTabId;
}

function draftName(name) {
  return cleanName(name) || DEFAULT_NAME;
}
function draftKey(name) {
  return tabId() + '\n' + draftName(name);
}
function publicDraft(rec) {
  return { name: rec.name, xml: rec.xml, savedAt: rec.savedAt };
}

let pendingDraft = null;
let draftWriting = null;

async function flushDrafts() {
  let ok = true;
  try {
    while (pendingDraft) {
      const rec = pendingDraft;
      pendingDraft = null;
      try {
        await tx('readwrite', (s) => s.put(rec));
      } catch (_) {
        ok = false;
      }
    }
  } finally {
    draftWriting = null;
  }
  return ok;
}

// Safe to call on every change: writes coalesce to the latest value.
export function saveDraft(xml, name) {
  try {
    if (typeof xml !== 'string' || !xml) return Promise.resolve(false);
    pendingDraft = { key: draftKey(name), tab: tabId(), name: draftName(name), xml, savedAt: Date.now() };
    if (!draftWriting) draftWriting = flushDrafts();
    return draftWriting;
  } catch (_) {
    return Promise.resolve(false);
  }
}

export async function loadDraft(name) {
  try {
    if (draftWriting) await draftWriting;
    if (name != null && name !== '') {
      const rec = await tx('readonly', (s) => s.get(draftKey(name)));
      return isDraft(rec) ? publicDraft(rec) : null;
    }
    const all = ((await tx('readonly', (s) => s.getAll())) || []).filter(isDraft);
    if (all.length === 0) return null;
    all.sort((a, b) => b.savedAt - a.savedAt);
    const stale = all.slice(MAX_DRAFTS).map((r) => r.key);
    const rec = all[0];
    const mine = draftKey(rec.name);
    if (rec.key !== mine || stale.length) {
      // Adopt another tab's draft (move, not copy, so it can't be offered
      // twice) and prune the oldest beyond MAX_DRAFTS, in one transaction.
      // Note: put before delete, so a failure never loses the draft.
      await tx('readwrite', (s) => {
        if (rec.key !== mine) {
          s.put({ key: mine, tab: tabId(), name: rec.name, xml: rec.xml, savedAt: rec.savedAt });
          s.delete(rec.key);
        }
        stale.forEach((k) => s.delete(k));
        return null;
      }).catch(() => {});
    }
    return publicDraft(rec);
  } catch (_) {
    return null;
  }
}

function isDraft(rec) {
  return !!rec && typeof rec.key === 'string' && typeof rec.name === 'string' &&
    typeof rec.xml === 'string' && rec.xml.length > 0 && typeof rec.savedAt === 'number';
}

export async function clearDraft(name) {
  try {
    const all = name == null || name === '';
    const key = all ? null : draftKey(name);
    if (pendingDraft && (all || pendingDraft.key === key)) pendingDraft = null;
    if (draftWriting) await draftWriting;
    await tx('readwrite', (s) => (all ? s.clear() : s.delete(key)));
    return true;
  } catch (_) {
    return false;
  }
}
