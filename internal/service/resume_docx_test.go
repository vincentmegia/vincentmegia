package service

import (
	"archive/zip"
	"bytes"
	"strings"
	"testing"
	"time"

	"github.com/vincentmegia/vincentmegia/internal/model"
)

// TestBuildResumeDocx_ValidZipWithExpectedContent verifies buildResumeDocx
// produces a real, openable .docx (a zip archive with a word/document.xml
// part) reflecting the seeded content, and that XML-special characters in
// summary text ("&", "<") come out escaped rather than corrupting the
// document — docs/features/resume-export.md's Security Considerations:
// ".docx text-escaping must be verified, not assumed".
func TestBuildResumeDocx_ValidZipWithExpectedContent(t *testing.T) {
	profile := model.Profile{
		RoleTitle:     "Principal Software Engineer",
		TenureLabel:   "18+ years",
		LocationLabel: "Remote",
		SummaryParagraphs: []string{
			"Built systems at **PayPal** and R&D across AWS & <Kubernetes>",
		},
		Stats: []model.Stat{{Num: "1M+", Label: "Prepaid Subscribers Supported"}},
		FeaturedProjects: []model.FeaturedProject{{
			Name: "Puzzle Solver", Description: "ReactJS puzzle-solving application.",
			Links: []model.ProjectLink{{Label: "puzzle-solver.onrender.com", Href: "https://puzzle-solver.onrender.com"}},
		}},
		SkillGroups: []model.SkillGroup{
			{Name: "Languages", Skills: []string{"Go", "TypeScript"}},
		},
		Education: []model.Education{
			{Degree: "B.S. Computer Science", School: "Example University", StartYear: 2005, EndYear: 2009},
		},
	}
	roles := []model.Role{
		{
			Title:     "Staff Engineer",
			Company:   "Singtel",
			Location:  "Singapore",
			Bullets:   []string{"Led a team"},
			StartDate: time.Date(2021, 4, 1, 0, 0, 0, 0, time.UTC),
		},
	}

	out, err := buildResumeDocx(profile, roles)
	if err != nil {
		t.Fatalf("buildResumeDocx: %v", err)
	}

	zr, err := zip.NewReader(bytes.NewReader(out), int64(len(out)))
	if err != nil {
		t.Fatalf("generated docx is not a valid zip: %v", err)
	}

	var doc []byte
	for _, f := range zr.File {
		if f.Name != "word/document.xml" {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			t.Fatalf("open word/document.xml: %v", err)
		}
		var buf bytes.Buffer
		if _, err := buf.ReadFrom(rc); err != nil {
			t.Fatalf("read word/document.xml: %v", err)
		}
		rc.Close()
		doc = buf.Bytes()
	}
	if doc == nil {
		t.Fatal("generated docx missing word/document.xml")
	}
	xmlStr := string(doc)

	// Every card /resume shows: stats, "Company — Location", the
	// "Current" badge for an open-ended role, and Featured Projects.
	for _, want := range []string{
		"Vincent Megia", "PayPal", "Led a team", "Go, TypeScript",
		"1M+", "Prepaid Subscribers Supported",
		"Staff Engineer — Singtel — Singapore",
		">Current<",
		"Featured Projects", "Puzzle Solver", "ReactJS puzzle-solving application.",
		"<w:t>puzzle-solver.onrender.com</w:t>",
	} {
		if !strings.Contains(xmlStr, want) {
			t.Errorf("document.xml missing %q\n--- xml ---\n%s", want, xmlStr)
		}
	}
	// Section order, as docs/features/resume-export.md documents it: the
	// PDF's order except Core Expertise stays ahead of Experience (the
	// page's sidebar position). Headings are matched as whole w:t runs so
	// e.g. "Experience" can't match inside body text.
	order := []string{
		"<w:t>Summary</w:t>", "Prepaid Subscribers Supported",
		"<w:t>Core Expertise</w:t>", "Go, TypeScript",
		"<w:t>Experience</w:t>", "Led a team",
		"<w:t>Education</w:t>", "<w:t>Featured Projects</w:t>",
	}
	for i, want := range order {
		if strings.Count(xmlStr, want) != 1 {
			t.Fatalf("document.xml has %d of %q, want exactly 1", strings.Count(xmlStr, want), want)
		}
		if i > 0 && strings.Index(xmlStr, order[i-1]) > strings.Index(xmlStr, want) {
			t.Errorf("document.xml has %q after %q", order[i-1], want)
		}
	}
	if !strings.Contains(xmlStr, "AWS &amp; &lt;Kubernetes&gt;") {
		t.Errorf("document.xml did not XML-escape raw '&'/'<' in summary text\n--- xml ---\n%s", xmlStr)
	}
}

// TestBuildResumeDocx_IncludesContactLinks verifies the banner's
// contact_links (phone, email, personal site, ...) make it into the
// .docx as visible text — w:t, not go-docx AddLink's default w:instrText,
// which Word doesn't display — with each href recorded as a hyperlink
// relationship.
func TestBuildResumeDocx_IncludesContactLinks(t *testing.T) {
	profile := model.Profile{
		RoleTitle: "Principal Software Engineer",
		ContactLinks: []model.ContactLink{
			{Label: "vincent.megia@gmail.com", Href: "mailto:vincent.megia@gmail.com", Icon: "mail"},
			{Label: "vincentmegia.onrender.com", Href: "https://vincentmegia.onrender.com", Icon: "globe"},
			{Label: "+65 8233 8537", Href: "tel:+6582338537", Icon: "phone"},
		},
	}
	// Disallowed schemes still show their label, but never as a link.
	blocked := []model.ContactLink{
		{Label: "evil-js", Href: "javascript:alert(1)"},
		{Label: "evil-file", Href: "file:///etc/passwd"},
	}
	profile.ContactLinks = append(profile.ContactLinks, blocked...)

	out, err := buildResumeDocx(profile, nil)
	if err != nil {
		t.Fatalf("buildResumeDocx: %v", err)
	}
	zr, err := zip.NewReader(bytes.NewReader(out), int64(len(out)))
	if err != nil {
		t.Fatalf("generated docx is not a valid zip: %v", err)
	}
	parts := map[string]string{}
	for _, f := range zr.File {
		rc, err := f.Open()
		if err != nil {
			t.Fatalf("open %s: %v", f.Name, err)
		}
		var buf bytes.Buffer
		if _, err := buf.ReadFrom(rc); err != nil {
			t.Fatalf("read %s: %v", f.Name, err)
		}
		rc.Close()
		parts[f.Name] = buf.String()
	}

	doc, rels := parts["word/document.xml"], parts["word/_rels/document.xml.rels"]
	for _, c := range blocked {
		if !strings.Contains(doc, c.Label) {
			t.Errorf("document.xml missing plain-text label %q", c.Label)
		}
		if strings.Contains(rels, c.Href) {
			t.Errorf("document.xml.rels links disallowed href %q\n--- rels ---\n%s", c.Href, rels)
		}
	}
	for _, c := range profile.ContactLinks[:len(profile.ContactLinks)-len(blocked)] {
		if !strings.Contains(doc, "<w:t>"+c.Label+"</w:t>") {
			t.Errorf("document.xml missing visible text for %q\n--- xml ---\n%s", c.Label, doc)
		}
		if !strings.Contains(rels, c.Href) {
			t.Errorf("document.xml.rels missing hyperlink target %q\n--- rels ---\n%s", c.Href, rels)
		}
	}
	if strings.Contains(doc, "<w:instrText>") {
		t.Errorf("document.xml has a w:instrText run; contact labels would be invisible in Word\n--- xml ---\n%s", doc)
	}
}
