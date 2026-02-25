# Pixflow UI Rules (Feb 2026)

Last updated: 2026-02-24

## Purpose
Keep the UI consistent and predictable across all Pixflow categories. These rules are the source of truth for layout, navigation, and state feedback.

## Layout
- Desktop: Inputs left, outputs right. Two-column layout must be `grid-cols-1 xl:grid-cols-2`.
- Compose exception: top block uses `grid-cols-1 xl:grid-cols-3` with controls in `xl:col-span-2` and preview in `xl:col-span-1`; timeline stays full-width under this block.
- Mobile: Single column with inputs first, outputs second.
- Forms: Use `grid-cols-1 sm:grid-cols-2` for dense field groups.
- Long lists/grids: keep padding and card radius consistent (`rounded-lg` + surface background).
- Result grids: `grid-cols-2 sm:grid-cols-3 xl:grid-cols-4` — not page-specific column counts.
- Transcript Media (Avatar Studio): selected avatar thumbnail and script textarea must share the same top baseline and exact visual height.
- Preferred implementation for Transcript Media alignment: 2-column grid (`thumbnail`, `script`) with a dedicated header row and content row.
- `Have an Audio` (Avatar Studio): while uploading, show only progress UI; after completion, replace progress with audio preview card.

## Navigation
- Top-level category navigation: `SideNav` (collapsible icon/label sidebar).
- In-page mode switches: `SegmentedTabs`.
- Actions are always `Button` (no action inside tab sets).
- If a control changes the view/state, it is a tab. If it triggers work, it is a button.
- Tab switch scrolls content to top automatically.
- Active category set (current): Prompt Factory, Asset Monster, Img2Engine, Avatar Studio, Captions, The Machine, Lifetime, Library, Competitor Report.
- Under-development lock policy: categories can remain visible but non-clickable in `SideNav`; lock must be enforced in both UI and navigation store.
- Home page card policy (current): `Competitor Report` hidden from main cards; `Compose` card shown alongside `Lifetime`.
- Sidebar footer policy: utility icons only (`collapse`, `theme`, `keyboard shortcuts`, `what's new`). No `Dev/User` row.

## Steps
- Wizard-like flows use `StepHeader` for numbering + titles.
- Keep step labels short and action-oriented.
- **Never use custom step circles or ad-hoc numbering.** Migrate to `StepHeader`.

## Outputs
- Outputs live in the right column and should be grouped into a single card per major phase.
- Use `StepHeader` for the main output container title (e.g. `Generated Images`, `Generated Videos`).
- Avoid page-specific naming like `Final Outputs` unless the output is literally final (e.g. Lifetime compilation).
- Use `PreviousGenerationsPanel` for archived outputs (keep history visible until user deletes).
- Video output grids: prefer `grid-cols-2` for large previews.
- Image output grids: default `grid-cols-2 sm:grid-cols-3 xl:grid-cols-4` unless the product explicitly requires otherwise.
- Compose exception (temporary product decision): hide inline output section; track exports via Job Monitor/Previous Generations flow.

## Global Progress
- Use the global `Job Monitor` (bottom-right overlay) for cross-tab job visibility.
- The monitor shows the last 50 jobs and excludes `Library` and `Competitor Report`.

## Status and Feedback
- Status chips: `StatusPill` (queued/generating/completed/failed/neutral).
- Banners: `StatusBanner` only. Do not introduce custom banners.
- Empty state: `EmptyState` component — never ad-hoc text.
- Loading: `LoadingState` component — never raw `Loader2` spinners.
- Progress: `ProgressBar`.

## Buttons
- Use shared `Button` variants for all actions.
- **Generate/Regenerate buttons:** Let auto-lime detection handle variant. Never manually set `variant="lime"`, `variant="success"`, or `variant="warning"` on generate actions — the Button component detects "generate"/"regenerate" labels and applies lime automatically.
- **Disabled state:** `Button` renders `bg-surface-200 text-surface-400` when `disabled` or `loading`, bypassing variant color. Do not rely on `opacity-50` for disabled — it is not used.
- Avoid raw `<button>` unless the element is a card overlay or complex hit-target.

## Destructive Actions
- All destructive actions (delete, clear, remove) require `ConfirmationDialog` before execution.
- Use `variant="ghost-danger"` for destructive trigger buttons.
- Never delete/clear data on single click without confirmation.

