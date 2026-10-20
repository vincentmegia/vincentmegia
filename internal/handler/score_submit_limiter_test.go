package handler

import (
	"fmt"
	"testing"
	"time"
)

func TestScoreSubmitLimiter_EvictsExpiredEntries(t *testing.T) {
	l := newScoreSubmitLimiter(1, 10*time.Millisecond)
	for i := 0; i < 50; i++ {
		l.Allow(fmt.Sprintf("10.0.0.%d", i))
	}
	time.Sleep(15 * time.Millisecond)

	// A new window after the old ones have closed triggers the sweep.
	if !l.Allow("10.0.1.1") {
		t.Fatal("fresh key was refused")
	}
	l.mu.Lock()
	n := len(l.entries)
	l.mu.Unlock()
	if n != 1 {
		t.Errorf("entries after sweep = %d, want 1 (only the live key)", n)
	}
}

func TestScoreSubmitLimiter_KeepsLiveEntries(t *testing.T) {
	l := newScoreSubmitLimiter(1, time.Minute)
	l.Allow("10.0.0.1")
	l.Allow("10.0.0.2")
	if l.Allow("10.0.0.1") {
		t.Error("limit was reset for a key whose window is still open")
	}
}

func TestScoreSubmitLimiter_GroupsIPv6By64(t *testing.T) {
	l := newScoreSubmitLimiter(1, time.Minute)
	if !l.Allow("[2001:db8:0:1::1]") {
		t.Fatal("first request refused")
	}
	if l.Allow("[2001:db8:0:1::2]") {
		t.Error("a second address in the same /64 got its own budget")
	}
	if !l.Allow("[2001:db8:0:2::1]") {
		t.Error("a different /64 was refused")
	}
}
