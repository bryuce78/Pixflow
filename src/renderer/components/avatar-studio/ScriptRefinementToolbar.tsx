import { Redo, Undo } from 'lucide-react'
import { Button } from '../ui/Button'

interface ScriptRefinementToolbarProps {
  onImprove: () => void
  onShorter: () => void
  onLonger: () => void
  onDuration: (duration: number) => void
  onUndo: () => void
  onRedo: () => void
  isGenerating: boolean
  canUndo: boolean
  canRedo: boolean
  targetDuration: number
  onTargetDurationChange: (duration: number) => void
}

export function ScriptRefinementToolbar({
  onImprove,
  onShorter,
  onLonger,
  onDuration,
  onUndo,
  onRedo,
  isGenerating,
  canUndo,
  canRedo,
  targetDuration,
  onTargetDurationChange,
}: ScriptRefinementToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onImprove} disabled={isGenerating}>
          Improve
        </Button>
        <Button variant="ghost" size="sm" onClick={onShorter} disabled={isGenerating}>
          Shorter
        </Button>
        <Button variant="ghost" size="sm" onClick={onLonger} disabled={isGenerating}>
          Longer
        </Button>
        <div className="w-px h-5 bg-surface-200" />
        <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-surface-100 text-surface-900">
          <input
            type="number"
            value={targetDuration}
            onChange={(e) => onTargetDurationChange(Number(e.target.value))}
            min={5}
            max={120}
            className="w-10 bg-transparent text-surface-900 outline-none text-xs"
          />
          <span>sec</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onDuration(targetDuration)} disabled={isGenerating}>
          Duration
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="w-8 h-8 rounded-lg bg-surface-100 hover:bg-surface-200 text-surface-600 hover:text-surface-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center"
          title="Undo"
        >
          <Undo className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className="w-8 h-8 rounded-lg bg-surface-100 hover:bg-surface-200 text-surface-600 hover:text-surface-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center"
          title="Redo"
        >
          <Redo className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
