# Easy Diagram: build brief (multi-agent)

This is the shared brief every agent working on Easy Diagram reads first. The
feature doc is `docs/features/easy-diagram.md`, which describes what is
built; its original reverse-engineering survey, functionality inventory and
"fork and host separately" plan were superseded by the decisions below and
now sit under that doc's History. Where this brief and the code disagree,
the code wins; the contract sections below were updated to the build on
2026-10-21. The approved visual design is
`docs/features/easy-diagram/prototype-precision.dc.html`, the "Precision" look.
It is a design-canvas file, so read it for tokens, layout and behavior; it is
not code to ship.

## Decisions (made by the user, 2026-10-13)

1. **Lives inside this repo** and is served by this Go app at `/easy-diagram`.
   No separate fork repo.
2. **A new UI shell.** We build our own editor UI, matching the Precision
   prototype, on top of draw.io's graph engine (mxGraph plus draw.io's
   `grapheditor` `Graph`). We do **not** ship draw.io's own `EditorUi`/`App`
   UI.
3. **Local only.**
   - No cloud storage, no export server, and no requests to draw.io,
     diagrams.net, Google or any third party.
   - Files stay on the user's device: File System Access API where the
     browser has it, upload/download otherwise, and IndexedDB drafts.
4. **Files stay real draw.io XML.** We write standard `<mxfile>` XML that
   opens in upstream draw.io. *(2026-10-17: the extension is now `.ed`
   rather than `.drawio`, at the user's request; only the name changed. See
   "The `.ed` file extension" in `docs/features/easy-diagram.md`.)* Our extra features are stored as extra style keys
   that upstream ignores:
   - shape animation: `edAnim`, `edAnimTrigger`, `edAnimSpeed`;
   - arrow animation: `edAnim`, `edAnimSpeed`, `edAnimDir`;
   - AWS icon service: `edAws` (added 2026-10-17, with the icon itself as a
     standard `image=` data URI).
5. **License.** draw.io core is Apache 2.0, so ship its `LICENSE` and a
   `NOTICE` next to the vendored files. Never copy code from
   `drawio-desktop`, which is GPL v3. Never show the "draw.io" name or logo in
   the UI; the trademark rule is in `docs/features/easy-diagram.md`.

Upstream source to vendor from: a shallow clone of `jgraph/drawio` at
`9034053` exists at
`/private/tmp/claude-501/-Users-vince-Repository-vincentmegia/674f025b-7432-48d1-a3d2-95f5876f99d5/scratchpad/src/drawio/`
(a past session's scratch path, likely gone; the vendored commit is recorded in
`web/static/easydiagram/vendor/NOTICE`).
The webapp is under `src/main/webapp/`. Vendor only what the engine needs
(e.g. `mxgraph/mxClient.js`, the `js/grapheditor/` sources it requires, and
any sanitizer, deflate or shape files those pull in). Do not vendor the
109 MB webapp.

## File layout and ownership

Each work package (WP) owns its files. **Don't edit files another WP owns.**
If you need a change in one, message that WP's agent, or record the need in
your final report.

```text
internal/handler/easy_diagram.go, easy_diagram_test.go     WP1 Platform
web/templates/pages/easy-diagram.html                       WP1 Platform (full-viewport page, no site chrome)
cmd/server/main.go (one route line), pages.go (Projects card), e2e/projects.spec.js (card assertion)
                                                            WP1 Platform; additive edits only, those files have unrelated uncommitted work
web/static/easydiagram/vendor/**  (+ LICENSE, NOTICE)       WP2 Engine
web/static/easydiagram/js/engine.js                         WP2 Engine (the contract below)
web/static/easydiagram/js/animation.js                      WP2 Engine (renders edAnim* on the SVG)
web/static/easydiagram/css/easy-diagram.css                 WP3 Shell
web/static/easydiagram/js/app.js                            WP3 Shell (entry: boots engine + shell + io)
web/static/easydiagram/js/shell/*.js                        WP3 Shell (topbar, dock, toolbar, inspector, statusbar, palette, export popover, toasts)
web/static/easydiagram/js/io.js                             WP4 IO
e2e/easy-diagram.spec.js                                    WP5 Verification (WP1–4 may add cases; coordinate via WP5)
docs/features/easy-diagram.md (status/decisions/testing)    WP5 Verification
```

