import { useEffect, useRef, useState } from 'react'
import { updateGame } from '../firebase/firestore'

/**
 * Manages the local display clock for a game.
 * Ticks locally from the server's last-known clockElapsed.
 * Only writes to Firestore on pause/resume/period change.
 */
export function useGameClock(game) {
  const [displaySeconds, setDisplaySeconds] = useState(0)
  const intervalRef = useRef(null)
  const localElapsedRef = useRef(0)

  // Sync local state whenever the server state changes (on reconnect, etc.)
  useEffect(() => {
    if (!game) return
    localElapsedRef.current = game.clockElapsed || 0
    setDisplaySeconds(game.clockElapsed || 0)

    clearInterval(intervalRef.current)

    if (game.clockRunning) {
      intervalRef.current = setInterval(() => {
        localElapsedRef.current += 1
        setDisplaySeconds(localElapsedRef.current)
      }, 1000)
    }

    return () => clearInterval(intervalRef.current)
  }, [game?.clockRunning, game?.clockElapsed, game?.period])

  async function startClock(gameId) {
    await updateGame(gameId, {
      clockRunning: true,
      status: 'live',
      startedAt: game.startedAt || new Date(),
    })
  }

  async function pauseClock(gameId) {
    clearInterval(intervalRef.current)
    await updateGame(gameId, {
      clockRunning: false,
      clockElapsed: localElapsedRef.current,
    })
  }

  async function nextPeriod(gameId) {
    clearInterval(intervalRef.current)
    const nextPeriod = (game?.period || 1) + 1
    const isGameOver = nextPeriod > (game?.totalPeriods || 4)
    await updateGame(gameId, {
      clockRunning: false,
      clockElapsed: 0,
      period: isGameOver ? game.totalPeriods : nextPeriod,
      status: isGameOver ? 'final' : 'live',
      endedAt: isGameOver ? new Date() : null,
    })
  }

  return { displaySeconds, startClock, pauseClock, nextPeriod }
}
