# Assets And Media

Use this rule when adding images, generated assets, source video clips, audio, fonts, or charts.

## MGX asset references

Use the exact URL or path returned by MGX tools or existing manifest records. Do not invent CDN URLs, local filenames, or manifest paths.

Asset manifests may be managed outside `app/promo`, so do not assume a manifest exists inside the promo directory.

## Local assets

Put local render assets under `public/` and reference them with `staticFile("...")`.

Use Remotion loading-aware components from the `remotion` package:

- Images: `Img`
- Videos: `OffthreadVideo` (preferred for promo timelines) or `Video`
- Audio: `Audio`

When you add a new scene-level remote video layer, use `OffthreadVideo` from `remotion` and keep the same loading-aware pattern in that scene component or shared helper.

The template's default `<OffthreadVideo>` instantiation already sets `delayRenderTimeoutInMilliseconds={90000}` and `delayRenderRetries={3}`, and the package render scripts pass `--timeout=90000` (smoke) / `--timeout=120000` (full). These values exist because Remotion fetches every remote video through its local proxy at render time, and CDN-served AI clips routinely take 30–60 s on a cold fetch — the stock 28 s `delayRender` deadline aborts the render with `delayRender() ... was called but not cleared after 28000ms`. When you add a new `<OffthreadVideo>` layer, copy these props through; when you add a new render script, copy the matching `--timeout` flag through. Don't lower them, and don't add per-render `--timeout` overrides on top of the already-bumped defaults unless you've measured a need.

Add `@remotion/media` only when you specifically need its media-parser features. If you do, run `pnpm exec remotion add @remotion/media` first, then switch the relevant imports.

Do not use native `<img>` for important render images, CSS `background-image` for critical assets, or framework-runtime image components that depend on Next.js, Vite plugins, or similar layers.

## Remote assets

Remote image, video, and audio URLs can be used directly when returned by tools. Prefer stable HTTPS URLs. If render fails because of CORS, redirects, expiry, decode support, **or proxy fetch timing out beyond the bumped `delayRenderTimeoutInMilliseconds`**, store the asset locally and use `staticFile()`.

AI videos are source clips in the Remotion timeline, not the final render output for promo/designed multi-shot videos. If source video generation fails, use generated images plus Remotion motion rather than falling back to a frozen poster or a flat color card.

## Still-image and no-AI-video scenes

For promo/designed multi-shot scenes that do not use an AI source clip, the main full-frame background should usually be an AI-generated image or another real asset layer that matches the composition. Do not build the whole scene on a bare solid color or bare gradient. Solid/gradient fills may be used only as support layers such as glows, masks, vignettes, color washes, or readability overlays.

The background plate is there to set atmosphere, not to replace the thing being showcased. Except for intentionally open hero beats, short bridge shots, or simple end cards, promo scenes should usually include at least one foreground showcase element that the viewer can inspect directly: a product frame, result card, comparison crop, packshot, gallery tile, chart, diagram, or similar subject-carrying layer.
When the scene will later carry foreground titles, captions, node labels, bar labels, or metrics, the background atmosphere asset should preserve a low-detail, low-contrast, low-saturation copy zone where that foreground copy will sit. Do not place the brightest glow, busiest texture, or strongest motif behind the intended copy area.
For system maps, node networks, pipelines, org charts, state machines, charts, or other structural shots, the background asset may echo the motif but should stay atmospheric. Do not generate a larger, more complete, or more eye-catching same-role diagram in the background than the planned foreground structure.

The practical fallback for "no AI video here" is: a moving background plate, plus at least one foreground showcase layer, plus one supporting overlay, plus one meaningful local change. Good defaults are a slow push/pan/scale/parallax on the background image, then a framed UI/result/product layer in front, then a mask/light-sweep/reflection/foreground accent layer, plus text emphasis, state change, path growth, or counter/chart motion.

Real product UI, charts, flow diagrams, and user-provided media may be the primary visual without AI image generation, but they still need layered motion and scene texture. Do not place them on an empty flat background and treat opacity-only animation as sufficient. If the promised feature or result matters, give it its own readable foreground layer rather than leaving it embedded only inside the background artwork.

## Promo generation defaults

For promo/designed multi-shot AI video source clip generation, prefer `wan2.6-i2v` when a reference image is available and `wan2.6-t2v` for text-only generation. Set `model` explicitly unless the user requested another model or the tool/config clearly cannot use it.

