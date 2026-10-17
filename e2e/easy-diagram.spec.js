// /easy-diagram: a full-viewport, local-only diagram editor built on the
// vendored draw.io graph engine with our own "Precision" UI shell. See
// docs/features/easy-diagram.md and docs/features/easy-diagram/BUILD.md
// ("Testing and the evidence standard" is what this spec proves).
//
// The page exposes exactly one global for tests, window.__easyDiagram =
// {engine, io} (BUILD.md's IO contract), so model state is asserted through
// the engine's public API rather than by scraping the mxGraph SVG.
//
// Native pickers and print are stubbed with addInitScript:
//   - by default both File System Access pickers are removed, so Save is a
//     plain download and Open is an <input type=file> (Playwright's
//     'download' and 'filechooser' events), which is also exactly what
//     WebKit/Firefox users get;
//   - tests that need the in-place path install a fake FileSystemFileHandle;
//   - window.print is replaced by a counter.
// A real desktop-Chrome picker still needs a manual check; see
// Claude outputs/easy-diagram/evidence/REPORT.md.
//
// Every test also asserts, in afterEach, that the page logged no CSP
// violation (securitypolicyviolation events + console), no console error
// and no uncaught exception.
//
// Evidence (screenshots, network log) is written to
// "Claude outputs/easy-diagram/evidence/" by the tests tagged "evidence".
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const EVIDENCE = path.join(__dirname, '..', 'Claude outputs', 'easy-diagram', 'evidence');
const SHOTS = path.join(EVIDENCE, 'screenshots');

const EXACT_CSP = [
	"default-src 'self'",
	"script-src 'self'",
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data: blob:",
	"font-src 'self'",
	"connect-src 'self'",
	"worker-src 'self'",
	"object-src 'none'",
	"base-uri 'self'",
	"form-action 'none'",
	"frame-ancestors 'none'",
].join('; ');

test.use({ viewport: { width: 1440, height: 900 } });

// ---------------------------------------------------------------- harness

const diagnostics = new WeakMap();

