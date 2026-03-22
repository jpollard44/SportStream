import { BB_HIT_PLAYS, BB_OUT_PLAYS, BB_OTHER_PLAYS } from '../../../lib/baseballHelpers'

export default function BaseballActionSheet({ player, game, onAction, onClose, disabled }) {
  const battingTeam = game.inningHalf === 'top' ? 'away' : 'home'
  const teamName = battingTeam === 'home' ? game.homeTeam : game.awayTeam
  const playerLabel = player ? `#${player.number || '—'} ${player.nickname?.trim() || player.name}` : 'Team play'

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/50" onClick={onClose}>
      <div
        className="max-h-[80vh] overflow-y-auto rounded-t-3xl bg-gray-900 px-4 pb-8 pt-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-700" />

        <p className="mb-0.5 text-center text-sm font-semibold text-white">{playerLabel}</p>
        <p className="mb-4 text-center text-xs text-gray-500">
          {teamName} batting ({battingTeam})
        </p>

        {/* At-bat results: hits */}
        <p className="mb-2 text-xs uppercase tracking-wider text-gray-500">Hits & On-base</p>
        <div className="mb-4 grid grid-cols-3 gap-2">
          {BB_HIT_PLAYS.map((play) => (
            <ActionBtn
              key={play.type}
              label={play.label}
              emoji={play.emoji}
              onClick={() => onAction(play.type)}
              disabled={disabled}
              highlight={play.isHit}
            />
          ))}
        </div>

        {/* At-bat results: outs */}
        <p className="mb-2 text-xs uppercase tracking-wider text-gray-500">Outs</p>
        <div className="mb-4 grid grid-cols-3 gap-2">
          {BB_OUT_PLAYS.map((play) => (
            <ActionBtn
              key={play.type}
              label={play.label}
              emoji={play.emoji}
              onClick={() => onAction(play.type)}
              disabled={disabled}
              danger
            />
          ))}
        </div>

        {/* Baserunning & misc */}
        <p className="mb-2 text-xs uppercase tracking-wider text-gray-500">Baserunning & Misc</p>
        <div className="mb-4 grid grid-cols-3 gap-2">
          {BB_OTHER_PLAYS.map((play) => (
            <ActionBtn
              key={play.type}
              label={play.label}
              emoji={play.emoji}
              onClick={() => onAction(play.type)}
              disabled={disabled}
              danger={play.isOut}
            />
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full rounded-xl bg-gray-800 py-3 text-sm text-gray-400 hover:bg-gray-700"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function ActionBtn({ label, emoji, onClick, disabled, highlight, danger }) {
  const colors = highlight
    ? 'bg-blue-700 text-white hover:bg-blue-600'
    : danger
    ? 'bg-red-900/60 text-red-200 hover:bg-red-800'
    : 'bg-gray-800 text-gray-200 hover:bg-gray-700'

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center gap-1 rounded-xl py-3 text-xs font-bold transition active:scale-95 disabled:opacity-40 ${colors}`}
    >
      <span className="text-lg">{emoji}</span>
      {label}
    </button>
  )
}
