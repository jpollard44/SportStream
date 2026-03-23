import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { db } from '../firebase/config'
import { doc, onSnapshot } from 'firebase/firestore'

const SPORT_ICON = {
  basketball: '🏀', baseball: '⚾', softball: '🥎',
  soccer: '⚽', volleyball: '🏐', 'flag-football': '🏈',
}

function statusLabel(status) {
  if (status === 'live')  return { text: 'LIVE', cls: 'bg-red-500 text-white animate-pulse' }
  if (status === 'final') return { text: 'FINAL', cls: 'bg-gray-600 text-white' }
  return { text: 'UPCOMING', cls: 'bg-blue-500 text-white' }
}

export default function EmbedPage() {
  const { gameId } = useParams()
  const [game, setGame] = useState(null)

  useEffect(() => {
    return onSnapshot(doc(db, 'games', gameId), (snap) => {
      if (snap.exists()) setGame({ id: snap.id, ...snap.data() })
    })
  }, [gameId])

  if (!game) {
    return (
      <div style={{ fontFamily: 'system-ui, sans-serif', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '120px', color: '#999', fontSize: '14px' }}>
        Loading…
      </div>
    )
  }

  const { text: statusText, cls: statusCls } = statusLabel(game.status)
  const icon = SPORT_ICON[game.sport] || '🏅'

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      background: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      padding: '16px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      maxWidth: '400px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    }}>
      {/* Sport icon */}
      <span style={{ fontSize: '24px', flexShrink: 0 }}>{icon}</span>

      {/* Teams & score */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span style={{ fontWeight: 600, fontSize: '14px', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
            {game.homeTeam || 'Home'}
          </span>
          <span style={{ fontWeight: 800, fontSize: '22px', color: '#1e293b', minWidth: '28px', textAlign: 'right' }}>
            {game.homeScore ?? 0}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: '14px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
            {game.awayTeam || 'Away'}
          </span>
          <span style={{ fontWeight: 800, fontSize: '22px', color: '#64748b', minWidth: '28px', textAlign: 'right' }}>
            {game.awayScore ?? 0}
          </span>
        </div>
      </div>

      {/* Status badge */}
      <div style={{ flexShrink: 0, textAlign: 'center' }}>
        <span style={{
          display: 'inline-block',
          padding: '3px 8px',
          borderRadius: '6px',
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.05em',
          background: statusText === 'LIVE' ? '#ef4444' : statusText === 'FINAL' ? '#64748b' : '#3b82f6',
          color: '#fff',
        }}>
          {statusText}
        </span>
        <div style={{ marginTop: '4px', fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>
          {game.sport ? game.sport.charAt(0).toUpperCase() + game.sport.slice(1) : 'Game'}
        </div>
      </div>
    </div>
  )
}
