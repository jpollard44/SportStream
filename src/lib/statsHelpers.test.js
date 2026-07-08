import { describe, it, expect } from 'vitest'
import {
  computeBasketballStats, mergeBasketballStats,
  computeBaseballStats, mergeBaseballStats,
  battingAvg, isBaseballSport,
} from './statsHelpers'

const bballPlay = (playerId, type, points = 0) => ({
  playerId, playerName: playerId, playerNumber: '1', team: 'home', type, points,
})

describe('computeBasketballStats', () => {
  it('accumulates points and counting stats per player', () => {
    const plays = [
      bballPlay('p1', 'score_2', 2),
      bballPlay('p1', 'score_3', 3),
      bballPlay('p1', 'rebound'),
      bballPlay('p1', 'assist'),
      bballPlay('p2', 'ft_made', 1),
      bballPlay('p2', 'turnover'),
      bballPlay('p2', 'foul'),
    ]
    const stats = computeBasketballStats(plays)
    expect(stats.p1).toMatchObject({ pts: 5, reb: 1, ast: 1, stl: 0 })
    expect(stats.p2).toMatchObject({ pts: 1, to: 1, foul: 1 })
  })

  it('skips team-level plays with no player', () => {
    const stats = computeBasketballStats([{ playerId: null, type: 'timeout' }])
    expect(Object.keys(stats)).toHaveLength(0)
  })
})

describe('mergeBasketballStats', () => {
  it('sums stats across games and counts games played', () => {
    const g1 = computeBasketballStats([bballPlay('p1', 'score_2', 2)])
    const g2 = computeBasketballStats([
      bballPlay('p1', 'score_3', 3),
      bballPlay('p2', 'steal'),
    ])
    const merged = mergeBasketballStats([g1, g2])
    expect(merged.p1).toMatchObject({ pts: 5, gp: 2 })
    expect(merged.p2).toMatchObject({ stl: 1, gp: 1 })
  })
})

const bbPlay = (playerId, type, points = 0) => ({
  playerId, playerName: playerId, playerNumber: '1', team: 'away', type, points,
})

describe('computeBaseballStats', () => {
  it('counts at-bats, hits, home runs and RBIs', () => {
    const plays = [
      bbPlay('p1', 'single'),
      bbPlay('p1', 'homeRun', 2),
      bbPlay('p1', 'strikeout'),
    ]
    const stats = computeBaseballStats(plays)
    expect(stats.p1).toMatchObject({ ab: 3, h: 2, hr: 1, rbi: 2, k: 1 })
  })

  it('does not count walks, HBP or sacrifices as at-bats', () => {
    const plays = [
      bbPlay('p1', 'walk'),
      bbPlay('p1', 'hitByPitch'),
      bbPlay('p1', 'sacrifice'),
    ]
    const stats = computeBaseballStats(plays)
    expect(stats.p1.ab).toBe(0)
    expect(stats.p1.bb).toBe(2)
  })
})

describe('mergeBaseballStats', () => {
  it('sums per-game stats and tracks games played', () => {
    const g1 = computeBaseballStats([bbPlay('p1', 'double')])
    const g2 = computeBaseballStats([bbPlay('p1', 'walk')])
    const merged = mergeBaseballStats([g1, g2])
    expect(merged.p1).toMatchObject({ ab: 1, h: 1, bb: 1, gp: 2 })
  })
})

describe('battingAvg', () => {
  it('formats to three digits', () => {
    expect(battingAvg(1, 3)).toBe('.333')
    expect(battingAvg(0, 4)).toBe('.000')
    expect(battingAvg(1, 8)).toBe('.125')
  })

  it('formats a perfect average as 1.000', () => {
    expect(battingAvg(3, 3)).toBe('1.000')
  })

  it('returns .000 with no at-bats', () => {
    expect(battingAvg(0, 0)).toBe('.000')
    expect(battingAvg(2, 0)).toBe('.000')
  })
})

describe('isBaseballSport', () => {
  it('is true for baseball and softball only', () => {
    expect(isBaseballSport('baseball')).toBe(true)
    expect(isBaseballSport('softball')).toBe(true)
    expect(isBaseballSport('basketball')).toBe(false)
    expect(isBaseballSport(undefined)).toBe(false)
  })
})
