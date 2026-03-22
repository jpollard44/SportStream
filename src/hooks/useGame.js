import { useEffect, useState } from 'react'
import { subscribeToGame, subscribeToPlays } from '../firebase/firestore'

export function useGame(gameId) {
  const [game, setGame] = useState(null)
  const [plays, setPlays] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!gameId) return
    setLoading(true)

    const unsubGame = subscribeToGame(gameId, (data) => {
      setGame(data)
      setLoading(false)
    })

    const unsubPlays = subscribeToPlays(gameId, setPlays)

    return () => {
      unsubGame()
      unsubPlays()
    }
  }, [gameId])

  return { game, plays, loading }
}
