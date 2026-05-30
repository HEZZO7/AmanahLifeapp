# Core Remotion Rules

Use these rules when editing `src/Root.tsx`, composition props, schemas, timeline constants, or global Remotion setup.

## Composition defaults

- Keep MGX promo compositions in `src/Root.tsx`.
- The template registers three preset Compositions, all sharing the same component and prop schema:
  - `PromoLandscape` defaults to `1920x1080` at 30fps.
  - `PromoPortrait` defaults to `1080x1920` at 30fps.
  - `PromoSquare` defaults to `1080x1080` at 30fps.
- Each Composition uses `calculateMetadata` so `width`, `height`, and `fps` props can override the metadata at render time.
- Total duration is not a prop — it is computed by `getPromoTotalSeconds()` from the `start`/`duration` of `promoScenes` in `src/timeline.ts`. To change overall length, rewrite the scenes; the composition length follows.
- Keep prop schemas as top-level `z.object(...)` values with `width / height / fps` declared as optional.

Use Remotion package versions as a matched set. The template pins Remotion packages to `4.0.453` and `zod` to `4.3.6`; do not mix Remotion package versions.

## Props and metadata

The promo schema accepts:

- `sourceOrientation`: `"landscape" | "portrait" | "square"` — how the storyboard content was designed.
- `targetOrientation`: `"landscape" | "portrait" | "square"` — how the export should look.
- `width`, `height` (positive integers, optional) — composition pixel size.
- `fps` (positive number, optional) — composition fps. Scene timing follows because `PromoVideo.tsx` reads fps from `useVideoConfig()`.

Use `defaultProps` for stable render inputs. Props must be serializable and should be small enough for the Remotion sidebar to inspect.

When you need additional dynamic metadata, add it inside the existing `calculateMetadata` helper. Do not call live backend APIs during render. If project data is needed, snapshot it into local fixtures before rendering.

Do not add a `durationSeconds` or similar prop that would shorten or lengthen the timeline at render time. Trimming the composition would silently drop later scenes (and their AI video / audio sources). Length is a storyboard concern: change `promoScenes` instead.

## Timeline schema consistency

The starter promo template keeps one lightweight runtime contract:

- `src/timeline.ts` defines `PromoScene`, `promoScenes`, and `promoAudio`.
- `src/PromoVideo.tsx` sequences scenes and owns the global BGM track.
- `src/scenes/*` owns scene-level visuals plus any scene-local narration/media behavior.

If you change `PromoScene` or `promoAudio` in `src/timeline.ts`, update `src/PromoVideo.tsx` and the affected `src/scenes/*` files in the same pass. Do not leave stale scene imports, old `kind` branches, or half-updated scene props behind; `pnpm run lint` will fail at the `tsc` step when the runtime contract drifts.

## Determinism

Remotion output must be deterministic:

- Drive motion from `useCurrentFrame()` and `useVideoConfig()`. The template's `PromoVideo.tsx` already uses `useVideoConfig().fps` so scene timing follows any fps override.
- Do not use `Date.now()`, timers, browser event loops, CSS animations, CSS transitions, or unseeded randomness.
- If variety is needed, derive it from stable data such as scene index, frame, or props.

## Tailwind

Tailwind is enabled by the template. Use it for static layout and styling, but do not use `animate-*` or `transition-*` classes for video motion. Use frame-driven styles instead.

## Product demos

Prefer static fixtures and frame-driven state. Import real frontend components only when they are independently renderable without routing, auth, live API calls, or full app bootstrap. Otherwise recreate the actual product screen from project code with Remotion-native layout, local fixtures, and project assets. Do not fall back to generic abstract cards, placeholder dashboards, or fake flow panels when the app already has a concrete interface for that moment.
