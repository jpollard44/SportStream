import { describe, it, expect, vi } from 'vitest'

// tournaments.js pulls in the Firebase app config; the bracket builders under
// test are pure functions that never touch it.
vi.mock('./config', () => ({ db: {} }))

import {
  buildSingleEliminationBracket,
  buildDoubleEliminationBracket,
  buildRoundRobinSchedule,
  buildSmartSchedule,
  advanceWinner,
  computeStandings,
} from './tournaments'

const teams = (n) =>
  Array.from({ length: n }, (_, i) => ({ id: `t${i + 1}`, name: `Team ${i + 1}`, seed: i + 1 }))

describe('buildSingleEliminationBracket', () => {
  it('returns an empty bracket for fewer than 2 teams', () => {
    expect(buildSingleEliminationBracket([])).toEqual([])
    expect(buildSingleEliminationBracket(teams(1))).toEqual([])
  })

  it('builds a complete 4-team bracket with seed pairings', () => {
    const bracket = buildSingleEliminationBracket(teams(4))
    // 2 first-round matches + 1 final
    expect(bracket).toHaveLength(3)
    const r1 = bracket.filter((m) => m.round === 1)
    // 1 vs 4, 2 vs 3
    expect(r1[0].homeTeamId).toBe('t1')
    expect(r1[0].awayTeamId).toBe('t4')
    expect(r1[1].homeTeamId).toBe('t2')
    expect(r1[1].awayTeamId).toBe('t3')
    // Both feed the final
    expect(r1[0].nextMatchId).toBe('r2m1')
    expect(r1[1].nextMatchId).toBe('r2m1')
  })

  it('pads to a power of two and auto-advances byes', () => {
    const bracket = buildSingleEliminationBracket(teams(6))
    // 8 slots → 4 + 2 + 1 matches
    expect(bracket).toHaveLength(7)
    const r1 = bracket.filter((m) => m.round === 1)
    const byeMatches = r1.filter((m) => !m.homeTeamId || !m.awayTeamId)
    expect(byeMatches).toHaveLength(2)
    // Top seeds got the byes and were advanced into round 2
    for (const m of byeMatches) {
      expect(m.winnerId).toBeTruthy()
      const next = bracket.find((n) => n.matchId === m.nextMatchId)
      const advanced = next.homeTeamId === m.winnerId || next.awayTeamId === m.winnerId
      expect(advanced).toBe(true)
    }
  })

  it('every non-final match points at a valid next match', () => {
    const bracket = buildSingleEliminationBracket(teams(8))
    const ids = new Set(bracket.map((m) => m.matchId))
    for (const m of bracket) {
      if (m.nextMatchId) expect(ids.has(m.nextMatchId)).toBe(true)
    }
    // Exactly one match (the final) has no next match
    expect(bracket.filter((m) => !m.nextMatchId)).toHaveLength(1)
  })
})

describe('advanceWinner', () => {
  it('places the winner into the declared slot of the next match', () => {
    const bracket = buildSingleEliminationBracket(teams(4))
    const [m1] = bracket
    m1.winnerId = 't1'
    m1.winnerName = 'Team 1'
    advanceWinner(bracket, m1)
    const final = bracket.find((m) => m.matchId === 'r2m1')
    expect(final.homeTeamId).toBe('t1')
  })
})

describe('buildDoubleEliminationBracket', () => {
  it('returns empty brackets for fewer than 2 teams', () => {
    expect(buildDoubleEliminationBracket([])).toEqual({ bracket: [], losersBracket: [] })
  })

  it('builds winners, losers and grand final for 4 teams', () => {
    const { bracket, losersBracket } = buildDoubleEliminationBracket(teams(4))
    // W: 2 + 1, plus the grand final
    expect(bracket).toHaveLength(4)
    expect(bracket.at(-1).matchId).toBe('gf')
    // L: lR1 (1 match) + lR2 (1 match)
    expect(losersBracket).toHaveLength(2)
    // Losers final feeds the grand final's away slot
    const lFinal = losersBracket.at(-1)
    expect(lFinal.nextMatchId).toBe('gf')
    expect(lFinal.nextSlot).toBe('away')
  })

  it('routes every winners-round-1 loser to a distinct losers slot', () => {
    const { bracket } = buildDoubleEliminationBracket(teams(8))
    const r1 = bracket.filter((m) => m.bracket === 'winners' && m.round === 1)
    const destinations = r1.map((m) => `${m.loserNextMatchId}:${m.loserNextSlot}`)
    expect(new Set(destinations).size).toBe(r1.length)
  })

  it('all loser destinations exist in the losers bracket', () => {
    const { bracket, losersBracket } = buildDoubleEliminationBracket(teams(8))
    const lIds = new Set(losersBracket.map((m) => m.matchId))
    for (const m of bracket) {
      if (m.loserNextMatchId) expect(lIds.has(m.loserNextMatchId)).toBe(true)
    }
  })

  it('auto-advances byes without sending them to the losers bracket', () => {
    const { bracket } = buildDoubleEliminationBracket(teams(6))
    const byes = bracket.filter(
      (m) => m.round === 1 && (!m.homeTeamId || !m.awayTeamId) && m.bracket === 'winners'
    )
    expect(byes.length).toBeGreaterThan(0)
    for (const m of byes) {
      expect(m.winnerId).toBeTruthy()
      expect(m.loserNextMatchId).toBeNull()
    }
  })
})

