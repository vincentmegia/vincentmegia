package service

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
)

// Hospital Shift's leaderboard anti-cheat (docs/features/hospital-shift.md's
// Security Considerations; the user: "add security", choosing "leaderboard
// anti-cheat"). The game runs entirely client-side, so nothing here can
// prove a score was earned — but two things the server can check make
// faking one far more work than playing:
//
//   - Time. Every shift runs a fixed real-time clock (rules.js
//     ROUND_TIER_CLOCK_SECONDS: 10/8/6 minutes by tier) and can't end early,
//     and progress never survives leaving the page, so a 30-shift run is
//     one ~4-hour page session. The page asks for a signed run ticket when
//     its run starts (POST /hospital-shift/run); a submission must carry
//     it, and is rejected if less real time has passed since it was issued
//     than the shifts it claims take (with slack for timer drift).
//   - Earnings. Each claimed shift can add at most
//     hospitalMaxEarningsPerShift — a coarse ceiling above anything a
//     perfect shift pays (a 4,000 paycheck at the +25% rank perk, every
//     discharge and bonus), so a 1-shift Daily can't claim a month's pay.
//
// Each ticket is single-use — its nonce is stored with the score row under
// a UNIQUE constraint — so one honest run can't be replayed into many
// leaderboard rows. Each ticket is also signed for one kind of run (the
// month, or the Daily Challenge), so a month ticket held for the Daily's
// short clock can't submit a Daily score, and the reverse.

const (
	// hospitalRunTicketVersion prefixes every ticket so the format can change.
	// v2 added the run kind to the signed payload. v1 tickets are rejected:
	// they carry no kind, so accepting one would reopen the month-ticket-
	// as-Daily hole for its remaining lifetime, and a ticket lives at most
	// hospitalRunTicketMaxAge — a run in progress across the deploy just
	// can't submit.
	hospitalRunTicketVersion = "v2"
	// hospitalRunKindMonth/hospitalRunKindDaily are the run kinds a ticket
	// is signed for.
	hospitalRunKindMonth = "month"
	hospitalRunKindDaily = "daily"
	// hospitalRunTicketMaxAge bounds how long a run can take: a 30-shift run
	// is ~4 hours of clock, so 12 hours leaves room for long breaks with
	// the tab open.
	hospitalRunTicketMaxAge = 12 * time.Hour
	// hospitalRunTimeSlack is the fraction of the claimed shifts' clock
	// that must really have passed — 10% slack for frame-timer drift.
	hospitalRunTimeSlack = 0.9
	// hospitalMaxEarningsPerShift caps what each claimed shift can add.
	hospitalMaxEarningsPerShift = 10000
	// hospitalDailyShiftNumber mirrors rules.js DAILY_SHIFT_NUMBER: the
	// Daily Challenge is one shift played at shift 12's clock.
	hospitalDailyShiftNumber = 12
)

// hospitalShiftClockSeconds mirrors rules.js ROUND_TIER_CLOCK_SECONDS and
// ROUND_TIER_SHIFT_SPAN: real seconds on the clock for each 10-shift tier.
var hospitalShiftClockSeconds = [3]int{600, 480, 360}

var (
	ErrHospitalRunTicketMissing    = errors.New("this run has no ticket — start a new run to submit a score")
	ErrHospitalRunTicketInvalid    = errors.New("this run's ticket isn't valid — start a new run to submit a score")
	ErrHospitalRunTicketExpired    = errors.New("this run's ticket has expired — start a new run to submit a score")
	ErrHospitalRunTicketWrongKind  = errors.New("this run's ticket is for a different kind of run — start a new run to submit a score")
	ErrHospitalRunTicketUsed       = errors.New("this run's score was already submitted")
	ErrHospitalRunTooFast          = errors.New("that score came in faster than those shifts can be played")
	ErrHospitalEarningsImplausible = errors.New("those earnings are more than those shifts can pay")
)

// HospitalShiftClockSeconds is the real-time clock of shift n (1-based).
func HospitalShiftClockSeconds(n int) int {
	tier := (n - 1) / 10
	if tier < 0 {
		tier = 0
	}
	if tier >= len(hospitalShiftClockSeconds) {
		tier = len(hospitalShiftClockSeconds) - 1
	}
	return hospitalShiftClockSeconds[tier]
}

