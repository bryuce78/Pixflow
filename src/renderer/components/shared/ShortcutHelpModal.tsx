import { useEffect } from 'react'
import type { TabId } from '../../stores/navigationStore'
import { useShortcutHelpStore } from '../../stores/shortcutHelpStore'
import { brandedPlainText } from '../ui/BrandedName'
import { Modal } from '../ui/Modal'

const TAB_ORDER: TabId[] = [
  'home',
  'prompts',
  'generate',
  'img2video',
  'avatars',
  'captions',
  'machine',
  'lifetime',
  'compose',
]

const isMac = /mac/i.test(navigator.userAgent) && !/windows|linux/i.test(navigator.userAgent)
const MOD = isMac ? 'Cmd' : 'Ctrl'

const COMPOSE_SHORTCUTS = [
  { label: 'Undo (Compose)', key: `${MOD} Z` },
  { label: 'Redo (Compose)', key: `${MOD} Shift Z` },
  { label: 'Step frame back (Compose)', key: 'Left Arrow' },
  { label: 'Step frame forward (Compose)', key: 'Right Arrow' },
]

const GENERAL_SHORTCUTS = [
  { label: 'Close preview/modal', key: 'Esc' },
  { label: 'Show / hide this overlay', key: '?' },
]

export function ShortcutHelpModal() {
  const { open, toggle, close } = useShortcutHelpStore()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return
      if (e.key === '?') toggle()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [toggle])

  return (
    <Modal open={open} onClose={close} title="Keyboard Shortcuts">
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-surface-400 mb-2">Navigation</p>
          <div className="space-y-1">
            {TAB_ORDER.map((tabId, i) => (
              <div key={tabId} className="flex items-center justify-between">
                <span className="text-sm text-surface-600">{brandedPlainText(tabId)}</span>
                <kbd className="inline-flex items-center gap-0.5 rounded border border-surface-200 bg-surface-100 px-1.5 py-0.5 text-xs font-mono text-surface-500">
                  {MOD} {i + 1}
                </kbd>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-surface-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-surface-400 mb-2">General</p>
          <div className="space-y-1">
            {GENERAL_SHORTCUTS.map((shortcut) => (
              <div key={shortcut.label} className="flex items-center justify-between">
                <span className="text-sm text-surface-600">{shortcut.label}</span>
                <kbd className="inline-flex items-center rounded border border-surface-200 bg-surface-100 px-1.5 py-0.5 text-xs font-mono text-surface-500">
                  {shortcut.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-surface-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-surface-400 mb-2">Compose</p>
          <div className="space-y-1">
            {COMPOSE_SHORTCUTS.map((shortcut) => (
              <div key={shortcut.label} className="flex items-center justify-between">
                <span className="text-sm text-surface-600">{shortcut.label}</span>
                <kbd className="inline-flex items-center rounded border border-surface-200 bg-surface-100 px-1.5 py-0.5 text-xs font-mono text-surface-500">
                  {shortcut.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
