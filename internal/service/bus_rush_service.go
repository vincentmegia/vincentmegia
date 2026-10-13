package service

import (
	"context"
	"fmt"
	"time"

	"github.com/vincentmegia/vincentmegia/internal/model"
	"github.com/vincentmegia/vincentmegia/internal/repository"
)

// busRushRepository is the subset of *repository.BusRushRepository this
// service depends on, so tests can substitute an in-memory fake.
type busRushRepository interface {
	Insert(ctx context.Context, playerName string, score, distanceMeters int, dailyDate *time.Time) error
	TopScores(ctx context.Context, limit int) ([]model.BusRushScore, error)
	TopDailyScores(ctx context.Context, day time.Time, limit int) ([]model.BusRushScore, error)
}

// BusRushService wraps a BusRushRepository with the leaderboard's business
// logic. See docs/features/bus-rush.md. Now is the clock the Daily
// Challenge's date checks use (time.Now when nil; tests pin it).
type BusRushService struct {
	Repo busRushRepository
	Now  func() time.Time
}

// NewBusRushService wraps a BusRushRepository.
func NewBusRushService(repo *repository.BusRushRepository) *BusRushService {
	return &BusRushService{Repo: repo}
}

func (s *BusRushService) now() time.Time {
	if s.Now != nil {
		return s.Now()
	}
	return time.Now()
}

// Today is the Daily Challenge currently running (today's UTC date).
func (s *BusRushService) Today() string {
	return FormatBusRushDay(BusRushToday(s.now()))
}

// SubmitScore validates a submission before inserting it; an invalid one
// never reaches the repository, and its validation error is returned
// unchanged so the handler can answer 400. daily is the Daily Challenge's
// date ("" for an ordinary run) — see ValidateBusRushDailyDate.
func (s *BusRushService) SubmitScore(ctx context.Context, playerName string, score, distanceMeters int, daily string) error {
	trimmed, err := ValidateBusRushScoreSubmission(playerName, score, distanceMeters)
	if err != nil {
		return err
	}
	day, err := ValidateBusRushDailyDate(daily, s.now())
	if err != nil {
		return err
	}
	if err := s.Repo.Insert(ctx, trimmed, score, distanceMeters, day); err != nil {
		return fmt.Errorf("insert bus rush score: %w", err)
	}
	return nil
}

// Leaderboard fetches the top `limit` entries, score descending.
func (s *BusRushService) Leaderboard(ctx context.Context, limit int) ([]model.BusRushScore, error) {
	scores, err := s.Repo.TopScores(ctx, limit)
	if err != nil {
		return nil, fmt.Errorf("get bus rush leaderboard: %w", err)
	}
	return scores, nil
}

// DailyLeaderboard fetches the top `limit` entries for one Daily Challenge
// (a YYYY-MM-DD date), score descending.
func (s *BusRushService) DailyLeaderboard(ctx context.Context, daily string, limit int) ([]model.BusRushScore, error) {
	day, err := time.Parse(busRushDailyDateLayout, daily)
	if err != nil {
		return nil, ErrBusRushDailyDateInvalid
	}
	scores, err := s.Repo.TopDailyScores(ctx, day, limit)
	if err != nil {
		return nil, fmt.Errorf("get bus rush daily leaderboard: %w", err)
	}
	return scores, nil
}
