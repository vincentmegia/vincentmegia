package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/vincentmegia/vincentmegia/internal/model"
	"github.com/vincentmegia/vincentmegia/internal/repository"
)

// fakeHospitalRepository is an in-memory stand-in for
// *repository.HospitalRepository, satisfying the hospitalRepository
// interface hospital_service.go declares — no real Postgres connection
// needed to exercise HospitalService's own logic. Mirrors
// fakeCookingRepository's exact pattern (cooking_service_test.go).
type fakeHospitalRepository struct {
	scores      []model.HospitalScore
	days        []*time.Time // scores[i]'s daily_date (nil = ordinary run)
	insertErr   error
	topErr      error
	insertCalls int
	nonces      map[string]bool // stored run_nonce values (the UNIQUE constraint)
}

func (f *fakeHospitalRepository) Insert(ctx context.Context, playerName string, totalEarnings, shiftsCompleted int, dailyDate *time.Time, runNonce string) error {
	f.insertCalls++
	if f.insertErr != nil {
		return f.insertErr
	}
	if runNonce != "" {
		if f.nonces[runNonce] {
			return repository.ErrHospitalRunNonceUsed
		}
		if f.nonces == nil {
			f.nonces = map[string]bool{}
		}
		f.nonces[runNonce] = true
	}
	f.scores = append(f.scores, model.HospitalScore{
		PlayerName:      playerName,
		TotalEarnings:   totalEarnings,
		ShiftsCompleted: shiftsCompleted,
	})
	f.days = append(f.days, dailyDate)
	return nil
}

func (f *fakeHospitalRepository) TopDailyScores(ctx context.Context, day time.Time, limit int) ([]model.HospitalScore, error) {
	var out []model.HospitalScore
	for i, s := range f.scores {
		if i < len(f.days) && f.days[i] != nil && f.days[i].Equal(day) {
			out = append(out, s)
		}
	}
	if len(out) > limit {
		out = out[:limit]
	}
	return out, nil
}

func (f *fakeHospitalRepository) TopScores(ctx context.Context, limit int) ([]model.HospitalScore, error) {
	if f.topErr != nil {
		return nil, f.topErr
	}
	if len(f.scores) <= limit {
		return f.scores, nil
	}
	return f.scores[:limit], nil
}

// TestHospitalService_SubmitScore_Valid verifies a valid submission is
// trimmed by ValidateHospitalScoreSubmission and reaches the repository
// exactly once with the trimmed name.
func TestHospitalService_SubmitScore_Valid(t *testing.T) {
	repo := &fakeHospitalRepository{}
	svc := &HospitalService{Repo: repo}

	if err := svc.SubmitScore(context.Background(), "  Vince  ", 80000, 30, "", ""); err != nil {
		t.Fatalf("SubmitScore: unexpected error: %v", err)
	}

	if repo.insertCalls != 1 {
		t.Fatalf("insert calls = %d, want 1", repo.insertCalls)
	}
	if got, want := repo.scores[0].PlayerName, "Vince"; got != want {
		t.Errorf("stored player name = %q, want %q (trimmed)", got, want)
	}
	if got, want := repo.scores[0].TotalEarnings, 80000; got != want {
		t.Errorf("stored total earnings = %d, want %d", got, want)
	}
	if got, want := repo.scores[0].ShiftsCompleted, 30; got != want {
		t.Errorf("stored shifts completed = %d, want %d", got, want)
	}
}

// TestHospitalService_SubmitScore_ValidationRejected verifies an
// out-of-bounds submission is rejected by ValidateHospitalScoreSubmission
// and never reaches the repository's Insert at all.
func TestHospitalService_SubmitScore_ValidationRejected(t *testing.T) {
	tests := []struct {
		name            string
		playerName      string
		totalEarnings   int
		shiftsCompleted int
		wantErr         error
	}{
		{"blank name", "", 1000, 5, ErrHospitalScorePlayerNameRequired},
		{"name too long", "this-name-is-way-too-long-for-the-limit", 1000, 5, ErrHospitalScorePlayerNameTooLong},
		{"earnings out of range", "Vince", 400_000, 5, ErrHospitalScoreEarningsOutOfRange},
		{"shifts out of range", "Vince", 1000, 31, ErrHospitalScoreShiftsOutOfRange},
		{"month run short of 30 shifts", "Vince", 1000, 5, ErrHospitalMonthShiftsInvalid},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &fakeHospitalRepository{}
			svc := &HospitalService{Repo: repo}

			err := svc.SubmitScore(context.Background(), tt.playerName, tt.totalEarnings, tt.shiftsCompleted, "", "")
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("err = %v, want %v", err, tt.wantErr)
			}
			if repo.insertCalls != 0 {
				t.Errorf("insert calls = %d, want 0 (validation should reject before reaching the repository)", repo.insertCalls)
			}
		})
	}
}

