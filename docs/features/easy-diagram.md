# Feature: Easy Diagram

## Status

`Proposed`

Nothing is implemented yet. This doc is a reverse-engineering survey of
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
  - open and save `.drawio`/`.xml` files through the File System Access API,
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
   - Firefox/Safari: each save downloads a .drawio file.
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
* Saved files stay standard `.drawio` (mxfile) XML, so they open in real
  draw.io and the reverse is also true. Don't change the format.
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
