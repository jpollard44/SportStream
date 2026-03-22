import { useEffect, useState } from 'react'
import { subscribeToClub, subscribeToPlayers } from '../firebase/firestore'

export function useClub(clubId) {
  const [club, setClub] = useState(null)
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clubId) return
    setLoading(true)

    const unsubClub = subscribeToClub(clubId, (data) => {
      setClub(data)
      setLoading(false)
    })

    const unsubPlayers = subscribeToPlayers(clubId, setPlayers)
    return () => { unsubClub(); unsubPlayers() }
  }, [clubId])

  return { club, players, loading }
}
