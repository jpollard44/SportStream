// Premium plan helpers.
// isPremium returns true if the user's plan grants access to premium features.
// Currently only 'premium' plan is gated. Expand as needed.
export function isPremium(userDoc) {
  return userDoc?.plan === 'premium' || userDoc?.plan === 'team'
}

// Notable play types that trigger player follow alerts
export const NOTABLE_PLAY_TYPES = new Set([
  // Baseball
  'home_run', 'triple', 'double',
  'strikeout',
  'run_scored',
  // Basketball
  '3pt', '2pt', 'steal', 'block',
  // Soccer / volleyball / flag-football
  'goal', 'score',
])

export function getNotablePlayLabel(type, sport) {
  const labels = {
    home_run:   '💥 Home Run!',
    triple:     '🏃 Triple!',
    double:     '🏃 Double!',
    strikeout:  '🔥 Strikeout!',
    run_scored: '🏠 Run Scored!',
    '3pt':      '🔥 3-Pointer!',
    '2pt':      '🏀 Basket!',
    steal:      '⚡ Steal!',
    block:      '🛡 Block!',
    goal:       '⚽ Goal!',
    score:      '✅ Score!',
  }
  return labels[type] || null
}
