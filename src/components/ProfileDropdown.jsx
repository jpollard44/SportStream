import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { logout } from '../firebase/auth'

function getInitials(name, email) {
  if (name) {
    const parts = name.trim().split(' ')
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return parts[0][0].toUpperCase()
  }
  if (email) return email[0].toUpperCase()
  return '?'
}

export default function ProfileDropdown() {
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (!user) return null

  const name = user.displayName || ''
  const email = user.email || ''
  const photoURL = user.photoURL || null
  const initials = getInitials(name, email)

  async function handleSignOut() {
    setOpen(false)
    await logout()
    navigate('/')
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white ring-2 ring-blue-500/30 transition hover:ring-blue-400/60 active:scale-95 overflow-hidden"
        aria-label="Profile menu"
      >
        {photoURL ? (
          <img src={photoURL} alt={name} className="h-full w-full object-cover" />
        ) : (
          <span>{initials}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-56 rounded-2xl border border-gray-700/50 bg-gray-900 p-1 shadow-2xl">
          <div className="px-3 py-2.5 border-b border-gray-800 mb-1">
            <p className="text-sm font-semibold text-white truncate">{name || 'User'}</p>
            <p className="text-xs text-gray-500 truncate">{email}</p>
          </div>

          <button
            onClick={toggleTheme}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition"
          >
            <span className="text-base">{theme === 'dark' ? '☀️' : '🌙'}</span>
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>

          <Link
            to="/settings"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition"
          >
            <span className="text-base">⚙️</span>
            <span>Settings</span>
          </Link>

          <div className="my-1 border-t border-gray-800" />

          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-red-400 hover:bg-red-900/30 hover:text-red-300 transition"
          >
            <span className="text-base">→</span>
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  )
}
