# Pixflow Development Handoff — February 2026

> **Previous handoff archived:** `PIXFLOW_AI_VERSIONING_HANDOFF_ARCHIVE_20260209.md` (1272 lines)
> **This document:** Fresh continuation covering recent sessions and current state

---

## Quick Context

**Pixflow** is an Electron desktop app for AI-powered asset production workflows:
- **Prompt Factory**: Image-to-prompt analysis + concept-to-prompt generation
- **Asset Monster**: Batch image generation with reference images
- **Img2Video**: Image-to-video conversion with camera controls
- **Avatar Studio**: Avatar + script + TTS + lipsync pipeline
- **The Machine**: End-to-end orchestration
- **Library**: History, favorites, liked images

**Stack:**
- Electron + Vite
- React + Zustand (state)
- Express API (embedded server)
- SQLite database (better-sqlite3)
- FAL.ai (image generation), Kling/Minimax (video), OpenAI GPT-4o (vision/text)

**Recent Focus:** Like/dislike system, Img2Video improvements, UX enhancements

---

## Recent Sessions Summary

### Session 1: Img2Video Grid Layout
**Date:** Feb 9, 2026
**Issue:** Thumbnail grid showed only 4 images per row
**Solution:** Changed from `grid-cols-4` to `grid-cols-5` for better visual density

**Files Modified:**
- `src/renderer/components/img2video/Img2VideoPage.tsx` (line 288)

**Commit:** `41572bc` (part of like/dislike commit)

---

### Session 2: Job Definition Bug Fix
**Issue:** "job is not defined" error after video generation
**Root Cause:** In Source Images grid, `job` variable wasn't defined in map callback scope
**Solution:** Changed from arrow function with implicit return to block body with `const job = jobs[i]`

**Files Modified:**
- `src/renderer/components/img2video/Img2VideoPage.tsx` (lines 318-401)

**Commit:** `41572bc` (part of like/dislike commit)

---

### Session 3: Progressive Video Generation UX
**Issue:** Couldn't add new images during video generation, all jobs regenerated on second generate
**Requirements:**
- Allow adding images during generation
- Only generate pending/failed jobs (skip completed)
- Add cancel buttons for individual jobs
- Add loading spinners
- Show "Queued" badge for new images

**Implementation:**
1. **Dropzone:** Removed `generating` from disabled condition
2. **State Management:** `addEntries()` and `uploadFiles()` preserve existing job state
3. **Smart Queue:** `generateAll()` only queues pending jobs, skips completed/failed
4. **Cancel Support:** Added `cancelJob(index)` action to mark as failed
5. **UI Indicators:** Larger spinners (w-6 h-6), cancel buttons (X), "Queued" badges
6. **Generate Button:** Shows smart text ("Generate X More Videos")

**Files Modified:**
- `src/renderer/components/img2video/Img2VideoPage.tsx` - UI updates
- `src/renderer/stores/img2videoStore.ts` - State logic updates

**Commit:** `41572bc` (part of like/dislike commit)

---

### Session 4: Add More Button Visibility
**Issue:** "Add More" button disappeared during/after generation
**Root Cause:** Section visibility condition was too restrictive (`!generating && jobs.every(...)`)
**Solution:** Changed to simple `entries.length > 0` condition

**Files Modified:**
- `src/renderer/components/img2video/Img2VideoPage.tsx`

**Commit:** `41572bc` (part of like/dislike commit)

---

### Session 5: Like/Dislike System (MAJOR FEATURE)
**Feature:** Comprehensive image rating system linking generated images to prompts
**Requirements:**
- Binary rating: like (+1) or dislike (-1)
- Persist images to database with full generation context
- Link ratings to source prompts
- Display liked images in Library
- Access prompts from liked images
- Future: concept-based prompt generation

**Implementation:**

#### Backend (Database + Services + API)
1. **Database Schema** (`schema.ts`):
   - `generated_images` table: id, user_id, job_id, batch_index, prompt_index, variant_index, url, local_path, file_name, concept, prompt (JSON), aspect_ratio, resolution, output_format, generated_at
   - `image_ratings` table: id, user_id, image_id, rating (CHECK IN -1,1), notes, rated_at, updated_at
   - UNIQUE constraint on (user_id, image_id)
   - ON DELETE CASCADE for ratings → images
   - 6 indexes for query performance

2. **Service Layer** (`imageRatings.ts`):
   - `saveBatchImages()` - Persist completed batch to DB
   - `getGeneratedImages()` - Flexible queries with filters
   - `rateImage()` - Add/update rating (upsert)
   - `removeRating()` - Delete rating
   - `getImageById()` - Single image lookup
   - `getImagesByJobId()` - Get images for batch

