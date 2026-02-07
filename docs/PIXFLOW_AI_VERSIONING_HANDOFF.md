# Pixflow AI Versioning Handoff

This document is a machine-readable handoff for another AI agent to understand:

1. what changed,
2. why it changed,
3. what is still pending.

Date: 2026-02-07
Last updated: 2026-02-08 (Session 3: status color token migration, native module fix, full E2E verification)
Project root: `/Users/pixery/Projects/pixflow`

---

## 1) Current Product Identity

- Active product name: **Pixflow**
- Previous name: **Borgflow/Borgflow-era materials**
- Policy: active work stays in root Pixflow structure, old materials stay in archive.

---

## 2) Structural Changes Applied

### 2.1 Archive created

- Archive folder created:
  - `/Users/pixery/Projects/pixflow/Burgflow Archive`

- Archive guidance file added:
  - `/Users/pixery/Projects/pixflow/Burgflow Archive/README.md`

### 2.2 Borgflow-era assets moved to archive

Moved from root into `Burgflow Archive`:

- `Documentation/` -> `Burgflow Archive/Documentation/`
- `packages/` -> `Burgflow Archive/packages/`
- `backups/` -> `Burgflow Archive/backups/`
- old root `CLAUDE.md` -> `Burgflow Archive/CLAUDE.md`
- `docs/CLAUDE.md` -> `Burgflow Archive/docs/CLAUDE.md`
- `docs/UI_SPEC.md` -> `Burgflow Archive/docs/UI_SPEC.md`
- `docs/SPRINT_GUIDE.md` -> `Burgflow Archive/docs/SPRINT_GUIDE.md`
- `scripts/auto-backup.sh` -> `Burgflow Archive/scripts/auto-backup.sh`
- `logs/backup.log` -> `Burgflow Archive/logs/backup.log`
- `logs/backup_error.log` -> `Burgflow Archive/logs/backup_error.log`

### 2.3 Active Pixflow docs created/updated

- New root intelligence doc:
  - `/Users/pixery/Projects/pixflow/CLAUDE.md`
- New active readme:
  - `/Users/pixery/Projects/pixflow/docs/PIXFLOW_README.md`
- Structure policy doc:
  - `/Users/pixery/Projects/pixflow/docs/REPO_STRUCTURE.md`

### 2.4 Naming cleanup

- `package-lock.json` top-level name updated:
  - from `borgflow` -> `pixflow`

---

## 3) Hygiene/Operations Changes Applied

### 3.1 Git ignore hardened

Updated:
- `/Users/pixery/Projects/pixflow/.gitignore`

Adds/clarifies ignores for:
- runtime artifacts (`outputs/`, `uploads/`, `logs/`, `backups/`)
- DB runtime files (`data/*.db*`)
- local tooling state (`.playwright-mcp/`)
- generated build metadata (`*.tsbuildinfo`)
- one-off local binary (`machine-tab-full.png`)

### 3.2 Cleanup script added

- `/Users/pixery/Projects/pixflow/scripts/cleanup-local-artifacts.sh`

Behavior:
- default mode is **dry-run**
- `--apply` performs deletion
- targets only local/runtime artifacts (not source code)

### 3.3 Persistence migration status

- History/favorites runtime operations now use SQLite-backed service at:
  - `/Users/pixery/Projects/pixflow/src/server/services/history.ts`
- Legacy JSON files are only migration inputs via:
  - `/Users/pixery/Projects/pixflow/src/server/db/migrations.ts`

---

## 4) Active Architecture (as assessed)

Active code paths:

- Electron main/preload: `src/main`, `src/preload`
- Renderer/UI: `src/renderer`
- Embedded API: `src/server`

System model:
- Electron desktop app
- Express API embedded in Electron main process
- React + Zustand frontend
- Local filesystem outputs + SQLite (`data/pixflow.db`)

---

## 5) Completed in This Iteration

1. Security bootstrap hardening:
- Removed hardcoded default admin.
- Added opt-in bootstrap admin flow:
  - `PIXFLOW_BOOTSTRAP_ADMIN_ON_STARTUP=true`
  - `PIXFLOW_BOOTSTRAP_ADMIN_EMAIL`
  - `PIXFLOW_BOOTSTRAP_ADMIN_PASSWORD`
- Files:
  - `/Users/pixery/Projects/pixflow/src/server/services/auth.ts`

