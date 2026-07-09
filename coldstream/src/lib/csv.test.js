import { describe, it, expect } from 'vitest'
import { parseCsv, parseLeadsCsv } from './csv.js'

describe('parseCsv', () => {
  it('parses simple rows', () => {
    expect(parseCsv('a,b\nc,d')).toEqual([['a', 'b'], ['c', 'd']])
  })
  it('handles quoted fields with commas and escaped quotes', () => {
    expect(parseCsv('"a,x",b\n"say ""hi""",d')).toEqual([['a,x', 'b'], ['say "hi"', 'd']])
  })
  it('handles CRLF and trailing newline', () => {
    expect(parseCsv('a,b\r\nc,d\r\n')).toEqual([['a', 'b'], ['c', 'd']])
  })
})

describe('parseLeadsCsv', () => {
  it('maps header aliases to canonical fields', () => {
    const { leads } = parseLeadsCsv('Email Address,First Name,Company Name\nava@quantia.com,Ava,Quantia')
    expect(leads).toEqual([{ email: 'ava@quantia.com', firstName: 'Ava', company: 'Quantia' }])
  })
  it('skips invalid emails and dedupes', () => {
    const { leads, skipped } = parseLeadsCsv('email\nava@quantia.com\nnot-an-email\nAVA@quantia.com')
    expect(leads).toHaveLength(1)
    expect(skipped).toBe(2)
  })
  it('keeps unknown columns as camelCase custom fields', () => {
    const { leads } = parseLeadsCsv('email,Favorite Color\nava@quantia.com,teal')
    expect(leads[0].favoriteColor).toBe('teal')
  })
})
