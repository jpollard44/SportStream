import { describe, it, expect } from 'vitest'
import {
  BB_PLAY_TYPES, advanceBases, buildBaseballPlayEvent, nextInningState,
  describeBaseballPlay,
} from './baseballHelpers'

const runner = (name) => ({ playerId: name, playerName: name, playerNumber: '1' })
const batter = runner('batter')
const empty = { first: null, second: null, third: null }

describe('advanceBases', () => {
  it('home run clears the bases and scores everyone plus the batter', () => {
    const bases = { first: runner('a'), second: runner('b'), third: runner('c') }
    const { newBases, runsScored } = advanceBases(bases, BB_PLAY_TYPES.HOME_RUN, batter)
    expect(newBases).toEqual(empty)
    expect(runsScored).toBe(4)
  })

  it('solo home run scores one', () => {
    const { runsScored } = advanceBases(empty, BB_PLAY_TYPES.HOME_RUN, batter)
    expect(runsScored).toBe(1)
  })

  it('triple scores all runners and puts the batter on third', () => {
    const bases = { first: runner('a'), second: null, third: runner('c') }
    const { newBases, runsScored } = advanceBases(bases, BB_PLAY_TYPES.TRIPLE, batter)
    expect(newBases).toEqual({ first: null, second: null, third: batter })
    expect(runsScored).toBe(2)
  })

  it('double scores second and third, first to third, batter to second', () => {
    const bases = { first: runner('a'), second: runner('b'), third: runner('c') }
    const { newBases, runsScored } = advanceBases(bases, BB_PLAY_TYPES.DOUBLE, batter)
    expect(newBases).toEqual({ first: null, second: batter, third: runner('a') })
    expect(runsScored).toBe(2)
  })

  it('single advances each runner one base and scores third', () => {
    const bases = { first: runner('a'), second: runner('b'), third: runner('c') }
    const { newBases, runsScored } = advanceBases(bases, BB_PLAY_TYPES.SINGLE, batter)
    expect(newBases).toEqual({ first: batter, second: runner('a'), third: runner('b') })
    expect(runsScored).toBe(1)
  })

  describe('walk / hit by pitch (force advancement only)', () => {
    it('puts the batter on first when empty', () => {
      const { newBases, runsScored } = advanceBases(empty, BB_PLAY_TYPES.WALK, batter)
      expect(newBases).toEqual({ first: batter, second: null, third: null })
      expect(runsScored).toBe(0)
    })

    it('does not advance an unforced runner on third', () => {
      const bases = { first: runner('a'), second: null, third: runner('c') }
      const { newBases, runsScored } = advanceBases(bases, BB_PLAY_TYPES.WALK, batter)
      expect(newBases).toEqual({ first: batter, second: runner('a'), third: runner('c') })
      expect(runsScored).toBe(0)
    })

    it('forces in a run with the bases loaded', () => {
      const bases = { first: runner('a'), second: runner('b'), third: runner('c') }
      const { newBases, runsScored } = advanceBases(bases, BB_PLAY_TYPES.HIT_BY_PITCH, batter)
      expect(newBases).toEqual({ first: batter, second: runner('a'), third: runner('b') })
      expect(runsScored).toBe(1)
    })
  })

  it('sacrifice scores third, advances others, batter is out', () => {
    const bases = { first: runner('a'), second: runner('b'), third: runner('c') }
    const { newBases, runsScored } = advanceBases(bases, BB_PLAY_TYPES.SACRIFICE, batter)
    expect(newBases).toEqual({ first: null, second: runner('a'), third: runner('b') })
    expect(runsScored).toBe(1)
  })

  describe('stolen base advances only the lead runner', () => {
    it('third steals home', () => {
      const bases = { first: runner('a'), second: null, third: runner('c') }
      const { newBases, runsScored } = advanceBases(bases, BB_PLAY_TYPES.STOLEN_BASE, batter)
      expect(newBases).toEqual({ first: runner('a'), second: null, third: null })
      expect(runsScored).toBe(1)
    })

    it('second steals third', () => {
      const bases = { first: runner('a'), second: runner('b'), third: null }
      const { newBases, runsScored } = advanceBases(bases, BB_PLAY_TYPES.STOLEN_BASE, batter)
      expect(newBases).toEqual({ first: runner('a'), second: null, third: runner('b') })
      expect(runsScored).toBe(0)
    })

    it('is a no-op with empty bases', () => {
      const { newBases, runsScored } = advanceBases(empty, BB_PLAY_TYPES.STOLEN_BASE, batter)
      expect(newBases).toEqual(empty)
      expect(runsScored).toBe(0)
    })
  })

  it('outs leave the bases unchanged', () => {
    const bases = { first: runner('a'), second: null, third: runner('c') }
    const { newBases, runsScored } = advanceBases(bases, BB_PLAY_TYPES.STRIKEOUT, batter)
    expect(newBases).toEqual(bases)
    expect(runsScored).toBe(0)
  })

  it('tolerates a null bases object', () => {
    const { newBases, runsScored } = advanceBases(null, BB_PLAY_TYPES.SINGLE, batter)
    expect(newBases).toEqual({ first: batter, second: null, third: null })
    expect(runsScored).toBe(0)
  })
})

