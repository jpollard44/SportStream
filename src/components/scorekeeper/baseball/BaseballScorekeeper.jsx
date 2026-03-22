import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { subscribeToPlayers, updateGame, addPlay, undoPlay } from '../../../firebase/firestore'
import {
  buildBaseballPlayEvent,
  describeBaseballPlay,
  nextInningState,
  advanceBases,
  BB_OUT_TYPES,
  BB_BATTER_DONE_TYPES,
  BB_PLAY_TYPES,
  BB_PLAY_LABELS,
  BB_HIT_TYPES,
} from '../../../lib/baseballHelpers'
import { inningLabel, nickDisplay } from '../../../lib/formatters'
import BaseDiamond from './BaseDiamond'
import BaseballActionSheet from './BaseballActionSheet'
import LineupSheet from './LineupSheet'
import StreamButton from '../StreamButton'
import VoiceButton from '../VoiceButton'

export default function BaseballScorekeeper({ game, gameId, plays, user, isOnline, queueLength, enqueue }) {
  const [players, setPlayers]         = useState([])
  const [showActionSheet, setShowActionSheet] = useState(false)
  const [showLineup, setShowLineup]   = useState(false)
  const [lineupTeam, setLineupTeam]   = useState('home')
  const [submitting, setSubmitting]   = useState(false)
  const [toast, setToast]             = useState(null)
  const [balls, setBalls]             = useState(0)
  const [strikes, setStrikes]         = useState(0)
  const [editScoreTeam, setEditScoreTeam] = useState(null) // 'home'|'away'|null
  // Active base for runner management modal
  const [activeBase, setActiveBase]   = useState(null) // 'first'|'second'|'third'|null
  // Lineup player menu for sub / set-as-current
  const [playerMenu, setPlayerMenu]   = useState(null) // { idx, entry } | null
  const [subPickerFor, setSubPickerFor] = useState(null) // idx in lineup | null

  useEffect(() => {
    if (!game?.clubId) return
    const unsub = subscribeToPlayers(game.clubId, setPlayers)
    return unsub
  }, [game?.clubId])

  // Sync count from Firestore on mount / game change (e.g. page refresh)
  useEffect(() => {
    setBalls(game.balls ?? 0)
    setStrikes(game.strikes ?? 0)
  }, [gameId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived state ──────────────────────────────────────────────────────────
  const rosterMap = Object.fromEntries(players.map((p) => [p.id, p]))

  const battingTeam  = game.inningHalf === 'top' ? 'away' : 'home'
  const fieldingTeam = battingTeam === 'home' ? 'away' : 'home'
  const isFinal      = game.status === 'final'
  const sidesDone    = (game.outs || 0) >= 3
  const bases        = game.bases ?? { first: null, second: null, third: null }

  const homeLineup = game.homeLineup || []
  const awayLineup = game.awayLineup || []
  const homeBIdx   = game.homeBatterIdx ?? 0
  const awayBIdx   = game.awayBatterIdx ?? 0

  const battingLineup  = battingTeam === 'home' ? homeLineup : awayLineup
  const currentBIdx    = battingTeam === 'home' ? homeBIdx   : awayBIdx
  const currentBatter  = battingLineup.length > 0 ? battingLineup[currentBIdx % battingLineup.length] : null

  const activeBatter = currentBatter
    ? { id: currentBatter.playerId, name: currentBatter.playerName, number: currentBatter.playerNumber || '', nickname: rosterMap[currentBatter.playerId]?.nickname || '' }
    : null

  // ── Toast ──────────────────────────────────────────────────────────────────
  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 2800)
  }

  function resetCount() {
    setBalls(0)
    setStrikes(0)
    updateGame(gameId, { balls: 0, strikes: 0 }).catch(() => {})
  }

  // ── Count quick-tap (auto-trigger walk/K at limit) ─────────────────────────
  function incrementBall() {
    if (balls >= 3) { handleAction(BB_PLAY_TYPES.WALK); return }
    const n = balls + 1
    setBalls(n)
    updateGame(gameId, { balls: n }).catch(() => {})
  }
  function incrementStrike() {
    if (strikes >= 2) { handleAction(BB_PLAY_TYPES.STRIKEOUT); return }
    const n = strikes + 1
    setStrikes(n)
    updateGame(gameId, { strikes: n }).catch(() => {})
  }

  // ── Record a plate-appearance play ────────────────────────────────────────
  async function handleAction(type) {
    if (submitting) return
    setSubmitting(true)
    setShowActionSheet(false)
    setPlayerMenu(null)

    try {
      const runnerInfo = activeBatter
        ? { playerId: activeBatter.id, playerName: activeBatter.name, playerNumber: activeBatter.number || '' }
        : null

      const { newBases, runsScored } = advanceBases(bases, type, runnerInfo)

      const event = buildBaseballPlayEvent({
        type, game,
        player: activeBatter,
        createdBy: user.uid,
        runsScored,
      })

      const batterDone     = BB_BATTER_DONE_TYPES.has(type)
      const nextBIdx       = batterDone && battingLineup.length > 0
        ? (currentBIdx + 1) % battingLineup.length
        : currentBIdx
      const batterIdxField = battingTeam === 'home' ? 'homeBatterIdx' : 'awayBatterIdx'
      const isOut          = BB_OUT_TYPES.has(type)

      const gameUpdate = {
        bases: newBases,
        [batterIdxField]: nextBIdx,
        ...(isOut ? { outs: Math.min((game.outs || 0) + 1, 3) } : {}),
        ...(game.status === 'setup' ? { status: 'live' } : {}),
        ...(batterDone ? { balls: 0, strikes: 0 } : {}),
      }

      if (isOnline) {
        await addPlay(gameId, event, gameUpdate)
      } else {
        await enqueue(gameId, event)
        showToast('Play queued — will sync when online')
        return
      }

      let msg = describeBaseballPlay(event)
      if (runsScored > 0) msg += ` · ${runsScored} run${runsScored > 1 ? 's' : ''} score${runsScored > 1 ? '' : 's'}!`
      showToast(msg)
      if (batterDone) resetCount()
    } finally {
      setSubmitting(false)
    }
  }

  // ── Undo ───────────────────────────────────────────────────────────────────
  async function handleUndo() {
    const last = plays[0]
    if (!last || submitting) return
    const outsToRevert   = BB_OUT_TYPES.has(last.type) ? 1 : 0
    const wasDone        = BB_BATTER_DONE_TYPES.has(last.type)
    const lu             = last.team === 'home' ? homeLineup : awayLineup
    const currIdx        = last.team === 'home' ? homeBIdx : awayBIdx
    const prevIdx        = wasDone && lu.length > 0 ? (currIdx - 1 + lu.length) % lu.length : currIdx
    const batField       = last.team === 'home' ? 'homeBatterIdx' : 'awayBatterIdx'
    await undoPlay(gameId, last.id, last.scoreDelta, outsToRevert, { [batField]: prevIdx })
    showToast('Last play undone')
  }

  // ── Change sides ───────────────────────────────────────────────────────────
  async function handleChangeSides() {
    const next = nextInningState(game)
    await updateGame(gameId, { ...next, bases: { first: null, second: null, third: null }, balls: 0, strikes: 0 })
    setBalls(0)
    setStrikes(0)
    showToast(next.status === 'final' ? 'Game over!' : `${inningLabel(next.inning ?? game.inning, next.inningHalf)} begins`)
  }

  // ── Add manual run ─────────────────────────────────────────────────────────
  async function handleAddRun() {
    const event = buildBaseballPlayEvent({ type: BB_PLAY_TYPES.RUN, game, player: null, createdBy: user.uid, runsScored: 1 })
    if (isOnline) await addPlay(gameId, event, {})
    else await enqueue(gameId, event)
    showToast('Run scored')
  }

  // ── Base runner management ─────────────────────────────────────────────────
  async function handleBaseScore(baseName) {
    const runner   = bases[baseName]
    const newBases = { ...bases, [baseName]: null }
    const p        = runner ? { id: runner.playerId, name: runner.playerName, number: runner.playerNumber } : null
    const event    = buildBaseballPlayEvent({ type: BB_PLAY_TYPES.RUN, game, player: p, createdBy: user.uid, runsScored: 1 })
    await addPlay(gameId, event, { bases: newBases })
    setActiveBase(null)
    showToast('Run scored!')
  }

  async function handleBaseOut(baseName) {
    const newBases = { ...bases, [baseName]: null }
    const newOuts  = Math.min((game.outs || 0) + 1, 3)
    await updateGame(gameId, { bases: newBases, outs: newOuts })
    setActiveBase(null)
    showToast('Out on bases')
  }

  async function handleBaseMove(fromBase, toBase) {
    if (!bases[fromBase]) return
    const newBases = { ...bases, [fromBase]: null, [toBase]: bases[fromBase] }
    await updateGame(gameId, { bases: newBases })
    setActiveBase(null)
    showToast(`Runner → ${toBase === 'first' ? '1B' : toBase === 'second' ? '2B' : '3B'}`)
  }

  async function handleRemoveRunner(baseName) {
    await updateGame(gameId, { bases: { ...bases, [baseName]: null } })
    setActiveBase(null)
    showToast('Runner removed')
  }

  // ── Substitution from lineup ───────────────────────────────────────────────
  async function handleSubstitute(lineupIdx, newPlayer) {
    const field      = battingTeam === 'home' ? 'homeLineup' : 'awayLineup'
    const newLineup  = [...battingLineup]
    newLineup[lineupIdx] = {
      playerId: newPlayer.id, playerName: newPlayer.name,
      playerNumber: newPlayer.number || '', position: newPlayer.position || '',
    }
    await updateGame(gameId, { [field]: newLineup })
    setSubPickerFor(null)
    setPlayerMenu(null)
    showToast(`${newPlayer.name} in for ${battingLineup[lineupIdx]?.playerName}`)
  }

  async function handleSetCurrentBatter(lineupIdx) {
    const field = battingTeam === 'home' ? 'homeBatterIdx' : 'awayBatterIdx'
    await updateGame(gameId, { [field]: lineupIdx })
    setPlayerMenu(null)
    showToast(`${battingLineup[lineupIdx]?.playerName} up to bat`)
  }

  // Per-play stats for each lineup slot
  const statsFor = {}
  for (const play of plays) {
    if (!play.playerId) continue
    if (!statsFor[play.playerId]) statsFor[play.playerId] = { h: 0, ab: 0, rbi: 0 }
    const s = statsFor[play.playerId]
    if (['single','double','triple','homeRun','strikeout','groundOut','flyOut','lineOut'].includes(play.type)) s.ab++
    if (BB_HIT_TYPES.has(play.type)) s.h++
    if (play.points) s.rbi += play.points
  }

  const battingTeamName  = battingTeam === 'home' ? game.homeTeam : game.awayTeam
  const fieldingTeamName = fieldingTeam === 'home' ? game.homeTeam : game.awayTeam
  const runnersOn        = [bases.first, bases.second, bases.third].filter(Boolean).length

  // Bench players: in the roster but not in the current lineup
  const inLineup          = new Set(battingLineup.map((e) => e.playerId))
  const bench             = players.filter((p) => !inLineup.has(p.id))

  // Recent plays (last 5)
  const recentPlays = plays.slice(0, 5)

  return (
    <div className="flex h-screen flex-col bg-gray-950 safe-top overflow-hidden">

      {/* ── Back navigation ─────────────────────────────────────────────────── */}
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

      {/* ── Offline banner ─────────────────────────────────────────────────── */}
      {(!isOnline || queueLength > 0) && (
        <div className={`px-4 py-1 text-center text-xs font-medium ${!isOnline ? 'bg-red-900 text-red-200' : 'bg-yellow-800 text-yellow-200'}`}>
          {!isOnline ? `● Offline — ${queueLength} queued` : `Syncing ${queueLength}…`}
        </div>
      )}

      {/* ── Score bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center border-b border-gray-800 bg-gray-900 px-3 py-2">
        <div className="flex-1 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{game.awayTeam}</p>
          <button onClick={() => !isFinal && setEditScoreTeam('away')} className={`text-3xl font-extrabold tabular-nums text-white ${!isFinal ? 'active:opacity-70' : ''}`}>
            {game.awayScore}
          </button>
        </div>
        <div className="flex flex-col items-center px-3">
          <p className="text-xs font-bold text-blue-400">{isFinal ? 'FINAL' : inningLabel(game.inning, game.inningHalf)}</p>
          {!isFinal && (
            <div className="mt-1 flex gap-1">
              {[0, 1, 2].map((i) => (
                <div key={i} className={`h-2 w-2 rounded-full ${i < (game.outs || 0) ? 'bg-yellow-400' : 'bg-gray-700'}`} />
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{game.homeTeam}</p>
          <button onClick={() => !isFinal && setEditScoreTeam('home')} className={`text-3xl font-extrabold tabular-nums text-white ${!isFinal ? 'active:opacity-70' : ''}`}>
            {game.homeScore}
          </button>
        </div>
      </div>

      {/* ── Change Sides banner ────────────────────────────────────────────── */}
      {sidesDone && !isFinal && (
        <div className="flex items-center justify-between bg-orange-900/80 px-4 py-2.5">
          <p className="text-sm font-bold text-orange-200">3 Outs — Change Sides</p>
          <button onClick={handleChangeSides} className="rounded-xl bg-orange-400 px-4 py-1.5 text-xs font-bold text-orange-900 hover:bg-orange-300">
            End {game.inningHalf === 'top' ? 'Top' : 'Bot'} {game.inning} →
          </button>
        </div>
      )}

      {/* ── Main body: left diamond column + right lineup column ─────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: Diamond + count + batting info */}
        <div className="flex w-44 flex-shrink-0 flex-col gap-2 overflow-y-auto border-r border-gray-800 bg-gray-900/50 px-3 py-3">

          {/* Diamond */}
          <div className="flex flex-col items-center">
            <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-gray-500">
              Bases {runnersOn > 0 ? `· ${runnersOn} on` : ''}
            </p>
            <BaseDiamond
              bases={bases}
              compact
              onBaseClick={!isFinal && !sidesDone ? setActiveBase : undefined}
            />
          </div>

          {/* Count */}
          {!isFinal && !sidesDone && (
            <div className="rounded-xl bg-gray-800/80 px-2 py-2">
              <p className="mb-1.5 text-center text-[9px] font-semibold uppercase tracking-wider text-gray-500">Count</p>
              <div className="flex justify-around gap-1">
                <CountColumn label="B" value={balls} max={3} color="green" onIncrement={incrementBall} />
                <CountColumn label="K" value={strikes} max={2} color="red" onIncrement={incrementStrike} />
              </div>
              <button onClick={resetCount} className="mt-2 w-full rounded-lg bg-gray-700/50 py-0.5 text-[9px] text-gray-400 hover:text-white">
                Reset Count
              </button>
            </div>
          )}

          {/* Batting info */}
          <div className="rounded-xl bg-gray-800/80 px-2 py-2 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">Batting</p>
            <p className="text-xs font-bold text-white truncate">{battingTeamName}</p>
            {currentBatter ? (
              <div className="mt-1.5 rounded-lg bg-blue-900/50 p-1.5">
                <p className="text-[9px] text-blue-400 leading-none">At Bat</p>
                {(() => {
                  const rp = rosterMap[currentBatter.playerId]
                  const nick = rp?.nickname?.trim()
                  return nick ? (
                    <>
                      <p className="mt-0.5 text-[11px] font-bold leading-tight text-blue-200 truncate">"{nick}"</p>
                      <p className="text-[9px] text-blue-300/70 truncate">{currentBatter.playerNumber ? `#${currentBatter.playerNumber} ` : ''}{currentBatter.playerName}</p>
                    </>
                  ) : (
                    <p className="mt-0.5 text-[11px] font-bold leading-tight text-blue-200 truncate">
                      {currentBatter.playerNumber ? `#${currentBatter.playerNumber} ` : ''}{currentBatter.playerName}
                    </p>
                  )
                })()}
                {currentBatter.position && (
                  <p className="text-[9px] text-gray-500">{currentBatter.position}</p>
                )}
              </div>
            ) : (
              <p className="mt-1 text-[10px] text-gray-600 italic">No lineup</p>
            )}
          </div>

          <div className="rounded-xl bg-gray-800/40 px-2 py-1.5 text-center">
            <p className="text-[9px] text-gray-600">Fielding</p>
            <p className="text-[10px] font-semibold text-gray-500 truncate">{fieldingTeamName}</p>
          </div>
        </div>

        {/* Right: Lineup + recent plays */}
        <div className="flex flex-1 flex-col overflow-hidden">

          {/* Team tabs (switch which team's lineup is visible / tap to edit) */}
          <div className="flex border-b border-gray-800">
            {['home', 'away'].map((t) => {
              const lu        = t === 'home' ? homeLineup : awayLineup
              const isBatting = battingTeam === t
              return (
                <button
                  key={t}
                  onClick={() => { setLineupTeam(t); setShowLineup(true) }}
                  className={`flex-1 py-2 text-xs font-semibold transition ${
                    isBatting ? 'bg-blue-900/20 text-blue-300' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {t === 'home' ? game.homeTeam : game.awayTeam}
                  {' '}<span className="text-gray-600 font-normal">({lu.length}) ✎</span>
                  {isBatting && <span className="ml-1 text-blue-400">▸</span>}
                </button>
              )
            })}
          </div>

          {/* Lineup list */}
          <div className="flex-1 overflow-y-auto">
            {battingLineup.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-4 py-10">
                <p className="text-sm text-gray-400">No lineup set for {battingTeamName}</p>
                <button
                  onClick={() => { setLineupTeam(battingTeam); setShowLineup(true) }}
                  className="btn-primary py-2 px-5 text-sm"
                >
                  + Set Lineup
                </button>
              </div>
            ) : (
              battingLineup.map((entry, idx) => {
                const isCurrent  = idx === currentBIdx % battingLineup.length
                const st         = statsFor[entry.playerId] || { h: 0, ab: 0, rbi: 0 }
                const isOnBase   = Object.values(bases).some((r) => r?.playerId === entry.playerId)
                return (
                  <button
                    key={entry.playerId + idx}
                    onClick={() => {
                      if (isFinal || sidesDone) return
                      if (isCurrent) {
                        setShowActionSheet(true)
                      } else {
                        setPlayerMenu({ idx, entry })
                      }
                    }}
                    className={`flex w-full items-center gap-2 border-b border-gray-800/40 px-3 py-2.5 text-left transition ${
                      isCurrent ? 'bg-blue-900/25' : 'hover:bg-gray-800/40'
                    }`}
                  >
                    {/* Order number */}
                    <span className={`w-4 flex-shrink-0 text-center text-xs font-bold ${isCurrent ? 'text-blue-400' : 'text-gray-600'}`}>
                      {idx + 1}
                    </span>

                    {/* Jersey circle */}
                    <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
                      isCurrent ? 'bg-blue-700 text-white' : 'bg-gray-800 text-gray-400'
                    }`}>
                      {entry.playerNumber || entry.playerName.charAt(0)}
                    </div>

                    {/* Name + position */}
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm font-semibold ${isCurrent ? 'text-white' : 'text-gray-300'}`}>
                        {entry.playerName}
                      </p>
                      <div className="flex items-center gap-1.5">
                        {entry.position && <span className="text-[10px] text-gray-500">{entry.position}</span>}
                        {isOnBase && <span className="rounded bg-yellow-900/60 px-1 text-[9px] font-bold text-yellow-400">ON BASE</span>}
                      </div>
                    </div>

                    {/* H-AB + RBI */}
                    {(st.ab > 0 || st.rbi > 0) && (
                      <div className="flex-shrink-0 text-right">
                        <p className="text-xs font-semibold text-gray-400">{st.h}-{st.ab}</p>
                        {st.rbi > 0 && <p className="text-[9px] text-green-400">{st.rbi} RBI</p>}
                      </div>
                    )}

                    {isCurrent && !isFinal && !sidesDone && (
                      <span className="flex-shrink-0 text-xs text-blue-400">▸</span>
                    )}
                  </button>
                )
              })
            )}
          </div>

          {/* Recent plays strip */}
          {recentPlays.length > 0 && (
            <div className="border-t border-gray-800 bg-gray-900/60 px-3 py-2">
              <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-gray-500">Recent Plays</p>
              <div className="flex flex-col gap-1">
                {recentPlays.map((play, i) => {
                  const label = BB_PLAY_LABELS[play.type] || play.type
                  const isHit = BB_HIT_TYPES.has(play.type)
                  const isOut = BB_OUT_TYPES.has(play.type)
                  const color = isHit ? 'text-blue-300' : isOut ? 'text-red-400' : 'text-gray-400'
                  return (
                    <div key={play.id || i} className="flex items-center gap-2">
                      <span className={`w-7 rounded text-center text-[10px] font-bold ${
                        isHit ? 'bg-blue-900/60 text-blue-300' : isOut ? 'bg-red-900/40 text-red-400' : 'bg-gray-800 text-gray-400'
                      } py-0.5`}>
                        {label}
                      </span>
                      <span className="flex-1 truncate text-[11px] text-gray-400">
                        {play.playerName || 'Team'}
                        {play.inning && ` · ${inningLabel(play.inning, play.inningHalf)}`}
                      </span>
                      {play.points > 0 && (
                        <span className="text-[10px] font-bold text-green-400">+{play.points}R</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom toolbar ─────────────────────────────────────────────────── */}
      {!isFinal && !sidesDone && (
        <div className="safe-bottom border-t border-gray-800 bg-gray-950 px-3 py-2">
          {/* Top row: stream/voice/view */}
          <div className="mb-2 flex items-center justify-between">
            <StreamButton gameId={gameId} />
            <div className="flex gap-2">
              <VoiceButton
                players={players}
                sport={game.sport}
                onConfirm={(type, player) => handleAction(type)}
              />
              <Link to={`/game/${gameId}`} target="_blank"
                className="rounded-xl bg-gray-800 px-3 py-2 text-sm text-gray-400 hover:text-white">
                👁
              </Link>
            </div>
          </div>
          {/* Action row */}
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={handleUndo}
              disabled={!plays[0] || submitting}
              className="rounded-xl bg-gray-800 py-3 text-xs font-semibold text-gray-400 hover:bg-gray-700 disabled:opacity-40 active:scale-95"
            >↩ Undo</button>
            <button
              onClick={() => setShowActionSheet(true)}
              disabled={submitting}
              className="col-span-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50 active:scale-95"
            >
              {currentBatter
                ? `${nickDisplay(currentBatter.playerName, rosterMap[currentBatter.playerId]?.nickname)} → Play`
                : '+ Record Play'}
            </button>
            <button
              onClick={handleAddRun}
              disabled={submitting}
              className="rounded-xl bg-gray-800 py-3 text-xs font-semibold text-green-400 hover:bg-gray-700 disabled:opacity-40 active:scale-95"
            >+Run</button>
          </div>
        </div>
      )}

      {isFinal && (
        <div className="safe-bottom border-t border-gray-800 px-4 py-4 text-center">
          <p className="font-bold text-white">
            Final — {game.awayTeam} {game.awayScore} · {game.homeTeam} {game.homeScore}
          </p>
          <Link to={`/game/${gameId}`} className="mt-2 inline-block text-sm text-blue-400">
            View public page →
          </Link>
        </div>
      )}

      {/* ── Base runner action modal ────────────────────────────────────────── */}
      {activeBase && (
        <BaseActionModal
          baseName={activeBase}
          runner={bases[activeBase]}
          bases={bases}
          onMove={(toBase) => handleBaseMove(activeBase, toBase)}
          onScore={() => handleBaseScore(activeBase)}
          onOut={() => handleBaseOut(activeBase)}
          onRemove={() => handleRemoveRunner(activeBase)}
          onClose={() => setActiveBase(null)}
        />
      )}

      {/* ── Player options menu (sub / set current) ─────────────────────────── */}
      {playerMenu && subPickerFor === null && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60" onClick={() => setPlayerMenu(null)}>
          <div className="w-full max-w-sm rounded-t-3xl bg-gray-900 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-700" />
            <p className="mb-1 text-center text-sm font-bold text-white">
              {playerMenu.entry.playerNumber ? `#${playerMenu.entry.playerNumber} ` : ''}{playerMenu.entry.playerName}
            </p>
            {playerMenu.entry.position && (
              <p className="mb-4 text-center text-xs text-gray-500">{playerMenu.entry.position}</p>
            )}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleSetCurrentBatter(playerMenu.idx)}
                className="rounded-xl bg-blue-700 py-3 text-sm font-bold text-white hover:bg-blue-600"
              >
                ▶ Move to This Batter
              </button>
              <button
                onClick={() => setSubPickerFor(playerMenu.idx)}
                className="rounded-xl bg-gray-700 py-3 text-sm font-semibold text-gray-200 hover:bg-gray-600"
              >
                ↔ Substitute Player
              </button>
              <button
                onClick={() => setPlayerMenu(null)}
                className="rounded-xl bg-gray-800 py-3 text-sm text-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sub picker ───────────────────────────────────────────────────────── */}
      {subPickerFor !== null && (
        <div className="fixed inset-0 z-50 flex flex-col bg-gray-950 safe-top">
          <div className="flex items-center gap-4 border-b border-gray-800 px-5 py-4">
            <button onClick={() => { setSubPickerFor(null); setPlayerMenu(null) }} className="text-sm text-gray-400">← Back</button>
            <div>
              <p className="font-bold text-white">Substitute Player</p>
              <p className="text-xs text-gray-400">
                Replacing: {battingLineup[subPickerFor]?.playerName}
              </p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Available Players (Bench: {bench.length})
            </p>
            {bench.length === 0 && (
              <p className="py-8 text-center text-sm text-gray-500">All rostered players are already in the lineup</p>
            )}
            {[...bench, ...players.filter((p) => inLineup.has(p.id) && p.id !== battingLineup[subPickerFor]?.playerId)].map((player, i, arr) => {
              const isBench = !inLineup.has(player.id) || player.id === battingLineup[subPickerFor]?.playerId
              return (
                <div key={player.id}>
                  {i === bench.length && bench.length > 0 && (
                    <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-gray-600">In Lineup</p>
                  )}
                  <button
                    onClick={() => handleSubstitute(subPickerFor, player)}
                    className="flex w-full items-center gap-3 rounded-xl bg-gray-800 px-4 py-3 mb-2 text-left hover:bg-gray-700 active:scale-95 transition"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-700 text-sm font-bold text-gray-200">
                      {player.number || player.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      {player.nickname ? (
                        <>
                          <p className="font-bold text-white">"{player.nickname}"</p>
                          <p className="text-xs text-gray-400">{player.name}</p>
                        </>
                      ) : (
                        <p className="font-semibold text-white">{player.name}</p>
                      )}
                      {player.position && <p className="text-xs text-gray-400">{player.position}</p>}
                    </div>
                    <span className={`text-xs font-semibold ${isBench ? 'text-green-400' : 'text-yellow-400'}`}>
                      {isBench ? 'Sub In' : 'Swap'}
                    </span>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Action sheet ─────────────────────────────────────────────────────── */}
      {showActionSheet && (
        <BaseballActionSheet
          player={activeBatter}
          game={game}
          onAction={handleAction}
          onClose={() => setShowActionSheet(false)}
          disabled={submitting}
        />
      )}

      {/* ── Lineup editor ────────────────────────────────────────────────────── */}
      {showLineup && (
        <LineupSheet
          gameId={gameId}
          game={game}
          players={players}
          team={lineupTeam}
          onClose={() => setShowLineup(false)}
        />
      )}

      {/* ── Score edit modal ─────────────────────────────────────────────────── */}
      {editScoreTeam && (
        <BaseballScoreEditModal
          team={editScoreTeam}
          game={game}
          onClose={() => setEditScoreTeam(null)}
          onSave={async (val) => {
            setEditScoreTeam(null)
            await updateGame(gameId, { [editScoreTeam === 'home' ? 'homeScore' : 'awayScore']: val })
            showToast(`Score updated`)
          }}
        />
      )}

      {/* ── Toast ────────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="pointer-events-none fixed bottom-28 left-1/2 z-50 -translate-x-1/2 rounded-full bg-gray-800 px-5 py-2.5 text-sm font-medium text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  )
}

// ── Base runner action modal ─────────────────────────────────────────────────

function BaseActionModal({ baseName, runner, bases, onMove, onScore, onOut, onRemove, onClose }) {
  const label = baseName === 'first' ? '1st Base' : baseName === 'second' ? '2nd Base' : '3rd Base'
  const hasRunner = !!runner

  const moveOptions = ['first', 'second', 'third'].filter((b) => {
    if (b === baseName) return false           // can't move to same base
    if (bases[b]) return false                 // base already occupied
    return true
  })

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-sm rounded-t-3xl bg-gray-900 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-700" />

        <p className="mb-1 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>

        {hasRunner ? (
          <>
            <p className="mb-4 text-center font-bold text-white">
              {runner.playerNumber ? `#${runner.playerNumber} ` : ''}{runner.playerName}
            </p>

            <div className="mb-3 grid grid-cols-2 gap-2">
              <button
                onClick={onScore}
                className="flex flex-col items-center gap-1 rounded-xl bg-green-800 py-3 text-xs font-bold text-green-200 hover:bg-green-700 active:scale-95"
              >
                <span className="text-xl">🏠</span>
                Scored +1 Run
              </button>
              <button
                onClick={onOut}
                className="flex flex-col items-center gap-1 rounded-xl bg-red-900/70 py-3 text-xs font-bold text-red-300 hover:bg-red-800 active:scale-95"
              >
                <span className="text-xl">✗</span>
                Out on Bases
              </button>
            </div>

            {moveOptions.length > 0 && (
              <div className={`mb-3 grid gap-2 ${moveOptions.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {moveOptions.map((b) => (
                  <button
                    key={b}
                    onClick={() => onMove(b)}
                    className="rounded-xl bg-gray-800 py-2.5 text-xs font-semibold text-gray-200 hover:bg-gray-700 active:scale-95"
                  >
                    → Move to {b === 'first' ? '1B' : b === 'second' ? '2B' : '3B'}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={onRemove}
              className="mb-2 w-full rounded-xl bg-gray-800/60 py-2 text-xs text-gray-500 hover:text-red-400"
            >
              Remove Runner
            </button>
          </>
        ) : (
          <p className="mb-4 text-center text-sm text-gray-400">Base is empty. Use the lineup to place a runner, or record a hit.</p>
        )}

        <button onClick={onClose} className="w-full rounded-xl bg-gray-800 py-3 text-sm text-gray-400">Cancel</button>
      </div>
    </div>
  )
}

// ── Score edit modal for baseball ────────────────────────────────────────────

function BaseballScoreEditModal({ team, game, onClose, onSave }) {
  const current = team === 'home' ? (game.homeScore ?? 0) : (game.awayScore ?? 0)
  const [val, setVal] = useState(current)
  const teamName = team === 'home' ? game.homeTeam : game.awayTeam

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="w-72 rounded-2xl bg-gray-900 p-6" onClick={(e) => e.stopPropagation()}>
        <p className="mb-1 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Edit Score</p>
        <p className="mb-4 text-center text-sm font-bold text-white">{teamName}</p>
        <div className="mb-6 flex items-center justify-center gap-4">
          <button
            onClick={() => setVal((v) => Math.max(0, v - 1))}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-800 text-2xl font-bold text-white hover:bg-gray-700 active:scale-95"
          >−</button>
          <input
            type="number"
            min={0}
            value={val}
            onChange={(e) => setVal(Math.max(0, Number(e.target.value)))}
            className="w-20 rounded-xl bg-gray-800 py-2 text-center text-3xl font-extrabold text-white"
          />
          <button
            onClick={() => setVal((v) => v + 1)}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-800 text-2xl font-bold text-white hover:bg-gray-700 active:scale-95"
          >+</button>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl bg-gray-800 py-3 text-sm text-gray-400">Cancel</button>
          <button onClick={() => onSave(val)} className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-500 active:scale-95">Save</button>
        </div>
      </div>
    </div>
  )
}

function CountColumn({ label, value, max, color, onIncrement }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <p className={`text-[9px] font-bold ${color === 'green' ? 'text-green-400' : 'text-red-400'}`}>{label}</p>
      <div className="flex gap-0.5">
        {Array.from({ length: max + 1 }, (_, i) => (
          <div
            key={i}
            className={`h-1.5 w-1.5 rounded-full ${
              i < value
                ? color === 'green' ? 'bg-green-400' : 'bg-red-400'
                : 'bg-gray-700'
            }`}
          />
        ))}
      </div>
      <button
        onClick={onIncrement}
        className={`rounded-lg px-2 py-0.5 text-[9px] font-bold hover:opacity-80 active:scale-95 ${
          color === 'green' ? 'bg-green-900/60 text-green-300' : 'bg-red-900/40 text-red-300'
        }`}
      >
        +{label}
      </button>
      <span className="font-mono text-lg font-extrabold text-white w-3 text-center">{value}</span>
    </div>
  )
}
