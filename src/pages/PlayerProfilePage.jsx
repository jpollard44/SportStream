import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { PageSpinner } from '../components/ui'
import {
  subscribeToPlayerProfile, updatePlayerProfile,
  getPlayerStats, getPlayerClubMemberships,
  subscribeToPlayerHighlights, subscribeToUser,
  followPlayer, unfollowPlayer, getClub,
} from '../firebase/firestore'
import { uploadPlayerPhoto } from '../firebase/storage'
import { formatDate } from '../lib/formatters'

const SPORT_EMOJI = {
  basketball: '🏀', baseball: '⚾', softball: '🥎',
  soccer: '⚽', volleyball: '🏐', 'flag-football': '🏈',
}

const SPORT_LABEL = {
  basketball: 'Basketball', baseball: 'Baseball', softball: 'Softball',
  soccer: 'Soccer', volleyball: 'Volleyball', 'flag-football': 'Flag Football',
}

// ── Stat aggregation helpers ───────────────────────────────────────────────────

function battingAvg(h, ab) {
  if (!ab) return '.000'
  return '.' + Math.round((h / ab) * 1000).toString().padStart(3, '0')
}

function pct(made, att) {
  if (!att) return '—'
  return (made / att * 100).toFixed(1) + '%'
}

function sumStats(statDocs, sport) {
  if (!statDocs.length) return null
  if (sport === 'baseball' || sport === 'softball') {
    const totals = { atBats: 0, hits: 0, doubles: 0, triples: 0, homeRuns: 0, runs: 0, rbi: 0, walks: 0, strikeouts: 0, stolenBases: 0, gp: 0 }
    for (const s of statDocs) {
      totals.gp++
      totals.atBats     += s.atBats     || 0
      totals.hits       += s.hits       || 0
      totals.doubles    += s.doubles    || 0
      totals.triples    += s.triples    || 0
      totals.homeRuns   += s.homeRuns   || 0
      totals.runs       += s.runs       || 0
      totals.rbi        += s.rbi        || 0
      totals.walks      += s.walks      || 0
      totals.strikeouts += s.strikeouts || 0
      totals.stolenBases+= s.stolenBases|| 0
    }
    totals.avg = battingAvg(totals.hits, totals.atBats)
    return totals
  }
  if (sport === 'basketball') {
    const totals = { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0, fgAttempts: 0, fgMade: 0, threeAttempts: 0, threeMade: 0, ftAttempts: 0, ftMade: 0, gp: 0 }
    for (const s of statDocs) {
      totals.gp++
      totals.points       += s.points       || 0
      totals.rebounds     += s.rebounds     || 0
      totals.assists      += s.assists      || 0
      totals.steals       += s.steals       || 0
      totals.blocks       += s.blocks       || 0
      totals.turnovers    += s.turnovers    || 0
      totals.fgAttempts   += s.fgAttempts   || 0
      totals.fgMade       += s.fgMade       || 0
      totals.threeAttempts+= s.threeAttempts|| 0
      totals.threeMade    += s.threeMade    || 0
      totals.ftAttempts   += s.ftAttempts   || 0
      totals.ftMade       += s.ftMade       || 0
    }
    const g = totals.gp || 1
    totals.ppg  = (totals.points   / g).toFixed(1)
    totals.rpg  = (totals.rebounds / g).toFixed(1)
    totals.apg  = (totals.assists  / g).toFixed(1)
    totals.fgPct  = pct(totals.fgMade, totals.fgAttempts)
    totals.threePct = pct(totals.threeMade, totals.threeAttempts)
    return totals
  }
  return null
}

function groupByOpponent(statDocs, sport) {
  const groups = {}
  for (const s of statDocs) {
    const key = s.opponentName || 'Unknown'
    if (!groups[key]) groups[key] = []
    groups[key].push(s)
  }
  return Object.entries(groups).map(([opp, docs]) => ({
    opponent: opp, games: docs.length, totals: sumStats(docs, sport),
  })).sort((a, b) => b.games - a.games)
}

