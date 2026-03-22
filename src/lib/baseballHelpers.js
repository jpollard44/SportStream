/**
 * Play event types and helpers for baseball / softball
 */

/** Positions by sport (used in ClubPage add-player form) */
export const SPORT_POSITIONS = {
  baseball:     ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'],
  softball:     ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DP', 'FLEX'],
  basketball:   ['PG', 'SG', 'SF', 'PF', 'C'],
  soccer:       ['GK', 'DEF', 'MID', 'FWD'],
  volleyball:   ['S', 'OH', 'MB', 'RS', 'L', 'DS'],
  'flag-football': ['QB', 'WR', 'RB', 'TE', 'C', 'DE', 'LB', 'CB', 'S'],
}

export const BB_PLAY_TYPES = {
  // Hits
  SINGLE: 'single',
  DOUBLE: 'double',
  TRIPLE: 'triple',
  HOME_RUN: 'homeRun',
  // Outs
  STRIKEOUT: 'strikeout',
  GROUND_OUT: 'groundOut',
  FLY_OUT: 'flyOut',
  LINE_OUT: 'lineOut',
  SACRIFICE: 'sacrifice',
  // Other plate appearances
  WALK: 'walk',
  HIT_BY_PITCH: 'hitByPitch',
  // Baserunning
  STOLEN_BASE: 'stolenBase',
  CAUGHT_STEALING: 'caughtStealing',
  // Scoring
  RUN: 'run',
  // Miscellaneous
  ERROR: 'error',
  WILD_PITCH: 'wildPitch',
  PASSED_BALL: 'passedBall',
  // Game state
  INNING_CHANGE: 'inningChange',
}

export const BB_PLAY_LABELS = {
  single: '1B',
  double: '2B',
  triple: '3B',
  homeRun: 'HR',
  strikeout: 'K',
  groundOut: 'GO',
  flyOut: 'FO',
  lineOut: 'LO',
  sacrifice: 'SAC',
  walk: 'BB',
  hitByPitch: 'HBP',
  stolenBase: 'SB',
  caughtStealing: 'CS',
  run: 'Run Scored',
  error: 'Error',
  wildPitch: 'Wild Pitch',
  passedBall: 'Passed Ball',
  inningChange: 'Inning Change',
}

export const BB_HIT_PLAYS = [
  { type: BB_PLAY_TYPES.SINGLE,   label: '1B',  emoji: '🟦', isHit: true },
  { type: BB_PLAY_TYPES.DOUBLE,   label: '2B',  emoji: '🟩', isHit: true },
  { type: BB_PLAY_TYPES.TRIPLE,   label: '3B',  emoji: '🟧', isHit: true },
  { type: BB_PLAY_TYPES.HOME_RUN, label: 'HR',  emoji: '🚀', isHit: true, isRun: true },
  { type: BB_PLAY_TYPES.WALK,     label: 'BB',  emoji: '🚶', isHit: false },
  { type: BB_PLAY_TYPES.HIT_BY_PITCH, label: 'HBP', emoji: '🎯', isHit: false },
]

export const BB_OUT_PLAYS = [
  { type: BB_PLAY_TYPES.STRIKEOUT,  label: 'K',   emoji: '✗', isOut: true },
  { type: BB_PLAY_TYPES.GROUND_OUT, label: 'GO',  emoji: '⬇', isOut: true },
  { type: BB_PLAY_TYPES.FLY_OUT,    label: 'FO',  emoji: '⬆', isOut: true },
  { type: BB_PLAY_TYPES.LINE_OUT,   label: 'LO',  emoji: '➡', isOut: true },
  { type: BB_PLAY_TYPES.SACRIFICE,  label: 'SAC', emoji: '↗', isOut: true },
]

export const BB_OTHER_PLAYS = [
  { type: BB_PLAY_TYPES.STOLEN_BASE,     label: 'SB',  emoji: '💨' },
  { type: BB_PLAY_TYPES.CAUGHT_STEALING, label: 'CS',  emoji: '🛑', isOut: true },
  { type: BB_PLAY_TYPES.ERROR,           label: 'E',   emoji: '⚠' },
  { type: BB_PLAY_TYPES.WILD_PITCH,      label: 'WP',  emoji: '🌀' },
  { type: BB_PLAY_TYPES.PASSED_BALL,     label: 'PB',  emoji: '🫳' },
]

/** Which plays result in an out (for auto-incrementing outs) */
export const BB_OUT_TYPES = new Set([
  BB_PLAY_TYPES.STRIKEOUT,
  BB_PLAY_TYPES.GROUND_OUT,
  BB_PLAY_TYPES.FLY_OUT,
  BB_PLAY_TYPES.LINE_OUT,
  BB_PLAY_TYPES.SACRIFICE,
  BB_PLAY_TYPES.CAUGHT_STEALING,
])

/** Which plays are hits (for batting average etc) */
export const BB_HIT_TYPES = new Set([
  BB_PLAY_TYPES.SINGLE,
  BB_PLAY_TYPES.DOUBLE,
  BB_PLAY_TYPES.TRIPLE,
  BB_PLAY_TYPES.HOME_RUN,
])

/** Which plays count as an at-bat */
export const BB_AT_BAT_TYPES = new Set([
  BB_PLAY_TYPES.SINGLE,
  BB_PLAY_TYPES.DOUBLE,
  BB_PLAY_TYPES.TRIPLE,
  BB_PLAY_TYPES.HOME_RUN,
  BB_PLAY_TYPES.STRIKEOUT,
  BB_PLAY_TYPES.GROUND_OUT,
  BB_PLAY_TYPES.FLY_OUT,
  BB_PLAY_TYPES.LINE_OUT,
  // Note: walk, HBP, sacrifice do NOT count as ABs
])

