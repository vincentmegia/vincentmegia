package handler

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// aboutHandler builds a PagesHandler whose static directory is a temp dir
// holding exactly the named QR files under images/about/.
func aboutHandler(t *testing.T, qrFiles ...string) *PagesHandler {
	t.Helper()
	tmpl, err := LoadTemplates("../../web/templates")
	if err != nil {
		t.Fatalf("LoadTemplates: %v", err)
	}
	static := t.TempDir()
	dir := filepath.Join(static, "images", "about")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	for _, name := range qrFiles {
		if err := os.WriteFile(filepath.Join(dir, name), []byte("png"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	return &PagesHandler{Renderer: NewRenderer(tmpl), Version: "dev", StaticDir: static}
}

func getAbout(t *testing.T, h *PagesHandler, htmx bool) string {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/about", nil)
	if htmx {
		req.Header.Set("HX-Request", "true")
	}
	rec := httptest.NewRecorder()
	h.About(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	return rec.Body.String()
}

// TestPagesHandler_About verifies GET /about renders the real About content
// (docs/features/about.md), as a full page and as an HTMX fragment.
func TestPagesHandler_About(t *testing.T) {
	h := aboutHandler(t, "paynow-qr.png", "paypal-qr.png")
	for _, tc := range []struct {
		name     string
		htmx     bool
		wantFull bool
	}{
		{"full page", false, true},
		{"HTMX fragment", true, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			out := getAbout(t, h, tc.htmx)
			for _, want := range []string{
				"Principal Software Engineer", `id="about-hobby"`, `id="about-donate"`,
				`hx-get="/projects"`,
			} {
				if !strings.Contains(out, want) {
					t.Errorf("missing %q\n--- output ---\n%s", want, out)
				}
			}
			if strings.Contains(out, "About content coming soon.") {
				t.Error("still renders the placeholder message")
			}
			if isFull := strings.Contains(strings.ToLower(out), "<!doctype html>"); isFull != tc.wantFull {
				t.Errorf("document shell present = %v, want %v", isFull, tc.wantFull)
			}
			if tc.wantFull && !strings.Contains(out, "<title>About") {
				t.Errorf("full page missing its About <title>")
			}
			assertMainContentContainer(t, out)
		})
	}
}

// TestPagesHandler_About_DonateMethods verifies a method's QR card renders
// only when its image file exists, and the empty note when none do.
func TestPagesHandler_About_DonateMethods(t *testing.T) {
	const (
		paynow = `src="/static/images/about/paynow-qr.png"`
		paypal = `src="/static/images/about/paypal-qr.png"`
		empty  = `id="about-donate-empty"`
	)
	for _, tc := range []struct {
		name  string
		files []string
		want  []string
		not   []string
	}{
		{"both", []string{"paynow-qr.png", "paypal-qr.png"}, []string{paynow, paypal}, []string{empty}},
		{"paynow only", []string{"paynow-qr.png"}, []string{paynow}, []string{paypal, empty}},
		{"paypal only", []string{"paypal-qr.png"}, []string{paypal}, []string{paynow, empty}},
		{"none", nil, []string{empty}, []string{paynow, paypal}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			out := getAbout(t, aboutHandler(t, tc.files...), false)
			for _, want := range tc.want {
				if !strings.Contains(out, want) {
					t.Errorf("missing %q", want)
				}
			}
			for _, not := range tc.not {
				if strings.Contains(out, not) {
					t.Errorf("unexpected %q", not)
				}
			}
		})
	}
}
