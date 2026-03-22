import { SCORING_PLAYS, STAT_PLAYS } from '../../lib/playEventHelpers'

export default function ScoreActionSheet({
  player,
  team,
  onAction,
  onClose,
  disabled,
  scoringActions = SCORING_PLAYS,
  statActions    = STAT_PLAYS,
}) {
  const playerLabel = player
    ? `#${player.number || '—'} ${player.name}`
    : 'Team (no player)'

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/50" onClick={onClose}>
      <div
        className="rounded-t-3xl bg-gray-900 px-4 pb-safe-bottom pt-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-700" />

        {/* Player label */}
        <p className="mb-1 text-center text-sm font-semibold text-white">{playerLabel}</p>

        {/* Team label */}
        <div className="mb-4 flex justify-center">
          <TeamLabel team={team} />
        </div>

        {/* Scoring actions */}
        {scoringActions.length > 0 && (
          <>
            <p className="mb-2 text-xs uppercase tracking-wider text-gray-500">Scoring</p>
            <div className={`mb-4 grid gap-2 ${scoringActions.length <= 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
              {scoringActions.map((play) => (
                <ActionBtn
                  key={play.type}
                  label={play.label}
                  emoji={play.emoji}
                  onClick={() => onAction(play.type)}
                  disabled={disabled}
                  highlight={play.points > 0}
                />
              ))}
            </div>
          </>
        )}

        {/* Stat actions */}
        {statActions.length > 0 && (
          <>
            <p className="mb-2 text-xs uppercase tracking-wider text-gray-500">Stats</p>
            <div className={`mb-4 grid gap-2 ${statActions.length <= 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
              {statActions.map((play) => (
                <ActionBtn
                  key={play.type}
                  label={play.label}
                  emoji={play.emoji}
                  onClick={() => onAction(play.type)}
                  disabled={disabled}
                />
              ))}
            </div>
          </>
        )}

        <button
          onClick={onClose}
          className="mb-4 w-full rounded-xl bg-gray-800 py-3 text-sm text-gray-400 hover:bg-gray-700"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function ActionBtn({ label, emoji, onClick, disabled, highlight }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center gap-1 rounded-xl py-4 text-xs font-bold transition active:scale-95 disabled:opacity-40 ${
        highlight ? 'bg-blue-700 text-white hover:bg-blue-600' : 'bg-gray-800 text-gray-200 hover:bg-gray-700'
      }`}
    >
      <span className="text-xl">{emoji}</span>
      {label}
    </button>
  )
}

function TeamLabel({ team }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
      team === 'home' ? 'bg-blue-900 text-blue-300' : 'bg-orange-900 text-orange-300'
    }`}>
      {team === 'home' ? 'Home' : 'Away'}
    </span>
  )
}
