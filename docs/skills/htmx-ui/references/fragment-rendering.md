# Fragment vs Full-Page Rendering

The same handler often needs to serve both a full page (direct navigation, reload)
and a fragment (HTMX request). Decide which to render based on the `HX-Request`
header, and reuse one templating call for both — do not maintain two copies of the
page logic.

```go
func (h *DevicesHandler) List(w http.ResponseWriter, r *http.Request) {
    devices := h.service.List(r.Context())

    if r.Header.Get("HX-Request") == "true" {
        h.tmpl.ExecuteTemplate(w, "devices-list", devices) // fragment only
        return
    }
    h.tmpl.ExecuteTemplate(w, "base", pageData{Content: "devices", Devices: devices})
}
```

For an interaction that only ever happens via HTMX (e.g. `POST /devices/123/wake`),
render the fragment directly — there is no full-page equivalent to branch on.

Use out-of-band swaps (`hx-swap-oob`) when one request needs to update a secondary
region alongside the primary target — e.g. a device action that also updates a
notification count in the header:

```html
<div id="device-123" hx-swap-oob="outerHTML">...</div>
<span id="nav-notification-count" hx-swap-oob="true">3</span>
```

Keep OOB usage limited to genuinely secondary updates. If a single interaction
regularly needs to update three or more unrelated regions, that's a signal the
page should be restructured rather than stitched together with OOB swaps.
