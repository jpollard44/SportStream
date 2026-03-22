import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { PageSpinner } from '../components/ui'
import { getPlayer, getClub, getPlayerHistoricalPlays, getPlayerSeasonStats, subscribeToUser, followPlayer, unfollowPlayer, updatePlayer } from '../firebase/firestore'
import { useLiveGamePlayers } from '../hooks/useLiveGamePlayers'
import { uploadPlayerPhoto } from '../firebase/storage'
import { formatDate, nickDisplay } from '../lib/formatters'
import {
  BB_HIT_TYPES, BB_AT_BAT_TYPES, BB_PLAY_TYPES, SPORT_POSITIONS,
} from '../lib/baseballHelpers'

const SPORT_EMOJI = {
  basketball: '🏀', baseball: '⚾', softball: '🥎',
  soccer: '⚽', volleyball: '🏐', 'flag-football': '🏈',
}

// ── Edit Profile Modal ────────────────────────────────────────────────────────

function EditProfileModal({ player, club, clubId, playerId, onSave, onClose }) {
  const [nickname, setNickname] = useState(player.nickname || '')
  const [bio,      setBio]      = useState(player.bio      || '')
  const [position, setPosition] = useState(player.position || '')
  const [number,   setNumber]   = useState(player.number   || '')
  const [saving,   setSaving]   = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoUrl, setPhotoUrl] = useState(player.photoUrl || '')
  const [err,      setErr]      = useState('')
  const photoRef = useRef(null)

  const positions = SPORT_POSITIONS[club?.sport] || []

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoUploading(true)
    setErr('')
    try {
      const url = await uploadPlayerPhoto(clubId, playerId, file)
      await updatePlayer(clubId, playerId, { photoUrl: url })
      setPhotoUrl(url)
    } catch (ex) {
      setErr('Photo upload failed: ' + (ex?.message || 'unknown'))
    } finally {
      setPhotoUploading(false)
      e.target.value = ''
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setErr('')
    try {
      const updates = { nickname: nickname.trim(), bio: bio.trim(), position, number: number.trim() }
      await updatePlayer(clubId, playerId, updates)
      onSave({ ...updates, photoUrl })
    } catch (ex) {
      setErr(ex?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center"
      onClick={onClose}>
      <div className="w-full max-w-sm rounded-t-3xl bg-[#1a1f2e] p-6 space-y-4 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-white">Edit My Profile</h3>

        {/* Photo */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => photoRef.current?.click()}
            disabled={photoUploading}
            className="group relative shrink-0"
          >
            {photoUrl ? (
              <img src={photoUrl} alt="avatar" className="h-16 w-16 rounded-2xl object-cover ring-2 ring-gray-700 group-hover:ring-blue-500 transition" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-900/50 text-2xl font-bold text-blue-300 ring-2 ring-gray-700 group-hover:ring-blue-500 transition">
                {photoUploading
                  ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
                  : (player.number || player.name.charAt(0))}
              </div>
            )}
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white shadow">✏</span>
          </button>
          <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          <div className="text-xs text-gray-400">
            <p className="font-semibold text-white">{player.name}</p>
            <p>Tap to change photo</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Nickname</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder='e.g. "Ace"'
              className="input"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A short bio about yourself…"
              rows={2}
              className="input resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">Jersey #</label>
              <input
                type="text"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="#"
                maxLength={3}
                className="input text-center"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">Position</label>
              <select value={position} onChange={(e) => setPosition(e.target.value)} className="input">
                <option value="">—</option>
                {positions.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {err && <p className="rounded-xl bg-red-900/40 px-3 py-2 text-xs text-red-300">{err}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving || photoUploading} className="btn-primary flex-1">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
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

  const [player, setPlayer]         = useState(null)
  const [club, setClub]             = useState(null)
  const [plays, setPlays]           = useState([])
  const [seasonStats, setSeasonStats] = useState(null)
  const [userDoc, setUserDoc]       = useState(null)
  const [loading, setLoading]       = useState(true)
  const [followLoading, setFollowLoading] = useState(false)
  const [showSignIn, setShowSignIn] = useState(false)
  const [showEditProfile, setShowEditProfile] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getPlayer(clubId, playerId),
      getClub(clubId),
      getPlayerHistoricalPlays(playerId),
      getPlayerSeasonStats(clubId, playerId),
    ])
      .then(([p, c, rawPlays, ss]) => {
        setPlayer(p)
        setClub(c)
        setPlays(rawPlays)
        setSeasonStats(ss)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [clubId, playerId])

  useEffect(() => {
    if (!user) return
    return subscribeToUser(user.uid, setUserDoc)
  }, [user])

  const { livePlayerIds, liveGameId } = useLiveGamePlayers(clubId)
  const isLiveNow = livePlayerIds.has(playerId)

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
    return <PageSpinner />
  }

  if (!player || !club) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#0f1117] text-gray-400">
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

      {/* Back nav */}
      <div className="flex items-center gap-3 overflow-x-auto border-b border-white/10 px-4 py-2">
        <Link to={`/team/${clubId}`} className="flex-shrink-0 text-xs text-gray-500 hover:text-gray-300">
          ← {club.name}
        </Link>
      </div>

      {/* Player header */}
      <div className="border-b border-white/5 bg-[#1a1f2e] px-5 py-6">
        <div className="mx-auto max-w-lg">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            {player.photoUrl ? (
              <img src={player.photoUrl} alt={player.name} className="h-20 w-20 shrink-0 rounded-2xl object-cover ring-2 ring-white/10" />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-blue-900/50 text-3xl font-extrabold text-blue-300 ring-2 ring-white/10">
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
                  <span className="rounded-full bg-[#242938] px-2.5 py-0.5 text-xs font-bold text-gray-300">
                    #{player.number}
                  </span>
                )}
                {player.position && (
                  <span className="rounded-full bg-[#242938] px-2.5 py-0.5 text-xs text-gray-400">
                    {player.position}
                  </span>
                )}
                {isLiveNow && liveGameId && (
                  <Link
                    to={`/game/${liveGameId}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-green-900/60 px-3 py-1 text-xs font-bold text-green-300 ring-1 ring-green-800/40 hover:bg-green-900/80 transition"
                  >
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                    LIVE NOW — Watch →
                  </Link>
                )}
              </div>
              {player.bio && (
                <p className="mt-1.5 text-xs text-gray-400 leading-relaxed line-clamp-2">{player.bio}</p>
              )}
              <Link to={`/team/${clubId}`} className="mt-2 flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300">
                <span>{sportEmoji}</span>
                <span>{club.name}</span>
              </Link>
            </div>

            {user?.uid === player.uid ? (
              <button
                onClick={() => setShowEditProfile(true)}
                className="shrink-0 rounded-xl bg-gray-700 px-4 py-2 text-sm font-bold text-white hover:bg-gray-600 transition active:scale-95"
              >
                Edit Profile
              </button>
            ) : (
              <button
                onClick={handleToggleFollow}
                disabled={followLoading}
                className={`shrink-0 rounded-xl px-4 py-2 text-sm font-bold transition active:scale-95 disabled:opacity-60 ${
                  isFollowing
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-blue-600 text-white hover:bg-blue-500'
                }`}
              >
                {followLoading ? '…' : isFollowing ? '✓ Fan' : '+ Be a Fan'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg space-y-6 px-5 pt-6">

        {/* Season Stats (from persisted aggregation) */}
        {seasonStats && (
          <section>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">This Season</p>
            {isBaseball ? (
              <div className="grid grid-cols-4 gap-2 rounded-2xl bg-[#1a1f2e] p-4 sm:grid-cols-8">
                {[
                  { label: 'GP', value: seasonStats.gamesPlayed ?? 0 },
                  { label: 'AVG', value: battingAvg(seasonStats.h ?? 0, seasonStats.ab ?? 0) },
                  { label: 'AB', value: seasonStats.ab ?? 0 },
                  { label: 'H', value: seasonStats.h ?? 0 },
                  { label: 'HR', value: seasonStats.hr ?? 0 },
                  { label: 'RBI', value: seasonStats.rbi ?? 0 },
                  { label: 'BB', value: seasonStats.bb ?? 0 },
                  { label: 'K', value: seasonStats.k ?? 0 },
                ].map(({ label, value }) => (
                  <div key={label} className="text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-600">{label}</p>
                    <p className="mt-0.5 text-lg font-extrabold text-blue-400">{value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2 rounded-2xl bg-[#1a1f2e] p-4 sm:grid-cols-7">
                {(() => {
                  const gp = seasonStats.gamesPlayed || 1
                  return [
                    { label: 'GP', value: seasonStats.gamesPlayed ?? 0 },
                    { label: 'PPG', value: ((seasonStats.pts ?? 0) / gp).toFixed(1) },
                    { label: 'RPG', value: ((seasonStats.reb ?? 0) / gp).toFixed(1) },
                    { label: 'APG', value: ((seasonStats.ast ?? 0) / gp).toFixed(1) },
                    { label: 'PTS', value: seasonStats.pts ?? 0 },
                    { label: 'REB', value: seasonStats.reb ?? 0 },
                    { label: 'AST', value: seasonStats.ast ?? 0 },
                  ]
                })().map(({ label, value }) => (
                  <div key={label} className="text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-600">{label}</p>
                    <p className="mt-0.5 text-lg font-extrabold text-blue-400">{value}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Career stats */}
        {plays.length > 0 && (
          <section>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">Career Stats</p>
            {isBaseball ? (
              <div className="grid grid-cols-4 gap-2 rounded-2xl bg-[#1a1f2e] p-4 sm:grid-cols-7">
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
              <div className="grid grid-cols-4 gap-2 rounded-2xl bg-[#1a1f2e] p-4 sm:grid-cols-7">
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
            <div className="overflow-x-auto rounded-2xl bg-[#1a1f2e]">
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
                      <tr key={gameId} className="border-t border-white/5 text-white">
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
          <div className="rounded-2xl border border-dashed border-white/10 py-14 text-center">
            <p className="text-sm text-gray-500">No recorded stats yet for {displayName}.</p>
          </div>
        )}
      </div>

      {/* Edit My Profile modal */}
      {showEditProfile && (
        <EditProfileModal
          player={player}
          club={club}
          clubId={clubId}
          playerId={playerId}
          onSave={(updated) => { setPlayer((p) => ({ ...p, ...updated })); setShowEditProfile(false) }}
          onClose={() => setShowEditProfile(false)}
        />
      )}

      {/* Sign-in prompt */}
      {showSignIn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6"
          onClick={() => setShowSignIn(false)}>
          <div className="w-full max-w-xs rounded-2xl bg-[#1a1f2e] p-6 text-center"
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
