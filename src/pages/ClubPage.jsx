import { useState, useRef, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useClub } from '../hooks/useClub'
import {
  addPlayer, updatePlayer, deletePlayer, updateClub,
  subscribeToClubGames, subscribeToClubSchedule,
  createScheduledGame, updateGame, deleteGame, markGameFinal, createInvite,
  getClubFanCount, getClubContextOpponents, searchClubs, getPlayers,
  getHeadToHead, getRecentResults, getClubRecord,
} from '../firebase/firestore'
import { uploadClubLogo, uploadPlayerPhoto } from '../firebase/storage'
import { formatDate } from '../lib/formatters'
import { SPORT_POSITIONS } from '../lib/baseballHelpers'
import { useLiveGamePlayers } from '../hooks/useLiveGamePlayers'
import { LiveDot, ScorekeeperLinkChip } from '../components/ui'

const GAME_TYPES = ['regular', 'playoff', 'scrimmage']

export default function ClubPage() {
  const { clubId } = useParams()
  const { club, players, loading } = useClub(clubId)
  const { livePlayerIds, liveGameId } = useLiveGamePlayers(clubId)
  const [games, setGames] = useState([])
  const [schedule, setSchedule] = useState([])

  // Add game schedule state
  const [showAddSchedule, setShowAddSchedule] = useState(false)
  const [editingScheduleGame, setEditingScheduleGame] = useState(null)

  // Add player form state
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [name, setName]         = useState('')
  const [nickname, setNickname] = useState('')
  const [number, setNumber]     = useState('')
  const [position, setPosition] = useState('')
  const [email, setEmail]       = useState('')
  const [phone, setPhone]       = useState('')
  const [saving, setSaving]     = useState(false)

  // Edit player state
  const [editingPlayer, setEditingPlayer] = useState(null)

  // Game actions
  const [confirmDeleteGame, setConfirmDeleteGame] = useState(null)
  const [deletingGame, setDeletingGame] = useState(false)
  const [copiedGameId, setCopiedGameId] = useState(null)

  function copyScoreKeeperLink(gameId) {
    const url = `${window.location.origin}/scorekeeper/${gameId}`
    navigator.clipboard.writeText(url).catch(() => {})
    setCopiedGameId(gameId)
    setTimeout(() => setCopiedGameId(null), 2000)
  }

  // Invite link
  const [inviteLink, setInviteLink] = useState(null)
  const [inviteCopied, setInviteCopied] = useState(false)

  // CSV import
  const [showCsvImport, setShowCsvImport] = useState(false)
  const [csvRows, setCsvRows] = useState([])    // parsed preview rows
  const [csvImporting, setCsvImporting] = useState(false)
  const csvInputRef = useRef(null)

  function handleCsvFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target.result
      const lines = text.split(/\r?\n/).filter((l) => l.trim())
      if (lines.length < 2) return
      // Detect header row
      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
      const nameIdx     = headers.findIndex((h) => h.includes('name') && !h.includes('nick'))
      const nickIdx     = headers.findIndex((h) => h.includes('nick'))
      const numberIdx   = headers.findIndex((h) => h.includes('num') || h === '#')
      const positionIdx = headers.findIndex((h) => h.includes('pos'))
      const rows = lines.slice(1).map((line) => {
        const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
        return {
          name:     nameIdx >= 0     ? cols[nameIdx]     : '',
          nickname: nickIdx >= 0     ? cols[nickIdx]     : '',
          number:   numberIdx >= 0   ? cols[numberIdx]   : '',
          position: positionIdx >= 0 ? cols[positionIdx] : '',
        }
      }).filter((r) => r.name)
      setCsvRows(rows)
      setShowCsvImport(true)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  async function handleCsvImport() {
    setCsvImporting(true)
    try {
      for (const row of csvRows) {
        await addPlayer(clubId, { name: row.name, nickname: row.nickname, number: row.number, position: row.position, email: '', phone: '' })
      }
      setShowCsvImport(false)
      setCsvRows([])
    } finally {
      setCsvImporting(false)
    }
  }

  // Photo upload
  const [logoUploading, setLogoUploading] = useState(false)
  const [playerPhotoUploading, setPlayerPhotoUploading] = useState(null) // playerId
  const [uploadError, setUploadError] = useState('')
  const logoInputRef = useRef(null)
  const playerPhotoInputRef = useRef(null)
  const [pendingPhotoPlayerId, setPendingPhotoPlayerId] = useState(null)

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError('')
    setLogoUploading(true)
    try {
      const url = await uploadClubLogo(clubId, file)
      await updateClub(clubId, { logoUrl: url })
    } catch (err) {
      setUploadError('Logo upload failed: ' + (err?.message || 'unknown error'))
    } finally {
      setLogoUploading(false)
      e.target.value = ''
    }
  }

  async function handlePlayerPhotoUpload(e) {
    const file = e.target.files?.[0]
    if (!file || !pendingPhotoPlayerId) return
    setUploadError('')
    setPlayerPhotoUploading(pendingPhotoPlayerId)
    try {
      const url = await uploadPlayerPhoto(clubId, pendingPhotoPlayerId, file)
      await updatePlayer(clubId, pendingPhotoPlayerId, { photoUrl: url })
    } catch (err) {
      setUploadError('Photo upload failed: ' + (err?.message || 'unknown error'))
    } finally {
      setPlayerPhotoUploading(null)
      setPendingPhotoPlayerId(null)
      e.target.value = ''
    }
  }

  function openPlayerPhotoInput(playerId) {
    setPendingPhotoPlayerId(playerId)
    playerPhotoInputRef.current?.click()
  }

  useEffect(() => {
    if (!clubId) return
    const unsub = subscribeToClubGames(clubId, setGames)
    return unsub
  }, [clubId])

  useEffect(() => {
    if (!clubId) return
    const unsub = subscribeToClubSchedule(clubId, setSchedule)
    return unsub
  }, [clubId])

  const [fanCount, setFanCount] = useState(null)
  const [showAnalytics, setShowAnalytics] = useState(false)

  useEffect(() => {
    if (!showAnalytics || !clubId) return
    getClubFanCount(clubId).then(setFanCount).catch(() => {})
  }, [showAnalytics, clubId])

  function resetAddForm() {
    setName(''); setNickname(''); setNumber(''); setPosition(''); setEmail(''); setPhone('')
  }

  async function handleAddPlayer(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const playerId = await addPlayer(clubId, { name: name.trim(), nickname: nickname.trim(), number, position, email: email.trim(), phone: phone.trim() })
      if (email.trim()) {
        const token = await createInvite(clubId, playerId, name.trim(), email.trim())
        setInviteLink(`${window.location.origin}/invite/${token}`)
      }
      resetAddForm()
      setShowAddPlayer(false)
    } finally { setSaving(false) }
  }

  async function handleSaveEdit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await updatePlayer(clubId, editingPlayer.id, {
        name: editingPlayer.name.trim(),
        nickname: editingPlayer.nickname || '',
        number: editingPlayer.number,
        position: editingPlayer.position,
        email: editingPlayer.email || '',
        phone: editingPlayer.phone || '',
        status: editingPlayer.status || 'active',
      })
      setEditingPlayer(null)
    } finally { setSaving(false) }
  }

  function startEdit(p) {
    setEditingPlayer({
      id: p.id, name: p.name, nickname: p.nickname || '',
      number: p.number || '', position: p.position || '',
      email: p.email || '', phone: p.phone || '',
      status: p.status || 'active',
    })
  }

  async function handleDeleteGame(gameId) {
    setDeletingGame(true)
    try {
      await deleteGame(gameId)
      setConfirmDeleteGame(null)
    } catch (err) {
      console.error('deleteGame failed:', err)
      setUploadError('Failed to delete game: ' + (err?.message || 'unknown error'))
      setConfirmDeleteGame(null)
    } finally {
      setDeletingGame(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  const positions = SPORT_POSITIONS[club?.sport] || []

  return (
    <div className="min-h-screen bg-[#0f1117] pb-24">
      {/* Hidden file inputs */}
      <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
      <input ref={playerPhotoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePlayerPhotoUpload} />
      <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvFile} />

      {uploadError && (
        <div className="mx-5 mt-3 flex items-center justify-between gap-2 rounded-xl bg-red-900/40 px-4 py-2.5 text-sm text-red-300">
          <span>{uploadError}</span>
          <button onClick={() => setUploadError('')} className="shrink-0 text-red-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-white/5 px-5 py-5">
        <div className="flex items-center gap-2 mb-4">
          <Link to="/dashboard" className="text-sm text-gray-400 hover:text-white">← Dashboard</Link>
          <span className="text-gray-700">/</span>
          <span className="text-sm text-gray-300">{club?.name}</span>
        </div>
        <div className="flex items-center gap-4">
          {/* Logo upload */}
          <button
            onClick={() => logoInputRef.current?.click()}
            disabled={logoUploading}
            title="Click to upload team logo"
            className="group relative shrink-0"
          >
            {club?.logoUrl ? (
              <img src={club.logoUrl} alt="logo" className="h-14 w-14 rounded-2xl object-cover ring-2 ring-gray-700 group-hover:ring-blue-500 transition" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-800 text-2xl ring-2 ring-gray-700 group-hover:ring-blue-500 transition">
                {logoUploading ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" /> : '📷'}
              </div>
            )}
            {!logoUploading && (
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white shadow">✏</span>
            )}
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="flex items-center gap-2 text-xl font-extrabold text-white leading-tight">
              {club?.name}
              {liveGameId && <LiveDot title="Team is live right now!" />}
            </h1>
            <p className="text-sm capitalize text-gray-400">{club?.sport}</p>
          </div>
          <Link
            to={`/team/${clubId}`}
            className="shrink-0 rounded-xl bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-400 hover:bg-gray-700 hover:text-white transition"
          >
            Public page →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-5 space-y-8 pt-6">

        {/* ── Schedule ── */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-label">Schedule ({schedule.length})</h2>
            <button
              onClick={() => setShowAddSchedule(true)}
              className="rounded-full bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500 transition"
            >
              + Add Game
            </button>
          </div>
          {schedule.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/5 py-10 text-center">
              <span className="text-3xl">📅</span>
              <p className="text-sm text-gray-400">No scheduled games yet.</p>
              <button onClick={() => setShowAddSchedule(true)}
                className="rounded-full bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-600 transition">
                Schedule a game →
              </button>
            </div>
          ) : (
            <ScheduleList
              schedule={schedule}
              clubId={clubId}
              onEdit={(g) => setEditingScheduleGame(g)}
              onDelete={async (id) => {
                if (confirm('Remove this scheduled game?')) await deleteGame(id)
              }}
            />
          )}
        </section>

        {/* ── Games ── */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-label">Games ({games.length})</h2>
            <Link
              to={`/club/${clubId}/game/new`}
              className="rounded-full bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-500 transition"
            >
              + New Game
            </Link>
          </div>

          {games.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/5 py-12 text-center">
              <span className="text-3xl">🎮</span>
              <p className="text-sm text-gray-400">No games yet.</p>
              <Link to={`/club/${clubId}/game/new`}
                className="rounded-full bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600 transition">
                Start first game →
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {[...games].sort((a, b) => {
                const aLive = a.status === 'live' ? 0 : 1
                const bLive = b.status === 'live' ? 0 : 1
                return aLive - bLive
              }).map((game) => {
                const isLive = game.status === 'live'
                return (
                  <div key={game.id} className={`flex items-start justify-between gap-3 p-4 rounded-2xl ring-1 ${
                    isLive
                      ? 'bg-[#1a1f2e] ring-green-800/50 border-l-2 border-green-500'
                      : 'bg-[#1a1f2e] ring-white/5'
                  }`}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-white">
                        {isLive && <LiveDot title="Live now" />}{' '}
                        {game.homeTeam} <span className="text-gray-500">vs</span> {game.awayTeam}
                      </p>
                      <p className="text-sm text-gray-400">{formatDate(game.createdAt)}</p>
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        <StatusBadge status={game.status} />
                        {isLive && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-900/60 px-2 py-0.5 text-[10px] font-bold text-green-300 ring-1 ring-green-800/40">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                            LIVE
                          </span>
                        )}
                        <span className="text-xs font-bold text-white">{game.homeScore}–{game.awayScore}</span>
                      </div>
                      {game.joinCode && (
                        <ScorekeeperLinkChip
                          gameId={game.id}
                          joinCode={game.joinCode}
                          copied={copiedGameId === game.id}
                          onCopy={() => copyScoreKeeperLink(game.id)}
                          className="mt-2"
                        />
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      {(game.status === 'live' || game.status === 'setup') && (
                        <Link to={`/scorekeeper/${game.id}`}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500">
                          Open Scorer
                        </Link>
                      )}
                      <Link to={`/game/${game.id}`} className="text-xs text-gray-500 hover:text-white">View →</Link>
                      {game.status !== 'final' && (
                        <button onClick={() => markGameFinal(game.id)} className="text-xs text-orange-400 hover:text-orange-300">
                          Mark Final
                        </button>
                      )}
                      <button onClick={() => setConfirmDeleteGame(game.id)} className="text-xs text-red-700 hover:text-red-400">
                        Delete
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Roster ── */}
        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="section-label">Roster ({players.length})</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => csvInputRef.current?.click()}
                className="rounded-full bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-400 hover:bg-gray-700 hover:text-white transition"
                title="Import players from CSV"
              >
                ↑ CSV
              </button>
              <button
                onClick={() => setShowAddPlayer(true)}
                className="rounded-full bg-gray-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-600 transition"
              >
                + Add Player
              </button>
            </div>
          </div>

          {/* Onboarding banner — shown when team is brand new */}
          {players.length === 0 && games.length === 0 && (
            <div className="mb-4 rounded-2xl border border-blue-800/40 bg-blue-950/30 p-4">
              <p className="mb-2 text-sm font-bold text-blue-300">Getting Started</p>
              <ol className="space-y-1.5 text-sm text-blue-200/80">
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-600 text-[10px] font-bold text-white">✓</span>
                  Created your team
                </li>
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-700 text-[10px] font-bold text-gray-400">2</span>
                  <button onClick={() => setShowAddPlayer(true)} className="underline underline-offset-2 hover:text-white">Add your first players</button>
                  <span className="text-[10px] text-blue-400">(or ↑ CSV import)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-700 text-[10px] font-bold text-gray-400">3</span>
                  <Link to={`/club/${clubId}/game/new`} className="underline underline-offset-2 hover:text-white">Create your first game</Link>
                </li>
              </ol>
            </div>
          )}

          {players.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/5 py-12 text-center">
              <span className="text-3xl">👥</span>
              <p className="text-sm text-gray-400">No players yet.</p>
              <p className="text-xs text-gray-600 max-w-[200px]">Add your roster to track stats and use for tournament sign-ups.</p>
              <button onClick={() => setShowAddPlayer(true)}
                className="rounded-full bg-gray-700 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-600 transition">
                Add first player →
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {players.map((p) =>
                editingPlayer?.id === p.id ? (
                  <form key={p.id} onSubmit={handleSaveEdit}
                    className="rounded-xl bg-gray-800 px-4 py-3 space-y-2">
                    <input
                      value={editingPlayer.name}
                      onChange={(e) => setEditingPlayer((ep) => ({ ...ep, name: e.target.value }))}
                      className="input w-full text-sm py-1.5" placeholder="Full name *" required autoFocus
                    />
                    <input
                      value={editingPlayer.nickname}
                      onChange={(e) => setEditingPlayer((ep) => ({ ...ep, nickname: e.target.value }))}
                      className="input w-full text-sm py-1.5" placeholder='Nickname (e.g. "Ace")'
                    />
                    <div className="flex gap-2">
                      <input
                        value={editingPlayer.number}
                        onChange={(e) => setEditingPlayer((ep) => ({ ...ep, number: e.target.value }))}
                        className="input w-14 text-sm py-1.5 text-center" placeholder="#" maxLength={3}
                      />
                      <select
                        value={editingPlayer.position}
                        onChange={(e) => setEditingPlayer((ep) => ({ ...ep, position: e.target.value }))}
                        className="input flex-1 text-sm py-1.5"
                      >
                        <option value="">Position</option>
                        {positions.map((pos) => <option key={pos} value={pos}>{pos}</option>)}
                      </select>
                      <select
                        value={editingPlayer.status || 'active'}
                        onChange={(e) => setEditingPlayer((ep) => ({ ...ep, status: e.target.value }))}
                        className="input flex-1 text-sm py-1.5"
                      >
                        <option value="active">Active</option>
                        <option value="injured">Injured</option>
                        <option value="suspended">Suspended</option>
                      </select>
                    </div>
                    <input
                      type="email"
                      value={editingPlayer.email}
                      onChange={(e) => setEditingPlayer((ep) => ({ ...ep, email: e.target.value }))}
                      className="input w-full text-sm py-1.5" placeholder="Email"
                    />
                    <input
                      value={editingPlayer.phone}
                      onChange={(e) => setEditingPlayer((ep) => ({ ...ep, phone: e.target.value }))}
                      className="input w-full text-sm py-1.5" placeholder="Phone"
                    />
                    <div className="flex gap-2 pt-1">
                      <button type="submit" disabled={saving} className="btn-primary flex-1 py-1.5 text-sm">
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button type="button" onClick={() => setEditingPlayer(null)} className="btn-secondary flex-1 py-1.5 text-sm">
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div key={p.id} className="flex items-center justify-between rounded-xl bg-[#1a1f2e] px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={() => openPlayerPhotoInput(p.id)}
                        disabled={playerPhotoUploading === p.id}
                        title="Upload player photo"
                        className="group relative shrink-0"
                      >
                        {p.photoUrl ? (
                          <img src={p.photoUrl} alt={p.name} className="h-10 w-10 rounded-full object-cover ring-1 ring-gray-700 group-hover:ring-blue-500" />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-900 ring-1 ring-transparent group-hover:ring-blue-500">
                            {playerPhotoUploading === p.id
                              ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
                              : <span className="text-lg font-extrabold text-blue-300 leading-none">{p.number || '?'}</span>}
                          </div>
                        )}
                        {p.number && p.photoUrl && (
                          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#0f1117] ring-1 ring-blue-700 text-[10px] font-extrabold text-blue-400">
                            {p.number}
                          </span>
                        )}
                        <span className="absolute -bottom-0.5 -right-0.5 hidden h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-600 text-[8px] text-white group-hover:flex">✏</span>
                      </button>
                      <Link to={`/player/${clubId}/${p.id}`} className="min-w-0 hover:opacity-80">
                        {p.nickname ? (
                          <>
                            <p className="truncate font-bold text-white">"{p.nickname}"</p>
                            <p className="truncate text-xs text-gray-400">{p.name}</p>
                          </>
                        ) : (
                          <p className="truncate font-medium text-white">{p.name}</p>
                        )}
                        <div className="flex flex-wrap gap-x-2 text-xs text-gray-500">
                          {p.position && <span>{p.position}</span>}
                          {p.email && <span className="truncate max-w-[140px]">{p.email}</span>}
                          {p.phone && <span>{p.phone}</span>}
                        </div>
                        {p.status && p.status !== 'active' && (
                          <span className={`inline-block rounded-full px-1.5 py-px text-[9px] font-bold ${
                            p.status === 'injured' ? 'bg-yellow-900/50 text-yellow-300' :
                            p.status === 'suspended' ? 'bg-red-900/50 text-red-300' : ''
                          }`}>
                            {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                          </span>
                        )}
                      </Link>
                      {livePlayerIds.has(p.id) && (
                        <span title="Currently in a live game" className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-green-400" />
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-3 ml-2">
                      <button onClick={() => startEdit(p)} className="text-xs text-gray-500 hover:text-blue-400">Edit</button>
                      <button onClick={() => deletePlayer(clubId, p.id)} className="text-xs text-gray-600 hover:text-red-400">Remove</button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </section>

        {/* ── Analytics ── */}
        <section>
          <button
            onClick={() => setShowAnalytics((v) => !v)}
            className="flex w-full items-center justify-between py-2 text-left"
          >
            <h2 className="section-label">Analytics</h2>
            <span className="text-xs text-gray-600">{showAnalytics ? '▲ Hide' : '▼ Show'}</span>
          </button>
          {showAnalytics && (
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[#1a1f2e] px-4 py-4 text-center">
                <p className="text-2xl font-extrabold text-white tabular-nums">
                  {fanCount === null ? '…' : fanCount}
                </p>
                <p className="mt-1 text-xs text-gray-500">Total fans</p>
              </div>
              <div className="rounded-2xl bg-[#1a1f2e] px-4 py-4 text-center">
                <p className="text-2xl font-extrabold text-white tabular-nums">
                  {games.reduce((sum, g) => sum + (g.views || 0), 0)}
                </p>
                <p className="mt-1 text-xs text-gray-500">Total game views</p>
              </div>
              <div className="rounded-2xl bg-[#1a1f2e] px-4 py-4 text-center">
                <p className="text-2xl font-extrabold text-white tabular-nums">{games.length}</p>
                <p className="mt-1 text-xs text-gray-500">Games played</p>
              </div>
              <div className="rounded-2xl bg-[#1a1f2e] px-4 py-4 text-center">
                <p className="text-2xl font-extrabold text-white tabular-nums">{players.length}</p>
                <p className="mt-1 text-xs text-gray-500">Roster size</p>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* ── Add Player Modal ── */}
      {showAddPlayer && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
          <div className="w-full max-w-sm rounded-t-3xl bg-[#1a1f2e] p-6 sm:rounded-2xl">
            <h3 className="mb-4 text-lg font-bold text-white">Add Player</h3>
            <form onSubmit={handleAddPlayer} className="flex flex-col gap-3">
              <input
                type="text" placeholder="Full name *" value={name}
                onChange={(e) => setName(e.target.value)} required className="input" autoFocus
              />
              <input
                type="text" placeholder='Nickname (e.g. "Ace")' value={nickname}
                onChange={(e) => setNickname(e.target.value)} className="input"
              />
              <div className="flex gap-3">
                <input
                  type="text" placeholder="#" value={number}
                  onChange={(e) => setNumber(e.target.value)} className="input w-20" maxLength={3}
                />
                <select value={position} onChange={(e) => setPosition(e.target.value)} className="input flex-1">
                  <option value="">Position (opt.)</option>
                  {positions.map((pos) => <option key={pos} value={pos}>{pos}</option>)}
                </select>
              </div>
              <input
                type="email" placeholder="Email" value={email}
                onChange={(e) => setEmail(e.target.value)} className="input"
              />
              <input
                type="tel" placeholder="Phone" value={phone}
                onChange={(e) => setPhone(e.target.value)} className="input"
              />
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { resetAddForm(); setShowAddPlayer(false) }}
                  className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving || !name.trim()} className="btn-primary flex-1">
                  {saving ? 'Adding…' : 'Add Player'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Invite Link Modal ── */}
      {inviteLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
          <div className="w-full max-w-sm rounded-2xl bg-[#1a1f2e] p-6">
            <p className="mb-1 text-lg font-bold text-white">Player Added!</p>
            <p className="mb-4 text-sm text-gray-400">
              Share this invite link so the player can claim their profile and view personal stats.
            </p>
            <div className="flex items-center gap-2 rounded-xl bg-gray-800 px-3 py-2.5">
              <p className="flex-1 truncate font-mono text-xs text-gray-300">{inviteLink}</p>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(inviteLink).catch(() => {})
                  setInviteCopied(true)
                  setTimeout(() => setInviteCopied(false), 2000)
                }}
                className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition"
              >
                {inviteCopied ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
            <button
              onClick={() => { setInviteLink(null); setInviteCopied(false) }}
              className="mt-4 w-full rounded-xl py-2.5 text-sm text-gray-500 hover:text-gray-300 transition"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* ── CSV Preview Modal ── */}
      {showCsvImport && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
          <div className="w-full max-w-md rounded-t-3xl bg-[#1a1f2e] p-6 sm:rounded-2xl">
            <h3 className="mb-1 text-lg font-bold text-white">Import {csvRows.length} Players</h3>
            <p className="mb-4 text-xs text-gray-500">Review before adding to roster</p>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-white/5">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-800">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400">Name</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400">Nick</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400">#</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400">Pos</th>
                  </tr>
                </thead>
                <tbody>
                  {csvRows.map((row, i) => (
                    <tr key={i} className="border-t border-white/5">
                      <td className="px-3 py-2 text-white">{row.name}</td>
                      <td className="px-3 py-2 text-gray-400">{row.nickname || '—'}</td>
                      <td className="px-3 py-2 text-gray-400">{row.number || '—'}</td>
                      <td className="px-3 py-2 text-gray-400">{row.position || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => { setShowCsvImport(false); setCsvRows([]) }}
                disabled={csvImporting}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleCsvImport}
                disabled={csvImporting}
                className="btn-primary flex-1"
              >
                {csvImporting ? 'Importing…' : `Add ${csvRows.length} Players`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit Schedule Modal ── */}
      {(showAddSchedule || editingScheduleGame) && (
        <ScheduleGameModal
          clubId={clubId}
          club={club}
          existing={editingScheduleGame}
          schedule={schedule}
          games={games}
          players={players}
          onClose={() => { setShowAddSchedule(false); setEditingScheduleGame(null) }}
        />
      )}

      {/* ── Confirm Delete Game ── */}
      {confirmDeleteGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
          <div className="w-full max-w-sm rounded-2xl bg-[#1a1f2e] p-6">
            <div className="mb-4 flex items-start gap-3">
              <span className="mt-0.5 shrink-0 text-xl">⚠️</span>
              <div>
                <h3 className="text-lg font-bold text-white">Delete Game?</h3>
                <p className="mt-1 text-sm font-semibold text-red-400">
                  Deleting this game will also permanently delete all associated stats and records.
                </p>
                <p className="mt-2 text-xs text-gray-500">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteGame(null)}
                disabled={deletingGame}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteGame(confirmDeleteGame)}
                disabled={deletingGame}
                className="btn-danger flex-1"
              >
                {deletingGame ? 'Deleting…' : 'Delete Game'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }) {
  const cfg = {
    live:      { bg: 'bg-green-900/60 text-green-300 ring-1 ring-green-800/40', label: 'LIVE' },
    active:    { bg: 'bg-green-900/60 text-green-300 ring-1 ring-green-800/40', label: 'LIVE' },
    setup:     { bg: 'bg-blue-900/50 text-blue-300',   label: 'Upcoming' },
    scheduled: { bg: 'bg-blue-900/50 text-blue-300',   label: 'Scheduled' },
    final:     { bg: 'bg-gray-800 text-gray-400',       label: 'Final' },
  }
  const c = cfg[status] || { bg: 'bg-gray-800 text-gray-400', label: status || '—' }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${c.bg}`}>
      {(status === 'live' || status === 'active') && (
        <span className="mr-1 h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
      )}
      {c.label}
    </span>
  )
}

// ── Schedule List ─────────────────────────────────────────────────────────────

function fmtScheduledFull(iso) {
  if (!iso) return 'No date set'
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function CountdownBadge({ iso }) {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms < 0 || ms > 24 * 60 * 60 * 1000) return null
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange-900/50 px-2 py-0.5 text-[10px] font-bold text-orange-300">
      ⏱ {h > 0 ? `${h}h ${m}m` : `${m}m`} away
    </span>
  )
}

function WLDots({ results }) {
  if (!results?.length) return null
  return (
    <div className="flex items-center gap-1">
      {results.map((r, i) => (
        <span key={i} title={r.win ? 'Win' : 'Loss'}
          className={`h-2.5 w-2.5 rounded-full ${r.win ? 'bg-green-400' : 'bg-red-500'}`} />
      ))}
    </div>
  )
}

function GamePreviewCard({ game, clubId, onEdit, onDelete }) {
  const [homeRecord, setHomeRecord] = useState(null)
  const [awayRecord, setAwayRecord] = useState(null)
  const [homeResults, setHomeResults] = useState([])
  const [awayResults, setAwayResults] = useState([])
  const [h2h, setH2h] = useState(null)

  useEffect(() => {
    getClubRecord(clubId).then(setHomeRecord).catch(() => {})
    getRecentResults(clubId).then(setHomeResults).catch(() => {})
    if (game.awayClubId) {
      getClubRecord(game.awayClubId).then(setAwayRecord).catch(() => {})
      getRecentResults(game.awayClubId).then(setAwayResults).catch(() => {})
      getHeadToHead(clubId, game.awayClubId).then(setH2h).catch(() => {})
    }
  }, [game.id, clubId, game.awayClubId])

  const h2hLabel = h2h && h2h.total > 0
    ? h2h.w1 > h2h.w2 ? `You lead ${h2h.w1}–${h2h.w2}`
      : h2h.w2 > h2h.w1 ? `They lead ${h2h.w2}–${h2h.w1}`
      : `${h2h.w1}–${h2h.w2} all time`
    : null

  return (
    <div className="rounded-2xl bg-[#1a1f2e] ring-1 ring-white/5 overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-indigo-400">{fmtScheduledFull(game.scheduledAt)}</span>
          {game.scheduledAt && <CountdownBadge iso={game.scheduledAt} />}
        </div>
        <span className="text-lg">☀️</span>
      </div>

      {/* Teams + records */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm truncate">{game.homeTeam}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {homeRecord && <span className="text-[11px] text-gray-400">{homeRecord.w}-{homeRecord.l}</span>}
            <WLDots results={homeResults} />
          </div>
        </div>
        <div className="mx-3 text-center">
          <span className="text-xs font-semibold text-gray-600">VS</span>
        </div>
        <div className="flex-1 min-w-0 text-right">
          <p className="font-bold text-white text-sm truncate">{game.awayTeam}</p>
          <div className="flex items-center justify-end gap-2 mt-0.5">
            {awayRecord && <span className="text-[11px] text-gray-400">{awayRecord.w}-{awayRecord.l}</span>}
            <WLDots results={awayResults} />
          </div>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
        {game.venue && <span className="text-[11px] text-gray-500">📍 {game.venue}</span>}
        {game.gameType && game.gameType !== 'regular' && (
          <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] capitalize text-gray-400">{game.gameType}</span>
        )}
        {h2hLabel && (
          <span className="text-[11px] font-semibold text-yellow-500/80">H2H: {h2hLabel}</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 border-t border-white/5 px-4 py-2">
        <button onClick={() => onEdit(game)} className="text-xs text-gray-500 hover:text-blue-400">Edit</button>
        <button onClick={() => onDelete(game.id)} className="text-xs text-gray-600 hover:text-red-400">Remove</button>
      </div>
    </div>
  )
}

function ScheduleList({ schedule, clubId, onEdit, onDelete }) {
  const now = Date.now()
  const upcoming = schedule.filter((g) => !g.scheduledAt || new Date(g.scheduledAt).getTime() >= now)
  const past     = schedule.filter((g) => g.scheduledAt && new Date(g.scheduledAt).getTime() < now)

  function GameRow({ game }) {
    return (
      <div className="card flex items-start justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-white">
            {game.homeTeam} <span className="text-gray-500">vs</span> {game.awayTeam}
          </p>
          <p className="text-xs text-indigo-400 mt-0.5">{fmtScheduledFull(game.scheduledAt)}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {game.venue && <span className="text-xs text-gray-500">📍 {game.venue}</span>}
            {game.gameType && game.gameType !== 'regular' && (
              <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] capitalize text-gray-400">{game.gameType}</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <button onClick={() => onEdit(game)} className="text-xs text-gray-500 hover:text-blue-400">Edit</button>
          <button onClick={() => onDelete(game.id)} className="text-xs text-gray-600 hover:text-red-400">Remove</button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {upcoming.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-indigo-500">Upcoming</p>
          <div className="flex flex-col gap-2">
            {upcoming.map((g) =>
              g.awayClubId
                ? <GamePreviewCard key={g.id} game={g} clubId={clubId} onEdit={onEdit} onDelete={onDelete} />
                : <GameRow key={g.id} game={g} />
            )}
          </div>
        </div>
      )}
      {past.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-600">Past</p>
          <div className="flex flex-col gap-2">
            {past.map((g) => <GameRow key={g.id} game={g} />)}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Opponent Suggest Group ─────────────────────────────────────────────────────

function SuggestGroup({ label, items, onSelect }) {
  return (
    <div>
      <p className="px-4 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-gray-600">{label}</p>
      {items.map((item, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(item.name, item.clubId)}
          className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-[#242938]"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#242938] text-xs font-bold text-gray-400">
            {item.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{item.name}</p>
            {item.clubId && <p className="text-[10px] text-blue-400/80">Linked team</p>}
          </div>
        </button>
      ))}
    </div>
  )
}

// ── Opponent Selector Component ────────────────────────────────────────────────

function OpponentSelector({ value, clubId, club, games, onChange, existing }) {
  const [query, setQuery]               = useState('')
  const [open, setOpen]                 = useState(false)
  const [leagueSugg, setLeagueSugg]     = useState([])
  const [tourSugg, setTourSugg]         = useState([])
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching]       = useState(false)
  const wrapRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Load league/tournament context once
  useEffect(() => {
    getClubContextOpponents(clubId)
      .then(({ leagueOpponents, tournamentOpponents }) => {
        setLeagueSugg(leagueOpponents)
        setTourSugg(tournamentOpponents)
      })
      .catch(() => {})
  }, [clubId])

  // Derive unique recent opponents from past games
  const recentOpponents = useMemo(() => {
    const seen = new Map()
    const myName = club?.name || ''
    for (const g of games) {
      const isHome  = g.clubId === clubId
      const oppName = isHome ? g.awayTeam : g.homeTeam
      const oppId   = isHome ? (g.awayClubId || null) : g.clubId
      if (oppName && oppName !== myName && !seen.has(oppName)) {
        seen.set(oppName, { name: oppName, clubId: oppId })
      }
    }
    return Array.from(seen.values()).slice(0, 6)
  }, [games, clubId, club])

  // Firestore name search (debounced)
  useEffect(() => {
    if (query.length < 2) { setSearchResults([]); return }
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const res = await searchClubs(query)
        setSearchResults(res.filter((c) => c.id !== clubId).map((c) => ({ name: c.name, clubId: c.id })))
      } catch { setSearchResults([]) }
      finally { setSearching(false) }
    }, 350)
    return () => clearTimeout(t)
  }, [query, clubId])

  const q = query.toLowerCase()
  const filteredRecent = q ? recentOpponents.filter((o) => o.name.toLowerCase().includes(q)) : recentOpponents
  const filteredLeague = q ? leagueSugg.filter((o) => o.name.toLowerCase().includes(q))     : leagueSugg
  const filteredTour   = q ? tourSugg.filter((o) => o.name.toLowerCase().includes(q))       : tourSugg
  const hasStaticSugg  = filteredRecent.length > 0 || filteredLeague.length > 0 || filteredTour.length > 0
  const showSearch     = query.length >= 2

  function select(name, cId) {
    onChange({ name, clubId: cId || null })
    setQuery('')
    setOpen(false)
  }

  const isSelected = value?.name && !open

  return (
    <div ref={wrapRef} className="relative">
      {/* Trigger area */}
      <div
        onClick={() => { if (isSelected) return; setOpen(true) }}
        className={`flex min-h-[44px] items-center rounded-xl bg-[#242938] px-4 py-2.5 ring-1 transition ${
          open ? 'ring-blue-500' : 'ring-white/5'
        } ${!isSelected ? 'cursor-text' : ''}`}
      >
        {isSelected ? (
          <>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">{value.name}</p>
              {value.clubId && <p className="text-[10px] text-blue-400/80">Linked team</p>}
            </div>
            <button
              type="button"
              onClick={() => { onChange({ name: '', clubId: null }); setOpen(true) }}
              className="ml-2 shrink-0 rounded-lg px-2.5 py-1 text-xs text-gray-500 hover:bg-white/5 hover:text-white transition"
            >
              Change
            </button>
          </>
        ) : (
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder={value?.name || 'Search or type a team name…'}
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
            autoFocus={!existing}
          />
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1.5 max-h-64 overflow-y-auto rounded-2xl bg-[#1a1f2e] shadow-2xl ring-1 ring-white/10">
          {/* Static sections (filtered by query if any) */}
          {filteredRecent.length > 0 && <SuggestGroup label="Recent Opponents" items={filteredRecent} onSelect={select} />}
          {filteredLeague.length > 0  && <SuggestGroup label="In Your League"   items={filteredLeague} onSelect={select} />}
          {filteredTour.length > 0    && <SuggestGroup label="In Your Tournament" items={filteredTour} onSelect={select} />}

          {/* Firestore search results */}
          {showSearch && (
            <div className={hasStaticSugg ? 'border-t border-white/5' : ''}>
              {searching ? (
                <p className="px-4 py-3 text-xs text-gray-500">Searching…</p>
              ) : searchResults.length > 0 ? (
                <SuggestGroup label="Search Results" items={searchResults} onSelect={select} />
              ) : !hasStaticSugg ? (
                <button
                  type="button"
                  onClick={() => select(query, null)}
                  className="w-full px-4 py-3 text-left text-sm text-gray-300 transition hover:bg-[#242938]"
                >
                  Use &ldquo;<span className="font-semibold text-white">{query}</span>&rdquo; as opponent
                </button>
              ) : null}
            </div>
          )}

          {/* Empty / hint */}
          {!hasStaticSugg && !showSearch && (
            <p className="px-4 py-4 text-center text-xs text-gray-600">
              Type to search teams, or enter any name
            </p>
          )}

          {/* Always offer to use typed text as-is */}
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => select(query, null)}
              className="flex w-full items-center gap-2 border-t border-white/5 px-4 py-2.5 text-left text-xs text-gray-500 transition hover:bg-[#242938] hover:text-gray-300"
            >
              <span className="text-gray-600">↵</span>
              Use &ldquo;{query}&rdquo; as opponent name
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Add / Edit Schedule Game Modal ────────────────────────────────────────────

function ScheduleGameModal({ clubId, club, existing, schedule, games, players = [], onClose }) {
  const [opponent, setOpponent] = useState({ name: existing?.awayTeam || '', clubId: existing?.awayClubId || null })
  const [venue,     setVenue]   = useState(existing?.venue    || '')
  const [gameType, setGameType] = useState(existing?.gameType || 'regular')
  const [dateTime, setDateTime] = useState(
    existing?.scheduledAt ? new Date(existing.scheduledAt).toISOString().slice(0, 16) : ''
  )
  const [saving, setSaving]   = useState(false)
  const [conflict, setConflict] = useState('')

  // Lineup state
  const [showLineup,   setShowLineup]   = useState(false)
  const [awayPlayers,  setAwayPlayers]  = useState([])
  const [awayLoading,  setAwayLoading]  = useState(false)
  const [homeSelected, setHomeSelected] = useState(() => new Set(
    existing?.homeLineup?.length ? existing.homeLineup.map((p) => p.id) : players.map((p) => p.id)
  ))
  const [awaySelected, setAwaySelected] = useState(() => new Set(
    (existing?.awayLineup || []).map((p) => p.id)
  ))
  const [awayManual,   setAwayManual]   = useState(existing?.awayLineup?.filter((p) => !p.fromClub) || [])
  const [awayInput,    setAwayInput]    = useState('')

  // Sync home selections when players load
  useEffect(() => {
    if (!existing && players.length > 0) {
      setHomeSelected(new Set(players.map((p) => p.id)))
    }
  }, [players.length]) // eslint-disable-line

  // Fetch away roster when a linked opponent is chosen
  useEffect(() => {
    if (!opponent.clubId) { setAwayPlayers([]); return }
    setAwayLoading(true)
    getPlayers(opponent.clubId)
      .then((ps) => {
        setAwayPlayers(ps)
        if (!existing?.awayLineup?.length) setAwaySelected(new Set(ps.map((p) => p.id)))
      })
      .catch(() => setAwayPlayers([]))
      .finally(() => setAwayLoading(false))
  }, [opponent.clubId]) // eslint-disable-line

  function toggleHome(id) {
    setHomeSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAway(id) {
    setAwaySelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function addManual() {
    const name = awayInput.trim()
    if (!name) return
    setAwayManual((prev) => [...prev, { id: `m-${Date.now()}`, name, number: '', position: '' }])
    setAwayInput('')
  }

  function buildLineups() {
    const homeLineup = players.filter((p) => homeSelected.has(p.id))
      .map((p) => ({ id: p.id, name: p.name, number: p.number || '', position: p.position || '' }))
    const awayLineup = opponent.clubId && awayPlayers.length
      ? awayPlayers.filter((p) => awaySelected.has(p.id))
          .map((p) => ({ id: p.id, name: p.name, number: p.number || '', position: p.position || '', fromClub: true }))
      : awayManual.map((p) => ({ ...p }))
    return { homeLineup, awayLineup }
  }

  function checkConflict(isoStr) {
    if (!isoStr) { setConflict(''); return }
    const t = new Date(isoStr).getTime()
    const clash = schedule.find((g) => {
      if (existing && g.id === existing.id) return false
      if (!g.scheduledAt) return false
      return Math.abs(new Date(g.scheduledAt).getTime() - t) < 2 * 60 * 60 * 1000
    })
    setConflict(clash
      ? `Conflict: game within 2 hrs (${new Date(clash.scheduledAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })})`
      : '')
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!opponent.name.trim()) return
    setSaving(true)
    try {
      const { homeLineup, awayLineup } = buildLineups()
      const data = {
        awayTeam:    opponent.name.trim(),
        awayClubId:  opponent.clubId || null,
        homeTeam:    club?.name || 'Home',
        venue:       venue.trim(),
        gameType,
        scheduledAt: dateTime || null,
        sport:       club?.sport || 'basketball',
        homeLineup,
        awayLineup,
      }
      if (existing) await updateGame(existing.id, data)
      else          await createScheduledGame(clubId, data)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={onClose}>
      <div className="w-full max-w-sm space-y-4 rounded-t-3xl bg-[#1a1f2e] p-6 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-white">
          {existing ? 'Edit Scheduled Game' : 'Schedule a Game'}
        </h3>

        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Opponent *</label>
            <OpponentSelector
              value={opponent}
              clubId={clubId}
              club={club}
              games={games}
              onChange={setOpponent}
              existing={existing}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Date &amp; Time</label>
            <input
              type="datetime-local"
              value={dateTime}
              onChange={(e) => { setDateTime(e.target.value); checkConflict(e.target.value) }}
              className="input"
            />
            {conflict && <p className="mt-1 text-xs text-orange-400">⚠ {conflict}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Venue / Location</label>
            <input
              type="text"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="Gym name, field address, etc."
              className="input"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Game Type</label>
            <div className="flex gap-2">
              {GAME_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setGameType(t)}
                  className={`flex-1 rounded-xl py-2 text-sm font-semibold capitalize transition ${
                    gameType === t ? 'bg-indigo-600 text-white' : 'bg-[#242938] text-gray-300 hover:bg-[#2e3650]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* ── Lineup section ── */}
          <div>
            <button
              type="button"
              onClick={() => setShowLineup((v) => !v)}
              className="flex w-full items-center justify-between rounded-xl bg-[#242938] px-4 py-2.5 text-sm text-gray-400 hover:text-gray-200 transition"
            >
              <span className="font-semibold">🔢 Set Lineups <span className="font-normal text-gray-600">(optional)</span></span>
              <span className="text-xs">{showLineup ? '▲' : '▾'}</span>
            </button>

            {showLineup && (
              <div className="mt-2 space-y-4 rounded-xl bg-[#131720] p-4">
                {/* Home lineup */}
                <div>
                  <p className="mb-2 text-xs font-bold text-gray-400">{club?.name || 'Home'}</p>
                  {players.length === 0 ? (
                    <p className="text-xs text-gray-600">No players on roster yet.</p>
                  ) : (
                    <div className="max-h-32 space-y-1 overflow-y-auto">
                      {players.map((p) => (
                        <label key={p.id} className="flex cursor-pointer items-center gap-2">
                          <input type="checkbox" checked={homeSelected.has(p.id)} onChange={() => toggleHome(p.id)} className="accent-blue-500" />
                          <span className="text-xs text-gray-300">
                            {p.number && <span className="mr-1 font-mono text-gray-500">#{p.number}</span>}
                            {p.name}
                            {p.position && <span className="ml-1 text-gray-600">· {p.position}</span>}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Away lineup */}
                <div>
                  <p className="mb-2 text-xs font-bold text-gray-400">{opponent.name || 'Away team'}</p>
                  {opponent.clubId ? (
                    awayLoading ? (
                      <p className="text-xs text-gray-600">Loading roster…</p>
                    ) : awayPlayers.length === 0 ? (
                      <p className="text-xs text-gray-600">No players found for this team.</p>
                    ) : (
                      <div className="max-h-32 space-y-1 overflow-y-auto">
                        {awayPlayers.map((p) => (
                          <label key={p.id} className="flex cursor-pointer items-center gap-2">
                            <input type="checkbox" checked={awaySelected.has(p.id)} onChange={() => toggleAway(p.id)} className="accent-blue-500" />
                            <span className="text-xs text-gray-300">
                              {p.number && <span className="mr-1 font-mono text-gray-500">#{p.number}</span>}
                              {p.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    )
                  ) : (
                    <div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={awayInput}
                          onChange={(e) => setAwayInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addManual() } }}
                          placeholder="Player name"
                          className="input flex-1 py-2 text-xs"
                        />
                        <button
                          type="button"
                          onClick={addManual}
                          disabled={!awayInput.trim()}
                          className="rounded-xl bg-blue-700 px-3 text-xs font-semibold text-white hover:bg-blue-600 disabled:opacity-40 transition"
                        >
                          + Add
                        </button>
                      </div>
                      {awayManual.length > 0 && (
                        <div className="mt-2 max-h-28 space-y-1 overflow-y-auto">
                          {awayManual.map((p) => (
                            <div key={p.id} className="flex items-center justify-between gap-2">
                              <span className="text-xs text-gray-300">{p.name}</span>
                              <button
                                type="button"
                                onClick={() => setAwayManual((prev) => prev.filter((x) => x.id !== p.id))}
                                className="text-[10px] text-gray-600 hover:text-red-400 transition"
                              >✕</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving || !opponent.name.trim()} className="btn-primary flex-1">
              {saving ? 'Saving…' : existing ? 'Save Changes' : 'Add to Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
