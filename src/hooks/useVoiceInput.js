import { useRef, useState, useCallback } from 'react'
import { PLAY_TYPES } from '../lib/playEventHelpers'
import { BB_PLAY_TYPES } from '../lib/baseballHelpers'

const SUPPORTED = !!(window.SpeechRecognition || window.webkitSpeechRecognition)

// ─── Basketball keyword → play type ──────────────────────────────────────────
const BB_BALL_KEYWORDS = [
  { patterns: ['three point', 'three pointer', 'triple', '3 point', '3 pointer'], type: PLAY_TYPES.SCORE_3 },
  { patterns: ['two point', 'two pointer', 'bucket', 'layup', 'dunk', '2 point'], type: PLAY_TYPES.SCORE_2 },
  { patterns: ['free throw made', 'foul shot made', 'ft made'], type: PLAY_TYPES.FREE_THROW_MADE },
  { patterns: ['free throw miss', 'foul shot miss', 'ft miss'], type: PLAY_TYPES.FREE_THROW_MISS },
  { patterns: ['rebound', 'board'], type: PLAY_TYPES.REBOUND },
  { patterns: ['assist', 'dime'], type: PLAY_TYPES.ASSIST },
  { patterns: ['steal', 'stolen'], type: PLAY_TYPES.STEAL },
  { patterns: ['block', 'blocked'], type: PLAY_TYPES.BLOCK },
  { patterns: ['foul', 'fouled'], type: PLAY_TYPES.FOUL },
  { patterns: ['turnover', 'turned over', 'lost the ball'], type: PLAY_TYPES.TURNOVER },
]

// ─── Baseball keyword → play type ────────────────────────────────────────────
const BB_BASE_KEYWORDS = [
  { patterns: ['home run', 'homer', 'homerun', 'gone'], type: BB_PLAY_TYPES.HOME_RUN },
  { patterns: ['triple', '3 base'], type: BB_PLAY_TYPES.TRIPLE },
  { patterns: ['double', '2 base'], type: BB_PLAY_TYPES.DOUBLE },
  { patterns: ['single', '1 base', 'base hit'], type: BB_PLAY_TYPES.SINGLE },
  { patterns: ['strikeout', 'struck out', 'strike out', 'k out'], type: BB_PLAY_TYPES.STRIKEOUT },
  { patterns: ['ground out', 'grounder', 'grounded out'], type: BB_PLAY_TYPES.GROUND_OUT },
  { patterns: ['fly out', 'flied out', 'popped out', 'pop out'], type: BB_PLAY_TYPES.FLY_OUT },
  { patterns: ['line out', 'lined out'], type: BB_PLAY_TYPES.LINE_OUT },
  { patterns: ['walk', 'base on balls', 'walked'], type: BB_PLAY_TYPES.WALK },
  { patterns: ['hit by pitch', 'hbp', 'plunked'], type: BB_PLAY_TYPES.HIT_BY_PITCH },
  { patterns: ['stolen base', 'stole', 'steal'], type: BB_PLAY_TYPES.STOLEN_BASE },
  { patterns: ['run scored', 'run', 'scored'], type: BB_PLAY_TYPES.RUN },
  { patterns: ['error', 'fielding error', 'bobble'], type: BB_PLAY_TYPES.ERROR },
]

function matchPlayType(transcript, sport) {
  const t = transcript.toLowerCase()
  const keywords = (sport === 'baseball' || sport === 'softball')
    ? BB_BASE_KEYWORDS
    : BB_BALL_KEYWORDS

  for (const { patterns, type } of keywords) {
    if (patterns.some((p) => t.includes(p))) return type
  }
  return null
}

function matchPlayer(transcript, players) {
  const t = transcript.toLowerCase()
  let best = null
  let bestScore = 0

  for (const player of players) {
    const nameParts = player.name.toLowerCase().split(' ')
    let score = 0
    for (const part of nameParts) {
      if (part.length > 2 && t.includes(part)) score += part.length
    }
    if (player.number && t.includes(player.number.toString())) score += 10
    if (score > bestScore) { bestScore = score; best = player }
  }

  return bestScore > 0 ? best : null
}

/**
 * useVoiceInput — hold-to-talk hook.
 * Returns: { supported, listening, result, startListening, stopListening, clearResult }
 * result: { playType, player, transcript } or null
 */
export function useVoiceInput({ players, sport }) {
  const [listening, setListening] = useState(false)
  const [result, setResult] = useState(null)
  const recognitionRef = useRef(null)

  const startListening = useCallback(() => {
    if (!SUPPORTED || listening) return
    setResult(null)

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.continuous = false
    recognition.interimResults = false
    recognitionRef.current = recognition

    recognition.onstart = () => setListening(true)
    recognition.onend = () => setListening(false)

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      const playType = matchPlayType(transcript, sport)
      const player = matchPlayer(transcript, players)
      setResult({ playType, player, transcript })
    }

    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error)
      setListening(false)
    }

    recognition.start()
  }, [listening, players, sport])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
  }, [])

  const clearResult = useCallback(() => setResult(null), [])

  return { supported: SUPPORTED, listening, result, startListening, stopListening, clearResult }
}
