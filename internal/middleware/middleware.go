// Package middleware provides cross-cutting HTTP concerns (panic recovery,
// request IDs, logging, security headers) composed around the application's
// handlers. See docs/skills/go-backend/SKILL.md "Middleware".
package middleware

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"net/http"
	"net/netip"
	"strings"
	"time"
)

// requestIDKey is the context key under which the request ID is stored.
type requestIDKey struct{}

// clientIPKey is the context key under which ClientIP's middleware stores
// the resolved client identifier — see ClientKey.
type clientIPKey struct{}

// ClientIP returns middleware that resolves the address identifying a
// request's origin — used by every in-process rate limiter
// (internal/handler's api_auth.go/fishing_game.go/cooking_game.go) — and
// attaches it to the request context for ClientKey to read.
//
// When trustProxyHeaders is false (the default, and the only safe choice
// for a deployment not behind a known reverse proxy), the result is
// always r.RemoteAddr with its port stripped.
//
// When true, the last entry of the X-Forwarded-For header is used
// instead, if present. Enable this ONLY when the app is deployed behind
// exactly one trusted reverse proxy known to append the real client
// address as that header's last hop (this app's Render deployment does).
// Without such a proxy in front, or behind a proxy that doesn't control
// this header, X-Forwarded-For is attacker-supplied: a client could set
// it to a fresh value on every request to dodge a limiter entirely, or to
// a fixed value shared with other requests to collapse everyone into (or
// exhaust) one bucket — exactly the failure mode trusting it is meant to
// fix, just moved rather than closed. cfg.Config.TrustProxyHeaders is the
// one place this gets decided, at startup, not per-request.
func ClientIP(trustProxyHeaders bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := context.WithValue(r.Context(), clientIPKey{}, resolveClientIP(r, trustProxyHeaders))
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// ClientKey returns the request's resolved client identifier: the value
// ClientIP's middleware attached to the context, or — if that middleware
// did not run, as in a handler test that invokes the handler directly —
// the same RemoteAddr-only fallback ClientIP uses when trustProxyHeaders
// is false. Callers needing a per-caller rate-limit key should use this
// instead of reading r.RemoteAddr directly, so every limiter in the app
// agrees on one definition of "caller" and honors TRUST_PROXY_HEADERS
// automatically rather than each reimplementing the same trust decision.
func ClientKey(r *http.Request) string {
	if ip, ok := r.Context().Value(clientIPKey{}).(string); ok {
		return ip
	}
	return resolveClientIP(r, false)
}

// LimiterKey maps a ClientKey value to the bucket a per-caller rate
// limiter should count it under: an IPv6 address collapses to its /64
// (an ISP typically hands one subscriber a whole /64, so per-address
// buckets would let one client rotate through 2^64 of them), anything
// else — IPv4, an IPv4-mapped IPv6 address (as IPv4), or an unparseable
// value — is returned as-is. ClientKey itself stays the exact address,
// since it is also what gets logged.
func LimiterKey(key string) string {
	addr, err := netip.ParseAddr(strings.TrimSuffix(strings.TrimPrefix(key, "["), "]"))
	if err != nil {
		return key
	}
	addr = addr.Unmap()
	if !addr.Is6() {
		return addr.String()
	}
	prefix, err := addr.WithZone("").Prefix(64)
	if err != nil {
		return key
	}
	return prefix.String()
}

func resolveClientIP(r *http.Request, trustProxyHeaders bool) string {
	if trustProxyHeaders {
		if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
			parts := strings.Split(fwd, ",")
			if last := strings.TrimSpace(parts[len(parts)-1]); last != "" {
				return last
			}
		}
	}
	return hostOnly(r.RemoteAddr)
}

// hostOnly strips the ":port" suffix from a host:port address (as found
// in r.RemoteAddr) — the port differs per connection even from the same
// caller, so keeping it would put every retry in its own bucket.
func hostOnly(addr string) string {
	if idx := strings.LastIndex(addr, ":"); idx != -1 {
		return addr[:idx]
	}
	return addr
}

// RequestIDFromContext returns the request ID associated with ctx, or ""
// if none is present.
func RequestIDFromContext(ctx context.Context) string {
	id, _ := ctx.Value(requestIDKey{}).(string)
	return id
}

