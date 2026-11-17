# Middleware

Compose cross-cutting concerns as middleware rather than repeating them in every
handler. At minimum:

* **Recover** — catch panics so one handler failure doesn't crash the process.
* **Request ID** — generate/propagate an ID for correlating logs across a request.
* **Logging** — log method, path, status, duration for every request.
* **Timeout** — bound handler execution with a context deadline below
  `WriteTimeout` (`middleware.Deadline`, 8 s against the 10 s
  `WriteTimeout`), not `http.TimeoutHandler`, which buffers every response.
  Every DB and outbound HTTP call must take the request's `ctx` so the
  deadline actually stops it.
* **Body cap** — `middleware.LimitRequestBody` caps POST/PUT/PATCH/DELETE
  bodies at 1 MiB (413 on a declared `Content-Length` over it); the JSON API
  under `/api/` keeps its own 64 KiB cap and envelope.
* **Cross-origin writes** — `middleware.CrossOriginProtection` (the
  stdlib's `http.CrossOriginProtection`) returns 403 for an unsafe-method
  request whose `Sec-Fetch-Site` is anything but `same-origin`/`none`
  (`same-site` too — no sibling subdomain posts here), or, without that
  header, whose `Origin` doesn't match the host. Requests with neither
  header (curl, home-admin's bearer-token calls) pass, so this stops
  browser-based CSRF only; it is not authentication and doesn't replace
  per-route auth, validation or rate limits.

```go
func Recover(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        defer func() {
            if err := recover(); err != nil {
                slog.Error("panic recovered", "error", err)
                http.Error(w, "internal server error", http.StatusInternalServerError)
            }
        }()
        next.ServeHTTP(w, r)
    })
}
```

Order middleware deliberately (recover outermost, then request ID, then logging).
This app's chain is `cmd/server/main.go`'s `newHandlerChain`: Recover →
RequestID → ClientIP → Logging → SecurityHeaders → CrossOriginProtection →
LimitRequestBody → Deadline.

Per-caller rate limiters key on `middleware.LimiterKey(middleware.ClientKey(r))`
(IPv6 collapsed to its /64) and must evict expired windows, or their maps
grow with every address ever seen.
