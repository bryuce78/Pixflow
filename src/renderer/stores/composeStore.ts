import { create } from 'zustand'
import { apiUrl, authFetch, unwrapApiData } from '../lib/api'
import { createOutputHistoryId, useOutputHistoryStore } from './outputHistoryStore'

export type BlendMode = 'normal' | 'screen' | 'multiply' | 'overlay' | 'darken' | 'lighten'
export type AspectRatio = '9:16' | '16:9' | '1:1' | '4:5'

export interface ComposeAsset {
  id: string
  name: string
  file: File
  mediaUrl: string
  mediaType: 'image' | 'video'
  sourceDuration: number
}

export interface ComposeLayer {
  id: string
  assetId: string
  name: string
  mediaUrl: string
  mediaType: 'image' | 'video'
  startTime: number
  duration: number
  sourceDuration: number
  blendMode: BlendMode
  opacity: number
  visible: boolean
}

export type ComposeExportStatus = 'idle' | 'uploading' | 'exporting' | 'completed' | 'failed'

export interface ComposeExportJob {
  jobId: string
  status: ComposeExportStatus
  progress: { completed: number; total: number; message: string }
  outputUrl: string
  error: string
}

export const ASPECT_DIMENSIONS: Record<AspectRatio, { width: number; height: number }> = {
  '9:16': { width: 1080, height: 1920 },
  '16:9': { width: 1920, height: 1080 },
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
}

const FRAME_DURATION = 1 / 30
const MAX_HISTORY = 50
const MAX_ASSETS = 50
const MAX_FILE_SIZE = 200 * 1024 * 1024
const MIN_LAYER_DURATION = 0.1

interface ComposeSnapshot {
  layers: ComposeLayer[]
  assets: ComposeAsset[]
  selectedLayerIds: string[]
  aspectRatio: AspectRatio
  compositionLength: number
}

interface ComposeState {
  layers: ComposeLayer[]
  assets: ComposeAsset[]
  selectedLayerIds: string[]
  aspectRatio: AspectRatio
  compositionLength: number
  playbackTime: number
  isPlaying: boolean
  exportJob: ComposeExportJob | null
  _history: ComposeSnapshot[]
  _historyIndex: number
  _undoBatching: boolean
  _epoch: number
  canUndo: boolean
  canRedo: boolean

  beginUndoBatch: () => void
  endUndoBatch: () => void
  addAsset: (file: File) => Promise<void>
  addLayerFromAsset: (assetId: string, startTime?: number) => void
  removeAsset: (id: string) => boolean
  addLayer: (file: File) => Promise<void>
  removeLayer: (id: string) => void
  duplicateLayer: (id: string) => boolean
  splitLayerAt: (id: string, time: number) => boolean
  reorderLayer: (id: string, newIndex: number) => void
  updateLayer: (
    id: string,
    patch: Partial<Pick<ComposeLayer, 'duration' | 'startTime' | 'blendMode' | 'opacity' | 'name' | 'visible'>>,
  ) => void
  selectLayer: (id: string | null, opts?: { toggle?: boolean; range?: boolean }) => void
  sequenceLayers: (imageDuration: number, useSelectionOrder: boolean) => void
  setAspectRatio: (ratio: AspectRatio) => void
  setCompositionLength: (length: number) => void
  setPlaybackTime: (time: number) => void
  setIsPlaying: (playing: boolean) => void
  stepFrame: (direction: 1 | -1) => void
  clearAll: () => void
  totalDuration: () => number
  pushSnapshot: () => void
  undo: () => void
  redo: () => void
  startExport: () => Promise<void>
  pollExportStatus: (jobId: string, historyId: string) => Promise<void>
}

function generateLayerId(): string {
  return `layer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function generateAssetId(): string {
  return `asset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function probeVideoDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      resolve(Number.isFinite(video.duration) ? video.duration : 5)
      URL.revokeObjectURL(url)
    }
    video.onerror = () => {
      resolve(5)
      URL.revokeObjectURL(url)
    }
    video.src = url
  })
}