// HospitalMinRunDuration is the least real time a run claiming `shifts`
// shifts (from shift 1, or the single Daily shift) can honestly take.
func HospitalMinRunDuration(shifts int, daily bool) time.Duration {
	total := 0
	if daily {
		total = HospitalShiftClockSeconds(hospitalDailyShiftNumber)
	} else {
		for n := 1; n <= shifts; n++ {
			total += HospitalShiftClockSeconds(n)
		}
	}
	return time.Duration(float64(total) * hospitalRunTimeSlack * float64(time.Second))
}

// ValidateHospitalEarningsPlausible rejects earnings no number of shifts
// could pay.
func ValidateHospitalEarningsPlausible(totalEarnings, shiftsCompleted int) error {
	if totalEarnings > shiftsCompleted*hospitalMaxEarningsPerShift {
		return ErrHospitalEarningsImplausible
	}
	return nil
}

// HospitalRunTickets issues and checks signed run tickets. It keeps no
// state: single use is enforced by Postgres (see Verify).
type HospitalRunTickets struct {
	secret []byte
	// SkipTimeCheck turns off the minimum-duration check, for the
	// Playwright suite, which seeds a run straight to shift 30
	// (HOSPITAL_RUN_TIME_CHECK=off; never set in production).
	SkipTimeCheck bool
	Now           func() time.Time
}

// NewHospitalRunTickets signs with secret; an empty secret gets a random
// one, so tickets don't survive a restart (set HOSPITAL_RUN_SECRET to keep
// runs in progress valid across deploys).
func NewHospitalRunTickets(secret string, skipTimeCheck bool) (*HospitalRunTickets, error) {
	key := []byte(secret)
	if len(key) == 0 {
		key = make([]byte, 32)
		if _, err := rand.Read(key); err != nil {
			return nil, fmt.Errorf("generate hospital run secret: %w", err)
		}
	}
	return &HospitalRunTickets{secret: key, SkipTimeCheck: skipTimeCheck}, nil
}

func (t *HospitalRunTickets) now() time.Time {
	if t.Now != nil {
		return t.Now()
	}
	return time.Now()
}

func (t *HospitalRunTickets) sign(payload string) string {
	mac := hmac.New(sha256.New, t.secret)
	mac.Write([]byte(payload))
	return hex.EncodeToString(mac.Sum(nil))
}

func hospitalRunKind(daily bool) string {
	if daily {
		return hospitalRunKindDaily
	}
	return hospitalRunKindMonth
}

// Issue returns a new ticket for a month run, or a Daily Challenge when
// daily: "v2.<kind>.<issued unix>.<nonce>.<hmac>".
func (t *HospitalRunTickets) Issue(daily bool) (string, error) {
	nonce := make([]byte, 12)
	if _, err := rand.Read(nonce); err != nil {
		return "", fmt.Errorf("generate hospital run nonce: %w", err)
	}
	payload := fmt.Sprintf("%s.%s.%d.%s", hospitalRunTicketVersion, hospitalRunKind(daily), t.now().Unix(), hex.EncodeToString(nonce))
	return payload + "." + t.sign(payload), nil
}

// Verify checks a ticket for a run claiming `shifts` shifts — a Daily
// Challenge when daily, which the ticket must have been issued for — and
// returns its nonce. It doesn't mark the ticket used: single use is the
// hospital_scores.run_nonce UNIQUE constraint (migration 014), so the
// score row and the "spent" mark are one insert — durable across restarts
// and instances, and a failed insert leaves the ticket unspent.
func (t *HospitalRunTickets) Verify(ticket string, shifts int, daily bool) (string, error) {
	if ticket == "" {
		return "", ErrHospitalRunTicketMissing
	}
	parts := strings.Split(ticket, ".")
	if len(parts) != 5 || parts[0] != hospitalRunTicketVersion {
		return "", ErrHospitalRunTicketInvalid
	}
	payload := strings.Join(parts[:4], ".")
	if !hmac.Equal([]byte(parts[4]), []byte(t.sign(payload))) {
		return "", ErrHospitalRunTicketInvalid
	}
	if parts[1] != hospitalRunKind(daily) {
		return "", ErrHospitalRunTicketWrongKind
	}
	issuedUnix, err := strconv.ParseInt(parts[2], 10, 64)
	if err != nil {
		return "", ErrHospitalRunTicketInvalid
	}
	elapsed := t.now().Sub(time.Unix(issuedUnix, 0))
	if elapsed < 0 || elapsed > hospitalRunTicketMaxAge {
		return "", ErrHospitalRunTicketExpired
	}
	if !t.SkipTimeCheck && elapsed < HospitalMinRunDuration(shifts, daily) {
		return "", ErrHospitalRunTooFast
	}
	return parts[3], nil
}
