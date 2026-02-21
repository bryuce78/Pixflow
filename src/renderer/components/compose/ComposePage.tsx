import { Download, Pause, Play, Square, Trash2 } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
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
import { LayerPanel } from './LayerPanel'

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
  const addLayer = useComposeStore((s) => s.addLayer)
  const clearAll = useComposeStore((s) => s.clearAll)
  const exportJob = useComposeStore((s) => s.exportJob)
  const startExport = useComposeStore((s) => s.startExport)
  const playbackTime = useComposeStore((s) => s.playbackTime)
  const setPlaybackTime = useComposeStore((s) => s.setPlaybackTime)
  const isPlaying = useComposeStore((s) => s.isPlaying)
  const setIsPlaying = useComposeStore((s) => s.setIsPlaying)
  const totalDuration = useComposeStore((s) => s.totalDuration)

  const [error, setError] = useState('')
  const scrubberRef = useRef<HTMLInputElement>(null)

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
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div className="space-y-6">
        <div>
          <StepHeader stepNumber={1} title="Add Media" />
          <DropZone accept={ACCEPT} onDrop={handleDrop}>
            <p className="text-sm text-surface-400">Drop images or videos here, or click to browse</p>
          </DropZone>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-surface-500">Aspect Ratio</span>
            <SegmentedTabs
              value={aspectRatio}
              items={ASPECT_ITEMS}
              onChange={setAspectRatio}
              ariaLabel="Aspect ratio"
              size="sm"
            />
          </div>
        </div>

        <div>
          <StepHeader
            stepNumber={2}
            title="Layers"
            subtitle={layers.length > 0 ? `${layers.length} layers` : undefined}
          />
          {layers.length === 0 ? (
            <EmptyState title="No layers" subtitle="Add images or videos above to get started" />
          ) : (
            <>
              <LayerPanel />
              <div className="mt-4 flex gap-2">
                <Button onClick={handleExport} disabled={layers.length === 0 || isExporting} loading={isExporting}>
                  {isExporting ? exportJob?.progress.message || 'Exporting...' : 'Generate'}
                </Button>
                <Button variant="ghost-danger" onClick={clearAll} disabled={isExporting}>
                  <Trash2 className="w-4 h-4 mr-1" />
                  Clear All
                </Button>
              </div>
            </>
          )}
        </div>

        {error && (
          <StatusBanner variant="error" onDismiss={() => setError('')}>
            {error}
          </StatusBanner>
        )}
        {exportJob?.status === 'failed' && (
          <StatusBanner variant="error">{exportJob.error || 'Export failed'}</StatusBanner>
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
                ref={scrubberRef}
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
            <ComposeTimeline />
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
  )
}
