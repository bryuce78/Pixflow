import { useCallback, useRef, useState } from 'react'
import { useComposeStore } from '../../stores/composeStore'

const LAYER_COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308']
const ROW_HEIGHT = 28
const ROW_GAP = 3
const THUMB_SIZE = 20
const RESIZE_HANDLE_WIDTH = 8
const MIN_LAYER_DURATION = 0.1
const SNAP_THRESHOLD_PX = 10

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function nearestSnapDelta(target: number, markers: number[], threshold: number): number {
  let best = 0
  let bestDistance = Number.POSITIVE_INFINITY

  for (const marker of markers) {
    const delta = marker - target
    const distance = Math.abs(delta)
    if (distance <= threshold && distance < bestDistance) {
      bestDistance = distance
      best = delta
    }
  }

  return best
}

export function ComposeTimeline() {
  const layers = useComposeStore((s) => s.layers)
  const playbackTime = useComposeStore((s) => s.playbackTime)
  const setPlaybackTime = useComposeStore((s) => s.setPlaybackTime)
  const updateLayer = useComposeStore((s) => s.updateLayer)
  const reorderLayer = useComposeStore((s) => s.reorderLayer)
  const selectedLayerIds = useComposeStore((s) => s.selectedLayerIds)
  const selectLayer = useComposeStore((s) => s.selectLayer)
  const compositionLength = useComposeStore((s) => s.compositionLength)
  const addLayerFromAsset = useComposeStore((s) => s.addLayerFromAsset)
  const beginUndoBatch = useComposeStore((s) => s.beginUndoBatch)
  const endUndoBatch = useComposeStore((s) => s.endUndoBatch)

  const containerRef = useRef<HTMLDivElement>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const duration = compositionLength

  const getSnapMarkers = useCallback(
    (excludeLayerId?: string) => {
      const markers = [0, duration, playbackTime]
      for (const layer of layers) {
        if (layer.id === excludeLayerId) continue
        markers.push(layer.startTime)
        markers.push(layer.startTime + layer.duration)
      }
      return markers
    },
    [duration, layers, playbackTime],
  )

  const getSnapThresholdSeconds = useCallback(
    (containerWidth: number) => {
      if (duration <= 0 || containerWidth <= 0) return 0
      return (SNAP_THRESHOLD_PX / containerWidth) * duration
    },
    [duration],
  )

  const timeFromClientX = useCallback(
    (clientX: number) => {
      if (!containerRef.current || duration <= 0) return 0
      const rect = containerRef.current.getBoundingClientRect()
      const x = clientX - rect.left
      return clamp((x / rect.width) * duration, 0, duration)
    },
    [duration],
  )

  const handleScrubStart = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (draggingId || duration <= 0) return
      e.preventDefault()
      const update = (clientX: number) => {
        if (!containerRef.current) return
        const rawTime = timeFromClientX(clientX)
        const threshold = getSnapThresholdSeconds(containerRef.current.clientWidth)
        const snapDelta = nearestSnapDelta(rawTime, getSnapMarkers(), threshold)
        setPlaybackTime(clamp(rawTime + snapDelta, 0, duration))
      }
      update(e.clientX)

      const handleMove = (moveEvent: MouseEvent) => {
        update(moveEvent.clientX)
      }

      const handleUp = () => {
        window.removeEventListener('mousemove', handleMove)
        window.removeEventListener('mouseup', handleUp)
      }

      window.addEventListener('mousemove', handleMove)
      window.addEventListener('mouseup', handleUp)
    },
    [draggingId, duration, getSnapMarkers, getSnapThresholdSeconds, setPlaybackTime, timeFromClientX],
  )

  const handleDragStart = useCallback(
    (e: React.MouseEvent, layerId: string, origStartTime: number, origDuration: number, origIndex: number) => {
      e.stopPropagation()
      if (!containerRef.current || duration <= 0) return

      setDraggingId(layerId)
      beginUndoBatch()
      const startX = e.clientX
      const startY = e.clientY
      const containerWidth = containerRef.current.clientWidth
      const snapThreshold = getSnapThresholdSeconds(containerWidth)
      const markers = getSnapMarkers(layerId)
      let lastReorderIndex = origIndex

      const handleMove = (moveEvent: MouseEvent) => {
        const dx = moveEvent.clientX - startX
        const dy = moveEvent.clientY - startY

        const maxStart = Math.max(0, duration - Math.min(origDuration, duration))
        const rawStartTime = clamp(origStartTime + (dx / containerWidth) * duration, 0, maxStart)
        const rawEndTime = rawStartTime + origDuration
        const snapByStart = nearestSnapDelta(rawStartTime, markers, snapThreshold)
        const snapByEnd = nearestSnapDelta(rawEndTime, markers, snapThreshold)
        const snapDelta = Math.abs(snapByStart) <= Math.abs(snapByEnd) ? snapByStart : snapByEnd
        const snappedStartTime = clamp(rawStartTime + snapDelta, 0, maxStart)

        updateLayer(layerId, { startTime: snappedStartTime })

        const rowStep = ROW_HEIGHT + ROW_GAP
        const newIndex = Math.max(0, Math.min(layers.length - 1, origIndex + Math.round(dy / rowStep)))
        if (newIndex !== lastReorderIndex) {
          reorderLayer(layerId, newIndex)
          lastReorderIndex = newIndex
        }
      }

      const handleUp = () => {
        endUndoBatch()
        setDraggingId(null)
        window.removeEventListener('mousemove', handleMove)
        window.removeEventListener('mouseup', handleUp)
      }

      window.addEventListener('mousemove', handleMove)
      window.addEventListener('mouseup', handleUp)
    },
    [
      updateLayer,
      reorderLayer,
      duration,
      layers.length,
      beginUndoBatch,
      endUndoBatch,
      getSnapMarkers,
      getSnapThresholdSeconds,
    ],
  )

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, layerId: string, side: 'start' | 'end') => {
      e.stopPropagation()
      e.preventDefault()
      if (!containerRef.current || duration <= 0) return

      const layer = layers.find((item) => item.id === layerId)
      if (!layer) return

      const sourceDurationLimit =
        layer.mediaType === 'video' && Number.isFinite(layer.sourceDuration)
          ? Math.max(MIN_LAYER_DURATION, layer.sourceDuration)
          : Number.POSITIVE_INFINITY

      const startX = e.clientX
      const containerWidth = containerRef.current.clientWidth
      const snapThreshold = getSnapThresholdSeconds(containerWidth)
      const markers = getSnapMarkers(layerId)
      const originalStart = clamp(layer.startTime, 0, duration - MIN_LAYER_DURATION)
      const originalEnd = clamp(layer.startTime + layer.duration, MIN_LAYER_DURATION, duration)
      const originalDuration = clamp(originalEnd - originalStart, MIN_LAYER_DURATION, duration)

      setDraggingId(layerId)
      beginUndoBatch()

      const handleMove = (moveEvent: MouseEvent) => {
        const dx = moveEvent.clientX - startX
        const deltaSeconds = (dx / containerWidth) * duration

        if (side === 'start') {
          const maxDuration = Math.min(sourceDurationLimit, originalEnd)
          const minStart = Math.max(0, originalEnd - maxDuration)
          const maxStart = Math.max(0, originalEnd - MIN_LAYER_DURATION)
          const rawStart = clamp(originalStart + deltaSeconds, minStart, maxStart)
          const startSnapDelta = nearestSnapDelta(rawStart, [...markers, originalEnd], snapThreshold)
          const nextStart = clamp(rawStart + startSnapDelta, minStart, maxStart)
          const nextDuration = clamp(originalEnd - nextStart, MIN_LAYER_DURATION, maxDuration)
          updateLayer(layerId, { startTime: nextStart, duration: nextDuration })
          return
        }

        const maxDurationByTimeline = Math.max(MIN_LAYER_DURATION, duration - originalStart)
        const maxDuration = Math.min(sourceDurationLimit, maxDurationByTimeline)
        const rawDuration = clamp(originalDuration + deltaSeconds, MIN_LAYER_DURATION, maxDuration)
        const rawEnd = originalStart + rawDuration
        const endSnapDelta = nearestSnapDelta(rawEnd, markers, snapThreshold)
        const snappedEnd = clamp(rawEnd + endSnapDelta, originalStart + MIN_LAYER_DURATION, originalStart + maxDuration)
        const nextDuration = clamp(snappedEnd - originalStart, MIN_LAYER_DURATION, maxDuration)
        updateLayer(layerId, { duration: nextDuration })
      }

      const handleUp = () => {
        endUndoBatch()
        setDraggingId(null)
        window.removeEventListener('mousemove', handleMove)
        window.removeEventListener('mouseup', handleUp)
      }

      window.addEventListener('mousemove', handleMove)
      window.addEventListener('mouseup', handleUp)
    },
    [beginUndoBatch, duration, endUndoBatch, getSnapMarkers, getSnapThresholdSeconds, layers, updateLayer],
  )

  const handleTimelineDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = e.dataTransfer.types.includes('application/x-compose-asset') ? 'copy' : 'none'
  }, [])

  const handleTimelineDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      const assetId = e.dataTransfer.getData('application/x-compose-asset')
      if (!assetId || !containerRef.current) return
      e.preventDefault()
      const rect = containerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      addLayerFromAsset(assetId, Math.max(0, (x / rect.width) * duration))
    },
    [duration, addLayerFromAsset],
  )

  if (duration <= 0) return null

  const playheadPct = (playbackTime / duration) * 100
  const tickInterval = duration <= 10 ? 1 : duration <= 30 ? 5 : duration <= 120 ? 10 : 30
  const ticks: number[] = []
  for (let t = 0; t <= duration; t += tickInterval) ticks.push(t)

  const timelineHeight = Math.max(layers.length * (ROW_HEIGHT + ROW_GAP) + ROW_GAP, 44)

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[2rem_1fr] gap-2">
        <div />
        {/* biome-ignore lint/a11y/noStaticElementInteractions: ruler supports mouse scrub */}
        <div
          className="text-xs text-surface-400 flex justify-between relative h-6 cursor-ew-resize select-none"
          onMouseDown={handleScrubStart}
        >
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute"
              style={{ left: `${(t / duration) * 100}%`, transform: 'translateX(-50%)', top: 0 }}
            >
              {t}s
            </span>
          ))}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-secondary-500 pointer-events-none z-10"
            style={{ left: `${playheadPct}%` }}
          />
        </div>

        <div className="relative" style={{ height: `${timelineHeight}px` }}>
          {layers.map((layer, idx) => (
            <div
              key={`${layer.id}_index`}
              className="absolute left-0 right-0 flex items-center justify-center text-[10px] text-surface-500 font-medium"
              style={{
                top: `${idx * (ROW_HEIGHT + ROW_GAP) + ROW_GAP}px`,
                height: `${ROW_HEIGHT}px`,
              }}
            >
              #{idx + 1}
            </div>
          ))}
        </div>

        {/* biome-ignore lint/a11y/noStaticElementInteractions: timeline supports mouse scrub + drop */}
        <div
          ref={containerRef}
          className="relative bg-surface-100 rounded-lg overflow-hidden cursor-pointer"
          style={{ height: `${timelineHeight}px` }}
          onMouseDown={handleScrubStart}
          onDragOver={handleTimelineDragOver}
          onDrop={handleTimelineDrop}
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
                onMouseDown={(e) => handleDragStart(e, layer.id, layer.startTime, layer.duration, idx)}
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
                  cursor: draggingId === layer.id ? 'grabbing' : 'move',
                }}
                title={`${layer.name} (${layer.startTime.toFixed(1)}s – ${(layer.startTime + layer.duration).toFixed(1)}s)`}
              >
                <span
                  className="absolute left-0 top-0 bottom-0 bg-black/25 hover:bg-black/40 cursor-ew-resize"
                  style={{ width: `${RESIZE_HANDLE_WIDTH}px` }}
                  onMouseDown={(e) => handleResizeStart(e, layer.id, 'start')}
                  aria-hidden="true"
                />
                <span
                  className="absolute right-0 top-0 bottom-0 bg-black/25 hover:bg-black/40 cursor-ew-resize"
                  style={{ width: `${RESIZE_HANDLE_WIDTH}px` }}
                  onMouseDown={(e) => handleResizeStart(e, layer.id, 'end')}
                  aria-hidden="true"
                />
                <div
                  className="shrink-0 rounded-sm overflow-hidden bg-black/20 flex items-center justify-center"
                  style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
                >
                  {layer.mediaType === 'image' ? (
                    <img src={layer.mediaUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <video
                      src={layer.mediaUrl}
                      className="w-full h-full object-cover"
                      muted
                      preload="auto"
                      playsInline
                    />
                  )}
                </div>
                <span className="text-[10px] text-white font-medium truncate leading-tight">{layer.name}</span>
              </button>
            )
          })}

          <div
            className="absolute top-0 bottom-0 w-0.5 bg-secondary-500 pointer-events-none z-20"
            style={{ left: `${playheadPct}%` }}
          />
        </div>
      </div>
    </div>
  )
}
