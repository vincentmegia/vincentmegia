package service

import (
	"errors"
	"strings"
	"time"
)

// Bounds from docs/features/bus-rush.md's Data Model — kept in sync with
// the bus_rush_scores table's CHECK constraints.
const (
	busRushPlayerNameMaxLen = 20
	busRushScoreMax         = 999999
	busRushDistanceMax      = 999999
)

var (
	ErrBusRushPlayerNameRequired = errors.New("player name is required")
	ErrBusRushPlayerNameTooLong  = errors.New("player name must be 20 characters or fewer")
	ErrBusRushScoreOutOfRange    = errors.New("score is out of the allowed range")
	ErrBusRushDistanceOutOfRange = errors.New("distance is out of the allowed range")
	ErrBusRushDailyDateInvalid   = errors.New("daily challenge date must be YYYY-MM-DD")
	ErrBusRushDailyDateStale     = errors.New("that daily challenge is no longer open")
)

// busRushDailyDateLayout is the Daily Challenge's date format — the UTC day,
// as the game's rules.js dailyDate() produces it.
const busRushDailyDateLayout = "2006-01-02"

// ValidateBusRushDailyDate parses a submission's daily_date: "" means an
// ordinary run (nil). A daily run must be for today's UTC date, give or take
// one day so a run finished across midnight (or on a skewed clock) still
// counts — but old days can't be back-filled.
func ValidateBusRushDailyDate(daily string, now time.Time) (*time.Time, error) {
	if daily == "" {
		return nil, nil
	}
	day, err := time.Parse(busRushDailyDateLayout, daily)
	if err != nil {
		return nil, ErrBusRushDailyDateInvalid
	}
	today := BusRushToday(now)
	if day.Before(today.AddDate(0, 0, -1)) || day.After(today.AddDate(0, 0, 1)) {
		return nil, ErrBusRushDailyDateStale
	}
	return &day, nil
}

// BusRushToday is now's UTC calendar day, at midnight UTC.
func BusRushToday(now time.Time) time.Time {
	y, m, d := now.UTC().Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

// FormatBusRushDay renders a day the way daily_date is submitted.
func FormatBusRushDay(day time.Time) string {
	return day.Format(busRushDailyDateLayout)
}

// ValidateBusRushScoreSubmission validates a POST /bus-rush/score
// submission: the name is trimmed and length-bounded, score and distance
// are bounded to the table's CHECK ranges. Not anti-cheat — the game runs
// client-side (docs/features/bus-rush.md's Scope). Returns the trimmed
// name to store.
func ValidateBusRushScoreSubmission(playerName string, score, distanceMeters int) (string, error) {
	trimmed := strings.TrimSpace(playerName)
	if trimmed == "" {
		return "", ErrBusRushPlayerNameRequired
	}
	if len([]rune(trimmed)) > busRushPlayerNameMaxLen {
		return "", ErrBusRushPlayerNameTooLong
	}
	if score < 0 || score > busRushScoreMax {
		return "", ErrBusRushScoreOutOfRange
	}
	if distanceMeters < 0 || distanceMeters > busRushDistanceMax {
		return "", ErrBusRushDistanceOutOfRange
	}
	return trimmed, nil
}
