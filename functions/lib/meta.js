// Pure helpers for server-rendered social/SEO meta tags. No Firebase imports,
// so they can be unit-tested in isolation (see meta.test.js).

const SITE = 'https://sportstream-91d22.web.app'
const OG_IMAGE = `${SITE}/og-image.png`
const EN_DASH = '–'
const EM_DASH = '—'

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

function buildGameMeta(game, gameId) {
  const home = game.homeTeam || 'Home'
  const away = game.awayTeam || 'Away'
  const score = `${game.homeScore ?? 0}${EN_DASH}${game.awayScore ?? 0}`
  const state = game.status === 'live' ? 'LIVE' : game.status === 'final' ? 'Final' : ''
  const title = `${home} vs ${away}${state ? ` ${EM_DASH} ${state} ${score}` : ''} | SportStream`
  const description =
    game.status === 'final'
      ? `Final: ${home} ${score} ${away}. Box score and player stats on SportStream.`
      : game.status === 'live'
        ? `${home} ${score} ${away} ${EM_DASH} live now. Follow the play-by-play on SportStream.`
        : `${home} vs ${away} on SportStream ${EM_DASH} live scores, play-by-play and stats.`
  return { title, description, image: OG_IMAGE, url: `${SITE}/game/${gameId}` }
}

function buildTeamMeta(club, clubId) {
  const name = club.name || 'Team'
  return {
    title: `${name} | SportStream`,
    description: `Follow ${name} on SportStream ${EM_DASH} live scores, schedule, results and season stats.`,
    image: club.logoUrl || OG_IMAGE,
    url: `${SITE}/team/${clubId}`,
  }
}

/**
 * Rewrite the <title> and social meta tags of an SPA shell to entity-specific
 * values. Tags already present are replaced in place; missing ones are appended
 * before </head>. Crawlers read these without executing the app's JS.
 */
function injectMeta(html, meta) {
  let out = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`)
  const set = (attr, key, val) => {
    const re = new RegExp(`<meta ${attr}="${key}"[^>]*>`, 'i')
    const tag = `<meta ${attr}="${key}" content="${escapeHtml(val)}">`
    out = re.test(out) ? out.replace(re, tag) : out.replace(/<\/head>/i, `${tag}</head>`)
  }
  set('name', 'description', meta.description)
  set('property', 'og:title', meta.title)
  set('property', 'og:description', meta.description)
  set('property', 'og:image', meta.image)
  set('property', 'og:url', meta.url)
  set('name', 'twitter:title', meta.title)
  set('name', 'twitter:description', meta.description)
  set('name', 'twitter:image', meta.image)
  return out
}

module.exports = { SITE, OG_IMAGE, escapeHtml, buildGameMeta, buildTeamMeta, injectMeta }
