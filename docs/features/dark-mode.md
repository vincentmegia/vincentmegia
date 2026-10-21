# Feature: Dark Mode

## Status

`Shipped`. Server half: `themeFromRequest` (`internal/handler/theme.go`)
allow-lists the `theme` cookie and `base.html` renders `class="dark"` /
`class="light"` / no class on `<html>`. Client half: `theme-toggle.js` flips
the class and sets the cookie. The `dark:` variant is a class-based
`@custom-variant` in `web/static/css/app.css` that falls back to
`prefers-color-scheme` when neither class is present.

Tests: `internal/handler/theme_test.go` (`TestThemeFromRequest`, `go test
./internal/handler/`) and `e2e/resume.spec.js` "dark mode toggle changes the
resume page theme" (Playwright, `make test-e2e`).

## Summary

A site-wide dark-mode toggle, mounted in the header and the mobile nav panel
(both owned by `docs/features/home.md`, which reserves the slot this feature
fills). Preference persists across visits via a cookie read server-side, so the
correct theme is present in the very first HTML response — no flash of the wrong
theme after load.

## Problem / Motivation

Broken out of `docs/features/home.md` rather than left inline: it touches every
page's rendering (not just the header shell), and has enough independent detail —
cookie validation, CSP implications, theming approach — to review and ship on its
own instead of growing the layout doc further.

## Scope

**In scope:**

* Toggle button component, mounted in `header.html` and `mobile-nav-panel.html`
  (both defined in `home.md` — this feature fills the slot, not the mount point).
* Class-based `dark:` Tailwind variant, not `prefers-color-scheme` alone — the
  toggle's explicit choice must be able to override the OS setting.
* Cookie-based persistence (`theme=light|dark`), read server-side in `base.html`
  so the initial response already has the correct theme.
* Server-side validation of the cookie value against an exact allow-list.
* Falling back to `prefers-color-scheme` when no cookie has been set yet.
* Dark colors for the shell. Today the shell uses the Organic semantic
  tokens (`bg-surface`, `bg-paper`, `text-ink`, `border-line`, …), and
  `app.css` redefines those tokens under the `dark:` variant, so header,
  dropdown, mobile panel, footer and placeholder pages switch without
  per-element `dark:` classes.

**Out of scope:**

* The header/mobile-panel structure and mount points themselves (`home.md`).
* Per-page dark-mode color decisions for pages built *after* this feature
  ships (resume, projects, blogs, etc.) — each new page/component is
  responsible for its own `dark:` classes as it's built, following the
  pattern established here for the shell.

---

## User Flow

```text
1. User clicks the theme toggle icon in the header (desktop) or inside the
   mobile nav panel.
2. Theme flips immediately (`dark` class toggled on `<html>`); a `theme` cookie
   is set.
3. On the next page load, reload, or HTMX navigation, the server has already
   read the cookie and rendered the correct theme in the initial HTML — no
   flash of the previous theme.
4. A first-time visitor with no `theme` cookie sees whatever their OS currently
   prefers (`prefers-color-scheme`), until they explicitly toggle.
```

---

## Visual Direction

* Follows `tailwind-ui`'s Dark Mode section: class-based `dark:` variant so an
  explicit user choice can override `prefers-color-scheme`, not just invert
  colors ad hoc per component.
* Toggle icon reflects current state (e.g. a sun/moon swap), not a generic
  on/off switch — the icon itself communicates which mode is active.
* The moon icon is solid/filled (`fill="currentColor"`), not a thin outline
  stroke — a filled crescent reads clearly at the toggle's small size, where
  an outline crescent tends to look faint and hard to spot. The sun icon
  stays as-is.
* Icon/color transition on toggle is short and respects `prefers-reduced-motion`.

---

## UI

```text
web/templates/components/
└── nav-theme-toggle.html    # icon button; reflects current theme state

web/static/js/
└── theme-toggle.js          # toggle + cookie persistence
```

States this feature's UI must handle:

| State                          | Behavior |
| -------------------------------- | -------- |
| Light (no cookie, OS light)        | Renders light; toggle shows "switch to dark" affordance. |
| Dark (no cookie, OS dark)          | Renders dark via `prefers-color-scheme`; toggle shows "switch to light." |
| Light (explicit, `theme=light`)     | Renders light regardless of OS preference. |
| Dark (explicit, `theme=dark`)       | Renders dark regardless of OS preference. |
| Toggle activated                   | Theme flips instantly, cookie is set, no page reload required. |

