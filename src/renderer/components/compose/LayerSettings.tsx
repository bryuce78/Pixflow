import { Eye, EyeOff, Image, Video, X } from 'lucide-react'
import { type BlendMode, useComposeStore } from '../../stores/composeStore'
import { EmptyState } from '../ui/EmptyState'

const BLEND_OPTIONS: { value: BlendMode; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'screen', label: 'Screen' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'darken', label: 'Darken' },
  { value: 'lighten', label: 'Lighten' },
]

export function LayerSettings() {
  const layers = useComposeStore((s) => s.layers)
  const selectedLayerIds = useComposeStore((s) => s.selectedLayerIds)
  const updateLayer = useComposeStore((s) => s.updateLayer)
  const removeLayer = useComposeStore((s) => s.removeLayer)

  const primaryId = selectedLayerIds.at(-1)
  const layer = primaryId ? layers.find((l) => l.id === primaryId) : null

  if (!layer) return <EmptyState title="No layer selected" subtitle="Click a layer in the timeline" />

  const isImage = layer.mediaType === 'image'

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
        <button
          type="button"
          onClick={() => removeLayer(layer.id)}
          className="p-1.5 rounded hover:bg-danger/10 transition text-surface-400 hover:text-danger"
          title="Remove"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <label className="space-y-1">
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

        <label className="space-y-1">
          <span className="text-surface-500">Opacity ({Math.round(layer.opacity * 100)}%)</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={layer.opacity}
            onChange={(e) => updateLayer(layer.id, { opacity: Number(e.target.value) })}
            className="w-full"
          />
        </label>

        <label className="space-y-1">
          <span className="text-surface-500">Start (s)</span>
          <input
            type="number"
            min={0}
            step={0.1}
            value={layer.startTime}
            onChange={(e) => updateLayer(layer.id, { startTime: Math.max(0, Number(e.target.value)) })}
            className="w-full rounded-md border border-surface-200 bg-surface-0 px-2 py-1.5 text-sm"
          />
        </label>

        {isImage ? (
          <label className="space-y-1">
            <span className="text-surface-500">Duration (s)</span>
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={layer.duration}
              onChange={(e) => updateLayer(layer.id, { duration: Math.max(0.1, Number(e.target.value)) })}
              className="w-full rounded-md border border-surface-200 bg-surface-0 px-2 py-1.5 text-sm"
            />
          </label>
        ) : (
          <div className="space-y-1">
            <span className="text-surface-500">Duration</span>
            <div className="px-2 py-1.5 text-sm text-surface-400">{layer.sourceDuration.toFixed(1)}s (source)</div>
          </div>
        )}
      </div>

      {selectedLayerIds.length > 1 && (
        <div className="mt-3 pt-3 border-t border-surface-200 text-xs text-surface-400">
          {selectedLayerIds.length} layers selected — showing settings for the last selected
        </div>
      )}
    </div>
  )
}
