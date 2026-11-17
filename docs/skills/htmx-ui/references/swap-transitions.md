# CSS for Swaps

HTMX adds and removes a small set of classes during a swap lifecycle. Style around
them instead of hand-rolling JavaScript transitions:

```text
.htmx-indicator   hidden by default, shown while a request is in flight
.htmx-request     present on the element (or hx-indicator target) during a request
.htmx-added       present briefly on new content right after it's inserted
.htmx-swapping    present on the old content during the swap-out
.htmx-settling    present on the new content during the settle phase
```

```css
.htmx-indicator { display: none; }
.htmx-request .htmx-indicator,
.htmx-request.htmx-indicator { display: inline-flex; }

#device-list-item.htmx-swapping { opacity: 0; transition: opacity 150ms ease-out; }
#device-list-item.htmx-settling { opacity: 0; }
#device-list-item { opacity: 1; transition: opacity 150ms ease-in; }
```

Use `hx-swap` timing modifiers to give CSS transitions time to run before the DOM
is actually swapped:

```html
<div hx-swap="outerHTML swap:150ms settle:150ms">
```

Guidelines:

* Give a swapped element an explicit min-height or skeleton state if its content
  size varies, so the layout doesn't jump (CLS) while the new fragment loads.
* Keep transitions short (100–200ms) and only on `opacity`/`transform` — animating
  `height` or `width` is expensive and often unnecessary.
* Respect `prefers-reduced-motion` by disabling swap transitions for users who
  request it:

  ```css
  @media (prefers-reduced-motion: reduce) {
      .htmx-swapping, .htmx-settling { transition: none; }
  }
  ```
* If using the View Transitions API (`hx-swap="... transition:true"`), scope
  `view-transition-name` to the same predictable IDs used for `hx-target`, and keep
  the transition to the element that actually changed — not its whole container.
