# Feature: Landing Page

## Status

`Shipped` for content: `/` renders a hero (eyebrow, headline, message, two
CTAs), the image carousel (`docs/features/landing-carousel.md`) and a
"Selected work" card grid, all read from Postgres via
`LandingContentService.GetPublicView` and editable through
`/settings/content` (`docs/features/landing-content-authoring.md`).

**Not built**: the transparent-over-hero header. `PagesHandler.Home` sets
`TransparentOverHero: true`, so the header gets `header--transparent`, but
`header-scroll.js` is empty and that class has no styling, so the header is
solid. The planned behavior is kept under "Planned: transparent header" below.

Tests (`go test ./...`): `internal/handler/selected_work_test.go`
(`TestIsFullPageRoute`, `TestSelectedWorkFullPageLinks`) and the DB-gated
`cmd/server/e2e_test.go` `TestEndToEnd` "home page renders the shared shell"
(asserts seeded hero, Selected work and carousel copy; needs `DATABASE_URL`
and writes to that database — never point it at production). No Playwright
spec covers `/`'s content.

## Summary

The `/` route's own page: hero, carousel, and Selected work, over a
full-bleed decorative background. The shared shell (header, nav, footer) is
`docs/features/home.md`; the dark-mode toggle is `docs/features/dark-mode.md`.

## Problem / Motivation

The landing page is the site's first impression; it needs to say who Vincent
is, point at the résumé and code, and tease real projects — and the owner
needs to change that copy without a redeploy.

## Scope

**In scope:**

* Hero: eyebrow, `<h1>` title and message from `landing_hero`; a "View my
  résumé" pill (HTMX nav to `/resume`) and a "See my code on GitHub" outline
  pill (new tab, `rel="noopener noreferrer"`). Left-aligned, with a soft
  sage decoration circle (`bg-accent/15`, `aria-hidden`).
* Carousel: `{{template "carousel" .}}` — see `landing-carousel.md`.
* Selected work: `components/selected-work.html`, cards from
  `landing_selected_work_items` (kicker, title, description, link — the
  link is required on write, though the template tolerates an empty one),
  a "See all projects →" link to `/projects`. Renders nothing when there are
  no items.
* Full-bleed background: `landing-page-bg-light.svg` /
  `landing-page-bg-dark.svg` on an absolutely positioned `w-screen` layer
  behind `#main-content` (details in `landing.html`'s comment and
  `landing-carousel.md`).
* Setting `TransparentOverHero: true` (no visible effect yet).

**Out of scope:**

* Hero imagery (no photo or illustration in the hero).
* The transparent-header behavior — planned, not built (see below).
* Editing content — `landing-content-authoring.md` and
  `landing-content-api.md`.

---

## User Flow

```text
1. User loads `/` (or navigates to it via the identity/Home link). The hero,
   carousel and Selected work render from Postgres.
2. "View my résumé" swaps to `/resume` via HTMX; "See my code on GitHub"
   opens GitHub in a new tab.
3. A Selected work card's link: an internal route → "Play now" HTMX nav
   swap; a full-page route (`/bus-stops`, `/easy-diagram`) → plain "Open"
   link (real page load); an external URL → "Live demo" in a new tab.
4. "See all projects →" swaps to `/projects`.
5. If the content fetch fails, the page shows the title "Vincent Megia" and
   "Couldn't load this page. Please try again shortly." inside the normal
   shell (logged server-side as "get landing public view").
```

---

## UI

```text
web/templates/
├── pages/landing.html               # "landing-content": background layer, hero, carousel, selected-work
└── components/
    ├── carousel.html                # landing-carousel.md
    └── selected-work.html           # Selected work grid
web/static/images/
├── landing-page-bg-light.svg
└── landing-page-bg-dark.svg
```

| State             | Behavior |
| ----------------- | -------- |
| Default           | Hero + carousel + Selected work. |
| No Selected work  | Section omitted (`{{if .SelectedWork}}`). |
| Carousel states   | See `landing-carousel.md`. |
| Error             | `PagesHandler.Home` falls back to the shared placeholder template with a generic message; no raw error. |

---

## HTMX Interactions

| Trigger                    | Method | Endpoint     | Target          | Swap        | `hx-push-url` |
| --------------------------- | ------ | ------------ | --------------- | ----------- | -------------- |
| "View my résumé"            | GET    | `/resume`    | `#main-content` | `outerHTML` | `true`         |
| "See all projects →"        | GET    | `/projects`  | `#main-content` | `outerHTML` | `true`         |
| Selected work "Play now"    | GET    | card's `LiveURL` (internal, not full-page) | `#main-content` | `outerHTML` | `true` |

