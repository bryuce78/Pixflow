import { useState, useRef, useEffect } from 'react'
import { Bell, Check } from 'lucide-react'
import { useNotificationStore } from '../../stores/notificationStore'

export function NotificationBell() {
  const { notifications, unreadCount, load, markRead, markAllRead } = useNotificationStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleOpen = () => {
    setOpen(!open)
    if (!open) load()
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center font-medium">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
            <span className="text-sm font-medium">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-center text-sm text-gray-500 py-6">No notifications</p>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <button
                  key={n.id}
                  onClick={() => { if (!n.read) markRead(n.id) }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-800 transition-colors ${
                    n.read ? 'text-gray-500' : 'text-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && <span className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-1.5 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{n.title}</p>
                      <p className="text-xs text-gray-500 truncate">{n.body}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
