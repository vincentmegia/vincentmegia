package handler

import (
	"bytes"
	"strings"
	"testing"

	"github.com/vincentmegia/vincentmegia/internal/service"
)

// TestResumeBannerContactLinks renders resume-banner with a tel: link —
// which html/template's own URL filter would turn into href="#ZgotmplZ"
// unless service.safeHref has vetted it into a template.URL — and a link
// whose href safeHref rejected (javascript:, so Href is ""), which must
// render its label as plain text with no <a>.
func TestResumeBannerContactLinks(t *testing.T) {
	tmpl, err := LoadTemplates("../../web/templates")
	if err != nil {
		t.Fatalf("LoadTemplates: %v", err)
	}
	view := service.ResumeView{
		RoleTitle: "Engineer",
		ContactLinks: []service.ContactLinkView{
			{Label: "+65 8233 8537", Href: "tel:+6582338537"},
			{Label: "blocked-link", Href: ""}, // safeHref("javascript:alert(1)")
		},
	}

	var buf bytes.Buffer
	if err := tmpl.ExecuteTemplate(&buf, "resume-banner", view); err != nil {
		t.Fatalf("execute resume-banner: %v", err)
	}
	out := buf.String()

	if !strings.Contains(out, `href="tel:&#43;6582338537"`) && !strings.Contains(out, `href="tel:+6582338537"`) {
		t.Errorf("tel: contact link not rendered as a live href\n--- output ---\n%s", out)
	}
	if strings.Contains(out, "ZgotmplZ") {
		t.Errorf("output contains html/template's #ZgotmplZ filter marker\n--- output ---\n%s", out)
	}
	if strings.Count(out, "<a") != 1 {
		t.Errorf("want exactly one <a> (the tel: link), got %d\n--- output ---\n%s", strings.Count(out, "<a"), out)
	}
	if !strings.Contains(out, "<span>blocked-link</span>") {
		t.Errorf("rejected link's label not rendered as plain text\n--- output ---\n%s", out)
	}
}
