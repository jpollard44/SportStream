import { useEffect, useState } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'

/**
 * Subscribes to all currently-live games and returns a Set of clubIds
 * (home or away) that are actively playing. Also returns a map from
 * clubId → gameId for direct navigation.
 */
export function useLiveClubs() {
  const [liveClubIds, setLiveClubIds]     = useState(new Set())
  const [liveGameByClub, setLiveGameByClub] = useState({})

  useEffect(() => {
    const q = query(collection(db, 'games'), where('status', '==', 'live'))
    return onSnapshot(q, (snap) => {
      const ids   = new Set()
      const byClub = {}
      snap.docs.forEach((doc) => {
        const d = doc.data()
        if (d.clubId)     { ids.add(d.clubId);     byClub[d.clubId]     = byClub[d.clubId]     || doc.id }
        if (d.awayClubId) { ids.add(d.awayClubId); byClub[d.awayClubId] = byClub[d.awayClubId] || doc.id }
      })
      setLiveClubIds(ids)
      setLiveGameByClub(byClub)
    })
  }, [])

  return { liveClubIds, liveGameByClub }
}
