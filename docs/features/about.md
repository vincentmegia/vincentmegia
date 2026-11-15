# Feature: About Page

## Status

`Shipped`. The QR images themselves are not in the repo yet (supplied at
deployment), so the donate section shows its "coming soon" note until then.

## Summary

The About page at `/about`: a few simple things about Vincent (Principal
Software Engineer, loving dad, loves building things), his hobby of
programming and building things, and a "Support my work" section where a
visitor can donate by scanning a QR code (PayNow or PayPal).

## Problem / Motivation

About is one of the three primary nav links, and used to lead to a
placeholder. Visitors who play the games or use the tools have no way to learn who made
them, and no way to say thanks.

## Scope

**In scope:**

* A short intro about Vincent.
* A "Get in touch" section with links to **LinkedIn**, **GitHub**, and
  **email** (the contact links are static text in the template).
* A hobby section: programming and building things, with a link to
  `/projects`.
* A donate section with one QR card per method: **PayNow** and **PayPal**.
* The QR images are supplied at deployment. A method whose image is missing
  is not shown; with none present the section shows a "coming soon" note.

**Out of scope:**

* Processing or tracking payments. The site only shows an image; the payment
  happens entirely in the visitor's banking or PayPal app.
* Generating QR codes on the server.
* Editing the About text from `/settings` (it lives in the template).
* Any change to the nav. About is already linked.

---

## User Flow

```text
1. Visitor clicks "About" in the header (HTMX swap) or opens /about directly.
2. Page shows the intro, then a "Get in touch" card with LinkedIn, GitHub and
   email links, then the hobby section with a link to Projects.
3. Visitor scrolls to "Support my work" and sees a QR card per available
   method, each labelled (PayNow, PayPal) with a one-line instruction.
4. Visitor scans a QR with their phone; their own app completes the payment.
```

---

## UI

Single stacked column, in the site's Organic look (see `tailwind-ui`).

```text
web/templates/
└── pages/
    └── about.html      defines "about-content", owns <main id="main-content">

web/static/images/about/
├── paynow-qr.png       supplied at deployment
└── paypal-qr.png       supplied at deployment
```

| State               | Behavior |
| ------------------- | -------- |
| Default             | Intro, contact links, hobby section, and a QR card for each method whose image exists. |
| One QR missing      | Only the available method's card is shown; no broken image, no gap. |
| No QR images at all | The donate section stays, with a short "Donation QR codes are coming soon." note. |

Each QR image has alt text naming the method (for example "PayNow QR code for
donating to Vincent"), sits on a white tile in both light and dark mode so it
stays scannable, and is at least 200px square.

---

## HTMX Interactions

| Trigger                    | Method | Endpoint    | Target          | Swap        | Indicator |
| -------------------------- | ------ | ----------- | --------------- | ----------- | --------- |
| "About" nav link (exists)  | GET    | `/about`    | `#main-content` | `outerHTML` | none      |
| "See my projects" link     | GET    | `/projects` | `#main-content` | `outerHTML` | none      |

No destructive actions.

---

## Routes / Handlers

| Method | Path     | Handler              | Auth required | Notes |
| ------ | -------- | -------------------- | ------------- | ----- |
| GET    | `/about` | `PagesHandler.About` | no            | Renders `about-content`; fills `PageData.DonateMethods`. |

---

## Data Model

None. The text lives in the template; the QR codes are static image files.

---

## Business Rules / Validation

* The donate methods are a fixed list in Go (`donateMethods` in
  `internal/handler/pages.go`): PayNow (`paynow-qr.png`) and PayPal
  (`paypal-qr.png`), in that order.
* A method is rendered only if its image file exists under
  `web/static/images/about/`. The check runs on every request, so a file
  added to a running server shows up without a restart.
* The page never states an amount and never claims a donation was received.

---

## Security Considerations

* **Authz**: public page, read-only.
* **Input handling**: none; the page takes no input.
* **Secrets**: none. No account numbers, phone numbers or payment links are
  written in code or config; the only payment detail is whatever is encoded
  in the image files the owner supplies.
* **CSP**: the images are same-origin, so the site-wide
  `default-src 'self'` policy already covers them. No inline script or style.
* **QR integrity**: the QR images are the one thing on this page worth
  tampering with (swapping one redirects donations). They are served only
  from the site's own static directory, never from a third-party host.

---

## Testing Plan

* [x] Handler test (`internal/handler/about_test.go`): `/about` renders the
      real content including the "Get in touch" contact section, as a full
      page and an HTMX fragment.
* [x] Handler test: a method's card appears only when its image file exists;
      with no files the "coming soon" note is rendered.
* [x] Playwright (`e2e/about.spec.js`): direct load with About current in the
      nav, HTMX nav into `/about` and on to `/projects`, phone width without
      horizontal scroll.

---

## Deployment

Commit `paynow-qr.png` and `paypal-qr.png` into `web/static/images/about/`
(square PNGs, exported from the banking app and PayPal). Nothing else changes;
the cards appear once the files are deployed.

---

## Definition of Done

* [x] User flow works end-to-end, including the missing-QR states above.
* [x] All states in the UI table are implemented.
* [x] Tests cover the behavior in the Testing Plan above.
* [x] `CLAUDE.md` feature table lists About and no longer calls it a placeholder.
* [ ] Real QR images added at deployment.