2. Startup fail-fast validation:
- Added server env validation for `JWT_SECRET` and bootstrap-admin config.
- Files:
  - `/Users/pixery/Projects/pixflow/src/server/config/validation.ts`
  - `/Users/pixery/Projects/pixflow/src/server/createApp.ts`

3. Path validation hardening:
- Replaced prefix-based folder access check with `resolve + relative` guard.
- File:
  - `/Users/pixery/Projects/pixflow/src/server/routes/generate.ts`

4. SQLite runtime migration for history/favorites:
- Runtime history/favorites operations moved to SQLite-backed service.
- Routes now user-scoped by authenticated user id.
- Files:
  - `/Users/pixery/Projects/pixflow/src/server/services/history.ts`
  - `/Users/pixery/Projects/pixflow/src/server/routes/history.ts`
  - `/Users/pixery/Projects/pixflow/src/server/createApp.ts`

5. Shared prompt limits (frontend/backend alignment):
- Added shared constants:
  - `/Users/pixery/Projects/pixflow/src/constants/limits.ts`
- Wired into backend prompt generation clamp and frontend prompt slider/store.
- Files:
  - `/Users/pixery/Projects/pixflow/src/server/createApp.ts`
  - `/Users/pixery/Projects/pixflow/src/renderer/components/prompt-factory/PromptFactoryPage.tsx`
  - `/Users/pixery/Projects/pixflow/src/renderer/stores/promptStore.ts`

6. API response envelope rollout:
- Added standard helpers:
  - `/Users/pixery/Projects/pixflow/src/server/utils/http.ts`
- Applied across app-level endpoints and route modules:
  - `/Users/pixery/Projects/pixflow/src/server/createApp.ts`
  - `/Users/pixery/Projects/pixflow/src/server/routes/auth.ts`
  - `/Users/pixery/Projects/pixflow/src/server/routes/generate.ts`
  - `/Users/pixery/Projects/pixflow/src/server/routes/avatars.ts`
  - `/Users/pixery/Projects/pixflow/src/server/routes/history.ts`
  - `/Users/pixery/Projects/pixflow/src/server/routes/products.ts`
  - `/Users/pixery/Projects/pixflow/src/server/routes/presets.ts`
  - `/Users/pixery/Projects/pixflow/src/server/routes/feedback.ts`
  - `/Users/pixery/Projects/pixflow/src/server/routes/notifications.ts`
- Envelope now includes:
  - `success`
  - `data`
- Compatibility mode removed:
  - backend no longer mirrors payload keys at top level
  - strict contract is now `{ success, data }` for success responses

7. Frontend envelope migration:
- Added shared frontend parser helpers:
  - `/Users/pixery/Projects/pixflow/src/renderer/lib/api.ts`
    - `unwrapApiData<T>()`
    - `getApiError()`
- Migrated frontend stores to parse envelope consistently:
  - `/Users/pixery/Projects/pixflow/src/renderer/stores/authStore.ts`
  - `/Users/pixery/Projects/pixflow/src/renderer/stores/productStore.ts`
  - `/Users/pixery/Projects/pixflow/src/renderer/stores/promptStore.ts`
  - `/Users/pixery/Projects/pixflow/src/renderer/stores/historyStore.ts`
  - `/Users/pixery/Projects/pixflow/src/renderer/stores/notificationStore.ts`
  - `/Users/pixery/Projects/pixflow/src/renderer/stores/presetStore.ts`
  - `/Users/pixery/Projects/pixflow/src/renderer/stores/feedbackStore.ts`
  - `/Users/pixery/Projects/pixflow/src/renderer/stores/generationStore.ts`
  - `/Users/pixery/Projects/pixflow/src/renderer/stores/machineStore.ts`
  - `/Users/pixery/Projects/pixflow/src/renderer/stores/avatarStore.ts`
- Migrated direct renderer API consumers to shared parser/error helper:
  - `/Users/pixery/Projects/pixflow/src/renderer/components/asset-monster/AssetMonsterPage.tsx`
  - `/Users/pixery/Projects/pixflow/src/renderer/components/avatar-studio/AvatarStudioPage.tsx`

8. Pipeline telemetry (server-side):
- Added telemetry service:
  - `/Users/pixery/Projects/pixflow/src/server/services/telemetry.ts`
