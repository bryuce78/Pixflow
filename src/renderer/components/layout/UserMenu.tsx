import { useState, useRef, useEffect } from 'react'
import { User, LogOut, KeyRound } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'

export function UserMenu() {
  const { user, logout, changePassword } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleChangePassword = async () => {
    setPwError(null)
    const err = await changePassword(currentPw, newPw)
    if (err) {
      setPwError(err)
    } else {
      setPwSuccess(true)
      setTimeout(() => {
        setChangingPassword(false)
        setPwSuccess(false)
        setCurrentPw('')
        setNewPw('')
      }, 1500)
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800"
      >
        <User className="w-4 h-4" />
        <span className="text-sm">{user?.name || 'User'}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 py-1">
          <div className="px-3 py-2 border-b border-gray-800">
            <p className="text-sm font-medium">{user?.name}</p>
            <p className="text-xs text-gray-500">{user?.email}</p>
          </div>

          {changingPassword ? (
            <div className="px-3 py-3 space-y-2">
              <input
                type="password"
                placeholder="Current password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-purple-500"
              />
              <input
                type="password"
                placeholder="New password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-purple-500"
              />
              {pwError && <p className="text-xs text-red-400">{pwError}</p>}
              {pwSuccess && <p className="text-xs text-green-400">Password changed!</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleChangePassword}
                  disabled={!currentPw || !newPw}
                  className="flex-1 px-2 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded text-sm"
                >
                  Save
                </button>
                <button
                  onClick={() => { setChangingPassword(false); setPwError(null); setCurrentPw(''); setNewPw('') }}
                  className="flex-1 px-2 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={() => setChangingPassword(true)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
              >
                <KeyRound className="w-4 h-4" />
                Change Password
              </button>
              <button
                onClick={() => { setOpen(false); logout() }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-gray-800 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
