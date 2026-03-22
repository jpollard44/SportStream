import { describePlay } from '../../lib/playEventHelpers'
import { describeBaseballPlay } from '../../lib/baseballHelpers'
import { formatClock, periodLabel, inningLabel } from '../../lib/formatters'

export default function PlayByPlayFeed({ plays, game }) {
  if (!plays.length) {
    return (
      <div className="py-10 text-center text-sm text-gray-500">
        No plays yet — game hasn't started.
      </div>
    )
  }

  const isBaseball = game?.sport === 'baseball' || game?.sport === 'softball'

  return (
    <div className="flex flex-col divide-y divide-gray-800">
      {plays.map((play) => (
        <PlayItem key={play.id} play={play} game={game} isBaseball={isBaseball} />
      ))}
    </div>
  )
}

function PlayItem({ play, game, isBaseball }) {
  const isHome = play.team === 'home'

  const label = isBaseball ? describeBaseballPlay(play) : describePlay(play)

  const locationText = isBaseball
    ? inningLabel(play.inning ?? game?.inning, play.inningHalf ?? game?.inningHalf)
    : `${periodLabel(play.period, game?.totalPeriods)} · ${formatClock(play.clockAtPlay || 0, game?.periodLength)}`

  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${isHome ? '' : 'flex-row-reverse'}`}>
      <div className={`h-2 w-2 flex-shrink-0 rounded-full ${isHome ? 'bg-blue-500' : 'bg-orange-400'}`} />
      <div className={`flex-1 ${isHome ? 'text-left' : 'text-right'}`}>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-gray-500">{locationText}</p>
      </div>
      {play.points > 0 && (
        <span className="rounded-full bg-green-900/60 px-2 py-0.5 text-xs font-bold text-green-300">
          {isBaseball ? '1 R' : `+${play.points}`}
        </span>
      )}
    </div>
  )
}
