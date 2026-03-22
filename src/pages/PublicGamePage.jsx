import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useGame } from '../hooks/useGame'
import { formatClock, periodLabel, inningLabel } from '../lib/formatters'
import {
  BB_HIT_TYPES, BB_AT_BAT_TYPES, BB_PLAY_TYPES,
  describeBaseballPlay,
} from '../lib/baseballHelpers'
import { describePlay } from '../lib/playEventHelpers'
import {
  getPlayerHistoricalPlays, subscribeToUser,
  incrementGameViews, followClub, unfollowClub,
} from '../firebase/firestore'
import { NOTABLE_PLAY_TYPES, getNotablePlayLabel } from '../lib/premium'
import { useAuth } from '../context/AuthContext'
import StreamViewer from '../components/public/StreamViewer'
import BaseDiamond from '../components/scorekeeper/baseball/BaseDiamond'

// ── Stat helpers ──────────────────────────────────────────────────────────────

function computeBaseballStats(plays) {
  const stats = {}
  for (const play of plays) {
    if (!play.playerId) continue
    if (!stats[play.playerId]) {
      stats[play.playerId] = {
        id: play.playerId, name: play.playerName, number: play.playerNumber,
        team: play.team, ab: 0, h: 0, hr: 0, rbi: 0, bb: 0, k: 0,
      }
    }
    const s = stats[play.playerId]
    if (BB_AT_BAT_TYPES.has(play.type)) s.ab += 1
    if (BB_HIT_TYPES.has(play.type)) s.h += 1
    if (play.type === BB_PLAY_TYPES.HOME_RUN) s.hr += 1
    if (play.type === BB_PLAY_TYPES.WALK || play.type === BB_PLAY_TYPES.HIT_BY_PITCH) s.bb += 1
    if (play.type === BB_PLAY_TYPES.STRIKEOUT) s.k += 1
    if (play.points) s.rbi += play.points
  }
  return stats
}

function computeBasketballStats(plays) {
  const stats = {}
  for (const play of plays) {
    if (!play.playerId) continue
    if (!stats[play.playerId]) {
      stats[play.playerId] = {
        id: play.playerId, name: play.playerName, number: play.playerNumber,
        team: play.team, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, foul: 0,
      }
    }
    const s = stats[play.playerId]
    if (play.points) s.pts += play.points
    if (play.type === 'rebound') s.reb += 1
    if (play.type === 'assist') s.ast += 1
    if (play.type === 'steal') s.stl += 1
    if (play.type === 'block') s.blk += 1
    if (play.type === 'foul') s.foul += 1
  }
  return stats
}

function computeLineScore(plays, totalInnings, currentInning) {
  const maxInning = Math.max(totalInnings || 9, currentInning || 1)
  const grid = {}
  for (let i = 1; i <= maxInning; i++) grid[i] = { home: 0, away: 0 }
  for (const play of plays) {
    if (!play.points || !play.inning) continue
    if (!grid[play.inning]) grid[play.inning] = { home: 0, away: 0 }
    grid[play.inning][play.team] += play.points
  }
  return { grid, maxInning }
}

function computePeriodScores(plays, totalPeriods) {
  const grid = {}
  for (let p = 1; p <= (totalPeriods || 4); p++) grid[p] = { home: 0, away: 0 }
  for (const play of plays) {
    if (!play.points || !play.period) continue
    if (!grid[play.period]) grid[play.period] = { home: 0, away: 0 }
    grid[play.period][play.team] += play.points
  }
  return grid
}

function groupPlays(plays, isBaseball) {
  // Returns [{key, label, battingTeamHalf, plays}] in newest-first order
  const groups = []
  const keyMap = new Map()
  for (const play of plays) {
    const key = isBaseball
      ? `${play.inning ?? '?'}-${play.inningHalf ?? 'top'}`
      : String(play.period ?? 1)
    if (!keyMap.has(key)) {
      const group = { key, plays: [] }
      keyMap.set(key, group)
      groups.push(group)
    }
    keyMap.get(key).plays.push(play)
  }
  return groups
}

function avg(h, ab) {
  if (!ab) return '.000'
  return '.' + Math.round((h / ab) * 1000).toString().padStart(3, '0')
}

function isBaseballGame(game) {
  return game.sport === 'baseball' || game.sport === 'softball'
}

function ShareButton({ url, joinCode, label = 'Share' }) {
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    const shareUrl = url || window.location.href
    const text = joinCode ? `Watch live — join code: ${joinCode}` : 'Watch live on SportStream'
    if (navigator.share) {
      try {
        await navigator.share({ title: 'SportStream Game', text, url: shareUrl })
        return
      } catch (_) { /* fall through to clipboard */ }
    }
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (_) {}
  }

  return (
    <button
      onClick={handleShare}
      className="flex-shrink-0 text-xs text-blue-400 hover:text-blue-300 transition"
    >
      {copied ? '✓ Copied!' : label}
    </button>
  )
}

// Returns the first word of a name (first name / nickname display)
function shortName(name) {
  if (!name) return ''
  return name.split(' ')[0]
}

// ── Fan Strip ─────────────────────────────────────────────────────────────────

