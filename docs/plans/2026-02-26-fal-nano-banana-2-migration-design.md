# FAL Model Migration: nano-banana-pro → nano-banana-2

> Date: 2026-02-26

## Summary

Swap FAL image generation models from `fal-ai/nano-banana-pro` (Gemini 3.0 Pro, $0.15/img)
to `fal-ai/nano-banana-2` (Gemini 3.1 Flash Image, $0.08/img). 4x faster, 47% cheaper,
same input/output schema.

## Changes

### Model ID swap (4 constants across 2 files)

| File | Constant | Old | New |
|------|----------|-----|-----|
| `src/server/services/fal.ts` | `MODEL_ID` | `fal-ai/nano-banana-pro/edit` | `fal-ai/nano-banana-2/edit` |
| `src/server/services/fal.ts` | `TEXT_TO_IMAGE_MODEL_ID` | `fal-ai/nano-banana-pro` | `fal-ai/nano-banana-2` |
| `src/server/services/avatar.ts` | `AVATAR_MODEL` | `fal-ai/nano-banana-pro` | `fal-ai/nano-banana-2` |
| `src/server/services/avatar.ts` | `AVATAR_EDIT_MODEL` | `fal-ai/nano-banana-pro/edit` | `fal-ai/nano-banana-2/edit` |

### New parameter: `limit_generations: false`

`nano-banana-2` defaults `limit_generations` to `true` which restricts output to 1 image
per prompt round. All `fal.subscribe` calls must explicitly set `limit_generations: false`
to preserve batch generation behavior.

### Not changed

- Response schema identical (`images[].url`, `description`) — no parse changes
- Existing params (`aspect_ratio`, `resolution`, `output_format`, `num_images`) compatible
- New params (`seed`, `enable_web_search`, `safety_tolerance`) not adopted yet
- Non-Banana models (Kling, ElevenLabs, Wizper, Captions) untouched

## Pricing comparison

| Resolution | Old (nano-banana-pro) | New (nano-banana-2) |
|------------|----------------------|---------------------|
| 1K | $0.15 | $0.08 |
| 2K | $0.15 | $0.12 |
| 4K | $0.15 | $0.16 |

## Risk

Minimal — same schema, same provider, same parameter names. Only model routing changes.
