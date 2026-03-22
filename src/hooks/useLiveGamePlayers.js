import { useEffect, useState } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'

/**
 * Returns a Set of playerIds that are in the active lineup of any live game
 * for the given clubId. Empty set if no live game.
 */
export function useLiveGamePlayers(clubId) {
  const [livePlayerIds, setLivePlayerIds] = useState(new Set())
  const [liveGameId, setLiveGameId] = useState(null)

  useEffect(() => {
    if (!clubId) return
    const q = query(
      collection(db, 'games'),
      where('clubId', '==', clubId),
      where('status', '==', 'live')
    )
    const unsub = onSnapshot(q, (snap) => {
      const game = snap.docs[0]?.data()
      const gameId = snap.docs[0]?.id || null
      setLiveGameId(gameId)
      if (!game) { setLivePlayerIds(new Set()); return }
      const home = (game.homeLineup || []).map((e) => e.playerId)
      const away = (game.awayLineup || []).map((e) => e.playerId)
      setLivePlayerIds(new Set([...home, ...away]))
    })
    return unsub
  }, [clubId])

  return { livePlayerIds, liveGameId }
}
