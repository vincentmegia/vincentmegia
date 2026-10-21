# Feature: Easy Diagram

## Status

`Implemented` at `/easy-diagram`: our own editor UI shell
(`web/static/easydiagram/js/app.js`, `shell/*.js`) on draw.io's vendored
graph engine (mxGraph plus grapheditor's `Graph`, under
`web/static/easydiagram/vendor/`), wrapped by `engine.js`. The engine and IO
contract is `docs/features/easy-diagram/BUILD.md`.

Tests:

* Go: `internal/handler/easy_diagram_test.go` (page, exact CSP, no site
  chrome, script order, HTMX redirect, Projects card). Run with
  `go test ./internal/handler/`.
* Playwright: `e2e/easy-diagram.spec.js` (groups `platform`, `engine`, `io`,
  `ui`, `aws icons`, `connectors`, `phone width`, `evidence`), on Chromium
  and WebKit, plus the card test in `e2e/projects.spec.js`. Run with
  `make test-e2e`, or against your own server with
  `E2E_BASE_URL=http://localhost:<port> npx playwright test -c e2e/playwright.config.js e2e/easy-diagram.spec.js`.
  The `evidence` group writes screenshots and a network log to the untracked
  `Claude outputs/easy-diagram/evidence/`.
* Unit: `node --test web/static/easydiagram/js/aws-icons.test.js`.

