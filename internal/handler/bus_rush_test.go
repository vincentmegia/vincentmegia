package handler

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/vincentmegia/vincentmegia/internal/model"
	"github.com/vincentmegia/vincentmegia/internal/service"
)

// fakeBusRushRepository mirrors internal/service's fake (the interface it
// satisfies is unexported there, so it's duplicated here structurally).
type fakeBusRushRepository struct {
	scores    []model.BusRushScore
	days      []*time.Time // daily_date per score, parallel to scores
	insertErr error
	topErr    error
}

func (f *fakeBusRushRepository) Insert(ctx context.Context, playerName string, score, distanceMeters int, dailyDate *time.Time) error {
	if f.insertErr != nil {
		return f.insertErr
	}
	f.scores = append(f.scores, model.BusRushScore{PlayerName: playerName, Score: score, DistanceMeters: distanceMeters})
	f.days = append(f.days, dailyDate)
	return nil
}

func (f *fakeBusRushRepository) TopScores(ctx context.Context, limit int) ([]model.BusRushScore, error) {
	if f.topErr != nil {
		return nil, f.topErr
	}
	if len(f.scores) <= limit {
		return f.scores, nil
	}
	return f.scores[:limit], nil
}

func (f *fakeBusRushRepository) TopDailyScores(ctx context.Context, day time.Time, limit int) ([]model.BusRushScore, error) {
	if f.topErr != nil {
		return nil, f.topErr
	}
	var out []model.BusRushScore
	for i, s := range f.scores {
		if d := f.days[i]; d != nil && d.Equal(day) && len(out) < limit {
			out = append(out, s)
		}
	}
	return out, nil
}

func newTestBusRushHandler(t *testing.T, repo *fakeBusRushRepository) *BusRushHandler {
	t.Helper()
	tmpl, err := LoadTemplates("../../web/templates")
	if err != nil {
		t.Fatalf("LoadTemplates: %v", err)
	}
	return &BusRushHandler{
		Renderer: NewRenderer(tmpl),
		Service:  &service.BusRushService{Repo: repo, Now: func() time.Time { return busRushTestNow }},
		Version:  "dev",
		limiter:  newScoreSubmitLimiter(busRushScoreSubmitLimit, busRushScoreSubmitWindow),
	}
}

// busRushTestNow pins the Daily Challenge's clock: today is 2026-10-13 (UTC).
var busRushTestNow = time.Date(2026, 10, 13, 9, 0, 0, 0, time.UTC)

func postBusRushScore(h *BusRushHandler, form url.Values, remoteAddr string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/bus-rush/score", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.RemoteAddr = remoteAddr
	rec := httptest.NewRecorder()
	h.SubmitScore(rec, req)
	return rec
}

func TestBusRushHandler_Index(t *testing.T) {
	h := newTestBusRushHandler(t, &fakeBusRushRepository{})

	rec := httptest.NewRecorder()
	h.Index(rec, httptest.NewRequest(http.MethodGet, "/bus-rush", nil))

	out := rec.Body.String()
	for _, want := range []string{"Bus Rush", `id="bus-rush-canvas"`, `id="bus-rush-shop-screen"`, `data-upgrade-key="engine"`, "/static/js/bus-rush.js"} {
		if !strings.Contains(out, want) {
			t.Errorf("index missing %q", want)
		}
	}
	assertMainContentContainer(t, out)
}

func TestBusRushHandler_Leaderboard_Empty(t *testing.T) {
	h := newTestBusRushHandler(t, &fakeBusRushRepository{})

	rec := httptest.NewRecorder()
	h.Leaderboard(rec, httptest.NewRequest(http.MethodGet, "/bus-rush/leaderboard", nil))

	out := rec.Body.String()
	if !strings.Contains(out, "No scores yet") || !strings.Contains(out, `id="bus-rush-leaderboard"`) {
		t.Errorf("empty leaderboard wrong\n--- output ---\n%s", out)
	}
}

func TestBusRushHandler_Leaderboard_PopulatedAndEscaped(t *testing.T) {
	h := newTestBusRushHandler(t, &fakeBusRushRepository{scores: []model.BusRushScore{
		{PlayerName: "Vince", Score: 1500, DistanceMeters: 1200, CreatedAt: time.Now()},
		{PlayerName: `<script>alert(1)</script>`, Score: 900, DistanceMeters: 800, CreatedAt: time.Now()},
	}})

	rec := httptest.NewRecorder()
	h.Leaderboard(rec, httptest.NewRequest(http.MethodGet, "/bus-rush/leaderboard", nil))

	out := rec.Body.String()
	for _, want := range []string{"Vince", "1500 pts", "1200 m", "&lt;script&gt;alert(1)&lt;/script&gt;"} {
		if !strings.Contains(out, want) {
			t.Errorf("leaderboard missing %q\n--- output ---\n%s", want, out)
		}
	}
	if strings.Contains(out, "<script>alert(1)</script>") {
		t.Errorf("player_name rendered unescaped — XSS regression")
	}
}

func TestBusRushHandler_Leaderboard_Error(t *testing.T) {
	h := newTestBusRushHandler(t, &fakeBusRushRepository{topErr: errors.New("db down")})

	rec := httptest.NewRecorder()
	h.Leaderboard(rec, httptest.NewRequest(http.MethodGet, "/bus-rush/leaderboard", nil))

	out := rec.Body.String()
	if rec.Code != http.StatusOK || !strings.Contains(out, "Couldn't load the leaderboard") || strings.Contains(out, "db down") {
		t.Errorf("status %d, body %s: want 200 generic error fragment without the raw error", rec.Code, out)
	}
}

