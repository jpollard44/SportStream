import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useGame } from '../hooks/useGame'
import { useGameClock } from '../hooks/useGameClock'
import { useOfflineQueue } from '../context/OfflineQueueContext'
import { addPlay, subscribeToPlayers, saveLineup, deletePlay, updateGame } from '../firebase/firestore'
import BaseballScorekeeper from '../components/scorekeeper/baseball/BaseballScorekeeper'
import VolleyballScorekeeper from '../components/scorekeeper/VolleyballScorekeeper'
import LineupSheet from '../components/scorekeeper/baseball/LineupSheet'
import ScoreHeader from '../components/scorekeeper/ScoreHeader'
import GameClock from '../components/scorekeeper/GameClock'
import ScoreActionSheet from '../components/scorekeeper/ScoreActionSheet'
import UndoButton from '../components/scorekeeper/UndoButton'
import StreamButton from '../components/scorekeeper/StreamButton'
import VoiceButton from '../components/scorekeeper/VoiceButton'

// ── Voice announcement ────────────────────────────────────────────────────────

function buildAnnouncement(type, playerName, teamName, sport) {
  const p = playerName || teamName || 'Team'
  const t = teamName || 'Team'
  const map = {
    // Basketball
    score_3:    `${p} hits a three pointer!`,
    score_2:    `${p} scores!`,
    ft_made:    `${p} makes the free throw.`,
    rebound:    `${p} with the rebound.`,
    assist:     `${p} with the assist.`,
    steal:      `${p} with the steal!`,
    block:      `${p} with the block!`,
    foul:       `Foul on ${p}.`,
    turnover:   `Turnover — ${p}.`,
    // Soccer
    goal:       `GOAL! ${p} scores for ${t}!`,
    penalty_goal: `Penalty goal! ${p} scores!`,
    save:       `Great save by ${p}!`,
    // Flag Football
    touchdown:  `Touchdown ${t}! ${p} finds pay dirt!`,
    field_goal: `Field goal! ${p} is good!`,
    interception: `Interception by ${p}!`,
    sack:       `Sack by ${p}!`,
    extra_point: `Extra point good!`,
    two_point:   `Two point conversion!`,
  }
  return map[type] || `${p} — ${type.replace(/_/g, ' ')}.`
}

function announcePlay(type, playerName, teamName, sport) {
  if (!window.speechSynthesis) return
  const text = buildAnnouncement(type, playerName, teamName, sport)
  const utt = new SpeechSynthesisUtterance(text)
  utt.rate = 1.1
  utt.pitch = 1.2
  utt.volume = 1.0
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utt)
}

// ── Sport play configurations ─────────────────────────────────────────────────

const SPORT_CONFIG = {
  basketball: {
    starterCount: 5,
    scoring: [
      { type: 'score_2',  label: '2 PT',    emoji: '🏀', points: 2 },
      { type: 'score_3',  label: '3 PT',    emoji: '🎯', points: 3 },
      { type: 'ft_made',  label: 'FT Made', emoji: '✓',  points: 1 },
      { type: 'ft_miss',  label: 'FT Miss', emoji: '✗',  points: 0 },
    ],
    stats: [
      { type: 'rebound',  label: 'Rebound',  emoji: '↩' },
      { type: 'assist',   label: 'Assist',   emoji: '🤝' },
      { type: 'steal',    label: 'Steal',    emoji: '✋' },
      { type: 'block',    label: 'Block',    emoji: '🛡' },
      { type: 'foul',     label: 'Foul',     emoji: '⚠' },
      { type: 'turnover', label: 'Turnover', emoji: '↔' },
    ],
  },
  soccer: {
    starterCount: 11,
    scoring: [
      { type: 'goal',         label: 'Goal',    emoji: '⚽', points: 1 },
      { type: 'penalty_goal', label: 'Penalty', emoji: '🥅', points: 1 },
    ],
    stats: [
      { type: 'assist',      label: 'Assist',   emoji: '🤝' },
      { type: 'save',        label: 'Save',     emoji: '🧤' },
      { type: 'yellow_card', label: 'Yellow',   emoji: '🟨' },
      { type: 'red_card',    label: 'Red Card', emoji: '🟥' },
      { type: 'foul',        label: 'Foul',     emoji: '⚠️' },
      { type: 'corner',      label: 'Corner',   emoji: '📐' },
      { type: 'offside',     label: 'Offside',  emoji: '🚩' },
      { type: 'shot',        label: 'Shot',     emoji: '📍' },
    ],
  },
  'flag-football': {
    starterCount: 7,
    scoring: [
      { type: 'touchdown',   label: 'TD',        emoji: '🏈', points: 6 },
      { type: 'extra_point', label: 'XP (1)',    emoji: '✓',  points: 1 },
      { type: 'two_point',   label: '2-PT Conv', emoji: '2️⃣', points: 2 },
      { type: 'field_goal',  label: 'FG',        emoji: '🎯', points: 3 },
      { type: 'safety',      label: 'Safety',    emoji: '🛡',  points: 2, toOpponent: true },
    ],
    stats: [
      { type: 'interception',    label: 'Interception', emoji: '✋' },
      { type: 'sack',            label: 'Sack',         emoji: '💪' },
      { type: 'fumble_recovery', label: 'Fumble Rec',   emoji: '🤲' },
      { type: 'penalty',         label: 'Penalty',      emoji: '🚩' },
    ],
  },
}

