import { describe, it, expect } from 'vitest'
import { renderSpintax, renderMergeTags, renderEmail, extractMergeTags } from './spintax.js'

const first = (options) => options[0]

describe('renderSpintax', () => {
  it('picks one option per group', () => {
    expect(renderSpintax('{Hi|Hey} there', first)).toBe('Hi there')
  })
  it('resolves multiple and nested groups', () => {
    expect(renderSpintax('{a|b} {c|{d|e}}', first)).toBe('a c')
    expect(renderSpintax('{{d|e} x|y}', first)).toBe('d x')
  })
  it('leaves plain text and merge tags alone', () => {
    expect(renderSpintax('Hello {{firstName}}', first)).toBe('Hello {{firstName}}')
  })
})

describe('renderMergeTags', () => {
  it('substitutes lead fields', () => {
    expect(renderMergeTags('Hi {{firstName}} at {{company}}', { firstName: 'Ava', company: 'Quantia' }))
      .toBe('Hi Ava at Quantia')
  })
  it('uses fallbacks for missing fields', () => {
    expect(renderMergeTags('Hi {{firstName|there}}', {})).toBe('Hi there')
    expect(renderMergeTags('Hi {{firstName|there}}', { firstName: 'Ava' })).toBe('Hi Ava')
  })
  it('blanks missing fields without fallback', () => {
    expect(renderMergeTags('Hi {{firstName}}!', {})).toBe('Hi !')
  })
})

describe('renderEmail', () => {
  it('applies spintax before merge tags', () => {
    expect(renderEmail('{Hi|Hey} {{firstName|there}}', { firstName: 'Ava' }, first)).toBe('Hi Ava')
  })
})

describe('extractMergeTags', () => {
  it('lists unique tags including ones with fallbacks', () => {
    expect(extractMergeTags('{{firstName}} {{company|your team}} {{firstName}}')).toEqual(['firstName', 'company'])
  })
})
