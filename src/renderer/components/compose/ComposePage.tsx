import { ListOrdered, Pause, Play, Redo2, SkipBack, SkipForward, Square, Trash2, Undo2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import { type AspectRatio, useComposeStore } from '../../stores/composeStore'
import { StepHeader } from '../asset-monster/StepHeader'
import { Button } from '../ui/Button'
import { SegmentedTabs } from '../ui/navigation/SegmentedTabs'
import { StatusBanner } from '../ui/StatusBanner'
import { AssetsPanel } from './AssetsPanel'
import { ComposeCanvas } from './ComposeCanvas'
import { ComposeTimeline } from './ComposeTimeline'
import { LayerSettings } from './LayerSettings'

const ASPECT_ITEMS: { id: AspectRatio; label: string }[] = [
  { id: '9:16', label: '9:16' },
  { id: '16:9', label: '16:9' },
  { id: '1:1', label: '1:1' },
  { id: '4:5', label: '4:5' },
]

export default function ComposePage() {
  const layers = useComposeStore((s) => s.layers)
  const aspectRatio = useComposeStore((s) => s.aspectRatio)
  const setAspectRatio = useComposeStore((s) => s.setAspectRatio)
  const compositionLength = useComposeStore((s) => s.compositionLength)
  const setCompositionLength = useComposeStore((s) => s.setCompositionLength)
  const clearAll = useComposeStore((s) => s.clearAll)
  const exportJob = useComposeStore((s) => s.exportJob)
  const startExport = useComposeStore((s) => s.startExport)
  const playbackTime = useComposeStore((s) => s.playbackTime)
  const setPlaybackTime = useComposeStore((s) => s.setPlaybackTime)
  const isPlaying = useComposeStore((s) => s.isPlaying)
  const setIsPlaying = useComposeStore((s) => s.setIsPlaying)
  const totalDuration = useComposeStore((s) => s.totalDuration)
  const selectedLayerIds = useComposeStore((s) => s.selectedLayerIds)
  const sequenceLayers = useComposeStore((s) => s.sequenceLayers)
  const stepFrame = useComposeStore((s) => s.stepFrame)
  const undo = useComposeStore((s) => s.undo)
  const redo = useComposeStore((s) => s.redo)
  const canUndo = useComposeStore((s) => s.canUndo)
  const canRedo = useComposeStore((s) => s.canRedo)

  const [error, setError] = useState('')
  const [showSequence, setShowSequence] = useState(false)
  const [seqDuration, setSeqDuration] = useState(5)
  const [seqSelectionOrder, setSeqSelectionOrder] = useState(true)

  const handleExport = useCallback(async () => {
    setError('')
    try {
      await startExport()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    }
  }, [startExport])

  const duration = totalDuration()
  const visibleLayerCount = layers.filter((layer) => layer.visible).length
  const isExporting = exportJob?.status === 'uploading' || exportJob?.status === 'exporting'

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="space-y-6 xl:col-span-2">
          <div className="bg-surface-50 rounded-lg p-4">
            <StepHeader stepNumber={1} title="Add Assets" />
            <AssetsPanel />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-surface-50 rounded-lg p-4 space-y-3">
              <StepHeader stepNumber={2} title="Composition Settings" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-surface-500">Aspect Ratio</span>
                <SegmentedTabs
                  value={aspectRatio}
                  items={ASPECT_ITEMS}
                  onChange={setAspectRatio}
                  ariaLabel="Aspect ratio"
                  size="sm"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-surface-500">Duration (s)</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={compositionLength}
                  onChange={(e) => setCompositionLength(Math.max(1, Number(e.target.value)))}
                  className="w-24 rounded-md border border-surface-200 bg-surface-0 px-2 py-1.5 text-sm text-right"
                />
              </div>
            </div>

            <div className="bg-surface-50 rounded-lg p-4">
              <StepHeader stepNumber={3} title="Layer Settings" />
              <LayerSettings />
            </div>
          </div>
        </div>

        <div className="space-y-6 xl:col-span-1">
          <div className="bg-surface-50 rounded-lg p-4 h-full flex flex-col">
            <StepHeader stepNumber={4} title="Preview" />
            <ComposeCanvas />
            <div className="flex items-center gap-3 mt-4">
              <button
                type="button"
                onClick={() => stepFrame(-1)}
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-100 hover:bg-surface-200 transition"
                title="Previous frame"
                aria-label="Previous frame"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-100 hover:bg-surface-200 transition"
                title={isPlaying ? 'Pause preview' : 'Play preview'}
                aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false)
                  setPlaybackTime(0)
                }}
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-100 hover:bg-surface-200 transition"
                title="Stop preview"
                aria-label="Stop preview"
              >
                <Square className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => stepFrame(1)}
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-100 hover:bg-surface-200 transition"
                title="Next frame"
                aria-label="Next frame"
              >
                <SkipForward className="w-4 h-4" />
              </button>
              <input
                type="range"
                min={0}
                max={duration || 1}
                step={0.05}
                value={playbackTime}
                onChange={(e) => setPlaybackTime(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-xs text-surface-400 font-mono w-20 text-right">
                {playbackTime.toFixed(1)}s / {duration.toFixed(1)}s
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface-50 rounded-lg p-4">
        <StepHeader stepNumber={5} title="Timeline" />
        <ComposeTimeline />
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-100 hover:bg-surface-200 text-surface-600 disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="Undo (⌘Z)"
            aria-label="Undo"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-100 hover:bg-surface-200 text-surface-600 disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="Redo (⌘⇧Z)"
            aria-label="Redo"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-100 hover:bg-surface-200 transition"
            title={isPlaying ? 'Pause timeline' : 'Play timeline'}
            aria-label={isPlaying ? 'Pause timeline' : 'Play timeline'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          {selectedLayerIds.length >= 2 && (
            <div className="relative ml-2">
              <Button variant="secondary" onClick={() => setShowSequence((prev) => !prev)}>
                <ListOrdered className="w-4 h-4 mr-1" />
                Sequence ({selectedLayerIds.length})
              </Button>
              {showSequence && (
                <div className="absolute bottom-full left-0 mb-2 w-64 bg-surface-50 border border-surface-200 rounded-lg shadow-lg p-4 z-10">
                  <div className="text-sm font-medium mb-3">Sequence Layers</div>
                  <label className="block text-xs text-surface-500 mb-2">
                    Image Duration (s)
                    <input
                      type="number"
                      min={0.1}
                      step={0.1}
                      value={seqDuration}
                      onChange={(e) => setSeqDuration(Math.max(0.1, Number(e.target.value)))}
                      className="mt-1 w-full rounded-md border border-surface-200 bg-surface-0 px-2 py-1.5 text-sm"
                    />
                  </label>
                  <p className="text-[11px] text-surface-400 mb-3">Videos keep their source duration</p>
                  <label className="flex items-center gap-2 text-xs text-surface-500 mb-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={seqSelectionOrder}
                      onChange={(e) => setSeqSelectionOrder(e.target.checked)}
                      className="rounded"
                    />
                    Use selection order
                  </label>
                  <Button
                    size="sm"
                    onClick={() => {
                      sequenceLayers(seqDuration, seqSelectionOrder)
                      setShowSequence(false)
                    }}
                  >
                    Apply
                  </Button>
                </div>
              )}
            </div>
          )}

          <span className="ml-auto text-xs text-surface-400">
            Visible layers: {visibleLayerCount}/{layers.length}
          </span>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Button onClick={handleExport} disabled={visibleLayerCount === 0 || isExporting} loading={isExporting}>
            Generate Composition
          </Button>
          <Button variant="ghost-danger" onClick={clearAll} disabled={isExporting}>
            <Trash2 className="w-4 h-4 mr-1" />
            Clear All
          </Button>
        </div>
        {error && (
          <div className="mt-4">
            <StatusBanner variant="error" onDismiss={() => setError('')}>
              {error}
            </StatusBanner>
          </div>
        )}
        {exportJob?.status === 'failed' && (
          <div className="mt-4">
            <StatusBanner variant="error">{exportJob.error || 'Export failed'}</StatusBanner>
          </div>
        )}
      </div>
    </div>
  )
}
