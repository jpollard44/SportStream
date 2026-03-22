import { useState } from 'react'
import { undoPlay } from '../../firebase/firestore'
import { BB_OUT_TYPES } from '../../lib/baseballHelpers'

export default function UndoButton({ game, gameId, plays }) {
  const [undoing, setUndoing] = useState(false)

  const lastPlay = game?.lastPlayId && !game?.lastPlayUndone
    ? plays.find((p) => p.id === game.lastPlayId)
    : null

  async function handleUndo() {
    if (!lastPlay || undoing) return
    setUndoing(true)
    try {
      const isBaseball = game.sport === 'baseball' || game.sport === 'softball'
      const outsToRevert = isBaseball && BB_OUT_TYPES.has(lastPlay.type) ? 1 : 0
      await undoPlay(gameId, lastPlay.id, lastPlay.scoreDelta, outsToRevert)
    } finally {
      setUndoing(false)
    }
  }

  return (
    <button
      onClick={handleUndo}
      disabled={!lastPlay || undoing}
      className={`flex items-center gap-1.5 rounded-xl px-4 py-3 text-sm font-semibold transition active:scale-95 ${
        lastPlay
          ? 'bg-yellow-700 text-white hover:bg-yellow-600'
          : 'bg-gray-800 text-gray-600'
      }`}
    >
      <span>↩</span>
      <span>Undo</span>
      {lastPlay && (
        <span className="max-w-[80px] truncate text-xs font-normal opacity-80">
          {lastPlay.playerName?.split(' ')[0]}
        </span>
      )}
    </button>
  )
}