function FanStrip({ game, user, followedClubs, onFollow }) {
  const hasHome = !!game.clubId
  const hasAway = !!game.awayClubId
  if (!hasHome && !hasAway) return null

  function FanButton({ clubId, name }) {
    const isFan = followedClubs.includes(clubId)
    return (
      <button
        onClick={() => onFollow(clubId)}
        className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition ${
          isFan
            ? 'bg-blue-700 text-white'
            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
        }`}
        title={isFan ? `Unfollow ${name}` : `Become a fan of ${name}`}
      >
        {isFan ? '★ Fan' : '☆ Be a Fan'}
        <span className="hidden sm:inline ml-1 text-gray-400 font-normal">of {name}</span>
      </button>
    )
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-800/50 bg-gray-900/40 px-4 py-2">
      <div className="flex items-center gap-2 flex-wrap">
        {hasHome && <FanButton clubId={game.clubId} name={game.homeTeam} />}
        {hasAway && <FanButton clubId={game.awayClubId} name={game.awayTeam} />}
        {!user && (
          <Link to="/login" className="text-xs text-gray-500 hover:text-gray-300 ml-1">
            Sign in to follow
          </Link>
        )}
      </div>
      {!!game.views && (
        <span className="flex-shrink-0 text-xs text-gray-500">
          👁 {game.views} {game.views === 1 ? 'view' : 'views'}
        </span>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PublicGamePage() {
  const { gameId } = useParams()
  const { game, plays, loading } = useGame(gameId)
  const { user } = useAuth()
  const [tab, setTab] = useState('score')
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [followedPlayers, setFollowedPlayers] = useState([])
  const [followedClubs, setFollowedClubs] = useState([])
  const [followAlert, setFollowAlert] = useState(null) // { name, label }
  const seenPlayIds = useRef(new Set())
  const viewCounted = useRef(false)

  function goToTeamStats(team) {
    setSelectedTeam(team)
    setTab('stats')
  }

  // Increment view counter once per mount
  useEffect(() => {
    if (!gameId || viewCounted.current) return
    viewCounted.current = true
    incrementGameViews(gameId).catch(() => {})
  }, [gameId])

  // Update OG / page title when game loads
  useEffect(() => {
    if (!game) return
    const title = `${game.homeTeam} vs ${game.awayTeam} — ${game.status === 'live' ? 'LIVE on' : 'Final |'} SportStream`
    document.title = title
    const setMeta = (prop, val) => {
      let el = document.querySelector(`meta[property="${prop}"]`) ||
               document.querySelector(`meta[name="${prop}"]`)
      if (!el) { el = document.createElement('meta'); el.setAttribute(prop.startsWith('og:') || prop.startsWith('twitter:') ? 'property' : 'name', prop); document.head.appendChild(el) }
      el.setAttribute('content', val)
    }
    setMeta('og:title', title)
    setMeta('og:description', `${game.sport} game — ${game.homeScore}–${game.awayScore}. Follow live on SportStream.`)
    setMeta('twitter:title', title)
  }, [game?.homeTeam, game?.awayTeam, game?.status, game?.homeScore, game?.awayScore])

  // Subscribe to user's followed players and clubs
  useEffect(() => {
    if (!user) return
    return subscribeToUser(user.uid, (u) => {
      setFollowedPlayers(u?.followedPlayers || [])
      setFollowedClubs(u?.followedClubs || [])
    })
  }, [user])

  // Detect notable plays from followed players
  useEffect(() => {
    if (!plays.length || !followedPlayers.length) return
    const followedIds = new Set(followedPlayers.map((fp) => fp.playerId))
    for (const play of plays) {
      if (seenPlayIds.current.has(play.id)) continue
      seenPlayIds.current.add(play.id)
      if (play.playerId && followedIds.has(play.playerId) && NOTABLE_PLAY_TYPES.has(play.type)) {
        const label = getNotablePlayLabel(play.type, game?.sport)
        if (label) {
          setFollowAlert({ name: play.playerName, label })
          setTimeout(() => setFollowAlert(null), 5000)
        }
      }
    }
  }, [plays, followedPlayers, game?.sport])

  // Local ticking clock for basketball viewer
  const [localSeconds, setLocalSeconds] = useState(0)
  const localRef = useRef(0)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!game || isBaseballGame(game)) return
    localRef.current = game.clockElapsed || 0
    setLocalSeconds(game.clockElapsed || 0)
    clearInterval(intervalRef.current)
    if (game.clockRunning) {
      intervalRef.current = setInterval(() => {
        localRef.current += 1
        setLocalSeconds(localRef.current)
      }, 1000)
    }
    return () => clearInterval(intervalRef.current)
  }, [game?.clockRunning, game?.clockElapsed, game?.period, game?.sport])

  if (loading) return <Spinner />

  if (!game) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-950 text-gray-400">
        <p>Game not found.</p>
        <Link to="/" className="text-blue-400">← Home</Link>
      </div>
    )
  }

  const isBaseball = isBaseballGame(game)
  const isLive     = game.status === 'live'
  const isFinal    = game.status === 'final'
  const isSetup    = game.status === 'setup'

  function downloadCSV() {
    const rows = [
      ['Period/Inning', 'Team', 'Player', 'Number', 'Play', 'Points'],
      ...plays.map((p) => [
        isBaseball
          ? `${p.inningHalf === 'top' ? 'Top' : 'Bot'} ${p.inning}`
          : `P${p.period}`,
        p.team, p.playerName, p.playerNumber, p.type, p.points || 0,
      ]),
    ]
    const csv = rows.map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${game.homeTeam}-vs-${game.awayTeam}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-gray-950 pb-10">
      {/* Follow alert */}
      {followAlert && (
        <div className="fixed top-4 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 px-4">
          <div className="flex items-center gap-3 rounded-2xl bg-gray-900 p-4 shadow-xl ring-1 ring-yellow-600/60">
            <span className="text-xl">{followAlert.label.split(' ')[0]}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white">{followAlert.name}</p>
              <p className="text-xs text-yellow-300">{followAlert.label}</p>
            </div>
            <button onClick={() => setFollowAlert(null)} className="text-gray-600 hover:text-white">✕</button>
          </div>
        </div>
      )}

      {/* Back navigation */}
      <div className="flex items-center gap-4 overflow-x-auto border-b border-gray-800/50 bg-gray-950 px-4 py-2">
        <Link to="/" className="flex-shrink-0 text-xs text-gray-500 hover:text-gray-300">← Home</Link>
        {game.clubId && (
          <Link to={`/team/${game.clubId}`} className="flex-shrink-0 text-xs text-gray-500 hover:text-gray-300">← Team</Link>
        )}
        {game.tournamentId && (
          <Link to={`/tournament/${game.tournamentId}`} className="flex-shrink-0 text-xs text-gray-500 hover:text-gray-300">← Tournament</Link>
        )}
        {game.leagueId && (
          <Link to={`/league/${game.leagueId}`} className="flex-shrink-0 text-xs text-gray-500 hover:text-gray-300">← League</Link>
        )}
        <Link to="/tournaments" className="flex-shrink-0 text-xs text-gray-600 hover:text-gray-400">Tournaments</Link>
        <Link to="/leagues" className="flex-shrink-0 text-xs text-gray-600 hover:text-gray-400">Leagues</Link>
        <div className="ml-auto flex-shrink-0">
          <ShareButton joinCode={game.joinCode} label="⬆ Share" />
        </div>
      </div>

      {/* Status banner */}
      {isLive && (
        <div className="flex items-center justify-center gap-2 bg-red-700 py-2 text-sm font-bold uppercase tracking-wider text-white">
          <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> Live
        </div>
      )}
      {isFinal && (
        <div className="bg-gray-800 py-2 text-center text-sm font-bold uppercase tracking-wider text-gray-300">
          Final
        </div>
      )}
      {isSetup && (
        <div className="bg-blue-900/60 py-2 text-center text-sm font-bold uppercase tracking-wider text-blue-300">
          Upcoming
        </div>
      )}

      {/* Live stream */}
      {game.streamActive && game.peerId && <StreamViewer peerId={game.peerId} />}

      {/* Scoreboard — always visible */}
      {isBaseball
        ? <BaseballScoreboardHeader game={game} onTeamClick={goToTeamStats} />
        : <BasketballScoreboardHeader game={game} localSeconds={localSeconds} onTeamClick={goToTeamStats} />
      }

      {/* Fan strip — Become a Fan of each team + views counter */}
      <FanStrip
        game={game}
        user={user}
        followedClubs={followedClubs}
        onFollow={async (clubId) => {
          if (!user) return
          if (followedClubs.includes(clubId)) await unfollowClub(user.uid, clubId)
          else await followClub(user.uid, clubId)
        }}
      />

      {/* Sticky tab bar */}
      <div className="sticky top-0 z-10 flex border-b border-gray-800 bg-gray-950">
        {[
          { id: 'score',   label: 'Score' },
          { id: 'plays',   label: 'Plays' },
          { id: 'stats',   label: 'Stats' },
          { id: 'lineups', label: 'Lineups' },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`relative flex-1 py-3 text-sm font-semibold transition ${
              tab === id ? 'text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {label}
            {tab === id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-blue-500" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'score'   && <ScoreTab   game={game} plays={plays} isBaseball={isBaseball} />}
      {tab === 'plays'   && <PlaysTab   plays={plays} game={game} isBaseball={isBaseball} />}
      {tab === 'stats'   && <StatsTab   plays={plays} game={game} isBaseball={isBaseball} selectedTeam={selectedTeam} setSelectedTeam={setSelectedTeam} followedPlayers={followedPlayers} />}
      {tab === 'lineups' && <LineupsTab game={game} plays={plays} isBaseball={isBaseball} />}

      {/* Footer */}
      <div className="mt-10 flex items-center justify-between px-5">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span>Code:</span>
          <span className="font-mono font-bold tracking-widest text-gray-400">{game.joinCode}</span>
        </div>
        <button
          onClick={downloadCSV}
          className="rounded-xl bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white"
        >
          ↓ CSV
        </button>
      </div>
      <div className="mt-4 pb-4 text-center">
        <Link to="/" className="text-xs text-gray-600 hover:text-gray-400">
          Powered by SportStream
        </Link>
      </div>
    </div>
  )
}

// ── Scoreboard headers ────────────────────────────────────────────────────────

function BaseballScoreboardHeader({ game, onTeamClick }) {
  const isLive = game.status === 'live'
  const battingTeam = game.inningHalf === 'top' ? 'away' : 'home'

  return (
    <div className="bg-gray-900 px-5 py-5">
      <div className="flex items-center justify-between">
        {/* Home */}
        <div className="flex-1 text-center">
          {game.clubId ? (
            <Link
              to={`/team/${game.clubId}`}
              className="block truncate text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-blue-400 transition"
            >
              {game.homeTeam}
            </Link>
          ) : (
            <p className="truncate text-xs font-bold uppercase tracking-wider text-gray-400">{game.homeTeam}</p>
          )}
          <button onClick={() => onTeamClick('home')} className="group">
            <p className="font-mono text-6xl font-extrabold text-white group-hover:text-blue-400 transition">{game.homeScore}</p>
          </button>
          {isLive && battingTeam === 'home' && (
            <div className="mt-1 flex items-center justify-center gap-1">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
              <span className="text-[10px] font-bold text-green-400">batting</span>
            </div>
          )}
          <p className="mt-0.5 text-[9px] text-gray-700">tap score for stats</p>
        </div>

        {/* Inning + outs */}
        <div className="flex flex-col items-center px-3">
          <p className="text-xl font-bold text-gray-200">{inningLabel(game.inning, game.inningHalf)}</p>
          <p className="text-[10px] text-gray-600">{game.totalInnings} inn.</p>
          {isLive && (
            <div className="mt-2 flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={`h-2 w-2 rounded-full ${i < game.outs ? 'bg-yellow-400' : 'bg-gray-700'}`}
                />
              ))}
            </div>
          )}
          {isLive && game.balls != null && (
            <div className="mt-1 flex items-center gap-1 text-[10px] font-bold">
              <span className="text-green-400">{game.balls}B</span>
              <span className="text-gray-700">·</span>
              <span className="text-red-400">{game.strikes ?? 0}K</span>
            </div>
          )}
        </div>

        {/* Away */}
        <div className="flex-1 text-center">
          {game.awayClubId ? (
            <Link
              to={`/team/${game.awayClubId}`}
              className="block truncate text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-orange-400 transition"
            >
              {game.awayTeam}
            </Link>
          ) : (
            <p className="truncate text-xs font-bold uppercase tracking-wider text-gray-400">{game.awayTeam}</p>
          )}
          <button onClick={() => onTeamClick('away')} className="group">
            <p className="font-mono text-6xl font-extrabold text-white group-hover:text-orange-400 transition">{game.awayScore}</p>
          </button>
          {isLive && battingTeam === 'away' && (
            <div className="mt-1 flex items-center justify-center gap-1">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
              <span className="text-[10px] font-bold text-green-400">batting</span>
            </div>
          )}
          <p className="mt-0.5 text-[9px] text-gray-700">tap score for stats</p>
        </div>
      </div>
    </div>
  )
}

