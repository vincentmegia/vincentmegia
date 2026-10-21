# Feature: Site Layout (Header, Footer, Dynamic Content)

## Status

`Shipped` — the shell every route renders inside. The header nav is a flat
Home/Projects/About link row plus a Résumé button (`internal/handler/nav.go`'s
`primaryNavItems`); Settings is an auth-gated dropdown that is never rendered
today because auth is a stub (`IsAuthenticated` in
`internal/handler/auth_stub.go` always returns `false`). The original
"Home ▾" dropdown design is kept under History at the end of this doc.

Tests: `e2e/nav.spec.js` (Playwright, Chromium + WebKit — `make test-e2e`),
`internal/handler/template_test.go` and `cmd/server/hardening_test.go`
(`go test ./...`), and the DB-gated `cmd/server/e2e_test.go`
(`TestEndToEnd`, runs only with `DATABASE_URL` set — it writes to whatever
database that points at, so never point it at production).

## Summary

The shared page shell every route renders inside: a header with identity and
primary navigation, a dynamic content area, and a footer. This doc owns the
shell's structure and behavior contract — two things that plug into it live in
their own docs: the dark-mode toggle (`docs/features/dark-mode.md`) and the
transparent-over-hero header treatment a page can opt into
(`docs/features/landing-page.md`, not built yet — see Open Questions).

## Problem / Motivation

Without one shared shell, every page would duplicate header/nav/footer markup,
which `docs/skills/htmx-ui`'s Layout Architecture explicitly says to avoid (one
`base.html`, pages only define `content`). This feature establishes that shell so
every other page feature (Resume, Projects, Blogs, Settings) can build on it
instead of reinventing it.

## Scope

**In scope:**

* `base.html` layout: header, dynamic content (`{{.RenderedContent}}`), footer.
* Header identity: an initials avatar ("VM" in a colored circle — there is no
  photo yet) + name, at the left edge, linking to `/`. A no-op while already
  on `/` (see Client-side Behavior).
* Header navigation: a flat, always-visible link row — Home (`/`), Projects
  (`/projects`), About (`/about`) — plus a separate outline-pill **Résumé**
  button (`/resume`). The row is `primaryNavItems` in `nav.go`; the Résumé
  button is hardcoded in `header.html`/`mobile-nav-panel.html`. Blogs,
  Fishing Game and Puzzle Solver are not linked from the header — they stay
  reachable by URL (`/blogs`, `/fishing-game`, `/puzzle-solver`), and the
  games are linked from `/projects` (`docs/features/projects.md`).
* **Settings** dropdown (`settingsMenu` in `nav.go`): Profile, Content,
  Resume, Security, Logout, each with an inline-SVG icon. Rendered
  server-side only for an authenticated site-owner session — anonymous
  visitors receive no Settings markup at all.
* A `TransparentOverHero` flag on `PageData`: `header.html` renders
  `header--transparent` instead of `header--solid` when it is set (only `/`
  sets it). The visual treatment behind that class is not built — see Open
  Questions.
* A slot in the header and mobile panel for the dark-mode toggle
  (`{{block "theme-toggle"}}`, filled by `nav-theme-toggle.html` — see
  `docs/features/dark-mode.md`).
* Footer: copyright line with the current year, the version label, LinkedIn
  and GitHub links with icons.
* Mobile (below `md`): a hamburger button opens a slide-out panel with the
  flat nav links, the Résumé link, the Settings items (authenticated only)
  and the theme toggle.
* Keyboard accessibility for the Settings dropdown and the mobile panel.

**Out of scope:**

* Landing page content and its implementation of `TransparentOverHero` —
  `docs/features/landing-page.md`.
* Dark mode's toggle behavior, cookie persistence, and validation —
  `docs/features/dark-mode.md`.
* Resume, Projects, Blogs, About page content (separate feature docs; Blogs
  and About are placeholders).
* Profile/Security page content, and Logout's real implementation.
* Authentication/session implementation — this feature only consumes
  `IsAuthenticated(r)`.

---

## User Flow

