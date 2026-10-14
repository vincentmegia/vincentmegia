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
	"sync"
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
// Each ticket is single-use, so one honest run can't be replayed into many
// leaderboard rows.

const (
	// hospitalRunTicketVersion prefixes every ticket so the format can change.
	hospitalRunTicketVersion = "v1"
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

// HospitalRunTickets issues and checks signed, single-use run tickets.
// Used tickets are remembered in memory until they'd have expired anyway:
// enough for this site's single server process (a restart forgets them,
// but a ticket is only usable for a few hours either way).
type HospitalRunTickets struct {
	secret []byte
	// SkipTimeCheck turns off the minimum-duration check, for the
	// Playwright suite, which seeds a run straight to shift 30
	// (HOSPITAL_RUN_TIME_CHECK=off; never set in production).
	SkipTimeCheck bool
	Now           func() time.Time

	mu   sync.Mutex
	used map[string]time.Time
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
	return &HospitalRunTickets{secret: key, SkipTimeCheck: skipTimeCheck, used: map[string]time.Time{}}, nil
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

// Issue returns a new ticket: "v1.<issued unix>.<nonce>.<hmac>".
func (t *HospitalRunTickets) Issue() (string, error) {
	nonce := make([]byte, 12)
	if _, err := rand.Read(nonce); err != nil {
		return "", fmt.Errorf("generate hospital run nonce: %w", err)
	}
	payload := fmt.Sprintf("%s.%d.%s", hospitalRunTicketVersion, t.now().Unix(), hex.EncodeToString(nonce))
	return payload + "." + t.sign(payload), nil
}

// Redeem checks a ticket for a run claiming `shifts` shifts and, if it
// passes, marks it used. Release undoes that when the score then fails to
// save, so a database hiccup doesn't burn an honest run.
func (t *HospitalRunTickets) Redeem(ticket string, shifts int, daily bool) error {
	if ticket == "" {
		return ErrHospitalRunTicketMissing
	}
	parts := strings.Split(ticket, ".")
	if len(parts) != 4 || parts[0] != hospitalRunTicketVersion {
		return ErrHospitalRunTicketInvalid
	}
	payload := strings.Join(parts[:3], ".")
	if !hmac.Equal([]byte(parts[3]), []byte(t.sign(payload))) {
		return ErrHospitalRunTicketInvalid
	}
	issuedUnix, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return ErrHospitalRunTicketInvalid
	}
	now := t.now()
	elapsed := now.Sub(time.Unix(issuedUnix, 0))
	if elapsed < 0 || elapsed > hospitalRunTicketMaxAge {
		return ErrHospitalRunTicketExpired
	}
	if !t.SkipTimeCheck && elapsed < HospitalMinRunDuration(shifts, daily) {
		return ErrHospitalRunTooFast
	}

	t.mu.Lock()
	defer t.mu.Unlock()
	for nonce, at := range t.used {
		if now.Sub(at) > hospitalRunTicketMaxAge {
			delete(t.used, nonce)
		}
	}
	if _, seen := t.used[parts[2]]; seen {
		return ErrHospitalRunTicketUsed
	}
	t.used[parts[2]] = now
	return nil
}

// Release forgets that a ticket was redeemed.
func (t *HospitalRunTickets) Release(ticket string) {
	parts := strings.Split(ticket, ".")
	if len(parts) != 4 {
		return
	}
	t.mu.Lock()
	delete(t.used, parts[2])
	t.mu.Unlock()
}
