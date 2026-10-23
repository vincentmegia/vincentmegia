package handler

import (
	"bytes"
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"html/template"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/vincentmegia/vincentmegia/internal/model"
	"github.com/vincentmegia/vincentmegia/internal/repository"
	"github.com/vincentmegia/vincentmegia/internal/service"
)

// TestHeaderSettingsMenuGatedOnAuth: the Settings menu's markup is absent
// from the rendered header (not CSS-hidden) for an anonymous visitor and
// present for an authenticated one — docs/features/home.md's Security
// Considerations. The anonymous case goes through shellPageData, so it
// also covers the real IsAuthenticated stub.
func TestHeaderSettingsMenuGatedOnAuth(t *testing.T) {
	tmpl, err := LoadTemplates("../../web/templates")
	if err != nil {
		t.Fatalf("LoadTemplates: %v", err)
	}
	render := func(data PageData) string {
		var buf bytes.Buffer
		if err := tmpl.ExecuteTemplate(&buf, "header", data); err != nil {
			t.Fatalf("execute header: %v", err)
		}
		return buf.String()
	}
	markers := []string{`id="settings-menu`, `href="/settings/content"`, `href="/settings/resume"`, `aria-label="Account"`}

	anon := shellPageData(httptest.NewRequest(http.MethodGet, "/", nil), "dev", "Home", false)
	if anon.IsAuthenticated {
		t.Fatal("shellPageData reported an authenticated request; the auth stub changed — update this test")
	}
	out := render(anon)
	for _, m := range markers {
		if strings.Contains(out, m) {
			t.Errorf("anonymous header contains %q", m)
		}
	}

	authed := anon
	authed.IsAuthenticated = true
	out = render(authed)
	for _, m := range markers {
		if !strings.Contains(out, m) {
			t.Errorf("authenticated header missing %q", m)
		}
	}
}

// TestCarouselOmittedWithNoSlides: with zero slides "/" renders no
// carousel section at all, rather than an empty bordered card.
func TestCarouselOmittedWithNoSlides(t *testing.T) {
	tmpl, err := LoadTemplates("../../web/templates")
	if err != nil {
		t.Fatalf("LoadTemplates: %v", err)
	}
	var buf bytes.Buffer
	if err := tmpl.ExecuteTemplate(&buf, "landing-content", PageData{}); err != nil {
		t.Fatalf("execute landing-content: %v", err)
	}
	if strings.Contains(buf.String(), `id="carousel"`) {
		t.Errorf("empty carousel rendered:\n%s", buf.String())
	}

	buf.Reset()
	data := PageData{CarouselSlides: []model.CarouselSlide{{ID: 1, ImagePath: "/static/images/carousel/1.svg", Alt: "one"}}}
	if err := tmpl.ExecuteTemplate(&buf, "landing-content", data); err != nil {
		t.Fatalf("execute landing-content: %v", err)
	}
	if !strings.Contains(buf.String(), `id="carousel"`) {
		t.Error("one-slide carousel not rendered")
	}
}

func TestVersionLabel(t *testing.T) {
	for in, want := range map[string]string{"": "dev", "dev": "dev", "1.2.0": "v1.2.0", "v1.2.0": "v1.2.0", "8b8f0ec-dirty": "v8b8f0ec-dirty"} {
		if got := versionLabel(in); got != want {
			t.Errorf("versionLabel(%q) = %q, want %q", in, got, want)
		}
	}
}

// TestEditorWriteErrorKeepsRows: after a failed write the carousel/work
// editors re-render the current rows under the error, not an empty list
// (the list used to vanish). Writes go to a DB that always fails; reads
// come from a fake that returns two rows.
func TestEditorWriteErrorKeepsRows(t *testing.T) {
	h := newFakeLandingHandler(t, sql.OpenDB(fakeConnector{rows: true}))

	rec := httptest.NewRecorder()
	h.writeCarouselError(rec, httptest.NewRequest(http.MethodPost, "/settings/content/carousel", nil))
	out := rec.Body.String()
	for _, want := range []string{escapedSaveFailed, `id="carousel-slide-1"`, `id="carousel-slide-2"`, "2 of 5 slides", `hx-post="/settings/content/carousel"`} {
		if !strings.Contains(out, want) {
			t.Errorf("carousel error fragment missing %q\n%s", want, out)
		}
	}

	rec = httptest.NewRecorder()
	h.writeWorkError(rec, httptest.NewRequest(http.MethodPost, "/settings/content/selected-work", nil))
	out = rec.Body.String()
	for _, want := range []string{escapedSaveFailed, `id="work-item-1"`, `id="work-item-2"`} {
		if !strings.Contains(out, want) {
			t.Errorf("work error fragment missing %q\n%s", want, out)
		}
	}
}