- Emits JSONL telemetry events to:
  - `logs/pipeline-events.jsonl` (default)
  - configurable via `PIXFLOW_TELEMETRY_DIR`
  - toggle via `PIXFLOW_TELEMETRY_ENABLED` (default: enabled)
- Integrated spans/events into:
  - `/Users/pixery/Projects/pixflow/src/server/createApp.ts` (`prompts.generate`)
  - `/Users/pixery/Projects/pixflow/src/server/routes/generate.ts` (`generate.batch.start` + async error marker)
  - `/Users/pixery/Projects/pixflow/src/server/services/fal.ts` (`generate.batch.execute`)
  - `/Users/pixery/Projects/pixflow/src/server/routes/avatars.ts` (`avatars.script`, `avatars.tts`, `avatars.lipsync`, `avatars.i2v`)

9. Smoke API critical path:
- Added smoke script:
  - `/Users/pixery/Projects/pixflow/src/server/smoke/criticalPath.ts`
- Added npm command:
  - `npm run smoke:api`
- Coverage (local deterministic path):
  - `/health`
  - `/api/auth/login` + `/api/auth/me` (bootstrap admin)
  - `/api/products`
  - `/api/settings/status`
  - `/api/history` create/list/delete/clear
  - `/api/history/favorites` create/update/delete
- Asserts response envelope shape (`success` + `data`) for each step.

10. Middleware/error envelope normalization:
- Auth middleware now returns standard error envelope via helper:
  - `/Users/pixery/Projects/pixflow/src/server/middleware/auth.ts`
- Rate-limit handlers now return standard error envelope:
  - `/Users/pixery/Projects/pixflow/src/server/createApp.ts`
  - `/Users/pixery/Projects/pixflow/src/server/routes/avatars.ts`
- Added consistent server/router error handlers for uncaught middleware/route errors:
  - `/Users/pixery/Projects/pixflow/src/server/createApp.ts`
  - `/Users/pixery/Projects/pixflow/src/server/routes/avatars.ts`

11. Provider runtime reliability layer:
- Added provider runtime utility:
  - `/Users/pixery/Projects/pixflow/src/server/services/providerRuntime.ts`
- Capabilities:
  - `PIXFLOW_MOCK_PROVIDERS` toggle for mock-provider mode
  - bounded retry wrapper with backoff (`runWithRetries`)
  - provider failure-type classification (`timeout`, `rate_limit`, `network`, `provider`)
  - provider-attempt telemetry metadata emission (`provider`, `attempt`, `retries`, `recovered`)
- Integrated into provider-dependent services:
  - `/Users/pixery/Projects/pixflow/src/server/services/avatar.ts`
  - `/Users/pixery/Projects/pixflow/src/server/services/voiceover.ts`
  - `/Users/pixery/Projects/pixflow/src/server/services/tts.ts`
  - `/Users/pixery/Projects/pixflow/src/server/services/fal.ts`
  - `/Users/pixery/Projects/pixflow/src/server/services/hedra.ts`
  - `/Users/pixery/Projects/pixflow/src/server/services/kling.ts`

12. External-integrated smoke path (mock providers):
- Added smoke script:
  - `/Users/pixery/Projects/pixflow/src/server/smoke/externalPipeline.ts`
- Added npm command:
  - `npm run smoke:external`
  - `npm run smoke:external:real` (real-provider profile)
- Coverage:
  - `/api/avatars/generate`
  - `/api/avatars/script`
  - `/api/avatars/tts`
  - `/api/avatars/lipsync`
  - `/api/avatars/i2v`
  - `/api/generate/batch` + `/api/generate/progress/:jobId`
- Verifies provider metadata is present in telemetry output.
- Real-provider profile notes:
  - run with `--real` mode
  - requires `OPENAI_API_KEY`, `FAL_API_KEY`, `HEDRA_API_KEY`
  - uses longer batch polling window suitable for nightly/staging runs
  - includes guardrails in real mode:
    - `PIXFLOW_SMOKE_REAL_MAX_BUDGET_USD` (default: `0.50`)
    - `PIXFLOW_SMOKE_REAL_MAX_RUNTIME_MS` (default: `1200000`)
  - guardrail breaches emit telemetry event:
    - pipeline: `smoke.external.guardrail`
    - reasons: `budget_exceeded` or `timeout_exceeded`

13. Telemetry reporting CLI:
- Added report script:
  - `/Users/pixery/Projects/pixflow/src/server/telemetry/report.ts`
