# Layout And Text

Use this rule when adapting landscape/portrait/square output, fitting text, or laying out dense product demos.

## Aspect ratios

The template ships three orientations:

- Landscape `1920x1080` (16:9)
- Portrait `1080x1920` (9:16)
- Square `1080x1080` (1:1)

When the export uses a different orientation than the storyboard was designed for, the source content is centered with black bars (top/bottom for narrower targets, left/right for taller targets) by `AspectFrame`. When source and target match, the content fills the frame.

For non-default sizes (4K, 720p, 4:5 social, etc.) the same Composition is reused via `--props='{"width":N,"height":M}'`. `sourceOrientation` and `targetOrientation` should still describe the closest design intent so the aspect framing behaves correctly.

Use the template aspect-frame components instead of stretching the source UI.

Treat page demos like camera-framed viewports. It is fine if a long page extends below the fold in a given shot; do not shrink the whole page until text and controls become unreadable just to fit everything at once. Choose the most relevant viewport or section per shot, then use another shot or a controlled scroll/pan when later content matters.
For page-based `ui-demo` shots, the embedded browser/app window should usually be the dominant inset subject, not a small decorative panel surrounded by empty atmosphere. If one column, panel, or state matters, keep the same page frame large enough to read and use crop/highlight, push-in, pan, or controlled scroll inside that frame instead of shrinking the whole window to make room for a large side text block.

## Safe layout

Keep key copy, product UI, and logos away from edges. Use stable dimensions for cards, demo frames, charts, counters, and text blocks so animation does not resize the layout.

Compose promo scenes in layers: background for atmosphere, foreground showcase modules for the thing the viewer should actually inspect. If a feature, result, object, or workflow state is important to the shot, give it a readable foreground frame/panel/card instead of leaving it only in the background art.

Do not place large text over detailed product UI unless the UI is intentionally backgrounded.
If promo headings, captions, node labels, bar labels, or numeric metrics sit over textured art, glow, or a similar-color background, either move them into a clean copy area or add local contrast protection such as a scrim, ribbon, pill, card, stroke, shadow, or a higher-contrast text color. Do not rely on accent-colored text placed directly on a near-accent background without separation.

Video CTAs should read as video graphics: end-card copy, a logo lockup, an info strip, a URL/account line, or a QR placeholder. Avoid final CTA visuals that look like interactive web controls, including rounded primary buttons, hover or pressed states, cursor/click affordances, fake input boxes, or arrow buttons meant to trigger navigation. UI buttons are fine inside a product demo shot when they show the actual flow, but do not reuse that treatment as the closing conversion CTA.

Do not rely on `AbsoluteFill` defaults for horizontal bands, comparison rows, step strips, or two-column showcase modules. `AbsoluteFill` defaults to `display: flex` and `flexDirection: column`; if the scene needs horizontal placement, set `flexDirection: "row"` explicitly or use a plain `div` wrapper. Forgetting this usually makes cards stack vertically, stretch on the wrong axis, or hug one side of the frame.

## Text fitting

Shorten copy first. If text still risks overflow:

- Use line breaks in the storyboard copy.
- Cap heading size per scene instead of scaling with viewport width.
- Use `@remotion/layout-utils` only when dynamic text genuinely needs measurement.

Keep letter spacing at `0` unless a specific brand treatment requires otherwise.

## Typography hierarchy

Hero-sized type belongs in open scenes, not compact panels. Product demo overlays should use tighter headings and smaller labels so the app remains readable.

## Measuring text

When measuring text, load fonts first and use the same font family, size, weight, and letter spacing for measurement and rendering.
