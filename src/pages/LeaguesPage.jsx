import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { subscribeToPublicLeagues, getLeagueByJoinCode } from '../firebase/leagues'
import { useAuth } from '../context/AuthContext'

const SPORT_EMOJI = {
  basketball: '🏀', baseball: '⚾', softball: '🥎',
  soccer: '⚽', volleyball: '🏐', 'flag-football': '🏈',
}

const STATUS_CONFIG = {
  registration: { label: 'Open',     cls: 'bg-blue-900/60 text-blue-300' },
  active:       { label: 'Active',   cls: 'bg-green-900/60 text-green-300' },
  complete:     { label: 'Finished', cls: 'bg-gray-800 text-gray-400' },
}

const FILTERS = [
  { val: 'all',          label: 'All' },
  { val: 'registration', label: 'Open' },
  { val: 'active',       label: 'Active' },
  { val: 'complete',     label: 'Finished' },
]

export default function LeaguesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [leagues, setLeagues] = useState([])
  const [filter, setFilter] = useState('all')
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')

  useEffect(() => {
    return subscribeToPublicLeagues(setLeagues)
  }, [])

  const visible = filter === 'all' ? leagues : leagues.filter((l) => l.status === filter)
  const openCount   = leagues.filter((l) => l.status === 'registration').length
  const activeCount = leagues.filter((l) => l.status === 'active').length

  async function handleJoin(e) {
    e.preventDefault()
    setJoining(true)
    setJoinError('')
    try {
      const league = await getLeagueByJoinCode(joinCode.trim())
      if (!league) { setJoinError('No league found with that code.'); return }
      navigate(`/league/${league.id}/join`)
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 pb-20 text-white">

      {/* Nav */}
      <nav className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
        <Link to="/" className="text-lg font-extrabold tracking-tight">
          Sport<span className="text-blue-500">Stream</span>
        </Link>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link to="/league/new"
                className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition">
                + Create League
              </Link>
              <Link to="/dashboard" className="text-sm text-gray-400 hover:text-white">Dashboard</Link>
            </>
          ) : (
            <Link to="/login"
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition">
              Sign in
            </Link>
          )}
        </div>
      </nav>

      <main className="mx-auto max-w-lg px-5 pt-8 space-y-6">

        {/* Header + stats row */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-white">Leagues</h1>
            <p className="mt-1 text-sm text-gray-500">
              {openCount > 0 && <span className="text-blue-400 font-medium">{openCount} open</span>}
              {openCount > 0 && activeCount > 0 && <span className="text-gray-600"> · </span>}
              {activeCount > 0 && <span className="text-green-400 font-medium">{activeCount} in progress</span>}
              {openCount === 0 && activeCount === 0 && leagues.length > 0 && `${leagues.length} leagues`}
            </p>
          </div>
          <Link to="/find" className="text-xs text-gray-500 hover:text-blue-400 transition">
            Find by code →
          </Link>
        </div>

        {/* Join by code */}
        <div className="card space-y-3">
          <p className="text-sm font-semibold text-gray-300">Have a league code?</p>
          <form onSubmit={handleJoin} className="flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="6-char code"
              maxLength={6}
              className="input flex-1 font-mono tracking-widest uppercase"
            />
            <button type="submit" disabled={joining || joinCode.trim().length < 4}
              className="btn-primary w-auto px-5">
              {joining ? '…' : 'Join'}
            </button>
          </form>
          {joinError && (
            <p className="rounded-xl bg-red-900/40 px-3 py-2 text-xs text-red-300">{joinError}</p>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto">
          {FILTERS.map(({ val, label }) => {
            const count = val === 'all' ? leagues.length : leagues.filter((l) => l.status === val).length
            return (
              <button
                key={val}
                onClick={() => setFilter(val)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                  filter === val
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {label}
                {count > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                    filter === val ? 'bg-blue-500/60 text-blue-100' : 'bg-gray-700 text-gray-500'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* League list */}
        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-800 py-16 text-center">
            <span className="text-3xl">🏅</span>
            <p className="text-sm text-gray-400">
              {filter === 'all'
                ? 'No leagues yet.'
                : `No ${STATUS_CONFIG[filter]?.label.toLowerCase()} leagues.`}
            </p>
            {user && filter === 'all' && (
              <Link to="/league/new"
                className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition">
                Create the first one →
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((league) => {
              const sc = STATUS_CONFIG[league.status] || STATUS_CONFIG.complete
              return (
                <Link
                  key={league.id}
                  to={`/league/${league.id}`}
                  className="group block overflow-hidden rounded-2xl bg-gray-900 ring-1 ring-gray-800 transition hover:ring-gray-700"
                >
                  {/* Cover photo */}
                  {league.photoUrl && (
                    <div className="h-28 w-full overflow-hidden">
                      <img
                        src={league.photoUrl}
                        alt={league.name}
                        className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      {/* Sport + status row */}
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="text-base leading-none">{SPORT_EMOJI[league.sport] || '🏅'}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${sc.cls}`}>
                          {sc.label}
                        </span>
                        {league.maxTeams && (
                          <span className="text-[10px] text-gray-600">
                            max {league.maxTeams}
                          </span>
                        )}
                      </div>

                      {/* Name */}
                      <p className="truncate font-bold text-white leading-tight">{league.name}</p>

                      {/* Meta */}
                      {(league.season || league.location) && (
                        <p className="mt-0.5 truncate text-xs text-gray-500">
                          {[league.season, league.location].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>

                    <span className="shrink-0 text-gray-600 transition group-hover:text-gray-400">›</span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
