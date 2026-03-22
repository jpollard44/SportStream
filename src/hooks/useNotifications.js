import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { requestNotificationPermission, onForegroundMessage } from '../lib/notifications'

export function useNotifications() {
  const { user } = useAuth()
  const requested = useRef(false)
  const [toast, setToast] = useState(null) // { title, body, url }

  // Request permission once after sign-in
  useEffect(() => {
    if (!user || requested.current) return
    requested.current = true
    requestNotificationPermission(user.uid)
  }, [user])

  // Show a banner for foreground messages (game is already open)
  useEffect(() => {
    let unlisten
    onForegroundMessage((payload) => {
      const title = payload.notification?.title || 'SportStream'
      const body  = payload.notification?.body  || ''
      const url   = payload.data?.url || null
      setToast({ title, body, url })
      setTimeout(() => setToast(null), 6000)
    }).then((fn) => { unlisten = fn })
    return () => { if (typeof unlisten === 'function') unlisten() }
  }, [])

  return { toast, dismissToast: () => setToast(null) }
}
