import { X } from 'lucide-react'
import { VirtualizedGrid } from '../ui/VirtualizedGrid'

interface SelectableCardGridProps<T> {
  items: T[]
  selectedSet: Set<T>
  onToggle: (item: T) => void
  renderContent: (item: T, index: number) => React.ReactNode
  getKey: (item: T, index: number) => string | number
  onRemove?: (item: T) => void
  removeLabel?: (item: T, index: number) => string
}

export function SelectableCardGrid<T>({
  items,
  selectedSet,
  onToggle,
  renderContent,
  getKey,
  onRemove,
  removeLabel,
}: SelectableCardGridProps<T>) {
  return (
    <VirtualizedGrid
      items={items}
      columns={5}
      itemHeight={56}
      itemAspectRatio={1}
      gap={8}
      className="max-h-[400px]"
      getKey={getKey}
      renderItem={(item, index) => (
        <div className="relative h-full w-full">
          <button
            type="button"
            onClick={() => onToggle(item)}
            className={`h-full w-full rounded-lg font-medium text-lg flex items-center justify-center transition-colors ${
              selectedSet.has(item)
                ? 'bg-brand-600 hover:bg-brand-700 text-white'
                : 'bg-surface-200 hover:bg-surface-300 text-surface-600'
            }`}
          >
            {renderContent(item, index)}
          </button>
          {onRemove && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onRemove(item)
              }}
              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-danger transition-colors"
              title={removeLabel?.(item, index) ?? 'Remove'}
              aria-label={removeLabel?.(item, index) ?? 'Remove'}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    />
  )
}
