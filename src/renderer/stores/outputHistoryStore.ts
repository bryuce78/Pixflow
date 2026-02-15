import { create } from 'zustand'

export type OutputHistoryCategory =
  | 'avatars_talking'
  | 'avatars_reaction'
  | 'captions'
  | 'machine'
  | 'lifetime'
  | 'asset_monster'
  | 'prompt_factory'
  | 'img2img'
  | 'img2video'
  | 'startend'
export type OutputHistoryStatus = 'running' | 'completed' | 'failed'
export type OutputHistoryArtifactType = 'video' | 'image' | 'audio' | 'folder' | 'text'

export interface OutputHistoryArtifact {
  id: string
  label: string
  type: OutputHistoryArtifactType
  url?: string
}

export interface OutputHistoryEntry {
  id: string
  category: OutputHistoryCategory
  title: string
  status: OutputHistoryStatus
  startedAt: number
  updatedAt: number
  message?: string
  artifacts: OutputHistoryArtifact[]
}

interface OutputHistoryState {
  entries: OutputHistoryEntry[]
  upsert: (entry: OutputHistoryEntry) => void
  patch: (id: string, patch: Partial<Omit<OutputHistoryEntry, 'id' | 'category' | 'startedAt'>>) => void
  remove: (id: string) => void
  removeMany: (ids: string[]) => void
}

export function createOutputHistoryId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export const useOutputHistoryStore = create<OutputHistoryState>()((set) => ({
  entries: [],
  upsert: (entry) =>
    set((state) => {
      const index = state.entries.findIndex((item) => item.id === entry.id)
      if (index === -1) {
        return { entries: [entry, ...state.entries] }
      }
      const next = [...state.entries]
      next[index] = { ...next[index], ...entry, updatedAt: Date.now() }
      return { entries: next }
    }),
  patch: (id, patch) =>
    set((state) => ({
      entries: state.entries.map((item) => (item.id === id ? { ...item, ...patch, updatedAt: Date.now() } : item)),
    })),
  remove: (id) =>
    set((state) => ({
      entries: state.entries.filter((item) => item.id !== id),
    })),
  removeMany: (ids) =>
    set((state) => {
      if (ids.length === 0) return state
      const idSet = new Set(ids)
      return { entries: state.entries.filter((item) => !idSet.has(item.id)) }
    }),
}))
