package service

import (
	"errors"
	"strings"
	"unicode"
	"unicode/utf8"
)

// ErrPlayerNameInvalidCharacters is every game's leaderboard error for a
// player name that isn't valid UTF-8 or contains a control or format
// character (Unicode Cc/Cf: newlines, NUL, bidi overrides such as U+202E,
// zero-width spaces/joiners) — characters that render invisibly or reorder
// the leaderboard row around them.
var ErrPlayerNameInvalidCharacters = errors.New("player name contains characters that aren't allowed")

// validatePlayerName is the shared player-name rule behind every game's
// Validate*ScoreSubmission: trimmed, valid UTF-8, no Cc/Cf characters, and
// 1–maxLen runes. errRequired/errTooLong are the calling game's own
// sentinels, so each handler keeps mapping them as before. Returns the
// trimmed name to store.
func validatePlayerName(playerName string, maxLen int, errRequired, errTooLong error) (string, error) {
	if !utf8.ValidString(playerName) {
		return "", ErrPlayerNameInvalidCharacters
	}
	trimmed := strings.TrimSpace(playerName)
	if trimmed == "" {
		return "", errRequired
	}
	for _, r := range trimmed {
		if unicode.In(r, unicode.Cc, unicode.Cf) {
			return "", ErrPlayerNameInvalidCharacters
		}
	}
	if utf8.RuneCountInString(trimmed) > maxLen {
		return "", errTooLong
	}
	return trimmed, nil
}
