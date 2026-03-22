import { useState } from 'react'
import { Link } from 'react-router-dom'
import { addPlay, updateGame, saveLineup, deletePlay, subscribeToPlayers } from '../../firebase/firestore'
import { useEffect } from 'react'
import StreamButton from './StreamButton'
import UndoButton from './UndoButton'

// Volleyball player stat actions (no score delta — set score is managed separately)
const VOL_STAT_ACTIONS = [
  { type: 'kill',  label: 'Kill',  emoji: '⚡' },
  { type: 'ace',   label: 'Ace',   emoji: '🎯' },
  { type: 'block', label: 'Block', emoji: '🛡' },
  { type: 'dig',   label: 'Dig',   emoji: '🤿' },
  { type: 'error', label: 'Error', emoji: '❌' },
  { type: 'assist_vol', label: 'Assist', emoji: '🤝' },
]

function buildVolleyballStats(plays) {
  const stats = {}
  for (const play of plays) {
    if (!play.playerId) continue
    if (!stats[play.playerId]) stats[play.playerId] = {}
    const s = stats[play.playerId]
    if (play.type === 'kill')       s.kills   = (s.kills   || 0) + 1
    if (play.type === 'ace')        s.aces    = (s.aces    || 0) + 1
    if (play.type === 'block')      s.blocks  = (s.blocks  || 0) + 1
    if (play.type === 'dig')        s.digs    = (s.digs    || 0) + 1
    if (play.type === 'error')      s.errors  = (s.errors  || 0) + 1
    if (play.type === 'assist_vol') s.assists = (s.assists || 0) + 1
  }
  return stats
}

function VolStatLabel({ stats }) {
  if (!stats) return null
  const parts = []
  if (stats.kills)   parts.push(`${stats.kills}K`)
  if (stats.aces)    parts.push(`${stats.aces}Ace`)
  if (stats.blocks)  parts.push(`${stats.blocks}Blk`)
  if (stats.digs)    parts.push(`${stats.digs}Dig`)
  if (!parts.length) return null
  return <span className="flex-shrink-0 text-xs font-bold text-yellow-400">{parts.join(' · ')}</span>
}

