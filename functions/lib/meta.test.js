import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'

// meta.js is CommonJS (Cloud Functions runtime); load it via require.
const require = createRequire(import.meta.url)
const { escapeHtml, buildGameMeta, buildTeamMeta, injectMeta } = require('./meta.js')

const SHELL = `<!doctype html><html><head>
<title>SportStream – Live Rec League Scoring</title>
<meta name="description" content="default desc" />
<meta property="og:title" content="default" />
<meta property="og:description" content="default" />
<meta property="og:image" content="https://sportstream-91d22.web.app/og-image.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:url" content="https://sportstream-91d22.web.app" />
<meta name="twitter:title" content="default" />
<meta name="twitter:description" content="default" />
<meta name="twitter:image" content="https://sportstream-91d22.web.app/og-image.png" />
</head><body><div id="root"></div></body></html>`

describe('escapeHtml', () => {
  it('escapes the dangerous characters', () => {
    expect(escapeHtml('A & B <c> "d"')).toBe('A &amp; B &lt;c&gt; &quot;d&quot;')
  })
  it('handles nullish input', () => {
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })
})

describe('buildGameMeta', () => {
  it('frames a live game with the score in title and description', () => {
    const m = buildGameMeta({ homeTeam: 'Hawks', awayTeam: 'Wolves', homeScore: 58, awayScore: 54, status: 'live' }, 'g1')
    expect(m.title).toBe('Hawks vs Wolves — LIVE 58–54 | SportStream')
    expect(m.description).toContain('live now')
    expect(m.url).toBe('https://sportstream-91d22.web.app/game/g1')
    expect(m.image).toContain('/og-image.png')
  })

  it('frames a final game with the box score', () => {
    const m = buildGameMeta({ homeTeam: 'Hawks', awayTeam: 'Wolves', homeScore: 60, awayScore: 55, status: 'final' }, 'g1')
    expect(m.title).toBe('Hawks vs Wolves — Final 60–55 | SportStream')
    expect(m.description).toContain('Final: Hawks 60–55 Wolves')
  })

  it('omits score state for a game that has not started', () => {
    const m = buildGameMeta({ homeTeam: 'Hawks', awayTeam: 'Wolves', status: 'setup' }, 'g1')
    expect(m.title).toBe('Hawks vs Wolves | SportStream')
  })

  it('defaults missing team names and scores', () => {
    const m = buildGameMeta({ status: 'live' }, 'g1')
    expect(m.title).toBe('Home vs Away — LIVE 0–0 | SportStream')
  })
})

describe('buildTeamMeta', () => {
  it('uses the club name and logo', () => {
    const m = buildTeamMeta({ name: 'Hawks', logoUrl: 'https://x/logo.png' }, 'c1')
    expect(m.title).toBe('Hawks | SportStream')
    expect(m.image).toBe('https://x/logo.png')
    expect(m.url).toBe('https://sportstream-91d22.web.app/team/c1')
  })
  it('falls back to the default OG image without a logo', () => {
    const m = buildTeamMeta({ name: 'Hawks' }, 'c1')
    expect(m.image).toContain('/og-image.png')
  })
})

describe('injectMeta', () => {
  const meta = buildGameMeta({ homeTeam: 'Hawks', awayTeam: 'Wolves', homeScore: 58, awayScore: 54, status: 'live' }, 'g1')
  const out = injectMeta(SHELL, meta)

  it('replaces the document title', () => {
    expect(out).toContain('<title>Hawks vs Wolves — LIVE 58–54 | SportStream</title>')
    expect(out).not.toContain('Live Rec League Scoring')
  })

  it('replaces og and twitter tags in place (no duplicates)', () => {
    expect((out.match(/property="og:title"/g) || []).length).toBe(1)
    expect((out.match(/name="twitter:title"/g) || []).length).toBe(1)
    expect(out).toContain('<meta property="og:title" content="Hawks vs Wolves — LIVE 58–54 | SportStream">')
    expect(out).toContain('<meta property="og:url" content="https://sportstream-91d22.web.app/game/g1">')
  })

  it('leaves unrelated tags (og:image:width) intact', () => {
    expect(out).toContain('<meta property="og:image:width" content="1200" />')
  })

  it('appends a tag that was missing rather than dropping it', () => {
    const bare = '<html><head><title>x</title></head><body></body></html>'
    const res = injectMeta(bare, meta)
    expect(res).toContain('<meta property="og:title" content=')
    expect(res).toContain('</head>')
  })

  it('escapes HTML in team names', () => {
    const evil = buildTeamMeta({ name: 'A <script> & "B"' }, 'c1')
    const res = injectMeta(SHELL, evil)
    expect(res).toContain('&lt;script&gt;')
    expect(res).not.toContain('<script> & "B"')
  })
})
