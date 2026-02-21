import { create } from 'zustand'

export type OutputHistoryCategory =
  | 'avatars_talking'
  | 'avatars_reaction'
  | 'captions'
  | 'compose'
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
  internalJobId?: string
  category: OutputHistoryCategory
  title: string
  status: OutputHistoryStatus
  startedAt: number
  updatedAt: number
  message?: string
  artifacts: OutputHistoryArtifact[]
}

export function selectPreviousGenerations(
  entries: OutputHistoryEntry[],
  category: OutputHistoryCategory,
): OutputHistoryEntry[] {
  const sorted = entries
    .filter((entry) => entry.category === category)
    .sort((a, b) => b.startedAt - a.startedAt || b.updatedAt - a.updatedAt)

  if (sorted.length <= 1) return []
  return sorted.slice(1)
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
        const withInternalId = {
          ...entry,
          internalJobId: entry.internalJobId || createOutputHistoryId('job'),
        }
        return { entries: [withInternalId, ...state.entries] }
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
