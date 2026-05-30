# Captions

Use this rule when the storyboard includes subtitles, narration captions, or transcript-derived text.

## Data shape

Use structured caption data with text and timing. Prefer JSON fixtures checked into `app/promo` or generated outputs explicitly returned by tools.

A caption item should include:

- `text`
- start time or start frame
- end time or duration
- optional confidence or speaker metadata when available

## Display

Render captions with `Sequence` or frame checks. Keep captions inside the safe area and avoid covering primary product UI.

For word highlighting, pre-split caption text and drive the active word by frame. Keep the visual treatment simple: weight, color, underline, or background fill.

## Importing subtitles

If source captions are `.srt`, convert them into JSON before rendering. Do not parse raw `.srt` text inside the frame-rendering component.

## Generating captions

Use MGX audio/video transcription tools when captions must be generated. Keep generated caption files as stable render inputs and avoid transcription calls during render.
