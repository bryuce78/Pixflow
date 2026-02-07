import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { useThemeStore } from '../../stores/themeStore'
import { useProductStore } from '../../stores/productStore'
import { useNotificationStore } from '../../stores/notificationStore'
import { useNavigationStore } from '../../stores/navigationStore'
import { LoginPage } from '../auth/LoginPage'
import { TopNav } from './TopNav'
import { ProductSelector } from './ProductSelector'
import { ImagePreviewOverlay } from './ImagePreviewOverlay'
import { AvatarPreviewOverlay } from './AvatarPreviewOverlay'
import PromptFactoryPage from '../prompt-factory/PromptFactoryPage'
import { AssetMonsterPage } from '../asset-monster/AssetMonsterPage'
import AvatarStudioPage from '../avatar-studio/AvatarStudioPage'
import MachinePage from '../machine/MachinePage'
import LibraryPage from '../library/LibraryPage'

const PAGES = {
  prompts: PromptFactoryPage,
  generate: AssetMonsterPage,
  avatars: AvatarStudioPage,
  machine: MachinePage,
  history: LibraryPage,
} as const

export function AppShell() {
  const { isAuthenticated, loading: authLoading, init: initAuth } = useAuthStore()
  const initTheme = useThemeStore((s) => s.init)
  const loadProducts = useProductStore((s) => s.loadProducts)
  const loadNotifications = useNotificationStore((s) => s.load)
  const activeTab = useNavigationStore((s) => s.activeTab)

  useEffect(() => {
    initAuth()
    initTheme()
  }, [initAuth, initTheme])

  useEffect(() => {
    if (isAuthenticated) {
      loadProducts()
      loadNotifications()
    }
  }, [isAuthenticated, loadProducts, loadNotifications])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    )
  }

  if (!isAuthenticated) return <LoginPage />

  const ActivePage = PAGES[activeTab]

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <TopNav />
      <ProductSelector />
      <div className="max-w-6xl mx-auto p-8">
        <ActivePage />
      </div>
      <ImagePreviewOverlay />
      <AvatarPreviewOverlay />
    </div>
  )
}
