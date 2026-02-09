import { Check } from 'lucide-react'
import { VIDEO_PRESETS } from '../../stores/img2videoQueueStore'

interface CameraPresetCardsProps {
  selectedPresets: Record<string, string[]>
  onPresetsChange: (presets: Record<string, string[]>) => void
}

export function CameraPresetCards({ selectedPresets, onPresetsChange }: CameraPresetCardsProps) {
  const handleToggle = (category: string, preset: string) => {
    const current = selectedPresets[category] || []
    const isSelected = current.includes(preset)

    let newSelection: string[]
    if (isSelected) {
      newSelection = current.filter((p) => p !== preset)
    } else {
      // Check limits
      const categoryDef = VIDEO_PRESETS[category]
      const maxSelections = categoryDef?.multiSelect ? 3 : 1

      if (categoryDef?.multiSelect === false) {
        // Single-select: replace existing
        newSelection = [preset]
      } else if (current.length >= maxSelections) {
        // Multi-select: enforce max limit
        newSelection = [...current.slice(1), preset]
      } else {
        newSelection = [...current, preset]
      }
    }

    onPresetsChange({
      ...selectedPresets,
      [category]: newSelection,
    })
  }

  return (
    <div className="space-y-6">
      {Object.entries(VIDEO_PRESETS).map(([category, config]) => (
        <div key={category}>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-surface-900">
              {config.label}
            </h4>
            <span className="text-xs text-surface-500">
              {config.multiSelect ? 'Select up to 3' : 'Select one'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {config.presets.map((preset) => {
              const isSelected = (selectedPresets[category] || []).includes(preset)

              return (
                <button
                  key={preset}
                  onClick={() => handleToggle(category, preset)}
                  className={`
                    relative px-3 py-2 rounded-lg text-sm font-medium
                    border-2 transition-all duration-150
                    ${
                      isSelected
                        ? 'border-brand bg-brand text-white'
                        : 'border-surface-200 bg-white text-surface-700 hover:border-surface-300'
                    }
                  `}
                >
                  <span className="block">{preset}</span>
                  {isSelected && (
                    <Check className="absolute top-1 right-1 w-3.5 h-3.5" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
