import { useCallback, useRef, useState } from 'react'
import { useComposeStore } from '../../stores/composeStore'

const LAYER_COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308']

export function ComposeTimeline() {
  const layers = useComposeStore((s) => s.layers)
  const playbackTime = useComposeStore((s) => s.playbackTime)
  const setPlaybackTime = useComposeStore((s) => s.setPlaybackTime)
  const updateLayer = useComposeStore((s) => s.updateLayer)
  const totalDuration = useComposeStore((s) => s.totalDuration)
  const selectedLayerId = useComposeStore((s) => s.selectedLayerId)
  const selectLayer = useComposeStore((s) => s.selectLayer)

  const containerRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const dragStartXRef = useRef(0)
  const dragStartTimeRef = useRef(0)

  const duration = totalDuration()

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (dragging) return
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const time = (x / rect.width) * duration
      setPlaybackTime(Math.max(0, Math.min(duration, time)))
    },
    [duration, setPlaybackTime, dragging],
  )

  const handleDragStart = useCallback(
    (e: React.MouseEvent, layerId: string, startTime: number) => {
      e.stopPropagation()
      if (!containerRef.current || duration <= 0) return
      setDragging(layerId)
      dragStartXRef.current = e.clientX
      dragStartTimeRef.current = startTime

      const containerWidth = containerRef.current.clientWidth
      const pxToTimeFn = (px: number) => (px / containerWidth) * duration

      const handleMove = (moveEvent: MouseEvent) => {
        const dx = moveEvent.clientX - dragStartXRef.current
        const dt = pxToTimeFn(dx)
        updateLayer(layerId, { startTime: Math.max(0, dragStartTimeRef.current + dt) })
      }

      const handleUp = () => {
        setDragging(null)
        window.removeEventListener('mousemove', handleMove)
        window.removeEventListener('mouseup', handleUp)
      }

      window.addEventListener('mousemove', handleMove)
      window.addEventListener('mouseup', handleUp)
    },
    [updateLayer, duration],
  )

  if (duration <= 0) return null

  const playheadPercent = (playbackTime / duration) * 100

  return (
    <div className="space-y-1">
      <div className="text-xs text-surface-400 flex justify-between">
        <span>0s</span>
        <span>{duration.toFixed(1)}s</span>
      </div>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: timeline is mouse-driven, keyboard nav via layer panel */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: timeline container handles click-to-seek */}
      <div
        ref={containerRef}
        className="relative bg-surface-100 rounded-lg overflow-hidden cursor-pointer"
        style={{ height: `${Math.max(layers.length * 28 + 8, 40)}px` }}
        onClick={handleTimelineClick}
      >
        {layers.map((layer, idx) => {
          const leftPct = (layer.startTime / duration) * 100
          const widthPct = (layer.duration / duration) * 100
          const color = LAYER_COLORS[idx % LAYER_COLORS.length]
          const isSelected = layer.id === selectedLayerId

          return (
            <button
              key={layer.id}
              type="button"
              onMouseDown={(e) => handleDragStart(e, layer.id, layer.startTime)}
              onClick={(e) => {
                e.stopPropagation()
                selectLayer(layer.id)
              }}
              className={`absolute rounded-sm text-[10px] text-white font-medium truncate px-1 leading-6 select-none ${
                isSelected ? 'ring-2 ring-white/60' : ''
              } ${layer.visible ? '' : 'opacity-40'}`}
              style={{
                left: `${leftPct}%`,
                width: `${Math.max(widthPct, 1)}%`,
                top: `${idx * 28 + 4}px`,
                height: '24px',
                backgroundColor: color,
                cursor: dragging === layer.id ? 'grabbing' : 'grab',
              }}
              title={`${layer.name} (${layer.startTime.toFixed(1)}s - ${(layer.startTime + layer.duration).toFixed(1)}s)`}
            >
              {layer.name}
            </button>
          )
        })}

        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white/80 pointer-events-none"
          style={{ left: `${playheadPercent}%` }}
        />
      </div>
    </div>
  )
}