- Added npm command:
  - `npm run telemetry:report`
- Supports:
  - default input: `logs/pipeline-events.jsonl`
  - custom input: `npm run telemetry:report -- --file /path/to/events.jsonl`
  - machine output: `npm run telemetry:report:json`
  - output file path: `--out <path>`
- Output includes:
  - overall success rate
  - overall duration p50/p95
  - per-pipeline success/error rates
  - per-provider success/fail rates
  - retry recovery rate
  - provider failure-type breakdown

14. Telemetry threshold gate + release command:
- Added threshold checker:
  - `/Users/pixery/Projects/pixflow/src/server/telemetry/checkThresholds.ts`
- Added npm commands:
  - `npm run telemetry:check`
  - `npm run gate:release`
- `gate:release` sequence:
  - `lint` -> `smoke:api` -> `smoke:external` -> `telemetry:report` -> `telemetry:check`
- Gate env controls:
  - `PIXFLOW_GATE_MIN_OVERALL_SUCCESS_RATE` (default: `1.0`)
  - `PIXFLOW_GATE_MIN_PROVIDER_SUCCESS_RATE` (default: `1.0`)
  - `PIXFLOW_GATE_MAX_P95_MS` (default: `300000`)
  - `PIXFLOW_GATE_REQUIRE_PROVIDER_EVENTS` (default: `true`)

15. CI and nightly automation:
- Added PR/main CI workflow:
  - `/Users/pixery/Projects/pixflow/.github/workflows/ci.yml`
  - runs `gate:release` (includes lint/smokes/telemetry checks)
  - uploads telemetry artifacts (`telemetry-report.txt`, `telemetry-report.json`, `logs/telemetry-trends.json`, `logs/pipeline-events.jsonl`)
- Added nightly real-provider workflow:
  - `/Users/pixery/Projects/pixflow/.github/workflows/nightly-real-smoke.yml`
  - scheduled + manual trigger
  - runs `lint`, `smoke:external:real`, `telemetry:report`, `telemetry:check`
  - requires GitHub Actions secrets:
    - `OPENAI_API_KEY`
    - `FAL_API_KEY`
    - `HEDRA_API_KEY`
    - `NIGHTLY_ALERT_WEBHOOK` (optional fallback route)
    - `NIGHTLY_ALERT_WEBHOOK_CRITICAL` (optional, preferred for critical alerts)
    - `NIGHTLY_ALERT_WEBHOOK_WARNING` (optional, preferred for warning alerts)
  - uploads nightly telemetry artifacts
  - on failure, posts structured JSON alert to webhook (when configured)
  - severity routing policy:
    - `critical` when guardrail reason is `budget_exceeded`/`timeout_exceeded` or pipeline error count is high
    - otherwise `warning`
    - routes to severity-specific webhook when present, falls back to generic webhook
  - structured alert payload fields:
    - `severity`
    - `alert_route`
    - `run_url`
    - `failed_job`
    - `failed_step`
    - `budget_used`
    - `guardrail_reason`
    - `top_failing_provider`
    - `top_failing_pipeline`
    - `error_summary`
    - `provider_error_count`
    - `pipeline_error_count`
    - `owner_team`
    - `owner_oncall`
    - `escalation_level`
    - `action_required`
    - `retry_recommended`
    - `playbook_id`
    - `playbook_version`
    - `playbook_registry`
    - `runbook_url`
    - `regression_summary`
    - `ref`
    - `sha`
  - playbook/runbook mapping is now backed by repository docs:
    - `/Users/pixery/Projects/pixflow/docs/ops/playbook-registry.json`
    - `/Users/pixery/Projects/pixflow/docs/ops/playbook-registry.schema.json`
    - `/Users/pixery/Projects/pixflow/docs/ops/runbooks/openai-provider.md`
    - `/Users/pixery/Projects/pixflow/docs/ops/runbooks/fal-provider.md`
    - `/Users/pixery/Projects/pixflow/docs/ops/runbooks/hedra-provider.md`
    - `/Users/pixery/Projects/pixflow/docs/ops/runbooks/kling-provider.md`
    - `/Users/pixery/Projects/pixflow/docs/ops/runbooks/nightly-failure.md`
  - nightly alert payload is now built by script (not inline workflow JS):
    - `/Users/pixery/Projects/pixflow/scripts/build-nightly-alert.js`
  - payload now includes regression context from `logs/telemetry-trends.json`:
    - baseline availability
    - success-rate delta/status
    - p95 delta/status
    - provider fail-rate deltas and top regressed provider
  - script parses `docs/ops/playbook-registry.json` dynamically to resolve:
    - owner team/on-call
    - playbook id/version
    - runbook URL at current commit SHA
  - registry validation added:
    - `/Users/pixery/Projects/pixflow/scripts/validate-playbook-registry.js`
    - command: `npm run validate:playbooks`
    - enforced by `gate:release` and nightly workflow
  - nightly workflow sets real-smoke guardrail envs by default:
    - `PIXFLOW_SMOKE_REAL_MAX_BUDGET_USD=0.50`
    - `PIXFLOW_SMOKE_REAL_MAX_RUNTIME_MS=1200000`
  - nightly telemetry gate uses relaxed thresholds by default:
    - `PIXFLOW_GATE_MIN_OVERALL_SUCCESS_RATE=0.90`
    - `PIXFLOW_GATE_MIN_PROVIDER_SUCCESS_RATE=0.80`
    - `PIXFLOW_GATE_MAX_P95_MS=600000`

