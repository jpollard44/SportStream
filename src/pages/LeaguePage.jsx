import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { uploadLeaguePhoto } from '../firebase/storage'
import {
  subscribeToLeague,
  subscribeToLeagueTeams,
  subscribeToLeagueGames,
  updateLeague,
  updateLeagueTeam,
  deleteLeagueTeam,
  deleteLeague,
  computeLeagueStandings,
} from '../firebase/leagues'
import { createGame, updateGame } from '../firebase/firestore'
import SponsorBanner from '../components/SponsorBanner'
import { generateUniqueJoinCode } from '../lib/generateJoinCode'

const SPORT_EMOJI = {
  basketball: '🏀', baseball: '⚾', softball: '🥎',
  soccer: '⚽', volleyball: '🏐', 'flag-football': '🏈',
}

function fmtScheduled(iso) {
  if (!iso) return null
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

// ─────────────────────────────────────────────────────────────────────────────

export default function LeaguePage() {
  const { leagueId } = useParams()
  const { user }     = useAuth()

  const [league, setLeague]   = useState(null)
  const [teams, setTeams]     = useState([])
  const [games, setGames]     = useState([])
  const [tab, setTab]         = useState('standings')

  const [showGameModal, setShowGameModal]         = useState(false)
  const [showEditLeague, setShowEditLeague]       = useState(false)
  const [showAutoSchedule, setShowAutoSchedule]   = useState(false)
  const [editTeam, setEditTeam]                   = useState(null)
  const [draggedGameId, setDraggedGameId]         = useState(null)
  const [photoUploading, setPhotoUploading]       = useState(false)
  const [photoError, setPhotoError]               = useState('')
  const photoInputRef = useRef(null)

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoError('')
    setPhotoUploading(true)
    try {
      const url = await uploadLeaguePhoto(leagueId, file)
      await updateLeague(leagueId, { photoUrl: url })
    } catch (err) {
      setPhotoError('Photo upload failed: ' + (err?.message || 'unknown error'))
    } finally {
      setPhotoUploading(false)
      e.target.value = ''
    }
  }

  useEffect(() => {
    const u1 = subscribeToLeague(leagueId, setLeague)
    const u2 = subscribeToLeagueTeams(leagueId, setTeams)
    const u3 = subscribeToLeagueGames(leagueId, setGames)
    return () => { u1(); u2(); u3() }
  }, [leagueId])

  const isHost   = user && league && user.uid === league.hostId
  const accepted = teams.filter((t) => t.status === 'accepted')
  const pending  = teams.filter((t) => t.status === 'pending')
  const standings = computeLeagueStandings(teams, games)

  async function acceptTeam(teamId) {
    await updateLeagueTeam(leagueId, teamId, { status: 'accepted' })
  }
  async function rejectTeam(teamId) {
    await updateLeagueTeam(leagueId, teamId, { status: 'rejected' })
  }
  async function removeTeam(teamId) {
    if (!confirm('Remove this team from the league?')) return
    await deleteLeagueTeam(leagueId, teamId)
  }
  async function setStatus(status) {
    await updateLeague(leagueId, { status })
  }

  async function handleDropGame(targetGameId) {
    if (!draggedGameId || draggedGameId === targetGameId) { setDraggedGameId(null); return }
    const src = games.find((g) => g.id === draggedGameId)
    const tgt = games.find((g) => g.id === targetGameId)
    if (!src || !tgt) { setDraggedGameId(null); return }
    // Swap scheduledAt between the two games
    await Promise.all([
      updateGame(draggedGameId, { scheduledAt: tgt.scheduledAt || null }),
      updateGame(targetGameId,  { scheduledAt: src.scheduledAt || null }),
    ])
    setDraggedGameId(null)
  }

  if (!league) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0f1117]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  const sportEmoji = SPORT_EMOJI[league.sport] || '🏅'

  return (
    <div className="min-h-screen bg-[#0f1117] pb-24 text-white">
      <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />

      {/* Cover photo */}
      {league.photoUrl ? (
        <div className="relative h-40 w-full overflow-hidden sm:h-52">
          <img src={league.photoUrl} alt="cover" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-gray-950/80" />
          {isHost && (
            <button
              onClick={() => photoInputRef.current?.click()}
              disabled={photoUploading}
              className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-xl bg-black/50 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm hover:bg-black/70"
            >
              {photoUploading ? '…' : '📷 Change photo'}
            </button>
          )}
        </div>
      ) : isHost ? (
        <button
          onClick={() => photoInputRef.current?.click()}
          disabled={photoUploading}
          className="flex w-full items-center justify-center gap-2 bg-[#1a1f2e] py-5 text-sm text-gray-500 hover:bg-[#242938] hover:text-gray-300"
        >
          {photoUploading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" /> : '📷'}
          {photoUploading ? 'Uploading…' : 'Add cover photo'}
        </button>
      ) : null}

      {photoError && (
        <div className="mx-5 mt-3 flex items-center justify-between gap-2 rounded-xl bg-red-900/40 px-4 py-2.5 text-sm text-red-300">
          <span>{photoError}</span>
          <button onClick={() => setPhotoError('')} className="shrink-0 text-red-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Nav */}
      <nav className="flex items-center justify-between border-b border-white/5 px-5 py-4">
        <Link to="/leagues" className="text-sm text-gray-400 hover:text-white">← Leagues</Link>
        {user && <Link to="/dashboard" className="text-sm text-gray-400 hover:text-white">Dashboard</Link>}
      </nav>

      {/* Header */}
      <div className="border-b border-white/5 px-5 py-5">
        <div className="mx-auto max-w-lg">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">{sportEmoji}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize ${
                league.status === 'registration' ? 'bg-blue-900/50 text-blue-300' :
                league.status === 'active'       ? 'bg-green-900/50 text-green-300' :
                'bg-gray-800 text-gray-400'
              }`}>
                {league.status}
              </span>
            </div>
            {isHost && (
              <button onClick={() => setShowEditLeague(true)}
                className="rounded-xl bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-gray-700 transition">
                Edit
              </button>
            )}
          </div>

          <h1 className="text-2xl font-extrabold text-white leading-tight">{league.name}</h1>
          {(league.season || league.location) && (
            <p className="mt-1 text-sm text-gray-400">
              {[league.season, league.location].filter(Boolean).join(' · ')}
            </p>
          )}
          {league.description && (
            <p className="mt-1.5 text-sm text-gray-500">{league.description}</p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {league.status === 'registration' && (
              <Link to={`/league/${leagueId}/join`}
                className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition">
                + Register Team
              </Link>
            )}
            <button
              onClick={() => navigator.clipboard.writeText(league.joinCode)}
              className="flex items-center gap-2 rounded-xl bg-[#1a1f2e] px-4 py-2 ring-1 ring-white/5 hover:ring-gray-600 transition"
            >
              <span className="text-xs text-gray-500">Code</span>
              <span className="font-mono text-sm font-extrabold tracking-widest text-blue-400">{league.joinCode}</span>
              <span className="text-[10px] text-gray-600">copy</span>
            </button>
          </div>

          {/* Host controls */}
          {isHost && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-700 pt-4">
              {league.status === 'registration' && accepted.length >= 2 && (
                <button onClick={() => setStatus('active')}
                  className="rounded-xl bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600">
                  Start Season
                </button>
              )}
              {league.status === 'active' && (
                <>
                  <button onClick={() => setShowGameModal(true)}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
                    + Schedule Game
                  </button>
                  {accepted.length >= 2 && (
                    <button onClick={() => setShowAutoSchedule(true)}
                      className="rounded-xl bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-600">
                      ⚡ Auto-Schedule
                    </button>
                  )}
                  <button onClick={() => setStatus('complete')}
                    className="rounded-xl bg-gray-700 px-4 py-2 text-sm font-semibold text-gray-300 hover:bg-gray-600">
                    Complete Season
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sponsor banner */}
      <SponsorBanner doc={league} isHost={user?.uid === league?.hostId} />

      {/* Tabs */}
      <div className="flex border-b border-white/5">
        {[
          ['standings', 'Standings'],
          ['schedule', `Schedule (${games.length})`],
          ['teams', `Teams (${accepted.length})`],
        ].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`relative flex-1 py-3 text-sm font-semibold transition ${
              tab === key ? 'border-b-2 border-blue-500 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}>
            {label}
            {key === 'teams' && pending.length > 0 && (
              <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500 text-[9px] font-bold text-gray-900">
                {pending.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mx-auto max-w-lg px-5 pt-5">

        {/* ── STANDINGS ──────────────────────────────────────────────────────── */}
        {tab === 'standings' && (
          <div>
            {standings.length === 0 ? (
              <p className="py-12 text-center text-sm text-gray-500">
                No standings yet. Accept teams and schedule games to see standings.
              </p>
            ) : (
              <div className="overflow-hidden rounded-2xl bg-[#1a1f2e]">
                <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-x-3 border-b border-white/5 px-4 py-2.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Team</span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">W</span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">L</span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">T</span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">PTS</span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">+/-</span>
                </div>
                {standings.map((t, i) => {
                  const pts  = t.W * 2 + t.T
                  const diff = t.pf - t.pa
                  return (
                    <div key={t.id}
                      className={`grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-x-3 px-4 py-3 ${
                        i < standings.length - 1 ? 'border-b border-white/5' : ''
                      }`}>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">{t.name}</p>
                        {t.managerName && <p className="text-xs text-gray-500">{t.managerName}</p>}
                      </div>
                      <span className="font-mono font-bold text-green-400">{t.W}</span>
                      <span className="font-mono font-bold text-red-400">{t.L}</span>
                      <span className="font-mono text-gray-400">{t.T}</span>
                      <span className="font-mono font-bold text-blue-400">{pts}</span>
                      <span className="font-mono text-xs text-gray-400">
                        {t.pf > 0 || t.pa > 0 ? `${diff > 0 ? '+' : ''}${diff}` : '—'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── SCHEDULE ───────────────────────────────────────────────────────── */}
        {tab === 'schedule' && (
          <div className="space-y-3">
            {isHost && league.status === 'active' && (
              <div className="flex gap-2">
                <button onClick={() => setShowGameModal(true)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-700 py-3.5 text-sm font-semibold text-gray-400 hover:border-blue-600 hover:text-blue-400 transition">
                  + Schedule Game
                </button>
                {accepted.length >= 2 && (
                  <button onClick={() => setShowAutoSchedule(true)}
                    className="flex items-center gap-1.5 rounded-2xl border border-dashed border-indigo-800 px-4 py-3.5 text-sm font-semibold text-indigo-400 hover:border-indigo-500 hover:text-indigo-300 transition">
                    ⚡ Auto
                  </button>
                )}
              </div>
            )}
            {games.length > 0 && isHost && (
              <p className="text-[10px] text-gray-600 text-center">Drag games to swap their time slots</p>
            )}
            {games.length === 0 && (
              <p className="py-12 text-center text-sm text-gray-500">No games scheduled yet.</p>
            )}
            {games.map((g) => {
              const isFinal  = g.status === 'final'
              const isLive   = g.status === 'live'
              const isSetup  = g.status === 'setup'
              const scheduled = fmtScheduled(g.scheduledAt)
              const isDragged = draggedGameId === g.id
              return (
                <div
                  key={g.id}
                  className={`card transition ${isDragged ? 'opacity-40 ring-2 ring-indigo-500' : ''} ${isLive ? 'border-l-2 border-green-500' : ''}`}
                  draggable={isHost}
                  onDragStart={() => setDraggedGameId(g.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDropGame(g.id)}
                  onDragEnd={() => setDraggedGameId(null)}
                  style={{ cursor: isHost ? 'grab' : 'default' }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        {isHost && (
                          <span className="text-[9px] text-gray-700 select-none">⠿</span>
                        )}
                        {isLive && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-900/60 px-2 py-0.5 text-[10px] font-bold text-green-300 ring-1 ring-green-800/40">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                            LIVE
                          </span>
                        )}
                        {isFinal && <span className="text-[10px] font-bold uppercase text-gray-500">Final</span>}
                        {isSetup && scheduled && (
                          <span className="text-[10px] text-gray-400">{scheduled}</span>
                        )}
                      </div>
                      <p className="truncate text-sm font-semibold text-white">
                        {g.homeTeam} <span className="font-normal text-gray-500">vs</span> {g.awayTeam}
                      </p>
                      {(isFinal || isLive) && (
                        <p className="mt-0.5 font-mono text-base font-bold text-white">
                          {g.homeScore} – {g.awayScore}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <Link to={`/game/${g.id}`}
                        className="text-xs font-semibold text-blue-400 hover:text-blue-300">
                        Scoreboard →
                      </Link>
                      {isHost && isSetup && (
                        <Link to={`/scorekeeper/${g.id}`}
                          className="text-xs font-semibold text-green-400 hover:text-green-300">
                          Start Game →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── TEAMS ──────────────────────────────────────────────────────────── */}
        {tab === 'teams' && (
          <div className="space-y-4">
            {/* Pending */}
            {isHost && pending.length > 0 && (
              <div className="rounded-2xl border border-yellow-900/40 bg-yellow-950/30 p-4">
                <p className="mb-3 text-sm font-semibold text-yellow-300">
                  {pending.length} pending {pending.length === 1 ? 'registration' : 'registrations'}
                </p>
                <div className="space-y-2">
                  {pending.map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl bg-[#1a1f2e] px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">{t.name}</p>
                        <p className="text-xs text-gray-400">{t.managerName} · {t.managerEmail}</p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button onClick={() => rejectTeam(t.id)}
                          className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-red-900/60 hover:text-red-300 transition">
                          Reject
                        </button>
                        <button onClick={() => acceptTeam(t.id)}
                          className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-600 transition">
                          Accept
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Accepted teams */}
            {accepted.length === 0 ? (
              <p className="py-12 text-center text-sm text-gray-500">
                No accepted teams yet.{' '}
                <Link to={`/league/${leagueId}/join`} className="text-blue-400">Register a team →</Link>
              </p>
            ) : (
              <div className="space-y-2">
                {accepted.map((t) => (
                  <div key={t.id} className="card flex items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-white">{t.name}</p>
                      {t.managerName && (
                        <p className="mt-0.5 text-xs text-gray-400">
                          {t.managerName}
                          {t.managerEmail && <span className="text-gray-600"> · {t.managerEmail}</span>}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {t.clubId && (
                        <Link to={`/team/${t.clubId}`} className="text-xs text-blue-400 hover:underline">
                          Team page →
                        </Link>
                      )}
                      {isHost && (
                        <>
                          <button onClick={() => setEditTeam(t)}
                            className="rounded-lg bg-gray-700 px-2.5 py-1 text-xs font-semibold text-gray-300 hover:bg-gray-600 transition">
                            Edit
                          </button>
                          <button onClick={() => removeTeam(t.id)}
                            className="rounded-lg bg-gray-800 px-2.5 py-1 text-xs font-semibold text-gray-500 hover:bg-red-900/60 hover:text-red-400 transition">
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {showGameModal && (
        <ScheduleGameModal
          leagueId={leagueId}
          league={league}
          teams={accepted}
          onClose={() => setShowGameModal(false)}
        />
      )}
      {showAutoSchedule && (
        <AutoScheduleModal
          leagueId={leagueId}
          league={league}
          teams={accepted}
          onClose={() => setShowAutoSchedule(false)}
        />
      )}
      {showEditLeague && (
        <EditLeagueModal
          league={league}
          leagueId={leagueId}
          onClose={() => setShowEditLeague(false)}
        />
      )}
      {editTeam && (
        <EditTeamModal
          leagueId={leagueId}
          team={editTeam}
          onClose={() => setEditTeam(null)}
        />
      )}
    </div>
  )
}

// ── Schedule Game Modal ────────────────────────────────────────────────────────

function ScheduleGameModal({ leagueId, league, teams, onClose }) {
  const { user } = useAuth()
  const [homeId, setHomeId]             = useState('')
  const [awayId, setAwayId]             = useState('')
  const [scheduledAt, setScheduledAt]   = useState('')
  const [location, setLocation]         = useState('')
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState('')

  const homeTeamObj = teams.find((t) => t.id === homeId)
  const awayTeamObj = teams.find((t) => t.id === awayId)

  async function handleCreate() {
    if (!homeId || !awayId || homeId === awayId) { setError('Select two different teams.'); return }
    setSaving(true)
    setError('')
    try {
      const joinCode = await generateUniqueJoinCode()
      await createGame(homeTeamObj.clubId || null, {
        homeTeam: homeTeamObj.name,
        awayTeam: awayTeamObj.name,
        awayClubId: awayTeamObj.clubId || null,
        sport: league.sport,
        joinCode,
        scorekeeperId: user.uid,
        leagueId,
        homeLeagueTeamId: homeId,
        awayLeagueTeamId: awayId,
        totalPeriods: 4,
        periodLength: 600,
        scheduledAt: scheduledAt || null,
      })
      onClose()
    } catch {
      setError('Failed to create game. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={onClose}>
      <div className="w-full max-w-sm rounded-t-3xl bg-[#1a1f2e] p-6 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-bold text-white">Schedule Game</h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Home team</label>
            <select value={homeId} onChange={(e) => setHomeId(e.target.value)} className="input">
              <option value="">Select…</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Away team</label>
            <select value={awayId} onChange={(e) => setAwayId(e.target.value)} className="input">
              <option value="">Select…</option>
              {teams.filter((t) => t.id !== homeId).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Date &amp; Time</label>
            <input type="datetime-local" value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="input" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">
              Location / Field <span className="text-gray-600">(optional)</span>
            </label>
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Main Field, Gym B" className="input" />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleCreate} disabled={saving || !homeId || !awayId}
              className="btn-primary flex-1">
              {saving ? 'Creating…' : 'Create Game'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Edit League Modal ──────────────────────────────────────────────────────────

function EditLeagueModal({ leagueId, league, onClose }) {
  const navigate = useNavigate()
  const [name, setName]         = useState(league.name || '')
  const [description, setDesc]  = useState(league.description || '')
  const [season, setSeason]     = useState(league.season || '')
  const [location, setLocation] = useState(league.location || '')
  const [maxTeams, setMaxTeams] = useState(league.maxTeams ?? '')
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await updateLeague(leagueId, {
        name:        name.trim(),
        nameLower:   name.trim().toLowerCase(),
        description: description.trim(),
        season:      season.trim(),
        location:    location.trim(),
        maxTeams:    maxTeams !== '' ? Number(maxTeams) : null,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${league.name}" and all its teams? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await deleteLeague(leagueId)
      navigate('/leagues')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={onClose}>
      <div className="w-full max-w-sm rounded-t-3xl bg-[#1a1f2e] p-6 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-bold text-white">Edit League</h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">League name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Season</label>
            <input value={season} onChange={(e) => setSeason(e.target.value)}
              placeholder="e.g. Fall 2026" className="input" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Location</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)}
              placeholder="City, venue, etc." className="input" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Max teams</label>
            <input type="number" min={2} value={maxTeams}
              onChange={(e) => setMaxTeams(e.target.value)} className="input" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Description</label>
            <textarea value={description} onChange={(e) => setDesc(e.target.value)}
              rows={3} className="input resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleSave} disabled={saving || !name.trim()}
              className="btn-primary flex-1">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
          {/* Danger zone */}
          <div className="border-t border-white/5 pt-3">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="w-full rounded-xl bg-red-950/60 py-2 text-sm font-semibold text-red-400 hover:bg-red-900/80 hover:text-red-300 transition disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Delete League'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Auto-Schedule Modal ────────────────────────────────────────────────────────

function AutoScheduleModal({ leagueId, league, teams, onClose }) {
  const { user } = useAuth()

  // Default start = tomorrow 9am
  const defaultStart = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(9, 0, 0, 0)
    return d.toISOString().slice(0, 16)
  })()

  const [startAt, setStartAt]       = useState(defaultStart)
  const [duration, setDuration]     = useState(60)   // game duration in minutes
  const [breakMins, setBreakMins]   = useState(15)   // break between slots
  const [fields, setFields]         = useState(1)    // concurrent games
  const [randomize, setRandomize]   = useState(true)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')

  // Preview: total matchups = n*(n-1)/2
  const n = teams.length
  const totalMatchups = (n * (n - 1)) / 2
  const slotMinutes = duration + breakMins
  const totalSlots  = Math.ceil(totalMatchups / fields)
  const totalMins   = totalSlots * slotMinutes
  const endTime = new Date(new Date(startAt).getTime() + totalMins * 60 * 1000)
  const endLabel = startAt ? endTime.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'

  async function handleGenerate() {
    if (!startAt) { setError('Choose a start date/time.'); return }
    setSaving(true)
    setError('')
    try {
      // Build matchup list (all pairs)
      let ordered = [...teams]
      if (randomize) ordered = ordered.sort(() => Math.random() - 0.5)

      const matchups = []
      for (let i = 0; i < ordered.length; i++) {
        for (let j = i + 1; j < ordered.length; j++) {
          matchups.push({ home: ordered[i], away: ordered[j] })
        }
      }

      const startMs = new Date(startAt).getTime()
      const slotMs  = slotMinutes * 60 * 1000
      const sport   = league.sport || 'basketball'
      const isBB    = sport === 'baseball' || sport === 'softball'

      for (let i = 0; i < matchups.length; i++) {
        const slotIndex   = Math.floor(i / fields)
        const scheduledAt = new Date(startMs + slotIndex * slotMs).toISOString()
        const { home, away } = matchups[i]
        const joinCode = await generateUniqueJoinCode()
        await createGame(home.clubId || null, {
          homeTeam: home.name,
          awayTeam: away.name,
          awayClubId: away.clubId || null,
          sport,
          joinCode,
          scorekeeperId: user.uid,
          leagueId,
          homeLeagueTeamId: home.id,
          awayLeagueTeamId: away.id,
          ...(isBB ? { totalInnings: sport === 'softball' ? 7 : 9 } : { totalPeriods: 4, periodLength: 600 }),
          scheduledAt,
        })
      }
      onClose()
    } catch {
      setError('Failed to generate schedule. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center"
      onClick={onClose}>
      <div className="w-full max-w-sm rounded-t-3xl bg-[#1a1f2e] p-6 sm:rounded-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}>
        <div>
          <h3 className="text-lg font-bold text-white">Auto-Schedule</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Generates all {totalMatchups} games ({n} teams, round robin)
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-gray-400">Start date &amp; time</label>
          <input type="datetime-local" value={startAt}
            onChange={(e) => setStartAt(e.target.value)} className="input" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Game duration (min)</label>
            <input type="number" min={10} max={240} value={duration}
              onChange={(e) => setDuration(Number(e.target.value))} className="input" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Break between (min)</label>
            <input type="number" min={0} max={120} value={breakMins}
              onChange={(e) => setBreakMins(Number(e.target.value))} className="input" />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-gray-400">
            Concurrent fields / courts
          </label>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((n) => (
              <button key={n} type="button"
                onClick={() => setFields(n)}
                className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
                  fields === n ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}>
                {n}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => setRandomize((r) => !r)}
            className={`relative h-5 w-9 rounded-full transition ${randomize ? 'bg-blue-600' : 'bg-gray-700'}`}>
            <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${randomize ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-sm text-gray-300">Randomize matchup order</span>
        </label>

        {/* Preview */}
        <div className="rounded-xl bg-gray-800/60 px-4 py-3 space-y-1 text-xs text-gray-400">
          <p><span className="text-gray-500">Games:</span> {totalMatchups} ({Math.ceil(totalMatchups / fields)} time slots)</p>
          <p><span className="text-gray-500">Duration:</span> ~{Math.round(totalMins / 60 * 10) / 10} hrs</p>
          <p><span className="text-gray-500">Ends ~</span>{endLabel}</p>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleGenerate} disabled={saving || !startAt}
            className="btn-primary flex-1">
            {saving ? `Creating games…` : `Generate ${totalMatchups} Games`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Edit Team Modal ────────────────────────────────────────────────────────────

function EditTeamModal({ leagueId, team, onClose }) {
  const [name, setName]               = useState(team.name || '')
  const [managerName, setManagerName] = useState(team.managerName || '')
  const [managerEmail, setEmail]      = useState(team.managerEmail || '')
  const [saving, setSaving]           = useState(false)

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await updateLeagueTeam(leagueId, team.id, {
        name:         name.trim(),
        managerName:  managerName.trim(),
        managerEmail: managerEmail.trim(),
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={onClose}>
      <div className="w-full max-w-sm rounded-t-3xl bg-[#1a1f2e] p-6 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-bold text-white">Edit Team</h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Team name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Manager name</label>
            <input value={managerName} onChange={(e) => setManagerName(e.target.value)} className="input" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Manager email</label>
            <input type="email" value={managerEmail} onChange={(e) => setEmail(e.target.value)} className="input" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleSave} disabled={saving || !name.trim()}
              className="btn-primary flex-1">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
