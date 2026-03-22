import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { subscribeLiveGames, subscribeUpcomingGames, subscribeRecentFinalGames } from '../firebase/firestore'
import { LiveBadge } from '../components/ui'

const SPORT_EMOJI = {
  basketball: '🏀',
  baseball:   '⚾',
  softball:   '🥎',
  soccer:     '⚽',
  volleyball: '🏐',
  'flag-football': '🏈',
}

const SPORT_FILTERS = [
  { id: 'all',          label: 'All',         emoji: '🏅' },
  { id: 'basketball',   label: 'Basketball',  emoji: '🏀' },
  { id: 'baseball',     label: 'Baseball',    emoji: '⚾' },
  { id: 'softball',     label: 'Softball',    emoji: '🥎' },
  { id: 'soccer',       label: 'Soccer',      emoji: '⚽' },
  { id: 'volleyball',   label: 'Volleyball',  emoji: '🏐' },
  { id: 'flag-football', label: 'Football',   emoji: '🏈' },
]

function StatusBadge({ status }) {
  if (status === 'live') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-900/60 px-2.5 py-0.5 text-[11px] font-bold text-red-300 ring-1 ring-red-800/40">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
        LIVE
      </span>
    )
  }
  if (status === 'final') {
    return (
      <span className="rounded-full bg-gray-700/60 px-2.5 py-0.5 text-[11px] font-semibold text-gray-400">
        Final
      </span>
    )
  }
  return (
    <span className="rounded-full bg-indigo-900/50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-300">
      Upcoming
    </span>
  )
}

