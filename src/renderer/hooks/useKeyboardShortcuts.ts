import { useEffect } from 'react'
import { useAvatarStore } from '../stores/avatarStore'
import { useComposeStore } from '../stores/composeStore'
import { useGenerationStore } from '../stores/generationStore'
import { type TabId, useNavigationStore } from '../stores/navigationStore'

const TAB_ORDER: TabId[] = [
  'home',
  'prompts',
  'generate',
  'lifetime',
  'img2video',
  'avatars',
  'captions',
  'compose',
  'machine',
  'history',
  'competitors',
]

export function useKeyboardShortcuts() {
  const navigate = useNavigationStore((s) => s.navigate)
  const setPreviewImage = useGenerationStore((s) => s.setPreviewImage)
  const setFullSizeAvatarUrl = useAvatarStore((s) => s.setFullSizeAvatarUrl)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return

      if (e.metaKey || e.ctrlKey) {
        if (e.key >= '1' && e.key <= '9') {
          e.preventDefault()
          const idx = Number(e.key) - 1
          if (TAB_ORDER[idx]) navigate(TAB_ORDER[idx])
          return
        }
        if (e.key === '0') {
          e.preventDefault()
          const idx = 9
          if (TAB_ORDER[idx]) navigate(TAB_ORDER[idx])
          return
        }

        if (useNavigationStore.getState().activeTab === 'compose') {
          if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
            e.preventDefault()
            useComposeStore.getState().undo()
            return
          }
          if ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key === 'y') {
            e.preventDefault()
            useComposeStore.getState().redo()
            return
          }
        }
      }

      if (e.key === 'Escape') {
        setPreviewImage(null)
        setFullSizeAvatarUrl(null)
      }

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (useNavigationStore.getState().activeTab === 'compose') {
          e.preventDefault()
          useComposeStore.getState().stepFrame(e.key === 'ArrowLeft' ? -1 : 1)
        }
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [navigate, setPreviewImage, setFullSizeAvatarUrl])
}
