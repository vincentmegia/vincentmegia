---
name: go-backend
description: Build reliable, idiomatic Go backend services for this project — routing, middleware, configuration, error handling, testing and security conventions. Use when adding or changing any server-side Go code.
---

# Go Backend Skill

## Purpose

Build reliable, idiomatic, maintainable Go backend services.

This skill defines general backend engineering practices.

Feature-specific behavior belongs in:

```text
docs/features/
```

---

## Core Principles

Prioritize:

1. Simplicity
2. Correctness
3. Explicit behavior
4. Small, focused components
5. Testability
6. Observability
7. Security
8. Maintainability

Prefer the standard library unless a dependency provides significant value.

Do not introduce abstractions without a concrete reason.

---

## Project Structure

Prefer a simple structure:

```text
cmd/
└── server/
    └── main.go

internal/
├── handler/
├── service/
├── repository/
├── model/
└── config/

web/
├── templates/
└── static/
```

Keep package responsibilities clear.

### Handler

Responsible for:

* HTTP request parsing
* Authentication/authorization checks
* Input validation
* Calling services
* HTTP response rendering

### Service

Responsible for:

* Business logic
* Application workflows
* Validation that depends on business rules
* Coordinating repositories and external services

### Configuration
* Reading structured, non-secret defaults from an optional `.yaml` file
* Parsing and overlaying configuration from environment variables (secrets
  and per-deployment overrides — always take precedence over the file)
* Validating configuration, failing fast on missing/invalid required values

See the "Configuration" section below for the full file/env layering
convention.

### Repository

Responsible for:

* Database access
* Persistence queries
* Mapping database records

Do not put business logic in repositories.

---

## Routing

Prefer the standard library `net/http.ServeMux`. Since Go 1.22 it supports method
matching and wildcard path segments, which covers most routing needs without a
third-party dependency:

```go
mux := http.NewServeMux()
mux.HandleFunc("GET /devices/{id}", h.Get)
mux.HandleFunc("POST /devices/{id}/wake", h.Wake)
```

Only introduce a router dependency (e.g. `chi`) when a concrete requirement
exceeds what `ServeMux` provides (complex middleware composition, sub-routers).
Do not add one preemptively.

---

## HTTP Server Configuration

`http.Server` has no timeouts by default — an unconfigured server is vulnerable to
slow-client resource exhaustion (Slowloris-style). Always set explicit timeouts:

```go
srv := &http.Server{
    Addr:              addr,
    Handler:           mux,
    ReadHeaderTimeout: 5 * time.Second,
    ReadTimeout:       10 * time.Second,
    WriteTimeout:      10 * time.Second,
    IdleTimeout:       120 * time.Second,
}
```

Adjust `WriteTimeout` upward for endpoints that legitimately stream long responses.

---

## Middleware

Compose cross-cutting concerns as middleware rather than repeating them in every
handler: Recover, Request ID, Logging, Timeout, Body cap, Cross-origin writes.
This app's chain is `cmd/server/main.go`'s `newHandlerChain`.

See `references/middleware.md` for the full chain, examples and rate-limiter rules.

---

## Security Headers

Set response security headers on every response, not per-handler:

```text
Content-Security-Policy: default-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'; frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=63072000; includeSubDomains
```