// ── Baseball stat grids ────────────────────────────────────────────────────────

function BaseballTotalGrid({ t }) {
  if (!t) return null
  const cells = [
    { label: 'GP',  value: t.gp },
    { label: 'AVG', value: t.avg },
    { label: 'AB',  value: t.atBats },
    { label: 'H',   value: t.hits },
    { label: '2B',  value: t.doubles },
    { label: '3B',  value: t.triples },
    { label: 'HR',  value: t.homeRuns },
    { label: 'R',   value: t.runs },
    { label: 'RBI', value: t.rbi },
    { label: 'BB',  value: t.walks },
    { label: 'K',   value: t.strikeouts },
    { label: 'SB',  value: t.stolenBases },
  ]
  return (
    <div className="grid grid-cols-4 gap-2 rounded-2xl bg-[#1a1f2e] p-4 sm:grid-cols-6">
      {cells.map(({ label, value }) => (
        <div key={label} className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-600">{label}</p>
          <p className="mt-0.5 text-base font-extrabold text-white">{value ?? 0}</p>
        </div>
      ))}
    </div>
  )
}

function BasketballTotalGrid({ t }) {
  if (!t) return null
  const cells = [
    { label: 'GP',   value: t.gp },
    { label: 'PPG',  value: t.ppg },
    { label: 'RPG',  value: t.rpg },
    { label: 'APG',  value: t.apg },
    { label: 'PTS',  value: t.points },
    { label: 'REB',  value: t.rebounds },
    { label: 'AST',  value: t.assists },
    { label: 'STL',  value: t.steals },
    { label: 'BLK',  value: t.blocks },
    { label: 'FG%',  value: t.fgPct },
    { label: '3P%',  value: t.threePct },
  ]
  return (
    <div className="grid grid-cols-4 gap-2 rounded-2xl bg-[#1a1f2e] p-4 sm:grid-cols-6">
      {cells.map(({ label, value }) => (
        <div key={label} className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-600">{label}</p>
          <p className="mt-0.5 text-base font-extrabold text-white">{value ?? 0}</p>
        </div>
      ))}
    </div>
  )
}