function BasketballScoreboardHeader({ game, localSeconds, onTeamClick }) {
  return (
    <div className="bg-gray-900 px-5 py-8">
      <div className="flex items-center justify-between">
        {/* Home */}
        <div className="flex-1 text-center">
          {game.clubId ? (
            <Link
              to={`/team/${game.clubId}`}
              className="block truncate text-sm font-semibold uppercase tracking-wider text-gray-400 hover:text-blue-400 transition"
            >
              {game.homeTeam}
            </Link>
          ) : (
            <p className="truncate text-sm font-semibold uppercase tracking-wider text-gray-400">{game.homeTeam}</p>
          )}
          <button onClick={() => onTeamClick('home')} className="group">
            <p className="font-mono text-7xl font-extrabold text-white group-hover:text-blue-400 transition">{game.homeScore}</p>
          </button>
          <p className="mt-0.5 text-[9px] text-gray-700">tap score for stats</p>
        </div>

        {/* Clock */}
        <div className="px-4 text-center">
          <p className="font-mono text-2xl font-bold text-gray-300">
            {formatClock(localSeconds, game.periodLength)}
          </p>
          <p className="text-xs text-gray-500">{periodLabel(game.period, game.totalPeriods)}</p>
        </div>

        {/* Away */}
        <div className="flex-1 text-center">
          {game.awayClubId ? (
            <Link
              to={`/team/${game.awayClubId}`}
              className="block truncate text-sm font-semibold uppercase tracking-wider text-gray-400 hover:text-orange-400 transition"
            >
              {game.awayTeam}
            </Link>
          ) : (
            <p className="truncate text-sm font-semibold uppercase tracking-wider text-gray-400">{game.awayTeam}</p>
          )}
          <button onClick={() => onTeamClick('away')} className="group">
            <p className="font-mono text-7xl font-extrabold text-white group-hover:text-orange-400 transition">{game.awayScore}</p>
          </button>
          <p className="mt-0.5 text-[9px] text-gray-700">tap score for stats</p>
        </div>
      </div>
    </div>
  )
}

// ── Score tab ─────────────────────────────────────────────────────────────────

// ── Pre-game info card ────────────────────────────────────────────────────────

