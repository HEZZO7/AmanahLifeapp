# Sequencing And Transitions

Use this rule when arranging shots, delaying elements, nesting scenes, or adding transitions.

## Scene timeline

Keep storyboard timing in `src/timeline.ts`. A scene should have a start frame, duration, role in the story, visual copy, and any asset references needed by that scene.

Inside a scene component, prefer local frame/progress:

```tsx
const frame = useCurrentFrame();
const localFrame = frame - scene.from;
const progress = interpolate(localFrame, [0, scene.duration], [0, 1], {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
});
```

For promo videos, avoid one long static state per scene. If a scene lasts more than about 6 seconds, split it into internal beats with nested `Sequence`s or local progress windows so something meaningful changes every 1-2 seconds: product state, chart values, camera framing, captions, masks, reflections, or foreground accents. A slow fade on top of a frozen composition is not enough.

## Sequence usage

Use `<Sequence from={...} durationInFrames={...}>` to place scene layers and product demo beats. Remember that `useCurrentFrame()` inside a `Sequence` starts at `0` for that sequence.

Use `layout="none"` when the default absolute-fill wrapper would interfere with an existing layout.

Remember that `Sequence` without `layout="none"` wraps children in the default absolute-fill layout. That wrapper inherits the same `AbsoluteFill` flex-column behavior, so use `layout="none"` when you already own the container layout or when a horizontal row/grid would be distorted by the wrapper.

## Series usage

Use `<Series>` for strictly sequential sections. For promo videos with overlapping scene elements, a timeline array plus `Sequence` is usually clearer.

## Transitions

Prefer simple frame-driven crossfades, slides, wipes, or masks. Add `@remotion/transitions` only when the storyboard genuinely benefits from reusable transition primitives. Fade-only scene cuts may support a transition, but they do not replace the scene's internal motion plan.

Keep transitions short enough that the product remains readable. Transitions that overlap scenes reduce total timeline duration; overlays do not.

Do not let the whole video become a list of slide cuts. Use transitions to carry visual energy between beats, such as a foreground wipe, media match cut, light sweep, zoom-through, or product-panel move, while keeping the story and UI legible. If a still-image scene looks fine only at the cut points but remains frozen inside the shot, it will still read like a slide deck and needs more internal beat changes.

## Product demo timing

Simulate user flows with frame-driven state:

- Change selected tab, table row, chart range, or form progress by frame.
- Avoid real user events, browser recordings, and live backend calls.
- Keep each demo beat visually understandable for at least one second.