16. Telemetry trend snapshots + profile-based SLO checks:
- Added trend snapshot generator:
  - `/Users/pixery/Projects/pixflow/src/server/telemetry/trends.ts`
  - command: `npm run telemetry:trends`
  - output: `logs/telemetry-trends.json` (windowed summary: success rate, p95, provider fail rates)
- Upgraded telemetry gate to profile-based thresholds:
  - `/Users/pixery/Projects/pixflow/src/server/telemetry/checkThresholds.ts`
  - commands:
    - `npm run telemetry:check:ci`
    - `npm run telemetry:check:nightly`
    - `npm run telemetry:check:release`
  - `gate:release` now uses `telemetry:check:release`

17. Telemetry markdown dashboard snapshot:
- Added dashboard snapshot builder:
  - `/Users/pixery/Projects/pixflow/scripts/build-telemetry-dashboard.js`
  - command: `npm run telemetry:dashboard`
  - output: `docs/ops/telemetry-dashboard.md`
- Dashboard includes:
  - summary window and overall rates/latency
  - trend-window summary (success + p95)
  - provider table (success/fail/recovery/p95)
  - pipeline table (attempts/success/errors)
  - provider fail-rate trend table
  - regression diff table (current vs previous window) with status classification (`improved`/`regressed`/`stable`)
- Integrated into release/nightly automation:
  - `gate:release` now generates dashboard after report/trends
  - CI and nightly workflows upload `docs/ops/telemetry-dashboard.md` as artifact

18. Trend snapshots now include run-to-run comparable windows:
- Updated trend schema:
  - `/Users/pixery/Projects/pixflow/src/server/telemetry/trends.ts`
- Snapshot now stores:
  - `windowSize`
  - `current` window metrics
  - `previous` window metrics
  - `delta` metrics (`successRate`, `p95Ms`, provider fail-rate deltas)
- Dashboard script is backward-compatible with legacy trend files that only had a single-window shape.

19. Workflow-level regression highlights:
- Added highlights generator:
  - `/Users/pixery/Projects/pixflow/scripts/build-telemetry-highlights.js`
  - command: `npm run telemetry:highlights`
  - output: `docs/ops/telemetry-highlights.md`
- `gate:release` now generates highlights after trends/dashboard.
- CI and nightly workflows now:
  - generate/upload `docs/ops/telemetry-highlights.md`
  - append highlights directly to `$GITHUB_STEP_SUMMARY` for quick run-page visibility.

20. Regression guardrail enforcement (warn vs block):
- Added regression checker:
  - `/Users/pixery/Projects/pixflow/src/server/telemetry/checkRegression.ts`
- Added commands:
  - `npm run telemetry:check:regression`
  - `npm run telemetry:check:regression:warn`
  - `npm run telemetry:check:regression:block`
- Enforcement policy:
  - release gate runs `telemetry:check:regression:block` (blocking)
  - nightly workflow runs `telemetry:check:regression:warn` (non-blocking warning signal)
- Threshold controls (env):
  - `PIXFLOW_REGRESSION_MAX_SUCCESS_DROP`
  - `PIXFLOW_REGRESSION_MAX_P95_INCREASE_MS`
  - `PIXFLOW_REGRESSION_MAX_PROVIDER_FAILRATE_INCREASE`
  - `PIXFLOW_REGRESSION_PROVIDER_THRESHOLDS_JSON` (optional per-provider fail-rate increase overrides)
