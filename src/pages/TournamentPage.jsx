import { useEffect, useState, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { uploadTournamentPhoto } from '../firebase/storage'
import {
  subscribeToTournament,
  subscribeToTournamentTeams,
  subscribeToTournamentGames,
  acceptTeam,
  rejectTeam,
  setTeamSeed,
  updateTournament,
  updateTeam,
  deleteTeam,
  deleteTournament,
  buildSingleEliminationBracket,
  buildRoundRobinSchedule,
  buildDoubleEliminationBracket,
  buildSmartSchedule,
  declareMatchWinner,
  linkGameToMatchup,
  markPlayerPaid,
  createTeamPool,
} from '../firebase/tournaments'
import { createGame, saveLineup, updateGame } from '../firebase/firestore'
import { generateUniqueJoinCode } from '../lib/generateJoinCode'
import BracketView from '../components/tournament/BracketView'
import SponsorBanner from '../components/SponsorBanner'
import { LiveDot, ScorekeeperLinkChip } from '../components/ui'
import { useLiveClubs } from '../hooks/useLiveClubs'

// ── Default game params by sport ──────────────────────────────────────────────
function defaultGameParams(sport) {
  if (sport === 'baseball') return { totalInnings: 9, totalPeriods: null, periodLength: null }
  if (sport === 'softball') return { totalInnings: 7, totalPeriods: null, periodLength: null }
  return { totalInnings: null, totalPeriods: 4, periodLength: 600 }
}

function fmtScheduled(iso) {
  if (!iso) return null
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS_STYLE = {
  registration: 'bg-blue-900/50 text-blue-300',
  active:       'bg-green-900/50 text-green-300',
  complete:     'bg-gray-800 text-gray-400',
}

function StatusBadge({ status }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize ${STATUS_STYLE[status] || 'bg-gray-800 text-gray-400'}`}>
      {status}
    </span>
  )
}

// ── Team status badge ─────────────────────────────────────────────────────────
const TEAM_BADGE = {
  pending:   'bg-yellow-900/50 text-yellow-300',
  accepted:  'bg-green-900/50 text-green-300',
  withdrawn: 'bg-red-900/50 text-red-300',
}

// ─────────────────────────────────────────────────────────────────────────────

export default function TournamentPage() {
  const { tourId }  = useParams()
  const { user }    = useAuth()
  const navigate    = useNavigate()

  const [tournament, setTournament] = useState(null)
  const [teams, setTeams]           = useState([])
  const [games, setGames]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [tab, setTab]               = useState('teams')

  const [scheduleMatch, setScheduleMatch]   = useState(null)
  const [declareMatch, setDeclareMatch]     = useState(null)
  const [generating, setGenerating]         = useState(false)
  const [statusBusy, setStatusBusy]         = useState(false)
  const [showEditTournament, setShowEditTournament] = useState(false)
  const [editTeamModal, setEditTeamModal]   = useState(null)
  const [showAutoSchedule, setShowAutoSchedule]       = useState(false)
  const [showBracketSetup, setShowBracketSetup]       = useState(false)
  const [draggedGameId, setDraggedGameId]             = useState(null)
  const [editMatch, setEditMatch]                     = useState(null)
  const [photoUploading, setPhotoUploading]         = useState(false)
  const [photoError, setPhotoError]                 = useState('')
  const photoInputRef = useRef(null)

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoError('')
    setPhotoUploading(true)
    try {
      const url = await uploadTournamentPhoto(tourId, file)
      await updateTournament(tourId, { photoUrl: url })
    } catch (err) {
      setPhotoError('Photo upload failed: ' + (err?.message || 'unknown error'))
    } finally {
      setPhotoUploading(false)
      e.target.value = ''
    }
  }

  useEffect(() => {
    const u1 = subscribeToTournament(tourId, (t) => { setTournament(t); setLoading(false) })
    const u2 = subscribeToTournamentTeams(tourId, setTeams)
    const u3 = subscribeToTournamentGames(tourId, setGames)
    return () => { u1(); u2(); u3() }
  }, [tourId])

  const isHost        = !!user && user.uid === tournament?.hostId
  const acceptedTeams = teams.filter((t) => t.status === 'accepted')
  const pendingTeams  = teams.filter((t) => t.status === 'pending')
  const canGenerate   = isHost && acceptedTeams.length >= 2 && tournament?.status === 'registration'
  const [copiedGameId, setCopiedGameId] = useState(null)

  function copyScoreKeeperLink(gameId) {
    const url = `${window.location.origin}/scorekeeper/${gameId}`
    navigator.clipboard.writeText(url).catch(() => {})
    setCopiedGameId(gameId)
    setTimeout(() => setCopiedGameId(null), 2000)
  }

  // ── Generate bracket / schedule ──────────────────────────────────────────
  async function handleGenerate(setupOpts) {
    // For DE format, show setup modal first
    if (tournament.format === 'double_elimination' && !setupOpts) {
      setShowBracketSetup(true)
      return
    }

    setGenerating(true)
    try {
      const sorted = [...acceptedTeams].sort((a, b) => {
        if (a.seed && b.seed) return a.seed - b.seed
        if (a.seed) return -1
        if (b.seed) return 1
        return 0
      })

      let data
      if (tournament.format === 'single_elimination') {
        data = { bracket: buildSingleEliminationBracket(sorted), status: 'active' }
      } else if (tournament.format === 'round_robin') {
        data = { schedule: buildRoundRobinSchedule(sorted), status: 'active' }
      } else if (tournament.format === 'double_elimination') {
        const { bracket, losersBracket } = buildDoubleEliminationBracket(sorted)
        // Auto-schedule if setup options provided
        if (setupOpts?.startDate) {
          // Group matches by round for scheduling
          const wMatches = bracket.filter((m) => m.bracket !== 'grandFinal')
          const rounds = [...new Set(wMatches.map((m) => m.round))].sort((a, b) => a - b)
          const roundGroups = rounds.map((r) => wMatches.filter((m) => m.round === r))
          // Also include L bracket rounds in order
          if (losersBracket.length > 0) {
            const lRounds = [...new Set(losersBracket.map((m) => m.lRound))].sort((a, b) => a - b)
            lRounds.forEach((lr) => {
              roundGroups.push(losersBracket.filter((m) => m.lRound === lr))
            })
          }
          const scheduled = buildSmartSchedule(roundGroups, setupOpts)
          // Re-apply scheduled info back to bracket arrays
          scheduled.forEach((sm) => {
            const wIdx = bracket.findIndex((m) => m.matchId === sm.matchId)
            if (wIdx !== -1) { bracket[wIdx] = { ...bracket[wIdx], scheduledAt: sm.scheduledAt, field: sm.field } }
            const lIdx = losersBracket.findIndex((m) => m.matchId === sm.matchId)
            if (lIdx !== -1) { losersBracket[lIdx] = { ...losersBracket[lIdx], scheduledAt: sm.scheduledAt, field: sm.field } }
          })
        }
        data = { bracket, losersBracket, status: 'active' }
      }
      if (data) await updateTournament(tourId, data)
      setTab('bracket')
    } finally {
      setGenerating(false)
      setShowBracketSetup(false)
    }
  }

  // ── Status advancement ────────────────────────────────────────────────────
  async function handleMarkComplete() {
    setStatusBusy(true)
    try { await updateTournament(tourId, { status: 'complete' }) }
    finally { setStatusBusy(false) }
  }

  // ── Schedule game (create and link) ──────────────────────────────────────
  async function handleScheduleGame(match, inningCount, scheduledAt) {
    const sport  = tournament.sport || 'basketball'
    const params = defaultGameParams(sport)
    if (inningCount) params.totalInnings = inningCount
    const code   = await generateUniqueJoinCode()
    const gameId = await createGame(null, {
      homeTeam:     match.homeTeamName,
      awayTeam:     match.awayTeamName,
      sport,
      ...params,
      joinCode:     code,
      scorekeeperId: user.uid,
      tournamentId:  tourId,
      bracketMatchId: match.matchId,
      scheduledAt: scheduledAt || null,
    })

    // Pre-populate lineups from team rosters
    const homeTeam = teams.find((t) => t.id === match.homeTeamId)
    const awayTeam = teams.find((t) => t.id === match.awayTeamId)
    if (homeTeam?.players?.length) {
      await saveLineup(gameId, 'home', homeTeam.players.map((p) => ({
        playerId: p.id, playerName: p.name, playerNumber: p.number || '', position: p.position || '',
      })))
    }
    if (awayTeam?.players?.length) {
      await saveLineup(gameId, 'away', awayTeam.players.map((p) => ({
        playerId: p.id, playerName: p.name, playerNumber: p.number || '', position: p.position || '',
      })))
    }

    await linkGameToMatchup(tourId, match.matchId, gameId, tournament)
    setScheduleMatch(null)
    navigate(`/scorekeeper/${gameId}`)
  }

  // ── Declare winner ────────────────────────────────────────────────────────
  async function handleDeclare(match, winnerId, winnerName, bracketType = 'winners') {
    await declareMatchWinner(tourId, match.matchId, winnerId, winnerName, tournament, bracketType)
    setDeclareMatch(null)
  }

  async function handleDropGame(targetGameId) {
    if (!draggedGameId || draggedGameId === targetGameId) { setDraggedGameId(null); return }
    const src = games.find((g) => g.id === draggedGameId)
    const tgt = games.find((g) => g.id === targetGameId)
    if (!src || !tgt) { setDraggedGameId(null); return }
    await Promise.all([
      updateGame(draggedGameId, { scheduledAt: tgt.scheduledAt || null }),
      updateGame(targetGameId,  { scheduledAt: src.scheduledAt || null }),
    ])
    setDraggedGameId(null)
  }

  if (loading) return <Spinner />

  if (!tournament) return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#0f1117] text-gray-400">
      <p>Tournament not found.</p>
      <Link to="/tournaments" className="text-blue-400">Browse tournaments</Link>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0f1117] pb-28">
      <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />

      {/* ── Cover photo ── */}
      {tournament.photoUrl ? (
        <div className="relative h-40 w-full overflow-hidden sm:h-52">
          <img src={tournament.photoUrl} alt="cover" className="h-full w-full object-cover" />
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

      {/* ── Header ── */}
      <header className="border-b border-white/5 px-5 py-5">
        <div className="mb-3 flex items-center justify-between">
          <Link to="/tournaments" className="text-sm text-gray-500 hover:text-white">← Tournaments</Link>
          <div className="flex items-center gap-2">
            <StatusBadge status={tournament.status} />
            {isHost && (
              <button onClick={() => setShowEditTournament(true)}
                className="rounded-xl bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-gray-700 transition">
                Edit
              </button>
            )}
          </div>
        </div>

        <h1 className="text-2xl font-extrabold text-white leading-tight">{tournament.name}</h1>
        <p className="mt-1 text-sm capitalize text-gray-400">
          {tournament.sport} · {tournament.format?.replace('_', ' ')}
          {tournament.location && ` · ${tournament.location}`}
        </p>
        {tournament.description && (
          <p className="mt-1.5 text-sm text-gray-500">{tournament.description}</p>
        )}

        {/* Join code + register */}
        {tournament.status === 'registration' && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigator.clipboard.writeText(tournament.joinCode)}
              className="flex items-center gap-2 rounded-xl bg-[#1a1f2e] px-4 py-2 ring-1 ring-white/5 hover:ring-gray-600 transition"
            >
              <span className="text-xs text-gray-500">Code</span>
              <span className="font-mono text-sm font-extrabold tracking-widest text-blue-400">
                {tournament.joinCode}
              </span>
              <span className="text-[10px] text-gray-600">copy</span>
            </button>
            <Link
              to={`/tournament/${tourId}/join`}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition"
            >
              + Register Team
            </Link>
          </div>
        )}
      </header>

      {/* Sponsor banner */}
      <SponsorBanner doc={tournament} isHost={user?.uid === tournament?.hostId} />

      {/* ── Tab bar ── */}
      <div className="sticky top-0 z-10 flex gap-1 border-b border-white/5 bg-[#0f1117] px-5">
        {['teams', 'bracket', 'games'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative py-3 px-4 text-sm font-semibold capitalize transition ${
              tab === t ? 'text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t}
            {t === 'teams' && pendingTeams.length > 0 && (
              <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500 text-[9px] font-bold text-gray-900">
                {pendingTeams.length}
              </span>
            )}
            {tab === t && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-blue-500" />
            )}
          </button>
        ))}
      </div>

      {/* ── Teams tab ── */}
      {tab === 'teams' && (
        <div className="mx-auto max-w-lg px-5 pt-4 space-y-3">
          {/* Host controls */}
          {isHost && (
            <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-semibold text-white">
                  {acceptedTeams.length} / {tournament.maxTeams} accepted
                </p>
                <p className="text-xs text-gray-500">{pendingTeams.length} pending review</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canGenerate && (
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
                  >
                    {generating ? 'Generating…' : `Generate ${tournament.format === 'round_robin' ? 'Schedule' : 'Bracket'}`}
                  </button>
                )}
                {tournament.status === 'active' && (
                  <button
                    onClick={handleMarkComplete}
                    disabled={statusBusy}
                    className="rounded-xl bg-gray-700 px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-gray-600 disabled:opacity-50"
                  >
                    {statusBusy ? 'Saving…' : 'Mark Complete'}
                  </button>
                )}
              </div>
            </div>
          )}

          {teams.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-700 py-12 text-center">
              <p className="text-gray-500 text-sm">No teams registered yet.</p>
              {tournament.status === 'registration' && (
                <Link to={`/tournament/${tourId}/join`} className="mt-3 inline-block text-sm text-blue-400">
                  Register first team →
                </Link>
              )}
            </div>
          )}

          {/* Pending */}
          {pendingTeams.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-yellow-500">Pending</p>
              <div className="space-y-2">
                {pendingTeams.map((team) => (
                  <TeamCard key={team.id} team={team} isHost={isHost} tourId={tourId} tournament={tournament}
                    onEdit={() => setEditTeamModal(team)}
                    onRemove={async () => { if (confirm(`Remove ${team.name}?`)) await deleteTeam(tourId, team.id) }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Accepted */}
          {acceptedTeams.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-green-500">Accepted</p>
              <div className="space-y-2">
                {acceptedTeams.map((team) => (
                  <TeamCard key={team.id} team={team} isHost={isHost} tourId={tourId} tournament={tournament}
                    onEdit={() => setEditTeamModal(team)}
                    onRemove={async () => { if (confirm(`Remove ${team.name}?`)) await deleteTeam(tourId, team.id) }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Withdrawn */}
          {teams.filter((t) => t.status === 'withdrawn').length > 0 && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-600">Withdrawn</p>
              <div className="space-y-2">
                {teams.filter((t) => t.status === 'withdrawn').map((team) => (
                  <TeamCard key={team.id} team={team} isHost={isHost} tourId={tourId} tournament={tournament}
                    onEdit={() => setEditTeamModal(team)}
                    onRemove={async () => { if (confirm(`Remove ${team.name}?`)) await deleteTeam(tourId, team.id) }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Bracket tab ── */}
      {tab === 'bracket' && (
        <div className="pt-2">
          {isHost && canGenerate && (
            <div className="mx-auto max-w-lg px-5 pt-4">
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="w-full rounded-2xl bg-green-600 py-3 text-base font-semibold text-white hover:bg-green-500 disabled:opacity-50"
              >
                {generating ? 'Generating…' : `Generate ${tournament.format === 'round_robin' ? 'Schedule' : 'Bracket'}`}
              </button>
            </div>
          )}
          {/* Auto-schedule button — shown when bracket exists but games not yet scheduled */}
          {isHost && tournament.status === 'active' && (() => {
            const isRR  = tournament.format === 'round_robin'
            const isDE  = tournament.format === 'double_elimination'
            const matchups = isRR
              ? (tournament.schedule || [])
              : (tournament.bracket  || [])
            const lMatchups = tournament.losersBracket || []
            const r1Unsched = isRR
              ? matchups.filter((m) => !m.gameId && m.homeTeamId && m.awayTeamId)
              : isDE
                ? [...matchups.filter((m) => m.bracket === 'winners' && m.round === 1 && !m.gameId && m.homeTeamId && m.awayTeamId),
                   ...lMatchups.filter((m) => m.lRound === 1 && !m.gameId && m.homeTeamId && m.awayTeamId)]
                : matchups.filter((m) => m.round === 1 && !m.gameId && m.homeTeamId && m.awayTeamId)
            return r1Unsched.length > 0
          })() && (
            <div className="mx-auto max-w-lg px-5 pt-3">
              <button
                onClick={() => setShowAutoSchedule(true)}
                className="w-full rounded-2xl bg-indigo-700 py-3 text-base font-semibold text-white hover:bg-indigo-600"
              >
                ⚡ Auto-Schedule {tournament.format === 'single_elimination' ? 'Round 1' : 'All Games'}
              </button>
            </div>
          )}
          <BracketView
            tournament={tournament}
            teams={acceptedTeams}
            games={games}
            isHost={isHost}
            onSchedule={(match, bType) => { setScheduleMatch({ ...match, _bracketType: bType }) }}
            onDeclare={(match, bType) => setDeclareMatch({ ...match, _bracketType: bType })}
            onEdit={(match) => setEditMatch(match)}
            copiedGameId={copiedGameId}
            onCopyLink={copyScoreKeeperLink}
          />
        </div>
      )}

      {/* ── Games tab ── */}
      {tab === 'games' && (
        <div className="mx-auto max-w-lg px-5 pt-4 space-y-3">
          {games.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-700 py-12 text-center">
              <p className="text-sm text-gray-500">No games scheduled yet.</p>
              {isHost && (
                <p className="mt-2 text-xs text-gray-600">
                  Generate a bracket then use "Schedule Game" on each matchup.
                </p>
              )}
            </div>
          )}
          {games.length > 0 && isHost && (
            <p className="text-[10px] text-gray-600 text-center">Drag games to swap their time slots</p>
          )}
          {games.map((game) => {
            const isSetup   = game.status === 'setup'
            const isLive    = game.status === 'live'
            const isFinal   = game.status === 'final'
            const scheduled = fmtScheduled(game.scheduledAt)
            const isDragged = draggedGameId === game.id
            return (
              <div
                key={game.id}
                className={`card flex items-center justify-between gap-3 transition ${isDragged ? 'opacity-40 ring-2 ring-indigo-500' : 'hover:bg-[#242938]'}`}
                draggable={isHost}
                onDragStart={() => setDraggedGameId(game.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDropGame(game.id)}
                onDragEnd={() => setDraggedGameId(null)}
                style={{ cursor: isHost ? 'grab' : 'default' }}
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    {isHost && <span className="text-[9px] text-gray-700 select-none">⠿</span>}
                    {isLive && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-900/60 px-2 py-0.5 text-[10px] font-bold text-green-300 ring-1 ring-green-800/40">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                        LIVE
                      </span>
                    )}
                    {isFinal && <span className="text-[10px] font-bold uppercase text-gray-500">Final</span>}
                    {isSetup && scheduled && <span className="text-[10px] text-gray-400">{scheduled}</span>}
                  </div>
                  <p className="flex items-center gap-1.5 truncate font-semibold text-white">
                    {isLive && <LiveDot />}
                    {game.homeTeam} <span className="font-normal text-gray-500">vs</span> {game.awayTeam}
                  </p>
                  {(isLive || isFinal) && (
                    <p className="font-mono font-bold text-white">{game.homeScore} – {game.awayScore}</p>
                  )}
                  {game.joinCode && isHost && (
                    <ScorekeeperLinkChip
                      gameId={game.id}
                      joinCode={game.joinCode}
                      copied={copiedGameId === game.id}
                      onCopy={() => copyScoreKeeperLink(game.id)}
                      className="mt-2"
                    />
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <Link to={`/game/${game.id}`}
                    className="text-xs font-semibold text-blue-400 hover:text-blue-300">
                    Scoreboard →
                  </Link>
                  {isHost && isSetup && (
                    <Link to={`/scorekeeper/${game.id}`}
                      className="text-xs font-semibold text-green-400 hover:text-green-300">
                      Start Game →
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Schedule Game Modal ── */}
      {scheduleMatch && (
        <ScheduleGameModal
          match={scheduleMatch}
          tournament={tournament}
          onConfirm={(inningCount, scheduledAt) => handleScheduleGame(scheduleMatch, inningCount, scheduledAt)}
          onClose={() => setScheduleMatch(null)}
        />
      )}

      {/* ── Declare Winner Modal ── */}
      {declareMatch && (
        <DeclareWinnerModal
          match={declareMatch}
          onDeclare={(winnerId, winnerName) => handleDeclare(declareMatch, winnerId, winnerName, declareMatch._bracketType || 'winners')}
          onClose={() => setDeclareMatch(null)}
        />
      )}

      {/* ── Bracket Setup Modal (DE pre-generation) ── */}
      {showBracketSetup && (
        <BracketSetupModal
          tournament={tournament}
          onGenerate={(opts) => handleGenerate(opts)}
          onClose={() => setShowBracketSetup(false)}
          generating={generating}
        />
      )}

      {showEditTournament && (
        <EditTournamentModal
          tourId={tourId}
          tournament={tournament}
          onClose={() => setShowEditTournament(false)}
        />
      )}

      {editTeamModal && (
        <EditTeamModal
          tourId={tourId}
          team={editTeamModal}
          onClose={() => setEditTeamModal(null)}
        />
      )}

      {showAutoSchedule && (
        <TournamentAutoScheduleModal
          tourId={tourId}
          tournament={tournament}
          teams={acceptedTeams}
          user={user}
          onClose={() => setShowAutoSchedule(false)}
          onGameCreated={(match, gameId) => linkGameToMatchup(tourId, match.matchId, gameId, tournament)}
        />
      )}

      {editMatch && (
        <EditMatchupModal
          match={editMatch}
          tournament={tournament}
          teams={acceptedTeams}
          tourId={tourId}
          onClose={() => setEditMatch(null)}
        />
      )}
    </div>
  )
}

// ── Team card ─────────────────────────────────────────────────────────────────

function TeamCard({ team, isHost, tourId, tournament, onEdit, onRemove }) {
  const [seedEdit, setSeedEdit]       = useState(false)
  const [seed, setSeed]               = useState(team.seed ?? '')
  const [busy, setBusy]               = useState(false)
  const { liveClubIds }               = useLiveClubs()
  const [expanded, setExpanded]       = useState(false)
  const [creatingPool, setCreatingPool] = useState(false)

  const feeEnabled = tournament?.feeEnabled
  const entryFee   = tournament?.entryFee || 0
  const players    = team.players || []

  async function handleAccept() {
    setBusy(true)
    try { await acceptTeam(tourId, team.id) } finally { setBusy(false) }
  }
  async function handleReject() {
    setBusy(true)
    try { await rejectTeam(tourId, team.id) } finally { setBusy(false) }
  }
  async function handleSaveSeed() {
    await setTeamSeed(tourId, team.id, seed ? Number(seed) : null)
    setSeedEdit(false)
  }
  async function handleTogglePaid(playerId, currentPaid) {
    await markPlayerPaid(tourId, team.id, playerId, !currentPaid)
  }
  async function handleCreatePool() {
    setCreatingPool(true)
    try {
      await createTeamPool(tourId, team.id, {
        tournamentName: tournament.name,
        teamName: team.name,
        entryFee,
      })
    } catch (e) {
      alert(e.message || 'Failed to create pool')
    } finally {
      setCreatingPool(false)
    }
  }

  return (
    <div className="card p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 font-semibold text-white">
            {team.name}
            {team.clubId && liveClubIds.has(team.clubId) && <LiveDot title={`${team.name} is live!`} />}
          </p>
          <p className="text-xs text-gray-400">{team.managerName} · {team.managerEmail}</p>
        </div>
        <div className="flex items-center gap-2">
          {feeEnabled && team.fullyFunded && (
            <span className="rounded-full bg-green-900/50 px-2 py-0.5 text-[10px] font-bold text-green-400">PAID</span>
          )}
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${TEAM_BADGE[team.status] || 'bg-gray-700 text-gray-300'}`}>
            {team.status}
          </span>
        </div>
      </div>

      {/* Fee status row */}
      {feeEnabled && entryFee > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-gray-800/50 px-3 py-2">
          <p className="text-xs text-gray-400">
            {team.totalPaid || 0} / {players.length || '?'} paid
            {players.length > 0 && ` · $${(entryFee / players.length).toFixed(2)}/player`}
          </p>
          {team.chipInPoolUrl ? (
            <a
              href={team.chipInPoolUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-blue-400 hover:text-blue-300"
            >
              View Pool →
            </a>
          ) : isHost && team.status === 'accepted' ? (
            <button
              onClick={handleCreatePool}
              disabled={creatingPool}
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 disabled:opacity-50"
            >
              {creatingPool ? 'Creating…' : 'Create Pool'}
            </button>
          ) : null}
        </div>
      )}

      {/* Roster toggle */}
      {players.length > 0 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-gray-500 hover:text-gray-300"
        >
          {expanded ? '▲ Hide roster' : `▼ Roster (${players.length} players)`}
        </button>
      )}

      {/* Roster list */}
      {expanded && players.length > 0 && (
        <div className="overflow-hidden rounded-xl bg-gray-800/60 divide-y divide-gray-700/50">
          {players.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-3 py-2">
              <span className="w-5 text-center font-mono text-[10px] text-gray-600">{p.number || '—'}</span>
              <span className="flex-1 text-sm text-gray-200">{p.name}</span>
              {p.position && <span className="text-[10px] text-gray-600">{p.position}</span>}
              {feeEnabled && isHost && (
                <button
                  onClick={() => handleTogglePaid(p.id, p.paid)}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold transition ${
                    p.paid
                      ? 'bg-green-900/60 text-green-400 hover:bg-red-900/40 hover:text-red-400'
                      : 'bg-gray-700 text-gray-400 hover:bg-green-900/40 hover:text-green-400'
                  }`}
                >
                  {p.paid ? 'Paid ✓' : 'Unpaid'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Seed */}
      {team.status === 'accepted' && isHost && (
        <div className="flex items-center gap-2">
          {seedEdit ? (
            <>
              <input
                type="number"
                min={1}
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                className="input w-20 py-1 text-sm"
                placeholder="Seed"
                autoFocus
              />
              <button onClick={handleSaveSeed} className="text-xs text-green-400 hover:text-green-300">Save</button>
              <button onClick={() => setSeedEdit(false)} className="text-xs text-gray-500 hover:text-gray-300">Cancel</button>
            </>
          ) : (
            <button
              onClick={() => setSeedEdit(true)}
              className="text-xs text-gray-500 hover:text-gray-300"
            >
              {team.seed ? `Seed: #${team.seed}` : 'Set seed'}
            </button>
          )}
        </div>
      )}

      {/* Host actions */}
      {isHost && team.status === 'pending' && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleAccept}
            disabled={busy}
            className="flex-1 rounded-xl bg-green-700 py-2 text-xs font-semibold text-white hover:bg-green-600 disabled:opacity-50"
          >
            Accept
          </button>
          <button
            onClick={handleReject}
            disabled={busy}
            className="flex-1 rounded-xl bg-red-900/60 py-2 text-xs font-semibold text-red-300 hover:bg-red-900 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      )}

      {/* Edit / Remove (host only) */}
      {isHost && (
        <div className="flex gap-2">
          {onEdit && (
            <button onClick={onEdit}
              className="rounded-lg bg-gray-700 px-2.5 py-1 text-xs font-semibold text-gray-300 hover:bg-gray-600 transition">
              Edit
            </button>
          )}
          {onRemove && (
            <button onClick={onRemove}
              className="rounded-lg bg-gray-800 px-2.5 py-1 text-xs font-semibold text-gray-500 hover:bg-red-900/60 hover:text-red-400 transition">
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Schedule Game Modal ───────────────────────────────────────────────────────

function ScheduleGameModal({ match, tournament, onConfirm, onClose }) {
  const sport      = tournament.sport || 'basketball'
  const isBaseball = sport === 'baseball' || sport === 'softball'
  const [innings, setInnings]         = useState(sport === 'softball' ? 7 : 9)
  const [scheduledAt, setScheduledAt] = useState('')
  const [saving, setSaving]           = useState(false)

  async function handleConfirm() {
    setSaving(true)
    try { await onConfirm(isBaseball ? innings : null, scheduledAt || null) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70">
      <div className="w-full max-w-sm rounded-t-3xl bg-[#1a1f2e] px-6 py-8 space-y-5">
        <h3 className="text-lg font-bold text-white">Schedule Game</h3>
        <div className="rounded-xl bg-gray-800 px-4 py-3 space-y-1">
          <p className="text-sm font-semibold text-white">{match.homeTeamName}</p>
          <p className="text-[10px] font-bold text-gray-500">VS</p>
          <p className="text-sm font-semibold text-white">{match.awayTeamName}</p>
        </div>
        {isBaseball && (
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Innings</label>
            <div className="flex gap-2">
              {[7, 9].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setInnings(n)}
                  className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
                    innings === n ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {n} innings
                </button>
              ))}
              <button
                type="button"
                onClick={() => setInnings(5)}
                className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
                  innings === 5 ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                5 inn.
              </button>
            </div>
          </div>
        )}
        <p className="text-xs text-gray-500">
          You'll be taken to the scorekeeper after creating the game.
        </p>
        <div>
          <label className="mb-1.5 block text-sm text-gray-400">Date &amp; Time <span className="text-gray-600">(optional)</span></label>
          <input type="datetime-local" value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="input" />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleConfirm} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Creating…' : 'Create Game →'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Declare Winner Modal ──────────────────────────────────────────────────────

function DeclareWinnerModal({ match, onDeclare, onClose }) {
  const [busy, setBusy] = useState(false)

  async function pick(id, name) {
    setBusy(true)
    try { await onDeclare(id, name) } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70">
      <div className="w-full max-w-sm rounded-t-3xl bg-[#1a1f2e] px-6 py-8 space-y-5">
        <h3 className="text-lg font-bold text-white">Declare Winner</h3>
        <p className="text-sm text-gray-400">Choose the winning team for this matchup.</p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => pick(match.homeTeamId, match.homeTeamName)}
            disabled={busy || !match.homeTeamId}
            className="rounded-2xl bg-gray-800 px-5 py-4 text-left font-semibold text-white hover:bg-gray-700 disabled:opacity-40"
          >
            {match.homeTeamName}
          </button>
          <button
            onClick={() => pick(match.awayTeamId, match.awayTeamName)}
            disabled={busy || !match.awayTeamId}
            className="rounded-2xl bg-gray-800 px-5 py-4 text-left font-semibold text-white hover:bg-gray-700 disabled:opacity-40"
          >
            {match.awayTeamName}
          </button>
        </div>
        <button onClick={onClose} className="btn-secondary w-full">Cancel</button>
      </div>
    </div>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#0f1117]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
    </div>
  )
}

// ── Edit Tournament Modal ─────────────────────────────────────────────────────

function EditTournamentModal({ tourId, tournament, onClose }) {
  const navigate = useNavigate()
  const [name, setName]           = useState(tournament.name || '')
  const [description, setDesc]    = useState(tournament.description || '')
  const [location, setLocation]   = useState(tournament.location || '')
  const [startDate, setStartDate] = useState(tournament.startDate || '')
  const [maxTeams, setMaxTeams]   = useState(tournament.maxTeams ?? '')
  const [saving, setSaving]       = useState(false)
  const [deleting, setDeleting]   = useState(false)

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await updateTournament(tourId, {
        name:        name.trim(),
        description: description.trim(),
        location:    location.trim(),
        startDate:   startDate,
        maxTeams:    maxTeams !== '' ? Number(maxTeams) : null,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${tournament.name}" and all its registered teams? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await deleteTournament(tourId)
      navigate('/tournaments')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={onClose}>
      <div className="w-full max-w-sm rounded-t-3xl bg-[#1a1f2e] p-6 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-bold text-white">Edit Tournament</h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Tournament name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Location</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)}
              placeholder="City, venue, etc." className="input" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Start date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input" />
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
              {deleting ? 'Deleting…' : 'Delete Tournament'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Tournament Auto-Schedule Modal ────────────────────────────────────────────

function TournamentAutoScheduleModal({ tourId, tournament, teams, user, onClose, onGameCreated }) {
  const isRR   = tournament.format === 'round_robin'
  const sport  = tournament.sport || 'basketball'
  const isBB   = sport === 'baseball' || sport === 'softball'

  // Get unscheduled matchups (R1 for SE, all for RR)
  const field    = isRR ? 'schedule' : 'bracket'
  const allMatch = tournament[field] || []
  const pending  = isRR
    ? allMatch.filter((m) => !m.gameId && m.homeTeamId && m.awayTeamId)
    : allMatch.filter((m) => m.round === 1 && !m.gameId && m.homeTeamId && m.awayTeamId)

  const defaultStart = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(9, 0, 0, 0)
    return d.toISOString().slice(0, 16)
  })()

  const [startAt, setStartAt]     = useState(defaultStart)
  const [duration, setDuration]   = useState(isBB ? 120 : 60)
  const [breakMins, setBreakMins] = useState(20)
  const [fields, setFields]       = useState(1)
  const [randomize, setRandomize] = useState(true)
  const [innings, setInnings]     = useState(sport === 'softball' ? 7 : 9)
  const [saving, setSaving]       = useState(false)
  const [progress, setProgress]   = useState(0)
  const [error, setError]         = useState('')

  const slotMinutes = duration + breakMins
  const totalSlots  = Math.ceil(pending.length / fields)
  const totalMins   = totalSlots * slotMinutes
  const endTime     = startAt ? new Date(new Date(startAt).getTime() + totalMins * 60 * 1000) : null
  const endLabel    = endTime ? endTime.toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }) : '—'

  async function handleGenerate() {
    if (!startAt) { setError('Choose a start date/time.'); return }
    setSaving(true)
    setError('')
    setProgress(0)
    try {
      let ordered = [...pending]
      if (randomize) ordered = ordered.sort(() => Math.random() - 0.5)

      const startMs = new Date(startAt).getTime()
      const slotMs  = slotMinutes * 60 * 1000
      const params  = defaultGameParams(sport)
      if (isBB) params.totalInnings = innings

      for (let i = 0; i < ordered.length; i++) {
        const match       = ordered[i]
        const slotIndex   = Math.floor(i / fields)
        const scheduledAt = new Date(startMs + slotIndex * slotMs).toISOString()
        const code        = await generateUniqueJoinCode()

        const gameId = await createGame(null, {
          homeTeam:       match.homeTeamName,
          awayTeam:       match.awayTeamName,
          sport,
          ...params,
          joinCode:       code,
          scorekeeperId:  user.uid,
          tournamentId:   tourId,
          bracketMatchId: match.matchId,
          scheduledAt,
        })
        await onGameCreated(match, gameId)
        setProgress(i + 1)
      }
      onClose()
    } catch {
      setError('Failed to generate schedule. Try again.')
    } finally {
      setSaving(false)
    }
  }

  if (pending.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center" onClick={onClose}>
        <div className="w-full max-w-sm rounded-t-3xl bg-[#1a1f2e] p-6 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
          <h3 className="mb-3 text-lg font-bold text-white">Auto-Schedule</h3>
          <p className="text-sm text-gray-400 mb-4">All matchups already have scheduled games.</p>
          <button onClick={onClose} className="btn-secondary w-full">Close</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center"
      onClick={onClose}>
      <div className="w-full max-w-sm rounded-t-3xl bg-[#1a1f2e] p-6 sm:rounded-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}>
        <div>
          <h3 className="text-lg font-bold text-white">Auto-Schedule</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            {isRR ? `All ${pending.length} unscheduled games` : `Round 1 — ${pending.length} games`}
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-gray-400">Start date &amp; time</label>
          <input type="datetime-local" value={startAt}
            onChange={(e) => setStartAt(e.target.value)} className="input" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Duration (min)</label>
            <input type="number" min={10} max={240} value={duration}
              onChange={(e) => setDuration(Number(e.target.value))} className="input" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Break (min)</label>
            <input type="number" min={0} max={120} value={breakMins}
              onChange={(e) => setBreakMins(Number(e.target.value))} className="input" />
          </div>
        </div>

        {isBB && (
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Innings</label>
            <div className="flex gap-2">
              {[5, 7, 9].map((n) => (
                <button key={n} type="button" onClick={() => setInnings(n)}
                  className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
                    innings === n ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}>
                  {n} inn.
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm text-gray-400">Concurrent fields</label>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((n) => (
              <button key={n} type="button" onClick={() => setFields(n)}
                className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
                  fields === n ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}>
                {n}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <div onClick={() => setRandomize((r) => !r)}
            className={`relative h-5 w-9 rounded-full transition ${randomize ? 'bg-blue-600' : 'bg-gray-700'}`}>
            <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${randomize ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-sm text-gray-300">Randomize order</span>
        </label>

        <div className="rounded-xl bg-gray-800/60 px-4 py-3 space-y-1 text-xs text-gray-400">
          <p><span className="text-gray-500">Games:</span> {pending.length} ({totalSlots} time slots)</p>
          <p><span className="text-gray-500">Duration:</span> ~{Math.round(totalMins / 60 * 10) / 10} hrs</p>
          <p><span className="text-gray-500">Ends ~</span>{endLabel}</p>
        </div>

        {saving && (
          <div className="rounded-xl bg-gray-800/60 px-4 py-3">
            <div className="mb-1.5 flex justify-between text-xs text-gray-400">
              <span>Creating games…</span>
              <span>{progress} / {pending.length}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-gray-700">
              <div className="h-1.5 rounded-full bg-blue-500 transition-all"
                style={{ width: `${(progress / pending.length) * 100}%` }} />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} disabled={saving} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleGenerate} disabled={saving || !startAt}
            className="btn-primary flex-1">
            {saving ? 'Creating…' : `Generate ${pending.length} Games`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Edit Matchup Modal ────────────────────────────────────────────────────────

function EditMatchupModal({ match, tournament, teams, tourId, onClose }) {
  const [homeTeamId, setHomeTeamId]   = useState(match.homeTeamId || '')
  const [awayTeamId, setAwayTeamId]   = useState(match.awayTeamId || '')
  const [scheduledAt, setScheduledAt] = useState(
    match.scheduledAt ? new Date(match.scheduledAt).toISOString().slice(0, 16) : ''
  )
  const [field, setField]   = useState(match.field || '')
  const [saving, setSaving] = useState(false)

  const isRR = tournament.format === 'round_robin'
  const isDE = tournament.format === 'double_elimination'
  const isInLosersBracket = isDE && match.bracket === 'losers'

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const homeTeam = teams.find((t) => t.id === homeTeamId)
      const awayTeam = teams.find((t) => t.id === awayTeamId)

      const matchUpdates = {
        homeTeamId:   homeTeamId   || null,
        homeTeamName: homeTeam?.name || match.homeTeamName,
        awayTeamId:   awayTeamId   || null,
        awayTeamName: awayTeam?.name || match.awayTeamName,
        scheduledAt:  scheduledAt  || null,
        field:        field.trim() || null,
      }

      // Determine which Firestore field to update
      const bracketField = isRR ? 'schedule' : isInLosersBracket ? 'losersBracket' : 'bracket'
      const bracketArr = [...(tournament[bracketField] || [])]
      const idx = bracketArr.findIndex((m) => m.matchId === match.matchId)
      if (idx !== -1) {
        bracketArr[idx] = { ...bracketArr[idx], ...matchUpdates }
        await updateTournament(tourId, { [bracketField]: bracketArr })
      }

      // If a game is linked, sync time + field + team names on the game doc
      if (match.gameId) {
        await updateGame(match.gameId, {
          scheduledAt:  scheduledAt  || null,
          field:        field.trim() || null,
          homeTeam:     matchUpdates.homeTeamName,
          awayTeam:     matchUpdates.awayTeamName,
        })
      }

      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-t-3xl bg-[#1a1f2e] p-6 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-lg font-bold text-white">Edit Matchup</h3>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs text-gray-400">Home Team</label>
              <select
                value={homeTeamId}
                onChange={(e) => setHomeTeamId(e.target.value)}
                className="input text-sm capitalize"
              >
                <option value="">TBD</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-gray-400">Away Team</label>
              <select
                value={awayTeamId}
                onChange={(e) => setAwayTeamId(e.target.value)}
                className="input text-sm capitalize"
              >
                <option value="">TBD</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Date & Time</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Field / Location</label>
            <input
              type="text"
              placeholder="e.g. Field 1, Court A, Gym 2"
              value={field}
              onChange={(e) => setField(e.target.value)}
              className="input"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Bracket Setup Modal (shown before DE bracket generation) ───────────────────

function BracketSetupModal({ tournament, onGenerate, onClose, generating }) {
  const defaultDate = tournament.startDate || new Date().toISOString().slice(0, 10)
  const [startDate,    setStartDate]    = useState(defaultDate)
  const [numFields,    setNumFields]    = useState(1)
  const [gameDuration, setGameDuration] = useState(60)
  const [firstGame,    setFirstGame]    = useState('09:00')
  const [lastGame,     setLastGame]     = useState('21:00')
  const [autoSchedule, setAutoSchedule] = useState(true)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center"
      onClick={onClose}>
      <div className="w-full max-w-sm rounded-t-3xl bg-[#1a1f2e] p-6 sm:rounded-2xl space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div>
          <h3 className="text-lg font-bold text-white">Generate Double-Elimination Bracket</h3>
          <p className="mt-1 text-xs text-gray-500">Set up scheduling options before generating.</p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-gray-400">Tournament Start Date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input" />
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <div onClick={() => setAutoSchedule((v) => !v)}
            className={`relative h-5 w-9 rounded-full transition ${autoSchedule ? 'bg-blue-600' : 'bg-gray-700'}`}>
            <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${autoSchedule ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-sm text-gray-300">Auto-schedule all games</span>
        </label>

        {autoSchedule && (
          <>
            <div>
              <label className="mb-2 block text-sm text-gray-400">Fields / Courts available</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((n) => (
                  <button key={n} type="button" onClick={() => setNumFields(n)}
                    className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
                      numFields === n ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">Game duration (minutes)</label>
              <div className="flex gap-2">
                {[60, 90, 120, 150].map((n) => (
                  <button key={n} type="button" onClick={() => setGameDuration(n)}
                    className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
                      gameDuration === n ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}>
                    {n}m
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs text-gray-400">First game start</label>
                <input type="time" value={firstGame} onChange={(e) => setFirstGame(e.target.value)} className="input" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-gray-400">Last game start</label>
                <input type="time" value={lastGame} onChange={(e) => setLastGame(e.target.value)} className="input" />
              </div>
            </div>
          </>
        )}

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} disabled={generating} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={() => onGenerate(autoSchedule ? {
              startDate,
              numFields,
              gameDurationMin: gameDuration,
              firstGameTime: firstGame,
              lastGameTime:  lastGame,
            } : null)}
            disabled={generating || !startDate}
            className="btn-primary flex-1"
          >
            {generating ? 'Generating…' : 'Generate Bracket'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Edit Team Modal ────────────────────────────────────────────────────────────

function EditTeamModal({ tourId, team, onClose }) {
  const [name, setName]               = useState(team.name || '')
  const [managerName, setManagerName] = useState(team.managerName || '')
  const [managerEmail, setEmail]      = useState(team.managerEmail || '')
  const [saving, setSaving]           = useState(false)

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await updateTeam(tourId, team.id, {
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