// TestHospitalService_SubmitScore_RepositoryError verifies a repository
// failure is wrapped and returned, not swallowed, and is distinguishable
// from a validation error.
func TestHospitalService_SubmitScore_RepositoryError(t *testing.T) {
	repoErr := errors.New("connection refused")
	repo := &fakeHospitalRepository{insertErr: repoErr}
	svc := &HospitalService{Repo: repo}

	err := svc.SubmitScore(context.Background(), "Vince", 1000, 30, "", "")
	if err == nil {
		t.Fatal("expected an error, got nil")
	}
	if errors.Is(err, ErrHospitalScorePlayerNameRequired) || errors.Is(err, ErrHospitalScoreEarningsOutOfRange) {
		t.Errorf("repository error should not be mistaken for a validation sentinel: %v", err)
	}
	if !errors.Is(err, repoErr) {
		t.Errorf("err = %v, want it to wrap %v", err, repoErr)
	}
}

// TestHospitalService_Leaderboard verifies Leaderboard delegates to
// TopScores with the requested limit.
func TestHospitalService_Leaderboard(t *testing.T) {
	repo := &fakeHospitalRepository{
		scores: []model.HospitalScore{
			{PlayerName: "Alice", TotalEarnings: 80000, ShiftsCompleted: 30},
			{PlayerName: "Bob", TotalEarnings: 60000, ShiftsCompleted: 30},
		},
	}
	svc := &HospitalService{Repo: repo}

	got, err := svc.Leaderboard(context.Background(), 1)
	if err != nil {
		t.Fatalf("Leaderboard: unexpected error: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("len(got) = %d, want 1", len(got))
	}
	if got[0].PlayerName != "Alice" {
		t.Errorf("got[0].PlayerName = %q, want %q", got[0].PlayerName, "Alice")
	}
}

// TestHospitalService_Leaderboard_Empty verifies an empty result set is
// returned as-is (nil/empty slice), not an error.
func TestHospitalService_Leaderboard_Empty(t *testing.T) {
	repo := &fakeHospitalRepository{}
	svc := &HospitalService{Repo: repo}

	got, err := svc.Leaderboard(context.Background(), 20)
	if err != nil {
		t.Fatalf("Leaderboard: unexpected error: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("len(got) = %d, want 0", len(got))
	}
}

// TestHospitalService_DailyChallenge covers the Daily Challenge: a one-shift
// run for today (or ±1 day) is stored with its date and shows on that day's
// board; a stale or malformed date, or a "daily" run of more than one shift,
// is rejected before the repository.
func TestHospitalService_DailyChallenge(t *testing.T) {
	now := time.Date(2026, 10, 14, 23, 30, 0, 0, time.UTC)
	repo := &fakeHospitalRepository{}
	svc := &HospitalService{Repo: repo, Now: func() time.Time { return now }}

	if got, want := svc.Today(), "2026-10-14"; got != want {
		t.Fatalf("Today() = %q, want %q", got, want)
	}
	if err := svc.SubmitScore(context.Background(), "Vince", 4200, 1, "2026-10-14", ""); err != nil {
		t.Fatalf("daily submit: %v", err)
	}
	if err := svc.SubmitScore(context.Background(), "Ana", 3900, 1, "2026-10-15", ""); err != nil {
		t.Fatalf("daily submit for tomorrow (clock skew) should be allowed: %v", err)
	}
	if repo.days[0] == nil || repo.days[0].Format("2006-01-02") != "2026-10-14" {
		t.Errorf("stored daily_date = %v, want 2026-10-14", repo.days[0])
	}

	for _, tt := range []struct {
		name   string
		daily  string
		shifts int
		want   error
	}{
		{"stale date", "2026-10-10", 1, ErrHospitalDailyDateStale},
		{"bad format", "14/10/2026", 1, ErrHospitalDailyDateInvalid},
		{"more than one shift", "2026-10-14", 3, ErrHospitalDailyShiftsInvalid},
	} {
		before := repo.insertCalls
		err := svc.SubmitScore(context.Background(), "Vince", 4000, tt.shifts, tt.daily, "")
		if !errors.Is(err, tt.want) {
			t.Errorf("%s: err = %v, want %v", tt.name, err, tt.want)
		}
		if repo.insertCalls != before {
			t.Errorf("%s: reached the repository", tt.name)
		}
	}

	board, err := svc.DailyLeaderboard(context.Background(), "2026-10-14", 20)
	if err != nil {
		t.Fatalf("DailyLeaderboard: %v", err)
	}
	if len(board) != 1 || board[0].PlayerName != "Vince" {
		t.Errorf("daily board = %+v, want just Vince's run", board)
	}
	if _, err := svc.DailyLeaderboard(context.Background(), "nope", 20); !errors.Is(err, ErrHospitalDailyDateInvalid) {
		t.Errorf("DailyLeaderboard bad date err = %v", err)
	}
}
