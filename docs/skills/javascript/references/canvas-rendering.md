# Canvas Rendering

## The render loop

One `requestAnimationFrame` callback per game, calling `update(dt)` then
`render()`. Never put game logic inside `render()` — it runs at the
display's refresh rate, which varies. Compute time-dependent changes from
the elapsed `dt`, not from the frame count.

## Coordinate systems

Maintain a logical coordinate system (game units) separate from canvas
pixels. Scale between them with one transform at render time. This keeps
all logic (hit testing, movement, collision) independent of canvas
resolution and device pixel ratio.

Letterboxing: the canvas fills its container while preserving aspect ratio.
`canvasCoordsFromEvent` converts pointer events from page coordinates to
game coordinates, accounting for the letterbox offset — this is a real,
previously-shipped bug when done naively.

## Drawing helpers

Reuse drawing helpers (`shadeColor`, `outlinedText`, `animeChip`, etc.)
from the shared and hospital modules rather than duplicating drawing code.
A change in a shared drawer shows in every game that imports it — this is
intentional (see `CLAUDE.md` gotchas).

## Canvas state management

Always `save()`/`restore()` around transforms and clip regions. A leaked
transform corrupts every subsequent draw call in the frame and produces
bugs that are painful to trace — the symptom is a correct-looking draw
call that paints in the wrong place.

```js
ctx.save();
ctx.translate(x, y);
ctx.rotate(angle);
drawWidget(ctx, ...);
ctx.restore();
```
