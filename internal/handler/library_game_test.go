package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/vincentmegia/vincentmegia/internal/model"
	"github.com/vincentmegia/vincentmegia/internal/service"
)

// fakeLibraryRepository is an in-memory stand-in used to exercise
// LibraryGameHandler without a real Postgres connection — same idea as
// internal/service/library_service_test.go's fake, duplicated here since
// it implements an unexported interface local to the service package that
// this package can satisfy structurally but not name (see
// fakeCookingRepository's doc comment for the same reasoning).
type fakeLibraryRepository struct {
	scores    []model.LibraryScore
	insertErr error
	topErr    error
	daily     []model.LibraryScore
	dailyDays []time.Time
}

func (f *fakeLibraryRepository) Insert(ctx context.Context, playerName string, totalEarnings, shiftsCompleted int, dailyDate *time.Time) error {
	if f.insertErr != nil {
		return f.insertErr
	}
	row := model.LibraryScore{PlayerName: playerName, TotalEarnings: totalEarnings, ShiftsCompleted: shiftsCompleted}
	if dailyDate != nil {
		f.daily = append(f.daily, row)
		f.dailyDays = append(f.dailyDays, *dailyDate)
		return nil
	}
	f.scores = append(f.scores, row)
	return nil
}

func (f *fakeLibraryRepository) TopDailyScores(ctx context.Context, day time.Time, limit int) ([]model.LibraryScore, error) {
	if f.topErr != nil {
		return nil, f.topErr
	}
	var out []model.LibraryScore
	for i, row := range f.daily {
		if f.dailyDays[i].Equal(day) {
			out = append(out, row)
		}
	}
	return out, nil
}

func (f *fakeLibraryRepository) TopScores(ctx context.Context, limit int) ([]model.LibraryScore, error) {
	if f.topErr != nil {
		return nil, f.topErr
	}
	if len(f.scores) <= limit {
		return f.scores, nil
	}
	return f.scores[:limit], nil
}

func newTestLibraryHandler(t *testing.T, repo *fakeLibraryRepository) *LibraryGameHandler {
	t.Helper()
	tmpl, err := LoadTemplates("../../web/templates")
	if err != nil {
		t.Fatalf("LoadTemplates: %v", err)
	}
	return &LibraryGameHandler{
		Renderer: NewRenderer(tmpl),
		Service:  &service.LibraryService{Repo: repo},
		Version:  "dev",
		limiter:  newScoreSubmitLimiter(libraryScoreSubmitLimit, libraryScoreSubmitWindow),
	}
}

// TestLibraryGameHandler_Leaderboard_Empty verifies the "no scores yet" UI
// state renders when the leaderboard has no entries.
func TestLibraryGameHandler_Leaderboard_Empty(t *testing.T) {
	h := newTestLibraryHandler(t, &fakeLibraryRepository{})

	rec := httptest.NewRecorder()
	h.Leaderboard(rec, httptest.NewRequest(http.MethodGet, "/library-game/leaderboard", nil))

	out := rec.Body.String()
	if !strings.Contains(out, "No scores yet") {
		t.Errorf("empty leaderboard missing empty-state copy\n--- output ---\n%s", out)
	}
	if !strings.Contains(out, `id="library-leaderboard"`) {
		t.Errorf("leaderboard fragment missing its #library-leaderboard id\n--- output ---\n%s", out)
	}
}

// TestLibraryGameHandler_Leaderboard_Populated verifies populated entries
// render, and that a player_name containing HTML/script-like content is
// rendered as literal text (auto-escaping regression test) — never
// executed or unescaped.
func TestLibraryGameHandler_Leaderboard_Populated(t *testing.T) {
	repo := &fakeLibraryRepository{
		scores: []model.LibraryScore{
			{PlayerName: "Vince", TotalEarnings: 80000, ShiftsCompleted: 30, CreatedAt: time.Now()},
			{PlayerName: `<script>alert(1)</script>`, TotalEarnings: 60000, ShiftsCompleted: 30, CreatedAt: time.Now()},
		},
	}
	h := newTestLibraryHandler(t, repo)

	rec := httptest.NewRecorder()
	h.Leaderboard(rec, httptest.NewRequest(http.MethodGet, "/library-game/leaderboard", nil))

	out := rec.Body.String()
	for _, want := range []string{"Vince", "80000 Gard", "30 shifts", "&lt;script&gt;alert(1)&lt;/script&gt;"} {
		if !strings.Contains(out, want) {
			t.Errorf("leaderboard missing %q\n--- output ---\n%s", want, out)
		}
	}
	if strings.Contains(out, "<script>alert(1)</script>") {
		t.Errorf("leaderboard rendered a raw, unescaped <script> tag from player_name — XSS regression\n--- output ---\n%s", out)
	}
}

