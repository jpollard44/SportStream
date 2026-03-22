import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  getClub, getPlayers, subscribeToTeamGames, subscribeToUser,
  followClub, unfollowClub, getGamePlays, followPlayer, unfollowPlayer,
  getHeadToHead, getRecentResults, getClubRecord,
} from '../firebase/firestore'
import { formatDate, nickDisplay } from '../lib/formatters'
import {
  computeBasketballStats, mergeBasketballStats,
  computeBaseballStats, mergeBaseballStats,
  battingAvg, isBaseballSport,
} from '../lib/statsHelpers'
import { PageSpinner, LiveBadge, AppBadge, LiveDot, ScorekeeperLinkChip } from '../components/ui'
import SponsorBanner from '../components/SponsorBanner'
import { useLiveGamePlayers } from '../hooks/useLiveGamePlayers'

function computeRecord(games, clubId) {
  let W = 0, L = 0, T = 0
  for (const g of games) {
    if (g.status !== 'final') continue
    const isHome  = g.clubId === clubId
    const myScore = isHome ? g.homeScore : g.awayScore
    const oppScore = isHome ? g.awayScore : g.homeScore
    if (myScore > oppScore) W++
    else if (oppScore > myScore) L++
    else T++
  }
  return { W, L, T }
}

const SPORT_EMOJI = {
  basketball: '🏀', baseball: '⚾', softball: '🥎',
  soccer: '⚽', volleyball: '🏐', 'flag-football': '🏈',
}

function WLDotsTP({ results }) {
  if (!results?.length) return null
  return (
    <div className="flex items-center gap-1">
      {results.map((r, i) => (
        <span key={i} className={`h-2.5 w-2.5 rounded-full ${r.win ? 'bg-green-400' : 'bg-red-500'}`} />
      ))}
    </div>
  )
}

