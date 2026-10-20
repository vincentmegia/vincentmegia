package service

import (
	"errors"
	"testing"
)

var (
	errTestNameRequired = errors.New("required")
	errTestNameTooLong  = errors.New("too long")
)

func TestValidatePlayerName(t *testing.T) {
	tests := []struct {
		name    string
		in      string
		want    string
		wantErr error
	}{
		{"plain", "Vince", "Vince", nil},
		{"trimmed", "  Vince \t", "Vince", nil},
		{"inner space kept", "Kimono Himura", "Kimono Himura", nil},
		{"accents and CJK", "Eun-mi 은미 José", "Eun-mi 은미 José", nil},
		{"emoji", "Mel 🌼", "Mel 🌼", nil},
		{"exactly 20 runes", "ééééééééééééééééééé1", "ééééééééééééééééééé1", nil},
		{"blank", "", "", errTestNameRequired},
		{"only spaces", "   ", "", errTestNameRequired},
		{"21 runes", "ééééééééééééééééééé12", "", errTestNameTooLong},
		{"invalid UTF-8", "Vin\xffce", "", ErrPlayerNameInvalidCharacters},
		{"NUL", "Vin\x00ce", "", ErrPlayerNameInvalidCharacters},
		{"inner newline", "Vin\nce", "", ErrPlayerNameInvalidCharacters},
		{"DEL", "Vince\x7f", "", ErrPlayerNameInvalidCharacters},
		{"C1 control", "Vince\u0085x", "", ErrPlayerNameInvalidCharacters},
		{"RTL override", "\u202eecniV", "", ErrPlayerNameInvalidCharacters},
		{"bidi isolate", "Vince\u2066", "", ErrPlayerNameInvalidCharacters},
		{"zero-width space", "Vi\u200bnce", "", ErrPlayerNameInvalidCharacters},
		{"zero-width joiner", "Vi\u200dnce", "", ErrPlayerNameInvalidCharacters},
		{"BOM", "\ufeffVince", "", ErrPlayerNameInvalidCharacters},
		{"soft hyphen", "Vin\u00adce", "", ErrPlayerNameInvalidCharacters},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := validatePlayerName(tt.in, 20, errTestNameRequired, errTestNameTooLong)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("err = %v, want %v", err, tt.wantErr)
			}
			if got != tt.want {
				t.Errorf("got %q, want %q", got, tt.want)
			}
		})
	}
}

// TestScoreSubmissions_RejectInvalidNameCharacters checks every game's
// validator goes through validatePlayerName.
func TestScoreSubmissions_RejectInvalidNameCharacters(t *testing.T) {
	const bad = "Vin\u202ece"
	validators := map[string]func() error{
		"fishing":  func() error { _, err := ValidateFishingScoreSubmission(bad, 10, 1); return err },
		"cooking":  func() error { _, err := ValidateCookingScoreSubmission(bad, 10, 1); return err },
		"library":  func() error { _, err := ValidateLibraryScoreSubmission(bad, 10, 1); return err },
		"hospital": func() error { _, err := ValidateHospitalScoreSubmission(bad, 10, 1); return err },
		"bus rush": func() error { _, err := ValidateBusRushScoreSubmission(bad, 10, 1); return err },
	}
	for game, validate := range validators {
		if err := validate(); !errors.Is(err, ErrPlayerNameInvalidCharacters) {
			t.Errorf("%s: err = %v, want ErrPlayerNameInvalidCharacters", game, err)
		}
	}
}
