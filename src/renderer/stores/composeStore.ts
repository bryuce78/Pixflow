import { create } from 'zustand'
import { apiUrl, authFetch, unwrapApiData } from '../lib/api'
import { createOutputHistoryId, useOutputHistoryStore } from './outputHistoryStore'

export type BlendMode = 'normal' | 'screen' | 'multiply' | 'overlay' | 'darken' | 'lighten'
export type AspectRatio = '9:16' | '16:9' | '1:1' | '4:5'

export interface ComposeLayer {
  id: string
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

interface ComposeState {
  layers: ComposeLayer[]
  selectedLayerIds: string[]
  aspectRatio: AspectRatio
  compositionLength: number
  playbackTime: number
  isPlaying: boolean
  exportJob: ComposeExportJob | null

  addLayer: (file: File) => Promise<void>
  removeLayer: (id: string) => void
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
  clearAll: () => void
  totalDuration: () => number
  startExport: () => Promise<void>
  pollExportStatus: (jobId: string, historyId: string) => Promise<void>
}

function generateLayerId(): string {
  return `layer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
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

export const useComposeStore = create<ComposeState>()((set, get) => ({
  layers: [],
  selectedLayerIds: [],
  aspectRatio: '9:16',
  compositionLength: 30,
  playbackTime: 0,
  isPlaying: false,
  exportJob: null,

  addLayer: async (file) => {
    const isVideo = file.type.startsWith('video/')
    const blobUrl = URL.createObjectURL(file)
    let duration = 5
    let sourceDuration = Infinity

    if (isVideo) {
      sourceDuration = await probeVideoDuration(URL.createObjectURL(file))
      duration = sourceDuration
    }

    const layer: ComposeLayer = {
      id: generateLayerId(),
      name: file.name,
      mediaUrl: blobUrl,
      mediaType: isVideo ? 'video' : 'image',
      startTime: 0,
      duration,
      sourceDuration,
      blendMode: 'normal',
      opacity: 1,
      visible: true,
    }

    set((state) => ({
      layers: [...state.layers, layer],
      selectedLayerIds: [layer.id],
    }))
  },

  removeLayer: (id) =>
    set((state) => {
      const removed = state.layers.find((l) => l.id === id)
      if (removed) URL.revokeObjectURL(removed.mediaUrl)
      return {
        layers: state.layers.filter((l) => l.id !== id),
        selectedLayerIds: state.selectedLayerIds.filter((sid) => sid !== id),
      }
    }),

  reorderLayer: (id, newIndex) =>
    set((state) => {
      const idx = state.layers.findIndex((l) => l.id === id)
      if (idx === -1 || newIndex === idx) return state
      const clamped = Math.max(0, Math.min(state.layers.length - 1, newIndex))
      const next = [...state.layers]
      const [moved] = next.splice(idx, 1)
      next.splice(clamped, 0, moved)
      return { layers: next }
    }),

  updateLayer: (id, patch) =>
    set((state) => ({
      layers: state.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    })),

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

  sequenceLayers: (imageDuration, useSelectionOrder) =>
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
    }),

  setAspectRatio: (ratio) => set({ aspectRatio: ratio }),
  setCompositionLength: (length) => set({ compositionLength: length }),
  setPlaybackTime: (time) => set({ playbackTime: time }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),

  clearAll: () =>
    set((state) => {
      for (const layer of state.layers) URL.revokeObjectURL(layer.mediaUrl)
      return {
        layers: [],
        selectedLayerIds: [],
        compositionLength: 30,
        playbackTime: 0,
        isPlaying: false,
        exportJob: null,
      }
    }),

  totalDuration: () => get().compositionLength,

  startExport: async () => {
    const { layers, aspectRatio } = get()
    if (layers.length === 0) return

    const dims = ASPECT_DIMENSIONS[aspectRatio]
    const historyId = createOutputHistoryId('compose')

    useOutputHistoryStore.getState().upsert({
      id: historyId,
      category: 'compose',
      title: `Compose (${layers.length} layers)`,
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
        progress: { completed: 0, total: layers.length + 1, message: 'Uploading media...' },
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

    for (const layer of layers) {
      if (!layer.visible) continue

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

      set((state) => ({
        exportJob: state.exportJob
          ? {
              ...state.exportJob,
              progress: {
                ...state.exportJob.progress,
                completed: uploadedLayers.length,
                message: `Uploaded ${uploadedLayers.length}/${layers.filter((l) => l.visible).length}`,
              },
            }
          : null,
      }))
    }

    useOutputHistoryStore.getState().patch(historyId, { message: 'Starting export...' })

    const exportRes = await authFetch(apiUrl('/api/compose/export'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layers: uploadedLayers, width: dims.width, height: dims.height, fps: 30 }),
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
