// Premium plan helpers.
// isPremium returns true if the user's plan grants access to premium features.
// Currently only 'premium' plan is gated. Expand as needed.
export function isPremium(userDoc) {
  return userDoc?.plan === 'premium' || userDoc?.plan === 'team'
}

// Notable play types that trigger player follow alerts
// Keys must match actual play type strings from BB_PLAY_TYPES / PLAY_TYPES
export const NOTABLE_PLAY_TYPES = new Set([
  // Baseball / Softball (BB_PLAY_TYPES)
  'homeRun', 'triple', 'double', 'strikeout', 'run',
  // Basketball (PLAY_TYPES)
  'score_3', 'score_2', 'steal', 'block',
  // Soccer / volleyball / flag-football
  'goal', 'touchdown', 'ace', 'kill',
])

export function getNotablePlayLabel(type, sport) {
  const labels = {
    homeRun:   '💥 Home Run!',
    triple:    '🏃 Triple!',
    double:    '🏃 Double!',
    strikeout: '🔥 Strikeout!',
    run:       '🏠 Run Scored!',
    score_3:   '🔥 3-Pointer!',
    score_2:   '🏀 Basket!',
    steal:     '⚡ Steal!',
    block:     '🛡 Block!',
    goal:      '⚽ Goal!',
    touchdown: '🏈 Touchdown!',
    ace:       '🎾 Ace!',
    kill:      '💥 Kill!',
  }
  return labels[type] || null
}
