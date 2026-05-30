# Render And Export

Use this rule when validating compositions, exporting final videos through the renderer tool, or debugging lower-level Remotion commands.

## Sanity-check the deploy if anything looks off

`use_template("remotion")` already validates the source before copying, so a successful return means `app/promo` is a real Remotion deploy. You do not need a separate `grep` step in normal runs.

If something downstream looks wrong (e.g. `package.json` scripts don't match this rule file, `src/Root.tsx` is missing, or the template feels like a different framework), stop before running renders:

- Do not run `pnpm install`, `pnpm add`, or any render command.
- Do not bolt Remotion on top of a non-Remotion `app/promo`.
- Report the wrong deploy back. The fix is on the platform / orchestration side, not in your render commands.

## Standard command order

Run commands from `app/promo`:

```console
pnpm install
pnpm run verify:versions
pnpm run lint
pnpm run verify:compositions
```

Then export through the agent-facing renderer tool:

```xml
<RemotionPromoRenderer.render>
<promo_dir>/absolute/path/to/app/promo</promo_dir>
<width>1920</width>
<height>1080</height>
<source_orientation>landscape</source_orientation>
</RemotionPromoRenderer.render>
```

Set `width` and `height` to the concrete target resolution. The renderer chooses `PromoLandscape`, `PromoPortrait`, or `PromoSquare` from that resolution, writes `out/render-<width>x<height>.log`, and returns `out/promo-<width>x<height>.mp4`.

The renderer parameters must match `promo_storyboard.md` and the export spec. Do not copy the landscape example when the storyboard says portrait/9:16/TikTok/Reels. For portrait exports, call `RemotionPromoRenderer.render` with `width=1080`, `height=1920`, and `source_orientation=portrait`, producing `out/promo-1080x1920.mp4`.

`verify:compositions` is a pre-render check only. After it passes, continue to the renderer tool; the workflow is not done until `out/promo-<width>x<height>.mp4` exists and is non-empty.

Do not use `Terminal.run` for final promo export. The renderer already runs smoke first and skips full render if smoke fails. `Terminal.run` remains appropriate for install, version checks, lint, composition verification, and targeted manual debugging.

Do not run `pnpm run build` as a compile check after lint. In this template, `build` is a lower-level alias for the default landscape render, so it starts a full export and bypasses the agent-facing renderer workflow.

## Custom dimensions or fps

Each preset Composition accepts `width`, `height`, `fps`, `sourceOrientation`, and `targetOrientation` as props. The renderer passes `width`, `height`, `sourceOrientation`, and the resolution-derived `targetOrientation` for final export.

**Total duration is not a render-time prop.** It comes from `promoScenes` in `src/timeline.ts`. See `core.md` for the duration rule and composition prop details.

```xml
<RemotionPromoRenderer.render>
<promo_dir>/absolute/path/to/app/promo</promo_dir>
<width>3840</width>
<height>2160</height>
<source_orientation>landscape</source_orientation>
</RemotionPromoRenderer.render>
```

For unusual debugging, you may inspect the generated log or run the package scripts manually. Do not replace the final renderer call with manual `pnpm exec remotion render` during normal agent delivery.

When width and height change to a non-preset aspect, set `sourceOrientation` to the orientation closest to the storyboard design and `targetOrientation` to the orientation closest to the export aspect, so `AspectFrame` produces correct black bars or fills the frame.

Layout uses fixed `px` values calibrated for 1080p. Rendering at 4K or 720p will make text and padding look proportionally smaller or larger; pick a size close to 1080p, or update `src/components/` to scale typography for the target resolution.

## Command meanings

- `verify:versions`: validates Remotion and peer package versions.
- `lint`: runs ESLint and TypeScript.
- `verify:compositions`: bundles the code and lists available compositions.
- `build`: lower-level alias for the default landscape render. Do not use it as validation in agent runs.
- `prewarm:browser`: downloads or verifies Remotion's Headless Chrome.
- `still:landscape` / `still:portrait` / `still:square`: export frame 30 at quarter scale of the matching Composition.
- `render:smoke` / `render:smoke-portrait` / `render:smoke-square`: lower-level smoke scripts for manual debugging.
- `render:landscape` / `render:portrait` / `render:square`: lower-level full-render scripts for local/manual debugging. Agent final export should still use `RemotionPromoRenderer.render`.

## Port usage

Do not pass `--port` by default. Remotion `4.0.453` already uses bind-based port probing and can choose an available renderer port.

Only pass `--port=<free-port>` when debugging a confirmed local port conflict.

## First render network need

The first browser-backed command may need network access to download Headless Chrome. `prewarm:browser`, `verify:compositions`, and render commands can all trigger this.

## Failure triage

- Version mismatch: fix `package.json` so all Remotion packages share the same pinned version and `zod` matches Remotion's requirement.
- Composition lookup failure: run `verify:compositions`, then check `src/index.ts`, `src/Root.tsx`, and composition IDs.
- Smoke render failure: fix it before a full render. The renderer log shows the smoke command and stderr.
- `--props` parse error: ensure the JSON is valid and quoted for the shell. Optional fields can be omitted; missing required fields fall back to `defaultProps`.
- Slow render: shorten heavy scenes, reduce media layers, avoid full app bootstraps. The renderer full render omits `--concurrency`, so Remotion auto-selects worker count; pushing concurrency higher rarely helps. The renderer smoke pass intentionally pins `--concurrency=1` so error messages stay readable.
- Remote asset failure: use exact tool-returned URLs and verify CORS or convert the asset to a local `public/` file.
