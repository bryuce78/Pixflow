import { Download, ListOrdered, Pause, Play, Square, Trash2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import { assetUrl } from '../../lib/api'
import { type AspectRatio, useComposeStore } from '../../stores/composeStore'
import { StepHeader } from '../asset-monster/StepHeader'
import { Button } from '../ui/Button'
import { DropZone } from '../ui/DropZone'
import { EmptyState } from '../ui/EmptyState'
import { SegmentedTabs } from '../ui/navigation/SegmentedTabs'
import { StatusBanner } from '../ui/StatusBanner'
import { ComposeCanvas } from './ComposeCanvas'
import { ComposeTimeline } from './ComposeTimeline'
import { LayerSettings } from './LayerSettings'

const ACCEPT = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'video/mp4': ['.mp4'],
  'video/webm': ['.webm'],
  'video/quicktime': ['.mov'],
}

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
  const addLayer = useComposeStore((s) => s.addLayer)
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

  const [error, setError] = useState('')
  const [showSequence, setShowSequence] = useState(false)
  const [seqDuration, setSeqDuration] = useState(5)
  const [seqSelectionOrder, setSeqSelectionOrder] = useState(true)

  const handleDrop = useCallback(
    (files: File[]) => {
      for (const file of files) {
        void addLayer(file)
      }
    },
    [addLayer],
  )

  const handleExport = useCallback(async () => {
    setError('')
    try {
      await startExport()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    }
  }, [startExport])

  const duration = totalDuration()
  const isExporting = exportJob?.status === 'uploading' || exportJob?.status === 'exporting'

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div>
            <StepHeader stepNumber={1} title="Add Media" />
            <DropZone accept={ACCEPT} onDrop={handleDrop}>
              <p className="text-sm text-surface-400">Drop images or videos here, or click to browse</p>
            </DropZone>
          </div>

          <div className="space-y-3">
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

          {layers.length > 0 && (
            <div>
              <StepHeader stepNumber={2} title="Layer Settings" />
              <LayerSettings />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <StepHeader stepNumber={3} title="Preview" />
          {layers.length === 0 ? (
            <EmptyState title="No preview" subtitle="Add layers to see a live preview" />
          ) : (
            <>
              <ComposeCanvas />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-100 hover:bg-surface-200 transition"
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
                >
                  <Square className="w-4 h-4" />
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
            </>
          )}

          {exportJob?.status === 'completed' && exportJob.outputUrl && (
            <div className="mt-6">
              <StepHeader stepNumber={4} title="Output" />
              <div className="rounded-xl overflow-hidden bg-surface-900">
                {/* biome-ignore lint/a11y/useMediaCaption: user-generated composition has no captions */}
                <video src={assetUrl(exportJob.outputUrl)} controls className="w-full" />
              </div>
              <a
                href={assetUrl(exportJob.outputUrl)}
                download
                className="mt-3 inline-flex items-center gap-2 text-sm text-brand-400 hover:text-brand-300 transition"
              >
                <Download className="w-4 h-4" />
                Download
              </a>
            </div>
          )}
        </div>
      </div>

      {layers.length > 0 && <ComposeTimeline />}

      {layers.length > 0 && (
        <div className="flex items-center gap-2">
          {selectedLayerIds.length >= 2 && (
            <div className="relative">
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
          <Button onClick={handleExport} disabled={layers.length === 0 || isExporting} loading={isExporting}>
            {isExporting ? exportJob?.progress.message || 'Exporting...' : 'Generate'}
          </Button>
          <Button variant="ghost-danger" onClick={clearAll} disabled={isExporting}>
            <Trash2 className="w-4 h-4 mr-1" />
            Clear All
          </Button>
        </div>
      )}

      {error && (
        <StatusBanner variant="error" onDismiss={() => setError('')}>
          {error}
        </StatusBanner>
      )}
      {exportJob?.status === 'failed' && (
        <StatusBanner variant="error">{exportJob.error || 'Export failed'}</StatusBanner>
      )}
    </div>
  )
}
