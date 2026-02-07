import { Wand2, Layers, Video, Zap, Star, Loader2, BookOpen, Sun, Moon } from 'lucide-react'
import { useNavigationStore, type TabId } from '../../stores/navigationStore'
import { usePromptStore } from '../../stores/promptStore'
import { useMachineStore } from '../../stores/machineStore'
import { useHistoryStore } from '../../stores/historyStore'
import { useThemeStore } from '../../stores/themeStore'
import { NotificationBell } from './NotificationBell'
import { UserMenu } from './UserMenu'

const TABS: { id: TabId; label: string; icon: typeof Wand2 }[] = [
  { id: 'prompts', label: 'Prompt Factory', icon: Wand2 },
  { id: 'generate', label: 'Asset Monster', icon: Layers },
  { id: 'avatars', label: 'Avatar Studio', icon: Video },
  { id: 'machine', label: 'The Machine', icon: Zap },
  { id: 'history', label: 'Library', icon: BookOpen },
]

export function TopNav() {
  const { activeTab, navigate } = useNavigationStore()
  const promptCount = usePromptStore((s) => s.prompts.length)
  const machineStep = useMachineStore((s) => s.step)
  const favoritesCount = useHistoryStore((s) => s.favorites.length)
  const { mode, toggleMode } = useThemeStore()

  return (
    <>
      <div className="border-b border-gray-800 app-drag-region">
        <div className="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-3 app-no-drag">
            <span className="text-purple-400">⚡</span>
            Pixflow
          </h1>
          <div className="flex items-center gap-2 app-no-drag">
            <NotificationBell />
            <button
              onClick={toggleMode}
              className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800"
              title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {mode === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <UserMenu />
          </div>
        </div>
      </div>

      <div className="border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-8">
          <div className="flex gap-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => navigate(id)}
                className={`px-6 py-3 font-medium transition-colors relative flex items-center gap-2 ${
                  activeTab === id ? 'text-purple-400' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
                {id === 'generate' && promptCount > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-gray-800 rounded text-xs">{promptCount}</span>
                )}
                {id === 'machine' && machineStep !== 'idle' && machineStep !== 'done' && machineStep !== 'error' && (
                  <Loader2 className="w-3 h-3 animate-spin text-yellow-400" />
                )}
                {id === 'history' && favoritesCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-purple-600 rounded text-xs flex items-center gap-1">
                    <Star className="w-3 h-3" />
                    {favoritesCount}
                  </span>
                )}
                {activeTab === id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-400" />}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