## Error Hierarchy
- **Validation errors:** Toast via `notify.error()` — transient, 3s.
- **API/network errors:** `StatusBanner variant="error"` — persistent inline, user-dismissible.
- **Blocking errors:** Inline alert with retry action.
- Do not mix — each severity has one display mechanism.

## Responsive & Touch Standards
- **Touch targets:** All interactive elements (buttons, slider thumbs, modal close) must be at least 44×44px CSS (WCAG 2.2 AAA). Use `min-h-[44px] min-w-[44px]` guard classes on custom hit areas.
- **Responsive padding:** Content areas use `p-4 sm:p-6 xl:p-8` — never a fixed `p-8` at all widths.
- **Sidebar:** Auto-collapses at `<lg` (1024px). Expanded at `≥lg` if the user hasn't manually toggled.
- **Modals:** Use `max-w-[min(<desired>,calc(100vw-2rem))]` to cap width while preventing horizontal overflow on narrow viewports. Never stack two `max-w-*` utilities — the later one wins.
- **Text overflow:** Use `truncate` or `line-clamp-*` on any user-generated or variable-length text (prompt previews, file names, error messages). Never allow unbounded text to break layout.
- **Breakpoint ladder:** Use at least `sm:` + `xl:` where layout shifts. Avoid relying on `xl:` alone.

## Visual Tokens
- **Secondary text:** `text-surface-400` = hint/disabled, `text-surface-500` = secondary, `text-surface-600` = label.
- **Borders:** `border-surface-200/50` for card edges. `border-surface-100` for section dividers.
- **Icon sizes:** `w-4 h-4` inline, `w-5 h-5` section headers, `w-6 h-6` hero/page icons. Never use arbitrary sizes.
- **Animation durations:** `duration-150` (fast, hover/focus), `duration-300` (medium, transitions). Page-enter uses a custom 220ms ease-out keyframe (not a Tailwind duration class).

## Accessibility Baseline
- Tabs must be keyboard navigable (ArrowLeft/ArrowRight/Home/End).
- Buttons need clear labels and visible focus states.
- Avoid color-only status; pair with text (`StatusPill` labels).

## Do Not
- No bespoke tab/button styles for modes.
- No custom banner components.
- No "action tabs" (Upload, Generate, Save inside tab rows).
- No raw `<Loader2>` spinners — use `LoadingState`.
- No ad-hoc empty text — use `EmptyState`.
- No single-click destructive actions — use `ConfirmationDialog`.

## Tooltips
- Use `Tooltip` (`src/renderer/components/ui/Tooltip.tsx`) for icon-only or collapsed-sidebar labels.
- `enabled` prop: set `enabled={false}` to suppress tooltip when label is already visible (e.g. expanded sidebar).
- Default `delay={500}`. Do not use `delay=99999` as a disable hack — use `enabled={false}`.
- Portal-rendered to `document.body`, z-index 55 (above JobMonitorWidget z-45, above Modal z-50 — tooltips dismiss on click so overlap is transient).

## Keyboard Shortcuts
- Navigation shortcuts are `Ctrl/Cmd + 1..9` and map only to active clickable tabs.
- `?` toggles `ShortcutHelpModal`.
- Compose-only shortcuts:
  - `Ctrl/Cmd + Z` undo
  - `Ctrl/Cmd + Shift + Z` redo
  - `Left Arrow` previous frame
  - `Right Arrow` next frame

## Page Transitions
- `PageTransition` wraps all page content with `page-enter` animation (220ms ease-out fade+slide).
- `prefers-reduced-motion` disables the animation automatically.

## Component Map
- `SideNav`: top-level category navigation
- `SegmentedTabs`: in-page mode toggles
- `StepHeader`: step-based flows
- `StatusPill`: per-item status
- `StatusBanner`: inline warnings/errors/info
- `EmptyState`: empty outputs
- `LoadingState`: neutral loading placeholder
- `ProgressBar`: generation or upload progress
- `ConfirmationDialog`: destructive action confirmation
- `Tooltip`: hover labels for icon-only controls
- `ShortcutHelpModal`: keyboard shortcuts overlay (`?` key, `useShortcutHelpStore`)
- `WhatsNewModal`: changelog overlay (`useWhatsNew`, `pixflow_whats_new_seen` localStorage)