/**
 * Which plays advance the batter out of the box (batter's turn is over).
 * Used to increment the batting order index.
 */
export const BB_BATTER_DONE_TYPES = new Set([
  BB_PLAY_TYPES.SINGLE,
  BB_PLAY_TYPES.DOUBLE,
  BB_PLAY_TYPES.TRIPLE,
  BB_PLAY_TYPES.HOME_RUN,
  BB_PLAY_TYPES.STRIKEOUT,
  BB_PLAY_TYPES.GROUND_OUT,
  BB_PLAY_TYPES.FLY_OUT,
  BB_PLAY_TYPES.LINE_OUT,
  BB_PLAY_TYPES.SACRIFICE,
  BB_PLAY_TYPES.WALK,
  BB_PLAY_TYPES.HIT_BY_PITCH,
])

/**
 * Auto-advance base runners based on play type.
 * bases = { first: runnerInfo|null, second: runnerInfo|null, third: runnerInfo|null }
 * batter = { playerId, playerName, playerNumber }
 * Returns { newBases, runsScored }
 */
export function advanceBases(bases, playType, batter) {
  const f = bases?.first ?? null
  const s = bases?.second ?? null
  const t = bases?.third ?? null

  switch (playType) {
    case BB_PLAY_TYPES.HOME_RUN:
      return {
        newBases: { first: null, second: null, third: null },
        runsScored: (f ? 1 : 0) + (s ? 1 : 0) + (t ? 1 : 0) + 1,
      }

    case BB_PLAY_TYPES.TRIPLE:
      return {
        newBases: { first: null, second: null, third: batter },
        runsScored: (f ? 1 : 0) + (s ? 1 : 0) + (t ? 1 : 0),
      }

    case BB_PLAY_TYPES.DOUBLE:
      // 1B → 3B; 2B and 3B score; batter to 2B
      return {
        newBases: { first: null, second: batter, third: f || null },
        runsScored: (s ? 1 : 0) + (t ? 1 : 0),
      }

    case BB_PLAY_TYPES.SINGLE:
      // 3B scores; 2B → 3B; 1B → 2B; batter to 1B
      return {
        newBases: { first: batter, second: f || null, third: s || null },
        runsScored: t ? 1 : 0,
      }

    case BB_PLAY_TYPES.WALK:
    case BB_PLAY_TYPES.HIT_BY_PITCH:
      // Force advancement only where forced
      if (!f) return { newBases: { ...bases, first: batter }, runsScored: 0 }
      if (!s) return { newBases: { first: batter, second: f, third: t }, runsScored: 0 }
      if (!t) return { newBases: { first: batter, second: f, third: s }, runsScored: 0 }
      // Bases loaded — runner on 3B is forced home
      return { newBases: { first: batter, second: f, third: s }, runsScored: 1 }

    case BB_PLAY_TYPES.SACRIFICE:
      // Runner on 3B scores; others advance 1; batter is out (not placed on base)
      return {
        newBases: { first: null, second: f || null, third: s || null },
        runsScored: t ? 1 : 0,
      }

    case BB_PLAY_TYPES.STOLEN_BASE:
      // Advance the lead runner (front runner first to avoid collisions)
      if (t) return { newBases: { first: f, second: s, third: null }, runsScored: 1 }  // runner on 3rd steals home
      if (s) return { newBases: { first: f, second: null, third: s }, runsScored: 0 }
      if (f) return { newBases: { first: null, second: f, third: null }, runsScored: 0 }
      return { newBases: bases, runsScored: 0 }

    default:
      // Outs and misc plays — no base change
      return { newBases: { first: f, second: s, third: t }, runsScored: 0 }
  }
}

/**
 * Build a baseball play event for Firestore.
 * runsScored is pre-computed by advanceBases() before calling this.
 */
export function buildBaseballPlayEvent({ type, game, player, createdBy, runsScored = 0 }) {
  const battingTeam = game.inningHalf === 'top' ? 'away' : 'home'

  const scoreDelta = runsScored > 0
    ? { home: battingTeam === 'home' ? runsScored : 0, away: battingTeam === 'away' ? runsScored : 0 }
    : null

  return {
    type,
    team: battingTeam,
    playerId: player?.id || null,
    playerName: player?.name || 'Team',
    playerNumber: player?.number || '',
    points: runsScored,
    scoreDelta,
    inning: game.inning,
    inningHalf: game.inningHalf,
    clockAtPlay: 0,
    period: game.inning,
    createdBy,
  }
}

export function describeBaseballPlay(play) {
  const label = BB_PLAY_LABELS[play.type] || play.type
  const who = play.playerNumber ? `#${play.playerNumber} ${play.playerName}` : play.playerName
  return `${who} — ${label}`
}

/** Compute next inning state after 3 outs */
export function nextInningState(game) {
  if (game.inningHalf === 'top') {
    return { inningHalf: 'bottom', outs: 0 }
  }
  const nextInning = game.inning + 1
  if (nextInning > game.totalInnings) {
    return { inning: nextInning, inningHalf: 'top', outs: 0, status: 'final' }
  }
  return { inning: nextInning, inningHalf: 'top', outs: 0 }
}
