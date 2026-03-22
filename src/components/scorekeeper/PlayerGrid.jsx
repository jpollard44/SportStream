export default function PlayerGrid({ players, selectedId, onSelect, teamStats }) {
  const teamPlayers = players // Show all players in roster

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Tap player → choose action</p>
        {selectedId && (
          <button
            onClick={() => onSelect(null)}
            className="text-xs text-gray-500 hover:text-white"
          >
            Deselect
          </button>
        )}
      </div>

      {players.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-gray-500 text-sm">No players on roster.</p>
          <p className="text-gray-600 text-xs">Add players in the club page to track per-player stats.</p>
          {/* Team-level scoring still available via the action sheet */}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {teamPlayers.map((player) => {
            const isSelected = selectedId === player.id
            return (
              <button
                key={player.id}
                onClick={() => onSelect(isSelected ? null : player.id)}
                className={`flex flex-col items-center justify-center rounded-2xl p-3 transition active:scale-95 ${
                  isSelected
                    ? 'bg-blue-600 ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-950'
                    : 'bg-gray-800 hover:bg-gray-700'
                }`}
              >
                {/* Avatar */}
                <div className={`mb-1.5 flex h-12 w-12 items-center justify-center rounded-full text-lg font-extrabold ${
                  isSelected ? 'bg-blue-400 text-blue-900' : 'bg-gray-700 text-gray-300'
                }`}>
                  {player.number || player.name.charAt(0).toUpperCase()}
                </div>

                {player.nickname ? (
                  <>
                    <p className={`w-full truncate text-center text-xs font-bold ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                      "{player.nickname}"
                    </p>
                    <p className={`w-full truncate text-center text-[9px] ${isSelected ? 'text-blue-200' : 'text-gray-500'}`}>
                      {player.name.split(' ')[0]}
                    </p>
                  </>
                ) : (
                  <p className={`w-full truncate text-center text-xs font-semibold ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                    {player.name.split(' ')[0]}
                  </p>
                )}

                {/* Points badge */}
                {(teamStats?.[player.id]?.points || 0) > 0 && (
                  <p className={`mt-0.5 text-xs font-bold ${isSelected ? 'text-blue-200' : 'text-yellow-400'}`}>
                    {teamStats[player.id].points} pts
                  </p>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