The shell's colors come from the semantic tokens `app.css` redefines for dark
mode, so these states are visible, not just a class change — see Scope.

---

## Client-side Behavior (non-HTMX)

The toggle is a pure presentation concern with no server round-trip on click, so
it's out of HTMX's model — `htmx-ui`'s "avoid unnecessary JavaScript" principle
allows this small, scoped exception.

`theme-toggle.js`:

* On click, flips the `dark` class on `<html>`, and sets a `theme=light|dark`
  cookie (`path=/`, `SameSite=Lax`, `Secure` in production, long-lived) so the
  preference persists.
* `base.html` reads that cookie server-side on every request and renders the
  `dark` class directly in the initial HTML when set — this is what avoids a
  flash of the wrong theme, not client-side JS run after paint.
* When no `theme` cookie is set yet (first visit), the page falls back to
  `prefers-color-scheme` via CSS; the toggle's first click is what creates the
  cookie and makes the choice explicit and persistent.

Degradation: with `theme-toggle.js` disabled, the theme falls back permanently to
`prefers-color-scheme` with no manual override — a reasonable degraded state, not
a broken one.

Respect `prefers-reduced-motion`: skip any icon/color transition, just toggle.

---

## Routes / Handlers

None. Toggling is pure client-side plus a cookie the server reads passively when
rendering `base.html` — no dedicated endpoint.

---

## Data Model

None. Preference lives entirely in a client cookie, not the database.

---

## Business Rules / Validation

* The server **must** validate the `theme` cookie value against an exact
  allow-list (`light` or `dark` only) before using it to render HTML — a cookie
  is attacker-settable, so anything else (empty, malformed, unexpected value) is
  treated as "not set" and falls back to `prefers-color-scheme`, never
  interpolated as-is into the rendered class.
* The cookie is set with `SameSite=Lax` and `Secure` in production.
* Class-based `dark:` variant is the mechanism — no per-component
  `prefers-color-scheme` media queries scattered through templates.

---

## Security Considerations

* **Cookie injection**: the `theme` cookie must be validated server-side against
  an exact allow-list before use — never interpolate an attacker-settable cookie
  value directly into rendered HTML (see Business Rules).
* **Cookie attributes**: `SameSite=Lax`, `Secure` in production.
* **No inline `<script>` tags**: `theme-toggle.js` is an external file, and the
  no-flash behavior comes from a server-side cookie read rather than a pre-paint
  inline script — keeps the page compatible with a strict CSP with no
  `'unsafe-inline'` needed for scripts, per `go-backend`'s Security Headers.

---

## Testing Plan

* [x] Toggle switches theme and sets the cookie, and the theme persists
      across reload — `e2e/resume.spec.js` "dark mode toggle changes the
      resume page theme" (clicks, asserts `html.dark`, reloads, asserts again).
* [x] A malformed/unexpected cookie value is treated as not set —
      `TestThemeFromRequest` (valid values, missing cookie, malformed and
      suspicious values).
* [ ] Persistence across an HTMX navigation (no reload) — untested; it holds
      by construction since `<html>` is never swapped.