export default function VolleyballScorekeeper({ game, gameId, plays, user, isOnline, queueLength, enqueue }) {
  const [players, setPlayers]                   = useState([])
  const [rosterTab, setRosterTab]               = useState('home')
  const [selectedPlayer, setSelectedPlayer]     = useState(null) // { id, name, number }
  const [selectedTeam, setSelectedTeam]         = useState(null)
  const [showStatSheet, setShowStatSheet]       = useState(false)
  const [showPlays, setShowPlays]               = useState(false)
  const [toast, setToast]                       = useState(null)
  const [submitting, setSubmitting]             = useState(false)

  useEffect(() => {
    if (!game?.clubId) return
    const unsub = subscribeToPlayers(game.clubId, setPlayers)
    return unsub
  }, [game?.clubId])

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 2200)
  }

  // Volleyball-specific game fields (read with defaults)
  const homeSetScore = game.homeSetScore ?? 0
  const awaySetScore = game.awaySetScore ?? 0
  const setsHome     = game.homeScore ?? 0   // match score = sets won
  const setsAway     = game.awayScore ?? 0
  const serving      = game.serving ?? 'home'
  const currentSet   = game.period ?? 1
  const totalSets    = game.totalPeriods ?? 3
  const isFinal      = game.status === 'final'

  // Completed sets history from plays (reconstruct)
  const completedSets = game.volleySets || []

  // ── Score a point ──────────────────────────────────────────────────────────
  async function handlePoint(team) {
    if (submitting || isFinal) return
    setSubmitting(true)
    const newHomeSet = team === 'home' ? homeSetScore + 1 : homeSetScore
    const newAwaySet = team === 'away' ? awaySetScore + 1 : awaySetScore
    try {
      // Record the rally as a play (no scoreDelta so match score unaffected)
      const event = {
        type: 'point', team, playerId: null, playerName: team === 'home' ? game.homeTeam : game.awayTeam,
        playerNumber: '', points: 0, scoreDelta: null,
        clockAtPlay: 0, period: currentSet, createdBy: user.uid,
      }
      await addPlay(gameId, event, {
        homeSetScore: newHomeSet,
        awaySetScore: newAwaySet,
        serving: team, // winner of rally serves next
      })
      showToast(`${team === 'home' ? game.homeTeam : game.awayTeam} point`)
    } finally {
      setSubmitting(false)
    }
  }

  // ── End set ────────────────────────────────────────────────────────────────
  async function handleEndSet() {
    if (submitting || isFinal) return
    setSubmitting(true)
    try {
      const setWinner  = homeSetScore >= awaySetScore ? 'home' : 'away'
      const newSetsH   = setsHome + (setWinner === 'home' ? 1 : 0)
      const newSetsA   = setsAway + (setWinner === 'away' ? 1 : 0)
      const winsNeeded = Math.ceil(totalSets / 2)
      const gameOver   = newSetsH >= winsNeeded || newSetsA >= winsNeeded
      const newSets    = [...completedSets, { home: homeSetScore, away: awaySetScore }]

      await updateGame(gameId, {
        homeScore: newSetsH,
        awayScore: newSetsA,
        homeSetScore: 0,
        awaySetScore: 0,
        period: currentSet + 1,
        volleySets: newSets,
        status: gameOver ? 'final' : 'live',
        ...(gameOver ? { endedAt: new Date() } : {}),
      })
      showToast(gameOver ? 'Game over!' : `Set ${currentSet} done — starting Set ${currentSet + 1}`)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Toggle serve ───────────────────────────────────────────────────────────
  async function handleToggleServe() {
    await updateGame(gameId, { serving: serving === 'home' ? 'away' : 'home' })
  }

  // ── Log player stat ────────────────────────────────────────────────────────
  async function handleStat(type) {
    if (!selectedPlayer || !selectedTeam) return
    setShowStatSheet(false)
    const event = {
      type, team: selectedTeam,
      playerId: selectedPlayer.playerId, playerName: selectedPlayer.playerName,
      playerNumber: selectedPlayer.playerNumber || '',
      points: 0, scoreDelta: null, clockAtPlay: 0, period: currentSet, createdBy: user.uid,
    }
    await addPlay(gameId, event)
    const label = VOL_STAT_ACTIONS.find((a) => a.type === type)?.label || type
    showToast(`${selectedPlayer.playerName} — ${label}`)
    setSelectedPlayer(null)
    setSelectedTeam(null)
  }

  // ── Delete play ────────────────────────────────────────────────────────────
  async function handleDeletePlay(play) {
    await deletePlay(gameId, play.id, null)
    showToast('Play removed')
  }

  // ── Lineup management ──────────────────────────────────────────────────────
  async function handleAddToLineup(player, team) {
    const lineup = (team === 'home' ? game.homeLineup : game.awayLineup) || []
    if (lineup.some((e) => e.playerId === player.id)) return
    await saveLineup(gameId, team, [...lineup, {
      playerId: player.id, playerName: player.name,
      playerNumber: player.number || '', position: player.position || '',
    }])
  }

  async function handleRemoveFromLineup(playerId, team) {
    const lineup = (team === 'home' ? game.homeLineup : game.awayLineup) || []
    await saveLineup(gameId, team, lineup.filter((e) => e.playerId !== playerId))
  }

  const homeLineup = game.homeLineup || []
  const awayLineup = game.awayLineup || []
  const tabLineup  = rosterTab === 'home' ? homeLineup : awayLineup
  const inLineup   = new Set(tabLineup.map((e) => e.playerId))
  const bench      = players.filter((p) => !inLineup.has(p.id))
  const starters   = tabLineup.slice(0, 6)
  const subs       = tabLineup.slice(6)
  const playerStats = buildVolleyballStats(plays)

  return (
    <div className="flex h-screen flex-col bg-gray-950 safe-top overflow-hidden">
      {/* Back navigation */}
      <div className="flex items-center gap-4 overflow-x-auto border-b border-gray-800/50 bg-gray-900 px-4 py-1.5">
        <Link to="/dashboard" className="flex-shrink-0 text-xs text-gray-400 hover:text-white">← Dashboard</Link>
        {game.clubId && (
          <Link to={`/club/${game.clubId}`} className="flex-shrink-0 text-xs text-gray-400 hover:text-white">← Club</Link>
        )}
        {game.tournamentId && (
          <Link to={`/tournament/${game.tournamentId}`} className="flex-shrink-0 text-xs text-gray-400 hover:text-white">← Tournament</Link>
        )}
        {game.leagueId && (
          <Link to={`/league/${game.leagueId}`} className="flex-shrink-0 text-xs text-gray-400 hover:text-white">← League</Link>
        )}
        <Link to={`/game/${gameId}`} className="ml-auto flex-shrink-0 text-xs text-blue-500 hover:text-blue-300">Public View →</Link>
        <button
          onClick={async () => {
            const url = `${window.location.origin}/game/${gameId}`
            if (navigator.share) { try { await navigator.share({ title: 'SportStream Game', url }); return } catch (_) {} }
            navigator.clipboard.writeText(url).catch(() => {})
          }}
          className="flex-shrink-0 text-xs text-gray-400 hover:text-gray-200 transition"
        >
          ⬆ Share
        </button>
      </div>

      {/* Offline banner */}
      {(!isOnline || queueLength > 0) && (
        <div className={`shrink-0 px-4 py-1 text-center text-xs font-medium ${!isOnline ? 'bg-red-900 text-red-200' : 'bg-yellow-800 text-yellow-200'}`}>
          {!isOnline ? `● Offline — ${queueLength} queued` : `Syncing ${queueLength}…`}
        </div>
      )}

      {/* Match score header */}
      <div className="shrink-0 flex items-center bg-gray-900 px-4 py-2 border-b border-gray-800">
        <div className="flex-1 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{game.homeTeam}</p>
          <p className="text-4xl font-extrabold tabular-nums text-white">{setsHome}</p>
          <p className="text-[9px] text-gray-600 uppercase tracking-wider">Sets Won</p>
        </div>
        <div className="px-4 text-center">
          {serving === 'home' ? (
            <p className="text-xs font-bold text-yellow-400">◀ Serving</p>
          ) : (
            <p className="text-xs font-bold text-yellow-400">Serving ▶</p>
          )}
          <p className="mt-0.5 text-[10px] font-semibold text-gray-500">Set {currentSet}</p>
          {isFinal && <p className="text-xs font-bold text-gray-300">FINAL</p>}
        </div>
        <div className="flex-1 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{game.awayTeam}</p>
          <p className="text-4xl font-extrabold tabular-nums text-white">{setsAway}</p>
          <p className="text-[9px] text-gray-600 uppercase tracking-wider">Sets Won</p>
        </div>
      </div>

      {/* Current set score + point buttons */}
      {!isFinal && (
        <div className="shrink-0 bg-gray-900/60 px-4 py-3 space-y-2">
          {/* Current set score */}
          <div className="flex items-center justify-center gap-6">
            <div className="text-center">
              <p className="text-5xl font-extrabold tabular-nums text-white">{homeSetScore}</p>
              {serving === 'home' && <p className="text-[9px] font-bold text-yellow-400">SERVING</p>}
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold text-gray-600 uppercase">Set {currentSet}</p>
              <p className="text-lg font-bold text-gray-700">—</p>
            </div>
            <div className="text-center">
              <p className="text-5xl font-extrabold tabular-nums text-white">{awaySetScore}</p>
              {serving === 'away' && <p className="text-[9px] font-bold text-yellow-400">SERVING</p>}
            </div>
          </div>

          {/* Point buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => handlePoint('home')}
              disabled={submitting}
              className="flex-1 rounded-2xl bg-blue-700 py-4 text-base font-extrabold text-white hover:bg-blue-600 active:scale-95 transition disabled:opacity-50"
            >
              +1 {game.homeTeam}
            </button>
            <button
              onClick={() => handlePoint('away')}
              disabled={submitting}
              className="flex-1 rounded-2xl bg-orange-700 py-4 text-base font-extrabold text-white hover:bg-orange-600 active:scale-95 transition disabled:opacity-50"
            >
              +1 {game.awayTeam}
            </button>
          </div>

          {/* Set controls */}
          <div className="flex gap-2">
            <button onClick={handleToggleServe} className="flex-1 rounded-xl bg-gray-800 py-2 text-xs font-semibold text-yellow-400 hover:bg-gray-700">
              ⇄ Switch Serve
            </button>
            <button onClick={handleEndSet} disabled={submitting}
              className="flex-1 rounded-xl bg-gray-700 py-2 text-xs font-semibold text-gray-300 hover:bg-gray-600 disabled:opacity-50">
              End Set {currentSet} →
            </button>
          </div>

          {/* Completed set scores */}
          {completedSets.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {completedSets.map((s, i) => (
                <span key={i} className="rounded-full bg-gray-800 px-2.5 py-0.5 text-[10px] font-bold text-gray-400">
                  Set {i + 1}: {s.home}–{s.away}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Team roster tabs */}
      <div className="shrink-0 flex border-b border-gray-800 bg-gray-950">
        {['home', 'away'].map((team) => {
          const lu = team === 'home' ? homeLineup : awayLineup
          const name = team === 'home' ? game.homeTeam : game.awayTeam
          return (
            <button key={team} onClick={() => setRosterTab(team)}
              className={`relative flex-1 py-2 text-xs font-semibold transition ${rosterTab === team ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              {name} <span className="text-gray-600">({lu.length})</span>
              {rosterTab === team && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-blue-500" />}
            </button>
          )
        })}
        <button onClick={() => setShowPlays((v) => !v)}
          className={`px-3 py-2 text-xs font-semibold ${showPlays ? 'text-blue-400' : 'text-gray-600 hover:text-gray-400'}`}>
          Plays
        </button>
      </div>

      {/* Plays panel */}
      {showPlays ? (
        <div className="flex-1 overflow-y-auto divide-y divide-gray-800/60">
          {plays.length === 0 && <p className="px-5 py-10 text-center text-sm text-gray-500">No plays recorded yet.</p>}
          {plays.map((play) => (
            <div key={play.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{play.playerName}</p>
                <p className="text-xs text-gray-500 capitalize">{play.type?.replace(/_/g, ' ')} · Set {play.period}</p>
              </div>
              {!isFinal && (
                <button onClick={() => handleDeletePlay(play)} className="ml-1 text-xs text-red-700 hover:text-red-400">✕</button>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* Roster */
        <div className="flex-1 overflow-y-auto">
          {starters.length > 0 && (
            <>
              <div className="sticky top-0 bg-gray-950/90 px-4 py-1.5 backdrop-blur-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-green-500">Starters (6)</p>
              </div>
              {starters.map((entry, i) => (
                <VolPlayerRow key={entry.playerId + i} entry={entry} stats={playerStats[entry.playerId]}
                  isSelected={selectedPlayer?.playerId === entry.playerId && selectedTeam === rosterTab}
                  isActive={!isFinal}
                  onSelect={() => { if (isFinal) return; setSelectedPlayer(entry); setSelectedTeam(rosterTab); setShowStatSheet(true) }}
                  onRemove={!isFinal ? () => handleRemoveFromLineup(entry.playerId, rosterTab) : null} />
              ))}
            </>
          )}
          {subs.length > 0 && (
            <>
              <div className="sticky top-0 bg-gray-950/90 px-4 py-1.5 backdrop-blur-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Subs</p>
              </div>
              {subs.map((entry, i) => (
                <VolPlayerRow key={entry.playerId + i} entry={entry} stats={playerStats[entry.playerId]}
                  isSelected={selectedPlayer?.playerId === entry.playerId && selectedTeam === rosterTab}
                  isActive={!isFinal}
                  onSelect={() => { if (isFinal) return; setSelectedPlayer(entry); setSelectedTeam(rosterTab); setShowStatSheet(true) }}
                  onRemove={!isFinal ? () => handleRemoveFromLineup(entry.playerId, rosterTab) : null} />
              ))}
            </>
          )}
          {bench.length > 0 && (
            <>
              <div className="sticky top-0 bg-gray-950/90 px-4 py-1.5 backdrop-blur-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-600">Bench</p>
              </div>
              {bench.map((player) => (
                <div key={player.id} className="flex items-center gap-3 border-b border-gray-800/40 px-4 py-2.5">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gray-800 text-xs font-bold text-gray-500">
                    {player.number || player.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-gray-400">{player.name}</p>
                    {player.position && <p className="text-[10px] text-gray-600">{player.position}</p>}
                  </div>
                  <VolStatLabel stats={playerStats[player.id]} />
                  {!isFinal && (
                    <button onClick={() => handleAddToLineup(player, rosterTab)}
                      className="rounded-full bg-gray-700/50 px-2 py-0.5 text-[10px] font-semibold text-gray-500 hover:bg-gray-700 hover:text-white">
                      + Active
                    </button>
                  )}
                </div>
              ))}
            </>
          )}
          {tabLineup.length === 0 && bench.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-12 text-center px-6">
              <p className="text-sm text-gray-400">No players on roster.</p>
              <p className="text-xs text-gray-600">Add players in the club page to track kills, aces, blocks, and more.</p>
            </div>
          )}
        </div>
      )}

      {/* Bottom toolbar */}
      <div className="safe-bottom shrink-0 flex items-center gap-2 border-t border-gray-800 px-3 py-3">
        <StreamButton gameId={gameId} />
        <UndoButton game={game} gameId={gameId} plays={plays} />
        <Link to={`/game/${gameId}`} target="_blank" className="ml-auto rounded-xl bg-gray-800 px-3 py-3 text-sm text-gray-400 hover:text-white">👁</Link>
      </div>

      {/* Stat action sheet */}
      {showStatSheet && selectedPlayer && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/50" onClick={() => setShowStatSheet(false)}>
          <div className="rounded-t-3xl bg-gray-900 px-4 pb-8 pt-4" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-700" />
            <p className="mb-1 text-center text-sm font-semibold text-white">
              {selectedPlayer.playerNumber ? `#${selectedPlayer.playerNumber} ` : ''}{selectedPlayer.playerName}
            </p>
            <p className="mb-4 text-center text-xs text-gray-500">Credit a stat for this play</p>
            <div className="grid grid-cols-3 gap-2">
              {VOL_STAT_ACTIONS.map((a) => (
                <button key={a.type} onClick={() => handleStat(a.type)}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl bg-gray-800 py-4 text-xs font-bold text-gray-200 hover:bg-gray-700 active:scale-95 transition">
                  <span className="text-xl">{a.emoji}</span>{a.label}
                </button>
              ))}
            </div>
            <button onClick={() => setShowStatSheet(false)}
              className="mt-3 w-full rounded-xl bg-gray-800 py-3 text-sm text-gray-400 hover:bg-gray-700">
              Cancel
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-gray-800 px-5 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}

// ── Sub-component ─────────────────────────────────────────────────────────────

function VolPlayerRow({ entry, stats, isSelected, isActive, onSelect, onRemove }) {
  return (
    <div
      className={`flex items-center gap-3 border-b border-gray-800/40 px-4 py-2.5 transition ${
        isSelected ? 'bg-blue-900/20' : isActive ? 'hover:bg-gray-800/40 cursor-pointer' : ''
      }`}
      onClick={onSelect}
    >
      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
        isSelected ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300'
      }`}>
        {entry.playerNumber || entry.playerName.charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-semibold ${isSelected ? 'text-white' : 'text-gray-200'}`}>{entry.playerName}</p>
        {entry.position && <p className="text-[10px] text-gray-500">{entry.position}</p>}
      </div>
      <VolStatLabel stats={stats} />
      {onRemove && (
        <button onClick={(e) => { e.stopPropagation(); onRemove() }} className="ml-1 flex-shrink-0 text-xs text-gray-700 hover:text-red-400">✕</button>
      )}
    </div>
  )
}