function BaseballByGameTable({ statDocs }) {
  const rows = [...statDocs].sort((a, b) => (b.gameDate || '').localeCompare(a.gameDate || ''))
  return (
    <div className="overflow-x-auto rounded-2xl bg-[#1a1f2e]">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-600 text-left">
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Opponent</th>
            <th className="px-2 py-2 text-center">AB</th>
            <th className="px-2 py-2 text-center font-bold text-white">H</th>
            <th className="px-2 py-2 text-center">HR</th>
            <th className="px-2 py-2 text-center">RBI</th>
            <th className="px-2 py-2 text-center">BB</th>
            <th className="px-2 py-2 text-center text-blue-400">AVG</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} className="border-t border-white/5 text-white">
              <td className="px-3 py-2 text-gray-400 whitespace-nowrap">
                <Link to={`/game/${s.gameId}`} className="hover:text-blue-400 transition">{s.gameDate || '—'}</Link>
              </td>
              <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{s.opponentName || '—'}</td>
              <td className="px-2 py-2 text-center text-gray-400">{s.atBats ?? 0}</td>
              <td className="px-2 py-2 text-center font-bold">{s.hits ?? 0}</td>
              <td className="px-2 py-2 text-center text-gray-400">{s.homeRuns ?? 0}</td>
              <td className="px-2 py-2 text-center text-gray-400">{s.rbi ?? 0}</td>
              <td className="px-2 py-2 text-center text-gray-400">{s.walks ?? 0}</td>
              <td className="px-2 py-2 text-center font-mono text-blue-400">{battingAvg(s.hits, s.atBats)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BasketballByGameTable({ statDocs }) {
  const rows = [...statDocs].sort((a, b) => (b.gameDate || '').localeCompare(a.gameDate || ''))
  return (
    <div className="overflow-x-auto rounded-2xl bg-[#1a1f2e]">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-600 text-left">
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Opponent</th>
            <th className="px-2 py-2 text-center font-bold text-white">PTS</th>
            <th className="px-2 py-2 text-center">REB</th>
            <th className="px-2 py-2 text-center">AST</th>
            <th className="px-2 py-2 text-center">STL</th>
            <th className="px-2 py-2 text-center">BLK</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} className="border-t border-white/5 text-white">
              <td className="px-3 py-2 text-gray-400 whitespace-nowrap">
                <Link to={`/game/${s.gameId}`} className="hover:text-blue-400 transition">{s.gameDate || '—'}</Link>
              </td>
              <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{s.opponentName || '—'}</td>
              <td className="px-2 py-2 text-center font-extrabold text-blue-400">{s.points ?? 0}</td>
              <td className="px-2 py-2 text-center text-gray-400">{s.rebounds ?? 0}</td>
              <td className="px-2 py-2 text-center text-gray-400">{s.assists ?? 0}</td>
              <td className="px-2 py-2 text-center text-gray-400">{s.steals ?? 0}</td>
              <td className="px-2 py-2 text-center text-gray-400">{s.blocks ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BaseballByOpponentTable({ groups }) {
  return (
    <div className="overflow-x-auto rounded-2xl bg-[#1a1f2e]">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-600 text-left">
            <th className="px-3 py-2">Opponent</th>
            <th className="px-2 py-2 text-center">G</th>
            <th className="px-2 py-2 text-center">AB</th>
            <th className="px-2 py-2 text-center font-bold text-white">H</th>
            <th className="px-2 py-2 text-center">HR</th>
            <th className="px-2 py-2 text-center">RBI</th>
            <th className="px-2 py-2 text-center text-blue-400">AVG</th>
          </tr>
        </thead>
        <tbody>
          {groups.map(({ opponent, games, totals: t }) => (
            <tr key={opponent} className="border-t border-white/5 text-white">
              <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{opponent}</td>
              <td className="px-2 py-2 text-center text-gray-400">{games}</td>
              <td className="px-2 py-2 text-center text-gray-400">{t?.atBats ?? 0}</td>
              <td className="px-2 py-2 text-center font-bold">{t?.hits ?? 0}</td>
              <td className="px-2 py-2 text-center text-gray-400">{t?.homeRuns ?? 0}</td>
              <td className="px-2 py-2 text-center text-gray-400">{t?.rbi ?? 0}</td>
              <td className="px-2 py-2 text-center font-mono text-blue-400">{t?.avg || '.000'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BasketballByOpponentTable({ groups }) {
  return (
    <div className="overflow-x-auto rounded-2xl bg-[#1a1f2e]">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-600 text-left">
            <th className="px-3 py-2">Opponent</th>
            <th className="px-2 py-2 text-center">G</th>
            <th className="px-2 py-2 text-center font-bold text-white">PTS</th>
            <th className="px-2 py-2 text-center">REB</th>
            <th className="px-2 py-2 text-center">AST</th>
            <th className="px-2 py-2 text-center">STL</th>
          </tr>
        </thead>
        <tbody>
          {groups.map(({ opponent, games, totals: t }) => (
            <tr key={opponent} className="border-t border-white/5 text-white">
              <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{opponent}</td>
              <td className="px-2 py-2 text-center text-gray-400">{games}</td>
              <td className="px-2 py-2 text-center font-extrabold text-blue-400">{t?.points ?? 0}</td>
              <td className="px-2 py-2 text-center text-gray-400">{t?.rebounds ?? 0}</td>
              <td className="px-2 py-2 text-center text-gray-400">{t?.assists ?? 0}</td>
              <td className="px-2 py-2 text-center text-gray-400">{t?.steals ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Edit Profile Modal ─────────────────────────────────────────────────────────

function EditProfileModal({ profile, uid, onSave, onClose }) {
  const [displayName, setDisplayName] = useState(profile.displayName || '')
  const [nickname,    setNickname]    = useState(profile.nickname    || '')
  const [bio,         setBio]         = useState(profile.bio         || '')
  const [photoUrl,    setPhotoUrl]    = useState(profile.photoUrl    || '')
  const [saving,      setSaving]      = useState(false)
  const [uploading,   setUploading]   = useState(false)
  const [err,         setErr]         = useState('')
  const photoRef = useRef(null)

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setErr('')
    try {
      // Upload to player-level storage path
      const url = await uploadPlayerPhoto('profiles', uid, file)
      await updatePlayerProfile(uid, { photoURL: url })
      setPhotoUrl(url)
    } catch (ex) {
      setErr('Photo upload failed: ' + (ex?.message || 'unknown'))
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setErr('')
    try {
      await updatePlayerProfile(uid, {
        displayName: displayName.trim(),
        nickname:    nickname.trim(),
        bio:         bio.trim(),
      })
      onSave({ displayName: displayName.trim(), nickname: nickname.trim(), bio: bio.trim(), photoUrl })
    } catch (ex) {
      setErr(ex?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const initials = (displayName || 'P').charAt(0).toUpperCase()

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-sm rounded-t-3xl bg-[#1a1f2e] p-6 space-y-4 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-white">Edit My Profile</h3>

        <div className="flex items-center gap-4">
          <button type="button" onClick={() => photoRef.current?.click()} disabled={uploading} className="group relative shrink-0">
            {photoUrl ? (
              <img src={photoUrl} alt="avatar" className="h-16 w-16 rounded-2xl object-cover ring-2 ring-gray-700 group-hover:ring-blue-500 transition" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-900/50 text-2xl font-bold text-blue-300 ring-2 ring-gray-700 group-hover:ring-blue-500 transition">
                {uploading ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" /> : initials}
              </div>
            )}
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white shadow">✏</span>
          </button>
          <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          <p className="text-xs text-gray-400">Tap to change photo</p>
        </div>

        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Display Name</label>
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="input" placeholder="Your full name" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Nickname</label>
            <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder='e.g. "Ace"' className="input" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Bio</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="A short bio…" rows={2} className="input resize-none" />
          </div>
          {err && <p className="rounded-xl bg-red-900/40 px-3 py-2 text-xs text-red-300">{err}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving || uploading} className="btn-primary flex-1">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function PlayerProfilePage() {
  const { uid: playerUid } = useParams()
  const { user } = useAuth()

  const [profile,     setProfile]     = useState(null)
  const [memberships, setMemberships] = useState([])
  const [allStats,    setAllStats]    = useState([])
  const [highlights,  setHighlights]  = useState([])
  const [userDoc,     setUserDoc]     = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [showEdit,    setShowEdit]    = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [showSignIn,  setShowSignIn]  = useState(false)

  // Filter state
  const [selectedSport,   setSelectedSport]   = useState(null)
  const [selectedView,    setSelectedView]    = useState('totals') // totals | bygame | byopponent | career
  const [selectedYear,    setSelectedYear]    = useState('all')
  const [selectedContext, setSelectedContext] = useState('all')

  useEffect(() => {
    if (!playerUid) return
    setLoading(true)

    const unsub = subscribeToPlayerProfile(playerUid, (p) => {
      setProfile(p)
      setLoading(false)
    })

    Promise.all([
      getPlayerStats(playerUid),
      getPlayerClubMemberships(playerUid),
    ]).then(([stats, mems]) => {
      setAllStats(stats)
      setMemberships(mems)
      // Default to first sport found
      const sports = [...new Set(stats.map(s => s.sport).filter(Boolean))]
      if (sports.length && !selectedSport) setSelectedSport(sports[0])
    }).catch(() => {})

    return unsub
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerUid])

  // Subscribe to highlights using any known roster player IDs
  useEffect(() => {
    if (!playerUid) return
    // We use an empty array for extraPlayerIds on first load; highlights query uses only uid
    const unsub = subscribeToPlayerHighlights(playerUid, [], setHighlights)
    return unsub
  }, [playerUid])

  useEffect(() => {
    if (!user) return
    return subscribeToUser(user.uid, setUserDoc)
  }, [user])

  // Derive available sports and years from stats
  const availableSports = useMemo(() => [...new Set(allStats.map(s => s.sport).filter(Boolean))], [allStats])
  const availableYears  = useMemo(() => [...new Set(allStats.map(s => s.season).filter(Boolean))].sort().reverse(), [allStats])

  // Available league/tournament contexts
  const contexts = useMemo(() => {
    const map = new Map()
    for (const s of allStats) {
      if (s.leagueId && s.leagueName)         map.set(`league:${s.leagueId}`, `League: ${s.leagueName}`)
      if (s.tournamentId && s.tournamentName) map.set(`tournament:${s.tournamentId}`, `Tournament: ${s.tournamentName}`)
    }
    return Array.from(map.entries()).map(([key, label]) => ({ key, label }))
  }, [allStats])

  // Active sport (fall back to first available)
  const activeSport = selectedSport || availableSports[0] || null

  // Filtered stat docs
  const filtered = useMemo(() => {
    return allStats.filter((s) => {
      if (activeSport && s.sport !== activeSport) return false
      if (selectedYear !== 'all' && s.season !== selectedYear) return false
      if (selectedContext !== 'all') {
        const [type, id] = selectedContext.split(':')
        if (type === 'league'     && s.leagueId     !== id) return false
        if (type === 'tournament' && s.tournamentId !== id) return false
      }
      return true
    })
  }, [allStats, activeSport, selectedYear, selectedContext])

  const totals      = useMemo(() => sumStats(filtered, activeSport), [filtered, activeSport])
  const careerTotals = useMemo(() => sumStats(allStats.filter(s => activeSport && s.sport === activeSport), activeSport), [allStats, activeSport])
  const byOpponent  = useMemo(() => groupByOpponent(filtered, activeSport), [filtered, activeSport])
  const isBaseball  = activeSport === 'baseball' || activeSport === 'softball'

  const isFollowing   = userDoc?.followedPlayers?.some((p) => p.playerId === playerUid) ?? false
  const isOwnProfile  = user?.uid === playerUid
  const displayName   = profile?.displayName || profile?.name || 'Player'
  const nickname      = profile?.nickname
  const photoUrl      = profile?.photoUrl || profile?.photoURL

  async function handleToggleFollow() {
    if (!user) { setShowSignIn(true); return }
    setFollowLoading(true)
    try {
      if (isFollowing) {
        await unfollowPlayer(user.uid, playerUid)
      } else {
        await followPlayer(user.uid, {
          playerId: playerUid,
          clubId:   memberships[0]?.clubId || '',
          name:     displayName,
          nickname: nickname || '',
          number:   '',
          photoUrl: photoUrl || '',
          position: '',
          clubName: memberships[0]?.clubName || '',
          clubSport: activeSport || '',
        })
      }
    } finally {
      setFollowLoading(false)
    }
  }

  if (loading) return <PageSpinner />

  if (!profile) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#0f1117] text-gray-400">
        <p>Player not found.</p>
        <Link to="/" className="text-blue-400">← Home</Link>
      </div>
    )
  }

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
      <div className="border-b border-white/5 bg-[#1a1f2e] px-5 py-6">
        <div className="mx-auto max-w-lg">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            {photoUrl ? (
              <img src={photoUrl} alt={displayName} className="h-20 w-20 shrink-0 rounded-2xl object-cover ring-2 ring-white/10" />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-blue-900/50 text-3xl font-extrabold text-blue-300 ring-2 ring-white/10">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="min-w-0 flex-1">
              {nickname ? (
                <>
                  <h1 className="text-2xl font-extrabold text-white">"{nickname}"</h1>
                  <p className="text-sm text-gray-400">{displayName}</p>
                </>
              ) : (
                <h1 className="text-2xl font-extrabold text-white">{displayName}</h1>
              )}

              {/* Sports badges */}
              {availableSports.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {availableSports.map((s) => (
                    <span key={s} className="rounded-full bg-[#242938] px-2.5 py-0.5 text-xs font-medium text-gray-300">
                      {SPORT_EMOJI[s]} {SPORT_LABEL[s] || s}
                    </span>
                  ))}
                </div>
              )}

              {profile.bio && (
                <p className="mt-1.5 text-xs text-gray-400 leading-relaxed line-clamp-2">{profile.bio}</p>
              )}
            </div>

            {/* Action button */}
            {isOwnProfile ? (
              <button
                onClick={() => setShowEdit(true)}
                className="shrink-0 rounded-xl bg-gray-700 px-4 py-2 text-sm font-bold text-white hover:bg-gray-600 transition active:scale-95"
              >
                Edit Profile
              </button>
            ) : (
              <button
                onClick={handleToggleFollow}
                disabled={followLoading}
                className={`shrink-0 rounded-xl px-4 py-2 text-sm font-bold transition active:scale-95 disabled:opacity-60 ${
                  isFollowing ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-blue-600 text-white hover:bg-blue-500'
                }`}
              >
                {followLoading ? '…' : isFollowing ? '✓ Fan' : '+ Be a Fan'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg space-y-6 px-5 pt-6">

        {/* Teams */}
        {memberships.length > 0 && (
          <section>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">Teams</p>
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
              {memberships.map((m) => (
                <Link
                  key={m.id}
                  to={`/team/${m.clubId}`}
                  className="shrink-0 flex flex-col gap-1.5 rounded-2xl bg-[#1a1f2e] p-4 ring-1 ring-white/5 hover:ring-white/10 transition min-w-[140px]"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-900/50 text-sm font-bold text-blue-300">
                      {(m.clubName || '?').charAt(0)}
                    </div>
                    <span className="text-xs font-semibold text-white line-clamp-2 leading-tight">{m.clubName}</span>
                  </div>
                  <p className="text-[10px] text-gray-500">{SPORT_EMOJI[m.sport]} {SPORT_LABEL[m.sport] || m.sport}</p>
                  {(m.jerseyNumber || m.position) && (
                    <p className="text-[10px] text-gray-400">
                      {m.jerseyNumber ? `#${m.jerseyNumber}` : ''}{m.jerseyNumber && m.position ? ' · ' : ''}{m.position}
                    </p>
                  )}
                  <span className={`self-start rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    m.active ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-500'
                  }`}>
                    {m.active ? 'Active' : 'Inactive'}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Stats */}
        <section>
          <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">Stats</p>

          {allStats.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center">
              <p className="text-sm text-gray-500">No stats yet for {displayName}.</p>
            </div>
          ) : (
            <>
              {/* Sport tabs */}
              {availableSports.length > 1 && (
                <div className="mb-3 flex gap-2 overflow-x-auto">
                  {availableSports.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSelectedSport(s)}
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${
                        activeSport === s ? 'bg-blue-600 text-white' : 'bg-[#242938] text-gray-400 hover:text-white'
                      }`}
                    >
                      {SPORT_EMOJI[s]} {SPORT_LABEL[s] || s}
                    </button>
                  ))}
                </div>
              )}

              {/* Filter row */}
              <div className="mb-4 flex flex-wrap gap-2">
                {/* View selector */}
                <div className="flex rounded-xl bg-[#1a1f2e] p-0.5">
                  {[
                    { key: 'totals', label: 'Season' },
                    { key: 'bygame', label: 'By Game' },
                    { key: 'byopponent', label: 'By Opp' },
                    { key: 'career', label: 'Career' },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setSelectedView(key)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        selectedView === key ? 'bg-blue-600 text-white shadow' : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Year */}
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="rounded-xl bg-[#1a1f2e] px-3 py-1.5 text-xs font-semibold text-gray-300 border border-white/5 focus:outline-none"
                >
                  <option value="all">All Time</option>
                  {availableYears.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>

                {/* Context */}
                {contexts.length > 0 && (
                  <select
                    value={selectedContext}
                    onChange={(e) => setSelectedContext(e.target.value)}
                    className="rounded-xl bg-[#1a1f2e] px-3 py-1.5 text-xs font-semibold text-gray-300 border border-white/5 focus:outline-none"
                  >
                    <option value="all">All</option>
                    {contexts.map(({ key, label }) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Stat display */}
              {selectedView === 'totals' && (
                filtered.length === 0
                  ? <p className="text-sm text-gray-500">No games match these filters.</p>
                  : isBaseball
                    ? <BaseballTotalGrid t={totals} />
                    : <BasketballTotalGrid t={totals} />
              )}

              {selectedView === 'career' && (
                isBaseball
                  ? <BaseballTotalGrid t={careerTotals} />
                  : <BasketballTotalGrid t={careerTotals} />
              )}

              {selectedView === 'bygame' && (
                filtered.length === 0
                  ? <p className="text-sm text-gray-500">No games match these filters.</p>
                  : isBaseball
                    ? <BaseballByGameTable statDocs={filtered} />
                    : <BasketballByGameTable statDocs={filtered} />
              )}

              {selectedView === 'byopponent' && (
                byOpponent.length === 0
                  ? <p className="text-sm text-gray-500">No games match these filters.</p>
                  : isBaseball
                    ? <BaseballByOpponentTable groups={byOpponent} />
                    : <BasketballByOpponentTable groups={byOpponent} />
              )}
            </>
          )}
        </section>

        {/* Highlights */}
        {highlights.length > 0 && (
          <section>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">Highlights</p>
            <div className="space-y-2">
              {highlights.map((h) => (
                <Link
                  key={h.id}
                  to={`/game/${h.gameId}`}
                  className="block rounded-2xl bg-[#1a1f2e] p-4 ring-1 ring-white/5 hover:ring-white/10 transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-white text-sm">{h.playerName} {h.playDescription}</p>
                      {h.gameContext && <p className="mt-0.5 text-xs text-gray-500">{h.gameContext}</p>}
                    </div>
                    <span className="shrink-0 text-lg">
                      {(h.reactions?.fire || 0) > 0 && '🔥'}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-gray-600">{h.homeTeam} vs {h.awayTeam}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Wall of Fame link */}
        <div className="text-center">
          <Link to="/wall-of-fame" className="text-xs text-blue-400 hover:text-blue-300">
            Wall of Fame →
          </Link>
        </div>
      </div>

      {/* Edit modal */}
      {showEdit && (
        <EditProfileModal
          profile={profile}
          uid={playerUid}
          onSave={(updated) => {
            setProfile((p) => ({ ...p, ...updated }))
            setShowEdit(false)
          }}
          onClose={() => setShowEdit(false)}
        />
      )}

      {/* Sign-in prompt */}
      {showSignIn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6" onClick={() => setShowSignIn(false)}>
          <div className="w-full max-w-xs rounded-2xl bg-[#1a1f2e] p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <p className="mb-1 text-lg font-bold text-white">Sign in to follow</p>
            <p className="mb-5 text-sm text-gray-400">Get alerts when {displayName} does something notable.</p>
            <Link to="/login" className="btn-primary mb-3 block">Sign in / Sign up →</Link>
            <button onClick={() => setShowSignIn(false)} className="text-sm text-gray-500 hover:text-white">Maybe later</button>
          </div>
        </div>
      )}
    </div>
  )
}