// Installs the stubs and listeners, opens /easy-diagram and waits for the
// shell to boot. opts: {pickers: 'none'|'stub', reducedMotion, init}.
async function openEditor(page, opts = {}) {
	const diag = { console: [], pageErrors: [], requests: [] };
	diagnostics.set(page, diag);
	page.on('console', (m) => {
		if (m.type() === 'error' || /Content.Security.Policy|Refused to/i.test(m.text())) diag.console.push(m.text());
	});
	page.on('pageerror', (e) => diag.pageErrors.push(String(e)));
	page.on('request', (r) => diag.requests.push(r.url()));
	// confirm()/prompt() are accepted; a test sets diag.prompt to answer a prompt().
	page.on('dialog', (d) => d.accept(d.type() === 'prompt' ? diag.prompt : undefined).catch(() => {}));
	await page.addInitScript((o) => {
		window.__csp = [];
		document.addEventListener('securitypolicyviolation', (e) => {
			window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`);
		});
		window.__printCalls = 0;
		window.print = () => { window.__printCalls += 1; };
		window.__pickerCalls = { save: 0, open: 0 };
		window.__writes = [];
		if (o.pickers === 'stub') {
			// A fake FileSystemFileHandle that records what is written to it.
			const makeHandle = (name) => ({
				kind: 'file',
				name,
				queryPermission: async () => 'granted',
				requestPermission: async () => 'granted',
				createWritable: async () => {
					const parts = [];
					return {
						write: async (d) => { parts.push(d); },
						close: async () => {
							const text = await new Blob(parts).text();
							window.__writes.push({ name, text });
						},
						abort: async () => {},
					};
				},
				getFile: async () => new File([window.__openContent || ''], name),
			});
			window.showSaveFilePicker = async (options) => {
				window.__pickerCalls.save += 1;
				if (window.__pickerMode === 'abort') throw new DOMException('The user aborted a request.', 'AbortError');
				return makeHandle(window.__saveName || options.suggestedName);
			};
			window.showOpenFilePicker = async () => {
				window.__pickerCalls.open += 1;
				if (window.__pickerMode === 'abort') throw new DOMException('The user aborted a request.', 'AbortError');
				return [makeHandle(window.__openName || 'opened.drawio')];
			};
		} else {
			// No File System Access API: the download / <input type=file> path.
			window.showSaveFilePicker = undefined;
			window.showOpenFilePicker = undefined;
		}
	}, { pickers: opts.pickers || 'none' });
	if (opts.init) await page.addInitScript(opts.init);
	if (opts.reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/easy-diagram');
	await page.waitForFunction(() => window.__easyDiagram && window.__easyDiagram.engine && document.querySelector('.ed-stage'));
	return diag;
}

test.afterEach(async ({ page }, testInfo) => {
	const diag = diagnostics.get(page);
	if (!diag) return;
	let csp = [];
	try { csp = await page.evaluate(() => window.__csp || []); } catch (_) { /* page closed */ }
	expect(csp, 'CSP violation events').toEqual([]);
	expect(diag.console.filter((t) => /Content.Security.Policy|Refused to/i.test(t)), 'CSP console messages').toEqual([]);
	expect(diag.console, 'console errors').toEqual([]);
	expect(diag.pageErrors, 'uncaught page errors').toEqual([]);
	const foreign = diag.requests.filter((u) => !sameOrigin(u, testInfo.project.use.baseURL || page.url()));
	expect(foreign, 'requests to any origin other than the test server').toEqual([]);
});

function sameOrigin(u, base) {
	if (/^(data|blob):/.test(u)) return true;
	try { return new URL(u).origin === new URL(base).origin; } catch (_) { return false; }
}

const E = (page, fn, arg) => page.evaluate(fn, arg);
const cells = (page) => E(page, () => window.__easyDiagram.engine.cells());
const sel = (page) => E(page, () => window.__easyDiagram.engine.getSelection());
const cell = (page, id) => E(page, (i) => window.__easyDiagram.engine.getCell(i), id);
const shapes = async (page) => (await cells(page)).filter((c) => c.type === 'shape');
const edges = async (page) => (await cells(page)).filter((c) => c.type === 'edge');
// toXml stamps modified="<now>"; everything else must match exactly.
const stripModified = (xml) => xml.replace(/ modified="[^"]*"/, '');

// Page-space centre of a cell (engine.getScreenBounds is container-relative).
async function centerOf(page, id) {
	return E(page, (i) => {
		const e = window.__easyDiagram.engine;
		const b = e.getScreenBounds(i);
		const r = document.querySelector('.ed-canvas').getBoundingClientRect();
		return { x: r.left + b.x + b.w / 2, y: r.top + b.y + b.h / 2, w: b.w, h: b.h, left: r.left + b.x, top: r.top + b.y };
	}, id);
}

async function drag(page, from, to, steps = 12) {
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	await page.mouse.move(to.x, to.y, { steps });
	await page.mouse.up();
}

const toast = (page) => page.locator('.ed-toast');
const inspector = (page) => page.locator('#ed-insp');
const tool = (page, name) => page.locator(`.ed-tool[data-tool="${name}"]`);

async function shot(page, testInfo, name) {
	fs.mkdirSync(SHOTS, { recursive: true });
	await page.screenshot({ path: path.join(SHOTS, `${testInfo.project.name}-${name}.png`) });
}

// Reads a Playwright download into a Buffer.
async function readDownload(download) {
	const p = await download.path();
	return fs.readFileSync(p);
}

// Builds a diagram file in the page with upstream's own compressor
// (Graph.compress: deflate-raw + base64 of the URI-encoded model, exactly
// what app.diagrams.net writes with compressXml on).
async function upstreamCompressedTwoPages(page) {
	return E(page, () => {
		const p1 = '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>' +
			'<mxCell id="a" value="Alpha" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1"><mxGeometry x="40" y="40" width="120" height="60" as="geometry"/></mxCell>' +
			'<mxCell id="b" value="Beta" style="ellipse;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="240" y="40" width="120" height="60" as="geometry"/></mxCell>' +
			'<mxCell id="e" style="edgeStyle=orthogonalEdgeStyle;html=1;" edge="1" parent="1" source="a" target="b"><mxGeometry relative="1" as="geometry"/></mxCell>' +
			'</root></mxGraphModel>';
		const p2 = '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>' +
			'<mxCell id="c" value="Gamma" style="rhombus;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="40" y="40" width="100" height="80" as="geometry"/></mxCell>' +
			'</root></mxGraphModel>';
		/* global Graph */
		return '<mxfile host="app.diagrams.net" agent="test" version="32.4.1">' +
			`<diagram id="p1" name="Overview">${Graph.compress(p1)}</diagram>` +
			`<diagram id="p2" name="Details">${Graph.compress(p2)}</diagram></mxfile>`;
	});
}

// A tiny real PNG (from a canvas) with an mxfile tEXt or zTXt chunk placed
// before IDAT, the way upstream writes it. Returns a number[] of bytes.
async function pngWithEmbed(page, xml, chunk) {
	return E(page, async ({ xml: x, chunk: kind }) => {
		const c = document.createElement('canvas');
		c.width = 8; c.height = 8;
		c.getContext('2d').fillRect(0, 0, 4, 4);
		const png = new Uint8Array(await (await new Promise((r) => c.toBlob(r, 'image/png'))).arrayBuffer());
		const enc = (s) => Uint8Array.from(s, (ch) => ch.charCodeAt(0) & 0xff);
		const value = encodeURIComponent(x);
		let data;
		if (kind === 'zTXt') {
			const z = new Uint8Array(await new Response(new Blob([enc(value)]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
			data = new Uint8Array([...enc('mxfile'), 0, 0, ...z]);
		} else {
			data = new Uint8Array([...enc('mxfile'), 0, ...enc(value)]);
		}
		const type = enc(kind);
		const table = [];
		for (let n = 0; n < 256; n++) { let v = n; for (let k = 0; k < 8; k++) v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1; table[n] = v >>> 0; }
		const crcIn = new Uint8Array([...type, ...data]);
		let crc = 0xffffffff;
		for (const b of crcIn) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
		crc = (crc ^ 0xffffffff) >>> 0;
		const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
		const chunkBytes = [...u32(data.length), ...type, ...data, ...u32(crc)];
		// Insert right after IHDR (8-byte signature + 25-byte IHDR chunk).
		return [...png.subarray(0, 33), ...chunkBytes, ...png.subarray(33)];
	}, { xml, chunk });
}

// PNG chunk list (type, offset) of a byte array, plus the IHDR width.
function pngInfo(buf) {
	const chunks = [];
	let off = 8;
	while (off + 8 <= buf.length) {
		const len = buf.readUInt32BE(off);
		const type = buf.toString('latin1', off + 4, off + 8);
		chunks.push({ type, off, len, data: buf.subarray(off + 8, off + 8 + len) });
		if (type === 'IEND') break;
		off += 12 + len;
	}
	return { chunks, width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

// Opens a file through the no-picker <input type=file> path (Ctrl+O).
async function openViaChooser(page, file) {
	const [chooser] = await Promise.all([
		page.waitForEvent('filechooser'),
		page.keyboard.press('Control+o'),
	]);
	await chooser.setFiles(file);
}

// Drops a file on the editor with a real DataTransfer.
async function dropFile(page, name, text, mime = 'application/xml') {
	const dt = await page.evaluateHandle(({ n, t, m }) => {
		const d = new DataTransfer();
		d.items.add(new File([t], n, { type: m }));
		return d;
	}, { n: name, t: text, m: mime });
	const target = page.locator('.ed-stage');
	await target.dispatchEvent('dragenter', { dataTransfer: dt });
	await target.dispatchEvent('dragover', { dataTransfer: dt });
	await target.dispatchEvent('drop', { dataTransfer: dt });
}

// Builds a three-step flowchart purely through the UI and returns ids.
async function buildFlowchartViaUI(page) {
	await page.getByRole('button', { name: 'Add a shape' }).click();
	const label = inspector(page).getByRole('textbox', { name: 'Label', exact: true });
	await label.fill('Receive order');
	await label.press('Enter');
	const [first] = (await sel(page)).ids;
	await page.locator('.ed-plus[data-side="r"]').click();
	await label.fill('In stock?');
	await label.press('Enter');
	const [second] = (await sel(page)).ids;
	await page.locator('.ed-plus[data-side="b"]').click();
	await label.fill('Ship it');
	await label.press('Enter');
	const [third] = (await sel(page)).ids;
	return { first, second, third };
}

// ================================================================ Platform

test.describe('platform', () => {
	test('serves /easy-diagram standalone with the exact route CSP', async ({ page }) => {
		const res = await page.request.get('/easy-diagram');
		expect(res.status()).toBe(200);
		expect(res.headers()['content-security-policy']).toBe(EXACT_CSP);
		const html = await res.text();
		expect(html).not.toMatch(/<script>(?!\s*<\/script>)/); // no inline scripts
		expect(html).not.toContain('htmx');
		// Every resource the page references is same-origin.
		for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) expect(m[1]).toMatch(/^\/static\/easydiagram\//);

		await openEditor(page);
		await expect(page).toHaveTitle(/Easy Diagram/);
		await expect(page.locator('#primary-nav')).toHaveCount(0);
		await expect(page.locator('footer')).toHaveCount(0);
		// The trademark rule: the draw.io name never shows in the UI.
		const text = await page.evaluate(() => document.body.innerText + ' ' +
			[...document.querySelectorAll('[title],[aria-label],[placeholder]')].map((e) => [e.title, e.getAttribute('aria-label'), e.placeholder].join(' ')).join(' '));
		// (".drawio" is the file extension, which the format requires; the name is not.)
		expect(text).not.toMatch(/draw\.io|diagrams\.net/i);
	});

	test('an HTMX request to /easy-diagram is redirected to a full load', async ({ page }) => {
		const res = await page.request.get('/easy-diagram', { headers: { 'HX-Request': 'true' } });
		expect(res.headers()['hx-redirect']).toBe('/easy-diagram');
	});

	test('the /projects card opens the editor with a full page load', async ({ page }) => {
		await page.goto('/projects');
		const open = page.locator('.project-card').filter({ hasText: 'Easy Diagram' }).getByRole('link', { name: 'Open' });
		await expect(open).toHaveAttribute('href', '/easy-diagram');
		expect(await open.getAttribute('hx-get')).toBeNull();
		await page.evaluate(() => { window.__marker = true; });
		const [res] = await Promise.all([
			page.waitForResponse((r) => new URL(r.url()).pathname === '/easy-diagram'),
			open.click(),
		]);
		expect(res.headers()['content-security-policy']).toBe(EXACT_CSP);
		await page.waitForFunction(() => window.__easyDiagram);
		expect(await page.evaluate(() => window.__marker)).toBeUndefined();
	});
});

// ================================================================ Engine

test.describe('engine', () => {
	test('update, add, remove and duplicate are each one undo step', async ({ page }) => {
		await openEditor(page);
		const r = await E(page, () => {
			const e = window.__easyDiagram.engine;
			const out = {};
			const a = e.addShape('rect');
			const b = e.addShape('ellipse');
			e.connect(a, b);
			out.start = e.cells().length;
			e.undo(); out.afterUndoConnect = e.cells().length; e.redo();
			const before = JSON.stringify(e.getCell(a));
			e.update(a, { color: 'pink', label: 'Changed', x: 500, w: 220, strokeWidth: 3, opacity: 40, shadow: false, anim: { name: 'pulse', trigger: 'hover', speed: 'fast' } });
			out.updated = e.getCell(a);
			e.undo();
			out.updateUndone = JSON.stringify(e.getCell(a)) === before;
			e.redo();
			out.updateRedone = e.getCell(a).color === 'pink';
			const dup = e.duplicate([a]);
			out.afterDup = e.cells().length;
			e.undo();
			out.dupUndone = e.cells().length === out.start && !e.getCell(dup[0]);
			e.remove([a]); // takes its edge with it
			out.afterRemove = e.cells().length;
			e.undo();
			out.removeUndone = e.cells().length === out.start && e.getCell(a) && e.cells().some((c) => c.type === 'edge');
			e.undo(); e.undo(); e.undo(); e.undo(); // update, connect, add b, add a
			out.allUndone = e.isEmpty() && !e.canUndo();
			return out;
		});
		expect(r.start).toBe(3);
		expect(r.afterUndoConnect).toBe(2);
		expect(r.updated).toMatchObject({ color: 'pink', label: 'Changed', x: 500, w: 220, strokeWidth: 3, opacity: 40, shadow: false, anim: { name: 'pulse', trigger: 'hover', speed: 'fast' } });
		expect(r.updateUndone).toBe(true);
		expect(r.updateRedone).toBe(true);
		expect(r.afterDup).toBe(4);
		expect(r.dupUndone).toBe(true);
		expect(r.afterRemove).toBe(1);
		expect(r.removeUndone).toBe(true);
		expect(r.allUndone).toBe(true);
	});

	test('a two-page document round-trips through toXml and load, edAnim keys included', async ({ page }) => {
		await openEditor(page);
		const r = await E(page, () => {
			const e = window.__easyDiagram.engine;
			const a = e.addShape('rect', { x: 0, y: 0, label: 'One', color: 'green' });
			const b = e.addShape('diamond', { x: 300, y: 0, label: 'Two <b>&amp;</b>' });
			const ed = e.connect(a, b, { label: 'go' });
			e.update(a, { anim: { name: 'bounce', trigger: 'once', speed: 'slow' } });
			e.update(ed, { anim: { name: 'comet', speed: 'fast', direction: 'reverse' }, lineStyle: 'dotted', color: 'amber', width: 3 });
			const p2 = e.addPage('Second');
			e.addShape('note', { x: 10, y: 10, label: 'Sticky' });
			const snapshot = () => e.pages().map((p) => { e.selectPage(p.id); return { name: p.name, cells: e.cells() }; });
			const before = snapshot();
			const xml = e.toXml();
			e.load(xml);
			const after = snapshot();
			return { xml, before, after, p2, pages: e.pages() };
		});
		expect(r.after).toEqual(r.before);
		expect(r.pages.map((p) => p.name)).toEqual(['Page-1', 'Second']);
		expect(r.xml).toMatch(/^<mxfile /);
		expect((r.xml.match(/<diagram /g) || []).length).toBe(2);
		expect(r.xml).toContain('edAnim=bounce;');
		expect(r.xml).toContain('edAnimTrigger=once;');
		expect(r.xml).toContain('edAnimSpeed=slow;');
		expect(r.xml).toContain('edAnim=comet;');
		expect(r.xml).toContain('edAnimDir=reverse;');
		expect(r.xml).toContain('edAnimSpeed=fast;');
		// The label's markup is text, not HTML.
		expect(r.before[0].cells.find((c) => c.kind === 'diamond').label).toBe('Two <b>&amp;</b>');
	});

	test('loads an upstream compressed <diagram>', async ({ page }) => {
		await openEditor(page);
		const xml = await upstreamCompressedTwoPages(page);
		expect(xml).not.toContain('<mxGraphModel');
		const r = await E(page, (x) => {
			const e = window.__easyDiagram.engine;
			e.load(x);
			const p = e.pages();
			const first = e.cells();
			e.selectPage(p[1].id);
			return { pages: p, first, second: e.cells() };
		}, xml);
		expect(r.pages).toEqual([{ id: 'p1', name: 'Overview' }, { id: 'p2', name: 'Details' }]);
		expect(r.first.map((c) => c.label)).toEqual(['Alpha', 'Beta', '']);
		expect(r.first.find((c) => c.label === 'Beta').kind).toBe('ellipse');
		expect(r.second).toHaveLength(1);
		expect(r.second[0]).toMatchObject({ label: 'Gamma', kind: 'diamond' });
	});

	test('PNG export embeds a tEXt mxfile chunk before IDAT; SVG export embeds content', async ({ page }) => {
		await openEditor(page);
		const r = await E(page, async () => {
			const e = window.__easyDiagram.engine;
			const a = e.addShape('rect', { label: 'Embed me' });
			e.update(a, { anim: { name: 'glow' } });
			const blob = await e.toPngBlob({ scale: 2, embed: true });
			const svg = e.toSvg({ embed: true });
			const plain = await e.toPngBlob({ scale: 1, embed: false });
			return { png: Array.from(new Uint8Array(await blob.arrayBuffer())), plain: Array.from(new Uint8Array(await plain.arrayBuffer())), svg, xml: e.toXml() };
		});
		const png = pngInfo(Buffer.from(r.png));
		const types = png.chunks.map((c) => c.type);
		const text = png.chunks.findIndex((c) => (c.type === 'tEXt' || c.type === 'zTXt') && c.data.toString('latin1').startsWith('mxfile\0'));
		expect(text).toBeGreaterThan(0);
		expect(text).toBeLessThan(types.indexOf('IDAT'));
		const embedded = decodeURIComponent(png.chunks[text].data.toString('latin1').slice('mxfile\0'.length));
		expect(stripModified(embedded)).toBe(stripModified(r.xml));
		expect(pngInfo(Buffer.from(r.plain)).chunks.some((c) => c.data.toString('latin1').startsWith('mxfile\0'))).toBe(false);
		// Scale 2 doubles the diagram; the 16px border (as upstream's getSvg) is not scaled.
		expect(Math.abs((png.width - 32) - 2 * (pngInfo(Buffer.from(r.plain)).width - 32))).toBeLessThanOrEqual(2);

		const content = await E(page, (svg) => new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement.getAttribute('content'), r.svg);
		expect(stripModified(content)).toBe(stripModified(r.xml));
		expect(r.svg).toContain('edAnim=glow');
		expect(r.svg).not.toMatch(/drawio\.com|diagrams\.net|draw\.io/i);
	});

	test('the + handle adds a connected step; corner resize and drag move are undoable', async ({ page }) => {
		await openEditor(page);
		const a = await E(page, () => window.__easyDiagram.engine.addShape('rect', { x: 100, y: 100, label: 'Source' }));
		await expect(page.locator('.ed-plus')).toHaveCount(4);
		await expect(page.locator('.ed-plus[data-side="r"]')).toHaveAttribute('aria-label', 'Add connected step to the right');
		await page.locator('.ed-plus[data-side="r"]').click();
		const s = await sel(page);
		expect(s.type).toBe('shape');
		const added = await cell(page, s.ids[0]);
		const src = await cell(page, a);
		expect(added.x).toBeGreaterThan(src.x + src.w);
		const es = await edges(page);
		expect(es).toHaveLength(1);
		expect(es[0]).toMatchObject({ source: a, target: added.id });

		// Corner resize (se) by +60, +40 screen px at 100% zoom.
		await E(page, (i) => window.__easyDiagram.engine.select([i]), a);
		await E(page, () => window.__easyDiagram.engine.zoomTo(1));
		const before = await cell(page, a);
		const cornerEl = page.locator(`.ed-frame[data-cell-id="${a}"] .ed-corner[data-c="se"]`);
		await expect(cornerEl).toBeVisible();
		await page.waitForTimeout(100);
		const corner = await cornerEl.boundingBox();
		await drag(page, { x: corner.x + corner.width / 2, y: corner.y + corner.height / 2 }, { x: corner.x + corner.width / 2 + 60, y: corner.y + corner.height / 2 + 40 });
		const resized = await cell(page, a);
		expect(resized.w).toBeCloseTo(before.w + 60, -1);
		expect(resized.h).toBeCloseTo(before.h + 40, -1);
		expect(resized.x).toBe(before.x);
		await page.getByRole('button', { name: 'Undo' }).click();
		expect(await cell(page, a)).toMatchObject({ w: before.w, h: before.h });

		// Drag move.
		const c = await centerOf(page, a);
		await drag(page, { x: c.x, y: c.y }, { x: c.x + 120, y: c.y + 80 }, 20);
		const moved = await cell(page, a);
		expect(moved.x).toBeCloseTo(before.x + 120, -1);
		expect(moved.y).toBeCloseTo(before.y + 80, -1);
		await page.keyboard.press('Control+z');
		expect(await cell(page, a)).toMatchObject({ x: before.x, y: before.y });
	});

	test('the connector tool draws an edge between two shapes', async ({ page }) => {
		await openEditor(page);
		const [a, b] = await E(page, () => {
			const e = window.__easyDiagram.engine;
			const ids = [e.addShape('rect', { x: 80, y: 120, label: 'From' }), e.addShape('rect', { x: 420, y: 120, label: 'To' })];
			e.clearSelection();
			e.zoomTo(1);
			return ids;
		});
		await page.keyboard.press('a');
		await expect(tool(page, 'connector')).toHaveAttribute('aria-pressed', 'true');
		const pa = await centerOf(page, a);
		const pb = await centerOf(page, b);
		await drag(page, pa, pb, 20);
		const es = await edges(page);
		expect(es).toHaveLength(1);
		expect(es[0]).toMatchObject({ source: a, target: b });
		await expect(tool(page, 'select')).toHaveAttribute('aria-pressed', 'true');
	});

	test('hand tool pans and Ctrl+wheel zooms at the pointer, without moving the model', async ({ page }) => {
		await openEditor(page);
		const a = await E(page, () => {
			const e = window.__easyDiagram.engine;
			const id = e.addShape('rect', { x: 200, y: 200 });
			e.clearSelection();
			e.zoomTo(1);
			return id;
		});
		const before = await centerOf(page, a);
		await page.keyboard.press('h');
		await expect(tool(page, 'hand')).toHaveAttribute('aria-pressed', 'true');
		const box = await page.locator('.ed-canvas').boundingBox();
		const start = { x: box.x + box.width - 200, y: box.y + box.height - 200 };
		await drag(page, start, { x: start.x - 90, y: start.y - 50 });
		const after = await centerOf(page, a);
		expect(after.x - before.x).toBeCloseTo(-90, 0);
		expect(after.y - before.y).toBeCloseTo(-50, 0);
		expect(await cell(page, a)).toMatchObject({ x: 200, y: 200 });

		await page.keyboard.press('v');
		await page.mouse.move(after.x, after.y);
		await page.keyboard.down('Control');
		await page.mouse.wheel(0, -240);
		await page.keyboard.up('Control');
		await expect.poll(() => E(page, () => window.__easyDiagram.engine.getZoom())).toBeGreaterThan(1.2);
		// Zoom is anchored at the pointer: the shape under it stays put.
		const zoomed = await centerOf(page, a);
		expect(Math.abs(zoomed.x - after.x)).toBeLessThan(3);
		expect(Math.abs(zoomed.y - after.y)).toBeLessThan(3);
		await expect(page.locator('.ed-zoom-pct')).toHaveText(/^\d+%$/);
		expect(parseInt(await page.locator('.ed-zoom-pct').innerText(), 10)).toBeGreaterThan(120);
	});

	test('shape animation triggers: hover, once, loop; Motion off pauses', async ({ page }) => {
		await openEditor(page);
		const [a, b, c] = await E(page, () => {
			const e = window.__easyDiagram.engine;
			const ids = [e.addShape('rect', { x: 40, y: 40 }), e.addShape('rect', { x: 300, y: 40 }), e.addShape('rect', { x: 560, y: 40 })];
			e.update(ids[0], { anim: { name: 'pulse', trigger: 'hover' } });
			e.update(ids[1], { anim: { name: 'pop', trigger: 'once' } });
			e.update(ids[2], { anim: { name: 'wiggle', trigger: 'loop', speed: 'slow' } });
			e.clearSelection();
			return ids;
		});
		const nodeOf = (id) => E(page, (i) => {
			const g = window.__easyDiagram.engine._graph;
			const st = g.view.getState(g.getModel().getCell(i));
			const n = st.shape.node;
			const cs = getComputedStyle(n);
			return { cls: n.getAttribute('class') || '', play: cs.animationPlayState, name: cs.animationName, iter: cs.animationIterationCount, dur: cs.animationDuration };
		}, id);
		const hov = await nodeOf(a);
		expect(hov.cls).toContain('ed-na-pulse');
		expect(hov.cls).toContain('ed-hov');
		expect(hov.play).toBe('paused');
		const p = await centerOf(page, a);
		await page.mouse.move(p.x, p.y);
		await expect.poll(async () => (await nodeOf(a)).play).toBe('running');
		await page.mouse.move(p.x + 300, p.y + 300, { steps: 5 }); // off the shape, onto empty canvas
		await expect.poll(async () => (await nodeOf(a)).play).toBe('paused');

		expect((await nodeOf(b)).iter).toBe('1');
		const loop = await nodeOf(c);
		expect(loop.iter).toBe('infinite');
		expect(loop.name).toBe('edNWiggle');
		expect(parseFloat(loop.dur)).toBeCloseTo(1.8, 1); // wiggle 1s x slow 1.8

		await page.getByRole('button', { name: 'Motion' }).click();
		await expect(page.getByRole('button', { name: 'Motion' })).toHaveAttribute('aria-pressed', 'false');
		await expect(toast(page)).toHaveText('Animations paused');
		expect((await nodeOf(c)).play).toBe('paused');
		await page.getByRole('button', { name: 'Motion' }).click();
		expect((await nodeOf(c)).play).toBe('running');
	});

	test('prefers-reduced-motion turns animation off', async ({ page }) => {
		await openEditor(page, { reducedMotion: true });
		await expect(page.getByRole('button', { name: 'Motion' })).toHaveAttribute('aria-pressed', 'false');
		const r = await E(page, () => {
			const e = window.__easyDiagram.engine;
			const a = e.addShape('rect', { x: 40, y: 40 });
			const b = e.addShape('rect', { x: 300, y: 40 });
			e.update(a, { anim: { name: 'bounce' } });
			const ed = e.connect(a, b);
			e.update(ed, { anim: { name: 'flow' } });
			const g = e._graph;
			const n = g.view.getState(g.getModel().getCell(a)).shape.node;
			const ov = g.view.getState(g.getModel().getCell(ed)).shape.node.querySelector('.ed-ea-overlay');
			return { shape: getComputedStyle(n).animationName, overlay: ov ? getComputedStyle(ov).display : 'missing' };
		});
		expect(r.shape).toBe('none');
		expect(r.overlay).toBe('none');
	});

	test('light theme restyles the stage and shapes', async ({ page }) => {
		await openEditor(page);
		const id = await E(page, () => window.__easyDiagram.engine.addShape('rect', { color: 'green' }));
		const dark = await E(page, (i) => {
			const g = window.__easyDiagram.engine._graph;
			const st = g.view.getState(g.getModel().getCell(i));
			return { stage: getComputedStyle(document.querySelector('.ed-canvas')).backgroundColor, fill: st.style.fillColor, stroke: st.style.strokeColor };
		}, id);
		await page.getByRole('button', { name: 'Switch to light mode' }).click();
		const light = await E(page, (i) => {
			const g = window.__easyDiagram.engine._graph;
			const st = g.view.getState(g.getModel().getCell(i));
			return { stage: getComputedStyle(document.querySelector('.ed-canvas')).backgroundColor, fill: st.style.fillColor, stroke: st.style.strokeColor, theme: document.querySelector('.ed').dataset.theme };
		}, id);
		expect(dark.stage).toBe('rgb(13, 14, 17)');
		expect(light.stage).toBe('rgb(250, 250, 249)');
		expect(light.theme).toBe('light');
		expect(light.stroke).toBe(dark.stroke);
		expect(light.fill).not.toBe(dark.fill);
		// The file keeps the same colour name either way.
		expect((await cell(page, id)).color).toBe('green');
		await expect(page.getByRole('button', { name: 'Switch to dark mode' })).toBeVisible();
	});

	test('a hostile file with remote images and an <img onerror> label makes zero requests and runs nothing', async ({ page }) => {
		const diag = await openEditor(page);
		const hostile = '<mxfile><diagram id="h" name="Hostile"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>' +
			'<mxCell id="i" value="" style="shape=image;image=https://evil.example/track.png;" vertex="1" parent="1"><mxGeometry x="20" y="20" width="80" height="80" as="geometry"/></mxCell>' +
			'<mxCell id="l" value="&lt;img src=x onerror=&quot;window.__pwned=1&quot;&gt;&lt;img src=&quot;https://evil.example/label.png&quot;&gt;&lt;div style=&quot;background:url(https://evil.example/bg.png)&quot;&gt;hi&lt;/div&gt;" style="html=1;whiteSpace=wrap;fontSource=https%3A%2F%2Fevil.example%2Ffont.css;fontFamily=Evil;" vertex="1" parent="1"><mxGeometry x="200" y="20" width="160" height="80" as="geometry"/></mxCell>' +
			'</root></mxGraphModel></diagram></mxfile>';
		await page.waitForLoadState('networkidle');
		const n = diag.requests.length;
		await E(page, (x) => window.__easyDiagram.engine.load(x), hostile);
		// Also through the IO path, as a dropped file.
		await dropFile(page, 'hostile.drawio', hostile);
		await expect(toast(page)).toHaveText('Opened “hostile.drawio”');
		await page.waitForTimeout(800);
		expect(diag.requests.slice(n)).toEqual([]);
		expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
		const srcs = await page.evaluate(() => [...document.querySelectorAll('.ed-canvas img, .ed-canvas image')].map((i) => i.getAttribute('src') || i.getAttribute('href') || i.getAttribute('xlink:href')));
		for (const s of srcs) expect(s || '').not.toMatch(/evil|^x$/);
		expect(await shapes(page)).toHaveLength(2);
	});
});

// ================================================================ IO

test.describe('io', () => {
	test('opens an upstream compressed two-page .drawio from the file input', async ({ page }) => {
		await openEditor(page);
		const xml = await upstreamCompressedTwoPages(page);
		await openViaChooser(page, { name: 'upstream.drawio', mimeType: 'application/xml', buffer: Buffer.from(xml) });
		await expect(toast(page)).toHaveText('Opened “upstream.drawio”');
		await expect(page.getByTestId('file-name')).toHaveText('upstream.drawio');
		await expect(page.locator('.ed-tab')).toHaveText(['Overview', 'Details']);
		expect((await shapes(page)).map((c) => c.label)).toEqual(['Alpha', 'Beta']);
		await page.locator('.ed-tab', { hasText: 'Details' }).click();
		await expect(page.locator('.ed-tab', { hasText: 'Details' })).toHaveAttribute('aria-current', 'page');
		expect((await shapes(page)).map((c) => c.label)).toEqual(['Gamma']);
	});

	for (const chunk of ['zTXt', 'tEXt']) {
		test(`imports a PNG with an embedded ${chunk} diagram`, async ({ page }) => {
			await openEditor(page);
			const xml = await upstreamCompressedTwoPages(page);
			const bytes = await pngWithEmbed(page, xml, chunk);
			await openViaChooser(page, { name: 'flow.drawio.png', mimeType: 'image/png', buffer: Buffer.from(bytes) });
			await expect(toast(page)).toHaveText('Opened “flow.drawio”');
			await expect(page.locator('.ed-tab')).toHaveText(['Overview', 'Details']);
			expect((await shapes(page)).map((c) => c.label)).toEqual(['Alpha', 'Beta']);
		});
	}

	test('imports an SVG with an embedded content diagram', async ({ page }) => {
		await openEditor(page);
		const svg = await E(page, () => {
			const e = window.__easyDiagram.engine;
			e.addShape('hex', { label: 'From SVG' });
			const s = e.toSvg({ embed: true });
			e.load('<mxfile><diagram name="x"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>');
			return s;
		});
		await dropFile(page, 'thing.drawio.svg', svg, 'image/svg+xml');
		await expect(toast(page)).toHaveText('Opened “thing.drawio”');
		expect((await shapes(page))[0]).toMatchObject({ kind: 'hex', label: 'From SVG' });
	});

	const BAD_FILES = [
		['corrupt.drawio', '<mxfile><diagram name="p">%%%not-base64%%%</diagram></mxfile>', /corrupt/i],
		['truncated.drawio', '<mxfile><diagram name="p"><mxGraphModel><root>', /not valid XML/i],
		['plain.png', null, /no embedded diagram/i],
		['plain.svg', '<svg xmlns="http://www.w3.org/2000/svg" onload="window.__pwned=1"><script>window.__pwned=2</script><rect width="5" height="5"/></svg>', /no embedded diagram/i],
		['page.html', '<html><body><script>window.__pwned=3</script></body></html>', /not (a diagram|valid XML)/i],
		['dtd.drawio', '<?xml version="1.0"?><!DOCTYPE mxfile [<!ENTITY lol "lol">]><mxfile><diagram name="p">&lol;</diagram></mxfile>', /DTD/],
		['dtd-plain.drawio', '<!DOCTYPE mxfile><mxfile><diagram name="p"/></mxfile>', /DTD/],
		['entity.svg', '<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY a "b">]><svg xmlns="http://www.w3.org/2000/svg" content="&a;"/>', /entities/i],
		['empty.drawio', '', /empty/i],
		['notes.txt', 'just some text', /Unsupported file/i],
	];
	test('corrupt, embed-less and hostile files show an error toast, leave the canvas unchanged and run no script', async ({ page }) => {
		await openEditor(page);
		await E(page, () => window.__easyDiagram.engine.addShape('rect', { label: 'Keep me' }));
		const before = stripModified(await E(page, () => window.__easyDiagram.engine.toXml()));
		const plainPng = await E(page, async () => {
			const c = document.createElement('canvas'); c.width = 4; c.height = 4;
			return Array.from(new Uint8Array(await (await new Promise((r) => c.toBlob(r, 'image/png'))).arrayBuffer()));
		});
		for (const [name, text, msg] of BAD_FILES) {
			await E(page, () => document.querySelector('.ed-toasts').replaceChildren());
			const buffer = text == null ? Buffer.from(plainPng) : Buffer.from(text);
			await openViaChooser(page, { name, mimeType: 'application/octet-stream', buffer });
			await expect(toast(page), name).toHaveAttribute('data-kind', 'error');
			await expect(toast(page), name).toHaveText(msg);
			expect(stripModified(await E(page, () => window.__easyDiagram.engine.toXml())), name).toBe(before);
			await expect(page.getByTestId('file-name')).toHaveText('Untitled.drawio');
		}
		expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
	});

	test('the 100 MB decompression budget is enforced per file, across pages', async ({ page }) => {
		await openEditor(page);
		const r = await E(page, async () => {
			const io = window.__easyDiagram.io;
			const page64 = async (mb) => {
				const raw = new Uint8Array(mb * 1024 * 1024).fill(0x41); // 'A' is a valid URI-encoded char
				const z = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
				let bin = '';
				for (let i = 0; i < z.length; i += 0x8000) bin += String.fromCharCode.apply(null, z.subarray(i, i + 0x8000));
				return btoa(bin);
			};
			const bomb = `<mxfile><diagram name="a">${await page64(101)}</diagram></mxfile>`;
			// Page 1 must be a valid model to reach page 2: 60 MB of text inside <mxGraphModel>.
			const pageWithText = async (mb) => {
				const head = encodeURIComponent('<mxGraphModel><root><mxCell id="0"/></root><x>');
				const tail = encodeURIComponent('</x></mxGraphModel>');
				const raw = new Uint8Array(head.length + mb * 1024 * 1024 + tail.length).fill(0x41);
				raw.set(new TextEncoder().encode(head), 0);
				raw.set(new TextEncoder().encode(tail), raw.length - tail.length);
				const z = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
				let bin = '';
				for (let i = 0; i < z.length; i += 0x8000) bin += String.fromCharCode.apply(null, z.subarray(i, i + 0x8000));
				return btoa(bin);
			};
			const p60 = await pageWithText(60);
			const split = `<mxfile><diagram name="a">${p60}</diagram><diagram name="b">${p60}</diagram></mxfile>`;
			const out = {};
			for (const [k, x] of [['bomb', bomb], ['split', split]]) {
				try { await io.importDroppedFile(new File([x], k + '.drawio')); out[k] = 'opened'; } catch (e) { out[k] = e.message; }
			}
			out.bombBytes = bomb.length;
			return out;
		});
		expect(r.bombBytes).toBeLessThan(1024 * 1024); // a small file...
		expect(r.bomb).toBe('The diagram is too large to open.'); // ...that would inflate past 100 MB
		expect(r.split).toBe('The diagram is too large to open.');
	});

	test('Save without a picker downloads exactly toXml(), then the draft is cleared', async ({ page }) => {
		await openEditor(page);
		await expect(page.getByTestId('save-status')).toHaveText('Not saved yet');
		await page.keyboard.press('r');
		await expect(page.getByTestId('save-status')).toHaveText('Draft kept on this device');
		const [download] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Control+s')]);
		expect(download.suggestedFilename()).toBe('Untitled.drawio');
		const saved = (await readDownload(download)).toString('utf8');
		expect(stripModified(saved)).toBe(stripModified(await E(page, () => window.__easyDiagram.engine.toXml())));
		await expect(toast(page)).toHaveText('Saved “Untitled.drawio”');
		await expect(page.getByTestId('save-status')).toHaveText('Saved on this device');
		await expect.poll(() => E(page, () => window.__easyDiagram.io.loadDraft())).toBeNull();
		await page.reload();
		await page.waitForFunction(() => window.__easyDiagram);
		await page.waitForTimeout(500);
		await expect(page.getByTestId('draft-prompt')).toHaveCount(0);
	});

	test('in-place save: the first save picks a file, later saves write to the same handle', async ({ page }) => {
		await openEditor(page, { pickers: 'stub' });
		await page.evaluate(() => { window.__saveName = 'mine.drawio'; });
		await page.keyboard.press('r');
		await page.keyboard.press('Control+s');
		await expect(toast(page)).toHaveText('Saved “mine.drawio”');
		await expect(page.getByTestId('file-name')).toHaveText('mine.drawio');
		await page.keyboard.press('o');
		await page.keyboard.press('Control+s');
		await expect.poll(() => page.evaluate(() => window.__writes.length)).toBe(2);
		const r = await page.evaluate(() => ({ calls: window.__pickerCalls.save, writes: window.__writes, xml: window.__easyDiagram.engine.toXml() }));
		expect(r.calls).toBe(1);
		expect(r.writes.map((w) => w.name)).toEqual(['mine.drawio', 'mine.drawio']);
		expect(stripModified(r.writes[1].text)).toBe(stripModified(r.xml));
		expect(r.writes[1].text).toContain('edKind=ellipse');
		// Save as always asks again.
		await page.keyboard.press('Control+Shift+s');
		await expect.poll(() => page.evaluate(() => window.__pickerCalls.save)).toBe(2);
	});

	test('cancelling a picker (AbortError) shows no toast and changes nothing', async ({ page }) => {
		await openEditor(page, { pickers: 'stub' });
		await page.evaluate(() => { window.__pickerMode = 'abort'; });
		await page.keyboard.press('r');
		await page.keyboard.press('Control+s');
		await expect.poll(() => page.evaluate(() => window.__pickerCalls.save)).toBe(1);
		await expect(page.getByTestId('save-status')).toHaveText('Draft kept on this device');
		await page.keyboard.press('Control+o');
		await expect.poll(() => page.evaluate(() => window.__pickerCalls.open)).toBe(1);
		await page.waitForTimeout(400);
		await expect(toast(page)).toHaveCount(0);
		expect(await shapes(page)).toHaveLength(1);
	});

	test('opening through the picker keeps the handle for in-place save', async ({ page }) => {
		await openEditor(page, { pickers: 'stub' });
		const xml = await upstreamCompressedTwoPages(page);
		await page.evaluate((x) => { window.__openContent = x; window.__openName = 'remote.drawio'; }, xml);
		await page.keyboard.press('Control+o');
		await expect(toast(page)).toHaveText('Opened “remote.drawio”');
		await page.keyboard.press('Control+s');
		await expect.poll(() => page.evaluate(() => window.__writes.length)).toBe(1);
		expect(await page.evaluate(() => window.__pickerCalls.save)).toBe(0);
		expect(await page.evaluate(() => window.__writes[0].name)).toBe('remote.drawio');
	});

	test('export names, PNG scale, and an exported PNG re-imports to the same model', async ({ page }) => {
		await openEditor(page);
		await buildFlowchartViaUI(page);
		const model = await cells(page);
		const exportVia = async (fmt, scale, embed = true) => {
			await page.getByRole('button', { name: 'Export' }).click();
			const pop = page.locator('#ed-export-pop');
			await pop.getByRole('button', { name: fmt, exact: true }).click();
			if (scale) await pop.getByRole('button', { name: `${scale}×` }).click();
			const embedBtn = pop.getByRole('button', { name: /Keep it editable/ });
			if ((await embedBtn.getAttribute('aria-pressed')) !== String(embed) && await embedBtn.isEnabled()) await embedBtn.click();
			const [d] = await Promise.all([page.waitForEvent('download'), pop.locator('.ed-pop-go').click()]);
			return d;
		};
		const png3 = await exportVia('PNG', 3);
		expect(png3.suggestedFilename()).toBe('Untitled-Page-1.drawio.png');
		await expect(toast(page)).toHaveText('Exported “Untitled-Page-1.drawio.png” at 3×');
		const png3buf = await readDownload(png3);
		const png1 = await exportVia('PNG', 1, false);
		expect(png1.suggestedFilename()).toBe('Untitled-Page-1.png');
		const w1 = pngInfo(await readDownload(png1)).width;
		// 3x diagram, unscaled 16px border on each side.
		expect(Math.abs((pngInfo(png3buf).width - 32) - 3 * (w1 - 32))).toBeLessThanOrEqual(3);
		const svg = await exportVia('SVG');
		expect(svg.suggestedFilename()).toBe('Untitled-Page-1.drawio.svg');
		expect((await readDownload(svg)).toString('utf8')).toMatch(/<svg[^>]* content="/);
		const dio = await exportVia('.drawio');
		expect(dio.suggestedFilename()).toBe('Untitled.drawio');

		// Re-import the embedded 3x PNG into a fresh page state.
		await E(page, () => window.__easyDiagram.engine.load('<mxfile><diagram name="blank"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>'));
		expect(await cells(page)).toEqual([]);
		await openViaChooser(page, { name: 'Untitled-Page-1.drawio.png', mimeType: 'image/png', buffer: png3buf });
		await expect(toast(page)).toHaveText('Opened “Untitled-Page-1.drawio”');
		expect(await cells(page)).toEqual(model);
	});

	test('a draft is offered after a reload and restores the same model', async ({ page }) => {
		await openEditor(page);
		await buildFlowchartViaUI(page);
		const model = await cells(page);
		await expect.poll(() => E(page, async () => !!(await window.__easyDiagram.io.loadDraft('Untitled.drawio')))).toBe(true);
		await page.reload();
		await page.waitForFunction(() => window.__easyDiagram);
		const prompt = page.getByTestId('draft-prompt');
		await expect(prompt).toBeVisible();
		await expect(prompt).toContainText('You have an unsaved draft of “Untitled.drawio”');
		await prompt.getByRole('button', { name: 'Restore' }).click();
		await expect(toast(page)).toHaveText('Draft restored');
		expect(await cells(page)).toEqual(model);
		await expect(page.getByTestId('save-status')).toHaveText('Draft kept on this device');
	});

	test('Discard drops the draft', async ({ page }) => {
		await openEditor(page);
		await page.keyboard.press('r');
		await expect.poll(() => E(page, async () => !!(await window.__easyDiagram.io.loadDraft('Untitled.drawio')))).toBe(true);
		await page.reload();
		await page.getByTestId('draft-prompt').getByRole('button', { name: 'Discard' }).click();
		await expect(page.getByTestId('draft-prompt')).toHaveCount(0);
		await expect.poll(() => E(page, () => window.__easyDiagram.io.loadDraft('Untitled.drawio'))).toBeNull();
		await page.reload();
		await page.waitForFunction(() => window.__easyDiagram);
		await page.waitForTimeout(500);
		await expect(page.getByTestId('draft-prompt')).toHaveCount(0);
		await expect(page.getByTestId('empty-state')).toBeVisible();
	});

	test('the editor still boots and works when indexedDB throws', async ({ page }) => {
		await openEditor(page, {
			init: () => {
				Object.defineProperty(window, 'indexedDB', { configurable: true, get() { throw new DOMException('blocked', 'SecurityError'); } });
			},
		});
		await expect(page.getByTestId('empty-state')).toBeVisible();
		await page.keyboard.press('r');
		await page.waitForTimeout(800); // a draft write is attempted and must fail quietly
		expect(await shapes(page)).toHaveLength(1);
		expect(await E(page, () => window.__easyDiagram.io.saveDraft('<mxfile/>', 'x'))).toBe(false);
		expect(await E(page, () => window.__easyDiagram.io.loadDraft())).toBeNull();
		await expect(toast(page)).toHaveCount(0);
	});

	test('dropping a .drawio file opens it', async ({ page }) => {
		await openEditor(page);
		const xml = await upstreamCompressedTwoPages(page);
		await dropFile(page, 'dropped.drawio', xml);
		await expect(toast(page)).toHaveText('Opened “dropped.drawio”');
		await expect(page.getByTestId('file-name')).toHaveText('dropped.drawio');
		await expect(page.locator('.ed-tab')).toHaveCount(2);
	});
});

// ================================================================ UI

test.describe('ui', () => {
	test('empty state, Add a shape, label edit, and Delete with an undo toast', async ({ page }) => {
		await openEditor(page);
		const empty = page.getByTestId('empty-state');
		await expect(empty).toBeVisible();
		await expect(empty).toContainText('This page is empty');
		await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
		await expect(page.getByRole('button', { name: 'Redo' })).toBeDisabled();
		await page.getByRole('button', { name: 'Add a shape' }).click();
		await expect(empty).toBeHidden();
		const [id] = (await sel(page)).ids;
		expect(await cell(page, id)).toMatchObject({ kind: 'round', label: 'Step' });
		const label = inspector(page).getByRole('textbox', { name: 'Label', exact: true });
		await expect(label).toHaveValue('Step');
		await label.fill('Hello <world>');
		await label.press('Enter');
		expect((await cell(page, id)).label).toBe('Hello <world>');
		await expect(page.getByTestId('readout')).toContainText('Hello <world>');

		// In-canvas label editing too (double click, type, click away).
		const c = await centerOf(page, id);
		await page.mouse.dblclick(c.x, c.y);
		await expect(page.locator('.mxCellEditor')).toBeVisible();
		await page.keyboard.press('ControlOrMeta+a');
		await page.keyboard.type('Typed');
		await page.mouse.click(c.x + 300, c.y + 250);
		await expect.poll(async () => (await cell(page, id)).label).toBe('Typed');

		await E(page, (i) => window.__easyDiagram.engine.select([i]), id);
		await page.keyboard.press('Delete');
		await expect(toast(page)).toContainText('Deleted “Typed”. Undo with');
		await expect(empty).toBeVisible();
		await page.getByRole('button', { name: 'Undo' }).click();
		await expect(empty).toBeHidden();
		await page.getByRole('button', { name: 'Redo' }).click();
		await expect(empty).toBeVisible();
		await page.keyboard.press('Control+z');
		expect(await shapes(page)).toHaveLength(1);
	});

	test('tool keys R O D N add shapes; A T H V arm tools; all ignored while typing', async ({ page }) => {
		await openEditor(page);
		for (const [key, kind] of [['r', 'rect'], ['o', 'ellipse'], ['d', 'diamond'], ['n', 'note']]) {
			await page.keyboard.press(key);
			const s = await sel(page);
			expect((await cell(page, s.ids[0])).kind, key).toBe(kind);
			await expect(tool(page, 'select')).toHaveAttribute('aria-pressed', 'true');
		}
		expect(await shapes(page)).toHaveLength(4);
		// Shapes never stack: every new one went to free space.
		const all = await shapes(page);
		for (let i = 0; i < all.length; i++) {
			for (let j = i + 1; j < all.length; j++) {
				const a = all[i], b = all[j];
				expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h, `${a.kind}/${b.kind} overlap`).toBe(false);
			}
		}
		await page.keyboard.press('Escape');
		for (const [key, name] of [['a', 'connector'], ['t', 'text'], ['h', 'hand'], ['v', 'select']]) {
			await page.keyboard.press(key);
			await expect(tool(page, name), key).toHaveAttribute('aria-pressed', 'true');
			expect(await E(page, () => window.__easyDiagram.engine.getTool())).toBe(name);
		}
		// Text tool: click to place a text box, which starts editing.
		await page.keyboard.press('t');
		const box = await page.locator('.ed-canvas').boundingBox();
		await page.mouse.click(box.x + box.width - 260, box.y + box.height - 220);
		await expect(page.locator('.mxCellEditor')).toBeVisible();
		await page.keyboard.press('Escape');
		expect((await shapes(page)).filter((s) => s.kind === 'text')).toHaveLength(1);

		// Typing in the dock search or the label field never triggers tools.
		const n = (await shapes(page)).length;
		const search = page.getByRole('searchbox', { name: 'Search shapes' });
		await search.click();
		await page.keyboard.type('rodnathv');
		await expect(search).toHaveValue('rodnathv');
		expect(await shapes(page)).toHaveLength(n);
		await expect(tool(page, 'select')).toHaveAttribute('aria-pressed', 'true');
		await search.fill('');
		await E(page, () => { const e = window.__easyDiagram.engine; e.select([e.cells().find((c) => c.type === 'shape').id]); });
		const label = inspector(page).getByRole('textbox', { name: 'Label', exact: true });
		await label.click();
		await page.keyboard.press('Backspace');
		await page.keyboard.type('rd');
		expect(await shapes(page)).toHaveLength(n);
		await expect(label).toBeFocused();
		await page.keyboard.press('Escape'); // reverts and blurs, keeps selection
		await expect(label).not.toBeFocused();
	});

	test('every shape inspector control updates the model', async ({ page }) => {
		await openEditor(page);
		const id = await E(page, () => window.__easyDiagram.engine.addShape('rect', { x: 100, y: 100 }));
		const insp = inspector(page);
		await expect(insp.locator('[data-panel="shape"]')).toBeVisible();
		await expect(insp).toContainText('Rectangle');
		const get = () => cell(page, id);

		for (const [name, color] of [['Blue', 'blue'], ['Teal', 'green'], ['Violet', 'violet'], ['Rose', 'pink'], ['Amber', 'amber'], ['Slate', 'slate']]) {
			await insp.getByRole('button', { name: `Fill ${name}` }).click();
			expect((await get()).color).toBe(color);
			await expect(insp.getByRole('button', { name: `Fill ${name}` })).toHaveAttribute('aria-pressed', 'true');
		}
		for (const a of ['Pulse', 'Bounce', 'Float', 'Wiggle', 'Glow', 'Blink', 'Pop', 'None']) {
			await insp.getByRole('button', { name: `Animation: ${a}` }).click();
			expect((await get()).anim.name).toBe(a.toLowerCase());
			await expect(insp.getByRole('button', { name: `Animation: ${a}` })).toHaveAttribute('aria-pressed', 'true');
		}
		await expect(insp.getByRole('group', { name: 'Play' })).toBeHidden();
		await expect(insp.getByRole('button', { name: 'Replay' })).toBeDisabled();
		await insp.getByRole('button', { name: 'Animation: Bounce' }).click();
		for (const [label, v] of [['On hover', 'hover'], ['Once', 'once'], ['Loop', 'loop']]) {
			await insp.getByRole('group', { name: 'Play' }).getByRole('button', { name: label }).click();
			expect((await get()).anim.trigger).toBe(v);
		}
		for (const [label, v] of [['Slow', 'slow'], ['Fast', 'fast'], ['Normal', 'normal']]) {
			await insp.getByRole('group', { name: 'Speed' }).getByRole('button', { name: label }).click();
			expect((await get()).anim.speed).toBe(v);
		}
		// Replay restarts the animation on the canvas node.
		const animStart = () => E(page, (i) => {
			const g = window.__easyDiagram.engine._graph;
			const n = g.view.getState(g.getModel().getCell(i)).shape.node;
			return n.getAnimations().map((a) => a.currentTime)[0];
		}, id);
		await page.waitForTimeout(400);
		const t0 = await animStart();
		await insp.getByRole('button', { name: 'Replay' }).click();
		expect(await animStart()).toBeLessThan(t0);

		for (const [label, v] of [['Bold stroke', 3], ['Thin stroke', 1], ['Regular stroke', 1.5]]) {
			await insp.getByRole('button', { name: label }).click();
			expect((await get()).strokeWidth).toBe(v);
		}
		const op = insp.getByRole('slider', { name: 'Opacity' });
		await op.fill('40');
		expect((await get()).opacity).toBe(40);
		await expect(insp.locator('.ed-opacity-head .val')).toHaveText('40%');
		const shadow = insp.getByRole('button', { name: 'Soft shadow' });
		const sh0 = (await get()).shadow;
		await shadow.click();
		expect((await get()).shadow).toBe(!sh0);
		await expect(shadow).toHaveAttribute('aria-pressed', String(!sh0));
		for (const [label, key, v] of [['X position', 'x', 260], ['Y position', 'y', 180], ['Width', 'w', 200], ['Height', 'h', 90]]) {
			const input = insp.getByRole('spinbutton', { name: label });
			await input.fill(String(v));
			await input.press('Enter');
			expect((await get())[key], label).toBe(v);
		}
		await insp.getByRole('button', { name: 'Duplicate' }).click();
		expect(await shapes(page)).toHaveLength(2);
		const dupId = (await sel(page)).ids[0];
		expect(dupId).not.toBe(id);
		expect(await cell(page, dupId)).toMatchObject({ color: 'slate', strokeWidth: 1.5, opacity: 40, w: 200, h: 90 });
		await inspector(page).getByRole('button', { name: 'Delete' }).click();
		expect(await shapes(page)).toHaveLength(1);
		await expect(toast(page)).toContainText('Deleted');
	});

	test('every connector inspector control updates the model; Connections selects the edge', async ({ page }) => {
		await openEditor(page);
		const { a, b, ed } = await E(page, () => {
			const e = window.__easyDiagram.engine;
			const a = e.addShape('rect', { x: 60, y: 120, label: 'Alpha' });
			const b = e.addShape('rect', { x: 420, y: 120, label: 'Beta' });
			const ed = e.connect(a, b);
			e.select([a]);
			return { a, b, ed };
		});
		const insp = inspector(page);
		const conn = insp.locator('.ed-conn');
		await expect(conn).toHaveCount(1);
		await expect(conn).toContainText('To Beta');
		await expect(conn).toContainText('None');
		await conn.click();
		expect(await sel(page)).toEqual({ type: 'edge', ids: [ed] });
		await expect(insp.locator('[data-panel="edge"]')).toBeVisible();
		await expect(insp.locator('.ed-fromto')).toHaveText('AlphaBeta');
		const get = () => cell(page, ed);

		const lbl = insp.getByRole('textbox', { name: 'Connector label' });
		await lbl.fill('yes');
		await lbl.press('Enter');
		expect((await get()).label).toBe('yes');
		for (const an of ['Flow', 'March', 'Comet', 'Pulse', 'Draw', 'None']) {
			await insp.getByRole('button', { name: `Animation: ${an}` }).click();
			expect((await get()).anim.name).toBe({ March: 'dash' }[an] || an.toLowerCase());
		}
		await expect(insp.getByRole('group', { name: 'Direction' })).toBeHidden();
		await insp.getByRole('button', { name: 'Animation: Comet' }).click();
		for (const [label, v] of [['Slow', 'slow'], ['Fast', 'fast']]) {
			await insp.getByRole('group', { name: 'Speed' }).getByRole('button', { name: label }).click();
			expect((await get()).anim.speed).toBe(v);
		}
		await insp.getByRole('group', { name: 'Direction' }).getByRole('button', { name: 'Reverse' }).click();
		expect((await get()).anim.direction).toBe('reverse');
		// The canvas overlay follows the model.
		const overlay = await E(page, (i) => {
			const g = window.__easyDiagram.engine._graph;
			const o = g.view.getState(g.getModel().getCell(i)).shape.node.querySelector('.ed-ea-overlay');
			return o && { cls: o.getAttribute('class'), dir: getComputedStyle(o).animationDirection, len: o.getAttribute('pathLength') };
		}, ed);
		expect(overlay).toMatchObject({ dir: 'reverse', len: '100' });
		expect(overlay.cls).toContain('ed-e-comet');
		for (const [label, v] of [['Dashed', 'dashed'], ['Dotted', 'dotted'], ['Solid', 'solid']]) {
			await insp.getByRole('group', { name: 'Line' }).getByRole('button', { name: label }).click();
			expect((await get()).lineStyle).toBe(v);
		}
		for (const [label, v] of [['Accent', 'accent'], ['Blue', 'blue'], ['Green', 'green'], ['Pink', 'pink'], ['Amber', 'amber'], ['Default', 'default']]) {
			await insp.getByRole('button', { name: `${label} connector` }).click();
			expect((await get()).color).toBe(v);
		}
		for (const [label, v] of [['Bold', 3], ['Thin', 1.2], ['Regular', 1.8]]) {
			await insp.getByRole('group', { name: 'Width' }).getByRole('button', { name: label }).click();
			expect((await get()).width).toBe(v);
		}
		await expect(page.getByTestId('readout')).toContainText('Connector');
		await insp.getByRole('button', { name: 'Delete connector' }).click();
		await expect(toast(page)).toContainText('Connector deleted');
		expect(await edges(page)).toHaveLength(0);
		expect(await shapes(page)).toHaveLength(2);
		void a; void b;
	});

	test('the inspector stays in sync with the canvas across undo, redo and page switches', async ({ page }) => {
		await openEditor(page);
		const id = await E(page, () => window.__easyDiagram.engine.addShape('rect', { x: 50, y: 50 }));
		const insp = inspector(page);
		await insp.getByRole('button', { name: 'Fill Rose' }).click();
		await insp.getByRole('button', { name: 'Animation: Glow' }).click();
		await page.keyboard.press('Control+z');
		await expect(insp.getByRole('button', { name: 'Animation: None' })).toHaveAttribute('aria-pressed', 'true');
		await expect(insp.getByRole('button', { name: 'Fill Rose' })).toHaveAttribute('aria-pressed', 'true');
		await page.keyboard.press('Control+z');
		await expect(insp.getByRole('button', { name: 'Fill Blue' })).toHaveAttribute('aria-pressed', 'true');
		await page.keyboard.press('Control+Shift+z');
		await expect(insp.getByRole('button', { name: 'Fill Rose' })).toHaveAttribute('aria-pressed', 'true');
		const x = insp.getByRole('spinbutton', { name: 'X position' });
		await x.fill('300');
		await x.press('Enter');
		await page.keyboard.press('Control+z');
		await expect(x).toHaveValue('50');

		// Page switch: the inspector shows the empty-page panel, then the shape panel's id goes away cleanly.
		await page.getByRole('button', { name: 'Add page' }).click();
		await expect(insp.locator('[data-panel="none"]')).toBeVisible();
		await expect(insp.getByRole('textbox', { name: 'Page name' })).toHaveValue('Page 2');
		await expect(page.getByTestId('empty-state')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
		await page.locator('.ed-tab').first().click();
		await expect(page.getByTestId('empty-state')).toBeHidden();
		await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
		await E(page, (i) => window.__easyDiagram.engine.select([i]), id);
		await expect(insp.getByRole('button', { name: 'Fill Rose' })).toHaveAttribute('aria-pressed', 'true');
		// Undo the edit that selected nothing: the panel follows a removed cell back to "none".
		await E(page, () => { const e = window.__easyDiagram.engine; while (e.canUndo()) e.undo(); });
		await expect(insp.locator('[data-panel="none"]')).toBeVisible();
	});

	test('Esc clears the selection and closes overlays; Ctrl+K palette runs and closes', async ({ page }) => {
		await openEditor(page);
		await page.keyboard.press('r');
		expect((await sel(page)).type).toBe('shape');
		await page.keyboard.press('Escape');
		expect((await sel(page)).type).toBe('none');

		const pal = page.getByRole('dialog', { name: 'Command palette' });
		await page.keyboard.press('Control+k');
		await expect(pal).toBeVisible();
		const input = pal.getByRole('combobox');
		await expect(input).toBeFocused();
		await expect(pal.getByRole('option')).not.toHaveCount(0);
		await input.fill('zzzz');
		await expect(pal).toContainText('No commands match “zzzz”.');
		await input.fill('ellipse');
		await expect(pal.getByRole('option')).toHaveCount(1);
		await page.keyboard.press('Enter');
		await expect(pal).toBeHidden();
		expect((await cell(page, (await sel(page)).ids[0])).kind).toBe('ellipse');

		await page.keyboard.press('Control+k');
		await input.fill('pulse');
		await page.keyboard.press('Enter');
		expect((await cell(page, (await sel(page)).ids[0])).anim.name).toBe('pulse');

		// Keyboard-open from the button (Safari never focuses a button on click).
		await page.getByRole('button', { name: 'Search & commands' }).focus();
		await page.keyboard.press('Enter');
		await expect(pal).toBeVisible();
		await page.keyboard.press('ArrowDown');
		await expect(pal.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true');
		await page.keyboard.press('Tab');
		await expect(input).toBeFocused(); // focus stays in the dialog
		await page.keyboard.press('Escape');
		await expect(pal).toBeHidden();
		await expect(page.getByRole('button', { name: 'Search & commands' })).toBeFocused(); // focus returns to the opener
		await page.keyboard.press('Control+k');
		await page.locator('.ed-pal-backdrop').click({ position: { x: 10, y: 10 } });
		await expect(pal).toBeHidden();
		await page.keyboard.press('Control+k');
		await page.keyboard.press('Control+k');
		await expect(pal).toBeHidden();

		await page.getByRole('button', { name: 'Export' }).click();
		await expect(page.locator('#ed-export-pop')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page.locator('#ed-export-pop')).toBeHidden();
	});

	test('Ctrl+D duplicates, Delete removes, both reported; the context bar acts on the shape', async ({ page }) => {
		await openEditor(page);
		await page.keyboard.press('Control+d');
		await expect(toast(page)).toHaveText('Select a shape first');
		await page.keyboard.press('r');
		const [id] = (await sel(page)).ids;
		const ctxBar = page.getByRole('toolbar', { name: 'Selection' });
		await expect(ctxBar).toBeVisible();
		// The bar sits just above (or, near the top edge, just below) the shape, never on it.
		await page.waitForTimeout(300);
		const bar = await ctxBar.boundingBox();
		const c = await centerOf(page, id);
		expect(bar.y + bar.height <= c.top || bar.y >= c.top + c.h).toBe(true);
		expect(Math.abs(bar.x + bar.width / 2 - c.x)).toBeLessThan(5);
		await ctxBar.getByRole('button', { name: 'Fill Violet' }).click();
		expect((await cell(page, id)).color).toBe('violet');
		await expect(ctxBar.getByRole('button', { name: 'Fill Violet' })).toHaveAttribute('aria-pressed', 'true');
		await page.keyboard.press('Control+d');
		expect(await shapes(page)).toHaveLength(2);
		const dup = (await sel(page)).ids[0];
		expect(dup).not.toBe(id);
		await ctxBar.getByRole('button', { name: 'Duplicate' }).click();
		expect(await shapes(page)).toHaveLength(3);
		await ctxBar.getByRole('button', { name: 'Delete' }).click();
		await expect(toast(page)).toContainText('Deleted “Process”');
		await E(page, () => { const e = window.__easyDiagram.engine; e.select([e.cells()[0].id]); });
		await page.keyboard.press('Backspace');
		expect(await shapes(page)).toHaveLength(1);
		await expect(ctxBar).toBeHidden();
		// Multi-select: both shapes, one delete, one toast.
		await page.keyboard.press('r');
		await E(page, () => { const e = window.__easyDiagram.engine; e.select(e.cells().map((x) => x.id)); });
		await expect(inspector(page)).toContainText('2 items selected');
		await page.keyboard.press('Delete');
		await expect(toast(page)).toContainText('Deleted 2 items');
	});

	test('export popover options, and PDF goes through print()', async ({ page }) => {
		await openEditor(page);
		await page.keyboard.press('r');
		await page.getByRole('button', { name: 'Export' }).click();
		const pop = page.locator('#ed-export-pop');
		await expect(pop).toBeVisible();
		await expect(page.getByRole('button', { name: 'Export' })).toHaveAttribute('aria-expanded', 'true');
		await expect(pop.locator('.ed-pop-title')).toHaveText('Export “Page-1”');
		await expect(pop.getByRole('button', { name: 'PNG', exact: true })).toBeFocused();
		await expect(pop).toContainText('Nothing is uploaded');
		await pop.getByRole('button', { name: '.drawio' }).click();
		await expect(pop.getByRole('button', { name: 'Transparent background' })).toBeDisabled();
		await expect(pop.getByRole('button', { name: '2×' })).toBeDisabled();
		await pop.getByRole('button', { name: 'SVG', exact: true }).click();
		await expect(pop.getByRole('button', { name: 'Transparent background' })).toBeEnabled();
		await pop.getByRole('button', { name: 'Transparent background' }).click();
		await expect(pop.getByRole('button', { name: 'Transparent background' })).toHaveAttribute('aria-pressed', 'true');
		await pop.getByRole('button', { name: 'PDF', exact: true }).click();
		await expect(pop.locator('.ed-pop-go')).toHaveText('Print / Save as PDF');
		await pop.locator('.ed-pop-go').click();
		await expect(pop).toBeHidden();
		expect(await page.evaluate(() => window.__printCalls)).toBe(1);
		// The print host holds a static SVG of the page (no scripts).
		const printed = await page.evaluate(() => {
			const host = document.querySelector('.ed-print');
			return { svgs: host.querySelectorAll('svg').length, scripts: host.querySelectorAll('script').length };
		});
		expect(printed).toEqual({ svgs: 1, scripts: 0 });
		await page.emulateMedia({ media: 'print' });
		await expect(page.locator('.ed-print')).toBeVisible();
		await expect(page.locator('.ed-top')).toBeHidden();
		await page.emulateMedia({ media: 'screen' });
		await page.keyboard.press('Control+p');
		expect(await page.evaluate(() => window.__printCalls)).toBe(2);
		// A click outside closes the popover.
		await page.getByRole('button', { name: 'Export' }).click();
		await page.locator('.ed-dock').click({ position: { x: 100, y: 600 } });
		await expect(pop).toBeHidden();
	});

	test('theme and motion toggles; the theme persists across reloads', async ({ page }) => {
		await openEditor(page);
		const root = page.locator('.ed');
		await expect(root).toHaveAttribute('data-theme', 'dark');
		await page.getByRole('button', { name: 'Switch to light mode' }).click();
		await expect(root).toHaveAttribute('data-theme', 'light');
		await page.reload();
		await page.waitForFunction(() => window.__easyDiagram);
		await expect(page.locator('.ed')).toHaveAttribute('data-theme', 'light');
		await expect(page.locator('.ed-canvas')).toHaveAttribute('data-ed-theme', 'light');
		await page.keyboard.press('Shift+D');
		await expect(page.locator('.ed')).toHaveAttribute('data-theme', 'dark');

		const motion = page.getByRole('button', { name: 'Motion' });
		await expect(motion).toHaveAttribute('aria-pressed', 'true');
		await expect(motion).toHaveText('Motion on');
		await page.keyboard.press('Shift+M');
		await expect(motion).toHaveAttribute('aria-pressed', 'false');
		await expect(motion).toHaveText('Motion off');
		await expect(page.locator('.ed-canvas')).toHaveClass(/ed-paused/);
	});

	test('pages: add, switch, rename (tab and inspector), delete', async ({ page }) => {
		const diag = await openEditor(page);
		await page.keyboard.press('r');
		await page.getByRole('button', { name: 'Add page' }).click();
		const tabs = page.locator('.ed-tab');
		await expect(tabs).toHaveText(['Page-1', 'Page 2']);
		await expect(tabs.nth(1)).toHaveAttribute('aria-current', 'page');
		await page.keyboard.press('o');
		expect((await shapes(page)).map((s) => s.kind)).toEqual(['ellipse']);
		await tabs.nth(0).click();
		await expect(tabs.nth(0)).toHaveAttribute('aria-current', 'page');
		expect((await shapes(page)).map((s) => s.kind)).toEqual(['rect']);

		diag.prompt = 'Overview';
		await tabs.nth(0).dblclick();
		await expect(tabs.nth(0)).toHaveText('Overview');
		await page.keyboard.press('Escape');
		const pageName = inspector(page).getByRole('textbox', { name: 'Page name' });
		await expect(pageName).toHaveValue('Overview');
		await pageName.fill('Main flow');
		await pageName.press('Enter');
		await expect(tabs.nth(0)).toHaveText('Main flow');
		expect(await E(page, () => window.__easyDiagram.engine.toXml())).toContain('name="Main flow"');

		await tabs.nth(1).click();
		await page.keyboard.press('Control+k');
		await page.getByRole('combobox').fill('Delete page');
		await page.keyboard.press('Enter');
		await expect(tabs).toHaveText(['Main flow']);
		await expect(toast(page)).toHaveText('Deleted page “Page 2”');
		await page.keyboard.press('Control+k');
		await page.getByRole('combobox').fill('Delete page');
		await page.keyboard.press('Enter');
		await expect(toast(page)).toHaveText('A file needs at least one page');
	});

	test('grid and snap controls, and the status readout', async ({ page }) => {
		await openEditor(page);
		const readout = page.getByTestId('readout');
		await expect(readout).toHaveText(/0 shapes\s+·\s+0 connectors\s+·\s+snap/);
		const insp = inspector(page);
		const bg = () => page.locator('.ed-canvas').evaluate((el) => el.style.backgroundImage);
		expect(await bg()).toContain('radial-gradient');
		await insp.getByRole('group', { name: 'Canvas grid' }).getByRole('button', { name: 'Lines' }).click();
		expect(await bg()).not.toContain('radial-gradient');
		expect(await bg()).toContain('linear-gradient');
		await insp.getByRole('group', { name: 'Canvas grid' }).getByRole('button', { name: 'None' }).click();
		expect(await bg()).toBe('none');
		expect(await E(page, () => window.__easyDiagram.engine.toXml())).toContain('grid="0"');
		const snap = insp.getByRole('button', { name: 'Snap to grid' });
		await expect(snap).toHaveAttribute('aria-pressed', 'true');
		await snap.click();
		await expect(snap).toHaveAttribute('aria-pressed', 'false');
		await expect(readout).toHaveText(/·\s+free$/);
		// Snap off: a drop lands at the exact pointer position.
		await page.keyboard.press('r');
		await expect(readout).toHaveText(/^Process\s+·\s+X \d+\s+Y \d+\s+·\s+150×64$/);
		await page.keyboard.press('Escape');
		await expect(readout).toHaveText(/1 shape\s+·\s+0 connectors/);
	});

	test('dock: search, category chips, click to add, drag a tile onto the canvas at the pointer', async ({ page }) => {
		await openEditor(page);
		const dock = page.getByRole('complementary', { name: 'Shapes' });
		const visibleNames = () => dock.locator('.ed-tile:visible .ed-tile-name').allInnerTexts();
		expect(await visibleNames()).toEqual(['Rectangle', 'Rounded', 'Ellipse', 'Decision', 'Terminator', 'Data', 'Hexagon', 'Database', 'Document', 'Sticky']);
		await dock.getByRole('button', { name: 'Flowchart' }).click();
		await expect(dock.getByRole('button', { name: 'Flowchart' })).toHaveAttribute('aria-pressed', 'true');
		expect(await visibleNames()).toEqual(['Rectangle', 'Decision', 'Terminator', 'Data', 'Database', 'Document']);
		await dock.getByRole('button', { name: 'Basic' }).click();
		expect(await visibleNames()).toEqual(['Rectangle', 'Rounded', 'Ellipse', 'Decision', 'Hexagon', 'Sticky']);
		await dock.getByRole('button', { name: 'All' }).click();
		await dock.getByRole('searchbox', { name: 'Search shapes' }).fill('data');
		expect(await visibleNames()).toEqual(['Data', 'Database']);
		await dock.getByRole('searchbox', { name: 'Search shapes' }).fill('nope');
		await expect(dock).toContainText('No shapes match “nope”.');
		await dock.getByRole('searchbox', { name: 'Search shapes' }).fill('');
		await expect(dock.getByRole('button', { name: /UML, BPMN/ })).toBeDisabled();
		await expect(dock).toContainText('Coming soon');

		await dock.getByRole('button', { name: 'Add Hexagon' }).click();
		expect((await cell(page, (await sel(page)).ids[0])).kind).toBe('hex');

		// Drag Database onto a point on the canvas: it is centred under the pointer.
		await E(page, () => window.__easyDiagram.engine.zoomTo(1));
		const tile = await dock.getByRole('button', { name: 'Add Database' }).boundingBox();
		const box = await page.locator('.ed-canvas').boundingBox();
		const drop = { x: box.x + box.width * 0.6, y: box.y + box.height * 0.55 };
		await drag(page, { x: tile.x + tile.width / 2, y: tile.y + tile.height / 2 }, drop, 25);
		const id = (await sel(page)).ids[0];
		const c = await cell(page, id);
		expect(c.kind).toBe('cyl');
		const m = await E(page, (p) => window.__easyDiagram.engine.clientToModel(p.x, p.y), drop);
		expect(Math.abs(c.x + c.w / 2 - m.x)).toBeLessThanOrEqual(10);
		expect(Math.abs(c.y + c.h / 2 - m.y)).toBeLessThanOrEqual(10);
		expect(await shapes(page)).toHaveLength(2);
		await expect(page.locator('.ed-drag-ghost')).toHaveCount(0);
	});

	test('zoom controls and keys', async ({ page }) => {
		await openEditor(page);
		const pct = page.locator('.ed-zoom-pct');
		await expect(pct).toHaveText('100%');
		await page.getByRole('button', { name: 'Zoom in' }).click();
		await expect(pct).toHaveText('120%');
		await page.getByRole('button', { name: 'Zoom out' }).click();
		await page.getByRole('button', { name: 'Zoom out' }).click();
		await expect(pct).toHaveText('83%');
		await pct.click();
		await expect(pct).toHaveText('100%');
		await page.keyboard.press('+');
		await expect(pct).toHaveText('120%');
		await page.keyboard.press('-');
		await expect(pct).toHaveText('100%');
		await E(page, () => { const e = window.__easyDiagram.engine; for (let i = 0; i < 4; i++) e.addShape('rect', { x: i * 900, y: i * 600 }); });
		await page.keyboard.press('Shift+!'); // Shift+1 = Zoom to fit (matched on the physical key)
		await page.keyboard.press('Shift+Digit1');
		await expect.poll(async () => parseInt(await pct.innerText(), 10)).toBeLessThan(60);
		await page.keyboard.press('Shift+Digit0');
		await expect(pct).toHaveText('100%');
	});

	test('toggles expose aria-pressed and tools show tooltips', async ({ page }) => {
		await openEditor(page);
		for (const t of ['select', 'hand', 'rect', 'ellipse', 'diamond', 'connector', 'text', 'note']) {
			await expect(tool(page, t)).toHaveAttribute('aria-pressed', t === 'select' ? 'true' : 'false');
		}
		await tool(page, 'hand').click();
		await expect(tool(page, 'hand')).toHaveAttribute('aria-pressed', 'true');
		await expect(tool(page, 'select')).toHaveAttribute('aria-pressed', 'false');
		const ind = await page.locator('.ed-indicator').boundingBox();
		const hand = await tool(page, 'hand').boundingBox();
		await expect.poll(async () => Math.abs((await page.locator('.ed-indicator').boundingBox()).x - hand.x)).toBeLessThan(3);
		void ind;
		await tool(page, 'rect').hover();
		const tip = tool(page, 'rect').locator('.ed-tip');
		await expect(tip).toHaveText('Rectangle R');
		await expect.poll(() => tip.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
		await expect(page.getByRole('button', { name: 'Undo' })).toHaveAttribute('title', /Undo \((⌘|Ctrl\+)Z\)/);
		// Every button in the shell has an accessible name.
		const unnamed = await page.evaluate(() => [...document.querySelectorAll('.ed button')]
			.filter((b) => !(b.getAttribute('aria-label') || b.textContent.trim() || b.getAttribute('title')))
			.map((b) => b.className));
		expect(unnamed).toEqual([]);
		// Keyboard focus is visible (focus-visible ring). Safari's Tab skips
		// buttons by default, so focus a control and move with the keyboard.
		// Text fields show focus on their wrapping .field (accent border + ring).
		await page.getByRole('searchbox', { name: 'Search shapes' }).focus();
		const field = () => page.evaluate(() => {
			const cs = getComputedStyle(document.activeElement.closest('.field'));
			return { border: cs.borderTopColor, ring: cs.boxShadow !== 'none' };
		});
		await expect.poll(field).toEqual({ border: 'rgb(76, 141, 255)', ring: true }); // after the .2s transition
		const ring = () => page.evaluate(() => {
			const cs = getComputedStyle(document.activeElement);
			return { visible: document.activeElement.matches(':focus-visible'), style: cs.outlineStyle, width: cs.outlineWidth };
		});
		await tool(page, 'select').focus();
		await page.keyboard.press('ArrowRight'); // any key press makes programmatic focus "visible"
		await tool(page, 'hand').focus();
		const btn = await ring();
		if (btn.visible) expect(btn).toMatchObject({ style: 'solid', width: '2px' });
	});

	test('text contrast is at least 4.5:1 in both themes', async ({ page }) => {
		await openEditor(page);
		const failures = [];
		const check = async (state) => {
			await page.waitForTimeout(450); // let theme/colour transitions finish
			const bad = await page.evaluate(contrastFailures);
			for (const b of bad) failures.push(`${state}: ${b}`);
		};
		await check('dark/empty');
		await E(page, () => {
			const e = window.__easyDiagram.engine;
			const a = e.addShape('rect', { x: 60, y: 60 });
			const b = e.addShape('rect', { x: 400, y: 60 });
			e.connect(a, b, { label: 'edge label' });
			e.update(a, { anim: { name: 'pulse' } });
			e.select([a]);
		});
		await check('dark/shape');
		await E(page, () => { const e = window.__easyDiagram.engine; e.select([e.cells().find((c) => c.type === 'edge').id]); });
		await page.getByRole('button', { name: 'Animation: Flow' }).click();
		await check('dark/edge');
		await page.keyboard.press('Control+k');
		await check('dark/palette');
		await page.keyboard.press('Escape');
		await page.getByRole('button', { name: 'Export' }).click();
		await check('dark/export');
		await page.keyboard.press('Escape');
		await page.getByRole('button', { name: 'Switch to light mode' }).click();
		await check('light/edge');
		await E(page, () => { const e = window.__easyDiagram.engine; e.select([e.cells()[0].id]); });
		await check('light/shape');
		await E(page, () => window.__easyDiagram.engine.clearSelection());
		await check('light/none');
		await page.keyboard.press('Control+k');
		await check('light/palette');
		await page.keyboard.press('Escape');
		await page.getByRole('button', { name: 'Export' }).click();
		await check('light/export');
		expect(failures).toEqual([]);
	});
});

// Runs in the page: every visible, enabled text node in the shell whose
// contrast against its effective background is under 4.5:1.
function contrastFailures() {
	const parse = (c) => {
		const m = c.match(/rgba?\(([^)]+)\)/);
		if (!m) return null;
		const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
		return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
	};
	const blend = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
	const lum = (c) => {
		const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
		return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
	};
	const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
	const bgOf = (el) => {
		const layers = [];
		for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
			const c = parse(getComputedStyle(n).backgroundColor);
			if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; }
		}
		let bg = { r: 255, g: 255, b: 255, a: 1 };
		for (let i = layers.length - 1; i >= 0; i--) bg = blend(layers[i], bg);
		return bg;
	};
	const out = [];
	const walker = document.createTreeWalker(document.querySelector('.ed'), NodeFilter.SHOW_TEXT);
	const seen = new Set();
	for (let t = walker.nextNode(); t; t = walker.nextNode()) {
		if (!t.textContent.trim()) continue;
		const el = t.parentElement;
		if (!el || seen.has(el)) continue;
		seen.add(el);
		if (el.closest('.ed-canvas, .sr-only, [hidden], [aria-hidden="true"], .ed-print, svg')) continue;
		if (el.closest('button:disabled, [aria-disabled="true"], .is-off')) continue; // WCAG 1.4.3 exempts inactive controls
		const rects = el.getClientRects();
		if (!rects.length) continue;
		let opacity = 1;
		let hidden = false;
		for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
			const cs = getComputedStyle(n);
			if (cs.visibility === 'hidden' || cs.display === 'none') { hidden = true; break; }
			opacity *= parseFloat(cs.opacity);
		}
		if (hidden || opacity < 0.05) continue;
		// Skip text covered by an overlay (palette backdrop, drawer scrim).
		const r0 = rects[0];
		const top = document.elementFromPoint(Math.min(innerWidth - 1, r0.left + Math.min(4, r0.width / 2)), r0.top + r0.height / 2);
		if (top && top !== el && !el.contains(top) && !top.contains(el)) continue;
		const fg = parse(getComputedStyle(el).color);
		if (!fg) continue;
		fg.a *= opacity;
		const bg = bgOf(el);
		const r = ratio(blend(fg, bg), bg);
		if (r < 4.5) out.push(`"${t.textContent.trim().slice(0, 30)}" ${r.toFixed(2)}:1 (${el.className || el.tagName})`);
	}
	return out;
}

// ================================================================ Phone

test.describe('phone width', () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

	test('dock and inspector are drawers, the canvas works, no horizontal scroll', async ({ page }, testInfo) => {
		await openEditor(page);
		const noHScroll = () => page.evaluate(() => ({
			doc: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
			body: document.body.scrollWidth <= document.body.clientWidth,
			// Closed drawers sit off-canvas (translated, visibility:hidden, clipped by .ed's
			// overflow:hidden); every visible control must be inside the viewport.
			ed: [...document.querySelectorAll('.ed button, .ed input, .ed a')].filter((el) => {
				const cs = getComputedStyle(el);
				if (cs.visibility === 'hidden' || !el.getClientRects().length || el.closest('[hidden]')) return false;
				if (el.closest('.ed-canvas')) return false; // canvas content pans; it is not page layout
				const r = el.getBoundingClientRect();
				return r.width > 0 && (r.left < -1 || r.right > window.innerWidth + 1);
			}).length === 0,
			top: document.querySelector('.ed-top').scrollWidth <= document.querySelector('.ed-top').clientWidth + 1,
		}));
		expect(await noHScroll()).toEqual({ doc: true, body: true, ed: true, top: true });
		const dockBtn = page.getByRole('button', { name: 'Shapes panel' });
		const inspBtn = page.getByRole('button', { name: 'Format panel' });
		await expect(dockBtn).toBeVisible();
		await expect(page.locator('#ed-dock')).toBeHidden();
		await expect(page.locator('#ed-insp')).toBeHidden();
		await expect(page.getByTestId('empty-state')).toContainText('Open the Shapes panel');

		await dockBtn.click();
		await expect(dockBtn).toHaveAttribute('aria-expanded', 'true');
		await expect(page.locator('#ed-dock')).toBeVisible();
		await page.locator('#ed-dock').getByRole('button', { name: 'Add Decision' }).click();
		await expect(page.locator('#ed-dock')).toBeHidden(); // the drawer closes after adding
		const id = (await sel(page)).ids[0];
		expect((await cell(page, id)).kind).toBe('diamond');
		// The new shape is on screen.
		const c = await centerOf(page, id);
		expect(c.x).toBeGreaterThan(0);
		expect(c.x).toBeLessThan(390);

		await inspBtn.click();
		await expect(page.locator('#ed-insp')).toBeVisible();
		await page.locator('#ed-insp').getByRole('button', { name: 'Fill Amber' }).click();
		expect((await cell(page, id)).color).toBe('amber');
		await page.keyboard.press('Escape');
		await expect(page.locator('#ed-insp')).toBeHidden();
		await inspBtn.click();
		await page.locator('.ed-drawer-scrim').click({ position: { x: 20, y: 400 } });
		await expect(page.locator('#ed-insp')).toBeHidden();

		// Canvas still works by touch: tap the + handle.
		await page.locator('.ed-plus[data-side="b"]').tap();
		expect(await shapes(page)).toHaveLength(2);
		await page.getByRole('button', { name: 'Export' }).click();
		await expect(page.locator('#ed-export-pop')).toBeInViewport();
		await page.keyboard.press('Escape');
		expect(await noHScroll()).toEqual({ doc: true, body: true, ed: true, top: true });
		void testInfo;
	});
});

// ================================================================ Evidence

test.describe('evidence', () => {
	test('screenshots of each key state', async ({ page }, testInfo) => {
		await openEditor(page);
		await page.evaluate(() => document.fonts.ready);
		await shot(page, testInfo, '01-empty');

		const ids = await buildFlowchartViaUI(page);
		// Branch off the decision and loop back, with the connector tool.
		await E(page, (i) => window.__easyDiagram.engine.select([i]), ids.second);
		await page.locator('.ed-plus[data-side="r"]').click();
		const label = inspector(page).getByRole('textbox', { name: 'Label', exact: true });
		await label.fill('Back-order');
		await label.press('Enter');
		await E(page, () => window.__easyDiagram.engine.fit());
		await E(page, () => window.__easyDiagram.engine.clearSelection());
		await page.waitForTimeout(400);
		await shot(page, testInfo, '02-flowchart');

		await E(page, (i) => window.__easyDiagram.engine.select([i]), ids.second);
		await inspector(page).getByRole('button', { name: 'Animation: Pulse' }).click();
		await inspector(page).getByRole('button', { name: 'Fill Violet' }).click();
		await page.waitForTimeout(300);
		await shot(page, testInfo, '03-shape-inspector');

		const edge = await E(page, (i) => window.__easyDiagram.engine.cells().find((c) => c.type === 'edge' && c.source === i).id, ids.first);
		await E(page, (i) => window.__easyDiagram.engine.select([i]), edge);
		await inspector(page).getByRole('button', { name: 'Animation: Flow' }).click();
		await page.waitForTimeout(300);
		await shot(page, testInfo, '04-connector-inspector');

		await page.keyboard.press('Control+k');
		await page.waitForTimeout(250);
		await shot(page, testInfo, '05-command-palette');
		await page.keyboard.press('Escape');

		await page.getByRole('button', { name: 'Export' }).click();
		await page.waitForTimeout(250);
		await shot(page, testInfo, '06-export-popover');
		await page.keyboard.press('Escape');

		await page.getByRole('button', { name: 'Switch to light mode' }).click();
		await E(page, (i) => window.__easyDiagram.engine.select([i]), ids.second);
		await page.waitForTimeout(300);
		await shot(page, testInfo, '07-light-theme');

		await page.setViewportSize({ width: 390, height: 844 });
		await page.getByRole('button', { name: 'Switch to dark mode' }).click();
		await E(page, () => window.__easyDiagram.engine.fit());
		await page.waitForTimeout(300);
		await shot(page, testInfo, '08-phone');
		await page.getByRole('button', { name: 'Shapes panel' }).click();
		await page.waitForTimeout(400);
		await shot(page, testInfo, '09-phone-shapes-drawer');
		await page.getByRole('button', { name: 'Format panel' }).click();
		await page.waitForTimeout(400);
		await shot(page, testInfo, '10-phone-format-drawer');
	});

	test('full session network log: load, draw, save, export, reopen; only the test origin', async ({ page }, testInfo) => {
		const log = [];
		const t0 = Date.now();
		page.on('requestfinished', async (r) => {
			const res = await r.response();
			log.push({ t: Date.now() - t0, method: r.method(), url: r.url(), type: r.resourceType(), status: res ? res.status() : null });
		});
		page.on('requestfailed', (r) => log.push({ t: Date.now() - t0, method: r.method(), url: r.url(), type: r.resourceType(), failed: r.failure() && r.failure().errorText }));
		const step = (name) => log.push({ t: Date.now() - t0, step: name });

		step('load');
		await openEditor(page);
		await page.waitForLoadState('networkidle');
		step('draw');
		const ids = await buildFlowchartViaUI(page);
		await E(page, (i) => window.__easyDiagram.engine.select([i]), ids.second);
		await inspector(page).getByRole('button', { name: 'Animation: Glow' }).click();
		step('save');
		const [saved] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Control+s')]);
		const savedXml = (await readDownload(saved)).toString('utf8');
		step('export png');
		await page.getByRole('button', { name: 'Export' }).click();
		const [png] = await Promise.all([page.waitForEvent('download'), page.locator('.ed-pop-go').click()]);
		step('export svg');
		await page.keyboard.press('Control+k');
		await page.getByRole('combobox').fill('Export as SVG');
		const [svg] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Enter')]);
		step('print');
		await page.keyboard.press('Control+p');
		step('reopen saved .drawio');
		const model = await cells(page);
		await page.reload();
		await page.waitForFunction(() => window.__easyDiagram);
		await page.getByTestId('draft-prompt').waitFor({ state: 'detached', timeout: 2000 }).catch(() => {});
		await openViaChooser(page, { name: 'Untitled.drawio', mimeType: 'application/xml', buffer: Buffer.from(savedXml) });
		await expect(toast(page)).toHaveText('Opened “Untitled.drawio”');
		expect(await cells(page)).toEqual(model);
		expect(savedXml).toContain('edAnim=glow');
		await page.waitForLoadState('networkidle');
		step('done');

		const origin = new URL(page.url()).origin;
		const requests = log.filter((e) => e.url);
		const foreign = requests.filter((e) => !sameOrigin(e.url, origin));
		const summary = {
			browser: testInfo.project.name,
			origin,
			capturedAt: new Date().toISOString(),
			totalRequests: requests.length,
			foreignRequests: foreign.length,
			origins: [...new Set(requests.map((e) => (/^(data|blob):/.test(e.url) ? e.url.split(':')[0] + ':' : new URL(e.url).origin)))],
			downloads: [saved.suggestedFilename(), png.suggestedFilename(), svg.suggestedFilename()],
			log,
		};
		fs.mkdirSync(EVIDENCE, { recursive: true });
		const file = testInfo.project.name === 'chromium' ? 'network-log.json' : `network-log-${testInfo.project.name}.json`;
		fs.writeFileSync(path.join(EVIDENCE, file), JSON.stringify(summary, null, 2));
		expect(foreign).toEqual([]);
		expect(requests.length).toBeGreaterThan(5);
		// Nothing but GETs of the page and its static files.
		for (const r of requests) {
			if (/^(data|blob):/.test(r.url)) continue;
			expect(r.method).toBe('GET');
			expect(new URL(r.url).pathname).toMatch(/^\/(easy-diagram|static\/easydiagram\/)/);
		}
	});
});