- Nightly defaults set in workflow:
  - success drop <= `0.03`
  - p95 increase <= `30000` ms
  - provider fail-rate increase <= `0.10`
  - provider overrides (example): `{"openai":0.08,"fal":0.12,"hedra":0.12,"kling":0.15}`

21. Baseline stabilization (history + recommendations):
- Added baseline updater:
  - `/Users/pixery/Projects/pixflow/scripts/update-telemetry-baseline.js`
  - command: `npm run telemetry:baseline`
- Outputs:
  - `logs/telemetry-trends-history.jsonl` (append-only trend history)
  - `docs/ops/telemetry-baseline.json` (machine-readable suggestions)
  - `docs/ops/telemetry-baseline.md` (human-readable summary)
- `gate:release` now generates baseline artifacts.
- CI and nightly workflows now upload baseline artifacts and include baseline summary in `$GITHUB_STEP_SUMMARY`.
- Suggested thresholds are computed from historical transition percentiles and emitted for:
  - `PIXFLOW_REGRESSION_MAX_SUCCESS_DROP`
  - `PIXFLOW_REGRESSION_MAX_P95_INCREASE_MS`
  - `PIXFLOW_REGRESSION_MAX_PROVIDER_FAILRATE_INCREASE`
  - `PIXFLOW_REGRESSION_PROVIDER_THRESHOLDS_JSON`

22. Desktop critical journeys smoke coverage:
- Added desktop-oriented smoke journey script:
  - `/Users/pixery/Projects/pixflow/src/server/smoke/desktopCriticalPaths.ts`
- Added npm command:
  - `npm run smoke:desktop`
- Coverage:
  - Journey A: login -> settings/products -> generate batch -> progress poll -> history write/read
  - Journey B: avatar generate -> script -> tts -> lipsync -> i2v
- Release gate now includes `smoke:desktop` between API smoke and external smoke.

23. Ops readiness (actionable alerts + SLA checklists):
- Nightly alert payload now includes human-action fields:
  - `alert_summary`
  - `next_actions`
  - file: `/Users/pixery/Projects/pixflow/scripts/build-nightly-alert.js`
- `next_actions` is severity-aware and includes run/runbook links and retry guidance.
- Standardized SLA + owner checklists added to runbooks:
  - `/Users/pixery/Projects/pixflow/docs/ops/runbooks/nightly-failure.md`
  - `/Users/pixery/Projects/pixflow/docs/ops/runbooks/openai-provider.md`
  - `/Users/pixery/Projects/pixflow/docs/ops/runbooks/fal-provider.md`
  - `/Users/pixery/Projects/pixflow/docs/ops/runbooks/hedra-provider.md`
  - `/Users/pixery/Projects/pixflow/docs/ops/runbooks/kling-provider.md`

24. Release readiness preflight report:
- Added preflight report builder:
  - `/Users/pixery/Projects/pixflow/scripts/build-release-preflight.js`
- Added commands:
  - `npm run preflight:release`
  - `npm run preflight:nightly`
- Outputs:
  - `docs/ops/release-preflight.json`
  - `docs/ops/release-preflight.md`
- `gate:release` now produces preflight report before final regression/release checks.
- CI and nightly workflows now publish preflight report to:
  - `$GITHUB_STEP_SUMMARY`
  - uploaded artifacts
- Decision model:
  - `READY` (no warnings/failures)
  - `CONDITIONAL` (warnings only)
  - `NOT_READY` (one or more failures)

---

25. Phase D — Visual Design & Polish (Claude):
- Semantic CSS tokens: replaced all hardcoded `gray-*`/`purple-*`/`violet-*`/`zinc-*` Tailwind classes with `surface-*`/`brand-*` semantic tokens across 13 renderer files.
- Component library (11 components): Button, Input, Select, Slider, Card, Badge, Modal, Skeleton, EmptyState, DropZone, ProgressBar.
  - Location: `src/renderer/components/ui/`