Script loading:
- `easy-diagram.html` loads the vendored engine scripts as classic `<script>`
  tags first, in the order WP2 documents at the top of `engine.js`.
- Then it loads `/static/easydiagram/js/app.js` as `type="module"`.
- All JS is plain browser JS: no build step and no npm runtime deps.

## The page and its CSP (WP1)

- `GET /easy-diagram` renders a full-viewport page without the site's
  header and footer. On the `/projects` card, the link is a `FullPageLoad`,
  like Bus Stop Finder (`internal/handler/pages.go`).
- The global CSP (`internal/middleware/middleware.go`) is
  `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'`.
  It blocks inline `<script>` and `eval`, and **inline `style=` attributes in
  parsed HTML/SVG markup**.
  - mxGraph renders SVG through the DOM API (`setAttribute`/`el.style`),
    which CSP allows.
  - Anything that builds markup strings with `style="..."` (e.g. `innerHTML`)
    needs `style-src 'self' 'unsafe-inline'`.
- WP1 sets a **route-scoped CSP** on `/easy-diagram`, the way
  `bus_stops.go`'s `busStopsMapsCSP` does: the strictest policy that works.
  The shipped policy is `easyDiagramCSP` in
  `internal/handler/easy_diagram.go` (asserted exactly by
  `TestEasyDiagramIndex_ExactCSP` and the `platform` Playwright spec):

  ```text
  default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:; font-src 'self'; connect-src 'self';
  worker-src 'self'; object-src 'none'; base-uri 'self';
  form-action 'none'; frame-ancestors 'none'
  ```

  Compared with this brief's first draft, `worker-src` dropped `blob:`
  (nothing creates a Worker) and `form-action 'none'` was added (the editor
  has no forms).
- The engine needs no `'unsafe-eval'`: mxClient's eval paths are behind
  `allowEval` flags, and `engine.js` switches off
  `mxStencilRegistry.allowEval` and `dynamicLoading` (see the comment at the
  top of `engine.js`).
- An HTMX request to `/easy-diagram` gets `HX-Redirect` instead of the page,
  so htmx does a full load (the CSP only applies to a real document load).
- Fonts:
  - IBM Plex Sans/Mono must be **self-hosted** under
    `web/static/easydiagram/fonts/` (WP3). Google Fonts would break
    `connect-src`/`font-src 'self'` and the "no third-party requests" rule.
  - The six woff2 files (Sans 400/500/600/700, Mono 400/500) are in
    place; `system-ui`/`ui-monospace` remain as CSS fallbacks.

## Engine contract (WP2 implements; WP3/WP4 consume)

`engine.js` is an ES module exporting `createEngine(container, options)`. It
returns:

