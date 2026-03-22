export function formatClock(totalSeconds, periodLength) {
  // Count down from periodLength if provided, otherwise count up
  const display = periodLength != null ? Math.max(0, periodLength - totalSeconds) : totalSeconds
  const mins = Math.floor(display / 60)
  const secs = display % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export function formatDate(timestamp) {
  if (!timestamp) return ''
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function formatTime(timestamp) {
  if (!timestamp) return ''
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export function periodLabel(period, totalPeriods) {
  if (totalPeriods === 2) return period === 1 ? '1st Half' : '2nd Half'
  return `${ordinal(period)} Quarter`
}

export function inningLabel(inning, inningHalf) {
  const arrow = inningHalf === 'top' ? '▲' : '▼'
  return `${arrow} ${ordinal(inning)}`
}

// Returns nickname if set, otherwise first word of full name (for compact single-line display)
export function nickDisplay(name, nickname) {
  return nickname?.trim() || name?.split(' ')[0] || name || ''
}
