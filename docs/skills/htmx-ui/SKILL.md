---
name: htmx-ui
description: Build server-driven interfaces with HTMX and Go templates — layout architecture, fragment rendering, component boundaries, swap transitions and accessibility. Use when adding or changing any HTMX-driven page or interaction.
---

# HTMX UI Skill

## Purpose

Build fast, accessible, server-driven interfaces using HTMX and Go templates.

The application should behave like a modern web application without requiring a SPA framework.

Feature-specific behavior belongs in:

```text
docs/features/
```

---

## Core Principles

Prefer:

```text
Server-rendered HTML
        +
       HTMX
        +
Progressive Enhancement
```

Avoid unnecessary JavaScript.

Use HTMX for interactions that can be naturally represented as HTTP requests.

This skill covers HTMX-specific concerns: template/layout architecture, fragment
rendering, component boundaries, and the CSS needed to make swaps feel good.
General Tailwind conventions (color, spacing, typography, cards, buttons) live in
`tailwind-ui` — do not duplicate them here.

---

## Server-Driven UI

The server is responsible for rendering HTML.

A typical interaction:

```text
User action
    ↓
HTMX request
    ↓
Go handler
    ↓
Service
    ↓
Repository / external system
    ↓
HTML fragment
    ↓
HTMX swaps fragment
```

Do not return JSON simply because the request originated from HTMX.

Return HTML when the browser needs HTML.

---

## HTMX Attributes

Use appropriate attributes such as:

```html
hx-get
hx-post
hx-put
hx-patch
hx-delete
hx-target
hx-swap
hx-trigger
hx-indicator
hx-confirm
```

Keep interactions explicit and easy to understand.

Example:

```html
<button
    hx-post="/devices/123/wake"
    hx-target="#device-123"
    hx-swap="outerHTML"
    hx-indicator="#wake-loading">
    Wake
</button>

<span id="wake-loading" class="htmx-indicator">
    Waking...
</span>
```

---

## HTTP Semantics

Use the appropriate HTTP method.

```text
GET     → retrieve
POST    → create or execute an action
PUT     → replace
PATCH   → update
DELETE  → delete
```

Do not use `GET` for operations that change state.

For example:

```text
POST /devices/:id/wake
POST /devices/:id/shutdown
```

rather than:

```text
GET /devices/:id/shutdown
```

---

## Partial Rendering

Return the smallest useful HTML fragment.

If only one device card changes, do not re-render the entire page.

Prefer:

```html
hx-target="#device-123"
hx-swap="outerHTML"
```

over a full-page refresh.

---

## Layout Architecture

Every page is built from one shared layout, not copy-pasted `<html>` boilerplate.

```text
web/templates/
├── layouts/
│   └── base.html          # <html>, <head>, header, <main>{{block "content"}}, footer
├── pages/
│   ├── home.html           # {{define "content"}} for a full page
│   └── devices.html
└── components/
    ├── header.html
    ├── device-card.html
    ├── status-badge.html
    └── notification.html
```

`base.html` owns the document shell: `<head>` (Tailwind stylesheet, HTMX script,
favicon), the sticky global header, `<main>` with a `content` block, and the footer.
Pages only ever define `content` — they never redeclare the shell.

```html
<!-- layouts/base.html -->
<!doctype html>
<html lang="en">
<head>
    <title>{{block "title" .}}Vincent Megia{{end}}</title>
    <link rel="stylesheet" href="/static/css/app.css">
    <script src="/static/js/htmx.min.js"></script>
</head>
<body class="min-h-screen bg-white text-slate-900">
    {{template "header" .}}
    <main id="main-content" class="mx-auto max-w-5xl px-4 py-8">
        {{block "content" .}}{{end}}
    </main>
</body>
</html>
```

Full page loads render `base` with `content` filled in. HTMX requests render just
the fragment the interaction needs — see "Fragment vs Full-Page Rendering" below.

---

## Component Boundaries

Prefer reusable template components over inlining markup in every page.

Components should have a clear, single responsibility — a `device-card` renders one
device, a `status-badge` renders one status, nothing more.

Avoid excessively small components that make templates difficult to follow (a
`<span>` wrapper is not a component).

A well-formed component template:

* Takes a single, well-defined view-model as its dot context — not the raw DB row.
* Declares its own root element with a predictable `id` (see naming below) so it
  can be targeted directly by `hx-target` or returned as an out-of-band swap.
* Carries its own `hx-*` attributes rather than relying on a parent to wire them up,
  so the component is self-contained wherever it's rendered.