```text
1. User loads any page. Header renders: identity ("VM" + "Vincent Megia",
   links to `/`) and the Home/Projects/About links on the left; the theme
   toggle and the Résumé button on the right — plus "Settings ▾" only for an
   authenticated site-owner session (never, today).
2. User clicks Home/Projects/About/Résumé (or the identity link from another
   page) → the content area is swapped via HTMX and the URL is pushed; the
   header and footer are not re-rendered, and the active link
   (`aria-current="page"`) follows the new path.
3. (Authenticated only) User opens "Settings ▾" → Profile, Content, Resume,
   Security, Logout, each with an icon. Logout is a POST form.
4. On a narrow viewport the desktop links/Résumé/Settings are hidden and a
   hamburger button opens a slide-out panel with the links, Résumé, the
   Settings items (authenticated only) and the theme toggle. Selecting a
   link navigates and closes the panel.
5. The footer is always at the bottom: copyright + version on one side,
   LinkedIn and GitHub links on the other.
```

---

## Visual Direction

Follows `tailwind-ui`'s Visual Style (the "Organic" tokens — `bg-surface`,
`border-line`, `text-ink`, `text-primary`):

* **Identity**: a 32px circle with the initials "VM" (`bg-primary`) + the name
  in the heading font, wrapped in a link to `/`. There is no avatar photo; if
  one is added, its load-failure fallback must be wired from an external
  script, not an inline `onerror` (the CSP forbids inline handlers — see the
  comment in `header.html`).
* **Header background**: solid (`bg-surface`) with a bottom border, sticky
  at the top.
* **Container width**: header, footer, and page content share `max-w-5xl`.
* **Footer**: same horizontal rhythm as the header, smaller muted text.
* **Nav interactions**: short (150ms) color transitions; disabled under
  `prefers-reduced-motion` (`app.css`'s reduced-motion block for
  `#site-header`, `[data-nav-list]`, `[data-theme-toggle]`).

---

## UI

```text
web/templates/
├── layouts/
│   └── base.html              # header + {{.RenderedContent}} + footer; #nav-loading indicator; shell scripts
├── pages/
│   └── <page>.html            # each owns its own <main id="main-content" class="mx-auto max-w-5xl px-4 py-8"> wrapper
└── components/
    ├── header.html            # identity, #primary-nav, Settings (auth only), theme-toggle slot, Résumé button, mobile trigger
    ├── nav-menu.html          # one dropdown (used by Settings)
    ├── mobile-nav-panel.html  # hamburger trigger + slide-out panel
    ├── nav-theme-toggle.html  # dark-mode.md's toggle
    └── footer.html            # copyright, version, social links

web/static/js/
├── nav-menu.js         # Settings dropdown keyboard/mouse behavior, active-link marking, identity no-op, content error state
├── mobile-nav-panel.js # hamburger panel: aria-expanded, focus trap, Escape/outside-tap close
└── header-scroll.js    # empty placeholder, reserved for landing-page.md's scroll behavior
```

States this feature's UI handles:

| State                        | Behavior |
| ----------------------------- | -------- |
| Default (solid)                | Settings closed; the link matching the current path has `aria-current="page"`. |
| Transparent (page opt-in)       | Only `/` sets `TransparentOverHero`; the header gets `header--transparent` but looks the same as solid until landing-page.md's treatment is built. |
| Menu open                      | Settings dropdown opens on click/Enter/Space/ArrowDown; closes on outside click, item selection, Tab out, or `Escape`. |
| Mobile (collapsed)             | Hamburger replaces the desktop links/Résumé/Settings. |
| Mobile panel open               | Panel visible; traps focus; `Escape`, the close button or the backdrop closes it and returns focus to the hamburger; selecting a link closes it. |
| Dark mode                      | See `docs/features/dark-mode.md`. |
| Settings hidden (anonymous)    | Settings markup is absent from the response, not CSS-hidden (`{{if .IsAuthenticated}}` in `header.html` and `mobile-nav-panel.html`). |
| Content loading                 | `#nav-loading` (a thin bar at the top of the viewport) shows while an HTMX nav request is in flight. |
| Content error                   | On `htmx:responseError`, `nav-menu.js` replaces `#main-content` with a generic "Couldn’t load this page. Please try again." |