function PreGameCard({ game }) {
  const scheduled = game.scheduledAt
    ? (() => {
        const d = new Date(game.scheduledAt)
        return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) +
          ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      })()
    : null

  const isBaseball = isBaseballGame(game)
  const formatStr  = isBaseball
    ? `${game.totalInnings || 9} innings`
    : `${game.totalPeriods || 4} × ${Math.round((game.periodLength || 600) / 60)} min`

  const homeLineup = game.homeLineup || []
  const awayLineup = game.awayLineup || []

  return (
    <div className="space-y-4 px-4 pt-5">
      {/* Matchup card */}
      <div className="rounded-2xl bg-gray-900 p-5 text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-blue-400">{game.sport}</p>
        <div className="mt-3 flex items-center justify-center gap-4">
          <div className="flex-1">
            <p className="text-xl font-extrabold text-white">{game.homeTeam}</p>
            <p className="text-xs text-gray-500">Home</p>
          </div>
          <div className="text-gray-600 font-bold text-xl">vs</div>
          <div className="flex-1">
            <p className="text-xl font-extrabold text-white">{game.awayTeam}</p>
            <p className="text-xs text-gray-500">Away</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs text-gray-500">
          {scheduled && (
            <span className="flex items-center gap-1">
              <span>📅</span> {scheduled}
            </span>
          )}
          <span className="flex items-center gap-1">
            <span>🕐</span> {formatStr}
          </span>
          <span className="flex items-center gap-1">
            <span>🔑</span>
            <span className="font-mono font-bold tracking-widest text-gray-400">{game.joinCode}</span>
          </span>
        </div>
      </div>

      {/* Lineup previews */}
      {(homeLineup.length > 0 || awayLineup.length > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: game.homeTeam, lineup: homeLineup, clubId: game.clubId },
            { label: game.awayTeam, lineup: awayLineup, clubId: game.awayClubId },
          ].map(({ label, lineup, clubId: teamClubId }) => (
            <div key={label} className="rounded-2xl bg-gray-900 p-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</p>
              {lineup.length === 0 ? (
                <p className="text-xs text-gray-600">TBD</p>
              ) : (
                <div className="space-y-1">
                  {lineup.slice(0, 5).map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-5 text-center font-mono text-[10px] text-gray-600">
                        {p.playerNumber || '—'}
                      </span>
                      {p.playerId && teamClubId ? (
                        <Link
                          to={`/player/${teamClubId}/${p.playerId}`}
                          className="truncate text-xs text-gray-300 hover:text-blue-300 transition hover:underline"
                        >
                          {shortName(p.playerName)}
                        </Link>
                      ) : (
                        <span className="truncate text-xs text-gray-300">{shortName(p.playerName)}</span>
                      )}
                    </div>
                  ))}
                  {lineup.length > 5 && (
                    <p className="text-[10px] text-gray-600">+{lineup.length - 5} more</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-center text-xs text-gray-600">
        Come back when the game starts for live scoring
      </p>
    </div>
  )
}

// ── Score tab ─────────────────────────────────────────────────────────────────

function ScoreTab({ game, plays, isBaseball }) {
  if (isBaseball) return <BaseballScoreTab game={game} plays={plays} />
  return <BasketballScoreTab game={game} plays={plays} />
}

function BaseballScoreTab({ game, plays }) {
  const isLive    = game.status === 'live'
  const bases     = game.bases || { first: null, second: null, third: null }
  const battingTeam = game.inningHalf === 'top' ? 'away' : 'home'
  const teamName  = battingTeam === 'home' ? game.homeTeam : game.awayTeam

  const battingLineup = battingTeam === 'home' ? (game.homeLineup || []) : (game.awayLineup || [])
  const batterIdx     = battingTeam === 'home' ? (game.homeBatterIdx || 0) : (game.awayBatterIdx || 0)
  const lineupLen     = battingLineup.length || 1
  const currentBatter = battingLineup[batterIdx % lineupLen] || null
  const onDeck        = battingLineup.length > 1 ? battingLineup[(batterIdx + 1) % lineupLen] : null

  if (!isLive && plays.length === 0) {
    return <PreGameCard game={game} />
  }

  return (
    <div className="space-y-6 px-4 pt-4">
      {/* Live game view */}
      {isLive && (
        <>
          {/* Base diamond */}
          <div className="flex flex-col items-center gap-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              {teamName} batting · {game.outs} out{game.outs !== 1 ? 's' : ''}
            </p>
            <BaseDiamond bases={bases} compact={false} />
          </div>

          {/* Pitch count — Balls · Strikes · Outs */}
          {game.balls != null && (
            <div className="flex items-center justify-center gap-5 rounded-2xl bg-gray-900 py-5">
              <div className="text-center">
                <p className="text-4xl font-extrabold text-green-400">{game.balls}</p>
                <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-green-700">Balls</p>
              </div>
              <div className="h-10 w-px bg-gray-800" />
              <div className="text-center">
                <p className="text-4xl font-extrabold text-red-400">{game.strikes ?? 0}</p>
                <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-red-700">Strikes</p>
              </div>
              <div className="h-10 w-px bg-gray-800" />
              <div className="text-center">
                <p className="text-4xl font-extrabold text-yellow-400">{game.outs ?? 0}</p>
                <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-yellow-700">Outs</p>
              </div>
            </div>
          )}

          {/* Current batter */}
          {currentBatter && (
            <div className="rounded-2xl bg-gray-900 p-4">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Up to Bat · #{(batterIdx % lineupLen) + 1} in order
              </p>
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-900 text-xl font-extrabold text-blue-200">
                  {currentBatter.playerNumber || '?'}
                </div>
                <div>
                  {currentBatter.playerId && (battingTeam === 'home' ? game.clubId : game.awayClubId) ? (
                    <Link
                      to={`/player/${battingTeam === 'home' ? game.clubId : game.awayClubId}/${currentBatter.playerId}`}
                      className="text-xl font-bold text-white hover:text-blue-300 transition hover:underline"
                    >
                      {shortName(currentBatter.playerName)}
                    </Link>
                  ) : (
                    <p className="text-xl font-bold text-white">{shortName(currentBatter.playerName)}</p>
                  )}
                  {currentBatter.position && (
                    <p className="text-sm text-gray-500">{currentBatter.position}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* On deck */}
          {onDeck && (
            <div className="flex items-center gap-3 rounded-xl bg-gray-900/60 px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-800 text-xs font-bold text-gray-400">
                {onDeck.playerNumber || '?'}
              </div>
              <div>
                <p className="text-[10px] text-gray-600">On deck</p>
                {onDeck.playerId && (battingTeam === 'home' ? game.clubId : game.awayClubId) ? (
                  <Link
                    to={`/player/${battingTeam === 'home' ? game.clubId : game.awayClubId}/${onDeck.playerId}`}
                    className="text-sm text-gray-300 hover:text-blue-300 transition hover:underline"
                  >
                    {shortName(onDeck.playerName)}
                  </Link>
                ) : (
                  <p className="text-sm text-gray-300">{shortName(onDeck.playerName)}</p>
                )}
              </div>
            </div>
          )}

          {/* Runners on base */}
          {(bases.first || bases.second || bases.third) && (
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">Baserunners</p>
              <div className="rounded-2xl bg-gray-900 divide-y divide-gray-800">
                {[
                  { base: 'third', label: '3rd Base', runner: bases.third },
                  { base: 'second', label: '2nd Base', runner: bases.second },
                  { base: 'first', label: '1st Base', runner: bases.first },
                ].map(({ base, label, runner }) =>
                  runner ? (
                    <div key={base} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="w-20 text-xs font-bold text-yellow-400">{label}</span>
                      {runner.playerId && (battingTeam === 'home' ? game.clubId : game.awayClubId) ? (
                        <Link
                          to={`/player/${battingTeam === 'home' ? game.clubId : game.awayClubId}/${runner.playerId}`}
                          className="text-sm text-white hover:text-blue-300 transition hover:underline"
                        >
                          {runner.playerNumber ? `#${runner.playerNumber} ` : ''}{shortName(runner.playerName)}
                        </Link>
                      ) : (
                        <span className="text-sm text-white">
                          {runner.playerNumber ? `#${runner.playerNumber} ` : ''}{shortName(runner.playerName)}
                        </span>
                      )}
                    </div>
                  ) : null
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Line score — show once there are plays */}
      {plays.length > 0 && (
        <LineScoreTable game={game} plays={plays} />
      )}
    </div>
  )
}

function BasketballScoreTab({ game, plays }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null)

  const stats        = computeBasketballStats(plays)
  const periodScores = computePeriodScores(plays, game.totalPeriods)
  const totalPeriods = game.totalPeriods || 4
  const isLive       = game.status === 'live'

  const homeLeader = Object.values(stats).filter((s) => s.team === 'home').sort((a, b) => b.pts - a.pts)[0]
  const awayLeader = Object.values(stats).filter((s) => s.team === 'away').sort((a, b) => b.pts - a.pts)[0]

  const recent = plays.slice(0, 5)
  const playerPlays = selectedPlayer ? plays.filter((p) => p.playerId === selectedPlayer.id) : []

  if (plays.length === 0) {
    return <PreGameCard game={game} />
  }

  return (
    <div className="space-y-5 px-4 pt-4">
      {/* Period breakdown */}
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">By Period</p>
        <div className="overflow-x-auto rounded-2xl bg-gray-900">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-600">
                <th className="px-3 py-2 text-left">Team</th>
                {Array.from({ length: totalPeriods }, (_, i) => i + 1).map((p) => (
                  <th key={p} className="px-2 py-2 text-center">
                    {periodLabel(p, totalPeriods)}
                  </th>
                ))}
                <th className="border-l border-gray-800 px-3 py-2 font-bold text-gray-400">Tot</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: game.homeTeam, team: 'home', total: game.homeScore },
                { label: game.awayTeam, team: 'away', total: game.awayScore },
              ].map(({ label, team, total }) => (
                <tr key={team} className="border-t border-gray-800 text-white">
                  <td className="whitespace-nowrap px-3 py-2 font-semibold text-gray-300">{label}</td>
                  {Array.from({ length: totalPeriods }, (_, i) => i + 1).map((p) => (
                    <td key={p} className="px-2 py-2 text-center text-gray-400">
                      {periodScores[p]?.[team] ?? (isLive && p > game.period ? '—' : 0)}
                    </td>
                  ))}
                  <td className="border-l border-gray-800 px-3 py-2 text-center font-extrabold text-white">{total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Team leaders */}
      {(homeLeader || awayLeader) && (
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">Scoring Leaders</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { leader: homeLeader, team: game.homeTeam },
              { leader: awayLeader, team: game.awayTeam },
            ].map(({ leader, team }) => (
              <div
                key={team}
                onClick={() => leader && setSelectedPlayer(leader)}
                className={`rounded-2xl bg-gray-900 p-3 ${leader ? 'cursor-pointer hover:bg-gray-800 transition' : ''}`}
              >
                <p className="text-[9px] font-bold uppercase tracking-wider text-gray-600">{team}</p>
                {leader ? (
                  <>
                    {leader.id && (leader.team === 'home' ? game.clubId : game.awayClubId) ? (
                      <Link
                        to={`/player/${leader.team === 'home' ? game.clubId : game.awayClubId}/${leader.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 block truncate text-sm font-semibold text-white hover:text-blue-300 transition hover:underline"
                      >
                        {leader.name}
                      </Link>
                    ) : (
                      <p className="mt-1 truncate text-sm font-semibold text-white">{leader.name}</p>
                    )}
                    <p className="text-3xl font-extrabold text-blue-400">{leader.pts}</p>
                    <p className="text-[9px] text-gray-600">pts · tap for stats</p>
                  </>
                ) : (
                  <p className="mt-2 text-xs text-gray-600">No plays yet</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent plays */}
      {recent.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">Recent</p>
          <div className="divide-y divide-gray-800 overflow-hidden rounded-2xl bg-gray-900">
            {recent.map((play) => {
              const isHome = play.team === 'home'
              return (
                <div key={play.id} className="flex items-center gap-2 px-4 py-2.5">
                  <div className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${isHome ? 'bg-blue-500' : 'bg-orange-400'}`} />
                  <p className="flex-1 truncate text-xs text-gray-300">{describePlay(play)}</p>
                  {play.points > 0 && (
                    <span className="flex-shrink-0 text-xs font-bold text-green-400">+{play.points}</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {selectedPlayer && (
        <BasketballPlayerSheet player={selectedPlayer} plays={playerPlays} onClose={() => setSelectedPlayer(null)} />
      )}
    </div>
  )
}

// ── Plays tab ─────────────────────────────────────────────────────────────────

function PlaysTab({ plays, game, isBaseball }) {
  if (!plays.length) {
    return <div className="py-16 text-center text-sm text-gray-500">No plays yet.</div>
  }

  const groups = groupPlays(plays, isBaseball)

  return (
    <div className="space-y-4 pt-3">
      {groups.map(({ key, plays: groupPlays }) => {
        const first = groupPlays[0]
        const label = isBaseball
          ? inningLabel(first.inning, first.inningHalf)
          : periodLabel(first.period, game?.totalPeriods)
        const sub = isBaseball
          ? (first.inningHalf === 'top' ? game.awayTeam : game.homeTeam) + ' batting'
          : null

        return (
          <div key={key}>
            <div className="flex items-center gap-3 px-5 py-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</p>
              {sub && <p className="text-[10px] text-gray-600">{sub}</p>}
              <div className="h-px flex-1 bg-gray-800" />
            </div>
            <div className="mx-4 divide-y divide-gray-800 overflow-hidden rounded-2xl bg-gray-900">
              {groupPlays.map((play) => <PlayRow key={play.id} play={play} isBaseball={isBaseball} />)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PlayRow({ play, isBaseball }) {
  const isHome  = play.team === 'home'
  const label   = isBaseball ? describeBaseballPlay(play) : describePlay(play)

  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${isHome ? '' : 'flex-row-reverse'}`}>
      <div className={`h-2 w-2 flex-shrink-0 rounded-full ${isHome ? 'bg-blue-500' : 'bg-orange-400'}`} />
      <p className={`flex-1 min-w-0 truncate text-sm font-medium text-white ${isHome ? 'text-left' : 'text-right'}`}>
        {label}
      </p>
      {play.points > 0 && (
        <span className="flex-shrink-0 rounded-full bg-green-900/60 px-2 py-0.5 text-xs font-bold text-green-300">
          {isBaseball ? `+${play.points}R` : `+${play.points}`}
        </span>
      )}
    </div>
  )
}

// ── Stats tab ─────────────────────────────────────────────────────────────────

function StatsTab({ plays, game, isBaseball, selectedTeam, setSelectedTeam, followedPlayers }) {
  if (!plays.length) {
    return <div className="py-16 text-center text-sm text-gray-500">No stats yet — game hasn't started.</div>
  }
  if (isBaseball) return <BaseballStatsTab plays={plays} game={game} selectedTeam={selectedTeam} setSelectedTeam={setSelectedTeam} followedPlayers={followedPlayers} />
  return <BasketballStatsTab plays={plays} game={game} selectedTeam={selectedTeam} setSelectedTeam={setSelectedTeam} followedPlayers={followedPlayers} />
}

function BaseballStatsTab({ plays, game, selectedTeam, setSelectedTeam, followedPlayers }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const activeTeam = selectedTeam || 'home'

  const stats = computeBaseballStats(plays)
  const home  = Object.values(stats).filter((s) => s.team === 'home')
  const away  = Object.values(stats).filter((s) => s.team === 'away')
  const followedIds = new Set((followedPlayers || []).map((fp) => fp.playerId))

  const homeH = home.reduce((acc, s) => acc + s.h, 0)
  const awayH = away.reduce((acc, s) => acc + s.h, 0)

  const rows = (activeTeam === 'home' ? home : away).sort((a, b) => b.h - a.h || b.rbi - a.rbi)
  const playerPlays = selectedPlayer ? plays.filter((p) => p.playerId === selectedPlayer.id) : []

  return (
    <div className="space-y-5 px-4 pt-4">
      {/* Line score */}
      <LineScoreTable game={game} plays={plays} />

      {/* Team totals */}
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">Team Totals</p>
        <div className="overflow-x-auto rounded-2xl bg-gray-900">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-600">
                <th className="px-3 py-2 text-left">Team</th>
                <th className="px-2 py-2 text-center">R</th>
                <th className="px-2 py-2 text-center">H</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: game.homeTeam, r: game.homeScore, h: homeH },
                { label: game.awayTeam, r: game.awayScore, h: awayH },
              ].map((row) => (
                <tr key={row.label} className="border-t border-gray-800 text-white">
                  <td className="whitespace-nowrap px-3 py-2 font-semibold">{row.label}</td>
                  <td className="px-2 py-2 text-center font-extrabold text-green-400">{row.r}</td>
                  <td className="px-2 py-2 text-center font-bold">{row.h}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Team toggle */}
      <div className="flex rounded-xl bg-gray-800 p-1">
        {[
          { id: 'home', label: game.homeTeam },
          { id: 'away', label: game.awayTeam },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setSelectedTeam(id)}
            className={`flex-1 truncate rounded-lg py-2 text-sm font-semibold transition ${
              activeTeam === id ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Per-player */}
      {rows.length ? (
        <div className="overflow-x-auto rounded-2xl bg-gray-900">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-600">
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-2 py-2 text-left">Player</th>
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
              {rows.map((s) => {
                const clubId = activeTeam === 'home' ? game.clubId : game.awayClubId
                const isFollowed = followedIds.has(s.id)
                return (
                  <tr
                    key={s.id || s.name}
                    onClick={() => setSelectedPlayer(s)}
                    className="cursor-pointer border-t border-gray-800 text-white transition hover:bg-gray-800/60"
                  >
                    <td className="px-3 py-2 font-mono text-gray-400">{s.number || '—'}</td>
                    <td className="whitespace-nowrap px-2 py-2 font-medium">
                      {clubId && s.id ? (
                        <Link
                          to={`/player/${clubId}/${s.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className={`hover:underline ${isFollowed ? 'text-yellow-300' : 'text-white'}`}
                        >
                          {s.name}
                        </Link>
                      ) : s.name}
                    </td>
                    <td className="px-2 py-2 text-center text-gray-400">{s.ab}</td>
                    <td className="px-2 py-2 text-center font-bold">{s.h}</td>
                    <td className="px-2 py-2 text-center text-gray-400">{s.hr || 0}</td>
                    <td className="px-2 py-2 text-center text-gray-400">{s.rbi}</td>
                    <td className="px-2 py-2 text-center text-gray-400">{s.bb}</td>
                    <td className="px-2 py-2 text-center text-gray-400">{s.k}</td>
                    <td className="px-2 py-2 text-center font-mono text-blue-400">{avg(s.h, s.ab)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-gray-600">No stats for this team yet.</p>
      )}

      {/* Player detail sheet */}
      {selectedPlayer && (
        <BaseballPlayerSheet
          player={selectedPlayer}
          plays={playerPlays}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  )
}

function BasketballStatsTab({ plays, game, selectedTeam, setSelectedTeam, followedPlayers }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const activeTeam = selectedTeam || 'home'

  const stats = computeBasketballStats(plays)
  const home  = Object.values(stats).filter((s) => s.team === 'home').sort((a, b) => b.pts - a.pts)
  const away  = Object.values(stats).filter((s) => s.team === 'away').sort((a, b) => b.pts - a.pts)

  const rows = activeTeam === 'home' ? home : away
  const followedIds = new Set((followedPlayers || []).map((fp) => fp.playerId))
  const playerPlays = selectedPlayer ? plays.filter((p) => p.playerId === selectedPlayer.id) : []

  return (
    <div className="space-y-5 px-4 pt-4">
      {/* Team toggle */}
      <div className="flex rounded-xl bg-gray-800 p-1">
        {[
          { id: 'home', label: game.homeTeam },
          { id: 'away', label: game.awayTeam },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setSelectedTeam(id)}
            className={`flex-1 truncate rounded-lg py-2 text-sm font-semibold transition ${
              activeTeam === id ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {rows.length ? (
        <div className="overflow-x-auto rounded-2xl bg-gray-900">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-600">
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-2 py-2 text-left">Player</th>
                <th className="px-2 py-2 text-center">PTS</th>
                <th className="px-2 py-2 text-center">REB</th>
                <th className="px-2 py-2 text-center">AST</th>
                <th className="px-2 py-2 text-center">STL</th>
                <th className="px-2 py-2 text-center">BLK</th>
                <th className="px-2 py-2 text-center">F</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const clubId = activeTeam === 'home' ? game.clubId : game.awayClubId
                const isFollowed = followedIds.has(s.id)
                return (
                  <tr
                    key={s.id || s.name}
                    onClick={() => setSelectedPlayer(s)}
                    className="cursor-pointer border-t border-gray-800 text-white transition hover:bg-gray-800/60"
                  >
                    <td className="px-3 py-2 font-mono text-gray-400">{s.number || '—'}</td>
                    <td className="whitespace-nowrap px-2 py-2 font-medium">
                      {clubId && s.id ? (
                        <Link
                          to={`/player/${clubId}/${s.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className={`hover:underline ${isFollowed ? 'text-yellow-300' : 'text-white'}`}
                        >
                          {s.name}
                        </Link>
                      ) : s.name}
                    </td>
                    <td className="px-2 py-2 text-center font-extrabold text-blue-400">{s.pts}</td>
                    <td className="px-2 py-2 text-center text-gray-400">{s.reb}</td>
                    <td className="px-2 py-2 text-center text-gray-400">{s.ast}</td>
                    <td className="px-2 py-2 text-center text-gray-400">{s.stl}</td>
                    <td className="px-2 py-2 text-center text-gray-400">{s.blk}</td>
                    <td className="px-2 py-2 text-center text-gray-400">{s.foul}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-gray-600">No stats for this team yet.</p>
      )}

      {/* Player detail sheet */}
      {selectedPlayer && (
        <BasketballPlayerSheet
          player={selectedPlayer}
          plays={playerPlays}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  )
}

// ── Player detail sheets ──────────────────────────────────────────────────────

function BaseballPlayerSheet({ player, plays, onClose }) {
  const [histPlays, setHistPlays] = useState(null) // null = loading

  useEffect(() => {
    if (!player.id) { setHistPlays([]); return }
    getPlayerHistoricalPlays(player.id).then(setHistPlays).catch(() => setHistPlays([]))
  }, [player.id])

  // Career stats (all games including current)
  const careerStats = histPlays ? computeBaseballStats(histPlays) : null
  const career = careerStats?.[player.id] ?? null

  // Per-game breakdown (last 5 games, newest first)
  const gameIds = histPlays
    ? [...new Set(histPlays.map((p) => p.gameId))].slice(0, 5)
    : []
  const recentGames = gameIds.map((gid) => {
    const gPlays = histPlays.filter((p) => p.gameId === gid)
    const s = computeBaseballStats(gPlays)[player.id] ?? { ab: 0, h: 0, hr: 0, rbi: 0, bb: 0, k: 0 }
    return { gid, ...s }
  })

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-lg rounded-t-3xl bg-gray-900 p-6 pb-10 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-700" />

        {/* Header */}
        <div className="mb-5 flex items-center gap-4">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-blue-900 text-xl font-extrabold text-blue-200">
            {player.number || '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-bold text-white">{player.name}</p>
            <p className="text-xs text-gray-500">{player.team === 'home' ? 'Home' : 'Away'} · Baseball</p>
          </div>
          <button onClick={onClose} className="flex-shrink-0 rounded-full p-2 text-gray-500 hover:bg-gray-800 hover:text-white">✕</button>
        </div>

        {/* This game stats */}
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">This Game</p>
        <div className="mb-5 grid grid-cols-4 gap-2">
          {[
            { label: 'AVG', value: avg(player.h, player.ab), color: 'text-blue-400' },
            { label: 'H', value: player.h, color: 'text-white' },
            { label: 'AB', value: player.ab, color: 'text-gray-300' },
            { label: 'HR', value: player.hr || 0, color: 'text-yellow-400' },
            { label: 'RBI', value: player.rbi, color: 'text-green-400' },
            { label: 'BB', value: player.bb, color: 'text-gray-300' },
            { label: 'K', value: player.k, color: 'text-red-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl bg-gray-800 p-3 text-center">
              <p className={`text-xl font-extrabold ${color}`}>{value}</p>
              <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-gray-600">{label}</p>
            </div>
          ))}
        </div>

        {/* Career stats */}
        {histPlays === null ? (
          <p className="py-4 text-center text-xs text-gray-600">Loading career stats…</p>
        ) : career ? (
          <>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">Career</p>
            <div className="mb-5 grid grid-cols-4 gap-2">
              {[
                { label: 'AVG', value: avg(career.h, career.ab), color: 'text-blue-400' },
                { label: 'H', value: career.h, color: 'text-white' },
                { label: 'AB', value: career.ab, color: 'text-gray-300' },
                { label: 'HR', value: career.hr || 0, color: 'text-yellow-400' },
                { label: 'RBI', value: career.rbi, color: 'text-green-400' },
                { label: 'BB', value: career.bb, color: 'text-gray-300' },
                { label: 'K', value: career.k, color: 'text-red-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl bg-gray-800/60 p-3 text-center">
                  <p className={`text-xl font-extrabold ${color}`}>{value}</p>
                  <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-gray-600">{label}</p>
                </div>
              ))}
            </div>

            {recentGames.length > 1 && (
              <>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">Recent Games</p>
                <div className="mb-5 divide-y divide-gray-800 overflow-hidden rounded-xl bg-gray-800">
                  {recentGames.map((g, i) => (
                    <div key={g.gid} className="flex items-center gap-3 px-3 py-2 text-xs">
                      <span className="w-5 text-gray-600">{i + 1}</span>
                      <span className="w-12 font-bold text-blue-400">{avg(g.h, g.ab)}</span>
                      <span className="text-gray-400">{g.h}/{g.ab}</span>
                      {g.hr > 0 && <span className="text-yellow-400">{g.hr} HR</span>}
                      {g.rbi > 0 && <span className="text-green-400">{g.rbi} RBI</span>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        ) : null}

        {/* Play log (current game) */}
        {plays.length > 0 && (
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-600">Play Log</p>
            <div className="max-h-40 overflow-y-auto divide-y divide-gray-800 rounded-xl bg-gray-800">
              {plays.slice(0, 10).map((p) => (
                <div key={p.id} className="flex items-center gap-2 px-3 py-2">
                  <span className="text-[10px] text-gray-600">{p.inningHalf === 'top' ? '▲' : '▼'}{p.inning}</span>
                  <span className="flex-1 text-xs text-gray-300">{describeBaseballPlay(p)}</span>
                  {p.points > 0 && <span className="text-xs font-bold text-green-400">+{p.points}R</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function BasketballPlayerSheet({ player, plays, onClose }) {
  const [histPlays, setHistPlays] = useState(null) // null = loading

  useEffect(() => {
    if (!player.id) { setHistPlays([]); return }
    getPlayerHistoricalPlays(player.id).then(setHistPlays).catch(() => setHistPlays([]))
  }, [player.id])

  // Career stats (all games)
  const careerStats = histPlays ? computeBasketballStats(histPlays) : null
  const career = careerStats?.[player.id] ?? null

  // Per-game breakdown (last 5 games)
  const gameIds = histPlays
    ? [...new Set(histPlays.map((p) => p.gameId))].slice(0, 5)
    : []
  const recentGames = gameIds.map((gid) => {
    const gPlays = histPlays.filter((p) => p.gameId === gid)
    const s = computeBasketballStats(gPlays)[player.id] ?? { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, foul: 0 }
    return { gid, ...s }
  })

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-lg rounded-t-3xl bg-gray-900 p-6 pb-10 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-700" />

        {/* Header */}
        <div className="mb-5 flex items-center gap-4">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-blue-900 text-xl font-extrabold text-blue-200">
            {player.number || '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-bold text-white">{player.name}</p>
            <p className="text-xs text-gray-500">{player.team === 'home' ? 'Home' : 'Away'} · Basketball</p>
          </div>
          <button onClick={onClose} className="flex-shrink-0 rounded-full p-2 text-gray-500 hover:bg-gray-800 hover:text-white">✕</button>
        </div>

        {/* This game stats */}
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">This Game</p>
        <div className="mb-5 grid grid-cols-3 gap-2">
          {[
            { label: 'PTS', value: player.pts, color: 'text-blue-400' },
            { label: 'REB', value: player.reb, color: 'text-green-400' },
            { label: 'AST', value: player.ast, color: 'text-yellow-400' },
            { label: 'STL', value: player.stl, color: 'text-purple-400' },
            { label: 'BLK', value: player.blk, color: 'text-orange-400' },
            { label: 'FOUL', value: player.foul, color: 'text-red-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl bg-gray-800 p-3 text-center">
              <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
              <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-gray-600">{label}</p>
            </div>
          ))}
        </div>

        {/* Career stats */}
        {histPlays === null ? (
          <p className="py-4 text-center text-xs text-gray-600">Loading career stats…</p>
        ) : career ? (
          <>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">Career</p>
            <div className="mb-5 grid grid-cols-3 gap-2">
              {[
                { label: 'PTS', value: career.pts, color: 'text-blue-400' },
                { label: 'REB', value: career.reb, color: 'text-green-400' },
                { label: 'AST', value: career.ast, color: 'text-yellow-400' },
                { label: 'STL', value: career.stl, color: 'text-purple-400' },
                { label: 'BLK', value: career.blk, color: 'text-orange-400' },
                { label: 'FOUL', value: career.foul, color: 'text-red-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl bg-gray-800/60 p-3 text-center">
                  <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
                  <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-gray-600">{label}</p>
                </div>
              ))}
            </div>

            {recentGames.length > 1 && (
              <>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">Recent Games</p>
                <div className="mb-5 divide-y divide-gray-800 overflow-hidden rounded-xl bg-gray-800">
                  {recentGames.map((g, i) => (
                    <div key={g.gid} className="flex items-center gap-3 px-3 py-2 text-xs">
                      <span className="w-5 text-gray-600">{i + 1}</span>
                      <span className="w-8 font-extrabold text-blue-400">{g.pts}</span>
                      <span className="text-gray-500">pts</span>
                      {g.reb > 0 && <span className="text-green-400">{g.reb} reb</span>}
                      {g.ast > 0 && <span className="text-yellow-400">{g.ast} ast</span>}
                      {g.stl > 0 && <span className="text-purple-400">{g.stl} stl</span>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        ) : null}

        {/* Play log (current game) */}
        {plays.length > 0 && (
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-600">Play Log</p>
            <div className="max-h-40 overflow-y-auto divide-y divide-gray-800 rounded-xl bg-gray-800">
              {plays.slice(0, 10).map((p) => (
                <div key={p.id} className="flex items-center gap-2 px-3 py-2">
                  <span className="text-[10px] text-gray-600">Q{p.period}</span>
                  <span className="flex-1 text-xs text-gray-300">{describePlay(p)}</span>
                  {p.points > 0 && <span className="text-xs font-bold text-green-400">+{p.points}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Lineups tab ───────────────────────────────────────────────────────────────

function LineupsTab({ game, plays, isBaseball }) {
  const [activeTeam, setActiveTeam] = useState('home')
  const [selectedPlayer, setSelectedPlayer] = useState(null)

  const homeLineup = game.homeLineup || []
  const awayLineup = game.awayLineup || []
  const lineup     = activeTeam === 'home' ? homeLineup : awayLineup

  const stats = isBaseball ? computeBaseballStats(plays) : computeBasketballStats(plays)

  const isLive      = game.status === 'live'
  const battingTeam = game.inningHalf === 'top' ? 'away' : 'home'
  const batterIdx   = activeTeam === 'home' ? (game.homeBatterIdx || 0) : (game.awayBatterIdx || 0)
  const lineupLen   = lineup.length || 1
  const currentIdx  = isLive && isBaseball && battingTeam === activeTeam
    ? batterIdx % lineupLen
    : -1
  const onDeckIdx  = isLive && isBaseball && battingTeam === activeTeam && lineup.length > 1
    ? (batterIdx + 1) % lineupLen
    : -1

  const playerPlays = selectedPlayer ? plays.filter((p) => p.playerId === selectedPlayer.id) : []

  if (!homeLineup.length && !awayLineup.length) {
    return (
      <div className="px-4 pt-4">
        <div className="py-16 text-center text-sm text-gray-500">
          No lineups have been set for this game.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 px-4 pt-4">
      {/* Team toggle */}
      <div className="flex rounded-xl bg-gray-800 p-1">
        {[
          { id: 'home', label: game.homeTeam },
          { id: 'away', label: game.awayTeam },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTeam(id)}
            className={`flex-1 truncate rounded-lg py-2 text-sm font-semibold transition ${
              activeTeam === id ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {lineup.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-500">
          No lineup set for {activeTeam === 'home' ? game.homeTeam : game.awayTeam}.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-gray-900">
          {lineup.map((player, idx) => {
            const playerStats = player.playerId ? stats[player.playerId] : null
            const isCurrent  = idx === currentIdx
            const isOnDeck   = idx === onDeckIdx
            const fullPlayer = playerStats
              ? { id: player.playerId, name: player.playerName, number: player.playerNumber, team: activeTeam, ...playerStats }
              : null

            return (
              <div
                key={player.playerId || idx}
                onClick={() => fullPlayer && setSelectedPlayer(fullPlayer)}
                className={`flex items-center gap-3 border-t border-gray-800 px-4 py-3 first:border-t-0 transition ${
                  isCurrent ? 'bg-blue-900/25' : ''
                } ${fullPlayer ? 'cursor-pointer hover:bg-gray-800/50' : ''}`}
              >
                {/* Batting order */}
                <span className={`w-5 flex-shrink-0 text-center text-xs font-bold ${isCurrent ? 'text-blue-400' : 'text-gray-700'}`}>
                  {idx + 1}
                </span>

                {/* Jersey number */}
                <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
                  isCurrent ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300'
                }`}>
                  {player.playerNumber || '?'}
                </div>

                {/* Name + position + badges */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {player.playerId && (activeTeam === 'home' ? game.clubId : game.awayClubId) ? (
                      <Link
                        to={`/player/${activeTeam === 'home' ? game.clubId : game.awayClubId}/${player.playerId}`}
                        onClick={(e) => e.stopPropagation()}
                        className={`truncate text-sm font-semibold hover:underline transition ${isCurrent ? 'text-white hover:text-blue-300' : 'text-gray-200 hover:text-blue-300'}`}
                      >
                        {shortName(player.playerName)}
                      </Link>
                    ) : (
                      <p className={`truncate text-sm font-semibold ${isCurrent ? 'text-white' : 'text-gray-200'}`}>
                        {shortName(player.playerName)}
                      </p>
                    )}
                    {isCurrent && (
                      <span className="flex-shrink-0 rounded-full bg-blue-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                        UP
                      </span>
                    )}
                    {isOnDeck && (
                      <span className="flex-shrink-0 rounded-full bg-gray-700 px-1.5 py-0.5 text-[9px] font-bold text-gray-300">
                        DECK
                      </span>
                    )}
                  </div>
                  {player.position && (
                    <p className="text-[10px] text-gray-500">{player.position}</p>
                  )}
                </div>

                {/* Inline stats */}
                {playerStats && isBaseball && (
                  <div className="flex-shrink-0 text-right">
                    <p className="font-mono text-xs text-gray-300">
                      {playerStats.h}-{playerStats.ab}
                    </p>
                    <p className="font-mono text-[10px] text-blue-400">{avg(playerStats.h, playerStats.ab)}</p>
                  </div>
                )}
                {playerStats && !isBaseball && (
                  <div className="flex-shrink-0 text-right">
                    <p className="text-xl font-extrabold text-blue-400">{playerStats.pts}</p>
                    <p className="text-[9px] text-gray-600">pts</p>
                  </div>
                )}
                {!playerStats && (
                  <p className="flex-shrink-0 text-xs text-gray-700">—</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Player detail sheet */}
      {selectedPlayer && isBaseball && (
        <BaseballPlayerSheet player={selectedPlayer} plays={playerPlays} onClose={() => setSelectedPlayer(null)} />
      )}
      {selectedPlayer && !isBaseball && (
        <BasketballPlayerSheet player={selectedPlayer} plays={playerPlays} onClose={() => setSelectedPlayer(null)} />
      )}
    </div>
  )
}

// ── Shared: line score ────────────────────────────────────────────────────────

function LineScoreTable({ game, plays }) {
  const isLive = game.status === 'live'
  const { grid, maxInning } = computeLineScore(plays, game.totalInnings, game.inning)

  return (
    <div>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">Line Score</p>
      <div className="overflow-x-auto rounded-2xl bg-gray-900">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-600">
              <th className="px-3 py-2 text-left">Team</th>
              {Array.from({ length: maxInning }, (_, i) => i + 1).map((inn) => (
                <th key={inn} className={`px-2 py-2 text-center ${inn === game.inning && isLive ? 'text-white' : ''}`}>
                  {inn}
                </th>
              ))}
              <th className="border-l border-gray-800 px-3 py-2 font-bold text-gray-400">R</th>
            </tr>
          </thead>
          <tbody>
            {[
              { label: game.homeTeam, team: 'home', total: game.homeScore },
              { label: game.awayTeam, team: 'away', total: game.awayScore },
            ].map(({ label, team, total }) => (
              <tr key={team} className="border-t border-gray-800 text-white">
                <td className="whitespace-nowrap px-3 py-2 font-semibold text-gray-300">{label}</td>
                {Array.from({ length: maxInning }, (_, i) => i + 1).map((inn) => {
                  const runs = grid[inn]?.[team] ?? 0
                  const isFuture = isLive && inn > game.inning
                  return (
                    <td key={inn} className={`px-2 py-2 text-center ${runs > 0 ? 'font-bold text-green-400' : 'text-gray-600'}`}>
                      {isFuture ? '—' : runs}
                    </td>
                  )
                })}
                <td className="border-l border-gray-800 px-3 py-2 text-center font-extrabold text-white">{total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-950">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
    </div>
  )
}