The doc started as a survey of draw.io's repos and a plan to fork the whole
editor and host it separately. That plan was dropped on 2026-10-13 (BUILD.md
"Decisions"); the survey and plan are kept unchanged under
[History](#history).

## Summary

Easy Diagram is a local-first, browser-based diagram editor (flowcharts,
basic shapes, AWS architecture icons, animated shapes and connectors). It
saves standard draw.io `<mxfile>` XML under an `.ed` extension, exports
PNG/SVG/animated HTML/PDF in the browser, and makes no requests to any
origin other than this site.

## Problem / Motivation

The site had no diagramming tool. Linking to app.diagrams.net would send
diagram content to someone else's servers and show someone else's product.
Building our own UI on draw.io's Apache-2.0 graph engine gives a small,
self-hosted editor whose files still open in upstream draw.io.

## Scope

**In scope (built):**

* A full-viewport editor at `GET /easy-diagram`, served by this Go app, with
  its own route-scoped CSP. Reached from a `/projects` card by a full page
  load.
* Our own shell (BUILD.md "Shell UI"): top bar, shape dock, tool pill,
  inspector, status readout, zoom controls, command palette, toasts, dark and
  light themes, phone-width drawers.
* Shapes: 11 outline kinds (`KINDS` in `engine.js`) plus 24 AWS service
  icons (`aws-icons.js`). Connectors with presets, arrowheads, routes,
  connection points and a connect picker.
* Shape and connector animations stored as `edAnim*` style keys.
* Local files only: open/save `.ed` (and `.drawio`/`.xml`) through the File
  System Access API with upload/download fallback; IndexedDB drafts.
* Client-side export: PNG and SVG (optionally with the diagram embedded),
  animated HTML, `.ed`, and PDF through the browser print dialog.
* Multi-page documents.

**Out of scope:**

* draw.io's own `EditorUi`/`App` UI, its 68 shape libraries, templates,
  plugins, layouts, math, sketch style and languages. The dock's
  "Libraries" row is a disabled "coming soon" button (`shell/dock.js`).
* Importing other formats (`.vsdx`, Mermaid, Gliffy, Lucidchart, CSV and so
  on). Only draw.io XML and PNG/SVG with an embedded diagram open. See Open
  Questions.
* Cloud storage, an export server, realtime collaboration, accounts and
  server-side storage of diagrams.
* A minimap (optional in the brief, not built).
* The Electron desktop shell and its CLI exporter.

## User Flow

```text
1. User opens /easy-diagram (the /projects card does a full page load).
2. If IndexedDB holds a draft, a prompt offers Restore or Discard.
   Otherwise the empty-page state invites: click a shape on the left, drop a
   .ed or .drawio file, or open the command palette (⌘K / Ctrl+K).
3. User adds shapes (dock click or drag, tool keys R O D N, the tool pill)
   and connects them (Connectors group, A tool, connection points, C with
   two shapes selected). The inspector edits the selection.
4. Every change is written to an IndexedDB draft (debounced 600 ms); the
   status reads "draft".
5. Save (⌘S / Ctrl+S):
   - with the File System Access API (Chromium): the first save opens a save
     picker; later saves write to the same handle in place;
   - without it (e.g. WebKit): each save downloads <name>.ed.
   A successful save clears the draft.
6. Export popover: PNG, SVG, HTML, PDF or .ed. PDF calls window.print()
   with a print stylesheet.
7. Open (⌘O / Ctrl+O), or drop a file, to load a .ed/.drawio/.xml or an
   embedded PNG/SVG.
```

## UI

Built entirely in the browser by `app.js` into `#easy-diagram-app`; the Go
template `web/templates/pages/easy-diagram.html` is only a document shell
(no `base.html`, no htmx, no Tailwind `output.css`). Styles are
`css/engine.css` (keyframes, overlays) and `css/easy-diagram.css` (shell).
The look is the "Precision" prototype
(`docs/features/easy-diagram/prototype-precision.dc.html`). Fonts are
self-hosted IBM Plex Sans/Mono in `web/static/easydiagram/fonts/` (OFL).

* **Top bar** (`shell/topbar.js`): logo and name, file name, save status,
  page tabs with add page, Motion toggle, undo/redo, theme toggle,
  "Search & commands", and the Export popover (`shell/export.js`: PNG / SVG /
  HTML / PDF / .ed, Transparent background, Keep it editable, Scale 1×/2×/3×;
  options that don't apply to a format are disabled).
* **Dock** (`shell/dock.js`): the Connectors group first, then Shapes with
  search and chips All / Basic / Flowchart / AWS, then the disabled Libraries
  row.
* **Tool pill**: Select V, Hand H, Rectangle R, Ellipse O, Decision D,
  Connector A, Text T, Sticky note N (`TOOLS` in `shell/defs.js`).
* **Canvas** (`shell/stage.js`): connection points, a floating context bar
  over the selected shape (fill swatches, Duplicate, Delete; no swatches on
  AWS icons), empty-page state, drop target, draft prompt.
* **Inspector** (`shell/inspector.js`): per shape, connector, or nothing
  selected (page name, grid, snap, connection points mode, default
  connector, shortcuts).
* **Command palette** (`shell/palette.js`) and toasts (`shell/toasts.js`).
* **Phone width** (≤ 760px): dock and inspector become drawers. The
  `.ed` root is `overflow: clip` (not `hidden`), so focus or
  `scrollIntoView` can't scroll the off-canvas drawers into view and shift
  the editor sideways.

States:

| State   | Behavior |
| ------- | -------- |
| Default | Empty page with grid, or the draft prompt if a draft exists |
| Loading | Plain document load; no spinner (all scripts are local) |
| Empty   | `data-testid="empty-state"` hint on an empty page |
| Error   | Error toast for unreadable/unsupported/oversized files; canvas unchanged |
| Success | Status readout "saved"; toasts for save, open, export |

## Feature details

### The `.ed` file extension

Only the name differs from draw.io; the bytes are the same `<mxfile>` XML.
In `web/static/easydiagram/js/io.js` (`EXT`, `diagramName`):

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
* The new-document name is `Untitled.ed`, and drafts are keyed by file
  name.
* Unchanged: the MIME type (`application/xml`) and the content. The
  `edAnim*`/`edAws` style keys are ignored by upstream draw.io.

### AWS icons

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

  Each icon is a rounded tile in the AWS category colour (`AWS_CATEGORIES`)
  with a white line-art glyph. **These glyphs are original drawings, not
  AWS's official Architecture Icons:** no AWS artwork is copied or bundled,
  and the service names are used only to say what a shape stands for. If the
  official icon set is wanted later, it can replace the glyphs behind the
  same `awsIconSvg(id)` function, subject to AWS's terms for those icons.
* **Dock:** the **AWS** category chip lists one tile per service, showing
  the icon itself. Search matches the short name, the full name ("Amazon
  DynamoDB") and the category ("security" finds IAM, Cognito and KMS).
  Click to add, or drag onto the canvas to drop at the pointer, like the
  other tiles.
* **Engine:** shape kind `aws` (64×64, with the label underneath).
  `addShape('aws', {service})`, `update(id, {service})`, and the
  `ShapeModel` has a `service` field. A shape stores:
  - `edAws=<service id>`;
  - standard draw.io image keys (`shape=image`, `image=data:image/svg+xml,…`,
    `verticalLabelPosition=bottom`, `imageAspect=0`, `aspect=fixed`).
  The image is a **URL-encoded** SVG data URI, so there's no raw `;` or `=`
  to break the style string, and upstream draw.io shows the icon too. It's
  inline (`data:`), so it never makes a network request and passes the
  route CSP's `img-src 'self' data: blob:`. Unknown service ids fall back to
  Lambda (`DEFAULT_AWS_SERVICE`).
* **Changing the service:** this swaps `edAws` and the picture. The label
  follows the new service's name unless the user renamed the shape. An AWS
  shape can't change to an outline kind or back, and the Fill colour
  doesn't apply to it.
* **Canvas:** the floating context bar above a selected icon has no fill
  swatches (Duplicate and Delete only). Because the label sits under the
  icon, the bottom connection point is pushed below the label
  (`portScreen` in `engine.js`) so it doesn't cover the text.
* **Inspector:** for an AWS shape the header reads "AWS · Amazon RDS".
  A **Service** dropdown (grouped by category) replaces Fill, and Stroke
  is hidden. Label, Animation, Opacity, Shadow, Connections and
  Position & size work as for any shape.
* **Animation (optional, off by default):** AWS shapes use the same 7 shape
  animations (pulse, bounce, float, wiggle, glow, blink, pop), triggers
  (loop, on hover, once), speeds, Replay and the global Motion switch. The
  animation classes go on the cell's SVG group, which holds the icon's
  `<image>`, so the whole icon moves. Glow uses the service's category
  colour. Connectors between AWS icons animate as any connector does (Flow,
  March, Comet, Pulse, Draw; `EDGE_ANIMS` in `shell/defs.js`).
* **Export:** SVG/PNG export draws the icons, and an embedded PNG/SVG
  re-imports with the services intact.

### Connector arrowheads

* **Visibility:** the default connector colour is lighter in the dark
  theme (`#8A8F9B`) and darker in the light theme (`#6E737E`), in both
  `THEMES` and the `--edge` token. The head size follows the line width
  (`arrowSize(width)`: 9/10/12 for Thin/Regular/Bold). Older files that
  saved a 6px head are drawn at the new size (render-time only, for edges
  with `edColor`).
* **Inspector:** the connector panel has:
  - **Arrowheads**: End (default), Both, Start or None;
  - **Head**: Arrow (`block`), Open (`open`), Dot (`oval`) or Diamond;
  - **Route**: Elbow (default, `orthogonalEdgeStyle`), Straight
    (`edgeStyle=none`) or Curved (`orthogonalEdgeStyle` + `curved=1`).
  These are standard draw.io keys (`startArrow`/`endArrow`, `*Fill`,
  `*Size`, `edgeStyle`, `curved`), so upstream draw.io shows them as well.
* **Engine:** `EdgeModel` has `arrows`, `head` and `route`, which
  `update()` and `connect(a, b, {arrows, head, route})` accept. When a file
  has no `endArrow`, the connector reads as `arrows: 'end'`, because
  draw.io draws a classic arrow by default.
* **Canvas:** the context bar moves below the shape when a connector comes
  in from above (and none leaves from below), or when there's no room above
  (`shell/stage.js`), so it doesn't cover the arrowhead.

### Connectors: dock group, connection points and shape picker

The design the user approved on 2026-10-20 (Decisions below). The mockup is
in `Claude outputs/easy-diagram/connectors-poc/` (`poc.html`), and
screenshots of the built version are in
`Claude outputs/easy-diagram/connectors-build/` (both untracked).

**1. Connectors group in the dock** (`shell/dock.js`)

* A **Connectors** section at the **top** of the dock, above the shapes
  (which have their own "Shapes" heading). Search and the category chips
  filter shapes only, so the group is always visible.
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

**2. Connection points on shapes** (`engine.js`)

* Each shape has four connection points, one at the middle of each side:
  a small ring that grows and shows a `+` on hover or focus.
  - They show on the shape under the pointer (within 14px of it) and on
    the selected shape. They show on every shape while a connector is armed
    or being dragged.
  - On an AWS icon, the bottom point sits below the label (`portScreen`).
  - A **Connection points: On hover / Always / Off** setting in the
    "nothing selected" inspector controls this, and is remembered in
    `localStorage` (`easyDiagram.ports`).
  - The points are real buttons ("Connect from the right side of In
    stock?"). They live in their own overlay layer and are kept across
    redraws (moved, not rebuilt), so focus and hover survive panning and
    selection changes.
* **Drag a point** to draw a connector. A dashed accent preview follows the
  pointer. Over another shape it snaps:
  - within 28px (`PORT_SNAP`) of one of that shape's points, to that point;
  - anywhere else on the shape, to the side facing the source point.

  A ring marks the snap point. On release the connector stores exactly
  those sides (`exitX/exitY/entryX/entryY`), so it doesn't jump. `Esc`
  during a drag cancels it.
* **With the connector tool** (`A`, or an armed preset), you can start the
  drag anywhere on a shape. If neither end is near a point, the sides are
  chosen by `autoPorts`.
* **Click (or tap) a point** to open the connect picker.
* **Release on empty canvas** also opens the picker. The new shape is then
  centred where you let go, and it is entered from its side facing the
  source.
* **WebKit taps:** WebKit sends no `click` after a touch tap whose
  `pointerdown` was cancelled, so a press on a point that doesn't move is
  handled on `pointerup`, and the `click` that Chromium also sends is
  ignored. `click` alone still handles the keyboard.

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

**Engine API** (`engine.js`; also in BUILD.md)

```js
addConnected(sourceId, side, opts?)  // opts: {kind, props, preset, at:{x,y}}; no opts = a Rounded "Next step"
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
`A` tool uses the same code path: `setConnectable` is always false. The
dock's drag-onto-shape uses `shapeAt` plus the picker.

**Decisions (made by the user, 2026-10-20)**

1. **Connection points replace the earlier `+` quick-connect handles.** Two
   sets of handles on one shape would be noisy. Clicking a point does what
   `+` did, but with a choice of shape.
2. **Four points per shape**, one at the middle of each side, with no
   corner points. That matches `autoPorts` and the elbow routing.
3. **An armed preset goes back to Select after one connection**, like the
   `A` tool.
4. **The six presets above**: Arrow, Straight, Curved, Dashed, Two-way and
   Line. No Dotted or Open arrow preset; every head and line style is
   still in the connector inspector.

### Animated HTML export

PNG, SVG and PDF are static; the HTML export keeps the animations.

* **UI:** the Export popover's **HTML** format sits between SVG and PDF.
  Transparent background applies to it; Keep it editable and Scale don't.
  The note under the button says the page plays the animations. The
  download is `<file>-<page>.html` (`Untitled-Page-1.html`), and the toast
  counts the animations it kept (`Exported “…” with 4 animations`, or
  `(no animations on this page)`). It exports the current page, like PNG
  and SVG.
* **What's in the file:** one self-contained page with no scripts:
  - the page's SVG inline, from the same `getSvg` call as the SVG export
    (`engine.toAnimatedSvg`), with the animations written in by
    `animation.js`'s `animateExportSvg`: the same `ed-na-*`/`ed-e-*`
    classes, custom properties and connector overlay paths the editor puts
    on the live graph, built by the same helpers (`shapeAnimSpec`,
    `addShapeAnim`, `addEdgeAnim`), so the export can't drift from the
    editor;
  - the animation CSS, copied at export time from the loaded `engine.css`
    rules (`.ed-na*`, `.ed-ea`, `.ed-e-*`, `.ed-draw-base`, the `edN*`/
    `edE*` keyframes and the reduced-motion block), so the keyframes have
    one source;
  - the IBM Plex fonts the labels use, as `data:` URLs (fetched from
    `/static/easydiagram/fonts/`, about 165 KB base64 with all six; only
    the families the SVG names are included);
  - a CSP `<meta>` of `default-src 'none'; style-src 'unsafe-inline';
    img-src data:; font-src data:; form-action 'none'; base-uri 'none'`
    (`io.js`), so opening the file fetches nothing, label HTML can't run
    code, and a `<form>` smuggled into a label can't submit anywhere.
* **Triggers:** Loop and Once play on load. Hover plays while the pointer
  is over the shape, through a CSS `[data-cell-id]:hover` rule (the editor
  does it from JS). Speed and connector direction carry over.
  `prefers-reduced-motion: reduce` stops everything, as in the editor. The
  editor's Motion toggle doesn't affect the export.
* **Shape origin:** in the export a shape's drawing and label are wrapped
  in one animated `<g>` (child cells stay outside, as in the editor). Its
  `transform-origin` is the centre of what the shape draws, measured on an
  offscreen copy of the SVG. `transform-box: fill-box` wasn't enough: a
  label's `<foreignObject>` is 100% of the SVG, so the box was the whole
  diagram and shapes pulsed around the diagram's centre.
* **Connector overlays** go right after the line inside its group, under
  the arrowheads and label (the editor appends them at the end, which in
  the export put the flow dots over the label text).
* **Not included:** the diagram isn't embedded, so an HTML export doesn't
  reopen in the editor. Multi-page diagrams export the current page only.

## Routes / Handlers

| Method | Path            | Handler                     | Notes |
| ------ | --------------- | --------------------------- | ----- |
| GET    | `/easy-diagram` | `EasyDiagramHandler.Index` (`internal/handler/easy_diagram.go`, registered in `cmd/server/main.go`'s `newMux`) | Renders the standalone `easy-diagram-page` template via `Renderer.RenderFragment`, with the route CSP `easyDiagramCSP`. An HTMX request (`HX-Request: true`) gets `200` with `HX-Redirect: /easy-diagram` and no body, so htmx does a full navigation. |

Static files are served by the site's normal `/static/` file server. The
Projects card (`internal/handler/pages.go`) links to `/easy-diagram` with
`FullPageLoad`, like Bus Stop Finder, because the page is a standalone
document whose CSP only applies on a real load.

## Data Model

No server-side data. Diagrams live in the user's files and in browser
storage:

* **File format:** an `<mxfile>` with one `<diagram>` per page, each an
  `mxGraphModel`. `toXml()` writes it uncompressed; `load()` also accepts
  upstream's compressed pages (deflate + base64 + URI-encoding). Easy
  Diagram's extras are extra style keys upstream ignores: `edAnim`,
  `edAnimTrigger`, `edAnimSpeed`, `edAnimDir` (animations), `edColor`
  (palette colour name), `edAws` (AWS service).
* **Embedded exports:** PNG gets a `tEXt` `mxfile` chunk before `IDAT`
  (`embedXmlInPng`); import reads `tEXt` or `zTXt` (`extractXmlFromPng`).
  SVG stores the XML in the root's `content` attribute, like upstream.
* **Drafts:** IndexedDB, one record per file name (`saveDraft(xml, name)`,
  `loadDraft(name?)`, `clearDraft(name?)` in `io.js`), at most 20 kept
  (`MAX_DRAFTS`). Every call is wrapped in try/catch; the editor still works
  when IndexedDB throws.
* **localStorage** (per-viewer conveniences, wrapped in try/catch):
  `easyDiagram.theme`, `easyDiagram.connector`, `easyDiagram.ports`.

## Business Rules / Validation

* **No third-party requests, no exceptions.** Nothing the editor loads, and
  nothing a diagram file references, is fetched from another origin:
  - the route CSP has `connect-src 'self'`, `script-src 'self'`,
    `font-src 'self'` and `img-src 'self' data: blob:`;
  - for display, `engine.js` drops non-`data:`/`blob:` `image=` values and
    `fontSource` from cell styles, and a DOMPurify hook strips remote
    `src`/`href`/`background` attributes and CSS `url()`s from label HTML.
    The file keeps the original references, so upstream draw.io still shows
    them;
  - fonts are self-hosted; there is no Google Fonts option;
  - `config.js` sets the engine's globals so it loads no resource bundles,
    stylesheets or stencils, and `EXPORT_URL` is `null`.
* Saved files use the `.ed` extension, but their contents stay standard
  draw.io `<mxfile>` XML. An `.ed` file renamed to `.drawio` opens in real
  draw.io, and `.drawio`/`.xml` files open in Easy Diagram. Don't change the
  format, only the name.
* Opening enforces a 100 MB decompression budget per file, across pages
  (`newBudget` in `io.js`). Corrupt, embed-less and unsupported files show
  an error toast and leave the canvas unchanged.
* Opening or dropping a file while there are unsaved changes asks for
  confirmation; the changes stay as a draft.
* Every engine `update`/`add*`/`remove`/`duplicate` is one undo step.
* The vendored engine files are byte-identical to upstream except
  `stylesheet.js` (generated) and our own `config.js`; the upstream commit
  (`9034053`, draw.io 32.4.1) is recorded in
  `web/static/easydiagram/vendor/NOTICE`. `engine.js` changes upstream
  behaviour only at runtime (listed in NOTICE).

## Security Considerations

* **CSP** (`easyDiagramCSP`, asserted exactly by
  `TestEasyDiagramIndex_ExactCSP` and the `platform` spec):
  `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:; font-src 'self'; connect-src 'self';
  worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none';
  frame-ancestors 'none'`. No `unsafe-eval`: mxClient's eval paths are
  behind `allowEval` flags, and `engine.js` turns off
  `mxStencilRegistry.allowEval` and `dynamicLoading`. `'unsafe-inline'`
  styles are needed for markup mxGraph and the shell build with `style=`.
* **Untrusted files:** label HTML goes through upstream's DOMPurify
  sanitizer (vendored `sanitizer/purify.min.js`) plus our hook above. Print
  removes `<script>` and `foreignObject iframe` before adopting the SVG.
* **HTML export** carries its own `default-src 'none'` CSP with no scripts.
* **License:** draw.io core is Apache 2.0: `vendor/LICENSE` and
  `vendor/NOTICE` ship next to the files. Nothing is copied from
  `drawio-desktop` (GPL v3).
* **Trademark:** the UI never shows the "draw.io" name or logo.
  `Graph.prototype.addForeignObjectWarning` (a drawio.com link in SVG
  exports) is a no-op. The `.drawio` *file extension* appears in the open
  hint and error text, as a format name. NOTICE says Easy Diagram is not
  affiliated with draw.io AG or JGraph.
* **AWS icons** are original drawings, not AWS artwork.
* **Authz/secrets:** none. The page is public and client-only; no cloud
  client ids are vendored.

## Testing Plan

Spec references are `e2e/easy-diagram.spec.js:<line>` unless noted. Every
editor test also runs an `afterEach` check (line ~117) for CSP violations,
console errors, page errors and requests to any other origin.

* [x] Network: a full session (load, draw, save, export PNG/SVG, print,
      reopen) makes requests only to the test origin, all `GET`s of
      `/easy-diagram` or `/static/easydiagram/` (`full session network
      log…`, :2312). It does not assert response status < 400.
* [x] A hostile file with remote images, a remote font source and an
      `<img onerror>` label makes zero requests and runs nothing (:650);
      corrupt and hostile files show an error toast (:726); the 100 MB
      budget (:746).
* [x] Round-trips: two pages with `edAnim` keys through `toXml`/`load`
      (:386); Save downloads exactly `toXml()` (:784); an AWS diagram saves
      and reopens identical (:1838); upstream compressed `<diagram>`s load
      (:423, :674).
* [ ] The saved file opens in upstream draw.io. Not automated; covered
      indirectly by writing standard keys and an upstream-readable
      `image=` value (:1838).
* [x] Save in place with a file handle (:804) and keeping the handle from
      the open picker (:838), using a stubbed File System Access handle;
      the download fallback (:784); cancelling a picker (:824). Chromium and
      WebKit (`e2e/playwright.config.js`); Firefox isn't in the suite.
* [x] PNG with an embedded diagram re-imports to the same model (:850,
      AWS: :1897); PNG `tEXt`/`zTXt` and SVG `content` imports (:688,
      :700).
* [x] Exports: PNG/SVG embedding (:442); export names and PNG scale (:850);
      animated HTML (:887); popover options and PDF through `print()`
      (:1377).
* [x] Drafts: offered after a reload and restored (:947); Discard (:968);
      the editor boots when IndexedDB throws (:983).
* [x] Page, CSP and HTMX redirect: `platform` group (:300, :321) and
      `internal/handler/easy_diagram_test.go`.
* [x] The `/projects` card opens the editor with a full page load
      (`e2e/projects.spec.js:136`, :326, `TestProjects_EasyDiagramCard`).
* [ ] No "draw.io" branding is visible in the UI. Grep-verified on
      `web/static/easydiagram/js`, `css` and the page template (only the
      `.drawio` extension appears); there is no automated test.
* [x] UI: shape and connector inspectors (:1101, :1170), palette and Esc
      (:1290), pages (:1439), dock (:1500), aria-pressed and tooltips
      (:1571), text contrast ≥ 4.5:1 in both themes (:1613), phone width
      (:2195).
* [x] `.ed` extension (the `io` and `aws icons` groups):
  - Save downloads `Untitled.ed` and the file is `<mxfile>` XML (:784).
  - Export names are `.ed`, `.ed.png` and `.ed.svg` (:850).
  - `.ed` and legacy `.drawio` files both open, and a legacy file then
    saves as `.ed` (:1878).
  - The draft is keyed `Untitled.ed` (:947).
* [x] AWS icons (the `aws icons` group, :1719; unit tests in
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
* [x] Connectors (the `connectors` group, :1941):
  - the group's position, order and armed state;
  - drag with snapping, and the stored exit and entry sides;
  - back to Select after one connection, and `Esc` or a second click to
    disarm;
  - joining two selected shapes by a preset click and by `C`, and `C` with
    one shape;
  - point drag onto a shape and onto empty canvas, and `Esc` mid-drag;
  - every picker tab, keyboard navigation, the connector footer and closing
    it;
  - the hover, Always and Off point modes and the default connector, both
    remembered across a reload;
  - dropping a dock preset on a shape.

## Open Questions

* **Other import formats** (`.vsdx`, Mermaid, and so on): the vendored
  engine doesn't include draw.io's importers, so these can't open today.
  Worth adding?
* **PDF export:** is the print dialog good enough, or is a real PDF file
  wanted?
* **Server-side storage:** a "My diagrams" list in Postgres would wait on
  the real auth feature (see CLAUDE.md's auth stub note).
* **Upstream updates:** how often to re-vendor from `jgraph/drawio`
  (currently `9034053`, see `vendor/NOTICE`).
* **Deployed CSP:** confirm the production response for `/easy-diagram`
  carries `easyDiagramCSP` (tests check it locally).
* **Tests:** add a status < 400 assertion to the network-log test, and a
  branding check.

## Definition of Done

* [x] `GET /easy-diagram` serves the standalone editor with the exact route
      CSP and no site chrome; HTMX requests get `HX-Redirect`
      (`internal/handler/easy_diagram_test.go`, spec :300, :321).
* [x] Engine vendored from a recorded upstream commit with `LICENSE` and
      `NOTICE` (`web/static/easydiagram/vendor/`).
* [x] Our own shell matching the Precision prototype: dock, tool pill,
      inspector, palette, export popover, themes, phone drawers (`ui` and
      `phone width` groups).
* [x] Local open/save/export works in Chromium and WebKit, with the
      download/input fallbacks (`io` group).
* [x] No requests to any other origin during a full session, and no CSP
      violations (spec :2312 and the `afterEach` checks).
* [x] Saved files are standard `<mxfile>` XML with `edAnim*`/`edAws` keys,
      and round-trip (:386, :1838).
* [x] `/projects` card added, with e2e and Go tests
      (`e2e/projects.spec.js:136`, `TestProjects_EasyDiagramCard`).
* [x] CLAUDE.md's Project status lists Easy Diagram.
* [ ] The deployed CSP is confirmed in production (Open Questions).

---

## History

Everything below is kept as written at the time. It is not a description of
the current build.

### Change requests

The later features above came from these requests, quoted from the
original sections.

**`.ed` extension (2026-10-17):**

The user asked for `.ed` in place of `.drawio` ("for easy-diagram instead of
.drawio extension change it to .ed"). Only the name changed; the bytes are
the same `<mxfile>` XML, so this reverses BUILD.md decision 4's "files stay
real `.drawio`" for the name only.

**AWS icons (2026-10-17):**

The user asked to "add AWS icons that optionally be animated as well".

**Connector arrowheads:**

The user reported "somehow i dont see arrows connectors". Connectors did
have an arrowhead, but it was hard to see: a 6px head in `#5C616D` on the
near-black dark canvas. Also, the context bar above a selected shape and
the shape's side "+" handles sat right on top of incoming arrowheads.

**Connectors: dock group, connection points and shape picker (2026-10-20):**

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

**Fixes found while building it**

* **WebKit taps:** WebKit sends no `click` after a touch tap whose
  `pointerdown` was cancelled. So a press on a point that doesn't move is
  handled on `pointerup`, and the `click` that Chromium also sends is
  ignored. `click` alone still handles the keyboard.
* **Phone layout:** `.ed` is now `overflow: clip`, not just `hidden`. A
  hidden box can still be scrolled by focus or `scrollIntoView`. That
  shifted the whole editor about 20px sideways at phone width, because the
  closed drawers sit off-canvas to the right.

The older tests that used the `+` handles (the flowchart builder, the AWS
label position, phone width and the evidence shots) now use connection
points and the picker. The draft-restore test now waits for the draft of
the finished flowchart, not an earlier one. That race showed up once the
flowchart took a little longer to build.

**Animated HTML export (2026-10-20):**

The user asked for "an export feature that will convert the easy diagram
to an .html which will retain the animation". PNG, SVG and PDF are static,
so the animations were lost on every export until now.

### Earlier Status text (survey framing)

`Implemented` at `/easy-diagram`, with a new UI shell built on draw.io's
graph engine. The build decisions in `docs/features/easy-diagram/BUILD.md`
superseded this doc's original "fork the whole editor" plan. Five later
changes are described below: [The `.ed` file extension](#the-ed-file-extension),
[AWS icons](#aws-icons), [Connector arrowheads](#connector-arrowheads),
[Connectors: dock group, connection points and shape picker](#connectors-dock-group-connection-points-and-shape-picker)
and [Animated HTML export](#animated-html-export).

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

### Superseded plan: fork `jgraph/drawio` and host it separately

The pre-build survey and plan, dropped on 2026-10-13 in favour of our own shell on the vendored engine (BUILD.md "Decisions"). Kept verbatim; headings demoted.

#### Summary

Easy Diagram is a browser-based diagramming editor (flowcharts, UML, network,
ER, wireframes and so on). It is built from a fork of the draw.io editor and
hosted by us, with no cloud integrations and no traffic to draw.io's servers.

#### Problem / Motivation

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

#### Scope

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

#### Reverse-engineered architecture

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

##### Storage modes (core)

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

##### File format

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

---

#### Functionality inventory

##### A. Core editor features (already in the browser build, kept as-is)

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

##### B. Desktop-only layer (drawio-desktop) and its browser equivalent

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

##### C. Desktop CLI export (`src/main/args.js`)

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

##### D. Desktop security model (what to carry over)

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

#### User Flow

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

#### Implementation plan

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

#### UI

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

#### Routes / Handlers

Depends on the hosting decision (see Open Questions). Under the recommended
separate-static-host option, this site gets no new routes, only a `/projects`
card with an external link (`FullPageLoad`-style, not an HTMX nav).

---

#### Data Model

None for the initial version. Diagrams live in the user's files and in
browser storage.

---

#### Business Rules / Validation

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

#### Security Considerations

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

#### Testing Plan

* [ ] Open the editor with the network panel recording: no requests to
      `*.diagrams.net`, `*.draw.io`, Google, Microsoft or Dropbox on load,
      draw, save or export.
* [ ] New → template → edit → Save → reopen the file: round-trips identically,
      and the file also opens in upstream draw.io.
* [ ] Save in place works on Chromium. The download fallback works on
      Firefox and WebKit, matching this repo's Chromium and WebKit Playwright
      coverage.
* [ ] Export PNG (with embedded diagram) → re-import → editable.
* [ ] Export SVG, HTML and XML. PDF opens the print dialog. (HTML is the animated export; see [Animated HTML export](#animated-html-export).)
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

#### Open Questions

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

#### Definition of Done

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
