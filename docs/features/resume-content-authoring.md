# Feature: Resume Content Authoring

## Status

`In Progress`. The code is complete and was verified against a real
Postgres database at the service layer, but nobody can reach it: every
route sits behind the `IsAuthenticated` stub, which always returns false,
so every `/settings/resume*` request redirects to a `/login` page that
doesn't exist yet. It has never been exercised in a real browser.

Tests:

* Unit (no DB): `go test ./internal/service`, which covers
  `resume_admin_validation_test.go` and `resume_admin_encoding_test.go`.
* DB-gated: `go test ./cmd/server`, which covers `resume_admin_e2e_test.go`
  (`TestResumeAdminRoundTrip`) and `e2e_test.go` ("resume authoring
  routes require auth"). These are skipped without `DATABASE_URL`/`.env`.
* There is no Playwright coverage.

## Summary

An auth-gated `/settings/resume` page where the owner edits every
DB-backed card of `/resume`:

* the banner (except the name);
* Core Expertise, Education and Featured Projects;
* Summary + Stats;
* the experience-timeline roles.

Each card also gets its own font-pairing preset. Everything is stored in
this site's own Postgres.

## Problem / Motivation

Before this feature, changing `/resume` content (`resume.md`) meant a
migration or a manual `UPDATE`. That is fine for the first transcription
but not for ongoing upkeep. Applying `landing-content-authoring.md`'s
pattern to `/resume` fixes that, and per-card font presets let sections
look different from each other.

## Scope

**In scope:**

* `/settings/resume`, linked from the Settings dropdown (`settingsMenu` in
  `internal/handler/nav.go`).
* Six independently saved editors:
  * **Banner**: role title, tenure label, location label and contact
    links. The name "Vincent Megia" is **not** editable. It is hardcoded
    in `resume-banner.html`, `resume_pdf.go` and `resume_docx.go`.
  * **Core Expertise**: skill groups.
  * **Education**.
  * **Featured Projects**.
  * **Summary + Stats**.
  * **Experience Timeline**: add, edit, delete and move up/down for
    `resume_roles`, with bullets and sub-projects edited inside the role
    form.
* A font preset per card (five profile columns) and per role. Sub-projects
  inherit their role's preset.
* Migration `006_add_resume_authoring.sql`.

**Out of scope:**

* Any home-admin/HQ involvement, meaning no API and no second database.
  Contrast `landing-content-api.md`.
* Real authentication.
* Per-bullet or per-sub-project fonts, rich text, revision history and
  undo.

---

## Architecture

```text
Postgres            resume_profile / resume_roles + 6 font_style columns (CHECK to 4 keys)
internal/repository ResumeRepository: UpdateBanner, UpdateExpertise, UpdateEducation,
                    UpdateFeaturedProjects, UpdateSummary (each a targeted UPDATE of its own
                    columns, WHERE id = 1), CreateRole, UpdateRole, DeleteRole, MoveRole
                    (→ moveSortOrder in landing_content_repository.go). All on DB, not ReadDB.
internal/service    resume_admin_service.go (GetAdminView, Save*, *Role), validation in
                    resume_admin_validation.go, textarea decoding in resume_admin_encoding.go
internal/handler    ResumeAdminHandler (resume_admin.go); every method starts with requireOwnerAuth
web/templates       pages/settings-resume.html + components/resume-admin-*.html
```

The read path is unchanged: `/resume` still goes through
`ResumeService.Get`, which resolves each `font_style` key with
`resolveFontClass`. One `ResumeService` instance is shared by the read,
admin and export handlers (`cmd/server/main.go`).

---

## User Flow

```text
1. Owner (once real auth exists) opens Settings → Resume.
2. /settings/resume shows six cards in this order: Banner, Core Expertise,
   Education, Featured Projects, Summary + Stats, Experience Timeline.
3. Each profile card has its own fields, a font-style <select>, and a
   Save button. Saving swaps only that card.
4. Experience Timeline lists one edit form per role (Save / Move up /
   Move down / Delete), then an "Add role" form. Leave End date blank for
   a current role.
5. Delete asks "Delete this role?" (hx-confirm).
6. Saved content shows on the next load of /resume.
```

---

## UI

```text
web/templates/pages/
└── settings-resume.html                 # {{define "settings-resume"}}, owns <main id="main-content">
web/templates/components/
├── resume-admin-banner-form.html        # #resume-admin-banner
├── resume-admin-expertise-form.html     # #resume-admin-expertise
├── resume-admin-education-form.html     # #resume-admin-education
├── resume-admin-featured-form.html      # #resume-admin-featured
├── resume-admin-summary-form.html       # #resume-admin-summary
├── resume-admin-role-editor.html        # #resume-admin-role-list: per-role forms + Add role form
└── resume-admin-font-select.html        # {{define "resume-font-select"}}, shared <select name="font_style">
web/static/css/app.css                   # .resume-font-{organic,classic-serif,modern-sans,editorial}
web/static/fonts/                        # fraunces-700, source-serif-4-400, space-grotesk-700,
                                         # inter-400, playfair-display-700, lora-400 (.woff2)
```

**List encoding.** List-shaped fields are line-delimited textareas, one
item per line (`resume_admin_encoding.go`):

| Field | Line format | Reserved characters / limits |
| ----- | ----------- | ---------------------------- |
| Contact links | `Label \| Href \| Icon` | `\|` can't appear in Label or Href |
| Skill groups | `Group: skill1, skill2` | The first `:` ends the group name. Skills can't contain `,` |
| Education | `Degree \| School \| StartYear \| EndYear` | `\|`. A non-numeric year is saved as `0` |
| Featured projects | `Name \| Description \| Label=Href; Label=Href` | `\|` in Name/Description. `;` in a link. `=` in a link label |
| Summary paragraphs, role bullets | one per line | An item can't contain a line break |
| Stats | `Num \| Label` | `\|` in Num |
| Sub-projects | `Heading \| ClientTag \| Blurb \| b1; b2` | `\|` in the first three fields. `;` in a bullet |

A reserved character inside content is silently split or truncated on the
next save. Nothing warns the owner. The seeded content contains none of
these characters.

| State   | Behavior (as implemented) |
| ------- | ------------------------- |
| Default | Every form is pre-filled from the DB, with the stored font preset selected. |
| Loading | The five profile cards each show a local "Saving…" `hx-indicator`. The role forms and the Move/Delete buttons have **no** `hx-indicator`. |
| Empty   | A list card with no items shows an empty textarea. With zero roles, Experience Timeline shows only the Add role form. |
| Error   | A validation failure re-renders the card with one message at the top of the card (not next to the field) and saves nothing. Profile cards keep the submitted values. The role editor re-renders the role list from the DB, so the values typed into the failed add or edit form are lost. A DB failure re-renders the card with a generic "Couldn't save that just now…" message and **blank fields** (the role editor shows no roles). |
| Success | The card is re-rendered with the saved values from the DB. There is **no** confirmation message. |

---

## Font Presets

| Key | Heading | Body |
| --- | ------- | ---- |
| `organic` (default) | Caprasimo | Figtree |
| `classic-serif` | Fraunces | Source Serif 4 |
| `modern-sans` | Space Grotesk | Inter |
| `editorial` | Playfair Display | Lora |

* The allowlist is `fontPresets` in `resume_admin_validation.go`.
* On write, `ValidateFontStyle` turns empty into `organic` and returns
  `ErrInvalidFontStyle` for anything else outside the list. The DB `CHECK`
  is a second guard.
* On read, `resolveFontClass` returns `resume-font-<key>` and falls back
  to `organic` for an unknown key. Only that class name reaches markup.
* Each class sets `--font-heading`/`--font-body` and `font-family` for its
  subtree. Fonts are self-hosted (the CSP has no CDN `font-src`) and all
  are OFL.
* The PDF/DOCX exports ignore presets (`resume-export.md`).

---

## HTMX Interactions

| Trigger | Method | Endpoint | Target | Swap | Indicator |
| ------- | ------ | -------- | ------ | ---- | --------- |
| Banner Save | POST | `/settings/resume/banner` | `#resume-admin-banner` | `outerHTML` | `#resume-admin-banner-loading` |
| Core Expertise Save | POST | `/settings/resume/sidebar/expertise` | `#resume-admin-expertise` | `outerHTML` | `#resume-admin-expertise-loading` |
| Education Save | POST | `/settings/resume/sidebar/education` | `#resume-admin-education` | `outerHTML` | `#resume-admin-education-loading` |
| Featured Projects Save | POST | `/settings/resume/sidebar/featured-projects` | `#resume-admin-featured` | `outerHTML` | `#resume-admin-featured-loading` |
| Summary + Stats Save | POST | `/settings/resume/summary` | `#resume-admin-summary` | `outerHTML` | `#resume-admin-summary-loading` |
| Add role | POST | `/settings/resume/roles` | `#resume-admin-role-list` | `outerHTML` | none |
| Role Save | PUT | `/settings/resume/roles/{id}` | `#resume-admin-role-list` | `outerHTML` | none |
| Delete role | DELETE | `/settings/resume/roles/{id}` | `#resume-admin-role-list` | `outerHTML` | none |
| Move up/down | POST | `/settings/resume/roles/{id}/move` (`hx-vals` `direction`) | `#resume-admin-role-list` | `outerHTML` | none |

Every role action swaps the whole role list, not a single
`#resume-admin-role-{id}` form. Destructive action: Delete role uses
`hx-confirm="Delete this role?"`.

---

## Routes / Handlers

All of these are on `ResumeAdminHandler` (`internal/handler/resume_admin.go`).
Each one calls `requireOwnerAuth`, which sends a 302 to `/login` when the
request isn't authenticated.

| Method | Path | Handler | Writes |
| ------ | ---- | ------- | ------ |
| GET | `/settings/resume` | `Index` | — |
| POST | `/settings/resume/banner` | `SaveBanner` | `role_title`, `tenure_label`, `location_label`, `contact_links`, `banner_font_style` |
| POST | `/settings/resume/sidebar/expertise` | `SaveExpertise` | `skill_groups`, `sidebar_expertise_font_style` |
| POST | `/settings/resume/sidebar/education` | `SaveEducation` | `education`, `sidebar_education_font_style` |
| POST | `/settings/resume/sidebar/featured-projects` | `SaveFeaturedProjects` | `featured_projects`, `sidebar_featured_projects_font_style` |
| POST | `/settings/resume/summary` | `SaveSummary` | `summary_paragraphs`, `stats`, `summary_font_style` |
| POST | `/settings/resume/roles` | `CreateRole` | new row (appended `sort_order`) |
| PUT | `/settings/resume/roles/{id}` | `UpdateRole` | role fields + whole `bullets`/`subprojects` arrays; never `sort_order` |
| DELETE | `/settings/resume/roles/{id}` | `DeleteRole` | idempotent; an already-gone role counts as success |
| POST | `/settings/resume/roles/{id}/move` | `MoveRole` | swaps `sort_order` with its neighbour in a transaction; an invalid direction or a role already at the end does nothing |

---

## Data Model

`migrations/006_add_resume_authoring.sql` adds `banner_font_style`,
`sidebar_expertise_font_style`, `sidebar_education_font_style`,
`sidebar_featured_projects_font_style` and `summary_font_style` to
`resume_profile`, plus `font_style` to `resume_roles`. Each column is
`TEXT NOT NULL DEFAULT 'organic' CHECK (... IN ('organic',
'classic-serif','modern-sans','editorial'))`, and the migration has a
working `Down` that drops them. No new tables and no JSONB shape change.
Adding a preset needs a migration that widens the `CHECK`. The full column
list is in `resume.md`'s Data Model.

---

## Business Rules / Validation

The rules are in `resume_admin_validation.go`. Every validation failure
returns a curated sentinel error, and `IsResumeValidationError` is what
decides that the message is shown inline.

* **Banner**:
  * Role title, tenure label and location label are required.
  * Contact-link fields are optional, but a non-empty href must pass
    `linkableHref` (`https://`, `http://`, `mailto:` or `tel:`). Anything
    else fails with `ErrContactLinkHrefInvalid`.
  * Icon keys aren't validated on save. An unknown key just renders no
    icon.
* **Core Expertise**: each group needs a name and at least one non-empty
  skill.
* **Education**: each entry needs a degree and a school. Years are not
  validated (`0` is allowed).
* **Featured Projects**:
  * Each project needs a name and a description.
  * A link with both label and href blank is dropped.
  * Link hrefs aren't validated, because site-relative links are
    legitimate. `/resume`'s `html/template` and the exports'
    `linkableHref` handle unsafe schemes.
* **Summary + Stats**: blank paragraphs are dropped, and so are stats
  with both num and label blank. A stat with only one of the two is kept.
* **Role**:
  * Title and company are required.
  * Start date must be `YYYY-MM-DD`.
  * A blank end date means current. A non-blank, unparseable end date is
    an error.
  * Blank bullets are dropped, and so are sub-projects with a blank
    heading. A blank client tag is stored as `null`.
* **Every card**: `font_style` must be one of the allowlisted keys.
* Lists are always replaced as a whole. Bullets and sub-projects have no
  CRUD endpoints of their own.
* Roles are reordered one step at a time with Move up/down. There is no
  drag-and-drop.
* All of `resume.md`'s Business Rules still apply.

---

## Security Considerations

* **Authz**: every route calls `requireOwnerAuth`. The stub means none of
  them is reachable today.
* **CSRF**: the global `middleware.CrossOriginProtection`
  (`cmd/server/main.go`, wrapping Go's `http.CrossOriginProtection`)
  returns 403 for cross-origin state-changing requests, which covers
  POST/PUT/DELETE here. There is no per-form token.
* **Destructive actions**: role delete has `hx-confirm`.
* **Font keys** are lookup keys and never become raw CSS (see Font
  Presets).
* **Contact hrefs** are allowlisted on save and again on render
  (`resume.md`).
* **Escaping**: all fields go through `html/template` on `/resume` and in
  the forms. `**bold**` stays the only intentional markup.
* **Errors**: DB errors are logged with `slog` and never sent to the
  client.
* **No HQ exposure**: there are no new credentials, APIs or callers.
  Writes use the existing `DB` handle.

---

## Testing Plan

* [x] Unauthenticated `GET /settings/resume` redirects:
      `cmd/server/e2e_test.go` "resume authoring routes require auth".
* [ ] Unauthenticated POST/PUT/DELETE to the nine write routes redirect.
      Only GET is tested. All nine call `requireOwnerAuth`, which was
      checked by inspection only.
* [x] Each profile card's save persists through the service against a
      real DB (`TestResumeAdminRoundTrip`). Banner and expertise are also
      checked in `ResumeService.Get`'s output. Education, featured
      projects and summary are checked only for "no error".
* [ ] Saving one card leaves the other cards' columns untouched. This is
      not asserted. It holds by construction, since each `Update*` touches
      only its own columns.
* [x] Role create and update (with a sub-project, end date and font) are
      reflected in `ResumeService.Get`: `TestResumeAdminRoundTrip` "role
      create, update, move, and delete round-trip".
* [ ] Role delete removes the role. `DeleteRole` runs only in that
      subtest's cleanup, and the role's absence isn't asserted.
* [ ] Move up/down changes the order. `MoveRole` is called and checked
      only for "no error". `moveSortOrder` has no test anywhere.
* [ ] Delete without confirming leaves the role. `hx-confirm` has no
      browser test.
* [x] Invalid `font_style` is rejected and nothing is saved:
      `TestResumeAdminRoundTrip` "banner rejects an invalid font style and
      persists nothing", `TestValidateFontStyle`. The DB `CHECK` is not
      tested on its own.
* [x] Distinct presets render on different cards: the banner
      (`classic-serif`), expertise (`modern-sans`) and role
      (`modern-sans`) font classes are asserted in
      `TestResumeAdminRoundTrip`.
* [ ] `resolveFontClass` falls back to `organic` for an unknown key. No
      test.
* [ ] The education, featured, summary and per-role `FontClass` values
      reach the rendered `/resume` markup. Not asserted at the HTML level.
* [x] Validation rules: `TestValidateBannerInput`,
      `TestValidateBannerInput_ContactHrefAllowlist`,
      `TestValidateExpertiseInput`, `TestValidateEducationInput`,
      `TestValidateFeaturedProjectsInput`, `TestValidateSummaryInput`,
      `TestValidateRoleInput`. Malformed date: "role create rejects a
      malformed date".
* [x] Line-encoding decoders: `TestDecode*` in
      `resume_admin_encoding_test.go`.
* [ ] Handler and template behavior (fragment rendering, error rendering,
      swaps). No test drives `ResumeAdminHandler`. Only template parsing
      is covered (`TestLoadTemplatesParses`).
* [ ] Migration `Down`/`Up` cycle. `Up` was applied to the dev DB, and
      `Down` was reviewed but not run.

---

## Open Questions

* **Role forms have no loading indicator.** The Add, Save, Move and Delete
  controls lack `hx-indicator`, while every profile card has one.
  Add one, or accept this?
* **No success confirmation.** A save just re-renders the card. Add an
  inline "Saved" message?
* **Validation errors are per card, not per field**, and a failed role
  add or edit drops what the owner typed (the list is re-rendered from the
  DB).
* **A DB failure blanks the card's form.** After a failed save, the card
  comes back with empty fields. Clicking Save again would replace that
  card's content with nothing, because empty lists pass validation. This
  looks like a real bug; see the report.
* **Reserved characters in the line encoding** (`|`, `;`, `,`, `:`, `=`,
  newlines; see UI) are lost without any warning. Escape them, warn about
  them, or move to per-row inputs?
* **Name is not editable.** Should the banner name become a DB field, or
  stay hardcoded in the template and both exports?
* Should the editor pattern be shared with `/settings/content`? The
  default is to keep duplicating until a third consumer exists.

---

## Definition of Done

**1. All cards are authorable:**

* [x] All six editors save independently through the service against a
      real DB (`TestResumeAdminRoundTrip`).
* [x] Roles support add, edit, delete and reorder, with bullets and
      sub-projects in the role form (the code exists; delete and move are
      not asserted, see Testing Plan).
* [ ] Every rendered field on `/resume` is editable. Everything except the
      hardcoded name is.

**2. Font style per card, safely:**

* [x] Six independent `font_style` slots (five profile columns plus one
      per role), each resolved to its own `resume-font-*` class.
* [x] Presets resolve through `resolveFontClass`. No raw font string
      reaches a template.
* [x] An invalid key is rejected on write (`ErrInvalidFontStyle`, plus
      the DB `CHECK`) and falls back to `organic` on read (fallback
      untested).

**3. Content lives only in this site's Postgres:**

* [x] No home-admin/HQ call, API or credential. Checked by inspection.
* [x] One shared `ResumeService` on the existing pools
      (`cmd/server/main.go`).

**Standard checklist:**

* [ ] User flow works end to end. Not reachable or browser-tested until
      auth exists.
* [ ] All UI states are implemented. There is no Success confirmation,
      the role forms lack `hx-indicator`, and errors are per card, not
      per field (see Open Questions).
* [x] Role delete requires confirmation (`hx-confirm`).
* [x] Migration written with a working `Down` and applied to a real DB
      (version 6).
* [x] Handler/service/repository boundaries followed.
* [ ] Accessibility checked. Needs a browser pass, which is blocked on
      auth.
* [ ] Tests cover the Testing Plan. Several gaps remain (see above).

---

## History

Text moved verbatim from earlier versions of this doc.

### Original Status

`In Progress` — implemented (migration, repository/service/handler layers,
`/settings/resume` templates, unit tests for validation/encoding, a
DB-gated round-trip test) and verified against a real Postgres instance
(`cmd/server/resume_admin_e2e_test.go`, `TestResumeAdminRoundTrip` — every
save/create/update/move/delete path, plus font-class resolution and
invalid-input rejection). Not yet reachable in production, since it sits
behind the same `IsAuthenticated` stub as `/settings/content`/
`/settings/profile` — see the Auth dependency note this shares with
`landing-content-authoring.md`. Not yet exercised through a real browser.

### Superseded plan details

Original Banner scope: "**Banner** — name/role title/tenure label/location
label/contact links." (Name was never made editable — it stays hardcoded.)

Original preset proposal: "Three new curated presets in addition to keeping
today's look as the default (`organic` — Caprasimo/Figtree, unchanged):
proposed `classic-serif` (Fraunces/Source Serif 4), `modern-sans` (Space
Grotesk/Inter), `editorial` (Playfair Display/Lora). All four Google Fonts
families are OFL-licensed and self-hostable — final pick is yours before
this leaves Proposed."

Original planned template files (the shipped names differ — see UI):

```text
├── resume-admin-featured-projects-form.html
├── resume-admin-role-list.html     # existing roles: edit/delete/move controls
└── resume-admin-role-form.html     # one role's fields, bullets, subprojects,
                                     # font select — used for both add and edit
```

Original planned UI states: "Loading — Local HTMX indicator on the
card/role being submitted; other cards stay interactive." "Empty — A
list-shaped card (Core Expertise, Education, Featured Projects, Roles) with
zero items shows just its "Add" control, no empty-state placeholder." "Error
— Inline validation message next to the offending field; nothing is saved."
"Success — Inline confirmation after a save; no full-page reload."

Original planned HTMX row: "Edit role | PUT | `/settings/resume/roles/{id}`
| `#resume-admin-role-{id}` | `outerHTML` | local" (shipped target is
`#resume-admin-role-list`; role controls have no indicator).

Original Architecture note: "web/templates + HTMX — settings-resume.html
hosts six independent resume-admin-*.html card components; each submits to
its own endpoint and swaps only its own #resume-admin-* container
(outerHTML) — a save on one card never re-renders the others." and
"internal/repository — ResumeRepository gains one targeted UPDATE method per
card (UpdateBanner, UpdateExpertise, ...) plus
CreateRole/UpdateRole/DeleteRole/moveRoleSortOrder."

### Original Testing Plan claims (corrected above)

* [x] Moving a role up/down changes the rendered order on `/resume`
      without disturbing other roles' `sort_order` —
      `TestResumeAdminRoundTrip`'s role subtest calls `MoveRole` and
      confirms no error; a full before/after order assertion is not
      separately isolated but reuses `repository.moveSortOrder`, already
      covered by `landing_content_repository.go`'s own usage.
* [x] Existing `resume.md` coverage (bold markup, icon allowlist, current-role
      badge, JSONB-decode-failure error state) is unaffected by the new
      columns/write paths — the full existing `cmd/server/e2e_test.go`
      suite (including "resume page renders real seeded content
      end-to-end") passes unchanged against the migrated database.

### Resolved Open Questions

* **Final font-preset pick — RESOLVED.** Shipped exactly as proposed:
  `classic-serif` (Fraunces/Source Serif 4), `modern-sans` (Space Grotesk/
  Inter), `editorial` (Playfair Display/Lora), all vendored under
  `web/static/fonts/` from Google Fonts (OFL-licensed, one weight each —
  700 for the heading face, 400 for the body face).
* **Migration numbering — RESOLVED.** `006_add_resume_authoring.sql` was
  the next free number and has been applied to the real dev database
  (`goose: successfully migrated database to version: 6`).
* **Input encoding for the profile-level list fields.** The doc's
  Architecture describes "edited as a whole array replace within the
  card's form" without specifying a widget. Implementation chose a
  line-delimited textarea per list (one row per line, fields separated by
  `|`/`,`/`;` — see `internal/service/resume_admin_encoding.go`'s doc
  comment) rather than a dynamic add/remove-row JS UI, since this project
  has no such JS infrastructure today and this is a single-owner site.
  Revisit if that encoding proves error-prone in practice, same "revisit
  if it's a real problem" reasoning `landing-content-authoring.md`'s Open
  Questions used for its own free-typed-field simplification.
