import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * Viewer-side stream component.
 * Connects to the broadcaster (scorekeeper) PeerJS peer.
 */
export default function StreamViewer({ peerId }) {
  const videoRef  = useRef(null)
  const peerRef   = useRef(null)
  const ctxRef    = useRef(null)
  const [connected, setConnected] = useState(false)
  const [error, setError]         = useState(null)
  const [muted, setMuted]         = useState(true)
  const [retryKey, setRetryKey]   = useState(0)
  const [rotation, setRotation]   = useState(0) // 0 = normal, 90 = rotated CW

  const connect = useCallback(async () => {
    if (!peerId) return
    setError(null)
    setConnected(false)

    // Clean up any previous peer
    peerRef.current?.destroy()
    peerRef.current = null

    let destroyed = false

    try {
      const { Peer } = await import('peerjs')
      const peer = new Peer()
      peerRef.current = peer

      peer.on('open', () => {
        if (destroyed) return

        // Build an outgoing stream with both audio + video tracks so WebRTC
        // SDP includes m=audio AND m=video, allowing us to receive video back.
        let silentStream
        try {
          const AudioContext = window.AudioContext || window.webkitAudioContext
          const ctx = new AudioContext()
          ctxRef.current = ctx
          const dest = ctx.createMediaStreamDestination()
          silentStream = dest.stream

          // Add a blank video track so the SDP offer includes m=video
          const canvas = document.createElement('canvas')
          canvas.width = 2
          canvas.height = 2
          const ctx2d = canvas.getContext('2d')
          ctx2d.fillStyle = 'black'
          ctx2d.fillRect(0, 0, 2, 2)
          const videoTrack = canvas.captureStream(1).getVideoTracks()[0]
          if (videoTrack) silentStream.addTrack(videoTrack)
        } catch {
          // Fallback: empty MediaStream (may still lack video negotiation)
          silentStream = new MediaStream()
        }

        const call = peer.call(peerId, silentStream)
        if (!call) { setError('Could not connect to stream.'); return }

        call.on('stream', (remoteStream) => {
          if (destroyed) return
          if (videoRef.current) {
            videoRef.current.srcObject = remoteStream
            videoRef.current.play().catch(() => {})
          }
          setConnected(true)
        })

        call.on('error', () => setError('Stream connection failed.'))
        call.on('close', () => { if (!destroyed) setConnected(false) })
      })

      peer.on('error', (err) => {
        if (!destroyed) {
          console.error('Viewer PeerJS error:', err)
          setError('Could not connect to stream.')
        }
      })
    } catch {
      setError('Stream unavailable.')
    }

    return () => {
      destroyed = true
    }
  }, [peerId, retryKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const cleanup = connect()
    return () => {
      cleanup?.then?.((fn) => fn?.())
      peerRef.current?.destroy()
      peerRef.current = null
      ctxRef.current?.close?.()
      ctxRef.current = null
    }
  }, [connect])

  if (!peerId) return null

  // When rotated 90°: portrait video (9:16) rendered as landscape
  // Container = 100vw × 56.25vw (landscape rectangle)
  // Video CSS = 56.25vw × 100vw (portrait), then rotated → fits container exactly
  const isRotated = rotation !== 0

  return (
    <div
      className="relative bg-black"
      style={{
        overflow: 'hidden',
        height: isRotated ? '56.25vw' : undefined,
        maxHeight: isRotated ? undefined : 300,
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        style={{
          position: isRotated ? 'absolute' : 'relative',
          top:      isRotated ? '50%' : undefined,
          left:     isRotated ? '50%' : undefined,
          transform: isRotated
            ? `translate(-50%, -50%) rotate(${rotation}deg)`
            : 'none',
          width:     isRotated ? '56.25vw' : '100%',
          height:    isRotated ? '100vw'   : undefined,
          maxHeight: isRotated ? undefined  : 300,
          objectFit: 'contain',
          transition: 'transform 0.25s ease',
        }}
      />

      {/* Connecting overlay */}
      {!connected && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-900">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <p className="text-xs text-gray-400">Connecting to stream…</p>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-900 px-6 text-center">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={() => setRetryKey((k) => k + 1)}
            className="rounded-xl bg-gray-700 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-600"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Controls overlay (live) */}
      {connected && (
        <div className="absolute left-3 top-3 flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full bg-red-600 px-2 py-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            <span className="text-xs font-bold text-white">LIVE</span>
          </div>
          <button
            onClick={() => setMuted((m) => !m)}
            className="rounded-full bg-black/60 px-2 py-1 text-xs font-semibold text-white backdrop-blur-sm"
          >
            {muted ? '🔇 Tap to unmute' : '🔊 Mute'}
          </button>
        </div>
      )}

      {/* Right-side controls */}
      <div className="absolute right-3 top-3 flex flex-col items-end gap-2">
        {/* Fullscreen button */}
        <button
          onClick={() => {
            const el = videoRef.current
            if (!el) return
            if (el.requestFullscreen) el.requestFullscreen()
            else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen()
            else if (el.webkitEnterFullscreen) el.webkitEnterFullscreen() // iOS Safari
          }}
          className="rounded-full bg-black/60 px-2 py-1 text-xs font-semibold text-white backdrop-blur-sm"
          aria-label="Fullscreen"
        >
          ⛶ Fullscreen
        </button>

        {/* Rotate 90° button */}
        <button
          onClick={() => setRotation((r) => (r === 0 ? 90 : 0))}
          className={`rounded-full px-2 py-1 text-xs font-semibold backdrop-blur-sm ${
            isRotated
              ? 'bg-blue-600/80 text-white'
              : 'bg-black/60 text-white'
          }`}
          title="Rotate 90° for horizontal recording"
        >
          ↻ {isRotated ? 'Reset' : 'Rotate'}
        </button>
      </div>
    </div>
  )
}
