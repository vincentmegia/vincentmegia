package service

import (
	"context"
	"errors"
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

func TestHospitalRunTickets_AcceptsAnHonestRunOnce(t *testing.T) {
	now := time.Date(2026, 10, 14, 9, 0, 0, 0, time.UTC)
	tickets := ticketsAt(t, &now)
	ticket, err := tickets.Issue()
	if err != nil {
		t.Fatal(err)
	}
	now = now.Add(4 * time.Hour)
	if err := tickets.Redeem(ticket, 30, false); err != nil {
		t.Fatalf("honest 30-shift run rejected: %v", err)
	}
	if err := tickets.Redeem(ticket, 30, false); !errors.Is(err, ErrHospitalRunTicketUsed) {
		t.Errorf("replayed ticket: err = %v, want ErrHospitalRunTicketUsed", err)
	}
	tickets.Release(ticket)
	if err := tickets.Redeem(ticket, 30, false); err != nil {
		t.Errorf("released ticket should redeem again: %v", err)
	}
}

func TestHospitalRunTickets_Rejects(t *testing.T) {
	now := time.Date(2026, 10, 14, 9, 0, 0, 0, time.UTC)
	tickets := ticketsAt(t, &now)
	ticket, _ := tickets.Issue()
	parts := strings.Split(ticket, ".")

	other, _ := NewHospitalRunTickets("another-secret", false)
	other.Now = tickets.Now
	foreign, _ := other.Issue()

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
		{"tampered time", strings.Join([]string{parts[0], "1", parts[2], parts[3]}, "."), 5 * time.Hour, 30, false, ErrHospitalRunTicketInvalid},
		{"signed with another secret", foreign, 5 * time.Hour, 30, false, ErrHospitalRunTicketInvalid},
		{"30 shifts in an hour", ticket, time.Hour, 30, false, ErrHospitalRunTooFast},
		{"a Daily in a minute", ticket, time.Minute, 1, true, ErrHospitalRunTooFast},
		{"expired", ticket, 13 * time.Hour, 30, false, ErrHospitalRunTicketExpired},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			at := now
			tickets.Now = func() time.Time { return at.Add(tt.after) }
			if err := tickets.Redeem(tt.ticket, tt.shifts, tt.daily); !errors.Is(err, tt.wantErr) {
				t.Errorf("err = %v, want %v", err, tt.wantErr)
			}
		})
	}
}

func TestHospitalRunTickets_SkipTimeCheck(t *testing.T) {
	tickets, _ := NewHospitalRunTickets("", true)
	ticket, _ := tickets.Issue()
	if err := tickets.Redeem(ticket, 30, false); err != nil {
		t.Errorf("with the time check off, an instant run should pass: %v", err)
	}
}

func TestHospitalService_SubmitScore_AntiCheat(t *testing.T) {
	now := time.Date(2026, 10, 14, 9, 0, 0, 0, time.UTC)
	repo := &fakeHospitalRepository{}
	svc := &HospitalService{Repo: repo, Tickets: ticketsAt(t, &now), Now: func() time.Time { return now }}
	ticket, err := svc.IssueRunTicket()
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
	if repo.insertCalls != 1 {
		t.Errorf("insert calls = %d, want 1", repo.insertCalls)
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

func TestHospitalService_SubmitScore_ReleasesTicketWhenInsertFails(t *testing.T) {
	now := time.Date(2026, 10, 14, 9, 0, 0, 0, time.UTC)
	repo := &fakeHospitalRepository{insertErr: errors.New("connection refused")}
	svc := &HospitalService{Repo: repo, Tickets: ticketsAt(t, &now)}
	ticket, _ := svc.IssueRunTicket()
	now = now.Add(4 * time.Hour)
	if err := svc.SubmitScore(context.Background(), "Vince", 80000, 30, "", ticket); err == nil {
		t.Fatal("expected the insert error")
	}
	repo.insertErr = nil
	if err := svc.SubmitScore(context.Background(), "Vince", 80000, 30, "", ticket); err != nil {
		t.Errorf("retry after a failed insert should still work: %v", err)
	}
}