Full-page and external links are plain anchors with no `hx-*`.

---

## Routes / Handlers

| Method | Path | Handler             | Notes |
| ------ | ---- | ------------------- | ----- |
| GET    | `/`  | `PagesHandler.Home` (`internal/handler/pages.go`) | registered as `GET /{$}`; `ContentTemplate = "landing-content"`, `NavActive = "/"`, `TransparentOverHero = true` |

---

## Data Model

Owned by `docs/features/landing-content-authoring.md`: `landing_hero`
(singleton), `landing_carousel_slides`, `landing_selected_work_items`. Models
are `model.HeroContent`, `model.CarouselSlide`, `model.SelectedWorkItem`
(`internal/model`).

---

## Business Rules / Validation

* A Selected work card's internal link uses the same "Play now" HTMX nav
  swap as `/projects`, except for a full-page route — the LiveURL of a
  `FullPageLoad` `/projects` card (`/bus-stops`, `/easy-diagram`, which set
  their own route CSP) — which renders as a plain same-tab "Open"
  `<a href>` with no `hx-*`. The set comes from `isFullPageRoute`
  (`internal/handler/pages.go`, derived from `projectItems`), exposed to
  `components/selected-work.html` as the `fullPageRoute` template func;
  owner-edited content can link to these, so no per-row flag is stored.
  Carousel slide links are already plain `<a href>`s (no `hx-boost`), so
  they need no such check. Covered by `internal/handler/
  selected_work_test.go`.
