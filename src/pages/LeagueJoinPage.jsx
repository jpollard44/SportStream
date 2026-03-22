import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getLeague, registerLeagueTeam } from '../firebase/leagues'
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
  }
}

export default function LeagueJoinPage() {
  const { leagueId } = useParams()
  const { user } = useAuth()

  const [league, setLeague]           = useState(null)
  const [clubs, setClubs]             = useState([])
  const [selectedClubId, setSelected] = useState('')
  const [importingRoster, setImport]  = useState(false)
  const [teamName, setTeamName]       = useState('')
  const [mgName, setMgName]           = useState(user?.displayName || '')
  const [mgEmail, setMgEmail]         = useState(user?.email || '')
  const [players, setPlayers]         = useState([])
  const [addForm, setAddForm]         = useState({ name: '', nickname: '', number: '', position: '', email: '', phone: '' })
  const [submitting, setSubmitting]   = useState(false)
  const [done, setDone]               = useState(false)
  const [registeredTeam, setRegisteredTeam] = useState(null)
  const [error, setError]             = useState('')

  // Pool creation state
  const [poolCreating, setPoolCreating] = useState(false)
  const [poolDone, setPoolDone]         = useState(false)
  const [poolNotified, setPoolNotified] = useState(0)
  const [poolError, setPoolError]       = useState('')

  useEffect(() => {
    getLeague(leagueId).then(setLeague)
  }, [leagueId])

  useEffect(() => {
    if (!user) return
    setMgName((n) => n || user.displayName || '')
    setMgEmail((e) => e || user.email || '')
    return subscribeToUserClubs(user.uid, setClubs)
  }, [user])

  async function handleClubSelect(clubId) {
    const next = selectedClubId === clubId ? '' : clubId
    setSelected(next)
    if (!next) { setPlayers([]); setTeamName(''); return }
    setImport(true)
    try {
      const club = clubs.find((c) => c.id === next)
      if (club) setTeamName(club.name)
      const clubPlayers = await getPlayers(next)
      setPlayers(clubPlayers.map(fromClubPlayer))
    } finally {
      setImport(false)
    }
  }

  function addPlayer(e) {
    e.preventDefault()
    if (!addForm.name.trim()) return
    setPlayers((prev) => [...prev, { ...addForm, id: newPlayerId(), name: addForm.name.trim() }])
    setAddForm({ name: '', nickname: '', number: '', position: '', email: '', phone: '' })
  }

  function removePlayer(id) { setPlayers((prev) => prev.filter((p) => p.id !== id)) }

  function updatePlayer(id, field, val) {
    setPlayers((prev) => prev.map((p) => p.id === id ? { ...p, [field]: val } : p))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const teamId = await registerLeagueTeam(leagueId, {
        name:         teamName.trim(),
        managerName:  mgName.trim(),
        managerEmail: mgEmail.trim(),
        managerId:    user?.uid || null,
        clubId:       selectedClubId || null,
        players,
      })
      setRegisteredTeam({ name: teamName.trim(), players, teamId })
      setDone(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCreatePool() {
    if (!registeredTeam?.teamId) return
    setPoolCreating(true)
    setPoolError('')
    try {
      const result = await createTournamentPool({
        col:          'leagues',
        parentId:     leagueId,
        teamId:       registeredTeam.teamId,
        amount:       league.entryFee,
        productTitle: `${registeredTeam.name} – ${league.name}`,
        managerEmail: mgEmail,
      })
      setPoolNotified(result.notified)
      setPoolDone(true)
    } catch {
      setPoolError('Failed to send notifications. Please try again.')
    } finally {
      setPoolCreating(false)
    }
  }

  if (!league) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  const positions     = SPORT_POSITIONS[league.sport] || []
  const matchingClubs = clubs.filter((c) => c.sport === league.sport)
  const feeEnabled    = league.feeEnabled
  const entryFee      = league.entryFee || 0

  if (done && registeredTeam) {
    const perPlayer = feeEnabled && entryFee && registeredTeam.players.length > 0
      ? (entryFee / registeredTeam.players.length).toFixed(2) : null
    const notifiable = registeredTeam.players.filter((p) => p.email || p.phone).length
    const shareText  = `You've been registered for ${league.name}! View the league: ${window.location.origin}/league/${leagueId}`
    return (
      <div className="min-h-screen bg-gray-950 pb-24">
        <div className="flex flex-col items-center gap-6 px-6 pt-16 text-center">
          <div className="text-6xl">✅</div>
          <div>
            <h2 className="text-xl font-bold text-white">Registration Submitted!</h2>
            <p className="mt-2 text-sm text-gray-400">
              The league host will review and accept your team.
            </p>
          </div>

          {feeEnabled && entryFee > 0 && (
            <div className="w-full max-w-xs space-y-3">
              <div className="rounded-2xl border border-blue-800 bg-blue-900/20 p-5 text-left">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-400">Entry Fee</p>
                <p className="mt-1 text-2xl font-extrabold text-white">${entryFee}</p>
                {perPlayer && (
                  <p className="mt-1 text-sm text-blue-300">
                    ${perPlayer} per player · {registeredTeam.players.length} players
                  </p>
                )}
              </div>

              <div className="rounded-2xl bg-gray-900 p-4 text-left">
                {!poolDone ? (
                  <>
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Collect Entry Fee via ChipIn</p>
                    <p className="text-xs text-gray-500 mb-3">
                      {notifiable > 0
                        ? `Send each player a ChipIn payment link by email & text. Each player pays $${perPlayer || entryFee}.`
                        : 'Add player emails or phone numbers in the roster, then send payment links automatically.'}
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

          <div className="w-full max-w-xs text-left">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">Share with your players</p>
            <div className="rounded-2xl bg-gray-900 p-4">
              <p className="mb-3 text-xs text-gray-400">{shareText}</p>
              <button onClick={() => navigator.clipboard.writeText(shareText)}
                className="w-full rounded-xl bg-gray-700 py-2 text-xs font-semibold text-white hover:bg-gray-600">
                Copy Invite Message
              </button>
            </div>
          </div>

          {registeredTeam.players.length > 0 && (
            <div className="w-full max-w-xs rounded-2xl bg-gray-900 p-4 text-left">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                Roster · {registeredTeam.players.length} players
              </p>
              <div className="space-y-2">
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

          <Link to={`/league/${leagueId}`} className="btn-primary w-auto px-8">View League →</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      <header className="flex items-center gap-4 border-b border-gray-800 px-5 py-5">
        <Link to={`/league/${leagueId}`} className="text-gray-400 hover:text-white">← Back</Link>
        <div>
          <h1 className="text-lg font-bold text-white">Register Team</h1>
          <p className="text-sm text-gray-500">{league.name}</p>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-5 pt-6">
        {feeEnabled && entryFee > 0 && (
          <div className="mb-5 card border border-blue-800/50 space-y-1 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-400">Entry Fee Required</p>
            <p className="text-2xl font-extrabold text-white">
              ${entryFee} <span className="text-sm font-normal text-gray-400">per team</span>
            </p>
            <p className="text-xs text-gray-500 pt-1">
              Collected via ChipInPool — players each chip in their share.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">

          {/* Club import */}
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
                <p className="text-xs text-green-400">✓ {players.length} players imported — edit freely</p>
              )}
            </div>
          )}

          {/* Team info */}
          <div className="card space-y-3 p-4">
            <h2 className="font-semibold text-white">Team</h2>
            <input value={teamName} onChange={(e) => setTeamName(e.target.value)}
              required placeholder="Team name *" className="input" />
            <input value={mgName} onChange={(e) => setMgName(e.target.value)}
              required placeholder="Manager / Coach name *" className="input" />
            <input type="email" value={mgEmail} onChange={(e) => setMgEmail(e.target.value)}
              required placeholder="Contact email *" className="input" />
          </div>

          {/* Roster */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Roster <span className="normal-case font-normal text-gray-600">{players.length} players</span>
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
                  <PlayerRow key={p.id} player={p} positions={positions}
                    onUpdate={updatePlayer} onRemove={removePlayer} />
                ))}
              </div>
            )}

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
                placeholder="Nickname" className="input" />
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
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button type="submit"
            disabled={submitting || !teamName.trim() || !mgName.trim() || !mgEmail.trim()}
            className="btn-primary">
            {submitting ? 'Submitting…' : 'Register Team'}
          </button>
        </form>
      </main>
    </div>
  )
}

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
