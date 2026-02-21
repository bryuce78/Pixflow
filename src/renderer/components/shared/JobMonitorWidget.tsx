import { FolderOpen, Loader2, Minus, XCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { apiUrl, authFetch, getApiError } from '../../lib/api'
import { useAvatarStore } from '../../stores/avatarStore'
import { useGenerationStore } from '../../stores/generationStore'
import { useImg2VideoQueueStore } from '../../stores/img2videoQueueStore'
import { useMachineStore } from '../../stores/machineStore'
import { type TabId, useNavigationStore } from '../../stores/navigationStore'
import type { OutputHistoryEntry, OutputHistoryStatus } from '../../stores/outputHistoryStore'
import { useOutputHistoryStore } from '../../stores/outputHistoryStore'
import { usePromptStore } from '../../stores/promptStore'
import { Button } from '../ui/Button'

const STORAGE_KEY = 'pixflow_job_monitor_collapsed'
const MAX_VISIBLE = 50
const ROWS_VISIBLE_TARGET = 10
const APPROX_ROW_HEIGHT_PX = 76

const EXCLUDED_CATEGORY_STRINGS = new Set([
  // Not currently part of OutputHistoryCategory, but keep this future-proof.
  'competitors',
  'competitor_report',
  'history',
  'library',
])

const STATUS_STYLE: Record<OutputHistoryStatus, { label: string; text: string; dot: string; icon?: 'spinner' }> = {
  running: { label: 'RUNNING', text: 'text-warning', dot: 'bg-warning border-warning', icon: 'spinner' },
  completed: { label: 'DONE', text: 'text-success', dot: 'bg-success border-success' },
  failed: { label: 'FAILED', text: 'text-danger', dot: 'bg-danger border-danger' },
}

const CATEGORY_TO_TAB: Record<OutputHistoryEntry['category'], TabId> = {
  prompt_factory: 'prompts',
  asset_monster: 'generate',
  img2img: 'img2video',
  img2video: 'img2video',
  startend: 'img2video',
  avatars_talking: 'avatars',
  avatars_reaction: 'avatars',
  captions: 'captions',
  compose: 'compose',
  machine: 'machine',
  lifetime: 'lifetime',
}

const CANCELLABLE_CATEGORIES = new Set<OutputHistoryEntry['category']>([
  'prompt_factory',
  'asset_monster',
  'img2img',
  'img2video',
  'startend',
  'machine',
  'avatars_reaction',
])

function isCancellableCategory(category: OutputHistoryEntry['category']): boolean {
  return CANCELLABLE_CATEGORIES.has(category)
}

function formatCategory(category: string): string {
  return category
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((p) => p.slice(0, 1).toUpperCase() + p.slice(1))
    .join(' ')
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function getFolderPath(entry: OutputHistoryEntry): { displayPath: string; openPath: string } | null {
  const folderArtifact = entry.artifacts.find((artifact) => artifact.type === 'folder' && artifact.url)
  if (folderArtifact?.url) {
    const openPath = folderArtifact.url.replace(/\/+$/, '')
    const localLabel = String(folderArtifact.label || '').trim()
    const displayPath = localLabel.startsWith('/') ? localLabel : openPath
    return { displayPath, openPath }
  }

  const artifactWithUrl = entry.artifacts.find((artifact) => artifact.url)
  const url = artifactWithUrl?.url
  if (!url) return null

  const normalized = String(url).trim().replace(/\/+$/, '')
  if (!(normalized.startsWith('/outputs/') || normalized.startsWith('/uploads/'))) {
    return null
  }

  const lastSlash = normalized.lastIndexOf('/')
  if (lastSlash <= 0) return null
  const openPath = normalized.slice(0, lastSlash)
  if (!openPath) return null
  return { displayPath: openPath, openPath }
}

async function openLocalFolder(openPath: string): Promise<void> {
  const response = await authFetch(apiUrl('/api/system/open-folder'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: openPath }),
  })

  if (!response.ok) {
    const raw = await response.json().catch(() => ({}))
    throw new Error(getApiError(raw, `Failed to open folder (${response.status})`))
  }
}