```js
{
  // document
  load(xml),            // accepts mxfile XML (compressed or not), one <diagram> per page
  toXml(),              // uncompressed <mxfile> string of all pages
  isEmpty(),
  pages(),              // [{id, name}]
  currentPage(),        // id
  addPage(name),        // -> id, selects it
  selectPage(id), renamePage(id, name), removePage(id),

  // shapes & connectors
  addShape(kind, props?),        // kind: rect|round|pill|ellipse|diamond|para|hex|cyl|doc|note|text|aws; props: {x,y,w,h,label,color, service (aws only)}; -> id (placed in free space if no x/y), selected
  addConnected(sourceId, side, opts?),  // side: 'r'|'l'|'t'|'b' -> new shape id, connected by an edge, selected (opts below)
  connect(sourceId, targetId, props?), // -> edge id; props: label, color, lineStyle, width, arrows, head, route, anim, preset, sourceSide, targetSide
  getCell(id),          // ShapeModel | EdgeModel | null
  update(id, patch),    // one undoable edit; patch uses model keys below
  remove(ids), duplicate(ids),   // duplicate -> new ids

  // selection
  getSelection(),       // {type: 'none'|'shape'|'edge'|'multi', ids: []}
  select(ids), clearSelection(),

  // tools & view
  setTool(name),        // select|hand|rect|ellipse|diamond|connector|text|note
  getTool(),            // -> current tool name (added by WP2)
  setConnectorPreset(name), getConnectorPreset(),  // added 2026-10-20, below
  setPortMode(mode), getPortMode(), shapeAt(x, y), // added 2026-10-20, below
  getZoom(), zoomTo(scale), zoomIn(), zoomOut(), fit(),
  setGrid('dots'|'lines'|'none'), setSnap(bool),
  setTheme('dark'|'light'),

  // history
  undo(), redo(), canUndo(), canRedo(),

  // animation
  setMotion(bool),      // global play/pause
  replay(id),           // restart a shape's animation

  // export (all client-side)
  toSvg({transparent, embed}),        // -> string; embed=true stores the mxfile XML in the SVG `content` attribute (upstream-compatible)
  toPngBlob({scale, transparent, embed}), // -> Promise<Blob>; embed=true writes the XML into a zTXt/tEXt `mxfile` chunk like upstream
  toAnimatedSvg({transparent}),       // -> {svg, animated, background}; the toSvg drawing plus the animation classes/overlays, for the HTML export (added 2026-10-20)

  // geometry helpers (added 2026-10-13 for WP3)
  clientToModel(clientX, clientY), // -> {x, y} model coords for a viewport point (dock drag-to-canvas; addShape's x,y = top-left)
  cells(),              // -> [ShapeModel|EdgeModel] for the current page
  getScreenBounds(id),  // -> {x, y, w, h} | null, CSS px relative to the engine container

  // events
  on(event, fn), off(event, fn),      // 'change' | 'selection' | 'zoom' | 'page' | 'tool' | 'view' (pan/scroll/resize) | 'connect-request'
  destroy()
}
```

