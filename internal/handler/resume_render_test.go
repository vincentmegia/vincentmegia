package handler

import (
	"database/sql"
	"html/template"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"

	"github.com/vincentmegia/vincentmegia/internal/model"
	"github.com/vincentmegia/vincentmegia/internal/repository"
	"github.com/vincentmegia/vincentmegia/internal/service"
)

func loadTestRenderer(t *testing.T) *Renderer {
	t.Helper()
	tmpl, err := LoadTemplates("../../web/templates")
	if err != nil {
		t.Fatalf("LoadTemplates: %v", err)
	}
	return NewRenderer(tmpl)
}

func renderFragment(t *testing.T, ren *Renderer, name string, data any) string {
	t.Helper()
	rec := httptest.NewRecorder()
	ren.RenderFragment(rec, name, data)
	if rec.Code != http.StatusOK {
		t.Fatalf("render %s: status %d, body %q", name, rec.Code, rec.Body.String())
	}
	return rec.Body.String()
}

// TestResumeHandler_ErrorState verifies a DB failure on /resume renders
// the friendly error page with a 500 on a full page load, and with 200 on
// an HTMX nav (htmx 2 won't swap a 5xx body) — never the raw error.
func TestResumeHandler_ErrorState(t *testing.T) {
	// Lazily-opened, unreachable DB: every query fails (same technique as
	// newTestResumeExportHandler).
	conn, err := sql.Open("pgx", "postgres://unused:unused@127.0.0.1:1/unused")
	if err != nil {
		t.Fatalf("sql.Open: %v", err)
	}
	t.Cleanup(func() { conn.Close() })
	h := NewResumeHandler(loadTestRenderer(t), service.NewResumeService(repository.NewResumeRepository(conn, conn)), "test")

	for _, tc := range []struct {
		name   string
		htmx   bool
		status int
	}{
		{"full page", false, http.StatusInternalServerError},
		{"htmx nav", true, http.StatusOK},
	} {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/resume", nil)
			if tc.htmx {
				req.Header.Set("HX-Request", "true")
			}
			rec := httptest.NewRecorder()
			h.Index(rec, req)

			if rec.Code != tc.status {
				t.Errorf("status = %d, want %d", rec.Code, tc.status)
			}
			if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "text/html") {
				t.Errorf("Content-Type = %q, want text/html", ct)
			}
			body := rec.Body.String()
			if !strings.Contains(body, "Couldn&#39;t load this page") && !strings.Contains(body, "Couldn't load this page") {
				t.Errorf("friendly error message missing\n%s", body)
			}
			if !strings.Contains(body, `id="main-content"`) {
				t.Error("error page missing #main-content")
			}
			if strings.Contains(body, "127.0.0.1") || strings.Contains(body, "connection refused") {
				t.Error("response leaked the underlying error")
			}
		})
	}
}

// TestResumeSummary_OmittedWhenEmpty verifies the Summary card renders
// nothing with neither paragraphs nor stats (the PDF/Word exports skip it
// the same way), and still renders with only one of the two.
func TestResumeSummary_OmittedWhenEmpty(t *testing.T) {
	ren := loadTestRenderer(t)
	if out := renderFragment(t, ren, "resume-summary", service.ResumeView{SummaryFontClass: "resume-font-organic"}); strings.Contains(out, "<section") {
		t.Errorf("empty summary rendered a card shell\n%s", out)
	}
	for name, view := range map[string]service.ResumeView{
		"stats only":      {Stats: []model.Stat{{Num: "7", Label: "Systems"}}},
		"paragraphs only": {SummaryParagraphs: []template.HTML{"Hello"}},
	} {
		if out := renderFragment(t, ren, "resume-summary", view); !strings.Contains(out, `aria-label="Professional summary"`) {
			t.Errorf("%s: summary card missing\n%s", name, out)
		}
	}
}

// TestResumeCardFontClasses verifies each card's resolved font class lands
// on its own card element on /resume — Education, Featured Projects and
// Summary here (banner/expertise/role are covered in
// cmd/server/resume_admin_e2e_test.go via the service view).
func TestResumeCardFontClasses(t *testing.T) {
	ren := loadTestRenderer(t)
	view := &service.ResumeView{
		SummaryParagraphs:         []template.HTML{"Summary text"},
		Education:                 []model.Education{{Degree: "BS", School: "U", StartYear: 2000, EndYear: 2004}},
		FeaturedProjects:          []model.FeaturedProject{{Name: "P", Description: "D"}},
		SummaryFontClass:          "resume-font-modern-sans",
		SidebarEducationFontClass: "resume-font-classic-serif",
		SidebarFeaturedFontClass:  "resume-font-editorial",
		SidebarExpertiseFontClass: "resume-font-organic",
		BannerFontClass:           "resume-font-organic",
	}
	req := httptest.NewRequest(http.MethodGet, "/resume", nil)
	req.Header.Set("HX-Request", "true")
	rec := httptest.NewRecorder()
	ren.Render(rec, req, PageData{ContentTemplate: "resume-content", Resume: view})
	out := rec.Body.String()

	for card, re := range map[string]string{
		"summary":   `<section aria-label="Professional summary" class="resume-font-modern-sans `,
		"education": `<section class="resume-font-classic-serif [^"]*">\s*<h2[^>]*>Education</h2>`,
		"featured":  `<section class="resume-font-editorial [^"]*">\s*<h2[^>]*>Featured Projects</h2>`,
	} {
		if !regexp.MustCompile(re).MatchString(out) {
			t.Errorf("%s card missing its font class (want /%s/)\n%s", card, re, out)
		}
	}
}

