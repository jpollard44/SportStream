// Sharing helpers — one place that builds the share payloads and one function
// that hands them to the native share sheet (mobile) or the clipboard (desktop).

const ORIGIN = typeof window !== 'undefined' && window.location
  ? window.location.origin
  : 'https://sportstream-91d22.web.app'

export function absoluteUrl(path) {
  return `${ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`
}

/**
 * Share via the Web Share API, falling back to copying the link.
 * Returns 'shared' | 'copied' | 'cancelled' | 'failed' so the caller can
 * show the right confirmation.
 */
export async function shareContent({ title, text, url }) {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, text, url })
      return 'shared'
    } catch (e) {
      // User dismissed the sheet — not an error, don't fall back to clipboard
      if (e && e.name === 'AbortError') return 'cancelled'
      // Any other failure: fall through to the clipboard path
    }
  }
  const toCopy = url || text || ''
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(toCopy)
      return 'copied'
    }
  } catch {
    // ignore — reported as failed below
  }
  return 'failed'
}

// ── Payload builders (pure) ──────────────────────────────────────────────────

export function gameSharePayload(game, gameId) {
  const home = game?.homeTeam || 'Home'
  const away = game?.awayTeam || 'Away'
  const url = absoluteUrl(`/game/${gameId}`)
  if (game?.status === 'live') {
    return {
      title: `${home} vs ${away} — LIVE`,
      text: `${home} ${game.homeScore ?? 0}–${game.awayScore ?? 0} ${away} — watch live on SportStream`,
      url,
    }
  }
  if (game?.status === 'final') {
    return {
      title: `${home} vs ${away} — Final`,
      text: `Final: ${home} ${game.homeScore ?? 0}–${game.awayScore ?? 0} ${away}. Box score on SportStream`,
      url,
    }
  }
  return {
    title: `${home} vs ${away}`,
    text: `Follow ${home} vs ${away} on SportStream`,
    url,
  }
}

export function teamSharePayload(club, clubId) {
  const name = club?.name || 'this team'
  return {
    title: name,
    text: `Follow ${name} on SportStream — live scores, schedule, and stats`,
    url: absoluteUrl(`/team/${clubId}`),
  }
}

export function playerSharePayload(player, clubId, playerId) {
  const name = player?.name || 'this player'
  return {
    title: name,
    text: `Check out ${name}'s stats on SportStream`,
    url: absoluteUrl(`/player/${clubId}/${playerId}`),
  }
}

export function leagueInvitePayload(league, leagueId) {
  const name = league?.name || 'our league'
  const code = league?.joinCode ? ` Join code: ${league.joinCode}.` : ''
  return {
    title: `Join ${name} on SportStream`,
    text: `You're invited to register a team for ${name} on SportStream.${code}`,
    url: absoluteUrl(`/league/${leagueId}/join`),
  }
}

export function tournamentInvitePayload(tournament, tourId) {
  const name = tournament?.name || 'our tournament'
  const code = tournament?.joinCode ? ` Join code: ${tournament.joinCode}.` : ''
  return {
    title: `Join ${name} on SportStream`,
    text: `You're invited to register a team for ${name} on SportStream.${code}`,
    url: absoluteUrl(`/tournament/${tourId}/join`),
  }
}