// ── Per-player stat computation ───────────────────────────────────────────────

function buildPlayerStats(plays, sport) {
  const stats = {}
  for (const play of plays) {
    if (!play.playerId) continue
    if (!stats[play.playerId]) stats[play.playerId] = {}
    const s = stats[play.playerId]
    if (sport === 'basketball') {
      if (play.points)                  s.points   = (s.points   || 0) + play.points
      if (play.type === 'rebound')      s.rebounds  = (s.rebounds  || 0) + 1
      if (play.type === 'assist')       s.assists   = (s.assists   || 0) + 1
      if (play.type === 'steal')        s.steals    = (s.steals    || 0) + 1
      if (play.type === 'block')        s.blocks    = (s.blocks    || 0) + 1
      if (play.type === 'foul')         s.fouls     = (s.fouls     || 0) + 1
    } else if (sport === 'soccer') {
      if (['goal','penalty_goal'].includes(play.type)) s.goals = (s.goals || 0) + 1
      if (play.type === 'assist')       s.assists     = (s.assists     || 0) + 1
      if (play.type === 'save')         s.saves       = (s.saves       || 0) + 1
      if (play.type === 'yellow_card')  s.yellowCards = (s.yellowCards || 0) + 1
      if (play.type === 'red_card')     s.redCards    = (s.redCards    || 0) + 1
    } else if (sport === 'flag-football') {
      if (play.type === 'touchdown')       s.touchdowns    = (s.touchdowns    || 0) + 1
      if (play.type === 'interception')    s.interceptions = (s.interceptions || 0) + 1
      if (play.type === 'sack')            s.sacks         = (s.sacks         || 0) + 1
      if (play.type === 'fumble_recovery') s.fumbles       = (s.fumbles       || 0) + 1
    }
  }
  return stats
}

// ── Stat pills display ────────────────────────────────────────────────────────

function StatPills({ sport, stats }) {
  if (!stats) return null
  if (sport === 'basketball') {
    const p = []
    if (stats.points)   p.push(`${stats.points}pts`)
    if (stats.rebounds) p.push(`${stats.rebounds}reb`)
    if (stats.assists)  p.push(`${stats.assists}ast`)
    if (stats.steals)   p.push(`${stats.steals}stl`)
    if (stats.blocks)   p.push(`${stats.blocks}blk`)
    if (!p.length) return null
    return <span className="flex-shrink-0 text-xs font-bold text-yellow-400">{p.join(' · ')}</span>
  }
  if (sport === 'soccer') {
    const p = []
    if (stats.goals)   p.push(`${stats.goals}G`)
    if (stats.assists) p.push(`${stats.assists}A`)
    if (stats.saves)   p.push(`${stats.saves}Sv`)
    const cards = [
      stats.yellowCards && `${stats.yellowCards}🟨`,
      stats.redCards    && '🟥',
    ].filter(Boolean)
    const all = [...p, ...cards]
    if (!all.length) return null
    return <span className="flex-shrink-0 text-xs font-bold text-yellow-400">{all.join(' ')}</span>
  }
  if (sport === 'flag-football') {
    const p = []
    if (stats.touchdowns)    p.push(`${stats.touchdowns}TD`)
    if (stats.interceptions) p.push(`${stats.interceptions}INT`)
    if (stats.sacks)         p.push(`${stats.sacks}Sk`)
    if (!p.length) return null
    return <span className="flex-shrink-0 text-xs font-bold text-yellow-400">{p.join(' · ')}</span>
  }
  return null
}