* All hero/card text is rendered through `html/template` auto-escaping; URLs
  are validated on write by the content service (see
  `landing-content-authoring.md`'s Security).

---

## Security Considerations

* Content is owner-authored but treated as untrusted at render time
  (auto-escaped, no `template.HTML`).
* External links use `rel="noopener noreferrer"`.
* The landing page adds no scripts of its own beyond the shell's and
  `carousel.js` (an external module).

---

## Testing Plan

* [x] Seeded hero/Selected work/carousel content renders from Postgres —
      `TestEndToEnd` "home page renders the shared shell".
* [x] Selected work links to full-page routes render as plain links, others
      as HTMX nav — `TestSelectedWorkFullPageLinks`, `TestIsFullPageRoute`.
* [ ] The content-fetch error path renders the generic message — untested.
* [ ] Selected work section is omitted when empty — untested.
* [x] The carousel section is omitted with zero slides —
      `TestCarouselOmittedWithNoSlides`.
* [x] Stored `<script>` in hero/slide/work fields renders escaped —
      `TestEndToEnd` "stored <script> in hero/slide/work fields renders
      escaped on /".
* [ ] Playwright coverage of `/`'s content (CTAs navigate, background
      layer doesn't cause horizontal scroll) — none.

---

## Definition of Done

* [x] Hero, carousel and Selected work render from the database.
* [x] Content is editable without a redeploy (via `/settings/content` once
      auth exists, or the JSON API today).
* [ ] Hero imagery decided.
* [ ] Transparent header built, or the flag removed (Open Questions).

---

## Planned: transparent header (not built)

The design below is still the intended behavior of `TransparentOverHero` on
this page; none of it exists yet (`header-scroll.js` is empty).

#### User Flow

```text
1. User loads `/`. Header renders transparent/blurred over the hero: identity
   and nav (from home.md) are legible against the hero via backdrop-blur.
2. User scrolls past the hero → header transitions to solid with a subtle
   shadow/border; identity and nav stay in the same position throughout.
3. User navigates away (any nav link, per home.md) → header is forced solid on
   the destination page immediately, with no leftover transparent state.
4. User navigates back to `/` (identity link, back button, or a fresh load) →
   the transparent-over-hero start state re-applies, unless the user had
   already scrolled past the hero (e.g. via back/forward with restored scroll
   position), in which case it renders solid immediately with no flash.
5. On mobile, the header is always solid — this page's hero is still visually
   present, but the header never goes transparent on a narrow viewport.
```

#### Visual Direction

* **Header background states**:
  * *Transparent* (above the scroll threshold, desktop only): no background
    fill, `backdrop-blur` over the hero so text/nav stay legible against
    whatever hero imagery is behind them.
  * *Solid* (once scrolled past the hero, or on mobile at any scroll position):
    solid background, subtle bottom border or shadow — consistent with
    `tailwind-ui`'s "avoid huge shadows" guidance.
  * The transition between the two is a short opacity/background-color fade,
    not an abrupt cut, and respects `prefers-reduced-motion`.
* **Scroll threshold**: not a fixed pixel value — the hero's actual height,
  measured via an `IntersectionObserver` on a sentinel element at the hero's
  bottom edge, so it stays correct if the hero's size changes across
  breakpoints or content edits.
* Hero's own visual design (imagery, typography treatment, layout) — TBD, see
  Open Questions.

`header-scroll.js` (loaded globally per `home.md`, but its logic exists because
of this page):

* **Scroll-based toggle**: on this page (desktop only — mobile is always solid
  per `home.md`), uses an `IntersectionObserver` watching a sentinel element at
  the bottom of the hero to toggle a class (e.g. `.header--solid`) — not a
  hardcoded scroll-position threshold, so it stays correct if the hero's height
  changes.
* **Navigation-based reset**: listens for `htmx:afterSwap` on `#main-content`
  (globally, on `document`) and, since every nav link in `home.md` uses
  `hx-push-url="true"`, reads `location.pathname` (already updated by the time
  `afterSwap` fires) to decide:
  * Path is **not** `/` → force `.header--solid` immediately and disconnect the
    observer (the destination page has no hero to be transparent over).
  * Path **is** `/` → remove the forced solid state and reconnect the observer
    so the transparent-over-hero start state applies again.
* **Back/forward navigation**: htmx's docs don't specify whether history
  restoration fires `htmx:afterSwap`, so this is handled independently with a
  `window.addEventListener('popstate', ...)` calling the same path-check
  function — `popstate` always fires on browser back/forward regardless of
  whether htmx serves the restore from its cache or a new request, so this
  doesn't depend on htmx's internals at all.
* **Initial-load check**: on a genuine fresh load (including a manual reload),
  runs the same path check immediately — and on `/` specifically, also checks
  whether the sentinel element is already out of view (covers a browser
  restoring scroll position on reload) rather than assuming the page starts at
  the top, so reloading `/` already scrolled past the hero doesn't flash
  transparent before correcting to solid.

This keeps `home.md`'s "only swap `#main-content`" model intact for every nav
link, including navigating back to `/`, instead of falling back to full page
loads to get a correct header state.

Respect `prefers-reduced-motion`: skip the fade transition, just toggle the class.

Planned tests:

* [ ] Header starts transparent over the hero and transitions to solid after
      the scroll threshold, with the transition skipped under
      `prefers-reduced-motion`.
* [ ] Scroll-triggered transition still fires correctly at different hero
      heights/breakpoints (verifies the `IntersectionObserver` approach, not a
      hardcoded threshold).
* [ ] Reloading `/` while already scrolled past the hero renders the header
      solid immediately — no flash of the transparent state.
* [ ] A direct load of a non-landing URL (bookmark, shared link, back/forward)
      renders the correct (solid) header state without needing an HTMX swap to
      occur first.
* [ ] Navigating away from `/` via any nav link correctly forces the header
      solid on the destination page — no leftover transparent state.
* [ ] Navigating back to `/` (identity link, back/forward) correctly re-arms
      the transparent-over-hero start state, unless already scrolled past the
      hero, in which case it's solid with no flash.
* [ ] Browser back/forward correctly resets header state via the `popstate`
      listener, independent of whether htmx serves the restore from cache.
* [ ] Mobile: header remains solid at every scroll position on this page.

---

## Open Questions

* **Transparent header**: build the plan above, or drop
  `TransparentOverHero` and the empty `header-scroll.js`? (Owner decision.)
* Hero imagery — a photo or illustration alongside the copy is still open.

---

## History

### Doc before the wave-3 rewrite (status, scope, UI, routes, open questions, DoD)

#### Status

`Proposed` — partial. This doc specifies the landing page's use of
`docs/features/home.md`'s `TransparentOverHero` flag (the header-over-hero
scroll behavior) — still unimplemented, `header-scroll.js` remains an empty
placeholder, so the flag is currently a no-op. The hero's content (headline,
subhead, CTA) is now decided and implemented — plain left-aligned copy and a
pill CTA in the "Organic" voice (`docs/skills/tailwind-ui/SKILL.md`'s Visual
Style), no imagery yet. See Open Questions for what's still undecided.

