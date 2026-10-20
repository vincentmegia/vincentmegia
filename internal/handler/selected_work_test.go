package handler

import (
	"bytes"
	"regexp"
	"strings"
	"testing"

	"github.com/vincentmegia/vincentmegia/internal/model"
)

// TestIsFullPageRoute: the set is derived from projectItems' FullPageLoad
// cards, ignoring any query string/fragment.
func TestIsFullPageRoute(t *testing.T) {
	cases := map[string]bool{
		"/bus-stops":           true,
		"/bus-stops?code=1234": true,
		"/easy-diagram":        true,
		"/easy-diagram#x":      true,
		"/fishing-game":        false,
		"/projects":            false,
		"":                     false,
	}
	for path, want := range cases {
		if got := isFullPageRoute(path); got != want {
			t.Errorf("isFullPageRoute(%q) = %v, want %v", path, got, want)
		}
	}
}

// TestSelectedWorkFullPageLinks: a Selected work card linking to a
// full-page route renders a plain <a href> (no hx-* swap), while an
// ordinary internal route keeps its HTMX nav link — see
// docs/features/landing-page.md's Business Rules.
func TestSelectedWorkFullPageLinks(t *testing.T) {
	tmpl, err := LoadTemplates("../../web/templates")
	if err != nil {
		t.Fatalf("LoadTemplates: %v", err)
	}
	data := PageData{SelectedWork: []model.SelectedWorkItem{
		{Kicker: "Tool", Title: "Easy Diagram", Description: "d", LiveURL: "/easy-diagram"},
		{Kicker: "Tool", Title: "Bus Stops", Description: "d", LiveURL: "/bus-stops"},
		{Kicker: "Game", Title: "Fishing", Description: "d", LiveURL: "/fishing-game"},
	}}
	var buf bytes.Buffer
	if err := tmpl.ExecuteTemplate(&buf, "selected-work", data); err != nil {
		t.Fatalf("execute selected-work: %v", err)
	}
	body := buf.String()

	for _, path := range []string{"/easy-diagram", "/bus-stops"} {
		link := regexp.MustCompile(`(?s)<a\s+href="` + regexp.QuoteMeta(path) + `"([^>]*)>`).FindStringSubmatch(body)
		if link == nil {
			t.Fatalf("no link to %s rendered", path)
		}
		if strings.Contains(link[1], "hx-") {
			t.Errorf("link to %s has hx-* attributes: %q", path, link[1])
		}
		if strings.Contains(body, `hx-get="`+path+`"`) {
			t.Errorf("hx-get=%q rendered for a full-page route", path)
		}
	}
	if !strings.Contains(body, `hx-get="/fishing-game"`) {
		t.Error(`/fishing-game card lost its hx-get HTMX nav link`)
	}
}
