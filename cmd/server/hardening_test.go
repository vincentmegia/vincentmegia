package main

import (
	"bytes"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/vincentmegia/vincentmegia/internal/config"
)

// TestStaticFS_NoDirectoriesOrDotfiles covers newMux's /static/ file
// system: files serve, directory listings and dotfiles 404.
func TestStaticFS_NoDirectoriesOrDotfiles(t *testing.T) {
	dir := t.TempDir()
	for name, body := range map[string]string{
		"js/app.js":    "console.log(1)",
		".env":         "SECRET=x",
		"js/.DS_Store": "junk",
		".git/config":  "[core]",
	} {
		p := filepath.Join(dir, name)
		if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(p, []byte(body), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	h := http.StripPrefix("/static/", noCacheStatic(http.FileServer(staticFS{http.Dir(dir)})))

	tests := []struct {
		path string
		want int
	}{
		{"/static/js/app.js", http.StatusOK},
		{"/static/", http.StatusNotFound},
		{"/static/js/", http.StatusNotFound},
		{"/static/.env", http.StatusNotFound},
		{"/static/js/.DS_Store", http.StatusNotFound},
		{"/static/.git/config", http.StatusNotFound},
	}
	for _, tt := range tests {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, tt.path, nil))
		if rec.Code != tt.want {
			t.Errorf("GET %s = %d, want %d", tt.path, rec.Code, tt.want)
		}
	}
}

// TestStaticRoute_ServesFilesNotListings exercises the real mux and
// web/static tree.
func TestStaticRoute_ServesFilesNotListings(t *testing.T) {
	mux := testMux(t, "")

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/static/css/app.css", nil))
	if rec.Code != http.StatusOK {
		t.Errorf("GET /static/css/app.css = %d, want 200", rec.Code)
	}
	if got := rec.Header().Get("Cache-Control"); got != "no-cache" {
		t.Errorf("Cache-Control = %q, want no-cache", got)
	}

	for _, path := range []string{"/static/", "/static/css/", "/static/css"} {
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		if rec.Code != http.StatusNotFound {
			t.Errorf("GET %s = %d, want 404 (no directory listing)", path, rec.Code)
		}
	}
}

// TestHandlerChain_RejectsCrossSiteWrites checks the CSRF middleware is
// wired into the real chain, and that a bearer-token API caller (no
// browser fetch metadata) still reaches the API's own auth.
func TestHandlerChain_RejectsCrossSiteWrites(t *testing.T) {
	h := newHandlerChain(testMux(t, "chain-test-token-0123456789abcdef0123"), false)

	send := func(method, path string, hdr map[string]string) int {
		req := httptest.NewRequest(method, path, strings.NewReader("{}"))
		for k, v := range hdr {
			req.Header.Set(k, v)
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec.Code
	}

	if got := send(http.MethodPost, "/logout", map[string]string{"Sec-Fetch-Site": "cross-site"}); got != http.StatusForbidden {
		t.Errorf("cross-site POST /logout = %d, want 403", got)
	}
	if got := send(http.MethodPost, "/logout", map[string]string{"Sec-Fetch-Site": "same-origin"}); got != http.StatusFound {
		t.Errorf("same-origin POST /logout = %d, want 302", got)
	}
	if got := send(http.MethodPut, landingAPIPrefix+"/hero", map[string]string{"Authorization": "Bearer wrong"}); got != http.StatusUnauthorized {
		t.Errorf("API PUT with no fetch metadata = %d, want 401 from the API's own auth", got)
	}
}

func TestHandlerChain_CapsRequestBody(t *testing.T) {
	h := newHandlerChain(testMux(t, ""), false)
	req := httptest.NewRequest(http.MethodPost, "/logout", bytes.NewReader(make([]byte, maxRequestBodyBytes+1)))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Errorf("oversized POST = %d, want 413", rec.Code)
	}
}

func TestHandlerChain_DeadlineBelowWriteTimeout(t *testing.T) {
	if requestDeadline >= writeTimeout {
		t.Fatalf("requestDeadline %v must be below writeTimeout %v", requestDeadline, writeTimeout)
	}
	var hasDeadline bool
	h := newHandlerChain(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, hasDeadline = r.Context().Deadline()
	}), false)
	h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))
	if !hasDeadline {
		t.Error("handler context has no deadline")
	}
}

func TestWarnHospitalRunConfig(t *testing.T) {
	var buf bytes.Buffer
	prev := slog.Default()
	slog.SetDefault(slog.New(slog.NewTextHandler(&buf, nil)))
	t.Cleanup(func() { slog.SetDefault(prev) })

	warnHospitalRunConfig(config.Config{HospitalRunSecret: "s", HospitalRunTimeCheck: true})
	if buf.Len() != 0 {
		t.Errorf("production-safe config logged: %s", buf.String())
	}

	warnHospitalRunConfig(config.Config{HospitalRunSecret: "", HospitalRunTimeCheck: false})
	out := buf.String()
	if !strings.Contains(out, "level=WARN") || !strings.Contains(out, "HOSPITAL_RUN_SECRET") {
		t.Errorf("missing secret warning: %s", out)
	}
	if !strings.Contains(out, "level=ERROR") || !strings.Contains(out, "HOSPITAL_RUN_TIME_CHECK=off") {
		t.Errorf("missing time-check error: %s", out)
	}
}
