import { useEffect } from 'react'
import { Star, History, Copy, Trash2, Loader2 } from 'lucide-react'
import { useHistoryStore } from '../../stores/historyStore'
import { usePromptStore } from '../../stores/promptStore'
import { useNavigationStore } from '../../stores/navigationStore'
import type { GeneratedPrompt } from '../../types'

export default function LibraryPage() {
  const {
    entries, favorites, loading, selectedPrompt, favoriteAdded,
    setSelectedPrompt, loadAll, addToFavorites, removeFromFavorites,
  } = useHistoryStore()
  const { setPrompts, setConcept } = usePromptStore()
  const { navigate } = useNavigationStore()

  useEffect(() => { loadAll() }, [loadAll])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-6 h-[calc(100vh-12rem)]">
        {/* Favorites */}
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Star className="w-5 h-5 text-yellow-400" />
            <h3 className="text-lg font-semibold text-white">Favorites</h3>
            <span className="text-sm text-gray-400">({favorites.length})</span>
          </div>
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
            </div>
          ) : favorites.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
              No favorites yet
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-2">
              {favorites.map((fav) => (
                <div
                  key={fav.id}
                  className="group flex items-center justify-between p-3 bg-gray-700/30 rounded-lg hover:bg-gray-700/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedPrompt(fav.prompt)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Star className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                    <span className="text-sm text-gray-200 truncate">{fav.name}</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFromFavorites(fav.id) }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-400 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* History */}
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-semibold text-white">History</h3>
            <span className="text-sm text-gray-400">({entries.length})</span>
          </div>
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
              No history yet
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-2">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="p-3 bg-gray-700/30 rounded-lg hover:bg-gray-700/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedPrompt(entry.prompts[0])}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-white">{entry.concept}</span>
                    <span className="text-xs text-gray-400">{entry.prompts.length} prompts</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setPrompts(entry.prompts as GeneratedPrompt[])
                        setConcept(entry.concept)
                        navigate('prompts')
                      }}
                      className="text-xs px-2 py-1 bg-purple-600/30 text-purple-300 rounded hover:bg-purple-600/50 transition-colors"
                    >
                      Load All
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Preview</h3>
            {selectedPrompt && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(selectedPrompt, null, 2))}
                  className="p-1.5 text-gray-400 hover:text-white transition-colors"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    const styleWords = selectedPrompt.style?.split(' ').slice(0, 4).join(' ') || 'Untitled'
                    addToFavorites(selectedPrompt, styleWords)
                  }}
                  className="p-1.5 text-gray-400 hover:text-yellow-400 transition-colors"
                >
                  <Star className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
          {selectedPrompt ? (
            <pre className="flex-1 overflow-y-auto text-xs text-gray-300 bg-gray-900/50 rounded-lg p-4 whitespace-pre-wrap break-words">
              {JSON.stringify(selectedPrompt, null, 2)}
            </pre>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
              Select a prompt to preview
            </div>
          )}
        </div>
      </div>

      {favoriteAdded && (
        <div className="fixed bottom-6 right-6 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm animate-fade-in">
          Added to favorites!
        </div>
      )}
    </div>
  )
}