// TestEditorWriteErrorRefetchFails: when the re-read fails too, the
// editors show the error alone — no add form, no "0 of 5" count — so a
// DB outage never looks like an empty carousel.
func TestEditorWriteErrorRefetchFails(t *testing.T) {
	h := newFakeLandingHandler(t, sql.OpenDB(fakeConnector{}))

	rec := httptest.NewRecorder()
	h.writeCarouselError(rec, httptest.NewRequest(http.MethodPost, "/settings/content/carousel", nil))
	out := rec.Body.String()
	if !strings.Contains(out, escapedSaveFailed) || !strings.Contains(out, `id="carousel-editor"`) {
		t.Errorf("carousel fragment missing the error/its root\n%s", out)
	}
	for _, unwanted := range []string{`hx-post="/settings/content/carousel"`, "0 of 5 slides"} {
		if strings.Contains(out, unwanted) {
			t.Errorf("carousel fragment rendered %q after a failed re-read\n%s", unwanted, out)
		}
	}

	rec = httptest.NewRecorder()
	h.writeWorkError(rec, httptest.NewRequest(http.MethodPost, "/settings/content/selected-work", nil))
	out = rec.Body.String()
	if !strings.Contains(out, escapedSaveFailed) || strings.Contains(out, `hx-post="/settings/content/selected-work"`) {
		t.Errorf("work fragment should show the error without the add form\n%s", out)
	}
}

// escapedSaveFailed is saveFailedMessage as html/template writes it.
var escapedSaveFailed = template.HTMLEscapeString(saveFailedMessage)

func newFakeLandingHandler(t *testing.T, readDB *sql.DB) *LandingContentHandler {
	t.Helper()
	tmpl, err := LoadTemplates("../../web/templates")
	if err != nil {
		t.Fatalf("LoadTemplates: %v", err)
	}
	writeDB := sql.OpenDB(fakeConnector{})
	t.Cleanup(func() { writeDB.Close(); readDB.Close() })
	svc := service.NewLandingContentService(repository.NewLandingContentRepository(writeDB, readDB))
	return NewLandingContentHandler(NewRenderer(tmpl), svc, "dev")
}

// fakeConnector is a minimal database/sql driver: every statement fails,
// except that with rows set a query returns two fixed rows shaped like
// landing_carousel_slides / landing_selected_work_items.
type fakeConnector struct{ rows bool }

var errFakeDB = errors.New("fake db: unavailable")

func (c fakeConnector) Connect(context.Context) (driver.Conn, error) { return fakeConn(c), nil }
func (c fakeConnector) Driver() driver.Driver                        { return fakeDriver{} }

type fakeDriver struct{}

func (fakeDriver) Open(string) (driver.Conn, error) { return nil, errFakeDB }

type fakeConn struct{ rows bool }

func (fakeConn) Prepare(string) (driver.Stmt, error) { return nil, errFakeDB }
func (fakeConn) Close() error                        { return nil }
func (fakeConn) Begin() (driver.Tx, error)           { return nil, errFakeDB }
func (fakeConn) ExecContext(context.Context, string, []driver.NamedValue) (driver.Result, error) {
	return nil, errFakeDB
}
func (c fakeConn) QueryContext(_ context.Context, query string, _ []driver.NamedValue) (driver.Rows, error) {
	if !c.rows {
		return nil, errFakeDB
	}
	text := []string{"/static/images/carousel/1.svg", "Alt", "", "/x"} // slide: image_path, alt, caption, link_url
	if strings.Contains(query, "landing_selected_work_items") {
		text = []string{"Kicker", "Title", "Desc", "/x"} // work: kicker, title, description, live_url
	}
	return &fakeRows{text: text, n: 2}, nil
}

type fakeRows struct {
	text []string
	n, i int
}

func (*fakeRows) Columns() []string {
	return []string{"id", "a", "b", "c", "d", "external", "sort_order"}
}
func (*fakeRows) Close() error { return nil }
func (r *fakeRows) Next(dest []driver.Value) error {
	if r.i >= r.n {
		return io.EOF
	}
	r.i++
	dest[0] = int64(r.i)
	for j, s := range r.text {
		dest[1+j] = s
	}
	dest[5] = false
	dest[6] = int64(r.i)
	return nil
}