// ── Score edit modal ──────────────────────────────────────────────────────────

function ScoreEditModal({ team, game, onClose, onSave }) {
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ScorekeeperPage() {
  const { gameId } = useParams()
  const { user }   = useAuth()
  const { game, plays, loading } = useGame(gameId)
  const { displaySeconds, startClock, pauseClock, nextPeriod } = useGameClock(game)
  const { isOnline, queueLength, enqueue } = useOfflineQueue()

  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    try { return localStorage.getItem('ss_voice_announce') === 'true' } catch { return false }
  })

  function toggleVoice() {
    const next = !voiceEnabled
    setVoiceEnabled(next)
    try { localStorage.setItem('ss_voice_announce', String(next)) } catch {}
  }

  const [players, setPlayers]                   = useState([])
  const [selectedPlayerId, setSelectedPlayerId] = useState(null)
  const [activeTeam, setActiveTeam]             = useState('home')
  const [showActionSheet, setShowActionSheet]   = useState(false)
  const [toast, setToast]                       = useState(null)
  const [submitting, setSubmitting]             = useState(false)
  const [playCount, setPlayCount]               = useState(0)
  const [showPlays, setShowPlays]               = useState(false)
  const [editScoreTeam, setEditScoreTeam]       = useState(null)
  const [lineupEditorTeam, setLineupEditorTeam] = useState(null) // 'home'|'away'|null

  useEffect(() => {
    if (!game?.clubId) return
    const unsub = subscribeToPlayers(game.clubId, setPlayers)
    return unsub
  }, [game?.clubId])

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const selectedPlayer = players.find((p) => p.id === selectedPlayerId) || null

  function handlePlayerSelect(playerId, team) {
    setSelectedPlayerId(playerId)
    setActiveTeam(team)
    setShowActionSheet(true)
  }

  async function handleTeamPlay(team) {
    setSelectedPlayerId(null)
    setActiveTeam(team)
    setShowActionSheet(true)
  }

  async function handleAction(type) {
    setSubmitting(true)
    setShowActionSheet(false)
    const sport      = game.sport || 'basketball'
    const config     = SPORT_CONFIG[sport] || SPORT_CONFIG.basketball
    const actionDef  = [...config.scoring, ...config.stats].find((a) => a.type === type)
    const scoringTeam = actionDef?.toOpponent ? (activeTeam === 'home' ? 'away' : 'home') : activeTeam
    const points      = actionDef?.points || 0
    const scoreDelta  = points > 0
      ? { home: scoringTeam === 'home' ? points : 0, away: scoringTeam === 'away' ? points : 0 }
      : null

    const event = {
      type,
      team: activeTeam,
      playerId:     selectedPlayer?.id    || null,
      playerName:   selectedPlayer?.name  || 'Team',
      playerNumber: selectedPlayer?.number || '',
      points,
      scoreDelta,
      clockAtPlay: displaySeconds,
      period:      game.period,
      createdBy:   user.uid,
    }

    try {
      if (isOnline) {
        await addPlay(gameId, event)
      } else {
        await enqueue(gameId, event)
        showToast('Play queued — will sync when online')
      }
      if (voiceEnabled) {
        const teamName = activeTeam === 'home' ? game.homeTeam : game.awayTeam
        announcePlay(type, selectedPlayer?.name || null, teamName, sport)
      }
      const n = playCount + 1
      setPlayCount(n)
      if (n % 5 === 0) {
        showToast(`🔥 ${n} plays!`)
      } else {
        const who = selectedPlayer ? selectedPlayer.name.split(' ')[0] : (activeTeam === 'home' ? game.homeTeam : game.awayTeam)
        showToast(`${who} — ${actionDef?.label || type}`)
      }
    } finally {
      setSubmitting(false)
      setSelectedPlayerId(null)
    }
  }

  async function handleSaveScore(team, value) {
    setEditScoreTeam(null)
    const field = team === 'home' ? 'homeScore' : 'awayScore'
    await updateGame(gameId, { [field]: value })
    showToast(`${team === 'home' ? game.homeTeam : game.awayTeam} score set to ${value}`)
  }

  async function handleAddToLineup(player, team) {
    const lineup = (team === 'home' ? game.homeLineup : game.awayLineup) || []
    if (lineup.some((e) => e.playerId === player.id)) return
    await saveLineup(gameId, team, [...lineup, {
      playerId: player.id, playerName: player.name,
      playerNumber: player.number || '', position: player.position || '',
    }])
    showToast(`${player.name} → ${team === 'home' ? game.homeTeam : game.awayTeam}`)
  }

  async function handleRemoveFromLineup(playerId, team) {
    const lineup = (team === 'home' ? game.homeLineup : game.awayLineup) || []
    await saveLineup(gameId, team, lineup.filter((e) => e.playerId !== playerId))
  }

  async function handleDeletePlay(play) {
    await deletePlay(gameId, play.id, play.scoreDelta)
    showToast('Play removed')
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  if (!game) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gray-950 text-gray-400">
        <p className="text-lg font-semibold text-white">Game not found</p>
        <p className="mt-1 text-sm text-gray-500">This game code may be invalid or expired.</p>
        <Link to="/dashboard" className="mt-4 text-blue-400">Go to Dashboard</Link>
      </div>
    )
  }

  // Non-host guard: if a scorekeeper has been assigned, only they can access this page
  // (if no scorekeeper assigned yet, any logged-in user who has the join code may score)
  const isAuthorized = !game.scorekeeperId || game.scorekeeperId === user?.uid

  if (!isAuthorized) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-950 px-6 text-center">
        <p className="text-4xl">🔒</p>
        <p className="text-lg font-bold text-white">Scorekeeper access only</p>
        <p className="text-sm text-gray-400">
          You're not authorized to keep score for this game.
          Ask the game host to add you as the scorekeeper.
        </p>
        <Link to={`/game/${gameId}`} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500">
          Watch game →
        </Link>
        <Link to="/dashboard" className="text-sm text-gray-500 hover:text-gray-300">
          ← Dashboard
        </Link>
      </div>
    )
  }

  const sport = game.sport || 'basketball'

  if (sport === 'baseball' || sport === 'softball') {
    return <BaseballScorekeeper game={game} gameId={gameId} plays={plays} user={user} isOnline={isOnline} queueLength={queueLength} enqueue={enqueue} />
  }
  if (sport === 'volleyball') {
    return <VolleyballScorekeeper game={game} gameId={gameId} plays={plays} user={user} isOnline={isOnline} queueLength={queueLength} enqueue={enqueue} />
  }

  // Basketball / Soccer / Flag-football — shared clock-based layout
  const isFinal    = game.status === 'final'
  const homeLineup = game.homeLineup || []
  const awayLineup = game.awayLineup || []
  const config     = SPORT_CONFIG[sport] || SPORT_CONFIG.basketball
  const playerStats = buildPlayerStats(plays, sport)
  const sc         = config.starterCount || 5

  const homeInLineup = new Set(homeLineup.map((e) => e.playerId))
  const awayInLineup = new Set(awayLineup.map((e) => e.playerId))
  const homeBench    = players.filter((p) => !homeInLineup.has(p.id))

  const homeStarters = homeLineup.slice(0, sc)
  const homeSubs     = homeLineup.slice(sc)
  const awayStarters = awayLineup.slice(0, sc)
  const awaySubs     = awayLineup.slice(sc)

  return (
    <div className="flex h-screen flex-col bg-gray-950 safe-top">
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
        <button
          onClick={toggleVoice}
          title={voiceEnabled ? 'Voice on — tap to mute' : 'Voice off — tap to enable'}
          className={`ml-auto flex-shrink-0 rounded-lg px-2 py-1 text-sm transition ${
            voiceEnabled
              ? 'bg-green-800/40 text-green-300 hover:bg-green-800/60'
              : 'text-gray-600 hover:text-gray-300'
          }`}
        >
          {voiceEnabled ? '🔊' : '🔇'}
        </button>
      </div>

      {/* Offline banner */}
      {(!isOnline || queueLength > 0) && (
        <div className={`px-4 py-1.5 text-center text-xs font-medium ${!isOnline ? 'bg-red-900 text-red-200' : 'bg-yellow-800 text-yellow-200'}`}>
          {!isOnline ? `● Offline — ${queueLength} queued` : `Syncing ${queueLength}…`}
        </div>
      )}

      <ScoreHeader game={game} onEditScore={!isFinal ? setEditScoreTeam : undefined} />

      <GameClock game={game} displaySeconds={displaySeconds} onStart={() => startClock(gameId)} onPause={() => pauseClock(gameId)} onNextPeriod={() => nextPeriod(gameId)} />

      {/* Plays toggle */}
      <div className="flex border-b border-gray-800 bg-gray-950">
        <button onClick={() => setShowPlays(false)}
          className={`flex-1 py-2 text-xs font-semibold transition ${!showPlays ? 'text-white border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'}`}>
          Rosters
        </button>
        <button onClick={() => setShowPlays(true)}
          className={`flex-1 py-2 text-xs font-semibold transition ${showPlays ? 'text-blue-400 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'}`}>
          Plays ({plays.length})
        </button>
      </div>

      {/* Plays panel */}
      {showPlays ? (
        <div className="flex-1 overflow-y-auto divide-y divide-gray-800/60">
          {plays.length === 0 && <p className="px-5 py-10 text-center text-sm text-gray-500">No plays recorded yet.</p>}
          {plays.map((play) => {
            const playClubId = play.team === 'home' ? game.clubId : game.awayClubId
            return (
            <div key={play.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="flex-1 min-w-0">
                {play.playerId && playClubId ? (
                  <Link
                    to={`/player/${playClubId}/${play.playerId}`}
                    className="block truncate text-sm font-semibold text-white hover:text-blue-300 transition hover:underline"
                  >
                    {play.playerName}
                  </Link>
                ) : (
                  <p className="text-sm font-semibold text-white truncate">
                    {play.playerName || (play.team === 'home' ? game.homeTeam : game.awayTeam)}
                  </p>
                )}
                <p className="text-xs text-gray-500 capitalize">{play.type?.replace(/_/g, ' ')} · {play.team}</p>
              </div>
              {(play.scoreDelta?.home || play.scoreDelta?.away) && (
                <span className="text-sm font-bold text-green-400">+{play.scoreDelta.home || play.scoreDelta.away}</span>
              )}
              {!isFinal && (
                <button onClick={() => handleDeletePlay(play)} className="ml-1 text-xs text-red-700 hover:text-red-400">✕</button>
              )}
            </div>
            )
          })}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">

          {/* ── Home Team ── */}
          <TeamSectionHeader
            teamName={game.homeTeam}
            teamColor="home"
            activeCount={homeLineup.length}
            onTeamPlay={!isFinal ? () => handleTeamPlay('home') : null}
            onEditLineup={!isFinal ? () => setLineupEditorTeam('home') : null}
          />

          {homeStarters.map((entry, i) => (
            <DualPlayerRow
              key={entry.playerId + i}
              entry={entry}
              stats={playerStats[entry.playerId]}
              sport={sport}
              tag="St"
              tagColor="text-green-400"
              isFinal={isFinal}
              onAction={() => handlePlayerSelect(entry.playerId, 'home')}
              onRemove={() => handleRemoveFromLineup(entry.playerId, 'home')}
            />
          ))}

          {homeSubs.length > 0 && (
            <>
              <SubSectionLabel label="Subs" color="text-blue-400" />
              {homeSubs.map((entry, i) => (
                <DualPlayerRow
                  key={entry.playerId + i}
                  entry={entry}
                  stats={playerStats[entry.playerId]}
                  sport={sport}
                  tag="Sub"
                  tagColor="text-blue-400"
                  isFinal={isFinal}
                  onAction={() => handlePlayerSelect(entry.playerId, 'home')}
                  onRemove={() => handleRemoveFromLineup(entry.playerId, 'home')}
                />
              ))}
            </>
          )}

          {homeBench.length > 0 && (
            <>
              <SubSectionLabel label="Bench" color="text-gray-600" />
              {homeBench.map((player) => (
                <BenchRow
                  key={player.id}
                  player={player}
                  stats={playerStats[player.id]}
                  sport={sport}
                  isFinal={isFinal}
                  clubId={game.clubId}
                  onAction={() => handlePlayerSelect(player.id, 'home')}
                  onAddToLineup={() => handleAddToLineup(player, 'home')}
                />
              ))}
            </>
          )}

          {homeLineup.length === 0 && homeBench.length === 0 && (
            <p className="px-4 py-3 text-xs text-gray-600 italic">No home roster. Add players in the club page.</p>
          )}

          {/* ── Away Team ── */}
          <TeamSectionHeader
            teamName={game.awayTeam}
            teamColor="away"
            activeCount={awayLineup.length}
            onTeamPlay={!isFinal ? () => handleTeamPlay('away') : null}
            onEditLineup={!isFinal ? () => setLineupEditorTeam('away') : null}
          />

          {awayStarters.map((entry, i) => (
            <DualPlayerRow
              key={entry.playerId + i}
              entry={entry}
              stats={playerStats[entry.playerId]}
              sport={sport}
              tag="St"
              tagColor="text-green-400"
              isFinal={isFinal}
              onAction={() => handlePlayerSelect(entry.playerId, 'away')}
              onRemove={() => handleRemoveFromLineup(entry.playerId, 'away')}
            />
          ))}

          {awaySubs.length > 0 && (
            <>
              <SubSectionLabel label="Subs" color="text-blue-400" />
              {awaySubs.map((entry, i) => (
                <DualPlayerRow
                  key={entry.playerId + i}
                  entry={entry}
                  stats={playerStats[entry.playerId]}
                  sport={sport}
                  tag="Sub"
                  tagColor="text-blue-400"
                  isFinal={isFinal}
                  onAction={() => handlePlayerSelect(entry.playerId, 'away')}
                  onRemove={() => handleRemoveFromLineup(entry.playerId, 'away')}
                />
              ))}
            </>
          )}

          {awayLineup.length === 0 && (
            <p className="px-4 py-3 text-xs text-gray-600 italic">No away lineup set.</p>
          )}
        </div>
      )}

      {/* Bottom toolbar */}
      {!isFinal && (
        <div className="safe-bottom flex flex-col gap-2 border-t border-gray-800 px-3 py-3">
          <div className="flex justify-end"><StreamButton gameId={gameId} /></div>
          <div className="flex items-center gap-2">
            <UndoButton game={game} gameId={gameId} plays={plays} />
            <VoiceButton players={players} sport={sport}
              onConfirm={(type, player) => { if (player) setSelectedPlayerId(player.id); handleAction(type) }} />
            <Link to={`/game/${gameId}`} target="_blank" className="rounded-xl bg-gray-800 px-3 py-3 text-sm text-gray-400 hover:text-white">👁</Link>
          </div>
        </div>
      )}

      {showActionSheet && (
        <ScoreActionSheet
          player={selectedPlayer} team={activeTeam}
          scoringActions={config.scoring} statActions={config.stats}
          onAction={handleAction}
          onClose={() => { setShowActionSheet(false); setSelectedPlayerId(null) }}
          disabled={submitting}
        />
      )}

      {editScoreTeam && (
        <ScoreEditModal
          team={editScoreTeam}
          game={game}
          onClose={() => setEditScoreTeam(null)}
          onSave={(val) => handleSaveScore(editScoreTeam, val)}
        />
      )}

      {lineupEditorTeam && (
        <LineupSheet
          gameId={gameId}
          game={game}
          players={lineupEditorTeam === 'home' ? players : []}
          team={lineupEditorTeam}
          sport={sport}
          onClose={() => setLineupEditorTeam(null)}
        />
      )}

      {toast && (
        <div className="fixed bottom-28 left-1/2 z-50 -translate-x-1/2 rounded-full bg-gray-800 px-5 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function TeamSectionHeader({ teamName, teamColor, activeCount, onTeamPlay, onEditLineup }) {
  const bg = teamColor === 'home'
    ? 'bg-blue-950/60 border-blue-900/40'
    : 'bg-orange-950/60 border-orange-900/40'
  const textColor = teamColor === 'home' ? 'text-blue-300' : 'text-orange-300'

  return (
    <div className={`sticky top-0 flex items-center justify-between border-b px-4 py-2 backdrop-blur-sm ${bg}`}>
      <div>
        <span className={`text-xs font-bold uppercase tracking-widest ${textColor}`}>{teamName}</span>
        <span className="ml-2 text-[10px] text-gray-600">{activeCount} active</span>
      </div>
      <div className="flex items-center gap-1.5">
        {onEditLineup && (
          <button
            onClick={onEditLineup}
            className="rounded-lg bg-gray-700/80 px-2 py-1 text-[10px] font-semibold text-gray-400 hover:bg-gray-700 hover:text-white transition"
          >
            ✎ Lineup
          </button>
        )}
        {onTeamPlay && (
          <button
            onClick={onTeamPlay}
            className={`rounded-lg px-3 py-1 text-[10px] font-bold transition active:scale-95 ${
              teamColor === 'home' ? 'bg-blue-800 text-blue-200 hover:bg-blue-700' : 'bg-orange-800 text-orange-200 hover:bg-orange-700'
            }`}
          >
            + Team Play
          </button>
        )}
      </div>
    </div>
  )
}

function SubSectionLabel({ label, color }) {
  return (
    <div className="bg-gray-950/90 px-4 py-1">
      <p className={`text-[10px] font-bold uppercase tracking-wider ${color}`}>{label}</p>
    </div>
  )
}

function DualPlayerRow({ entry, stats, sport, tag, tagColor, isFinal, onAction, onRemove }) {
  return (
    <div className="flex items-center gap-2 border-b border-gray-800/40 px-3 py-2.5">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-800 text-xs font-extrabold text-gray-300">
        {entry.playerNumber || entry.playerName.charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-gray-200">{entry.playerName}</p>
          {tag && <span className={`text-[9px] font-bold uppercase ${tagColor}`}>{tag}</span>}
        </div>
        <StatPills sport={sport} stats={stats} />
      </div>
      {!isFinal && (
        <>
          {onRemove && (
            <button
              onClick={onRemove}
              className="flex-shrink-0 px-1 text-xs text-gray-700 hover:text-red-400"
            >✕</button>
          )}
          <button
            onClick={onAction}
            className="flex-shrink-0 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-600 active:scale-95 transition"
          >+</button>
        </>
      )}
    </div>
  )
}

function BenchRow({ player, stats, sport, isFinal, onAction, onAddToLineup, clubId }) {
  return (
    <div className="flex items-center gap-2 border-b border-gray-800/30 px-3 py-2">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-800/60 text-xs font-bold text-gray-500">
        {player.number || player.name.charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        {player.id && clubId ? (
          <Link to={`/player/${clubId}/${player.id}`} className="block truncate text-sm font-medium text-gray-400 hover:text-blue-300 transition hover:underline">
            {player.name}
          </Link>
        ) : (
          <p className="truncate text-sm font-medium text-gray-400">{player.name}</p>
        )}
        {player.position && <p className="text-[10px] text-gray-600">{player.position}</p>}
        <StatPills sport={sport} stats={stats} />
      </div>
      {!isFinal && (
        <>
          <button
            onClick={onAddToLineup}
            className="flex-shrink-0 rounded-lg bg-gray-700/60 px-2 py-1 text-[10px] font-semibold text-gray-400 hover:bg-gray-700 hover:text-white"
          >+ Active</button>
          <button
            onClick={onAction}
            className="flex-shrink-0 rounded-lg bg-gray-800 px-2 py-1 text-[10px] font-semibold text-gray-300 hover:bg-gray-700 active:scale-95"
          >Log</button>
        </>
      )}
    </div>
  )
}
