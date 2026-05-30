# Animation And Timing

Use this rule when writing motion, text animation, scene progress, or chart animation.

## Frame-driven motion

Use `useCurrentFrame()` and `interpolate()` for most motion:

```tsx
const frame = useCurrentFrame();
const opacity = interpolate(frame, [0, 24], [0, 1], {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
});
```

Clamp entering and exiting values unless deliberate overshoot is part of the visual design.

## Promo motion baseline

The default promo baseline is not optional: the video should not feel like a PowerPoint export. Avoid scenes where the only motion is text opacity, a slight y-offset, or a static card crossfade. Those can support a beat, but they do not count as the scene's main motion. Give each major beat a few coordinated, frame-driven layers: camera push/pan, parallax background, foreground accent movement, mask reveal, kinetic word emphasis, chart/data animation, or product UI state changes.

Keep motion purposeful. For still-image or product-led scenes, use at least one background motion layer such as a slow push, pan, zoom, or parallax drift, plus one supporting motion layer such as a mask reveal, light sweep/reflection, foreground drift, emphasis word treatment, or counter/path/state change. Product demos should stay readable, so animate the surrounding frame, selection state, counters, paths, or supporting overlays instead of shaking or obscuring the UI. When a shot communicates relationships, flows, checkpoints, or org structure through connectors, default to curved or routed paths rather than raw point-to-point straight lines unless rigid geometry is the actual point of the shot.

## Practical motion vocabulary

When describing or implementing a shot, use concrete motion verbs:

- Background: slow push, pan, drift, zoom, parallax.
- Support: mask reveal, light sweep, soft reflection, foreground float, wipe.
- Product/data: selected-state change, curved path growth, route tracing, rounded-corner path reveal, highlight travel along a path, counter tick, chart range shift.

Fade in/out may help entrances and exits, but do not use fade alone as the whole motion plan for a promo scene.

## Normalized progress

For each scene, compute one or two normalized progress values and derive transforms, opacity, blur, chart values, and masks from them. This keeps timing readable and avoids mismatched animations.

```tsx
const enter = interpolate(localFrame, [0, 24], [0, 1], {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
});
const y = interpolate(enter, [0, 1], [32, 0]);
const scale = interpolate(enter, [0, 1], [0.96, 1]);
```

## Easing

Use `Easing.out(Easing.cubic)` for most entrances, `Easing.in(Easing.cubic)` for exits, and a custom `Easing.bezier(...)` only when the storyboard needs a specific feel.

Use `spring()` sparingly for UI pops, counters, and emphasis. Keep damping high enough to avoid distracting bounce in SaaS or productivity demos.

## Text animation

Use text animation to support meaning, not to decorate every line. Good defaults:

- Fade and slight y-offset for headings.
- Stagger words only for hero claims or short punchlines.
- Highlight important words with frame-driven background width, underline, or color.

These text moves are supporting animation, not a substitute for the scene's main motion layers.

Do not use CSS `animation`, `transition`, or JavaScript timers.

## Time conversion

Use `const { fps } = useVideoConfig()` when converting seconds to frames inside components. Use constants in `timeline.ts` for global shot timing.
