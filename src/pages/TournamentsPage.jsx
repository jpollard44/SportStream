import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { subscribeToOpenTournaments, getTournamentByJoinCode } from '../firebase/tournaments'

const SPORT_EMOJI = {
  basketball: '🏀', baseball: '⚾', softball: '🥎',
  soccer: '⚽', volleyball: '🏐', 'flag-football': '🏈',
}

const STATUS_CONFIG = {
  registration: { label: 'Open',        cls: 'bg-green-900/60 text-green-300' },
  active:       { label: 'In Progress', cls: 'bg-blue-900/60 text-blue-300' },
  complete:     { label: 'Completed',   cls: 'bg-gray-800 text-gray-400' },
}

export default function TournamentsPage() {
  const { user } = useAuth()
  const navigate  = useNavigate()
  const [tournaments, setTournaments] = useState([])
  const [code, setCode]               = useState('')
  const [searching, setSearching]     = useState(false)
  const [codeErr, setCodeErr]         = useState('')

  useEffect(() => {
    return subscribeToOpenTournaments(setTournaments)
  }, [])

  const openCount = tournaments.filter((t) => t.status === 'registration').length

  async function handleJoinByCode(e) {
    e.preventDefault()
    if (!code.trim()) return
    setSearching(true)
    setCodeErr('')
    try {
      const tour = await getTournamentByJoinCode(code.trim())
      if (!tour) { setCodeErr('Tournament not found. Check the code and try again.'); return }
      navigate(`/tournament/${tour.id}/join`)
    } finally {
      setSearching(false)
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
              <Link to="/tournament/new"
                className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition">
                + Host Tournament
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

        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-white">Tournaments</h1>
            {openCount > 0 && (
              <p className="mt-1 text-sm">
                <span className="font-medium text-green-400">{openCount} open</span>
                <span className="text-gray-500"> — accepting registrations</span>
              </p>
            )}
          </div>
          <Link to="/find" className="text-xs text-gray-500 hover:text-blue-400 transition">
            Find by code →
          </Link>
        </div>

        {/* Join by code */}
        <div className="card space-y-3">
          <p className="text-sm font-semibold text-gray-300">Have a tournament code?</p>
          <form onSubmit={handleJoinByCode} className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="6-char code"
              maxLength={6}
              className="input flex-1 font-mono tracking-widest uppercase"
            />
            <button type="submit" disabled={searching || !code.trim()} className="btn-primary w-auto px-5">
              {searching ? '…' : 'Find'}
            </button>
          </form>
          {codeErr && (
            <p className="rounded-xl bg-red-900/40 px-3 py-2 text-xs text-red-300">{codeErr}</p>
          )}
        </div>

        {/* Tournament list */}
        <div>
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-gray-500">
            Open Tournaments
          </h2>
          {tournaments.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-800 py-16 text-center">
              <span className="text-3xl">🏆</span>
              <p className="text-sm text-gray-400">No open tournaments right now.</p>
              {user && (
                <Link to="/tournament/new"
                  className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition">
                  Host one →
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {tournaments.map((t) => {
                const sc = STATUS_CONFIG[t.status] || STATUS_CONFIG.complete
                return (
                  <Link
                    key={t.id}
                    to={`/tournament/${t.id}`}
                    className="group block overflow-hidden rounded-2xl bg-gray-900 ring-1 ring-gray-800 transition hover:ring-gray-700"
                  >
                    {t.photoUrl && (
                      <div className="h-28 w-full overflow-hidden">
                        <img
                          src={t.photoUrl}
                          alt={t.name}
                          className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                        />
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex items-center gap-2">
                          <span className="text-base leading-none">{SPORT_EMOJI[t.sport] || '🏅'}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${sc.cls}`}>
                            {sc.label}
                          </span>
                          <span className="text-[10px] capitalize text-gray-600">
                            {t.format?.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="truncate font-bold text-white">{t.name}</p>
                        {(t.location || t.startDate) && (
                          <p className="mt-0.5 truncate text-xs text-gray-500">
                            {[t.location, t.startDate].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="font-mono text-xs tracking-widest text-gray-600">{t.joinCode}</span>
                        <span className="text-gray-600 transition group-hover:text-gray-400">›</span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