---

## HTMX Interactions

Selecting a nav item swaps only the content area — header and footer are not
re-rendered. See `htmx-ui` for fragment-vs-full-page rendering
(`Renderer.Render` in `internal/handler/template.go` returns just the content
template when `HX-Request` is set).

**`outerHTML` swap means every content template owns its own `#main-content`
wrapper — this was shipped wrong once already, worth stating explicitly.**
`hx-swap="outerHTML"` (table below) replaces the *entire* `#main-content`
element with the server's response, not just its children. Every page
template (`placeholder.html`'s `{{define "content"}}`, `resume.html`'s
`{{define "resume-content"}}`, and any future page) must therefore render
its own `<main id="main-content" class="mx-auto max-w-5xl px-4 py-8">...
</main>` wrapper — `base.html` does *not* supply one (it just outputs
`{{.RenderedContent}}`). Getting this backwards — relying on `base.html`
to wrap bare inner content, which is how this shipped originally — means a
direct page load (`base.html`'s own render) looks correct, but every HTMX
nav swap destroys `#main-content`'s container classes along with the old
content, leaving the new page full-bleed with no `max-w-5xl`/padding. This
went undetected on the plain placeholder page (a heading and one line of
text doesn't look obviously broken without a container) until the resume
page's richer layout made it unmistakable. Regression coverage:
`internal/handler/template_test.go`'s `assertMainContentContainer` (both
the full-page and fragment render paths) and `e2e/nav.spec.js`'s "container
survives an HTMX nav swap" tests, which specifically navigate via the
dropdown rather than a direct page load — a direct load alone can't catch
this class of bug, since it only ever exercises `base.html`'s own
(correct) wrapping.

Every `GET` row uses `hx-push-url="true"`, so refresh, back/forward and
bookmarking work; the pushed URL (`location.pathname`) is what
`nav-menu.js` uses for active-link marking after a swap.

| Trigger                     | Method | Endpoint             | Target           | Swap        | `hx-push-url` | Indicator      |
| ---------------------------- | ------ | ---------------------- | ----------------- | ----------- | -------------- | --------------- |
| Identity (initials + name)    | GET    | `/`                    | `#main-content`   | `outerHTML` | `true`         | `#nav-loading`  |
| Home (flat link)              | GET    | `/`                    | `#main-content`   | `outerHTML` | `true`         | `#nav-loading`  |
| Projects (flat link)          | GET    | `/projects`            | `#main-content`   | `outerHTML` | `true`         | `#nav-loading`  |
| About (flat link)             | GET    | `/about`               | `#main-content`   | `outerHTML` | `true`         | `#nav-loading`  |
| Résumé (button)               | GET    | `/resume`              | `#main-content`   | `outerHTML` | `true`         | `#nav-loading`  |
| Settings ▾ → Profile / Content / Resume / Security | GET | `/settings/profile`, `/settings/content`, `/settings/resume`, `/settings/security` | `#main-content` | `outerHTML` | `true` | `#nav-loading` |
| Settings ▾ → Logout           | POST   | `/logout`              | n/a — plain `<form method="post">`, a real navigation | n/a | n/a | — |

Only the identity link is a no-op on `/`; the Home link re-fetches `/` like
any other nav click.

Logout is a plain form POST; the stub handler redirects to `/` (302). Its
real mechanism belongs to the auth feature. No `hx-confirm` — logging out
destroys no data.

---

## Client-side Behavior (non-HTMX)

### `nav-menu.js`

* **Settings dropdown**: click toggles; Enter/Space/ArrowDown on the trigger
  opens and focuses the first item; ArrowUp/ArrowDown wrap through items;
  Tab closes; clicking an item closes its menu; outside click closes;
  `Escape` closes and returns focus to the trigger. `Escape` is handled by
  one `document`-level listener because WebKit/Safari does not focus a
  `<button>` on click, so element-scoped listeners never fire for a
  mouse-opened menu there.
* **Active link**: on load, after every `htmx:afterSwap` and on `popstate`,
  every `[data-nav-link]` whose path equals `location.pathname` gets
  `aria-current="page"` and `nav-link--active`; the server also sets it on
  first render from `PageData.NavActive`.
* **Identity no-op**: cancels `htmx:beforeRequest` for the
  `[data-identity-link]` element when `location.pathname === '/'`, so no
  request or swap happens. (It lives here, not in `header-scroll.js`, which
  is still empty.)
* **Content error**: see the UI states table.

### `mobile-nav-panel.js`

* Hamburger toggles `aria-expanded` and the panel's `hidden` class; opening
  focuses the first focusable item.
* While open, Tab/Shift+Tab wrap inside the panel and a `focusin` guard pulls
  stray focus back in; `Escape`, the close button and the backdrop close it
  and refocus the hamburger.
* The panel is JS-only — there is no `<details>` no-JS fallback.

### `header-scroll.js`

Empty placeholder, loaded on every page. Whatever later drives the
transparent/solid header (landing-page.md) must reflect the *current* page's
`TransparentOverHero` after an HTMX swap, back/forward and reload, since the
header is never re-rendered by swaps.

---

## Routes / Handlers

This feature owns the shell, plus the shell-level routes served by
`PagesHandler` (`internal/handler/pages.go`), all registered in
`cmd/server/main.go`'s `newMux`.

| Method | Path                  | Handler                     | Auth required | Notes |
| ------ | ---------------------- | ---------------------------- | ------------- | ----- |
| GET    | `/` (`/{$}`)          | `PagesHandler.Home`          | no            | landing page content: `landing-page.md` |
| GET    | `/projects`            | `PagesHandler.Projects`      | no            | `projects.md` |
| GET    | `/puzzle-solver`       | `PagesHandler.PuzzleSolver`  | no            | `puzzle-solver.md` |
| GET    | `/blogs`               | `PagesHandler.Blogs`         | no            | placeholder |
| GET    | `/about`               | `PagesHandler.About`         | no            | placeholder |
| GET    | `/settings/profile`    | `PagesHandler.Profile`       | yes           | placeholder; anonymous → 302 `/login` (`requireOwnerAuth`) |
| GET    | `/settings/security`   | `PagesHandler.Security`      | yes           | placeholder; anonymous → 302 `/login` |
| POST   | `/logout`              | `PagesHandler.Logout`        | no (stub)     | stub: 302 to `/`; no session to destroy yet |
| GET    | `/resume`              | `ResumeHandler.Index`        | no            | `resume.md` |
| GET    | `/settings/content`    | `LandingContentHandler.Index`| yes           | `landing-content-authoring.md` |
| GET    | `/settings/resume`     | `ResumeAdminHandler.Index`   | yes           | `resume-content-authoring.md` |
| GET    | `/static/`             | `http.FileServer` via `noCacheStatic` | no   | `Cache-Control: no-cache`; no directory listings or dotfiles |

`/login` does not exist yet, so the redirect lands on a 404 until real auth
ships.

---

## Data Model

None. The identity and nav entries are hardcoded in `nav.go`/`header.html`.
`NavItem.Icon` is `template.HTML` built only from Go constants — anything
database-driven in future must go through normal auto-escaping instead.

---

## Business Rules / Validation

* The footer version is `main.Version` (default `"dev"`), overridable at
  build time with `-ldflags "-X main.Version=…"`; `versionLabel` prints `dev`
  or `v<version>`. Nothing in `Makefile` sets it today, so the footer shows
  `dev` (see Open Questions).
* The link matching the current path is marked active from
  `location.pathname` (and `PageData.NavActive` on first render), so it stays
  right across refresh and back/forward.
* `/static/*` responses carry `Cache-Control: no-cache` (`noCacheStatic`), so
  a fixed JS/CSS file is revalidated on the next load instead of served stale
  (Safari did this).
* External links (LinkedIn, GitHub) open in a new tab with
  `rel="noopener noreferrer"`.
* The initials avatar has `role="img"` and `aria-label="Vincent Megia"`.
* Settings markup is only in the HTML for an authenticated site-owner
  session — omitted entirely for anonymous visitors.
* Mobile hides the desktop links/Settings behind the hamburger
  (`hidden md:flex`/`md:block`).
* Icons are inline SVG built by `icon()` in `nav.go` — no icon font, no JS
  dependency.

---

## Security Considerations

* **Authz**: Settings is an admin-only area. Its routes check
  `requireOwnerAuth` server-side regardless of the nav, and its nav markup is
  omitted (not CSS-hidden) for anonymous visitors.
* **Unauthenticated `/settings/*`**: 302 to `/login` rather than 404 —
  credentials are the real protection, and it is the only way for the owner
  to find the login page (there is no Login link).
* **No inline `<script>`** anywhere in the shell — all shell scripts are
  external files, so the CSP needs no `'unsafe-inline'` for scripts.
* **htmx's auto-injected `<style>`** for `.htmx-indicator` is disabled by
  `base.html`'s `<meta name="htmx-config"
  content='{"includeIndicatorStyles":false,"allowEval":false}'>` (it would
  violate the CSP on every load); `app.css` styles the indicator itself.
* **Error messages**: the content error state is a fixed generic message,
  never a raw error.
* **Logout is a `POST`**, never a `GET`.
* **CSRF**: every POST/PUT/PATCH/DELETE passes through
  `middleware.CrossOriginProtection` (Go's `http.CrossOriginProtection`,
  wired in `cmd/server/main.go`'s `newHandlerChain`), which answers 403 to a
  browser request whose `Sec-Fetch-Site` is `cross-site`/`same-site` or whose
  `Origin` names another host. `TestHandlerChain_RejectsCrossSiteWrites`
  covers `POST /logout`. It does not stop non-browser callers (they send
  neither header); there is no session-bound CSRF token, which the auth
  feature should add alongside this check.
* **External links**: `rel="noopener noreferrer"` against tabnabbing.

---

## Testing Plan

* [x] Every content template's `#main-content` wrapper survives an HTMX nav
      swap, not just a direct load — `/resume` and a placeholder route
      (About): `e2e/nav.spec.js` "container survives an HTMX nav swap";
      `internal/handler/template_test.go` `TestRenderFullPage`,
      `TestRenderHTMXFragment`, `TestRenderPlaceholderRoutesUnaffected`.
* [x] Header renders the flat Home/Projects/About links and the Résumé
      button — `e2e/nav.spec.js` "renders Home/Projects/About as plain links
      plus a Résumé button"; `TestEndToEnd` "home page renders the shared
      shell" checks `id="primary-nav"`.
* [x] Nav clicks update the URL bar (`hx-push-url`) and the active link —
      `e2e/nav.spec.js` "marks the current page with aria-current…",
      "Résumé button navigates to /resume via HTMX".
* [x] No console errors (including CSP violations) on load of `/` and
      `/resume` — `e2e/nav.spec.js` "no console errors on load…".
* [x] Mobile: hamburger opens the panel; selecting a link navigates and
      closes it — `e2e/nav.spec.js` "opens, navigates, and closes on
      selection".
* [x] Unauthenticated `/settings/profile` redirects — `TestEndToEnd`
      "settings routes require auth" (`/settings/content` and
      `/settings/resume` in the following subtests).
* [x] Cross-site `POST /logout` is refused, same-origin passes —
      `cmd/server/hardening_test.go` `TestHandlerChain_RejectsCrossSiteWrites`.
* [ ] Anonymous response body contains no Settings markup
      (`settings-menu`) — untested.
* [ ] Settings dropdown: items/icons, keyboard operation, item click closes
      it — untested (unreachable while auth is a stub).
* [ ] Mobile panel focus trap and `Escape`/backdrop close returning focus —
      untested.
* [ ] Identity link is a no-op on `/` — untested.
* [ ] Content error state shows the generic message — untested.
* [ ] Footer shows the version and working LinkedIn/GitHub links — untested.
* [ ] `/security` placeholder redirect (`/settings/security`) — only
      `/settings/profile` is checked.

---

## Definition of Done

* [x] User flow works end-to-end for anonymous visitors (nav, Résumé,
      mobile panel) — `e2e/nav.spec.js`.
* [x] Logout requires `POST` and cross-site POSTs are refused —
      `newMux` registers only `POST /logout`; `TestHandlerChain_RejectsCrossSiteWrites`.
* [x] URL bar, refresh and back/forward behave across nav destinations
      (`hx-push-url`, `popstate` re-marking) — `e2e/nav.spec.js`.
* [x] No inline `<script>` tags in the shell — every `<script>` in
      `base.html` has a `src`; `e2e/nav.spec.js` "no console errors…" would
      catch a CSP violation.
* [x] Settings markup is server-side gated (`{{if .IsAuthenticated}}` in
      `header.html`/`mobile-nav-panel.html`) — but not yet asserted by a test.
* [ ] Settings dropdown verified end-to-end with a real authenticated
      session — blocked on the auth feature.
* [ ] Accessibility check (keyboard through the Settings dropdown and mobile
      panel, contrast) — not recorded.
* [ ] Tests cover the remaining unticked Testing Plan items.

---

## Open Questions

* **Transparent-over-hero header**: `/` sets `TransparentOverHero`, but
  `header-scroll.js` is empty and `.header--transparent` has no visual
  treatment, so the header is solid everywhere. Build it (landing-page.md) or
  drop the flag.
* **Footer version**: no build sets `-ldflags -X main.Version`, so production
  shows `dev`. Add it to `make build` / the Render build command, or remove
  the label.
* **Avatar photo**: only initials exist; a photo needs an external-script
  load-failure fallback.
* **Logout and `/login`**: wait on the auth feature (sessions, real logout,
  a CSRF token alongside `CrossOriginProtection`).

---

## History

### Original Status note (superseded by the flat-nav redesign)

`Proposed` — the header nav was later redesigned (see the note under
Scope): the original "Home ▾" dropdown described throughout this doc's
User Flow/HTMX Interactions/UI sections below was replaced by a flat
Home/Projects/About link row plus a Résumé button, pulled from a
claude.ai/design "Personal website and portfolio" project (see
`internal/handler/nav.go`'s `primaryNavItems` doc comment for the full
rationale). Settings stays a dropdown, unchanged. Sections below still
describe the dropdown-based Home menu as originally specified; treat the
Scope note and the actual templates (`header.html`, `mobile-nav-panel.html`,
`nav.go`) as the source of truth where they disagree with this doc's prose.

### Original "Home ▾" dropdown design (superseded)

Original Scope bullets for identity and header navigation:

* Header identity: avatar photo + name, anchoring the left edge of the header
  before the nav, linking to `/` — the only way back to the landing page from
  anywhere else in the header. No-op if already on `/`.
* Header navigation: originally a **Home** dropdown menu (next to identity)
  and a right-aligned **Settings** menu, both dropdown triggers only. **This
  changed**: Home is now a flat, always-visible link row — Home/Projects/About
  — plus a separate outline-pill **Résumé** button, per the redesign noted
  under Status. Settings is unchanged (still a dropdown trigger, still
  auth-gated). Blogs and Fishing Game are no longer linked from the header at
  all — they stay reachable at their existing URLs (`/blogs`,
  `/fishing-game`), just not from top-level nav. Fishing Game later gained a
  second entry point outside the header, though: `/projects` links to it
  directly (`docs/features/projects.md`'s `Project.External` field).
* ~~**Home** submenu: Resume, Projects, Blogs.~~ Superseded — see above.
* **Settings** submenu: Profile, Security, Logout. Rendered server-side only for
  an authenticated site-owner session — anonymous visitors receive no Settings
  markup at all (this is an admin-only area, not a public multi-user feature).
* An icon for every top-level menu and every submenu item.

Original User Flow:

```text
1. User loads any page. Header renders: identity (avatar + name, links to `/`)
   on the left, "Home ▾" next to it, and — only if authenticated as the site
   owner — "Settings ▾" on the right. Header is solid unless the current page
   opts into `TransparentOverHero` (see `docs/features/landing-page.md`).
2. ~~User clicks/focuses "Home" → dropdown opens showing: Resume, Projects, Blogs (each with an icon).~~ Superseded: "Home", "Projects", and "About" are now plain links navigated to directly, sitting next to a separate "Résumé" button — no dropdown, no icons.
3. User clicks/focuses "Settings" (only visible when authenticated) → dropdown
   opens showing: Profile, Security, Logout (each with an icon).
4. User selects a submenu item, or clicks the identity block to return to `/` →
   content area updates via an HTMX swap; header and footer are not replaced,
   but the header re-evaluates its transparent/solid state for the new page.
5. On a narrow viewport, "Home ▾"/"Settings ▾" are replaced by a single hamburger
   button; tapping it opens a slide-out panel with both menus and the theme
   toggle fully expanded. The header on mobile is always solid.
6. Footer is always visible at the bottom of the page: version + tagline on one
   side, LinkedIn and GitHub icons/links on the other.
```

Original identity Visual Direction (no avatar photo was ever added; the
initials fallback is what renders):

* **Identity**: circular avatar photo (e.g. 32–36px) + name as a text wordmark,
  left of the Home menu, wrapped in a link to `/`. If the avatar image fails to
  load, fall back to initials in a colored circle rather than a broken image icon.

Original UI tree (`nav-identity.html` and `avatar.jpg` were never created;
identity lives inline in `header.html`):

```text
web/templates/
├── layouts/
│   └── base.html            # header + {{.RenderedContent}} + footer; reads theme cookie server-side (see dark-mode.md)
├── pages/
│   └── <page>.html          # each defines its own <main id="main-content" class="mx-auto max-w-5xl px-4 py-8"> wrapper — see below
└── components/
    ├── header.html          # identity + nav-menu twice (left/right) + theme-toggle slot + mobile-nav-trigger; accepts a "transparent-over-hero" flag
    ├── nav-identity.html    # avatar + name, with initials fallback, links to /
    ├── nav-menu.html        # one dropdown: label, icon, list of submenu items
    ├── mobile-nav-panel.html # hamburger trigger + slide-out panel (both menus + theme-toggle slot)
    └── footer.html          # version, tagline, social links

web/static/
├── images/
│   └── avatar.jpg           # header identity photo
└── js/
    └── header-scroll.js     # reset-on-navigation logic; full spec in docs/features/landing-page.md (the only current consumer of TransparentOverHero)
```

Original assignment of the identity no-op to `header-scroll.js` (it was
implemented in `nav-menu.js` instead):

* The identity link's "no-op while already on `/`" behavior (see HTMX
  Interactions) is also this script's responsibility — a click handler that
  checks `location.pathname` before letting the request fire.

Original identity Business Rule (the flat Home link now also navigates to `/`):

* The identity block (avatar + name) is the only header element that links to
  `/`; "Home" and "Settings" are dropdown triggers and never navigate directly.
  Clicking it while already on `/` is a no-op — no request, no swap.

Original Routes / Handlers table (these handler names were never written;
the real ones are `PagesHandler.*` — see Routes / Handlers above):

| Method | Path                  | Handler                  | Auth required | Notes |
| ------ | ---------------------- | -------------------------- | ------------- | ----- |
| GET    | `/`                    | `HomeHandler.Index`        | no            | landing page; content is `landing-page.md`, but the route itself belongs to this shell |
| GET    | `/resume`              | `ResumeHandler.Index`      | no            | separate feature |
| GET    | `/projects`            | `ProjectsHandler.Index`    | no            | separate feature |
| GET    | `/blogs`               | `BlogsHandler.Index`       | no            | separate feature |
| GET    | `/settings/profile`    | `ProfileHandler.Index`     | yes           | separate feature; unauthenticated requests redirect to login (see Security Considerations) |
| GET    | `/settings/security`   | `SecurityHandler.Index`    | yes           | separate feature; unauthenticated requests redirect to login (see Security Considerations) |
| POST   | `/logout`              | `AuthHandler.Logout`       | yes           | separate feature |

Original CSRF requirement (now met for browsers by
`middleware.CrossOriginProtection`):

* **CSRF**: `POST /logout` must be covered by the app's CSRF protection.

### Testing Plan and Definition of Done before the wave-3 rewrite

* [x] Every content template's `#main-content` wrapper (classes and all)
      survives an HTMX nav swap, not just a direct page load — verified for
      both `/resume` and a placeholder route (`e2e/nav.spec.js`,
      `internal/handler/template_test.go`).
* [x] Header renders on every page with the flat Home/Projects/About links,
      the Résumé button, and Settings (only when authenticated) present.
* [x] Flat nav links go to `/`, `/projects`, `/about`; Résumé button goes to `/resume`.
* [ ] Settings ▾ shows Profile, Security, Logout with correct icons and links.
* [x] Active nav item reflects the current route (`aria-current="page"`, driven by `PageData.NavActive`).
* [ ] The Settings dropdown is operable via keyboard only.
* [ ] Selecting a Settings dropdown item closes it (not just outside-click/Escape) — regression coverage in `e2e/nav.spec.js`.
* [ ] No console errors (including no CSP violations) on initial load of `/` or `/resume` — `e2e/nav.spec.js`.
* [ ] Nav selection swaps `#main-content` without reloading header/footer.
* [ ] Nav clicks update the URL bar (`hx-push-url`); refreshing on `/projects` (or
      any nav destination) loads that page directly, not the landing page.
* [ ] Footer shows the correct build version and working LinkedIn/GitHub links.
* [ ] Mobile viewport: hamburger opens the slide-out panel; both menus and the
      theme toggle are reachable inside it; panel traps focus and `Escape`/outside
      tap closes it, returning focus to the hamburger button.
* [ ] Mobile header is solid at every scroll position, on every page, including
      pages that opt into `TransparentOverHero`.
* [ ] Unauthenticated request to `/settings/profile` or `/settings/security`
      redirects to login rather than rendering the page or leaking its content.
* [ ] Anonymous response body (view source, not just visual inspection) contains
      no Settings menu markup; an authenticated site-owner session does.
* [ ] Content error state never renders a raw error string or stack trace.
* [ ] Avatar renders correctly; simulated load failure shows the initials fallback.
* [ ] Header, content, and footer share the same container max-width at each breakpoint.
* [ ] Identity block links to `/`, is reachable/operable via keyboard, and is a
      no-op when already on `/`.
* [ ] Clicking a nav item on a page with `TransparentOverHero` active correctly
      forces the header solid on the destination page — no leftover transparent
      state (full scroll/threshold coverage lives in `landing-page.md`'s testing plan).

* [ ] User flow works end-to-end, including edge cases above.
* [ ] All states in the UI table are implemented, including cross-referenced
      states owned by `dark-mode.md` and `landing-page.md`.
* [ ] Header identity (avatar + name) renders correctly with a working fallback.
* [ ] Destructive/session-ending actions (Logout) require `POST` and are wired securely.
* [ ] Handler/service/repository boundaries followed (`go-backend`) for any routes this feature touches directly.
* [ ] URL bar, refresh, and browser back/forward all behave correctly across every nav destination (`hx-push-url`).
* [ ] Mobile hamburger/slide-out panel is fully keyboard accessible and traps focus.
* [ ] Settings menu markup is verified absent (response body, not just visual) for anonymous visitors.
* [ ] No inline `<script>` tags exist anywhere in this shell.
* [ ] Accessibility checked (keyboard nav through dropdowns and mobile panel, focus management, semantic HTML, contrast, reduced-motion respected).
* [ ] Tests cover the behavior in the Testing Plan above.
