import { create } from 'zustand'

interface ShortcutHelpState {
  open: boolean
  toggle: () => void
  close: () => void
}

export const useShortcutHelpStore = create<ShortcutHelpState>()((set) => ({
  open: false,
  toggle: () => set((s) => ({ open: !s.open })),
  close: () => set({ open: false }),
}))
