import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getGameByJoinCode } from '../firebase/firestore'
import { getTournamentByJoinCode } from '../firebase/tournaments'
import { getLeagueByJoinCode } from '../firebase/leagues'

const SPORT_EMOJI = {
  basketball: '🏀', baseball: '⚾', softball: '🥎',
  soccer: '⚽', volleyball: '🏐', 'flag-football': '🏈',
}

const TYPE_STYLE = {
  game:       { label: 'Game',       cls: 'bg-green-900/50 text-green-300' },
  tournament: { label: 'Tournament', cls: 'bg-purple-900/50 text-purple-300' },
  league:     { label: 'League',     cls: 'bg-blue-900/50 text-blue-300' },
}

export default function FindPage() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  async function handleSearch(e) {
    e.preventDefault()
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    setError('')
    setResult(null)
    setLoading(true)
    try {
      const [game, tournament, league] = await Promise.all([
        getGameByJoinCode(trimmed).catch(() => null),
        getTournamentByJoinCode(trimmed).catch(() => null),
        getLeagueByJoinCode(trimmed).catch(() => null),
      ])
      if (game)            setResult({ type: 'game', entity: game })
      else if (tournament) setResult({ type: 'tournament', entity: tournament })
      else if (league)     setResult({ type: 'league', entity: league })
      else                 setError('Nothing found with that code. Double-check and try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleGo() {
    if (!result) return
    const { type, entity } = result
    if (type === 'game')       navigate(`/game/${entity.id}`)
    else if (type === 'tournament') navigate(`/tournament/${entity.id}`)
    else                       navigate(`/league/${entity.id}`)
  }

  return (
    <div className="min-h-screen bg-gray-950 pb-20 text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
        <Link to="/" className="text-lg font-extrabold tracking-tight">
          Sport<span className="text-blue-500">Stream</span>
        </Link>
        <Link to="/dashboard" className="text-sm text-gray-400 hover:text-white">Dashboard</Link>
      </nav>

      <main className="mx-auto max-w-lg px-5 pt-8 space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Find by Code</h1>
          <p className="mt-1 text-sm text-gray-400">Enter a 6-character join code to look up a game, tournament, or league.</p>
        </div>

        {/* Search card */}
        <div className="card space-y-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="e.g. ABC123"
              maxLength={6}
              autoFocus
              className="input flex-1 font-mono text-lg tracking-[0.3em] text-center"
            />
            <button
              type="submit"
              disabled={loading || code.trim().length < 4}
              className="btn-primary w-auto px-5"
            >
              {loading ? '…' : 'Find'}
            </button>
          </form>

          {error && (
            <p className="rounded-xl bg-red-900/40 px-4 py-2.5 text-sm text-red-300">{error}</p>
          )}

          {result && <ResultCard result={result} onGo={handleGo} />}
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-3 gap-3">
          <Link to="/tournaments"
            className="flex flex-col items-center gap-2 rounded-2xl bg-gray-900 py-4 text-center text-xs text-gray-400 transition hover:bg-gray-800 hover:text-white">
            <span className="text-2xl">🏆</span>
            Tournaments
          </Link>
          <Link to="/leagues"
            className="flex flex-col items-center gap-2 rounded-2xl bg-gray-900 py-4 text-center text-xs text-gray-400 transition hover:bg-gray-800 hover:text-white">
            <span className="text-2xl">🗓</span>
            Leagues
          </Link>
          <Link to="/join"
            className="flex flex-col items-center gap-2 rounded-2xl bg-gray-900 py-4 text-center text-xs text-gray-400 transition hover:bg-gray-800 hover:text-white">
            <span className="text-2xl">🎮</span>
            Scorekeeper
          </Link>
        </div>
      </main>
    </div>
  )
}

function ResultCard({ result, onGo }) {
  const { type, entity } = result
  const { label, cls } = TYPE_STYLE[type]
  const name = entity.name || `${entity.homeTeam} vs ${entity.awayTeam}`
  const sportEmoji = SPORT_EMOJI[entity.sport] || '🏅'
  const goLabel = type === 'game' ? 'Watch game →' : type === 'tournament' ? 'View tournament →' : 'View league →'

  return (
    <div className="rounded-2xl bg-gray-800 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${cls}`}>{label}</span>
        {entity.status && (
          <span className="text-xs capitalize text-gray-500">{entity.status}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xl">{sportEmoji}</span>
        <p className="font-semibold text-white">{name}</p>
      </div>
      {entity.location && <p className="text-xs text-gray-500">{entity.location}</p>}
      <button type="button" onClick={onGo} className="btn-primary py-2 text-sm">
        {goLabel}
      </button>
    </div>
  )
}
