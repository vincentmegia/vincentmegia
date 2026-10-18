package service

import (
	"context"
	"fmt"
	"time"

	"github.com/vincentmegia/vincentmegia/internal/model"
	"github.com/vincentmegia/vincentmegia/internal/repository"
)

// libraryRepository is the subset of *repository.LibraryRepository this
// service depends on, declared here (not in internal/repository) so tests
// can substitute an in-memory fake without a real database — see
// docs/skills/go-backend/SKILL.md "Service"/"Testability".
// *repository.LibraryRepository satisfies this implicitly.
type libraryRepository interface {
	Insert(ctx context.Context, playerName string, totalEarnings, shiftsCompleted int, dailyDate *time.Time) error
	TopScores(ctx context.Context, limit int) ([]model.LibraryScore, error)
	TopDailyScores(ctx context.Context, day time.Time, limit int) ([]model.LibraryScore, error)
}

// LibraryService wraps a LibraryRepository with the Library Shift
// leaderboard's business logic: validating a submission before it ever
// reaches Postgres. See docs/features/library-game.md. Now is the clock
// the Daily Challenge's date checks use (time.Now when nil; tests pin it).
type LibraryService struct {
	Repo libraryRepository
	Now  func() time.Time
}

func (s *LibraryService) now() time.Time {
	if s.Now != nil {
		return s.Now()
	}
	return time.Now()
}

// Today is the Daily Challenge currently running (today's UTC date).
func (s *LibraryService) Today() string {
	return FormatBusRushDay(BusRushToday(s.now()))
}

// NewLibraryService wraps a LibraryRepository.
func NewLibraryService(repo *repository.LibraryRepository) *LibraryService {
	return &LibraryService{Repo: repo}
}

// SubmitScore validates a leaderboard submission via
// ValidateLibraryScoreSubmission (docs/features/library-game.md's Security
// Considerations) before inserting it — an invalid submission never
// reaches the repository. Returns the validation error unchanged on
// failure so the handler can render a clear 4xx rather than a raw DB
// constraint-violation error. daily is the Daily Challenge's date ("" for
// an ordinary run) — see ValidateLibraryDailyDate; a daily run is always
// exactly one shift.
func (s *LibraryService) SubmitScore(ctx context.Context, playerName string, totalEarnings, shiftsCompleted int, daily string) error {
	trimmed, err := ValidateLibraryScoreSubmission(playerName, totalEarnings, shiftsCompleted)
	if err != nil {
		return err
	}
	day, err := ValidateLibraryDailyDate(daily, s.now())
	if err != nil {
		return err
	}
	if day != nil && shiftsCompleted != 1 {
		return ErrLibraryDailyShiftsInvalid
	}
	if err := s.Repo.Insert(ctx, trimmed, totalEarnings, shiftsCompleted, day); err != nil {
		return fmt.Errorf("insert library score: %w", err)
	}
	return nil
}

// Leaderboard fetches the top `limit` leaderboard entries, total_earnings
// descending.
func (s *LibraryService) Leaderboard(ctx context.Context, limit int) ([]model.LibraryScore, error) {
	scores, err := s.Repo.TopScores(ctx, limit)
	if err != nil {
		return nil, fmt.Errorf("get library leaderboard: %w", err)
	}
	return scores, nil
}

// DailyLeaderboard fetches the top `limit` entries for one Daily Challenge
// day (YYYY-MM-DD), total_earnings descending.
func (s *LibraryService) DailyLeaderboard(ctx context.Context, daily string, limit int) ([]model.LibraryScore, error) {
	day, err := time.Parse(busRushDailyDateLayout, daily)
	if err != nil {
		return nil, ErrLibraryDailyDateInvalid
	}
	scores, err := s.Repo.TopDailyScores(ctx, day, limit)
	if err != nil {
		return nil, fmt.Errorf("get library daily leaderboard: %w", err)
	}
	return scores, nil
}