*Added 2026-10-20* for the connectors dock group, connection points and
connect picker (see `docs/features/easy-diagram.md`, "Connectors: dock
group, connection points and shape picker"):

```js
addConnected(sourceId, side, opts?)  // opts: {kind, props, preset, at:{x,y}}; no opts = a Rounded "Next step" as before
connect(sourceId, targetId, props?)  // props also takes preset, sourceSide, targetSide ('r'|'l'|'t'|'b')
setConnectorPreset(name), getConnectorPreset()   // arrow|straight|curved|dashed|both|line (CONNECTOR_PRESETS)
setPortMode('hover'|'always'|'off'), getPortMode()
shapeAt(clientX, clientY)            // -> {id, side} | null
on('connect-request', fn)            // a connection point was clicked, or a drag released on empty canvas
```

These replaced the four `+` quick-connect handles (see "Engine rules"
below) with connection points: four per shape, which you click or drag.

Options: `createEngine(container, {theme: 'dark'|'light', grid: 'dots'|'lines'|'none', snap: true, motion: true, ports: 'hover'|'always'|'off'})`.
The engine owns the stage background and grid inside its container.

Models (`getCell` returns them and `update` patches them):

```js
ShapeModel { id, type: 'shape', kind, label, x, y, w, h,   // kind includes 'aws'
             color,          // blue|green|violet|pink|amber|slate (stroke hues from the prototype; fill = tint derived per theme)
             service,        // aws kind only: an AWS_SERVICES id from aws-icons.js (added 2026-10-17)
             strokeWidth,    // 1 | 1.5 | 3
             opacity,        // 20..100
             shadow,         // bool
             anim: { name,   // none|pulse|bounce|float|wiggle|glow|blink|pop
                     trigger,// loop|hover|once
                     speed } // slow|normal|fast
           }
EdgeModel  { id, type: 'edge', source, target, label,
             lineStyle,      // solid|dashed|dotted
             color,          // default|accent|blue|green|pink|amber
             width,          // 1.2 | 1.8 | 3
             arrows,         // end|both|start|none   (added 2026-10-17)
             head,           // block|open|oval|diamond
             route,          // elbow|straight|curved
             anim: { name,   // none|flow|dash|comet|pulse|draw (dash is "March" in the UI)
                     speed, direction } // direction: normal|reverse
           }
```

Engine rules:
- Every `update`/`add*`/`remove`/`duplicate` is a single undo step.
- `change` fires after every model change; WP4 drafts and the WP3 status bar
  listen to it.
- Shapes render in the Precision style:
  - outlined in the colour's stroke, with a faint tint fill;
  - small corner radius;
  - IBM Plex label;
  - dashed outline on `note`.
- Edges render orthogonal (elbow) with an end arrowhead by default; `route`
  and `arrows`/`head` change that.
- Selection shows the prototype's thin accent frame. *(Superseded
  2026-10-20: the original four `+` quick-connect handles are gone.)* Each
  shape now has four connection points, DOM overlays drawn by the engine
  (`portScreen` places them; on an AWS icon the bottom one sits below the
  label). Clicking one fires `connect-request` (the shell opens the connect
  picker, which calls `addConnected`); dragging one draws a connector.
- Animations match the prototype keyframes. Shapes animate via CSS classes on
  the cell's SVG group; edges via overlay paths using
  `stroke-dasharray`/`pathLength`.
- `setMotion(false)` pauses everything, and `prefers-reduced-motion`
  disables it.

## IO contract (WP4 implements; WP3 consumes)

`io.js` is an ES module exporting:

```js
openFile()                 // -> Promise<{name, xml, handle|null}>; accepts .ed/.drawio/.xml, plus .svg/.png with embedded diagram (handle only for XML files)
save(engine, file)         // file {name, handle|null} -> Promise<{name, handle|null}>; in place via handle, else showSaveFilePicker, else download
saveAs(engine, file)
exportFile(engine, {format: 'png'|'svg'|'html'|'ed', scale, transparent, embed, name})  // triggers a download; PDF is the shell's print()
saveDraft(xml, name)       // IndexedDB, keyed by file name, debounced writes coalesce; at most 20 drafts kept
loadDraft(name?)           // -> Promise<{name, xml, savedAt}|null>; no name = the newest draft (adopted from another tab if needed)
clearDraft(name?)          // no name clears all; every draft call is wrapped in try/catch
importDroppedFile(file: File) -> Promise<{name, xml}>
```

Also expose a test hook: `window.__easyDiagram = { engine, io }`. WP3 sets it
in `app.js`, so Playwright can assert model state. This is the only global
allowed.

## Shell UI (WP3) must match the prototype

- **Top bar:** logo + "Easy Diagram", file name, save status, page tabs
  (underline style) with an add-page button, Motion on/off, undo/redo, theme
  toggle, "Search & commands ⌘K", and an Export popover. The popover offers
  PNG / SVG / HTML (animated) / PDF / `.ed` (`shell/export.js`), with
  Transparent background, Keep it editable (embed) and Scale 1×/2×/3×;
  options that don't apply to a format are disabled. PDF goes through
  `window.print()` with a print stylesheet.
- **Left dock:**
  - a Connectors group (six presets) at the top, added 2026-10-20;
  - search box and category chips (All/Basic/Flowchart/AWS; the AWS chip
    was added 2026-10-17);
  - 3-column shape tiles; clicking one adds the shape;
  - dragging a tile onto the canvas adds it at the drop point.
  - The prototype's "Libraries" list is a disabled "coming soon" row; don't
    fake it.
