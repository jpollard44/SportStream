import { describe, it, expect } from 'vitest'
import { PLAY_TYPES, buildPlayEvent, describePlay } from './playEventHelpers'

describe('buildPlayEvent', () => {
  const base = {
    team: 'home',
    player: { id: 'p1', name: 'Sam Jones', number: '23' },
    clockElapsed: 120,
    period: 2,
    createdBy: 'u1',
  }

  it('sets points and scoreDelta for scoring plays', () => {
    const event = buildPlayEvent({ ...base, type: PLAY_TYPES.SCORE_3 })
    expect(event.points).toBe(3)
    expect(event.scoreDelta).toEqual({ home: 3, away: 0 })
  })

  it('credits the away side when the away team scores', () => {
    const event = buildPlayEvent({ ...base, team: 'away', type: PLAY_TYPES.SCORE_2 })
    expect(event.scoreDelta).toEqual({ home: 0, away: 2 })
  })

  it('has no scoreDelta for non-scoring plays', () => {
    const event = buildPlayEvent({ ...base, type: PLAY_TYPES.REBOUND })
    expect(event.points).toBe(0)
    expect(event.scoreDelta).toBeNull()
  })

  it('missed free throws score nothing', () => {
    const event = buildPlayEvent({ ...base, type: PLAY_TYPES.FREE_THROW_MISS })
    expect(event.points).toBe(0)
    expect(event.scoreDelta).toBeNull()
  })

  it('falls back to a team-level event without a player', () => {
    const event = buildPlayEvent({ ...base, player: null, type: PLAY_TYPES.TIMEOUT })
    expect(event.playerId).toBeNull()
    expect(event.playerName).toBe('Team')
  })

  it('carries clock, period and author', () => {
    const event = buildPlayEvent({ ...base, type: PLAY_TYPES.ASSIST })
    expect(event.clockAtPlay).toBe(120)
    expect(event.period).toBe(2)
    expect(event.createdBy).toBe('u1')
  })
})

describe('describePlay', () => {
  it('includes number, name and label', () => {
    expect(describePlay({ type: 'score_3', playerName: 'Sam', playerNumber: '23' }))
      .toBe('#23 Sam — 3 PT')
  })

  it('falls back to the raw type for unknown plays', () => {
    expect(describePlay({ type: 'mystery', playerName: 'Sam', playerNumber: '' }))
      .toBe('Sam — mystery')
  })
})
