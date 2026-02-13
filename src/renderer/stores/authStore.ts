import { create } from 'zustand'
import { apiUrl, getApiError, unwrapApiData } from '../lib/api'
import { clearToken, getToken, setToken } from '../lib/auth'

const DEV_AUTO_LOGIN_ENABLED =
  import.meta.env.DEV &&
  (String(import.meta.env.VITE_PIXFLOW_DEV_AUTO_LOGIN || '').trim() === '1' ||
    String(import.meta.env.VITE_PIXFLOW_DEV_AUTH_BYPASS || '').trim() === '1')
const DEV_AUTO_LOGIN_EMAIL = String(import.meta.env.VITE_PIXFLOW_DEV_AUTO_LOGIN_EMAIL || 'dev@pixery.ai').trim()
const DEV_AUTO_LOGIN_PASSWORD = String(import.meta.env.VITE_PIXFLOW_DEV_AUTO_LOGIN_PASSWORD || 'dev123pixery!').trim()
const LOGIN_DISABLED = !String(import.meta.env.VITE_PIXFLOW_DISABLE_LOGIN ?? '1')
  .trim()
  .match(/^(0|false|off|no)$/i)

const LOGIN_DISABLED_FALLBACK_USER = {
  id: 1,
  email: 'local@pixflow.internal',
  name: 'Local User',
  role: 'admin',
}

interface User {
  id: number
  email: string
  name: string
  role: string
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  loading: boolean
  error: string | null
  loginDisabled: boolean

  init: () => Promise<void>
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
  changePassword: (currentPassword: string, newPassword: string) => Promise<string | null>
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isAuthenticated: false,
  loading: true,
  error: null,
  loginDisabled: LOGIN_DISABLED,

  init: async () => {
    if (LOGIN_DISABLED) {
      try {
        const res = await fetch(apiUrl('/api/auth/me'))
        if (!res.ok) {
          set({ user: LOGIN_DISABLED_FALLBACK_USER, isAuthenticated: true, loading: false, error: null })
          return
        }
        const raw = await res.json()
        const { user } = unwrapApiData<{ user: User }>(raw)
        set({ user, isAuthenticated: true, loading: false, error: null })
        return
      } catch {
        set({ user: LOGIN_DISABLED_FALLBACK_USER, isAuthenticated: true, loading: false, error: null })
        return
      }
    }

    const token = getToken()
    if (!token) {
      // Optional local shortcut for faster UI iteration.
      if (DEV_AUTO_LOGIN_ENABLED && DEV_AUTO_LOGIN_EMAIL && DEV_AUTO_LOGIN_PASSWORD) {
        await useAuthStore.getState().login(DEV_AUTO_LOGIN_EMAIL, DEV_AUTO_LOGIN_PASSWORD)
      }
      set({ loading: false })
      return
    }

    try {
      const res = await fetch(apiUrl('/api/auth/me'), {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        clearToken()
        set({ loading: false })
        return
      }
      const raw = await res.json()
      const { user } = unwrapApiData<{ user: User }>(raw)
      set({ user, isAuthenticated: true, loading: false })
    } catch {
      clearToken()
      set({ loading: false })
    }
  },

  login: async (email, password) => {
    if (LOGIN_DISABLED) {
      set({ user: LOGIN_DISABLED_FALLBACK_USER, isAuthenticated: true, error: null })
      return true
    }

    set({ error: null })
    try {
      const res = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (!res.ok) {
        const raw = await res.json().catch(() => ({}))
        set({ error: getApiError(raw, 'Login failed') })
        return false
      }

      const raw = await res.json()
      const { user, token } = unwrapApiData<{ user: User; token: string }>(raw)
      setToken(token)
      set({ user, isAuthenticated: true, error: null })
      return true
    } catch {
      set({ error: 'Connection failed' })
      return false
    }
  },

  logout: () => {
    if (LOGIN_DISABLED) {
      set({ user: LOGIN_DISABLED_FALLBACK_USER, isAuthenticated: true, error: null })
      return
    }

    clearToken()
    set({ user: null, isAuthenticated: false })
  },

  changePassword: async (currentPassword, newPassword) => {
    if (LOGIN_DISABLED) {
      return 'Password changes are disabled while login is disabled.'
    }

    const token = getToken()
    try {
      const res = await fetch(apiUrl('/api/auth/change-password'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      })

      if (!res.ok) {
        const raw = await res.json().catch(() => ({}))
        return getApiError(raw, 'Failed to change password')
      }

      return null
    } catch {
      return 'Connection failed'
    }
  },
}))
