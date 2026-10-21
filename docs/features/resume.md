# Feature: Resume

## Status

`Shipped`. Runs against a real Postgres instance (Supabase, see CLAUDE.md's
Open Decisions). Content is edited from `/settings/resume`
(`resume-content-authoring.md`), which is code-complete but not reachable
until real auth exists. The PDF/Word downloads are covered in
`resume-export.md`.

Tests:

* Unit (no DB): `go test ./internal/service ./internal/handler`, which
  covers `resume_service_test.go`, `resume_view_test.go`,
  `resume_links_test.go` and `template_test.go`.
* DB-gated end to end: `go test ./cmd/server` (`e2e_test.go`). It is
  skipped when there is no `DATABASE_URL` or `.env`.
* Browser: `make test-e2e` runs `e2e/resume.spec.js` in Chromium and
  WebKit.

## Summary

The `/resume` page has three parts:

* A dark banner: name, title, tenure and location, and contact links.
* A sidebar: Core Expertise, Education and Featured Projects.
* A main column: the summary and a stat row, then an experience timeline
  with nested sub-project and client entries.

All of it comes from Postgres, so content changes need no redeploy. The
page also has a print-friendly layout and an export row (Download PDF,
Download Word, Print).

## Problem / Motivation

Resume content is named in CLAUDE.md's Planned Content. It is the page most
visitors of a site built to replace `vincentmegia.onrender.com` will
actually read. The site can't replace the old resume site without it.

## Scope

**In scope:**

* Banner: name, role title, tenure label, location label, and contact
  links (phone, email, personal site, GitHub, LinkedIn, LeetCode), each
  with an icon from an allowlist.
* Sidebar: Core Expertise (grouped skill pills), Education
  (degree/school/years), and Featured Projects, which always ends with a
  "See all projects" link to `/projects`.
* Main column: summary paragraphs (with `**bold**` markup only) and a stat
  row, then the experience timeline. Each role card shows title,
  company — location, a date range, a "Current" badge, a blurb, bullets
  and nested sub-projects (heading, optional client tag, blurb, bullets).
* The Postgres schema and seed (`migrations/001_create_and_seed_resume.sql`)
  plus the per-card `font_style` columns (`006_add_resume_authoring.sql`,
  owned by `resume-content-authoring.md`).
* The per-route `ContentTemplate` rendering mechanism (see Template
  Rendering), which this feature introduced.
* `GET /healthz` checking DB connectivity.
* A print stylesheet and the export row (see `resume-export.md` for the
  downloads).

**Out of scope:**

* Editing content. That is `resume-content-authoring.md` (`/settings/resume`).
* The `/projects` page and its data. This feature only links to it and
  keeps its own small featured-projects list.

---

## User Flow

```text
1. User opens /resume: the header's Résumé button (an HTMX nav swap into
   #main-content), a direct URL, or a reload.
2. The page renders the export row (Download PDF / Download Word / Print),
   then the banner, then the sidebar and main column. Below lg the sidebar
   stacks above the main column.
3. User reads the timeline in sort_order (most recent role first in the
   seed). Each role shows its bullets and any nested sub-projects.
4. Contact and featured-project links open in a new tab. "See all
   projects" is an HTMX nav swap to /projects.
5. Print → window.print() with the @media print stylesheet. The Download
   links fetch the generated files (resume-export.md).
```

---

## Visual Direction

Tokens are in `web/static/css/app.css`'s `@theme` block. Their values
follow the Organic design system (`docs/skills/tailwind-ui/SKILL.md`'s
Visual Style).

* Neutrals: `--color-ink`, `--color-muted`, `--color-line`,
  `--color-paper`, `--color-surface`, `--color-surface-2`.
* `--color-primary` (terracotta) is used for links, company names and stat
  numbers. `--color-accent` (sage) is used for bullet markers, the
  "Current" badge and the current role's timeline dot.
* `--color-banner-bg` (Organic accent-900), `--color-banner-ink`,
  `--color-banner-muted` and `--color-banner-accent` make the banner a
  fixed dark surface in both site themes. It has no `dark:` overrides.