3. **API Routes** (`routes/imageRatings.ts`):
   - `GET /api/images` - List with filters (rating, concept, jobId, limit)
   - `GET /api/images/:id` - Get single image
   - `POST /api/images/:id/rate` - Rate image
   - `DELETE /api/images/:id/rate` - Remove rating

4. **Integration**:
   - Modified `fal.ts` to call `saveBatchImages()` after batch completion
   - Updated `generate.ts` to store `job.prompts` for persistence
   - Registered routes in `createApp.ts`

#### Frontend (State + UI)
1. **State Management** (`imageRatingsStore.ts`):
   - `loadImages()` - Load with filters
   - `loadLikedImages()` - Load rated +1 images
   - `rateImage()` - Rate image
   - `removeRating()` - Remove rating

2. **Asset Monster Page**:
   - Added ThumbsUp/ThumbsDown icons import
   - Load database image IDs after batch completion
   - Rating buttons in bottom-right corner of completed images
   - Semi-transparent background (bg-black/60)
   - stopPropagation on rating clicks

3. **Library Page**:
   - Expanded from 3 to 4 columns
   - New "Liked Images" column with 2-column thumbnail grid
   - Preview panel shows:
     - Full-size image
     - Concept, timestamp, aspect ratio
     - Complete source prompt JSON
     - "Favorite Prompt" button to save prompt to favorites

**Files Modified:**
- `src/server/db/schema.ts` - New tables and indexes
- `src/server/services/imageRatings.ts` - New service layer
- `src/server/routes/imageRatings.ts` - New API routes
- `src/server/services/fal.ts` - Persistence integration
- `src/server/routes/generate.ts` - Store prompts on job
- `src/server/createApp.ts` - Register routes
- `src/renderer/types/index.ts` - GeneratedImageRecord interface
- `src/renderer/stores/imageRatingsStore.ts` - New store
- `src/renderer/components/asset-monster/AssetMonsterPage.tsx` - Rating buttons
- `src/renderer/components/library/LibraryPage.tsx` - Liked images column

**Commit:** `41572bc` - "Add like/dislike system for generated images"

---

### Session 6: Download All Button Fix
**Issue:** Download All button only showed when `completedJobs.length > 1`
**Solution:** Changed condition to `> 0` so button appears even for single videos
**Note:** Function already handles single file correctly (direct download vs ZIP)

**Files Modified:**
- `src/renderer/components/img2video/Img2VideoPage.tsx` (line 501)

**Commit:** `c926dbf` - "Fix Download All button visibility in Img2Video"

---

### Session 7: Img2Video Navigation Crash
**Issue:** "Cannot convert undefined or null to object" when navigating from Asset Monster
**Root Cause:** Asset Monster was sending `{ url, prompt }` without `presets` property
**Solution:** Added `presets: {}` to entries created from Asset Monster

**Files Modified:**
- `src/renderer/components/asset-monster/AssetMonsterPage.tsx` (line 948)

**Commit:** `e37f99f` - "Fix Img2Video crash when navigating from Asset Monster"

---

### Session 8: Individual Generate Buttons
**Issue:** Couldn't easily generate individual videos, especially new ones added during batch
**Solution:** Added per-job Generate buttons that appear based on job status

**Features:**
- "Generate" button (primary/blue) for pending/new/failed jobs
- "Regenerate" button (secondary) for completed jobs
- Button disabled if prompt is empty
- Edit and Generate buttons side-by-side in flex layout
- Upload flow preserves existing job state

**Files Modified:**
- `src/renderer/components/img2video/Img2VideoPage.tsx` (lines 397-433)

**Commit:** `fc3ab59` - "Add individual Generate buttons for each video job"

---

## Current Architecture

### Database Schema

#### Core Tables
- `users` - User accounts
- `products` - Product definitions (Clone AI, Fyro, Fling, Zurna, Impresso)
- `history` - Prompt generation history
- `favorites` - Favorite prompts
- `presets` - User-defined presets

#### New Tables (Like/Dislike Feature)
- `generated_images` - Permanent records of all generated images
- `image_ratings` - User ratings (-1 or +1) for images

#### Indexes
- Standard indexes on user_id, product_id
- Special indexes for generated_images: job_id, generated_at
- Special indexes for image_ratings: user_id + rating composite

### State Management (Zustand)

#### Stores
- `promptStore` - Prompt Factory state
- `generationStore` - Asset Monster state
- `img2videoStore` - Img2Video state
- `historyStore` - Library history/favorites
- `imageRatingsStore` - **NEW** - Liked images state
- `avatarStore` - Avatar Studio state
- `machineStore` - The Machine state

### API Routes

#### Generation
- `POST /api/generate/analyze` - Image-to-prompt analysis
- `POST /api/generate/prompts` - Concept-to-prompts generation
- `POST /api/generate/batch` - Batch image generation
- `GET /api/generate/batch/:id` - Get batch status
- `POST /api/generate/upload-reference` - Upload reference image