// TestResumeAdmin_LoadFailedCardsHaveNoForm verifies every /settings/resume
// card rendered after a DB error shows the error with no form, field or
// submit control — so the owner can't press Save on a blank card and wipe
// the stored content — and keeps its id so the page layout is intact.
func TestResumeAdmin_LoadFailedCardsHaveNoForm(t *testing.T) {
	ren := loadTestRenderer(t)
	cards := map[string]struct {
		id   string
		view any
	}{
		"resume-admin-banner-form":    {"resume-admin-banner", service.BannerFormView{Error: resumeAdminSaveFailed, LoadFailed: true}},
		"resume-admin-expertise-form": {"resume-admin-expertise", service.ExpertiseFormView{Error: resumeAdminSaveFailed, LoadFailed: true}},
		"resume-admin-education-form": {"resume-admin-education", service.EducationFormView{Error: resumeAdminSaveFailed, LoadFailed: true}},
		"resume-admin-featured-form":  {"resume-admin-featured", service.FeaturedFormView{Error: resumeAdminSaveFailed, LoadFailed: true}},
		"resume-admin-summary-form":   {"resume-admin-summary", service.SummaryFormView{Error: resumeAdminSaveFailed, LoadFailed: true}},
	}
	outputs := map[string]string{}
	for name, c := range cards {
		outputs[name] = renderFragment(t, ren, name, c.view)
		if !strings.Contains(outputs[name], `id="`+c.id+`"`) {
			t.Errorf("%s: missing id %q", name, c.id)
		}
	}

	// The role editor goes through the handler's own error writer.
	rec := httptest.NewRecorder()
	(&ResumeAdminHandler{Renderer: ren}).writeRoleError(rec)
	outputs["writeRoleError"] = rec.Body.String()
	if !strings.Contains(outputs["writeRoleError"], `id="resume-admin-role-list"`) {
		t.Error("writeRoleError: missing #resume-admin-role-list")
	}

	for name, out := range outputs {
		if !strings.Contains(out, "Reload the page") {
			t.Errorf("%s: error message missing\n%s", name, out)
		}
		for _, banned := range []string{"<form", "<textarea", "<input", "<select", "<button", "hx-post", "hx-put", "hx-delete"} {
			if strings.Contains(out, banned) {
				t.Errorf("%s: load-failed card contains %q\n%s", name, banned, out)
			}
		}
	}
}

// TestResumeAdmin_SettingsPageRender renders the full /settings/resume
// editor (ResumeAdminHandler.Index's success view) and checks each card's
// form carries its stored content and selected font, each role has its
// own edit form, and a rejected create's Draft pre-fills the Add form.
func TestResumeAdmin_SettingsPageRender(t *testing.T) {
	ren := loadTestRenderer(t)
	opts := func(key string) []service.FontStyleOption {
		var o []service.FontStyleOption
		for _, k := range []string{"organic", "classic-serif", "modern-sans", "editorial"} {
			o = append(o, service.FontStyleOption{Key: k, Label: k, Selected: k == key})
		}
		return o
	}
	view := service.ResumeAdminView{
		Banner:    service.BannerFormView{RoleTitle: "Stored Role Title", FontOptions: opts("editorial")},
		Expertise: service.ExpertiseFormView{SkillGroups: []model.SkillGroup{{Name: "Langs", Skills: []string{"Go", "SQL"}}}, FontOptions: opts("organic")},
		Education: service.EducationFormView{FontOptions: opts("organic")},
		Featured:  service.FeaturedFormView{FontOptions: opts("organic")},
		Summary:   service.SummaryFormView{SummaryParagraphs: []string{"Stored paragraph"}, FontOptions: opts("organic")},
		Roles: service.RoleListView{
			Roles: []service.RoleAdminView{{ID: 7, Title: "Stored Role", Company: "Acme", StartDate: "2020-01-01", FontOptions: opts("modern-sans")}},
			Draft: service.RoleAdminView{Title: "Typed Title", StartDate: "bad-date", Bullets: []string{"typed bullet"}, FontOptions: opts("classic-serif")},
			Error: "start date is invalid",
		},
	}
	req := httptest.NewRequest(http.MethodGet, "/settings/resume", nil)
	req.Header.Set("HX-Request", "true")
	rec := httptest.NewRecorder()
	ren.Render(rec, req, PageData{ContentTemplate: "settings-resume", ResumeAdmin: view})
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	out := rec.Body.String()

	for _, want := range []string{
		`<form
	id="resume-admin-banner"`,
		`value="Stored Role Title"`,
		`id="resume-admin-expertise"`, "Langs: Go, SQL",
		`id="resume-admin-education"`, `id="resume-admin-featured"`,
		`id="resume-admin-summary"`, "Stored paragraph",
		`id="resume-admin-role-7"`, `hx-put="/settings/resume/roles/7"`, `value="Stored Role"`,
		`value="editorial" selected`, `value="modern-sans" selected`,
		"start date is invalid",
		`value="Typed Title"`, `value="bad-date"`, "typed bullet",
		`value="classic-serif" selected`,
	} {
		if !strings.Contains(out, want) {
			t.Errorf("settings page missing %q", want)
		}
	}
	if n := strings.Count(out, `name="font_style"`); n != 7 {
		t.Errorf("font selects = %d, want 7 (5 cards + 1 role + Add form)", n)
	}
}