* Every card uses `--radius-card` and a `shadow-sm`.
* Timeline connector: one vertical line (`resume-timeline.html`) runs
  through a dot per role (`resume-role.html`). The current role's dot has
  an accent border and fill. It is decorative (`aria-hidden`) and is
  hidden below `sm`.
* Each card's wrapper carries a `resume-font-*` class chosen per card (see
  `resume-content-authoring.md`'s Font Presets). The default is
  `resume-font-organic`.

---

## UI

```text
web/templates/pages/
└── resume.html            # {{define "resume-content"}}: owns <main id="main-content">,
                           # the export row, and loads resume-print.js
web/templates/components/
├── resume-banner.html     # name (hardcoded "Vincent Megia"), title, tenure · location, contact links
├── resume-sidebar.html    # Core Expertise, Education, Featured Projects (#resume-sidebar)
├── resume-summary.html    # summary paragraphs + stat <dl>
├── resume-timeline.html   # connector line + range over roles
└── resume-role.html       # one role card, root id #resume-role-{id}
web/static/css/app.css     # tokens, resume-font-* classes, @media print block
web/static/js/resume-print.js   # Print button → window.print()
```

| State   | Behavior (as implemented) |
| ------- | ------------------------- |
| Default | Every card renders from `resume_profile`/`resume_roles`. |
| Loading | An HTMX nav swap uses the shell's `#nav-loading` indicator. There is no page-specific indicator. |
| Empty   | Core Expertise and Education are omitted entirely when they have no entries. Featured Projects always renders its card (heading + "See all projects"), with no entries list when it is empty. The banner always renders; the contact list is omitted when empty. The summary card always renders; its paragraphs and stats blocks are each omitted when empty, so if both are empty the card is an empty shell. The timeline section always renders; with zero roles it shows nothing. Inside a role, location, blurb, bullets and sub-projects are each omitted when empty. |
| Error   | A DB error, or a JSONB value that fails to decode, renders the shared placeholder content with title "Resume" and the message "Couldn't load this page. Please try again shortly." (`ResumeHandler.Index`). The response is still HTTP 200. The raw error is logged only. |
| Print   | Header, nav-loading bar, footer and the export row are hidden. The light palette is forced. Role and sub-project cards avoid page breaks (`app.css` `@media print`). |

---

## Template Rendering

`PageData.ContentTemplate` names the content template to run. An empty
value defaults to the shared placeholder `"content"` in `Renderer.Render`
(`internal/handler/template.go`). The fragment path (`HX-Request: true`)
runs that template directly. The full-page path pre-renders it into
`PageData.RenderedContent` and then runs `"base"`. `resume.html` defines
`"resume-content"` so it doesn't override the placeholder that other
routes use. `LoadTemplates` parses an explicit file list, not a glob, so
every new `resume-*` file must be added there. A missing file fails at
startup.

