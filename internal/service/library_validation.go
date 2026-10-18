package service

import (
	"errors"
	"strings"
	"time"
)

// Bounds from docs/features/library-game.md's Data Model — kept in sync
// with the library_scores table's CHECK constraints. Server-side
// validation exists so an out-of-range request gets a clear 4xx here
// rather than a raw DB constraint-violation error (see that doc's
// Security Considerations). Mirrors cooking_validation.go's exact pattern.
const (
	libraryScorePlayerNameMaxLen = 20
	libraryScoreEarningsMax      = 100000
	libraryScoreShiftsMin        = 1
	libraryScoreShiftsMax        = 30
)

var (
	ErrLibraryScorePlayerNameRequired = errors.New("player name is required")
	ErrLibraryScorePlayerNameTooLong  = errors.New("player name must be 20 characters or fewer")
	ErrLibraryScoreEarningsOutOfRange = errors.New("total earnings is out of the allowed range")
	ErrLibraryScoreShiftsOutOfRange   = errors.New("shifts completed is out of the allowed range")
	ErrLibraryDailyDateInvalid        = errors.New("daily challenge date must be YYYY-MM-DD")
	ErrLibraryDailyDateStale          = errors.New("that daily challenge is no longer open")
	ErrLibraryDailyShiftsInvalid      = errors.New("a daily challenge is a single shift")
)

// ValidateLibraryDailyDate parses a submission's daily_date: "" means an
// ordinary run (nil). A Daily Challenge run must be for today's UTC date,
// give or take one day so a shift finished across midnight (or on a skewed
// clock) still counts — the same window as ValidateHospitalDailyDate.
func ValidateLibraryDailyDate(daily string, now time.Time) (*time.Time, error) {
	if daily == "" {
		return nil, nil
	}
	day, err := time.Parse(busRushDailyDateLayout, daily)
	if err != nil {
		return nil, ErrLibraryDailyDateInvalid
	}
	today := BusRushToday(now)
	if day.Before(today.AddDate(0, 0, -1)) || day.After(today.AddDate(0, 0, 1)) {
		return nil, ErrLibraryDailyDateStale
	}
	return &day, nil
}

// ValidateLibraryScoreSubmission validates a leaderboard submission
// (POST /library-game/score) per docs/features/library-game.md's Security
// Considerations: player_name is trimmed and length-bounded,
// total_earnings and shifts_completed are bounded to the same coarse
// sanity range as the library_scores table's CHECK constraints. This is
// not anti-cheat — the game simulation is entirely client-side (see that
// doc's Scope) — it only rejects obviously-impossible submissions before
// they reach Postgres. Returns the trimmed player name to store on
// success.
func ValidateLibraryScoreSubmission(playerName string, totalEarnings, shiftsCompleted int) (string, error) {
	trimmed := strings.TrimSpace(playerName)
	if trimmed == "" {
		return "", ErrLibraryScorePlayerNameRequired
	}
	if len([]rune(trimmed)) > libraryScorePlayerNameMaxLen {
		return "", ErrLibraryScorePlayerNameTooLong
	}
	if totalEarnings < 0 || totalEarnings > libraryScoreEarningsMax {
		return "", ErrLibraryScoreEarningsOutOfRange
	}
	if shiftsCompleted < libraryScoreShiftsMin || shiftsCompleted > libraryScoreShiftsMax {
		return "", ErrLibraryScoreShiftsOutOfRange
	}
	return trimmed, nil
}