function takeSnapshot(state: ComposeState): ComposeSnapshot {
  return {
    layers: state.layers.map((l) => ({ ...l })),
    assets: state.assets.map((a) => ({ ...a })),
    selectedLayerIds: [...state.selectedLayerIds],
    aspectRatio: state.aspectRatio,
    compositionLength: state.compositionLength,
  }
}

export const useComposeStore = create<ComposeState>()((set, get) => ({
  layers: [],
  assets: [],
  selectedLayerIds: [],
  aspectRatio: '9:16',
  compositionLength: 30,
  playbackTime: 0,
  isPlaying: false,
  exportJob: null,
  _history: [],
  _historyIndex: -1,
  _undoBatching: false,
  _epoch: 0,
  canUndo: false,
  canRedo: false,

  beginUndoBatch: () => {
    if (get()._undoBatching) return
    if (get()._history.length === 0) get().pushSnapshot()
    set({ _undoBatching: true })
  },

  endUndoBatch: () => {
    if (!get()._undoBatching) return
    set({ _undoBatching: false })
    get().pushSnapshot()
  },

  pushSnapshot: () =>
    set((state) => {
      const snap = takeSnapshot(state)
      const history = state._history.slice(0, state._historyIndex + 1)
      history.push(snap)
      if (history.length > MAX_HISTORY) history.shift()
      const idx = history.length - 1
      return { _history: history, _historyIndex: idx, canUndo: idx > 0, canRedo: false }
    }),

  undo: () =>
    set((state) => {
      if (state._historyIndex <= 0) return state
      const idx = state._historyIndex - 1
      const snap = state._history[idx]
      return { ...snap, _historyIndex: idx, canUndo: idx > 0, canRedo: true }
    }),

  redo: () =>
    set((state) => {
      if (state._historyIndex >= state._history.length - 1) return state
      const idx = state._historyIndex + 1
      const snap = state._history[idx]
      return { ...snap, _historyIndex: idx, canUndo: true, canRedo: idx < state._history.length - 1 }
    }),

  addAsset: async (file) => {
    if (file.size > MAX_FILE_SIZE || get().assets.length >= MAX_ASSETS) return
    if (get()._history.length === 0) get().pushSnapshot()
    const epoch = get()._epoch
    const isVideo = file.type.startsWith('video/')
    const blobUrl = URL.createObjectURL(file)
    let sourceDuration = Infinity

    if (isVideo) {
      sourceDuration = await probeVideoDuration(URL.createObjectURL(file))
    }

    if (get()._epoch !== epoch) {
      URL.revokeObjectURL(blobUrl)
      return
    }

    const asset: ComposeAsset = {
      id: generateAssetId(),
      name: file.name,
      file,
      mediaUrl: blobUrl,
      mediaType: isVideo ? 'video' : 'image',
      sourceDuration,
    }

    set((state) => ({ assets: [...state.assets, asset] }))
    get().pushSnapshot()
  },

  addLayerFromAsset: (assetId, startTime) => {
    const { assets, playbackTime } = get()
    const asset = assets.find((a) => a.id === assetId)
    if (!asset) return

    if (get()._history.length === 0) get().pushSnapshot()
    const layer: ComposeLayer = {
      id: generateLayerId(),
      assetId,
      name: asset.name,
      mediaUrl: asset.mediaUrl,
      mediaType: asset.mediaType,
      startTime: startTime ?? playbackTime,
      duration: asset.mediaType === 'video' ? asset.sourceDuration : 5,
      sourceDuration: asset.sourceDuration,
      blendMode: 'normal',
      opacity: 1,
      visible: true,
    }

    set((state) => ({
      layers: [...state.layers, layer],
      selectedLayerIds: [layer.id],
    }))
    get().pushSnapshot()
  },

  removeAsset: (id) => {
    const { layers, assets } = get()
    if (layers.some((l) => l.assetId === id)) return false
    const asset = assets.find((a) => a.id === id)
    if (!asset) return false
    URL.revokeObjectURL(asset.mediaUrl)
    set((state) => ({
      assets: state.assets.filter((a) => a.id !== id),
      _history: [],
      _historyIndex: -1,
      canUndo: false,
      canRedo: false,
    }))
    return true
  },

  addLayer: async (file) => {
    if (file.size > MAX_FILE_SIZE || get().assets.length >= MAX_ASSETS) return
    const epoch = get()._epoch
    const isVideo = file.type.startsWith('video/')
    const blobUrl = URL.createObjectURL(file)
    let sourceDuration = Infinity

    if (isVideo) {
      sourceDuration = await probeVideoDuration(URL.createObjectURL(file))
    }

    if (get()._epoch !== epoch) {
      URL.revokeObjectURL(blobUrl)
      return
    }

    const assetId = generateAssetId()
    const asset: ComposeAsset = {
      id: assetId,
      name: file.name,
      file,
      mediaUrl: blobUrl,
      mediaType: isVideo ? 'video' : 'image',
      sourceDuration,
    }

    if (get()._history.length === 0) get().pushSnapshot()
    set((state) => ({ assets: [...state.assets, asset] }))

    const layer: ComposeLayer = {
      id: generateLayerId(),
      assetId,
      name: file.name,
      mediaUrl: blobUrl,
      mediaType: isVideo ? 'video' : 'image',
      startTime: 0,
      duration: isVideo ? sourceDuration : 5,
      sourceDuration,
      blendMode: 'normal',
      opacity: 1,
      visible: true,
    }

    set((state) => ({
      layers: [...state.layers, layer],
      selectedLayerIds: [layer.id],
    }))
    get().pushSnapshot()
  },

  removeLayer: (id) => {
    if (get()._history.length === 0) get().pushSnapshot()
    set((state) => ({
      layers: state.layers.filter((l) => l.id !== id),
      selectedLayerIds: state.selectedLayerIds.filter((sid) => sid !== id),
    }))
    get().pushSnapshot()
  },

  duplicateLayer: (id) => {
    const state = get()
    const source = state.layers.find((layer) => layer.id === id)
    if (!source) return false

    if (state._history.length === 0) get().pushSnapshot()

    const maxDuration = Math.max(MIN_LAYER_DURATION, state.compositionLength)
    const duration = Math.min(source.duration, maxDuration)
    const proposedStart = source.startTime + 0.1
    const maxStart = Math.max(0, state.compositionLength - duration)
    const startTime = Math.max(0, Math.min(proposedStart, maxStart))

    const copy: ComposeLayer = {
      ...source,
      id: generateLayerId(),
      name: `${source.name} copy`,
      startTime,
      duration,
    }

    set((prev) => ({
      layers: [...prev.layers, copy],
      selectedLayerIds: [copy.id],
    }))
    get().pushSnapshot()
    return true
  },

  splitLayerAt: (id, time) => {
    const state = get()
    const index = state.layers.findIndex((layer) => layer.id === id)
    if (index === -1) return false

    const source = state.layers[index]
    if (source.mediaType !== 'image') return false

    const start = source.startTime
    const end = source.startTime + source.duration
    if (time <= start + MIN_LAYER_DURATION || time >= end - MIN_LAYER_DURATION) return false

    if (state._history.length === 0) get().pushSnapshot()

    const firstDuration = time - start
    const secondDuration = end - time

    const firstLayer: ComposeLayer = {
      ...source,
      duration: firstDuration,
    }
    const secondLayer: ComposeLayer = {
      ...source,
      id: generateLayerId(),
      name: `${source.name} part 2`,
      startTime: time,
      duration: secondDuration,
    }

    set((prev) => {
      const nextLayers = [...prev.layers]
      nextLayers[index] = firstLayer
      nextLayers.splice(index + 1, 0, secondLayer)
      return {
        layers: nextLayers,
        selectedLayerIds: [secondLayer.id],
      }
    })
    get().pushSnapshot()
    return true
  },

  reorderLayer: (id, newIndex) => {
    if (!get()._undoBatching && get()._history.length === 0) get().pushSnapshot()
    set((state) => {
      const idx = state.layers.findIndex((l) => l.id === id)
      if (idx === -1 || newIndex === idx) return state
      const clamped = Math.max(0, Math.min(state.layers.length - 1, newIndex))
      const next = [...state.layers]
      const [moved] = next.splice(idx, 1)
      next.splice(clamped, 0, moved)
      return { layers: next }
    })
    if (!get()._undoBatching) get().pushSnapshot()
  },

  updateLayer: (id, patch) => {
    if (!get()._undoBatching && get()._history.length === 0) get().pushSnapshot()
    set((state) => ({
      layers: state.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }))
    if (!get()._undoBatching) get().pushSnapshot()
  },

  selectLayer: (id, opts) =>
    set((state) => {
      if (!id) return { selectedLayerIds: [] }

      if (opts?.toggle) {
        return {
          selectedLayerIds: state.selectedLayerIds.includes(id)
            ? state.selectedLayerIds.filter((sid) => sid !== id)
            : [...state.selectedLayerIds, id],
        }
      }

      if (opts?.range && state.selectedLayerIds.length > 0) {
        const anchor = state.selectedLayerIds.at(-1)!
        const anchorIdx = state.layers.findIndex((l) => l.id === anchor)
        const targetIdx = state.layers.findIndex((l) => l.id === id)
        if (anchorIdx === -1 || targetIdx === -1) return { selectedLayerIds: [id] }
        const [lo, hi] = anchorIdx < targetIdx ? [anchorIdx, targetIdx] : [targetIdx, anchorIdx]
        const rangeIds = state.layers.slice(lo, hi + 1).map((l) => l.id)
        return { selectedLayerIds: [...new Set([...state.selectedLayerIds, ...rangeIds])] }
      }

      return { selectedLayerIds: [id] }
    }),

  sequenceLayers: (imageDuration, useSelectionOrder) => {
    if (get()._history.length === 0) get().pushSnapshot()
    set((state) => {
      if (state.selectedLayerIds.length < 2) return state
      const orderedIds = useSelectionOrder
        ? state.selectedLayerIds
        : state.layers.filter((l) => state.selectedLayerIds.includes(l.id)).map((l) => l.id)

      let cursor = 0
      const updates = new Map<string, { startTime: number; duration?: number }>()
      for (const id of orderedIds) {
        const layer = state.layers.find((l) => l.id === id)
        if (!layer) continue
        const dur = layer.mediaType === 'video' ? layer.sourceDuration : imageDuration
        updates.set(id, { startTime: cursor, ...(layer.mediaType === 'image' ? { duration: dur } : {}) })
        cursor += dur
      }

      return {
        layers: state.layers.map((l) => {
          const patch = updates.get(l.id)
          return patch ? { ...l, ...patch } : l
        }),
      }
    })
    get().pushSnapshot()
  },

  setAspectRatio: (ratio) => {
    if (get()._history.length === 0) get().pushSnapshot()
    set({ aspectRatio: ratio })
    get().pushSnapshot()
  },
  setCompositionLength: (length) => {
    if (get()._history.length === 0) get().pushSnapshot()
    set({ compositionLength: length })
    get().pushSnapshot()
  },
  setPlaybackTime: (time) => set({ playbackTime: time }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),

  stepFrame: (direction) => {
    const { playbackTime, compositionLength, isPlaying } = get()
    if (isPlaying) set({ isPlaying: false })
    const next = Math.round((playbackTime + direction * FRAME_DURATION) * 30) / 30
    set({ playbackTime: Math.max(0, Math.min(compositionLength, next)) })
  },

  clearAll: () =>
    set((state) => {
      for (const asset of state.assets) URL.revokeObjectURL(asset.mediaUrl)
      return {
        layers: [],
        assets: [],
        selectedLayerIds: [],
        compositionLength: 30,
        playbackTime: 0,
        isPlaying: false,
        exportJob: null,
        _history: [],
        _historyIndex: -1,
        _undoBatching: false,
        _epoch: state._epoch + 1,
        canUndo: false,
        canRedo: false,
      }
    }),

  totalDuration: () => get().compositionLength,

  startExport: async () => {
    const { layers, aspectRatio, compositionLength } = get()
    const visibleLayers = layers.filter((layer) => layer.visible)
    if (visibleLayers.length === 0) {
      throw new Error('Select at least one visible layer before exporting')
    }

    const dims = ASPECT_DIMENSIONS[aspectRatio]
    const historyId = createOutputHistoryId('compose')

    useOutputHistoryStore.getState().upsert({
      id: historyId,
      category: 'compose',
      title: `Compose (${visibleLayers.length} layers)`,
      status: 'running',
      startedAt: Date.now(),
      updatedAt: Date.now(),
      message: 'Uploading media...',
      artifacts: [],
    })

    set({
      exportJob: {
        jobId: '',
        status: 'uploading',
        progress: { completed: 0, total: visibleLayers.length + 1, message: 'Uploading media...' },
        outputUrl: '',
        error: '',
      },
    })

    const uploadedLayers: Array<{
      mediaUrl: string
      mediaType: string
      startTime: number
      duration: number
      blendMode: string
      opacity: number
    }> = []

    try {
      for (const layer of visibleLayers) {
        const blob = await fetch(layer.mediaUrl).then((r) => r.blob())
        const form = new FormData()
        form.append('file', blob, layer.name)

        const uploadRes = await authFetch(apiUrl('/api/compose/upload'), { method: 'POST', body: form })
        const uploadData = unwrapApiData<{ fileUrl: string }>(await uploadRes.json())

        uploadedLayers.push({
          mediaUrl: uploadData.fileUrl,
          mediaType: layer.mediaType,
          startTime: layer.startTime,
          duration: layer.duration,
          blendMode: layer.blendMode,
          opacity: layer.opacity,
        })

        const uploadMessage = `Uploaded ${uploadedLayers.length}/${visibleLayers.length}`
        set((state) => ({
          exportJob: state.exportJob
            ? {
                ...state.exportJob,
                progress: {
                  ...state.exportJob.progress,
                  completed: uploadedLayers.length,
                  message: uploadMessage,
                },
              }
            : null,
        }))
        useOutputHistoryStore.getState().patch(historyId, { message: uploadMessage })
      }

      useOutputHistoryStore.getState().patch(historyId, { message: 'Starting export...' })

      const exportRes = await authFetch(apiUrl('/api/compose/export'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layers: uploadedLayers,
          width: dims.width,
          height: dims.height,
          fps: 30,
          compositionLength,
        }),
      })
      const exportData = unwrapApiData<{ jobId: string }>(await exportRes.json())

      set({
        exportJob: {
          jobId: exportData.jobId,
          status: 'exporting',
          progress: { completed: 0, total: 1, message: 'Composing video...' },
          outputUrl: '',
          error: '',
        },
      })

      get().pollExportStatus(exportData.jobId, historyId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export failed'
      set({
        exportJob: {
          jobId: '',
          status: 'failed',
          progress: {
            completed: uploadedLayers.length,
            total: visibleLayers.length + 1,
            message,
          },
          outputUrl: '',
          error: message,
        },
      })
      useOutputHistoryStore.getState().patch(historyId, {
        status: 'failed',
        message,
      })
      throw error
    }
  },

  pollExportStatus: async (jobId, historyId) => {
    const poll = async () => {
      const res = await authFetch(apiUrl(`/api/compose/export-status/${jobId}`))
      const data = unwrapApiData<{
        status: string
        progress: { completed: number; total: number; message: string }
        outputUrl: string
        error: string
      }>(await res.json())

      if (data.status === 'completed') {
        set({
          exportJob: {
            jobId,
            status: 'completed',
            progress: data.progress,
            outputUrl: data.outputUrl,
            error: '',
          },
        })
        useOutputHistoryStore.getState().patch(historyId, {
          status: 'completed',
          message: 'Export complete',
          artifacts: [{ id: `${jobId}_video`, label: 'Composed Video', type: 'video', url: data.outputUrl }],
        })
        return
      }

      if (data.status === 'failed') {
        set({
          exportJob: {
            jobId,
            status: 'failed',
            progress: data.progress,
            outputUrl: '',
            error: data.error,
          },
        })
        useOutputHistoryStore.getState().patch(historyId, {
          status: 'failed',
          message: data.error || 'Export failed',
        })
        return
      }

      set((state) => ({
        exportJob: state.exportJob ? { ...state.exportJob, progress: data.progress } : null,
      }))

      setTimeout(() => void poll(), 1800)
    }

    void poll()
  },
}))
