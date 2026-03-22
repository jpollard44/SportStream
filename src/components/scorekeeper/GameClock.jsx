import { formatClock, periodLabel } from '../../lib/formatters'

export default function GameClock({ game, displaySeconds, onStart, onPause, onNextPeriod }) {
  if (!game) return null

  const isRunning = game.clockRunning
  const isFinal = game.status === 'final'
  const isLastPeriod = game.period >= game.totalPeriods
  const timeDisplay = formatClock(displaySeconds, game.periodLength)
  const isExpired = displaySeconds >= game.periodLength

  return (
    <div className="flex items-center justify-between bg-gray-800 px-4 py-3">
      {/* Clock */}
      <div>
        <p className={`font-mono text-3xl font-extrabold tabular-nums ${isExpired ? 'text-red-400' : 'text-white'}`}>
          {timeDisplay}
        </p>
        <p className="text-xs text-gray-500">{periodLabel(game.period, game.totalPeriods)}</p>
      </div>

      {/* Controls */}
      {!isFinal && (
        <div className="flex gap-2">
          {isRunning ? (
            <button
              onClick={onPause}
              className="rounded-lg bg-yellow-600 px-4 py-2 text-sm font-bold text-white hover:bg-yellow-500"
            >
              ⏸ Pause
            </button>
          ) : (
            <button
              onClick={onStart}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-500"
            >
              ▶ {game.status === 'setup' ? 'Start' : 'Resume'}
            </button>
          )}

          {isExpired && !isRunning && (
            <button
              onClick={onNextPeriod}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-500"
            >
              {isLastPeriod ? 'End Game' : 'Next Period →'}
            </button>
          )}
        </div>
      )}

      {isFinal && (
        <span className="rounded-lg bg-gray-700 px-3 py-2 text-sm font-bold text-gray-300">FINAL</span>
      )}
    </div>
  )
}