```html
<!-- components/device-card.html -->
{{define "device-card"}}
<div id="device-{{.ID}}" class="rounded-xl border p-5">
    {{template "status-badge" .Status}}
    <h3>{{.Name}}</h3>
    <button
        hx-post="/devices/{{.ID}}/wake"
        hx-target="#device-{{.ID}}"
        hx-swap="outerHTML"
        hx-indicator="#device-{{.ID}}-loading">
        Wake
    </button>
</div>
{{end}}
```

### ID and naming conventions

Consistent IDs are what make `hx-target`, `hx-swap`, and out-of-band swaps reliable.
Use `<resource>-<id>` for the element a component owns, and
`<resource>-<id>-<sub-purpose>` for pieces inside it:

```text
#device-123              device-card root (swap target)
#device-123-loading      its indicator
#device-123-error        its error slot
#devices-list             the collection container an item gets appended into
```

Never generate ad hoc or positional IDs (`#card-1`, `#row`) — they collide across
components and make targets unpredictable.

---

## Fragment vs Full-Page Rendering

Branch on `HX-Request` to serve a full page or just the fragment, reusing one
handler code path. Use out-of-band swaps sparingly for secondary updates.

See `references/fragment-rendering.md` for examples and OOB swap guidelines.

---

## Loading States

Every operation that may take noticeable time should provide feedback.

Use:

```html
hx-indicator="#loading"
```

Example:

```html
<button
    hx-post="/devices/123/shutdown"
    hx-indicator="#shutdown-loading">
    Shutdown
</button>

<span id="shutdown-loading" class="htmx-indicator">
    Shutting down...
</span>
```

Loading indicators should be local to the operation.

Avoid blocking the entire application for a small request.

---

## CSS for Swaps

Style around HTMX's swap lifecycle classes (`.htmx-indicator`, `.htmx-swapping`,
`.htmx-settling`) instead of hand-rolling JavaScript transitions. Keep transitions
short, respect `prefers-reduced-motion`, and avoid layout shift.

See `references/swap-transitions.md` for the class reference, CSS examples and
View Transitions guidance.

---

## Error States

Every important HTMX operation must have a failure path.

Users should understand:

* What failed
* Whether the action happened
* What they can do next

Do not expose internal errors.

Example:

```text
Unable to wake the server.

The device may be offline.
```

---

## Destructive Actions

Actions such as:

* Shutdown
* Restart
* Delete
* Reset

must require explicit user intent.

Use confirmation when appropriate:

```html
hx-confirm="Are you sure you want to shut down this server?"
```

Never execute destructive operations because a user merely opened a page.

---

## Polling

Use polling only when necessary.

Example:

```html
hx-trigger="every 30s"
```

Do not aggressively poll every component.

Prefer event-driven updates or manual refresh when possible.

---

## Navigation

The application uses a reusable global navigation.

The header should contain:

```text
Home                                      Settings
 └── Devices                              ├── Profile
                                          ├── Account
                                          ├── Security
                                          └── Logout
```

The header is sticky and should be implemented once in the application layout.

Do not duplicate navigation markup across pages.

---

## Accessibility

Use semantic HTML.

Prefer:

```html
<button>
<a href="">
<nav>
<header>
<main>
<section>
```

over generic `<div>` elements.

Interactive elements must be keyboard accessible.

Do not rely solely on:

* Hover
* Color
* Animation

to communicate important information.

---

## Forms

Forms must:

* Have labels
* Validate input
* Display errors clearly
* Preserve valid user input when possible
* Work without JavaScript where practical

Server-side validation is mandatory.

---

## HTMX and Authentication

Do not assume an HTMX request is inherently trusted.

Authentication and authorization must be enforced server-side.

HTMX requests are still normal HTTP requests.

---

## Security

Protect against:

* CSRF
* XSS
* Injection
* Unauthorized actions

Escape template output appropriately.

Never render untrusted HTML directly.

---

## Performance

Prefer:

* Small HTML fragments
* Server rendering
* Minimal JavaScript
* Efficient queries
* Appropriate caching

Do not repeatedly reload large sections of the page when only a small component changed.

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

HTMX work is complete when:

* Interaction uses appropriate HTTP semantics.
* Only necessary content is updated.
* The page shares one layout — no duplicated `<html>`/header/footer markup.
* Fragment and full-page rendering share one handler code path, branched on `HX-Request`.
* Component root elements use predictable, collision-free IDs.
* Swap transitions are short, respect `prefers-reduced-motion`, and avoid layout shift.
* Loading state exists where needed.
* Error state exists where needed.
* Destructive actions require confirmation.
* Accessibility is maintained.
* Server-side validation exists.
* No unnecessary JavaScript was introduced.
* The feature's `docs/features/<feature>.md` is updated in the same commit.

