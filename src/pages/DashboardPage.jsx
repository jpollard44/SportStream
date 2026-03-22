import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  subscribeToUserClubs, createClub, deleteClub,
  subscribeToUser, subscribeToFollowedGames,
  searchClubs, getClub, followClub, unfollowClub,
  subscribeLiveGames, getClubRecord, unfollowPlayer,
  getClaimedPlayerProfile, getRecentPlaysForPlayers,
} from '../firebase/firestore'
import { subscribeToUserTournaments, deleteTournament } from '../firebase/tournaments'
import { subscribeToUserLeagues, deleteLeague } from '../firebase/leagues'
import { logout } from '../firebase/auth'
import { formatDate } from '../lib/formatters'

const SPORTS = ['basketball', 'baseball', 'softball', 'soccer', 'volleyball', 'flag-football']
const SPORT_ICON = {
  basketball: '🏀', baseball: '⚾', softball: '🥎',
  soccer: '⚽', volleyball: '🏐', 'flag-football': '🏈',
}

function RecordBadge({ record }) {
  if (!record) return null
  return (
    <span className="shrink-0 rounded-full bg-gray-800 px-2 py-0.5 text-[10px] font-bold tabular-nums text-gray-400">
      {record.str}
    </span>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('home')
  const [clubs, setClubs] = useState([])
  const [tournaments, setTournaments] = useState([])
  const [leagues, setLeagues] = useState([])
  const [followedClubs, setFollowedClubs] = useState([])
  const [followedPlayers, setFollowedPlayers] = useState([])
  const [followedClubData, setFollowedClubData] = useState([])
  const [followedGames, setFollowedGames] = useState([])
  const [liveGames, setLiveGames] = useState([])
  const [clubRecords, setClubRecords] = useState({})
  const [claimedProfile, setClaimedProfile] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showStartGame, setShowStartGame] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSport, setNewSport] = useState('basketball')
  const [creating, setCreating] = useState(false)
  const [userRole, setUserRole] = useState([])

  useEffect(() => {
    if (!user) return
    const u1 = subscribeToUserClubs(user.uid, setClubs)
    const u2 = subscribeToUserTournaments(user.uid, setTournaments)
    const u3 = subscribeToUser(user.uid, (u) => {
      setFollowedClubs(u?.followedClubs || [])
      setFollowedPlayers(u?.followedPlayers || [])
      setUserRole(u?.role || [])
    })
    const u4 = subscribeToUserLeagues(user.uid, setLeagues)
    const u5 = subscribeLiveGames(setLiveGames)
    getClaimedPlayerProfile(user.uid).then(setClaimedProfile).catch(() => {})
    return () => { u1(); u2(); u3(); u4(); u5() }
  }, [user])

  useEffect(() => {
    return subscribeToFollowedGames(followedClubs, setFollowedGames)
  }, [followedClubs])

  useEffect(() => {
    if (!followedClubs.length) { setFollowedClubData([]); return }
    Promise.all(followedClubs.map((id) => getClub(id).catch(() => null)))
      .then((results) => setFollowedClubData(results.filter(Boolean)))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followedClubs.join(',')])

  // Fetch W/L records for owned + followed clubs
  useEffect(() => {
    const allIds = [...new Set([...clubs.map((c) => c.id), ...followedClubData.map((c) => c.id)])]
    const missing = allIds.filter((id) => !clubRecords[id])
    if (!missing.length) return
    missing.forEach((id) => {
      getClubRecord(id)
        .then((rec) => setClubRecords((prev) => ({ ...prev, [id]: rec })))
        .catch(() => {})
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubs.map((c) => c.id).join(','), followedClubData.map((c) => c.id).join(',')])

  async function handleCreate(e) {
    e.preventDefault()
    setCreating(true)
    try {
      await createClub(user.uid, { name: newName.trim(), sport: newSport })
      setNewName('')
      setShowCreate(false)
      setTab('clubs')
    } finally {
      setCreating(false)
    }
  }

  function handleStartGame() {
    if (clubs.length === 0) { setShowCreate(true); return }
    if (clubs.length === 1) { navigate(`/club/${clubs[0].id}/game/new`); return }
    setShowStartGame(true)
  }

  async function handleDeleteClub(club) {
    if (!confirm(`Delete "${club.name}" and all its players? This cannot be undone.`)) return
    await deleteClub(club.id)
  }
  async function handleDeleteTournament(t) {
    if (!confirm(`Delete "${t.name}"? This cannot be undone.`)) return
    await deleteTournament(t.id)
  }
  async function handleDeleteLeague(l) {
    if (!confirm(`Delete "${l.name}"? This cannot be undone.`)) return
    await deleteLeague(l.id)
  }
  async function handleFollow(clubId) {
    if (user) await followClub(user.uid, clubId)
  }
  async function handleUnfollow(clubId) {
    if (user) await unfollowClub(user.uid, clubId)
  }
  async function handleUnfollowPlayer(playerId) {
    if (user) await unfollowPlayer(user.uid, playerId)
  }

  const sharedProps = {
    clubs, tournaments, leagues, clubRecords,
    followedClubs, followedPlayers, followedClubData, followedGames, liveGames,
    claimedProfile, userRole,
    onDeleteClub: handleDeleteClub,
    onDeleteTournament: handleDeleteTournament,
    onDeleteLeague: handleDeleteLeague,
    onFollow: handleFollow,
    onUnfollow: handleUnfollow,
    onUnfollowPlayer: handleUnfollowPlayer,
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0f1117]">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/5 px-5 py-3 safe-top">
        <h1 className="text-xl font-extrabold tracking-tight text-white">
          Sport<span className="text-blue-500">Stream</span>
        </h1>
        <div className="flex items-center gap-2">
          <Link
            to="/settings"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1a1f2e] text-sm text-gray-400 ring-1 ring-white/5 hover:ring-white/10 hover:text-white transition"
            title="Settings"
          >
            ⚙
          </Link>
        </div>
      </header>

      {/* Role-aware greeting */}
      <div className="px-5 py-3 border-b border-white/5">
        <p className="text-sm text-gray-400">
          Welcome back, <span className="font-semibold text-white">{user?.displayName || user?.email?.split('@')[0]}</span>
        </p>
      </div>

      {/* Dashboard tab strip — inline, sticky below header */}
      <div className="sticky top-0 z-30 flex border-b border-white/5"
        style={{ background: 'rgba(15,17,23,0.97)', backdropFilter: 'blur(16px)' }}
      >
        {[
          { id: 'home',      label: 'Home',      icon: '⊞' },
          { id: 'clubs',     label: 'My Teams',  icon: '🏟' },
          { id: 'events',    label: 'Events',    icon: '🏆' },
          { id: 'following', label: 'Following', icon: '⭐' },
        ].map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold transition ${
              tab === id ? 'text-blue-400' : 'text-gray-600 hover:text-gray-400'
            }`}
          >
            <span className="text-base leading-none">{icon}</span>
            {label}
            {tab === id && (
              <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full bg-blue-500" />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pb-20">
        {tab === 'home'      && <HomeTab      {...sharedProps} onCreateClub={() => setShowCreate(true)} onStartGame={handleStartGame} setTab={setTab} />}
        {tab === 'clubs'     && <ClubsTab     {...sharedProps} onCreateClub={() => setShowCreate(true)} />}
        {tab === 'events'    && <EventsTab    {...sharedProps} />}
        {tab === 'following' && <FollowingTab {...sharedProps} />}
      </div>

      {/* Create team modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="w-full max-w-sm rounded-t-3xl bg-gray-900 p-6 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-700 sm:hidden" />
            <h3 className="mb-4 text-lg font-bold text-white">Create Team</h3>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <input
                type="text"
                placeholder="Team name (e.g. Downtown Rec Hoops)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                className="input"
                autoFocus
              />
              <div>
                <label className="mb-1.5 block text-sm text-gray-400">Sport</label>
                <select
                  value={newSport}
                  onChange={(e) => setNewSport(e.target.value)}
                  className="input capitalize"
                >
                  {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={creating || !newName.trim()} className="btn-primary flex-1">
                  {creating ? 'Creating…' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Start game — club picker */}
      {showStartGame && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
          onClick={() => setShowStartGame(false)}
        >
          <div
            className="w-full max-w-sm rounded-t-3xl bg-gray-900 p-6 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-700 sm:hidden" />
            <h3 className="mb-1 text-lg font-bold text-white">Start a Game</h3>
            <p className="mb-4 text-sm text-gray-400">Which team is playing?</p>
            <div className="flex flex-col gap-2">
              {clubs.map((club) => (
                <Link
                  key={club.id}
                  to={`/club/${club.id}/game/new`}
                  onClick={() => setShowStartGame(false)}
                  className="flex items-center gap-3 rounded-xl bg-gray-800 px-4 py-3 transition hover:bg-gray-700"
                >
                  <span className="text-2xl leading-none">{SPORT_ICON[club.sport] || '🎽'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white">{club.name}</p>
                    <p className="text-xs capitalize text-gray-400">{club.sport}</p>
                  </div>
                  {clubRecords[club.id] && (
                    <span className="shrink-0 text-xs font-bold tabular-nums text-gray-500">
                      {clubRecords[club.id].str}
                    </span>
                  )}
                  <span className="text-gray-600">›</span>
                </Link>
              ))}
            </div>
            <button
              onClick={() => setShowStartGame(false)}
              className="mt-4 w-full rounded-xl py-2.5 text-sm text-gray-500 hover:text-gray-300 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Role Hero ──────────────────────────────────────────────────────────────────

function RoleHero({ userRole, clubs, liveGames, followedGames, claimedProfile, onCreateClub, onStartGame }) {
  const roles = userRole || []

  // Fan hero: live/upcoming followed games
  if (roles.includes('fan') && !roles.includes('host') && !roles.includes('manager')) {
    const liveFollowed = followedGames.filter((g) => g.status === 'live')
    const nextGame = followedGames.find((g) => g.status === 'setup') || followedGames[0]
    return (
      <div className="px-5">
        <div className="rounded-2xl bg-gradient-to-br from-blue-900/40 to-[#1a1f2e] p-5 ring-1 ring-blue-800/30">
          {liveFollowed.length > 0 ? (
            <>
              <div className="mb-3 flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
                <p className="text-xs font-bold uppercase tracking-wider text-red-300">Watching Live</p>
              </div>
              <Link to={`/game/${liveFollowed[0].id}`} className="block">
                <p className="text-xl font-extrabold text-white">
                  {liveFollowed[0].homeTeam} <span className="font-normal text-gray-400">vs</span> {liveFollowed[0].awayTeam}
                </p>
                <p className="mt-1 font-mono text-3xl font-extrabold text-blue-300 tabular-nums">
                  {liveFollowed[0].homeScore}–{liveFollowed[0].awayScore}
                </p>
                <p className="mt-2 text-sm text-blue-400 font-semibold">Watch live →</p>
              </Link>
            </>
          ) : nextGame ? (
            <>
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-gray-500">Up Next</p>
              <Link to={`/game/${nextGame.id}`}>
                <p className="text-lg font-extrabold text-white">
                  {nextGame.homeTeam} <span className="font-normal text-gray-400">vs</span> {nextGame.awayTeam}
                </p>
              </Link>
              <p className="mt-1 text-sm text-gray-500 capitalize">{nextGame.sport}</p>
            </>
          ) : (
            <>
              <p className="mb-2 text-sm font-semibold text-white">No live games right now</p>
              <p className="text-xs text-gray-500">Follow more teams to see their games here.</p>
              {liveGames.length > 0 && (
                <Link to={`/game/${liveGames[0].id}`} className="mt-3 inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300">
                  {liveGames.length} game{liveGames.length !== 1 ? 's' : ''} live right now →
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  // Scorekeeper hero: large join input
  if (roles.includes('scorekeeper') && !roles.includes('host') && !roles.includes('manager')) {
    return (
      <div className="px-5">
        <div className="rounded-2xl bg-gradient-to-br from-green-900/30 to-[#1a1f2e] p-5 ring-1 ring-green-800/30">
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-green-400">Ready to Score</p>
          <p className="mb-4 text-xl font-extrabold text-white">Join a game</p>
          <Link
            to="/join"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3 text-base font-bold text-white shadow-lg shadow-green-600/20 hover:bg-green-500 transition active:scale-95"
          >
            🎮 Enter Join Code
          </Link>
          <p className="mt-3 text-center text-xs text-gray-600">Ask the game host for the 6-digit code</p>
        </div>
      </div>
    )
  }

  // Player hero: my profile + next game
  if (roles.includes('player') && !roles.includes('host') && !roles.includes('manager')) {
    return (
      <div className="px-5">
        {claimedProfile ? (
          <div className="rounded-2xl bg-gradient-to-br from-purple-900/30 to-[#1a1f2e] p-5 ring-1 ring-purple-800/30">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-purple-400">My Profile</p>
            <Link to={`/player/${claimedProfile.clubId}/${claimedProfile.playerId}`} className="flex items-center gap-4">
              {claimedProfile.photoUrl ? (
                <img src={claimedProfile.photoUrl} alt="" className="h-14 w-14 shrink-0 rounded-2xl object-cover ring-2 ring-purple-800/40" />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-purple-900/50 text-2xl font-extrabold text-purple-300">
                  {claimedProfile.number || claimedProfile.name?.charAt(0) || '?'}
                </div>
              )}
              <div>
                <p className="font-bold text-white text-lg">
                  {claimedProfile.nickname ? `"${claimedProfile.nickname}"` : claimedProfile.name}
                </p>
                {claimedProfile.position && <p className="text-sm text-gray-400">{claimedProfile.position} · #{claimedProfile.number}</p>}
                <p className="mt-1 text-xs text-purple-400">View stats →</p>
              </div>
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl bg-gradient-to-br from-purple-900/30 to-[#1a1f2e] p-5 ring-1 ring-purple-800/30">
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-purple-400">Player</p>
            <p className="mb-3 font-semibold text-white">Link your player profile</p>
            <p className="text-sm text-gray-500">Ask your manager to invite you so your stats show up here.</p>
          </div>
        )}
      </div>
    )
  }

  // Host / Manager hero: quick actions
  const isHostOrManager = roles.includes('host') || roles.includes('manager')
  if (isHostOrManager || roles.length === 0) {
    return (
      <div className="px-5">
        <div className="rounded-2xl bg-gradient-to-br from-blue-900/20 to-[#1a1f2e] p-5 ring-1 ring-blue-800/20">
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-blue-400">
            {roles.includes('manager') ? 'Coach / Manager' : roles.includes('host') ? 'Host Hub' : 'Quick Actions'}
          </p>
          <p className="mb-4 text-xl font-extrabold text-white">
            {clubs.length > 0 ? `${clubs.length} team${clubs.length !== 1 ? 's' : ''}` : 'Get started'}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onStartGame}
              className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-green-600/20 hover:bg-green-500 transition active:scale-95"
            >
              ▶ Start Game
            </button>
            <button
              onClick={onCreateClub}
              className="flex items-center gap-2 rounded-xl bg-[#0f1117] px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/10 hover:ring-white/20 transition active:scale-95"
            >
              + New Team
            </button>
            <Link
              to="/league/new"
              className="flex items-center gap-2 rounded-xl bg-[#0f1117] px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/10 hover:ring-white/20 transition active:scale-95"
            >
              📋 New League
            </Link>
            <Link
              to="/tournament/new"
              className="flex items-center gap-2 rounded-xl bg-[#0f1117] px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/10 hover:ring-white/20 transition active:scale-95"
            >
              🏆 Tournament
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return null
}

// ── Home tab ───────────────────────────────────────────────────────────────────

function HomeTab({ clubs, clubRecords, liveGames, followedClubs, followedGames, claimedProfile, userRole, onCreateClub, onStartGame, setTab }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); setSearching(false); return }
    setSearching(true)
    const t = setTimeout(async () => {
      const r = await searchClubs(searchQuery).catch(() => [])
      setSearchResults(r)
      setSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  return (
    <div className="space-y-7 pt-4">

      {/* Live Now Hero Card */}
      {(() => {
        const myClubIds = new Set([
          ...(clubs || []).map(c => c.id),
          ...(followedClubs || []),
        ])
        const myLiveGames = (liveGames || []).filter(g =>
          myClubIds.has(g.clubId) || myClubIds.has(g.awayClubId)
        )
        if (!myLiveGames.length) return null
        return (
          <div className="mb-4 mx-5">
            {myLiveGames.slice(0, 2).map((g) => (
              <Link
                key={g.id}
                to={`/game/${g.id}`}
                className="flex items-center justify-between rounded-2xl bg-green-950/40 border border-green-800/40 px-4 py-3 mb-2 hover:bg-green-950/60 transition"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-green-400" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-green-300 uppercase tracking-wider">🔴 Live Now</p>
                    <p className="truncate text-sm font-semibold text-white">
                      {g.homeTeam} <span className="text-gray-400 font-normal">vs</span> {g.awayTeam}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 ml-3 flex items-center gap-2">
                  <span className="font-mono font-bold text-white">{g.homeScore}–{g.awayScore}</span>
                  <span className="rounded-full bg-green-700 px-2 py-0.5 text-xs font-semibold text-white">Watch →</span>
                </div>
              </Link>
            ))}
          </div>
        )
      })()}

      {/* Role-specific hero */}
      <RoleHero
        userRole={userRole}
        clubs={clubs}
        liveGames={liveGames}
        followedGames={followedGames}
        claimedProfile={claimedProfile}
        onCreateClub={onCreateClub}
        onStartGame={onStartGame}
      />

      <div className="px-5">
      {/* Team search */}
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">Find Teams</p>
        <div className="relative">
          <input
            type="text"
            placeholder="Search teams by name…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pr-10"
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          )}
          {searchQuery && !searching && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              ✕
            </button>
          )}
        </div>
        {searchQuery.length >= 2 && (
          <div className="mt-2 divide-y divide-gray-800 overflow-hidden rounded-2xl bg-gray-900">
            {searchResults.length === 0 && !searching ? (
              <p className="px-4 py-4 text-sm text-gray-500">No teams found for "{searchQuery}"</p>
            ) : (
              searchResults.map((club) => (
                <Link
                  key={club.id}
                  to={`/team/${club.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition hover:bg-gray-800"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-800 text-xl">
                    {SPORT_ICON[club.sport] || '🎽'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white">{club.name}</p>
                    <p className="text-xs capitalize text-gray-500">{club.sport}</p>
                  </div>
                  <span className="shrink-0 text-xs text-gray-600">→</span>
                </Link>
              ))
            )}
          </div>
        )}
      </div>

      {/* My Profile card */}
      {claimedProfile && (
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">My Profile</p>
          <Link
            to={`/player/${claimedProfile.clubId}/${claimedProfile.playerId}`}
            className="flex items-center gap-4 rounded-2xl bg-gray-900 px-4 py-3 transition hover:bg-gray-800"
          >
            {claimedProfile.photoUrl ? (
              <img src={claimedProfile.photoUrl} alt={claimedProfile.name} className="h-12 w-12 shrink-0 rounded-xl object-cover ring-2 ring-gray-700" />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-900/50 text-xl font-extrabold text-blue-300 ring-2 ring-gray-700">
                {claimedProfile.number || claimedProfile.name?.charAt(0) || '?'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              {claimedProfile.nickname ? (
                <>
                  <p className="font-bold text-white">"{claimedProfile.nickname}"</p>
                  <p className="text-xs text-gray-400">{claimedProfile.name}</p>
                </>
              ) : (
                <p className="font-bold text-white">{claimedProfile.name}</p>
              )}
              <div className="mt-0.5 flex flex-wrap gap-x-2 text-[10px] text-gray-500">
                {claimedProfile.position && <span>{claimedProfile.position}</span>}
                {claimedProfile.number && <span>#{claimedProfile.number}</span>}
              </div>
            </div>
            <span className="shrink-0 text-xs text-gray-600">→</span>
          </Link>
        </div>
      )}

      {/* Quick actions */}
      <div>
        <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">Quick Actions</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onStartGame}
            className="flex flex-col items-start gap-1.5 rounded-2xl bg-green-700 p-4 text-left transition hover:bg-green-600 active:scale-95"
          >
            <span className="text-2xl leading-none">▶</span>
            <p className="font-semibold text-white">Start Game</p>
            <p className="text-[10px] text-green-200">Score your next game</p>
          </button>
          <button
            onClick={onCreateClub}
            className="flex flex-col items-start gap-1.5 rounded-2xl bg-blue-600 p-4 text-left transition hover:bg-blue-500 active:scale-95"
          >
            <span className="text-2xl leading-none">🏟</span>
            <p className="font-semibold text-white">Create Team</p>
            <p className="text-[10px] text-blue-200">Set up your roster</p>
          </button>
          <Link
            to="/league/new"
            className="flex flex-col items-start gap-1.5 rounded-2xl bg-gray-800 p-4 transition hover:bg-gray-700 active:scale-95"
          >
            <span className="text-2xl leading-none">📋</span>
            <p className="font-semibold text-white">Host League</p>
            <p className="text-[10px] text-gray-400">Run a full season</p>
          </Link>
          <Link
            to="/tournament/new"
            className="flex flex-col items-start gap-1.5 rounded-2xl bg-gray-800 p-4 transition hover:bg-gray-700 active:scale-95"
          >
            <span className="text-2xl leading-none">🏆</span>
            <p className="font-semibold text-white">Host Tournament</p>
            <p className="text-[10px] text-gray-400">Run a bracket event</p>
          </Link>
        </div>
      </div>

      {/* Live now */}
      {liveGames.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Live Now</p>
          </div>
          <div className="flex flex-col gap-2">
            {liveGames.slice(0, 5).map((game) => (
              <Link
                key={game.id}
                to={`/game/${game.id}`}
                className="flex items-center justify-between rounded-2xl bg-[#1a1f2e] px-4 py-3 transition hover:bg-[#242938] ring-1 ring-white/5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{game.homeTeam} vs {game.awayTeam}</p>
                  <p className="text-[10px] capitalize text-gray-500">{game.sport}</p>
                </div>
                <p className="ml-4 shrink-0 font-mono text-lg font-bold text-white">{game.homeScore}–{game.awayScore}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* My teams quick scroll */}
      {clubs.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">My Teams</p>
            <button onClick={() => setTab('clubs')} className="text-[10px] text-blue-400 hover:text-blue-300">
              See all →
            </button>
          </div>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
            {clubs.map((club) => (
              <Link
                key={club.id}
                to={`/club/${club.id}`}
                className="flex w-28 shrink-0 flex-col items-center rounded-2xl bg-[#1a1f2e] p-3 text-center transition hover:bg-[#242938] ring-1 ring-white/5"
              >
                {club.logoUrl ? (
                  <img src={club.logoUrl} alt={club.name} className="h-10 w-10 rounded-xl object-cover" />
                ) : (
                  <span className="text-3xl leading-none">{SPORT_ICON[club.sport] || '🎽'}</span>
                )}
                <p className="mt-2 line-clamp-2 text-xs font-semibold text-white">{club.name}</p>
                {clubRecords[club.id] ? (
                  <p className="mt-0.5 text-[9px] font-bold tabular-nums text-gray-400">{clubRecords[club.id].str}</p>
                ) : (
                  <p className="mt-0.5 text-[9px] capitalize text-gray-500">{club.sport}</p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Following activity */}
      {followedGames.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Fan Activity</p>
            <button onClick={() => setTab('following')} className="text-[10px] text-blue-400 hover:text-blue-300">
              See all →
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {followedGames.slice(0, 3).map((game) => {
              const isLive  = game.status === 'live'
              const isFinal = game.status === 'final'
              return (
                <Link
                  key={game.id}
                  to={`/game/${game.id}`}
                  className="flex items-center justify-between rounded-2xl bg-[#1a1f2e] px-4 py-3 transition hover:bg-[#242938] ring-1 ring-white/5"
                >
                  <div className="min-w-0 flex-1">
                    {isLive && (
                      <div className="mb-1 flex items-center gap-1">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
                        <span className="text-[10px] font-bold text-red-400">LIVE</span>
                      </div>
                    )}
                    <p className="truncate text-sm font-semibold text-white">
                      {game.homeTeam} <span className="font-normal text-gray-500">vs</span> {game.awayTeam}
                    </p>
                    <p className="text-[10px] text-gray-500">{formatDate(game.createdAt)}</p>
                  </div>
                  {(isLive || isFinal) && (
                    <p className="ml-4 shrink-0 font-mono text-lg font-bold text-white">{game.homeScore}–{game.awayScore}</p>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {clubs.length === 0 && liveGames.length === 0 && followedGames.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-white/10 px-8 py-14 text-center">
          <span className="text-5xl">🏀</span>
          <p className="font-semibold text-white">Get started</p>
          <p className="text-sm text-gray-500">Create a team, host a tournament, or become a fan of your favorite teams.</p>
          <button onClick={onCreateClub} className="btn-primary mt-2 w-auto px-8">Create Team</button>
        </div>
      )}
      </div>
    </div>
  )
}

// ── Clubs tab ──────────────────────────────────────────────────────────────────

function ClubsTab({ clubs, clubRecords, onCreateClub, onDeleteClub }) {
  return (
    <div className="px-5 pt-4">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
          {clubs.length} Team{clubs.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={onCreateClub}
          className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition"
        >
          + New Team
        </button>
      </div>

      {clubs.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-gray-700 px-8 py-16 text-center">
          <span className="text-5xl">🏀</span>
          <p className="text-gray-400">No teams yet. Create your first one to get started.</p>
          <button onClick={onCreateClub} className="btn-primary w-auto px-8">Create Team</button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {clubs.map((club) => (
            <div key={club.id} className="card flex items-center gap-4 transition hover:bg-gray-800">
              <div className="shrink-0">
                {club.logoUrl ? (
                  <img src={club.logoUrl} alt={club.name} className="h-12 w-12 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-800 text-2xl">
                    {SPORT_ICON[club.sport] || '🎽'}
                  </div>
                )}
              </div>
              <Link to={`/club/${club.id}`} className="min-w-0 flex-1">
                <p className="font-semibold text-white">{club.name}</p>
                <p className="text-xs capitalize text-gray-400">{club.sport}</p>
              </Link>
              <RecordBadge record={clubRecords[club.id]} />
              <div className="flex shrink-0 items-center gap-3">
                <Link to={`/team/${club.id}`} className="text-xs text-gray-500 hover:text-blue-400 transition">
                  Public ↗
                </Link>
                <button
                  onClick={() => onDeleteClub(club)}
                  className="text-xs text-gray-700 hover:text-red-400 transition"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Events tab ─────────────────────────────────────────────────────────────────

function EventsTab({ tournaments, leagues, onDeleteTournament, onDeleteLeague }) {
  const [evType, setEvType] = useState('tournaments')

  return (
    <div className="px-5 pt-4">
      <div className="mb-4 flex rounded-xl bg-gray-800 p-1">
        {[
          { id: 'tournaments', label: 'Tournaments' },
          { id: 'leagues',     label: 'Leagues' },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setEvType(id)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
              evType === id ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {evType === 'tournaments' && (
        <div>
          <div className="mb-4 flex items-center justify-end gap-2">
            <Link
              to="/tournaments"
              className="rounded-full border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:border-gray-500 hover:text-white transition"
            >
              Browse
            </Link>
            <Link
              to="/tournament/new"
              className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition"
            >
              + Host
            </Link>
          </div>
          {tournaments.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-700 px-8 py-12 text-center">
              <p className="text-sm text-gray-400">No tournaments hosted yet.</p>
              <Link to="/tournament/new" className="btn-primary w-auto px-6">Host a Tournament</Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {tournaments.map((t) => (
                <div key={t.id} className="card flex items-center gap-3 transition hover:bg-gray-800">
                  <Link to={`/tournament/${t.id}`} className="min-w-0 flex-1">
                    <p className="font-semibold text-white">{t.name}</p>
                    <p className="mt-0.5 text-xs capitalize text-gray-400">
                      {t.sport} · {t.format?.replace('_', ' ')}
                    </p>
                  </Link>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize ${
                    t.status === 'registration' ? 'bg-blue-900/50 text-blue-300' :
                    t.status === 'active'       ? 'bg-green-900/50 text-green-300' :
                    'bg-gray-800 text-gray-400'
                  }`}>
                    {t.status}
                  </span>
                  <button
                    onClick={() => onDeleteTournament(t)}
                    className="shrink-0 text-xs text-gray-700 hover:text-red-400 transition"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {evType === 'leagues' && (
        <div>
          <div className="mb-4 flex items-center justify-end gap-2">
            <Link
              to="/leagues"
              className="rounded-full border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:border-gray-500 hover:text-white transition"
            >
              Browse
            </Link>
            <Link
              to="/league/new"
              className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition"
            >
              + Host
            </Link>
          </div>
          {leagues.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-700 px-8 py-12 text-center">
              <p className="text-sm text-gray-400">No leagues hosted yet.</p>
              <Link to="/league/new" className="btn-primary w-auto px-6">Host a League</Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {leagues.map((l) => (
                <div key={l.id} className="card flex items-center gap-3 transition hover:bg-gray-800">
                  <Link to={`/league/${l.id}`} className="min-w-0 flex-1">
                    <p className="font-semibold text-white">{l.name}</p>
                    <p className="mt-0.5 text-xs capitalize text-gray-400">
                      {l.sport}{l.season ? ` · ${l.season}` : ''}
                    </p>
                  </Link>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize ${
                    l.status === 'registration' ? 'bg-blue-900/50 text-blue-300' :
                    l.status === 'active'       ? 'bg-green-900/50 text-green-300' :
                    'bg-gray-800 text-gray-400'
                  }`}>
                    {l.status}
                  </span>
                  <button
                    onClick={() => onDeleteLeague(l)}
                    className="shrink-0 text-xs text-gray-700 hover:text-red-400 transition"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Following tab ──────────────────────────────────────────────────────────────

function FollowingTab({ followedClubs, followedPlayers, followedClubData, followedGames, clubRecords, onFollow, onUnfollow, onUnfollowPlayer }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [playerActivity, setPlayerActivity] = useState([])

  useEffect(() => {
    if (!followedPlayers.length) { setPlayerActivity([]); return }
    const ids = followedPlayers.map((fp) => fp.playerId)
    getRecentPlaysForPlayers(ids).then(setPlayerActivity).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followedPlayers.map((fp) => fp.playerId).join(',')])

  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); setSearching(false); return }
    setSearching(true)
    const t = setTimeout(async () => {
      const r = await searchClubs(searchQuery).catch(() => [])
      setSearchResults(r)
      setSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  return (
    <div className="space-y-6 px-5 pt-4">
      {/* Search */}
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">Find Teams</p>
        <div className="relative">
          <input
            type="text"
            placeholder="Search teams by name…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pr-10"
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          )}
          {searchQuery && !searching && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              ✕
            </button>
          )}
        </div>

        {searchQuery.length >= 2 && (
          <div className="mt-2 divide-y divide-gray-800 overflow-hidden rounded-2xl bg-gray-900">
            {searchResults.length === 0 && !searching ? (
              <p className="px-4 py-4 text-sm text-gray-500">No teams found for "{searchQuery}"</p>
            ) : (
              searchResults.map((club) => {
                const isFollowing = followedClubs.includes(club.id)
                return (
                  <div key={club.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-800 text-xl">
                      {SPORT_ICON[club.sport] || '🎽'}
                    </div>
                    <Link to={`/team/${club.id}`} className="min-w-0 flex-1">
                      <p className="font-semibold text-white">{club.name}</p>
                      <p className="text-xs capitalize text-gray-500">{club.sport}</p>
                    </Link>
                    <button
                      onClick={() => isFollowing ? onUnfollow(club.id) : onFollow(club.id)}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        isFollowing
                          ? 'bg-gray-700 text-gray-300 hover:bg-red-900/40 hover:text-red-400'
                          : 'bg-blue-600 text-white hover:bg-blue-500'
                      }`}
                    >
                      {isFollowing ? '✓ Fan' : '+ Be a Fan'}
                    </button>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* Followed teams */}
      {followedClubs.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
            Teams ({followedClubs.length})
          </p>
          {followedClubData.length === 0 ? (
            <div className="flex justify-center py-6">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {followedClubData.map((club) => (
                <div
                  key={club.id}
                  className="flex items-center gap-3 rounded-2xl bg-gray-900 px-4 py-3 transition hover:bg-gray-800"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-800 text-xl">
                    {SPORT_ICON[club.sport] || '🎽'}
                  </div>
                  <Link to={`/team/${club.id}`} className="min-w-0 flex-1">
                    <p className="font-semibold text-white">{club.name}</p>
                    <p className="text-xs capitalize text-gray-500">{club.sport}</p>
                  </Link>
                  <RecordBadge record={clubRecords[club.id]} />
                  <button
                    onClick={() => onUnfollow(club.id)}
                    className="shrink-0 text-xs text-gray-600 hover:text-red-400 transition"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Followed players */}
      {followedPlayers.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
            Players ({followedPlayers.length})
          </p>
          <div className="flex flex-col gap-2">
            {followedPlayers.map((fp) => (
              <div key={fp.playerId} className="flex items-center gap-3 rounded-2xl bg-gray-900 px-4 py-3 transition hover:bg-gray-800">
                {fp.photoUrl ? (
                  <img src={fp.photoUrl} alt={fp.name} className="h-10 w-10 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-900 text-sm font-bold text-blue-200">
                    {fp.number || '?'}
                  </div>
                )}
                <Link to={`/player/${fp.clubId}/${fp.playerId}`} className="min-w-0 flex-1">
                  {fp.nickname ? (
                    <>
                      <p className="truncate font-bold text-white">"{fp.nickname}"</p>
                      <p className="truncate text-xs text-gray-500">{fp.name} · {fp.clubName || fp.clubSport || ''}</p>
                    </>
                  ) : (
                    <>
                      <p className="truncate font-semibold text-white">{fp.name}</p>
                      <p className="truncate text-xs text-gray-500">{fp.clubName || fp.clubSport || ''}</p>
                    </>
                  )}
                </Link>
                <button
                  onClick={() => onUnfollowPlayer(fp.playerId)}
                  className="shrink-0 text-xs text-gray-600 hover:text-red-400 transition"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Player activity feed */}
      {playerActivity.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">Player Highlights</p>
          <div className="flex flex-col gap-2">
            {playerActivity.map((play, i) => (
              <Link
                key={play.id || i}
                to={`/game/${play.gameId}`}
                className="flex items-center gap-3 rounded-2xl bg-gray-900 px-4 py-3 transition hover:bg-gray-800"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-900 text-sm font-bold text-blue-200">
                  {play.playerNumber || '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{play.playerName}</p>
                  <p className="truncate text-xs text-gray-500">{play.type?.replace(/_/g, ' ')}</p>
                </div>
                <span className="shrink-0 text-xs text-gray-600">→</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent games from followed teams */}
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">Recent Games</p>
        {followedGames.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-700 px-8 py-10 text-center">
            <p className="text-sm text-gray-400">
              {followedClubs.length === 0
                ? 'Become a fan of teams above to see their games here.'
                : 'No recent games from teams you follow.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {followedGames.map((game) => {
              const isLive  = game.status === 'live'
              const isFinal = game.status === 'final'
              const homeWon = isFinal && game.homeScore > game.awayScore
              const awayWon = isFinal && game.awayScore > game.homeScore
              return (
                <Link
                  key={game.id}
                  to={`/game/${game.id}`}
                  className="flex items-center justify-between rounded-2xl bg-[#1a1f2e] px-4 py-3 transition hover:bg-[#242938] ring-1 ring-white/5"
                >
                  <div className="min-w-0 flex-1">
                    {isLive && (
                      <div className="mb-1 flex items-center gap-1">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
                        <span className="text-[10px] font-bold text-red-400">LIVE</span>
                      </div>
                    )}
                    <p className="truncate text-sm font-semibold text-white">
                      {game.homeTeam} <span className="font-normal text-gray-500">vs</span> {game.awayTeam}
                    </p>
                    <p className="text-[10px] text-gray-500">{formatDate(game.createdAt)}</p>
                  </div>
                  <div className="ml-4 shrink-0 text-right">
                    {(isLive || isFinal) && (
                      <p className="font-mono text-lg font-bold text-white">{game.homeScore}–{game.awayScore}</p>
                    )}
                    {isFinal && (
                      <span className={`text-xs font-bold ${homeWon ? 'text-green-400' : awayWon ? 'text-red-400' : 'text-gray-500'}`}>
                        {homeWon ? 'W' : awayWon ? 'L' : 'T'}
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