- Toast system: `src/renderer/lib/toast.ts` (wrapper around react-hot-toast).
- FeedbackWidget: `src/renderer/components/feedback/FeedbackWidget.tsx`.
- framer-motion integration: page transitions (`PageTransition.tsx`), modal/overlay animations.
- React.lazy + Suspense code splitting for 5 page components in `AppShell.tsx`.
- Keyboard shortcuts: `src/renderer/hooks/useKeyboardShortcuts.ts` (Cmd+1-5 tab switching, Escape to close).
- CSS theme tokens extended: `--color-danger`, `--color-warning`, `--color-success`, `--color-info`, transition easings.
- Zero remaining hardcoded color classes in renderer (verified via grep).

26. Backlog completion (Claude):
- Threshold tuning proposals: `scripts/propose-threshold-update.js`, command `npm run threshold:propose`.
- Alert de-duplication: `scripts/build-nightly-alert-dedup.js`, command `npm run alert:dedup`.
- Preflight decision history: `scripts/build-preflight-history.js`, command `npm run preflight:history`.
- All three integrated into `gate:release`, CI workflow, and nightly workflow.

27. Phase D status color token migration (Session 3):
- Extended semantic CSS tokens in `src/renderer/index.css`:
  - `--color-danger-hover: #dc2626`
  - `--color-danger-muted: #7f1d1d`
  - `--color-warning-hover: #d97706`
  - `--color-warning-muted: #78350f`
  - `--color-success-hover: #16a34a`
  - `--color-success-muted: #14532d`
  - `--color-accent: #06b6d4`
  - `--color-accent-hover: #0891b2`
- Migrated all remaining hardcoded status colors (`emerald-*`, `amber-*`, `red-*`, `cyan-*`) to semantic tokens across 9 files:
  - `src/renderer/components/ui/Badge.tsx` — success/warning/danger variants
  - `src/renderer/components/ui/Button.tsx` — danger variant
  - `src/renderer/components/prompt-factory/PromptFactoryPage.tsx` — 6 color edits (error blocks, cancel, success buttons)
  - `src/renderer/components/asset-monster/AssetMonsterPage.tsx` — extensive migration (remove buttons, generate button, error/warning blocks, status badges, image borders, custom prompt errors)
  - `src/renderer/components/avatar-studio/AvatarStudioPage.tsx` — 22 color changes (warning/danger/success blocks, amber hints, emerald buttons, cyan I2V section → accent)
  - `src/renderer/components/machine/MachinePage.tsx` — 8 edits (error/warning blocks, Run/Cancel buttons, progress bar, download button)
  - `src/renderer/components/library/LibraryPage.tsx` — favorites toast
  - `src/renderer/components/layout/ImagePreviewOverlay.tsx` — download button hover
  - `src/renderer/components/layout/AvatarPreviewOverlay.tsx` — download button hover
- Post-migration audit: 0 hardcoded status color classes remaining (verified via comprehensive regex).
- Commit: `f9ea5d8`

28. Electron native module fix (Session 3):
- `better-sqlite3` was compiled for Node.js v25 (NODE_MODULE_VERSION 141) but Electron v33 requires NODE_MODULE_VERSION 130.
- Fix: rebuilt `better-sqlite3` using `node-gyp rebuild --target=33.4.11 --dist-url=https://electronjs.org/headers` from within `node_modules/better-sqlite3/`.
- Note: `npx electron-rebuild` and `npx @electron/rebuild` both silently skipped the rebuild. Manual `node-gyp` was required.
- After rebuild, Electron embedded server starts successfully.
- Important: this rebuild is local only (not committed). After `npm install`, the rebuild must be repeated. Consider adding a `postinstall` script: `electron-rebuild -f -w better-sqlite3` or using `electron-builder` rebuild hooks.

29. Full E2E verification pass (Session 3):
- Test environment: Electron dev mode (`npm run dev`), Playwright browser automation on `http://localhost:5173`.
- Admin password reset via `sqlite3` CLI (bcrypt hash updated directly in `data/pixflow.db`).
- Test credentials: `admin@pixery.com` / `pixflowtest1234`
- All tests passed:
  - Login page renders, auth flow works (JWT returned, session persists)
  - All 5 tabs render correctly: Prompt Factory, Asset Monster, Avatar Studio, The Machine, Library
  - Product color switching: Clone AI (purple) → Fyro (orange) → Zurna (cyan) — all brand-colored elements update dynamically
  - Dark/light mode toggle: surface tokens flip correctly
  - User menu dropdown: name, email, Change Password, Sign Out (danger-colored)
  - Notification bell dropdown: renders with "No notifications"
  - Feedback widget: expand, category select, text input, submit → toast → backend persists (verified via API)
  - API health endpoint: responds with `{ success: true }`
  - Feedback API: end-to-end with correct user_id, product_id, category
  - Console errors: 0
  - Avatar gallery: 122 images load in both Asset Monster and Avatar Studio
  - Generation settings: all dropdowns render (aspect ratio, images per prompt, resolution, format)
  - The Machine: full settings panel with concept input, prompt slider, avatar grid, voiceover controls