function GameCard({ game, showSignIn }) {
  const [copied, setCopied] = useState(false)
  const sportEmoji = SPORT_EMOJI[game.sport] || '🏅'
  const isLive    = game.status === 'live'
  const isFinal   = game.status === 'final'
  const showScore = isLive || isFinal

  const gameUrl = `/game/${game.id}`
  const fullUrl = `${window.location.origin}${gameUrl}`

  function handleShare(e) {
    e.preventDefault()
    e.stopPropagation()
    if (navigator.share) {
      navigator.share({ title: `${game.homeTeam} vs ${game.awayTeam}`, url: fullUrl }).catch(() => {})
    } else {
      navigator.clipboard.writeText(fullUrl).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }

  let dateLabel = ''
  if (game.scheduledAt) {
    const d = new Date(game.scheduledAt)
    dateLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  } else if (game.createdAt?.seconds) {
    const d = new Date(game.createdAt.seconds * 1000)
    dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <Link
      to={gameUrl}
      className="block rounded-2xl bg-[#1a1f2e] ring-1 ring-white/5 overflow-hidden hover:ring-white/10 transition active:scale-[0.99]"
    >
      {/* Header row */}
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-base">{sportEmoji}</span>
          <span className="text-[11px] font-semibold capitalize text-gray-500">{game.sport || 'Sport'}</span>
          {dateLabel && <span className="text-[11px] text-gray-600">· {dateLabel}</span>}
        </div>
        <StatusBadge status={game.status} />
      </div>

      {/* Score / teams */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm truncate">{game.homeTeam || 'Home'}</p>
          {game.clubId && (
            <p className="text-[10px] text-gray-600 truncate">
              <span
                className="hover:text-blue-400 transition"
                onClick={(e) => { e.preventDefault(); window.location.href = `/team/${game.clubId}` }}
              >
                View Team →
              </span>
            </p>
          )}
        </div>

        {showScore ? (
          <div className="mx-4 text-center">
            <p className="text-xl font-extrabold tabular-nums text-white">
              {game.homeScore ?? 0}
              <span className="mx-2 text-gray-600">–</span>
              {game.awayScore ?? 0}
            </p>
          </div>
        ) : (
          <p className="mx-4 text-xs font-bold text-gray-600 uppercase tracking-widest">VS</p>
        )}

        <div className="flex-1 min-w-0 text-right">
          <p className="font-bold text-white text-sm truncate">{game.awayTeam || 'Away'}</p>
          {game.awayClubId && (
            <p className="text-[10px] text-gray-600 truncate">
              <span
                className="hover:text-blue-400 transition"
                onClick={(e) => { e.preventDefault(); window.location.href = `/team/${game.awayClubId}` }}
              >
                View Team →
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Footer: CTA + share */}
      <div className="flex items-center justify-between border-t border-white/5 px-4 py-2.5">
        <span className={`text-sm font-semibold ${isLive ? 'text-green-400' : 'text-blue-400'}`}>
          {isLive ? '▶ Watch Live' : isFinal ? 'View Scorecard' : '📅 View Preview'}
        </span>
        <button
          onClick={handleShare}
          className="text-[11px] font-semibold text-gray-600 hover:text-gray-300 transition"
        >
          {copied ? '✓ Copied!' : '↑ Share'}
        </button>
      </div>
    </Link>
  )
}

function SectionHeader({ title, count }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{title}</p>
      {count !== undefined && (
        <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
          {count}
        </span>
      )}
    </div>
  )
}

export default function GamesPage() {
  const { user } = useAuth()

  const [liveGames,     setLiveGames]     = useState([])
  const [upcomingGames, setUpcomingGames] = useState([])
  const [recentGames,   setRecentGames]   = useState([])
  const [sportFilter,   setSportFilter]   = useState('all')
  const [search,        setSearch]        = useState('')
  const [showAllRecent, setShowAllRecent] = useState(false)

  useEffect(() => {
    const u1 = subscribeLiveGames(setLiveGames)
    const u2 = subscribeUpcomingGames(setUpcomingGames)
    const u3 = subscribeRecentFinalGames(setRecentGames)
    return () => { u1(); u2(); u3() }
  }, [])

  function filterGames(games) {
    let filtered = games
    if (sportFilter !== 'all') {
      filtered = filtered.filter((g) => g.sport === sportFilter)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      filtered = filtered.filter(
        (g) =>
          (g.homeTeam || '').toLowerCase().includes(q) ||
          (g.awayTeam || '').toLowerCase().includes(q) ||
          (g.joinCode || '').toLowerCase().includes(q)
      )
    }
    return filtered
  }

  const filteredLive     = filterGames(liveGames)
  const filteredUpcoming = filterGames(upcomingGames)
  const filteredRecent   = filterGames(recentGames)
  const visibleRecent    = showAllRecent ? filteredRecent : filteredRecent.slice(0, 6)

  const totalGames = filteredLive.length + filteredUpcoming.length + filteredRecent.length

  return (
    <div className="min-h-screen bg-[#0f1117] pb-20 text-white">

      {/* Nav */}
      <nav className="flex items-center justify-between border-b border-white/5 px-5 py-4">
        <Link to="/" className="text-lg font-extrabold tracking-tight">
          Sport<span className="text-blue-500">Stream</span>
        </Link>
        <div className="flex items-center gap-3">
          {user ? (
            <Link to="/dashboard" className="text-sm text-gray-400 hover:text-white">Dashboard</Link>
          ) : (
            <Link to="/login" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
              Sign in
            </Link>
          )}
        </div>
      </nav>

      {/* Hero */}
      <div className="border-b border-white/5 bg-[#1a1f2e] px-5 py-8 text-center">
        <div className="mx-auto max-w-lg">
          <p className="text-3xl font-extrabold text-white leading-tight">
            Watch live sports scores<br />
            <span className="text-blue-400">in real time</span>
          </p>
          <p className="mt-2 text-sm text-gray-400">
            Browse games across every sport. No account needed — just click and watch.
          </p>

          {/* Search */}
          <div className="mt-5">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by team name or game code…"
              className="input w-full max-w-sm"
            />
          </div>
        </div>
      </div>

      {/* Sport filter tabs */}
      <div className="border-b border-white/5 px-4 py-3">
        <div className="mx-auto max-w-2xl">
          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
            {SPORT_FILTERS.map((sf) => (
              <button
                key={sf.id}
                onClick={() => setSportFilter(sf.id)}
                className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  sportFilter === sf.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
              >
                {sf.emoji} {sf.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-8 px-4 py-6">

        {/* Live games */}
        {filteredLive.length > 0 && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Live Now</p>
              <LiveBadge />
              <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                {filteredLive.length}
              </span>
            </div>
            <div className="space-y-3">
              {filteredLive.map((g) => <GameCard key={g.id} game={g} />)}
            </div>
          </section>
        )}

        {/* Upcoming games */}
        {filteredUpcoming.length > 0 && (
          <section>
            <SectionHeader title="Upcoming" count={filteredUpcoming.length} />
            <div className="space-y-3">
              {filteredUpcoming.map((g) => <GameCard key={g.id} game={g} />)}
            </div>
          </section>
        )}

        {/* Recent / Final games */}
        {filteredRecent.length > 0 && (
          <section>
            <SectionHeader title="Recent Results" count={filteredRecent.length} />
            <div className="space-y-3">
              {visibleRecent.map((g) => <GameCard key={g.id} game={g} />)}
            </div>
            {filteredRecent.length > 6 && (
              <button
                onClick={() => setShowAllRecent((v) => !v)}
                className="mt-3 w-full rounded-xl bg-gray-800 py-2 text-xs font-semibold text-gray-400 hover:bg-gray-700 hover:text-white transition"
              >
                {showAllRecent ? '▲ Show less' : `▼ Show all ${filteredRecent.length} results`}
              </button>
            )}
          </section>
        )}

        {/* Empty state */}
        {totalGames === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center">
            <p className="text-2xl mb-2">🏅</p>
            <p className="text-sm font-semibold text-gray-400">No games found</p>
            <p className="mt-1 text-xs text-gray-600">
              {search || sportFilter !== 'all'
                ? 'Try a different filter or search term.'
                : 'No games are currently scheduled or live.'}
            </p>
            {!user && (
              <div className="mt-5">
                <Link to="/login" className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition">
                  Create your team →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* CTA for non-logged-in users */}
        {!user && totalGames > 0 && (
          <div className="rounded-2xl border border-blue-800/30 bg-blue-950/20 p-5 text-center">
            <p className="text-sm font-bold text-white">Running a team?</p>
            <p className="mt-1 text-xs text-gray-400">
              Create a free account to track your team, score games live, and build a fan base.
            </p>
            <Link
              to="/login"
              className="mt-4 inline-block rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition"
            >
              Get started free →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
