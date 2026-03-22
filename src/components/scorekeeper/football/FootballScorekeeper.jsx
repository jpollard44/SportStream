import { useState } from 'react'
import { addPlay, updateGame } from '../../../firebase/firestore'
import { Link } from 'react-router-dom'

const SCORING_ACTIONS = [
  { type: 'touchdown',   label: 'Touchdown',    emoji: '🏈', points: 6 },
  { type: 'field_goal',  label: 'Field Goal',   emoji: '🎯', points: 3 },
  { type: 'extra_point', label: 'Extra Point',   emoji: '+1', points: 1 },
  { type: 'safety',      label: 'Safety',        emoji: '🛡', points: 2 },
]

const STAT_ACTIONS = [
  { type: 'rush_yard',     label: 'Rush Yd',     emoji: '🏃', points: 0, statKey: 'rushYards',   statLabel: '+1 yd' },
  { type: 'pass_yard',     label: 'Pass Yd',      emoji: '💨', points: 0, statKey: 'passYards',   statLabel: '+1 yd' },
  { type: 'reception',     label: 'Reception',    emoji: '🤝', points: 0, statKey: 'receptions',  statLabel: 'REC' },
  { type: 'interception',  label: 'Interception', emoji: '✋', points: 0, statKey: null,           statLabel: 'INT' },
  { type: 'sack',          label: 'Sack',         emoji: '💥', points: 0, statKey: null,           statLabel: 'SACK' },
  { type: 'flag_pulled',   label: 'Flag Pull',    emoji: '🚩', points: 0, statKey: null,           statLabel: 'FLAG' },
]

function computeFootballStats(plays) {
  const stats = {}
  for (const play of plays) {
    if (!play.playerId) continue
    if (!stats[play.playerId]) {
      stats[play.playerId] = {
        id: play.playerId, name: play.playerName, number: play.playerNumber,
        team: play.team, tds: 0, fgs: 0, rushYards: 0, passYards: 0, receptions: 0, ints: 0,
      }
    }
    const s = stats[play.playerId]
    if (play.type === 'touchdown')    s.tds++
    if (play.type === 'field_goal')   s.fgs++
    if (play.type === 'rush_yard')    s.rushYards++
    if (play.type === 'pass_yard')    s.passYards++
    if (play.type === 'reception')    s.receptions++
    if (play.type === 'interception') s.ints++
  }
  return Object.values(stats)
}

