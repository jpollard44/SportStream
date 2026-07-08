import { describe, it, expect } from 'vitest'
import {
  formatClock, ordinal, periodLabel, inningLabel, nickDisplay,
} from './formatters'

describe('formatClock', () => {
  it('counts down from periodLength when provided', () => {
    expect(formatClock(0, 600)).toBe('10:00')
    expect(formatClock(90, 600)).toBe('08:30')
    expect(formatClock(600, 600)).toBe('00:00')
  })

  it('never goes below zero', () => {
    expect(formatClock(700, 600)).toBe('00:00')
  })

  it('counts up when periodLength is null', () => {
    expect(formatClock(0, null)).toBe('00:00')
    expect(formatClock(65, null)).toBe('01:05')
    expect(formatClock(3599, null)).toBe('59:59')
  })
})

describe('ordinal', () => {
  it('handles standard suffixes', () => {
    expect(ordinal(1)).toBe('1st')
    expect(ordinal(2)).toBe('2nd')
    expect(ordinal(3)).toBe('3rd')
    expect(ordinal(4)).toBe('4th')
  })

  it('handles the 11-13 exceptions', () => {
    expect(ordinal(11)).toBe('11th')
    expect(ordinal(12)).toBe('12th')
    expect(ordinal(13)).toBe('13th')
    expect(ordinal(21)).toBe('21st')
    expect(ordinal(22)).toBe('22nd')
    expect(ordinal(111)).toBe('111th')
  })
})

describe('periodLabel', () => {
  it('uses halves when totalPeriods is 2', () => {
    expect(periodLabel(1, 2)).toBe('1st Half')
    expect(periodLabel(2, 2)).toBe('2nd Half')
  })

  it('uses quarters otherwise', () => {
    expect(periodLabel(1, 4)).toBe('1st Quarter')
    expect(periodLabel(4, 4)).toBe('4th Quarter')
  })
})

describe('inningLabel', () => {
  it('shows an up arrow for the top half', () => {
    expect(inningLabel(3, 'top')).toBe('▲ 3rd')
  })

  it('shows a down arrow for the bottom half', () => {
    expect(inningLabel(9, 'bottom')).toBe('▼ 9th')
  })
})

describe('nickDisplay', () => {
  it('prefers the nickname when set', () => {
    expect(nickDisplay('Jordan Pollard', 'JoJo')).toBe('JoJo')
  })

  it('falls back to the first name', () => {
    expect(nickDisplay('Jordan Pollard', '')).toBe('Jordan')
    expect(nickDisplay('Jordan Pollard', null)).toBe('Jordan')
  })

  it('ignores whitespace-only nicknames', () => {
    expect(nickDisplay('Jordan Pollard', '   ')).toBe('Jordan')
  })

  it('handles missing names', () => {
    expect(nickDisplay(null, null)).toBe('')
    expect(nickDisplay(undefined, undefined)).toBe('')
  })
})