// Recover catches panics from downstream handlers so a single failing
// request cannot crash the process.
func Recover(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				slog.Error("panic recovered",
					"error", err,
					"request_id", RequestIDFromContext(r.Context()),
				)
				http.Error(w, "internal server error", http.StatusInternalServerError)
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// RequestID generates a random ID for each incoming request and attaches it
// to the request context so downstream layers (handlers, logging) can
// correlate their output. It also echoes the ID back as a response header.
func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := newRequestID()
		ctx := context.WithValue(r.Context(), requestIDKey{}, id)
		w.Header().Set("X-Request-ID", id)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func newRequestID() string {
	buf := make([]byte, 8)
	if _, err := rand.Read(buf); err != nil {
		// crypto/rand failing is effectively unrecoverable, but a missing
		// request ID is not worth crashing the request over.
		return "unknown"
	}
	return hex.EncodeToString(buf)
}

// statusRecorder wraps http.ResponseWriter to capture the status code
// written, so Logging can report it after the handler has run.
type statusRecorder struct {
	http.ResponseWriter
	status      int
	wroteHeader bool
}

func (rec *statusRecorder) WriteHeader(status int) {
	if !rec.wroteHeader {
		rec.status = status
		rec.wroteHeader = true
	}
	rec.ResponseWriter.WriteHeader(status)
}

func (rec *statusRecorder) Write(b []byte) (int, error) {
	if !rec.wroteHeader {
		rec.status = http.StatusOK
		rec.wroteHeader = true
	}
	return rec.ResponseWriter.Write(b)
}

// Logging logs one structured line per request: method, path, status,
// duration, and request ID, per docs/skills/go-backend/SKILL.md "Logging".
func Logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w}

		next.ServeHTTP(rec, r)

		slog.Info("http_request",
			"operation", r.Method+" "+r.URL.Path,
			"request_id", RequestIDFromContext(r.Context()),
			"status", rec.status,
			"duration", time.Since(start),
		)
	})
}

// SecurityHeaders sets response security headers on every response, per
// docs/skills/go-backend/SKILL.md "Security Headers". The CSP is
// intentionally strict: this app serves only same-origin static assets and
// server-rendered HTML, with no inline scripts or styles.
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("Content-Security-Policy", "default-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'; frame-ancestors 'none'")
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		h.Set("Strict-Transport-Security", "max-age=63072000; includeSubDomains")
		next.ServeHTTP(w, r)
	})
}

// Deadline gives every request's context a deadline d from now, so a
// handler stuck on a slow database query or upstream API gives up (its
// ctx-aware calls return context.DeadlineExceeded) instead of running on
// after the server's WriteTimeout has already cut the client off — per
// docs/skills/go-backend/SKILL.md "Middleware" (Timeout). d must be below
// http.Server.WriteTimeout so the handler still has time to write its
// error response. A context deadline rather than http.TimeoutHandler,
// which buffers every response in memory and can't flush or stream.
func Deadline(d time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx, cancel := context.WithTimeout(r.Context(), d)
			defer cancel()
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// isUnsafeMethod reports whether method can change server state — the
// methods LimitRequestBody and CrossOriginProtection act on.
func isUnsafeMethod(method string) bool {
	switch method {
	case http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
		return true
	}
	return false
}

// LimitRequestBody caps the body of every POST/PUT/PATCH/DELETE at max
// bytes, except under skipPrefix (the JSON API, which enforces its own
// tighter 64 KiB cap — internal/handler/landing_api.go — and answers with
// its JSON error envelope rather than this plain-text 413). A declared Content-Length over the cap is refused up front with
// 413; a chunked body is wrapped in http.MaxBytesReader, so reading past
// the cap fails and the handler's ParseForm/decode returns its usual
// "couldn't read" error. Without this, ParseForm alone allows 10 MB.
func LimitRequestBody(max int64, skipPrefix string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if isUnsafeMethod(r.Method) && (skipPrefix == "" || !strings.HasPrefix(r.URL.Path, skipPrefix)) {
				if r.ContentLength > max {
					http.Error(w, "request body too large", http.StatusRequestEntityTooLarge)
					return
				}
				r.Body = http.MaxBytesReader(w, r.Body, max)
			}
			next.ServeHTTP(w, r)
		})
	}
}

// CrossOriginProtection refuses (403) state-changing requests a browser
// sent on behalf of another site — this app's CSRF mitigation while it
// has no sessions or tokens to tie a form to. It is the standard library's
// http.CrossOriginProtection: GET/HEAD/OPTIONS always pass; otherwise a
// Sec-Fetch-Site of "same-origin" or "none" (typed URL, bookmark) passes
// and any other value — "cross-site" and also "same-site", since no
// sibling subdomain has a reason to post here — is refused; a request
// without Sec-Fetch-Site (older browsers) is refused only if its Origin
// header names a host other than the request's Host.
//
// A request with neither header passes: that is every non-browser caller
// (home-admin calling /api/internal/v1 with its bearer token, curl), which
// a browser-side forgery defence has no business blocking. So this stops
// browser-based cross-site forgery only — a script hitting an endpoint
// directly is unaffected, and is what each route's own auth, validation
// and rate limit are for. Once real auth with sessions lands, this stays
// as defence in depth alongside whatever CSRF token that feature adds.
func CrossOriginProtection(next http.Handler) http.Handler {
	cop := http.NewCrossOriginProtection()
	cop.SetDenyHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		slog.Warn("cross-origin request refused",
			"request_id", RequestIDFromContext(r.Context()),
			"operation", r.Method+" "+r.URL.Path,
			"sec_fetch_site", r.Header.Get("Sec-Fetch-Site"),
			"origin", r.Header.Get("Origin"),
		)
		http.Error(w, "cross-origin request refused", http.StatusForbidden)
	}))
	return cop.Handler(next)
}

// Chain composes middleware around a base handler, applying them in the
// order given so that the first middleware listed is outermost.
func Chain(h http.Handler, mw ...func(http.Handler) http.Handler) http.Handler {
	for i := len(mw) - 1; i >= 0; i-- {
		h = mw[i](h)
	}
	return h
}