#### Image Ratings (NEW)
- `GET /api/images` - List generated images with filters
- `GET /api/images/:id` - Get single image
- `POST /api/images/:id/rate` - Rate image (+1 or -1)
- `DELETE /api/images/:id/rate` - Remove rating

#### Video Generation
- `POST /api/generate/img2video` - Generate video from image

#### Library
- `GET /api/history` - Get generation history
- `POST /api/favorites` - Add to favorites
- `DELETE /api/favorites/:id` - Remove from favorites

---

## Common Patterns

### Database Persistence Pattern
```typescript
// After batch completion, persist to database
if (job.status === 'completed' && job.userId && job.prompts) {
  try {
    const { saveBatchImages } = await import('./imageRatings.js')
    await saveBatchImages(job.userId, job, job.prompts, settings)
    console.log(`[Batch] Saved ${job.completedImages} images to database`)
  } catch (err) {
    console.error('[Batch] Failed to save images to DB:', err)
  }
}
```

### Rating Images Pattern
```typescript
// Load batch image IDs after completion
useEffect(() => {
  if (batchProgress?.status === 'completed' && batchProgress.jobId) {
    authFetch(apiUrl(`/api/images?jobId=${batchProgress.jobId}`))
      .then((res) => res.json())
      .then((raw) => {
        const data = unwrapApiData<{ images: GeneratedImageRecord[] }>(raw)
        const idMap = new Map(data.images.map((img) => [img.batchIndex, img.id]))
        setBatchImageIds(idMap)
      })
      .catch(console.error)
  }
}, [batchProgress?.status, batchProgress?.jobId])

// Rate image handler
const handleRateImage = async (batchIndex: number, rating: 1 | -1) => {
  const imageId = batchImageIds.get(batchIndex)
  if (!imageId) return

  await rateImageInStore(imageId, rating)
}
```

### Progressive Job Management Pattern
```typescript
// Only queue pending jobs, preserve completed/failed
const initialJobs: VideoJob[] = entries.map((e, i) => {
  if (jobs[i] && (jobs[i].status === 'completed' || jobs[i].status === 'failed')) {
    return jobs[i]  // Keep existing
  }
  return { imageUrl: e.url, prompt: '...', status: 'pending' }
})

const queue = initialJobs
  .map((job, i) => (job.status === 'pending' ? i : -1))
  .filter((i) => i !== -1)
```

---

## Critical File Locations

### Frontend (React)
- **Pages:** `src/renderer/components/{prompt-factory,asset-monster,img2video,avatar-studio,machine,library}/`
- **Stores:** `src/renderer/stores/` (Zustand)
- **UI Components:** `src/renderer/components/ui/` (Button, Input, Select, Badge, etc.)
- **API Utils:** `src/renderer/lib/api.ts` (authFetch, apiUrl, assetUrl)
- **Types:** `src/renderer/types/index.ts`

### Backend (Express)
- **Routes:** `src/server/routes/` (generate.ts, imageRatings.ts, avatars.ts, library.ts)
- **Services:** `src/server/services/` (fal.ts, imageRatings.ts, vision.ts, kling.ts, minimax.ts)
- **Database:** `src/server/db/` (schema.ts, index.ts)
- **Main Process:** `src/main/index.ts` (Electron main)

### Documentation
- **Active Docs:** `docs/` (PIPELINE.md, SCHEMA.md, this handoff)
- **Archive:** `Burgflow Archive/` (legacy materials, read-only)

---

## Development Workflow

### Build & Run
```bash
npm run dev          # Start Electron app in dev mode
npm run build        # Build for production
npm run lint:biome   # Lint with Biome
npx tsc --noEmit     # Type check
```

### Testing Workflow
1. Implement feature
2. Type check: `npx tsc --noEmit`
3. Build: `npm run build`
4. Run: `npm run dev`
5. Test manually
6. Call codex MCP for code review
7. Fix high/mid priority issues
8. Get LGTM from codex
9. Git commit

