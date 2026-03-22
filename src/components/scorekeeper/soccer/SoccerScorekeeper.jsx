import { useState } from 'react'
import { addPlay, updateGame } from '../../../firebase/firestore'
import { Link } from 'react-router-dom'

const SOCCER_ACTIONS = [
  { type: 'goal',        label: 'Goal',        emoji: '⚽', points: 1 },
  { type: 'assist',      label: 'Assist',       emoji: '🤝', points: 0 },
  { type: 'shot',        label: 'Shot on Goal', emoji: '🎯', points: 0 },
  { type: 'yellow_card', label: 'Yellow Card',  emoji: '🟨', points: 0 },
  { type: 'red_card',    label: 'Red Card',     emoji: '🟥', points: 0 },
  { type: 'foul',        label: 'Foul',         emoji: '⚠',  points: 0 },
]

function computeSoccerStats(plays) {
  const stats = {}
  for (const play of plays) {
    if (!play.playerId) continue
    if (!stats[play.playerId]) {
      stats[play.playerId] = {
        id: play.playerId, name: play.playerName, number: play.playerNumber,
        team: play.team, goals: 0, assists: 0, shots: 0, yellows: 0, reds: 0,
      }
    }
    const s = stats[play.playerId]
    if (play.type === 'goal')        s.goals++
    if (play.type === 'assist')      s.assists++
    if (play.type === 'shot')        s.shots++
    if (play.type === 'yellow_card') s.yellows++
    if (play.type === 'red_card')    s.reds++
  }
  return Object.values(stats)
}

export default function SoccerScorekeeper({ game, plays, players, user }) {
  const [activeTeam, setActiveTeam] = useState('home')
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [saving, setSaving] = useState(false)
  const [half, setHalf] = useState(game.period || 1)

  const teamPlayers = players.filter((p) => p.active !== false)
  const stats = computeSoccerStats(plays)
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
        period: half,
        createdBy: user.uid,
      }
      await addPlay(game.id, playEvent)
      setSelectedPlayer(null)
    } finally {
      setSaving(false)
    }
  }

  async function handleSetHalf(h) {
    setHalf(h)
    await updateGame(game.id, { period: h })
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-950 text-white pb-48">
      {/* Score header */}
      <div className="bg-gray-900 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{game.homeTeam}</p>
            <p className="font-mono text-5xl font-extrabold text-white">{game.homeScore}</p>
          </div>
          <div className="flex flex-col items-center px-4">
            <p className="text-sm font-bold text-gray-400">{half === 1 ? '1st Half' : '2nd Half'}</p>
            <div className="mt-2 flex gap-2">
              {[1, 2].map((h) => (
                <button
                  key={h}
                  onClick={() => handleSetHalf(h)}
                  className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                    half === h ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {h === 1 ? '1st' : '2nd'}
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
          {/* No player option */}
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

      {/* Action buttons — fixed bottom */}
      {selectedPlayer && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-gray-800 bg-gray-900 p-4">
          <p className="mb-2 text-center text-sm font-semibold text-white">
            {selectedPlayer.name} {selectedPlayer.number ? `#${selectedPlayer.number}` : ''}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {SOCCER_ACTIONS.map((action) => (
              <button
                key={action.type}
                onClick={() => handleAction(action)}
                disabled={saving}
                className="flex flex-col items-center rounded-xl bg-gray-800 p-3 text-center transition hover:bg-gray-700 active:scale-95 disabled:opacity-50"
              >
                <span className="text-2xl">{action.emoji}</span>
                <span className="mt-1 text-[10px] font-semibold text-gray-300">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stats table */}
      {plays.length > 0 && (
        <div className="px-5 pt-6">
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
                        <th className="px-2 py-2 text-center">G</th>
                        <th className="px-2 py-2 text-center">A</th>
                        <th className="px-2 py-2 text-center">SH</th>
                        <th className="px-2 py-2 text-center">YC</th>
                        <th className="px-2 py-2 text-center">RC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((s) => (
                        <tr key={s.id} className="border-t border-gray-800 text-white">
                          <td className="px-3 py-2">
                            <Link to={`/player/${game.clubId || ''}/${s.id}`} className="text-blue-400 hover:text-blue-300">
                              {s.number ? `#${s.number} ` : ''}{s.name.split(' ')[0]}
                            </Link>
                          </td>
                          <td className="px-2 py-2 text-center font-bold">{s.goals}</td>
                          <td className="px-2 py-2 text-center text-gray-400">{s.assists}</td>
                          <td className="px-2 py-2 text-center text-gray-400">{s.shots}</td>
                          <td className="px-2 py-2 text-center">{s.yellows > 0 ? <span className="text-yellow-400">{s.yellows}</span> : '—'}</td>
                          <td className="px-2 py-2 text-center">{s.reds > 0 ? <span className="text-red-400">{s.reds}</span> : '—'}</td>
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
