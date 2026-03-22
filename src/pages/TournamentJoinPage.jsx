import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { subscribeToTournament, registerTeam, subscribeToTournamentTeams } from '../firebase/tournaments'
import { subscribeToUserClubs, getPlayers } from '../firebase/firestore'
import { SPORT_POSITIONS } from '../lib/baseballHelpers'
import { createTournamentPool } from '../firebase/chipinpool'

let _nextId = 1
function newPlayerId() { return `p${_nextId++}-${Date.now()}` }

function fromClubPlayer(p) {
  return {
    id: newPlayerId(),
    name: p.name || '',
    nickname: p.nickname || '',
    number: p.number || '',
    position: p.position || '',
    email: p.email || '',
    phone: p.phone || '',
    paid: false,
  }
}

export default function TournamentJoinPage() {
  const { tourId } = useParams()
  const { user }   = useAuth()

  const [tournament, setTournament] = useState(null)
  const [teams, setTeams]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [submitted, setSubmitted]   = useState(false)
  const [registeredTeam, setRegisteredTeam] = useState(null)
  const [saving, setSaving]         = useState(false)
  const [err, setErr]               = useState('')

  // Pool creation state
  const [poolCreating, setPoolCreating] = useState(false)
  const [poolDone, setPoolDone]         = useState(false)
  const [poolNotified, setPoolNotified] = useState(0)
  const [poolError, setPoolError]       = useState('')

  // Club import
  const [clubs, setClubs]               = useState([])
  const [selectedClubId, setSelectedClubId] = useState('')
  const [importingRoster, setImportingRoster] = useState(false)

  // Team info
  const [teamName, setTeamName]         = useState('')
  const [managerName, setManagerName]   = useState(user?.displayName || '')
  const [managerEmail, setManagerEmail] = useState(user?.email || '')

  // Roster
  const [players, setPlayers] = useState([])

  // Add-player inline form
  const [addForm, setAddForm] = useState({ name: '', nickname: '', number: '', position: '', email: '', phone: '' })

  useEffect(() => {
    const u1 = subscribeToTournament(tourId, (t) => { setTournament(t); setLoading(false) })
    const u2 = subscribeToTournamentTeams(tourId, setTeams)
    return () => { u1(); u2() }
  }, [tourId])

  useEffect(() => {
    if (!user) return
    setManagerName((n) => n || user.displayName || '')
    setManagerEmail((e) => e || user.email || '')
    const unsub = subscribeToUserClubs(user.uid, setClubs)
    return unsub
  }, [user])

  async function handleClubSelect(clubId) {
    const next = selectedClubId === clubId ? '' : clubId
    setSelectedClubId(next)
    if (!next) { setPlayers([]); setTeamName(''); return }
    setImportingRoster(true)
    try {
      const club = clubs.find((c) => c.id === next)
      if (club) setTeamName(club.name)
      const clubPlayers = await getPlayers(next)
      setPlayers(clubPlayers.map(fromClubPlayer))
    } finally {
      setImportingRoster(false)
    }
  }

  function addPlayer(e) {
    e.preventDefault()
    if (!addForm.name.trim()) return
    setPlayers((prev) => [...prev, { ...addForm, id: newPlayerId(), paid: false, name: addForm.name.trim() }])
    setAddForm({ name: '', nickname: '', number: '', position: '', email: '', phone: '' })
  }

  function removePlayer(id) { setPlayers((prev) => prev.filter((p) => p.id !== id)) }

  function updatePlayer(id, field, val) {
    setPlayers((prev) => prev.map((p) => p.id === id ? { ...p, [field]: val } : p))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!teamName.trim() || !managerName.trim() || !managerEmail.trim()) return
    setSaving(true)
    setErr('')
    const acceptedCount = teams.filter((t) => t.status === 'accepted').length
    if (tournament?.maxTeams && acceptedCount >= tournament.maxTeams) {
      setErr('This tournament is full.')
      setSaving(false)
      return
    }
    try {
      const teamId = await registerTeam(tourId, {
        name: teamName.trim(),
        managerName: managerName.trim(),
        managerEmail: managerEmail.trim(),
        managerId: user?.uid || null,
        clubId: selectedClubId || null,
        players,
      })
      setRegisteredTeam({ name: teamName.trim(), players, teamId })
      setSubmitted(true)
    } catch (e) {
      setErr(e.message || 'Registration failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleCreatePool() {
    if (!registeredTeam?.teamId) return
    setPoolCreating(true)
    setPoolError('')
    try {
      const result = await createTournamentPool({
        col:          'tournaments',
        parentId:     tourId,
        teamId:       registeredTeam.teamId,
        amount:       entryFee,
        productTitle: `${registeredTeam.name} – ${tournament.name}`,
        managerEmail: managerEmail,
      })
      setPoolNotified(result.notified)
      setPoolDone(true)
    } catch {
      setPoolError('Failed to send notifications. Please try again.')
    } finally {
      setPoolCreating(false)
    }
  }

  if (loading) return <Spinner />
  if (!tournament) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-950 text-gray-400">
        <p>Tournament not found.</p>
        <Link to="/tournaments" className="text-blue-400">Browse tournaments</Link>
      </div>
    )
  }

  const isClosed      = tournament.status === 'complete' || tournament.status === 'active'
  const acceptedCount = teams.filter((t) => t.status === 'accepted').length
  const isFull        = tournament.maxTeams && acceptedCount >= tournament.maxTeams
  const feeEnabled    = tournament.feeEnabled
  const entryFee      = tournament.entryFee || 0
  const maxPlayers    = tournament.maxPlayersPerTeam || 0
  const positions     = SPORT_POSITIONS[tournament.sport] || []
  const matchingClubs = clubs.filter((c) => c.sport === tournament.sport)

  // ── Success screen ────────────────────────────────────────────────────────
  if (submitted && registeredTeam) {
    const perPlayer = feeEnabled && entryFee && registeredTeam.players.length > 0
      ? (entryFee / registeredTeam.players.length).toFixed(2) : null
    const notifiable = registeredTeam.players.filter((p) => p.email || p.phone).length
    const shareText = [
      `You've been registered for ${tournament.name}!`,
      feeEnabled && entryFee ? `Entry fee: $${entryFee}${perPlayer ? ` ($${perPlayer}/player)` : ''}.` : null,
      `View the tournament: ${window.location.origin}/tournament/${tourId}`,
    ].filter(Boolean).join(' ')

    return (
      <div className="min-h-screen bg-gray-950 pb-24">
        <div className="flex flex-col items-center gap-6 px-6 pt-16 text-center">
          <div className="text-6xl">🎉</div>
          <div>
            <h2 className="text-xl font-bold text-white">Registration Submitted!</h2>
            <p className="mt-2 text-gray-400">
              <span className="font-semibold text-white">"{registeredTeam.name}"</span> has been submitted for{' '}
              <span className="font-semibold text-white">{tournament.name}</span>.
            </p>
            <p className="mt-2 text-sm text-gray-500">The host will review and accept your registration.</p>
          </div>

          {feeEnabled && entryFee > 0 && (
            <div className="w-full max-w-xs space-y-3">
              {/* Fee summary */}
              <div className="rounded-2xl border border-blue-800 bg-blue-900/20 p-5 text-left">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-400">Entry Fee</p>
                <p className="mt-1 text-2xl font-extrabold text-white">${entryFee}</p>
                {perPlayer && (
                  <p className="mt-1 text-sm text-blue-300">
                    ${perPlayer} per player · {registeredTeam.players.length} players
                  </p>
                )}
              </div>

              {/* Pool creation */}
              <div className="rounded-2xl bg-gray-900 p-4 text-left">
                {!poolDone ? (
                  <>
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Collect Entry Fee via ChipIn</p>
                    <p className="text-xs text-gray-500 mb-3">
                      {notifiable > 0
                        ? `Send each player a personal payment link by email & text. Each player pays $${perPlayer || entryFee}.`
                        : 'Add player emails or phone numbers to their roster entries, then send payment links automatically.'}
                    </p>
                    {poolError && <p className="mb-2 text-xs text-red-400">{poolError}</p>}
                    <button
                      onClick={handleCreatePool}
                      disabled={poolCreating || notifiable === 0}
                      className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40"
                    >
                      {poolCreating
                        ? 'Sending notifications…'
                        : notifiable > 0
                          ? `Notify ${notifiable} Player${notifiable !== 1 ? 's' : ''} · $${perPlayer} each`
                          : 'No player contact info added'}
                    </button>
                  </>
                ) : (
                  <div className="text-center">
                    <p className="text-3xl mb-2">✅</p>
                    <p className="text-sm font-semibold text-white">Payment links sent!</p>
                    <p className="mt-1 text-xs text-gray-400">
                      {poolNotified} player{poolNotified !== 1 ? 's' : ''} notified by email &amp; text
                      with their personal ChipIn payment link.
                    </p>
                    <p className="mt-2 text-xs text-gray-600">
                      Players are marked paid automatically once they complete checkout.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Invite message for players */}
          <div className="w-full max-w-xs text-left">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">Share with your players</p>
            <div className="rounded-2xl bg-gray-900 p-4">
              <p className="mb-3 text-xs text-gray-400">{shareText}</p>
              <button
                onClick={() => navigator.clipboard.writeText(shareText)}
                className="w-full rounded-xl bg-gray-700 py-2 text-xs font-semibold text-white hover:bg-gray-600"
              >
                Copy Invite Message
              </button>
            </div>
          </div>

          {registeredTeam.players.length > 0 && (
            <div className="w-full max-w-xs rounded-2xl bg-gray-900 p-4 text-left">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">
                Roster · {registeredTeam.players.length} players
              </p>
              <div className="space-y-2.5">
                {registeredTeam.players.map((p) => (
                  <div key={p.id} className="flex items-start gap-2.5 text-sm">
                    <span className="mt-0.5 w-6 shrink-0 text-center font-mono text-xs text-gray-500">{p.number || '—'}</span>
                    <div className="min-w-0">
                      <p className="text-gray-200">
                        {p.name}
                        {p.nickname && <span className="ml-1.5 text-xs text-gray-500">"{p.nickname}"</span>}
                      </p>
                      {(p.position || p.email || p.phone) && (
                        <p className="text-xs text-gray-600">
                          {[p.position, p.email, p.phone].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Link to={`/tournament/${tourId}`} className="btn-primary px-10">View Tournament →</Link>
        </div>
      </div>
    )
  }

  // ── Registration form ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      <header className="px-5 py-5">
        <Link to={`/tournament/${tourId}`} className="text-sm text-gray-400 hover:text-white">
          ← {tournament.name}
        </Link>
        <h1 className="mt-2 text-xl font-bold text-white">Register Your Team</h1>
      </header>

      <div className="mx-auto max-w-lg space-y-5 px-5">

        {/* Tournament info card */}
        <div className="card space-y-1 p-4">
          <p className="font-semibold text-white">{tournament.name}</p>
          <p className="text-xs capitalize text-gray-400">
            {tournament.sport} · {tournament.format?.replace('_', ' ')}
          </p>
          {tournament.location && <p className="text-xs text-gray-500">{tournament.location}</p>}
          {tournament.startDate && <p className="text-xs text-gray-500">Starts {tournament.startDate}</p>}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-gray-500">{acceptedCount} / {tournament.maxTeams} teams</span>
            {isFull && <span className="rounded bg-red-900/60 px-2 py-0.5 text-[10px] font-bold text-red-300">FULL</span>}
          </div>
        </div>

        {/* Fee card */}
        {feeEnabled && entryFee > 0 && (
          <div className="card border border-blue-800/50 space-y-1 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-400">Entry Fee Required</p>
            <p className="text-2xl font-extrabold text-white">
              ${entryFee} <span className="text-sm font-normal text-gray-400">per team</span>
            </p>
            {maxPlayers > 0 && (
              <p className="text-sm text-blue-300">
                ${(entryFee / maxPlayers).toFixed(2)} per player (up to {maxPlayers} players)
              </p>
            )}
            <p className="pt-1 text-xs text-gray-500">
              Collected via ChipInPool after host approval — players each chip in their share.
            </p>
          </div>
        )}

        {isClosed ? (
          <div className="rounded-2xl border border-yellow-800 bg-yellow-900/30 px-5 py-6 text-center">
            <p className="font-semibold text-yellow-300">Registration Closed</p>
            <p className="mt-1 text-sm text-gray-400">This tournament is no longer accepting new teams.</p>
            <Link to={`/tournament/${tourId}`} className="mt-4 inline-block text-sm text-blue-400">View bracket →</Link>
          </div>
        ) : isFull ? (
          <div className="rounded-2xl border border-red-800 bg-red-900/30 px-5 py-6 text-center">
            <p className="font-semibold text-red-300">Tournament is Full</p>
            <p className="mt-1 text-sm text-gray-400">All {tournament.maxTeams} spots have been filled.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* ── Club import (logged-in users with matching clubs) ── */}
            {user && matchingClubs.length > 0 && (
              <div className="card space-y-2 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Import from your club</p>
                <p className="text-xs text-gray-600">Select a club to pre-fill your team name and roster.</p>
                <div className="flex flex-wrap gap-2">
                  {matchingClubs.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleClubSelect(c.id)}
                      className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                        selectedClubId === c.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
                {importingRoster && <p className="text-xs text-gray-500">Loading roster…</p>}
                {selectedClubId && !importingRoster && players.length > 0 && (
                  <p className="text-xs text-green-400">
                    ✓ {players.length} players imported — edit freely before submitting
                  </p>
                )}
              </div>
            )}

            {/* ── Team info ── */}
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Team Info</p>
              <input value={teamName} onChange={(e) => setTeamName(e.target.value)}
                placeholder="Team Name *" required className="input" />
              <input value={managerName} onChange={(e) => setManagerName(e.target.value)}
                placeholder="Manager / Coach Name *" required className="input" />
              <input type="email" value={managerEmail} onChange={(e) => setManagerEmail(e.target.value)}
                placeholder="Contact Email *" required className="input" />
            </div>

            {/* ── Roster ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Roster <span className="normal-case font-normal text-gray-600">
                    {players.length}{maxPlayers > 0 ? ` / ${maxPlayers}` : ''} players
                  </span>
                </p>
                {feeEnabled && entryFee > 0 && players.length > 0 && (
                  <span className="text-xs font-semibold text-blue-400">
                    ${(entryFee / players.length).toFixed(2)} / player
                  </span>
                )}
              </div>

              {players.length > 0 && (
                <div className="divide-y divide-gray-800 overflow-hidden rounded-2xl bg-gray-900">
                  {players.map((p) => (
                    <PlayerRow
                      key={p.id}
                      player={p}
                      positions={positions}
                      onUpdate={updatePlayer}
                      onRemove={removePlayer}
                    />
                  ))}
                </div>
              )}

              {(!maxPlayers || players.length < maxPlayers) && (
                <div className="rounded-2xl bg-gray-900 p-4 space-y-2">
                  <p className="text-xs font-semibold text-gray-500">Add Player</p>
                  <div className="flex gap-2">
                    <input value={addForm.number}
                      onChange={(e) => setAddForm((f) => ({ ...f, number: e.target.value }))}
                      placeholder="#" className="input w-14 text-center" maxLength={3} />
                    <input value={addForm.name}
                      onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Full name *" className="input flex-1" />
                  </div>
                  <input value={addForm.nickname}
                    onChange={(e) => setAddForm((f) => ({ ...f, nickname: e.target.value }))}
                    placeholder='Nickname' className="input" />
                  <div className="flex gap-2">
                    <select value={addForm.position}
                      onChange={(e) => setAddForm((f) => ({ ...f, position: e.target.value }))}
                      className="input flex-1">
                      <option value="">Position</option>
                      {positions.map((pos) => <option key={pos} value={pos}>{pos}</option>)}
                    </select>
                    <button type="button" onClick={addPlayer} disabled={!addForm.name.trim()}
                      className="rounded-xl bg-blue-700 px-4 text-sm font-bold text-white hover:bg-blue-600 disabled:opacity-40">
                      + Add
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input type="email" value={addForm.email}
                      onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="Email" className="input flex-1" />
                    <input value={addForm.phone}
                      onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="Phone" className="input flex-1" />
                  </div>
                </div>
              )}
            </div>

            {err && <p className="rounded-xl bg-red-900/40 px-4 py-2 text-sm text-red-300">{err}</p>}

            <div>
              <button
                type="submit"
                disabled={saving || !teamName.trim() || !managerName.trim() || !managerEmail.trim()}
                className="btn-primary w-full py-4 text-base"
              >
                {saving ? 'Submitting…' : 'Register Team'}
              </button>
              <p className="mt-2 text-center text-xs text-gray-600">
                The host will review your registration before accepting.
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// Inline-editable player row
function PlayerRow({ player, positions, onUpdate, onRemove }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="px-4 py-2.5">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-800 text-xs font-bold text-gray-300">
          {player.number || '?'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">
            {player.name}
            {player.nickname && <span className="ml-1.5 text-xs text-gray-500">"{player.nickname}"</span>}
          </p>
          {(player.position || player.email || player.phone) && (
            <p className="truncate text-[10px] text-gray-500">
              {[player.position, player.email, player.phone].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <button type="button" onClick={() => setExpanded((v) => !v)}
          className="shrink-0 text-xs text-gray-500 hover:text-blue-400">
          {expanded ? 'Done' : 'Edit'}
        </button>
        <button type="button" onClick={() => onRemove(player.id)}
          className="shrink-0 text-xs text-gray-600 hover:text-red-400">✕</button>
      </div>
      {expanded && (
        <div className="mt-2 space-y-1.5 pl-11">
          <div className="flex gap-1.5">
            <input value={player.number} onChange={(e) => onUpdate(player.id, 'number', e.target.value)}
              placeholder="#" className="input w-14 py-1 text-center text-sm" maxLength={3} />
            <input value={player.name} onChange={(e) => onUpdate(player.id, 'name', e.target.value)}
              placeholder="Full name" className="input flex-1 py-1 text-sm" />
          </div>
          <input value={player.nickname} onChange={(e) => onUpdate(player.id, 'nickname', e.target.value)}
            placeholder="Nickname" className="input w-full py-1 text-sm" />
          <select value={player.position} onChange={(e) => onUpdate(player.id, 'position', e.target.value)}
            className="input w-full py-1 text-sm">
            <option value="">Position</option>
            {positions.map((pos) => <option key={pos} value={pos}>{pos}</option>)}
          </select>
          <input type="email" value={player.email} onChange={(e) => onUpdate(player.id, 'email', e.target.value)}
            placeholder="Email" className="input w-full py-1 text-sm" />
          <input value={player.phone} onChange={(e) => onUpdate(player.id, 'phone', e.target.value)}
            placeholder="Phone" className="input w-full py-1 text-sm" />
        </div>
      )}
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-950">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
    </div>
  )
}
