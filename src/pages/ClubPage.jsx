import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useClub } from '../hooks/useClub'
import { addPlayer, updatePlayer, deletePlayer, updateClub, subscribeToClubGames, deleteGame, markGameFinal } from '../firebase/firestore'
import { uploadClubLogo, uploadPlayerPhoto } from '../firebase/storage'
import { useEffect, useRef } from 'react'
import { formatDate } from '../lib/formatters'
import { SPORT_POSITIONS } from '../lib/baseballHelpers'

export default function ClubPage() {
  const { clubId } = useParams()
  const { club, players, loading } = useClub(clubId)
  const [games, setGames] = useState([])

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

  function resetAddForm() {
    setName(''); setNickname(''); setNumber(''); setPosition(''); setEmail(''); setPhone('')
  }

  async function handleAddPlayer(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await addPlayer(clubId, { name: name.trim(), nickname: nickname.trim(), number, position, email: email.trim(), phone: phone.trim() })
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
      })
      setEditingPlayer(null)
    } finally { setSaving(false) }
  }

  function startEdit(p) {
    setEditingPlayer({
      id: p.id, name: p.name, nickname: p.nickname || '',
      number: p.number || '', position: p.position || '',
      email: p.email || '', phone: p.phone || '',
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
    <div className="min-h-screen bg-gray-950 pb-24">
      {/* Hidden file inputs */}
      <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
      <input ref={playerPhotoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePlayerPhotoUpload} />

      {uploadError && (
        <div className="mx-5 mt-3 flex items-center justify-between gap-2 rounded-xl bg-red-900/40 px-4 py-2.5 text-sm text-red-300">
          <span>{uploadError}</span>
          <button onClick={() => setUploadError('')} className="shrink-0 text-red-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-gray-800 px-5 py-5">
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
            <h1 className="text-xl font-extrabold text-white leading-tight">{club?.name}</h1>
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
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-800 py-12 text-center">
              <span className="text-3xl">🎮</span>
              <p className="text-sm text-gray-400">No games yet.</p>
              <Link to={`/club/${clubId}/game/new`}
                className="rounded-full bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600 transition">
                Start first game →
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {games.map((game) => (
                <div key={game.id} className="card flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-white">
                      {game.homeTeam} <span className="text-gray-500">vs</span> {game.awayTeam}
                    </p>
                    <p className="text-sm text-gray-400">{formatDate(game.createdAt)}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <StatusBadge status={game.status} />
                      <span className="text-xs font-bold text-white">{game.homeScore}–{game.awayScore}</span>
                    </div>
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
              ))}
            </div>
          )}
        </section>

        {/* ── Roster ── */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-label">Roster ({players.length})</h2>
            <button
              onClick={() => setShowAddPlayer(true)}
              className="rounded-full bg-gray-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-600 transition"
            >
              + Add Player
            </button>
          </div>

          {players.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-800 py-12 text-center">
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
                  <div key={p.id} className="flex items-center justify-between rounded-xl bg-gray-900 px-4 py-3">
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
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-900 text-sm font-bold text-blue-200 ring-1 ring-transparent group-hover:ring-blue-500">
                            {playerPhotoUploading === p.id
                              ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
                              : (p.number || '—')}
                          </div>
                        )}
                        <span className="absolute -bottom-0.5 -right-0.5 hidden h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-600 text-[8px] text-white group-hover:flex">✏</span>
                      </button>
                      <div className="min-w-0">
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
                      </div>
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
      </main>

      {/* ── Add Player Modal ── */}
      {showAddPlayer && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
          <div className="w-full max-w-sm rounded-t-3xl bg-gray-900 p-6 sm:rounded-2xl">
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

      {/* ── Confirm Delete Game ── */}
      {confirmDeleteGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
          <div className="w-full max-w-sm rounded-2xl bg-gray-900 p-6">
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
  const config = {
    setup:  { label: 'Setup',    cls: 'bg-yellow-900/50 text-yellow-300' },
    live:   { label: '● LIVE',   cls: 'bg-red-900/50 text-red-400' },
    paused: { label: 'Paused',   cls: 'bg-gray-700 text-gray-300' },
    final:  { label: 'Final',    cls: 'bg-gray-800 text-gray-400' },
  }
  const { label, cls } = config[status] || config.setup
  return <span className={`badge ${cls}`}>{label}</span>
}
