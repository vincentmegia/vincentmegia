package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"regexp"
	"strings"
	"testing"
)

// settingsRoutePattern pulls every "/settings/..." route registered in
// newMux out of main.go's source. ServeMux can't enumerate its routes, so
// reading the registrations is how a route added later is covered by
// TestSettingsRoutesRequireAuth automatically, with no list to update.
var settingsRoutePattern = regexp.MustCompile(`mux\.HandleFunc\("([A-Z]+) (/settings/[^"]*)"`)

// TestSettingsRoutesRequireAuth: every /settings/* route — each
// /settings/content and /settings/resume write route (POST/PUT/DELETE/
// move) as well as the pages — answers an anonymous request with a 302 to
// /login before its handler does any work. The mux is built on lazyDB, so
// a handler that skipped requireOwnerAuth would try the database and
// render a "Couldn't ..." error page/fragment instead of redirecting.
func TestSettingsRoutesRequireAuth(t *testing.T) {
	mux := testMux(t, "") // chdirs to the repo root

	src, err := os.ReadFile("cmd/server/main.go")
	if err != nil {
		t.Fatal(err)
	}
	routes := settingsRoutePattern.FindAllStringSubmatch(string(src), -1)

	writes := 0
	for _, m := range routes {
		method, path := m[1], strings.ReplaceAll(m[2], "{id}", "1")
		if method != http.MethodGet {
			writes++
		}
		t.Run(method+" "+m[2], func(t *testing.T) {
			req := httptest.NewRequest(method, path, strings.NewReader("title=x&direction=up"))
			req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
			req.Header.Set("HX-Request", "true")
			rec := httptest.NewRecorder()
			mux.ServeHTTP(rec, req)

			if rec.Code != http.StatusFound {
				t.Fatalf("status = %d, want 302; body: %s", rec.Code, rec.Body.String())
			}
			if loc := rec.Header().Get("Location"); loc != "/login" {
				t.Errorf("Location = %q, want /login", loc)
			}
			if strings.Contains(rec.Body.String(), "Couldn") {
				t.Errorf("handler body ran before the auth check: %s", rec.Body.String())
			}
		})
	}

	// Guards the source scan itself: if main.go's registration style
	// changes and the regexp stops matching, this fails rather than
	// silently testing nothing. 9 content + 9 resume write routes today.
	if writes < 18 {
		t.Errorf("found only %d /settings write routes in main.go (want >= 18) — has the registration style changed?", writes)
	}
}