`resume-content` renders its own `<main id="main-content" class="mx-auto
max-w-5xl px-4 py-8">`. This is required because nav swaps use
`hx-swap="outerHTML"` (`home.md`'s HTMX Interactions).

---

## HTMX Interactions

| Trigger | Method | Endpoint | Target | Swap | Indicator |
| ------- | ------ | -------- | ------ | ---- | --------- |
| Header Résumé button (owned by `home.md`) | GET | `/resume` | `#main-content` | `outerHTML`, push URL | `#nav-loading` |
| "See all projects" | GET | `/projects` | `#main-content` | `outerHTML`, push URL | `#nav-loading` |

Print is a plain button handled by `resume-print.js`. The downloads are
plain `<a href>` links. No destructive actions.

---

## Routes / Handlers

| Method | Path      | Handler               | Auth | Notes |
| ------ | --------- | --------------------- | ---- | ----- |
| GET    | `/resume` | `ResumeHandler.Index` (`internal/handler/resume.go`) | no | Full page or fragment depending on `HX-Request`. |
| GET    | `/healthz` | `HealthHandler.Index` (`internal/handler/health.go`) | no | Pings the DB with a 2 s timeout. Returns `ok` (200) or `unavailable` (503). The driver error is logged, never returned. |

The export routes are listed in `resume-export.md`, and the
`/settings/resume/*` routes in `resume-content-authoring.md`. All of them
are registered in `cmd/server/main.go`'s `newMux`. One `ResumeService` is
shared by `ResumeHandler`, `ResumeAdminHandler` and `ResumeExportHandler`.

---

## Data Model

Two tables, created and seeded in `migrations/001_create_and_seed_resume.sql`
and widened with `*_font_style` columns in
`migrations/006_add_resume_authoring.sql`. Lists are stored as JSONB
rather than normalized, because each section is always read and written
as a whole and there is only one resume.

| Table | Column | Type | Constraints | Notes |
| ----- | ------ | ---- | ----------- | ----- |
| resume_profile | id | BIGINT | PK, `DEFAULT 1 CHECK (id = 1)` | singleton |
| resume_profile | role_title, tenure_label, location_label | TEXT | NOT NULL | |
| resume_profile | contact_links | JSONB | NOT NULL | `[{label, href, icon}]` |
| resume_profile | summary_paragraphs | JSONB | NOT NULL | `[string]`, may contain `**bold**` |
| resume_profile | stats | JSONB | NOT NULL | `[{num, label}]` |
| resume_profile | skill_groups | JSONB | NOT NULL | `[{name, skills: [string]}]` |
| resume_profile | education | JSONB | NOT NULL | `[{degree, school, start_year, end_year}]` |
| resume_profile | featured_projects | JSONB | NOT NULL | `[{name, description, links: [{label, href}]}]` |
| resume_profile | banner/sidebar_expertise/sidebar_education/sidebar_featured_projects/summary `_font_style` | TEXT | NOT NULL DEFAULT 'organic', CHECK in 4 keys | migration 006 |
| resume_profile | updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| resume_roles | id | BIGSERIAL | PK | |
| resume_roles | title, company | TEXT | NOT NULL | |
| resume_roles | location, blurb | TEXT | nullable | |
| resume_roles | start_date | DATE | NOT NULL | |
| resume_roles | end_date | DATE | nullable | NULL = current |
| resume_roles | bullets | JSONB | NOT NULL DEFAULT '[]' | `[string]` |
| resume_roles | subprojects | JSONB | NOT NULL DEFAULT '[]' | `[{heading, client_tag, blurb, bullets}]` |
| resume_roles | sort_order | INTEGER | NOT NULL | display order |
| resume_roles | font_style | TEXT | NOT NULL DEFAULT 'organic', CHECK | migration 006 |
| resume_roles | created_at, updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

There are no indexes beyond the primary keys. The profile is always read
by id = 1, and roles are always read in full `ORDER BY sort_order`.

**JSONB decoding**: no `CHECK` constraint enforces the inner shape of the
JSONB values. `ResumeRepository.GetProfile`/`ListRoles` return an error
only when `json.Unmarshal` fails, meaning invalid JSON or a type mismatch
(for example an object where an array is expected). Those errors reach the
Error state. A **missing or misspelled key does not error**: it decodes
to a Go zero value and renders as blank. A stat with no `num`, for
example, shows an empty number. Writes made through `/settings/resume` are
validated (`resume-content-authoring.md`). Hand-written SQL is not.

**Layers**:

* `ResumeRepository` (`internal/repository/resume_repository.go`) has
  `GetProfile` and `ListRoles`: two fixed queries on `ReadDB`.
* `ResumeService.Get` (`internal/service/resume_service.go`) calls
  `fetch`, then `buildResumeView`. That step:
  * formats each role's `DateRange` ("APR 2021 – PRESENT") from the DATE
    columns;
  * sets `IsCurrent` (`end_date IS NULL`);
  * resolves icon keys through the `contactIcons` allowlist (`resolveIcon`)
    and hrefs through `safeHref`;
  * converts summary paragraphs with `boldMarkup`;
  * resolves font keys through `resolveFontClass`.

---

## Business Rules / Validation

* `resume_profile` always has exactly one row (`CHECK (id = 1)`).
* Roles display in `sort_order`. They are never re-sorted by date.
* `end_date IS NULL` is the only "current" signal. Such a role gets the
  "Current" badge, "PRESENT" in its date range, and the accent dot.
* Summary paragraphs support only `**text**` → `<b>text</b>`.
* The Featured Projects card always ends with "See all projects" →
  `/projects`, even with zero projects.
* The name "Vincent Megia" is hardcoded in `resume-banner.html` (and in
  the PDF/DOCX generators). It is not a DB field.
* A role's location shows as "Company — Location". With no location, only
  the company shows.
* Contact links with an allowed href, and every featured-project link,
  open with `target="_blank" rel="noopener noreferrer"`.
* Contact icon keys: `phone`, `mail`, `globe`, `branch`, `network`,
  `bars`. An unknown key renders the contact with no icon.
* The seeded contact links include a phone number (`tel:` link). Whether
  it may be published is an open owner decision (see Open Questions).

---

## Security Considerations

* **Authz**: `/resume` and `/healthz` are public.
* **Escaping**: all DB content goes through `html/template`
  auto-escaping. The only exceptions are the two trusted values below.
* **`**bold**` markup**: `parseBoldSegments` splits the raw text.
  `boldMarkup` HTML-escapes each segment and then wraps bold segments in
  literal `<b>`/`</b>`. Only that assembled string becomes
  `template.HTML`. Escaping happens before wrapping, which is the security
  mechanism (`TestBoldMarkup`).
* **Icons**: DB values are lookup keys only. The SVG is Go source
  constants.
* **Contact-link hrefs**: `linkableHref` allows only `https://`,
  `http://`, `mailto:` and `tel:`. An allowed href reaches the banner as
  `template.URL` via `safeHref`. Without that, `html/template` would
  rewrite `tel:` to `#ZgotmplZ`. Any other href becomes `""`, and the
  label renders as plain text. The banner form rejects such hrefs on save
  (`ErrContactLinkHrefInvalid`), and the PDF/DOCX use the same rule.
  `featured_projects[].links[].href` renders as a plain string attribute
  (site-relative links are allowed), so `html/template`'s URL filter
  neutralizes unsafe schemes.
* **Print**: `resume-print.js` is an external file with no inline
  handlers, which keeps it compatible with the CSP.
* **Secrets**: `DATABASE_URL`, plus the optional `DATABASE_READONLY_URL`,
  come from env/`.env` only.
* **Least-privilege reads**: every repository holds `DB` (writes and
  migrations) and `ReadDB` (reads). `ReadDB` falls back to the `DB` pool
  when `DATABASE_READONLY_URL` is unset (`cmd/server/main.go`'s `run`).
  Production points `ReadDB` at a `site_reader` role that was verified
  live: it can read but gets `permission denied` on writes. `DB` keeps
  full privileges because `/settings/resume` writes.
* **`/healthz`** never returns the driver error, the connection string or
  the host.

---

## Testing Plan

* [x] `/resume` renders the seeded banner, sidebar, summary, timeline,
      sub-projects and "See all projects": `cmd/server/e2e_test.go`
      "resume page renders real seeded content end to end",
      `e2e/resume.spec.js` "renders banner, sidebar, summary, and
      timeline" and "experience roles expose nested sub-projects".
* [x] HTMX fragment response omits the shell: `e2e_test.go` "resume page
      HTMX fragment omits the document shell", `TestRenderHTMXFragment`.
* [x] Current role shows "Current"/"PRESENT": `TestDateRange`,
      `e2e_test.go` (Singtel "Current").
* [x] `**bold**` → `<b>`, raw `<`/`&` escaped, escape-then-wrap ordering:
      `TestBoldMarkup`.
* [x] Unknown icon key → no icon: `TestResolveIcon`.
* [x] Contact href allowlist (`javascript:`/`file:` → plain text, `tel:`
      kept without `#ZgotmplZ`): `TestBuildResumeView_ContactHrefAllowlist`,
      `TestResumeBannerContactLinks`, e2e "phone contact link keeps its
      tel: href". Rejected on save: `TestValidateBannerInput_ContactHrefAllowlist`.
* [x] External links open in a new tab with `noopener noreferrer`: e2e
      "external contact/project links open in a new tab safely".
* [x] Empty featured projects still renders "See all projects":
      `TestRenderFullPage`, whose fixture has `FeaturedProjects: nil`. It
      asserts the link is present, not that an empty `<ul>` is absent.
* [x] Placeholder routes are unaffected by `ContentTemplate`:
      `TestRenderPlaceholderRoutesUnaffected`, e2e_test "placeholder routes
      are unaffected by the resume feature".
* [x] Timeline connector and current dot show on desktop and hide on
      mobile: e2e "timeline connector line and current-role dot render on
      desktop, hidden on mobile".
* [x] "See all projects" is an HTMX nav: e2e test of the same name.
* [x] Print button calls `window.print()`: e2e "print button is present
      and triggers window.print()". It runs only after a direct
      `page.goto('/resume')`, so the script's behavior after an HTMX nav
      swap into `/resume` is untested.
* [ ] Print stylesheet page-break behavior. Manual only.
* [ ] DB failure or JSONB decode failure → Error state. The code path
      exists in `ResumeHandler.Index`, but no test drives it.
* [ ] Dark mode colors per component. Only the toggle is tested (e2e "dark
      mode toggle changes the resume page theme").
* [ ] Migration `Down`/`Up` cycle. Exercised manually only.
* [ ] `/healthz` unhealthy path (503, no leaked detail). Only the healthy
      path is tested.
* [ ] `resolveFontClass` fallback for an unknown key. No direct test.

---

## Open Questions

* **Phone number publication (owner decision).** The seed and the live
  page publish `+65 8233 8537` as a `tel:` link. The original plan said
  to confirm this before shipping, because publishing a personal number is
  an exposure decision. That confirmation was never recorded. Owner: keep
  it, or remove it via `/settings/resume` or SQL?
* Missing or misspelled JSONB keys render blank instead of erroring.
  Should hand-written content get shape validation, or is the
  `/settings/resume` validation enough?
* Should `featured_projects` be merged into a shared `/projects` table
  with a "featured" flag if `/projects` becomes DB-backed?
* Migrations auto-run on boot. That is fine for one Render instance.
  Revisit if Render is scaled to more than one instance, because
  concurrent boots would race `goose_db_version`.
* The Error state returns HTTP 200 instead of 5xx. Is that intended?

---

## Definition of Done

* [x] User flow works end to end (e2e suites above).
* [ ] All states in the UI table are implemented and verified. All are
      implemented, but Error and Print are not automated, and the empty
      summary card renders a bare shell.
* [x] `Renderer`/`PageData`/`LoadTemplates` support a per-route
      `ContentTemplate` (`template_test.go`).
* [x] Migration written with a working `Down`, seeding the real content
      (`001_create_and_seed_resume.sql`).
* [x] Icon keys resolve through the Go allowlist (`TestResolveIcon`).
* [ ] A JSONB decode failure surfaces as the Error state. The code path
      exists but is untested. Missing keys do not fail (see Data Model).
* [ ] `/healthz` verifies the DB without leaking detail. Implemented; only
      the healthy path is tested.
* [x] Reads use a `SELECT`-only role in production (`site_reader`,
      verified live).
* [x] Handler/service/repository boundaries followed.
* [ ] Accessibility checked. There has been no dedicated contrast or
      screen-reader pass.
* [ ] No open questions remain (phone number).

---

## History

Text moved verbatim from earlier versions of this doc. It describes plans
and states that have since changed.

### Original Problem / Motivation

`/resume` currently renders only placeholder text (`PagesHandler.Resume` in
`internal/handler/pages.go`). Resume content is explicitly named in
CLAUDE.md's Planned Content and is the page most visitors of a personal site
built to replace a resume site will actually read. Without it, the site
can't replace `vincentmegia.onrender.com` as CLAUDE.md's stated goal requires.

### Original Scope items (since done or superseded)

* Extending the shared rendering pipeline (`Renderer`, `PageData`,
  `LoadTemplates`) so a route can render a distinct content template instead
  of every route sharing the single placeholder `"content"` definition — a
  prerequisite this feature introduces as its first consumer, not something
  `/resume` works around locally. See Template Rendering below.
* The first live Postgres connection for this project: pool wiring in
  `cmd/server/main.go`/`internal/config`, and the `migrations/` directory +
  `goose` setup.
* Updating `GET /healthz` to verify DB connectivity, per the existing
  `go-backend`/`Healthz` doc comment ("once the app has a database, this
  should also verify connectivity") — this feature is that trigger.
* A print stylesheet (adapted from the reviewed design artifact) and an
  explicit "Print / Save as PDF" button.
* New semantic color tokens in `web/static/css/app.css`'s `@theme` block,
  refining the current placeholder tokens with the reviewed design's palette.

**Out of scope:**

* An admin/CMS UI to edit resume content — no such UI exists anywhere in the
  app yet. Content is written via the seed migration or direct SQL for now;
  see Open Questions.

(Superseded: `/settings/resume` now exists — `resume-content-authoring.md`.)

Original User Flow step 1: "User navigates to /resume (via the Home ▾ menu,
direct URL, or reload)." (The Home dropdown was replaced by the flat nav
and Résumé button — `home.md`.)

### Original Visual Direction (pre-Organic values)

The reviewed design artifact ("Vincent Megia — Principal Software Engineer")
is the original basis for this page's look: a dark navy banner, a warm gold
accent, and card-based sidebar/timeline sections. The token *names* and
structure below are still exactly what's implemented; their *values* were
later re-themed from this artifact's navy/gold to the "Organic" design
system's terracotta/sage (docs/skills/tailwind-ui/SKILL.md's Visual Style) —
the banner is now a dark terracotta (`accent-900`) rather than navy, per that
doc. `web/static/css/app.css`'s `@theme`
block currently holds only placeholder tokens (`--color-brand`,
`--color-surface`, `--color-danger`, with a comment saying "refine when the
real design lands") — this feature is that refinement:

* **Neutrals**: `--color-ink`, `--color-muted`, `--color-line`,
  `--color-paper`, `--color-surface` / `--color-surface-2` — a text/border/
  background scale replacing the single placeholder `--color-surface`.
* **Brand accents**: `--color-primary` (the artifact's navy, `#1F3A5F`) for
  links, company names, and stat numbers; `--color-accent` (the artifact's
  gold, `#B8863B`) for bullet markers, badges, and highlights. `--color-brand`
  is retired in favor of these two more specific tokens.
* **Banner tokens**: `--color-banner-bg`, `--color-banner-ink`,
  `--color-banner-muted`, `--color-banner-accent` — the banner is a fixed
  dark surface in both light and dark site themes (matching the artifact),
  not something that inverts with the site's `dark:` variant.
* **Dark mode**: values for the neutral/primary/accent tokens are defined
  through the site's existing class-based `dark:` variant (`dark-mode.md`),
  not the artifact's own `prefers-color-scheme`/`data-theme` mechanism — the
  artifact was a standalone prototype; this site already has its own
  cookie-driven theme mechanism that every page must use.
* **Radius**: reuse the existing `--radius-card` for every card surface
  (banner, sidebar cards, role cards) rather than introducing new values.
* **Reconciling with `tailwind-ui`'s general guidance**: the artifact's card
  shadow is kept but flattened to a subtle 1–2px treatment ("avoid huge
  shadows"); its rounded corners map onto the existing `--radius-card` rather
  than a larger custom radius ("avoid excessive rounded containers"). No
  gradients or glassmorphism from the artifact are carried over (it doesn't
  use them either, so nothing to trim there).
* Stat numbers and skill pills use the new semantic tokens, not raw Tailwind
  palette classes, per `tailwind-ui`'s token guidance.
* **Timeline connector**: the artifact's experience timeline has a vertical
  line running down the left gutter, threading through a small circular dot
  per role — the current role's dot is highlighted (`--color-accent` border
  + tinted fill) instead of the neutral `--color-line` border/`--color-surface`
  fill every other role's dot uses. This was missed in the first
  implementation pass (`resume-timeline.html`/`resume-role.html` shipped as a
  plain stacked list, no connector at all) — decorative only
  (`aria-hidden="true"`, conveys nothing `IsCurrent`'s existing text
  "Current" badge doesn't already convey), and hidden below the `sm`
  breakpoint along with the gutter's reserved space, matching the artifact's
  own `max-width:640px` mobile behavior — role cards go full-width on mobile
  with nothing to connect.

### Original Template Rendering plan

`internal/handler/template.go`'s `Renderer.Render` currently executes a
template hardcoded by name — `"base"` for a full page, `"content"` for an
HTMX fragment — and every route today shares the *same* `{{define
"content"}}` (`pages/placeholder.html`), differentiated only by
`PageData.ContentTitle`/`ContentMessage`. `LoadTemplates` parses an explicit
file list, not a directory glob, and relies on "whichever file is parsed
last wins" for that shared `"content"` definition.

`resume.html` cannot simply add its own `{{define "content"}}` — that would
silently take over the `"content"` template for every other route
(`/projects`, `/blogs`, `/settings/*`), which are still on the placeholder,
not just `/resume`. This feature extends the rendering pipeline to support a
distinct per-route content template, as its first real consumer:

* `PageData` gains a `ContentTemplate string` field (e.g. `"resume-content"`).
  Go's zero value for an unset field is `""`, not `"content"`, so the
  defaulting happens in `Renderer.Render`, not the struct: treat an empty
  `ContentTemplate` as `"content"` there. This means every existing
  `PagesHandler` call site needs no changes — only `ResumeHandler` sets the
  field.
* `Render` currently has two paths that both need the same fix, not just
  one: the full-page path executes `"base"` (whose content block must
  dispatch via `{{template .ContentTemplate .}}` instead of the hardcoded
  `{{block "content" .}}`), and the **HTMX-fragment path executes the content
  template directly** (`ExecuteTemplate(&buf, "content", data)`) — that
  hardcoded `"content"` must become the same resolved name (`data`'s
  `ContentTemplate`, defaulted as above), or an HTMX nav swap into `/resume`
  would keep rendering the placeholder even after the full-page path is fixed.
* `resume.html` defines `{{define "resume-content"}}` rather than
  `{{define "content"}}`, avoiding the collision.
* `LoadTemplates`'s explicit file list gains every new `resume-*.html` file
  (the page plus all `resume-*` components) — a manual step, since the list
  isn't a glob; forgetting one fails fast at startup as a template
  parse/lookup error, not a silent gap.

This is a prerequisite for the rest of this doc, not an implementation
detail to improvise later — the UI, Routes/Handlers, and Data Model sections
below all assume it exists.

**`resume-content` owns its own `<main id="main-content">` wrapper — this
shipped without one initially, and it was a real bug, not just a style
choice.** `hx-swap="outerHTML"` (`home.md`'s HTMX Interactions) replaces the
*entire* `#main-content` element with the server's response. `resume.html`
originally rendered only its inner `<div class="space-y-6">`, assuming
`base.html` would supply the wrapper — correct for a direct page load
(`base.html` does wrap `.RenderedContent`), but every HTMX nav swap onto
`/resume` destroyed `#main-content`'s own `mx-auto max-w-5xl px-4 py-8`
classes along with the old content, leaving the page full-bleed with no
container or padding. `resume-content` now renders
`<main id="main-content" class="mx-auto max-w-5xl px-4 py-8">` itself; see
`home.md`'s HTMX Interactions for the general rule every content template
must follow, not just this one.

### Original Routes / Data Model notes

Landing this route means deleting `PagesHandler.Resume` and updating its
registration in `cmd/server/main.go`'s `newMux()` — currently
`mux.HandleFunc("GET /resume", pages.Resume)` — to construct and wire the new
`ResumeHandler` instead.

`GET /healthz` got the matching structural change: `handler.Healthz` was a
stateless package-level function with no dependencies; verifying DB
connectivity (Scope, Security Considerations) meant it needed the connection
pool, so it's now `HealthHandler`, a method on a small struct holding
`*sql.DB` (not `*pgxpool.Pool` — this project uses `database/sql` with the
pgx driver, per `postgres`'s Query Layer section, not pgx's native pool
API), registered in `newMux()` the same way as `ResumeHandler`.

This was the first feature requiring a live Postgres connection —
`internal/repository`, `internal/service`, and `internal/model` were empty
(`.gitkeep` only) before it, and there was no `migrations/` directory, no
`DATABASE_URL` config, and no `pgx` dependency. Implementing it also stood up:

* Connection pool wiring in `internal/db` (`database/sql` + the pgx driver,
  per `postgres`'s Query Layer section — not pgx's native pool API),
  configured from `internal/config` (`DATABASE_URL`, pool size, statement/
  lock timeouts) per `postgres`'s Connection Management and Timeouts
  sections. `DATABASE_URL` itself is environment-variable-or-`.env`-only —
  see `go-backend`'s Configuration section — never a `config.yaml` key.
* The `migrations/` directory (embedded into the binary via
  `migrations/embed.go`, run automatically at startup — see Open Questions)
  and `goose` invocation per `postgres`'s Migrations section.

The `Up` section above continues with `INSERT` statements for the
`resume_profile` singleton row and one `resume_roles` row per role (Singtel,
Sofgen with its Barclays/PayPal sub-projects, Tangspac, Optimum Solutions),
transcribed from the reviewed design artifact — this is how content gets
written for launch in the absence of an admin UI. `Down` dropping both
tables removes the seeded rows along with the schema, so no separate cleanup
step is needed.

Superseded JSONB claim (incorrect — missing keys decode to blanks, see Data
Model): "No `CHECK` constraints validate the *inner* shape of the JSONB
columns (beyond what's shown above) — only that each is present and
non-null. Since there's no admin UI, every write is hand-authored SQL, and a
typo'd key or wrong nesting is still valid JSON: it won't fail the
migration, it'll decode to zero-value Go structs and silently render a blank
section. The service must treat a JSON-decode error as a rendering failure
(the Error state from the UI table), never a partial or silently blank
render — this turns a malformed migration into an immediately visible
failure instead of a quietly broken page."

Original phone-number rule: "Contact links carry over the phone number
present in the reviewed design artifact, presumed to mirror content already
on the current live resume site (`vincentmegia.onrender.com`) — that
presumption should be confirmed before the seed migration ships, since
publishing a personal phone number is a real exposure decision, not just a
spec detail. If not already public, omit it or replace it with an
email-only contact row."

### Resolved Open Questions

* Admin/CMS UI for editing resume content without direct SQL access —
  deferred to a future feature; for now content changes require a new
  migration or a manual `UPDATE`. (Resolved by
  `resume-content-authoring.md`.)
* **Migration-execution mechanism — RESOLVED.** This was worried about a
  serverless-style host (e.g. Vercel), where concurrent cold starts could
  race the same migration against each other. Actual hosting (CLAUDE.md's
  Open Decisions) is Render for the web service — a persistent, single
  long-running container on the current tier, not serverless — so that
  race condition doesn't apply, and embedded auto-run-on-boot inside
  `main.go` (today's actual behavior) is the right design as-is. The
  database itself moved to Supabase (also CLAUDE.md), which doesn't change
  this: `runMigrations` just runs SQL over whichever connection
  `DATABASE_URL` points at, and Supabase's session pooler (required for
  this app's `options`-param timeouts and `pgx`'s default prepared
  statements — see `docs/features/landing-content-api.md`'s Status)
  supports DDL exactly like a normal Postgres connection. Worth
  re-opening only if Render is ever scaled to more than one instance,
  since concurrent boots would then race `goose_db_version` the same way
  the original serverless worry described.
* **Least-privilege DB role split — RESOLVED, implemented.** Not a full
  two-role split (migration role vs. `SELECT`-only runtime role) as
  originally framed, because that framing predates
  `docs/features/resume-content-authoring.md`'s write paths — the running
  app genuinely needs `INSERT`/`UPDATE`/`DELETE` now, not just `SELECT`.
  What's implemented instead: every repository holds two connections
  (`DB` for writes/migrations, `ReadDB` for reads), `DATABASE_READONLY_URL`
  is optional and falls back to `DATABASE_URL` when unset, and production
  points `ReadDB` at a real Supabase role (`site_reader`) verified to have
  read access to the seeded tables and to be rejected from writing them.
  See Security Considerations.
* **One correction to the original design this bullet replaces**: that
  design assumed the runtime connection was pure-`SELECT` because "there's
  no write path from the running app." That was true when this bullet was
  first written, before `docs/features/resume-content-authoring.md` added
  real write paths (`/settings/resume`). The split implemented here
  reflects that — `ReadDB` is `SELECT`-only, but `DB` (used for every
  write and for migrations) still needs `INSERT`/`UPDATE`/`DELETE`/DDL,
  same role in production today (`postgres.<ref>`) as it always was; only
  the *read* half was narrowed.
