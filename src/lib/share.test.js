import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  absoluteUrl, shareContent,
  gameSharePayload, teamSharePayload, playerSharePayload,
  leagueInvitePayload, tournamentInvitePayload,
} from './share'

describe('absoluteUrl', () => {
  it('prefixes the origin and normalizes the slash', () => {
    // jsdom/node default origin resolves to the fallback host
    expect(absoluteUrl('/game/abc')).toMatch(/\/game\/abc$/)
    expect(absoluteUrl('game/abc')).toMatch(/\/game\/abc$/)
    expect(absoluteUrl('/game/abc')).toMatch(/^https?:\/\//)
  })
})

describe('gameSharePayload', () => {
  it('frames a live game with the current score', () => {
    const p = gameSharePayload(
      { homeTeam: 'Hawks', awayTeam: 'Wolves', homeScore: 58, awayScore: 54, status: 'live' },
      'g1'
    )
    expect(p.title).toBe('Hawks vs Wolves — LIVE')
    expect(p.text).toContain('58–54')
    expect(p.url).toMatch(/\/game\/g1$/)
  })

  it('frames a final game with the box score', () => {
    const p = gameSharePayload(
      { homeTeam: 'Hawks', awayTeam: 'Wolves', homeScore: 60, awayScore: 55, status: 'final' },
      'g1'
    )
    expect(p.title).toContain('Final')
    expect(p.text).toContain('Final: Hawks 60–55 Wolves')
  })

  it('falls back gracefully for setup/scheduled games', () => {
    const p = gameSharePayload({ homeTeam: 'Hawks', awayTeam: 'Wolves', status: 'setup' }, 'g1')
    expect(p.title).toBe('Hawks vs Wolves')
    expect(p.text).toContain('Follow')
  })
})

describe('invite payloads include the join code and route', () => {
  it('league invite', () => {
    const p = leagueInvitePayload({ name: 'Spring Hoops', joinCode: 'AB12CD' }, 'lg1')
    expect(p.text).toContain('AB12CD')
    expect(p.url).toMatch(/\/league\/lg1\/join$/)
  })

  it('tournament invite', () => {
    const p = tournamentInvitePayload({ name: 'Summer Slam', joinCode: 'XY99ZZ' }, 't1')
    expect(p.text).toContain('XY99ZZ')
    expect(p.url).toMatch(/\/tournament\/t1\/join$/)
  })

  it('omits the code phrase when there is no join code', () => {
    const p = leagueInvitePayload({ name: 'Spring Hoops' }, 'lg1')
    expect(p.text).not.toContain('Join code:')
  })
})

describe('team & player payloads', () => {
  it('team', () => {
    const p = teamSharePayload({ name: 'Hawks' }, 'c1')
    expect(p.url).toMatch(/\/team\/c1$/)
    expect(p.text).toContain('Hawks')
  })
  it('player', () => {
    const p = playerSharePayload({ name: 'Sam Jones' }, 'c1', 'p1')
    expect(p.url).toMatch(/\/player\/c1\/p1$/)
    expect(p.text).toContain('Sam Jones')
  })
})

describe('shareContent', () => {
  const payload = { title: 't', text: 'x', url: 'https://e.x/g/1' }
  const hadNavigator = 'navigator' in globalThis
  const original = hadNavigator ? globalThis.navigator : undefined

  const setNavigator = (value) =>
    Object.defineProperty(globalThis, 'navigator', { value, configurable: true, writable: true })

  afterEach(() => {
    if (hadNavigator) setNavigator(original)
    else delete globalThis.navigator
  })

  it('uses the native share sheet when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    setNavigator({ share })
    expect(await shareContent(payload)).toBe('shared')
    expect(share).toHaveBeenCalledWith(payload)
  })

  it('returns cancelled when the user dismisses the sheet', async () => {
    const abort = Object.assign(new Error('x'), { name: 'AbortError' })
    const clip = vi.fn()
    setNavigator({ share: vi.fn().mockRejectedValue(abort), clipboard: { writeText: clip } })
    expect(await shareContent(payload)).toBe('cancelled')
    expect(clip).not.toHaveBeenCalled()
  })

  it('falls back to clipboard when share is unavailable', async () => {
    const clip = vi.fn().mockResolvedValue(undefined)
    setNavigator({ clipboard: { writeText: clip } })
    expect(await shareContent(payload)).toBe('copied')
    expect(clip).toHaveBeenCalledWith('https://e.x/g/1')
  })

  it('falls back to clipboard when share throws a non-abort error', async () => {
    const clip = vi.fn().mockResolvedValue(undefined)
    setNavigator({ share: vi.fn().mockRejectedValue(new Error('no permission')), clipboard: { writeText: clip } })
    expect(await shareContent(payload)).toBe('copied')
  })

  it('reports failed when neither path works', async () => {
    setNavigator({ clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
    expect(await shareContent(payload)).toBe('failed')
  })
})
