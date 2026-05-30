# Advanced Media

Use this rule only when the task requires media inspection, preprocessing, silence trimming, or nonstandard export behavior.

## FFmpeg

Use FFmpeg for preprocessing outside the Remotion frame render path:

- Trim or normalize long source clips.
- Extract audio tracks.
- Detect leading/trailing silence.
- Re-encode media that Chrome cannot decode reliably.

Keep FFmpeg commands deterministic and record generated file paths in the storyboard or local fixture data.

## Media metadata

When duration or dimensions are needed for layout, gather them before rendering or in `calculateMetadata`. Avoid doing expensive metadata work inside frame components.

For local and remote video duration/dimensions, prefer Remotion-supported helpers or a small Node-side utility. Cache results in fixture data when the same media is reused.

## Decode checks

If a video source fails in Chrome but plays elsewhere, verify codec/container support and re-encode to a browser-safe MP4 before using it in the timeline.

## Frame extraction

Use frame extraction for filmstrips, thumbnails, and visual analysis. Store extracted frames under `public/` and reference them with `staticFile()`.

## Silence detection

Use silence detection to trim source voiceover or demo clips before they enter the Remotion timeline. Keep the final timeline frame-based; do not run silence detection during render.

## Modules not enabled by default

Do not add Mapbox, ElevenLabs, Lottie, 3D, light leaks, audio visualization, transparent video, or transcription dependencies unless the user explicitly asks for one of those capabilities and the required credentials or assets are already available.
