import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getPlayer, getClub, getPlayerHistoricalPlays, subscribeToUser, followPlayer, unfollowPlayer } from '../firebase/firestore'
import { formatDate, nickDisplay } from '../lib/formatters'
import {
  BB_HIT_TYPES, BB_AT_BAT_TYPES, BB_PLAY_TYPES,
} from '../lib/baseballHelpers'

const SPORT_EMOJI = {
  basketball: '🏀', baseball: '⚾', softball: '🥎',
  soccer: '⚽', volleyball: '🏐', 'flag-football': '🏈',
}

function battingAvg(h, ab) {
  if (!ab) return '.000'
  return '.' + Math.round((h / ab) * 1000).toString().padStart(3, '0')
}

function groupPlaysByGame(plays) {
  const games = {}
  for (const play of plays) {
    const gid = play.gameId
    if (!games[gid]) games[gid] = { gameId: gid, plays: [] }
    games[gid].plays.push(play)
  }
  return Object.values(games)
}

function computeBaseballCareer(plays) {
  let ab = 0, h = 0, hr = 0, rbi = 0, bb = 0, k = 0, gp = new Set()
  for (const play of plays) {
    gp.add(play.gameId)
    if (BB_AT_BAT_TYPES.has(play.type)) ab++
    if (BB_HIT_TYPES.has(play.type)) h++
    if (play.type === BB_PLAY_TYPES.HOME_RUN) hr++
    if (play.type === BB_PLAY_TYPES.WALK || play.type === BB_PLAY_TYPES.HIT_BY_PITCH) bb++
    if (play.type === BB_PLAY_TYPES.STRIKEOUT) k++
    if (play.points) rbi += play.points
  }
  return { gp: gp.size, ab, h, hr, rbi, bb, k, avg: battingAvg(h, ab) }
}

function computeBaseballGame(plays) {
  let ab = 0, h = 0, hr = 0, rbi = 0, bb = 0, k = 0
  for (const play of plays) {
    if (BB_AT_BAT_TYPES.has(play.type)) ab++
    if (BB_HIT_TYPES.has(play.type)) h++
    if (play.type === BB_PLAY_TYPES.HOME_RUN) hr++
    if (play.type === BB_PLAY_TYPES.WALK || play.type === BB_PLAY_TYPES.HIT_BY_PITCH) bb++
    if (play.type === BB_PLAY_TYPES.STRIKEOUT) k++
    if (play.points) rbi += play.points
  }
  return { ab, h, hr, rbi, bb, k, avg: battingAvg(h, ab) }
}

function computeBasketballCareer(plays) {
  let pts = 0, reb = 0, ast = 0, stl = 0, blk = 0, gp = new Set()
  for (const play of plays) {
    gp.add(play.gameId)
    if (play.points) pts += play.points
    if (play.type === 'rebound') reb++
    if (play.type === 'assist') ast++
    if (play.type === 'steal') stl++
    if (play.type === 'block') blk++
  }
  const g = gp.size || 1
  return { gp: gp.size, pts, reb, ast, stl, blk, ppg: (pts / g).toFixed(1), rpg: (reb / g).toFixed(1), apg: (ast / g).toFixed(1) }
}

function computeBasketballGame(plays) {
  let pts = 0, reb = 0, ast = 0, stl = 0, blk = 0
  for (const play of plays) {
    if (play.points) pts += play.points
    if (play.type === 'rebound') reb++
    if (play.type === 'assist') ast++
    if (play.type === 'steal') stl++
    if (play.type === 'block') blk++
  }
  return { pts, reb, ast, stl, blk }
}

