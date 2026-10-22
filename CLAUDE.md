# CLAUDE.md

Guidance for Claude Code in this repository. Keep it short: feature detail
belongs in `docs/features/*.md`, conventions in `docs/skills/*/SKILL.md`.

## What this is

Vincent Megia's personal site (replacing vincentmegia.onrender.com): resume,
projects and a set of browser mini-games and tools. Server-rendered Go +
HTMX + Tailwind + PostgreSQL.

## Commands

- `make dev` — build CSS, run the server (`:8081` by default; config via
  defaults → `config.yaml` → `.env` → env vars).
- `make check` — fmt, vet, `go test ./...` (run before committing). The
  DB-gated end-to-end test in `cmd/server/e2e_test.go` skips without
  `DATABASE_URL`, and it writes to (then restores) whatever database
  `DATABASE_URL` points at — never point it at production.
- `npm run test:unit` — the JS game-logic tests (`node --test`).
- `make test-e2e` — Playwright (Chromium + WebKit). It expects the server
  from `make run-e2e` (fake LTA on :8099 via `make fakelta`, bus tables in an
  isolated `bus_e2e` schema). Point it at a running server with
  `E2E_BASE_URL=http://localhost:<port>`.
- `make help` lists everything.

## Architecture

- `cmd/server` (entrypoint, routes in `newMux` on `net/http.ServeMux`),
  `internal/{handler,service,repository,model,config,db}`,
  `web/{templates,static}`, `migrations/` (goose, embedded, run at startup).
- `html/template`: one `base.html` shell plus per-route content templates,
  each owning its `<main id="main-content">` (HTMX swaps it with
  `hx-swap="outerHTML"`); routes with their own content set
  `PageData.ContentTemplate`.
- Games and tools are plain ES modules under `web/static/js/<game>/` with
  pure, DOM-free logic modules (`rules.js`, `engine-state.js`, …) covered by
  `node --test`, and a canvas entry file wiring them up.

## Read before working in an area

- Conventions: `docs/skills/{go-backend,postgres,htmx-ui,tailwind-ui}/SKILL.md`.
- Every feature has `docs/features/<feature>.md` (new ones start from
  `docs/features/template.md`). Read it before touching that feature, and
  verify its claims against the code — these docs have drifted before.

| Feature | Route | Doc |
|---|---|---|
| Site shell, nav, dark mode | all pages | `home.md`, `dark-mode.md` |
| Landing page, carousel | `/` | `landing-page.md`, `landing-carousel.md` |
| Landing content authoring / API | `/settings/content`, `/api/internal/v1/landing/*` | `landing-content-authoring.md`, `landing-content-api.md` |
| Projects grid | `/projects` | `projects.md` |
| Resume, export, authoring | `/resume`, `/resume/download.{pdf,docx}`, `/settings/resume` | `resume.md`, `resume-export.md`, `resume-content-authoring.md` |
| Fishing Game | `/fishing-game` | `fishing-game.md` |
| Kitchen Shift | `/kitchen-shift` | `cooking-game*.md` |
| Puzzle Solver | `/puzzle-solver` | `puzzle-solver.md` |
| Library Shift | `/library-game` | `library-game.md` |
| Hospital Shift | `/hospital-shift` | `hospital-shift.md` |
| Bus Stop Finder | `/bus-stops` | `bus-stop-finder.md` |
| Bus Rush | `/bus-rush` | `bus-rush.md` |
| Easy Diagram | `/easy-diagram` | `easy-diagram.md`, `easy-diagram/BUILD.md` |

## Gotchas

- **Auth is a stub**: `IsAuthenticated` (`internal/handler/auth_stub.go`)
  always returns false, so every `/settings/*` page redirects to a `/login`
  that doesn't exist yet. `/api/internal/v1/*` authenticates by bearer token
  instead and must never use `requireOwnerAuth` (it redirects, not 401).
- **Shared art**: Kitchen Shift and Bus Rush draw people with
  `web/static/js/shared/people.js`; Library Shift reuses Hospital Shift's
  `kimono-himura.js` (Eun-mi), `anime-furniture.js` and `anime-ui.js`
  (and `shadeColor` from `shared/people.js`). A change there shows up in
  every game that imports it. Library's people otherwise have
  their own renderers in `web/static/js/library/` (Min-jun, Ji-ho, the
  staff on `staff-kit.js`, patrons in `patron.js`, Karen).
- **Vendored code**: `web/static/easydiagram/vendor/` is upstream draw.io
  (commit in `vendor/NOTICE`); don't edit it.
- **Resume PDF/DOCX are pure Go** (`fpdf`/`go-docx`, not headless Chrome):
  their layout is Go code, so a `/resume` template change that should appear
  in the exports needs a matching `resume_pdf.go`/`resume_docx.go` change.
- **Full-page-load routes**: `/bus-stops` and `/easy-diagram` have their own
  route CSPs, so `/projects` links them with `FullPageLoad`, not HTMX.
- **Secrets stay server-side**: `LTA_ACCOUNT_KEY`, `HOSPITAL_RUN_SECRET`,
  `LANDING_API_TOKEN`; `GOOGLE_MAPS_API_KEY` must be referrer-restricted.
- **Nav is intentionally partial**: the header has Home/Projects/About +
  Résumé; Blogs, Fishing Game and Puzzle Solver are reachable by URL only.
- **Local dev**: the user's own server runs on `:8080` — never kill or
  restart it; use another port for your own runs, and give parallel
  Playwright runs their own `--output` dir (they clash in `test-results/`).
  Several game specs are timing-sensitive and flake under heavy CPU load.
- **Request hardening** (`newHandlerChain` in `cmd/server/main.go`):
  unsafe-method requests from another site are refused with 403 (Go's
  `CrossOriginProtection`; header-less callers like curl pass), handlers get
  an 8 s deadline, and non-`/api/` bodies are capped at 1 MiB. See
  `docs/skills/go-backend/SKILL.md`.
- **Leaderboards**: scores are client-claimed and only range-checked;
  Hospital Shift alone has signed, single-use run tickets
  (`HOSPITAL_RUN_SECRET`). Game pages expose `window.__*TestHooks` for
  Playwright.
- **Git remotes**: the site is `vincentmegia-origin`; `origin` is a
  template repo — push explicitly to `vincentmegia-origin`.

## Deployment and open items

- Web app on Render (builds with the Go version in `go.mod`); DB on Supabase
  via its **session** pooler (not the transaction pooler or direct
  connection — see `landing-content-api.md`).
- The cutover from vincentmegia.onrender.com (DNS/redirects) isn't planned yet.
- Blogs and About are placeholders. The visual system is "Organic" (cream
  ground, terracotta/sage, Caprasimo + Figtree — `tailwind-ui/SKILL.md`); a
  restyle of page-specific components to it is still open.

Update this file when a decision above changes; keep feature detail in the
feature docs.