Promo/designed multi-shot source clip generation supports `seconds` from `4` to `15`. Request the shortest supported duration that still covers the scene window plus a small tail of about 1 second for clean `trimAfter`. If a scene is longer than 15 seconds, split it into multiple clips or use generated images plus Remotion motion.

When the request depends on realistic camera or object movement, use AI video source clips for the key motion-heavy beats by default, then let Remotion handle captions, trims, transitions, BGM, and final export. Only use `image + Remotion motion` for those motion-heavy beats when video generation is unavailable, too risky for consistency, or the shot is intentionally static; record that reason in the storyboard.

## Video and audio behavior

Trim media in frames using `trimBefore` and `trimAfter`. Wrap media in `Sequence` to delay its start. Use frame-driven volume fades for audio and video.

Match each AI source clip's runtime to the scene window that hosts it. Generate the clip with `seconds` ≥ scene `duration` (a small tail of ~1 s gives `trimAfter` room to cut the last frame cleanly). When the source clip is shorter than its scene, `<OffthreadVideo>` either freezes on the final decoded frame or loops, which is visually obvious and a common cause of "the promo/designed multi-shot video looks broken in scene N" reports. The override over `video-generation`'s default `seconds=4` is intentional — that default is for the generic case; promo/designed multi-shot timelines have a hard requirement that clip duration covers scene duration.

Match the source clip's resolution and aspect ratio to the Composition. Promo Compositions render at `1920x1080` / `1080x1920` / `1080x1080` (or the `--props` override). Generate AI source clips at the closest same-aspect option supported by the model — for landscape promos prefer `1920x1080` over `1280x720`, for portrait prefer `1080x1920` over `720x1280`. Upscaling a low-resolution clip to match the composition produces visibly soft frames; the wrong aspect ratio gets letterboxed or cropped. Same rule for `Img`: don't pull a 1024×1024 hero into a 1920×1080 background.

Keep background music quiet under narration or product copy. Fade audio at scene boundaries to avoid hard cuts.

## Promo audio architecture

For promo videos, use exactly one global BGM track in `src/PromoVideo.tsx` and keep narration audio inside each scene `Sequence`. Do not attach the same BGM track to every scene. Scene-level components should own scene-local narration/media behavior; the top-level promo component should own global BGM and ducking.

Store promo-wide mix settings in `src/timeline.ts` as a `promoAudio` object with at least:

- `backgroundMusicUrl`
- `backgroundMusicDurationSeconds`
- `baseVolume`
- `duckVolume`
- `fadeInFrames`
- `fadeOutFrames`
- `loopIfShort`

Use the following promo defaults unless the user explicitly requires a different mix:

- Narration peak volume: `1.0`
- BGM `baseVolume` when there is no narration in the active scene: `0.26`
- BGM `duckVolume` when narration is active: `0.14`
- BGM `fadeInFrames`: `18`
- BGM `fadeOutFrames`: `24`
- BGM hard ceiling: do not exceed `0.30`

Use `volume={(frame) => ...}` on the top-level BGM `Audio` so the track can both fade in/out and duck under narration. Never lower narration to make the music more audible.

## Promo audio duration policy

Treat the real measured BGM length as the source of truth. After `MusicCreator.generate_music`, use the returned `duration` first. If `duration` is missing or `null`, probe the returned URL or archived local file with `ffprobe`.

When fallback probing is needed, use a command shape like:

```bash
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "https://..."
```

Then apply this policy using the measured BGM seconds against the locked promo total duration:

- If BGM duration is greater than or equal to the video total, keep one top-level BGM track, trim it to the final video length, and fade out at the tail.
- If BGM is short by more than `2s` or more than `10%`, regenerate once with a more explicit duration prompt before writing final timeline code.
- If the regenerated track is still materially short, allow only a minimal loop fallback on the global BGM track and hide the seam with a short fade rather than an abrupt restart.
- If BGM is only slightly short, do not regenerate; apply the lightest possible trim / fade / short-fill treatment in Remotion and keep the result unobtrusive.

## Fonts

Prefer local or template-safe fonts for repeatable renders. If adding Google or local font loaders, load fonts before measuring text or rendering typography-heavy frames.

## Charts

Build charts with React/SVG/HTML and drive chart animation from frames. Disable third-party chart library animations because they are not synchronized with the Remotion frame clock.