export function JobMonitorWidget() {
  const entries = useOutputHistoryStore((s) => s.entries)
  const remove = useOutputHistoryStore((s) => s.remove)
  const patch = useOutputHistoryStore((s) => s.patch)
  const navigate = useNavigationStore((s) => s.navigate)
  const cancelPromptGenerate = usePromptStore((s) => s.cancelGenerate)
  const cancelBatch = useGenerationStore((s) => s.cancelBatch)
  const cancelQueueCurrent = useImg2VideoQueueStore((s) => s.cancelCurrent)
  const cancelMachine = useMachineStore((s) => s.cancel)
  const cancelReaction = useAvatarStore((s) => s.cancelReactionVideo)

  const [collapsed, setCollapsed] = useState<boolean>(() => readCollapsed())

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
    } catch {
      // ignore
    }
  }, [collapsed])

  const visible = useMemo(() => {
    const filtered = entries.filter((e) => !EXCLUDED_CATEGORY_STRINGS.has(String(e.category)))
    return filtered.slice(0, MAX_VISIBLE)
  }, [entries])

  const runningCount = useMemo(() => visible.filter((e) => e.status === 'running').length, [visible])
  const listMaxHeightPx = ROWS_VISIBLE_TARGET * APPROX_ROW_HEIGHT_PX

  const jumpToOutput = (entry: OutputHistoryEntry) => {
    const tab = CATEGORY_TO_TAB[entry.category]
    if (tab) {
      navigate(tab)
    }

    let attempts = 0
    const tryScroll = () => {
      const target = ([
        document.querySelector(`[data-history-entry-id="${entry.id}"]`),
        document.querySelector(`[data-output-category="${entry.category}"]`),
      ].find(Boolean) || null) as HTMLElement | null

      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
        target.animate(
          [
            { boxShadow: '0 0 0 0 rgba(124,58,237,0)' },
            { boxShadow: '0 0 0 3px rgba(124,58,237,0.55)' },
            { boxShadow: '0 0 0 0 rgba(124,58,237,0)' },
          ],
          { duration: 900, easing: 'ease-out' },
        )
        return
      }

      attempts += 1
      if (attempts < 40) {
        window.setTimeout(tryScroll, 120)
      }
    }

    window.setTimeout(tryScroll, tab ? 120 : 0)
  }

  const cancelJob = (entry: OutputHistoryEntry) => {
    if (entry.status !== 'running') return
    if (!isCancellableCategory(entry.category)) return

    switch (entry.category) {
      case 'prompt_factory':
        cancelPromptGenerate()
        break
      case 'asset_monster':
        cancelBatch()
        break
      case 'img2img':
      case 'img2video':
      case 'startend':
        cancelQueueCurrent()
        break
      case 'machine':
        cancelMachine()
        break
      case 'avatars_reaction':
        cancelReaction()
        break
      default:
        return
    }

    patch(entry.id, {
      status: 'failed',
      message: 'Cancelled by user',
    })
  }

  const header = (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Jobs</span>
          <span className="text-[11px] text-surface-400">
            {runningCount > 0 ? `${runningCount} running` : 'idle'} · {visible.length}/{MAX_VISIBLE}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost-muted"
          size="xs"
          icon={<Minus className="w-3 h-3" />}
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? 'Expand job monitor' : 'Collapse job monitor'}
        />
      </div>
    </div>
  )

  if (collapsed) {
    return (
      <div className="fixed bottom-4 right-4 z-[45] no-drag pointer-events-none">
        <div className="pointer-events-auto w-[240px] rounded-xl border border-surface-100 bg-surface-0 shadow-lg">
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="w-full px-3 py-2 text-left hover:bg-surface-50 transition-colors rounded-xl"
            aria-label="Expand job monitor"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Jobs</span>
                  <span className="text-[11px] text-surface-400">
                    {runningCount > 0 ? `${runningCount} running` : 'idle'}
                  </span>
                </div>
              </div>
              <span className="text-xs text-surface-400">Open</span>
            </div>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-[45] no-drag pointer-events-none">
      <div className="pointer-events-auto w-[420px] max-w-[min(420px,calc(100vw-16px))] rounded-xl border border-surface-100 bg-surface-0 shadow-lg">
        <div className="px-3 py-2 border-b border-surface-100">{header}</div>

        <div style={{ maxHeight: `min(74vh, ${listMaxHeightPx}px)` }} className="overflow-y-auto">
          {visible.length === 0 ? (
            <div className="p-3 text-xs text-surface-400">No jobs yet.</div>
          ) : (
            <div className="p-2 space-y-2">
              {visible.map((entry) => (
                <JobRow
                  key={entry.id}
                  entry={entry}
                  onRemove={() => remove(entry.id)}
                  onJump={() => jumpToOutput(entry)}
                  canCancel={entry.status === 'running' && isCancellableCategory(entry.category)}
                  onCancel={() => cancelJob(entry)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function JobRow({
  entry,
  onRemove,
  onJump,
  canCancel,
  onCancel,
}: {
  entry: OutputHistoryEntry
  onRemove: () => void
  onJump: () => void
  canCancel: boolean
  onCancel: () => void
}) {
  const style = STATUS_STYLE[entry.status]
  const folderInfo = getFolderPath(entry)
  const time = new Date(entry.updatedAt || entry.startedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="relative w-full text-left rounded-lg border border-surface-100 bg-surface-50 p-2 hover:border-brand-500/40 hover:bg-surface-100/80 transition-colors">
      <button type="button" className="absolute inset-0 z-0 rounded-lg" aria-label="Open job output" onClick={onJump} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 relative z-10">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-2.5 h-2.5 rounded-full border-2 ${style.dot}`} />
            <div className="min-w-0">
              <div className="text-xs text-surface-900 truncate">{entry.title}</div>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-surface-400">
                <span className="truncate">{formatCategory(String(entry.category))}</span>
                <span>·</span>
                <span className={style.text}>{style.label}</span>
                <span>·</span>
                <span>{time}</span>
              </div>
            </div>
          </div>

          {entry.message && <div className="mt-1 text-[11px] text-surface-400 line-clamp-2">{entry.message}</div>}
          {folderInfo && (
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-surface-400 min-w-0">
              <FolderOpen className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{folderInfo.displayPath}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 relative z-10">
          {style.icon === 'spinner' && <Loader2 className="w-4 h-4 animate-spin text-warning" />}
          {folderInfo && (
            <Button
              variant="ghost-muted"
              size="xs"
              icon={<FolderOpen className="w-3.5 h-3.5" />}
              onClick={(event) => {
                event.stopPropagation()
                const preferredPath = folderInfo.displayPath.startsWith('/')
                  ? folderInfo.displayPath
                  : folderInfo.openPath
                void openLocalFolder(preferredPath).catch((error) => {
                  console.error('[job-monitor] failed to open local folder:', error)
                })
              }}
              aria-label="Open output folder"
            />
          )}
          {canCancel && (
            <Button
              variant="ghost-danger"
              size="xs"
              icon={<XCircle className="w-3.5 h-3.5" />}
              onClick={(event) => {
                event.stopPropagation()
                onCancel()
              }}
              aria-label="Cancel job"
            />
          )}
          <Button
            variant="ghost-muted"
            size="xs"
            icon={<Minus className="w-3 h-3" />}
            onClick={(event) => {
              event.stopPropagation()
              onRemove()
            }}
            aria-label="Remove job"
          />
        </div>
      </div>
    </div>
  )
}
