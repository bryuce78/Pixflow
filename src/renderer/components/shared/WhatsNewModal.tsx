import { Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'

const CURRENT_VERSION = '2026.02'
const STORAGE_KEY = 'pixflow_whats_new_seen'

const CHANGELOG: { version: string; date: string; items: string[] }[] = [
  {
    version: '2026.02',
    date: 'Feb 2026',
    items: [
      'Keyboard shortcuts overlay — press ? anytime to see all shortcuts',
      'Styled tooltips on collapsed sidebar navigation',
      'Page transitions with smooth fade-in animation',
      'Welcome banner shows recent jobs on return visits',
      'Error banners across all generation modules',
      'Touch targets upgraded to 44px across the app',
    ],
  },
]

export function useWhatsNew() {
  const [hasNew, setHasNew] = useState(false)

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY)
    setHasNew(seen !== CURRENT_VERSION)
  }, [])

  const markSeen = () => {
    localStorage.setItem(STORAGE_KEY, CURRENT_VERSION)
    setHasNew(false)
  }

  return { hasNew, markSeen }
}

interface WhatsNewModalProps {
  open: boolean
  onClose: () => void
}

export function WhatsNewModal({ open, onClose }: WhatsNewModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="What's New">
      <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
        {CHANGELOG.map((release) => (
          <div key={release.version}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-semibold text-surface-900">{release.version}</span>
              <span className="text-xs text-surface-400">{release.date}</span>
            </div>
            <ul className="space-y-1.5">
              {release.items.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-surface-600">
                  <Sparkles className="w-3.5 h-3.5 text-brand-400 mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Modal>
  )
}
