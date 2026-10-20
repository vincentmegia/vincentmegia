package middleware

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestClientKey_FallsBackToRemoteAddrWhenMiddlewareDidNotRun(t *testing.T) {
	// Mirrors a handler test that calls a handler directly without going
	// through the middleware chain (see internal/handler's fishing_game_test.go
	// et al.) — ClientKey must still behave like the pre-ClientIP
	// r.RemoteAddr-trimming logic in that case.
	tests := []struct{ remoteAddr, want string }{
		{"192.0.2.1:54321", "192.0.2.1"},
		{"192.0.2.1:12345", "192.0.2.1"},
		{"[2001:db8::1]:443", "[2001:db8::1]"},
		{"192.0.2.1", "192.0.2.1"},
	}
	for _, tt := range tests {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.RemoteAddr = tt.remoteAddr
		if got := ClientKey(req); got != tt.want {
			t.Errorf("ClientKey(%q) = %q, want %q", tt.remoteAddr, got, tt.want)
		}
	}
}

func TestClientKey_FallsBackIgnoresXForwardedForWhenMiddlewareDidNotRun(t *testing.T) {
	// Without ClientIP's middleware in the chain, X-Forwarded-For must
	// never be consulted — a caller invoking ClientKey with no established
	// trust decision must get the always-safe RemoteAddr-only behavior.
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = "192.0.2.1:54321"
	req.Header.Set("X-Forwarded-For", "203.0.113.9")
	if got, want := ClientKey(req), "192.0.2.1"; got != want {
		t.Errorf("ClientKey() = %q, want %q", got, want)
	}
}

func TestClientIP_UntrustedIgnoresXForwardedFor(t *testing.T) {
	var seen string
	h := ClientIP(false)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen = ClientKey(r)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = "192.0.2.1:54321"
	req.Header.Set("X-Forwarded-For", "203.0.113.9")
	h.ServeHTTP(httptest.NewRecorder(), req)

	if seen != "192.0.2.1" {
		t.Errorf("ClientKey() = %q, want %q (RemoteAddr, X-Forwarded-For ignored)", seen, "192.0.2.1")
	}
}

func TestClientIP_TrustedUsesLastXForwardedForEntry(t *testing.T) {
	var seen string
	h := ClientIP(true)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen = ClientKey(r)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	// RemoteAddr is the trusted proxy's own address; the header's last
	// entry is what that proxy appended for the real client, per
	// ClientIP's doc comment on how Render appends this header.
	req.RemoteAddr = "10.0.0.1:443"
	req.Header.Set("X-Forwarded-For", "203.0.113.9, 198.51.100.5")
	h.ServeHTTP(httptest.NewRecorder(), req)

	if seen != "198.51.100.5" {
		t.Errorf("ClientKey() = %q, want %q (last X-Forwarded-For entry)", seen, "198.51.100.5")
	}
}

func TestClientIP_TrustedFallsBackWhenHeaderAbsent(t *testing.T) {
	var seen string
	h := ClientIP(true)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen = ClientKey(r)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = "192.0.2.1:54321"
	h.ServeHTTP(httptest.NewRecorder(), req)

	if seen != "192.0.2.1" {
		t.Errorf("ClientKey() = %q, want %q (RemoteAddr fallback)", seen, "192.0.2.1")
	}
}

func TestLimiterKey(t *testing.T) {
	tests := []struct{ in, want string }{
		{"192.0.2.1", "192.0.2.1"},
		{"[2001:db8:1:2:aaaa::1]", "2001:db8:1:2::/64"},
		{"2001:db8:1:2:bbbb::9", "2001:db8:1:2::/64"},
		{"::ffff:192.0.2.1", "192.0.2.1"},
		{"not-an-ip", "not-an-ip"},
	}
	for _, tt := range tests {
		if got := LimiterKey(tt.in); got != tt.want {
			t.Errorf("LimiterKey(%q) = %q, want %q", tt.in, got, tt.want)
		}
	}
}

func TestDeadline_SetsContextDeadline(t *testing.T) {
	var deadline time.Time
	var ok bool
	h := Deadline(8 * time.Second)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		deadline, ok = r.Context().Deadline()
	}))
	start := time.Now()
	h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))
	if !ok {
		t.Fatal("request context has no deadline")
	}
	if d := deadline.Sub(start); d <= 7*time.Second || d > 8*time.Second+time.Second {
		t.Errorf("deadline %v from start, want ~8s", d)
	}
}

