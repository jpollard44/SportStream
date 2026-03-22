import { useEffect, useRef, useState, useCallback } from 'react'
import { updateGame } from '../firebase/firestore'

/**
 * Broadcaster-side streaming hook (scorekeeper).
 * Creates a PeerJS peer, starts camera, answers incoming viewer calls.
 */
export function useStream(gameId) {
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState(null)
  const localStreamRef = useRef(null)
  const peerRef = useRef(null)
  const localVideoRef = useRef(null)  // attach to a <video> for preview

  const startStream = useCallback(async () => {
    setError(null)
    try {
      // Try to select the rear camera explicitly by enumerating devices first.
      // On iOS Safari, facingMode 'ideal' is often ignored — device enumeration
      // with an exact deviceId is the most reliable way to get the back camera.
      let videoConstraint = { facingMode: 'environment' }
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const videoDevices = devices.filter((d) => d.kind === 'videoinput')
        const rear = videoDevices.find((d) => {
          const label = d.label.toLowerCase()
          return label.includes('back') || label.includes('rear') || label.includes('environment')
        })
        if (rear) videoConstraint = { deviceId: { exact: rear.deviceId } }
      } catch {
        // enumerateDevices failed — fall through to facingMode constraint
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraint,
        audio: true,
      })
      localStreamRef.current = stream

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }

      // Lazy-import PeerJS to avoid SSR issues and keep bundle clean
      const { Peer } = await import('peerjs')
      const peer = new Peer()
      peerRef.current = peer

      peer.on('open', async (id) => {
        await updateGame(gameId, { peerId: id, streamActive: true })
        setStreaming(true)
      })

      peer.on('call', (call) => {
        call.answer(localStreamRef.current)
      })

      peer.on('error', (err) => {
        console.error('PeerJS error:', err)
        setError('Stream error — check camera permissions.')
      })
    } catch (err) {
      console.error('Camera error:', err)
      setError('Camera access denied. Check browser permissions.')
    }
  }, [gameId])

  const stopStream = useCallback(async () => {
    peerRef.current?.destroy()
    peerRef.current = null
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    localStreamRef.current = null
    if (localVideoRef.current) localVideoRef.current.srcObject = null
    await updateGame(gameId, { peerId: null, streamActive: false })
    setStreaming(false)
  }, [gameId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      peerRef.current?.destroy()
      localStreamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return { streaming, error, startStream, stopStream, localVideoRef }
}