describe('buildBaseballPlayEvent', () => {
  const game = { inning: 5, inningHalf: 'top', totalInnings: 9 }

  it('credits the away team when batting in the top half', () => {
    const event = buildBaseballPlayEvent({
      type: BB_PLAY_TYPES.HOME_RUN, game, player: { id: 'p1', name: 'Sam', number: '12' },
      createdBy: 'u1', runsScored: 2,
    })
    expect(event.team).toBe('away')
    expect(event.scoreDelta).toEqual({ home: 0, away: 2 })
    expect(event.points).toBe(2)
    expect(event.createdBy).toBe('u1')
    expect(event.inning).toBe(5)
  })

  it('credits the home team in the bottom half', () => {
    const event = buildBaseballPlayEvent({
      type: BB_PLAY_TYPES.SINGLE, game: { ...game, inningHalf: 'bottom' },
      player: null, createdBy: 'u1', runsScored: 1,
    })
    expect(event.team).toBe('home')
    expect(event.scoreDelta).toEqual({ home: 1, away: 0 })
    expect(event.playerName).toBe('Team')
  })

  it('has a null scoreDelta when no runs scored', () => {
    const event = buildBaseballPlayEvent({
      type: BB_PLAY_TYPES.STRIKEOUT, game, player: null, createdBy: 'u1',
    })
    expect(event.scoreDelta).toBeNull()
    expect(event.points).toBe(0)
  })
})

describe('nextInningState', () => {
  it('flips top to bottom of the same inning', () => {
    expect(nextInningState({ inning: 3, inningHalf: 'top', totalInnings: 9 }))
      .toEqual({ inningHalf: 'bottom', outs: 0 })
  })

  it('advances to the top of the next inning after the bottom half', () => {
    expect(nextInningState({ inning: 3, inningHalf: 'bottom', totalInnings: 9 }))
      .toEqual({ inning: 4, inningHalf: 'top', outs: 0 })
  })

  it('ends the game after the bottom of the final inning', () => {
    expect(nextInningState({ inning: 9, inningHalf: 'bottom', totalInnings: 9 }))
      .toEqual({ inning: 10, inningHalf: 'top', outs: 0, status: 'final' })
  })
})

describe('describeBaseballPlay', () => {
  it('includes number, name and label', () => {
    expect(describeBaseballPlay({ type: 'homeRun', playerName: 'Sam', playerNumber: '12' }))
      .toBe('#12 Sam — HR')
  })

  it('omits the number when missing', () => {
    expect(describeBaseballPlay({ type: 'strikeout', playerName: 'Sam', playerNumber: '' }))
      .toBe('Sam — K')
  })
})
