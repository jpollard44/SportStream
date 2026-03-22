import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { searchClubs } from '../firebase/firestore'
import { subscribeToDiscoverHighlights } from '../firebase/highlights'
import { subscribeToOpenTournaments } from '../firebase/tournaments'
import { subscribeToPublicLeagues } from '../firebase/leagues'

const SPORT_EMOJI = {
  basketball: '🏀', baseball: '⚾', softball: '🥎',
  soccer: '⚽', volleyball: '🏐', 'flag-football': '🏈',
}

function HighlightMini({ h }) {
  const initials = (h.playerName || '?').slice(0, 2).toUpperCase()
  return (
    <Link
      to={`/game/${h.gameId}`}
      className="flex items-center gap-3 rounded-2xl bg-[#1a1f2e] px-4 py-3 ring-1 ring-white/5 hover:ring-white/10 transition"
    >
      {h.playerPhoto ? (
        <img src={h.playerPhoto} alt={h.playerName} className="h-9 w-9 shrink-0 rounded-full object-cover" />
      ) : (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-800 to-blue-600 text-xs font-bold text-white">
          {initials}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-white truncate">{h.playDescription}</p>
        <p className="text-xs text-gray-500 truncate">{h.playerName} · {h.clubName}</p>
      </div>
      <div className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
        <span>🔥</span>
        <span>{h.reactionCount || 0}</span>
      </div>
    </Link>
  )
}

function TournamentCard({ t }) {
  return (
    <Link
      to={`/tournament/${t.id}`}
      className="flex-1 min-w-[220px] rounded-2xl bg-[#1a1f2e] p-4 ring-1 ring-white/5 hover:ring-white/10 transition"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{SPORT_EMOJI[t.sport] || '🏅'}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
          t.status === 'active' ? 'bg-green-900/60 text-green-300' : 'bg-blue-900/60 text-blue-300'
        }`}>
          {t.status}
        </span>
      </div>
      <p className="font-bold text-white text-sm truncate">{t.name}</p>
      <p className="text-xs text-gray-500 mt-0.5 capitalize">{t.format?.replace('_', ' ')} · {t.sport}</p>
      {t.location && <p className="text-xs text-gray-600 mt-0.5">📍 {t.location}</p>}
    </Link>
  )
}

function LeagueCard({ l }) {
  return (
    <Link
      to={`/league/${l.id}`}
      className="flex-1 min-w-[220px] rounded-2xl bg-[#1a1f2e] p-4 ring-1 ring-white/5 hover:ring-white/10 transition"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{SPORT_EMOJI[l.sport] || '🏅'}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
          l.status === 'active' ? 'bg-green-900/60 text-green-300' : 'bg-blue-900/60 text-blue-300'
        }`}>
          {l.status}
        </span>
      </div>
      <p className="font-bold text-white text-sm truncate">{l.name}</p>
      <p className="text-xs text-gray-500 mt-0.5 capitalize">{l.sport}</p>
      {l.season && <p className="text-xs text-gray-600 mt-0.5">Season: {l.season}</p>}
    </Link>
  )
}

