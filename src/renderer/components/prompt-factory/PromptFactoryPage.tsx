import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle,
  Clock,
  Copy,
  Layers,
  Lightbulb,
  Loader2,
  ScanSearch,
  Sparkles,
  Star,
  Tags,
  Upload,
  WifiOff,
  X,
} from 'lucide-react'
import { PROMPT_GENERATE_MAX, PROMPT_GENERATE_MIN } from '../../../constants/limits'
import { assetUrl } from '../../lib/api'
import { useGenerationStore } from '../../stores/generationStore'
import { useHistoryStore } from '../../stores/historyStore'
import { useNavigationStore } from '../../stores/navigationStore'
import { usePromptStore } from '../../stores/promptStore'
import type { GeneratedPrompt } from '../../types'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Slider } from '../ui/Slider'

function extractMood(prompt: GeneratedPrompt): string {
  return prompt.lighting?.mood || prompt.effects?.atmosphere || 'N/A'
}

function generateFavoriteName(prompt: GeneratedPrompt, index: number): string {
  const concept = usePromptStore.getState().concept
  const styleWords = prompt.style?.split(' ').slice(0, 4).join(' ')
  if (concept) return `${concept} #${index + 1}`
  if (styleWords) return styleWords.length > 35 ? `${styleWords.slice(0, 35)}...` : styleWords
  return `Prompt ${index + 1} (${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })})`
}