function TeamPagePreviewCard({ game, clubId, oppClubId }) {
  const [myRecord, setMyRecord] = useState(null)
  const [oppRecord, setOppRecord] = useState(null)
  const [myResults, setMyResults] = useState([])
  const [oppResults, setOppResults] = useState([])
  const [h2h, setH2h] = useState(null)

  useEffect(() => {
    getClubRecord(clubId).then(setMyRecord).catch(() => {})
    getRecentResults(clubId).then(setMyResults).catch(() => {})
    getClubRecord(oppClubId).then(setOppRecord).catch(() => {})
    getRecentResults(oppClubId).then(setOppResults).catch(() => {})
    getHeadToHead(clubId, oppClubId).then(setH2h).catch(() => {})
  }, [clubId, oppClubId])

  const isHome = game.clubId === clubId
  const myTeam  = isHome ? game.homeTeam : game.awayTeam
  const oppTeam = isHome ? game.awayTeam : game.homeTeam

  const h2hLabel = h2h && h2h.total > 0
    ? h2h.w1 > h2h.w2 ? `You lead ${h2h.w1}–${h2h.w2}`
      : h2h.w2 > h2h.w1 ? `They lead ${h2h.w2}–${h2h.w1}`
      : `${h2h.w1}–${h2h.w2} all time`
    : null

  const msUntil = game.scheduledAt ? new Date(game.scheduledAt).getTime() - Date.now() : null
  const isWithin24h = msUntil !== null && msUntil > 0 && msUntil < 24 * 60 * 60 * 1000

  return (
    <Link to={`/game/${game.id}`} className="block rounded-2xl bg-[#1a1f2e] ring-1 ring-white/5 overflow-hidden hover:ring-white/10 transition">
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-white/5">
        <span className="text-xs font-semibold text-indigo-400">
          {game.scheduledAt
            ? new Date(game.scheduledAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
              ' · ' + new Date(game.scheduledAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
            : 'Date TBD'}
        </span>
        <div className="flex items-center gap-2">
          {isWithin24h && (
            <span className="rounded-full bg-orange-900/50 px-2 py-0.5 text-[10px] font-bold text-orange-300">
              ⏱ {Math.floor(msUntil / 3600000)}h away
            </span>
          )}
          <span className="text-base">☀️</span>
        </div>
      </div>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm truncate">{myTeam}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {myRecord && <span className="text-[11px] text-gray-400">{myRecord.w}-{myRecord.l}</span>}
            <WLDotsTP results={myResults} />
          </div>
        </div>
        <span className="mx-3 text-xs font-semibold text-gray-600">VS</span>
        <div className="flex-1 min-w-0 text-right">
          <p className="font-bold text-white text-sm truncate">{oppTeam}</p>
          <div className="flex items-center justify-end gap-2 mt-0.5">
            {oppRecord && <span className="text-[11px] text-gray-400">{oppRecord.w}-{oppRecord.l}</span>}
            <WLDotsTP results={oppResults} />
          </div>
        </div>
      </div>
      {(game.venue || h2hLabel) && (
        <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
          {game.venue && <span className="text-[11px] text-gray-500">📍 {game.venue}</span>}
          {h2hLabel && <span className="text-[11px] font-semibold text-yellow-500/80">H2H: {h2hLabel}</span>}
        </div>
      )}
    </Link>
  )
}

export default function TeamPage() {
  const { clubId } = useParams()
  const { user } = useAuth()

  const [club, setClub]         = useState(null)
  const [players, setPlayers]   = useState([])
  const [games, setGames]       = useState([])
  const [userDoc, setUserDoc]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [followLoading, setFollowLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('games')
  const [copied, setCopied]     = useState(false)
  const [copiedGameId, setCopiedGameId] = useState(null)
  const [showSignInPrompt, setShowSignInPrompt] = useState(false)

  // Stats tab state
  const [seasonStats, setSeasonStats] = useState(null)   // merged map
  const [loadingStats, setLoadingStats] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([getClub(clubId), getPlayers(clubId)]).then(([c, p]) => {
      setClub(c)
      setPlayers(p)
      setLoading(false)
    })
    return subscribeToTeamGames(clubId, setGames)
  }, [clubId])

  useEffect(() => {
    if (!user) return
    return subscribeToUser(user.uid, setUserDoc)
  }, [user])

  // Load season stats lazily when stats tab is selected
  useEffect(() => {
    if (activeTab !== 'stats' || seasonStats || loadingStats || !club) return
    const finalGames = games.filter((g) => g.status === 'final')
    if (!finalGames.length) { setSeasonStats({}); return }

    setLoadingStats(true)
    const isBaseball = isBaseballSport(club.sport)
    Promise.all(finalGames.map((g) => getGamePlays(g.id)))
      .then((allPlays) => {
        const perGame = allPlays.map((plays) =>
          isBaseball ? computeBaseballStats(plays) : computeBasketballStats(plays)
        )
        const merged = isBaseball
          ? mergeBaseballStats(perGame)
          : mergeBasketballStats(perGame)
        setSeasonStats(merged)
      })
      .finally(() => setLoadingStats(false))
  }, [activeTab, club, games, seasonStats, loadingStats])

  const { livePlayerIds, liveGameId: liveGameIdForRoster } = useLiveGamePlayers(clubId)

  const isFollowing  = userDoc?.followedClubs?.includes(clubId) ?? false
  const liveGame     = games.find((g) => g.status === 'live')
  const liveGames    = games.filter((g) => g.status === 'live')
  const { W, L, T }  = computeRecord(games, clubId)
  const finalGames   = games.filter((g) => g.status === 'final')
  const upcomingGames = games.filter((g) => g.status === 'setup')

  async function handleToggleFollow() {
    if (!user) { setShowSignInPrompt(true); return }
    setFollowLoading(true)
    try {
      if (isFollowing) await unfollowClub(user.uid, clubId)
      else await followClub(user.uid, clubId)
    } finally { setFollowLoading(false) }
  }

  function handleShare() {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <PageSpinner />

  if (!club) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#0f1117] text-gray-400">
        <p>Team not found.</p>
        <Link to="/" className="text-blue-400">← Home</Link>
      </div>
    )
  }

  const sportEmoji = SPORT_EMOJI[club.sport] || '🏅'
  const isBaseball  = isBaseballSport(club.sport)
  const isOwner = user?.uid === club.ownerId || club.adminIds?.includes(user?.uid)

  function copyScoreKeeperLink(gameId) {
    const url = `${window.location.origin}/scorekeeper/${gameId}`
    navigator.clipboard.writeText(url).catch(() => {})
    setCopiedGameId(gameId)
    setTimeout(() => setCopiedGameId(null), 2000)
  }

  const tabs = [
    { id: 'games',  label: `Games (${games.length})` },
    { id: 'stats',  label: 'Stats' },
    { id: 'roster', label: `Roster (${players.length})` },
  ]

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

      {/* Team header */}
      <div className="border-b border-white/5 bg-[#1a1f2e] px-5 py-6">
        <div className="mx-auto max-w-lg">
          <div className="mb-3 flex items-center gap-2">
            {club.logoUrl ? (
              <img src={club.logoUrl} alt={club.name} className="h-10 w-10 rounded-full object-cover ring-2 ring-gray-700" />
            ) : (
              <span className="text-2xl">{sportEmoji}</span>
            )}
            <span className="rounded-full bg-[#242938] px-3 py-1 text-xs font-semibold capitalize text-gray-300">
              {club.sport}
            </span>
            {liveGame && (
              <LiveBadge />
            )}
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-extrabold text-white">
                {club.name}
                {liveGame && <LiveDot title="Live game in progress" />}
              </h1>
              {finalGames.length > 0 ? (
                <div className="mt-2 flex items-center gap-4">
                  <span className="text-2xl font-extrabold text-white">{W}–{L}</span>
                  {T > 0 && <span className="text-lg font-bold text-gray-500">–{T}</span>}
                  <span className="text-xs text-gray-500">season record</span>
                </div>
              ) : (
                <p className="mt-1 text-sm text-gray-500">No games played yet</p>
              )}
              {finalGames.length > 0 && (
                <div className="mt-2 flex gap-4 text-sm">
                  <span className="font-semibold text-green-400">{W} W</span>
                  <span className="font-semibold text-red-400">{L} L</span>
                  {T > 0 && <span className="font-semibold text-gray-400">{T} T</span>}
                  <span className="text-gray-600">
                    {finalGames.length ? `${Math.round((W / finalGames.length) * 100)}% win` : ''}
                  </span>
                </div>
              )}
            </div>

            <div className="flex shrink-0 flex-col gap-2">
              <button
                onClick={handleToggleFollow}
                disabled={followLoading}
                className={`rounded-xl px-5 py-2.5 text-sm font-bold transition active:scale-95 disabled:opacity-60 ${
                  isFollowing
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-blue-600 text-white hover:bg-blue-500'
                }`}
              >
                {followLoading ? '…' : isFollowing ? '✓ Fan' : '+ Become a Fan'}
              </button>
              <button
                onClick={handleShare}
                className="rounded-xl bg-gray-800 px-5 py-2 text-xs font-semibold text-gray-400 transition hover:text-white"
              >
                {copied ? '✓ Copied!' : '↑ Share'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sponsor banner */}
      <SponsorBanner doc={club} isHost={user?.uid === club?.ownerId || club?.adminIds?.includes(user?.uid)} />

      {/* Live game banner */}
      {liveGame && (
        <div className="border-b border-green-900/40 bg-green-950/30 px-5 py-3">
          <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
                <span className="text-sm font-bold text-green-300">Game in progress</span>
              </div>
              <p className="truncate text-xs text-gray-400">
                {liveGame.homeTeam} {liveGame.homeScore} – {liveGame.awayScore} {liveGame.awayTeam}
              </p>
            </div>
            <Link to={`/game/${liveGame.id}`}
              className="shrink-0 rounded-xl bg-green-700 px-4 py-2 text-sm font-bold text-white hover:bg-green-600">
              Watch →
            </Link>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="sticky top-0 z-10 flex border-b border-white/5 bg-[#0f1117]/95 backdrop-blur">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`relative flex-1 py-3 text-sm font-semibold transition ${
              activeTab === id ? 'text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {label}
            {activeTab === id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-blue-500" />
            )}
          </button>
        ))}
      </div>

      <div className="mx-auto max-w-lg px-5 pt-5">

        {/* ── Games tab ── */}
        {activeTab === 'games' && (
          <div className="space-y-6">
            {games.length === 0 && (
              <p className="py-12 text-center text-sm text-gray-500">No games yet.</p>
            )}

            {/* Live Now */}
            {liveGames.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-green-500">● Live Now</p>
                <div className="space-y-2">
                  {liveGames.map((g) => {
                    const isHome = g.clubId === clubId
                    const myScore = isHome ? g.homeScore : g.awayScore
                    const oppScore = isHome ? g.awayScore : g.homeScore
                    const opponent = isHome ? g.awayTeam : g.homeTeam
                    return (
                      <div key={g.id} className="rounded-2xl bg-[#1a1f2e] border-l-2 border-green-500">
                        <Link to={`/game/${g.id}`}
                          className="flex items-center justify-between px-4 py-3.5 transition hover:bg-[#242938] rounded-2xl">
                          <div className="min-w-0">
                            <div className="mb-1 flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-900/60 px-2 py-0.5 text-[10px] font-bold text-green-300">
                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                                LIVE
                              </span>
                            </div>
                            <p className="truncate text-sm font-semibold text-white">
                              vs. <span className="text-gray-300">{opponent}</span>
                            </p>
                          </div>
                          <div className="ml-4 flex shrink-0 items-center gap-3">
                            <p className="font-mono text-lg font-bold text-white">{myScore}–{oppScore}</p>
                            <span className="text-gray-600">›</span>
                          </div>
                        </Link>
                        {isOwner && g.joinCode && (
                          <div className="px-4 pb-3">
                            <ScorekeeperLinkChip
                              gameId={g.id}
                              joinCode={g.joinCode}
                              copied={copiedGameId === g.id}
                              onCopy={() => copyScoreKeeperLink(g.id)}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Upcoming */}
            {upcomingGames.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">Upcoming</p>
                <div className="space-y-2">
                  {upcomingGames.map((g) => {
                    const isHome = g.clubId === clubId
                    const myClubId = isHome ? g.clubId : g.awayClubId
                    const oppClubId = isHome ? g.awayClubId : g.clubId
                    if (myClubId && oppClubId) {
                      return <TeamPagePreviewCard key={g.id} game={g} clubId={myClubId} oppClubId={oppClubId} />
                    }
                    const opponent = isHome ? g.awayTeam : g.homeTeam
                    return (
                      <div key={g.id} className="rounded-2xl bg-[#1a1f2e]">
                        <Link to={`/game/${g.id}`}
                          className="flex items-center justify-between px-4 py-3.5 transition hover:bg-[#242938] rounded-2xl">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">
                              vs. <span className="text-gray-300">{opponent}</span>
                            </p>
                            {g.scheduledAt
                              ? <p className="text-xs text-indigo-400">{new Date(g.scheduledAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {new Date(g.scheduledAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
                              : <p className="text-xs text-gray-500">{formatDate(g.createdAt)}</p>
                            }
                          </div>
                          <span className="ml-4 shrink-0 rounded-full bg-gray-800 px-3 py-1 text-xs font-semibold text-gray-400">
                            {g.status === 'setup' ? 'Ready' : 'Scheduled'}
                          </span>
                        </Link>
                        {isOwner && g.joinCode && (
                          <div className="px-4 pb-3">
                            <ScorekeeperLinkChip
                              gameId={g.id}
                              joinCode={g.joinCode}
                              copied={copiedGameId === g.id}
                              onCopy={() => copyScoreKeeperLink(g.id)}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Completed */}
            {finalGames.length > 0 && (
              <div>
                {upcomingGames.length > 0 && (
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">Results</p>
                )}
                <div className="space-y-2">
                  {finalGames.map((g) => {
                    const isHome   = g.clubId === clubId
                    const myScore  = isHome ? g.homeScore : g.awayScore
                    const oppScore = isHome ? g.awayScore : g.homeScore
                    const opponent = isHome ? g.awayTeam : g.homeTeam
                    const won  = myScore > oppScore
                    const lost = myScore < oppScore
                    return (
                      <Link key={g.id} to={`/game/${g.id}`}
                        className="flex items-center justify-between rounded-2xl bg-[#1a1f2e] px-4 py-3.5 transition hover:bg-[#242938]">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              won ? 'bg-green-900/50 text-green-300' : lost ? 'bg-red-900/30 text-red-400' : 'bg-gray-800 text-gray-500'
                            }`}>
                              {won ? 'W' : lost ? 'L' : 'T'}
                            </span>
                          </div>
                          <p className="truncate text-sm font-semibold text-white">
                            vs. <span className="text-gray-300">{opponent}</span>
                          </p>
                          <p className="text-xs text-gray-500">{formatDate(g.createdAt)}</p>
                        </div>
                        <div className="ml-4 flex shrink-0 items-center gap-3">
                          <p className="font-mono text-lg font-bold text-white">{myScore}–{oppScore}</p>
                          <span className="text-gray-600">›</span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Stats tab ── */}
        {activeTab === 'stats' && (
          <SeasonStatsPanel
            club={club}
            clubId={clubId}
            games={games}
            isBaseball={isBaseball}
            seasonStats={seasonStats}
            loadingStats={loadingStats}
          />
        )}

        {/* ── Roster tab ── */}
        {activeTab === 'roster' && (
          <div className="space-y-2">
            {players.length === 0 && (
              <p className="py-12 text-center text-sm text-gray-500">No roster published yet.</p>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {players.map((p) => {
                const pIsFollowing = userDoc?.followedPlayers?.some((fp) => fp.playerId === p.id) ?? false
                return (
                  <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-[#1a1f2e] px-4 py-3">
                    <Link to={`/player/${clubId}/${p.id}`} className="relative shrink-0">
                      {p.photoUrl ? (
                        <img src={p.photoUrl} alt={p.name} className="h-10 w-10 rounded-full object-cover ring-1 ring-gray-700 hover:ring-blue-500 transition" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-900/50 hover:bg-blue-800/60 transition">
                          <span className="text-lg font-extrabold text-blue-300 leading-none">{p.number || '?'}</span>
                        </div>
                      )}
                      {p.number && p.photoUrl && (
                        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#0f1117] ring-1 ring-blue-700 text-[10px] font-extrabold text-blue-400">
                          {p.number}
                        </span>
                      )}
                    </Link>
                    <Link to={`/player/${clubId}/${p.id}`} className="min-w-0 flex-1">
                      {p.nickname ? (
                        <>
                          <p className="truncate font-bold text-white hover:text-blue-300 transition">"{p.nickname}"</p>
                          <p className="truncate text-xs text-gray-400">{p.name}{p.position ? ` · ${p.position}` : ''}</p>
                        </>
                      ) : (
                        <>
                          <p className="truncate font-semibold text-white hover:text-blue-300 transition">{p.name}</p>
                          {p.position && <p className="text-xs text-gray-500">{p.position}</p>}
                        </>
                      )}
                    </Link>
                    {livePlayerIds.has(p.id) && (
                      <span title="In live game" className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-green-400" />
                    )}
                    <button
                      onClick={async () => {
                        if (!user) { setShowSignInPrompt(true); return }
                        if (pIsFollowing) {
                          await unfollowPlayer(user.uid, p.id)
                        } else {
                          await followPlayer(user.uid, {
                            playerId: p.id, clubId, name: p.name, nickname: p.nickname || '',
                            number: p.number || '', photoUrl: p.photoUrl || '',
                            position: p.position || '', clubName: club.name, clubSport: club.sport,
                          })
                        }
                      }}
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${
                        pIsFollowing
                          ? 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                          : 'bg-blue-900/50 text-blue-300 hover:bg-blue-800'
                      }`}
                    >
                      {pIsFollowing ? '✓ Fan' : '+ Fan'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Sign-in prompt */}
      {showSignInPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6"
          onClick={() => setShowSignInPrompt(false)}>
          <div className="w-full max-w-xs rounded-2xl bg-[#1a1f2e] p-6 text-center"
            onClick={(e) => e.stopPropagation()}>
            <p className="mb-1 text-lg font-bold text-white">Sign in to become a fan</p>
            <p className="mb-5 text-sm text-gray-400">
              Create a free account to become a fan of {club.name} and get notified when they go live.
            </p>
            <Link to="/login" className="btn-primary mb-3 block">Sign in / Sign up →</Link>
            <button onClick={() => setShowSignInPrompt(false)} className="text-sm text-gray-500 hover:text-white">
              Maybe later
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Season Stats Panel ────────────────────────────────────────────────────────

function SeasonStatsPanel({ club, clubId, games, isBaseball, seasonStats, loadingStats }) {
  const finalCount = games.filter((g) => g.status === 'final').length

  if (!finalCount) {
    return <p className="py-16 text-center text-sm text-gray-500">No completed games yet.</p>
  }

  if (loadingStats) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  if (!seasonStats || !Object.keys(seasonStats).length) {
    return <p className="py-16 text-center text-sm text-gray-500">No player stats recorded yet.</p>
  }

  const rows = Object.values(seasonStats)

  if (isBaseball) {
    const sorted = rows.sort((a, b) => b.h - a.h || b.rbi - a.rbi)
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Season Batting</p>
          <p className="text-[10px] text-gray-600">{finalCount} games</p>
        </div>
        <div className="overflow-x-auto rounded-2xl bg-[#1a1f2e]">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-600">
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-2 py-2 text-left">Player</th>
                <th className="px-2 py-2 text-center">GP</th>
                <th className="px-2 py-2 text-center">AB</th>
                <th className="px-2 py-2 text-center">H</th>
                <th className="px-2 py-2 text-center">HR</th>
                <th className="px-2 py-2 text-center">RBI</th>
                <th className="px-2 py-2 text-center">BB</th>
                <th className="px-2 py-2 text-center">K</th>
                <th className="px-2 py-2 text-center">AVG</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <tr key={s.id || s.name} className="border-t border-white/5 text-white">
                  <td className="px-3 py-2 font-mono text-gray-400">{s.number || '—'}</td>
                  <td className="whitespace-nowrap px-2 py-2 font-medium">
                    {s.id ? (
                      <Link to={`/player/${clubId}/${s.id}`} className="hover:text-blue-300 transition">{s.name}</Link>
                    ) : s.name}
                  </td>
                  <td className="px-2 py-2 text-center text-gray-500">{s.gp}</td>
                  <td className="px-2 py-2 text-center text-gray-400">{s.ab}</td>
                  <td className="px-2 py-2 text-center font-bold">{s.h}</td>
                  <td className="px-2 py-2 text-center text-gray-400">{s.hr}</td>
                  <td className="px-2 py-2 text-center text-gray-400">{s.rbi}</td>
                  <td className="px-2 py-2 text-center text-gray-400">{s.bb}</td>
                  <td className="px-2 py-2 text-center text-gray-400">{s.k}</td>
                  <td className="px-2 py-2 text-center font-mono font-bold text-blue-400">
                    {battingAvg(s.h, s.ab)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // Basketball
  const sorted = rows.sort((a, b) => b.pts - a.pts)
  const topScorer = sorted[0]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Season Stats</p>
        <p className="text-[10px] text-gray-600">{finalCount} games</p>
      </div>

      {/* Stat leaders */}
      {topScorer && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'PPG', key: 'pts', fmt: (v, gp) => (v / gp).toFixed(1) },
            { label: 'RPG', key: 'reb', fmt: (v, gp) => (v / gp).toFixed(1) },
            { label: 'APG', key: 'ast', fmt: (v, gp) => (v / gp).toFixed(1) },
          ].map(({ label, key, fmt }) => {
            const leader = rows.sort((a, b) => b[key] - a[key])[0]
            return (
              <div key={label} className="rounded-2xl bg-[#1a1f2e] p-3 text-center">
                <p className="text-[9px] font-bold uppercase tracking-wider text-gray-600">{label} Leader</p>
                {leader.id ? (
                  <Link
                    to={`/player/${clubId}/${leader.id}`}
                    className="mt-1 block truncate text-xs font-semibold text-gray-300 hover:text-blue-300 transition hover:underline"
                  >
                    {nickDisplay(leader.name, leader.nickname)}
                  </Link>
                ) : (
                  <p className="mt-1 truncate text-xs font-semibold text-gray-300">
                    {nickDisplay(leader.name, leader.nickname)}
                  </p>
                )}
                <p className="text-2xl font-extrabold text-blue-400">{fmt(leader[key], leader.gp)}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Full table */}
      <div className="overflow-x-auto rounded-2xl bg-[#1a1f2e]">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-600">
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-2 py-2 text-left">Player</th>
              <th className="px-2 py-2 text-center">GP</th>
              <th className="px-2 py-2 text-center">PTS</th>
              <th className="px-2 py-2 text-center">REB</th>
              <th className="px-2 py-2 text-center">AST</th>
              <th className="px-2 py-2 text-center">STL</th>
              <th className="px-2 py-2 text-center">BLK</th>
              <th className="px-2 py-2 text-center">TO</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr key={s.id || s.name} className="border-t border-white/5 text-white">
                <td className="px-3 py-2 font-mono text-gray-400">{s.number || '—'}</td>
                <td className="whitespace-nowrap px-2 py-2 font-medium">
                  {s.id ? (
                    <Link to={`/player/${clubId}/${s.id}`} className="hover:text-blue-300 transition">{s.name}</Link>
                  ) : s.name}
                </td>
                <td className="px-2 py-2 text-center text-gray-500">{s.gp}</td>
                <td className="px-2 py-2 text-center font-extrabold text-blue-400">{s.pts}</td>
                <td className="px-2 py-2 text-center text-gray-400">{s.reb}</td>
                <td className="px-2 py-2 text-center text-gray-400">{s.ast}</td>
                <td className="px-2 py-2 text-center text-gray-400">{s.stl}</td>
                <td className="px-2 py-2 text-center text-gray-400">{s.blk}</td>
                <td className="px-2 py-2 text-center text-gray-400">{s.to}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