export default function FootballScorekeeper({ game, plays, players, user }) {
  const [activeTeam, setActiveTeam] = useState('home')
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [saving, setSaving] = useState(false)
  const [quarter, setQuarter] = useState(game.period || 1)

  const teamPlayers = players.filter((p) => p.active !== false)
  const stats = computeFootballStats(plays)
  const homeStats = stats.filter((s) => s.team === 'home')
  const awayStats = stats.filter((s) => s.team === 'away')

  async function handleAction(action) {
    if (!selectedPlayer || saving) return
    setSaving(true)
    try {
      const playEvent = {
        type: action.type,
        team: activeTeam,
        playerId: selectedPlayer.id,
        playerName: selectedPlayer.name,
        playerNumber: selectedPlayer.number || '',
        points: action.points,
        scoreDelta: action.points > 0
          ? { home: activeTeam === 'home' ? action.points : 0, away: activeTeam === 'away' ? action.points : 0 }
          : null,
        period: quarter,
        createdBy: user.uid,
      }
      await addPlay(game.id, playEvent)
      setSelectedPlayer(null)
    } finally {
      setSaving(false)
    }
  }

  async function handleSetQuarter(q) {
    setQuarter(q)
    await updateGame(game.id, { period: q })
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-950 text-white pb-52">
      {/* Score header */}
      <div className="bg-gray-900 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{game.homeTeam}</p>
            <p className="font-mono text-5xl font-extrabold text-white">{game.homeScore}</p>
          </div>
          <div className="flex flex-col items-center px-4">
            <p className="text-sm font-bold text-gray-400">Q{quarter}</p>
            <div className="mt-2 flex gap-1">
              {[1, 2, 3, 4].map((q) => (
                <button
                  key={q}
                  onClick={() => handleSetQuarter(q)}
                  className={`h-8 w-8 rounded-full text-xs font-bold transition ${
                    quarter === q ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  Q{q}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{game.awayTeam}</p>
            <p className="font-mono text-5xl font-extrabold text-white">{game.awayScore}</p>
          </div>
        </div>
      </div>

      {/* Team toggle */}
      <div className="flex gap-2 px-5 py-3">
        {[
          { id: 'home', label: game.homeTeam },
          { id: 'away', label: game.awayTeam },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => { setActiveTeam(id); setSelectedPlayer(null) }}
            className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition ${
              activeTeam === id ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Player grid */}
      <div className="flex-1 px-5">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">Select Player</p>
        <div className="grid grid-cols-3 gap-2">
          {teamPlayers.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPlayer(selectedPlayer?.id === p.id ? null : p)}
              className={`rounded-xl p-3 text-center transition ${
                selectedPlayer?.id === p.id
                  ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <p className="text-lg font-extrabold">{p.number || '—'}</p>
              <p className="mt-0.5 truncate text-[10px]">{p.name.split(' ')[0]}</p>
            </button>
          ))}
          <button
            onClick={() => setSelectedPlayer({ id: null, name: 'Team', number: '' })}
            className={`rounded-xl p-3 text-center transition ${
              selectedPlayer?.id === null
                ? 'bg-gray-600 text-white ring-2 ring-gray-400'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <p className="text-lg font-extrabold">—</p>
            <p className="mt-0.5 text-[10px]">Team</p>
          </button>
        </div>
      </div>

      {/* Action sheet — fixed bottom */}
      {selectedPlayer && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-gray-800 bg-gray-900 p-4">
          <p className="mb-2 text-center text-sm font-semibold text-white">
            {selectedPlayer.name}{selectedPlayer.number ? ` #${selectedPlayer.number}` : ''}
          </p>
          <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-wider text-gray-500">Scoring</p>
          <div className="mb-3 grid grid-cols-4 gap-2">
            {SCORING_ACTIONS.map((action) => (
              <button
                key={action.type}
                onClick={() => handleAction(action)}
                disabled={saving}
                className="flex flex-col items-center rounded-xl bg-blue-900/40 p-2.5 text-center transition hover:bg-blue-800/60 active:scale-95 disabled:opacity-50"
              >
                <span className="text-xl">{action.emoji}</span>
                <span className="mt-0.5 text-[9px] font-bold text-blue-300">{action.label}</span>
                <span className="text-[9px] text-blue-400">+{action.points}</span>
              </button>
            ))}
          </div>
          <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-wider text-gray-500">Stats</p>
          <div className="grid grid-cols-3 gap-2">
            {STAT_ACTIONS.map((action) => (
              <button
                key={action.type}
                onClick={() => handleAction(action)}
                disabled={saving}
                className="flex flex-col items-center rounded-xl bg-gray-800 p-2.5 text-center transition hover:bg-gray-700 active:scale-95 disabled:opacity-50"
              >
                <span className="text-xl">{action.emoji}</span>
                <span className="mt-0.5 text-[9px] font-semibold text-gray-300">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stats table */}
      {plays.length > 0 && (
        <div className="px-5 pt-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">Stats</p>
          {[{ label: game.homeTeam, rows: homeStats }, { label: game.awayTeam, rows: awayStats }].map(({ label, rows }) =>
            rows.length > 0 ? (
              <div key={label} className="mb-4">
                <p className="mb-1 text-xs font-bold text-gray-400">{label}</p>
                <div className="overflow-x-auto rounded-xl bg-gray-900">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-600">
                        <th className="px-3 py-2 text-left">Player</th>
                        <th className="px-2 py-2 text-center">TD</th>
                        <th className="px-2 py-2 text-center">FG</th>
                        <th className="px-2 py-2 text-center">Rush</th>
                        <th className="px-2 py-2 text-center">Pass</th>
                        <th className="px-2 py-2 text-center">REC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((s) => (
                        <tr key={s.id} className="border-t border-gray-800 text-white">
                          <td className="px-3 py-2 text-blue-400">
                            {s.number ? `#${s.number} ` : ''}{s.name.split(' ')[0]}
                          </td>
                          <td className="px-2 py-2 text-center font-bold text-blue-300">{s.tds}</td>
                          <td className="px-2 py-2 text-center text-gray-400">{s.fgs}</td>
                          <td className="px-2 py-2 text-center text-gray-400">{s.rushYards}</td>
                          <td className="px-2 py-2 text-center text-gray-400">{s.passYards}</td>
                          <td className="px-2 py-2 text-center text-gray-400">{s.receptions}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null
          )}
        </div>
      )}
    </div>
  )
}