- **Bottom tool pill:** a sliding indicator with tooltips. Keyboard shortcuts
  V H R O D A T N, plus:
  - ⌘Z / ⇧⌘Z, ⌘D, ⌘K;
  - Delete/Backspace;
  - Esc clears the selection or closes overlays.
  - Shortcuts are ignored while typing in an input.
- **Inspector**, changing with the selection:
  - **Shape:** label, Fill, Animation (8 tiles with live previews,
    Play/Speed, Replay), Stroke, Opacity, Shadow, Connections (each selects
    its edge), X/Y/W/H, Duplicate/Delete.
  - **Connector:** from → to, label, Animation (6 tiles with previews,
    Speed/Direction), Line, Color, Width, Delete.
  - **Nothing selected:** page name, Grid, Snap, Connection points
    (On hover/Always/Off), Default connector, Shortcuts.
  - Connector panels also have Arrowheads, Head and Route; AWS shapes get a
    Service picker in place of Fill and Stroke.
- **Bottom-left status readout and bottom-right zoom controls.** The minimap
  is optional. If it isn't done, leave it out rather than faking it. (It was
  not built.)
- **Command palette:** filterable; runs real actions.
- **Empty-page state** and **toasts**.
- **Dark (default) and light themes**, via CSS custom properties.
- **Accessibility:**
  - real buttons and labels;
  - `aria-pressed` on toggles;
  - focus-visible rings;
  - contrast ≥ 4.5:1 for text.
- **At phone width** the dock and inspector collapse into toggleable
  drawers. The canvas still works.

## Testing and the evidence standard

Never touch the user's server already listening on :8080. For browser tests,
start your own server and point Playwright at it:

```sh
PORT=8090 go run ./cmd/server          # uses .env for DATABASE_URL
E2E_BASE_URL=http://localhost:8090 npx playwright test -c e2e/playwright.config.js e2e/easy-diagram.spec.js
```

WP1 makes `e2e/playwright.config.js` honor `E2E_BASE_URL` (default
`http://localhost:8080`, so existing behavior is unchanged). When that var is
set, the `webServer` blocks must not start or reuse anything on :8080. Kill
any server you started when you are done.

"Proof that it works" means all of the following, saved under
`Claude outputs/easy-diagram/evidence/`:

- `go test ./...` output: all pass.
- Playwright output for `e2e/easy-diagram.spec.js` on **Chromium and
  WebKit**: all pass.
- Screenshots of each key state, captured by the spec into the evidence
  folder:
  - empty page;
  - flowchart built via the UI;
  - shape selected with the inspector;
  - connector selected with animations;
  - command palette;
  - export popover;
  - light theme;
  - phone width.
- A **network log** from a full session (load, draw, save, export) showing
  zero requests to any origin other than the test server.
- A round-trip check: save `.ed` (originally `.drawio`) → reload → identical model, plus
  `edAnim*` keys present in the XML.
- An exported PNG with an embedded diagram re-imports as an editable diagram.
- A CSP check: no CSP violation console errors during the session.

## Review protocol

- Every WP is reviewed by a different agent before it counts as done:
  - WP2 reviews WP3;
  - WP3 reviews WP4;
  - WP4 reviews WP1;
  - WP1 reviews WP2.
- A review means reading the diff, running it, and reporting concrete
  defects with file:line and repro steps. The author fixes; the reviewer
  re-checks.
- WP5 (flow reviewer) then reviews the **entire flow** end to end against
  this brief and the prototype. WP5 writes the evidence report
  `Claude outputs/easy-diagram/evidence/REPORT.md`, listing:
  - each requirement;
  - its proof (test name, screenshot or log file);
  - any open issue.
- Done means no open issues, or each remaining one explicitly listed for the
  user to decide.
