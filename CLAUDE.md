# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Active development. Implemented and covered by tests, each with its own
`docs/features/*.md` for the full detail — read the relevant doc before
touching that area rather than expecting this section to carry it:

- **Site shell** (header/nav/footer, mobile nav, dark mode) —
  `docs/features/home.md`. Header nav is a flat Home/Projects/About link
  row plus a Résumé button, not a dropdown (`internal/handler/nav.go`'s
  `primaryNavItems`); Settings is a separate auth-gated dropdown
  (Profile/Content/Resume/Security/Logout).
- **Resume** (Postgres-backed `/resume`) — `docs/features/resume.md`.
- **Resume Export** (`/resume/download.pdf` and `.docx`, plus browser
  Print) — `docs/features/resume-export.md`. Both files are generated in
  pure Go (`fpdf`/`go-docx`), deliberately *not* headless Chrome: a
  chromedp version shipped broken on Render (no Chrome binary) behind
  tests that only ever used a fake renderer — see that doc's Decision.
  The PDF's layout is Go code, so resume template changes that should
  show in the PDF need a matching `resume_pdf.go` change.
- **Resume Content Authoring** (`/settings/resume`: edit every card on
  `/resume` — banner, sidebar, summary, experience timeline — plus an
  independent font-preset choice per card, without a redeploy) —
  `docs/features/resume-content-authoring.md`. Code-complete and verified
  against a real database, but unreachable in production — see the auth
  note below.
- **Landing page** (`/`: hero, image carousel, "Selected work" card grid) —
  `docs/features/landing-page.md`, `docs/features/landing-carousel.md`.
- **Fishing Game** (`/fishing-game`, canvas mini-game, Postgres
  leaderboard, `localStorage` gear/tokens) —
  `docs/features/fishing-game.md`.
- **Kitchen Shift** (`/kitchen-shift`, canvas restaurant-shift sim,
  Postgres leaderboard, `localStorage` progress) —
  `docs/features/cooking-game.md` (plus `cooking-game-food-server.md`/
  `cooking-game-customer.md`/`cooking-game-kitchen.md`/
  `cooking-game-food-server-leveling.md`). v4 restyled it to match Library Shift and
  ported Library's Coffee Pour, hallucinations, 0-stat penalties and
  Gard counter. Both games draw people with
  `web/static/js/shared/people.js`, so a character-art change there
  shows up in both.
- **Puzzle Solver** (`/puzzle-solver`, client-side DFS pathfinding
  visualizer, no DB/leaderboard) — `docs/features/puzzle-solver.md`.
- **Library Shift** (`/library-game`, two-floor canvas library-shift sim —
  shelving/fines/borrow-request minigames, a scripted Karen event, Postgres
  leaderboard, `localStorage` progress) — `docs/features/library-game.md`.
- **Bus Stop Finder** (`/bus-stops`: geolocation or a 6-digit postal code
  (geocoded server-side via OneMap) → 5 nearest Singapore bus stops on a
  Google Map + live LTA DataMall arrivals, live bus positions and a
  per-bus "where this bus goes" route view, HTMX-polled every
  20 s; nightly LTA sync into Postgres) — `docs/features/bus-stop-finder.md`.
  The LTA key stays server-side; the page has its own nonce CSP only when
  `GOOGLE_MAPS_API_KEY` is set, so it must be reached by a full page load
  (its `/projects` card uses `FullPageLoad`, not an HTMX nav). Playwright
  uses the fake LTA in `cmd/fakelta` via `make run-e2e`, which also puts
  the bus tables in an isolated `bus_e2e` schema so the fake fixtures never
  mix with real synced LTA data in the default schema (the sync's 50% guard
  would refuse that swap anyway). Production needs `LTA_ACCOUNT_KEY` and a
  referrer-restricted `GOOGLE_MAPS_API_KEY` provisioned.
