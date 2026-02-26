# OmniHuman v1.5 Lipsync — Design

> Date: 2026-02-26 (updated 2026-02-27)

## Summary

Add `fal-ai/bytedance/omnihuman/v1.5` as a second lipsync model alongside Hedra in
Avatar Studio. User selects model via SegmentedTabs at Step 5 (Generate area).

## Model Comparison

| | Hedra | OmniHuman v1.5 |
|---|---|---|
| Provider | Hedra REST API | FAL.ai (ByteDance) |
| Input | file upload (image + audio) | URL-based (fal.storage.upload → CDN URLs) |
| Max audio | No hard limit | 30s |
| API key | `HEDRA_API_KEY` | `FAL_API_KEY` (already configured) |
| API params | imagePath, audioPath, aspectRatio, resolution | image_url, audio_url (only) |

## Changes

### 1. New service: `src/server/services/omnihuman.ts`

```
createOmniHumanVideo(imagePath, audioPath)
  → upload files to FAL storage (fal.storage.upload)
  → fal.subscribe('fal-ai/bytedance/omnihuman/v1.5', { input: { image_url, audio_url } })
  → return { videoUrl, requestId }
```

- API only accepts `image_url` and `audio_url` — no resolution/aspect_ratio/turbo params
- Audio >30s → error (API hard limit)
- Duration detection via ffprobe (graceful fallback if unavailable)
- Mock provider support via `isMockProvidersEnabled()`
- `runWithRetries` wrapper for both upload and generation steps

### 2. Server: `src/server/routes/avatars.ts`

Lipsync endpoint (`POST /api/avatars/lipsync`) accepts new `model` body param:

```
model?: 'hedra' | 'omnihuman'   (default: 'hedra')
```

Branch logic:
- `hedra` → existing `createHedraVideo()` (file-based, unchanged)
- `omnihuman` → new `createOmniHumanVideo()` (uploads to FAL storage, then calls model)

### 3. Store: `src/renderer/stores/avatarStore.ts`

```
+ lipsyncModel: 'hedra' | 'omnihuman'    (default: 'hedra')
+ setLipsyncModel(model)
```

Lipsync callers (`createLipsync`, `generateTalkingAvatarVideosBatch`) send
`lipsyncModel` in the request body. Reaction flow uses Kling (i2v), not lipsync.

### 4. Frontend: `src/renderer/components/avatar-studio/TalkingAvatarPage.tsx`

Step 5 Generate area — SegmentedTabs above the Generate button (both audio and
multi-language modes):

```
[Hedra] [OmniHuman]
```

### Not changed

- Hedra flow remains identical and is the default
- No new env vars required (FAL_API_KEY already exists)
- Reaction flow unaffected (uses Kling AI, not lipsync)

## Audio Duration Handling

| Audio length | Behavior |
|---|---|
| ≤30s | Normal generation |
| >30s | Error — OmniHuman API hard limit |

## Risk

Low — additive change. Hedra default preserved, OmniHuman is opt-in.
FAL client already configured. Only new external dependency is the OmniHuman model endpoint.
