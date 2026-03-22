import {
  BB_HIT_TYPES, BB_AT_BAT_TYPES, BB_PLAY_TYPES,
} from './baseballHelpers'

// ── Basketball ────────────────────────────────────────────────────────────────

export function computeBasketballStats(plays) {
  const stats = {}
  for (const play of plays) {
    if (!play.playerId) continue
    if (!stats[play.playerId]) {
      stats[play.playerId] = {
        id: play.playerId, name: play.playerName, number: play.playerNumber,
        team: play.team, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, foul: 0, to: 0,
      }
    }
    const s = stats[play.playerId]
    if (play.points)        s.pts  += play.points
    if (play.type === 'rebound')  s.reb  += 1
    if (play.type === 'assist')   s.ast  += 1
    if (play.type === 'steal')    s.stl  += 1
    if (play.type === 'block')    s.blk  += 1
    if (play.type === 'foul')     s.foul += 1
    if (play.type === 'turnover') s.to   += 1
  }
  return stats
}

// Merge stats from multiple games into one map keyed by playerId
export function mergeBasketballStats(perGameStats) {
  const merged = {}
  for (const stats of perGameStats) {
    for (const [id, s] of Object.entries(stats)) {
      if (!merged[id]) {
        merged[id] = { ...s, gp: 0 }
      }
      merged[id].gp   += 1
      merged[id].pts  += s.pts
      merged[id].reb  += s.reb
      merged[id].ast  += s.ast
      merged[id].stl  += s.stl
      merged[id].blk  += s.blk
      merged[id].foul += s.foul
      merged[id].to   += s.to
    }
  }
  return merged
}

// ── Baseball / Softball ───────────────────────────────────────────────────────

export function computeBaseballStats(plays) {
  const stats = {}
  for (const play of plays) {
    if (!play.playerId) continue
    if (!stats[play.playerId]) {
      stats[play.playerId] = {
        id: play.playerId, name: play.playerName, number: play.playerNumber,
        team: play.team, ab: 0, h: 0, hr: 0, rbi: 0, bb: 0, k: 0,
      }
    }
    const s = stats[play.playerId]
    if (BB_AT_BAT_TYPES.has(play.type))                                     s.ab  += 1
    if (BB_HIT_TYPES.has(play.type))                                        s.h   += 1
    if (play.type === BB_PLAY_TYPES.HOME_RUN)                               s.hr  += 1
    if (play.type === BB_PLAY_TYPES.WALK || play.type === BB_PLAY_TYPES.HIT_BY_PITCH) s.bb += 1
    if (play.type === BB_PLAY_TYPES.STRIKEOUT)                              s.k   += 1
    if (play.points)                                                         s.rbi += play.points
  }
  return stats
}

export function mergeBaseballStats(perGameStats) {
  const merged = {}
  for (const stats of perGameStats) {
    for (const [id, s] of Object.entries(stats)) {
      if (!merged[id]) {
        merged[id] = { ...s, gp: 0 }
      }
      merged[id].gp  += 1
      merged[id].ab  += s.ab
      merged[id].h   += s.h
      merged[id].hr  += s.hr
      merged[id].rbi += s.rbi
      merged[id].bb  += s.bb
      merged[id].k   += s.k
    }
  }
  return merged
}

// ── Shared ────────────────────────────────────────────────────────────────────

export function battingAvg(h, ab) {
  if (!ab) return '.000'
  return '.' + Math.round((h / ab) * 1000).toString().padStart(3, '0')
}

export function isBaseballSport(sport) {
  return sport === 'baseball' || sport === 'softball'
}
