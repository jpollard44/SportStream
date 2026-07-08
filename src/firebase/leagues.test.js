import { describe, it, expect, vi } from 'vitest'

vi.mock('./config', () => ({ db: {} }))

import { computeLeagueStandings } from './leagues'

const team = (id, status = 'accepted') => ({ id, name: id, status })
const game = (homeId, awayId, homeScore, awayScore, status = 'final') => ({
  homeLeagueTeamId: homeId, awayLeagueTeamId: awayId, homeScore, awayScore, status,
})

describe('computeLeagueStandings', () => {
  it('only includes accepted teams', () => {
    const standings = computeLeagueStandings([team('a'), team('b', 'pending')], [])
    expect(standings).toHaveLength(1)
    expect(standings[0].id).toBe('a')
  })

  it('tallies wins, losses, ties and points for/against', () => {
    const teams = [team('a'), team('b'), team('c')]
    const games = [
      game('a', 'b', 30, 20),
      game('b', 'c', 15, 15),
      game('c', 'a', 10, 25),
    ]
    const standings = computeLeagueStandings(teams, games)
    const a = standings.find((s) => s.id === 'a')
    const b = standings.find((s) => s.id === 'b')
    const c = standings.find((s) => s.id === 'c')
    expect(a).toMatchObject({ W: 2, L: 0, T: 0, pf: 55, pa: 30 })
    expect(b).toMatchObject({ W: 0, L: 1, T: 1, pf: 35, pa: 45 })
    expect(c).toMatchObject({ W: 0, L: 1, T: 1, pf: 25, pa: 40 })
    // 'a' leads on points (W=2 → 4 pts)
    expect(standings[0].id).toBe('a')
  })

  it('ignores games that are not final', () => {
    const standings = computeLeagueStandings([team('a'), team('b')], [
      game('a', 'b', 10, 5, 'live'),
    ])
    expect(standings.find((s) => s.id === 'a').W).toBe(0)
  })

  it('breaks point ties by score differential', () => {
    const teams = [team('a'), team('b'), team('c'), team('d')]
    const games = [
      game('a', 'b', 30, 10), // a wins by 20
      game('c', 'd', 15, 10), // c wins by 5
    ]
    const standings = computeLeagueStandings(teams, games)
    expect(standings[0].id).toBe('a')
    expect(standings[1].id).toBe('c')
  })
})
