import { describe, it, expect } from 'vitest'
import { classifyIntent, isPositive } from './intent.js'

describe('classifyIntent', () => {
  it.each([
    ['Please remove me from your list', 'unsubscribe'],
    ['I am out of the office until Monday', 'out_of_office'],
    ['Booked a time on your Calendly for Thursday', 'meeting'],
    ["I'm not the right person for this — try reaching our head of growth", 'wrong_person'],
    ["Thanks but we're all set, already using something in-house", 'not_interested'],
    ['Not right now — circle back in October?', 'not_now'],
    ['How much does this cost for a team of 8?', 'question'],
    ["Sounds great, let's chat next week", 'interested'],
  ])('classifies %j as %s', (text, expected) => {
    expect(classifyIntent(text)).toBe(expected)
  })

  it('prefers higher-priority intents when patterns overlap', () => {
    // "interested" pattern also matches, but unsubscribe must win
    expect(classifyIntent('Interesting, but please remove me from your list')).toBe('unsubscribe')
  })
})

describe('isPositive', () => {
  it('flags interested and meeting as positive', () => {
    expect(isPositive('interested')).toBe(true)
    expect(isPositive('meeting')).toBe(true)
    expect(isPositive('not_interested')).toBe(false)
  })
})
