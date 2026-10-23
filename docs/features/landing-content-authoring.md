# Feature: Landing Page Content Authoring

## Status

`Shipped (unreachable)` — implemented end to end and verified against a
local Postgres (migration 005 applied; `TestEndToEnd` passes), but no one
can use the HTML editor: every `/settings/content*` route goes through
`requireOwnerAuth`, and `IsAuthenticated` (`internal/handler/auth_stub.go`)
always returns `false`, so it redirects to a `/login` that doesn't exist.
Until real auth ships, the same content is editable through the bearer-token
JSON API (`docs/features/landing-content-api.md`). The editor has never been
exercised in a browser.

Tests: `internal/service/landing_content_validation_test.go` (`go test
./internal/service/`), and the DB-gated `cmd/server/e2e_test.go`
`TestEndToEnd` subtests "home page renders the shared shell" (seed round
trip) and "content authoring routes require auth" (needs `DATABASE_URL`;
writes to that database — never point it at production).

## Summary

Lets the authenticated site owner edit the landing page's hero copy (the
"Software Engineer" eyebrow, headline, and subhead), the image carousel's
slides, and the "Selected work" cards from `/settings/content` instead of
editing Go source and redeploying.

## Problem / Motivation

Changing a headline, a carousel caption or a Selected work card is routine
copy editing that shouldn't need a code change and a deploy. This feature
moved that content into Postgres — the same move `docs/features/resume.md`
made for résumé content — with a form-based editor. (What it replaced is
under History.)

## Scope

**In scope:**

* Postgres-backed storage for all three sections: hero content (a
  singleton row — eyebrow, title, message), carousel slides (an ordered
  list, capped at 5 per `landing-carousel.md`), and Selected work cards
  (an ordered list).
* An auth-gated `/settings/content` page, the "Content" entry in
  `settingsMenu` (`internal/handler/nav.go`), under the same
  `IsAuthenticated` contract `docs/features/home.md` already defines.
* Forms to edit the hero fields, and to add/edit/delete/reorder carousel
  slides and Selected work cards.
* `PagesHandler.Home` reads all three from Postgres
  (`LandingContentService.GetPublicView`).
* Migration `005_create_landing_content.sql` creates the tables and seeds
  the copy that used to be hardcoded, so shipping it changed nothing
  visually.
* Validation matching each field's existing constraints (carousel capped
  at 5 slides, alt text required, etc. — see Business Rules).

**Out of scope:**

* **Image upload/storage.** A slide continues to reference an image by
  path — which must be a static asset under `/static/` (external image
  URLs are rejected on write) — no upload widget, no image processing, no new asset
  pipeline. This project has no image asset/generation tooling today
  (CLAUDE.md), and adding one is a much bigger feature than content
  authoring.
* **Real authentication.** `internal/handler/auth_stub.go`'s
  `IsAuthenticated` always returns `false` today — the actual
  session/login feature is separate and not yet built. This feature's
  routes are written against that contract but are unreachable (redirect
  to `/login`) until real auth ships, exactly like `/settings/profile` and
  `/settings/security` today. See Open Questions.
* **`/projects`' own `projectItems`.** Stays hand-authored Go data in
  `internal/handler/pages.go`; keeping Selected work in step with it is a
  content task.
* **Rich text / Markdown / WYSIWYG.** Plain text fields only, same
  convention `resume.md` uses.
* **Revision history / undo.** One current row (hero) or ordered list
  (carousel, Selected work) per section — no audit log, no drafts.
* Header/nav copy, footer content, and the About/Blogs placeholder pages —
  untouched by this feature.

---

## User Flow

