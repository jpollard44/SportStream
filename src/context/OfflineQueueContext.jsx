import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { enqueuePlay, flushQueue } from '../lib/offlineQueue'
import { addPlay } from '../firebase/firestore'

const OfflineQueueContext = createContext(null)

export function OfflineQueueProvider({ children }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [queueLength, setQueueLength] = useState(0)
  const flushing = useRef(false)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Auto-flush when we come back online
  useEffect(() => {
    if (isOnline && !flushing.current) {
      flush()
    }
  }, [isOnline])

  async function flush() {
    flushing.current = true
    try {
      await flushQueue(async (item) => {
        await addPlay(item.gameId, item.playEvent)
      })
      setQueueLength(0)
    } finally {
      flushing.current = false
    }
  }

  async function enqueue(gameId, playEvent) {
    await enqueuePlay({ gameId, playEvent, timestamp: Date.now() })
    setQueueLength((n) => n + 1)
  }

  return (
    <OfflineQueueContext.Provider value={{ isOnline, queueLength, enqueue, flush }}>
      {children}
    </OfflineQueueContext.Provider>
  )
}

export function useOfflineQueue() {
  const ctx = useContext(OfflineQueueContext)
  if (!ctx) throw new Error('useOfflineQueue must be inside OfflineQueueProvider')
  return ctx
}
