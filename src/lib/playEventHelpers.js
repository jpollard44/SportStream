/**
 * Play event types for basketball MVP
 */
export const PLAY_TYPES = {
  SCORE_2: 'score_2',
  SCORE_3: 'score_3',
  FREE_THROW_MADE: 'ft_made',
  FREE_THROW_MISS: 'ft_miss',
  REBOUND: 'rebound',
  ASSIST: 'assist',
  STEAL: 'steal',
  BLOCK: 'block',
  FOUL: 'foul',
  TURNOVER: 'turnover',
  TIMEOUT: 'timeout',
  PERIOD_START: 'period_start',
  PERIOD_END: 'period_end',
}

export const PLAY_LABELS = {
  [PLAY_TYPES.SCORE_2]: '2 PT',
  [PLAY_TYPES.SCORE_3]: '3 PT',
  [PLAY_TYPES.FREE_THROW_MADE]: 'FT Made',
  [PLAY_TYPES.FREE_THROW_MISS]: 'FT Miss',
  [PLAY_TYPES.REBOUND]: 'Rebound',
  [PLAY_TYPES.ASSIST]: 'Assist',
  [PLAY_TYPES.STEAL]: 'Steal',
  [PLAY_TYPES.BLOCK]: 'Block',
  [PLAY_TYPES.FOUL]: 'Foul',
  [PLAY_TYPES.TURNOVER]: 'Turnover',
  [PLAY_TYPES.TIMEOUT]: 'Timeout',
}

export const SCORING_PLAYS = [
  { type: PLAY_TYPES.SCORE_2, label: '2 PT', points: 2, emoji: '🏀' },
  { type: PLAY_TYPES.SCORE_3, label: '3 PT', points: 3, emoji: '🎯' },
  { type: PLAY_TYPES.FREE_THROW_MADE, label: 'FT Made', points: 1, emoji: '✓' },
  { type: PLAY_TYPES.FREE_THROW_MISS, label: 'FT Miss', points: 0, emoji: '✗' },
]

export const STAT_PLAYS = [
  { type: PLAY_TYPES.REBOUND, label: 'Rebound', emoji: '↩' },
  { type: PLAY_TYPES.ASSIST, label: 'Assist', emoji: '🤝' },
  { type: PLAY_TYPES.STEAL, label: 'Steal', emoji: '✋' },
  { type: PLAY_TYPES.BLOCK, label: 'Block', emoji: '🛡' },
  { type: PLAY_TYPES.FOUL, label: 'Foul', emoji: '⚠' },
  { type: PLAY_TYPES.TURNOVER, label: 'Turnover', emoji: '↔' },
]

const POINTS_BY_TYPE = {
  [PLAY_TYPES.SCORE_2]: 2,
  [PLAY_TYPES.SCORE_3]: 3,
  [PLAY_TYPES.FREE_THROW_MADE]: 1,
}

export function buildPlayEvent({ type, team, player, clockElapsed, period, createdBy }) {
  const points = POINTS_BY_TYPE[type] || 0
  const scoreDelta = points > 0
    ? { home: team === 'home' ? points : 0, away: team === 'away' ? points : 0 }
    : null

  return {
    type,
    team,
    playerId: player?.id || null,
    playerName: player?.name || 'Team',
    playerNumber: player?.number || '',
    points,
    scoreDelta,
    clockAtPlay: clockElapsed,
    period,
    createdBy,
  }
}

export function describePlay(play) {
  const label = PLAY_LABELS[play.type] || play.type
  const who = play.playerNumber ? `#${play.playerNumber} ${play.playerName}` : play.playerName
  return `${who} — ${label}`
}