export default function PlayerPage() {
  const { clubId, playerId } = useParams()
  const { user } = useAuth()

  const [player, setPlayer]   = useState(null)
  const [club, setClub]       = useState(null)
  const [plays, setPlays]     = useState([])
  const [userDoc, setUserDoc] = useState(null)
  const [loading, setLoading] = useState(true)
  const [followLoading, setFollowLoading] = useState(false)
  const [showSignIn, setShowSignIn] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([getPlayer(clubId, playerId), getClub(clubId), getPlayerHistoricalPlays(playerId)])
      .then(([p, c, rawPlays]) => {
        setPlayer(p)
        setClub(c)
        setPlays(rawPlays)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [clubId, playerId])

  useEffect(() => {
    if (!user) return
    return subscribeToUser(user.uid, setUserDoc)
  }, [user])

  const isFollowing = userDoc?.followedPlayers?.some((p) => p.playerId === playerId) ?? false

  async function handleToggleFollow() {
    if (!user) { setShowSignIn(true); return }
    setFollowLoading(true)
    try {
      if (isFollowing) {
        await unfollowPlayer(user.uid, playerId)
      } else {
        await followPlayer(user.uid, {
          playerId,
          clubId,
          name: player.name,
          nickname: player.nickname || '',
          number: player.number || '',
          photoUrl: player.photoUrl || '',
          position: player.position || '',
          clubName: club?.name || '',
          clubSport: club?.sport || '',
        })
      }
    } finally {
      setFollowLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  if (!player || !club) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-950 text-gray-400">
        <p>Player not found.</p>
        <Link to="/" className="text-blue-400">← Home</Link>
      </div>
    )
  }

  const isBaseball = club.sport === 'baseball' || club.sport === 'softball'
  const sportEmoji = SPORT_EMOJI[club.sport] || '🏅'
  const displayName = nickDisplay(player.name, player.nickname)
  const byGame = groupPlaysByGame(plays).reverse().slice(0, 10)
  const careerBaseball = isBaseball ? computeBaseballCareer(plays) : null
  const careerBasketball = !isBaseball ? computeBasketballCareer(plays) : null

  return (
    <div className="min-h-screen bg-gray-950 pb-20 text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
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

      {/* Back nav */}
      <div className="flex items-center gap-3 overflow-x-auto border-b border-gray-800/50 px-4 py-2">
        <Link to={`/team/${clubId}`} className="flex-shrink-0 text-xs text-gray-500 hover:text-gray-300">
          ← {club.name}
        </Link>
      </div>

      {/* Player header */}
      <div className="border-b border-gray-800 bg-gray-900 px-5 py-6">
        <div className="mx-auto max-w-lg">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            {player.photoUrl ? (
              <img src={player.photoUrl} alt={player.name} className="h-20 w-20 shrink-0 rounded-2xl object-cover ring-2 ring-gray-700" />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-blue-900/50 text-3xl font-extrabold text-blue-300 ring-2 ring-gray-700">
                {player.number || player.name.charAt(0)}
              </div>
            )}

            <div className="min-w-0 flex-1">
              {player.nickname ? (
                <>
                  <h1 className="text-2xl font-extrabold text-white">"{player.nickname}"</h1>
                  <p className="text-sm text-gray-400">{player.name}</p>
                </>
              ) : (
                <h1 className="text-2xl font-extrabold text-white">{player.name}</h1>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {player.number && (
                  <span className="rounded-full bg-gray-800 px-2.5 py-0.5 text-xs font-bold text-gray-300">
                    #{player.number}
                  </span>
                )}
                {player.position && (
                  <span className="rounded-full bg-gray-800 px-2.5 py-0.5 text-xs text-gray-400">
                    {player.position}
                  </span>
                )}
              </div>
              <Link to={`/team/${clubId}`} className="mt-2 flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300">
                <span>{sportEmoji}</span>
                <span>{club.name}</span>
              </Link>
            </div>

            <button
              onClick={handleToggleFollow}
              disabled={followLoading}
              className={`shrink-0 rounded-xl px-4 py-2 text-sm font-bold transition active:scale-95 disabled:opacity-60 ${
                isFollowing
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-blue-600 text-white hover:bg-blue-500'
              }`}
            >
              {followLoading ? '…' : isFollowing ? '✓ Following' : '+ Follow'}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg space-y-6 px-5 pt-6">

        {/* Career stats */}
        {plays.length > 0 && (
          <section>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">Career Stats</p>
            {isBaseball ? (
              <div className="grid grid-cols-4 gap-2 rounded-2xl bg-gray-900 p-4 sm:grid-cols-7">
                {[
                  { label: 'GP', value: careerBaseball.gp },
                  { label: 'AVG', value: careerBaseball.avg },
                  { label: 'AB', value: careerBaseball.ab },
                  { label: 'H', value: careerBaseball.h },
                  { label: 'HR', value: careerBaseball.hr },
                  { label: 'RBI', value: careerBaseball.rbi },
                  { label: 'K', value: careerBaseball.k },
                ].map(({ label, value }) => (
                  <div key={label} className="text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-600">{label}</p>
                    <p className="mt-0.5 text-lg font-extrabold text-white">{value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2 rounded-2xl bg-gray-900 p-4 sm:grid-cols-7">
                {[
                  { label: 'GP', value: careerBasketball.gp },
                  { label: 'PPG', value: careerBasketball.ppg },
                  { label: 'RPG', value: careerBasketball.rpg },
                  { label: 'APG', value: careerBasketball.apg },
                  { label: 'PTS', value: careerBasketball.pts },
                  { label: 'REB', value: careerBasketball.reb },
                  { label: 'AST', value: careerBasketball.ast },
                ].map(({ label, value }) => (
                  <div key={label} className="text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-600">{label}</p>
                    <p className="mt-0.5 text-lg font-extrabold text-white">{value}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Recent game log */}
        {byGame.length > 0 && (
          <section>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Game Log (last {byGame.length})
            </p>
            <div className="overflow-x-auto rounded-2xl bg-gray-900">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-600">
                    <th className="px-3 py-2 text-left">Game</th>
                    {isBaseball ? (
                      <>
                        <th className="px-2 py-2 text-center">AB</th>
                        <th className="px-2 py-2 text-center font-bold text-white">H</th>
                        <th className="px-2 py-2 text-center">HR</th>
                        <th className="px-2 py-2 text-center">RBI</th>
                        <th className="px-2 py-2 text-center">AVG</th>
                      </>
                    ) : (
                      <>
                        <th className="px-2 py-2 text-center font-bold text-white">PTS</th>
                        <th className="px-2 py-2 text-center">REB</th>
                        <th className="px-2 py-2 text-center">AST</th>
                        <th className="px-2 py-2 text-center">STL</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {byGame.map(({ gameId, plays: gPlays }) => {
                    const stats = isBaseball
                      ? computeBaseballGame(gPlays)
                      : computeBasketballGame(gPlays)
                    return (
                      <tr key={gameId} className="border-t border-gray-800 text-white">
                        <td className="px-3 py-2">
                          <Link to={`/game/${gameId}`} className="text-blue-400 hover:text-blue-300">
                            View →
                          </Link>
                        </td>
                        {isBaseball ? (
                          <>
                            <td className="px-2 py-2 text-center text-gray-400">{stats.ab}</td>
                            <td className="px-2 py-2 text-center font-bold">{stats.h}</td>
                            <td className="px-2 py-2 text-center text-gray-400">{stats.hr}</td>
                            <td className="px-2 py-2 text-center text-gray-400">{stats.rbi}</td>
                            <td className="px-2 py-2 text-center font-mono text-blue-400">{stats.avg}</td>
                          </>
                        ) : (
                          <>
                            <td className="px-2 py-2 text-center font-extrabold text-blue-400">{stats.pts}</td>
                            <td className="px-2 py-2 text-center text-gray-400">{stats.reb}</td>
                            <td className="px-2 py-2 text-center text-gray-400">{stats.ast}</td>
                            <td className="px-2 py-2 text-center text-gray-400">{stats.stl}</td>
                          </>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {plays.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-800 py-14 text-center">
            <p className="text-sm text-gray-500">No recorded stats yet for {displayName}.</p>
          </div>
        )}
      </div>

      {/* Sign-in prompt */}
      {showSignIn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6"
          onClick={() => setShowSignIn(false)}>
          <div className="w-full max-w-xs rounded-2xl bg-gray-900 p-6 text-center"
            onClick={(e) => e.stopPropagation()}>
            <p className="mb-1 text-lg font-bold text-white">Sign in to follow</p>
            <p className="mb-5 text-sm text-gray-400">
              Get alerts when {displayName} does something notable.
            </p>
            <Link to="/login" className="btn-primary mb-3 block">Sign in / Sign up →</Link>
            <button onClick={() => setShowSignIn(false)} className="text-sm text-gray-500 hover:text-white">
              Maybe later
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
