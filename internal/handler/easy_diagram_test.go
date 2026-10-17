package handler

import (
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
)

func newTestEasyDiagramHandler(t *testing.T) *EasyDiagramHandler {
	t.Helper()
	tmpl, err := LoadTemplates("../../web/templates")
	if err != nil {
		t.Fatalf("LoadTemplates: %v", err)
	}
	return NewEasyDiagramHandler(NewRenderer(tmpl))
}

func getEasyDiagram(t *testing.T, hdr http.Header) *httptest.ResponseRecorder {
	t.Helper()
	h := newTestEasyDiagramHandler(t)
	req := httptest.NewRequest(http.MethodGet, "/easy-diagram", nil)
	for k, v := range hdr {
		req.Header[k] = v
	}
	rec := httptest.NewRecorder()
	// As middleware.SecurityHeaders would have set it before the handler.
	rec.Header().Set("Content-Security-Policy", "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'")
	h.Index(rec, req)
	return rec
}

func TestEasyDiagramIndex_OK(t *testing.T) {
	rec := getEasyDiagram(t, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "text/html; charset=utf-8" {
		t.Errorf("Content-Type = %q", ct)
	}
	body := rec.Body.String()
	if !strings.HasPrefix(body, "<!doctype html>") {
		t.Errorf("body does not start with a doctype: %.60q", body)
	}
	for _, want := range []string{
		`<title>Easy Diagram</title>`,
		`<link rel="preload" href="/static/easydiagram/fonts/ibm-plex-sans-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>`,
		`<link rel="preload" href="/static/easydiagram/fonts/ibm-plex-sans-latin-500-normal.woff2" as="font" type="font/woff2" crossorigin>`,
		`<div id="easy-diagram-app"></div>`,
		`<noscript>`,
		`name="viewport"`,
	} {
		if !strings.Contains(body, want) {
			t.Errorf("body missing %q", want)
		}
	}
	if n := strings.Count(body, `id="easy-diagram-app"`); n != 1 {
		t.Errorf("mount point count = %d, want 1", n)
	}
}

func TestEasyDiagramIndex_ExactCSP(t *testing.T) {
	rec := getEasyDiagram(t, nil)
	const want = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
		"img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self'; " +
		"object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'"
	if got := rec.Header().Values("Content-Security-Policy"); len(got) != 1 || got[0] != want {
		t.Errorf("CSP = %q\nwant  %q", got, want)
	}
	if strings.Contains(want, "unsafe-eval") {
		t.Error("CSP must not allow unsafe-eval")
	}
}

func TestEasyDiagramIndex_NoSiteChrome(t *testing.T) {
	body := getEasyDiagram(t, nil).Body.String()
	for _, banned := range []string{
		`id="site-header"`, `id="primary-nav"`, `<header`, `<footer`, `id="main-content"`,
		"Skip to content", "/static/css/output.css", "/static/js/htmx.min.js",
		"/static/js/nav-menu.js", "/static/js/theme-toggle.js", "/static/js/carousel.js",
	} {
		if strings.Contains(body, banned) {
			t.Errorf("standalone page contains site chrome %q", banned)
		}
	}
	// The route CSP forbids inline scripts, so every <script> needs a src.
	if regexp.MustCompile(`<script(\s+type="module")?\s*>`).MatchString(body) {
		t.Error("page has an inline <script>, which the route CSP blocks")
	}
	// Same-origin only: nothing may point at another host.
	if regexp.MustCompile(`(src|href)="(https?:)?//`).MatchString(body) {
		t.Error("page references a third-party origin")
	}
}

func TestEasyDiagramIndex_ScriptOrder(t *testing.T) {
	body := getEasyDiagram(t, nil).Body.String()
	// WP2's documented order (top of web/static/easydiagram/js/engine.js).
	wantOrder := []string{
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
	if strings.Join(easyDiagramEngineScripts, ",") != strings.Join(wantOrder, ",") {
		t.Fatalf("easyDiagramEngineScripts = %v\nwant %v", easyDiagramEngineScripts, wantOrder)
	}

	// Every engine script is a classic script (no type="module"), in slice
	// order, followed by the stylesheet and then the app module.
	var srcs []string
	for _, m := range regexp.MustCompile(`<script([^>]*)></script>`).FindAllStringSubmatch(body, -1) {
		srcs = append(srcs, strings.TrimSpace(m[1]))
	}
	var want []string
	for _, s := range easyDiagramEngineScripts {
		want = append(want, `src="`+s+`"`)
	}
	want = append(want, `type="module" src="/static/easydiagram/js/app.js"`)
	if strings.Join(srcs, "\n") != strings.Join(want, "\n") {
		t.Errorf("script tags =\n%s\nwant\n%s", strings.Join(srcs, "\n"), strings.Join(want, "\n"))
	}

	lastEngine := strings.LastIndex(body, `src="`+easyDiagramEngineScripts[len(easyDiagramEngineScripts)-1]+`"`)
	engineCSS := strings.Index(body, `<link rel="stylesheet" href="/static/easydiagram/css/engine.css">`)
	css := strings.Index(body, `<link rel="stylesheet" href="/static/easydiagram/css/easy-diagram.css">`)
	if engineCSS < 0 || engineCSS > css {
		t.Errorf("engine.css (%d) must load before easy-diagram.css (%d)", engineCSS, css)
	}
	app := strings.Index(body, `src="/static/easydiagram/js/app.js"`)
	if lastEngine < 0 || css < 0 || app < 0 || !(lastEngine < css && css < app) {
		t.Errorf("want engine scripts < stylesheet < app.js, got positions %d, %d, %d", lastEngine, css, app)
	}
}

func TestEasyDiagramIndex_HTMXRequestForcesFullLoad(t *testing.T) {
	rec := getEasyDiagram(t, http.Header{"Hx-Request": {"true"}})
	if got := rec.Header().Get("HX-Redirect"); got != "/easy-diagram" {
		t.Errorf("HX-Redirect = %q, want /easy-diagram", got)
	}
	if rec.Body.Len() != 0 {
		t.Errorf("HTMX response should have no body, got %d bytes", rec.Body.Len())
	}
}

func TestProjects_EasyDiagramCard(t *testing.T) {
	var card *Project
	for i := range projectItems {
		if projectItems[i].Title == "Easy Diagram" {
			card = &projectItems[i]
		}
	}
	if card == nil {
		t.Fatal("no Easy Diagram entry in projectItems")
	}
	if card.LiveURL != "/easy-diagram" || !card.FullPageLoad || card.External {
		t.Errorf("card = %+v, want LiveURL /easy-diagram, FullPageLoad, not External", *card)
	}
	for _, tag := range card.Tags {
		if strings.Contains(strings.ToLower(tag), "draw.io") {
			t.Errorf("tag %q uses the draw.io trademark", tag)
		}
	}

	tmpl, err := LoadTemplates("../../web/templates")
	if err != nil {
		t.Fatalf("LoadTemplates: %v", err)
	}
	h := &PagesHandler{Renderer: NewRenderer(tmpl), Version: "dev"}
	rec := httptest.NewRecorder()
	h.Projects(rec, httptest.NewRequest(http.MethodGet, "/projects", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	body := rec.Body.String()
	i := strings.Index(body, ">Easy Diagram<")
	if i < 0 {
		t.Fatal("/projects does not render the Easy Diagram card")
	}
	// The card's link is a plain full-page "Open" link, with no hx-get.
	link := regexp.MustCompile(`(?s)<a\s+href="/easy-diagram"([^>]*)>\s*Open`).FindStringSubmatch(body[i:])
	if link == nil {
		t.Fatal(`Easy Diagram card has no plain <a href="/easy-diagram">Open link`)
	}
	if strings.Contains(link[1], "hx-") {
		t.Errorf("Easy Diagram link has hx-* attributes: %q", link[1])
	}
}
