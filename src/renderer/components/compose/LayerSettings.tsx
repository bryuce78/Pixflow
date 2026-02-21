import { Copy, Eye, EyeOff, Image, Scissors, Trash2, Video } from 'lucide-react'
import { type BlendMode, useComposeStore } from '../../stores/composeStore'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'

const BLEND_OPTIONS: { value: BlendMode; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'screen', label: 'Screen' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'darken', label: 'Darken' },
  { value: 'lighten', label: 'Lighten' },
]
const MIN_LAYER_DURATION = 0.1

export function LayerSettings() {
  const layers = useComposeStore((s) => s.layers)
  const selectedLayerIds = useComposeStore((s) => s.selectedLayerIds)
  const updateLayer = useComposeStore((s) => s.updateLayer)
  const removeLayer = useComposeStore((s) => s.removeLayer)
  const duplicateLayer = useComposeStore((s) => s.duplicateLayer)
  const splitLayerAt = useComposeStore((s) => s.splitLayerAt)
  const compositionLength = useComposeStore((s) => s.compositionLength)
  const playbackTime = useComposeStore((s) => s.playbackTime)
  const beginUndoBatch = useComposeStore((s) => s.beginUndoBatch)
  const endUndoBatch = useComposeStore((s) => s.endUndoBatch)

  const primaryId = selectedLayerIds.at(-1)
  const layer = primaryId ? layers.find((l) => l.id === primaryId) : null

  if (!layer) return <EmptyState title="No layer selected" subtitle="Click a layer in the timeline" />

  const isImage = layer.mediaType === 'image'
  const endTime = layer.startTime + layer.duration
  const sourceLimit =
    !isImage && Number.isFinite(layer.sourceDuration) ? layer.sourceDuration : Number.POSITIVE_INFINITY
  const maxEnd = Math.min(compositionLength, layer.startTime + sourceLimit)
  const canSplit =
    isImage && playbackTime > layer.startTime + MIN_LAYER_DURATION && playbackTime < endTime - MIN_LAYER_DURATION

  return (
    <div className="rounded-lg border border-surface-200 bg-surface-0 p-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded bg-surface-100 flex items-center justify-center shrink-0 overflow-hidden">
          {isImage ? (
            <img src={layer.mediaUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <Video className="w-5 h-5 text-surface-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{layer.name}</div>
          <div className="flex items-center gap-2 text-xs text-surface-400">
            {isImage ? <Image className="w-3 h-3" /> : <Video className="w-3 h-3" />}
            <span>{layer.duration.toFixed(1)}s</span>
            {layer.startTime > 0 && <span>@ {layer.startTime.toFixed(1)}s</span>}
          </div>
        </div>
        <button
          type="button"
          onClick={() => updateLayer(layer.id, { visible: !layer.visible })}
          className="p-1.5 rounded hover:bg-surface-200 transition text-surface-400"
          title={layer.visible ? 'Hide' : 'Show'}
        >
          {layer.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
      </div>

      <div className="space-y-3 text-sm">
        <label className="block space-y-1">
          <span className="text-surface-500">Blend Mode</span>
          <select
            value={layer.blendMode}
            onChange={(e) => updateLayer(layer.id, { blendMode: e.target.value as BlendMode })}
            className="w-full rounded-md border border-surface-200 bg-surface-0 px-2 py-1.5 text-sm"
          >
            {BLEND_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-surface-500">Opacity ({Math.round(layer.opacity * 100)}%)</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={layer.opacity}
            onPointerDown={beginUndoBatch}
            onPointerUp={endUndoBatch}
            onChange={(e) => updateLayer(layer.id, { opacity: Number(e.target.value) })}
            className="w-full"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-surface-500">Start (s)</span>
            <input
              type="number"
              min={0}
              step={0.1}
              value={layer.startTime}
              onChange={(e) => {
                const nextStart = Math.max(
                  0,
                  Math.min(Number(e.target.value), Math.max(0, compositionLength - layer.duration)),
                )
                updateLayer(layer.id, { startTime: nextStart })
              }}
              className="w-full rounded-md border border-surface-200 bg-surface-0 px-2 py-1.5 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-surface-500">End (s)</span>
            <input
              type="number"
              min={layer.startTime + MIN_LAYER_DURATION}
              max={maxEnd}
              step={0.1}
              value={endTime}
              onChange={(e) => {
                const rawEnd = Number(e.target.value)
                const clampedEnd = Math.max(layer.startTime + MIN_LAYER_DURATION, Math.min(rawEnd, maxEnd))
                updateLayer(layer.id, { duration: clampedEnd - layer.startTime })
              }}
              className="w-full rounded-md border border-surface-200 bg-surface-0 px-2 py-1.5 text-sm"
            />
          </label>
        </div>

        {!isImage && (
          <p className="text-xs text-surface-400">Video source length: {layer.sourceDuration.toFixed(1)}s</p>
        )}

        <div className="flex items-center gap-2 pt-2 border-t border-surface-200">
          <Button
            variant="ghost-muted"
            size="sm"
            onClick={() => duplicateLayer(layer.id)}
            icon={<Copy className="w-3 h-3" />}
          >
            Duplicate
          </Button>
          <Button
            variant="ghost-muted"
            size="sm"
            onClick={() => splitLayerAt(layer.id, playbackTime)}
            disabled={!canSplit}
            icon={<Scissors className="w-3 h-3" />}
          >
            Split
          </Button>
          <Button
            variant="ghost-danger"
            size="sm"
            onClick={() => removeLayer(layer.id)}
            icon={<Trash2 className="w-3 h-3" />}
            className="ml-auto"
          >
            Delete
          </Button>
        </div>
      </div>

      {selectedLayerIds.length > 1 && (
        <div className="mt-3 pt-3 border-t border-surface-200 text-xs text-surface-400">
          {selectedLayerIds.length} layers selected — showing settings for the last selected
        </div>
      )}
    </div>
  )
}
