package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/vincentmegia/vincentmegia/internal/model"
)

// fakeLibraryRepository is an in-memory stand-in for
// *repository.LibraryRepository, satisfying the libraryRepository
// interface library_service.go declares — no real Postgres connection
// needed to exercise LibraryService's own logic. Mirrors
// fakeCookingRepository's exact pattern (cooking_service_test.go).
type fakeLibraryRepository struct {
	scores      []model.LibraryScore
	insertErr   error
	topErr      error
	insertCalls int
	daily       []model.LibraryScore
	dailyDays   []time.Time
}

func (f *fakeLibraryRepository) Insert(ctx context.Context, playerName string, totalEarnings, shiftsCompleted int, dailyDate *time.Time) error {
	f.insertCalls++
	if f.insertErr != nil {
		return f.insertErr
	}
	row := model.LibraryScore{
		PlayerName:      playerName,
		TotalEarnings:   totalEarnings,
		ShiftsCompleted: shiftsCompleted,
	}
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

// TestLibraryService_SubmitScore_Valid verifies a valid submission is
// trimmed by ValidateLibraryScoreSubmission and reaches the repository
// exactly once with the trimmed name.
func TestLibraryService_SubmitScore_Valid(t *testing.T) {
	repo := &fakeLibraryRepository{}
	svc := &LibraryService{Repo: repo}

	if err := svc.SubmitScore(context.Background(), "  Vince  ", 80000, 30, ""); err != nil {
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

// TestLibraryService_SubmitScore_ValidationRejected verifies an
// out-of-bounds submission is rejected by ValidateLibraryScoreSubmission
// and never reaches the repository's Insert at all.
func TestLibraryService_SubmitScore_ValidationRejected(t *testing.T) {
	tests := []struct {
		name            string
		playerName      string
		totalEarnings   int
		shiftsCompleted int
		wantErr         error
	}{
		{"blank name", "", 1000, 5, ErrLibraryScorePlayerNameRequired},
		{"name too long", "this-name-is-way-too-long-for-the-limit", 1000, 5, ErrLibraryScorePlayerNameTooLong},
		{"earnings out of range", "Vince", 200_000, 5, ErrLibraryScoreEarningsOutOfRange},
		{"shifts out of range", "Vince", 1000, 31, ErrLibraryScoreShiftsOutOfRange},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &fakeLibraryRepository{}
			svc := &LibraryService{Repo: repo}

			err := svc.SubmitScore(context.Background(), tt.playerName, tt.totalEarnings, tt.shiftsCompleted, "")
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("err = %v, want %v", err, tt.wantErr)
			}
			if repo.insertCalls != 0 {
				t.Errorf("insert calls = %d, want 0 (validation should reject before reaching the repository)", repo.insertCalls)
			}
		})
	}
}

// TestLibraryService_SubmitScore_RepositoryError verifies a repository
// failure is wrapped and returned, not swallowed, and is distinguishable
// from a validation error.
func TestLibraryService_SubmitScore_RepositoryError(t *testing.T) {
	repoErr := errors.New("connection refused")
	repo := &fakeLibraryRepository{insertErr: repoErr}
	svc := &LibraryService{Repo: repo}

	err := svc.SubmitScore(context.Background(), "Vince", 1000, 5, "")
	if err == nil {
		t.Fatal("expected an error, got nil")
	}
	if errors.Is(err, ErrLibraryScorePlayerNameRequired) || errors.Is(err, ErrLibraryScoreEarningsOutOfRange) {
		t.Errorf("repository error should not be mistaken for a validation sentinel: %v", err)
	}
	if !errors.Is(err, repoErr) {
		t.Errorf("err = %v, want it to wrap %v", err, repoErr)
	}
}

// TestLibraryService_Leaderboard verifies Leaderboard delegates to
// TopScores with the requested limit.
func TestLibraryService_Leaderboard(t *testing.T) {
	repo := &fakeLibraryRepository{
		scores: []model.LibraryScore{
			{PlayerName: "Alice", TotalEarnings: 80000, ShiftsCompleted: 30},
			{PlayerName: "Bob", TotalEarnings: 60000, ShiftsCompleted: 30},
		},
	}
	svc := &LibraryService{Repo: repo}

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

// TestLibraryService_Leaderboard_Empty verifies an empty result set is
// returned as-is (nil/empty slice), not an error.
func TestLibraryService_Leaderboard_Empty(t *testing.T) {
	repo := &fakeLibraryRepository{}
	svc := &LibraryService{Repo: repo}

	got, err := svc.Leaderboard(context.Background(), 20)
	if err != nil {
		t.Fatalf("Leaderboard: unexpected error: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("len(got) = %d, want 0", len(got))
	}
}

// TestLibraryService_DailyChallenge covers the Daily Challenge's
// submissions: today's date lands on the daily board (not the all-time
// one), a daily run must be exactly one shift, and a stale or malformed
// date is rejected before the repository is touched.
func TestLibraryService_DailyChallenge(t *testing.T) {
	now := time.Date(2026, 10, 17, 12, 0, 0, 0, time.UTC)
	repo := &fakeLibraryRepository{}
	svc := &LibraryService{Repo: repo, Now: func() time.Time { return now }}

	if got := svc.Today(); got != "2026-10-17" {
		t.Fatalf("Today() = %q, want 2026-10-17", got)
	}
	if err := svc.SubmitScore(context.Background(), "Eun-mi", 900, 1, "2026-10-17"); err != nil {
		t.Fatalf("daily SubmitScore: %v", err)
	}
	if len(repo.daily) != 1 || len(repo.scores) != 0 {
		t.Fatalf("daily run stored as daily=%d all-time=%d, want 1/0", len(repo.daily), len(repo.scores))
	}
	board, err := svc.DailyLeaderboard(context.Background(), "2026-10-17", 20)
	if err != nil || len(board) != 1 || board[0].PlayerName != "Eun-mi" {
		t.Fatalf("DailyLeaderboard = %v, %v; want Eun-mi's row", board, err)
	}

	for _, tt := range []struct {
		name   string
		shifts int
		daily  string
		want   error
	}{
		{"a daily run must be one shift", 2, "2026-10-17", ErrLibraryDailyShiftsInvalid},
		{"yesterday's challenge still counts, two days ago doesn't", 1, "2026-10-15", ErrLibraryDailyDateStale},
		{"tomorrow is too far ahead", 1, "2026-10-19", ErrLibraryDailyDateStale},
		{"malformed date", 1, "17/10/2026", ErrLibraryDailyDateInvalid},
	} {
		t.Run(tt.name, func(t *testing.T) {
			before := repo.insertCalls
			err := svc.SubmitScore(context.Background(), "Eun-mi", 900, tt.shifts, tt.daily)
			if !errors.Is(err, tt.want) {
				t.Fatalf("SubmitScore error = %v, want %v", err, tt.want)
			}
			if repo.insertCalls != before {
				t.Errorf("rejected daily run still reached the repository")
			}
		})
	}
	if err := svc.SubmitScore(context.Background(), "Eun-mi", 900, 1, "2026-10-16"); err != nil {
		t.Errorf("yesterday's daily run (within a day) was rejected: %v", err)
	}
}
