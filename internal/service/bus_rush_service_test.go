package service

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/vincentmegia/vincentmegia/internal/model"
)

// fakeBusRushRepository is an in-memory stand-in for
// *repository.BusRushRepository.
type fakeBusRushRepository struct {
	scores      []model.BusRushScore
	days        []*time.Time // daily_date per score, parallel to scores
	insertErr   error
	topErr      error
	insertCalls int
}

func (f *fakeBusRushRepository) Insert(ctx context.Context, playerName string, score, distanceMeters int, dailyDate *time.Time) error {
	f.insertCalls++
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

func TestValidateBusRushScoreSubmission(t *testing.T) {
	tests := []struct {
		name     string
		player   string
		score    int
		distance int
		wantName string
		wantErr  error
	}{
		{"valid, trimmed", "  Vince  ", 1200, 900, "Vince", nil},
		{"zero bounds", "a", 0, 0, "a", nil},
		{"upper bounds", strings.Repeat("é", 20), busRushScoreMax, busRushDistanceMax, strings.Repeat("é", 20), nil},
		{"empty name", "", 1, 1, "", ErrBusRushPlayerNameRequired},
		{"blank name", "   ", 1, 1, "", ErrBusRushPlayerNameRequired},
		{"name too long", strings.Repeat("x", 21), 1, 1, "", ErrBusRushPlayerNameTooLong},
		{"negative score", "a", -1, 1, "", ErrBusRushScoreOutOfRange},
		{"score too high", "a", busRushScoreMax + 1, 1, "", ErrBusRushScoreOutOfRange},
		{"negative distance", "a", 1, -1, "", ErrBusRushDistanceOutOfRange},
		{"distance too high", "a", 1, busRushDistanceMax + 1, "", ErrBusRushDistanceOutOfRange},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ValidateBusRushScoreSubmission(tt.player, tt.score, tt.distance)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("err = %v, want %v", err, tt.wantErr)
			}
			if got != tt.wantName {
				t.Errorf("name = %q, want %q", got, tt.wantName)
			}
		})
	}
}

func TestBusRushService_SubmitScore_Valid(t *testing.T) {
	repo := &fakeBusRushRepository{}
	svc := &BusRushService{Repo: repo}

	if err := svc.SubmitScore(context.Background(), "  Vince  ", 1200, 900, ""); err != nil {
		t.Fatalf("SubmitScore: %v", err)
	}
	if repo.insertCalls != 1 || repo.scores[0].PlayerName != "Vince" {
		t.Fatalf("repo = %+v, want one insert with trimmed name", repo.scores)
	}
}

func TestBusRushService_SubmitScore_InvalidNeverReachesRepo(t *testing.T) {
	repo := &fakeBusRushRepository{}
	svc := &BusRushService{Repo: repo}

	err := svc.SubmitScore(context.Background(), "Vince", -5, 10, "")
	if !errors.Is(err, ErrBusRushScoreOutOfRange) {
		t.Fatalf("err = %v, want ErrBusRushScoreOutOfRange", err)
	}
	if repo.insertCalls != 0 {
		t.Errorf("insert calls = %d, want 0", repo.insertCalls)
	}
}

func TestBusRushService_RepoErrorsAreWrapped(t *testing.T) {
	boom := errors.New("boom")
	svc := &BusRushService{Repo: &fakeBusRushRepository{insertErr: boom, topErr: boom}}

	if err := svc.SubmitScore(context.Background(), "Vince", 1, 1, ""); !errors.Is(err, boom) {
		t.Errorf("SubmitScore err = %v, want wrapping boom", err)
	}
	if _, err := svc.Leaderboard(context.Background(), 20); !errors.Is(err, boom) {
		t.Errorf("Leaderboard err = %v, want wrapping boom", err)
	}
}

func TestValidateBusRushDailyDate(t *testing.T) {
	now := time.Date(2026, 10, 13, 23, 59, 0, 0, time.FixedZone("SGT", 8*3600)) // 15:59 UTC
	tests := []struct {
		daily   string
		want    string
		wantErr error
	}{
		{"", "", nil},
		{"2026-10-13", "2026-10-13", nil},
		{"2026-10-12", "2026-10-12", nil}, // finished just after midnight
		{"2026-10-14", "2026-10-14", nil}, // a client clock a little ahead
		{"2026-10-11", "", ErrBusRushDailyDateStale},
		{"2026-10-15", "", ErrBusRushDailyDateStale},
		{"13/10/2026", "", ErrBusRushDailyDateInvalid},
	}
	for _, tt := range tests {
		t.Run(tt.daily, func(t *testing.T) {
			got, err := ValidateBusRushDailyDate(tt.daily, now)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("err = %v, want %v", err, tt.wantErr)
			}
			if (got == nil) != (tt.want == "") || (got != nil && FormatBusRushDay(*got) != tt.want) {
				t.Errorf("day = %v, want %q", got, tt.want)
			}
		})
	}
}

func TestBusRushService_DailyChallenge(t *testing.T) {
	repo := &fakeBusRushRepository{}
	svc := &BusRushService{Repo: repo, Now: func() time.Time { return time.Date(2026, 10, 13, 9, 0, 0, 0, time.UTC) }}

	if got := svc.Today(); got != "2026-10-13" {
		t.Fatalf("Today = %q", got)
	}
	if err := svc.SubmitScore(context.Background(), "Daily", 500, 400, "2026-10-13"); err != nil {
		t.Fatalf("SubmitScore daily: %v", err)
	}
	if err := svc.SubmitScore(context.Background(), "Plain", 900, 800, ""); err != nil {
		t.Fatalf("SubmitScore plain: %v", err)
	}
	if err := svc.SubmitScore(context.Background(), "Old", 1, 1, "2026-09-01"); !errors.Is(err, ErrBusRushDailyDateStale) || repo.insertCalls != 2 {
		t.Fatalf("stale daily: err = %v, inserts = %d", err, repo.insertCalls)
	}
	scores, err := svc.DailyLeaderboard(context.Background(), "2026-10-13", 20)
	if err != nil || len(scores) != 1 || scores[0].PlayerName != "Daily" {
		t.Fatalf("DailyLeaderboard = %+v, %v; want only the daily run", scores, err)
	}
	if _, err := svc.DailyLeaderboard(context.Background(), "nope", 20); !errors.Is(err, ErrBusRushDailyDateInvalid) {
		t.Errorf("bad date err = %v", err)
	}
}