* [ ] First visit with no cookie follows `prefers-color-scheme` — untested
      (the CSS fallback is in `app.css`'s `@custom-variant dark`).
* [ ] Toggle in the mobile panel works and matches the header's — untested.
* [ ] Icon reflects state (sun in light, filled moon in dark via
      `dark:hidden`/`dark:block`) — untested.
* [ ] `prefers-reduced-motion` disables the toggle transition — untested
      (`app.css`'s reduced-motion block lists `[data-theme-toggle]`).
* [ ] Toggling visibly changes the shell's colors in a real browser —
      untested (the test checks only the class).

---

## Definition of Done

* [x] User flow works end-to-end, including persistence — the resume
      Playwright test above; first-visit default is CSS-only and untested.
* [x] All states in the UI table are implemented — `base.html`'s class,
      `@custom-variant dark`, `theme-toggle.js`'s `isDark()` (reads the
      class, else `matchMedia('(prefers-color-scheme: dark)')`).
* [x] `theme` cookie value is validated server-side against an exact
      allow-list before use — `themeFromRequest`, covered by
      `TestThemeFromRequest`.
* [x] Cookie set with `SameSite=Lax`, and `Secure` on HTTPS —
      `theme-toggle.js`'s `setTheme` (`path=/; max-age=` one year).
* [x] No inline `<script>` tags — `theme-toggle.js` is loaded with `src`
      from `base.html`.
* [x] No flash of the wrong theme on reload — the class is in the
      server-rendered `<html>` tag; asserted after reload by the resume test.
* [x] The shell uses the Organic color tokens (`bg-surface`, `text-ink`,
      `border-line`, …), which `app.css` redefines for dark mode, so it
      changes appearance when toggled.
* [ ] Accessibility check (keyboard-operable toggle, focus visible,
      reduced-motion) — the button is a native `<button>` with
      `focus-visible` outline and a state-dependent `aria-label`, but no
      check is recorded.
* [ ] Tests cover the remaining unticked Testing Plan items.

---

## History

### Status note before the wave-3 rewrite

`Shipped`. Every item in Scope is implemented: `internal/handler/theme.go`'s
`themeFromRequest` validates the cookie server-side against the exact
`light`/`dark` allow-list this doc's Business Rules require; `base.html`
reads it into the initial HTML; `nav-theme-toggle.html` defines the real
toggle markup (sun/moon icons, `data-theme-toggle` hook, no `id` — exactly
the collision-avoidance this doc's UI section calls for), mounted in both
`header.html` and `mobile-nav-panel.html` via a shared `{{block
"theme-toggle"}}` slot each reserves; `theme-toggle.js` handles the click,
sets the cookie (`SameSite=Lax`, `Secure` in production), and is an
external file with no inline `<script>`. `e2e/resume.spec.js` has a
passing end-to-end test ("dark mode toggle changes the resume page theme")
covering the toggle-and-persist path. This doc's Status previously read
`Proposed` well after the feature actually shipped — a documentation-drift
audit caught it, traced to `base.html`/`header.html`/`mobile-nav-panel.html`
all still carrying stale "not yet built" comments alongside the real
implementation, which is presumably why this field was never updated.

The Testing Plan and Definition of Done checklists below predate this
correction and have not been re-audited item by item — treat an unchecked
box there as "not yet re-verified against current code," not as "not
implemented." One gap the audit found has since been closed:
`internal/handler/theme_test.go`'s `TestThemeFromRequest` now covers the
allow-list validation directly (valid `light`/`dark` values, a missing
cookie, and several malformed/unexpected values including a
suspicious-but-cookie-legal string, all asserted against `themeFromRequest`
itself). The toggle-and-persist path remains covered only by
`e2e/resume.spec.js`'s one Playwright test, as before.

### Testing Plan and Definition of Done before the wave-3 rewrite

#### Testing Plan

* [ ] Toggle switches theme instantly and sets the `theme` cookie.
* [ ] Theme persists via cookie across reload and HTMX navigation.
* [ ] First visit with no cookie defaults to `prefers-color-scheme`.
* [ ] No flash of the wrong theme on reload once a `theme` cookie exists.
* [ ] A malformed/unexpected `theme` cookie value (not exactly `light` or `dark`)
      is treated as not set and falls back to `prefers-color-scheme`, not
      reflected into the page.
* [ ] Toggle is present and operable in both the header (desktop) and the mobile
      nav panel, and reflects the same state in both places.
* [ ] Toggle icon correctly reflects current state (not a generic switch).
* [ ] Toggle transition respects `prefers-reduced-motion`.
* [ ] Toggling actually changes the visible appearance of the existing shell
      (body background, header, footer, placeholder page text) in a real
      browser — not just the `<html>` class and the toggle icon.

---

#### Definition of Done

* [ ] User flow works end-to-end, including first-visit default and persistence.
* [ ] All states in the UI table are implemented.
* [x] `theme` cookie value is validated server-side against an exact
      allow-list before use — `internal/handler/theme.go`'s
      `themeFromRequest`, covered by `TestThemeFromRequest`.
* [ ] Cookie set with `SameSite=Lax` and `Secure` in production.
* [ ] No inline `<script>` tags exist.
* [ ] No flash of the wrong theme on reload.
* [ ] Existing shell (`body`, header, footer, placeholder page) has `dark:`
      classes and visibly changes appearance when toggled.
* [ ] Accessibility checked (keyboard-operable toggle, focus visible, reduced-motion respected).
* [ ] Tests cover the behavior in the Testing Plan above.
