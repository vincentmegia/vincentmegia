package service

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"testing"
	"time"
)

// ticketsAt returns run tickets whose clock reads *now.
func ticketsAt(t *testing.T, now *time.Time) *HospitalRunTickets {
	t.Helper()
	tickets, err := NewHospitalRunTickets("test-secret", false)
	if err != nil {
		t.Fatal(err)
	}
	tickets.Now = func() time.Time { return *now }
	return tickets
}

func TestHospitalMinRunDuration(t *testing.T) {
	// 10×600 + 10×480 + 10×360 = 14,400 s of clock, 90% of it required.
	if got, want := HospitalMinRunDuration(30, false), 12960*time.Second; got != want {
		t.Errorf("30 shifts = %v, want %v", got, want)
	}
	// The Daily is one shift at shift 12's 8-minute clock.
	if got, want := HospitalMinRunDuration(1, true), 432*time.Second; got != want {
		t.Errorf("daily = %v, want %v", got, want)
	}
	if got := HospitalShiftClockSeconds(31); got != 360 {
		t.Errorf("shift 31 clock = %d, want the last tier's 360", got)
	}
}

func TestHospitalRunTickets_AcceptsAnHonestRun(t *testing.T) {
	now := time.Date(2026, 10, 14, 9, 0, 0, 0, time.UTC)
	tickets := ticketsAt(t, &now)
	ticket, err := tickets.Issue(false)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(ticket, "v2.month.") {
		t.Errorf("ticket = %q, want a v2 month ticket", ticket)
	}
	now = now.Add(4 * time.Hour)
	nonce, err := tickets.Verify(ticket, 30, false)
	if err != nil {
		t.Fatalf("honest 30-shift run rejected: %v", err)
	}
	if want := strings.Split(ticket, ".")[3]; nonce != want {
		t.Errorf("nonce = %q, want the ticket's %q", nonce, want)
	}
	// A Daily ticket submits a Daily once its one 8-minute shift has passed.
	dailyTicket, err := tickets.Issue(true)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(dailyTicket, "v2.daily.") {
		t.Errorf("daily ticket = %q, want a v2 daily ticket", dailyTicket)
	}
	now = now.Add(8 * time.Minute)
	if _, err := tickets.Verify(dailyTicket, 1, true); err != nil {
		t.Errorf("honest Daily rejected: %v", err)
	}
	// Verify is stateless: single use is the database's UNIQUE run_nonce
	// (see TestHospitalService_SubmitScore_AntiCheat).
	if again, err := tickets.Verify(ticket, 30, false); err != nil || again != nonce {
		t.Errorf("second Verify = %q, %v; want the same nonce", again, err)
	}
}

func TestHospitalRunTickets_Rejects(t *testing.T) {
	now := time.Date(2026, 10, 14, 9, 0, 0, 0, time.UTC)
	tickets := ticketsAt(t, &now)
	ticket, _ := tickets.Issue(false)
	dailyTicket, _ := tickets.Issue(true)
	parts := strings.Split(ticket, ".")

	other, _ := NewHospitalRunTickets("another-secret", false)
	other.Now = tickets.Now
	foreign, _ := other.Issue(false)

	// A v1 ticket (no kind in the payload), correctly signed by this secret.
	v1Payload := strings.Join([]string{"v1", parts[2], parts[3]}, ".")
	v1 := v1Payload + "." + tickets.sign(v1Payload)
	// A ticket signed as if issued an hour from now (a skewed or forged clock).
	futurePayload := strings.Join([]string{"v2", "month", strconv.FormatInt(now.Add(time.Hour).Unix(), 10), parts[3]}, ".")
	future := futurePayload + "." + tickets.sign(futurePayload)

	tests := []struct {
		name    string
		ticket  string
		after   time.Duration
		shifts  int
		daily   bool
		wantErr error
	}{
		{"no ticket", "", 5 * time.Hour, 30, false, ErrHospitalRunTicketMissing},
		{"garbage", "hello", 5 * time.Hour, 30, false, ErrHospitalRunTicketInvalid},
		{"tampered time", strings.Join([]string{parts[0], parts[1], "1", parts[3], parts[4]}, "."), 5 * time.Hour, 30, false, ErrHospitalRunTicketInvalid},
		{"tampered kind", strings.Join([]string{parts[0], "daily", parts[2], parts[3], parts[4]}, "."), 5 * time.Hour, 1, true, ErrHospitalRunTicketInvalid},
		{"v1 ticket", v1, 5 * time.Hour, 30, false, ErrHospitalRunTicketInvalid},
		{"month ticket as a Daily", ticket, 10 * time.Minute, 1, true, ErrHospitalRunTicketWrongKind},
		{"daily ticket as a month", dailyTicket, 5 * time.Hour, 30, false, ErrHospitalRunTicketWrongKind},
		{"future-dated", future, 0, 30, false, ErrHospitalRunTicketExpired},
		{"signed with another secret", foreign, 5 * time.Hour, 30, false, ErrHospitalRunTicketInvalid},
		{"30 shifts in an hour", ticket, time.Hour, 30, false, ErrHospitalRunTooFast},
		{"a Daily in a minute", dailyTicket, time.Minute, 1, true, ErrHospitalRunTooFast},
		{"expired", ticket, 13 * time.Hour, 30, false, ErrHospitalRunTicketExpired},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			at := now
			tickets.Now = func() time.Time { return at.Add(tt.after) }
			if _, err := tickets.Verify(tt.ticket, tt.shifts, tt.daily); !errors.Is(err, tt.wantErr) {
				t.Errorf("err = %v, want %v", err, tt.wantErr)
			}
		})
	}
}

