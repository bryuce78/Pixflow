import { ArrowDown, ArrowUp, Eye, EyeOff, Image, Video, X } from 'lucide-react'
import { type BlendMode, useComposeStore } from '../../stores/composeStore'

const BLEND_OPTIONS: { value: BlendMode; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'screen', label: 'Screen' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'darken', label: 'Darken' },
  { value: 'lighten', label: 'Lighten' },
]

export function LayerPanel() {
  const layers = useComposeStore((s) => s.layers)
  const selectedLayerId = useComposeStore((s) => s.selectedLayerId)
  const selectLayer = useComposeStore((s) => s.selectLayer)
  const updateLayer = useComposeStore((s) => s.updateLayer)
  const moveLayerUp = useComposeStore((s) => s.moveLayerUp)
  const moveLayerDown = useComposeStore((s) => s.moveLayerDown)
  const removeLayer = useComposeStore((s) => s.removeLayer)

  return (
    <div className="space-y-2">
      {[...layers].reverse().map((layer, revIdx) => {
        const isSelected = layer.id === selectedLayerId
        const isImage = layer.mediaType === 'image'
        const idx = layers.length - 1 - revIdx

        return (
          <button
            key={layer.id}
            type="button"
            onClick={() => selectLayer(layer.id)}
            className={`w-full text-left rounded-lg border p-3 transition-all cursor-pointer ${
              isSelected
                ? 'border-brand-500 ring-2 ring-brand-500/30 bg-surface-50'
                : 'border-surface-200 bg-surface-0 hover:bg-surface-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-surface-100 flex items-center justify-center shrink-0 overflow-hidden">
                {isImage ? (
                  <img src={layer.mediaUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Video className="w-4 h-4 text-surface-400" />
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
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    updateLayer(layer.id, { visible: !layer.visible })
                  }}
                  className="p-1.5 rounded hover:bg-surface-200 transition text-surface-400"
                  title={layer.visible ? 'Hide' : 'Show'}
                >
                  {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    moveLayerUp(layer.id)
                  }}
                  disabled={idx === 0}
                  className="p-1.5 rounded hover:bg-surface-200 transition text-surface-400 disabled:opacity-30"
                  title="Move back"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    moveLayerDown(layer.id)
                  }}
                  disabled={idx === layers.length - 1}
                  className="p-1.5 rounded hover:bg-surface-200 transition text-surface-400 disabled:opacity-30"
                  title="Move forward"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeLayer(layer.id)
                  }}
                  className="p-1.5 rounded hover:bg-danger/10 transition text-surface-400 hover:text-danger"
                  title="Remove"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {isSelected && (
              <div className="mt-3 pt-3 border-t border-surface-200 grid grid-cols-2 gap-3 text-sm">
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

                {isImage && (
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
                )}

                {!isImage && (
                  <div className="space-y-1">
                    <span className="text-surface-500">Duration</span>
                    <div className="px-2 py-1.5 text-sm text-surface-400">
                      {layer.sourceDuration.toFixed(1)}s (source)
                    </div>
                  </div>
                )}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