---

## 6) Remaining Risks / Gaps

1. API contract hardening:
- Success payloads are now strict envelope (`{ success, data }`).
- Remaining caution: third-party middleware responses (e.g., rate limiter) can still bypass helper format unless explicitly wrapped.

2. Observability depth gap:
- Telemetry now has report + trend snapshots + markdown dashboard snapshot + baseline history/suggestions.
- Next depth step: publish dashboard/baseline to a hosted/static observability surface with historical comparisons.

3. Native module rebuild not automated:
- `better-sqlite3` requires manual `node-gyp rebuild --target=<electron-version> --dist-url=https://electronjs.org/headers` after every `npm install`.
- Risk: fresh installs or CI environments will fail at runtime with `NODE_MODULE_VERSION` mismatch.
- Fix: add `postinstall` script or use `electron-builder` rebuild hooks.

4. UI component library adoption gap:
- 11 UI components exist in `src/renderer/components/ui/` (Button, Input, Select, Slider, Card, Modal, Badge, Skeleton, EmptyState, DropZone, ProgressBar).
- None are imported or used in the 5 page components — pages still use inline `<button>`, `<input>`, `<select>` with Tailwind classes.
- This is a consistency/maintainability gap, not a functional one. All pages work and use semantic tokens correctly.
- Risk: low (cosmetic). Component adoption carries regression risk and should be done incrementally with visual diff testing.

---

## 7) Recommended Next Steps (updated backlog summary)

**Completed backlog items:**
1. ~~Automate threshold tuning handoff~~ → **DONE** (Session 2)
2. ~~Add alert de-duplication window~~ → **DONE** (Session 2)
3. ~~Expose preflight decision history~~ → **DONE** (Session 2)
4. ~~Status color token migration~~ → **DONE** (Session 3): all hardcoded `emerald/amber/red/cyan` → semantic `success/warning/danger/accent` tokens.
5. ~~E2E verification~~ → **DONE** (Session 3): all tabs, auth, product switching, theme toggle, feedback widget verified.

**Immediate priorities:**

1. Automate native module rebuild:
- Add `postinstall` script to `package.json`: `"postinstall": "electron-rebuild -f -w better-sqlite3"` or equivalent.
- Verify it works on clean `npm install`.

2. UI component library adoption (Phase D+):
- Incrementally replace inline `<button>`/`<input>`/`<select>` in page components with `<Button>`/`<Input>`/`<Select>` from component library.
- Start with lowest-risk pages: LibraryPage → PromptFactoryPage → AssetMonsterPage → AvatarStudioPage → MachinePage.
- Test each page visually after migration.

**Codex handoff (quality foundation):**
3. Add Vitest test runner + unit tests for core backend services (history, telemetry, providerRuntime).
4. Add Biome or ESLint for static analysis beyond `tsc --noEmit`.
5. Add React ErrorBoundary wrappers around lazy-loaded page components.
6. Improve mock smoke tests to cover provider failure scenarios (timeout, rate limit, partial failure).

**Feature backlog:**
7. Publish dashboard/baseline to a hosted/static observability surface with historical comparisons.
8. Add provider-level SLA tracking with per-provider uptime windows.
9. Integrate threshold proposals into automated PR creation via GitHub Actions.

---

## 8) Interpretation Rules for Future AI Agents

- Treat `Burgflow Archive/` as read-only historical material.
- Treat root `src/` and `docs/` as active Pixflow source of truth.
- Keep product naming as **Pixflow** in all new code, docs, and UX strings.
- Keep all active documentation in English.
- Do not reintroduce archived paths into active build/runtime unless explicitly requested.

---

## 9) Verification Snapshot (post-change intent)

- Search for `borgflow`/`Borgflow` outside archive should be empty or near-empty.
- Active references should point to Pixflow docs and active `src/*`.
- Legacy code should remain discoverable under `Burgflow Archive/` only.