```text
1. Owner logs in (once real auth exists) and opens Settings → Content, a
   entry in the Settings menu.
2. /settings/content renders three sections in order: Hero, Carousel,
   Selected work.
3. Hero: a form with Eyebrow/Title/Message fields and a Save button.
   Submitting saves the singleton row and re-renders the form (there is no
   explicit success message); the change is immediately live on the next load of
   `/`.
4. Carousel: each existing slide as an inline form (image path, alt text,
   caption, link, external) with Save / Move up / Move down / Delete, plus an
   "Add slide" form that is replaced by a "limited to 5 slides" note once 5
   slides exist.
5. Selected work: the same list/edit/delete/reorder pattern, for cards
   (kicker, title, description, live URL).
6. Deleting a slide or card asks for confirmation first.
7. Any change is reflected on the next load of `/` — no redeploy needed.
```

---

## UI

```text
web/templates/pages/
└── settings-content.html          # /settings/content page shell, three sections

web/templates/components/
├── content-hero-form.html         # #hero-editor-form: eyebrow/title/message
├── content-carousel-editor.html   # #carousel-editor: one form per slide + add form
└── content-work-editor.html       # #work-editor: one form per card + add form
```

Each fragment's dot is a `service.*View` (e.g. `HeroFormView`,
`CarouselEditorView{Slides, Full, Error, Unavailable}`), never the full `PageData`.

