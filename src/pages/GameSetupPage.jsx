import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { createGame, getClub, getPlayers, getGame, searchClubs } from '../firebase/firestore'
import { generateUniqueJoinCode } from '../lib/generateJoinCode'
import LineupSheet from '../components/scorekeeper/baseball/LineupSheet'

const PERIOD_PRESETS = [
  { label: '4 × 10 min quarters', periods: 4, length: 600 },
  { label: '4 × 12 min quarters', periods: 4, length: 720 },
  { label: '2 × 20 min halves', periods: 2, length: 1200 },
  { label: '2 × 40 min halves', periods: 2, length: 2400 },
  { label: 'Custom', periods: null, length: null },
]

const INNING_PRESETS = [
  { label: '9 innings (standard baseball)', innings: 9 },
  { label: '7 innings (standard softball)',  innings: 7 },
  { label: 'Custom', innings: null },
]

export default function GameSetupPage() {
  const { clubId } = useParams()
  const { user } = useAuth()

  const [club, setClub] = useState(null)
  const [homeTeam, setHomeTeam] = useState('')
  const [awayTeam, setAwayTeam] = useState('')
  const [creating, setCreating] = useState(false)
  const [joinCode, setJoinCode] = useState(null)
  const [gameId, setGameId] = useState(null)
  const [freshGame, setFreshGame] = useState(null)
  const [clubPlayers, setClubPlayers] = useState([])
  const [lineupTeam, setLineupTeam] = useState(null) // 'home'|'away'|null when editing
  const [homeLineupDone, setHomeLineupDone] = useState(false)
  const [awayLineupDone, setAwayLineupDone] = useState(false)

  // Away team search
  const [awayClubId, setAwayClubId] = useState(null)
  const [awayResults, setAwayResults] = useState([])
  const [awaySearching, setAwaySearching] = useState(false)
  const awaySearchTimer = useRef(null)

  // Basketball state
  const [preset, setPreset] = useState(0)
  const [customPeriods, setCustomPeriods] = useState(4)
  const [customMins, setCustomMins] = useState(10)

  // Baseball/softball state
  const [inningPreset, setInningPreset] = useState(0)
  const [customInnings, setCustomInnings] = useState(9)

  useEffect(() => {
    getClub(clubId).then((data) => {
      setClub(data)
      if (data?.sport === 'softball') setInningPreset(1)
    })
  }, [clubId])

  const sport = club?.sport || 'basketball'
  const isBaseball = sport === 'baseball' || sport === 'softball'

  const selectedPreset = PERIOD_PRESETS[preset]
  const periods = selectedPreset.periods ?? customPeriods
  const periodLength = selectedPreset.length ?? customMins * 60

  const selectedInningPreset = INNING_PRESETS[inningPreset]
  const totalInnings = selectedInningPreset.innings ?? customInnings

  function handleAwayChange(val) {
    setAwayTeam(val)
    setAwayClubId(null)
    setAwayResults([])
    clearTimeout(awaySearchTimer.current)
    if (val.trim().length < 2) return
    awaySearchTimer.current = setTimeout(async () => {
      setAwaySearching(true)
      try {
        const results = await searchClubs(val)
        setAwayResults(results.filter((c) => c.sport === sport))
      } finally {
        setAwaySearching(false)
      }
    }, 300)
  }

  function selectAwayClub(club) {
    setAwayTeam(club.name)
    setAwayClubId(club.id)
    setAwayResults([])
  }

  async function handleCreate(e) {
    e.preventDefault()
    setCreating(true)
    try {
      const code = await generateUniqueJoinCode()
      const id = await createGame(clubId, {
        homeTeam: homeTeam.trim(),
        awayTeam: awayTeam.trim(),
        awayClubId,
        sport,
        totalPeriods: isBaseball ? null : periods,
        periodLength: isBaseball ? null : periodLength,
        totalInnings: isBaseball ? totalInnings : null,
        joinCode: code,
        scorekeeperId: user.uid,
      })
      const [players, gameDoc] = await Promise.all([
        getPlayers(clubId),
        getGame(id),
      ])
      setClubPlayers(players)
      setFreshGame(gameDoc)
      setJoinCode(code)
      setGameId(id)
    } finally {
      setCreating(false)
    }
  }

  if (joinCode && gameId) {
    const shareUrl = `${window.location.origin}/game/${gameId}`
    return (
      <div className="min-h-screen bg-gray-950 px-5 pb-20 pt-10">
        <div className="mx-auto w-full max-w-sm space-y-4">

          {/* Join code */}
          <div className="card text-center">
            <p className="mb-2 text-sm text-gray-400">Join Code</p>
            <p className="font-mono text-5xl font-extrabold tracking-widest text-blue-400">{joinCode}</p>
            <p className="mt-2 text-xs text-gray-500">Share so fans can follow along</p>
          </div>

          {/* Share link */}
          <div className="card">
            <p className="mb-1 text-xs text-gray-400">Public game link</p>
            <p className="break-all text-xs text-blue-400">{shareUrl}</p>
            <button onClick={() => navigator.clipboard.writeText(shareUrl)} className="mt-2 text-xs text-gray-500 hover:text-white">
              Copy link
            </button>
          </div>

          {/* Lineup setup */}
          <div className="card space-y-3">
            <div>
              <p className="font-semibold text-white">Set Starting Lineups</p>
              <p className="text-xs text-gray-500 mt-0.5">Optional — you can also set them from the scorekeeper</p>
            </div>

            <button
              onClick={() => setLineupTeam('home')}
              className={`flex w-full items-center justify-between rounded-xl px-4 py-3 transition ${
                homeLineupDone ? 'bg-green-900/30 text-green-300' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <span className="font-semibold">{homeTeam}</span>
              <span className="text-sm">{homeLineupDone ? '✓ Set' : '📋 Set Lineup →'}</span>
            </button>

            <button
              onClick={() => setLineupTeam('away')}
              className={`flex w-full items-center justify-between rounded-xl px-4 py-3 transition ${
                awayLineupDone ? 'bg-green-900/30 text-green-300' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <span className="font-semibold">{awayTeam}</span>
              <span className="text-sm">{awayLineupDone ? '✓ Set' : '📋 Set Lineup →'}</span>
            </button>
          </div>

          <Link to={`/scorekeeper/${gameId}`} className="btn-primary block text-center">
            Open Scorekeeper →
          </Link>

          <Link to={`/club/${clubId}`} className="block text-center text-sm text-gray-500 hover:text-white">
            Back to club
          </Link>
        </div>

        {/* LineupSheet overlay */}
        {lineupTeam && freshGame && (
          <LineupSheet
            gameId={gameId}
            game={freshGame}
            players={lineupTeam === 'home' ? clubPlayers : []}
            team={lineupTeam}
            sport={sport}
            onClose={async () => {
              if (lineupTeam === 'home') setHomeLineupDone(true)
              else setAwayLineupDone(true)
              setLineupTeam(null)
              // Refresh game so re-opening a lineup shows current state
              const updated = await getGame(gameId)
              setFreshGame(updated)
            }}
          />
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 pb-20">
      <header className="flex items-center gap-4 px-5 py-5">
        <Link to={`/club/${clubId}`} className="text-gray-400 hover:text-white">← Back</Link>
        <div>
          <h1 className="text-xl font-bold text-white">New Game</h1>
          {club && <p className="text-sm capitalize text-gray-500">{club.sport}</p>}
        </div>
      </header>

      <main className="mx-auto max-w-lg px-5">
        <form onSubmit={handleCreate} className="flex flex-col gap-6">
          <div className="card space-y-4">
            <h2 className="font-semibold text-white">Teams</h2>
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">Home team</label>
              <input
                type="text"
                placeholder={club?.name || 'Your team name'}
                value={homeTeam}
                onChange={(e) => setHomeTeam(e.target.value)}
                required
                className="input"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">Away team (opponent)</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search or type opponent name"
                  value={awayTeam}
                  onChange={(e) => handleAwayChange(e.target.value)}
                  required
                  className="input pr-8"
                />
                {awayClubId && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-blue-400">✓ linked</span>
                )}
                {awaySearching && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">…</span>
                )}
              </div>
              {awayResults.length > 0 && (
                <div className="mt-1 rounded-xl border border-gray-700 bg-gray-900 shadow-lg">
                  {awayResults.map((club) => (
                    <button
                      key={club.id}
                      type="button"
                      onClick={() => selectAwayClub(club)}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-white hover:bg-gray-800 first:rounded-t-xl last:rounded-b-xl"
                    >
                      <span className="font-semibold">{club.name}</span>
                      <span className="ml-auto text-xs capitalize text-gray-500">{club.sport}</span>
                    </button>
                  ))}
                  <p className="px-4 py-2 text-xs text-gray-600 border-t border-gray-800">
                    Don't see them? Keep typing to use their name without linking.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="card space-y-4">
            <h2 className="font-semibold text-white">Game Format</h2>

            {isBaseball ? (
              <>
                <div className="grid grid-cols-1 gap-2">
                  {INNING_PRESETS.map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setInningPreset(i)}
                      className={`rounded-xl px-4 py-3 text-left text-sm transition ${
                        inningPreset === i
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {selectedInningPreset.innings === null && (
                  <div>
                    <label className="mb-1 block text-xs text-gray-400">Total innings</label>
                    <input
                      type="number"
                      min={1}
                      max={15}
                      value={customInnings}
                      onChange={(e) => setCustomInnings(Number(e.target.value))}
                      className="input"
                    />
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-2">
                  {PERIOD_PRESETS.map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPreset(i)}
                      className={`rounded-xl px-4 py-3 text-left text-sm transition ${
                        preset === i
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {selectedPreset.periods === null && (
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="mb-1 block text-xs text-gray-400">Periods</label>
                      <input
                        type="number"
                        min={1}
                        max={8}
                        value={customPeriods}
                        onChange={(e) => setCustomPeriods(Number(e.target.value))}
                        className="input"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-1 block text-xs text-gray-400">Minutes each</label>
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={customMins}
                        onChange={(e) => setCustomMins(Number(e.target.value))}
                        className="input"
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <button
            type="submit"
            disabled={creating || !homeTeam.trim() || !awayTeam.trim()}
            className="btn-primary"
          >
            {creating ? 'Creating game…' : 'Create Game & Get Join Code'}
          </button>
        </form>
      </main>
    </div>
  )
}
