---
name: remotion-best-practices
description: Read alongside promo-video-production when writing, reviewing, validating, or exporting Remotion code in app/promo for an MGX-generated promo or designed multi-shot video, including compositions, props, deterministic animation, sequencing, assets, layout, captions, media handling, and render commands.
alwaysApply: false
roles:
  - Alex
---

## When to use

Read this skill after `promo-video-production` whenever you are:

- writing or reviewing Remotion code in `app/promo`,
- choosing the right validation or render command,
- debugging a Remotion bundle, render, or export,
- deciding which Remotion APIs are appropriate for a deterministic promo or designed multi-shot render.

## What this skill assumes

- The Remotion app lives in `app/promo` and was initialized from the MGX `remotion` template (`FrontendEngineer.use_template("remotion")`).
- The video subject is either a project the agent is building (project promo) or a user-supplied topic / concept (topic promo). Designed multi-shot social, local business, restaurant/food, and discovery videos use the same topic-promo path when no source app exists.
- The storyboard, assets, and rendering are all driven by agent turns and MGX tools, not by a person opening Remotion Studio.

## MGX defaults

- Work inside `app/promo`.
- Default output is landscape `1920x1080`. Use portrait `1080x1920` only when the storyboard or user requests it.
- When writing or reviewing promo copy, asset prompts, or timeline text, follow the storyboard `Language` field. If no explicit user-specified output language is recorded, use English; chat/user message/system prompt language is not an explicit language request.
- Keep renders deterministic and frame-driven; the same inputs must produce the same video on every run.
- Use the exact asset URLs or paths returned by MGX tools or recorded in existing manifests.
- Validate versions, lint, and compositions with `Terminal.run`; final promo export uses `RemotionPromoRenderer.render`, not handwritten Remotion render commands.
- Use the rule files below as the single source of truth for render order, duration/props, media sizing, and debugging details instead of restating those rules here.

## File layout

The template uses a flat `src/` layout under `app/promo`:

- `src/index.ts` — entry point.
- `src/Root.tsx` — Composition registry.
- `src/PromoVideo.tsx` — main component.
- `src/timeline.ts` — `promoScenes` and `getPromoTotalSeconds()`.
- `src/components/` — framing/layout helpers such as `AspectFrame`.
- `src/scenes/` — default scene implementation layer.
- `src/app-demo/` — optional adapters/examples for product/page demos.

Edit these files in place. Do not relocate them under a subdirectory such as `src/remotion/`; that breaks the `package.json` scripts (`remotion render src/index.ts ...`) and every rule reference in this skill. If you find `app/promo/src/` already populated with a non-template layout, abort and report the wrong deploy — see `rules/render-export.md` *Sanity-check the deploy if anything looks off*.

## Rule map

Read only the rule files relevant to the current task. **Always open them with the absolute path the skill index gave you for this skill** (e.g. `<workspace>/.atoms/skills/remotion-best-practices/rules/<file>.md`). The links below are markdown-relative for readability inside the source repo, but Remotion code lives under `app/promo/` while these rule files live under `.atoms/skills/remotion-best-practices/rules/` — never resolve them against `app/promo/` or your current `cwd`.

- Composition setup, props, schemas, dynamic metadata, Tailwind: [rules/core.md](rules/core.md)
- Render and export commands, port behavior, failure triage: [rules/render-export.md](rules/render-export.md)
- Frame-driven motion, easing, springs, text animation: [rules/animation-timing.md](rules/animation-timing.md)
- Scene timing, `Sequence`, `Series`, transitions: [rules/sequencing-transitions.md](rules/sequencing-transitions.md)
- Images, generated assets, video clips, audio, fonts, charts: [rules/assets-media.md](rules/assets-media.md)
- Aspect ratios, typography, text fitting, safe layout: [rules/layout-text.md](rules/layout-text.md)
- Captions and subtitles: [rules/captions.md](rules/captions.md)
- FFmpeg, media metadata, decode checks, frame extraction, silence detection: [rules/advanced-media.md](rules/advanced-media.md)