func TestHospitalRunTickets_SkipTimeCheck(t *testing.T) {
	tickets, _ := NewHospitalRunTickets("", true)
	ticket, _ := tickets.Issue(false)
	if _, err := tickets.Verify(ticket, 30, false); err != nil {
		t.Errorf("with the time check off, an instant run should pass: %v", err)
	}
}

func TestHospitalService_SubmitScore_AntiCheat(t *testing.T) {
	now := time.Date(2026, 10, 14, 9, 0, 0, 0, time.UTC)
	repo := &fakeHospitalRepository{}
	svc := &HospitalService{Repo: repo, Tickets: ticketsAt(t, &now), Now: func() time.Time { return now }}
	ticket, err := svc.IssueRunTicket(false)
	if err != nil {
		t.Fatal(err)
	}

	if err := svc.SubmitScore(context.Background(), "Vince", 80000, 30, "", ticket); !errors.Is(err, ErrHospitalRunTooFast) {
		t.Fatalf("instant submit: err = %v, want ErrHospitalRunTooFast", err)
	}
	now = now.Add(4 * time.Hour)
	if err := svc.SubmitScore(context.Background(), "Vince", 80000, 30, "", ""); !errors.Is(err, ErrHospitalRunTicketMissing) {
		t.Errorf("no ticket: err = %v, want ErrHospitalRunTicketMissing", err)
	}
	if err := svc.SubmitScore(context.Background(), "Vince", 80000, 30, "", ticket); err != nil {
		t.Fatalf("honest run rejected: %v", err)
	}
	if err := svc.SubmitScore(context.Background(), "Vince", 80000, 30, "", ticket); !errors.Is(err, ErrHospitalRunTicketUsed) {
		t.Errorf("replay: err = %v, want ErrHospitalRunTicketUsed", err)
	}
	// A second server instance (or the same one after a restart) shares
	// the database, so the replay is still refused.
	restarted := &HospitalService{Repo: repo, Tickets: ticketsAt(t, &now), Now: func() time.Time { return now }}
	if err := restarted.SubmitScore(context.Background(), "Vince", 80000, 30, "", ticket); !errors.Is(err, ErrHospitalRunTicketUsed) {
		t.Errorf("replay after restart: err = %v, want ErrHospitalRunTicketUsed", err)
	}
	if len(repo.scores) != 1 {
		t.Errorf("stored rows = %d, want 1", len(repo.scores))
	}
}

func TestHospitalService_SubmitScore_ImplausibleEarnings(t *testing.T) {
	repo := &fakeHospitalRepository{}
	svc := &HospitalService{Repo: repo, Now: func() time.Time { return time.Date(2026, 10, 14, 9, 0, 0, 0, time.UTC) }}
	// A 1-shift Daily can't pay a month's wages.
	if err := svc.SubmitScore(context.Background(), "Vince", 250000, 1, "2026-10-14", ""); !errors.Is(err, ErrHospitalEarningsImplausible) {
		t.Errorf("err = %v, want ErrHospitalEarningsImplausible", err)
	}
	if repo.insertCalls != 0 {
		t.Errorf("insert calls = %d, want 0", repo.insertCalls)
	}
}

func TestHospitalService_SubmitScore_FailedInsertKeepsTicket(t *testing.T) {
	now := time.Date(2026, 10, 14, 9, 0, 0, 0, time.UTC)
	repo := &fakeHospitalRepository{insertErr: errors.New("connection refused")}
	svc := &HospitalService{Repo: repo, Tickets: ticketsAt(t, &now)}
	ticket, _ := svc.IssueRunTicket(false)
	now = now.Add(4 * time.Hour)
	if err := svc.SubmitScore(context.Background(), "Vince", 80000, 30, "", ticket); err == nil {
		t.Fatal("expected the insert error")
	}
	repo.insertErr = nil
	if err := svc.SubmitScore(context.Background(), "Vince", 80000, 30, "", ticket); err != nil {
		t.Errorf("retry after a failed insert should still work: %v", err)
	}
}

// TestHospitalService_SubmitScore_TicketKind verifies a run ticket only
// submits the kind of run it was issued for: a month ticket held past the
// Daily's 7.2-minute minimum can't post a Daily score, and a Daily ticket
// can't post a month.
func TestHospitalService_SubmitScore_TicketKind(t *testing.T) {
	now := time.Date(2026, 10, 14, 9, 0, 0, 0, time.UTC)
	repo := &fakeHospitalRepository{}
	svc := &HospitalService{Repo: repo, Tickets: ticketsAt(t, &now), Now: func() time.Time { return now }}
	monthTicket, _ := svc.IssueRunTicket(false)
	dailyTicket, _ := svc.IssueRunTicket(true)

	now = now.Add(10 * time.Minute)
	if err := svc.SubmitScore(context.Background(), "Vince", 4000, 1, "2026-10-14", monthTicket); !errors.Is(err, ErrHospitalRunTicketWrongKind) {
		t.Errorf("month ticket as a Daily: err = %v, want ErrHospitalRunTicketWrongKind", err)
	}
	now = now.Add(4 * time.Hour)
	if err := svc.SubmitScore(context.Background(), "Vince", 80000, 30, "", dailyTicket); !errors.Is(err, ErrHospitalRunTicketWrongKind) {
		t.Errorf("daily ticket as a month: err = %v, want ErrHospitalRunTicketWrongKind", err)
	}
	if repo.insertCalls != 0 {
		t.Errorf("insert calls = %d, want 0", repo.insertCalls)
	}
}
