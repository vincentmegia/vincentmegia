package service

import (
	"context"
	"fmt"
	"time"

	"github.com/vincentmegia/vincentmegia/internal/model"
	"github.com/vincentmegia/vincentmegia/internal/repository"
)

// hospitalRepository is the subset of *repository.HospitalRepository this
// service depends on, declared here (not in internal/repository) so tests
// can substitute an in-memory fake without a real database — see
// docs/skills/go-backend/SKILL.md "Service"/"Testability".
// *repository.HospitalRepository satisfies this implicitly.
type hospitalRepository interface {
	Insert(ctx context.Context, playerName string, totalEarnings, shiftsCompleted int, dailyDate *time.Time) error
	TopScores(ctx context.Context, limit int) ([]model.HospitalScore, error)
	TopDailyScores(ctx context.Context, day time.Time, limit int) ([]model.HospitalScore, error)
}

// HospitalService wraps a HospitalRepository with the Hospital Shift
// leaderboard's business logic: validating a submission before it ever
// reaches Postgres. See docs/features/hospital-shift.md. Now is the clock
// the Daily Challenge's date checks use (time.Now when nil; tests pin it).
//
// Tickets checks each submission's run ticket (hospital_run.go). nil skips
// that check — only the service's unit tests leave it unset;
// NewHospitalService always sets it.
type HospitalService struct {
	Repo    hospitalRepository
	Now     func() time.Time
	Tickets *HospitalRunTickets
}

// NewHospitalService wraps a HospitalRepository, checking scores' run
// tickets with tickets.
func NewHospitalService(repo *repository.HospitalRepository, tickets *HospitalRunTickets) *HospitalService {
	return &HospitalService{Repo: repo, Tickets: tickets}
}

// IssueRunTicket starts a run: the ticket its score must be submitted with.
func (s *HospitalService) IssueRunTicket() (string, error) {
	return s.Tickets.Issue()
}

func (s *HospitalService) now() time.Time {
	if s.Now != nil {
		return s.Now()
	}
	return time.Now()
}

// Today is the Daily Challenge currently running (today's UTC date).
func (s *HospitalService) Today() string {
	return FormatBusRushDay(BusRushToday(s.now()))
}

// SubmitScore validates a leaderboard submission via
// ValidateHospitalScoreSubmission (docs/features/hospital-shift.md's Security
// Considerations) before inserting it — an invalid submission never
// reaches the repository. Returns the validation error unchanged on
// failure so the handler can render a clear 4xx rather than a raw DB
// constraint-violation error. daily is the Daily Challenge's date ("" for
// an ordinary run) — see ValidateHospitalDailyDate; a daily run is always
// exactly one shift. ticket is the run's ticket from IssueRunTicket: the
// anti-cheat checks (hospital_run.go) run last, so a ticket is only spent
// on an otherwise-valid score, and given back if the insert fails.
func (s *HospitalService) SubmitScore(ctx context.Context, playerName string, totalEarnings, shiftsCompleted int, daily, ticket string) error {
	trimmed, err := ValidateHospitalScoreSubmission(playerName, totalEarnings, shiftsCompleted)
	if err != nil {
		return err
	}
	day, err := ValidateHospitalDailyDate(daily, s.now())
	if err != nil {
		return err
	}
	if day != nil && shiftsCompleted != 1 {
		return ErrHospitalDailyShiftsInvalid
	}
	if err := ValidateHospitalEarningsPlausible(totalEarnings, shiftsCompleted); err != nil {
		return err
	}
	if s.Tickets != nil {
		if err := s.Tickets.Redeem(ticket, shiftsCompleted, day != nil); err != nil {
			return err
		}
	}
	if err := s.Repo.Insert(ctx, trimmed, totalEarnings, shiftsCompleted, day); err != nil {
		if s.Tickets != nil {
			s.Tickets.Release(ticket)
		}
		return fmt.Errorf("insert hospital score: %w", err)
	}
	return nil
}

// Leaderboard fetches the top `limit` leaderboard entries, total_earnings
// descending.
func (s *HospitalService) Leaderboard(ctx context.Context, limit int) ([]model.HospitalScore, error) {
	scores, err := s.Repo.TopScores(ctx, limit)
	if err != nil {
		return nil, fmt.Errorf("get hospital leaderboard: %w", err)
	}
	return scores, nil
}

// DailyLeaderboard fetches the top `limit` entries for one Daily Challenge
// (a YYYY-MM-DD date), total_earnings descending.
func (s *HospitalService) DailyLeaderboard(ctx context.Context, daily string, limit int) ([]model.HospitalScore, error) {
	day, err := time.Parse(busRushDailyDateLayout, daily)
	if err != nil {
		return nil, ErrHospitalDailyDateInvalid
	}
	scores, err := s.Repo.TopDailyScores(ctx, day, limit)
	if err != nil {
		return nil, fmt.Errorf("get hospital daily leaderboard: %w", err)
	}
	return scores, nil
}