// TestLibraryGameHandler_SubmitScore_Valid verifies a valid submission
// inserts and re-renders the leaderboard fragment with the new entry
// included.
func TestLibraryGameHandler_SubmitScore_Valid(t *testing.T) {
	repo := &fakeLibraryRepository{}
	h := newTestLibraryHandler(t, repo)

	form := url.Values{"player_name": {"Vince"}, "total_earnings": {"80000"}, "shifts_completed": {"30"}}
	req := httptest.NewRequest(http.MethodPost, "/library-game/score", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.RemoteAddr = "203.0.113.10:12345"

	rec := httptest.NewRecorder()
	h.SubmitScore(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200, body: %s", rec.Code, rec.Body.String())
	}
	if len(repo.scores) != 1 {
		t.Fatalf("repo.scores len = %d, want 1", len(repo.scores))
	}
	if !strings.Contains(rec.Body.String(), "Vince") {
		t.Errorf("response missing the newly submitted entry\n--- output ---\n%s", rec.Body.String())
	}
}

// TestLibraryGameHandler_SubmitScore_ValidationRejected verifies an
// out-of-range submission never reaches the repository and gets a 400
// with a clear inline error, not a raw DB error.
func TestLibraryGameHandler_SubmitScore_ValidationRejected(t *testing.T) {
	repo := &fakeLibraryRepository{}
	h := newTestLibraryHandler(t, repo)

	form := url.Values{"player_name": {""}, "total_earnings": {"1000"}, "shifts_completed": {"5"}}
	req := httptest.NewRequest(http.MethodPost, "/library-game/score", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.RemoteAddr = "203.0.113.11:12345"

	rec := httptest.NewRecorder()
	h.SubmitScore(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400, body: %s", rec.Code, rec.Body.String())
	}
	if len(repo.scores) != 0 {
		t.Errorf("repo.scores len = %d, want 0 (validation should reject before the repository)", len(repo.scores))
	}
	if strings.Contains(rec.Body.String(), "sql") || strings.Contains(rec.Body.String(), "constraint") {
		t.Errorf("error body looks like a raw DB error, not a validation message: %s", rec.Body.String())
	}
}

// TestLibraryGameHandler_SubmitScore_OutOfRangeEarnings verifies the
// handler's own numeric bounds are enforced via the service (not just
// non-numeric input) — same coarse sanity bound as the DB CHECK constraint.
func TestLibraryGameHandler_SubmitScore_OutOfRangeEarnings(t *testing.T) {
	repo := &fakeLibraryRepository{}
	h := newTestLibraryHandler(t, repo)

	form := url.Values{"player_name": {"Vince"}, "total_earnings": {strconv.Itoa(200_000)}, "shifts_completed": {"30"}}
	req := httptest.NewRequest(http.MethodPost, "/library-game/score", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.RemoteAddr = "203.0.113.12:12345"

	rec := httptest.NewRecorder()
	h.SubmitScore(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400, body: %s", rec.Code, rec.Body.String())
	}
	if len(repo.scores) != 0 {
		t.Errorf("repo.scores len = %d, want 0", len(repo.scores))
	}
}

// TestLibraryGameHandler_SubmitScore_RateLimited verifies rapid repeated
// submissions from the same source are rejected once the per-IP limit is
// exhausted.
func TestLibraryGameHandler_SubmitScore_RateLimited(t *testing.T) {
	repo := &fakeLibraryRepository{}
	h := newTestLibraryHandler(t, repo)

	form := url.Values{"player_name": {"Vince"}, "total_earnings": {"1000"}, "shifts_completed": {"5"}}
	remoteAddr := "203.0.113.13:12345"

	var lastCode int
	for i := 0; i < libraryScoreSubmitLimit+1; i++ {
		req := httptest.NewRequest(http.MethodPost, "/library-game/score", strings.NewReader(form.Encode()))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		req.RemoteAddr = remoteAddr
		rec := httptest.NewRecorder()
		h.SubmitScore(rec, req)
		lastCode = rec.Code
	}

	if lastCode != http.StatusTooManyRequests {
		t.Errorf("status of the request beyond the limit = %d, want %d", lastCode, http.StatusTooManyRequests)
	}
	if len(repo.scores) != libraryScoreSubmitLimit {
		t.Errorf("repo.scores len = %d, want %d (the rate-limited request must not have reached the repository)", len(repo.scores), libraryScoreSubmitLimit)
	}

	// A different source is unaffected by another IP's limit.
	req := httptest.NewRequest(http.MethodPost, "/library-game/score", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.RemoteAddr = "198.51.100.20:54321"
	rec := httptest.NewRecorder()
	h.SubmitScore(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("a different source's request status = %d, want 200, body: %s", rec.Code, rec.Body.String())
	}
}

// TestLibraryGameHandler_Index verifies GET /library-game renders the
// real page content.
func TestLibraryGameHandler_Index(t *testing.T) {
	h := newTestLibraryHandler(t, &fakeLibraryRepository{})

	rec := httptest.NewRecorder()
	h.Index(rec, httptest.NewRequest(http.MethodGet, "/library-game", nil))

	out := rec.Body.String()
	if rec.Code != 0 && rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200, body: %s", rec.Code, out)
	}
	if !strings.Contains(out, "Library Shift") {
		t.Errorf("index missing title/content\n--- output ---\n%s", out)
	}
	assertMainContentContainer(t, out)
}

// TestLibraryGameHandler_DailyBoard verifies ?board=daily renders today's
// Daily Challenge board with the Daily tab pressed, and a daily submission
// answers with that board rather than the all-time one.
func TestLibraryGameHandler_DailyBoard(t *testing.T) {
	repo := &fakeLibraryRepository{
		scores: []model.LibraryScore{{PlayerName: "MonthRunner", TotalEarnings: 90000, ShiftsCompleted: 30, CreatedAt: time.Now()}},
	}
	h := newTestLibraryHandler(t, repo)
	today := h.Service.Today()

	form := url.Values{"player_name": {"DailyEunmi"}, "total_earnings": {"1200"}, "shifts_completed": {"1"}, "daily_date": {today}}
	req := httptest.NewRequest(http.MethodPost, "/library-game/score", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	rec := httptest.NewRecorder()
	h.SubmitScore(rec, req)
	out := rec.Body.String()
	if rec.Code != http.StatusOK {
		t.Fatalf("daily submit status = %d, body: %s", rec.Code, out)
	}
	for _, want := range []string{`data-board="daily"`, "DailyEunmi", "1200 Gard", today} {
		if !strings.Contains(out, want) {
			t.Errorf("daily submit response missing %q\n%s", want, out)
		}
	}
	if strings.Contains(out, "MonthRunner") {
		t.Errorf("daily board shows an all-time row\n%s", out)
	}

	rec = httptest.NewRecorder()
	h.Leaderboard(rec, httptest.NewRequest(http.MethodGet, "/library-game/leaderboard", nil))
	if all := rec.Body.String(); !strings.Contains(all, `data-board="all"`) || !strings.Contains(all, "MonthRunner") || strings.Contains(all, "DailyEunmi") {
		t.Errorf("all-time board should hold only the month run\n%s", all)
	}

	rec = httptest.NewRecorder()
	h.Leaderboard(rec, httptest.NewRequest(http.MethodGet, "/library-game/leaderboard?board=daily", nil))
	if daily := rec.Body.String(); !strings.Contains(daily, "DailyEunmi") {
		t.Errorf("?board=daily missing today's run\n%s", daily)
	}

	form.Set("shifts_completed", "3")
	req = httptest.NewRequest(http.MethodPost, "/library-game/score", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	rec = httptest.NewRecorder()
	h.SubmitScore(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("a 3-shift daily run status = %d, want 400", rec.Code)
	}
}
