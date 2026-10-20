package service

import (
	"html/template"
	"testing"

	"github.com/vincentmegia/vincentmegia/internal/model"
)

// TestBuildResumeView_ContactHrefAllowlist verifies contact hrefs pass
// through linkableHref: allowlisted schemes (tel: included, which
// html/template alone would rewrite to "#ZgotmplZ") come out as
// template.URL, anything else as "" so the banner renders plain text.
func TestBuildResumeView_ContactHrefAllowlist(t *testing.T) {
	profile := model.Profile{ContactLinks: []model.ContactLink{
		{Label: "phone", Href: "tel:+6582338537"},
		{Label: "mail", Href: " mailto:a@b.c "},
		{Label: "site", Href: "https://example.com"},
		{Label: "js", Href: "javascript:alert(1)"},
		{Label: "file", Href: "file:///etc/passwd"},
		{Label: "none", Href: ""},
	}}
	want := []template.URL{"tel:+6582338537", "mailto:a@b.c", "https://example.com", "", "", ""}

	view := buildResumeView(profile, nil)
	if len(view.ContactLinks) != len(want) {
		t.Fatalf("got %d contact links, want %d", len(view.ContactLinks), len(want))
	}
	for i, c := range view.ContactLinks {
		if c.Href != want[i] {
			t.Errorf("contact %q Href = %q, want %q", c.Label, c.Href, want[i])
		}
	}
}