- **Bus Rush** (`/bus-rush`, top-down canvas driving game — flee the police
  in a stolen bus (lethal pursuit cars, roadblocks, wanted level) through
  six districts/levels (CBD → Changi → Sentosa), four buyable buses, oncoming
  school buses and lethal city/double-decker/bendy buses and coaches, lethal
  tow, container, refrigerated, flatbed, fire, ladder, crane, heavy haul, car
  carrier and animal transporter trucks (runaway steel-coil flatbeds swerve
  at you, some semis haul an excavator or loader on a lowboy) and lorries,
  bananas that
  skid you and garbage that slows you, fuel tankers and gasoline-laden
  trucks/semis that stun you then explode (a WASTED cutscene to Alcatraz
  if you don't get clear), cement mixers you drift into (mouse drag) to tip onto the
  police (or get flattened by), ramp trucks that launch you onto an MRT
  viaduct with trains for 50 s, storms with puddles, a SNOWED event (icy roads, lethal snowplows and wheel loaders), Sentosa sand drifts,
  construction zones with dump trucks and mixers, potholes, jaywalkers (not on the
  Expressway), a dark Changi, power-ups (Nitro/Shield/Magnet/EMP), a
  SWAT van at 4★ and a spike-dropping helicopter at 5★, missions and
  achievements, dodge oncoming traffic, collect fares, buy
  Engine/Steering/Bumpers/Fare Box/Ram Plating upgrades; a seeded Daily
  Challenge (stock bus, UTC day) with its own board;
  Postgres leaderboard, `localStorage` progress) — `docs/features/bus-rush.md`.
  Rules/tuning live in `web/static/js/busrush/rules.js`; its `/projects`
  card screenshot is `web/static/images/busrush/screenshot.png`.
- **Hospital Shift** (`/hospital-shift`, canvas ER-nurse shift sim mirroring
  Library Shift — triage the queue into 4 beds, then treat each patient's
  plan: Vitals/IV/Surgery skill checks (surgery in a walk-in OR room, with
  a scalpel plus an organ for transplants or an implant from the Supply
  Room, each grabbed with a skill check), Oxygen find-the-hearts, a Bandage
  trace with a roll from the 2nd-Floor Supply Room's cart, Meds from the
  cabinet; helping staff (Dr. Okafor rescues near-transfer patients, the
  Orderly wheels surgery patients to the OR, the Stock tech brings rolls
  down); Karen, Coffee Pour, hallucinations; Hunger/Thirst (vending
  machine snacks for Gard, a walk-in Cafeteria where Auntie Yumi's meal is
  free, uncomfortable under 25%, collapse after 5 s at 0%); night shifts
  (every 5th) with a dark ER and a battery flashlight (F); 64 patient
  designs (incl. a highly detailed maiko, Hiko Maiko); extra staff
  (janitor's wet floor, receptionist, Security for Karen, pharmacist) and
  visitors (a lost child, the hospital cat, celebrity patients); Security
  (a CCTV desk, a night guard, rowdy-visitor/thief incidents you send a
  guard to); leaderboard anti-cheat (signed single-use run tickets from
  `POST /hospital-shift/run`, a minimum real-time check against the shift
  clock and a per-shift earnings cap; set `HOSPITAL_RUN_SECRET` in
  production); an easter egg — Mel in a
  dandelion kimono visits with a card (rare arrival, shift 7, five clicks on
  the back-wall vase, or typing "mel"); a 10-rank nurse career (a perk
  per rank, `rules.js` §3c); a seeded Daily Challenge (one UTC-day shift
  with a rotating twist, `rules.js` §3d) with its own leaderboard tab
  (migration 012 adds `hospital_scores.daily_date`); Postgres leaderboard; no saved progress —
  leaving the page in any way, refresh included, resets everything to
  shift 1) — `docs/features/hospital-shift.md`. Rules live
  in `web/static/js/hospital/rules.js`. Everyone in it is drawn by its own
  anime-style renderers — the player (Kimono Himura) by
  `hospital/kimono-himura.js`, patients, staff and Karen by
  `hospital/anime-people.js` — not the shared `people.js`. The whole game
  (ER, minigame screens, HUD, labels) is drawn in an anime UI style from
  `hospital/anime-ui.js`, and its page has its own anime theme
  (`.hospital-anime`/`ha-*` classes in `app.css`) instead of the site's
  Organic look.
- **Projects** (`/projects` card grid: Fishing Game, Kitchen Shift, Puzzle
  Solver, Library Shift, Bus Stop Finder, Bus Rush, Hospital Shift) —
  `docs/features/projects.md`.
- **Content Authoring** (`/settings/content`: edit the landing page's
  hero/carousel/Selected work without a redeploy, Postgres-backed) —
  `docs/features/landing-content-authoring.md`. Code-complete but
  unreachable — see the auth note below.
- **Landing Content API** (`/api/internal/v1/landing/*`: bearer-token JSON
  API over the same three tables, so the separate `home-admin` dashboard
  can edit content without holding database credentials) —
  `docs/features/landing-content-api.md`. Site side implemented; not yet
  verified against a real database, and the Render reconfiguration it
  exists to enable is still outstanding.

Cross-cutting notes worth knowing before touching any of the above:

- **Auth is a stub**: `IsAuthenticated` (`internal/handler/auth_stub.go`)
  always returns `false`, so every `/settings/*` route redirects to a
  `/login` that doesn't exist yet. Any new auth-gated feature is
  code-complete but unreachable until the real authentication feature
  lands. The JSON API under `/api/internal/v1/` is the one exception — it
  authenticates machine callers by bearer token instead and must never
  use `requireOwnerAuth`, which redirects rather than returning 401.
- **Nav rollout is gradual and intentional, not a bug**: Blogs and Fishing
  Game are reachable only by direct URL (`/blogs`, `/fishing-game`), not
  linked from the header; Puzzle Solver isn't in the header nav either.
- **Visual design system** is "Organic" (warm cream ground, terracotta/
  sage accents, Caprasimo + Figtree), pulled from a claude.ai/design
  project and adapted into Tailwind tokens — see
  `docs/skills/tailwind-ui/SKILL.md`'s Visual Style. A from-scratch
  restyle of page-specific components (resume, fishing game, carousel) to
  the new tokens is still open.
- Blogs and About are still placeholders.

Update this file as decisions are made or change.

## What this is

A personal website for Vincent Megia, replacing the current resume site at vincentmegia.onrender.com. The new site keeps the resume content but expands into a fuller personal site, and links out to the original projects (including the current resume site itself) rather than reimplementing them.

## Planned content

- **Bio / About** — personal background, more than a resume covers
- **Resume** — the content currently on vincentmegia.onrender.com
- **Projects** — work in progress and past projects, linking out to their live/original locations where applicable
- **Personal interests** — a section outside of the professional/resume content

## Tech stack

- **Backend**: Go
- **Frontend interactivity**: HTMX (server-rendered HTML, no separate JS frontend framework)
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL

## Skills and feature docs

Detailed, opinionated engineering conventions live in `docs/skills/` — read the
relevant one(s) before writing code in that area:

- `docs/skills/go-backend/SKILL.md` — Go backend structure, HTTP, security, testing
- `docs/skills/postgres/SKILL.md` — schema, migrations, queries, connection handling
- `docs/skills/htmx-ui/SKILL.md` — HTMX interactions, layout/template architecture
- `docs/skills/tailwind-ui/SKILL.md` — Tailwind design system and visual conventions

Every non-trivial feature should have a doc in `docs/features/`, based on
`docs/features/template.md`, describing its scope, UX, routes, data model, and
definition of done. Create one before implementing a new feature.

## Architecture plan

Server-rendered Go application: Go handlers render HTML via `html/template`,
HTMX handles partial page updates/interactivity without a client-side
framework, Tailwind provides styling, Postgres stores structured content
(e.g. resume entries — see `docs/features/resume.md`'s Data Model) so it can
be edited without redeploying static content.

Decided and in place:

- **Package layout**: `cmd/server` (entrypoint), `internal/{handler,service,
  repository,model,config,db}`, `web/{templates,static}`, `migrations/` — see
  `docs/skills/go-backend/SKILL.md`'s Project Structure.
- **Routing**: standard library `net/http.ServeMux` (Go 1.22+ method+pattern
  routing), registered in `cmd/server/main.go`'s `newMux`.
- **Templating**: `html/template`, one shared `base.html` shell + per-route
  content templates, each owning its own `<main id="main-content">` wrapper
  (required by `hx-swap="outerHTML"` — see `docs/features/home.md`'s HTMX
  Interactions). A route with real content beyond the shared placeholder sets
  `PageData.ContentTemplate`; see `docs/features/resume.md`'s Template
  Rendering section for why that dispatch happens in Go code, not the
  template itself.
- **Configuration**: layered defaults → optional `config.yaml` → optional
  `.env` → real environment variables, the last always winning. See
  `docs/skills/go-backend/SKILL.md`'s Configuration section,
  `config.example.yaml`, `.env.example`.
- **Migrations**: `goose`, embedded via `migrations/embed.go` and run
  automatically at server startup — see `docs/features/resume.md`'s Open
  Questions for why that's flagged as worth revisiting once Hosting is
  decided.
- **Build/dev tooling**: `Makefile` (`make help` lists targets) wraps Go and
  npm (Tailwind CLI) commands consistently — see
  `docs/skills/go-backend/SKILL.md`'s Code Quality section.
- **Testing**: `go test ./...` (includes a DB-gated end-to-end test in
  `cmd/server/e2e_test.go`, skipped without `DATABASE_URL`) plus a Playwright
  frontend suite in `e2e/` (`make test-e2e`), run against both Chromium and
  WebKit — the latter matters concretely, since it's already caught a real
  Safari-only bug (`docs/features/home.md`'s Business Rules).

## Open decisions

- **Hosting**: target is Vercel, but the stack is Go + Postgres. Vercel's Go support is serverless-function based, which has implications for persistent Postgres connections (pooling) and any long-lived server process — verify this fits before committing, or pick an alternative host (e.g. Render, Fly.io) that fits a standard Go server model more naturally.
- ~~**Database hosting**: needs a Postgres provider if not self-hosted~~ —
  **Decided: Supabase**, connected via its session pooler (not the
  transaction pooler/Supavisor, and not the direct connection — see
  `docs/features/landing-content-api.md`'s Status for why those two modes
  are a real risk with this app's `pgx`/`options`-param usage). The web
  app itself stays on Render; database and web service are no longer
  co-located, which is why `docs/features/landing-content-api.md`'s
  original "move to Render's internal connection string" plan is now
  permanently unavailable rather than pending — see that doc's
  Problem/Motivation and Decision 1.
- **Migration plan**: how/when vincentmegia.onrender.com gets replaced by the new site (DNS cutover, redirect, etc.) is not yet defined.
