package handler

import (
	"log/slog"
	"net/http"

	"github.com/vincentmegia/vincentmegia/internal/service"
)

// ResumeHandler renders GET /resume. See docs/features/resume.md.
type ResumeHandler struct {
	Renderer *Renderer
	Service  *service.ResumeService
	// Version is injected the same way as PagesHandler.Version (see its
	// doc comment) — the footer version is shared shell state, not
	// resume-specific, but this handler doesn't go through PagesHandler.
	Version string
}

// NewResumeHandler constructs a ResumeHandler.
func NewResumeHandler(renderer *Renderer, resumeService *service.ResumeService, version string) *ResumeHandler {
	return &ResumeHandler{Renderer: renderer, Service: resumeService, Version: version}
}

// Index handles GET /resume.
func (h *ResumeHandler) Index(w http.ResponseWriter, r *http.Request) {
	view, err := h.Service.Get(r.Context())
	if err != nil {
		// Never expose the raw error to the client, per
		// docs/skills/go-backend/SKILL.md "Errors" and
		// docs/features/resume.md's Error state — a DB fetch or JSONB
		// decode failure renders the shell's generic content-error state,
		// not a stack trace or raw error string.
		//
		// A full page load gets a 500 so monitors, crawlers and caches see
		// the failure (DB errors are 500 elsewhere too — bus_stops.go);
		// the friendly page still renders as the body. An HTMX nav keeps
		// 200: htmx 2's default responseHandling drops 5xx bodies, so a
		// 500 there would leave the old page on screen with no message.
		slog.Error("get resume view", "error", err)
		data := shellPageData(r, h.Version, "Resume", false)
		data.ContentTitle = "Resume"
		data.ContentMessage = "Couldn't load this page. Please try again shortly."
		if r.Header.Get("HX-Request") != "true" {
			w = &statusOnWrite{ResponseWriter: w, status: http.StatusInternalServerError}
		}
		h.Renderer.Render(w, r, data)
		return
	}

	data := shellPageData(r, h.Version, "Resume", false)
	data.ContentTemplate = "resume-content"
	data.Resume = &view
	h.Renderer.Render(w, r, data)
}

// statusOnWrite sends status in place of the implicit 200 on the first
// Write, so a page can be rendered through Renderer.Render (which sets
// its own Content-Type and only ever writes, never WriteHeaders, on
// success) with a non-200 status. An explicit WriteHeader — Renderer's
// own template-failure 500 — passes straight through.
type statusOnWrite struct {
	http.ResponseWriter
	status      int
	wroteHeader bool
}

func (w *statusOnWrite) WriteHeader(code int) {
	w.wroteHeader = true
	w.ResponseWriter.WriteHeader(code)
}

func (w *statusOnWrite) Write(b []byte) (int, error) {
	if !w.wroteHeader {
		w.WriteHeader(w.status)
	}
	return w.ResponseWriter.Write(b)
}
