import { Video } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useComposeStore } from '../../stores/composeStore'

const LAYER_COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308']
const ROW_HEIGHT = 56
const ROW_GAP = 4
const THUMB_SIZE = 40

export function ComposeTimeline() {
  const layers = useComposeStore((s) => s.layers)
  const playbackTime = useComposeStore((s) => s.playbackTime)
  const setPlaybackTime = useComposeStore((s) => s.setPlaybackTime)
  const updateLayer = useComposeStore((s) => s.updateLayer)
  const reorderLayer = useComposeStore((s) => s.reorderLayer)
  const selectedLayerIds = useComposeStore((s) => s.selectedLayerIds)
  const selectLayer = useComposeStore((s) => s.selectLayer)
  const compositionLength = useComposeStore((s) => s.compositionLength)

  const containerRef = useRef<HTMLDivElement>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const duration = compositionLength

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (draggingId) return
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      setPlaybackTime(Math.max(0, Math.min(duration, (x / rect.width) * duration)))
    },
    [duration, setPlaybackTime, draggingId],
  )

  const handleDragStart = useCallback(
    (e: React.MouseEvent, layerId: string, origStartTime: number, origIndex: number) => {
      e.stopPropagation()
      if (!containerRef.current || duration <= 0) return

      setDraggingId(layerId)
      const startX = e.clientX
      const startY = e.clientY
      const containerWidth = containerRef.current.clientWidth
      let lastReorderIndex = origIndex

      const handleMove = (moveEvent: MouseEvent) => {
        const dx = moveEvent.clientX - startX
        const dy = moveEvent.clientY - startY

        const newStartTime = Math.max(0, origStartTime + (dx / containerWidth) * duration)
        updateLayer(layerId, { startTime: newStartTime })

        const rowStep = ROW_HEIGHT + ROW_GAP
        const newIndex = Math.max(0, Math.min(layers.length - 1, origIndex + Math.round(dy / rowStep)))
        if (newIndex !== lastReorderIndex) {
          reorderLayer(layerId, newIndex)
          lastReorderIndex = newIndex
        }
      }

      const handleUp = () => {
        setDraggingId(null)
        window.removeEventListener('mousemove', handleMove)
        window.removeEventListener('mouseup', handleUp)
      }

      window.addEventListener('mousemove', handleMove)
      window.addEventListener('mouseup', handleUp)
    },
    [updateLayer, reorderLayer, duration, layers.length],
  )

  if (duration <= 0) return null

  const playheadPct = (playbackTime / duration) * 100
  const tickInterval = duration <= 10 ? 1 : duration <= 30 ? 5 : duration <= 120 ? 10 : 30
  const ticks: number[] = []
  for (let t = 0; t <= duration; t += tickInterval) ticks.push(t)

  return (
    <div className="space-y-1">
      <div className="text-xs text-surface-400 flex justify-between relative h-4">
        {ticks.map((t) => (
          <span
            key={t}
            className="absolute"
            style={{ left: `${(t / duration) * 100}%`, transform: 'translateX(-50%)' }}
          >
            {t}s
          </span>
        ))}
      </div>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: timeline is mouse-driven, keyboard nav via layer settings */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: timeline container handles click-to-seek */}
      <div
        ref={containerRef}
        className="relative bg-surface-100 rounded-lg overflow-hidden cursor-pointer"
        style={{ height: `${Math.max(layers.length * (ROW_HEIGHT + ROW_GAP) + ROW_GAP, 64)}px` }}
        onClick={handleTimelineClick}
      >
        {layers.map((layer, idx) => {
          const leftPct = (layer.startTime / duration) * 100
          const widthPct = (layer.duration / duration) * 100
          const color = LAYER_COLORS[idx % LAYER_COLORS.length]
          const isSelected = selectedLayerIds.includes(layer.id)
          const isPrimary = selectedLayerIds.at(-1) === layer.id

          return (
            <button
              key={layer.id}
              type="button"
              onMouseDown={(e) => handleDragStart(e, layer.id, layer.startTime, idx)}
              onClick={(e) => {
                e.stopPropagation()
                if (e.metaKey || e.ctrlKey) selectLayer(layer.id, { toggle: true })
                else if (e.shiftKey) selectLayer(layer.id, { range: true })
                else selectLayer(layer.id)
              }}
              className={`absolute rounded flex items-center gap-2 px-1.5 select-none overflow-hidden ${
                isPrimary && isSelected ? 'ring-2 ring-brand-500' : isSelected ? 'ring-2 ring-white/60' : ''
              } ${layer.visible ? '' : 'opacity-40'}`}
              style={{
                left: `${leftPct}%`,
                width: `${Math.max(widthPct, 2)}%`,
                top: `${idx * (ROW_HEIGHT + ROW_GAP) + ROW_GAP}px`,
                height: `${ROW_HEIGHT}px`,
                backgroundColor: color,
                cursor: draggingId === layer.id ? 'grabbing' : 'grab',
              }}
              title={`${layer.name} (${layer.startTime.toFixed(1)}s – ${(layer.startTime + layer.duration).toFixed(1)}s)`}
            >
              <div
                className="shrink-0 rounded-sm overflow-hidden bg-black/20 flex items-center justify-center"
                style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
              >
                {layer.mediaType === 'image' ? (
                  <img src={layer.mediaUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Video className="w-4 h-4 text-white/70" />
                )}
              </div>
              <span className="text-[11px] text-white font-medium truncate leading-tight">{layer.name}</span>
            </button>
          )
        })}

        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white/80 pointer-events-none z-10"
          style={{ left: `${playheadPct}%` }}
        />
      </div>
    </div>
  )
}