func TestDeadline_CancelsSlowHandlerContext(t *testing.T) {
	var err error
	h := Deadline(10 * time.Millisecond)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-r.Context().Done()
		err = r.Context().Err()
	}))
	h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Errorf("ctx.Err() = %v, want DeadlineExceeded", err)
	}
}

func TestLimitRequestBody(t *testing.T) {
	const max = 16
	var readErr error
	h := LimitRequestBody(max, "/api/")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, readErr = io.ReadAll(r.Body)
		w.WriteHeader(http.StatusNoContent)
	}))

	t.Run("declared length over cap is 413", func(t *testing.T) {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/x", strings.NewReader(strings.Repeat("a", max+1))))
		if rec.Code != http.StatusRequestEntityTooLarge {
			t.Errorf("status = %d, want 413", rec.Code)
		}
	})
	t.Run("chunked body over cap fails to read", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPut, "/x", io.NopCloser(strings.NewReader(strings.Repeat("a", max+1))))
		req.ContentLength = -1
		h.ServeHTTP(httptest.NewRecorder(), req)
		var maxErr *http.MaxBytesError
		if !errors.As(readErr, &maxErr) {
			t.Errorf("read error = %v, want *http.MaxBytesError", readErr)
		}
	})
	t.Run("body at cap passes", func(t *testing.T) {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/x", strings.NewReader(strings.Repeat("a", max))))
		if rec.Code != http.StatusNoContent || readErr != nil {
			t.Errorf("status = %d, err = %v; want 204, nil", rec.Code, readErr)
		}
	})
	t.Run("skip prefix is not capped here", func(t *testing.T) {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/x", strings.NewReader(strings.Repeat("a", max+1))))
		if rec.Code != http.StatusNoContent || readErr != nil {
			t.Errorf("status = %d, err = %v; want 204, nil", rec.Code, readErr)
		}
	})
	t.Run("GET is not capped", func(t *testing.T) {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/x", strings.NewReader(strings.Repeat("a", max+1))))
		if rec.Code != http.StatusNoContent {
			t.Errorf("status = %d, want 204", rec.Code)
		}
	})
}

func TestCrossOriginProtection(t *testing.T) {
	h := CrossOriginProtection(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	tests := []struct {
		name, method string
		headers      map[string]string
		want         int
	}{
		{"cross-site POST", http.MethodPost, map[string]string{"Sec-Fetch-Site": "cross-site"}, http.StatusForbidden},
		{"same-site POST", http.MethodPost, map[string]string{"Sec-Fetch-Site": "same-site"}, http.StatusForbidden},
		{"cross-site DELETE", http.MethodDelete, map[string]string{"Sec-Fetch-Site": "cross-site"}, http.StatusForbidden},
		{"same-origin POST", http.MethodPost, map[string]string{"Sec-Fetch-Site": "same-origin"}, http.StatusNoContent},
		{"user-initiated POST", http.MethodPost, map[string]string{"Sec-Fetch-Site": "none"}, http.StatusNoContent},
		{"no headers (server-to-server, curl)", http.MethodPost, nil, http.StatusNoContent},
		{"bearer API caller, no browser headers", http.MethodPut, map[string]string{"Authorization": "Bearer x"}, http.StatusNoContent},
		{"foreign Origin, no Sec-Fetch-Site", http.MethodPost, map[string]string{"Origin": "https://evil.example"}, http.StatusForbidden},
		{"matching Origin, no Sec-Fetch-Site", http.MethodPost, map[string]string{"Origin": "http://example.com"}, http.StatusNoContent},
		{"cross-site GET", http.MethodGet, map[string]string{"Sec-Fetch-Site": "cross-site"}, http.StatusNoContent},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, "http://example.com/fishing-game/score", nil)
			for k, v := range tt.headers {
				req.Header.Set(k, v)
			}
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)
			if rec.Code != tt.want {
				t.Errorf("status = %d, want %d", rec.Code, tt.want)
			}
		})
	}
}

func TestSecurityHeaders_CSPIncludesFormAction(t *testing.T) {
	rec := httptest.NewRecorder()
	SecurityHeaders(http.NotFoundHandler()).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
	csp := rec.Header().Get("Content-Security-Policy")
	for _, want := range []string{"default-src 'self'", "base-uri 'self'", "form-action 'self'", "object-src 'none'", "frame-ancestors 'none'"} {
		if !strings.Contains(csp, want) {
			t.Errorf("CSP %q missing %q", csp, want)
		}
	}
}
