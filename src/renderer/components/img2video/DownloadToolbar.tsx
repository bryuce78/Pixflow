import { Download } from 'lucide-react'

interface DownloadToolbarProps {
  onDownloadAll: () => void
  onDownloadSelected?: () => void
  selectedCount?: number
  totalCount?: number
  showDownloadAll?: boolean
}

export function DownloadToolbar({
  onDownloadAll,
  onDownloadSelected,
  selectedCount = 0,
  totalCount = 0,
  showDownloadAll = true,
}: DownloadToolbarProps) {
  const hasPartialSelection = selectedCount > 0 && selectedCount < totalCount
  const hasAnyCompleted = totalCount > 0
  const buttonLabel = hasPartialSelection ? `Download ${selectedCount}` : 'Download All'
  const handleClick = hasPartialSelection && onDownloadSelected ? onDownloadSelected : onDownloadAll

  return (
    <div className="flex gap-2">
      {showDownloadAll && (
        <button
          type="button"
          onClick={handleClick}
          disabled={!hasAnyCompleted}
          className="px-3 py-1.5 rounded-lg bg-secondary-600 hover:bg-secondary-700 disabled:bg-surface-300 disabled:text-surface-500 disabled:cursor-not-allowed text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
        >
          <Download className="w-3 h-3" />
          {buttonLabel}
        </button>
      )}
    </div>
  )
}