func TestBusRushHandler_SubmitScore_Valid(t *testing.T) {
	repo := &fakeBusRushRepository{}
	h := newTestBusRushHandler(t, repo)

	rec := postBusRushScore(h, url.Values{"player_name": {"Vince"}, "score": {"1500"}, "distance_meters": {"1200"}}, "203.0.113.30:1")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200, body: %s", rec.Code, rec.Body.String())
	}
	if len(repo.scores) != 1 || !strings.Contains(rec.Body.String(), "Vince") {
		t.Errorf("want one stored entry echoed in the fragment; repo=%+v body=%s", repo.scores, rec.Body.String())
	}
}

func TestBusRushHandler_SubmitScore_BadInput(t *testing.T) {
	tests := map[string]url.Values{
		"missing name":      {"player_name": {""}, "score": {"1"}, "distance_meters": {"1"}},
		"non-numeric score": {"player_name": {"a"}, "score": {"lots"}, "distance_meters": {"1"}},
		"score too high":    {"player_name": {"a"}, "score": {"1000000"}, "distance_meters": {"1"}},
		"negative distance": {"player_name": {"a"}, "score": {"1"}, "distance_meters": {"-1"}},
	}
	for name, form := range tests {
		t.Run(name, func(t *testing.T) {
			repo := &fakeBusRushRepository{}
			h := newTestBusRushHandler(t, repo)
			rec := postBusRushScore(h, form, "203.0.113.31:1")
			if rec.Code != http.StatusBadRequest {
				t.Errorf("status = %d, want 400", rec.Code)
			}
			if len(repo.scores) != 0 {
				t.Errorf("invalid submission reached the repository")
			}
		})
	}
}

func TestBusRushHandler_SubmitScore_RateLimited(t *testing.T) {
	repo := &fakeBusRushRepository{}
	h := newTestBusRushHandler(t, repo)
	form := url.Values{"player_name": {"Vince"}, "score": {"100"}, "distance_meters": {"50"}}

	var last int
	for i := 0; i < busRushScoreSubmitLimit+1; i++ {
		last = postBusRushScore(h, form, "203.0.113.32:1").Code
	}
	if last != http.StatusTooManyRequests {
		t.Errorf("request beyond the limit: status = %d, want 429", last)
	}
	if len(repo.scores) != busRushScoreSubmitLimit {
		t.Errorf("stored %d, want %d", len(repo.scores), busRushScoreSubmitLimit)
	}
}

func TestBusRushHandler_Leaderboard_Tabs(t *testing.T) {
	h := newTestBusRushHandler(t, &fakeBusRushRepository{})

	rec := httptest.NewRecorder()
	h.Leaderboard(rec, httptest.NewRequest(http.MethodGet, "/bus-rush/leaderboard", nil))
	out := rec.Body.String()
	for _, want := range []string{`hx-get="/bus-rush/leaderboard?board=daily"`, `data-board="all"`} {
		if !strings.Contains(out, want) {
			t.Errorf("all-time board missing %q\n--- output ---\n%s", want, out)
		}
	}
}

func TestBusRushHandler_DailyChallenge(t *testing.T) {
	repo := &fakeBusRushRepository{}
	h := newTestBusRushHandler(t, repo)

	ordinary := postBusRushScore(h, url.Values{"player_name": {"Anytime"}, "score": {"900"}, "distance_meters": {"800"}}, "203.0.113.40:1")
	daily := postBusRushScore(h, url.Values{"player_name": {"Today"}, "score": {"700"}, "distance_meters": {"600"}, "daily_date": {"2026-10-13"}}, "203.0.113.40:1")
	if ordinary.Code != http.StatusOK || daily.Code != http.StatusOK {
		t.Fatalf("statuses %d/%d, want 200s; body: %s", ordinary.Code, daily.Code, daily.Body.String())
	}
	// A daily submission answers with the daily board: only daily runs.
	if out := daily.Body.String(); !strings.Contains(out, "Today") || strings.Contains(out, "Anytime") || !strings.Contains(out, `data-board="daily"`) {
		t.Errorf("daily submit should return today's daily board\n--- output ---\n%s", out)
	}

	rec := httptest.NewRecorder()
	h.Leaderboard(rec, httptest.NewRequest(http.MethodGet, "/bus-rush/leaderboard?board=daily", nil))
	if out := rec.Body.String(); !strings.Contains(out, "Today") || strings.Contains(out, "Anytime") || !strings.Contains(out, "2026-10-13") {
		t.Errorf("?board=daily wrong\n--- output ---\n%s", out)
	}

	rec = httptest.NewRecorder()
	h.Leaderboard(rec, httptest.NewRequest(http.MethodGet, "/bus-rush/leaderboard", nil))
	if out := rec.Body.String(); !strings.Contains(out, "Today") || !strings.Contains(out, "Anytime") {
		t.Errorf("all-time board should rank every run\n--- output ---\n%s", out)
	}
}

func TestBusRushHandler_DailyChallenge_BadDate(t *testing.T) {
	for name, day := range map[string]string{"garbage": "yesterday", "back-filled": "2026-10-01"} {
		t.Run(name, func(t *testing.T) {
			repo := &fakeBusRushRepository{}
			h := newTestBusRushHandler(t, repo)
			rec := postBusRushScore(h, url.Values{"player_name": {"a"}, "score": {"1"}, "distance_meters": {"1"}, "daily_date": {day}}, "203.0.113.41:1")
			if rec.Code != http.StatusBadRequest || len(repo.scores) != 0 {
				t.Errorf("status = %d, stored %d; want 400 and nothing stored", rec.Code, len(repo.scores))
			}
		})
	}
}
