import { useEffect } from 'react'
import { useVoiceInput } from '../../hooks/useVoiceInput'
import { PLAY_LABELS } from '../../lib/playEventHelpers'
import { BB_PLAY_LABELS } from '../../lib/baseballHelpers'

/**
 * Hold-to-speak button. Parses speech → shows confirm bubble → calls onConfirm(playType, player).
 */
export default function VoiceButton({ players, sport, onConfirm }) {
  const { supported, listening, result, startListening, stopListening, clearResult } = useVoiceInput({ players, sport })

  // Auto-dismiss unresolved result after 6 seconds
  useEffect(() => {
    if (!result) return
    const t = setTimeout(clearResult, 6000)
    return () => clearTimeout(t)
  }, [result, clearResult])

  if (!supported) return null

  const allLabels = { ...PLAY_LABELS, ...BB_PLAY_LABELS }

  function handleConfirm() {
    if (!result?.playType) return
    onConfirm(result.playType, result.player || null)
    clearResult()
  }

  return (
    <div className="relative flex flex-col items-center">
      {/* Confirm bubble */}
      {result && (
        <div className="absolute bottom-14 left-1/2 z-50 w-56 -translate-x-1/2 rounded-2xl bg-gray-800 p-3 shadow-xl ring-1 ring-gray-700">
          <p className="mb-0.5 text-xs text-gray-400">Did you mean?</p>
          <p className="mb-2 text-sm font-semibold text-white">
            {result.player ? `#${result.player.number || '?'} ${result.player.name} — ` : 'Team — '}
            {result.playType ? allLabels[result.playType] || result.playType : <span className="text-red-400">No match</span>}
          </p>
          <p className="mb-3 truncate text-xs italic text-gray-500">"{result.transcript}"</p>
          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              disabled={!result.playType}
              className="flex-1 rounded-xl bg-blue-600 py-2 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-40"
            >
              ✓ Log it
            </button>
            <button
              onClick={clearResult}
              className="flex-1 rounded-xl bg-gray-700 py-2 text-xs text-gray-300 hover:bg-gray-600"
            >
              ✗ Cancel
            </button>
          </div>
        </div>
      )}

      {/* Mic button — hold to speak */}
      <button
        onPointerDown={startListening}
        onPointerUp={stopListening}
        onPointerLeave={stopListening}
        className={`flex h-12 w-12 items-center justify-center rounded-full text-xl transition active:scale-90 ${
          listening
            ? 'animate-pulse bg-red-600 text-white shadow-lg shadow-red-900'
            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
        }`}
        title="Hold to speak"
      >
        🎙
      </button>
    </div>
  )
}