### Git Commit Pattern
```bash
git add -A
git commit -m "$(cat <<'EOF'
Brief one-line summary

Detailed description of changes:
- What was changed
- Why it was changed
- Technical details

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Code Quality Guidelines

### Anti-Patterns (AI Slop)
- Extra defensive try/catch blocks in trusted codepaths
- Unnecessary comments explaining obvious code
- Single-use variables right after declaration (prefer inline)
- Casting to `any` to bypass type issues
- Inconsistent style with surrounding code

### Preferred Patterns
- **Always** fetch Context7 docs before writing library/framework code
- Follow existing file patterns
- Use codex MCP for code reviews
- Fix high/mid priority issues, ask about low priority
- Trust TypeScript types and error messages

### Naming Conventions
- **Product:** Pixflow (not Burgflow/Borgflow)
- **Components:** PascalCase (e.g., `AssetMonsterPage.tsx`)
- **Stores:** `use{Feature}Store` (e.g., `useImg2VideoStore`)
- **Files:** camelCase for components, kebab-case for utilities
- **API Routes:** `/api/{feature}/{action}` pattern

---

## Known Patterns & Solutions

### Image Missing Presets
**Problem:** Entries created without `presets` property cause Object.keys() errors
**Solution:** Always include `presets: {}` when creating ImageEntry objects
```typescript
{ url: img.url, prompt: '', presets: {} }
```

### Job State Preservation
**Problem:** Need to add new jobs without resetting existing completed/failed jobs
**Solution:** Check job status before resetting
```typescript
// DON'T reset jobs array when adding entries
addEntries: (urls) => set((state) => ({
  entries: [...state.entries, ...urls.map(url => ({ url, prompt: '', presets: {} }))],
  // Don't reset jobs - preserve existing state
}))
```

### Database Image Persistence
**Problem:** Need to link generated images to database for ratings
**Solution:** Store job.prompts before generation, call saveBatchImages after completion
```typescript
const job = createBatchJob(concept, totalImages, outputDir, req.user?.id)
job.prompts = prompts  // Store for later persistence
```

---

## Environment & Configuration

### API Keys
Use `get_api_keys` tool from Pixery AI MCP server:
- FAL.ai (`fal`)
- OpenAI (`openai`)
- Gemini (`gemini`)
- AWS Bedrock Claude (`bedrock_claude`)

**Never ask user for API keys** - always use the MCP tool.

### Project Structure
```
pixflow/
├── src/
│   ├── main/           # Electron main process
│   ├── preload/        # Electron preload scripts
│   ├── renderer/       # React frontend
│   │   ├── components/ # UI components
│   │   ├── stores/     # Zustand stores
│   │   ├── lib/        # Utilities
│   │   └── types/      # TypeScript types
│   └── server/         # Express API
│       ├── routes/     # API routes
│       ├── services/   # Business logic
│       ├── db/         # Database schema
│       └── utils/      # Utilities
├── docs/               # Active documentation
├── out/                # Build output (gitignored)
└── CLAUDE.md           # Project instructions
```

---

## Recent Commits Summary

1. **41572bc** - Add like/dislike system (MAJOR)
   - Database tables for images and ratings
   - Backend service layer and API routes
   - Frontend store and UI integration
   - Library page expansion to 4 columns

2. **c926dbf** - Fix Download All button visibility
   - Show button for single video too

3. **e37f99f** - Fix Img2Video navigation crash
   - Add missing presets property

4. **fc3ab59** - Add individual Generate buttons
   - Per-job generate/regenerate buttons
   - Better UX for adding jobs during generation

---

## Next Steps & Future Work

### Immediate Priorities
1. ✅ Like/dislike system - COMPLETE
2. ✅ Individual generate buttons - COMPLETE
3. ✅ Progressive job management - COMPLETE

### Future Enhancements
1. **Concept-based Prompt Generation**
   - Use liked images to generate new prompts
   - Learn from user preferences
   - Analyze patterns in liked vs disliked images

2. **Batch Management**
   - Persistent batch history beyond 30 minutes
   - Batch tagging and organization
   - Search and filter batches

3. **Video Presets**
   - Save custom camera control presets
   - Share presets between projects
   - Preset library

---

## User Preferences (Mr Tinkleberry)

- Always fetch Context7 docs before writing library/framework code
- Use codex MCP for code reviews (high/mid priority fixes required)
- Avoid AI slop (extra comments, defensive checks, single-use vars)
- Use get_api_keys tool for API credentials (never ask user)
- Keep code consistent with existing file style
- Address user by "Mr Tinkleberry" when following instructions correctly
- **Update handoff after each sprint/iteration automatically** (new requirement)

---

## Handoff Protocol

**Automatic Updates:**
- Update this handoff after each sprint/iteration
- Don't wait for user to ask
- Keep it current and accurate

**When handoff grows >1200 lines:**
1. Archive current handoff with timestamp suffix
2. Create new dated handoff
3. Keep only recent 8-10 sessions in new handoff
4. Reference archived handoff at top

**Current Status:**
- Document created: Feb 9, 2026
- Last updated: Feb 9, 2026 (Session 8)
- Lines: ~700
- Status: Fresh, well-organized

---

## Questions? Issues?

1. Check `CLAUDE.md` for project-specific instructions
2. Check `~/.claude/CLAUDE.md` for user's global preferences
3. Review archived handoff for historical context
4. Search codebase for similar patterns
5. Ask user (Mr Tinkleberry) for clarifications

---

**Last Updated:** February 9, 2026 - Session 8
**Active Agent:** Claude Sonnet 4.5
**Status:** All recent features implemented and tested
**Next Session:** Ready for new tasks
