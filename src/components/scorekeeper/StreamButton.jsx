import { useStream } from '../../hooks/useStream'

export default function StreamButton({ gameId }) {
  const { streaming, error, startStream, stopStream, localVideoRef } = useStream(gameId)

  return (
    <div className="flex flex-col items-end gap-2">
      {/* Local camera preview */}
      {streaming && (
        <div className="relative overflow-hidden rounded-xl bg-black shadow-lg"
          style={{ width: 96, height: 54 }}>
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="h-full w-full object-cover"
          />
          <div className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-red-600 px-1.5 py-0.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            <span className="text-[10px] font-bold text-white">LIVE</span>
          </div>
        </div>
      )}

      {error && (
        <p className="max-w-[160px] text-right text-xs text-red-400">{error}</p>
      )}

      <button
        onClick={streaming ? stopStream : startStream}
        className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition active:scale-95 ${
          streaming
            ? 'bg-red-700 text-white hover:bg-red-600'
            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
        }`}
      >
        {streaming ? '⏹ Stop' : '📡 Stream'}
      </button>
    </div>
  )
}