export default function PromptFactoryPage() {
  const promptStore = usePromptStore()
  const generationStore = useGenerationStore()
  const { addToFavorites } = useHistoryStore()
  const { navigate } = useNavigationStore()

  const {
    concept,
    count,
    loading,
    prompts,
    selectedIndex,
    editingPromptText,
    promptSaving,
    error,
    copied,
    research,
    varietyScore,
    promptMode,
    analyzePreview,
    analyzeLoading,
    analyzedPrompt,
    analyzeError,
    analyzeCopied,
    setConcept,
    setCount,
    setPromptMode,
    setSelectedIndex,
    setEditingPromptText,
    generate,
    cancelGenerate,
    copyPrompt,
    saveEdit,
    setAnalyzeImage,
    analyzeCurrentImage,
    copyAnalyzed,
    setPrompts,
  } = promptStore

  const handleSendToMonster = () => {
    generationStore.selectAllPrompts(prompts.length)
    generationStore.setImageSource('upload')
    navigate('generate')
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAnalyzeImage(file, URL.createObjectURL(file))
  }

  if (promptMode === 'image') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost-muted" size="md" onClick={() => setPromptMode('concept')}>
            Concept to Prompts
          </Button>
          <Button variant="primary" size="md" onClick={() => setPromptMode('image')}>
            Image to Prompt
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Left: Upload */}
          <div className="bg-surface-100/50 rounded-xl border border-surface-200/50 p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <ScanSearch className="w-5 h-5 text-brand-400" />
              <h3 className="text-lg font-semibold text-surface-900">Analyze Image</h3>
            </div>

            <div className="relative">
              {analyzePreview ? (
                <div className="relative">
                  <img
                    src={analyzePreview.startsWith('blob:') ? analyzePreview : assetUrl(analyzePreview)}
                    alt="Preview"
                    className="w-full aspect-[9/16] object-cover rounded-lg"
                  />
                  <Button
                    variant="ghost"
                    size="xs"
                    aria-label="Remove image"
                    icon={<X className="w-4 h-4" />}
                    onClick={() => setAnalyzeImage(null, null)}
                    className="absolute top-2 right-2 bg-black/60 text-white hover:bg-black/80"
                  />
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full aspect-[9/16] border-2 border-dashed border-surface-200 rounded-lg cursor-pointer hover:border-brand-500 transition-colors">
                  <Upload className="w-8 h-8 text-surface-400 mb-2" />
                  <span className="text-sm text-surface-400">Drop image or click to upload</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </label>
              )}
            </div>

            <Button
              variant="primary"
              size="lg"
              icon={analyzeLoading ? undefined : <ScanSearch className="w-5 h-5" />}
              loading={analyzeLoading}
              onClick={analyzeCurrentImage}
              disabled={!analyzePreview || analyzeLoading}
              className="w-full"
            >
              {analyzeLoading ? 'Analyzing...' : 'Analyze Image'}
            </Button>

            {analyzeError && (
              <div className="flex items-center gap-2 p-3 bg-danger-muted/30 border border-danger/30 rounded-lg text-danger text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {analyzeError.message}
              </div>
            )}
          </div>

          {/* Right: Result */}
          <div className="bg-surface-100/50 rounded-xl border border-surface-200/50 p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-surface-900">Generated Prompt</h3>
              {analyzedPrompt && (
                <Button
                  variant="ghost"
                  size="xs"
                  aria-label="Copy prompt"
                  icon={analyzeCopied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                  onClick={copyAnalyzed}
                />
              )}
            </div>

            {analyzedPrompt ? (
              <>
                <pre className="flex-1 overflow-y-auto text-xs text-surface-500 bg-surface-50/50 rounded-lg p-4 whitespace-pre-wrap break-words mb-4">
                  {JSON.stringify(analyzedPrompt, null, 2)}
                </pre>
                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    size="md"
                    icon={<Layers className="w-4 h-4" />}
                    onClick={() => {
                      setPrompts([analyzedPrompt])
                      setPromptMode('concept')
                    }}
                    className="flex-1"
                  >
                    Use in Factory
                  </Button>
                  <Button
                    variant="success"
                    size="md"
                    icon={<ArrowRight className="w-4 h-4" />}
                    onClick={() => {
                      setPrompts([analyzedPrompt])
                      navigate('generate')
                    }}
                    className="flex-1"
                  >
                    Asset Monster
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-surface-400 text-sm">
                Upload and analyze an image to generate a prompt
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="primary" size="md" onClick={() => setPromptMode('concept')}>
          Concept to Prompts
        </Button>
        <Button variant="ghost-muted" size="md" onClick={() => setPromptMode('image')}>
          Image to Prompt
        </Button>
      </div>

      {/* Input Area */}
      <div className="bg-surface-100/50 rounded-xl border border-surface-200/50 p-6">
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <Input
              label="Concept"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && concept.trim() && generate()}
              placeholder="e.g., Christmas, Halloween, Summer Beach..."
            />
          </div>
          <div className="w-48">
            <Slider
              label="Prompts"
              displayValue={count}
              min={PROMPT_GENERATE_MIN}
              max={PROMPT_GENERATE_MAX}
              value={count}
              onChange={(e) => setCount(Number(e.currentTarget.value))}
            />
          </div>
          <div>
            {loading ? (
              <Button variant="danger" size="lg" icon={<X className="w-5 h-5" />} onClick={cancelGenerate}>
                Cancel
              </Button>
            ) : (
              <Button
                variant="primary"
                size="lg"
                icon={<Sparkles className="w-5 h-5" />}
                onClick={generate}
                disabled={!concept.trim()}
              >
                Generate
              </Button>
            )}
          </div>
        </div>

        {loading && (
          <div className="mt-4 flex items-center gap-3 text-brand-300 text-sm">
            <Loader2 className="w-5 h-5 animate-spin" />
            Researching &amp; generating prompts...
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-danger-muted/30 border border-danger/30 rounded-xl text-danger">
          {error.message.includes('network') || error.message.includes('fetch') ? (
            <WifiOff className="w-5 h-5 flex-shrink-0" />
          ) : error.message.includes('timeout') || error.message.includes('Timeout') ? (
            <Clock className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span className="text-sm">{error.message}</span>
          {error.action && (
            <Button
              variant="ghost-danger"
              size="sm"
              onClick={error.action.onClick}
              className="ml-auto bg-danger/30 text-danger hover:bg-danger/50"
            >
              {error.action.label}
            </Button>
          )}
        </div>
      )}

      {/* Research Insights */}
      {research && (
        <div className="bg-surface-100/50 rounded-xl border border-surface-200/50 p-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-5 h-5 text-warning" />
                <h3 className="text-sm font-semibold text-surface-900">Key Insights</h3>
              </div>
              <ul className="space-y-1.5">
                {research.insights?.map((insight, i) => (
                  <li
                    // biome-ignore lint/suspicious/noArrayIndexKey: static list
                    key={i}
                    className="text-xs text-surface-500 flex items-start gap-2"
                  >
                    <CheckCircle className="w-3.5 h-3.5 text-success mt-0.5 flex-shrink-0" />
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Tags className="w-5 h-5 text-brand-400" />
                <h3 className="text-sm font-semibold text-surface-900">Sub-themes</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {research.subThemes?.map((theme, i) => (
                  <span
                    // biome-ignore lint/suspicious/noArrayIndexKey: static list
                    key={i}
                    className="px-2.5 py-1 bg-brand-600/20 text-brand-300 rounded-full text-xs"
                  >
                    {theme}
                  </span>
                ))}
              </div>
              {varietyScore && (
                <div className="mt-4 p-3 bg-surface-50/50 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-surface-400">Variety Score</span>
                    <span className={`text-xs font-medium ${varietyScore.passed ? 'text-success' : 'text-danger'}`}>
                      {varietyScore.passed ? 'Passed' : 'Low Variety'}
                    </span>
                  </div>
                  <div className="text-xs text-surface-400 space-y-0.5">
                    <div>{varietyScore.aesthetics_used.length} aesthetics</div>
                    <div>{varietyScore.emotions_used.length} emotions</div>
                    <div>{varietyScore.lighting_setups_used.length} lighting setups</div>
                    {varietyScore.has_duplicates && <div className="text-danger">Duplicate combinations detected</div>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Prompts Grid */}
      {prompts.length > 0 && (
        <div className="grid grid-cols-3 gap-6">
          {/* Prompt List */}
          <div className="bg-surface-100/50 rounded-xl border border-surface-200/50 p-4 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-surface-900">Prompts ({prompts.length})</h3>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 mb-4">
              {prompts.map((prompt, i) => (
                <button
                  type="button"
                  // biome-ignore lint/suspicious/noArrayIndexKey: static list
                  key={i}
                  className={`w-full text-left p-3 rounded-lg cursor-pointer transition-colors flex items-center justify-between ${
                    selectedIndex === i
                      ? 'bg-brand-600/30 border border-brand-500/50'
                      : 'bg-surface-200/30 hover:bg-surface-200/50'
                  }`}
                  onClick={() => setSelectedIndex(i)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-surface-900 truncate">
                      #{i + 1} — {prompt.style?.split(' ').slice(0, 5).join(' ') || 'Untitled'}
                    </div>
                    <div className="text-xs text-surface-400 mt-0.5">{extractMood(prompt)}</div>
                  </div>
                  <Button
                    variant="ghost-warning"
                    size="xs"
                    aria-label="Add to favorites"
                    icon={<Star className="w-4 h-4" />}
                    onClick={(e) => {
                      e.stopPropagation()
                      addToFavorites(prompt, generateFavoriteName(prompt, i))
                    }}
                    className="flex-shrink-0"
                  />
                </button>
              ))}
            </div>
            <Button
              variant="success"
              size="md"
              icon={<ArrowRight className="w-4 h-4" />}
              onClick={handleSendToMonster}
              className="w-full"
            >
              Send to Monster
            </Button>
          </div>

          {/* Preview + Edit */}
          <div className="col-span-2 bg-surface-100/50 rounded-xl border border-surface-200/50 p-4 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-surface-900">Prompt #{(selectedIndex ?? 0) + 1}</h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="xs"
                  aria-label="Copy prompt"
                  icon={copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                  onClick={copyPrompt}
                />
                <Button
                  variant="ghost-warning"
                  size="xs"
                  aria-label="Add to favorites"
                  icon={<Star className="w-4 h-4" />}
                  onClick={() => {
                    const prompt = prompts[selectedIndex ?? 0]
                    if (prompt) addToFavorites(prompt, generateFavoriteName(prompt, selectedIndex ?? 0))
                  }}
                />
                <Button
                  variant="primary"
                  size="sm"
                  icon={promptSaving ? undefined : <Check className="w-3.5 h-3.5" />}
                  loading={promptSaving}
                  onClick={() => saveEdit(editingPromptText)}
                >
                  Save
                </Button>
              </div>
            </div>
            <textarea
              value={
                editingPromptText ?? (selectedIndex != null ? JSON.stringify(prompts[selectedIndex], null, 2) : '')
              }
              onChange={(e) => setEditingPromptText(e.target.value)}
              className="flex-1 w-full bg-surface-50/50 border border-surface-200 rounded-lg p-4 text-xs text-surface-500 font-mono resize-none focus:outline-none focus:border-brand-500 transition-colors whitespace-pre-wrap"
              spellCheck={false}
            />
          </div>
        </div>
      )}
    </div>
  )
}
