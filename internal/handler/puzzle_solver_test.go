package handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// TestPagesHandler_PuzzleSolver verifies GET /puzzle-solver renders the
// visualizer's toolbar, canvas and module script — as a full page on a
// direct load, and as a bare #main-content fragment (no document shell)
// for an HTMX navigation. There's no server state behind it
// (docs/features/puzzle-solver.md's Data Model), so this is its only Go
// test.
func TestPagesHandler_PuzzleSolver(t *testing.T) {
	tmpl, err := LoadTemplates("../../web/templates")
	if err != nil {
		t.Fatalf("LoadTemplates: %v", err)
	}
	h := &PagesHandler{Renderer: NewRenderer(tmpl), Version: "dev"}
	wantContent := []string{
		`id="puzzle-tool-start"`, `id="puzzle-solve-button"`, `id="puzzle-status"`,
		`id="puzzle-canvas"`, `<script type="module" src="/static/js/puzzle-solver.js"></script>`,
	}

	for _, tc := range []struct {
		name     string
		htmx     bool
		wantFull bool
	}{
		{"full page", false, true},
		{"HTMX fragment", true, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/puzzle-solver", nil)
			if tc.htmx {
				req.Header.Set("HX-Request", "true")
			}
			rec := httptest.NewRecorder()
			h.PuzzleSolver(rec, req)

			out := rec.Body.String()
			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d, want 200", rec.Code)
			}
			for _, want := range wantContent {
				if !strings.Contains(out, want) {
					t.Errorf("missing %q\n--- output ---\n%s", want, out)
				}
			}
			if isFull := strings.Contains(strings.ToLower(out), "<!doctype html>"); isFull != tc.wantFull {
				t.Errorf("document shell present = %v, want %v", isFull, tc.wantFull)
			}
			if tc.wantFull && !strings.Contains(out, "<title>Puzzle Solver") {
				t.Errorf("full page missing its Puzzle Solver <title>\n--- output ---\n%s", out)
			}
			assertMainContentContainer(t, out)
		})
	}
}