This matters more than usual here because HTMX swaps server-rendered HTML directly
into the DOM — a strict CSP is a meaningful defense-in-depth layer against XSS,
alongside the escaping already required in `htmx-ui`. A route that needs a
looser policy (Bus Stop Finder's Maps page, Easy Diagram) replaces it with its
own, keeping `base-uri`/`form-action`/`object-src`/`frame-ancestors`.

`/static/` is served through `staticFS`, which 404s directories (no listings)
and any path segment starting with `.`.

---

## Health Checks

Expose a lightweight, unauthenticated health endpoint:

```text
GET /healthz  → 200 once the process can serve traffic (and, ideally, can reach the database)
```

Hosting platforms (Render, Fly.io) use this for process supervision and zero-downtime
deploys. Keep it fast and dependency-light — it should not itself become a source of
cascading failure.

---

## HTTP

Use standard HTTP semantics.

```text
GET     → read
POST    → create/action
PUT     → replace
PATCH   → partial update
DELETE  → delete
```

Use appropriate HTTP status codes.

Examples:

```text
200 OK
201 Created
204 No Content
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Unprocessable Entity
500 Internal Server Error
```

Do not return `200 OK` for every outcome.

---

## Handlers

Keep handlers small.

Prefer:

```go
func (h *DeviceHandler) Wake(w http.ResponseWriter, r *http.Request) {
    deviceID, err := parseDeviceID(r)
    if err != nil {
        http.Error(w, "invalid device", http.StatusBadRequest)
        return
    }

    if err := h.service.Wake(r.Context(), deviceID); err != nil {
        h.renderError(w, err)
        return
    }

    h.renderDevice(w, deviceID)
}
```

Avoid putting business logic directly inside HTTP handlers.

---

## Context

Always propagate request context through application layers.

Prefer:

```go
service.Wake(ctx, deviceID)
```

rather than creating new background contexts unnecessarily.

Use context for:

* Cancellation
* Deadlines
* Request-scoped values where appropriate

Do not use context as a general-purpose parameter bag.

---

## Errors

Handle errors explicitly.

Prefer wrapping errors with useful context:

```go
return fmt.Errorf("wake device %d: %w", deviceID, err)
```

Use sentinel or typed errors when callers need to distinguish error conditions.

For example:

```go
var ErrDeviceNotFound = errors.New("device not found")
```

Do not expose internal errors directly to users.

Map internal errors to appropriate HTTP responses.

`%w`-wrapping is the default, but check what the wrapped error's own
`Error()` string contains before doing it to an error built from
secret-bearing input — the resulting message ends up in `slog` output via
whatever eventually logs the chain, not just in the immediate return
value. `net/url`'s parse error is a concrete example that bit this
project: it embeds its *entire* input string verbatim, so wrapping it
around a malformed `DATABASE_URL` would log the database password
(`internal/db/db.go`'s `withStatementTimeouts`, deliberately *not*
`%w`-wrapping for this reason). When a value passed to `fmt.Errorf`/
`errors.New` might itself be a secret or contain one, build a fixed,
secret-free message instead of trusting a library error's `Error()` text
to have redacted it.

---

## Validation

Validate input at system boundaries.

Examples:

* HTTP requests
* Database input
* External API responses
* Configuration

Do not rely exclusively on frontend validation.

Frontend validation improves UX.

Backend validation provides correctness and security.

---

## Concurrency

Use goroutines only when they provide a clear benefit.

Always consider:

* Cancellation
* Error propagation
* Resource lifetime
* Data races
* Goroutine leaks

Prefer structured concurrency patterns.

Do not create background goroutines from request handlers without understanding their lifecycle.

---

## External Commands

Never pass arbitrary user input directly to command execution. Prefer controlled
arguments derived from validated configuration, with context and error checking.

See `references/external-commands.md` for examples and rules.

---

## Configuration

Layered: defaults → `config.yaml` → `.env` → real environment variables.
Never put secrets in the YAML file. Fail fast on missing required values.

See `references/configuration.md` for the full layering convention, examples
and library choices.

---

## Logging

Use structured logging where practical.

Log useful operational information:

```text
timestamp
level
operation
request_id
device_id
result
error
duration
```

Do not log:

* Passwords
* Tokens
* API keys
* Session secrets
* Sensitive personal data

Use appropriate log levels:

```text
DEBUG
INFO
WARN
ERROR
```

---

## Testing

Test behavior, not implementation details.

Prioritize:

* Services
* Validation
* Critical handlers
* Device operations
* Error handling

Use table-driven tests where they improve clarity.

Example:

```go
func TestValidateDevice(t *testing.T) {
    tests := []struct {
        name    string
        input   Device
        wantErr bool
    }{
        // ...
    }

    // ...
}
```

Use dependency injection where it makes external operations testable.

Do not introduce a dependency-injection framework.

---

## Database Access

Database access belongs in repositories.

Use parameterized queries.

Never construct SQL using string concatenation with user input.

Prefer:

```go
db.QueryContext(
    ctx,
    `SELECT id, name FROM devices WHERE id = $1`,
    id,
)
```

---

## Graceful Shutdown

The HTTP server should support graceful shutdown.

On shutdown:

1. Stop accepting new requests.
2. Allow active requests to complete.
3. Close resources.
4. Exit cleanly.

Database connections and other long-lived resources must be closed appropriately.

---

## Code Quality

Before completing backend changes, run:

```bash
make check
```

which wraps the underlying commands (see the `Makefile` at the repo root —
`make help` lists every target, including `run`/`dev` for local development
and `css`/`css-watch` for the Tailwind build):

```bash
gofmt -w .
go test ./...
go vet ./...
```

If the project has additional linting configured, run it.

Keep functions and packages focused.

Avoid premature abstractions.

---

## Feature Docs Are Part of the Change

Every feature has a doc under `docs/features/<feature>.md`. A requirement
change is not finished until that doc describes what the code now does.

* Read the doc before touching the feature, and verify its claims against the
  code — these docs have drifted before.
* Update it in the same commit as the behavior change: added, changed or
  removed requirements, routes, markup structure, and the reason behind a
  non-obvious choice.
* A change spanning several features updates each of their docs.
* A new feature starts from `docs/features/template.md` and gets its row in
  the table in `CLAUDE.md`.
* "Code works, doc not updated yet" is incomplete work, not a follow-up task.

## Definition of Done

Backend work is complete when:

* Behavior is correct.
* Errors are handled.
* Input is validated.
* Security concerns are addressed, including response security headers.
* `http.Server` has explicit timeouts configured.
* A panic in one handler cannot take down the process.
* Tests cover important behavior.
* Context cancellation is respected where relevant.
* Logs provide sufficient operational visibility.
* Code is formatted.
* `go test ./...` passes.
* `go vet ./...` passes.
* The feature's `docs/features/<feature>.md` is updated in the same commit.

