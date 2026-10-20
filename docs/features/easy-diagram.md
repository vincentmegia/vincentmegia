# Feature: Easy Diagram

## Status

`Implemented` at `/easy-diagram`, with a new UI shell built on draw.io's
graph engine. The build decisions in `docs/features/easy-diagram/BUILD.md`
superseded this doc's original "fork the whole editor" plan. Four later
changes are described below: [The `.ed` file extension](#the-ed-file-extension),
[AWS icons](#aws-icons), [Connector arrowheads](#connector-arrowheads) and
[Connectors: dock group, connection points and shape picker](#connectors-dock-group-connection-points-and-shape-picker).

The rest of this doc started as a reverse-engineering survey of
draw.io's desktop and core repositories, plus a plan for turning them into a
self-hosted browser diagram editor. Every claim below comes from reading the
upstream source at these commits, not from running either app:

| Repo | Commit | Version |
| ---- | ------ | ------- |
| [`jgraph/drawio-desktop`](https://github.com/jgraph/drawio-desktop) | `d5cd628` (2026-10-11) | 32.4.1 |
| [`jgraph/drawio`](https://github.com/jgraph/drawio) | `9034053` (2026-10-08) | 32.4.1 |

Re-check against current upstream before relying on any detail. Both repos
move fast: `electron.js` alone is about 4,500 lines.

## Summary

Easy Diagram is a browser-based diagramming editor (flowcharts, UML, network,
ER, wireframes and so on). It is built from a fork of the draw.io editor and
hosted by us, with no cloud integrations and no traffic to draw.io's servers.

## Problem / Motivation

The goal is "fork drawio-desktop and make a browser version". Reading the
source changes that plan in three ways:

1. **drawio-desktop isn't the editor.** It is an Electron shell (about 6,100
   lines in `src/main/`) around the `drawio` git submodule. The submodule
   contains the real editor: about 246,000 lines of JS in
   `src/main/webapp/js/{grapheditor,diagramly}` plus mxGraph. That editor is
   already a browser app. It is what runs at app.diagrams.net, and the
   upstream README says forking `jgraph/drawio` and publishing it to GitHub
   Pages gives "a fully functional editor (without integrations)".
2. **Fork `jgraph/drawio`, not `jgraph/drawio-desktop`.** The licenses differ:
   - drawio-desktop is **GPL v3 only since v31.5.2** (Apache 2.0 before it).
   - The core `drawio` repo is **Apache 2.0**.
   - A browser version needs nothing from the Electron layer, so forking core
     avoids GPL obligations entirely.
3. **The work is subtraction, not porting.** The desktop layer adds native
   file I/O, CLI export, auto-update and OS integration. A browser build
   mostly needs the reverse: turn off the parts of the web build that phone
   home (cloud storage, export server, icon search, notifications, realtime
   collaboration). Then add whatever desktop-like behavior we want back,
   using browser APIs.

Without this feature the site has no diagramming tool. The alternative is
linking to app.diagrams.net, which is someone else's product and sends
diagram traffic to their servers.

## Scope

**In scope:**

* A fork of `jgraph/drawio`, rebranded as "Easy Diagram", served as static
  files.
* Local-only operation:
  - open and save `.ed` files (Easy Diagram's extension, holding standard
    draw.io XML; `.drawio`/`.xml` still open) through the File System Access
    API,
    falling back to upload/download where the API isn't supported;
  - browser-storage drafts and autosave;
  - client-side PNG/SVG/HTML/XML export;
  - PDF via the browser print dialog.
* Turning off every outbound integration by default: Google Drive, OneDrive,
  Dropbox, GitHub, GitLab, Trello, the export server, icon search,
  notifications, realtime collaboration and Google Fonts.
* A `/projects` card on this site linking to it.

**Out of scope:**

* Rewriting the editor, or porting it to HTMX/Go templates. It is a
  246,000-line client-side JS app and stays one.
* The Electron shell, installers, code signing and auto-update.
* The desktop CLI exporter (`drawio -x …`). See Open Questions for a
  possible server-side replacement.
* Real-time collaboration and cloud storage.
* Accounts, or saving diagrams to Postgres. This could be a later feature; see
  Open Questions.

---

## Reverse-engineered architecture

```text
drawio-desktop/                      (GPL v3, Electron shell)
├── src/main/electron.js             main process: windows, menus, IPC, export, update
├── src/main/electron-preload.js     contextBridge → window.electron.request(...)
├── src/main/args.js                 CLI option table (export mode)
├── src/main/{backup-file,config-paths,file-watcher,export-files,…}.js
└── drawio/  (git submodule)         (Apache 2.0, the actual editor)
    └── src/main/webapp/             ~109 MB static web app
        ├── index.html               boot page
        ├── js/PreConfig.js          deployment overrides (EXPORT_URL, DRAWIO_CONFIG…)
        ├── js/PostConfig.js         nulls ICONSEARCH_PATH etc. after Init.js
        ├── js/app.min.js            compiled editor bundle
        ├── js/diagramly/            app layer (App, EditorUi, Editor, Menus, files, clients)
        ├── js/grapheditor/          generic graph editor (Graph, Format, Sidebar, Actions)
        ├── mxgraph/                 mxGraph rendering/model library
        ├── js/diagramly/ElectronApp.js  desktop overrides, loaded only under Electron
        ├── templates/               156 diagram templates in 15 categories
        ├── resources/dia_*.txt      58 UI languages
        ├── plugins/                 20 built-in plugins
        ├── export3.html             headless page used by the export pipeline
        ├── service-worker.js        PWA/offline cache (workbox)
        └── WEB-INF/ + ../server/java    optional Java servlets (OAuth, proxy, export)
```

The desktop app loads `index.html` from disk into a `BrowserWindow`.
`ElectronApp.js` then monkey-patches the web app: about 70 `prototype`
overrides on `App`, `EditorUi`, `Editor`, `LocalFile` and `Graph`. These
reroute file I/O, printing, clipboard, update checks and zoom through
`window.electron.request({action, ...})`, which the preload bridges to
`ipcMain.on('rendererReq')` in `electron.js`.

### Storage modes (core)

`App.js` defines these modes: `google`, `dropbox`, `onedrive`, `github`,
`gitlab`, `trello`, `device`, `browser`, `embed`, `atlas`. We keep:

* **`device`**: local files. On Chromium this uses `showOpenFilePicker` and
  `showSaveFilePicker`, and the editor keeps a `fileHandle` so later saves
  write back in place (`App.prototype.loadFileSystemEntry`,
  `App.prototype.showSaveFilePicker`). Elsewhere it falls back to upload and
  download.
* **`browser`**: diagrams kept in browser storage (`StorageFile`). Drafts and
  the scratchpad use IndexedDB (`EditorUi.js`, `indexedDB.open('database', 2)`).

We disable every other mode.

### File format

A diagram is an `<mxfile>` XML document with one `<diagram>` per page. Each
page holds an `mxGraphModel`, which by default is compressed: deflate, then
base64, then URI-encoded (`Graph.compress`/`Graph.decompress`,
`Editor.compressXml = true`, overridable through config `compressXml`).

PNG, SVG and PDF exports can embed the same XML so they reopen as editable
diagrams:

* PNG: a `zTXt`/`tEXt` chunk (`writePngWithText`, `readPngXml` in
  `electron.js`).
* SVG: a `content` attribute (`readSvgXml`).
* PDF: an attachment or annotation (`readPdfXml`, `mergePdfs`).

### The `.ed` file extension

The user asked for `.ed` in place of `.drawio` ("for easy-diagram instead of
.drawio extension change it to .ed"). Only the name changed; the bytes are
the same `<mxfile>` XML, so this reverses BUILD.md decision 4's "files stay
real `.drawio`" for the name only. In `web/static/easydiagram/js/io.js`
(`EXT`, `diagramName`):

* **Save / Save as:** suggest `<name>.ed`, and the save picker's type is
  "Easy Diagram (.ed)". An opened file that has a write handle (for example
  an old `.drawio` opened through the picker) is still saved in place under
  its own name. Easy Diagram never renames a file on disk.
* **Export:** the popover's diagram option is `.ed` (`Untitled.ed`). PNG and
  SVG with the diagram embedded are named `<name>-<page>.ed.png` and
  `.ed.svg`; plain ones stay `.png`/`.svg`.
* **Open / drop / import:** `.ed`, `.drawio` and `.xml` all open, as do
  `.png`/`.svg` with an embedded diagram. An image import, or a dropped file
  without a handle, saves as `<name>.ed`; a legacy `x.drawio` dropped in
  saves as `x.ed`. Both `x.ed.png` and the older `x.drawio.png` import as
  `x.ed`.
* The new-document name is `Untitled.ed`, and drafts are keyed by it.
* Unchanged: the MIME type (`application/xml`) and the content. The
  `edAnim*`/`edAws` style keys are ignored by upstream draw.io.

### AWS icons

The user asked to "add AWS icons that optionally be animated as well".

* **What they are:** 24 AWS services in 9 categories, from
  `web/static/easydiagram/js/aws-icons.js`:
  - Compute: EC2, Lambda, ECS, EKS
  - Storage: S3, EFS
  - Database: RDS, DynamoDB, Aurora
  - Networking: VPC, CloudFront, Route 53, Load Balancer
  - App integration: API Gateway, SQS, SNS, Step Functions, EventBridge
  - Security: IAM, Cognito, KMS
  - Management: CloudWatch
  - Analytics: Kinesis
  - Machine learning: SageMaker

  Each icon is a rounded tile in the AWS category colour (Compute orange
  `#ED7100`, Storage green `#7AA116`, Database `#C925D1`, and so on) with a
  white line-art glyph. **These glyphs are original drawings, not AWS's
  official Architecture Icons:** no AWS artwork is copied or bundled, and
  the service names are used only to say what a shape stands for. If the
  official icon set is wanted later, it can replace the glyphs behind the
  same `awsIconSvg(id)` function, subject to AWS's terms for those icons.
* **Dock:** a new **AWS** category chip lists one tile per service, showing
  the icon itself. Search matches the short name, the full name ("Amazon
  DynamoDB") and the category ("security" finds IAM, Cognito and KMS).
  Click to add, or drag onto the canvas to drop at the pointer, like the
  other tiles.
* **Engine:** a new shape kind `aws` (64×64, with the label underneath).
  `addShape('aws', {service})`, `update(id, {service})`, and the
  `ShapeModel` gains a `service` field. A shape stores:
  - `edAws=<service id>`;
  - standard draw.io image keys (`shape=image`, `image=data:image/svg+xml,…`,
    `verticalLabelPosition=bottom`, `imageAspect=0`, `aspect=fixed`).
  The image is a **URL-encoded** SVG data URI, so there's no raw `;` or `=`
  to break the style string, and upstream draw.io shows the icon too. It's
  inline (`data:`), so it never makes a network request and passes the
  route CSP's `img-src 'self' data: blob:`.
* **Changing the service:** this swaps `edAws` and the picture. The label
  follows the new service's name unless the user renamed the shape. An AWS
  shape can't change to an outline kind or back, and the Fill colour
  doesn't apply to it.
* **Canvas:** the floating context bar above a selected icon has no fill
  swatches (Duplicate and Delete only). Because the label sits under the
  icon, the bottom "+" quick-connect handle is pushed below the label
  (`--ed-plus-b` on the selection frame) so it doesn't cover the text.
* **Inspector:** for an AWS shape the header reads "AWS · Amazon RDS".
  A **Service** dropdown (grouped by category) replaces Fill, and Stroke
  is hidden. Label, Animation, Opacity, Shadow, Connections and
  Position & size work as for any shape.
* **Animation (optional, off by default):** AWS shapes use the same 7 shape
  animations (pulse, bounce, float, wiggle, glow, blink, pop), triggers
  (loop, on hover, once), speeds, Replay and the global Motion switch. The
  animation classes go on the cell's SVG group, which holds the icon's
  `<image>`, so the whole icon moves. Glow uses the service's category
  colour. Connectors between AWS icons animate as before (flow, march,
  comet, pulse, draw).
* **Export:** SVG/PNG export draws the icons, and an embedded PNG/SVG
  re-imports with the services intact.

### Connector arrowheads

The user reported "somehow i dont see arrows connectors". Connectors did
have an arrowhead, but it was hard to see: a 6px head in `#5C616D` on the
near-black dark canvas. Also, the context bar above a selected shape and
the shape's side "+" handles sat right on top of incoming arrowheads.

* **Visibility:** the default connector colour is lighter in the dark
  theme (`#8A8F9B`) and darker in the light theme (`#6E737E`), in both
  `THEMES` and the `--edge` token. The head size now follows the line
  width (`arrowSize(width)`: 9/10/12 for Thin/Regular/Bold). Older files
  that saved our 6px head are drawn at the new size (render-time only, for
  edges with `edColor`).
* **Inspector:** the connector panel gains three controls:
  - **Arrowheads**: End (default), Both, Start or None;
  - **Head**: Arrow (`block`), Open (`open`), Dot (`oval`) or Diamond;
  - **Route**: Elbow (default, `orthogonalEdgeStyle`), Straight
    (`edgeStyle=none`) or Curved (`orthogonalEdgeStyle` + `curved=1`).
  These are standard draw.io keys (`startArrow`/`endArrow`, `*Fill`,
  `*Size`, `edgeStyle`, `curved`), so upstream draw.io shows them as well.
* **Engine:** `EdgeModel` gains `arrows`, `head` and `route`, which
  `update()` and `connect(a, b, {arrows, head, route})` accept. When a file
  has no `endArrow`, the connector reads as `arrows: 'end'`, because
  draw.io draws a classic arrow by default.
* **Canvas:** the context bar moves below the shape when a connector comes
  in from above (and none leaves from below). A "+" handle on a side where
  a connector attaches near the middle slides along that side
  (`data-shift`), so it doesn't cover the arrowhead.

### Connectors: dock group, connection points and shape picker

**Status: implemented 2026-10-20**, from the design the user approved that
day (see Decisions at the end of this section). The mockup it started from
is in `Claude outputs/easy-diagram/connectors-poc/` (`poc.html`), and
screenshots of the built version are in
`Claude outputs/easy-diagram/connectors-build/`.

The user asked for two things:

1. "connectors to be available on the left pane with a separate group … an
   easy option to connect different components using an arrow connector
   where it snaps from one component to the other";
2. "display connectors in shapes, and clicking on connectors I have the
   option to connect different kinds of categorized shapes".

Before this, the only ways to connect were the `A` connector tool and the
four `+` handles on a selected shape. A `+` handle always added a Rounded
"Next step" shape, so you couldn't choose the kind. Neither showed where a
connector would attach before you dropped it.

**1. Connectors group in the dock** (`shell/dock.js`)

* A **Connectors** section at the **top** of the dock, above the shapes
  (which now have their own "Shapes" heading). It was first placed under
  the shape tiles, but with the 24 AWS icons it ended up below the fold.
  Search and the category chips filter shapes only, so the group is always
  visible.
* Six presets (`CONNECTOR_PRESETS` in `engine.js`, `CONNECTORS` in
  `shell/defs.js`). Each maps to keys we already write, so `.ed` files stay
  plain draw.io XML and no new `ed*` key is needed:

  | Preset   | Route    | Arrows | Line   |
  | -------- | -------- | ------ | ------ |
  | Arrow    | Elbow    | End    | Solid  |
  | Straight | Straight | End    | Solid  |
  | Curved   | Curved   | End    | Solid  |
  | Dashed   | Elbow    | End    | Dashed |
  | Two-way  | Elbow    | Both   | Solid  |
  | Line     | Elbow    | None   | Solid  |

* **Click a preset to arm it.** It switches on the connector tool with that
  preset. The tile stays highlighted (`aria-pressed`), a hint under the
  group says what to do, and every shape shows its connection points. Drag
  from one shape to another to connect. Clicking the tile again, or `Esc`,
  disarms it. After one connection it goes back to Select and the new
  connector is selected.
* **Two shapes selected + click a preset** joins them directly (first
  selected → second). The `C` key, and "Connect selected shapes" in the
  command palette, do the same with the default connector.
* **Drag a preset onto a shape** to choose that preset and open the connect
  picker from the shape's connection point nearest the drop.
* The last preset used becomes the **default connector**. Connection
  points, the picker and the `A` tool all use it. It is also shown and
  chosen in the "nothing selected" inspector. It is remembered in
  `localStorage` (`easyDiagram.connector`), a per-viewer convenience that is
  not stored in the file.

**2. Connection points on shapes** (`engine.js`; replaces the `+` handles)

* Each shape has four connection points, one at the middle of each side:
  a small ring that grows and shows a `+` on hover or focus.
  - They show on the shape under the pointer (within 14px of it) and on
    the selected shape. They show on every shape while a connector is armed
    or being dragged.
  - On an AWS icon, the bottom point sits below the label.
  - A **Connection points: On hover / Always / Off** setting in the
    "nothing selected" inspector controls this, and is remembered in
    `localStorage` (`easyDiagram.ports`).
  - The points are real buttons ("Connect from the right side of In
    stock?"). They live in their own overlay layer and are kept across
    redraws (moved, not rebuilt), so focus and hover survive panning and
    selection changes.
* **Drag a point** to draw a connector. A dashed accent preview follows the
  pointer. Over another shape it snaps:
  - within 28px of one of that shape's points, to that point;
  - anywhere else on the shape, to the side facing the source point.
  
  A ring marks the snap point. On release the connector stores exactly
  those sides (`exitX/exitY/entryX/entryY`), so it doesn't jump. `Esc`
  during a drag cancels it.
* **With the connector tool** (`A`, or an armed preset), you can start the
  drag anywhere on a shape. If neither end is near a point, the sides are
  chosen by `autoPorts`, as before.
* **Click (or tap) a point** to open the connect picker.
* **Release on empty canvas** also opens the picker. The new shape is then
  centred where you let go, and it is entered from its side facing the
  source.

**3. Connect picker** (`shell/connect-picker.js`)

* A popover next to the point it came from: "Connect from 'In stock?'" and
  "Adds the shape to the right, already connected".
* Tabs:
  - **Basic**, **Flowchart** and **AWS**: the same tiles as the dock (shared
    through `shapeEntries()` in `dock.js`);
  - **On this page**: the page's other shapes, to connect to one instead of
    adding a new one.

  Flowchart is the first tab shown. After that, the last tab used is
  remembered for the session.
* Picking a tile adds that kind on the clicked side and connects it with
  the default preset. Placement uses `addConnected`'s free-slot search, so
  shapes never stack. The new shape is selected, so its own points are
  ready for the next step.
* A **Connector** row at the bottom switches the preset (it also becomes
  the default).
* Keyboard: it's a dialog. The first choice gets focus, the arrow keys move
  between choices, `Enter` picks, and `Esc` closes it without clearing the
  selection. A press outside it also closes it. While it is open, the
  floating context bar is hidden; on a phone the two overlapped.

**Engine changes (`engine.js`)**

```js
addConnected(sourceId, side, opts?)  // opts: {kind, props, preset, at:{x,y}}; no opts = the old Rounded "Next step"
connect(sourceId, targetId, props?)  // props also takes preset, sourceSide, targetSide ('r'|'l'|'t'|'b')
setConnectorPreset(name), getConnectorPreset()
setPortMode('hover'|'always'|'off'), getPortMode()
shapeAt(clientX, clientY)            // -> {id, side} (the point nearest the client point) | null
on('connect-request', fn)            // fn({sourceId, side, client:{x,y}, at:{x,y}|null}): the shell opens the picker
```

`createEngine` also takes `ports: 'hover'|'always'|'off'`. Drags from a
point use the engine's own pointer handling, as the corner resize does,
rather than mxGraph's `connectionHandler`. That keeps one look for the
preview and snap, and the snap targets are exactly our four points. The
`A` tool moved onto the same code path: `setConnectable` is now always
false. The approved design had a public `beginConnect`; it turned out not
to be needed. The dock's drag-onto-shape uses `shapeAt` plus the picker
instead.

**Fixes found while building it**

* **WebKit taps:** WebKit sends no `click` after a touch tap whose
  `pointerdown` was cancelled. So a press on a point that doesn't move is
  handled on `pointerup`, and the `click` that Chromium also sends is
  ignored. `click` alone still handles the keyboard.
* **Phone layout:** `.ed` is now `overflow: clip`, not just `hidden`. A
  hidden box can still be scrolled by focus or `scrollIntoView`. That
  shifted the whole editor about 20px sideways at phone width, because the
  closed drawers sit off-canvas to the right.

**Tests** (`e2e/easy-diagram.spec.js`, the `connectors` block, Chromium and
WebKit):

* the group's position, order and armed state;
* drag with snapping, and the stored exit and entry sides;
* back to Select after one connection, and `Esc` or a second click to
  disarm;
* joining two selected shapes by a preset click and by `C`, and `C` with
  one shape;
* point drag onto a shape and onto empty canvas, and `Esc` mid-drag;
* every picker tab, keyboard navigation, the connector footer and closing
  it;
* the hover, Always and Off point modes and the default connector, both
  remembered across a reload;
* dropping a dock preset on a shape.

The older tests that used the `+` handles (the flowchart builder, the AWS
label position, phone width and the evidence shots) now use connection
points and the picker. The draft-restore test now waits for the draft of
the finished flowchart, not an earlier one. That race showed up once the
flowchart took a little longer to build.

**Decisions (made by the user, 2026-10-20)**

1. **Connection points replace the `+` handles.** Two sets of handles on
   one shape would be noisy. Clicking a point does what `+` did, but with
   a choice of shape.
2. **Four points per shape**, one at the middle of each side, with no
   corner points. That matches `autoPorts` and the elbow routing.
3. **An armed preset goes back to Select after one connection**, like the
   `A` tool.
4. **The six presets above**: Arrow, Straight, Curved, Dashed, Two-way and
   Line. No Dotted or Open arrow preset; every head and line style is
   still in the connector inspector.

---

## Functionality inventory

### A. Core editor features (already in the browser build, kept as-is)

Grouped from the action registry (`grapheditor/Actions.js`,
`diagramly/Menus.js`, `diagramly/EditorUi.js`):

| Area | Functionality |
| ---- | ------------- |
| Files | New, Open, Open from device, Save, Save As, Make a Copy, Rename, Import (drag and drop or dialog), Export, Print, Properties, Drafts, Revision history (provider-dependent), Close |
| Import formats | `.drawio`/`.xml`, `.vsdx` (Visio, `diagramly/vsdx/`), Gliffy, Lucidchart, GraphML, Mermaid (`.mmd`), PlantUML, CSV, Miro, plus editable PNG/SVG/PDF |
| Export formats | PNG, JPEG, SVG, PDF, HTML, XML, VSDX, URL. Client-side except PDF and some image cases; see Export below |
| Editing | Undo/redo, cut/copy/paste, paste style, paste here, duplicate, delete, select all/vertices/edges/children/parent/siblings, find and replace, group/ungroup, lock/unlock, edit data/tooltip/link/style/geometry/shape/polygon/connection points, edit image, crop |
| Arrange | To front/back, forward/backward, align (6 ways), distribute, rotate, swap, autosize, layouts (vertical/horizontal flow and tree, radial tree, organic, ELK via `ElkLayout.js`), orthogonal routing (libavoid), run last layout |
| Styling | Fill/stroke/gradient/font colors, rounded/sharp/curved, dashed/dotted, shadow, sketch (rough.js), word wrap, formatted text, math typesetting (MathJax, `math4/`), Google Fonts toggle, set and clear default styles |
| View | Zoom in/out/fit/reset, page view, grid, snap, ruler, page tabs, scratchpad, outline, layers, tags, fullscreen, high contrast, units (pt/in/cm/mm/m), dark mode and adaptive colors |
| Shapes | 68 sidebar palettes (Basic, Flowchart, UML 2.5, ER, BPMN, C4, AWS/Azure/GCP/IBM, Cisco, Kubernetes, network, rack, P&ID, electrical, mockups, ArchiMate, SysML, etc.), custom libraries, scratchpad |
| Pages | Multi-page documents (`Pages.js`), next/previous page, page setup and scale, background color and image |
| Extras | Animations and custom link actions, presentation mode, comments (provider-dependent), configuration editor (`ConfigEditor.js`), keyboard shortcuts, 58 UI languages, plugins |
| Plugins (built-in) | animation, anonymize, edgeConnection, explore, flow, import, number, page, props, random, replay, sql, svgdata, tags, text, trees, update, webcola (plus nextcloud and trello, which we drop) |
| Offline | Service worker (`service-worker.js`, workbox) caches the app for offline/PWA use |

### B. Desktop-only layer (drawio-desktop) and its browser equivalent

These are all the `rendererReq` actions in `electron.js`, plus the side
channels:

| Desktop action / feature | What it does | Browser equivalent for Easy Diagram |
| ------------------------ | ------------ | ----------------------------------- |
| `saveFile`, `writeFile` | Writes to a local path, with conflict detection against `origStat` and optional backup | File System Access API `fileHandle.createWritable()` (already in core). Download fallback on Firefox/Safari |
| `showOpenDialog`, `showSaveDialog` | Native file pickers | `showOpenFilePicker`/`showSaveFilePicker`, or `<input type=file>` and download (already in core) |
| `readFile`, `fileStat`, `isFileWritable`, `checkFileExists`, `dirname`, `getDocumentsFolder`, `deleteFile` | Path-based file system access | None. Browsers have no path access. Drop these and rely on handles |
| `saveDraft`, `getFileDrafts`, `getBkpFile` | Draft and `.bkp` files next to the diagram on disk | IndexedDB drafts (core `EditorUi` already does this) |
| `watchFile`, `unwatchFile` | Reloads or merges when the file changes on disk | None (no file watch API). Optionally poll `fileHandle.getFile().lastModified` |
| `clipboardAction` | Native clipboard, including images | Async Clipboard API (`navigator.clipboard.write`), already used by core in the browser |
| `windowAction`, `isFullscreen`, `toggleFullscreen`, `zoomIn`/`zoomOut`/`resetZoom` | Window chrome and Chromium zoom | Fullscreen API; editor's own zoom |
| `openExternal` | Opens links in the OS browser | `window.open(url, '_blank', 'noopener')` |
| `getLocalFonts` | Lists installed system fonts | `window.queryLocalFonts()` (Chromium, behind a permission prompt), or skip |
| `newfile` | Opens a new window | New tab |
| `export` (`exportDiagram`) | Offscreen `BrowserWindow` loads `export3.html`, then `capturePage()` for images or `printToPDF()` for PDFs. Merges PDFs with `@cantoo/pdf-lib` and embeds XML | Client-side canvas/SVG export for PNG, JPEG and SVG. PDF goes through the print dialog when `EXPORT_URL = null` (per `PreConfig.js`). A self-hosted export server is an option |
| `checkForUpdates`, `installUpdate`, `toggleAutoUpdate`, `getUpdateState` | electron-updater against GitHub releases | None. A static deploy is always current; the service worker handles cache refresh |
| `toggleSpellCheck` | Chromium spellchecker | The browser's native spellcheck on contenteditable |
| `toggleStoreBkp` | `.bkp` backup on save | None. Drafts cover this |
| `toggleGoogleFonts` | Allows Google Fonts fetches | Keep the toggle, default off (privacy) |
| `isPluginsEnabled` | Hardcoded `false` (external plugins removed 07/2026) | Same: built-in plugins only |
| `openDevTools`, `exit` | Dev and app lifecycle | None |
| Native menus (`File`, `Edit`, app menu) | OS menu bar | The editor's own in-page menus (core) |
| File associations, `argv` open, Quick Look (macOS) | OS integration | PWA `file_handlers` in the web manifest (Chromium only), optional |
| `urlParams.json` | Extra editor URL params from the install dir | `PreConfig.js` / `DRAWIO_CONFIG` |

### C. Desktop CLI export (`src/main/args.js`)

The desktop binary doubles as a headless converter. A browser app can't offer
this, but it is documented here because it is the most likely feature to want
back as a server endpoint:

* `-x/--export` with `-f pdf|png|jpg|svg|xml|html` (default pdf), `-o` output,
  and `-r` for recursive folders.
* Inputs: `.drawio`, `.vsdx`, CSV and Mermaid.
* Options:
  - `--layout <preset|json>` and `--normalize`;
  - `-q` JPEG quality, `-t` transparent background, `-e` embed diagram;
  - `--embed-svg-images`, `--embed-svg-fonts`, `--embed-svg-metadata`;
  - `-b` border, `-s` scale, `--width`, `--height`, `--crop`,
    `--size diagram|page`;
  - `-a` all pages, `-p` page index, page ranges (`1..3`);
  - `--timeout` per file;
  - `-k` don't overwrite existing files.

### D. Desktop security model (what to carry over)

The desktop app is designed so diagram data never leaves the machine, with
only the update check making outbound requests. The protections:

* The CSP forbids remote JS and limits `connect-src` to the app itself.
* `contextBridge` limits what the renderer can reach, and `validateSender` on
  every IPC call.
* Path authorization (`assertWritablePath`/`assertReadablePath`, canonicalized
  through realpath). This is because diagram content or an XSS could
  otherwise drive file IPC.
* `will-navigate` cancels navigation, and a preload Navigation API listener
  blocks `about:` navigations.
* Symlink-safe CLI export and backups (GHSA-2w35-fgjm-2vvh,
  GHSA-36x5-vw5q-29rv).

For a browser build, most of this disappears because the sandbox already
provides it. What we keep is the **CSP posture**: no third-party script
origins, and `connect-src 'self'`. That is the browser equivalent of "the app
can't phone home". The README's caveat still applies: a diagram can reference
external images or fonts, and opening it fetches them.

---

## User Flow

```text
1. User opens Easy Diagram (from the /projects card, or its URL directly).
2. A start dialog offers: New diagram (blank or template) / Open from device.
   No cloud providers are listed.
3. User picks a template or blank page; the editor opens with the shape
   sidebar, canvas and format panel.
4. User draws. Changes are autosaved as a draft in IndexedDB.
5. Save:
   - Chromium: the first save shows a native save picker, and later saves
     write in place.
   - Firefox/Safari: each save downloads a .ed file.
6. Export: File > Export as PNG/SVG/HTML/XML, generated in the browser.
   PDF opens the browser's print dialog.
7. Reopening the app offers to restore unsaved drafts.
```

---

## Implementation plan

1. **Fork `jgraph/drawio`** to the user's GitHub account as `easy-diagram`
   (a separate repo, not vendored into this one: the webapp is about 109 MB).
   Track upstream via an `upstream` remote. Upstream doesn't accept PRs, so
   merges only ever flow inward.
2. **Configure in `PreConfig.js`/`PostConfig.js`** rather than editing core JS,
   to keep upstream merges cheap:
   - `EXPORT_URL = null`, `DRAWIO_BASE_URL`/`DRAWIO_VIEWER_URL`/
     `DRAWIO_LIGHTBOX_URL` pointed at our host.
   - `ICONSEARCH_PATH`/`ICON_SERVICE_PATH`/`NOTIFICATIONS_URL` set to `null`.
   - `DRAWIO_CONFIG` for defaults (theme, palettes, `compressXml`).
   - URL params forcing local mode and hiding providers. Upstream documents
     `offline=1`, `local=1`, `stealth=1`, `mode=device`, `gapi=0`, `db=0`,
     `od=0`, `gh=0`, `gl=0`, `tr=0`. **Verify each against `Init.js`/`App.js`
     before relying on it.** This doc did not trace them.
3. **Rebrand.** Change the title, logo, favicon, manifest, about dialog and
   the visible "draw.io" strings in `resources/dia*.txt`. Required by
   trademark; see Security Considerations.
4. **Strip unused weight (optional).** Remove cloud client bundles, the Java
   `server/` and `WEB-INF/`, and the `.html` OAuth landing pages (`dropbox`,
   `github`, `gitlab`, `onedrive3`, `teams`). The desktop's packaged file set
   in its `CLAUDE.md` shows what a working app can drop.
5. **Host** as a static site with its own strict CSP. Then add a `/projects`
   card on this site.
6. **Optional server features later.** A self-hosted export server for true
   PDF export or CLI-style conversion, and Postgres-backed "My diagrams".

---

## UI

The editor UI is upstream's and is not built in `web/templates/`. Changes on
this site's side are limited to:

```text
internal/handler/pages.go      Projects card entry ("Easy Diagram")
web/static/images/easydiagram/ card screenshot
```

States (editor-side, from upstream behavior):

| State   | Behavior |
| ------- | -------- |
| Default | Start dialog: new from template / open from device |
| Loading | Upstream spinner while `app.min.js` and the shapes load. First load is heavy; the service worker caches later loads |
| Empty   | Blank page with grid |
| Error   | Upstream error dialogs (unreadable file, unsupported format, save conflict) |
| Success | Save status in the menubar ("All changes saved") |

---

## Routes / Handlers

Depends on the hosting decision (see Open Questions). Under the recommended
separate-static-host option, this site gets no new routes, only a `/projects`
card with an external link (`FullPageLoad`-style, not an HTMX nav).

---

## Data Model

None for the initial version. Diagrams live in the user's files and in
browser storage.

---

## Business Rules / Validation

* Easy Diagram must make no third-party network requests by default. This is
  enforced by CSP (`connect-src 'self'`, no external `script-src`). The only
  exceptions are images or fonts referenced by the user's own diagram, and
  Google Fonts, which are off by default.
* Saved files use the `.ed` extension, but their contents stay standard
  draw.io `<mxfile>` XML. An `.ed` file renamed to `.drawio` opens in real
  draw.io, and `.drawio`/`.xml` files open in Easy Diagram. Don't change the
  format, only the name.
* Track the upstream version. Record the forked commit in the fork's README
  and in this doc's Status table.

---

## Security Considerations

* **License:**
  - Core `drawio` is Apache 2.0: keep `LICENSE` and the copyright headers,
    and note our modifications.
  - Don't copy code from `drawio-desktop`, which is GPL v3 since v31.5.2.
    Doing so would make the fork GPL.
* **Trademark:** draw.io is a registered EU trademark (#018062448). We must
  not use the draw.io name or logo in ways that imply affiliation.
  Rebranding to "Easy Diagram" and replacing the logos is required, not
  cosmetic. "Based on draw.io (Apache 2.0)" attribution text is fine.
* **Icon/stencil license:** upstream's icon sets and stencils may not be used
  in Atlassian products or the Atlassian marketplace. This doesn't affect a
  personal site, but note it if the fork is ever repurposed.
* **Authz:** none. The tool is public and client-only.
* **Input handling:** diagrams can contain HTML labels and links. Upstream
  sanitizes these (`js/sanitizer`). Keep upstream's sanitizer and don't
  loosen `Graph` HTML-label settings.
* **Secrets:** none, as long as cloud integrations stay off. The `WEB-INF/*`
  client-id/secret files are placeholders and should be deleted from the
  fork, not filled in.

---

## Testing Plan

* [ ] Open the editor with the network panel recording: no requests to
      `*.diagrams.net`, `*.draw.io`, Google, Microsoft or Dropbox on load,
      draw, save or export.
* [ ] New → template → edit → Save → reopen the file: round-trips identically,
      and the file also opens in upstream draw.io.
* [ ] Save in place works on Chromium. The download fallback works on
      Firefox and WebKit, matching this repo's Chromium and WebKit Playwright
      coverage.
* [ ] Export PNG (with embedded diagram) → re-import → editable.
* [ ] Export SVG, HTML and XML. PDF opens the print dialog.
* [ ] Import `.vsdx` and Mermaid samples.
* [ ] Draft recovery after closing the tab with unsaved changes.
* [ ] No "draw.io" branding is visible in the UI (grep the built output).
* [ ] The `/projects` card links to it (Playwright, `e2e/projects.spec.js`).
* [x] `.ed` extension (`e2e/easy-diagram.spec.js`, the `io` and `aws icons`
      groups):
  - Save downloads `Untitled.ed` and the file is `<mxfile>` XML.
  - Export names are `.ed`, `.ed.png` and `.ed.svg`.
  - `.ed` and legacy `.drawio` files both open, and a legacy file then
    saves as `.ed`.
  - The draft is keyed `Untitled.ed`.
* [x] AWS icons (the `aws icons` group; unit tests in
      `web/static/easydiagram/js/aws-icons.test.js`):
  - Adding: the dock's AWS category adds icons by click and by drag, and
    the canvas draws each icon as an `<image>` in its category colour.
  - Inspector: the Service picker swaps the icon and the label (a renamed
    label is kept), with one undo step per change.
  - Animation: each of the 7 animations applies to the group holding the
    icon, glow uses the category colour, Motion pauses and resumes it, and
    the On hover trigger and None work.
  - Saving: an AWS diagram with animated icons and connectors saves to
    `.ed` and reopens identical, with an upstream-readable `image=` value.
  - Export: the PNG actually paints the icon colours, and an embedded PNG
    re-imports with the services intact.
  - Unit tests: icons are self-contained, the data URIs are safe in a style
    string, and unknown ids fall back to Lambda.

---

## Open Questions

* **Hosting**, with a recommendation:
  - **(a) Recommended:** a separate static deploy (GitHub Pages from the
    fork, or a Render static site), linked from `/projects`. This matches
    CLAUDE.md's "links out to the original projects rather than
    reimplementing them". It also keeps 109 MB out of this repo and lets the
    editor have its own CSP.
  - **(b)** Serve it from this Go app under `/easy-diagram/` via
    `http.FileServer`. That gives one domain, but it bloats the repo and
    deploy, and it needs a route-specific CSP like Bus Stop Finder's.
* **PDF export:** is the print dialog good enough? Or should we run a
  self-hosted export server? Upstream has a separate export-server project,
  not surveyed here.
* **Server-side storage:** do we want a "My diagrams" list in Postgres later?
  If so, it waits on the real auth feature (see CLAUDE.md's auth stub note).
* **Fork maintenance:** how often to merge upstream, and whether to keep the
  diff confined to `PreConfig.js`/`PostConfig.js`, branding assets and
  `index.html`.
* **URL params:** confirm which of `offline`/`local`/`stealth`/`mode`/
  provider-disable params exist and behave as assumed in the current
  `Init.js`.

---

## Definition of Done

* [ ] Fork exists, rebranded, with upstream remote and recorded base commit.
* [ ] All cloud providers, export server, icon search, notifications and
      realtime collaboration are disabled. Verified by a network capture
      showing no third-party requests.
* [ ] Local open/save/export works in Chromium, Firefox and WebKit, with the
      fallbacks above.
* [ ] Deployed with a strict CSP.
* [ ] `/projects` card added, with an e2e test updated.
* [ ] CLAUDE.md's Project status lists Easy Diagram.
* [ ] No open questions remain unresolved.
