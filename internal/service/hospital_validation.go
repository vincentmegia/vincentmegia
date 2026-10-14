package service

import (
	"errors"
	"strings"
	"time"
)

// Bounds from docs/features/hospital-shift.md's Data Model — kept in sync
// with the hospital_scores table's CHECK constraints. Server-side
// validation exists so an out-of-range request gets a clear 4xx here
// rather than a raw DB constraint-violation error (see that doc's
// Security Considerations). Mirrors cooking_validation.go's exact pattern.
const (
	hospitalScorePlayerNameMaxLen = 20
	hospitalScoreEarningsMax      = 300000
	hospitalScoreShiftsMin        = 1
	hospitalScoreShiftsMax        = 30
)

var (
	ErrHospitalScorePlayerNameRequired = errors.New("player name is required")
	ErrHospitalScorePlayerNameTooLong  = errors.New("player name must be 20 characters or fewer")
	ErrHospitalScoreEarningsOutOfRange = errors.New("total earnings is out of the allowed range")
	ErrHospitalScoreShiftsOutOfRange   = errors.New("shifts completed is out of the allowed range")
	ErrHospitalDailyDateInvalid        = errors.New("daily challenge date must be YYYY-MM-DD")
	ErrHospitalDailyDateStale          = errors.New("that daily challenge is no longer open")
	ErrHospitalDailyShiftsInvalid      = errors.New("a daily challenge is a single shift")
)

// ValidateHospitalDailyDate parses a submission's daily_date: "" means an
// ordinary run (nil). A Daily Challenge run must be for today's UTC date,
// give or take one day so a shift finished across midnight (or on a skewed
// clock) still counts — the same window as Bus Rush's
// ValidateBusRushDailyDate, using its UTC-day helpers.
func ValidateHospitalDailyDate(daily string, now time.Time) (*time.Time, error) {
	if daily == "" {
		return nil, nil
	}
	day, err := time.Parse(busRushDailyDateLayout, daily)
	if err != nil {
		return nil, ErrHospitalDailyDateInvalid
	}
	today := BusRushToday(now)
	if day.Before(today.AddDate(0, 0, -1)) || day.After(today.AddDate(0, 0, 1)) {
		return nil, ErrHospitalDailyDateStale
	}
	return &day, nil
}

// ValidateHospitalScoreSubmission validates a leaderboard submission
// (POST /hospital-shift/score) per docs/features/hospital-shift.md's Security
// Considerations: player_name is trimmed and length-bounded,
// total_earnings and shifts_completed are bounded to the same coarse
// sanity range as the hospital_scores table's CHECK constraints. This is
// not anti-cheat — the game simulation is entirely client-side (see that
// doc's Scope) — it only rejects obviously-impossible submissions before
// they reach Postgres. Returns the trimmed player name to store on
// success.
func ValidateHospitalScoreSubmission(playerName string, totalEarnings, shiftsCompleted int) (string, error) {
	trimmed := strings.TrimSpace(playerName)
	if trimmed == "" {
		return "", ErrHospitalScorePlayerNameRequired
	}
	if len([]rune(trimmed)) > hospitalScorePlayerNameMaxLen {
		return "", ErrHospitalScorePlayerNameTooLong
	}
	if totalEarnings < 0 || totalEarnings > hospitalScoreEarningsMax {
		return "", ErrHospitalScoreEarningsOutOfRange
	}
	if shiftsCompleted < hospitalScoreShiftsMin || shiftsCompleted > hospitalScoreShiftsMax {
		return "", ErrHospitalScoreShiftsOutOfRange
	}
	return trimmed, nil
}
