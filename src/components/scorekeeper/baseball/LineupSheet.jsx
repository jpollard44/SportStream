import { useState } from 'react'
import { saveLineup } from '../../../firebase/firestore'

/**
 * LineupSheet — modal for building a team's lineup / batting order.
 * Works for all sports. For away teams without a roster, use the Quick Add form.
 *
 * Props:
 *   gameId, game — game doc
 *   players — roster from subscribeToPlayers (can be empty for away teams)
 *   team — 'home' | 'away'
 *   sport — e.g. 'basketball' | 'baseball' (affects labels)
 *   onClose — callback
 */
export default function LineupSheet({ gameId, game, players = [], team, sport = 'basketball', onClose }) {
  const existingLineup = team === 'home' ? (game.homeLineup || []) : (game.awayLineup || [])
  const [lineup, setLineup] = useState(existingLineup)
  const [saving, setSaving] = useState(false)
  const [subIdx, setSubIdx] = useState(null)

  // Quick Add — manually enter a player not in the roster (e.g. away team)
  const [quickName, setQuickName] = useState('')
  const [quickNum, setQuickNum] = useState('')
  const [quickPos, setQuickPos] = useState('')

  const isBaseball = sport === 'baseball' || sport === 'softball'
  const lineupLabel = isBaseball ? 'Batting Order' : 'Starting Lineup'
  const teamName = team === 'home' ? game.homeTeam : game.awayTeam

  const inLineup = new Set(lineup.map((e) => e.playerId))

  function addFromRoster(player) {
    if (inLineup.has(player.id)) return
    setLineup((prev) => [
      ...prev,
      { playerId: player.id, playerName: player.name, playerNumber: player.number || '', position: player.position || '' },
    ])
  }

  function addQuick() {
    if (!quickName.trim()) return
    const tempId = `manual_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    setLineup((prev) => [
      ...prev,
      { playerId: tempId, playerName: quickName.trim(), playerNumber: quickNum.trim(), position: quickPos.trim() },
    ])
    setQuickName(''); setQuickNum(''); setQuickPos('')
  }

  function removeFromLineup(idx) {
    setLineup((prev) => prev.filter((_, i) => i !== idx))
    if (subIdx === idx) setSubIdx(null)
  }

  function moveUp(idx) {
    if (idx === 0) return
    setLineup((prev) => {
      const next = [...prev]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return next
    })
  }

  function moveDown(idx) {
    setLineup((prev) => {
      if (idx >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return next
    })
  }

  function substitutePlayer(player) {
    setLineup((prev) => {
      const next = [...prev]
      next[subIdx] = {
        playerId: player.id,
        playerName: player.name,
        playerNumber: player.number || '',
        position: player.position || '',
      }
      return next
    })
    setSubIdx(null)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await saveLineup(gameId, team, lineup)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const bench = players.filter((p) => !inLineup.has(p.id))
  const subOptions = subIdx !== null
    ? players.filter((p) => p.id !== lineup[subIdx]?.playerId)
    : []
  const showRosterList = subIdx !== null ? subOptions : bench

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-950 safe-top">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
        <div>
          <h2 className="text-lg font-bold text-white">{lineupLabel} — {teamName}</h2>
          <p className="text-xs text-gray-500">
            {subIdx !== null
              ? 'Tap a player to substitute them in'
              : 'Tap order ↑↓ to reorder · tap slot to substitute'}
          </p>
        </div>
        <button onClick={onClose} className="rounded-xl bg-gray-800 px-3 py-2 text-sm text-gray-400 hover:text-white">✕</button>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* Left: current lineup order */}
        <div className="flex w-1/2 flex-col border-r border-gray-800">
          <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
            {lineupLabel} ({lineup.length})
          </p>
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
            {lineup.length === 0 && (
              <p className="py-8 text-center text-xs text-gray-500">
                {players.length > 0 ? 'Tap players on the right →' : 'Use Quick Add below →'}
              </p>
            )}
            {lineup.map((entry, idx) => (
              <div
                key={entry.playerId + idx}
                className={`flex items-center gap-1.5 rounded-xl px-2 py-2 transition ${
                  subIdx === idx ? 'bg-blue-900/60 ring-1 ring-blue-500' : 'bg-gray-800'
                }`}
              >
                <span className="w-5 shrink-0 text-center text-xs font-bold text-gray-500">{idx + 1}</span>

                <button className="min-w-0 flex-1 text-left" onClick={() => setSubIdx(subIdx === idx ? null : idx)}>
                  <p className="truncate text-sm font-semibold text-white">
                    {entry.playerNumber ? `#${entry.playerNumber} ` : ''}{entry.playerName}
                  </p>
                  {entry.position && <p className="text-[10px] text-gray-500">{entry.position}</p>}
                </button>

                <div className="flex flex-col gap-0.5 shrink-0">
                  <button onClick={() => moveUp(idx)} className="px-1 text-gray-600 hover:text-white text-xs leading-none">↑</button>
                  <button onClick={() => moveDown(idx)} className="px-1 text-gray-600 hover:text-white text-xs leading-none">↓</button>
                </div>

                <button onClick={() => removeFromLineup(idx)} className="shrink-0 px-1 text-xs text-gray-700 hover:text-red-400">✕</button>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-800 p-3">
            <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
              {saving ? 'Saving…' : `Save ${lineupLabel}`}
            </button>
          </div>
        </div>

        {/* Right: roster list + quick add */}
        <div className="flex w-1/2 flex-col overflow-hidden">
          <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
            {subIdx !== null
              ? `Swap in (replacing ${lineup[subIdx]?.playerName})`
              : 'Add Players'}
          </p>

          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
            {/* Roster / sub options */}
            {showRosterList.map((player) => (
              <button
                key={player.id}
                onClick={() => subIdx !== null ? substitutePlayer(player) : addFromRoster(player)}
                className="flex w-full items-center gap-2 rounded-xl bg-gray-800 px-3 py-2.5 text-left hover:bg-gray-700 active:scale-95 transition"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-700 text-xs font-bold text-gray-300">
                  {player.number || player.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  {player.nickname ? (
                    <>
                      <p className="truncate text-sm font-bold text-white">"{player.nickname}"</p>
                      <p className="truncate text-[10px] text-gray-400">{player.name}</p>
                    </>
                  ) : (
                    <p className="truncate text-sm font-semibold text-white">{player.name}</p>
                  )}
                  {!player.nickname && player.position && <p className="text-[10px] text-gray-500">{player.position}</p>}
                </div>
                <span className="shrink-0 text-xs text-blue-400">{subIdx !== null ? 'Swap' : '+'}</span>
              </button>
            ))}

            {showRosterList.length === 0 && subIdx === null && (
              <p className="pt-1 pb-2 text-xs text-gray-600 italic">
                {players.length === 0 ? 'No roster loaded — use Quick Add' : 'All roster players are already in the lineup'}
              </p>
            )}

            {/* Quick Add — always visible when not in sub mode */}
            {subIdx === null && (
              <div className="mt-1 rounded-xl border border-gray-700 bg-gray-900 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Quick Add</p>
                <div className="flex gap-1.5 mb-1.5">
                  <input
                    type="text"
                    placeholder="#"
                    value={quickNum}
                    onChange={(e) => setQuickNum(e.target.value)}
                    className="w-12 rounded-lg bg-gray-800 px-2 py-1.5 text-center text-sm text-white placeholder-gray-600"
                    maxLength={3}
                  />
                  <input
                    type="text"
                    placeholder="Player name"
                    value={quickName}
                    onChange={(e) => setQuickName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addQuick()}
                    className="flex-1 rounded-lg bg-gray-800 px-2 py-1.5 text-sm text-white placeholder-gray-600"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Position (optional)"
                  value={quickPos}
                  onChange={(e) => setQuickPos(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addQuick()}
                  className="mb-2 w-full rounded-lg bg-gray-800 px-2 py-1.5 text-sm text-white placeholder-gray-600"
                />
                <button
                  onClick={addQuick}
                  disabled={!quickName.trim()}
                  className="w-full rounded-lg bg-blue-700 py-2 text-xs font-bold text-white hover:bg-blue-600 active:scale-95 disabled:opacity-40 transition"
                >
                  + Add to {lineupLabel}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