#### Scope

**In scope (for now):**

* This page sets `TransparentOverHero: true` when rendering `base.html`.
* A hero section providing a sentinel element at its bottom edge, for
  `header-scroll.js`'s `IntersectionObserver` to watch.
* `header-scroll.js`'s full behavior: `IntersectionObserver`-based toggle,
  reset on HTMX navigation and browser back/forward, initial-load/reload
  flash-avoidance, and the mobile-always-solid override (enforced by `home.md`,
  consumed here).

**Out of scope (undesigned, needs a dedicated pass):**

* Hero imagery — the headline/subhead/CTA copy itself is now implemented
  (`web/templates/pages/landing.html`, `PagesHandler.Home`), but there's no
  photograph or illustration in the hero yet.
* Page sections below the hero — an image carousel now exists there (see
  `docs/features/landing-carousel.md`), followed by a "Selected work" card
  grid (`web/templates/components/selected-work.html`), pulled from a
  claude.ai/design "Personal website and portfolio" project's Home.dc.html
  (see DesignSync and `internal/handler/nav.go`'s `primaryNavItems` doc
  comment for the same project's header/nav pull). Its cards are
  Postgres-backed content (`landing_selected_work_items`), each linking
  straight into a game/demo the same way `/projects` does (see Business
  Rules for the full-page-route exception). The mockup's three fictional
  placeholder cards
  (Fieldnotes/Tidewatch/Loom UI) were removed so this teaser always
  matches what `/projects`' "See all projects" link actually leads to.
  Selected work has since moved to Postgres (`model.SelectedWorkItem`,
  editable via `/settings/content` — see Open Questions and
  `docs/features/landing-content-authoring.md`), so keeping it in step
  with `/projects`' `projectItems` is now a content task, not code.
* Anything about what actually renders inside `#main-content` on this route,
  **except** a decorative page background: a full-bleed layer behind
  `#main-content` (not confined to its `max-w-5xl` column — see
  `landing-carousel.md`'s "Full-bleed technique") now carries a soft
  multi-stop gradient illustration (`web/static/images/landing-page-bg-light.svg` /
  `landing-page-bg-dark.svg`), documented in `landing-carousel.md`'s Visual
  Direction since it shipped alongside that work. The actual hero
  copy/headline/imagery/CTA decision above is still fully open.

#### UI

```text
web/templates/pages/
└── landing.html              # sets TransparentOverHero: true; hero markup TBD

web/static/js/
└── header-scroll.js          # shared with home.md's shell (loaded on every page); full spec below
```

States this feature's UI must handle:

| State                          | Behavior |
| -------------------------------- | -------- |
| Transparent (top, desktop)         | Header has no background fill, blurred over the hero. |
| Solid (scrolled, desktop)          | Header has transitioned to solid after passing the scroll threshold. |
| Solid (mobile, any scroll position) | Header never goes transparent on mobile — enforced by `home.md`. |
| Reload while already scrolled       | Header renders solid immediately on load — no flash of the transparent state. |

#### Routes / Handlers

`GET /` itself is owned by `docs/features/home.md`'s Routes/Handlers table
(`HomeHandler.Index`) — this doc doesn't add a new route, only specifies what
that handler's page sets (`TransparentOverHero: true`) and what it renders once
the hero is designed.

#### Open Questions

* Hero imagery — headline/subhead/CTA are decided and implemented (see
  Scope); a photograph or illustration alongside the copy is still open.
* What sections, if any, follow the hero/carousel/Selected work on this
  page. **Resolved**: Selected work's placeholder cards were replaced with
  the one real project (see Scope) once the Projects feature existed —
  more real work gets added here as it's written up, mirroring
  `docs/features/projects.md`'s Open Questions taking the same stance for
  `/projects` itself.
* **Resolved**: hero copy, carousel slides, and Selected work cards are
  all now Postgres-backed and editable via `/settings/content` — see
  `docs/features/landing-content-authoring.md`.

#### Definition of Done

* [ ] Header-interaction behavior above works end-to-end (this is shippable
      independently of the hero's final visual design, as long as a hero and
      sentinel element exist).
* [ ] All states in the UI table are implemented.
* [ ] Tests cover the behavior in the Testing Plan above.
* [ ] Hero/section content is designed and its own review pass completed before
      this feature is considered fully done — the header-interaction contract
      alone does not constitute a finished landing page.