| State    | Behavior |
| -------- | -------- |
| Default  | Hero form pre-filled; carousel/Selected work list their rows in `sort_order`. |
| Loading  | Hero form has a local indicator (`#hero-editor-loading`); the carousel and Selected work editors have none. |
| Empty    | Zero slides/cards shows just the add form. |
| Full     | At 5 slides the add-slide form is replaced by "The carousel is limited to 5 slides. Delete one to add another." |
| Error    | The section re-renders with one message box at its top (the validation error's text); nothing is saved. Errors are per section, not per field. A server error on a carousel/work write re-renders that section with "Couldn't save that just now…" above the current rows, re-read from the database (`writeCarouselError`/`writeWorkError`); if that re-read fails too, the section shows only the error and "Reload the page…" (`Unavailable`), never an empty list and add form. |
| Success  | The section re-renders with the saved values; no explicit confirmation message. |

---

## HTMX Interactions

| Trigger                         | Method | Endpoint                                  | Target                    | Swap        | Indicator |
| -------------------------------- | ------ | ------------------------------------------ | -------------------------- | ----------- | --------- |
| Hero form submit                 | POST   | `/settings/content/hero`                   | `#hero-editor-form`        | `outerHTML` | `#hero-editor-loading` |
| Add carousel slide               | POST   | `/settings/content/carousel`               | `#carousel-editor`         | `outerHTML` | — |
| Save carousel slide              | PUT    | `/settings/content/carousel/{id}`          | `#carousel-editor`         | `outerHTML` | — |
| Delete carousel slide            | DELETE | `/settings/content/carousel/{id}`          | `#carousel-editor`         | `outerHTML` | — |
| Move carousel slide up/down      | POST   | `/settings/content/carousel/{id}/move`     | `#carousel-editor`         | `outerHTML` | — |
| Add Selected work card           | POST   | `/settings/content/selected-work`          | `#work-editor`             | `outerHTML` | — |
| Save Selected work card          | PUT    | `/settings/content/selected-work/{id}`     | `#work-editor`             | `outerHTML` | — |
| Delete Selected work card        | DELETE | `/settings/content/selected-work/{id}`     | `#work-editor`             | `outerHTML` | — |
| Move Selected work card up/down  | POST   | `/settings/content/selected-work/{id}/move`| `#work-editor`             | `outerHTML` | — |

Each slide/card form carries `id="carousel-slide-{id}"` / `id="work-item-{id}"`,
but every write re-renders the whole section.

Confirmation required for destructive actions (`hx-confirm`):

* Delete carousel slide ("Delete this slide?").
* Delete Selected work card ("Delete this card?").

---

## Routes / Handlers

All on `LandingContentHandler` (`internal/handler/landing_content.go`),
backed by `LandingContentService` / `LandingContentRepository`; every one
calls `requireOwnerAuth` first.

| Method | Path                                          | Handler                                 | Auth required | Notes |
| ------ | ---------------------------------------------- | ---------------------------------------- | ------------- | ----- |
| GET    | `/settings/content`                            | `LandingContentHandler.Index`            | yes           | Renders all three sections. |
| POST   | `/settings/content/hero`                       | `LandingContentHandler.SaveHero`         | yes           | Upserts the singleton row. |
| POST   | `/settings/content/carousel`                   | `LandingContentHandler.CreateSlide`      | yes           | Rejects a 6th slide. |
| PUT    | `/settings/content/carousel/{id}`              | `LandingContentHandler.UpdateSlide`      | yes           | |
| DELETE | `/settings/content/carousel/{id}`              | `LandingContentHandler.DeleteSlide`      | yes           | Confirmed client-side first. |
| POST   | `/settings/content/carousel/{id}/move`         | `LandingContentHandler.MoveSlide`        | yes           | `direction=up|down`. |
| POST   | `/settings/content/selected-work`              | `LandingContentHandler.CreateWorkItem`   | yes           | |
| PUT    | `/settings/content/selected-work/{id}`         | `LandingContentHandler.UpdateWorkItem`   | yes           | |
| DELETE | `/settings/content/selected-work/{id}`         | `LandingContentHandler.DeleteWorkItem`   | yes           | Confirmed client-side first. |
| POST   | `/settings/content/selected-work/{id}/move`    | `LandingContentHandler.MoveWorkItem`     | yes           | `direction=up|down`. |

A non-numeric `{id}` gets 400 (`parsePathID`).

---

## Data Model

Schema below is abridged from the migration (types written as
`INT`/`now()` here; the file uses `INTEGER`/`NOW()`).

```sql
-- migrations/005_create_landing_content.sql
-- Schema and a seed of today's hand-authored copy live in one migration,
-- same reasoning as 001_create_and_seed_resume.sql: single-owner site, no
-- per-environment variance, so a second file only adds migration surface.

-- +goose Up
CREATE TABLE landing_hero (
    id         BIGINT PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- singleton row
    eyebrow    TEXT NOT NULL,
    title      TEXT NOT NULL,
    message    TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE landing_carousel_slides (
    id         BIGSERIAL PRIMARY KEY,
    image_path TEXT NOT NULL,
    alt        TEXT NOT NULL,
    caption    TEXT NOT NULL DEFAULT '',
    link_url   TEXT NOT NULL DEFAULT '',
    external   BOOLEAN NOT NULL DEFAULT false,
    sort_order INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE landing_selected_work_items (
    id          BIGSERIAL PRIMARY KEY,
    kicker      TEXT NOT NULL,
    title       TEXT NOT NULL,
    description TEXT NOT NULL,
    live_url    TEXT NOT NULL DEFAULT '',
    external    BOOLEAN NOT NULL DEFAULT false,
    sort_order  INT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed: the copy that used to be hardcoded (hero "Software Engineer" /
-- "Hi, I'm Vincent Megia.", the carousel slides and Selected work cards
-- formerly in pages.go). See the migration file for the exact rows.

-- +goose Down
DROP TABLE landing_selected_work_items;
DROP TABLE landing_carousel_slides;
DROP TABLE landing_hero;
```

| Table                          | Column        | Type          | Constraints             | Notes |
| -------------------------------- | ------------- | ------------- | -------------------------- | ----- |
| `landing_hero`                   | `eyebrow`     | `TEXT`        | `NOT NULL`                 | e.g. "Software Engineer" |
| `landing_hero`                   | `title`       | `TEXT`        | `NOT NULL`                 | Replaces `ContentTitle` |
| `landing_hero`                   | `message`     | `TEXT`        | `NOT NULL`                 | Replaces `ContentMessage` |
| `landing_carousel_slides`        | `image_path`  | `TEXT`        | `NOT NULL`                 | Static asset path under `/static/` (validated on write) |
| `landing_carousel_slides`        | `alt`         | `TEXT`        | `NOT NULL`                 | Required, per `landing-carousel.md` |
| `landing_carousel_slides`        | `sort_order`  | `INT`         | `NOT NULL`                 | Enforced ≤5 rows in application code, not a DB constraint |
| `landing_selected_work_items`    | `live_url`    | `TEXT`        | `NOT NULL`                 | Internal route or external URL, paired with `external` |
| `landing_selected_work_items`    | `sort_order`  | `INT`         | `NOT NULL`                 | |

---

## Business Rules / Validation

* Carousel is capped at 5 slides (`landing-carousel.md`'s existing cap) —
  `LandingContentService.CreateSlide` counts existing rows and returns
  `ErrCarouselFull` ("the carousel is limited to 5 slides") rather than
  inserting; the editor also hides the add form once full.
* Every carousel slide requires `image_path` and `alt`; `caption` and
  `link_url` stay optional, `external` only meaningful alongside a
  `link_url` — same shape as today's `CarouselSlide` struct.
* Every Selected work card requires `kicker`, `title`, `description`, and
  `live_url`.
* URLs are checked on write (`validImagePath`/`validContentLink` in
  `internal/service/landing_content_validation.go`, so the editor and the
  bearer API both get them): `image_path` must be a same-origin path under
  `/static/` (no `//`, scheme, `..`, backslash or whitespace); a non-empty
  `link_url` and every `live_url` must be an absolute `https://` URL with a
  host or a root-relative path with one leading slash (`/projects`, not
  `//host`) — `javascript:`, `data:`, `http:` and other schemes are
  rejected. Each is capped at 2,048 bytes. Migration 005's seed rows pass.
* Every field is trimmed before validation. Hero's
  `eyebrow`/`title`/`message` are all required; no arbitrary length
  cap beyond `TEXT`, matching `resume.md`'s precedent of not imposing one.
* Reordering is up/down-by-one via the move endpoints, not free-form
  drag-and-drop — keeps the interaction and the `sort_order` update
  simple for a list capped at 5 (carousel) or a handful of cards
  (Selected work).
* Moving swaps `sort_order` with the immediate neighbor in one transaction
  (`moveSortOrder` in `internal/repository/landing_content_repository.go`);
  moving the first item up or the last down is a no-op.
* The move direction is a form value `direction=up|down` (`hx-vals`).

---

## Security Considerations

* **Authz**: every `/settings/content*` route calls `requireOwnerAuth`
  (302 to `/login` when not authenticated) — single-owner site, no
  per-field permissions.
* **CSRF**: the POST/PUT/DELETE routes sit behind
  `middleware.CrossOriginProtection` (`cmd/server/main.go`'s
  `newHandlerChain`), which refuses cross-site browser writes with 403.
  There is no session-bound CSRF token yet; the auth feature should add
  one alongside that check.
* **Destructive actions**: slide/card deletion uses `hx-confirm`.
* **Input handling**: every field is database-sourced and renders through
  `html/template` auto-escaping — never `template.HTML`. URLs are
  allow-listed on write (Business Rules), which also covers the JSON API
  since validation lives in the service.
* **Body size**: form bodies are capped at 1 MiB by
  `middleware.LimitRequestBody`.
* **Secrets**: none beyond `DATABASE_URL`.

---

## Testing Plan

* [x] Field validation (required fields, trimming, URL allow-list, the
      seed rows passing) — `landing_content_validation_test.go`
      (`TestValidateHeroInput`, `TestValidateCarouselSlideInput`,
      `TestValidateWorkItemInput`, `TestValidImagePath`,
      `TestValidContentLink`, `TestSeededLandingContentIsValid`).
* [x] The seed migration renders on `/` — `TestEndToEnd` "home page
      renders the shared shell".
* [x] Unauthenticated `GET /settings/content` redirects —
      `TestEndToEnd` "content authoring routes require auth".
* [x] Unauthenticated POST/PUT/DELETE/move `/settings/content/*` redirect
      too, before the handler does any work —
      `cmd/server/settings_auth_routes_test.go`
      `TestSettingsRoutesRequireAuth` (every `/settings/*` route registered
      in `main.go`).
* [ ] Saving the hero form updates `/` — untested through the HTML
      editor (the API path is tested: `TestEndToEnd` "landing API hero
      round-trips to the rendered page").
* [x] Adding slides up to 5 succeeds; a 6th is rejected (`ErrCarouselFull`,
      API 409, `CreateSlideForm` inline error) and nothing is persisted —
      `TestEndToEnd` "a 6th carousel slide is refused (ErrCarouselFull / API
      409)".
* [x] Move up/down (`MoveSlideForm`) and the API reorder change the stored
      order — `TestEndToEnd` "carousel move up/down and API reorder change
      the display order". Delete through the editor is still untested.
* [x] `<script>` stored in the hero eyebrow, a slide caption and a work
      card's title/description renders escaped on `/` — `TestEndToEnd`
      "stored <script> in hero/slide/work fields renders escaped on /".
* [x] A failed write keeps the current rows on screen; a failed re-read
      shows the error without the add form — `internal/handler/
      landing_content_test.go` `TestEditorWriteErrorKeepsRows`,
      `TestEditorWriteErrorRefetchFails` (fake `database/sql` driver).

---

## Open Questions

All three resolved for this implementation:

* **Auth dependency**: resolved as **wait** — no interim auth mechanism
  was built. `/settings/content` is implemented and gated by the same
  `IsAuthenticated` stub as `/settings/profile`/`/settings/security`
  (`requireOwnerAuth`), so it is unreachable in production until the real
  authentication feature lands, exactly like those two routes today.
* **Selected work vs. `/projects`**: resolved as **landing-page-only for
  v1** — `landing_selected_work_items` backs only the landing page's
  teaser; `/projects`' `projectItems` stays separately hand-authored Go
  data, unchanged by this feature.
* **Image picking**: resolved as a **free-typed text field** — the
  carousel/Selected-work editors take a plain `image_path`/`live_url`
  text input, no dropdown of existing static assets. Revisit if typo'd
  paths turn out to be a real problem in practice.
* **Test coverage of the editor's write routes**: their auth redirect is
  tested (`TestSettingsRoutesRequireAuth`) and the service methods and
  error re-render they call are tested directly, but no test drives an
  authenticated write through a handler (the stubbed auth can't be passed).
  Worth adding once real auth lands.

---

## Definition of Done

* [x] User flow implemented in code, including the 5-slide cap and delete
      confirmations — never click-tested in a browser (unreachable).
* [x] All UI states implemented as described in the UI table (no success
      message and no carousel/work loading indicator, by current design).
* [x] Destructive actions require confirmation (`hx-confirm` in
      `content-carousel-editor.html` / `content-work-editor.html`).
* [x] Migration 005 has a working `Down` and seeds the former hardcoded
      copy; applied to a local Postgres (`TestEndToEnd` passes).
* [x] Handler/service/repository boundaries followed (`go-backend`).
* [ ] Accessibility checked (keyboard, focus, reorder controls) — pending a
      real browser pass, which needs real auth.
* [ ] Tests cover the unticked Testing Plan items.

---

## History

### Status before the wave-3 rewrite

#### Status

`In Progress` — implemented (migration, repository/service/handler layers,
`/settings/content` templates, unit tests for the validation functions,
end-to-end coverage for the new routes) but not yet reachable in
production, since it sits behind the same `IsAuthenticated` stub as
`/settings/profile`/`/settings/security` (see Open Questions' resolved
auth-dependency question). Not yet verified against a real Postgres
instance running the new migration, or exercised through a browser.

### Problem / Motivation as written before implementation

#### Problem / Motivation

All three sections are currently either a Go `var` literal or inline
template text, edited only by changing code and shipping a deploy:

* The hero's eyebrow ("Software Engineer") is a hardcoded string in
  `web/templates/pages/landing.html`; its headline/subhead are the
  `ContentTitle`/`ContentMessage` strings set in `PagesHandler.Home`
  (`internal/handler/pages.go`).
* The carousel's slides are the `landingCarouselSlides` var (`pages.go`) —
  `docs/features/landing-carousel.md`'s Data Model already flags this as
  "static, hand-authored in Go — no DB, no admin editing yet."
* The "Selected work" cards are the `selectedWorkItems` var (`pages.go`).

For a single-owner personal site this has been fine while the content
itself was still being designed, but changing a headline, swapping a
carousel caption, or reordering a Selected work card is routine copy
editing that shouldn't require a code change, a commit, and a redeploy.
This feature moves that content into Postgres — the same move
`docs/features/resume.md` made for résumé content — and gives the owner a
form-based editor to change it live.

### Sections before the wave-3 rewrite (UI, HTMX, Routes, Security, Testing Plan, DoD)

#### UI

```text
web/templates/pages/
└── settings-content.html          # /settings/content page shell, three sections

web/templates/components/
├── content-hero-form.html         # Hero section: eyebrow/title/message form
├── content-carousel-editor.html   # Carousel: slide list + add-slide form
└── content-work-editor.html       # Selected work: card list + add-card form
```

States this feature's UI must handle:

| State    | Behavior |
| -------- | -------- |
| Default  | Hero form pre-filled with current values; carousel/Selected work show their current ordered list. |
| Loading  | Local HTMX indicator on the form/row being submitted; rest of the page stays interactive. |
| Empty    | Carousel/Selected work with zero items shows just the "Add" form, no empty-state placeholder needed since they can't render fewer than 0 rows. |
| Error    | Inline validation message next to the offending field (e.g. missing alt text, 6th slide rejected); nothing is saved. |
| Success  | Inline confirmation after a save; no full-page reload. |

#### HTMX Interactions

| Trigger                         | Method | Endpoint                                  | Target                    | Swap        | Indicator |
| -------------------------------- | ------ | ------------------------------------------ | -------------------------- | ----------- | --------- |
| Hero form submit                 | POST   | `/settings/content/hero`                   | `#hero-editor-form`        | `outerHTML` | local     |
| Add carousel slide               | POST   | `/settings/content/carousel`               | `#carousel-editor`         | `outerHTML` | local     |
| Edit carousel slide               | PUT    | `/settings/content/carousel/{id}`          | `#carousel-slide-{id}`     | `outerHTML` | local     |
| Delete carousel slide             | DELETE | `/settings/content/carousel/{id}`          | `#carousel-editor`         | `outerHTML` | local     |
| Move carousel slide up/down       | POST   | `/settings/content/carousel/{id}/move`     | `#carousel-editor`         | `outerHTML` | local     |
| Add Selected work card            | POST   | `/settings/content/selected-work`          | `#work-editor`             | `outerHTML` | local     |
| Edit Selected work card           | PUT    | `/settings/content/selected-work/{id}`     | `#work-item-{id}`          | `outerHTML` | local     |
| Delete Selected work card         | DELETE | `/settings/content/selected-work/{id}`     | `#work-editor`             | `outerHTML` | local     |
| Move Selected work card up/down   | POST   | `/settings/content/selected-work/{id}/move`| `#work-editor`             | `outerHTML` | local     |

Confirmation required for destructive actions:

* Delete carousel slide.
* Delete Selected work card.

#### Routes / Handlers

| Method | Path                                          | Handler                          | Auth required | Notes |
| ------ | ---------------------------------------------- | ---------------------------------- | ------------- | ----- |
| GET    | `/settings/content`                            | `ContentHandler.Index`             | yes           | Renders all three sections. |
| POST   | `/settings/content/hero`                       | `ContentHandler.SaveHero`          | yes           | Upserts the singleton row. |
| POST   | `/settings/content/carousel`                   | `ContentHandler.CreateSlide`       | yes           | Rejects a 6th slide. |
| PUT    | `/settings/content/carousel/{id}`              | `ContentHandler.UpdateSlide`       | yes           | |
| DELETE | `/settings/content/carousel/{id}`              | `ContentHandler.DeleteSlide`       | yes           | Confirmed client-side first. |
| POST   | `/settings/content/carousel/{id}/move`         | `ContentHandler.MoveSlide`         | yes           | Body indicates up/down. |
| POST   | `/settings/content/selected-work`              | `ContentHandler.CreateWorkItem`    | yes           | |
| PUT    | `/settings/content/selected-work/{id}`         | `ContentHandler.UpdateWorkItem`    | yes           | |
| DELETE | `/settings/content/selected-work/{id}`         | `ContentHandler.DeleteWorkItem`    | yes           | Confirmed client-side first. |
| POST   | `/settings/content/selected-work/{id}/move`    | `ContentHandler.MoveWorkItem`      | yes           | Body indicates up/down. |

#### Security Considerations

* **Authz**: every `/settings/content/*` route requires
  `IsAuthenticated`, the same contract `/settings/profile` and
  `/settings/security` already use — single-owner site, no per-field
  permission model needed.
* **Destructive actions**: slide/card deletion requires confirmation
  (`docs/skills/htmx-ui/SKILL.md`'s confirmation pattern).
* **Input handling**: unlike `nav.go`'s hardcoded `template.HTML` icons,
  every field here is now database-sourced and must render through
  `html/template`'s normal auto-escaping — never `template.HTML`. No new
  raw-HTML injection surface is introduced.
* **Secrets**: none — no new config/secrets beyond the existing
  `DATABASE_URL`.

#### Testing Plan

* [ ] Unauthenticated request to any `/settings/content*` route redirects
      to `/login`, same as Profile/Security today.
* [ ] Saving the hero form updates the singleton row, and `/` reflects the
      new eyebrow/title/message on its next load.
* [ ] Adding slides up to 5 succeeds; a 6th attempt is rejected with a
      clear inline error and nothing is persisted.
* [ ] Deleting a slide/card without confirming leaves it in place;
      confirming removes it and `/` stops rendering it.
* [ ] Reordering (move up/down) changes the rendered order on `/`.
* [ ] The seed migration leaves `/` visually unchanged immediately after
      this ships — no accidental copy drift versus today's hand-authored
      vars.
* [ ] Every field (caption, description, etc.) renders escaped — a value
      containing `<script>` or similar is not executed.

#### Definition of Done

* [x] User flow implemented end-to-end in code, including the 5-slide cap
      and delete confirmations above — not yet click-tested in a browser
      (see Status).
* [x] All states in the UI table are implemented (loading/empty/error/success).
* [x] Destructive actions (slide/card delete) require confirmation
      (`hx-confirm`).
* [x] Migration written and includes a working `Down`; seeds today's copy
      verbatim — not yet applied against a real Postgres instance (see
      Status).
* [x] Handler/service/repository boundaries followed (`go-backend`).
* [ ] Accessibility checked (keyboard, focus, contrast, semantic HTML,
      especially the reorder controls) — pending a real browser pass.
* [x] Unit tests cover `ValidateHeroInput`/`ValidateCarouselSlideInput`/
      `ValidateWorkItemInput`; `cmd/server/e2e_test.go` covers the auth
      redirect and the seeded content round-tripping onto `/` — not yet
      run against a live database (DB-gated, skipped without
      `DATABASE_URL`).
* [x] Open Questions above are resolved.
