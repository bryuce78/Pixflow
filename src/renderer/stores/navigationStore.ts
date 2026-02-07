import { create } from 'zustand'
import { usePromptStore } from './promptStore'

export type TabId = 'prompts' | 'generate' | 'avatars' | 'machine' | 'history'

interface NavigationOptions {
  promptMode?: 'concept' | 'image'
  analyzeFile?: File
  analyzePreview?: string
}

interface NavigationState {
  activeTab: TabId
  navigate: (tab: TabId, options?: NavigationOptions) => void
}

export const useNavigationStore = create<NavigationState>()((set) => ({
  activeTab: 'prompts',

  navigate: (tab, options) => {
    set({ activeTab: tab })

    if (options?.promptMode) {
      usePromptStore.getState().setPromptMode(options.promptMode)
    }

    if (options?.analyzeFile && options?.analyzePreview) {
      usePromptStore.getState().setAnalyzeImage(options.analyzeFile, options.analyzePreview)
    }
  },
}))
