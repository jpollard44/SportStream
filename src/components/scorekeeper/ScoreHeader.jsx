import { periodLabel } from '../../lib/formatters'

export default function ScoreHeader({ game, onEditScore }) {
  if (!game) return null

  const label = periodLabel(game.period, game.totalPeriods)
  const isFinal = game.status === 'final'
  const canEdit = !!onEditScore && !isFinal

  return (
    <div className="flex items-center justify-between bg-gray-900 px-4 py-3">
      {/* Home */}
      <div className="flex-1 text-center">
        <p className="truncate text-xs font-medium uppercase tracking-wider text-gray-400">{game.homeTeam}</p>
        <button
          onClick={() => canEdit && onEditScore('home')}
          className={`font-mono text-5xl font-extrabold text-white ${canEdit ? 'active:opacity-70' : ''}`}
        >
          {game.homeScore}
        </button>
        {canEdit && <p className="text-[9px] text-gray-600">tap to edit</p>}
      </div>

      {/* Period */}
      <div className="px-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">{label}</p>
        <StatusDot status={game.status} />
      </div>

      {/* Away */}
      <div className="flex-1 text-center">
        <p className="truncate text-xs font-medium uppercase tracking-wider text-gray-400">{game.awayTeam}</p>
        <button
          onClick={() => canEdit && onEditScore('away')}
          className={`font-mono text-5xl font-extrabold text-white ${canEdit ? 'active:opacity-70' : ''}`}
        >
          {game.awayScore}
        </button>
        {canEdit && <p className="text-[9px] text-gray-600">tap to edit</p>}
      </div>
    </div>
  )
}

function StatusDot({ status }) {
  if (status === 'live') {
    return <div className="mx-auto mt-1 h-2 w-2 animate-pulse rounded-full bg-red-500" />
  }
  if (status === 'final') {
    return <p className="text-xs font-bold text-gray-400">FINAL</p>
  }
  return <div className="mx-auto mt-1 h-2 w-2 rounded-full bg-gray-600" />
}
