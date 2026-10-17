package handler

import (
	"net/http"
	"strings"
)

// EasyDiagramHandler serves GET /easy-diagram: a full-viewport,
// client-side diagram editor built on draw.io's vendored graph engine
// (mxGraph + grapheditor's Graph) with our own UI shell. See
// docs/features/easy-diagram.md and docs/features/easy-diagram/BUILD.md.
//
// Unlike every other page, it is NOT rendered through base.html: the editor
// owns the whole viewport, so there is no site header, footer, htmx or
// Tailwind output.css. It renders its own standalone document template
// ("easy-diagram-page") via Renderer.RenderFragment. Everything else
// (editing, files, export) happens in the browser; there is no server-side
// state.
type EasyDiagramHandler struct {
	Renderer *Renderer
}

// NewEasyDiagramHandler constructs an EasyDiagramHandler.
func NewEasyDiagramHandler(renderer *Renderer) *EasyDiagramHandler {
	return &EasyDiagramHandler{Renderer: renderer}
}

// EasyDiagramPageData is the standalone page's own view-model.
type EasyDiagramPageData struct {
	Title string
	// EngineScripts are the vendored engine's classic <script> srcs, in
	// load order. See easyDiagramEngineScripts.
	EngineScripts []string
	// FontPreloads are self-hosted woff2 files preloaded to avoid a font
	// flash on first paint (requested by WP3; the files are its own).
	FontPreloads []string
	// Stylesheets load in order after the engine scripts: the engine's
	// own keyframes/overlay styles (WP2), then the shell (WP3).
	Stylesheets  []string
	AppScriptURL string
}

// easyDiagramEngineScripts is the single source of truth for the vendored
// engine's classic-script load order. They must run, in this order, before
// the app.js module (which imports engine.js, which expects these globals:
// mxGraph, Graph, ...). The authoritative order is documented by WP2 at the
// top of web/static/easydiagram/js/engine.js; keep this slice in sync with
// it. Every entry must be same-origin (script-src 'self').
//
// config.js comes first: it sets mxBasePath/mxLoadResources/... as plain
// globals (an inline <script> would be blocked by the CSP) so mxClient
// fetches nothing at load time.
var easyDiagramEngineScripts = []string{
	"/static/easydiagram/vendor/config.js",
	"/static/easydiagram/vendor/deflate/base64.js",
	"/static/easydiagram/vendor/grapheditor/Init.js",
	"/static/easydiagram/vendor/sanitizer/purify.min.js",
	"/static/easydiagram/vendor/deflate/pako.min.js",
	"/static/easydiagram/vendor/mxgraph/mxClient.js",
	"/static/easydiagram/vendor/grapheditor/Editor.js",
	"/static/easydiagram/vendor/grapheditor/Graph.js",
	"/static/easydiagram/vendor/grapheditor/Shapes.js",
	"/static/easydiagram/vendor/grapheditor/stylesheet.js",
}

var easyDiagramFontPreloads = []string{
	"/static/easydiagram/fonts/ibm-plex-sans-latin-400-normal.woff2",
	"/static/easydiagram/fonts/ibm-plex-sans-latin-500-normal.woff2",
}

var easyDiagramStylesheets = []string{
	"/static/easydiagram/css/engine.css",
	"/static/easydiagram/css/easy-diagram.css",
}

const easyDiagramAppScript = "/static/easydiagram/js/app.js"

// easyDiagramCSP is the route-scoped Content-Security-Policy for
// /easy-diagram. It replaces the site-wide policy set by
// middleware.SecurityHeaders (which already ran, so Header().Set here wins),
// keeping that policy's default-src/base-uri/object-src/frame-ancestors and
// loosening only what the editor needs:
//
//   - script-src 'self': vendored engine + our modules only. No
//     'unsafe-inline' and no 'unsafe-eval': every eval path in mxClient is
//     behind an allowEval flag that defaults to false, and engine.js turns
//     off the one that defaults to true (mxStencilRegistry.allowEval, for
//     dynamically loaded stencil packages) along with dynamicLoading. The
//     vendored files have no new Function or string setTimeout.
//   - style-src 'self' 'unsafe-inline': mxGraph and the shell build some
//     markup with style="..." attributes (innerHTML/label HTML), which the
//     site-wide policy blocks.
//   - img-src data: blob:: mxGraph's inline SVG/data-URI images, and
//     client-side PNG/SVG export previews.
//   - worker-src 'self': nothing creates a Worker today; blob: was dropped
//     from the brief's draft policy as unused (strictest that works).
//   - form-action 'none': the editor has no forms.
//   - connect-src 'self': nothing ever leaves the origin; the editor is
//     local-only (BUILD.md decision 3).
var easyDiagramCSP = strings.Join([]string{
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
}, "; ")

// Index handles GET /easy-diagram. The page is a standalone document, so it
// can never be HTMX-swapped into another page's #main-content (its
// /projects card is FullPageLoad for the same reason, and its CSP only
// applies on a real document load). If an HTMX request does arrive, tell
// htmx to do a full navigation instead.
func (h *EasyDiagramHandler) Index(w http.ResponseWriter, r *http.Request) {
	if r.Header.Get("HX-Request") == "true" {
		w.Header().Set("HX-Redirect", r.URL.Path)
		w.WriteHeader(http.StatusOK)
		return
	}
	w.Header().Set("Content-Security-Policy", easyDiagramCSP)
	h.Renderer.RenderFragment(w, "easy-diagram-page", EasyDiagramPageData{
		Title:         "Easy Diagram",
		EngineScripts: easyDiagramEngineScripts,
		FontPreloads:  easyDiagramFontPreloads,
		Stylesheets:   easyDiagramStylesheets,
		AppScriptURL:  easyDiagramAppScript,
	})
}