function SearchResults({ results }) {
  if (!results) return null
  const { clubs = [], tournaments = [], leagues = [] } = results
  const total = clubs.length + tournaments.length + leagues.length
  if (total === 0) return (
    <div className="rounded-2xl bg-[#1a1f2e] px-4 py-6 text-center text-sm text-gray-500 ring-1 ring-white/5">
      No results found
    </div>
  )

  return (
    <div className="space-y-3">
      {clubs.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">Teams</p>
          {clubs.map((c) => (
            <Link key={c.id} to={`/team/${c.id}`}
              className="flex items-center gap-3 rounded-xl bg-[#1a1f2e] px-4 py-3 mb-1 ring-1 ring-white/5 hover:ring-white/10 transition">
              <span className="text-base">{SPORT_EMOJI[c.sport] || '🏅'}</span>
              <div>
                <p className="text-sm font-semibold text-white">{c.name}</p>
                <p className="text-xs text-gray-500 capitalize">{c.sport}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
      {tournaments.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">Tournaments</p>
          {tournaments.map((t) => (
            <Link key={t.id} to={`/tournament/${t.id}`}
              className="flex items-center gap-3 rounded-xl bg-[#1a1f2e] px-4 py-3 mb-1 ring-1 ring-white/5 hover:ring-white/10 transition">
              <span className="text-base">{SPORT_EMOJI[t.sport] || '🏆'}</span>
              <div>
                <p className="text-sm font-semibold text-white">{t.name}</p>
                <p className="text-xs text-gray-500 capitalize">{t.sport} · {t.status}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
      {leagues.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">Leagues</p>
          {leagues.map((l) => (
            <Link key={l.id} to={`/league/${l.id}`}
              className="flex items-center gap-3 rounded-xl bg-[#1a1f2e] px-4 py-3 mb-1 ring-1 ring-white/5 hover:ring-white/10 transition">
              <span className="text-base">{SPORT_EMOJI[l.sport] || '🏅'}</span>
              <div>
                <p className="text-sm font-semibold text-white">{l.name}</p>
                <p className="text-xs text-gray-500 capitalize">{l.sport} · {l.status}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default function DiscoverPage() {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [highlights, setHighlights] = useState([])
  const [tournaments, setTournaments] = useState([])
  const [leagues, setLeagues] = useState([])
  const [tourSearchResults, setTourSearchResults] = useState([])
  const [leagueSearchResults, setLeagueSearchResults] = useState([])

  // Load featured content
  useEffect(() => {
    const unsub = subscribeToDiscoverHighlights((hs) => setHighlights(hs.slice(0, 3)))
    return unsub
  }, [])

  useEffect(() => {
    const unsub = subscribeToOpenTournaments((ts) => setTournaments(ts.slice(0, 6)))
    return unsub
  }, [])

  useEffect(() => {
    const unsub = subscribeToPublicLeagues((ls) => {
      setLeagues(ls.filter((l) => l.status === 'active' || l.status === 'registration').slice(0, 6))
    })
    return unsub
  }, [])

  // Debounced search
  useEffect(() => {
    if (query.length < 2) { setSearchResults(null); return }
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const [clubs, tSearch, lSearch] = await Promise.all([
          searchClubs(query).catch(() => []),
          searchTournaments(query),
          searchLeagues(query),
        ])
        setSearchResults({ clubs, tournaments: tSearch, leagues: lSearch })
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  function searchTournaments(q) {
    const lower = q.toLowerCase()
    return tournaments.filter((t) => t.name?.toLowerCase().includes(lower)).slice(0, 5)
  }

  function searchLeagues(q) {
    const lower = q.toLowerCase()
    return leagues.filter((l) => l.name?.toLowerCase().includes(lower)).slice(0, 5)
  }

  return (
    <div className="min-h-screen bg-[#0f1117] pb-24 text-white">
      {/* Header */}
      <div className="border-b border-white/5 px-5 py-4">
        <h1 className="text-xl font-extrabold text-white">Discover</h1>
        <p className="mt-0.5 text-xs text-gray-500">Find teams, tournaments, leagues, and players</p>
      </div>

      <div className="mx-auto max-w-lg px-4 pt-5 space-y-6">

        {/* Search bar */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search teams, tournaments, leagues…"
            className="w-full rounded-2xl bg-[#1a1f2e] py-3 pl-9 pr-4 text-sm text-white placeholder-gray-600 outline-none ring-1 ring-white/10 focus:ring-blue-500/40"
          />
          {searching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            </span>
          )}
        </div>

        {/* Search results */}
        {query.length >= 2 && (
          <SearchResults results={searchResults} />
        )}

        {/* Default content when not searching */}
        {query.length < 2 && (
          <>
            {/* Top Highlights */}
            {highlights.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-yellow-600">🔥 Top Highlights</p>
                  <Link to="/wall-of-fame" className="text-[10px] text-blue-400 hover:text-blue-300">See all →</Link>
                </div>
                <div className="space-y-2">
                  {highlights.map((h) => <HighlightMini key={h.id} h={h} />)}
                </div>
              </section>
            )}

            {/* Active Tournaments */}
            {tournaments.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">🏆 Active Tournaments</p>
                  <Link to="/tournaments" className="text-[10px] text-blue-400 hover:text-blue-300">See all →</Link>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                  {tournaments.map((t) => <TournamentCard key={t.id} t={t} />)}
                </div>
              </section>
            )}

            {/* Active Leagues */}
            {leagues.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">📋 Active Leagues</p>
                  <Link to="/leagues" className="text-[10px] text-blue-400 hover:text-blue-300">See all →</Link>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                  {leagues.map((l) => <LeagueCard key={l.id} l={l} />)}
                </div>
              </section>
            )}

            {/* Empty state */}
            {highlights.length === 0 && tournaments.length === 0 && leagues.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center">
                <p className="text-3xl mb-3">🔍</p>
                <p className="text-sm text-gray-400">Nothing to show yet.</p>
                <p className="mt-1 text-xs text-gray-600">Use the search bar to find teams and events.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