describe('buildRoundRobinSchedule', () => {
  it('creates one match per team pair', () => {
    const schedule = buildRoundRobinSchedule(teams(5))
    expect(schedule).toHaveLength(10) // 5 choose 2
    const pairs = new Set(schedule.map((m) => [m.homeTeamId, m.awayTeamId].sort().join('-')))
    expect(pairs.size).toBe(10)
  })

  it('returns an empty schedule for a single team', () => {
    expect(buildRoundRobinSchedule(teams(1))).toEqual([])
  })
})

describe('buildSmartSchedule', () => {
  const match = (id) => ({ matchId: id })
  const opts = {
    startDate: '2026-07-11',
    numFields: 2,
    gameDurationMin: 60,
    firstGameTime: '09:00',
    lastGameTime: '11:00',
  }

  it('fills all fields in a slot before advancing the clock', () => {
    const result = buildSmartSchedule([[match('a'), match('b'), match('c')]], opts)
    expect(result[0].field).toBe('Field 1')
    expect(result[1].field).toBe('Field 2')
    expect(result[0].scheduledAt).toBe(result[1].scheduledAt)
    // Third game moves to the next time slot
    expect(result[2].field).toBe('Field 1')
    expect(new Date(result[2].scheduledAt).getTime())
      .toBe(new Date(result[0].scheduledAt).getTime() + 60 * 60 * 1000)
  })

  it('rolls past the last start time onto the next day', () => {
    const manyMatches = Array.from({ length: 8 }, (_, i) => match(`m${i}`))
    const result = buildSmartSchedule([manyMatches], opts)
    // 2 fields × 3 slots (09:00, 10:00, 11:00) = 6 games on day 1; rest on day 2
    const day = (iso) => new Date(iso).getDate()
    expect(day(result[5].scheduledAt)).toBe(day(result[0].scheduledAt))
    expect(day(result[6].scheduledAt)).toBe(day(result[0].scheduledAt) + 1)
  })

  it('assigns every match a field and a time', () => {
    const rounds = [[match('a'), match('b')], [match('c')]]
    const result = buildSmartSchedule(rounds, opts)
    expect(result).toHaveLength(3)
    for (const m of result) {
      expect(m.field).toMatch(/^Field \d$/)
      expect(new Date(m.scheduledAt).toString()).not.toBe('Invalid Date')
    }
  })
})

describe('computeStandings', () => {
  it('ranks by points then wins', () => {
    const ts = teams(3)
    const schedule = [
      { matchId: 'rr1', homeTeamId: 't1', awayTeamId: 't2', winnerId: 't1' },
      { matchId: 'rr2', homeTeamId: 't1', awayTeamId: 't3', winnerId: 't1' },
      { matchId: 'rr3', homeTeamId: 't2', awayTeamId: 't3', winnerId: 't2' },
    ]
    const standings = computeStandings(schedule, ts)
    expect(standings[0]).toMatchObject({ teamId: 't1', w: 2, l: 0, pts: 4 })
    expect(standings[1]).toMatchObject({ teamId: 't2', w: 1, l: 1, pts: 2 })
    expect(standings[2]).toMatchObject({ teamId: 't3', w: 0, l: 2, pts: 0 })
  })

  it('ignores undecided matches', () => {
    const standings = computeStandings(
      [{ matchId: 'rr1', homeTeamId: 't1', awayTeamId: 't2', winnerId: null }],
      teams(2)
    )
    expect(standings[0].w).toBe(0)
    expect(standings[1].w).toBe(0)
  })
})
