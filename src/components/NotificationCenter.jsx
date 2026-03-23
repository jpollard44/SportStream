import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { db } from '../firebase/config'
import {
  collection, query, orderBy, limit, onSnapshot,
  writeBatch, doc, updateDoc
} from 'firebase/firestore'

function timeAgo(ts) {
  if (!ts) return ''
  const date = ts.toDate ? ts.toDate() : new Date(ts)
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function typeIcon(type) {
  switch (type) {
    case 'game_live':     return '🔴'
    case 'notable_play':  return '⚡'
    case 'game_complete': return '✅'
    case 'announcement':  return '📣'
    case 'invite':        return '📩'
    default:              return '🔔'
  }
}

export default function NotificationCenter() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [notifs, setNotifs] = useState([])
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (!user) return
    const q = query(
      collection(db, 'users', user.uid, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(30)
    )
    return onSnapshot(q, (snap) => {
      setNotifs(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
  }, [user])

  if (!user) return null

  const unread = notifs.filter((n) => !n.read).length
  const badge = unread > 9 ? '9+' : unread > 0 ? String(unread) : null

  async function markRead(notif) {
    setOpen(false)
    if (!notif.read) {
      await updateDoc(doc(db, 'users', user.uid, 'notifications', notif.id), { read: true })
    }
    if (notif.link) navigate(notif.link)
  }

  async function markAllRead() {
    const unreadNotifs = notifs.filter((n) => !n.read)
    if (!unreadNotifs.length) return
    const batch = writeBatch(db)
    unreadNotifs.forEach((n) => {
      batch.update(doc(db, 'users', user.uid, 'notifications', n.id), { read: true })
    })
    await batch.commit()
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gray-800 text-lg transition hover:bg-gray-700 active:scale-95"
        aria-label="Notifications"
      >
        🔔
        {badge && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white leading-none">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 max-h-[70vh] overflow-hidden flex flex-col rounded-2xl border border-gray-700/50 bg-gray-900 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
            <p className="text-sm font-bold text-white">Notifications</p>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-blue-400 hover:text-blue-300 transition"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {notifs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <span className="text-3xl mb-2">🔔</span>
                <p className="text-sm">You're all caught up</p>
              </div>
            ) : (
              notifs.map((n) => (
                <button
                  key={n.id}
                  onClick={() => markRead(n)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left transition hover:bg-gray-800 border-b border-gray-800/50 ${
                    !n.read ? 'bg-gray-800/40' : ''
                  }`}
                >
                  <span className="text-xl shrink-0 mt-0.5">{typeIcon(n.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{n.title}</p>
                    {n.body && <p className="text-xs text-gray-400 line-clamp-2">{n.body}</p>}
                    <p className="text-xs text-gray-600 mt-0.5">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.read && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
